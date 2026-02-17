import express from "express";
import mongoose from "mongoose";
import Payment from "../models/payment.model.js";
import Booking from "../models/booking.model.js";
import Listing from "../models/listing.model.js";
import User from "../models/user.model.js";
import RefundRequest from "../models/RefundRequest.js";
import Notification from "../models/notification.model.js";
import { verifyToken } from '../utils/verify.js';
import crypto from 'crypto';
import { createPayPalOrder, capturePayPalOrder, getPayPalAccessToken } from '../controllers/paypalController.js';
import { generateReceiptPdf } from '../utils/pdfGenerator.js';
import {
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  sendAppointmentCancelledEmail,
  sendRefundRequestApprovedEmail,
  sendRefundRequestRejectedEmail,
  sendSellerPaymentNotificationEmail,
  sendEscrowReleasedEmail,
  sendRentPaymentReceivedToLandlordEmail,
  sendLoanRepaidEmail,
  sendRentPaymentConfirmationEmail,
  sendRentPaymentReceivedEmail
} from '../utils/emailService.js';
import { sendRentalNotification } from '../utils/rentalNotificationService.js';
import fetch from 'node-fetch';
import PDFDocument from 'pdfkit';

const router = express.Router();

// GET: Get Razorpay key for mobile app
router.get("/razorpay-key", (req, res) => {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) {
      return res.status(500).json({ message: 'Razorpay key not configured' });
    }
    res.json({ key: keyId });
  } catch (err) {
    console.error('Error getting Razorpay key:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate unique payment ID
const generatePaymentId = () => {
  return 'PAY_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Generate receipt number
const generateReceiptNumber = () => {
  return 'RCP_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
};

// Razorpay helpers
const getRazorpayAuthHeader = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('Missing Razorpay credentials. Ensure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set.');
  }
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  return { keyId, authHeader: `Basic ${auth}` };
};

// POST: Initialize appointment lock (called when payment modal opens)
router.post("/lock/initialize", verifyToken, async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const userId = req.user.id;

    if (!appointmentId) {
      return res.status(400).json({ message: 'Appointment ID is required' });
    }

    // Validate appointment
    const appointment = await Booking.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check if user is authorized
    if (appointment.buyerId.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // IMPORTANT: Since each payment attempt creates a NEW payment ID,
    // we reset the appointment lock timer to 10 minutes for each new payment initialization.
    // This gives a fresh 10-minute payment window for each payment attempt.
    // The 10 minutes is the payment window time, NOT the payment ID expiry time.
    const now = new Date();
    appointment.lockStartTime = now;
    appointment.lockExpiryTime = new Date(now.getTime() + 10 * 60 * 1000); // Always reset to 10 minutes for new payment
    await appointment.save();

    return res.json({
      ok: true,
      appointment: {
        _id: appointment._id,
        lockStartTime: appointment.lockStartTime,
        lockExpiryTime: appointment.lockExpiryTime
      }
    });
  } catch (err) {
    console.error('Error initializing appointment lock:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST: Extend appointment lock heartbeat
router.post("/lock/heartbeat", verifyToken, async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const appointment = await Booking.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Extend lock by 10 minutes from now
    appointment.lockExpiryTime = new Date(Date.now() + 10 * 60 * 1000);
    await appointment.save();

    res.status(200).json({
      success: true,
      lockExpiryTime: appointment.lockExpiryTime
    });
  } catch (err) {
    console.error('Error in lock heartbeat:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST: Create payment intent (advance payment for booking)
router.post("/create-intent", verifyToken, async (req, res) => {
  try {
    const { appointmentId, amount, paymentType = 'advance', gateway = 'paypal', contractId } = req.body;
    const userId = req.user.id;

    // Validate appointment
    const appointment = await Booking.findById(appointmentId)
      .populate('listingId', 'name regularPrice discountPrice offer')
      .populate('buyerId', 'username email')
      .populate('sellerId', 'username email');

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    // Check if user is authorized
    if (appointment.buyerId._id.toString() !== userId) {
      return res.status(403).json({ message: "You can only make payments for your own appointments." });
    }

    // If this is a rental payment, validate contract and calculate amount
    let rentalPaymentAmount = null;
    let contract = null;
    if (contractId && (paymentType === 'security_deposit' || paymentType === 'advance')) {
      const RentLockContract = (await import('../models/rentLockContract.model.js')).default;
      contract = await RentLockContract.findById(contractId)
        .populate('listingId', 'name address');

      if (!contract) {
        return res.status(404).json({ message: "Rental contract not found." });
      }

      // Verify user is the tenant
      if (contract.tenantId.toString() !== userId) {
        return res.status(403).json({ message: "Unauthorized. Only tenant can make rental payments." });
      }

      // Calculate total: security deposit + first month rent
      rentalPaymentAmount = (contract.securityDeposit || 0) + (contract.lockedRentAmount || 0);
    }

    // IMPORTANT: Since each payment attempt creates a NEW payment ID,
    // we reset the appointment lock timer to 10 minutes for each new payment initialization.
    // This gives a fresh 10-minute payment window for each payment attempt.
    // The 10 minutes is the payment window time, NOT the payment ID expiry time.
    const now = new Date();
    appointment.lockStartTime = now;
    appointment.lockExpiryTime = new Date(now.getTime() + 10 * 60 * 1000); // Always reset to 10 minutes for new payment
    await appointment.save();

    // Check if payment is already completed for this appointment
    const completedPayment = await Payment.findOne({
      appointmentId,
      status: 'completed'
    }).sort({ createdAt: -1 });

    if (completedPayment) {
      return res.status(400).json({
        message: "Payment already completed for this appointment.",
        payment: completedPayment
      });
    }

    // IMPORTANT: Always create a NEW payment ID for every payment attempt
    // DO NOT reuse existing payment intents, even if they haven't expired
    // This follows Razorpay/PayPal best practices:
    // - Each payment attempt = new order ID
    // - Reusing order IDs can cause payment failures (BAD_REQUEST_ERROR, ORDER_ERROR, etc.)
    // - Since each payment gets a new ID, the appointment lock timer is reset to 10 minutes for each new payment
    // - The 10 minutes is the payment window time (fresh window per attempt), NOT tied to a specific payment ID

    // Cancel any existing pending/processing payments for this appointment
    // This keeps the database clean while ensuring we always create fresh payment IDs
    // (reusing 'now' variable declared above)
    const cancelledPayments = await Payment.updateMany(
      {
        appointmentId,
        status: { $in: ['pending', 'processing'] }
      },
      {
        status: 'cancelled',
        updatedAt: now,
        expiresAt: null
      }
    );

    if (cancelledPayments.modifiedCount > 0) {
      console.log(`Cancelled ${cancelledPayments.modifiedCount} existing pending/processing payment(s) before creating new payment intent for appointment ${appointmentId}`);
    }

    const listing = appointment.listingId;
    // Determine gateway and amounts
    if (gateway === 'razorpay') {
      // For rental payments, use calculated amount; otherwise use ₹100 advance
      const advanceAmountInr = rentalPaymentAmount ? Math.round(rentalPaymentAmount) : 100;
      const payment = new Payment({
        paymentId: generatePaymentId(),
        appointmentId,
        userId,
        listingId: listing._id,
        amount: advanceAmountInr,
        currency: 'INR',
        paymentType: rentalPaymentAmount ? 'security_deposit' : paymentType,
        gateway: 'razorpay',
        status: 'pending',
        receiptNumber: generateReceiptNumber(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // Expires in 10 minutes
        ...(contractId && { contractId })
      });
      await payment.save();

      // Create Razorpay order (amount in paise)
      const { keyId, authHeader } = getRazorpayAuthHeader();
      const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          amount: advanceAmountInr * 100,
          currency: 'INR',
          receipt: payment.receiptNumber,
          payment_capture: 1,
          notes: { appointmentId: String(appointmentId), paymentId: payment.paymentId }
        })
      });
      const orderText = await orderRes.text();
      let order;
      try { order = JSON.parse(orderText); } catch (e) {
        console.error('Razorpay create-order non-JSON:', orderText);
        return res.status(500).json({ message: 'Error creating Razorpay order', details: orderText });
      }
      if (!orderRes.ok) {
        console.error('Razorpay create-order error:', order);
        return res.status(500).json({ message: 'Error creating Razorpay order', details: order });
      }
      payment.gatewayOrderId = order.id;
      await payment.save();

      return res.status(201).json({
        message: 'Payment intent (Razorpay) created successfully',
        payment,
        razorpay: { orderId: order.id, amount: advanceAmountInr * 100, currency: 'INR', keyId },
        appointment: {
          lockStartTime: appointment.lockStartTime,
          lockExpiryTime: appointment.lockExpiryTime
        }
      });
    } else {
      // For rental payments, convert INR to USD (approximate); otherwise use $5 advance
      const advanceAmountUsd = rentalPaymentAmount ? Math.round((rentalPaymentAmount / 83) * 100) / 100 : 5; // Approx 1 USD = 83 INR
      const payment = new Payment({
        paymentId: generatePaymentId(),
        appointmentId,
        userId,
        listingId: listing._id,
        amount: advanceAmountUsd,
        currency: 'USD',
        paymentType: rentalPaymentAmount ? 'security_deposit' : paymentType,
        gateway: 'paypal',
        status: 'pending',
        receiptNumber: generateReceiptNumber(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // Expires in 10 minutes
        ...(contractId && { contractId })
      });
      await payment.save();
      return res.status(201).json({
        message: 'Payment intent created successfully',
        payment,
        paypal: { amount: advanceAmountUsd, currency: 'USD' },
        appointment: {
          lockStartTime: appointment.lockStartTime,
          lockExpiryTime: appointment.lockExpiryTime
        }
      });
    }
  } catch (err) {
    console.error("Error creating payment intent:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET: Stream PDF receipt (public - no auth required for email access)
router.get('/:paymentId/receipt', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { admin } = req.query; // Check if admin parameter is present
    const payment = await Payment.findOne({ paymentId })
      .populate('appointmentId', 'propertyName date time status buyerId sellerId')
      .populate('listingId', 'name address')
      .populate('contractId')
      .populate({ path: 'contractId', populate: { path: 'tenantId listingId' } })
      .populate('userId', 'username email firstName');

    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt_${payment.paymentId}.pdf"`);

    try {
      const pdfBuffer = await generateReceiptPdf(payment);
      res.end(pdfBuffer);
    } catch (e) {
      console.error('PDF generation error:', e);
      res.status(500).json({ message: 'Error generating PDF' });
    }
  } catch (e) {
    console.error('Receipt PDF error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST: Verify payment (PayPal capture webhook-like endpoint)
router.post("/verify", verifyToken, async (req, res) => {
  try {
    const { paymentId, paypalOrderId, clientIp, userAgent, paymentStatus } = req.body;

    // Update payment record
    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Get appointment and user details for email
    const appointment = await Booking.findById(payment.appointmentId)
      .populate('buyerId', 'email username')
      .populate('listingId', 'name');

    const user = appointment.buyerId;
    const listing = appointment.listingId;

    // Check if payment was successful or failed
    if (paymentStatus === 'failed' || !paypalOrderId) {
      payment.status = 'failed';
      payment.failedAt = new Date();
      payment.clientIp = clientIp || req.ip;
      payment.userAgent = userAgent || req.headers['user-agent'];
      await payment.save();

      // Send payment failed email
      try {
        await sendPaymentFailedEmail(user.email, {
          paymentId: payment.paymentId,
          amount: payment.amount,
          currency: payment.currency,
          propertyName: listing.name,
          appointmentDate: appointment.date ? new Date(appointment.date).toLocaleDateString() : 'N/A',
          paymentType: payment.paymentType,
          gateway: payment.gateway,
          reason: 'Payment was declined or failed during processing'
        });
      } catch (emailError) {
        console.error('Error sending payment failed email:', emailError);
      }

      return res.status(400).json({
        message: "Payment failed",
        payment: payment
      });
    }

    payment.status = 'completed';
    payment.gatewayPaymentId = paypalOrderId;
    payment.gatewayOrderId = paypalOrderId;
    payment.gatewaySignature = undefined;
    payment.completedAt = new Date();
    payment.clientIp = clientIp || req.ip;
    payment.userAgent = userAgent || req.headers['user-agent'];

    // DELAYED SAVE: We do NOT save payment here. See below.
    // await payment.save();

    // Update appointment status/payment flags
    await Booking.findByIdAndUpdate(payment.appointmentId, {
      paymentConfirmed: true,
      visibleToBuyer: true,
      visibleToSeller: true
    });

    // Generate receipt URL (mock). Fall back to API URL if CLIENT_URL missing
    const base = `${req.protocol}://${req.get('host')}`;
    const receiptUrl = `${base}/api/payments/${payment.paymentId}/receipt`;
    payment.receiptUrl = receiptUrl;

    // DELAYED SAVE: We do NOT save payment here to prevent the frontend from fetching 
    // stale wallet data before the wallet update logic (below) completes.
    // await payment.save();

    // Handle rental security deposit payment (PayPal)
    if (payment.paymentType === 'security_deposit' && payment.contractId) {
      try {
        const RentLockContract = (await import('../models/rentLockContract.model.js')).default;
        const RentWallet = (await import('../models/rentWallet.model.js')).default;

        const contract = await RentLockContract.findById(payment.contractId)
          .populate('listingId', 'name address')
          .populate('tenantId', 'username email')
          .populate('landlordId', 'username email');

        if (contract) {
          // Mark security deposit as paid
          contract.securityDepositPaid = true;

          // Create/update rent wallet if it doesn't exist
          let wallet = await RentWallet.findOne({ contractId: contract._id, userId: contract.tenantId._id });
          if (!wallet) {
            wallet = new RentWallet({
              userId: contract.tenantId._id,
              contractId: contract._id
            });
            wallet.generatePaymentSchedule(contract);
            await wallet.save();
          }

          // Update booking with wallet ID
          await Booking.findByIdAndUpdate(payment.appointmentId, { walletId: wallet._id });

          // Update contract with wallet ID
          if (!contract.walletId) {
            contract.walletId = wallet._id;
          }

          await contract.save();

          // Emit socket events for rental contract update
          const io = req.app.get('io');
          if (io) {
            io.emit('rentalPaymentStatusUpdated', {
              contractId: contract._id,
              paymentId: payment.paymentId,
              paymentType: 'security_deposit',
              paymentConfirmed: true
            });
            io.to(`user_${contract.tenantId._id}`).emit('rentalPaymentStatusUpdated', {
              contractId: contract._id,
              paymentId: payment.paymentId,
              paymentType: 'security_deposit',
              paymentConfirmed: true
            });
            io.to(`user_${contract.landlordId._id}`).emit('rentalPaymentStatusUpdated', {
              contractId: contract._id,
              paymentId: payment.paymentId,
              paymentType: 'security_deposit',
              paymentConfirmed: true
            });
          }
        }
      } catch (rentalError) {
        console.error('Error handling rental security deposit payment:', rentalError);
        // Don't fail the payment verification if rental update fails
      }
    }

    // Socket emit moved to end of function to ensure DB consistency
    const io = req.app.get('io');

    // Send rental payment notifications if this is a monthly rent payment
    let contractId = payment.contractId;
    if (!contractId && payment.metadata) {
      // Fallback: extract from metadata
      contractId = payment.metadata instanceof Map ? payment.metadata.get('contractId') : payment.metadata.contractId;
    }

    if (payment.paymentType === 'monthly_rent' && contractId) {
      try {
        const RentLockContract = (await import('../models/rentLockContract.model.js')).default;
        const RentWallet = (await import('../models/rentWallet.model.js')).default;

        // 1. Try to get wallet directly from payment (safest) or via contract
        let wallet;
        if (payment.walletId) {
          wallet = await RentWallet.findById(payment.walletId);
        }

        // 2. Fallback: Get contract then wallet
        if (!wallet) {
          const contract = await RentLockContract.findById(contractId);
          if (contract) {
            wallet = await RentWallet.findOne({ contractId: contract._id });
          }
        }

        if (wallet) {
          // Find schedule entry using multiple strategies
          const getMeta = (key) => payment.metadata instanceof Map ? payment.metadata.get(key) : (payment.metadata ? payment.metadata[key] : undefined);

          const targetMonth = Number(payment.rentMonth || getMeta('month'));
          const targetYear = Number(payment.rentYear || getMeta('year'));
          const pIdString = payment._id.toString();

          // Strategy 1: Match by exact Payment ID (Set during initialization)
          let scheduleEntry = wallet.paymentSchedule.find(p => p.paymentId && p.paymentId.toString() === pIdString);

          // Strategy 2: Match by Month & Year (if PaymentID link missed)
          if (!scheduleEntry) {
            scheduleEntry = wallet.paymentSchedule.find(p => Number(p.month) === targetMonth && Number(p.year) === targetYear);
          }

          if (scheduleEntry) {
            scheduleEntry.status = 'completed';
            scheduleEntry.paidAt = new Date();
            scheduleEntry.paymentId = payment._id; // Ensure link

            // Update wallet totals
            const originalAmount = getMeta('originalAmount');
            const amountToCredit = originalAmount ? Number(originalAmount) : payment.amount;

            // Prevent double counting if verified multiple times
            // We assume verify shouldn't run twice for same success, but logic here adds cumulatively. 
            // Since status check happens before (in create-intent), risk is low.

            // Recalculate totals from scratch to be safe? 
            // Better: Just add current payment.
            wallet.totalPaid = (wallet.totalPaid || 0) + amountToCredit;
            wallet.totalDue = Math.max(0, (wallet.totalDue || 0) - amountToCredit);

            wallet.markModified('paymentSchedule'); // FORCE Mongoose to see the change
            await wallet.save();
            console.log(`✅ Rent Wallet Updated: ${targetMonth}/${targetYear} -> Completed`);
          } else {
            console.warn(`⚠️ Schedule entry not found for ${targetMonth}/${targetYear} in wallet ${wallet._id}`);
          }
        }

        // Fetch contract for notifications (needed if we skipped finding it above)
        const notificationContract = await RentLockContract.findById(contractId)
          .populate('listingId', 'name address')
          .populate('tenantId', 'username email')
          .populate('landlordId', 'username email');

        if (notificationContract) {
          const contract = notificationContract; // Alias for below code
          const listing = contract.listingId;
          const clientUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
          const walletUrl = `${clientUrl}/user/rent-wallet?contractId=${contract._id}`;
          const receiptUrl = payment.receiptUrl || `${clientUrl}/api/payments/${payment.paymentId}/receipt`;

          // (Notifications continue below...)


          // Notify tenant
          await sendRentalNotification({
            userId: contract.tenantId._id,
            type: 'rent_payment_received',
            title: 'Rent Payment Received',
            message: `Your rent payment of ₹${payment.amount} for ${listing.name} (${payment.rentMonth}/${payment.rentYear}) has been received and is being held in escrow.`,
            meta: {
              contractId: contract._id,
              listingId: listing._id,
              paymentId: payment.paymentId,
              amount: payment.amount,
              rentMonth: payment.rentMonth,
              rentYear: payment.rentYear
            },
            actionUrl: walletUrl,
            io
          });

          // Send email to tenant
          try {
            await sendRentPaymentReceivedEmail(contract.tenantId.email, {
              paymentId: payment.paymentId,
              amount: payment.amount,
              propertyName: listing.name,
              rentMonth: payment.rentMonth,
              rentYear: payment.rentYear,
              receiptUrl: receiptUrl,
              contractId: contract._id,
              walletUrl: walletUrl
            });
            console.log(`✅ Rent payment received email sent to tenant ${contract.tenantId.email}`);
          } catch (emailError) {
            console.error('Error sending rent payment received email to tenant:', emailError);
          }

          // Notify landlord
          await sendRentalNotification({
            userId: contract.landlordId._id,
            type: 'rent_payment_received',
            title: 'Rent Payment Received from Tenant',
            message: `A rent payment of ₹${payment.amount} for ${listing.name} (${payment.rentMonth}/${payment.rentYear}) has been received from ${contract.tenantId.username} and is being held in escrow. It will be released after 3 days.`,
            meta: {
              contractId: contract._id,
              listingId: listing._id,
              paymentId: payment.paymentId,
              amount: payment.amount,
              rentMonth: payment.rentMonth,
              rentYear: payment.rentYear,
              tenantId: contract.tenantId._id
            },
            actionUrl: walletUrl,
            io
          });

          // Send email to landlord
          try {
            await sendRentPaymentReceivedToLandlordEmail(contract.landlordId.email, {
              paymentId: payment.paymentId,
              amount: payment.amount,
              propertyName: listing.name,
              rentMonth: payment.rentMonth,
              rentYear: payment.rentYear,
              tenantName: contract.tenantId.username,
              contractId: contract._id,
              walletUrl
            });
            console.log(`✅ Rent payment received email sent to landlord ${contract.landlordId.email}`);
          } catch (emailError) {
            console.error('Error sending rent payment received email to landlord:', emailError);
          }

          // --- SetuCoins Loyalty Integration ---
          try {
            const CoinService = (await import('../services/coinService.js')).default;
            const payingUser = await User.findById(contract.tenantId._id);

            if (payingUser) {
              // 1. Credit coins for payment amount (1 coin per ₹1000)
              const coinsToCredit = Math.floor(payment.amount / 1000);

              if (coinsToCredit > 0) {
                await CoinService.credit({
                  userId: payingUser._id,
                  amount: coinsToCredit,
                  source: 'rent_payment',
                  referenceId: payment._id,
                  referenceModel: 'Payment',
                  description: `Reward for rent payment of ₹${payment.amount}`
                });
                console.log(`🪙 Credited ${coinsToCredit} SetuCoins to user ${payingUser._id}`);
              }

              // 2. Update Streak & Check for On-Time Bonus
              // We need to determine if it was late.
              // Helper to find schedule entry same as earlier in this scope
              let isLate = false;
              if (wallet && wallet.paymentSchedule) {
                const getMeta = (key) => payment.metadata instanceof Map ? payment.metadata.get(key) : (payment.metadata ? payment.metadata[key] : undefined);
                const targetMonth = Number(payment.rentMonth || getMeta('month'));
                const targetYear = Number(payment.rentYear || getMeta('year'));

                const scheduleEntry = wallet.paymentSchedule.find(p => Number(p.month) === targetMonth && Number(p.year) === targetYear);

                if (scheduleEntry && scheduleEntry.dueDate) {
                  const paymentDate = new Date(); // now
                  const dueDate = new Date(scheduleEntry.dueDate);
                  // Standard grace period logic or strict due date?
                  // Let's assume strict due date for gamification
                  if (paymentDate > dueDate) {
                    isLate = true;
                  }
                }
              }

              await CoinService.updateRentStreak({
                userId: payingUser._id,
                paymentDate: new Date(),
                amountPaid: payment.amount,
                isLate: isLate
              });
              console.log(`🔥 Updated rent streak for user ${payingUser._id} (Late: ${isLate})`);

            }
          } catch (coinError) {
            console.error('Error processing SetuCoins loyalty reward:', coinError);
            // Non-blocking: don't fail the verification if gamification fails
          }
          // -------------------------------------
        }
      } catch (notifError) {
        console.error('Error sending rental payment notifications:', notifError);
      }
    }

    // Handle loan EMI payment
    if (payment.paymentType === 'emi' && payment.emiDetails && payment.emiDetails.loanId) {
      try {
        const RentalLoan = (await import('../models/rentalLoan.model.js')).default;
        const loan = await RentalLoan.findOne({ loanId: payment.emiDetails.loanId })
          .populate('userId', 'email username')
          .populate('contractId', 'listingId')
          .populate({
            path: 'contractId',
            populate: { path: 'listingId', select: 'name address' }
          });

        if (loan) {
          // Update EMI schedule status
          let emiToUpdate;
          // Use emiDetails if available, fallback to rentMonth/rentYear
          const month = payment.emiDetails?.month || payment.rentMonth;
          const year = payment.emiDetails?.year || payment.rentYear;

          if (month && year) {
            emiToUpdate = loan.emiSchedule.find(e => e.month === month && e.year === year);
          } else {
            // Fallback: find first pending/overdue/processing EMI
            emiToUpdate = loan.emiSchedule.find(e => e.status === 'pending' || e.status === 'overdue' || e.status === 'processing');
          }

          if (emiToUpdate) {
            emiToUpdate.status = 'completed';
            emiToUpdate.paidAt = new Date();
            emiToUpdate.paymentId = payment._id;

            // Update totals (use original INR amount if available in emiDetails)
            const amountToCredit = payment.emiDetails?.originalAmount || payment.amount;
            loan.totalPaid = (loan.totalPaid || 0) + amountToCredit;
            loan.totalRemaining = Math.max(0, (loan.totalRemaining || loan.loanAmount) - amountToCredit);

            // Send success email
            try {
              const { sendLoanEMIPaymentSuccessEmail } = await import('../utils/emailService.js');
              await sendLoanEMIPaymentSuccessEmail(loan.userId.email, {
                propertyName: loan.contractId?.listingId?.name || 'Property',
                loanType: loan.loanType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                amount: amountToCredit,
                paymentId: payment.paymentId,
                emiMonth: emiToUpdate.month,
                emiYear: emiToUpdate.year,
                remainingBalance: loan.totalRemaining,
                loanUrl: `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/rental-loans?loanId=${loan.loanId}`
              });
              console.log(`✅ [PayPal] Loan EMI success email sent to ${loan.userId.email}`);
            } catch (emailError) {
              console.error('Error sending loan EMI success email:', emailError);
            }

            // Check if fully repaid
            const totalScheduled = loan.emiSchedule.reduce((sum, e) => sum + loan.emiAmount, 0);
            if (loan.totalPaid >= totalScheduled - 10 || loan.totalRemaining <= 10) {
              loan.status = 'repaid';
              loan.repaidAt = new Date();

              // Send Loan Repaid Email
              try {
                const { sendLoanRepaidEmail } = await import('../utils/emailService.js');
                await sendLoanRepaidEmail(loan.userId.email, {
                  propertyName: loan.contractId?.listingId?.name || 'Property',
                  loanType: loan.loanType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                  totalPaid: loan.totalPaid,
                  repaidAt: new Date().toLocaleDateString(),
                  loanUrl: `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/rental-loans?loanId=${loan.loanId}`
                });
                console.log(`✅ [PayPal] Loan repaid email sent (Final) to ${loan.userId.email}`);
              } catch (emailError) {
                console.error('Error sending loan repaid email:', emailError);
              }
            }

            await loan.save();
            console.log(`✅ [PayPal] Loan EMI Updated for loan ${loan.loanId}`);
          }
        }
      } catch (loanError) {
        console.error('Error handling loan EMI payment:', loanError);
      }
    }


    // --- SetuCoins Consistency: Reward general payments > 1000 INR / $12 ---
    if (payment.paymentType !== 'monthly_rent') {
      try {
        const CoinService = (await import('../services/coinService.js')).default;
        let earnedCoins = 0;
        if (payment.currency === 'USD') {
          earnedCoins = Math.floor(payment.amount / 12);
        } else {
          earnedCoins = Math.floor(payment.amount / 1000);
        }

        if (earnedCoins > 0) {
          await CoinService.credit({
            userId: payment.userId,
            amount: earnedCoins,
            source: 'payment_reward',
            description: `Reward for ${payment.paymentType.replace('_', ' ')} (${payment.paymentId})`,
            referenceId: payment._id,
            referenceModel: 'Payment'
          });
          console.log(`🪙 [PayPal] Credited ${earnedCoins} SetuCoins for general payment ${payment.paymentId}`);
        }
      } catch (coinError) {
        console.error('Error processing SetuCoins for general payment:', coinError);
      }

      // Send payment success email to buyer
      try {
        await sendPaymentSuccessEmail(user.email, {
          paymentId: payment.paymentId,
          amount: payment.amount,
          currency: payment.currency,
          propertyName: listing.name,
          appointmentDate: appointment.date ? new Date(appointment.date).toLocaleDateString() : 'N/A',
          receiptUrl: receiptUrl,
          paymentType: payment.paymentType,
          gateway: payment.gateway
        });
        console.log(`✅ Payment success email sent to buyer: ${user.email}`);
      } catch (emailError) {
        console.error('Error sending payment success email:', emailError);
      }

      // Send payment notification email to seller
      try {
        // Get seller details
        await appointment.populate('sellerId', 'email username firstName lastName');
        const seller = appointment.sellerId;

        await sendSellerPaymentNotificationEmail(seller.email, {
          appointmentId: appointment._id,
          propertyName: listing.name,
          propertyDescription: listing.description,
          propertyAddress: listing.address,
          propertyPrice: listing.regularPrice || listing.discountPrice,
          propertyImages: listing.imageUrls || [],
          date: appointment.date,
          time: appointment.time,
          buyerName: user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.username,
          paymentAmount: payment.amount,
          paymentCurrency: payment.currency,
          paymentGateway: payment.gateway,
          listingId: listing._id
        });
        console.log(`✅ Seller payment notification email sent to: ${seller.email}`);
      } catch (sellerEmailError) {
        console.error('Error sending seller payment notification email:', sellerEmailError);
      }
    }

    // DELAYED SAVE: Finally save the payment as completed, ensures Wallet is already updated first.
    await payment.save();

    // Emit socket event for real-time payment status update (Moved to end ensures DB consistency)
    if (io) {
      io.emit('paymentStatusUpdated', {
        appointmentId: payment.appointmentId,
        paymentId: payment.paymentId,
        contractId: payment.contractId,
        paymentConfirmed: true
      });
      io.to(`user_${user._id}`).emit('paymentStatusUpdated', {
        appointmentId: payment.appointmentId,
        paymentId: payment.paymentId,
        contractId: payment.contractId,
        paymentConfirmed: true
      });
    }

    res.status(200).json({
      message: "Payment verified successfully",
      payment: payment,
      receiptUrl: receiptUrl
    });
  } catch (err) {
    console.error("Error verifying payment:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Razorpay: Verify payment
router.post('/razorpay/verify', verifyToken, async (req, res) => {
  try {
    const { paymentId, razorpay_payment_id, razorpay_order_id, razorpay_signature, clientIp, userAgent, paymentStatus } = req.body;
    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    if (payment.gateway !== 'razorpay') {
      return res.status(400).json({ message: 'Invalid gateway for this payment' });
    }

    // Get appointment and user details for email
    const appointment = await Booking.findById(payment.appointmentId)
      .populate('buyerId', 'email username')
      .populate('listingId', 'name');

    const user = appointment.buyerId;
    const listing = appointment.listingId;

    // Check if payment was successful or failed
    if (paymentStatus === 'failed' || !razorpay_payment_id) {
      payment.status = 'failed';
      payment.failedAt = new Date();
      payment.clientIp = clientIp || req.ip;
      payment.userAgent = userAgent || req.headers['user-agent'];
      await payment.save();

      // Send payment failed email
      try {
        await sendPaymentFailedEmail(user.email, {
          paymentId: payment.paymentId,
          amount: payment.amount,
          currency: payment.currency,
          propertyName: listing.name,
          appointmentDate: appointment.date ? new Date(appointment.date).toLocaleDateString() : 'N/A',
          paymentType: payment.paymentType,
          gateway: payment.gateway,
          reason: 'Payment was declined or failed during processing'
        });
      } catch (emailError) {
        console.error('Error sending payment failed email:', emailError);
      }

      return res.status(400).json({
        message: "Payment failed",
        payment: payment
      });
    }

    // Verify signature: hmac_sha256(order_id + '|' + payment_id)
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(500).json({ message: 'Razorpay secret not configured' });
    }
    const hmac = crypto.createHmac('sha256', keySecret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const expectedSignature = hmac.digest('hex');
    if (expectedSignature !== razorpay_signature) {
      payment.status = 'failed';
      payment.failedAt = new Date();
      payment.clientIp = clientIp || req.ip;
      payment.userAgent = userAgent || req.headers['user-agent'];
      await payment.save();

      // Send payment failed email for signature verification failure
      try {
        await sendPaymentFailedEmail(user.email, {
          paymentId: payment.paymentId,
          amount: payment.amount,
          currency: payment.currency,
          propertyName: listing.name,
          appointmentDate: appointment.date ? new Date(appointment.date).toLocaleDateString() : 'N/A',
          paymentType: payment.paymentType,
          gateway: payment.gateway,
          reason: 'Payment signature verification failed'
        });
      } catch (emailError) {
        console.error('Error sending payment failed email:', emailError);
      }

      return res.status(400).json({
        message: 'Signature verification failed',
        payment: payment
      });
    }

    payment.status = 'completed';
    payment.gatewayPaymentId = razorpay_payment_id;
    payment.gatewayOrderId = razorpay_order_id;
    payment.gatewaySignature = razorpay_signature;
    payment.completedAt = new Date();
    payment.clientIp = clientIp || req.ip;
    payment.userAgent = userAgent || req.headers['user-agent'];
    // DELAYED SAVE
    // await payment.save();

    await Booking.findByIdAndUpdate(payment.appointmentId, {
      paymentConfirmed: true,
      visibleToBuyer: true,
      visibleToSeller: true
    });

    const base = `${req.protocol}://${req.get('host')}`;
    const receiptUrl = `${base}/api/payments/${payment.paymentId}/receipt`;
    payment.receiptUrl = receiptUrl;

    // DELAYED SAVE: Do not save here to prevent race condition.
    // await payment.save();

    // Handle rental security deposit payment
    if (payment.paymentType === 'security_deposit' && payment.contractId) {
      try {
        const RentLockContract = (await import('../models/rentLockContract.model.js')).default;
        const RentWallet = (await import('../models/rentWallet.model.js')).default;

        const contract = await RentLockContract.findById(payment.contractId)
          .populate('listingId', 'name address')
          .populate('tenantId', 'username email')
          .populate('landlordId', 'username email');

        if (contract) {
          // Mark security deposit as paid
          contract.securityDepositPaid = true;

          // Create/update rent wallet if it doesn't exist
          let wallet = await RentWallet.findOne({ contractId: contract._id, userId: contract.tenantId._id });
          if (!wallet) {
            wallet = new RentWallet({
              userId: contract.tenantId._id,
              contractId: contract._id
            });
            wallet.generatePaymentSchedule(contract);
            await wallet.save();
          }

          // Update booking with wallet ID
          await Booking.findByIdAndUpdate(payment.appointmentId, { walletId: wallet._id });

          // Update contract with wallet ID
          if (!contract.walletId) {
            contract.walletId = wallet._id;
          }

          await contract.save();

          // Emit socket events for rental contract update
          const io = req.app.get('io');
          if (io) {
            io.emit('rentalPaymentStatusUpdated', {
              contractId: contract._id,
              paymentId: payment.paymentId,
              paymentType: 'security_deposit',
              paymentConfirmed: true
            });
            io.to(`user_${contract.tenantId._id}`).emit('rentalPaymentStatusUpdated', {
              contractId: contract._id,
              paymentId: payment.paymentId,
              paymentType: 'security_deposit',
              paymentConfirmed: true
            });
            io.to(`user_${contract.landlordId._id}`).emit('rentalPaymentStatusUpdated', {
              contractId: contract._id,
              paymentId: payment.paymentId,
              paymentType: 'security_deposit',
              paymentConfirmed: true
            });
          }
        }
      } catch (rentalError) {
        console.error('Error handling rental security deposit payment:', rentalError);
        // Don't fail the payment verification if rental update fails
      }
    }

    // Handle Monthly Rent Payment (Razorpay)
    // This logic was missing previously, causing Razorpay rent payments to stick in 'processing'
    let contractId = payment.contractId;
    if (!contractId && payment.metadata) {
      // Fallback: extract from metadata
      contractId = payment.metadata instanceof Map ? payment.metadata.get('contractId') : payment.metadata.contractId;
    }

    if (payment.paymentType === 'monthly_rent' && contractId) {
      try {
        const RentLockContract = (await import('../models/rentLockContract.model.js')).default;
        const RentWallet = (await import('../models/rentWallet.model.js')).default;

        // 1. Try to get wallet directly from payment (safest) or via contract
        let wallet;
        if (payment.walletId) {
          wallet = await RentWallet.findById(payment.walletId);
        }

        // 2. Fallback: Get contract then wallet
        if (!wallet) {
          // Find contract if not already found (contractId available)
          const contract = await RentLockContract.findById(contractId);
          if (contract) {
            wallet = await RentWallet.findOne({ contractId: contract._id });
          }
        }

        if (wallet) {
          // Find schedule entry using multiple strategies
          const getMeta = (key) => payment.metadata instanceof Map ? payment.metadata.get(key) : (payment.metadata ? payment.metadata[key] : undefined);

          const targetMonth = Number(payment.rentMonth || getMeta('month'));
          const targetYear = Number(payment.rentYear || getMeta('year'));
          const pIdString = payment._id.toString();

          // Strategy 1: Match by exact Payment ID
          let scheduleEntry = wallet.paymentSchedule.find(p => p.paymentId && p.paymentId.toString() === pIdString);

          // Strategy 2: Match by Month & Year
          if (!scheduleEntry) {
            scheduleEntry = wallet.paymentSchedule.find(p => Number(p.month) === targetMonth && Number(p.year) === targetYear);
          }

          if (scheduleEntry) {
            scheduleEntry.status = 'completed';
            scheduleEntry.paidAt = new Date();
            scheduleEntry.paymentId = payment._id;

            const originalAmount = getMeta('originalAmount');
            const amountToCredit = originalAmount ? Number(originalAmount) : payment.amount;

            wallet.totalPaid = (wallet.totalPaid || 0) + amountToCredit;
            wallet.totalDue = Math.max(0, (wallet.totalDue || 0) - amountToCredit);

            wallet.markModified('paymentSchedule');
            await wallet.save();
            console.log(`✅ [Razorpay] Rent Wallet Updated: ${targetMonth}/${targetYear} -> Completed`);
          } else {
            console.warn(`⚠️ [Razorpay] Schedule entry not found for ${targetMonth}/${targetYear} in wallet ${wallet._id}`);
          }
        }

        // Fetch contract for notifications
        const notificationContract = await RentLockContract.findById(contractId)
          .populate('listingId', 'name address')
          .populate('tenantId', 'username email')
          .populate('landlordId', 'username email');

        if (notificationContract) {
          const contract = notificationContract;
          const listing = contract.listingId;
          const clientUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
          const walletUrl = `${clientUrl}/user/rent-wallet?contractId=${contract._id}`;
          const receiptUrl = payment.receiptUrl || `${clientUrl}/api/payments/${payment.paymentId}/receipt`;
          const io = req.app.get('io');

          // Generate PDF Receipt Buffer
          let receiptBuffer = null;
          try {
            receiptBuffer = await generateReceiptPdf(payment);
          } catch (pdfError) {
            console.error("Failed to generate PDF for email attachment:", pdfError);
          }

          // Notify tenant
          await sendRentalNotification({
            userId: contract.tenantId._id,
            type: 'rent_payment_received',
            title: 'Rent Payment Received',
            message: `Your rent payment of ₹${payment.amount} for ${listing.name} (${payment.rentMonth}/${payment.rentYear}) has been received.`,
            meta: {
              contractId: contract._id,
              listingId: listing._id,
              paymentId: payment.paymentId,
              amount: payment.amount,
              rentMonth: payment.rentMonth,
              rentYear: payment.rentYear
            },
            actionUrl: walletUrl,
            io
          });

          // Send email to tenant
          try {
            await sendRentPaymentReceivedEmail(contract.tenantId.email, {
              paymentId: payment.paymentId,
              amount: payment.amount,
              propertyName: listing.name,
              rentMonth: payment.rentMonth,
              rentYear: payment.rentYear,
              receiptUrl: receiptUrl,
              contractId: contract._id,
              walletUrl: walletUrl,
              receiptBuffer,
              paymentMethod: payment.gateway,
              transactionDate: payment.completedAt || new Date()
            });
          } catch (emailError) {
            console.error('Error sending rent payment received email:', emailError);
          }

          // Notify landlord
          await sendRentalNotification({
            userId: contract.landlordId._id,
            type: 'rent_payment_received',
            title: 'Rent Payment Received from Tenant',
            message: `A rent payment of ₹${payment.amount} for ${listing.name} (${payment.rentMonth}/${payment.rentYear}) has been received.`,
            meta: {
              contractId: contract._id,
              listingId: listing._id,
              paymentId: payment.paymentId,
              amount: payment.amount,
              rentMonth: payment.rentMonth,
              rentYear: payment.rentYear
            },
            actionUrl: walletUrl,
            io
          });

          // Send email to landlord
          try {
            await sendRentPaymentReceivedToLandlordEmail(contract.landlordId.email, {
              paymentId: payment.paymentId,
              amount: payment.amount,
              propertyName: listing.name,
              rentMonth: payment.rentMonth,
              rentYear: payment.rentYear,
              tenantName: contract.tenantId.username,
              contractId: contract._id,
              walletUrl,
              receiptBuffer,
              paymentMethod: payment.gateway,
              transactionDate: payment.completedAt || new Date()
            });
          } catch (emailError) {
            console.error('Error sending rent payment received email to landlord:', emailError);
          }
        }
      } catch (rentalError) {
        console.error('Error handling [Razorpay] monthly rent payment notifications:', rentalError);
      }
    }

    // Emit socket event for real-time payment status update
    const io = req.app.get('io');
    if (io) {
      io.emit('paymentStatusUpdated', {
        appointmentId: payment.appointmentId,
        paymentId: payment.paymentId,
        contractId: payment.contractId,
        paymentConfirmed: true
      });
      io.to(`user_${user._id}`).emit('paymentStatusUpdated', {
        appointmentId: payment.appointmentId,
        paymentId: payment.paymentId,
        contractId: payment.contractId,
        paymentConfirmed: true
      });
    }

    // Send rental payment notifications if this is a monthly rent payment
    if (payment.paymentType === 'monthly_rent' && payment.contractId) {
      try {
        // --- Award SetuCoins Reward ---
        const CoinService = (await import('../services/coinService.js')).default;
        let earnedCoins = 0;
        // Standardize Earning Rates: INR 1000 = 1 Coin | USD 12 = 1 Coin
        if (payment.currency === 'USD') {
          earnedCoins = Math.floor(payment.amount / 12);
        } else {
          // Default to INR (payment.currency === 'INR' or undefined)
          earnedCoins = Math.floor(payment.amount / 1000);
        }

        if (earnedCoins > 0) {
          try {
            await CoinService.credit({
              userId: payment.userId,
              amount: earnedCoins,
              source: 'rent_payment',
              description: `Reward for rent payment (${payment.rentMonth}/${payment.rentYear})`,
              referenceId: payment._id,
              referenceModel: 'Payment'
            });
            // Update Streak
            await CoinService.updateRentStreak(payment.userId, payment.completedAt || new Date());
            console.log(`✅ Awarded ${earnedCoins} SetuCoins to user ${payment.userId}`);
          } catch (coinError) {
            console.error("Error crediting SetuCoins:", coinError);
          }
        }
        // ------------------------------

        const RentLockContract = (await import('../models/rentLockContract.model.js')).default;
        const contract = await RentLockContract.findById(payment.contractId)
          .populate('listingId', 'name address')
          .populate('tenantId', 'username email')
          .populate('landlordId', 'username email');

        if (contract) {
          const listing = contract.listingId;
          const clientUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
          const walletUrl = `${clientUrl}/user/rent-wallet?contractId=${contract._id}`;
          const receiptUrl = payment.receiptUrl || `${clientUrl}/api/payments/${payment.paymentId}/receipt`;

          // Generate PDF Receipt Buffer
          let receiptBuffer = null;
          try {
            receiptBuffer = await generateReceiptPdf(payment);
          } catch (pdfError) {
            console.error("Failed to generate PDF for email attachment:", pdfError);
          }

          // Notify tenant
          await sendRentalNotification({
            userId: contract.tenantId._id,
            type: 'rent_payment_received',
            title: 'Rent Payment Received',
            message: `Your rent payment of ₹${payment.amount} for ${listing.name} (${payment.rentMonth}/${payment.rentYear}) has been received and is being held in escrow.`,
            meta: {
              contractId: contract._id,
              listingId: listing._id,
              paymentId: payment.paymentId,
              amount: payment.amount,
              rentMonth: payment.rentMonth,
              rentYear: payment.rentYear
            },
            actionUrl: walletUrl,
            io
          });

          // Send email to tenant
          try {
            await sendRentPaymentReceivedEmail(contract.tenantId.email, {
              paymentId: payment.paymentId,
              amount: payment.amount,
              propertyName: listing.name,
              rentMonth: payment.rentMonth,
              rentYear: payment.rentYear,
              dueDate: payment.rentMonth && payment.rentYear ? new Date(payment.rentYear, payment.rentMonth - 1, 1) : null,
              receiptUrl,
              contractId: contract._id,
              walletUrl,
              // Pass the buffer to the service
              receiptBuffer,
              paymentMethod: payment.gateway,
              transactionDate: payment.completedAt || new Date()
            });
            console.log(`✅ Rent payment received email sent to tenant ${contract.tenantId.email}`);
          } catch (emailError) {
            console.error('Error sending rent payment received email to tenant:', emailError);
          }

          // Notify landlord
          await sendRentalNotification({
            userId: contract.landlordId._id,
            type: 'rent_payment_received',
            title: 'Rent Payment Received from Tenant',
            message: `A rent payment of ₹${payment.amount} for ${listing.name} (${payment.rentMonth}/${payment.rentYear}) has been received from ${contract.tenantId.username} and is being held in escrow. It will be released after 3 days.`,
            meta: {
              contractId: contract._id,
              listingId: listing._id,
              paymentId: payment.paymentId,
              amount: payment.amount,
              rentMonth: payment.rentMonth,
              rentYear: payment.rentYear,
              tenantId: contract.tenantId._id
            },
            actionUrl: walletUrl,
            io
          });

          // Send email to landlord
          try {
            await sendRentPaymentReceivedToLandlordEmail(contract.landlordId.email, {
              paymentId: payment.paymentId,
              amount: payment.amount,
              propertyName: listing.name,
              rentMonth: payment.rentMonth,
              rentYear: payment.rentYear,
              tenantName: contract.tenantId.username,
              contractId: contract._id,
              walletUrl,
              // Pass the buffer to the service
              receiptBuffer,
              paymentMethod: payment.gateway,
              transactionDate: payment.completedAt || new Date()
            });
            console.log(`✅ Rent payment received email sent to landlord ${contract.landlordId.email}`);
          } catch (emailError) {
            console.error('Error sending rent payment received email to landlord:', emailError);
          }
        }
      } catch (notifError) {
        console.error('Error sending rental payment notifications:', notifError);
      }
    }

    // Handle loan EMI payment
    if (payment.paymentType === 'emi' && payment.emiDetails && payment.emiDetails.loanId) {
      try {
        const RentalLoan = (await import('../models/rentalLoan.model.js')).default;
        const loan = await RentalLoan.findOne({ loanId: payment.emiDetails.loanId })
          .populate('userId', 'email username')
          .populate('contractId', 'listingId')
          .populate({
            path: 'contractId',
            populate: { path: 'listingId', select: 'name address' }
          });

        if (loan) {
          // Update EMI schedule status
          let emiToUpdate;
          const { month, year } = payment.emiDetails;

          if (month && year) {
            emiToUpdate = loan.emiSchedule.find(e => e.month === month && e.year === year);
          } else {
            // Fallback: find first pending/overdue EMI
            emiToUpdate = loan.emiSchedule.find(e => e.status === 'pending' || e.status === 'overdue' || e.status === 'processing');
          }

          if (emiToUpdate) {
            emiToUpdate.status = 'completed';
            emiToUpdate.paidAt = new Date();
            emiToUpdate.paymentId = payment._id;

            // Update totals: Only count the base EMI towards paying off the loan
            // Penalties do not reduce the principal/interest balance of the loan itself
            const baseEmiContribution = loan.emiAmount;
            loan.totalPaid = (loan.totalPaid || 0) + baseEmiContribution;
            loan.totalRemaining = Math.max(0, (loan.totalRemaining || loan.loanAmount) - baseEmiContribution);

            // Check if fully repaid
            const totalScheduled = loan.emiSchedule.reduce((sum, e) => sum + loan.emiAmount, 0);

            // Send success email
            try {
              const { sendLoanEMIPaymentSuccessEmail } = await import('../utils/emailService.js');
              await sendLoanEMIPaymentSuccessEmail(loan.userId.email, {
                propertyName: loan.contractId?.listingId?.name || 'Property',
                loanType: loan.loanType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                amount: payment.amount,
                baseAmount: loan.emiAmount,
                penaltyAmount: (payment.emiDetails.originalAmount || 0) - loan.emiAmount,
                discountApplied: payment.emiDetails.discountApplied || 0,
                paymentId: payment.paymentId,
                emiMonth: emiToUpdate.month,
                emiYear: emiToUpdate.year,
                remainingBalance: loan.totalRemaining,
                loanUrl: `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/rental-loans?loanId=${loan.loanId}`
              });
              console.log(`✅ Loan EMI success email sent to ${loan.userId.email}`);
            } catch (emailError) {
              console.error('Error sending loan EMI success email:', emailError);
            }

            // Check for full repayment
            if (loan.totalPaid >= totalScheduled - 10 || loan.totalRemaining <= 10) {
              loan.status = 'repaid';
              loan.repaidAt = new Date();

              // Send Loan Repaid Email
              try {
                const { sendLoanRepaidEmail } = await import('../utils/emailService.js');
                await sendLoanRepaidEmail(loan.userId.email, {
                  propertyName: loan.contractId?.listingId?.name || 'Property',
                  loanType: loan.loanType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                  totalPaid: loan.totalPaid,
                  repaidAt: new Date().toLocaleDateString(),
                  loanUrl: `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/rental-loans?loanId=${loan.loanId}`
                });
                console.log(`✅ Loan repaid email sent (Final) to ${loan.userId.email}`);
              } catch (emailError) {
                console.error('Error sending loan repaid email:', emailError);
              }
            }

            await loan.save();
            console.log(`✅ [Razorpay] Loan EMI Wallet Updated for loan ${loan.loanId}`);
          }
        }
      } catch (loanError) {
        console.error('Error handling loan EMI payment verification:', loanError);
      }
    }

    // DELAYED SAVE: Finally save the payment as completed
    await payment.save();

    // Handle Service/Movers Booking Success
    if (payment.paymentType === 'service_booking' || payment.paymentType === 'movers_booking') {
      const requestId = payment.metadata?.requestId;
      const type = payment.metadata?.requestType;
      if (requestId) {
        // Update Request Doc
        const ServiceRequest = (await import('../models/serviceRequest.model.js')).default;
        const MoversRequest = (await import('../models/moversRequest.model.js')).default;
        const Model = type === 'movers' ? MoversRequest : ServiceRequest;

        await Model.findByIdAndUpdate(requestId, {
          paymentStatus: 'paid',
          paymentId: payment.paymentId,
          status: 'pending' // Confirm it's active now
        });
      }
    }

    // --- SetuCoins Consistency: Reward general payments > 1000 INR / $12 ---
    if (payment.paymentType !== 'monthly_rent') {
      try {
        const CoinService = (await import('../services/coinService.js')).default;
        let earnedCoins = 0;
        if (payment.currency === 'USD') {
          earnedCoins = Math.floor(payment.amount / 12);
        } else {
          earnedCoins = Math.floor(payment.amount / 1000);
        }

        if (earnedCoins > 0) {
          await CoinService.credit({
            userId: payment.userId,
            amount: earnedCoins,
            source: 'payment_reward',
            description: `Reward for ${payment.paymentType.replace('_', ' ')} (${payment.paymentId})`,
            referenceId: payment._id,
            referenceModel: 'Payment'
          });
          console.log(`🪙 [Razorpay] Credited ${earnedCoins} SetuCoins for general payment ${payment.paymentId}`);
        }
      } catch (coinError) {
        console.error('Error processing SetuCoins for general payment:', coinError);
      }

      // Send payment success email to buyer (reusing existing appointment, user, listing variables)
      try {
        await sendPaymentSuccessEmail(user.email, {
          paymentId: payment.paymentId,
          amount: payment.amount,
          currency: payment.currency,
          propertyName: listing.name,
          appointmentDate: appointment.date ? new Date(appointment.date).toLocaleDateString() : 'N/A',
          receiptUrl: receiptUrl,
          paymentType: payment.paymentType,
          gateway: payment.gateway
        });
        console.log(`✅ Payment success email sent to buyer: ${user.email}`);
      } catch (emailError) {
        console.error('Error sending payment success email:', emailError);
      }

      // Send payment notification email to seller
      try {
        // Get seller details
        await appointment.populate('sellerId', 'email username firstName lastName');
        const seller = appointment.sellerId;

        await sendSellerPaymentNotificationEmail(seller.email, {
          appointmentId: appointment._id,
          propertyName: listing.name,
          propertyDescription: listing.description,
          propertyAddress: listing.address,
          propertyPrice: listing.regularPrice || listing.discountPrice,
          propertyImages: listing.imageUrls || [],
          date: appointment.date,
          time: appointment.time,
          buyerName: user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.username,
          paymentAmount: payment.amount,
          paymentCurrency: payment.currency,
          paymentGateway: payment.gateway,
          listingId: listing._id
        });
        console.log(`✅ Seller payment notification email sent to: ${seller.email}`);
      } catch (sellerEmailError) {
        console.error('Error sending seller payment notification email:', sellerEmailError);
      }
    }

    return res.json({ message: 'Payment verified successfully', payment, receiptUrl });
  } catch (err) {
    console.error('Razorpay verify error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST: Create service request payment intent
router.post("/service-request", verifyToken, async (req, res) => {
  try {
    const { requestId, type, gateway } = req.body; // type: 'service' or 'movers'
    const userId = req.user.id;

    // Import models dynamically
    const ServiceRequest = (await import('../models/serviceRequest.model.js')).default;
    const MoversRequest = (await import('../models/moversRequest.model.js')).default;

    let requestDoc;
    let description;

    if (type === 'movers') {
      requestDoc = await MoversRequest.findById(requestId);
      description = 'Movers Request Booking Fee';
    } else {
      requestDoc = await ServiceRequest.findById(requestId);
      description = 'Service Request Booking Fee';
    }

    if (!requestDoc) {
      return res.status(404).json({ message: "Request not found." });
    }

    if (requestDoc.userId.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    // Determine Amount
    // Standard Base Fees
    let baseFee = 149; // Service
    if (type === 'movers') baseFee = 499;

    // Apply allowed discount
    let discount = requestDoc.discountApplied || 0;
    let amount = Math.max(1, baseFee - discount); // Ensure at least 1 INR

    // Update doc's amount if not set
    if (!requestDoc.amount || requestDoc.amount === 0) {
      requestDoc.amount = amount;
      await requestDoc.save();
    } else {
      // If already set (e.g. retry), use it
      amount = requestDoc.amount;
    }

    const { keyId, authHeader } = getRazorpayAuthHeader();
    const currency = 'INR';

    // Create Razorpay Order
    const razorpayResponse = await fetch(`https://api.razorpay.com/v1/orders`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // paise
        currency,
        receipt: generateReceiptNumber(),
        notes: {
          requestId: requestDoc._id.toString(),
          type: type === 'movers' ? 'movers_request' : 'service_request'
        }
      })
    });

    const orderData = await razorpayResponse.json();
    if (!razorpayResponse.ok) {
      // Fallback for demo/test mode if keys invalid
      console.error("Razorpay Error:", orderData);
      throw new Error(orderData.error?.description || 'Razorpay order creation failed');
    }

    // Create Payment Record
    const payment = new Payment({
      paymentId: generatePaymentId(),
      userId,
      amount: amount,
      currency,
      status: 'pending',
      gateway: 'razorpay',
      paymentType: type === 'movers' ? 'movers_booking' : 'service_booking',
      metadata: {
        requestId: requestDoc._id,
        requestType: type,
        originalAmount: baseFee,
        discount: discount
      }
    });
    await payment.save();

    res.json({
      payment: {
        ...payment.toObject(),
        orderId: orderData.id,
      },
      razorpay: {
        orderId: orderData.id,
        amount: orderData.amount,
        currency: orderData.currency,
        keyId
      }
    });

  } catch (err) {
    console.error("Error creating service payment intent:", err);
    res.status(500).json({ message: "Server error creating payment." });
  }
});

// POST: Create monthly rent payment (with escrow)
router.post("/monthly-rent", verifyToken, async (req, res) => {
  try {
    const { contractId, walletId, scheduleIndex, amount, month, year, isAutoDebit, gateway, coinsToRedeem } = req.body;
    const userId = req.user.id;

    // Import required models
    const RentWallet = (await import('../models/rentWallet.model.js')).default;
    const RentLockContract = (await import('../models/rentLockContract.model.js')).default;
    const Booking = (await import('../models/booking.model.js')).default;
    const CoinService = (await import('../services/coinService.js')).default;

    // Verify contract and wallet
    const contract = await RentLockContract.findById(contractId)
      .populate('listingId', 'name')
      .populate('tenantId', 'email username')
      .populate('landlordId', 'email username');

    if (!contract) {
      return res.status(404).json({ message: "Contract not found." });
    }

    if (contract.tenantId._id.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized. Only tenant can pay rent." });
    }

    if (contract.status !== 'active') {
      return res.status(400).json({ message: "Contract is not active." });
    }

    const wallet = await RentWallet.findOne({ contractId: contract._id, userId });
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found." });
    }

    // Find the payment schedule entry
    const scheduleEntry = wallet.paymentSchedule.find((p, idx) =>
      idx === scheduleIndex || (p.month === month && p.year === year)
    );

    if (!scheduleEntry) {
      return res.status(404).json({ message: "Payment schedule entry not found." });
    }

    if (scheduleEntry.status === 'completed') {
      return res.status(400).json({ message: "Payment already completed." });
    }

    // Get booking
    const booking = await Booking.findById(contract.bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    // Calculate total amount (rent + maintenance + penalty) in INR (Base currency)
    let baseAmountInr = amount + (scheduleEntry.penaltyAmount || 0) + (contract.maintenanceCharges || 0);

    // --- SetuCoins Redemption Logic ---
    let coinDiscount = 0;
    let redeemedCoins = 0;

    if (coinsToRedeem && coinsToRedeem > 0) {
      try {
        const balanceData = await CoinService.getBalance(userId);
        if (balanceData.setuCoinsBalance < coinsToRedeem) {
          return res.status(400).json({ message: "Insufficient SetuCoins balance." });
        }

        // Calculate discount: 10 Coins = ₹1
        const discountValue = Math.floor(coinsToRedeem / 10);

        // Ensure discount doesn't exceed total amount
        if (discountValue > baseAmountInr) {
          return res.status(400).json({ message: "Redemption amount cannot exceed payment total." });
        }

        // Deduct coins immediately
        await CoinService.debit({
          userId,
          amount: coinsToRedeem,
          source: 'redemption_rent_fee',
          description: `Redeemed for rent payment (${month}/${year})`,
          referenceModel: 'Payment'
          // Note: referenceId will be updated to Payment ID after creation if possible, or left null/generic
        });

        coinDiscount = discountValue;
        redeemedCoins = coinsToRedeem;
        baseAmountInr -= coinDiscount;

      } catch (coinError) {
        console.error("Error processing coin redemption:", coinError);
        return res.status(500).json({ message: "Failed to apply SetuCoins. Please try again." });
      }
    }
    // ----------------------------------

    // Determine gateway and currency
    let finalGateway = gateway === 'paypal' ? 'paypal' : 'razorpay';
    // If auto-debit, override with wallet setting if available
    if (isAutoDebit && wallet.autoDebitMethod) {
      finalGateway = wallet.autoDebitMethod;
    }

    let finalAmount = baseAmountInr;
    let finalCurrency = 'INR';

    if (finalGateway === 'paypal') {
      // Convert to USD (approximate rate 84)
      // Minimum PayPal amount is usually 0.01, but we use 1 as safe floor
      finalAmount = Math.max(1, Math.round((baseAmountInr / 84) * 100) / 100);
      finalCurrency = 'USD';
    }

    // Create payment with escrow
    const payment = new Payment({
      paymentId: generatePaymentId(),
      appointmentId: booking._id,
      userId,
      listingId: contract.listingId._id,
      contractId: contract._id,
      walletId: wallet._id,
      amount: finalAmount,
      currency: finalCurrency,
      penaltyAmount: scheduleEntry.penaltyAmount || 0,
      paymentType: 'monthly_rent',
      gateway: finalGateway,
      status: 'pending',
      receiptNumber: generateReceiptNumber(),
      isAutoDebit: isAutoDebit || false,
      escrowStatus: 'pending', // Start in escrow
      rentMonth: month || scheduleEntry.month,
      rentYear: year || scheduleEntry.year,
      contractId: contract._id, // Required for verify endpoint
      walletId: wallet._id, // Helpful link
      metadata: {
        month: month || scheduleEntry.month,
        year: year || scheduleEntry.year,
        rentType: 'monthly',
        contractId: contract._id.toString(),
        walletId: wallet._id.toString(),
        originalAmount: baseAmountInr + coinDiscount, // Store original pre-discount INR amount
        originalCurrency: 'INR',
        coinsRedeemed: redeemedCoins,
        coinDiscount: coinDiscount
      }
    });

    await payment.save();

    // Retroactively update transaction reference if coins were redeemed
    if (redeemedCoins > 0) {
      // Implementation note: Ideally we'd do this in the debit call if we had the ID, 
      // or update it here. For now, it's okay without valid referenceId or we can update it:
      // await CoinTransaction.updateOne({ ... }, { referenceId: payment._id });
      // Keeping it simple for MVP.
    }

    // Generate Razorpay Order if gateway is razorpay
    let razorpayData = null;
    if (finalGateway === 'razorpay') {
      try {
        const { keyId, authHeader } = getRazorpayAuthHeader();
        const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            amount: Math.round(finalAmount * 100), // Amount in paise
            currency: 'INR',
            receipt: payment.receiptNumber,
            payment_capture: 1,
            notes: {
              appointmentId: String(booking._id),
              paymentId: payment.paymentId,
              contractId: String(contract._id)
            }
          })
        });

        const orderText = await orderRes.text();
        let order;
        try { order = JSON.parse(orderText); } catch (e) {
          console.error('Razorpay create-order non-JSON:', orderText);
          throw new Error('Invalid response from Razorpay');
        }

        if (!orderRes.ok) {
          console.error('Razorpay create-order error:', order);
          throw new Error(order.error?.description || 'Error creating Razorpay order');
        }

        payment.gatewayOrderId = order.id;
        await payment.save();

        razorpayData = {
          orderId: order.id,
          amount: Math.round(finalAmount * 100),
          currency: 'INR',
          keyId
        };
      } catch (rzpError) {
        console.error('Error creating Razorpay order for monthly rent:', rzpError);
        // We don't fail the whole request, but frontend will likely fail to load payment
      }
    }

    // Update wallet payment schedule status
    scheduleEntry.status = 'processing';
    scheduleEntry.paymentId = payment._id;
    await wallet.save();

    res.status(201).json({
      success: true,
      message: "Monthly rent payment created (held in escrow)",
      payment: payment,
      ...(razorpayData && { razorpay: razorpayData }),
      ...(finalGateway === 'paypal' && { paypal: { amount: finalAmount, currency: finalCurrency } })
    });
  } catch (err) {
    console.error("Error creating monthly rent payment:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST: Create loan EMI payment
router.post("/loan-emi", verifyToken, async (req, res) => {
  try {
    const { loanId, emiIndex, amount, gateway, coinsToRedeem } = req.body;
    const userId = req.user.id;

    // Import required models
    const RentalLoan = (await import('../models/rentalLoan.model.js')).default;
    const Booking = (await import('../models/booking.model.js')).default;
    const CoinService = (await import('../services/coinService.js')).default;

    // Verify loan
    const loan = await RentalLoan.findById(loanId)
      .populate('userId', 'email username')
      .populate('contractId');

    if (!loan) {
      return res.status(404).json({ message: "Rental loan not found." });
    }

    // Check if loan belongs to user
    if (loan.userId._id.toString() !== userId && req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return res.status(403).json({ message: "Unauthorized." });
    }

    if (!['disbursed', 'approved', 'pending'].includes(loan.status)) {
      // Note: 'pending' added just in case, but usually it should be approved/disbursed
      return res.status(400).json({ message: `Loan is not in a payable status. Current status: ${loan.status}` });
    }

    // Find the EMI schedule entry
    const emiEntry = loan.emiSchedule[emiIndex];

    if (!emiEntry) {
      return res.status(404).json({ message: "EMI schedule entry not found." });
    }

    if (emiEntry.status === 'completed') {
      return res.status(400).json({ message: "EMI already paid." });
    }

    // Get booking (associated with the contract)
    const booking = await Booking.findById(loan.contractId.bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Contract booking not found." });
    }

    // Calculate total amount in INR
    let baseAmountInr = amount + (emiEntry.penaltyAmount || 0);

    // --- SetuCoins Redemption Logic ---
    let coinDiscount = 0;
    let redeemedCoins = 0;

    if (coinsToRedeem && coinsToRedeem > 0) {
      try {
        const balanceData = await CoinService.getBalance(userId);
        if (balanceData.setuCoinsBalance < coinsToRedeem) {
          return res.status(400).json({ message: "Insufficient SetuCoins balance." });
        }

        // Calculate discount: 10 Coins = ₹1
        const discountValue = Math.floor(coinsToRedeem / 10);

        // Cap discount at 50% of base amount or actual discount value
        coinDiscount = Math.min(discountValue, Math.floor(baseAmountInr * 0.5));

        // Recalculate redeemed coins based on applied discount (if capped)
        redeemedCoins = coinDiscount * 10;

        if (redeemedCoins > 0) {
          await CoinService.debit({
            userId,
            amount: redeemedCoins,
            source: 'loan_emi_discount',
            description: `Discount applied to Loan EMI (${emiEntry.month}/${emiEntry.year})`
          });
          console.log(`🪙 Redeemed ${redeemedCoins} SetuCoins for ₹${coinDiscount} discount on EMI`);
        }
      } catch (coinError) {
        console.error("Error applying SetuCoins discount:", coinError);
      }
    }

    const finalAmountInr = Math.max(0, baseAmountInr - coinDiscount);

    // Use specific gateway or default to appointment region
    const finalGateway = gateway || (booking.region === 'india' ? 'razorpay' : 'paypal');
    const finalCurrency = finalGateway === 'razorpay' ? 'INR' : 'USD';
    const finalAmount = finalGateway === 'razorpay' ? finalAmountInr : Math.round((finalAmountInr / 83) * 100) / 100;

    const payment = new Payment({
      paymentId: "EMI-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9).toUpperCase(),
      receiptNumber: "REC-EMI-" + Date.now(),
      userId,
      appointmentId: booking._id,
      listingId: loan.contractId.listingId,
      contractId: loan.contractId._id,
      amount: finalAmount,
      currency: finalCurrency,
      status: 'pending',
      paymentType: 'emi',
      gateway: finalGateway,
      emiDetails: {
        loanId: loan.loanId,
        month: emiEntry.month,
        year: emiEntry.year,
        emiIndex: emiIndex,
        originalAmount: baseAmountInr,
        discountApplied: coinDiscount,
        coinsRedeemed: redeemedCoins
      },
      metadata: {
        loanId: String(loan._id),
        emiIndex: emiIndex,
        month: emiEntry.month,
        year: emiEntry.year,
        originalAmount: baseAmountInr
      }
    });

    await payment.save();

    let razorpayData = null;
    if (finalGateway === 'razorpay') {
      try {
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: Math.round(finalAmount * 100), // Amount in paise
            currency: 'INR',
            receipt: payment.receiptNumber,
            payment_capture: 1,
            notes: {
              appointmentId: String(booking._id),
              paymentId: payment.paymentId,
              loanId: String(loan._id)
            }
          })
        });

        const orderText = await orderRes.text();
        let order;
        try { order = JSON.parse(orderText); } catch (e) {
          console.error('Razorpay create-order non-JSON:', orderText);
          throw new Error('Invalid response from Razorpay');
        }

        if (!orderRes.ok) {
          console.error('Razorpay create-order error:', order);
          throw new Error(order.error?.description || 'Error creating Razorpay order');
        }

        payment.gatewayOrderId = order.id;
        await payment.save();

        razorpayData = {
          orderId: order.id,
          amount: Math.round(finalAmount * 100),
          currency: 'INR',
          keyId
        };
      } catch (rzpError) {
        console.error('Error creating Razorpay order for loan EMI:', rzpError);
      }
    }

    // Update EMI status to processing
    emiEntry.status = 'processing';
    emiEntry.paymentId = payment._id;
    await loan.save();

    res.status(201).json({
      success: true,
      message: "Loan EMI payment initialized",
      payment: payment,
      ...(razorpayData && { razorpay: razorpayData }),
      ...(finalGateway === 'paypal' && { paypal: { amount: finalAmount, currency: finalCurrency } })
    });
  } catch (err) {
    console.error("Error creating loan EMI payment:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST: Release escrow payment to landlord (automatically after 3 days or manual)
router.post("/monthly-rent/release-escrow", verifyToken, async (req, res) => {
  try {
    const { paymentId, autoRelease } = req.body;
    const userId = req.user.id;

    // Import required models
    const RentLockContract = (await import('../models/rentLockContract.model.js')).default;
    const RentWallet = (await import('../models/rentWallet.model.js')).default;

    const payment = await Payment.findOne({ paymentId, paymentType: 'monthly_rent' })
      .populate('contractId');

    if (!payment) {
      return res.status(404).json({ message: "Payment not found." });
    }

    // Check escrow status
    if (payment.escrowStatus === 'released') {
      return res.status(400).json({ message: "Payment already released." });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({ message: "Payment not completed yet." });
    }

    // Verify user is landlord or admin (or auto-release after 3 days)
    const contract = await RentLockContract.findById(payment.contractId);
    if (!contract) {
      return res.status(404).json({ message: "Contract not found." });
    }

    if (!autoRelease) {
      // Manual release - verify user is landlord
      if (contract.landlordId.toString() !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized. Only landlord or admin can release escrow." });
      }
    } else {
      // Auto-release after 3 days - check if 3 days have passed
      const daysSincePayment = (Date.now() - new Date(payment.completedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePayment < 3) {
        return res.status(400).json({ message: "Auto-release only available after 3 days." });
      }
    }

    // Release escrow
    payment.escrowStatus = 'released';
    payment.escrowReleasedAt = new Date();
    await payment.save();

    // Update wallet
    const wallet = await RentWallet.findById(payment.walletId);
    if (wallet) {
      const scheduleEntry = wallet.paymentSchedule.find(
        p => p.paymentId && p.paymentId.toString() === payment._id.toString()
      );
      if (scheduleEntry) {
        scheduleEntry.status = 'completed';
        scheduleEntry.paidAt = new Date();
      }
      wallet.totalPaid = (wallet.totalPaid || 0) + payment.amount;
      wallet.totalDue = Math.max(0, (wallet.totalDue || 0) - payment.amount);
      await wallet.save();
    }

    // Update contract
    contract.lastPaymentDate = new Date();
    await contract.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('escrowReleased', {
        paymentId: payment.paymentId,
        contractId: contract._id,
        amount: payment.amount
      });
    }

    // Send notifications for escrow release
    if (io) {
      const contractPopulated = await RentLockContract.findById(contract._id)
        .populate('listingId', 'name address')
        .populate('tenantId', 'username email')
        .populate('landlordId', 'username email');

      if (contractPopulated) {
        const listing = contractPopulated.listingId;

        const clientUrl = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
        const walletUrl = `${clientUrl}/user/rent-wallet?contractId=${contract._id}`;

        // Notify landlord
        await sendRentalNotification({
          userId: contractPopulated.landlordId._id,
          type: 'rent_escrow_released',
          title: 'Rent Payment Released from Escrow',
          message: `Your rent payment of ₹${payment.amount} for ${listing.name} (${payment.rentMonth}/${payment.rentYear}) has been released from escrow and transferred to your account.`,
          meta: {
            contractId: contract._id,
            listingId: listing._id,
            paymentId: payment.paymentId,
            amount: payment.amount,
            rentMonth: payment.rentMonth,
            rentYear: payment.rentYear
          },
          actionUrl: walletUrl,
          io
        });

        // Send email to landlord
        try {
          await sendEscrowReleasedEmail(contractPopulated.landlordId.email, {
            paymentId: payment.paymentId,
            amount: payment.amount,
            propertyName: listing.name,
            rentMonth: payment.rentMonth,
            rentYear: payment.rentYear,
            userRole: 'landlord',
            tenantName: contractPopulated.tenantId.username,
            landlordName: contractPopulated.landlordId.username,
            contractId: contract._id,
            walletUrl
          });
          console.log(`✅ Escrow released email sent to landlord ${contractPopulated.landlordId.email}`);
        } catch (emailError) {
          console.error('Error sending escrow released email to landlord:', emailError);
        }

        // Notify tenant
        await sendRentalNotification({
          userId: contractPopulated.tenantId._id,
          type: 'rent_escrow_released',
          title: 'Rent Payment Released to Landlord',
          message: `Your rent payment of ₹${payment.amount} for ${listing.name} (${payment.rentMonth}/${payment.rentYear}) has been released from escrow to the landlord.`,
          meta: {
            contractId: contract._id,
            listingId: listing._id,
            paymentId: payment.paymentId,
            amount: payment.amount,
            rentMonth: payment.rentMonth,
            rentYear: payment.rentYear
          },
          actionUrl: walletUrl,
          io
        });

        // Send email to tenant
        try {
          await sendEscrowReleasedEmail(contractPopulated.tenantId.email, {
            paymentId: payment.paymentId,
            amount: payment.amount,
            propertyName: listing.name,
            rentMonth: payment.rentMonth,
            rentYear: payment.rentYear,
            userRole: 'tenant',
            tenantName: contractPopulated.tenantId.username,
            landlordName: contractPopulated.landlordId.username,
            contractId: contract._id,
            walletUrl
          });
          console.log(`✅ Escrow released email sent to tenant ${contractPopulated.tenantId.email}`);
        } catch (emailError) {
          console.error('Error sending escrow released email to tenant:', emailError);
        }
      }
    }

    res.json({
      success: true,
      message: "Escrow payment released to landlord",
      payment
    });
  } catch (err) {
    console.error("Error releasing escrow:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST: Create split payment (for shared PG/flatmates)
router.post("/split-payment", verifyToken, async (req, res) => {
  try {
    const { appointmentId, totalAmount, splitDetails } = req.body;
    const userId = req.user.id;

    const appointment = await Booking.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    const payment = new Payment({
      paymentId: generatePaymentId(),
      appointmentId,
      userId,
      listingId: appointment.listingId,
      amount: totalAmount,
      paymentType: 'split_payment',
      gateway: 'paypal',
      status: 'pending',
      receiptNumber: generateReceiptNumber(),
      splitPayments: splitDetails.map(split => ({
        userId: split.userId,
        amount: split.amount,
        status: 'pending'
      }))
    });

    await payment.save();

    res.status(201).json({
      message: "Split payment created",
      payment: payment
    });
  } catch (err) {
    console.error("Error creating split payment:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST: Process refund
router.post("/refund", verifyToken, async (req, res) => {
  try {
    const { paymentId, refundAmount, reason } = req.body;
    const userId = req.user.id;

    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Check if user is authorized (buyer, seller, or admin)
    const appointment = await Booking.findById(payment.appointmentId);
    const isBuyer = appointment.buyerId.toString() === userId;
    const isSeller = appointment.sellerId.toString() === userId;

    // Check if user is admin
    const user = await User.findById(userId);
    const isAdmin = user.role === 'admin' || user.role === 'rootadmin';

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ message: "Unauthorized to process refund" });
    }

    if (refundAmount > payment.amount) {
      return res.status(400).json({ message: "Refund amount cannot exceed payment amount" });
    }

    // Process refund (mock implementation)
    const refundId = `refund_${Date.now()}`;

    payment.refundAmount = refundAmount;
    payment.refundReason = reason;
    payment.refundedAt = new Date();
    payment.refundId = refundId;
    payment.status = refundAmount === payment.amount ? 'refunded' : 'partially_refunded';

    await payment.save();

    // Update appointment status if fully refunded
    if (payment.status === 'refunded') {
      await Booking.findByIdAndUpdate(payment.appointmentId, {
        status: 'cancelledByAdmin',
        cancelReason: `Payment refunded: ${reason}`,
        paymentRefunded: true
      });
    }

    res.status(200).json({
      message: "Refund processed successfully",
      refundId: refundId,
      refundAmount: refundAmount
    });
  } catch (err) {
    console.error("Error processing refund:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST: Submit refund request
router.post("/refund-request", verifyToken, async (req, res) => {
  try {
    const { paymentId, appointmentId, reason, requestedAmount, type } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!paymentId || !appointmentId || !reason || !requestedAmount || !type) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if payment exists and belongs to user
    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Check if user is authorized (buyer or seller of the appointment)
    const appointment = await Booking.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    const isBuyer = appointment.buyerId && appointment.buyerId.toString() === userId;
    const isSeller = appointment.sellerId && appointment.sellerId.toString() === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ message: "Unauthorized to request refund for this appointment" });
    }

    // Check if payment is completed
    if (payment.status !== 'completed') {
      return res.status(400).json({ message: "Only completed payments can be refunded" });
    }

    // Check if appointment status allows refund
    const eligibleStatuses = ['rejected', 'cancelledByBuyer', 'cancelledBySeller', 'cancelledByAdmin'];
    if (!eligibleStatuses.includes(appointment.status)) {
      return res.status(400).json({ message: "Appointment status does not allow refund requests" });
    }

    // Check if refund amount is valid
    if (requestedAmount > payment.amount) {
      return res.status(400).json({ message: "Requested refund amount cannot exceed payment amount" });
    }

    // Check if there's already a pending refund request for this payment
    const existingRequest = await RefundRequest.findOne({
      paymentId,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingRequest) {
      return res.status(400).json({ message: "A refund request already exists for this payment" });
    }

    // Create refund request
    const refundRequest = new RefundRequest({
      paymentId,
      appointmentId,
      userId,
      requestedAmount,
      type,
      reason
    });

    await refundRequest.save();

    res.status(201).json({
      message: "Refund request submitted successfully",
      refundRequestId: refundRequest._id
    });
  } catch (err) {
    console.error("Error creating refund request:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET: Get user's refund request status by payment ID
router.get("/refund-request-status/:paymentId", verifyToken, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    // Find the refund request for this payment and user
    const refundRequest = await RefundRequest.findOne({
      paymentId: paymentId,
      userId: userId
    }).populate('appointmentId', 'propertyName date status buyerId sellerId');

    if (!refundRequest) {
      return res.status(200).json({ refundRequest: null });
    }

    res.status(200).json({ refundRequest });
  } catch (err) {
    console.error("Error fetching refund request status:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET: Get refund requests (admin only)
router.get("/refund-requests", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status, search } = req.query;

    // Check if user is admin
    const user = await User.findById(userId);
    const isAdmin = user.role === 'admin' || user.role === 'rootadmin';

    if (!isAdmin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    let query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { paymentId: new RegExp(search, 'i') },
        { reason: new RegExp(search, 'i') },
        { 'appointmentId.propertyName': new RegExp(search, 'i') }
      ];
    }

    const refundRequests = await RefundRequest.find(query)
      .populate('appointmentId', 'propertyName date status buyerId sellerId')
      .populate('userId', 'name email')
      .populate('processedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Manually populate payment data since paymentId is a string, not ObjectId
    const refundRequestsWithPayments = await Promise.all(
      refundRequests.map(async (request) => {
        const payment = await Payment.findOne({ paymentId: request.paymentId });
        return {
          ...request.toObject(),
          paymentId: payment
        };
      })
    );

    const totalRequests = await RefundRequest.countDocuments(query);

    res.status(200).json({
      refundRequests: refundRequestsWithPayments,
      totalPages: Math.ceil(totalRequests / limit),
      currentPage: parseInt(page),
      totalRequests
    });
  } catch (err) {
    console.error("Error fetching refund requests:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT: Update refund request status (admin only)
router.put("/refund-request/:requestId", verifyToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, adminNotes, adminRefundAmount } = req.body;
    const userId = req.user.id;

    // Check if user is admin
    const user = await User.findById(userId);
    const isAdmin = user.role === 'admin' || user.role === 'rootadmin';

    if (!isAdmin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const refundRequest = await RefundRequest.findById(requestId)
      .populate('appointmentId');

    if (!refundRequest) {
      return res.status(404).json({ message: "Refund request not found" });
    }

    if (!['pending', 'approved', 'rejected', 'processed'].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // Update refund request
    refundRequest.status = status;
    refundRequest.adminNotes = adminNotes;
    if (adminRefundAmount !== undefined) {
      refundRequest.adminRefundAmount = adminRefundAmount;
    }
    refundRequest.processedBy = userId;
    refundRequest.processedAt = new Date();

    await refundRequest.save();

    // If approved, process the actual refund
    if (status === 'approved') {
      const payment = await Payment.findOne({ paymentId: refundRequest.paymentId });

      // Use admin override amount if provided, otherwise use requested amount
      const finalRefundAmount = adminRefundAmount !== undefined ? adminRefundAmount : refundRequest.requestedAmount;

      // Validate refund amount
      if (finalRefundAmount < 0 || finalRefundAmount > payment.amount) {
        return res.status(400).json({ message: "Invalid refund amount" });
      }

      // Update payment record
      payment.refundAmount = finalRefundAmount;
      payment.refundReason = refundRequest.reason;
      payment.refundedAt = new Date();
      payment.refundId = `refund_${Date.now()}`;
      payment.status = finalRefundAmount === payment.amount ? 'refunded' : 'partially_refunded';

      await payment.save();

      // Update appointment status if fully refunded
      if (payment.status === 'refunded') {
        await Booking.findByIdAndUpdate(refundRequest.appointmentId, {
          paymentRefunded: true
        });
      }

      // Update refund request status to processed
      refundRequest.status = 'processed';
      await refundRequest.save();

      // Send refund approved email to user
      try {
        // Get user and appointment details for email
        const user = await User.findById(refundRequest.userId);
        const appointment = await Booking.findById(refundRequest.appointmentId).populate('listingId');
        const listing = appointment.listingId;

        if (user && appointment && listing) {
          await sendRefundRequestApprovedEmail(user.email, {
            propertyName: appointment.propertyName,
            propertyAddress: listing.address,
            propertyPrice: listing.regularPrice || listing.discountPrice,
            propertyImage: listing.imageUrls && listing.imageUrls.length > 0 ? listing.imageUrls[0] : '',
            appointmentDate: appointment.date,
            appointmentTime: appointment.time,
            buyerName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username,
            requestedAmount: refundRequest.requestedAmount,
            approvedAmount: finalRefundAmount,
            originalAmount: payment.amount,
            currency: payment.currency,
            refundType: refundRequest.type,
            refundReason: refundRequest.reason,
            adminNotes: adminNotes,
            refundId: payment.refundId,
            processedAt: refundRequest.processedAt,
            appointmentId: appointment._id,
            listingId: listing._id
          });
          console.log(`✅ Refund approved email sent to user: ${user.email}`);
        }
      } catch (emailError) {
        console.error('Error sending refund approved email:', emailError);
      }
    }

    // Send refund rejected email if status is rejected
    if (status === 'rejected') {
      try {
        // Get user and appointment details for email
        const user = await User.findById(refundRequest.userId);
        const appointment = await Booking.findById(refundRequest.appointmentId).populate('listingId');
        const listing = appointment.listingId;

        if (user && appointment && listing) {
          await sendRefundRequestRejectedEmail(user.email, {
            propertyName: appointment.propertyName,
            propertyAddress: listing.address,
            propertyPrice: listing.regularPrice || listing.discountPrice,
            propertyImage: listing.imageUrls && listing.imageUrls.length > 0 ? listing.imageUrls[0] : '',
            appointmentDate: appointment.date,
            appointmentTime: appointment.time,
            buyerName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username,
            requestedAmount: refundRequest.requestedAmount,
            originalAmount: refundRequest.originalAmount || 0,
            currency: refundRequest.currency || 'INR',
            refundType: refundRequest.type,
            refundReason: refundRequest.reason,
            adminNotes: adminNotes,
            processedAt: refundRequest.processedAt,
            appointmentId: appointment._id,
            listingId: listing._id
          });
          console.log(`❌ Refund rejected email sent to user: ${user.email}`);
        }
      } catch (emailError) {
        console.error('Error sending refund rejected email:', emailError);
      }
    }

    res.status(200).json({
      message: "Refund request updated successfully",
      refundRequest
    });
  } catch (err) {
    console.error("Error updating refund request:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET: Get payment history for user
router.get("/history", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status, paymentType, appointmentId, gateway, currency, q, fromDate, toDate } = req.query;

    let query = {};

    // If appointmentId is provided, allow both buyer and seller to see payment data
    if (appointmentId) {
      // First, find the appointment to check if user is buyer or seller
      const appointment = await Booking.findById(appointmentId);
      if (appointment) {
        const isBuyer = appointment.buyerId && appointment.buyerId.toString() === userId;
        const isSeller = appointment.sellerId && appointment.sellerId.toString() === userId;

        if (isBuyer || isSeller) {
          query.appointmentId = appointmentId;
        } else {
          // User is not involved in this appointment, return empty result
          return res.json({ payments: [], totalPages: 0, currentPage: 1 });
        }
      } else {
        return res.status(404).json({ message: 'Appointment not found' });
      }
    } else {
      // For general payment history, only show user's own payments
      query.userId = userId;
    }

    if (status) query.status = status;
    if (paymentType) query.paymentType = paymentType;
    if (gateway) query.gateway = gateway;
    if (currency) query.currency = currency.toUpperCase();
    if (q) {
      const rx = new RegExp(q, 'i');
      query.$or = [
        { paymentId: rx },
        { receiptNumber: rx },
        { 'appointmentId.propertyName': rx },
        { 'listingId.name': rx }
      ];
    }
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const payments = await Payment.find(query)
      .populate('appointmentId', 'propertyName date status')
      .populate('listingId', 'name address')
      .populate('contractId', 'contractId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);

    res.status(200).json({
      payments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (err) {
    console.error("Error fetching payment history:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// User: Export own payments CSV (placed before dynamic :paymentId route)
router.get('/export-csv', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, gateway, q, fromDate, toDate } = req.query;
    const query = { userId };
    if (status) query.status = status;
    if (gateway) query.gateway = gateway;
    if (q) {
      query.$or = [
        { paymentId: new RegExp(q, 'i') },
        { receiptNumber: new RegExp(q, 'i') }
      ];
    }
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }
    const payments = await Payment.find(query)
      .populate('appointmentId', 'propertyName date status')
      .populate('listingId', 'name address')
      .sort({ createdAt: -1 });
    const headers = ['PaymentID', 'Currency', 'Amount', 'Status', 'Gateway', 'Property', 'AppointmentDate', 'CreatedDate', 'CreatedTime', 'PaidDate', 'PaidTime', 'Receipt'];
    const formatDMY = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yyyy = dt.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };
    const formatTime = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      return dt.toLocaleTimeString('en-GB');
    };
    const rows = payments.map(p => [
      p.paymentId,
      p.currency || 'USD',
      p.amount,
      p.status,
      p.gateway,
      p.appointmentId?.propertyName || '',
      formatDMY(p.appointmentId?.date),
      formatDMY(p.createdAt),
      formatTime(p.createdAt),
      p.completedAt ? formatDMY(p.completedAt) : '',
      p.completedAt ? formatTime(p.completedAt) : '',
      p.receiptUrl || ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => typeof v === 'string' && v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="my_payments.csv"');
    return res.send(csv);
  } catch (e) {
    console.error('User export payments error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET: Get payment details by ID
router.get("/:paymentId", verifyToken, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    const payment = await Payment.findOne({ paymentId })
      .populate('appointmentId', 'propertyName date status buyerId sellerId')
      .populate('listingId', 'name address regularPrice')
      .populate('userId', 'username email');

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Check authorization
    const appointment = payment.appointmentId;
    const isBuyer = appointment.buyerId._id.toString() === userId;
    const isSeller = appointment.sellerId._id.toString() === userId;
    const user = await User.findById(userId);
    const isAdmin = user.role === 'admin' || user.role === 'rootadmin';

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    res.status(200).json({ payment });
  } catch (err) {
    console.error("Error fetching payment details:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET: Get payment statistics (admin only)
router.get("/stats/overview", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (user.role !== 'admin' && user.role !== 'rootadmin') {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const stats = await Payment.aggregate([
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          // Only count completed payments in totals
          totalAmount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] } },
          totalAmountUsd: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'completed'] }, { $eq: ['$currency', 'USD'] }] }, '$amount', 0] } },
          totalAmountInr: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'completed'] }, { $eq: ['$currency', 'INR'] }] }, '$amount', 0] } },
          // Count refunds from all payments that have refundAmount > 0 (includes completed, refunded, partially_refunded)
          totalRefunds: { $sum: { $cond: [{ $gt: ['$refundAmount', 0] }, '$refundAmount', 0] } },
          totalRefundsUsd: { $sum: { $cond: [{ $and: [{ $gt: ['$refundAmount', 0] }, { $eq: ['$currency', 'USD'] }] }, '$refundAmount', 0] } },
          totalRefundsInr: { $sum: { $cond: [{ $and: [{ $gt: ['$refundAmount', 0] }, { $eq: ['$currency', 'INR'] }] }, '$refundAmount', 0] } },
          completedPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          pendingPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          failedPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          }
        }
      }
    ]);

    const monthlyStats = await Payment.aggregate([
      {
        $match: {
          status: 'completed', // Only count completed payments for revenue
          createdAt: { $gte: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
          amountUsd: { $sum: { $cond: [{ $eq: ['$currency', 'USD'] }, '$amount', 0] } },
          amountInr: { $sum: { $cond: [{ $eq: ['$currency', 'INR'] }, '$amount', 0] } },
          refunds: { $sum: { $cond: [{ $gt: ['$refundAmount', 0] }, '$refundAmount', 0] } },
          refundsUsd: { $sum: { $cond: [{ $and: [{ $gt: ['$refundAmount', 0] }, { $eq: ['$currency', 'USD'] }] }, '$refundAmount', 0] } },
          refundsInr: { $sum: { $cond: [{ $and: [{ $gt: ['$refundAmount', 0] }, { $eq: ['$currency', 'INR'] }] }, '$refundAmount', 0] } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.status(200).json({
      overview: stats[0] || {
        totalPayments: 0,
        totalAmount: 0,
        totalAmountUsd: 0,
        totalAmountInr: 0,
        totalRefunds: 0,
        totalRefundsUsd: 0,
        totalRefundsInr: 0,
        completedPayments: 0,
        pendingPayments: 0,
        failedPayments: 0
      },
      monthlyStats
    });
  } catch (err) {
    console.error("Error fetching payment stats:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST: Submit appeal for rejected refund request
router.post("/refund-appeal", verifyToken, async (req, res) => {
  try {
    const { refundRequestId, appealReason, appealText } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!refundRequestId || !appealReason || !appealText) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Find the refund request
    const refundRequest = await RefundRequest.findById(refundRequestId)
      .populate('appointmentId', 'propertyName date status buyerId sellerId')
      .populate('userId', 'name email');

    if (!refundRequest) {
      return res.status(404).json({ message: "Refund request not found" });
    }

    // Check if user is authorized (only the original requester can appeal)
    if (refundRequest.userId._id.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized to appeal this refund request" });
    }

    // Check if refund request is rejected
    if (refundRequest.status !== 'rejected') {
      return res.status(400).json({ message: "Only rejected refund requests can be appealed" });
    }

    // Check if already appealed
    if (refundRequest.isAppealed) {
      return res.status(400).json({ message: "This refund request has already been appealed" });
    }

    // Update refund request with appeal information
    refundRequest.appealReason = appealReason;
    refundRequest.appealText = appealText;
    refundRequest.appealSubmittedAt = new Date();
    refundRequest.isAppealed = true;

    await refundRequest.save();

    // Create notification for all admins
    const admins = await User.find({
      $or: [
        { role: 'admin' },
        { role: 'rootadmin' },
        { isDefaultAdmin: true },
        { isAdmin: true }
      ]
    });

    const notifications = admins.map(admin => ({
      userId: admin._id,
      type: 'refund_appeal_submitted',
      title: 'New Refund Appeal Submitted',
      message: `A refund appeal has been submitted for payment ${refundRequest.paymentId} by ${refundRequest.userId.name || refundRequest.userId.email}. Property: ${refundRequest.appointmentId.propertyName}. Appeal Reason: ${appealReason}`,
      adminId: userId,
      isRead: false
    }));

    await Notification.insertMany(notifications);

    res.status(200).json({
      message: "Appeal submitted successfully. Please wait for response.",
      appealSubmittedAt: refundRequest.appealSubmittedAt
    });
  } catch (err) {
    console.error("Error submitting appeal:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT: Reopen case for rejected refund request (admin only)
router.put("/refund-request/:requestId/reopen", verifyToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;

    // Check if user is admin
    const user = await User.findById(userId);
    const isAdmin = user.role === 'admin' || user.role === 'rootadmin' || user.isDefaultAdmin || user.isAdmin;

    if (!isAdmin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const refundRequest = await RefundRequest.findById(requestId)
      .populate('appointmentId')
      .populate('userId', 'name email');

    if (!refundRequest) {
      return res.status(404).json({ message: "Refund request not found" });
    }

    // Check if refund request is rejected
    if (refundRequest.status !== 'rejected') {
      return res.status(400).json({ message: "Only rejected refund requests can be reopened" });
    }

    // Update refund request to reopen case
    refundRequest.caseReopened = true;
    refundRequest.caseReopenedAt = new Date();
    refundRequest.caseReopenedBy = userId;
    refundRequest.status = 'pending'; // Reset status to pending for review

    await refundRequest.save();

    res.status(200).json({
      message: "Case reopened successfully",
      refundRequest: refundRequest
    });
  } catch (err) {
    console.error("Error reopening case:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;

// PayPal helper endpoints
router.post('/paypal/create-order', verifyToken, createPayPalOrder);
router.post('/paypal/capture-order', verifyToken, capturePayPalOrder);

// PayPal debug endpoint to verify credentials and token acquisition
router.get('/paypal/debug', verifyToken, async (req, res) => {
  try {
    const clientIdMasked = process.env.PAYPAL_CLIENT_ID
      ? process.env.PAYPAL_CLIENT_ID.slice(0, 6) + '...' + process.env.PAYPAL_CLIENT_ID.slice(-4)
      : null;
    const baseUrl = process.env.PAYPAL_API_URL || 'https://api-m.sandbox.paypal.com';
    const hasSecret = Boolean(process.env.PAYPAL_SECRET);
    const { accessToken } = await getPayPalAccessToken();
    return res.json({
      ok: true,
      baseUrl,
      clientIdMasked,
      hasSecret,
      tokenSample: accessToken ? accessToken.slice(0, 8) + '...' : null
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Admin: Mark appointment as paid (create/update Payment and set receipt)
router.post('/admin/mark-paid', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || (user.role !== 'admin' && user.role !== 'rootadmin')) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const { appointmentId, currency, amount, gateway } = req.body;
    if (!appointmentId) return res.status(400).json({ message: 'appointmentId is required' });

    const appointment = await Booking.findById(appointmentId).populate('listingId', 'name');
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    // Find latest payment for this appointment
    let payment = await Payment.findOne({ appointmentId }).sort({ createdAt: -1 });

    if (!payment) {
      // Create default advance payment if none exists
      const resolvedCurrency = (currency || 'USD').toUpperCase();
      const resolvedAmount = typeof amount === 'number' ? amount : (resolvedCurrency === 'INR' ? 100 : 5);
      const resolvedGateway = gateway || (resolvedCurrency === 'INR' ? 'razorpay' : 'paypal');
      payment = new Payment({
        paymentId: generatePaymentId(),
        appointmentId,
        userId: appointment.buyerId,
        listingId: appointment.listingId,
        amount: resolvedAmount,
        currency: resolvedCurrency,
        paymentType: 'advance',
        gateway: resolvedGateway,
        status: 'pending',
        receiptNumber: generateReceiptNumber()
      });
    }

    // Mark as completed
    payment.status = 'completed';
    payment.completedAt = new Date();
    if (currency) payment.currency = currency.toUpperCase();
    if (typeof amount === 'number') payment.amount = amount;
    if (gateway) payment.gateway = gateway;

    // Set metadata to indicate admin marked this payment
    if (!payment.metadata) payment.metadata = {};
    payment.metadata.adminMarked = true;

    // Set receipt URL
    const base = `${req.protocol}://${req.get('host')}`;
    const receiptUrl = `${base}/api/payments/${payment.paymentId}/receipt`;
    payment.receiptUrl = receiptUrl;
    await payment.save();

    // Mark appointment flag
    await Booking.findByIdAndUpdate(appointmentId, { paymentConfirmed: true });

    // Get user details for email (appointment already populated with listingId)
    await appointment.populate('buyerId', 'email username');
    const buyer = appointment.buyerId;
    const listing = appointment.listingId;

    // Send payment success email to buyer (admin marked as paid)
    try {
      await sendPaymentSuccessEmail(buyer.email, {
        paymentId: payment.paymentId,
        amount: payment.amount,
        currency: payment.currency,
        propertyName: listing.name,
        appointmentDate: appointment.date ? new Date(appointment.date).toLocaleDateString() : 'N/A',
        receiptUrl: receiptUrl,
        paymentType: payment.paymentType,
        gateway: payment.gateway
      });
      console.log(`✅ Admin payment success email sent to buyer: ${buyer.email}`);
    } catch (emailError) {
      console.error('Error sending payment success email:', emailError);
    }

    // Send payment notification email to seller (admin marked as paid)
    try {
      // Get seller details
      await appointment.populate('sellerId', 'email username firstName lastName');
      const seller = appointment.sellerId;

      await sendSellerPaymentNotificationEmail(seller.email, {
        appointmentId: appointment._id,
        propertyName: listing.name,
        propertyDescription: listing.description,
        propertyAddress: listing.address,
        propertyPrice: listing.regularPrice || listing.discountPrice,
        propertyImages: listing.imageUrls || [],
        date: appointment.date,
        time: appointment.time,
        buyerName: buyer.firstName && buyer.lastName
          ? `${buyer.firstName} ${buyer.lastName}`
          : buyer.username,
        paymentAmount: payment.amount,
        paymentCurrency: payment.currency,
        paymentGateway: payment.gateway,
        listingId: listing._id
      });
      console.log(`✅ Admin seller payment notification email sent to: ${seller.email}`);
    } catch (sellerEmailError) {
      console.error('Error sending seller payment notification email:', sellerEmailError);
    }

    // Emit socket event for real-time payment status update
    const io = req.app.get('io');
    if (io) {
      io.emit('paymentStatusUpdated', { appointmentId, paymentConfirmed: true });
      io.to('admin_*').emit('paymentStatusUpdated', { appointmentId, paymentConfirmed: true });
    }

    return res.json({ ok: true, payment, receiptUrl });
  } catch (e) {
    console.error('Admin mark-paid error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Payment lock storage (in-memory, for preventing multiple payment sessions across browsers/devices)
// Format: { appointmentId: { userId, timestamp, sessionId } }
const paymentLocks = new Map();

// Clean up stale locks every 10 seconds
setInterval(() => {
  const now = Date.now();
  for (const [appointmentId, lock] of paymentLocks.entries()) {
    // Remove locks older than 5 seconds without heartbeat
    if (now - lock.timestamp > 5000) {
      paymentLocks.delete(appointmentId);
      console.log(`Auto-released stale payment lock for appointment ${appointmentId}`);
    }
  }
}, 10000);

// POST: Acquire payment lock (prevents multiple payment sessions for same appointment)
router.post('/lock/acquire', verifyToken, async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const userId = req.user.id;

    if (!appointmentId) {
      return res.status(400).json({ message: 'Appointment ID is required' });
    }

    // Check if appointment exists and user is authorized
    const appointment = await Booking.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check if user is the buyer
    if (appointment.buyerId.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const now = Date.now();
    const existingLock = paymentLocks.get(appointmentId);

    // Check if lock exists and is not stale
    if (existingLock) {
      // If lock is stale (older than 5 seconds), allow acquiring it
      if (now - existingLock.timestamp > 5000) {
        // Lock is stale, acquire it
        paymentLocks.set(appointmentId, {
          userId,
          timestamp: now,
          sessionId: req.sessionId || null
        });
        return res.json({
          ok: true,
          message: 'Lock acquired (stale lock replaced)',
          locked: true
        });
      }

      // Lock is active (not stale) - prevent acquiring even if same user
      // This ensures only one browser/device can have the payment modal open at a time
      return res.status(409).json({
        ok: false,
        message: 'Payment session is already open in another browser/device. Please close that browser/device first before opening a new payment session.',
        locked: true,
        lockedBy: existingLock.userId
      });
    }

    // No lock exists, acquire it
    paymentLocks.set(appointmentId, {
      userId,
      timestamp: now,
      sessionId: req.sessionId || null
    });

    return res.json({
      ok: true,
      message: 'Lock acquired',
      locked: true
    });
  } catch (err) {
    console.error('Error acquiring payment lock:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST: Release payment lock
router.post('/lock/release', verifyToken, async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const userId = req.user.id;

    if (!appointmentId) {
      return res.status(400).json({ message: 'Appointment ID is required' });
    }

    const existingLock = paymentLocks.get(appointmentId);

    if (existingLock && existingLock.userId === userId) {
      paymentLocks.delete(appointmentId);
      return res.json({
        ok: true,
        message: 'Lock released',
        locked: false
      });
    }

    return res.json({
      ok: true,
      message: 'Lock not found or not owned by user',
      locked: false
    });
  } catch (err) {
    console.error('Error releasing payment lock:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET: Check payment lock status
router.get('/lock/check/:appointmentId', verifyToken, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user.id;

    const existingLock = paymentLocks.get(appointmentId);
    const now = Date.now();

    if (existingLock) {
      // If lock is stale, consider it free
      if (now - existingLock.timestamp > 5000) {
        return res.json({
          ok: true,
          locked: false,
          stale: true
        });
      }

      // If lock belongs to current user, it's not locked (same user can access)
      if (existingLock.userId === userId) {
        return res.json({
          ok: true,
          locked: false,
          ownedByUser: true
        });
      }

      // Lock is held by another user
      return res.json({
        ok: true,
        locked: true,
        lockedBy: existingLock.userId,
        message: 'Payment session is already open in another browser/device'
      });
    }

    return res.json({
      ok: true,
      locked: false
    });
  } catch (err) {
    console.error('Error checking payment lock:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST: Heartbeat payment lock (keep lock alive)
router.post('/lock/heartbeat', verifyToken, async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const userId = req.user.id;

    if (!appointmentId) {
      return res.status(400).json({ message: 'Appointment ID is required' });
    }

    const existingLock = paymentLocks.get(appointmentId);

    if (existingLock && existingLock.userId === userId) {
      // Update timestamp to keep lock alive
      existingLock.timestamp = Date.now();
      paymentLocks.set(appointmentId, existingLock);
      return res.json({
        ok: true,
        message: 'Heartbeat received',
        locked: true
      });
    }

    return res.status(404).json({
      ok: false,
      message: 'Lock not found or not owned by user',
      locked: false
    });
  } catch (err) {
    console.error('Error updating payment lock heartbeat:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST: Cancel payment (when modal is closed without completing or timer expires)
router.post('/cancel', verifyToken, async (req, res) => {
  try {
    const { paymentId } = req.body;
    const userId = req.user.id;

    if (!paymentId) {
      return res.status(400).json({ message: 'Payment ID is required' });
    }

    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Check if user is authorized (only buyer can cancel their own payment)
    if (payment.userId.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized to cancel this payment' });
    }

    // Only allow cancelling pending or processing payments
    if (payment.status !== 'pending' && payment.status !== 'processing') {
      return res.status(400).json({
        message: `Cannot cancel payment with status: ${payment.status}`
      });
    }

    // Cancel the payment
    payment.status = 'cancelled';
    payment.updatedAt = new Date();
    payment.expiresAt = null; // Clear expiry since payment is cancelled
    await payment.save();

    console.log(`Payment ${paymentId} cancelled by user ${userId}`);

    return res.json({
      ok: true,
      message: 'Payment cancelled successfully',
      payment
    });
  } catch (err) {
    console.error('Error cancelling payment:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Mark appointment as unpaid (revert latest payment to pending)
router.post('/admin/mark-unpaid', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || (user.role !== 'admin' && user.role !== 'rootadmin')) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const { appointmentId } = req.body;
    if (!appointmentId) return res.status(400).json({ message: 'appointmentId is required' });

    const payment = await Payment.findOne({ appointmentId }).sort({ createdAt: -1 });
    if (payment) {
      payment.status = 'pending';
      payment.completedAt = undefined;
      payment.receiptUrl = undefined;

      // Clear admin marked flag
      if (payment.metadata) {
        payment.metadata.adminMarked = false;
      }

      await payment.save();
    }

    await Booking.findByIdAndUpdate(appointmentId, { paymentConfirmed: false });

    // Emit socket event for real-time payment status update
    const io = req.app.get('io');
    if (io) {
      io.emit('paymentStatusUpdated', { appointmentId, paymentConfirmed: false });
      io.to('admin_*').emit('paymentStatusUpdated', { appointmentId, paymentConfirmed: false });
    }

    return res.json({ ok: true, updated: Boolean(payment) });
  } catch (e) {
    console.error('Admin mark-unpaid error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// User: Export own payments CSV
router.get('/export', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, gateway, q, fromDate, toDate } = req.query;
    const query = { userId };
    if (status) query.status = status;
    if (gateway) query.gateway = gateway;
    if (q) {
      query.$or = [
        { paymentId: new RegExp(q, 'i') },
        { receiptNumber: new RegExp(q, 'i') }
      ];
    }
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }
    const payments = await Payment.find(query)
      .populate('appointmentId', 'propertyName date status')
      .populate('listingId', 'name address')
      .sort({ createdAt: -1 });
    const headers = ['PaymentID', 'Currency', 'Amount', 'Status', 'Gateway', 'Property', 'AppointmentDate', 'CreatedDate', 'CreatedTime', 'PaidDate', 'PaidTime', 'Receipt'];
    const formatDMY = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yyyy = dt.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };
    const formatTime = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      return dt.toLocaleTimeString('en-GB');
    };
    const rows = payments.map(p => [
      p.paymentId,
      p.currency || 'USD',
      p.amount,
      p.status,
      p.gateway,
      p.appointmentId?.propertyName || '',
      p.appointmentId?.date ? new Date(p.appointmentId.date).toISOString() : '',
      formatDMY(p.createdAt),
      formatTime(p.createdAt),
      p.completedAt ? formatDMY(p.completedAt) : '',
      p.completedAt ? formatTime(p.completedAt) : '',
      p.receiptUrl || ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => typeof v === 'string' && v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="my_payments.csv"');
    return res.send(csv);
  } catch (e) {
    console.error('User export payments error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});
// Admin: Export payments CSV
router.get('/admin/export', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (user.role !== 'admin' && user.role !== 'rootadmin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const { currency, status, gateway, q, fromDate, toDate } = req.query;
    const query = {};
    if (currency) query.currency = currency.toUpperCase();
    if (status) query.status = status;
    if (gateway) query.gateway = gateway;
    if (q) {
      query.$or = [
        { paymentId: new RegExp(q, 'i') },
        { receiptNumber: new RegExp(q, 'i') }
      ];
    }
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const payments = await Payment.find(query)
      .populate('appointmentId', 'propertyName date status')
      .populate('listingId', 'name address')
      .populate('userId', 'username email')
      .sort({ createdAt: -1 });

    const headers = ['PaymentID', 'Currency', 'Amount', 'Status', 'Gateway', 'User', 'Email', 'Property', 'AppointmentDate', 'CreatedDate', 'CreatedTime', 'PaidDate', 'PaidTime', 'Receipt'];
    const formatDMY = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yyyy = dt.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };
    const formatTime = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      return dt.toLocaleTimeString('en-GB');
    };
    const rows = payments.map(p => [
      p.paymentId,
      p.currency || 'USD',
      p.amount,
      p.status,
      p.gateway,
      p.userId?.username || '',
      p.userId?.email || '',
      p.appointmentId?.propertyName || '',
      formatDMY(p.appointmentId?.date),
      formatDMY(p.createdAt),
      formatTime(p.createdAt),
      p.completedAt ? formatDMY(p.completedAt) : '',
      p.completedAt ? formatTime(p.completedAt) : '',
      p.receiptUrl || ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => typeof v === 'string' && v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="payments_export.csv"');
    return res.send(csv);
  } catch (e) {
    console.error('Admin export payments error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Admin: List all payments with optional currency filter
router.get('/admin/list', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (user.role !== 'admin' && user.role !== 'rootadmin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const { currency, status, gateway, paymentType, page = 1, limit = 20, q, fromDate, toDate, contractId } = req.query;
    const query = {};
    if (currency) query.currency = currency.toUpperCase();
    if (status) query.status = status;
    if (gateway) query.gateway = gateway;
    if (paymentType) query.paymentType = paymentType;
    if (contractId) query.contractId = contractId;
    if (q) {
      const rx = new RegExp(q, 'i');
      query.$or = [
        { paymentId: rx },
        { receiptNumber: rx },
        { 'userId.username': rx },
        { 'appointmentId.propertyName': rx },
        { 'listingId.name': rx }
      ];
    }
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const payments = await Payment.find(query)
      .populate('appointmentId', 'propertyName date status buyerId sellerId')
      .populate('listingId', 'name address')
      .populate('userId', 'username email')
      .populate('contractId', 'contractId')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
    const total = await Payment.countDocuments(query);
    return res.json({ payments, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (e) {
    console.error('Admin list payments error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});
