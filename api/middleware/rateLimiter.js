// Rate limiting middleware for authentication endpoints
import { errorHandler } from '../utils/error.js';

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

// Specific rate limiters for different endpoints
export const signInRateLimit = createRateLimiter(
    60 * 1000, // 1 minute window
    5, // max 5 attempts
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

// Rate limiter for failed attempts (more restrictive)
export const failedAttemptsRateLimit = createRateLimiter(
    15 * 60 * 1000, // 15 minutes window
    10, // max 10 failed attempts
    'Too many failed attempts. Please try again in 15 minutes.'
);