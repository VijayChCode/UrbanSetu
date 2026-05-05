import express from 'express';
import {
  trackVisitor,
  getDailyVisitorCount,
  getVisitorStats,
  getAllVisitors,
  clearOldVisitorLogs,
  getClientErrors,
  getVisitorById,
  getMarketingStats
} from '../controllers/visitor.controller.js';
import { verifyToken, verifyAdmin } from '../utils/verify.js';

const router = express.Router();

// Public routes
router.post('/track', trackVisitor); // Track visitor when accepting cookies
router.get('/count/daily', getDailyVisitorCount); // Get today's visitor count

// Admin routes (require authentication)
router.get('/stats', verifyToken, verifyAdmin, getVisitorStats); // Get visitor statistics
router.get('/all', verifyToken, verifyAdmin, getAllVisitors); // Get all visitors with filters
router.get('/client-errors', verifyToken, verifyAdmin, getClientErrors); // Get all client errors
router.get('/monitor/:id', verifyToken, verifyAdmin, getVisitorById); // Get single visitor details
router.get('/marketing-stats', verifyToken, verifyAdmin, getMarketingStats); // Get marketing analytics
router.delete('/cleanup', verifyToken, verifyAdmin, clearOldVisitorLogs); // Clear old visitor logs

export default router;
