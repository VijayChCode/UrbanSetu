import express from 'express';
import { verifyToken } from '../utils/verify.js';
import {
    saveChatMessage,
    getChatHistory,
    getUserChatSessions,
    clearChatHistory,
    clearAllChatHistory,
    deleteChatSession,
    updateChatSession,
    getImageFaceTags
} from '../controllers/chatHistory.controller.js';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Save a chat message
router.post('/save', saveChatMessage);

// Get chat history for a specific session
router.get('/session/:sessionId', getChatHistory);

// Get face tags of a specific image in a chat session
router.get('/session/:sessionId/image-face-tags', getImageFaceTags);

// Update an existing chat session
router.put('/session/:sessionId', updateChatSession);

// Get all chat sessions for the authenticated user
router.get('/sessions', getUserChatSessions);

// Clear chat history for a specific session
router.delete('/session/:sessionId/clear', clearChatHistory);

// Clear all chat history for the authenticated user
router.delete('/clear-all', clearAllChatHistory);

// Delete a specific chat session
router.delete('/session/:sessionId', deleteChatSession);

export default router;