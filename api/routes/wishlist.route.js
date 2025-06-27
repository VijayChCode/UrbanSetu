import express from 'express';
import { 
    getUserWishlist, 
    addToWishlist, 
    removeFromWishlist, 
    checkWishlistStatus,
    getWishlistCount 
} from '../controllers/wishlist.controller.js';
import { verifyToken } from '../utils/verify.js';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Get user's wishlist
router.get('/user/:userId', getUserWishlist);

// Add item to wishlist
router.post('/add', addToWishlist);

// Remove item from wishlist
router.delete('/remove/:listingId', removeFromWishlist);

// Check if item is in wishlist
router.get('/check/:listingId', checkWishlistStatus);

// Get wishlist count
router.get('/count', getWishlistCount);

export default router; 