import User from "../models/user.model.js";
import bcryptjs from "bcryptjs";
import { errorHandler } from "../utils/error.js";
import jwt from 'jsonwebtoken'
import { generateOTP, sendSignupOTPEmail,sendLoginOTPEmail } from "../utils/emailService.js";
import { generateTokenPair, setSecureCookies, clearAuthCookies } from "../utils/jwtUtils.js";
import { trackFailedAttempt, clearFailedAttempts, logSecurityEvent, sendAdminAlert, isAccountLocked, checkSuspiciousLogin, checkSuspiciousSignup } from "../middleware/security.js";
import { createSession, updateSessionActivity, detectConcurrentLogins, cleanupOldSessions } from "../utils/sessionManager.js";

export const SignUp=async (req,res,next)=>{
    const {username,email,password,role,mobileNumber,address,emailVerified}=req.body;
    const emailLower = email.toLowerCase();
    
    // Validate mobile number
    if (!mobileNumber || !/^[0-9]{10}$/.test(mobileNumber)) {
        return next(errorHandler(400, "Please provide a valid 10-digit mobile number"));
    }
    
    // Validate address (optional but if provided, should not be empty)
    if (address && address.trim().length === 0) {
        return next(errorHandler(400, "Please provide a valid address"));
    }
    
    // Check if email is verified
    if (!emailVerified) {
        return next(errorHandler(400, "Please verify your email address before creating an account"));
    }
    
    try {
        // Check if email already exists
        const existingEmail = await User.findOne({ email: emailLower });
        if (existingEmail) {
            logSecurityEvent('duplicate_signup_attempt', { email: emailLower, reason: 'email_exists' });
            return next(errorHandler(400, "An account with this email already exists. Please sign in instead!"));
        }
        
        // Check if mobile number already exists
        const existingMobile = await User.findOne({ mobileNumber });
        if (existingMobile) {
            logSecurityEvent('duplicate_signup_attempt', { email: emailLower, mobileNumber, reason: 'mobile_exists' });
            return next(errorHandler(400, "An account with this mobile number already exists. Try signing in or use a different number."));
        }
        
        const hashedPassword=bcryptjs.hashSync(password,10)
        
        // Set admin approval status based on role
        const adminApprovalStatus = role === "admin" ? "pending" : "approved";
        
        const newUser=new User({
            username,
            email: emailLower,
            password:hashedPassword,
            mobileNumber,
            address: address ? address.trim() : undefined,
            role,
            adminApprovalStatus
        })
        
        await newUser.save();
        
        // Check for suspicious signup patterns
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');
        checkSuspiciousSignup(emailLower, ip, userAgent);
        
        // Log successful signup
        logSecurityEvent('successful_signup', { 
            email: emailLower, 
            userId: newUser._id,
            role: newUser.role,
            ip
        });
        
        if (role === "admin") {
            res.status(201).json({
                message: "Admin account created successfully. Please wait for approval from an existing admin.",
                requiresApproval: true
            });
        } else {
            res.status(201).json({
                message: "User added successfully",
                requiresApproval: false
            });
        }
    }
    catch(error){ 
       console.error(error);
       next(error)
    }
}

export const SignIn=async(req,res,next)=>{
    const {email,password}=req.body 
    const emailLower = email.toLowerCase();
    const identifier = req.ip || req.connection.remoteAddress;
    
    try{
        const validUser=await User.findOne({email: emailLower})
        if (!validUser){
            // Track failed attempt
            trackFailedAttempt(identifier);
            logSecurityEvent('failed_login', { email: emailLower, reason: 'user_not_found' });
            return next(errorHandler(401,"Invalid credentials"))
        }
        
        // Check if account is locked
        if (isAccountLocked(validUser._id)) {
            logSecurityEvent('account_locked_attempt', { email: emailLower, userId: validUser._id });
            return next(errorHandler(423, "Account is temporarily locked due to too many failed attempts. Please try again later."));
        }
        
        if (validUser.status === 'suspended') {
            logSecurityEvent('suspended_account_attempt', { email: emailLower, userId: validUser._id });
            return next(errorHandler(403, "Your account is suspended. Please contact support."));
        }
        
        const validPassword=await bcryptjs.compareSync(password,validUser.password)
        if (!validPassword){
            // Track failed attempt
            trackFailedAttempt(identifier, validUser._id);
            logSecurityEvent('failed_login', { email: emailLower, userId: validUser._id, reason: 'invalid_password' });
            return next(errorHandler(401,"Invalid credentials"))
        }
        
        // Check if admin account is pending approval
        if (validUser.role === "admin" && validUser.adminApprovalStatus === "pending") {
            return next(errorHandler(403, "Your admin account is pending approval. Please wait for an existing admin to approve your request."));
        }
        
        // Check if admin account was rejected
        if (validUser.role === "admin" && validUser.adminApprovalStatus === "rejected") {
            return next(errorHandler(403, "Your admin account request has been rejected. Please contact support for more information."));
        }
        
        // Clear failed attempts on successful login
        clearFailedAttempts(identifier);
        
        // Check for suspicious login patterns
        const userAgent = req.get('User-Agent');
        checkSuspiciousLogin(validUser._id, identifier, userAgent);
        
        // Create new session
        const session = createSession(validUser._id, req);
        
        // Check for concurrent logins
        const concurrentInfo = detectConcurrentLogins(validUser._id, session.sessionId);
        
        // Clean up old sessions (keep only last 5)
        cleanupOldSessions(validUser._id);
        
        // Log successful login
        logSecurityEvent('successful_login', { 
            email: emailLower, 
            userId: validUser._id,
            ip: identifier,
            userAgent,
            sessionId: session.sessionId,
            concurrentLogins: concurrentInfo.activeSessions
        });
        
        // Generate token pair
        const { accessToken, refreshToken } = generateTokenPair({ id: validUser._id });
        
        // Set secure cookies
        setSecureCookies(res, accessToken, refreshToken);
        
        res.status(200).json({
            _id: validUser._id,
            username: validUser.username,
            email: validUser.email,
            role: validUser.role,
            isDefaultAdmin: validUser.isDefaultAdmin,
            adminApprovalStatus: validUser.adminApprovalStatus,
            status: validUser.status,
            avatar: validUser.avatar,
            mobileNumber: validUser.mobileNumber,
            address: validUser.address,
            gender: validUser.gender,
            token: accessToken, // Keep for backward compatibility
        });
    }
    catch(error){
        console.error(error);
        next(error)
    }
}

export const Google=async (req,res,next)=>{
    try{
        const {name,email,photo}=req.body 
        const validUser=await User.findOne({email})
        if (validUser){
            // Suspension check
            if (validUser.status === 'suspended') {
                return next(errorHandler(403, "Your account is suspended. Please contact support."));
            }
            // Generate token pair
            const { accessToken, refreshToken } = generateTokenPair({ id: validUser._id });
            
            // Set secure cookies
            setSecureCookies(res, accessToken, refreshToken);
            
            res.status(200).json({
                _id: validUser._id,
                username: validUser.username,
                email: validUser.email,
                role: validUser.role,
                isDefaultAdmin: validUser.isDefaultAdmin,
                adminApprovalStatus: validUser.adminApprovalStatus,
                status: validUser.status,
                avatar: validUser.avatar,
                mobileNumber: validUser.mobileNumber,
                address: validUser.address,
                gender: validUser.gender,
                token: accessToken, // Keep for backward compatibility
            });
        }
        else{
            const generatedPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcryptjs.hashSync(generatedPassword,10);
            // Generate a random unique mobile number for Google signup
            let mobileNumber;
            let isUnique = false;
            let attempts = 0;
            const maxAttempts = 10; // Prevent infinite loop
            while (!isUnique && attempts < maxAttempts) {
                // Generate a random 10-digit number starting with 9 (to avoid conflicts with real numbers)
                mobileNumber = "9" + Math.random().toString().slice(2, 11);
                // Check if this mobile number already exists
                const existingUser = await User.findOne({ mobileNumber });
                if (!existingUser) {
                    isUnique = true;
                }
                attempts++;
            }
            // If we couldn't find a unique number after max attempts, use timestamp-based number
            if (!isUnique) {
                const timestamp = Date.now().toString();
                mobileNumber = "9" + timestamp.slice(-9);
            }
            const newUser=new User({
                username:name.split(" ").join("").toLowerCase()+Math.random().toString(36).slice(-8),
                email,
                password:hashedPassword,
                avatar:photo,
                mobileNumber: mobileNumber,
                isGeneratedMobile: true
            })
            await newUser.save()
            
            // Generate token pair
            const { accessToken, refreshToken } = generateTokenPair({ id: newUser._id });
            
            // Set secure cookies
            setSecureCookies(res, accessToken, refreshToken);
            
            res.status(200).json({
                _id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role,
                isDefaultAdmin: newUser.isDefaultAdmin,
                adminApprovalStatus: newUser.adminApprovalStatus,
                status: newUser.status,
                avatar: newUser.avatar,
                mobileNumber: newUser.mobileNumber,
                isGeneratedMobile: newUser.isGeneratedMobile,
                address: newUser.address,
                gender: newUser.gender,
                token: accessToken, // Keep for backward compatibility
            });
        }
    }
    catch(error){
        console.error(error);
        next(error)
    }
}


export const Signout = async (req, res, next) => {
    try {
      clearAuthCookies(res);
      res.status(200).json('User has been logged out!');
    } catch (error) {
      next(error);
    }
  };

export const verifyAuth = async (req, res, next) => {
    try {
        const accessToken = req.cookies.access_token;
        const refreshToken = req.cookies.refresh_token;
        
        if (!accessToken && !refreshToken) {
            return next(errorHandler(401, "No authentication tokens found"));
        }
        
        let decoded;
        
        try {
            // Try to verify access token first
            decoded = jwt.verify(accessToken, process.env.JWT_TOKEN, {
                issuer: 'urbansetu',
                audience: 'urbansetu-users'
            });
        } catch (accessError) {
            // If access token is invalid or expired, try refresh token
            if (accessError.name === 'TokenExpiredError' && refreshToken) {
                try {
                    const refreshDecoded = jwt.verify(refreshToken, process.env.JWT_TOKEN, {
                        issuer: 'urbansetu',
                        audience: 'urbansetu-refresh'
                    });
                    
                    // Generate new token pair
                    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokenPair({ id: refreshDecoded.id });
                    
                    // Set new cookies
                    setSecureCookies(res, newAccessToken, newRefreshToken);
                    
                    decoded = refreshDecoded;
                } catch (refreshError) {
                    return next(errorHandler(401, "Session expired. Please sign in again."));
                }
            } else {
                return next(errorHandler(401, "Invalid token"));
            }
        }
        
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return next(errorHandler(404, "User not found"));
        }
        
        res.status(200).json(user);
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return next(errorHandler(401, "Invalid token"));
        }
        if (error.name === 'TokenExpiredError') {
            return next(errorHandler(401, "Token expired"));
        }
        next(error);
    }
};

// Store for password reset tokens (in production, use Redis)
const resetTokenStore = new Map();

// Clean up expired reset tokens every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of resetTokenStore.entries()) {
        if (now > data.expiresAt) {
            resetTokenStore.delete(token);
        }
    }
}, 5 * 60 * 1000);

// Forgot Password - Verify email only (mobile number verification removed)
export const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return next(errorHandler(400, "Email is required"));
        }
        
        const emailLower = email.toLowerCase();
        // Find user with matching email
        const user = await User.findOne({ email: emailLower });
        
        if (user) {
            // Generate reset token (30 minutes expiry)
            const resetToken = jwt.sign(
                { 
                    id: user._id, 
                    email: emailLower,
                    type: 'password_reset'
                }, 
                process.env.JWT_TOKEN, 
                { expiresIn: '30m' }
            );
            
            // Store reset token with expiration
            resetTokenStore.set(resetToken, {
                userId: user._id,
                email: emailLower,
                expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
                used: false
            });
            
            // TODO: Send reset email with token
            // For now, we'll just return success
        }
        
        // Always return success message to prevent email enumeration
        res.status(200).json({ 
            message: "If this email exists, we sent instructions.",
            success: true
        });
    } catch (error) {
        next(error);
    }
};

// Reset Password
export const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword, confirmPassword } = req.body;
        
        if (!token || !newPassword || !confirmPassword) {
            return next(errorHandler(400, "All fields are required"));
        }
        
        if (newPassword !== confirmPassword) {
            return next(errorHandler(400, "Passwords do not match"));
        }
        
        // Validate password strength
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return next(errorHandler(400, "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"));
        }
        
        // Verify reset token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_TOKEN);
            if (decoded.type !== 'password_reset') {
                return next(errorHandler(400, "Invalid token type"));
            }
        } catch (error) {
            return next(errorHandler(400, "Invalid or expired reset token"));
        }
        
        // Check if token exists in store and is not used
        const tokenData = resetTokenStore.get(token);
        if (!tokenData || tokenData.used) {
            return next(errorHandler(400, "Invalid or expired reset token"));
        }
        
        // Check if token is expired
        if (Date.now() > tokenData.expiresAt) {
            resetTokenStore.delete(token);
            return next(errorHandler(400, "Reset token has expired"));
        }
        
        // Find user by ID
        const user = await User.findById(tokenData.userId);
        
        if (!user) {
            return next(errorHandler(404, "User not found"));
        }
        
        // Check if new password is different from current password
        const isSamePassword = await bcryptjs.compare(newPassword, user.password);
        if (isSamePassword) {
            return next(errorHandler(400, "New password must be different from current password"));
        }
        
        // Update password
        user.password = bcryptjs.hashSync(newPassword, 10);
        await user.save();
        
        // Mark token as used
        resetTokenStore.delete(token);
        
        res.status(200).json({ 
            message: "Password reset successful. You can now log in.",
            success: true
        });
    } catch (error) {
        next(error);
    }
};

// Store OTPs temporarily for login (in production, use Redis or database)
const loginOtpStore = new Map();

// Send OTP for login
export const sendLoginOTP = async (req, res, next) => {
    const { email } = req.body;
    
    if (!email) {
        return next(errorHandler(400, "Email is required"));
    }

    const emailLower = email.toLowerCase();

    try {
        // Check if user exists with the email
        const user = await User.findOne({ email: emailLower });
        if (!user) {
            return res.status(200).json({
                success: true,
                message: "If this email exists, we sent instructions."
            });
        }

        // Generate OTP
        const otp = generateOTP();
        
        // Store OTP with expiration (10 minutes)
        const expirationTime = Date.now() + 10 * 60 * 1000; // 10 minutes
        loginOtpStore.set(emailLower, {
            otp,
            expirationTime,
            attempts: 0,
            userId: user._id
        });

        // Send OTP email for login
        const emailResult = await sendLoginOTPEmail(emailLower, otp);
        
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
        console.error('Send login OTP error:', error);
        next(error);
    }
};

// Verify OTP and login
export const verifyLoginOTP = async (req, res, next) => {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
        return next(errorHandler(400, "Email and OTP are required"));
    }

    const emailLower = email.toLowerCase();

    try {
        // Get stored OTP data
        const storedData = loginOtpStore.get(emailLower);
        
        if (!storedData) {
            return res.status(400).json({
                success: false,
                message: "OTP expired or not found. Please request a new OTP."
            });
        }

        // Check if OTP is expired
        if (Date.now() > storedData.expirationTime) {
            loginOtpStore.delete(emailLower);
            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new OTP."
            });
        }

        // Check if too many attempts
        if (storedData.attempts >= 3) {
            loginOtpStore.delete(emailLower);
            return res.status(400).json({
                success: false,
                message: "Too many failed attempts. Please request a new OTP."
            });
        }

        // Verify OTP
        if (storedData.otp !== otp) {
            storedData.attempts += 1;
            loginOtpStore.set(emailLower, storedData);
            
            return res.status(400).json({
                success: false,
                message: "Invalid OTP. Please try again."
            });
        }

        // OTP is valid, get user and create session
        const user = await User.findById(storedData.userId).select('-password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Check if user is approved
        if (user.adminApprovalStatus !== 'approved') {
            return res.status(403).json({
                success: false,
                message: "Your account is pending approval. Please contact support."
            });
        }

        // Check if user is suspended
        if (user.status === 'suspended') {
            return res.status(403).json({
                success: false,
                message: "Your account has been suspended. Please contact support."
            });
        }

        // Generate token pair
        const { accessToken, refreshToken } = generateTokenPair({ id: user._id });
        
        // Clear OTP from store
        loginOtpStore.delete(emailLower);

        // Set secure cookies
        setSecureCookies(res, accessToken, refreshToken);

        res.status(200).json({
            success: true,
            message: "Login successful",
            token: accessToken, // Keep for backward compatibility
            role: user.role,
            isDefaultAdmin: user.isDefaultAdmin,
            adminApprovalStatus: user.adminApprovalStatus,
            status: user.status,
            avatar: user.avatar,
            mobileNumber: user.mobileNumber,
            isGeneratedMobile: user.isGeneratedMobile,
            address: user.address,
            gender: user.gender,
            username: user.username,
            email: user.email
        });

    } catch (error) {
        console.error('Verify login OTP error:', error);
        next(error);
    }
};

// Clean up expired login OTPs periodically
setInterval(() => {
    const now = Date.now();
    for (const [email, data] of loginOtpStore.entries()) {
        if (now > data.expirationTime) {
            loginOtpStore.delete(email);
        }
    }
}, 5 * 60 * 1000); // Clean up every 5 minutes
