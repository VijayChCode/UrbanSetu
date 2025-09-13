import crypto from 'crypto';
import { errorHandler } from '../utils/error.js';

// Store for CSRF tokens (in production, use Redis)
const csrfTokenStore = new Map();

// Clean up expired CSRF tokens every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of csrfTokenStore.entries()) {
        if (now > data.expiresAt) {
            csrfTokenStore.delete(token);
        }
    }
}, 10 * 60 * 1000);

// Generate CSRF token
export const generateCSRFToken = (req, res, next) => {
    try {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
        
        // Store token with expiration
        csrfTokenStore.set(token, {
            expiresAt,
            sessionId: req.sessionID || req.ip // Use session ID or IP as identifier
        });
        
        // Set token in cookie
        res.cookie('csrf_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 1000 // 1 hour
        });
        
        res.locals.csrfToken = token;
        next();
    } catch (error) {
        next(error);
    }
};

// Verify CSRF token
export const verifyCSRFToken = (req, res, next) => {
    try {
        const token = req.body._csrf || req.headers['x-csrf-token'];
        const cookieToken = req.cookies.csrf_token;
        
        if (!token || !cookieToken) {
            return next(errorHandler(403, 'CSRF token missing'));
        }
        
        if (token !== cookieToken) {
            return next(errorHandler(403, 'Invalid CSRF token'));
        }
        
        // Check if token exists in store and is not expired
        const tokenData = csrfTokenStore.get(token);
        if (!tokenData || Date.now() > tokenData.expiresAt) {
            return next(errorHandler(403, 'CSRF token expired'));
        }
        
        // Check session identifier
        const sessionId = req.sessionID || req.ip;
        if (tokenData.sessionId !== sessionId) {
            return next(errorHandler(403, 'CSRF token mismatch'));
        }
        
        // Remove used token (one-time use)
        csrfTokenStore.delete(token);
        
        next();
    } catch (error) {
        next(error);
    }
};

// Get CSRF token for forms
export const getCSRFToken = (req, res) => {
    const token = req.cookies.csrf_token;
    if (!token) {
        return res.status(400).json({ error: 'CSRF token not found' });
    }
    
    const tokenData = csrfTokenStore.get(token);
    if (!tokenData || Date.now() > tokenData.expiresAt) {
        return res.status(400).json({ error: 'CSRF token expired' });
    }
    
    res.json({ csrfToken: token });
};