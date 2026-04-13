import mongoose from "mongoose";

const adminLogSchema = new mongoose.Schema({
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false, // Changed to false to allow system-generated logs
        index: true
    },
    action: {
        type: String,
        required: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        index: true
    },
    targetModel: {
        type: String, // 'User', 'Listing', 'Property', etc.
        required: false
    },
    details: {
        type: String,
        required: false
    },
    ip: {
        type: String,
        default: 'SYSTEM'
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed, // Use Mixed instead of Map for easier JSON storage
        default: {}
    }
}, { timestamps: true });

const AdminLog = mongoose.model("AdminLog", adminLogSchema);
export default AdminLog;
