import mongoose from "mongoose";

const rentLockContractSchema = new mongoose.Schema({
  // Contract Identification
  contractId: {
    type: String,
    unique: true, // unique already creates an index
    required: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true
  },
  listingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    required: true
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  landlordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Rent Lock Details
  rentLockPlan: {
    type: String,
    enum: ['1_year', '3_year', '5_year', 'custom'],
    required: true
  },
  lockDuration: {
    type: Number, // in months
    required: true,
    min: 1,
    max: 60
  },
  lockedRentAmount: {
    type: Number,
    required: true,
    min: 0
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },

  // Payment Terms
  paymentFrequency: {
    type: String,
    enum: ['monthly', 'quarterly', 'annual'],
    default: 'monthly'
  },
  dueDate: {
    type: Number, // Day of month (1-31)
    required: true,
    min: 1,
    max: 31
  },
  securityDeposit: {
    type: Number,
    required: true,
    min: 0
  },
  securityDepositPaid: {
    type: Boolean,
    default: false
  },
  maintenanceCharges: {
    type: Number,
    default: 0,
    min: 0
  },
  advanceRent: {
    type: Number, // Number of months paid in advance
    default: 0,
    min: 0
  },

  // Penalties
  lateFeePercentage: {
    type: Number,
    default: 5, // 5% of rent
    min: 0,
    max: 100
  },
  earlyTerminationFee: {
    type: Number,
    default: 0,
    min: 0
  },
  defaultPenalty: {
    type: Number,
    default: 0,
    min: 0
  },

  // Contract Status
  status: {
    type: String,
    enum: ['draft', 'pending_signature', 'active', 'expired', 'terminated', 'renewed', 'rejected'],
    default: 'draft'
  },

  // Digital Signatures
  tenantSignature: {
    signed: {
      type: Boolean,
      default: false
    },
    signedAt: Date,
    ipAddress: String,
    userAgent: String,
    signatureData: String // Base64 encoded signature image or hash
  },
  landlordSignature: {
    signed: {
      type: Boolean,
      default: false
    },
    signedAt: Date,
    ipAddress: String,
    userAgent: String,
    signatureData: String
  },

  // Auto-renewal
  autoRenew: {
    type: Boolean,
    default: false
  },
  renewalNoticeDays: {
    type: Number,
    default: 30 // 30 days before expiry
  },

  // Move-in/Move-out
  moveInDate: {
    type: Date,
    default: null
  },
  moveOutDate: {
    type: Date,
    default: null
  },
  moveInChecklistCompleted: {
    type: Boolean,
    default: false
  },
  moveOutChecklistCompleted: {
    type: Boolean,
    default: false
  },

  // Termination
  terminatedAt: Date,
  terminationReason: String,
  terminationBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Rejection (before completion)
  rejectedAt: Date,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rejectionReason: String,

  // Rent Wallet
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RentWallet',
    default: null
  },

  // Blockchain Proof of Agreement
  blockchainProof: {
    agreementHash: {
      type: String,
      index: true,
      default: null
    },
    onChainTxHash: {
      type: String,
      default: null
    },
    timestamp: {
      type: Date,
      default: null
    },
    network: {
      type: String,
      default: 'polygon'
    }
  },

  // Metadata
  contractDocumentUrl: String, // PDF contract
  termsAndConditions: String, // Stored text version
  customClauses: [String], // AI-generated or manually added custom legal clauses
  notes: String, // Additional notes

  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
rentLockContractSchema.index({ tenantId: 1, status: 1 });
rentLockContractSchema.index({ landlordId: 1, status: 1 });
rentLockContractSchema.index({ listingId: 1 });
rentLockContractSchema.index({ endDate: 1, status: 1 }); // For expiry tracking

// Generate contractId before saving
rentLockContractSchema.pre('save', async function (next) {
  if (!this.contractId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9).toUpperCase();
    this.contractId = `RENT-${timestamp}-${random}`;
  }
  this.updatedAt = Date.now();
  next();
});

// Virtual for checking if contract is active
rentLockContractSchema.virtual('isActive').get(function () {
  const now = new Date();
  return this.status === 'active' &&
    this.startDate <= now &&
    this.endDate >= now;
});

// Virtual for days remaining
rentLockContractSchema.virtual('daysRemaining').get(function () {
  if (this.status !== 'active') return 0;
  const now = new Date();
  const end = new Date(this.endDate);
  const diff = end - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Method to check if contract can be renewed
rentLockContractSchema.methods.canRenew = function () {
  const now = new Date();
  const daysUntilExpiry = Math.ceil((new Date(this.endDate) - now) / (1000 * 60 * 60 * 24));
  return this.status === 'active' && daysUntilExpiry <= this.renewalNoticeDays;
};

// Method to check if both parties have signed
rentLockContractSchema.methods.isFullySigned = function () {
  return this.tenantSignature.signed && this.landlordSignature.signed;
};

const RentLockContract = mongoose.model("RentLockContract", rentLockContractSchema);

export default RentLockContract;

