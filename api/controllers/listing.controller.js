import Listing from "../models/listing.model.js"
import Wishlist from "../models/wishlist.model.js"
import { errorHandler } from "../utils/error.js"



export const createListing=async (req,res,next)=>{
    try{
        const listing=await Listing.create(req.body)

        return res.status(201).json(listing)
    }
    catch(error){
        next(error)
    }
}

export const getUserListings=async (req,res,next)=>{
    try{
        let listings;
        if (req.user.role === 'rootadmin' || req.user.isDefaultAdmin) {
            // Root admin or default admin: show all listings
            listings = await Listing.find().sort({createdAt:-1});
        } else {
            // Regular admin or user: show only their own listings
            listings = await Listing.find({userRef:req.user.id}).sort({createdAt:-1});
        }
        res.status(200).json(listings)
    }
    catch(error){
        next(error)
    }
}

export const deleteListing=async (req,res,next)=>{
    const listing=await Listing.findById(req.params.id)

    if (!listing){
        return next(errorHandler(404,"Listing not found"))
    }

    // Allow admin, rootadmin, or isDefaultAdmin to delete any listing, regular users can only delete their own
    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'rootadmin' &&
      !req.user.isDefaultAdmin &&
      req.user.id !== listing.userRef
    ) {
      return next(errorHandler(401, 'You can only delete your own listing (unless you are admin/rootadmin)'))
    }

    try{
        // Delete the listing
        await Listing.findByIdAndDelete(req.params.id)
        
        // Delete all wishlist items associated with this listing
        await Wishlist.deleteMany({ listingId: req.params.id })
        
        res.status(200).json("Listing deleted")
    }
    catch(error){
        return next(error)
    }
    
}

export const updateListing=async (req,res,next)=>{
    const listing=await Listing.findById(req.params.id)

    if (!listing){
        return next(errorHandler(404,"Listing not found"))
    }

    // Allow admin, rootadmin, or isDefaultAdmin to edit any listing, regular users can only edit their own
    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'rootadmin' &&
      !req.user.isDefaultAdmin &&
      req.user.id !== listing.userRef
    ) {
      return next(errorHandler(401, 'You can only edit your own listing (unless you are admin/rootadmin)'))
    }

    try{
        const updateListing=await Listing.findByIdAndUpdate(req.params.id,req.body,{new:true})
        res.status(200).json(updateListing)
    }
    catch(error){
        return next(error)
    }
    
}


export const getListing =async (req,res,next)=>{
    try{
        const listing=await Listing.findById(req.params.id)
        if (!listing){
            return next(errorHandler(404,"Listing not found"))
        }
        res.status(200)
        res.json(listing)
    }
    catch(error){
        next(error)
    }
}

export const getListings=async (req,res,next)=>{
    try{
        const limit=parseInt(req.query.limit)||10
        const startIndex=parseInt(req.query.startIndex)||0 
        let offer=req.query.offer 
        if (offer===undefined || offer==='false'){
            offer={$in:[false,true]}
        }

        let furnished=req.query.furnished 
        if (furnished===undefined || furnished==='false'){
            furnished={$in:[false,true]}
        }
        let parking=req.query.parking 
        if (parking===undefined || parking==='false'){
            parking={$in:[false,true]}
        }

        let type=req.query.type 
        if (type===undefined || type==='false' || type==='all'){
            type={$in:['sale','rent']}
        }
        const searchTerm=req.query.searchTerm || ''
        const sort=req.query.sort || 'createdAt' 
        const order=req.query.order || 'desc'

        // Advanced filters
        const minPrice = req.query.minPrice ? Number(req.query.minPrice) : 0;
        const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : Number.MAX_SAFE_INTEGER;
        const city = req.query.city || '';
        const state = req.query.state || '';
        const bedrooms = req.query.bedrooms ? Number(req.query.bedrooms) : null;
        const bathrooms = req.query.bathrooms ? Number(req.query.bathrooms) : null;

        // Validate sort field to prevent injection
        const allowedSortFields = ['createdAt', 'regularPrice', 'discountPrice', 'bedrooms', 'bathrooms'];
        const sortField = allowedSortFields.includes(sort) ? sort : 'createdAt';
        const sortOrder = order === 'asc' ? 1 : -1;

        // Build query
        const query = {
            name:{$regex:searchTerm,$options:'i'},
            offer,
            furnished,
            parking,
            type,
            regularPrice: { $gte: minPrice, $lte: maxPrice },
        };
        if (city) query.city = { $regex: city, $options: 'i' };
        if (state) query.state = { $regex: state, $options: 'i' };
        if (bedrooms) query.bedrooms = bedrooms;
        if (bathrooms) query.bathrooms = bathrooms;

        const listings=await Listing.find(query)
            .sort({[sortField]:sortOrder})
            .limit(limit)
            .skip(startIndex)

        return res.status(200).json(listings)
    }   
    catch(error){
        console.error('Error in getListings:', error);
        return res.status(500).json([]);
    }
}