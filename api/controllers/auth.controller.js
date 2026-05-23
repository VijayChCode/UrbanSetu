import User from "../models/user.model.js";
import PasswordLockout from "../models/passwordLockout.model.js";
import bcryptjs from "bcryptjs";
import crypto from 'crypto';
import { errorHandler } from "../utils/error.js";
import jwt from 'jsonwebtoken'
import { generateOTP, sendSignupOTPEmail, sendLoginOTPEmail, sendPasswordResetSuccessEmail, sendPasswordChangeSuccessEmail, sendWelcomeEmail, sendReferralBonusEmail, sendReferredWelcomeEmail } from "../utils/emailService.js";
import { generateTokenPair, setSecureCookies, clearAuthCookies, verifyRefreshToken, generateAccessToken } from "../utils/jwtUtils.js";
import { trackFailedAttempt, clearFailedAttempts, logSecurityEvent, sendAdminAlert, isAccountLocked, checkSuspiciousSignup, getAccountLockRemainingMs } from "../middleware/security.js";
import {
    createEnhancedSession,
    updateSessionActivity,
    detectConcurrentLogins,
    cleanupOldSessions,
    checkSuspiciousLogin,
    enforceSessionLimits,
    logSessionAction,
    revokeSessionFromDB
} from "../utils/sessionManager.js";
import { sendNewLoginEmail, sendSuspiciousLoginEmail, sendAccountLockoutEmail, sendAccountLockedEmail, sendAccountUnlockedEmail, sendPermanentPurgeEmail } from "../utils/emailService.js";

import OtpTracking from "../models/otpTracking.model.js";
import DeletedAccount from "../models/deletedAccount.model.js";
import AccountRevocation from "../models/accountRevocation.model.js";
import { validateEmail } from "../utils/emailValidation.js";
import { getDeviceInfo, getLocationFromIP } from "../utils/sessionManager.js";
import SentinelSecurityService from "../services/SentinelSecurityService.js";

export const SignUp = async (req, res, next) => {
    const { username, email, password, role, mobileNumber, address, emailVerified } = req.body;
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

    // Validate email. If email is OTP-verified on the client, allow signup with basic format validation only.
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!basicEmailRegex.test(emailLower)) {
        return next(errorHandler(400, 'Please enter a valid email address'));
    }

    // Only run fraud/disposable checks when email is not OTP-verified
    if (!emailVerified) {
        const emailValidation = validateEmail(email, {
            logSecurity: true,
            context: 'signup',
            ip,
            userAgent
        });

        if (!emailValidation.isValid) {
            // Log fraud attempt for security monitoring
            if (emailValidation.isFraud) {
                logSecurityEvent('fraud_email_signup_attempt', {
                    email: emailLower,
                    reason: emailValidation.reason,
                    ip,
                    userAgent,
                    username
                });
            }
            return next(errorHandler(400, emailValidation.message));
        }
    } else {
        // Informational log that fraud checks were skipped due to verified email
        logSecurityEvent('signup_email_verified_skip_fraud_checks', {
            email: emailLower,
            ip,
            userAgent,
            context: 'signup'
        });
    }

    try {
        // Check softban/purge policy before allowing signup
        const existingSoftban = await DeletedAccount.findOne({ email: emailLower });
        if (existingSoftban) {
            const policy = existingSoftban.policy || {};
            // Purged? If purged and banType is 'ban', block permanently
            if (existingSoftban.purgedAt && policy.banType === 'ban') {
                return next(errorHandler(403, "This account was permanently removed and cannot be used to sign up again."));
            }
            // If explicit ban
            if (policy.banType === 'ban') {
                return next(errorHandler(403, "This account has been permanently banned due to policy violations. Please contact support if you believe this is a mistake."));
            }
            // If allowed but with cooling-off period
            if (!existingSoftban.purgedAt && typeof policy.allowResignupAfterDays === 'number' && policy.allowResignupAfterDays > 0) {
                const allowAfter = new Date(existingSoftban.deletedAt.getTime() + policy.allowResignupAfterDays * 24 * 60 * 60 * 1000);
                if (new Date() < allowAfter) {
                    const daysLeft = Math.ceil((allowAfter.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                    return next(errorHandler(403, `Please wait ${daysLeft} more day(s) before signing up again.`));
                }
            }
            // If the deleted account is still in the 30-day grace period and has an active
            // revocation token, show the mediator page to let the user choose between
            // restoring their previous account or starting fresh.
            // NOTE: This MUST run before contextual messages, otherwise 'requested_by_user'
            // and 'inactive_auto' policies would block users from ever seeing the conflict page.
            if (!existingSoftban.purgedAt && !req.body.forceCreate) {
                const activeRevocation = await AccountRevocation.findOne({
                    email: emailLower,
                    isUsed: false,
                    expiresAt: { $gt: new Date() }
                });

                if (activeRevocation) {
                    // Generate a temporary token for data export
                    const conflictToken = jwt.sign(
                        { email: emailLower, conflictId: activeRevocation._id, purpose: 'conflict_resolution' },
                        process.env.JWT_TOKEN,
                        { expiresIn: '1h' }
                    );

                    return res.status(409).json({
                        deletedAccountFound: true,
                        conflictToken,
                        deletedAccountData: {
                            username: activeRevocation.username,
                            email: activeRevocation.email,
                            role: activeRevocation.role,
                            deletedAt: activeRevocation.deletedAt,
                            expiresAt: activeRevocation.expiresAt,
                            daysRemaining: Math.max(0, Math.ceil((new Date(activeRevocation.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
                        }
                    });
                }
            }

            // Show contextual messages (only reached when no active revocation token exists)
            if (policy.category === 'inactive_auto') {
                return next(errorHandler(403, "This account was deactivated due to long inactivity. You may create a new account or contact support to restore."));
            }
            if (policy.category === 'requested_by_user') {
                return next(errorHandler(403, "This account was deleted at your request. You may sign up again anytime."));
            }

            // If forceCreate is set, purge the old deleted account and expire all revocation tokens
            if (req.body.forceCreate && !existingSoftban.purgedAt) {
                // Fetch revocation details before expiring them to use in the email
                const activeRevocation = await AccountRevocation.findOne({
                    email: emailLower,
                    isUsed: false
                });

                existingSoftban.purgedAt = new Date();
                existingSoftban.purgedBy = 'signup_replacement';
                await existingSoftban.save();

                await AccountRevocation.updateMany(
                    { email: emailLower, isUsed: false },
                    { $set: { isUsed: true, usedAt: new Date(), restoredBy: 'expired_by_new_signup' } }
                );

                // Send permanent purge notification email
                try {
                    await sendPermanentPurgeEmail(emailLower, activeRevocation?.username || 'User', new Date());
                } catch (emailError) {
                    console.error(`❌ Failed to send permanent purge email:`, emailError);
                }
            }
            // Otherwise allow signup to proceed (non-banned)
        }
        // Validate username length (minimum 5 characters)
        if (!username || username.trim().length < 5) {
            return next(errorHandler(400, "Username must be at least 5 characters long."));
        }

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

        const hashedPassword = bcryptjs.hashSync(password, 10)

        // Set admin approval status based on role
        const adminApprovalStatus = role === "admin" ? "pending" : "approved";

        // Resolve referral code to referredBy userId if referralCode was sent
        let resolvedReferredBy = req.body.referredBy || null;
        if (!resolvedReferredBy && req.body.referralCode) {
            const referrer = await User.findOne({ 'gamification.referralCode': req.body.referralCode.toUpperCase() }).select('_id');
            if (referrer) {
                resolvedReferredBy = referrer._id.toString();
            }
        }

        const newUser = new User({
            username,
            email: emailLower,
            password: hashedPassword,
            mobileNumber,
            address: address ? address.trim() : undefined,
            role,
            adminApprovalStatus,
            'gamification.referredBy': resolvedReferredBy
        })

        await newUser.save();

        // Handle Referral Reward (Both Sides)
        if (resolvedReferredBy) {
            try {
                const CoinService = (await import("../services/coinService.js")).default;
                const FraudDetectionService = (await import("../services/fraudDetectionService.js")).default;

                // 🔍 Intelligent Fraud Detection Check
                const fraudCheck = await FraudDetectionService.checkReferralFraud(resolvedReferredBy, newUser._id);

                if (fraudCheck.isFraud) {
                    console.log(`⛔ Referral reward BLOCKED due to fraud detection: ${fraudCheck.reason}`);
                    // We simply skip the reward. The service has already logged the event and admin alert.
                } else {
                    const referrer = await User.findById(resolvedReferredBy);

                    if (referrer) {
                        // Credit Referrer (100 Coins)
                        await CoinService.credit({
                            userId: referrer._id,
                            amount: 100,
                            source: 'referral',
                            referenceId: newUser._id,
                            referenceModel: 'User',
                            description: `Referral bonus for inviting ${newUser.username}`
                        });

                        // Credit Joiner (50 Coins)
                        await CoinService.credit({
                            userId: newUser._id,
                            amount: 50,
                            source: 'referral',
                            referenceId: referrer._id,
                            referenceModel: 'User',
                            description: `Welcome bonus for joining via ${referrer.username}'s referral`
                        });

                        await sendReferralBonusEmail(referrer.email, referrer.username, newUser.username, 100);
                        await sendReferredWelcomeEmail(newUser.email, newUser.username, referrer.username, 50);
                        console.log(`✅ Referral rewards (100/50) processed and emails sent.`);
                    }
                }
            } catch (referralError) {
                console.error("❌ Failed to handle referral reward:", referralError.message);
            }
        }

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

        // Send welcome email
        try {
            await sendWelcomeEmail(emailLower, {
                username: newUser.username,
                role: newUser.role,
                mobileNumber: newUser.mobileNumber,
                address: newUser.address,
                adminApprovalStatus: newUser.adminApprovalStatus
            });
            console.log(`✅ Welcome email sent to: ${emailLower}`);
        } catch (emailError) {
            console.error(`❌ Failed to send welcome email to ${emailLower}:`, emailError);
            // Don't fail the signup if email fails, just log the error
        }

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
    catch (error) {
        console.error(error);
        next(error)
    }
}

export const SignIn = async (req, res, next) => {
    const { email, password } = req.body
    const emailLower = email.toLowerCase();
    const identifier = req.ip || req.connection.remoteAddress;

    try {
        // Fetch user and check lockout concurrently (Parallelizing DB checks)
        const [validUser, isLocked] = await Promise.all([
            User.findOne({ email: emailLower }),
            PasswordLockout.isLocked({ email: emailLower })
        ]);

        if (!validUser) {
            // Check if this email is softbanned/purged and communicate appropriately
            try {
                const del = await DeletedAccount.findOne({ email: emailLower });
                if (del) {
                    // Case 1: Purged Account
                    if (del.purgedAt) {
                        return next(errorHandler(403, "This account was permanently removed and cannot be recovered."));
                    }

                    const policy = del.policy || {};

                    // Case 2: Softbanned (Permanently Banned Policy)
                    if (policy.banType === 'ban') {
                        return next(errorHandler(403, "This account has been permanently banned due to policy violations."));
                    }

                    // Case 3: Softbanned (Cooling-off period)
                    if (typeof policy.allowResignupAfterDays === 'number' && policy.allowResignupAfterDays > 0 && del.deletedAt) {
                        const allowAfter = new Date(del.deletedAt.getTime() + policy.allowResignupAfterDays * 24 * 60 * 60 * 1000);
                        if (new Date() < allowAfter) {
                            const msLeft = allowAfter.getTime() - Date.now();
                            const days = Math.floor(msLeft / (24 * 60 * 60 * 1000));
                            const hours = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                            const minutes = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
                            const waitMsg = days > 0 ? `${days} day(s)` : (hours > 0 ? `${hours} hour(s)` : `${minutes} minute(s)`);
                            return next(errorHandler(403, `This account is temporarily suspended. Please try again after ${waitMsg}.`));
                        }
                    }

                    // Case 4: Softbanned (General/User Requested) - Account is deleted but not purged
                    return next(errorHandler(403, "This account has been deactivated/deleted. Please sign up to create a new account."));
                }
            } catch (_) { }
            // Track failed attempt
            trackFailedAttempt(identifier);
            logSecurityEvent('failed_login', { email: emailLower, reason: 'user_not_found' });
            return next(errorHandler(401, "Invalid email address or password"))
        }

        // Check pre-calculated lockout status
        if (isLocked) {
            logSecurityEvent('account_locked_attempt', { email: emailLower, userId: validUser._id });
            const remainingMs = await getAccountLockRemainingMs(validUser._id, emailLower);
            const remainingMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
            return next(errorHandler(423, `Account is temporarily locked due to too many failed attempts. Try again in about ${remainingMinutes} minute${remainingMinutes > 1 ? 's, or reset your password' : ''}.`));
        }

        if (validUser.status === 'suspended') {
            logSecurityEvent('suspended_account_attempt', { email: emailLower, userId: validUser._id });
            return next(errorHandler(403, "This account is temporarily suspended. Please reach out to support for help."));
        }

        const validPassword = await bcryptjs.compare(password, validUser.password)
        if (!validPassword) {
            // Track failed attempt
            trackFailedAttempt(identifier, validUser._id);
            logSecurityEvent('failed_login', { email: emailLower, userId: validUser._id, reason: 'invalid_password' });
            return next(errorHandler(401, "Invalid email address or password"))
        }

        // Check if admin account is pending approval
        if (validUser.role === "admin" && validUser.adminApprovalStatus === "pending") {
            return next(errorHandler(403, "Your admin account is pending approval. Please wait for an existing admin to approve your request."));
        }

        // Check if admin account was rejected
        if (validUser.role === "admin" && validUser.adminApprovalStatus === "rejected") {
            return next(errorHandler(403, "Your admin account request has been rejected. Please contact support for more information."));
        }

        // Clear failed attempts on successful login (non-blocking)
        clearFailedAttempts(identifier);

        // Get device info and metadata synchronously
        const userAgent = req.get('User-Agent');
        const device = getDeviceInfo(userAgent, req.headers);
        const location = getLocationFromIP(identifier);
        const source = req.get('Origin') || req.get('Referer') || 'Unknown';
        const io = req.app.get('io');

        // Create enhanced session (DB updates inside this are now non-blocking)
        const session = await createEnhancedSession(validUser._id, req);

        // Generate token pair with sessionId
        const { accessToken, refreshToken } = generateTokenPair({ id: validUser._id, sessionId: session.sessionId });

        // Set secure cookies
        setSecureCookies(res, accessToken, refreshToken);
        res.cookie('session_id', session.sessionId, {
            httpOnly: false,
            secure: true,
            sameSite: 'none',
            path: '/'
        });

        // Respond immediately with JSON payload (unblocking frontend client)
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
            settings: validUser.settings,
            token: accessToken,
            refreshToken,
            sessionId: session.sessionId,
            emailNotificationStatus: 'pending'
        });

        // Defer non-critical logging, session limits, anomaly scans, and DB save updates to background thread
        (async () => {
            try {
                // Check for suspicious login patterns
                const suspiciousCheck = await checkSuspiciousLogin(validUser._id, identifier, device);

                // 🛡️ Sentinel AI Anomaly Check
                try {
                    const sentinelCheck = await SentinelSecurityService.checkSecurityAnomalies(validUser._id, identifier, device.device);
                    if (!sentinelCheck.safe) {
                        console.log(`🚨 Sentinel AI flagged login for user ${validUser._id}: ${sentinelCheck.reason}`);
                    }
                } catch (sentErr) {
                    console.error("Sentinel anomaly check failed during SignIn:", sentErr.message);
                }

                // Enforce role-based session limits
                await enforceSessionLimits(validUser._id, validUser.role, io);

                const concurrentInfo = detectConcurrentLogins(validUser._id, session.sessionId);

                // Log session action
                await logSessionAction(
                    validUser._id,
                    'login',
                    session.sessionId,
                    identifier,
                    device,
                    location,
                    `Successful login with ${concurrentInfo.activeSessions} concurrent sessions`,
                    suspiciousCheck.isSuspicious,
                    suspiciousCheck.reason,
                    null,
                    { source }
                );

                // Log successful login
                logSecurityEvent('successful_login', {
                    email: emailLower,
                    userId: validUser._id,
                    ip: identifier,
                    userAgent,
                    sessionId: session.sessionId,
                    concurrentLogins: concurrentInfo.activeSessions
                });

                // Update lastLogin timestamp
                if (validUser.gender && typeof validUser.gender === 'string') {
                    validUser.gender = validUser.gender.toLowerCase();
                }
                validUser.lastLogin = new Date();
                validUser.lastLoginLocation = location;
                validUser.lastReEngagementEmailSent = null;
                await validUser.save();

                // Send email notifications with retry logic
                try {
                    const sendEmailWithFallback = async (emailFn, maxAttempts = 3) => {
                        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                            try {
                                await emailFn();
                                return true;
                            } catch (error) {
                                if (attempt < maxAttempts) {
                                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
                                }
                            }
                        }
                        return false;
                    };

                    await sendEmailWithFallback(() =>
                        sendNewLoginEmail(
                            validUser.email,
                            device,
                            identifier,
                            location,
                            new Date()
                        )
                    );

                    if (suspiciousCheck.isSuspicious) {
                        await sendEmailWithFallback(() =>
                            sendSuspiciousLoginEmail(
                                validUser.email,
                                device,
                                identifier,
                                location,
                                suspiciousCheck.previousDevice,
                                suspiciousCheck.previousIp,
                                suspiciousCheck.previousLocation
                            )
                        );
                    }
                } catch (emailError) {
                    console.error('Post-login email notification error:', emailError);
                }
            } catch (bgError) {
                console.error("SignIn background process error:", bgError);
            }
        })();
    }
    catch (error) {
        console.error(error);
        next(error)
    }
}

export const Google = async (req, res, next) => {
    try {
        console.log('🔍 Google auth request received:', {
            body: req.body,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            headers: req.headers
        });

        const { name, email, photo } = req.body
        const validUser = await User.findOne({ email })
        if (validUser) {
            // Suspension check
            if (validUser.status === 'suspended') {
                return next(errorHandler(403, "Your account is suspended. Please contact support."));
            }

            // Get session info and metadata synchronously
            const userAgent = req.get('User-Agent');
            const device = getDeviceInfo(userAgent, req.headers);
            const ip = req.ip || req.connection.remoteAddress;
            const location = getLocationFromIP(ip);
            const source = req.get('Origin') || req.get('Referer') || 'Unknown';
            const io = req.app.get('io');

            // Create enhanced session (DB updates inside this are now non-blocking)
            const session = await createEnhancedSession(validUser._id, req);

            // Generate token pair with sessionId
            const { accessToken, refreshToken } = generateTokenPair({ id: validUser._id, sessionId: session.sessionId });

            // Set secure cookies
            setSecureCookies(res, accessToken, refreshToken);
            res.cookie('session_id', session.sessionId, {
                httpOnly: false,
                secure: true,
                sameSite: 'none',
                path: '/'
            });

            // Respond immediately with JSON payload (unblocking frontend client)
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
                settings: validUser.settings,
                token: accessToken,
                refreshToken,
                sessionId: session.sessionId,
                isNewUser: false
            });

            // Defer non-critical tracking, session limits, Sentinel check, auditing, and DB saves to background
            (async () => {
                try {
                    // Check concurrency & suspicious login
                    const concurrentInfo = detectConcurrentLogins(validUser._id, session.sessionId);
                    const suspiciousCheck = await checkSuspiciousLogin(validUser._id, ip, device);

                    // 🛡️ Sentinel AI Anomaly Check (Google)
                    try {
                        const sentinelCheck = await SentinelSecurityService.checkSecurityAnomalies(validUser._id, ip, device.device);
                        if (!sentinelCheck.safe) {
                            console.log(`🚨 Sentinel AI flagged Google login for user ${validUser._id}: ${sentinelCheck.reason}`);
                        }
                    } catch (sentErr) {
                        console.error("Sentinel anomaly check failed during Google auth:", sentErr.message);
                    }

                    // Enforce role-based session limits
                    await enforceSessionLimits(validUser._id, validUser.role, io);

                    // Log session action (Audit Log)
                    await logSessionAction(
                        validUser._id,
                        'login',
                        session.sessionId,
                        ip,
                        device,
                        location,
                        `Successful Google login with ${concurrentInfo.activeSessions} concurrent sessions`,
                        suspiciousCheck.isSuspicious,
                        suspiciousCheck.reason,
                        null,
                        { source }
                    );

                    // Log security event
                    logSecurityEvent('successful_google_login', {
                        email: validUser.email,
                        userId: validUser._id,
                        ip,
                        userAgent,
                        sessionId: session.sessionId,
                        concurrentLogins: concurrentInfo.activeSessions
                    });

                    // Update lastLogin timestamp
                    if (validUser.gender && typeof validUser.gender === 'string') {
                        validUser.gender = validUser.gender.toLowerCase();
                    }
                    validUser.lastLogin = new Date();
                    validUser.lastLoginLocation = location;
                    validUser.lastReEngagementEmailSent = null;
                    await validUser.save();

                    // Send email notifications
                    try {
                        const sendEmailWithFallback = async (emailFn, maxAttempts = 3) => {
                            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                                try {
                                    await emailFn();
                                    return true;
                                } catch (error) {
                                    if (attempt < maxAttempts) {
                                        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
                                    }
                                }
                            }
                            return false;
                        };

                        await sendEmailWithFallback(() =>
                            sendNewLoginEmail(
                                validUser.email,
                                device,
                                ip,
                                location,
                                new Date()
                            )
                        );

                        if (suspiciousCheck.isSuspicious) {
                            await sendEmailWithFallback(() =>
                                sendSuspiciousLoginEmail(
                                    validUser.email,
                                    device,
                                    ip,
                                    location,
                                    suspiciousCheck.previousDevice,
                                    suspiciousCheck.previousIp,
                                    suspiciousCheck.previousLocation
                                )
                            );
                        }
                    } catch (emailError) {
                        console.error('Post-login email notification error (Google):', emailError);
                    }
                } catch (bgError) {
                    console.error("Google background process error:", bgError);
                }
            })();
        }
        else {
            // Check softban/purge policy before allowing signup via Google
            try {
                const del = await DeletedAccount.findOne({ email: email.toLowerCase() });
                if (del) {
                    if (del.purgedAt) {
                        return next(errorHandler(403, "This account was permanently removed and cannot be recovered."));
                    }
                    const policy = del.policy || {};
                    if (policy.banType === 'ban') {
                        return next(errorHandler(403, "This account has been permanently banned due to policy violations."));
                    }
                    if (typeof policy.allowResignupAfterDays === 'number' && policy.allowResignupAfterDays > 0 && del.deletedAt) {
                        const allowAfter = new Date(del.deletedAt.getTime() + policy.allowResignupAfterDays * 24 * 60 * 60 * 1000);
                        if (new Date() < allowAfter) {
                            const msLeft = allowAfter.getTime() - Date.now();
                            const days = Math.floor(msLeft / (24 * 60 * 60 * 1000));
                            const hours = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                            const minutes = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
                            const waitMsg = days > 0 ? `${days} day(s)` : (hours > 0 ? `${hours} hour(s)` : `${minutes} minute(s)`);
                            return next(errorHandler(403, `This account is temporarily suspended. Please try again after ${waitMsg}.`));
                        }
                    }

                    // Account is in the 30-day grace period — check for active revocation token
                    // and redirect to conflict resolution page
                    const activeRevocation = await AccountRevocation.findOne({
                        email: email.toLowerCase(),
                        isUsed: false,
                        expiresAt: { $gt: new Date() }
                    });

                    if (activeRevocation) {
                        const conflictToken = jwt.sign(
                            { email: email.toLowerCase(), conflictId: activeRevocation._id, purpose: 'conflict_resolution' },
                            process.env.JWT_TOKEN,
                            { expiresIn: '1h' }
                        );

                        return res.status(409).json({
                            deletedAccountFound: true,
                            conflictToken,
                            deletedAccountData: {
                                username: activeRevocation.username,
                                email: activeRevocation.email,
                                role: activeRevocation.role,
                                deletedAt: activeRevocation.deletedAt,
                                expiresAt: activeRevocation.expiresAt,
                                daysRemaining: Math.max(0, Math.ceil((new Date(activeRevocation.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
                            }
                        });
                    }
                }
            } catch (_) { }

            const generatedPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcryptjs.hashSync(generatedPassword, 10);

            // Get session info
            const userAgent = req.get('User-Agent');
            const device = getDeviceInfo(userAgent, req.headers);
            const ip = req.ip || req.connection.remoteAddress;
            const location = getLocationFromIP(ip);

            // Resolve referral code for Google signup
            let resolvedGoogleReferredBy = req.body.referredBy || null;
            if (!resolvedGoogleReferredBy && req.body.referralCode) {
                const referrer = await User.findOne({ 'gamification.referralCode': req.body.referralCode.toUpperCase() }).select('_id');
                if (referrer) {
                    resolvedGoogleReferredBy = referrer._id.toString();
                }
            }

            const newUser = new User({
                username: name.split(" ").join("").toLowerCase() + Math.random().toString(36).slice(-8),
                email,
                password: hashedPassword,
                avatar: photo,
                isGeneratedMobile: true,
                'gamification.referredBy': resolvedGoogleReferredBy,
                lastLoginLocation: location
            })
            await newUser.save()

            // Handle Referral Reward for Google Sign-up (Both Sides)
            if (resolvedGoogleReferredBy) {
                try {
                    const CoinService = (await import("../services/coinService.js")).default;
                    const FraudDetectionService = (await import("../services/fraudDetectionService.js")).default;

                    // 🔍 Intelligent Fraud Detection Check
                    const fraudCheck = await FraudDetectionService.checkReferralFraud(resolvedGoogleReferredBy, newUser._id);

                    if (fraudCheck.isFraud) {
                        console.log(`⛔ Referral reward BLOCKED due to fraud detection: ${fraudCheck.reason}`);
                    } else {
                        const referrer = await User.findById(resolvedGoogleReferredBy);

                        if (referrer) {
                            // Credit Referrer (100 Coins)
                            await CoinService.credit({
                                userId: referrer._id,
                                amount: 100,
                                source: 'referral',
                                referenceId: newUser._id,
                                referenceModel: 'User',
                                description: `Referral bonus for inviting ${newUser.username} (via Google)`
                            });

                            // Credit Joiner (50 Coins)
                            await CoinService.credit({
                                userId: newUser._id,
                                amount: 50,
                                source: 'referral',
                                referenceId: referrer._id,
                                referenceModel: 'User',
                                description: `Welcome bonus for joining via ${referrer.username}'s referral (via Google)`
                            });

                            await sendReferralBonusEmail(referrer.email, referrer.username, newUser.username, 100);
                            await sendReferredWelcomeEmail(newUser.email, newUser.username, referrer.username, 50);
                            console.log(`✅ Referral rewards for Google (100/50) processed and emails sent.`);
                        }
                    }
                } catch (referralError) {
                    console.error("❌ Failed to handle referral reward for Google user:", referralError.message);
                }
            }

            // Create enhanced session for Google signup/login
            const session = await createEnhancedSession(newUser._id, req);

            // Generate token pair with sessionId
            const { accessToken, refreshToken } = generateTokenPair({ id: newUser._id, sessionId: session.sessionId });

            // Enforce role-based session limits
            await enforceSessionLimits(newUser._id, newUser.role, req.app.get('io'));

            // Set secure cookies
            setSecureCookies(res, accessToken, refreshToken);
            // Expose session id for cross-origin
            res.cookie('session_id', session.sessionId, {
                httpOnly: false,
                secure: true,
                sameSite: 'none',
                path: '/'
            });

            // Log session action (Audit Log)
            await logSessionAction(
                newUser._id,
                'login',
                session.sessionId,
                ip,
                device,
                location,
                `Successful Google signup/login`,
                false,
                null
            );

            // Log security event
            logSecurityEvent('successful_google_signup', {
                email: newUser.email,
                userId: newUser._id,
                ip,
                userAgent,
                sessionId: session.sessionId
            });

            // Send welcome email for new Google sign-in users
            try {
                await sendWelcomeEmail(newUser.email, {
                    username: newUser.username,
                    role: newUser.role,
                    mobileNumber: newUser.mobileNumber,
                    address: newUser.address,
                    adminApprovalStatus: newUser.adminApprovalStatus
                });
                console.log(`✅ Welcome email sent to new Google user: ${newUser.email}`);
            } catch (emailError) {
                console.error(`❌ Failed to send welcome email to new Google user ${newUser.email}:`, emailError);
                // Don't fail the signup if email fails, just log the error
            }

            // Send new login email (first login) for Google sign-in users
            try {
                // Variables userAgent, device, location, ip are already defined above
                await sendNewLoginEmail(
                    newUser.email,
                    device,
                    ip,
                    location,
                    new Date()
                );
                console.log(`✅ New login email sent to Google user: ${newUser.email}`);
            } catch (emailError) {
                console.error(`❌ Failed to send new login email to Google user ${newUser.email}:`, emailError);
                // Don't fail the signup if email fails, just log the error
            }

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
                settings: newUser.settings,
                token: accessToken, // Keep for backward compatibility
                refreshToken, // Send for cross-domain storage
                isNewUser: true,
                sessionId: session.sessionId
            });
        }
    }
    catch (error) {
        console.error(error);
        next(error)
    }
}


export const Signout = async (req, res, next) => {
    try {
        // Best-effort: identify user and current session to remove from activeSessions
        // 1. Check cookies (Web)
        // 2. Check X-Session-ID header (Mobile)
        // 3. Check req.user (if optionalAuth was called)
        const sessionId = req.headers['x-session-id'] || req.cookies.session_id;
        let userId = req.user?._id || null;

        if (!userId) {
            try {
                let token = req.cookies.access_token;
                // Fallback: Check Authorization header if cookie is missing (Mobile)
                if (!token && req.headers.authorization?.startsWith('Bearer ')) {
                    token = req.headers.authorization.split(' ')[1];
                }

                if (token) {
                    const decoded = jwt.verify(token, process.env.JWT_TOKEN);
                    userId = decoded.id;
                    // If sessionId wasn't in headers but is in token, use it
                    if (!sessionId && decoded.sessionId) {
                        // We can't easily re-assign to sessionId here if it's a const, 
                        // but we can use it in the revoke call
                    }
                }
            } catch (_) { }
        }

        // Use sessionId from token if not provided in headers/cookies
        let finalSessionId = sessionId;
        if (!finalSessionId) {
            try {
                let token = req.headers.authorization?.substring(7) || req.cookies.access_token;
                if (token) {
                    const decoded = jwt.verify(token, process.env.JWT_TOKEN);
                    finalSessionId = decoded.sessionId;
                }
            } catch (_) { }
        }

        if (userId && finalSessionId) {
            try {
                await revokeSessionFromDB(userId, finalSessionId);
                // Broadcast updates so UIs refresh immediately
                const io = req.app.get('io');
                if (io) {
                    // Emit to specific user's room
                    io.to(userId.toString()).emit('sessionsUpdated');
                    // Emit to admins
                    io.emit('adminSessionsUpdated');
                }
                // Log action
                await logSessionAction(
                    userId,
                    'logout',
                    finalSessionId,
                    req.ip,
                    getDeviceInfo(req.get('User-Agent'), req.headers),
                    getLocationFromIP(req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip),
                    'User signed out'
                );
            } catch (_) { }
        }

        clearAuthCookies(res);
        res.status(200).json('User has been logged out!');
    } catch (error) {
        next(error);
    }
};

export const verifyAuth = async (req, res, next) => {
    try {
        let accessToken = req.cookies.access_token;

        // Fallback: Check Authorization header if cookie is missing
        if (!accessToken && req.headers.authorization?.startsWith('Bearer ')) {
            accessToken = req.headers.authorization.split(' ')[1];
        }

        const refreshToken = req.cookies.refresh_token;

        if (!accessToken && !refreshToken) {
            return res.status(200).json({ authenticated: false, message: "No tokens found" });
        }

        let decoded;

        // 1. Try to verify ACCESS TOKEN
        if (accessToken) {
            try {
                decoded = jwt.verify(accessToken, process.env.JWT_TOKEN, {
                    issuer: 'urbansetu',
                    audience: 'urbansetu-users'
                });
            } catch (ignored) {
                // Access token invalid/expired, fall through to refresh logic
            }
        }

        // 2. If access token failed/missing, try REFRESH TOKEN
        if (!decoded && refreshToken) {
            try {
                const refreshDecoded = jwt.verify(refreshToken, process.env.JWT_TOKEN, {
                    issuer: 'urbansetu',
                    audience: 'urbansetu-refresh'
                });

                // User must exist to issue new tokens
                const user = await User.findById(refreshDecoded.id);
                if (!user) {
                    return res.status(200).json({ authenticated: false, message: "User no longer exists" });
                }

                // Check suspension status during refresh
                if (user.status === 'suspended') {
                    return res.status(200).json({ authenticated: false, message: "Account suspended" });
                }

                // MANDATORY Session check for refresh token
                if (!refreshDecoded.sessionId) {
                    return res.status(200).json({ authenticated: false, message: "Legacy session. Please sign in again." });
                }

                const session = Array.isArray(user.activeSessions) && user.activeSessions.find(s => s.sessionId === refreshDecoded.sessionId);
                if (!session) {
                    return res.status(200).json({ authenticated: false, message: "Session revoked" });
                }

                // Check absolute session expiry (7 days policy)
                if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
                    // Remove session from DB
                    await User.findByIdAndUpdate(user._id, { $pull: { activeSessions: { sessionId: session.sessionId } } });
                    return res.status(200).json({ authenticated: false, message: "Session expired (7-day limit reached)" });
                }

                // Generate new token pair with SAME sessionId to keep it bound to the same device
                const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokenPair({
                    id: user._id,
                    sessionId: refreshDecoded.sessionId
                });

                // Set new cookies
                setSecureCookies(res, newAccessToken, newRefreshToken);

                // Return sanitized user data (strip sensitive fields)
                return res.status(200).json(sanitizeUserForVerify(user));

            } catch (refreshError) {
                // Both tokens failed
                return res.status(200).json({ authenticated: false, message: "Session expired" });
            }
        }

        if (!decoded) {
            return res.status(200).json({ authenticated: false, message: "Invalid authentication" });
        }

        // 3. User Lookup (for valid Access Token case)
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(200).json({ authenticated: false, message: "User not found" });
        }

        // Return sanitized user data (strip sensitive fields)
        res.status(200).json(sanitizeUserForVerify(user));
    } catch (error) {
        // Fallback error handler
        return res.status(200).json({ authenticated: false, message: "Authentication failed" });
    }
};

/**
 * Sanitize user document for the /auth/verify response.
 * Only returns fields the frontend needs for currentUser state.
 * Strips sensitive internal data like sessions, tokens, IPs, etc.
 */
function sanitizeUserForVerify(user) {
    const userObj = user.toObject ? user.toObject() : { ...user };

    // Build a safe settings object (exclude pushTokens)
    const safeSettings = { ...(userObj.settings || {}) };
    delete safeSettings.pushTokens;

    return {
        _id: userObj._id,
        username: userObj.username,
        email: userObj.email,
        mobileNumber: userObj.mobileNumber,
        avatar: userObj.avatar,
        role: userObj.role,
        isDefaultAdmin: userObj.isDefaultAdmin,
        adminApprovalStatus: userObj.adminApprovalStatus,
        status: userObj.status,
        address: userObj.address,
        gender: userObj.gender,
        settings: safeSettings,
        profileVisibility: userObj.profileVisibility,
        isLocked: userObj.isLocked,
        isSubscribed: userObj.isSubscribed,
        isGeneratedMobile: userObj.isGeneratedMobile,
        createdAt: userObj.createdAt,
        lastLogin: userObj.lastLogin,
        gamification: {
            setuCoinsBalance: userObj.gamification?.setuCoinsBalance ?? 0,
            totalCoinsEarned: userObj.gamification?.totalCoinsEarned ?? 0,
            currentStreak: userObj.gamification?.currentStreak ?? 0,
            hasReceivedProfileCompletionBonus: userObj.gamification?.hasReceivedProfileCompletionBonus ?? false,
            coinsExpiryDate: userObj.gamification?.coinsExpiryDate ?? null,
            referredBy: userObj.gamification?.referredBy ?? null,
        },
        rentalProfile: {
            isLandlord: userObj.rentalProfile?.isLandlord ?? false,
            isTenant: userObj.rentalProfile?.isTenant ?? false,
            activeContractsAsLandlord: userObj.rentalProfile?.activeContractsAsLandlord ?? 0,
            activeContractsAsTenant: userObj.rentalProfile?.activeContractsAsTenant ?? 0,
            verifiedLandlord: userObj.rentalProfile?.verifiedLandlord ?? false,
        },
    };
}

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
        const { userId, newPassword, confirmPassword, recaptchaToken } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;

        if (!userId || !newPassword || !confirmPassword) {
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

        // Find user by ID
        const user = await User.findById(userId);

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        // Daily Password Change Limit: 3 changes per 24 hours
        if (user.passwordHistory && user.passwordHistory.length > 0) {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const changesLast24h = user.passwordHistory.filter(h => new Date(h.changedAt) >= twentyFourHoursAgo).length;

            if (changesLast24h >= 3) {
                return next(errorHandler(429, "You have reached the daily limit for password changes. Please try again after 24 hours."));
            }
        }

        // No lockout check - removed as requested

        // Count recent failed RESET PASSWORD attempts for this user (not login attempts)
        const recentResetAttempts = await PasswordLockout.aggregate([
            {
                $match: {
                    $or: [{ userId: user._id }, { email: user.email }],
                    identifier: { $regex: /reset_password_tracking/ }, // Only reset password tracking attempts
                    lockedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
                }
            },
            {
                $group: {
                    _id: null,
                    totalAttempts: { $sum: "$attempts" }
                }
            }
        ]);

        const totalAttempts = recentResetAttempts.length > 0 ? recentResetAttempts[0].totalAttempts : 0;

        console.log(`Reset password attempts for user ${user.email}: totalAttempts=${totalAttempts}, hasRecaptchaToken=${!!recaptchaToken}, recentResetAttempts=${JSON.stringify(recentResetAttempts)}`);

        // Require reCAPTCHA after 3 failed reset password attempts (so on 4th attempt)
        if (totalAttempts >= 3 && !recaptchaToken) {
            console.log(`Requiring reCAPTCHA for reset password - totalAttempts: ${totalAttempts}`);
            return next(errorHandler(400, "reCAPTCHA verification is required due to multiple failed attempts."));
        }

        // Debug: Log when reCAPTCHA is NOT required
        if (totalAttempts < 3) {
            console.log(`No reCAPTCHA required - totalAttempts: ${totalAttempts} < 3`);
        }

        // Verify reCAPTCHA if provided
        if (recaptchaToken) {
            try {
                const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}&remoteip=${ipAddress}`
                });
                const recaptchaData = await recaptchaResponse.json();

                if (!recaptchaData.success) {
                    return next(errorHandler(400, "reCAPTCHA verification failed. Please try again."));
                }
            } catch (error) {
                return next(errorHandler(400, "reCAPTCHA verification failed. Please try again."));
            }
        }

        // Check if new password is different from current password
        const isSameAsCurrent = await bcryptjs.compare(newPassword, user.password);

        // Check password history
        let isSameAsHistory = false;
        if (user.passwordHistory && user.passwordHistory.length > 0) {
            for (const history of user.passwordHistory) {
                if (await bcryptjs.compare(newPassword, history.hashedPassword)) {
                    isSameAsHistory = true;
                    break;
                }
            }
        }

        if (isSameAsCurrent || isSameAsHistory) {
            // Track failed attempt - no lockout, just tracking for reCAPTCHA
            await PasswordLockout.findOneAndUpdate(
                {
                    $or: [{ userId: user._id }, { email: user.email }],
                    identifier: `reset_password_tracking_${user._id}`
                },
                {
                    userId: user._id,
                    email: user.email,
                    identifier: `reset_password_tracking_${user._id}`,
                    attempts: totalAttempts + 1,
                    ipAddress,
                    lockedAt: new Date(),
                    unlockAt: null // No lockout, just tracking
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            const errorMessage = isSameAsCurrent
                ? "Your new password cannot be the same as your current password."
                : "This password has been used by you previously. Please choose a different one.";
            return next(errorHandler(400, errorMessage));
        }

        // Update history - add current password to history before overriding it
        if (!user.passwordHistory) user.passwordHistory = [];
        user.passwordHistory.push({
            hashedPassword: user.password,
            changedAt: new Date(),
            ip: ipAddress,
            device: getDeviceInfo(req.get('User-Agent'), req.headers)
        });

        // Update password
        user.password = bcryptjs.hashSync(newPassword, 10);
        // If user status was incorrectly set to a non-enum value like 'locked', normalize to 'active'
        if (user.status !== 'active' && user.status !== 'suspended') {
            user.status = 'active';
        }
        await user.save();

        // Clear any active password lockouts for this user/email after successful reset
        try {
            // Clear both tracking and lockout records
            await PasswordLockout.deleteMany({
                $or: [{ userId: user._id }, { email: user.email }],
                identifier: { $regex: /reset_password/ }
            });
        } catch (_) { }

        // Send password reset success email
        try {
            await sendPasswordResetSuccessEmail(user.email, user.username, 'forgot_password');
        } catch (emailError) {
            console.error('Failed to send password reset success email:', emailError);
            // Don't fail the request if email fails
        }

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
    const { otpTracking, requiresCaptcha } = req;
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection.remoteAddress;

    if (!email) {
        return next(errorHandler(400, "Email is required"));
    }

    const emailLower = email.toLowerCase();

    // Validate email for fraud detection
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    const emailValidation = validateEmail(email, {
        logSecurity: true,
        context: 'login_otp',
        ip,
        userAgent
    });

    if (!emailValidation.isValid) {
        // Log fraud attempt for security monitoring
        if (emailValidation.isFraud) {
            logSecurityEvent('fraud_email_login_otp_attempt', {
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
        // Check active lockout due to excessive OTP requests
        if (otpTracking && otpTracking.isLocked && otpTracking.isLocked()) {
            return res.status(429).json({
                success: false,
                message: "Too many OTP requests. Please try again in 15 minutes.",
                requiresCaptcha: false
            });
        }
        // Check if user exists with the email
        const user = await User.findOne({ email: emailLower });
        if (!user) {
            // If no user, check if this email is softbanned/purged and communicate appropriately
            try {
                const del = await DeletedAccount.findOne({ email: emailLower });
                if (del) {
                    // Case 1: Purged Account
                    if (del.purgedAt) {
                        return res.status(403).json({
                            success: false,
                            message: 'This account was permanently removed and cannot be recovered.'
                        });
                    }

                    const policy = del.policy || {};

                    // Case 2: Softbanned (Permanently Banned Policy)
                    if (policy.banType === 'ban') {
                        return res.status(403).json({
                            success: false,
                            message: 'This account has been permanently banned due to policy violations.'
                        });
                    }

                    // Case 3: Softbanned (Cooling-off period)
                    if (typeof policy.allowResignupAfterDays === 'number' && policy.allowResignupAfterDays > 0 && del.deletedAt) {
                        const allowAfter = new Date(del.deletedAt.getTime() + policy.allowResignupAfterDays * 24 * 60 * 60 * 1000);
                        if (new Date() < allowAfter) {
                            const msLeft = allowAfter.getTime() - Date.now();
                            const days = Math.floor(msLeft / (24 * 60 * 60 * 1000));
                            const hours = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                            const minutes = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
                            const waitMsg = days > 0 ? `${days} day(s)` : (hours > 0 ? `${hours} hour(s)` : `${minutes} minute(s)`);
                            return res.status(403).json({
                                success: false,
                                message: `Your account is temporarily suspended. Please try again after ${waitMsg}.`
                            });
                        }
                    }

                    // Case 4: Softbanned (General/User Requested)
                    return res.status(403).json({
                        success: false,
                        message: "This account has been deactivated/deleted. Please sign up to create a new account."
                    });
                }
            } catch (_) { }
            return res.status(400).json({
                success: false,
                message: "We couldn't find an account with this email. Sign up to create one."
            });
        }

        // Block OTP sending for suspended accounts
        if (user.status === 'suspended') {
            return res.status(403).json({
                success: false,
                message: "Your account has been suspended. Please contact support."
            });
        }

        // Block OTP sending if account is password-locked due to failed attempts
        try {
            if (await isAccountLocked(user._id)) {
                const remainingMs = await getAccountLockRemainingMs(user._id, user.email);
                const remainingMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
                return res.status(423).json({
                    success: false,
                    message: `Account is temporarily locked due to too many failed attempts. Try again in about ${remainingMinutes} minute${remainingMinutes > 1 ? 's, or reset your password' : ''}.`
                });
            }
        } catch (_) { }

        // Increment OTP request count and attach ip/userAgent for auditing
        await otpTracking.incrementOtpRequest();

        // If 5 requests within 15 minutes -> 15 min lockout
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        if (otpTracking.otpRequestCount >= 5 && otpTracking.lastOtpTimestamp >= fifteenMinutesAgo) {
            await otpTracking.registerLockout(15 * 60 * 1000);
            return res.status(429).json({
                success: false,
                message: "Too many OTP requests. Please try again in 15 minutes.",
                requiresCaptcha: false
            });
        }

        // Generate OTP
        const otp = generateOTP();

        // Store OTP with expiration (5 minutes for better security)
        const expirationTime = Date.now() + 5 * 60 * 1000; // 5 minutes
        loginOtpStore.set(emailLower, {
            otp,
            expirationTime,
            attempts: 0,
            userId: user._id,
            trackingId: otpTracking._id
        });

        // Send OTP email for login
        const emailResult = await sendLoginOTPEmail(emailLower, otp);

        if (!emailResult.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to send OTP. Please try again."
            });
        }

        // Log successful OTP request
        logSecurityEvent('otp_request_successful', {
            email: emailLower,
            userId: user._id,
            ip: ipAddress,
            requiresCaptcha: requiresCaptcha
        });

        // If 3 OTP requests within 5 minutes -> require captcha on subsequent requests
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (otpTracking.otpRequestCount >= 3 && otpTracking.lastOtpTimestamp >= fiveMinutesAgo) {
            otpTracking.requiresCaptcha = true;
            await otpTracking.save();
        }

        res.status(200).json({
            success: true,
            message: "OTP sent successfully to your email",
            requiresCaptcha: false // Reset after successful request
        });

    } catch (error) {
        console.error('Send login OTP error:', error);
        next(error);
    }
};

// Verify OTP and login
export const verifyLoginOTP = async (req, res, next) => {
    const { email, otp } = req.body;
    const { otpTracking } = req;

    if (!email || !otp) {
        return next(errorHandler(400, "Email and OTP are required"));
    }

    const emailLower = email.toLowerCase();

    try {
        // If verification is currently locked due to too many failures
        if (otpTracking && otpTracking.isLocked && otpTracking.isLocked()) {
            return res.status(423).json({
                success: false,
                message: "Too many incorrect attempts. Please try again in 15 minutes.",
                requiresCaptcha: true
            });
        }
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
            // Track failed attempt in DB and consider lockout
            if (otpTracking) {
                await otpTracking.incrementFailedAttempt();
                // 5 wrong attempts in 15 mins -> 15 min lockout
                const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
                if (otpTracking.failedOtpAttempts >= 5 && otpTracking.lastFailedAttemptTimestamp >= fifteenMinutesAgo) {
                    await otpTracking.registerLockout(15 * 60 * 1000);
                    try {
                        const user = await User.findById(storedData.userId);
                        if (user) {
                            const location = getLocationFromIP(req.ip);
                            await sendAccountLockoutEmail(user.email, {
                                username: user.username,
                                attempts: 5,
                                lockoutDuration: '15 minutes',
                                ipAddress: req.ip,
                                location,
                                device: 'Unknown (OTP Verification)',
                                reason: 'Excessive Failed OTP Attempts'
                            });
                        }
                    } catch (e) {
                        console.error('Failed to send OTP lockout email:', e);
                    }
                }
            }
            return res.status(400).json({
                success: false,
                message: "Too many failed attempts. Please request a new OTP.",
                requiresCaptcha: otpTracking?.requiresCaptcha || false
            });
        }

        // Verify OTP
        if (storedData.otp !== otp) {
            storedData.attempts += 1;
            loginOtpStore.set(emailLower, storedData);

            // Increment failed attempts in tracking
            if (otpTracking) {
                await otpTracking.incrementFailedAttempt();
                // If 3 wrong attempts -> invalidate current OTP (force new request)
                if (storedData.attempts >= 3) {
                    loginOtpStore.delete(emailLower);
                }
                // If 5 wrong attempts within 15 minutes -> 15 min lock
                const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
                if (otpTracking.failedOtpAttempts >= 5 && otpTracking.lastFailedAttemptTimestamp >= fifteenMinutesAgo) {
                    await otpTracking.registerLockout(15 * 60 * 1000);
                    try {
                        const user = await User.findById(storedData.userId);
                        if (user) {
                            const location = getLocationFromIP(req.ip);
                            await sendAccountLockoutEmail(user.email, {
                                username: user.username,
                                attempts: 5,
                                lockoutDuration: '15 minutes',
                                ipAddress: req.ip,
                                location,
                                device: 'Unknown (OTP Verification)',
                                reason: 'Excessive Failed OTP Attempts'
                            });
                        }
                    } catch (e) {
                        console.error('Failed to send OTP lockout email:', e);
                    }
                }
            }

            // Log failed OTP attempt
            logSecurityEvent('otp_verification_failed', {
                email: emailLower,
                userId: storedData.userId,
                ip: req.ip,
                attempts: storedData.attempts
            });

            return res.status(400).json({
                success: false,
                message: storedData.attempts >= 3 ? "Too many incorrect attempts. Please try again in 15 minutes." : "Invalid OTP. Please try again.",
                requiresCaptcha: otpTracking?.requiresCaptcha || false
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

        // Check if user is approved (only for Admins)
        if (user.role === 'admin' && user.adminApprovalStatus !== 'approved') {
            return res.status(403).json({
                success: false,
                message: user.adminApprovalStatus === 'rejected'
                    ? "Your admin account request has been rejected. Please contact support for more information."
                    : "Your admin account is pending approval. Please wait for an existing admin to approve your request."
            });
        }

        // Check if user is suspended
        if (user.status === 'suspended') {
            return res.status(403).json({
                success: false,
                message: "Your account has been suspended. Please contact support."
            });
        }

        // Get device info and location info synchronously
        const userAgent = req.get('User-Agent');
        const device = getDeviceInfo(userAgent, req.headers);
        const ip = req.ip || req.connection.remoteAddress;
        const location = getLocationFromIP(ip);
        const source = req.get('Origin') || req.get('Referer') || 'Unknown';
        const io = req.app.get('io');

        // Create enhanced session (DB updates inside this are now non-blocking)
        const session = await createEnhancedSession(user._id, req);

        // Generate token pair with sessionId
        const { accessToken, refreshToken } = generateTokenPair({ id: user._id, sessionId: session.sessionId });

        // Clear OTP from store
        loginOtpStore.delete(emailLower);

        // Set secure cookies
        setSecureCookies(res, accessToken, refreshToken);

        // Respond immediately with JSON payload (unblocking frontend client)
        res.status(200).json({
            success: true,
            message: "Login successful",
            token: accessToken,
            refreshToken,
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

        // Defer non-critical logging, session limits, anomaly checks, OTP tracking reset, and email updates to background
        (async () => {
            try {
                // Check for suspicious login patterns
                const suspiciousCheck = await checkSuspiciousLogin(user._id, ip, device);

                // Enforce role-based session limits
                await enforceSessionLimits(user._id, user.role, io);

                // Reset tracking on successful login
                if (otpTracking) {
                    await otpTracking.resetTracking();
                    await otpTracking.clearLockout?.();
                }

                // Send email notifications
                try {
                    await sendNewLoginEmail(
                        user.email,
                        device,
                        ip,
                        location,
                        new Date()
                    );

                    if (suspiciousCheck.isSuspicious) {
                        await sendSuspiciousLoginEmail(
                            user.email,
                            device,
                            ip,
                            location,
                            suspiciousCheck.previousDevice,
                            suspiciousCheck.previousIp,
                            'Unknown Location'
                        );
                    }
                } catch (emailError) {
                    console.error('Post-login email notification error (OTP):', emailError);
                }

                // Log session action
                await logSessionAction(
                    user._id,
                    'login',
                    session.sessionId,
                    ip,
                    device,
                    location,
                    'OTP login successful',
                    suspiciousCheck.isSuspicious,
                    suspiciousCheck.reason
                );

                // Log successful OTP login
                logSecurityEvent('otp_login_successful', {
                    email: emailLower,
                    userId: user._id,
                    ip: ip
                });
            } catch (bgError) {
                console.error("verifyLoginOTP background process error:", bgError);
            }
        })();

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

// Lock account via security token
export const lockAccountByToken = async (req, res, next) => {
    try {
        const { token } = req.body;
        if (!token) return next(errorHandler(400, 'Token is required'));

        const user = await User.findOne({
            securityLockToken: token,
            securityLockExpires: { $gt: Date.now() }
        }).select('+securityLockToken +securityLockExpires +username +email');

        if (!user) {
            return next(errorHandler(400, 'Invalid or expired lock token'));
        }

        let message = 'Account has been successfully locked';
        // Already locked?
        if (user.isLocked) {
            message = 'Account is already locked';
        }

        // Lock the account
        user.isLocked = true;
        user.lockReason = 'Emergency Lock by User';

        // Clear the used lock token
        user.securityLockToken = undefined;
        user.securityLockExpires = undefined;

        // GENERATE UNLOCK TOKEN NOW
        const unlockToken = crypto.randomBytes(32).toString('hex');
        // Critical: Unlock token should NOT expire soon as it's the only key. Set to 10 years.
        const tokenExpiry = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000);

        user.securityUnlockToken = unlockToken;
        user.securityUnlockExpires = tokenExpiry;

        await user.save();

        // Log event
        logSecurityEvent('account_emergency_locked', { userId: user._id, email: user.email });

        // SEND LOCKED EMAIL WITH NEW UNLOCK LINK
        const clientUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
        const unlockLink = `${clientUrl}/security/unlock-account/${unlockToken}`;

        try {
            await sendAccountLockedEmail(user.email, user.username, unlockLink);
        } catch (emailErr) {
            console.error("Failed to send account locked email:", emailErr);
        }

        res.status(200).json({ success: true, message });
    } catch (error) {
        next(error);
    }
};

// Unlock account via security token
export const unlockAccountByToken = async (req, res, next) => {
    try {
        const { token } = req.body;
        if (!token) return next(errorHandler(400, 'Token is required'));

        const user = await User.findOne({
            securityUnlockToken: token,
            securityUnlockExpires: { $gt: Date.now() }
        }).select('+securityUnlockToken +securityUnlockExpires +securityLockToken +securityLockExpires +username +email');

        if (!user) {
            return next(errorHandler(400, 'Invalid or expired unlock token'));
        }

        let message = 'Account has been successfully unlocked';
        if (!user.isLocked) {
            message = 'Account is already active';
        }

        // Unlock the account
        user.isLocked = false;
        user.lockReason = null;

        // Clear the used token
        user.securityUnlockToken = undefined;
        user.securityUnlockExpires = undefined;

        // Also clear lock token if it exists (cleanup)
        user.securityLockToken = undefined;
        user.securityLockExpires = undefined;

        // Also clear PasswordLockout entries if any exist
        try {
            await PasswordLockout.deleteMany({ userId: user._id });
        } catch (_) { }

        await user.save();

        // Log event
        logSecurityEvent('account_emergency_unlocked', { userId: user._id, email: user.email });

        // SEND UNLOCKED EMAIL
        try {
            await sendAccountUnlockedEmail(user.email, user.username);
        } catch (emailErr) {
            console.error("Failed to send account unlocked email:", emailErr);
        }

        res.status(200).json({ success: true, message });
    } catch (error) {
        next(error);
    }
};

export const RefreshToken = async (req, res, next) => {
    try {
        const refreshToken = req.cookies.refresh_token || req.body.refreshToken;

        if (!refreshToken) {
            return next(errorHandler(401, "Refresh token not found"));
        }

        const decoded = verifyRefreshToken(refreshToken);
        const user = await User.findById(decoded.id);

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        if (user.status === 'suspended') {
            return next(errorHandler(403, "Account suspended"));
        }

        // MANDATORY Session check for refresh token
        if (!decoded.sessionId) {
            return next(errorHandler(401, "Legacy session. Please sign in again."));
        }

        const session = Array.isArray(user.activeSessions) && user.activeSessions.find(s => s.sessionId === decoded.sessionId);
        if (!session) {
            return next(errorHandler(401, "Session revoked"));
        }

        // Check absolute session expiry (7 days policy)
        if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
            // Remove session from DB
            await User.findByIdAndUpdate(user._id, { $pull: { activeSessions: { sessionId: session.sessionId } } });
            return next(errorHandler(401, "Session expired (7-day limit reached). Please sign in again."));
        }

        // Rotate token pair (optional but recommended for security)
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokenPair({
            id: user._id,
            sessionId: decoded.sessionId
        });

        setSecureCookies(res, newAccessToken, newRefreshToken);

        res.status(200).json({
            token: newAccessToken,
            refreshToken: newRefreshToken
        });

    } catch (error) {
        next(errorHandler(401, "Invalid refresh token"));
    }
};

export const setCookieTest = (req, res) => {
    res.cookie('test_third_party', '1', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 60 * 60 * 1000 // 1 hour
    });
    res.json({ success: true });
};

export const checkCookieTest = (req, res) => {
    if (req.cookies && req.cookies.test_third_party === '1') {
        res.json({ enabled: true });
    } else {
        res.json({ enabled: false });
    }
};
