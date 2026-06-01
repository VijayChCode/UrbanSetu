import User from "../models/user.model.js";
import CoinTransaction from "../models/coinTransaction.model.js";

/**
 * Awards SetuCoins to a user
 * @param {string} userId - The user ID
 * @param {number} amount - Amount of coins to award
 * @param {string} source - Source of the reward (e.g., 'profile_completion')
 * @param {string} description - Description for the transaction
 * @param {string|null} referenceId - Optional reference ID (e.g., reviewId)
 * @param {string|null} referenceModel - Optional reference model name
 * @returns {Promise<Object>} - Result with new balance
 */
export const awardSetuCoins = async (userId, amount, source, description, referenceId = null, referenceModel = null) => {
    try {
        // Use atomic $inc to prevent race conditions and stale overwrites.
        // Previously used user.save() which could overwrite concurrent $inc 
        // operations from CoinService.credit(), resetting the balance.
        const user = await User.findByIdAndUpdate(
            userId,
            {
                $inc: {
                    "gamification.setuCoinsBalance": amount,
                    "gamification.totalCoinsEarned": amount
                },
                $set: { "gamification.lastCoinTransaction": new Date() }
            },
            { new: true, runValidators: true, setDefaultsOnInsert: true }
        ).select('gamification');

        if (!user) throw new Error("User not found");

        const newBalance = user.gamification.setuCoinsBalance;

        // Expiry period (standard 1 year)
        const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

        // Create Transaction Record
        await CoinTransaction.create({
            userId,
            type: 'credit',
            amount,
            source,
            description,
            referenceId,
            referenceModel,
            balanceAfter: newBalance,
            expiryDate,
            remainingBalance: amount // For FIFO tracking
        });

        return { success: true, newBalance };
    } catch (error) {
        console.error("Error awarding SetuCoins:", error);
        throw error;
    }
};

/**
 * Revokes SetuCoins from a user (Admin Action)
 * @param {string} userId - The user ID
 * @param {number} amount - Amount of coins to revoke
 * @param {string} adminId - ID of the admin performing the action
 * @param {string} reason - Reason for revocation
 * @returns {Promise<Object>} - Result with new balance
 */
export const revokeSetuCoins = async (userId, amount, adminId, reason) => {
    try {
        // First, read the current balance to calculate the actual deduction
        const currentUser = await User.findById(userId).select('gamification.setuCoinsBalance');
        if (!currentUser) throw new Error("User not found");

        const previousBalance = currentUser.gamification?.setuCoinsBalance || 0;
        // Don't go below zero
        const actualDeduction = Math.min(previousBalance, amount);

        if (actualDeduction <= 0) {
            return { success: true, newBalance: 0, deducted: 0 };
        }

        // Use atomic $inc with negative value to safely decrement
        const user = await User.findByIdAndUpdate(
            userId,
            {
                $inc: { "gamification.setuCoinsBalance": -actualDeduction }
            },
            { new: true, runValidators: true }
        ).select('gamification');

        const newBalance = user.gamification.setuCoinsBalance;

        await CoinTransaction.create({
            userId,
            type: 'debit',
            amount: actualDeduction,
            source: 'admin_adjustment',
            description: reason || 'Revoked by Admin',
            adminId,
            balanceAfter: newBalance
        });

        return { success: true, newBalance, deducted: actualDeduction };

    } catch (error) {
        console.error("Error revoking SetuCoins:", error);
        throw error;
    }
};
