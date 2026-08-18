import cron from 'node-cron';
import {
  resetMonthlyCounters,
  getPoolStatus,
  fetchAllRealUsage,
} from '../utils/cloudinaryPool.js';

/**
 * Cloudinary Pool Schedulers:
 * 
 * 1. MONTHLY RESET — 1st of each month at 00:05 UTC
 *    Resets our internal upload counters + re-enables auto-disabled accounts
 * 
 * 2. REAL USAGE CHECK — Every 6 hours
 *    Calls Cloudinary's API to fetch actual credit/bandwidth/storage usage
 *    Auto-disables accounts at 90%+ credit usage
 */

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
      const results = await fetchAllRealUsage();
      const status = await getPoolStatus();

      // Log summary with credit usage
      const accountSummary = status.map(a => {
        const creditInfo = a.realUsageLastFetchedAt
          ? `${a.realCreditsUsedPercent.toFixed(1)}% credits used`
          : 'no data yet';
        return `  Account ${a.accountIndex} (${a.cloudName}): ${creditInfo} | ${a.monthlyUploadCount} uploads this month | ${a.isEnabled ? '✅ enabled' : '❌ disabled'}`;
      }).join('\n');

      console.log(`[CloudinaryPool Scheduler] Account Status:\n${accountSummary}`);

      // Warn about accounts nearing limit
      const nearLimit = status.filter(a => a.realCreditsUsedPercent >= 75 && a.isEnabled);
      if (nearLimit.length > 0) {
        console.warn(`[CloudinaryPool Scheduler] ⚠️ ${nearLimit.length} account(s) at 75%+ credit usage!`);
      }

      console.log('[CloudinaryPool Scheduler] ✅ Real usage check complete\n');
    } catch (error) {
      console.error('[CloudinaryPool Scheduler] ❌ Real usage check failed:', error.message);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('[CloudinaryPool Scheduler] 📅 Monthly reset scheduled for 1st of each month at 00:05 UTC');
  console.log('[CloudinaryPool Scheduler] 📊 Real usage check scheduled every 6 hours');
};

export default startCloudinaryResetScheduler;
