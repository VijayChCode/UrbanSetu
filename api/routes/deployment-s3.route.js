import express from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client, ListBucketsCommand, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { verifyToken } from '../utils/verify.js';
import Deployment from '../models/deployment.model.js';

const router = express.Router();

// Configure AWS S3 Client v3
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

// Check if AWS S3 is properly configured
const bucketName = process.env.AWS_S3_BUCKET_NAME;
if (!bucketName) {
  console.error('❌ AWS_S3_BUCKET_NAME environment variable is not set');
  console.error('Please configure AWS S3 environment variables in Render dashboard');
}

// Configure multer for S3 storage
const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: bucketName || 'placeholder-bucket',
    // Note: Do not set ACL when the bucket enforces bucket-owner ownership (ACLs disabled)
    key: function (req, file, cb) {
      const incomingPlatform = req && req.body ? req.body.platform : undefined;
      const incomingVersion = req && req.body ? req.body.version : undefined;
      const safePlatform = (typeof incomingPlatform === 'string' && incomingPlatform.trim()) ? incomingPlatform.trim() : 'android';
      const safeVersion = (typeof incomingVersion === 'string' && incomingVersion.trim()) ? incomingVersion.trim() : 'v1.0.0';
      const timestamp = Date.now();
      const baseName = `${safePlatform}-${safeVersion}-${timestamp}`;
      const fileName = `mobile-apps/latest-${baseName}.${file.originalname.split('.').pop()}`;
      cb(null, fileName);
    },
    metadata: function (req, file, cb) {
      cb(null, {
        fieldName: file.fieldname,
        originalName: file.originalname,
        platform: req.body.platform,
        version: req.body.version,
        description: req.body.description
      });
    }
  }),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit
    fieldSize: 200 * 1024 * 1024, // 200MB for form fields
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

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
  console.log('Multer error:', error);
  if (error instanceof multer.MulterError) {
    console.log('Multer error code:', error.code);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'File too large. Maximum size is 200MB.'
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

// Test S3 connection
router.get('/test-s3', async (req, res) => {
  try {
    if (!bucketName) {
      return res.status(500).json({
        success: false,
        message: 'AWS S3 not configured. Please set AWS_S3_BUCKET_NAME environment variable.'
      });
    }

    console.log('Testing S3 connection...');
    const command = new ListBucketsCommand({});
    const result = await s3Client.send(command);
    res.json({
      success: true,
      message: 'S3 connection successful',
      buckets: result.Buckets.map(bucket => bucket.Name)
    });
  } catch (error) {
    console.error('S3 test error:', error);
    res.status(500).json({
      success: false,
      message: 'S3 connection failed: ' + error.message
    });
  }
});

// Get all deployment files from DB
router.get('/', verifyToken, async (req, res) => {
  try {
    // Root admin only
    if (!req.user || req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Access denied. Root admin only.' });
    }

    const deployments = await Deployment.find().sort({ createdAt: -1 });

    // Map DB objects to match expected frontend structure
    const files = deployments.map(d => ({
      id: d._id,
      key: d.fileKey,
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

// Get active deployment files from DB
router.get('/active', async (req, res) => {
  try {
    const activeDeployments = await Deployment.find({ isActive: true }).sort({ createdAt: -1 });

    const data = activeDeployments.map(d => ({
      id: d._id,
      key: d.fileKey,
      name: d.fileKey.split('/').pop(),
      url: d.url,
      size: d.size,
      format: d.format,
      platform: d.platform,
      version: d.version,
      description: d.description,
      createdAt: d.createdAt,
      isActive: true
    }));

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching active deployment files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active deployment files'
    });
  }
});

// Get all public deployment files from DB
router.get('/public', async (req, res) => {
  try {
    const deployments = await Deployment.find().sort({ createdAt: -1 }).limit(100);

    const data = deployments.map(d => ({
      id: d._id,
      key: d.fileKey,
      name: d.fileKey.split('/').pop(),
      url: d.url,
      size: d.size,
      format: d.format,
      platform: d.platform,
      version: d.version,
      description: d.description,
      createdAt: d.createdAt,
      isActive: d.isActive
    }));

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching public deployment files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch public deployment files'
    });
  }
});

// Public: Get presigned download URL for a deployment (no auth)
router.get('/public-download-url', async (req, res) => {
  try {
    if (!bucketName) {
      return res.status(500).json({ success: false, message: 'AWS S3 not configured' });
    }
    const { id } = req.query;
    if (!id) return res.status(400).json({ success: false, message: 'Missing id' });

    // Find deployment by ID (MongoDB ID) or Key
    let deployment = await Deployment.findById(id);
    if (!deployment) {
      // Fallback search by Key if id is not a valid ObjectId or not found
      deployment = await Deployment.findOne({ fileKey: decodeURIComponent(id) });
    }

    if (!deployment) {
      return res.status(404).json({ success: false, message: 'Deployment not found' });
    }

    const command = new GetObjectCommand({ Bucket: bucketName, Key: deployment.fileKey });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes
    return res.json({ success: true, url });
  } catch (error) {
    console.error('Error generating public download URL:', error);
    res.status(500).json({ success: false, message: 'Failed to generate download URL' });
  }
});

// Get presigned download URL for a deployment (rootadmin only)
router.get('/download-url', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Access denied. Root admin only.' });
    }
    const { id } = req.query;
    if (!id) return res.status(400).json({ success: false, message: 'Missing id' });

    let deployment = await Deployment.findById(id);
    if (!deployment) {
      deployment = await Deployment.findOne({ fileKey: decodeURIComponent(id) });
    }

    if (!deployment) {
      return res.status(404).json({ success: false, message: 'Deployment not found' });
    }

    const command = new GetObjectCommand({ Bucket: bucketName, Key: deployment.fileKey });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    return res.json({ success: true, url });
  } catch (error) {
    console.error('Error generating download URL:', error);
    res.status(500).json({ success: false, message: 'Failed to generate download URL' });
  }
});

// Upload new deployment file to S3 and DB
router.post('/upload', verifyToken, upload.single('file'), handleMulterError, async (req, res) => {
  try {
    // Root admin only
    if (!req.user || req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Access denied. Root admin only.' });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded or file upload failed.'
      });
    }

    const { platform, version, description, isActive } = req.body;
    const file = req.file;

    const isTrueActive = isActive === 'true';

    // If setting as active, deactivate others for the same platform
    if (isTrueActive) {
      await Deployment.updateMany({ platform }, { isActive: false });
    }

    // Store deployment info in database
    const newDeployment = new Deployment({
      fileKey: file.key,
      url: file.location,
      platform: platform || getPlatformFromFormat(file.originalname.split('.').pop()),
      version: version || extractVersionFromFilename(file.originalname),
      description: description || '',
      isActive: isTrueActive,
      uploadedBy: req.user.id,
      size: file.size,
      format: (file.originalname.split('.').pop() || '').toLowerCase(),
    });

    await newDeployment.save();

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: newDeployment
    });
  } catch (error) {
    console.error('Error uploading deployment file:', error);
    res.status(500).json({
      success: false,
      message: 'Upload failed: ' + (error.message || 'Unknown error')
    });
  }
});

// Set active deployment in DB
router.put('/set-active/:id', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Access denied. Root admin only.' });
    }

    const { id } = req.params;
    const targetDeployment = await Deployment.findById(id);

    if (!targetDeployment) {
      return res.status(404).json({ success: false, message: 'Deployment not found' });
    }

    // Deactivate all others for this platform
    await Deployment.updateMany({ platform: targetDeployment.platform }, { isActive: false });

    // Activate this one
    targetDeployment.isActive = true;
    await targetDeployment.save();

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

// Delete deployment file from S3 and DB
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Access denied. Root admin only.' });
    }

    const { id } = req.params;
    const deployment = await Deployment.findById(id);

    if (!deployment) {
      return res.status(404).json({ success: false, message: 'Deployment not found' });
    }

    // Delete from S3
    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: deployment.fileKey
    });
    await s3Client.send(deleteCommand);

    // Delete from DB
    await Deployment.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting file:', error);
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
