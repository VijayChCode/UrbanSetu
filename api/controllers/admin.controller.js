import User from "../models/user.model.js";
import { errorHandler } from "../utils/error.js";
import bcryptjs from "bcryptjs";

// Get all pending admin requests
export const getPendingAdminRequests = async (req, res, next) => {
    try {
        const pendingRequests = await User.find({
            role: "admin",
            adminApprovalStatus: "pending"
        }).select('-password').sort({ adminRequestDate: -1 });
        
        res.status(200).json(pendingRequests);
    } catch (error) {
        next(error);
    }
};

// Approve admin request
export const approveAdminRequest = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { currentUserId } = req.body;
        
        // Find the current user (should be an approved admin)
        const currentUser = await User.findById(currentUserId);
        if (!currentUser) {
            return next(errorHandler(404, "User not found"));
        }
        
        // Allow rootadmin or default admin to approve
        if (!((currentUser.role === 'admin' && currentUser.adminApprovalStatus === 'approved') || currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin)) {
            return next(errorHandler(403, "Only approved admins or root admin can approve requests"));
        }
        
        // Find the user to approve
        const user = await User.findById(userId);
        if (!user) {
            return next(errorHandler(404, "User not found"));
        }
        
        if (user.role !== "admin" || user.adminApprovalStatus !== "pending") {
            return next(errorHandler(400, "Invalid admin request"));
        }
        
        user.adminApprovalStatus = "approved";
        user.adminApprovalDate = new Date();
        user.approvedBy = currentUserId;
        
        await user.save();
        
        res.status(200).json({
            message: "Admin request approved successfully",
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                adminApprovalStatus: user.adminApprovalStatus
            }
        });
    } catch (error) {
        next(error);
    }
};

// Reject admin request
export const rejectAdminRequest = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { currentUserId } = req.body;
        
        // Find the current user (should be an approved admin)
        const currentUser = await User.findById(currentUserId);
        if (!currentUser) {
            return next(errorHandler(404, "User not found"));
        }
        
        // Allow rootadmin or default admin to reject
        if (!((currentUser.role === 'admin' && currentUser.adminApprovalStatus === 'approved') || currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin)) {
            return next(errorHandler(403, "Only approved admins or root admin can reject requests"));
        }
        
        // Find the user to reject
        const user = await User.findById(userId);
        if (!user) {
            return next(errorHandler(404, "User not found"));
        }
        
        if (user.role !== "admin" || user.adminApprovalStatus !== "pending") {
            return next(errorHandler(400, "Invalid admin request"));
        }
        
        user.adminApprovalStatus = "rejected";
        user.adminApprovalDate = new Date();
        user.approvedBy = currentUserId;
        
        await user.save();
        
        res.status(200).json({
            message: "Admin request rejected successfully",
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                adminApprovalStatus: user.adminApprovalStatus
            }
        });
    } catch (error) {
        next(error);
    }
};

// Transfer Root Admin Rights
export const transferRootAdminRights = async (req, res, next) => {
    try {
        const { targetAdminId, password } = req.body;
        const currentUserId = req.user._id;

        // 1. Verify current user is default admin
        const currentUser = await User.findById(currentUserId);
        if (!currentUser || !currentUser.isDefaultAdmin) {
            return res.status(403).json({ message: "Only default admins can transfer rights." });
        }

        // 2. Check password
        const isMatch = await bcryptjs.compare(password, currentUser.password);
        if (!isMatch) {
            return res.status(401).json({ error: "invalidPassword" });
        }

        // 3. Ensure target is a valid admin (not default admin/rootadmin)
        const targetAdmin = await User.findById(targetAdminId);
        if (!targetAdmin || targetAdmin.role !== "admin" || targetAdmin.isDefaultAdmin) {
            return res.status(400).json({ message: "Target must be a valid admin (not default admin)." });
        }

        // 4. Swap roles/flags
        currentUser.isDefaultAdmin = false;
        if (currentUser.role === 'rootadmin') {
            currentUser.role = 'admin';
        }
        targetAdmin.isDefaultAdmin = true;
        targetAdmin.role = 'rootadmin';
        await currentUser.save();
        await targetAdmin.save();

        // 5. Return success
        return res.status(200).json({
            message: `Admin rights are transferred successfully to ${targetAdmin.email}`,
            newRootAdminEmail: targetAdmin.email
        });
    } catch (error) {
        next(error);
    }
}; 