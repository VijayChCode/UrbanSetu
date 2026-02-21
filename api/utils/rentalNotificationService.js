import Notification from '../models/notification.model.js';
import RentWallet from '../models/rentWallet.model.js';
import RentLockContract from '../models/rentLockContract.model.js';
import Listing from '../models/listing.model.js';
import User from '../models/user.model.js';
import {
  sendRentPaymentReceivedEmail,
  sendRentPaymentReceivedToLandlordEmail,
  sendRentPaymentReminderEmail,
  sendRentPaymentOverdueEmail,
  sendEscrowReleasedEmail,
  sendContractSignedEmail,
  sendContractExpiringSoonEmail
} from './emailService.js';

import { sendPushNotification } from './pushNotification.js';

/**
 * Utility service for sending rental-related notifications
 * Handles both database storage and real-time socket emission
 */

/**
 * Send a notification to a user (database + socket)
 * @param {Object} options - Notification options
 * @param {String} options.userId - Target user ID
 * @param {String} options.type - Notification type (from enum)
 * @param {String} options.title - Notification title
 * @param {String} options.message - Notification message
 * @param {Object} options.meta - Additional metadata (contractId, listingId, etc.)
 * @param {String} options.actionUrl - URL for action button
 * @param {Object} options.io - Socket.io instance (optional, for real-time)
 * @returns {Promise<Object>} Created notification
 */
export const sendRentalNotification = async ({
  userId,
  type,
  title,
  message,
  meta = {},
  actionUrl = null,
  io = null
}) => {
  try {
    // Create notification in database
    const notification = new Notification({
      userId,
      type,
      title,
      message,
      meta: {
        ...meta,
        rental: true // Flag to identify rental notifications
      },
      listingId: meta.listingId || null,
      actionUrl
    });

    await notification.save();

    // Send native push notification
    sendPushNotification(userId.toString(), title, message, {
      notificationId: notification._id,
      type,
      actionUrl
    });

    // Emit real-time notification via socket if available
    if (io) {
      const userIdStr = userId.toString();
      io.to(userIdStr).emit('newNotification', {
        notification: {
          _id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          isRead: notification.isRead,
          createdAt: notification.createdAt,
          meta: notification.meta,
          actionUrl: notification.actionUrl
        }
      });

      // Also emit to user_${userId} room for compatibility
      io.to(`user_${userIdStr}`).emit('newNotification', {
        notification: {
          _id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          isRead: notification.isRead,
          createdAt: notification.createdAt,
          meta: notification.meta,
          actionUrl: notification.actionUrl
        }
      });
    }

    return notification;
  } catch (error) {
    console.error('Error sending rental notification:', error);
    throw error;
  }
};

/**
 * Send payment reminder notifications
 * @param {Object} options
 * @param {Object} options.io - Socket.io instance
 * @param {Number} options.daysBefore - Days before due date (3 or 1)
 */
export const sendPaymentReminders = async ({ io = null, daysBefore = 3 }) => {
  try {
    const today = new Date();
    const reminderDate = new Date(today);
    reminderDate.setDate(today.getDate() + daysBefore);
    reminderDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(reminderDate);
    nextDay.setDate(reminderDate.getDate() + 1);

    // Find wallets with payments due on reminderDate
    const wallets = await RentWallet.find({
      'paymentSchedule': {
        $elemMatch: {
          dueDate: {
            $gte: reminderDate,
            $lt: nextDay
          },
          status: 'pending',
          ...(daysBefore === 3 ? { reminderSent3Days: { $ne: true } } : { reminderSent1Day: { $ne: true } })
        }
      }
    }).populate('userId', 'username firstName lastName email')
      .populate('contractId');

    for (const wallet of wallets) {
      const contract = await RentLockContract.findById(wallet.contractId)
        .populate('listingId', 'name address')
        .populate('tenantId', 'username firstName lastName');

      if (!contract || !contract.listingId) continue;

      const paymentEntry = wallet.paymentSchedule.find(p => {
        const dueDate = new Date(p.dueDate);
        return dueDate >= reminderDate && dueDate < nextDay && p.status === 'pending';
      });

      if (!paymentEntry) continue;

      const listing = contract.listingId;
      const tenant = contract.tenantId;

      // Mark reminder as sent
      const scheduleIndex = wallet.paymentSchedule.findIndex(p => p._id.toString() === paymentEntry._id.toString());
      if (scheduleIndex !== -1) {
        if (daysBefore === 3) {
          wallet.paymentSchedule[scheduleIndex].reminderSent3Days = true;
        } else {
          wallet.paymentSchedule[scheduleIndex].reminderSent1Day = true;
        }
        await wallet.save();
      }

      const notificationType = daysBefore === 3
        ? 'rent_payment_reminder_3days'
        : 'rent_payment_reminder_1day';

      const clientUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
      const walletUrl = `${clientUrl}/user/rent-wallet?contractId=${contract._id}`;

      // Send notification
      await sendRentalNotification({
        userId: wallet.userId._id,
        type: notificationType,
        title: `Rent Payment Reminder - ${daysBefore} Day${daysBefore > 1 ? 's' : ''} Left`,
        message: `Your rent payment of ₹${paymentEntry.amount} for ${listing.name} is due on ${new Date(paymentEntry.dueDate).toLocaleDateString()}. Please ensure payment is made on time to avoid penalties.`,
        meta: {
          contractId: contract._id,
          listingId: listing._id,
          walletId: wallet._id,
          paymentAmount: paymentEntry.amount,
          dueDate: paymentEntry.dueDate,
          rentMonth: paymentEntry.month,
          rentYear: paymentEntry.year
        },
        actionUrl: walletUrl,
        io
      });

      // Send email
      try {
        await sendRentPaymentReminderEmail(tenant.email, {
          propertyName: listing.name,
          amount: paymentEntry.amount,
          dueDate: paymentEntry.dueDate,
          daysLeft: daysBefore,
          contractId: contract._id,
          walletUrl,
          penaltyAmount: paymentEntry.penaltyAmount
        });
        console.log(`✅ Rent payment reminder email sent to ${tenant.email}`);
      } catch (emailError) {
        console.error('Error sending rent payment reminder email:', emailError);
      }
    }

    return { sent: wallets.length };
  } catch (error) {
    console.error('Error sending payment reminders:', error);
    throw error;
  }
};

/**
 * Send overdue payment notifications
 */
export const sendOverduePaymentNotifications = async ({ io = null }) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const wallets = await RentWallet.find({
      'paymentSchedule': {
        $elemMatch: {
          dueDate: { $lt: today },
          status: 'pending'
        }
      }
    }).populate('userId', 'username firstName lastName email')
      .populate('contractId');

    for (const wallet of wallets) {
      const contract = await RentLockContract.findById(wallet.contractId)
        .populate('listingId', 'name address')
        .populate('tenantId', 'username firstName lastName email');

      if (!contract || !contract.listingId) continue;

      const overduePayments = wallet.paymentSchedule.filter(p => {
        const dueDate = new Date(p.dueDate);
        return dueDate < today && p.status === 'pending';
      });

      if (overduePayments.length === 0) continue;

      const listing = contract.listingId;
      const tenant = contract.tenantId;
      const totalOverdue = overduePayments.reduce((sum, p) => sum + (p.amount + (p.penaltyAmount || 0)), 0);

      // Ensure tenant has email
      if (!tenant.email) continue;

      const clientUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
      const walletUrl = `${clientUrl}/user/rent-wallet?contractId=${contract._id}`;

      // Send notification
      await sendRentalNotification({
        userId: wallet.userId._id,
        type: 'rent_payment_overdue',
        title: 'Rent Payment Overdue',
        message: `You have ${overduePayments.length} overdue payment(s) totaling ₹${totalOverdue} for ${listing.name}. Please pay immediately to avoid further penalties and contract issues.`,
        meta: {
          contractId: contract._id,
          listingId: listing._id,
          walletId: wallet._id,
          overdueCount: overduePayments.length,
          totalOverdue
        },
        actionUrl: walletUrl,
        io
      });

      // Send email
      try {
        await sendRentPaymentOverdueEmail(tenant.email, {
          propertyName: listing.name,
          totalOverdue,
          overdueCount: overduePayments.length,
          contractId: contract._id,
          walletUrl
        });
        console.log(`✅ Rent payment overdue email sent to ${tenant.email}`);
      } catch (emailError) {
        console.error('Error sending rent payment overdue email:', emailError);
      }
    }

    return { sent: wallets.length };
  } catch (error) {
    console.error('Error sending overdue payment notifications:', error);
    throw error;
  }
};

/**
 * Send contract expiry reminders
 */
export const sendContractExpiryReminders = async ({ io = null, daysBefore = 30 }) => {
  try {
    const today = new Date();
    const reminderDate = new Date(today);
    reminderDate.setDate(today.getDate() + daysBefore);
    reminderDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(reminderDate);
    nextDay.setDate(reminderDate.getDate() + 1);

    const contracts = await RentLockContract.find({
      status: 'active',
      endDate: {
        $gte: reminderDate,
        $lt: nextDay
      }
    }).populate('tenantId', 'username firstName lastName email')
      .populate('landlordId', 'username firstName lastName email')
      .populate('listingId', 'name address');

    for (const contract of contracts) {
      const listing = contract.listingId;
      const clientUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
      const contractUrl = `${clientUrl}/user/rental-contracts?contractId=${contract._id}`;

      // Notify tenant
      await sendRentalNotification({
        userId: contract.tenantId._id,
        type: 'rent_contract_expiring_soon',
        title: 'Rental Contract Expiring Soon',
        message: `Your rental contract for ${listing.name} will expire on ${new Date(contract.endDate).toLocaleDateString()}. Please contact your landlord to discuss renewal or move-out arrangements.`,
        meta: {
          contractId: contract._id,
          listingId: listing._id,
          endDate: contract.endDate
        },
        actionUrl: contractUrl,
        io
      });

      // Send email to tenant
      try {
        await sendContractExpiringSoonEmail(contract.tenantId.email, {
          propertyName: listing.name,
          endDate: contract.endDate,
          tenantName: contract.tenantId.username,
          landlordName: contract.landlordId.username,
          userRole: 'tenant',
          contractUrl
        });
        console.log(`✅ Contract expiring email sent to tenant ${contract.tenantId.email}`);
      } catch (emailError) {
        console.error('Error sending contract expiring email to tenant:', emailError);
      }

      // Notify landlord
      await sendRentalNotification({
        userId: contract.landlordId._id,
        type: 'rent_contract_expiring_soon',
        title: 'Rental Contract Expiring Soon',
        message: `The rental contract for ${listing.name} with tenant ${contract.tenantId.username} will expire on ${new Date(contract.endDate).toLocaleDateString()}. Please contact the tenant to discuss renewal or move-out arrangements.`,
        meta: {
          contractId: contract._id,
          listingId: listing._id,
          endDate: contract.endDate,
          tenantId: contract.tenantId._id
        },
        actionUrl: contractUrl,
        io
      });

      // Send email to landlord
      try {
        await sendContractExpiringSoonEmail(contract.landlordId.email, {
          propertyName: listing.name,
          endDate: contract.endDate,
          tenantName: contract.tenantId.username,
          landlordName: contract.landlordId.username,
          userRole: 'landlord',
          contractUrl
        });
        console.log(`✅ Contract expiring email sent to landlord ${contract.landlordId.email}`);
      } catch (emailError) {
        console.error('Error sending contract expiring email to landlord:', emailError);
      }
    }

    return { sent: contracts.length * 2 }; // Both tenant and landlord
  } catch (error) {
    console.error('Error sending contract expiry reminders:', error);
    throw error;
  }
};

/**
 * Send new rental property available notifications (to users who might be interested)
 * This is a placeholder - in production, you'd match based on user preferences, location, etc.
 */
export const sendNewPropertyNotifications = async ({ listingId, io = null }) => {
  try {
    const listing = await Listing.findById(listingId)
      .populate('userRef', 'username firstName lastName');

    if (!listing || listing.type !== 'rent') return;

    // In production, you'd query users based on:
    // - Saved searches matching this property
    // - Location preferences
    // - Price range preferences
    // - Property type preferences
    // For now, this is a placeholder that can be extended

    // Example: Notify users who have similar properties in their watchlist
    // This would require additional logic based on your watchlist system

    return { sent: 0 };
  } catch (error) {
    console.error('Error sending new property notifications:', error);
    throw error;
  }
};

/**
 * Send rating reminder notifications (after contract completion or move-out)
 */
export const sendRatingReminders = async ({ contractId, io = null }) => {
  try {
    const contract = await RentLockContract.findById(contractId)
      .populate('tenantId', 'username firstName lastName email')
      .populate('landlordId', 'username firstName lastName email')
      .populate('listingId', 'name address');

    if (!contract) return;

    const listing = contract.listingId;

    // Check if ratings are already submitted (you'd query RentalRating model)
    // For now, send reminders to both parties

    // Notify tenant to rate landlord
    await sendRentalNotification({
      userId: contract.tenantId._id,
      type: 'rent_rating_reminder',
      title: 'Rate Your Rental Experience',
      message: `Please rate your rental experience with ${contract.landlordId.username} for ${listing.name}. Your feedback helps maintain transparency in the rental market.`,
      meta: {
        contractId: contract._id,
        listingId: listing._id,
        landlordId: contract.landlordId._id
      },
      actionUrl: `/user/rental-ratings?contractId=${contract._id}`,
      io
    });

    // Notify landlord to rate tenant
    await sendRentalNotification({
      userId: contract.landlordId._id,
      type: 'rent_rating_reminder',
      title: 'Rate Your Tenant',
      message: `Please rate your tenant ${contract.tenantId.username} for ${listing.name}. Your feedback helps maintain transparency in the rental market.`,
      meta: {
        contractId: contract._id,
        listingId: listing._id,
        tenantId: contract.tenantId._id
      },
      actionUrl: `/user/rental-ratings?contractId=${contract._id}`,
      io
    });

    return { sent: 2 };
  } catch (error) {
    console.error('Error sending rating reminders:', error);
    throw error;
  }
};

