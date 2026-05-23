import mongoose from 'mongoose';
import { errorHandler } from "../utils/error.js";
import ImageFavorite from "../models/imageFavorite.model.js";
import Listing from "../models/listing.model.js";

// Get user's favorite images
export const getUserImageFavorites = async (req, res, next) => {
    try {
        const { userId } = req.params;
        
        // Verify the user is requesting their own favorites
        if (req.user._id.toString() !== userId) {
            return next(errorHandler(403, "You can only view your own favorites"));
        }

        const favorites = await ImageFavorite.find({ userId })
            .populate('listingId', 'name type address')
            .sort({ addedAt: -1 });

        res.status(200).json({
            success: true,
            favorites,
            count: favorites.length
        });
    } catch (error) {
        next(error);
    }
};

// Add image to favorites
export const addImageToFavorites = async (req, res, next) => {
    try {
        const { imageUrl, imageId, listingId, metadata } = req.body;
        const userId = req.user._id;

        // Validate required fields
        if (!imageUrl || !imageId) {
            return next(errorHandler(400, "Image URL and Image ID are required"));
        }

        // Validate and check if listing exists (if provided)
        let finalListingId = null;
        if (listingId && mongoose.Types.ObjectId.isValid(listingId)) {
            try {
                const listing = await Listing.findById(listingId);
                if (listing) {
                    finalListingId = listingId;
                }
            } catch (err) {
                // Ignore finding/casting errors to remain independent of listing status
            }
        }

        // Check if already favorited
        const existingFavorite = await ImageFavorite.findOne({ userId, imageId });
        if (existingFavorite) {
            return next(errorHandler(400, "Image already in favorites"));
        }

        // Create favorite entry
        const imageFavorite = new ImageFavorite({
            userId,
            imageUrl,
            imageId,
            listingId: finalListingId,
            metadata: {
                imageName: metadata?.imageName || `image-${Date.now()}`,
                imageType: metadata?.imageType || 'unknown',
                imageSize: metadata?.imageSize || 0,
                addedFrom: metadata?.addedFrom || 'other'
            }
        });

        await imageFavorite.save();

        // Populate listing details if available and valid
        if (finalListingId) {
            await imageFavorite.populate('listingId', 'name type address');
        }

        res.status(201).json({
            success: true,
            message: "Image added to favorites successfully",
            favorite: imageFavorite
        });
    } catch (error) {
        if (error.code === 11000) {
            // Duplicate key error
            return next(errorHandler(400, "Image already in favorites"));
        }
        next(error);
    }
};

// Remove image from favorites
export const removeImageFromFavorites = async (req, res, next) => {
    try {
        const { imageId } = req.params;
        const userId = req.user._id;

        const favorite = await ImageFavorite.findOneAndDelete({ userId, imageId });
        
        if (!favorite) {
            return next(errorHandler(404, "Image not found in favorites"));
        }

        res.status(200).json({
            success: true,
            message: "Image removed from favorites successfully"
        });
    } catch (error) {
        next(error);
    }
};

// Check if image is in favorites
export const checkImageFavoriteStatus = async (req, res, next) => {
    try {
        const { imageId } = req.params;
        const userId = req.user._id;

        const favorite = await ImageFavorite.findOne({ userId, imageId });
        
        res.status(200).json({
            success: true,
            isFavorite: !!favorite,
            favoriteId: favorite?._id || null
        });
    } catch (error) {
        next(error);
    }
};

// Get favorites count for user
export const getImageFavoritesCount = async (req, res, next) => {
    try {
        const userId = req.user._id;
        
        const count = await ImageFavorite.countDocuments({ userId });
        
        res.status(200).json({
            success: true,
            count
        });
    } catch (error) {
        next(error);
    }
};

// Get favorites by listing
export const getFavoritesByListing = async (req, res, next) => {
    try {
        const { listingId } = req.params;
        const userId = req.user._id;

        // Verify the user is requesting their own favorites
        if (req.user._id.toString() !== userId) {
            return next(errorHandler(403, "You can only view your own favorites"));
        }

        const favorites = await ImageFavorite.find({ userId, listingId })
            .sort({ addedAt: -1 });

        res.status(200).json({
            success: true,
            favorites,
            count: favorites.length
        });
    } catch (error) {
        next(error);
    }
};

// Bulk add images to favorites
export const bulkAddToFavorites = async (req, res, next) => {
    try {
        const { images } = req.body;
        const userId = req.user._id;

        if (!Array.isArray(images) || images.length === 0) {
            return next(errorHandler(400, "Images array is required"));
        }

        const favoritePromises = images.map(async (image) => {
            const { imageUrl, imageId, listingId, metadata } = image;

            // Skip if already exists
            const existing = await ImageFavorite.findOne({ userId, imageId });
            if (existing) return null;

            const finalListingId = (listingId && mongoose.Types.ObjectId.isValid(listingId)) ? listingId : null;

            return new ImageFavorite({
                userId,
                imageUrl,
                imageId,
                listingId: finalListingId,
                metadata: {
                    imageName: metadata?.imageName || `image-${Date.now()}`,
                    imageType: metadata?.imageType || 'unknown',
                    imageSize: metadata?.imageSize || 0,
                    addedFrom: metadata?.addedFrom || 'other'
                }
            });
        });

        const favorites = (await Promise.all(favoritePromises)).filter(Boolean);
        
        if (favorites.length > 0) {
            await ImageFavorite.insertMany(favorites);
        }

        res.status(201).json({
            success: true,
            message: `${favorites.length} images added to favorites`,
            addedCount: favorites.length,
            skippedCount: images.length - favorites.length
        });
    } catch (error) {
        next(error);
    }
};

// Bulk remove images from favorites
export const bulkRemoveFromFavorites = async (req, res, next) => {
    try {
        const { imageIds } = req.body;
        const userId = req.user._id;

        if (!Array.isArray(imageIds) || imageIds.length === 0) {
            return next(errorHandler(400, "Image IDs array is required"));
        }

        const result = await ImageFavorite.deleteMany({ 
            userId, 
            imageId: { $in: imageIds } 
        });

        res.status(200).json({
            success: true,
            message: `${result.deletedCount} images removed from favorites`,
            removedCount: result.deletedCount
        });
    } catch (error) {
        next(error);
    }
};