import mongoose from 'mongoose';

const imageFavoriteSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    imageUrl: {
        type: String,
        required: true,
        trim: true
    },
    imageId: {
        type: String,
        required: true,
        trim: true
    },
    listingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Listing',
        required: false // Optional, in case image is not from a listing
    },
    metadata: {
        imageName: String,
        imageType: String,
        imageSize: Number,
        addedFrom: {
            type: String,
            enum: ['listing', 'appointment', 'chat', 'blog', 'preview', 'bulk', 'other'],
            default: 'other'
        }
    },
    addedAt: {
        type: Date,
        default: Date.now
    }
}, { 
    timestamps: true 
});

// Compound index to ensure a user can't favorite the same image twice
imageFavoriteSchema.index({ userId: 1, imageId: 1 }, { unique: true });

// Index for faster queries by user
imageFavoriteSchema.index({ userId: 1, addedAt: -1 });

// Index for faster queries by listing
imageFavoriteSchema.index({ listingId: 1 });

const ImageFavorite = mongoose.model('ImageFavorite', imageFavoriteSchema);

export default ImageFavorite;