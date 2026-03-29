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
            .sort({ createdAt: -1 });

        // Keep a raw listing ref and return effectivePriceAtAdd
        const response = wishlistItems.map((doc) => {
            const obj = doc.toObject({ virtuals: false });
            return {
                ...obj,
                listingIdRaw: obj.listingId?._id || doc.listingId,
            };
        });

        res.status(200).json(response);
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

        // Check if already in wishlist (double check before creating)
        const existingItem = await Wishlist.findOne({ userId, listingId });
        if (existingItem) {
            return res.status(200).json({
                success: true,
                message: "Item was already in your wishlist",
                wishlistItem: existingItem
            });
        }

        try {
            // Add to wishlist
            const effective = (listing.offer && listing.discountPrice) ? listing.discountPrice : listing.regularPrice;
            const wishlistItem = await Wishlist.create({
                userId,
                listingId,
                effectivePriceAtAdd: effective ?? null
            });
            await wishlistItem.populate('listingId');
            const obj = wishlistItem.toObject();
            res.status(201).json({
                success: true,
                message: "Added to wishlist successfully",
                wishlistItem: { ...obj, listingIdRaw: obj.listingId?._id || listingId }
            });
        } catch (error) {
            // Handle race condition where item was added between findOne and create
            if (error.code === 11000) {
                const item = await Wishlist.findOne({ userId, listingId }).populate('listingId');
                const obj = item.toObject();
                return res.status(200).json({
                    success: true,
                    message: "Item already in wishlist",
                    wishlistItem: { ...obj, listingIdRaw: obj.listingId?._id || listingId }
                });
            }
            throw error;
        }
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
        
        // Return success even if not found to make it idempotent
        if (!wishlistItem) {
            return res.status(200).json({
                success: true,
                message: "Property is not in your wishlist"
            });
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

// Get wishlist count for a specific property
export const getPropertyWishlistCount = async (req, res, next) => {
    try {
        const { listingId } = req.params;
        
        const count = await Wishlist.countDocuments({ listingId });
        
        res.status(200).json({
            success: true,
            count
        });
    } catch (error) {
        next(error);
    }
}; 