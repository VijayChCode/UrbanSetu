import express from 'express';
import multer from 'multer';
import cloudinary from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { verifyToken } from '../utils/verify.js';
import Deployment from '../models/deployment.model.js';
import { sendBroadcastPushNotification } from '../utils/pushNotification.js';

const router = express.Router();

// Test Cloudinary connection
router.get('/test-cloudinary', async (req, res) => {
  try {
    console.log('Testing Cloudinary connection...');
    const result = await cloudinary.v2.api.ping();
    res.json({
      success: true,
      message: 'Cloudinary connection successful',
      result: result
    });
  } catch (error) {
    console.error('Cloudinary test error:', error);
    res.status(500).json({
      success: false,
      message: 'Cloudinary connection failed: ' + error.message
    });
  }
});

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
  console.log('Multer error:', error);
  if (error instanceof multer.MulterError) {
    console.log('Multer error code:', error.code);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'File too large for Cloudinary free plan. Maximum size is 10MB. Please compress your APK file or upgrade to Cloudinary Pro plan.'
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
  }
  next(error);
};

// Configure Cloudinary
console.log('Cloudinary Config:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Not Set',
  api_secret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Not Set'
});

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer with memory storage for better control
const upload = multer({
  storage: multer.memoryStorage(), // Use memory storage instead of CloudinaryStorage
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (Cloudinary's limit)
    fieldSize: 10 * 1024 * 1024, // 10MB for form fields
    files: 1, // Only one file
  },
  fileFilter: (req, file, cb) => {
    console.log('File being processed:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    // Allow specific file types
    const allowedTypes = [
      'application/vnd.android.package-archive', // APK
      'application/octet-stream', // iOS/IPA
      'application/x-msdownload', // EXE
      'application/x-msi', // MSI
      'application/x-apple-diskimage', // DMG
      'application/x-newton-compatible-pkg', // PKG
    ];

    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(apk|ipa|exe|msi|dmg|pkg)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only APK, IPA, EXE, MSI, DMG, and PKG files are allowed.'), false);
    }
  },
});

// Get all deployment files from DB
router.get('/', verifyToken, async (req, res) => {
  try {
    // Root admin only
    if (!req.user || req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Access denied. Root admin only.' });
    }

    const deployments = await Deployment.find().sort({ createdAt: -1 });

    const files = deployments.map(d => ({
      id: d._id,
      name: d.fileKey.split('/').pop(),
      url: d.url,
      size: d.size,
      format: d.format,
      platform: d.platform,
      version: d.version,
      description: d.description,
      createdAt: d.createdAt,
      isActive: d.isActive,
    }));

    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    console.error('Error fetching deployment files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deployment files'
    });
  }
});

// Get active deployment files (latest versions) from DB
router.get('/active', async (req, res) => {
  try {
    const activeDeployments = await Deployment.find({ isActive: true }).sort({ createdAt: -1 });

    const activeFiles = activeDeployments.map(d => ({
      id: d._id,
      name: d.fileKey.split('/').pop(),
      url: d.url,
      size: d.size,
      format: d.format,
      platform: d.platform,
      version: d.version,
      description: d.description,
      createdAt: d.createdAt,
    }));

    res.json({
      success: true,
      data: activeFiles
    });
  } catch (error) {
    console.error('Error fetching active deployment files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active deployment files'
    });
  }
});

// Get all public deployment files (Version History) from DB
router.get('/public', async (req, res) => {
  try {
    const deployments = await Deployment.find().sort({ createdAt: -1 }).limit(50);

    const files = deployments.map(d => ({
      id: d._id,
      name: d.fileKey.split('/').pop(),
      url: d.url,
      size: d.size,
      format: d.format,
      platform: d.platform,
      version: d.version,
      description: d.description,
      createdAt: d.createdAt,
      isActive: d.isActive,
    }));

    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    console.error('Error fetching public deployment files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch public deployment files'
    });
  }
});

// Upload new deployment file
router.post('/upload', verifyToken, upload.single('file'), handleMulterError, async (req, res) => {
  try {
    console.log('Upload request received:', {
      hasFile: !!req.file,
      fileSize: req.file?.size,
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length']
    });

    // Root admin only
    if (!req.user || req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Access denied. Root admin only.' });
    }

    // Check for multer errors (file size, file type, etc.)
    if (!req.file) {
      console.log('No file received in request');
      return res.status(400).json({
        success: false,
        message: 'No file uploaded or file upload failed. Please check file size (max 500MB) and file type.'
      });
    }

    const { platform, version, description, isActive } = req.body;
    const file = req.file;

    // Create a new public_id with platform and version info
    const timestamp = Date.now();
    const baseName = `${platform}-${version || 'v1.0.0'}-${timestamp}`;
    const publicId = `mobile-apps/latest-${baseName}`;

    // Upload to Cloudinary with specific public_id using buffer
    console.log('Uploading to Cloudinary:', {
      publicId: publicId,
      fileSize: file.size,
      fileType: file.mimetype,
      bufferSize: file.buffer ? file.buffer.length : 'No buffer'
    });

    // Check file size before attempting upload
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      console.log('File too large for Cloudinary free plan:', file.size);

      // For now, we'll reject files larger than 10MB
      // In the future, we can implement alternative hosting
      return res.status(413).json({
        success: false,
        message: 'File too large for Cloudinary free plan. Maximum size is 10MB. Please either: 1) Compress your APK file to under 10MB, 2) Upgrade to Cloudinary Pro plan ($89/month), or 3) Contact support for alternative hosting solutions.'
      });
    }

    let uploadResult;
    try {
      // Use regular upload for files under 10MB
      uploadResult = await cloudinary.v2.uploader.upload(
        `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
        {
          public_id: publicId,
          resource_type: 'raw',
          folder: 'mobile-apps',
          overwrite: true,
        }
      );
      console.log('Cloudinary upload successful:', uploadResult.public_id);
    } catch (cloudinaryError) {
      console.error('Cloudinary upload error:', cloudinaryError);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload to Cloudinary: ' + cloudinaryError.message
      });
    }

    // Store deployment info in database
    const isTrueActive = isActive === 'true' || isActive === true;

    if (isTrueActive) {
      await Deployment.updateMany({ platform }, { isActive: false });
    }

    const newDeployment = new Deployment({
      platform: platform || getPlatformFromFormat(uploadResult.format),
      version: version || extractVersionFromFilename(file.originalname),
      description: description || '',
      url: uploadResult.secure_url,
      fileKey: uploadResult.public_id,
      size: uploadResult.bytes,
      format: uploadResult.format,
      isActive: isTrueActive,
      uploadedBy: req.user.id
    });

    await newDeployment.save();

    // ── Real-time push to all users when new active build is released ──────
    if (isTrueActive) {
      const isForce = (description || '').toLowerCase().includes('[force]');
      const cleanDesc = (description || '').replace(/\[force\]/gi, '').trim();
      const pushBody = cleanDesc
        ? `${cleanDesc.substring(0, 100)}${cleanDesc.length > 100 ? '…' : ''}`
        : 'Open the app to see what\'s new.';

      // Fire-and-forget — don\'t await, never block the admin response
      sendBroadcastPushNotification(
        `🚀 UrbanSetu ${version} is Available`,
        pushBody,
        {
          category: 'platform_update',
          data: {
            type: 'app_update',
            version: version || '1.0.0',
            isForce: String(isForce),
            downloadUrl: `${process.env.WEB_URL || 'https://urbansetu.vercel.app'}/download`,
          },
        }
      ).catch(e => console.error('Broadcast push failed silently:', e.message));
    }
    // ─────────────────────────────────────────────────────────────────────

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: newDeployment
    });
  } catch (error) {
    console.error('Error uploading deployment file:', error);

    // Handle specific multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'File too large. Maximum size is 500MB.'
      });
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field. Please use the correct form field name.'
      });
    }

    if (error.message && error.message.includes('Invalid file type')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Upload failed: ' + (error.message || 'Unknown error')
    });
  }
});

// Set active deployment in DB
router.put('/set-active/:id', verifyToken, async (req, res) => {
  try {
    // Root admin only
    if (!req.user || req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Access denied. Root admin only.' });
    }
    const { id } = req.params;

    const targetDeployment = await Deployment.findById(id);
    if (!targetDeployment) {
      return res.status(404).json({ success: false, message: 'Deployment not found' });
    }

    // Deactivate others for same platform
    await Deployment.updateMany({ platform: targetDeployment.platform }, { isActive: false });

    // Activate this one
    targetDeployment.isActive = true;
    await targetDeployment.save();

    // ── Real-time push to all users when an existing build is activated ────
    const isForce = (targetDeployment.description || '').toLowerCase().includes('[force]');
    const cleanDesc = (targetDeployment.description || '').replace(/\[force\]/gi, '').trim();
    const pushBody = cleanDesc
      ? `${cleanDesc.substring(0, 100)}${cleanDesc.length > 100 ? '…' : ''}`
      : 'Open the app to see what\'s new.';

    sendBroadcastPushNotification(
      `🚀 UrbanSetu ${targetDeployment.version} is Available`,
      pushBody,
      {
        category: 'platform_update',
        data: {
          type: 'app_update',
          version: targetDeployment.version || '1.0.0',
          isForce: String(isForce),
          downloadUrl: `${process.env.WEB_URL || 'https://urbansetu.vercel.app'}/download`,
        },
      }
    ).catch(e => console.error('Broadcast push (set-active) failed silently:', e.message));
    // ─────────────────────────────────────────────────────────────────────

    res.json({
      success: true,
      message: `Active deployment for ${targetDeployment.platform} updated successfully`
    });
  } catch (error) {
    console.error('Error setting active deployment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set active deployment'
    });
  }
});

// Delete deployment file from Cloudinary and DB
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    // Root admin only
    if (!req.user || req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Access denied. Root admin only.' });
    }
    const { id } = req.params;

    const deployment = await Deployment.findById(id);
    if (!deployment) {
      return res.status(404).json({ success: false, message: 'Deployment not found' });
    }

    // Delete from Cloudinary
    await cloudinary.v2.uploader.destroy(deployment.fileKey, { resource_type: 'raw' });

    // Delete from DB
    await Deployment.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting deployment file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
});

// Helper functions
function getPlatformFromFormat(format) {
  const platformMap = {
    'apk': 'android',
    'ipa': 'ios',
    'exe': 'windows',
    'msi': 'windows',
    'dmg': 'macos',
    'pkg': 'macos',
  };
  return platformMap[format] || 'unknown';
}

function extractVersionFromFilename(filename) {
  const versionMatch = filename.match(/v?(\d+\.\d+\.\d+)/);
  return versionMatch ? versionMatch[1] : '1.0.0';
}

export default router;
