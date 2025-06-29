import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['unread', 'read', 'replied'],
        default: 'unread'
    },
    // Reply fields
    adminReply: {
        type: String,
        trim: true,
        default: null
    },
    adminReplyAt: {
        type: Date,
        default: null
    },
    adminRepliedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    readAt: {
        type: Date,
        default: null
    },
    repliedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

const Contact = mongoose.model('Contact', contactSchema);

export default Contact; 