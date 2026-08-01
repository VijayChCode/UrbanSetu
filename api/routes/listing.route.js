import express from 'express'
import { createListing, deleteListing, updateListing, getListing, getListings, getUserListings, reassignPropertyOwner, deassignPropertyOwner, transferPropertyOwner, republishListing, rootAdminBypassVerification, getAIRecommendations, getDeletedListings, restoreDeletedListing, getAgentListings, rootUnpublishListing, sendPropertyDeleteOTP, verifyPropertyDeleteOTP } from '../controllers/listing.controller.js'
import { verifyToken, optionalAuth } from '../utils/verify.js'
import User from '../models/user.model.js'
import Listing from '../models/listing.model.js'
import Notification from '../models/notification.model.js'
import { errorHandler } from '../utils/error.js'

const router = express.Router()

router.post("/reassign-owner/:listingId", verifyToken, reassignPropertyOwner)
router.post("/deassign-owner/:listingId", verifyToken, deassignPropertyOwner)
router.post("/transfer-owner/:listingId", verifyToken, transferPropertyOwner)

router.post("/root-verify/:id", verifyToken, rootAdminBypassVerification)
router.post("/root-unpublish/:id", verifyToken, rootUnpublishListing)
router.post("/republish/:id", verifyToken, republishListing)
router.post("/create", verifyToken, createListing)
router.get("/user", verifyToken, getUserListings)
router.get("/user/get-deleted", verifyToken, getDeletedListings)
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
router.post("/send-delete-otp", verifyToken, sendPropertyDeleteOTP)
router.post("/verify-delete-otp", verifyToken, verifyPropertyDeleteOTP)
router.delete("/delete/:id", verifyToken, deleteListing)
router.get("/get-deleted", verifyToken, getDeletedListings)
router.post("/restore-deleted/:id", verifyToken, restoreDeletedListing)
router.post("/update/:id", verifyToken, updateListing)
router.post("/view/:listingId", async (req, res, next) => {
  try {
    const { listingId } = req.params;
    console.log(`🔍 View tracking request for listing: ${listingId}`);

    // Find the listing and increment view count
    const listing = await Listing.findByIdAndUpdate(
      listingId,
      { $inc: { viewCount: 1 } },
      { new: true }
    ).populate('userRef', 'email username');

    console.log(`📊 Listing found: ${listing ? 'Yes' : 'No'}, Name: ${listing?.name}, Previous View Count: ${listing?.viewCount - 1}, New View Count: ${listing?.viewCount}`);
    console.log(`👤 UserRef details:`, {
      userRef: listing?.userRef,
      userRefType: typeof listing?.userRef,
      userRefId: listing?.userRef?._id,
      userRefEmail: listing?.userRef?.email,
      userRefUsername: listing?.userRef?.username
    });

    if (!listing) {
      return res.status(404).json({ message: 'Listing not found.' });
    }

    // Check for view milestones and send email if reached
    const viewCount = listing.viewCount;
    const milestones = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
    const reachedMilestone = milestones.find(milestone => viewCount === milestone);

    console.log(`🔍 View tracking debug - Property: ${listing.name}, View Count: ${viewCount}, Reached Milestone: ${reachedMilestone}, User Email: ${listing.userRef?.email}`);

    if (reachedMilestone && listing.userRef) {
      // Handle both ObjectId (populated) and String (legacy) userRef
      let userEmail = null;

      if (typeof listing.userRef === 'object' && listing.userRef.email) {
        // Populated userRef (ObjectId)
        userEmail = listing.userRef.email;
      } else if (typeof listing.userRef === 'string') {
        // Legacy string userRef - need to fetch user
        try {
          const User = (await import('../models/user.model.js')).default;
          const user = await User.findById(listing.userRef);
          if (user && user.email) {
            userEmail = user.email;
          }
        } catch (userError) {
          console.error(`❌ Failed to fetch user for legacy userRef ${listing.userRef}:`, userError);
        }
      }

      if (userEmail) {
        try {
          console.log(`📧 Attempting to send milestone email for ${reachedMilestone} views to ${userEmail}`);
          const { sendPropertyViewsMilestoneEmail } = await import('../utils/emailService.js');

          const milestoneDetails = {
            propertyName: listing.name,
            propertyId: listing._id,
            viewCount: viewCount,
            milestone: `${reachedMilestone} views`,
            previousMilestone: milestones[milestones.indexOf(reachedMilestone) - 1] ? `${milestones[milestones.indexOf(reachedMilestone) - 1]} views` : null,
            imageUrls: listing.imageUrls
          };

          console.log(`📧 Milestone details:`, milestoneDetails);
          const emailResult = await sendPropertyViewsMilestoneEmail(userEmail, milestoneDetails);
          console.log(`✅ Property views milestone email sent to: ${userEmail} for ${reachedMilestone} views. Result:`, emailResult);
        } catch (emailError) {
          console.error(`❌ Failed to send property views milestone email to ${userEmail}:`, emailError);
          // Don't fail the view count if email fails
        }
      } else {
        console.log(`⏭️ Skipping milestone email - No valid email found for userRef: ${listing.userRef}`);
      }
    } else {
      console.log(`⏭️ Skipping milestone email - Reached: ${reachedMilestone}, UserRef: ${!!listing.userRef}`);
    }

    res.status(200).json({
      success: true,
      message: 'View counted',
      viewCount: listing.viewCount
    });
  } catch (error) {
    next(error);
  }
})
// Test endpoint for milestone email (for debugging)
router.post("/test-milestone-email/:listingId", async (req, res, next) => {
  try {
    const { listingId } = req.params;
    console.log(`🧪 Testing milestone email for listing: ${listingId}`);

    const listing = await Listing.findById(listingId).populate('userRef', 'email username');

    if (!listing) {
      return res.status(404).json({ message: 'Listing not found.' });
    }

    if (!listing.userRef || !listing.userRef.email) {
      return res.status(400).json({ message: 'Listing has no associated user email.' });
    }

    // Force a milestone email for testing
    const milestoneDetails = {
      propertyName: listing.name,
      propertyId: listing._id,
      viewCount: listing.viewCount,
      milestone: `${listing.viewCount} views`,
      previousMilestone: null,
      imageUrls: listing.imageUrls
    };

    console.log(`🧪 Sending test milestone email to: ${listing.userRef.email}`);
    const { sendPropertyViewsMilestoneEmail } = await import('../utils/emailService.js');
    const result = await sendPropertyViewsMilestoneEmail(listing.userRef.email, milestoneDetails);

    res.status(200).json({
      success: true,
      message: 'Test milestone email sent',
      result: result,
      email: listing.userRef.email,
      propertyName: listing.name
    });
  } catch (error) {
    console.error('Test milestone email error:', error);
    res.status(500).json({ message: 'Failed to send test milestone email', error: error.message });
  }
});

router.post("/reassign-owner/:listingId", verifyToken, reassignPropertyOwner)
router.post("/deassign-owner/:listingId", verifyToken, deassignPropertyOwner)
router.post("/report/:listingId", verifyToken, async (req, res, next) => {
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

    const now = new Date();
    const notifications = await Promise.all(admins.map(async (admin) => {
      return Notification.create({
        userId: admin._id,
        type: 'property_reported',
        title: 'Property Reported',
        message: notificationMessage,
        listingId: listing._id,
        adminId: req.user.id,
        createdAt: now, // Ensure same timestamp for deduplication
        meta: {
          listingId: listing._id,
          reporterId: reporter?._id,
          reporterEmail: reporter?.email || null,
          reporterPhone: reporter?.mobileNumber || null,
          reporterRole: reporter?.role || null,
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

    // Send acknowledgement email to the reporter
    if (reporter && reporter.email) {
      try {
        const { sendPropertyReportAcknowledgement } = await import('../utils/emailService.js');
        await sendPropertyReportAcknowledgement(
          reporter.email,
          reporter.username,
          listing.name,
          listing._id,
          category,
          details
        );
      } catch (emailError) {
        console.error('Failed to send report acknowledgement email:', emailError);
      }
    }

    res.status(200).json({ message: 'Report submitted successfully.' });
  } catch (error) {
    next(error);
  }
});
router.get("/get/:id", getListing)
router.get("/ai-search", optionalAuth, getAIRecommendations)
router.get("/get", optionalAuth, getListings)
router.get("/agent/listings/:userId", getAgentListings)

// Count listings
router.get('/count', async (req, res) => {
  try {
    const total = await Listing.countDocuments();
    res.json({ count: total });
  } catch (e) {
    res.status(500).json({ message: 'Failed to count listings' });
  }
})

export default router