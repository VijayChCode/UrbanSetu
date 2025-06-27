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
      timestamp: { type: Date, default: Date.now }
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
  reinitiationCount: { type: Number, default: 0 },
  reinitiationHistory: [
    {
      date: Date,
      time: String,
      message: String,
      timestamp: { type: Date, default: Date.now },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  ],
});

const booking = mongoose.model("Booking", bookingSchema);

export default booking;
