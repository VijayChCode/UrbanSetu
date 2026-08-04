import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
  FaSync, FaSearch, FaFilter, FaDesktop, FaMobileAlt, FaTabletAlt,
  FaShieldAlt, FaExclamationTriangle, FaTimes, FaSignOutAlt, FaUserSlash,
  FaMapMarkerAlt, FaCalendarAlt, FaNetworkWired, FaUser, FaClock, FaGlobe
} from 'react-icons/fa';

import { usePageTitle } from '../hooks/usePageTitle';
import { socket } from '../utils/socket';
import AdminSessionManagementSkeleton from '../components/skeletons/AdminSessionManagementSkeleton';
import { authenticatedFetch, clearAuthData } from '../utils/auth';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';


const SessionManagement = () => {
  // Set page title
  usePageTitle("Session Management - User Sessions");

  const { currentUser } = useSelector((state) => state.user);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revokingSession, setRevokingSession] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshRef = useRef(null);
  const [filterRole, setFilterRole] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDevice, setFilterDevice] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSessions, setTotalSessions] = useState(0);
  const [forceLogoutReason, setForceLogoutReason] = useState('');
  const [showForceLogoutModal, setShowForceLogoutModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showLogoutAllModal, setShowLogoutAllModal] = useState(false);
  const [logoutAllTargetSession, setLogoutAllTargetSession] = useState(null);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  // Debounced search effect
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (searchQuery) {
      setIsSearching(true);
    }

    const timeout = setTimeout(() => {
      setCurrentPage(1); // Reset to first page when searching
      fetchSessions().finally(() => setIsSearching(false));
    }, 300); // 300ms debounce

    setSearchTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [searchQuery]);

  useEffect(() => {
    fetchSessions(); // Main initial fetch
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [filterRole, filterDevice, filterLocation, filterDateRange, currentPage]);

  // Refresh immediately when backend broadcasts updates
  useEffect(() => {
    const handler = () => fetchSessions(); // Background update

    if (socket) {
      socket.on('adminSessionsUpdated', handler);
      socket.on('sessionsUpdated', handler);
    }

    return () => {
      if (socket) {
        socket.off('adminSessionsUpdated', handler);
        socket.off('sessionsUpdated', handler);
      }
    };
  }, [filterRole, currentPage]);

  const fetchSessions = async () => {
    // Note: We do NOT set global loading(true) here to avoid flashing the skeleton
    // on refreshes. Global loading is only true initially via useState(true).
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20,
        role: filterRole,
        search: searchQuery,
        device: filterDevice,
        location: filterLocation,
        dateRange: filterDateRange
      });

      const controller = new AbortController();
      const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/session-management/admin/all-sessions?${params}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      if (data.success) {
        setSessions(data.sessions);
        setTotalSessions(data.total);
        setLastUpdated(new Date());
      } else {
        toast.error(data.message || 'Failed to fetch sessions');
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to fetch sessions');
    } finally {
      setLoading(false); // Only turn off initial loading
    }
  };

  const activeRefresh = async () => {
    setIsRefreshing(true);
    await fetchSessions();
    setIsRefreshing(false);
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh((prev) => {
      const next = !prev;
      if (next) {
        autoRefreshRef.current = setInterval(() => { fetchSessions(); }, 30000);
      } else if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
      return next;
    });
  };

  const forceLogoutSession = async (sessionId, userId, reason) => {
    setRevokingSession(sessionId);
    try {
      const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/session-management/admin/force-logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          sessionId,
          reason: reason || 'Admin action'
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      if (data.success) {
        toast.success('Session force logged out successfully');
        // If the admin is forcing logout of their own current session, ensure local logout
        const currentSessionId = document.cookie.split('; ').find(r => r.startsWith('session_id='))?.split('=')[1];
        if (currentSessionId && currentSessionId === sessionId) {
          clearAuthData();
          window.location.href = '/sign-in?error=forced_logout';
          return;
        }
        fetchSessions(); // Refresh the list
      } else {
        toast.error(data.message || 'Failed to force logout session');
      }
    } catch (error) {
      console.error('Error force logging out session:', error);
      toast.error('Failed to force logout session');
    } finally {
      setRevokingSession(null);
      setShowForceLogoutModal(false);
      setSelectedSession(null);
      setForceLogoutReason('');
    }
  };

  const forceLogoutAllUserSessions = async (userId, reason) => {
    setIsLoggingOutAll(true);
    try {
      const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/session-management/admin/force-logout-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          reason: reason || 'Admin action'
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        fetchSessions(); // Refresh the list
      } else {
        toast.error(data.message || 'Failed to force logout all sessions');
      }
    } catch (error) {
      console.error('Error force logging out all sessions:', error);
      toast.error('Failed to force logout all sessions');
    } finally {
      setIsLoggingOutAll(false);
      setShowLogoutAllModal(false);
      setLogoutAllTargetSession(null);
    }
  };

  const openLogoutAllModal = (session) => {
    setLogoutAllTargetSession(session);
    setShowLogoutAllModal(true);
  };

  const openForceLogoutModal = (session) => {
    setSelectedSession(session);
    setShowForceLogoutModal(true);
  };

  const resetFilters = () => {
    setFilterRole('all');
    setSearchQuery('');
    setFilterDevice('all');
    setFilterLocation('all');
    setFilterDateRange('all');
    setCurrentPage(1);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filterRole !== 'all') count++;
    if (searchQuery) count++;
    if (filterDevice !== 'all') count++;
    if (filterLocation !== 'all') count++;
    if (filterDateRange !== 'all') count++;
    return count;
  };

  const hasActiveFilters = getActiveFiltersCount() > 0;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDeviceIcon = (device) => {
    const d = (device || '').toLowerCase();
    if (d.includes('urban setu mobile app') || d.includes('mobilesapp')) return <FaMobileAlt className="text-xl text-indigo-600" />;
    if (d.includes('mobile') || d.includes('android') || d.includes('iphone')) return <FaMobileAlt className="text-xl text-blue-500" />;
    if (d.includes('tablet') || d.includes('ipad')) return <FaTabletAlt className="text-xl text-purple-500" />;
    return <FaDesktop className="text-xl text-gray-500" />;
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'rootadmin':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      case 'admin':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case 'user':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
    }
  };

  if (loading) {
    return <AdminSessionManagementSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-200">
      {/* Background Animations */}
      <style>
        {`
            @keyframes blob {
                0% { transform: translate(0px, 0px) scale(1); }
                33% { transform: translate(30px, -50px) scale(1.1); }
                66% { transform: translate(-20px, 20px) scale(0.9); }
                100% { transform: translate(0px, 0px) scale(1); }
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-blob { animation: blob 7s infinite; }
            .animate-fade-in { animation: fadeIn 0.8s ease-out forwards; }
            .animate-fade-in-delay { animation: fadeIn 0.8s ease-out 0.2s forwards; opacity: 0; }
            .animate-fade-in-delay-2 { animation: fadeIn 0.8s ease-out 0.4s forwards; opacity: 0; }
        `}
      </style>

      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" style={{ animationDelay: "2s" }}></div>
        <div className="absolute -bottom-32 left-20 w-96 h-96 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" style={{ animationDelay: "4s" }}></div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        {/* Header Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 sm:p-8 animate-fade-in relative overflow-hidden group transition-colors duration-200">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-50 to-purple-50 rounded-bl-full -mr-16 -mt-16 opacity-50 pointer-events-none transition-transform duration-500 group-hover:scale-110"></div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
            <div>
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-2">
                Session Management
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-lg">
                Monitor and manage user sessions across the platform
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex rounded-lg shadow-sm bg-gray-50 dark:bg-gray-700/50 p-1 border border-gray-200 dark:border-gray-600">
                <button
                  onClick={activeRefresh}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-600 hover:shadow-sm transition-all focus:outline-none"
                  title="Refresh sessions"
                >
                  {isRefreshing ? (
                    <UrbanSetuSpinner size="sm" className="mr-2" />
                  ) : (
                    <FaSync className="mr-2 text-gray-500" />
                  )}
                  Refresh
                </button>
                <div className="w-px bg-gray-200 dark:bg-gray-600 my-1 mx-1"></div>
                <button
                  onClick={toggleAutoRefresh}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-all focus:outline-none ${autoRefresh ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 shadow-sm' : 'text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-600 hover:shadow-sm'}`}
                  title="Auto refresh every 30s"
                >
                  <span className={`mr-2 h-2 w-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                  {autoRefresh ? 'Auto: On' : 'Auto: Off'}
                </button>
              </div>

              <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-lg border border-blue-100 dark:border-blue-800/30">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Active</span>
                <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                  {totalSessions}
                </span>
                {lastUpdated && (
                  <span className="text-xs text-blue-400 dark:text-blue-500 hidden sm:inline border-l border-blue-200 dark:border-blue-800/50 pl-3">
                    {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 animate-fade-in-delay relative overflow-visible z-20 transition-colors duration-200">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {isSearching ? <UrbanSetuSpinner size="sm" /> : <FaSearch className="text-gray-400 dark:text-gray-500" />}
              </div>
              <input
                type="text"
                placeholder="Search by username, email, device, IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-600 rounded-xl leading-5 bg-gray-50 dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center px-4 py-3 border rounded-xl font-medium transition-all ${showFilters || hasActiveFilters ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
            >
              <FaFilter className="mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {getActiveFiltersCount()}
                </span>
              )}
            </button>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors font-medium text-sm"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter Panel */}
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-300 overflow-hidden ${showFilters ? 'max-h-96 opacity-100 pt-4 border-t border-gray-100 dark:border-gray-700' : 'max-h-0 opacity-0'}`}>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Role</label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-600 text-gray-900 dark:text-white outline-none transition-all"
              >
                <option value="all">All Roles</option>
                <option value="user">Users</option>
                <option value="admin">Admins</option>
                <option value="rootadmin">Root Admins</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Device Platform</label>
              <select
                value={filterDevice}
                onChange={(e) => setFilterDevice(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-600 text-gray-900 dark:text-white outline-none transition-all"
              >
                <option value="all">All Devices</option>
                <option value="mobile">Mobile (Browser)</option>
                <option value="urban setu mobile app">Mobile App</option>
                <option value="desktop">Desktop</option>
                <option value="tablet">Tablet</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Location</label>
              <input
                type="text"
                value={filterLocation === 'all' ? '' : filterLocation}
                onChange={(e) => setFilterLocation(e.target.value || 'all')}
                placeholder="e.g. New York, India"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-600 text-gray-900 dark:text-white outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Time Range</label>
              <select
                value={filterDateRange}
                onChange={(e) => setFilterDateRange(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-600 text-gray-900 dark:text-white outline-none transition-all"
              >
                <option value="all">All Time</option>
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in-delay-2 transition-colors duration-200">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <FaNetworkWired className="text-blue-500" /> Active Sessions List
            </h2>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 shadow-sm">
              Page {currentPage} of {Math.ceil(totalSessions / 20) || 1}
            </span>
          </div>

          {sessions.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4 shadow-inner">
                <FaShieldAlt className="text-2xl text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="mt-2 text-lg font-bold text-gray-900 dark:text-white">No active sessions found</h3>
              <p className="mt-1 text-gray-500 dark:text-gray-400">Try adjusting your search or filters to find what you're looking for.</p>
              {hasActiveFilters && (
                <button onClick={resetFilters} className="mt-4 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors">Clear all filters</button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Device Info</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Location (IP)</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Last Active</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {sessions.filter(session => {
                    // Restriction 1: Admins (non-root) cannot see rootadmin sessions
                    if (currentUser.role !== 'rootadmin' && session.role === 'rootadmin') {
                      return false;
                    }
                    return true;
                  }).map((session, index) => (
                    <tr
                      key={session.sessionId}
                      className="hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors duration-150"
                      style={{ animation: `fadeIn 0.2s ease-out ${index * 0.03}s backwards` }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                              <span className="font-bold text-sm">
                                {session.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                              {session.username}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {session.email}
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border mt-1 ${getRoleBadgeColor(session.role)}`}>
                              {session.role}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-start gap-3">
                          <div className="mt-1">{getDeviceIcon(session.device)}</div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{session.device}</div>
                            {session.isCurrent && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                                This Device
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="flex items-center text-sm text-gray-900 dark:text-white">
                            <FaGlobe className="text-gray-400 mr-2" />
                            {session.location || 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono pl-6 mt-0.5">
                            {session.ip}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                          <FaClock className="mr-2 text-gray-400" />
                          {formatDate(session.lastActive)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {/* Restriction 2: Admins cannot perform actions on other Admins or Rootadmins */}
                          {(currentUser.role === 'rootadmin' || (session.role !== 'admin' && session.role !== 'rootadmin')) && (
                            <>
                              <button
                                onClick={() => openForceLogoutModal(session)}
                                disabled={revokingSession === session.sessionId}
                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                                title="Force Logout"
                              >
                                {revokingSession === session.sessionId ? <UrbanSetuSpinner size="sm" /> : <FaSignOutAlt />}
                              </button>
                              <button
                                onClick={() => openLogoutAllModal(session)}
                                className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 p-2 rounded-lg transition-colors"
                                title="Logout All User Sessions"
                              >
                                <FaUserSlash />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalSessions > 20 && (
          <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6 mt-6 rounded-lg shadow-sm">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={sessions.length < 20}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Showing page <span className="font-medium">{currentPage}</span> of{' '}
                  <span className="font-medium">{Math.ceil(totalSessions / 20)}</span>
                </p>
              </div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={sessions.length < 20}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        )}
      </div>

      {/* Force Logout Modal */}
      {showForceLogoutModal && selectedSession && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in border border-gray-100 dark:border-gray-700">
            <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 px-6 py-4 border-b border-red-100 dark:border-red-800 flex items-center gap-3">
              <div className="bg-white dark:bg-gray-700 p-2 rounded-full shadow-sm text-red-500 dark:text-red-400">
                <FaExclamationTriangle />
              </div>
              <h3 className="text-lg font-bold text-red-900 dark:text-red-300">Force Logout Session</h3>
            </div>

            <div className="p-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-6 border border-gray-100 dark:border-gray-600">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold text-sm shadow-sm">
                      {selectedSession.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedSession.username}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{selectedSession.email}</p>
                    </div>
                  </div>
                  <div className="h-px bg-gray-200 dark:bg-gray-600 mx-1"></div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-gray-400 dark:text-gray-500 block mb-1 uppercase tracking-wider">Device</span>
                      <span className="font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1">
                        {getDeviceIcon(selectedSession.device)} {selectedSession.device}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 dark:text-gray-500 block mb-1 uppercase tracking-wider">IP Address</span>
                      <span className="font-medium text-gray-700 dark:text-gray-200 font-mono">{selectedSession.ip}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label htmlFor="reason" className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                  Logout Reason <span className="text-gray-400 font-normal text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  id="reason"
                  value={forceLogoutReason}
                  onChange={(e) => setForceLogoutReason(e.target.value)}
                  disabled={revokingSession === selectedSession.sessionId}
                  className="block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all text-sm outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="e.g. Suspicious activity detected"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowForceLogoutModal(false);
                    setSelectedSession(null);
                    setForceLogoutReason('');
                  }}
                  disabled={revokingSession === selectedSession.sessionId}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={() => forceLogoutSession(selectedSession.sessionId, selectedSession.userId, forceLogoutReason)}
                  disabled={revokingSession === selectedSession.sessionId}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 border border-transparent rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {revokingSession === selectedSession.sessionId ? (
                    <>
                      <UrbanSetuSpinner size="xs" isBright={true} />
                      <span>Logging Out...</span>
                    </>
                  ) : (
                    <>
                      <FaSignOutAlt /> Force Logout
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logout All Sessions Confirmation Modal */}
      {showLogoutAllModal && logoutAllTargetSession && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in border border-gray-100 dark:border-gray-700">
            <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 px-6 py-4 border-b border-orange-100 dark:border-orange-800 flex items-center gap-3">
              <div className="bg-white dark:bg-gray-700 p-2 rounded-full shadow-sm text-orange-500 dark:text-orange-400">
                <FaUserSlash />
              </div>
              <h3 className="text-lg font-bold text-orange-900 dark:text-orange-300">Logout All Sessions</h3>
            </div>

            <div className="p-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-6 border border-gray-100 dark:border-gray-600">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold text-sm shadow-sm">
                      {logoutAllTargetSession.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{logoutAllTargetSession.username}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{logoutAllTargetSession.email}</p>
                    </div>
                  </div>
                  <div className="h-px bg-gray-200 dark:bg-gray-600 mx-1"></div>
                  <div className="text-sm">
                    <span className="text-xs text-gray-400 dark:text-gray-500 block mb-1 uppercase tracking-wider">Role</span>
                    <span className="font-medium text-gray-700 dark:text-gray-200">{logoutAllTargetSession.role}</span>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <FaExclamationTriangle className="text-orange-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-orange-900 dark:text-orange-300 mb-1">Warning</p>
                    <p className="text-xs text-orange-700 dark:text-orange-400">
                      This will forcefully log out all active sessions for this user across all devices. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowLogoutAllModal(false);
                    setLogoutAllTargetSession(null);
                  }}
                  disabled={isLoggingOutAll}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={() => forceLogoutAllUserSessions(logoutAllTargetSession.userId, 'Admin action - Logout all sessions')}
                  disabled={isLoggingOutAll}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-orange-600 border border-transparent rounded-xl hover:bg-orange-700 shadow-lg shadow-orange-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoggingOutAll ? (
                    <>
                      <UrbanSetuSpinner size="xs" isBright={true} />
                      <span>Logging Out All...</span>
                    </>
                  ) : (
                    <>
                      <FaUserSlash /> Logout All Sessions
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionManagement;