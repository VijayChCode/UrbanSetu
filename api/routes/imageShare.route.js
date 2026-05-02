import express from 'express';
import { verifyToken, optionalAuth } from '../utils/verify.js';
import {
    createShareLink,
    resolveShareLink,
    revokeShareLink,
    getMyShares
} from '../controllers/imageShare.controller.js';

const router = express.Router();

// Public: Resolve a share token to image URL (no auth needed)
router.get('/resolve/:token', resolveShareLink);

// Public/Protected: Create a share link (works for both guests and logged-in users)
router.post('/share', optionalAuth, createShareLink);

// Protected: Revoke a share link
router.delete('/share/:token', verifyToken, revokeShareLink);

// Protected: Get all share links created by the current user
router.get('/my-shares', verifyToken, getMyShares);

export default router;
