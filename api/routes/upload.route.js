import express from 'express';
import multer from 'multer';
import cloudinary from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';
import { verifyToken } from '../utils/verify.js';

dotenv.config();

const router = express.Router();

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Validate Cloudinary configuration
const validateCloudinaryConfig = () => {
  const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('Missing Cloudinary environment variables:', missing);
    throw new Error(`Missing required Cloudinary environment variables: ${missing.join(', ')}`);
  }

  console.log('Cloudinary configuration validated successfully');
};

// Validate on startup
try {
  validateCloudinaryConfig();
} catch (error) {
  console.error('Cloudinary configuration error:', error.message);
}

// Configure multer storage for Cloudinary - IMAGES
const imageStorage = new CloudinaryStorage({
  cloudinary: cloudinary.v2,
  params: {
    folder: 'urbansetu-chat/images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
    transformation: [{ width: 2000, height: 2000, crop: 'limit' }],
    resource_type: 'image',
  },
});

// Configure multer storage for Cloudinary - VIDEOS (resource_type video)
const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary.v2,
  params: {
    folder: 'urbansetu-chat/videos',
    allowed_formats: ['mp4', 'webm', 'ogg', 'mov', 'mkv'],
    resource_type: 'video',
  },
});

// Configure multer storage for Cloudinary - DOCUMENTS (resource_type raw)
const documentStorage = new CloudinaryStorage({
  cloudinary: cloudinary.v2,
  params: {
    folder: 'urbansetu-chat/documents',
    // Allow any document format; Cloudinary "raw" accepts arbitrary
    resource_type: 'raw',
  },
});

// Configure multer storage for Cloudinary - AUDIO
const audioStorage = new CloudinaryStorage({
  cloudinary: cloudinary.v2,
  params: {
    folder: 'urbansetu-chat/audio',
    allowed_formats: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'webm'],
    resource_type: 'video', // Cloudinary uses 'video' resource_type for audio files
    transformation: [{ quality: 'auto', format: 'auto' }], // Optimize audio files
  },
});

// Standard file size limit (10MB for images/docs/audio)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
// Video file size limit (100MB)
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

// Configure multer per type
const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    return cb(new Error('Only image files are allowed!'));
  },
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) return cb(null, true);
    return cb(new Error('Only video files are allowed!'));
  },
});

const uploadDocument = multer({
  storage: documentStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    // accept any non-image/video as document, plus common application/* types
    if (
      file.mimetype.startsWith('application/') ||
      file.mimetype.startsWith('text/') ||
      (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/'))
    ) return cb(null, true);
    return cb(new Error('Invalid document type'));
  },
});

const uploadAudio = multer({
  storage: audioStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    // Accept typical audio types and common containers used for audio-only recordings
    if (
      file.mimetype.startsWith('audio/') ||
      file.mimetype === 'video/webm' ||
      file.mimetype === 'video/mp4'
    ) return cb(null, true);
    return cb(new Error('Only audio files are allowed!'));
  },
});

// Upload single image
router.post('/image', verifyToken, uploadImage.single('image'), async (req, res) => {
  try {
    console.log('Upload request received:', req.file ? 'File present' : 'No file');
    console.log('Cloudinary config:', {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Not set',
      api_secret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Not set'
    });

    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    console.log('File uploaded successfully:', req.file.path);
    res.status(200).json({
      message: 'Image uploaded successfully',
      imageUrl: req.file.path,
      publicId: req.file.filename,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error uploading image', error: error.message });
  }
});

// Proxy external image to bypass CORS for client-side OCR and audit
router.get('/proxy-image', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ message: 'No URL provided' });
    }

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ message: `Failed to fetch image: ${response.statusText}` });
    }

    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Convert response body to buffer and send it
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (error) {
    console.error('Proxy image error:', error);
    res.status(500).json({ message: 'Error proxying image', error: error.message });
  }
});

// Enhanced error handling middleware for multer and Cloudinary
router.use((error, req, res, next) => {
  console.error('Upload error:', error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      // Determine which limit was exceeded based on the field name or request path (imperfect but helpful)
      // Since we don't know exactly which limit triggered it here easily without context, we'll give a generic or high-level message
      return res.status(400).json({
        success: false,
        message: `File size too large. Maximum size is 10MB for images/docs/audio and 100MB for videos.`
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field. Please use the correct form field name.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Only one file allowed per upload.'
      });
    }
    return res.status(400).json({
      success: false,
      message: 'File upload error',
      error: error.message
    });
  }

  // Handle Cloudinary-specific errors
  if (error.message && error.message.includes('Cloudinary')) {
    return res.status(500).json({
      success: false,
      message: 'Cloudinary upload failed',
      error: error.message
    });
  }

  if (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Upload error'
    });
  }
  next();
});

// Upload multiple images
router.post('/images', verifyToken, uploadImage.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No image files provided' });
    }

    const uploadedImages = req.files.map(file => ({
      imageUrl: file.path,
      publicId: file.filename,
    }));

    res.status(200).json({
      message: 'Images uploaded successfully',
      images: uploadedImages,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error uploading images', error: error.message });
  }
});

// Delete image from Cloudinary
router.delete('/image/:publicId', verifyToken, async (req, res) => {
  try {
    const { publicId } = req.params;

    const result = await cloudinary.v2.uploader.destroy(publicId);

    if (result.result === 'ok') {
      res.status(200).json({ message: 'Image deleted successfully' });
    } else {
      res.status(400).json({ message: 'Failed to delete image' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Error deleting image', error: error.message });
  }
});

// Upload single video
router.post('/video', verifyToken, uploadVideo.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No video file provided' });
    }
    // CloudinaryStorage returns path/public id similar to images
    res.status(200).json({
      message: 'Video uploaded successfully',
      videoUrl: req.file.path,
      publicId: req.file.filename,
    });
  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({ message: 'Error uploading video', error: error.message });
  }
});

// Upload single document
router.post('/document', verifyToken, uploadDocument.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No document file provided' });
    }
    res.status(200).json({
      message: 'Document uploaded successfully',
      documentUrl: req.file.path,
      publicId: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ message: 'Error uploading document', error: error.message });
  }
});

// Upload single audio
router.post('/audio', verifyToken, uploadAudio.single('audio'), async (req, res) => {
  try {
    console.log('Audio upload request received:', {
      hasFile: !!req.file,
      fileSize: req.file?.size,
      mimeType: req.file?.mimetype,
      originalName: req.file?.originalname
    });

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No audio file provided'
      });
    }

    console.log('Audio uploaded successfully to Cloudinary:', {
      path: req.file.path,
      filename: req.file.filename,
      size: req.file.size
    });

    res.status(200).json({
      success: true,
      message: 'Audio uploaded successfully',
      audioUrl: req.file.path,
      publicId: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    });
  } catch (error) {
    console.error('Audio upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading audio',
      error: error.message
    });
  }
});

export default router;