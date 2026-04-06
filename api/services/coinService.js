import User from "../models/user.model.js";
import CoinTransaction from "../models/coinTransaction.model.js";
import mongoose from "mongoose";
import { sendLeaderboardBonusEmail } from "../utils/emailService.js";

/**
 * Service to handle SetuCoins operations
 */
class CoinService {
    /**
     * Get user's current coin balance and verified stats
     * @param {string} userId
     * @returns {Promise<Object>} { balance, totalEarned, currentStreak }
     */
    async getBalance(userId) {
        const user = await User.findById(userId).select('gamification');
        if (!user) {
            throw new Error('User not found');
        }

        const stats = user.gamification || {
            setuCoinsBalance: 0,
            totalCoinsEarned: 0,
            currentStreak: 0,
            lastRentPaymentDate: null
        };

        // Calculate Rank
        let rank = null;
        if (stats.totalCoinsEarned > 0) {
            rank = await User.countDocuments({
                'gamification.totalCoinsEarned': { $gt: stats.totalCoinsEarned }
            }) + 1;
        }

        return {
            ...stats.toObject ? stats.toObject() : stats,
            rank
        };
    }

    /**
     * Credit coins to a user
     * @param {Object} params
     * @param {string} params.userId
     * @param {number} params.amount
     * @param {string} params.source - enum from CoinTransaction
     * @param {string} params.referenceId - Optional
     * @param {string} params.referenceModel - Optional
     * @param {string} params.description - Optional
     * @param {string} params.adminId - Optional, if manual adjustment
     * @param {Object} params.session - Mongoose session for atomicity (optional)
     */
    async credit({ userId, amount, source, referenceId = null, referenceModel = null, description = '', adminId = null, session = null }) {
        if (amount <= 0) {
            throw new Error('Amount must be positive');
        }

        const user = await User.findById(userId).session(session);
        if (!user) {
            throw new Error('User not found');
        }

        // Initialize gamification if it doesn't exist
        if (!user.gamification) {
            user.gamification = {
                setuCoinsBalance: 0,
                totalCoinsEarned: 0,
                currentStreak: 0,
                lastRentPaymentDate: null
            };
        }

        // Update balance
        user.gamification.setuCoinsBalance += amount;
        user.gamification.totalCoinsEarned += amount;

        // Update expiry tracking
        const now = new Date();
        const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        user.gamification.lastCoinTransaction = now;
        // user.gamification.coinsExpiryDate = oneYearFromNow; // Removed: We now track expiry per transaction

        // Save user
        await user.save({ session });

        // Create transaction record
        const transaction = new CoinTransaction({
            userId,
            type: 'credit',
            amount,
            source,
            referenceId,
            referenceModel,
            description,
            balanceAfter: user.gamification.setuCoinsBalance,
            expiryDate: oneYearFromNow, // Per-transaction expiry
            remainingBalance: amount,   // Initial remaining balance
            adminId
        });

        await transaction.save({ session });

        return {
            success: true,
            newBalance: user.gamification.setuCoinsBalance,
            transactionId: transaction._id
        };
    }

    /**
     * Debit coins from a user
     * @param {Object} params
     * @param {string} params.userId
     * @param {number} params.amount
     * @param {string} params.source
     * @param {string} params.referenceId
     * @param {string} params.referenceModel
     * @param {string} params.description
     * @param {string} params.adminId
     * @param {Object} params.session
     */
    async debit({ userId, amount, source, referenceId = null, referenceModel = null, description = '', adminId = null, session = null }) {
        if (amount <= 0) {
            throw new Error('Amount must be positive');
        }

        const user = await User.findById(userId).session(session);
        if (!user) {
            throw new Error('User not found');
        }

        if (!user.gamification || user.gamification.setuCoinsBalance < amount) {
            throw new Error('Insufficient SetuCoins balance');
        }

        // Update balance
        user.gamification.setuCoinsBalance -= amount;
        user.gamification.lastCoinTransaction = new Date();

        // FIFO Deduction Logic: Deduct from oldest active credits
        let amountRemainingToDebit = amount;
        try {
            const activeCredits = await CoinTransaction.find({
                userId,
                type: 'credit',
                expiryDate: { $gt: new Date() },
                remainingBalance: { $gt: 0 }
            }).sort({ expiryDate: 1 }).session(session);

            for (const creditTx of activeCredits) {
                if (amountRemainingToDebit <= 0) break;
                const deduction = Math.min(creditTx.remainingBalance, amountRemainingToDebit);
                creditTx.remainingBalance -= deduction;
                amountRemainingToDebit -= deduction;
                await creditTx.save({ session });
            }
        } catch (fifoError) {
            console.error("Error in FIFO deduction:", fifoError);
            // Proceed without failing the transaction, relying on master balance
        }

        // Save user
        await user.save({ session });

        // Create debit transaction record
        const transaction = new CoinTransaction({
            userId,
            type: 'debit',
            amount,
            source,
            referenceId,
            referenceModel,
            description,
            balanceAfter: user.gamification.setuCoinsBalance,
            adminId
        });

        await transaction.save({ session });

        return {
            success: true,
            newBalance: user.gamification.setuCoinsBalance,
            transactionId: transaction._id
        };
    }

    /**
     * Update rent streak logic
     * @param {string} userId 
     * @param {Date} paymentDate 
     * @param {Object} session 
     */
    async updateRentStreak(userId, paymentDate = new Date(), session = null) {
        const user = await User.findById(userId).session(session);
        if (!user) return;

        if (!user.gamification) {
            user.gamification = {
                setuCoinsBalance: 0,
                totalCoinsEarned: 0,
                currentStreak: 0,
                lastRentPaymentDate: null
            };
        }

        const lastDate = user.gamification.lastRentPaymentDate ? new Date(user.gamification.lastRentPaymentDate) : null;
        const currentDate = new Date(paymentDate);

        // Check if last payment was previous month
        // Logic: If lastDate is null, streak = 1
        // If lastDate is last month (any day), streak++
        // If lastDate is current month, streak stays same (already count)
        // If lastDate is > 1 month ago, streak = 1

        let streakIncreased = false;
        let earnedStreakBonus = 0;

        if (!lastDate) {
            user.gamification.currentStreak = 1;
            streakIncreased = true;
        } else {
            const monthsDiff = (currentDate.getFullYear() - lastDate.getFullYear()) * 12 + (currentDate.getMonth() - lastDate.getMonth());

            if (monthsDiff === 0) {
                // Same month, no streak increase
            } else if (monthsDiff === 1) {
                // Consecutive month
                user.gamification.currentStreak += 1;
                streakIncreased = true;
            } else {
                // Broken streak
                user.gamification.currentStreak = 1;
                streakIncreased = true;
            }
        }

        // Calculate Streak Bonus
        // Rule: 20 coins per streak month, capped at 100 max bonus per month
        if (streakIncreased && user.gamification.currentStreak > 1) {
            earnedStreakBonus = Math.min(user.gamification.currentStreak * 20, 100);

            // Auto-credit streak bonus
            // We need to call credit here, but carefully to avoid recursion or circular dependencies if logic expands
            // Ideally returned to caller to process credit
        }

        user.gamification.lastRentPaymentDate = currentDate;
        await user.save({ session });

        return {
            currentStreak: user.gamification.currentStreak,
            streakIncreased,
            earnedStreakBonus
        };
    }

    /**
     * Get Leaderboard
     */
    async getLeaderboard(limit = 10, isAdmin = false) {
        const users = await User.find({ 'gamification.totalCoinsEarned': { $gt: 0 } })
            .select('username firstName lastName avatar gamification.totalCoinsEarned gamification.currentStreak')
            .sort({ 'gamification.totalCoinsEarned': -1 })
            .limit(limit);

        return users.map((u, index) => {
            const name = u.username || 'Anonymous';
            const maskedName = name.length > 3
                ? `${name.substring(0, 3)}***`
                : `${name}***`;

            const entry = {
                rank: index + 1,
                userId: u._id,
                name: maskedName,
                avatar: u.avatar,
                totalCoins: u.gamification?.totalCoinsEarned || 0,
                streak: u.gamification?.currentStreak || 0
            };

            if (isAdmin) {
                entry.fullName = name; // Full unmasked name for admin lookup
            }

            return entry;
        });
    }

    /**
     * Get system-wide transactions with filtering and pagination
     */
    async getSystemTransactions(filters = {}, page = 1, limit = 20) {
        const query = {};

        if (filters.type && filters.type !== 'all') {
            query.type = filters.type;
        }

        if (filters.startDate || filters.endDate) {
            query.createdAt = {};
            if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
            if (filters.endDate) {
                const end = new Date(filters.endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        if (filters.minAmount) {
            query.amount = { ...query.amount, $gte: parseInt(filters.minAmount) };
        }
        if (filters.maxAmount) {
            query.amount = { ...query.amount, ...((query.amount || {}).$gte ? {} : {}), $lte: parseInt(filters.maxAmount) };
        }

        const skip = (page - 1) * limit;

        const transactionsRaw = await CoinTransaction.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'username email gamification.totalCoinsEarned');

        // Add rank to each transaction's user
        const transactions = await Promise.all(transactionsRaw.map(async (tx) => {
            const txObj = tx.toObject();
            if (txObj.userId && txObj.userId.gamification?.totalCoinsEarned > 0) {
                txObj.userId.rank = await User.countDocuments({
                    'gamification.totalCoinsEarned': { $gt: txObj.userId.gamification.totalCoinsEarned }
                }) + 1;
            } else if (txObj.userId) {
                txObj.userId.rank = null;
            }
            return txObj;
        }));

        const total = await CoinTransaction.countDocuments(query);

        return {
            transactions,
            total,
            page,
            pages: Math.ceil(total / limit)
        };
    }

    /**
     * Get System Stats for Admin
     */
    async getStats() {
        // 1. Total Circulating Supply (Sum of all user balances)
        const supplyAgg = await User.aggregate([
            { $group: { _id: null, totalBalance: { $sum: '$gamification.setuCoinsBalance' }, totalEarned: { $sum: '$gamification.totalCoinsEarned' } } }
        ]);

        const circulatingSupply = supplyAgg[0]?.totalBalance || 0;
        const totalMintedLifetime = supplyAgg[0]?.totalEarned || 0;

        // 2. Total Redeemed (Burned)
        const burnedAgg = await CoinTransaction.aggregate([
            { $match: { type: 'debit' } },
            { $group: { _id: null, totalBurned: { $sum: '$amount' } } }
        ]);
        const totalBurned = burnedAgg[0]?.totalBurned || 0;

        // 3. User Stats
        const holdersCount = await User.countDocuments({ 'gamification.setuCoinsBalance': { $gt: 0 } });

        // 4. Recent Transactions
        const recentTransactions = await CoinTransaction.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('userId', 'username email');

        return {
            circulatingSupply,
            totalMintedLifetime,
            totalBurned,
            holdersCount,
            recentTransactions
        };
    }

    /**
     * Get transaction history
     */
    async getHistory(userId, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const transactions = await CoinTransaction.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('referenceId'); // Populate might be tricky if dynamic, but basic is fine

        const total = await CoinTransaction.countDocuments({ userId });

        return {
            transactions,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Get referral statistics for a user
     * @param {string} userId 
     */
    async getReferralStats(userId) {
        const userObjectId = new mongoose.Types.ObjectId(userId);

        // 1. Get users explicitly linked via 'referredBy'
        const directlyReferredUsers = await User.find({ 'gamification.referredBy': userId })
            .select('_id username createdAt avatar');

        // 2. Get users linked via CoinTransactions (Reconciliation fallback)
        // This ensures if a reward was given (transaction exists) but 'referredBy' link is broken/missing, we still show them.
        const referralTransactions = await CoinTransaction.find({
            userId: userObjectId,
            source: 'referral',
            type: 'credit',
            referenceModel: 'User'
        }).select('referenceId amount description createdAt');

        const transactionUserIds = referralTransactions
            .map(tx => tx.referenceId)
            .filter(id => id); // Filter nulls

        // 3. Combine unique User IDs
        const uniqueUserIds = [...new Set([
            ...directlyReferredUsers.map(u => u._id.toString()),
            ...transactionUserIds.map(id => id.toString())
        ])];

        // 4. Fetch details for all unique users (in case some were only in transactions)
        const allReferredUsers = await User.find({ _id: { $in: uniqueUserIds } })
            .select('username createdAt avatar')
            .sort({ createdAt: -1 });

        // 5. Construct Final List (handling deleted users by checking transactions)
        const finalReferredUsers = uniqueUserIds.map(id => {
            const userProfile = allReferredUsers.find(u => u._id.toString() === id.toString());

            if (userProfile) {
                return {
                    id: userProfile._id,
                    username: userProfile.username,
                    avatar: userProfile.avatar,
                    joinedAt: userProfile.createdAt
                };
            }

            // Fallback: Try to find name from transaction history if user is deleted/missing
            const tx = referralTransactions.find(t => t.referenceId && t.referenceId.toString() === id.toString());
            let fallbackName = "Unknown User";
            if (tx && tx.description) {
                // expecting format: "Referral bonus for inviting [Name]"
                const match = tx.description.match(/inviting\s+(.*?)(\s*\(|$)/); // Matches name until "(" or end
                if (match && match[1]) fallbackName = match[1];
            }

            return {
                id: id,
                username: fallbackName,
                avatar: null, // Default placeholder will be used
                joinedAt: tx ? tx.createdAt : new Date(),
                isDeleted: true
            };
        });

        const totalEarned = referralTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

        return {
            referralsCount: uniqueUserIds.length,
            totalEarned,
            referredUsers: finalReferredUsers
        };
    }

    /**
     * Expire (Freeze) Coins for a user
     * @param {string} userId
     * @param {Object} session
     */
    async expireCoins(userId, session = null) {
        const user = await User.findById(userId).session(session);
        if (!user || !user.gamification) {
            return { success: false, message: 'User not found' };
        }

        const now = new Date();
        // Find expired transactions that still have remaining balance
        const expiredCredits = await CoinTransaction.find({
            userId,
            type: 'credit',
            expiryDate: { $lte: now },
            remainingBalance: { $gt: 0 }
        }).session(session);

        if (expiredCredits.length === 0) {
            return { success: false, message: 'No coins to expire' };
        }

        let totalExpired = 0;
        for (const tx of expiredCredits) {
            totalExpired += tx.remainingBalance;
            tx.remainingBalance = 0;
            await tx.save({ session });
        }

        if (totalExpired > 0) {
            user.gamification.setuCoinsBalance = Math.max(0, user.gamification.setuCoinsBalance - totalExpired);
            user.gamification.frozenCoins = (user.gamification.frozenCoins || 0) + totalExpired;

            await user.save({ session });

            // Record Transaction
            const transaction = new CoinTransaction({
                userId,
                type: 'debit',
                amount: totalExpired,
                source: 'other',
                description: 'Coins Expired (Tx Based)',
                balanceAfter: user.gamification.setuCoinsBalance
            });
            await transaction.save({ session });
        }

        return {
            success: true,
            frozenAmount: totalExpired
        };
    }

    /**
     * Process Monthly Leaderboard Rewards
     * Run this on the 1st of every month to reward previous month's winners.
     */
    async processMonthlyLeaderboardRewards() {
        console.log('🏆 Starting Monthly Leaderboard Reward Processing...');

        // 1. Calculate Date Range (Previous Month)
        const now = new Date();
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        const monthName = startOfLastMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
        console.log(`   Processing for period: ${monthName}`);

        // 2. Aggregate Transactions to find Top Earners
        const leaderboard = await CoinTransaction.aggregate([
            {
                $match: {
                    type: 'credit',
                    // Exclude rewards/adjustments to prevent feedback loops and ensure fair play
                    source: {
                        $in: [
                            'signup_bonus',
                            'profile_completion',
                            'rent_payment',
                            'rent_streak_bonus',
                            'review_reward',
                            'referral',
                            'other' // Including other for now, but usually should be specific
                        ]
                    },
                    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
                }
            },
            {
                $group: {
                    _id: '$userId',
                    totalEarned: { $sum: '$amount' }
                }
            },
            { $sort: { totalEarned: -1 } },
            { $limit: 3 }
        ]);

        if (leaderboard.length === 0) {
            console.log('   No eligible users found for rewards.');
            return;
        }

        // 3. Define Rewards
        const rewards = [1000, 500, 200]; // 1st, 2nd, 3rd

        for (let i = 0; i < leaderboard.length; i++) {
            const winnerId = leaderboard[i]._id;
            const amount = rewards[i];
            const rank = i + 1;

            try {
                // Check if already rewarded (Idempotency)
                // We use source 'monthly_leaderboard_reward'
                const existingReward = await CoinTransaction.findOne({
                    userId: winnerId,
                    type: 'credit',
                    source: 'monthly_leaderboard_reward',
                    description: { $regex: new RegExp(`Rank #${rank} - ${monthName}`) }
                });

                if (existingReward) {
                    console.log(`   ⚠️ Reward already given to ${winnerId} for Rank ${rank}`);
                    continue;
                }

                // Credit the user
                await this.credit({
                    userId: winnerId,
                    amount: amount,
                    source: 'monthly_leaderboard_reward',
                    description: `Monthly Leaderboard Bonus - Rank #${rank} - ${monthName}`,
                });

                // Fetch user details for email
                const user = await User.findById(winnerId);
                if (user) {
                    await sendLeaderboardBonusEmail(
                        user.email,
                        user.username || 'UrbanSetu User',
                        rank,
                        amount,
                        monthName
                    );
                    console.log(`   ✅ Rewarded ${user.username} (Rank ${rank}): ${amount} coins`);
                }

            } catch (err) {
                console.error(`   ❌ Failed to process reward for Rank ${rank} (User: ${winnerId}):`, err);
            }
        }

        console.log('🏆 Monthly Leaderboard Processing Complete.');
    }
}


export default new CoinService();
