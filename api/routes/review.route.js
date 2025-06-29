import express from 'express';
import { verifyToken } from '../utils/verify.js';
import Review from '../models/review.model.js';
import Listing from '../models/listing.model.js';
import User from '../models/user.model.js';
import Notification from '../models/notification.model.js';
import booking from '../models/booking.model.js';
import { errorHandler } from '../utils/error.js';

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
    
    // Check if user is admin - admins cannot post reviews
    if (user.role === 'admin' || user.role === 'rootadmin') {
      return next(errorHandler(403, 'Admins cannot post reviews. You can only manage reviews.'));
    }
    
    // Check if user is the property owner - property owners cannot review their own properties
    if (listing.userRef && listing.userRef.toString() === req.user.id) {
      return next(errorHandler(403, 'Property owners cannot review their own properties.'));
    }
    
    // Check if user has already reviewed this listing
    const existingReview = await Review.findOne({ userId: req.user.id, listingId });
    if (existingReview) {
      return next(errorHandler(400, 'You have already reviewed this property'));
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
    
    res.status(201).json({
      success: true,
      message: 'Review submitted successfully and pending approval',
      review: newReview
    });
  } catch (error) {
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
    const reviews = await Review.find({ userId: req.user.id })
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
    
    if (review.status === 'approved') {
      return next(errorHandler(400, 'Cannot update approved reviews'));
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
    
    await Review.findByIdAndDelete(reviewId);
    
    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
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
    
    // Check if user already voted
    const existingVote = review.helpfulVotes.find(vote => 
      vote.userId.toString() === req.user.id
    );
    
    if (existingVote) {
      // Remove vote
      review.helpfulVotes = review.helpfulVotes.filter(vote => 
        vote.userId.toString() !== req.user.id
      );
      review.helpfulCount = Math.max(0, review.helpfulCount - 1);
    } else {
      // Add vote
      review.helpfulVotes.push({
        userId: req.user.id,
        votedAt: new Date()
      });
      review.helpfulCount += 1;
    }
    
    await review.save();
    
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
    if (!user || (user.role !== 'admin' && user.role !== 'rootadmin')) {
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
    if (!user || (user.role !== 'admin' && user.role !== 'rootadmin')) {
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
    if (!user || (user.role !== 'admin' && user.role !== 'rootadmin')) {
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
    
    res.status(200).json({
      success: true,
      message: 'Review removed successfully',
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
    if (!user || (user.role !== 'admin' && user.role !== 'rootadmin')) {
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

export default router; 