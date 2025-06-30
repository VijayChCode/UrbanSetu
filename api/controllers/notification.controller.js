import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import Listing from '../models/listing.model.js';
import { errorHandler } from '../utils/error.js';

// Create notification
export const createNotification = async (req, res, next) => {
  try {
    const { userId, type, title, message, listingId, adminId } = req.body;

    const notification = new Notification({
      userId,
      type,
      title,
      message,
      listingId,
      adminId,
    });

    const savedNotification = await notification.save();
    res.status(201).json(savedNotification);
  } catch (error) {
    next(error);
  }
};

// Get user notifications
export const getUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .populate('listingId', 'name address')
      .populate('adminId', 'username email');

    res.status(200).json(notifications);
  } catch (error) {
    next(error);
  }
};

// Mark notification as read
export const markNotificationAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const { userId } = req.body;

    // Verify the user owns this notification
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return next(errorHandler(404, 'Notification not found'));
    }

    if (notification.userId.toString() !== userId && req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return next(errorHandler(403, 'You can only mark your own notifications as read'));
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.status(200).json(notification);
  } catch (error) {
    next(error);
  }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

// Get unread notification count
export const getUnreadNotificationCount = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const count = await Notification.countDocuments({ userId, isRead: false });
    res.status(200).json({ count });
  } catch (error) {
    next(error);
  }
};

// Delete notification
export const deleteNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const { userId } = req.body;

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return next(errorHandler(404, 'Notification not found'));
    }

    if (notification.userId.toString() !== userId && req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return next(errorHandler(403, 'You can only delete your own notifications'));
    }

    await Notification.findByIdAndDelete(notificationId);
    res.status(200).json({ message: 'Notification deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Delete all notifications for a user
export const deleteAllNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await Notification.deleteMany({ userId });
    res.status(200).json({ message: 'All notifications deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Admin sends notification to user
export const adminSendNotification = async (req, res, next) => {
  try {
    const { userId, title, message, type = 'admin_message' } = req.body;
    
    // Validate required fields
    if (!userId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'User ID, title, and message are required'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create notification
    const notification = new Notification({
      userId: userId,
      type: type,
      title: title,
      message: message,
      adminId: req.user.id,
    });

    await notification.save();

    res.status(201).json({
      success: true,
      message: `Notification sent successfully to ${user.email}`,
      notification
    });
  } catch (error) {
    next(error);
  }
};

// Get all users for admin notification dropdown
export const getAllUsersForNotifications = async (req, res, next) => {
  try {
    const users = await User.find(
      { 
        status: { $ne: 'suspended' },
        role: { $ne: 'admin' },
        role: { $ne: 'rootadmin' }
      },
      'email username _id'
    ).sort({ email: 1 });

    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};

// Admin sends notification to all users
export const adminSendNotificationToAll = async (req, res, next) => {
  try {
    const { title, message, type = 'admin_message' } = req.body;
    
    // Validate required fields
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    // Get all regular users (exclude admins and suspended users)
    const users = await User.find(
      { 
        status: { $ne: 'suspended' },
        role: { $ne: 'admin' },
        role: { $ne: 'rootadmin' }
      },
      '_id'
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No users found to notify'
      });
    }

    // Create notifications for all users
    const notifications = users.map(user => ({
      userId: user._id,
      type: type,
      title: title,
      message: message,
      adminId: req.user.id,
    }));

    await Notification.insertMany(notifications);

    res.status(201).json({
      success: true,
      message: `Notification sent successfully to ${users.length} users`,
      count: users.length
    });
  } catch (error) {
    next(error);
  }
}; 