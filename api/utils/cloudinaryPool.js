import cloudinary from 'cloudinary';
import CloudinaryAccount from '../models/cloudinaryAccount.model.js';

/**
 * CloudinaryPool — Multi-account rotation manager
 * 
 * Reads CLOUDINARY_POOL_<N>_CLOUD_NAME / API_KEY / API_SECRET from env,
 * tracks usage per account in MongoDB, and always picks the least-used
 * enabled account for the next upload.
 * 
 * For delete operations, resolves the correct account from the cloud name
 * embedded in the Cloudinary URL.
 */

// In-memory cache of account credentials (loaded from env on init)
let accountPool = [];
let initialized = false;

/**
 * Load all CLOUDINARY_POOL_* env vars into memory.
 * Also supports legacy single-account vars as fallback (index 0).
 */
function loadAccountsFromEnv() {
  const accounts = [];

  // Try indexed pool vars: CLOUDINARY_POOL_0_CLOUD_NAME, etc.
  for (let i = 0; i < 50; i++) {
    const cloudName = process.env[`CLOUDINARY_POOL_${i}_CLOUD_NAME`];
    const apiKey = process.env[`CLOUDINARY_POOL_${i}_API_KEY`];
    const apiSecret = process.env[`CLOUDINARY_POOL_${i}_API_SECRET`];

    if (cloudName && apiKey && apiSecret) {
      accounts.push({ index: i, cloudName, apiKey, apiSecret });
    }
  }

  // Fallback: if no pool vars found, use legacy single-account vars
  if (accounts.length === 0) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (cloudName && apiKey && apiSecret) {
      accounts.push({ index: 0, cloudName, apiKey, apiSecret });
      console.log('[CloudinaryPool] No pool vars found, using legacy single-account config');
    }
  }

  return accounts;
}

/**
 * Initialize the pool: load env vars, sync with MongoDB.
 * Called once on server startup.
 */
export async function initializePool() {
  if (initialized) return;

  accountPool = loadAccountsFromEnv();

  if (accountPool.length === 0) {
    console.error('[CloudinaryPool] ❌ No Cloudinary accounts configured! Check env vars.');
    return;
  }

  console.log(`[CloudinaryPool] Found ${accountPool.length} Cloudinary account(s) in env`);

  // Sync each account with MongoDB (upsert)
  for (const acc of accountPool) {
    try {
      await CloudinaryAccount.findOneAndUpdate(
        { accountIndex: acc.index },
        {
          $setOnInsert: {
            cloudName: acc.cloudName,
            accountIndex: acc.index,
            isEnabled: true,
            uploadCount: 0,
            totalBytesUploaded: 0,
            monthlyUploadCount: 0,
            monthlyBytesUploaded: 0,
            monthlyResetAt: new Date(),
            failureCount: 0,
          },
          $set: {
            cloudName: acc.cloudName, // Update cloud name if changed
          }
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error(`[CloudinaryPool] Error syncing account ${acc.index} (${acc.cloudName}):`, err.message);
    }
  }

  // Disable any DB accounts that are no longer in env
  const activeIndices = accountPool.map(a => a.index);
  await CloudinaryAccount.updateMany(
    { accountIndex: { $nin: activeIndices } },
    { $set: { isEnabled: false, notes: 'Removed from env — auto-disabled' } }
  );

  initialized = true;
  console.log(`[CloudinaryPool] ✅ Pool initialized with ${accountPool.length} account(s)`);
}

/**
 * Get the credentials for a specific account index from the in-memory pool.
 */
function getCredentials(accountIndex) {
  return accountPool.find(a => a.index === accountIndex) || null;
}

/**
 * Get credentials by cloud name (for delete operations).
 */
function getCredentialsByCloudName(cloudName) {
  return accountPool.find(a => a.cloudName === cloudName) || null;
}

/**
 * Select the next account to use.
 * 
 * Strategy (smart selection):
 * 1. Filter out accounts with real credits >= 90% used (near limit)
 * 2. Among remaining, pick the one with least realCreditsUsedPercent
 * 3. Tie-break: least monthly uploads → least total uploads → random
 * 4. Fallback: if no real usage data, use monthlyUploadCount (our tracking)
 * 
 * @param {string[]} [excludeIndices] - Account indices to skip (e.g. after failure)
 * @returns {Object|null} { accountIndex, cloudName, apiKey, apiSecret }
 */
export async function getNextAccount(excludeIndices = []) {
  if (!initialized) await initializePool();

  // Get all enabled accounts from DB
  const enabledAccounts = await CloudinaryAccount.find({
    isEnabled: true,
    accountIndex: { $nin: excludeIndices },
  }).lean();

  if (enabledAccounts.length === 0) {
    console.error('[CloudinaryPool] ❌ No enabled accounts available!');
    return null;
  }

  // Check if we have real usage data (fetched at least once)
  const hasRealData = enabledAccounts.some(a => a.realUsageLastFetchedAt !== null);

  let sorted;
  if (hasRealData) {
    // Smart mode: prefer accounts with lowest real credit usage percentage
    // Filter out accounts at 90%+ real usage
    const safeAccounts = enabledAccounts.filter(a => {
      if (!a.realUsageLastFetchedAt) return true; // No data yet, assume safe
      return a.realCreditsUsedPercent < 90;
    });

    const pool = safeAccounts.length > 0 ? safeAccounts : enabledAccounts; // fallback if all near limit
    sorted = pool.sort((a, b) => {
      // Primary: real credit usage %
      const realDiff = (a.realCreditsUsedPercent || 0) - (b.realCreditsUsedPercent || 0);
      if (realDiff !== 0) return realDiff;
      // Secondary: our monthly upload count
      const monthlyDiff = a.monthlyUploadCount - b.monthlyUploadCount;
      if (monthlyDiff !== 0) return monthlyDiff;
      // Tertiary: total uploads
      return a.uploadCount - b.uploadCount;
    });
  } else {
    // Fallback mode: use our own monthly upload tracking
    sorted = enabledAccounts.sort((a, b) => {
      const monthlyDiff = a.monthlyUploadCount - b.monthlyUploadCount;
      if (monthlyDiff !== 0) return monthlyDiff;
      return a.uploadCount - b.uploadCount;
    });
  }

  // Pick from the top candidates (tie-break by random)
  const bestValue = hasRealData
    ? (sorted[0].realCreditsUsedPercent || 0)
    : sorted[0].monthlyUploadCount;
  const candidates = sorted.filter(a => {
    const val = hasRealData ? (a.realCreditsUsedPercent || 0) : a.monthlyUploadCount;
    return val === bestValue;
  });
  const selected = candidates[Math.floor(Math.random() * candidates.length)];

  // Get credentials from in-memory pool
  const creds = getCredentials(selected.accountIndex);
  if (!creds) {
    console.error(`[CloudinaryPool] Account ${selected.accountIndex} in DB but not in env!`);
    return getNextAccount([...excludeIndices, selected.accountIndex]);
  }

  return {
    accountIndex: creds.index,
    cloudName: creds.cloudName,
    apiKey: creds.apiKey,
    apiSecret: creds.apiSecret,
  };
}

/**
 * Create a configured cloudinary instance for a specific account.
 * Returns a fresh cloudinary.v2 config object.
 * 
 * IMPORTANT: cloudinary.v2 is a singleton, so we configure it in-place
 * and return the reference. Callers should use this immediately and
 * not store it long-term.
 * 
 * @param {Object} account - { cloudName, apiKey, apiSecret }
 * @returns {Object} cloudinary.v2 configured instance
 */
export function configureCloudinaryInstance(account) {
  cloudinary.v2.config({
    cloud_name: account.cloudName,
    api_key: account.apiKey,
    api_secret: account.apiSecret,
  });
  return cloudinary.v2;
}

/**
 * Get a ready-to-use cloudinary instance with the least-used account.
 * Returns both the instance and account info (for recording after upload).
 * 
 * @param {string[]} [excludeIndices] - Indices to skip
 * @returns {{ instance: Object, account: Object }|null}
 */
export async function getCloudinaryInstance(excludeIndices = []) {
  const account = await getNextAccount(excludeIndices);
  if (!account) return null;

  const instance = configureCloudinaryInstance(account);
  return { instance, account };
}

/**
 * Get a cloudinary instance for a specific cloud name.
 * Used for delete operations where you need to use the same account
 * that originally uploaded the file.
 * 
 * @param {string} cloudName - The cloud_name to find
 * @returns {{ instance: Object, account: Object }|null}
 */
export function getCloudinaryInstanceByCloudName(cloudName) {
  const creds = getCredentialsByCloudName(cloudName);
  if (!creds) {
    console.warn(`[CloudinaryPool] Cloud name "${cloudName}" not found in pool, using first available`);
    // Fallback: use first account (for legacy URLs)
    if (accountPool.length > 0) {
      const fallback = accountPool[0];
      return {
        instance: configureCloudinaryInstance(fallback),
        account: fallback,
      };
    }
    return null;
  }

  return {
    instance: configureCloudinaryInstance(creds),
    account: creds,
  };
}

/**
 * Extract cloud name from a Cloudinary URL.
 * URL format: https://res.cloudinary.com/<cloud_name>/image/upload/...
 * 
 * @param {string} url - Cloudinary URL
 * @returns {string|null}
 */
export function extractCloudNameFromUrl(url) {
  if (!url) return null;
  try {
    const match = url.match(/res\.cloudinary\.com\/([^/]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Record a successful upload for the given account.
 * 
 * @param {number} accountIndex
 * @param {number} [bytes=0] - File size in bytes
 */
export async function recordUpload(accountIndex, bytes = 0) {
  try {
    await CloudinaryAccount.findOneAndUpdate(
      { accountIndex },
      {
        $inc: {
          uploadCount: 1,
          monthlyUploadCount: 1,
          totalBytesUploaded: bytes,
          monthlyBytesUploaded: bytes,
        },
        $set: {
          lastUploadAt: new Date(),
          failureCount: 0, // Reset failure count on success
        },
      }
    );
  } catch (err) {
    console.error(`[CloudinaryPool] Error recording upload for account ${accountIndex}:`, err.message);
  }
}

/**
 * Record a failure for the given account.
 * Auto-disables account if failure count exceeds threshold.
 * 
 * @param {number} accountIndex
 * @param {string} [errorMessage]
 */
export async function recordFailure(accountIndex, errorMessage = '') {
  const FAILURE_THRESHOLD = 5;

  try {
    const updated = await CloudinaryAccount.findOneAndUpdate(
      { accountIndex },
      {
        $inc: { failureCount: 1 },
        $set: {
          lastFailureAt: new Date(),
          lastFailureMessage: errorMessage.substring(0, 500),
        },
      },
      { new: true }
    );

    if (updated && updated.failureCount >= FAILURE_THRESHOLD) {
      await CloudinaryAccount.findOneAndUpdate(
        { accountIndex },
        {
          $set: {
            isEnabled: false,
            notes: `Auto-disabled after ${FAILURE_THRESHOLD} consecutive failures. Last error: ${errorMessage.substring(0, 200)}`,
          },
        }
      );
      console.warn(`[CloudinaryPool] ⚠️ Account ${accountIndex} (${updated.cloudName}) auto-disabled after ${FAILURE_THRESHOLD} failures`);
    }
  } catch (err) {
    console.error(`[CloudinaryPool] Error recording failure for account ${accountIndex}:`, err.message);
  }
}

/**
 * Reset monthly counters for all accounts.
 * Called by the monthly scheduler.
 */
export async function resetMonthlyCounters() {
  try {
    const result = await CloudinaryAccount.updateMany(
      {},
      {
        $set: {
          monthlyUploadCount: 0,
          monthlyBytesUploaded: 0,
          monthlyResetAt: new Date(),
        },
      }
    );
    console.log(`[CloudinaryPool] 🔄 Monthly counters reset for ${result.modifiedCount} account(s)`);

    // Re-enable auto-disabled accounts (new month = fresh credits)
    const reEnabled = await CloudinaryAccount.updateMany(
      {
        isEnabled: false,
        notes: { $regex: /^Auto-disabled/ },
      },
      {
        $set: {
          isEnabled: true,
          failureCount: 0,
          notes: 'Re-enabled on monthly reset',
        },
      }
    );
    if (reEnabled.modifiedCount > 0) {
      console.log(`[CloudinaryPool] ✅ Re-enabled ${reEnabled.modifiedCount} auto-disabled account(s)`);
    }
  } catch (err) {
    console.error('[CloudinaryPool] Error resetting monthly counters:', err.message);
  }
}

/**
 * Fetch real usage from Cloudinary API for a single account.
 * Calls cloudinary.v2.api.usage() with that account's credentials.
 * 
 * @param {number} accountIndex
 * @returns {Object|null} Usage data or null on error
 */
export async function fetchRealUsageForAccount(accountIndex) {
  const creds = getCredentials(accountIndex);
  if (!creds) return null;

  try {
    // Configure cloudinary with this account's credentials
    const instance = configureCloudinaryInstance(creds);
    const usage = await instance.api.usage();

    // Save to DB
    await CloudinaryAccount.findOneAndUpdate(
      { accountIndex },
      {
        $set: {
          realCreditsUsed: usage.credits?.usage || 0,
          realCreditsLimit: usage.credits?.limit || 25,
          realCreditsUsedPercent: usage.credits?.used_percent || 0,
          realBandwidthUsed: usage.bandwidth?.usage || 0,
          realBandwidthLimit: usage.bandwidth?.limit || 0,
          realStorageUsed: usage.storage?.usage || 0,
          realStorageLimit: usage.storage?.limit || 0,
          realTransformationsUsed: usage.transformations?.usage || 0,
          realTransformationsLimit: usage.transformations?.limit || 0,
          realUsageLastFetchedAt: new Date(),
          realUsageFetchError: null,
        },
      }
    );

    // Auto-disable if credits are 90%+ used
    const usedPercent = usage.credits?.used_percent || 0;
    if (usedPercent >= 90) {
      await CloudinaryAccount.findOneAndUpdate(
        { accountIndex },
        {
          $set: {
            isEnabled: false,
            notes: `Auto-disabled: ${usedPercent.toFixed(1)}% credits used (${usage.credits?.usage}/${usage.credits?.limit})`,
          },
        }
      );
      console.warn(`[CloudinaryPool] ⚠️ Account ${accountIndex} (${creds.cloudName}) auto-disabled at ${usedPercent.toFixed(1)}% credit usage`);
    }

    return {
      accountIndex,
      cloudName: creds.cloudName,
      credits: usage.credits,
      bandwidth: usage.bandwidth,
      storage: usage.storage,
      transformations: usage.transformations,
    };
  } catch (err) {
    console.error(`[CloudinaryPool] Error fetching usage for account ${accountIndex} (${creds.cloudName}):`, err.message);
    await CloudinaryAccount.findOneAndUpdate(
      { accountIndex },
      {
        $set: {
          realUsageFetchError: err.message,
          realUsageLastFetchedAt: new Date(),
        },
      }
    );
    return null;
  }
}

/**
 * Fetch real usage from Cloudinary API for ALL accounts in the pool.
 * Used by the scheduler and admin API.
 * 
 * @returns {Array} Results for each account
 */
export async function fetchAllRealUsage() {
  if (!initialized) await initializePool();

  const results = [];
  for (const acc of accountPool) {
    const result = await fetchRealUsageForAccount(acc.index);
    results.push(result);
    // Small delay between API calls to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const successful = results.filter(r => r !== null);
  console.log(`[CloudinaryPool] 📊 Fetched real usage for ${successful.length}/${accountPool.length} accounts`);
  return results;
}

/**
 * Get status of all accounts in the pool.
 * Used by admin API.
 * 
 * @returns {Array} Account status objects
 */
export async function getPoolStatus() {
  try {
    const accounts = await CloudinaryAccount.find().sort({ accountIndex: 1 }).lean();
    return accounts.map(acc => ({
      accountIndex: acc.accountIndex,
      cloudName: acc.cloudName,
      isEnabled: acc.isEnabled,
      // Our tracking
      uploadCount: acc.uploadCount,
      monthlyUploadCount: acc.monthlyUploadCount,
      monthlyBytesUploaded: acc.monthlyBytesUploaded,
      totalBytesUploaded: acc.totalBytesUploaded,
      lastUploadAt: acc.lastUploadAt,
      failureCount: acc.failureCount,
      lastFailureAt: acc.lastFailureAt,
      lastFailureMessage: acc.lastFailureMessage,
      monthlyResetAt: acc.monthlyResetAt,
      notes: acc.notes,
      hasCredentials: !!getCredentials(acc.accountIndex),
      // Real Cloudinary usage
      realCreditsUsed: acc.realCreditsUsed,
      realCreditsLimit: acc.realCreditsLimit,
      realCreditsUsedPercent: acc.realCreditsUsedPercent,
      realBandwidthUsed: acc.realBandwidthUsed,
      realBandwidthLimit: acc.realBandwidthLimit,
      realStorageUsed: acc.realStorageUsed,
      realStorageLimit: acc.realStorageLimit,
      realTransformationsUsed: acc.realTransformationsUsed,
      realTransformationsLimit: acc.realTransformationsLimit,
      realUsageLastFetchedAt: acc.realUsageLastFetchedAt,
      realUsageFetchError: acc.realUsageFetchError,
    }));
  } catch (err) {
    console.error('[CloudinaryPool] Error getting pool status:', err.message);
    return [];
  }
}

/**
 * Toggle an account's enabled state.
 * 
 * @param {number} accountIndex
 * @param {boolean} enabled
 * @param {string} [note]
 */
export async function toggleAccount(accountIndex, enabled, note = '') {
  try {
    await CloudinaryAccount.findOneAndUpdate(
      { accountIndex },
      {
        $set: {
          isEnabled: enabled,
          ...(note ? { notes: note } : {}),
          ...(enabled ? { failureCount: 0 } : {}),
        },
      }
    );
    console.log(`[CloudinaryPool] Account ${accountIndex} ${enabled ? 'enabled' : 'disabled'}${note ? ': ' + note : ''}`);
  } catch (err) {
    console.error(`[CloudinaryPool] Error toggling account ${accountIndex}:`, err.message);
  }
}

export default {
  initializePool,
  getNextAccount,
  getCloudinaryInstance,
  getCloudinaryInstanceByCloudName,
  extractCloudNameFromUrl,
  configureCloudinaryInstance,
  recordUpload,
  recordFailure,
  resetMonthlyCounters,
  getPoolStatus,
  toggleAccount,
  fetchRealUsageForAccount,
  fetchAllRealUsage,
};
