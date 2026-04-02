import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    index: false // Explicitly prevent index creation (username should NOT be unique)
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  mobileNumber: {
    type: String,
    required: false, // Not required for any account type
    unique: true,
    sparse: true, // Allows multiple null values for unique constraint
    validate: {
      validator: function (v) {
        // If mobile number is provided, validate 10-digit format
        if (!v) return true; // Allow empty
        return /^[0-9]{10}$/.test(v);
      },
      message: props => `${props.value} is not a valid 10-digit mobile number!`
    }
  },
  address: {
    type: String,
    required: false,
    trim: true
  },
  gender: {
    type: String,
    enum: ["male", "female", "other", "prefer-not-to-say"],
    required: false
  },
  isGeneratedMobile: {
    type: Boolean,
    default: false
  },
  avatar: {
    type: String,
    default:
      "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"
  },
  role: {
    type: String,
    enum: ["user", "admin", "rootadmin"],
    default: "user"
  },
  isDefaultAdmin: {
    type: Boolean,
    default: false
  },
  adminApprovalStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },
  adminApprovalDate: {
    type: Date
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  adminRequestDate: {
    type: Date,
    default: Date.now
  },
  resetToken: {
    type: String
  },
  resetTokenExpiry: {
    type: Date
  },
  passwordHistory: [
    {
      hashedPassword: { type: String, required: true },
      changedAt: { type: Date, default: Date.now },
      ip: { type: String },
      device: { type: String }
    }
  ],
  emailHistory: [
    {
      email: { type: String, required: true },
      changedAt: { type: Date, default: Date.now },
      ip: { type: String },
      device: { type: String }
    }
  ],
  status: {
    type: String,
    enum: ["active", "suspended"],
    default: "active"
  },
  suspendedAt: {
    type: Date,
    default: null
  },
  suspendedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  activeSessions: [
    {
      sessionId: {
        type: String,
        required: true
      },
      ip: {
        type: String,
        required: true
      },
      device: {
        type: String,
        required: true
      },
      location: {
        type: String,
        required: false
      },
      loginTime: {
        type: Date,
        default: Date.now
      },
      lastActive: {
        type: Date,
        default: Date.now
      },
      expiresAt: {
        type: Date
      }
    }
  ],
  lastKnownIp: {
    type: String,
    default: null
  },
  lastKnownDevice: {
    type: String,
    default: null
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  lastLoginLocation: {
    type: String,
    default: null
  },
  lastReEngagementEmailSent: {
    type: Date,
    default: null
  },

  profileVisibility: {
    type: String,
    enum: ['public', 'private', 'friends'],
    default: 'public'
  },

  // User Preferences & Settings
  settings: {
    emailNotifications: { type: Boolean, default: true },
    inAppNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    // Granular categories
    marketingNotifications: { type: Boolean, default: true },
    propertyAlerts: { type: Boolean, default: true },
    bookingUpdates: { type: Boolean, default: true },
    communitySocial: { type: Boolean, default: true },
    securityAlerts: { type: Boolean, default: true },
    chatMessages: { type: Boolean, default: true },

    notificationSound: { type: String, default: 'default' },
    showEmail: { type: Boolean, default: false },
    showPhone: { type: Boolean, default: false },
    dataSharing: { type: Boolean, default: true },
    allowLocationAccess: { type: Boolean, default: false },
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    dateFormat: { type: String, default: 'MM/DD/YYYY' },
    theme: { type: String, default: 'light' },
    fontSize: { type: String, default: 'medium' },
    pushTokens: [{
      token: { type: String, required: true },
      deviceName: { type: String },
      installationId: { type: String },
      lastUsed: { type: Date, default: Date.now }
    }],
    biometricAuth: { type: Boolean, default: false },
    biometricLockPeriod: { type: Number, default: 0 },
    batteryOptimization: { type: Boolean, default: false },
  },

  // Rental Profile
  rentalProfile: {
    isTenant: {
      type: Boolean,
      default: false
    },
    isLandlord: {
      type: Boolean,
      default: false
    },
    activeContractsAsTenant: {
      type: Number,
      default: 0,
      min: 0
    },
    activeContractsAsLandlord: {
      type: Number,
      default: 0,
      min: 0
    },
    totalRentPaid: {
      type: Number,
      default: 0,
      min: 0
    },
    totalRentReceived: {
      type: Number,
      default: 0,
      min: 0
    },
    averageTenantRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    averageLandlordRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    verifiedLandlord: {
      type: Boolean,
      default: false,
      index: true
    }
  },

  // Gamification & Loyalty (SetuCoins)
  gamification: {
    setuCoinsBalance: {
      type: Number,
      default: 0,
      min: 0
    },
    totalCoinsEarned: { // Lifetime earnings
      type: Number,
      default: 0
    },
    currentStreak: { // Consecutive months of rent payments
      type: Number,
      default: 0
    },
    lastRentPaymentDate: {
      type: Date,
      default: null
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    hasReceivedProfileCompletionBonus: {
      type: Boolean,
      default: false
    },
    // Expiry Tracking
    lastCoinTransaction: {
      type: Date,
      default: null
    },
    coinsExpiryDate: {
      type: Date,
      default: null
    },
    frozenCoins: { // Amount lost due to expiry
      type: Number,
      default: 0
    }
  },

  // Auto-debit Settings
  autoDebitSettings: {
    enabled: {
      type: Boolean,
      default: false
    },
    defaultMethod: {
      type: String,
      enum: ['razorpay', 'paypal', 'bank_account', 'upi'],
      default: null
    },
    defaultDay: {
      type: Number, // Day of month (1-31)
      min: 1,
      max: 31,
      default: 1
    }
  },
  yearInReviewSent: {
    type: [Number], // Array of years for which review has been sent
    default: []
  },
  festivalGreetingsSent: [{
    year: Number,
    festivalId: String,
    sentAt: { type: Date, default: Date.now }
  }],
  // Security Lock Fields
  securityLockToken: { type: String, select: false },
  securityLockExpires: { type: Date, select: false },
  securityUnlockToken: { type: String, select: false },
  securityUnlockExpires: { type: Date, select: false },
  isLocked: {
    type: Boolean,
    default: false
  },
  lockReason: {
    type: String,
    default: null
  },
  isSubscribed: {
    type: Boolean,
    default: true
  },
  unsubscribeReason: {
    type: String,
    default: null
  },
  unsubscribeToken: {
    type: String,
    select: false
  },
  // Temporary Subscription Fields
  tempSubscriptionOtp: {
    type: String,
    select: false
  },
  tempSubscriptionOtpExpires: {
    type: Date,
    select: false
  },
  tempSubscriptionType: {
    type: String,
    enum: ['blog', 'guide'],
    select: false
  },
  tempSubscriptionSource: {
    type: String,
    select: false
  },
  aiUsage: {
    totalPromptTokens: { type: Number, default: 0 },
    totalCompletionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    lastUsed: { type: Date, default: null }
  },
  policyViolations: {
    type: Number,
    default: 0
  },
  cooldownEnd: {
    type: Date,
    default: null
  },
  lastViolationAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

export default User;
