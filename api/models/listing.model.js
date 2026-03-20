import mongoose from "mongoose";

const availabilityMetaSchema = new mongoose.Schema({
    lockReason: {
        type: String,
        enum: ['booking_pending', 'awaiting_payment', 'contract_in_progress', 'active_rental', 'sale_in_progress', 'admin_hold', 'sold'],
        default: null
    },
    lockDescription: {
        type: String,
        default: null,
        maxlength: 400
    },
    lockedAt: {
        type: Date,
        default: null
    },
    releasedAt: {
        type: Date,
        default: null
    },
    releaseReason: {
        type: String,
        default: null
    },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        default: null
    },
    contractId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RentLockContract',
        default: null
    }
}, { _id: false });

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
    // Optional property videos (Cloudinary URLs or external links)
    videoUrls: {
        type: Array,
        required: false,
        default: []
    },
    virtualTourImages: {
        type: Array,
        required: false,
        default: []
    },
    // AI Virtual Staging Results (Before/After)
    virtualStagingResults: [{
        originalImage: String,
        stagedImage: String,
        style: String,
        timestamp: { type: Date, default: Date.now }
    }],
    aiAuditResults: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },
    imageCaptions: {
        type: Map,
        of: String,
        default: {}
    },
    locationLink: {
        type: String,
        required: false
    },
    area: {
        type: Number,
        required: false
    },
    floor: {
        type: Number,
        required: false
    },
    propertyAge: {
        type: Number,
        required: false
    },
    viewCount: {
        type: Number,
        default: 0
    },
    // Availability & deal-locking metadata
    availabilityStatus: {
        type: String,
        enum: ['available', 'reserved', 'under_contract', 'rented', 'sold', 'suspended'],
        default: 'available',
        index: true
    },
    availabilityMeta: {
        type: availabilityMetaSchema,
        default: () => ({})
    },
    userRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
        default: null
    },

    // Property Verification
    isVerified: {
        type: Boolean,
        default: false,
        index: true
    },
    verificationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PropertyVerification',
        default: null
    },

    // Visibility Control (private until verified)
    visibility: {
        type: String,
        enum: ['private', 'public'],
        default: 'private',
        index: true
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
    },

    // ESG (Environmental, Social, Governance) Fields
    esg: {
        environmental: {
            energyRating: {
                type: String,
                enum: ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'Not Rated'],
                default: 'Not Rated'
            },
            carbonFootprint: {
                type: Number,
                default: 0 // CO2 emissions in kg per year
            },
            renewableEnergy: {
                type: Boolean,
                default: false
            },
            waterEfficiency: {
                type: String,
                enum: ['Excellent', 'Good', 'Average', 'Poor', 'Not Rated'],
                default: 'Not Rated'
            },
            wasteManagement: {
                type: String,
                enum: ['Excellent', 'Good', 'Average', 'Poor', 'Not Rated'],
                default: 'Not Rated'
            },
            greenCertification: {
                type: String,
                enum: ['LEED', 'BREEAM', 'GRIHA', 'IGBC', 'None'],
                default: 'None'
            },
            solarPanels: {
                type: Boolean,
                default: false
            },
            rainwaterHarvesting: {
                type: Boolean,
                default: false
            }
        },
        social: {
            accessibility: {
                type: String,
                enum: ['Fully Accessible', 'Partially Accessible', 'Not Accessible', 'Not Rated'],
                default: 'Not Rated'
            },
            communityImpact: {
                type: Number,
                default: 0 // Community benefit score (0-100)
            },
            affordableHousing: {
                type: Boolean,
                default: false
            },
            localEmployment: {
                type: Number,
                default: 0 // Number of local jobs created
            },
            socialAmenities: {
                type: [String],
                default: []
            },
            diversityInclusion: {
                type: String,
                enum: ['Excellent', 'Good', 'Average', 'Poor', 'Not Rated'],
                default: 'Not Rated'
            }
        },
        governance: {
            transparency: {
                type: String,
                enum: ['Excellent', 'Good', 'Average', 'Poor', 'Not Rated'],
                default: 'Not Rated'
            },
            ethicalStandards: {
                type: String,
                enum: ['Excellent', 'Good', 'Average', 'Poor', 'Not Rated'],
                default: 'Not Rated'
            },
            compliance: {
                type: String,
                enum: ['Fully Compliant', 'Mostly Compliant', 'Partially Compliant', 'Non-Compliant', 'Not Rated'],
                default: 'Not Rated'
            },
            riskManagement: {
                type: String,
                enum: ['Excellent', 'Good', 'Average', 'Poor', 'Not Rated'],
                default: 'Not Rated'
            },
            stakeholderEngagement: {
                type: String,
                enum: ['Excellent', 'Good', 'Average', 'Poor', 'Not Rated'],
                default: 'Not Rated'
            }
        },
        esgScore: {
            type: Number,
            default: 0 // Overall ESG score (0-100)
        },
        esgRating: {
            type: String,
            enum: ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D', 'Not Rated'],
            default: 'Not Rated'
        },
        lastEsgUpdate: {
            type: Date,
            default: Date.now
        }
    },

    // Rent-Lock Plans (for rental properties)
    rentLockPlans: {
        availablePlans: [{
            type: String,
            enum: ['1_year', '3_year', '5_year', 'custom']
        }],
        defaultPlan: {
            type: String,
            enum: ['1_year', '3_year', '5_year', 'custom'],
            default: '1_year'
        }
    },

    // Rent-specific fields
    monthlyRent: {
        type: Number,
        default: null,
        min: 0
    },
    securityDepositMonths: {
        type: Number, // Usually 2-3 months
        default: 2,
        min: 0
    },
    maintenanceCharges: {
        type: Number, // Optional monthly
        default: 0,
        min: 0
    },
    advanceRentMonths: {
        type: Number, // Optional advance
        default: 0,
        min: 0
    },


    // Locality Score (pre-computed)
    localityScore: {
        safety: {
            type: Number,
            min: 0,
            max: 10,
            default: 0
        },
        accessibility: {
            type: Number,
            min: 0,
            max: 10,
            default: 0
        },
        waterAvailability: {
            type: Number,
            min: 0,
            max: 10,
            default: 0
        },
        schools: {
            type: Number,
            min: 0,
            max: 10,
            default: 0
        },
        offices: {
            type: Number,
            min: 0,
            max: 10,
            default: 0
        },
        traffic: {
            type: Number,
            min: 0,
            max: 10,
            default: 0
        },
        grocery: {
            type: Number,
            min: 0,
            max: 10,
            default: 0
        },
        medical: {
            type: Number,
            min: 0,
            max: 10,
            default: 0
        },
        shopping: {
            type: Number,
            min: 0,
            max: 10,
            default: 0
        },
        overall: {
            type: Number,
            min: 0,
            max: 10,
            default: 0
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    },

    // Rent Prediction
    rentPrediction: {
        predictedRent: {
            type: Number,
            default: null,
            min: 0
        },
        marketAverage: {
            type: Number,
            default: null,
            min: 0
        },
        priceComparison: {
            type: String,
            enum: ['overpriced', 'fair', 'underpriced'],
            default: null
        },
        lastUpdated: {
            type: Date,
            default: null
        },
        predictionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'RentPrediction',
            default: null
        }
    },

    // Vector Embedding for AI Search
    vectorEmbedding: {
        type: [Number], // 384 dimensions for sentence-transformers/all-MiniLM-L6-v2
        select: false,   // Don't return by default to save bandwidth
        index: true
    }
}, {
    timestamps: true,
    toJSON: { flattenMaps: true },
    toObject: { flattenMaps: true }
});

const Listing = mongoose.model('Listing', listingSchema);

export default Listing;
