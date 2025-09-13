import { errorHandler } from '../utils/error.js';
import { getUserSessions, revokeSession, revokeAllUserSessions, updateSessionActivity } from '../utils/sessionManager.js';
import { verifyToken } from '../utils/verify.js';

// Get user's active sessions
export const getActiveSessions = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const sessions = getUserSessions(userId);
        
        // Mark current session
        const currentSessionId = req.cookies.session_id;
        const sessionsWithCurrent = sessions.map(session => ({
            ...session,
            isCurrent: session.sessionId === currentSessionId
        }));
        
        res.status(200).json({
            success: true,
            sessions: sessionsWithCurrent
        });
    } catch (error) {
        next(error);
    }
};

// Revoke a specific session
export const revokeSessionById = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user._id;
        
        // Get session info to verify ownership
        const session = getUserSessions(userId).find(s => s.sessionId === sessionId);
        
        if (!session) {
            return next(errorHandler(404, 'Session not found'));
        }
        
        const revoked = revokeSession(sessionId);
        
        if (revoked) {
            res.status(200).json({
                success: true,
                message: 'Session revoked successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to revoke session'
            });
        }
    } catch (error) {
        next(error);
    }
};

// Revoke all other sessions (keep current)
export const revokeAllOtherSessions = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const currentSessionId = req.cookies.session_id;
        
        const sessions = getUserSessions(userId);
        const otherSessions = sessions.filter(s => s.sessionId !== currentSessionId);
        
        let revokedCount = 0;
        otherSessions.forEach(session => {
            if (revokeSession(session.sessionId)) {
                revokedCount++;
            }
        });
        
        res.status(200).json({
            success: true,
            message: `${revokedCount} sessions revoked successfully`,
            revokedCount
        });
    } catch (error) {
        next(error);
    }
};

// Update session activity (called on each request)
export const updateActivity = async (req, res, next) => {
    try {
        const sessionId = req.cookies.session_id;
        if (sessionId) {
            updateSessionActivity(sessionId);
        }
        next();
    } catch (error) {
        next(error);
    }
};