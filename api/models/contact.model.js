import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
    ticketId: {
        type: String,
        unique: true,
        required: true,
        trim: true
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
    },
    attachments: {
        type: [String],
        default: []
    },
    // Soft deletion flags for independent user and admin deletion
    deletedByUser: {
        type: Boolean,
        default: false
    },
    deletedByUserAt: {
        type: Date,
        default: null
    },
    deletedByAdmin: {
        type: Boolean,
        default: false
    },
    deletedByAdminAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

// Indexes for optimized query performance
contactSchema.index({ email: 1, deletedByUser: 1, createdAt: -1 });
contactSchema.index({ deletedByAdmin: 1, status: 1, createdAt: -1 });

// Static method to generate unique ticket ID in format TKT-XXXXX
contactSchema.statics.generateTicketId = async function () {
    try {
        // Query recent tickets to find the highest existing numeric suffix
        const recentTickets = await this.find({ ticketId: { $regex: /^TKT-\d+/i } })
            .sort({ createdAt: -1, _id: -1 })
            .limit(100)
            .select('ticketId')
            .lean();

        let maxNum = 0;
        for (const t of recentTickets) {
            if (t.ticketId) {
                const match = t.ticketId.match(/^TKT-(\d+)/i);
                if (match && match[1]) {
                    const num = parseInt(match[1], 10);
                    if (!isNaN(num) && num > maxNum) {
                        maxNum = num;
                    }
                }
            }
        }

        // Compare with total document count as an additional baseline
        const totalDocs = await this.countDocuments();
        let nextNum = Math.max(maxNum + 1, totalDocs + 1, 1);

        // Ensure absolute uniqueness
        let ticketId = `TKT-${String(nextNum).padStart(5, '0')}`;
        let exists = await this.exists({ ticketId });
        while (exists) {
            nextNum++;
            ticketId = `TKT-${String(nextNum).padStart(5, '0')}`;
            exists = await this.exists({ ticketId });
        }

        return ticketId;
    } catch (error) {
        console.error('Error generating ticket ID:', error);
        // Fallback to random 5-digit format if error occurs
        const randomNum = Math.floor(10000 + Math.random() * 90000);
        return `TKT-${randomNum}`;
    }
};

const Contact = mongoose.model('Contact', contactSchema);

export default Contact;
