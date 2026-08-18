import express from 'express';
import multer from 'multer';
import cloudinary from 'cloudinary';
import dotenv from 'dotenv';
import { verifyToken } from '../utils/verify.js';
import {
  getCloudinaryInstance,
  getCloudinaryInstanceByCloudName,
  extractCloudNameFromUrl,
  recordUpload,
  recordFailure,
} from '../utils/cloudinaryPool.js';

dotenv.config();

const router = express.Router();

// ──────────────────────────────────────────────────────────────────
// NOTE: We no longer use multer-storage-cloudinary here.
// Instead, we use multer memory storage so we can pick a different
// Cloudinary account per request (from the pool) BEFORE uploading.
// ──────────────────────────────────────────────────────────────────

// Standard file size limit (10MB for images/docs/audio)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
// Video file size limit (100MB)
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

// Memory-based multer instances (files buffered in RAM before Cloudinary upload)
const uploadImageMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    return cb(new Error('Only image files are allowed!'));
  },
});

const uploadVideoMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) return cb(null, true);
    return cb(new Error('Only video files are allowed!'));
  },
});

const uploadDocumentMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith('application/') ||
      file.mimetype.startsWith('text/') ||
      (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/'))
    ) return cb(null, true);
    return cb(new Error('Invalid document type'));
  },
});

const uploadAudioMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith('audio/') ||
      file.mimetype === 'video/webm' ||
      file.mimetype === 'video/mp4'
    ) return cb(null, true);
    return cb(new Error('Only audio files are allowed!'));
  },
});

/**
 * Upload a buffer to Cloudinary using a pool account, with retry on failure.
 * 
 * @param {Buffer} buffer - The file buffer
 * @param {Object} options - Cloudinary upload options (folder, resource_type, etc.)
 * @param {number} [fileSize=0] - File size for tracking
 * @param {number} [maxRetries=3] - Maximum accounts to try
 * @returns {{ result: Object, account: Object }} Upload result and account used
 */
async function uploadToCloudinaryPool(buffer, options, fileSize = 0, maxRetries = 3) {
  const failedIndices = [];

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const pool = await getCloudinaryInstance(failedIndices);
    if (!pool) {
      throw new Error('No available Cloudinary accounts in the pool');
    }

    const { instance, account } = pool;

    try {
      const dataUri = `data:${options.mimetype || 'application/octet-stream'};base64,${buffer.toString('base64')}`;

      const uploadOptions = { ...options };
      delete uploadOptions.mimetype; // Not a Cloudinary option

      const result = await instance.uploader.upload(dataUri, uploadOptions);

      // Record successful upload
      await recordUpload(account.accountIndex, fileSize);
      console.log(`[CloudinaryPool] ✅ Upload success on account ${account.accountIndex} (${account.cloudName})`);

      return { result, account };
    } catch (error) {
      console.error(`[CloudinaryPool] ❌ Upload failed on account ${account.accountIndex} (${account.cloudName}):`, error.message);
      await recordFailure(account.accountIndex, error.message);
      failedIndices.push(account.accountIndex);

      // If this was the last attempt, throw
      if (attempt === maxRetries - 1) {
        throw new Error(`All ${maxRetries} Cloudinary accounts failed. Last error: ${error.message}`);
      }
    }
  }
}

// ─── Upload single image ─────────────────────────────────────────
router.post('/image', verifyToken, uploadImageMemory.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const { result, account } = await uploadToCloudinaryPool(
      req.file.buffer,
      {
        folder: 'urbansetu-chat/images',
        resource_type: 'image',
        transformation: [{ width: 2000, height: 2000, crop: 'limit' }],
        mimetype: req.file.mimetype,
      },
      req.file.size
    );

    console.log(`[Upload] Image uploaded to account ${account.cloudName}:`, result.secure_url);
    res.status(200).json({
      message: 'Image uploaded successfully',
      imageUrl: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error uploading image', error: error.message });
  }
});

// ─── Upload multiple images ──────────────────────────────────────
router.post('/images', verifyToken, uploadImageMemory.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No image files provided' });
    }

    const uploadedImages = [];
    for (const file of req.files) {
      const { result } = await uploadToCloudinaryPool(
        file.buffer,
        {
          folder: 'urbansetu-chat/images',
          resource_type: 'image',
          transformation: [{ width: 2000, height: 2000, crop: 'limit' }],
          mimetype: file.mimetype,
        },
        file.size
      );
      uploadedImages.push({
        imageUrl: result.secure_url,
        publicId: result.public_id,
      });
    }

    res.status(200).json({
      message: 'Images uploaded successfully',
      images: uploadedImages,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error uploading images', error: error.message });
  }
});

// ─── Delete image from Cloudinary ────────────────────────────────
router.delete('/image/:publicId', verifyToken, async (req, res) => {
  try {
    const { publicId } = req.params;
    // The cloudUrl query param helps us find which account to use
    const { cloudUrl } = req.query;

    let instance;
    if (cloudUrl) {
      const cloudName = extractCloudNameFromUrl(cloudUrl);
      if (cloudName) {
        const pool = getCloudinaryInstanceByCloudName(cloudName);
        if (pool) instance = pool.instance;
      }
    }

    // Fallback: try to extract cloud name from the publicId folder structure
    // or just use the first available account
    if (!instance) {
      const pool = await getCloudinaryInstance();
      if (!pool) {
        return res.status(500).json({ message: 'No Cloudinary accounts available' });
      }
      instance = pool.instance;
    }

    const result = await instance.uploader.destroy(publicId);

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

// ─── Upload single video ─────────────────────────────────────────
router.post('/video', verifyToken, uploadVideoMemory.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No video file provided' });
    }

    const { result, account } = await uploadToCloudinaryPool(
      req.file.buffer,
      {
        folder: 'urbansetu-chat/videos',
        resource_type: 'video',
        mimetype: req.file.mimetype,
      },
      req.file.size
    );

    console.log(`[Upload] Video uploaded to account ${account.cloudName}:`, result.secure_url);
    res.status(200).json({
      message: 'Video uploaded successfully',
      videoUrl: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({ message: 'Error uploading video', error: error.message });
  }
});

// ─── Upload single document ──────────────────────────────────────
router.post('/document', verifyToken, uploadDocumentMemory.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No document file provided' });
    }

    const { result, account } = await uploadToCloudinaryPool(
      req.file.buffer,
      {
        folder: 'urbansetu-chat/documents',
        resource_type: 'raw',
        mimetype: req.file.mimetype,
      },
      req.file.size
    );

    console.log(`[Upload] Document uploaded to account ${account.cloudName}:`, result.secure_url);
    res.status(200).json({
      message: 'Document uploaded successfully',
      documentUrl: result.secure_url,
      publicId: result.public_id,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ message: 'Error uploading document', error: error.message });
  }
});

// ─── Upload single audio ─────────────────────────────────────────
router.post('/audio', verifyToken, uploadAudioMemory.single('audio'), async (req, res) => {
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

    const { result, account } = await uploadToCloudinaryPool(
      req.file.buffer,
      {
        folder: 'urbansetu-chat/audio',
        resource_type: 'video', // Cloudinary uses 'video' resource_type for audio
        mimetype: req.file.mimetype,
      },
      req.file.size
    );

    console.log(`[Upload] Audio uploaded to account ${account.cloudName}:`, result.secure_url);
    res.status(200).json({
      success: true,
      message: 'Audio uploaded successfully',
      audioUrl: result.secure_url,
      publicId: result.public_id,
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

// ─── Proxy external image to bypass CORS ─────────────────────────
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

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (error) {
    console.error('Proxy image error:', error);
    res.status(500).json({ message: 'Error proxying image', error: error.message });
  }
});

// ─── Enhanced error handling middleware ───────────────────────────
router.use((error, req, res, next) => {
  console.error('Upload error:', error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
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

export default router;