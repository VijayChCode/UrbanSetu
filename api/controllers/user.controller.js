import Listing from "../models/listing.model.js"
import User from "../models/user.model.js"
import Agent from "../models/agent.model.js"
import { errorHandler } from "../utils/error.js"
import mongoose from "mongoose"
import DeletedAccount from '../models/deletedAccount.model.js';
import AuditLog from '../models/auditLog.model.js';
import AccountRevocation from '../models/accountRevocation.model.js';
import bcryptjs from "bcryptjs"
import crypto from 'crypto';
import { sendAccountDeletionEmail, sendDataExportEmail, sendProfileUpdateSuccessEmail } from '../utils/emailService.js';
import Review from "../models/review.model.js";
import ReviewReply from "../models/reviewReply.model.js";
import { validateEmail } from "../utils/emailValidation.js";
import { logSecurityEvent } from "../middleware/security.js";
import Wishlist from "../models/wishlist.model.js";
import PropertyWatchlist from "../models/propertyWatchlist.model.js";
import Booking from "../models/booking.model.js";
import Payment from "../models/payment.model.js";
import { awardSetuCoins } from "../utils/gamification.js";

import DataExport from "../models/dataExport.model.js";
import RentLockContract from "../models/rentLockContract.model.js";
import RentalLoan from "../models/rentalLoan.model.js";
import RentalRating from "../models/rentalRating.model.js";
import ChatHistory from "../models/chatHistory.model.js";
import CoinTransaction from "../models/coinTransaction.model.js";
import CallHistory from "../models/callHistory.model.js";
import ForumPost from "../models/forumPost.model.js";
import Blog from "../models/blog.model.js";
import Route from "../models/Route.js";
import CalculationHistory from "../models/calculationHistory.model.js";
import Subscription from "../models/subscription.model.js";
import VisitorLog from "../models/visitorLog.model.js";

// EXPORT_CACHE_EXPIRY remains relevant for setting the expiration Date object, 
// though Mongo TTL handles the actual deletion.
const EXPORT_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export const test = (req, res) => {
    res.send("Hello Api")
}


export const updateUser = async (req, res, next) => {
    const targetId = req.params.id === 'me' ? req.user.id : req.params.id;

    if (req.user.id !== targetId) {
        return next(errorHandler(401, "Unauthorized"))
    }
    try {
        const user = await User.findById(targetId);
        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        // Validate password if provided (for profile updates)
        if (req.body.password) {
            const isMatch = await bcryptjs.compare(req.body.password, user.password);
            if (!isMatch) {
                return res.status(200).json({ status: "invalid_password" });
            }
            // Remove password from body since it's just for validation
            delete req.body.password;
        }

        // Validate mobile number if provided
        if (req.body.mobileNumber && !/^[0-9]{10}$/.test(req.body.mobileNumber)) {
            return res.status(200).json({ status: "mobile_invalid" });
        }
        // Check for duplicate email if changed
        if (req.body.email && req.body.email !== user.email) {
            // Validate email for fraud detection
            const ip = req.ip || req.connection.remoteAddress;
            const userAgent = req.get('User-Agent');
            const emailValidation = validateEmail(req.body.email, {
                logSecurity: true,
                context: 'profile_email_update',
                ip,
                userAgent
            });

            if (!emailValidation.isValid) {
                // Log fraud attempt for security monitoring
                if (emailValidation.isFraud) {
                    logSecurityEvent('fraud_email_profile_update_attempt', {
                        email: req.body.email.toLowerCase(),
                        reason: emailValidation.reason,
                        ip,
                        userAgent,
                        userId: targetId
                    });
                }
                return res.status(200).json({ status: "email_invalid", message: emailValidation.message });
            }

            const existingEmail = await User.findOne({ email: req.body.email, _id: { $ne: targetId } });
            if (existingEmail) {
                return res.status(200).json({ status: "email_exists" });
            }
        }
        // Check for duplicate mobile number if changed
        if (req.body.mobileNumber && req.body.mobileNumber !== user.mobileNumber) {
            const existingMobile = await User.findOne({ mobileNumber: req.body.mobileNumber, _id: { $ne: targetId } });
            if (existingMobile) {
                return res.status(200).json({ status: "mobile_exists" });
            }
        }

        // Build update object only with provided fields
        const updateFields = {};
        if (req.body.username) updateFields.username = req.body.username;
        if (req.body.email) updateFields.email = req.body.email;
        if ('avatar' in req.body) updateFields.avatar = req.body.avatar || null;
        if (req.body.mobileNumber) updateFields.mobileNumber = req.body.mobileNumber;
        if (req.body.address) updateFields.address = req.body.address.trim();
        if (req.body.gender && typeof req.body.gender === 'string') updateFields.gender = req.body.gender.toLowerCase();
        if (req.body.profileVisibility) updateFields.profileVisibility = req.body.profileVisibility;

        // Handle nested settings updates
        if (req.body.settings && typeof req.body.settings === 'object') {
            Object.keys(req.body.settings).forEach(key => {
                updateFields[`settings.${key}`] = req.body.settings[key];
            });
        }
        // If mobile number is being updated and is different, set isGeneratedMobile to false
        if (req.body.mobileNumber && req.body.mobileNumber !== user.mobileNumber) {
            updateFields.isGeneratedMobile = false;
        }

        let coinsEarned = 0;

        // Award setuCoins if all profile details are filled for the FIRST time
        // Required fields for "completion": gender, address, mobileNumber, avatar (avatar has default so usually check if user changed/confirmed it, or just check the others)
        // Check current state before update to see if it was incomplete
        // Actually, we can just checking the NEW state from req.body + existing user data

        // We need to check the comprehensive set of fields for completion status
        const isProfileComplete =
            (req.body.gender || user.gender) &&
            (req.body.address || user.address) &&
            (req.body.mobileNumber || user.mobileNumber) &&
            // Ensure mobile is not the dummy one if that logic applies, assuming standard validation passed
            true;

        const bonusAlreadyReceived = user.gamification?.hasReceivedProfileCompletionBonus;

        if (isProfileComplete && !bonusAlreadyReceived && user.role === 'user') {
            // Award 20 coins
            await awardSetuCoins(user._id, 20, 'profile_completion', 'Profile Completion Bonus');
            updateFields['gamification.hasReceivedProfileCompletionBonus'] = true;
            coinsEarned = 20;
        }

        const updatedUser = await User.findByIdAndUpdate(targetId, {
            $set: updateFields
        }, { new: true });
        if (!updatedUser) {
            return next(errorHandler(404, "User not found"));
        }
        // Update all reviews by this user
        await Review.updateMany(
            { userId: updatedUser._id },
            { $set: { userName: updatedUser.username, userAvatar: updatedUser.avatar } }
        );
        // Update all replies by this user
        await ReviewReply.updateMany(
            { userId: updatedUser._id },
            { $set: { userName: updatedUser.username, userAvatar: updatedUser.avatar } }
        );

        // Sync with Agent Profile if exists
        const agentUpdateFields = {};
        if (updateFields.username) agentUpdateFields.name = updatedUser.username;
        if (updateFields.mobileNumber) agentUpdateFields.mobileNumber = updatedUser.mobileNumber;
        if (updateFields.avatar !== undefined) agentUpdateFields.photo = updatedUser.avatar;
        if (updateFields.address) agentUpdateFields.city = updatedUser.address;

        if (Object.keys(agentUpdateFields).length > 0) {
            await Agent.findOneAndUpdate({ userId: updatedUser._id }, { $set: agentUpdateFields });
        }
        // Return a plain object with all fields except password
        const { password, ...userObj } = updatedUser._doc;
        // Emit socket event for profile update
        const io = req.app.get('io');
        if (io) {
            io.emit('profileUpdated', {
                userId: updatedUser._id.toString(),
                username: updatedUser.username,
                avatar: updatedUser.avatar,
                mobileNumber: updatedUser.mobileNumber,
                email: updatedUser.email,
                address: updatedUser.address,
                gender: updatedUser.gender
            });
        }

        // Send profile update confirmation email only if core profile fields or profile visibility was changed
        // This avoids sending emails for minor setting changes made in Settings.jsx (like notification prefs)
        const profileFields = ['username', 'email', 'avatar', 'mobileNumber', 'address', 'gender', 'profileVisibility'];
        const isProfileInfoUpdate = profileFields.some(field => field in req.body);

        if (isProfileInfoUpdate || coinsEarned > 0) {
            try {
                await sendProfileUpdateSuccessEmail(updatedUser.email, updatedUser.username, updatedUser.role, coinsEarned);
            } catch (emailErr) {
                console.error('Failed to send profile update email:', emailErr);
                // Non-blocking error
            }
        }

        res.status(200).json({ status: "success", updatedUser: userObj });
    }
    catch (error) {
        // Handle MongoDB duplicate key error
        if (error.code === 11000) {
            if (error.keyPattern && error.keyPattern.email) {
                return res.status(200).json({ status: "email_exists" });
            }
            if (error.keyPattern && error.keyPattern.mobileNumber) {
                return res.status(200).json({ status: "mobile_exists" });
            }
        }
        console.error("Update user error:", error);
        return res.status(500).json({ status: "error", message: "Server error" });
    }
}

export const deleteUser = async (req, res, next) => {
    try {
        if (req.user.id !== req.params.id) {
            return next(errorHandler(401, "Unauthorized"))
        }
        // Check if user is the default admin
        const user = await User.findById(req.params.id);
        if (!user) {
            return next(errorHandler(404, "User not found"));
        }
        if (user.isDefaultAdmin) {
            return next(errorHandler(403, "Default admin cannot be deleted directly. Please assign a new default admin first."));
        }
        // Password verification
        const { password, reason, otherReason } = req.body;
        if (!password) {
            return next(errorHandler(401, "Password is required to delete account"));
        }
        const isMatch = await bcryptjs.compare(password, user.password);
        if (!isMatch) {
            return next(errorHandler(401, "Password is incorrect"));
        }
        // Soft-delete: move to DeletedAccounts and audit log
        const resolvedReason = reason === 'other' && otherReason ? otherReason : (reason || 'self_deleted');
        const deletedRecord = await DeletedAccount.create({
            accountId: user._id,
            name: user.username,
            email: user.email,
            role: user.role,
            deletedAt: new Date(),
            deletedBy: 'self',
            reason: resolvedReason,
            originalData: {
                username: user.username,
                email: user.email,
                password: user.password,
                mobileNumber: user.mobileNumber,
                address: user.address,
                gender: user.gender,
                avatar: user.avatar,
                role: user.role,
                isDefaultAdmin: user.isDefaultAdmin,
                adminApprovalStatus: user.adminApprovalStatus,
                adminApprovalDate: user.adminApprovalDate,
                approvedBy: user.approvedBy,
                adminRequestDate: user.adminRequestDate,
                status: user.status,
                createdAt: user.createdAt
            }
        });

        // Create revocation token for account restoration
        const revocationToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

        await AccountRevocation.create({
            accountId: user._id,
            email: user.email,
            username: user.username,
            role: user.role,
            revocationToken,
            expiresAt,
            originalData: deletedRecord.originalData,
            reason: resolvedReason
        });

        // Generate revocation link
        const revocationLink = `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/restore-account/${revocationToken}`;

        // Send account deletion email with revocation link
        try {
            await sendAccountDeletionEmail(user.email, {
                username: user.username,
                role: user.role
            }, revocationLink);
            console.log(`✅ Account deletion email sent to: ${user.email}`);
        } catch (emailError) {
            console.error(`❌ Failed to send deletion email to ${user.email}:`, emailError);
            // Don't fail the deletion if email fails
        }

        await User.findByIdAndDelete(req.params.id);
        await AuditLog.create({ action: 'soft_delete', performedBy: user._id, targetAccount: deletedRecord._id, targetEmail: user.email, details: { type: 'self_delete', role: user.role } });
        res.status(200).json({ success: true, message: "User moved to DeletedAccounts" })
    }
    catch (error) {
        console.error(error);
        next(error)
    }
}

// Get all approved admins for default admin selection
export const getApprovedAdmins = async (req, res, next) => {
    try {
        const currentUserId = req.params.currentUserId;

        // Get all approved admins except the current user
        const admins = await User.find({
            role: "admin",
            adminApprovalStatus: "approved",
            _id: { $ne: currentUserId }
        }).select('-password');

        res.status(200).json(admins);
    } catch (error) {
        next(error);
    }
};

// Get all users for email autocomplete (admin only)
export const getAllUsersForAutocomplete = async (req, res, next) => {
    try {
        // Only allow admin, rootadmin, or default admin to access this
        if (req.user.role !== 'admin' && req.user.role !== 'rootadmin' && !req.user.isDefaultAdmin) {
            return next(errorHandler(403, "Only admins can access user list"));
        }

        // Get only regular users (exclude admins and rootadmins)
        const users = await User.find({
            _id: { $ne: req.user.id },
            status: { $ne: 'suspended' }, // Exclude suspended users
            role: 'user' // Only return regular users, exclude admins and rootadmins
        }).select('email username _id mobileNumber role').sort({ email: 1 });

        res.status(200).json(users);
    } catch (error) {
        next(error);
    }
};

// Get user by email for assignment validation
export const getUserByEmailForAssignment = async (req, res, next) => {
    try {
        const { email } = req.params;

        if (!email) {
            return next(errorHandler(400, "Email is required"));
        }

        const user = await User.findOne({
            email: email,
            status: { $ne: 'suspended' } // Exclude suspended users
        }).select('email username _id');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found with this email"
            });
        }

        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        next(error);
    }
};

// Transfer default admin rights to another admin
export const transferDefaultAdminRights = async (req, res, next) => {
    try {
        const { currentAdminId, newDefaultAdminId } = req.body;
        // Verify current user is the default admin
        const currentAdmin = await User.findById(currentAdminId);
        if (!currentAdmin || !currentAdmin.isDefaultAdmin) {
            return next(errorHandler(403, "Only the default admin can transfer default admin rights"));
        }
        // Verify new default admin exists, is approved, active, and not already default/root
        const newDefaultAdmin = await User.findById(newDefaultAdminId);
        if (!newDefaultAdmin ||
            newDefaultAdmin.role !== "admin" ||
            newDefaultAdmin.adminApprovalStatus !== "approved" ||
            newDefaultAdmin.status === 'suspended' ||
            newDefaultAdmin.isDefaultAdmin) {
            return next(errorHandler(400, "Selected user must be an approved, active admin (not default/root)."));
        }
        if (newDefaultAdmin.status === 'suspended') {
            return next(errorHandler(400, "Cannot transfer default admin rights to a suspended admin. Please remove suspension first."));
        }
        // Transfer default admin rights and swap roles
        // Current admin becomes regular admin
        await User.findByIdAndUpdate(currentAdminId, {
            isDefaultAdmin: false,
            role: 'admin'
        });

        // New admin becomes root admin (default admin)
        const updatedNewAdmin = await User.findByIdAndUpdate(newDefaultAdminId, {
            isDefaultAdmin: true,
            role: 'rootadmin'
        }, { new: true });

        res.status(200).json({
            message: "Default admin rights transferred successfully",
            newDefaultAdmin: {
                _id: updatedNewAdmin._id,
                username: updatedNewAdmin.username,
                email: updatedNewAdmin.email
            }
        });
    } catch (error) {
        next(error);
    }
};

// Delete user after default admin transfer (for default admin only)
export const deleteUserAfterTransfer = async (req, res, next) => {
    try {
        if (req.user.id !== req.params.id) {
            return next(errorHandler(401, "Unauthorized"));
        }
        const user = await User.findById(req.params.id);
        if (!user) {
            return next(errorHandler(404, "User not found"));
        }
        // Only allow deletion if user is not default admin or if transfer was completed
        if (user.isDefaultAdmin) {
            return next(errorHandler(403, "Default admin rights must be transferred before deletion"));
        }
        // Password verification
        const { password } = req.body;
        if (!password) {
            return next(errorHandler(401, "Password is required to delete account"));
        }
        const isMatch = await bcryptjs.compare(password, user.password);
        if (!isMatch) {
            return next(errorHandler(401, "Password is incorrect"));
        }
        await User.findByIdAndDelete(req.params.id);
        res.status(200).json("User deleted successfully");
    } catch (error) {
        next(error);
    }
};

export const getUserListings = async (req, res, next) => {

    if (req.user.id !== req.params.id) {
        return next(errorHandler(401, 'unauthorized'))
    }
    else {
        try {
            const listing = await Listing.find({ userRef: req.params.id })
            res.status(200)
            res.json(listing)
        }
        catch (error) {
            console.error(error);
            next(error)
        }
    }
}

export const getUserSummary = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return next(errorHandler(404, 'User not found'));
        }

        // Check if user is admin or rootadmin or requesting their own summary
        const requestUser = await User.findById(req.user.id);
        const isAdmin = (requestUser && requestUser.role === 'admin' && requestUser.adminApprovalStatus === 'approved') || (requestUser && requestUser.role === 'rootadmin');

        if (!isAdmin && req.user.id !== userId) {
            return next(errorHandler(401, 'Unauthorized'));
        }

        const isTargetAdmin = targetUser.role === 'admin' || targetUser.role === 'rootadmin';

        // Execute counts in parallel for performance
        const [
            listingsCount,
            appointmentsCount,
            wishlistCount,
            watchlistCount,
            reviewsCount,
            receivedReviewsCount,
            referralsCount,
            paymentsCount,
            contractsCount,
            loansCount,
            conversationsCount,
            callsCount,
            forumCount,
            routesCount,
            calculationsCount
        ] = await Promise.all([
            isTargetAdmin ? Listing.countDocuments({}) : Listing.countDocuments({ userRef: userId }),
            isTargetAdmin ? Booking.countDocuments({}) : Booking.countDocuments({ $or: [{ buyerId: userId }, { sellerId: userId }] }),
            Wishlist.countDocuments({ userId }),
            PropertyWatchlist.countDocuments({ userId }),
            isTargetAdmin ? Review.countDocuments({}) : Review.countDocuments({ userId }), // Global reviews for admin, personal for user
            isTargetAdmin ? Review.countDocuments({}) : Listing.find({ userRef: userId }).then(async (userListings) => {
                const listingIds = userListings.map(l => l._id);
                return Review.countDocuments({ listingId: { $in: listingIds } });
            }).catch(() => 0),
            User.countDocuments({ "gamification.referredBy": userId }),
            Payment.countDocuments({ userId }).catch(() => 0),
            RentLockContract.countDocuments({ $or: [{ tenantId: userId }, { landlordId: userId }] }).catch(() => 0),
            RentalLoan.countDocuments({ userId }).catch(() => 0),
            ChatHistory.countDocuments({ userId }).catch(() => 0),
            CallHistory.countDocuments({ $or: [{ callerId: userId }, { receiverId: userId }] }).catch(() => 0),
            ForumPost.countDocuments({ author: userId }).catch(() => 0),
            Route.countDocuments({ userId }).catch(() => 0),
            CalculationHistory.countDocuments({ userId }).catch(() => 0)
        ]);

        // Get coin balance
        const user = await User.findById(userId).select('gamification');
        const coinBalance = user?.gamification?.setuCoinsBalance || 0;

        res.status(200).json({
            success: true,
            counts: {
                listings: listingsCount,
                appointments: appointmentsCount,
                wishlist: wishlistCount,
                watchlist: watchlistCount,
                reviews: reviewsCount,
                receivedReviews: receivedReviewsCount,
                referrals: referralsCount,
                payments: paymentsCount,
                contracts: contractsCount,
                loans: loansCount,
                conversations: conversationsCount,
                calls: callsCount,
                forumPosts: forumCount,
                routes: routesCount,
                calculations: calculationsCount,
                coinBalance
            }
        });
    } catch (error) {
        console.error("Error fetching user summary:", error);
        next(error);
    }
}

export const getUserByEmail = async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.params.email })
        if (!user) {
            return next(errorHandler(404, 'User not found'))
        }
        res.status(200).json(user)
    }
    catch (error) {
        console.error(error);
        next(error)
    }
}

export const changePassword = async (req, res, next) => {
    try {
        // Only allow user to change their own password
        if (req.user.id !== req.params.id) {
            return next(errorHandler(401, "Unauthorized"));
        }
        const { previousPassword, newPassword } = req.body;
        if (!previousPassword || !newPassword) {
            return next(errorHandler(400, "Previous and new password are required"));
        }
        const user = await User.findById(req.params.id);
        if (!user) {
            return next(errorHandler(404, "User not found"));
        }
        const isMatch = await bcryptjs.compare(previousPassword, user.password);
        if (!isMatch) {
            return next(errorHandler(401, "Previous password is incorrect"));
        }
        user.password = bcryptjs.hashSync(newPassword, 10);
        await user.save();

        // Send password change success email
        try {
            const { sendPasswordChangeSuccessEmail } = await import("../utils/emailService.js");
            await sendPasswordChangeSuccessEmail(user.email, user.username, 'manual_change');
        } catch (emailError) {
            console.error('Failed to send password change success email:', emailError);
            // Don't fail the request if email fails
        }

        res.status(200).json({ success: true, message: "Password changed successfully" });
    } catch (error) {
        next(error);
    }
};

// Verify password for account deletion (for default admin)
export const verifyPassword = async (req, res, next) => {
    try {
        // Only allow user to verify their own password
        if (req.user.id !== req.params.id) {
            return next(errorHandler(401, "Unauthorized"));
        }
        const { password } = req.body;
        if (!password) {
            return next(errorHandler(400, "Password is required"));
        }
        const user = await User.findById(req.params.id);
        if (!user) {
            return next(errorHandler(404, "User not found"));
        }
        const isMatch = await bcryptjs.compare(password, user.password);
        if (!isMatch) {
            return next(errorHandler(401, "Password is incorrect"));
        }
        res.status(200).json({ success: true, message: "Password verified successfully" });
    } catch (error) {
        next(error);
    }
};

// Check email availability for profile updates
export const checkEmailAvailability = async (req, res, next) => {
    try {
        const { email } = req.params;
        const currentUserId = req.user.id;

        if (!email) {
            return next(errorHandler(400, "Email is required"));
        }

        // Check if email exists (excluding current user)
        const existingUser = await User.findOne({
            email: email,
            _id: { $ne: currentUserId }
        });

        if (existingUser) {
            return res.status(200).json({
                available: false,
                message: "Email already exists"
            });
        }

        res.status(200).json({
            available: true,
            message: "Email available"
        });
    } catch (error) {
        next(error);
    }
};

// Check mobile number availability for profile updates
export const checkMobileAvailability = async (req, res, next) => {
    try {
        const { mobile } = req.params;
        const currentUserId = req.user.id;

        if (!mobile) {
            return next(errorHandler(400, "Mobile number is required"));
        }

        // Validate mobile number format
        if (!/^[0-9]{10}$/.test(mobile)) {
            return res.status(200).json({
                available: false,
                message: "Please provide a valid 10-digit mobile number"
            });
        }

        // Check if mobile number exists (excluding current user)
        const existingUser = await User.findOne({
            mobileNumber: mobile,
            _id: { $ne: currentUserId }
        });

        if (existingUser) {
            return res.status(200).json({
                available: false,
                message: "Mobile number already exists"
            });
        }

        res.status(200).json({
            available: true,
            message: "Mobile number available"
        });
    } catch (error) {
        next(error);
    }
};

// Export user data
export const exportData = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { password, selectedModules } = req.body;

        if (!password) {
            return next(errorHandler(400, "Password is required"));
        }

        // Verify password
        const user = await User.findById(userId);
        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        const isPasswordValid = await bcryptjs.compare(password, user.password);
        if (!isPasswordValid) {
            return next(errorHandler(401, "Invalid password"));
        }

        // Strong & Accurate: Check DB for existing export (survives restarts)
        const existingExport = await DataExport.findOne({ userId: userId });
        if (existingExport) {
            const timeRemaining = Math.ceil((existingExport.expiresAt - new Date()) / (60 * 60 * 1000));
            return next(errorHandler(429, `Security Policy: You can only request one data export every 24 hours. Please try again in approximately ${timeRemaining} hours.`));
        }

        // Module definitions with their data fetching logic
        const modules = {
            wishlist: () => Wishlist.find({ userId }).populate('listingId').lean(),
            watchlist: () => PropertyWatchlist.find({ userId }).populate('listingId').lean(),
            appointments: () => Booking.find({ $or: [{ buyerId: userId }, { sellerId: userId }] }).populate('listingId').lean(),
            listings: () => Listing.find({ userRef: userId }).lean(),
            reviews: () => Review.find({ userId }).populate('listingId').lean(),
            payments: () => Payment.find({ userId }).lean().catch(() => []),
            rentalContracts: () => RentLockContract.find({ $or: [{ tenantId: userId }, { landlordId: userId }] }).populate('listingId').lean().catch(() => []),
            rentalLoans: () => RentalLoan.find({ userId }).populate('contractId').lean().catch(() => []),
            rentalRatings: () => RentalRating.find({ $or: [{ reviewerId: userId }, { targetUser: userId }] }).lean().catch(() => []),
            gamification: () => CoinTransaction.find({ userId }).lean().catch(() => []),
            gemini: () => ChatHistory.find({ userId }).lean().catch(() => []),
            calls: () => CallHistory.find({ $or: [{ callerId: userId }, { receiverId: userId }] }).lean().catch(() => []),
            community: () => ForumPost.find({ author: userId }).lean().catch(() => []),
            routes: () => Route.find({ userId }).lean().catch(() => []),
            investments: () => CalculationHistory.find({ userId }).lean().catch(() => []),
            blogComments: () => Blog.aggregate([
                { $unwind: "$comments" },
                { $match: { "comments.user": user._id } },
                { $project: { _id: 1, title: 1, comment: "$comments" } }
            ]).catch(() => []),
            referrals: () => User.countDocuments({ "gamification.referredBy": userId }).catch(() => 0),
            clientErrors: async () => {
                if (user.role !== 'admin' && user.role !== 'rootadmin') return [];
                const errors = await VisitorLog.aggregate([
                    {
                        $match: {
                            'pageViews': {
                                $elemMatch: {
                                    'errorLogs.0': { $exists: true }
                                }
                            }
                        }
                    },
                    { $unwind: '$pageViews' },
                    { $unwind: '$pageViews.errorLogs' },
                    {
                        $project: {
                            _id: 0,
                            message: '$pageViews.errorLogs.message',
                            source: '$pageViews.errorLogs.source',
                            stack: '$pageViews.errorLogs.stack',
                            timestamp: '$pageViews.errorLogs.timestamp',
                            path: '$pageViews.path',
                            visitorId: '$_id',
                            location: 1,
                            device: 1,
                            browser: 1,
                            os: 1
                        }
                    },
                    { $sort: { timestamp: -1 } }
                ]);
                return errors;
            }
        };

        // Determine which modules to fetch (default to all if not specified)
        const modulesToFetch = selectedModules && selectedModules.length > 0
            ? selectedModules
            : Object.keys(modules); // Fallback for backward compatibility

        // Execute fetches in parallel
        const results = {};
        await Promise.all(
            Object.entries(modules).map(async ([key, fetcher]) => {
                // Determine if this module is needed
                // Special case: 'listings' are needed if 'reviews' (received) is requested, even if 'listings' itself isn't requested.
                // However, to simplify, we can just fetch if requested. If 'reviewsReceived' is requested (bundled under 'reviews' likely or a separate key), we need listings.
                // Upon reviewing the UI map: "Reviews & Ratings (Tenant/Landlord)" -> includes written and received. 
                // "Listings" -> listings.
                // If user selects "Reviews", we probably want reviewsReceived. For that we need listings.
                if (modulesToFetch.includes(key) || (key === 'listings' && modulesToFetch.includes('reviews'))) {
                    results[key] = await fetcher();
                } else {
                    results[key] = []; // Default empty
                }
            })
        );

        // Handle Referrals special case (count vs array)
        if (results.referrals === undefined) results.referrals = 0;

        // Map results to variables for backward compatibility
        const wishlistItems = results.wishlist || [];
        const watchlistItems = results.watchlist || [];
        const appointments = results.appointments || [];
        const userListings = results.listings || [];
        const reviewsWritten = results.reviews || [];
        const payments = results.payments || [];
        const rentalContracts = results.rentalContracts || [];
        const rentalLoans = results.rentalLoans || [];
        const rentalRatings = results.rentalRatings || [];
        const coinTransactions = results.gamification || [];
        const geminiSessions = results.gemini || [];
        const callHistoryLogs = results.calls || [];
        const forumPosts = results.community || [];
        const savedRoutes = results.routes || [];
        const calculationHistoryItems = results.investments || [];
        const blogCommentsAgg = results.blogComments || [];
        const referralCount = typeof results.referrals === 'number' ? results.referrals : 0;
        const clientErrors = results.clientErrors || [];

        // Phase 2: Dependent data - Reviews Received (depends on Listings)
        let reviewsReceived = [];
        if (modulesToFetch.includes('reviews') && userListings.length > 0) {
            const userListingIds = userListings.map(l => l._id);
            reviewsReceived = await Review.find({ listingId: { $in: userListingIds } })
                .populate('listingId', 'name')
                .lean()
                .catch(() => []);
        }

        // Get counts
        const wishlistCount = wishlistItems.length;
        const watchlistCount = watchlistItems.length;
        const appointmentsCount = appointments.length;
        const listingsCount = userListings.length;
        const reviewsCount = reviewsWritten.length;
        const paymentsCount = payments.length;

        // Calculate Gemini Prompts
        let geminiPromptsCount = 0;
        geminiSessions.forEach(session => {
            if (session.messages) {
                // Count only user messages
                geminiPromptsCount += session.messages.filter(m => m.role === 'user').length;
            }
        });

        // Prepare base user data
        const userData = {
            accountInfo: {
                username: user.username,
                email: user.email,
                mobileNumber: user.mobileNumber,
                address: user.address,
                gender: user.gender,
                role: user.role,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                profilePicture: user.profilePicture
            },
            statistics: {}
        };

        // Populate statistics only for selected modules
        if (modulesToFetch.includes('wishlist')) userData.statistics.wishlistCount = wishlistCount;
        if (modulesToFetch.includes('watchlist')) userData.statistics.watchlistCount = watchlistCount;
        if (modulesToFetch.includes('appointments')) userData.statistics.appointmentsCount = appointmentsCount;
        if (modulesToFetch.includes('listings')) userData.statistics.listingsCount = listingsCount;
        if (modulesToFetch.includes('reviews')) {
            userData.statistics.reviewsWrittenCount = reviewsCount;
            userData.statistics.reviewsReceivedCount = reviewsReceived.length;
        }
        if (modulesToFetch.includes('payments')) userData.statistics.paymentsCount = paymentsCount;
        if (modulesToFetch.includes('gemini')) userData.statistics.geminiPromptsCount = geminiPromptsCount;
        if (modulesToFetch.includes('rentalContracts')) userData.statistics.rentalContractsCount = rentalContracts.length;
        if (modulesToFetch.includes('rentalLoans')) userData.statistics.rentalLoansCount = rentalLoans.length;
        if (modulesToFetch.includes('community')) userData.statistics.forumPostsCount = forumPosts.length;
        if (modulesToFetch.includes('routes')) userData.statistics.savedRoutesCount = savedRoutes.length;
        if (modulesToFetch.includes('investments')) userData.statistics.calculationsCount = calculationHistoryItems.length;
        if (modulesToFetch.includes('blogComments')) userData.statistics.blogCommentsCount = blogCommentsAgg.length;
        if (modulesToFetch.includes('calls')) userData.statistics.totalCalls = callHistoryLogs.length;
        if (modulesToFetch.includes('clientErrors') && (user.role === 'admin' || user.role === 'rootadmin')) {
            userData.statistics.clientErrorsCount = clientErrors.length;
        }

        // Remove statistics object if it remains empty
        if (Object.keys(userData.statistics).length === 0) {
            delete userData.statistics;
        }

        // Add Gamification data if selected
        if (modulesToFetch.includes('gamification')) {
            userData.gamification = {
                setuCoinsBalance: user.gamification?.setuCoinsBalance || 0,
                totalCoinsEarned: user.gamification?.totalCoinsEarned || 0,
                currentStreak: user.gamification?.currentStreak || 0,
                transactions: coinTransactions.map(tx => ({
                    amount: tx.amount,
                    type: tx.type,
                    description: tx.description,
                    createdAt: tx.createdAt
                }))
            };
        }

        // Add Referrals if selected
        if (modulesToFetch.includes('referrals')) {
            if (!userData.gamification) userData.gamification = {};
            userData.gamification.referralsCount = referralCount;
        }

        // Conditional data blocks
        if (modulesToFetch.includes('wishlist')) {
            userData.wishlist = wishlistItems.map(item => ({
                listingId: item.listingId?._id || item.listingId,
                listingTitle: item.listingId?.name || 'N/A',
                addedAt: item.addedAt || item.createdAt,
                effectivePriceAtAdd: item.effectivePriceAtAdd
            }));
        }

        if (modulesToFetch.includes('watchlist')) {
            userData.watchlist = watchlistItems.map(item => ({
                listingId: item.listingId?._id || item.listingId,
                listingTitle: item.listingId?.name || 'N/A',
                addedAt: item.addedAt || item.createdAt,
                effectivePriceAtAdd: item.effectivePriceAtAdd
            }));
        }

        if (modulesToFetch.includes('appointments')) {
            userData.appointments = appointments.map(apt => ({
                appointmentId: apt._id,
                listingId: apt.listingId?._id || apt.listingId,
                listingTitle: apt.listingId?.name || apt.propertyName || 'N/A',
                purpose: apt.purpose,
                date: apt.date,
                time: apt.time,
                status: apt.status,
                createdAt: apt.createdAt
            }));
        }

        if (modulesToFetch.includes('listings')) {
            userData.listings = userListings.map(listing => ({
                listingId: listing._id,
                name: listing.name,
                address: listing.address,
                regularPrice: listing.regularPrice,
                discountPrice: listing.discountPrice,
                type: listing.type,
                offer: listing.offer,
                createdAt: listing.createdAt,
                updatedAt: listing.updatedAt
            }));
        }

        if (modulesToFetch.includes('reviews')) {
            userData.reviewsWritten = reviewsWritten.map(review => ({
                reviewId: review._id,
                listingId: review.listingId?._id || review.listingId,
                listingTitle: review.listingId?.name || 'N/A',
                starRating: review.starRating,
                comment: review.comment,
                createdAt: review.createdAt
            }));

            userData.reviewsReceived = reviewsReceived.map(review => ({
                reviewId: review._id,
                listingTitle: review.listingId?.name || 'N/A',
                starRating: review.starRating,
                comment: review.comment,
                createdAt: review.createdAt
            }));
        }

        if (modulesToFetch.includes('rentalContracts')) {
            userData.rentalContracts = rentalContracts.map(contract => ({
                contractId: contract._id,
                status: contract.status,
                rentAmount: contract.rentAmount,
                startDate: contract.startDate,
                endDate: contract.endDate,
                role: contract.tenantId?.toString() === userId ? 'Tenant' : 'Landlord'
            }));
        }

        if (modulesToFetch.includes('rentalLoans')) {
            userData.rentalLoans = rentalLoans.map(loan => ({
                loanId: loan._id,
                amount: loan.amount,
                status: loan.status,
                createdAt: loan.createdAt
            }));
        }

        if (modulesToFetch.includes('rentalRatings')) {
            userData.rentalRatings = rentalRatings.map(rating => ({
                rating: rating.rating,
                comment: rating.comment,
                type: rating.type,
                createdAt: rating.createdAt
            }));
        }

        if (modulesToFetch.includes('payments')) {
            userData.payments = payments.map(payment => ({
                paymentId: payment._id,
                amount: payment.amount,
                status: payment.status,
                createdAt: payment.createdAt
            }));
        }

        if (modulesToFetch.includes('gemini')) {
            userData.geminiHistorySummary = {
                totalSessions: geminiSessions.length,
                totalPrompts: geminiPromptsCount,
                sessions: geminiSessions.map(s => ({
                    sessionId: s.sessionId,
                    messageCount: s.messages ? s.messages.length : 0,
                    lastActivity: s.lastActivity
                }))
            };
        }

        if (modulesToFetch.includes('calls')) {
            userData.callHistory = callHistoryLogs.map(call => ({
                type: call.callType,
                status: call.status,
                duration: call.duration,
                startedAt: call.startTime,
                role: call.callerId?.toString() === userId ? 'Caller' : 'Receiver'
            }));
        }

        if (modulesToFetch.includes('community')) {
            userData.communityDiscussions = forumPosts.map(post => ({
                postId: post._id,
                title: post.title,
                category: post.category,
                likes: post.likes ? post.likes.length : 0,
                createdAt: post.createdAt
            }));
        }

        if (modulesToFetch.includes('blogComments')) {
            userData.blogComments = blogCommentsAgg.map(item => ({
                blogId: item._id,
                blogTitle: item.title,
                comment: item.comment?.content,
                commentedAt: item.comment?.createdAt
            }));
        }

        if (modulesToFetch.includes('routes')) {
            userData.savedRoutes = savedRoutes.map(route => ({
                routeId: route._id,
                name: route.name,
                distance: route.route?.distance,
                stopsCount: route.stops ? route.stops.length : 0,
                createdAt: route.createdAt
            }));
        }

        if (modulesToFetch.includes('investments')) {
            userData.investmentCalculations = calculationHistoryItems.map(calc => ({
                type: calc.type,
                inputs: calc.inputs,
                result: calc.result,
                createdAt: calc.createdAt
            }));
        }

        if (modulesToFetch.includes('clientErrors') && (user.role === 'admin' || user.role === 'rootadmin')) {
            userData.clientErrorsSummary = {
                totalErrors: clientErrors.length,
                errors: clientErrors.slice(0, 1000) // Limit to 1000 for size
            };
        }

        // Add metadata
        userData.exportDate = new Date().toISOString();
        userData.exportVersion = "1.2";

        // Convert to JSON string
        const dataStr = JSON.stringify(userData, null, 2);
        const dataBuffer = Buffer.from(dataStr, 'utf-8');

        // Generate unique token for download links
        const exportToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + EXPORT_CACHE_EXPIRY);

        // Store export data in database
        await DataExport.create({
            userId: user._id,
            token: exportToken,
            data: dataStr,
            username: user.username,
            expiresAt: expiresAt
        });

        // Generate download URLs
        const base = `${req.protocol}://${req.get('host')}`;
        const jsonDownloadUrl = `${base}/api/user/export-data/${exportToken}/json`;
        const txtDownloadUrl = `${base}/api/user/export-data/${exportToken}/txt`;

        // Send email with download links
        const emailResult = await sendDataExportEmail(user.email, user.username, jsonDownloadUrl, txtDownloadUrl, modulesToFetch);

        if (!emailResult.success) {
            // Clean up database on email failure
            await DataExport.deleteOne({ token: exportToken });
            return next(errorHandler(500, "Failed to send export email: " + emailResult.error));
        }

        res.status(200).json({
            success: true,
            message: "Your data export has been prepared and will be sent to your email shortly."
        });
    } catch (error) {
        next(error);
    }
};

// Search users by name or email (for Admin Panel)
export const searchUsers = async (req, res, next) => {
    try {
        // Strict admin check
        if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return next(errorHandler(403, 'Forbidden'));
        }

        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.status(200).json({ success: true, users: [] });
        }

        const users = await User.find({
            $or: [
                { username: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } }
            ],
            role: { $nin: ['admin', 'rootadmin'] }
        })
            .select('username email _id avatar')
            .limit(10);

        res.status(200).json({ success: true, users });
    } catch (error) {
        next(error);
    }
};

// Download exported data
export const downloadExportData = async (req, res, next) => {
    try {
        const { token, type } = req.params;

        const record = await DataExport.findOne({ token });

        if (!record || new Date() > record.expiresAt) {
            if (record) await DataExport.deleteOne({ token });
            return res.status(404).json({ message: "Export link expired or invalid" });
        }

        const extension = type === 'json' ? 'json' : 'txt';
        const contentType = type === 'json' ? 'application/json' : 'text/plain';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="urbansetu-data-${record.username}-${Math.floor(Date.now() / 1000)}.${extension}"`);
        res.send(record.data);

    } catch (error) {
        next(error);
    }
};

// Unsubscribe user via token
export const unsubscribeUser = async (req, res, next) => {
    try {
        const { email, token } = req.body;

        if (!email || !token) {
            return next(errorHandler(400, "Email and token are required"));
        }

        // Import generateUnsubscribeToken to verify
        const { generateUnsubscribeToken } = await import("../utils/emailService.js");
        const expectedToken = generateUnsubscribeToken(email);

        if (token !== expectedToken) {
            return next(errorHandler(400, "Invalid unsubscribe token"));
        }

        const user = await User.findOne({ email });

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        if (user.isSubscribed === false) {
            return res.status(200).json({
                success: true,
                message: "ALREADY_UNSUBSCRIBED"
            });
        }

        user.isSubscribed = false;
        await user.save();

        // Sync with Subscription model if exists
        await Subscription.findOneAndUpdate(
            { email },
            {
                status: 'opted_out',
                statusUpdatedAt: new Date()
            }
        );

        res.status(200).json({
            success: true,
            message: "Successfully unsubscribed from promotional emails"
        });
    } catch (error) {
        next(error);
    }
};

// Submit unsubscribe reason
export const submitUnsubscribeReason = async (req, res, next) => {
    try {
        const { email, token, reason } = req.body;

        if (!email || !token || !reason) {
            return next(errorHandler(400, "Email, token and reason are required"));
        }

        // Verify token again for security
        const { generateUnsubscribeToken } = await import("../utils/emailService.js");
        const expectedToken = generateUnsubscribeToken(email);

        if (token !== expectedToken) {
            return next(errorHandler(400, "Invalid token"));
        }

        const user = await User.findOneAndUpdate(
            { email },
            { unsubscribeReason: reason },
            { new: true }
        );

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        // Also update reason in Subscription model if exists
        await Subscription.findOneAndUpdate(
            { email },
            { rejectionReason: reason }
        );

        res.status(200).json({
            success: true,
            message: "Thank you for your feedback!"
        });
    } catch (error) {
        next(error);
    }
};

// Admin: Toggle user subscription status
export const toggleUserSubscription = async (req, res, next) => {
    try {
        // Strict admin check
        if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return next(errorHandler(403, 'Forbidden'));
        }

        const { id } = req.params;
        const { isSubscribed, reason } = req.body;

        const user = await User.findByIdAndUpdate(
            id,
            { isSubscribed },
            { new: true }
        ).select('username email isSubscribed');

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        // Sync with Subscription model if exists
        const subscription = await Subscription.findOne({ email: user.email });
        if (subscription) {
            subscription.status = isSubscribed ? 'approved' : 'revoked';
            if (!isSubscribed) {
                subscription.rejectionReason = reason || 'Revoked by Administrator';
            }
            subscription.statusUpdatedAt = new Date();
            await subscription.save();
        }

        // Send email notification
        try {
            const { sendSubscriptionApprovedEmail, sendSubscriptionRevokedEmail } = await import("../utils/emailService.js");
            if (isSubscribed) {
                // Use guide type if they have guide preference, else blog
                const type = subscription?.preferences?.guide ? 'guide' : 'blog';
                await sendSubscriptionApprovedEmail(user.email, type);
            } else {
                const type = subscription?.preferences?.guide ? 'guide' : 'blog';
                await sendSubscriptionRevokedEmail(user.email, type, reason || 'Manually updated by administrator');
            }
        } catch (emailError) {
            console.error('Failed to send subscription status email:', emailError);
            // Non-blocking
        }

        res.status(200).json({
            success: true,
            message: `User subscription ${isSubscribed ? 'enabled' : 'disabled'} successfully`,
            user
        });
    } catch (error) {
        next(error);
    }
};
