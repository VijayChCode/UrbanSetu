import express from 'express';
import { verifyToken } from '../utils/verify.js';
import { getBalance, getHistory, getReferralStats, getUserBalance, adminAdjustCoins, getLeaderboard, getStats, getSystemTransactions, resolveReferralCode } from '../controllers/coin.controller.js';

const router = express.Router();

// User routes
router.get('/balance', verifyToken, getBalance);
router.get('/history', verifyToken, getHistory);
router.get('/referral-stats', verifyToken, getReferralStats);
router.get('/leaderboard', verifyToken, getLeaderboard);

// Admin routes
router.get('/admin/stats', verifyToken, getStats);
router.get('/admin/transactions', verifyToken, getSystemTransactions);
router.get('/user/:userId/balance', verifyToken, getUserBalance); // Middleware checks role in controller
router.post('/admin/adjust', verifyToken, adminAdjustCoins); // Middleware checks role in controller

// Public routes (no auth)
router.get('/resolve-referral/:code', resolveReferralCode);

export default router;
