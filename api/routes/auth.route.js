import express from 'express'
import { SignUp, SignIn, Google, Signout, verifyAuth, forgotPassword, resetPassword, sendLoginOTP, verifyLoginOTP, lockAccountByToken, unlockAccountByToken, RefreshToken, setCookieTest, checkCookieTest } from '../controllers/auth.controller.js'
import { validateRecaptcha } from '../middleware/recaptcha.js';
import OtpTracking from '../models/otpTracking.model.js';
import bcryptjs from 'bcryptjs';
import User from '../models/user.model.js';
import { verifyToken, optionalAuth } from '../utils/verify.js';
import { sendOTP, verifyOTP, sendForgotPasswordOTP, sendProfileEmailOTP, sendAccountDeletionOTP, sendTransferRightsOTP, sendContractConfirmationOTP } from '../controllers/emailVerification.controller.js';
import { signInRateLimit, signUpRateLimit, forgotPasswordRateLimit, otpRateLimit, otpVerifyRateLimit } from '../middleware/rateLimiter.js';
import { generateCSRFToken, verifyCSRFToken, getCSRFToken } from '../middleware/csrf.js';
import { bruteForceProtection, getFailedAttempts } from '../middleware/security.js';
import PasswordLockout from '../models/passwordLockout.model.js';
import { conditionalRecaptcha, captchaRateLimit } from '../middleware/recaptcha.js';
import { otpRecaptchaMiddleware } from '../middleware/otpRecaptcha.js';
const router = express.Router()

// CSRF token endpoint
router.get("/csrf-token", getCSRFToken)

router.post("/signup", signUpRateLimit, validateRecaptcha({ required: true }), SignUp)
router.post("/signin", signInRateLimit, bruteForceProtection, conditionalRecaptcha((req) => {
  const identifier = req.ip || req.connection.remoteAddress;
  return getFailedAttempts(identifier) >= 3;
}), SignIn)
router.post("/google", signInRateLimit, bruteForceProtection, conditionalRecaptcha((req) => {
  const identifier = req.ip || req.connection.remoteAddress;
  return getFailedAttempts(identifier) >= 3;
}), Google)
router.post("/refresh", RefreshToken)
router.get("/signout", optionalAuth, Signout)
router.get("/verify", verifyAuth)
router.post("/forgot-password", forgotPasswordRateLimit, validateRecaptcha({ required: true }), forgotPassword)
router.post("/reset-password", resetPassword)

// Email verification routes
router.post("/send-otp", otpRateLimit, ...otpRecaptchaMiddleware, sendOTP)
router.post("/verify-otp", otpVerifyRateLimit, verifyOTP)
router.post("/send-forgot-password-otp", otpRateLimit, ...otpRecaptchaMiddleware, sendForgotPasswordOTP)
router.post("/send-profile-email-otp", otpRateLimit, ...otpRecaptchaMiddleware, sendProfileEmailOTP)
// Account deletion OTP (must be authenticated)
router.post("/send-account-deletion-otp", verifyToken, otpRateLimit, verifyCSRFToken, ...otpRecaptchaMiddleware, sendAccountDeletionOTP)
// Transfer rights OTP (root admin only)
router.post("/send-transfer-rights-otp", verifyToken, otpRateLimit, verifyCSRFToken, ...otpRecaptchaMiddleware, sendTransferRightsOTP)
// Contract confirmation OTP (must be authenticated)
router.post("/send-contract-confirmation-otp", verifyToken, otpRateLimit, verifyCSRFToken, ...otpRecaptchaMiddleware, sendContractConfirmationOTP)

// OTP Login routes
router.post("/send-login-otp", otpRateLimit, ...otpRecaptchaMiddleware, sendLoginOTP)
router.post("/verify-login-otp", otpVerifyRateLimit, verifyLoginOTP)

// Admin unlock endpoints
router.post('/otp/unlock-email', verifyToken, async (req, res) => {
  try {
    const { email } = req.body;
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'rootadmin')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    const tracking = await OtpTracking.findOne({ email: email.toLowerCase() }).sort({ createdAt: -1 });
    if (!tracking) return res.status(404).json({ success: false, message: 'No OTP tracking found' });
    tracking.failedOtpAttempts = 0;
    tracking.otpRequestCount = 0;
    tracking.requiresCaptcha = false;
    tracking.lockoutUntil = null;
    tracking.requireExtraVerification = false;
    await tracking.save();
    res.json({ success: true, message: 'OTP lockout cleared for email' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/otp/unlock-ip', verifyToken, async (req, res) => {
  try {
    const { ip } = req.body;
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'rootadmin')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (!ip) return res.status(400).json({ success: false, message: 'IP is required' });
    await OtpTracking.updateMany({ ipAddress: ip }, { $set: { failedOtpAttempts: 0, otpRequestCount: 0, requiresCaptcha: false, lockoutUntil: null, requireExtraVerification: false } });
    res.json({ success: true, message: 'OTP lockout cleared for IP' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/otp/stats', verifyToken, async (req, res) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'rootadmin')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const recent = await OtpTracking.find({}).sort({ updatedAt: -1 }).limit(200);
    const lockoutsActive = await OtpTracking.countDocuments({ lockoutUntil: { $gt: new Date() } });
    // Password lockouts (DB-backed)
    const passwordLockouts = await PasswordLockout.countDocuments({ unlockAt: { $gt: new Date() } });
    res.json({ success: true, recent, activeLockouts: lockoutsActive, passwordLockouts });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: list password lockouts
router.get('/password-lockouts', verifyToken, async (req, res) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'rootadmin')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const items = await PasswordLockout.find({ unlockAt: { $gt: new Date() } }).sort({ unlockAt: -1 }).limit(200);
    res.json({ success: true, items });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: unlock password lockout by email
router.post('/password-lockouts/unlock', verifyToken, async (req, res) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'rootadmin')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { email, userId } = req.body;
    if (!email && !userId) return res.status(400).json({ success: false, message: 'email or userId required' });
    if (userId) {
      await PasswordLockout.clearUserLock({ userId });
      await User.findByIdAndUpdate(userId, { status: 'active', lockedUntil: null });
    } else if (email) {
      const user = await User.findOne({ email: String(email).toLowerCase() });
      await PasswordLockout.clearUserLock({ email });
      if (user) {
        await User.findByIdAndUpdate(user._id, { status: 'active', lockedUntil: null });
      }
    }
    res.json({ success: true, message: 'Password lockout cleared' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: unlock password lockout by IP
router.post('/password-lockouts/unlock-ip', verifyToken, async (req, res) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'rootadmin')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ success: false, message: 'ip required' });
    await PasswordLockout.deleteMany({ ipAddress: ip });
    res.json({ success: true, message: 'Password lockouts cleared for IP' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: unlock password lockout by identifier (fallback key)
router.post('/password-lockouts/unlock-identifier', verifyToken, async (req, res) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'rootadmin')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ success: false, message: 'identifier required' });
    await PasswordLockout.clearUserLock({ identifier });
    res.json({ success: true, message: 'Password lockouts cleared for identifier' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/verify-password
router.post('/verify-password', verifyToken, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Safety check: existing password? (e.g. Google login users have no password)
    if (!user.password) {
      return res.status(400).json({ success: false, message: 'No password set for this account (Social Login).' });
    }

    const isMatch = await bcryptjs.compare(password, user.password);
    if (isMatch) {
      return res.json({ success: true });
    } else {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }
  } catch (err) {
    console.error("verify-password error:", err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Security Lock/Unlock routes
router.post('/lock-account', lockAccountByToken);
router.post('/unlock-account', unlockAccountByToken);
router.get('/cookie-test/set', setCookieTest);
router.get('/cookie-test/check', checkCookieTest);

export default router