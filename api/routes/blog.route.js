import express from 'express';
import {
    getBlogs,
    getBlog,
    createBlog,
    updateBlog,
    deleteBlog,
    likeBlog,
    checkUserLike,
    addComment,
    deleteComment,
    updateComment,
    getBlogCategories,
    getBlogTags,
    getBlogAnalytics,
    getLikedBlogs
} from '../controllers/blog.controller.js';
import { verifyToken, optionalAuth } from '../utils/verify.js';

const router = express.Router();

// Public routes
router.get('/', optionalAuth, getBlogs); // GET /api/blogs?propertyId=123&category=Real Estate Tips&tag=investment
router.get('/categories', getBlogCategories); // GET /api/blogs/categories
router.get('/tags', getBlogTags); // GET /api/blogs/tags
router.get('/user/liked', verifyToken, getLikedBlogs); // GET /api/blogs/user/liked
router.get('/:id', optionalAuth, getBlog); // GET /api/blogs/:id (by ID or slug)

// Protected routes (require authentication)
router.get('/:id/like-status', verifyToken, checkUserLike); // GET /api/blogs/:id/like-status
router.post('/:id/like', verifyToken, likeBlog); // POST /api/blogs/:id/like
router.post('/:id/comment', verifyToken, addComment); // POST /api/blogs/:id/comment
router.delete('/:id/comment/:commentId', verifyToken, deleteComment); // DELETE /api/blogs/:id/comment/:commentId
router.put('/:id/comment/:commentId', verifyToken, updateComment); // PUT /api/blogs/:id/comment/:commentId

// Admin routes (protected)
router.get('/stats/analytics', verifyToken, getBlogAnalytics); // GET /api/blogs/stats/analytics
router.post('/', verifyToken, createBlog); // POST /api/blogs
router.put('/:id', verifyToken, updateBlog); // PUT /api/blogs/:id
router.delete('/:id', verifyToken, deleteBlog); // DELETE /api/blogs/:id

export default router;
