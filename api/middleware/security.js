import { errorHandler } from '../utils/error.js';
import User from '../models/user.model.js';

// Store for failed login attempts (in production, use Redis)
const failedAttemptsStore = new Map();
const accountLockouts = new Map();

// Clean up expired entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    
    // Clean up failed attempts
    for (const [key, data] of failedAttemptsStore.entries()) {
        if (now > data.expiresAt) {
            failedAttemptsStore.delete(key);
        }
    }
    
    // Clean up account lockouts
    for (const [key, data] of accountLockouts.entries()) {
        if (now > data.unlockAt) {
            accountLockouts.delete(key);
        }
    }
}, 5 * 60 * 1000);

// Track failed login attempts
export const trackFailedAttempt = (identifier, userId = null) => {
    const key = `failed_attempts:${identifier}`;
    const now = Date.now();
    
    const existing = failedAttemptsStore.get(key) || {
        attempts: 0,
        firstAttempt: now,
        expiresAt: now + 15 * 60 * 1000, // 15 minutes
        userId
    };
    
    existing.attempts += 1;
    existing.lastAttempt = now;
    
    failedAttemptsStore.set(key, existing);
    
    // Send admin alert for suspicious activity
    if (existing.attempts >= 3) {
        sendAdminAlert('brute_force_detected', {
            identifier,
            userId,
            attempts: existing.attempts,
            timeWindow: '15 minutes'
        });
    }
    
    // If too many attempts, lock the account
    if (existing.attempts >= 5) {
        if (userId) {
            lockAccount(userId, 30 * 60 * 1000); // 30 minutes lockout
            sendAdminAlert('account_locked', {
                userId,
                identifier,
                attempts: existing.attempts,
                lockoutDuration: '30 minutes'
            });
        }
    }
    
    return existing;
};

// Lock account
export const lockAccount = (userId, duration) => {
    const unlockAt = Date.now() + duration;
    accountLockouts.set(`lockout:${userId}`, {
        userId,
        lockedAt: Date.now(),
        unlockAt
    });
    
    // Update user status in database
    User.findByIdAndUpdate(userId, { 
        status: 'locked',
        lockedUntil: new Date(unlockAt)
    }).catch(console.error);
};

// Check if account is locked
export const isAccountLocked = (userId) => {
    const lockoutData = accountLockouts.get(`lockout:${userId}`);
    if (!lockoutData) return false;
    
    if (Date.now() > lockoutData.unlockAt) {
        accountLockouts.delete(`lockout:${userId}`);
        return false;
    }
    
    return true;
};

// Clear failed attempts on successful login
export const clearFailedAttempts = (identifier) => {
    const key = `failed_attempts:${identifier}`;
    failedAttemptsStore.delete(key);
};

// Get failed attempts count
export const getFailedAttempts = (identifier) => {
    const key = `failed_attempts:${identifier}`;
    const data = failedAttemptsStore.get(key);
    return data ? data.attempts : 0;
};

// Brute force protection middleware
export const bruteForceProtection = (req, res, next) => {
    const identifier = req.ip || req.connection.remoteAddress;
    const { email } = req.body;
    
    // Check if account is locked
    if (email) {
        User.findOne({ email: email.toLowerCase() })
            .then(user => {
                if (user && isAccountLocked(user._id)) {
                    return next(errorHandler(423, 'Account is temporarily locked due to too many failed attempts. Please try again later.'));
                }
                
                // Check failed attempts
                const failedAttempts = getFailedAttempts(identifier);
                if (failedAttempts >= 3) {
                    return next(errorHandler(429, 'Too many failed attempts. Please try again in 15 minutes.'));
                }
                
                next();
            })
            .catch(next);
    } else {
        next();
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
    // sendToLoggingService(logEntry);
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
    
    // In production, send to admin notification service
    // sendToAdminNotificationService(alert);
};

// Check for suspicious login patterns
export const checkSuspiciousLogin = (userId, ip, userAgent, location = null) => {
    // This would typically check against historical data
    // For now, we'll implement basic checks
    
    const suspiciousPatterns = [];
    
    // Check for unusual IP patterns (would need historical data)
    // Check for unusual user agent patterns
    if (userAgent && userAgent.includes('bot')) {
        suspiciousPatterns.push('bot_user_agent');
    }
    
    // Check for rapid successive logins
    const recentLogins = getRecentLogins(userId);
    if (recentLogins.length > 5) {
        suspiciousPatterns.push('rapid_successive_logins');
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
    
    return suspiciousPatterns;
};

// Get recent logins for a user (mock implementation)
const getRecentLogins = (userId) => {
    // In production, this would query a login history table
    return [];
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
    
    // Check for rapid signups from same IP
    const recentSignups = getRecentSignups(ip);
    if (recentSignups.length > 3) {
        suspiciousPatterns.push('rapid_signups_from_ip');
    }
    
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

// Get recent signups from IP (mock implementation)
const getRecentSignups = (ip) => {
    // In production, this would query a signup history table
    return [];
};