import mongoose from 'mongoose';

const trustDocumentSchema = new mongoose.Schema({
    category: {
        type: String,
        required: true,
        enum: ['device_compatibility', 'readme', 'safety_declaration', 'privacy_policy', 'terms_of_service', 'checksum'],
        unique: true,
        trim: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    url: {
        type: String,
        required: true,
        trim: true,
    },
    fileKey: {
        type: String,
        trim: true,
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});

const TrustDocument = mongoose.model('TrustDocument', trustDocumentSchema);

export default TrustDocument;
