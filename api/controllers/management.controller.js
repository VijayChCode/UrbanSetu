import User from '../models/user.model.js';
import { errorHandler } from '../utils/error.js';
import DeletedAccount from '../models/deletedAccount.model.js';
import AuditLog from '../models/auditLog.model.js';
import AccountRevocation from '../models/accountRevocation.model.js';
import crypto from 'crypto';
import { sendAccountDeletionEmail, sendAccountSuspensionEmail, sendUserPromotionEmail, sendAdminDemotionEmail, sendManualSoftbanEmail, sendAccountActivationEmail, sendManualAccountRestorationEmail } from '../utils/emailService.js';
import { autoPurgeSoftbannedAccounts, getPurgeStatistics } from '../services/autoPurgeService.js';
import { sendAccountDeletionReminders, getReminderStatistics } from '../services/accountReminderService.js';
import { checkEmailServiceStatus, getEmailServiceMonitoringStats } from '../services/emailMonitoringService.js';
import { revokeAllUserSessionsFromDB } from '../utils/sessionManager.js';
import PasswordLockout from '../models/passwordLockout.model.js';

// Get global tab counts for admin management panel
export const getManagementTabCounts = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin')) {
      return next(errorHandler(403, 'Access denied'));
    }
    const isRoot = currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin;

    // Users count (exclude rejected admins - they should appear in admins tab)
    const usersCount = await User.countDocuments({
      $and: [
        { $or: [ { role: 'user' }, { role: { $exists: false } } ] },
        { adminApprovalStatus: { $ne: 'rejected' } }
      ]
    });

    // Admins count (include rejected admins who have adminApprovalStatus='rejected')
    const adminQuery = { _id: { $ne: currentUser._id } };
    if (isRoot) {
      adminQuery.$or = [
        { role: { $in: ['admin', 'rootadmin'] } },
        { role: 'user', adminApprovalStatus: 'rejected' }
      ];
    } else {
      adminQuery.$or = [
        { role: 'admin', isDefaultAdmin: { $ne: true } },
        { role: 'user', adminApprovalStatus: 'rejected' }
      ];
    }
    const adminsCount = await User.countDocuments(adminQuery);

    // Softbanned count (purgedAt is null/unset)
    const softbannedQuery = { purgedAt: null };
    if (!isRoot) softbannedQuery.role = 'user';
    const softbannedCount = await DeletedAccount.countDocuments(softbannedQuery);

    // Purged count (purgedAt is set)
    const purgedQuery = { purgedAt: { $ne: null } };
    if (!isRoot) purgedQuery.role = 'user';
    const purgedCount = await DeletedAccount.countDocuments(purgedQuery);

    res.status(200).json({
      success: true,
      users: usersCount,
      admins: adminsCount,
      softbanned: softbannedCount,
      purged: purgedCount
    });
  } catch (err) {
    next(err);
  }
};

// Fetch all users (for admin/rootadmin) with pagination and filters
export const getManagementUsers = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin')) {
      return next(errorHandler(403, 'Access denied'));
    }

    const { page = 1, limit = 12, q, status, promoSubscription } = req.query;
    // Exclude rejected admins from users list - they appear in admins tab
    const query = {
      $and: [
        { $or: [ { role: 'user' }, { role: { $exists: false } } ] },
        { adminApprovalStatus: { $ne: 'rejected' } }
      ]
    };

    if (q) {
      query.$and.push({
        $or: [
          { username: new RegExp(q, 'i') },
          { email: new RegExp(q, 'i') },
          { mobileNumber: new RegExp(q, 'i') }
        ]
      });
    }

    if (status && status !== 'all') {
      if (status === 'locked') {
        const activeLockouts = await PasswordLockout.find({ unlockAt: { $gt: new Date() } }).select('email');
        const lockedEmails = activeLockouts.map(l => (l.email || '').toLowerCase());
        query.$and.push({ email: { $in: lockedEmails } });
      } else {
        query.$and.push({ status: status });
      }
    }

    if (promoSubscription && promoSubscription !== 'all') {
      if (promoSubscription === 'subscribed') {
        query.$and.push({ isSubscribed: { $ne: false } });
      } else {
        query.$and.push({ isSubscribed: false });
      }
    }

    const skipVal = (Number(page) - 1) * Number(limit);
    const limitVal = Number(limit);

    const total = await User.countDocuments(query);

    // Use aggregation to fetch users with counts of their listings and appointments
    const items = await User.aggregate([
      { $match: query },
      { $sort: { createdAt: -1 } },
      { $skip: skipVal },
      { $limit: limitVal },
      // Lookup listings count
      {
        $lookup: {
          from: 'listings',
          localField: '_id',
          foreignField: 'userRef',
          as: 'listingsData'
        }
      },
      // Lookup appointments count (buyer or seller)
      {
        $lookup: {
          from: 'bookings',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$buyerId', '$$userId'] },
                    { $eq: ['$sellerId', '$$userId'] }
                  ]
                }
              }
            }
          ],
          as: 'bookingsData'
        }
      },
      // Lookup Wishlists
      {
        $lookup: {
          from: 'wishlists',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$userId', '$$userId'] } } }
          ],
          as: 'wishlistData'
        }
      },
      // Lookup Watchlists
      {
        $lookup: {
          from: 'propertywatchlists',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$userId', '$$userId'] } } }
          ],
          as: 'watchlistData'
        }
      },
      // Lookup Reviews
      {
        $lookup: {
          from: 'reviews',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$userId', '$$userId'] } } }
          ],
          as: 'reviewsData'
        }
      },
      // Lookup Payments
      {
        $lookup: {
          from: 'payments',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$userId', '$$userId'] } } }
          ],
          as: 'paymentsData'
        }
      },
      // Add counts and remove password
      {
        $addFields: {
          listingsCount: { $size: '$listingsData' },
          appointmentsCount: { $size: '$bookingsData' },
          wishlistCount: { $size: '$wishlistData' },
          watchlistCount: { $size: '$watchlistData' },
          reviewsCount: { $size: '$reviewsData' },
          paymentsCount: { $size: '$paymentsData' }
        }
      },
      {
        $project: {
          password: 0,
          listingsData: 0,
          bookingsData: 0,
          wishlistData: 0,
          watchlistData: 0,
          reviewsData: 0,
          paymentsData: 0
        }
      }
    ]);

    res.status(200).json({
      success: true,
      items,
      total,
      page: Number(page),
      limit: limitVal
    });
  } catch (err) {
    next(err);
  }
};

// Fetch all admins (for admin and rootadmin) with pagination and filters
export const getManagementAdmins = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin')) {
      return next(errorHandler(403, 'Access denied. Only admins can access admin management.'));
    }
    const { page = 1, limit = 12, q, status, promoSubscription, adminApproval } = req.query;

    // Include all admins regardless of approval status (pending, approved, rejected)
    // Regular admins: only see other admins (not rootadmin/default admin)
    // Rootadmin: see all admins (not rootadmin/default admin)
    const isRoot = currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin;
    const query = {
      _id: { $ne: currentUser._id }
    };
    // Include rejected admins (role='user', adminApprovalStatus='rejected') in the admins list
    if (isRoot) {
      query.$or = [
        { role: { $in: ['admin', 'rootadmin'] } },
        { role: 'user', adminApprovalStatus: 'rejected' }
      ];
    } else {
      query.$or = [
        { role: 'admin', isDefaultAdmin: { $ne: true } },
        { role: 'user', adminApprovalStatus: 'rejected' }
      ];
    }

    if (q) {
      query.$and = [
        {
          $or: [
            { username: new RegExp(q, 'i') },
            { email: new RegExp(q, 'i') },
            { mobileNumber: new RegExp(q, 'i') }
          ]
        }
      ];
    }

    if (status && status !== 'all') {
      if (status === 'locked') {
        const activeLockouts = await PasswordLockout.find({ unlockAt: { $gt: new Date() } }).select('email');
        const lockedEmails = activeLockouts.map(l => (l.email || '').toLowerCase());
        query.email = { $in: lockedEmails };
      } else {
        query.status = status;
      }
    }

    if (promoSubscription && promoSubscription !== 'all') {
      if (promoSubscription === 'subscribed') {
        query.isSubscribed = { $ne: false };
      } else {
        query.isSubscribed = false;
      }
    }

    if (adminApproval && adminApproval !== 'all') {
      query.adminApprovalStatus = adminApproval;
    }

    const skipVal = (Number(page) - 1) * Number(limit);
    const limitVal = Number(limit);

    const total = await User.countDocuments(query);

    // Use aggregation to fetch admins with counts
    const items = await User.aggregate([
      { $match: query },
      { $sort: { createdAt: -1 } },
      { $skip: skipVal },
      { $limit: limitVal },
      // Lookup listings count
      {
        $lookup: {
          from: 'listings',
          localField: '_id',
          foreignField: 'userRef',
          as: 'listingsData'
        }
      },
      // Lookup appointments count (buyer or seller)
      {
        $lookup: {
          from: 'bookings',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$buyerId', '$$userId'] },
                    { $eq: ['$sellerId', '$$userId'] }
                  ]
                }
              }
            }
          ],
          as: 'bookingsData'
        }
      },
      // Lookup Wishlists
      {
        $lookup: {
          from: 'wishlists',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$userId', '$$userId'] } } }
          ],
          as: 'wishlistData'
        }
      },
      // Lookup Watchlists
      {
        $lookup: {
          from: 'propertywatchlists',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$userId', '$$userId'] } } }
          ],
          as: 'watchlistData'
        }
      },
      // Lookup Reviews
      {
        $lookup: {
          from: 'reviews',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$userId', '$$userId'] } } }
          ],
          as: 'reviewsData'
        }
      },
      // Lookup Payments
      {
        $lookup: {
          from: 'payments',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$userId', '$$userId'] } } }
          ],
          as: 'paymentsData'
        }
      },
      // Add counts and remove password
      {
        $addFields: {
          listingsCount: { $size: '$listingsData' },
          appointmentsCount: { $size: '$bookingsData' },
          wishlistCount: { $size: '$wishlistData' },
          watchlistCount: { $size: '$watchlistData' },
          reviewsCount: { $size: '$reviewsData' },
          paymentsCount: { $size: '$paymentsData' }
        }
      },
      {
        $project: {
          password: 0,
          listingsData: 0,
          bookingsData: 0,
          wishlistData: 0,
          watchlistData: 0,
          reviewsData: 0,
          paymentsData: 0
        }
      }
    ]);

    res.status(200).json({
      success: true,
      items,
      total,
      page: Number(page),
      limit: limitVal
    });
  } catch (err) {
    next(err);
  }
};

// Suspend/activate user or admin
export const suspendUserOrAdmin = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const { reason } = req.body; // Get suspension reason from request body
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return next(errorHandler(403, 'Access denied'));

    // Prevent any action on rootadmin via this endpoint
    const targetCheck = await User.findById(id);
    if (targetCheck?.role === 'rootadmin') {
      return next(errorHandler(403, 'Root admin cannot be suspended or modified via this endpoint.'));
    }

    if (type === 'user') {
      // Only admin/rootadmin can suspend users
      if (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin') {
        return next(errorHandler(403, 'Access denied'));
      }
      const user = await User.findById(id);
      if (!user || user.role !== 'user') return next(errorHandler(404, 'User not found'));
      const togglingToSuspended = user.status === 'active';
      user.status = togglingToSuspended ? 'suspended' : 'active';
      if (togglingToSuspended) {
        user.suspendedAt = new Date();
        user.suspendedBy = currentUser._id;
        user.suspensionReason = reason || 'Policy violation'; // Store suspension reason
      } else {
        user.suspendedAt = null;
        user.suspendedBy = null;
        user.suspensionReason = null;
      }
      await user.save();

      // Revoke all active sessions upon suspension
      if (togglingToSuspended) {
        await revokeAllUserSessionsFromDB(user._id, req.app.get('io'));
        console.log(`🚫 Revoked all sessions for suspended user: ${user.email}`);
      }

      // Send suspension/reactivation email
      try {
        const suspensionDetails = {
          username: user.username,
          role: user.role,
          reason: togglingToSuspended ? (user.suspensionReason || 'Policy violation') : 'Account reactivated',
          suspendedBy: currentUser.username || currentUser.email,
          suspendedAt: user.suspendedAt || new Date(),
          isSuspension: togglingToSuspended
        };

        await sendAccountSuspensionEmail(user.email, suspensionDetails);
        console.log(`✅ ${togglingToSuspended ? 'Suspension' : 'Reactivation'} email sent to: ${user.email}`);
        console.log(`📧 Email details:`, suspensionDetails);
      } catch (emailError) {
        console.error(`❌ Failed to send ${togglingToSuspended ? 'suspension' : 'reactivation'} email to ${user.email}:`, emailError);
        // Don't fail the suspension if email fails, just log the error
      }

      // Emit socket event for account suspension
      const io = req.app.get('io');
      if (io) {
        io.emit('account_suspended', {
          userId: user._id.toString(),
          username: user.username,
          email: user.email,
          status: user.status,
          type: 'user'
        });
      }

      return res.status(200).json({ message: 'User status updated', status: user.status });
    } else if (type === 'admin') {
      // Only the default admin or root admin can suspend admins
      const isRootOrDefault = currentUser.isDefaultAdmin || currentUser.role === 'rootadmin';
      if (!isRootOrDefault) {
        return next(errorHandler(403, 'Access denied. Only default admin or root admin can suspend admins.'));
      }
      const admin = await User.findById(id);
      if (!admin || admin.role !== 'admin') return next(errorHandler(404, 'Admin not found'));
      const togglingAdminToSuspended = admin.status === 'active';
      admin.status = togglingAdminToSuspended ? 'suspended' : 'active';
      if (togglingAdminToSuspended) {
        admin.suspendedAt = new Date();
        admin.suspendedBy = currentUser._id;
        admin.suspensionReason = reason || 'Policy violation'; // Store suspension reason
      } else {
        admin.suspendedAt = null;
        admin.suspendedBy = null;
        admin.suspensionReason = null;
      }
      await admin.save();

      // Revoke all active sessions upon suspension
      if (togglingAdminToSuspended) {
        await revokeAllUserSessionsFromDB(admin._id, req.app.get('io'));
        console.log(`🚫 Revoked all sessions for suspended admin: ${admin.email}`);
      }

      // Send suspension/reactivation email
      try {
        const suspensionDetails = {
          username: admin.username,
          role: admin.role,
          reason: togglingAdminToSuspended ? (admin.suspensionReason || 'Policy violation') : 'Account reactivated',
          suspendedBy: currentUser.username || currentUser.email,
          suspendedAt: admin.suspendedAt || new Date(),
          isSuspension: togglingAdminToSuspended
        };

        await sendAccountSuspensionEmail(admin.email, suspensionDetails);
        console.log(`✅ ${togglingAdminToSuspended ? 'Suspension' : 'Reactivation'} email sent to: ${admin.email}`);
        console.log(`📧 Email details:`, suspensionDetails);
      } catch (emailError) {
        console.error(`❌ Failed to send ${togglingAdminToSuspended ? 'suspension' : 'reactivation'} email to ${admin.email}:`, emailError);
        // Don't fail the suspension if email fails, just log the error
      }

      // Emit socket event for account suspension
      const io = req.app.get('io');
      if (io) {
        io.emit('account_suspended', {
          userId: admin._id.toString(),
          username: admin.username,
          email: admin.email,
          status: admin.status,
          type: 'admin'
        });
      }

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

    // Prevent any action on rootadmin via this endpoint
    const targetCheck = await User.findById(id);
    if (targetCheck?.role === 'rootadmin') {
      return next(errorHandler(403, 'Root admin cannot be softbanned via this endpoint.'));
    }

    const isRoot = currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin;
    if (type === 'user') {
      if (currentUser.role !== 'admin' && !isRoot) {
        return next(errorHandler(403, 'Access denied'));
      }
      const user = await User.findById(id);
      if (!user || user.role !== 'user') return next(errorHandler(404, 'User not found'));
      const delRecUser = await DeletedAccount.create({
        accountId: user._id,
        name: user.username,
        email: user.email,
        role: 'user',
        deletedAt: new Date(),
        deletedBy: currentUser._id,
        reason: req.body?.reason || '',
        policy: req.body?.policy,
        // Capture original user data to allow exact restoration without losing password/profile
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

      // Send manual softban email (no restoration link needed for admin softbans)
      try {
        await sendManualSoftbanEmail(user.email, {
          username: user.username,
          role: user.role,
          reason: req.body?.reason || 'Policy violation',
          softbannedBy: 'Administrator', // Use generic title instead of actual admin details
          softbannedAt: new Date(),
          revocationLink: null // No restoration link for admin softbans
        });
        console.log(`✅ Manual softban email sent to: ${user.email}`);
      } catch (emailError) {
        console.error(`❌ Failed to send softban email to ${user.email}:`, emailError);
        // Don't fail the deletion if email fails
      }

      await User.findByIdAndDelete(id);
      await AuditLog.create({ action: 'soft_delete', performedBy: currentUser._id, targetAccount: delRecUser._id, targetEmail: delRecUser.email, details: { type: 'admin_delete', role: 'user' } });
      return res.status(200).json({ message: 'User moved to DeletedAccounts' });
    } else if (type === 'admin') {
      if (!isRoot) {
        return next(errorHandler(403, 'Access denied'));
      }
      const admin = await User.findById(id);
      if (!admin || admin.role !== 'admin') return next(errorHandler(404, 'Admin not found'));
      const delRecAdmin = await DeletedAccount.create({
        accountId: admin._id,
        name: admin.username,
        email: admin.email,
        role: 'admin',
        deletedAt: new Date(),
        deletedBy: currentUser._id,
        reason: req.body?.reason || '',
        policy: req.body?.policy,
        originalData: {
          username: admin.username,
          email: admin.email,
          password: admin.password,
          mobileNumber: admin.mobileNumber,
          address: admin.address,
          gender: admin.gender,
          avatar: admin.avatar,
          role: admin.role,
          isDefaultAdmin: admin.isDefaultAdmin,
          adminApprovalStatus: admin.adminApprovalStatus,
          adminApprovalDate: admin.adminApprovalDate,
          approvedBy: admin.approvedBy,
          adminRequestDate: admin.adminRequestDate,
          status: admin.status,
        }
      });

      // Send manual softban email for admin (no restoration link needed for admin softbans)
      try {
        await sendManualSoftbanEmail(admin.email, {
          username: admin.username,
          role: admin.role,
          reason: req.body?.reason || 'Policy violation',
          softbannedBy: 'Administrator', // Use generic title instead of actual admin details
          softbannedAt: new Date(),
          revocationLink: null // No restoration link for admin softbans
        });
        console.log(`✅ Manual softban email sent to admin: ${admin.email}`);
      } catch (emailError) {
        console.error(`❌ Failed to send softban email to admin ${admin.email}:`, emailError);
        // Don't fail the deletion if email fails
      }

      await User.findByIdAndDelete(id);
      await AuditLog.create({ action: 'soft_delete', performedBy: currentUser._id, targetAccount: delRecAdmin._id, targetEmail: delRecAdmin.email, details: { type: 'admin_delete', role: 'admin' } });
      return res.status(200).json({ message: 'Admin moved to DeletedAccounts' });
    } else {
      return next(errorHandler(400, 'Invalid type'));
    }
  } catch (err) {
    next(err);
  }
};

// Deleted accounts APIs
export const getDeletedAccounts = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin')) {
      return next(errorHandler(403, 'Access denied'));
    }
    const isRoot = currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin;
    const { role, q, from, to, deletedBy, purgedBy, isPurged, page = 1, limit = 12 } = req.query;
    const filter = {};
    if (!isRoot) filter.role = 'user';
    if (role && (role === 'user' || role === 'admin')) filter.role = role;
    if (q) filter.$or = [
      { name: new RegExp(q, 'i') },
      { email: new RegExp(q, 'i') }
    ];
    if (from || to) {
      // For purged accounts, filter by purgedAt, otherwise by deletedAt
      const dateField = (isPurged === 'true' || purgedBy) ? 'purgedAt' : 'deletedAt';
      filter[dateField] = {};
      if (from) filter[dateField].$gte = new Date(from);
      if (to) filter[dateField].$lte = new Date(to);
    }
    if (deletedBy) filter.deletedBy = deletedBy === 'self' ? 'self' : deletedBy;
    if (purgedBy) filter.purgedBy = purgedBy;

    // Separate purged from softbanned
    if (isPurged === 'true') {
      filter.purgedAt = { $ne: null };
    } else if (isPurged === 'false') {
      filter.purgedAt = null;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      DeletedAccount.find(filter).sort({ deletedAt: -1 }).skip(skip).limit(Number(limit)),
      DeletedAccount.countDocuments(filter)
    ]);
    res.json({ success: true, items, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

export const restoreDeletedAccount = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const isRoot = currentUser && (currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin);
    if (!isRoot) return next(errorHandler(403, 'Access denied'));
    const { id } = req.params; // DeletedAccount id
    const record = await DeletedAccount.findById(id);
    if (!record) return next(errorHandler(404, 'Deleted account not found'));
    // Recreate user/admin
    const exists = await User.findOne({ email: record.email });
    if (exists) return next(errorHandler(400, 'An active account with this email already exists'));
    const original = (record.originalData || {});
    const bcrypt = (await import('bcryptjs')).default;
    // Ensure required fields
    const username = original.username || record.name || 'Restored User';
    const mobileNumber = original.mobileNumber && String(original.mobileNumber).match(/^\d{10}$/) ? String(original.mobileNumber) : String(Math.floor(1000000000 + Math.random() * 9000000000));

    // CRITICAL FIX: Preserve the original user ID to maintain relationships
    const restored = new User({
      _id: record.accountId, // Use the original accountId to preserve all relationships
      username,
      email: record.email,
      // Use original hashed password if captured, else generate a random one
      password: original.password || bcrypt.hashSync(Math.random().toString(36).slice(-10), 10),
      role: record.role,
      adminApprovalStatus: original.adminApprovalStatus !== undefined ? original.adminApprovalStatus : (record.role === 'admin' ? 'approved' : undefined),
      status: 'active',
      mobileNumber,
      isGeneratedMobile: !original.mobileNumber,
      address: original.address || '',
      gender: original.gender || undefined,
      avatar: original.avatar || undefined,
      isDefaultAdmin: original.isDefaultAdmin || false,
      approvedBy: original.approvedBy || undefined,
      adminApprovalDate: original.adminApprovalDate || undefined,
      adminRequestDate: original.adminRequestDate || undefined
    });
    await restored.save();
    await AuditLog.create({ action: 'restore', performedBy: currentUser._id, targetAccount: record._id, targetEmail: record.email });

    // Invalidate any active revocation tokens for this account
    try {
      const AccountRevocation = (await import('../models/accountRevocation.model.js')).default;
      await AccountRevocation.updateMany(
        {
          accountId: record.accountId,
          isUsed: false
        },
        {
          $set: {
            isUsed: true,
            usedAt: new Date(),
            restoredAt: new Date(),
            restoredBy: 'admin_manual'
          }
        }
      );
      console.log(`✅ Invalidated revocation tokens for account: ${record.email}`);
    } catch (tokenError) {
      console.error(`❌ Failed to invalidate revocation tokens for ${record.email}:`, tokenError);
      // Don't fail the restoration if token invalidation fails
    }

    // Send manual account restoration email
    try {
      await sendManualAccountRestorationEmail(record.email, {
        username: restored.username,
        role: restored.role,
        restoredBy: 'Administrator', // Use generic title instead of actual admin details
        restoredAt: new Date()
      });
      console.log(`✅ Manual account restoration email sent to: ${record.email}`);
    } catch (emailError) {
      console.error(`❌ Failed to send restoration email to ${record.email}:`, emailError);
      // Don't fail the restoration if email fails
    }

    await DeletedAccount.findByIdAndDelete(id);
    res.json({ success: true, message: 'Account restored', userId: restored._id });
  } catch (err) {
    next(err);
  }
};

export const purgeDeletedAccount = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const isRoot = currentUser && (currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin);
    if (!isRoot) return next(errorHandler(403, 'Access denied'));
    const { id } = req.params;
    const record = await DeletedAccount.findById(id);
    if (!record) return next(errorHandler(404, 'Deleted account not found'));
    // Update record to preserve purge metadata and policy in case of audit export
    record.purgedAt = new Date();
    record.purgedBy = currentUser._id;
    await record.save();
    // Don't delete the record - keep it for purged accounts display
    await AuditLog.create({ action: 'purge', performedBy: currentUser._id, targetAccount: record._id, targetEmail: record.email });
    res.json({ success: true, message: 'Deleted account purged' });
  } catch (err) {
    next(err);
  }
};

// Demote admin to user (default admin only)
export const demoteAdminToUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body; // Get demotion reason from request body
    const currentUser = await User.findById(req.user.id);
    const isRootOrDefault = currentUser && (currentUser.isDefaultAdmin || currentUser.role === 'rootadmin');
    if (!isRootOrDefault) {
      return next(errorHandler(403, 'Access denied. Only default admin or root admin can demote admins.'));
    }
    const admin = await User.findById(id);
    if (!admin || admin.role !== 'admin') return next(errorHandler(404, 'Admin not found'));
    // Prevent demoting yourself
    if (admin._id.equals(currentUser._id)) {
      return next(errorHandler(400, 'You cannot demote yourself.'));
    }

    const demotedAt = new Date();
    admin.role = 'user';
    admin.adminApprovalStatus = undefined;
    admin.adminApprovalDate = undefined;
    admin.approvedBy = undefined;
    admin.adminRequestDate = undefined;
    admin.isDefaultAdmin = false;
    await admin.save();

    // Send demotion email
    try {
      const demotionDetails = {
        username: admin.username,
        demotedBy: currentUser.username || currentUser.email,
        demotedAt: demotedAt,
        reason: reason || 'Administrative decision'
      };

      await sendAdminDemotionEmail(admin.email, demotionDetails);
      console.log(`✅ Admin demotion email sent to: ${admin.email}`);
      console.log(`📧 Demotion details:`, demotionDetails);
    } catch (emailError) {
      console.error(`❌ Failed to send demotion email to ${admin.email}:`, emailError);
      // Don't fail the demotion if email fails, just log the error
    }

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
    const isRootOrDefault = currentUser && (currentUser.isDefaultAdmin || currentUser.role === 'rootadmin');
    if (!isRootOrDefault) {
      return next(errorHandler(403, 'Access denied. Only default admin or root admin can promote users.'));
    }
    const user = await User.findById(id);
    if (!user || user.role !== 'user') return next(errorHandler(404, 'User not found'));
    user.role = 'admin';
    user.adminApprovalStatus = 'approved';
    user.adminApprovalDate = new Date();
    user.approvedBy = currentUser._id;
    await user.save();

    // Send promotion email
    try {
      const promotionDetails = {
        username: user.username,
        promotedBy: currentUser.username || currentUser.email,
        promotedAt: user.adminApprovalDate
      };

      await sendUserPromotionEmail(user.email, promotionDetails);
      console.log(`✅ User promotion email sent to: ${user.email}`);
    } catch (emailError) {
      console.error(`❌ Failed to send promotion email to ${user.email}:`, emailError);
      // Don't fail the promotion if email fails, just log the error
    }

    return res.status(200).json({ message: 'User promoted to admin successfully.' });
  } catch (err) {
    next(err);
  }
};

// Re-approve a rejected admin (default admin only)
export const reapproveRejectedAdmin = async (req, res, next) => {
  try {
    const { adminId } = req.params;
    const currentUser = await User.findById(req.user.id);
    const isRootOrDefault = currentUser && (currentUser.isDefaultAdmin || currentUser.role === 'rootadmin');
    if (!isRootOrDefault) {
      return next(errorHandler(403, 'Access denied. Only default admin or root admin can re-approve admins.'));
    }
    const admin = await User.findById(adminId);
    if (!admin || (admin.role !== 'admin' && (admin.role !== 'user' || admin.adminApprovalStatus !== 'rejected'))) {
      return next(errorHandler(404, 'Admin not found'));
    }
    admin.role = 'admin';
    admin.adminApprovalStatus = 'approved';
    admin.status = 'active';
    admin.adminApprovalDate = new Date();
    admin.approvedBy = currentUser._id;
    await admin.save();
    res.status(200).json(admin);
  } catch (err) {
    next(err);
  }
};

// Manually trigger automatic purging of softbanned accounts (rootadmin only)
export const triggerAutoPurge = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const isRoot = currentUser && (currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin);
    if (!isRoot) return next(errorHandler(403, 'Access denied. Only root admin can trigger auto purge.'));

    console.log('🔄 Manual auto-purge triggered by admin:', currentUser.email);
    const result = await autoPurgeSoftbannedAccounts();

    res.status(200).json({
      success: true,
      message: 'Auto-purge completed successfully',
      result
    });
  } catch (err) {
    console.error('Error in manual auto-purge:', err);
    next(err);
  }
};

// Get purge statistics (rootadmin only)
export const getPurgeStats = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const isRoot = currentUser && (currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin);
    if (!isRoot) return next(errorHandler(403, 'Access denied. Only root admin can view purge statistics.'));

    const stats = await getPurgeStatistics();
    res.status(200).json(stats);
  } catch (err) {
    console.error('Error getting purge statistics:', err);
    next(err);
  }
};

// Manually trigger account deletion reminders (rootadmin only)
export const triggerAccountReminders = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const isRoot = currentUser && (currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin);
    if (!isRoot) return next(errorHandler(403, 'Access denied. Only root admin can trigger account reminders.'));

    console.log('📧 Manual account reminders triggered by admin:', currentUser.email);
    const result = await sendAccountDeletionReminders();

    res.status(200).json({
      success: true,
      message: 'Account reminder process completed successfully',
      result
    });
  } catch (err) {
    console.error('Error in manual account reminders:', err);
    next(err);
  }
};

// Get reminder statistics (rootadmin only)
export const getReminderStats = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const isRoot = currentUser && (currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin);
    if (!isRoot) return next(errorHandler(403, 'Access denied. Only root admin can view reminder statistics.'));

    const stats = await getReminderStatistics();
    res.status(200).json(stats);
  } catch (err) {
    console.error('Error getting reminder statistics:', err);
    next(err);
  }
};

// Manually trigger email service monitoring check (rootadmin only)
export const triggerEmailMonitoring = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const isRoot = currentUser && (currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin);
    if (!isRoot) return next(errorHandler(403, 'Access denied. Only root admin can trigger email monitoring.'));

    console.log('🔍 Manual email monitoring triggered by admin:', currentUser.email);
    const result = await checkEmailServiceStatus(req.app);

    res.status(200).json({
      success: true,
      message: 'Email service monitoring check completed successfully',
      result
    });
  } catch (err) {
    console.error('Error in manual email monitoring:', err);
    next(err);
  }
};

// Get email service monitoring statistics (rootadmin only)
export const getEmailMonitoringStats = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const isRoot = currentUser && (currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin);
    if (!isRoot) return next(errorHandler(403, 'Access denied. Only root admin can view email monitoring statistics.'));

    const stats = await getEmailServiceMonitoringStats();
    res.status(200).json(stats);
  } catch (err) {
    console.error('Error getting email monitoring statistics:', err);
    next(err);
  }
}; 