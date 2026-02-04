import mongoose from "mongoose";

const coinTransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ["credit", "debit"],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 1
    },
    source: {
        type: String,
        enum: [
            "signup_bonus",
            "profile_completion",
            "rent_payment",
            "rent_streak_bonus",
            "review_reward",
            "referral",
            "payment_reward",
            "admin_adjustment",
            "redemption_rent_fee",
            "redemption_coupon",
            "monthly_leaderboard_reward",
            "other"
        ],
        required: true
    },
    referenceId: { // ID of the Payment, Review, or User (referral)
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'referenceModel'
    },
    referenceModel: {
        type: String, // Can be dynamic: 'Payment', 'Review', 'User', etc.
        enum: ['Payment', 'Review', 'User', 'AdminLog', 'Listing', null]
    },
    description: {
        type: String,
        trim: true
    },
    balanceAfter: { // Snapshot of balance at the time of transaction for easy audits
        type: Number
    },
    expiryDate: { // For credit transactions: when this specific amount expires
        type: Date
    },
    remainingBalance: { // For credit transactions: how much of this specific credit is still unspent (FIFO)
        type: Number
    },
    adminId: { // If updated by admin
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

const CoinTransaction = mongoose.model("CoinTransaction", coinTransactionSchema);
export default CoinTransaction;
