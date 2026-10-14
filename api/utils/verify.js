import { errorHandler } from "./error.js"
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import { ACCESS_TOKEN_MAX_AGE } from './jwtUtils.js';

// Throttle lastActive DB writes to at most once per 6 hours per session
const lastActiveUpdateCache = new Map();
const LAST_ACTIVE_THROTTLE = 6 * 60 * 60 * 1000; // 6 hours

// Clean up the throttle cache periodically to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of lastActiveUpdateCache.entries()) {
    if (now - ts > LAST_ACTIVE_THROTTLE) lastActiveUpdateCache.delete(key);
  }
}, 60 * 60 * 1000); // every hour

export const verifyToken = async (req, res, next) => {
  try {
    // 1. Try Authorization header first (Prioritize header-based auth)
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 2. Fallback to cookies if no header token
    if (!token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      return res.status(401).json({ message: 'Access token not found' });
    }
    const decoded = jwt.verify(token, process.env.JWT_TOKEN);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // MANDATORY Session check: The sessionId in the JWT must exist in user.activeSessions
    if (!decoded.sessionId) {
      // Legacy token or missing session ID
      return res.status(401).json({ message: 'Session ID missing in token. Please sign in again.' });
    }

    const session = Array.isArray(user.activeSessions) && user.activeSessions.find(s => s.sessionId === decoded.sessionId);
    if (!session) {
      // Clear auth cookies and reject
      res.clearCookie('access_token', { httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
      res.clearCookie('refresh_token', { httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
      res.clearCookie('session_id', { httpOnly: false, sameSite: 'none', secure: true, path: '/' });
      return res.status(401).json({ message: 'Session invalid or revoked' });
    }

    // Check absolute session expiry (90 days policy)
    if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
      // Clear session from DB
      await User.findByIdAndUpdate(user._id, { $pull: { activeSessions: { sessionId: decoded.sessionId } } });

      res.clearCookie('access_token', { httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
      res.clearCookie('refresh_token', { httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
      res.clearCookie('session_id', { httpOnly: false, sameSite: 'none', secure: true, path: '/' });
      return res.status(401).json({ message: 'Session expired. Please sign in again.' });
    }
    // SUSPENSION CHECK
    if (user.status === 'suspended') {
      res.clearCookie('access_token', {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
      });
      return res.status(403).json({ message: 'Your account is suspended. Please contact support.' });
    }
    // Refresh cookie expiry
    res.cookie('access_token', token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: ACCESS_TOKEN_MAX_AGE,
      path: '/'
    });

    // Update session lastActive in DB (throttled to once per 6 hours to avoid DB spam)
    if (decoded.sessionId) {
      const cacheKey = `${user._id}_${decoded.sessionId}`;
      const lastUpdate = lastActiveUpdateCache.get(cacheKey);
      if (!lastUpdate || Date.now() - lastUpdate > LAST_ACTIVE_THROTTLE) {
        lastActiveUpdateCache.set(cacheKey, Date.now());
        User.findOneAndUpdate(
          { _id: user._id, 'activeSessions.sessionId': decoded.sessionId },
          { $set: { 'activeSessions.$.lastActive': new Date() } }
        ).catch(() => {});
      }
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    next(error);
  }
};

// Optional authentication middleware - doesn't fail if no token provided
export const optionalAuth = async (req, res, next) => {
  try {
    // 1. Try Authorization header first (Prioritize header-based auth)
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 2. Fallback to cookies if no header token
    if (!token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      // No token provided, continue without authentication
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_TOKEN);
    const user = await User.findById(decoded.id);
    if (!user) {
      // Invalid user, continue without authentication
      req.user = null;
      return next();
    }

    // MANDATORY Session check for optionalAuth
    const session = Array.isArray(user.activeSessions) && user.activeSessions.find(s => s.sessionId === decoded.sessionId);
    if (!session || (session.expiresAt && new Date() > new Date(session.expiresAt))) {
      // Session revoked or expired, treat as guest
      req.user = null;
      return next();
    }

    // SUSPENSION CHECK
    if (user.status === 'suspended') {
      res.clearCookie('access_token', {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
      });
      // Suspended user, continue without authentication
      req.user = null;
      return next();
    }

    // Refresh cookie expiry
    res.cookie('access_token', token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: ACCESS_TOKEN_MAX_AGE,
      path: '/'
    });
    req.user = user;
    console.log('optionalAuth - User authenticated:', { id: user._id, role: user.role, email: user.email });
    next();
  } catch (error) {
    // Any error in authentication, continue without authentication
    console.log('optionalAuth - Authentication failed:', error.message);
    req.user = null;
    next();
  }
};

export const verifyAdmin = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (user.role === 'admin' || user.role === 'rootadmin' || user.isDefaultAdmin) {
      return next();
    }

    return res.status(403).json({ message: 'Access denied. Admin rights required.' });
  } catch (error) {
    next(error);
  }
};