import express from 'express'
import { createListing,deleteListing,updateListing,getListing,getListings,getUserListings} from '../controllers/listing.controller.js'
import { verifyToken } from '../utils/verify.js'
const router =express.Router()

router.post("/create",verifyToken,createListing)
router.get("/user",verifyToken,getUserListings)
router.delete("/delete/:id",verifyToken,deleteListing)
router.post("/update/:id",verifyToken,updateListing)
router.get("/get/:id",getListing)
router.get("/get",getListings)

export default router