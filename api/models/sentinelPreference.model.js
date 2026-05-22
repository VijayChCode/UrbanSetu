import mongoose from "mongoose";

const sentinelInteractionSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Listing ID (stored as string for flexibility)
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  type: { type: String, default: '' },
  price: { type: Number, default: 0 },
  bedrooms: { type: Number, default: 0 },
  bathrooms: { type: Number, default: 0 },
  area: { type: Number, default: 0 },
  parking: { type: Boolean, default: false },
  furnished: { type: Boolean, default: false },
  gym: { type: Boolean, default: false },
  swimmingPool: { type: Boolean, default: false },
  security: { type: Boolean, default: false },
  wifi: { type: Boolean, default: false },
  garden: { type: Boolean, default: false },
  lift: { type: Boolean, default: false },
  interactionType: {
    type: String,
    enum: ['view', 'wishlist', 'watchlist'],
    default: 'view'
  },
  timestamp: { type: Number, required: true }
}, { _id: false }); // Disable auto _id since we use the listing ID

const sentinelPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
    index: true
  },
  interactions: {
    type: [sentinelInteractionSchema],
    default: [],
    validate: {
      validator: function (v) {
        return v.length <= 30; // Match MAX_INTERACTIONS from frontend
      },
      message: 'Interactions array cannot exceed 30 entries'
    }
  }
}, { timestamps: true });

const SentinelPreference = mongoose.model("SentinelPreference", sentinelPreferenceSchema);

export default SentinelPreference;
