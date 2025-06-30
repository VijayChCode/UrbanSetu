import express from 'express';
import {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  deleteNotification,
  deleteAllNotifications,
  adminSendNotification,
  getAllUsersForNotifications,
  adminSendNotificationToAll,
} from '../controllers/notification.controller.js';
import { verifyToken } from '../utils/verify.js';

const router = express.Router();

// Create notification (admin only)
router.post('/create', verifyToken, createNotification);

// Get user notifications
router.get('/user', verifyToken, getUserNotifications);

// Mark notification as read
router.put('/:notificationId/read', verifyToken, markNotificationAsRead);

// Mark all notifications as read
router.put('/user/read-all', verifyToken, markAllNotificationsAsRead);

// Get unread notification count
router.get('/user/unread-count', verifyToken, getUnreadNotificationCount);

// Delete notification
router.delete('/:notificationId', verifyToken, deleteNotification);

// Delete all notifications for a user
router.delete('/user/all', verifyToken, deleteAllNotifications);

// Admin routes for notification management
router.post('/admin/send', verifyToken, adminSendNotification);
router.post('/admin/send-all', verifyToken, adminSendNotificationToAll);
router.get('/admin/users', verifyToken, getAllUsersForNotifications);

export default router; 