import mongoose from 'mongoose';

const deletedAccountSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, index: true },
  role: { type: String, enum: ['user', 'admin', 'rootadmin'], required: true, index: true },
  deletedAt: { type: Date, default: Date.now, index: true },
  deletedBy: { type: mongoose.Schema.Types.Mixed, required: true }, // ObjectId of admin/rootadmin or string 'self'
  originalData: { type: mongoose.Schema.Types.Mixed },
  reason: { type: String, default: '' },
  // Softban policy fields
  policy: {
    type: new mongoose.Schema({
      category: { type: String, enum: ['fraud', 'duplicate', 'inappropriate', 'policy_violation', 'requested_by_user', 'other', 'misuse_privileges', 'inactive_admin', 'violation_trust', 'role_restructure', 'inactive_auto'], default: 'other' },
      banType: { type: String, enum: ['ban', 'allow'], default: 'allow' }, // ban => block signup, allow => re-signup allowed
      allowResignupAfterDays: { type: Number, default: 0 }, // 0 for immediate
      notes: { type: String, default: '' }
    }, { _id: false }),
    default: undefined
  },
  // Purge metadata (if later permanently deleted)
  purgedAt: { type: Date, default: null },
  purgedBy: { type: mongoose.Schema.Types.Mixed, default: null } // ObjectId of admin or string like 'signup_replacement'
}, { timestamps: true });

const DeletedAccount = mongoose.model('DeletedAccount', deletedAccountSchema);
export default DeletedAccount;

