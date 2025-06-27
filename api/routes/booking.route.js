import express from "express";
import booking from "../models/booking.model.js";
import Listing from "../models/listing.model.js";
import User from "../models/user.model.js";
import { verifyToken } from '../utils/verify.js';

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
    res.status(201).json({ message: "Appointment booked successfully!" });
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
    
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update appointment status.' });
  }
});

// POST: Add a comment to an appointment
router.post('/:id/comment', verifyToken, async (req, res) => {
  try {
    const { message } = req.body;
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
    
    const updated = await booking.findByIdAndUpdate(
      id,
      { $push: { comments: { sender: userId, senderEmail: req.user.email, message } } },
      { new: true }
    ).populate('buyerId', 'username email mobileNumber')
     .populate('sellerId', 'username email mobileNumber')
     .populate('listingId', '_id name address');
    
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
    
    const updated = await booking.findByIdAndUpdate(
      id,
      { $pull: { comments: { _id: commentId } } },
      { new: true }
    ).populate('buyerId', 'username email mobileNumber')
     .populate('sellerId', 'username email mobileNumber')
     .populate('listingId', '_id name address');
    
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete comment.' });
  }
});

// PATCH: Edit a comment in an appointment
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

    comment.message = message;
    await appointment.save();
    
    const updated = await booking.findById(id)
      .populate('buyerId', 'username email mobileNumber')
      .populate('sellerId', 'username email mobileNumber')
      .populate('listingId', '_id name address');
    
    res.status(200).json(updated);
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

// GET: Fetch user-specific appointment count
router.get("/user/:userId", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verify the user is requesting their own stats
    if (req.user._id.toString() !== userId) {
      return res.status(403).json({ message: "You can only view your own stats" });
    }
    
    // Count appointments where user is either buyer or seller
    const count = await booking.countDocuments({
      $or: [{ buyerId: userId }, { sellerId: userId }]
    });
    
    res.status(200).json({ count });
  } catch (err) {
    console.error("Error fetching user appointment count:", err);
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
    if (["cancelledByBuyer", "cancelledBySeller", "cancelledByAdmin", "completed", "noShow", "deletedByAdmin"].includes(bookingToCancel.status)) {
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
    // Limit reinitiation
    if ((original.reinitiationCount || 0) >= 2) {
      return res.status(400).json({ message: 'Maximum number of reinitiations reached.' });
    }
    // Check both parties still exist
    const buyer = await User.findById(original.buyerId);
    const seller = await User.findById(original.sellerId);
    if (!buyer || !seller) {
      return res.status(400).json({ message: 'Cannot reinitiate: one of the parties no longer exists.' });
    }
    // Update the same booking: set new date/time/message, status to pending, increment reinitiationCount, add to history
    original.date = date;
    original.time = time;
    original.message = message;
    original.status = 'pending';
    original.cancelReason = '';
    original.cancelledBy = undefined;
    original.reinitiationCount = (original.reinitiationCount || 0) + 1;
    original.reinitiationHistory = original.reinitiationHistory || [];
    original.reinitiationHistory.push({ date, time, message, userId });
    original.visibleToBuyer = true;
    original.visibleToSeller = true;
    await original.save();
    // TODO: Optionally notify the other party
    res.status(200).json({ message: 'Appointment reinitiated successfully!', reinitiationLeft: 2 - original.reinitiationCount, appointment: original });
  } catch (err) {
    console.error('Error in user reinitiate:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
