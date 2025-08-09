import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import Listing from '../models/listing.model.js';
import { errorHandler } from '../utils/error.js';
import Booking from '../models/booking.model.js';

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

// Report a chat message: create notifications for all admins/rootadmins
export const reportChatMessage = async (req, res, next) => {
  try {
    const { appointmentId, commentId, reason, details } = req.body;
    if (!appointmentId || !commentId || !reason) {
      return res.status(400).json({ success: false, message: 'appointmentId, commentId and reason are required' });
    }

    // Load appointment and related data
    const appointment = await Booking.findById(appointmentId)
      .populate('buyerId', 'username email')
      .populate('sellerId', 'username email')
      .populate('listingId', 'name address');
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Find the reported comment
    const comment = appointment.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Message not found in this appointment' });
    }

    // Build a clear notification text for admins
    const reporterName = req.user?.username || 'Unknown';
    const reporterEmail = req.user?.email || '';
    const buyer = appointment.buyerId;
    const seller = appointment.sellerId;
    const listing = appointment.listingId;
    const messageText = comment.originalMessage || comment.message || '[no content]';

    const title = `Chat message reported: ${reason}`;
    const lines = [
      `Reporter: ${reporterName} (${reporterEmail})`,
      `Appointment: ${appointment._id.toString()}${listing ? ` — ${listing.name}` : ''}`,
      `Between: ${buyer?.username || 'Buyer'} (${buyer?.email || 'n/a'}) ↔ ${seller?.username || 'Seller'} (${seller?.email || 'n/a'})`,
      `Message ID: ${commentId}`,
      `Message excerpt: "${messageText.substring(0, 300)}"`,
      details ? `Reporter notes: ${details}` : null,
    ].filter(Boolean);
    const message = lines.join('\n');

    // Find all admins and root admins (active, approved)
    const admins = await User.find({
      status: { $ne: 'suspended' },
      $or: [
        { role: 'rootadmin' },
        { role: 'admin', adminApprovalStatus: 'approved' },
      ],
    }, '_id');

    if (admins.length === 0) {
      return res.status(200).json({ success: true, message: 'No admins found to notify' });
    }

    // Create notifications for each admin
    const notifications = admins.map(a => ({
      userId: a._id,
      type: 'admin_message',
      title,
      message,
      adminId: null,
    }));

    const created = await Notification.insertMany(notifications);

    // Emit socket event to each admin for real-time updates
    const io = req.app.get('io');
    if (io) {
      created.forEach(n => {
        io.to(n.userId.toString()).emit('notificationCreated', n);
      });
    }

    return res.status(201).json({ success: true, count: created.length });
  } catch (error) {
    next(error);
  }
};

// Get user notifications
export const getUserNotifications = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // Verify the user is requesting their own notifications
    if (req.user.id !== userId && req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return next(errorHandler(403, 'You can only view your own notifications'));
    }

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
    const { userId } = req.params;

    // Verify the user is marking their own notifications
    if (req.user.id !== userId && req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return next(errorHandler(403, 'You can only mark your own notifications as read'));
    }

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
    const { userId } = req.params;

    // Verify the user is requesting their own count
    if (req.user.id !== userId && req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return next(errorHandler(403, 'You can only view your own notification count'));
    }

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
    const { userId } = req.params;

    if (req.user.id !== userId && req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return next(errorHandler(403, 'You can only delete your own notifications'));
    }

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