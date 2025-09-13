import jwt from 'jsonwebtoken';
import { generateTokenPair } from './jwtUtils.js';

// Store for active sessions (in production, use Redis)
const activeSessions = new Map();

// Clean up expired sessions every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of activeSessions.entries()) {
        if (now > session.expiresAt) {
            activeSessions.delete(sessionId);
        }
    }
}, 5 * 60 * 1000);

// Create a new session
export const createSession = (userId, req) => {
    const sessionId = jwt.sign(
        { 
            userId, 
            type: 'session',
            timestamp: Date.now()
        }, 
        process.env.JWT_TOKEN, 
        { expiresIn: '7d' }
    );
    
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    const session = {
        sessionId,
        userId,
        ip,
        userAgent,
        createdAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        lastActivity: Date.now(),
        isActive: true
    };
    
    activeSessions.set(sessionId, session);
    
    return session;
};

// Get user's active sessions
export const getUserSessions = (userId) => {
    const userSessions = [];
    for (const [sessionId, session] of activeSessions.entries()) {
        if (session.userId === userId && session.isActive) {
            userSessions.push({
                sessionId,
                ip: session.ip,
                userAgent: session.userAgent,
                createdAt: session.createdAt,
                lastActivity: session.lastActivity,
                isCurrent: false // Will be set by caller
            });
        }
    }
    return userSessions;
};

// Update session activity
export const updateSessionActivity = (sessionId) => {
    const session = activeSessions.get(sessionId);
    if (session) {
        session.lastActivity = Date.now();
        activeSessions.set(sessionId, session);
    }
};

// Revoke a session
export const revokeSession = (sessionId) => {
    const session = activeSessions.get(sessionId);
    if (session) {
        session.isActive = false;
        activeSessions.set(sessionId, session);
        return true;
    }
    return false;
};

// Revoke all sessions for a user
export const revokeAllUserSessions = (userId) => {
    let revokedCount = 0;
    for (const [sessionId, session] of activeSessions.entries()) {
        if (session.userId === userId && session.isActive) {
            session.isActive = false;
            activeSessions.set(sessionId, session);
            revokedCount++;
        }
    }
    return revokedCount;
};

// Check if session is valid
export const isSessionValid = (sessionId) => {
    const session = activeSessions.get(sessionId);
    if (!session || !session.isActive) return false;
    
    const now = Date.now();
    if (now > session.expiresAt) {
        activeSessions.delete(sessionId);
        return false;
    }
    
    return true;
};

// Get session info
export const getSessionInfo = (sessionId) => {
    return activeSessions.get(sessionId);
};

// Detect concurrent logins
export const detectConcurrentLogins = (userId, currentSessionId) => {
    const userSessions = getUserSessions(userId);
    const activeSessions = userSessions.filter(s => s.sessionId !== currentSessionId);
    
    if (activeSessions.length > 0) {
        return {
            hasConcurrentLogins: true,
            activeSessions: activeSessions.length,
            sessions: activeSessions
        };
    }
    
    return {
        hasConcurrentLogins: false,
        activeSessions: 0,
        sessions: []
    };
};

// Clean up old sessions (keep only last 5 per user)
export const cleanupOldSessions = (userId) => {
    const userSessions = getUserSessions(userId);
    
    if (userSessions.length > 5) {
        // Sort by last activity and keep only the 5 most recent
        const sortedSessions = userSessions.sort((a, b) => b.lastActivity - a.lastActivity);
        const sessionsToRevoke = sortedSessions.slice(5);
        
        sessionsToRevoke.forEach(session => {
            revokeSession(session.sessionId);
        });
        
        return sessionsToRevoke.length;
    }
    
    return 0;
};