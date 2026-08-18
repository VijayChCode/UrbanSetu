import mongoose from 'mongoose';
import PropertyView from "../models/propertyView.model.js";
import Booking from "../models/booking.model.js";
import Review from "../models/review.model.js";
import ReviewReply from "../models/reviewReply.model.js";
import Wishlist from "../models/wishlist.model.js";
import CoinTransaction from "../models/coinTransaction.model.js";
import Listing from "../models/listing.model.js";
import User from "../models/user.model.js";
import RentLockContract from "../models/rentLockContract.model.js";
import ImageFavorite from "../models/imageFavorite.model.js";
import Dispute from "../models/dispute.model.js";
import PropertyVerification from "../models/propertyVerification.model.js";
import PropertyWatchlist from "../models/propertyWatchlist.model.js";
import ServiceRequest from "../models/serviceRequest.model.js";
import MoversRequest from "../models/moversRequest.model.js";
import ForumPost from "../models/forumPost.model.js";
import CalculationHistory from "../models/calculationHistory.model.js";
import Blog from "../models/blog.model.js";
import Payment from "../models/payment.model.js";
import RentalLoan from "../models/rentalLoan.model.js";
import RentalRating from "../models/rentalRating.model.js";
import ChatHistory from "../models/chatHistory.model.js";
import SavedSearch from "../models/savedSearch.model.js";
import Notification from "../models/notification.model.js";
import Route from "../models/Route.js";
import CallHistory from "../models/callHistory.model.js";

import cloudinary from 'cloudinary';
import {
  getCloudinaryInstance,
  recordUpload,
  recordFailure,
} from '../utils/cloudinaryPool.js';

// Cloudinary is now configured dynamically via CloudinaryPool
// (no static cloudinary.v2.config() needed here)


// Helper to determine personality
const getPersonality = (stats) => {
    if (stats.bookings > 0 || stats.rentals > 0) return { type: "The Action Taker", desc: "You don't just dream; you make moves. You secured your spot this year!" };
    if (stats.reviews > 5) return { type: "The Community Voice", desc: "Your opinions matter, and you've helped guide many others this year." };
    if (stats.wishlist > 20) return { type: "The Dreamer", desc: "You've curated an incredible list of future homes. Dreaming big is where it begins!" };
    if (stats.views > 100) return { type: "The Master Explorer", desc: "You've seen it all! Your property knowledge is second to none." };
    return { type: "The Urban Resident", desc: "A visionary hunter of perfect spaces." };
};

const getAdminPersonality = (stats) => {
    if (stats.revenue > 1000000 || stats.bookings > 100) return { type: "The Economic Catalyst", desc: "You've driven massive growth and financial vitality this year!" };
    if (stats.resolvedDisputes > 10 || stats.verifications > 30) return { type: "The Platform Guardian", desc: "Safety and trust are your top priorities. You've kept UrbanSetu secure." };
    if (stats.blogs > 15 || stats.forumPosts > 40) return { type: "The Visionary Curator", desc: "You've shaped the community narrative through insights and moderation." };
    if (stats.users > 500) return { type: "The Scale Strategist", desc: "Managing growth at scale is your specialty. The ecosystem is thriving!" };
    return { type: "The Urban Architect", desc: "Building the foundations of future city living." };
};

export const getUserYearInReview = async (req, res, next) => {
    try {
        const { year } = req.params;
        const userId = req.user.id;
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const currentYear = new Date().getFullYear();

        if (parseInt(year) > currentYear) {
            return res.status(400).json({ message: "The future hasn't been written yet! Check back at the end of the year." });
        }

        // Check if user is brand new (less than 1 day old)
        const user = await User.findById(userId);
        const joinDate = new Date(user.createdAt);
        const joinYear = joinDate.getFullYear();
        const targetYear = parseInt(year);

        if (targetYear < joinYear) {
            return res.status(400).json({
                message: `You weren't a member of UrbanSetu in ${year}. Your journey started in ${joinYear}!`
            });
        }

        const now = new Date();
        const oneDay = 24 * 60 * 60 * 1000;


        if (now - joinDate < oneDay) {
            return res.status(400).json({ message: "Welcome to UrbanSetu! Your journey has just begun. Come back later to see your flashback!" });
        }

        // Check if the review has been released via email
        // This ensures the page is only available after the automated email is sent
        const sentYears = user.yearInReviewSent || [];
        const isReleased = sentYears.some(y => y.toString() === year.toString());

        if (!isReleased) {
            return res.status(400).json({
                message: `Your ${year} Flashback is still being accepted/prepared! You will be notified via email when it is ready.`
            });
        }


        const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

        // 1. Property Views & Active Days/Streaks
        const viewsAgg = await PropertyView.aggregate([
            {
                $match: {
                    viewerId: `u:${userId}`,
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const activeDays = viewsAgg.length;
        let streak = 0;
        let maxStreak = 0;
        if (activeDays > 0) {
            streak = 1;
            maxStreak = 1;
            for (let i = 1; i < viewsAgg.length; i++) {
                const prev = new Date(viewsAgg[i - 1]._id);
                const curr = new Date(viewsAgg[i]._id);
                const diffTime = Math.abs(curr - prev);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays === 1) {
                    streak++;
                    maxStreak = Math.max(maxStreak, streak);
                } else {
                    streak = 1;
                }
            }
        }

        const viewsCount = await PropertyView.countDocuments({
            viewerId: `u:${userId}`,
            createdAt: { $gte: startDate, $lte: endDate }
        });

        // 2. Exploration & Top Type
        const explorationAgg = await PropertyView.aggregate([
            {
                $match: {
                    viewerId: `u:${userId}`,
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $lookup: {
                    from: "listings",
                    localField: "propertyId",
                    foreignField: "_id",
                    as: "listing"
                }
            },
            { $unwind: "$listing" },
            {
                $facet: {
                    topCities: [
                        { $group: { _id: "$listing.city", count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 3 }
                    ],
                    topType: [
                        { $group: { _id: "$listing.type", count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 1 }
                    ]
                }
            }
        ]);

        // 3. Activity by Month
        const monthlyActivity = await PropertyView.aggregate([
            {
                $match: {
                    viewerId: `u:${userId}`,
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);

        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const peakMonth = monthlyActivity.length > 0 ? monthNames[monthlyActivity[0]._id - 1] : null;

        // 4. Bookings & Rentals
        const bookingsCount = await Booking.countDocuments({
            buyerId: userId,
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $nin: ['cancelledByBuyer', 'cancelledBySeller', 'cancelledByAdmin'] }
        });

        const rentalsCount = await RentLockContract.countDocuments({
            tenantId: userId,
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'active'
        });

        const wishlistCount = await Wishlist.countDocuments({
            userId: userId,
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const watchlistCount = await PropertyWatchlist.countDocuments({
            userId: userId,
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const favoriteCount = await ImageFavorite.countDocuments({
            userId: userId,
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const reviewsCount = await Review.countDocuments({
            userId: userId,
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const serviceCount = await ServiceRequest.countDocuments({
            userId: userId,
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const moversCount = await MoversRequest.countDocuments({
            userId: userId,
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const forumPostsCount = await ForumPost.countDocuments({
            author: userId,
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const calculationsCount = await CalculationHistory.countDocuments({
            userId: userId,
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const referralsCount = await CoinTransaction.countDocuments({
            userId: userId,
            source: 'referral',
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const loansCount = await RentalLoan.countDocuments({
            userId: userId,
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const rentalRatingsCount = await RentalRating.countDocuments({
            $or: [{ tenantId: userId }, { landlordId: userId }],
            createdAt: { $gte: startDate, $lte: endDate }
        });

        // NEW: Blog Comment Activity
        const blogCommentsAgg = await Blog.aggregate([
            { $unwind: "$comments" },
            {
                $match: {
                    "comments.user": userObjectId,
                    "comments.createdAt": { $gte: startDate, $lte: endDate }
                }
            },
            { $count: "total" }
        ]);
        const blogCommentsCount = blogCommentsAgg.length > 0 ? blogCommentsAgg[0].total : 0;

        // NEW: Forum Engagement (Comments + Replies)
        const forumActivityAgg = await ForumPost.aggregate([
            {
                $project: {
                    comments: 1
                }
            },
            { $unwind: "$comments" },
            {
                $facet: {
                    "commentsCount": [
                        {
                            $match: {
                                "comments.user": userObjectId,
                                "comments.createdAt": { $gte: startDate, $lte: endDate }
                            }
                        },
                        { $count: "total" }
                    ],
                    "repliesCount": [
                        { $unwind: "$comments.replies" },
                        {
                            $match: {
                                "comments.replies.user": userObjectId,
                                "comments.replies.createdAt": { $gte: startDate, $lte: endDate }
                            }
                        },
                        { $count: "total" }
                    ]
                }
            }
        ]);

        const forumCommentsCount = forumActivityAgg[0].commentsCount[0]?.total || 0;
        const forumRepliesCount = forumActivityAgg[0].repliesCount[0]?.total || 0;
        const forumEngagementCount = forumCommentsCount + forumRepliesCount;

        const coinsAgg = await CoinTransaction.aggregate([
            {
                $match: {
                    userId: userObjectId,
                    type: 'credit',
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const coinsEarned = coinsAgg.length > 0 ? coinsAgg[0].total : 0;

        const chatAgg = await ChatHistory.aggregate([
            {
                $match: {
                    userId: userObjectId,
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            { $group: { _id: null, total: { $sum: "$totalMessages" } } }
        ]);
        const totalMessages = chatAgg.length > 0 ? chatAgg[0].total : 0;

        const totalSearches = await SavedSearch.countDocuments({
            userId: userId,
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const totalNotifs = await Notification.countDocuments({
            userId: userId,
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const routesAgg = await Route.aggregate([
            {
                $match: {
                    userId: userObjectId,
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    totalStops: { $sum: { $size: "$stops" } },
                    totalDistance: { $sum: "$route.distance" }
                }
            }
        ]);

        const routesSaved = routesAgg.length > 0 ? routesAgg[0].count : 0;
        const totalRouteStops = routesAgg.length > 0 ? routesAgg[0].totalStops : 0;
        const totalRouteDistance = routesAgg.length > 0 ? Math.round(routesAgg[0].totalDistance / 1000) : 0;

        const totalInteractions = viewsCount + bookingsCount + wishlistCount + watchlistCount +
            reviewsCount + rentalsCount + favoriteCount + serviceCount +
            moversCount + forumPostsCount + forumEngagementCount + blogCommentsCount + calculationsCount + referralsCount +
            loansCount + rentalRatingsCount + totalMessages + totalSearches + (coinsEarned > 0 ? 1 : 0) + routesSaved;

        // ... (Property Mogul code follows)

        // NEW: Property Mogul Stats (Owner/Seller side)
        const userListingsCount = await Listing.countDocuments({
            userRef: userId,
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const userSalesCount = await Booking.countDocuments({
            // sellerId field might not exist in Booking model based on typical setups, 
            // usually listings link to owners. Assuming Booking has 'listing' which has 'userRef'
            // But if Booking model has direct sellerId, use that.
            // Let's use a lookup-based approach if needed, but for now assuming direct or through listing.
            // Checking previous context, Booking model was used for 'buyerId'.
            // Let's assume we need to find bookings for listings owned by this user.
            // Simplified: We will count bookings where the listing owner is this user.
        });

        // Revised approach for Sales/Landlord stats:
        // 1. Get all listing IDs owned by user
        const userListings = await Listing.find({ userRef: userId }).select('_id');
        const userListingIds = userListings.map(l => l._id);

        const userSales = await Booking.countDocuments({
            listingId: { $in: userListingIds },
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'completed'
        });

        const userLandlordContracts = await RentLockContract.countDocuments({
            landlordId: userId,
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'active'
        });

        // NEW: User Property Verifications
        // Since PropertyVerification model typically links to a listing, and we know the user's listings
        const userVerifications = await PropertyVerification.countDocuments({
            listingId: { $in: userListingIds }, // Using the list of user listing IDs from Property Mogul step
            status: 'verified',
            badgeIssuedAt: { $gte: startDate, $lte: endDate }
        });

        // NEW: Call History Stats (Audio/Video)
        const callsAgg = await CallHistory.aggregate([
            {
                $match: {
                    $or: [{ callerId: userObjectId }, { receiverId: userObjectId }],
                    status: { $in: ['accepted', 'ended'] }, // Only count successful calls
                    startTime: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalCalls: { $sum: 1 },
                    totalDuration: { $sum: "$duration" }, // in seconds
                    audioCalls: {
                        $sum: { $cond: [{ $eq: ["$callType", "audio"] }, 1, 0] }
                    },
                    videoCalls: {
                        $sum: { $cond: [{ $eq: ["$callType", "video"] }, 1, 0] }
                    }
                }
            }
        ]);

        const totalCalls = callsAgg.length > 0 ? callsAgg[0].totalCalls : 0;
        const totalCallDuration = callsAgg.length > 0 ? Math.round(callsAgg[0].totalDuration / 60) : 0; // Convert to minutes
        const audioCallsCount = callsAgg.length > 0 ? callsAgg[0].audioCalls : 0;
        const videoCallsCount = callsAgg.length > 0 ? callsAgg[0].videoCalls : 0;

        // NEW: Review Engagement
        const reviewRepliesCount = await ReviewReply.countDocuments({
            userId: userId,
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const helpfulVotesGiven = await Review.countDocuments({
            "helpfulVotes.userId": userId,
            "helpfulVotes.votedAt": { $gte: startDate, $lte: endDate }
        });

        const helpfulVotesReceivedAgg = await Review.aggregate([
            {
                $match: {
                    userId: userObjectId,
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            { $group: { _id: null, total: { $sum: "$helpfulCount" } } }
        ]);
        const helpfulVotesReceived = helpfulVotesReceivedAgg.length > 0 ? helpfulVotesReceivedAgg[0].total : 0;

        const stats = {
            views: viewsCount,
            activeDays,
            maxStreak,
            bookings: bookingsCount,
            rentals: rentalsCount,
            wishlist: wishlistCount + watchlistCount,
            favorites: favoriteCount,
            reviews: reviewsCount,
            reviewReplies: reviewRepliesCount,
            helpfulVotesGiven,
            helpfulVotesReceived,
            coins: coinsEarned,
            serviceRequests: serviceCount,
            moversRequests: moversCount,
            forumPosts: forumPostsCount,
            forumEngagement: forumEngagementCount,
            blogComments: blogCommentsCount,
            totalForumActivity: forumPostsCount + forumEngagementCount,
            calculations: calculationsCount,
            referrals: referralsCount,
            loans: loansCount,
            rentalRatings: rentalRatingsCount,
            aiMessages: totalMessages,
            savedSearches: totalSearches,
            notifications: totalNotifs,
            peakMonth,
            topType: explorationAgg[0]?.topType[0]?._id || null,
            totalInteractions: totalInteractions + reviewRepliesCount + helpfulVotesGiven + userListingsCount + userSales + userLandlordContracts + userVerifications + totalCalls,
            listingsCreated: userListingsCount,
            listingsSold: userSales,
            listingsRented: userLandlordContracts,
            verificationsEarned: userVerifications,
            routesSaved,
            routeStops: totalRouteStops,
            routeDistance: totalRouteDistance,
            totalCalls,
            callDuration: totalCallDuration,
            audioCalls: audioCallsCount,
            videoCalls: videoCallsCount
        };

        const personality = getPersonality(stats);

        res.status(200).json({
            year,
            stats,
            topCities: explorationAgg[0]?.topCities.map(c => c._id).filter(Boolean),
            personality,
            isCurrentYear: parseInt(year) === currentYear
        });

    } catch (error) {
        next(error);
    }
};

export const getAdminYearInReview = async (req, res, next) => {
    try {
        const { year } = req.params;
        const currentYear = new Date().getFullYear();
        const adminId = req.user.id;

        if (parseInt(year) > currentYear) {
            return res.status(400).json({ message: "System logs for the future are currently unavailable." });
        }

        const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

        // 1. Listings Verified & Documents Checked
        const listingsAgg = await Listing.aggregate([
            {
                $match: {
                    isVerified: true,
                    updatedAt: { $gte: startDate, $lte: endDate }
                }
            },
            { $count: "total" }
        ]);

        const verifications = await PropertyVerification.countDocuments({
            status: 'verified',
            badgeIssuedAt: { $gte: startDate, $lte: endDate }
        });

        // 2. Financials
        const bookingsAgg = await Booking.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    totalRevenue: { $sum: "$amount" }
                }
            }
        ]);

        const totalRevenue = bookingsAgg.length > 0 ? bookingsAgg[0].totalRevenue : 0;
        const totalBookings = bookingsAgg.length > 0 ? bookingsAgg[0].count : 0;

        // 3. User & Moderation
        const usersCount = await User.countDocuments({
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const resolvedDisputes = await Dispute.countDocuments({
            status: 'resolved',
            updatedAt: { $gte: startDate, $lte: endDate }
        });

        const activeReports = await Dispute.countDocuments({
            status: 'pending',
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const forumPostsTotal = await ForumPost.countDocuments({
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const blogPostsTotal = await Blog.countDocuments({
            published: true,
            publishedAt: { $gte: startDate, $lte: endDate }
        });

        const serviceRequestsTotal = await ServiceRequest.countDocuments({
            status: 'completed',
            updatedAt: { $gte: startDate, $lte: endDate }
        });

        const moversRequestsTotal = await MoversRequest.countDocuments({
            status: 'completed',
            updatedAt: { $gte: startDate, $lte: endDate }
        });

        const calculationsTotal = await CalculationHistory.countDocuments({
            createdAt: { $gte: startDate, $lte: endDate }
        });

        // 4. Most Popular City
        const cityAgg = await Listing.aggregate([
            { $match: { isVerified: true, createdAt: { $gte: startDate, $lte: endDate } } },
            { $group: { _id: "$city", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);

        const topCity = cityAgg.length > 0 ? cityAgg[0]._id : null;

        const referralsTotal = await CoinTransaction.countDocuments({
            source: 'referral',
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const loansTotal = await RentalLoan.countDocuments({
            status: 'approved',
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const rentalRatingsTotal = await RentalRating.countDocuments({
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const chatAggTotal = await ChatHistory.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            { $group: { _id: null, total: { $sum: "$totalMessages" } } }
        ]);
        const platformMessages = chatAggTotal.length > 0 ? chatAggTotal[0].total : 0;

        const platformSearches = await SavedSearch.countDocuments({
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const platformNotifs = await Notification.countDocuments({
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const hasActivity = verifications > 0 || totalBookings > 0 || usersCount > 0 || blogPostsTotal > 0;

        const adminStats = {
            listings: listingsAgg[0]?.total || 0,
            verifications,
            bookings: totalBookings,
            users: usersCount,
            revenue: totalRevenue,
            topCity,
            resolvedDisputes,
            activeReports,
            blogs: blogPostsTotal,
            forumPosts: forumPostsTotal,
            serviceRequests: serviceRequestsTotal,
            moversRequests: moversRequestsTotal,
            calculations: calculationsTotal,
            referrals: referralsTotal,
            loans: loansTotal,
            rentalRatings: rentalRatingsTotal,
            aiMessages: platformMessages,
            savedSearches: platformSearches,
            notifications: platformNotifs
        };

        const personality = getAdminPersonality(adminStats);

        res.status(200).json({
            year,
            stats: adminStats,
            personality,
            hasActivity,
            isCurrentYear: parseInt(year) === currentYear
        });
    } catch (error) {
        next(error);
    }
};

export const uploadYearInReviewImage = async (req, res, next) => {
    try {
        const { image, year } = req.body;
        const userId = req.user.id;

        if (!image) {
            return res.status(400).json({ message: "No image data provided" });
        }

        // Upload to Cloudinary via pool
        const pool = await getCloudinaryInstance();
        if (!pool) {
            return res.status(500).json({ message: 'No Cloudinary accounts available in pool' });
        }
        const uploadResponse = await pool.instance.uploader.upload(image, {
            folder: `urbansetu/flashbacks/${year}`,
            public_id: `flashback_${userId}_${Date.now()}`,
            resource_type: 'image'
        });
        await recordUpload(pool.account.accountIndex, 0);
        console.log(`[CloudinaryPool] Flashback upload on account ${pool.account.cloudName}`);

        res.status(200).json({
            imageUrl: uploadResponse.secure_url,
            publicId: uploadResponse.public_id
        });
    } catch (error) {
        console.error("Flashback upload error:", error);
        res.status(500).json({ message: "Failed to upload flashback image", error: error.message });
    }
}
