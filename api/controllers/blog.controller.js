import Blog from '../models/blog.model.js';
import Listing from '../models/listing.model.js';
import User from '../models/user.model.js';
import BlogLike from '../models/blogLike.model.js';
import BlogView from '../models/blogView.model.js';
import Subscription from '../models/subscription.model.js';
import crypto from 'crypto';
import { sendCommentEditedEmail, sendCommentDeletedEmail, sendNewBlogNotification } from '../utils/emailService.js';

// Helper function to generate fingerprint for public users
const generateFingerprint = (req) => {
    const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent') || '';
    const combined = `${ip}-${userAgent}`;
    return crypto.createHash('sha256').update(combined).digest('hex');
};

// Helper function to handle view counting with role-based logic
const handleViewCount = async (blogId, req) => {
    try {
        const user = req.user;
        const isAdmin = user && (user.role === 'admin' || user.role === 'rootadmin');

        // Skip view counting for admins
        if (isAdmin) {
            console.log(`Admin view ignored for blog ${blogId}`);
            return { shouldIncrement: false, reason: 'admin_view' };
        }

        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        if (user) {
            // Logged-in user: check for existing view
            const existingView = await BlogView.findOne({
                blogId,
                userId: user.id
            });

            if (!existingView) {
                // First time viewing this blog
                await BlogView.create({
                    blogId,
                    userId: user.id,
                    viewedAt: now
                });
                return { shouldIncrement: true, reason: 'first_user_view' };
            } else if (existingView.viewedAt < twentyFourHoursAgo) {
                // User viewed before, but more than 24 hours ago - allow recount
                existingView.viewedAt = now;
                await existingView.save();
                return { shouldIncrement: true, reason: 'returning_user_view' };
            } else {
                // User viewed within 24 hours - don't count
                return { shouldIncrement: false, reason: 'recent_user_view' };
            }
        } else {
            // Public user: use fingerprint
            const fingerprint = generateFingerprint(req);

            const existingView = await BlogView.findOne({
                blogId,
                fingerprint
            });

            if (!existingView) {
                // First time viewing this blog from this device/browser
                await BlogView.create({
                    blogId,
                    fingerprint,
                    viewedAt: now,
                    userAgent: req.get('User-Agent'),
                    ipAddress: req.ip || req.connection.remoteAddress
                });
                return { shouldIncrement: true, reason: 'first_public_view' };
            } else if (existingView.viewedAt < twentyFourHoursAgo) {
                // Public user viewed before, but more than 24 hours ago - allow recount
                existingView.viewedAt = now;
                await existingView.save();
                return { shouldIncrement: true, reason: 'returning_public_view' };
            } else {
                // Public user viewed within 24 hours - don't count
                return { shouldIncrement: false, reason: 'recent_public_view' };
            }
        }
    } catch (error) {
        console.error('Error handling view count:', error);
        // Fallback: don't increment on error
        return { shouldIncrement: false, reason: 'error' };
    }
};

// Helper function to publish scheduled blogs
export const publishScheduledBlogs = async () => {
    try {
        const now = new Date();
        // Find blogs that are due for publication
        const scheduledBlogs = await Blog.find({
            published: false,
            scheduledAt: { $lte: now, $ne: null }
        });

        if (scheduledBlogs.length > 0) {
            console.log(`Auto-publishing ${scheduledBlogs.length} scheduled blogs...`);
            for (const blog of scheduledBlogs) {
                // Atomic check to prevent race conditions (especially when called from multiple requests)
                const freshBlog = await Blog.findOneAndUpdate(
                    { _id: blog._id, published: false },
                    {
                        $set: {
                            published: true,
                            publishedAt: blog.scheduledAt || now,
                            scheduledAt: null
                        }
                    },
                    { new: true }
                );

                if (freshBlog) {
                    console.log(`- Published: "${freshBlog.title}" (ID: ${freshBlog._id})`);
                    // Send notifications - AWAIT this to ensure it completes before next loop
                    // or before the process/request potentially terminates
                    await sendBlogNotifications(freshBlog);
                }
            }
            console.log('Auto-publishing task completed.');
        }
    } catch (error) {
        console.error('Error in publishScheduledBlogs:', error);
    }
};

// Helper function to send blog notifications
const sendBlogNotifications = async (blog) => {
    try {
        const isGuide = blog.type === 'guide';
        const preferenceQuery = isGuide ? { 'preferences.guide': true } : { 'preferences.blog': true };

        const subscribers = await Subscription.find({
            status: 'approved',
            ...preferenceQuery
        }).select('email');

        if (subscribers.length === 0) {
            console.log(`No approved subscribers found for ${blog.type || 'blog'} notifications.`);
            return;
        }

        console.log(`Sending ${blog.type || 'blog'} notification for "${blog.title}" to ${subscribers.length} subscribers...`);

        // Use a plain object to avoid any Mongoose proxy issues in the email service
        const blogData = blog.toObject ? blog.toObject() : blog;

        // Process subscribers in chunks or one by one
        // One by one is safer for error handling but slower
        for (const sub of subscribers) {
            try {
                await sendNewBlogNotification(sub.email, 'Subscriber', blogData);
            } catch (err) {
                console.error(`Failed to send blog notification to ${sub.email}:`, err.message);
            }
        }
        console.log(`Successfully completed notifications for "${blog.title}".`);
    } catch (error) {
        console.error('Error in sendBlogNotifications:', error);
    }
};

// Helper function to cleanup old view records (optional - can be called periodically)
const cleanupOldViews = async () => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const result = await BlogView.deleteMany({
            viewedAt: { $lt: thirtyDaysAgo }
        });
        console.log(`Cleaned up ${result.deletedCount} old view records`);
        return result.deletedCount;
    } catch (error) {
        console.error('Error cleaning up old views:', error);
        return 0;
    }
};

// Get blogs with filtering
export const getBlogs = async (req, res, next) => {
    try {
        // Auto-publish any due scheduled blogs
        await publishScheduledBlogs();

        const {
            propertyId,
            category,
            tag,
            search,
            published,
            type,
            featured,
            page = 1,
            limit = 10
        } = req.query;

        // Build query
        const query = {};


        if (published === 'true') {
            query.published = true;
        } else if (published === 'false') {
            query.published = false;
        } else if (published === 'all') {
            // Don't add any published filter for 'all'
        } else if (!published) {
            // Default to published only if no published parameter is provided
            query.published = true;
        }

        // Filter by type (default to showing all if specific type not requested, or maybe default to 'blog' if strict?)
        // The requirement implies /blogs shows everything (or maybe just blogs), /guides shows guides.
        // Let's allow filtering. If type is provided, use it.
        if (type === 'blog') {
            query.type = { $in: ['blog', null] };
        } else if (type === 'all') {
            // Do not restrict type, fetch both
        } else if (type) {
            query.type = type;
        }

        if (featured === 'true') {
            query.featured = true;
        }

        if (propertyId) {
            if (propertyId === 'null') {
                // Filter for global blogs (no propertyId or propertyId is null)
                query.$or = [
                    { propertyId: { $exists: false } },
                    { propertyId: null }
                ];
            } else if (propertyId === 'exists') {
                // Filter for property-specific blogs (has propertyId and not null)
                query.propertyId = { $exists: true, $ne: null };
            } else {
                // Filter for specific property
                query.propertyId = propertyId;
            }
        }

        if (category) {
            // Support multi-select categories
            const categories = category.split(',').map(c => c.trim()).filter(Boolean);
            if (categories.length > 0) {
                query.category = { $in: categories };
            }
        }

        if (tag) {
            // Support multi-select tags
            const tags = tag.split(',').map(t => t.trim()).filter(Boolean);
            if (tags.length > 0) {
                query.tags = { $in: tags };
            }
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            const searchQuery = [
                { title: searchRegex },
                { content: searchRegex },
                { category: searchRegex },
                { tags: { $in: [searchRegex] } }
            ];

            if (query.$or) {
                query.$and = [
                    { $or: query.$or },
                    { $or: searchQuery }
                ];
                delete query.$or;
            } else {
                query.$or = searchQuery;
            }
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);


        // Get blogs with pagination
        const blogs = await Blog.find(query)
            .populate('propertyId', 'name city state')
            .populate('author', 'username role email')
            .sort({ publishedAt: -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));


        // Get total count for pagination
        const total = await Blog.countDocuments(query);

        // Transform author names for admin/rootadmin users
        const transformedBlogs = blogs.map(blog => {
            const blogObj = blog.toObject();
            // Only mask for non-rootadmin users
            if (!req.user || req.user.role !== 'rootadmin') {
                if (blogObj.author && (blogObj.author.role === 'admin' || blogObj.author.role === 'rootadmin')) {
                    blogObj.author.username = 'UrbanSetuBlogManagement';
                    delete blogObj.author.email; // Hide email for non-rootadmins
                }
            }
            return blogObj;
        });

        res.status(200).json({
            success: true,
            data: transformedBlogs,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        next(error);
    }
};

// Get single blog by ID or slug
export const getBlog = async (req, res, next) => {
    try {
        const { id } = req.params;

        let blog = null;

        // Check if id is a valid ObjectId (24 hex characters)
        const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);

        if (isValidObjectId) {
            // Try to find by ID first
            blog = await Blog.findById(id)
                .populate('propertyId', 'name city state')
                .populate('author', 'username role email')
                .populate('comments.user', 'username role');
        }

        if (!blog) {
            // Try to find by slug
            blog = await Blog.findOne({ slug: id })
                .populate('propertyId', 'name city state')
                .populate('author', 'username role email')
                .populate('comments.user', 'username role');
        }

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: 'Blog not found'
            });
        }

        // Only show published blogs to non-admin users
        if (!blog.published && req.user?.role !== 'admin') {
            return res.status(404).json({
                success: false,
                message: 'Blog not found'
            });
        }

        // Handle view counting with role-based logic
        const viewResult = await handleViewCount(blog._id, req);

        if (viewResult.shouldIncrement) {
            blog.views += 1;
            await blog.save();
            console.log(`View incremented for blog ${blog._id}: ${viewResult.reason}`);
        } else {
            console.log(`View not incremented for blog ${blog._id}: ${viewResult.reason}`);
        }

        // Transform author and comment user names for admin/rootadmin users
        const blogObj = blog.toObject();
        // Only mask for non-rootadmin users
        if (!req.user || req.user.role !== 'rootadmin') {
            if (blogObj.author && (blogObj.author.role === 'admin' || blogObj.author.role === 'rootadmin')) {
                blogObj.author.username = 'UrbanSetuBlogManagement';
                delete blogObj.author.email; // Hide email for non-rootadmins
            }
        }

        // Transform comment user names for admin/rootadmin users
        if (blogObj.comments) {
            blogObj.comments = blogObj.comments.map(comment => {
                if (comment.user && (comment.user.role === 'admin' || comment.user.role === 'rootadmin')) {
                    comment.user.username = 'UrbanSetuBlogManagement';
                }
                return comment;
            });
        }

        res.status(200).json({
            success: true,
            data: blogObj
        });
    } catch (error) {
        next(error);
    }
};

// Create blog (Admin only)
export const createBlog = async (req, res, next) => {
    try {
        const {
            title,
            content,
            excerpt,
            thumbnail,
            imageUrls,
            videoUrls,
            propertyId,
            tags,
            category,
            type,
            featured,
            published,
            scheduledAt
        } = req.body;
        const author = req.user.id;

        // Validate required fields
        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Title and content are required'
            });
        }

        // Validate property exists if propertyId provided
        if (propertyId) {
            const property = await Listing.findById(propertyId);
            if (!property) {
                return res.status(400).json({
                    success: false,
                    message: 'Property not found'
                });
            }
        }

        const blogData = {
            title,
            content,
            excerpt: excerpt || content.slice(0, 200) + '...',
            thumbnail,
            imageUrls: imageUrls || [],
            videoUrls: videoUrls || [],
            propertyId: propertyId || null,
            author,
            tags: tags || [],
            category: category || 'Real Estate Tips',
            type: type || 'blog',
            featured: featured || false,
            published: published || false,
            publishedAt: published ? new Date() : (scheduledAt ? null : null),
            scheduledAt: (!published && scheduledAt) ? new Date(scheduledAt) : null
        };

        const blog = await Blog.create(blogData);

        // Populate the created blog
        await blog.populate([
            { path: 'propertyId', select: 'name city state' },
            { path: 'author', select: 'username' }
        ]);

        // Send notifications (awaited to ensure delivery)
        if (blog.published) {
            await sendBlogNotifications(blog);
        }

        res.status(201).json({
            success: true,
            message: 'Blog created successfully',
            data: blog
        });
    } catch (error) {
        next(error);
    }
};

// Update blog (Admin only)
export const updateBlog = async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            title,
            content,
            excerpt,
            thumbnail,
            imageUrls,
            videoUrls,
            propertyId,
            tags,
            category,
            type,
            featured,
            published,
            scheduledAt
        } = req.body;

        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).json({
                success: false,
                message: 'Blog not found'
            });
        }

        const wasPublished = blog.published;

        // Validate property exists if propertyId provided
        if (propertyId) {
            const property = await Listing.findById(propertyId);
            if (!property) {
                return res.status(400).json({
                    success: false,
                    message: 'Property not found'
                });
            }
        }

        // Update fields
        if (title) blog.title = title;
        if (content) blog.content = content;
        if (excerpt) blog.excerpt = excerpt;
        if (thumbnail) blog.thumbnail = thumbnail;
        if (imageUrls !== undefined) blog.imageUrls = imageUrls;
        if (videoUrls !== undefined) blog.videoUrls = videoUrls;
        if (propertyId !== undefined) {
            blog.propertyId = propertyId === '' ? null : propertyId;
        }
        if (tags) blog.tags = tags;
        if (category) blog.category = category;
        if (type) blog.type = type;
        if (featured !== undefined) blog.featured = featured;
        if (published !== undefined) {
            blog.published = published;
            if (published) {
                if (!blog.publishedAt) {
                    blog.publishedAt = new Date();
                }
                blog.scheduledAt = null; // Clear scheduling if manually published
            }
        }
        if (scheduledAt !== undefined) {
            blog.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
            if (blog.scheduledAt && blog.published) {
                blog.published = false; // Unpublish if scheduled for future
                blog.publishedAt = null;
            }
        }

        await blog.save();

        // Populate the updated blog
        await blog.populate([
            { path: 'propertyId', select: 'name city state' },
            { path: 'author', select: 'username' }
        ]);

        // Send notifications (awaited to ensure delivery)
        if (!wasPublished && blog.published) {
            await sendBlogNotifications(blog);
        }

        res.status(200).json({
            success: true,
            message: 'Blog updated successfully',
            data: blog
        });
    } catch (error) {
        next(error);
    }
};

// Delete blog (Admin only)
export const deleteBlog = async (req, res, next) => {
    try {
        const { id } = req.params;

        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).json({
                success: false,
                message: 'Blog not found'
            });
        }

        await Blog.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Blog deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Check if user has liked a blog
export const checkUserLike = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const existingLike = await BlogLike.findOne({ userId, blogId: id });

        res.status(200).json({
            success: true,
            data: {
                isLiked: !!existingLike
            }
        });
    } catch (error) {
        next(error);
    }
};

// Like/Unlike blog
export const likeBlog = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).json({
                success: false,
                message: 'Blog not found'
            });
        }

        // Check if user has already liked this blog
        const existingLike = await BlogLike.findOne({ userId, blogId: id });

        if (existingLike) {
            // Unlike: Remove the like and decrement count
            await BlogLike.deleteOne({ userId, blogId: id });
            blog.likes = Math.max(0, blog.likes - 1);
            await blog.save();

            res.status(200).json({
                success: true,
                message: 'Blog unliked',
                data: {
                    likes: blog.likes,
                    isLiked: false
                }
            });
        } else {
            // Like: Add the like and increment count
            await BlogLike.create({ userId, blogId: id });
            blog.likes += 1;
            await blog.save();

            res.status(200).json({
                success: true,
                message: 'Blog liked',
                data: {
                    likes: blog.likes,
                    isLiked: true
                }
            });
        }
    } catch (error) {
        next(error);
    }
};

// Add comment to blog
export const addComment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        if (!content) {
            return res.status(400).json({
                success: false,
                message: 'Comment content is required'
            });
        }

        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).json({
                success: false,
                message: 'Blog not found'
            });
        }

        // Get user info to check role
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check comment limits for regular users (not admins)
        if (user.role !== 'admin' && user.role !== 'rootadmin') {
            const userCommentsOnBlog = blog.comments.filter(comment =>
                comment.user.toString() === userId.toString()
            ).length;

            const maxCommentsPerBlog = 5; // Limit to 5 comments per blog for regular users

            if (userCommentsOnBlog >= maxCommentsPerBlog) {
                return res.status(429).json({
                    success: false,
                    message: `You have reached the maximum limit of ${maxCommentsPerBlog} comments for this blog.`
                });
            }
        }

        const newComment = {
            user: userId,
            content,
            isApproved: false // Comments need approval
        };

        blog.comments.push(newComment);
        await blog.save();

        // Populate the comment
        await blog.populate('comments.user', 'username role');

        // Transform the comment user name for admin/rootadmin users
        const commentData = blog.comments[blog.comments.length - 1].toObject();
        if (commentData.user && (commentData.user.role === 'admin' || commentData.user.role === 'rootadmin')) {
            commentData.user.username = 'UrbanSetuBlogManagement';
        }

        res.status(201).json({
            success: true,
            message: 'Comment added successfully (pending approval)',
            data: commentData
        });
    } catch (error) {
        next(error);
    }
};

// Delete comment
export const deleteComment = async (req, res, next) => {
    try {
        const { id, commentId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).json({
                success: false,
                message: 'Blog not found'
            });
        }

        const commentIndex = blog.comments.findIndex(c => c._id.toString() === commentId);
        if (commentIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }

        const comment = blog.comments[commentIndex];

        // Authorization check: Admin can delete any, user can only delete own
        if (userRole !== 'admin' && userRole !== 'rootadmin' && comment.user.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this comment'
            });
        }

        // Send email if admin deletes another user's comment
        if ((userRole === 'admin' || userRole === 'rootadmin') && comment.user.toString() !== userId) {
            // We need to populate the user to get email
            await blog.populate('comments.user');
            const populatedComment = blog.comments[commentIndex];
            if (populatedComment.user && populatedComment.user.email) {
                sendCommentDeletedEmail(
                    populatedComment.user.email,
                    populatedComment.user.username,
                    blog.title,
                    blog._id,
                    comment.content
                ).catch(err => console.error("Failed to send comment deleted email:", err));
            }
        }

        // Remove comment
        blog.comments.splice(commentIndex, 1);
        await blog.save();

        res.status(200).json({
            success: true,
            message: 'Comment deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Update comment
export const updateComment = async (req, res, next) => {
    try {
        const { id, commentId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        if (!content) {
            return res.status(400).json({
                success: false,
                message: 'Content is required'
            });
        }

        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).json({
                success: false,
                message: 'Blog not found'
            });
        }

        const comment = blog.comments.id(commentId);
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }

        // Authorization check: User can only update own
        // Note: The original requirement only allowed checking own. User request implies admin can now edit too?
        // "if admin deletes or edits the other users blog comment".
        // The current code I see in view_file (lines 667-673) says:
        // if (userRole !== 'admin' && userRole !== 'rootadmin' && comment.user.toString() !== userId)
        // So admin CAN already edit (logicwise). The restriction comment "// Authorization check: User can only update own" was slightly misleading or just old.
        // The code allows admin or rootadmin or owner.

        if (userRole !== 'admin' && userRole !== 'rootadmin' && comment.user.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this comment'
            });
        }

        // Send email if admin edits another user's comment
        if ((userRole === 'admin' || userRole === 'rootadmin') && comment.user.toString() !== userId) {
            await blog.populate('comments.user');
            const populatedComment = blog.comments.id(commentId);
            if (populatedComment.user && populatedComment.user.email) {
                sendCommentEditedEmail(
                    populatedComment.user.email,
                    populatedComment.user.username,
                    blog.title,
                    blog._id,
                    content // New content
                ).catch(err => console.error("Failed to send comment edited email:", err));
            }
        }

        if (comment.content !== content) {
            comment.content = content;
            comment.isEdited = true;
        }
        await blog.save();

        // Populate and return updated comment
        await blog.populate('comments.user', 'username role');
        const updatedComment = blog.comments.id(commentId).toObject();

        if (updatedComment.user && (updatedComment.user.role === 'admin' || updatedComment.user.role === 'rootadmin')) {
            updatedComment.user.username = 'UrbanSetuBlogManagement';
        }

        res.status(200).json({
            success: true,
            message: 'Comment updated successfully',
            data: updatedComment
        });
    } catch (error) {
        next(error);
    }
};

// Get blog categories
export const getBlogCategories = async (req, res, next) => {
    try {
        const { type } = req.query;

        // Define filters for DB lookup
        const filter = {};
        if (type) filter.type = type;

        // If not an admin, only show categories from published posts to keep it clean
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'rootadmin');
        if (!isAdmin) {
            filter.published = true;
        }

        const dbCategories = await Blog.distinct('category', filter);

        const BLOG_CATEGORIES = [
            'Real Estate Tips',
            'Market Updates',
            'Investment Guide',
            'Home Buying',
            'Home Selling',
            'Property Management',
            'Legal',
            'Finance',
            'Rent',
            'Investment'
        ];

        const GUIDE_CATEGORIES = [
            'Home Buying',
            'Rent',
            'Home Selling',
            'Legal',
            'Investment',
            'City Guide'
        ];

        let defaultCategories = [];
        if (type === 'blog') {
            defaultCategories = BLOG_CATEGORIES;
        } else if (type === 'guide') {
            defaultCategories = GUIDE_CATEGORIES;
        } else {
            defaultCategories = [...new Set([...BLOG_CATEGORIES, ...GUIDE_CATEGORIES])];
        }

        // Always return all default categories for the requested type, plus any custom ones in DB
        const allCategories = [...new Set([...defaultCategories, ...dbCategories])];

        res.status(200).json({
            success: true,
            data: allCategories
        });
    } catch (error) {
        next(error);
    }
};

// Get blog tags
export const getBlogTags = async (req, res, next) => {
    try {
        const { type } = req.query;
        const filter = {};
        if (type) filter.type = type;

        // If not an admin, only show tags from published posts
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'rootadmin');
        if (!isAdmin) {
            filter.published = true;
        }

        const tags = await Blog.distinct('tags', filter);

        res.status(200).json({
            success: true,
            data: tags
        });
    } catch (error) {
        next(error);
    }
};

// Get blog analytics
export const getBlogAnalytics = async (req, res, next) => {
    try {
        const { type } = req.query; // 'blog', 'guide', or undefined/all
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Build base type filter to match getBlogs logic (legacy blogs are 'blog' by default)
        let typeFilter = {};
        if (type === 'blog') {
            typeFilter = { type: { $in: ['blog', null] } };
        } else if (type && type !== 'all') {
            typeFilter = { type };
        }

        // Find relevant blog IDs for the type if filtering
        let blogIds = null;
        if (type && type !== 'all') {
            const blogs = await Blog.find(typeFilter).select('_id');
            blogIds = blogs.map(b => b._id);
        }

        // Group views by date
        const viewMatch = { viewedAt: { $gte: thirtyDaysAgo } };
        if (blogIds) viewMatch.blogId = { $in: blogIds };

        const viewsData = await BlogView.aggregate([
            { $match: viewMatch },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$viewedAt" } },
                    views: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Group likes by date
        const likeMatch = { createdAt: { $gte: thirtyDaysAgo } };
        if (blogIds) likeMatch.blogId = { $in: blogIds };

        const likesData = await BlogLike.aggregate([
            { $match: likeMatch },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    likes: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Get total stats
        const summaryMatch = typeFilter;
        const totalStats = await Blog.aggregate([
            { $match: summaryMatch },
            {
                $group: {
                    _id: null,
                    totalViews: { $sum: "$views" },
                    totalLikes: { $sum: "$likes" },
                    totalBlogs: { $sum: 1 },
                    publishedBlogs: { $sum: { $cond: ["$published", 1, 0] } }
                }
            }
        ]);

        // Merge view and like data for frontend
        const last30Days = [];
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            const viewEntry = viewsData.find(v => v._id === dateStr);
            const likeEntry = likesData.find(l => l._id === dateStr);

            last30Days.push({
                date: dateStr,
                views: viewEntry ? viewEntry.views : 0,
                likes: likeEntry ? likeEntry.likes : 0
            });
        }

        res.status(200).json({
            success: true,
            data: {
                daily: last30Days,
                summary: totalStats[0] || {
                    totalViews: 0,
                    totalLikes: 0,
                    totalBlogs: 0,
                    publishedBlogs: 0
                }
            }
        });
    } catch (error) {
        next(error);
    }
};
