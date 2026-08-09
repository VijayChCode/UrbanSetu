import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaPhone, FaVideo, FaClock, FaCheckCircle, FaTimesCircle, FaFilter, FaSearch, FaCalendarAlt, FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import { API_BASE_URL } from '../config/api';
import { authenticatedFetch } from '../utils/auth';
import { usePageTitle } from '../hooks/usePageTitle';

const AdminCallHistorySkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden animate-pulse">
    <div className="p-6 border-b border-gray-100 dark:border-gray-700 space-y-4">
      <div className="flex gap-4">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/4"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/4"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/4"></div>
      </div>
    </div>
    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="p-4 flex gap-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        </div>
      ))}
    </div>
  </div>
);

const AdminCallHistory = () => {
  usePageTitle("Call History - Admin Panel");
  const [allCalls, setAllCalls] = useState([]);
  const [visibleCalls, setVisibleCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [callType, setCallType] = useState('all');
  const [callMode, setCallMode] = useState('all'); // 'all', 'direct', 'link'
  const [status, setStatus] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchAllCallHistory();
  }, []);

  useEffect(() => {
    applyFiltersAndPagination();
  }, [allCalls, search, callType, callMode, status, dateRange, currentPage]);

  const fetchAllCallHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('limit', '1000');

      const response = await authenticatedFetch(`${API_BASE_URL}/api/calls/admin/history?${params}`);

      if (response.ok) {
        const data = await response.json();
        setAllCalls(data.calls || []);
      }
    } catch (error) {
      console.error('Error fetching call history:', error);
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

    if (callType !== 'all') {
      filtered = filtered.filter(call => call.callType === callType);
    }

    if (callMode === 'link') {
      filtered = filtered.filter(call => call.callMode === 'link' || !!call.linkToken);
    } else if (callMode === 'direct') {
      filtered = filtered.filter(call => call.callMode !== 'link' && !call.linkToken);
    }

    if (status !== 'all') {
      filtered = filtered.filter(call => getEffectiveCallStatus(call) === status);
    }

    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter(call =>
        call.callerId?.username?.toLowerCase().includes(query) ||
        call.receiverId?.username?.toLowerCase().includes(query) ||
        call.callerId?.email?.toLowerCase().includes(query) ||
        call.receiverId?.email?.toLowerCase().includes(query) ||
        call.appointmentId?.propertyName?.toLowerCase().includes(query)
      );
    }

    if (dateRange.start) {
      filtered = filtered.filter(call => new Date(call.startTime) >= new Date(dateRange.start));
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(call => new Date(call.startTime) <= endDate);
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setVisibleCalls(filtered.slice(startIndex, endIndex));
  };

  const getFilteredTotal = () => {
    let filtered = allCalls;
    if (callType !== 'all') filtered = filtered.filter(call => call.callType === callType);
    if (callMode === 'link') filtered = filtered.filter(call => call.callMode === 'link' || !!call.linkToken);
    else if (callMode === 'direct') filtered = filtered.filter(call => call.callMode !== 'link' && !call.linkToken);
    if (status !== 'all') filtered = filtered.filter(call => call.status === status);
    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter(call =>
        call.callerId?.username?.toLowerCase().includes(query) ||
        call.receiverId?.username?.toLowerCase().includes(query) ||
        call.callerId?.email?.toLowerCase().includes(query) ||
        call.receiverId?.email?.toLowerCase().includes(query) ||
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

  const stats = React.useMemo(() => {
    const total = allCalls.length;
    const audio = allCalls.filter(call => call.callType === 'audio').length;
    const video = allCalls.filter(call => call.callType === 'video').length;
    const missed = allCalls.filter(call => call.status === 'missed').length;
    return { total, audio, video, missed };
  }, [allCalls]);

  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    return `${minutes}m ${secs}s`;
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 p-6 md:p-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Admin Call History</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Monitor system-wide call logs and statistics</p>
          </div>
          <Link
            to="/admin/appointments"
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-800 transition-all shadow-sm font-medium"
          >
            <FaCalendarAlt size={14} />
            <span>Go to Appointments</span>
          </Link>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200">
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Calls</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200">
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Audio Calls</p>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.audio}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200">
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Video Calls</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.video}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200">
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Missed Calls</p>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.missed}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-4 transition-colors duration-200">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Search */}
            <div className="md:col-span-4 relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search user, email or property..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm dark:text-white dark:placeholder-gray-400"
              />
            </div>

            {/* Type */}
            <div className="md:col-span-2 relative">
              <select
                value={callType}
                onChange={(e) => setCallType(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm cursor-pointer dark:text-white"
              >
                <option value="all">All Types</option>
                <option value="audio">Audio</option>
                <option value="video">Video</option>
              </select>
            </div>

            {/* Mode */}
            <div className="md:col-span-2 relative">
              <select
                value={callMode}
                onChange={(e) => setCallMode(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm cursor-pointer dark:text-white"
              >
                <option value="all">All Modes</option>
                <option value="direct">Direct Calls</option>
                <option value="link">Link Calls</option>
              </select>
            </div>

            {/* Status */}
            <div className="md:col-span-2 relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm cursor-pointer dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="ended">Ended</option>
                <option value="missed">Missed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="md:col-span-3 flex gap-2">
              <input
                type="date"
                value={dateRange.start}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm dark:text-white dark:placeholder-gray-400"
              />
              <span className="self-center text-gray-400">-</span>
              <input
                type="date"
                value={dateRange.end}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm dark:text-white dark:placeholder-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors duration-200">
          {loading ? (
            <AdminCallHistorySkeleton />
          ) : visibleCalls.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaSearch className="text-gray-300 dark:text-gray-500 text-xl" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">No calls found</h3>
              <p className="text-gray-500 dark:text-gray-400">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50/50 dark:bg-gray-700/50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type & Mode</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Caller</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Receiver</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Property</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date & Time</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Duration</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {visibleCalls.map((call, index) => {
                    const isLinkCall = call.callMode === 'link' || !!call.linkToken;
                    return (
                      <tr
                        key={call._id}
                        className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors"
                        style={{ animation: `fadeIn 0.2s ease-out ${index * 0.03}s backwards` }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${call.callType === 'video' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>
                              {call.callType === 'video' ? <FaVideo /> : <FaPhone />}
                            </div>
                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md flex items-center gap-1 ${
                              isLinkCall
                                ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            }`}>
                              {isLinkCall ? '🔗 Link' : '📞 Direct'}
                            </span>
                          </div>
                        </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{call.callerId?.username || 'Unknown'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{call.callerId?.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{call.receiverId?.username || 'Unknown'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{call.receiverId?.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {call.appointmentId?.propertyName || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(call.startTime).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {formatDuration(call.duration)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(() => {
                          const effectiveStatus = getEffectiveCallStatus(call);
                          return (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${effectiveStatus === 'ended' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                              effectiveStatus === 'missed' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                              {effectiveStatus}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span>
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
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default AdminCallHistory;
