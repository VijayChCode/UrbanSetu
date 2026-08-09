import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaPhone, FaVideo, FaClock, FaCheckCircle, FaTimesCircle, FaTrash, FaSearch, FaCalendarAlt, FaFilter, FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../config/api';
import { usePageTitle } from '../hooks/usePageTitle';
import { authenticatedFetch } from '../utils/auth';

const CallHistorySkeleton = () => (
  <div className="space-y-4 animate-pulse">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div className="space-y-2 flex-1">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            </div>
          </div>
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </div>
      </div>
    ))}
  </div>
);

const CallHistory = () => {
  usePageTitle("Call History");
  const [calls, setCalls] = useState([]);
  const [allCalls, setAllCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState('all'); // all, audio, video
  const [modeFilter, setModeFilter] = useState('all'); // all, direct, link
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, missed, accepted, ended, rejected
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [showDeleteSingleModal, setShowDeleteSingleModal] = useState(false);
  const [callToDelete, setCallToDelete] = useState(null);

  const itemsPerPage = 10;

  useEffect(() => {
    fetchCallHistory();
  }, []);

  useEffect(() => {
    // Reset to first page when filtering
    setCurrentPage(1);
  }, [activeTab, modeFilter, search, statusFilter, dateRange]);

  useEffect(() => {
    applyFiltersAndPagination();
  }, [allCalls, activeTab, modeFilter, search, statusFilter, dateRange, currentPage]);

  const fetchCallHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('limit', '1000'); // Fetch all for client-side filtering

      const response = await authenticatedFetch(`${API_BASE_URL}/api/calls/history?${params}`);

      if (response.ok) {
        const data = await response.json();
        setAllCalls(data.calls || []);
      }
    } catch (error) {
      console.error('Error fetching call history:', error);
      toast.error('Failed to load call history');
    } finally {
      setLoading(false);
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

  const applyFiltersAndPagination = () => {
    let filtered = allCalls;

    // Tab Filter (Type)
    if (activeTab === 'audio') {
      filtered = filtered.filter(call => call.callType === 'audio');
    } else if (activeTab === 'video') {
      filtered = filtered.filter(call => call.callType === 'video');
    }

    // Mode Filter (Direct vs Link)
    if (modeFilter === 'link') {
      filtered = filtered.filter(call => call.callMode === 'link' || !!call.linkToken);
    } else if (modeFilter === 'direct') {
      filtered = filtered.filter(call => call.callMode !== 'link' && !call.linkToken);
    }

    // Status Filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(call => getEffectiveCallStatus(call) === statusFilter);
    }

    // Search
    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter(call =>
        call.callerId?.username?.toLowerCase().includes(query) ||
        call.receiverId?.username?.toLowerCase().includes(query) ||
        call.appointmentId?.propertyName?.toLowerCase().includes(query)
      );
    }

    // Date Range
    if (dateRange.start) {
      filtered = filtered.filter(call => new Date(call.startTime) >= new Date(dateRange.start));
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(call => new Date(call.startTime) <= endDate);
    }

    // Pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setCalls(filtered.slice(startIndex, endIndex));
  };

  const getFilteredTotal = () => {
    // Re-run filters logic just for count (simplified)
    let filtered = allCalls;
    if (activeTab === 'audio') filtered = filtered.filter(call => call.callType === 'audio');
    else if (activeTab === 'video') filtered = filtered.filter(call => call.callType === 'video');

    if (statusFilter !== 'all') filtered = filtered.filter(call => call.status === statusFilter);

    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter(call =>
        call.callerId?.username?.toLowerCase().includes(query) ||
        call.receiverId?.username?.toLowerCase().includes(query) ||
        call.appointmentId?.propertyName?.toLowerCase().includes(query)
      );
    }

    if (dateRange.start) filtered = filtered.filter(call => new Date(call.startTime) >= new Date(dateRange.start));
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(call => new Date(call.startTime) <= endDate);
    }
    return filtered.length;
  };

  const totalItems = getFilteredTotal();
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  const handleDeleteAll = () => {
    setAllCalls([]);
    setCalls([]); // Clear current view
    toast.success('All call history cleared from view');
    setShowDeleteAllModal(false);
  };

  const handleDeleteSingle = () => {
    if (!callToDelete) return;
    setAllCalls(prev => prev.filter(call => (call._id || call.callId) !== (callToDelete._id || callToDelete.callId)));
    toast.success('Call record removed');
    setShowDeleteSingleModal(false);
    setCallToDelete(null);
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    return `${minutes}m ${secs}s`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted':
      case 'ended': return 'text-green-600 bg-green-50 border-green-100 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
      case 'missed': return 'text-red-600 bg-red-50 border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
      case 'rejected': return 'text-orange-600 bg-orange-50 border-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
      default: return 'text-gray-600 bg-gray-50 border-gray-100 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'accepted':
      case 'ended': return <FaCheckCircle />;
      case 'missed':
      case 'rejected': return <FaTimesCircle />;
      default: return <FaClock />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Call History</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and view your past audio and video calls</p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/user/my-appointments"
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-800 transition-all shadow-sm font-medium"
            >
              <FaCalendarAlt size={14} />
              <span>Go to My Appointments</span>
            </Link>
            {allCalls.length > 0 && (
              <button
                onClick={() => setShowDeleteAllModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-800 transition-all shadow-sm font-medium"
              >
                <FaTrash size={14} />
                <span>Clear History</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-4 transition-colors duration-200">
          {/* Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex p-1 bg-gray-100 dark:bg-gray-900 rounded-lg w-fit">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'all' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                All Calls
              </button>
              <button
                onClick={() => setActiveTab('audio')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'audio' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                Audio
              </button>
              <button
                onClick={() => setActiveTab('video')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'video' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                Video
              </button>
            </div>

            {/* Mode Filter */}
            <div className="flex p-1 bg-gray-100 dark:bg-gray-900 rounded-lg w-fit">
              <button
                onClick={() => setModeFilter('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${modeFilter === 'all' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                All Modes
              </button>
              <button
                onClick={() => setModeFilter('direct')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${modeFilter === 'direct' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                📞 Direct Calls
              </button>
              <button
                onClick={() => setModeFilter('link')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${modeFilter === 'link' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                🔗 Link Calls
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Search */}
            <div className="md:col-span-4 relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search user or property..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white dark:placeholder-gray-400"
              />
            </div>

            {/* Status Filter */}
            <div className="md:col-span-3 relative">
              <FaFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none transition-all cursor-pointer dark:text-white"
              >
                <option value="all">All Statuses</option>
                <option value="ended">Completed</option>
                <option value="missed">Missed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="md:col-span-5 flex gap-2">
              <div className="relative flex-1">
                <input
                  type="date"
                  value={dateRange.start}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm dark:text-white dark:placeholder-gray-400"
                />
              </div>
              <span className="self-center text-gray-400">-</span>
              <div className="relative flex-1">
                <input
                  type="date"
                  value={dateRange.end}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm dark:text-white dark:placeholder-gray-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <CallHistorySkeleton />
        ) : calls.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 dashed-border">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaPhone className="text-gray-300 dark:text-gray-500 text-2xl" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No calls found</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1">
              {statusFilter !== 'all' || search || activeTab !== 'all' || modeFilter !== 'all' ? 'Try adjusting your filters.' : 'Your call history will appear here once you make or receive calls.'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors duration-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50/50 dark:bg-gray-700/50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Details</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date & Time</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Duration</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {calls.map((call, index) => {
                    const isLinkCall = call.callMode === 'link' || !!call.linkToken;
                    return (
                      <tr
                        key={call._id}
                        className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors"
                        style={{ animation: `fadeIn 0.2s ease-out ${index * 0.03}s backwards` }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`p-2 rounded-lg ${call.callType === 'video' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>
                              {call.callType === 'video' ? <FaVideo /> : <FaPhone />}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {call.callerId?.username || 'Unknown'} <span className="text-gray-400">→</span> {call.receiverId?.username || 'Unknown'}
                              </span>
                              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md flex items-center gap-1 ${
                                isLinkCall
                                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                  : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              }`}>
                                {isLinkCall ? '🔗 Link Call' : '📞 Direct Call'}
                              </span>
                            </div>
                            {call.appointmentId?.propertyName && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">{call.appointmentId.propertyName}</span>
                            )}
                          </div>
                        </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex flex-col">
                          <span>{new Date(call.startTime).toLocaleDateString(undefined, {
                            year: 'numeric', month: 'short', day: 'numeric'
                          })}</span>
                          <span className="text-xs text-gray-400">{new Date(call.startTime).toLocaleTimeString(undefined, {
                            hour: '2-digit', minute: '2-digit'
                          })}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {call.duration > 0 ? (
                          <span className="flex items-center gap-1.5 text-blue-600/80 dark:text-blue-400/80">
                            {formatDuration(call.duration)}
                          </span>
                        ) : '0s'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(() => {
                          const effectiveStatus = getEffectiveCallStatus(call);
                          return (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center w-fit gap-1.5 ${getStatusColor(effectiveStatus)}`}>
                              {getStatusIcon(effectiveStatus)}
                              <span className="capitalize">{effectiveStatus}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setCallToDelete(call);
                            setShowDeleteSingleModal(true);
                          }}
                          className="text-gray-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                          title="Delete record"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing page <span className="font-semibold text-gray-900 dark:text-white">{currentPage}</span> of <span className="font-semibold dark:text-gray-300">{totalPages}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <FaArrowLeft size={12} /> Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next <FaArrowRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Single Modal */}
      {showDeleteSingleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6 transform transition-all scale-100">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 mx-auto text-red-600 dark:text-red-400">
              <FaTrash size={20} />
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">Delete Record?</h3>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-6">
              This will remove this call from your history view. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteSingleModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSingle}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors shadow-lg shadow-red-500/30"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6 transform transition-all scale-100">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 mx-auto text-red-600 dark:text-red-400">
              <FaTrash size={20} />
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">Clear History?</h3>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to clear your entire call history? This action is permanent and cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteAllModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors shadow-lg shadow-red-500/30"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default CallHistory;
