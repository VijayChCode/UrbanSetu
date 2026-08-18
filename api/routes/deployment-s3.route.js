import express from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client, ListBucketsCommand, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { verifyToken } from '../utils/verify.js';
import Deployment from '../models/deployment.model.js';
import cloudinary from 'cloudinary';
import TrustDocument from '../models/trustDocument.model.js';
import { getCloudinaryInstance } from '../utils/cloudinaryPool.js';

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

// Sync/Repair deployments: Check S3 for actual sizes of 0-byte records and ensure all S3 files are in DB
router.get('/sync', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    console.log('Starting deployment sync/repair...');
    const deployments = await Deployment.find();
    let repairedCount = 0;

    for (const d of deployments) {
      if (d.size === 0 || !d.size) {
        try {
          // Get actual size from S3
          const command = new HeadObjectCommand({ Bucket: bucketName, Key: d.fileKey });
          const headResult = await s3Client.send(command);
          if (headResult.ContentLength) {
            d.size = headResult.ContentLength;
            await d.save();
            repairedCount++;
            console.log(`Repaired size for ${d.fileKey}: ${d.size} bytes`);
          }
        } catch (s3Err) {
          console.error(`Failed to repair size for ${d.fileKey}:`, s3Err.message);
        }
      }
    }

    // Also look for files in S3 that might be missing from DB
    // (This helps with the "previous 2 apps not shown" if they are in S3)
    let discoveredCount = 0;
    try {
      const listCommand = new ListObjectsV2Command({ Bucket: bucketName, Prefix: 'mobile-apps/' });
      const listResult = await s3Client.send(listCommand);

      if (listResult.Contents) {
        for (const s3File of listResult.Contents) {
          const exists = deployments.find(d => d.fileKey === s3File.Key);
          if (!exists && s3File.Size > 0) {
            // Found a file in S3 that's not in our DB!
            const fileName = s3File.Key.split('/').pop();
            const format = fileName.split('.').pop().toLowerCase();

            const newD = new Deployment({
              fileKey: s3File.Key,
              url: `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3File.Key}`,
              platform: getPlatformFromFormat(format),
              version: extractVersionFromFilename(fileName),
              description: 'Automatically discovered from S3 storage',
              size: s3File.Size,
              format: format,
              isActive: false,
              uploadedBy: req.user.id
            });
            try {
              await newD.save();
              discoveredCount++;
              console.log(`Discovered missing deployment from S3: ${s3File.Key}`);
            } catch (saveErr) {
              if (saveErr.code === 11000) {
                console.log(`Skipping duplicate deployment for ${newD.platform} v${newD.version}`);
              } else {
                throw saveErr;
              }
            }
          }
        }
      }
    } catch (listErr) {
      console.error('Failed to scan S3 for missing files:', listErr.message);
    }

    res.json({
      success: true,
      message: `Sync complete. Repaired ${repairedCount} records, Discovered ${discoveredCount} missing files.`,
      repairedCount,
      discoveredCount
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ success: false, message: 'Sync failed: ' + error.message });
  }
});

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

// Configure multer with memory storage for deployments to avoid stream abort issues on Render
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit
    fieldSize: 200 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.android.package-archive',
      'application/octet-stream',
      'application/x-msdownload',
      'application/x-msi',
      'application/x-apple-diskimage',
      'application/x-newton-compatible-pkg',
    ];

    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(apk|ipa|exe|msi|dmg|pkg)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only APK, IPA, EXE, MSI, DMG, and PKG files are allowed.'), false);
    }
  },
});



// Upload new deployment file to S3 and DB
router.post('/upload', verifyToken, upload.single('file'), handleMulterError, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { platform, version, description, isActive } = req.body;
    const file = req.file;

    // 1. Check for duplicates and cleanup
    const existing = await Deployment.findOne({ platform, version });
    if (existing) {
      console.log(`Clearing existing deployment for ${platform} v${version}`);
      await Deployment.deleteOne({ _id: existing._id });
    }

    // 2. Prepare S3 Key
    const safePlatform = platform || 'android';
    const safeVersion = version || 'v1.0.0';
    const timestamp = Date.now();
    const ext = file.originalname.split('.').pop();
    const fileKey = `mobile-apps/latest-${safePlatform}-${safeVersion}-${timestamp}.${ext}`;

    // 3. Upload to S3 manually from buffer
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    console.log(`Uploading ${file.originalname} (${file.size} bytes) to S3...`);
    await s3Client.send(uploadCommand);

    const fileUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fileKey}`;

    // 4. Update others if active
    const isTrueActive = isActive === 'true' || isActive === true;
    if (isTrueActive) {
      await Deployment.updateMany({ platform }, { isActive: false });
    }

    // 5. Save to DB
    const newDeployment = new Deployment({
      fileKey: fileKey,
      url: fileUrl,
      platform: safePlatform,
      version: safeVersion,
      description: description || '',
      isActive: isTrueActive,
      uploadedBy: req.user.id,
      size: file.size,
      format: ext.toLowerCase(),
    });

    await newDeployment.save();

    // Trigger notifications in background
    (async () => {
      try {
        const User = (await import('../models/user.model.js')).default;
        const Notification = (await import('../models/notification.model.js')).default;
        const { sendUpdateAnnouncementEmail } = await import('../utils/emailService.js');

        // Find all active, non-suspended users
        const users = await User.find({ status: 'active', isSubscribed: true }, 'email _id settings');

        const notificationTitle = `New App Update: v${safeVersion} for ${safePlatform.charAt(0).toUpperCase() + safePlatform.slice(1)}`;
        const notificationMessage = description || `A new version of UrbanSetu is available for ${safePlatform}. Update now to experience new features!`;

        // Create in-app notifications in bulk
        const notifications = users.map(user => ({
          userId: user._id,
          type: 'platform_update',
          title: notificationTitle,
          message: notificationMessage,
          meta: { version: safeVersion, platform: safePlatform, deploymentId: newDeployment._id }
        }));
        await Notification.insertMany(notifications);

        // Send emails
        users.forEach(user => {
          if (user.email) {
            sendUpdateAnnouncementEmail(user.email, {
              title: notificationTitle,
              version: safeVersion,
              category: safePlatform,
              description: notificationMessage,
              actionUrl: fileUrl,
              isAppLaunch: true
            }).catch(e => console.error(`Failed to send update email to ${user.email}:`, e));
          }
        });

        console.log(`✅ Notifications triggered for ${users.length} users for deployment v${safeVersion}`);
      } catch (notifErr) {
        console.error('Failed to trigger deployment notifications:', notifErr);
      }
    })();

    res.json({
      success: true,
      message: 'File uploaded and deployed successfully',
      data: newDeployment
    });
  } catch (error) {
    console.error('Upload failed:', error);
    res.status(500).json({
      success: false,
      message: 'Upload failed: ' + (error.message || 'Unknown error')
    });
  }
});

// Set active/inactive deployment in DB
router.put('/set-active/:id', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Access denied. Root admin only.' });
    }

    const { id } = req.params;
    const { isActive } = req.body; // Allow explicit deactivation

    const targetDeployment = await Deployment.findById(id);

    if (!targetDeployment) {
      return res.status(404).json({ success: false, message: 'Deployment not found' });
    }

    if (isActive === false) {
      // Deactivate this specific one
      targetDeployment.isActive = false;
      await targetDeployment.save();
      return res.json({
        success: true,
        message: `Deployment for ${targetDeployment.platform} deactivated`
      });
    }

    // Otherwise, activate this one and deactivate others for this platform
    await Deployment.updateMany({ platform: targetDeployment.platform }, { isActive: false });

    // Activate this one
    targetDeployment.isActive = true;
    await targetDeployment.save();

    // Trigger notifications if promoting to active
    if (isActive !== false) {
      (async () => {
        try {
          const User = (await import('../models/user.model.js')).default;
          const Notification = (await import('../models/notification.model.js')).default;
          const { sendUpdateAnnouncementEmail } = await import('../utils/emailService.js');
          const { sendPushNotification } = await import('../utils/pushNotification.js');

          const users = await User.find({ status: 'active', isSubscribed: true }, 'email _id settings');

          const notificationTitle = `New Version Live: ${targetDeployment.platform.charAt(0).toUpperCase() + targetDeployment.platform.slice(1)} v${targetDeployment.version}`;
          const notificationMessage = targetDeployment.description || `The latest version of UrbanSetu (${targetDeployment.platform}) is now live. Download it now!`;

          const notifications = users.map(user => ({
            userId: user._id,
            type: 'platform_update',
            title: notificationTitle,
            message: notificationMessage,
            meta: { version: targetDeployment.version, platform: targetDeployment.platform, deploymentId: targetDeployment._id }
          }));
          await Notification.insertMany(notifications);

          users.forEach(user => {
            if (user.email) {
              sendUpdateAnnouncementEmail(user.email, {
                title: notificationTitle,
                version: targetDeployment.version,
                category: targetDeployment.platform,
                description: notificationMessage,
                actionUrl: targetDeployment.url,
                isAppLaunch: true
              }).catch(e => console.error(`Failed to send update email to ${user.email}:`, e));
            }

            // Send native push notification
            sendPushNotification(user._id, notificationTitle, notificationMessage, {
              category: 'platform_update',
              data: { version: targetDeployment.version, platform: targetDeployment.platform }
            }).catch(e => console.error(`Failed to send push to ${user._id}:`, e));
          });
        } catch (notifErr) {
          console.error('Failed to trigger activation notifications:', notifErr);
        }
      })();
    }

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

// Update deployment metadata (version, description)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Access denied. Root admin only.' });
    }

    const { id } = req.params;
    const { version, description, isActive } = req.body;

    const deployment = await Deployment.findById(id);
    if (!deployment) {
      return res.status(404).json({ success: false, message: 'Deployment not found' });
    }

    if (version) deployment.version = version;
    if (description !== undefined) deployment.description = description;

    // If setting as active via edit, handle others
    if (isActive === true && !deployment.isActive) {
      await Deployment.updateMany({ platform: deployment.platform }, { isActive: false });
      deployment.isActive = true;
    } else if (isActive === false) {
      deployment.isActive = false;
    }

    await deployment.save();

    res.json({
      success: true,
      message: 'Deployment updated successfully',
      data: deployment
    });
  } catch (error) {
    console.error('Error updating deployment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update deployment'
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

// Cloudinary is now configured dynamically via CloudinaryPool
// (no static cloudinary.v2.config() needed here)

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
        const s3DelPool = await getCloudinaryInstance();
        if (s3DelPool) {
          await s3DelPool.instance.uploader.destroy(doc.fileKey, { resource_type: 'raw' });
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
