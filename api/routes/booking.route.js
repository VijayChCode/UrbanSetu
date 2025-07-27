import express from "express";
import booking from "../models/booking.model.js";
import Listing from "../models/listing.model.js";
import User from "../models/user.model.js";
import { verifyToken } from '../utils/verify.js';
import Review from '../models/review.model.js';
import Notification from '../models/notification.model.js';

const router = express.Router();

// POST: Create a booking
router.post("/", verifyToken, async (req, res) => {
  try {
    const { listingId, date, time, message, purpose, propertyName, propertyDescription } = req.body;
    const buyerId = req.user.id;
    
    // Find the listing to get seller information
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: "Listing not found." });
    }

    // Find the seller by userRef (which contains the seller's user ID)
    const seller = await User.findById(listing.userRef);
    if (!seller) {
      return res.status(404).json({ message: "Property owner not found. Please contact support." });
    }

    // Get buyer details
    const buyer = await User.findById(buyerId);
    if (!buyer) {
      return res.status(404).json({ message: "Buyer not found." });
    }

    // Prevent admin from booking for the property owner
    if (buyer._id.toString() === seller._id.toString()) {
      return res.status(400).json({ message: "Cannot book an appointment for the property owner themselves." });
    }

    // --- Prevent duplicate active appointments ---
    // Only block: pending, accepted appointments that are not outdated
    const currentDate = new Date();
    const currentDateString = currentDate.toISOString().split('T')[0];
    const currentTimeString = currentDate.toTimeString().split(' ')[0];
    
    const orConditions = [
      { 
        status: { $in: ["pending", "accepted"] },
        $or: [
          { date: { $gt: currentDateString } },
          { 
            date: currentDateString,
            time: { $gt: currentTimeString }
          }
        ]
      }
    ];
    // Determine if current user is buyer or seller
    let visibilityCondition = {};
    if (buyerId.toString() === seller._id.toString()) {
      // Edge case: user is both buyer and seller (shouldn't happen, but just in case)
      visibilityCondition = { $or: [ { visibleToBuyer: { $ne: false } }, { visibleToSeller: { $ne: false } } ] };
    } else if (buyerId.toString() === buyer._id.toString()) {
      visibilityCondition = { visibleToBuyer: { $ne: false } };
    } else if (buyerId.toString() === seller._id.toString()) {
      visibilityCondition = { visibleToSeller: { $ne: false } };
    }
    const existing = await booking.findOne({
      listingId,
      $or: orConditions,
      ...visibilityCondition
    });
    if (existing) {
      return res.status(400).json({ message: "You already have an active appointment for this property. Please complete, cancel, or wait for the other party to respond before booking again." });
    }

    // Create the appointment
    const newBooking = new booking({
      name: buyer.username,
      email: buyer.email,
      phone: buyer.phone || "",
      date,
      time,
      message,
      listingId,
      buyerId,
      sellerId: seller._id,
      purpose,
      propertyName,
      propertyDescription,
    });
    
    await newBooking.save();
    // Emit socket.io event for real-time new appointment
    const io = req.app.get('io');
    if (io) {
      io.emit('appointmentCreated', { appointment: newBooking });
    }
    // Notify seller
    try {
      const notification = await Notification.create({
        userId: seller._id,
        type: 'appointment_booked',
        title: 'New Appointment Booked',
        message: `A new appointment for "${listing.name}" has been booked by ${buyer.username}.`,
        listingId: listing._id,
        adminId: null
      });
      if (io) io.to(seller._id.toString()).emit('notificationCreated', notification);
    } catch (notificationError) {
      console.error('Failed to create notification for seller:', notificationError);
    }
    res.status(201).json({ message: "Appointment booked successfully!", appointment: newBooking });
  } catch (err) {
    console.error("Error creating booking:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET: Fetch all bookings (for admin - read only)
router.get("/", async (req, res) => {
  try {
    const bookings = await booking.find({ archivedByAdmin: { $ne: true } })
      .populate('buyerId', 'username email mobileNumber')
      .populate('sellerId', 'username email mobileNumber')
      .populate('listingId', '_id name address')
      .sort({ createdAt: -1 });
    res.status(200).json(bookings);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET: Fetch bookings for current user (buyer or seller)
router.get("/my", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find all appointments where user is either buyer or seller
    const bookings = await booking.find({
      $or: [{ buyerId: userId }, { sellerId: userId }]
    })
    .populate('buyerId', 'username email mobileNumber')
    .populate('sellerId', 'username email mobileNumber')
    .populate('listingId', '_id name address')
    .sort({ createdAt: -1 });
    
    // Add role information to each booking
    const bookingsWithRole = bookings
      .filter(booking => booking.buyerId && booking.buyerId._id && booking.sellerId && booking.sellerId._id) // skip if any is null
      .map(booking => {
      const bookingObj = booking.toObject();
      bookingObj.role = booking.buyerId._id.toString() === userId ? 'buyer' : 'seller';
      return bookingObj;
    });
    
    res.status(200).json(bookingsWithRole);
  } catch (err) {
    console.error("Error fetching user bookings:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET: Fetch pending appointments (for admin)
router.get("/pending", async (req, res) => {
  try {
    const pendingBookings = await booking.find({ status: "pending" })
      .populate('buyerId', 'username email mobileNumber')
      .populate('sellerId', 'username email mobileNumber')
      .populate('listingId', '_id name address')
      .sort({ createdAt: -1 });
    res.status(200).json(pendingBookings);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH: Update appointment status (for sellers only)
router.patch('/:id/status', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;
    const sellerId = req.user.id;
    
    // Find the booking and verify the seller owns it
    const bookingToUpdate = await booking.findById(id);
    if (!bookingToUpdate) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }
    
    if (bookingToUpdate.sellerId.toString() !== sellerId) {
      return res.status(403).json({ message: 'You can only update appointments for your own properties.' });
    }
    
    const updated = await booking.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate('buyerId', 'username email mobileNumber')
     .populate('sellerId', 'username email mobileNumber')
     .populate('listingId', '_id name address');

    // --- NEW LOGIC: Update review for verified badge if booking is accepted/completed ---
    if (status === 'accepted' || status === 'completed') {
      await Review.findOneAndUpdate(
        {
          userId: bookingToUpdate.buyerId,
          listingId: bookingToUpdate.listingId,
          verifiedByBooking: { $ne: true }
        },
        {
          verifiedByBooking: true,
          verificationDate: new Date()
        }
      );
    }
    // --- END NEW LOGIC ---

    // --- Notify buyer if seller accepted or rejected the appointment ---
    try {
      if (status === 'accepted' || status === 'rejected') {
        const notificationType = status === 'accepted' ? 'appointment_accepted_by_seller' : 'appointment_rejected_by_seller';
        const notificationTitle = status === 'accepted' ? 'Appointment Accepted' : 'Appointment Rejected';
        const notificationMessage = status === 'accepted'
          ? `Your appointment for "${updated.listingId.name}" was accepted by the seller.`
          : `Your appointment for "${updated.listingId.name}" was rejected by the seller.`;

        const notification = await Notification.create({
          userId: updated.buyerId._id || updated.buyerId,
          type: notificationType,
          title: notificationTitle,
          message: notificationMessage,
          listingId: updated.listingId._id || updated.listingId,
          adminId: null
        });

        if (io) io.to((updated.buyerId._id || updated.buyerId).toString()).emit('notificationCreated', notification);
      }
    } catch (notificationError) {
      console.error('Failed to create notification for buyer:', notificationError);
    }
    // --- END Notify buyer logic ---

    // Emit socket.io event for real-time appointment update
    const io = req.app.get('io');
    if (io) {
      io.emit('appointmentUpdate', { appointmentId: id, updatedAppointment: updated });
    }

    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update appointment status.' });
  }
});

// POST: Add a comment to an appointment
router.post('/:id/comment', verifyToken, async (req, res) => {
  try {
    const { message, replyTo } = req.body;
    const { id } = req.params;
    const userId = req.user.id;
    
    const bookingToComment = await booking.findById(id);
    if (!bookingToComment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }
    
    // Only allow comments if user is the buyer, seller, or admin
    const isBuyer = bookingToComment.buyerId.toString() === userId;
    const isSeller = bookingToComment.sellerId.toString() === userId;
    
    // Check if user is admin or rootadmin
    const user = await User.findById(userId);
    const isAdmin = (user && user.role === 'admin' && user.adminApprovalStatus === 'approved') || (user && user.role === 'rootadmin');
    
    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ message: "You can only comment on your own appointments unless you are an admin or root admin." });
    }
    
    const newComment = {
      sender: userId,
      senderEmail: req.user.email,
      message,
      status: "sent",
      readBy: [userId],
      ...(replyTo ? { replyTo } : {}),
    };
    
    const updated = await booking.findByIdAndUpdate(
      id,
      { $push: { comments: newComment } },
      { new: true }
    ).populate('buyerId', 'username email mobileNumber')
     .populate('sellerId', 'username email mobileNumber')
     .populate('listingId', '_id name address');
    
    // Emit socket.io event for real-time comment update
    const io = req.app.get('io');
    if (io) {
      // Send only the new comment (last in array)
      const newCommentObj = updated.comments[updated.comments.length - 1];
      io.emit('commentUpdate', { appointmentId: id, comment: newCommentObj });
      
      // Only mark as delivered if the intended recipient is online
      const onlineUsers = req.app.get('onlineUsers') || new Set();
      const isBuyer = bookingToComment.buyerId.toString() === userId;
      const recipientId = isBuyer ? bookingToComment.sellerId.toString() : bookingToComment.buyerId.toString();
      
      if (onlineUsers.has(recipientId)) {
        // Recipient is online, mark as delivered
        await booking.findOneAndUpdate(
          { _id: id, 'comments._id': newCommentObj._id },
          { $set: { 'comments.$.status': 'delivered' } }
        );
        io.emit('commentDelivered', { appointmentId: id, commentId: newCommentObj._id });
      }
      // If recipient is offline, message stays as "sent" until they come online
    }
    
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add comment.' });
  }
});

// DELETE: Remove a comment from an appointment
router.delete('/:id/comment/:commentId', verifyToken, async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.user.id;
    
    const bookingToUpdate = await booking.findById(id);
    if (!bookingToUpdate) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }
    
    // Only allow deletion if user is the buyer, seller, or admin
    const isBuyer = bookingToUpdate.buyerId.toString() === userId;
    const isSeller = bookingToUpdate.sellerId.toString() === userId;
    
    // Check if user is admin or rootadmin
    const user = await User.findById(userId);
    const isAdmin = (user && user.role === 'admin' && user.adminApprovalStatus === 'approved') || (user && user.role === 'rootadmin');
    
    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ message: "You can only delete comments on your own appointments unless you are an admin or root admin." });
    }
    // Find the comment and mark as deleted
    const comment = bookingToUpdate.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found.' });
    }
    // Preserve original content before marking as deleted
    console.log('Deleting comment:', {
      id: comment._id,
      currentMessage: comment.message,
      hasOriginalMessage: !!comment.originalMessage,
      messageLength: comment.message ? comment.message.length : 0,
      alreadyDeleted: comment.deleted
    });
    
    // If already deleted but no original message preserved, we can't recover content
    if (comment.deleted && !comment.originalMessage) {
      console.log('Warning: Comment already deleted and no original message preserved');
    }
    
    // Preserve original message before marking as deleted
    if (!comment.originalMessage && comment.message) {
      comment.originalMessage = comment.message; // Only preserve if not already preserved
      console.log('✅ Preserved original message:', comment.originalMessage);
    } else if (!comment.originalMessage && !comment.message) {
      console.log('⚠️ Warning: No content to preserve - message is already empty');
    } else if (comment.originalMessage) {
      console.log('ℹ️ Original message already preserved:', comment.originalMessage);
    }
    
    console.log('📋 Comment deletion state:', {
      messageLength: comment.message ? comment.message.length : 0,
      hasOriginalMessage: !!comment.originalMessage,
      originalMessageLength: comment.originalMessage ? comment.originalMessage.length : 0,
      deletedBy: req.user.email
    });
    
    comment.deleted = true;
    comment.deletedBy = req.user.email; // Track who deleted it
    comment.deletedAt = new Date(); // Track when it was deleted
    
    // Store the comment data for socket emission with proper preserved content (before clearing message)
    const commentForEmission = {
      _id: comment._id,
      senderEmail: comment.senderEmail,
      message: comment.message, // Keep current message for socket before clearing
      originalMessage: comment.originalMessage,
      deleted: true,
      deletedBy: req.user.email,
      deletedAt: comment.deletedAt,
      timestamp: comment.timestamp,
      readBy: comment.readBy,
      replyTo: comment.replyTo,
      edited: comment.edited,
      editedAt: comment.editedAt
    };
    
    comment.message = ''; // Hide for regular users (clear after preserving for socket)
    
    // Mark the comments array as modified to ensure proper save
    bookingToUpdate.markModified('comments');
    await bookingToUpdate.save();
    
    // Verify the save was successful by finding the comment again
    const savedComment = bookingToUpdate.comments.id(commentId);
    console.log('💾 After save - comment state:', {
      deleted: savedComment.deleted,
      messageIsEmpty: savedComment.message === '',
      hasOriginalMessage: !!savedComment.originalMessage,
      originalMessage: savedComment.originalMessage,
      deletedBy: savedComment.deletedBy
    });
    
    // Emit socket event for real-time update with preserved message content
    const io = req.app.get('io');
    if (io) {
      io.emit('commentUpdate', { appointmentId: id, comment: commentForEmission });
      console.log('📡 Socket emitted with preserved content');
    }
    // Return updated comments array
    res.status(200).json({ comments: bookingToUpdate.comments });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete comment.' });
  }
});

// PATCH: Edit a comment in an appointment (update in place)
router.patch('/:id/comment/:commentId', verifyToken, async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;
    
    const appointment = await booking.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }
    
    // Only allow editing if user is the buyer, seller, or admin
    const isBuyer = appointment.buyerId.toString() === userId;
    const isSeller = appointment.sellerId.toString() === userId;
    
    // Check if user is admin or rootadmin
    const user = await User.findById(userId);
    const isAdmin = (user && user.role === 'admin' && user.adminApprovalStatus === 'approved') || (user && user.role === 'rootadmin');
    
    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ message: "You can only edit comments on your own appointments unless you are an admin or root admin." });
    }

    const comment = appointment.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found.' });
    }
    // Only allow editing own comments (unless admin)
    if (comment.sender.toString() !== userId && !isAdmin) {
      return res.status(403).json({ message: "You can only edit your own comments." });
    }
    // Only update if the message is different
    if (comment.message !== message) {
      comment.message = message;
      comment.edited = true;
      comment.editedAt = new Date();
      await appointment.save();
      // Emit socket event for real-time update
      const io = req.app.get('io');
      if (io) {
        io.emit('commentUpdate', { appointmentId: id, comment });
      }
    }
    // Return updated comments array
    res.status(200).json({ comments: appointment.comments });
  } catch (err) {
    res.status(500).json({ message: 'Failed to edit comment.' });
  }
});

// GET: Fetch admin-specific appointment count
router.get("/admin/:adminId", verifyToken, async (req, res) => {
  try {
    const { adminId } = req.params;
    
    // Verify the user is requesting their own admin stats
    if (req.user._id.toString() !== adminId) {
      return res.status(403).json({ message: "You can only view your own admin stats" });
    }
    
    // Verify user is an admin
    const user = await User.findById(adminId);
    if (!user || user.role !== 'admin' || user.adminApprovalStatus !== 'approved') {
      return res.status(403).json({ message: "Only approved admins can access admin stats" });
    }
    
    // Count all appointments (admin can see all)
    const count = await booking.countDocuments();
    
    res.status(200).json({ count });
  } catch (err) {
    console.error("Error fetching admin appointment count:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET: Fetch user-specific appointments (admin or user)
router.get("/user/:userId", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    // Check if user is admin or rootadmin
    const user = await User.findById(req.user.id);
    const isAdmin = (user && user.role === 'admin' && user.adminApprovalStatus === 'approved') || (user && user.role === 'rootadmin');
    // Allow admins to view any user's appointments, or users to view their own
    if (!isAdmin && req.user.id !== userId) {
      return res.status(403).json({ message: "You can only view your own appointments" });
    }
    // Find all appointments where user is either buyer or seller
    const bookings = await booking.find({
      $or: [{ buyerId: userId }, { sellerId: userId }]
    })
    .populate('buyerId', 'username email mobileNumber')
    .populate('sellerId', 'username email mobileNumber')
    .populate('listingId', '_id name address')
    .sort({ createdAt: -1 });
    res.status(200).json(bookings);
  } catch (err) {
    console.error("Error fetching user appointments:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH: Cancel appointment (role-based)
router.patch('/:id/cancel', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    const isRootAdmin = req.user.role === 'rootadmin';
    const isAdmin = req.user.role === 'admin' && req.user.adminApprovalStatus === 'approved';

    const bookingToCancel = await booking.findById(id);
    if (!bookingToCancel) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Only allow cancellation if not already cancelled/completed
    // Admin can cancel even if already cancelled by buyer or seller
    if ((isAdmin || isRootAdmin) && ["cancelledByAdmin", "completed", "noShow", "deletedByAdmin"].includes(bookingToCancel.status)) {
      return res.status(400).json({ message: 'Appointment cannot be cancelled in its current state.' });
    }
    if (!(isAdmin || isRootAdmin) && ["cancelledByBuyer", "cancelledBySeller", "cancelledByAdmin", "completed", "noShow", "deletedByAdmin"].includes(bookingToCancel.status)) {
      return res.status(400).json({ message: 'Appointment cannot be cancelled in its current state.' });
    }

    // Time restriction: can only cancel if >12h before appointment
    const now = new Date();
    const appointmentDate = new Date(bookingToCancel.date);
    const appointmentTime = bookingToCancel.time ? bookingToCancel.time : '00:00';
    const [hours, minutes] = appointmentTime.split(':');
    appointmentDate.setHours(Number(hours), Number(minutes), 0, 0);
    const hoursDiff = (appointmentDate - now) / (1000 * 60 * 60);
    const canCancel = hoursDiff > 12;

    // Buyer cancellation
    if (bookingToCancel.buyerId.toString() === userId && req.user.role === 'user') {
      if (!canCancel) {
        return res.status(400).json({ message: 'You can only cancel at least 12 hours before the appointment.' });
      }
      bookingToCancel.status = 'cancelledByBuyer';
      bookingToCancel.cancelReason = reason || '';
      bookingToCancel.cancelledBy = 'buyer';
      await bookingToCancel.save();
      // Emit socket.io event
      const io = req.app.get('io');
      if (io) {
        io.emit('appointmentUpdate', { appointmentId: id, updatedAppointment: bookingToCancel });
        // Notify seller
        try {
          const notification = await Notification.create({
            userId: bookingToCancel.sellerId,
            type: 'appointment_cancelled_by_buyer',
            title: 'Appointment Cancelled by Buyer',
            message: `The appointment for "${bookingToCancel.propertyName}" was cancelled by the buyer. Reason: ${reason}`,
            listingId: bookingToCancel.listingId,
            adminId: null
          });
          io.to(bookingToCancel.sellerId.toString()).emit('notificationCreated', notification);
        } catch (notificationError) {
          console.error('Failed to create notification for seller:', notificationError);
        }
      }
      return res.status(200).json(bookingToCancel);
    }

    // Seller cancellation
    if (bookingToCancel.sellerId.toString() === userId && req.user.role === 'user') {
      if (!canCancel) {
        return res.status(400).json({ message: 'You can only cancel at least 12 hours before the appointment.' });
      }
      if (!reason) {
        return res.status(400).json({ message: 'Reason is required for seller cancellation.' });
      }
      bookingToCancel.status = 'cancelledBySeller';
      bookingToCancel.cancelReason = reason;
      bookingToCancel.cancelledBy = 'seller';
      await bookingToCancel.save();
      // Emit socket.io event
      const io = req.app.get('io');
      if (io) {
        io.emit('appointmentUpdate', { appointmentId: id, updatedAppointment: bookingToCancel });
        // Notify buyer
        try {
          const notification = await Notification.create({
            userId: bookingToCancel.buyerId,
            type: 'appointment_cancelled_by_seller',
            title: 'Appointment Cancelled by Seller',
            message: `The appointment for "${bookingToCancel.propertyName}" was cancelled by the seller. Reason: ${reason}`,
            listingId: bookingToCancel.listingId,
            adminId: null
          });
          io.to(bookingToCancel.buyerId.toString()).emit('notificationCreated', notification);
        } catch (notificationError) {
          console.error('Failed to create notification for buyer:', notificationError);
        }
      }
      return res.status(200).json(bookingToCancel);
    }

    // Admin/rootadmin cancellation
    if (isAdmin || isRootAdmin) {
      if (!reason) {
        return res.status(400).json({ message: 'Reason is required for admin cancellation.' });
      }
      bookingToCancel.status = 'cancelledByAdmin';
      bookingToCancel.cancelReason = reason;
      bookingToCancel.cancelledBy = isRootAdmin ? 'rootadmin' : 'admin';
      await bookingToCancel.save();
      // Emit socket.io event
      const io = req.app.get('io');
      if (io) {
        io.emit('appointmentUpdate', { appointmentId: id, updatedAppointment: bookingToCancel });
        // Notify buyer
        try {
          const notification = await Notification.create({
            userId: bookingToCancel.buyerId,
            type: 'appointment_cancelled_by_admin',
            title: 'Appointment Cancelled by Admin',
            message: `The appointment for "${bookingToCancel.propertyName}" was cancelled by admin. Reason: ${reason}`,
            listingId: bookingToCancel.listingId,
            adminId: req.user.id
          });
          io.to(bookingToCancel.buyerId.toString()).emit('notificationCreated', notification);
        } catch (notificationError) {
          console.error('Failed to create notification for buyer:', notificationError);
        }
        // Notify seller
        try {
          const notification = await Notification.create({
            userId: bookingToCancel.sellerId,
            type: 'appointment_cancelled_by_admin',
            title: 'Appointment Cancelled by Admin',
            message: `The appointment for "${bookingToCancel.propertyName}" was cancelled by admin. Reason: ${reason}`,
            listingId: bookingToCancel.listingId,
            adminId: req.user.id
          });
          io.to(bookingToCancel.sellerId.toString()).emit('notificationCreated', notification);
        } catch (notificationError) {
          console.error('Failed to create notification for seller:', notificationError);
        }
      }
      return res.status(200).json(bookingToCancel);
    }

    return res.status(403).json({ message: 'You do not have permission to cancel this appointment.' });
  } catch (err) {
    console.error('Error cancelling appointment:', err);
    res.status(500).json({ message: 'Failed to cancel appointment.' });
  }
});

// PATCH: Reinitiate appointment (admin only)
router.patch('/:id/reinitiate', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isRootAdmin = req.user.role === 'rootadmin';
    const isAdmin = req.user.role === 'admin' && req.user.adminApprovalStatus === 'approved';

    // Only allow admin/rootadmin to reinitiate
    if (!isAdmin && !isRootAdmin) {
      return res.status(403).json({ message: 'Only admins can reinitiate appointments.' });
    }

    const bookingToReinitiate = await booking.findById(id);
    if (!bookingToReinitiate) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Only allow reinitiation if currently cancelled by admin
    if (bookingToReinitiate.status !== 'cancelledByAdmin') {
      return res.status(400).json({ message: 'Only appointments cancelled by admin can be reinitiated.' });
    }

    // Reset the appointment to pending status
    bookingToReinitiate.status = 'pending';
    bookingToReinitiate.cancelReason = '';
    // Unset the cancelledBy field to remove it from the document
    bookingToReinitiate.cancelledBy = undefined;
    
    await bookingToReinitiate.save();

    // Populate the updated booking for response
    const updated = await booking.findById(id)
      .populate('buyerId', 'username email mobileNumber')
      .populate('sellerId', 'username email mobileNumber')
      .populate('listingId', '_id name address');
    // Emit socket.io event
    const io = req.app.get('io');
    if (io) {
      io.emit('appointmentUpdate', { appointmentId: id, updatedAppointment: updated });
      // Notify buyer
      try {
        const notification = await Notification.create({
          userId: updated.buyerId._id,
          type: 'appointment_reinitiated_by_admin',
          title: 'Appointment Reinitiated by Admin',
          message: `The appointment for "${updated.propertyName}" was reinitiated by admin. Please review the details.`,
          listingId: updated.listingId._id,
          adminId: req.user.id
        });
        io.to(updated.buyerId._id.toString()).emit('notificationCreated', notification);
      } catch (notificationError) {
        console.error('Failed to create notification for buyer:', notificationError);
      }
      // Notify seller
      try {
        const notification = await Notification.create({
          userId: updated.sellerId._id,
          type: 'appointment_reinitiated_by_admin',
          title: 'Appointment Reinitiated by Admin',
          message: `The appointment for "${updated.propertyName}" was reinitiated by admin. Please review the details.`,
          listingId: updated.listingId._id,
          adminId: req.user.id
        });
        io.to(updated.sellerId._id.toString()).emit('notificationCreated', notification);
      } catch (notificationError) {
        console.error('Failed to create notification for seller:', notificationError);
      }
    }
    // Notify the opposite party when appointment is reinitiated by buyer or seller
    try {
      let notifyUserId, notifyRole;
      if (userId === updated.buyerId.toString()) {
        notifyUserId = updated.sellerId;
        notifyRole = 'seller';
      } else if (userId === updated.sellerId.toString()) {
        notifyUserId = updated.buyerId;
        notifyRole = 'buyer';
      }
      if (notifyUserId) {
        const notification = await Notification.create({
          userId: notifyUserId,
          type: 'appointment_reinitiated_by_user',
          title: 'Appointment Reinitiated',
          message: `The appointment for "${updated.propertyName}" was reinitiated by the ${notifyRole === 'seller' ? 'buyer' : 'seller'}. Please review the details.`,
          listingId: updated.listingId,
          adminId: null
        });
        if (io) io.to(notifyUserId.toString()).emit('notificationCreated', notification);
      }
    } catch (notificationError) {
      console.error('Failed to create notification for opposite party:', notificationError);
    }
    res.status(200).json({
      message: 'Appointment reinitiated successfully.',
      appointment: updated
    });
  } catch (err) {
    console.error('Error reinitiating appointment:', err);
    res.status(500).json({ message: 'Failed to reinitiate appointment.' });
  }
});

// PATCH: Soft delete (hide) appointment for buyer, seller, or admin
router.patch('/:id/soft-delete', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { who } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    const isRootAdmin = req.user.role === 'rootadmin';
    const isAdmin = req.user.role === 'admin' && req.user.adminApprovalStatus === 'approved';
    
    const bookingToHide = await booking.findById(id);
    if (!bookingToHide) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }
    
    if (who === 'buyer') {
      if (bookingToHide.buyerId.toString() !== userId) {
        return res.status(403).json({ message: 'You can only hide your own appointments.' });
      }
      bookingToHide.visibleToBuyer = false;
    } else if (who === 'seller') {
      if (bookingToHide.sellerId.toString() !== userId) {
        return res.status(403).json({ message: 'You can only hide your own appointments.' });
      }
      bookingToHide.visibleToSeller = false;
    } else if (who === 'admin') {
      // Only allow admin/rootadmin to hide appointments from admin view
      if (!isAdmin && !isRootAdmin) {
        return res.status(403).json({ message: 'Only admins can hide appointments from admin view.' });
      }
      // For admin view, we don't actually hide the appointment from the database
      // Instead, we just return success to remove it from the admin's UI
      // The appointment remains visible to buyer and seller
      return res.status(200).json({ message: 'Appointment removed from admin view.' });
    } else {
      return res.status(400).json({ message: 'Invalid who parameter. Must be buyer, seller, or admin.' });
    }
    
    await bookingToHide.save();
    res.status(200).json(bookingToHide);
  } catch (err) {
    res.status(500).json({ message: 'Failed to hide appointment.' });
  }
});

// PATCH: Archive appointment (admin only)
router.patch('/:id/archive', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isRootAdmin = req.user.role === 'rootadmin';
    const isAdmin = req.user.role === 'admin' && req.user.adminApprovalStatus === 'approved';

    // Only allow admin/rootadmin to archive
    if (!isAdmin && !isRootAdmin) {
      return res.status(403).json({ message: 'Only admins can archive appointments.' });
    }

    const bookingToArchive = await booking.findById(id);
    if (!bookingToArchive) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Archive the appointment
    bookingToArchive.archivedByAdmin = true;
    bookingToArchive.archivedAt = new Date();
    
    await bookingToArchive.save();

    // Populate the updated booking for response
    const updated = await booking.findById(id)
      .populate('buyerId', 'username email mobileNumber')
      .populate('sellerId', 'username email mobileNumber')
      .populate('listingId', '_id name address');
    // Emit socket.io event
    const io = req.app.get('io');
    if (io) {
      io.emit('appointmentUpdate', { appointmentId: id, updatedAppointment: updated });
    }
    res.status(200).json({
      message: 'Appointment archived successfully.',
      appointment: updated
    });
  } catch (err) {
    console.error('Error archiving appointment:', err);
    res.status(500).json({ message: 'Failed to archive appointment.' });
  }
});

// PATCH: Unarchive appointment (admin only)
router.patch('/:id/unarchive', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isRootAdmin = req.user.role === 'rootadmin';
    const isAdmin = req.user.role === 'admin' && req.user.adminApprovalStatus === 'approved';

    // Only allow admin/rootadmin to unarchive
    if (!isAdmin && !isRootAdmin) {
      return res.status(403).json({ message: 'Only admins can unarchive appointments.' });
    }

    const bookingToUnarchive = await booking.findById(id);
    if (!bookingToUnarchive) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Unarchive the appointment
    bookingToUnarchive.archivedByAdmin = false;
    bookingToUnarchive.archivedAt = undefined;
    
    await bookingToUnarchive.save();

    // Populate the updated booking for response
    const updated = await booking.findById(id)
      .populate('buyerId', 'username email mobileNumber')
      .populate('sellerId', 'username email mobileNumber')
      .populate('listingId', '_id name address');
    // Emit socket.io event
    const io = req.app.get('io');
    if (io) {
      io.emit('appointmentUpdate', { appointmentId: id, updatedAppointment: updated });
    }
    res.status(200).json({
      message: 'Appointment unarchived successfully.',
      appointment: updated
    });
  } catch (err) {
    console.error('Error unarchiving appointment:', err);
    res.status(500).json({ message: 'Failed to unarchive appointment.' });
  }
});

// GET: Get archived appointments (admin only)
router.get('/archived', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const isRootAdmin = req.user.role === 'rootadmin';
    const isAdmin = req.user.role === 'admin' && req.user.adminApprovalStatus === 'approved';

    // Only allow admin/rootadmin to view archived appointments
    if (!isAdmin && !isRootAdmin) {
      return res.status(403).json({ message: 'Only admins can view archived appointments.' });
    }

    const archivedAppointments = await booking.find({ archivedByAdmin: true })
      .populate('buyerId', 'username email mobileNumber')
      .populate('sellerId', 'username email mobileNumber')
      .populate('listingId', '_id name address')
      .sort({ archivedAt: -1 }); // Sort by most recently archived first

    res.status(200).json(archivedAppointments);
  } catch (err) {
    console.error('Error fetching archived appointments:', err);
    res.status(500).json({ message: 'Failed to fetch archived appointments.' });
  }
});

// POST: Reinitiate a cancelled appointment (user-side)
router.post('/reinitiate', verifyToken, async (req, res) => {
  try {
    const { _id, date, time, message } = req.body;
    const userId = req.user.id;
    if (!_id) return res.status(400).json({ message: 'Original appointment ID required.' });
    const original = await booking.findById(_id);
    if (!original) return res.status(404).json({ message: 'Original appointment not found.' });
    // Only allow if user is buyer or seller
    if (original.buyerId.toString() !== userId && original.sellerId.toString() !== userId) {
      return res.status(403).json({ message: 'You can only reinitiate your own appointments.' });
    }
    // Only allow if status is cancelledByBuyer or cancelledBySeller and user is the canceller
    if (
      (original.status === 'cancelledByBuyer' && original.buyerId.toString() !== userId) ||
      (original.status === 'cancelledBySeller' && original.sellerId.toString() !== userId)
    ) {
      return res.status(403).json({ message: 'Only the party who cancelled can reinitiate.' });
    }
    // Limit reinitiation per party
    let role, count, countField;
    if (original.buyerId.toString() === userId) {
      role = 'buyer';
      count = original.buyerReinitiationCount || 0;
      countField = 'buyerReinitiationCount';
    } else {
      role = 'seller';
      count = original.sellerReinitiationCount || 0;
      countField = 'sellerReinitiationCount';
    }
    if (count >= 2) {
      return res.status(400).json({ message: 'Maximum number of reinitiations reached for your role.' });
    }
    // Check both parties still exist
    const buyer = await User.findById(original.buyerId);
    const seller = await User.findById(original.sellerId);
    if (!buyer || !seller) {
      return res.status(400).json({ message: 'Cannot reinitiate: one of the parties no longer exists.' });
    }
    // Update the same booking: set new date/time/message, status to pending, increment correct count, add to history
    original.date = date;
    original.time = time;
    original.message = message;
    original.status = 'pending';
    original.cancelReason = '';
    original.cancelledBy = undefined;
    original[countField] = count + 1;
    original.reinitiationHistory = original.reinitiationHistory || [];
    original.reinitiationHistory.push({ date, time, message, userId });
    original.visibleToBuyer = true;
    original.visibleToSeller = true;
    await original.save();
    // Notify the opposite party when appointment is reinitiated by buyer or seller
    try {
      let notifyUserId, notifyRole;
      if (userId === original.buyerId.toString()) {
        notifyUserId = original.sellerId;
        notifyRole = 'seller';
      } else if (userId === original.sellerId.toString()) {
        notifyUserId = original.buyerId;
        notifyRole = 'buyer';
      }
      if (notifyUserId) {
        const notification = await Notification.create({
          userId: notifyUserId,
          type: 'appointment_reinitiated_by_user',
          title: 'Appointment Reinitiated',
          message: `The appointment for "${original.propertyName}" was reinitiated by the ${notifyRole === 'seller' ? 'buyer' : 'seller'}. Please review the details.`,
          listingId: original.listingId,
          adminId: null
        });
        const io = req.app.get('io');
        if (io) io.to(notifyUserId.toString()).emit('notificationCreated', notification);
      }
    } catch (notificationError) {
      console.error('Failed to create notification for opposite party:', notificationError);
    }
    // Emit socket.io event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('appointmentUpdate', { appointmentId: original._id, updatedAppointment: original });
    }
    res.status(200).json({ message: 'Appointment reinitiated successfully!', reinitiationLeft: 2 - (count + 1), appointment: original });
  } catch (err) {
    console.error('Error in user reinitiate:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET: Get booking statistics (admin only)
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const isRootAdmin = req.user.role === 'rootadmin';
    const isAdmin = req.user.role === 'admin' && req.user.adminApprovalStatus === 'approved';

    // Only allow admin/rootadmin to view booking stats
    if (!isAdmin && !isRootAdmin) {
      return res.status(403).json({ message: 'Only admins can view booking statistics.' });
    }

    // Get counts for different statuses
    const [accepted, pending, rejected] = await Promise.all([
      booking.countDocuments({ 
        status: 'accepted',
        archivedByAdmin: { $ne: true }
      }),
      booking.countDocuments({ 
        status: 'pending',
        archivedByAdmin: { $ne: true }
      }),
      booking.countDocuments({ 
        status: { 
          $in: [
            'rejected', 'deletedByAdmin', 'cancelledByBuyer', 
            'cancelledBySeller', 'cancelledByAdmin', 'noShow'
          ]
        },
        archivedByAdmin: { $ne: true }
      })
    ]);

    const total = accepted + pending + rejected;

    res.status(200).json({
      total,
      accepted,
      pending,
      rejected
    });
  } catch (err) {
    console.error('Error fetching booking stats:', err);
    res.status(500).json({ message: 'Failed to fetch booking statistics.' });
  }
});

// PATCH: Mark all comments as read for a user
router.patch('/:id/comments/read', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const bookingDoc = await booking.findById(id);
    if (!bookingDoc) return res.status(404).json({ message: 'Appointment not found.' });

    let updated = false;
    bookingDoc.comments.forEach(comment => {
      if (!comment.readBy.map(String).includes(userId)) {
        comment.readBy.push(userId);
        comment.status = "read";
        updated = true;
      }
    });
    if (updated) await bookingDoc.save();

    // Emit read event for all comments
    const io = req.app.get('io');
    if (io) {
      io.emit('commentRead', { appointmentId: id, userId });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark comments as read.' });
  }
});

// POST: Admin books appointment for a user
router.post("/admin", verifyToken, async (req, res) => {
  try {
    const { buyerEmail, buyerId: buyerIdFromBody, listingId, date, time, message, purpose, propertyName, propertyDescription } = req.body;
    const adminId = req.user.id;
    const isRootAdmin = req.user.role === 'rootadmin';
    const isAdmin = req.user.role === 'admin' && req.user.adminApprovalStatus === 'approved';
    if (!isAdmin && !isRootAdmin) {
      return res.status(403).json({ message: "Only admins can book appointments for users." });
    }
    // Find the buyer by email or ID
    let buyer = null;
    if (buyerIdFromBody) {
      buyer = await User.findById(buyerIdFromBody);
    } else if (buyerEmail) {
      buyer = await User.findOne({ email: buyerEmail });
    }
    if (!buyer) {
      return res.status(404).json({ message: "Buyer not found." });
    }
    // Find the listing to get seller information
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: "Listing not found." });
    }
    const seller = await User.findById(listing.userRef);
    if (!seller) {
      return res.status(404).json({ message: "Property owner not found. Please contact support." });
    }
    // Prevent admin from booking for the property owner
    if (buyer._id.toString() === seller._id.toString()) {
      return res.status(400).json({ message: "Cannot book an appointment for the property owner themselves." });
    }
    // Prevent duplicate active appointments for this buyer (not outdated)
    const currentDate = new Date();
    const currentDateString = currentDate.toISOString().split('T')[0];
    const currentTimeString = currentDate.toTimeString().split(' ')[0];
    
    const orConditions = [
      { 
        status: { $in: ["pending", "accepted"] },
        $or: [
          { date: { $gt: currentDateString } },
          { 
            date: currentDateString,
            time: { $gt: currentTimeString }
          }
        ]
      },
      // Also check for cancelled appointments where buyer can still reinitiate
      // Note: Don't block for cancelledBySeller - buyer should be able to book new appointment
      {
        status: "cancelledByBuyer",
        buyerReinitiationCount: { $lt: 2 },
        $or: [
          { date: { $gt: currentDateString } },
          { 
            date: currentDateString,
            time: { $gt: currentTimeString }
          }
        ]
      }
    ];
    let visibilityCondition = { visibleToBuyer: { $ne: false } };
    const existing = await booking.findOne({
      listingId,
      buyerId: buyer._id,
      $or: orConditions,
      ...visibilityCondition
    });
    if (existing) {
      return res.status(400).json({ message: "This user already has an active appointment for this property or can still reinitiate. Booking Failed." });
    }
    // Create the appointment
    const newBooking = new booking({
      name: buyer.username,
      email: buyer.email,
      phone: buyer.phone || "",
      date,
      time,
      message,
      listingId,
      buyerId: buyer._id,
      sellerId: seller._id,
      purpose,
      propertyName,
      propertyDescription,
    });
    await newBooking.save();
    // Emit socket.io event for real-time new appointment
    const io = req.app.get('io');
    if (io) {
      io.emit('appointmentCreated', { appointment: newBooking });
    }
    // Notify buyer
    try {
      const notification = await Notification.create({
        userId: buyer._id,
        type: 'admin_booked_appointment',
        title: 'Appointment Booked by Admin',
        message: `A new appointment for "${listing.name}" has been booked on behalf of you by admin.`,
        listingId: listing._id,
        adminId: req.user.id
      });
      if (io) io.to(buyer._id.toString()).emit('notificationCreated', notification);
    } catch (notificationError) {
      console.error('Failed to create notification for buyer:', notificationError);
    }
    // Notify seller
    try {
      const notification = await Notification.create({
        userId: seller._id,
        type: 'appointment_booked',
        title: 'New Appointment Booked',
        message: `A new appointment for "${listing.name}" has been booked by admin on behalf of ${buyer.username}`,
        listingId: listing._id,
        adminId: req.user.id
      });
      if (io) io.to(seller._id.toString()).emit('notificationCreated', notification);
    } catch (notificationError) {
      console.error('Failed to create notification for seller:', notificationError);
    }
    res.status(201).json({ message: "Appointment booked successfully!", appointment: newBooking });
  } catch (err) {
    console.error("Error creating admin booking:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET: Fetch a single booking by ID (with comments)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const bookingDoc = await booking.findById(id)
      .populate('buyerId', 'username email mobileNumber')
      .populate('sellerId', 'username email mobileNumber')
      .populate('listingId', '_id name address');
    if (!bookingDoc) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }
    res.status(200).json(bookingDoc);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch appointment.' });
  }
});

export default router;

// --- SOCKET.IO: User Appointments Page Active (for delivered ticks) ---
export function registerUserAppointmentsSocket(io) {
  io.on('connection', (socket) => {
    socket.on('userAppointmentsActive', async ({ userId }) => {
      try {
        // Find all bookings where this user is buyer or seller
        const bookings = await booking.find({
          $or: [ { buyerId: userId }, { sellerId: userId } ]
        });
        for (const appt of bookings) {
          let updated = false;
          for (const comment of appt.comments) {
            // Only mark as delivered if:
            // 1. Comment is not from this user 
            // 2. Comment status is "sent" (meaning it was sent while recipient was offline)
            // 3. Comment is not already delivered or read
            if (comment.sender.toString() !== userId && 
                comment.status === 'sent' && 
                !comment.readBy?.includes(userId)) {
              comment.status = 'delivered';
              updated = true;
              io.emit('commentDelivered', { appointmentId: appt._id.toString(), commentId: comment._id.toString() });
            }
          }
          if (updated) await appt.save();
        }
      } catch (err) {
        console.error('Error marking comments as delivered:', err);
      }
    });
  });
}

