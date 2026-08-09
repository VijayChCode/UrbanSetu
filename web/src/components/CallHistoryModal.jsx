import React, { useState, useEffect, useMemo } from 'react';
import { FaPhone, FaVideo, FaTimes, FaClock, FaCheckCircle, FaTimesCircle, FaUser, FaTrash, FaSync, FaFilter, FaInfoCircle, FaCopy, FaCheck, FaEnvelope } from 'react-icons/fa';
import UrbanSetuSpinner from './UrbanSetuSpinner';
import { toast } from 'react-toastify';
import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const CallHistoryModal = ({ appointmentId, isOpen, onClose, currentUser, isAdmin = false }) => {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [showDeleteSingleModal, setShowDeleteSingleModal] = useState(false);
  const [callToDelete, setCallToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [linkInfoCall, setLinkInfoCall] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'direct', 'link'

  useEffect(() => {
    if (isOpen && appointmentId) {
      fetchCallHistory();
    } else {
      setCalls([]);
      setError(null);
      // Reset filters on close/open
      setFilterType('all');
      setFilterStatus('all');
      setFilterMode('all');
    }
  }, [isOpen, appointmentId]);

  const fetchCallHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/calls/history/${appointmentId}`
      );
      const data = await response.json();
      if (response.ok && data.calls) {
        setCalls(data.calls);
        // Reset filters when data is refreshed
        setFilterType('all');
        setFilterStatus('all');
        setFilterMode('all');
      } else {
        setError(data.message || 'Failed to fetch call history');
      }
    } catch (err) {
      console.error('Error fetching call history:', err);
      setError('Failed to fetch call history');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!appointmentId) return;
    try {
      setDeleting(true);
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/calls/history/${appointmentId}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (response.ok) {
        setCalls([]);
        toast.success('All call history deleted.');
        setShowDeleteAllModal(false);
      } else {
        toast.error(data.message || 'Failed to delete call history.');
      }
    } catch (err) {
      console.error('Error deleting all call history:', err);
      toast.error('Failed to delete call history.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSingle = async () => {
    if (!callToDelete) return;
    const id = callToDelete._id || callToDelete.callId;
    if (!id) return;
    try {
      setDeleting(true);
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/calls/history/${appointmentId}/${id}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (response.ok) {
        setCalls(prev => prev.filter(call =>
          (call._id || call.callId) !== id
        ));
        toast.success('Call history entry deleted.');
        setShowDeleteSingleModal(false);
        setCallToDelete(null);
      } else {
        toast.error(data.message || 'Failed to delete call history entry.');
      }
    } catch (err) {
      console.error('Error deleting call history entry:', err);
      toast.error('Failed to delete call history entry.');
    } finally {
      setDeleting(false);
    }
  };

  const getEffectiveCallStatus = (call) => {
    if (!call) return 'ended';
    let status = call.status || 'ended';
    const isExpired = call.expiresAt && new Date() >= new Date(call.expiresAt);
    if (status === 'waiting') {
      if (call.duration > 0 || call.endTime || isExpired) {
        return 'ended';
      }
    }
    return status;
  };

  const filteredCalls = useMemo(() => {
    return calls.filter(call => {
      const effectiveStatus = getEffectiveCallStatus(call);
      const matchesType = filterType === 'all' || call.callType === filterType;
      const matchesStatus = filterStatus === 'all' ||
        (filterStatus === 'ended' && (effectiveStatus === 'ended' || effectiveStatus === 'accepted')) ||
        (filterStatus === 'missed' && (effectiveStatus === 'missed' || effectiveStatus === 'rejected' || effectiveStatus === 'cancelled'));

      const isLink = call.callMode === 'link' || !!call.linkToken;
      const matchesMode = filterMode === 'all' ||
        (filterMode === 'link' && isLink) ||
        (filterMode === 'direct' && !isLink);

      return matchesType && matchesStatus && matchesMode;
    });
  }, [calls, filterType, filterStatus, filterMode]);

  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ended':
      case 'accepted':
        return <FaCheckCircle className="text-green-500" />;
      case 'rejected':
      case 'missed':
      case 'cancelled':
        return <FaTimesCircle className="text-red-500" />;
      case 'ringing':
      case 'initiated':
        return <FaClock className="text-yellow-500" />;
      case 'waiting':
        return <FaClock className="text-gray-500 dark:text-gray-400" />;
      default:
        return <FaClock className="text-gray-500 dark:text-gray-400" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'ended':
        return 'Ended';
      case 'accepted':
        return 'Accepted';
      case 'rejected':
        return 'Rejected';
      case 'missed':
        return 'Missed';
      case 'cancelled':
        return 'Cancelled';
      case 'ringing':
        return 'Ringing';
      case 'initiated':
        return 'Initiated';
      case 'waiting':
        return 'Waiting';
      default:
        return status;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
          <h2 className="text-xl font-bold flex items-center gap-2">
            {isAdmin ? (
              <>
                <FaVideo className="text-lg" />
                Call History (Admin View)
              </>
            ) : (
              <>
                <FaPhone className="text-lg" />
                Call History
              </>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {/* Refresh Button (for both users and admins) */}
            <button
              onClick={fetchCallHistory}
              disabled={loading}
              className="text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center min-w-[32px] min-h-[32px]"
              title="Refresh"
            >
              {loading ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaSync className="w-4 h-4" />}
            </button>
            {/* Delete All Button (users only) */}
            {!isAdmin && calls.length > 0 && (
              <button
                onClick={() => setShowDeleteAllModal(true)}
                className="text-white hover:text-red-200 bg-white/10 hover:bg-red-500/20 rounded-full p-2 transition-colors"
                title="Delete all call history"
              >
                <FaTrash className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
              title="Close"
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 text-sm font-medium mr-2">
            <FaFilter />
            Filters:
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md text-sm text-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="audio">Audio Only</option>
            <option value="video">Video Only</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md text-sm text-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="ended">Completed</option>
            <option value="missed">Missed/Rejected</option>
          </select>

          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="px-3 py-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md text-sm text-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
          >
            <option value="all">All Modes</option>
            <option value="direct">Direct Calls</option>
            <option value="link">Link Calls</option>
          </select>

          {(filterType !== 'all' || filterStatus !== 'all' || filterMode !== 'all') && (
            <button
              onClick={() => {
                setFilterType('all');
                setFilterStatus('all');
                setFilterMode('all');
              }}
              className="px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors ml-auto"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 dark:bg-gray-800">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <UrbanSetuSpinner size="lg" />
              <span className="text-gray-600 dark:text-gray-400 font-medium animate-pulse">Loading call history...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <FaTimesCircle className="text-red-500 text-4xl mx-auto mb-2" />
                <p className="text-red-600 font-medium">{error}</p>
                <button
                  onClick={fetchCallHistory}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <FaPhone className="text-gray-400 dark:text-gray-500 text-5xl mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-300 font-medium text-lg">No calls found</p>
                {calls.length > 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Try adjusting your filters</p>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Calls made in this chat will appear here</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCalls.map((call) => {
                const isCaller = call.callerId?._id === currentUser?._id || call.callerId === currentUser?._id;
                const callerName = typeof call.callerId === 'object' ? call.callerId?.username : 'Unknown';
                const receiverName = typeof call.receiverId === 'object' ? call.receiverId?.username : 'Unknown';
                const isLinkCall = call.callMode === 'link' || !!call.linkToken;

                return (
                  <div
                    key={call._id || call.callId}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-700 animate-fade-in"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {/* Call Type Icon */}
                        <div className={`mt-1 p-2 rounded-full ${call.callType === 'video' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30'
                          }`}>
                          {call.callType === 'video' ? (
                            <FaVideo className={`text-lg ${call.callType === 'video' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`} />
                          ) : (
                            <FaPhone className="text-lg text-green-600 dark:text-green-400" />
                          )}
                        </div>

                        {/* Call Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-semibold text-gray-800 dark:text-white">
                              {isAdmin
                                ? `${callerName} → ${receiverName}`
                                : isCaller
                                  ? `You called ${receiverName}`
                                  : `${callerName} called you`
                              }
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                              {call.callType === 'video' ? 'Video' : 'Audio'}
                            </span>
                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md flex items-center gap-1 ${
                              isLinkCall
                                ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            }`}>
                              {isLinkCall ? '🔗 Link Call' : '📞 Direct Call'}
                            </span>
                            {isLinkCall && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLinkInfoCall(call);
                                }}
                                className="p-1 rounded-full text-purple-600 hover:text-purple-800 hover:bg-purple-100 dark:text-purple-400 dark:hover:text-purple-200 dark:hover:bg-purple-900/50 transition-colors flex items-center justify-center"
                                title="View Call Link Details"
                              >
                                <FaInfoCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 flex-wrap">
                            <div className="flex items-center gap-1">
                              <FaClock className="text-xs" />
                              <span>{formatDate(call.startTime || call.createdAt)}</span>
                            </div>
                            {call.duration > 0 && (
                              <div className="flex items-center gap-1">
                                <span>Duration: {formatDuration(call.duration)}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              {(() => {
                                const effectiveStatus = getEffectiveCallStatus(call);
                                return (
                                  <>
                                    {getStatusIcon(effectiveStatus)}
                                    <span className={`
                                      ${effectiveStatus === 'ended' || effectiveStatus === 'accepted' ? 'text-green-600 dark:text-green-400' : ''}
                                      ${effectiveStatus === 'rejected' || effectiveStatus === 'missed' || effectiveStatus === 'cancelled' ? 'text-red-600 dark:text-red-400' : ''}
                                      ${effectiveStatus === 'ringing' || effectiveStatus === 'initiated' || effectiveStatus === 'waiting' ? 'text-yellow-600 dark:text-yellow-400' : ''}
                                      font-medium
                                    `}>
                                      {getStatusText(effectiveStatus)}
                                    </span>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Delete Button (users only) */}
                      {!isAdmin && (
                        <button
                          onClick={() => {
                            setCallToDelete(call);
                            setShowDeleteSingleModal(true);
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full p-2 transition-colors ml-2 flex-shrink-0"
                          title="Delete this call history"
                        >
                          <FaTrash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Delete All Confirmation Modal */}
        {showDeleteAllModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <FaTrash className="text-red-600 dark:text-red-400 text-xl" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Delete All Call History</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                      Are you sure you want to delete all call history from your view? This action will only remove the calls from your view and will not affect the other party or the database records.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setShowDeleteAllModal(false)}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleDeleteAll}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? (
                      <>
                        <UrbanSetuSpinner size="sm" isBright={true} />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <FaTrash size={14} />
                        <span>Delete All</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Single Call Confirmation Modal */}
        {showDeleteSingleModal && callToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <FaTrash className="text-red-600 dark:text-red-400 text-xl" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Delete Call History</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                      Are you sure you want to delete this call history from your view? This action will only remove the call from your view and will not affect the other party or the database records.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => {
                      setShowDeleteSingleModal(false);
                      setCallToDelete(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleDeleteSingle}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? (
                      <>
                        <UrbanSetuSpinner size="sm" isBright={true} />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <FaTrash size={14} />
                        <span>Delete</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Call Link Info Modal */}
        {linkInfoCall && (() => {
          const callType = linkInfoCall.callType || 'video';
          const linkToken = linkInfoCall.linkToken || linkInfoCall.callId;
          const fullCallLink = linkInfoCall.callLink || `${window.location.origin}/call/${callType}/${linkToken}`;
          const isExpired = linkInfoCall.expiresAt ? new Date() >= new Date(linkInfoCall.expiresAt) : false;

          const getTimeLeftText = () => {
            if (!linkInfoCall.expiresAt) return 'No expiry set';
            const diffMs = new Date(linkInfoCall.expiresAt) - Date.now();
            if (diffMs <= 0) return 'Expired';
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            if (hours > 0) return `Expires in ${hours}h ${mins}m`;
            return `Expires in ${mins}m`;
          };

          return (
            <div
              className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
              onClick={(e) => { if (e.target === e.currentTarget) setLinkInfoCall(null); }}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

              {/* Modal Card */}
              <div className="relative w-full max-w-md bg-gray-900/95 backdrop-blur-xl border border-white/10 text-white rounded-2xl shadow-2xl overflow-hidden animate-[fadeInScale_0.2s_ease-out]">
                {/* Top Gradient Bar */}
                <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600" />

                {/* Close Button */}
                <button
                  onClick={() => setLinkInfoCall(null)}
                  className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors z-10"
                  aria-label="Close"
                >
                  <FaTimes className="text-sm" />
                </button>

                {/* Content */}
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg ${
                      callType === 'video'
                        ? 'bg-gradient-to-br from-blue-500 to-purple-600'
                        : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                    }`}>
                      {callType === 'video'
                        ? <FaVideo className="text-white text-lg" />
                        : <FaPhone className="text-white text-lg" />
                      }
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {callType === 'video' ? 'Video' : 'Audio'} Call Link
                      </h3>
                      <p className="text-xs text-gray-400">
                        Share this link to start the call
                      </p>
                    </div>
                  </div>

                  {/* Link Input + Copy Button */}
                  <div className="flex items-center gap-2 rounded-xl p-1 bg-gray-800/80 border border-white/5">
                    <input
                      type="text"
                      readOnly
                      value={fullCallLink}
                      className="flex-1 text-xs font-mono px-3 py-2.5 bg-transparent border-none outline-none truncate text-gray-300"
                      onClick={(e) => e.target.select()}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(fullCallLink);
                        setLinkCopied(true);
                        toast.success('Call link copied to clipboard!');
                        setTimeout(() => setLinkCopied(false), 2000);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex-shrink-0 ${
                        linkCopied
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-white/10 hover:bg-white/15 text-gray-300 border border-white/5'
                      }`}
                    >
                      {linkCopied ? <><FaCheck className="text-[10px]" /> Copied</> : <><FaCopy className="text-[10px]" /> Copy</>}
                    </button>
                  </div>

                  {/* Countdown / Expiry Badge */}
                  <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                    isExpired
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    <FaClock className="text-[10px]" />
                    <span>{getTimeLeftText()}</span>
                  </div>

                  {/* Info Badges */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-emerald-950/40 text-emerald-300 border border-emerald-500/20">
                      <FaCheckCircle className="text-emerald-400 text-xs flex-shrink-0" />
                      <span>Link already sent to chat</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-purple-950/40 text-purple-300 border border-purple-500/20">
                      <FaEnvelope className="text-purple-400 text-xs flex-shrink-0" />
                      <span>Email notification sent to the other party</span>
                    </div>
                  </div>

                  {/* Join Call Button */}
                  {!isExpired ? (
                    <button
                      onClick={() => {
                        window.open(fullCallLink, '_blank');
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-blue-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {callType === 'video' ? <FaVideo /> : <FaPhone />}
                      <span>Join Call</span>
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-gray-500 bg-gray-800 border border-white/5 cursor-not-allowed text-center"
                    >
                      Call Link Expired
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-lg">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Total calls: <strong>{filteredCalls.length}</strong></span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <FaVideo className="text-blue-600 dark:text-blue-400" />
                <span>Video: {filteredCalls.filter(c => c.callType === 'video').length}</span>
              </div>
              <div className="flex items-center gap-1">
                <FaPhone className="text-green-600 dark:text-green-400" />
                <span>Audio: {filteredCalls.filter(c => c.callType === 'audio').length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallHistoryModal;
