import User from "../models/user.model.js";
import { generateOTP, sendSignupOTPEmail, sendForgotPasswordOTPEmail, sendProfileEmailOTPEmail } from "../utils/emailService.js";
import { errorHandler } from "../utils/error.js";

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map();

// Send OTP for signup
export const sendOTP = async (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return next(errorHandler(400, "Email is required"));
  }

  const emailLower = email.toLowerCase();

  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email: emailLower });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists. Please sign in instead!"
      });
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

    res.status(200).json({
      success: true,
      message: "OTP sent successfully to your email"
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    next(error);
  }
};

// Send OTP for forgot password
export const sendForgotPasswordOTP = async (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return next(errorHandler(400, "Email is required"));
  }

  const emailLower = email.toLowerCase();

  try {
    // Check if user exists with the email
    const user = await User.findOne({ email: emailLower });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with that email address."
      });
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

    res.status(200).json({
      success: true,
      message: "OTP sent successfully to your email"
    });

  } catch (error) {
    console.error('Send forgot password OTP error:', error);
    next(error);
  }
};

// Send OTP for profile email verification
export const sendProfileEmailOTP = async (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return next(errorHandler(400, "Email is required"));
  }

  const emailLower = email.toLowerCase();

  try {
    // Check if email already exists (but allow if it's the same user)
    const existingUser = await User.findOne({ email: emailLower });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "This email is already in use by another account. Please choose a different email."
      });
    }

    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with expiration (10 minutes)
    const expirationTime = Date.now() + 10 * 60 * 1000; // 10 minutes
    otpStore.set(emailLower, {
      otp,
      expirationTime,
      attempts: 0,
      type: 'profile_email'
    });

    // Send OTP email for profile email verification
    const emailResult = await sendProfileEmailOTPEmail(emailLower, otp);
    
    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again."
      });
    }

    res.status(200).json({
      success: true,
      message: "OTP sent successfully to your email"
    });

  } catch (error) {
    console.error('Send profile email OTP error:', error);
    next(error);
  }
};

// Verify OTP
export const verifyOTP = async (req, res, next) => {
  const { email, otp } = req.body;
  
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
      
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please try again."
      });
    }

    // OTP is valid
    if (storedData.type === 'forgotPassword') {
      // For forgot password, return success with user ID for password reset
      const { userId } = storedData;
      otpStore.delete(emailLower);
      
      res.status(200).json({
        success: true,
        message: "Email verified successfully",
        userId: userId,
        type: 'forgotPassword'
      });
    } else {
      // For signup, just return success
      otpStore.delete(emailLower);
      
      res.status(200).json({
        success: true,
        message: "Email verified successfully"
      });
    }

  } catch (error) {
    console.error('Verify OTP error:', error);
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