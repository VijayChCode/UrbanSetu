import crypto from 'crypto';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import AccountRevocation from '../models/accountRevocation.model.js';
import DeletedAccount from '../models/deletedAccount.model.js';
import User from '../models/user.model.js';
import DataExport from '../models/dataExport.model.js';
import { sendAccountDeletionEmail, sendAccountActivationEmail, sendDataExportEmail } from '../utils/emailService.js';
import { errorHandler } from '../utils/error.js';
import { gatherExportData } from "../utils/dataExportHelper.js";

export const exportDeletedData = async (req, res, next) => {
  try {
    const { email, conflictToken, selectedModules } = req.body;

    if (!email || !conflictToken) {
      return next(errorHandler(400, "Email and conflict token are required"));
    }

    // Verify conflict token
    let decoded;
    try {
      decoded = jwt.verify(conflictToken, process.env.JWT_TOKEN);
    } catch (err) {
      return next(errorHandler(401, "Invalid or expired conflict token"));
    }

    if (decoded.email !== email || decoded.purpose !== 'conflict_resolution') {
      return next(errorHandler(401, "Unauthorized token for this email"));
    }

    const activeRevocation = await AccountRevocation.findOne({
      email,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!activeRevocation) {
      return next(errorHandler(404, "No active deleted account found for this email"));
    }

    // Use the originalData to reconstruct a temporary user object for the helper
    const tempUser = {
      _id: activeRevocation.accountId,
      ...activeRevocation.originalData
    };

    const userData = await gatherExportData(tempUser, selectedModules || []);

    // Convert to JSON string
    const dataStr = JSON.stringify(userData, null, 2);

    // Create data export entry
    const exportToken = crypto.randomBytes(32).toString('hex');
    await DataExport.create({
      userId: activeRevocation.accountId,
      token: exportToken,
      data: dataStr,
      username: activeRevocation.username,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    const downloadLink = `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/api/user/download-export/${exportToken}`;
    await sendDataExportEmail(email, activeRevocation.username, downloadLink);

    res.status(200).json({ success: true, message: "Export email sent successfully" });
  } catch (error) {
    next(error);
  }
};

// Create revocation token for deleted account
export const createRevocationToken = async (req, res, next) => {
  try {
    const { accountId, email, username, role, originalData, reason } = req.body;

    // Generate secure random token
    const revocationToken = crypto.randomBytes(32).toString('hex');
    
    // Set expiration date (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Create revocation record
    const revocationRecord = await AccountRevocation.create({
      accountId,
      email,
      username,
      role,
      revocationToken,
      expiresAt,
      originalData,
      reason
    });

    // Generate revocation link
    const revocationLink = `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/restore-account/${revocationToken}`;

    res.status(201).json({
      success: true,
      message: 'Revocation token created successfully',
      revocationLink,
      expiresAt
    });
  } catch (error) {
    console.error('Error creating revocation token:', error);
    next(errorHandler(500, 'Failed to create revocation token'));
  }
};

// Verify revocation token
export const verifyRevocationToken = async (req, res, next) => {
  try {
    const { token } = req.params;

    const revocationRecord = await AccountRevocation.findOne({
      revocationToken: token,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!revocationRecord) {
      return next(errorHandler(404, 'Invalid or expired token'));
    }

    // Check if the SPECIFIC account has been purged (permanently deleted)
    // This allows restoration when there are multiple accounts with same email
    const deletedAccount = await DeletedAccount.findOne({
      accountId: revocationRecord.accountId,  // Check specific account ID, not just email
      purgedAt: { $exists: true, $ne: null }
    });

    if (deletedAccount) {
      return res.status(410).json({
        success: false,
        message: 'Account permanently deleted',
        error: 'PURGED_ACCOUNT',
        details: {
          username: revocationRecord.username,
          email: revocationRecord.email,
          purgedAt: deletedAccount.purgedAt,
          message: 'This account has been permanently deleted and cannot be restored. You can create a new account if you wish to continue using our services.'
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Token is valid',
      accountData: {
        username: revocationRecord.username,
        email: revocationRecord.email,
        role: revocationRecord.role,
        deletedAt: revocationRecord.deletedAt,
        expiresAt: revocationRecord.expiresAt
      }
    });
  } catch (error) {
    console.error('Error verifying revocation token:', error);
    next(errorHandler(500, 'Failed to verify token'));
  }
};

// Restore account from revocation
export const restoreAccount = async (req, res, next) => {
  try {
    const { token } = req.body;

    const revocationRecord = await AccountRevocation.findOne({
      revocationToken: token,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!revocationRecord) {
      return next(errorHandler(404, 'Invalid or expired token'));
    }

    // Check if the SPECIFIC account has been purged (permanently deleted)
    // This allows restoration when there are multiple accounts with same email
    const deletedAccount = await DeletedAccount.findOne({
      accountId: revocationRecord.accountId,  // Check specific account ID, not just email
      purgedAt: { $exists: true, $ne: null }
    });

    if (deletedAccount) {
      return res.status(410).json({
        success: false,
        message: 'Account permanently deleted',
        error: 'PURGED_ACCOUNT',
        details: {
          username: revocationRecord.username,
          email: revocationRecord.email,
          purgedAt: deletedAccount.purgedAt,
          message: 'This account has been permanently deleted and cannot be restored. You can create a new account if you wish to continue using our services.'
        }
      });
    }

    // Check if account already exists
    const existingUser = await User.findOne({ email: revocationRecord.email });
    if (existingUser) {
      return next(errorHandler(400, 'Account with this email already exists'));
    }

    // Restore user from original data - CRITICAL: Preserve original user ID to maintain relationships
    const restoredUser = new User({
      _id: revocationRecord.accountId, // 🔑 KEY: Use original accountId to preserve all relationships
      ...revocationRecord.originalData
    });
    await restoredUser.save();

    // Mark revocation token as used
    revocationRecord.isUsed = true;
    revocationRecord.usedAt = new Date();
    revocationRecord.restoredAt = new Date();
    revocationRecord.restoredBy = 'user_link';
    await revocationRecord.save();

    // Remove the SPECIFIC deleted account record (not all accounts with same email)
    await DeletedAccount.findOneAndDelete({ accountId: revocationRecord.accountId });

    // Send activation email
    try {
      await sendAccountActivationEmail(revocationRecord.email, {
        username: revocationRecord.username,
        role: revocationRecord.role
      });
      console.log(`✅ Account activation email sent to: ${revocationRecord.email}`);
    } catch (emailError) {
      console.error(`❌ Failed to send activation email to ${revocationRecord.email}:`, emailError);
      // Don't fail the restoration if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Account restored successfully',
      user: {
        id: restoredUser._id,
        username: restoredUser.username,
        email: restoredUser.email,
        role: restoredUser.role
      }
    });
  } catch (error) {
    console.error('Error restoring account:', error);
    next(errorHandler(500, 'Failed to restore account'));
  }
};

// Get revocation status for admin
export const getRevocationStatus = async (req, res, next) => {
  try {
    const { email } = req.params;

    const revocationRecord = await AccountRevocation.findOne({ email }).sort({ createdAt: -1 });

    if (!revocationRecord) {
      return res.status(200).json({
        success: true,
        hasRevocation: false,
        message: 'No revocation record found'
      });
    }

    res.status(200).json({
      success: true,
      hasRevocation: true,
      revocationData: {
        username: revocationRecord.username,
        email: revocationRecord.email,
        role: revocationRecord.role,
        deletedAt: revocationRecord.deletedAt,
        expiresAt: revocationRecord.expiresAt,
        isUsed: revocationRecord.isUsed,
        usedAt: revocationRecord.usedAt,
        restoredAt: revocationRecord.restoredAt
      }
    });
  } catch (error) {
    console.error('Error getting revocation status:', error);
    next(errorHandler(500, 'Failed to get revocation status'));
  }
};

// Restore account during signup flow (by email, not token)
// Updates the restored account's password so the user can sign in with the new one they entered
export const restoreForSignup = async (req, res, next) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return next(errorHandler(400, 'Email and password are required'));
    }

    const emailLower = email.toLowerCase();

    // Find active revocation token by email
    const revocationRecord = await AccountRevocation.findOne({
      email: emailLower,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!revocationRecord) {
      return next(errorHandler(404, 'No restorable account found for this email'));
    }

    // Check if the account has been purged
    const deletedAccount = await DeletedAccount.findOne({
      accountId: revocationRecord.accountId,
      purgedAt: { $exists: true, $ne: null }
    });

    if (deletedAccount) {
      return res.status(410).json({
        success: false,
        message: 'Account has been permanently deleted and cannot be restored.'
      });
    }

    // Check if an account with this email already exists
    const existingUser = await User.findOne({ email: emailLower });
    if (existingUser) {
      return next(errorHandler(400, 'Account with this email already exists'));
    }

    // Restore user with original data and original _id to preserve all relationships
    const restoredUser = new User({
      _id: revocationRecord.accountId,
      ...revocationRecord.originalData
    });

    // Update password to the new one the user entered in the signup form
    restoredUser.password = bcryptjs.hashSync(newPassword, 10);

    await restoredUser.save();

    // Mark revocation token as used
    revocationRecord.isUsed = true;
    revocationRecord.usedAt = new Date();
    revocationRecord.restoredAt = new Date();
    revocationRecord.restoredBy = 'signup_restore';
    await revocationRecord.save();

    // Expire any other active revocation tokens for this email
    await AccountRevocation.updateMany(
      { email: emailLower, isUsed: false, _id: { $ne: revocationRecord._id } },
      { $set: { isUsed: true, usedAt: new Date(), restoredBy: 'signup_restore_cleanup' } }
    );

    // Remove the deleted account record
    await DeletedAccount.findOneAndDelete({ accountId: revocationRecord.accountId });

    // Send activation email
    try {
      await sendAccountActivationEmail(revocationRecord.email, {
        username: revocationRecord.username,
        role: revocationRecord.role
      });
      console.log(`✅ Account restored via signup flow - activation email sent to: ${revocationRecord.email}`);
    } catch (emailError) {
      console.error(`❌ Failed to send activation email to ${revocationRecord.email}:`, emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Account restored successfully',
      user: {
        id: restoredUser._id,
        username: restoredUser.username,
        email: restoredUser.email,
        role: restoredUser.role
      }
    });
  } catch (error) {
    console.error('Error in restoreForSignup:', error);
    next(errorHandler(500, 'Failed to restore account'));
  }
};
