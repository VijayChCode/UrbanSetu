import mongoose from "mongoose";

const cloudinaryAccountSchema = new mongoose.Schema({
  cloudName: {
    type: String,
    required: true,
    trim: true,
  },
  accountIndex: {
    type: Number,
    required: true,
    unique: true,
  },
  isFallback: {
    type: Boolean,
    default: false,
  },
  isEnabled: {
    type: Boolean,
    default: true,
  },
  // Lifetime counters
  uploadCount: {
    type: Number,
    default: 0,
  },
  totalBytesUploaded: {
    type: Number,
    default: 0,
  },
  lastUploadAt: {
    type: Date,
    default: null,
  },
  // Monthly counters (reset on 1st of each month)
  monthlyUploadCount: {
    type: Number,
    default: 0,
  },
  monthlyBytesUploaded: {
    type: Number,
    default: 0,
  },
  monthlyResetAt: {
    type: Date,
    default: () => new Date(),
  },
  // Failure tracking
  failureCount: {
    type: Number,
    default: 0,
  },
  lastFailureAt: {
    type: Date,
    default: null,
  },
  lastFailureMessage: {
    type: String,
    default: null,
  },
  // Admin notes
  notes: {
    type: String,
    default: '',
  },
  // ─── Real Cloudinary Usage (fetched from Cloudinary API) ───
  realCreditsUsed: {
    type: Number,
    default: 0,
  },
  realCreditsLimit: {
    type: Number,
    default: 25, // Free tier default
  },
  realCreditsUsedPercent: {
    type: Number,
    default: 0,
  },
  realBandwidthUsed: {
    type: Number, // bytes
    default: 0,
  },
  realBandwidthLimit: {
    type: Number,
    default: 0,
  },
  realStorageUsed: {
    type: Number, // bytes
    default: 0,
  },
  realStorageLimit: {
    type: Number,
    default: 0,
  },
  realTransformationsUsed: {
    type: Number,
    default: 0,
  },
  realTransformationsLimit: {
    type: Number,
    default: 0,
  },
  realUsageLastFetchedAt: {
    type: Date,
    default: null,
  },
  realUsageFetchError: {
    type: String,
    default: null,
  },
  // ─── Monthly Historical Records ───
  monthlyHistory: [
    {
      month: { type: String, required: true }, // e.g. "2026-08"
      uploadCount: { type: Number, default: 0 },
      bytesUploaded: { type: Number, default: 0 },
      realCreditsUsed: { type: Number, default: 0 },
      archivedAt: { type: Date, default: () => new Date() },
    }
  ],
}, { timestamps: true });

// Index for fast lookup of least-used enabled account
cloudinaryAccountSchema.index({ isEnabled: 1, monthlyUploadCount: 1 });
// Index for smart selection based on real credit usage
cloudinaryAccountSchema.index({ isEnabled: 1, realCreditsUsedPercent: 1 });

const CloudinaryAccount = mongoose.model("CloudinaryAccount", cloudinaryAccountSchema);

export default CloudinaryAccount;
