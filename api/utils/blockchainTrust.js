import User from "../models/user.model.js";

/**
 * Recalculates and updates the Blockchain Trust Score for a user.
 * Trust Score (0-100) Components:
 * - Wallet Linked: 10 pts
 * - Rental Payment Streak: 2 pts per month (max 40 pts)
 * - Identity Verification (Verified Landlord): 20 pts
 * - Loyalty Badges: 5 pts per badge (max 30 pts)
 * 
 * @param {string} userId - The user ID to update
 * @returns {Promise<number>} - The new trust score
 */
export const calculateAndUpdateTrustScore = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) throw new Error("User not found");

        let score = 0;

        // 1. Wallet Linked (Base Score)
        if (user.blockchain?.walletAddress) {
            score += 10;
        }

        // 2. Rental Payment Streak
        if (user.gamification?.currentStreak) {
            const streakPoints = Math.min(user.gamification.currentStreak * 2, 40);
            score += streakPoints;
        }

        // 3. Identity Verification
        if (user.rentalProfile?.verifiedLandlord) {
            score += 20;
        }

        // 4. Loyalty Badges
        if (user.gamification?.badges && user.gamification.badges.length > 0) {
            const badgePoints = Math.min(user.gamification.badges.length * 5, 30);
            score += badgePoints;
        }

        // Update the user model
        if (!user.blockchain) {
            user.blockchain = {
                walletAddress: null,
                network: 'none',
                linkedAt: null,
                trustScore: 0
            };
        }

        user.blockchain.trustScore = score;
        await user.save();

        return score;
    } catch (error) {
        console.error("Error calculating Trust Score:", error);
        return 0;
    }
};
