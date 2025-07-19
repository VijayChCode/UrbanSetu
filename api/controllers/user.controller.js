import Listing from "../models/listing.model.js"
import User from "../models/user.model.js"
import { errorHandler } from "../utils/error.js"
import mongoose from "mongoose"
import bcryptjs from "bcryptjs"
import Review from "../models/review.model.js";
import ReviewReply from "../models/reviewReply.model.js";

export const test=(req,res)=>{
    res.send("Hello Api")
}


export const updateUser=async (req,res,next)=>{
    if (req.user.id!==req.params.id){
        return  next(errorHandler(401,"Unauthorized"))
    }
    try{
        const user = await User.findById(req.params.id);
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
            const existingEmail = await User.findOne({ email: req.body.email, _id: { $ne: req.params.id } });
            if (existingEmail) {
                return res.status(200).json({ status: "email_exists" });
            }
        }
        // Check for duplicate mobile number if changed
        if (req.body.mobileNumber && req.body.mobileNumber !== user.mobileNumber) {
            const existingMobile = await User.findOne({ mobileNumber: req.body.mobileNumber, _id: { $ne: req.params.id } });
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
        // If mobile number is being updated and is different, set isGeneratedMobile to false
        if (req.body.mobileNumber && req.body.mobileNumber !== user.mobileNumber) {
          updateFields.isGeneratedMobile = false;
        }
        
        const updatedUser = await User.findByIdAndUpdate(req.params.id, {
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
                email: updatedUser.email
            });
        }
        res.status(200).json({ status: "success", updatedUser: userObj });
    }
    catch (error){
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

export const deleteUser=async(req,res,next)=>{
    try{
        if (req.user.id!==req.params.id){
            return  next(errorHandler(401,"Unauthorized"))
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
        const { password } = req.body;
        if (!password) {
            return next(errorHandler(401, "Password is required to delete account"));
        }
        const isMatch = await bcryptjs.compare(password, user.password);
        if (!isMatch) {
            return next(errorHandler(401, "Password is incorrect"));
        }
        await User.findByIdAndDelete(req.params.id)
        res.status(200)
        res.json("User deleted successfully")
    }
    catch(error){
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
        
        // Get all users except the current admin
        const users = await User.find({
            _id: { $ne: req.user.id },
            status: { $ne: 'suspended' } // Exclude suspended users
        }).select('email username _id').sort({ email: 1 });
        
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
        // Verify new default admin exists, is approved, and is not suspended
        const newDefaultAdmin = await User.findById(newDefaultAdminId);
        if (!newDefaultAdmin || newDefaultAdmin.role !== "admin" || newDefaultAdmin.adminApprovalStatus !== "approved") {
            return next(errorHandler(400, "Selected user must be an approved admin"));
        }
        if (newDefaultAdmin.status === 'suspended') {
            return next(errorHandler(400, "Cannot transfer default admin rights to a suspended admin. Please remove suspension first."));
        }
        // Transfer default admin rights
        await User.findByIdAndUpdate(currentAdminId, { isDefaultAdmin: false });
        await User.findByIdAndUpdate(newDefaultAdminId, { isDefaultAdmin: true });
        res.status(200).json({
            message: "Default admin rights transferred successfully",
            newDefaultAdmin: {
                _id: newDefaultAdmin._id,
                username: newDefaultAdmin.username,
                email: newDefaultAdmin.email
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

export const getUserListings=async (req,res,next)=>{

    if (req.user.id!==req.params.id){
        return next(errorHandler(401,'unauthorized'))
    }
    else{
        try{
            const listing=await Listing.find({userRef:req.params.id})
            res.status(200)
            res.json(listing)
        }
        catch(error){
            console.error(error);
            next(error)
        }
    }
}

export const getUserByEmail=async (req,res,next)=>{
    try{
        const user=await User.findOne({email:req.params.email})
        if (!user) {
            return next(errorHandler(404, 'User not found'))
        }
        res.status(200).json(user)
    }
    catch(error){
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
   