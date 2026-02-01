import RentWallet from '../models/rentWallet.model.js';
import RentLockContract from '../models/rentLockContract.model.js';
import Listing from '../models/listing.model.js';
import User from '../models/user.model.js';
import {
    sendRentPaymentDueReminderEmail,
    sendRentPaymentOverdueEmail
} from '../utils/emailService.js';
import { sendRentalNotification } from '../utils/rentalNotificationService.js';

export const checkAndSendRentReminders = async () => {
    console.log('Starting rent payment reminder check...');

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find wallets with pending or overdue payments
        const wallets = await RentWallet.find({
            'paymentSchedule.status': { $in: ['pending', 'overdue'] }
        })
            .populate({
                path: 'contractId',
                populate: {
                    path: 'listingId',
                    select: 'name'
                }
            })
            .populate('userId', 'email username');

        console.log(`Found ${wallets.length} wallets with pending/overdue payments.`);

        let emailsSent = 0;

        for (const wallet of wallets) {
            if (!wallet.contractId || !wallet.userId) continue;

            let walletUpdated = false;
            const contract = wallet.contractId;
            const propertyName = contract.listingId?.name || 'Property';
            const userEmail = wallet.userId.email;
            const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
            const walletUrl = `${clientUrl}/user/rent-wallet?contractId=${contract._id}`;
            const notificationsToSend = [];

            for (const payment of wallet.paymentSchedule) {
                // Skip completed or other statuses
                if (payment.status === 'completed' || payment.status === 'paid') continue;

                const dueDate = new Date(payment.dueDate);
                dueDate.setHours(0, 0, 0, 0);

                const timeDiff = today.getTime() - dueDate.getTime(); // Positive if overdue

                const daysOverdue = Math.floor(timeDiff / (1000 * 3600 * 24));
                const daysUntilDue = -daysOverdue;

                // --- Overdue Logic & Penalty Calculation ---
                if (daysOverdue > 0) {
                    const baseRent = contract.lockedRentAmount || contract.rentAmount || (payment.amount - (contract.maintenanceCharges || 0));
                    const lateFeePercentage = contract.lateFeePercentage || 5;
                    const penaltyPerDay = (baseRent * (lateFeePercentage / 100));
                    const newPenaltyAmount = Math.round(penaltyPerDay * daysOverdue);

                    if (payment.status !== 'overdue' || payment.penaltyAmount !== newPenaltyAmount) {
                        payment.status = 'overdue';
                        payment.penaltyAmount = newPenaltyAmount;
                        walletUpdated = true;
                    }

                    // Trigger Overdue Notification/Email
                    const triggerDays = [1, 3, 7, 15, 30];
                    if (triggerDays.includes(daysOverdue) || (daysOverdue > 30 && daysOverdue % 30 === 0)) {
                        const payUrl = `${clientUrl}/user/pay-monthly-rent?contractId=${contract._id}&scheduleIndex=${wallet.paymentSchedule.indexOf(payment)}`;
                        const penalty = payment.penaltyAmount || 0;
                        const totalAmount = payment.amount + penalty + (contract.maintenanceCharges || 0);

                        notificationsToSend.push({
                            type: 'overdue',
                            details: {
                                propertyName,
                                dueDate: payment.dueDate.toLocaleDateString('en-GB'),
                                amount: payment.amount,
                                month: `${payment.month}/${payment.year}`,
                                daysOverdue,
                                penalty,
                                totalOverdue: totalAmount,
                                totalAmount,
                                paymentUrl: payUrl,
                                contractId: contract.contractId,
                                walletUrl
                            },
                            notification: {
                                userId: wallet.userId._id,
                                type: 'rent_payment_overdue',
                                title: '⚠️ Rent Payment Overdue',
                                message: `Your rent payment for ${propertyName} is overdue by ${daysOverdue} days. Total due: ₹${totalAmount}.`,
                                meta: {
                                    contractId: contract._id,
                                    listingId: contract.listingId?._id,
                                    paymentId: payment._id
                                },
                                actionUrl: `/user/rent-wallet?contractId=${contract._id}`
                            }
                        });
                    }

                } else {
                    // --- Due Reminders ---
                    const daysLeft = Math.abs(daysUntilDue);
                    let shouldSendReminder = false;
                    const paymentKey = `${payment.month}-${payment.year}`;

                    if (daysLeft === 3 && !payment.reminderSent3Days) {
                        shouldSendReminder = true;
                        payment.reminderSent3Days = true;
                        walletUpdated = true;
                    }
                    else if (daysLeft === 1 && !payment.reminderSent1Day) {
                        shouldSendReminder = true;
                        payment.reminderSent1Day = true;
                        walletUpdated = true;
                    }
                    else if (daysLeft === 0 && !wallet.reminderSent) { // Due Today
                        const lastReminder = wallet.lastReminderDate ? new Date(wallet.lastReminderDate) : null;
                        if (!lastReminder || lastReminder.toDateString() !== today.toDateString()) {
                            shouldSendReminder = true;
                            wallet.lastReminderDate = new Date();
                            wallet.reminderSent = true;
                            walletUpdated = true;
                        }
                    }

                    if (shouldSendReminder) {
                        const payUrl = `${clientUrl}/user/pay-monthly-rent?contractId=${contract._id}&scheduleIndex=${wallet.paymentSchedule.indexOf(payment)}`;
                        notificationsToSend.push({
                            type: 'reminder',
                            details: {
                                propertyName,
                                dueDate: payment.dueDate.toLocaleDateString('en-GB'),
                                amount: payment.amount,
                                month: `${payment.month}/${payment.year}`,
                                paymentUrl: payUrl,
                                contractId: contract.contractId,
                                walletUrl
                            },
                            notification: {
                                userId: wallet.userId._id,
                                type: 'rent_payment_reminder',
                                title: 'Rent Payment Check',
                                message: `Rent for ${propertyName} is due ${daysLeft === 0 ? 'today' : `in ${daysLeft} days`}.`,
                                meta: {
                                    contractId: contract._id,
                                    listingId: contract.listingId?._id,
                                    paymentId: payment._id
                                },
                                actionUrl: `/user/rent-wallet?contractId=${contract._id}`
                            }
                        });
                    }
                }
            }

            // Save updates to DB first
            if (walletUpdated) {
                const maintenance = contract.maintenanceCharges || 0;
                const pendingPayments = wallet.paymentSchedule.filter(p => p.status === 'pending' || p.status === 'overdue');
                const completedPayments = wallet.paymentSchedule.filter(p => p.status === 'completed' || p.status === 'paid');

                wallet.totalPaid = completedPayments.reduce((sum, p) => sum + p.amount + (p.penaltyAmount || 0) + maintenance, 0);
                wallet.totalDue = pendingPayments.reduce((sum, p) => sum + p.amount + (p.penaltyAmount || 0) + maintenance, 0);

                wallet.markModified('paymentSchedule');
                await wallet.save();
            }

            // Now send emails/notifications
            for (const item of notificationsToSend) {
                if (item.type === 'overdue') {
                    await sendRentPaymentOverdueEmail(userEmail, item.details);
                    emailsSent++;
                    console.log(`Sent overdue reminder to ${userEmail}`);
                } else if (item.type === 'reminder') {
                    await sendRentPaymentDueReminderEmail(userEmail, item.details);
                    emailsSent++;
                }

                await sendRentalNotification(item.notification);
            }
        }

        console.log(`Rent reminder check completed. Sent ${emailsSent} emails/notifications.`);
    } catch (error) {
        console.error('Error in rent reminder service:', error);
    }
};
