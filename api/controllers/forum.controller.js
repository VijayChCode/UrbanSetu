import ForumPost from '../models/forumPost.model.js';
import User from '../models/user.model.js';
import { errorHandler } from '../utils/error.js';
import { escapeRegex } from '../utils/regex.js';
import { sendCommunityPostConfirmationEmail, sendCommunityReportAcknowledgementEmail, sendPostLockedEmail, sendPostDeletedEmail, sendPostEditedEmail, sendPostUnlockedEmail } from '../utils/emailService.js';
import { notifyAdminsOfCommunityReport } from './notification.controller.js';

const maskUser = (user) => {
    if (user && (user.profileVisibility === 'private' || user.profileVisibility === 'friends')) {
        return {
            ...user,
            username: 'UrbanSetu Member',
            avatar: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
            email: undefined,
            isVerified: false,
            profileVisibility: 'private' // Treat friends only as private for public forum
        };
    }
    return user;
};

const processReplyPrivacy = (reply) => {
    if (!reply) return reply;
    const r = reply.toObject ? reply.toObject() : reply;
    if (r.user) r.user = maskUser(r.user);
    if (r.replyToUser) r.replyToUser = maskUser(r.replyToUser);
    return r;
};

const processCommentPrivacy = (comment) => {
    if (!comment) return comment;
    const c = comment.toObject ? comment.toObject() : comment;
    if (c.user) c.user = maskUser(c.user);
    if (c.replies) {
        c.replies = c.replies.map(processReplyPrivacy);
    }
    return c;
};

const processPostPrivacy = (post) => {
    if (!post) return post;
    const p = post.toObject ? post.toObject() : post;

    if (p.author) p.author = maskUser(p.author);
    if (p.comments) {
        p.comments = p.comments.map(processCommentPrivacy);
    }
    return p;
};

export const createPost = async (req, res, next) => {
    try {
        const { title, content, category, location, images } = req.body;

        const newPost = new ForumPost({
            author: req.user.id,
            title,
            content,
            category,
            location,
            images
        });

        const savedPost = await newPost.save();

        // Populate author details
        const populatedPost = await ForumPost.findById(savedPost._id)
            .populate('author', 'username avatar email type isVerified profileVisibility')
            .exec();

        req.app.get('io').emit('forum:postCreated', populatedPost);

        // Send confirmation email asynchronously
        sendCommunityPostConfirmationEmail(
            populatedPost.author.email,
            populatedPost.author.username,
            populatedPost.title,
            populatedPost._id
        ).catch(err => console.error("Failed to send community post email:", err));

        res.status(201).json(processPostPrivacy(populatedPost));
    } catch (error) {
        next(error);
    }
};

export const getPosts = async (req, res, next) => {
    try {
        const { city, neighborhood, category, sort, limit = 10, skip = 0, userId, postId } = req.query;

        let query = {};

        if (postId) {
            query._id = postId;
        } else {
            if (userId) query.author = userId;

            if (city) query['location.city'] = { $regex: escapeRegex(city), $options: 'i' };
            if (neighborhood) query['location.neighborhood'] = { $regex: escapeRegex(neighborhood), $options: 'i' };
            if (req.query.searchTerm) {
                query.$or = [
                    { title: { $regex: escapeRegex(req.query.searchTerm), $options: 'i' } },
                    { content: { $regex: escapeRegex(req.query.searchTerm), $options: 'i' } }
                ];
            }
            if (category === 'Reported') {
                query.$or = [
                    { reports: { $exists: true, $not: { $size: 0 } } },
                    { 'comments.reports': { $exists: true, $not: { $size: 0 } } },
                    { 'comments.replies.reports': { $exists: true, $not: { $size: 0 } } }
                ];
            } else if (category && category !== 'All') {
                query.category = category;
            }
        }

        const sortOption = sort === 'popular' ? { isPinned: -1, 'likes': -1, createdAt: -1 } : { isPinned: -1, createdAt: -1 };

        const posts = await ForumPost.find(query)
            .populate('author', 'username avatar email type isVerified profileVisibility')
            .populate('comments.user', 'username avatar profileVisibility')
            .populate('comments.replies.user', 'username avatar profileVisibility')
            .populate('comments.replies.replyToUser', 'username profileVisibility')
            .sort(sortOption)
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await ForumPost.countDocuments(query);

        res.status(200).json({ posts: posts.map(processPostPrivacy), total, hasMore: total > parseInt(skip) + posts.length });
    } catch (error) {
        next(error);
    }
};

export const getPostById = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id)
            .populate('author', 'username avatar email type isVerified profileVisibility')
            .populate('comments.user', 'username avatar')
            .populate('comments.replies.user', 'username avatar profileVisibility')
            .populate('comments.replies.replyToUser', 'username profileVisibility');

        if (!post) return next(errorHandler(404, 'Post not found'));

        // Increment view count
        post.viewCount += 1;
        await post.save();

        res.status(200).json(processPostPrivacy(post));
    } catch (error) {
        next(error);
    }
};

export const deletePost = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post) return next(errorHandler(404, 'Post not found'));

        if (req.user.id !== post.author.toString() && req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return next(errorHandler(403, 'You are not allowed to delete this post'));
        }

        await ForumPost.findByIdAndDelete(req.params.id);
        req.app.get('io').emit('forum:postDeleted', req.params.id);

        // Send email if deleted by admin (not author)
        if (req.user.id !== post.author.toString()) {
            const author = await User.findById(post.author);
            if (author) {
                sendPostDeletedEmail(author.email, author.username, post.title)
                    .catch(err => console.error("Failed to send post deleted email:", err));
            }
        }

        res.status(200).json('The post has been deleted');
    } catch (error) {
        next(error);
    }
};

export const togglePin = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post) return next(errorHandler(404, 'Post not found'));

        if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return next(errorHandler(403, 'You are not allowed to pin posts'));
        }

        post.isPinned = !post.isPinned;
        await post.save();
        await post.populate('author', 'username avatar email type isVerified profileVisibility');
        req.app.get('io').emit('forum:postUpdated', post);
        res.status(200).json(processPostPrivacy(post));
    } catch (error) {
        next(error);
    }
};

export const likePost = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post) return next(errorHandler(404, 'Post not found'));

        const likeIndex = post.likes.indexOf(req.user.id);
        const dislikeIndex = post.dislikes?.indexOf(req.user.id) ?? -1;

        if (likeIndex === -1) {
            post.likes.push(req.user.id);
            // Remove from dislikes if present
            if (dislikeIndex !== -1) {
                post.dislikes.splice(dislikeIndex, 1);
            }
        } else {
            post.likes.splice(likeIndex, 1);
        }

        await post.save();
        await post.populate('author', 'username avatar type profileVisibility');
        req.app.get('io').emit('forum:postUpdated', post);
        res.status(200).json(processPostPrivacy(post));
    } catch (error) {
        next(error);
    }
};

export const dislikePost = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post) return next(errorHandler(404, 'Post not found'));

        const dislikeIndex = post.dislikes.indexOf(req.user.id);
        const likeIndex = post.likes.indexOf(req.user.id);

        if (dislikeIndex === -1) {
            post.dislikes.push(req.user.id);
            // Remove from likes if present
            if (likeIndex !== -1) {
                post.likes.splice(likeIndex, 1);
            }
        } else {
            post.dislikes.splice(dislikeIndex, 1);
        }

        await post.save();
        await post.populate('author', 'username avatar type profileVisibility');
        req.app.get('io').emit('forum:postUpdated', post);
        res.status(200).json(post);
    } catch (error) {
        next(error);
    }
};

export const addComment = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post) return next(errorHandler(404, 'Post not found'));
        if (post.isLocked && req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return next(errorHandler(403, 'This discussion is locked'));
        }

        const { content } = req.body;
        const newComment = {
            user: req.user.id,
            content,
        };

        post.comments.push(newComment);
        await post.save();

        // Re-fetch to populate user
        const updatedPost = await ForumPost.findById(req.params.id)
            .populate('comments.user', 'username avatar profileVisibility');

        // Return the last added comment (which is now populated)
        const addedComment = updatedPost.comments[updatedPost.comments.length - 1];

        req.app.get('io').emit('forum:commentAdded', { postId: req.params.id, comment: addedComment });

        res.status(200).json(processCommentPrivacy(addedComment));
    } catch (error) {
        next(error);
    }
};

export const deleteComment = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post) return next(errorHandler(404, 'Post not found'));

        const comment = post.comments.id(req.params.commentId);
        if (!comment) return next(errorHandler(404, 'Comment not found'));

        if (req.user.id !== comment.user.toString() && req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return next(errorHandler(403, 'You are not allowed to delete this comment'));
        }

        // comment.deleteOne();
        comment.isDeleted = true;
        comment.deletedBy = req.user.id;

        await post.save();
        // Emit updated event instead of deleted, so frontend can re-render as "deleted"
        // We emit 'forum:postUpdated' or specific event. Let's use commentUpdated to trigger re-render of that comment
        // But commentUpdated payload usually is the comment object.
        req.app.get('io').emit('forum:commentUpdated', { postId: req.params.id, comment: comment });
        res.status(200).json('Comment has been deleted');
    } catch (error) {
        next(error);
    }
};

export const updateComment = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post) return next(errorHandler(404, 'Post not found'));

        const comment = post.comments.id(req.params.commentId);
        if (!comment) return next(errorHandler(404, 'Comment not found'));

        if (req.user.id !== comment.user.toString() && req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return next(errorHandler(403, 'You are not allowed to edit this comment'));
        }

        if (req.body.content !== comment.content) {
            comment.content = req.body.content;
            comment.isEdited = true;
        }
        await post.save();

        // Re-fetch to populate user (and ensure fresh data)
        const updatedPost = await ForumPost.findById(req.params.id).populate('comments.user', 'username avatar');
        const updatedComment = updatedPost.comments.id(req.params.commentId);

        req.app.get('io').emit('forum:commentUpdated', { postId: req.params.id, comment: updatedComment });
        res.status(200).json(processCommentPrivacy(updatedComment));
    } catch (error) {
        next(error);
    }
};

export const addReply = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post) return next(errorHandler(404, 'Post not found'));

        if (post.isLocked && req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return next(errorHandler(403, 'This discussion is locked'));
        }

        const comment = post.comments.id(req.params.commentId);
        if (!comment) return next(errorHandler(404, 'Comment not found'));

        const { content, replyToUser, parentReplyId } = req.body;
        const newReply = {
            user: req.user.id,
            replyToUser: replyToUser || null,
            parentReplyId: parentReplyId || null,
            content
        };

        comment.replies.push(newReply);
        await post.save();

        const updatedPost = await ForumPost.findById(req.params.id)
            .populate('comments.replies.user', 'username avatar profileVisibility')
            .populate('comments.replies.replyToUser', 'username profileVisibility');

        const updatedComment = updatedPost.comments.id(req.params.commentId);
        const addedReply = updatedComment.replies[updatedComment.replies.length - 1];

        req.app.get('io').emit('forum:replyAdded', { postId: req.params.id, commentId: req.params.commentId, reply: addedReply });

        res.status(200).json(processReplyPrivacy(addedReply));
    } catch (error) {
        next(error);
    }
};

export const deleteReply = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post) return next(errorHandler(404, 'Post not found'));

        const comment = post.comments.id(req.params.commentId);
        if (!comment) return next(errorHandler(404, 'Comment not found'));

        const reply = comment.replies.id(req.params.replyId);
        if (!reply) return next(errorHandler(404, 'Reply not found'));

        if (req.user.id !== reply.user.toString() && req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return next(errorHandler(403, 'Not authorized'));
        }

        // reply.deleteOne();
        reply.isDeleted = true;
        reply.deletedBy = req.user.id;

        await post.save();
        // Emit replyUpdated so frontend can re-render
        req.app.get('io').emit('forum:replyUpdated', { postId: req.params.id, commentId: req.params.commentId, reply: reply });
        res.status(200).json('Reply deleted');
    } catch (error) {
        next(error);
    }
};

export const updateReply = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post) return next(errorHandler(404, 'Post not found'));

        const comment = post.comments.id(req.params.commentId);
        if (!comment) return next(errorHandler(404, 'Comment not found'));

        const reply = comment.replies.id(req.params.replyId);
        if (!reply) return next(errorHandler(404, 'Reply not found'));

        if (req.user.id !== reply.user.toString() && req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return next(errorHandler(403, 'Not authorized'));
        }

        if (req.body.content !== reply.content) {
            reply.content = req.body.content;
            reply.isEdited = true;
        }
        await post.save();

        const updatedPost = await ForumPost.findById(req.params.id)
            .populate('comments.replies.user', 'username avatar profileVisibility');

        const updatedComment = updatedPost.comments.id(req.params.commentId);
        const updatedReply = updatedComment.replies.id(req.params.replyId);

        req.app.get('io').emit('forum:replyUpdated', { postId: req.params.id, commentId: req.params.commentId, reply: updatedReply });
        res.status(200).json(processReplyPrivacy(updatedReply));
    } catch (error) {
        next(error);
    }
};

export const likeComment = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post) return next(errorHandler(404, 'Post not found'));

        const comment = post.comments.id(req.params.commentId);
        if (!comment) return next(errorHandler(404, 'Comment not found'));

        const likeIndex = comment.likes.indexOf(req.user.id);
        const dislikeIndex = comment.dislikes?.indexOf(req.user.id) ?? -1;

        if (likeIndex === -1) {
            comment.likes.push(req.user.id);
            if (dislikeIndex !== -1) {
                comment.dislikes.splice(dislikeIndex, 1);
            }
        } else {
            comment.likes.splice(likeIndex, 1);
        }

        await post.save();
        await post.populate('author', 'username avatar email type isVerified profileVisibility');
        await post.populate('comments.user', 'username avatar profileVisibility');
        await post.populate('comments.replies.user', 'username avatar profileVisibility');
        await post.populate('comments.replies.replyToUser', 'username profileVisibility');
        req.app.get('io').emit('forum:postUpdated', post);
        res.status(200).json(processPostPrivacy(post));
    } catch (error) {
        next(error);
    }
};

export const dislikeComment = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post) return next(errorHandler(404, 'Post not found'));

        const comment = post.comments.id(req.params.commentId);
        if (!comment) return next(errorHandler(404, 'Comment not found'));

        const dislikeIndex = comment.dislikes.indexOf(req.user.id);
        const likeIndex = comment.likes.indexOf(req.user.id);

        if (dislikeIndex === -1) {
            comment.dislikes.push(req.user.id);
            if (likeIndex !== -1) {
                comment.likes.splice(likeIndex, 1);
            }
        } else {
            comment.dislikes.splice(dislikeIndex, 1);
        }

        await post.save();
        await post.populate('author', 'username avatar email type isVerified profileVisibility');
        await post.populate('comments.user', 'username avatar profileVisibility');
        await post.populate('comments.replies.user', 'username avatar profileVisibility');
        await post.populate('comments.replies.replyToUser', 'username profileVisibility');
        req.app.get('io').emit('forum:postUpdated', post);
        res.status(200).json(processPostPrivacy(post));
    } catch (error) {
        next(error);
    }
};

export const likeReply = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post) return next(errorHandler(404, 'Post not found'));

        const comment = post.comments.id(req.params.commentId);
        if (!comment) return next(errorHandler(404, 'Comment not found'));

        const reply = comment.replies.id(req.params.replyId);
        if (!reply) return next(errorHandler(404, 'Reply not found'));

        const likeIndex = reply.likes.indexOf(req.user.id);
        const dislikeIndex = reply.dislikes?.indexOf(req.user.id) ?? -1;

        if (likeIndex === -1) {
            reply.likes.push(req.user.id);
            if (dislikeIndex !== -1) {
                reply.dislikes.splice(dislikeIndex, 1);
            }
        } else {
            reply.likes.splice(likeIndex, 1);
        }

        await post.save();
        await post.populate('author', 'username avatar email type isVerified profileVisibility');
        await post.populate('comments.user', 'username avatar profileVisibility');
        await post.populate('comments.replies.user', 'username avatar profileVisibility');
        await post.populate('comments.replies.replyToUser', 'username profileVisibility');
        req.app.get('io').emit('forum:postUpdated', post);
        res.status(200).json(processPostPrivacy(post));
    } catch (error) {
        next(error);
    }
};

export const dislikeReply = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post) return next(errorHandler(404, 'Post not found'));

        const comment = post.comments.id(req.params.commentId);
        if (!comment) return next(errorHandler(404, 'Comment not found'));

        const reply = comment.replies.id(req.params.replyId);
        if (!reply) return next(errorHandler(404, 'Reply not found'));

        const dislikeIndex = reply.dislikes.indexOf(req.user.id);
        const likeIndex = reply.likes.indexOf(req.user.id);

        if (dislikeIndex === -1) {
            reply.dislikes.push(req.user.id);
            if (likeIndex !== -1) {
                reply.likes.splice(likeIndex, 1);
            }
        } else {
            reply.dislikes.splice(dislikeIndex, 1);
        }

        await post.save();
        await post.populate('author', 'username avatar email type isVerified profileVisibility');
        await post.populate('comments.user', 'username avatar profileVisibility');
        await post.populate('comments.replies.user', 'username avatar profileVisibility');
        await post.populate('comments.replies.replyToUser', 'username profileVisibility');
        req.app.get('io').emit('forum:postUpdated', post);
        res.status(200).json(processPostPrivacy(post));
    } catch (error) {
        next(error);
    }
};

export const getCommunityStats = async (req, res, next) => {
    try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const dailyPosts = await ForumPost.countDocuments({ createdAt: { $gte: oneDayAgo } });

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const eventsThisWeek = await ForumPost.countDocuments({ category: 'Events', createdAt: { $gte: sevenDaysAgo } });

        // Get accurate user count from User model as requested
        const activeMembers = await User.countDocuments();

        // Get top 3 trending topics based on likes + comments count
        // Get top 3 trending topics based on comprehensive engagement including deeper interactions
        const trendingTopics = await ForumPost.aggregate([
            {
                $addFields: {
                    // Level 1: Post interactions
                    postInteractions: { $add: [{ $size: { $ifNull: ["$likes", []] } }, { $size: { $ifNull: ["$dislikes", []] } }] },

                    // Level 2: Direct comments count
                    commentCount: { $size: { $ifNull: ["$comments", []] } },

                    // Level 3: Nested replies count
                    replyCount: {
                        $sum: {
                            $map: {
                                input: { $ifNull: ["$comments", []] },
                                as: "c",
                                in: { $size: { $ifNull: ["$$c.replies", []] } }
                            }
                        }
                    },

                    // Level 4: Comment likes/dislikes
                    commentInteractions: {
                        $sum: {
                            $map: {
                                input: { $ifNull: ["$comments", []] },
                                as: "c",
                                in: {
                                    $add: [
                                        { $size: { $ifNull: ["$$c.likes", []] } },
                                        { $size: { $ifNull: ["$$c.dislikes", []] } }
                                    ]
                                }
                            }
                        }
                    },

                    // Level 5: Reply likes/dislikes
                    replyInteractions: {
                        $sum: {
                            $map: {
                                input: { $ifNull: ["$comments", []] },
                                as: "c",
                                in: {
                                    $sum: {
                                        $map: {
                                            input: { $ifNull: ["$$c.replies", []] },
                                            as: "r",
                                            in: {
                                                $add: [
                                                    { $size: { $ifNull: ["$$r.likes", []] } },
                                                    { $size: { $ifNull: ["$$r.dislikes", []] } }
                                                ]
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    // Weighted Score: Comments and Replies are worth more (3x), Interactions (1x), Views (0.1x)
                    trendScore: {
                        $add: [
                            "$postInteractions",
                            { $multiply: ["$commentCount", 3] },
                            { $multiply: ["$replyCount", 3] },
                            "$commentInteractions",
                            "$replyInteractions",
                            // Add a small factor for View Count to break ties
                            { $multiply: [{ $ifNull: ["$viewCount", 0] }, 0.1] }
                        ]
                    }
                }
            },
            { $sort: { trendScore: -1 } },
            { $limit: 3 }, // Top 3
            { $project: { title: 1, _id: 1, trendScore: 1 } }
        ]);

        res.status(200).json({
            activeMembers: activeMembers || 0,
            dailyPosts,
            eventsThisWeek,
            trendingTopics
        });
    } catch (error) {
        next(error);
    }
};



export const lockPost = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post) return next(errorHandler(404, 'Post not found'));

        if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return next(errorHandler(403, 'Not authorized'));
        }

        post.isLocked = !post.isLocked;
        await post.save();
        await post.populate('author', 'username avatar email type isVerified');
        req.app.get('io').emit('forum:postUpdated', post);

        // Send email notification based on lock status
        if (post.isLocked) {
            sendPostLockedEmail(post.author.email, post.author.username, post.title, post._id)
                .catch(err => console.error("Failed to send post locked email:", err));
        } else {
            sendPostUnlockedEmail(post.author.email, post.author.username, post.title, post._id)
                .catch(err => console.error("Failed to send post unlocked email:", err));
        }

        res.status(200).json(post);
    } catch (error) {
        next(error);
    }
};

export const reportPost = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post) return next(errorHandler(404, 'Post not found'));

        const existingReport = post.reports.find(r => r.user.toString() === req.user.id);
        if (existingReport) return next(errorHandler(400, 'You have already reported this post'));

        post.reports.push({
            user: req.user.id,
            reason: req.body.reason || 'Spam/Inappropriate'
        });
        await post.save();

        // Send acknowledgement email
        User.findById(req.user.id).select('email username').then(user => {
            if (user) {
                sendCommunityReportAcknowledgementEmail(
                    user.email,
                    user.username,
                    'Discussion',
                    post.title,
                    req.body.reason || 'Spam/Inappropriate',
                    post._id
                ).catch(err => console.error("Failed to send report email:", err));
            }
        });

        // Notify admins
        User.findById(req.user.id).then(reporter => {
            if (reporter) {
                notifyAdminsOfCommunityReport(req.app, reporter, post, 'Post', req.body.reason || 'Spam/Inappropriate', post.content);
            }
        });

        res.status(200).json('Post reported successfully');
    } catch (error) {
        next(error);
    }
};

export const reportComment = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post) return next(errorHandler(404, 'Post not found'));

        const comment = post.comments.id(req.params.commentId);
        if (!comment) return next(errorHandler(404, 'Comment not found'));

        const existingReport = comment.reports?.find(r => r.user.toString() === req.user.id);
        if (existingReport) return next(errorHandler(400, 'You have already reported this comment'));

        comment.reports.push({
            user: req.user.id,
            reason: req.body.reason || 'Spam/Inappropriate'
        });
        await post.save();

        // Send acknowledgement email
        User.findById(req.user.id).select('email username').then(user => {
            if (user) {
                sendCommunityReportAcknowledgementEmail(
                    user.email,
                    user.username,
                    'Comment',
                    post.title,
                    req.body.reason || 'Spam/Inappropriate',
                    post._id
                ).catch(err => console.error("Failed to send report email:", err));
            }
        });

        // Notify admins
        User.findById(req.user.id).then(reporter => {
            if (reporter) {
                notifyAdminsOfCommunityReport(req.app, reporter, post, 'Comment', req.body.reason || 'Spam/Inappropriate', comment.content);
            }
        });

        res.status(200).json('Comment reported successfully');
    } catch (error) {
        next(error);
    }
};

export const reportReply = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post) return next(errorHandler(404, 'Post not found'));

        const comment = post.comments.id(req.params.commentId);
        if (!comment) return next(errorHandler(404, 'Comment not found'));

        const reply = comment.replies.id(req.params.replyId);
        if (!reply) return next(errorHandler(404, 'Reply not found'));

        const existingReport = reply.reports?.find(r => r.user.toString() === req.user.id);
        if (existingReport) return next(errorHandler(400, 'You have already reported this reply'));

        reply.reports.push({
            user: req.user.id,
            reason: req.body.reason || 'Spam/Inappropriate'
        });
        await post.save();

        // Send acknowledgement email
        User.findById(req.user.id).select('email username').then(user => {
            if (user) {
                sendCommunityReportAcknowledgementEmail(
                    user.email,
                    user.username,
                    'Reply',
                    post.title,
                    req.body.reason || 'Spam/Inappropriate',
                    post._id
                ).catch(err => console.error("Failed to send report email:", err));
            }
        });

        // Notify admins
        User.findById(req.user.id).then(reporter => {
            if (reporter) {
                notifyAdminsOfCommunityReport(req.app, reporter, post, 'Reply', req.body.reason || 'Spam/Inappropriate', reply.content);
            }
        });

        res.status(200).json('Reply reported successfully');
    } catch (error) {
        next(error);
    }
};

export const getSuggestions = async (req, res, next) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(200).json([]);

        const posts = await ForumPost.find({
            title: { $regex: escapeRegex(q), $options: 'i' }
        }).select('title').limit(5);

        res.status(200).json(posts);
    } catch (error) {
        next(error);
    }
};

export const updatePost = async (req, res, next) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        if (!post) return next(errorHandler(404, 'Post not found'));

        if (req.user.id !== post.author.toString() && req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return next(errorHandler(403, 'You are not allowed to update this post'));
        }

        const { title, content, category, location } = req.body;
        const isChanged = (title && title !== post.title) || 
                          (content && content !== post.content) ||
                          (category && category !== post.category) ||
                          (location && JSON.stringify(location) !== JSON.stringify(post.location));
        if (title) post.title = title;
        if (content) post.content = content;
        if (category) post.category = category;
        if (location) post.location = location;
        if (isChanged) post.isEdited = true;

        await post.save();

        // Fully populate to prevent data loss on frontend
        await post.populate('author', 'username avatar email type isVerified profileVisibility');
        await post.populate('comments.user', 'username avatar profileVisibility');
        await post.populate('comments.replies.user', 'username avatar profileVisibility');
        await post.populate('comments.replies.replyToUser', 'username profileVisibility');

        req.app.get('io').emit('forum:postUpdated', post);

        // Send email if updated by admin (not author)
        if (req.user.id !== post.author._id.toString()) {
            sendPostEditedEmail(post.author.email, post.author.username, post.title, post._id)
                .catch(err => console.error("Failed to send post edited email:", err));
        }

        res.status(200).json(processPostPrivacy(post));
    } catch (error) {
        next(error);
    }
};
