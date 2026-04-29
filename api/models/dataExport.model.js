
import mongoose from 'mongoose';

const dataExportSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    token: {
        type: String,
        required: true,
        unique: true
    },
    data: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        index: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 86400 // TTL index: documents expire 24 hours (86400 seconds) after creation
    }
}, { timestamps: true });

const DataExport = mongoose.model('DataExport', dataExportSchema);

export default DataExport;
