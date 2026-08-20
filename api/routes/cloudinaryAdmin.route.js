import express from 'express';
import { verifyToken } from '../utils/verify.js';
import User from '../models/user.model.js';
import CloudinaryAccount from '../models/cloudinaryAccount.model.js';
import {
  getPoolStatus,
  toggleAccount,
  resetMonthlyCounters,
  fetchAllRealUsage,
  fetchRealUsageForAccount,
} from '../utils/cloudinaryPool.js';
import {
  checkAndSendCloudinaryAlerts,
  getRootAdminRecipients,
} from '../schedulers/cloudinaryResetScheduler.js';
import { sendCloudinaryToggleStatusEmail } from '../utils/emailService.js';
import { getLocationFromIP, getDeviceInfo } from '../utils/sessionManager.js';

const router = express.Router();

/**
 * Admin-only middleware: require rootadmin or admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'rootadmin' && req.user.role !== 'admin')) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }
  next();
};

/**
 * GET /api/admin/cloudinary/pool-status
 * Returns usage stats for all Cloudinary accounts in the pool.
 */
router.get('/pool-status', verifyToken, requireAdmin, async (req, res) => {
  try {
    const status = await getPoolStatus();

    const summary = {
      totalAccounts: status.length,
      enabledAccounts: status.filter(a => a.isEnabled).length,
      disabledAccounts: status.filter(a => !a.isEnabled).length,
      totalUploadsThisMonth: status.reduce((sum, a) => sum + a.monthlyUploadCount, 0),
      totalUploadsAllTime: status.reduce((sum, a) => sum + a.uploadCount, 0),
      totalBytesThisMonth: status.reduce((sum, a) => sum + a.monthlyBytesUploaded, 0),
      totalBytesAllTime: status.reduce((sum, a) => sum + a.totalBytesUploaded, 0),
    };

    res.json({
      success: true,
      summary,
      accounts: status,
    });
  } catch (error) {
    console.error('Error fetching pool status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pool status',
      error: error.message
    });
  }
});

/**
 * PATCH /api/admin/cloudinary/:accountIndex/toggle
 * Enable or disable a specific Cloudinary account.
 * Body: { enabled: boolean, note?: string }
 */
router.patch('/:accountIndex/toggle', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { accountIndex } = req.params;
    const { enabled, note } = req.body;
    const parsedIndex = parseInt(accountIndex);

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'enabled (boolean) is required in the request body'
      });
    }

    // Fetch account details prior to toggle for audit reporting
    const accountDoc = await CloudinaryAccount.findOne({ accountIndex: parsedIndex }).lean();
    const cloudName = accountDoc?.cloudName || `Account #${accountIndex}`;

    // Perform database toggle
    const actionNote = note || `Manually ${enabled ? 'enabled' : 'disabled'} by ${req.user?.username || 'admin'}`;
    await toggleAccount(
      parsedIndex,
      enabled,
      actionNote
    );

    // Extract client IP, Geo Location, and Device Info
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || 'Unknown';
    const userAgent = req.get('User-Agent');
    const device = getDeviceInfo(userAgent, req.headers);
    const location = getLocationFromIP(clientIp);

    // Trigger immediate audit email to rootadmin(s) in background
    (async () => {
      try {
        const recipients = await getRootAdminRecipients();
        const actionType = enabled ? 'enabled' : 'disabled';
        
        for (const recipient of recipients) {
          await sendCloudinaryToggleStatusEmail({
            to: recipient.email,
            recipientName: recipient.username,
            actionType,
            account: {
              accountIndex: parsedIndex,
              cloudName,
              isFallback: accountDoc?.isFallback || parsedIndex === -1,
              realCreditsUsed: accountDoc?.realCreditsUsed || 0,
              realCreditsLimit: accountDoc?.realCreditsLimit || 25,
            },
            triggeredBy: {
              username: req.user?.username || 'Root Admin',
              email: req.user?.email || req.user?.username || 'N/A',
              role: req.user?.role || 'rootadmin'
            },
            ip: clientIp,
            location,
            device,
            timestamp: new Date(),
            note: actionNote,
            dashboardUrl: 'https://urbansetu.vercel.app/admin/cloudinary-pool'
          });
        }
        console.log(`[CloudinaryPool] 📧 Status toggle (${actionType}) email sent to ${recipients.length} rootadmin(s)`);
      } catch (emailErr) {
        console.error('[CloudinaryPool] Failed to dispatch toggle status email:', emailErr.message);
      }
    })();

    res.json({
      success: true,
      message: `Account ${accountIndex} (${cloudName}) ${enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    console.error('Error toggling account:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle account',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/cloudinary/reset-monthly
 * Manually trigger a monthly reset of all upload counters.
 */
router.post('/reset-monthly', verifyToken, requireAdmin, async (req, res) => {
  try {
    await resetMonthlyCounters();

    res.json({
      success: true,
      message: 'Monthly counters reset successfully for all accounts'
    });
  } catch (error) {
    console.error('Error resetting monthly counters:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset monthly counters',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/cloudinary/fetch-real-usage
 * Manually trigger a real usage fetch from Cloudinary API for ALL accounts.
 */
router.post('/fetch-real-usage', verifyToken, requireAdmin, async (req, res) => {
  try {
    const results = await fetchAllRealUsage();
    const successful = results.filter(r => r !== null);

    // Also check and send alerts if any account is down or low on credits
    getPoolStatus().then(status => checkAndSendCloudinaryAlerts(status)).catch(e => console.error('Alert check error:', e));

    res.json({
      success: true,
      message: `Fetched real usage for ${successful.length}/${results.length} accounts`,
      results: successful,
    });
  } catch (error) {
    console.error('Error fetching real usage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch real usage',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/cloudinary/:accountIndex/fetch-usage
 * Fetch real usage for a single account.
 */
router.post('/:accountIndex/fetch-usage', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { accountIndex } = req.params;
    const result = await fetchRealUsageForAccount(parseInt(accountIndex));

    if (!result) {
      return res.status(404).json({
        success: false,
        message: `Account ${accountIndex} not found or fetch failed`
      });
    }

    res.json({
      success: true,
      message: `Fetched real usage for account ${accountIndex}`,
      result,
    });
  } catch (error) {
    console.error('Error fetching account usage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch account usage',
      error: error.message
    });
  }
});

export default router;
