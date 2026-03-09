import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import {
    FaExclamationTriangle, FaSearch, FaFilter, FaBug, FaDesktop,
    FaMapMarkerAlt, FaGlobe, FaClock, FaTrash, FaCheckCircle,
    FaUserShield, FaCode, FaSpinner, FaChevronLeft, FaChevronRight, FaMobileAlt,
    FaHistory, FaCloud, FaFileAlt, FaHeadset
} from 'react-icons/fa';
import ClientErrorSkeleton from '../components/skeletons/ClientErrorSkeleton';
import VisitorDetailsModal from '../components/VisitorDetailsModal';
import { toast } from 'react-toastify';
import { authenticatedFetch } from '../utils/auth';

const calculateDuration = (start, end) => {
    if (!start || !end) return 'N/A';
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const diff = Math.max(0, Math.floor((e - s) / 1000));
    if (diff < 60) return `${diff}s`;
    const m = Math.floor(diff / 60);
    return `${m}m ${diff % 60}s`;
};

const ClientErrorMonitoring = () => {
    usePageTitle("Client Error Monitoring - Admin");
    const { currentUser } = useSelector((state) => state.user);

    const [errors, setErrors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalErrors, setTotalErrors] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [dateRange, setDateRange] = useState('all');
    const [browser, setBrowser] = useState('all');
    const [os, setOs] = useState('all');
    const [deviceType, setDeviceType] = useState('all');

    const [isRefetching, setIsRefetching] = useState(false);

    // Modal State
    const [selectedVisitor, setSelectedVisitor] = useState(null);
    const [showVisitorModal, setShowVisitorModal] = useState(false);
    const [isVisitorLoading, setIsVisitorLoading] = useState(false);

    const handleViewSession = async (visitorId) => {
        if (isVisitorLoading) return;
        setIsVisitorLoading(true);
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/visitors/monitor/${visitorId}`);
            const data = await res.json();
            if (data.success) {
                setSelectedVisitor(data.visitor);
                setShowVisitorModal(true);
            } else {
                toast.error("Failed to load session details");
            }
        } catch (err) {
            console.error(err);
            toast.error("Error loading session");
        } finally {
            setIsVisitorLoading(false);
        }
    };

    useEffect(() => {
        fetchErrors();
    }, [currentPage, searchQuery, dateRange, browser, os, deviceType]);

    const fetchErrors = async () => {
        try {
            if (errors.length === 0 && loading) {
                // Initial load
            } else {
                setIsRefetching(true);
            }

            const queryParams = new URLSearchParams({
                page: currentPage,
                limit: 10,
                search: searchQuery,
                dateRange,
                browser,
                os,
                deviceType
            });

            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/visitors/client-errors?${queryParams}`);

            const data = await res.json();

            if (res.ok) {
                setErrors(data.errors || []);
                setTotalErrors(data.total || 0);
                setTotalPages(data.pages || 1);
            } else {
                toast.error(data.message || 'Failed to fetch errors');
            }
        } catch (error) {
            console.error('Error fetching client errors:', error);
            toast.error('Network error while fetching logs');
        } finally {
            setLoading(false);
            setIsRefetching(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setCurrentPage(1); // Reset to first page
        fetchErrors();
    };

    const clearFilters = () => {
        setSearchQuery('');
        setDateRange('all');
        setBrowser('all');
        setOs('all');
        setDeviceType('all');
        setCurrentPage(1);
    };

    if (currentUser?.role !== 'admin' && currentUser?.role !== 'rootadmin') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center p-8">
                    <FaUserShield className="text-6xl text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Access Denied</h1>
                    <p className="text-gray-600 dark:text-gray-400">You do not have permission to view this page.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-red-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                                <FaBug className="text-red-500" />
                                Client Error Monitoring
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">
                                Monitor and analyze critical client-side exceptions and crashes reported by users.
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            <Link to="/admin/session-audit-logs" className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors">
                                <FaUserShield />
                                <span className="font-medium">Audit Logs</span>
                            </Link>

                            <Link to="/admin/support" className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg border border-green-100 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
                                <FaHeadset />
                                <span className="font-medium">Bug Tickets</span>
                            </Link>

                            <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg border border-red-100 dark:border-red-900/30">
                                <FaExclamationTriangle className="text-red-500" />
                                <div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Issues</div>
                                    <div className="text-xl font-bold text-red-600 dark:text-red-400">{totalErrors}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                    <form onSubmit={handleSearch} className="flex flex-col gap-4">
                        {/* Row 1: Search & Date */}
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search Errors</label>
                                <div className="relative">
                                    <FaSearch className="absolute left-3 top-3 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by error message, path, IP..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="w-full md:w-48">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time Range</label>
                                <select
                                    value={dateRange}
                                    onChange={(e) => setDateRange(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                    <option value="all">All Time</option>
                                    <option value="today">Today</option>
                                    <option value="yesterday">Yesterday</option>
                                    <option value="7days">Last 7 Days</option>
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Advanced Filters & Actions */}
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 w-full">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Browser</label>
                                    <select value={browser} onChange={(e) => setBrowser(e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white">
                                        <option value="all">All Browsers</option>
                                        <option value="Chrome">Chrome</option>
                                        <option value="Firefox">Firefox</option>
                                        <option value="Safari">Safari</option>
                                        <option value="Edge">Edge</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">OS</label>
                                    <select value={os} onChange={(e) => setOs(e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white">
                                        <option value="all">All OS</option>
                                        <option value="Windows">Windows</option>
                                        <option value="Mac">Mac OS</option>
                                        <option value="Linux">Linux</option>
                                        <option value="Android">Android</option>
                                        <option value="iOS">iOS</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Device</label>
                                    <select value={deviceType} onChange={(e) => setDeviceType(e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white">
                                        <option value="all">All Devices</option>
                                        <option value="desktop">Desktop</option>
                                        <option value="mobile">Mobile</option>
                                        <option value="tablet">Tablet</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-2 shrink-0">
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 font-medium h-[42px]"
                                >
                                    <FaFilter /> Filter
                                </button>
                                {(searchQuery || dateRange !== 'all' || browser !== 'all' || os !== 'all' || deviceType !== 'all') && (
                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors h-[42px]"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>
                    </form>
                </div>

                {/* Error List */}
                {loading ? (
                    <ClientErrorSkeleton />
                ) : errors.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FaCheckCircle className="text-4xl text-green-500" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Errors Found</h3>
                        <p className="text-gray-500 dark:text-gray-400">Everything seems to be running smoothly within the selected constraints.</p>
                    </div>
                ) : (
                    <div key={currentPage} className={`space-y-4 transition-opacity duration-200 ${isRefetching ? 'opacity-50 pointer-events-none' : ''}`}>
                        {errors.map((error, index) => (
                            <div
                                key={error.id || index}
                                className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow"
                                style={{ animation: `fadeIn 0.2s ease-out ${index * 0.03}s backwards` }}
                            >
                                {/* Error Header */}
                                <div className="bg-red-50 dark:bg-red-900/10 p-4 border-b border-red-100 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 p-2 bg-red-100 dark:bg-red-900/30 rounded-lg shrink-0">
                                            <FaCode className="text-red-500" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-red-600 dark:text-red-400 text-lg break-all">
                                                {error.message || "Unknown Error"}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                <span className="flex items-center gap-1">
                                                    <FaClock className="text-xs" />
                                                    {new Date(error.timestamp).toLocaleString('en-IN', {
                                                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                                                    })}
                                                </span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    <FaDesktop className="text-xs" />
                                                    {error.deviceType || 'Unknown Device'}
                                                </span>
                                                <span>•</span>
                                                <span className="bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-xs text-gray-700 dark:text-gray-300 font-mono">
                                                    {error.path || '/'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions (Future: Mark Resolved, Assign) */}
                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleViewSession(error.visitorId)}
                                            disabled={isVisitorLoading}
                                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-blue-200 dark:border-blue-800"
                                        >
                                            {isVisitorLoading ? <FaSpinner className="animate-spin" /> : <FaHistory />}
                                            View Session
                                        </button>
                                    </div>
                                </div>

                                {/* Error Details Body */}
                                <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Stack Trace / Technical Info */}
                                    <div className="lg:col-span-2 space-y-3">
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Stack Trace / Source</h4>
                                            <div className="bg-gray-900 text-gray-300 p-3 rounded-lg text-xs font-mono overflow-auto max-h-40 whitespace-pre-wrap border border-gray-700 custom-scrollbar">
                                                {error.stack || error.source || "No stack trace available."}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Context Info */}
                                    <div className="space-y-4 border-l border-gray-100 dark:border-gray-700 pl-0 lg:pl-6 pt-4 lg:pt-0">
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">User Environment</h4>
                                            <ul className="space-y-2 text-sm">
                                                <li className="flex items-start gap-2">
                                                    <FaGlobe className="mt-1 text-blue-500" />
                                                    <span className="text-gray-600 dark:text-gray-300 break-all">
                                                        <span className="font-semibold text-gray-800 dark:text-gray-200">Browser:</span> {error.browser} {error.browserVersion}
                                                    </span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <FaMobileAlt className="mt-1 text-purple-600" />
                                                    <span className="text-gray-600 dark:text-gray-300">
                                                        <span className="font-semibold text-gray-800 dark:text-gray-200">Device:</span> {error.device || 'Unknown'}
                                                    </span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <FaDesktop className="mt-1 text-purple-500" />
                                                    <span className="text-gray-600 dark:text-gray-300">
                                                        <span className="font-semibold text-gray-800 dark:text-gray-200">OS:</span> {String(error.os).replace('undefined', 'Unknown')}
                                                    </span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <FaMapMarkerAlt className="mt-1 text-red-500" />
                                                    <span className="text-gray-600 dark:text-gray-300">
                                                        <span className="font-semibold text-gray-800 dark:text-gray-200">IP:</span> {error.ip}
                                                    </span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <div className="mt-1 text-green-500 font-bold text-xs border border-green-500 rounded px-1">LOC</div>
                                                    <span className="text-gray-600 dark:text-gray-300">
                                                        {error.location || 'Unknown Location'}
                                                    </span>
                                                </li>
                                                <li className="pt-2 border-t border-gray-100 dark:border-gray-700 mt-2"></li>
                                                <li className="flex items-start gap-2">
                                                    <FaCloud className="mt-1 text-orange-500" />
                                                    <span className="text-gray-600 dark:text-gray-300">
                                                        <span className="font-semibold text-gray-800 dark:text-gray-200">Source:</span> {error.visitorSource || 'Direct'}
                                                    </span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <FaHistory className="mt-1 text-teal-500" />
                                                    <span className="text-gray-600 dark:text-gray-300">
                                                        <span className="font-semibold text-gray-800 dark:text-gray-200">Duration:</span> {calculateDuration(error.sessionStart, error.timestamp)}
                                                    </span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <FaFileAlt className="mt-1 text-indigo-500" />
                                                    <span className="text-gray-600 dark:text-gray-300">
                                                        <span className="font-semibold text-gray-800 dark:text-gray-200">Pages:</span> {error.pageCount || 1}
                                                    </span>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {!loading && totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between mt-8 gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200">
                        <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600">
                            Page <span className="font-bold text-gray-800 dark:text-white">{currentPage}</span> of <span className="font-bold text-gray-800 dark:text-white">{totalPages}</span>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <button
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="px-5 py-2.5 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-200 dark:hover:border-purple-800 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto flex items-center justify-center gap-2"
                            >
                                <FaChevronLeft /> Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className="px-5 py-2.5 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-md shadow-purple-200 dark:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto flex items-center justify-center gap-2"
                            >
                                Next <FaChevronRight />
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {/* Modal */}
            {showVisitorModal && (
                <VisitorDetailsModal
                    visitor={selectedVisitor}
                    onClose={() => setShowVisitorModal(false)}
                    onRefresh={() => handleViewSession(selectedVisitor._id)}
                    isRefreshing={isVisitorLoading}
                />
            )}
        </div>
    );
};

export default ClientErrorMonitoring;
