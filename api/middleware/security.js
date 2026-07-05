import { errorHandler } from '../utils/error.js';
import crypto from 'crypto';
import User from '../models/user.model.js';
import PasswordLockout from '../models/passwordLockout.model.js';
import LoginAttempt from '../models/loginAttempt.model.js';
import { sendAccountLockoutEmail, sendRootAdminAttackEmail } from '../utils/emailService.js';
import { getLocationFromIP } from '../utils/sessionManager.js';

// Track failed login attempts (Persistent using LoginAttempt)
export const trackFailedAttempt = async (identifier, userId = null) => {
    try {
        await LoginAttempt.create({
            identifier,
            userId,
            status: 'failed',
            ipAddress: identifier
        });

        const attempts = await getFailedAttempts(identifier);

        // Send admin alert for suspicious activity
        if (attempts >= 3) {
            sendAdminAlert('brute_force_detected', {
                identifier,
                userId,
                attempts,
                timeWindow: '15 minutes'
            });
        }

        // If too many attempts, lock the account
        if (attempts >= 5 && userId) {
            // Check if user is rootadmin before locking (Prevent DoS on root admin)
            const user = await User.findById(userId).select('+securityLockToken +securityLockExpires');
            if (user && user.role === 'rootadmin') {
                console.log(`⚠️ Prevented lockout for rootadmin ${userId}`);
                sendAdminAlert('root_admin_attack_attempt', { identifier, userId, attempts });

                // Generate Security Tokens
                let lockToken = user.securityLockToken;
                let tokenExpiry = user.securityLockExpires;

                // Reuse existing valid token to prevent link invalidation during high-volume attacks
                if (!lockToken || !tokenExpiry || tokenExpiry < Date.now()) {
                    lockToken = crypto.randomBytes(32).toString('hex');
                    tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

                    user.securityLockToken = lockToken;
                    user.securityLockExpires = tokenExpiry;
                    // Reset unlock token only when generating a NEW lock token
                    user.securityUnlockToken = undefined;
                    user.securityUnlockExpires = undefined;

                    await user.save();
                }

                const clientUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
                const lockLink = `${clientUrl}/security/lock-account/${lockToken}`;

                // Send Critical Alert Email to Root Admin (Reminder/Warning, NOT Lockout)
                const location = getLocationFromIP(identifier);
                await sendRootAdminAttackEmail(user.email, {
                    username: user.username,
                    attempts,
                    ipAddress: identifier,
                    location,
                    lockLink
                });

                return { attempts };
            }

            await lockAccount(userId, 15 * 60 * 1000, { identifier, attempts, ipAddress: identifier }); // 15 minutes lockout
            
            // Send automated lockout email to user
            try {
                const location = getLocationFromIP(identifier);
                await sendAccountLockoutEmail(user.email, {
                    username: user.username,
                    attempts,
                    lockoutDuration: '15 minutes',
                    ipAddress: identifier,
                    location: location,
                    device: 'Unknown (Login Screen)', // We could parse User-Agent here if available in context
                    reason: 'Brute Force Detection'
                });
            } catch (emailErr) {
                console.error("Failed to send lockout email to user:", emailErr);
            }

            sendAdminAlert('account_locked', {
                userId,
                identifier,
                attempts,
                lockoutDuration: '15 minutes'
            });
        }

        return { attempts };
    } catch (error) {
        console.error('Error tracking failed attempt:', error);
        return { attempts: 0 };
    }
};

// Lock account
export const lockAccount = async (userId, duration, { identifier = undefined, attempts = 0, ipAddress = undefined } = {}) => {
    try {
        // Fetch email for better visibility in admin tables
        let email = undefined;
        try {
            const user = await User.findById(userId).select('email');
            email = user?.email || undefined;
        } catch (_) { }

        await PasswordLockout.lockUser({
            userId,
            email,
            identifier,
            attempts,
            durationMs: duration,
            ipAddress: ipAddress || identifier
        });
    } catch (err) {
        console.error('Failed to persist password lockout:', err);
    }
};

// Check if account is locked
export const isAccountLocked = async (userId) => {
    return PasswordLockout.isLocked({ userId });
};

export const getAccountLockRemainingMs = async (userId, email) => {
    return PasswordLockout.getRemainingMs({ userId, email });
};

// Clear failed attempts on successful login
export const clearFailedAttempts = async (identifier) => {
    try {
        // Log the success first (for intelligence)
        await LoginAttempt.create({
            identifier,
            status: 'success',
            ipAddress: identifier
        });

        // Delete recent failures to reset the counter for this window
        const windowStart = new Date(Date.now() - 15 * 60 * 1000);
        await LoginAttempt.deleteMany({
            identifier,
            status: 'failed',
            timestamp: { $gte: windowStart }
        });
    } catch (error) {
        console.error('Error clearing failed attempts:', error);
    }
};

// Get failed attempts count
export const getFailedAttempts = async (identifier) => {
    try {
        const windowStart = new Date(Date.now() - 15 * 60 * 1000);
        return await LoginAttempt.countDocuments({
            identifier,
            status: 'failed',
            timestamp: { $gte: windowStart }
        });
    } catch (error) {
        console.error('Error getting failed attempts:', error);
        return 0;
    }
};

// Brute force protection middleware
export const bruteForceProtection = async (req, res, next) => {
    try {
        const identifier = req.ip || req.connection.remoteAddress;
        const { email } = req.body;

        // Check if account is locked
        if (email) {
            const user = await User.findOne({ email: email.toLowerCase() });

            // Check manual emergency lock
            if (user && user.isLocked) {
                return next(errorHandler(423, 'Your account has been manually locked for security reasons. Please use the unlock link sent to your email or contact support.'));
            }

            if (user && await isAccountLocked(user._id)) {
                const remainingMs = await getAccountLockRemainingMs(user._id, user.email);
                const remainingMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
                return next(errorHandler(423, `Account is temporarily locked due to too many failed attempts. Try again in about ${remainingMinutes} minute${remainingMinutes > 1 ? 's, or reset your password' : ''}.`));
            }
        }

        // Only check for excessive failed attempts (10+ in 15 minutes)
        // This allows normal users to attempt login even after a few failures
        const failedAttempts = await getFailedAttempts(identifier);
        if (failedAttempts >= 10) {
            return next(errorHandler(429, 'Too many failed attempts. Please try again in 15 minutes.'));
        }

        next();
    } catch (error) {
        next(error);
    }
};

// Security event logging
export const logSecurityEvent = (event, details) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        event,
        details,
        severity: getSeverityLevel(event)
    };

    console.log(`[SECURITY] ${JSON.stringify(logEntry)}`);
    // In production, send to logging service
};

// Get severity level for security events
const getSeverityLevel = (event) => {
    const highSeverityEvents = ['account_locked', 'brute_force_detected', 'suspicious_login'];
    const mediumSeverityEvents = ['failed_login', 'password_reset_attempt'];

    if (highSeverityEvents.includes(event)) return 'HIGH';
    if (mediumSeverityEvents.includes(event)) return 'MEDIUM';
    return 'LOW';
};

// Admin alert for suspicious activity
export const sendAdminAlert = (event, details) => {
    const alert = {
        timestamp: new Date().toISOString(),
        event,
        details,
        action: 'REQUIRED',
        severity: getSeverityLevel(event)
    };

    console.log(`[ADMIN ALERT] ${JSON.stringify(alert)}`);
};

// Check for suspicious login patterns
export const checkSuspiciousLogin = async (userId, ip, userAgent, location = null) => {
    const suspiciousPatterns = [];

    // Check for unusual user agent patterns
    if (userAgent && userAgent.includes('bot')) {
        suspiciousPatterns.push('bot_user_agent');
    }

    // Check for rapid successive logins
    const recentLogins = await getRecentLogins(userId);
    if (recentLogins.length > 5) {
        suspiciousPatterns.push('rapid_successive_logins');
    }

    // Check for New Location (Geo-Intelligence)
    // accessible since we are now logging successful attempts with IP
    if (recentLogins.length > 1) {
        // recentLogins[0] is current (just inserted), recentLogins[1] is previous
        const previousLogin = recentLogins[1];
        const previousLocation = getLocationFromIP(previousLogin.ipAddress);
        const currentLocation = location || getLocationFromIP(ip);

        // Simple check: significantly different location string (e.g., "London, GB" vs "Mumbai, IN")
        // Ignore "Unknown" or local variations
        if (
            currentLocation && previousLocation &&
            currentLocation !== 'Unknown' && previousLocation !== 'Unknown' &&
            currentLocation !== 'Local Development' &&
            currentLocation !== previousLocation
        ) {
            suspiciousPatterns.push('new_location_detected');

            // Optional: Check for "Impossible Travel" (Basic)
            const timeDiff = new Date() - new Date(previousLogin.timestamp);
            if (timeDiff < 60 * 60 * 1000) { // If location changed within 1 hour
                suspiciousPatterns.push('impossible_travel_velocity');
            }
        }
    }

    if (suspiciousPatterns.length > 0) {
        sendAdminAlert('suspicious_login', {
            userId,
            ip,
            userAgent,
            location,
            patterns: suspiciousPatterns
        });
    }

    return { isSuspicious: suspiciousPatterns.length > 0, patterns: suspiciousPatterns };
};

// Get recent logins for a user
const getRecentLogins = async (userId) => {
    try {
        // Retrieve successful logins from the last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return await LoginAttempt.find({
            userId,
            status: 'success',
            timestamp: { $gte: oneDayAgo }
        }).sort({ timestamp: -1 }).limit(20);
    } catch (error) {
        return [];
    }
};

// Monitor for unusual signup patterns
export const checkSuspiciousSignup = (email, ip, userAgent) => {
    const suspiciousPatterns = [];

    // Check for disposable email domains
    const disposableDomains = ['10minutemail.com', 'tempmail.org', 'guerrillamail.com'];
    const domain = email.split('@')[1];
    if (disposableDomains.includes(domain)) {
        suspiciousPatterns.push('disposable_email');
    }

    // Mock check for rapid signups (implementation pending persistent storage for signups)
    // const recentSignups = await getRecentSignups(ip);
    // if (recentSignups.length > 3) ...

    if (suspiciousPatterns.length > 0) {
        sendAdminAlert('suspicious_signup', {
            email,
            ip,
            userAgent,
            patterns: suspiciousPatterns
        });
    }

    return suspiciousPatterns;
};
