import User from '../models/user.model.js';
import { errorHandler } from '../utils/error.js';

// Fetch all users (for admin/rootadmin)
export const getManagementUsers = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin')) {
      return next(errorHandler(403, 'Access denied'));
    }
    // Admins: only see users (not admins/rootadmin)
    // Rootadmin: see all users (not admins/rootadmin)
    const users = await User.find({ role: 'user' }).select('-password');
    res.status(200).json(users);
  } catch (err) {
    next(err);
  }
};

// Fetch all admins (for default admin only)
export const getManagementAdmins = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || !currentUser.isDefaultAdmin) {
      return next(errorHandler(403, 'Access denied. Only the current default admin can access admin management.'));
    }
    // Exclude the default admin himself
    const admins = await User.find({ role: 'admin', _id: { $ne: currentUser._id } }).select('-password');
    res.status(200).json(admins);
  } catch (err) {
    next(err);
  }
};

// Suspend/activate user or admin
export const suspendUserOrAdmin = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return next(errorHandler(403, 'Access denied'));
    if (type === 'user') {
      // Only admin/rootadmin can suspend users
      if (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin') {
        return next(errorHandler(403, 'Access denied'));
      }
      const user = await User.findById(id);
      if (!user || user.role !== 'user') return next(errorHandler(404, 'User not found'));
      user.status = user.status === 'active' ? 'suspended' : 'active';
      await user.save();
      return res.status(200).json({ message: 'User status updated', status: user.status });
    } else if (type === 'admin') {
      // Only the current default admin can suspend admins
      if (!currentUser.isDefaultAdmin) {
        return next(errorHandler(403, 'Access denied. Only the current default admin can suspend admins.'));
      }
      const admin = await User.findById(id);
      if (!admin || admin.role !== 'admin') return next(errorHandler(404, 'Admin not found'));
      admin.status = admin.status === 'active' ? 'suspended' : 'active';
      await admin.save();
      return res.status(200).json({ message: 'Admin status updated', status: admin.status });
    } else {
      return next(errorHandler(400, 'Invalid type'));
    }
  } catch (err) {
    next(err);
  }
};

// Delete user or admin
export const deleteUserOrAdmin = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return next(errorHandler(403, 'Access denied'));
    if (type === 'user') {
      // Only admin/rootadmin can delete users
      if (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin') {
        return next(errorHandler(403, 'Access denied'));
      }
      const user = await User.findById(id);
      if (!user || user.role !== 'user') return next(errorHandler(404, 'User not found'));
      await User.findByIdAndDelete(id);
      return res.status(200).json({ message: 'User deleted' });
    } else if (type === 'admin') {
      // Only rootadmin can delete admins
      if (currentUser.role !== 'rootadmin') {
        return next(errorHandler(403, 'Access denied'));
      }
      const admin = await User.findById(id);
      if (!admin || admin.role !== 'admin') return next(errorHandler(404, 'Admin not found'));
      await User.findByIdAndDelete(id);
      return res.status(200).json({ message: 'Admin deleted' });
    } else {
      return next(errorHandler(400, 'Invalid type'));
    }
  } catch (err) {
    next(err);
  }
};

// Demote admin to user (default admin only)
export const demoteAdminToUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || !currentUser.isDefaultAdmin) {
      return next(errorHandler(403, 'Access denied. Only the current default admin can demote admins.'));
    }
    const admin = await User.findById(id);
    if (!admin || admin.role !== 'admin') return next(errorHandler(404, 'Admin not found'));
    // Prevent demoting yourself
    if (admin._id.equals(currentUser._id)) {
      return next(errorHandler(400, 'You cannot demote yourself.'));
    }
    admin.role = 'user';
    admin.adminApprovalStatus = undefined;
    admin.adminApprovalDate = undefined;
    admin.approvedBy = undefined;
    admin.adminRequestDate = undefined;
    admin.isDefaultAdmin = false;
    await admin.save();
    return res.status(200).json({ message: 'Admin demoted to user successfully.' });
  } catch (err) {
    next(err);
  }
};

// Promote user to admin (default admin only)
export const promoteUserToAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || !currentUser.isDefaultAdmin) {
      return next(errorHandler(403, 'Access denied. Only the current default admin can promote users.'));
    }
    const user = await User.findById(id);
    if (!user || user.role !== 'user') return next(errorHandler(404, 'User not found'));
    user.role = 'admin';
    user.adminApprovalStatus = 'approved';
    user.adminApprovalDate = new Date();
    user.approvedBy = currentUser._id;
    await user.save();
    return res.status(200).json({ message: 'User promoted to admin successfully.' });
  } catch (err) {
    next(err);
  }
}; 