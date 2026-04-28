import mongoose from "mongoose";

const sentinelAlertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false
  },
  listingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Listing",
    required: false
  },
  type: {
    type: String,
    enum: ["fraud_listing", "security_anomaly", "wallet_anomaly", "policy_violation"],
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium"
  },
  reason: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  status: {
    type: String,
    enum: ["pending", "reviewed", "resolved", "dismissed"],
    default: "pending",
    index: true
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  resolvedAt: {
    type: Date
  }
}, { timestamps: true });

// Index for real-time dashboard performance
sentinelAlertSchema.index({ createdAt: -1 });

const SentinelAlert = mongoose.model("SentinelAlert", sentinelAlertSchema);

export default SentinelAlert;
