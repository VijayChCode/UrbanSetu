import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  listingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  userName: {
    type: String,
    required: true
  },
  userAvatar: {
    type: String,
    default: "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'removed', 'removed_by_user'],
    default: 'pending'
  },
  adminNote: {
    type: String,
    trim: true
  },
  // New fields for enhanced functionality
  helpfulVotes: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    votedAt: {
      type: Date,
      default: Date.now
    }
  }],
  helpfulCount: {
    type: Number,
    default: 0
  },
  // Dislike support for main reviews
  dislikes: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    dislikedAt: {
      type: Date,
      default: Date.now
    }
  }],
  dislikeCount: {
    type: Number,
    default: 0
  },
  removedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  removedAt: {
    type: Date
  },
  removalReason: {
    type: String,
    enum: ['spam', 'inappropriate', 'fake', 'other'],
    required: false
  },
  removalNote: {
    type: String,
    trim: true
  },
  // Verification based on booking/visit
  verifiedByBooking: {
    type: Boolean,
    default: false
  },
  verifiedByVisit: {
    type: Boolean,
    default: false
  },
  verificationDate: {
    type: Date
  },
  // Owner response to review
  ownerResponse: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  ownerResponseLikes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  ownerResponseDislikes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
}, { timestamps: true });

// Compound index to ensure a user can only review a listing once
// reviewSchema.index({ userId: 1, listingId: 1 }, { unique: true });

// Index for efficient queries
reviewSchema.index({ listingId: 1, status: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, createdAt: -1 });
reviewSchema.index({ helpfulCount: -1, createdAt: -1 });

const Review = mongoose.model('Review', reviewSchema);

export default Review; 