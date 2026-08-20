import cron from 'node-cron';
import User from '../models/user.model.js';
import {
  resetMonthlyCounters,
  getPoolStatus,
  fetchAllRealUsage,
} from '../utils/cloudinaryPool.js';
import {
  sendCloudinaryAccountDownEmail,
  sendCloudinaryLowCreditsEmail,
} from '../utils/emailService.js';

/**
 * Cloudinary Pool Schedulers:
 * 
 * 1. MONTHLY RESET — 1st of each month at 00:05 UTC
 *    Resets our internal upload counters + re-enables auto-disabled accounts
 * 
 * 2. REAL USAGE CHECK — Every 6 hours
 *    Calls Cloudinary's API to fetch actual credit/bandwidth/storage usage
 *    Auto-disables accounts at 90%+ credit usage
 *    Sends automated emails to rootadmin if accounts are down or low on credits (< 15)
 */

/**
 * Get active Root Admin recipients for alert emails
 */
export const getRootAdminRecipients = async () => {
  try {
    const rootAdmins = await User.find({
      status: { $ne: 'suspended' },
      $or: [
        { role: 'rootadmin' },
        { isDefaultAdmin: true }
      ]
    }).select('email username role');

    if (rootAdmins.length > 0) {
      // Deduplicate by email
      const seen = new Set();
      const recipients = [];
      for (const admin of rootAdmins) {
        if (admin.email && !seen.has(admin.email.toLowerCase())) {
          seen.add(admin.email.toLowerCase());
          recipients.push({ email: admin.email, username: admin.username || 'Root Admin' });
        }
      }
      if (recipients.length > 0) return recipients;
    }
  } catch (err) {
    console.error('[CloudinaryPool Scheduler] Error fetching rootadmin users:', err.message);
  }

  // Fallback to EMAIL_USER or ADMIN_EMAIL env var
  const fallbackEmail = process.env.EMAIL_USER || process.env.ADMIN_EMAIL;
  return fallbackEmail ? [{ email: fallbackEmail, username: 'Root Admin' }] : [];
};

/**
 * Check pool status and send automated alerts to rootadmin:
 * 1. Account(s) Down or with API / Authentication errors
 * 2. Account(s) Low on credits (< 15 credits remaining or >= 85% used)
 * 
 * @param {Array} status - Pool status array from getPoolStatus()
 */
export const checkAndSendCloudinaryAlerts = async (status) => {
  if (!status || status.length === 0) return;

  const recipients = await getRootAdminRecipients();
  if (recipients.length === 0) {
    console.warn('[CloudinaryPool Scheduler] ⚠️ No rootadmin email recipient found to send alerts to.');
    return;
  }

  const DASHBOARD_URL = 'https://urbansetu.vercel.app/admin/cloudinary-pool';

  // ─── 1. Check for Down / Errored Accounts ────────────────────
  const downAccounts = status.filter(a => {
    // API fetch error
    const hasFetchError = Boolean(a.realUsageFetchError);
    // High failure count
    const hasFailures = typeof a.failureCount === 'number' && a.failureCount >= 3;
    // Auto-disabled due to failure / error
    const isDisabledFromError = !a.isEnabled && a.notes && /failure|error|unreachable/i.test(a.notes);

    return hasFetchError || hasFailures || isDisabledFromError;
  });

  if (downAccounts.length > 0) {
    console.warn(`[CloudinaryPool Scheduler] 🚨 Detected ${downAccounts.length} down/errored account(s). Sending alert email to rootadmin...`);
    for (const recipient of recipients) {
      try {
        await sendCloudinaryAccountDownEmail({
          to: recipient.email,
          recipientName: recipient.username,
          downAccounts,
          dashboardUrl: DASHBOARD_URL,
        });
        console.log(`[CloudinaryPool Scheduler] 📧 Down account alert sent to ${recipient.email}`);
      } catch (emailErr) {
        console.error(`[CloudinaryPool Scheduler] ❌ Failed to send down account email to ${recipient.email}:`, emailErr.message);
      }
    }
  }

  // ─── 2. Check for Low Credits (< 15 credits remaining or >= 85% used) ─
  const lowCreditAccounts = status.filter(a => {
    if (!a.realUsageLastFetchedAt) return false;
    const limit = typeof a.realCreditsLimit === 'number' ? a.realCreditsLimit : 25;
    const used = typeof a.realCreditsUsed === 'number' ? a.realCreditsUsed : 0;
    const remaining = Math.max(0, limit - used);
    const usedPercent = typeof a.realCreditsUsedPercent === 'number' ? a.realCreditsUsedPercent : (used / limit) * 100;

    // Condition: remaining credits < 15 OR used percent >= 85% OR auto-disabled at 90%+
    return remaining < 15 || usedPercent >= 85 || (!a.isEnabled && a.notes && /Auto-disabled:.*credits/i.test(a.notes));
  });

  if (lowCreditAccounts.length > 0) {
    console.warn(`[CloudinaryPool Scheduler] ⚠️ Detected ${lowCreditAccounts.length} low-credit account(s) (< 15 credits left). Sending alert email to rootadmin...`);
    for (const recipient of recipients) {
      try {
        await sendCloudinaryLowCreditsEmail({
          to: recipient.email,
          recipientName: recipient.username,
          lowCreditAccounts,
          dashboardUrl: DASHBOARD_URL,
        });
        console.log(`[CloudinaryPool Scheduler] 📧 Low credit alert sent to ${recipient.email}`);
      } catch (emailErr) {
        console.error(`[CloudinaryPool Scheduler] ❌ Failed to send low credit email to ${recipient.email}:`, emailErr.message);
      }
    }
  }
};

const startCloudinaryResetScheduler = () => {
  // ─── Monthly Reset: 1st of each month at 00:05 UTC ─────────
  cron.schedule('5 0 1 * *', async () => {
    console.log('\n[CloudinaryPool Scheduler] 📅 Monthly reset triggered at', new Date().toISOString());

    try {
      await resetMonthlyCounters();

      // Also fetch real usage right after reset (fresh month data)
      console.log('[CloudinaryPool Scheduler] Fetching real usage from Cloudinary API...');
      await fetchAllRealUsage();

      // Log status summary
      const status = await getPoolStatus();
      const enabledCount = status.filter(a => a.isEnabled).length;
      const totalUploads = status.reduce((sum, a) => sum + a.uploadCount, 0);

      console.log(`[CloudinaryPool Scheduler] Summary:`);
      console.log(`  - Total accounts: ${status.length}`);
      console.log(`  - Enabled accounts: ${enabledCount}`);
      console.log(`  - Lifetime uploads across all accounts: ${totalUploads}`);

      // Check alerts after reset
      await checkAndSendCloudinaryAlerts(status);

      console.log('[CloudinaryPool Scheduler] ✅ Monthly reset complete\n');
    } catch (error) {
      console.error('[CloudinaryPool Scheduler] ❌ Monthly reset failed:', error.message);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  // ─── Real Usage Check: Every 6 hours ───────────────────────
  cron.schedule('0 */6 * * *', async () => {
    console.log('\n[CloudinaryPool Scheduler] 📊 Real usage check triggered at', new Date().toISOString());

    try {
      await fetchAllRealUsage();
      const status = await getPoolStatus();

      // Log summary with credit usage
      const accountSummary = status.map(a => {
        const creditInfo = a.realUsageLastFetchedAt
          ? `${a.realCreditsUsedPercent.toFixed(1)}% credits used`
          : 'no data yet';
        return `  Account ${a.accountIndex} (${a.cloudName}): ${creditInfo} | ${a.monthlyUploadCount} uploads this month | ${a.isEnabled ? '✅ enabled' : '❌ disabled'}`;
      }).join('\n');

      console.log(`[CloudinaryPool Scheduler] Account Status:\n${accountSummary}`);

      // Check and send automated alert emails for down accounts & low credit (<15) accounts
      await checkAndSendCloudinaryAlerts(status);

      console.log('[CloudinaryPool Scheduler] ✅ Real usage check complete\n');
    } catch (error) {
      console.error('[CloudinaryPool Scheduler] ❌ Real usage check failed:', error.message);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('[CloudinaryPool Scheduler] 📅 Monthly reset scheduled for 1st of each month at 00:05 UTC');
  console.log('[CloudinaryPool Scheduler] 📊 Real usage check scheduled every 6 hours (with automated rootadmin email alerts)');
};

export default startCloudinaryResetScheduler;
