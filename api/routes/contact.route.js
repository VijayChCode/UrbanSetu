import express from 'express';
import { 
    sendSupportMessage, 
    getAllSupportMessages, 
    markMessageAsRead, 
    markMessageAsReplied,
    getUnreadMessageCount,
    deleteSupportMessage
} from '../controllers/contact.controller.js';

const router = express.Router();

// User routes
router.post('/support', sendSupportMessage);

// Admin routes
router.get('/messages', getAllSupportMessages);
router.get('/unread-count', getUnreadMessageCount);
router.put('/messages/:messageId/read', markMessageAsRead);
router.put('/messages/:messageId/replied', markMessageAsReplied);
router.delete('/messages/:messageId', deleteSupportMessage);

export default router; 