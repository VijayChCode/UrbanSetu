import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import Listing from '../models/listing.model.js';
import { errorHandler } from '../utils/error.js';
import Booking from '../models/booking.model.js';
import ReportAudit from '../models/reportAudit.model.js';

// Helper to parse a structured report from notification title+message
const parseReportFromNotification = (n) => {
  // Our titles: "Chat message reported" | "Chat conversation reported"
  const type = n.title?.toLowerCase().includes('message') ? 'message' : 'chat';
  const lines = (n.message || '').split('\n');
  const get = (prefix) => (lines.find(l => l.startsWith(prefix + ':')) || '').split(':').slice(1).join(':').trim();
  const reason = get('Reason');
  const reporter = get('Reporter');
  const appointmentLine = get('Appointment');
  const between = get('Between');
  const messageId = get('Message ID') || null;
  const messageExcerptLine = get('Message excerpt') || '';
  const details = get('Additional details') || '';
  const totalMessages = Number(get('Total Messages')) || null;
  const appointmentDate = get('Appointment Date') || null;
  const propertyLine = get('Property') || null;

  return {
    notificationId: n._id,
    type, // 'message' | 'chat'
    reason,
    reporter,
    appointmentRef: appointmentLine || null,
    between,
    messageId,
    messageExcerpt: messageExcerptLine.replace(/^"|"$/g, ''),
    details: details || null,
    totalMessages,
    appointmentDate,
    property: propertyLine,
    createdAt: n.createdAt,
    isRead: n.isRead,
  };
};

// Helper to parse review reports from notification
const parseReviewReportFromNotification = (n) => {
  // Parse the message format: "A review for property \"Property Name\" was reported by username for: Category - Details"
  const message = n.message || '';
  const propertyMatch = message.match(/property "([^"]+)"/);
  const reporterMatch = message.match(/reported by ([^\\s]+)/);
  const categoryMatch = message.match(/for: ([^-]+)/);
  const detailsMatch = message.match(/- (.+)$/);

  return {
    notificationId: n._id,
    type: 'review',
    propertyName: propertyMatch ? propertyMatch[1] : 'Unknown Property',
    reporter: reporterMatch ? reporterMatch[1] : 'Unknown User',
    category: n.meta?.category || (categoryMatch ? categoryMatch[1].trim() : 'Unknown Category'),
    details: n.meta?.reason || (detailsMatch ? detailsMatch[1].trim() : ''),
    reviewId: n.meta?.reviewId || null,
    listingId: n.listingId || null,
    reporterId: n.meta?.reporterId || null,
    reporterEmail: n.meta?.reporterEmail || null,
    reporterPhone: n.meta?.reporterPhone || null,
    reporterRole: n.meta?.reporterRole || null,
    createdAt: n.createdAt,
    isRead: n.isRead,
  };
};

// GET structured reported notifications for admins
export const getReportedNotifications = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Admins only' });
    }

    const {
      appointmentId,
      dateFrom,
      dateTo,
      reporter,
      status,
      search,
      sortBy = 'date',
      sortOrder = 'desc',
      messageType,
      messageId
    } = req.query;

    // Build date filter
    const dateFilter = {};
    if (dateFrom) {
      dateFilter.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = endDate;
    }

    // Fetch ALL notifications for these types (ignore userId to show global view for all admins)
    // This ensures root admins and other admins see the same, complete list of reports
    const query = {
      title: { $in: ['Chat message reported', 'Chat conversation reported', 'Review Reported'] },
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
    };

    const notifications = await Notification.find(query).sort({ createdAt: -1 });

    // Parse to structured reports
    let rawReports = notifications.map(n => {
      if (n.title === 'Review Reported') {
        return parseReviewReportFromNotification(n);
      } else {
        return parseReportFromNotification(n);
      }
    });

    // Deduplicate reports (since notifications are broadcast to multiple admins, duplicates exist)
    const uniqueReports = new Map();
    rawReports.forEach(report => {
      // Create a unique key based on the report content to merge duplicates
      let uniqueKey;
      if (report.type === 'review') {
        // Review report key: Property + Reporter + Category + Details
        uniqueKey = `review-${report.propertyName}-${report.reporter}-${report.category}-${report.details}`;
      } else {
        // Chat/Message report key: Type + Reporter + Reason + Appointment + MessageId/Excerpt
        uniqueKey = `${report.type}-${report.reporter}-${report.reason}-${report.appointmentRef}-${report.messageId || 'conv'}-${report.messageExcerpt || ''}`;
      }

      // Only keep the first occurrence (closest to sort order, or arbitrary)
      if (!uniqueReports.has(uniqueKey)) {
        uniqueReports.set(uniqueKey, report);
      }
    });

    let reports = Array.from(uniqueReports.values());

    // Apply filters
    if (appointmentId) {
      reports = reports.filter(r => r.appointmentRef && r.appointmentRef.includes(appointmentId));
    }

    if (messageId) {
      reports = reports.filter(r => r.messageId === messageId);
    }

    if (reporter) {
      reports = reports.filter(r => r.reporter && r.reporter.toLowerCase().includes(reporter.toLowerCase()));
    }

    if (status && status !== 'all') {
      // For now, we don't have status field in reports, so we'll skip this filter
      // In the future, you could add a status field to the notification model
    }

    if (search) {
      const searchLower = search.toLowerCase();
      reports = reports.filter(r =>
        (r.reason && r.reason.toLowerCase().includes(searchLower)) ||
        (r.details && r.details.toLowerCase().includes(searchLower)) ||
        (r.messageExcerpt && r.messageExcerpt.toLowerCase().includes(searchLower)) ||
        (r.reporter && r.reporter.toLowerCase().includes(searchLower)) ||
        (r.appointmentRef && r.appointmentRef.toLowerCase().includes(searchLower)) ||
        (r.propertyName && r.propertyName.toLowerCase().includes(searchLower)) ||
        (r.category && r.category.toLowerCase().includes(searchLower))
      );
    }

    if (messageType && messageType !== 'all') {
      // Filter by message type - this would require additional data in the notification
      // For now, we'll skip this filter as we don't have message type info
    }

    // Apply sorting
    reports.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'user':
          aValue = a.reporter || '';
          bValue = b.reporter || '';
          break;
        case 'type':
          aValue = a.type || '';
          bValue = b.type || '';
          break;
        case 'date':
        default:
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    res.status(200).json({ success: true, count: reports.length, reports });
  } catch (error) {
    next(error);
  }
};

// GET reported message IDs for an appointment (to flag in UI)
export const getReportedMessageIds = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Admins only' });
    }
    const { appointmentId } = req.query;
    if (!appointmentId) {
      return res.status(400).json({ success: false, message: 'appointmentId is required' });
    }

    const notifications = await Notification.find({
      userId: req.user.id,
      title: 'Chat message reported',
    }).sort({ createdAt: -1 });

    const ids = notifications
      .map(parseReportFromNotification)
      .filter(r => r.appointmentRef && r.appointmentRef.includes(appointmentId) && r.messageId)
      .map(r => r.messageId);

    // Unique preserve order
    const uniqueIds = Array.from(new Set(ids));
    res.status(200).json({ success: true, appointmentId, messageIds: uniqueIds });
  } catch (error) {
    next(error);
  }
};

// GET review reports for admins
export const getReviewReports = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Admins only' });
    }

    const {
      dateFrom,
      dateTo,
      reporter,
      search,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // Build date filter
    const dateFilter = {};
    if (dateFrom) {
      dateFilter.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = endDate;
    }

    // Fetch review report notifications
    // Admins and Root Admins should see the same global list of reports
    const query = {
      title: 'Review Reported',
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
    };

    const notifications = await Notification.find(query).sort({ createdAt: -1 });

    // Parse to structured reports
    let reports = notifications.map(parseReviewReportFromNotification);

    // Deduplicate reports (same review can be reported multiple times to different admins)
    const uniqueReports = new Map();
    reports.forEach(report => {
      // Use reviewId + reporterId + createdAt as unique key to avoid duplicates
      const uniqueKey = `${report.reviewId || 'no-review'}-${report.reporterId || 'no-reporter'}-${report.createdAt}`;
      if (!uniqueReports.has(uniqueKey)) {
        uniqueReports.set(uniqueKey, report);
      }
    });
    reports = Array.from(uniqueReports.values());

    // Enhance reports with additional reporter details
    let enhancedReports = await Promise.all(reports.map(async (report) => {
      // console.log('Processing report:', report.notificationId, 'reporterId:', report.reporterId);

      // Try to get reporter details from multiple sources
      let reporterId = report.reporterId;

      // If no reporterId in meta, try to find the notification and use adminId
      if (!reporterId) {
        const notification = notifications.find(n => n._id.toString() === report.notificationId.toString());
        // console.log('Looking for notification with ID:', report.notificationId.toString());
        // console.log('Available notification IDs:', notifications.map(n => n._id.toString()));
        if (notification && notification.adminId) {
          reporterId = notification.adminId;
          // console.log('Using adminId as reporterId:', reporterId);
        } else {
          // console.log('No notification found or no adminId for report:', report.notificationId);
        }
      }

      // Fetch review content
      if (report.reviewId) {
        try {
          const Review = (await import('../models/review.model.js')).default;
          const review = await Review.findById(report.reviewId).select('comment rating');
          if (review) {
            report.reviewContent = review.comment;
            report.reviewRating = review.rating;
          }
        } catch (error) {
          console.error('Error fetching review details:', error);
        }
      }

      if (reporterId) {
        try {
          const User = (await import('../models/user.model.js')).default;
          const reporter = await User.findById(reporterId).select('email mobileNumber role username');
          // console.log('Found reporter:', reporter ? { email: reporter.email, phone: reporter.mobileNumber, role: reporter.role, username: reporter.username } : 'null');
          if (reporter) {
            const enhanced = {
              ...report,
              reporterEmail: report.reporterEmail || reporter.email,
              reporterPhone: report.reporterPhone || reporter.mobileNumber,
              reporterRole: report.reporterRole || reporter.role,
              reporterUsername: reporter.username
            };
            // console.log('Enhanced report:', { reporterEmail: enhanced.reporterEmail, reporterPhone: enhanced.reporterPhone, reporterRole: enhanced.reporterRole });
            return enhanced;
          }
        } catch (error) {
          console.error('Error fetching reporter details:', error);
        }
      } else {
        // console.log('No reporterId found for report:', report.notificationId);
      }
      return report;
    }));

    // Apply filters
    if (reporter) {
      enhancedReports = enhancedReports.filter(r => r.reporter && r.reporter.toLowerCase().includes(reporter.toLowerCase()));
    }

    if (search) {
      const searchLower = search.toLowerCase();
      enhancedReports = enhancedReports.filter(r =>
        (r.propertyName && r.propertyName.toLowerCase().includes(searchLower)) ||
        (r.reporter && r.reporter.toLowerCase().includes(searchLower)) ||
        (r.reporterEmail && r.reporterEmail.toLowerCase().includes(searchLower)) ||
        (r.reporterPhone && r.reporterPhone.toLowerCase().includes(searchLower)) ||
        (r.category && r.category.toLowerCase().includes(searchLower)) ||
        (r.details && r.details.toLowerCase().includes(searchLower))
      );
    }

    // Apply sorting
    reports.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'reporter':
          aValue = a.reporter || '';
          bValue = b.reporter || '';
          break;
        case 'property':
          aValue = a.propertyName || '';
          bValue = b.propertyName || '';
          break;
        case 'category':
          aValue = a.category || '';
          bValue = b.category || '';
          break;
        case 'date':
        default:
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    res.status(200).json({
      success: true,
      reports: enhancedReports,
      total: enhancedReports.length
    });
  } catch (error) {
    next(error);
  }
};

// Helper to parse property reports from notification
const parsePropertyReportFromNotification = (n) => {
  // Parse the message format: "Property \"Property Name\" was reported by username for: Category - Details"
  const message = n.message || '';
  const propertyMatch = message.match(/Property "([^"]+)"/);
  const reporterMatch = message.match(/reported by ([^\\s]+)/);
  const categoryMatch = message.match(/for: ([^-]+)/);
  const detailsMatch = message.match(/- (.+)$/);

  return {
    notificationId: n._id,
    type: 'property',
    propertyName: propertyMatch ? propertyMatch[1] : 'Unknown Property',
    reporter: reporterMatch ? reporterMatch[1] : 'Unknown User',
    category: n.meta?.category || (categoryMatch ? categoryMatch[1].trim() : 'Unknown Category'),
    details: n.meta?.details || (detailsMatch ? detailsMatch[1].trim() : ''),
    listingId: n.listingId || null,
    reporterId: n.meta?.reporterId || null,
    reporterEmail: n.meta?.reporterEmail || null,
    reporterPhone: n.meta?.reporterPhone || null,
    reporterRole: n.meta?.reporterRole || null,
    createdAt: n.createdAt,
    isRead: n.isRead,
  };
};

// GET property reports for admins
export const getPropertyReports = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Admins only' });
    }

    const {
      dateFrom,
      dateTo,
      reporter,
      search,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // Build date filter
    const dateFilter = {};
    if (dateFrom) {
      dateFilter.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = endDate;
    }

    // Fetch property report notifications
    // Admins and Root Admins should see the same global list of reports
    const query = {
      title: 'Property Reported',
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
    };

    const notifications = await Notification.find(query).sort({ createdAt: -1 });

    // Parse to structured reports
    let reports = notifications.map(parsePropertyReportFromNotification);

    // Deduplicate reports (same property can be reported multiple times to different admins)
    const uniqueReports = new Map();
    reports.forEach(report => {
      // Use listingId + reporterId + rounded createdAt (to second) as unique key to avoid duplicates
      // This handles minor timestamp differences in parallel creation
      const dateStr = new Date(report.createdAt).toISOString().split('.')[0];
      const uniqueKey = `${report.listingId || 'no-listing'}-${report.reporterId || 'no-reporter'}-${dateStr}`;
      if (!uniqueReports.has(uniqueKey)) {
        uniqueReports.set(uniqueKey, report);
      }
    });
    reports = Array.from(uniqueReports.values());

    // Enhance reports with additional reporter details
    let enhancedReports = await Promise.all(reports.map(async (report) => {
      // console.log('Processing property report:', report.notificationId, 'reporterId:', report.reporterId);

      // Try to get reporter details from multiple sources
      let reporterId = report.reporterId;

      // If no reporterId in meta, try to find the notification and use adminId
      if (!reporterId) {
        const notification = notifications.find(n => n._id.toString() === report.notificationId.toString());
        // console.log('Looking for property notification with ID:', report.notificationId.toString());
        // console.log('Available property notification IDs:', notifications.map(n => n._id.toString()));
        if (notification && notification.adminId) {
          reporterId = notification.adminId;
          // console.log('Using adminId as reporterId for property:', reporterId);
        } else {
          // console.log('No property notification found or no adminId for report:', report.notificationId);
        }
      }

      if (reporterId) {
        try {
          const User = (await import('../models/user.model.js')).default;
          const reporter = await User.findById(reporterId).select('email mobileNumber role username');
          // console.log('Found property reporter:', reporter ? { email: reporter.email, phone: reporter.mobileNumber, role: reporter.role, username: reporter.username } : 'null');
          if (reporter) {
            const enhanced = {
              ...report,
              reporterEmail: report.reporterEmail || reporter.email,
              reporterPhone: report.reporterPhone || reporter.mobileNumber,
              reporterRole: report.reporterRole || reporter.role,
              reporterUsername: reporter.username
            };
            // console.log('Enhanced property report:', { reporterEmail: enhanced.reporterEmail, reporterPhone: enhanced.reporterPhone, reporterRole: enhanced.reporterRole });
            return enhanced;
          }
        } catch (error) {
          console.error('Error fetching property reporter details:', error);
        }
      } else {
        // console.log('No reporterId found for property report:', report.notificationId);
      }
      return report;
    }));

    // Apply filters
    if (reporter) {
      enhancedReports = enhancedReports.filter(r => r.reporter && r.reporter.toLowerCase().includes(reporter.toLowerCase()));
    }

    if (search) {
      const searchLower = search.toLowerCase();
      enhancedReports = enhancedReports.filter(r =>
        (r.propertyName && r.propertyName.toLowerCase().includes(searchLower)) ||
        (r.reporter && r.reporter.toLowerCase().includes(searchLower)) ||
        (r.reporterEmail && r.reporterEmail.toLowerCase().includes(searchLower)) ||
        (r.reporterPhone && r.reporterPhone.toLowerCase().includes(searchLower)) ||
        (r.category && r.category.toLowerCase().includes(searchLower)) ||
        (r.details && r.details.toLowerCase().includes(searchLower))
      );
    }

    // Apply sorting
    enhancedReports.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'reporter':
          aValue = a.reporter || '';
          bValue = b.reporter || '';
          break;
        case 'property':
          aValue = a.propertyName || '';
          bValue = b.propertyName || '';
          break;
        case 'category':
          aValue = a.category || '';
          bValue = b.category || '';
          break;
        case 'date':
        default:
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    res.status(200).json({
      success: true,
      reports: enhancedReports,
      total: enhancedReports.length
    });
  } catch (error) {
    next(error);
  }
};

// Create notification
export const createNotification = async (req, res, next) => {
  try {
    const { userId, type, title, message, listingId, adminId } = req.body;
    // Allow user to create their own notification; otherwise require admin
    const isSelf = req.user && (req.user.id === userId);
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'rootadmin');
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

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

    // Rate limit: 10/day per user per appointment for message reports
    const userId = req.user?.id;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const countToday = await ReportAudit.countDocuments({
      userId,
      appointmentId,
      kind: 'message',
      createdAt: { $gte: startOfDay },
    });
    if (countToday >= 10) {
      return res.status(429).json({ success: false, message: 'Daily report limit reached (10/day) for this chat.' });
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

    const title = `Chat message reported`;
    const lines = [
      `Reason: ${reason}`,
      `Reporter: ${reporterName} (${reporterEmail})`,
      `Appointment: ${appointment._id.toString()}${listing ? ` — ${listing.name}` : ''}`,
      `Between: ${buyer?.username || 'Buyer'} (${buyer?.email || 'n/a'}) ↔ ${seller?.username || 'Seller'} (${seller?.email || 'n/a'})`,
      `Message ID: ${commentId}`,
      `Message excerpt: "${messageText.substring(0, 300)}"`,
      details ? `Additional details: ${details}` : null,
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

    // Audit success
    await ReportAudit.create({ userId, appointmentId, kind: 'message' });

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

// Report entire chat conversation: create notifications for all admins/rootadmins
export const reportChatConversation = async (req, res, next) => {
  try {
    const { appointmentId, reason, details } = req.body;
    if (!appointmentId || !reason) {
      return res.status(400).json({ success: false, message: 'appointmentId and reason are required' });
    }

    // Rate limit: 5/hour per user per appointment for chat reports
    const userId = req.user?.id;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const countHour = await ReportAudit.countDocuments({
      userId,
      appointmentId,
      kind: 'chat',
      createdAt: { $gte: oneHourAgo },
    });
    if (countHour >= 5) {
      return res.status(429).json({ success: false, message: 'Hourly chat report limit reached (5/hour) for this chat.' });
    }

    // Load appointment and related data
    const appointment = await Booking.findById(appointmentId)
      .populate('buyerId', 'username email')
      .populate('sellerId', 'username email')
      .populate('listingId', 'name address');
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Build a clear notification text for admins
    const reporterName = req.user?.username || 'Unknown';
    const reporterEmail = req.user?.email || '';
    const buyer = appointment.buyerId;
    const seller = appointment.sellerId;
    const listing = appointment.listingId;
    const messageCount = appointment.comments ? appointment.comments.length : 0;
    const appointmentDate = appointment.date ? new Date(appointment.date).toLocaleDateString() : 'Unknown';

    const title = `Chat conversation reported`;
    const lines = [
      `Reason: ${reason}`,
      `Reporter: ${reporterName} (${reporterEmail})`,
      `Appointment: ${appointment._id.toString()}${listing ? ` — ${listing.name}` : ''}`,
      `Appointment Date: ${appointmentDate}`,
      `Between: ${buyer?.username || 'Buyer'} (${buyer?.email || 'n/a'}) ↔ ${seller?.username || 'Seller'} (${seller?.email || 'n/a'})`,
      `Total Messages: ${messageCount}`,
      `Property: ${listing?.name || 'N/A'}${listing?.address ? ` - ${listing.address}` : ''}`,
      details ? `Additional details: ${details}` : null,
      ``,
      `Action required: Review the full chat conversation in the appointment details.`,
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

    // Audit success
    await ReportAudit.create({ userId, appointmentId, kind: 'chat' });

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

    // If this is an admin marking a notification as read, sync it to all other admins
    if ((req.user.role === 'admin' || req.user.role === 'rootadmin') && req.user.adminApprovalStatus === 'approved') {
      // Find all other admins who have the same notification
      const otherAdmins = await User.find({
        _id: { $ne: req.user.id },
        status: { $ne: 'suspended' },
        $or: [
          { role: 'rootadmin' },
          { role: 'admin', adminApprovalStatus: 'approved' },
        ],
      }, '_id');

      if (otherAdmins.length > 0) {
        const otherAdminIds = otherAdmins.map(admin => admin._id);

        // Find and mark the same notification as read for all other admins
        const sameNotifications = await Notification.find({
          _id: { $ne: notificationId },
          type: notification.type,
          title: notification.title,
          message: notification.message,
          adminId: notification.adminId,
          listingId: notification.listingId,
          userId: { $in: otherAdminIds },
          isRead: false
        });

        if (sameNotifications.length > 0) {
          // Mark all matching notifications as read
          await Notification.updateMany(
            { _id: { $in: sameNotifications.map(n => n._id) } },
            { isRead: true, readAt: new Date() }
          );

          // Emit socket events to all other admins
          const io = req.app.get('io');
          if (io) {
            sameNotifications.forEach(n => {
              io.to(n.userId.toString()).emit('notificationMarkedAsRead', {
                notificationId: n._id,
                markedBy: req.user.id,
                markedByEmail: req.user.email,
                markedByUsername: req.user.username
              });
            });
          }
        }
      }
    }

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

// Mark all notifications as read for all admins (admin sync feature)
export const markAllNotificationsAsReadForAllAdmins = async (req, res, next) => {
  try {
    // Verify the user is an admin
    if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return next(errorHandler(403, 'Only admins can perform this action'));
    }

    // Find all admins and root admins (active, approved)
    const admins = await User.find({
      status: { $ne: 'suspended' },
      $or: [
        { role: 'rootadmin' },
        { role: 'admin', adminApprovalStatus: 'approved' },
      ],
    }, '_id');

    if (admins.length === 0) {
      return res.status(404).json({ success: false, message: 'No admins found' });
    }

    // Mark all unread notifications as read for all admins
    const adminIds = admins.map(admin => admin._id);
    const result = await Notification.updateMany(
      {
        userId: { $in: adminIds },
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    // Emit socket event to all admins for real-time sync
    const io = req.app.get('io');
    if (io) {
      adminIds.forEach(adminId => {
        io.to(adminId.toString()).emit('allNotificationsMarkedAsRead', {
          adminId: adminId.toString(),
          markedBy: req.user.id,
          count: result.modifiedCount
        });
      });
    }

    res.status(200).json({
      success: true,
      message: `All notifications marked as read for ${admins.length} admins`,
      count: result.modifiedCount,
      adminCount: admins.length
    });
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

// Notify all admins: generic helper for user-initiated requests (e.g., services/movers)
export const notifyAdminsGeneric = async (req, res, next) => {
  try {
    const { title, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'title and message are required' });
    }

    // Find all admins and rootadmins (active, approved)
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

    const notifications = admins.map(a => ({
      userId: a._id,
      type: 'admin_message',
      title,
      message,
      adminId: null,
    }));

    const created = await Notification.insertMany(notifications);

    // Emit socket events to each admin
    const io = req.app.get('io');
    if (io) {
      created.forEach(n => {
        io.to(n.userId.toString()).emit('notificationCreated', n);
      });
    }

    res.status(201).json({ success: true, count: created.length });
  } catch (error) {
    next(error);
  }
};

// Notify watchlist users about property changes
export const notifyWatchlistUsers = async (app, { listing, changeType, oldPrice, newPrice, oldStatus, newStatus }) => {
  try {
    const PropertyWatchlist = (await import('../models/propertyWatchlist.model.js')).default;
    const watchers = await PropertyWatchlist.find({ listingId: listing._id });
    if (!watchers.length) return [];

    const io = app.get('io');
    const notifications = [];

    for (const w of watchers) {
      let title, message, type;

      switch (changeType) {
        case 'price_drop':
          title = 'Price Drop Alert! 🎉';
          message = `Great news! "${listing.name}" price dropped from ₹${oldPrice?.toLocaleString('en-IN')} to ₹${newPrice?.toLocaleString('en-IN')}. Check it out now!`;
          type = 'watchlist_price_drop';
          break;
        case 'price_increase':
          title = 'Price Update';
          message = `"${listing.name}" price has been updated from ₹${oldPrice?.toLocaleString('en-IN')} to ₹${newPrice?.toLocaleString('en-IN')}.`;
          type = 'watchlist_price_update';
          break;
        case 'property_sold':
          title = 'Property No Longer Available';
          message = `"${listing.name}" has been sold and is no longer available.`;
          type = 'watchlist_property_sold';
          break;
        case 'property_removed':
          title = 'Property Removed';
          message = `"${listing.name}" has been removed from our platform.`;
          type = 'watchlist_property_removed';
          break;
        case 'property_trending':
          title = 'Property is Trending! 🔥';
          message = `"${listing.name}" is now trending and getting lots of attention. Don't miss out!`;
          type = 'watchlist_property_trending';
          break;
        case 'status_change':
          title = 'Property Status Updated';
          message = `"${listing.name}" status changed from ${oldStatus} to ${newStatus}.`;
          type = 'watchlist_status_update';
          break;
        default:
          title = 'Property Update';
          message = `"${listing.name}" has been updated. Check it out!`;
          type = 'watchlist_update';
      }

      const notification = await Notification.create({
        userId: w.userId,
        listingId: listing._id,
        type,
        title,
        message,
        link: `/listing/${listing._id}`
      });
      notifications.push(notification);

      if (io) {
        io.to(w.userId.toString()).emit('notificationCreated', notification);
      }
    }

    return notifications;
  } catch (error) {
    console.error('Failed to notify watchlist users:', error);
    return [];
  }
};

// Notify all admins about a community report (post, comment, or reply)
export const notifyAdminsOfCommunityReport = async (app, reporter, targetPost, reportType, reason, targetContent = null) => {
  try {
    const admins = await User.find({
      status: { $ne: 'suspended' },
      $or: [
        { role: 'rootadmin' },
        { role: 'admin', adminApprovalStatus: 'approved' },
      ],
    }, '_id');

    if (admins.length === 0) return;

    const title = `Community ${reportType} Reported`;
    const message = `A community ${reportType.toLowerCase()} was reported by ${reporter.username}.\nPost: "${targetPost.title}"\nReason: ${reason}${targetContent ? `\nContent snippet: "${targetContent.substring(0, 100)}..."` : ''}`;

    const notifications = admins.map(admin => ({
      userId: admin._id,
      type: 'community_report',
      title,
      message,
      link: `/admin/community/post/${targetPost._id}`,
      meta: {
        postId: targetPost._id,
        reportType,
        reason,
        reporterId: reporter._id
      }
    }));

    const createdNotifications = await Notification.insertMany(notifications);

    const io = app.get('io');
    if (io) {
      createdNotifications.forEach(n => {
        io.to(n.userId.toString()).emit('notificationCreated', n);
      });
    }

    return createdNotifications;
  } catch (error) {
    console.error('Failed to notify admins of community report:', error);
  }
};