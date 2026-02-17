import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  // Basic payment info
  paymentId: {
    type: String,
    required: true
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  listingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    required: true
  },

  // Payment details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  paymentType: {
    type: String,
    enum: ['advance', 'monthly_rent', 'security_deposit', 'booking_fee', 'emi', 'split_payment', 'refund'],
    required: true
  },

  // Payment gateway info
  gateway: {
    type: String,
    enum: ['paypal', 'stripe', 'payu', 'paytm', 'phonepe', 'razorpay'],
    required: true
  },
  gatewayPaymentId: String,
  gatewayOrderId: String,
  gatewaySignature: String,

  // Payment status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded'],
    default: 'pending'
  },

  // Refund info
  refundAmount: {
    type: Number,
    default: 0
  },
  refundReason: String,
  refundedAt: Date,
  refundId: String,

  // Split payment info (for shared PG/flatmates)
  splitPayments: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    amount: Number,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed']
    },
    paidAt: Date
  }],

  emiDetails: {
    totalAmount: Number,
    emiAmount: Number,
    tenure: Number, // in months
    interestRate: Number,
    bankName: String,
    loanId: String,
    month: Number,
    year: Number,
    emiIndex: Number,
    originalAmount: Number, // Total before discount
    baseAmount: Number,     // Base EMI amount
    penaltyAmount: Number,  // Penalty included
    discountApplied: Number,
    coinsRedeemed: Number
  },

  // Receipt info
  receiptNumber: String,
  receiptUrl: String,
  // Security & telemetry
  clientIp: String,
  userAgent: String,
  riskScore: { type: Number, min: 0, max: 100, default: 0 },
  threeDS: {
    enrolled: { type: Boolean, default: false },
    version: String,
    status: String,
    eci: String
  },
  checksumVerified: { type: Boolean, default: false },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  expiresAt: {
    type: Date,
    // Expires 10 minutes after creation for pending/processing payments
    default: function () {
      // Set to 10 minutes from now if status is pending/processing
      if (this.status === 'pending' || this.status === 'processing') {
        return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      }
      return null;
    }
  },

  // Additional metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },

  // Rental Payment Fields
  rentMonth: {
    type: Number, // 1-12
    min: 1,
    max: 12,
    default: null
  },
  rentYear: {
    type: Number,
    default: null
  },
  contractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RentLockContract',
    default: null,
    index: true
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RentWallet',
    default: null,
    index: true
  },
  penaltyAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  isAutoDebit: {
    type: Boolean,
    default: false
  },
  escrowStatus: {
    type: String,
    enum: ['pending', 'held', 'released', 'refunded'],
    default: null
  },
  escrowReleasedAt: {
    type: Date,
    default: null
  }
});

// Indexes for better performance
paymentSchema.index({ paymentId: 1 }, { unique: true });
paymentSchema.index({ appointmentId: 1 });
paymentSchema.index({ userId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ gatewayPaymentId: 1 });
paymentSchema.index({ expiresAt: 1 }); // Index for finding expired payments

// Pre-save middleware to update updatedAt and set expiresAt for pending/processing payments
paymentSchema.pre('save', function (next) {
  this.updatedAt = new Date();

  // Set expiresAt to 10 minutes from now for pending/processing payments
  if ((this.status === 'pending' || this.status === 'processing') && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  }

  // Clear expiresAt for completed, failed, or cancelled payments
  if (['completed', 'failed', 'cancelled', 'refunded', 'partially_refunded'].includes(this.status)) {
    this.expiresAt = null;
  }

  next();
});

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
