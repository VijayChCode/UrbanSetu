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
        'property_reported',
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
        'appointment_reinitiated_by_user',
        'refund_appeal_submitted',
        'watchlist_price_drop',
        'watchlist_price_update',
        'watchlist_property_sold',
        'watchlist_property_removed',
        // Rental-specific notifications
        'rent_payment_due',
        'rent_payment_reminder_3days',
        'rent_payment_reminder_1day',
        'rent_payment_overdue',
        'rent_payment_received',
        'rent_payment_failed',
        'rent_contract_signed',
        'rent_contract_expiring_soon',
        'rent_contract_expired',
        'rent_contract_terminated',
        'rent_move_in_reminder',
        'rent_move_out_reminder',
        'rent_dispute_raised',
        'rent_dispute_updated',
        'rent_dispute_resolved',
        'rent_verification_requested',
        'rent_verification_approved',
        'rent_verification_rejected',
        'rent_rating_reminder',
        'rent_rating_received',
        'rent_loan_applied',
        'rent_loan_approved',
        'rent_loan_rejected',
        'rent_loan_disbursed',
        'rent_loan_emi_due',
        'rent_loan_defaulted',
        'rent_new_property_available',
        'rent_escrow_released',
        'rent_auto_debit_enabled',
        'rent_auto_debit_failed',
        'property_assigned',
        'property_deassigned',
        'client_error_report',
        'community_report',
        'video_issue_report',
        'platform_update',
        'welcome'
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
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
  },
  { timestamps: true }
);

// Index for efficient queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

// Middleware to automatically trigger push notifications
notificationSchema.post('save', async function (doc, next) {
  try {
    const { sendPushNotification } = await import('../utils/pushNotification.js');
    if (sendPushNotification) {
      // Trigger silently in background
      sendPushNotification(doc.userId, doc.title, doc.message, {
        notificationId: doc._id,
        type: doc.type,
        listingId: doc.listingId,
        ...(doc.meta || {}) // Pass all meta fields (actions, imageUrl, category, etc.)
      }).catch(err => console.error('Push hook error:', err));
    }
  } catch (err) {
    console.error('Push middleware failure:', err);
  }
  if (typeof next === 'function') next();
});

// For bulk inserts
notificationSchema.post('insertMany', async function (docs, next) {
  try {
    const { sendPushNotification } = await import('../utils/pushNotification.js');
    if (sendPushNotification && Array.isArray(docs)) {
      docs.forEach(doc => {
        sendPushNotification(doc.userId, doc.title, doc.message, {
          notificationId: doc._id,
          type: doc.type,
          listingId: doc.listingId,
          ...(doc.meta || {})
        }).catch(() => { });
      });
    }
  } catch (err) { }
  if (typeof next === 'function') next();
});

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;