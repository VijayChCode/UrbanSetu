import mongoose from "mongoose";

const callHistorySchema = new mongoose.Schema({
  callId: { type: String, unique: true, required: true }, // Unique call ID
  appointmentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Booking', 
    required: true 
  },
  callerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  receiverId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  callType: { 
    type: String, 
    enum: ['audio', 'video'], 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['initiated', 'ringing', 'accepted', 'rejected', 'ended', 'missed', 'cancelled', 'waiting'], 
    default: 'initiated' 
  },
  // Link-based calling fields
  linkToken: { type: String },
  expiresAt: { type: Date },
  callMode: { type: String, enum: ['direct', 'link'], default: 'direct' },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  duration: { type: Number, default: 0 }, // Duration in seconds
  callerIP: { type: String },
  receiverIP: { type: String },
  // Optional: Record call (if legal)
  recordingUrl: { type: String },
  recordingEnabled: { type: Boolean, default: false },
  // Call quality metrics (optional)
  qualityMetrics: {
    averageLatency: Number,
    packetLoss: Number,
    jitter: Number
  },
  // Metadata
  callerDevice: String, // Browser, mobile app, etc.
  receiverDevice: String,
  endedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }, // Who ended the call
  // Admin notes
  adminNotes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for better performance
// Note: callId already has unique index from field definition (line 4: unique: true)
callHistorySchema.index({ appointmentId: 1, createdAt: -1 });
callHistorySchema.index({ callerId: 1, createdAt: -1 });
callHistorySchema.index({ receiverId: 1, createdAt: -1 });
callHistorySchema.index({ status: 1 });
callHistorySchema.index({ callType: 1 });
callHistorySchema.index({ linkToken: 1 }, { sparse: true });

// Pre-save middleware to update updatedAt
callHistorySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const CallHistory = mongoose.model("CallHistory", callHistorySchema);
export default CallHistory;

