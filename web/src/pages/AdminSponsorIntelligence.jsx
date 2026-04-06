import React, { useState, useEffect, useMemo } from 'react';
import {
    FaGlobe, FaChartPie, FaChartLine, FaUsers,
    FaExternalLinkAlt, FaSync, FaArrowUp, FaArrowDown,
    FaBullhorn, FaMousePointer, FaClock, FaFilter,
    FaCalendarAlt, FaChevronRight, FaTrophy, FaRocket,
    FaArrowLeft, FaArrowRight, FaFingerprint, FaEye, FaTimes,
    FaHistory, FaMapMarkerAlt, FaSearch, FaChevronLeft
} from 'react-icons/fa';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
    LineChart, Line, AreaChart, Area
} from 'recharts';
import { authenticatedFetch } from '../utils/auth';
import { toast } from 'react-toastify';
import { usePageTitle } from '../hooks/usePageTitle';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import AdminDashboardSkeleton from '../components/skeletons/AdminDashboardSkeleton';
import VisitorDetailsModal from '../components/VisitorDetailsModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366F1'];

const AdminSponsorIntelligence = () => {
    usePageTitle("Sponsor Intelligence - Marketing ROI");

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [days, setDays] = useState(30);
    const [stats, setStats] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    // Drill-down states
    const [selectedReferrer, setSelectedReferrer] = useState(null);
    const [referrerVisitors, setReferrerVisitors] = useState([]);
    const [referrerVisitorsLoading, setReferrerVisitorsLoading] = useState(false);
    const [referrerPage, setReferrerPage] = useState(1);
    const [referrerTotalPages, setReferrerTotalPages] = useState(1);
    const [totalReferrerVisitors, setTotalReferrerVisitors] = useState(0);
    const [showReferrerModal, setShowReferrerModal] = useState(false);

    // Individual Visitor Details Modal
    const [selectedVisitor, setSelectedVisitor] = useState(null);
    const [showVisitorDetailsModal, setShowVisitorDetailsModal] = useState(false);
    const [isRefreshingVisitor, setIsRefreshingVisitor] = useState(false);

    // Drill-down Context (Referrer or Campaign)
    const [drillDownType, setDrillDownType] = useState('referrer'); // 'referrer' | 'campaign'

    const fetchMarketingStats = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/visitors/marketing-stats?days=${days}`);
            const data = await res.json();
            if (data.success) {
                setStats(data.stats);
            } else {
                toast.error(data.message || "Failed to fetch marketing stats");
            }
        } catch (error) {
            console.error("Marketing stats error:", error);
            toast.error("Network error fetching marketing intelligence");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchMarketingStats();
    }, [days]);

    const fetchReferrerVisitors = async (value, page = 1, type = drillDownType) => {
        // Only show full loading spinner for the first load
        if (page === 1) setReferrerVisitorsLoading(true);
        try {
            // Use the standard visitors/all endpoint with specific filters
            const params = new URLSearchParams({
                page,
                limit: 10,
                [type === 'referrer' ? 'referrer' : 'utm_campaign']: value,
                dateRange: days === 7 ? '7days' : (days === 30 ? '30days' : 'all')
            });

            const res = await authenticatedFetch(`${API_BASE_URL}/api/visitors/all?${params}`);
            const data = await res.json();

            if (data.success) {
                setReferrerVisitors(data.visitors || []);
                setTotalReferrerVisitors(data.total);
                setReferrerTotalPages(data.pages || 1);
            } else {
                toast.error(data.message || "Failed to fetch details");
            }
        } catch (error) {
            console.error("Drill-down error:", error);
            toast.error("Error loading details");
        } finally {
            setReferrerVisitorsLoading(false);
        }
    };

    const handleViewReferrerDetails = (referrer) => {
        setDrillDownType('referrer');
        setSelectedReferrer(referrer);
        setReferrerPage(1);
        setShowReferrerModal(true);
        fetchReferrerVisitors(referrer, 1, 'referrer');
    };

    const handleViewCampaignDetails = (campaign) => {
        if (campaign === 'None') return;
        setDrillDownType('campaign');
        setSelectedReferrer(campaign);
        setReferrerPage(1);
        setShowReferrerModal(true);
        fetchReferrerVisitors(campaign, 1, 'campaign');
    };

    useEffect(() => {
        if (showReferrerModal && selectedReferrer) {
            fetchReferrerVisitors(selectedReferrer, referrerPage, drillDownType);
        }
    }, [referrerPage]);

    const handleViewVisitorDetails = (visitor) => {
        setSelectedVisitor(visitor);
        setShowVisitorDetailsModal(true);
    };

    const handleRefreshVisitorDetails = async () => {
        if (!selectedVisitor) return;
        setIsRefreshingVisitor(true);
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/visitors/monitor/${selectedVisitor._id}`);
            const data = await res.json();
            if (data.success) {
                setSelectedVisitor(data.visitor);
                // Update in list too
                setReferrerVisitors(prev => prev.map(v => v._id === data.visitor._id ? data.visitor : v));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsRefreshingVisitor(false);
        }
    };

    // Format duration from ms to readable string
    const formatDuration = (ms) => {
        if (!ms) return "0s";
        const seconds = Math.round(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ${seconds % 60}s`;
    };

    const sourceData = useMemo(() => {
        if (!stats?.sources) return [];
        return stats.sources.map(s => ({
            name: s._id,
            value: s.count,
            avgPages: Math.round(s.avgPageViews * 10) / 10,
            avgDuration: formatDuration(s.avgDuration)
        }));
    }, [stats]);

    const mediumData = useMemo(() => {
        if (!stats?.mediums) return [];
        return stats.mediums.map(m => ({
            name: m._id,
            value: m.count
        }));
    }, [stats]);

    const paginatedReferrers = useMemo(() => {
        if (!stats?.referrers) return [];
        const startIndex = (currentPage - 1) * itemsPerPage;
        return stats.referrers.slice(startIndex, startIndex + itemsPerPage);
    }, [stats, currentPage]);

    const totalPages = Math.ceil((stats?.referrers?.length || 0) / itemsPerPage) || 1;

    if (loading) return <AdminDashboardSkeleton />;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
            <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
                {/* Header */}
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-800 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-bl-full -mr-16 -mt-16 opacity-50 group-hover:scale-110 transition-transform duration-700"></div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/30 text-white">
                                    <FaRocket className="text-2xl animate-pulse" />
                                </div>
                                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400">
                                    Sponsor Intelligence
                                </h1>
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 text-lg ml-1">
                                Complete acquisition funnel & referral tracking
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl flex gap-1 border border-gray-200 dark:border-gray-700">
                                {[7, 30, 90].map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setDays(d)}
                                        className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${days === d
                                            ? 'bg-white dark:bg-gray-950 text-blue-600 dark:text-blue-400 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                    >
                                        {d}D
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => fetchMarketingStats(true)}
                                className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all hover:scale-110 active:scale-95 shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center min-w-[48px]"
                                disabled={refreshing}
                            >
                                {refreshing ? <UrbanSetuSpinner size="xs" isBright={true} /> : <FaSync />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <KPICard
                        title="Top Source"
                        value={stats?.sources?.[0]?._id || 'N/A'}
                        subtitle={`${stats?.sources?.[0]?.count || 0} visits`}
                        icon={<FaGlobe className="text-blue-500" />}
                        color="blue"
                    />
                    <KPICard
                        title="Main Medium"
                        value={stats?.mediums?.[0]?._id || 'N/A'}
                        subtitle="Primary channel"
                        icon={<FaBullhorn className="text-purple-500" />}
                        color="purple"
                    />
                    <KPICard
                        title="Lead Quality"
                        value={stats?.sources?.[0]?.avgPageViews?.toFixed(1) || '0.0'}
                        subtitle="Avg pages/session"
                        icon={<FaMousePointer className="text-pink-500" />}
                        color="pink"
                    />
                    <KPICard
                        title="Retention"
                        value={formatDuration(stats?.sources?.[0]?.avgDuration)}
                        subtitle="Avg session time"
                        icon={<FaClock className="text-indigo-500" />}
                        color="indigo"
                    />
                </div>

                {/* Main Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Source Breakdown Pie */}
                    <div className="lg:col-span-1 bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-800">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                            <FaChartPie className="text-blue-500" /> Source Distribution
                        </h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={sourceData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {sourceData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.96)',
                                            borderRadius: '12px',
                                            border: 'none',
                                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                                            color: '#111827'
                                        }}
                                        itemStyle={{ color: '#3B82F6', fontWeight: 'bold' }}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Source Performance Bar */}
                    <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-800">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                            <FaTrophy className="text-yellow-500" /> Source Performance (Engagement)
                        </h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={sourceData.slice(0, 5)}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                                        contentStyle={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.96)',
                                            borderRadius: '12px',
                                            border: 'none',
                                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                                            color: '#111827',
                                            padding: '12px'
                                        }}
                                        labelStyle={{ color: '#111827', fontWeight: 'bold', marginBottom: '4px' }}
                                        itemStyle={{ color: '#3B82F6' }}
                                    />
                                    <Bar dataKey="avgPages" name="Pages/Session" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Comprehensive Tables */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Campaigns Table */}
                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-3">
                                <FaBullhorn className="text-purple-500" /> Active Campaigns
                            </h3>
                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">Tracking Live</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="border-b border-gray-100 dark:border-gray-800">
                                    <tr className="text-left text-gray-400 text-xs font-black uppercase tracking-widest">
                                        <th className="pb-4">Campaign Name</th>
                                        <th className="pb-4 text-center">Inbound Hits</th>
                                        <th className="pb-4 text-right">Trend</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                                    {(stats?.campaigns || []).map((c, i) => (
                                        <tr key={i} className={`group hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${c._id !== 'None' ? 'cursor-pointer' : ''}`}
                                            onClick={() => c._id !== 'None' && handleViewCampaignDetails(c._id)}
                                        >
                                            <td className="py-4 text-sm font-bold text-gray-700 dark:text-gray-300">
                                                <div className="flex items-center gap-2">
                                                    {c._id}
                                                    {c._id !== 'None' && <FaExternalLinkAlt className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500" />}
                                                </div>
                                            </td>
                                            <td className="py-4 text-sm text-center">
                                                <span className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg font-mono">
                                                    {c.count}
                                                </span>
                                            </td>
                                            <td className="py-4 text-right">
                                                <FaArrowUp className="inline text-green-500 text-xs" />
                                            </td>
                                        </tr>
                                    ))}
                                    {(!stats?.campaigns || stats.campaigns.length === 0) && (
                                        <tr><td colSpan="3" className="py-8 text-center text-gray-400">No campaign data detected</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Referrers Table */}
                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-3">
                                <FaExternalLinkAlt className="text-indigo-500" /> Redirect Sponsors
                            </h3>
                            <FaFilter className="text-gray-300" />
                        </div>
                        <div className="space-y-4">
                            {paginatedReferrers.map((r, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl hover:translate-x-1 transition-transform border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900"
                                    style={{ animation: `fadeIn 0.2s ease-out ${i * 0.03}s backwards` }}
                                >
                                    <div className="flex items-center gap-4 truncate mr-2">
                                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <FaGlobe className="text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                        <button
                                            onClick={() => handleViewReferrerDetails(r._id)}
                                            className="font-bold text-gray-700 dark:text-gray-300 truncate hover:text-indigo-600 dark:hover:text-indigo-400 text-left transition-colors"
                                        >
                                            {r._id}
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => handleViewReferrerDetails(r._id)}
                                        className="flex items-center gap-4 group/btn"
                                    >
                                        <span className="text-xs font-black text-indigo-500 group-hover/btn:scale-110 transition-transform">{r.count} LEADS</span>
                                        <FaChevronRight className="text-gray-300 text-sm group-hover/btn:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            ))}
                            {(!stats?.referrers || stats.referrers.length === 0) && (
                                <div className="py-12 text-center text-gray-400">No direct referring domains detected</div>
                            )}
                        </div>

                        {/* Pagination Section */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                    Showing page <span className="font-bold text-gray-900 dark:text-white">{currentPage}</span> of <span className="font-bold dark:text-gray-300">{totalPages}</span>
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                                    >
                                        <FaArrowLeft size={12} /> Previous
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                                    >
                                        Next <FaArrowRight size={12} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Referrer Details Modal (Drill-down) */}
            {showReferrerModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden border border-gray-100 dark:border-gray-800 flex flex-col">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                                    {drillDownType === 'referrer' ? <FaExternalLinkAlt className="text-2xl" /> : <FaBullhorn className="text-2xl" />}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                                        {drillDownType === 'referrer' ? 'Referral Details' : 'Campaign Details'}
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 font-medium break-all">{selectedReferrer}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowReferrerModal(false)}
                                className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-2xl transition-all"
                            >
                                <FaTimes />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                            {referrerVisitorsLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                     <UrbanSetuSpinner size="lg" />
                                     <p className="text-gray-500 font-bold animate-pulse">Analyzing Referrer Data...</p>
                                 </div>
                            ) : referrerVisitors.length === 0 ? (
                                <div className="text-center py-20">
                                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <FaSearch className="text-3xl text-gray-300" />
                                    </div>
                                    <p className="text-gray-500 font-bold">No detailed visitor logs found for this source</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Stats Summary In Modal */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Visits</p>
                                            <p className="text-xl font-black text-gray-900 dark:text-white">{totalReferrerVisitors}</p>
                                        </div>
                                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Source Type</p>
                                            <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                                                {drillDownType === 'campaign' ? 'Campaign' :
                                                    (selectedReferrer?.includes('google') ? 'Search' :
                                                        (selectedReferrer?.includes('facebook') || selectedReferrer?.includes('t.co') ? 'Social' : 'Referral'))
                                                }
                                            </p>
                                        </div>
                                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Data Freshness</p>
                                            <p className="text-xl font-black text-green-600 dark:text-green-400">Live</p>
                                        </div>
                                    </div>

                                    {/* Visitors Table */}
                                    <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-gray-50 dark:bg-gray-900/50 text-left">
                                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Visitor / IP</th>
                                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Device & OS</th>
                                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Location</th>
                                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Duration</th>
                                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                                                {referrerVisitors.map((v, i) => (
                                                    <tr key={v._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors group"
                                                        style={{ animation: `fadeIn 0.2s ease-out ${i * 0.03}s backwards` }}
                                                    >
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-gray-800 dark:text-gray-200 font-mono text-xs">{v.ip}</span>
                                                                <span className="text-[10px] text-gray-400">{new Date(v.timestamp).toLocaleString()}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-500">
                                                                    {v.deviceType === 'mobile' ? <FaGlobe title="Mobile" /> : <FaGlobe title="Desktop" />}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{v.browser}</span>
                                                                    <span className="text-[10px] text-gray-500">{v.os}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-400">
                                                                <FaMapMarkerAlt className="text-red-500" />
                                                                {v.location || 'Unknown'}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-[10px] font-black font-mono">
                                                                {v.sessionStart && v.lastActive ?
                                                                    formatDuration(new Date(v.lastActive) - new Date(v.sessionStart)) :
                                                                    '0s'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button
                                                                onClick={() => handleViewVisitorDetails(v)}
                                                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                                                            >
                                                                <FaEye /> View
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Modal Pagination */}
                                    {referrerTotalPages > 1 && (
                                        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                                Showing page <span className="font-bold text-gray-900 dark:text-white">{referrerPage}</span> of <span className="font-bold dark:text-gray-300">{referrerTotalPages}</span>
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setReferrerPage(prev => Math.max(1, prev - 1))}
                                                    disabled={referrerPage === 1}
                                                    className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                                                >
                                                    <FaArrowLeft size={12} /> Previous
                                                </button>
                                                <button
                                                    onClick={() => setReferrerPage(prev => Math.min(referrerTotalPages, prev + 1))}
                                                    disabled={referrerPage === referrerTotalPages}
                                                    className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                                                >
                                                    Next <FaArrowRight size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer Removed */}
                    </div>
                </div>
            )}

            {/* Individual Visitor Details Modal */}
            {showVisitorDetailsModal && selectedVisitor && (
                <VisitorDetailsModal
                    visitor={selectedVisitor}
                    onClose={() => setShowVisitorDetailsModal(false)}
                    onRefresh={handleRefreshVisitorDetails}
                    isRefreshing={isRefreshingVisitor}
                />
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .staggered-item { opacity: 0; }
            `}</style>
        </div>
    );
};

const KPICard = ({ title, value, subtitle, icon, color }) => {
    const colorClasses = {
        blue: 'from-blue-500/10 to-blue-500/5 text-blue-600 hover:border-blue-200 shadow-blue-500/5',
        purple: 'from-purple-500/10 to-purple-500/5 text-purple-600 hover:border-purple-200 shadow-purple-500/5',
        pink: 'from-pink-500/10 to-pink-500/5 text-pink-600 hover:border-pink-200 shadow-pink-500/5',
        indigo: 'from-indigo-500/10 to-indigo-500/5 text-indigo-600 hover:border-indigo-200 shadow-indigo-500/5'
    };

    return (
        <div className={`bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-gray-800 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 ${colorClasses[color]}`}>
            <div className="flex items-center gap-4 mb-3">
                <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm text-xl">
                    {icon}
                </div>
                <h4 className="text-gray-500 dark:text-gray-400 text-xs font-black uppercase tracking-widest">{title}</h4>
            </div>
            <div className="space-y-1">
                <div className="text-2xl font-black text-gray-900 dark:text-white truncate" title={value}>
                    {value}
                </div>
                <div className="text-xs font-medium text-gray-400 uppercase tracking-tighter">
                    {subtitle}
                </div>
            </div>
        </div>
    );
};

export default AdminSponsorIntelligence;
