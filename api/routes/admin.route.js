import express from 'express';
import { verifyToken } from '../utils/verify.js';
import { 
    getPendingAdminRequests, 
    approveAdminRequest, 
    rejectAdminRequest,
    transferRootAdminRights
} from '../controllers/admin.controller.js';
import User from '../models/user.model.js';
import { getManagementUsers, getManagementAdmins, suspendUserOrAdmin, deleteUserOrAdmin, demoteAdminToUser, promoteUserToAdmin, reapproveRejectedAdmin } from '../controllers/management.controller.js';

const router = express.Router();

// Middleware to check if user is an approved admin
const requireApprovedAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        console.log('=== requireApprovedAdmin Middleware Debug ===');
        console.log('User object:', user);
        console.log('User email:', user?.email);
        console.log('User role:', user?.role);
        console.log('Admin approval status:', user?.adminApprovalStatus);
        console.log('Is approved admin:', (user?.role === 'admin' && user?.adminApprovalStatus === 'approved') || user?.role === 'rootadmin' || user?.isDefaultAdmin);
        console.log('=============================================');

        if ((user?.role === 'admin' && user?.adminApprovalStatus === 'approved') || user?.role === 'rootadmin' || user?.isDefaultAdmin) {
            console.log('Access granted to approved admin or rootadmin/default admin');
            return next();
        }

        console.log('Access denied - not an approved admin');
        return res.status(403).json({ message: 'Access denied. Only approved admins can access admin approval functionality.' });
    } catch (error) {
        console.error('Middleware error:', error);
        next(error);
    }
};

// Get pending admin requests (approved admins only)
router.get('/pending-requests', verifyToken, requireApprovedAdmin, getPendingAdminRequests);

// Approve admin request (approved admins only)
router.put('/approve/:userId', verifyToken, requireApprovedAdmin, approveAdminRequest);

// Reject admin request (approved admins only)
router.put('/reject/:userId', verifyToken, requireApprovedAdmin, rejectAdminRequest);

// Transfer Root Admin Rights (rootadmin only)
router.post('/transfer-rights', verifyToken, transferRootAdminRights);

// Management Endpoints
router.get('/management/users', verifyToken, getManagementUsers);
router.get('/management/admins', verifyToken, getManagementAdmins);
router.patch('/management/suspend/:type/:id', verifyToken, suspendUserOrAdmin);
router.delete('/management/delete/:type/:id', verifyToken, deleteUserOrAdmin);
router.patch('/management/demote/:id', verifyToken, demoteAdminToUser);
router.patch('/management/promote/:id', verifyToken, promoteUserToAdmin);
router.patch('/management/reapprove/:adminId', verifyToken, reapproveRejectedAdmin);

// Verify admin password for management access
router.post('/management/verify-password', verifyToken, async (req, res, next) => {
    try {
        const { password } = req.body;
        const user = await User.findById(req.user.id);
        if (!user || (user.role !== 'admin' && user.role !== 'rootadmin')) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const bcryptjs = (await import('bcryptjs')).default;
        const isMatch = await bcryptjs.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid password' });
        }
        return res.status(200).json({ message: 'Password verified' });
    } catch (err) {
        next(err);
    }
});

export default router; 