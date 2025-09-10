import Listing from "../models/listing.model.js"
import Wishlist from "../models/wishlist.model.js"
import User from "../models/user.model.js"
import Notification from "../models/notification.model.js"
import { errorHandler } from "../utils/error.js"



export const createListing=async (req,res,next)=>{
    try{
        const { assignToEmail, ...listingData } = req.body;
        
        // Determine the user reference for the listing
        let userRef = req.user.id; // Default to current admin
        
        // If email is provided, validate and assign to that user
        if (assignToEmail && assignToEmail.trim()) {
            const targetUser = await User.findOne({ 
                email: assignToEmail.trim(),
                status: { $ne: 'suspended' }
            });
            
            if (!targetUser) {
                return res.status(400).json({
                    success: false,
                    message: "User not found with the provided email"
                });
            }
            
            userRef = targetUser._id;
        }
        
        // Create the listing with the determined user reference
        const listing = await Listing.create({
            ...listingData,
            userRef: userRef
        });
        
        // Prepare success message based on assignment
        let successMessage = "Property Added Successfully";
        if (assignToEmail && assignToEmail.trim()) {
            successMessage = `Listing assigned to ${assignToEmail}`;
            // Send notification to the user
            try {
                const notification = await Notification.create({
                    userId: userRef,
                    type: 'admin_created_listing',
                    title: 'Property Added by Admin',
                    message: `A new property "${listing.name}" is added on behalf of you by admin.`,
                    listingId: listing._id,
                    adminId: req.user.id
                });
                const io = req.app.get('io');
                if (io) io.to(userRef.toString()).emit('notificationCreated', notification);
            } catch (notificationError) {
                console.error('Failed to create notification:', notificationError);
            }
        } else {
            successMessage = "Listing created under admin ownership";
        }
        
        return res.status(201).json({
            success: true,
            message: successMessage,
            listing,
            assignedTo: assignToEmail || "admin"
        });
    }
    catch(error){
        console.error(error);
        return next(errorHandler(500, "Failed to create listing"));
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
        console.error(error);
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

    // If admin is deleting someone else's property, require a reason
    const isAdminDeletingOthersProperty = (
      (req.user.role === 'admin' || req.user.role === 'rootadmin' || req.user.isDefaultAdmin) &&
      req.user.id !== listing.userRef.toString()
    );

    if (isAdminDeletingOthersProperty) {
      const { reason } = req.body;
      if (!reason || reason.trim().length === 0) {
        return next(errorHandler(400, 'Reason is required when deleting another user\'s property'));
      }
    }

    try{
        // Create notification if admin is deleting someone else's property
        let notificationMessage = "Listing deleted successfully";
        if (isAdminDeletingOthersProperty) {
          try {
            // Get the property owner's details
            const propertyOwner = await User.findById(listing.userRef);
            
            if (propertyOwner) {
              // Create notification for the property owner
              const notification = new Notification({
                userId: listing.userRef,
                type: 'property_deleted',
                title: 'Property Deleted by Admin',
                message: `Your property "${listing.name}" has been deleted by an administrator. Reason: ${req.body.reason}`,
                listingId: listing._id,
                adminId: req.user.id,
                adminNote: req.body.reason
              });
              
              await notification.save();
              
              // Update success message to include user email
              notificationMessage = `Property deleted successfully and notified to ${propertyOwner.email}`;
            }
          } catch (notificationError) {
            // Log notification error but don't fail the listing deletion
            console.error('Failed to create notification:', notificationError);
          }
        }

        // Get all wishlisters before deletion for notifications
        const wishlisters = await Wishlist.find({ listingId: req.params.id }).select('userId');
        const wishlisterIds = [...new Set(wishlisters.map(w => w.userId.toString()))];

        // Delete the listing
        await Listing.findByIdAndDelete(req.params.id)

        // Delete all wishlist items associated with this listing
        await Wishlist.deleteMany({ listingId: req.params.id })

        // Notify wishlisters the property is removed/sold
        try {
          if (wishlisterIds.length > 0) {
            const notifications = wishlisterIds.map(uid => ({
              userId: uid,
              type: 'watchlist_property_removed',
              title: 'A Watchlisted Property Was Removed',
              message: `A property you watchlisted ("${listing.name}") is no longer available.`,
              listingId: listing._id,
              adminId: req.user.id
            }));
            await Notification.insertMany(notifications);
          }
        } catch (notifyErr) {
          console.error('Failed to notify wishlisters about removal:', notifyErr);
        }
        
        res.status(200).json({
          success: true,
          message: notificationMessage
        });
    }
    catch(error){
        console.error(error);
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
        // For admin updates, exclude userRef to preserve original ownership
        let updateData = req.body;
        if (req.user.role === 'admin' || req.user.role === 'rootadmin' || req.user.isDefaultAdmin) {
          // Remove userRef from update data to preserve original ownership
          const { userRef, ...dataWithoutUserRef } = req.body;
          updateData = dataWithoutUserRef;
        }
        
        // Load existing to detect price drop
        const prev = listing;
        const prevEffectivePrice = (prev.offer && prev.discountPrice) ? prev.discountPrice : prev.regularPrice;
        const willOffer = updateData.offer ?? prev.offer;
        const willDiscount = updateData.discountPrice ?? prev.discountPrice;
        const willRegular = updateData.regularPrice ?? prev.regularPrice;
        const nextEffectivePrice = (willOffer && willDiscount) ? willDiscount : willRegular;

        const updateListing=await Listing.findByIdAndUpdate(req.params.id, updateData, {new:true})
        
        // Create notification if admin is editing someone else's property
        let notificationMessage = "Property Updated Successfully";
        if (
          (req.user.role === 'admin' || req.user.role === 'rootadmin' || req.user.isDefaultAdmin) &&
          req.user.id !== listing.userRef.toString()
        ) {
          try {
            // Get the property owner's details
            const propertyOwner = await User.findById(listing.userRef);
            
            if (propertyOwner) {
              // Create notification for the property owner
              const notification = new Notification({
                userId: listing.userRef,
                type: 'property_edited',
                title: 'Property Updated by Admin',
                message: `Your property "${listing.name}" has been updated by an administrator. Please review the changes.`,
                listingId: listing._id,
                adminId: req.user.id,
              });
              
              await notification.save();
              
              // Update success message to include user email
              notificationMessage = `Property updated successfully and notified to ${propertyOwner.email}`;
            }
          } catch (notificationError) {
            // Log notification error but don't fail the listing update
            console.error('Failed to create notification:', notificationError);
          }
        }
        
        // Notify wishlisters on price drop
        try {
          if (typeof prevEffectivePrice === 'number' && typeof nextEffectivePrice === 'number' && nextEffectivePrice < prevEffectivePrice) {
            const wishlisters = await Wishlist.find({ listingId: req.params.id }).select('userId');
            const wishlisterIds = [...new Set(wishlisters.map(w => w.userId.toString()))];
            if (wishlisterIds.length > 0) {
              const dropPct = Math.round(((prevEffectivePrice - nextEffectivePrice) / prevEffectivePrice) * 100);
              const notifications = wishlisterIds.map(uid => ({
                userId: uid,
                type: 'watchlist_price_drop',
                title: 'Price Drop on Watchlisted Property',
                message: `Good news! "${updateListing.name}" price dropped by ${isFinite(dropPct) ? dropPct + '%' : 'a discount'} to ₹${(nextEffectivePrice||0).toLocaleString('en-IN')}.`,
                listingId: updateListing._id,
                adminId: req.user.id
              }));
              await Notification.insertMany(notifications);
            }
          }
        } catch (notifyErr) {
          console.error('Failed to notify wishlisters about price drop:', notifyErr);
        }

        return res.status(200).json({
            success: true,
            message: notificationMessage,
            listing: updateListing
        })
    }
    catch(error){
        console.error(error);
        return next(errorHandler(500, "Failed to update listing"))
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
        console.error(error);
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

export const reassignPropertyOwner = async (req, res, next) => {
  try {
    const { listingId } = req.params;
    const { newOwnerId } = req.body;

    // Check if user is admin or rootadmin
    if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return next(errorHandler(401, 'Only admins can reassign property ownership'));
    }

    // Validate listing exists
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return next(errorHandler(404, 'Listing not found'));
    }

    // Check if current owner exists and is active
    if (listing.userRef) {
      try {
        const currentOwner = await User.findById(listing.userRef);
        if (currentOwner && currentOwner.status !== 'suspended') {
          return next(errorHandler(400, 'Owner already exists and is active. Cannot reassign property ownership.'));
        }
      } catch (error) {
        // If we can't fetch the current owner, it means the account is deleted/inactive
        // This is the case where we want to allow reassignment
        console.log('Current owner account appears to be deleted/inactive, allowing reassignment');
      }
    }

    // Validate new owner exists
    const newOwner = await User.findById(newOwnerId);
    if (!newOwner) {
      return next(errorHandler(404, 'New owner not found'));
    }

    // Check if new owner is not suspended
    if (newOwner.status === 'suspended') {
      return next(errorHandler(400, 'Cannot assign property to a suspended user'));
    }

    // Update the listing with new owner
    const updatedListing = await Listing.findByIdAndUpdate(
      listingId,
      { userRef: newOwnerId },
      { new: true }
    );

    // Create notification for the new owner
    try {
      const notification = new Notification({
        userId: newOwnerId,
        type: 'property_assigned',
        title: 'Property Assigned to You',
        message: `You have been assigned as the owner of property "${listing.name}".`,
        listingId: listing._id,
        adminId: req.user.id,
      });
      
      await notification.save();
    } catch (notificationError) {
      // Log notification error but don't fail the ownership update
      console.error('Failed to create notification:', notificationError);
    }

    res.status(200).json({
      success: true,
      message: `Property ownership successfully reassigned to ${newOwner.username}`,
      listing: updatedListing
    });

  } catch (error) {
    console.error('Error reassigning property owner:', error);
    return next(errorHandler(500, 'Failed to reassign property ownership'));
  }
};