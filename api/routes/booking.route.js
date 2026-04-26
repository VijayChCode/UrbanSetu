import express from "express";
import mongoose from "mongoose";
import booking from "../models/booking.model.js";
import Listing from "../models/listing.model.js";
import DeletedListing from "../models/deletedListing.model.js";
import User from "../models/user.model.js";
import { verifyToken } from '../utils/verify.js';
import Review from '../models/review.model.js';
import Notification from '../models/notification.model.js';
import Dispute from '../models/dispute.model.js';
import {
  sendAppointmentBookingEmail,
  sendAppointmentRejectedEmail,
  sendAppointmentAcceptedEmail,
  sendAppointmentCancelledByBuyerEmail,
  sendAppointmentCancelledBySellerEmail,
  sendAppointmentCancelledByAdminEmail,
  sendAppointmentReinitiatedByAdminEmail,
  sendAppointmentReinitiatedBySellerEmail,
  sendAppointmentReinitiatedByBuyerEmail,
  sendNewMessageNotificationEmail,
  sendTokenReceivedEmail,
  sendPropertySoldEmail,
  sendDisputeAlertEmail
} from '../utils/emailService.js';
import { rejectContractForBooking } from '../controllers/rental.controller.js';
import bcryptjs from 'bcryptjs';
import {
  isListingUnavailable,
  getAvailabilityGuardMessage,
  lockListingForBooking,
  releaseListingLock
} from '../utils/listingAvailability.js';
import { sendPushNotification } from '../utils/pushNotification.js';

const router = express.Router();

// POST: Create a booking
router.post("/", verifyToken, async (req, res) => {
  try {
    const { listingId, date, time, message, purpose, propertyName, propertyDescription } = req.body;
    const buyerId = req.user.id;

    // Find the listing to get seller information
    const listing = await Listing.findById(listingId);
    if (!listing) {
      // Check if it exists in deleted listings
      const isDeleted = await DeletedListing.findOne({ originalListingId: listingId });
      if (isDeleted) {
        return res.status(404).json({ message: "This property is no longer active or has been removed." });
      }
      return res.status(404).json({ message: "Listing not found." });
    }

    // Find the seller by userRef (which contains the seller's user ID)
    const seller = await User.findById(listing.userRef);
    if (!seller) {
      return res.status(404).json({ message: "Property owner not found. Please contact support." });
    }
    if (isListingUnavailable(listing)) {
      return res.status(400).json({
        message: getAvailabilityGuardMessage(listing),
        code: 'PROPERTY_LOCKED'
      });
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
    // Only block: pending, accepted appointments that are not outdated for the same buyer
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

    // Check for existing appointments where the current user is the buyer
    const existing = await booking.findOne({
      listingId,
      buyerId: buyerId, // Only check appointments where this user is the buyer
      $or: orConditions
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
    try {
      await lockListingForBooking({
        listingId,
        bookingId: newBooking._id,
        lockReason: purpose === 'rent' ? 'awaiting_payment' : 'booking_pending'
      });
    } catch (lockError) {
      console.error('Failed to lock listing after booking creation:', lockError);
    }
    // Emit socket.io event for real-time new appointment
    const io = req.app.get('io');
    if (io) {
      io.emit('appointmentCreated', { appointment: newBooking });
      // Also emit to admin rooms for real-time updates
      io.to('admin_*').emit('appointmentCreated', { appointment: newBooking });
    }
    // Notify seller
    try {
      const notification = await Notification.create({
        userId: seller._id,
        type: 'appointment_booked',
        title: 'New Appointment Booked',
        message: `A new appointment for "${listing.name}" has been booked by ${buyer.username}.`,
        listingId: listing._id,
        adminId: null,
        meta: {
          imageUrl: listing.imageUrls ? listing.imageUrls[0] : null,
          category: 'appointment_booked',
          actions: [
            { title: '✅ Accept', identifier: 'accept_booking' },
            { title: '❌ Reject', identifier: 'reject_booking' }
          ]
        }
      });

      if (io) io.to(seller._id.toString()).emit('notificationCreated', notification);
    } catch (notificationError) {
      console.error('Failed to create notification for seller:', notificationError);
    }

    // Send appointment booking confirmation emails
    try {
      // Prepare appointment details for email
      const appointmentDetails = {
        appointmentId: newBooking._id,
        propertyName: listing.name,
        propertyDescription: listing.description,
        propertyAddress: listing.address,
        propertyPrice: listing.regularPrice || listing.discountPrice,
        propertyImages: listing.imageUrls || [],
        date: newBooking.date,
        time: newBooking.time,
        buyerName: buyer.firstName && buyer.lastName
          ? `${buyer.firstName} ${buyer.lastName}`
          : buyer.username,
        buyerEmail: buyer.email,
        sellerName: seller.firstName && seller.lastName
          ? `${seller.firstName} ${seller.lastName}`
          : seller.username,
        sellerEmail: seller.email,
        purpose: newBooking.purpose,
        message: newBooking.message,
        listingId: listing._id,
        paymentStatus: 'pending', // New appointments start as pending payment
        bookedByAdmin: false // Flag to indicate this was booked by user
      };

      // Send email to buyer
      try {
        await sendAppointmentBookingEmail(buyer.email, appointmentDetails, 'buyer');
        console.log(`✅ Appointment booking email sent to buyer: ${buyer.email}`);
      } catch (buyerEmailError) {
        console.error(`❌ Failed to send booking email to buyer: ${buyer.email}`, buyerEmailError);
      }

      // Send email to seller
      try {
        await sendAppointmentBookingEmail(seller.email, appointmentDetails, 'seller');
        console.log(`✅ Appointment booking email sent to seller: ${seller.email}`);
      } catch (sellerEmailError) {
        console.error(`❌ Failed to send booking email to seller: ${seller.email}`, sellerEmailError);
      }

    } catch (emailError) {
      console.error('❌ Error sending appointment booking emails:', emailError);
      // Don't fail the booking if email fails
    }

    res.status(201).json({ message: "Appointment booked successfully!", appointment: newBooking });
  } catch (err) {
    console.error("Error creating booking:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH: Admin toggle payment status for an appointment
router.patch('/:id/payment-status', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentConfirmed } = req.body;
    const requesterId = req.user.id;
    const user = await User.findById(requesterId);
    const isAdmin = (user && user.role === 'admin' && user.adminApprovalStatus === 'approved') || (user && user.role === 'rootadmin');
    if (!isAdmin) {
      return res.status(403).json({ message: 'Only admins can change payment status.' });
    }

    const appt = await booking.findByIdAndUpdate(
      id,
      { paymentConfirmed: Boolean(paymentConfirmed) },
      { new: true }
    ).populate('buyerId', 'username email mobileNumber avatar')
      .populate('sellerId', 'username email mobileNumber avatar')
      .populate('listingId', '_id name address');
    if (!appt) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('appointmentUpdate', { appointmentId: id, updatedAppointment: appt });
      io.emit('paymentStatusUpdated', { appointmentId: id, paymentConfirmed: appt.paymentConfirmed });
      io.to('admin_*').emit('appointmentUpdate', { appointmentId: id, updatedAppointment: appt });
      io.to('admin_*').emit('paymentStatusUpdated', { appointmentId: id, paymentConfirmed: appt.paymentConfirmed });
    }
    return res.status(200).json({ message: 'Payment status updated.', appointment: appt });
  } catch (err) {
    console.error('Error updating payment status:', err);
    return res.status(500).json({ message: 'Failed to update payment status.' });
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

    // Find all appointments where user is either buyer or seller, excluding archived ones
    const bookings = await booking.find({
      $or: [
        { buyerId: userId, archivedByBuyer: { $ne: true } },
        { sellerId: userId, archivedBySeller: { $ne: true } }
      ]
    })
      .populate('buyerId', 'username email mobileNumber avatar profileVisibility')
      .populate('sellerId', 'username email mobileNumber avatar profileVisibility')
      .populate('listingId', '_id name address')
      .sort({ createdAt: -1 });

    // Add role information to each booking and apply privacy masking
    const bookingsWithRole = bookings
      .filter(booking => booking.buyerId && booking.buyerId._id && booking.sellerId && booking.sellerId._id) // skip if any is null
      .map(booking => {
        const bookingObj = booking.toObject();
        const role = booking.buyerId._id.toString() === userId ? 'buyer' : 'seller';
        bookingObj.role = role;

        // Determine if we need to mask the other party
        // For MyAppointments: 'public' AND 'friends' are VISIBLE. Only 'private' is HIDDEN.
        if (role === 'buyer') {
          // User is buyer, check seller privacy
          if (bookingObj.sellerId.profileVisibility === 'private') {
            bookingObj.sellerId.username = 'UrbanSetu Member';
            bookingObj.sellerId.email = undefined;
            bookingObj.sellerId.mobileNumber = undefined;
            bookingObj.sellerId.avatar = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
          }
        } else {
          // User is seller, check buyer privacy
          if (bookingObj.buyerId.profileVisibility === 'private') {
            bookingObj.buyerId.username = 'UrbanSetu Member';
            bookingObj.buyerId.email = undefined;
            bookingObj.buyerId.mobileNumber = undefined;
            bookingObj.buyerId.avatar = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
          }
        }

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
      .populate('buyerId', 'username email mobileNumber avatar')
      .populate('sellerId', 'username email mobileNumber avatar')
      .populate('listingId', '_id name address')
      .sort({ createdAt: -1 });
    res.status(200).json(pendingBookings);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST: Verify document access
router.post('/verify-document-access', verifyToken, async (req, res) => {
  try {
    const { documentUrl, appointmentId } = req.body;
    const userId = req.user.id;

    if (!documentUrl) {
      return res.status(400).json({ allowed: false, message: 'Document URL is required' });
    }

    // Require appointmentId for robust verification
    if (!appointmentId) {
      return res.status(400).json({ allowed: false, message: 'Appointment ID is required for verification' });
    }

    const appt = await booking.findById(appointmentId);
    if (!appt) {
      return res.status(404).json({ allowed: false, message: 'Appointment not found' });
    }

    // Check user role
    const user = await User.findById(userId);
    const isBuyer = appt.buyerId.toString() === userId;
    const isSeller = appt.sellerId.toString() === userId;
    const isAdmin = (user && (user.role === 'admin' || user.role === 'rootadmin'));

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ allowed: false, message: 'Unauthorized' });
    }

    // Check if document exists in this appointment's comments
    // Check all variations of media URLs in comments
    const hasDocument = appt.comments.some(c =>
      (c.documentUrl === documentUrl) ||
      (c.imageUrl === documentUrl) ||
      (c.videoUrl === documentUrl) ||
      (c.audioUrl === documentUrl)
    );

    if (hasDocument) {
      return res.status(200).json({ allowed: true });
    } else {
      // If exact match failed, try checking without query params just in case
      const cleanDocUrl = documentUrl.split('?')[0];
      const hasLooseMatch = appt.comments.some(c => {
        const urls = [c.documentUrl, c.imageUrl, c.videoUrl, c.audioUrl].filter(Boolean);
        return urls.some(u => u.split('?')[0] === cleanDocUrl);
      });

      if (hasLooseMatch) {
        return res.status(200).json({ allowed: true });
      }

      return res.status(403).json({ allowed: false, message: 'Document not associated with this appointment' });
    }

  } catch (err) {
    console.error('Error verifying document access:', err);
    res.status(500).json({ allowed: false, message: 'Server error' });
  }
});

// PATCH: Update appointment status (for sellers only)
router.patch('/:id/status', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;
    const sellerId = req.user.id;

    // Get socket.io instance early
    const io = req.app.get('io');

    // Find the booking and verify the seller owns it
    const bookingToUpdate = await booking.findById(id);
    if (!bookingToUpdate) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    if (bookingToUpdate.sellerId.toString() !== sellerId) {
      return res.status(403).json({ message: 'You can only update appointments for your own properties.' });
    }

    // Prevent rejection of paid appointments
    if (status === 'rejected' && bookingToUpdate.paymentConfirmed) {
      return res.status(400).json({
        message: 'Cannot reject appointment as payment has been completed by the buyer. Please contact support if you need to cancel this appointment.'
      });
    }

    const updated = await booking.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate('buyerId', 'username email mobileNumber avatar')
      .populate('sellerId', 'username email mobileNumber avatar')
      .populate('listingId', 'name description address imageUrls regularPrice');

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

        if (updated.buyerId && (updated.buyerId._id || updated.buyerId)) {
          const bId = updated.buyerId._id || updated.buyerId;
          const notification = await Notification.create({
            userId: bId,
            type: notificationType,
            title: notificationTitle,
            message: notificationMessage,
            listingId: updated.listingId._id || updated.listingId,
            adminId: null,
            meta: {
              imageUrl: updated.listingId.imageUrls ? updated.listingId.imageUrls[0] : null,
              category: notificationType
            }
          });

          if (io) io.to(bId.toString()).emit('notificationCreated', notification);
        }

        // Send email notification to buyer
        try {
          console.log(`📧 Preparing to send ${status} email to buyer: ${updated.buyerId.email}`);

          const appointmentDetails = {
            appointmentId: updated._id,
            propertyName: updated.listingId.name,
            propertyDescription: updated.listingId.description || '',
            propertyAddress: updated.listingId.address,
            propertyPrice: updated.listingId.regularPrice,
            propertyImages: updated.listingId.imageUrls || [],
            date: updated.date,
            time: updated.time,
            sellerName: updated.sellerId.username,
            purpose: updated.purpose,
            message: updated.message,
            listingId: updated.listingId._id,
            rejectionReason: req.body.rejectionReason || null
          };

          console.log(`📧 Appointment details for email:`, {
            buyerEmail: updated.buyerId.email,
            status: status,
            propertyName: appointmentDetails.propertyName,
            sellerName: appointmentDetails.sellerName
          });

          if (status === 'accepted') {
            const emailResult = await sendAppointmentAcceptedEmail(updated.buyerId.email, appointmentDetails);
            console.log(`✅ Appointment accepted email sent to buyer: ${updated.buyerId.email}`, emailResult);
          } else if (status === 'rejected') {
            const emailResult = await sendAppointmentRejectedEmail(updated.buyerId.email, appointmentDetails);
            console.log(`❌ Appointment rejected email sent to buyer: ${updated.buyerId.email}`, emailResult);
          }
        } catch (emailError) {
          console.error('Error sending status change email to buyer:', emailError);
        }
      }
    } catch (notificationError) {
      console.error('Failed to create notification for buyer:', notificationError);
    }
    // --- END Notify buyer logic ---

    // --- Auto-reject contract if booking is rejected and purpose is 'rent' ---
    // Note: Contract is linked via contract.bookingId (not booking.contractId)
    // So we always try to find and reject a contract when a rent booking is rejected
    if (status === 'rejected' && updated.purpose === 'rent') {
      try {
        const rejectionReason = req.body.rejectionReason || 'Booking was rejected by seller';
        const result = await rejectContractForBooking(
          bookingToUpdate._id, // This is the bookingId that the contract references
          sellerId,
          rejectionReason
        );
        if (result.success) {
          console.log(`✅ Contract ${result.contract.contractId} rejected automatically for booking ${bookingToUpdate._id}`);
        } else {
          // Log but don't fail if contract not found or already rejected/terminated
          if (result.message?.includes('not found')) {
            console.log(`ℹ️ No contract found for booking ${bookingToUpdate._id} - this is normal if contract was not created yet.`);
          } else {
            console.log(`⚠️ Could not auto-reject contract for booking ${bookingToUpdate._id}: ${result.message}`);
          }
        }
      } catch (contractError) {
        console.error('Error auto-rejecting contract for booking:', contractError);
        // Don't fail the booking update if contract rejection fails
      }
    }
    // --- END Auto-reject contract logic ---

    // Emit socket.io event for real-time appointment update
    if (io) {
      io.emit('appointmentUpdate', { appointmentId: id, updatedAppointment: updated });
      // Also emit to admin rooms for real-time updates
      io.to('admin_*').emit('appointmentUpdate', { appointmentId: id, updatedAppointment: updated });
    }

    if (status === 'rejected') {
      try {
        await releaseListingLock({
          listingId: bookingToUpdate.listingId,
          bookingId: bookingToUpdate._id,
          releaseReason: 'booking_rejected',
          force: true
        });
      } catch (releaseError) {
        console.error('Failed to release listing after rejection:', releaseError);
      }
    }

    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update appointment status.' });
  }
});

// POST: Add a comment to an appointment
router.post('/:id/comment', verifyToken, async (req, res) => {
  try {
    const { message, replyTo, imageUrl, videoUrl, documentUrl, documentName, documentMimeType, audioUrl, audioName, audioMimeType, type, previewDismissed } = req.body;
    const { id } = req.params;
    const userId = req.user.id;

    // Validate ObjectId format
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid appointment ID format.' });
    }

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
      ...(imageUrl ? { imageUrl } : {}),
      ...(videoUrl ? { videoUrl } : {}),
      ...(documentUrl ? { documentUrl, documentName: documentName || null, documentMimeType: documentMimeType || null } : {}),
      ...(audioUrl ? { audioUrl, audioName: audioName || null, audioMimeType: audioMimeType || null } : {}),
      ...(type ? { type } : {}),
      ...(typeof previewDismissed === 'boolean' ? { previewDismissed } : {}),
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

      // Determine the recipient of the message
      const isBuyer = bookingToComment.buyerId.toString() === userId;

      const isSeller = bookingToComment.sellerId.toString() === userId;
      const isAdmin = !isBuyer && !isSeller;

      // Get populated booking data for email addresses
      const populatedBooking = await booking.findById(id)
        .populate('buyerId', 'email')
        .populate('sellerId', 'email');

      // Prepare complete data for emission
      const emitData = {
        appointmentId: id,
        comment: newCommentObj,
        buyerEmail: populatedBooking.buyerId.email,
        sellerEmail: populatedBooking.sellerId.email
      };

      if (isAdmin) {
        // If admin is sending, emit to both buyer and seller
        io.to(bookingToComment.buyerId.toString()).emit('commentUpdate', emitData);
        io.to(bookingToComment.sellerId.toString()).emit('commentUpdate', emitData);

        // For admin, only emit to appointment room (not personal room) to avoid duplicates
        // Admin will receive the message through appointment room since they're joined to all appointment rooms
        io.to(`appointment_${id}`).emit('commentUpdate', emitData);
      } else {
        // If buyer or seller is sending, emit to the other party
        const recipientId = isBuyer ? bookingToComment.sellerId.toString() : bookingToComment.buyerId.toString();
        // Removed excessive logging
        io.to(recipientId).emit('commentUpdate', emitData);

        // Also emit to the sender for their own message sync
        io.to(userId).emit('commentUpdate', emitData);

        // Emit to appointment room for admin access (so admin sees user messages immediately)
        io.to(`appointment_${id}`).emit('commentUpdate', emitData);

        // ADDITIONAL: Explicitly emit to all connected admin sockets to ensure they receive user messages
        const adminSockets = Array.from(io.sockets.sockets.values()).filter(s =>
          s.adminId && (s.adminRole === 'admin' || s.adminRole === 'rootadmin')
        );

        for (const adminSocket of adminSockets) {
          adminSocket.emit('commentUpdate', emitData);
        }
      }

      // Smart email notification to the other party
      try {
        const sender = await User.findById(userId).select('username email firstName lastName');
        const recipientUser = isBuyer
          ? await User.findById(bookingToComment.sellerId).select('email firstName lastName _id')
          : await User.findById(bookingToComment.buyerId).select('email firstName lastName _id');

        if (sender && recipientUser && recipientUser.email) {
          const senderName = sender.firstName && sender.lastName
            ? `${sender.firstName} ${sender.lastName}`
            : sender.username;
          const recipientName = recipientUser.firstName && recipientUser.lastName
            ? `${recipientUser.firstName} ${recipientUser.lastName}`
            : recipientUser.email.split('@')[0];

          // Determine online status of recipient
          const onlineUsers = req.app.get('onlineUsers') || new Set();
          const recipientId = recipientUser._id.toString();
          const recipientOnline = onlineUsers.has(recipientId);

          // Update unread counters atomically to avoid VersionError on concurrent sends
          const now = new Date();
          let shouldSendEmail = false;

          if (isBuyer) {
            // recipient is seller - atomically increment seller unread count
            const apptDoc = await booking.findOneAndUpdate(
              { _id: id },
              { $inc: { sellerUnreadMessageCount: 1 } },
              { new: true }
            );
            if (apptDoc) {
              const lastSent = apptDoc.sellerLastEmailSentAt ? new Date(apptDoc.sellerLastEmailSentAt) : null;
              const cooldownMs = 60 * 60 * 1000; // 60 minutes
              const inCooldown = lastSent && (now - lastSent) < cooldownMs;
              if (!recipientOnline && apptDoc.sellerUnreadMessageCount === 1 && !inCooldown) {
                shouldSendEmail = true;
                // Set the email sent timestamp atomically
                await booking.updateOne({ _id: id }, { $set: { sellerLastEmailSentAt: now } });
              }
            }
          } else if (isSeller) {
            // recipient is buyer - atomically increment buyer unread count
            const apptDoc = await booking.findOneAndUpdate(
              { _id: id },
              { $inc: { buyerUnreadMessageCount: 1 } },
              { new: true }
            );
            if (apptDoc) {
              const lastSent = apptDoc.buyerLastEmailSentAt ? new Date(apptDoc.buyerLastEmailSentAt) : null;
              const cooldownMs = 60 * 60 * 1000; // 60 minutes
              const inCooldown = lastSent && (now - lastSent) < cooldownMs;
              if (!recipientOnline && apptDoc.buyerUnreadMessageCount === 1 && !inCooldown) {
                shouldSendEmail = true;
                // Set the email sent timestamp atomically
                await booking.updateOne({ _id: id }, { $set: { buyerLastEmailSentAt: now } });
              }
            }
          }

          if (shouldSendEmail) {
            const messagePreview = message || (imageUrl ? '📷 Image' : (videoUrl ? '🎥 Video' : (documentUrl ? '📄 Document' : (audioUrl ? '🔊 Audio' : 'Message'))));
            const messageDetails = {
              recipientName,
              senderName,
              appointmentId: id,
              propertyName: bookingToComment.propertyName || 'Your Property',
              messagePreview: (messagePreview || '').toString().substring(0, 140),
              messageType: type || 'text'
            };
            // Send email asynchronously without blocking the response
            sendNewMessageNotificationEmail(recipientUser.email, messageDetails)
              .then(() => console.log(`📧 New message notification email sent to: ${recipientUser.email}`))
              .catch(err => console.error('Error sending background email notification:', err));
          } else {
            console.log('📧 Email suppressed (online or cooldown or not first unread). Recipient:', recipientUser.email);
          }

          // ALWAYS try to send Push Notification regardless of email cooldown (Pushes are less intrusive)
          const pushPreview = message || (imageUrl ? '📷 Image' : (videoUrl ? '🎥 Video' : (documentUrl ? '📄 Document' : (audioUrl ? '🔊 Audio' : 'Message'))));
          sendPushNotification(recipientUser._id.toString(), `New message from ${senderName}`, pushPreview, {
            appointmentId: id,
            type: 'chat_message',
            category: 'chat_message',
            actions: [
              { title: '💬 View Chat', identifier: 'view_chat' }
            ]
          });
        }
      } catch (emailError) {
        // Log critical errors in setup (not sending) but don't block
        console.error('Error processing new message notification setup:', emailError);
      }

      // Only mark as delivered if the intended recipient is online
      const onlineUsers = req.app.get('onlineUsers') || new Set();

      if (isAdmin) {
        // If admin is sending, check if both buyer and seller are online
        const buyerOnline = onlineUsers.has(bookingToComment.buyerId.toString());
        const sellerOnline = onlineUsers.has(bookingToComment.sellerId.toString());

        if (buyerOnline || sellerOnline) {
          // Mark as delivered if at least one recipient is online
          await booking.findOneAndUpdate(
            { _id: id, 'comments._id': newCommentObj._id },
            { $set: { 'comments.$.status': 'delivered', 'comments.$.deliveredAt': new Date() } }
          );
          // Emit delivery status immediately
          io.emit('commentDelivered', { appointmentId: id, commentId: newCommentObj._id });
        } else {
          // Removed excessive logging
        }
      } else {
        // If buyer or seller is sending, check if the other party is online
        const recipientId = isBuyer ? bookingToComment.sellerId.toString() : bookingToComment.buyerId.toString();

        if (onlineUsers.has(recipientId)) {
          // Recipient is online, mark as delivered immediately
          await booking.findOneAndUpdate(
            { _id: id, 'comments._id': newCommentObj._id },
            { $set: { 'comments.$.status': 'delivered', 'comments.$.deliveredAt': new Date() } }
          );
          // Emit delivery status immediately
          io.emit('commentDelivered', { appointmentId: id, commentId: newCommentObj._id });
        } else {
          // Recipient is offline, keep status as "sent"
          // When they come online, the socket handler will mark it as delivered
          // Removed excessive logging
        }
      }
    }

    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add comment.' });
  }
});

// PATCH: Update chat draft for an appointment
router.patch('/:id/draft', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { draft } = req.body;
    const userId = req.user.id;

    const bookingDoc = await booking.findById(id);
    if (!bookingDoc) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    const isBuyer = bookingDoc.buyerId.toString() === userId;
    const isSeller = bookingDoc.sellerId.toString() === userId;
    
    // Check if user is admin
    const user = await User.findById(userId);
    const isAdmin = (user && user.role === 'admin' && user.adminApprovalStatus === 'approved') || (user && user.role === 'rootadmin');

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ message: "You can only update drafts for appointments you are part of or as an admin." });
    }

    const update = {};
    if (isBuyer) update.buyerDraft = draft;
    else if (isSeller) update.sellerDraft = draft;
    else if (isAdmin) update.adminDraft = draft;

    const updated = await booking.findByIdAndUpdate(id, { $set: update }, { new: true });
    
    let savedDraft = "";
    if (isBuyer) savedDraft = updated.buyerDraft;
    else if (isSeller) savedDraft = updated.sellerDraft;
    else if (isAdmin) savedDraft = updated.adminDraft;

    res.status(200).json({ message: 'Draft updated.', draft: savedDraft });
  } catch (err) {
    console.error('Error updating draft:', err);
    res.status(500).json({ message: 'Failed to update draft.' });
  }
});

// PATCH: Mark sale as Token Paid (Locks the property)
router.patch('/:id/sale/token-paid', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const bookingToUpdate = await booking.findById(id);
    if (!bookingToUpdate) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Only seller can mark token as paid
    if (bookingToUpdate.sellerId.toString() !== userId) {
      return res.status(403).json({ message: 'Only the property owner can mark token as received.' });
    }

    if (bookingToUpdate.purpose !== 'buy') {
      return res.status(400).json({ message: 'This action is only for property sales.' });
    }

    // Update Booking
    const updatedBooking = await booking.findByIdAndUpdate(
      id,
      { saleStatus: 'token_paid' },
      { new: true }
    );

    // Update Listing - Lock it
    await Listing.findByIdAndUpdate(bookingToUpdate.listingId, {
      availabilityStatus: 'under_contract',
      availabilityMeta: {
        lockReason: 'sale_in_progress',
        bookingId: id,
        lockedAt: new Date()
      }
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('appointmentUpdate', { appointmentId: id, updatedAppointment: updatedBooking });
    }

    // --- Send Email Notifications ---
    try {
      // Fetch full details for email
      const fullBooking = await booking.findById(id)
        .populate('buyerId', 'email username firstName lastName')
        .populate('sellerId', 'email username firstName lastName')
        .populate('listingId', 'name');

      if (fullBooking && fullBooking.buyerId && fullBooking.sellerId) {
        const buyerName = fullBooking.buyerId.firstName ? `${fullBooking.buyerId.firstName} ${fullBooking.buyerId.lastName}` : fullBooking.buyerId.username;
        const sellerName = fullBooking.sellerId.firstName ? `${fullBooking.sellerId.firstName} ${fullBooking.sellerId.lastName}` : fullBooking.sellerId.username;

        await sendTokenReceivedEmail(
          fullBooking.buyerId.email,
          buyerName,
          fullBooking.sellerId.email,
          sellerName,
          fullBooking.listingId.name,
          0 // Amount not tracked in this simplified flow
        );
      }
    } catch (emailErr) {
      console.error("Error sending token received emails:", emailErr);
      // Do not fail the request
    }

    res.status(200).json({ message: 'Property locked for sale (Token Paid)', booking: updatedBooking });
  } catch (err) {
    console.error('Error marking token paid:', err);
    res.status(500).json({ message: 'Failed to update sale status.' });
  }
});

// PATCH: Compolete Sale (Mark as Sold)
router.patch('/:id/sale/complete', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const bookingToUpdate = await booking.findById(id);
    if (!bookingToUpdate) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    if (bookingToUpdate.sellerId.toString() !== userId) {
      return res.status(403).json({ message: 'Only the property owner can mark sale as valid.' });
    }

    // Update Booking
    const updatedBooking = await booking.findByIdAndUpdate(
      id,
      {
        saleStatus: 'sold',
        status: 'completed'
      },
      { new: true }
    );

    // Update Listing - Mark Sold
    await Listing.findByIdAndUpdate(bookingToUpdate.listingId, {
      availabilityStatus: 'sold',
      availabilityMeta: {
        lockReason: 'sold',
        bookingId: id,
        lockedAt: new Date() // Date sold
      }
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('appointmentUpdate', { appointmentId: id, updatedAppointment: updatedBooking });
    }

    // --- Send Email Notifications ---
    try {
      const fullBooking = await booking.findById(id)
        .populate('buyerId', 'email username firstName lastName')
        .populate('sellerId', 'email username firstName lastName')
        .populate('listingId', 'name');

      if (fullBooking && fullBooking.buyerId && fullBooking.sellerId) {
        const buyerName = fullBooking.buyerId.firstName ? `${fullBooking.buyerId.firstName} ${fullBooking.buyerId.lastName}` : fullBooking.buyerId.username;
        const sellerName = fullBooking.sellerId.firstName ? `${fullBooking.sellerId.firstName} ${fullBooking.sellerId.lastName}` : fullBooking.sellerId.username;

        await sendPropertySoldEmail(
          fullBooking.buyerId.email,
          buyerName,
          fullBooking.sellerId.email,
          sellerName,
          fullBooking.listingId.name
        );
      }
    } catch (emailErr) {
      console.error("Error sending property sold emails:", emailErr);
    }

    res.status(200).json({ message: 'Property marked as sold!', booking: updatedBooking });
  } catch (err) {
    console.error('Error completing sale:', err);
    res.status(500).json({ message: 'Failed to complete sale.' });
  }
});

// POST: Report a dispute for a sold property
router.post('/:id/sale/dispute', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    if (!reason) return res.status(400).json({ message: 'Dispute reason is required.' });

    const appt = await booking.findById(id)
      .populate('listingId', 'name')
      .populate('buyerId', 'username email')
      .populate('sellerId', 'username email');

    if (!appt) return res.status(404).json({ message: 'Booking not found.' });

    // Verify user involvement
    const isBuyer = appt.buyerId._id.toString() === userId;
    const isSeller = appt.sellerId._id.toString() === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ message: 'Unauthorized to report dispute on this booking.' });
    }

    // Check for existing active dispute for this booking
    const ongoingDispute = await Dispute.findOne({
      bookingId: id,
      status: { $nin: ['resolved', 'closed'] }
    });

    if (ongoingDispute) {
      return res.status(400).json({
        message: "An active dispute already exists for this transaction. Please wait for the admin to resolve it."
      });
    }

    // Create Dispute Record
    const raisedAgainst = isBuyer ? appt.sellerId._id : appt.buyerId._id;

    const dispute = new Dispute({
      bookingId: id,
      raisedBy: userId,
      raisedAgainst: raisedAgainst,
      category: 'other', // Default to other since we only have reason text
      title: `Dispute for ${appt.listingId.name}`,
      description: reason,
      priority: 'medium',
      status: 'open'
    });

    await dispute.save();

    // Send email to admin
    const rootAdmin = await User.findOne({ role: 'rootadmin' });
    const adminEmail = rootAdmin ? rootAdmin.email : process.env.EMAIL_USER;

    await sendDisputeAlertEmail(adminEmail, {
      propertyName: appt.listingId.name,
      bookingId: id,
      reporterName: isBuyer ? appt.buyerId.username : appt.sellerId.username,
      reporterRole: isBuyer ? 'Buyer' : 'Seller',
      reason: reason
    });

    return res.status(200).json({ message: 'Dispute reported successfully. Our team will review it shortly.', dispute });

  } catch (err) {
    console.error('Error reporting dispute:', err);
    res.status(500).json({ message: 'Failed to report dispute.' });
  }
});

// DELETE: Remove a comment from an appointment
router.delete('/:id/comment/:commentId', verifyToken, async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.user.id;

    // Validate ObjectId formats
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid appointment ID format.' });
    }
    if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: 'Invalid comment ID format.' });
    }

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

    // Preserve original image URL before marking as deleted
    if (!comment.originalImageUrl && comment.imageUrl) {
      comment.originalImageUrl = comment.imageUrl; // Only preserve if not already preserved
      console.log('✅ Preserved original image URL:', comment.originalImageUrl);
    } else if (!comment.originalImageUrl && !comment.imageUrl) {
      console.log('ℹ️ No image to preserve');
    } else if (comment.originalImageUrl) {
      console.log('ℹ️ Original image URL already preserved:', comment.originalImageUrl);
    }

    console.log('📋 Comment deletion state:', {
      messageLength: comment.message ? comment.message.length : 0,
      hasOriginalMessage: !!comment.originalMessage,
      originalMessageLength: comment.originalMessage ? comment.originalMessage.length : 0,
      hasImageUrl: !!comment.imageUrl,
      hasOriginalImageUrl: !!comment.originalImageUrl,
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
      imageUrl: comment.imageUrl, // Keep current image URL for socket before clearing
      originalImageUrl: comment.originalImageUrl,
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
      hasOriginalImageUrl: !!savedComment.originalImageUrl,
      originalImageUrl: savedComment.originalImageUrl,
      deletedBy: savedComment.deletedBy
    });

    // Emit socket event for real-time update with preserved message content
    const io = req.app.get('io');
    if (io) {
      // Emit to both buyer and seller for comment deletion updates
      io.to(bookingToUpdate.buyerId.toString()).emit('commentUpdate', { appointmentId: id, comment: commentForEmission });
      io.to(bookingToUpdate.sellerId.toString()).emit('commentUpdate', { appointmentId: id, comment: commentForEmission });
      // Emit to appointment room for admin access
      io.to(`appointment_${id}`).emit('commentUpdate', { appointmentId: id, comment: commentForEmission });
      console.log('📡 Socket emitted with preserved content');
    }
    // Return updated comments array
    res.status(200).json({ comments: bookingToUpdate.comments });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete comment.' });
  }
});

// DELETE: Bulk delete multiple comments for everyone
router.delete('/:id/comments/bulk-delete', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { commentIds } = req.body || {};
    const userId = req.user.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid appointment ID format.' });
    }
    if (!Array.isArray(commentIds) || commentIds.length === 0) {
      return res.status(400).json({ message: 'commentIds must be a non-empty array.' });
    }

    const bookingToUpdate = await booking.findById(id);
    if (!bookingToUpdate) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    const isBuyer = bookingToUpdate.buyerId.toString() === userId;
    const isSeller = bookingToUpdate.sellerId.toString() === userId;
    const user = await User.findById(userId);
    const isAdmin = (user && user.role === 'admin' && user.adminApprovalStatus === 'approved') || (user && user.role === 'rootadmin');
    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ message: 'You can only delete comments on your own appointments unless you are an admin or root admin.' });
    }

    const io = req.app.get('io');
    const emitted = [];
    for (const commentId of commentIds) {
      if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
        continue; // skip invalid ids
      }
      const comment = bookingToUpdate.comments.id(commentId);
      if (!comment) continue;

      // Optional: only allow deleting own messages when not admin
      if (!isAdmin && comment.senderEmail !== req.user.email) {
        continue;
      }

      if (!comment.originalMessage && comment.message) {
        comment.originalMessage = comment.message;
      }
      if (!comment.originalImageUrl && comment.imageUrl) {
        comment.originalImageUrl = comment.imageUrl;
      }

      comment.deleted = true;
      comment.deletedBy = req.user.email;
      comment.deletedAt = new Date();

      const commentForEmission = {
        _id: comment._id,
        senderEmail: comment.senderEmail,
        message: comment.message,
        originalMessage: comment.originalMessage,
        imageUrl: comment.imageUrl,
        originalImageUrl: comment.originalImageUrl,
        deleted: true,
        deletedBy: req.user.email,
        deletedAt: comment.deletedAt,
        timestamp: comment.timestamp,
        readBy: comment.readBy,
        replyTo: comment.replyTo,
        edited: comment.edited,
        editedAt: comment.editedAt
      };

      comment.message = '';
      emitted.push(commentForEmission);
    }

    bookingToUpdate.markModified('comments');
    await bookingToUpdate.save();

    if (io) {
      for (const commentForEmission of emitted) {
        io.to(bookingToUpdate.buyerId.toString()).emit('commentUpdate', { appointmentId: id, comment: commentForEmission });
        io.to(bookingToUpdate.sellerId.toString()).emit('commentUpdate', { appointmentId: id, comment: commentForEmission });
        io.to(`appointment_${id}`).emit('commentUpdate', { appointmentId: id, comment: commentForEmission });
      }
    }

    return res.status(200).json({ comments: bookingToUpdate.comments });
  } catch (err) {
    console.error('Failed to bulk delete comments:', err);
    return res.status(500).json({ message: 'Failed to bulk delete comments.' });
  }
});

// DELETE: Clear all comments for an appointment (admin only, password required)
router.delete('/:id/comments', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body || {};

    // Validate ObjectId format
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid appointment ID format.' });
    }

    if (!password) {
      return res.status(400).json({ message: 'Password is required.' });
    }

    // Verify current user is admin or rootadmin
    const requesterId = (req.user && (req.user._id || req.user.id)) ? (req.user._id || req.user.id) : null;
    if (!requesterId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const user = await User.findById(requesterId).select('password role adminApprovalStatus');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const isAdmin = (user.role === 'admin' && user.adminApprovalStatus === 'approved') || (user.role === 'rootadmin');
    if (!isAdmin) {
      return res.status(403).json({ message: 'Only admins can clear chat.' });
    }

    if (!user.password) {
      return res.status(400).json({ message: 'Password not set for this account.' });
    }

    // Verify password
    const validPassword = await bcryptjs.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Incorrect password.' });
    }

    // Find booking and clear comments
    const bookingToUpdate = await booking.findById(id);
    if (!bookingToUpdate) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    bookingToUpdate.comments = [];
    await bookingToUpdate.save();

    // Emit optional socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('chatCleared', { appointmentId: id });
    }

    return res.status(200).json({ message: 'Chat deleted successfully.' });
  } catch (err) {
    console.error('Error clearing chat:', err);
    return res.status(500).json({ message: 'Failed to delete chat.' });
  }
});

// PATCH: Edit a comment in an appointment (update in place)
router.patch('/:id/comment/:commentId', verifyToken, async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    // Validate ObjectId formats
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid appointment ID format.' });
    }
    if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: 'Invalid comment ID format.' });
    }

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
    // Only update if the message is different (trimming whitespace for comparison)
    if (comment.message.trim() !== message.trim()) {
      comment.message = message;
      comment.edited = true;
      comment.editedAt = new Date();
      await appointment.save();
      // Emit socket event for real-time update
      const io = req.app.get('io');
      if (io) {
        // Emit to both buyer and seller for comment edit updates
        io.to(appointment.buyerId.toString()).emit('commentUpdate', { appointmentId: id, comment });
        io.to(appointment.sellerId.toString()).emit('commentUpdate', { appointmentId: id, comment });
        // Emit to appointment room for admin access
        io.to(`appointment_${id}`).emit('commentUpdate', { appointmentId: id, comment });
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
      if (!reason) {
        return res.status(400).json({ message: 'Reason is required for buyer cancellation.' });
      }
      bookingToCancel.status = 'cancelledByBuyer';

      // Auto-reject contract if purpose is 'rent'
      if (bookingToCancel.purpose === 'rent' && bookingToCancel.contractId) {
        try {
          const { rejectContractForBooking } = await import('../controllers/rental.controller.js');
          const result = await rejectContractForBooking(
            bookingToCancel._id,
            userId,
            req.body.reason || 'Booking was cancelled by buyer'
          );
          if (result.success) {
            console.log(`✅ Contract ${result.contract.contractId} rejected automatically for booking ${bookingToCancel._id}`);
          }
        } catch (contractError) {
          console.error('Error auto-rejecting contract for booking:', contractError);
        }
      }
      bookingToCancel.cancelReason = reason;
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

        // Send email notification to seller
        try {
          const appointment = await booking.findById(id)
            .populate('buyerId', 'username email firstName lastName')
            .populate('sellerId', 'username email firstName lastName')
            .populate('listingId', 'name description address imageUrls regularPrice');

          const appointmentDetails = {
            appointmentId: appointment._id,
            propertyName: appointment.listingId.name,
            propertyDescription: appointment.listingId.description || '',
            propertyAddress: appointment.listingId.address,
            propertyPrice: appointment.listingId.regularPrice,
            propertyImages: appointment.listingId.imageUrls || [],
            date: appointment.date,
            time: appointment.time,
            buyerName: appointment.buyerId.username,
            purpose: appointment.purpose,
            message: appointment.message,
            listingId: appointment.listingId._id,
            cancellationReason: reason
          };

          await sendAppointmentCancelledByBuyerEmail(appointment.sellerId.email, appointmentDetails);
          console.log(`❌ Appointment cancelled by buyer email sent to seller: ${appointment.sellerId.email}`);
        } catch (emailError) {
          console.error('Error sending cancellation email to seller:', emailError);
        }
      }
      try {
        await releaseListingLock({
          listingId: bookingToCancel.listingId,
          bookingId: bookingToCancel._id,
          releaseReason: 'cancelled_by_buyer',
          force: true
        });
      } catch (releaseError) {
        console.error('Failed to release listing after buyer cancellation:', releaseError);
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

      // Auto-reject contract if purpose is 'rent'
      if (bookingToCancel.purpose === 'rent' && bookingToCancel.contractId) {
        try {
          const { rejectContractForBooking } = await import('../controllers/rental.controller.js');
          const result = await rejectContractForBooking(
            bookingToCancel._id,
            userId,
            req.body.reason || 'Booking was cancelled by seller'
          );
          if (result.success) {
            console.log(`✅ Contract ${result.contract.contractId} rejected automatically for booking ${bookingToCancel._id}`);
          }
        } catch (contractError) {
          console.error('Error auto-rejecting contract for booking:', contractError);
        }
      }
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

        // Send email notification to buyer
        try {
          const appointment = await booking.findById(id)
            .populate('buyerId', 'username email firstName lastName')
            .populate('sellerId', 'username email firstName lastName')
            .populate('listingId', 'name description address imageUrls regularPrice');

          const appointmentDetails = {
            appointmentId: appointment._id,
            propertyName: appointment.listingId.name,
            propertyDescription: appointment.listingId.description || '',
            propertyAddress: appointment.listingId.address,
            propertyPrice: appointment.listingId.regularPrice,
            propertyImages: appointment.listingId.imageUrls || [],
            date: appointment.date,
            time: appointment.time,
            sellerName: appointment.sellerId.username,
            purpose: appointment.purpose,
            message: appointment.message,
            listingId: appointment.listingId._id,
            cancellationReason: reason
          };

          await sendAppointmentCancelledBySellerEmail(appointment.buyerId.email, appointmentDetails);
          console.log(`❌ Appointment cancelled by seller email sent to buyer: ${appointment.buyerId.email}`);
        } catch (emailError) {
          console.error('Error sending cancellation email to buyer:', emailError);
        }
      }
      try {
        await releaseListingLock({
          listingId: bookingToCancel.listingId,
          bookingId: bookingToCancel._id,
          releaseReason: 'cancelled_by_seller',
          force: true
        });
      } catch (releaseError) {
        console.error('Failed to release listing after seller cancellation:', releaseError);
      }
      return res.status(200).json(bookingToCancel);
    }

    // Admin/rootadmin cancellation
    if (isAdmin || isRootAdmin) {
      if (!reason) {
        return res.status(400).json({ message: 'Reason is required for admin cancellation.' });
      }
      bookingToCancel.status = 'cancelledByAdmin';

      // Auto-reject contract if purpose is 'rent'
      if (bookingToCancel.purpose === 'rent' && bookingToCancel.contractId) {
        try {
          const { rejectContractForBooking } = await import('../controllers/rental.controller.js');
          const result = await rejectContractForBooking(
            bookingToCancel._id,
            userId,
            req.body.reason || adminComment || 'Booking was cancelled by admin'
          );
          if (result.success) {
            console.log(`✅ Contract ${result.contract.contractId} rejected automatically for booking ${bookingToCancel._id}`);
          }
        } catch (contractError) {
          console.error('Error auto-rejecting contract for booking:', contractError);
        }
      }
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

        // Send email notifications to both buyer and seller
        try {
          const appointment = await booking.findById(id)
            .populate('buyerId', 'username email firstName lastName')
            .populate('sellerId', 'username email firstName lastName')
            .populate('listingId', 'name description address imageUrls regularPrice');

          const admin = await User.findById(req.user.id);
          const adminName = admin ? admin.username : 'Admin';

          const appointmentDetails = {
            appointmentId: appointment._id,
            propertyName: appointment.listingId.name,
            propertyDescription: appointment.listingId.description || '',
            propertyAddress: appointment.listingId.address,
            propertyPrice: appointment.listingId.regularPrice,
            propertyImages: appointment.listingId.imageUrls || [],
            date: appointment.date,
            time: appointment.time,
            buyerName: appointment.buyerId.username,
            sellerName: appointment.sellerId.username,
            purpose: appointment.purpose,
            message: appointment.message,
            listingId: appointment.listingId._id,
            cancellationReason: reason,
            adminName: adminName
          };

          // Send to buyer
          await sendAppointmentCancelledByAdminEmail(appointment.buyerId.email, appointmentDetails, 'buyer');
          console.log(`❌ Appointment cancelled by admin email sent to buyer: ${appointment.buyerId.email}`);

          // Send to seller
          await sendAppointmentCancelledByAdminEmail(appointment.sellerId.email, appointmentDetails, 'seller');
          console.log(`❌ Appointment cancelled by admin email sent to seller: ${appointment.sellerId.email}`);
        } catch (emailError) {
          console.error('Error sending admin cancellation emails:', emailError);
        }
      }
      try {
        await releaseListingLock({
          listingId: bookingToCancel.listingId,
          bookingId: bookingToCancel._id,
          releaseReason: 'cancelled_by_admin',
          force: true
        });
      } catch (releaseError) {
        console.error('Failed to release listing after admin cancellation:', releaseError);
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

    const listing = await Listing.findById(bookingToReinitiate.listingId);
    if (!listing) {
      return res.status(404).json({ message: 'Listing associated with this appointment no longer exists.' });
    }
    if (
      isListingUnavailable(listing) &&
      (!listing.availabilityMeta?.bookingId || listing.availabilityMeta.bookingId.toString() !== bookingToReinitiate._id.toString())
    ) {
      return res.status(400).json({ message: getAvailabilityGuardMessage(listing) });
    }

    // Reset the appointment to pending status
    bookingToReinitiate.status = 'pending';
    bookingToReinitiate.cancelReason = '';
    // Unset the cancelledBy field to remove it from the document
    bookingToReinitiate.cancelledBy = undefined;

    await bookingToReinitiate.save();
    try {
      await lockListingForBooking({
        listingId: bookingToReinitiate.listingId,
        bookingId: bookingToReinitiate._id,
        lockReason: 'booking_pending'
      });
    } catch (lockError) {
      console.error('Failed to relock listing after admin reinitiation:', lockError);
    }

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
        if (updated.buyerId && updated.buyerId._id) {
          const notification = await Notification.create({
            userId: updated.buyerId._id,
            type: 'appointment_reinitiated_by_admin',
            title: 'Appointment Reinitiated by Admin',
            message: `The appointment for "${updated.propertyName}" was reinitiated by admin. Please review the details.`,
            listingId: updated.listingId._id,
            adminId: req.user.id
          });
          io.to(updated.buyerId._id.toString()).emit('notificationCreated', notification);
        }
      } catch (notificationError) {
        console.error('Failed to create notification for buyer:', notificationError);
      }
      // Notify seller
      try {
        if (updated.sellerId && updated.sellerId._id) {
          const notification = await Notification.create({
            userId: updated.sellerId._id,
            type: 'appointment_reinitiated_by_admin',
            title: 'Appointment Reinitiated by Admin',
            message: `The appointment for "${updated.propertyName}" was reinitiated by admin. Please review the details.`,
            listingId: updated.listingId._id,
            adminId: req.user.id
          });
          io.to(updated.sellerId._id.toString()).emit('notificationCreated', notification);
        }
      } catch (notificationError) {
        console.error('Failed to create notification for seller:', notificationError);
      }

      // Send email notifications to both buyer and seller
      try {
        const appointment = await booking.findById(id)
          .populate('buyerId', 'username email firstName lastName')
          .populate('sellerId', 'username email firstName lastName')
          .populate('listingId', 'name description address imageUrls regularPrice');

        const admin = await User.findById(req.user.id);
        const adminName = admin ? admin.username : 'Admin';

        const appointmentDetails = {
          appointmentId: appointment._id,
          propertyName: appointment.listingId.name,
          propertyDescription: appointment.listingId.description || '',
          propertyAddress: appointment.listingId.address,
          propertyPrice: appointment.listingId.regularPrice,
          propertyImages: appointment.listingId.imageUrls || [],
          date: appointment.date,
          time: appointment.time,
          buyerName: appointment.buyerId.username,
          sellerName: appointment.sellerId.username,
          purpose: appointment.purpose,
          message: appointment.message,
          listingId: appointment.listingId._id,
          adminName: adminName
        };

        // Send to buyer
        await sendAppointmentReinitiatedByAdminEmail(appointment.buyerId.email, appointmentDetails, 'buyer');
        console.log(`🔄 Appointment reinitiated by admin email sent to buyer: ${appointment.buyerId.email}`);

        // Send to seller
        await sendAppointmentReinitiatedByAdminEmail(appointment.sellerId.email, appointmentDetails, 'seller');
        console.log(`🔄 Appointment reinitiated by admin email sent to seller: ${appointment.sellerId.email}`);
      } catch (emailError) {
        console.error('Error sending admin reinitiation emails:', emailError);
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

// PATCH: Archive appointment (admin or appointment participants)
router.patch('/:id/archive', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isRootAdmin = req.user.role === 'rootadmin';
    const isAdmin = req.user.role === 'admin' && req.user.adminApprovalStatus === 'approved';

    const bookingToArchive = await booking.findById(id);
    if (!bookingToArchive) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Check if user can archive this appointment
    const isBuyer = bookingToArchive.buyerId.toString() === userId;
    const isSeller = bookingToArchive.sellerId.toString() === userId;

    if (!isAdmin && !isRootAdmin && !isBuyer && !isSeller) {
      return res.status(403).json({ message: 'You can only archive your own appointments or be an admin.' });
    }

    // Archive the appointment
    if (isAdmin || isRootAdmin) {
      bookingToArchive.archivedByAdmin = true;
    } else {
      // User is archiving their own appointment
      if (isBuyer) {
        bookingToArchive.archivedByBuyer = true;
      }
      if (isSeller) {
        bookingToArchive.archivedBySeller = true;
      }
    }
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

// PATCH: Unarchive appointment (admin or appointment participants)
router.patch('/:id/unarchive', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isRootAdmin = req.user.role === 'rootadmin';
    const isAdmin = req.user.role === 'admin' && req.user.adminApprovalStatus === 'approved';

    const bookingToUnarchive = await booking.findById(id);
    if (!bookingToUnarchive) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Check if user can unarchive this appointment
    const isBuyer = bookingToUnarchive.buyerId.toString() === userId;
    const isSeller = bookingToUnarchive.sellerId.toString() === userId;

    if (!isAdmin && !isRootAdmin && !isBuyer && !isSeller) {
      return res.status(403).json({ message: 'You can only unarchive your own appointments or be an admin.' });
    }

    // Unarchive the appointment
    if (isAdmin || isRootAdmin) {
      bookingToUnarchive.archivedByAdmin = false;
    } else {
      // User is unarchiving their own appointment
      if (isBuyer) {
        bookingToUnarchive.archivedByBuyer = false;
      }
      if (isSeller) {
        bookingToUnarchive.archivedBySeller = false;
      }
    }
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

// GET: Get archived appointments (admin or user's own archived appointments)
router.get('/archived', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const isRootAdmin = req.user.role === 'rootadmin';
    const isAdmin = req.user.role === 'admin' && req.user.adminApprovalStatus === 'approved';

    let query;
    if (isAdmin || isRootAdmin) {
      // Admins can see all archived appointments
      query = { archivedByAdmin: true };
    } else {
      // Regular users can only see their own archived appointments
      query = {
        $or: [
          { buyerId: userId, archivedByBuyer: true },
          { sellerId: userId, archivedBySeller: true }
        ]
      };
    }

    const archivedAppointments = await booking.find(query)
      .populate('buyerId', 'username email mobileNumber avatar')
      .populate('sellerId', 'username email mobileNumber avatar')
      .populate('listingId', '_id name address')
      .sort({ archivedAt: -1, updatedAt: -1 }); // Sort by most recently archived first, fallback to updatedAt

    // Add role information for regular users
    const appointmentsWithRole = archivedAppointments.map(appointment => {
      const appointmentObj = appointment.toObject();
      if (!isAdmin && !isRootAdmin) {
        // Add null checks to prevent errors when buyerId or sellerId is null
        if (appointment.buyerId && appointment.buyerId._id) {
          appointmentObj.role = appointment.buyerId._id.toString() === userId ? 'buyer' : 'seller';
        } else if (appointment.sellerId && appointment.sellerId._id) {
          appointmentObj.role = appointment.sellerId._id.toString() === userId ? 'seller' : 'buyer';
        } else {
          // Fallback if both are null - this shouldn't happen but prevents crashes
          appointmentObj.role = 'unknown';
        }
      }
      return appointmentObj;
    });

    res.status(200).json(appointmentsWithRole);
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

    const listing = await Listing.findById(original.listingId);
    if (!listing) {
      return res.status(404).json({ message: 'Listing associated with this appointment no longer exists.' });
    }
    if (
      isListingUnavailable(listing) &&
      (!listing.availabilityMeta?.bookingId || listing.availabilityMeta.bookingId.toString() !== original._id.toString())
    ) {
      return res.status(400).json({ message: getAvailabilityGuardMessage(listing) });
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
    try {
      await lockListingForBooking({
        listingId: original.listingId,
        bookingId: original._id,
        lockReason: 'booking_pending'
      });
    } catch (lockError) {
      console.error('Failed to relock listing after user reinitiation:', lockError);
    }
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

      // Send email notification to the opposite party
      try {
        const appointment = await booking.findById(original._id)
          .populate('buyerId', 'username email firstName lastName')
          .populate('sellerId', 'username email firstName lastName')
          .populate('listingId', 'name description address imageUrls regularPrice');

        const appointmentDetails = {
          appointmentId: appointment._id,
          propertyName: appointment.listingId.name,
          propertyDescription: appointment.listingId.description || '',
          propertyAddress: appointment.listingId.address,
          propertyPrice: appointment.listingId.regularPrice,
          propertyImages: appointment.listingId.imageUrls || [],
          date: appointment.date,
          time: appointment.time,
          buyerName: appointment.buyerId.username,
          sellerName: appointment.sellerId.username,
          purpose: appointment.purpose,
          message: appointment.message,
          listingId: appointment.listingId._id,
          reinitiationCount: count + 1
        };

        if (userId === original.buyerId.toString()) {
          // Buyer reinitiated, send email to seller
          await sendAppointmentReinitiatedByBuyerEmail(appointment.sellerId.email, appointmentDetails);
          console.log(`🔄 Appointment reinitiated by buyer email sent to seller: ${appointment.sellerId.email}`);
        } else if (userId === original.sellerId.toString()) {
          // Seller reinitiated, send email to buyer
          await sendAppointmentReinitiatedBySellerEmail(appointment.buyerId.email, appointmentDetails);
          console.log(`🔄 Appointment reinitiated by seller email sent to buyer: ${appointment.buyerId.email}`);
        }
      } catch (emailError) {
        console.error('Error sending user reinitiation email:', emailError);
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
    // Validate ObjectId format
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid appointment ID format.' });
    }

    // Validate user ID
    if (!userId) {
      return res.status(400).json({ message: 'User ID not found in token.' });
    }

    let bookingDoc = await booking.findById(id).lean();
    if (!bookingDoc) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Check if user is authorized to read this appointment's comments
    const userIdStr = userId.toString();
    const buyerIdStr = bookingDoc.buyerId?.toString();
    const sellerIdStr = bookingDoc.sellerId?.toString();

    if (userIdStr !== buyerIdStr && userIdStr !== sellerIdStr && req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return res.status(403).json({ message: 'Not authorized to read comments for this appointment.' });
    }

    const isParticipant = userIdStr === buyerIdStr || userIdStr === sellerIdStr;
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const now = new Date();

    // Use atomic operations to mark comments as read - no VersionError possible
    // Step 1: For participant (buyer/seller), update status to 'read' and add to readBy
    if (isParticipant) {
      await booking.updateOne(
        { _id: id },
        {
          $set: {
            'comments.$[elem].status': 'read',
            'comments.$[elem].readAt': now
          },
          $addToSet: { 'comments.$[elem].readBy': userObjectId }
        },
        {
          arrayFilters: [
            {
              'elem.senderEmail': { $ne: req.user.email },
              'elem.deleted': { $ne: true },
              'elem.readBy': { $not: { $elemMatch: { $eq: userObjectId } } }
            }
          ]
        }
      );
    } else {
      // Admin: only add to readBy, don't change status
      await booking.updateOne(
        { _id: id },
        {
          $addToSet: { 'comments.$[elem].readBy': userObjectId }
        },
        {
          arrayFilters: [
            {
              'elem.senderEmail': { $ne: req.user.email },
              'elem.deleted': { $ne: true },
              'elem.readBy': { $not: { $elemMatch: { $eq: userObjectId } } }
            }
          ]
        }
      );
    }

    // Step 2: Reset unread counters atomically
    if (userIdStr === buyerIdStr) {
      await booking.updateOne(
        { _id: id },
        { $set: { buyerUnreadMessageCount: 0, buyerLastEmailSentAt: null } }
      );
    } else if (userIdStr === sellerIdStr) {
      await booking.updateOne(
        { _id: id },
        { $set: { sellerUnreadMessageCount: 0, sellerLastEmailSentAt: null } }
      );
    }

    const updated = true;

    // Emit read event for real-time updates (only if socket.io is available)
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('commentRead', { appointmentId: id, userId: userIdStr });
      }
    } catch (socketError) {
      console.error('Socket.io error:', socketError);
      // Don't fail the request if socket fails
    }

    res.status(200).json({ success: true, updated });
  } catch (err) {
    console.error('Error marking comments as read:', {
      appointmentId: id,
      userId: userId,
      error: err.message,
      stack: err.stack
    });

    // Provide more specific error messages
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid appointment ID format.' });
    }

    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error.', error: err.message });
    }

    res.status(500).json({ message: 'Failed to mark comments as read.', error: err.message });
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
      // Check if it exists in deleted listings
      const isDeleted = await DeletedListing.findOne({ originalListingId: listingId });
      if (isDeleted) {
        return res.status(404).json({ message: "This property is no longer active or has been removed." });
      }
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
    try {
      await lockListingForBooking({
        listingId,
        bookingId: newBooking._id,
        lockReason: purpose === 'rent' ? 'awaiting_payment' : 'booking_pending'
      });
    } catch (lockError) {
      console.error('Failed to lock listing after admin booking creation:', lockError);
    }
    // Emit socket.io event for real-time new appointment
    const io = req.app.get('io');
    if (io) {
      io.emit('appointmentCreated', { appointment: newBooking });
      // Also emit to admin rooms for real-time updates
      io.to('admin_*').emit('appointmentCreated', { appointment: newBooking });
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

    // Send appointment booking confirmation emails for admin booking
    try {
      // Prepare appointment details for email
      const appointmentDetails = {
        appointmentId: newBooking._id,
        propertyName: listing.name,
        propertyDescription: listing.description,
        propertyAddress: listing.address,
        propertyPrice: listing.regularPrice || listing.discountPrice,
        propertyImages: listing.imageUrls || [],
        date: newBooking.date,
        time: newBooking.time,
        buyerName: buyer.firstName && buyer.lastName
          ? `${buyer.firstName} ${buyer.lastName}`
          : buyer.username,
        buyerEmail: buyer.email,
        sellerName: seller.firstName && seller.lastName
          ? `${seller.firstName} ${seller.lastName}`
          : seller.username,
        sellerEmail: seller.email,
        purpose: newBooking.purpose,
        message: newBooking.message,
        listingId: listing._id,
        paymentStatus: 'pending', // New appointments start as pending payment
        bookedByAdmin: true // Flag to indicate this was booked by admin
      };

      // Send email to buyer
      try {
        await sendAppointmentBookingEmail(buyer.email, appointmentDetails, 'buyer');
        console.log(`✅ Admin booking email sent to buyer: ${buyer.email}`);
      } catch (buyerEmailError) {
        console.error(`❌ Failed to send admin booking email to buyer: ${buyer.email}`, buyerEmailError);
      }

      // Send email to seller
      try {
        await sendAppointmentBookingEmail(seller.email, appointmentDetails, 'seller');
        console.log(`✅ Admin booking email sent to seller: ${seller.email}`);
      } catch (sellerEmailError) {
        console.error(`❌ Failed to send admin booking email to seller: ${seller.email}`, sellerEmailError);
      }

    } catch (emailError) {
      console.error('❌ Error sending admin appointment booking emails:', emailError);
      // Don't fail the booking if email fails
    }

    res.status(201).json({ message: "Appointment booked successfully!", appointment: newBooking });
  } catch (err) {
    console.error("Error creating admin booking:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST: Test appointment booking email (for testing purposes)
router.post("/test-booking-email", verifyToken, async (req, res) => {
  try {
    const { email, userRole = 'buyer' } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required for testing" });
    }

    // Sample appointment details for testing
    const testAppointmentDetails = {
      appointmentId: 'test_123',
      propertyName: 'Beautiful 3BHK Apartment in Downtown',
      propertyDescription: 'Spacious 3 bedroom apartment with modern amenities',
      propertyAddress: '123 Main Street, Downtown City',
      propertyPrice: 5000000,
      propertyImages: ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=500'],
      date: '2024-01-15',
      time: '14:00',
      buyerName: 'John Doe',
      buyerEmail: 'buyer@example.com',
      sellerName: 'Jane Smith',
      sellerEmail: 'seller@example.com',
      purpose: 'Property Viewing',
      message: 'I am interested in viewing this property. Please let me know if the time works for you.',
      listingId: 'listing_123',
      paymentStatus: 'pending'
    };

    // Send test email
    const result = await sendAppointmentBookingEmail(email, testAppointmentDetails, userRole);

    if (result.success) {
      res.status(200).json({
        message: "Test booking email sent successfully!",
        email: email,
        userRole: userRole
      });
    } else {
      res.status(500).json({
        message: "Failed to send test booking email",
        error: result.error
      });
    }
  } catch (error) {
    console.error("Error sending test booking email:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET: Fetch a single booking by ID (with comments) — PROTECTED
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const bookingDoc = await booking.findById(id)
      .populate('buyerId', 'username email mobileNumber avatar')
      .populate('sellerId', 'username email mobileNumber avatar')
      .populate('listingId', '_id name address');
    if (!bookingDoc) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Ownership check: only buyer, seller, or admin can access
    const isBuyer = bookingDoc.buyerId?._id?.toString() === userId || bookingDoc.buyerId?.toString() === userId;
    const isSeller = bookingDoc.sellerId?._id?.toString() === userId || bookingDoc.sellerId?.toString() === userId;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'rootadmin';

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ message: 'You do not have access to this appointment.' });
    }

    // Return both formats for backward compatibility
    // Some code expects { success: true, booking: ... }, others expect the booking directly
    const response = { ...bookingDoc.toObject(), success: true, booking: bookingDoc };
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch appointment.' });
  }
});

// Count bookings
router.get('/count', async (req, res) => {
  try {
    const total = await booking.countDocuments();
    res.json({ count: total });
  } catch (e) {
    res.status(500).json({ message: 'Failed to count bookings' });
  }
});

// PATCH: Persist per-user local chat clear for an appointment
router.patch('/:id/chat/clear-local', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid appointment ID.' });
    }

    const appointment = await booking.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    const isBuyer = appointment.buyerId.toString() === userId;
    const isSeller = appointment.sellerId.toString() === userId;
    if (!isBuyer && !isSeller) {
      return res.status(403).json({ message: 'Not authorized to modify this appointment.' });
    }

    const now = new Date();
    if (isBuyer) {
      appointment.buyerChatClearedAt = now;
    } else if (isSeller) {
      appointment.sellerChatClearedAt = now;
    }

    await appointment.save();

    // Notify this user's other sessions immediately
    const io = req.app.get('io');
    if (io) {
      io.to(userId.toString()).emit('chatClearedForUser', { appointmentId: id, clearedAt: now.toISOString() });
    }

    return res.status(200).json({
      message: 'Chat clear persisted.',
      buyerChatClearedAt: appointment.buyerChatClearedAt,
      sellerChatClearedAt: appointment.sellerChatClearedAt,
    });
  } catch (err) {
    console.error('Error persisting chat clear:', err);
    return res.status(500).json({ message: 'Failed to persist chat clear.' });
  }
});

// PATCH: Mark a specific comment as removed for the current user ("delete for me")
router.patch('/:id/comment/:commentId/remove-for-me', verifyToken, async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: 'Invalid appointment or comment ID.' });
    }

    const appointment = await booking.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    const isParticipant = appointment.buyerId.toString() === userId || appointment.sellerId.toString() === userId;
    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized to modify this appointment.' });
    }

    const comment = appointment.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found.' });
    }

    comment.removedFor = comment.removedFor || [];
    const userIdStr = userId.toString();
    if (!comment.removedFor.map(id => id.toString()).includes(userIdStr)) {
      comment.removedFor.push(userId);
    }

    // Mark modified to ensure Mongoose saves nested changes
    appointment.markModified('comments');
    await appointment.save();

    // Notify this user's other sessions immediately
    const io = req.app.get('io');
    if (io) {
      io.to(userId.toString()).emit('commentRemovedForUser', { appointmentId: id, commentId });
    }

    return res.status(200).json({ message: 'Comment removed for current user.' });
  } catch (err) {
    console.error('Error removing comment for user:', err);
    return res.status(500).json({ message: 'Failed to remove comment for user.' });
  }
});

// POST: Bulk sync locally removed IDs (optional utility)
router.post('/:id/comments/removed/sync', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { removedIds } = req.body; // array of comment IDs
    const userId = req.user.id;

    if (!Array.isArray(removedIds)) {
      return res.status(400).json({ message: 'removedIds must be an array.' });
    }

    const appointment = await booking.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    const isParticipant = appointment.buyerId.toString() === userId || appointment.sellerId.toString() === userId;
    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized to modify this appointment.' });
    }

    const userIdStr = userId.toString();
    for (const cid of removedIds) {
      if (!mongoose.Types.ObjectId.isValid(cid)) continue;
      const c = appointment.comments.id(cid);
      if (!c) continue;
      c.removedFor = c.removedFor || [];
      if (!c.removedFor.map(id => id.toString()).includes(userIdStr)) {
        c.removedFor.push(userId);
      }
    }

    appointment.markModified('comments');
    await appointment.save();

    return res.status(200).json({ message: 'Removed comments synced.' });
  } catch (err) {
    console.error('Error syncing removed comments:', err);
    return res.status(500).json({ message: 'Failed to sync removed comments.' });
  }
});

// PATCH: Star/unstar a comment
router.patch('/:id/comment/:commentId/star', verifyToken, async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const { starred } = req.body; // true to star, false to unstar
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: 'Invalid ID format.' });
    }

    const appointment = await booking.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Check if user is authorized (buyer, seller, or admin)
    const isBuyer = appointment.buyerId.toString() === userId;
    const isSeller = appointment.sellerId.toString() === userId;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'rootadmin';

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to star messages in this appointment.' });
    }

    const comment = appointment.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found.' });
    }

    // Initialize starredBy array if it doesn't exist
    if (!comment.starredBy) {
      comment.starredBy = [];
    }

    const userIdStr = userId.toString();
    const isCurrentlyStarred = comment.starredBy.map(id => id.toString()).includes(userIdStr);

    if (starred && !isCurrentlyStarred) {
      // Star the message
      comment.starredBy.push(userId);
    } else if (!starred && isCurrentlyStarred) {
      // Unstar the message
      comment.starredBy = comment.starredBy.filter(id => id.toString() !== userIdStr);
    }

    appointment.markModified('comments');
    await appointment.save();

    return res.status(200).json({
      message: starred ? 'Message starred successfully' : 'Message unstarred successfully',
      starred: starred && comment.starredBy.map(id => id.toString()).includes(userIdStr)
    });
  } catch (err) {
    console.error('Error starring/unstarring comment:', err);
    return res.status(500).json({ message: 'Failed to update star status.' });
  }
});

// PATCH: Pin/unpin a comment
router.patch('/:id/comment/:commentId/pin', verifyToken, async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const { pinned, pinDuration, customHours } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: 'Invalid ID format.' });
    }

    const appointment = await booking.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Check if user is authorized (buyer, seller, or admin)
    const isBuyer = appointment.buyerId.toString() === userId;
    const isSeller = appointment.sellerId.toString() === userId;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'rootadmin';

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to pin messages in this appointment.' });
    }

    const comment = appointment.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found.' });
    }

    if (pinned) {
      // Pin the message
      comment.pinned = true;
      comment.pinnedBy = userId;
      comment.pinnedAt = new Date();
      comment.pinDuration = pinDuration;

      // Calculate expiration time based on duration
      let expirationTime;
      switch (pinDuration) {
        case '24hrs':
          expirationTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
          break;
        case '7days':
          expirationTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          expirationTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          break;
        case 'custom':
          if (customHours && customHours > 0) {
            expirationTime = new Date(Date.now() + customHours * 60 * 60 * 1000);
          } else {
            return res.status(400).json({ message: 'Custom hours must be provided for custom duration.' });
          }
          break;
        default:
          return res.status(400).json({ message: 'Invalid pin duration.' });
      }
      comment.pinExpiresAt = expirationTime;
    } else {
      // Unpin the message
      comment.pinned = false;
      comment.pinnedBy = null;
      comment.pinnedAt = null;
      comment.pinExpiresAt = null;
      comment.pinDuration = null;
    }

    appointment.markModified('comments');
    await appointment.save();

    // Emit real-time update so both parties (and admins) see pin/unpin immediately
    try {
      const io = req.app.get('io');
      if (io) {
        const updatedComment = comment.toObject ? comment.toObject() : comment;
        io.to(appointment.buyerId.toString()).emit('commentUpdate', { appointmentId: id, comment: updatedComment });
        io.to(appointment.sellerId.toString()).emit('commentUpdate', { appointmentId: id, comment: updatedComment });
        // Emit to appointment room for admin visibility
        io.to(`appointment_${id}`).emit('commentUpdate', { appointmentId: id, comment: updatedComment });
      }
    } catch (emitErr) {
      console.warn('Warning: failed to emit pin/unpin commentUpdate event:', emitErr);
    }

    return res.status(200).json({
      message: pinned ? 'Message pinned successfully' : 'Message unpinned successfully',
      pinned: comment.pinned,
      pinExpiresAt: comment.pinExpiresAt
    });
  } catch (err) {
    console.error('Error pinning/unpinning comment:', err);
    return res.status(500).json({ message: 'Failed to update pin status.' });
  }
});

// PATCH: Add/remove reaction to a comment
router.patch('/:id/comment/:commentId/react', verifyToken, async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: 'Invalid ID format.' });
    }

    if (!emoji) {
      return res.status(400).json({ message: 'Emoji is required.' });
    }

    let appointment = await booking.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Check if user is authorized (buyer, seller, or admin)
    const isBuyer = appointment.buyerId.toString() === userId;
    const isSeller = appointment.sellerId.toString() === userId;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'rootadmin';

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to react to messages in this appointment.' });
    }

    const comment = appointment.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found.' });
    }

    // Get user details for the reaction
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Check if user already has this exact reaction
    const existingReactionIndex = comment.reactions.findIndex(
      reaction => reaction.userId.toString() === userId && reaction.emoji === emoji
    );

    if (existingReactionIndex !== -1) {
      // Remove the existing reaction (toggle off)
      comment.reactions.splice(existingReactionIndex, 1);
    } else {
      // Remove any other reactions from this user first
      comment.reactions = comment.reactions.filter(
        reaction => reaction.userId.toString() !== userId
      );

      // Add new reaction
      comment.reactions.push({
        emoji,
        userId,
        userName: user.username,
        timestamp: new Date()
      });
    }

    appointment.markModified('comments');

    // Use retry logic to handle version conflicts
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        await appointment.save();
        break; // Success, exit retry loop
      } catch (saveError) {
        if (saveError.name === 'VersionError' && retryCount < maxRetries - 1) {
          retryCount++;
          // Only log on final retry to reduce log spam
          if (retryCount === maxRetries - 1) {
            console.log(`Version conflict in reaction, final retry... (${retryCount}/${maxRetries})`);
          }

          // Add minimal delay to reduce contention (optimized for speed)
          const delay = Math.min(20 * Math.pow(2, retryCount - 1), 100); // 20ms, 40ms, 80ms max
          await new Promise(resolve => setTimeout(resolve, delay));

          // Refetch the document to get latest version
          const freshDoc = await booking.findById(id);
          if (!freshDoc) {
            return res.status(404).json({ message: 'Appointment not found during retry.' });
          }

          const freshComment = freshDoc.comments.id(commentId);
          if (!freshComment) {
            return res.status(404).json({ message: 'Comment not found during retry.' });
          }

          // Reapply the reaction logic to fresh document
          const existingReactionIndex = freshComment.reactions.findIndex(
            reaction => reaction.userId.toString() === userId && reaction.emoji === emoji
          );

          if (existingReactionIndex !== -1) {
            freshComment.reactions.splice(existingReactionIndex, 1);
          } else {
            freshComment.reactions = freshComment.reactions.filter(
              reaction => reaction.userId.toString() !== userId
            );
            freshComment.reactions.push({
              emoji,
              userId,
              userName: user.username,
              timestamp: new Date()
            });
          }

          freshDoc.markModified('comments');
          appointment = freshDoc;
          comment = freshComment;
        } else {
          console.error('Error saving reaction:', saveError);
          return res.status(500).json({ message: 'Failed to save reaction.', error: saveError.message });
        }
      }
    }

    // Emit real-time update
    try {
      const io = req.app.get('io');
      if (io) {
        const updatedComment = comment.toObject ? comment.toObject() : comment;
        io.to(appointment.buyerId.toString()).emit('commentUpdate', { appointmentId: id, comment: updatedComment });
        io.to(appointment.sellerId.toString()).emit('commentUpdate', { appointmentId: id, comment: updatedComment });
        // Emit to appointment room for admin visibility
        io.to(`appointment_${id}`).emit('commentUpdate', { appointmentId: id, comment: updatedComment });
      }
    } catch (emitErr) {
      console.warn('Warning: failed to emit reaction commentUpdate event:', emitErr);
    }

    return res.status(200).json({
      message: existingReactionIndex !== -1 ? 'Reaction removed successfully' : 'Reaction added successfully',
      reactions: comment.reactions
    });
  } catch (err) {
    console.error('Error adding/removing reaction:', err);
    return res.status(500).json({ message: 'Failed to update reaction.' });
  }
});

// GET: Get all pinned messages for an appointment
router.get('/:id/pinned-messages', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid appointment ID format.' });
    }

    const appointment = await booking.findById(id)
      .populate('buyerId', 'username email')
      .populate('sellerId', 'username email')
      .populate('listingId', 'name address');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Check if user is authorized (buyer, seller, or admin)
    const isBuyer = appointment.buyerId && appointment.buyerId._id && appointment.buyerId._id.toString() === userId;
    const isSeller = appointment.sellerId && appointment.sellerId._id && appointment.sellerId._id.toString() === userId;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'rootadmin';

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to view pinned messages in this appointment.' });
    }

    // Filter pinned messages and check if they're expired
    const now = new Date();
    const pinnedMessages = appointment.comments.filter(comment =>
      comment.pinned && comment.pinExpiresAt && comment.pinExpiresAt > now
    );

    return res.status(200).json({
      pinnedMessages,
      totalPinned: pinnedMessages.length
    });
  } catch (err) {
    console.error('Error fetching pinned messages:', err);
    return res.status(500).json({ message: 'Failed to fetch pinned messages.' });
  }
});

// GET: Get all starred messages for user in an appointment
router.get('/:id/starred-messages', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid appointment ID format.' });
    }

    const appointment = await booking.findById(id)
      .populate('buyerId', 'username email')
      .populate('sellerId', 'username email')
      .populate('listingId', 'name address');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Check if user is authorized (buyer, seller, or admin)
    const isBuyer = appointment.buyerId && appointment.buyerId._id && appointment.buyerId._id.toString() === userId;
    const isSeller = appointment.sellerId && appointment.sellerId._id && appointment.sellerId._id.toString() === userId;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'rootadmin';

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to view starred messages in this appointment.' });
    }

    // Filter starred messages for this user
    const starredMessages = appointment.comments.filter(comment =>
      comment.starredBy && comment.starredBy.map(id => id.toString()).includes(userId.toString())
    );

    return res.status(200).json({
      starredMessages,
      appointmentInfo: {
        _id: appointment._id,
        propertyName: appointment.propertyName,
        date: appointment.date,
        buyer: appointment.buyerId,
        seller: appointment.sellerId,
        listing: appointment.listingId
      }
    });
  } catch (err) {
    console.error('Error fetching starred messages:', err);
    return res.status(500).json({ message: 'Failed to fetch starred messages.' });
  }
});

// PATCH: Lock chat with password
router.patch('/:id/chat/lock', verifyToken, async (req, res) => {
  try {
    const { password } = req.body;
    const appointmentId = req.params.id;
    const userId = req.user.id;

    if (!password || password.trim().length === 0) {
      return res.status(400).json({ message: 'Password is required to lock chat.' });
    }

    const appointment = await booking.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Check if user is buyer or seller
    const isBuyer = appointment.buyerId.toString() === userId;
    const isSeller = appointment.sellerId.toString() === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ message: 'Not authorized to lock this chat.' });
    }

    // Hash the password for security
    const hashedPassword = bcryptjs.hashSync(password, 10);

    // Update the appropriate lock fields
    if (isBuyer) {
      appointment.buyerChatLocked = true;
      appointment.buyerChatPassword = hashedPassword;
    } else {
      appointment.sellerChatLocked = true;
      appointment.sellerChatPassword = hashedPassword;
    }

    await appointment.save();

    return res.status(200).json({
      message: 'Chat locked successfully.',
      chatLocked: true
    });
  } catch (err) {
    console.error('Error locking chat:', err);
    return res.status(500).json({ message: 'Failed to lock chat.' });
  }
});

// PATCH: Unlock chat with password (grants temporary access, doesn't remove lock)
router.patch('/:id/chat/unlock', verifyToken, async (req, res) => {
  try {
    const { password } = req.body;
    const appointmentId = req.params.id;
    const userId = req.user.id;

    if (!password || password.trim().length === 0) {
      return res.status(400).json({ message: 'Password is required to access chat.' });
    }

    const appointment = await booking.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Check if user is buyer or seller
    const isBuyer = appointment.buyerId.toString() === userId;
    const isSeller = appointment.sellerId.toString() === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ message: 'Not authorized to access this chat.' });
    }

    // Get the stored password hash
    const storedPasswordHash = isBuyer ? appointment.buyerChatPassword : appointment.sellerChatPassword;

    if (!storedPasswordHash) {
      return res.status(400).json({ message: 'No password set for this chat.' });
    }

    // Verify the password
    const isPasswordValid = bcryptjs.compareSync(password, storedPasswordHash);

    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Incorrect password.' });
    }

    // Grant temporary access (chat remains locked, but user can access it)
    if (isBuyer) {
      appointment.buyerChatAccessGranted = true;
    } else {
      appointment.sellerChatAccessGranted = true;
    }

    await appointment.save();

    return res.status(200).json({
      message: 'Chat access granted.',
      chatLocked: true, // Chat is still locked
      accessGranted: true
    });
  } catch (err) {
    console.error('Error granting chat access:', err);
    return res.status(500).json({ message: 'Failed to grant chat access.' });
  }
});

// PATCH: Remove chat lock (permanently removes the lock)
router.patch('/:id/chat/remove-lock', verifyToken, async (req, res) => {
  try {
    const { password } = req.body;
    const appointmentId = req.params.id;
    const userId = req.user.id;

    if (!password || password.trim().length === 0) {
      return res.status(400).json({ message: 'Password is required to remove chat lock.' });
    }

    const appointment = await booking.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Check if user is buyer or seller
    const isBuyer = appointment.buyerId.toString() === userId;
    const isSeller = appointment.sellerId.toString() === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ message: 'Not authorized to remove lock from this chat.' });
    }

    // Get the stored password hash
    const storedPasswordHash = isBuyer ? appointment.buyerChatPassword : appointment.sellerChatPassword;

    if (!storedPasswordHash) {
      return res.status(400).json({ message: 'No password set for this chat.' });
    }

    // Verify the password
    const isPasswordValid = bcryptjs.compareSync(password, storedPasswordHash);

    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Incorrect password.' });
    }

    // Remove the chat lock completely
    if (isBuyer) {
      appointment.buyerChatLocked = false;
      appointment.buyerChatPassword = null;
      appointment.buyerChatAccessGranted = false;
    } else {
      appointment.sellerChatLocked = false;
      appointment.sellerChatPassword = null;
      appointment.sellerChatAccessGranted = false;
    }

    await appointment.save();

    return res.status(200).json({
      message: 'Chat lock removed successfully.',
      chatLocked: false,
      accessGranted: false
    });
  } catch (err) {
    console.error('Error removing chat lock:', err);
    return res.status(500).json({ message: 'Failed to remove chat lock.' });
  }
});

// GET: Get chat lock status
router.get('/:id/chat/lock-status', verifyToken, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const userId = req.user.id;

    const appointment = await booking.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Check if user is buyer or seller
    const isBuyer = appointment.buyerId.toString() === userId;
    const isSeller = appointment.sellerId.toString() === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ message: 'Not authorized to view this chat.' });
    }

    // Return the lock status and access status for the current user
    const chatLocked = isBuyer ? appointment.buyerChatLocked : appointment.sellerChatLocked;
    const hasPassword = isBuyer ? !!appointment.buyerChatPassword : !!appointment.sellerChatPassword;
    const accessGranted = isBuyer ? appointment.buyerChatAccessGranted : appointment.sellerChatAccessGranted;

    return res.status(200).json({
      chatLocked,
      hasPassword,
      accessGranted
    });
  } catch (err) {
    console.error('Error getting chat lock status:', err);
    return res.status(500).json({ message: 'Failed to get chat lock status.' });
  }
});

// PATCH: Reset chat access (called when chat modal is closed)
router.patch('/:id/chat/reset-access', verifyToken, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const userId = req.user.id;

    const appointment = await booking.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Check if user is buyer or seller
    const isBuyer = appointment.buyerId.toString() === userId;
    const isSeller = appointment.sellerId.toString() === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ message: 'Not authorized to reset access for this chat.' });
    }

    // Reset access granted state
    if (isBuyer) {
      appointment.buyerChatAccessGranted = false;
    } else {
      appointment.sellerChatAccessGranted = false;
    }

    await appointment.save();

    return res.status(200).json({
      message: 'Chat access reset.',
      accessGranted: false
    });
  } catch (err) {
    console.error('Error resetting chat access:', err);
    return res.status(500).json({ message: 'Failed to reset chat access.' });
  }
});

// PATCH: Forgot password - clear chat and remove lock
router.patch('/:id/chat/forgot-password', verifyToken, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const userId = req.user.id;

    const appointment = await booking.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Check if user is buyer or seller
    const isBuyer = appointment.buyerId.toString() === userId;
    const isSeller = appointment.sellerId.toString() === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ message: 'Not authorized to unlock this chat.' });
    }

    // Clear chat and remove lock for the current user
    if (isBuyer) {
      appointment.buyerChatLocked = false;
      appointment.buyerChatPassword = null;
      appointment.buyerChatAccessGranted = false;
      appointment.buyerChatClearedAt = new Date();
    } else {
      appointment.sellerChatLocked = false;
      appointment.sellerChatPassword = null;
      appointment.sellerChatAccessGranted = false;
      appointment.sellerChatClearedAt = new Date();
    }

    // Clear all chat messages using Mongoose methods
    appointment.comments.splice(0, appointment.comments.length);

    // Mark the comments field as modified to ensure Mongoose saves it
    appointment.markModified('comments');

    console.log(`Clearing chat for appointment ${appointmentId}. Comments before clear: ${appointment.comments.length}`);

    await appointment.save();

    console.log(`Chat cleared successfully. Comments after clear: ${appointment.comments.length}`);

    return res.status(200).json({
      message: 'Chat unlocked and cleared successfully.',
      chatLocked: false,
      accessGranted: false
    });
  } catch (err) {
    console.error('Error unlocking chat via forgot password:', err);
    return res.status(500).json({ message: 'Failed to unlock chat.' });
  }
});

// POST: Test seller accept/reject emails (for testing purposes)
router.post("/test-seller-status-emails", verifyToken, async (req, res) => {
  try {
    const { email, status } = req.body;

    if (!email || !status) {
      return res.status(400).json({ message: 'Email and status are required for testing.' });
    }

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be either "accepted" or "rejected".' });
    }

    const testAppointmentDetails = {
      appointmentId: 'test123',
      propertyName: 'Test Property',
      propertyDescription: 'This is a test property description',
      propertyAddress: '123 Test Street, Test City',
      propertyPrice: 500000,
      propertyImages: ['https://via.placeholder.com/400x300'],
      date: '2024-01-15',
      time: '14:00',
      sellerName: 'Test Seller',
      purpose: 'Property viewing',
      message: 'This is a test appointment',
      listingId: 'test-listing-123',
      rejectionReason: status === 'rejected' ? 'Test rejection reason' : null
    };

    let result;
    if (status === 'accepted') {
      result = await sendAppointmentAcceptedEmail(email, testAppointmentDetails);
    } else if (status === 'rejected') {
      result = await sendAppointmentRejectedEmail(email, testAppointmentDetails);
    }

    res.status(200).json({
      message: `Test ${status} email sent successfully to ${email}`,
      result: result
    });
  } catch (error) {
    console.error(`Error sending test ${req.body.status} email:`, error);
    res.status(500).json({ message: `Failed to send test ${req.body.status} email`, error: error.message });
  }
});

export default router;

// --- SOCKET.IO: User Appointments Page Active (for delivered ticks) ---
export function registerUserAppointmentsSocket(io) {
  // Debounce map: userId -> timeout to prevent rapid re-triggering
  const activeDebounce = new Map();
  // Per-appointment lock to serialize messageReceived operations
  const appointmentLocks = new Map();

  io.on('connection', (socket) => {
    socket.on('userAppointmentsActive', async ({ userId }) => {
      // Debounce: ignore if same user triggers within 2 seconds
      if (activeDebounce.has(userId)) {
        clearTimeout(activeDebounce.get(userId));
      }
      activeDebounce.set(userId, setTimeout(async () => {
        activeDebounce.delete(userId);
        try {
          // Use atomic updateMany with arrayFilters to mark comments as delivered
          // This avoids the find-modify-save pattern that causes VersionError
          const result = await booking.updateMany(
            {
              $or: [{ buyerId: userId }, { sellerId: userId }],
              'comments.status': 'sent'
            },
            {
              $set: { 'comments.$[elem].status': 'delivered' }
            },
            {
              arrayFilters: [
                {
                  'elem.sender': { $ne: new mongoose.Types.ObjectId(userId) },
                  'elem.status': 'sent'
                }
              ]
            }
          );

          // If any documents were modified, emit delivery events
          if (result.modifiedCount > 0) {
            // Fetch the affected bookings to emit individual delivery events
            const affectedBookings = await booking.find(
              {
                $or: [{ buyerId: userId }, { sellerId: userId }],
                'comments.status': 'delivered'
              },
              { _id: 1, comments: { $elemMatch: { status: 'delivered' } } }
            ).lean();

            for (const appt of affectedBookings) {
              if (appt.comments) {
                for (const comment of appt.comments) {
                  if (comment.status === 'delivered' && comment.sender.toString() !== userId) {
                    io.emit('commentDelivered', {
                      appointmentId: appt._id.toString(),
                      commentId: comment._id.toString()
                    });
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error('Error marking comments as delivered:', err);
        }
      }, 500)); // 500ms debounce
    });

    // Handle message received by online user
    socket.on('messageReceived', async ({ appointmentId, commentId, userId }) => {
      // Per-appointment lock to serialize concurrent operations
      const lockKey = `${appointmentId}_delivered`;
      while (appointmentLocks.get(lockKey)) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      appointmentLocks.set(lockKey, true);

      try {
        // Use atomic updateOne with arrayFilters - no version conflict possible
        const result = await booking.updateOne(
          { _id: appointmentId },
          {
            $set: { 'comments.$[elem].status': 'delivered' }
          },
          {
            arrayFilters: [
              {
                'elem._id': new mongoose.Types.ObjectId(commentId),
                'elem.sender': { $ne: new mongoose.Types.ObjectId(userId) },
                'elem.status': 'sent'
              }
            ]
          }
        );

        if (result.modifiedCount > 0) {
          io.emit('commentDelivered', {
            appointmentId: appointmentId.toString(),
            commentId: commentId.toString()
          });
        }
      } catch (err) {
        console.error('Error marking message as delivered on receive:', err);
      } finally {
        appointmentLocks.delete(lockKey);
      }
    });
  });
}
