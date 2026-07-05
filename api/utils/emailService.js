import nodemailer from 'nodemailer';
import { sendBrevoEmail, initializeBrevoService, initializeBrevoApiService, testBrevoConnection, getBrevoStatus } from './brevoService.js';
import { getTimezoneFromIP } from './sessionManager.js';
import User from '../models/user.model.js';
import crypto from 'crypto';

// Token generation for unsubscription
export const generateUnsubscribeToken = (email) => {
  return crypto
    .createHash('sha256')
    .update(email + (process.env.JWT_SECRET || 'urbansetu_secret_key'))
    .digest('hex');
};

// Enhanced transporter configuration with multiple fallback options
const createTransporter = () => {
  const baseConfig = {
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    // Very conservative timeout settings for Render
    connectionTimeout: 15000, // 15 seconds
    greetingTimeout: 10000,   // 10 seconds
    socketTimeout: 15000,     // 15 seconds
    // Disable connection pooling
    pool: false,
    // Retry configuration
    retryDelay: 1000,
    maxRetries: 2
  };

  // Try different Gmail configurations
  const configs = [
    // Configuration 1: Gmail with port 587 (STARTTLS)
    {
      ...baseConfig,
      service: 'gmail',
      port: 587,
      secure: false,
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
      }
    },
    // Configuration 2: Gmail with port 465 (SSL)
    {
      ...baseConfig,
      service: 'gmail',
      port: 465,
      secure: true,
      tls: {
        rejectUnauthorized: false
      }
    },
    // Configuration 3: Direct SMTP configuration
    {
      ...baseConfig,
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
      }
    }
  ];

  return configs[0]; // Start with the first configuration
};

const transporter = nodemailer.createTransport(createTransporter());

// Email delivery tracking
const emailDeliveryStats = {
  sent: 0,
  failed: 0,
  retries: 0,
  lastSent: null,
  lastError: null
};

// Create multiple transporter configurations for fallback
const createTransporterConfigs = () => {
  const baseConfig = {
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 5000,    // 5 seconds
    socketTimeout: 10000,     // 10 seconds
    pool: false
  };

  return [
    // Config 1: Gmail with port 587 (STARTTLS)
    {
      ...baseConfig,
      service: 'gmail',
      port: 587,
      secure: false,
      tls: { rejectUnauthorized: false }
    },
    // Config 2: Gmail with port 465 (SSL)
    {
      ...baseConfig,
      service: 'gmail',
      port: 465,
      secure: true,
      tls: { rejectUnauthorized: false }
    },
    // Config 3: Direct SMTP
    {
      ...baseConfig,
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      tls: { rejectUnauthorized: false }
    }
  ];
};

let currentTransporter = null;
let transporterIndex = 0;

// Initialize transporter with fallback
const initializeTransporter = async () => {
  const configs = createTransporterConfigs();

  for (let i = 0; i < configs.length; i++) {
    try {
      const testTransporter = nodemailer.createTransport(configs[i]);
      await testTransporter.verify();
      currentTransporter = testTransporter;
      transporterIndex = i;
      console.log(`✅ Email transporter initialized successfully with config ${i + 1}`);
      return true;
    } catch (error) {
      console.log(`❌ Email config ${i + 1} failed: ${error.message}`);
      if (i === configs.length - 1) {
        console.error('All email configurations failed');
        return false;
      }
    }
  }
  return false;
};

// Verify current transporter
const verifyTransporter = async () => {
  if (!currentTransporter) {
    return await initializeTransporter();
  }

  try {
    await currentTransporter.verify();
    return true;
  } catch (error) {
    console.error('Current transporter failed, trying to reinitialize...');
    return await initializeTransporter();
  }
};

// Enhanced retry logic with exponential backoff and connection verification
// Unified email sending function with Brevo primary and Gmail fallback
export const sendEmailWithRetry = async (mailOptions, maxRetries = 3, baseDelay = 1000, category = 'essential') => {
  // Check subscription if promotional
  if (category === 'promotional') {
    try {
      const user = await User.findOne({ email: mailOptions.to }).select('isSubscribed');
      if (user && !user.isSubscribed) {
        console.log(`[EmailService] Skipping promotional email to ${mailOptions.to} (unsubscribed)`);
        return {
          success: true,
          skipped: true,
          reason: 'unsubscribed',
          messageId: 'skipped-unsubscribed'
        };
      }
    } catch (dbError) {
      console.error('[EmailService] Database error checking subscription:', dbError.message);
      // If DB fails, we proceed with sending (conservative) or skip? 
      // Usually, better to send if unsure, but for promotional, we can skip to be safe.
    }
  }

  // Try Brevo first
  try {
    console.log('Attempting to send email via Brevo...');

    const brevoEmailData = {
      to: mailOptions.to,
      subject: mailOptions.subject,
      html: mailOptions.html,
      toName: mailOptions.toName || mailOptions.to
    };

    const brevoResult = await sendBrevoEmail(brevoEmailData);

    if (brevoResult.success) {
      emailDeliveryStats.sent++;
      emailDeliveryStats.lastSent = new Date();
      console.log('✅ Email sent successfully via Brevo:', brevoResult.messageId);
      return {
        success: true,
        messageId: brevoResult.messageId,
        attempts: 1,
        provider: 'brevo'
      };
    } else {
      console.log('❌ Brevo failed, falling back to Gmail:', brevoResult.error);
    }
  } catch (error) {
    console.log('❌ Brevo error, falling back to Gmail:', error.message);
  }

  // Fallback to Gmail if Brevo fails
  console.log('Falling back to Gmail SMTP...');

  // Verify Gmail connection before first attempt
  if (!await verifyTransporter()) {
    return {
      success: false,
      error: 'Both Brevo and Gmail email services failed - all configurations failed',
      attempts: 0,
      provider: 'none'
    };
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Gmail send attempt ${attempt}...`);

      const result = await currentTransporter.sendMail(mailOptions);
      emailDeliveryStats.sent++;
      emailDeliveryStats.lastSent = new Date();

      console.log(`✅ Email sent successfully via Gmail (attempt ${attempt}):`, result.messageId);
      return {
        success: true,
        messageId: result.messageId,
        attempts: attempt,
        provider: 'gmail',
        configUsed: transporterIndex + 1
      };
    } catch (error) {
      console.log(`Gmail send attempt ${attempt} failed:`, error.message);

      // Check for specific error types and try to reinitialize
      if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
        console.error('Connection error detected, attempting to reinitialize transporter...');
        const reinitialized = await initializeTransporter();
        if (!reinitialized) {
          console.error('Failed to reinitialize transporter');
        }
      }

      // Track failed attempts
      if (attempt === maxRetries) {
        emailDeliveryStats.failed++;
        emailDeliveryStats.lastError = {
          message: error.message,
          timestamp: new Date(),
          recipient: mailOptions.to,
          errorCode: error.code,
          configUsed: transporterIndex + 1
        };

        return {
          success: false,
          error: error.message,
          attempts: attempt,
          errorCode: error.code,
          provider: 'gmail',
          configUsed: transporterIndex + 1
        };
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      emailDeliveryStats.retries++;

      console.log(`Retrying Gmail send in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Standardized error response format
export const createErrorResponse = (error, context = '') => {
  const errorMessage = error.message || 'Unknown error occurred';
  console.error(`Email sending error${context ? ` (${context})` : ''}:`, error);

  return {
    success: false,
    error: errorMessage,
    context: context,
    timestamp: new Date().toISOString()
  };
};

// Standardized success response format
export const createSuccessResponse = (messageId = null, context = '') => {
  return {
    success: true,
    messageId: messageId,
    context: context,
    timestamp: new Date().toISOString()
  };
};

// Format dates in Indian Standard Time or Localized Time for email templates
const formatLocalizedTime = (dateInput = new Date(), ip = null, options = {}) => {
  const dateValue = dateInput ? new Date(dateInput) : new Date();
  const timeZone = ip ? getTimezoneFromIP(ip) : 'Asia/Kolkata';

  return dateValue.toLocaleString('en-IN', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options
  }) + (ip ? ` (${timeZone})` : '');
};

// Legacy support for India time
const formatIndiaTime = (dateInput = new Date(), options = {}) => formatLocalizedTime(dateInput, null, options);

// Generate OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Get email delivery statistics
export const getEmailStats = () => {
  return {
    ...emailDeliveryStats,
    successRate: emailDeliveryStats.sent / (emailDeliveryStats.sent + emailDeliveryStats.failed) * 100
  };
};

// Get current transporter status
export const getTransporterStatus = () => {
  return {
    isInitialized: !!currentTransporter,
    configIndex: transporterIndex,
    configName: currentTransporter ? `Config ${transporterIndex + 1}` : 'Not initialized',
    hasEmailUser: !!process.env.EMAIL_USER,
    hasEmailPass: !!process.env.EMAIL_PASS
  };
};

// Helper to get unsubscribe link for a user
export const getUnsubscribeUrl = (email) => {
  const baseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  return `${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}&token=${generateUnsubscribeToken(email)}`;
};

// Get comprehensive unsubscribe data
export const getUnsubscribeData = async (email) => {
  const unsubscribeUrl = getUnsubscribeUrl(email);
  return { unsubscribeUrl };
};


// Send OTP email for signup
export const sendSignupOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Email Verification - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Email Verification</p>
          </div>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Verify Your Email Address</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Thank you for signing up with UrbanSetu! To complete your registration, please use the verification code below:
            </p>
            
            <div style="background-color: #2563eb; color: white; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px;">${otp}</span>
            </div>
            
            <p style="color: #6b7280; margin: 0; font-size: 14px;">
              This code will expire in 10 minutes. If you didn't request this verification, please ignore this email.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'signup_otp') :
      createErrorResponse(new Error(result.error), 'signup_otp');
  } catch (error) {
    return createErrorResponse(error, 'signup_otp');
  }
};

// Send OTP email for forgot password
export const sendForgotPasswordOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Password Reset Request</p>
          </div>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Reset Your Password</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              We received a request to reset your password for your UrbanSetu account. To proceed with the password reset, please use the verification code below:
            </p>
            
            <div style="background-color: #dc2626; color: white; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px;">${otp}</span>
            </div>
            
            <p style="color: #6b7280; margin: 0 0 15px 0; line-height: 1.6;">
              <strong>Important:</strong> If you didn't request this password reset, please ignore this email and your password will remain unchanged.
            </p>
            
            <p style="color: #6b7280; margin: 0; font-size: 14px;">
              This code will expire in 10 minutes. For security reasons, please do not share this code with anyone.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'forgot_password_otp') :
      createErrorResponse(new Error(result.error), 'forgot_password_otp');
  } catch (error) {
    return createErrorResponse(error, 'forgot_password_otp');
  }
};

// Send OTP email for profile email verification
export const sendProfileEmailOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Email Verification - Update Profile - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #059669; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Profile Email Verification</p>
          </div>
          
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #059669;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Verify Your New Email Address</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              You're updating your email address in your UrbanSetu profile. To confirm this change and verify your new email address, please use the verification code below:
            </p>
            
            <div style="background-color: #059669; color: white; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px;">${otp}</span>
            </div>
            
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              <strong>Important:</strong> This verification is required to update your profile email address. If you didn't initiate this change, please secure your account immediately.
            </p>
            
            <p style="color: #6b7280; margin: 0; font-size: 14px;">
              This code will expire in 10 minutes. Once verified, your profile email will be updated to this address.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'profile_email_otp') :
      createErrorResponse(new Error(result.error), 'profile_email_otp');
  } catch (error) {
    return createErrorResponse(error, 'profile_email_otp');
  }
};

// Send OTP email for login
export const sendLoginOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Login Verification - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #7c3aed; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Login Verification</p>
          </div>
          
          <div style="background-color: #faf5ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #7c3aed;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Complete Your Login</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              You're signing in to your UrbanSetu account. To complete the login process, please use the verification code below:
            </p>
            
            <div style="background-color: #7c3aed; color: white; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px;">${otp}</span>
            </div>
            
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              <strong>Security Note:</strong> If you didn't request this login, please secure your account immediately by changing your password.
            </p>
            
            <p style="color: #6b7280; margin: 0; font-size: 14px;">
              This code will expire in 10 minutes. For your security, please do not share this code with anyone.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'login_otp') :
      createErrorResponse(new Error(result.error), 'login_otp');
  } catch (error) {
    return createErrorResponse(error, 'login_otp');
  }
};

// Send OTP email for account deletion confirmation
export const sendAccountDeletionOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Confirm Account Deletion - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Account Deletion Verification</p>
          </div>
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Confirm Your Account Deletion</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              You requested to permanently delete your UrbanSetu account. To confirm this action, please use the verification code below:
            </p>
            <div style="background-color: #dc2626; color: white; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px;">${otp}</span>
            </div>
            <p style="color: #6b7280; margin: 0 0 15px 0; line-height: 1.6;">
              <strong>Important:</strong> This action is irreversible. If you did not initiate this request, please ignore this email and secure your account.
            </p>
            <p style="color: #6b7280; margin: 0; font-size: 14px;">
              This code will expire in 10 minutes. Do not share this code with anyone.
            </p>
          </div>
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'account_deletion_otp') :
      createErrorResponse(new Error(result.error), 'account_deletion_otp');
  } catch (error) {
    return createErrorResponse(error, 'account_deletion_otp');
  }
};

// Send OTP email for transfer rights (root admin only)
export const sendTransferRightsOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Confirm Transfer of Admin Rights - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Transfer Rights Verification</p>
          </div>
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Confirm Transfer of Admin Rights</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              You requested to transfer critical administrative rights. To confirm this high-privilege action, please use the verification code below:
            </p>
            <div style="background-color: #2563eb; color: white; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px;">${otp}</span>
            </div>
            <p style="color: #6b7280; margin: 0 0 15px 0; line-height: 1.6;">
              <strong>Security Note:</strong> Only proceed if you initiated this operation. If not, contact support immediately.
            </p>
            <p style="color: #6b7280; margin: 0; font-size: 14px;">
              This code will expire in 10 minutes. Do not share this code with anyone.
            </p>
          </div>
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'transfer_rights_otp') :
      createErrorResponse(new Error(result.error), 'transfer_rights_otp');
  } catch (error) {
    return createErrorResponse(error, 'transfer_rights_otp');
  }
};

// Send OTP email for contract confirmation
export const sendContractConfirmationOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Confirm Rent-Lock Contract - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Contract Confirmation Verification</p>
          </div>
          
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Verify to Confirm Rent-Lock Contract</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              We’ve sent a 6-digit verification code to your registered email. Please enter it to finalize your Rent-Lock contract.
            </p>
            
            <div style="background-color: #2563eb; color: white; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px;">${otp}</span>
            </div>
            
            <p style="color: #6b7280; margin: 0 0 15px 0; line-height: 1.6;">
              <strong>Note:</strong> This verification ensures that you have reviewed and agreed to the contract details.
            </p>
            
            <p style="color: #6b7280; margin: 0; font-size: 14px;">
              This code will expire in 10 minutes. For your security, please do not share this code with anyone.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'contract_confirmation_otp') :
      createErrorResponse(new Error(result.error), 'contract_confirmation_otp');
  } catch (error) {
    return createErrorResponse(error, 'contract_confirmation_otp');
  }
};

// Send Update Announcement Email
export const sendUpdateAnnouncementEmail = async (email, update) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const unsubscribeUrl = getUnsubscribeUrl(email);
  const isAppLaunch = update.isAppLaunch || update.category === 'android' || update.category === 'ios';

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: isAppLaunch ? `New App Launch: ${update.title} - UrbanSetu` : `New Update: ${update.title} - UrbanSetu`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header Image (if available) or Default -->
          ${update.imageUrls && update.imageUrls.length > 0 ?
        `<div style="margin-bottom: 20px; border-radius: 8px; overflow: hidden;">
               <img src="${update.imageUrls[0]}" alt="Update Image" style="width: 100%; height: auto; display: block;">
             </div>` : ''
      }
          
          <div style="text-align: center; margin-bottom: 25px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 26px;">${update.title}</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
              ${update.category ? update.category.replace('_', ' ') : 'Update Announcement'} • ${update.version || 'v1.0'}
            </p>
          </div>
          
          <div style="background-color: #f0f9ff; padding: 25px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #2563eb;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px;">${isAppLaunch ? "What's in this version?" : "What's New?"}</h2>
            <div style="color: #4b5563; line-height: 1.6; white-space: pre-wrap;">${update.description}</div>
            
            ${update.tags && update.tags.length > 0 ? `
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e7ff;">
                <p style="margin: 0; font-size: 12px; color: #6b7280;">Tags: 
                  ${update.tags.map(tag => `<span style="background: #ffffff; color: #2563eb; padding: 2px 8px; border-radius: 12px; border: 1px solid #bfdbfe; margin-left: 5px;">${tag}</span>`).join('')}
                </p>
              </div>
            ` : ''}
          </div>
          
          <div style="text-align: center; margin-bottom: 20px;">
            <p style="color: #374151; margin-bottom: 15px;">${isAppLaunch ? 'Download the latest version now.' : 'Experience the new features firsthand.'}</p>
            
            <a href="${clientBaseUrl}${isAppLaunch ? '/download' : '/updates'}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; font-size: 15px; margin: 5px;">
              ${isAppLaunch ? 'Go to Downloads' : 'View Full Changelog'}
            </a>
            
            ${!isAppLaunch && update.actionUrl ? `
              <a href="${update.actionUrl}" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; font-size: 15px; margin: 5px;">
                Explore Feature
              </a>
            ` : isAppLaunch ? '' : `
              <a href="${clientBaseUrl}/sign-in" style="display: inline-block; background-color: #ffffff; color: #2563eb; text-decoration: none; padding: 10px 25px; border-radius: 6px; font-weight: bold; font-size: 15px; border: 2px solid #2563eb; margin: 5px;">
                Sign In to Explore
              </a>
            `}
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.<br>
              You received this email because you are a registered user of UrbanSetu.
              <br><br>
              Don't want to receive these emails? 
              <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a> from these emails.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions, 3, 1000, 'promotional');
    return result.success ?
      createSuccessResponse(result.messageId, 'update_announcement') :
      createErrorResponse(new Error(result.error), 'update_announcement');
  } catch (error) {
    return createErrorResponse(error, 'update_announcement');
  }
};

// Send notification email when a listing is unpublished
export const sendListingUnpublishedEmail = async (email, details) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Important: Your Property Update - UrbanSetu`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Property Status Update</p>
          </div>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Listing Unpublished</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              This is to inform you that your listing <strong>"${details.propertyName}"</strong> has been unpublished and its verification status has been revoked.
            </p>
            
            <div style="background-color: #fff; padding: 15px; border-radius: 8px; border: 1px solid #fee2e2; margin: 20px 0;">
              <p style="color: #7f1d1d; font-weight: bold; margin: 0 0 5px 0;">Reason for Unpublishing:</p>
              <p style="color: #4b5563; margin: 0; font-style: italic;">"${details.reason}"</p>
            </div>
            
            <p style="color: #6b7280; margin: 0 0 15px 0; line-height: 1.6;">
              <strong>Action Required:</strong> You may need to review and update your listing to comply with our guidelines before requesting verification again.
            </p>
            
            <div style="text-align: center; margin-top: 25px; margin-bottom: 15px;">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/listing/${details.propertyId}" style="display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 10px; margin-bottom: 10px;">View Property</a>
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact" style="display: inline-block; background-color: #ffffff; color: #4b5563; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; border: 1px solid #d1d5db; margin-bottom: 10px;">Contact Support</a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'listing_unpublished') :
      createErrorResponse(new Error(result.error), 'listing_unpublished');
  } catch (error) {
    return createErrorResponse(error, 'listing_unpublished');
  }
};

export const sendAgentApprovalEmail = async (email, name) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Application Approved - Welcome to UrbanSetu Agent Network',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #059669; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Agent Application Update</p>
          </div>
          
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #059669;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Congratulations, ${name}!</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              We are excited to inform you that your application to become an UrbanSetu Partner Agent has been <strong>APPROVED</strong>.
            </p>
            <p style="color: #4b5563; margin: 15px 0 0 0; line-height: 1.6;">
              You now have access to the Agent Dashboard where you can manage listings, view leads, and grow your real estate business.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${clientBaseUrl}/user/agents" style="display: inline-block; background-color: #059669; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Access Dashboard</a>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ? createSuccessResponse(result.messageId, 'agent_approval') : createErrorResponse(new Error(result.error), 'agent_approval');
  } catch (error) {
    return createErrorResponse(error, 'agent_approval');
  }
};

export const sendAgentRejectionEmail = async (email, name, reason) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Update on Your UrbanSetu Agent Application',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Application Status</p>
          </div>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Dear ${name},</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Thank you for your interest in joining UrbanSetu. After carefully reviewing your application, we regret to inform you that we are unable to approve your request at this time.
            </p>
            <div style="margin-top: 15px; background: white; padding: 10px; border-radius: 4px; border: 1px solid #fee2e2;">
              <strong>Reason:</strong><br>
              <span style="color: #ef4444;">${reason || 'Does not meet current requirements.'}</span>
            </div>
            <p style="color: #4b5563; margin: 15px 0 0 0; line-height: 1.6;">
              You are welcome to re-apply at any time after addressing the above points.
            </p>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${clientBaseUrl}/user/become-an-agent" style="display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Partner Program</a>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ? createSuccessResponse(result.messageId, 'agent_rejection') : createErrorResponse(new Error(result.error), 'agent_rejection');
  } catch (error) {
    return createErrorResponse(error, 'agent_rejection');
  }
};

export const sendAgentRevokedEmail = async (email, name, reason) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Important: Your UrbanSetu Agent Access Has Been Revoked',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Account Alert</p>
          </div>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Dear ${name},</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              We are writing to inform you that your <strong>UrbanSetu Partner Agent access has been revoked</strong> effectively immediately.
            </p>
            <div style="margin-top: 15px; background: white; padding: 10px; border-radius: 4px; border: 1px solid #fee2e2;">
              <strong>Reason for Revocation:</strong><br>
              <span style="color: #ef4444;">${reason || 'Violation of terms or policy.'}</span>
            </div>
            <p style="color: #4b5563; margin: 15px 0 0 0; line-height: 1.6;">
              You may re-apply for agent status after ${new Date(new Date().setDate(new Date().getDate() + 30)).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.
            </p>
            <p style="color: #4b5563; margin: 10px 0 0 0; line-height: 1.6;">
              If you believe this is an error or would like to appeal this decision, please contact our support team.
            </p>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${clientBaseUrl}/user/contact" style="display: inline-block; background-color: #4b5563; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Contact Support</a>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ? createSuccessResponse(result.messageId, 'agent_revocation') : createErrorResponse(new Error(result.error), 'agent_revocation');
  } catch (error) {
    return createErrorResponse(error, 'agent_revocation');
  }
};

export const sendNewLoginEmail = async (email, device, ip, location, loginTime) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'New Login Detected - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Security Alert</p>
          </div>
          
          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">New Login Detected</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              We detected a new login to your UrbanSetu account. If this was you, no action is needed.
            </p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <p style="margin: 5px 0; color: #374151;"><strong>Device:</strong> ${device}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>IP Address:</strong> ${ip}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Location:</strong> ${location || 'Unknown'}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Login Time:</strong> ${formatLocalizedTime(loginTime, ip)}</p>
            </div>
            
            <p style="color: #6b7280; margin: 15px 0 10px 0; font-size: 14px;">
              You can review your active sessions to verify this activity.
            </p>
            <div style="text-align:center; margin-top: 15px;">
              <a href="${clientBaseUrl}/user/device-management" style="display:inline-block; background-color:#2563eb; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:600; margin-bottom: 10px;">Check Active Sessions</a>
            </div>
            <p style="color: #6b7280; margin: 10px 0 10px 0; font-size: 14px;">
              If you didn't make this login, please secure your account immediately.
            </p>
            <div style="text-align:center; margin-top: 10px;">
              <a href="${clientBaseUrl}/forgot-password" style="display:inline-block; border: 1px solid #2563eb; color:#2563eb; text-decoration:none; padding:10px 16px; border-radius:6px; font-weight:600;">Reset Password</a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'new_login_notification') :
      createErrorResponse(new Error(result.error), 'new_login_notification');
  } catch (error) {
    return createErrorResponse(error, 'new_login_notification');
  }
};

// Send suspicious login alert email
export const sendSuspiciousLoginEmail = async (email, currentDevice, currentIp, currentLocation, previousDevice, previousIp, previousLocation) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Suspicious Login Attempt - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Security Alert</p>
          </div>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">⚠️ Suspicious Login Detected</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              We detected a login from a new device or location that differs from your usual login pattern.
            </p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <h3 style="color: #dc2626; margin: 0 0 10px 0; font-size: 16px;">Current Login:</h3>
              <p style="margin: 5px 0; color: #374151;"><strong>Device:</strong> ${currentDevice}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>IP Address:</strong> ${currentIp}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Location:</strong> ${currentLocation || 'Unknown'}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Time:</strong> ${formatLocalizedTime(new Date(), currentIp)}</p>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <h3 style="color: #6b7280; margin: 0 0 10px 0; font-size: 16px;">Previous Login:</h3>
              <p style="margin: 5px 0; color: #374151;"><strong>Device:</strong> ${previousDevice || 'Unknown'}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>IP Address:</strong> ${previousIp || 'Unknown'}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Location:</strong> ${previousLocation || 'Unknown'}</p>
            </div>
            
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #f59e0b;">
              <p style="color: #92400e; margin: 0; font-weight: bold;">
                If this wasn't you, please secure your account immediately. We recommend reviewing your active sessions.
              </p>
            </div>
            <div style="text-align:center; margin-top: 15px;">
              <a href="${clientBaseUrl}/user/device-management" style="display:inline-block; background-color:#2563eb; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:600; margin-bottom: 15px;">Check Active Sessions</a>
              <br>
              <a href="${clientBaseUrl}/forgot-password" style="display:inline-block; background-color:#dc2626; color:#ffffff; text-decoration:none; padding:10px 16px; border-radius:6px; font-weight:600;">Reset Password</a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'suspicious_login_alert') :
      createErrorResponse(new Error(result.error), 'suspicious_login_alert');
  } catch (error) {
    return createErrorResponse(error, 'suspicious_login_alert');
  }
};

// Send forced logout notification email
export const sendForcedLogoutEmail = async (email, reason, performedBy) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Account Security - Forced Logout - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Security Notice</p>
          </div>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Forced Logout</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              All your active sessions have been logged out for security reasons.
            </p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <p style="margin: 5px 0; color: #374151;"><strong>Reason:</strong> ${reason}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Performed by:</strong> ${performedBy}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Time:</strong> ${formatIndiaTime()}</p>
            </div>
            
            <p style="color: #6b7280; margin: 15px 0 0 0; font-size: 14px;">
              You will need to log in again to access your account. If you have any concerns, please contact support.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'forced_logout_notification') :
      createErrorResponse(new Error(result.error), 'forced_logout_notification');
  } catch (error) {
    return createErrorResponse(error, 'forced_logout_notification');
  }
};

// Send SetuCoin adjustment notification email
export const sendCoinAdjustmentEmail = async (email, details) => {
  const { type, amount, reason, newBalance } = details;
  const isRevocation = type === 'debit';
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `SetuCoins ${isRevocation ? 'Revocation' : 'Credit'} Notification - UrbanSetu`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Loyalty Program Update</p>
          </div>
          
          <div style="background-color: ${isRevocation ? '#fef2f2' : '#f0f9ff'}; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid ${isRevocation ? '#dc2626' : '#2563eb'};">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">
              SetuCoins ${isRevocation ? 'Revoked' : 'Added'}
            </h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              ${isRevocation
        ? 'An administrator has revoked SetuCoins from your account for the reason specified below.'
        : 'Great news! SetuCoins have been credited to your account by an administrator.'}
            </p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <p style="margin: 5px 0; color: #374151;"><strong>Adjustment Type:</strong> ${isRevocation ? 'Deduction' : 'Credit'}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Amount:</strong> <span style="color: ${isRevocation ? '#dc2626' : '#059669'}; font-weight: bold;">${isRevocation ? '-' : '+'}${amount} Coins</span></p>
              <p style="margin: 5px 0; color: #374151;"><strong>Reason:</strong> ${reason}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>New Balance:</strong> ${newBalance} SC</p>
            </div>
            
            <p style="color: #6b7280; margin: 15px 0 10px 0; font-size: 14px;">
              You can view your full transaction history on the Rewards page.
            </p>
            <div style="text-align:center; margin-top: 15px;">
              <a href="${clientBaseUrl}/user/rewards?tab=history" style="display:inline-block; background-color:#2563eb; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:600; margin-bottom: 15px;">View Activity History</a>
            </div>
            
            <p style="color: #6b7280; margin: 10px 0 10px 0; font-size: 14px;">
              Questions? Reach out to our support team.
            </p>
            <div style="text-align:center;">
              <a href="${clientBaseUrl}/user/contact" style="color:#2563eb; text-decoration:underline; font-weight:600; font-size: 14px;">Contact Support</a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'coin_adjustment') :
      createErrorResponse(new Error(result.error), 'coin_adjustment');
  } catch (error) {
    return createErrorResponse(error, 'coin_adjustment');
  }
};

// Send referral reminder email
export const sendReferralReminderEmail = async (email, username, referralLink) => {
  const { unsubscribeUrl } = await getUnsubscribeData(email);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Earn Rewards with UrbanSetu Referral Program! 💎',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
        <!-- Header with Gradient -->
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;">UrbanSetu</h1>
          <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 18px; font-weight: 500;">Spread the Word & Earn Big!</p>
        </div>

        <!-- Main Content -->
        <div style="padding: 40px 30px;">
          <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px; text-align: center;">Hello ${username || 'UrbanSetu User'},</h2>
          
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 25px; text-align: center;">
            Did you know you can earn <strong>SetuCoins</strong> just by inviting your friends to UrbanSetu? It's the easiest way to stack up rewards!
          </p>

          <!-- Reward Box -->
          <div style="background-color: #f5f3ff; border: 2px dashed #7c3aed; border-radius: 12px; padding: 25px; margin-bottom: 30px; text-align: center;">
            <p style="color: #6d28d9; font-weight: 700; font-size: 20px; margin: 0 0 10px 0;">💰 You Earn: 100 SetuCoins</p>
            <p style="color: #4b5563; margin: 0;">For every friend who signs up using your link.</p>
          </div>

          <!-- Referral Link Section -->
          <div style="text-align: center; margin-bottom: 35px;">
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Your Unique Referral Link</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 16px; color: #1f2937; border: 1px solid #e5e7eb; word-break: break-all;">
              ${referralLink}
            </div>
          </div>

          <!-- Call to Action -->
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${clientBaseUrl}/user/rewards" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 50px; font-weight: 700; font-size: 16px; transition: transform 0.2s; box-shadow: 0 4px 6px rgba(124, 58, 237, 0.3);">
              Go to My Rewards Dashboard
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center; margin-top: 30px;">
            Have questions? We're here to help! Visit our <a href="${clientBaseUrl}/contact" style="color: #4f46e5; text-decoration: none; font-weight: 600;">Contact Support</a> page anytime.
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; margin: 0; font-size: 12px;">
            © ${new Date().getFullYear()} UrbanSetu. All rights reserved.<br>
            You received this email because you are a valued member of our community.
          </p>
          <div style="margin-top: 15px; border-top: 1px solid #eeeeee; padding-top: 15px;">
            <p style="color: #999999; font-size: 12px; margin: 0;">
              Don't want to receive these emails? 
              <a href="${unsubscribeUrl}" style="color: #4f46e5; text-decoration: underline;">Unsubscribe</a> from these emails.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions, 3, 1000, 'promotional');
    return result.success ?
      createSuccessResponse(result.messageId, 'referral_reminder') :
      createErrorResponse(new Error(result.error), 'referral_reminder');
  } catch (error) {
    return createErrorResponse(error, 'referral_reminder');
  }
};

// Payment Success Email
export const sendPaymentSuccessEmail = async (email, paymentDetails) => {
  try {
    const {
      paymentId,
      amount,
      currency,
      propertyName,
      appointmentDate,
      receiptUrl,
      paymentType,
      gateway
    } = paymentDetails;

    const subject = `Payment Successful - ${propertyName}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Successful - UrbanSetu</title>
        <style>
          .btn-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: center;
            max-width: 100%;
            width: 100%;
          }
          .btn-container.horizontal {
            flex-direction: row;
            gap: 20px;
            justify-content: center;
            flex-wrap: wrap;
          }
          .btn {
            display: inline-block;
            width: auto;
            max-width: 280px;
            padding: 15px 25px;
            margin: 5px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            text-align: center;
            box-sizing: border-box;
            word-wrap: break-word;
            transition: all 0.3s ease;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .btn-container:not(.horizontal) .btn {
            display: block;
            width: 100%;
            margin: 0;
            padding: 12px 20px;
          }
          .btn-primary {
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white !important;
          }
          .btn-secondary {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white !important;
          }
          .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
          }
          @media (max-width: 600px) {
            .btn-container.horizontal {
              flex-direction: column;
              gap: 10px;
            }
            .btn {
              max-width: 100%;
              padding: 14px 16px;
              font-size: 15px;
              margin: 0;
              display: block;
              width: 100%;
            }
          }
          @media (max-width: 400px) {
            .btn {
              padding: 12px 14px;
              font-size: 14px;
            }
          }
        </style>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3); position: relative;">
              <div style="position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; opacity: 0.2;"></div>
              <span style="color: #ffffff; font-size: 36px; font-weight: bold; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">✓</span>
            </div>
            <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Payment Successful!</h1>
            <p style="color: #6b7280; margin: 10px 0 0; font-size: 16px;">Your payment has been processed successfully</p>
          </div>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 20px;">Payment Details</h2>
            <div style="display: grid; gap: 10px;">
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280; font-weight: 500;">Property:</span>
                <span style="color: #1f2937; font-weight: 600;">${propertyName}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280; font-weight: 500;">Appointment Date:</span>
                <span style="color: #1f2937; font-weight: 600;">${appointmentDate}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280; font-weight: 500;">Payment Type:</span>
                <span style="color: #1f2937; font-weight: 600;">${paymentType.replace('_', ' ').toUpperCase()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280; font-weight: 500;">Amount:</span>
                <span style="color: #1f2937; font-weight: 600;">${currency} ${amount}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280; font-weight: 500;">Payment ID:</span>
                <span style="color: #1f2937; font-weight: 600;">${paymentId}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                <span style="color: #6b7280; font-weight: 500;">Payment Gateway:</span>
                <span style="color: #1f2937; font-weight: 600;">${gateway.toUpperCase()}</span>
              </div>
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; align-items: center;">
              <a href="${receiptUrl}" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3); transition: all 0.3s ease; margin: 5px;">
                📄 Download Receipt
              </a>
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-appointments" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3); transition: all 0.3s ease; margin: 5px;">
                📅 View Appointments
              </a>
            </div>
          </div>
          
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <h3 style="color: #1e40af; margin: 0 0 10px; font-size: 16px;">What's Next?</h3>
            <p style="color: #1e40af; margin: 0; font-size: 14px; line-height: 1.5;">
              Your payment has been confirmed and your appointment is now secured. You can view all your appointments and download receipts from your appointments page.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              If you have any questions, please contact our support team.
            </p>
            <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0;">
              This is an automated message. Please do not reply to this email.
            </p>
            <p style="color: #9ca3af; margin: 15px 0 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending payment success email:', error);
    return createErrorResponse(error, 'payment_success_notification');
  }
};

// Payment Failed Email
export const sendPaymentFailedEmail = async (email, paymentDetails) => {
  try {
    const {
      paymentId,
      amount,
      currency,
      propertyName,
      appointmentDate,
      paymentType,
      gateway,
      reason
    } = paymentDetails;

    const subject = `Payment Failed - ${propertyName}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(239, 68, 68, 0.3); position: relative;">
              <div style="position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 50%; opacity: 0.2;"></div>
              <span style="color: #ffffff; font-size: 36px; font-weight: bold; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">✗</span>
            </div>
            <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Payment Failed</h1>
            <p style="color: #6b7280; margin: 10px 0 0; font-size: 16px;">We were unable to process your payment</p>
          </div>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #ef4444;">
            <h2 style="color: #dc2626; margin: 0 0 15px; font-size: 20px;">Payment Details</h2>
            <div style="display: grid; gap: 10px;">
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fecaca;">
                <span style="color: #6b7280; font-weight: 500;">Property:</span>
                <span style="color: #1f2937; font-weight: 600;">${propertyName}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fecaca;">
                <span style="color: #6b7280; font-weight: 500;">Appointment Date:</span>
                <span style="color: #1f2937; font-weight: 600;">${appointmentDate}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fecaca;">
                <span style="color: #6b7280; font-weight: 500;">Payment Type:</span>
                <span style="color: #1f2937; font-weight: 600;">${paymentType.replace('_', ' ').toUpperCase()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fecaca;">
                <span style="color: #6b7280; font-weight: 500;">Amount:</span>
                <span style="color: #1f2937; font-weight: 600;">${currency} ${amount}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fecaca;">
                <span style="color: #6b7280; font-weight: 500;">Payment ID:</span>
                <span style="color: #1f2937; font-weight: 600;">${paymentId}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                <span style="color: #6b7280; font-weight: 500;">Payment Gateway:</span>
                <span style="color: #1f2937; font-weight: 600;">${gateway.toUpperCase()}</span>
              </div>
            </div>
            ${reason ? `
              <div style="margin-top: 15px; padding: 10px; background-color: #fef2f2; border-radius: 4px;">
                <strong style="color: #dc2626;">Reason:</strong>
                <span style="color: #7f1d1d; margin-left: 5px;">${reason}</span>
              </div>
            ` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; align-items: center;">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-appointments" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3); transition: all 0.3s ease; margin: 5px;">
                🔄 Retry Payment
              </a>
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/about" style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(107, 114, 128, 0.3); transition: all 0.3s ease; margin: 5px;">
                📞 Contact Support
              </a>
            </div>
          </div>
          
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <h3 style="color: #92400e; margin: 0 0 10px; font-size: 16px;">What to do next?</h3>
            <ul style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.6; padding-left: 20px;">
              <li>Check your payment method and try again</li>
              <li>Ensure you have sufficient funds</li>
              <li>Contact your bank if the issue persists</li>
              <li>Try using a different payment method</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              If you continue to experience issues, please contact our support team.
            </p>
            <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0;">
              This is an automated message. Please do not reply to this email.
            </p>
            <p style="color: #9ca3af; margin: 15px 0 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending payment failed email:', error);
    return createErrorResponse(error, 'payment_failed_notification');
  }
};

// Legacy function for backward compatibility (deprecated)
export const sendOTPEmail = async (email, otp) => {
  console.warn('sendOTPEmail is deprecated. Use sendSignupOTPEmail or sendForgotPasswordOTPEmail instead.');
  return await sendSignupOTPEmail(email, otp);
};

// Initialize email service and verify connection on startup
const initializeEmailService = async () => {
  console.log('🚀 Initializing email service...');

  // Initialize Brevo API service first (more reliable)
  console.log('📧 Initializing Brevo API service...');
  const brevoApiResult = initializeBrevoApiService();
  if (brevoApiResult.success) {
    console.log('✅ Brevo API service initialized successfully');
  } else {
    console.log('⚠️ Brevo API service initialization failed:', brevoApiResult.error);
  }

  // Initialize Brevo SMTP service as fallback
  console.log('📧 Initializing Brevo SMTP service...');
  const brevoSmtpResult = await initializeBrevoService();
  if (brevoSmtpResult.success) {
    console.log('✅ Brevo SMTP service initialized successfully');
  } else {
    console.log('⚠️ Brevo SMTP service initialization failed:', brevoSmtpResult.error);
  }

  // Check Gmail fallback environment variables
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ Gmail fallback not configured: Missing EMAIL_USER or EMAIL_PASS environment variables');
    console.log('📧 Email service will use Brevo only');
  } else {
    console.log(`📧 Gmail fallback configured for: ${process.env.EMAIL_USER}`);

    // Try to initialize Gmail transporter as fallback
    const isGmailConnected = await initializeTransporter();
    if (isGmailConnected) {
      console.log(`✅ Gmail fallback initialized successfully with configuration ${transporterIndex + 1}`);
    } else {
      console.warn('⚠️ Gmail fallback initialization failed: All SMTP configurations failed');
    }
  }

  // Check if at least one service is available
  const brevoStatus = getBrevoStatus();
  const hasGmailFallback = process.env.EMAIL_USER && process.env.EMAIL_PASS;

  if (brevoStatus.isInitialized || hasGmailFallback) {
    console.log('✅ Email service ready with at least one provider');
    return true;
  } else {
    console.error('❌ Email service initialization failed: No email providers available');
    console.error('💡 Please configure either:');
    console.error('   1. Brevo: BREVO_API_KEY environment variable');
    console.error('   2. Gmail: EMAIL_USER and EMAIL_PASS environment variables');
    return false;
  }
};

// Password Change Email Functions
export const sendPasswordResetSuccessEmail = async (userEmail, userName, resetMethod = 'forgot_password') => {
  const emailData = {
    to: userEmail,
    subject: "🔒 Password Successfully Reset - UrbanSetu",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Successful</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">🔒 Password Reset Successful</h1>
            <p style="color: #e2e8f0; margin: 10px 0 0; font-size: 16px;">Your account security has been updated</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3); position: relative;">
                <div style="position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; opacity: 0.2;"></div>
                <span style="color: #ffffff; font-size: 36px; font-weight: bold; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">✓</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">Password Successfully Reset</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">Hello ${userName}, your password has been successfully reset and your account is now secure.</p>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 18px; font-weight: 600;">Reset Details</h3>
              <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Account:</span>
                  <span style="color: #1f2937; font-weight: 600;">${userEmail}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Reset Method:</span>
                  <span style="color: #1f2937; font-weight: 600;">${resetMethod === 'forgot_password' ? 'Forgot Password' : 'Manual Reset'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                  <span style="color: #6b7280; font-weight: 500;">Reset Time:</span>
                  <span style="color: #1f2937; font-weight: 600;">${formatIndiaTime(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })}</span>
                </div>
              </div>
            </div>
            
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
              <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <span style="color: #f59e0b; font-size: 20px; margin-right: 10px;">⚠️</span>
                <h4 style="color: #92400e; margin: 0; font-size: 16px; font-weight: 600;">Security Notice</h4>
              </div>
              <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.5;">
                If you did not request this password reset, please contact our support team immediately. 
                Your account security is our top priority.
              </p>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/signin" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; transition: all 0.3s ease;">
                Sign In to Your Account
              </a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; margin: 0 0 15px; font-size: 14px;">
              This email was sent to ${userEmail} because a password reset was requested for your UrbanSetu account.
            </p>
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await sendEmailWithRetry(emailData);
    console.log(`✅ Password reset success email sent to: ${userEmail}`);
  } catch (error) {
    console.error(`❌ Failed to send password reset success email to ${userEmail}:`, error);
    throw error;
  }
};

export const sendPasswordChangeSuccessEmail = async (userEmail, userName, changeMethod = 'manual_change') => {
  const emailData = {
    to: userEmail,
    subject: "🔒 Password Successfully Changed - UrbanSetu",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Change Successful</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">🔒 Password Changed Successfully</h1>
            <p style="color: #e2e8f0; margin: 10px 0 0; font-size: 16px;">Your account security has been updated</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3); position: relative;">
                <div style="position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; opacity: 0.2;"></div>
                <span style="color: #ffffff; font-size: 36px; font-weight: bold; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">✓</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">Password Successfully Changed</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">Hello ${userName}, your password has been successfully changed and your account remains secure.</p>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 18px; font-weight: 600;">Change Details</h3>
              <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Account:</span>
                  <span style="color: #1f2937; font-weight: 600;">${userEmail}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Change Method:</span>
                  <span style="color: #1f2937; font-weight: 600;">${changeMethod === 'manual_change' ? 'Manual Change' : 'Profile Update'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                  <span style="color: #6b7280; font-weight: 500;">Change Time:</span>
                  <span style="color: #1f2937; font-weight: 600;">${formatIndiaTime(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })}</span>
                </div>
              </div>
            </div>
            
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
              <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <span style="color: #f59e0b; font-size: 20px; margin-right: 10px;">⚠️</span>
                <h4 style="color: #92400e; margin: 0; font-size: 16px; font-weight: 600;">Security Notice</h4>
              </div>
              <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.5;">
                If you did not make this password change, please contact our support team immediately. 
                Your account security is our top priority.
              </p>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/signin" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; transition: all 0.3s ease;">
                Sign In to Your Account
              </a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; margin: 0 0 15px; font-size: 14px;">
              This email was sent to ${userEmail} because a password change was made to your UrbanSetu account.
            </p>
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await sendEmailWithRetry(emailData);
    console.log(`✅ Password change success email sent to: ${userEmail}`);
  } catch (error) {
    console.error(`❌ Failed to send password change success email to ${userEmail}:`, error);
    throw error;
  }
};

// Welcome Email for New Account
export const sendWelcomeEmail = async (email, userDetails) => {
  try {
    const {
      username,
      role,
      mobileNumber,
      address,
      adminApprovalStatus
    } = userDetails;

    const subject = `Welcome to UrbanSetu, ${username}!`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to UrbanSetu</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Welcome to UrbanSetu!</h1>
            <p style="color: #e2e8f0; margin: 10px 0 0; font-size: 16px;">Your account has been successfully created</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3); position: relative;">
                <div style="position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; opacity: 0.2;"></div>
                <span style="color: #ffffff; font-size: 36px; font-weight: bold; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">✓</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">Account Created Successfully!</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">Hello ${username}, welcome to UrbanSetu! Your account has been successfully created and you're ready to start your real estate journey.</p>
            </div>

            <!-- Starter Bonus Notice -->
            <div style="background-color: #fef3c7; border: 1px dashed #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 30px; text-align: center;">
              <span style="font-size: 24px;">🎁</span>
              <h3 style="color: #92400e; margin: 10px 0 5px; font-size: 18px; font-weight: 700;">Claim Your Starter Bonus!</h3>
              <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.5;">
                Complete your profile details to unlock your first <strong>20 SetuCoins</strong> reward instantly.
              </p>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 18px; font-weight: 600;">Account Details</h3>
              <div style="display: grid; gap: 10px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Full Name:</span>
                  <span style="color: #1f2937; font-weight: 600;">${username}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Email:</span>
                  <span style="color: #1f2937; font-weight: 600;">${email}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Mobile Number:</span>
                  <span style="color: #1f2937; font-weight: 600;">${mobileNumber}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Role:</span>
                  <span style="color: #1f2937; font-weight: 600;">${role === 'admin' ? 'Administrator' : 'User'}</span>
                </div>
                ${address ? `
                  <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                    <span style="color: #6b7280; font-weight: 500;">Address:</span>
                    <span style="color: #1f2937; font-weight: 600;">${address}</span>
                  </div>
                ` : ''}
              </div>
            </div>
            
            ${role === 'admin' ? `
              <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 25px;">
                <h3 style="color: #92400e; margin: 0 0 10px; font-size: 16px;">Admin Account Status</h3>
                <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.5;">
                  Your admin account has been created and is currently pending approval. An existing administrator will review and approve your account. You'll receive a notification email once your account is approved.
                </p>
              </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; align-items: center;">
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/sign-in" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3); transition: all 0.3s ease; margin: 5px;">
                  🔑 Sign In to Your Account
                </a>
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/search" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3); transition: all 0.3s ease; margin: 5px;">
                  🏠 Browse Properties
                </a>
              </div>
            </div>
            
            <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <h3 style="color: #1e40af; margin: 0 0 10px; font-size: 16px;">What's Next?</h3>
              <ul style="color: #1e40af; margin: 0; font-size: 14px; line-height: 1.6; padding-left: 20px;">
                <li>Sign in to your account to access all features</li>
                <li>Complete your profile with additional information</li>
                <li>Browse and search for properties that match your needs</li>
                <li>${role === 'admin' ? 'Wait for admin approval to access administrative features' : 'Start your real estate journey with us'}</li>
              </ul>
            </div>

            <!-- What is UrbanSetu Section -->
            <div style="margin-top: 30px; background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); padding: 25px; border-radius: 12px; border: 1px solid #bbf7d0;">
              <h3 style="color: #065f46; margin: 0 0 15px; font-size: 18px; font-weight: 700; text-align: center;">🏡 What is UrbanSetu?</h3>
              <p style="color: #047857; font-size: 14px; line-height: 1.7; margin: 0 0 15px;">
                UrbanSetu is an <strong>AI-Powered Smart Real Estate Platform</strong> — a next-gen ecosystem built to bridge the gap between people and property. From intelligent property discovery to secure transactions, UrbanSetu brings enterprise-level technology to your real estate journey.
              </p>
              <div style="display: grid; gap: 10px;">
                <div style="background: #ffffff; padding: 12px 15px; border-radius: 8px; border-left: 3px solid #10b981;">
                  <strong style="color: #065f46; font-size: 13px;">🏠 Smart Discovery</strong>
                  <p style="color: #047857; font-size: 13px; margin: 4px 0 0; line-height: 1.5;">AI-powered search (Llama 3.3), Route Planner, ESG Analytics, property management, and bookings.</p>
                </div>
                <div style="background: #ffffff; padding: 12px 15px; border-radius: 8px; border-left: 3px solid #f59e0b;">
                  <strong style="color: #92400e; font-size: 13px;">💰 Fintech Suite</strong>
                  <p style="color: #78350f; font-size: 13px; margin: 4px 0 0; line-height: 1.5;">Rent Wallet, ROI Calculators, Digital Rental Loans, and Monthly Payment Gateways.</p>
                </div>
                <div style="background: #ffffff; padding: 12px 15px; border-radius: 8px; border-left: 3px solid #8b5cf6;">
                  <strong style="color: #5b21b6; font-size: 13px;">🎮 Gamified Loyalty</strong>
                  <p style="color: #6d28d9; font-size: 13px; margin: 4px 0 0; line-height: 1.5;">Earn SetuCoins, unlock Badges, and climb Leaderboards through community interactions.</p>
                </div>
                <div style="background: #ffffff; padding: 12px 15px; border-radius: 8px; border-left: 3px solid #ef4444;">
                  <strong style="color: #991b1b; font-size: 13px;">🛡️ Fortified Security</strong>
                  <p style="color: #b91c1c; font-size: 13px; margin: 4px 0 0; line-height: 1.5;">Real-time session management, device audits, fraud detection, CSRF protection, and force logout.</p>
                </div>
                <div style="background: #ffffff; padding: 12px 15px; border-radius: 8px; border-left: 3px solid #3b82f6;">
                  <strong style="color: #1e40af; font-size: 13px;">🤝 Signature Features</strong>
                  <p style="color: #1d4ed8; font-size: 13px; margin: 4px 0 0; line-height: 1.5;">RentLock (fixed-rent digital contracts) and SaleLock (token-based property blocking).</p>
                </div>
                <div style="background: #ffffff; padding: 12px 15px; border-radius: 8px; border-left: 3px solid #06b6d4;">
                  <strong style="color: #155e75; font-size: 13px;">🗣️ Community & Support</strong>
                  <p style="color: #0e7490; font-size: 13px; margin: 4px 0 0; line-height: 1.5;">User blogs, community forums, 24/7 AI chatbot, WhatsApp-style real-time messaging, and Help Center.</p>
                </div>
                <div style="background: #ffffff; padding: 12px 15px; border-radius: 8px; border-left: 3px solid #ec4899;">
                  <strong style="color: #9d174d; font-size: 13px;">🔔 Smart Notifications</strong>
                  <p style="color: #be185d; font-size: 13px; margin: 4px 0 0; line-height: 1.5;">Omni-channel notifications, watchlist alerts, and automated email reports.</p>
                </div>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                If you have any questions, please contact our support team.
              </p>
              <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0;">
                This is an automated message. Please do not reply to this email.
              </p>
              <p style="margin: 12px 0 0; font-size: 12px;">
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/terms" style="color: #6b7280; text-decoration: underline;">Terms of Use</a>
                &nbsp;·&nbsp;
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/privacy" style="color: #6b7280; text-decoration: underline;">Privacy Policy</a>
              </p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">
                © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return createErrorResponse(error, 'welcome_email');
  }
};

// Auto-initialize email service
initializeEmailService().catch(error => {
  console.error('Email service auto-initialization failed:', error);
});

// Account Deletion Email with Revocation Link
export const sendAccountDeletionEmail = async (email, userDetails, revocationLink) => {
  try {
    const { username, role } = userDetails;
    const token = revocationLink.split('/').pop();

    const subject = `Account Deleted - UrbanSetu`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Deleted - UrbanSetu</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Account Deleted</h1>
            <p style="color: #fecaca; margin: 10px 0 0; font-size: 16px;">Your UrbanSetu account has been successfully deleted</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(239, 68, 68, 0.3); position: relative;">
                <div style="position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 50%; opacity: 0.2;"></div>
                <span style="color: #ffffff; font-size: 36px; font-weight: bold; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">✓</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">Account Successfully Deleted</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">Your account has been successfully deleted from UrbanSetu. We appreciate the time you spent with us and hope to serve you again in the future.</p>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 18px; font-weight: 600;">Account Details</h3>
              <div style="display: grid; gap: 10px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Username:</span>
                  <span style="color: #1f2937; font-weight: 600;">${username}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Email:</span>
                  <span style="color: #1f2937; font-weight: 600;">${email}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                  <span style="color: #6b7280; font-weight: 500;">Role:</span>
                  <span style="color: #1f2937; font-weight: 600;">${role === 'admin' ? 'Administrator' : 'User'}</span>
                </div>
              </div>
            </div>
            
            <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 25px;">
              <h3 style="color: #92400e; margin: 0 0 10px; font-size: 16px;">🔄 Change Your Mind?</h3>
              <p style="color: #92400e; margin: 0 0 15px; font-size: 14px; line-height: 1.5;">
                If you change your mind within the next 30 days, you can restore your account by clicking the link below. This will reactivate your account with all your previous data intact.
              </p>
              <div style="text-align: center;">
                <a href="${revocationLink}" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(245, 158, 11, 0.3); transition: all 0.3s ease;">
                  🔄 Restore My Account
                </a>
              </div>
              
              <div style="margin-top: 20px; border-top: 1px dashed #f59e0b; padding-top: 15px;">
                <p style="color: #92400e; margin: 0 0 10px; font-size: 13px;">If the button doesn't work, copy this token:</p>
                <div style="background: rgba(255,255,255,0.6); padding: 10px; border-radius: 6px; font-family: monospace; font-size: 14px; color: #78350f; border: 1px solid #fcd34d; user-select: all; word-break: break-all;">
                  ${token}
                </div>
                <p style="color: #92400e; margin: 10px 0 0; font-size: 13px;">And paste it on the <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/restore-account/pastetokenfromemail" style="color: #92400e; text-decoration: underline;">restoration page</a>.</p>
              </div>
              <p style="color: #92400e; margin: 15px 0 0; font-size: 12px; text-align: center;">
                This link will expire in 30 days
              </p>
            </div>
            
            <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <h3 style="color: #1e40af; margin: 0 0 10px; font-size: 16px;">What Happens Next?</h3>
              <ul style="color: #1e40af; margin: 0; font-size: 14px; line-height: 1.6; padding-left: 20px;">
                <li>Your account data has been moved to our deleted accounts archive</li>
                <li>You can restore your account within 30 days using the link above</li>
                <li>After 30 days, your account will be permanently deleted</li>
                <li>You can create a new account anytime by visiting our signup page</li>
              </ul>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                Thank you for being part of the UrbanSetu community. We value your time with us and look forward to the opportunity to serve you again.
              </p>
              <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0;">
                This is an automated message. Please do not reply to this email.
              </p>
              <p style="color: #9ca3af; margin: 15px 0 0; font-size: 12px;">
                © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending account deletion email:', error);
    return createErrorResponse(error, 'account_deletion_email');
  }
};

/**
 * Sends a confirmation email that a previous deleted account has been permanently purged
 * to make way for a new signup with the same email.
 */
export const sendPermanentPurgeEmail = async (email, username, newSignupDate) => {
  try {
    const subject = `Account Permanently Deleted - UrbanSetu`;
    const formattedDate = new Date(newSignupDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Permanently Deleted - UrbanSetu</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-top: 20px;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 40px 30px; text-align: center;">
            <div style="width: 70px; height: 70px; background: rgba(255,255,255,0.1); border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
              <span style="font-size: 35px;">🗑️</span>
            </div>
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Account Data Purged</h1>
            <p style="color: #cbd5e1; margin: 10px 0 0; font-size: 15px;">Permanent deletion confirmation</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              Hello <strong>${username}</strong>,
            </p>
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              As per your request during the new account creation process, your previous UrbanSetu account and all its associated data have been <strong>permanently deleted</strong>.
            </p>
            
            <div style="background-color: #f1f5f9; padding: 25px; border-radius: 12px; margin-bottom: 30px;">
              <h3 style="color: #0f172a; margin: 0 0 15px; font-size: 17px; font-weight: 600;">Deletion Summary</h3>
              <ul style="color: #475569; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                <li><strong>Account Email:</strong> ${email}</li>
                <li><strong>Purge Date:</strong> ${formattedDate}</li>
                <li><strong>Action:</strong> Permanent data removal</li>
                <li><strong>Reason:</strong> New account creation conflict resolution</li>
              </ul>
            </div>
            
            <div style="background-color: #f0fdf4; border: 1px solid #dcfce7; padding: 20px; border-radius: 12px; margin-bottom: 25px;">
              <h3 style="color: #166534; margin: 0 0 10px; font-size: 16px; display: flex; align-items: center;">
                <span style="margin-right: 8px;">✨</span> New Journey Started
              </h3>
              <p style="color: #166534; margin: 0; font-size: 14px; line-height: 1.5;">
                Your new account has been successfully initialized. You can now sign in using your new credentials and start fresh with UrbanSetu.
              </p>
            </div>
            
            <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-bottom: 30px; font-style: italic;">
              Note: This action is irreversible. All listings, appointments, and personal preferences from the old account are no longer accessible.
            </p>
            
            <!-- Footer -->
            <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 30px;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
              </p>
              <p style="color: #94a3b8; font-size: 11px; margin: 5px 0 0;">
                This is an automated notification.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending permanent purge email:', error);
    return createErrorResponse(error, 'permanent_purge_email');
  }
};

// Send Move-In Checklist Approved Email
export const sendMoveInChecklistApprovedEmail = async (tenantEmail, landlordEmail, tenantName, landlordName, propertyAddress, checklistId, contractId) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: [tenantEmail, landlordEmail].join(','),
    subject: 'Move-In Checklist Approved - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Move-In Checklist Approved</p>
          </div>
          
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #16a34a;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Checklist Approved!</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              The Move-In Checklist for <strong>${propertyAddress}</strong> has been successfully approved by both the Tenant and the Landlord.
            </p>
            
            <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #e5e7eb;">
              <p style="margin: 5px 0; color: #374151;"><strong>Tenant:</strong> ${tenantName}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Landlord:</strong> ${landlordName}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Checklist ID:</strong> ${checklistId}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Approval Date:</strong> ${formatIndiaTime()}</p>
            </div>
            
            <p style="color: #6b7280; margin: 15px 0 0 0; font-size: 14px;">
              Both parties have verified the condition of the property. This document serves as a reference for the move-in state.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${clientBaseUrl}/user/rental-contracts?contractId=${contractId}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Contract & Checklist</a>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'move_in_checklist_approved') :
      createErrorResponse(new Error(result.error), 'move_in_checklist_approved');
  } catch (error) {
    return createErrorResponse(error, 'move_in_checklist_approved');
  }
};

// Send Move-Out Checklist Approved Email
export const sendMoveOutChecklistApprovedEmail = async (tenantEmail, landlordEmail, tenantName, landlordName, propertyAddress, checklistId, contractId) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: [tenantEmail, landlordEmail].join(','),
    subject: 'Move-Out Checklist Approved - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Move-Out Checklist Approved</p>
          </div>
          
          <div style="background-color: #fff1f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #e11d48;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Checklist Approved!</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              The Move-Out Checklist for <strong>${propertyAddress}</strong> has been successfully approved by both the Tenant and the Landlord.
            </p>
            
            <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #e5e7eb;">
              <p style="margin: 5px 0; color: #374151;"><strong>Tenant:</strong> ${tenantName}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Landlord:</strong> ${landlordName}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Checklist ID:</strong> ${checklistId}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Approval Date:</strong> ${formatIndiaTime()}</p>
            </div>
            
            <p style="color: #6b7280; margin: 15px 0 0 0; font-size: 14px;">
              This confirms the final condition of the property and any damages assessed.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${clientBaseUrl}/user/rental-contracts?contractId=${contractId}" style="display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Contract & Checklist</a>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'move_out_checklist_approved') :
      createErrorResponse(new Error(result.error), 'move_out_checklist_approved');
  } catch (error) {
    return createErrorResponse(error, 'move_out_checklist_approved');
  }
};

// Contact Support Confirmation Email
export const sendContactSupportConfirmationEmail = async (email, ticketId, message, senderName) => {
  try {
    const subject = `📬 We've Received Your Support Request - Ticket #${ticketId}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Support Request Received</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">📬 Support Request Received!</h1>
            <p style="color: #e2e8f0; margin: 10px 0 0; font-size: 16px;">We've got your message and we're here to help</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(59, 130, 246, 0.3); position: relative;">
                <div style="position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 50%; opacity: 0.2;"></div>
                <span style="color: #ffffff; font-size: 36px; font-weight: bold; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">✓</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">Thank You for Contacting Us!</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">Hi ${senderName}, your support request has been successfully received. Our team will review your message and get back to you within 24 hours.</p>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 18px; font-weight: 600;">Your Ticket Information</h3>
              <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Ticket ID:</span>
                  <span style="color: #1f2937; font-weight: 600;">#${ticketId}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Sender:</span>
                  <span style="color: #1f2937; font-weight: 600;">${senderName}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Email:</span>
                  <span style="color: #1f2937; font-weight: 600;">${email}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                  <span style="color: #6b7280; font-weight: 500;">Received:</span>
                  <span style="color: #1f2937; font-weight: 600;">${formatIndiaTime()}</span>
                </div>
              </div>
            </div>
            
            <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 30px;">
              <h3 style="color: #1e40af; margin: 0 0 10px; font-size: 16px;">Your Message</h3>
              <p style="color: #1e40af; margin: 0; font-size: 14px; line-height: 1.6; word-wrap: break-word;">${message.replace(/\n/g, '<br>')}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3); transition: all 0.3s ease;">
                📧 Contact Support
              </a>
            </div>
            
            <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b;">
              <h3 style="color: #92400e; margin: 0 0 10px; font-size: 16px;">💡 What Happens Next?</h3>
              <ul style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.6; padding-left: 20px;">
                <li>Our support team is reviewing your request</li>
                <li>You'll receive a response email within 24 hours</li>
                <li>Keep your ticket ID (#${ticketId}) handy for reference</li>
                <li>Check your inbox and spam folder for updates</li>
              </ul>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                Thank you for choosing UrbanSetu. We value your feedback and concerns.
              </p>
              <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0;">
                This is an automated message. Please do not reply to this email.
              </p>
              <p style="color: #9ca3af; margin: 15px 0 0; font-size: 12px;">
                © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending contact support confirmation email:', error);
    return createErrorResponse(error, 'contact_support_confirmation');
  }
};

// Contact Support Reply Email (Admin Response)
export const sendContactSupportReplyEmail = async (email, ticketId, senderName, adminReply) => {
  try {
    const subject = `📨 You Have a Reply from UrbanSetu Support - Ticket #${ticketId}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Support Reply</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">📨 Support Team Reply</h1>
            <p style="color: #e2e8f0; margin: 10px 0 0; font-size: 16px;">We've responded to your support request</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3); position: relative;">
                <div style="position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; opacity: 0.2;"></div>
                <span style="color: #ffffff; font-size: 36px; font-weight: bold; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">✓</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">We've Got Your Back!</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">Hi ${senderName}, our support team has reviewed your request and provided a response below.</p>
            </div>
            
            <div style="background-color: #f0fdf4; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #10b981;">
              <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 18px; font-weight: 600;">Support Team Response</h3>
              <div style="background-color: white; padding: 15px; border-radius: 6px; border: 1px solid #d1fae5;">
                <p style="color: #1f2937; margin: 0; font-size: 14px; line-height: 1.6; word-wrap: break-word;">${adminReply.replace(/\n/g, '<br>')}</p>
              </div>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 16px; font-weight: 600;">Reference Information</h3>
              <div style="display: grid; gap: 10px;">
                <div style="display: flex; justify-content: space-between; padding: 6px 0;">
                  <span style="color: #6b7280; font-weight: 500;">Ticket ID:</span>
                  <span style="color: #1f2937; font-weight: 600;">#${ticketId}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 6px 0;">
                  <span style="color: #6b7280; font-weight: 500;">Response Date:</span>
                  <span style="color: #1f2937; font-weight: 600;">${formatIndiaTime()}</span>
                </div>
              </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3); transition: all 0.3s ease;">
                📧 View All Messages
              </a>
            </div>
            
            <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <h3 style="color: #1e40af; margin: 0 0 10px; font-size: 16px;">💡 Need More Help?</h3>
              <ul style="color: #1e40af; margin: 0; font-size: 14px; line-height: 1.6; padding-left: 20px;">
                <li><a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact" style="color: #3b82f6; text-decoration: none;">Reply to this message</a> - Continue the conversation</li>
                <li><a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/faqs" style="color: #3b82f6; text-decoration: none;">Check FAQs</a> - Browse common questions</li>
                <li>Save your Ticket ID (#${ticketId}) for future reference</li>
              </ul>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                We appreciate your patience and are committed to providing excellent support.
              </p>
              <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0;">
                This is an automated message. Please do not reply to this email.
              </p>
              <p style="color: #9ca3af; margin: 15px 0 0; font-size: 12px;">
                © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending contact support reply email:', error);
    return createErrorResponse(error, 'contact_support_reply');
  }
};

// Account Activation Email
export const sendAccountActivationEmail = async (email, userDetails) => {
  try {
    const { username, role } = userDetails;

    const subject = `Account Restored - Welcome Back to UrbanSetu!`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Restored - UrbanSetu</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Welcome Back!</h1>
            <p style="color: #e2e8f0; margin: 10px 0 0; font-size: 16px;">Your UrbanSetu account has been successfully restored</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3); position: relative;">
                <div style="position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; opacity: 0.2;"></div>
                <span style="color: #ffffff; font-size: 36px; font-weight: bold; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">✓</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">Account Restored Successfully!</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">Hello ${username}, your account has been successfully restored with all your previous data intact!</p>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 18px; font-weight: 600;">Account Details</h3>
              <div style="display: grid; gap: 10px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Username:</span>
                  <span style="color: #1f2937; font-weight: 600;">${username}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Email:</span>
                  <span style="color: #1f2937; font-weight: 600;">${email}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                  <span style="color: #6b7280; font-weight: 500;">Role:</span>
                  <span style="color: #1f2937; font-weight: 600;">${role === 'admin' ? 'Administrator' : 'User'}</span>
                </div>
              </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; align-items: center;">
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/sign-in" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3); transition: all 0.3s ease; margin: 5px;">
                  🔑 Sign In to Your Account
                </a>
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/search" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3); transition: all 0.3s ease; margin: 5px;">
                  🏠 Browse Properties
                </a>
              </div>
            </div>
            
            <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <h3 style="color: #1e40af; margin: 0 0 10px; font-size: 16px;">What's Next?</h3>
              <ul style="color: #1e40af; margin: 0; font-size: 14px; line-height: 1.6; padding-left: 20px;">
                <li>Sign in to your account to access all your previous data</li>
                <li>Your profile, preferences, and settings have been restored</li>
                <li>Continue browsing and searching for properties</li>
                <li>${role === 'admin' ? 'Access your administrative features' : 'Enjoy all the features as before'}</li>
              </ul>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                Welcome back to UrbanSetu! We're glad you decided to return.
              </p>
              <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0;">
                This is an automated message. Please do not reply to this email.
              </p>
              <p style="color: #9ca3af; margin: 15px 0 0; font-size: 12px;">
                © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending account activation email:', error);
    return createErrorResponse(error, 'account_activation_email');
  }
};

// Appointment Reminder Email
export const sendAppointmentReminderEmail = async (email, appointmentDetails, userRole) => {
  try {
    const {
      propertyName,
      propertyDescription,
      date,
      time,
      buyerName,
      buyerEmail,
      sellerName,
      sellerEmail,
      purpose,
      listingId
    } = appointmentDetails;

    const appointmentDate = new Date(date);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const isBuyer = userRole === 'buyer';
    const otherPartyName = isBuyer ? sellerName : buyerName;
    const otherPartyEmail = isBuyer ? sellerEmail : buyerEmail;
    const isRent = purpose === 'rent';

    const headerTitle = isRent ? "Check-in Reminder" : "Property Visit Reminder";
    const headerSubtitle = isRent ? "Your check-in is tomorrow!" : "Your property visit is tomorrow!";
    const bodyTitle = isRent ? "Check-in Tomorrow!" : "Visit Tomorrow!";
    const bodyText = isRent
      ? `This is a friendly reminder about your upcoming check-in for the property.`
      : `This is a friendly reminder about your upcoming property ${isBuyer ? 'viewing' : 'showing'} appointment.`;
    const dateLabel = isRent ? "Check-in Date:" : "Visit Date:";
    const contextEmoji = isRent ? "🔑" : "🏠";

    const subject = isRent
      ? `Check-in Reminder - ${propertyName} - Tomorrow at ${time}`
      : `Visit Reminder - ${propertyName} - Tomorrow at ${time}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${headerTitle} - UrbanSetu</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">⏰ ${headerTitle}</h1>
            <p style="color: #fef3c7; margin: 10px 0 0; font-size: 16px;">${headerSubtitle}</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(245, 158, 11, 0.3); position: relative;">
                <div style="position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 50%; opacity: 0.2;"></div>
                <span style="color: #ffffff; font-size: 36px; font-weight: bold; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">${contextEmoji}</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">${bodyTitle}</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">
                ${bodyText}
              </p>
            </div>
            
            <!-- Appointment Details -->
            <div style="background-color: #f3f4f6; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 18px; font-weight: 600;">Appointment Details</h3>
              <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Property:</span>
                  <span style="color: #1f2937; font-weight: 600;">${propertyName}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">${dateLabel}</span>
                  <span style="color: #1f2937; font-weight: 600;">${formattedDate}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Time:</span>
                  <span style="color: #1f2937; font-weight: 600;">${time}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Purpose:</span>
                  <span style="color: #1f2937; font-weight: 600;">${purpose === 'buy' ? 'Purchase' : 'Rental'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0;">
                  <span style="color: #6b7280; font-weight: 500;">Your Role:</span>
                  <span style="color: #1f2937; font-weight: 600;">${isBuyer ? 'Buyer' : 'Seller'}</span>
                </div>
              </div>
            </div>

            <!-- Property Description -->
            <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 25px;">
              <h3 style="color: #1e40af; margin: 0 0 10px; font-size: 16px;">Property Description</h3>
              <p style="color: #1e40af; margin: 0; font-size: 14px; line-height: 1.6;">${propertyDescription}</p>
            </div>

            <!-- Contact Information -->
            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 25px;">
              <h3 style="color: #065f46; margin: 0 0 10px; font-size: 16px;">Contact Information</h3>
              <div style="display: grid; gap: 8px;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #047857; font-weight: 500;">${isBuyer ? 'Seller' : 'Buyer'}:</span>
                  <span style="color: #065f46; font-weight: 600;">${otherPartyName}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #047857; font-weight: 500;">Email:</span>
                  <span style="color: #065f46; font-weight: 600;">${otherPartyEmail}</span>
                </div>
              </div>
            </div>

            <!-- Important Notes -->
            <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 25px;">
              <h3 style="color: #92400e; margin: 0 0 10px; font-size: 16px;">Important Reminders</h3>
              <ul style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.6; padding-left: 20px;">
                <li>Please arrive on time for your appointment</li>
                <li>Bring a valid ID for verification</li>
                <li>If you need to reschedule, contact the ${isBuyer ? 'seller' : 'buyer'} as soon as possible</li>
                <li>Check the property listing for any specific requirements or instructions</li>
                <li>If you have any questions, use the chat feature in your appointment</li>
              </ul>
            </div>
            
            <!-- CTA Buttons -->
            <div style="text-align: center; margin: 30px 0; padding: 0 10px;">
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/myappointments" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; margin: 10px; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
                  📅 View Appointment Details
                </a>
                ${listingId ? `
                  <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/listing/${listingId}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; margin: 10px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">
                    🏠 View Property Listing
                  </a>
                ` : ''}
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                This is an automated reminder. Please do not reply to this email.
              </p>
              <p style="color: #9ca3af; margin: 15px 0 0; font-size: 12px;">
                © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
`;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending appointment reminder email:', error);
    return createErrorResponse(error, 'appointment_reminder_email');
  }
};

// Price Drop Alert Email
export const sendPriceDropAlertEmail = async (email, priceDropDetails) => {
  try {
    const {
      propertyName,
      propertyDescription,
      propertyImage,
      originalPrice,
      currentPrice,
      dropAmount,
      dropPercentage,
      propertyType,
      propertyLocation,
      listingId,
      watchlistDate
    } = priceDropDetails;

    const subject = `💰 Price Drop Alert - ${propertyName} - Save ₹${dropAmount.toLocaleString()}!`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Price Drop Alert - UrbanSetu</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">💰 Price Drop Alert!</h1>
            <p style="color: #d1fae5; margin: 10px 0 0; font-size: 16px;">Great news! A property you're watching has dropped in price</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3); position: relative;">
                <div style="position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; opacity: 0.2;"></div>
                <span style="color: #ffffff; font-size: 36px; font-weight: bold; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">💰</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">Price Dropped!</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">
                The property you're watching has dropped in price. Don't miss this opportunity!
              </p>
            </div>
            
            <!-- Property Image -->
            ${propertyImage ? `
              <div style="text-align: center; margin-bottom: 30px;">
                <img src="${propertyImage}" alt="${propertyName}" style="max-width: 100%; height: 200px; object-fit: cover; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" />
              </div>
            ` : ''}
            
            <!-- Property Details -->
            <div style="background-color: #f3f4f6; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 18px; font-weight: 600;">Property Details</h3>
              <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Property Name:</span>
                  <span style="color: #1f2937; font-weight: 600;">${propertyName}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Type:</span>
                  <span style="color: #1f2937; font-weight: 600;">${propertyType}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Location:</span>
                  <span style="color: #1f2937; font-weight: 600;">${propertyLocation}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0;">
                  <span style="color: #6b7280; font-weight: 500;">Added to Watchlist:</span>
                  <span style="color: #1f2937; font-weight: 600;">${new Date(watchlistDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              </div>
            </div>

            <!-- Price Drop Details -->
            <div style="background-color: #f0fdf4; padding: 25px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 30px;">
              <h3 style="color: #065f46; margin: 0 0 15px; font-size: 18px; font-weight: 600;">💰 Price Drop Details</h3>
              <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #bbf7d0;">
                  <span style="color: #047857; font-weight: 500;">Original Price:</span>
                  <span style="color: #065f46; font-weight: 600; text-decoration: line-through;">₹${originalPrice.toLocaleString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #bbf7d0;">
                  <span style="color: #047857; font-weight: 500;">Current Price:</span>
                  <span style="color: #065f46; font-weight: 600; font-size: 18px;">₹${currentPrice.toLocaleString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #bbf7d0;">
                  <span style="color: #047857; font-weight: 500;">You Save:</span>
                  <span style="color: #10b981; font-weight: 700; font-size: 18px;">₹${dropAmount.toLocaleString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0;">
                  <span style="color: #047857; font-weight: 500;">Drop Percentage:</span>
                  <span style="color: #10b981; font-weight: 700; font-size: 18px;">${dropPercentage}%</span>
                </div>
              </div>
            </div>

            <!-- Property Description -->
            <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 25px;">
              <h3 style="color: #1e40af; margin: 0 0 10px; font-size: 16px;">Property Description</h3>
              <p style="color: #1e40af; margin: 0; font-size: 14px; line-height: 1.6;">${propertyDescription}</p>
            </div>

            <!-- Urgency Message -->
            <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 25px;">
              <h3 style="color: #92400e; margin: 0 0 10px; font-size: 16px;">⚡ Act Fast!</h3>
              <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.6;">
                Price drops like this don't last long! Other buyers might be interested too. 
                Don't miss out on this great opportunity to save money on your dream property.
              </p>
            </div>
            
            <!-- CTA Buttons -->
            <div style="text-align: center; margin: 30px 0; padding: 0 10px;">
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/listing/${listingId}" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; margin: 10px; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
                  View Property Details
                </a>
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/watchlist" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; margin: 10px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">
                  Go to Watchlist
                </a>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                This is an automated price drop alert. You can manage your watchlist preferences in your account settings.
              </p>
              <p style="color: #9ca3af; margin: 15px 0 0; font-size: 12px;">
                © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
`;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending price drop alert email:', error);
    return createErrorResponse(error, 'price_drop_alert_email');
  }
};

// 15-Day Account Deletion Reminder Email
export const sendAccountDeletionReminderEmail = async (email, userDetails, revocationLink, daysLeft) => {
  try {
    const { username, role } = userDetails;

    const subject = `Reminder: Restore Your UrbanSetu Account (${daysLeft} days left)`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Restoration Reminder - UrbanSetu</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Account Restoration Reminder</h1>
            <p style="color: #fef3c7; margin: 10px 0 0; font-size: 16px;">You still have ${daysLeft} days to restore your account</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(245, 158, 11, 0.3); position: relative;">
                <div style="position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 50%; opacity: 0.2;"></div>
                <span style="color: #ffffff; font-size: 36px; font-weight: bold; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">⏰</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">Don't Lose Your Account!</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">Hello ${username}, you still have <strong style="color: #f59e0b;">${daysLeft} days</strong> to restore your UrbanSetu account before it's permanently deleted.</p>
            </div>
            
            <div style="background-color: #fef3c7; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #f59e0b;">
              <h3 style="color: #92400e; margin: 0 0 15px; font-size: 18px; font-weight: 600;">⚠️ Important Notice</h3>
              <p style="color: #92400e; margin: 0 0 10px; font-size: 14px; line-height: 1.6;">
                After ${daysLeft} days, your account and all associated data will be permanently removed, including:
              </p>
              <ul style="color: #92400e; margin: 10px 0; padding-left: 20px; font-size: 14px;">
                <li>Your property wishlist and watchlist</li>
                <li>All your reviews and ratings</li>
                <li>Appointment history and messages</li>
                <li>Account preferences and settings</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${revocationLink}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.3s ease;">
                Restore My Account Now
              </a>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #1f2937; margin: 0 0 10px; font-size: 16px; font-weight: 600;">Account Details</h3>
              <div style="display: grid; gap: 8px;">
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Username:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${username}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Email:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${email}</span>
                </div>
              </div>
            </div>
            
            <div style="text-align: center; color: #6b7280; font-size: 14px; line-height: 1.6;">
              <p style="margin: 0 0 10px;">If you don't want to restore your account, you can ignore this email.</p>
              <p style="margin: 0;">This is an automated reminder. Please do not reply to this email.</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending account deletion reminder email:', error);
    return createErrorResponse(error, 'account_deletion_reminder_email');
  }
};

// Final Account Deletion Warning Email (1-2 days before purge)
export const sendAccountDeletionFinalWarningEmail = async (email, userDetails, revocationLink, daysLeft) => {
  try {
    const { username, role } = userDetails;

    const subject = `FINAL WARNING: Your UrbanSetu Account Will Be Deleted in ${daysLeft} Day${daysLeft === 1 ? '' : 's'}!`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Final Warning - Account Deletion - UrbanSetu</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">FINAL WARNING</h1>
            <p style="color: #fecaca; margin: 10px 0 0; font-size: 16px;">Your account will be permanently deleted in ${daysLeft} day${daysLeft === 1 ? '' : 's'}!</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #dc2626, #b91c1c); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(220, 38, 38, 0.3); position: relative;">
                <div style="position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; background: linear-gradient(135deg, #dc2626, #b91c1c); border-radius: 50%; opacity: 0.2;"></div>
                <span style="color: #ffffff; font-size: 36px; font-weight: bold; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">🚨</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">Last Chance to Restore Your Account!</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">Hello ${username}, this is your <strong style="color: #dc2626;">FINAL WARNING</strong>. Your UrbanSetu account will be permanently deleted in <strong style="color: #dc2626;">${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>!</p>
            </div>
            
            <div style="background-color: #fef2f2; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #dc2626;">
              <h3 style="color: #991b1b; margin: 0 0 15px; font-size: 18px; font-weight: 600;">⚠️ URGENT: Data Will Be Lost Forever</h3>
              <p style="color: #991b1b; margin: 0 0 10px; font-size: 14px; line-height: 1.6;">
                After ${daysLeft} day${daysLeft === 1 ? '' : 's'}, the following data will be permanently deleted and cannot be recovered:
              </p>
              <ul style="color: #991b1b; margin: 10px 0; padding-left: 20px; font-size: 14px;">
                <li><strong>Property Wishlist & Watchlist</strong> - All your saved properties</li>
                <li><strong>Reviews & Ratings</strong> - All your property reviews</li>
                <li><strong>Appointment History</strong> - All your booking records</li>
                <li><strong>Messages & Conversations</strong> - All chat history</li>
                <li><strong>Account Settings</strong> - All preferences and configurations</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${revocationLink}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; padding: 18px 35px; border-radius: 8px; font-weight: 700; font-size: 18px; box-shadow: 0 6px 16px rgba(220, 38, 38, 0.4); transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px;">
                RESTORE ACCOUNT NOW
              </a>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #1f2937; margin: 0 0 10px; font-size: 16px; font-weight: 600;">Account Details</h3>
              <div style="display: grid; gap: 8px;">
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Username:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${username}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Email:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${email}</span>
                </div>
              </div>
            </div>
            
            <div style="text-align: center; color: #6b7280; font-size: 14px; line-height: 1.6;">
              <p style="margin: 0 0 10px; font-weight: 600; color: #dc2626;">This is your last chance to restore your account!</p>
              <p style="margin: 0;">If you don't restore your account now, it will be permanently deleted and cannot be recovered.</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending account deletion final warning email:', error);
    return createErrorResponse(error, 'account_deletion_final_warning_email');
  }
};

/**
 * Send admin approval email to newly approved admin
 */
export const sendAdminApprovalEmail = async (email, adminDetails) => {
  try {
    const { username, role, approvedBy, approvedAt } = adminDetails;

    const subject = `🎉 Welcome! Your Admin Account Has Been Approved - UrbanSetu`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Account Approved - UrbanSetu</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">🎉 Congratulations!</h1>
            <p style="color: #d1fae5; margin: 10px 0 0; font-size: 16px;">Your admin account has been approved</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">✓</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">Welcome to the Admin Team!</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">Hello ${username}, your admin account has been successfully approved. You can now access all admin features and manage the platform.</p>
            </div>
            
            <div style="background-color: #f0fdf4; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #10b981;">
              <h3 style="color: #166534; margin: 0 0 15px; font-size: 18px; font-weight: 600;">🚀 What's Next?</h3>
              <ul style="color: #166534; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                <li>Sign in to your account using your existing credentials</li>
                <li>Access the admin dashboard to manage users and content</li>
                <li>Review and approve pending admin requests</li>
                <li>Monitor platform activity and user management</li>
                <li>Access advanced reporting and analytics tools</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/sign-in" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.3s ease;">
                Sign In to Admin Dashboard
              </a>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #1f2937; margin: 0 0 10px; font-size: 16px; font-weight: 600;">Account Details</h3>
              <div style="display: grid; gap: 8px;">
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Username:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${username}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Email:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${email}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Role:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${role}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Approved On:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${new Date(approvedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            <div style="text-align: center; color: #6b7280; font-size: 14px; line-height: 1.6;">
              <p style="margin: 0 0 10px;">If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
              <p style="margin: 0;">Welcome to the UrbanSetu admin team!</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending admin approval email:', error);
    return createErrorResponse(error, 'admin_approval_email');
  }
};

/**
 * Send admin rejection email to rejected admin
 */
export const sendAdminRejectionEmail = async (email, adminDetails) => {
  try {
    const { username, role, rejectedBy, rejectedAt } = adminDetails;

    const subject = `❌ Admin Account Request Update - UrbanSetu`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Account Request Update - UrbanSetu</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Account Request Update</h1>
            <p style="color: #fecaca; margin: 10px 0 0; font-size: 16px;">Your admin account request has been reviewed</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(239, 68, 68, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">✕</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">Request Not Approved</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">Hello ${username}, we regret to inform you that your admin account request has not been approved at this time.</p>
            </div>
            
            <div style="background-color: #fef2f2; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #ef4444;">
              <h3 style="color: #991b1b; margin: 0 0 15px; font-size: 18px; font-weight: 600;">📋 What This Means</h3>
              <ul style="color: #991b1b; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                <li>Your account remains as a regular user account</li>
                <li>You can still use all standard platform features</li>
                <li>You can browse, buy, and sell properties normally</li>
                <li>You can reapply for admin privileges in the future</li>
                <li>Your account data and preferences are preserved</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/sign-in" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); transition: all 0.3s ease;">
                Continue Using UrbanSetu
              </a>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #1f2937; margin: 0 0 10px; font-size: 16px; font-weight: 600;">Account Details</h3>
              <div style="display: grid; gap: 8px;">
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Username:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${username}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Email:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${email}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Current Role:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">User</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Reviewed On:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${new Date(rejectedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            <div style="text-align: center; color: #6b7280; font-size: 14px; line-height: 1.6;">
              <p style="margin: 0 0 10px;">If you have any questions about this decision or would like to discuss your application further, please contact our support team.</p>
              <p style="margin: 0;">Thank you for your interest in contributing to UrbanSetu!</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending admin rejection email:', error);
    return createErrorResponse(error, 'admin_rejection_email');
  }
};

/**
 * Send account suspension email to suspended user/admin
 */
export const sendAccountSuspensionEmail = async (email, suspensionDetails) => {
  try {
    const { username, role, reason, suspendedBy, suspendedAt, isSuspension } = suspensionDetails;

    const subject = isSuspension
      ? `⚠️ Account Suspended - UrbanSetu`
      : `✅ Account Reactivated - UrbanSetu`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${isSuspension ? 'Account Suspended' : 'Account Reactivated'} - UrbanSetu</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, ${isSuspension ? '#ef4444 0%, #dc2626 100%' : '#10b981 0%, #059669 100%'}); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">${isSuspension ? '⚠️ Account Suspended' : '✅ Account Reactivated'}</h1>
            <p style="color: ${isSuspension ? '#fecaca' : '#d1fae5'}; margin: 10px 0 0; font-size: 16px;">${isSuspension ? 'Your account has been temporarily suspended' : 'Your account has been reactivated'}</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, ${isSuspension ? '#ef4444, #dc2626' : '#10b981, #059669'}); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(${isSuspension ? '239, 68, 68' : '16, 185, 129'}, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">${isSuspension ? '⚠️' : '✓'}</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">${isSuspension ? 'Account Access Restricted' : 'Welcome Back!'}</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">Hello ${username}, ${isSuspension ? 'your UrbanSetu account has been suspended due to a policy violation.' : 'your UrbanSetu account has been reactivated and you can now access all features again.'}</p>
            </div>
            
            ${isSuspension ? `
            <div style="background-color: #fef2f2; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #ef4444;">
              <h3 style="color: #991b1b; margin: 0 0 15px; font-size: 18px; font-weight: 600;">📋 Suspension Details</h3>
              <div style="color: #991b1b; font-size: 14px; line-height: 1.6;">
                <p style="margin: 0 0 10px;"><strong>Reason:</strong> ${reason || 'Policy violation'}</p>
                <p style="margin: 0 0 10px;"><strong>Suspended On:</strong> ${new Date(suspendedAt).toLocaleDateString()}</p>
                <p style="margin: 0;"><strong>Suspended By:</strong> ${suspendedBy || 'Administrator'}</p>
              </div>
            </div>
            
            <div style="background-color: #fef3c7; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #f59e0b;">
              <h3 style="color: #92400e; margin: 0 0 15px; font-size: 18px; font-weight: 600;">🔄 What This Means</h3>
              <ul style="color: #92400e; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                <li>You cannot sign in to your account</li>
                <li>You cannot access any UrbanSetu features</li>
                <li>Your account data is preserved</li>
                <li>You can appeal this decision by contacting support</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); transition: all 0.3s ease;">
                Contact Support to Appeal
              </a>
            </div>
            ` : `
            <div style="background-color: #f0fdf4; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #10b981;">
              <h3 style="color: #166534; margin: 0 0 15px; font-size: 18px; font-weight: 600;">🎉 Account Restored</h3>
              <ul style="color: #166534; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                <li>You can now sign in to your account</li>
                <li>All UrbanSetu features are available</li>
                <li>Your account data is fully restored</li>
                <li>You can continue using the platform normally</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/sign-in" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.3s ease;">
                Sign In to Your Account
              </a>
            </div>
            `}
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #1f2937; margin: 0 0 10px; font-size: 16px; font-weight: 600;">Account Details</h3>
              <div style="display: grid; gap: 8px;">
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Username:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${username}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Email:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${email}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Role:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${role}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">${isSuspension ? 'Suspended On:' : 'Reactivated On:'}</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${new Date(suspendedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            <div style="text-align: center; color: #6b7280; font-size: 14px; line-height: 1.6;">
              <p style="margin: 0 0 10px;">${isSuspension ? 'If you believe this suspension is a mistake, please contact our support team immediately.' : 'Thank you for your patience. We look forward to serving you again.'}</p>
              <p style="margin: 0;">This is an automated notification. Please do not reply to this email.</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending account suspension email:', error);
    return createErrorResponse(error, 'account_suspension_email');
  }
};

/**
 * Send user promotion email to newly promoted admin
 */
export const sendUserPromotionEmail = async (email, promotionDetails) => {
  try {
    const { username, promotedBy, promotedAt } = promotionDetails;

    const subject = `🎉 Congratulations! You've Been Promoted to Admin - UrbanSetu`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Promoted to Admin - UrbanSetu</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">🎉 Congratulations!</h1>
            <p style="color: #e9d5ff; margin: 10px 0 0; font-size: 16px;">You've been promoted to Admin</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #8b5cf6, #7c3aed); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(139, 92, 246, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">👑</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">Welcome to the Admin Team!</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">Hello ${username}, congratulations! You have been promoted to Admin and now have administrative privileges on UrbanSetu.</p>
            </div>
            
            <div style="background-color: #faf5ff; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #8b5cf6;">
              <h3 style="color: #6b21a8; margin: 0 0 15px; font-size: 18px; font-weight: 600;">🚀 New Admin Privileges</h3>
              <ul style="color: #6b21a8; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                <li>Manage user accounts and permissions</li>
                <li>Review and moderate property listings</li>
                <li>Handle user reports and disputes</li>
                <li>Access admin dashboard and analytics</li>
                <li>Approve or reject admin requests</li>
                <li>Monitor platform activity and security</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/sign-in" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3); transition: all 0.3s ease;">
                Access Admin Dashboard
              </a>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #1f2937; margin: 0 0 10px; font-size: 16px; font-weight: 600;">Account Details</h3>
              <div style="display: grid; gap: 8px;">
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Username:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${username}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Email:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${email}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">New Role:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">Admin</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Promoted On:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${new Date(promotedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            <div style="text-align: center; color: #6b7280; font-size: 14px; line-height: 1.6;">
              <p style="margin: 0 0 10px;">You will need to sign in again to access your new admin privileges.</p>
              <p style="margin: 0;">Welcome to the UrbanSetu admin team!</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending user promotion email:', error);
    return createErrorResponse(error, 'user_promotion_email');
  }
};

/**
 * Send manual softban email to user/admin
 */
export const sendManualSoftbanEmail = async (email, softbanDetails) => {
  try {
    const { username, role, reason, softbannedBy, softbannedAt, revocationLink } = softbanDetails;

    const subject = `⚠️ Account Softbanned - UrbanSetu`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Softbanned - UrbanSetu</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">⚠️ Account Softbanned</h1>
            <p style="color: #fef3c7; margin: 10px 0 0; font-size: 16px;">Your UrbanSetu account has been temporarily suspended</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(245, 158, 11, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">⚠️</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">Account Temporarily Suspended</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">Hello ${username}, your UrbanSetu account has been softbanned by an administrator. This is a temporary suspension that can be restored within 30 days.</p>
            </div>
            
            <div style="background-color: #fef2f2; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #ef4444;">
              <h3 style="color: #991b1b; margin: 0 0 15px; font-size: 18px; font-weight: 600;">📋 Softban Details</h3>
              <div style="color: #991b1b; font-size: 14px; line-height: 1.6;">
                <p style="margin: 0 0 10px;"><strong>Reason:</strong> ${reason || 'Policy violation'}</p>
                <p style="margin: 0 0 10px;"><strong>Softbanned On:</strong> ${new Date(softbannedAt).toLocaleDateString()}</p>
                <p style="margin: 0;"><strong>Softbanned By:</strong> Administrator</p>
              </div>
            </div>

            <div style="background-color: #fef3c7; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #f59e0b;">
              <h3 style="color: #92400e; margin: 0 0 15px; font-size: 18px; font-weight: 600;">🔄 What This Means</h3>
              <ul style="color: #92400e; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                <li>You cannot sign in to your account</li>
                <li>You cannot access any UrbanSetu features</li>
                <li>Your account data is preserved</li>
                <li>You cannot restore your account yourself</li>
                <li>You must contact support to appeal this decision</li>
                <li>After 30 days, your account will be permanently deleted</li>
              </ul>
            </div>

            <div style="background-color: #fef2f2; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #ef4444;">
              <h3 style="color: #991b1b; margin: 0 0 15px; font-size: 18px; font-weight: 600;">📞 Contact Support to Appeal</h3>
              <p style="color: #991b1b; margin: 0 0 15px; font-size: 14px; line-height: 1.6;">Since your account was softbanned by an administrator, you cannot restore it yourself. If you believe this action was taken in error or wish to appeal this decision, please contact our support team immediately.</p>
              <div style="text-align: center;">
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); transition: all 0.3s ease;">
                  Contact Support for Appeal
                </a>
              </div>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #1f2937; margin: 0 0 10px; font-size: 16px; font-weight: 600;">Account Details</h3>
              <div style="display: grid; gap: 8px;">
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Username:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${username}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Email:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${email}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Role:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${role === 'admin' ? 'Administrator' : 'User'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Softbanned On:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${new Date(softbannedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            
            <div style="text-align: center; color: #6b7280; font-size: 14px; line-height: 1.6;">
              <p style="margin: 0 0 10px;">To appeal this decision or if you have any questions, please contact our support team using the button above.</p>
              <p style="margin: 0;">This is an automated notification. Please do not reply to this email.</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending manual softban email:', error);
    return createErrorResponse(error, 'manual_softban_email');
  }
};

/**
 * Send manual account restoration email (admin-initiated)
 */
export const sendManualAccountRestorationEmail = async (email, restorationDetails) => {
  try {
    const { username, role, restoredBy, restoredAt } = restorationDetails;

    const subject = `✅ Account Restored by Administrator - UrbanSetu`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Restored by Administrator - UrbanSetu</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">✅ Account Restored</h1>
            <p style="color: #d1fae5; margin: 10px 0 0; font-size: 16px;">Your UrbanSetu account has been restored by an administrator</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">✓</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">Account Successfully Restored</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">Hello ${username}, your UrbanSetu account has been restored by an administrator and you can now access all features again.</p>
            </div>
            
            <div style="background-color: #f0fdf4; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #10b981;">
              <h3 style="color: #166534; margin: 0 0 15px; font-size: 18px; font-weight: 600;">🎉 Account Restored by Administrator</h3>
              <div style="color: #166534; font-size: 14px; line-height: 1.6;">
                <p style="margin: 0 0 10px;"><strong>Restored On:</strong> ${new Date(restoredAt).toLocaleDateString()}</p>
                <p style="margin: 0;"><strong>Restored By:</strong> Administrator</p>
              </div>
            </div>

            <div style="background-color: #f0f9ff; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #3b82f6;">
              <h3 style="color: #1e40af; margin: 0 0 15px; font-size: 18px; font-weight: 600;">🔄 What This Means</h3>
              <ul style="color: #1e40af; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                <li>You can now sign in to your account</li>
                <li>All UrbanSetu features are available</li>
                <li>Your account data is fully restored</li>
                <li>You can continue using the platform normally</li>
                <li>Your previous settings and preferences are preserved</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/sign-in" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.3s ease;">
                Sign In to Your Account
              </a>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #1f2937; margin: 0 0 10px; font-size: 16px; font-weight: 600;">Account Details</h3>
              <div style="display: grid; gap: 8px;">
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Username:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${username}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Email:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${email}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Role:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${role === 'admin' ? 'Administrator' : 'User'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Restored On:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${new Date(restoredAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            <div style="text-align: center; color: #6b7280; font-size: 14px; line-height: 1.6;">
              <p style="margin: 0 0 10px;">Thank you for your patience. We look forward to serving you again.</p>
              <p style="margin: 0;">This is an automated notification. Please do not reply to this email.</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending manual account restoration email:', error);
    return createErrorResponse(error, 'manual_account_restoration_email');
  }
};

/**
 * Send admin demotion email to demoted user
 */
export const sendAdminDemotionEmail = async (email, demotionDetails) => {
  try {
    const { username, demotedBy, demotedAt, reason } = demotionDetails;

    const subject = `📋 Admin Access Revoked - UrbanSetu`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Access Revoked - UrbanSetu</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">📋 Access Update</h1>
            <p style="color: #d1d5db; margin: 10px 0 0; font-size: 16px;">Your admin privileges have been revoked</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #6b7280, #4b5563); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(107, 114, 128, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">👤</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">Admin Access Revoked</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">Hello ${username}, your admin privileges have been revoked and you are now a regular user on UrbanSetu.</p>
            </div>
            
            <div style="background-color: #f9fafb; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #6b7280;">
              <h3 style="color: #374151; margin: 0 0 15px; font-size: 18px; font-weight: 600;">📋 What This Means</h3>
              <ul style="color: #374151; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                <li>You no longer have admin privileges</li>
                <li>You cannot access the admin dashboard</li>
                <li>You cannot manage other users or content</li>
                <li>You can still use all regular user features</li>
                <li>You can browse, buy, and sell properties normally</li>
                <li>Your account data and preferences are preserved</li>
              </ul>
            </div>

            ${reason ? `
            <div style="background-color: #fef2f2; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #ef4444;">
              <h3 style="color: #991b1b; margin: 0 0 15px; font-size: 18px; font-weight: 600;">📝 Reason for Demotion</h3>
              <div style="color: #991b1b; font-size: 14px; line-height: 1.6;">
                <p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>
              </div>
            </div>
            ` : ''}
            
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/sign-in" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); transition: all 0.3s ease;">
                Continue Using UrbanSetu
              </a>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #1f2937; margin: 0 0 10px; font-size: 16px; font-weight: 600;">Account Details</h3>
              <div style="display: grid; gap: 8px;">
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Username:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${username}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Email:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${email}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Current Role:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">User</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                  <span style="color: #6b7280; font-weight: 500; font-size: 14px;">Demoted On:</span>
                  <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${new Date(demotedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            <div style="text-align: center; color: #6b7280; font-size: 14px; line-height: 1.6;">
              <p style="margin: 0 0 10px;">If you have any questions about this change, please contact our support team.</p>
              <p style="margin: 0;">Thank you for your previous contributions to UrbanSetu!</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending admin demotion email:', error);
    return createErrorResponse(error, 'admin_demotion_email');
  }
};

// Send outdated appointment email
export const sendOutdatedAppointmentEmail = async (email, appointmentDetails, userRole) => {
  try {
    const {
      appointmentId,
      propertyName,
      propertyDescription,
      propertyAddress,
      propertyPrice,
      propertyImages,
      date,
      time,
      buyerName,
      buyerEmail,
      sellerName,
      sellerEmail,
      purpose,
      listingId,
      message
    } = appointmentDetails;

    const appointmentDate = new Date(date);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const isBuyer = userRole === 'buyer';
    const otherPartyName = isBuyer ? sellerName : buyerName;
    const otherPartyEmail = isBuyer ? sellerEmail : buyerEmail;
    const userName = isBuyer ? buyerName : sellerName;
    const isRent = purpose === 'rent';

    // Dynamic headers and labels based on purpose
    const headerTitle = isRent ? "Check-in Date Passed" : "Missed Property Visit";
    const headerSubtitle = isRent
      ? "The scheduled check-in date has passed."
      : "The scheduled time for your property visit has passed.";
    const dateLabel = isRent ? "Check-in Date:" : "Visit Date:";
    const statusLabel = isRent ? "Check-in Missed" : "Visit Missed";
    const sectionTitle = isRent ? "❌ Missed Check-in Details" : "❌ Missed Visit Details";

    const subject = isRent
      ? `Check-in Date Passed - ${propertyName} - UrbanSetu`
      : `Missed Property Visit - ${propertyName} - UrbanSetu`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${headerTitle} - UrbanSetu</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">⏰ ${headerTitle}</h1>
            <p style="color: #fecaca; margin: 10px 0 0; font-size: 16px;">${headerSubtitle}</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(239, 68, 68, 0.3);">
                <span style="color: #ffffff; font-size: 32px;">📅</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 10px; font-size: 24px; font-weight: 700;">Hello ${userName}!</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">
                ${isRent
        ? `Your scheduled check-in for <strong>${propertyName}</strong> has passed.`
        : `Your scheduled visit for <strong>${propertyName}</strong> has passed.`
      }
                If you still wish to proceed, please book a new appointment or contact support.
              </p>
            </div>
            
            <!-- Property Details -->
            <div style="background-color: #f8fafc; padding: 25px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #e2e8f0;">
              <h3 style="color: #1e293b; margin: 0 0 20px; font-size: 20px; font-weight: 600;">🏠 Property Details</h3>
              <div style="display: grid; gap: 15px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="color: #64748b; font-size: 18px;">🏷️</span>
                  <div>
                    <div style="color: #1e293b; font-weight: 600; font-size: 16px;">${propertyName}</div>
                    <div style="color: #64748b; font-size: 14px;">${propertyAddress}</div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="color: #64748b; font-size: 18px;">💰</span>
                  <div>
                    <div style="color: #1e293b; font-weight: 600; font-size: 16px;">₹${propertyPrice?.toLocaleString() || 'Price not available'}</div>
                    <div style="color: #64748b; font-size: 14px;">${isRent ? 'For Rent' : 'For Sale'}</div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="color: #64748b; font-size: 18px;">📝</span>
                  <div>
                    <div style="color: #1e293b; font-weight: 600; font-size: 16px;">Description</div>
                    <div style="color: #64748b; font-size: 14px; line-height: 1.5;">${propertyDescription}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Missed Appointment/Check-in Details -->
            <div style="background-color: #fef2f2; padding: 25px; border-radius: 12px; margin-bottom: 30px; border-left: 4px solid #ef4444;">
              <h3 style="color: #991b1b; margin: 0 0 20px; font-size: 18px; font-weight: 600;">${sectionTitle}</h3>
              <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fecaca;">
                  <span style="color: #991b1b; font-weight: 500; font-size: 14px;">${dateLabel}</span>
                  <span style="color: #991b1b; font-weight: 600; font-size: 14px;">${formattedDate}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fecaca;">
                  <span style="color: #991b1b; font-weight: 500; font-size: 14px;">Time:</span>
                  <span style="color: #991b1b; font-weight: 600; font-size: 14px;">${time}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fecaca;">
                  <span style="color: #991b1b; font-weight: 500; font-size: 14px;">Status:</span>
                  <span style="color: #991b1b; font-weight: 600; font-size: 14px;">${statusLabel}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                  <span style="color: #991b1b; font-weight: 500; font-size: 14px;">Other Party:</span>
                  <span style="color: #991b1b; font-weight: 600; font-size: 14px;">${otherPartyName}</span>
                </div>
              </div>
            </div>
            
            <!-- Action Buttons -->
            <div style="text-align: center; margin-bottom: 30px; padding: 0 10px;">
              <div class="btn-container">
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/listing/${listingId}" class="btn btn-primary">
                  🏠 View Property Details
                </a>
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/my-appointments" class="btn btn-secondary">
                  📅 My Appointments
                </a>
              </div>
            </div>
            
            <!-- Next Steps -->
            <div style="background-color: #f0f9ff; padding: 25px; border-radius: 12px; margin-bottom: 30px; border-left: 4px solid #3b82f6;">
              <h3 style="color: #1e40af; margin: 0 0 15px; font-size: 18px; font-weight: 600;">🚀 What's Next?</h3>
              <ul style="color: #1e40af; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                <li>Visit the property page to book a new appointment</li>
                <li>Choose a new date and time that works for both parties</li>
                <li>Contact the ${isBuyer ? 'seller' : 'buyer'} directly if needed</li>
                <li>Check your appointments page for all scheduled meetings</li>
              </ul>
            </div>
            
            <!-- Thank You Message -->
            <div style="text-align: center; padding: 25px; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 12px; margin-bottom: 20px;">
              <h3 style="color: #1f2937; margin: 0 0 10px; font-size: 18px; font-weight: 600;">Thank You for Using UrbanSetu!</h3>
              <p style="color: #6b7280; margin: 0; font-size: 14px; line-height: 1.6;">
                We appreciate your business and look forward to helping you find your perfect property. 
                If you have any questions, feel free to contact our support team.
              </p>
            </div>
            
            <!-- Contact Information -->
            <div style="text-align: center; color: #6b7280; font-size: 14px; line-height: 1.6;">
              <p style="margin: 0 0 10px;">
                <strong>Need Help?</strong> Contact us at 
                <a href="mailto:urbansetu.noreply@gmail.com" style="color: #3b82f6; text-decoration: none;">urbansetu.noreply@gmail.com</a>
              </p>
              <p style="margin: 0;">
                Visit our website: 
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}" style="color: #3b82f6; text-decoration: none;">UrbanSetu</a>
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved. | 
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/privacy" style="color: #6b7280; text-decoration: none;">Privacy Policy</a> | 
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/terms" style="color: #6b7280; text-decoration: none;">Terms of Service</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending outdated appointment email:', error);
    return createErrorResponse(error, 'outdated_appointment_email');
  }
};

// Appointment Booking Confirmation Email
export const sendAppointmentBookingEmail = async (email, appointmentDetails, userRole) => {
  try {
    const {
      appointmentId,
      propertyName,
      propertyDescription,
      propertyAddress,
      propertyPrice,
      propertyImages,
      date,
      time,
      buyerName,
      buyerEmail,
      sellerName,
      sellerEmail,
      purpose,
      message,
      listingId,
      paymentStatus,
      bookedByAdmin = false
    } = appointmentDetails;

    const subject = `🏠 Appointment Booked - ${propertyName} | UrbanSetu`;

    const isBuyer = userRole === 'buyer';
    const isSeller = userRole === 'seller';

    // Format date and time
    const appointmentDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const appointmentTime = time ? new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) : 'Time TBD';

    // Get property image for email
    const propertyImage = propertyImages && propertyImages.length > 0
      ? propertyImages[0]
      : `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/placeholder-property.jpg`;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Booked - UrbanSetu</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 30px;
        }
        .appointment-card {
          background: #f8fafc;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 25px;
          margin: 20px 0;
        }
        .property-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .property-title {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 10px 0;
        }
        .property-address {
          color: #64748b;
          font-size: 16px;
          margin: 0 0 15px 0;
        }
        .property-price {
          font-size: 20px;
          font-weight: 700;
          color: #059669;
          margin: 0 0 20px 0;
        }
        .appointment-details {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #1f2937;
          font-weight: 500;
        }
        .status-badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .status-pending {
          background: #fef3c7;
          color: #d97706;
        }
        .status-paid {
          background: #d1fae5;
          color: #059669;
        }
        .message-section {
          background: #f1f5f9;
          border-left: 4px solid #3b82f6;
          padding: 20px;
          margin: 20px 0;
          border-radius: 0 8px 8px 0;
        }
        .message-label {
          font-weight: 600;
          color: #374151;
          margin-bottom: 8px;
        }
        .message-text {
          color: #1f2937;
          font-style: italic;
        }
        .action-buttons {
          text-align: center;
          margin: 30px 0;
          padding: 0 10px;
        }
        .btn-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          max-width: 100%;
          width: 100%;
        }
        .btn-container.horizontal {
          flex-direction: row;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .btn {
          display: inline-block;
          width: auto;
          max-width: 280px;
          padding: 15px 25px;
          margin: 5px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          text-align: center;
          box-sizing: border-box;
          word-wrap: break-word;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .btn-container:not(.horizontal) .btn {
          display: block;
          width: 100%;
          margin: 0;
          padding: 12px 20px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white !important;
        }
        .btn-secondary {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white !important;
        }
        .btn-outline {
          background: white;
          color: #3b82f6 !important;
          border: 2px solid #3b82f6;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }
        .next-steps {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .next-steps h3 {
          color: #d97706;
          margin: 0 0 15px 0;
          font-size: 18px;
        }
        .next-steps ul {
          margin: 0;
          padding-left: 20px;
        }
        .next-steps li {
          margin: 8px 0;
          color: #92400e;
        }
        .footer {
          background: #f8fafc;
          padding: 30px;
          text-align: center;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          margin: 5px 0;
        }
        .social-links {
          margin: 20px 0;
        }
        .social-links a {
          display: inline-block;
          margin: 0 10px;
          color: #3b82f6;
          text-decoration: none;
        }
        @media (max-width: 600px) {
          .container {
            margin: 10px;
            border-radius: 8px;
          }
          .content {
            padding: 20px;
          }
          .action-buttons {
            padding: 0 5px;
          }
          .btn-container {
            gap: 10px;
          }
          .btn-container.horizontal {
            flex-direction: column;
            gap: 10px;
          }
          .btn {
            max-width: 100%;
            padding: 14px 16px;
            font-size: 15px;
            margin: 0;
            display: block;
            width: 100%;
          }
          .detail-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .detail-value {
            margin-top: 5px;
          }
        }
        @media (max-width: 400px) {
          .btn {
            padding: 12px 14px;
            font-size: 14px;
          }
          .action-buttons {
            padding: 0 2px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Appointment Booked Successfully!</h1>
          <p>Your property viewing appointment has been confirmed</p>
          ${bookedByAdmin ? '<p style="font-size: 14px; opacity: 0.8; margin-top: 10px;">📋 This appointment was booked by our admin team on your behalf</p>' : ''}
        </div>
        
        <div class="content">
          <div class="appointment-card">
            <img src="${propertyImage}" alt="${propertyName}" class="property-image" />
            <h2 class="property-title">${propertyName}</h2>
            <p class="property-address">📍 ${propertyAddress || 'Address not specified'}</p>
            <p class="property-price">💰 ₹${propertyPrice || 'Price not specified'}</p>
            
            <div class="appointment-details">
              <div class="detail-row">
                <span class="detail-label">📅 Date:</span>
                <span class="detail-value">${appointmentDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Time:</span>
                <span class="detail-value">${appointmentTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">👤 ${isBuyer ? 'Seller' : 'Buyer'}:</span>
                <span class="detail-value">${isBuyer ? sellerName : buyerName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📊 Appointment Status:</span>
                <span class="detail-value">
                  <span class="status-badge status-pending">
                    ⏳ Pending
                  </span>
                </span>
              </div>
              ${purpose ? `
              <div class="detail-row">
                <span class="detail-label">🎯 Purpose:</span>
                <span class="detail-value">${purpose}</span>
              </div>
              ` : ''}
            </div>
            
            ${message ? `
            <div class="message-section">
              <div class="message-label">💬 Message from ${isBuyer ? 'you' : 'buyer'}:</div>
              <div class="message-text">"${message}"</div>
            </div>
            ` : ''}
          </div>
          
          <div class="action-buttons">
            <div class="btn-container">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/listing/${listingId}" class="btn btn-primary">
                🏠 View Property Details
              </a>
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-appointments" class="btn btn-secondary">
                📅 My Appointments
              </a>
              ${isBuyer && paymentStatus !== 'paid' ? `
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-payments" class="btn btn-outline">
                💳 Make Payment
              </a>
              ` : ''}
            </div>
          </div>
          
          <div class="next-steps">
            <h3>📋 Next Steps:</h3>
            <ul>
              ${isBuyer ? `
              <li>Wait for the seller to accept or decline your appointment request</li>
              <li>You will receive an email notification once the seller responds</li>
              ${paymentStatus !== 'paid' ? '<li>Complete your payment to secure the appointment</li>' : ''}
              <li>Prepare any questions you have about the property</li>
              <li>Arrive on time for your scheduled appointment</li>
              ` : `
              <li>Review the appointment request and respond (accept/decline)</li>
              <li>You will receive an email notification when the buyer makes payment</li>
              <li>Prepare the property for viewing</li>
              <li>Be available at the scheduled time</li>
              `}
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>UrbanSetu - Smart Real Estate Platform</strong></p>
          <p>Thank you for using our platform for your property needs!</p>
          <div class="social-links">
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}">Website</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact">Support</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/privacy">Privacy</a>
          </div>
          <p style="font-size: 12px; margin-top: 20px;">
            This is an automated email. Please do not reply to this email address.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending appointment booking email:', error);
    return createErrorResponse(error, 'appointment_booking_email');
  }
};

// Seller Payment Notification Email (when buyer makes payment)
export const sendSellerPaymentNotificationEmail = async (email, paymentDetails) => {
  try {
    const {
      appointmentId,
      propertyName,
      propertyDescription,
      propertyAddress,
      propertyPrice,
      propertyImages,
      date,
      time,
      buyerName,
      paymentAmount,
      paymentCurrency,
      paymentGateway,
      listingId
    } = paymentDetails;

    const subject = `💰 Payment Received - ${propertyName} | UrbanSetu`;

    // Format date and time
    const appointmentDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const appointmentTime = time ? new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) : 'Time TBD';

    // Get property image for email
    const propertyImage = propertyImages && propertyImages.length > 0
      ? propertyImages[0]
      : `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/placeholder-property.jpg`;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Received - UrbanSetu</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 30px;
        }
        .payment-card {
          background: #f0fdf4;
          border: 2px solid #bbf7d0;
          border-radius: 12px;
          padding: 25px;
          margin: 20px 0;
        }
        .property-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .property-title {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 10px 0;
        }
        .property-address {
          color: #64748b;
          font-size: 16px;
          margin: 0 0 15px 0;
        }
        .property-price {
          font-size: 20px;
          font-weight: 700;
          color: #059669;
          margin: 0 0 20px 0;
        }
        .payment-details {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #1f2937;
          font-weight: 500;
        }
        .payment-amount {
          font-size: 24px;
          font-weight: 700;
          color: #059669;
          text-align: center;
          margin: 20px 0;
          padding: 20px;
          background: #f0fdf4;
          border-radius: 8px;
          border: 2px solid #bbf7d0;
        }
        .status-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #d1fae5;
          color: #059669;
        }
        .action-buttons {
          text-align: center;
          margin: 30px 0;
          padding: 0 10px;
        }
        .btn-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          max-width: 100%;
          width: 100%;
        }
        .btn-container.horizontal {
          flex-direction: row;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .btn {
          display: inline-block;
          width: auto;
          max-width: 280px;
          padding: 15px 25px;
          margin: 5px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          text-align: center;
          box-sizing: border-box;
          word-wrap: break-word;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .btn-container:not(.horizontal) .btn {
          display: block;
          width: 100%;
          margin: 0;
          padding: 12px 20px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white !important;
        }
        .btn-secondary {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white !important;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }
        .next-steps {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .next-steps h3 {
          color: #d97706;
          margin: 0 0 15px 0;
          font-size: 18px;
        }
        .next-steps ul {
          margin: 0;
          padding-left: 20px;
        }
        .next-steps li {
          margin: 8px 0;
          color: #92400e;
        }
        .footer {
          background: #f8fafc;
          padding: 30px;
          text-align: center;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          margin: 5px 0;
        }
        .social-links {
          margin: 20px 0;
        }
        .social-links a {
          display: inline-block;
          margin: 0 10px;
          color: #3b82f6;
          text-decoration: none;
        }
        @media (max-width: 600px) {
          .container {
            margin: 10px;
            border-radius: 8px;
          }
          .content {
            padding: 20px;
          }
          .action-buttons {
            padding: 0 5px;
          }
          .btn-container {
            gap: 10px;
          }
          .btn-container.horizontal {
            flex-direction: column;
            gap: 10px;
          }
          .btn {
            max-width: 100%;
            padding: 14px 16px;
            font-size: 15px;
            margin: 0;
            display: block;
            width: 100%;
          }
          .detail-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .detail-value {
            margin-top: 5px;
          }
        }
        @media (max-width: 400px) {
          .btn {
            padding: 12px 14px;
            font-size: 14px;
          }
          .action-buttons {
            padding: 0 2px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💰 Payment Received!</h1>
          <p>Your appointment payment has been confirmed</p>
        </div>
        
        <div class="content">
          <div class="payment-card">
            <img src="${propertyImage}" alt="${propertyName}" class="property-image" />
            <h2 class="property-title">${propertyName}</h2>
            <p class="property-address">📍 ${propertyAddress || 'Address not specified'}</p>
            <p class="property-price">💰 ₹${propertyPrice || 'Price not specified'}</p>
            
            <div class="payment-amount">
              Payment Received: ${paymentCurrency} ${paymentAmount}
            </div>
            
            <div class="payment-details">
              <div class="detail-row">
                <span class="detail-label">📅 Appointment Date:</span>
                <span class="detail-value">${appointmentDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Appointment Time:</span>
                <span class="detail-value">${appointmentTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">👤 Buyer:</span>
                <span class="detail-value">${buyerName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">💳 Payment Gateway:</span>
                <span class="detail-value">${paymentGateway}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">✅ Payment Status:</span>
                <span class="detail-value">
                  <span class="status-badge">PAID</span>
                </span>
              </div>
            </div>
          </div>
          
          <div class="action-buttons">
            <div class="btn-container horizontal">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/listing/${listingId}" class="btn btn-primary">
                🏠 View Property Details
              </a>
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-appointments" class="btn btn-secondary">
                📅 My Appointments
              </a>
            </div>
          </div>
          
          <div class="next-steps">
            <h3>📋 Next Steps:</h3>
            <ul>
              <li>Your appointment is now confirmed and secured</li>
              <li>Accept the payment to get the buyer's contact details from your appointments page</li>
              <li>Prepare the property for viewing</li>
              <li>Be available at the scheduled appointment time</li>
              <li>You can communicate with the buyer through the appointment chat</li>
              <li>After the appointment, you can provide feedback and ratings</li>
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>UrbanSetu - Smart Real Estate Platform</strong></p>
          <p>Thank you for using our platform for your property needs!</p>
          <div class="social-links">
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}">Website</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact">Support</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/privacy">Privacy</a>
          </div>
          <p style="font-size: 12px; margin-top: 20px;">
            This is an automated email. Please do not reply to this email address.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending seller payment notification email:', error);
    return createErrorResponse(error, 'seller_payment_notification_email');
  }
};

// Appointment Rejected Email (to buyer)
export const sendAppointmentRejectedEmail = async (email, appointmentDetails) => {
  try {
    const {
      appointmentId,
      propertyName,
      propertyDescription,
      propertyAddress,
      propertyPrice,
      propertyImages,
      date,
      time,
      sellerName,
      purpose,
      message,
      listingId,
      rejectionReason
    } = appointmentDetails;

    const subject = `❌ Appointment Rejected - ${propertyName} | UrbanSetu`;

    // Format date and time
    const appointmentDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const appointmentTime = time ? new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) : 'Time TBD';

    // Get property image for email
    const propertyImage = propertyImages && propertyImages.length > 0
      ? propertyImages[0]
      : `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/placeholder-property.jpg`;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Rejected - UrbanSetu</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 30px;
        }
        .appointment-card {
          background: #fef2f2;
          border: 2px solid #fecaca;
          border-radius: 12px;
          padding: 25px;
          margin: 20px 0;
        }
        .property-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .property-title {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 10px 0;
        }
        .property-address {
          color: #64748b;
          font-size: 16px;
          margin: 0 0 15px 0;
        }
        .property-price {
          font-size: 20px;
          font-weight: 700;
          color: #059669;
          margin: 0 0 20px 0;
        }
        .appointment-details {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #1f2937;
          font-weight: 500;
        }
        .status-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #fecaca;
          color: #dc2626;
        }
        .rejection-reason {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .rejection-reason h3 {
          color: #dc2626;
          margin: 0 0 10px 0;
          font-size: 18px;
        }
        .rejection-reason p {
          color: #7f1d1d;
          margin: 0;
          font-style: italic;
        }
        .action-buttons {
          text-align: center;
          margin: 30px 0;
          padding: 0 10px;
        }
        .btn-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          max-width: 100%;
          width: 100%;
        }
        .btn-container.horizontal {
          flex-direction: row;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .btn {
          display: inline-block;
          width: auto;
          max-width: 280px;
          padding: 15px 25px;
          margin: 5px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          text-align: center;
          box-sizing: border-box;
          word-wrap: break-word;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .btn-container:not(.horizontal) .btn {
          display: block;
          width: 100%;
          margin: 0;
          padding: 12px 20px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white !important;
        }
        .btn-secondary {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white !important;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }
        .next-steps {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .next-steps h3 {
          color: #d97706;
          margin: 0 0 15px 0;
          font-size: 18px;
        }
        .next-steps ul {
          margin: 0;
          padding-left: 20px;
        }
        .next-steps li {
          margin: 8px 0;
          color: #92400e;
        }
        .footer {
          background: #f8fafc;
          padding: 30px;
          text-align: center;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          margin: 5px 0;
        }
        .social-links {
          margin: 20px 0;
        }
        .social-links a {
          display: inline-block;
          margin: 0 10px;
          color: #3b82f6;
          text-decoration: none;
        }
        @media (max-width: 600px) {
          .container {
            margin: 10px;
            border-radius: 8px;
          }
          .content {
            padding: 20px;
          }
          .action-buttons {
            padding: 0 5px;
          }
          .btn-container {
            gap: 10px;
          }
          .btn-container.horizontal {
            flex-direction: column;
            gap: 10px;
          }
          .btn {
            max-width: 100%;
            padding: 14px 16px;
            font-size: 15px;
            margin: 0;
            display: block;
            width: 100%;
          }
          .detail-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .detail-value {
            margin-top: 5px;
          }
        }
        @media (max-width: 400px) {
          .btn {
            padding: 12px 14px;
            font-size: 14px;
          }
          .action-buttons {
            padding: 0 2px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>❌ Appointment Rejected</h1>
          <p>Unfortunately, your appointment request was not accepted</p>
        </div>
        
        <div class="content">
          <div class="appointment-card">
            <img src="${propertyImage}" alt="${propertyName}" class="property-image" />
            <h2 class="property-title">${propertyName}</h2>
            <p class="property-address">📍 ${propertyAddress || 'Address not specified'}</p>
            <p class="property-price">💰 ₹${propertyPrice || 'Price not specified'}</p>
            
            <div class="appointment-details">
              <div class="detail-row">
                <span class="detail-label">📅 Date:</span>
                <span class="detail-value">${appointmentDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Time:</span>
                <span class="detail-value">${appointmentTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">👤 Seller:</span>
                <span class="detail-value">${sellerName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📊 Status:</span>
                <span class="detail-value">
                  <span class="status-badge">REJECTED</span>
                </span>
              </div>
              ${purpose ? `
              <div class="detail-row">
                <span class="detail-label">🎯 Purpose:</span>
                <span class="detail-value">${purpose}</span>
              </div>
              ` : ''}
            </div>
            
            ${message ? `
            <div class="message-section">
              <div class="message-label">💬 Your Message:</div>
              <div class="message-text">"${message}"</div>
            </div>
            ` : ''}
            
            ${rejectionReason ? `
            <div class="rejection-reason">
              <h3>📝 Rejection Reason:</h3>
              <p>"${rejectionReason}"</p>
            </div>
            ` : ''}
          </div>
          
          <div class="action-buttons">
            <div class="btn-container horizontal">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/listing/${listingId}" class="btn btn-primary">
                🏠 View Property Details
              </a>
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-appointments" class="btn btn-secondary">
                📅 My Appointments
              </a>
            </div>
          </div>
          
          <div class="next-steps">
            <h3>📋 What's Next:</h3>
            <ul>
              <li>Don't worry! You can explore other similar properties</li>
              <li>Use our search filters to find properties that match your criteria</li>
              <li>Consider reaching out to other sellers for similar properties</li>
              <li>You can book new appointments anytime</li>
              <li>Check our recommendations for properties you might like</li>
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>UrbanSetu - Smart Real Estate Platform</strong></p>
          <p>Keep exploring to find your perfect property!</p>
          <div class="social-links">
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}">Website</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact">Support</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/privacy">Privacy</a>
          </div>
          <p style="font-size: 12px; margin-top: 20px;">
            This is an automated email. Please do not reply to this email address.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending appointment rejected email:', error);
    return createErrorResponse(error, 'appointment_rejected_email');
  }
};

// Appointment Accepted Email (to buyer)
export const sendAppointmentAcceptedEmail = async (email, appointmentDetails) => {
  try {
    const {
      appointmentId,
      propertyName,
      propertyDescription,
      propertyAddress,
      propertyPrice,
      propertyImages,
      date,
      time,
      sellerName,
      purpose,
      message,
      listingId
    } = appointmentDetails;

    const subject = `✅ Appointment Accepted - ${propertyName} | UrbanSetu`;

    // Format date and time
    const appointmentDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const appointmentTime = time ? new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) : 'Time TBD';

    // Get property image for email
    const propertyImage = propertyImages && propertyImages.length > 0
      ? propertyImages[0]
      : `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/placeholder-property.jpg`;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Accepted - UrbanSetu</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 30px;
        }
        .appointment-card {
          background: #f0fdf4;
          border: 2px solid #bbf7d0;
          border-radius: 12px;
          padding: 25px;
          margin: 20px 0;
        }
        .property-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .property-title {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 10px 0;
        }
        .property-address {
          color: #64748b;
          font-size: 16px;
          margin: 0 0 15px 0;
        }
        .property-price {
          font-size: 20px;
          font-weight: 700;
          color: #059669;
          margin: 0 0 20px 0;
        }
        .appointment-details {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #1f2937;
          font-weight: 500;
        }
        .status-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #d1fae5;
          color: #059669;
        }
        .message-section {
          background: #f1f5f9;
          border-left: 4px solid #3b82f6;
          padding: 20px;
          margin: 20px 0;
          border-radius: 0 8px 8px 0;
        }
        .message-label {
          font-weight: 600;
          color: #374151;
          margin-bottom: 8px;
        }
        .message-text {
          color: #1f2937;
          font-style: italic;
        }
        .action-buttons {
          text-align: center;
          margin: 30px 0;
          padding: 0 10px;
        }
        .btn-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          max-width: 100%;
          width: 100%;
        }
        .btn-container.horizontal {
          flex-direction: row;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .btn {
          display: inline-block;
          width: auto;
          max-width: 280px;
          padding: 15px 25px;
          margin: 5px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          text-align: center;
          box-sizing: border-box;
          word-wrap: break-word;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .btn-container:not(.horizontal) .btn {
          display: block;
          width: 100%;
          margin: 0;
          padding: 12px 20px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white !important;
        }
        .btn-secondary {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white !important;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }
        .next-steps {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .next-steps h3 {
          color: #d97706;
          margin: 0 0 15px 0;
          font-size: 18px;
        }
        .next-steps ul {
          margin: 0;
          padding-left: 20px;
        }
        .next-steps li {
          margin: 8px 0;
          color: #92400e;
        }
        .footer {
          background: #f8fafc;
          padding: 30px;
          text-align: center;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          margin: 5px 0;
        }
        .social-links {
          margin: 20px 0;
        }
        .social-links a {
          display: inline-block;
          margin: 0 10px;
          color: #3b82f6;
          text-decoration: none;
        }
        @media (max-width: 600px) {
          .container {
            margin: 10px;
            border-radius: 8px;
          }
          .content {
            padding: 20px;
          }
          .action-buttons {
            padding: 0 5px;
          }
          .btn-container {
            gap: 10px;
          }
          .btn-container.horizontal {
            flex-direction: column;
            gap: 10px;
          }
          .btn {
            max-width: 100%;
            padding: 14px 16px;
            font-size: 15px;
            margin: 0;
            display: block;
            width: 100%;
          }
          .detail-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .detail-value {
            margin-top: 5px;
          }
        }
        @media (max-width: 400px) {
          .btn {
            padding: 12px 14px;
            font-size: 14px;
          }
          .action-buttons {
            padding: 0 2px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Appointment Accepted!</h1>
          <p>Great news! Your appointment request has been approved</p>
        </div>
        
        <div class="content">
          <div class="appointment-card">
            <img src="${propertyImage}" alt="${propertyName}" class="property-image" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 20px; display: block; max-width: 100%;" />
            <h2 class="property-title">${propertyName}</h2>
            <p class="property-address">📍 ${propertyAddress || 'Address not specified'}</p>
            <p class="property-price">💰 ₹${propertyPrice || 'Price not specified'}</p>
            
            <div class="appointment-details">
              <div class="detail-row">
                <span class="detail-label">📅 Date:</span>
                <span class="detail-value">${appointmentDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Time:</span>
                <span class="detail-value">${appointmentTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">👤 Seller:</span>
                <span class="detail-value">${sellerName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📊 Status:</span>
                <span class="detail-value">
                  <span class="status-badge">ACCEPTED</span>
                </span>
              </div>
              ${purpose ? `
              <div class="detail-row">
                <span class="detail-label">🎯 Purpose:</span>
                <span class="detail-value">${purpose}</span>
              </div>
              ` : ''}
            </div>
            
            ${message ? `
            <div class="message-section">
              <div class="message-label">💬 Your Message:</div>
              <div class="message-text">"${message}"</div>
            </div>
            ` : ''}
          </div>
          
          <div class="action-buttons">
            <div class="btn-container horizontal">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/listing/${listingId}" class="btn btn-primary">
                🏠 View Property Details
              </a>
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-appointments" class="btn btn-secondary">
                📅 My Appointments
              </a>
            </div>
          </div>
          
          <div class="next-steps">
            <h3>📋 Next Steps:</h3>
            <ul>
              <li>Mark your calendar for the scheduled appointment</li>
              <li>Prepare any questions you have about the property</li>
              <li>Arrive on time for your appointment</li>
              <li>You can now communicate with the seller through the appointment chat</li>
              <li>Contact information is now visible to both parties</li>
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>UrbanSetu - Smart Real Estate Platform</strong></p>
          <p>We're excited to help you find your perfect property!</p>
          <div class="social-links">
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}">Website</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact">Support</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/privacy">Privacy</a>
          </div>
          <p style="font-size: 12px; margin-top: 20px;">
            This is an automated email. Please do not reply to this email address.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending appointment accepted email:', error);
    return createErrorResponse(error, 'appointment_accepted_email');
  }
};

// Appointment Cancelled by Buyer Email (to seller)
export const sendAppointmentCancelledByBuyerEmail = async (email, appointmentDetails) => {
  try {
    const {
      appointmentId,
      propertyName,
      propertyDescription,
      propertyAddress,
      propertyPrice,
      propertyImages,
      date,
      time,
      buyerName,
      purpose,
      message,
      listingId,
      cancellationReason
    } = appointmentDetails;

    const subject = `❌ Appointment Cancelled by Buyer - ${propertyName} | UrbanSetu`;

    // Format date and time
    const appointmentDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const appointmentTime = time ? new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) : 'Time TBD';

    // Get property image for email
    const propertyImage = propertyImages && propertyImages.length > 0
      ? propertyImages[0]
      : `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/placeholder-property.jpg`;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Cancelled by Buyer - UrbanSetu</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 30px;
        }
        .appointment-card {
          background: #fffbeb;
          border: 2px solid #fed7aa;
          border-radius: 12px;
          padding: 25px;
          margin: 20px 0;
        }
        .property-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .property-title {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 10px 0;
        }
        .property-address {
          color: #64748b;
          font-size: 16px;
          margin: 0 0 15px 0;
        }
        .property-price {
          font-size: 20px;
          font-weight: 700;
          color: #059669;
          margin: 0 0 20px 0;
        }
        .appointment-details {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #1f2937;
          font-weight: 500;
        }
        .status-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #fed7aa;
          color: #d97706;
        }
        .cancellation-reason {
          background: #fffbeb;
          border: 1px solid #fed7aa;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .cancellation-reason h3 {
          color: #d97706;
          margin: 0 0 10px 0;
          font-size: 18px;
        }
        .cancellation-reason p {
          color: #92400e;
          margin: 0;
          font-style: italic;
        }
        .action-buttons {
          text-align: center;
          margin: 30px 0;
          padding: 0 10px;
        }
        .btn-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          max-width: 100%;
          width: 100%;
        }
        .btn-container.horizontal {
          flex-direction: row;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .btn {
          display: inline-block;
          width: auto;
          max-width: 280px;
          padding: 15px 25px;
          margin: 5px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          text-align: center;
          box-sizing: border-box;
          word-wrap: break-word;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .btn-container:not(.horizontal) .btn {
          display: block;
          width: 100%;
          margin: 0;
          padding: 12px 20px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white !important;
        }
        .btn-secondary {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white !important;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }
        .next-steps {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .next-steps h3 {
          color: #d97706;
          margin: 0 0 15px 0;
          font-size: 18px;
        }
        .next-steps ul {
          margin: 0;
          padding-left: 20px;
        }
        .next-steps li {
          margin: 8px 0;
          color: #92400e;
        }
        .footer {
          background: #f8fafc;
          padding: 30px;
          text-align: center;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          margin: 5px 0;
        }
        .social-links {
          margin: 20px 0;
        }
        .social-links a {
          display: inline-block;
          margin: 0 10px;
          color: #3b82f6;
          text-decoration: none;
        }
        @media (max-width: 600px) {
          .container {
            margin: 10px;
            border-radius: 8px;
          }
          .content {
            padding: 20px;
          }
          .action-buttons {
            padding: 0 5px;
          }
          .btn-container {
            gap: 10px;
          }
          .btn-container.horizontal {
            flex-direction: column;
            gap: 10px;
          }
          .btn {
            max-width: 100%;
            padding: 14px 16px;
            font-size: 15px;
            margin: 0;
            display: block;
            width: 100%;
          }
          .detail-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .detail-value {
            margin-top: 5px;
          }
        }
        @media (max-width: 400px) {
          .btn {
            padding: 12px 14px;
            font-size: 14px;
          }
          .action-buttons {
            padding: 0 2px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>❌ Appointment Cancelled</h1>
          <p>The buyer has cancelled their appointment request</p>
        </div>
        
        <div class="content">
          <div class="appointment-card">
            <img src="${propertyImage}" alt="${propertyName}" class="property-image" />
            <h2 class="property-title">${propertyName}</h2>
            <p class="property-address">📍 ${propertyAddress || 'Address not specified'}</p>
            <p class="property-price">💰 ₹${propertyPrice || 'Price not specified'}</p>
            
            <div class="appointment-details">
              <div class="detail-row">
                <span class="detail-label">📅 Date:</span>
                <span class="detail-value">${appointmentDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Time:</span>
                <span class="detail-value">${appointmentTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">👤 Buyer:</span>
                <span class="detail-value">${buyerName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📊 Status:</span>
                <span class="detail-value">
                  <span class="status-badge">CANCELLED BY BUYER</span>
                </span>
              </div>
              ${purpose ? `
              <div class="detail-row">
                <span class="detail-label">🎯 Purpose:</span>
                <span class="detail-value">${purpose}</span>
              </div>
              ` : ''}
            </div>
            
            ${message ? `
            <div class="message-section">
              <div class="message-label">💬 Buyer's Message:</div>
              <div class="message-text">"${message}"</div>
            </div>
            ` : ''}
            
            ${cancellationReason ? `
            <div class="cancellation-reason">
              <h3>📝 Cancellation Reason:</h3>
              <p>"${cancellationReason}"</p>
            </div>
            ` : ''}
          </div>
          
          <div class="action-buttons">
            <div class="btn-container horizontal">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/listing/${listingId}" class="btn btn-primary">
                🏠 View Property Details
              </a>
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-appointments" class="btn btn-secondary">
                📅 My Appointments
              </a>
            </div>
          </div>
          
          <div class="next-steps">
            <h3>📋 What's Next:</h3>
            <ul>
              <li>Your property is still available for other potential buyers</li>
              <li>You can continue to receive new appointment requests</li>
              <li>Consider updating your property listing if needed</li>
              <li>Monitor your appointments for new bookings</li>
              <li>You can contact support if you have any questions</li>
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>UrbanSetu - Smart Real Estate Platform</strong></p>
          <p>Don't worry, more opportunities are coming your way!</p>
          <div class="social-links">
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}">Website</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact">Support</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/privacy">Privacy</a>
          </div>
          <p style="font-size: 12px; margin-top: 20px;">
            This is an automated email. Please do not reply to this email address.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending appointment cancelled by buyer email:', error);
    return createErrorResponse(error, 'appointment_cancelled_by_buyer_email');
  }
};

// Appointment Cancelled by Seller Email (to buyer)
export const sendAppointmentCancelledBySellerEmail = async (email, appointmentDetails) => {
  try {
    const {
      appointmentId,
      propertyName,
      propertyDescription,
      propertyAddress,
      propertyPrice,
      propertyImages,
      date,
      time,
      sellerName,
      purpose,
      message,
      listingId,
      cancellationReason
    } = appointmentDetails;

    const subject = `❌ Appointment Cancelled by Seller - ${propertyName} | UrbanSetu`;

    // Format date and time
    const appointmentDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const appointmentTime = time ? new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) : 'Time TBD';

    // Get property image for email
    const propertyImage = propertyImages && propertyImages.length > 0
      ? propertyImages[0]
      : `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/placeholder-property.jpg`;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Cancelled by Seller - UrbanSetu</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 30px;
        }
        .appointment-card {
          background: #fffbeb;
          border: 2px solid #fed7aa;
          border-radius: 12px;
          padding: 25px;
          margin: 20px 0;
        }
        .property-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .property-title {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 10px 0;
        }
        .property-address {
          color: #64748b;
          font-size: 16px;
          margin: 0 0 15px 0;
        }
        .property-price {
          font-size: 20px;
          font-weight: 700;
          color: #059669;
          margin: 0 0 20px 0;
        }
        .appointment-details {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #1f2937;
          font-weight: 500;
        }
        .status-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #fed7aa;
          color: #d97706;
        }
        .cancellation-reason {
          background: #fffbeb;
          border: 1px solid #fed7aa;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .cancellation-reason h3 {
          color: #d97706;
          margin: 0 0 10px 0;
          font-size: 18px;
        }
        .cancellation-reason p {
          color: #92400e;
          margin: 0;
          font-style: italic;
        }
        .action-buttons {
          text-align: center;
          margin: 30px 0;
          padding: 0 10px;
        }
        .btn-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          max-width: 100%;
          width: 100%;
        }
        .btn-container.horizontal {
          flex-direction: row;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .btn {
          display: inline-block;
          width: auto;
          max-width: 280px;
          padding: 15px 25px;
          margin: 5px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          text-align: center;
          box-sizing: border-box;
          word-wrap: break-word;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .btn-container:not(.horizontal) .btn {
          display: block;
          width: 100%;
          margin: 0;
          padding: 12px 20px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white !important;
        }
        .btn-secondary {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white !important;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }
        .next-steps {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .next-steps h3 {
          color: #d97706;
          margin: 0 0 15px 0;
          font-size: 18px;
        }
        .next-steps ul {
          margin: 0;
          padding-left: 20px;
        }
        .next-steps li {
          margin: 8px 0;
          color: #92400e;
        }
        .footer {
          background: #f8fafc;
          padding: 30px;
          text-align: center;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          margin: 5px 0;
        }
        .social-links {
          margin: 20px 0;
        }
        .social-links a {
          display: inline-block;
          margin: 0 10px;
          color: #3b82f6;
          text-decoration: none;
        }
        @media (max-width: 600px) {
          .container {
            margin: 10px;
            border-radius: 8px;
          }
          .content {
            padding: 20px;
          }
          .action-buttons {
            padding: 0 5px;
          }
          .btn-container {
            gap: 10px;
          }
          .btn-container.horizontal {
            flex-direction: column;
            gap: 10px;
          }
          .btn {
            max-width: 100%;
            padding: 14px 16px;
            font-size: 15px;
            margin: 0;
            display: block;
            width: 100%;
          }
          .detail-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .detail-value {
            margin-top: 5px;
          }
        }
        @media (max-width: 400px) {
          .btn {
            padding: 12px 14px;
            font-size: 14px;
          }
          .action-buttons {
            padding: 0 2px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>❌ Appointment Cancelled</h1>
          <p>The seller has cancelled your appointment</p>
        </div>
        
        <div class="content">
          <div class="appointment-card">
            <img src="${propertyImage}" alt="${propertyName}" class="property-image" />
            <h2 class="property-title">${propertyName}</h2>
            <p class="property-address">📍 ${propertyAddress || 'Address not specified'}</p>
            <p class="property-price">💰 ₹${propertyPrice || 'Price not specified'}</p>
            
            <div class="appointment-details">
              <div class="detail-row">
                <span class="detail-label">📅 Date:</span>
                <span class="detail-value">${appointmentDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Time:</span>
                <span class="detail-value">${appointmentTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">👤 Seller:</span>
                <span class="detail-value">${sellerName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📊 Status:</span>
                <span class="detail-value">
                  <span class="status-badge">CANCELLED BY SELLER</span>
                </span>
              </div>
              ${purpose ? `
              <div class="detail-row">
                <span class="detail-label">🎯 Purpose:</span>
                <span class="detail-value">${purpose}</span>
              </div>
              ` : ''}
            </div>
            
            ${message ? `
            <div class="message-section">
              <div class="message-label">💬 Your Message:</div>
              <div class="message-text">"${message}"</div>
            </div>
            ` : ''}
            
            ${cancellationReason ? `
            <div class="cancellation-reason">
              <h3>📝 Cancellation Reason:</h3>
              <p>"${cancellationReason}"</p>
            </div>
            ` : ''}
          </div>
          
          <div class="action-buttons">
            <div class="btn-container horizontal">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/listing/${listingId}" class="btn btn-primary">
                🏠 View Property Details
              </a>
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-appointments" class="btn btn-secondary">
                📅 My Appointments
              </a>
            </div>
          </div>
          
          <div class="next-steps">
            <h3>📋 What's Next:</h3>
            <ul>
              <li>Don't worry! You can explore other similar properties</li>
              <li>Use our search filters to find properties that match your criteria</li>
              <li>Consider reaching out to other sellers for similar properties</li>
              <li>You can book new appointments anytime</li>
              <li>Check our recommendations for properties you might like</li>
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>UrbanSetu - Smart Real Estate Platform</strong></p>
          <p>Keep exploring to find your perfect property!</p>
          <div class="social-links">
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}">Website</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact">Support</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/privacy">Privacy</a>
          </div>
          <p style="font-size: 12px; margin-top: 20px;">
            This is an automated email. Please do not reply to this email address.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending appointment cancelled by seller email:', error);
    return createErrorResponse(error, 'appointment_cancelled_by_seller_email');
  }
};

// Appointment Cancelled by Admin Email (to both buyer and seller)
export const sendAppointmentCancelledByAdminEmail = async (email, appointmentDetails, userRole) => {
  try {
    const {
      appointmentId,
      propertyName,
      propertyDescription,
      propertyAddress,
      propertyPrice,
      propertyImages,
      date,
      time,
      buyerName,
      sellerName,
      purpose,
      message,
      listingId,
      cancellationReason,
      adminName
    } = appointmentDetails;

    const subject = `❌ Appointment Cancelled by Admin - ${propertyName} | UrbanSetu`;

    const isBuyer = userRole === 'buyer';
    const isSeller = userRole === 'seller';

    // Format date and time
    const appointmentDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const appointmentTime = time ? new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) : 'Time TBD';

    // Get property image for email
    const propertyImage = propertyImages && propertyImages.length > 0
      ? propertyImages[0]
      : `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/placeholder-property.jpg`;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Cancelled by Admin - UrbanSetu</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 30px;
        }
        .appointment-card {
          background: #f9fafb;
          border: 2px solid #d1d5db;
          border-radius: 12px;
          padding: 25px;
          margin: 20px 0;
        }
        .property-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .property-title {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 10px 0;
        }
        .property-address {
          color: #64748b;
          font-size: 16px;
          margin: 0 0 15px 0;
        }
        .property-price {
          font-size: 20px;
          font-weight: 700;
          color: #059669;
          margin: 0 0 20px 0;
        }
        .appointment-details {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #1f2937;
          font-weight: 500;
        }
        .status-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #d1d5db;
          color: #6b7280;
        }
        .cancellation-reason {
          background: #f9fafb;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .cancellation-reason h3 {
          color: #6b7280;
          margin: 0 0 10px 0;
          font-size: 18px;
        }
        .cancellation-reason p {
          color: #374151;
          margin: 0;
          font-style: italic;
        }
        .admin-info {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
        }
        .admin-info h4 {
          color: #1e40af;
          margin: 0 0 5px 0;
          font-size: 16px;
        }
        .admin-info p {
          color: #1e40af;
          margin: 0;
          font-size: 14px;
        }
        .action-buttons {
          text-align: center;
          margin: 30px 0;
          padding: 0 10px;
        }
        .btn-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          max-width: 100%;
          width: 100%;
        }
        .btn-container.horizontal {
          flex-direction: row;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .btn {
          display: inline-block;
          width: auto;
          max-width: 280px;
          padding: 15px 25px;
          margin: 5px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          text-align: center;
          box-sizing: border-box;
          word-wrap: break-word;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .btn-container:not(.horizontal) .btn {
          display: block;
          width: 100%;
          margin: 0;
          padding: 12px 20px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white !important;
        }
        .btn-secondary {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white !important;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }
        .next-steps {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .next-steps h3 {
          color: #d97706;
          margin: 0 0 15px 0;
          font-size: 18px;
        }
        .next-steps ul {
          margin: 0;
          padding-left: 20px;
        }
        .next-steps li {
          margin: 8px 0;
          color: #92400e;
        }
        .footer {
          background: #f8fafc;
          padding: 30px;
          text-align: center;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          margin: 5px 0;
        }
        .social-links {
          margin: 20px 0;
        }
        .social-links a {
          display: inline-block;
          margin: 0 10px;
          color: #3b82f6;
          text-decoration: none;
        }
        @media (max-width: 600px) {
          .container {
            margin: 10px;
            border-radius: 8px;
          }
          .content {
            padding: 20px;
          }
          .action-buttons {
            padding: 0 5px;
          }
          .btn-container {
            gap: 10px;
          }
          .btn-container.horizontal {
            flex-direction: column;
            gap: 10px;
          }
          .btn {
            max-width: 100%;
            padding: 14px 16px;
            font-size: 15px;
            margin: 0;
            display: block;
            width: 100%;
          }
          .detail-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .detail-value {
            margin-top: 5px;
          }
        }
        @media (max-width: 400px) {
          .btn {
            padding: 12px 14px;
            font-size: 14px;
          }
          .action-buttons {
            padding: 0 2px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>❌ Appointment Cancelled by Admin</h1>
          <p>This appointment has been cancelled by our admin team</p>
        </div>
        
        <div class="content">
          <div class="appointment-card">
            <img src="${propertyImage}" alt="${propertyName}" class="property-image" />
            <h2 class="property-title">${propertyName}</h2>
            <p class="property-address">📍 ${propertyAddress || 'Address not specified'}</p>
            <p class="property-price">💰 ₹${propertyPrice || 'Price not specified'}</p>
            
            <div class="appointment-details">
              <div class="detail-row">
                <span class="detail-label">📅 Date:</span>
                <span class="detail-value">${appointmentDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Time:</span>
                <span class="detail-value">${appointmentTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">👤 ${isBuyer ? 'Seller' : 'Buyer'}:</span>
                <span class="detail-value">${isBuyer ? sellerName : buyerName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📊 Status:</span>
                <span class="detail-value">
                  <span class="status-badge">CANCELLED BY ADMIN</span>
                </span>
              </div>
              ${purpose ? `
              <div class="detail-row">
                <span class="detail-label">🎯 Purpose:</span>
                <span class="detail-value">${purpose}</span>
              </div>
              ` : ''}
            </div>
            
            ${message ? `
            <div class="message-section">
              <div class="message-label">💬 ${isBuyer ? 'Your' : 'Buyer\'s'} Message:</div>
              <div class="message-text">"${message}"</div>
            </div>
            ` : ''}
            
            ${cancellationReason ? `
            <div class="cancellation-reason">
              <h3>📝 Admin Cancellation Reason:</h3>
              <p>"${cancellationReason}"</p>
            </div>
            ` : ''}
            
            ${adminName ? `
            <div class="admin-info">
              <h4>👨‍💼 Admin Information:</h4>
              <p>Cancelled by: ${adminName}</p>
            </div>
            ` : ''}
          </div>
          
          <div class="action-buttons">
            <div class="btn-container horizontal">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/listing/${listingId}" class="btn btn-primary">
                🏠 View Property Details
              </a>
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-appointments" class="btn btn-secondary">
                📅 My Appointments
              </a>
            </div>
          </div>
          
          <div class="next-steps">
            <h3>📋 What's Next:</h3>
            <ul>
              ${isBuyer ? `
              <li>Don't worry! You can explore other similar properties</li>
              <li>Use our search filters to find properties that match your criteria</li>
              <li>Consider reaching out to other sellers for similar properties</li>
              <li>You can book new appointments anytime</li>
              <li>Contact our support team if you have any questions</li>
              ` : `
              <li>Your property is still available for other potential buyers</li>
              <li>You can continue to receive new appointment requests</li>
              <li>Consider updating your property listing if needed</li>
              <li>Monitor your appointments for new bookings</li>
              <li>Contact our support team if you have any questions</li>
              `}
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>UrbanSetu - Smart Real Estate Platform</strong></p>
          <p>We're here to help you find the perfect property match!</p>
          <div class="social-links">
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}">Website</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact">Support</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/privacy">Privacy</a>
          </div>
          <p style="font-size: 12px; margin-top: 20px;">
            This is an automated email. Please do not reply to this email address.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending appointment cancelled by admin email:', error);
    return createErrorResponse(error, 'appointment_cancelled_by_admin_email');
  }
};

// Unified Appointment Cancelled Email
export const sendAppointmentCancelledEmail = async (email, appointmentDetails, userRole) => {
  const { cancelledBy } = appointmentDetails;

  if (cancelledBy === 'buyer') {
    return sendAppointmentCancelledByBuyerEmail(email, appointmentDetails);
  } else if (cancelledBy === 'seller') {
    return sendAppointmentCancelledBySellerEmail(email, appointmentDetails);
  } else {
    // Default to admin cancellation if not specified or explicit admin
    return sendAppointmentCancelledByAdminEmail(email, appointmentDetails, userRole);
  }
};

// Appointment Reinitiated by Admin Email (to both buyer and seller)
export const sendAppointmentReinitiatedByAdminEmail = async (email, appointmentDetails, userRole) => {
  try {
    const {
      appointmentId,
      propertyName,
      propertyDescription,
      propertyAddress,
      propertyPrice,
      propertyImages,
      date,
      time,
      buyerName,
      sellerName,
      purpose,
      message,
      listingId,
      adminName
    } = appointmentDetails;

    const subject = `🔄 Appointment Reinitiated by Admin - ${propertyName} | UrbanSetu`;

    const isBuyer = userRole === 'buyer';
    const isSeller = userRole === 'seller';

    // Format date and time
    const appointmentDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const appointmentTime = time ? new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) : 'Time TBD';

    // Get property image for email
    const propertyImage = propertyImages && propertyImages.length > 0
      ? propertyImages[0]
      : `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/placeholder-property.jpg`;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Reinitiated by Admin - UrbanSetu</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 30px;
        }
        .appointment-card {
          background: #faf5ff;
          border: 2px solid #e9d5ff;
          border-radius: 12px;
          padding: 25px;
          margin: 20px 0;
        }
        .property-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .property-title {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 10px 0;
        }
        .property-address {
          color: #64748b;
          font-size: 16px;
          margin: 0 0 15px 0;
        }
        .property-price {
          font-size: 20px;
          font-weight: 700;
          color: #059669;
          margin: 0 0 20px 0;
        }
        .appointment-details {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #1f2937;
          font-weight: 500;
        }
        .status-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #e9d5ff;
          color: #7c3aed;
        }
        .admin-info {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
        }
        .admin-info h4 {
          color: #1e40af;
          margin: 0 0 5px 0;
          font-size: 16px;
        }
        .admin-info p {
          color: #1e40af;
          margin: 0;
          font-size: 14px;
        }
        .reinitiation-notice {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .reinitiation-notice h3 {
          color: #d97706;
          margin: 0 0 10px 0;
          font-size: 18px;
        }
        .reinitiation-notice p {
          color: #92400e;
          margin: 0;
        }
        .action-buttons {
          text-align: center;
          margin: 30px 0;
          padding: 0 10px;
        }
        .btn-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          max-width: 100%;
          width: 100%;
        }
        .btn-container.horizontal {
          flex-direction: row;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .btn {
          display: inline-block;
          width: auto;
          max-width: 280px;
          padding: 15px 25px;
          margin: 5px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          text-align: center;
          box-sizing: border-box;
          word-wrap: break-word;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .btn-container:not(.horizontal) .btn {
          display: block;
          width: 100%;
          margin: 0;
          padding: 12px 20px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white !important;
        }
        .btn-secondary {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white !important;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }
        .next-steps {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .next-steps h3 {
          color: #d97706;
          margin: 0 0 15px 0;
          font-size: 18px;
        }
        .next-steps ul {
          margin: 0;
          padding-left: 20px;
        }
        .next-steps li {
          margin: 8px 0;
          color: #92400e;
        }
        .footer {
          background: #f8fafc;
          padding: 30px;
          text-align: center;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          margin: 5px 0;
        }
        .social-links {
          margin: 20px 0;
        }
        .social-links a {
          display: inline-block;
          margin: 0 10px;
          color: #3b82f6;
          text-decoration: none;
        }
        @media (max-width: 600px) {
          .container {
            margin: 10px;
            border-radius: 8px;
          }
          .content {
            padding: 20px;
          }
          .action-buttons {
            padding: 0 5px;
          }
          .btn-container {
            gap: 10px;
          }
          .btn-container.horizontal {
            flex-direction: column;
            gap: 10px;
          }
          .btn {
            max-width: 100%;
            padding: 14px 16px;
            font-size: 15px;
            margin: 0;
            display: block;
            width: 100%;
          }
          .detail-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .detail-value {
            margin-top: 5px;
          }
        }
        @media (max-width: 400px) {
          .btn {
            padding: 12px 14px;
            font-size: 14px;
          }
          .action-buttons {
            padding: 0 2px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔄 Appointment Reinitiated</h1>
          <p>This appointment has been reinitiated by our admin team</p>
        </div>
        
        <div class="content">
          <div class="appointment-card">
            <img src="${propertyImage}" alt="${propertyName}" class="property-image" />
            <h2 class="property-title">${propertyName}</h2>
            <p class="property-address">📍 ${propertyAddress || 'Address not specified'}</p>
            <p class="property-price">💰 ₹${propertyPrice || 'Price not specified'}</p>
            
            <div class="appointment-details">
              <div class="detail-row">
                <span class="detail-label">📅 Date:</span>
                <span class="detail-value">${appointmentDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Time:</span>
                <span class="detail-value">${appointmentTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">👤 ${isBuyer ? 'Seller' : 'Buyer'}:</span>
                <span class="detail-value">${isBuyer ? sellerName : buyerName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📊 Status:</span>
                <span class="detail-value">
                  <span class="status-badge">REINITIATED</span>
                </span>
              </div>
              ${purpose ? `
              <div class="detail-row">
                <span class="detail-label">🎯 Purpose:</span>
                <span class="detail-value">${purpose}</span>
              </div>
              ` : ''}
            </div>
            
            ${message ? `
            <div class="message-section">
              <div class="message-label">💬 ${isBuyer ? 'Your' : 'Buyer\'s'} Message:</div>
              <div class="message-text">"${message}"</div>
            </div>
            ` : ''}
            
            ${adminName ? `
            <div class="admin-info">
              <h4>👨‍💼 Admin Information:</h4>
              <p>Reinitiated by: ${adminName}</p>
            </div>
            ` : ''}
            
            <div class="reinitiation-notice">
              <h3>🔄 What This Means:</h3>
              <p>This appointment was previously cancelled by an admin but has now been reinitiated. The appointment is back to pending status and both parties can now proceed with the booking process.</p>
            </div>
          </div>
          
          <div class="action-buttons">
            <div class="btn-container horizontal">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/listing/${listingId}" class="btn btn-primary">
                🏠 View Property Details
              </a>
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-appointments" class="btn btn-secondary">
                📅 My Appointments
              </a>
            </div>
          </div>
          
          <div class="next-steps">
            <h3>📋 Next Steps:</h3>
            <ul>
              ${isBuyer ? `
              <li>Review the appointment details and confirm if you still want to proceed</li>
              <li>You can communicate with the seller through the appointment chat</li>
              <li>Wait for the seller to accept or reject the appointment</li>
              <li>If accepted, prepare for your scheduled appointment</li>
              <li>Contact our support team if you have any questions</li>
              ` : `
              <li>Review the appointment details and decide whether to accept or reject</li>
              <li>You can communicate with the buyer through the appointment chat</li>
              <li>Consider the appointment details before making your decision</li>
              <li>If you accept, prepare for the scheduled appointment</li>
              <li>Contact our support team if you have any questions</li>
              `}
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>UrbanSetu - Smart Real Estate Platform</strong></p>
          <p>We're here to help facilitate successful property transactions!</p>
          <div class="social-links">
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}">Website</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact">Support</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/privacy">Privacy</a>
          </div>
          <p style="font-size: 12px; margin-top: 20px;">
            This is an automated email. Please do not reply to this email address.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending appointment reinitiated by admin email:', error);
    return createErrorResponse(error, 'appointment_reinitiated_by_admin_email');
  }
};

// Appointment Reinitiated by Seller Email (to buyer)
export const sendAppointmentReinitiatedBySellerEmail = async (email, appointmentDetails) => {
  try {
    const {
      appointmentId,
      propertyName,
      propertyDescription,
      propertyAddress,
      propertyPrice,
      propertyImages,
      date,
      time,
      sellerName,
      purpose,
      message,
      listingId,
      reinitiationCount
    } = appointmentDetails;

    const subject = `🔄 Appointment Reinitiated by Seller - ${propertyName} | UrbanSetu`;

    // Format date and time
    const appointmentDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const appointmentTime = time ? new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) : 'Time TBD';

    // Get property image for email
    const propertyImage = propertyImages && propertyImages.length > 0
      ? propertyImages[0]
      : `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/placeholder-property.jpg`;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Reinitiated by Seller - UrbanSetu</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 30px;
        }
        .appointment-card {
          background: #f0fdfa;
          border: 2px solid #a7f3d0;
          border-radius: 12px;
          padding: 25px;
          margin: 20px 0;
        }
        .property-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .property-title {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 10px 0;
        }
        .property-address {
          color: #64748b;
          font-size: 16px;
          margin: 0 0 15px 0;
        }
        .property-price {
          font-size: 20px;
          font-weight: 700;
          color: #059669;
          margin: 0 0 20px 0;
        }
        .appointment-details {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #1f2937;
          font-weight: 500;
        }
        .status-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #a7f3d0;
          color: #065f46;
        }
        .reinitiation-info {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .reinitiation-info h3 {
          color: #d97706;
          margin: 0 0 10px 0;
          font-size: 18px;
        }
        .reinitiation-info p {
          color: #92400e;
          margin: 0;
        }
        .action-buttons {
          text-align: center;
          margin: 30px 0;
          padding: 0 10px;
        }
        .btn-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          max-width: 100%;
          width: 100%;
        }
        .btn-container.horizontal {
          flex-direction: row;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .btn {
          display: inline-block;
          width: auto;
          max-width: 280px;
          padding: 15px 25px;
          margin: 5px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          text-align: center;
          box-sizing: border-box;
          word-wrap: break-word;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .btn-container:not(.horizontal) .btn {
          display: block;
          width: 100%;
          margin: 0;
          padding: 12px 20px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white !important;
        }
        .btn-secondary {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white !important;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }
        .next-steps {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .next-steps h3 {
          color: #d97706;
          margin: 0 0 15px 0;
          font-size: 18px;
        }
        .next-steps ul {
          margin: 0;
          padding-left: 20px;
        }
        .next-steps li {
          margin: 8px 0;
          color: #92400e;
        }
        .footer {
          background: #f8fafc;
          padding: 30px;
          text-align: center;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          margin: 5px 0;
        }
        .social-links {
          margin: 20px 0;
        }
        .social-links a {
          display: inline-block;
          margin: 0 10px;
          color: #3b82f6;
          text-decoration: none;
        }
        @media (max-width: 600px) {
          .container {
            margin: 10px;
            border-radius: 8px;
          }
          .content {
            padding: 20px;
          }
          .action-buttons {
            padding: 0 5px;
          }
          .btn-container {
            gap: 10px;
          }
          .btn-container.horizontal {
            flex-direction: column;
            gap: 10px;
          }
          .btn {
            max-width: 100%;
            padding: 14px 16px;
            font-size: 15px;
            margin: 0;
            display: block;
            width: 100%;
          }
          .detail-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .detail-value {
            margin-top: 5px;
          }
        }
        @media (max-width: 400px) {
          .btn {
            padding: 12px 14px;
            font-size: 14px;
          }
          .action-buttons {
            padding: 0 2px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔄 Appointment Reinitiated</h1>
          <p>The seller has reinitiated this appointment</p>
        </div>
        
        <div class="content">
          <div class="appointment-card">
            <img src="${propertyImage}" alt="${propertyName}" class="property-image" />
            <h2 class="property-title">${propertyName}</h2>
            <p class="property-address">📍 ${propertyAddress || 'Address not specified'}</p>
            <p class="property-price">💰 ₹${propertyPrice || 'Price not specified'}</p>
            
            <div class="appointment-details">
              <div class="detail-row">
                <span class="detail-label">📅 Date:</span>
                <span class="detail-value">${appointmentDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Time:</span>
                <span class="detail-value">${appointmentTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">👤 Seller:</span>
                <span class="detail-value">${sellerName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📊 Status:</span>
                <span class="detail-value">
                  <span class="status-badge">REINITIATED</span>
                </span>
              </div>
              ${purpose ? `
              <div class="detail-row">
                <span class="detail-label">🎯 Purpose:</span>
                <span class="detail-value">${purpose}</span>
              </div>
              ` : ''}
            </div>
            
            ${message ? `
            <div class="message-section">
              <div class="message-label">💬 Seller's Message:</div>
              <div class="message-text">"${message}"</div>
            </div>
            ` : ''}
            
            <div class="reinitiation-info">
              <h3>🔄 What This Means:</h3>
              <p>The seller has reinitiated this appointment with new details. This appointment was previously cancelled by the seller but they have now decided to proceed with it again. You can now review the updated details and decide whether to accept or reject this appointment.</p>
            </div>
          </div>
          
          <div class="action-buttons">
            <div class="btn-container horizontal">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/listing/${listingId}" class="btn btn-primary">
                🏠 View Property Details
              </a>
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-appointments" class="btn btn-secondary">
                📅 My Appointments
              </a>
            </div>
          </div>
          
          <div class="next-steps">
            <h3>📋 Next Steps:</h3>
            <ul>
              <li>Review the updated appointment details carefully</li>
              <li>Check if the new date and time work for you</li>
              <li>You can communicate with the seller through the appointment chat</li>
              <li>Decide whether to accept or reject this reinitiated appointment</li>
              <li>If you accept, prepare for your scheduled appointment</li>
              <li>Contact our support team if you have any questions</li>
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>UrbanSetu - Smart Real Estate Platform</strong></p>
          <p>We're here to help facilitate successful property transactions!</p>
          <div class="social-links">
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}">Website</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact">Support</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/privacy">Privacy</a>
          </div>
          <p style="font-size: 12px; margin-top: 20px;">
            This is an automated email. Please do not reply to this email address.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending appointment reinitiated by seller email:', error);
    return createErrorResponse(error, 'appointment_reinitiated_by_seller_email');
  }
};

// Appointment Reinitiated by Buyer Email (to seller)
export const sendAppointmentReinitiatedByBuyerEmail = async (email, appointmentDetails) => {
  try {
    const {
      appointmentId,
      propertyName,
      propertyDescription,
      propertyAddress,
      propertyPrice,
      propertyImages,
      date,
      time,
      buyerName,
      purpose,
      message,
      listingId,
      reinitiationCount
    } = appointmentDetails;

    const subject = `🔄 Appointment Reinitiated by Buyer - ${propertyName} | UrbanSetu`;

    // Format date and time
    const appointmentDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const appointmentTime = time ? new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) : 'Time TBD';

    // Get property image for email
    const propertyImage = propertyImages && propertyImages.length > 0
      ? propertyImages[0]
      : `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/placeholder-property.jpg`;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Reinitiated by Buyer - UrbanSetu</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 30px;
        }
        .appointment-card {
          background: #fffbeb;
          border: 2px solid #fed7aa;
          border-radius: 12px;
          padding: 25px;
          margin: 20px 0;
        }
        .property-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .property-title {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 10px 0;
        }
        .property-address {
          color: #64748b;
          font-size: 16px;
          margin: 0 0 15px 0;
        }
        .property-price {
          font-size: 20px;
          font-weight: 700;
          color: #059669;
          margin: 0 0 20px 0;
        }
        .appointment-details {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        .detail-value {
          color: #1f2937;
          font-weight: 500;
        }
        .status-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #fed7aa;
          color: #92400e;
        }
        .reinitiation-info {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .reinitiation-info h3 {
          color: #d97706;
          margin: 0 0 10px 0;
          font-size: 18px;
        }
        .reinitiation-info p {
          color: #92400e;
          margin: 0;
        }
        .action-buttons {
          text-align: center;
          margin: 30px 0;
          padding: 0 10px;
        }
        .btn-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          max-width: 100%;
          width: 100%;
        }
        .btn-container.horizontal {
          flex-direction: row;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .btn {
          display: inline-block;
          width: auto;
          max-width: 280px;
          padding: 15px 25px;
          margin: 5px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          text-align: center;
          box-sizing: border-box;
          word-wrap: break-word;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .btn-container:not(.horizontal) .btn {
          display: block;
          width: 100%;
          margin: 0;
          padding: 12px 20px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white !important;
        }
        .btn-secondary {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white !important;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }
        .next-steps {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .next-steps h3 {
          color: #d97706;
          margin: 0 0 15px 0;
          font-size: 18px;
        }
        .next-steps ul {
          margin: 0;
          padding-left: 20px;
        }
        .next-steps li {
          margin: 8px 0;
          color: #92400e;
        }
        .footer {
          background: #f8fafc;
          padding: 30px;
          text-align: center;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          margin: 5px 0;
        }
        .social-links {
          margin: 20px 0;
        }
        .social-links a {
          display: inline-block;
          margin: 0 10px;
          color: #3b82f6;
          text-decoration: none;
        }
        @media (max-width: 600px) {
          .container {
            margin: 10px;
            border-radius: 8px;
          }
          .content {
            padding: 20px;
          }
          .action-buttons {
            padding: 0 5px;
          }
          .btn-container {
            gap: 10px;
          }
          .btn-container.horizontal {
            flex-direction: column;
            gap: 10px;
          }
          .btn {
            max-width: 100%;
            padding: 14px 16px;
            font-size: 15px;
            margin: 0;
            display: block;
            width: 100%;
          }
          .detail-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .detail-value {
            margin-top: 5px;
          }
        }
        @media (max-width: 400px) {
          .btn {
            padding: 12px 14px;
            font-size: 14px;
          }
          .action-buttons {
            padding: 0 2px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔄 Appointment Reinitiated</h1>
          <p>The buyer has reinitiated this appointment</p>
        </div>
        
        <div class="content">
          <div class="appointment-card">
            <img src="${propertyImage}" alt="${propertyName}" class="property-image" />
            <h2 class="property-title">${propertyName}</h2>
            <p class="property-address">📍 ${propertyAddress || 'Address not specified'}</p>
            <p class="property-price">💰 ₹${propertyPrice || 'Price not specified'}</p>
            
            <div class="appointment-details">
              <div class="detail-row">
                <span class="detail-label">📅 Date:</span>
                <span class="detail-value">${appointmentDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Time:</span>
                <span class="detail-value">${appointmentTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">👤 Buyer:</span>
                <span class="detail-value">${buyerName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📊 Status:</span>
                <span class="detail-value">
                  <span class="status-badge">REINITIATED</span>
                </span>
              </div>
              ${purpose ? `
              <div class="detail-row">
                <span class="detail-label">🎯 Purpose:</span>
                <span class="detail-value">${purpose}</span>
              </div>
              ` : ''}
            </div>
            
            ${message ? `
            <div class="message-section">
              <div class="message-label">💬 Buyer's Message:</div>
              <div class="message-text">"${message}"</div>
            </div>
            ` : ''}
            
            <div class="reinitiation-info">
              <h3>🔄 What This Means:</h3>
              <p>The buyer has reinitiated this appointment with new details. This appointment was previously cancelled by the buyer but they have now decided to proceed with it again. You can now review the updated details and decide whether to accept or reject this appointment.</p>
            </div>
          </div>
          
          <div class="action-buttons">
            <div class="btn-container horizontal">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/listing/${listingId}" class="btn btn-primary">
                🏠 View Property Details
              </a>
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-appointments" class="btn btn-secondary">
                📅 My Appointments
              </a>
            </div>
          </div>
          
          <div class="next-steps">
            <h3>📋 Next Steps:</h3>
            <ul>
              <li>Review the updated appointment details carefully</li>
              <li>Check if the new date and time work for you</li>
              <li>You can communicate with the buyer through the appointment chat</li>
              <li>Decide whether to accept or reject this reinitiated appointment</li>
              <li>If you accept, prepare for the scheduled appointment</li>
              <li>Contact our support team if you have any questions</li>
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>UrbanSetu - Smart Real Estate Platform</strong></p>
          <p>We're here to help facilitate successful property transactions!</p>
          <div class="social-links">
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}">Website</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact">Support</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/privacy">Privacy</a>
          </div>
          <p style="font-size: 12px; margin-top: 20px;">
            This is an automated email. Please do not reply to this email address.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending appointment reinitiated by buyer email:', error);
    return createErrorResponse(error, 'appointment_reinitiated_by_buyer_email');
  }
};

// Send Refund Request Approved Email
export const sendRefundRequestApprovedEmail = async (email, refundDetails) => {
  try {
    const {
      propertyName,
      propertyAddress,
      propertyPrice,
      propertyImage,
      appointmentDate,
      appointmentTime,
      buyerName,
      requestedAmount,
      approvedAmount,
      originalAmount,
      currency,
      refundType,
      refundReason,
      adminNotes,
      refundId,
      processedAt,
      appointmentId,
      listingId
    } = refundDetails;

    const subject = `✅ Refund Request Approved - ${propertyName} | UrbanSetu`;

    // Format date and time
    const appointmentDateFormatted = new Date(appointmentDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const processedDate = new Date(processedAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const processedTime = new Date(processedAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Refund Request Approved - UrbanSetu</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .header p {
            margin: 10px 0 0;
            font-size: 16px;
            opacity: 0.9;
          }
          .content {
            padding: 30px;
          }
          .success-icon {
            text-align: center;
            margin-bottom: 20px;
          }
          .success-icon .icon {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #10b981, #059669);
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20px;
            box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3);
          }
          .success-icon .icon span {
            color: white;
            font-size: 36px;
            font-weight: bold;
          }
          .refund-card {
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            border: 2px solid #10b981;
            border-radius: 12px;
            padding: 25px;
            margin: 25px 0;
            text-align: center;
          }
          .refund-amount {
            font-size: 32px;
            font-weight: 700;
            color: #059669;
            margin: 10px 0;
          }
          .refund-status {
            background: #10b981;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
            display: inline-block;
            margin: 10px 0;
          }
          .property-card {
            background: #f8fafc;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
            border: 1px solid #e2e8f0;
          }
          .property-image {
            width: 100%;
            max-width: 200px;
            height: 150px;
            object-fit: cover;
            border-radius: 8px;
            margin: 0 auto 15px;
            display: block;
          }
          .property-title {
            font-size: 20px;
            font-weight: 600;
            color: #1f2937;
            margin: 0 0 10px;
            text-align: center;
          }
          .property-address {
            color: #6b7280;
            font-size: 14px;
            margin: 0 0 15px;
            text-align: center;
          }
          .property-price {
            font-size: 18px;
            font-weight: 600;
            color: #059669;
            text-align: center;
            margin: 0;
          }
          .details-section {
            background: #f8fafc;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .details-section h3 {
            color: #1f2937;
            margin: 0 0 15px;
            font-size: 18px;
            font-weight: 600;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            color: #6b7280;
            font-weight: 500;
          }
          .detail-value {
            color: #1f2937;
            font-weight: 600;
          }
          .refund-breakdown {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .refund-breakdown h3 {
            color: #d97706;
            margin: 0 0 15px;
            font-size: 18px;
            font-weight: 600;
          }
          .breakdown-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
          }
          .breakdown-label {
            color: #92400e;
            font-weight: 500;
          }
          .breakdown-value {
            color: #92400e;
            font-weight: 600;
          }
          .highlight {
            background: #fef3c7;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
          }
          .admin-notes {
            background: #eff6ff;
            border: 1px solid #3b82f6;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .admin-notes h3 {
            color: #1e40af;
            margin: 0 0 10px;
            font-size: 16px;
            font-weight: 600;
          }
          .admin-notes p {
            color: #1e40af;
            margin: 0;
            font-size: 14px;
            line-height: 1.5;
          }
          .action-buttons {
            text-align: center;
            margin: 30px 0;
            padding: 0 10px;
          }
          .btn-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: center;
            max-width: 100%;
            width: 100%;
          }
          .btn-container.horizontal {
            flex-direction: row;
            gap: 20px;
            justify-content: center;
            flex-wrap: wrap;
          }
          .btn {
            display: inline-block;
            width: auto;
            max-width: 280px;
            padding: 15px 25px;
            margin: 5px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            text-align: center;
            box-sizing: border-box;
            word-wrap: break-word;
            transition: all 0.3s ease;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .btn-container:not(.horizontal) .btn {
            display: block;
            width: 100%;
            margin: 0;
            padding: 12px 20px;
          }
          .btn-primary {
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white !important;
          }
          .btn-secondary {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white !important;
          }
          .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
          }
          .next-steps {
            background: #f0fdf4;
            border: 1px solid #10b981;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .next-steps h3 {
            color: #059669;
            margin: 0 0 15px;
            font-size: 18px;
            font-weight: 600;
          }
          .next-steps ul {
            margin: 0;
            padding-left: 20px;
            color: #047857;
          }
          .next-steps li {
            margin: 8px 0;
            line-height: 1.5;
          }
          .footer {
            background: #f8fafc;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            color: #6b7280;
            font-size: 14px;
            margin: 5px 0;
          }
          @media (max-width: 600px) {
            .container {
              margin: 0;
              border-radius: 0;
            }
            .header, .content {
              padding: 20px;
            }
            .refund-amount {
              font-size: 24px;
            }
            .btn-container.horizontal {
              flex-direction: column;
              gap: 10px;
            }
            .btn {
              max-width: 100%;
              padding: 14px 16px;
              font-size: 15px;
              margin: 0;
              display: block;
              width: 100%;
            }
            .detail-row {
              flex-direction: column;
              align-items: flex-start;
              gap: 5px;
            }
            .breakdown-row {
              flex-direction: column;
              align-items: flex-start;
              gap: 5px;
            }
          }
          @media (max-width: 400px) {
            .btn {
              padding: 12px 14px;
              font-size: 14px;
            }
            .action-buttons {
              padding: 0 2px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Refund Request Approved!</h1>
            <p>Your refund has been processed successfully</p>
          </div>
          
          <div class="content">
            <div class="success-icon">
              <div class="icon">
                <span>✓</span>
              </div>
            </div>
            
            <div class="refund-card">
              <div class="refund-amount">
                ${currency === 'INR' ? '₹' : '$'}${approvedAmount.toLocaleString()}
              </div>
              <div class="refund-status">REFUND APPROVED</div>
              <p style="margin: 10px 0 0; color: #047857; font-size: 14px;">
                ${approvedAmount >= originalAmount ? 'Full refund processed' : 'Partial refund processed'}
              </p>
            </div>
            
            <div class="property-card">
              <img src="${propertyImage}" alt="${propertyName}" class="property-image" />
              <h2 class="property-title">${propertyName}</h2>
              <p class="property-address">📍 ${propertyAddress || 'Address not specified'}</p>
              <p class="property-price">💰 ${currency === 'INR' ? '₹' : '$'}${propertyPrice || 'Price not specified'}</p>
            </div>
            
            <div class="details-section">
              <h3>📋 Refund Details</h3>
              <div class="detail-row">
                <span class="detail-label">👤 Buyer:</span>
                <span class="detail-value">${buyerName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📅 Appointment Date:</span>
                <span class="detail-value">${appointmentDateFormatted}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Appointment Time:</span>
                <span class="detail-value">${appointmentTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🆔 Refund ID:</span>
                <span class="detail-value">${refundId}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📅 Processed Date:</span>
                <span class="detail-value">${processedDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Processed Time:</span>
                <span class="detail-value">${processedTime}</span>
              </div>
            </div>
            
            <div class="refund-breakdown">
              <h3>💰 Refund Breakdown</h3>
              <div class="breakdown-row">
                <span class="breakdown-label">Original Payment Amount:</span>
                <span class="breakdown-value">${currency === 'INR' ? '₹' : '$'}${originalAmount.toLocaleString()}</span>
              </div>
              <div class="breakdown-row">
                <span class="breakdown-label">Requested Refund Amount:</span>
                <span class="breakdown-value">${currency === 'INR' ? '₹' : '$'}${requestedAmount.toLocaleString()}</span>
              </div>
              <div class="breakdown-row">
                <span class="breakdown-label">Approved Refund Amount:</span>
                <span class="breakdown-value highlight">${currency === 'INR' ? '₹' : '$'}${approvedAmount.toLocaleString()}</span>
              </div>
              ${approvedAmount !== requestedAmount ? `
              <div class="breakdown-row">
                <span class="breakdown-label">Admin Adjustment:</span>
                <span class="breakdown-value">${currency === 'INR' ? '₹' : '$'}${(approvedAmount - requestedAmount).toLocaleString()}</span>
              </div>
              ` : ''}
            </div>
            
            <div class="details-section">
              <h3>📝 Refund Information</h3>
              <div class="detail-row">
                <span class="detail-label">Refund Type:</span>
                <span class="detail-value">${approvedAmount >= originalAmount ? 'Full Refund' : 'Partial Refund'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Refund Reason:</span>
                <span class="detail-value">${refundReason}</span>
              </div>
            </div>
            
            ${adminNotes ? `
            <div class="admin-notes">
              <h3>💬 Admin Notes</h3>
              <p>${adminNotes}</p>
            </div>
            ` : ''}
            
            <div class="action-buttons">
              <div class="btn-container horizontal">
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/listing/${listingId}" class="btn btn-primary">
                  🏠 View Property Details
                </a>
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-appointments" class="btn btn-secondary">
                  📅 My Appointments
                </a>
              </div>
            </div>
            
            <div class="next-steps">
              <h3>📋 What's Next?</h3>
              <ul>
                <li>Your refund will be processed within 3-5 business days</li>
                <li>You will receive the refund in your original payment method</li>
                <li>Check your bank account or payment provider for the refund</li>
                <li>If you have any questions, contact our support team</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Thank you for using UrbanSetu!</strong></p>
            <p>If you have any questions about this refund, please contact our support team.</p>
            <p style="color: #9ca3af; margin: 15px 0 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending refund request approved email:', error);
    return createErrorResponse(error, 'refund_request_approved_email');
  }
};

// Send Refund Request Rejected Email
export const sendRefundRequestRejectedEmail = async (email, refundDetails) => {
  try {
    const {
      propertyName,
      propertyAddress,
      propertyPrice,
      propertyImage,
      appointmentDate,
      appointmentTime,
      buyerName,
      requestedAmount,
      originalAmount,
      currency,
      refundType,
      refundReason,
      adminNotes,
      processedAt,
      appointmentId,
      listingId
    } = refundDetails;

    const subject = `❌ Refund Request Rejected - ${propertyName} | UrbanSetu`;

    // Format date and time
    const appointmentDateFormatted = new Date(appointmentDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const processedDate = new Date(processedAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const processedTime = new Date(processedAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Refund Request Rejected - UrbanSetu</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .header p {
            margin: 10px 0 0;
            font-size: 16px;
            opacity: 0.9;
          }
          .content {
            padding: 30px;
          }
          .rejection-icon {
            text-align: center;
            margin-bottom: 20px;
          }
          .rejection-icon .icon {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #ef4444, #dc2626);
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20px;
            box-shadow: 0 8px 16px rgba(239, 68, 68, 0.3);
          }
          .rejection-icon .icon span {
            color: white;
            font-size: 36px;
            font-weight: bold;
          }
          .rejection-card {
            background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
            border: 2px solid #ef4444;
            border-radius: 12px;
            padding: 25px;
            margin: 25px 0;
            text-align: center;
          }
          .rejection-status {
            background: #ef4444;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
            display: inline-block;
            margin: 10px 0;
          }
          .property-card {
            background: #f8fafc;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
            border: 1px solid #e2e8f0;
          }
          .property-image {
            width: 100%;
            max-width: 200px;
            height: 150px;
            object-fit: cover;
            border-radius: 8px;
            margin: 0 auto 15px;
            display: block;
          }
          .property-title {
            font-size: 20px;
            font-weight: 600;
            color: #1f2937;
            margin: 0 0 10px;
            text-align: center;
          }
          .property-address {
            color: #6b7280;
            font-size: 14px;
            margin: 0 0 15px;
            text-align: center;
          }
          .property-price {
            font-size: 18px;
            font-weight: 600;
            color: #059669;
            text-align: center;
            margin: 0;
          }
          .details-section {
            background: #f8fafc;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .details-section h3 {
            color: #1f2937;
            margin: 0 0 15px;
            font-size: 18px;
            font-weight: 600;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            color: #6b7280;
            font-weight: 500;
          }
          .detail-value {
            color: #1f2937;
            font-weight: 600;
          }
          .refund-breakdown {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .refund-breakdown h3 {
            color: #d97706;
            margin: 0 0 15px;
            font-size: 18px;
            font-weight: 600;
          }
          .breakdown-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
          }
          .breakdown-label {
            color: #92400e;
            font-weight: 500;
          }
          .breakdown-value {
            color: #92400e;
            font-weight: 600;
          }
          .rejection-reason {
            background: #fef2f2;
            border: 1px solid #ef4444;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .rejection-reason h3 {
            color: #dc2626;
            margin: 0 0 10px;
            font-size: 16px;
            font-weight: 600;
          }
          .rejection-reason p {
            color: #dc2626;
            margin: 0;
            font-size: 14px;
            line-height: 1.5;
          }
          .action-buttons {
            text-align: center;
            margin: 30px 0;
            padding: 0 10px;
          }
          .btn-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: center;
            max-width: 100%;
            width: 100%;
          }
          .btn-container.horizontal {
            flex-direction: row;
            gap: 20px;
            justify-content: center;
            flex-wrap: wrap;
          }
          .btn {
            display: inline-block;
            width: auto;
            max-width: 280px;
            padding: 15px 25px;
            margin: 5px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            text-align: center;
            box-sizing: border-box;
            word-wrap: break-word;
            transition: all 0.3s ease;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .btn-container:not(.horizontal) .btn {
            display: block;
            width: 100%;
            margin: 0;
            padding: 12px 20px;
          }
          .btn-primary {
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white !important;
          }
          .btn-secondary {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white !important;
          }
          .btn-outline {
            background: transparent;
            color: #7c3aed !important;
            border: 2px solid #7c3aed;
          }
          .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
          }
          .appeal-section {
            background: #f3e8ff;
            border: 1px solid #7c3aed;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .appeal-section h3 {
            color: #7c3aed;
            margin: 0 0 15px;
            font-size: 18px;
            font-weight: 600;
          }
          .appeal-section ul {
            margin: 0;
            padding-left: 20px;
            color: #6b21a8;
          }
          .appeal-section li {
            margin: 8px 0;
            line-height: 1.5;
          }
          .footer {
            background: #f8fafc;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            color: #6b7280;
            font-size: 14px;
            margin: 5px 0;
          }
          @media (max-width: 600px) {
            .container {
              margin: 0;
              border-radius: 0;
            }
            .header, .content {
              padding: 20px;
            }
            .btn-container.horizontal {
              flex-direction: column;
              gap: 10px;
            }
            .btn {
              max-width: 100%;
              padding: 14px 16px;
              font-size: 15px;
              margin: 0;
              display: block;
              width: 100%;
            }
            .detail-row {
              flex-direction: column;
              align-items: flex-start;
              gap: 5px;
            }
            .breakdown-row {
              flex-direction: column;
              align-items: flex-start;
              gap: 5px;
            }
          }
          @media (max-width: 400px) {
            .btn {
              padding: 12px 14px;
              font-size: 14px;
            }
            .action-buttons {
              padding: 0 2px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Refund Request Rejected</h1>
            <p>Your refund request could not be approved</p>
          </div>
          
          <div class="content">
            <div class="rejection-icon">
              <div class="icon">
                <span>✗</span>
              </div>
            </div>
            
            <div class="rejection-card">
              <div class="rejection-status">REFUND REJECTED</div>
              <p style="margin: 10px 0 0; color: #dc2626; font-size: 14px;">
                Your refund request has been reviewed and cannot be approved at this time
              </p>
            </div>
            
            <div class="property-card">
              <img src="${propertyImage}" alt="${propertyName}" class="property-image" />
              <h2 class="property-title">${propertyName}</h2>
              <p class="property-address">📍 ${propertyAddress || 'Address not specified'}</p>
              <p class="property-price">💰 ${currency === 'INR' ? '₹' : '$'}${propertyPrice || 'Price not specified'}</p>
            </div>
            
            <div class="details-section">
              <h3>📋 Request Details</h3>
              <div class="detail-row">
                <span class="detail-label">👤 Buyer:</span>
                <span class="detail-value">${buyerName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📅 Appointment Date:</span>
                <span class="detail-value">${appointmentDateFormatted}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Appointment Time:</span>
                <span class="detail-value">${appointmentTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📅 Rejected Date:</span>
                <span class="detail-value">${processedDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Rejected Time:</span>
                <span class="detail-value">${processedTime}</span>
              </div>
            </div>
            
            <div class="refund-breakdown">
              <h3>💰 Refund Request Details</h3>
              <div class="breakdown-row">
                <span class="breakdown-label">Original Payment Amount:</span>
                <span class="breakdown-value">${currency === 'INR' ? '₹' : '$'}${originalAmount.toLocaleString()}</span>
              </div>
              <div class="breakdown-row">
                <span class="breakdown-label">Requested Refund Amount:</span>
                <span class="breakdown-value">${currency === 'INR' ? '₹' : '$'}${requestedAmount.toLocaleString()}</span>
              </div>
              <div class="breakdown-row">
                <span class="breakdown-label">Refund Type:</span>
                <span class="breakdown-value">${requestedAmount >= originalAmount ? 'Full Refund' : 'Partial Refund'}</span>
              </div>
            </div>
            
            <div class="details-section">
              <h3>📝 Request Information</h3>
              <div class="detail-row">
                <span class="detail-label">Your Reason:</span>
                <span class="detail-value">${refundReason}</span>
              </div>
            </div>
            
            ${adminNotes ? `
            <div class="rejection-reason">
              <h3>💬 Admin Response</h3>
              <p>${adminNotes}</p>
            </div>
            ` : ''}
            
            <div class="action-buttons">
              <div class="btn-container horizontal">
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/listing/${listingId}" class="btn btn-primary">
                  🏠 View Property Details
                </a>
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-appointments" class="btn btn-secondary">
                  📅 My Appointments
                </a>
              </div>
            </div>
            
            <div class="appeal-section">
              <h3>🔄 Appeal Your Refund Request</h3>
              <p style="color: #6b21a8; margin: 0 0 15px; font-size: 14px;">
                If you believe this decision was made in error, you can appeal your refund request with additional information or documentation.
              </p>
              <ul>
                <li>Provide additional evidence or documentation</li>
                <li>Explain any new circumstances</li>
                <li>Include any relevant proof or receipts</li>
                <li>Be specific about why you believe the refund should be approved</li>
              </ul>
              <div style="text-align: center; margin-top: 20px;">
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-appointments" class="btn btn-outline">
                  🔄 Appeal Refund Request
                </a>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>We're here to help!</strong></p>
            <p>If you have any questions about this decision or need assistance, please contact our support team.</p>
            <p style="color: #9ca3af; margin: 15px 0 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending refund request rejected email:', error);
    return createErrorResponse(error, 'refund_request_rejected_email');
  }
};

// Property Listing Published Email
export const sendPropertyListingPublishedEmail = async (email, listingDetails, isAdminCreated = false) => {
  try {
    const {
      listingId,
      propertyName,
      propertyDescription,
      propertyAddress,
      propertyPrice,
      propertyType,
      bedrooms,
      bathrooms,
      area,
      city,
      state,
      imageUrls,
      createdBy
    } = listingDetails;

    const subject = isAdminCreated
      ? `🏠 Property Added by Admin - ${propertyName}`
      : `🎉 Your Property "${propertyName}" is Now Live!`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .property-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 20px 0; background-color: #f9fafb; }
          .property-image { width: 100%; max-width: 300px; height: 200px; object-fit: cover; border-radius: 8px; margin: 10px 0; }
          .price { font-size: 24px; font-weight: bold; color: #059669; margin: 10px 0; }
          .details { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 15px 0; }
          .detail-item { background-color: #ffffff; padding: 10px; border-radius: 6px; text-align: center; }
          .btn { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 5px; }
          .btn:hover { background-color: #2563eb; }
          .btn-outline { background-color: transparent; color: #3b82f6; border: 2px solid #3b82f6; }
          .btn-outline:hover { background-color: #3b82f6; color: white; }
          .footer { background-color: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; }
          .admin-notice { background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 15px 0; }
          .admin-notice h3 { color: #92400e; margin: 0 0 10px 0; }
          .admin-notice p { color: #92400e; margin: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${isAdminCreated ? '🏠 Property Added by Admin' : '🎉 Property Successfully Published!'}</h1>
            <p>${isAdminCreated ? 'A new property has been added to your account' : 'Your property is now live and visible to potential buyers'}</p>
          </div>
          
          <div class="content">
            ${isAdminCreated ? `
              <div class="admin-notice">
                <h3>📋 Admin Action</h3>
                <p>This property was created by an admin on your behalf. You can manage it from your property dashboard.</p>
              </div>
            ` : ''}
            
            <div class="property-card">
              <h2 style="color: #1f2937; margin: 0 0 15px 0;">${propertyName}</h2>
              
              ${imageUrls && imageUrls.length > 0 ? `
                <img src="${imageUrls[0]}" alt="${propertyName}" class="property-image">
              ` : ''}
              
              <div class="price">₹${new Intl.NumberFormat('en-IN').format(propertyPrice)}</div>
              
              <div class="details">
                <div class="detail-item">
                  <strong>Type</strong><br>
                  ${propertyType === 'rent' ? 'For Rent' : 'For Sale'}
                </div>
                <div class="detail-item">
                  <strong>Bedrooms</strong><br>
                  ${bedrooms || 'N/A'}
                </div>
                <div class="detail-item">
                  <strong>Bathrooms</strong><br>
                  ${bathrooms || 'N/A'}
                </div>
                <div class="detail-item">
                  <strong>Area</strong><br>
                  ${area ? `${area} sq ft` : 'N/A'}
                </div>
              </div>
              
              <p><strong>📍 Location:</strong> ${propertyAddress}, ${city}, ${state}</p>
              
              ${propertyDescription ? `
                <p><strong>Description:</strong></p>
                <p style="color: #6b7280; line-height: 1.6;">${propertyDescription}</p>
              ` : ''}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/listing/${listingId}" class="btn">
                🏠 View Property
              </a>
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-listings" class="btn btn-outline">
                📋 My Properties
              </a>
            </div>
            
            <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #0c4a6e; margin: 0 0 15px 0;">🚀 What's Next?</h3>
              <ul style="color: #0c4a6e; margin: 0; padding-left: 20px;">
                <li>Your property is now visible to potential buyers</li>
                <li>You'll receive notifications for new inquiries</li>
                <li>Monitor your property's performance in the dashboard</li>
                <li>Respond quickly to appointment requests</li>
                <li>Keep your property information updated</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Need help managing your property?</strong></p>
            <p>Contact our support team for assistance with your listing.</p>
            <p style="color: #9ca3af; margin: 15px 0 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending property listing published email:', error);
    return createErrorResponse(error, 'property_listing_published_email');
  }
};

// Property Created - Pending Verification Email
export const sendPropertyCreatedPendingVerificationEmail = async (email, listingDetails, isAdminCreated = false) => {
  try {
    const {
      listingId,
      propertyName,
      propertyDescription,
      propertyAddress,
      propertyPrice,
      propertyType,
      bedrooms,
      bathrooms,
      area,
      city,
      state,
      imageUrls
    } = listingDetails;

    const subject = isAdminCreated
      ? `🏠 Property Created by Admin - Verification Required`
      : `✅ Property Created Successfully - Complete Verification to Publish`;

    const verificationUrl = `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/property-verification?listingId=${listingId}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .property-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 20px 0; background-color: #f9fafb; }
          .property-image { width: 100%; max-width: 300px; height: 200px; object-fit: cover; border-radius: 8px; margin: 10px 0; }
          .price { font-size: 24px; font-weight: bold; color: #059669; margin: 10px 0; }
          .details { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 15px 0; }
          .detail-item { background-color: #ffffff; padding: 10px; border-radius: 6px; text-align: center; }
          .btn { display: inline-block; padding: 14px 28px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 8px; font-weight: 700; margin: 10px 5px; font-size: 16px; }
          .btn:hover { background-color: #d97706; }
          .btn-secondary { background-color: #3b82f6; }
          .btn-secondary:hover { background-color: #2563eb; }
          .warning-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .warning-box h3 { color: #92400e; margin: 0 0 10px 0; }
          .warning-box p { color: #92400e; margin: 5px 0; line-height: 1.6; }
          .info-box { background-color: #dbeafe; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .info-box h3 { color: #1e40af; margin: 0 0 10px 0; }
          .info-box ul { color: #1e40af; margin: 10px 0; padding-left: 20px; }
          .info-box li { margin: 8px 0; }
          .footer { background-color: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; }
          .admin-notice { background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏠 Property Created Successfully!</h1>
            <p style="font-size: 18px; margin: 10px 0 0;">Complete verification to make it live</p>
          </div>
          
          <div class="content">
            ${isAdminCreated ? `
              <div class="admin-notice">
                <h3>📋 Admin Action</h3>
                <p>This property was created by an admin on your behalf. Please complete the verification process to publish it.</p>
              </div>
            ` : ''}
            
            <div class="warning-box">
              <h3>⚠️ Verification Required</h3>
              <p><strong>Your property has been created but is NOT yet published.</strong></p>
              <p>To make your property visible to potential ${propertyType === 'rent' ? 'tenants' : 'buyers'}, you need to complete the verification process.</p>
              <p style="margin-top: 15px;"><strong>Why verification?</strong> It helps build trust and ensures all listings on UrbanSetu are genuine.</p>
            </div>
            
            <div class="property-card">
              <h2 style="color: #1f2937; margin: 0 0 15px 0;">${propertyName}</h2>
              
              ${imageUrls && imageUrls.length > 0 ? `
                <img src="${imageUrls[0]}" alt="${propertyName}" class="property-image">
              ` : ''}
              
              <div class="price">₹${new Intl.NumberFormat('en-IN').format(propertyPrice)}</div>
              
              <div class="details">
                <div class="detail-item">
                  <strong>Type</strong><br>
                  ${propertyType === 'rent' ? 'For Rent' : 'For Sale'}
                </div>
                <div class="detail-item">
                  <strong>Bedrooms</strong><br>
                  ${bedrooms || 'N/A'}
                </div>
                <div class="detail-item">
                  <strong>Bathrooms</strong><br>
                  ${bathrooms || 'N/A'}
                </div>
                <div class="detail-item">
                  <strong>Area</strong><br>
                  ${area ? `${area} sq ft` : 'N/A'}
                </div>
              </div>
              
              <p><strong>📍 Location:</strong> ${propertyAddress}, ${city}, ${state}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" class="btn">
                🛡️ Complete Verification Now
              </a>
            </div>
            
            <div class="info-box">
              <h3>📋 Verification Process</h3>
              <ul>
                <li><strong>Step 1:</strong> Upload ownership documents (sale deed, lease agreement, etc.)</li>
                <li><strong>Step 2:</strong> Upload identity proof (Aadhaar, PAN, Passport, etc.)</li>
                <li><strong>Step 3:</strong> Upload address proof (utility bill, bank statement, etc.)</li>
                <li><strong>Step 4:</strong> Our team will review within 24-48 hours</li>
                <li><strong>Step 5:</strong> Once verified, your property goes live! 🎉</li>
              </ul>
            </div>
            
            <div style="background-color: #f0fdf4; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
              <h3 style="color: #065f46; margin: 0 0 10px 0;">✨ Benefits of Verification</h3>
              <p style="color: #065f46; margin: 5px 0;">✓ Verified badge on your listing</p>
              <p style="color: #065f46; margin: 5px 0;">✓ Higher visibility in search results</p>
              <p style="color: #065f46; margin: 5px 0;">✓ Unlock premium 360° virtual tours</p>
              <p style="color: #065f46; margin: 5px 0;">✓ Increased trust from potential ${propertyType === 'rent' ? 'tenants' : 'buyers'}</p>
              <p style="color: #065f46; margin: 5px 0;">✓ Faster inquiries and bookings</p>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Need help with verification?</strong></p>
            <p>Contact our support team for assistance.</p>
            <p style="color: #9ca3af; margin: 15px 0 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending property created pending verification email:', error);
    return createErrorResponse(error, 'property_created_pending_verification_email');
  }
};

// Property Verification Reminder Email
export const sendPropertyVerificationReminderEmail = async (email, listingDetails, daysSinceCreation) => {
  try {
    const {
      listingId,
      propertyName,
      propertyType,
      city,
      state
    } = listingDetails;

    const subject = `⏰ Reminder: Verify Your Property "${propertyName}" - Day ${daysSinceCreation}`;
    const verificationUrl = `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/property-verification?listingId=${listingId}`;

    const urgencyLevel = daysSinceCreation >= 7 ? 'high' : daysSinceCreation >= 3 ? 'medium' : 'low';
    const urgencyColor = urgencyLevel === 'high' ? '#dc2626' : urgencyLevel === 'medium' ? '#f59e0b' : '#3b82f6';
    const urgencyBg = urgencyLevel === 'high' ? '#fee2e2' : urgencyLevel === 'medium' ? '#fef3c7' : '#dbeafe';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%); color: white; padding: 30px 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .reminder-box { background-color: ${urgencyBg}; border-left: 4px solid ${urgencyColor}; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .reminder-box h3 { color: ${urgencyColor}; margin: 0 0 10px 0; }
          .reminder-box p { color: ${urgencyColor}; margin: 5px 0; line-height: 1.6; }
          .btn { display: inline-block; padding: 14px 28px; background-color: ${urgencyColor}; color: white; text-decoration: none; border-radius: 8px; font-weight: 700; margin: 10px 5px; font-size: 16px; }
          .btn:hover { opacity: 0.9; }
          .stats-box { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
          .stat { display: inline-block; margin: 10px 20px; }
          .stat-number { font-size: 32px; font-weight: bold; color: ${urgencyColor}; }
          .stat-label { font-size: 14px; color: #6b7280; margin-top: 5px; }
          .footer { background-color: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Verification Reminder</h1>
            <p style="font-size: 18px; margin: 10px 0 0;">Your property is waiting to go live!</p>
          </div>
          
          <div class="content">
            <div class="reminder-box">
              <h3>${urgencyLevel === 'high' ? '🚨 Urgent' : urgencyLevel === 'medium' ? '⚠️ Important' : '📢 Reminder'}</h3>
              <p><strong>Your property "${propertyName}" has been created ${daysSinceCreation} day${daysSinceCreation > 1 ? 's' : ''} ago but is still not published.</strong></p>
              <p>Complete the verification process to make it visible to potential ${propertyType === 'rent' ? 'tenants' : 'buyers'}.</p>
            </div>
            
            <div class="stats-box">
              <div class="stat">
                <div class="stat-number">${daysSinceCreation}</div>
                <div class="stat-label">Days Waiting</div>
              </div>
              <div class="stat">
                <div class="stat-number">0</div>
                <div class="stat-label">Views</div>
              </div>
              <div class="stat">
                <div class="stat-number">0</div>
                <div class="stat-label">Inquiries</div>
              </div>
            </div>
            
            <div style="background-color: #f0fdf4; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #065f46; margin: 0 0 15px 0;">💡 Did You Know?</h3>
              <p style="color: #065f46; margin: 5px 0;">✓ Verified properties get <strong>3x more views</strong></p>
              <p style="color: #065f46; margin: 5px 0;">✓ Verification takes only <strong>24-48 hours</strong></p>
              <p style="color: #065f46; margin: 5px 0;">✓ <strong>90% of users</strong> prefer verified listings</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" class="btn">
                🛡️ Complete Verification Now
              </a>
            </div>
            
            <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #1f2937; margin: 0 0 15px 0;">📋 Quick Verification Checklist</h3>
              <p style="color: #6b7280; margin: 5px 0;">☐ Upload ownership documents</p>
              <p style="color: #6b7280; margin: 5px 0;">☐ Upload identity proof</p>
              <p style="color: #6b7280; margin: 5px 0;">☐ Upload address proof</p>
              <p style="color: #6b7280; margin: 5px 0;">☐ Submit for review</p>
            </div>
            
            <p style="text-align: center; color: #6b7280; margin: 20px 0;">
              <strong>Property:</strong> ${propertyName}<br>
              <strong>Location:</strong> ${city}, ${state}
            </p>
          </div>
          
          <div class="footer">
            <p><strong>Need help?</strong></p>
            <p>Our support team is here to assist you with the verification process.</p>
            <p style="color: #9ca3af; margin: 15px 0 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending property verification reminder email:', error);
    return createErrorResponse(error, 'property_verification_reminder_email');
  }
};

// Property Published After Verification Email
export const sendPropertyPublishedAfterVerificationEmail = async (email, listingDetails) => {
  try {
    const {
      listingId,
      propertyName,
      propertyDescription,
      propertyAddress,
      propertyPrice,
      propertyType,
      bedrooms,
      bathrooms,
      area,
      city,
      state,
      imageUrls,
      badgeNumber,
      propertyId // Add propertyId as fallback
    } = listingDetails;

    // Use listingId or propertyId interchangeably
    const finalListingId = listingId || propertyId;

    const subject = `🎉 Your Property "${propertyName}" is Now Live & Verified!`;
    const listingUrl = `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/listing/${finalListingId}`;
    const dashboardUrl = `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-listings`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .property-card { border: 2px solid #10b981; border-radius: 12px; padding: 20px; margin: 20px 0; background-color: #f0fdf4; position: relative; }
          .verified-badge { position: absolute; top: -15px; right: 20px; background-color: #10b981; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .property-image { width: 100%; max-width: 300px; height: 200px; object-fit: cover; border-radius: 8px; margin: 10px 0; }
          .price { font-size: 28px; font-weight: bold; color: #059669; margin: 10px 0; }
          .details { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 15px 0; }
          .detail-item { background-color: #ffffff; padding: 10px; border-radius: 6px; text-align: center; border: 1px solid #d1fae5; }
          .btn { display: inline-block; padding: 14px 28px; background-color: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: 700; margin: 10px 5px; font-size: 16px; }
          .btn:hover { background-color: #059669; }
          .btn-outline { background-color: transparent; color: #10b981; border: 2px solid #10b981; }
          .btn-outline:hover { background-color: #10b981; color: white; }
          .success-box { background-color: #d1fae5; border-left: 4px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .success-box h3 { color: #065f46; margin: 0 0 10px 0; }
          .success-box p { color: #065f46; margin: 5px 0; line-height: 1.6; }
          .info-box { background-color: #dbeafe; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .info-box h3 { color: #1e40af; margin: 0 0 10px 0; }
          .info-box ul { color: #1e40af; margin: 10px 0; padding-left: 20px; }
          .info-box li { margin: 8px 0; }
          .footer { background-color: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; }
          .share-buttons { display: flex; justify-content: center; gap: 10px; margin: 20px 0; flex-wrap: wrap; }
          .share-btn { display: inline-flex; align-items: center; gap: 5px; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; }
          .share-whatsapp { background-color: #25d366; color: white; }
          .share-facebook { background-color: #1877f2; color: white; }
          .share-twitter { background-color: #1da1f2; color: white; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="font-size: 32px; margin: 0 0 10px;">🎉 Congratulations!</h1>
            <p style="font-size: 20px; margin: 0;">Your Property is Now Live & Verified!</p>
          </div>
          
          <div class="content">
            <div class="success-box">
              <h3>✅ Verification Complete!</h3>
              <p><strong>Great news!</strong> Your property has been successfully verified by our team.</p>
              <p>Your listing is now live and visible to thousands of potential ${propertyType === 'rent' ? 'tenants' : 'buyers'}!</p>
              <div style="background-color: #d1fae5; border: 1px dashed #059669; border-radius: 6px; padding: 10px; margin-top: 15px;">
                <p style="color: #065f46; margin: 0; font-size: 14px;"><strong>🌟 Premium Status Unlocked:</strong> Your verified property is now eligible for immersive 360° virtual tours. Add them anytime to wow your audience!</p>
              </div>
              ${badgeNumber ? `<p style="margin-top: 10px;"><strong>Verification Badge:</strong> ${badgeNumber}</p>` : ''}
            </div>
            
            <div class="property-card">
              <div class="verified-badge">✓ VERIFIED</div>
              <h2 style="color: #1f2937; margin: 0 0 15px 0;">${propertyName}</h2>
              
              ${imageUrls && imageUrls.length > 0 ? `
                <img src="${imageUrls[0]}" alt="${propertyName}" class="property-image">
              ` : ''}
              
              <div class="price">₹${new Intl.NumberFormat('en-IN').format(propertyPrice)}</div>
              
              <div class="details">
                <div class="detail-item">
                  <strong>Type</strong><br>
                  ${propertyType === 'rent' ? 'For Rent' : 'For Sale'}
                </div>
                <div class="detail-item">
                  <strong>Bedrooms</strong><br>
                  ${bedrooms || 'N/A'}
                </div>
                <div class="detail-item">
                  <strong>Bathrooms</strong><br>
                  ${bathrooms || 'N/A'}
                </div>
                <div class="detail-item">
                  <strong>Area</strong><br>
                  ${area ? `${area} sq ft` : 'N/A'}
                </div>
              </div>
              
              <p><strong>📍 Location:</strong> ${propertyAddress}, ${city}, ${state}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${listingUrl}" class="btn">
                🏠 View Your Live Property
              </a>
              <a href="${dashboardUrl}" class="btn btn-outline">
                📋 Go to Dashboard
              </a>
            </div>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #92400e; margin: 0 0 15px 0;">📢 Share Your Property</h3>
              <p style="color: #92400e; margin: 0 0 15px 0;">Spread the word and get more inquiries!</p>
              <div class="share-buttons">
                <a href="https://wa.me/?text=Check%20out%20this%20property%20on%20UrbanSetu%3A%20${encodeURIComponent(listingUrl)}" class="share-btn share-whatsapp" target="_blank">
                  📱 WhatsApp
                </a>
                <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(listingUrl)}" class="share-btn share-facebook" target="_blank">
                  👥 Facebook
                </a>
                <a href="https://twitter.com/intent/tweet?text=Check%20out%20this%20property&url=${encodeURIComponent(listingUrl)}" class="share-btn share-twitter" target="_blank">
                  🐦 Twitter
                </a>
              </div>
            </div>
            
            <div class="info-box">
              <h3>🚀 What's Next?</h3>
              <ul>
                <li><strong>Monitor Performance:</strong> Track views and inquiries in your dashboard</li>
                <li><strong>Respond Quickly:</strong> Reply to appointment requests within 24 hours</li>
                <li><strong>Keep Updated:</strong> Update property details if anything changes</li>
                <li><strong>Professional Photos:</strong> Add more high-quality images to attract buyers</li>
                <li><strong>Competitive Pricing:</strong> Review market rates to stay competitive</li>
              </ul>
            </div>
            
            <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
              <h3 style="color: #0c4a6e; margin: 0 0 10px 0;">💎 Premium Features</h3>
              <p style="color: #0c4a6e; margin: 5px 0;">Want to boost your listing's visibility?</p>
              <p style="color: #0c4a6e; margin: 5px 0;">Explore our premium features for faster results!</p>
              <a href="${dashboardUrl}" style="display: inline-block; margin-top: 10px; padding: 10px 20px; background-color: #0ea5e9; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Explore Premium
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Thank you for choosing UrbanSetu!</strong></p>
            <p>We're here to help you find the perfect ${propertyType === 'rent' ? 'tenant' : 'buyer'}.</p>
            <p style="color: #9ca3af; margin: 15px 0 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending property published after verification email:', error);
    return createErrorResponse(error, 'property_published_after_verification_email');
  }
};



export const sendOwnerDeassignedEmail = async (email, details = {}) => {
  const {
    propertyName,
    propertyId,
    reason,
    adminName,
    ownerName
  } = details;

  const clientUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const propertyUrl = propertyId ? `${clientUrl}/listing/${propertyId}` : clientUrl;
  const supportUrl = `${clientUrl}/contact`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Property Ownership Update</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08); }
        .header { background: linear-gradient(135deg, #ea580c, #c2410c); color: white; padding: 30px 25px; text-align: center; }
        .content { padding: 30px 25px; color: #1f2937; }
        .reason-box { background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 20px; border-radius: 8px; margin: 20px 0; color: #7c2d12; }
                 .actions { display: flex; flex-direction: column; gap: 12px; margin: 30px 0; }
                 .btn { width: 100%; text-align: center; padding: 14px 20px; border-radius: 30px; font-weight: 600; text-decoration: none; border: none; }
        .btn-primary { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; }
        .btn-outline { border: 2px solid #2563eb; color: #2563eb; background: white; }
        .footer { background-color: #f1f5f9; padding: 20px; text-align: center; color: #94a3b8; font-size: 13px; }
      </style>
    </head>
    <body>
      <div style="padding: 30px 15px; background-color: #f8fafc;">
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 26px;">Property Ownership Update</h1>
          </div>
          <div class="content">
            <p style="font-size: 16px; line-height: 1.6;">
              Hello ${ownerName || 'there'},
            </p>
            <p style="font-size: 16px; line-height: 1.6;">
              This is to inform you that you have been removed as the owner of
              <strong>${propertyName || 'a property on UrbanSetu'}</strong>.
            </p>
            <div class="reason-box">
              <strong>Provided Reason:</strong>
              <p style="margin: 10px 0 0;">${reason || 'No reason was provided.'}</p>
            </div>
            <p style="font-size: 15px; line-height: 1.6; color: #475569;">
              ${adminName ? `This action was performed by ${adminName}.` : 'This action was completed by an administrator.'}
              If you have questions about this update or believe it was made in error, please reach out to us.
            </p>
            <div class="actions">
              <a href="${propertyUrl}" class="btn btn-primary">View Property</a>
              <a href="${supportUrl}" class="btn btn-outline">Contact Support</a>
            </div>
            <p style="font-size: 14px; color: #475569; margin-top: 30px;">
              We appreciate your contributions to the UrbanSetu community. You can continue to manage or list other
              properties from your dashboard.
            </p>
          </div>
          <div class="footer">
            <p style="margin: 0;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    return await sendEmailWithRetry({
      to: email,
      subject: `Ownership Update - ${propertyName || 'UrbanSetu Property'}`,
      html
    });
  } catch (error) {
    console.error('Error sending owner deassigned email:', error);
    throw error;
  }
};

export const sendOwnerAssignedEmail = async (email, details = {}) => {
  const {
    propertyName,
    propertyId,
    adminName,
    ownerName
  } = details;

  const clientUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const propertyUrl = propertyId ? `${clientUrl}/listing/${propertyId}` : clientUrl;
  const supportUrl = `${clientUrl}/contact`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Property Assignment</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f0f9ff; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08); }
        .header { background: linear-gradient(135deg, #0891b2, #0ea5e9); color: white; padding: 30px 25px; text-align: center; }
        .content { padding: 30px 25px; color: #0f172a; }
        .highlight { background-color: #ecfeff; border-left: 4px solid #0ea5e9; padding: 20px; border-radius: 8px; margin: 20px 0; color: #0c4a6e; }
        .actions { display: flex; flex-direction: column; gap: 12px; margin: 30px 0; }
        .btn { width: 100%; text-align: center; padding: 14px 20px; border-radius: 30px; font-weight: 600; text-decoration: none; border: none; }
        .btn-primary { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; }
        .btn-outline { border: 2px solid #2563eb; color: #2563eb; background: white; }
        .footer { background-color: #e0f2fe; padding: 20px; text-align: center; color: #475569; font-size: 13px; }
      </style>
    </head>
    <body>
      <div style="padding: 30px 15px; background-color: #e0f2fe;">
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 26px;">You're Now the Property Owner</h1>
          </div>
          <div class="content">
            <p style="font-size: 16px; line-height: 1.6;">
              Hello ${ownerName || 'there'},
            </p>
            <p style="font-size: 16px; line-height: 1.6;">
              ${adminName ? `${adminName} has` : 'Our admin team has'} assigned the property
              <strong>${propertyName || 'an UrbanSetu listing'}</strong> to your portfolio.
            </p>
            <div class="highlight">
              <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                You can now manage this listing, respond to tenant inquiries, and track rent-lock activity directly from your dashboard.
              </p>
            </div>
            <p style="font-size: 15px; line-height: 1.6; color: #334155;">
              Please review the property details, confirm that all information is accurate, and ensure availability settings reflect the current status.
            </p>
            <div class="actions">
              <a href="${propertyUrl}" class="btn btn-primary">View Property</a>
              <a href="${supportUrl}" class="btn btn-outline">Contact Support</a>
            </div>
            <p style="font-size: 14px; color: #475569; margin-top: 30px;">
              Need to transfer ownership or update documents? Reach out to our support desk any time.
            </p>
          </div>
          <div class="footer">
            <p style="margin: 0;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    return await sendEmailWithRetry({
      to: email,
      subject: `New Property Assignment - ${propertyName || 'UrbanSetu'}`,
      html
    });
  } catch (error) {
    console.error('Error sending owner assigned email:', error);
    throw error;
  }
};

// New Properties Matching Search Email
export const sendNewPropertiesMatchingSearchEmail = async (email, searchDetails) => {
  try {
    const {
      searchQuery,
      properties,
      totalCount,
      searchCriteria
    } = searchDetails;

    const subject = `🔍 New Properties Found - ${totalCount} matches for "${searchQuery}"`;

    const unsubscribeUrl = `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/unsubscribe?email=${encodeURIComponent(email)}&token=${generateUnsubscribeToken(email)}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .property-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 20px 0; background-color: #f9fafb; }
          .property-image { width: 100%; max-width: 200px; height: 150px; object-fit: cover; border-radius: 8px; margin: 10px 0; }
          .price { font-size: 20px; font-weight: bold; color: #059669; margin: 10px 0; }
          .btn { display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 5px; }
          .btn:hover { background-color: #059669; }
          .btn-outline { background-color: transparent; color: #10b981; border: 2px solid #10b981; }
          .btn-outline:hover { background-color: #10b981; color: white; }
          .footer { background-color: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; }
          .search-criteria { background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 15px; margin: 15px 0; }
          .unsubscribe-link { color: #6b7280; text-decoration: underline; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔍 New Properties Found!</h1>
            <p>We found ${totalCount} new properties matching your search</p>
          </div>
          
          <div class="content">
            <div class="search-criteria">
              <h3 style="color: #0c4a6e; margin: 0 0 10px 0;">📋 Your Search Criteria</h3>
              <p style="color: #0c4a6e; margin: 0;"><strong>Query:</strong> "${searchQuery}"</p>
              ${searchCriteria ? `
                <p style="color: #0c4a6e; margin: 5px 0 0 0;"><strong>Filters:</strong> ${searchCriteria}</p>
              ` : ''}
            </div>
            
            <h2 style="color: #1f2937;">🏠 New Properties (${properties.length} shown)</h2>
            
            ${properties.map(property => `
              <div class="property-card">
                <h3 style="color: #1f2937; margin: 0 0 10px 0;">${property.name}</h3>
                
                ${property.imageUrls && property.imageUrls.length > 0 ? `
                  <img src="${property.imageUrls[0]}" alt="${property.name}" class="property-image">
                ` : ''}
                
                <div class="price">₹${new Intl.NumberFormat('en-IN').format(property.price)}</div>
                
                <p><strong>📍 Location:</strong> ${property.address}, ${property.city}, ${property.state}</p>
                <p><strong>🏠 Type:</strong> ${property.type === 'rent' ? 'For Rent' : 'For Sale'}</p>
                ${property.bedrooms ? `<p><strong>🛏️ Bedrooms:</strong> ${property.bedrooms}</p>` : ''}
                ${property.area ? `<p><strong>📐 Area:</strong> ${property.area} sq ft</p>` : ''}
                
                <div style="text-align: center; margin: 15px 0;">
                  <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/listing/${property._id}" class="btn">
                    View Property
                  </a>
                </div>
              </div>
            `).join('')}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/explore" class="btn btn-outline">
                🔍 View All Properties
              </a>
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/saved-searches" class="btn btn-outline">
                📋 Manage Saved Searches
              </a>
            </div>
            
            <div style="background-color: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #166534; margin: 0 0 15px 0;">💡 Pro Tip</h3>
              <p style="color: #166534; margin: 0;">Save your search criteria to get instant notifications when new matching properties are added!</p>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Happy house hunting!</strong></p>
            <p>Don't miss out on your dream property - act fast on properties that interest you.</p>
            <p style="color: #9ca3af; margin: 15px 0 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
            <p style="margin-top: 15px;">
              <a href="${unsubscribeUrl}" class="unsubscribe-link">Unsubscribe</a> from these search alerts.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    }, 3, 1000, 'promotional');
  } catch (error) {
    console.error('Error sending new properties matching search email:', error);
    return createErrorResponse(error, 'new_properties_matching_search_email');
  }
};

// Property Edit Notification Email
export const sendPropertyEditNotificationEmail = async (email, editDetails, userRole) => {
  try {
    const {
      propertyName,
      propertyId,
      propertyDescription,
      propertyAddress,
      propertyPrice,
      propertyImages,
      editedBy,
      editType,
      changes
    } = editDetails;

    const isAdminEdit = editType === 'admin';
    const subject = isAdminEdit
      ? `📝 Property Updated by Admin - ${propertyName} | UrbanSetu`
      : `📝 Property Updated - ${propertyName} | UrbanSetu`;

    // Get property image for email
    const propertyImage = propertyImages && propertyImages.length > 0
      ? propertyImages[0]
      : `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/placeholder-property.jpg`;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Property Updated - UrbanSetu</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .admin-notice {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
          text-align: center;
        }
        .admin-notice p {
          margin: 0;
          color: #92400e;
          font-weight: 600;
        }
        .content {
          padding: 30px;
        }
        .property-card {
          background: #f0fdf4;
          border: 2px solid #bbf7d0;
          border-radius: 12px;
          padding: 25px;
          margin: 20px 0;
        }
        .property-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .property-title {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 10px 0;
        }
        .property-address {
          color: #64748b;
          font-size: 16px;
          margin: 0 0 15px 0;
        }
        .property-price {
          font-size: 20px;
          font-weight: 700;
          color: #059669;
          margin: 0 0 20px 0;
        }
        .changes-section {
          background: #f1f5f9;
          border-left: 4px solid #3b82f6;
          padding: 20px;
          margin: 20px 0;
          border-radius: 0 8px 8px 0;
        }
        .changes-title {
          font-weight: 600;
          color: #374151;
          margin-bottom: 10px;
          font-size: 18px;
        }
        .changes-list {
          margin: 0;
          padding-left: 20px;
        }
        .changes-list li {
          margin: 8px 0;
          color: #1f2937;
        }
        .action-buttons {
          text-align: center;
          margin: 30px 0;
          padding: 0 10px;
        }
        .btn-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          max-width: 100%;
          width: 100%;
        }
        .btn-container.horizontal {
          flex-direction: row;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .btn {
          display: inline-block;
          width: auto;
          max-width: 280px;
          padding: 15px 25px;
          margin: 5px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          text-align: center;
          box-sizing: border-box;
          word-wrap: break-word;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .btn-container:not(.horizontal) .btn {
          display: block;
          width: 100%;
          margin: 0;
          padding: 12px 20px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white !important;
        }
        .btn-secondary {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white !important;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }
        .next-steps {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .next-steps h3 {
          color: #d97706;
          margin: 0 0 15px 0;
          font-size: 18px;
        }
        .next-steps ul {
          margin: 0;
          padding-left: 20px;
        }
        .next-steps li {
          margin: 8px 0;
          color: #92400e;
        }
        .footer {
          background: #f8fafc;
          padding: 30px;
          text-align: center;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          margin: 5px 0;
        }
        .social-links {
          margin: 20px 0;
        }
        .social-links a {
          display: inline-block;
          margin: 0 10px;
          color: #3b82f6;
          text-decoration: none;
        }
        @media (max-width: 600px) {
          .container {
            margin: 10px;
            border-radius: 8px;
          }
          .content {
            padding: 20px;
          }
          .action-buttons {
            padding: 0 5px;
          }
          .btn-container {
            gap: 10px;
          }
          .btn-container.horizontal {
            flex-direction: column;
            gap: 10px;
          }
          .btn {
            max-width: 100%;
            padding: 14px 16px;
            font-size: 15px;
            margin: 0;
            display: block;
            width: 100%;
          }
        }
        @media (max-width: 400px) {
          .btn {
            padding: 12px 14px;
            font-size: 14px;
          }
          .action-buttons {
            padding: 0 2px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📝 Property Updated!</h1>
          <p>Your property listing has been successfully updated</p>
        </div>
        
        <div class="content">
          ${isAdminEdit ? `
          <div class="admin-notice">
            <p>🔧 This property was updated by our admin team</p>
          </div>
          ` : ''}
          
          <div class="property-card">
            <img src="${propertyImage}" alt="${propertyName}" class="property-image" />
            <h2 class="property-title">${propertyName}</h2>
            <p class="property-address">📍 ${propertyAddress || 'Address not specified'}</p>
            <p class="property-price">💰 ₹${propertyPrice || 'Price not specified'}</p>
          </div>
          
          ${changes && changes.length > 0 ? `
          <div class="changes-section">
            <h3 class="changes-title">📋 Changes Made:</h3>
            <ul class="changes-list">
              ${changes.map(change => `<li>${change}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          <div class="action-buttons">
            <div class="btn-container">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/listing/${propertyId}" class="btn btn-primary">
                🏠 View Updated Property
              </a>
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-listings" class="btn btn-secondary">
                📊 My Properties
              </a>
            </div>
          </div>
          
          <div class="next-steps">
            <h3>📋 What's Next:</h3>
            <ul>
              <li>Review the updated property details</li>
              <li>Check if all information is accurate</li>
              <li>Monitor your property's performance</li>
              <li>Respond to any new inquiries promptly</li>
              ${isAdminEdit ? '<li>Contact support if you have questions about the changes</li>' : ''}
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>UrbanSetu - Smart Real Estate Platform</strong></p>
          <p>Thank you for keeping your property information up to date!</p>
          <div class="social-links">
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}">Website</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact">Support</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/privacy">Privacy</a>
          </div>
          <p style="font-size: 12px; margin-top: 20px;">
            This is an automated email. Please do not reply to this email address.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending property edit notification email:', error);
    return createErrorResponse(error, 'property_edit_notification_email');
  }
};

// Property Deletion Confirmation Email
export const sendPropertyDeletionConfirmationEmail = async (email, deletionDetails) => {
  try {
    const {
      propertyName,
      propertyId,
      propertyDescription,
      propertyAddress,
      propertyPrice,
      propertyImages,
      deletedBy,
      deletionType,
      deletionReason,
      restorationToken,
      tokenExpiry
    } = deletionDetails;

    const isAdminDeletion = deletionType === 'admin';
    const subject = isAdminDeletion
      ? `🗑️ Property Deleted by Admin - ${propertyName} | UrbanSetu`
      : `🗑️ Property Deleted - ${propertyName} | UrbanSetu`;

    // Get property image for email
    const propertyImage = propertyImages && propertyImages.length > 0
      ? propertyImages[0]
      : `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/placeholder-property.jpg`;

    // Format expiry date (only for user deletions)
    const expiryDate = tokenExpiry ? new Date(tokenExpiry).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : null;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Property Deleted - UrbanSetu</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .admin-notice {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
          text-align: center;
        }
        .admin-notice p {
          margin: 0;
          color: #92400e;
          font-weight: 600;
        }
        .content {
          padding: 30px;
        }
        .property-card {
          background: #fef2f2;
          border: 2px solid #fecaca;
          border-radius: 12px;
          padding: 25px;
          margin: 20px 0;
        }
        .property-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 20px;
          opacity: 0.7;
        }
        .property-title {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 10px 0;
        }
        .property-address {
          color: #64748b;
          font-size: 16px;
          margin: 0 0 15px 0;
        }
        .property-price {
          font-size: 20px;
          font-weight: 700;
          color: #059669;
          margin: 0 0 20px 0;
        }
        .deletion-info {
          background: #f1f5f9;
          border-left: 4px solid #3b82f6;
          padding: 20px;
          margin: 20px 0;
          border-radius: 0 8px 8px 0;
        }
        .deletion-info h3 {
          font-weight: 600;
          color: #374151;
          margin-bottom: 10px;
          font-size: 18px;
        }
        .deletion-info p {
          margin: 8px 0;
          color: #1f2937;
        }
        .restoration-section {
          background: #f0fdf4;
          border: 2px solid #bbf7d0;
          border-radius: 12px;
          padding: 25px;
          margin: 20px 0;
          text-align: center;
        }
        .restoration-section h3 {
          color: #059669;
          margin: 0 0 15px 0;
          font-size: 20px;
        }
        .restoration-section p {
          color: #374151;
          margin: 10px 0;
        }
        .expiry-notice {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 15px;
          margin: 15px 0;
        }
        .expiry-notice p {
          margin: 0;
          color: #92400e;
          font-weight: 600;
          text-align: center;
        }
        .action-buttons {
          text-align: center;
          margin: 30px 0;
          padding: 0 10px;
        }
        .btn-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          max-width: 100%;
          width: 100%;
        }
        .btn {
          display: inline-block;
          width: auto;
          max-width: 300px;
          padding: 15px 25px;
          margin: 5px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          text-align: center;
          box-sizing: border-box;
          word-wrap: break-word;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .btn-container .btn {
          display: block;
          width: 100%;
          margin: 0;
          padding: 12px 20px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white !important;
        }
        .btn-secondary {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white !important;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }
        .footer {
          background: #f8fafc;
          padding: 30px;
          text-align: center;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          margin: 5px 0;
        }
        .social-links {
          margin: 20px 0;
        }
        .social-links a {
          display: inline-block;
          margin: 0 10px;
          color: #3b82f6;
          text-decoration: none;
        }
        @media (max-width: 600px) {
          .container {
            margin: 10px;
            border-radius: 8px;
          }
          .content {
            padding: 20px;
          }
          .action-buttons {
            padding: 0 5px;
          }
          .btn-container {
            gap: 10px;
          }
          .btn {
            max-width: 100%;
            padding: 14px 16px;
            font-size: 15px;
            margin: 0;
            display: block;
            width: 100%;
          }
        }
        @media (max-width: 400px) {
          .btn {
            padding: 12px 14px;
            font-size: 14px;
          }
          .action-buttons {
            padding: 0 2px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🗑️ Property Deleted</h1>
          <p>Your property listing has been removed from our platform</p>
        </div>
        
        <div class="content">
          ${isAdminDeletion ? `
          <div class="admin-notice">
            <p>🔧 This property was deleted by our admin team</p>
          </div>
          ` : ''}
          
          <div class="property-card">
            <img src="${propertyImage}" alt="${propertyName}" class="property-image" />
            <h2 class="property-title">${propertyName}</h2>
            <p class="property-address">📍 ${propertyAddress || 'Address not specified'}</p>
            <p class="property-price">💰 ₹${propertyPrice || 'Price not specified'}</p>
          </div>
          
          <div class="deletion-info">
            <h3>📋 Deletion Details:</h3>
            <p><strong>Property:</strong> ${propertyName}</p>
            <p><strong>Deleted by:</strong> ${isAdminDeletion ? 'Administrator' : 'You'}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            ${isAdminDeletion && deletionReason ? `<p><strong>Reason:</strong> ${deletionReason}</p>` : ''}
          </div>
          
          ${!isAdminDeletion && restorationToken ? `
          <div class="restoration-section">
            <h3>🔄 Accidentally Deleted?</h3>
            <p>If you deleted this property by mistake, you can restore it within 30 days using the link below.</p>
            <div class="expiry-notice">
              <p>⏰ Restoration link expires on ${expiryDate}</p>
            </div>
            <div class="action-buttons">
              <div class="btn-container">
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/restore-property?token=${restorationToken}" class="btn btn-primary">
                  🔄 Restore Property
                </a>
                <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-listings" class="btn btn-secondary">
                  📊 My Properties
                </a>
              </div>
            </div>
            
            <div style="border-top: 1px dashed #bbf7d0; margin-top: 20px; padding-top: 15px; text-align: center;">
                <p style="color: #047857; margin: 0 0 8px; font-size: 13px;">If the link doesn't work, copy this token:</p>
                <div style="background: white; border: 1px solid #bbf7d0; padding: 10px; border-radius: 6px; font-family: monospace; font-size: 14px; color: #047857; font-weight: bold; word-break: break-all; user-select: all; display: inline-block;">
                    ${restorationToken}
                </div>
                <p style="color: #047857; margin: 8px 0 0; font-size: 12px;">And paste it on the <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/restore-property" style="color: #059669; text-decoration: underline;">restoration page</a>.</p>
            </div>
          </div>
          ` : `
          <div class="action-buttons">
            <div class="btn-container">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-listings" class="btn btn-primary">
                📊 My Properties
              </a>
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact" class="btn btn-secondary">
                📞 Contact Support
              </a>
            </div>
          </div>
          `}
        </div>
        
        <div class="footer">
          <p><strong>UrbanSetu - Smart Real Estate Platform</strong></p>
          <p>Thank you for using our platform for your property needs!</p>
          <div class="social-links">
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}">Website</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact">Support</a>
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/privacy">Privacy</a>
          </div>
          <p style="font-size: 12px; margin-top: 20px;">
            This is an automated email. Please do not reply to this email address.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending property deletion confirmation email:', error);
    return createErrorResponse(error, 'property_deletion_confirmation_email');
  }
};

// Property Views Milestone Email
export const sendPropertyViewsMilestoneEmail = async (email, milestoneDetails) => {
  try {
    const {
      propertyName,
      propertyId,
      viewCount,
      milestone,
      previousMilestone,
      imageUrls
    } = milestoneDetails;

    const subject = `🎉 Milestone Reached! "${propertyName}" has ${viewCount} views`;

    const unsubscribeUrl = `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/unsubscribe?email=${encodeURIComponent(email)}&token=${generateUnsubscribeToken(email)}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .milestone-card { border: 2px solid #f59e0b; border-radius: 12px; padding: 30px; margin: 20px 0; background-color: #fffbeb; text-align: center; }
          .milestone-number { font-size: 48px; font-weight: bold; color: #d97706; margin: 10px 0; }
          .property-image { width: 100%; max-width: 300px; height: 200px; object-fit: cover; border-radius: 8px; margin: 15px 0; }
          .btn { display: inline-block; padding: 12px 24px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 5px; }
          .btn:hover { background-color: #d97706; }
          .btn-outline { background-color: transparent; color: #f59e0b; border: 2px solid #f59e0b; }
          .btn-outline:hover { background-color: #f59e0b; color: white; }
          .footer { background-color: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; }
          .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin: 20px 0; }
          .stat-item { background-color: #ffffff; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb; }
          .unsubscribe-link { color: #6b7280; text-decoration: underline; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
            <p>Your property has reached a new milestone</p>
          </div>
          
          <div class="content">
            <div class="milestone-card">
              <h2 style="color: #92400e; margin: 0 0 15px 0;">${propertyName}</h2>
              
              ${imageUrls && imageUrls.length > 0 ? `
                <img src="${imageUrls[0]}" alt="${propertyName}" class="property-image">
              ` : ''}
              
              <div class="milestone-number">${viewCount}</div>
              <h3 style="color: #92400e; margin: 0;">Total Views</h3>
              <p style="color: #92400e; margin: 10px 0 0 0;">
                🚀 You've reached the ${milestone} milestone!
                ${previousMilestone ? `(Previous: ${previousMilestone})` : ''}
              </p>
            </div>
            
            <div class="stats">
              <div class="stat-item">
                <div style="font-size: 24px; font-weight: bold; color: #059669;">${viewCount}</div>
                <div style="color: #6b7280;">Total Views</div>
              </div>
              <div class="stat-item">
                <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">📈</div>
                <div style="color: #6b7280;">Growing Interest</div>
              </div>
              <div class="stat-item">
                <div style="font-size: 24px; font-weight: bold; color: #8b5cf6;">🎯</div>
                <div style="color: #6b7280;">High Visibility</div>
              </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/listing/${propertyId}" class="btn">
                🏠 View Property
              </a>
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-listings" class="btn btn-outline">
                📊 Property Analytics
              </a>
            </div>
            
            <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #0c4a6e; margin: 0 0 15px 0;">📈 What This Means</h3>
              <ul style="color: #0c4a6e; margin: 0; padding-left: 20px;">
                <li>Your property is getting great visibility</li>
                <li>More views often lead to more inquiries</li>
                <li>Consider optimizing your listing for even better results</li>
                <li>Respond quickly to any new inquiries</li>
                <li>Keep your property information updated</li>
              </ul>
            </div>
            
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #92400e; margin: 0 0 15px 0;">💡 Tips to Increase Views</h3>
              <ul style="color: #92400e; margin: 0; padding-left: 20px;">
                <li>Add high-quality photos</li>
                <li>Write a compelling description</li>
                <li>Keep your pricing competitive</li>
                <li>Update your listing regularly</li>
                <li>Share your property on social media</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Keep up the great work!</strong></p>
            <p>High view counts are a great sign of interest in your property.</p>
            <p style="color: #9ca3af; margin: 15px 0 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
            <p style="margin-top: 15px;">
              <a href="${unsubscribeUrl}" class="unsubscribe-link">Unsubscribe</a> from these milestone alerts.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    }, 3, 1000, 'promotional');
  } catch (error) {
    console.error('Error sending property views milestone email:', error);
    return createErrorResponse(error, 'property_views_milestone_email');
  }
};

// New Message Notification Email for Appointment Chatbox
export const sendNewMessageNotificationEmail = async (email, messageDetails) => {
  try {
    const {
      recipientName,
      senderName,
      appointmentId,
      propertyName,
      messagePreview,
      messageType = 'text',
      senderImage
    } = messageDetails;

    const chatUrl = `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/my-appointments/chat/${appointmentId}?chatopen=true`;
    const subject = `💬 New Message from ${senderName} - ${propertyName}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Message Notification - UrbanSetu</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">💬 You Have a New Message!</h1>
            <p style="color: #bfdbfe; margin: 10px 0 0; font-size: 16px;">From ${senderName}</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(59, 130, 246, 0.3); position: relative;">
                <div style="position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 50%; opacity: 0.2;"></div>
                <span style="color: #ffffff; font-size: 36px; font-weight: bold; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">💬</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">Hi ${recipientName}!</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">You have a new message from ${senderName} regarding your appointment.</p>
            </div>
            
            <!-- Message Details -->
            <div style="background-color: #f3f4f6; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 18px; font-weight: 600;">📋 Appointment Details</h3>
              <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">Property:</span>
                  <span style="color: #1f2937; font-weight: 600;">${propertyName}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-weight: 500;">From:</span>
                  <span style="color: #1f2937; font-weight: 600;">${senderName}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0;">
                  <span style="color: #6b7280; font-weight: 500;">Message Type:</span>
                  <span style="color: #1f2937; font-weight: 600; text-transform: capitalize;">${messageType}</span>
                </div>
              </div>
            </div>
            
            <!-- Message Privacy Notice (no content shown) -->
            <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 30px;">
              <h3 style="color: #1e40af; margin: 0 0 15px; font-size: 16px; font-weight: 600;">🔒 Message Content Hidden</h3>
              <div style="background-color: white; padding: 15px; border-radius: 6px; border: 1px solid #dbeafe;">
                <p style="color: #1f2937; margin: 0; font-size: 14px; line-height: 1.6; word-wrap: break-word;">
                  For your privacy, the message content isn’t shown in email. Click the button below to read and reply in UrbanSetu.
                </p>
              </div>
            </div>
            
            <!-- Call to Action -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${chatUrl}" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px 35px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3); transition: all 0.3s ease;">
                💬 View Message & Reply
              </a>
            </div>
            
            <!-- Information Box -->
            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 25px;">
              <h3 style="color: #065f46; margin: 0 0 10px; font-size: 16px; font-weight: 600;">💡 Quick Tips</h3>
              <ul style="color: #065f46; margin: 0; font-size: 14px; line-height: 1.6; padding-left: 20px;">
                <li>Click the button above to view the complete message and reply</li>
                <li>Respond promptly to keep the conversation flowing</li>
                <li>You can also access your appointments anytime from your dashboard</li>
                <li>Keep all important appointment details in the chatbox</li>
              </ul>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                This is an automated notification from UrbanSetu. You received this email because you have an active appointment with a message.
              </p>
              <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0;">
                This is an automated message. Please do not reply to this email.
              </p>
              <p style="color: #9ca3af; margin: 15px 0 0; font-size: 12px;">
                © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending new message notification email:', error);
    return createErrorResponse(error, 'new_message_notification_email');
  }
};

// Send data export email with download links
export const sendDataExportEmail = async (email, username, jsonDownloadUrl, txtDownloadUrl, exportedModules = []) => {
  try {
    const subject = `Your UrbanSetu Data Export - ${new Date().toLocaleDateString()}`;
    const exportDate = formatIndiaTime(new Date(), {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const moduleNames = {
      wishlist: "Wishlist items",
      watchlist: "Watchlist properties",
      appointments: "Appointments and bookings",
      listings: "Your property listings",
      reviews: "Reviews and ratings",
      payments: "Payment history",
      gamification: "SetuCoins history and gamification stats",
      rentalContracts: "Rental contracts",
      rentalLoans: "Rental loan applications",
      rentalRatings: "Rental ratings",
      gemini: "Gemini chat history",
      calls: "Call history logs",
      community: "Community forum discussions",
      blogComments: "Blog comments",
      routes: "Saved routes and planner data",
      investments: "Investment tool calculations",
      referrals: "Referral records"
    };

    let listItems = '';
    if (exportedModules && exportedModules.length > 0) {
      // Always include Account Info and Stats as they are core
      listItems += '<li>Account information and profile details</li>';

      exportedModules.forEach(mod => {
        if (moduleNames[mod]) {
          listItems += `<li>${moduleNames[mod]}</li>`;
        }
      });

      listItems += '<li>Account statistics and counts</li>';
    } else {
      // Fallback for full export
      listItems = `
              <li>Account information and profile details</li>
              <li>Wishlist items and watchlist properties</li>
              <li>Appointments and bookings</li>
              <li>Your property listings</li>
              <li>Reviews and ratings</li>
              <li>Payment history</li>
              <li>SetuCoins history and gamification stats</li>
              <li>Rental contracts and loan applications</li>
              <li>Gemini chat history and prompt counts</li>
              <li>Call history logs (Audio/Video)</li>
              <li>Community discussions and blog comments</li>
              <li>Saved routes and investment calculations</li>
              <li>Account statistics and counts</li>`;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #059669; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Your Data Export is Ready</p>
          </div>
          
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #059669;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Your Data Export is Ready</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Hello ${username},
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Your requested data export from UrbanSetu has been prepared and is attached to this email. This file contains a copy of the selected account data:
            </p>
            
            <ul style="color: #4b5563; margin: 15px 0; padding-left: 20px; line-height: 1.8;">
              ${listItems}
            </ul>
            
            <div style="background-color: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #065f46; margin: 0; font-size: 14px; font-weight: 600;">
                ⚠️ Security Notice:
              </p>
              <p style="color: #065f46; margin: 5px 0 0 0; font-size: 13px; line-height: 1.6;">
                This file contains sensitive personal information. Please keep it secure and do not share it with unauthorized parties. If you did not request this export, please contact our support team immediately.
              </p>
            </div>
            
            <p style="color: #4b5563; margin: 15px 0 0 0; line-height: 1.6;">
              <strong>Export Date:</strong> ${exportDate}
            </p>
            <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 14px;">
              Click the download buttons below to get your data in your preferred format.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; align-items: center;">
              <a href="${jsonDownloadUrl}" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3); transition: all 0.3s ease; margin: 5px;">
                📄 Download JSON File
              </a>
              <a href="${txtDownloadUrl}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3); transition: all 0.3s ease; margin: 5px;">
                📝 Download TXT File
              </a>
            </div>
            <p style="color: #6b7280; margin: 15px 0 0; font-size: 13px; line-height: 1.6;">
              <strong>Note:</strong> These download links will expire in 24 hours for security reasons. Please download your data as soon as possible.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
            <p style="color: #9ca3af; margin: 5px 0 0; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: html
    };

    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'data_export') :
      createErrorResponse(new Error(result.error), 'data_export');
  } catch (error) {
    return createErrorResponse(error, 'data_export');
  }
};

// Send call initiated email
export const sendCallInitiatedEmail = async (toEmail, { callType, callerName, propertyName, appointmentId, isReceiverAdmin = false }) => {
  try {
    const clientUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
    const chatLink = isReceiverAdmin
      ? `${clientUrl}/admin/appointments/chat/${appointmentId}?chatopen=true`
      : `${clientUrl}/user/my-appointments/chat/${appointmentId}?chatopen=true`;

    const subject = `${callerName} is calling you - ${callType === 'video' ? 'Video' : 'Audio'} Call`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call</p>
          </div>
          
          <div style="background-color: #eff6ff; padding: 25px; border-radius: 8px; border-left: 4px solid #2563eb; margin-bottom: 20px;">
            <h2 style="color: #1e40af; margin: 0 0 15px 0; font-size: 20px;">📞 Incoming Call</h2>
            <p style="color: #1e40af; margin: 0 0 15px 0; line-height: 1.6;">
              <strong>${callerName}</strong> is calling you regarding property: <strong>${propertyName}</strong>
            </p>
            <p style="color: #3b82f6; margin: 15px 0 0; font-size: 14px;">
              Please check your UrbanSetu chat to answer the call.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <a href="${chatLink}" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3); transition: all 0.3s ease; margin: 5px;">
              📞 Answer Call in Chat
            </a>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              This is an automated notification from UrbanSetu.
            </p>
            <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `;

    return await sendEmailWithRetry({
      to: toEmail,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending call initiated email:', error);
    throw error;
  }
};

// Send missed call email
export const sendCallMissedEmail = async (toEmail, { callType, callerName, propertyName, appointmentDate }) => {
  try {
    const subject = `Missed ${callType === 'video' ? 'Video' : 'Audio'} Call from ${callerName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Missed Call</p>
          </div>
          
          <div style="background-color: #fef2f2; padding: 25px; border-radius: 8px; border-left: 4px solid #ef4444; margin-bottom: 20px;">
            <h2 style="color: #991b1b; margin: 0 0 15px 0; font-size: 20px;">📞 Missed Call</h2>
            <p style="color: #991b1b; margin: 0 0 15px 0; line-height: 1.6;">
              You missed a ${callType === 'video' ? 'video' : 'audio'} call from <strong>${callerName}</strong>.
            </p>
            <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Property:</strong> ${propertyName}</p>
              ${appointmentDate ? `<p style="color: #4b5563; margin: 0;"><strong>Appointment Date:</strong> ${new Date(appointmentDate).toLocaleDateString()}</p>` : ''}
            </div>
            <p style="color: #dc2626; margin: 15px 0 0; font-size: 14px;">
              You can call back or send a message through your UrbanSetu chat.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              This is an automated notification from UrbanSetu.
            </p>
            <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `;

    return await sendEmailWithRetry({
      to: toEmail,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending missed call email:', error);
    throw error;
  }
};

// Send call ended email
export const sendCallEndedEmail = async (toEmail, { callType, duration, callerName, receiverName, propertyName, appointmentId, isReceiverAdmin = false }) => {
  try {
    const clientUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
    const chatLink = isReceiverAdmin
      ? `${clientUrl}/admin/appointments/chat/${appointmentId}?chatopen=true`
      : `${clientUrl}/user/my-appointments/chat/${appointmentId}?chatopen=true`;
    const callHistoryLink = isReceiverAdmin
      ? `${clientUrl}/admin/call-history`
      : `${clientUrl}/user/call-history`;

    const otherPersonName = receiverName || callerName;
    const subject = `Call Ended - ${callType === 'video' ? 'Video' : 'Audio'} Call Summary`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Call Summary</p>
          </div>
          
          <div style="background-color: #f0fdf4; padding: 25px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 20px;">
            <h2 style="color: #065f46; margin: 0 0 15px 0; font-size: 20px;">✅ Call Summary</h2>
            <p style="color: #065f46; margin: 0 0 15px 0; line-height: 1.6;">
              Your ${callType === 'video' ? 'video' : 'audio'} call with <strong>${otherPersonName}</strong> has ended.
            </p>
            <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Property:</strong> ${propertyName}</p>
              <p style="color: #4b5563; margin: 0;"><strong>Duration:</strong> ${duration}</p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <div style="display: flex; flex-direction: column; gap: 12px; align-items: center;">
              <a href="${callHistoryLink}" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3); transition: all 0.3s ease; margin: 5px; width: 100%; max-width: 280px;">
                📋 View Call History
              </a>
              <a href="${chatLink}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3); transition: all 0.3s ease; margin: 5px; width: 100%; max-width: 280px;">
                💬 Open Chat
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              This is an automated notification from UrbanSetu.
            </p>
            <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `;

    return await sendEmailWithRetry({
      to: toEmail,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending call ended email:', error);
    throw error;
  }
};

// ========================================
// RENTAL-RELATED EMAIL FUNCTIONS
// ========================================

// Send rent payment received email (to tenant)
export const sendRentPaymentReceivedEmail = async (email, paymentDetails) => {
  try {
    const {
      paymentId,
      amount,
      propertyName,
      rentMonth,
      rentYear,
      dueDate,
      receiptUrl,
      contractId,
      walletUrl,
      receiptBuffer,
      paymentMethod,
      transactionDate
    } = paymentDetails;

    // Format transaction date if provided, else use current time
    const txDate = transactionDate ? formatIndiaTime(transactionDate) : formatIndiaTime();

    const clientUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
    const subject = `✅ Rent Payment Received - ${propertyName}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Rent Payment Received - UrbanSetu</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">✓</span>
              </div>
              <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Rent Payment Received</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">Your payment is successful</p>
            </div>
            
            <div style="background-color: #f0fdf4; padding: 25px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 25px;">
              <h2 style="color: #065f46; margin: 0 0 15px 0; font-size: 20px;">Payment Details</h2>
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Property:</strong> ${propertyName}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Amount Paid:</strong> <span style="font-weight: bold; color: #10b981;">₹${amount}</span></p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Period:</strong> ${rentMonth}/${rentYear}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Payment ID:</strong> ${paymentId}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Transaction Date:</strong> ${txDate}</p>
                ${paymentMethod ? `<p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Payment Mode:</strong> ${paymentMethod}</p>` : ''}
                ${dueDate ? `<p style="color: #4b5563; margin: 0;"><strong>Scheduled Due Date:</strong> ${new Date(dueDate).toLocaleDateString('en-GB')}</p>` : ''}
              </div>
              <p style="color: #065f46; margin: 15px 0 0; font-size: 14px; line-height: 1.6;">
                Your rent payment has been received and is being held in escrow for 3 days. It will be automatically released to your landlord after this period. A receipt is attached to this email.
              </p>
            </div>

            <!-- Rate Experience Section -->
            <div style="background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); padding: 25px; border-radius: 12px; border: 1px solid #ddd6fe; margin-top: 25px; margin-bottom: 25px; text-align: center; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.05);">
              <h3 style="color: #6d28d9; margin: 0 0 10px 0; font-size: 18px; font-weight: bold; font-family: Arial, sans-serif;">How was your renting experience?</h3>
              <p style="color: #5b21b6; margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; font-family: Arial, sans-serif;">
                Your feedback helps build trust in the community. Please take a moment to rate the landlord and the property.
              </p>
              <div style="margin-bottom: 20px;">
                <a href="${clientUrl}/user/rental-ratings?contractId=${contractId}&role=tenant" style="text-decoration: none; font-size: 30px; margin: 0 5px; color: #fbbf24;">★</a>
                <a href="${clientUrl}/user/rental-ratings?contractId=${contractId}&role=tenant" style="text-decoration: none; font-size: 30px; margin: 0 5px; color: #fbbf24;">★</a>
                <a href="${clientUrl}/user/rental-ratings?contractId=${contractId}&role=tenant" style="text-decoration: none; font-size: 30px; margin: 0 5px; color: #fbbf24;">★</a>
                <a href="${clientUrl}/user/rental-ratings?contractId=${contractId}&role=tenant" style="text-decoration: none; font-size: 30px; margin: 0 5px; color: #fbbf24;">★</a>
                <a href="${clientUrl}/user/rental-ratings?contractId=${contractId}&role=tenant" style="text-decoration: none; font-size: 30px; margin: 0 5px; color: #fbbf24;">★</a>
              </div>
              <a href="${clientUrl}/user/rental-ratings?contractId=${contractId}&role=tenant" style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(124, 58, 237, 0.2); font-family: Arial, sans-serif;">
                ⭐ Rate Experience
              </a>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              ${walletUrl ? `<a href="${walletUrl}" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; margin: 5px; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">View Rent Wallet</a>` : ''}
              ${receiptUrl ? `<a href="${receiptUrl}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; margin: 5px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">Download Receipt</a>` : ''}
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">This is an automated notification from UrbanSetu.</p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Construct attachments array
    const attachments = [];
    if (receiptBuffer) {
      attachments.push({
        filename: `Rent_Receipt_${rentMonth}_${rentYear}.pdf`,
        content: receiptBuffer,
        contentType: 'application/pdf'
      });
    }

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html,
      attachments // Pass attachments here
    });
  } catch (error) {
    console.error('Error sending rent payment received email:', error);
    throw error;
  }
};

// Send rent payment received email to landlord
export const sendRentPaymentReceivedToLandlordEmail = async (email, paymentDetails) => {
  try {
    const {
      paymentId,
      amount,
      propertyName,
      rentMonth,
      rentYear,
      tenantName,
      contractId,
      walletUrl,
      receiptBuffer,
      paymentMethod, // New detail
      transactionDate // New detail
    } = paymentDetails;

    // Format transaction date if provided, else use current time
    const txDate = transactionDate ? formatIndiaTime(transactionDate) : formatIndiaTime();

    const subject = `💰 Rent Payment Received from ${tenantName} - ${propertyName}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Rent Payment Received - UrbanSetu</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #059669, #047857); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(5, 150, 105, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">💰</span>
              </div>
              <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Rent Payment Received</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">Held in escrow for 3 days</p>
            </div>
            
            <div style="background-color: #f0fdf4; padding: 25px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 25px;">
              <h2 style="color: #065f46; margin: 0 0 15px 0; font-size: 20px;">Payment Details</h2>
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Property:</strong> ${propertyName}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Tenant:</strong> ${tenantName}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Amount Received:</strong> <span style="font-weight: bold; color: #10b981;">₹${amount}</span></p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Period:</strong> ${rentMonth} ${rentYear}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Payment ID:</strong> ${paymentId}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Transaction Date:</strong> ${txDate}</p>
                ${paymentMethod ? `<p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Payment Mode:</strong> ${paymentMethod}</p>` : ''}
              </div>
              <p style="color: #065f46; margin: 15px 0 0; font-size: 14px; line-height: 1.6;">
                The rent payment has been received from your tenant and is being held in escrow for 3 days. It will be automatically released to your account after this period, unless a dispute is raised. A receipt copy is attached.
              </p>
            </div>
            
            ${walletUrl ? `<div style="text-align: center; margin-top: 30px;">
              <a href="${walletUrl}" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">View Details</a>
            </div>` : ''}
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">This is an automated notification from UrbanSetu.</p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Construct attachments array
    const attachments = [];
    if (receiptBuffer) {
      attachments.push({
        filename: `Rent_Receipt_${rentMonth}_${rentYear}.pdf`,
        content: receiptBuffer,
        contentType: 'application/pdf'
      });
    }

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html,
      attachments: attachments // Pass attachments here
    });
  } catch (error) {
    console.error('Error sending rent payment received to landlord email:', error);
    throw error;
  }
};

// Send rent payment reminder email
export const sendRentPaymentReminderEmail = async (email, reminderDetails) => {
  try {
    const {
      propertyName,
      amount,
      dueDate,
      daysLeft,
      contractId,
      walletUrl,
      penaltyAmount
    } = reminderDetails;

    const subject = `⏰ Rent Payment Reminder - ${daysLeft} Day${daysLeft > 1 ? 's' : ''} Left`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Rent Payment Reminder - UrbanSetu</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(245, 158, 11, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">⏰</span>
              </div>
              <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Payment Reminder</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">${daysLeft} day${daysLeft > 1 ? 's' : ''} until due date</p>
            </div>
            
            <div style="background-color: #fffbeb; padding: 25px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 25px;">
              <h2 style="color: #92400e; margin: 0 0 15px 0; font-size: 20px;">Payment Due Soon</h2>
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Property:</strong> ${propertyName}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Amount Due:</strong> ₹${amount}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
                ${penaltyAmount ? `<p style="color: #dc2626; margin: 0;"><strong>Late Fee:</strong> ₹${penaltyAmount} (if paid after due date)</p>` : ''}
              </div>
              <p style="color: #92400e; margin: 15px 0 0; font-size: 14px; line-height: 1.6;">
                Please ensure your payment is made on time to avoid late fees and penalties. You can pay directly from your rent wallet.
              </p>
            </div>
            
            ${walletUrl ? `<div style="text-align: center; margin-top: 30px;">
              <a href="${walletUrl}" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">Pay Now</a>
            </div>` : ''}
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">This is an automated reminder from UrbanSetu.</p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending rent payment reminder email:', error);
    throw error;
  }
};

// Send rent payment overdue email
// Send rent payment overdue email
export const sendRentPaymentOverdueEmail = async (email, overdueDetails) => {
  try {
    const {
      propertyName,
      totalOverdue,
      amount,
      penalty,
      daysOverdue,
      month,
      contractId,
      walletUrl,
      paymentUrl
    } = overdueDetails;

    const subject = `⚠️ Action Required: Rent Overdue for ${propertyName}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Rent Payment Overdue - UrbanSetu</title>
      </head>
      <body>
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 72px; height: 72px; background: #fee2e2; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                <span style="font-size: 32px;">⚠️</span>
              </div>
              <h1 style="color: #991b1b; margin: 0; font-size: 24px;">Rent Payment Overdue</h1>
              <p style="color: #7f1d1d; margin: 10px 0 0 0; font-size: 16px;">
                Your payment is <strong>${daysOverdue} days</strong> late
              </p>
            </div>
            
            <div style="background-color: #fff1f2; padding: 25px; border-radius: 8px; border: 1px solid #fecaca; margin-bottom: 25px;">
              <div style="margin-bottom: 20px;">
                 <p style="color: #6b7280; font-size: 14px; margin: 0 0 5px;">Property</p>
                 <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 0;">${propertyName}</p>
              </div>
              
              <div style="margin-bottom: 20px;">
                 <p style="color: #6b7280; font-size: 14px; margin: 0 0 5px;">Billing Period</p>
                 <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 0;">${month}</p>
              </div>

              <div style="border-top: 1px dashed #fecaca; border-bottom: 1px dashed #fecaca; padding: 15px 0; margin: 15px 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="color: #4b5563;">Base Rent</span>
                  <span style="color: #1f2937; font-weight: 500;">₹${(amount || 0).toLocaleString('en-IN')}</span>
                </div>
                ${penalty > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #dc2626;">
                  <span>Late Fee Penalty (One-time)</span>
                  <span>+ ₹${penalty.toLocaleString('en-IN')}</span>
                </div>` : ''}
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                <span style="color: #1f2937; font-weight: 700;">Total Amount Due</span>
                <span style="color: #dc2626; font-size: 20px; font-weight: 700;">₹${totalOverdue.toLocaleString('en-IN')}</span>
              </div>
            </div>
            
            <p style="color: #4b5563; font-size: 14px; line-height: 1.6; text-align: center; margin-bottom: 30px;">
              Please complete your payment immediately. This is a one-time penalty for late payment.
            </p>
            
            <div style="text-align: center;">
              <a href="${paymentUrl || walletUrl}" style="background-color: #dc2626; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(220, 38, 38, 0.2);">
                Pay Now ₹${totalOverdue.toLocaleString('en-IN')}
              </a>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #f3f4f6;">
               <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                 Contract ID: ${contractId} • <a href="${walletUrl}" style="color: #6b7280; text-decoration: underline;">View Lease Details</a>
               </p>
               <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">
                 © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
               </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending rent payment overdue email:', error);
    throw error;
  }
};

// Send escrow released email
export const sendEscrowReleasedEmail = async (email, releaseDetails) => {
  try {
    const {
      paymentId,
      amount,
      propertyName,
      rentMonth,
      rentYear,
      userRole, // 'tenant' or 'landlord'
      tenantName,
      landlordName,
      contractId,
      walletUrl
    } = releaseDetails;

    const isLandlord = userRole === 'landlord';
    const subject = isLandlord
      ? `✅ Rent Payment Released - ${propertyName}`
      : `✅ Rent Payment Released to Landlord - ${propertyName}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Escrow Released - UrbanSetu</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">✅</span>
              </div>
              <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Escrow Released</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">${isLandlord ? 'Payment transferred to your account' : 'Payment released to landlord'}</p>
            </div>
            
            <div style="background-color: #f0fdf4; padding: 25px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 25px;">
              <h2 style="color: #065f46; margin: 0 0 15px 0; font-size: 20px;">Payment Details</h2>
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Property:</strong> ${propertyName}</p>
                ${isLandlord ? `<p style="color: #4b5563; margin: 0 0 10px 0;"><strong>From Tenant:</strong> ${tenantName}</p>` : `<p style="color: #4b5563; margin: 0 0 10px 0;"><strong>To Landlord:</strong> ${landlordName}</p>`}
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Amount:</strong> ₹${amount}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Period:</strong> ${rentMonth}/${rentYear}</p>
                <p style="color: #4b5563; margin: 0;"><strong>Payment ID:</strong> ${paymentId}</p>
              </div>
              <p style="color: #065f46; margin: 15px 0 0; font-size: 14px; line-height: 1.6;">
                ${isLandlord
        ? `The rent payment of ₹${amount} has been released from escrow and transferred to your account. The 3-day escrow period has completed without any disputes.`
        : `Your rent payment of ₹${amount} has been released from escrow to your landlord. The 3-day escrow period has completed without any disputes.`
      }
              </p>
            </div>
            
            ${walletUrl ? `<div style="text-align: center; margin-top: 30px;">
              <a href="${walletUrl}" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">View Details</a>
            </div>` : ''}
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">This is an automated notification from UrbanSetu.</p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending escrow released email:', error);
    throw error;
  }
};

// Send contract signed email
export const sendContractSignedEmail = async (email, contractDetails) => {
  try {
    const {
      contractId,
      propertyName,
      tenantName,
      landlordName,
      rentAmount,
      startDate,
      endDate,
      lockDuration,
      userRole, // 'tenant' or 'landlord'
      contractUrl,
      listingId // Added listingId for constructing the URL
    } = contractDetails;

    const isLandlord = userRole === 'landlord';
    const clientUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';

    // Construct URLs
    // For tenant: Direct link to rent-property page with listingId and contractId to resume flow
    const tenantContractUrl = listingId
      ? `${clientUrl}/user/rent-property?listingId=${listingId}&contractId=${contractId}`
      : contractUrl;

    // For tenant: Link to my appointments page
    const myAppointmentsUrl = `${clientUrl}/user/my-appointments`;

    const subject = isLandlord
      ? `✅ Rental Contract Signed - ${propertyName}`
      : `✅ Landlord Signed Contract - ${propertyName}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Contract Signed - UrbanSetu</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">✅</span>
              </div>
              <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Contract Signed</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">
                ${isLandlord ? 'Your rental contract is now active' : 'Landlord has signed the contract'}
              </p>
            </div>
            
            <div style="background-color: #f0fdf4; padding: 25px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 25px;">
              <h2 style="color: #065f46; margin: 0 0 15px 0; font-size: 20px;">Contract Details</h2>
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Property:</strong> ${propertyName}</p>
                ${isLandlord ? `<p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Tenant:</strong> ${tenantName}</p>` : `<p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Landlord:</strong> ${landlordName}</p>`}
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Monthly Rent:</strong> ₹${rentAmount}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Lock Duration:</strong> ${lockDuration} months</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Start Date:</strong> ${new Date(startDate).toLocaleDateString()}</p>
                <p style="color: #4b5563; margin: 0;"><strong>End Date:</strong> ${new Date(endDate).toLocaleDateString()}</p>
              </div>
              <p style="color: #065f46; margin: 15px 0 0; font-size: 14px; line-height: 1.6;">
                ${isLandlord
        ? `Congratulations! The rental contract for ${propertyName} has been fully signed by both parties. The rent-lock period is now active.`
        : `Great news! The landlord has signed the rental contract for ${propertyName}. You can now proceed to the next steps.`
      }
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              ${isLandlord
        ? (contractUrl ? `<a href="${contractUrl}" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">View Contract</a>` : '')
        : `
                  <a href="${tenantContractUrl}" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; margin: 5px; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">View Contract</a>
                  <a href="${myAppointmentsUrl}" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; margin: 5px; box-shadow: 0 4px 6px rgba(99, 102, 241, 0.3);">My Appointments</a>
                `
      }
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">This is an automated notification from UrbanSetu.</p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending contract signed email:', error);
    throw error;
  }
};

// Send contract expiring soon email
export const sendContractRejectedEmail = async (email, contractDetails) => {
  const { contractId, propertyName, rejectionReason, rejectedBy } = contractDetails;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Rental Contract Rejected</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Contract Rejected</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Dear Valued Customer,</p>
                  
                  <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    We regret to inform you that your rental contract has been rejected.
                  </p>
                  
                  <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 25px 0; border-radius: 5px;">
                    <h3 style="color: #991b1b; margin: 0 0 15px 0; font-size: 18px;">Contract Details</h3>
                    <table width="100%" cellpadding="5" cellspacing="0">
                      <tr>
                        <td style="color: #666666; font-size: 14px; padding: 5px 0; width: 140px;"><strong>Contract ID:</strong></td>
                        <td style="color: #333333; font-size: 14px; padding: 5px 0;">${contractId || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td style="color: #666666; font-size: 14px; padding: 5px 0;"><strong>Property:</strong></td>
                        <td style="color: #333333; font-size: 14px; padding: 5px 0;">${propertyName || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td style="color: #666666; font-size: 14px; padding: 5px 0;"><strong>Rejected By:</strong></td>
                        <td style="color: #333333; font-size: 14px; padding: 5px 0;">${rejectedBy || 'Seller/Admin'}</td>
                      </tr>
                      <tr>
                        <td style="color: #666666; font-size: 14px; padding: 5px 0;"><strong>Rejection Reason:</strong></td>
                        <td style="color: #dc2626; font-size: 14px; padding: 5px 0; font-weight: 500;">${rejectionReason || 'Booking was rejected by seller'}</td>
                      </tr>
                    </table>
                  </div>
                  
                  <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                    If you believe this was an error or would like to discuss alternative arrangements, please contact the property owner or our support team.
                  </p>
                  
                  <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
                    We apologize for any inconvenience this may cause. If you're interested in other properties, please visit our platform to explore more options.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 25px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">Need help? Contact our support team</p>
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    return await sendEmailWithRetry({
      to: email,
      subject: `Rental Contract Rejected - ${propertyName || 'Property'}`,
      html: htmlContent
    });
  } catch (error) {
    console.error('Error sending contract rejected email:', error);
    throw error;
  }
};

export const sendContractExpiringSoonEmail = async (email, contractDetails) => {
  try {
    const {
      propertyName,
      endDate,
      tenantName,
      landlordName,
      userRole,
      contractUrl
    } = contractDetails;

    const isLandlord = userRole === 'landlord';
    const subject = `⏰ Rental Contract Expiring Soon - ${propertyName}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Contract Expiring Soon - UrbanSetu</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(245, 158, 11, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">⏰</span>
              </div>
              <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Contract Expiring Soon</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">Renewal reminder</p>
            </div>
            
            <div style="background-color: #fffbeb; padding: 25px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 25px;">
              <h2 style="color: #92400e; margin: 0 0 15px 0; font-size: 20px;">Contract Expiration Notice</h2>
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Property:</strong> ${propertyName}</p>
                ${isLandlord ? `<p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Tenant:</strong> ${tenantName}</p>` : `<p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Landlord:</strong> ${landlordName}</p>`}
                <p style="color: #4b5563; margin: 0;"><strong>Expiry Date:</strong> ${new Date(endDate).toLocaleDateString()}</p>
              </div>
              <p style="color: #92400e; margin: 15px 0 0; font-size: 14px; line-height: 1.6;">
                ${isLandlord
        ? `Your rental contract for ${propertyName} with tenant ${tenantName} will expire on ${new Date(endDate).toLocaleDateString()}. Please contact the tenant to discuss renewal or move-out arrangements.`
        : `Your rental contract for ${propertyName} will expire on ${new Date(endDate).toLocaleDateString()}. Please contact your landlord to discuss renewal or move-out arrangements.`
      }
              </p>
            </div>
            
            ${contractUrl ? `<div style="text-align: center; margin-top: 30px;">
              <a href="${contractUrl}" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">View Contract</a>
            </div>` : ''}
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">This is an automated reminder from UrbanSetu.</p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending contract expiring soon email:', error);
    throw error;
  }
};

// Send Dispute Raised Email
export const sendDisputeRaisedEmail = async (email, disputeDetails) => {
  try {
    const {
      propertyName,
      raisedByName,
      disputeType,
      description,
      disputeUrl
    } = disputeDetails;

    const subject = `⚠️ Dispute Raised - ${propertyName}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dispute Raised - UrbanSetu</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(239, 68, 68, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">⚠️</span>
              </div>
              <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Dispute Raised</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">Action required</p>
            </div>
            
            <div style="background-color: #fef2f2; padding: 25px; border-radius: 8px; border-left: 4px solid #ef4444; margin-bottom: 25px;">
              <h2 style="color: #991b1b; margin: 0 0 15px 0; font-size: 20px;">Dispute Notification</h2>
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Property:</strong> ${propertyName}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Raised By:</strong> ${raisedByName}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Dispute Type:</strong> ${disputeType}</p>
                ${description ? `<p style="color: #4b5563; margin: 10px 0 0;"><strong>Description:</strong> ${description.substring(0, 200)}${description.length > 200 ? '...' : ''}</p>` : ''}
              </div>
              <p style="color: #991b1b; margin: 15px 0 0; font-size: 14px; line-height: 1.6;">
                A dispute has been raised regarding your rental contract. Please review the details and respond promptly. Our team will mediate the dispute if needed.
              </p>
            </div>
            
            ${disputeUrl ? `<div style="text-align: center; margin-top: 30px;">
              <a href="${disputeUrl}" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.3);">View Dispute</a>
            </div>` : ''}
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">This is an automated notification from UrbanSetu.</p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending dispute raised email:', error);
    throw error;
  }
};

// Output: (Empty string to remove the duplicate block)

// Send Verification Requested Email
export const sendVerificationRequestedEmail = async (email, verificationDetails) => {
  try {
    const {
      propertyName,
      userName,
      verificationUrl,
      documents
    } = verificationDetails;

    // formatted documents list
    const ownershipDoc = documents?.ownershipProof ? '✓ Ownership Proof' : '✗ Ownership Proof Missing';
    const identityDoc = documents?.identityProof ? '✓ Identity Proof' : '✗ Identity Proof Missing';
    const addressDoc = documents?.addressProof ? '✓ Address Proof' : '✗ Address Proof Missing';

    const subject = `Verification Request Received - ${propertyName}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verification Requested - UrbanSetu</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #3b82f6, #2563eb); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(59, 130, 246, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">📋</span>
              </div>
              <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Verification Request Submitted</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">Under Review</p>
            </div>
            
            <div style="background-color: #eff6ff; padding: 25px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 25px;">
              <h2 style="color: #1e40af; margin: 0 0 15px 0; font-size: 20px;">Request Details</h2>
              <p style="color: #1e40af; margin: 0 0 15px 0;">Hello ${userName || 'User'},</p>
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Property:</strong> ${propertyName}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Status:</strong> <span style="color: #f59e0b; font-weight: 600;">Pending Review</span></p>
              </div>
              
              <h3 style="color: #1e40af; margin: 15px 0 10px 0; font-size: 16px;">Documents Submitted:</h3>
              <ul style="list-style: none; padding: 0; margin: 0; color: #4b5563;">
                 <li style="margin-bottom: 5px;">${ownershipDoc}</li>
                 <li style="margin-bottom: 5px;">${identityDoc}</li>
                 <li style="margin-bottom: 5px;">${addressDoc}</li>
              </ul>

              <p style="color: #1e40af; margin: 15px 0 0; font-size: 14px; line-height: 1.6;">
                Our team will review your submitted documents and property details. This process usually takes 24-48 hours. You will be notified once the verification is complete.
              </p>
            </div>
            
            ${verificationUrl ? `<div style="text-align: center; margin-top: 30px;">
              <a href="${verificationUrl}" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">View Request Status</a>
            </div>` : ''}

            <p style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 20px;">
               <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/sign-in" style="color: #3b82f6; text-decoration: none;">Sign in to your account</a>
            </p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">This is an automated notification from UrbanSetu.</p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending verification requested email:', error);
    throw error;
  }
};

// Send Verification Approved Email
export const sendVerificationApprovedEmail = async (email, verificationDetails) => {
  try {
    const {
      propertyName,
      userName,
      verificationUrl,
      listingUrl
    } = verificationDetails;

    const subject = `✅ Property Verification Approved - ${propertyName}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verification Approved - UrbanSetu</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">✅</span>
              </div>
              <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Property Verified!</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">Congratulations</p>
            </div>
            
            <div style="background-color: #f0fdf4; padding: 25px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 25px;">
              <h2 style="color: #065f46; margin: 0 0 15px 0; font-size: 20px;">Property Verified</h2>
              <p style="color: #065f46; margin: 0 0 15px 0;">Hello ${userName || 'User'},</p>
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Property:</strong> ${propertyName}</p>
                <p style="color: #4b5563; margin: 0;"><strong>Status:</strong> <span style="color: #10b981; font-weight: 600;">✓ Verified</span></p>
              </div>
              <p style="color: #065f46; margin: 15px 0 0; font-size: 14px; line-height: 1.6;">
                Congratulations! Your property <strong>${propertyName}</strong> has been successfully verified. A verification badge has been added to your listing, which will increase visibility and trust with potential tenants.
              </p>
            </div>
            
            ${verificationUrl ? `<div style="text-align: center; margin-top: 30px;">
              <a href="${verificationUrl}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">View Verified Property</a>
            </div>` : ''}

            ${listingUrl ? `<div style="text-align: center; margin-top: 15px;">
              <a href="${listingUrl}" style="background-color: white; color: #10b981; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; border: 2px solid #10b981;">View Public Listing</a>
            </div>` : ''}
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">This is an automated notification from UrbanSetu.</p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending verification approved email:', error);
    throw error;
  }
};

// Send Verification Rejected Email
export const sendVerificationRejectedEmail = async (email, verificationDetails) => {
  try {
    const {
      propertyName,
      userName,
      rejectionReason,
      verificationUrl,
      listingUrl
    } = verificationDetails;

    const subject = `❌ Property Verification Rejected - ${propertyName}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verification Rejected - UrbanSetu</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(239, 68, 68, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">❌</span>
              </div>
              <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Verification Rejected</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">Action Required</p>
            </div>
            
            <div style="background-color: #fef2f2; padding: 25px; border-radius: 8px; border-left: 4px solid #ef4444; margin-bottom: 25px;">
              <h2 style="color: #991b1b; margin: 0 0 15px 0; font-size: 20px;">Request Rejected</h2>
              <p style="color: #991b1b; margin: 0 0 15px 0;">Hello ${userName || 'User'},</p>
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Property:</strong> ${propertyName}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Status:</strong> <span style="color: #ef4444; font-weight: 600;">Rejected</span></p>
                ${rejectionReason ? `<p style="color: #4b5563; margin: 10px 0 0;"><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
              </div>
              <p style="color: #991b1b; margin: 15px 0 0; font-size: 14px; line-height: 1.6;">
                Your property verification request has been rejected. Please review the reason provided above and resubmit your verification request with correct information or documents.
              </p>
            </div>
            
            ${verificationUrl ? `<div style="text-align: center; margin-top: 30px;">
              <a href="${verificationUrl}" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">Resubmit Verification</a>
            </div>` : ''}

            ${listingUrl ? `<div style="text-align: center; margin-top: 15px;">
              <a href="${listingUrl}" style="background-color: white; color: #3b82f6; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; border: 2px solid #3b82f6;">View Public Listing</a>
            </div>` : ''}
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">This is an automated notification from UrbanSetu.</p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending verification rejected email:', error);
    throw error;
  }
};

// Send Rating Received Email
export const sendRatingReceivedEmail = async (email, ratingDetails) => {
  try {
    const {
      propertyName,
      ratedByName,
      overallRating,
      ratingUrl
    } = ratingDetails;

    const subject = `⭐ New Rating Received - ${propertyName}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Rating Received - UrbanSetu</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(245, 158, 11, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">⭐</span>
              </div>
              <h1 style="color: #1f2937; margin: 0; font-size: 28px;">New Rating Received</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">Feedback update</p>
            </div>
            
            <div style="background-color: #fffbeb; padding: 25px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 25px;">
              <h2 style="color: #92400e; margin: 0 0 15px 0; font-size: 20px;">Rating Details</h2>
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Property:</strong> ${propertyName}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Rated By:</strong> ${ratedByName}</p>
                <p style="color: #4b5563; margin: 0;"><strong>Overall Rating:</strong> ${'⭐'.repeat(Math.round(overallRating))} ${overallRating}/5</p>
              </div>
              <p style="color: #92400e; margin: 15px 0 0; font-size: 14px; line-height: 1.6;">
                You have received a new rating from ${ratedByName} for your rental contract at ${propertyName}. Check out the detailed feedback and ratings.
              </p>
            </div>
            
            ${ratingUrl ? `<div style="text-align: center; margin-top: 30px;">
              <a href="${ratingUrl}" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(245, 158, 11, 0.3);">View Rating</a>
            </div>` : ''}
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">This is an automated notification from UrbanSetu.</p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending rating received email:', error);
    throw error;
  }
};

// Send Loan Applied Email
export const sendLoanAppliedEmail = async (email, loanDetails) => {
  try {
    const {
      propertyName,
      loanType,
      loanAmount,
      loanUrl
    } = loanDetails;

    const subject = `📝 Rental Loan Application Submitted - ${propertyName}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Loan Application Submitted - UrbanSetu</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #3b82f6, #2563eb); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(59, 130, 246, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">📝</span>
              </div>
              <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Loan Application Submitted</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">Under review</p>
            </div>
            
            <div style="background-color: #eff6ff; padding: 25px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 25px;">
              <h2 style="color: #1e40af; margin: 0 0 15px 0; font-size: 20px;">Application Details</h2>
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Property:</strong> ${propertyName}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Loan Type:</strong> ${loanType}</p>
                <p style="color: #4b5563; margin: 0;"><strong>Loan Amount:</strong> ₹${loanAmount}</p>
              </div>
              <p style="color: #1e40af; margin: 15px 0 0; font-size: 14px; line-height: 1.6;">
                Your ${loanType} loan application of ₹${loanAmount} for ${propertyName} has been submitted successfully. Our team will review your application and you will be notified of the decision soon.
              </p>
            </div>
            
            ${loanUrl ? `<div style="text-align: center; margin-top: 30px;">
              <a href="${loanUrl}" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">View Loan Application</a>
            </div>` : ''}
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">This is an automated notification from UrbanSetu.</p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending loan applied email:', error);
    throw error;
  }
};

// Send Loan Approved Email
export const sendLoanApprovedEmail = async (email, loanDetails) => {
  try {
    const {
      propertyName,
      loanType,
      loanAmount,
      loanUrl
    } = loanDetails;

    const subject = `✅ Rental Loan Approved - ${propertyName}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Loan Approved - UrbanSetu</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">✅</span>
              </div>
              <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Loan Approved!</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">Congratulations</p>
            </div>
            
            <div style="background-color: #f0fdf4; padding: 25px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 25px;">
              <h2 style="color: #065f46; margin: 0 0 15px 0; font-size: 20px;">Approval Details</h2>
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Property:</strong> ${propertyName}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Loan Type:</strong> ${loanType}</p>
                <p style="color: #4b5563; margin: 0;"><strong>Approved Amount:</strong> ₹${loanAmount}</p>
              </div>
              <p style="color: #065f46; margin: 15px 0 0; font-size: 14px; line-height: 1.6;">
                Great news! Your ${loanType} loan application of ₹${loanAmount} for ${propertyName} has been approved. The loan will be disbursed to your account soon. You will receive another notification once the disbursement is complete.
              </p>
            </div>
            
            ${loanUrl ? `<div style="text-align: center; margin-top: 30px;">
              <a href="${loanUrl}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">View Loan Details</a>
            </div>` : ''}
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">This is an automated notification from UrbanSetu.</p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending loan approved email:', error);
    throw error;
  }
};

// Send Loan Rejected Email
export const sendLoanRejectedEmail = async (email, loanDetails) => {
  try {
    const {
      propertyName,
      loanType,
      loanAmount,
      rejectionReason,
      loanUrl
    } = loanDetails;

    const subject = `❌ Rental Loan Application Rejected - ${propertyName}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Loan Rejected - UrbanSetu</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(239, 68, 68, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">❌</span>
              </div>
              <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Loan Application Rejected</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">Application status</p>
            </div>
            
            <div style="background-color: #fef2f2; padding: 25px; border-radius: 8px; border-left: 4px solid #ef4444; margin-bottom: 25px;">
              <h2 style="color: #991b1b; margin: 0 0 15px 0; font-size: 20px;">Rejection Details</h2>
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Property:</strong> ${propertyName}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Loan Type:</strong> ${loanType}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Loan Amount:</strong> ₹${loanAmount}</p>
                ${rejectionReason ? `<p style="color: #4b5563; margin: 10px 0 0;"><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
              </div>
              <p style="color: #991b1b; margin: 15px 0 0; font-size: 14px; line-height: 1.6;">
                We regret to inform you that your ${loanType} loan application of ₹${loanAmount} for ${propertyName} has been rejected. ${rejectionReason ? `Reason: ${rejectionReason}` : 'Please contact support for more details.'}
              </p>
            </div>
            
            ${loanUrl ? `<div style="text-align: center; margin-top: 30px;">
              <a href="${loanUrl}" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">View Loan Details</a>
            </div>` : ''}
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">This is an automated notification from UrbanSetu.</p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending loan rejected email:', error);
    throw error;
  }
};

// Send Loan Disbursed Email
export const sendLoanDisbursedEmail = async (email, loanDetails) => {
  try {
    const {
      propertyName,
      loanType,
      disbursedAmount,
      disbursementReference,
      loanUrl
    } = loanDetails;

    const subject = `💰 Rental Loan Disbursed - ${propertyName}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Loan Disbursed - UrbanSetu</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">💰</span>
              </div>
              <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Loan Disbursed!</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">Payment received</p>
            </div>
            
            <div style="background-color: #f0fdf4; padding: 25px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 25px;">
              <h2 style="color: #065f46; margin: 0 0 15px 0; font-size: 20px;">Disbursement Details</h2>
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Property:</strong> ${propertyName}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Loan Type:</strong> ${loanType}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Disbursed Amount:</strong> ₹${disbursedAmount}</p>
                <p style="color: #4b5563; margin: 0;"><strong>Reference:</strong> ${disbursementReference}</p>
              </div>
              <p style="color: #065f46; margin: 15px 0 0; font-size: 14px; line-height: 1.6;">
                Your ${loanType} loan of ₹${disbursedAmount} for ${propertyName} has been successfully disbursed to your account. Reference number: ${disbursementReference}. Please check your account balance and ensure all EMI payments are made on time.
              </p>
            </div>
            
            ${loanUrl ? `<div style="text-align: center; margin-top: 30px;">
              <a href="${loanUrl}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">View Loan Details</a>
            </div>` : ''}
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">This is an automated notification from UrbanSetu.</p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending loan disbursed email:', error);
    throw error;
  }
};

// Send Report Acknowledgement Email
export const sendReportAcknowledgementEmail = async (email, reportDetails) => {
  const clientBaseUrl = 'https://urbansetu.vercel.app';
  try {
    const {
      messageId,
      category,
      subCategory,
      createdAt
    } = reportDetails;

    const subject = `AI Report Received - UrbanSetu`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Report Received - UrbanSetu</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #6366f1, #4f46e5); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(99, 102, 241, 0.3);">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold;">🤖</span>
              </div>
              <h1 style="color: #1f2937; margin: 0; font-size: 28px;">We've Got You Covered</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">AI Response Report</p>
            </div>
            
            <div style="background-color: #eef2ff; padding: 25px; border-radius: 8px; border-left: 4px solid #6366f1; margin-bottom: 25px;">
              <h2 style="color: #3730a3; margin: 0 0 15px 0; font-size: 20px;">Report Details</h2>
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Category:</strong> ${category}</p>
                <p style="color: #4b5563; margin: 0 0 10px 0;"><strong>Sub-Category:</strong> ${subCategory}</p>
                <p style="color: #4b5563; margin: 0;"><strong>Date:</strong> ${formatIndiaTime(createdAt)}</p>
              </div>
              <p style="color: #3730a3; margin: 15px 0 0; font-size: 14px; line-height: 1.6;">
                Thank you for helping us improve our AI. We have received your report regarding an inappropriate or incorrect AI response. Our team will review this incident to enhance safety and accuracy.
              </p>
            </div>
             
             <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 20px; font-size: 13px; color: #6b7280; text-align: center;">
                 <p style="margin: 0;"><strong>Note:</strong> Your feedback directly helps in training and finetuning our AI models.</p>
             </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${clientBaseUrl}/user/ai" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(99, 102, 241, 0.3);">Return to AI Assistant</a>
            </div>

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">This is an automated notification from UrbanSetu.</p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending report acknowledgement email:', error);
    // Don't throw error here to avoid blocking the report process
    return { success: false, error: error.message };
  }
};

// Send Shared Chat Link Email
export const sendSharedChatLinkEmail = async (email, sharedLink, title, expiryDate, messageCount, shareToken = null) => {
  const clientBaseUrl = 'https://urbansetu.vercel.app';
  const formattedExpiry = expiryDate ? new Date(expiryDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }) : 'Never expires';

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your Shared Chat Link is Ready - SetuAI',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">SetuAI</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Shared Conversation</p>
          </div>
          
          <!-- Success Banner -->
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; background-color: #eff6ff; padding: 15px; border-radius: 50%; margin-bottom: 15px;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </div>
            <h2 style="color: #1f2937; margin: 0; font-size: 22px;">Public Link Created</h2>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Anyone with the link can view this chat.</p>
          </div>

          <!-- Chat Details -->
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Link Details</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Title</td>
                <td style="padding: 8px 0; text-align: right; color: #1f2937; font-weight: 500; font-size: 14px;">${title}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Messages</td>
                <td style="padding: 8px 0; text-align: right; color: #1f2937; font-weight: 500; font-size: 14px;">${messageCount}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Expires On</td>
                <td style="padding: 8px 0; text-align: right; color: #e11d48; font-weight: 500; font-size: 14px;">${formattedExpiry}</td>
              </tr>
            </table>

            <div style="margin-top: 15px; background: #fff; padding: 10px; border: 1px solid #e5e7eb; border-radius: 4px; word-break: break-all; color: #4b5563; font-size: 12px; font-family: monospace;">
              ${sharedLink}
            </div>
            
            ${shareToken ? `
            <div style="margin-top: 15px; border-top: 1px dashed #e5e7eb; padding-top: 15px; text-align: center;">
              <p style="color: #6b7280; margin: 0 0 10px; font-size: 13px;">Or copy this access token:</p>
              <div style="background: #eff6ff; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 14px; color: #1e40af; border: 1px solid #bfdbfe; display: inline-block; padding-left: 15px; padding-right: 15px; user-select: all;">
                ${shareToken}
              </div>
            </div>
            ` : ''}
          </div>

          <!-- Action Buttons -->
          <div style="text-align: center; margin-top: 10px;">
            <a href="${sharedLink}" style="display: block; width: 100%; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 0; border-radius: 8px; font-weight: bold; font-size: 16px; margin-bottom: 15px; box-sizing: border-box;">View Shared Chat</a>
            
            <a href="${clientBaseUrl}/user/ai" style="display: block; width: 100%; background-color: transparent; color: #2563eb; text-decoration: none; padding: 14px 0; border-radius: 8px; font-weight: bold; font-size: 16px; border: 1px solid #2563eb; box-sizing: border-box;">Return to SetuAI</a>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved. • <a href="${clientBaseUrl}/privacy" style="color: #9ca3af; text-decoration: underline;">Privacy</a>
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'shared_chat_created') :
      createErrorResponse(new Error(result.error), 'shared_chat_created');
  } catch (error) {
    return createErrorResponse(error, 'shared_chat_created');
  }
};

// Export the current transporter (will be set during initialization)

// Send Shared Chat Revoked Email
export const sendSharedChatRevokedEmail = async (email, title, revokedDate) => {
  const clientBaseUrl = 'https://urbansetu.vercel.app';
  const formattedDate = new Date(revokedDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Shared Chat Link Revoked - SetuAI',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0; font-size: 28px;">SetuAI</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Link Revocation</p>
          </div>
          
          <!-- Success Banner -->
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; background-color: #fef2f2; padding: 15px; border-radius: 50%; margin-bottom: 15px;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
            </div>
            <h2 style="color: #1f2937; margin: 0; font-size: 22px;">Revocation Successful</h2>
            <p style="color: #6b7280; margin: 10px 0 0 0;">This shared link is no longer accessible.</p>
          </div>

          <!-- Revocation Details -->
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Revocation Details</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Chat Title</td>
                <td style="padding: 8px 0; text-align: right; color: #1f2937; font-weight: 500; font-size: 14px;">${title}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Revoked On</td>
                <td style="padding: 8px 0; text-align: right; color: #1f2937; font-weight: 500; font-size: 14px;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Status</td>
                <td style="padding: 8px 0; text-align: right; color: #dc2626; font-weight: 500; font-size: 14px;">Inactive</td>
              </tr>
            </table>
          </div>

          <!-- Action Buttons -->
          <div style="text-align: center; margin-top: 10px;">
             <a href="${clientBaseUrl}/user/ai" style="display: block; width: 100%; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 0; border-radius: 8px; font-weight: bold; font-size: 16px; box-sizing: border-box;">Return to SetuAI</a>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved. • <a href="${clientBaseUrl}/privacy" style="color: #9ca3af; text-decoration: underline;">Privacy</a>
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'shared_chat_revoked') :
      createErrorResponse(new Error(result.error), 'shared_chat_revoked');
  } catch (error) {
    return createErrorResponse(error, 'shared_chat_revoked');
  }
};




// Send Session Revoked Email
export const sendSessionRevokedEmail = async (email, device, ip, location, time) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Session Revoked - UrbanSetu Security Alert',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2563eb; text-align: center;">Session Access Revoked</h2>
        <div style="padding: 20px; background-color: #f9fafb; border-radius: 8px;">
          <p>This is a confirmation that access for a specific device has been revoked from your UrbanSetu account.</p>
          
          <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Device:</strong> ${device}</p>
            <p style="margin: 5px 0;"><strong>Location:</strong> ${location || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>IP Address:</strong> ${ip}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${formatLocalizedTime(time, ip)}</p>
          </div>

          <p style="margin-bottom: 20px;">If you did not authorize this action, please secure your account immediately.</p>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${clientBaseUrl}/user/device-management" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; margin-right: 10px;">Check Active Sessions</a>
             <a href="${clientBaseUrl}/sign-in" style="display: inline-block; background-color: #ffffff; color: #2563eb; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; border: 1px solid #2563eb; margin-right: 10px;">Sign In</a>
             <div style="margin-top: 15px;">
               <a href="${clientBaseUrl}/forgot-password" style="color: #6b7280; text-decoration: underline; font-size: 14px;">Reset Password</a>
             </div>
          </div>
        </div>
        <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px;">
          © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
        </p>
      </div>
    `
  };

  try {
    await sendEmailWithRetry(mailOptions);
    console.log(`Session revoked email sent to ${email}`);
  } catch (error) {
    console.error('Error sending session revoked email:', error);
  }
};

// Send All Sessions Revoked Email
export const sendAllSessionsRevokedEmail = async (email, count) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'All Other Sessions Signed Out - UrbanSetu Security Alert',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2563eb; text-align: center;">All Other Devices Signed Out</h2>
        <div style="padding: 20px; background-color: #f9fafb; border-radius: 8px;">
          <p>You have successfully signed out from all other devices connected to your UrbanSetu account.</p>
          
          <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb; margin: 20px 0; text-align: center;">
            <p style="font-size: 18px; margin: 0;"><strong>${count}</strong> other session(s) were terminated.</p>
          </div>

          <p>Your current session remains active. If you did not initiate this action, please reset your password immediately.</p>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${clientBaseUrl}/user/device-management" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; margin-right: 10px;">Check Active Sessions</a>
            <a href="${clientBaseUrl}/sign-in" style="display: inline-block; background-color: #ffffff; color: #2563eb; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; border: 1px solid #2563eb; margin-right: 10px;">Sign In</a>
            <div style="margin-top: 15px;">
              <a href="${clientBaseUrl}/forgot-password" style="color: #6b7280; text-decoration: underline; font-size: 14px;">Reset Password</a>
            </div>
          </div>
        </div>
        <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px;">
          © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
        </p>
      </div>
    `
  };

  try {
    await sendEmailWithRetry(mailOptions);
    console.log(`All sessions revoked email sent to ${email}`);
  } catch (error) {
    console.error('Error sending all sessions revoked email:', error);
  }
};

// Output: (Empty string to remove the duplicate block)

// Send Dispute Resolved Email
export const sendDisputeResolvedEmail = async (email, disputeDetails) => {
  try {
    const {
      propertyName,
      decision,
      amount,
      resolutionNotes,
      resolvedAt,
      resolvedBy,
      disputeUrl
    } = disputeDetails;

    const subject = `✅ Dispute Resolved - ${propertyName}`;

    const resolutionDate = resolvedAt ? formatIndiaTime(resolvedAt) : formatIndiaTime();

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dispute Resolved - UrbanSetu</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #059669; margin: 0; font-size: 28px;">Dispute Resolved</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">${propertyName}</p>
            </div>
            
            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #059669;">
              <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Resolution Details</h2>
              
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                <p style="margin: 5px 0; color: #374151;"><strong>Decision:</strong> ${decision}</p>
                ${amount > 0 ? `<p style="margin: 5px 0; color: #374151;"><strong>Refund/Compensation:</strong> ₹${amount}</p>` : ''}
              </div>
              
              ${resolutionNotes ? `
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                <p style="margin: 0 0 5px 0; font-weight: bold; color: #374151;">Resolution Notes:</p>
                <p style="margin: 0; color: #4b5563; font-style: italic;">"${resolutionNotes}"</p>
              </div>
              ` : ''}
              
              <div style="margin-top: 15px; font-size: 13px; color: #6b7280;">
                <p style="margin: 2px 0;">Resolved on: ${resolutionDate}</p>
                ${resolvedBy ? `<p style="margin: 2px 0;">Resolved by: ${resolvedBy}</p>` : ''}
              </div>

              <p style="color: #4b5563; margin: 15px 0 0 0; font-size: 14px;">
                The dispute status has been updated. You can view the full details using the link below.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${disputeUrl}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Resolution</a>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">This is an automated notification from UrbanSetu.</p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending dispute resolved email:', error);
    throw error;
  }
};

// Send Dispute Raised Acknowledgement Email (to the person who raised it)
export const sendDisputeRaisedAcknowledgementEmail = async (email, disputeDetails) => {
  try {
    const {
      propertyName,
      disputeId,
      disputeType,
      description,
      disputeUrl
    } = disputeDetails;

    const subject = `Dispute Raised Successfully - ${propertyName}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dispute Raised - UrbanSetu</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #d97706; margin: 0; font-size: 28px;">Dispute Submitted</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">${propertyName}</p>
            </div>
            
            <div style="background-color: #fffbeb; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #d97706;">
              <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">We've Received Your Dispute</h2>
              <p style="color: #4b5563; margin: 0 0 15px 0;">
                Your dispute has been successfully logged. Our team/admin will review the details and get back to you shortly.
              </p>
              
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                <p style="margin: 5px 0; color: #374151;"><strong>Dispute ID:</strong> ${disputeId}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Category:</strong> ${disputeType}</p>
              </div>

              ${description ? `
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                <p style="margin: 0 0 5px 0; font-weight: bold; color: #374151;">Description:</p>
                <p style="margin: 0; color: #4b5563; font-style: italic;">"${description}"</p>
              </div>
              ` : ''}
              
              <p style="color: #4b5563; margin: 15px 0 0 0; font-size: 14px;">
                The other party has also been notified. Please allow some time for review.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${disputeUrl}" style="background-color: #d97706; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Dispute Status</a>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">This is an automated notification from UrbanSetu.</p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending dispute acknowledgement email:', error);
    throw error;
  }
};


// Send Loan EMI Due Reminder Email
export const sendLoanEMIDueReminderEmail = async (email, details) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Upcoming EMI Payment Reminder - ${details.propertyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">EMI Payment Reminder</p>
          </div>
          
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Upcoming Payment</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              This is a reminder that your EMI payment for the <strong>${details.loanType}</strong> loan on <strong>${details.propertyName}</strong> is due on <strong>${details.dueDate}</strong>.
            </p>
            
            <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #e5e7eb;">
              <p style="margin: 5px 0; color: #374151;"><strong>Amount Due:</strong> ${details.amount}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Due Date:</strong> ${details.dueDate}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Month:</strong> ${details.month}</p>
            </div>
            
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Please ensure your account is funded to avoid any late fees or penalties.
            </p>

            <div style="background-color: #fff7ed; padding: 12px; border-radius: 6px; border-left: 3px solid #f97316; margin-bottom: 15px;">
              <p style="margin: 0; color: #c2410c; font-size: 13px;">
                <strong>Important:</strong> A penalty of <strong>5% of the EMI amount</strong> will be automatically applied for each month of delay if payment is not received by the due date.
              </p>
            </div>
            
            <div style="text-align:center; margin-top: 20px;">
              <a href="${details.loanUrl}" style="display:inline-block; background-color:#2563eb; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:600;">Pay Now</a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'loan_emi_reminder') :
      createErrorResponse(new Error(result.error), 'loan_emi_reminder');
  } catch (error) {
    return createErrorResponse(error, 'loan_emi_reminder');
  }
};

// Send Loan EMI Overdue Reminder Email
export const sendLoanEMIOverdueReminderEmail = async (email, details) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Overdue EMI Payment Alert - ${details.propertyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Payment Overdue Alert</p>
          </div>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
            <h2 style="color: #991b1b; margin: 0 0 15px 0; font-size: 20px;">Action Required: Payment Overdue</h2>
            <p style="color: #7f1d1d; margin: 0 0 15px 0; line-height: 1.6;">
              Your EMI payment for the <strong>${details.loanType}</strong> loan on <strong>${details.propertyName}</strong> is overdue.
            </p>
            
            <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #fca5a5;">
              <p style="margin: 5px 0; color: #374151;"><strong>Amount Due:</strong> ${details.amount}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Due Date:</strong> ${details.dueDate}</p>
              <p style="margin: 5px 0; color: #dc2626; font-weight: bold;"><strong>Days Overdue:</strong> ${details.daysOverdue}</p>
              ${details.penalty > 0 ? `
                <div style="margin: 10px 0; padding: 10px; background-color: #fee2e2; border-radius: 4px;">
                  <p style="margin: 0 0 5px 0; color: #dc2626;"><strong>Penalty Applied:</strong> ${details.penalty}</p>
                  <p style="margin: 0; font-size: 12px; color: #991b1b;">
                    <i>* A Late Payment Fee is applied for delays beyond the due date. This helps cover administrative costs and encourages timely repayments.</i>
                  </p>
                </div>
              ` : ''}
              <p style="margin: 5px 0; color: #374151; font-weight: bold;"><strong>Total Payable:</strong> ${details.totalAmount}</p>
            </div>
            
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Please make the payment immediately to avoid further penalties and impact on your credit score.
            </p>
            
            <div style="text-align:center; margin-top: 20px;">
              <a href="${details.loanUrl}" style="display:inline-block; background-color:#dc2626; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:600;">Pay Now</a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'loan_emi_overdue') :
      createErrorResponse(new Error(result.error), 'loan_emi_overdue');
  } catch (error) {
    return createErrorResponse(error, 'loan_emi_overdue');
  }
};

// Send Loan Repaid Email
export const sendLoanRepaidEmail = async (email, details) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Loan Repayment Confirmation - ${details.propertyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #059669; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Loan Repayment Confirmation</p>
          </div>
          
          <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #059669;">
            <h2 style="color: #065f46; margin: 0 0 15px 0; font-size: 20px;">Loan Fully Repaid!</h2>
            <p style="color: #047857; margin: 0 0 15px 0; line-height: 1.6;">
              Congratulations! You have successfully repaid your <strong>${details.loanType}</strong> loan for <strong>${details.propertyName}</strong>.
            </p>
            
            <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #d1fae5;">
              <p style="margin: 5px 0; color: #374151;"><strong>Total Amount Paid:</strong> ₹${details.totalPaid}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Closure Date:</strong> ${details.repaidAt}</p>
            </div>
            
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              This loan is now closed. Thank you for using our financial services.
            </p>
            
            <div style="text-align:center; margin-top: 20px;">
              <a href="${details.loanUrl}" style="display:inline-block; background-color:#059669; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:600;">View Loan Details</a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'loan_repaid') :
      createErrorResponse(new Error(result.error), 'loan_repaid');
  } catch (error) {
    return createErrorResponse(error, 'loan_repaid');
  }
};

// Send Loan EMI Payment Success Email
export const sendLoanEMIPaymentSuccessEmail = async (email, details) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `EMI Payment Received - ${details.propertyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">EMI Payment Confirmation</p>
          </div>
          
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
            <h2 style="color: #1e40af; margin: 0 0 15px 0; font-size: 20px;">Payment Successful</h2>
            <p style="color: #1e3a8a; margin: 0 0 15px 0; line-height: 1.6;">
              We have successfully received your EMI payment for the <strong>${details.loanType}</strong> loan on <strong>${details.propertyName}</strong>.
            </p>
            
            <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #bfdbfe;">
              <p style="margin: 5px 0; color: #374151;"><strong>Transaction ID:</strong> ${details.paymentId}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>EMI for:</strong> ${details.emiMonth}/${details.emiYear}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Base Amount:</strong> ₹${details.baseAmount || details.amount}</p>
              
              ${details.penaltyAmount > 0 ? `<p style="margin: 5px 0; color: #dc2626;"><strong>Penalty Paid:</strong> ₹${details.penaltyAmount}</p>` : ''}
              ${details.discountApplied > 0 ? `<p style="margin: 5px 0; color: #059669;"><strong>SetuCoins Discount:</strong> -₹${details.discountApplied}</p>` : ''}
              
              <p style="margin: 8px 0 5px 0; color: #1e40af; font-size: 16px; border-top: 1px dashed #bfdbfe; padding-top: 5px;"><strong>Total Paid:</strong> ₹${details.amount}</p>
              <p style="margin: 5px 0; color: #4b5563;"><strong>Total Remaining Balance:</strong> ₹${details.remainingBalance}</p>
            </div>
            
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6; font-size: 14px;">
              Thank you for making your payment on time! You can view your updated loan status and download receipts anytime in your dashboard.
            </p>
            
            <div style="text-align:center; margin-top: 20px;">
              <a href="${details.loanUrl}" style="display:inline-block; background-color:#2563eb; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:600; margin: 10px 5px;">View Loan Status</a>
              ${details.receiptUrl ? `<a href="${details.receiptUrl}" style="display:inline-block; background-color: #f0f7ff; color:#2563eb; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:600; border: 1px solid #2563eb; margin: 10px 5px;">Download Receipt</a>` : ''}
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'loan_emi_success') :
      createErrorResponse(new Error(result.error), 'loan_emi_success');
  } catch (error) {
    return createErrorResponse(error, 'loan_emi_success');
  }
};

// Send Loan Repayment Completion Email
export const sendLoanRepaymentCompletionEmail = async (email, details) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Congratulations! Your Loan is Fully Repaid - ${details.propertyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f0fdf4;">
        <div style="background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); border-top: 6px solid #10b981;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="width: 80px; height: 80px; background-color: #d1fae5; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
              <span style="font-size: 40px;">🎉</span>
            </div>
            <h1 style="color: #065f46; margin: 0; font-size: 28px;">Loan Fully Repaid!</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Congratulations on completing your loan investment</p>
          </div>
          
          <div style="background-color: #f0fdf4; padding: 25px; border-radius: 10px; margin-bottom: 25px; border: 1px solid #bbf7d0;">
            <p style="color: #166534; margin: 0 0 15px 0; line-height: 1.6; font-size: 16px;">
              Hello <strong>${details.userName}</strong>,
            </p>
            <p style="color: #166534; margin: 0 0 15px 0; line-height: 1.6;">
              We are thrilled to inform you that your <strong>${details.loanType}</strong> loan for <strong>${details.propertyName}</strong> has been <strong>completely repaid</strong>.
            </p>
            
            <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px dashed #10b981;">
              <h3 style="color: #065f46; margin-top: 0; font-size: 18px;">Repayment Summary</h3>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <p style="margin: 4px 0; color: #374151;"><strong>Loan ID:</strong> <span style="font-family: monospace;">${details.loanId}</span></p>
                <p style="margin: 4px 0; color: #374151;"><strong>Principal Amount:</strong> ₹${details.principalAmount}</p>
                <p style="margin: 4px 0; color: #374151;"><strong>Total Interest Paid:</strong> ₹${details.totalInterest}</p>
                <p style="margin: 4px 0; color: #374151;"><strong>Tenure:</strong> ${details.tenure} Months</p>
                <div style="border-top: 1px solid #e5e7eb; margin: 10px 0; padding-top: 10px;">
                  <p style="margin: 4px 0; color: #065f46; font-size: 18px;"><strong>Total Repayment:</strong> ₹${details.totalRepaid}</p>
                </div>
              </div>
            </div>
            
            <p style="color: #166534; margin: 15px 0; line-height: 1.6;">
              Thank you for being a valued member of UrbanSetu. Your disciplined repayment has further strengthened your trust score on our platform.
            </p>
          </div>
          
          <div style="text-align: center;">
            <a href="${details.loanUrl}" style="display:inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);">View Loan Summary</a>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'loan_repaid_complete') :
      createErrorResponse(new Error(result.error), 'loan_repaid_complete');
  } catch (error) {
    return createErrorResponse(error, 'loan_repaid_complete');
  }
};


// Send Rent Payment Due Reminder Email
export const sendRentPaymentDueReminderEmail = async (email, details) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Rent Payment Reminder - ${details.propertyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Rent Payment Reminder</p>
          </div>
          
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Upcoming Rent Payment</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              This is a gentle reminder that your rent payment for <strong>${details.propertyName}</strong> is due on <strong>${details.dueDate}</strong>.
            </p>
            
            <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #e5e7eb;">
              <p style="margin: 5px 0; color: #374151;"><strong>Month:</strong> ${details.month}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Amount Due:</strong> ₹${details.amount}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Due Date:</strong> ${details.dueDate}</p>
            </div>
            
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Please make the payment by the due date to avoid any late fees.
            </p>
            
            <div style="text-align:center; margin-top: 20px;">
              <a href="${details.paymentUrl}" style="display:inline-block; background-color:#2563eb; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:600;">Pay Rent Now</a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'rent_due_reminder') :
      createErrorResponse(new Error(result.error), 'rent_due_reminder');
  } catch (error) {
    return createErrorResponse(error, 'rent_due_reminder');
  }
};

// Send Rent Payment Overdue Reminder Email
export const sendRentPaymentOverdueReminderEmail = async (email, details) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Urgent: Rent Payment Overdue - ${details.propertyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Payment Overdue Alert</p>
          </div>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
            <h2 style="color: #991b1b; margin: 0 0 15px 0; font-size: 20px;">Action Required: Rent Overdue</h2>
            <p style="color: #7f1d1d; margin: 0 0 15px 0; line-height: 1.6;">
              Your rent payment for <strong>${details.propertyName}</strong> is overdue by <strong>${details.daysOverdue} days</strong>.
            </p>
            
            <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #fca5a5;">
              <p style="margin: 5px 0; color: #374151;"><strong>Month:</strong> ${details.month}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Base Amount:</strong> ₹${details.amount}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Due Date:</strong> ${details.dueDate}</p>
              ${details.penalty > 0 ? `<p style="margin: 5px 0; color: #dc2626;"><strong>Late Fee Applied:</strong> ₹${details.penalty}</p>` : ''}
              <p style="margin: 5px 0; color: #374151; font-weight: bold;"><strong>Total Payable:</strong> ₹${details.totalAmount}</p>
            </div>
            
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Please make the payment immediately to avoid further penalties.
            </p>
            
            <div style="text-align:center; margin-top: 20px;">
              <a href="${details.paymentUrl}" style="display:inline-block; background-color:#dc2626; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:600;">Pay Rent Now</a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'rent_overdue_reminder') :
      createErrorResponse(new Error(result.error), 'rent_overdue_reminder');
  } catch (error) {
    return createErrorResponse(error, 'rent_overdue_reminder');
  }
};

// Send Rent Payment Confirmation Email
export const sendRentPaymentConfirmationEmail = async (email, details) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Rent Payment Receipt - ${details.propertyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #059669; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Payment Receipt</p>
          </div>
          
          <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #059669;">
            <h2 style="color: #065f46; margin: 0 0 15px 0; font-size: 20px;">Payment Successful</h2>
            <p style="color: #047857; margin: 0 0 15px 0; line-height: 1.6;">
              Thank you! Your rent payment for <strong>${details.propertyName}</strong> has been successfully processed.
            </p>
            
            <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #d1fae5;">
              <p style="margin: 5px 0; color: #374151;"><strong>Transaction ID:</strong> ${details.transactionId}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Month:</strong> ${details.month}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Amount Paid:</strong> ₹${details.amount}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Date:</strong> ${details.paymentDate}</p>
            </div>
            
            <div style="text-align:center; margin-top: 20px;">
              <a href="${details.walletUrl}" style="display:inline-block; background-color:#059669; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:600;">View Rent Wallet</a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'rent_payment_receipt') :
      createErrorResponse(new Error(result.error), 'rent_payment_receipt');
  } catch (error) {
    return createErrorResponse(error, 'rent_payment_receipt');
  }
};

// Export the current transporter (will be set during initialization)
export default currentTransporter;

// Send Token Received Email
export const sendTokenReceivedEmail = async (buyerEmail, buyerName, sellerEmail, sellerName, propertyName, amount) => {
  const buyerMailOptions = {
    from: process.env.EMAIL_USER,
    to: buyerEmail,
    subject: 'Token Payment Confirmation - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Token Payment Received</p>
          </div>
          <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #059669;">
            <h2 style="color: #065f46; margin: 0 0 15px 0; font-size: 20px;">Payment Successful!</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Dear ${buyerName},<br><br>
              This is to confirm that your token payment for <strong>${propertyName}</strong> has been successfully marked as received by the seller, <strong>${sellerName}</strong>.
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              The property status has been updated to <strong>Under Contract</strong> (Sale-Lock).
            </p>
          </div>
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
          </div>
        </div>
      </div>
    `
  };

  const sellerMailOptions = {
    from: process.env.EMAIL_USER,
    to: sellerEmail,
    subject: 'Token Marked as Received - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Action Confirmed</p>
          </div>
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
            <h2 style="color: #1e40af; margin: 0 0 15px 0; font-size: 20px;">Successfully Updated</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Dear ${sellerName},<br><br>
              You have successfully marked the token payment as received for <strong>${propertyName}</strong> from buyer <strong>${buyerName}</strong>.
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              The property is now locked for this sale processing.
            </p>
          </div>
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const buyerResult = await sendEmailWithRetry(buyerMailOptions);
    const sellerResult = await sendEmailWithRetry(sellerMailOptions);
    return {
      success: buyerResult.success && sellerResult.success,
      buyerMessageId: buyerResult.messageId,
      sellerMessageId: sellerResult.messageId
    };
  } catch (error) {
    return createErrorResponse(error, 'token_received_email');
  }
};

// Send Property Sold Email
export const sendPropertySoldEmail = async (buyerEmail, buyerName, sellerEmail, sellerName, propertyName) => {
  const buyerMailOptions = {
    from: process.env.EMAIL_USER,
    to: buyerEmail,
    subject: 'Congratulations! Property Purchase Completed - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Property Sold!</p>
          </div>
          <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #059669;">
            <h2 style="color: #065f46; margin: 0 0 15px 0; font-size: 20px;">Congratulations!</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Dear ${buyerName},<br><br>
              Congratulations on your new property! The sale for <strong>${propertyName}</strong> has been marked as completed by seller <strong>${sellerName}</strong>.
            </p>
          </div>
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
          </div>
        </div>
      </div>
    `
  };

  const sellerMailOptions = {
    from: process.env.EMAIL_USER,
    to: sellerEmail,
    subject: 'Property Sale Marked as Completed - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Sale Completed</p>
          </div>
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
            <h2 style="color: #1e40af; margin: 0 0 15px 0; font-size: 20px;">Marked as Sold</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Dear ${sellerName},<br><br>
              You have successfully marked the property <strong>${propertyName}</strong> as SOLD to buyer <strong>${buyerName}</strong>.
            </p>
          </div>
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const buyerResult = await sendEmailWithRetry(buyerMailOptions);
    const sellerResult = await sendEmailWithRetry(sellerMailOptions);
    return {
      success: buyerResult.success && sellerResult.success,
      buyerMessageId: buyerResult.messageId,
      sellerMessageId: sellerResult.messageId
    };
  } catch (error) {
    return createErrorResponse(error, 'sale_completed_email');
  }
};

// Send Dispute Alert Email
export const sendDisputeAlertEmail = async (adminEmails, disputeDetails) => {
  // Ensure adminEmails is an array or single string
  const recipients = Array.isArray(adminEmails) ? adminEmails : [adminEmails];

  // We send individual emails or one email with cc. Loops are safer/simpler here.
  const results = [];

  for (const email of recipients) {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Action Required: Property Sale Dispute Reported - UrbanSetu',
      html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #dc2626; margin: 0; font-size: 28px;">UrbanSetu</h1>
                <p style="color: #6b7280; margin: 10px 0 0 0;">Dispute Alert</p>
              </div>
              <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
                <h2 style="color: #991b1b; margin: 0 0 15px 0; font-size: 20px;">Dispute Reported</h2>
                <p style="color: #4b5563; margin: 0 0 10px 0;">A dispute has been reported for a completed sale.</p>
                <ul style="color: #4b5563; margin: 0 0 15px 0; padding-left: 20px;">
                   <li><strong>Listing:</strong> ${disputeDetails.propertyName}</li>
                   <li><strong>Booking ID:</strong> ${disputeDetails.bookingId}</li>
                   <li><strong>Reported By:</strong> ${disputeDetails.reporterName} (${disputeDetails.reporterRole})</li>
                   <li><strong>Reason:</strong> ${disputeDetails.reason}</li>
                </ul>
                <p style="color: #4b5563;">Please investigate via the Admin Panel.</p>
              </div>
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="color: #9ca3af; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
              </div>
            </div>
          </div>
        `
    };

    try {
      const res = await sendEmailWithRetry(mailOptions);
      results.push(res);
    } catch (e) {
      console.error('Failed to send dispute email to ' + email, e);
    }
  }

  return createSuccessResponse(null, 'dispute_alert_email');
};
// Profile Update Success Email
export const sendProfileUpdateSuccessEmail = async (email, username, role, coinsEarned = 0) => {
  const profileLink = role === 'admin' ?
    `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/admin/profile` :
    `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/profile`;

  const signinLink = `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/sign-in`;

  const emailData = {
    to: email,
    subject: coinsEarned > 0 ? 'Profile Completed! You Earned SetuCoins 🪙 - UrbanSetu' : 'Profile Updated Successfully - UrbanSetu',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Profile Updated Successfully</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">${coinsEarned > 0 ? 'Reward Unlocked!' : 'Profile Updated!'}</h1>
            <p style="color: #bfdbfe; margin: 10px 0 0; font-size: 16px;">${coinsEarned > 0 ? 'Your profile is now complete' : 'Your account information has been updated'}</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #3b82f6, #2563eb); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(37, 99, 235, 0.3); position: relative;">
                <span style="color: #ffffff; font-size: 36px; font-weight: bold; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">✓</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">Changes Saved Successfully</h2>
              <p style="color: #4b5563; margin: 0; font-size: 16px; line-height: 1.6;">
                Hi ${username}, your profile information has been successfully updated on ${formatIndiaTime()}.
              </p>
            </div>
            
            ${coinsEarned > 0 ? `
            <!-- Warning: Styling inline for email compatibility -->
            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%); border: 2px dashed #f59e0b; border-radius: 12px; padding: 25px; margin-bottom: 30px; text-align: center;">
              <span style="display: block; font-size: 14px; color: #b45309; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Profile Completion Bonus</span>
              <div style="font-size: 36px; font-weight: 800; color: #d97706; margin: 10px 0;">
                +${coinsEarned} <span style="font-size: 28px;">🪙</span>
              </div>
              <p style="color: #92400e; margin: 0; font-weight: 600;">SetuCoins Added to Wallet</p>
            </div>
            ` : ''}

            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
              <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <span style="color: #2563eb; font-size: 20px; margin-right: 10px;">🛡️</span>
                <h4 style="color: #1e40af; margin: 0; font-size: 16px; font-weight: 600;">Security Check</h4>
              </div>
              <p style="color: #1e40af; margin: 0; font-size: 14px; line-height: 1.5;">
                If you did not make these changes, please secure your account immediately by resetting your password.
              </p>
            </div>
            
            <div style="text-align: center; display: flex; flex-direction: column; gap: 15px; align-items: center;">
              <a href="${signinLink}" 
                 style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; transition: all 0.3s ease; width: 200px;">
                Sign In
              </a>
              <a href="${profileLink}" 
                 style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; transition: all 0.3s ease; width: 200px;">
                View Profile
              </a>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <p style="color: #6b7280; font-size: 14px;">
                Forgot your password? <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/forgot-password" style="color: #3b82f6; text-decoration: none; font-weight: 500;">Reset it here</a>
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; margin: 0 0 15px; font-size: 14px;">
              This email was sent to ${email} regarding recent changes to your UrbanSetu profile.
            </p>
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await sendEmailWithRetry(emailData);
    console.log(`✅ Profile update success email sent to: ${email}`);
  } catch (error) {
    console.error(`❌ Failed to send profile update success email to ${email}:`, error);
    // We don't throw here to avoid failing the main request if email fails, 
    // unless the caller handles it.
  }
};

// Send re-engagement email to inactive users
export const sendReEngagementEmail = async (email, username) => {
  const { unsubscribeUrl } = await getUnsubscribeData(email);
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Unlock New Opportunities: Latest Trends & Updates on UrbanSetu 🌟',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu 🏙️</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 18px;">Hello, ${username}! 👋</p>
          </div>
          
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">See What's New Since Your Last Visit 🚀</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              It's been a while, and we'd love to welcome you back. The UrbanSetu community has grown with exciting new opportunities tailored just for you. ✨
            </p>
            
            <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
               <h3 style="color: #111827; margin: 0 0 10px 0; font-size: 16px;">🔥 Trending Now:</h3>
               <ul style="color: #4b5563; padding-left: 20px; margin: 0; list-style-type: none;">
                  <li style="margin-bottom: 8px;">💎 <strong>New premium listings</strong> in your favorite areas</li>
                  <li style="margin-bottom: 8px;">🗣️ <strong>Active community discussions</strong> on property rates</li>
                  <li style="margin-bottom: 8px;">📈 <strong>Latest rental trends</strong> and verified movers</li>
               </ul>
            </div>

            <p style="color: #4b5563; margin: 0 0 20px 0; line-height: 1.6;">
              Come back and check what's specially curated for you.
            </p>

            <div style="text-align: center; margin: 25px 0;">
              <a href="${clientBaseUrl}/sign-in" style="display:inline-block; background-color:#2563eb; color:#ffffff; text-decoration:none; padding:12px 30px; border-radius:6px; font-weight:bold; font-size: 16px;">Sign In & Explore 🚀</a>
            </div>
            
            <div style="text-align: center; display: flex; justify-content: center; gap: 15px; flex-wrap: wrap;">
               <a href="${clientBaseUrl}/search" style="color:#2563eb; text-decoration:none; font-size: 14px;">🔍 Explore Properties</a> | 
               <a href="${clientBaseUrl}/user/community" style="color:#2563eb; text-decoration:none; font-size: 14px;">💬 Join Discussion</a>
            </div>

            <div style="margin-top: 25px; border-top: 1px dashed #bfdbfe; padding-top: 20px;">
              <h3 style="color: #1e40af; text-align: center; margin: 0 0 15px 0; font-size: 16px;">✨ Explore More</h3>
              <div style="text-align: center; font-size: 0;">
                  <a href="${clientBaseUrl}/user/ai" style="display: inline-block; width: 70px; margin: 0 5px 10px; text-decoration: none; color: #4b5563; vertical-align: top;">
                      <div style="background-color: white; border-radius: 12px; width: 45px; height: 45px; line-height: 45px; margin: 0 auto 5px; font-size: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">🤖</div>
                      <div style="font-size: 11px; font-weight: 600;">AI Guide</div>
                  </a>
                  <a href="${clientBaseUrl}/user/community" style="display: inline-block; width: 70px; margin: 0 5px 10px; text-decoration: none; color: #4b5563; vertical-align: top;">
                      <div style="background-color: white; border-radius: 12px; width: 45px; height: 45px; line-height: 45px; margin: 0 auto 5px; font-size: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">💬</div>
                      <div style="font-size: 11px; font-weight: 600;">Groups</div>
                  </a>
                  <a href="${clientBaseUrl}/user/search" style="display: inline-block; width: 70px; margin: 0 5px 10px; text-decoration: none; color: #4b5563; vertical-align: top;">
                      <div style="background-color: white; border-radius: 12px; width: 45px; height: 45px; line-height: 45px; margin: 0 auto 5px; font-size: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">🔍</div>
                      <div style="font-size: 11px; font-weight: 600;">Search</div>
                  </a>
                  <a href="${clientBaseUrl}/user/services" style="display: inline-block; width: 70px; margin: 0 5px 10px; text-decoration: none; color: #4b5563; vertical-align: top;">
                      <div style="background-color: white; border-radius: 12px; width: 45px; height: 45px; line-height: 45px; margin: 0 auto 5px; font-size: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">🛠️</div>
                      <div style="font-size: 11px; font-weight: 600;">Services</div>
                  </a>
              </div>
            </div>

          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
            <p style="color: #9ca3af; margin: 5px 0 0 0; font-size: 12px;">
              You received this email because you haven't visited us in a while.
            </p>
            <div style="margin-top: 15px; border-top: 1px solid #eeeeee; padding-top: 15px;">
              <p style="color: #999999; font-size: 12px; margin: 0;">
                Don't want to receive these emails? 
                <a href="${unsubscribeUrl}" style="color: #2563eb; text-decoration: underline;">Unsubscribe</a> from these emails.
              </p>
            </div>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions, 3, 1000, 'promotional');
    return result.success ?
      createSuccessResponse(result.messageId, 're_engagement_email') :
      createErrorResponse(new Error(result.error), 're_engagement_email');
  } catch (error) {
    return createErrorResponse(error, 're_engagement_email');
  }
};

// Send trending/new property update email
export const sendTrendingUpdateEmail = async (email, username, newProperties, trendingProperties) => {
  const { unsubscribeUrl } = await getUnsubscribeData(email);
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';

  const generatePropertyCard = (prop) => `
    <div style="width: 100%; max-width: 260px; display: inline-block; vertical-align: top; margin: 10px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid #e5e7eb; text-align: left;">
      <div style="height: 150px; background-color: #e5e7eb; position: relative;">
        <img src="${prop.imageUrls && prop.imageUrls[0] ? prop.imageUrls[0] : 'https://via.placeholder.com/260x150?text=No+Image'}" alt="${prop.name}" style="width: 100%; height: 100%; object-fit: cover;" />
        ${prop.offer ? '<span style="position: absolute; top: 10px; right: 10px; background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Offer</span>' : ''}
      </div>
      <div style="padding: 12px;">
        <h4 style="margin: 0 0 5px 0; color: #111827; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${prop.name}">${prop.name}</h4>
        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">📍 ${prop.city}, ${prop.state}</p>
        <p style="margin: 0 0 12px 0; color: #2563eb; font-weight: bold; font-size: 15px;">
          ₹${prop.offer ? prop.discountPrice.toLocaleString('en-IN') : prop.regularPrice.toLocaleString('en-IN')}
          <span style="font-size: 12px; color: #6b7280; font-weight: normal;">${prop.type === 'rent' ? '/mo' : ''}</span>
        </p>
        <a href="${clientBaseUrl}/listing/${prop._id}" style="display: block; text-align: center; background-color: #f3f4f6; color: #1f2937; text-decoration: none; padding: 8px 0; border-radius: 4px; font-size: 13px; font-weight: 600; border: 1px solid #e5e7eb;">View Details</a>
      </div>
    </div>
  `;

  const newPropsHtml = newProperties && newProperties.length > 0 ? newProperties.map(generatePropertyCard).join('') : '';
  const trendingPropsHtml = trendingProperties && trendingProperties.length > 0 ? trendingProperties.map(generatePropertyCard).join('') : '';

  if (!newPropsHtml && !trendingPropsHtml) return createErrorResponse(new Error('No properties to send'), 'trending_update_email');

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Weekly Roundup: See Trending & New Properties on UrbanSetu 🏡`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
        <div style="background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);">
          <div style="text-align: center; margin-bottom: 25px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 26px; font-weight: 800;">UrbanSetu Weekly 📊</h1>
            <p style="color: #6b7280; margin: 8px 0 0 0; font-size: 16px;">Hello, ${username}! Here's your personalized market update.</p>
          </div>
          
          ${newPropsHtml ? `
            <div style="margin-bottom: 30px;">
              <div style="display: flex; align-items: center; margin-bottom: 15px; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px;">
                <span style="font-size: 20px; margin-right: 8px;">🆕</span>
                <h2 style="color: #1f2937; margin: 0; font-size: 20px;">Fresh on the Market</h2>
              </div>
              <div style="text-align: center; font-size: 0;">${newPropsHtml}</div>
            </div>
          ` : ''}

          ${trendingPropsHtml ? `
            <div style="margin-bottom: 30px;">
              <div style="display: flex; align-items: center; margin-bottom: 15px; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px;">
                <span style="font-size: 20px; margin-right: 8px;">🔥</span>
                <h2 style="color: #1f2937; margin: 0; font-size: 20px;">Trending This Week</h2>
              </div>
              <div style="text-align: center; font-size: 0;">${trendingPropsHtml}</div>
            </div>
          ` : ''}

          <div style="margin-top: 30px; border-top: 2px solid #f3f4f6; padding-top: 25px; margin-bottom: 10px;">
              <h3 style="color: #1f2937; text-align: center; margin: 0 0 20px 0; font-size: 18px;">✨ Explore More on UrbanSetu</h3>
              <div style="text-align: center; font-size: 0;">
                  <a href="${clientBaseUrl}/user/ai" style="display: inline-block; width: 80px; margin: 0 10px 20px; text-decoration: none; color: #4b5563; vertical-align: top;">
                      <div style="background-color: #eff6ff; border-radius: 16px; width: 56px; height: 56px; line-height: 56px; margin: 0 auto 8px; font-size: 24px;">🤖</div>
                      <div style="font-size: 13px; font-weight: 600;">AI Guide</div>
                  </a>
                  <a href="${clientBaseUrl}/user/community" style="display: inline-block; width: 80px; margin: 0 10px 20px; text-decoration: none; color: #4b5563; vertical-align: top;">
                      <div style="background-color: #f0fdf4; border-radius: 16px; width: 56px; height: 56px; line-height: 56px; margin: 0 auto 8px; font-size: 24px;">💬</div>
                      <div style="font-size: 13px; font-weight: 600;">Groups</div>
                  </a>
                  <a href="${clientBaseUrl}/user/search" style="display: inline-block; width: 80px; margin: 0 10px 20px; text-decoration: none; color: #4b5563; vertical-align: top;">
                      <div style="background-color: #fff7ed; border-radius: 16px; width: 56px; height: 56px; line-height: 56px; margin: 0 auto 8px; font-size: 24px;">🔍</div>
                      <div style="font-size: 13px; font-weight: 600;">Search</div>
                  </a>
                  <a href="${clientBaseUrl}/user/services" style="display: inline-block; width: 80px; margin: 0 10px 20px; text-decoration: none; color: #4b5563; vertical-align: top;">
                      <div style="background-color: #f5f3ff; border-radius: 16px; width: 56px; height: 56px; line-height: 56px; margin: 0 auto 8px; font-size: 24px;">🛠️</div>
                      <div style="font-size: 13px; font-weight: 600;">Services</div>
                  </a>
                  <a href="${clientBaseUrl}/updates" style="display: inline-block; width: 80px; margin: 0 10px 20px; text-decoration: none; color: #4b5563; vertical-align: top;">
                      <div style="background-color: #e0f2fe; border-radius: 16px; width: 56px; height: 56px; line-height: 56px; margin: 0 auto 8px; font-size: 24px;">🚀</div>
                      <div style="font-size: 13px; font-weight: 600;">Updates</div>
                  </a>
              </div>
          </div>

          <div style="text-align: center; margin-top: 15px; padding-top: 25px; border-top: 1px solid #e5e7eb; background-color: #f9fafb; border-radius: 8px; padding: 20px;">
            <p style="color: #4b5563; margin: 0 0 15px 0;">Don't see what you're looking for?</p>
            <a href="${clientBaseUrl}/search" style="display:inline-block; background-color:#2563eb; color:#ffffff; text-decoration:none; padding:12px 30px; border-radius:6px; font-weight:bold; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);">Browse All Listings</a>
            
            <div style="margin-top: 20px; font-size: 12px; color: #9ca3af;">
              <p style="margin: 5px 0;">This email was sent to ${email} as part of your UrbanSetu subscription.</p>
              <p style="margin: 5px 0;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
              <p style="margin: 10px 0 0 0;">
                <a href="${unsubscribeUrl}" style="color: #2563eb; text-decoration: underline;">Unsubscribe</a> from these updates.
              </p>
            </div>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions, 3, 1000, 'promotional');
    return result.success ?
      createSuccessResponse(result.messageId, 'trending_update_email') :
      createErrorResponse(new Error(result.error), 'trending_update_email');
  } catch (error) {
    return createErrorResponse(error, 'trending_update_email');
  }
};

// Send acknowledgement for property report
export const sendPropertyReportAcknowledgement = async (email, username, listingName, listingId, category, details) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Report Received: We are reviewing your request 🛡️',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-bottom: 2px solid #e2e8f0;">
          <h2 style="color: #2563eb; margin: 0; font-size: 24px;">UrbanSetu Trust & Safety</h2>
        </div>
        <div style="padding: 30px; border: 1px solid #e2e8f0; border-top: none; background-color: white; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
          <p style="font-size: 16px;">Hello <strong>${username}</strong>,</p>
          <p style="color: #4b5563;">Thank you for helping keep UrbanSetu safe. We have received your report regarding the property:</p>
          
          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2563eb;">
            <p style="margin: 0 0 10px 0; font-size: 16px; color: #1e40af;"><strong>Property:</strong> <a href="${clientBaseUrl}/user/listing/${listingId}" style="color: #1e40af; text-decoration: underline;">${listingName}</a></p>
            <p style="margin: 0 0 8px 0; color: #374151;"><strong>Category:</strong> <span style="background-color: white; padding: 2px 8px; border-radius: 4px; border: 1px solid #bfdbfe; font-size: 14px;">${category}</span></p>
            ${details ? `<p style="margin: 0; color: #374151;"><strong>Details:</strong> ${details}</p>` : ''}
          </div>

          <p style="color: #4b5563;">Our team will investigate this issue thoroughly against our community guidelines. No further action is required from you at this time.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center;">
            <p>Reference ID: #${new Date().getTime().toString(36).toUpperCase()}</p>
            <p>© ${new Date().getFullYear()} UrbanSetu Support Team</p>
          </div>
        </div>
      </div>
    `
  };
  return sendEmailWithRetry(mailOptions);
};

// Send acknowledgement for review/issue report
export const sendIssueReportAcknowledgement = async (email, username, listingName, listingId, category, reason) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Issue Received: We are looking into it 🛡️',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-bottom: 2px solid #e2e8f0;">
          <h2 style="color: #2563eb; margin: 0; font-size: 24px;">UrbanSetu Trust & Safety</h2>
        </div>
        <div style="padding: 30px; border: 1px solid #e2e8f0; border-top: none; background-color: white; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
          <p style="font-size: 16px;">Hello <strong>${username}</strong>,</p>
          <p style="color: #4b5563;">We received your report regarding an issue/review on the property <strong>${listingName}</strong>.</p>
          
          <div style="background-color: #fff1f2; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #e11d48;">
             <p style="margin: 0 0 10px 0; color: #9f1239;"><strong>Report Category:</strong> ${category}</p>
             <p style="margin: 0; color: #374151;"><strong>Reason:</strong> ${reason}</p>
          </div>

          <p style="color: #4b5563;">We take such reports seriously. We will review the content and take appropriate action if it violates our policies.</p>
          
          <div style="margin-top: 25px; text-align: center;">
            <a href="${clientBaseUrl}/user/listing/${listingId}" style="display: inline-block; padding: 12px 25px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Return to Property</a>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center;">
            <p>Reference ID: #${new Date().getTime().toString(36).toUpperCase()}</p>
            <p>© ${new Date().getFullYear()} UrbanSetu Support Team</p>
          </div>
        </div>
      </div>
    `
  };
  return sendEmailWithRetry(mailOptions);
};

// Send Account Lockout Email (Intelligence System)
export const sendAccountLockoutEmail = async (email, details) => {
  try {
    const { username, attempts, lockoutDuration, ipAddress, device, location } = details;
    const subject = 'Security Alert: Your UrbanSetu Account has been Temporarily Locked';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Locked</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
           <!-- Header Red for Alert -->
           <div style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Security Alert</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Suspicious Activity Detected</p>
           </div>
           
           <div style="padding: 40px 30px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
                Hello <strong>${username}</strong>,
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                Our intelligence system detected suspicious login activity on your account. For your security, your account has been <strong>temporarily locked</strong> for <strong>${lockoutDuration}</strong>.
              </p>
              
              <div style="background-color: #fef2f2; padding: 25px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 25px 0;">
                <h3 style="color: #b91c1c; margin: 0 0 15px; font-size: 16px; display: flex; align-items: center;">
                   Activity Details
                </h3>
                <div style="display: grid; gap: 10px;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #fee2e2; padding-bottom: 8px;">
                        <span style="color: #7f1d1d; font-weight: 500;">Reason</span>
                        <span style="color: #450a0a; font-weight: 600;">${attempts} failed attempts (${details.reason || 'Suspicious Activity'})</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #fee2e2; padding-bottom: 8px;">
                        <span style="color: #7f1d1d; font-weight: 500;">IP Address</span>
                        <span style="color: #450a0a; font-weight: 600;">${ipAddress || 'Unknown'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #fee2e2; padding-bottom: 8px;">
                        <span style="color: #7f1d1d; font-weight: 500;">Location</span>
                        <span style="color: #450a0a; font-weight: 600;">${location || 'Unknown'}</span>
                    </div>
                     <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #fee2e2; padding-bottom: 8px;">
                        <span style="color: #7f1d1d; font-weight: 500;">Device</span>
                        <span style="color: #450a0a; font-weight: 600;">${device || 'Unknown'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding-bottom: 0;">
                        <span style="color: #7f1d1d; font-weight: 500;">Time</span>
                        <span style="color: #450a0a; font-weight: 600;">${formatLocalizedTime(new Date(), ipAddress)}</span>
                    </div>
                </div>
              </div>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                <strong>Was this you?</strong><br>
                Please wait for the lockout to expire. Once the lockout period ends, you can try logging in again or reset your password.
              </p>

               <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                <strong>Wasn't you?</strong><br>
                Please contact our support team immediately to secure your account.
              </p>
              
              <div style="text-align: center; margin: 35px 0 10px;">
                 <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/contact" style="background-color: #ef4444; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 10px 5px; display: inline-block;">
                    Contact Support
                 </a>
                  <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/forgot-password" style="background-color: #ffffff; color: #ef4444; border: 2px solid #ef4444; padding: 12px 26px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 10px 5px; display: inline-block;">
                    Reset Password
                 </a>
              </div>
           </div>
           
           <!-- Footer -->
           <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                This is an automated security alert from UrbanSetu Intelligence System.
              </p>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 12px;">
                © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
              </p>
           </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending lockout email:', error);
    return createErrorResponse(error, 'lockout_email');
  }
};

// Send Root Admin Attack Email (Lock Link Only)
export const sendRootAdminAttackEmail = async (email, details) => {
  try {
    const { username, attempts, ipAddress, location, lockLink } = details;
    const subject = '🚨 CRITICAL: Attack Attempt on Root Admin Account';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Root Admin Attack Detected</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; color: #1f2937;">
        <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Critical Security Alert</h1>
            <p style="color: #fecaca; margin: 10px 0 0; font-size: 16px;">Attack Target: Root Admin</p>
          </div>
          
          <div style="padding: 40px 30px;">
            <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6;">
              Hello <strong>${username}</strong>,
            </p>
            <p style="margin: 0 0 25px; font-size: 16px; line-height: 1.6;">
              Our intelligence system detected a <strong>High-Volume Brute Force Attack</strong> targeting your Root Admin account.
            </p>

            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin-bottom: 25px; border-radius: 4px;">
              <p style="margin: 0 0 10px; font-weight: 700; color: #991b1b; font-size: 14px; text-transform: uppercase;">Attack Details</p>
              <div style="font-family: monospace; color: #7f1d1d; font-size: 13px;">
                <div style="margin-bottom: 5px;"><strong>Attempts:</strong> ${attempts} failed logins</div>
                <div style="margin-bottom: 5px;"><strong>IP Address:</strong> ${ipAddress}</div>
                <div style="margin-bottom: 5px;"><strong>Location:</strong> ${location || 'Unknown'}</div>
                <div><strong>Time:</strong> ${formatLocalizedTime(new Date(), ipAddress)}</div>
              </div>
            </div>

            <p style="margin: 0 0 25px; font-size: 16px; line-height: 1.6; font-weight: 600;">
              Action Taken: <span style="color: #047857;">Account NOT Locked (DoS Protection Active)</span>
            </p>
            
            <p style="margin: 0 0 25px; font-size: 16px; line-height: 1.6;">
              We have explicitly prevented the system from locking your account to ensure you maintain control. However, we strongly recommend you:
            </p>

            <ul style="margin: 0 0 30px; padding-left: 20px; color: #4b5563;">
              <li style="margin-bottom: 10px;">Review your audit logs immediately.</li>
              <li style="margin-bottom: 10px;">Change your password if you suspect compromise.</li>
            </ul>

            <div style="margin-top: 30px; margin-bottom: 30px; padding: 20px; background-color: #fff1f2; border: 1px dashed #e11d48; border-radius: 8px;">
               <h3 style="color: #9f1239; margin-top: 0;">Emergency Controls</h3>
               <p style="margin-bottom: 15px; font-size: 14px;">If you believe your account is compromised, you can manually lock it immediately using the link below.</p>
               
               <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-bottom: 20px;">
                  <a href="${lockLink}" style="background-color: #dc2626; color: white; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
                     🔒 Lock Account Now
                  </a>
               </div>

               <p style="font-size: 12px; color: #881337; font-weight: bold; text-align: center;">
                 ⚠️ NOTE: If you lock your account, we will immediately send you a separate email with a secure link to unlock it.
               </p>
               <p style="font-size: 12px; color: #64748b; text-align: center; margin-bottom: 0;">
                 This secure lock link will expire in 1 hour.
               </p>
            </div>
            
            <div style="text-align: center;">
               <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/admin/security-moderation" style="color: #4b5563; text-decoration: underline; font-weight: 600; font-size: 14px;">
                  Go to Security Dashboard
               </a>
            </div>
          </div>  
          
          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu Security Intelligence</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending root admin attack email:', error);
  }
};

// Send Account Locked Confirmation Email with Unlock Link
export const sendAccountLockedEmail = async (email, username, unlockLink) => {
  try {
    const subject = '🚨 Account Locked - Emergency Unlock Link';

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Locked</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; color: #1f2937;">
          <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #1f2937 0%, #111827 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Account Locking Confirmed</h1>
              <p style="color: #9ca3af; margin: 10px 0 0; font-size: 16px;">Action Successful</p>
            </div>
            
            <div style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6;">
                Hello <strong>${username}</strong>,
              </p>
              <p style="margin: 0 0 25px; font-size: 16px; line-height: 1.6;">
                As requested, your account has been <strong>successfully locked</strong>. All active sessions have been terminated.
              </p>
  
              <div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 20px; margin-bottom: 25px; border-radius: 4px;">
                 <h3 style="color: #854d0e; margin-top: 0;">Restoring Access</h3>
                 <p style="margin-bottom: 15px; font-size: 14px; color: #713f12;">
                    To regain access to your account, you must use the secure link below. This is the <strong>ONLY</strong> way to unlock your account via email.
                 </p>
                 
                 <div style="display: flex; justify-content: center; margin: 20px 0;">
                    <a href="${unlockLink}" style="background-color: #16a34a; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block;">
                       🔓 Unlock My Account
                    </a>
                 </div>
  
                 <p style="font-size: 12px; color: #854d0e; font-weight: bold; text-align: center; margin-bottom: 0;">
                   ⚠️ PLEASE PRESERVE THIS EMAIL.
                 </p>

              </div>
            </div>
            
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu Security</p>
            </div>
          </div>
        </body>
        </html>
      `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending account locked email:', error);
  }
};

// Send Account Unlocked Confirmation Email
export const sendAccountUnlockedEmail = async (email, username) => {
  try {
    const subject = '✅ Account Unlocked - Access Restored';

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Unlocked</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; color: #1f2937;">
          <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Account Unlocked</h1>
              <p style="color: #d1fae5; margin: 10px 0 0; font-size: 16px;">Access Restored Successfully</p>
            </div>
            
            <div style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6;">
                Hello <strong>${username}</strong>,
              </p>
              <p style="margin: 0 0 25px; font-size: 16px; line-height: 1.6;">
                Your account has been successfully unlocked. You can now sign in normally.
              </p>
  
              <div style="text-align: center; margin-top: 30px;">
                 <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/sign-in" style="background-color: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block;">
                    Sign In to UrbanSetu
                 </a>
              </div>
            </div>
            
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu Security</p>
            </div>
          </div>
        </body>
        </html>
      `;

    return await sendEmailWithRetry({
      to: email,
      subject: subject,
      html: html
    });
  } catch (error) {
    console.error('Error sending account unlocked email:', error);
  }
};


// Send Community Post Confirmation Email
export const sendCommunityPostConfirmationEmail = async (email, username, postTitle, postId) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your Discussion is Live! 💬 - UrbanSetu Community',
    html: `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-bottom: 2px solid #e2e8f0;">
          <h2 style="color: #0f766e; margin: 0; font-size: 24px;">UrbanSetu Community</h2>
        </div>
        <div style="padding: 30px; border: 1px solid #e2e8f0; border-top: none; background-color: white; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
          <p style="font-size: 16px;">Hello <strong>${username}</strong>,</p>
          <p style="color: #4b5563;">Great news! Your discussion has been successfully posted to the UrbanSetu Community.</p>
          
          <div style="background-color: #f0fdfa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #0d9488;">
            <p style="margin: 0 0 10px 0; font-size: 18px; font-weight: 600; color: #115e59;">${postTitle}</p>
            <p style="margin: 0; color: #64748b; font-size: 14px;">Posted just now</p>
          </div>

          <p style="color: #4b5563;">You can view your post, reply to comments, and see how the community reacts by clicking below:</p>
          
          <div style="margin-top: 25px; text-align: center;">
            <a href="${clientBaseUrl}/community/post/${postId}" style="display: inline-block; padding: 12px 25px; background-color: #0d9488; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">View Discussion</a>
          </div>

          <p style="margin-top: 25px; color: #64748b; font-size: 14px;">Thank you for contributing to our community!</p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center;">
            <p>© ${new Date().getFullYear()} UrbanSetu Community Team</p>
          </div>
        </div>
      </div>
  `
  };
  return sendEmailWithRetry(mailOptions);
};

// Send Community Report Acknowledgement Email
export const sendCommunityReportAcknowledgementEmail = async (email, username, itemType, itemTitle, reason, postId) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Report Received - UrbanSetu Community Safety 🛡️',
    html: `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
         <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-bottom: 2px solid #e2e8f0;">
          <h2 style="color: #2563eb; margin: 0; font-size: 24px;">Community Safety</h2>
        </div>
        <div style="padding: 30px; border: 1px solid #e2e8f0; border-top: none; background-color: white; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
          <p style="font-size: 16px;">Hello <strong>${username}</strong>,</p>
          <p style="color: #4b5563;">Thank you for helping keep our community safe. We have received your report regarding a <strong>${itemType}</strong>.</p>
          
          <div style="background-color: #fff1f2; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #e11d48;">
             <p style="margin: 0 0 10px 0; color: #881337;"><strong>Reason:</strong> ${reason}</p>
             <p style="margin: 0; color: #4b5563;"><strong>Related Discussion:</strong> <a href="${clientBaseUrl}/community/post/${postId}" style="color: #0369a1; text-decoration: underline;">${itemTitle}</a></p>
          </div>

          <p style="color: #4b5563;">We review all reports carefully against our Community Guidelines. If a violation is found, we will take appropriate action.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center;">
            <p>Reference ID: #${new Date().getTime().toString(36).toUpperCase()}</p>
            <p>© ${new Date().getFullYear()} UrbanSetu Trust & Safety</p>
          </div>
        </div>
      </div>
  `
  };
  return sendEmailWithRetry(mailOptions);
};

// Send Search Alert Email (New Property Matches)
export const sendSearchAlertEmail = async (email, username, searchCriteria, newProperties) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';

  // Generate preview cards for up to 3 properties
  const propertyCards = newProperties.slice(0, 3).map(prop => `
  <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 15px; overflow: hidden; display: flex;">
      <div style="width: 120px; height: 100px; background-color: #f3f4f6; flex-shrink: 0;">
        <img src="${prop.image || 'https://via.placeholder.com/120x100?text=Property'}" alt="${prop.title}" style="width: 100%; height: 100%; object-fit: cover;">
      </div>
      <div style="padding: 12px; flex: 1;">
        <h4 style="margin: 0 0 5px; font-size: 16px; color: #1f2937;">${prop.title}</h4>
        <p style="margin: 0 0 5px; color: #4b5563; font-size: 14px;">${prop.location}</p>
        <p style="margin: 0; color: #059669; font-weight: 600;">₹${prop.price.toLocaleString('en-IN')}/mo</p>
      </div>
    </div>
  `).join('');

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `New Homes in ${searchCriteria.location} match your search! 🏠`,
    html: `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-bottom: 2px solid #e2e8f0;">
          <h2 style="color: #2563eb; margin: 0; font-size: 24px;">UrbanSetu Alerts</h2>
        </div>
        <div style="padding: 30px; border: 1px solid #e2e8f0; border-top: none; background-color: white; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
          <p style="font-size: 16px;">Hello <strong>${username}</strong>,</p>
          <p style="color: #4b5563;">Good news! We found new properties that match your search for <strong>${searchCriteria.type}</strong> in <strong>${searchCriteria.location}</strong>.</p>
          
          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #bfdbfe;">
            ${propertyCards}
            <div style="text-align: center; margin-top: 15px;">
              <a href="${clientBaseUrl}/search?q=${encodeURIComponent(searchCriteria.location)}" style="color: #2563eb; font-weight: 600; text-decoration: none;">View All Matches &rarr;</a>
            </div>
          </div>

          <div style="margin-top: 25px; text-align: center;">
            <a href="${clientBaseUrl}/search" style="display: inline-block; padding: 12px 30px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Browse Properties</a>
          </div>

          <p style="margin-top: 20px; font-size: 13px; color: #6b7280; text-align: center;">
            You can adjust your alert preferences in your <a href="${clientBaseUrl}/user/settings" style="color: #6b7280; text-decoration: underline;">account settings</a>.
          </p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center;">
            <p>© ${new Date().getFullYear()} UrbanSetu Real Estate</p>
          </div>
        </div>
      </div>
  `
  };
  return sendEmailWithRetry(mailOptions);
};

// Send Lease Renewal Reminder (60/30 Days Notice)
export const sendLeaseRenewalReminderEmail = async (email, username, contractDetails, daysRemaining) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const isUrgent = daysRemaining <= 30;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `${isUrgent ? '📅 Action Required:' : '🔔 Reminder:'} Lease Expiring in ${daysRemaining} Days`,
    html: `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
        <div style="background-color: ${isUrgent ? '#fef2f2' : '#f0f9ff'}; padding: 20px; text-align: center; border-bottom: 2px solid ${isUrgent ? '#fee2e2' : '#e0f2fe'};">
          <h2 style="color: ${isUrgent ? '#dc2626' : '#0284c7'}; margin: 0; font-size: 24px;">Lease Renewal</h2>
        </div>
        <div style="padding: 30px; border: 1px solid #e2e8f0; border-top: none; background-color: white; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
          <p style="font-size: 16px;">Hello <strong>${username}</strong>,</p>
          <p style="color: #4b5563;">This is a reminder that the lease agreement for <strong>${contractDetails.propertyName}</strong> is set to expire soon.</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid ${isUrgent ? '#ef4444' : '#3b82f6'};">
             <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span style="color: #64748b;">Property:</span>
                <span style="font-weight: 600; color: #334155;">${contractDetails.propertyName}</span>
             </div>
             <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span style="color: #64748b;">Tenant:</span>
                <span style="font-weight: 600; color: #334155;">${contractDetails.tenantName}</span>
             </div>
             <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Expiry Date:</span>
                <span style="font-weight: 600; color: ${isUrgent ? '#dc2626' : '#334155'};">${formatLocalizedTime(contractDetails.expiryDate)}</span>
             </div>
          </div>

          <p style="color: #4b5563;">You have ${daysRemaining} days to decide on the next steps. We recommend initiating a conversation about renewal or move-out procedures soon.</p>
          
          <div style="margin-top: 25px; text-align: center; display: flex; gap: 10px; justify-content: center;">
            <a href="${clientBaseUrl}/user/contracts/${contractDetails.id}/renew" style="display: inline-block; padding: 12px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Renew Lease</a>
            <a href="${clientBaseUrl}/user/contracts/${contractDetails.id}" style="display: inline-block; padding: 12px 20px; background-color: white; color: #4b5563; border: 1px solid #d1d5db; text-decoration: none; border-radius: 6px; font-weight: 600;">View Contract</a>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center;">
            <p>Contract ID: #${contractDetails.id}</p>
            <p>© ${new Date().getFullYear()} UrbanSetu Legal Team</p>
          </div>
        </div>
      </div>
  `
  };
  return sendEmailWithRetry(mailOptions);
};

// Send Incomplete Listing Onboarding Email (Draft Nudge)
export const sendIncompleteListingOnboardingEmail = async (email, username, listingDraft) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Almost there! Finish listing your property 🏡',
    html: `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-bottom: 2px solid #e2e8f0;">
          <h2 style="color: #059669; margin: 0; font-size: 24px;">Finish Your Listing</h2>
        </div>
        <div style="padding: 30px; border: 1px solid #e2e8f0; border-top: none; background-color: white; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
          <p style="font-size: 16px;">Hello <strong>${username}</strong>,</p>
          <p style="color: #4b5563;">We noticed you started listing a property but didn't publish it yet. You're just a few steps away from finding the perfect tenant!</p>
          
          <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #a7f3d0; display: flex; align-items: center;">
             <div style="width: 80px; height: 80px; background-color: #d1fae5; border-radius: 8px; margin-right: 15px; display: flex; align-items: center; justify-content: center; font-size: 30px;">🏠</div>
             <div>
                <h3 style="margin: 0 0 5px; color: #064e3b; font-size: 18px;">${listingDraft.title || 'Untitled Property'}</h3>
                <p style="margin: 0; color: #047857; font-size: 14px;">${listingDraft.completionPercentage || '80'}% Completed</p>
             </div>
          </div>

          <p style="color: #4b5563;">Complete your listing now to get maximum visibility and connect with verified renters.</p>
          
          <div style="margin-top: 25px; text-align: center;">
            <a href="${clientBaseUrl}/user/listings/edit/${listingDraft.id}" style="display: inline-block; padding: 12px 30px; background-color: #059669; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.2);">Continue Listing</a>
          </div>

          <p style="margin-top: 20px; font-size: 14px; text-align: center; color: #6b7280;">
             Need help? <a href="${clientBaseUrl}/contact" style="color: #059669;">Contact our support</a> for assistance.
          </p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center;">
            <p>© ${new Date().getFullYear()} UrbanSetu Team</p>
          </div>
        </div>
      </div>
  `
  };
  return sendEmailWithRetry(mailOptions);
};
// Send referral bonus notification
export const sendReferralBonusEmail = async (email, username, friendName, amount) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: `${process.env.EMAIL_FROM_NAME || 'UrbanSetu'} <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Congratulations! You earned a Referral Bonus 💎 - UrbanSetu',
    html: `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Referral Bonus Earned</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

            <!-- Header -->
            <div style="background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Referral Bonus Unlocked! 🚀</h1>
              <p style="color: #e0e7ff; margin: 10px 0 0; font-size: 16px;">Thanks for growing our community</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">Fantastic News, ${username}!</h2>
                <p style="color: #4b5563; margin: 0; font-size: 16px; line-height: 1.6;">
                  Your friend <strong>${friendName}</strong> just joined UrbanSetu using your personal referral link.
                </p>
              </div>

              <!-- Bonus Card -->
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%); border: 2px dashed #f59e0b; border-radius: 12px; padding: 30px; margin-bottom: 30px; text-align: center;">
                <span style="display: block; font-size: 14px; color: #b45309; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">You Earned</span>
                <div style="font-size: 42px; font-weight: 800; color: #d97706; margin: 10px 0;">
                  +${amount} <span style="font-size: 32px;">🪙</span>
                </div>
                <p style="color: #92400e; margin: 0; font-weight: 600;">SetuCoins Added to Wallet</p>
              </div>

              <div style="background-color: #f3f4f6; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
                <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 18px; font-weight: 600; text-align: center;">✨ What Can You Do With SetuCoins?</h3>
                <ul style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li><strong>Pay Rent:</strong> Use coins to discount your monthly rent payments.</li>
                  <li><strong>Unlock Features:</strong> Access premium listing analytics.</li>
                  <li><strong>Gift Cards:</strong> Redeem for popular shopping vouchers.</li>
                </ul>
              </div>

              <div style="text-align: center;">
                <a href="${clientBaseUrl}/user/rewards"
                  style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 50px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px rgba(99, 102, 241, 0.25); transition: all 0.3s ease;">
                  🪙 Check My Wallet
                </a>
              </div>

              <p style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px;">
                Keep referring friends! Check your dashboard for your unique referral link.
              </p>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
              </p>
            </div>
          </div>
        </body>
      </html>
      `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'referral_bonus') :
      createErrorResponse(new Error(result.error), 'referral_bonus');
  } catch (error) {
    return createErrorResponse(error, 'referral_bonus');
  }
};

// Specialized Welcome Email for users joined via Referral
export const sendReferredWelcomeEmail = async (email, username, referrerName, amount) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: `${process.env.EMAIL_FROM_NAME || 'UrbanSetu'} <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Welcome to UrbanSetu! You joined via ${referrerName}'s invitation 🎁`,
    html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Welcome Bonus</title>
              </head>
              <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

                  <!-- Header -->
                  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Welcome to the Family! 🏡</h1>
                    <p style="color: #ecfdf5; margin: 10px 0 0; font-size: 16px;">Your journey starts with a reward</p>
                  </div>

                  <!-- Content -->
                  <div style="padding: 40px 30px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 24px; font-weight: 600;">Hello ${username},</h2>
                      <p style="color: #4b5563; margin: 0; font-size: 16px; line-height: 1.6;">
                        We are thrilled to have you join UrbanSetu via <strong>${referrerName}'s</strong> special invitation.
                      </p>
                    </div>

                    <!-- Bonus Card -->
                    <div style="background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%); border: 2px dashed #3b82f6; border-radius: 12px; padding: 30px; margin-bottom: 30px; text-align: center;">
                      <span style="display: block; font-size: 14px; color: #1e40af; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Your Welcome Gift</span>
                      <div style="font-size: 42px; font-weight: 800; color: #2563eb; margin: 10px 0;">
                        +${amount} <span style="font-size: 32px;">🪙</span>
                      </div>
                      <p style="color: #1e3a8a; margin: 0; font-weight: 600;">SetuCoins Credited Instantly</p>
                    </div>

                    <div style="background-color: #f3f4f6; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
                      <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 18px; font-weight: 600; text-align: center;">🚀 Maximizing Your Experience</h3>
                      <ul style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                        <li><strong>Complete Profile:</strong> Earn 20 SetuCoins by finishing your profile setup.</li>
                        <li><strong>Browse Listings:</strong> Find verified properties with zero brokerage options.</li>
                        <li><strong>Refer Friends:</strong> Share your own link to earn even more!</li>
                      </ul>
                    </div>

                    <div style="text-align: center;">
                      <a href="${clientBaseUrl}/user/dashboard"
                        style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 50px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.25); transition: all 0.3s ease;">
                        🎁 Claim My Bonus & Start
                      </a>
                    </div>
                  </div>

                  <!-- Footer -->
                  <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                      © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
                    </p>
                  </div>
                </div>
              </body>
            </html>
            `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'referred_welcome') :
      createErrorResponse(new Error(result.error), 'referred_welcome');
  } catch (error) {
    return createErrorResponse(error, 'referred_welcome');
  }
};

// Send Year in Review notification email
export const sendYearInReviewEmail = async (email, username, year, role = 'user') => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const unsubscribeUrl = getUnsubscribeUrl(email);
  const flashbackUrl = `${clientBaseUrl}/user/year/${year}`;

  const isAdmin = role === 'admin' || role === 'rootadmin';
  const subject = isAdmin
    ? `UrbanSetu ${year} Leadership Recap 🚀`
    : `Your UrbanSetu ${year} Flashback is here! 🎬`;

  const heading = isAdmin
    ? "Platform Leadership Recap"
    : "Your Personalized Recap";

  const subHeading = isAdmin
    ? "Review the ecosystem growth and your management impact."
    : "Discover your property persona and see your activity stats.";

  const messageStr = isAdmin
    ? "Your leadership has been instrumental this year. We've compiled a summary of the platform's milestones and your management impact."
    : "What a journey it's been! From finding hidden gems to building your property wishlist, we've captured your best moments on UrbanSetu this year.";

  const mailOptions = {
    from: `${process.env.EMAIL_FROM_NAME || 'UrbanSetu'} <${process.env.EMAIL_USER}>`,
    to: email,
    subject: subject,
    html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0f172a; color: #ffffff;">
              <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 40px 30px; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); text-align: center; border: 1px solid rgba(255, 255, 255, 0.1);">
                <div style="margin-bottom: 30px;">
                  <h1 style="color: #3b82f6; margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.025em;">UrbanSetu</h1>
                  <div style="height: 4px; width: 40px; background: #3b82f6; margin: 12px auto; border-radius: 2px;"></div>
                </div>

                <h2 style="font-size: 28px; line-height: 1.2; margin-bottom: 20px; font-weight: 700;">Hi ${username}! <br>Ready to relive your ${year}?</h2>

                <p style="color: #94a3b8; font-size: 18px; line-height: 1.6; margin-bottom: 35px;">
                  ${messageStr}
                </p>

                <div style="background: rgba(59, 130, 246, 0.1); padding: 30px; border-radius: 16px; margin-bottom: 35px; border: 1px dashed rgba(59, 130, 246, 0.3);">
                  <p style="margin: 0; font-size: 16px; color: #60a5fa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">${heading}</p>
                  <p style="margin: 10px 0 0 0; font-size: 14px; color: #94a3b8;">${subHeading}</p>
                </div>

                <div style="margin-top: 20px;">
                  <a href="${flashbackUrl}" style="display: inline-block; background: #3b82f6; color: #ffffff; text-decoration: none; padding: 18px 40px; border-radius: 50px; font-weight: 700; font-size: 18px; transition: all 0.3s ease; box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.4);">
                    Watch Your Flashback 🎬
                  </a>
                </div>

                <p style="color: #64748b; margin-top: 40px; font-size: 14px;">
                  Can't click the button? Copy this link: <br>
                    <a href="${flashbackUrl}" style="color: #3b82f6; text-decoration: none;">${flashbackUrl}</a>
                </p>

                <div style="margin-top: 50px; padding-top: 30px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                  <p style="color: #475569; margin: 0 0 20px 0; font-size: 12px; font-weight: 500;">
                    © ${new Date().getFullYear()} UrbanSetu. All rights reserved. <br>
                    Making property journeys simpler and more beautiful.
                  </p>
                  <p style="margin: 0; font-size: 11px; color: #475569;">
                    Too many recaps? <a href="${unsubscribeUrl}" style="color: #3b82f6; text-decoration: underline;">Unsubscribe</a> from promotional emails.
                  </p>
                </div>
              </div>
            </div>
            `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions, 3, 1000, 'promotional');
    return result.success ?
      createSuccessResponse(result.messageId, 'year_in_review') :
      createErrorResponse(new Error(result.error), 'year_in_review');
  } catch (error) {
    return createErrorResponse(error, 'year_in_review');
  }
};

// Send Coin Expiry Warning Email
export const sendCoinExpiryWarningEmail = async (email, username, daysLeft, balance, expiryDate) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: `${process.env.EMAIL_FROM_NAME || 'UrbanSetu'} <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `⏳ Action Required: Your ${balance} SetuCoins expiring in ${daysLeft} days!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SetuCoins Expiry Warning</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fef2f2;">
        <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <div style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Use It or Lose It!</h1>
            <p style="color: #fee2e2; margin: 10px 0 0; font-size: 16px;">SetuCoins Expiry Alert</p>
          </div>

          <div style="padding: 40px 30px;">
            <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #374151;">
              Hello <strong>${username}</strong>,
            </p>
            <p style="margin: 0 0 25px; font-size: 16px; line-height: 1.6; color: #374151;">
              This is a friendly reminder that your SetuCoins balance is approaching its expiration date due to inactivity.
            </p>

            <div style="background-color: #fff1f2; border: 2px dashed #f87171; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 30px;">
              <p style="margin: 0; color: #991b1b; font-size: 14px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Expiring Balance</p>
              <div style="font-size: 36px; font-weight: 800; color: #dc2626; margin: 10px 0;">
                ${balance} <span style="font-size: 24px;">🪙</span>
              </div>
              <p style="margin: 0; color: #7f1d1d; font-size: 14px;">Expires on: <strong>${new Date(expiryDate).toLocaleDateString()}</strong></p>
            </div>

            <p style="text-align: center; color: #4b5563; margin-bottom: 30px;">
              Don't let your rewards go to waste! Redeem them now for rent discounts or other services.
            </p>

            <div style="text-align: center;">
              <a href="${clientBaseUrl}/user/rewards" 
                 style="display: inline-block; background-color: #dc2626; color: white; padding: 14px 30px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px rgba(220, 38, 38, 0.25);">
                 Redeem Now ➔
              </a>
              <div style="margin-top: 20px;">
                 <a href="${clientBaseUrl}/contact" style="color: #9ca3af; text-decoration: none; font-size: 13px;">Contact Support</a>
              </div>
            </div>
          </div>

          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
             <p style="color: #9ca3af; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
  return sendEmailWithRetry(mailOptions);
};

// Send Coins Frozen Email
export const sendCoinsFrozenEmail = async (email, username, frozenAmount, expiryDate) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: `${process.env.EMAIL_FROM_NAME || 'UrbanSetu'} <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `🧊 Notice: Your ${frozenAmount} SetuCoins have expired`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>SetuCoins Expired</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #9ca3af; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Coins Frozen</h1>
          </div>
          <div style="padding: 40px 30px;">
             <p style="color: #374151; font-size: 16px;">Hello <strong>${username}</strong>,</p>
             <p style="color: #4b5563; line-height: 1.6;">
               We regret to inform you that your SetuCoins balance of <strong>${frozenAmount} 🪙</strong> has expired and been frozen due to inactivity over the last 12 months.
             </p>
             <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
               Expiry Date: ${new Date(expiryDate).toLocaleDateString()}
             </p>
             <div style="margin-top: 30px; text-align: center;">
                <a href="${clientBaseUrl}/user/rewards" style="color: #2563eb; text-decoration: none; font-weight: 600;">View Transaction History</a>
                <span style="margin: 0 10px; color: #d1d5db;">|</span>
                <a href="${clientBaseUrl}/contact" style="color: #6b7280; text-decoration: none;">Contact Support</a>
             </div>
          </div>
        </div>
      </body>
      </html>
    `
  };
  return sendEmailWithRetry(mailOptions);
};

// Send Admin Call Termination Email
export const sendAdminCallTerminationEmail = async (email, username, details) => {
  const {
    propertyName,
    reason,
    appointmentDate,
    appointmentTime,
    otherPartyName,
    isForBuyer,
    // NEW: Actual call details
    callType,
    callStartTime,
    callDuration
  } = details;

  // Format call duration
  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return 'Just started';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} second${secs !== 1 ? 's' : ''}`;
    if (secs === 0) return `${mins} minute${mins !== 1 ? 's' : ''}`;
    return `${mins} minute${mins !== 1 ? 's' : ''}, ${secs} second${secs !== 1 ? 's' : ''}`;
  };

  // Format call start time
  const formatCallTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const callTypeDisplay = callType === 'video' ? '📹 Video Call' : '📞 Audio Call';

  const mailOptions = {
    from: `${process.env.EMAIL_FROM_NAME || 'UrbanSetu'} <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '⚠️ Call Terminated by Admin - UrbanSetu',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Call Terminated by Admin</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Call Terminated by Admin</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
              Hello <strong>${username}</strong>,
            </p>
            
            <p style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
              We're writing to inform you that your ${callType === 'video' ? 'video' : 'audio'} call for the property <strong>"${propertyName}"</strong> was terminated by our administrator.
            </p>
            
            <!-- Call Details Box -->
            <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="color: #991b1b; margin: 0 0 15px 0; font-size: 18px;">📞 Call Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Property:</td>
                  <td style="padding: 8px 0; color: #1f2937; font-weight: 600; font-size: 14px;">${propertyName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">${isForBuyer ? 'Seller' : 'Buyer'}:</td>
                  <td style="padding: 8px 0; color: #1f2937; font-weight: 600; font-size: 14px;">${otherPartyName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Call Type:</td>
                  <td style="padding: 8px 0; color: #1f2937; font-weight: 600; font-size: 14px;">${callTypeDisplay}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Call Started:</td>
                  <td style="padding: 8px 0; color: #1f2937; font-weight: 600; font-size: 14px;">${formatCallTime(callStartTime)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Duration Before Termination:</td>
                  <td style="padding: 8px 0; color: #1f2937; font-weight: 600; font-size: 14px;">${formatDuration(callDuration)}</td>
                </tr>
              </table>
            </div>
            
            <!-- Reason Box -->
            ${reason ? `
              <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <h3 style="color: #c2410c; margin: 0 0 10px 0; font-size: 16px;">📋 Termination Reason</h3>
                <p style="color: #78350f; margin: 0; line-height: 1.6; font-size: 14px;">${reason}</p>
              </div>
            ` : ''}
            
            <!-- Important Note -->
            <div style="background-color: #eff6ff; border: 1px solid #3b82f6; padding: 15px; border-radius: 8px; margin: 25px 0;">
              <p style="color: #1e40af; margin: 0; font-size: 14px; line-height: 1.6;">
                <strong style="display: block; margin-bottom: 8px;">ℹ️ What This Means:</strong>
                The call was terminated by our administrative team to ensure compliance with our community guidelines or due to technical/policy issues. Both parties (buyer and seller) have received this notification.
              </p>
            </div>
            
            <p style="color: #4b5563; line-height: 1.6; margin-top: 25px;">
              If you believe this termination was made in error or have questions about this action, please don't hesitate to contact our support team.
            </p>
            
            <!-- Action Buttons -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${clientBaseUrl}/user/my-appointments" 
                 style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; margin: 5px;">
                View My Appointments
              </a>
              <a href="${clientBaseUrl}/contact" 
                 style="display: inline-block; background-color: #ffffff; color: #2563eb; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; border: 2px solid #2563eb; margin: 5px;">
                Contact Support
              </a>
            </div>
            
            <!-- Guidelines Link -->
            <p style="color: #6b7280; font-size: 13px; text-align: center; margin-top: 20px;">
              Please review our <a href="${clientBaseUrl}/community-guidelines" style="color: #2563eb; text-decoration: none;">Community Guidelines</a> to ensure a positive experience for all users.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.<br>
              This is an automated notification. Please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'admin_call_termination') :
      createErrorResponse(new Error(result.error), 'admin_call_termination');
  } catch (error) {
    return createErrorResponse(error, 'admin_call_termination');
  }
};

// Send Festival Greeting Email
// Send Festival Greeting Email (Supports single or multiple concurrent festivals)
export const sendFestivalGreetingEmail = async (email, username, inputTheme) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const unsubscribeUrl = getUnsubscribeUrl(email);

  // Normalize to array
  const themes = Array.isArray(inputTheme) ? inputTheme : [inputTheme];
  const isMultiple = themes.length > 1;

  // Header Data
  // Header Data
  const combinedIcons = themes.map(t => t.icon).join(' ');
  const combinedNames = themes.length > 2
    ? `${themes.slice(0, -1).map(t => t.name).join(', ')} & ${themes[themes.length - 1].name}`
    : themes.map(t => t.name).join(' & ');

  const combinedSubject = isMultiple
    ? `${combinedIcons} Special Festival Greetings: ${combinedNames} - UrbanSetu`
    : `${themes[0].icon} ${themes[0].greeting} - UrbanSetu`;

  const headerGreeting = isMultiple
    ? `Happy ${combinedNames}!`
    : themes[0].greeting;

  const mailOptions = {
    from: `${process.env.EMAIL_FROM_NAME || 'UrbanSetu'} <${process.env.EMAIL_USER}>`,
    to: email,
    subject: combinedSubject,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 0; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); overflow: hidden;">
          
          <!-- Decorative Header -->
          <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); padding: 40px 20px; text-align: center; position: relative;">
            <div style="font-size: 64px; margin-bottom: 15px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2));">
              ${combinedIcons}
            </div>
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800; text-shadow: 0 2px 4px rgba(0,0,0,0.2); line-height: 1.2;">
              ${headerGreeting}
            </h1>
          </div>
          
          <div style="padding: 30px;">
            <p style="color: #4b5563; font-size: 18px; line-height: 1.6; margin-bottom: 20px;">
              Dear <strong>${username}</strong>,
            </p>
            
            ${themes.map((theme, index) => `
              <div style="background-color: ${index % 2 === 0 ? '#f3f4f6' : '#eff6ff'}; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 5px solid ${index % 2 === 0 ? '#7c3aed' : '#2563eb'};">
                ${isMultiple ? `<h3 style="margin: 0 0 10px 0; color: #1f2937; font-size: 18px;">${theme.icon} ${theme.name}</h3>` : ''}
                <p style="color: #4b5563; margin: 0; font-size: 16px; line-height: 1.6; font-style: italic;">
                  "${theme.description}"
                </p>
              </div>
            `).join('')}
            
            <p style="color: #4b5563; margin: 25px 0 20px 0; line-height: 1.6; font-size: 16px;">
              On this ${themes.length > 2 ? 'wonderful day of multiple celebrations' : (isMultiple ? 'wonderful day of double celebration' : 'auspicious occasion')} of <strong>${combinedNames}</strong>, everyone at UrbanSetu wishes you happiness, prosperity, and the warmth of home.
            </p>

            <p style="color: #4b5563; margin: 0 0 30px 0; line-height: 1.6; font-size: 16px;">
              May your home be filled with joy and laughter today and always!
            </p>
            
            <div style="text-align: center; margin-bottom: 20px;">
              <a href="${clientBaseUrl}" style="display: inline-block; background: linear-gradient(90deg, #2563eb, #7c3aed); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3); transition: transform 0.2s;">
                Visit UrbanSetu
              </a>
            </div>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0 0 10px 0; font-size: 14px;">
              Celebrating with you,
            </p>
            <p style="color: #6b7280; margin: 0; font-weight: bold; font-size: 16px;">
              The UrbanSetu Team
            </p>
            <p style="color: #9ca3af; margin: 20px 0 0 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.<br>
              You received this email because you are a valued member of our community.
            </p>
            <p style="margin: 15px 0 0 0; font-size: 11px; color: #9ca3af;">
              Don't want these greetings? <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a> from these greetings.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions, 3, 1000, 'promotional');
    return result.success ?
      createSuccessResponse(result.messageId, 'festival_greeting') :
      createErrorResponse(new Error(result.error), 'festival_greeting');
  } catch (error) {
    return createErrorResponse(error, 'festival_greeting');
  }
};

// Send Review Submitted Email
export const sendReviewReceivedEmail = async (email, username, propertyName, reviewLink) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Review Received - Pending Approval - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Review Submission Confirmation</p>
          </div>
          
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">We Received Your Review</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Hello <strong>${username}</strong>,<br/>
              Thank you for sharing your experience! We have received your review for <strong>"${propertyName}"</strong>.
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Your review is currently pending approval to ensure it meets our community guidelines. You will be notified once it has been processed.
            </p>
            
            <div style="text-align: center; margin: 20px 0;">
              <a href="${reviewLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Your Reviews</a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ? createSuccessResponse(result.messageId, 'review_received') : createErrorResponse(new Error(result.error), 'review_received');
  } catch (error) {
    return createErrorResponse(error, 'review_received');
  }
};

// Send Review Status Update Email (Approved/Rejected)
export const sendReviewStatusUpdateEmail = async (email, username, propertyName, status, reason, reviewLink) => {
  const isApproved = status === 'approved';
  // Determine color: Green for approved, Red for rejected
  const color = isApproved ? '#10b981' : '#ef4444';
  const title = isApproved ? 'Review Published!' : 'Review Rejected';

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `${title} - UrbanSetu`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: ${color}; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Review Status Update</p>
          </div>
          
          <div style="background-color: ${isApproved ? '#f0fdf4' : '#fef2f2'}; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid ${color};">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">${title}</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Hello <strong>${username}</strong>,<br/>
              Your review for <strong>"${propertyName}"</strong> has been <strong>${status}</strong>.
            </p>
            
            ${!isApproved && reason ? `
            <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #fee2e2;">
              <strong style="color: #ef4444;">Reason for Rejection:</strong><br/>
              <p style="margin: 5px 0 0 0; color: #4b5563;">${reason}</p>
            </div>
            ` : ''}

            ${isApproved ? `
            <p style="color: #4b5563; margin: 0 0 15px 0;">
              Your review is now live and helping other users make informed decisions!
            </p>
            ` : `
            <p style="color: #4b5563; margin: 0 0 15px 0;">
              Please review our community guidelines and consider submitting a modified review.
            </p>
            `}
            
            <div style="text-align: center; margin: 20px 0;">
              <a href="${reviewLink}" style="display: inline-block; background-color: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                ${isApproved ? 'View Review on Property' : 'Check My Reviews'}
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} UrbanSetu. All rights reserved.</p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ? createSuccessResponse(result.messageId, 'review_status_update') : createErrorResponse(new Error(result.error), 'review_status_update');
  } catch (error) {
    return createErrorResponse(error, 'review_status_update');
  }
};

// Send Property Restored Email
export const sendPropertyRestoredEmail = async (email, { propertyName, propertyId, restoredBy, propertyAddress, propertyPrice, propertyImage }) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';

  // Format price if available
  const formattedPrice = propertyPrice ? new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(propertyPrice) : null;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Property Restored: ${propertyName} - UrbanSetu`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 0; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          
          ${propertyImage ? `
            <div style="height: 200px; width: 100%; overflow: hidden;">
              <img src="${propertyImage}" alt="${propertyName}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
          ` : ''}

          <div style="padding: 30px;">
            <div style="text-align: center; margin-bottom: 25px;">
              <h1 style="color: #2563eb; margin: 0; font-size: 26px;">UrbanSetu</h1>
              <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Restoration Notice</p>
            </div>

            <div style="background-color: #ecfdf5; padding: 25px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #10b981;">
              <h2 style="color: #064e3b; margin: 0 0 15px 0; font-size: 18px;">Property Restored Successfully</h2>
              <p style="color: #374151; margin: 0 0 15px 0; line-height: 1.6;">
                Good news! Your listing <strong>"${propertyName}"</strong> has been successfully restored by the ${restoredBy || 'Admin Team'}.
              </p>
              
              <div style="background-color: rgba(255,255,255,0.6); padding: 15px; border-radius: 6px; margin-top: 15px;">
                ${propertyAddress ? `<p style="margin: 0 0 5px 0; color: #4b5563; font-size: 14px;">📍 ${propertyAddress}</p>` : ''}
                ${formattedPrice ? `<p style="margin: 0; color: #10b981; font-weight: bold; font-size: 16px;">${formattedPrice}</p>` : ''}
              </div>

              <p style="color: #374151; margin: 15px 0 0 0; line-height: 1.6;">
                It is now active and visible on the platform again. Potential buyers/renters can view it immediately.
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${clientBaseUrl}/listing/${propertyId}" style="display: inline-block; background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);">
                View Active Listing
              </a>
            </div>

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                © ${new Date().getFullYear()} UrbanSetu. All rights reserved.<br>
              </p>
            </div>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'property_restored') :
      createErrorResponse(new Error(result.error), 'property_restored');
  } catch (error) {
    return createErrorResponse(error, 'property_restored');
  }
};

// Send Post Locked Email
export const sendPostLockedEmail = async (email, username, postTitle, postId) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Discussion Locked - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Community Moderation Alert</p>
          </div>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Your Discussion Has Been Locked</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Hello ${username},
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              This is to inform you that your discussion thread <strong>"${postTitle}"</strong> has been locked by a community moderator. 
              This usually happens when a thread involves heated debates, repetitive content, or requires a cooling-off period.
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              While the discussion content remains visible, no further comments or replies can be added at this time.
            </p>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${clientBaseUrl}/community-guidelines" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; font-size: 15px; margin-right: 10px;">
                View Community Rules
              </a>
              <a href="${clientBaseUrl}/community" style="display: inline-block; background-color: #f3f4f6; color: #4b5563; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; font-size: 15px; border: 1px solid #d1d5db;">
                Go to Community
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'post_locked') :
      createErrorResponse(new Error(result.error), 'post_locked');
  } catch (error) {
    return createErrorResponse(error, 'post_locked');
  }
};

// Send Post Edited Email
export const sendPostEditedEmail = async (email, username, postTitle, postId) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Discussion Edited - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Community Moderation Alert</p>
          </div>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Your Discussion Has Been Edited</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Hello ${username},
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              We want to let you know that a community moderator has edited your discussion thread <strong>"${postTitle}"</strong>.
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Edits are typically made to ensure content aligns with our community guidelines, remove sensitive information, or improve clarity.
            </p>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${clientBaseUrl}/community-guidelines" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; font-size: 15px; margin-right: 10px;">
                View Community Rules
              </a>
              <a href="${clientBaseUrl}/community" style="display: inline-block; background-color: #f3f4f6; color: #4b5563; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; font-size: 15px; border: 1px solid #d1d5db;">
                Go to Community
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'post_edited') :
      createErrorResponse(new Error(result.error), 'post_edited');
  } catch (error) {
    return createErrorResponse(error, 'post_edited');
  }
};

// Send Post Deleted Email
export const sendPostDeletedEmail = async (email, username, postTitle) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Discussion Removed - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Community Moderation Alert</p>
          </div>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Your Discussion Has Been Removed</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Hello ${username},
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              We are writing to inform you that your discussion thread <strong>"${postTitle}"</strong> has been removed by a community moderator.
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              This action was taken because the content was found to be in violation of our community standards or terms of service.
            </p>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${clientBaseUrl}/community-guidelines" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; font-size: 15px; margin-right: 10px;">
                Review Community Guidelines
              </a>
              <a href="${clientBaseUrl}/community" style="display: inline-block; background-color: #f3f4f6; color: #4b5563; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; font-size: 15px; border: 1px solid #d1d5db;">
                Go to Community
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'post_deleted') :
      createErrorResponse(new Error(result.error), 'post_deleted');
  } catch (error) {
    return createErrorResponse(error, 'post_deleted');
  }
};

// Send Post Unlocked Email
export const sendPostUnlockedEmail = async (email, username, postTitle, postId) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Discussion Unlocked - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Community Moderation Alert</p>
          </div>
          
          <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #10b981;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Your Discussion Has Been Unlocked</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Hello ${username},
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Good news! Your discussion thread <strong>"${postTitle}"</strong> has been unlocked by a community moderator.
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              This means discussions can resume, and new comments or replies can now be added to the thread.
            </p>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${clientBaseUrl}/community" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; font-size: 15px; margin-right: 10px;">
                View Discussion
              </a>
              <a href="${clientBaseUrl}/community-guidelines" style="display: inline-block; background-color: #ecfdf5; color: #065f46; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; font-size: 15px; border: 1px solid #10b981;">
                Community Guidelines
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'post_unlocked') :
      createErrorResponse(new Error(result.error), 'post_unlocked');
  } catch (error) {
    return createErrorResponse(error, 'post_unlocked');
  }
};

// Send Blog Comment Edited Email
export const sendCommentEditedEmail = async (email, username, blogTitle, blogId, commentContent) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Comment Edited - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Community Moderation Alert</p>
          </div>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Your Comment Has Been Edited</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Hello ${username},
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              A community moderator has edited your comment on the blog <strong>"${blogTitle}"</strong>.
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              <strong>Original Content:</strong><br/>
              <em style="color: #6b7280;">"${commentContent}"</em>
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Edits are typically made to ensure content aligns with our community guidelines while preserving the discussion.
            </p>
            <p style="color: #9ca3af; margin: 0 0 15px 0; font-size: 12px;">
              Action taken on: ${new Date().toLocaleString()}
            </p>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${clientBaseUrl}/blog/${blogId}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; font-size: 15px; margin-right: 10px;">
                View Blog
              </a>
              <a href="${clientBaseUrl}/community-guidelines" style="display: inline-block; background-color: #f3f4f6; color: #4b5563; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; font-size: 15px; border: 1px solid #d1d5db;">
                Community Guidelines
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'comment_edited') :
      createErrorResponse(new Error(result.error), 'comment_edited');
  } catch (error) {
    return createErrorResponse(error, 'comment_edited');
  }
};

// Send Blog Comment Deleted Email
export const sendCommentDeletedEmail = async (email, username, blogTitle, blogId, commentContent) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Comment Removed - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Community Moderation Alert</p>
          </div>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Your Comment Has Been Removed</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Hello ${username},
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              We are writing to inform you that your comment on the blog <strong>"${blogTitle}"</strong> has been removed by a community moderator.
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              <strong>Removed Content:</strong><br/>
              <em style="color: #6b7280;">"${commentContent}"</em>
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              This action was taken because the content was found to be in violation of our community standards.
            </p>
            <p style="color: #9ca3af; margin: 0 0 15px 0; font-size: 12px;">
              Action taken on: ${new Date().toLocaleString()}
            </p>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${clientBaseUrl}/community-guidelines" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; font-size: 15px; margin-right: 10px;">
                Community Guidelines
              </a>
              <a href="${clientBaseUrl}/blog/${blogId}" style="display: inline-block; background-color: #f3f4f6; color: #4b5563; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; font-size: 15px; border: 1px solid #d1d5db;">
                View Blog
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'comment_deleted') :
      createErrorResponse(new Error(result.error), 'comment_deleted');
  } catch (error) {
    return createErrorResponse(error, 'comment_deleted');
  }
};

// Send Leaderboard Bonus Email
export const sendLeaderboardBonusEmail = async (email, username, rank, amount, monthName) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `You won the Monthly Leaderboard! - UrbanSetu`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #f59e0b; margin: 0; font-size: 28px;">Congratulations! 🏆</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Monthly Leaderboard Winner</p>
          </div>
          
          <div style="background-color: #fffbeb; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
            <h2 style="color: #92400e; margin: 0 0 15px 0; font-size: 20px;">You are a Top Earner!</h2>
            <p style="color: #92400e; margin: 0 0 15px 0; line-height: 1.6;">
              Incredible job, <strong>${username}</strong>! You finished <strong>Rank #${rank}</strong> in the ${monthName} leaderboard race.
            </p>
            
            <div style="background-color: #f59e0b; color: white; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-size: 14px; display:block; margin-bottom:5px;">You've won a bonus of</span>
              <span style="font-size: 32px; font-weight: bold;">${amount} SetuCoins</span>
            </div>
            
            <p style="color: #92400e; margin: 0; font-size: 14px;">
              Your rewards count towards your lifetime status. Keep participating to stay on top!
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <a href="https://urbansetu.vercel.app/user/rewards?tab=leaderboard" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">View Leaderboard</a>
          </div>

          <div style="text-align: center; margin-top: 20px;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'leaderboard_bonus') :
      createErrorResponse(new Error(result.error), 'leaderboard_bonus');
  } catch (error) {
    return createErrorResponse(error, 'leaderboard_bonus');
  }
};

// Send Pre-Booking Message Notification Email
// Send Pre-Booking Message Notification Email
export const sendPreBookingMessageNotification = async (email, recipientName, senderName, propertyName, propertyLink) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `New Message from ${senderName} regarding ${propertyName} - UrbanSetu`,
    html: `
      <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;'>
        <div style='background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);'>
          <div style='text-align: center; margin-bottom: 30px;'>
            <h1 style='color: #2563eb; margin: 0; font-size: 28px;'>UrbanSetu</h1>
            <p style='color: #6b7280; margin: 10px 0 0 0;'>New Inquiry Message</p>
          </div>
          
          <div style='background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;'>
            <h2 style='color: #1f2937; margin: 0 0 15px 0; font-size: 20px;'>New Message Received</h2>
            <p style='color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;'>
              Hello <strong>${recipientName}</strong>,
            </p>
            <p style='color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;'>
              You have received a new message from <strong>${senderName}</strong> regarding your property <strong>${propertyName}</strong>.
            </p>
            <p style='color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;'>
              For privacy and security reasons, please log in to your account to view and reply to this message.
            </p>
            
            <div style='text-align: center; margin: 20px 0;'>
              <a href='${propertyLink}' style='display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;'>
                View Message
              </a>
            </div>
          </div>
          
          <div style='text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;'>
            <p style='color: #9ca3af; margin: 0; font-size: 12px;'>
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'pre_booking_message') :
      createErrorResponse(new Error(result.error), 'pre_booking_message');
  } catch (error) {
    return createErrorResponse(error, 'pre_booking_message');
  }
};

// Send New Blog Notification Email
// Send New Blog/Guide Notification Email
// --------------------------------------------------------------------------
// SUBSCRIPTION SYSTEM EMAILS
// --------------------------------------------------------------------------

// 1. Subscription Received (Pending Approval)
export const sendSubscriptionReceivedEmail = async (email, type = 'blog') => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const isGuide = type === 'guide' || type === 'guides_page';
  const label = isGuide ? 'Guides' : 'Blogs';
  const link = isGuide ? `${clientBaseUrl}/guides` : `${clientBaseUrl}/blogs`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Subscription Received: UrbanSetu ${label} - Pending Approval`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
        <div style="background: linear-gradient(135deg, ${isGuide ? '#7c3aed 0%, #4c1d95 100%' : '#2563eb 0%, #1e40af 100%'}); padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Subscription Received</h1>
        </div>
        
        <div style="padding: 32px 24px;">
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            Hello,
          </p>
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            Thank you for subscribing to <strong>UrbanSetu ${label}</strong>. We have received your request.
          </p>
          <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
            <p style="margin: 0; color: #9a3412; font-weight: 500;">
              Status: <strong>Pending Approval</strong>
            </p>
            <p style="margin: 8px 0 0 0; color: #9a3412; font-size: 14px;">
              An administrator will review your subscription request shortly. You will receive another email once your subscription is approved.
            </p>
          </div>
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
            In the meantime, feel free to browse our latest content:
          </p>
          <div style="text-align: center; margin-bottom: 32px;">
            <a href="${link}" style="display: inline-block; background-color: ${isGuide ? '#7c3aed' : '#2563eb'}; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Browse ${label}
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 0 0 24px 0;">
          <div style="text-align: center;">
            <p style="color: #9ca3af; font-size: 13px; margin: 0;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'subscription_received') :
      createErrorResponse(new Error(result.error), 'subscription_received');
  } catch (error) {
    return createErrorResponse(error, 'subscription_received');
  }
};

// 2. Subscription Approved
export const sendSubscriptionApprovedEmail = async (email, type = 'blog') => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const isGuide = type === 'guide' || type === 'guides_page';
  const label = isGuide ? 'Guides' : 'Blogs';
  const link = isGuide ? `${clientBaseUrl}/guides` : `${clientBaseUrl}/blogs`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Subscription Approved: UrbanSetu ${label} - Welcome!`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
        <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Subscription Approved!</h1>
        </div>
        
        <div style="padding: 32px 24px;">
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            Great news! Your subscription to <strong>UrbanSetu ${label}</strong> has been approved.
          </p>
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            You will now receive notifications whenever we publish new ${isGuide ? 'comprehensive guides' : 'insightful articles'}.
          </p>
          <div style="text-align: center; margin-bottom: 32px;">
            <a href="${link}" style="display: inline-block; background-color: #059669; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              View Latest ${label}
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 0px;">
             You can manage your subscription settings directly on our website.
          </p>
          <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0 24px 0;">
          <div style="text-align: center;">
            <p style="color: #9ca3af; font-size: 13px; margin: 0;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'subscription_approved') :
      createErrorResponse(new Error(result.error), 'subscription_approved');
  } catch (error) {
    return createErrorResponse(error, 'subscription_approved');
  }
};

// 3. Subscription Rejected
export const sendSubscriptionRejectedEmail = async (email, type = 'blog', reason) => {
  const isGuide = type === 'guide' || type === 'guides_page';
  const label = isGuide ? 'Guides' : 'Blogs';

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Subscription Update: UrbanSetu ${label}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
        <div style="background-color: #ef4444; padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Subscription Rejection</h1>
        </div>
        
        <div style="padding: 32px 24px;">
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            We reviewed your request to subscribe to <strong>UrbanSetu ${label}</strong>. Unfortunately, we cannot approve your subscription at this time.
          </p>
          
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
             <p style="margin: 0; color: #991b1b; font-weight: 500;">Reason:</p>
             <p style="margin: 5px 0 0 0; color: #7f1d1d; font-style: italic;">
               "${reason || 'Does not meet our community guidelines.'}"
             </p>
          </div>

          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            If you believe this is a mistake, please contact our support team.
          </p>
          
          <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 0 0 24px 0;">
          <div style="text-align: center;">
            <p style="color: #9ca3af; font-size: 13px; margin: 0;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'subscription_rejected') :
      createErrorResponse(new Error(result.error), 'subscription_rejected');
  } catch (error) {
    return createErrorResponse(error, 'subscription_rejected');
  }
};

// 4. Subscription Revoked
export const sendSubscriptionRevokedEmail = async (email, type = 'blog', reason) => {
  const isGuide = type === 'guide' || type === 'guides_page';
  const label = isGuide ? 'Guides' : 'Blogs';

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Subscription Revoked: UrbanSetu ${label}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
        <div style="background-color: #374151; padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Subscription Revoked</h1>
        </div>
        
        <div style="padding: 32px 24px;">
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            Your subscription to <strong>UrbanSetu ${label}</strong> has been revoked by an administrator.
          </p>
          
          <div style="background-color: #f3f4f6; border-left: 4px solid #374151; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
             <p style="margin: 0; color: #1f2937; font-weight: 500;">Reason:</p>
             <p style="margin: 5px 0 0 0; color: #374151; font-style: italic;">
               "${reason || 'Violation of terms or policy.'}"
             </p>
          </div>

          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            You will no longer receive updates for this section. If you have questions, please contact support.
          </p>
          
          <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 0 0 24px 0;">
          <div style="text-align: center;">
            <p style="color: #9ca3af; font-size: 13px; margin: 0;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'subscription_revoked') :
      createErrorResponse(new Error(result.error), 'subscription_revoked');
  } catch (error) {
    return createErrorResponse(error, 'subscription_revoked');
  }
};

// Send New Blog/Guide Notification Email
export const sendNewBlogNotification = async (email, username, blog) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  // Use slug if available, otherwise fallback to ID
  const typePath = blog.type === 'guide' ? 'guide' : 'blog';
  const blogLink = `${clientBaseUrl}/${typePath}/${blog.slug || blog._id}`;

  // Determine text based on type (default to 'Blog Post' if undefined)
  const isGuide = blog.type === 'guide';
  const typeLabel = isGuide ? 'Guide' : 'Blog Post';
  const typeHeader = isGuide ? 'New Guide Arrived' : 'New Blog Post';
  const buttonText = isGuide ? 'Read Full Guide' : 'Read Full Article';
  const fallbackCategory = isGuide ? 'Guide' : 'Blog';

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `New ${typeLabel}: ${blog.title} - UrbanSetu`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
        
        <!-- Header / Hero Image -->
        ${blog.thumbnail ? `
        <div style="width: 100%; height: 200px; overflow: hidden; background-color: #f3f4f6;">
          <img src="${blog.thumbnail}" alt="${blog.title}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
        ` : `
        <div style="background: linear-gradient(135deg, ${isGuide ? '#7c3aed 0%, #4c1d95 100%' : '#2563eb 0%, #1e40af 100%'}); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">${typeHeader} from UrbanSetu</h1>
        </div>
        `}

        <div style="padding: 32px 24px;">
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">Hello ${username || 'there'},</p>
          
          <h2 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0 0 16px 0; line-height: 1.3;">
            ${blog.title}
          </h2>

          <div style="margin-bottom: 24px;">
            <span style="background-color: ${isGuide ? '#f5f3ff' : '#eff6ff'}; color: ${isGuide ? '#7c3aed' : '#2563eb'}; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
              ${blog.category || fallbackCategory}
            </span>
          </div>

          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
            ${blog.excerpt || `We have just published a new ${typeLabel.toLowerCase()} that might interest you. Click the button below to read fully.`}
          </p>

          <div style="text-align: center; margin-bottom: 32px;">
            <a href="${blogLink}" style="display: inline-block; background-color: ${isGuide ? '#7c3aed' : '#2563eb'}; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">
              ${buttonText}
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 0 0 32px 0;">

          <!-- Footer -->
          <div style="text-align: center;">
            <p style="color: #9ca3af; font-size: 13px; margin: 0 0 8px 0;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
            <p style="color: #9ca3af; font-size: 13px; margin: 0;">
              You received this email because you are a registered member of the UrbanSetu community.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    // We use a shorter timeout/retries for bulk notifications to avoid clogging
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'new_blog_notification') :
      createErrorResponse(new Error(result.error), 'new_blog_notification');
  } catch (error) {
    return createErrorResponse(error, 'new_blog_notification');
  }
};

// --------------------------------------------------------------------------
// OTP EMAILS FOR SUBSCRIPTION SYSTEM
// --------------------------------------------------------------------------

// Send Subscription OTP Email
export const sendSubscriptionOtpEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Verify Your Subscription - UrbanSetu`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
        <div style="background-color: #2563eb; padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Verify Email</h1>
        </div>
        
        <div style="padding: 32px 24px;">
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px; text-align: center;">
            Please use the following One-Time Password (OTP) to complete your subscription request.
          </p>
          
          <div style="background-color: #eff6ff; border: 2px dashed #bfdbfe; padding: 20px; margin-bottom: 24px; border-radius: 12px; text-align: center;">
             <span style="font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #1e40af; display: block;">${otp}</span>
          </div>

          <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px; text-align: center;">
            This OTP is valid for 10 minutes. If you did not request this, please ignore this email.
          </p>
          
          <div style="text-align: center;">
            <p style="color: #9ca3af; font-size: 13px; margin: 0;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'subscription_otp') :
      createErrorResponse(new Error(result.error), 'subscription_otp');
  } catch (error) {
    return createErrorResponse(error, 'subscription_otp');
  }
};

// Send Opt-Out OTP Email
export const sendOptOutOtpEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Confirm Unsubscription - UrbanSetu`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
        <div style="background-color: #ef4444; padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Confirm Unsubscription</h1>
        </div>
        
        <div style="padding: 32px 24px;">
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px; text-align: center;">
            You requested to unsubscribe from our updates. Please verify this action with the OTP below.
          </p>
          
          <div style="background-color: #fef2f2; border: 2px dashed #fecaca; padding: 20px; margin-bottom: 24px; border-radius: 12px; text-align: center;">
             <span style="font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #991b1b; display: block;">${otp}</span>
          </div>

          <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px; text-align: center;">
            This OTP is valid for 10 minutes.
          </p>
     
          <div style="text-align: center;">
            <p style="color: #9ca3af; font-size: 13px; margin: 0;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'optout_otp') :
      createErrorResponse(new Error(result.error), 'optout_otp');
  } catch (error) {
    return createErrorResponse(error, 'optout_otp');
  }
};

// Send Legal Notice Email for Defaulted Loans
export const sendLoanLegalNoticeEmail = async (email, details) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `LEGAL NOTICE: Default on Loan Repayment - ${details.loanId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0; font-size: 28px; text-transform: uppercase;">Legal Notice</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Strict Action Warning</p>
          </div>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
            <p style="color: #7f1d1d; margin: 0 0 15px 0; line-height: 1.6;">
              Dear <strong>${details.userName}</strong>,
            </p>
            <p style="color: #7f1d1d; margin: 0 0 15px 0; line-height: 1.6;">
              This is a formal notice regarding the default on your rental loan (Loan ID: <strong>${details.loanId}</strong>).
            </p>
            <p style="color: #7f1d1d; margin: 0 0 15px 0; line-height: 1.6;">
              Despite multiple reminders, you have failed to clear your outstanding dues. Your loan has been classified as <strong>Defaulted</strong>.
            </p>

            <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #fca5a5;">
              <p style="margin: 5px 0; color: #374151;"><strong>Outstanding Balance:</strong> ${details.outstandingAmount}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Overdue Since:</strong> ${details.defaultedDate}</p>
            </div>
            
            <p style="color: #dc2626; font-weight: bold; margin: 0 0 15px 0; line-height: 1.6;">
              CONSEQUENCES OF NON-PAYMENT:
            </p>
            <ul style="color: #7f1d1d; margin: 0 0 15px 0; padding-left: 20px;">
              <li>Immediate reporting to Credit Bureaus (CIBIL/Experian), severely impacting your credit score.</li>
              <li>Permanent suspension of your UrbanSetu account.</li>
              <li>Initiation of civil/criminal legal proceedings for recovery of dues.</li>
            </ul>

            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              You are hereby advised to clear the dues immediately or contact us for a one-time settlement within <strong>3 days</strong> of receiving this notice.
            </p>
            
            <div style="text-align:center; margin-top: 20px;">
              <a href="${details.contactUrl}" style="display:inline-block; background-color:#dc2626; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:600;">Contact Legal Team</a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu Legal Department.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'loan_legal_notice') :
      createErrorResponse(new Error(result.error), 'loan_legal_notice');
  } catch (error) {
    return createErrorResponse(error, 'loan_legal_notice');
  }
};

// Send Loan Written Off / Settlement Email
export const sendLoanSettlementEmail = async (email, details) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Loan Settlement Confirmation - ${details.loanId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4b5563; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Loan Status Update</p>
          </div>
          
          <div style="padding: 20px;">
            <p style="color: #374151; margin: 0 0 15px 0; line-height: 1.6;">
              Dear <strong>${details.userName}</strong>,
            </p>
            <p style="color: #374151; margin: 0 0 15px 0; line-height: 1.6;">
              This email is to confirm that your loan (ID: <strong>${details.loanId}</strong>) has been marked as <strong>${details.status}</strong>.
            </p>
            
            ${details.status === 'Separately Settled' || details.status === 'Settled' ? `
            <p style="color: #374151; margin: 0 0 15px 0; line-height: 1.6;">
               The settlement of <strong>${details.amount}</strong> has been recorded and the loan account is now closed. 
               No further dues are pending against this loan ID.
            </p>
            ` : `
            <p style="color: #374151; margin: 0 0 15px 0; line-height: 1.6;">
               Your loan account has been closed. Please refer to prior communications regarding the final status of this account.
            </p>
            `}

            <div style="text-align:center; margin-top: 30px; margin-bottom: 30px;">
               <span style="display:inline-block; padding: 10px 20px; background-color: #f3f4f6; color: #374151; border-radius: 4px; font-weight: bold; border: 1px solid #d1d5db;">
                  Account Closed
               </span>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin: 0 0 15px 0;">
              Please keep this email for your records.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ?
      createSuccessResponse(result.messageId, 'loan_settlement') :
      createErrorResponse(new Error(result.error), 'loan_settlement');
  } catch (error) {
    return createErrorResponse(error, 'loan_settlement');
  }
};

// --------------------------------------------------------------------------
// AUTO-DEBIT SYSTEM EMAILS
// --------------------------------------------------------------------------

// 1. Send Auto-Debit Enabled Email
export const sendAutoDebitEnabledEmail = async (email, details) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Auto-Debit Enabled Successfully - UrbanSetu`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #059669; margin: 0; font-size: 28px;">Auto-Debit Enabled</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Secure Automated Payments</p>
          </div>
          
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #059669;">
            <p style="color: #065f46; margin: 0 0 15px 0; line-height: 1.6;">
              Hello <strong>${details.userName}</strong>,
            </p>
            <p style="color: #065f46; margin: 0 0 15px 0; line-height: 1.6;">
              Congratulations! Your monthly rent auto-debit service has been successfully enabled for the property: <strong>${details.propertyName}</strong> (Contract ID: ${details.contractId}).
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 12px; border: 1px solid #d1fae5; margin: 20px 0;">
              <h3 style="color: #047857; margin-top: 0; font-size: 16px;">System Configuration:</h3>
              <p style="margin: 8px 0; font-size: 14px; color: #4b5563;"><strong>Payment Method:</strong> ${details.method === 'upi' ? 'UPI / VPA' : details.method.toUpperCase()}</p>
              <p style="margin: 8px 0; font-size: 14px; color: #4b5563;"><strong>Monthly Schedule:</strong> Every ${details.day}${details.day === 1 ? 'st' : details.day === 2 ? 'nd' : details.day === 3 ? 'rd' : 'th'} day of month</p>
              <p style="margin: 8px 0; font-size: 14px; color: #4b5563;"><strong>Linked Details:</strong> ${details.displayDetails}</p>
            </div>
            
            <p style="color: #065f46; margin: 0 0 15px 0; line-height: 1.6;">
              Starting next billing cycle, your rent will be automatically deducted on the scheduled date. Please ensure sufficient balance in your linked account to avoid penalties.
            </p>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/rent-wallet?contractId=${details.contractId}" style="display: inline-block; background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Manage Rent Wallet</a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. Secured Payments Worldwide.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ? createSuccessResponse(result.messageId, 'autodebit_enabled') : createErrorResponse(new Error(result.error), 'autodebit_enabled');
  } catch (error) {
    return createErrorResponse(error, 'autodebit_enabled');
  }
};

// 2. Send Auto-Debit Schedule Updated Email
export const sendAutoDebitScheduleUpdatedEmail = async (email, details) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Auto-Debit Schedule Updated - UrbanSetu`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">Schedule Updated</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Automatic Payment Adjustment</p>
          </div>
          
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
            <p style="color: #1e40af; margin: 0 0 15px 0; line-height: 1.6;">
              Hello <strong>${details.userName}</strong>,
            </p>
            <p style="color: #1e40af; margin: 0 0 15px 0; line-height: 1.6;">
              Your auto-debit schedule for <strong>${details.propertyName}</strong> has been updated as requested.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 12px; border: 1px solid #bfdbfe; margin: 20px 0; text-align: center;">
              <span style="font-size: 14px; color: #64748b; display: block; margin-bottom: 5px;">Your new monthly debit date:</span>
              <span style="font-size: 32px; font-weight: 800; color: #2563eb;">Day ${details.day}</span>
              <span style="font-size: 14px; color: #64748b; display: block; margin-top: 5px;">of every month</span>
            </div>
            
            <p style="color: #1e40af; margin: 0 0 15px 0; line-height: 1.6;">
              Any upcoming payments will now be processed according to this new schedule.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/rent-wallet?contractId=${details.contractId}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Details</a>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. Flexible payments for simplified living.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ? createSuccessResponse(result.messageId, 'autodebit_schedule_updated') : createErrorResponse(new Error(result.error), 'autodebit_schedule_updated');
  } catch (error) {
    return createErrorResponse(error, 'autodebit_schedule_updated');
  }
};

// 3. Send Auto-Debit Edited (Source Updated) Email
export const sendAutoDebitEditedEmail = async (email, details) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Payment Source Updated - UrbanSetu`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #7c3aed; margin: 0; font-size: 28px;">Source Updated</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Secure Payment Source Modification</p>
          </div>
          
          <div style="background-color: #f5f3ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #7c3aed;">
            <p style="color: #4c1d95; margin: 0 0 15px 0; line-height: 1.6;">
              Hello <strong>${details.userName}</strong>,
            </p>
            <p style="color: #4c1d95; margin: 0 0 15px 0; line-height: 1.6;">
              This is to confirm that the payment source for your auto-debit service has been successfully updated for <strong>${details.propertyName}</strong>.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 12px; border: 1px solid #ddd6fe; margin: 20px 0;">
              <h3 style="color: #6d28d9; margin-top: 0; font-size: 16px;">New Payment Details:</h3>
              <p style="margin: 8px 0; font-size: 14px; color: #4b5563;"><strong>Method:</strong> ${details.method === 'upi' ? 'UPI / VPA' : details.method.toUpperCase()}</p>
              <p style="margin: 8px 0; font-size: 14px; color: #4b5563;"><strong>Account:</strong> ${details.displayDetails}</p>
            </div>
            
            <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
              If you did not authorize this change, please contact our support team immediately.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. Protecting your payments with edge encryption.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ? createSuccessResponse(result.messageId, 'autodebit_edited') : createErrorResponse(new Error(result.error), 'autodebit_edited');
  } catch (error) {
    return createErrorResponse(error, 'autodebit_edited');
  }
};

// 4. Send Auto-Debit Removed Email
export const sendAutoDebitRemovedEmail = async (email, details) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Auto-Debit Disabled & Source Removed - UrbanSetu`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0; font-size: 28px;">Auto-Debit Disabled</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Manual Payment Mode Re-activated</p>
          </div>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
            <p style="color: #991b1b; margin: 0 0 15px 0; line-height: 1.6;">
              Hello <strong>${details.userName}</strong>,
            </p>
            <p style="color: #991b1b; margin: 0 0 15px 0; line-height: 1.6;">
              We are confirming that the auto-debit service for <strong>${details.propertyName}</strong> has been disabled and your payment source details have been permanently removed from our active billing system.
            </p>
            
            <div style="background-color: white; padding: 15px; border-radius: 8px; border: 1px solid #fecaca; margin: 20px 0;">
               <p style="margin: 0; color: #dc2626; font-size: 14px; font-weight: bold;">⚠️ Critical Reminder:</p>
               <p style="margin: 5px 0 0 0; font-size: 14px; color: #7f1d1d;">Your rent will no longer be deducted automatically. Please ensure you make manual payments on or before the due date to avoid late fees.</p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/rent-wallet?contractId=${details.contractId}" style="display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Make Manual Payment</a>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. You can re-enable auto-debit anytime from your dashboard.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ? createSuccessResponse(result.messageId, 'autodebit_removed') : createErrorResponse(new Error(result.error), 'autodebit_removed');
  } catch (error) {
    return createErrorResponse(error, 'autodebit_removed');
  }
};

// --------------------------------------------------------------------------
// GAMIFICATION EMAILS
// --------------------------------------------------------------------------

// Send Badge Earned Email
export const sendBadgeEarnedEmail = async (email, username, badgeName, coinsEarned) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Congratulations! You've earned the ${badgeName} Badge 🏆 - UrbanSetu`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366f1; margin: 0; font-size: 28px;">New Achievement! ✨</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">You're making great progress on UrbanSetu</p>
          </div>
          
          <div style="background-color: #eef2ff; padding: 25px; border-radius: 12px; margin-bottom: 25px; border-left: 5px solid #6366f1; position: relative; overflow: hidden;">
            <div style="position: absolute; top: -10px; right: -10px; opacity: 0.1; font-size: 100px;">🏆</div>
            <h2 style="color: #1e1b4b; margin: 0 0 15px 0; font-size: 20px;">Congratulations, <strong>${username}</strong>!</h2>
            <p style="color: #312e81; margin: 0 0 15px 0; line-height: 1.6; font-size: 16px;">
              You've officially earned the <strong style="color: #4338ca;">${badgeName}</strong> badge! 
              This is a testament to your consistency and reliability on our platform.
            </p>
            
            <div style="background-color: white; padding: 15px; border-radius: 10px; text-align: center; margin: 20px 0; border: 1px dashed #6366f1;">
              <span style="font-size: 14px; color: #6b7280; display:block; margin-bottom:5px;">Your Milestone Bonus</span>
              <span style="font-size: 32px; font-weight: bold; color: #4338ca;">+${coinsEarned} SetuCoins 🪙</span>
            </div>
            
            <p style="color: #4b5563; margin: 0; font-size: 14px; font-style: italic;">
              Your milestone reward has been credited to your wallet and can be used for platform discounts.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/rewards" style="display: inline-block; background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; box-shadow: 0 4px 6px rgba(99, 102, 241, 0.2);">
              View My Badges & Rewards
            </a>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. Helping you build a better rental history.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions);
    return result.success ? createSuccessResponse(result.messageId, 'badge_earned') : createErrorResponse(new Error(result.error), 'badge_earned');
  } catch (error) {
    return createErrorResponse(error, 'badge_earned');
  }
};

// Personal Creator Feedback & Welcome Email - Sent on new user signup
export const sendCreatorFeedbackEmail = async (email, username) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const unsubscribeUrl = getUnsubscribeUrl(email);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `A Personal Note from the Creator of UrbanSetu — Welcome, ${username || 'there'}! 💌`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>A Message from the Creator</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f4f8;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header with creator branding -->
          <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%); padding: 45px 30px; text-align: center; position: relative;">
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 80%22><circle cx=%2240%22 cy=%2240%22 r=%2235%22 fill=%22none%22 stroke=%22rgba(255,255,255,0.08)%22 stroke-width=%222%22/></svg>') repeat; opacity: 0.3;"></div>
            <div style="position: relative; z-index: 1;">
              <!-- Creator Avatar -->
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #ffffff 0%, #e0e7ff 100%); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px; border: 3px solid rgba(255,255,255,0.5); box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
                <span style="font-size: 28px; font-weight: 800; color: #6366f1; letter-spacing: -1px;">👋</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; line-height: 1.3;">A Personal Note from<br/>the Creator of UrbanSetu</h1>
              <p style="color: #e0e7ff; margin: 12px 0 0; font-size: 15px; font-style: italic;">Built with passion, shaped by your feedback</p>
              <!-- Platform Version Badge -->
              <div style="display: inline-block; margin-top: 12px; background: rgba(255,255,255,0.15); padding: 4px 14px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.2);">
                <span style="color: #e0e7ff; font-size: 11px; font-weight: 500;">Platform v2.0 • MERN + AI • Launched 2025</span>
              </div>
            </div>
          </div>
          
          <!-- Main Content -->
          <div style="padding: 40px 30px;">
            
            <!-- Personal greeting -->
            <div style="margin-bottom: 28px;">
              <p style="color: #1f2937; font-size: 17px; line-height: 1.7; margin: 0 0 15px;">
                Hey ${username || 'there'}, 👋
              </p>
              <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0 0 15px;">
                I'm <strong style="color: #6366f1;">Vijay Chalendra</strong>, and we are the <strong style="color: #6366f1;">UrbanSetu team</strong>. We noticed you recently signed up and explored our platform — and we genuinely want to say <strong>thank you</strong> for giving UrbanSetu a chance!
              </p>
              <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0;">
                UrbanSetu started as a passion project to simplify real estate for everyone — whether you're searching for your dream home, listing a property, or building meaningful connections in the market. Every feature you see was crafted with care, and it's users like you who make this journey worthwhile.
              </p>
            </div>

            <!-- Feedback Request Section -->
            <div style="background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border: 1px solid #e9d5ff; border-radius: 12px; padding: 25px; margin-bottom: 28px;">
              <div style="display: flex; align-items: flex-start; gap: 12px;">
                <span style="font-size: 28px; line-height: 1;">💡</span>
                <div>
                  <h3 style="color: #6d28d9; margin: 0 0 10px; font-size: 18px; font-weight: 700;">Your Feedback Matters — A Lot!</h3>
                  <p style="color: #5b21b6; font-size: 14px; line-height: 1.7; margin: 0 0 12px;">
                    We'd love to hear about your experience so far. Whether it's a tiny UI glitch, a feature idea, something that confused you, or even just a "Hey, this is cool!" — <strong>every piece of feedback helps us make UrbanSetu better</strong>.
                  </p>
                  <p style="color: #5b21b6; font-size: 14px; line-height: 1.7; margin: 0;">
                    Here are some things we'd especially love your insights on:
                  </p>
                  <ul style="color: #5b21b6; font-size: 14px; line-height: 1.8; margin: 10px 0 0; padding-left: 18px;">
                    <li>Was the signup process smooth?</li>
                    <li>Did you find what you were looking for?</li>
                    <li>Any features you wish existed?</li>
                    <li>Did anything feel broken or confusing?</li>
                    <li>How does the platform compare to others you've used?</li>
                    <li>Performance and loading speed on your device?</li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- SetuCoins Reward Incentive -->
            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fff7ed 100%); border: 2px dashed #f59e0b; border-radius: 12px; padding: 20px; margin-bottom: 28px; text-align: center;">
              <span style="font-size: 32px;">🪙</span>
              <h3 style="color: #92400e; margin: 8px 0 6px; font-size: 17px; font-weight: 700;">Share Feedback & Earn 10 SetuCoins!</h3>
              <p style="color: #78350f; font-size: 13px; line-height: 1.6; margin: 0;">
                Fill out our quick feedback survey and we'll reward you with <strong>10 SetuCoins</strong> — use them for premium features, badges, and leaderboard rankings!
              </p>
            </div>

            <!-- Quick Survey CTA -->
            <div style="text-align: center; margin-bottom: 28px;">
              <a href="https://docs.google.com/forms/d/e/1FAIpQLSfczXodXme_kSsff2XNktDp6y9r0DyXm_abV9VIqK3PcBKhVg/viewform" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4); letter-spacing: 0.3px;">
                📋 Take the 2-Min Survey
              </a>
              <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0;">Takes ~2 minutes • Completely anonymous • Earns you 10 SetuCoins</p>
            </div>

            <!-- Bug Reports & Issues Section -->
            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 1px solid #fbbf24; border-radius: 12px; padding: 25px; margin-bottom: 28px;">
              <div style="display: flex; align-items: flex-start; gap: 12px;">
                <span style="font-size: 28px; line-height: 1;">🐛</span>
                <div>
                  <h3 style="color: #92400e; margin: 0 0 10px; font-size: 18px; font-weight: 700;">Found a Bug? Report It!</h3>
                  <p style="color: #78350f; font-size: 14px; line-height: 1.7; margin: 0;">
                    Encountered any issues, errors, or unexpected behavior? Don't hesitate to report it. We take every bug report seriously and work to fix them as quickly as possible. You're not just reporting a problem — you're helping the entire community!
                  </p>
                </div>
              </div>
            </div>

            <!-- Roadmap Teaser -->
            <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #93c5fd; border-radius: 12px; padding: 25px; margin-bottom: 28px;">
              <div style="display: flex; align-items: flex-start; gap: 12px;">
                <span style="font-size: 28px; line-height: 1;">🗺️</span>
                <div>
                  <h3 style="color: #1e40af; margin: 0 0 10px; font-size: 18px; font-weight: 700;">What's Coming Next?</h3>
                  <p style="color: #1d4ed8; font-size: 14px; line-height: 1.7; margin: 0 0 12px;">
                    We're constantly building. Here's a sneak peek at what's on our roadmap:
                  </p>
                  <div style="display: grid; gap: 6px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="color: #3b82f6; font-size: 14px;">🤖</span>
                      <span style="color: #1e40af; font-size: 13px;">AI-powered property recommendations based on your preferences</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="color: #3b82f6; font-size: 14px;">🏘️</span>
                      <span style="color: #1e40af; font-size: 13px;">3D virtual property tours & immersive walkthroughs</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="color: #3b82f6; font-size: 14px;">📊</span>
                      <span style="color: #1e40af; font-size: 13px;">Neighborhood insights — schools, hospitals, safety scores</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="color: #3b82f6; font-size: 14px;">📱</span>
                      <span style="color: #1e40af; font-size: 13px;">Native mobile app for Android & iOS</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="color: #3b82f6; font-size: 14px;">🔗</span>
                      <span style="color: #1e40af; font-size: 13px;">Blockchain-verified property ownership & rental contracts</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Contact Methods -->
            <div style="background-color: #f8fafc; border-radius: 12px; padding: 25px; margin-bottom: 28px; border: 1px solid #e2e8f0;">
              <h3 style="color: #1e293b; margin: 0 0 18px; font-size: 17px; font-weight: 700; text-align: center;">📬 Reach Out to Us Directly</h3>
              
              <!-- Email Contact 1 -->
              <div style="display: flex; align-items: center; gap: 12px; padding: 12px 15px; background: #ffffff; border-radius: 10px; margin-bottom: 10px; border: 1px solid #e5e7eb;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <span style="color: white; font-size: 18px;">✉️</span>
                </div>
                <div>
                  <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 500;">General Feedback & Support</p>
                  <a href="mailto:urbansetu.noreply@gmail.com" style="color: #2563eb; text-decoration: none; font-size: 14px; font-weight: 600;">urbansetu.noreply@gmail.com</a>
                </div>
              </div>

              <!-- Email Contact 1.5 (General Info) -->
              <div style="display: flex; align-items: center; gap: 12px; padding: 12px 15px; background: #ffffff; border-radius: 10px; margin-bottom: 10px; border: 1px solid #e5e7eb;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <span style="color: white; font-size: 18px;">ℹ️</span>
                </div>
                <div>
                  <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 500;">General Inquiries & Platform Info</p>
                  <a href="mailto:info.urbansetu@gmail.com" style="color: #d97706; text-decoration: none; font-size: 14px; font-weight: 600;">info.urbansetu@gmail.com</a>
                </div>
              </div>

              <!-- Email Contact 2 -->
              <div style="display: flex; align-items: center; gap: 12px; padding: 12px 15px; background: #ffffff; border-radius: 10px; margin-bottom: 10px; border: 1px solid #e5e7eb;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <span style="color: white; font-size: 18px;">📧</span>
                </div>
                <div>
                  <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 500;">Authentication & Account Related Issues</p>
                  <a href="mailto:auth.urbansetu@gmail.com" style="color: #059669; text-decoration: none; font-size: 14px; font-weight: 600;">auth.urbansetu@gmail.com</a>
                </div>
              </div>

              <!-- LinkedIn -->
              <div style="display: flex; align-items: center; gap: 12px; padding: 12px 15px; background: #ffffff; border-radius: 10px; margin-bottom: 10px; border: 1px solid #e5e7eb;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #0077b5, #005885); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <span style="color: white; font-size: 18px; font-weight: bold;">in</span>
                </div>
                <div>
                  <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 500;">Connect with the creator on LinkedIn</p>
                  <a href="https://www.linkedin.com/in/vijaychalendra09" style="color: #0077b5; text-decoration: none; font-size: 14px; font-weight: 600;">linkedin.com/in/vijaychalendra09</a>
                </div>
              </div>

              <!-- GitHub -->
              <div style="display: flex; align-items: center; gap: 12px; padding: 12px 15px; background: #ffffff; border-radius: 10px; border: 1px solid #e5e7eb;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #333333, #1a1a1a); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <span style="color: white; font-size: 18px;">⌨️</span>
                </div>
                <div>
                  <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 500;">Explore the Source Code</p>
                  <a href="https://github.com/VijayChCode/UrbanSetu" style="color: #333333; text-decoration: none; font-size: 14px; font-weight: 600;">github.com/VijayChCode/UrbanSetu</a>
                </div>
              </div>
            </div>

            <!-- Open Source Contribution Invitation -->
            <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 1px solid #6ee7b7; border-radius: 12px; padding: 25px; margin-bottom: 28px;">
              <div style="display: flex; align-items: flex-start; gap: 12px;">
                <span style="font-size: 28px; line-height: 1;">🌟</span>
                <div>
                  <h3 style="color: #065f46; margin: 0 0 10px; font-size: 18px; font-weight: 700;">You Can Shape UrbanSetu!</h3>
                  <p style="color: #047857; font-size: 14px; line-height: 1.7; margin: 0 0 12px;">
                    UrbanSetu is built in the open! If you're a developer, designer, or just curious, you're welcome to explore the codebase, suggest improvements, or even contribute directly. Every star ⭐ on the repo and every issue you raise helps!
                  </p>
                  <a href="https://github.com/VijayChCode/UrbanSetu" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);">
                    ⭐ Star on GitHub
                  </a>
                </div>
              </div>
            </div>

            <!-- Personal Closing -->
            <div style="border-top: 2px solid #e5e7eb; padding-top: 25px; margin-bottom: 20px;">
              <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0 0 15px;">
                We read every single piece of feedback personally. Your words — whether it's praise, criticism, or a feature request — go directly into shaping the future of UrbanSetu. This platform is as much yours as it is ours.
              </p>
              <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0 0 5px;">
                Thank you for being part of this journey. Let's build something amazing together! 🚀
              </p>
              <div style="margin-top: 20px; display: flex; align-items: center; gap: 15px;">
                <!-- Creator Signature Avatar -->
                <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);">
                  <span style="color: white; font-size: 18px; font-weight: 800;">🙏</span>
                </div>
                <div>
                  <p style="color: #1f2937; font-size: 16px; margin: 0; font-weight: 600;">
                    Warm regards,
                  </p>
                  <p style="color: #6366f1; font-size: 18px; margin: 3px 0 0; font-weight: 700; font-style: italic;">
                    Vijay Chalendra & the UrbanSetu Team
                  </p>
                  <p style="color: #6b7280; font-size: 13px; margin: 2px 0 0;">
                    Creator & Developer, UrbanSetu
                  </p>
                </div>
              </div>
            </div>

            <!-- Quick Action Buttons -->
            <div style="text-align: center; margin: 25px 0;">
              <a href="https://docs.google.com/forms/d/e/1FAIpQLSfczXodXme_kSsff2XNktDp6y9r0DyXm_abV9VIqK3PcBKhVg/viewform" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35); margin: 5px;">
                📋 Quick Survey
              </a>
              <a href="${clientBaseUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35); margin: 5px;">
                🏠 Explore UrbanSetu
              </a>
              <a href="mailto:urbansetu.noreply@gmail.com?subject=Feedback from ${encodeURIComponent(username || 'User')}&body=Hi UrbanSetu Team,%0A%0AHere's my feedback about UrbanSetu:%0A%0A" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35); margin: 5px;">
                💬 Email Feedback
              </a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 25px 30px; border-top: 1px solid #e2e8f0;">
            <div style="text-align: center;">
              <p style="color: #6b7280; font-size: 13px; margin: 0 0 8px; line-height: 1.6;">
                This is a one-time personal welcome note from the creator of UrbanSetu.<br/>
                You received this because you recently joined our community.
              </p>
              <p style="margin: 8px 0; font-size: 12px;">
                <a href="${clientBaseUrl}/terms" style="color: #6b7280; text-decoration: underline;">Terms of Use</a>
                &nbsp;·&nbsp;
                <a href="${clientBaseUrl}/privacy" style="color: #6b7280; text-decoration: underline;">Privacy Policy</a>
              </p>
              <p style="color: #9ca3af; margin: 0 0 8px; font-size: 12px;">
                © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 11px;">
                <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a> from promotional emails
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions, 3, 1000, 'promotional');
    return result.success ?
      createSuccessResponse(result.messageId, 'creator_feedback') :
      createErrorResponse(new Error(result.error), 'creator_feedback');
  } catch (error) {
    console.error('Error sending creator feedback email:', error);
    return createErrorResponse(error, 'creator_feedback');
  }
};

// Send Automated SetuCoins Transaction Notification Email
export const sendCoinTransactionNotificationEmail = async (email, username, transaction, referralCode) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const unsubscribeUrl = getUnsubscribeUrl(email);
  const isCredit = transaction.type === 'credit';

  // Helper to format source category beautifully
  const getSourceLabel = (source) => {
    const sources = {
      signup_bonus: "Welcome Signup Bonus 🎁",
      profile_completion: "Profile Completion Reward 👤",
      rent_payment: "Rent Payment Cash-back 🏠",
      rent_streak_bonus: "Rent Streak Achievement 🔥",
      review_reward: "Rental Experience Review ⭐",
      referral: "Friend Referral Reward 🤝",
      payment_reward: "Payment Reward 💳",
      admin_adjustment: "SetuCoins Adjustment 🛠️",
      redemption_rent_fee: "Rent Discount Redemption 📉",
      redemption_coupon: "Gift Coupon Redemption 🎫",
      monthly_leaderboard_reward: "Leaderboard Championship Bonus 🏆",
      other: "Loyalty Program Reward 🌟"
    };
    return sources[source] || "SetuCoins Transaction 🪙";
  };

  let sourceLabel = getSourceLabel(transaction.source);
  if (transaction.source === 'other' && transaction.description && transaction.description.toLowerCase().includes('expire')) {
    sourceLabel = "Coins Expired ❄️";
  }

  const referralUrl = referralCode
    ? `${clientBaseUrl}/sign-up?ref=${referralCode}`
    : `${clientBaseUrl}/sign-up`;

  const historyUrl = `${clientBaseUrl}/user/rewards?tab=history`;

  const mailtoSubject = encodeURIComponent("Join me on UrbanSetu and get 50 SetuCoins! 🎁");
  const mailtoBody = encodeURIComponent(
    `Hey!\n\n` +
    `I've been using UrbanSetu for managing my rentals and payments, and it's been amazing! 🚀\n\n` +
    `I want to invite you to join the community. If you sign up using my referral link, you'll immediately get a welcome bonus of 50 SetuCoins (which you can redeem for real discounts on monthly rent or home services!):\n\n` +
    `👉 ${referralUrl}\n\n` +
    (referralCode ? `🎁 Or use my referral code: ${referralCode}\n\n` : '') +
    `Let's get rewarded together!\n`
  );
  const mailtoUrl = `mailto:?subject=${mailtoSubject}&body=${mailtoBody}`;

  const themeColor = isCredit ? '#eab308' : '#6366f1'; // Gold for credit, Indigo for debit
  const headerBg = isCredit 
    ? 'linear-gradient(135deg, #fef08a 0%, #fde047 100%)' 
    : 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)';
  const titleColor = isCredit ? '#854d0e' : '#3730a3';
  const badgeBg = isCredit ? '#fef9c3' : '#e0e7ff';
  const amountColor = isCredit ? '#ca8a04' : '#4f46e5';

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: isCredit 
      ? `✨ +${transaction.amount} SetuCoins Earned! - UrbanSetu Loyalty`
      : `💎 SetuCoins Account Update: -${transaction.amount} Redeemed - UrbanSetu`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SetuCoins Update</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05); overflow: hidden; border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <div style="background: ${headerBg}; padding: 35px 30px; text-align: center; border-bottom: 1px solid #e2e8f0;">
            <div style="font-size: 55px; margin-bottom: 10px; display: inline-block;">${isCredit ? '✨🪙✨' : '💎💸💎'}</div>
            <h1 style="color: ${titleColor}; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">
              ${isCredit ? 'SetuCoins Credited!' : 'SetuCoins Debited!'}
            </h1>
            <p style="color: ${isCredit ? '#713f12' : '#312e81'}; margin: 8px 0 0 0; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">
              UrbanSetu Loyalty Program
            </p>
          </div>
          
          <!-- Main Content -->
          <div style="padding: 30px;">
            <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
              Hello <strong>${username}</strong>,
            </p>
            <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 25px 0;">
              Your SetuCoins loyalty account has been updated with a new transaction. Below are the full details of this activity.
            </p>
            
            <!-- Transaction Card -->
            <div style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; padding: 25px; margin-bottom: 30px;">
              <div style="text-align: center; margin-bottom: 25px;">
                <div style="display: inline-block; background-color: ${badgeBg}; border-radius: 9999px; padding: 12px 30px; border: 1px solid ${themeColor}20;">
                  <span style="font-size: 30px; font-weight: 900; color: ${amountColor};">
                    ${isCredit ? `+${transaction.amount}` : `-${transaction.amount}`}
                  </span>
                  <span style="font-size: 15px; font-weight: 700; color: ${isCredit ? '#854d0e' : '#3730a3'}; margin-left: 5px;">SetuCoins</span>
                </div>
              </div>
              
              <!-- Details Table -->
              <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #334155;">
                <tr>
                  <td style="padding: 10px 0; font-weight: 600; color: #64748b; width: 35%;">Transaction ID</td>
                  <td style="padding: 10px 0; font-family: monospace; font-weight: bold; color: #1e293b;">${transaction._id}</td>
                </tr>
                <tr style="border-top: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; font-weight: 600; color: #64748b;">Type</td>
                  <td style="padding: 10px 0; font-weight: bold; color: ${isCredit ? '#15803d' : '#be123c'};">
                    ${isCredit ? 'Earned & Deposited' : 'Redeemed & Deducted'}
                  </td>
                </tr>
                <tr style="border-top: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; font-weight: 600; color: #64748b;">Activity Type</td>
                  <td style="padding: 10px 0; font-weight: 600; color: #0f172a;">${sourceLabel}</td>
                </tr>
                <tr style="border-top: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; font-weight: 600; color: #64748b;">Description</td>
                  <td style="padding: 10px 0; line-height: 1.4; color: #334155;">${transaction.description || 'N/A'}</td>
                </tr>
                <tr style="border-top: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; font-weight: 600; color: #64748b;">Date & Time</td>
                  <td style="padding: 10px 0; color: #334155;">${formatIndiaTime(transaction.createdAt || new Date())}</td>
                </tr>
                ${isCredit ? `
                <tr style="border-top: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; font-weight: 600; color: #64748b;">Expiry Date</td>
                  <td style="padding: 10px 0; color: #e11d48; font-weight: 600;">
                    ${transaction.expiryDate ? formatIndiaTime(transaction.expiryDate) : 'Never Expires'}
                  </td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            <!-- Live Balance Callout -->
            <div style="background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border-radius: 12px; border: 1px solid #e9d5ff; padding: 20px; text-align: center; margin-bottom: 30px;">
              <span style="font-size: 14px; color: #6b21a8; font-weight: 600; display: block; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Current Available Balance</span>
              <span style="font-size: 28px; font-weight: 800; color: #581c87; font-family: monospace;">
                ${transaction.balanceAfter || 0} SetuCoins
              </span>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin-bottom: 40px;">
              <a href="${historyUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 10px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);">
                📂 View Rewards History
              </a>
            </div>
            
            <!-- Referral Block -->
            <div style="border: 2px dashed #cbd5e1; border-radius: 16px; background-color: #f8fafc; padding: 22px; text-align: center;">
              <div style="font-size: 24px; margin-bottom: 5px;">🤝🎁</div>
              <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 16px; font-weight: 700;">Earn More SetuCoins!</h3>
              <p style="margin: 0 0 15px 0; font-size: 13px; color: #475569; line-height: 1.5;">
                Invite your friends to <strong>UrbanSetu</strong>! Share your unique referral link below and earn <strong style="color: #ca8a04;">100 SetuCoins</strong> when they sign up and make a payment. Plus, they get <strong style="color: #16a34a;">50 SetuCoins</strong> as a welcome bonus!
              </p>
              
              <!-- Link Display Box -->
              <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; font-family: monospace; font-size: 13px; color: #2563eb; font-weight: bold; overflow-x: auto; white-space: nowrap; margin-bottom: 12px;">
                ${referralUrl}
              </div>
              
              <a href="${mailtoUrl}" style="font-size: 13px; font-weight: 700; color: #4f46e5; text-decoration: none; display: inline-block; border-bottom: 1px solid #4f46e5;">
                Share Referral Link &rarr;
              </a>
            </div>
            
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 25px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0; line-height: 1.6;">
              This is an automated transaction notification from your UrbanSetu Loyalty Account.
            </p>
            <p style="margin: 0 0 8px 0; font-size: 12px;">
              <a href="${clientBaseUrl}/terms" style="color: #64748b; text-decoration: underline;">Loyalty Terms</a>
              &nbsp;·&nbsp;
              <a href="${clientBaseUrl}/privacy" style="color: #64748b; text-decoration: underline;">Privacy Policy</a>
            </p>
            <p style="color: #94a3b8; margin: 0 0 8px 0; font-size: 11px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
            <p style="margin: 0; color: #94a3b8; font-size: 11px;">
              Don't want to receive these emails? 
              <a href="${unsubscribeUrl}" style="color: #94a3b8; text-decoration: underline;">Unsubscribe</a> from transaction alerts.
            </p>
          </div>
          
        </div>
      </body>
      </html>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions, 3, 1000, 'essential');
    return result.success ?
      createSuccessResponse(result.messageId, 'coin_transaction_notification') :
      createErrorResponse(new Error(result.error), 'coin_transaction_notification');
  } catch (error) {
    console.error('Error sending coin transaction notification email:', error);
    return createErrorResponse(error, 'coin_transaction_notification');
  }
};

// Send Chat Locked Email
export const sendChatLockedEmail = async (email, username, appointmentId, otherPartyName, propertyName) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const chatLink = `${clientBaseUrl}/user/my-appointments/chat/${appointmentId}?chatopen=true`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your Chat has been Locked - UrbanSetu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Chat Lock Activation</p>
          </div>
          
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Chat Locked Successfully</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Hello ${username || 'User'},
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              This email confirms that you have successfully set a password lock on the chat conversation for the property appointment <strong>"${propertyName || 'N/A'}"</strong> between you and <strong>${otherPartyName || 'the other party'}</strong>.
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              <strong>Chat Status Details:</strong><br>
              • <strong>Property Name:</strong> ${propertyName || 'N/A'}<br>
              • <strong>Status:</strong> Password Locked 🔒<br>
              • <strong>Connected Party:</strong> ${otherPartyName || 'the other party'}
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              To access and read this chat in the future, you will need to input the password you just created.
            </p>
            
            <div style="text-align: center; margin: 25px 0;">
              <a href="${chatLink}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 16px;">Access Locked Chat</a>
            </div>

            <p style="color: #6b7280; margin: 15px 0 0 0; font-size: 14px;">
              <strong>Note:</strong> This chat lock password is separate from your main account login password. If you forget your chat lock password, you can reset it by validating your main account login password.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved. • <a href="${clientBaseUrl}/privacy" style="color: #9ca3af; text-decoration: underline;">Privacy</a>
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions, 3, 1000, 'essential');
    return result.success ?
      createSuccessResponse(result.messageId, 'chat_locked_email') :
      createErrorResponse(new Error(result.error), 'chat_locked_email');
  } catch (error) {
    console.error('Error sending chat locked email:', error);
    return createErrorResponse(error, 'chat_locked_email');
  }
};

// Send Reminder Notification Email
export const sendReminderNotificationEmail = async (email, { taskText, time, username }) => {
  const clientBaseUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
  const formattedTime = new Date(time).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `⏰ Reminder: ${taskText.substring(0, 40)}${taskText.length > 40 ? '...' : ''}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; width: 64px; height: 64px; background-color: #eef2ff; border-radius: 50%; line-height: 64px; text-align: center; margin-bottom: 15px;">
              <span style="font-size: 32px;">⏰</span>
            </div>
            <h1 style="color: #6366f1; margin: 0; font-size: 28px;">UrbanSetu</h1>
            <p style="color: #6b7280; margin: 5px 0 0 0; font-weight: bold; letter-spacing: 0.5px;">AI Task Reminder</p>
          </div>
          
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #6366f1;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Task Reminder!</h2>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              Hello ${username || 'User'},
            </p>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              This is a scheduled reminder for your task:
            </p>
            <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #e5e7eb; font-size: 16px; color: #1f2937; line-height: 1.6; font-weight: bold;">
              "${taskText}"
            </div>
            <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
              • <strong>Scheduled For:</strong> ${formattedTime}
            </p>
            
            <div style="text-align: center; margin: 25px 0;">
              <a href="${clientBaseUrl}/user/ai" style="display: inline-block; background-color: #6366f1; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 15px; margin: 5px;">Open SetuAI Assistant</a>
              <a href="${clientBaseUrl}/user/reminders" style="display: inline-block; background-color: #4f46e5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 15px; margin: 5px;">Manage My Reminders</a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} UrbanSetu. All rights reserved. • <a href="${clientBaseUrl}/privacy" style="color: #9ca3af; text-decoration: underline;">Privacy</a>
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await sendEmailWithRetry(mailOptions, 3, 1000, 'essential');
    return result.success ?
      createSuccessResponse(result.messageId, 'reminder_notification_email') :
      createErrorResponse(new Error(result.error), 'reminder_notification_email');
  } catch (error) {
    console.error('Error sending reminder notification email:', error);
    return createErrorResponse(error, 'reminder_notification_email');
  }
};



