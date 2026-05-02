import mongoose from "mongoose";
import crypto from "crypto";

const imageShareSchema = new mongoose.Schema({
    // Short unique token for the shareable URL (e.g., "iR9f2mQ")
    token: {
        type: String,
        required: true,
        unique: true,
        index: true,
        default: () => crypto.randomBytes(6).toString('base64url') // 8 chars, URL-safe
    },

    // The actual source image URL (hidden from the public)
    imageUrl: {
        type: String,
        required: true
    },

    // Optional: link back to the listing this image belongs to
    listingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Listing',
        default: null
    },

    // Who created the share link
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    // Optional expiry (null = never expires)
    expiresAt: {
        type: Date,
        default: null
    },

    // View analytics
    viewCount: {
        type: Number,
        default: 0
    },

    // Active/revoked status
    isActive: {
        type: Boolean,
        default: true
    },

    // Optional title for the image
    title: {
        type: String,
        default: 'UrbanSetu Image'
    }
}, {
    timestamps: true
});

// TTL index: automatically delete expired share links after their expiresAt date
imageShareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: "date" } } });

const ImageShare = mongoose.model('ImageShare', imageShareSchema);

export default ImageShare;
