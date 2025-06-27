import Listing from "../models/listing.model.js"
import User from "../models/user.model.js"
import { errorHandler } from "../utils/error.js"
import mongoose from "mongoose"
import bcryptjs from "bcryptjs"

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
        if (req.body.password){
            req.body.password=bcryptjs.hashSync(req.body.password,10)
        }
        // Build update object only with provided fields
        const updateFields = {};
        if (req.body.username) updateFields.username = req.body.username;
        if (req.body.email) updateFields.email = req.body.email;
        if (req.body.password) updateFields.password = req.body.password;
        if (req.body.avatar) updateFields.avatar = req.body.avatar;
        if (req.body.mobileNumber) updateFields.mobileNumber = req.body.mobileNumber;
        const updatedUser = await User.findByIdAndUpdate(req.params.id, {
            $set: updateFields
        }, { new: true });
        if (!updatedUser) {
            return next(errorHandler(404, "User not found"));
        }
        // Return a plain object with all fields except password
        const { password, ...userObj } = updatedUser._doc;
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
   