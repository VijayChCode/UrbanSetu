import express from 'express';
import { chatWithGemini, getUserChatSessions, rateMessage, getMessageRatings, createNewSession, deleteSession, deleteAllSessions, bookmarkMessage, removeBookmark, getBookmarkedMessages, getAllMessageRatings, deleteRating, getSmartSuggestions, updateSessionHistory, getPolicyStatus, getUserReminders, rescheduleReminder, deleteReminder, dismissReminder, createReminder } from '../controllers/gemini.controller.js';
import { optionalAuth, verifyToken } from '../utils/verify.js';
import { aiChatRateLimit, getRateLimitStatus } from '../middleware/aiRateLimiter.js';
import { cleanupOldChatData, getDataRetentionStats, cleanupUserData } from '../services/dataRetentionService.js';

const router = express.Router();

// Chat endpoint with role-based rate limiting and optional authentication
router.post('/chat', optionalAuth, aiChatRateLimit, chatWithGemini);

// Get user's chat sessions (requires authentication)
router.get('/sessions', verifyToken, getUserChatSessions);

// Create a new chat session (requires authentication)
router.post('/sessions', verifyToken, createNewSession);

// Delete a chat session (requires authentication)
router.delete('/sessions/:sessionId', verifyToken, deleteSession);

// Delete all chat sessions (requires authentication)
router.delete('/sessions', verifyToken, deleteAllSessions);

// Update a chat session's history (for branching/versioning)
router.put('/sessions/:sessionId', verifyToken, updateSessionHistory);

// Rate a message (optional authentication for public users)
router.post('/rate', optionalAuth, rateMessage);

// Get message ratings for a session (requires authentication)
router.get('/ratings/:sessionId', verifyToken, getMessageRatings);

// Admin: Get all message ratings across users
router.get('/ratings-all', verifyToken, getAllMessageRatings);

// Admin: Delete a rating
router.delete('/rating/:ratingId', verifyToken, deleteRating);

// Bookmark a message (requires authentication)
router.post('/bookmark', verifyToken, bookmarkMessage);

// Remove bookmark from a message (requires authentication)
router.delete('/bookmark', verifyToken, removeBookmark);

// Get bookmarked messages for a session (requires authentication)
router.get('/bookmarks/:sessionId', verifyToken, getBookmarkedMessages);

// Get rate limit status (optional authentication)
router.get('/rate-limit-status', optionalAuth, (req, res) => {
    try {
        const status = getRateLimitStatus(req);
        res.json({
            success: true,
            rateLimit: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get rate limit status'
        });
    }
});

// Get policy violation status (optional authentication)
router.get('/policy-status', optionalAuth, getPolicyStatus);

// Data retention cleanup endpoints (admin only)
router.post('/cleanup-data', verifyToken, async (req, res) => {
    try {
        // Check if user is admin or rootadmin
        if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can run data cleanup'
            });
        }

        const { retentionDays = 30 } = req.body;
        const result = await cleanupOldChatData(retentionDays);

        res.json({
            success: true,
            message: 'Data cleanup completed successfully',
            result
        });
    } catch (error) {
        console.error('Data cleanup error:', error);
        res.status(500).json({
            success: false,
            message: 'Data cleanup failed'
        });
    }
});

// Get data retention statistics (admin only)
router.get('/data-stats', verifyToken, async (req, res) => {
    try {
        // Check if user is admin or rootadmin
        if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can view data statistics'
            });
        }

        const stats = await getDataRetentionStats();

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Data stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get data statistics'
        });
    }
});

// Clean up specific user's data (admin only)
router.post('/cleanup-user-data/:userId', verifyToken, async (req, res) => {
    try {
        // Check if user is admin or rootadmin
        if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can run user data cleanup'
            });
        }

        const { userId } = req.params;
        const { retentionDays = 30 } = req.body;
        const result = await cleanupUserData(userId, retentionDays);

        res.json({
            success: true,
            message: 'User data cleanup completed successfully',
            result
        });
    } catch (error) {
        console.error('User data cleanup error:', error);
        res.status(500).json({
            success: false,
            message: 'User data cleanup failed'
        });
    }
});

// Get AI-generated smart suggestions
router.post('/suggestions', optionalAuth, getSmartSuggestions);

// AI Task Reminder Routes
router.get('/reminders', verifyToken, getUserReminders);
router.post('/reminders', verifyToken, createReminder);
router.put('/reminders/:id/reschedule', verifyToken, rescheduleReminder);
router.delete('/reminders/:id', verifyToken, deleteReminder);
router.patch('/reminders/:id/dismiss', verifyToken, dismissReminder);

export default router;