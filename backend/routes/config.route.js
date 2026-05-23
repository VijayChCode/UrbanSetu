const express = require('express');
const router = express.Router();

// Get app configuration
router.get('/', (req, res) => {
  try {
    const config = {
      appName: process.env.APP_NAME || 'UrbanSetu',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      features: {
        chat: process.env.FEATURE_CHAT === 'true',
        notifications: process.env.FEATURE_NOTIFICATIONS === 'true',
        reviews: process.env.FEATURE_REVIEWS === 'true',
        payments: process.env.FEATURE_PAYMENTS === 'true',
        wishlist: process.env.FEATURE_WISHLIST === 'true',
        adminPanel: process.env.FEATURE_ADMIN_PANEL === 'true'
      },
      contact: {
        email: process.env.CONTACT_EMAIL || 'info.urbansetu@gmail.com',
        phone: process.env.CONTACT_PHONE || '+91 9876543210',
        address: process.env.CONTACT_ADDRESS || '123 Main Street, City, State 12345'
      },
      social: {
        facebook: process.env.SOCIAL_FACEBOOK || 'https://facebook.com/urbansetu',
        twitter: process.env.SOCIAL_TWITTER || 'https://twitter.com/urbansetu',
        instagram: process.env.SOCIAL_INSTAGRAM || 'https://instagram.com/urbansetu',
        linkedin: process.env.SOCIAL_LINKEDIN || 'https://linkedin.com/company/urbansetu'
      },
      payment: {
        razorpayKey: process.env.RAZORPAY_KEY_ID,
        currency: process.env.PAYMENT_CURRENCY || 'INR',
        bookingFee: parseFloat(process.env.BOOKING_FEE || '500')
      },
      limits: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB
        maxImagesPerListing: parseInt(process.env.MAX_IMAGES_PER_LISTING || '10'),
        maxListingsPerUser: parseInt(process.env.MAX_LISTINGS_PER_USER || '50')
      },
      api: {
        baseUrl: process.env.API_BASE_URL || 'http://localhost:5000',
        timeout: parseInt(process.env.API_TIMEOUT || '30000')
      }
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error fetching app config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch app configuration'
    });
  }
});

// Get feature flags
router.get('/features', (req, res) => {
  try {
    const features = {
      chat: process.env.FEATURE_CHAT === 'true',
      notifications: process.env.FEATURE_NOTIFICATIONS === 'true',
      reviews: process.env.FEATURE_REVIEWS === 'true',
      payments: process.env.FEATURE_PAYMENTS === 'true',
      wishlist: process.env.FEATURE_WISHLIST === 'true',
      adminPanel: process.env.FEATURE_ADMIN_PANEL === 'true',
      darkMode: process.env.FEATURE_DARK_MODE === 'true',
      offlineMode: process.env.FEATURE_OFFLINE_MODE === 'true'
    };

    res.json({
      success: true,
      data: features
    });
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feature flags'
    });
  }
});

// Get app version info
router.get('/version', (req, res) => {
  try {
    const versionInfo = {
      version: process.env.APP_VERSION || '1.0.0',
      buildNumber: process.env.BUILD_NUMBER || '1',
      environment: process.env.NODE_ENV || 'development',
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: versionInfo
    });
  } catch (error) {
    console.error('Error fetching version info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch version info'
    });
  }
});

module.exports = router;
