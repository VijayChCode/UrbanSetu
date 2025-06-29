import express from 'express'
import { createListing,deleteListing,updateListing,getListing,getListings,getUserListings} from '../controllers/listing.controller.js'
import { verifyToken } from '../utils/verify.js'
import User from '../models/user.model.js'
import Listing from '../models/listing.model.js'
import { errorHandler } from '../utils/error.js'

const router =express.Router()

router.post("/create",verifyToken,createListing)
router.get("/user",verifyToken,getUserListings)
router.get("/user/:userId", verifyToken, async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // Check if user is admin or rootadmin
    const user = await User.findById(req.user.id);
    const isAdmin = (user && user.role === 'admin' && user.adminApprovalStatus === 'approved') || (user && user.role === 'rootadmin');
    
    // Allow admins to view any user's listings, or users to view their own listings
    if (!isAdmin && req.user.id !== userId) {
      return next(errorHandler(403, "You can only view your own listings"));
    }
    
    const listings = await Listing.find({ userRef: userId }).sort({ createdAt: -1 });
    res.status(200).json(listings);
  } catch (error) {
    next(error);
  }
});
router.delete("/delete/:id",verifyToken,deleteListing)
router.post("/update/:id",verifyToken,updateListing)
router.get("/get/:id",getListing)
router.get("/get",getListings)

export default router