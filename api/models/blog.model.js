import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true,
        trim: true
    },
    content: {
        type: String,
        required: true
    },
    excerpt: {
        type: String,
        maxlength: 500
    },
    thumbnail: {
        type: String // Cloudinary image URL
    },
    imageUrls: [{
        type: String // Array of Cloudinary image URLs
    }],
    videoUrls: [{
        type: String // Array of Cloudinary video URLs
    }],
    propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Listing',
        default: null // null = global blog
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    tags: [{
        type: String,
        trim: true
    }],
    category: {
        type: String,
        enum: ['Real Estate Tips', 'Market Updates', 'Investment Guide', 'Home Buying', 'Home Selling', 'Property Management', 'Legal', 'Finance', 'Rent', 'Investment', 'City Guide'],
        default: 'Real Estate Tips'
    },
    type: {
        type: String,
        enum: ['blog', 'guide'],
        default: 'blog'
    },
    featured: {
        type: Boolean,
        default: false
    },
    published: {
        type: Boolean,
        default: false
    },
    publishedAt: {
        type: Date,
        default: null
    },
    scheduledAt: {
        type: Date,
        default: null
    },
    views: {
        type: Number,
        default: 0
    },
    likes: {
        type: Number,
        default: 0
    },
    comments: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        content: String,
        createdAt: {
            type: Date,
            default: Date.now
        },
        isApproved: {
            type: Boolean,
            default: false
        },
        isEdited: {
            type: Boolean,
            default: false
        }
    }]
}, {
    timestamps: true
});

// Index for search functionality
blogSchema.index({ title: 'text', content: 'text', tags: 'text' });
blogSchema.index({ publishedAt: -1 });
blogSchema.index({ category: 1 });
blogSchema.index({ propertyId: 1, published: 1 });
blogSchema.index({ published: 1, publishedAt: -1 });
// Note: slug index is automatically created by unique: true

// Generate slug from title before saving, ensuring uniqueness
blogSchema.pre('save', async function () {
    if (this.isModified('title')) {
        let generatedSlug = this.title
            .toLowerCase()
            .replace(/[^a-z0-9 -]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-');

        if (!generatedSlug) {
            generatedSlug = 'post';
        }

        const BlogModel = this.constructor;
        let slugExists = await BlogModel.findOne({ slug: generatedSlug, _id: { $ne: this._id } });

        if (slugExists) {
            let count = 1;
            let tempSlug = `${generatedSlug}-${count}`;
            while (await BlogModel.findOne({ slug: tempSlug, _id: { $ne: this._id } })) {
                count++;
                tempSlug = `${generatedSlug}-${count}`;
            }
            generatedSlug = tempSlug;
        }

        this.slug = generatedSlug;
    }
});

export default mongoose.model('Blog', blogSchema);
