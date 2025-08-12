import nodemailer from 'nodemailer';

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Generate OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
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
              © 2024 UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
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
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
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
              © 2024 UrbanSetu. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Legacy function for backward compatibility (deprecated)
export const sendOTPEmail = async (email, otp) => {
  console.warn('sendOTPEmail is deprecated. Use sendSignupOTPEmail or sendForgotPasswordOTPEmail instead.');
  return await sendSignupOTPEmail(email, otp);
};

export default transporter;