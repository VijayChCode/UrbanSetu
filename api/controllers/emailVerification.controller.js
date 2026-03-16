import User from "../models/user.model.js";
import DeletedAccount from "../models/deletedAccount.model.js";
import { generateOTP, sendSignupOTPEmail, sendForgotPasswordOTPEmail, sendProfileEmailOTPEmail, sendAccountDeletionOTPEmail, sendTransferRightsOTPEmail, sendContractConfirmationOTPEmail } from "../utils/emailService.js";
import { errorHandler } from "../utils/error.js";
import { logSecurityEvent } from "../middleware/security.js";
import OtpTracking from "../models/otpTracking.model.js";
import { validateEmail } from "../utils/emailValidation.js";

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map();

// Send OTP for signup
export const sendOTP = async (req, res, next) => {
  const { email } = req.body;
  const { otpTracking, requiresCaptcha } = req;

  if (!email) {
    return next(errorHandler(400, "Email is required"));
  }

  const emailLower = email.toLowerCase();

  // Validate email for fraud detection
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');
  const emailValidation = validateEmail(email, {
    logSecurity: true,
    context: 'signup_otp',
    ip,
    userAgent
  });

  if (!emailValidation.isValid) {
    // Log fraud attempt for security monitoring
    if (emailValidation.isFraud) {
      logSecurityEvent('fraud_email_otp_attempt', {
        email: emailLower,
        reason: emailValidation.reason,
        ip,
        userAgent
      });
    }
    return res.status(400).json({
      success: false,
      message: emailValidation.message
    });
  }

  try {
    // Check active lockout
    if (otpTracking && otpTracking.isLocked && otpTracking.isLocked()) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again in 15 minutes.',
        requiresCaptcha: false
      });
    }
    // Check if email already exists
    const existingUser = await User.findOne({ email: emailLower });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists. Please sign in instead!"
      });
    }

    // Block OTP for softbanned/purged accounts based on policy
    try {
      const del = await DeletedAccount.findOne({ email: emailLower });
      if (del) {
        const policy = del.policy || {};
        // Permanent ban
        if (policy.banType === 'ban') {
          return res.status(403).json({
            success: false,
            message: "Your account is permanently banned and cannot sign up again."
          });
        }
        // Cooling-off period
        if (!del.purgedAt && typeof policy.allowResignupAfterDays === 'number' && policy.allowResignupAfterDays > 0 && del.deletedAt) {
          const allowAfter = new Date(del.deletedAt.getTime() + policy.allowResignupAfterDays * 24 * 60 * 60 * 1000);
          if (new Date() < allowAfter) {
            const msLeft = allowAfter.getTime() - Date.now();
            const days = Math.floor(msLeft / (24 * 60 * 60 * 1000));
            const hours = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            const minutes = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
            const waitMsg = days > 0 ? `${days} day(s)` : (hours > 0 ? `${hours} hour(s)` : `${minutes} minute(s)`);
            return res.status(403).json({
              success: false,
              message: `Your account is softbanned. Please try again after ${waitMsg}.`
            });
          }
        }
        // If purged but not ban: still keep as historical; allow signup (unless policy says ban)
      }
    } catch (_) { }

    // Increment OTP request count
    if (otpTracking) {
      await otpTracking.incrementOtpRequest();
      // 3 requests within 5 minutes -> force captcha on next
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (otpTracking.otpRequestCount >= 3 && otpTracking.lastOtpTimestamp >= fiveMinutesAgo) {
        // Defer to model's checkCaptchaRequirement logic (which honors grace period)
        otpTracking.checkCaptchaRequirement();
        await otpTracking.save();
      }
      // 5 requests within 15 minutes -> lockout 15 minutes
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      if (otpTracking.otpRequestCount >= 5 && otpTracking.lastOtpTimestamp >= fifteenMinutesAgo) {
        await otpTracking.registerLockout(15 * 60 * 1000);
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again in 15 minutes.',
          requiresCaptcha: false
        });
      }
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP with expiration (10 minutes)
    const expirationTime = Date.now() + 10 * 60 * 1000; // 10 minutes
    otpStore.set(emailLower, {
      otp,
      expirationTime,
      attempts: 0,
      type: 'signup'
    });

    // Send OTP email for signup
    const emailResult = await sendSignupOTPEmail(emailLower, otp);

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again."
      });
    }

    // Log successful OTP request
    logSecurityEvent('signup_otp_request_successful', {
      email: emailLower,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
      requiresCaptcha
    });


    res.status(200).json({
      success: true,
      message: "OTP sent successfully to your email",
      requiresCaptcha: false
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    next(error);
  }
};

// Send OTP for forgot password
export const sendForgotPasswordOTP = async (req, res, next) => {
  const { email } = req.body;
  const { otpTracking, requiresCaptcha } = req;

  if (!email) {
    return next(errorHandler(400, "Email is required"));
  }

  const emailLower = email.toLowerCase();

  // Validate email for fraud detection
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');
  const emailValidation = validateEmail(email, {
    logSecurity: true,
    context: 'forgot_password_otp',
    ip,
    userAgent
  });

  if (!emailValidation.isValid) {
    // Log fraud attempt for security monitoring
    if (emailValidation.isFraud) {
      logSecurityEvent('fraud_email_forgot_password_otp_attempt', {
        email: emailLower,
        reason: emailValidation.reason,
        ip,
        userAgent
      });
    }
    return res.status(400).json({
      success: false,
      message: emailValidation.message
    });
  }

  try {
    // Check lockout
    if (otpTracking && otpTracking.isLocked && otpTracking.isLocked()) {
      return res.status(429).json({
        success: false,
        message: 'Too many OTP requests. Please try again in 15 minutes.',
        requiresCaptcha: true
      });
    }
    // Check if user exists with the email
    const user = await User.findOne({ email: emailLower });
    if (!user) {
      // If no active user found, but email is softbanned/purged, show policy-based reason
      try {
        const del = await DeletedAccount.findOne({ email: emailLower });
        if (del) {
          const policy = del.policy || {};
          if (policy.banType === 'ban') {
            return res.status(403).json({ success: false, message: 'This account was permanently removed and cannot recover password.' });
          }
          if (!del.purgedAt && typeof policy.allowResignupAfterDays === 'number' && policy.allowResignupAfterDays > 0 && del.deletedAt) {
            const allowAfter = new Date(del.deletedAt.getTime() + policy.allowResignupAfterDays * 24 * 60 * 60 * 1000);
            if (new Date() < allowAfter) {
              const msLeft = allowAfter.getTime() - Date.now();
              const days = Math.floor(msLeft / (24 * 60 * 60 * 1000));
              const hours = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
              const minutes = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
              const waitMsg = days > 0 ? `${days} day(s)` : (hours > 0 ? `${hours} hour(s)` : `${minutes} minute(s)`);
              return res.status(403).json({ success: false, message: `Your account is softbanned. Please try again after ${waitMsg}.` });
            }
          }
        }
      } catch (_) { }
      return res.status(404).json({ success: false, message: "No account found with that email address." });
    }

    // Block OTP sending for suspended accounts
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended. Please contact support."
      });
    }

    // Daily Password Change Limit: 3 changes per 24 hours
    if (user.passwordHistory && user.passwordHistory.length > 0) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const changesLast24h = user.passwordHistory.filter(h => new Date(h.changedAt) >= twentyFourHoursAgo).length;
      
      if (changesLast24h >= 3) {
        return res.status(429).json({
          success: false,
          message: "You have reached the daily limit for password changes. Please try again after 24 hours."
        });
      }
    }

    // Increment OTP request count
    if (otpTracking) {
      await otpTracking.incrementOtpRequest();
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (otpTracking.otpRequestCount >= 3 && otpTracking.lastOtpTimestamp >= fiveMinutesAgo) {
        otpTracking.requiresCaptcha = true;
        await otpTracking.save();
      }
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      if (otpTracking.otpRequestCount >= 5 && otpTracking.lastOtpTimestamp >= fifteenMinutesAgo) {
        await otpTracking.registerLockout(15 * 60 * 1000);
        return res.status(429).json({
          success: false,
          message: 'Too many OTP requests. Please try again in 15 minutes.',
          requiresCaptcha: true
        });
      }
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP with expiration (10 minutes)
    const expirationTime = Date.now() + 10 * 60 * 1000; // 10 minutes
    otpStore.set(emailLower, {
      otp,
      expirationTime,
      attempts: 0,
      type: 'forgotPassword',
      userId: user._id
    });

    // Send OTP email for forgot password
    const emailResult = await sendForgotPasswordOTPEmail(emailLower, otp);

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again."
      });
    }

    // Log successful forgot password OTP request
    logSecurityEvent('forgot_password_otp_request_successful', {
      email: emailLower,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
      requiresCaptcha
    });

    res.status(200).json({
      success: true,
      message: "OTP sent successfully to your email",
      requiresCaptcha: false
    });

  } catch (error) {
    console.error('Send forgot password OTP error:', error);
    next(error);
  }
};

// Send OTP for profile email verification
export const sendProfileEmailOTP = async (req, res, next) => {
  const { email } = req.body;
  const { otpTracking, requiresCaptcha } = req;

  if (!email) {
    return next(errorHandler(400, "Email is required"));
  }

  const emailLower = email.toLowerCase();

  // Validate email for fraud detection
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');
  const emailValidation = validateEmail(email, {
    logSecurity: true,
    context: 'profile_email_otp',
    ip,
    userAgent
  });

  if (!emailValidation.isValid) {
    // Log fraud attempt for security monitoring
    if (emailValidation.isFraud) {
      logSecurityEvent('fraud_email_profile_otp_attempt', {
        email: emailLower,
        reason: emailValidation.reason,
        ip,
        userAgent
      });
    }
    return res.status(400).json({
      success: false,
      message: emailValidation.message
    });
  }

  try {
    // Check if email already exists (but allow if it's the same user)
    const existingUser = await User.findOne({ email: emailLower });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "This email is already in use by another account. Please choose a different email."
      });
    }

    // Block verifying profile email if target email is softbanned/purged under ban/cooldown
    try {
      const del = await DeletedAccount.findOne({ email: emailLower });
      if (del) {
        const policy = del.policy || {};
        if (policy.banType === 'ban') {
          return res.status(403).json({ success: false, message: 'This email is blocked due to a permanent ban.' });
        }
        if (!del.purgedAt && typeof policy.allowResignupAfterDays === 'number' && policy.allowResignupAfterDays > 0 && del.deletedAt) {
          const allowAfter = new Date(del.deletedAt.getTime() + policy.allowResignupAfterDays * 24 * 60 * 60 * 1000);
          if (new Date() < allowAfter) {
            const msLeft = allowAfter.getTime() - Date.now();
            const days = Math.floor(msLeft / (24 * 60 * 60 * 1000));
            const hours = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            const minutes = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
            const waitMsg = days > 0 ? `${days} day(s)` : (hours > 0 ? `${hours} hour(s)` : `${minutes} minute(s)`);
            return res.status(403).json({ success: false, message: `This email is under a softban. Try again after ${waitMsg}.` });
          }
        }
      }
    } catch (_) { }

    // Increment OTP request count
    await otpTracking.incrementOtpRequest();

    // Generate OTP
    const otp = generateOTP();

    // Store OTP with expiration (5 minutes for better security)
    const expirationTime = Date.now() + 5 * 60 * 1000; // 5 minutes
    otpStore.set(emailLower, {
      otp,
      expirationTime,
      attempts: 0,
      type: 'profile_email',
      trackingId: otpTracking._id
    });

    // Send OTP email for profile email verification
    const emailResult = await sendProfileEmailOTPEmail(emailLower, otp);

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again."
      });
    }

    // Log successful OTP request
    logSecurityEvent('profile_otp_request_successful', {
      email: emailLower,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
      requiresCaptcha: requiresCaptcha
    });

    res.status(200).json({
      success: true,
      message: "OTP sent successfully to your email",
      requiresCaptcha: false // Reset after successful request
    });

  } catch (error) {
    console.error('Send profile email OTP error:', error);
    next(error);
  }
};

// Verify OTP
export const verifyOTP = async (req, res, next) => {
  const { email, otp } = req.body;
  const { otpTracking } = req;

  if (!email || !otp) {
    return next(errorHandler(400, "Email and OTP are required"));
  }

  const emailLower = email.toLowerCase();

  try {
    // Get stored OTP data
    const storedData = otpStore.get(emailLower);

    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: "OTP expired or not found. Please request a new OTP."
      });
    }

    // Check if OTP is expired
    if (Date.now() > storedData.expirationTime) {
      otpStore.delete(emailLower);
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP."
      });
    }

    // Check if too many attempts
    if (storedData.attempts >= 3) {
      otpStore.delete(emailLower);
      return res.status(400).json({
        success: false,
        message: "Too many failed attempts. Please request a new OTP."
      });
    }

    // Verify OTP
    if (storedData.otp !== otp) {
      storedData.attempts += 1;
      otpStore.set(emailLower, storedData);

      // Increment failed attempts in tracking for profile email OTP
      if (storedData.type === 'profile_email' && otpTracking) {
        await otpTracking.incrementFailedAttempt();
      }

      // Log failed OTP attempt
      logSecurityEvent('profile_otp_verification_failed', {
        email: emailLower,
        ip: req.ip,
        attempts: storedData.attempts,
        type: storedData.type
      });

      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please try again.",
        requiresCaptcha: (storedData.type === 'profile_email' && otpTracking?.requiresCaptcha) || false
      });
    }

    // OTP is valid
    if (storedData.type === 'signup') {
      otpStore.delete(emailLower);
      return res.status(200).json({
        success: true,
        message: "Email verified successfully"
      });
    } else if (storedData.type === 'forgotPassword') {
      // For forgot password, return success with user ID for password reset
      const { userId } = storedData;
      otpStore.delete(emailLower);

      res.status(200).json({
        success: true,
        message: "Email verified successfully",
        userId: userId,
        type: 'forgotPassword'
      });
    } else if (storedData.type === 'profile_email') {
      // For profile email verification, reset tracking and return success
      if (otpTracking) {
        await otpTracking.resetTracking();
      }

      // Log successful profile email verification
      logSecurityEvent('profile_otp_verification_successful', {
        email: emailLower,
        ip: req.ip
      });

      otpStore.delete(emailLower);

      res.status(200).json({
        success: true,
        message: "Email verified successfully",
        type: 'profile_email'
      });
    } else if (storedData.type === 'account_deletion') {
      // For account deletion, return success with user ID
      const { userId } = storedData;
      otpStore.delete(emailLower);

      // Log successful account deletion OTP verification
      logSecurityEvent('account_deletion_otp_verification_successful', {
        success: true,
        message: "Email verified successfully"
      });

      return res.status(200).json({
        success: true,
        message: "OTP verified successfully",
        userId,
        type: 'account_deletion'
      });
    } else if (storedData.type === 'transfer_rights') {
      // For transfer rights, return success
      otpStore.delete(emailLower);

      logSecurityEvent('transfer_rights_otp_verification_successful', {
        email: emailLower,
        userId: storedData.userId,
        meta: storedData.meta || {}
      });

      return res.status(200).json({
        success: true,
        message: "OTP verified successfully",
        type: 'transfer_rights'
      });
    } else if (storedData.type === 'contract_confirmation') {
      // For contract confirmation, return success
      otpStore.delete(emailLower);

      logSecurityEvent('contract_confirmation_otp_verification_successful', {
        email: emailLower,
        userId: storedData.userId
      });

      return res.status(200).json({
        success: true,
        message: "OTP verified successfully",
        type: 'contract_confirmation'
      });
    } else {
      // Fallback for unknown OTP types to prevent hanging
      otpStore.delete(emailLower);
      return res.status(400).json({
        success: false,
        message: "Invalid verification type"
      });
    }

  } catch (error) {
    console.error('Verify OTP error:', error);
    next(error);
  }
};
// Send OTP for account deletion (must be authenticated)
export const sendAccountDeletionOTP = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return next(errorHandler(401, "Not authenticated"));
    }
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    const otp = generateOTP();
    const emailLower = user.email.toLowerCase();
    const expirationTime = Date.now() + 10 * 60 * 1000;
    // Store OTP
    otpStore.set(emailLower, {
      otp,
      expirationTime,
      attempts: 0,
      type: 'account_deletion',
      userId: user._id
    });

    const emailResult = await sendAccountDeletionOTPEmail(emailLower, otp);
    if (!emailResult.success) {
      return res.status(500).json({ success: false, message: "Failed to send OTP. Please try again." });
    }

    logSecurityEvent('account_deletion_otp_request_successful', {
      email: emailLower,
      userId: user._id,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip
    });

    return res.status(200).json({ success: true, message: 'OTP sent successfully to your email' });
  } catch (error) {
    next(error);
  }
};

// Send OTP for transfer rights (root admin only)
export const sendTransferRightsOTP = async (req, res, next) => {
  try {
    if (!req.user || (req.user.role !== 'rootadmin')) {
      return next(errorHandler(403, "Only root admin can request this OTP"));
    }
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }
    const otp = generateOTP();
    const emailLower = user.email.toLowerCase();
    const expirationTime = Date.now() + 10 * 60 * 1000;
    otpStore.set(emailLower, {
      otp,
      expirationTime,
      attempts: 0,
      type: 'transfer_rights',
      userId: user._id,
      meta: {
        targetAdminId: req.body?.targetAdminId,
        requestedAt: new Date()
      }
    });

    const emailResult = await sendTransferRightsOTPEmail(emailLower, otp);
    if (!emailResult.success) {
      return res.status(500).json({ success: false, message: "Failed to send OTP. Please try again." });
    }

    logSecurityEvent('transfer_rights_otp_request_successful', {
      email: emailLower,
      userId: user._id,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip
    });

    return res.status(200).json({ success: true, message: 'OTP sent successfully to your email' });
  } catch (error) {
    next(error);
  }
};


// Send OTP for contract confirmation (must be authenticated)
export const sendContractConfirmationOTP = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return next(errorHandler(401, "Not authenticated"));
    }
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    const otp = generateOTP();
    const emailLower = user.email.toLowerCase();
    const expirationTime = Date.now() + 10 * 60 * 1000;

    // Store OTP
    otpStore.set(emailLower, {
      otp,
      expirationTime,
      attempts: 0,
      type: 'contract_confirmation',
      userId: user._id
    });

    const emailResult = await sendContractConfirmationOTPEmail(emailLower, otp);
    if (!emailResult.success) {
      return res.status(500).json({ success: false, message: "Failed to send OTP. Please try again." });
    }

    logSecurityEvent('contract_confirmation_otp_request_successful', {
      email: emailLower,
      userId: user._id,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip
    });

    return res.status(200).json({ success: true, message: 'OTP sent successfully to your email' });
  } catch (error) {
    next(error);
  }
};


// Clean up expired OTPs periodically (optional)
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of otpStore.entries()) {
    if (now > data.expirationTime) {
      otpStore.delete(email);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes