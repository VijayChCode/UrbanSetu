import express from 'express';
import multer from 'multer';
import cloudinary from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { verifyToken } from '../utils/verify.js';
import Deployment from '../models/deployment.model.js';
import TrustDocument from '../models/trustDocument.model.js';
import { sendBroadcastPushNotification } from '../utils/pushNotification.js';
import {
  getCloudinaryInstance,
  getCloudinaryInstanceByCloudName,
  extractCloudNameFromUrl,
  recordUpload,
  recordFailure,
} from '../utils/cloudinaryPool.js';

const router = express.Router();

// Test Cloudinary connection
router.get('/test-cloudinary', async (req, res) => {
  try {
    console.log('Testing Cloudinary connection...');
    const pool = await getCloudinaryInstance();
    if (!pool) {
      return res.status(500).json({ success: false, message: 'No Cloudinary accounts available in pool' });
    }
    const result = await pool.instance.api.ping();
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

// Cloudinary is now configured dynamically via CloudinaryPool
// (no static cloudinary.v2.config() needed here)

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
      // Use pool-based upload with automatic account rotation
      const pool = await getCloudinaryInstance();
      if (!pool) {
        return res.status(500).json({ success: false, message: 'No Cloudinary accounts available in pool' });
      }
      uploadResult = await pool.instance.uploader.upload(
        `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
        {
          public_id: publicId,
          resource_type: 'raw',
          folder: 'mobile-apps',
          overwrite: true,
        }
      );
      await recordUpload(pool.account.accountIndex, file.size);
      console.log(`[CloudinaryPool] Deployment upload successful on account ${pool.account.cloudName}:`, uploadResult.public_id);
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

    // Delete from Cloudinary using the correct pool account
    const delPool = await getCloudinaryInstance();
    if (delPool) {
      await delPool.instance.uploader.destroy(deployment.fileKey, { resource_type: 'raw' });
    }

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

// --- Trust Documents Endpoints ---

// Get all trust documents (Public)
router.get('/trust-docs', async (req, res) => {
  try {
    const docs = await TrustDocument.find();
    res.json({
      success: true,
      data: docs
    });
  } catch (error) {
    console.error('Error fetching trust documents:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trust documents' });
  }
});

// Create or update a trust document (Admin only)
router.post('/trust-docs', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Access denied. Root admin only.' });
    }
    const { category, title, url, fileKey } = req.body;
    if (!category || !title || !url) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const doc = await TrustDocument.findOneAndUpdate(
      { category },
      { title, url, fileKey, uploadedBy: req.user.id },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      data: doc
    });
  } catch (error) {
    console.error('Error saving trust document:', error);
    res.status(500).json({ success: false, message: 'Failed to save trust document' });
  }
});

// Delete a trust document (Admin only)
router.delete('/trust-docs/:id', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Access denied. Root admin only.' });
    }
    const { id } = req.params;
    const doc = await TrustDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Trust document not found' });
    }

    if (doc.fileKey) {
      try {
        const trustDelPool = await getCloudinaryInstance();
        if (trustDelPool) {
          await trustDelPool.instance.uploader.destroy(doc.fileKey, { resource_type: 'raw' });
        }
      } catch (err) {
        console.warn('Failed to delete raw document from Cloudinary:', err.message);
      }
    }

    await TrustDocument.findByIdAndDelete(id);
    res.json({
      success: true,
      message: 'Trust document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting trust document:', error);
    res.status(500).json({ success: false, message: 'Failed to delete trust document' });
  }
});

export default router;
