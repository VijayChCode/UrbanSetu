import mongoose from 'mongoose';

const deploymentSchema = new mongoose.Schema({
    platform: {
        type: String,
        required: true,
        enum: ['android', 'ios', 'windows', 'macos'],
        trim: true,
    },
    version: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        default: '',
    },
    url: {
        type: String,
        required: true,
    },
    fileKey: {
        type: String,
        required: true,
    },
    size: {
        type: Number,
        required: true,
    },
    format: {
        type: String,
        trim: true,
    },
    isActive: {
        type: Boolean,
        default: false,
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});

// Index to ensure unique combination of platform and version
deploymentSchema.index({ platform: 1, version: 1 }, { unique: true });

const Deployment = mongoose.model('Deployment', deploymentSchema);

export default Deployment;
