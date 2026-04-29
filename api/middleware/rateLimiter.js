import { errorHandler } from '../utils/error.js';
import DataExport from '../models/dataExport.model.js';

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map();

// Clean up expired entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
        if (now > data.expiresAt) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

export const createRateLimiter = (windowMs, maxAttempts, message) => {
    return (req, res, next) => {
        const identifier = req.ip || req.connection.remoteAddress;
        const key = `${identifier}:${req.path}`;
        const now = Date.now();

        const existing = rateLimitStore.get(key);

        if (!existing) {
            // First attempt
            rateLimitStore.set(key, {
                attempts: 1,
                firstAttempt: now,
                expiresAt: now + windowMs
            });
            return next();
        }

        // Check if window has expired
        if (now > existing.expiresAt) {
            // Reset the window
            rateLimitStore.set(key, {
                attempts: 1,
                firstAttempt: now,
                expiresAt: now + windowMs
            });
            return next();
        }

        // Check if max attempts exceeded
        if (existing.attempts >= maxAttempts) {
            return next(errorHandler(429, message || 'Too many attempts. Please try again later.'));
        }

        // Increment attempts
        existing.attempts += 1;
        rateLimitStore.set(key, existing);

        next();
    };
};

// Global rate limiter for all requests
// Rate limiter for data export during conflict resolution (email-based, 24 hours cooldown)
export const deletedAccountExportRateLimit = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return next();

        const now = new Date();
        const windowMs = 24 * 60 * 60 * 1000;
        
        // Check DB for existing export for this email (since user is not logged in)
        const existingExport = await DataExport.findOne({ 
            userId: req.body.email, // We use email as ID for public exports in DataExport model if needed, or search by username/email
            expiresAt: { $gt: now }
        });

        // Better: Search for exports created within the last 24h for this email
        const recentExport = await DataExport.findOne({
            userId: { $ne: null }, // Just in case
            $or: [
                { userId: req.body.email },
                { username: req.body.email } // In some cases email might be stored in userId or username field for guest exports
            ],
            createdAt: { $gt: new Date(Date.now() - windowMs) }
        });

        if (recentExport) {
            const expiresAt = new Date(recentExport.createdAt.getTime() + windowMs);
            const timeRemainingMs = expiresAt - now;
            const timeRemainingHours = Math.floor(timeRemainingMs / (60 * 60 * 1000));
            const timeRemainingMinutes = Math.ceil(timeRemainingMs / (60 * 1000));

            let timeMessage;
            if (timeRemainingHours >= 1) {
                timeMessage = timeRemainingHours === 1 ? '1 hour' : `${timeRemainingHours} hours`;
            } else {
                timeMessage = timeRemainingMinutes <= 1 ? 'a few moments' : `${timeRemainingMinutes} minutes`;
            }

            return next(errorHandler(429, `A backup was recently sent to this email. You can request another one in ${timeMessage}.`));
        }

        next();
    } catch (error) {
        console.error('Deleted account export rate limiter error:', error);
        next();
    }
};

export const globalRateLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes window
    300, // max 300 requests per 15 minutes
    'Too many requests from this IP, please try again after 15 minutes'
);

// Specific rate limiters for different endpoints
export const signInRateLimit = createRateLimiter(
    60 * 1000, // 1 minute window
    10, // max 10 attempts per minute (more lenient)
    'Too many sign-in attempts. Please try again in a minute.'
);

export const signUpRateLimit = createRateLimiter(
    60 * 1000, // 1 minute window
    3, // max 3 attempts
    'Too many sign-up attempts. Please try again in a minute.'
);

export const forgotPasswordRateLimit = createRateLimiter(
    15 * 60 * 1000, // 15 minutes window
    3, // max 3 attempts
    'Too many password reset attempts. Please try again in 15 minutes.'
);

export const otpRateLimit = createRateLimiter(
    60 * 1000, // 1 minute window
    3, // max 3 OTP requests
    'Too many OTP requests. Please try again in a minute.'
);

// Specific limiter for OTP verification attempts (wrong OTP retries)
export const otpVerifyRateLimit = createRateLimiter(
    60 * 1000, // 1 minute window
    5, // max 5 verify attempts per minute
    'Too many incorrect OTP attempts. Please try again in a minute.'
);

// Rate limiter for failed attempts (more restrictive)
export const failedAttemptsRateLimit = createRateLimiter(
    15 * 60 * 1000, // 15 minutes window
    10, // max 10 failed attempts
    'Too many failed attempts. Please try again in 15 minutes.'
);

// Rate limiter for data export (user-based, 24 hours cooldown)
/**
 * Rate limiter for data export endpoint
 * Allows 1 export per 24 hours per user - DATABASE BACKED (Strong)
 */
export const dataExportRateLimit = async (req, res, next) => {
    try {
        // Only apply to authenticated users
        if (!req.user || !req.user.id) {
            return next(errorHandler(401, 'Authentication required for data export'));
        }

        const userId = req.user.id;
        const now = new Date();
        const windowMs = 24 * 60 * 60 * 1000;
        const maxExports = 1;

        // Check DB for existing export (Accurate across restarts/multiple servers)
        const existingExport = await DataExport.findOne({ userId: userId });

        if (!existingExport) {
            return next();
        }

        // Check if window has expired (TTL handles deletion, but we check for safety)
        const expiresAt = new Date(existingExport.expiresAt);
        if (now > expiresAt) {
            return next();
        }

        // Max exports exceeded
        const timeRemainingMs = expiresAt - now;
        const timeRemainingHours = Math.floor(timeRemainingMs / (60 * 60 * 1000));
        const timeRemainingMinutes = Math.ceil(timeRemainingMs / (60 * 1000));

        let timeMessage;
        if (timeRemainingHours >= 1) {
            timeMessage = timeRemainingHours === 1 ? '1 hour' : `${timeRemainingHours} hours`;
        } else {
            timeMessage = timeRemainingMinutes <= 1 ? 'a few moments' : `${timeRemainingMinutes} minutes`;
        }

        // Add rate limit headers
        res.set({
            'X-RateLimit-Limit': maxExports,
            'X-RateLimit-Remaining': 0,
            'X-RateLimit-Reset': expiresAt.toISOString(),
            'X-RateLimit-Window': '24 hours'
        });

        return next(errorHandler(429, `You can only export your data once per 24 hours. Please try again in ${timeMessage}.`, {
            rateLimitInfo: {
                limit: maxExports,
                windowMs: windowMs,
                resetTime: expiresAt.toISOString(),
                remaining: 0,
                timeRemaining: timeMessage
            }
        }));

    } catch (error) {
        console.error('Data export rate limiter error:', error);
        // On error, let the controller handle it
        next();
    }
};
