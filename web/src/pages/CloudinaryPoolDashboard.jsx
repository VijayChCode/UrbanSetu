import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FaCloud, FaSync, FaCheckCircle, FaTimesCircle, FaExclamationTriangle,
  FaArrowLeft, FaDatabase, FaChartBar, FaToggleOn, FaToggleOff,
  FaServer, FaClock, FaUpload, FaHdd, FaBolt, FaEye
} from 'react-icons/fa';
import { authenticatedFetch } from '../utils/auth';
import { usePageTitle } from '../hooks/usePageTitle';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ─── Skeleton Components ─────────────────────────────────────────
const SkeletonPulse = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />
);

const StatCardSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border border-gray-100 dark:border-gray-700">
    <div className="flex items-center justify-between mb-3">
      <SkeletonPulse className="h-4 w-24" />
      <SkeletonPulse className="h-8 w-8 rounded-full" />
    </div>
    <SkeletonPulse className="h-8 w-16 mb-2" />
    <SkeletonPulse className="h-3 w-32" />
  </div>
);

const AccountCardSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <SkeletonPulse className="h-10 w-10 rounded-full" />
        <div>
          <SkeletonPulse className="h-4 w-32 mb-2" />
          <SkeletonPulse className="h-3 w-20" />
        </div>
      </div>
      <SkeletonPulse className="h-6 w-16 rounded-full" />
    </div>
    <SkeletonPulse className="h-3 w-full rounded-full mb-4" />
    <div className="grid grid-cols-3 gap-3">
      <SkeletonPulse className="h-16 rounded-lg" />
      <SkeletonPulse className="h-16 rounded-lg" />
      <SkeletonPulse className="h-16 rounded-lg" />
    </div>
  </div>
);

// ─── Helper Components ───────────────────────────────────────────
const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatTimeAgo = (date) => {
  if (!date) return 'Never';
  const now = new Date();
  const diff = Math.floor((now - new Date(date)) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const CreditBar = ({ used, limit, percent }) => {
  const getBarColor = (p) => {
    if (p >= 90) return 'bg-red-500';
    if (p >= 75) return 'bg-orange-500';
    if (p >= 50) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500 dark:text-gray-400">
          {typeof used === 'number' ? used.toFixed(1) : '0'} / {typeof limit === 'number' ? limit : '25'} credits
        </span>
        <span className={`font-semibold ${percent >= 90 ? 'text-red-500' : percent >= 75 ? 'text-orange-500' : 'text-emerald-500'}`}>
          {typeof percent === 'number' ? percent.toFixed(1) : '0'}%
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${getBarColor(percent || 0)}`}
          style={{ width: `${Math.min(percent || 0, 100)}%` }}
        />
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────
export default function CloudinaryPoolDashboard() {
  usePageTitle("Cloudinary Pool Dashboard - Infrastructure Monitor");

  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();

  const [poolData, setPoolData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchingRealUsage, setFetchingRealUsage] = useState(false);
  const [fetchingSingleAccount, setFetchingSingleAccount] = useState(null);
  const [togglingAccount, setTogglingAccount] = useState(null);
  const [resettingCounters, setResettingCounters] = useState(false);

  // Access guard
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'rootadmin') {
      toast.error('Access denied. Root admin only.');
      navigate('/admin/settings');
    }
  }, [currentUser, navigate]);

  // Fetch pool status
  const fetchPoolStatus = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/cloudinary/pool-status`);
      const data = await res.json();
      if (data.success) {
        setPoolData(data);
      } else {
        toast.error('Failed to fetch pool status');
      }
    } catch (err) {
      console.error('Error fetching pool status:', err);
      toast.error('Error fetching pool status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPoolStatus();
  }, [fetchPoolStatus]);

  // Fetch real usage for ALL accounts
  const handleFetchAllRealUsage = async () => {
    setFetchingRealUsage(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/cloudinary/fetch-real-usage`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        await fetchPoolStatus(); // Refresh data
      } else {
        toast.error(data.message || 'Failed to fetch real usage');
      }
    } catch (err) {
      console.error('Error fetching real usage:', err);
      toast.error('Error fetching real usage from Cloudinary');
    } finally {
      setFetchingRealUsage(false);
    }
  };

  // Fetch real usage for a SINGLE account
  const handleFetchSingleUsage = async (accountIndex) => {
    setFetchingSingleAccount(accountIndex);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/cloudinary/${accountIndex}/fetch-usage`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Updated usage for account ${accountIndex}`);
        await fetchPoolStatus();
      } else {
        toast.error(data.message || 'Failed to fetch usage');
      }
    } catch (err) {
      toast.error('Error fetching account usage');
    } finally {
      setFetchingSingleAccount(null);
    }
  };

  // Toggle account enabled/disabled
  const handleToggleAccount = async (accountIndex, currentEnabled) => {
    setTogglingAccount(accountIndex);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/cloudinary/${accountIndex}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: !currentEnabled,
          note: `Manually ${!currentEnabled ? 'enabled' : 'disabled'} by ${currentUser.username}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        await fetchPoolStatus();
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error('Error toggling account');
    } finally {
      setTogglingAccount(null);
    }
  };

  // Reset monthly counters
  const handleResetMonthly = async () => {
    if (!window.confirm('Are you sure you want to reset monthly counters for all accounts?')) return;
    setResettingCounters(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/cloudinary/reset-monthly`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        await fetchPoolStatus();
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error('Error resetting counters');
    } finally {
      setResettingCounters(false);
    }
  };

  if (currentUser?.role !== 'rootadmin') return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* ─── Header ─────────────────────────────────────────── */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin/settings')}
            className="flex items-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-4 group"
          >
            <FaArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Settings
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                  <FaCloud className="w-6 h-6 text-white" />
                </div>
                Cloudinary Pool Dashboard
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Multi-account rotation & usage monitoring
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleFetchAllRealUsage}
                disabled={fetchingRealUsage}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 ${
                  fetchingRealUsage
                    ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed text-gray-500'
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
                }`}
              >
                <FaSync className={`w-3.5 h-3.5 ${fetchingRealUsage ? 'animate-spin' : ''}`} />
                {fetchingRealUsage ? 'Fetching...' : 'Check All Accounts'}
              </button>

              <button
                onClick={handleResetMonthly}
                disabled={resettingCounters}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 ${
                  resettingCounters
                    ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed text-gray-500'
                    : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white'
                }`}
              >
                <FaDatabase className={`w-3.5 h-3.5 ${resettingCounters ? 'animate-pulse' : ''}`} />
                {resettingCounters ? 'Resetting...' : 'Reset Monthly'}
              </button>

              <button
                onClick={fetchPoolStatus}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-md"
              >
                <FaEye className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ─── Summary Cards ──────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[...Array(6)].map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : poolData?.summary ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <StatCard
              title="Total Accounts"
              value={poolData.summary.totalAccounts}
              icon={FaServer}
              color="blue"
            />
            <StatCard
              title="Enabled"
              value={poolData.summary.enabledAccounts}
              icon={FaCheckCircle}
              color="emerald"
            />
            <StatCard
              title="Disabled"
              value={poolData.summary.disabledAccounts}
              icon={FaTimesCircle}
              color="red"
            />
            <StatCard
              title="Uploads (Month)"
              value={poolData.summary.totalUploadsThisMonth}
              icon={FaUpload}
              color="purple"
            />
            <StatCard
              title="Uploads (All)"
              value={poolData.summary.totalUploadsAllTime}
              icon={FaChartBar}
              color="indigo"
            />
            <StatCard
              title="Bandwidth (Month)"
              value={formatBytes(poolData.summary.totalBytesThisMonth)}
              icon={FaHdd}
              color="teal"
              isText
            />
          </div>
        ) : null}

        {/* ─── Fetching Real Usage Overlay ─────────────────────── */}
        {fetchingRealUsage && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 border-4 border-blue-200 dark:border-blue-800 rounded-full" />
              <div className="absolute top-0 left-0 w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <div>
              <p className="font-semibold text-blue-800 dark:text-blue-200">Fetching real usage from Cloudinary API...</p>
              <p className="text-sm text-blue-600 dark:text-blue-400">Checking credit usage, bandwidth, and storage for all accounts. This may take a moment.</p>
            </div>
          </div>
        )}

        {/* ─── Account Cards ──────────────────────────────────── */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <FaDatabase className="text-blue-500" />
            Account Details
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {poolData?.accounts?.length || 0} account(s) in the rotation pool
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => <AccountCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {poolData?.accounts?.map((account) => (
              <AccountCard
                key={account.accountIndex}
                account={account}
                onToggle={handleToggleAccount}
                onFetchUsage={handleFetchSingleUsage}
                isToggling={togglingAccount === account.accountIndex}
                isFetchingUsage={fetchingSingleAccount === account.accountIndex}
              />
            ))}
          </div>
        )}

        {/* ─── Empty State ────────────────────────────────────── */}
        {!loading && (!poolData?.accounts || poolData.accounts.length === 0) && (
          <div className="text-center py-16">
            <FaCloud className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-500 dark:text-gray-400 mb-2">
              No Cloudinary Accounts Found
            </h3>
            <p className="text-gray-400 dark:text-gray-500 max-w-md mx-auto">
              Add CLOUDINARY_POOL_0_CLOUD_NAME, CLOUDINARY_POOL_0_API_KEY, and CLOUDINARY_POOL_0_API_SECRET
              environment variables to configure the pool.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stat Card Component ─────────────────────────────────────────
function StatCard({ title, value, icon: Icon, color, isText = false }) {
  const colorMap = {
    blue: 'from-blue-500 to-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
    emerald: 'from-emerald-500 to-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30',
    red: 'from-red-500 to-red-600 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30',
    purple: 'from-purple-500 to-purple-600 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30',
    indigo: 'from-indigo-500 to-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30',
    teal: 'from-teal-500 to-teal-600 text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30',
  };

  const colors = colorMap[color] || colorMap.blue;
  const [bg, textColor, iconBg] = [
    colors.split(' ').slice(0, 2).join(' '),
    colors.split(' ').slice(2, 4).join(' '),
    colors.split(' ').slice(4).join(' '),
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <Icon className={`w-4 h-4 ${textColor}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold text-gray-900 dark:text-white ${isText ? 'text-lg' : ''}`}>
        {value}
      </p>
    </div>
  );
}

// ─── Account Card Component ──────────────────────────────────────
function AccountCard({ account, onToggle, onFetchUsage, isToggling, isFetchingUsage }) {
  const hasRealData = !!account.realUsageLastFetchedAt;
  const isNearLimit = account.realCreditsUsedPercent >= 75;
  const isOverLimit = account.realCreditsUsedPercent >= 90;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border transition-all duration-300 hover:shadow-xl ${
      !account.isEnabled
        ? 'border-red-200 dark:border-red-800/50 opacity-75'
        : isOverLimit
          ? 'border-red-300 dark:border-red-700'
          : isNearLimit
            ? 'border-orange-200 dark:border-orange-800/50'
            : 'border-gray-100 dark:border-gray-700'
    }`}>
      {/* Header */}
      <div className="p-5 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
              !account.isEnabled
                ? 'bg-gray-400 dark:bg-gray-600'
                : isOverLimit
                  ? 'bg-gradient-to-br from-red-500 to-red-600'
                  : isNearLimit
                    ? 'bg-gradient-to-br from-orange-500 to-orange-600'
                    : 'bg-gradient-to-br from-blue-500 to-purple-600'
            }`}>
              {account.accountIndex}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                {account.cloudName}
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Account #{account.accountIndex}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status badge */}
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              !account.isEnabled
                ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
            }`}>
              {account.isEnabled ? '● Active' : '○ Disabled'}
            </span>
          </div>
        </div>

        {/* Credit Usage Bar */}
        {hasRealData ? (
          <CreditBar
            used={account.realCreditsUsed}
            limit={account.realCreditsLimit}
            percent={account.realCreditsUsedPercent}
          />
        ) : (
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 py-1">
            <FaClock className="w-3 h-3" />
            No real usage data yet — click "Check" to fetch from Cloudinary
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="p-5 pt-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Month Uploads</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{account.monthlyUploadCount}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Uploads</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{account.uploadCount}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Failures</p>
            <p className={`text-lg font-bold ${account.failureCount > 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
              {account.failureCount}
            </p>
          </div>
        </div>

        {/* Real Usage Details (if available) */}
        {hasRealData && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5">
              <p className="text-[10px] text-blue-500 dark:text-blue-400 font-medium uppercase tracking-wider">Bandwidth</p>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                {formatBytes(account.realBandwidthUsed)}
                <span className="text-[10px] text-blue-400 dark:text-blue-500 ml-1">
                  / {formatBytes(account.realBandwidthLimit)}
                </span>
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2.5">
              <p className="text-[10px] text-purple-500 dark:text-purple-400 font-medium uppercase tracking-wider">Storage</p>
              <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                {formatBytes(account.realStorageUsed)}
                <span className="text-[10px] text-purple-400 dark:text-purple-500 ml-1">
                  / {formatBytes(account.realStorageLimit)}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Meta info */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-gray-500 mb-4">
          <span className="flex items-center gap-1">
            <FaUpload className="w-2.5 h-2.5" />
            Last: {formatTimeAgo(account.lastUploadAt)}
          </span>
          <span className="flex items-center gap-1">
            <FaHdd className="w-2.5 h-2.5" />
            Month: {formatBytes(account.monthlyBytesUploaded)}
          </span>
          {hasRealData && (
            <span className="flex items-center gap-1">
              <FaSync className="w-2.5 h-2.5" />
              Checked: {formatTimeAgo(account.realUsageLastFetchedAt)}
            </span>
          )}
          {account.realUsageFetchError && (
            <span className="flex items-center gap-1 text-red-400">
              <FaExclamationTriangle className="w-2.5 h-2.5" />
              Fetch error: {account.realUsageFetchError}
            </span>
          )}
        </div>

        {/* Last failure message */}
        {account.lastFailureMessage && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2.5 mb-4">
            <p className="text-xs text-red-600 dark:text-red-300">
              <FaExclamationTriangle className="inline w-3 h-3 mr-1" />
              Last failure: {account.lastFailureMessage}
            </p>
            {account.lastFailureAt && (
              <p className="text-[10px] text-red-400 dark:text-red-500 mt-0.5">
                {formatTimeAgo(account.lastFailureAt)}
              </p>
            )}
          </div>
        )}

        {/* Notes */}
        {account.notes && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-2.5 mb-4">
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              📝 {account.notes}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => onFetchUsage(account.accountIndex)}
            disabled={isFetchingUsage}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              isFetchingUsage
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50'
            }`}
          >
            <FaSync className={`w-3 h-3 ${isFetchingUsage ? 'animate-spin' : ''}`} />
            {isFetchingUsage ? 'Checking...' : 'Check Status'}
          </button>

          <button
            onClick={() => onToggle(account.accountIndex, account.isEnabled)}
            disabled={isToggling}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              isToggling
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                : account.isEnabled
                  ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50'
                  : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
            }`}
          >
            {isToggling ? (
              <FaBolt className="w-3 h-3 animate-pulse" />
            ) : account.isEnabled ? (
              <FaToggleOff className="w-3 h-3" />
            ) : (
              <FaToggleOn className="w-3 h-3" />
            )}
            {isToggling ? 'Updating...' : account.isEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>
    </div>
  );
}
