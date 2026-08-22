import express from 'express';
import {
    getAgents,
    getAgent,
    applyAgent,
    getAllAgentsAdmin,
    updateAgentStatus,
    updateAgentProfile,
    deleteAgent,
    checkMyAgentStatus,
    createAgentReview,
    getAgentReviews,
    deleteAgentReview,
    updateAgentReview
} from '../controllers/agent.controller.js';
import { verifyToken, verifyAdmin, optionalAuth } from '../utils/verify.js';

const router = express.Router();

// Public Routes
router.get('/', getAgents);
router.get('/profile/:id', optionalAuth, getAgent); // Public profile view with optional user context

// User Routes
router.get('/status/me', verifyToken, checkMyAgentStatus);
router.post('/apply', verifyToken, applyAgent);
router.put('/update/me', verifyToken, updateAgentProfile);
router.post('/review/:id', verifyToken, createAgentReview);
router.get('/reviews/:id', getAgentReviews);
router.put('/review/:reviewId', verifyToken, updateAgentReview);
router.delete('/review/:reviewId', verifyToken, deleteAgentReview);

// Admin Routes
router.get('/admin/all', verifyToken, verifyAdmin, getAllAgentsAdmin);
router.patch('/admin/status/:id', verifyToken, verifyAdmin, updateAgentStatus);
router.delete('/admin/delete/:id', verifyToken, verifyAdmin, deleteAgent);

export default router;
