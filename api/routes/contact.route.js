import express from 'express';
import { 
    sendSupportMessage, 
    getAllSupportMessages, 
    markMessageAsRead, 
    markMessageAsReplied,
    getUnreadMessageCount,
    deleteSupportMessage,
    sendAdminReply,
    getUserSupportMessages,
    deleteUserMessage
} from '../controllers/contact.controller.js';
import { verifyToken } from '../utils/verify.js';

const router = express.Router();

// User routes
router.post('/support', sendSupportMessage);
router.get('/user-messages/:email', getUserSupportMessages);
router.delete('/user-messages/:messageId', deleteUserMessage);

// Admin routes
router.get('/messages', verifyToken, getAllSupportMessages);
router.get('/unread-count', verifyToken, getUnreadMessageCount);
router.put('/messages/:messageId/read', verifyToken, markMessageAsRead);
router.put('/messages/:messageId/replied', verifyToken, markMessageAsReplied);
router.post('/messages/:messageId/reply', verifyToken, sendAdminReply);
router.delete('/messages/:messageId', verifyToken, deleteSupportMessage);

export default router; 