import React, { useEffect, useState, useMemo } from 'react';
import ContactSupportWrapper from '../components/ContactSupportWrapper';
import GeminiAIWrapper from '../components/GeminiAIWrapper';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
  FaShieldAlt, FaExclamationTriangle, FaCheckCircle, FaTimesCircle,
  FaUserShield, FaHistory, FaFilter, FaSearch, FaArrowRight,
  FaLock, FaUnlock, FaWallet, FaMapMarkerAlt, FaEye, FaRedo
} from 'react-icons/fa';
import { authenticatedFetch } from '../utils/auth';
import { socket } from '../utils/socket';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import { usePageTitle } from '../hooks/usePageTitle';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const formatDistanceToNow = (date, options = {}) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (isNaN(diffInSeconds)) return 'some time ago';

  const suffix = options.addSuffix ? ' ago' : '';

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''}${suffix}`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''}${suffix}`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''}${suffix}`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''}${suffix}`;
  }

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} year${diffInYears > 1 ? 's' : ''}${suffix}`;
};

export default function AdminSentinelDashboard() {
  usePageTitle("Sentinel AI Governance - Security Command Center");

  const { currentUser } = useSelector((state) => state.user);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  });
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  // Unpublish Modal States
  const [unpublishModal, setUnpublishModal] = useState({ open: false, alertId: null, listingId: null });
  const [unpublishReason, setUnpublishReason] = useState("");
  const [unpublishLoading, setUnpublishLoading] = useState(false);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/sentinel/alerts?status=${statusFilter}`);
      const data = await res.json();
      if (data.success) {
        setAlerts(data.alerts);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch Sentinel alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    // Socket.io for real-time alerts
    socket.on('sentinel_alert', (newAlert) => {
      setAlerts(prev => [newAlert, ...prev]);
      setStats(prev => ({
        ...prev,
        total: prev.total + 1,
        pending: prev.pending + 1,
        [newAlert.severity]: prev[newAlert.severity] + 1
      }));
    });

    return () => {
      socket.off('sentinel_alert');
    };
  }, [statusFilter]);

  const handleResolve = async (alertId, action = 'resolved') => {
    try {
      setActionLoading(alertId);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/sentinel/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action })
      });
      const data = await res.json();
      if (data.success) {
        const resolvedAlert = alerts.find(a => a._id === alertId);
        setAlerts(prev => prev.map(a => a._id === alertId ? { ...a, status: action } : a));
        setStats(prev => {
          const newStats = {
            ...prev,
            pending: Math.max(0, prev.pending - 1)
          };
          if (resolvedAlert && resolvedAlert.severity) {
            newStats[resolvedAlert.severity] = Math.max(0, (prev[resolvedAlert.severity] || 0) - 1);
          }
          return newStats;
        });
      }
    } catch (error) {
      console.error("Failed to resolve alert:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpublishSubmit = async (e) => {
    e.preventDefault();
    if (!unpublishReason || !unpublishReason.trim()) {
      toast.error("A reason is required to unpublish this listing");
      return;
    }

    try {
      setUnpublishLoading(true);
      const { alertId, listingId } = unpublishModal;
      
      const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/root-unpublish/${listingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: unpublishReason.trim() })
      });
      const data = await res.json();
      
      if (res.ok) {
        toast.success("Property has been unpublished and owner notified.");
        
        // Auto-resolve the Sentinel alert
        await handleResolve(alertId, 'resolved');
        
        // Close modal and reset state
        setUnpublishModal({ open: false, alertId: null, listingId: null });
        setUnpublishReason("");
      } else {
        toast.error(data.message || "Failed to unpublish property");
      }
    } catch (error) {
      console.error("Error unpublishing property:", error);
      toast.error("Error connecting to server");
    } finally {
      setUnpublishLoading(false);
    }
  };

  const filteredAlerts = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return alerts.filter(alert => {
      const matchesSearch =
        alert.reason.toLowerCase().includes(query) ||
        (alert.userId?.username || '').toLowerCase().includes(query) ||
        (alert.userId?.email || '').toLowerCase().includes(query) ||
        (alert.listingId?.name || '').toLowerCase().includes(query) ||
        alert.type.toLowerCase().includes(query) ||
        alert.severity.toLowerCase().includes(query);

      const matchesType = filter === 'all' || alert.type === filter;

      return matchesSearch && matchesType;
    });
  }, [alerts, searchQuery, filter]);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 text-white border-red-700';
      case 'high': return 'bg-orange-500 text-white border-orange-600';
      case 'medium': return 'bg-yellow-400 text-gray-900 border-yellow-500';
      case 'low': return 'bg-blue-400 text-white border-blue-500';
      default: return 'bg-gray-400 text-white border-gray-500';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'fraud_listing': return <FaExclamationTriangle className="text-orange-500" />;
      case 'security_anomaly': return <FaUserShield className="text-red-500" />;
      case 'wallet_anomaly': return <FaWallet className="text-blue-500" />;
      case 'policy_violation': return <FaShieldAlt className="text-purple-500" />;
      default: return <FaShieldAlt className="text-gray-500" />;
    }
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin')) {
    return <div className="p-10 text-center">Unauthorized Access</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white flex items-center gap-2 sm:gap-3">
              <span className="p-2 sm:p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 flex items-center">
                <FaShieldAlt className="text-white text-xl sm:text-3xl" />
              </span>
              Sentinel AI Command
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
              Real-time governance and automated security audit logs.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchAlerts}
              className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-slate-600 dark:text-slate-300 shadow-sm"
            >
              <FaRedo className={loading ? 'animate-spin' : ''} />
            </button>
            <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${statusFilter === 'pending' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400'}`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('resolved')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${statusFilter === 'resolved' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400'}`}
              >
                Archive
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard title="Active Alerts" value={stats.pending} icon={<FaExclamationTriangle />} color="text-indigo-600" />
          <StatCard title="Critical Risks" value={stats.critical} icon={<FaTimesCircle />} color="text-red-600" />
          <StatCard title="High Risk" value={stats.high} icon={<FaLock />} color="text-orange-600" />
          <StatCard title="Trust Penalties" value={stats.total} icon={<FaHistory />} color="text-blue-600" />
        </div>

        {/* Filters and Search */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 mb-8">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative w-full md:w-96">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search alerts, users, or properties..."
                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
              <FilterChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
              <FilterChip label="Fraud" active={filter === 'fraud_listing'} onClick={() => setFilter('fraud_listing')} />
              <FilterChip label="Security" active={filter === 'security_anomaly'} onClick={() => setFilter('security_anomaly')} />
              <FilterChip label="Wallet" active={filter === 'wallet_anomaly'} onClick={() => setFilter('wallet_anomaly')} />
              <FilterChip label="Policy" active={filter === 'policy_violation'} onClick={() => setFilter('policy_violation')} />
            </div>
          </div>
        </div>

        {/* Alerts Feed */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center p-20">
              <UrbanSetuSpinner size="xl" isBright={true} text="Auditing Governance Logs & Alerts..." />
            </div>
          ) : filteredAlerts.length > 0 ? (
            filteredAlerts.map((alert) => (
              <AlertItem
                key={alert._id}
                alert={alert}
                onResolve={handleResolve}
                onUnpublishClick={(alertId, listingId) => setUnpublishModal({ open: true, alertId, listingId })}
                actionLoading={actionLoading === alert._id}
                getSeverityColor={getSeverityColor}
                getTypeIcon={getTypeIcon}
              />
            ))
          ) : (
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
              <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <FaCheckCircle className="text-green-500 text-3xl" />
              </div>
              <h3 className="text-xl font-bold dark:text-white">All Clear!</h3>
              <p className="text-slate-500">No active Sentinel alerts found for these filters.</p>
            </div>
          )}
        </div>
      </div>
      <ContactSupportWrapper />
      <GeminiAIWrapper />

      {unpublishModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Confirm Action</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">Unpublish this property?</p>
            
            <form onSubmit={handleUnpublishSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Reason for Unpublishing (Required):
                </label>
                <textarea
                  required
                  rows="4"
                  placeholder="Explain why this property is being unpublished (sent to owner)..."
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500 placeholder-slate-400 text-sm resize-none"
                  value={unpublishReason}
                  onChange={(e) => setUnpublishReason(e.target.value)}
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setUnpublishModal({ open: false, alertId: null, listingId: null });
                    setUnpublishReason("");
                  }}
                  className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-2xl transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={unpublishLoading}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition-all text-sm shadow-lg shadow-red-500/20 disabled:opacity-50"
                >
                  {unpublishLoading ? 'Unpublishing...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 transition-transform hover:scale-[1.02]">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider">{title}</p>
          <h2 className="text-3xl font-black mt-2 dark:text-white">{value}</h2>
        </div>
        <div className={`p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${active
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
    >
      {label}
    </button>
  );
}

function AlertItem({ alert, onResolve, onUnpublishClick, actionLoading, getSeverityColor, getTypeIcon }) {
  return (
    <div className={`group bg-white dark:bg-slate-900 p-4 md:p-6 rounded-3xl shadow-sm border-l-8 ${getSeverityColor(alert.severity).split(' ')[0]} border dark:border-slate-800 transition-all hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none`}>
      <div className="flex flex-col md:flex-row justify-between gap-4 md:gap-6">
        <div className="flex gap-3 md:gap-5">
          <div className="p-3 md:p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl h-fit">
            {getTypeIcon(alert.type)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-tighter border ${getSeverityColor(alert.severity)}`}>
                {alert.severity}
              </span>
              <span className="text-slate-400 text-xs font-medium">
                {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
              </span>
            </div>
            <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white mb-1 break-words">
              {alert.reason}
            </h3>
            <div className="flex flex-wrap gap-2 md:gap-4 mt-3">
              {alert.userId && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold bg-slate-50 dark:bg-slate-800 px-2 py-1 md:px-3 md:py-1.5 rounded-lg">
                  <FaUserShield className="text-indigo-500 flex-shrink-0" />
                  <span className="truncate max-w-[150px]">{alert.userId.username || alert.userId.email}</span>
                </div>
              )}
              {alert.listingId && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold bg-slate-50 dark:bg-slate-800 px-2 py-1 md:px-3 md:py-1.5 rounded-lg">
                  <FaMapMarkerAlt className="text-orange-500 flex-shrink-0" />
                  <span className="truncate max-w-[150px]">{alert.listingId.name}</span>
                </div>
              )}
              {alert.ipAddress && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold bg-slate-50 dark:bg-slate-800 px-2 py-1 md:px-3 md:py-1.5 rounded-lg">
                  <FaHistory className="text-blue-500 flex-shrink-0" />
                  <span>{alert.ipAddress}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 mt-4 md:mt-0 justify-start md:justify-end w-full md:w-auto">
          {alert.status === 'pending' && (
            <>
              {alert.listingId && (
                <button
                  onClick={() => onUnpublishClick(alert._id, alert.listingId._id || alert.listingId)}
                  disabled={actionLoading}
                  className="px-4 py-2.5 md:px-6 md:py-3 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all text-xs md:text-sm shadow-lg shadow-red-500/20 disabled:opacity-50"
                >
                  Unpublish
                </button>
              )}
              <button
                onClick={() => onResolve(alert._id, 'dismissed')}
                disabled={actionLoading}
                className="px-4 py-2.5 md:px-6 md:py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-xs md:text-sm disabled:opacity-50"
              >
                Dismiss
              </button>
              <button
                onClick={() => onResolve(alert._id, 'resolved')}
                disabled={actionLoading}
                className="px-4 py-2.5 md:px-6 md:py-3 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 transition-all text-xs md:text-sm shadow-lg shadow-green-500/20 flex items-center gap-1.5 disabled:opacity-50 animate-fadeIn"
              >
                {actionLoading ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaCheckCircle />}
                Mark Resolved
              </button>
            </>
          )}
          {alert.status !== 'pending' && (
            <div className="flex items-center gap-2 text-green-500 font-bold text-xs md:text-sm bg-green-50 dark:bg-green-900/20 px-3 py-1.5 md:px-4 md:py-2 rounded-xl">
              <FaCheckCircle />
              {alert.status.toUpperCase()}
            </div>
          )}
          {alert.listingId && (
            <button
              onClick={() => window.open(`/admin/listing/${alert.listingId._id || alert.listingId}`, '_blank')}
              className="p-2.5 md:p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all"
              title="View Property Details"
            >
              <FaEye />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
