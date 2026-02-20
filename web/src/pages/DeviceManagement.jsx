import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
  FaMobileAlt, FaDesktop, FaLaptop, FaTabletAlt,
  FaWindows, FaApple, FaLinux, FaAndroid,
  FaGlobe, FaClock, FaCalendarAlt, FaShieldAlt,
  FaSync, FaSignOutAlt, FaExclamationTriangle,
  FaCheckCircle, FaLaptopCode, FaTimes, FaCheck, FaTrash
} from 'react-icons/fa';

import { usePageTitle } from '../hooks/usePageTitle';
import DeviceManagementSkeleton from '../components/skeletons/DeviceManagementSkeleton';
import { authenticatedFetch, clearAuthData } from '../utils/auth';



const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmButtonColor = "bg-blue-600 hover:bg-blue-700",
  isDestructive = false,
  isLoading = false
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    if (!isLoading) {
      onClose();
    }
  };

  const getIcon = () => {
    if (isDestructive) {
      return <FaExclamationTriangle className="w-6 h-6 text-red-500" />;
    }
    return <FaCheck className="w-6 h-6 text-blue-500" />;
  };

  const getConfirmButtonStyle = () => {
    if (isDestructive) {
      return "bg-red-600 hover:bg-red-700 focus:ring-red-500";
    }
    return confirmButtonColor + " focus:ring-blue-500";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full animate-slideUp">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {getIcon()}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
            disabled={isLoading}
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{message}</p>
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${getConfirmButtonStyle()}`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                {isDestructive && <FaTrash className="w-4 h-4" />}
                {confirmText}
              </>
            )}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>
    </div>
  );
};

const DeviceManagement = () => {
  // Set page title
  usePageTitle("Device Management - Security Settings");

  const { currentUser } = useSelector((state) => state.user);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revokingSession, setRevokingSession] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isRevokeAllModalOpen, setIsRevokeAllModalOpen] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] = useState(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const autoRefreshRef = useRef(null);

  useEffect(() => {
    fetchSessions();
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, []);

  // Listen for session list updates from server to refresh immediately
  useEffect(() => {
    const handler = () => fetchSessions();
    try {
      const { socket } = require('../utils/socket');
      socket.on('sessionsUpdated', handler);
      return () => socket.off('sessionsUpdated', handler);
    } catch (_) { }
  }, []);

  const fetchSessions = async () => {
    try {
      const controller = new AbortController();
      const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/session-management/my-sessions`, {
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
        setLastUpdated(new Date());
      } else {
        toast.error(data.message || 'Failed to fetch sessions');
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  // Toggle auto refresh every 30s
  const toggleAutoRefresh = () => {
    setAutoRefresh((prev) => {
      const next = !prev;
      if (next) {
        autoRefreshRef.current = setInterval(() => {
          fetchSessions();
        }, 30000);
      } else if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
      return next;
    });
  };

  const revokeSession = async (sessionId) => {
    setRevokingSession(sessionId);
    try {
      const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/session-management/revoke-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      if (data.success) {
        toast.success('Session revoked successfully');
        // If the revoked session is current, trigger immediate logout via socket handler fallback
        const currentSessionId = document.cookie.split('; ').find(r => r.startsWith('session_id='))?.split('=')[1];
        if (currentSessionId && currentSessionId === sessionId) {
          clearAuthData();
          window.location.href = '/sign-in?error=session_revoked';
          return;
        }
        fetchSessions(); // Refresh the list
      } else {
        toast.error(data.message || 'Failed to revoke session');
      }
    } catch (error) {
      console.error('Error revoking session:', error);
      toast.error('Failed to revoke session');
    } finally {
      setRevokingSession(null);
    }
  };


  const executeRevokeAllSessions = async () => {
    setIsRevokingAll(true);
    try {
      const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/session-management/revoke-all-sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        // Stay on current device; just refresh sessions
        fetchSessions();
      } else {
        toast.error(data.message || 'Failed to revoke sessions');
      }
    } catch (error) {
      console.error('Error revoking all sessions:', error);
      toast.error('Failed to revoke all sessions');
    } finally {
      setIsRevokingAll(false);
      setIsRevokeAllModalOpen(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDeviceIcon = (device) => {
    const d = (device || '').toLowerCase();
    if (d.includes('urban setu mobile app') || d.includes('mobilesapp')) return <FaMobileAlt className="text-3xl text-indigo-600" />;
    if (d.includes('android')) return <FaAndroid className="text-3xl text-green-500" />;
    if (d.includes('iphone') || d.includes('ipad')) return <FaApple className="text-3xl text-gray-800" />;
    if (d.includes('mac')) return <FaLaptopCode className="text-3xl text-gray-800" />;
    if (d.includes('windows')) return <FaWindows className="text-3xl text-blue-500" />;
    if (d.includes('linux')) return <FaLinux className="text-3xl text-yellow-600" />;
    if (d.includes('mobile')) return <FaMobileAlt className="text-3xl text-blue-400" />;
    if (d.includes('tablet')) return <FaTabletAlt className="text-3xl text-gray-600" />;
    return <FaDesktop className="text-3xl text-gray-500" />;
  };

  const getSessionLimit = () => {
    if (!currentUser) return 5; // Default fallback

    switch (currentUser.role) {
      case 'rootadmin':
        return 1;
      case 'admin':
        return 2;
      case 'user':
      default:
        return 5;
    }
  };

  if (loading) {
    return <DeviceManagementSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 relative overflow-hidden">
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
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-blob { animation: blob 7s infinite; }
            .animate-fade-in { animation: fadeIn 0.6s ease-out forwards; }
            .animate-fade-in-delay { animation: fadeIn 0.6s ease-out 0.2s forwards; opacity: 0; }
            .animate-fade-in-delay-2 { animation: fadeIn 0.6s ease-out 0.4s forwards; opacity: 0; }
        `}
      </style>

      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10 animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10 animate-blob" style={{ animationDelay: "2s" }}></div>
        <div className="absolute -bottom-32 left-20 w-96 h-96 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10 animate-blob" style={{ animationDelay: "4s" }}></div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 sm:p-8 mb-8 animate-fade-in relative overflow-hidden group hover:shadow-2xl transition-shadow duration-300">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 rounded-bl-full -mr-16 -mt-16 opacity-50 pointer-events-none group-hover:scale-110 transition-transform duration-500"></div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-2">
                Device Management
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-lg">
                Monitor and manage your active sessions across all devices
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex rounded-lg shadow-sm bg-gray-50 dark:bg-gray-700 p-1 border border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => { setLoading(true); fetchSessions(); }}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-600 hover:shadow-sm transition-all focus:outline-none"
                  title="Refresh sessions"
                >
                  <FaSync className={`mr-2 ${loading ? 'animate-spin text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
                  Refresh
                </button>
                <div className="w-px bg-gray-200 dark:bg-gray-600 my-1 mx-1"></div>
                <button
                  onClick={toggleAutoRefresh}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-all focus:outline-none ${autoRefresh ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 shadow-sm' : 'text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-600 hover:shadow-sm'}`}
                  title="Auto refresh every 30s"
                >
                  <span className={`mr-2 h-2 w-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                  {autoRefresh ? 'Auto: On' : 'Auto: Off'}
                </button>
              </div>

              <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-lg border border-blue-100 dark:border-blue-800">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Active</span>
                <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                  {sessions.length}
                </span>
                {lastUpdated && (
                  <span className="text-xs text-blue-400 hidden sm:inline border-l border-blue-200 dark:border-blue-700 pl-3">
                    {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Info Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 animate-fade-in-delay">
          {/* Limit Card */}
          <div className="lg:col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-6 shadow-sm flex items-start gap-4">
            <div className="bg-white dark:bg-gray-700 p-3 rounded-full shadow-sm text-blue-500 dark:text-blue-400">
              <FaShieldAlt className="text-xl" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">Session Limits</h3>
              <p className="text-blue-700 dark:text-blue-300 text-sm leading-relaxed">
                Your account allows up to <strong className="text-blue-800 dark:text-blue-200">{getSessionLimit()} active session{getSessionLimit() !== 1 ? 's' : ''}</strong>.
                New logins beyond this limit will automatically sign out the oldest inactive session to maintain security.
              </p>
            </div>
          </div>

          {/* Security Status Card */}
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm flex flex-col justify-center items-center text-center">
            <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-full text-green-600 dark:text-green-400">
              <FaCheckCircle className="text-2xl" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Status: Secure</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No suspicious activity detected</p>
          </div>
        </div>

        {/* Sessions List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in-delay-2">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FaLaptopCode className="text-gray-400 dark:text-gray-500" />
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Active Sessions</h2>
            </div>

            {sessions.length > 1 && (
              <button
                onClick={() => setIsRevokeAllModalOpen(true)}
                disabled={isRevokingAll}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-white dark:bg-gray-700 border border-red-200 dark:border-red-800 shadow-sm text-sm font-medium rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-300 dark:hover:border-red-700 focus:outline-none transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRevokingAll ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 dark:border-red-400 mr-2"></div>
                ) : (
                  <FaSignOutAlt className="mr-2 group-hover:rotate-180 transition-transform duration-300" />
                )}
                Sign Out All Other Devices
              </button>
            )}
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {sessions.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="bg-gray-50 dark:bg-gray-700 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaDesktop className="h-10 w-10 text-gray-300 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">No active sessions found</h3>
                <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-sm mx-auto">This seems unusual. Try refreshing the page or logging in again.</p>
                <button
                  onClick={() => { setLoading(true); fetchSessions(); }}
                  className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Reload Data
                </button>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.sessionId}
                  className={`px-6 py-6 transition-colors duration-200 ${session.isCurrent ? 'bg-blue-50/30 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-start gap-5">
                      <div className={`flex-shrink-0 p-4 rounded-xl ${session.isCurrent ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                        {getDeviceIcon(session.device)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-base font-bold text-gray-900 dark:text-white">
                            {session.device}
                          </h3>
                          {session.isCurrent && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800 shadow-sm">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                              Current Device
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 mt-2 text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-2">
                            <FaGlobe className="text-gray-400 dark:text-gray-500 text-xs" />
                            <span>{session.ip} • {session.location || 'Unknown Location'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FaClock className="text-gray-400 dark:text-gray-500 text-xs" />
                            <span>Last active: {formatDate(session.lastActive)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FaCalendarAlt className="text-gray-400 dark:text-gray-500 text-xs" />
                            <span>Signed in: {formatDate(session.loginTime)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0 w-full md:w-auto pl-16 md:pl-0">
                      {!session.isCurrent && (
                        <button
                          onClick={() => setSessionToRevoke(session.sessionId)}
                          disabled={revokingSession === session.sessionId}
                          className="w-full md:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-200 dark:border-gray-600 shadow-sm text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {revokingSession === session.sessionId ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Revoking...
                            </>
                          ) : (
                            'Revoke Access'
                          )}
                        </button>
                      )}
                      {session.isCurrent && (
                        <div className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-lg border border-green-100 dark:border-green-800">
                          <FaCheckCircle /> Active Now
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Security Tips */}
        <div className="mt-8 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 border border-yellow-200/60 dark:border-yellow-800 rounded-2xl p-6 shadow-sm animate-fade-in-delay-2 flex items-start gap-4">
          <div className="bg-white dark:bg-gray-800 p-3 rounded-full shadow-sm text-orange-500 dark:text-orange-400 shrink-0">
            <FaExclamationTriangle className="text-lg" />
          </div>
          <div>
            <h3 className="text-base font-bold text-yellow-800 dark:text-yellow-200 mb-2">Security Tips</h3>
            <ul className="text-sm text-yellow-800/80 dark:text-yellow-200/80 space-y-1 list-disc list-inside">
              <li>Regularly review your active sessions and revoke any you don't recognize.</li>
              <li>Always log out from shared or public computers.</li>
              <li>If you notice suspicious activity, change your password immediately.</li>
            </ul>
          </div>
        </div>
      </div>


      {/* Confirmation Modal for Revoke All */}
      <ConfirmationModal
        isOpen={isRevokeAllModalOpen}
        onClose={() => setIsRevokeAllModalOpen(false)}
        onConfirm={executeRevokeAllSessions}
        title="Sign Out All Other Devices"
        message="Are you sure you want to sign out from all other devices? This will invalidate all active sessions except this one."
        confirmText="Sign Out All"
        isDestructive={true}
        isLoading={isRevokingAll}
      />

      {/* Confirmation Modal for Revoke Single Session */}
      <ConfirmationModal
        isOpen={!!sessionToRevoke}
        onClose={() => setSessionToRevoke(null)}
        onConfirm={() => {
          if (sessionToRevoke) {
            revokeSession(sessionToRevoke);
            setSessionToRevoke(null);
          }
        }}
        title="Revoke Session Access"
        message="Are you sure you want to revoke access for this device? It will be signed out immediately."
        confirmText="Revoke Access"
        isDestructive={true}
        isLoading={sessionToRevoke && revokingSession === sessionToRevoke}
      />
    </div>
  );
};

export default DeviceManagement;