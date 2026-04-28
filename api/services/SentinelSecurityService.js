import User from "../models/user.model.js";
import Listing from "../models/listing.model.js";
import AdminLog from "../models/adminLog.model.js";
import { logSecurityEvent } from "../middleware/security.js";
import { calculateAndUpdateTrustScore } from "../utils/blockchainTrust.js";

/**
 * Sentinel AI Security Service
 * Advanced fraud detection for rental transactions and identity management.
 */
class SentinelSecurityService {
    constructor() {
        // Thresholds
        this.LOCATION_MISMATCH_THRESHOLD_KM = 500; // Flag if user IP is very far from listing
        this.BYPASS_ATTEMPT_KEYWORDS = ['gpay', 'phonepe', 'paytm', 'direct transfer', 'offline payment', 'whatsapp me'];
        this.MAX_BOOKING_ATTEMPTS_PER_HOUR = 3;
    }

    /**
     * Analyzes listing content for fraudulent bypass attempts or suspicious data.
     */
    async scanListingForFraud(listingId) {
        try {
            const listing = await Listing.findById(listingId);
            if (!listing) return { safe: true };

            let fraudScore = 0;
            const reasons = [];

            // 1. Check for contact info / bypass keywords in description
            const desc = listing.description.toLowerCase();
            const foundKeywords = this.BYPASS_ATTEMPT_KEYWORDS.filter(k => desc.includes(k));
            
            if (foundKeywords.length > 0) {
                fraudScore += 0.4 * foundKeywords.length;
                reasons.push(`Escrow bypass keywords detected: ${foundKeywords.join(', ')}`);
            }

            // 2. Check for duplicate listings (same property number/address)
            const duplicates = await Listing.find({
                _id: { $ne: listingId },
                propertyNumber: listing.propertyNumber,
                pincode: listing.pincode,
                availabilityStatus: { $ne: 'sold' }
            });

            if (duplicates.length > 0) {
                fraudScore += 0.7;
                reasons.push("Multiple listings found for the same property number.");
            }

            // 3. Price Anomaly
            if (listing.regularPrice < 1000 && listing.type === 'rent') {
                fraudScore += 0.5;
                reasons.push("Unrealistically low rental price.");
            }

            const isFraudulent = fraudScore >= 0.8;
            
            if (isFraudulent) {
                await this.flagListing(listingId, 'SENTINEL_AI_CONTENT', reasons.join(' | '));
            }

            return { 
                safe: !isFraudulent, 
                score: Math.min(fraudScore, 1.0), 
                reasons 
            };
        } catch (error) {
            console.error("Sentinel Listing Scan Error:", error);
            return { safe: true };
        }
    }

    /**
     * Monitors wallet and payment behavior for anomalies.
     */
    async monitorWalletActivity(userId, transactionType, amount) {
        try {
            const user = await User.findById(userId);
            if (!user) return;

            // Flag large withdrawals without active contracts
            if (transactionType === 'withdrawal' && amount > 50000 && user.rentalProfile.activeContractsAsLandlord === 0) {
                await this.penalizeTrustScore(userId, 10, 'SUSPICIOUS_WITHDRAWAL', `Large withdrawal of ₹${amount} without active rental activity.`);
            }
        } catch (error) {
            console.error("Sentinel Wallet Monitor Error:", error);
        }
    }

    /**
     * Checks for location spoofing or account sharing.
     */
    async checkSecurityAnomalies(userId, currentIp, currentDevice) {
        try {
            const user = await User.findById(userId);
            if (!user) return { safe: true };

            // Check for device jumping (frequent logins from different devices in short time)
            const recentSessions = user.activeSessions.filter(s => 
                new Date(s.loginTime) > new Date(Date.now() - 60 * 60 * 1000)
            );

            const uniqueDevices = new Set(recentSessions.map(s => s.device)).size;
            if (uniqueDevices > 3) {
                await this.penalizeTrustScore(userId, 5, 'DEVICE_CHURN', `${uniqueDevices} unique devices in 1 hour.`);
                return { safe: false, reason: 'Account sharing detected' };
            }

            return { safe: true };
        } catch (error) {
            console.error("Sentinel Anomaly Check Error:", error);
            return { safe: true };
        }
    }

    /**
     * Penalizes trust score and logs the security event.
     */
    async penalizeTrustScore(userId, penaltyPoints, type, details) {
        try {
            const user = await User.findById(userId);
            if (!user) return;

            // Increment policy violations
            user.policyViolations = (user.policyViolations || 0) + 1;
            user.lastViolationAt = new Date();
            
            // Apply trust decay
            if (user.blockchain && user.blockchain.trustScore) {
                user.blockchain.trustScore = Math.max(0, user.blockchain.trustScore - penaltyPoints);
            }

            await user.save();

            // Log it
            logSecurityEvent('sentinel_ai_flag', { userId, type, details });

            await AdminLog.create({
                action: 'SENTINEL_AI_PENALTY',
                targetModel: 'User',
                targetId: userId,
                details: `Sentinel AI penalized user by ${penaltyPoints} pts. Reason: ${type} - ${details}`,
                metadata: { penaltyPoints, detectionType: type },
                ip: 'SYSTEM',
                userAgent: 'UrbanSetu_Sentinel_AI/3.0'
            });

            // Recalculate (to ensure standard metrics are still applied but with penalty)
            await calculateAndUpdateTrustScore(userId);
            
            return true;
        } catch (error) {
            console.error("Sentinel Penalty Error:", error);
            return false;
        }
    }

    async flagListing(listingId, type, reason) {
        try {
            const listing = await Listing.findById(listingId);
            if (!listing) return;

            // Set to suspended or private for review
            listing.visibility = 'private';
            listing.availabilityStatus = 'suspended';
            await listing.save();

            logSecurityEvent('sentinel_ai_listing_blocked', { listingId, type, reason });
            
            // Penalize owner
            if (listing.userRef) {
                await this.penalizeTrustScore(listing.userRef, 20, 'FRAUDULENT_LISTING_ATTEMPT', reason);
            }
        } catch (e) {
            console.error("Sentinel Flag Listing Error:", e);
        }
    }
}

export default new SentinelSecurityService();
