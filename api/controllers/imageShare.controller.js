    import mongoose from 'mongoose';
import ImageShare from "../models/imageShare.model.js";
import Listing from "../models/listing.model.js";
import { errorHandler } from "../utils/error.js";

/**
 * Create a share link for an image URL
 * POST /api/image/share
 * Body: { imageUrl, listingId?, title?, expiresInHours? }
 */
export const createShareLink = async (req, res, next) => {
    try {
        const { imageUrl, listingId, title, expiresInHours } = req.body;

        if (!imageUrl) {
            return next(errorHandler(400, "Image URL is required"));
        }

        // Validate the image URL format
        if (!imageUrl.startsWith('http')) {
            return next(errorHandler(400, "Invalid image URL"));
        }

        // If listingId provided, verify the listing exists and has this image
        let finalListingId = null;
        if (listingId && mongoose.Types.ObjectId.isValid(listingId)) {
            try {
                const listing = await Listing.findById(listingId);
                if (listing && listing.imageUrls?.includes(imageUrl)) {
                    finalListingId = listingId;
                }
            } catch (err) {
                // Ignore finding errors to avoid blocking the share link creation
            }
        }

        // Check if a share already exists for this image URL (one permanent link per image)
        const existingShare = await ImageShare.findOne({
            imageUrl,
            isActive: true,
            $or: [
                { expiresAt: null },
                { expiresAt: { $gt: new Date() } }
            ]
        });

        if (existingShare) {
            return res.status(200).json({
                success: true,
                token: existingShare.token,
                shareUrl: `/i/${existingShare.token}`,
                existingShare: true,
                expiresAt: existingShare.expiresAt,
                viewCount: existingShare.viewCount
            });
        }

        // Create new share
        const shareData = {
            imageUrl,
            listingId: finalListingId,
            createdBy: req.user?.id || null,
            title: title || 'UrbanSetu Image'
        };

        // Set optional expiry
        if (expiresInHours && expiresInHours > 0) {
            shareData.expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
        }

        const imageShare = new ImageShare(shareData);
        await imageShare.save();

        res.status(201).json({
            success: true,
            token: imageShare.token,
            shareUrl: `/i/${imageShare.token}`,
            expiresAt: imageShare.expiresAt
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Resolve a share token to get the actual image URL
 * GET /api/image/resolve/:token
 * Public endpoint — no auth required
 */
export const resolveShareLink = async (req, res, next) => {
    try {
        const { token } = req.params;

        if (!token) {
            return next(errorHandler(400, "Token is required"));
        }

        const imageShare = await ImageShare.findOne({ token, isActive: true });

        if (!imageShare) {
            return next(errorHandler(404, "Image link not found or has been revoked"));
        }

        // Check expiry
        if (imageShare.expiresAt && imageShare.expiresAt < new Date()) {
            return next(errorHandler(410, "This image link has expired"));
        }

        // Increment view count (fire-and-forget)
        ImageShare.updateOne({ _id: imageShare._id }, { $inc: { viewCount: 1 } }).catch(() => {});

        res.status(200).json({
            success: true,
            imageUrl: imageShare.imageUrl,
            title: imageShare.title,
            listingId: imageShare.listingId,
            viewCount: imageShare.viewCount + 1
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Revoke a share link (creator or admin only)
 * DELETE /api/image/share/:token
 */
export const revokeShareLink = async (req, res, next) => {
    try {
        const { token } = req.params;

        const imageShare = await ImageShare.findOne({ token });

        if (!imageShare) {
            return next(errorHandler(404, "Share link not found"));
        }

        // Only the creator or admin can revoke
        const isAdmin = req.user.role === 'admin' || req.user.role === 'rootadmin';
        const isCreator = imageShare.createdBy?.toString() === req.user.id;

        if (!isAdmin && !isCreator) {
            return next(errorHandler(403, "You can only revoke your own share links"));
        }

        imageShare.isActive = false;
        await imageShare.save();

        res.status(200).json({
            success: true,
            message: "Share link revoked successfully"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all share links created by the current user
 * GET /api/image/my-shares
 */
export const getMyShares = async (req, res, next) => {
    try {
        const shares = await ImageShare.find({ createdBy: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50)
            .select('token imageUrl title viewCount isActive expiresAt createdAt listingId');

        res.status(200).json({
            success: true,
            shares
        });
    } catch (error) {
        next(error);
    }
};
