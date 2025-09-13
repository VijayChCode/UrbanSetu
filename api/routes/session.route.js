import express from 'express';
import { getActiveSessions, revokeSessionById, revokeAllOtherSessions, updateActivity } from '../controllers/session.controller.js';
import { verifyToken } from '../utils/verify.js';

const router = express.Router();

// All session routes require authentication
router.use(verifyToken);

// Get active sessions
router.get('/active', getActiveSessions);

// Revoke specific session
router.delete('/:sessionId', revokeSessionById);

// Revoke all other sessions
router.delete('/all-other', revokeAllOtherSessions);

// Update session activity (middleware)
router.use(updateActivity);

export default router;