import mongoose from "mongoose";

const policyViolationSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  violations: {
    type: Number,
    default: 0
  },
  cooldownEnd: {
    type: Date,
    default: null
  },
  lastViolation: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Auto-cleanup of stale records after 30 days
policyViolationSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

const PolicyViolation = mongoose.model("PolicyViolation", policyViolationSchema);

export default PolicyViolation;
