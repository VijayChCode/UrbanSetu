import User from "../models/user.model.js";
import { errorHandler } from "../utils/error.js";
import bcryptjs from "bcryptjs";
import { sendAdminApprovalEmail, sendAdminRejectionEmail } from "../utils/emailService.js";

// Get all pending admin requests
export const getPendingAdminRequests = async (req, res, next) => {
    try {
        const currentUser = await User.findById(req.user.id);
        if (!currentUser || (currentUser.role !== 'rootadmin' && !currentUser.isDefaultAdmin)) {
            return next(errorHandler(403, 'Access denied. Only root admin or default admin can view pending requests.'));
        }
        const pendingRequests = await User.find({
            role: "admin",
            adminApprovalStatus: "pending"
        }).select('-password').sort({ adminRequestDate: -1 });
        
        res.status(200).json(pendingRequests);
    } catch (error) {
        next(error);
    }
};

// Get all admin requests (pending, approved, rejected)
export const getAllAdminRequests = async (req, res, next) => {
    try {
        const currentUser = await User.findById(req.user.id);
        if (!currentUser || (currentUser.role !== 'rootadmin' && !currentUser.isDefaultAdmin)) {
            return next(errorHandler(403, 'Access denied. Only root admin or default admin can view admin requests.'));
        }

        const allRequests = await User.find({
            $or: [
                { role: "admin", adminApprovalStatus: "pending" },
                { role: "admin", adminApprovalStatus: "approved" },
                { role: "user", adminApprovalStatus: "rejected" } // Include rejected admins who are now users
            ]
        }).select('-password').sort({ adminRequestDate: -1 });
        
        res.status(200).json(allRequests);
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
        if (!(currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin)) {
            return next(errorHandler(403, "Only default admin or root admin can approve requests"));
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
        
        // Send approval email to the newly approved admin
        try {
            const adminDetails = {
                username: user.username,
                role: user.role,
                approvedBy: currentUser.username || currentUser.email,
                approvedAt: user.adminApprovalDate
            };
            
            await sendAdminApprovalEmail(user.email, adminDetails);
            console.log(`✅ Admin approval email sent to: ${user.email}`);
        } catch (emailError) {
            console.error(`❌ Failed to send admin approval email to ${user.email}:`, emailError);
            // Don't fail the approval if email fails, just log the error
        }
        
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
        if (!(currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin)) {
            return next(errorHandler(403, "Only default admin or root admin can reject requests"));
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
        user.role = "user"; // Change role to user when rejected
        
        await user.save();
        
        // Send rejection email to the rejected admin
        try {
            const adminDetails = {
                username: user.username,
                role: user.role,
                rejectedBy: currentUser.username || currentUser.email,
                rejectedAt: user.adminApprovalDate
            };
            
            await sendAdminRejectionEmail(user.email, adminDetails);
            console.log(`✅ Admin rejection email sent to: ${user.email}`);
        } catch (emailError) {
            console.error(`❌ Failed to send admin rejection email to ${user.email}:`, emailError);
            // Don't fail the rejection if email fails, just log the error
        }
        
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

// Re-approve rejected admin request
export const reapproveAdminRequest = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { currentUserId } = req.body;
        
        // Find the current user (should be an approved admin)
        const currentUser = await User.findById(currentUserId);
        if (!currentUser) {
            return next(errorHandler(404, "User not found"));
        }
        
        // Allow rootadmin or default admin to reapprove
        if (!(currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin)) {
            return next(errorHandler(403, "Only default admin or root admin can reapprove requests"));
        }
        
        // Find the user to reapprove
        const user = await User.findById(userId);
        if (!user) {
            return next(errorHandler(404, "User not found"));
        }
        
        if (user.role !== "user" || user.adminApprovalStatus !== "rejected") {
            return next(errorHandler(400, "Invalid reapproval request - user must be a rejected admin"));
        }
        
        user.role = "admin";
        user.adminApprovalStatus = "approved";
        user.adminApprovalDate = new Date();
        user.approvedBy = currentUserId;
        
        await user.save();
        
        // Send approval email to the reapproved admin
        try {
            const adminDetails = {
                username: user.username,
                role: user.role,
                approvedBy: currentUser.username || currentUser.email,
                approvedAt: user.adminApprovalDate
            };
            
            await sendAdminApprovalEmail(user.email, adminDetails);
            console.log(`✅ Admin reapproval email sent to: ${user.email}`);
        } catch (emailError) {
            console.error(`❌ Failed to send admin reapproval email to ${user.email}:`, emailError);
            // Don't fail the reapproval if email fails, just log the error
        }
        
        res.status(200).json({
            message: "Admin request reapproved successfully",
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

        // 1. Verify current user is default admin AND rootadmin
        const currentUser = await User.findById(currentUserId);
        if (!currentUser || !currentUser.isDefaultAdmin || currentUser.role !== 'rootadmin') {
            return res.status(403).json({ message: "Only the root default admin can transfer rights." });
        }

        // 2. Check password
        const isMatch = await bcryptjs.compare(password, currentUser.password);
        if (!isMatch) {
            return res.status(401).json({ error: "invalidPassword" });
        }

        // 3. Ensure target is a valid approved, active admin (not default admin/rootadmin)
        const targetAdmin = await User.findById(targetAdminId);
        if (!targetAdmin ||
            targetAdmin.role !== "admin" ||
            targetAdmin.isDefaultAdmin ||
            targetAdmin.adminApprovalStatus !== "approved" ||
            targetAdmin.status === 'suspended') {
            return res.status(400).json({ message: "Target must be an approved, active admin (not default admin/rootadmin)." });
        }

        // 4. Swap roles/flags
        currentUser.isDefaultAdmin = false;
        currentUser.role = 'admin';
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