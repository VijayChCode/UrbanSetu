import express from 'express';
import { verifyToken } from '../utils/verify.js';
import MoversRequest from '../models/moversRequest.model.js';
import ServiceRequest from '../models/serviceRequest.model.js';
import {
  sendServiceRequestReceivedEmail,
  sendMoversRequestReceivedEmail,
  sendServiceRequestStatusUpdateEmail,
  sendMoversRequestStatusUpdateEmail
} from '../utils/emailService.js';

const router = express.Router();

// Create movers request
router.post('/movers', verifyToken, async (req, res, next) => {
  try {
    const { fromAddress, toAddress, moveDate, size, notes, coinsToRedeem } = req.body;
    if (!fromAddress || !toAddress || !moveDate || !size) return res.status(400).json({ message: 'Missing fields' });

    let redeemed = 0;
    let discount = 0;

    if (coinsToRedeem && coinsToRedeem > 0) {
      const CoinService = (await import('../services/coinService.js')).default;
      const balanceData = await CoinService.getBalance(req.user.id);
      if (balanceData.setuCoinsBalance < coinsToRedeem) {
        return res.status(400).json({ message: 'Insufficient SetuCoins balance' });
      }
      // 10 Coins = 1 INR
      discount = Math.floor(coinsToRedeem / 10);
      await CoinService.debit({
        userId: req.user.id,
        amount: coinsToRedeem,
        source: 'redemption_service_discount',
        description: `Discount on Movers Request to ${toAddress}`,
        referenceModel: 'MoversRequest' // We'll update ID after creation if needed, or just link by description
      });
      redeemed = coinsToRedeem;
    }

    const doc = await MoversRequest.create({
      userId: req.user.id,
      requesterName: req.user.username,
      requesterEmail: req.user.email,
      fromAddress, toAddress, moveDate, size, notes,
      redeemedCoins: redeemed,
      discountApplied: discount
    });

    // Send confirmation email to user
    try {
      await sendMoversRequestReceivedEmail(
        req.user.email,
        req.user.username,
        fromAddress,
        toAddress,
        moveDate,
        size,
        redeemed
      );
    } catch (emailErr) {
      console.error('Failed to send movers request confirmation email:', emailErr);
    }

    res.status(201).json(doc);
  } catch (e) { next(e); }
});

// List movers requests (user sees own, admin sees all)
router.get('/movers', verifyToken, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'rootadmin';
    const docs = await MoversRequest.find(isAdmin ? {} : { userId: req.user.id }).sort({ createdAt: -1 });
    res.json(docs);
  } catch (e) { next(e); }
});

// Update status (admin only or owner can cancel)
router.patch('/movers/:id', verifyToken, async (req, res, next) => {
  try {
    const { status } = req.body;
    const doc = await MoversRequest.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    const isAdmin = req.user.role === 'admin' || req.user.role === 'rootadmin';
    const isOwner = doc.userId.toString() === req.user.id;
    const allowed = isAdmin || (isOwner && status === 'cancelled');
    if (!allowed) return res.status(403).json({ message: 'Forbidden' });
    doc.status = status;
    await doc.save();

    // Send status update email to the request owner
    try {
      await sendMoversRequestStatusUpdateEmail(
        doc.requesterEmail,
        doc.requesterName,
        doc.fromAddress,
        doc.toAddress,
        status,
        doc.moveDate,
        doc.size
      );
    } catch (emailErr) {
      console.error('Failed to send movers status update email:', emailErr);
    }

    res.json(doc);
  } catch (e) { next(e); }
});

// Reinitiate movers (owner only, max 2 attempts)
router.post('/movers/:id/reinitiate', verifyToken, async (req, res, next) => {
  try {
    const doc = await MoversRequest.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (doc.userId.toString() !== req.user.id) return res.status(403).json({ message: 'Forbidden' });
    if (doc.reinitiateCount >= 2) return res.status(400).json({ message: 'Reinitiate limit reached' });
    if (doc.status !== 'cancelled') return res.status(400).json({ message: 'Only cancelled requests can be reinitiated' });
    doc.status = 'pending';
    doc.reinitiateCount += 1;
    await doc.save();
    res.json(doc);
  } catch (e) { next(e); }
});

// Delete movers (owner or admin)
router.delete('/movers/:id', verifyToken, async (req, res, next) => {
  try {
    const doc = await MoversRequest.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    const isAdmin = req.user.role === 'admin' || req.user.role === 'rootadmin';
    const isOwner = doc.userId.toString() === req.user.id;
    if (!isAdmin && !isOwner) return res.status(403).json({ message: 'Forbidden' });
    await doc.deleteOne();
    res.json({ success: true });
  } catch (e) { next(e); }
});

// Create service request
router.post('/services', verifyToken, async (req, res, next) => {
  try {
    const { services, preferredDate, address, notes, coinsToRedeem } = req.body;
    if (!services || services.length === 0 || !preferredDate || !address) return res.status(400).json({ message: 'Missing fields' });

    let redeemed = 0;
    let discount = 0;

    if (coinsToRedeem && coinsToRedeem > 0) {
      const CoinService = (await import('../services/coinService.js')).default;
      const balanceData = await CoinService.getBalance(req.user.id);
      if (balanceData.setuCoinsBalance < coinsToRedeem) {
        return res.status(400).json({ message: 'Insufficient SetuCoins balance' });
      }
      // 10 Coins = 1 INR
      discount = Math.floor(coinsToRedeem / 10);
      await CoinService.debit({
        userId: req.user.id,
        amount: coinsToRedeem,
        source: 'redemption_service_discount',
        description: `Discount on Service Request (${services.join(', ')})`,
        referenceModel: 'ServiceRequest'
      });
      redeemed = coinsToRedeem;
    }

    const doc = await ServiceRequest.create({
      userId: req.user.id,
      requesterName: req.user.username,
      requesterEmail: req.user.email,
      services, preferredDate, address, notes,
      redeemedCoins: redeemed,
      discountApplied: discount
    });

    // Send confirmation email to user
    try {
      await sendServiceRequestReceivedEmail(
        req.user.email,
        req.user.username,
        services,
        preferredDate,
        address,
        redeemed
      );
    } catch (emailErr) {
      console.error('Failed to send service request confirmation email:', emailErr);
    }

    res.status(201).json(doc);
  } catch (e) { next(e); }
});

// List service requests
router.get('/services', verifyToken, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'rootadmin';
    const docs = await ServiceRequest.find(isAdmin ? {} : { userId: req.user.id }).sort({ createdAt: -1 });
    res.json(docs);
  } catch (e) { next(e); }
});

// Update service request status
router.patch('/services/:id', verifyToken, async (req, res, next) => {
  try {
    const { status } = req.body;
    const doc = await ServiceRequest.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    const isAdmin = req.user.role === 'admin' || req.user.role === 'rootadmin';
    const isOwner = doc.userId.toString() === req.user.id;
    const allowed = isAdmin || (isOwner && status === 'cancelled');
    if (!allowed) return res.status(403).json({ message: 'Forbidden' });
    doc.status = status;
    await doc.save();

    // Send status update email to the request owner
    try {
      await sendServiceRequestStatusUpdateEmail(
        doc.requesterEmail,
        doc.requesterName,
        doc.services,
        status,
        doc.preferredDate,
        doc.address
      );
    } catch (emailErr) {
      console.error('Failed to send service status update email:', emailErr);
    }

    res.json(doc);
  } catch (e) { next(e); }
});

// Reinitiate service (owner only, max 2 attempts)
router.post('/services/:id/reinitiate', verifyToken, async (req, res, next) => {
  try {
    const doc = await ServiceRequest.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (doc.userId.toString() !== req.user.id) return res.status(403).json({ message: 'Forbidden' });
    if (doc.reinitiateCount >= 2) return res.status(400).json({ message: 'Reinitiate limit reached' });
    if (doc.status !== 'cancelled') return res.status(400).json({ message: 'Only cancelled requests can be reinitiated' });
    doc.status = 'pending';
    doc.reinitiateCount += 1;
    await doc.save();
    res.json(doc);
  } catch (e) { next(e); }
});

// Delete service (owner or admin)
router.delete('/services/:id', verifyToken, async (req, res, next) => {
  try {
    const doc = await ServiceRequest.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    const isAdmin = req.user.role === 'admin' || req.user.role === 'rootadmin';
    const isOwner = doc.userId.toString() === req.user.id;
    if (!isAdmin && !isOwner) return res.status(403).json({ message: 'Forbidden' });
    await doc.deleteOne();
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;

