import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  date: Date,
  time: String,
  message: String,
  listingId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Listing',
    required: true 
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  purpose: {
    type: String,
    enum: ["buy", "rent"],
    required: true
  },
  propertyName: {
    type: String,
    required: true
  },
  propertyDescription: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: [
      "pending", "accepted", "rejected", "deletedByAdmin",
      "cancelledByBuyer", "cancelledBySeller", "cancelledByAdmin", "completed", "noShow"
    ],
    default: "pending"
  },
  cancelReason: String,
  cancelledBy: {
    type: String,
    enum: ["buyer", "seller", "admin", "rootadmin"]
  },
  adminNote: String,
  completedAt: Date,
  noShow: { type: Boolean, default: false },
  noShowNote: String,
  permanentlyDeleted: { type: Boolean, default: false },
  adminComment: {
    type: String,
    default: ""
  },
  comments: [
    {
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      senderEmail: String,
      message: String,
      originalMessage: String, // Preserve original content when deleted
      originalImageUrl: String, // Preserve original image URL when deleted
      timestamp: { type: Date, default: Date.now },
      status: { type: String, default: "sent" },
      readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      deleted: { type: Boolean, default: false },
      deletedBy: String, // Email of who deleted the message
      deletedAt: Date, // When the message was deleted
      edited: { type: Boolean, default: false },
      editedAt: { type: Date },
      replyTo: { type: mongoose.Schema.Types.ObjectId, default: null },
      // New: per-user local deletion persistence
      removedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      // Message delivery and read timestamps
      deliveredAt: { type: Date, default: null },
      readAt: { type: Date, default: null },
      // Starred messages tracking
      starredBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      // Image message support
      imageUrl: { type: String, default: null },
      type: { type: String, enum: ['text', 'image'], default: 'text' },
      // Message pinning functionality
      pinned: { type: Boolean, default: false },
      pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      pinnedAt: { type: Date, default: null },
      pinExpiresAt: { type: Date, default: null },
      pinDuration: { type: String, enum: ['24hrs', '7days', '30days', 'custom'], default: null },
    }
  ],
  chat: [
    {
      sender: String, // 'user' or 'admin'
      message: String,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  visibleToBuyer: { type: Boolean, default: true },
  visibleToSeller: { type: Boolean, default: true },
  archivedByAdmin: { type: Boolean, default: false },
  archivedAt: {
    type: Date
  },
  // User-specific archiving
  archivedByBuyer: { type: Boolean, default: false },
  archivedBySeller: { type: Boolean, default: false },
  buyerArchivedAt: { type: Date, default: null },
  sellerArchivedAt: { type: Date, default: null },
  reinitiationCount: { type: Number, default: 0 },
  buyerReinitiationCount: { type: Number, default: 0 },
  sellerReinitiationCount: { type: Number, default: 0 },
  reinitiationHistory: [
    {
      date: Date,
      time: String,
      message: String,
      timestamp: { type: Date, default: Date.now },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  ],
  buyerChatClearedAt: { type: Date, default: null },
  sellerChatClearedAt: { type: Date, default: null },
  // Chat lock functionality
  buyerChatLocked: { type: Boolean, default: false },
  sellerChatLocked: { type: Boolean, default: false },
  buyerChatPassword: { type: String, default: null },
  sellerChatPassword: { type: String, default: null },
  // Temporary access tracking (doesn't persist - only for current session)
  buyerChatAccessGranted: { type: Boolean, default: false },
  sellerChatAccessGranted: { type: Boolean, default: false },
});

const booking = mongoose.model("Booking", bookingSchema);

export default booking;
