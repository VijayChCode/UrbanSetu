import express from 'express'
import { createListing,deleteListing,updateListing,getListing,getListings,getUserListings,reassignPropertyOwner } from '../controllers/listing.controller.js'
import { verifyToken } from '../utils/verify.js'
import User from '../models/user.model.js'
import Listing from '../models/listing.model.js'
import Notification from '../models/notification.model.js'
import { errorHandler } from '../utils/error.js'

const router =express.Router()

router.post("/create",verifyToken,createListing)
router.get("/user",verifyToken,getUserListings)
router.get("/user/:userId", verifyToken, async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // Check if user is admin or rootadmin
    const user = await User.findById(req.user.id);
    const isAdmin = (user && user.role === 'admin' && user.adminApprovalStatus === 'approved') || (user && user.role === 'rootadmin');
    
    // Allow admins to view any user's listings, or users to view their own listings
    if (!isAdmin && req.user.id !== userId) {
      return next(errorHandler(403, "You can only view your own listings"));
    }
    
    const listings = await Listing.find({ userRef: userId }).sort({ createdAt: -1 });
    res.status(200).json(listings);
  } catch (error) {
    next(error);
  }
});
router.delete("/delete/:id",verifyToken,deleteListing)
router.post("/update/:id",verifyToken,updateListing)
router.post("/reassign-owner/:listingId",verifyToken,reassignPropertyOwner)
router.post("/report/:listingId",verifyToken,async (req, res, next) => {
  try {
    const { listingId } = req.params;
    const { category, details } = req.body;
    
    // Validate required fields
    if (!category || !category.trim()) {
      return res.status(400).json({ message: 'Category is required.' });
    }
    
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found.' });
    }
    
    const reporter = await User.findById(req.user.id);
    const listingOwner = await User.findById(listing.userRef);
    
    // Find all admins
    const admins = await User.find({ role: { $in: ['admin', 'rootadmin'] } });
    
    // Create notification message with category and details
    const categoryText = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const detailsText = details && details.trim() ? ` - ${details.trim()}` : '';
    const notificationMessage = `Property "${listing.name}" was reported by ${reporter?.username || 'a user'} for: ${categoryText}${detailsText}`;
    
    const notifications = await Promise.all(admins.map(async (admin) => {
      return Notification.create({
        userId: admin._id,
        type: 'property_reported',
        title: 'Property Reported',
        message: notificationMessage,
        listingId: listing._id,
        adminId: req.user.id,
        meta: { 
          listingId: listing._id, 
          reporterId: reporter?._id,
          category: category,
          details: details || '',
          listingName: listing.name,
          listingOwnerId: listing.userRef,
          listingOwnerName: listingOwner?.username || 'Unknown'
        }
      });
    }));
    
    // Emit socket event for real-time admin notification
    const io = req.app.get('io');
    if (io) {
      notifications.forEach(notification => {
        io.emit('notificationCreated', notification);
      });
    }
    
    res.status(200).json({ message: 'Report submitted successfully.' });
  } catch (error) {
    next(error);
  }
});
router.get("/get/:id",getListing)
router.get("/get",getListings)

export default router