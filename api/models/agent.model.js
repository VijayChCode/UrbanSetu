import mongoose from "mongoose";

const agentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true
    },
    mobileNumber: {
        type: String,
        required: true,
        trim: true
    },
    city: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    areas: [{
        type: String,
        trim: true
    }], // List of areas served
    experience: {
        type: Number,
        default: 0,
        min: 0
    },
    about: {
        type: String,
        maxLength: 1000
    },
    reraId: {
        type: String,
        trim: true
    },
    agencyName: {
        type: String,
        trim: true
    },
    photo: {
        type: String,
        default: "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"
    },
    idProof: {
        type: String,
        required: false // Can be required depending on validation strictness
    },

    // Trust & Reputation
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    reviewCount: {
        type: Number,
        default: 0
    },
    isVerified: {
        type: Boolean,
        default: false
    },

    // Admin / Workflow status
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
        index: true
    },
    rejectionReason: {
        type: String
    },
    revokedAt: {
        type: Date,
        default: null
    },
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    processedAt: {
        type: Date,
        default: null
    },

    // Performance (Admin internal)
    leadsReceived: {
        type: Number,
        default: 0
    },
    propertiesListed: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Text indices for robust searching
agentSchema.index({ name: 'text', city: 'text', areas: 'text', agencyName: 'text' });

const Agent = mongoose.model("Agent", agentSchema);

export default Agent;
