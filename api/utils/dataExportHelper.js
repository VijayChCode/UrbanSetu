import Listing from "../models/listing.model.js"
import User from "../models/user.model.js"
import Wishlist from "../models/wishlist.model.js";
import PropertyWatchlist from "../models/propertyWatchlist.model.js";
import Booking from "../models/booking.model.js";
import Payment from "../models/payment.model.js";
import Review from "../models/review.model.js";
import RentLockContract from "../models/rentLockContract.model.js";
import RentalLoan from "../models/rentalLoan.model.js";
import RentalRating from "../models/rentalRating.model.js";
import CoinTransaction from "../models/coinTransaction.model.js";
import ChatHistory from "../models/chatHistory.model.js";
import CallHistory from "../models/callHistory.model.js";
import ForumPost from "../models/forumPost.model.js";
import Blog from "../models/blog.model.js";
import SavedRoute from "../models/savedRoute.model.js";
import CalculationHistory from "../models/calculationHistory.model.js";
import ClientError from "../models/clientError.model.js";

/**
 * Helper to gather all user data for export.
 * Works for both active and recently deleted accounts (using accountId).
 * 
 * @param {Object} user - User object (either from User model or reconstructed from AccountRevocation)
 * @param {Array} modulesToFetch - List of modules to include in the export
 * @returns {Object} - Formatted user data object
 */
export const gatherExportData = async (user, modulesToFetch) => {
    const userId = user._id.toString();
    const results = {};

    // Map modules to their fetch logic
    const moduleMap = {
        wishlist: () => Wishlist.find({ userId: user._id }).populate('listingId', 'name').lean(),
        watchlist: () => PropertyWatchlist.find({ userId: user._id }).populate('listingId', 'name').lean(),
        appointments: () => Booking.find({ userId: user._id }).populate('listingId', 'name').lean(),
        listings: () => Listing.find({ userId: user._id }).lean(),
        reviews: () => Review.find({ userId: user._id }).populate('listingId', 'name').lean(),
        payments: () => Payment.find({ userId: user._id }).lean(),
        gamification: () => CoinTransaction.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
        gemini: () => ChatHistory.find({ userId: user._id }).lean(),
        rentalContracts: () => RentLockContract.find({ $or: [{ tenantId: user._id }, { landlordId: user._id }] }).lean(),
        rentalLoans: () => RentalLoan.find({ userId: user._id }).lean(),
        rentalRatings: () => RentalRating.find({ targetUserId: user._id }).lean(),
        calls: () => CallHistory.find({ $or: [{ callerId: user._id }, { receiverId: user._id }] }).lean(),
        community: () => ForumPost.find({ userId: user._id }).lean(),
        routes: () => SavedRoute.find({ userId: user._id }).lean(),
        investments: () => CalculationHistory.find({ userId: user._id }).lean(),
        blogComments: () => Blog.find({ 'comments.userId': user._id }, { 'comments.$': 1, title: 1 }).lean(),
        referrals: () => User.countDocuments({ referredBy: user._id }),
        clientErrors: () => ClientError.find({}).sort({ timestamp: -1 }).limit(1000).lean()
    };

    // Phase 1: Fetch all data in parallel
    await Promise.all(
        modulesToFetch.map(async (key) => {
            if (moduleMap[key]) {
                try {
                    results[key] = await moduleMap[key]();
                } catch (e) {
                    results[key] = [];
                }
            } else {
                results[key] = [];
            }
        })
    );

    // Handle Referrals special case
    if (results.referrals === undefined) results.referrals = 0;

    // Extract values
    const wishlistItems = results.wishlist || [];
    const watchlistItems = results.watchlist || [];
    const appointments = results.appointments || [];
    const userListings = results.listings || [];
    const reviewsWritten = results.reviews || [];
    const payments = results.payments || [];
    const rentalContracts = results.rentalContracts || [];
    const rentalLoans = results.rentalLoans || [];
    const rentalRatings = results.rentalRatings || [];
    const coinTransactions = results.gamification || [];
    const geminiSessions = results.gemini || [];
    const callHistoryLogs = results.calls || [];
    const forumPosts = results.community || [];
    const savedRoutes = results.routes || [];
    const calculationHistoryItems = results.investments || [];
    const blogCommentsAgg = results.blogComments || [];
    const referralCount = typeof results.referrals === 'number' ? results.referrals : 0;
    const clientErrors = results.clientErrors || [];

    // Phase 2: Dependent data - Reviews Received
    let reviewsReceived = [];
    if (modulesToFetch.includes('reviews') && userListings.length > 0) {
        const userListingIds = userListings.map(l => l._id);
        reviewsReceived = await Review.find({ listingId: { $in: userListingIds } })
            .populate('listingId', 'name')
            .lean()
            .catch(() => []);
    }

    // Get counts
    const wishlistCount = wishlistItems.length;
    const watchlistCount = watchlistItems.length;
    const appointmentsCount = appointments.length;
    const listingsCount = userListings.length;
    const reviewsCount = reviewsWritten.length;
    const paymentsCount = payments.length;

    let geminiPromptsCount = 0;
    geminiSessions.forEach(session => {
        if (session.messages) {
            geminiPromptsCount += session.messages.filter(m => m.role === 'user').length;
        }
    });

    // Build the JSON structure
    const userData = {
        accountInfo: {
            username: user.username,
            email: user.email,
            mobileNumber: user.mobileNumber,
            address: user.address,
            gender: user.gender,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            profilePicture: user.avatar || user.profilePicture
        },
        statistics: {}
    };

    if (modulesToFetch.includes('wishlist')) userData.statistics.wishlistCount = wishlistCount;
    if (modulesToFetch.includes('watchlist')) userData.statistics.watchlistCount = watchlistCount;
    if (modulesToFetch.includes('appointments')) userData.statistics.appointmentsCount = appointmentsCount;
    if (modulesToFetch.includes('listings')) userData.statistics.listingsCount = listingsCount;
    if (modulesToFetch.includes('reviews')) {
        userData.statistics.reviewsWrittenCount = reviewsCount;
        userData.statistics.reviewsReceivedCount = reviewsReceived.length;
    }
    if (modulesToFetch.includes('payments')) userData.statistics.paymentsCount = paymentsCount;
    if (modulesToFetch.includes('gemini')) userData.statistics.geminiPromptsCount = geminiPromptsCount;
    if (modulesToFetch.includes('rentalContracts')) userData.statistics.rentalContractsCount = rentalContracts.length;
    if (modulesToFetch.includes('rentalLoans')) userData.statistics.rentalLoansCount = rentalLoans.length;
    if (modulesToFetch.includes('community')) userData.statistics.forumPostsCount = forumPosts.length;
    if (modulesToFetch.includes('routes')) userData.statistics.savedRoutesCount = savedRoutes.length;
    if (modulesToFetch.includes('investments')) userData.statistics.calculationsCount = calculationHistoryItems.length;
    if (modulesToFetch.includes('blogComments')) userData.statistics.blogCommentsCount = blogCommentsAgg.length;
    if (modulesToFetch.includes('calls')) userData.statistics.totalCalls = callHistoryLogs.length;
    
    if (Object.keys(userData.statistics).length === 0) delete userData.statistics;

    if (modulesToFetch.includes('gamification')) {
        userData.gamification = {
            setuCoinsBalance: user.gamification?.setuCoinsBalance || 0,
            totalCoinsEarned: user.gamification?.totalCoinsEarned || 0,
            currentStreak: user.gamification?.currentStreak || 0,
            transactions: coinTransactions.map(tx => ({
                amount: tx.amount,
                type: tx.type,
                description: tx.description,
                createdAt: tx.createdAt
            }))
        };
    }

    if (modulesToFetch.includes('referrals')) {
        if (!userData.gamification) userData.gamification = {};
        userData.gamification.referralsCount = referralCount;
    }

    if (modulesToFetch.includes('wishlist')) {
        userData.wishlist = wishlistItems.map(item => ({
            listingId: item.listingId?._id || item.listingId,
            listingTitle: item.listingId?.name || 'N/A',
            addedAt: item.addedAt || item.createdAt,
            effectivePriceAtAdd: item.effectivePriceAtAdd
        }));
    }

    if (modulesToFetch.includes('watchlist')) {
        userData.watchlist = watchlistItems.map(item => ({
            listingId: item.listingId?._id || item.listingId,
            listingTitle: item.listingId?.name || 'N/A',
            addedAt: item.addedAt || item.createdAt,
            effectivePriceAtAdd: item.effectivePriceAtAdd
        }));
    }

    if (modulesToFetch.includes('appointments')) {
        userData.appointments = appointments.map(apt => ({
            appointmentId: apt._id,
            listingId: apt.listingId?._id || apt.listingId,
            listingTitle: apt.listingId?.name || apt.propertyName || 'N/A',
            purpose: apt.purpose,
            date: apt.date,
            time: apt.time,
            status: apt.status,
            createdAt: apt.createdAt
        }));
    }

    if (modulesToFetch.includes('listings')) {
        userData.listings = userListings.map(listing => ({
            listingId: listing._id,
            name: listing.name,
            address: listing.address,
            regularPrice: listing.regularPrice,
            discountPrice: listing.discountPrice,
            type: listing.type,
            offer: listing.offer,
            createdAt: listing.createdAt,
            updatedAt: listing.updatedAt
        }));
    }

    if (modulesToFetch.includes('reviews')) {
        userData.reviewsWritten = reviewsWritten.map(review => ({
            reviewId: review._id,
            listingId: review.listingId?._id || review.listingId,
            listingTitle: review.listingId?.name || 'N/A',
            starRating: review.starRating,
            comment: review.comment,
            createdAt: review.createdAt
        }));

        userData.reviewsReceived = reviewsReceived.map(review => ({
            reviewId: review._id,
            listingTitle: review.listingId?.name || 'N/A',
            starRating: review.starRating,
            comment: review.comment,
            createdAt: review.createdAt
        }));
    }

    if (modulesToFetch.includes('rentalContracts')) {
        userData.rentalContracts = rentalContracts.map(contract => ({
            contractId: contract._id,
            status: contract.status,
            rentAmount: contract.rentAmount,
            startDate: contract.startDate,
            endDate: contract.endDate,
            role: contract.tenantId?.toString() === userId ? 'Tenant' : 'Landlord'
        }));
    }

    if (modulesToFetch.includes('rentalLoans')) {
        userData.rentalLoans = rentalLoans.map(loan => ({
            loanId: loan._id,
            amount: loan.amount,
            status: loan.status,
            createdAt: loan.createdAt
        }));
    }

    if (modulesToFetch.includes('rentalRatings')) {
        userData.rentalRatings = rentalRatings.map(rating => ({
            rating: rating.rating,
            comment: rating.comment,
            type: rating.type,
            createdAt: rating.createdAt
        }));
    }

    if (modulesToFetch.includes('payments')) {
        userData.payments = payments.map(payment => ({
            paymentId: payment._id,
            amount: payment.amount,
            status: payment.status,
            createdAt: payment.createdAt
        }));
    }

    if (modulesToFetch.includes('gemini')) {
        userData.geminiHistorySummary = {
            totalSessions: geminiSessions.length,
            totalPrompts: geminiPromptsCount,
            sessions: geminiSessions.map(s => ({
                sessionId: s.sessionId,
                messageCount: s.messages ? s.messages.length : 0,
                lastActivity: s.lastActivity
            }))
        };
    }

    if (modulesToFetch.includes('calls')) {
        userData.callHistory = callHistoryLogs.map(call => ({
            type: call.callType,
            status: call.status,
            duration: call.duration,
            startedAt: call.startTime,
            role: call.callerId?.toString() === userId ? 'Caller' : 'Receiver'
        }));
    }

    if (modulesToFetch.includes('community')) {
        userData.communityDiscussions = forumPosts.map(post => ({
            postId: post._id,
            title: post.title,
            category: post.category,
            likes: post.likes ? post.likes.length : 0,
            createdAt: post.createdAt
        }));
    }

    if (modulesToFetch.includes('blogComments')) {
        userData.blogComments = blogCommentsAgg.map(item => ({
            blogId: item._id,
            blogTitle: item.title,
            comment: item.comment?.content,
            commentedAt: item.comment?.createdAt
        }));
    }

    if (modulesToFetch.includes('routes')) {
        userData.savedRoutes = savedRoutes.map(route => ({
            routeId: route._id,
            name: route.name,
            distance: route.route?.distance,
            stopsCount: route.stops ? route.stops.length : 0,
            createdAt: route.createdAt
        }));
    }

    if (modulesToFetch.includes('investments')) {
        userData.investmentCalculations = calculationHistoryItems.map(calc => ({
            type: calc.type,
            inputs: calc.inputs,
            result: calc.result,
            createdAt: calc.createdAt
        }));
    }

    if (modulesToFetch.includes('clientErrors') && (user.role === 'admin' || user.role === 'rootadmin')) {
        userData.clientErrorsSummary = {
            totalErrors: clientErrors.length,
            errors: clientErrors.slice(0, 1000)
        };
    }

    userData.exportDate = new Date().toISOString();
    userData.exportVersion = "1.2";

    return userData;
};
