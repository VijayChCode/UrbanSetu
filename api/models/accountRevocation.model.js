import mongoose from 'mongoose';

const accountRevocationSchema = new mongoose.Schema({
  accountId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  email: { 
    type: String, 
    required: true, 
    lowercase: true, 
    index: true 
  },
  username: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['user', 'admin', 'rootadmin'], 
    required: true 
  },
  revocationToken: { 
    type: String, 
    required: true, 
    unique: true
  },
  deletedAt: { 
    type: Date, 
    default: Date.now, 
    index: true 
  },
  expiresAt: { 
    type: Date, 
    required: true 
  },
  isUsed: { 
    type: Boolean, 
    default: false 
  },
  usedAt: { 
    type: Date, 
    default: null 
  },
  restoredAt: { 
    type: Date, 
    default: null 
  },
  restoredBy: { 
    type: String, 
    default: null,
    enum: ['user_link', 'admin_manual', 'signup_restore', 'expired_by_new_signup', 'signup_restore_cleanup', null]
  },
  originalData: { 
    type: mongoose.Schema.Types.Mixed, 
    required: true 
  },
  reason: { 
    type: String, 
    default: '' 
  }
}, { 
  timestamps: true 
});

// Index for cleanup of expired tokens
accountRevocationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AccountRevocation = mongoose.model('AccountRevocation', accountRevocationSchema);
export default AccountRevocation;
