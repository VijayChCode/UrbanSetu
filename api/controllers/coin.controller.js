import "../models/adminLog.model.js";
import CoinService from "../services/coinService.js";
import User from "../models/user.model.js";
import { errorHandler } from "../utils/error.js";

/**
 * Resolve a referral code to a user ID (public, no auth needed)
 */
export const resolveReferralCode = async (req, res, next) => {
    try {
        const { code } = req.params;
        if (!code || code.length < 4) {
            return next(errorHandler(400, 'Invalid referral code'));
        }
        const user = await User.findOne({ 'gamification.referralCode': code.toUpperCase() }).select('_id username');
        if (!user) {
            return res.status(200).json({ success: false, message: 'Referral code not found' });
        }
        res.status(200).json({ success: true, referrerId: user._id, referrerName: user.username });
    } catch (error) {
        next(error);
    }
};

/**
 * Get referral info by user ID (public, no auth needed)
 */
export const getReferralInfo = async (req, res, next) => {
    try {
        const { userId } = req.params;
        if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
            return next(errorHandler(400, 'Invalid user ID'));
        }
        const user = await User.findById(userId).select('gamification.referralCode username');
        if (!user || !user.gamification?.referralCode) {
            return res.status(200).json({ success: false, message: 'User or referral code not found' });
        }
        res.status(200).json({ 
            success: true, 
            referralCode: user.gamification.referralCode, 
            referrerName: user.username 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get current coin balance and stats for logged-in user
 */
export const getBalance = async (req, res, next) => {
    try {
        // req.user is populated by verifyToken middleware
        const stats = await CoinService.getBalance(req.user.id);
        res.status(200).json({ success: true, ...stats });
    } catch (error) {
        next(error);
    }
};

/**
 * Get transaction history for logged-in user
 */
// Get transaction history (User sees own, Admin can see anyone's via query param)
export const getHistory = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        let targetUserId = req.user.id;

        // Allow admins to view other users' history
        if ((req.user.role === 'admin' || req.user.role === 'rootadmin') && req.query.userId) {
            targetUserId = req.query.userId;
        }

        const history = await CoinService.getHistory(targetUserId, page, limit);
        res.status(200).json({ success: true, ...history });
    } catch (error) {
        next(error);
    }
};

/**
 * Get referral stats for logged-in user
 */
export const getReferralStats = async (req, res, next) => {
    try {
        const stats = await CoinService.getReferralStats(req.user.id);
        res.status(200).json({ success: true, ...stats });
    } catch (error) {
        next(error);
    }
};

/**
 * Get Global Leaderboard (Public)
 */
export const getLeaderboard = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'rootadmin');
        const leaderboard = await CoinService.getLeaderboard(limit, isAdmin);
        res.status(200).json({ success: true, leaderboard });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Get any user's coin balance
 */
export const getUserBalance = async (req, res, next) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return next(errorHandler(403, 'Forbidden'));
        }

        const { userId } = req.params;
        const stats = await CoinService.getBalance(userId);
        res.status(200).json({ success: true, ...stats });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Adjust user coins (Credit/Debit)
 */
export const adminAdjustCoins = async (req, res, next) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return next(errorHandler(403, 'Forbidden'));
        }

        const { userId, type, amount, reason } = req.body; // type: 'credit' or 'debit'

        if (!userId || !type || !amount || !reason) {
            return next(errorHandler(400, 'All fields are required'));
        }

        if (amount <= 0) {
            return next(errorHandler(400, 'Amount must be positive'));
        }

        // Limit grant amount for regular admins (e.g., max 5000 coins)
        const ADMIN_GRANT_LIMIT = 5000;
        if (type === 'credit' && req.user.role !== 'rootadmin' && amount > ADMIN_GRANT_LIMIT) {
            return next(errorHandler(403, `Regular admins can only grant up to ${ADMIN_GRANT_LIMIT} coins. Please contact a Root Admin for higher amounts.`));
        }

        // Rate Limit: Check if THIS admin (or any admin? User request implies "if granted... should not be able to grant *for that user*")
        // Let's implement: A specific user cannot receive an admin grant more than once in 24h.
        if (type === 'credit' && req.user.role !== 'rootadmin') {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            // We need to import CoinTransaction model dynamically or assume it's available via CoinService (it's not direct there)
            // Ideally CoinService should handle this check, but for now we'll do it here or via a service method.
            // Let's import the model here cleanly.
            const CoinTransaction = (await import("../models/coinTransaction.model.js")).default;

            const recentGrant = await CoinTransaction.findOne({
                userId,
                type: 'credit',
                source: 'admin_adjustment',
                createdAt: { $gte: twentyFourHoursAgo }
            });

            if (recentGrant) {
                return next(errorHandler(429, "This user has already received an admin coin grant in the last 24 hours. Please wait before granting again."));
            }
        }

        const result = await (type === 'credit' ? CoinService.credit : CoinService.debit)({
            userId,
            amount,
            source: 'admin_adjustment',
            description: reason,
            adminId: req.user.id,
            referenceModel: null
        });

        // Send notification email
        try {
            const User = (await import("../models/user.model.js")).default;
            const updatedUser = await User.findById(userId).select('email');
            if (updatedUser?.email) {
                const { sendCoinAdjustmentEmail } = await import("../utils/emailService.js");
                await sendCoinAdjustmentEmail(updatedUser.email, {
                    type,
                    amount,
                    reason,
                    newBalance: result.newBalance
                });
            }
        } catch (emailError) {
            console.error("Failed to send coin adjustment email:", emailError);
            // Don't fail the whole request if email fails
        }

        res.status(200).json({ success: true, ...result });
    } catch (error) {
        // Handle specific business logic errors clearly
        if (error.message === 'Insufficient SetuCoins balance') {
            return next(errorHandler(400, "User does not have enough coins for this deduction."));
        }
        next(error);
    }
};

/**
 * Admin: Get System Transactions (Filtered)
 */
export const getSystemTransactions = async (req, res, next) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return next(errorHandler(403, 'Forbidden'));
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const filters = {
            type: req.query.type,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            minAmount: req.query.minAmount,
            maxAmount: req.query.maxAmount
        };

        const result = await CoinService.getSystemTransactions(filters, page, limit);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Get System Stats
 */
export const getStats = async (req, res, next) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return next(errorHandler(403, 'Forbidden'));
        }
        const stats = await CoinService.getStats();
        res.status(200).json({ success: true, stats });
    } catch (error) {
        next(error);
    }
};
