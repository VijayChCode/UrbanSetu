import { errorHandler } from "../utils/error.js";
import Wishlist from "../models/wishlist.model.js";
import Listing from "../models/listing.model.js";

// Get user's wishlist
export const getUserWishlist = async (req, res, next) => {
    try {
        const { userId } = req.params;
        
        // Verify the user is requesting their own wishlist
        if (req.user._id.toString() !== userId) {
            return next(errorHandler(403, "You can only view your own wishlist"));
        }

        const wishlistItems = await Wishlist.find({ userId })
            .populate('listingId')
            .sort({ addedAt: -1 });

        res.status(200).json(wishlistItems);
    } catch (error) {
        next(error);
    }
};

// Add item to wishlist
export const addToWishlist = async (req, res, next) => {
    try {
        const { listingId } = req.body;
        const userId = req.user._id;

        // Check if listing exists
        const listing = await Listing.findById(listingId);
        if (!listing) {
            return next(errorHandler(404, "Listing not found"));
        }

        // Check if already in wishlist
        const existingItem = await Wishlist.findOne({ userId, listingId });
        if (existingItem) {
            return next(errorHandler(400, "Item already in wishlist"));
        }

        // Add to wishlist
        const wishlistItem = new Wishlist({
            userId,
            listingId
        });

        await wishlistItem.save();

        // Populate the listing details
        await wishlistItem.populate('listingId');

        res.status(201).json({
            success: true,
            message: "Added to wishlist successfully",
            wishlistItem
        });
    } catch (error) {
        next(error);
    }
};

// Remove item from wishlist
export const removeFromWishlist = async (req, res, next) => {
    try {
        const { listingId } = req.params;
        const userId = req.user._id;

        const wishlistItem = await Wishlist.findOneAndDelete({ userId, listingId });
        
        if (!wishlistItem) {
            return next(errorHandler(404, "Item not found in wishlist"));
        }

        res.status(200).json({
            success: true,
            message: "Removed from wishlist successfully"
        });
    } catch (error) {
        next(error);
    }
};

// Check if item is in wishlist
export const checkWishlistStatus = async (req, res, next) => {
    try {
        const { listingId } = req.params;
        const userId = req.user._id;

        const wishlistItem = await Wishlist.findOne({ userId, listingId });
        
        res.status(200).json({
            isInWishlist: !!wishlistItem
        });
    } catch (error) {
        next(error);
    }
};

// Get wishlist count for user
export const getWishlistCount = async (req, res, next) => {
    try {
        const userId = req.user._id;
        
        const count = await Wishlist.countDocuments({ userId });
        
        res.status(200).json({
            count
        });
    } catch (error) {
        next(error);
    }
}; 