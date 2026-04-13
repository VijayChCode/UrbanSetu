import express from 'express';
import { verifyToken } from '../utils/verify.js';
import {
    createShareLink,
    resolveShareLink,
    revokeShareLink,
    getMyShares
} from '../controllers/videoShare.controller.js';

const router = express.Router();

// Public: Resolve a share token to video URL (no auth needed)
router.get('/resolve/:token', resolveShareLink);

// Protected: Create a share link
router.post('/share', verifyToken, createShareLink);

// Protected: Revoke a share link
router.delete('/share/:token', verifyToken, revokeShareLink);

// Protected: Get all share links created by the current user
router.get('/my-shares', verifyToken, getMyShares);

export default router;
