import Listing from "../models/listing.model.js"
import RentLockContract from "../models/rentLockContract.model.js"
import Wishlist from "../models/wishlist.model.js"
import PropertyWatchlist from "../models/propertyWatchlist.model.js"
import { notifyWatchersOnChange } from "./propertyWatchlist.controller.js"
import User from "../models/user.model.js"
import Notification from "../models/notification.model.js"
import { errorHandler } from "../utils/error.js"
import { escapeRegex } from "../utils/regex.js"
import { sendPropertyListingPublishedEmail, sendPropertyEditNotificationEmail, sendPropertyDeletionConfirmationEmail, sendOwnerDeassignedEmail, sendOwnerAssignedEmail, sendPropertyCreatedPendingVerificationEmail, sendPropertyVerificationReminderEmail, sendPropertyPublishedAfterVerificationEmail, sendListingUnpublishedEmail } from "../utils/emailService.js"
import bcryptjs from 'bcryptjs'
import OwnershipAuditLog from "../models/ownershipAuditLog.model.js"
import DeletedListing from "../models/deletedListing.model.js"
import crypto from 'crypto'
import PropertyVerification from "../models/propertyVerification.model.js";
import { vectorSearchListings, generateEmbedding, createListingDescription } from "../services/vectorSearchService.js";
import SentinelSecurityService from "../services/SentinelSecurityService.js";


export const createListing = async (req, res, next) => {
  try {
    const { assignToEmail, ...listingData } = req.body;

    // Debug ESG data
    console.log('🔍 CreateListing - ESG data received:', JSON.stringify(listingData.esg, null, 2));

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

    // Generate AI Vector Embedding for search
    let vectorEmbedding = [];
    try {
      const descriptionText = createListingDescription({ ...listingData, userRef });
      vectorEmbedding = await generateEmbedding(descriptionText) || [];
      console.log(`🧠 AI Vector generated for ${listingData.name} (${vectorEmbedding.length} dims)`);
    } catch (embErr) {
      console.error("Embedding generation failed during creation:", embErr.message);
    }

    // Create the listing with the determined user reference
    // New properties are private and unverified by default
    const listing = await Listing.create({
      ...listingData,
      userRef: userRef,
      isVerified: false,
      visibility: 'private',
      vectorEmbedding: vectorEmbedding
    });

    // Debug saved ESG data
    console.log('💾 CreateListing - ESG data saved:', JSON.stringify(listing.esg, null, 2));

    // 🛡️ Sentinel AI Security Scan
    try {
      const fraudScan = await SentinelSecurityService.scanListingForFraud(listing._id);
      if (!fraudScan.safe) {
        console.log(`🚨 Sentinel AI flagged NEW listing ${listing._id} as fraudulent: ${fraudScan.reasons.join(', ')}`);
        // The service already flags/suspends the listing and penalizes the user
      }
    } catch (scanErr) {
      console.error("Sentinel scan failed during creation:", scanErr.message);
    }

    // Get the user who will receive the email
    const listingOwner = await User.findById(userRef);

    // Prepare success message based on assignment
    let successMessage = "Property Created Successfully - Verification Required";
    const isAdminCreated = assignToEmail && assignToEmail.trim();

    if (isAdminCreated) {
      successMessage = `Listing assigned to ${assignToEmail} - Verification Required`;
      // Send notification to the user
      try {
        const notification = await Notification.create({
          userId: userRef,
          type: 'admin_created_listing',
          title: 'Property Added by Admin - Verification Required',
          message: `A new property "${listing.name}" has been created on your behalf by admin. Please complete verification to publish it.`,
          listingId: listing._id,
          adminId: req.user.id,
          meta: {
            imageUrl: listing.imageUrls ? listing.imageUrls[0] : null,
            category: 'admin_created_listing',
            actions: [
              { title: '👁️ View Property', identifier: 'view_listing' }
            ]
          }
        });

        const io = req.app.get('io');
        if (io) io.to(userRef.toString()).emit('notificationCreated', notification);
      } catch (notificationError) {
        console.error('Failed to create notification:', notificationError);
      }
    } else {
      successMessage = "Property Created Successfully - Verification Required";
    }

    // Send property created pending verification email
    if (listingOwner && listingOwner.email) {
      try {
        const listingDetails = {
          listingId: listing._id,
          propertyName: listing.name,
          propertyDescription: listing.description,
          propertyAddress: listing.address,
          propertyPrice: listing.offer ? listing.discountPrice : listing.regularPrice,
          propertyType: listing.type,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          area: listing.area,
          city: listing.city,
          state: listing.state,
          imageUrls: listing.imageUrls,
          createdBy: isAdminCreated ? 'admin' : 'user'
        };

        await sendPropertyCreatedPendingVerificationEmail(listingOwner.email, listingDetails, isAdminCreated);
        console.log(`✅ Property created pending verification email sent to: ${listingOwner.email}`);
      } catch (emailError) {
        console.error(`❌ Failed to send property created pending verification email to ${listingOwner.email}:`, emailError);
        // Don't fail the listing creation if email fails
      }
    }

    return res.status(201).json({
      success: true,
      message: successMessage,
      listing,
      assignedTo: assignToEmail || "admin"
    });
  }
  catch (error) {
    console.error(error);
    return next(errorHandler(500, "Failed to create listing"));
  }
}

export const getUserListings = async (req, res, next) => {
  try {
    let listings;
    if (req.user.role === 'rootadmin' || req.user.isDefaultAdmin) {
      // Root admin or default admin: show all listings
      listings = await Listing.find().sort({ createdAt: -1 });
    } else {
      // Regular admin or user: show only their own listings
      // Use _id (ObjectId) directly for reliable matching
      // Also match string representation for any legacy data
      const userId = req.user._id;
      const userIdStr = req.user._id.toString();
      
      listings = await Listing.find({
        $or: [
          { userRef: userId },                   // ObjectId match
          { userRef: userIdStr }                  // legacy string match (if any)
        ]
      }).sort({ createdAt: -1 });
    }

    // Check for active Rent-Lock contracts for these listings
    const listingIds = listings.map(l => l._id);
    const activeContracts = await RentLockContract.find({
      listingId: { $in: listingIds },
      status: { $in: ['active', 'approved', 'pending_signature'] } // Consider pending signature as locked too? Usually active is enough, but let's be safe. Sticking to 'active' for strict lock.
    }).select('listingId endDate status');

    // Enhance listings with lock status
    const listingsWithLockInfo = listings.map(listing => {
      const listingObj = listing.toObject({ flattenMaps: true });
      const activeContract = activeContracts.find(c => c.listingId.toString() === listing._id.toString() && c.status === 'active');

      if (activeContract) {
        listingObj.isRentLocked = true;
        listingObj.rentLockEndDate = activeContract.endDate;
      } else {
        listingObj.isRentLocked = false;
      }
      return listingObj;
    });

    res.status(200).json(listingsWithLockInfo);
  }
  catch (error) {
    console.error(error);
    next(error)
  }
}


export const deleteListing = async (req, res, next) => {
  const listing = await Listing.findById(req.params.id)

  if (!listing) {
    return next(errorHandler(404, "Listing not found"))
  }

  // Check if property is sold or under contract (non-admins cannot delete)
  if ((listing.availabilityStatus === 'sold' || listing.availabilityStatus === 'under_contract') &&
    req.user.role !== 'admin' &&
    req.user.role !== 'rootadmin' &&
    !req.user.isDefaultAdmin) {
    return next(errorHandler(403, `Cannot delete property that is ${listing.availabilityStatus === 'sold' ? 'sold' : 'under contract'}.`));
  }

  // Check for active Rent-Lock
  const activeContract = await RentLockContract.findOne({
    listingId: listing._id,
    status: 'active'
  });

  const isAdmin = req.user.role === 'admin' || req.user.role === 'rootadmin' || req.user.isDefaultAdmin;

  if (activeContract && !isAdmin) {
    return next(errorHandler(403, "Cannot delete property with an active Rent-Lock Plan."));
  }

  // Allow admin, rootadmin, or isDefaultAdmin to delete any listing, regular users can only delete their own
  if (
    req.user.role !== 'admin' &&
    req.user.role !== 'rootadmin' &&
    !req.user.isDefaultAdmin &&
    req.user.id !== listing.userRef.toString()
  ) {
    return next(errorHandler(401, 'You can only delete your own listing (unless you are admin/rootadmin)'))
  }

  // If admin is deleting someone else's property, reason is allowed but not strictly enforced if UI doesn't send it, 
  // but better to keep it if UI sends it. 
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

  try {
    // Create notification if admin is deleting someone else's property
    let notificationMessage = "Listing deleted successfully";
    if (isAdminDeletingOthersProperty) {
      try {
        // Get the property owner's details
        const propertyOwner = await User.findById(listing.userRef);

        if (propertyOwner) {
          // Create notification for the property owner
          const notification = await Notification.create({
            userId: listing.userRef,
            type: 'property_deleted',
            title: 'Property Deleted by Admin',
            message: `Your property "${listing.name}" has been deleted by an administrator. Reason: ${req.body.reason}`,
            listingId: listing._id,
            adminId: req.user.id,
            meta: {
              adminNote: req.body.reason,
              category: 'property_deleted'
              // No "View" action since deleted, but could add "Browse Others" later
            }
          });

          // Update success message to include user email
          notificationMessage = `Property deleted successfully and notified to ${propertyOwner.email}`;

          const io = req.app.get('io');
          if (io) io.to(listing.userRef.toString()).emit('notificationCreated', notification);
        }
      } catch (notificationError) {
        // Log notification error but don't fail the listing deletion
        console.error('Failed to create notification:', notificationError);
      }
    }

    // Store deleted listing for potential restoration before actual deletion
    // NOW: Always create restoration record, even for admins.
    let restorationToken = null;
    let tokenExpiry = null;
    let deletedListingRecord = null;

    try {
      restorationToken = crypto.randomBytes(32).toString('hex');
      tokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      // Check if there's already a deletion record for this listing
      const existingDeletedRecord = await DeletedListing.findOne({
        originalListingId: listing._id
      });

      console.log(`🔍 Checking for existing deletion record for listing ${listing._id}:`, existingDeletedRecord ? 'Found' : 'Not found');

      if (existingDeletedRecord) {
        console.log(`🔄 Updating existing deletion record for listing ${listing._id}`);
        // Update existing record with new deletion info
        existingDeletedRecord.listingData = listing.toObject();
        existingDeletedRecord.deletedBy = req.user.id;
        existingDeletedRecord.deletionType = isAdminDeletingOthersProperty ? 'admin' : 'owner';
        existingDeletedRecord.deletionReason = req.body.reason || (isAdminDeletingOthersProperty ? 'Admin deleted listing' : 'Owner deleted listing');
        existingDeletedRecord.restorationToken = restorationToken;
        existingDeletedRecord.tokenExpiry = tokenExpiry;
        existingDeletedRecord.isRestored = false;
        existingDeletedRecord.restoredAt = null;
        // Reset restoredBy so we know it's freshly deleted
        existingDeletedRecord.restoredBy = null;
        existingDeletedRecord.isUsed = false;
        existingDeletedRecord.deletedAt = new Date();

        await existingDeletedRecord.save();
        deletedListingRecord = existingDeletedRecord;
        console.log(`✅ Updated existing deletion record for listing ${listing._id}`);
      } else {
        console.log(`🆕 Creating new deletion record for listing ${listing._id}`);
        // Create new deletion record
        deletedListingRecord = new DeletedListing({
          originalListingId: listing._id,
          listingData: listing.toObject(), // Store complete listing data
          userRef: listing.userRef,
          deletedBy: req.user.id,
          deletionType: isAdminDeletingOthersProperty ? 'admin' : 'owner',
          deletionReason: req.body.reason || (isAdminDeletingOthersProperty ? 'Admin deleted listing' : 'Owner deleted listing'),
          restorationToken: restorationToken,
          tokenExpiry: tokenExpiry
        });

        await deletedListingRecord.save();
        console.log(`✅ Created new deletion record for listing ${listing._id}`);
      }
    } catch (deletionRecordError) {
      console.error(`❌ Error handling deletion record for listing ${listing._id}:`, deletionRecordError);
      // Don't fail the deletion if deletion record creation fails
      // The property will still be deleted, just without restoration capability
    }

    // Send property deletion confirmation email
    try {
      const propertyOwner = await User.findById(listing.userRef);

      if (propertyOwner && propertyOwner.email) {
        const deletionDetails = {
          propertyName: listing.name,
          propertyId: listing._id,
          propertyDescription: listing.description,
          propertyAddress: listing.address,
          propertyPrice: listing.offer ? listing.discountPrice : listing.regularPrice,
          propertyImages: listing.imageUrls || [],
          deletedBy: req.user.username || req.user.email,
          deletionType: isAdminDeletingOthersProperty ? 'admin' : 'owner',
          deletionReason: isAdminDeletingOthersProperty ? req.body.reason : null,
          restorationToken: restorationToken,
          // CRITICAL: Only send token expiry/token to user if THEY deleted it. 
          // If admin deleted it, they can't self-restore, so don't confuse them.
          tokenExpiry: isAdminDeletingOthersProperty ? null : tokenExpiry
        };

        await sendPropertyDeletionConfirmationEmail(propertyOwner.email, deletionDetails);
        console.log(`✅ Property deletion confirmation email sent to: ${propertyOwner.email}`);
      }
    } catch (emailError) {
      console.error(`❌ Failed to send property deletion confirmation email:`, emailError);
      // Don't fail the deletion if email fails
    }

    // Delete the listing
    await Listing.findByIdAndDelete(req.params.id)

    // Delete all wishlist items associated with this listing
    await Wishlist.deleteMany({ listingId: req.params.id })
    // Notify watchers and cleanup watchlist entries
    try {
      await notifyWatchersOnChange(req.app, { listing, changeType: 'removed' });
    } catch (e) {
      console.error('Failed to notify watchers on removal:', e);
    }
    await PropertyWatchlist.deleteMany({ listingId: req.params.id })

    res.status(200).json({
      success: true,
      message: notificationMessage
    });
  }
  catch (error) {
    console.error(error);
    return next(error)
  }

}

// Get all deleted listings (Admin Only)
export const getDeletedListings = async (req, res, next) => {
  try {
    // 1. Check permissions / Determine context
    const isAdmin = req.user.role === 'admin' || req.user.role === 'rootadmin' || req.user.isDefaultAdmin;
    const isOwner = !isAdmin; // Regular users

    // 2. Parse query params for filtering/pagination
    const limit = parseInt(req.query.limit) || 12;
    const startIndex = parseInt(req.query.startIndex) || 0;

    const searchTerm = req.query.searchTerm || '';
    const deletionType = req.query.deletionType || 'all'; // 'owner', 'admin', 'all'
    const sort = req.query.sort || 'deletedAt';
    const order = req.query.order || 'desc';

    // 3. Build Query
    const query = {
      isRestored: false // Only show non-restored items in this list usually
    };

    if (isOwner) {
      // Regular users can ONLY see their own deleted listings
      query.userRef = req.user.id;
    }

    if (deletionType !== 'all') {
      query.deletionType = deletionType;
    }

    // Add search logic if needed (requires looking into listingData which is Mixed/JSON)
    // Basic implementation filters by matching IDs or basic fields if possible, 
    // but searching inside `listingData` JSON might be slow without text indexes.
    // We can search by population userRef if term looks like a user.

    // 4. Fetch
    const sortDirection = order === 'asc' ? 1 : -1;

    // We start by fetching record IDs to support searching, or just basic find
    const deletedListings = await DeletedListing.find(query)
      .populate('userRef', 'username email avatar') // Owner
      .populate('deletedBy', 'username email avatar role') // Deleter
      .sort({ [sort]: sortDirection })
      .limit(limit)
      .skip(startIndex);

    // If searching by property name is required and it's inside `listingData`, we might need to filter in memory 
    // OR aggregated query if volume is high. For now, in-memory filter if searchTerm exists.
    let results = deletedListings;

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      results = results.filter(item => {
        const name = item.listingData?.name || '';
        const address = item.listingData?.address || '';
        const ownerName = item.userRef?.username || '';
        const ownerEmail = item.userRef?.email || '';

        return name.toLowerCase().includes(lowerTerm) ||
          address.toLowerCase().includes(lowerTerm) ||
          ownerName.toLowerCase().includes(lowerTerm) ||
          ownerEmail.toLowerCase().includes(lowerTerm);
      });
    }

    res.status(200).json({
      success: true,
      data: results,
      count: results.length
    });

  } catch (error) {
    console.error('Error fetching deleted listings:', error);
    next(errorHandler(500, 'Failed to fetch deleted listings'));
  }
};

// Restore deleted listing (Admin Only)
export const restoreDeletedListing = async (req, res, next) => {
  try {
    // 2. Find record
    const deletedRecord = await DeletedListing.findById(req.params.id);
    if (!deletedRecord) {
      return next(errorHandler(404, 'Deleted listing record not found'));
    }

    // 1. Check permissions logic (Moved after fetch to check ownership)
    const isAdmin = req.user.role === 'admin' || req.user.role === 'rootadmin' || req.user.isDefaultAdmin;
    const isOwner = deletedRecord.userRef.toString() === req.user.id;

    if (!isAdmin) {
      // Regular user checks
      if (!isOwner) {
        return next(errorHandler(403, 'Access denied. You do not own this listing record.'));
      }

      // Check if user is allowed to restore (only if they deleted it, not if admin deleted it)
      if (deletedRecord.deletionType === 'admin') {
        return next(errorHandler(403, 'This listing was deleted by an admin and cannot be restored by the user. Please contact support.'));
      }

      // Check expiry
      if (deletedRecord.tokenExpiry && new Date() > new Date(deletedRecord.tokenExpiry)) {
        return next(errorHandler(403, 'Restoration period has expired. Please contact support.'));
      }
    }

    if (deletedRecord.isRestored) {
      return next(errorHandler(400, 'Listing is already restored'));
    }

    // 3. Restore to Listing collection
    const listingData = deletedRecord.listingData;

    // Ensure we keep the SAME ID (crucial for maintaining references)
    // listingData._id should be present. We use it to create the doc with explicit _id.

    // Remove conflicting version fields
    delete listingData.__v;

    // Explicitly update 'updatedAt' to now, to reflect the restoration event
    // But KEEP 'createdAt' to preserve original listing age/history
    listingData.updatedAt = new Date();

    // Check if ID already exists (collision check)
    const existing = await Listing.findById(listingData._id);
    if (existing) {
      return next(errorHandler(409, 'A listing with this ID already exists (it may have been restored already).'));
    }

    // Create new document with original data (restoring all status, progress, verification, etc.)
    const restoredListing = new Listing(listingData);
    await restoredListing.save();

    // 4. Update the deletedRecord status
    deletedRecord.isRestored = true;
    deletedRecord.restoredAt = new Date();
    deletedRecord.restoredBy = req.user.id;
    deletedRecord.isUsed = true; // Mark token as used too just in case
    await deletedRecord.save();

    // 5. Notify Owner
    try {
      const owner = await User.findById(deletedRecord.userRef);
      if (owner && owner.email) {
        // Send generic property restored email
        // Import this function if you haven't, or use sendPropertyPublished as generic fallback
        // For now, I'll use sendPropertyPublishedAfterVerificationEmail as a proxy if no dedicated one, 
        // OR sendPropertyDeletionConfirmationEmail (WAIT, that's for deletion).
        // The user mentioned "already template present ... emailsent after proeprty resoration". 
        // I'll use a generic restoration email function.

        const emailDetails = {
          propertyName: listingData.name,
          propertyId: listingData._id,
          propertyAddress: listingData.address,
          propertyPrice: listingData.offer ? listingData.discountPrice : listingData.regularPrice,
          propertyImage: listingData.imageUrls && listingData.imageUrls.length > 0 ? listingData.imageUrls[0] : null,
          restoredBy: 'Admin Team'
        };

        // Assuming sendPropertyRestoredEmail exists or we create it.
        // Pass simple details.
        // If function doesn't exist, this might fail, so let's safeguard inside Try/Catch and use a generic message.
        // Actually, I'll assume we'll add `sendPropertyRestoredEmail` to emailService as planned.
        const { sendPropertyRestoredEmail } = await import("../utils/emailService.js");
        if (sendPropertyRestoredEmail) {
          await sendPropertyRestoredEmail(owner.email, emailDetails);
        } else {
          console.log("sendPropertyRestoredEmail function not found in service");
        }
      }
    } catch (err) {
      console.error("Failed to send restoration email", err);
    }

    // 6. Respond
    res.status(200).json({
      success: true,
      message: 'Listing restored successfully',
      data: restoredListing
    });

  } catch (error) {
    console.error('Error restoring listing:', error);
    next(errorHandler(500, 'Failed to restore listing'));
  }
};

export const updateListing = async (req, res, next) => {
  const listing = await Listing.findById(req.params.id)

  if (!listing) {
    return next(errorHandler(404, "Listing not found"))
  }

  // Debug ESG data in update
  console.log('🔍 UpdateListing - ESG data received:', JSON.stringify(req.body.esg, null, 2));

  // Allow admin, rootadmin, or isDefaultAdmin to edit any listing, regular users can only edit their own
  if (
    req.user.role !== 'admin' &&
    req.user.role !== 'rootadmin' &&
    !req.user.isDefaultAdmin &&
    req.user.id !== listing.userRef.toString()
  ) {
    return next(errorHandler(401, 'You can only edit your own listing (unless you are admin/rootadmin)'))
  }

  // Check if property is sold or under contract (non-admins cannot edit)
  if ((listing.availabilityStatus === 'sold' || listing.availabilityStatus === 'under_contract') &&
    req.user.role !== 'admin' &&
    req.user.role !== 'rootadmin' &&
    !req.user.isDefaultAdmin) {
    return next(errorHandler(403, `Cannot edit property that is ${listing.availabilityStatus === 'sold' ? 'sold' : 'under contract'}.`));
  }

  // Check for active Rent-Lock
  const activeContract = await RentLockContract.findOne({
    listingId: listing._id,
    status: 'active'
  });

  const isAdmin = req.user.role === 'admin' || req.user.role === 'rootadmin' || req.user.isDefaultAdmin;

  if (activeContract && !isAdmin) {
    const restrictedFields = [
      'regularPrice',
      'discountPrice',
      'offer',
      'type',
      'address',
      'city',
      'state',
      'pincode',
      'propertyNumber',
      'rentLockPlan',
      'customLockDuration'
    ];

    restrictedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        delete req.body[field];
      }
    });
  }

  try {
    // For admin updates, exclude userRef to preserve original ownership
    let updateData = req.body;
    if (req.user.role === 'admin' || req.user.role === 'rootadmin' || req.user.isDefaultAdmin) {
      // Remove userRef from update data to preserve original ownership
      const { userRef, ...dataWithoutUserRef } = req.body;
      updateData = dataWithoutUserRef;
    }

    // Detect price drop before update
    const oldRegular = listing.regularPrice;
    const oldDiscount = listing.discountPrice;
    const oldEffective = (listing.offer && oldDiscount) ? oldDiscount : oldRegular;

    // Restrict 360° Virtual Tour updates to verified properties
    if (req.body.virtualTourImages && !isAdmin && !listing.isVerified) {
      const currentImages = listing.virtualTourImages || [];
      const newImages = req.body.virtualTourImages;

      // Check if images are being modified (allow identical updates which happen when submitting strictly other fields)
      if (JSON.stringify(currentImages) !== JSON.stringify(newImages)) {
        return next(errorHandler(403, '360° virtual tours are a premium feature available only for verified properties. Please verify your property to manage virtual tours.'));
      }
    }

    // Check for changes affecting AI Search embedding
    const searchRelevantFields = ['name', 'description', 'city', 'state', 'regularPrice', 'discountPrice', 'type', 'bedrooms', 'bathrooms', 'furnished'];
    const hasSearchChanges = searchRelevantFields.some(f => req.body[f] !== undefined && req.body[f] !== listing[f]);

    if (hasSearchChanges) {
      try {
        const updatedCopy = { ...listing.toObject(), ...updateData };
        const descriptionText = createListingDescription(updatedCopy);
        updateData.vectorEmbedding = await generateEmbedding(descriptionText);
        console.log(`🆕 AI Vector REGENERATED for ${listing.name}`);
      } catch (embErr) {
        console.error("Embedding regeneration failed during update:", embErr.message);
      }
    }

    const updatedListing = await Listing.findByIdAndUpdate(req.params.id, updateData, { new: true })

    // Debug updated ESG data
    console.log('💾 UpdateListing - ESG data saved:', JSON.stringify(updatedListing.esg, null, 2));

    // 🛡️ Sentinel AI Security Scan
    try {
      const fraudScan = await SentinelSecurityService.scanListingForFraud(updatedListing._id);
      if (!fraudScan.safe) {
        console.log(`🚨 Sentinel AI flagged UPDATED listing ${updatedListing._id} as fraudulent: ${fraudScan.reasons.join(', ')}`);
      }
    } catch (scanErr) {
      console.error("Sentinel scan failed during update:", scanErr.message);
    }

    // Notify watchers if price dropped
    try {
      const newRegular = updatedListing.regularPrice;
      const newDiscount = updatedListing.discountPrice;
      const newEffective = (updatedListing.offer && newDiscount) ? newDiscount : newRegular;
      if (oldEffective && newEffective && newEffective < oldEffective) {
        await notifyWatchersOnChange(req.app, { listing: updatedListing, changeType: 'price_drop', oldPrice: oldEffective, newPrice: newEffective });
      }
    } catch (e) {
      console.error('Failed to notify watchers on price change:', e);
    }

    // Create notification if admin is editing someone else's property
    let notificationMessage = "Property Updated Successfully";
    const isAdminEdit = (req.user.role === 'admin' || req.user.role === 'rootadmin' || req.user.isDefaultAdmin) &&
      req.user.id !== listing.userRef.toString();

    if (isAdminEdit) {
      try {
        // Get the property owner's details
        const propertyOwner = await User.findById(listing.userRef);

        if (propertyOwner) {
          // Create notification for the property owner
          const notification = await Notification.create({
            userId: listing.userRef,
            type: 'property_edited',
            title: 'Property Updated by Admin',
            message: `Your property "${listing.name}" has been updated by an administrator. Please review the changes.`,
            listingId: listing._id,
            adminId: req.user.id,
            meta: {
              imageUrl: updatedListing.imageUrls ? updatedListing.imageUrls[0] : null,
              category: 'property_edited',
              actions: [
                { title: '🔍 View Changes', identifier: 'view_listing' }
              ]
            }
          });

          const io = req.app.get('io');
          if (io) io.to(listing.userRef.toString()).emit('notificationCreated', notification);

          // Update success message to include user email
          notificationMessage = `Property updated successfully and notified to ${propertyOwner.email}`;
        }
      } catch (notificationError) {
        // Log notification error but don't fail the listing update
        console.error('Failed to create notification:', notificationError);
      }
    }

    // Send property edit notification email
    try {
      // Get the property owner (who should receive the email)
      const propertyOwner = await User.findById(updateListing.userRef);

      if (propertyOwner && propertyOwner.email) {
        // Detect changes made to the property
        const changes = [];

        // Check for common field changes
        if (req.body.name && req.body.name !== listing.name) {
          changes.push(`Property name updated to "${req.body.name}"`);
        }
        if (req.body.description && req.body.description !== listing.description) {
          changes.push("Property description updated");
        }
        if (req.body.address && req.body.address !== listing.address) {
          changes.push("Property address updated");
        }
        if (req.body.regularPrice && req.body.regularPrice !== listing.regularPrice) {
          changes.push(`Regular price updated to ₹${req.body.regularPrice}`);
        }
        if (req.body.discountPrice && req.body.discountPrice !== listing.discountPrice) {
          changes.push(`Discount price updated to ₹${req.body.discountPrice}`);
        }
        if (req.body.bedrooms && req.body.bedrooms !== listing.bedrooms) {
          changes.push(`Bedrooms updated to ${req.body.bedrooms}`);
        }
        if (req.body.bathrooms && req.body.bathrooms !== listing.bathrooms) {
          changes.push(`Bathrooms updated to ${req.body.bathrooms}`);
        }
        if (req.body.area && req.body.area !== listing.area) {
          changes.push(`Area updated to ${req.body.area} sq ft`);
        }
        if (req.body.type && req.body.type !== listing.type) {
          changes.push(`Property type updated to ${req.body.type}`);
        }
        if (req.body.city && req.body.city !== listing.city) {
          changes.push(`City updated to ${req.body.city}`);
        }
        if (req.body.state && req.body.state !== listing.state) {
          changes.push(`State updated to ${req.body.state}`);
        }
        if (req.body.pincode && req.body.pincode !== listing.pincode) {
          changes.push(`Pincode updated to ${req.body.pincode}`);
        }
        if (req.body.imageUrls && JSON.stringify(req.body.imageUrls) !== JSON.stringify(listing.imageUrls)) {
          changes.push("Property images updated");
        }

        // If no specific changes detected, add a generic message
        if (changes.length === 0) {
          changes.push("Property details have been updated");
        }

        // Prepare email details
        const editDetails = {
          propertyName: updateListing.name,
          propertyId: updateListing._id,
          propertyDescription: updateListing.description,
          propertyAddress: updateListing.address,
          propertyPrice: updateListing.offer ? updateListing.discountPrice : updateListing.regularPrice,
          propertyImages: updateListing.imageUrls || [],
          editedBy: req.user.username || req.user.email,
          editType: isAdminEdit ? 'admin' : 'user',
          changes: changes
        };

        // Send email to property owner
        await sendPropertyEditNotificationEmail(propertyOwner.email, editDetails, 'owner');
        console.log(`✅ Property edit notification email sent to: ${propertyOwner.email}`);
      }
    } catch (emailError) {
      console.error(`❌ Failed to send property edit notification email:`, emailError);
      // Don't fail the listing update if email fails
    }

    return res.status(200).json({
      success: true,
      message: notificationMessage,
      listing: updateListing
    })
  }
  catch (error) {
    console.error(error);
    return next(errorHandler(500, "Failed to update listing"))
  }

}


export const getListing = async (req, res, next) => {
  try {
    let listing = await Listing.findById(req.params.id).populate('userRef', 'username email avatar');
    let listingObj = null;
    let isDeleted = false;

    if (!listing) {
      // Check if it exists in deleted listings
      const deletedRecord = await DeletedListing.findOne({ originalListingId: req.params.id }).populate('userRef', 'username email avatar');

      if (deletedRecord) {
        console.log(`ℹ️ Found deleted listing for ID: ${req.params.id}`);
        // Use the stored listing data
        listingObj = { ...deletedRecord.listingData };
        // Ensure critical fields are present
        listingObj._id = deletedRecord.originalListingId;
        listingObj.userRef = deletedRecord.userRef; // Use the populated owner info
        isDeleted = true;

        // Add deletion info
        listingObj.isDeleted = true;
        listingObj.deletedAt = deletedRecord.deletedAt;
        listingObj.deletionType = deletedRecord.deletionType;
        listingObj.deletionReason = deletedRecord.deletionReason;
      } else {
        return next(errorHandler(404, "Listing not found"));
      }
    } else {
      listingObj = listing.toObject({ flattenMaps: true });
    }

    // Debug ESG data being returned
    console.log('📤 GetListing - ESG data returned:', JSON.stringify(listingObj.esg, null, 2));

    // Check for active Rent-Lock (only if not deleted, or maybe even if deleted?)
    // For now, let's skip rent lock check for deleted items as they shouldn't have active locks relevant to display
    if (!isDeleted) {
      const activeContract = await RentLockContract.findOne({
        listingId: listingObj._id,
        status: 'active'
      });

      if (activeContract) {
        listingObj.isRentLocked = true;
        listingObj.rentLockEndDate = activeContract.endDate;
      } else {
        listingObj.isRentLocked = false;
      }
    }

    res.status(200).json(listingObj)
  }
  catch (error) {
    console.error(error);
    next(error)
  }
}

export const getListings = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10
    const startIndex = parseInt(req.query.startIndex) || 0
    let offer = req.query.offer
    if (offer === undefined || offer === 'all') {
      offer = { $in: [false, true] }
    } else {
      offer = offer === 'true'
    }

    let furnished = req.query.furnished
    if (furnished === undefined || furnished === 'all') {
      furnished = { $in: [false, true] }
    } else {
      furnished = furnished === 'true'
    }
    let parking = req.query.parking
    if (parking === undefined || parking === 'all') {
      parking = { $in: [false, true] }
    } else {
      parking = parking === 'true'
    }

    let type = req.query.type
    if (type === undefined || type === 'false' || type === 'all') {
      type = { $in: ['sale', 'rent'] }
    }
    const searchTerm = req.query.searchTerm || ''
    const sort = req.query.sort || 'createdAt'
    const order = req.query.order || 'desc'

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
      offer,
      furnished,
      parking,
      type,
      regularPrice: { $gte: minPrice, $lte: maxPrice },
    };

    if (searchTerm) {
      query.$or = [
        { name: { $regex: escapeRegex(searchTerm), $options: 'i' } },
        { description: { $regex: escapeRegex(searchTerm), $options: 'i' } },
        { address: { $regex: escapeRegex(searchTerm), $options: 'i' } },
        { landmark: { $regex: escapeRegex(searchTerm), $options: 'i' } },
        { city: { $regex: escapeRegex(searchTerm), $options: 'i' } },
        { state: { $regex: escapeRegex(searchTerm), $options: 'i' } },
      ];
    }
    if (city) query.city = { $regex: escapeRegex(city), $options: 'i' };
    if (state) query.state = { $regex: escapeRegex(state), $options: 'i' };
    if (bedrooms) query.bedrooms = bedrooms;
    if (bathrooms) query.bathrooms = bathrooms;

    // Owner Search Filter
    const ownerSearch = req.query.ownerSearch;
    if (ownerSearch && ownerSearch.trim()) {
      const users = await User.find({
        $or: [
          { username: { $regex: escapeRegex(ownerSearch), $options: 'i' } },
          { name: { $regex: escapeRegex(ownerSearch), $options: 'i' } },
          { email: { $regex: escapeRegex(ownerSearch), $options: 'i' } }
        ]
      }).select('_id');
      const userIds = users.map(u => u._id);

      // If we already have a userRef or sellerId filter, we need to respect it AND interview the search results
      // But typically search implies refining.
      // If we found NO users, and searching by owner, then we return empty
      if (userIds.length === 0) {
        query.userRef = null; // Force empty result
      } else {
        query.userRef = { $in: userIds };
      }
    }

    // Published/Verified Filter (User Request: "published and notpublished" check)
    // "Published" generally maps to Verified in this system context for filtering purpose
    const published = req.query.published;
    if (published === 'true') {
      query.isVerified = true;
    } else if (published === 'false') {
      query.isVerified = { $ne: true };
    }

    // Verification Filter: Only show verified and public properties to non-admin users
    // Check if user is authenticated and is admin
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'rootadmin' || req.user.isDefaultAdmin);

    // DEBUG: Log user info and admin status
    console.log('🔍 getListings - User Info:', {
      hasUser: !!req.user,
      userId: req.user?.id,
      role: req.user?.role,
      isDefaultAdmin: req.user?.isDefaultAdmin,
      isAdmin: isAdmin
    });

    // Check for suggestion intent
    const forSuggestion = req.query.forSuggestion === 'true';

    if (!isAdmin && !forSuggestion) {
      // For public/non-admin users: only show verified and public properties
      console.log('❌ Non-admin user - Applying verification filters');
      query.isVerified = true;
      query.visibility = 'public';
    } else {
      console.log('✅ Admin user - Bypassing all filters');
    }
    // Admins can see all properties (no filter applied)

    // Visibility and availability filters - ONLY apply to non-admin users (unless suggesting)
    if (!isAdmin && !forSuggestion) {
      const visibility = req.query.visibility || 'all';
      const availabilityFilter = req.query.availabilityStatus;
      const excludeAvailabilityFilter = req.query.excludeAvailabilityStatus;
      const availabilityConditions = [];

      if (visibility === 'public') {
        availabilityConditions.push({
          $or: [
            { availabilityStatus: { $exists: false } },
            { availabilityStatus: 'available' }
          ]
        });
      } else if (availabilityFilter) {
        const statuses = availabilityFilter.split(',').map((s) => s.trim()).filter(Boolean);
        if (statuses.length) {
          const orConditions = [
            { availabilityStatus: { $in: statuses } }
          ];
          if (statuses.includes('available')) {
            orConditions.push({ availabilityStatus: { $exists: false } });
          }
          availabilityConditions.push({ $or: orConditions });
        }
      } else if (excludeAvailabilityFilter) {
        const statuses = excludeAvailabilityFilter.split(',').map((s) => s.trim()).filter(Boolean);
        if (statuses.length) {
          availabilityConditions.push({
            $or: [
              { availabilityStatus: { $exists: false } },
              { availabilityStatus: { $nin: statuses } }
            ]
          });
        }
      }

      if (availabilityConditions.length) {
        query.$and = [...(query.$and || []), ...availabilityConditions];
      }
    }
    // Admins bypass all visibility and availability filters

    const listings = await Listing.find(query)
      .sort({ [sortField]: sortOrder })
      .limit(limit)
      .skip(startIndex)

    return res.status(200).json(listings)
  }
  catch (error) {
    console.error('Error in getListings:', error);
    return res.status(500).json([]);
  }
}

// AI Vector Search Controller
export const getAIRecommendations = async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query) {
      return next(errorHandler(400, "Search query is required"));
    }

    console.log(`🤖 AI Searching for: "${query}"`);

    const recommendations = await vectorSearchListings(query, 6);

    res.status(200).json({
      success: true,
      count: recommendations.length,
      data: recommendations
    });

  } catch (error) {
    next(error);
  }
};


// Transfer Property Ownership Directly (Old Owner -> New Owner)
export const transferPropertyOwner = async (req, res, next) => {
  try {
    const { listingId } = req.params;
    const { newOwnerId, reason, password } = req.body;

    if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return next(errorHandler(401, 'Only admins can transfer property ownership'));
    }

    if (!reason || !reason.trim()) {
      return next(errorHandler(400, 'Reason is required to transfer ownership'));
    }

    if (!password) {
      return next(errorHandler(400, 'Admin password is required to confirm transfer'));
    }

    // Verify Admin Password
    const adminUser = await User.findById(req.user.id);
    if (!adminUser || !bcryptjs.compareSync(password, adminUser.password)) {
      return next(errorHandler(400, 'Invalid admin password. Ownership transfer unauthorized.'));
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return next(errorHandler(404, 'Listing not found'));
    }

    // Validate target new owner
    const newOwner = await User.findById(newOwnerId);
    if (!newOwner) {
      return next(errorHandler(404, 'Selected new owner not found'));
    }

    if (newOwner.status === 'suspended' || newOwner.status === 'banned') {
      return next(errorHandler(400, 'Cannot transfer property to a suspended or banned user'));
    }

    if (newOwner.isVerified === false) {
      return next(errorHandler(400, 'Cannot transfer property to an unverified user account'));
    }

    // Capture Previous Owner
    const previousOwnerId = listing.userRef;
    let previousOwner = null;
    if (previousOwnerId) {
      try {
        previousOwner = await User.findById(previousOwnerId);
      } catch (err) {
        console.error('Failed to fetch previous owner:', err);
      }
    }

    // Transfer ownership
    listing.userRef = newOwnerId;
    await listing.save();

    // 📝 Save Permanent Ownership Audit Log
    try {
      const auditLog = new OwnershipAuditLog({
        propertyId: listing._id,
        propertyName: listing.name,
        adminId: req.user.id,
        adminName: req.user.username || req.user.email || 'Admin',
        action: 'TRANSFER',
        previousOwnerId: previousOwner?._id || null,
        previousOwnerEmail: previousOwner?.email || null,
        newOwnerId: newOwner._id,
        newOwnerEmail: newOwner.email,
        reason: reason.trim(),
        ipAddress: req.ip || req.headers['x-forwarded-for'] || 'Unknown',
        userAgent: req.headers['user-agent'] || 'Unknown'
      });
      await auditLog.save();
    } catch (auditError) {
      console.error('Failed to save ownership audit log:', auditError);
    }

    // 🔔 Notify Previous Owner
    if (previousOwner) {
      try {
        const prevNotif = new Notification({
          userId: previousOwner._id,
          type: 'property_deassigned',
          title: 'Property Ownership Transferred',
          message: `Your ownership of "${listing.name}" has been transferred to another user by Admin. Reason: ${reason}`,
          listingId: listing._id,
          adminId: req.user.id,
        });
        await prevNotif.save();
      } catch (err) {
        console.error('Failed to notify previous owner:', err);
      }

      if (previousOwner.email) {
        try {
          await sendOwnerDeassignedEmail(previousOwner.email, {
            propertyName: listing.name,
            propertyId: listing._id,
            reason: reason.trim(),
            adminName: req.user.username || req.user.email || 'Admin',
            ownerName: previousOwner.username || previousOwner.name || previousOwner.email
          });
        } catch (emailErr) {
          console.error('Failed to send email to previous owner:', emailErr);
        }
      }
    }

    // 🔔 Notify New Owner
    try {
      const newNotif = new Notification({
        userId: newOwner._id,
        type: 'property_assigned',
        title: 'Property Ownership Transferred to You',
        message: `You are now the official owner of property "${listing.name}"`,
        listingId: listing._id,
        adminId: req.user.id,
      });
      await newNotif.save();
    } catch (err) {
      console.error('Failed to notify new owner:', err);
    }

    if (newOwner.email) {
      try {
        await sendOwnerAssignedEmail(newOwner.email, {
          propertyName: listing.name,
          propertyId: listing._id,
          adminName: req.user.username || req.user.email || 'Admin',
          ownerName: newOwner.username || newOwner.name || newOwner.email
        });
      } catch (emailErr) {
        console.error('Failed to send email to new owner:', emailErr);
      }
    }

    res.status(200).json({
      success: true,
      message: `Property ownership successfully transferred to ${newOwner.username || newOwner.email}`,
      listing
    });

  } catch (error) {
    console.error('Error transferring property ownership:', error);
    return next(errorHandler(500, 'Failed to transfer property ownership'));
  }
};

export const reassignPropertyOwner = async (req, res, next) => {
  try {
    const { listingId } = req.params;
    const { newOwnerId, reason, password } = req.body;

    // Check if user is admin or rootadmin
    if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return next(errorHandler(401, 'Only admins can assign property ownership'));
    }

    if (!password) {
      return next(errorHandler(400, 'Admin password is required to confirm assignment'));
    }

    // Verify Admin Password
    const adminUser = await User.findById(req.user.id);
    if (!adminUser || !bcryptjs.compareSync(password, adminUser.password)) {
      return next(errorHandler(400, 'Invalid admin password. Action unauthorized.'));
    }

    // Validate listing exists
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return next(errorHandler(404, 'Listing not found'));
    }

    // Validate new owner exists
    const newOwner = await User.findById(newOwnerId);
    if (!newOwner) {
      return next(errorHandler(404, 'New owner not found'));
    }

    if (newOwner.status === 'suspended' || newOwner.status === 'banned') {
      return next(errorHandler(400, 'Cannot assign property to a suspended or banned user'));
    }

    if (newOwner.isVerified === false) {
      return next(errorHandler(400, 'Cannot assign property to an unverified user account'));
    }

    // Update the listing with new owner
    const updatedListing = await Listing.findByIdAndUpdate(
      listingId,
      { userRef: newOwnerId },
      { new: true }
    );

    // 📝 Save Permanent Ownership Audit Log
    try {
      const auditLog = new OwnershipAuditLog({
        propertyId: listing._id,
        propertyName: listing.name,
        adminId: req.user.id,
        adminName: req.user.username || req.user.email || 'Admin',
        action: 'ASSIGN',
        newOwnerId: newOwner._id,
        newOwnerEmail: newOwner.email,
        reason: reason ? reason.trim() : 'Assigned owner by admin',
        ipAddress: req.ip || req.headers['x-forwarded-for'] || 'Unknown',
        userAgent: req.headers['user-agent'] || 'Unknown'
      });
      await auditLog.save();
    } catch (auditError) {
      console.error('Failed to save ownership audit log:', auditError);
    }

    // Create notification for the new owner
    try {
      const notification = new Notification({
        userId: newOwnerId,
        type: 'property_assigned',
        title: 'Property Assigned to You',
        message: `You have been assigned as the owner of property "${listing.name}"`,
        listingId: listing._id,
        adminId: req.user.id,
      });
      await notification.save();
    } catch (notificationError) {
      console.error('Failed to create notification:', notificationError);
    }

    if (newOwner?.email) {
      try {
        await sendOwnerAssignedEmail(newOwner.email, {
          propertyName: listing.name,
          propertyId: listing._id,
          adminName: req.user.username || req.user.email || 'Admin',
          ownerName: newOwner.username || newOwner.name || newOwner.email
        });
      } catch (emailError) {
        console.error('Failed to send owner assigned email:', emailError);
      }
    }

    res.status(200).json({
      success: true,
      message: `Property ownership successfully assigned to ${newOwner.username || newOwner.email}`,
      listing: updatedListing
    });

  } catch (error) {
    console.error('Error reassigning property owner:', error);
    return next(errorHandler(500, 'Failed to reassign property ownership'));
  }
};

export const deassignPropertyOwner = async (req, res, next) => {
  try {
    const { listingId } = req.params;
    const { reason, password } = req.body;

    if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return next(errorHandler(401, 'Only admins can deassign property ownership'));
    }

    if (!reason || !reason.trim()) {
      return next(errorHandler(400, 'Reason is required to deassign owner'));
    }

    if (!password) {
      return next(errorHandler(400, 'Admin password is required to confirm owner removal'));
    }

    // Verify Admin Password
    const adminUser = await User.findById(req.user.id);
    if (!adminUser || !bcryptjs.compareSync(password, adminUser.password)) {
      return next(errorHandler(400, 'Invalid admin password. Owner removal unauthorized.'));
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return next(errorHandler(404, 'Listing not found'));
    }

    if (!listing.userRef) {
      return next(errorHandler(400, 'This property does not have an assigned owner.'));
    }

    const previousOwnerId = listing.userRef;
    let previousOwner = null;
    try {
      previousOwner = await User.findById(previousOwnerId);
    } catch (error) {
      console.error('Failed to fetch previous owner:', error);
    }

    listing.userRef = null;
    await listing.save();

    // 📝 Save Permanent Ownership Audit Log
    try {
      const auditLog = new OwnershipAuditLog({
        propertyId: listing._id,
        propertyName: listing.name,
        adminId: req.user.id,
        adminName: req.user.username || req.user.email || 'Admin',
        action: 'REMOVE',
        previousOwnerId: previousOwner?._id || null,
        previousOwnerEmail: previousOwner?.email || null,
        reason: reason.trim(),
        ipAddress: req.ip || req.headers['x-forwarded-for'] || 'Unknown',
        userAgent: req.headers['user-agent'] || 'Unknown'
      });
      await auditLog.save();
    } catch (auditError) {
      console.error('Failed to save ownership audit log:', auditError);
    }

    if (previousOwner) {
      try {
        const notification = new Notification({
          userId: previousOwner._id,
          type: 'property_deassigned',
          title: 'Property Ownership Removed',
          message: `You have been removed as the owner of "${listing.name}". Reason: ${reason}`,
          listingId: listing._id,
          adminId: req.user.id,
        });
        await notification.save();
      } catch (notificationError) {
        console.error('Failed to create deassign notification:', notificationError);
      }

      if (previousOwner.email) {
        try {
          await sendOwnerDeassignedEmail(previousOwner.email, {
            propertyName: listing.name,
            propertyId: listing._id,
            reason: reason.trim(),
            adminName: req.user.username || req.user.email || 'Admin',
            ownerName: previousOwner.username || previousOwner.name || previousOwner.email
          });
        } catch (emailError) {
          console.error('Failed to send owner deassigned email:', emailError);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Property owner removed successfully.',
      listingId: listing._id
    });
  } catch (error) {
    console.error('Error deassigning property owner:', error);
    return next(errorHandler(500, 'Failed to deassign property owner'));
  }
};

// Republish Listing (Reset to available)
export const republishListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
      return next(errorHandler(404, 'Listing not found'));
    }

    // Only Admin or Owner can republish
    if (req.user.id !== listing.userRef.toString() && req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return next(errorHandler(401, 'You can only republish your own listings!'));
    }

    // Update status to available
    listing.availabilityStatus = 'available';
    // Reset meta
    listing.availabilityMeta = {
      lockReason: null,
      lockDescription: null,
      lockedAt: null,
      bookingId: null,
      contractId: null
    };

    const updatedListing = await listing.save();
    res.status(200).json(updatedListing);
  } catch (error) {
    next(error);
  }
};

// Root Admin Bypass Verification & Publish
// Root Admin Bypass Verification & Publish
export const rootAdminBypassVerification = async (req, res, next) => {
  try {
    if (req.user.role !== 'rootadmin') {
      return next(errorHandler(403, 'Access denied. Root Admin only.'));
    }

    const { reason } = req.body;
    const verificationReason = reason || 'Instant verification by Root Admin';

    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return next(errorHandler(404, 'Listing not found'));
    }

    if (listing.isVerified) {
      return next(errorHandler(400, 'Property is already verified'));
    }

    // 1. Create or Update PropertyVerification Record
    let verification = await PropertyVerification.findOne({ listingId: listing._id });

    if (!verification) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9).toUpperCase();
      const verificationId = `VERIFY-${timestamp}-${random}`;

      verification = new PropertyVerification({
        verificationId,
        listingId: listing._id,
        landlordId: listing.userRef || listing.sellerId,
        verificationFee: 0,
        paymentStatus: 'completed',
      });
    }

    // 2. Set ALL verification fields to TRUE
    verification.status = 'verified';
    verification.adminNotes = `ROOT ADMIN BYPASS: ${verificationReason}`;

    verification.documents.ownershipProof.verified = true;
    verification.documents.ownershipProof.verifiedAt = new Date();
    verification.documents.ownershipProof.verifiedBy = req.user.id;

    verification.documents.identityProof.verified = true;
    verification.documents.identityProof.verifiedAt = new Date();
    verification.documents.identityProof.verifiedBy = req.user.id;

    verification.documents.addressProof.verified = true;
    verification.documents.addressProof.verifiedAt = new Date();
    verification.documents.addressProof.verifiedBy = req.user.id;

    verification.photosVerified = true;
    verification.locationVerified = true;
    verification.amenitiesVerified = true;

    verification.verifiedBadgeIssued = true;

    await verification.save();

    // 3. Update Listing
    listing.isVerified = true;
    listing.verificationId = verification._id;
    listing.visibility = 'public';
    listing.availabilityStatus = 'available';

    await listing.save();

    // 4. Send Email & Notifications
    const owner = await User.findById(listing.userRef || listing.sellerId);
    if (owner) {
      const listingDetails = {
        propertyName: listing.name,
        propertyId: listing._id,
        propertyDescription: listing.description,
        propertyAddress: listing.address,
        propertyPrice: listing.offer ? listing.discountPrice : listing.regularPrice,
        propertyImages: listing.imageUrls || [],
        city: listing.city,
        state: listing.state
      };
      await sendPropertyPublishedAfterVerificationEmail(owner.email, listingDetails);

      const { sendPushNotification } = await import('../utils/pushNotification.js');
      sendPushNotification(owner._id.toString(), '✅ Property Verified', `Congratulations! Your property "${listing.name}" is now verified and live.`, {
        imageUrl: listing.imageUrls ? listing.imageUrls[0] : null,
        category: 'verification_approved',
        data: { listingId: listing._id },
        actions: [
          { title: '🌐 View Live Property', identifier: 'view_listing_public' }
        ]
      });
    }

    res.status(200).json({
      success: true,
      message: 'Property instantly verified and published by Root Admin!',
      listing
    });

  } catch (error) {
    next(error);
  }
};

export const getAgentListings = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const query = {
      userRef: userId,
      isVerified: true,
      visibility: 'public',
      availabilityStatus: { $ne: 'suspended' }
    };

    const listings = await Listing.find(query).sort({ createdAt: -1 });

    res.status(200).json(listings);
  } catch (error) {
    next(error);
  }
};

// Root Admin: Unpublish/Revoke Verification
export const rootUnpublishListing = async (req, res, next) => {
  try {
    // 1. Check permissions (Root Admin or Admin)
    if (req.user.role !== 'rootadmin' && req.user.role !== 'admin' && !req.user.isDefaultAdmin) {
      return next(errorHandler(401, "Unauthorized: Only admins can unpublish listings"));
    }

    const listingId = req.params.id;
    const { reason } = req.body;

    if (!reason || reason.trim() === '') {
      return next(errorHandler(400, "A reason is required to unpublish a listing"));
    }

    // 2. Find Listing
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return next(errorHandler(404, "Listing not found"));
    }

    // 3. Update Listing Status (Unpublish & Unverify)
    listing.isVerified = false;
    listing.verificationStatus = 'unverified'; // Or 'rejected' if you prefer, but 'unverified' fits 'unpublished' context

    await listing.save();

    // 4. Update PropertyVerification Record if exists (to reflect revoked status)
    const verificationRecord = await PropertyVerification.findOne({ listingId: listing._id });
    if (verificationRecord) {
      verificationRecord.status = 'rejected'; // Or 'revoked' if enum supports
      verificationRecord.adminComments = `Unpublished by Admin: ${reason}`;
      verificationRecord.verifiedAt = null;
      await verificationRecord.save();
    }

    // 5. Notify Owner via Email
    const owner = await User.findById(listing.userRef);
    if (owner && owner.email) {
      try {
        await sendListingUnpublishedEmail(owner.email, {
          propertyName: listing.name,
          reason: reason,
          propertyId: listing._id
        });
      } catch (emailErr) {
        console.error("Failed to send unpublish email:", emailErr);
      }
    }

    // 6. Notify Owner via In-App Notification
    try {
      const notification = await Notification.create({
        userId: listing.userRef,
        type: 'verification_rejected', // Reuse existing type or new 'listing_unpublished'
        title: 'Listing Unpublished',
        message: `Your listing "${listing.name}" has been unpublished. Reason: ${reason}`,
        listingId: listing._id,
        adminId: req.user.id
      });
      const io = req.app.get('io');
      if (io) io.to(listing.userRef.toString()).emit('notificationCreated', notification);

      const { sendPushNotification } = await import('../utils/pushNotification.js');
      sendPushNotification(listing.userRef.toString(), '🚫 Listing Unpublished', `Your listing "${listing.name}" has been unpublished by an admin.`, {
        category: 'verification_rejected',
        data: { listingId: listing._id }
      });
    } catch (notifErr) {
      console.error("Failed to create in-app notification:", notifErr);
    }

    return res.status(200).json({
      success: true,
      message: "Listing has been unpublished and owner notified.",
      listing: listing
    });

  } catch (error) {
    console.error("Error unpublishing listing:", error);
    next(errorHandler(500, "Failed to unpublish listing"));
  }
};

const deleteOtpStore = new Map();

// Send OTP for property deletion
export const sendPropertyDeleteOTP = async (req, res, next) => {
  try {
    const { listingId } = req.body;
    if (!listingId) {
      return next(errorHandler(400, "Property ID is required"));
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return next(errorHandler(404, "Listing not found"));
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.email) {
      return next(errorHandler(400, "User email not found"));
    }

    const { generateOTP, sendPropertyDeletionOTPEmail } = await import('../utils/emailService.js');
    const otp = generateOTP();
    const emailLower = user.email.toLowerCase();
    const expirationTime = Date.now() + 10 * 60 * 1000; // 10 minutes

    deleteOtpStore.set(`${user._id}-${listingId}`, {
      otp,
      expirationTime,
      attempts: 0
    });

    const emailResult = await sendPropertyDeletionOTPEmail(emailLower, otp, listing.name);
    if (!emailResult.success) {
      return res.status(500).json({ success: false, message: "Failed to send verification email. Please try again." });
    }

    res.status(200).json({
      success: true,
      message: `OTP sent successfully to ${user.email}`
    });
  } catch (error) {
    next(error);
  }
};

// Verify OTP for property deletion
export const verifyPropertyDeleteOTP = async (req, res, next) => {
  try {
    const { listingId, otp } = req.body;
    if (!listingId || !otp) {
      return next(errorHandler(400, "Listing ID and OTP are required"));
    }

    const key = `${req.user.id}-${listingId}`;
    const storedData = deleteOtpStore.get(key);

    if (!storedData) {
      return next(errorHandler(400, "OTP has expired or was not requested. Please request a new code."));
    }

    if (Date.now() > storedData.expirationTime) {
      deleteOtpStore.delete(key);
      return next(errorHandler(400, "OTP has expired. Please request a new code."));
    }

    if (storedData.otp !== otp.trim()) {
      storedData.attempts = (storedData.attempts || 0) + 1;
      if (storedData.attempts >= 5) {
        deleteOtpStore.delete(key);
        return next(errorHandler(400, "Too many invalid attempts. Please request a new OTP."));
      }
      return next(errorHandler(400, `Invalid OTP code. ${5 - storedData.attempts} attempts remaining.`));
    }

    res.status(200).json({
      success: true,
      message: "OTP verified successfully"
    });
  } catch (error) {
    next(error);
  }
};