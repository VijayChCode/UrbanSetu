import mongoose from 'mongoose';

const sharedChatSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    originalChatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChatHistory',
        required: true
    },
    originalSessionId: {
        type: String, // Storing for easy lookup
        required: true
    },
    shareToken: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    title: {
        type: String,
        default: 'Shared Chat'
    },
    messages: [{
        role: {
            type: String,
            enum: ['user', 'assistant'],
            required: true
        },
        content: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        isRestricted: {
            type: Boolean,
            default: false
        },
        recommendations: {
            type: Array,
            default: undefined
        },
        variants: [{
            content: String,
            role: String,
            recommendations: Array,
            isError: Boolean,
            isRestricted: Boolean,
            timestamp: { type: Date, default: Date.now },
            tail: { type: Array, default: [] }
        }],
        activeVersionIndex: {
            type: Number,
            default: 0
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    expiresAt: {
        type: Date,
        default: null // null means never expires
    },
    views: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index for automatic deletion if we wanted TTL, but we are doing soft expiring/logic checks mostly.
// However, a TTL index on `expiresAt` is useful if we want auto-removal. 
// For now, we'll keep the data and just show "Expired" on the frontend/backend check.

const SharedChat = mongoose.model('SharedChat', sharedChatSchema);

export default SharedChat;
