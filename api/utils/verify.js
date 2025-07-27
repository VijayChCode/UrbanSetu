import { errorHandler } from "./error.js"
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

export const verifyToken = async (req, res, next) => {
  try {
    // Try to get token from cookies first (preferred method)
    let token = req.cookies.access_token;
    
    // If no cookie token, try Authorization header as fallback (for third-party cookie blocking)
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7); // Remove 'Bearer ' prefix
      }
    }
    
    if (!token) {
      return res.status(401).json({ message: 'Access token not found' });
    }
    const decoded = jwt.verify(token, process.env.JWT_TOKEN);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
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
      secure: process.env.NODE_ENV === 'production'
    });
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