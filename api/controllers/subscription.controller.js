import Subscription from '../models/subscription.model.js';
import User from '../models/user.model.js'; // Import User model to check if email is registered
import { errorHandler } from '../utils/error.js';
import {
    sendSubscriptionReceivedEmail,
    sendSubscriptionApprovedEmail,
    sendSubscriptionRejectedEmail,
    sendSubscriptionRevokedEmail,
    sendSubscriptionOtpEmail,
    sendOptOutOtpEmail
} from '../utils/emailService.js';
import crypto from 'crypto';
import { logSecurityEvent, isAccountLocked, getAccountLockRemainingMs } from '../middleware/security.js';
import { sendAccountLockoutEmail } from '../utils/emailService.js';
import { getLocationFromIP } from '../utils/sessionManager.js';

export const subscribeToNewsletter = async (req, res, next) => {
    const { email, source = 'guides_page' } = req.body;

    if (!email) {
        return next(errorHandler(400, 'Email is required'));
    }

    try {
        let subscription = await Subscription.findOne({ email });
        const type = source === 'blogs_page' ? 'blog' : 'guide';

        if (subscription) {
            // Check if already has this exact preference active
            if (subscription.preferences && subscription.preferences[type]) {
                return res.status(200).json({ success: true, message: `You are already subscribed to our ${type}s!` });
            }

            // Check if already pending for this type
            if (subscription.pendingPreferences && subscription.pendingPreferences[type]) {
                return res.status(200).json({ success: true, message: `Your ${type} subscription is already pending approval.` });
            }

            // If not active and not pending, add to pending
            subscription.status = 'pending';
            if (!subscription.pendingPreferences) subscription.pendingPreferences = {};
            subscription.pendingPreferences[type] = true;
            subscription.source = source;
            subscription.statusUpdatedAt = new Date();
            await subscription.save();

            // Send "Received" email
            await sendSubscriptionReceivedEmail(email, source);

            return res.status(200).json({
                success: true,
                message: 'Your subscription request has been received and is pending approval.'
            });
        } else {
            // New subscription
            subscription = new Subscription({
                email,
                source,
                status: 'pending',
                preferences: {
                    blog: type === 'blog',
                    guide: type === 'guide'
                }
            });
            await subscription.save();

            // Send "Received" email
            await sendSubscriptionReceivedEmail(email, source);

            res.status(201).json({ success: true, message: 'Subscription request received! Please check your email.' });
        }
    } catch (error) {
        next(error);
    }
};

export const getAllSubscribers = async (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
        return next(errorHandler(403, 'Forbidden'));
    }

    try {
        const subscribers = await Subscription.find().sort({ subscribedAt: -1 });
        res.status(200).json({ success: true, data: subscribers });
    } catch (error) {
        next(error);
    }
};

export const getMySubscriptionStatus = async (req, res, next) => {
    // Assuming authenticated user
    try {
        const email = req.user.email;
        const subscription = await Subscription.findOne({ email });

        if (!subscription) {
            return res.status(200).json({ success: true, data: { status: 'not_subscribed' } });
        }

        res.status(200).json({ success: true, data: subscription });
    } catch (error) {
        next(error);
    }
};

export const unsubscribeUser = async (req, res, next) => {
    try {
        const email = req.user.email;
        const subscription = await Subscription.findOne({ email });

        if (!subscription) {
            return next(errorHandler(404, 'Subscription not found'));
        }

        const { reason, source } = req.body;
        // Determine type based on source
        const type = source === 'blogs_page' ? 'blog' : (source === 'guides_page' ? 'guide' : null);

        if (type && subscription.preferences) {
            // Granular unsubscribe
            subscription.preferences[type] = false;

            // Check if any active subscriptions remain
            const hasActive = Object.values(subscription.preferences).some(v => v === true);

            if (!hasActive) {
                // If no active subscriptions left, fully opt-out
                subscription.status = 'opted_out';
                subscription.preferences = { blog: false, guide: false };
            } else {
                // If others remain, keep status as is
                // Just this one preference is gone.
            }
        } else {
            // Generic unsubscribe (full opt-out)
            subscription.status = 'opted_out';
            subscription.preferences = { blog: false, guide: false };
        }

        subscription.statusUpdatedAt = new Date();
        if (reason) {
            subscription.rejectionReason = reason;
        }
        await subscription.save();

        res.status(200).json({ success: true, message: 'You have successfully unsubscribed.' });
    } catch (error) {
        next(error);
    }
};

export const updateSubscriptionStatus = async (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
        return next(errorHandler(403, 'Forbidden'));
    }

    const { id } = req.params;
    const { status, reason, type } = req.body; // Added 'type' to know what we are acting on (blog/guide)

    if (!['approved', 'rejected', 'revoked'].includes(status)) {
        return next(errorHandler(400, 'Invalid status update'));
    }

    try {
        const subscription = await Subscription.findById(id);
        if (!subscription) {
            return next(errorHandler(404, 'Subscription not found'));
        }

        const oldStatus = subscription.status;

        // Determine the context based on provided type or fallback to current source
        // Ideally frontend should send 'blog' or 'guide' as type
        const targetType = type || (subscription.source === 'blogs_page' ? 'blog' : 'guide');

        if (status === 'revoked') {
            // Unset the specific preference
            if (subscription.preferences) {
                subscription.preferences[targetType] = false;
            }
            if (subscription.pendingPreferences) {
                subscription.pendingPreferences[targetType] = false;
            }

            // Check if any other subscription is still active/approved
            const hasOtherActive = Object.values(subscription.preferences || {}).some(val => val === true);

            if (!hasOtherActive) {
                // If nothing else is active, then we globally revoke
                subscription.status = 'revoked';
                if (reason) subscription.rejectionReason = reason;
            } else {
                // If others are active, we stay approved, just removed one permission
                subscription.status = 'approved';
            }
        }
        else if (status === 'rejected') {
            // Similar logic for rejection: remove preference & pending
            if (subscription.preferences) {
                subscription.preferences[targetType] = false;
            }
            if (subscription.pendingPreferences) {
                subscription.pendingPreferences[targetType] = false;
            }

            const hasOtherActive = Object.values(subscription.preferences || {}).some(val => val === true);

            if (!hasOtherActive) {
                subscription.status = 'rejected';
                if (reason) subscription.rejectionReason = reason;
            } else {
                // Revert to approved if they had other active subscriptions
                subscription.status = 'approved';
            }
        }
        else if (status === 'approved') {
            // Explicit Approval Logic
            subscription.status = 'approved';

            if (!subscription.preferences) subscription.preferences = {};
            subscription.preferences[targetType] = true; // Activate the specific type

            if (subscription.pendingPreferences) {
                subscription.pendingPreferences[targetType] = false; // clear pending flag
            }

            if (reason) subscription.rejectionReason = reason;
        }
        else {
            // Fallback for other statuses if any
            subscription.status = status;
            if (reason) subscription.rejectionReason = reason;
        }

        subscription.statusUpdatedAt = new Date();
        await subscription.save();

        // Send emails based on status change
        // We need to be careful with emails now. 
        // If we "revoked" just one, we should probably send a specific "You've been unsubscribed from X" email?
        // For now, retaining original logic but ensuring it matches the action.

        if (status === 'approved' && oldStatus !== 'approved') {
            await sendSubscriptionApprovedEmail(subscription.email, subscription.source);
        } else if (status === 'rejected' && subscription.status === 'rejected') {
            // Only send rejection email if globally rejected
            await sendSubscriptionRejectedEmail(subscription.email, subscription.source, reason);
        } else if (status === 'revoked' && subscription.status === 'revoked') {
            // Only send revoked email if globally revoked
            await sendSubscriptionRevokedEmail(subscription.email, subscription.source, reason);
        }

        res.status(200).json({ success: true, data: subscription, message: `Subscription updated` });
    } catch (error) {
        next(error);
    }
};

// --------------------------------------------------------------------------
// OTP CONTROLLERS
// --------------------------------------------------------------------------

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendSubscriptionOtp = async (req, res, next) => {
    const { email, source = 'website' } = req.body;
    const { otpTracking, requiresCaptcha } = req;
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection.remoteAddress;

    if (!email) {
        return next(errorHandler(400, 'Email is required'));
    }

    try {
        const emailLower = email.toLowerCase();

        // Check active lockout due to excessive OTP requests
        if (otpTracking && otpTracking.isLocked && otpTracking.isLocked()) {
            return res.status(429).json({
                success: false,
                message: "Too many OTP requests. Please try again in 15 minutes.",
                requiresCaptcha: false
            });
        }

        // IMPORTANT: Check if email exists in User database
        const user = await User.findOne({ email: emailLower });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'This email is not registered with UrbanSetu. Please sign up first to subscribe.'
            });
        }

        // Block OTP sending for suspended accounts
        if (user.status === 'suspended') {
            return res.status(403).json({
                success: false,
                message: "Your account has been suspended. Please contact support."
            });
        }

        // Block OTP sending if account is password-locked
        try {
            if (await isAccountLocked(user._id)) {
                const remainingMs = await getAccountLockRemainingMs(user._id, user.email);
                const remainingMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
                return res.status(423).json({
                    success: false,
                    message: `Account is temporarily locked due to too many failed attempts. Try again in about ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`
                });
            }
        } catch (_) { }

        let subscription = await Subscription.findOne({ email: emailLower });
        const type = source === 'blogs_page' ? 'blog' : 'guide';

        if (subscription) {
            // Check if already approved for this specific type
            if (subscription.status === 'approved' && subscription.preferences && subscription.preferences[type]) {
                return res.status(200).json({ success: false, message: `You are already subscribed to ${type}s!` });
            }

            // Check if already pending for this specific type
            const isPending = subscription.status === 'pending' &&
                ((subscription.pendingPreferences && subscription.pendingPreferences[type]) ||
                    (subscription.preferences && subscription.preferences[type]));

            if (isPending) {
                return res.status(200).json({ success: false, message: `Your ${type} subscription is already pending approval.` });
            }
        }

        // Increment OTP request count
        if (otpTracking) {
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
        }

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        // Store OTP in USER model temporarily
        user.tempSubscriptionOtp = otp;
        user.tempSubscriptionOtpExpires = otpExpires;
        user.tempSubscriptionType = type;
        user.tempSubscriptionSource = source;
        await user.save();

        const emailResult = await sendSubscriptionOtpEmail(emailLower, otp);

        if (!emailResult.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to send OTP. Please try again."
            });
        }

        // Log successful OTP request
        logSecurityEvent('subscription_otp_request_successful', {
            email: emailLower,
            userId: user._id,
            ip: ipAddress,
            requiresCaptcha: requiresCaptcha
        });

        // If 3 OTP requests within 5 minutes -> require captcha on subsequent requests
        if (otpTracking) {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (otpTracking.otpRequestCount >= 3 && otpTracking.lastOtpTimestamp >= fiveMinutesAgo) {
                otpTracking.requiresCaptcha = true;
                await otpTracking.save();
            }
        }

        res.status(200).json({
            success: true,
            message: 'OTP sent to your email. Please verify to complete subscription.',
            requiresCaptcha: false
        });
    } catch (error) {
        next(error);
    }
};

export const verifySubscriptionOtp = async (req, res, next) => {
    const { email, otp, source } = req.body;
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection.remoteAddress;

    if (!email || !otp) {
        return next(errorHandler(400, 'Email and OTP are required'));
    }

    try {
        const emailLower = email.toLowerCase();
        const user = await User.findOne({ email: emailLower }).select('+tempSubscriptionOtp +tempSubscriptionOtpExpires +tempSubscriptionType +tempSubscriptionSource');

        if (!user) {
            return next(errorHandler(404, 'User not found.'));
        }

        // Get OTP tracking
        const OtpTracking = (await import('../models/otpTracking.model.js')).default;
        const otpTracking = await OtpTracking.getOrCreateTracking(emailLower, ipAddress);

        if (otpTracking && otpTracking.isLocked && otpTracking.isLocked()) {
            return res.status(429).json({
                success: false,
                message: "Too many failed attempts. Please try again in 15 minutes.",
                requiresCaptcha: false
            });
        }

        if (!user.tempSubscriptionOtp || user.tempSubscriptionOtp !== otp) {
            if (otpTracking) {
                await otpTracking.incrementFailedAttempt();

                // If 5 wrong attempts within 15 minutes -> 15 min lock
                const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
                if (otpTracking.failedOtpAttempts >= 5 && otpTracking.lastFailedAttemptTimestamp >= fifteenMinutesAgo) {
                    await otpTracking.registerLockout(15 * 60 * 1000);
                    try {
                        const location = getLocationFromIP(ipAddress);
                        await sendAccountLockoutEmail(user.email, {
                            username: user.username,
                            attempts: 5,
                            lockoutDuration: '15 minutes',
                            ipAddress: ipAddress,
                            location,
                            device: 'Unknown (Subscription OTP Verification)',
                            reason: 'Excessive Failed OTP Attempts'
                        });
                    } catch (e) {
                        console.error('Failed to send OTP lockout email:', e);
                    }
                }
            }

            logSecurityEvent('subscription_otp_verification_failed', {
                email: emailLower,
                userId: user._id,
                ip: ipAddress
            });

            return next(errorHandler(400, otpTracking?.failedOtpAttempts >= 5 ? "Too many incorrect attempts. Please try again in 15 minutes." : "Invalid OTP"));
        }

        if (user.tempSubscriptionOtpExpires < Date.now()) {
            return next(errorHandler(400, 'OTP has expired. Please request a new one.'));
        }

        const type = user.tempSubscriptionType || (source === 'blogs_page' ? 'blog' : 'guide');
        const finalSource = user.tempSubscriptionSource || source;

        // Find or Create subscription record
        let subscription = await Subscription.findOne({ email: emailLower });

        if (!subscription) {
            subscription = new Subscription({
                email: emailLower,
                source: finalSource,
                status: 'pending',
                preferences: { blog: false, guide: false },
                pendingPreferences: {
                    blog: type === 'blog',
                    guide: type === 'guide'
                }
            });
        }

        // Clear user's temp OTP fields
        user.tempSubscriptionOtp = undefined;
        user.tempSubscriptionOtpExpires = undefined;
        user.tempSubscriptionType = undefined;
        user.tempSubscriptionSource = undefined;
        await user.save();

        // Reset tracking on success
        if (otpTracking) {
            await otpTracking.resetTracking();
            await otpTracking.clearLockout?.();
        }

        let message = '';

        subscription.status = 'pending';

        if (!subscription.pendingPreferences) subscription.pendingPreferences = {};
        subscription.pendingPreferences[type] = true;

        subscription.rejectionReason = undefined;
        subscription.source = finalSource || subscription.source;
        subscription.statusUpdatedAt = new Date();
        message = 'Your subscription request has been submitted for approval.';

        await subscription.save();

        // Log successful verification
        logSecurityEvent('subscription_otp_verification_successful', {
            email: emailLower,
            userId: user._id,
            ip: ipAddress
        });

        // Send 'Received' email since it's now a pending request
        await sendSubscriptionReceivedEmail(emailLower, subscription.source);

        res.status(200).json({ success: true, message });
    } catch (error) {
        next(error);
    }
};

export const sendUnsubscribeOtp = async (req, res, next) => {
    const email = req.user.email;
    const { otpTracking, requiresCaptcha } = req;
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection.remoteAddress;

    try {
        const emailLower = email.toLowerCase();

        // Check active lockout
        if (otpTracking && otpTracking.isLocked && otpTracking.isLocked()) {
            return res.status(429).json({
                success: false,
                message: "Too many OTP requests. Please try again in 15 minutes.",
                requiresCaptcha: false
            });
        }

        const subscription = await Subscription.findOne({ email: emailLower });

        if (!subscription) {
            return next(errorHandler(404, 'Subscription not found'));
        }

        // Increment OTP request count
        if (otpTracking) {
            await otpTracking.incrementOtpRequest();

            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
            if (otpTracking.otpRequestCount >= 5 && otpTracking.lastOtpTimestamp >= fifteenMinutesAgo) {
                await otpTracking.registerLockout(15 * 60 * 1000);
                return res.status(429).json({
                    success: false,
                    message: "Too many OTP requests. Please try again in 15 minutes.",
                    requiresCaptcha: false
                });
            }
        }

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        subscription.verificationOtp = otp;
        subscription.verificationOtpExpires = otpExpires;
        await subscription.save();

        await sendOptOutOtpEmail(emailLower, otp);

        // Log successful OTP request
        logSecurityEvent('unsubscribe_otp_request_successful', {
            email: emailLower,
            userId: req.user._id,
            ip: ipAddress,
            requiresCaptcha: requiresCaptcha
        });

        // 3 OTP requests within 5 minutes -> require captcha
        if (otpTracking) {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (otpTracking.otpRequestCount >= 3 && otpTracking.lastOtpTimestamp >= fiveMinutesAgo) {
                otpTracking.requiresCaptcha = true;
                await otpTracking.save();
            }
        }

        res.status(200).json({
            success: true,
            message: 'OTP sent for unsubscription verification.',
            requiresCaptcha: false
        });
    } catch (error) {
        next(error);
    }
};

export const verifyUnsubscribeOtp = async (req, res, next) => {
    const { otp, reason, email: providedEmail } = req.body;
    const email = req.user?.email || providedEmail;
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection.remoteAddress;

    if (!email || !otp) {
        return next(errorHandler(400, 'Email and OTP are required'));
    }

    try {
        const emailLower = email.toLowerCase();

        // Get OTP tracking
        const OtpTracking = (await import('../models/otpTracking.model.js')).default;
        const otpTracking = await OtpTracking.getOrCreateTracking(emailLower, ipAddress);

        if (otpTracking && otpTracking.isLocked && otpTracking.isLocked()) {
            return res.status(429).json({
                success: false,
                message: "Too many failed attempts. Please try again in 15 minutes.",
                requiresCaptcha: false
            });
        }

        const subscription = await Subscription.findOne({ email: emailLower }).select('+verificationOtp +verificationOtpExpires');

        if (!subscription) {
            return next(errorHandler(404, 'Subscription not found'));
        }

        if (subscription.verificationOtp !== otp) {
            if (otpTracking) {
                await otpTracking.incrementFailedAttempt();

                const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
                if (otpTracking.failedOtpAttempts >= 5 && otpTracking.lastFailedAttemptTimestamp >= fifteenMinutesAgo) {
                    await otpTracking.registerLockout(15 * 60 * 1000);
                    try {
                        const user = await User.findOne({ email: emailLower });
                        if (user) {
                            const location = getLocationFromIP(ipAddress);
                            await sendAccountLockoutEmail(user.email, {
                                username: user.username,
                                attempts: 5,
                                lockoutDuration: '15 minutes',
                                ipAddress: ipAddress,
                                location,
                                device: 'Unknown (Unsubscribe OTP Verification)',
                                reason: 'Excessive Failed OTP Attempts'
                            });
                        }
                    } catch (e) {
                        console.error('Failed to send OTP lockout email:', e);
                    }
                }
            }

            logSecurityEvent('unsubscribe_otp_verification_failed', {
                email: emailLower,
                ip: ipAddress
            });

            return next(errorHandler(400, otpTracking?.failedOtpAttempts >= 5 ? "Too many incorrect attempts. Please try again in 15 minutes." : "Invalid OTP"));
        }

        if (subscription.verificationOtpExpires < Date.now()) {
            return next(errorHandler(400, 'OTP has expired'));
        }

        // Verify & Opt-out
        subscription.verificationOtp = undefined;
        subscription.verificationOtpExpires = undefined;
        subscription.status = 'opted_out';
        subscription.statusUpdatedAt = new Date();
        if (reason) {
            subscription.rejectionReason = reason;
        }
        await subscription.save();

        // Reset tracking on success
        if (otpTracking) {
            await otpTracking.resetTracking();
            await otpTracking.clearLockout?.();
        }

        // Log successful verification
        logSecurityEvent('unsubscribe_otp_verification_successful', {
            email: emailLower,
            ip: ipAddress
        });

        res.status(200).json({ success: true, message: 'You have been successfully unsubscribed.' });
    } catch (error) {
        next(error);
    }
};
