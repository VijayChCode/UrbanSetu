import VideoShare from "../models/videoShare.model.js";
import Listing from "../models/listing.model.js";
import { errorHandler } from "../utils/error.js";

/**
 * Create a share link for a video URL
 * POST /api/video/share
 * Body: { videoUrl, listingId?, title?, expiresInHours? }
 */
export const createShareLink = async (req, res, next) => {
    try {
        const { videoUrl, listingId, title, expiresInHours } = req.body;

        if (!videoUrl) {
            return next(errorHandler(400, "Video URL is required"));
        }

        // Validate the video URL format (Cloudinary or blob)
        if (!videoUrl.includes('cloudinary.com') && !videoUrl.startsWith('http')) {
            return next(errorHandler(400, "Invalid video URL"));
        }

        // If listingId provided, verify the listing exists and has this video
        if (listingId) {
            const listing = await Listing.findById(listingId);
            if (!listing) {
                return next(errorHandler(404, "Listing not found"));
            }
            // Verify video belongs to this listing
            if (!listing.videoUrls?.includes(videoUrl)) {
                return next(errorHandler(400, "Video does not belong to this listing"));
            }
        }

        // Check if a share already exists for this exact URL by this user
        const existingShare = await VideoShare.findOne({
            videoUrl,
            createdBy: req.user?.id || null,
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
                shareUrl: `/v/${existingShare.token}`,
                existingShare: true,
                expiresAt: existingShare.expiresAt,
                viewCount: existingShare.viewCount
            });
        }

        // Create new share
        const shareData = {
            videoUrl,
            listingId: listingId || null,
            createdBy: req.user?.id || null,
            title: title || 'UrbanSetu Video'
        };

        // Set optional expiry
        if (expiresInHours && expiresInHours > 0) {
            shareData.expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
        }

        const videoShare = new VideoShare(shareData);
        await videoShare.save();

        res.status(201).json({
            success: true,
            token: videoShare.token,
            shareUrl: `/v/${videoShare.token}`,
            expiresAt: videoShare.expiresAt
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Resolve a share token to get the actual video URL
 * GET /api/video/resolve/:token
 * Public endpoint — no auth required
 */
export const resolveShareLink = async (req, res, next) => {
    try {
        const { token } = req.params;

        if (!token) {
            return next(errorHandler(400, "Token is required"));
        }

        const videoShare = await VideoShare.findOne({ token, isActive: true });

        if (!videoShare) {
            return next(errorHandler(404, "Video link not found or has been revoked"));
        }

        // Check expiry
        if (videoShare.expiresAt && videoShare.expiresAt < new Date()) {
            return next(errorHandler(410, "This video link has expired"));
        }

        // Increment view count (fire-and-forget)
        VideoShare.updateOne({ _id: videoShare._id }, { $inc: { viewCount: 1 } }).catch(() => {});

        res.status(200).json({
            success: true,
            videoUrl: videoShare.videoUrl,
            title: videoShare.title,
            listingId: videoShare.listingId,
            viewCount: videoShare.viewCount + 1
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Revoke a share link (creator or admin only)
 * DELETE /api/video/share/:token
 */
export const revokeShareLink = async (req, res, next) => {
    try {
        const { token } = req.params;

        const videoShare = await VideoShare.findOne({ token });

        if (!videoShare) {
            return next(errorHandler(404, "Share link not found"));
        }

        // Only the creator or admin can revoke
        const isAdmin = req.user.role === 'admin' || req.user.role === 'rootadmin';
        const isCreator = videoShare.createdBy?.toString() === req.user.id;

        if (!isAdmin && !isCreator) {
            return next(errorHandler(403, "You can only revoke your own share links"));
        }

        videoShare.isActive = false;
        await videoShare.save();

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
 * GET /api/video/my-shares
 */
export const getMyShares = async (req, res, next) => {
    try {
        const shares = await VideoShare.find({ createdBy: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50)
            .select('token videoUrl title viewCount isActive expiresAt createdAt listingId');

        res.status(200).json({
            success: true,
            shares
        });
    } catch (error) {
        next(error);
    }
};
