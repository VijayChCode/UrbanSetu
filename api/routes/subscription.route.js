import express from 'express';
import {
    subscribeToNewsletter,
    getAllSubscribers,
    getMySubscriptionStatus,
    unsubscribeUser,
    updateSubscriptionStatus,
    sendSubscriptionOtp,
    verifySubscriptionOtp,
    sendUnsubscribeOtp,
    verifyUnsubscribeOtp
} from '../controllers/subscription.controller.js';
import { verifyToken } from '../utils/verify.js';
import { otpRateLimit, otpVerifyRateLimit } from '../middleware/rateLimiter.js';
import { verifyCSRFToken } from '../middleware/csrf.js';
import { otpRecaptchaMiddleware } from '../middleware/otpRecaptcha.js';

const router = express.Router();

// OTP-based Subscription Flow (PRIMARY FLOW - FIXED)
router.post('/send-subscribe-otp', otpRateLimit, verifyCSRFToken, ...otpRecaptchaMiddleware, sendSubscriptionOtp); // Sends OTP email
router.post('/verify-subscribe-otp', otpVerifyRateLimit, verifyCSRFToken, verifySubscriptionOtp); // Verifies OTP and creates subscription

// 1. Send OTP for subscription
router.post('/send-otp', otpRateLimit, verifyCSRFToken, ...otpRecaptchaMiddleware, sendSubscriptionOtp);
// 2. Verify OTP and Subscribe
router.post('/verify-otp', otpVerifyRateLimit, verifyCSRFToken, verifySubscriptionOtp);

// 3. Send OTP for Unsubscribe
router.post('/send-unsubscribe-otp', verifyToken, otpRateLimit, verifyCSRFToken, ...otpRecaptchaMiddleware, sendUnsubscribeOtp);
// 4. Verify OTP and Unsubscribe
router.post('/verify-unsubscribe-otp', verifyToken, otpVerifyRateLimit, verifyCSRFToken, verifyUnsubscribeOtp);

router.post('/subscribe', subscribeToNewsletter); // LEGACY: Direct subscription without OTP (deprecated)
router.get('/all', verifyToken, getAllSubscribers);
router.get('/my-status', verifyToken, getMySubscriptionStatus);
router.post('/unsubscribe', verifyToken, unsubscribeUser); // Keep or deprecate
router.put('/status/:id', verifyToken, updateSubscriptionStatus);

export default router;
