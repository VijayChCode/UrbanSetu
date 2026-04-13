import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { 
  FaHistory, FaSearch, FaFilter, FaSync, FaShieldAlt, 
  FaUser, FaCalendarAlt, FaInfoCircle, FaCheckCircle, 
  FaExclamationTriangle, FaTerminal, FaClock, FaGlobe,
  FaArrowLeft, FaArrowRight, FaChevronDown
} from 'react-icons/fa';
import { usePageTitle } from '../hooks/usePageTitle';
import { authenticatedFetch } from '../utils/auth';
import { toast } from 'react-toastify';
import AdminAuditTrailSkeleton from '../components/skeletons/AdminAuditTrailSkeleton';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminAuditTrail() {
  usePageTitle("Admin Audit Trail - Security & Activity Logs");
  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [logTypes, setLogTypes] = useState([]);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [systemOnly, setSystemOnly] = useState(false);
  
  // UI State
  const [selectedLog, setSelectedLog] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLogs = useCallback(async (page = 1) => {
    try {
      if (page === 1) setLoading(true);
      else setIsRefreshing(true);

      const params = new URLSearchParams({
        page,
        limit: 20,
        type: typeFilter,
        search: searchQuery,
        startDate,
        endDate,
        systemOnly: systemOnly ? 'true' : 'false'
      });

      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/audit-logs/all?${params}`);
      const data = await res.json();

      if (data.success) {
        setLogs(data.logs);
        setTotalLogs(data.total);
        setTotalPages(data.totalPages);
        setCurrentPage(data.page);
      } else {
        toast.error(data.message || "Failed to fetch audit logs");
      }
    } catch (error) {
      console.error("Audit log fetch error:", error);
      toast.error("An error occurred while fetching audit logs");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [typeFilter, searchQuery, startDate, endDate, systemOnly]);

  const fetchTypes = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/audit-logs/types`);
      const data = await res.json();
      if (data.success) {
        setLogTypes(data.types);
      }
    } catch (error) {
      console.error("Failed to fetch log types:", error);
    }
  };

  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin')) {
      navigate('/');
      return;
    }
    fetchLogs(1);
    fetchTypes();
  }, [fetchLogs, currentUser, navigate]);

  const handleRefresh = () => {
    fetchLogs(currentPage);
  };

  const today = new Date().toISOString().split('T')[0];

  const resetFilters = () => {
    setTypeFilter('all');
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setSystemOnly(false);
    setCurrentPage(1);
  };

  const getLogTypeBadge = (type) => {
    switch (type) {
      case 'security':
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">SECURITY</span>;
      case 'fraud':
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">FRAUD</span>;
      case 'transaction':
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">TRANSACTION</span>;
      case 'user_management':
        return <span className="px-2 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">ADMIN MGMT</span>;
      case 'auth':
        return <span className="px-2 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">AUTH</span>;
      case 'settings':
        return <span className="px-2 py-1 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-100/10 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">SETTINGS</span>;
      case 'listing':
        return <span className="px-2 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">LISTING</span>;
      case 'system':
        return <span className="px-2 py-1 rounded-full text-[10px] font-black bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100">SYSTEM</span>;
      case 'blog':
        return <span className="px-2 py-1 rounded-full text-[10px] font-black bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">BLOG</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-[10px] font-black bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">{type?.toUpperCase()?.replace('_', ' ') || 'INFO'}</span>;
    }
  };

  const formatMetadata = (metadata) => {
    if (!metadata) return null;
    return (
      <div className="space-y-2 mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 font-mono text-sm">
        {Object.entries(metadata).map(([key, value]) => (
          <div key={key} className="flex flex-col sm:flex-row sm:justify-between border-b border-gray-100 dark:border-gray-800 pb-1 last:border-0 last:pb-0">
            <span className="text-gray-500 dark:text-gray-400 font-bold">{key}:</span>
            <span className="text-gray-900 dark:text-gray-100 break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <FaHistory className="text-2xl text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Admin Audit Trail</h1>
              <p className="text-gray-500 dark:text-gray-400">System-wide administrative activity and security monitoring</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm disabled:opacity-50"
            >
              <FaSync className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-xl text-sm font-bold border border-indigo-100 dark:border-indigo-900/30">
              {totalLogs.toLocaleString()} Events Found
            </div>
          </div>
        </div>

        {/* Filter Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-end">
            <div className="space-y-2 lg:col-span-3">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Search Events</label>
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Action, Email, ID..."
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-gray-200"
                />
              </div>
            </div>

            <div className="space-y-2 lg:col-span-3">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Log Type</label>
              <div className="relative">
                <FaFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
                <select 
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none transition-all dark:text-gray-200"
                >
                  <option value="all">Every Type</option>
                  {[...new Set(['security', 'fraud', 'transaction', 'user_management', 'auth', 'settings', 'listing', 'system', 'blog', ...logTypes])].sort().map(t => (
                    <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>
                  ))}
                </select>
                <FaChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2 lg:col-span-4">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date Range</label>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <input 
                  type="date" 
                  value={startDate}
                  max={today}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-gray-200"
                />
                <span className="text-gray-400 text-xs font-bold shrink-0">TO</span>
                <input 
                  type="date" 
                  value={endDate}
                  max={today}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-gray-200"
                />
              </div>
            </div>

            <div className="flex items-end gap-2 lg:col-span-2">
              <label className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-all flex-1 min-w-0 group">
                <input 
                  type="checkbox" 
                  checked={systemOnly}
                  onChange={(e) => setSystemOnly(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-transform group-hover:scale-110"
                />
                <span className="text-[10px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 truncate">SYSTEM ONLY</span>
              </label>
              <button 
                onClick={resetFilters}
                className="px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl text-[10px] sm:text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all shadow-sm shrink-0"
              >
                RESET
              </button>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          {loading ? (
            <AdminAuditTrailSkeleton />
          ) : logs.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-4 text-center px-4">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-2">
                <FaInfoCircle className="text-3xl text-gray-300 dark:text-gray-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">No Logs Found</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">No administrative activities match your current filter criteria.</p>
              <button onClick={resetFilters} className="text-indigo-600 font-bold hover:underline">Clear all filters</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actor</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Type</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">IP / Method</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {logs.map((log) => (
                    <tr key={log._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {new Date(log.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <FaTerminal className="text-indigo-500 w-3 h-3" />
                          <span className="text-sm font-bold text-gray-800 dark:text-gray-200 break-words max-w-[200px]">
                            {log.action}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {log.ip === 'SYSTEM' ? (
                            <>
                              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                                <FaShieldAlt className="text-indigo-600 dark:text-indigo-400 w-3 h-3" />
                              </div>
                              <span className="text-sm font-black text-indigo-700 dark:text-indigo-400 italic letter tracking-tighter">SYSTEM</span>
                            </>
                          ) : (
                            <>
                              <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center overflow-hidden">
                                {log.adminId?.avatar ? (
                                  <img src={log.adminId.avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <FaUser className="text-gray-400 w-3 h-3" />
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                  {log.adminId?.username || 'Unknown Admin'}
                                </span>
                                <span className="text-[10px] text-gray-500 uppercase font-black">{log.adminId?.role || 'Admin'}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        {getLogTypeBadge(log.type)}
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-xs font-mono text-gray-600 dark:text-gray-400">
                            <FaGlobe className="w-2.5 h-2.5 opacity-50" />
                            <span>{log.ip}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase">
                            <FaClock className="w-2.5 h-2.5 opacity-50" />
                            <span>{log.method || 'GET'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setSelectedLog(log)}
                          className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                          <FaInfoCircle className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {!loading && logs.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/50 dark:bg-gray-900/50">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing <span className="font-bold text-gray-900 dark:text-gray-100">{logs.length}</span> of <span className="font-bold text-gray-900 dark:text-gray-100">{totalLogs}</span> entries
              </p>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => fetchLogs(currentPage - 1)}
                  disabled={currentPage === 1 || isRefreshing}
                  className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-gray-600 dark:text-gray-400"
                >
                  <FaArrowLeft className="w-3 h-3" />
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;

                    return (
                      <button 
                        key={pageNum}
                        onClick={() => fetchLogs(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                          currentPage === pageNum 
                            ? 'bg-indigo-600 text-white border-transparent' 
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <span className="text-gray-400 px-1">...</span>
                      <button 
                        onClick={() => fetchLogs(totalPages)}
                        className="w-8 h-8 rounded-lg text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>

                <button 
                  onClick={() => fetchLogs(currentPage + 1)}
                  disabled={currentPage === totalPages || isRefreshing}
                  className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-gray-600 dark:text-gray-400"
                >
                  <FaArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-[999] p-4 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-indigo-600">
              <div className="flex items-center gap-3">
                <FaInfoCircle className="text-white text-xl" />
                <h3 className="text-xl font-bold text-white">Event Metadata</h3>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-all text-xl"
              >
                &times;
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Action Performed</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{selectedLog.action}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Event Type</p>
                  <div>{getLogTypeBadge(selectedLog.type)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 ">
                    <FaCalendarAlt className="w-2.5 h-2.5" /> Exact Timestamp
                  </p>
                  <p className="text-sm font-semibold dark:text-gray-200">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 justify-end">
                    <FaGlobe className="w-2.5 h-2.5" /> Source Address
                  </p>
                  <p className="text-sm font-mono font-semibold text-indigo-600 dark:text-indigo-400">{selectedLog.ip}</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <FaTerminal className="w-2.5 h-2.5" /> Internal Metadata
                </p>
                {selectedLog.metadata ? formatMetadata(selectedLog.metadata) : (
                  <p className="text-sm italic text-gray-400 py-4 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">No additional data captured for this event</p>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="px-8 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95"
                >
                  Close View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
        }
      `}</style>
    </div>
  );
}
