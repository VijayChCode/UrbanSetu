import mongoose from 'mongoose';

const platformUpdateSchema = new mongoose.Schema({
    version: {
        type: String,
        required: true,
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['feature', 'new_feature', 'improvement', 'fix', 'bug_fix', 'announcement'],
        default: 'new_feature'
    },
    tags: [{
        type: String,
        trim: true
    }],
    imageUrls: [{
        type: String,
        trim: true
    }],
    videoUrls: [{
        type: String,
        trim: true
    }],
    actionUrl: {
        type: String,
        trim: true,
        default: ''
    },
    releaseDate: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    },
    scheduledAt: {
        type: Date,
        default: null
    },
    publishedAt: {
        type: Date,
        default: null
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Index for efficient querying by date
platformUpdateSchema.index({ releaseDate: -1 });
// Index for efficient scheduled update queries (used by cron job)
platformUpdateSchema.index({ isActive: 1, scheduledAt: 1 });

const PlatformUpdate = mongoose.model('PlatformUpdate', platformUpdateSchema);

export default PlatformUpdate;
