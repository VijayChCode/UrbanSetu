import express from 'express';
import { verifyToken, verifyAdmin } from '../utils/verify.js';
import { getAlerts, updateAlertStatus } from '../controllers/sentinel.controller.js';
import SentinelPreference from '../models/sentinelPreference.model.js';

const router = express.Router();

// ─── Admin Alert Routes ───
router.get('/alerts', verifyToken, verifyAdmin, getAlerts);
router.patch('/alerts/:id', verifyToken, verifyAdmin, updateAlertStatus);

// ─── User Preference Routes (Sentinel Live persistence) ───

/**
 * GET /api/sentinel/preferences
 * Retrieve the logged-in user's Sentinel interaction history from DB.
 * Called on login / app-load to restore localStorage.
 */
router.get('/preferences', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const pref = await SentinelPreference.findOne({ userId }).lean();

    if (!pref || !pref.interactions || pref.interactions.length === 0) {
      return res.status(200).json({ interactions: [] });
    }

    return res.status(200).json({ interactions: pref.interactions });
  } catch (error) {
    console.error('Sentinel: Failed to get preferences', error);
    return res.status(500).json({ message: 'Failed to retrieve preferences' });
  }
});

/**
 * PUT /api/sentinel/preferences/sync
 * Upsert the user's Sentinel interaction history to DB.
 * Called from frontend after each trackInteraction (debounced).
 * Body: { interactions: [...] }
 */
router.put('/preferences/sync', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    let { interactions } = req.body;

    if (!Array.isArray(interactions)) {
      return res.status(400).json({ message: 'interactions must be an array' });
    }

    // Enforce max 30 entries (safety check)
    interactions = interactions.slice(0, 30);

    // Sanitize each interaction to only keep expected fields
    const sanitized = interactions.map(item => ({
      _id: String(item._id || ''),
      city: String(item.city || '').toLowerCase().slice(0, 100),
      state: String(item.state || '').toLowerCase().slice(0, 100),
      type: String(item.type || '').slice(0, 20),
      price: Number(item.price) || 0,
      bedrooms: Number(item.bedrooms) || 0,
      bathrooms: Number(item.bathrooms) || 0,
      area: Number(item.area) || 0,
      parking: !!item.parking,
      furnished: !!item.furnished,
      gym: !!item.gym,
      swimmingPool: !!item.swimmingPool,
      security: !!item.security,
      wifi: !!item.wifi,
      garden: !!item.garden,
      lift: !!item.lift,
      interactionType: ['view', 'wishlist', 'watchlist'].includes(item.interactionType) ? item.interactionType : 'view',
      timestamp: Number(item.timestamp) || Date.now()
    })).filter(item => item._id); // Remove entries without an ID

    await SentinelPreference.findOneAndUpdate(
      { userId },
      { $set: { interactions: sanitized } },
      { upsert: true, new: true }
    );

    return res.status(200).json({ success: true, count: sanitized.length });
  } catch (error) {
    console.error('Sentinel: Failed to sync preferences', error);
    return res.status(500).json({ message: 'Failed to sync preferences' });
  }
});

export default router;
