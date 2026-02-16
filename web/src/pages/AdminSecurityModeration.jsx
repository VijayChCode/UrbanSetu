import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { FaUnlockAlt, FaShieldAlt, FaLock, FaEye, FaEyeSlash, FaFilter, FaSearch, FaRedo, FaExclamationTriangle, FaCheckCircle, FaClock, FaUser, FaGlobe, FaEnvelope, FaKey } from 'react-icons/fa';
import { authenticatedFetch } from '../utils/auth';

import { usePageTitle } from '../hooks/usePageTitle';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminSecurityModeration() {
  // Set page title
  usePageTitle("Security Moderation - Safety Management");

  const { currentUser } = useSelector((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ recent: [], activeLockouts: 0, passwordLockouts: 0 });
  const [emailToUnlock, setEmailToUnlock] = useState("");
  const [ipToUnlock, setIpToUnlock] = useState("");
  const [passwordLockouts, setPasswordLockouts] = useState([]);
  const [loadingPasswords, setLoadingPasswords] = useState(false);
  const [passwordEmailToUnlock, setPasswordEmailToUnlock] = useState("");
  const [passwordUserIdToUnlock, setPasswordUserIdToUnlock] = useState("");
  const [passwordIpToUnlock, setPasswordIpToUnlock] = useState("");
  const [passwordIdentifierToUnlock, setPasswordIdentifierToUnlock] = useState("");

  const [filters, setFilters] = useState({ email: '', ip: '', lockedOnly: false, captchaOnly: false });
  const [pwdFilters, setPwdFilters] = useState({ email: '', ip: '', identifier: '', userId: '' });
  const [otpRefreshing, setOtpRefreshing] = useState(false);
  const [passwordRefreshing, setPasswordRefreshing] = useState(false);

  // Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/otp/stats`);
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Failed to fetch');
      const recent = data.recent || [];
      // Use server-provided activeLockouts count directly, with computed fallback only if server returns 0
      const computedActive = recent.filter(r => r.lockoutUntil && new Date(r.lockoutUntil) > new Date()).length;
      const activeLockouts = (data.activeLockouts || 0) === 0 && computedActive > 0 ? computedActive : (data.activeLockouts || 0);
      setStats({ recent, activeLockouts, passwordLockouts: data.passwordLockouts || 0 });
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  // Refresh only OTP activity and active lockouts, do not touch password lockouts count
  const fetchOtpOnly = async () => {
    setOtpRefreshing(true);
    setError('');
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/otp/stats`);
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Failed to fetch');
      const recent = data.recent || [];
      const computedActive = recent.filter(r => r.lockoutUntil && new Date(r.lockoutUntil) > new Date()).length;
      const activeLockouts = (data.activeLockouts || 0) === 0 && computedActive > 0 ? computedActive : (data.activeLockouts || 0);
      setStats(prev => ({ ...prev, recent, activeLockouts }));
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setOtpRefreshing(false);
    }
  };

  const fetchPasswordLockouts = async () => {
    setPasswordRefreshing(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/password-lockouts`);
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Failed to fetch password lockouts');
      setPasswordLockouts(data.items || []);
    } catch (e) {
      // show inline error but don't overwrite main error
      console.error(e);
    } finally {
      setPasswordRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchPasswordLockouts();
  }, []);

  const unlockByEmail = async () => {
    if (!emailToUnlock) return;
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/otp/unlock-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToUnlock })
      });
      await res.json();
      setEmailToUnlock('');
      fetchStats();
    } catch (_) { }
  };

  const unlockByIp = async () => {
    if (!ipToUnlock) return;
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/otp/unlock-ip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: ipToUnlock })
      });
      await res.json();
      setIpToUnlock('');
      fetchStats();
      fetchPasswordLockouts();
    } catch (_) { }
  };

  const unlockPasswordByEmailOrUser = async (payload) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/password-lockouts/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      await res.json();
      fetchStats();
      fetchPasswordLockouts();
    } catch (e) { }
  };

  const unlockPasswordByIp = async (ip) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/password-lockouts/unlock-ip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
      });
      await res.json();
      fetchStats();
      fetchPasswordLockouts();
    } catch (e) { }
  };

  const unlockPasswordByIdentifier = async (identifier) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/password-lockouts/unlock-identifier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });
      await res.json();
      fetchStats();
      fetchPasswordLockouts();
    } catch (e) { }
  };

  const handleUnlockPasswordEmail = async () => {
    if (!passwordEmailToUnlock) return;
    await unlockPasswordByEmailOrUser({ email: passwordEmailToUnlock.trim() });
    setPasswordEmailToUnlock('');
  };

  const handleUnlockPasswordUserId = async () => {
    if (!passwordUserIdToUnlock) return;
    await unlockPasswordByEmailOrUser({ userId: passwordUserIdToUnlock.trim() });
    setPasswordUserIdToUnlock('');
  };

  const handleUnlockPasswordIp = async () => {
    if (!passwordIpToUnlock) return;
    await unlockPasswordByIp(passwordIpToUnlock.trim());
    setPasswordIpToUnlock('');
  };

  const handleUnlockPasswordIdentifier = async () => {
    if (!passwordIdentifierToUnlock) return;
    await unlockPasswordByIdentifier(passwordIdentifierToUnlock.trim());
    setPasswordIdentifierToUnlock('');
  };

  const filtered = useMemo(() => {
    return (stats.recent || []).filter(r => {
      let ok = true;
      if (ok && filters.email) ok = (r.email || '').toLowerCase().includes(filters.email.toLowerCase());
      if (ok && filters.ip) ok = (r.ipAddress || '').toLowerCase().includes(filters.ip.toLowerCase());
      if (ok && filters.captchaOnly) ok = !!r.requiresCaptcha;
      if (ok && filters.lockedOnly) ok = r.lockoutUntil && new Date(r.lockoutUntil) > new Date();
      return ok;
    });
  }, [stats, filters]);

  const filteredPasswordLockouts = useMemo(() => {
    return (passwordLockouts || []).filter((r) => {
      let ok = true;
      if (ok && pwdFilters.email) ok = (r.email || '').toLowerCase().includes(pwdFilters.email.toLowerCase());
      if (ok && pwdFilters.ip) ok = (r.ipAddress || '').toLowerCase().includes(pwdFilters.ip.toLowerCase());
      if (ok && pwdFilters.identifier) ok = (r.identifier || '').toLowerCase().includes(pwdFilters.identifier.toLowerCase());
      if (ok && pwdFilters.userId) ok = String(r.userId || '').toLowerCase().includes(pwdFilters.userId.toLowerCase());
      return ok;
    });
  }, [passwordLockouts, pwdFilters]);

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin')) {
    return <div className="p-6">Unauthorized</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950 p-4 sm:p-6 md:p-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        {/* Enhanced Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="p-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 rounded-2xl shadow-xl">
                  <FaShieldAlt className="w-8 h-8 text-white" />
                </div>
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 rounded-2xl blur opacity-30"></div>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-700 via-purple-700 to-blue-700 dark:from-indigo-400 dark:via-purple-400 dark:to-blue-400 bg-clip-text text-transparent">
                  Security Moderation
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2 text-lg">
                  🛡️ Monitor and manage OTP and password lockouts, requests and admin unlocks
                </p>
              </div>
            </div>
          </div>

          {/* Security Stats Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-red-200 dark:border-red-900/30 p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active OTP Lockouts</p>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.activeLockouts}</p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-full">
                  <FaLock className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-orange-200 dark:border-orange-900/30 p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Password Lockouts</p>
                  <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{stats.passwordLockouts || 0}</p>
                </div>
                <div className="p-3 bg-orange-100 dark:bg-orange-900/40 rounded-full">
                  <FaKey className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-blue-200 dark:border-blue-900/30 p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Requests</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.recent?.length || 0}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-full">
                  <FaEye className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 shadow-sm">{error}</div>}

        {/* Two equal columns: Left = OTP Activity, Right = Password Lockouts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* OTP Activity Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center mb-6 gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
                  <FaEnvelope className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Recent OTP Activity</h2>
              </div>
              <button
                onClick={fetchOtpOnly}
                className="ml-auto px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center gap-2 order-2"
              >
                {otpRefreshing ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Refreshing...
                  </>
                ) : (
                  <>
                    <FaRedo className="w-4 h-4" />
                    Refresh
                  </>
                )}
              </button>
            </div>
            {/* Enhanced Filter Section */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <FaFilter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={filters.email}
                    onChange={e => setFilters(f => ({ ...f, email: e.target.value }))}
                    placeholder="Filter by email"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 outline-none"
                  />
                </div>
                <div className="relative">
                  <FaGlobe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={filters.ip}
                    onChange={e => setFilters(f => ({ ...f, ip: e.target.value }))}
                    placeholder="Filter by IP"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.captchaOnly}
                    onChange={e => setFilters(f => ({ ...f, captchaOnly: e.target.checked }))}
                    className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded focus:ring-purple-500 transition-colors"
                  />
                  <FaExclamationTriangle className="w-3 h-3 text-orange-500" />
                  Captcha only
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.lockedOnly}
                    onChange={e => setFilters(f => ({ ...f, lockedOnly: e.target.checked }))}
                    className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded focus:ring-purple-500 transition-colors"
                  />
                  <FaLock className="w-3 h-3 text-red-500" />
                  Locked only
                </label>
              </div>
            </div>
            <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[16%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[6%]" />
                </colgroup>
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800">
                  <tr className="text-left text-gray-700 dark:text-gray-200">
                    <th className="py-3 px-4 font-semibold">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <FaEnvelope className="w-3 h-3" />
                        Email
                      </div>
                    </th>
                    <th className="py-3 px-4 font-semibold">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <FaGlobe className="w-3 h-3" />
                        IP
                      </div>
                    </th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Requests</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Fails</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Captcha</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Lockout</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Updated</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filtered.map((r, idx) => (
                    <tr key={idx} className="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-200">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FaEnvelope className="w-3 h-3 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-gray-100">{r.email || '-'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FaGlobe className="w-3 h-3 text-gray-400" />
                          <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{r.ipAddress || '-'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                          {r.otpRequestCount || 0}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${r.failedOtpAttempts > 0 ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300' : 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'}`}>
                          {r.failedOtpAttempts || 0}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {r.requiresCaptcha ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300">
                            <FaExclamationTriangle className="w-3 h-3" />
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">
                            <FaCheckCircle className="w-3 h-3" />
                            No
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {r.lockoutUntil && new Date(r.lockoutUntil) > new Date() ? (
                          <div className="flex items-center gap-2">
                            <FaLock className="w-3 h-3 text-red-500" />
                            <span className="text-xs text-red-600 dark:text-red-400 font-medium whitespace-nowrap">
                              {new Date(r.lockoutUntil).toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FaClock className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => {
                            setConfirmingAction({
                              title: 'Confirm OTP Unlock',
                              message: `Are you sure you want to unlock OTP restrictions for ${r.email || r.ipAddress}?`,
                              onConfirm: async () => {
                                setActionLoading(true);
                                try {
                                  if (r.email) {
                                    const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/otp/unlock-email`, {
                                      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: r.email })
                                    });
                                    await res.json();
                                  } else if (r.ipAddress) {
                                    const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/otp/unlock-ip`, {
                                      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip: r.ipAddress })
                                    });
                                    await res.json();
                                  }
                                  fetchStats();
                                  setShowConfirmModal(false);
                                } catch (_) { } finally {
                                  setActionLoading(false);
                                }
                              }
                            });
                            setShowConfirmModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                          title="Unlock restriction"
                        >
                          <FaUnlockAlt className="w-3 h-3" />
                          Unlock
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td className="py-8 text-center text-gray-500 dark:text-gray-400" colSpan="8">
                        <div className="flex flex-col items-center gap-2">
                          <FaCheckCircle className="w-8 h-8 text-green-500" />
                          <span className="text-lg font-medium text-gray-700 dark:text-gray-200">No recent OTP activity</span>
                          <span className="text-sm">All clear. No OTP lockouts or requests to show</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {/* Password Lockouts Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-6 gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg">
                  <FaKey className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Active Password Lockouts</h2>
              </div>
              <button
                onClick={fetchPasswordLockouts}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center gap-2"
              >
                {passwordRefreshing ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Refreshing...
                  </>
                ) : (
                  <>
                    <FaRedo className="w-4 h-4" />
                    Refresh
                  </>
                )}
              </button>
            </div>
            {/* Enhanced Filter Section for Password Lockouts */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <FaFilter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Password Lockout Filters</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <FaEnvelope className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={pwdFilters.email}
                    onChange={e => setPwdFilters(f => ({ ...f, email: e.target.value }))}
                    placeholder="Filter by email"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 outline-none"
                  />
                </div>
                <div className="relative">
                  <FaUser className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={pwdFilters.userId}
                    onChange={e => setPwdFilters(f => ({ ...f, userId: e.target.value }))}
                    placeholder="Filter by User ID"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 outline-none"
                  />
                </div>
                <div className="relative">
                  <FaGlobe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={pwdFilters.ip}
                    onChange={e => setPwdFilters(f => ({ ...f, ip: e.target.value }))}
                    placeholder="Filter by IP"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 outline-none"
                  />
                </div>
                <div className="relative">
                  <FaKey className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={pwdFilters.identifier}
                    onChange={e => setPwdFilters(f => ({ ...f, identifier: e.target.value }))}
                    placeholder="Filter by Identifier"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[24%]" />
                  <col className="w-[14%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800">
                  <tr className="text-left text-gray-700 dark:text-gray-200">
                    <th className="py-3 px-4 font-semibold">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <FaEnvelope className="w-3 h-3" />
                        Email
                      </div>
                    </th>
                    <th className="py-3 px-4 font-semibold">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <FaUser className="w-3 h-3" />
                        User ID
                      </div>
                    </th>
                    <th className="py-3 px-4 font-semibold">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <FaGlobe className="w-3 h-3" />
                        IP
                      </div>
                    </th>
                    <th className="py-3 px-4 font-semibold">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <FaKey className="w-3 h-3" />
                        Identifier
                      </div>
                    </th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Attempts</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Locked</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Unlock At</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredPasswordLockouts.map((r) => (
                    <tr key={r._id} className="hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors duration-200">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FaEnvelope className="w-3 h-3 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-gray-100">{r.email || '-'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FaUser className="w-3 h-3 text-gray-400" />
                          <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{r.userId || '-'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FaGlobe className="w-3 h-3 text-gray-400" />
                          <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{r.ipAddress || '-'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FaKey className="w-3 h-3 text-gray-400" />
                          <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{r.identifier || '-'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${r.attempts > 3 ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300' : r.attempts > 1 ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300' : 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'}`}>
                          {r.attempts || 0}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FaLock className="w-3 h-3 text-red-500" />
                          <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {r.lockedAt ? new Date(r.lockedAt).toLocaleString() : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FaClock className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {r.unlockAt ? new Date(r.unlockAt).toLocaleString() : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => {
                            setConfirmingAction({
                              title: 'Confirm Password Unlock',
                              message: `Are you sure you want to unlock password restrictions for ${r.email || r.identifier || r.ipAddress || r.userId}?`,
                              onConfirm: async () => {
                                setActionLoading(true);
                                try {
                                  if (r.email) {
                                    await unlockPasswordByEmailOrUser({ email: r.email });
                                  } else if (r.userId) {
                                    await unlockPasswordByEmailOrUser({ userId: r.userId });
                                  } else if (r.ipAddress) {
                                    await unlockPasswordByIp(r.ipAddress);
                                  } else if (r.identifier) {
                                    await unlockPasswordByIdentifier(r.identifier);
                                  }
                                  setShowConfirmModal(false);
                                } catch (_) { } finally {
                                  setActionLoading(false);
                                }
                              }
                            });
                            setShowConfirmModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                          title="Unlock password restriction"
                        >
                          <FaUnlockAlt className="w-3 h-3" />
                          Unlock
                        </button>
                      </td>
                    </tr>
                  ))}
                  {passwordLockouts.length === 0 && (
                    <tr>
                      <td className="py-8 text-center text-gray-500 dark:text-gray-400" colSpan="8">
                        <div className="flex flex-col items-center gap-2">
                          <FaCheckCircle className="w-8 h-8 text-green-500" />
                          <span className="text-lg font-medium text-gray-700 dark:text-gray-200">No active password lockouts</span>
                          <span className="text-sm">All users can access their accounts normally</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && confirmingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border border-gray-100 dark:border-gray-700">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-full">
                  <FaExclamationTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {confirmingAction.title}
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {confirmingAction.message}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmingAction.onConfirm}
                  disabled={actionLoading}
                  className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-lg shadow-lg hover:shadow-red-500/20 transition-all transform hover:scale-105 disabled:opacity-70 flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      Processing...
                    </>
                  ) : (
                    'Confirm Unlock'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
