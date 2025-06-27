import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    listingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Listing',
        required: true
    },
    addedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Compound index to ensure a user can't add the same listing twice
wishlistSchema.index({ userId: 1, listingId: 1 }, { unique: true });

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

export default Wishlist; 