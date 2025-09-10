import express from 'express';
import { verifyToken } from '../utils/verify.js';
import Review from '../models/review.model.js';
import Listing from '../models/listing.model.js';
import User from '../models/user.model.js';
import Notification from '../models/notification.model.js';
import booking from '../models/booking.model.js';
import { errorHandler } from '../utils/error.js';
import ReviewReply from '../models/reviewReply.model.js';

const router = express.Router();

// Create a review
router.post('/create', verifyToken, async (req, res, next) => {
  try {
    const { listingId, rating, comment } = req.body;
    
    if (!listingId || !rating || !comment) {
      return next(errorHandler(400, 'All fields are required'));
    }
    
    if (rating < 1 || rating > 5) {
      return next(errorHandler(400, 'Rating must be between 1 and 5'));
    }
    
    // Check if listing exists
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return next(errorHandler(404, 'Listing not found'));
    }
    
    // Get user details
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(errorHandler(404, 'User not found'));
    }
    
    // Check if user is the property owner - property owners cannot review their own properties
    if (listing.userRef && listing.userRef.toString() === req.user.id) {
      return next(errorHandler(403, 'Property owners cannot review their own properties.'));
    }
    
    // Check if user has booked or visited this property for verification
    const hasBooked = await booking.findOne({
      buyerId: req.user.id,
      listingId: listingId,
      status: { $in: ['accepted', 'completed'] }
    });
    
    const isVerified = !!hasBooked;
    
    const newReview = new Review({
      listingId,
      userId: req.user.id,
      rating,
      comment,
      userName: user.username,
      userAvatar: user.avatar,
      status: 'pending', // Reviews need admin approval
      isVerified,
      verifiedByBooking: isVerified,
      verificationDate: isVerified ? new Date() : null
    });
    
    await newReview.save();
    
    // Notify property owner about new review
    try {
      const propertyOwner = await User.findById(listing.userRef);
      if (propertyOwner && propertyOwner._id.toString() !== req.user.id.toString()) {
        await Notification.create({
          userId: propertyOwner._id,
          type: 'new_review',
          title: 'New Review Received',
          message: `Your property "${listing.name}" received a new review from ${user.username}`,
          listingId: listingId,
          adminId: req.user.id
        });
      }
    } catch (notificationError) {
      console.error('Failed to send notification:', notificationError);
    }
    
    // Notify all admins about new review pending approval
    try {
      const admins = await User.find({ role: { $in: ['admin', 'rootadmin'] } });
      const notifications = await Promise.all(admins.map(async (admin) => {
        return Notification.create({
          userId: admin._id,
          type: 'review_pending_approval',
          title: 'New Review Pending Approval',
          message: `A new review by ${user.username} on ${listing.name}`,
          link: '/admin/reviews',
          listingId: listingId,
          meta: { reviewId: newReview._id, reviewerId: user._id }
        });
      }));
      // Emit socket event for real-time admin notification
      const io = req.app.get('io');
      if (io) {
        notifications.forEach(notification => {
          io.emit('notificationCreated', notification);
        });
      }
    } catch (adminNotificationError) {
      console.error('Failed to send admin notifications:', adminNotificationError);
    }
    
    // Emit socket event for real-time review creation
    const io = req.app.get('io');
    if (io) io.emit('reviewUpdated', newReview);
    
    res.status(201).json({
      success: true,
      message: 'Review submitted successfully and pending approval',
      review: newReview
    });
  } catch (error) {
    // Handle duplicate key error for unique userId+listingId
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this property.'
      });
    }
    next(error);
  }
});

// Get reviews for a listing (approved only for public)
router.get('/listing/:listingId', async (req, res, next) => {
  try {
    const { listingId } = req.params;
    const { status = 'approved', sort = 'date', order = 'desc' } = req.query;
    
    let sortQuery = {};
    if (sort === 'rating') {
      sortQuery = { rating: order === 'desc' ? -1 : 1, createdAt: -1 };
    } else if (sort === 'helpful') {
      sortQuery = { helpfulCount: order === 'desc' ? -1 : 1, createdAt: -1 };
    } else {
      sortQuery = { createdAt: order === 'desc' ? -1 : 1 };
    }
    
    const reviews = await Review.find({ 
      listingId, 
      status: status 
    }).sort(sortQuery);
    
    res.status(200).json(reviews);
  } catch (error) {
    next(error);
  }
});

// Get user's reviews
router.get('/user', verifyToken, async (req, res, next) => {
  try {
    const { includeRemoved } = req.query;
    const baseQuery = { userId: req.user.id };
    // By default, exclude removed reviews from user's list view
    // Pass includeRemoved=true to fetch all statuses
    if (!includeRemoved || includeRemoved === 'false') {
      baseQuery.status = { $nin: ['removed', 'removed_by_user'] };
    }
    const reviews = await Review.find(baseQuery)
      .populate('listingId', 'name imageUrls city state')
      .sort({ createdAt: -1 });
    res.status(200).json(reviews);
  } catch (error) {
    next(error);
  }
});

// Update user's own review
router.put('/update/:reviewId', verifyToken, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;
    
    const review = await Review.findById(reviewId);
    if (!review) {
      return next(errorHandler(404, 'Review not found'));
    }
    
    if (review.userId.toString() !== req.user.id) {
      return next(errorHandler(403, 'You can only update your own reviews'));
    }
    
    const updatedReview = await Review.findByIdAndUpdate(
      reviewId,
      {
        rating,
        comment,
        status: 'pending' // Reset to pending after update
      },
      { new: true }
    );
    
    // Emit socket event for real-time review update
    const io = req.app.get('io');
    if (io) io.emit('reviewUpdated', updatedReview);
    
    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      review: updatedReview
    });
  } catch (error) {
    next(error);
  }
});

// Delete user's own review
router.delete('/delete/:reviewId', verifyToken, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    
    const review = await Review.findById(reviewId);
    if (!review) {
      return next(errorHandler(404, 'Review not found'));
    }
    
    if (review.userId.toString() !== req.user.id) {
      return next(errorHandler(403, 'You can only delete your own reviews'));
    }
    
    // If already removed, just return success
    if (review.status === 'removed_by_user') {
      return res.status(200).json({
        success: true,
        message: 'Review already removed',
      });
    }

    const wasApproved = review.status === 'approved';
    const oldRating = review.rating;

    review.status = 'removed_by_user';
    review.removedBy = req.user.id;
    review.removedAt = new Date();
    await review.save();

    // Update listing stats if review was approved
    if (wasApproved) {
      const listing = await Listing.findById(review.listingId);
      if (listing) {
        // Recalculate stats using only approved reviews
        const approvedReviews = await Review.find({ listingId: listing._id, status: 'approved' });
        listing.reviewCount = approvedReviews.length;
        listing.totalRating = approvedReviews.reduce((sum, r) => sum + r.rating, 0);
        listing.averageRating = listing.reviewCount > 0 ? listing.totalRating / listing.reviewCount : 0;
        await listing.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Review removed successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Vote helpful on a review
router.post('/helpful/:reviewId', verifyToken, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const review = await Review.findById(reviewId);
    if (!review) {
      return next(errorHandler(404, 'Review not found'));
    }
    if (review.status !== 'approved') {
      return next(errorHandler(400, 'Can only vote on approved reviews'));
    }
    // Check if user already voted helpful
    const existingVote = review.helpfulVotes.find(vote => vote.userId.toString() === req.user.id);
    if (existingVote) {
      // Remove vote
      review.helpfulVotes = review.helpfulVotes.filter(vote => vote.userId.toString() !== req.user.id);
      review.helpfulCount = Math.max(0, review.helpfulCount - 1);
    } else {
      // Remove user's dislike if present
      const alreadyDisliked = review.dislikes.some(d => d.userId.toString() === req.user.id);
      if (alreadyDisliked) {
        review.dislikes = review.dislikes.filter(d => d.userId.toString() !== req.user.id);
        review.dislikeCount = Math.max(0, review.dislikeCount - 1);
      }
      // Add helpful vote
      review.helpfulVotes.push({
        userId: req.user.id,
        votedAt: new Date()
      });
      review.helpfulCount += 1;
    }
    await review.save();
    // Emit socket event for real-time review helpful/like update
    const io = req.app.get('io');
    if (io) io.emit('reviewUpdated', review);
    res.status(200).json({
      success: true,
      message: existingVote ? 'Vote removed' : 'Vote added',
      helpfulCount: review.helpfulCount,
      hasVoted: !existingVote
    });
  } catch (error) {
    next(error);
  }
});

// Admin routes
// Get all reviews (admin only)
router.get('/admin/all', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || ((user.role !== 'admin' || user.adminApprovalStatus !== 'approved') && user.role !== 'rootadmin')) {
      return next(errorHandler(403, 'Admin access required'));
    }
    
    const { status, page = 1, limit = 10, sort = 'date', order = 'desc' } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    if (status) {
      query.status = status;
    }
    
    let sortQuery = {};
    if (sort === 'rating') {
      sortQuery = { rating: order === 'desc' ? -1 : 1, createdAt: -1 };
    } else if (sort === 'helpful') {
      sortQuery = { helpfulCount: order === 'desc' ? -1 : 1, createdAt: -1 };
    } else {
      sortQuery = { createdAt: order === 'desc' ? -1 : 1 };
    }
    
    const reviews = await Review.find(query)
      .populate('listingId', 'name imageUrls city state')
      .populate('userId', 'username email')
      .sort(sortQuery)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Review.countDocuments(query);
    
    res.status(200).json({
      reviews,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    next(error);
  }
});

// Approve/reject review (admin only)
router.put('/admin/status/:reviewId', verifyToken, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { status, adminNote } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user || ((user.role !== 'admin' || user.adminApprovalStatus !== 'approved') && user.role !== 'rootadmin')) {
      return next(errorHandler(403, 'Admin access required'));
    }
    
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return next(errorHandler(400, 'Invalid status'));
    }
    
    const review = await Review.findById(reviewId);
    if (!review) {
      return next(errorHandler(404, 'Review not found'));
    }
    
    const oldStatus = review.status;
    const oldRating = review.rating;
    
    review.status = status;
    if (adminNote) {
      review.adminNote = adminNote;
    }
    
    await review.save();
    
    // Update listing rating if status changed
    if (oldStatus !== status) {
      const listing = await Listing.findById(review.listingId);
      if (listing) {
        if (oldStatus === 'approved' && status !== 'approved') {
          // Remove rating from listing
          listing.totalRating -= oldRating;
          listing.reviewCount -= 1;
        } else if (oldStatus !== 'approved' && status === 'approved') {
          // Add rating to listing
          listing.totalRating += review.rating;
          listing.reviewCount += 1;
        }
        
        if (listing.reviewCount > 0) {
          listing.averageRating = listing.totalRating / listing.reviewCount;
        } else {
          listing.averageRating = 0;
        }
        
        await listing.save();
      }
    }
    
    // Emit socket event for real-time review update
    const io = req.app.get('io');
    if (io) io.emit('reviewUpdated', review);
    // Send notification on approval or rejection
    try {
      const listing = await Listing.findById(review.listingId);
      const propertyOwner = listing ? await User.findById(listing.userRef) : null;
      if (status === 'approved' && propertyOwner && propertyOwner._id.toString() !== review.userId.toString()) {
        await Notification.create({
          userId: propertyOwner._id,
          type: 'new_review',
          title: 'New Review Received',
          message: `Your property "${listing.name}" received a new review from ${review.userName}`,
          listingId: review.listingId,
          adminId: req.user.id
        });
      } else if (status === 'rejected') {
        await Notification.create({
          userId: review.userId,
          type: 'review_rejected',
          title: 'Review Rejected',
          message: `Your review for "${listing?.name || 'the property'}" was rejected by admin, Please check the reason and update your review.`,
          listingId: review.listingId,
          adminId: req.user.id
        });
      }
    } catch (notificationError) {
      console.error('Failed to send notification:', notificationError);
    }
    res.status(200).json({
      success: true,
      message: `Review ${status} successfully`,
      review
    });
  } catch (error) {
    next(error);
  }
});

// Remove review (admin only) - for spam/inappropriate content
router.put('/admin/remove/:reviewId', verifyToken, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { reason, note } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user || ((user.role !== 'admin' || user.adminApprovalStatus !== 'approved') && user.role !== 'rootadmin')) {
      return next(errorHandler(403, 'Admin access required'));
    }
    
    if (!['spam', 'inappropriate', 'fake', 'other'].includes(reason)) {
      return next(errorHandler(400, 'Invalid removal reason'));
    }
    
    const review = await Review.findById(reviewId);
    if (!review) {
      return next(errorHandler(404, 'Review not found'));
    }
    
    const oldStatus = review.status;
    const oldRating = review.rating;
    
    review.status = 'removed';
    review.removedBy = req.user.id;
    review.removedAt = new Date();
    review.removalReason = reason;
    if (note) {
      review.removalNote = note;
    }
    
    await review.save();
    
    // Update listing rating if review was approved
    if (oldStatus === 'approved') {
      const listing = await Listing.findById(review.listingId);
      if (listing) {
        listing.totalRating -= oldRating;
        listing.reviewCount -= 1;
        
        if (listing.reviewCount > 0) {
          listing.averageRating = listing.totalRating / listing.reviewCount;
        } else {
          listing.averageRating = 0;
        }
        
        await listing.save();
      }
    }
    
    // Emit socket event for real-time review removal
    const io = req.app.get('io');
    if (io) io.emit('reviewUpdated', review);
    // Send notification to review author
    try {
      // Fetch listing for property name
      const listing = await Listing.findById(review.listingId);
      const propertyName = listing?.name || 'the property';
      let notificationMessage = `Your review was removed by admin for "${reason}" on property "${propertyName}" and is no longer visible.`;
      if (note) {
        notificationMessage += `\nAdmin Note: ${note}`;
      }
      const notification = await Notification.create({
        userId: review.userId,
        type: 'review_blocked',
        title: 'Review Removed by Admin',
        message: notificationMessage,
        listingId: review.listingId,
        adminId: req.user.id
      });
      if (io) io.emit('notificationCreated', notification);
    } catch (notificationError) {
      console.error('Failed to send notification:', notificationError);
    }
    res.status(200).json({
      success: true,
      message: 'Review removed successfully',
      review
    });
  } catch (error) {
    next(error);
  }
});

// Restore a removed review (admin only)
router.put('/admin/restore/:reviewId', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || ((user.role !== 'admin' || user.adminApprovalStatus !== 'approved') && user.role !== 'rootadmin')) {
      return next(errorHandler(403, 'Admin access required'));
    }
    const { reviewId } = req.params;
    const review = await Review.findById(reviewId);
    if (!review) {
      return next(errorHandler(404, 'Review not found'));
    }
    if (review.status !== 'removed' && review.status !== 'removed_by_user') {
      return next(errorHandler(400, 'Only removed reviews can be restored'));
    }
    review.status = 'approved';
    review.removedBy = undefined;
    review.removedAt = undefined;
    await review.save();
    // Update listing stats
    const listing = await Listing.findById(review.listingId);
    if (listing) {
      const approvedReviews = await Review.find({ listingId: listing._id, status: 'approved' });
      listing.reviewCount = approvedReviews.length;
      listing.totalRating = approvedReviews.reduce((sum, r) => sum + r.rating, 0);
      listing.averageRating = listing.reviewCount > 0 ? listing.totalRating / listing.reviewCount : 0;
      await listing.save();
    }
    // Send notification to the review's user
    try {
      const reviewUser = await User.findById(review.userId);
      if (reviewUser) {
        await Notification.create({
          userId: reviewUser._id,
          type: 'review_restored',
          title: 'Review Restored',
          message: `Your review for property "${listing ? listing.name : ''}" has been restored and approved by an admin.`,
          listingId: review.listingId,
          adminId: req.user.id,
          link: `/listing/${listing ? listing._id : review.listingId}`
        });
      }
    } catch (notificationError) {
      console.error('Failed to send review restored notification:', notificationError);
    }
    // Emit socket event for real-time review update
    const io = req.app.get('io');
    if (io) io.emit('reviewUpdated', review);
    res.status(200).json({
      success: true,
      message: 'Review restored and approved',
      review
    });
  } catch (error) {
    next(error);
  }
});

// Get review statistics (admin only)
router.get('/admin/stats', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || ((user.role !== 'admin' || user.adminApprovalStatus !== 'approved') && user.role !== 'rootadmin')) {
      return next(errorHandler(403, 'Admin access required'));
    }
    
    const [totalReviews, pendingReviews, approvedReviews, rejectedReviews, removedReviews] = await Promise.all([
      Review.countDocuments(),
      Review.countDocuments({ status: 'pending' }),
      Review.countDocuments({ status: 'approved' }),
      Review.countDocuments({ status: 'rejected' }),
      Review.countDocuments({ status: 'removed' })
    ]);
    
    const averageRating = await Review.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);
    
    const verifiedReviews = await Review.countDocuments({ 
      status: 'approved', 
      $or: [{ verifiedByBooking: true }, { verifiedByVisit: true }] 
    });
    
    res.status(200).json({
      totalReviews,
      pendingReviews,
      approvedReviews,
      rejectedReviews,
      removedReviews,
      verifiedReviews,
      averageRating: averageRating.length > 0 ? Math.round(averageRating[0].avgRating * 10) / 10 : 0
    });
  } catch (error) {
    next(error);
  }
});

// Owner responds to a review
router.put('/respond/:reviewId', verifyToken, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { ownerResponse } = req.body;
    if (!ownerResponse || ownerResponse.trim().length === 0) {
      return next(errorHandler(400, 'Response cannot be empty'));
    }
    const review = await Review.findById(reviewId);
    if (!review) {
      return next(errorHandler(404, 'Review not found'));
    }
    const listing = await Listing.findById(review.listingId);
    if (!listing) {
      return next(errorHandler(404, 'Listing not found'));
    }
    // Only the owner of the listing can respond
    if (listing.userRef.toString() !== req.user.id) {
      return next(errorHandler(403, 'Only the listing owner can respond to this review'));
    }
    const isUpdate = !!review.ownerResponse;
    review.ownerResponse = ownerResponse;
    await review.save();
    // Emit socket event for real-time owner response
    const io = req.app.get('io');
    if (io) io.emit('reviewUpdated', review);
    res.status(200).json({
      success: true,
      message: isUpdate ? 'Response updated successfully' : 'Response added successfully',
      review
    });
  } catch (error) {
    next(error);
  }
});

// Create a reply to a review
router.post('/reply/:reviewId', verifyToken, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { comment } = req.body;
    if (!comment || comment.trim().length === 0) {
      return next(errorHandler(400, 'Reply cannot be empty'));
    }
    const review = await Review.findById(reviewId);
    if (!review) {
      return next(errorHandler(404, 'Review not found'));
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(errorHandler(404, 'User not found'));
    }
    const reply = new ReviewReply({
      reviewId,
      userId: req.user.id,
      userName: user.username,
      userAvatar: user.avatar,
      comment: comment.trim(),
      likes: [],
      dislikes: []
    });
    await reply.save();
    // Emit socket event for real-time reply creation
    const io = req.app.get('io');
    if (io) io.emit('reviewReplyUpdated', { action: 'created', reply });
    res.status(201).json({ success: true, message: 'Reply added successfully', reply });
  } catch (error) {
    next(error);
  }
});

// Fetch replies for a review
router.get('/reply/:reviewId', async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const replies = await ReviewReply.find({ reviewId }).sort({ createdAt: 1 });
    res.status(200).json(replies);
  } catch (error) {
    next(error);
  }
});

// Like/dislike a reply
router.post('/reply/like/:replyId', verifyToken, async (req, res, next) => {
  try {
    const { replyId } = req.params;
    const { action } = req.body; // 'like' or 'dislike' or 'remove_like' or 'remove_dislike'
    const reply = await ReviewReply.findById(replyId);
    if (!reply) {
      return next(errorHandler(404, 'Reply not found'));
    }
    // Remove user from both arrays first
    reply.likes = reply.likes.filter(id => id.toString() !== req.user.id);
    reply.dislikes = reply.dislikes.filter(id => id.toString() !== req.user.id);
    if (action === 'like') {
      reply.likes.push(req.user.id);
    } else if (action === 'dislike') {
      reply.dislikes.push(req.user.id);
    } else if (action === 'remove_like') {
      // Only remove like, do not add
      // Already removed above
    } else if (action === 'remove_dislike') {
      // Only remove dislike, do not add
      // Already removed above
    }
    await reply.save();
    // Emit socket event for real-time reply like/dislike with all replies for the parent review
    const io = req.app.get('io');
    if (io) {
      const allReplies = await ReviewReply.find({ reviewId: reply.reviewId });
      io.emit('reviewReplyUpdated', { action: 'updatedAll', replies: allReplies, reviewId: reply.reviewId });
    }
    res.status(200).json({ success: true, reply });
  } catch (error) {
    next(error);
  }
});

// Dislike a main review
router.post('/dislike/:reviewId', verifyToken, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const review = await Review.findById(reviewId);
    if (!review) {
      return next(errorHandler(404, 'Review not found'));
    }
    // Remove user from dislikes if already present, else add
    const alreadyDisliked = review.dislikes.some(d => d.userId.toString() === req.user.id);
    if (alreadyDisliked) {
      review.dislikes = review.dislikes.filter(d => d.userId.toString() !== req.user.id);
      review.dislikeCount = Math.max(0, review.dislikeCount - 1);
    } else {
      // Remove user's helpful vote if present
      const existingVote = review.helpfulVotes.find(vote => vote.userId.toString() === req.user.id);
      if (existingVote) {
        review.helpfulVotes = review.helpfulVotes.filter(vote => vote.userId.toString() !== req.user.id);
        review.helpfulCount = Math.max(0, review.helpfulCount - 1);
      }
      review.dislikes.push({ userId: req.user.id, dislikedAt: new Date() });
      review.dislikeCount += 1;
    }
    await review.save();
    // Emit socket event for real-time review dislike
    const io = req.app.get('io');
    if (io) io.emit('reviewUpdated', review);
    res.status(200).json({ success: true, dislikeCount: review.dislikeCount, dislikes: review.dislikes });
  } catch (error) {
    next(error);
  }
});

// Update a reply
router.put('/reply/:replyId', verifyToken, async (req, res, next) => {
  try {
    const { replyId } = req.params;
    const { comment } = req.body;
    if (!comment || comment.trim().length === 0) {
      return next(errorHandler(400, 'Reply cannot be empty'));
    }
    const reply = await ReviewReply.findById(replyId);
    if (!reply) {
      return next(errorHandler(404, 'Reply not found'));
    }
    if (reply.userId.toString() !== req.user.id) {
      return next(errorHandler(403, 'You can only edit your own replies'));
    }
    reply.comment = comment.trim();
    await reply.save();
    // Emit socket event for real-time reply update
    const io = req.app.get('io');
    if (io) io.emit('reviewReplyUpdated', { action: 'updated', reply });
    res.status(200).json({ success: true, message: 'Reply updated successfully', reply });
  } catch (error) {
    next(error);
  }
});

// Delete a reply
router.delete('/reply/:replyId', verifyToken, async (req, res, next) => {
  try {
    const { replyId } = req.params;
    const reply = await ReviewReply.findById(replyId);
    if (!reply) {
      return next(errorHandler(404, 'Reply not found'));
    }
    // Allow author or admin to delete
    const user = await User.findById(req.user.id);
    if (reply.userId.toString() !== req.user.id && !(user && (user.role === 'admin' || user.role === 'rootadmin'))) {
      return next(errorHandler(403, 'You can only delete your own replies unless you are an admin'));
    }
    await reply.deleteOne();
    // Emit socket event for real-time reply deletion
    const io = req.app.get('io');
    if (io) io.emit('reviewReplyUpdated', { action: 'deleted', replyId, reviewId: reply.reviewId });
    res.status(200).json({ success: true, message: 'Reply deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Delete owner response
router.delete('/respond/:reviewId', verifyToken, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const review = await Review.findById(reviewId);
    if (!review) {
      return next(errorHandler(404, 'Review not found'));
    }
    const listing = await Listing.findById(review.listingId);
    if (!listing) {
      return next(errorHandler(404, 'Listing not found'));
    }
    if (listing.userRef.toString() !== req.user.id) {
      return next(errorHandler(403, 'Only the listing owner can delete this response'));
    }
    review.ownerResponse = '';
    await review.save();
    // Emit socket event for real-time owner response deletion
    const io = req.app.get('io');
    if (io) io.emit('reviewUpdated', review);
    res.status(200).json({ success: true, message: 'Owner response deleted successfully', review });
  } catch (error) {
    next(error);
  }
});

// Like/dislike owner response
router.post('/respond/like/:reviewId', verifyToken, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { action } = req.body; // 'like' or 'dislike'
    const review = await Review.findById(reviewId);
    if (!review) {
      return next(errorHandler(404, 'Review not found'));
    }
    if (!review.ownerResponse) {
      return next(errorHandler(400, 'No owner response to like/dislike'));
    }
    // Owner cannot like/dislike their own response
    const listing = await Listing.findById(review.listingId);
    if (listing && listing.userRef.toString() === req.user.id) {
      return next(errorHandler(403, 'Owner cannot like/dislike their own response'));
    }
    // Remove user from both arrays first
    review.ownerResponseLikes = review.ownerResponseLikes.filter(id => id.toString() !== req.user.id);
    review.ownerResponseDislikes = review.ownerResponseDislikes.filter(id => id.toString() !== req.user.id);
    if (action === 'like') {
      review.ownerResponseLikes.push(req.user.id);
    } else if (action === 'dislike') {
      review.ownerResponseDislikes.push(req.user.id);
    }
    await review.save();
    // Emit socket event for real-time owner response like/dislike
    const io = req.app.get('io');
    if (io) io.emit('reviewUpdated', review);
    res.status(200).json({ success: true, ownerResponseLikes: review.ownerResponseLikes, ownerResponseDislikes: review.ownerResponseDislikes });
  } catch (error) {
    next(error);
  }
});

// Report a review (user -> admin notification)
router.post('/report/:reviewId', verifyToken, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { category, reason } = req.body;
    
    // Validate required fields
    if (!category || !category.trim()) {
      return res.status(400).json({ message: 'Category is required.' });
    }
    
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found.' });
    }
    
    const listing = await Listing.findById(review.listingId);
    const reporter = await User.findById(req.user.id);
    
    // Create notification message with category and optional reason
    const categoryText = category.charAt(0).toUpperCase() + category.slice(1).replace(/([A-Z])/g, ' $1');
    const reasonText = reason && reason.trim() ? ` - ${reason.trim()}` : '';
    const notificationMessage = `A review for property "${listing?.name || 'Unknown'}" was reported by ${reporter?.username || 'a user'} for: ${categoryText}${reasonText}`;
    
    // Find all admins
    const admins = await User.find({ role: { $in: ['admin', 'rootadmin'] } });
    const notifications = await Promise.all(admins.map(async (admin) => {
      return Notification.create({
        userId: admin._id,
        type: 'review_reported',
        title: 'Review Reported',
        message: notificationMessage,
        listingId: review.listingId,
        adminId: req.user.id,
        meta: { 
          reviewId: review._id, 
          reporterId: reporter?._id,
          category: category,
          reason: reason || ''
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

export default router; 