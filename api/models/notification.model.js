import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'property_edited',
        'property_deleted',
        'appointment_updated',
        'admin_message',
        'new_review',
        'review_reported',
        'review_rejected',
        'review_blocked',
        'admin_created_listing',
        'admin_booked_appointment',
        'appointment_booked',
        'appointment_cancelled_by_buyer',
        'appointment_cancelled_by_seller',
        'appointment_cancelled_by_admin',
        'appointment_reinitiated_by_admin',
        'appointment_accepted_by_seller',
        'appointment_rejected_by_seller',
        'appointment_reinitiated_by_user'
      ],
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification; 