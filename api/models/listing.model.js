import mongoose from "mongoose";

const listingSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    propertyNumber: {
        type: String,
        required: true
    },
    landmark: {
        type: String,
        required: false
    },
    city: {
        type: String,
        required: true
    },
    district: {
        type: String,
        required: false
    },
    state: {
        type: String,
        required: true
    },
    pincode: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: false
    },
    regularPrice: {
        type: Number,
        required: true
    },
    discountPrice: {
        type: Number,
        required: true
    },
    bathrooms: {
        type: Number,
        required: true
    },
    bedrooms: {
        type: Number,
        required: true
    },
    furnished: {
        type: Boolean,
        required: true
    },
    parking: {
        type: Boolean,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    offer: {
        type: Boolean,
        required: true
    },
    imageUrls: {
        type: Array,
        required: true
    },
    locationLink: {
        type: String,
        required: false
    },
    userRef: {
        type: String,
        required: true
    },
    // Review-related fields
    averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    reviewCount: {
        type: Number,
        default: 0
    },
    totalRating: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

const Listing = mongoose.model('Listing', listingSchema);

export default Listing;
