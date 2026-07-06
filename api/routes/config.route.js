import express from 'express';

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
      maintenance: {
        enabled: process.env.MAINTENANCE_MODE === 'true',
        endTime: process.env.MAINTENANCE_END_TIME || null,
        message: process.env.MAINTENANCE_MESSAGE || "We're currently renovating our digital infrastructure to serve you better. Just like a prime property, quality takes time. We'll be back online shortly to help you find your dream space."
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
      },
      email: {
        senderEmail: process.env.EMAIL_USER || 'auth.urbansetu@gmail.com',
        senderName: process.env.EMAIL_SENDER_NAME || 'UrbanSetu',
        isConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
      },
      firebase: {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
      },
      google: {
        webClientId: process.env.GOOGLE_WEB_CLIENT_ID,
        androidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID
      },
      razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID
      },
      paypal: {
        clientId: process.env.PAYPAL_CLIENT_ID
      },
      cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY
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

export default router;

/*
How to Activate Maintenance Mode in the App
To turn on the maintenance screen for all mobile users, follow these steps:

Uncomment the code block: Go to 

api/routes/config.route.js
 and remove the /*(and its counter part) and surrounding the maintenance object.
Toggle the Environment Variable: In your backend environment (Render/Vercel Dashboard or local 

.env
), change the value:
MAINTENANCE_MODE=true
Configure the Timer (Optional): Define when the maintenance ends to display the countdown and "Check Recovery" button:
MAINTENANCE_END_TIME=2026-03-03T23:59:00Z (Use ISO format)
Instant Effect: Once updated, the app's root checker in 

_layout.tsx
 will detect the state on the next launch and immediately redirect users to the maintenance page.
*/