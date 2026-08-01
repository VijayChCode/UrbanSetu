import mongoose from "mongoose";

const ownershipAuditLogSchema = new mongoose.Schema({
    propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Listing",
        required: true,
        index: true
    },
    propertyName: {
        type: String,
        required: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    adminName: {
        type: String,
        required: true
    },
    action: {
        type: String,
        enum: ["TRANSFER", "REMOVE", "ASSIGN"],
        required: true
    },
    previousOwnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    previousOwnerEmail: {
        type: String,
        default: null
    },
    newOwnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    newOwnerEmail: {
        type: String,
        default: null
    },
    reason: {
        type: String,
        required: true
    },
    ipAddress: {
        type: String,
        default: "Unknown"
    },
    userAgent: {
        type: String,
        default: "Unknown"
    }
}, { timestamps: true });

const OwnershipAuditLog = mongoose.model("OwnershipAuditLog", ownershipAuditLogSchema);
export default OwnershipAuditLog;
