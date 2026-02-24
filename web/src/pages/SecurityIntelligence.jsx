import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    FaShieldAlt, FaMobileAlt, FaUsers, FaExclamationTriangle, FaSearch,
    FaSync, FaInfoCircle, FaCheckCircle, FaChevronRight, FaFilter, FaDesktop
} from 'react-icons/fa';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { authenticatedFetch } from '../utils/auth';
import { usePageTitle } from '../hooks/usePageTitle';

const SecurityIntelligence = () => {
    usePageTitle("Security Intelligence - UrbanSetu Admin");
    const { currentUser } = useSelector((state) => state.user);
    const navigate = useNavigate();

    const [stats, setStats] = useState([]);
    const [summary, setSummary] = useState({ totalInstallations: 0, multiUserInstallations: 0 });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all'); // all, suspicious
    const [lastUpdated, setLastUpdated] = useState(null);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/security-intelligence/stats`);
            const data = await res.json();
            if (data.success) {
                setStats(data.stats);
                setSummary(data.summary);
                setLastUpdated(new Date());
            } else {
                toast.error(data.message || 'Failed to fetch security stats');
            }
        } catch (error) {
            console.error('Error fetching security stats:', error);
            toast.error('Failed to fetch security stats');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const filteredStats = stats.filter(s => {
        const matchesSearch = s.installationId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.users.some(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.email.toLowerCase().includes(searchTerm.toLowerCase()));

        if (filter === 'suspicious') {
            return matchesSearch && s.userCount > 1;
        }
        return matchesSearch;
    });

    const chartData = [
        { name: 'Single User', value: summary.totalInstallations - summary.multiUserInstallations, color: '#10B981' },
        { name: 'Multi-User', value: summary.multiUserInstallations, color: '#EF4444' }
    ];

    const COLORS = ['#10B981', '#EF4444'];

    if (loading && stats.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400 animate-pulse">Analyzing security data...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4 md:px-8 transition-colors duration-300">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                            <FaShieldAlt className="text-blue-600" />
                            Security Intelligence
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">Monitoring and analysis of app installations and device security.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            Last active: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
                        </span>
                        <button
                            onClick={fetchStats}
                            className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-md hover:shadow-lg transition-all text-blue-600 dark:text-blue-400 group"
                            title="Refresh Data"
                        >
                            <FaSync className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-premium border border-gray-100 dark:border-gray-700 flex items-center gap-5 group hover:scale-[1.02] transition-all">
                        <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                            <FaMobileAlt className="text-2xl" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Valid Devices</p>
                            <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{summary.totalInstallations}</h3>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-premium border border-gray-100 dark:border-gray-700 flex items-center gap-5 group hover:scale-[1.02] transition-all">
                        <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-2xl text-red-600 dark:text-red-400 group-hover:bg-red-600 group-hover:text-white transition-colors duration-300">
                            <FaExclamationTriangle className="text-2xl" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Multi-User Devices</p>
                            <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{summary.multiUserInstallations}</h3>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-premium border border-gray-100 dark:border-gray-700 flex items-center gap-5 group hover:scale-[1.02] transition-all">
                        <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-2xl text-green-600 dark:text-green-400 group-hover:bg-green-600 group-hover:text-white transition-colors duration-300">
                            <FaUsers className="text-2xl" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Unique Users Tracked</p>
                            <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{stats.reduce((acc, curr) => acc + curr.userCount, 0)}</h3>
                        </div>
                    </div>
                </div>

                {/* Analytics Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-premium border border-gray-100 dark:border-gray-700">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                            <FaInfoCircle className="text-blue-500" />
                            Device Usage Integrity
                        </h2>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center italic">
                            Analysis of installation IDs associated with one or more user accounts.
                        </p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-premium border border-gray-100 dark:border-gray-700">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                            Activity Intensity
                        </h2>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.slice(0, 10)}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis
                                        dataKey="installationId"
                                        hide={true}
                                    />
                                    <YAxis tick={{ fill: '#9CA3AF' }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1F2937', color: '#fff', borderRadius: '12px', border: 'none' }}
                                        labelStyle={{ display: 'none' }}
                                    />
                                    <Bar dataKey="userCount" name="Users/Device" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center italic">
                            Top 10 devices by user association count.
                        </p>
                    </div>
                </div>

                {/* Detailed Table Section */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-premium border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 dark:border-gray-700 gap-4">
                        <div className="relative flex-1">
                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by ID, Username, Email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filter === 'all' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                            >
                                All Devices
                            </button>
                            <button
                                onClick={() => setFilter('suspicious')}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filter === 'suspicious' ? 'bg-red-600 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                            >
                                Suspicious
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/50 dark:bg-gray-900/30 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-widest font-bold">
                                    <th className="px-8 py-5">Installation ID</th>
                                    <th className="px-8 py-5">Devices Used</th>
                                    <th className="px-8 py-5">Assoc. Users</th>
                                    <th className="px-8 py-5">Last Active</th>
                                    <th className="px-8 py-5">Status</th>
                                    <th className="px-8 py-5 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredStats.length > 0 ? filteredStats.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/10 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="font-mono text-sm text-gray-700 dark:text-gray-200 font-semibold">{item.installationId}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-wrap gap-1">
                                                {item.devices.map((d, i) => (
                                                    <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-[10px] font-bold">
                                                        {d}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex -space-x-3 overflow-hidden">
                                                {item.users.slice(0, 3).map((u, i) => (
                                                    <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[10px] text-white font-bold" title={u.username}>
                                                        {u.username.substring(0, 1).toUpperCase()}
                                                    </div>
                                                ))}
                                                {item.userCount > 3 && (
                                                    <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] text-gray-500 dark:text-gray-400 font-bold">
                                                        +{item.userCount - 3}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-sm text-gray-600 dark:text-gray-400">
                                            {new Date(item.lastUsed).toLocaleDateString()}
                                        </td>
                                        <td className="px-8 py-6">
                                            {item.userCount > 1 ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                    Suspicious
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                    Clean
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <button
                                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-all"
                                                title="View Detail"
                                            >
                                                <FaChevronRight />
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="6" className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                                                    <FaSearch className="text-3xl text-gray-300" />
                                                </div>
                                                <p className="text-gray-500 dark:text-gray-400 font-medium text-lg">No security patterns matching your search.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Legend/Info Section */}
                <div className="mt-10 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 p-6 rounded-3xl flex gap-4">
                    <FaInfoCircle className="text-blue-600 dark:text-blue-400 text-xl flex-shrink-0 mt-1" />
                    <div className="text-sm text-blue-800 dark:text-blue-300 space-y-2">
                        <p className="font-bold">Security Analysis Framework:</p>
                        <p>Our system uses unique installation IDs to prevent account sharing and detect suspicious activity. Devices with multiple users are flagged for review. Installation IDs are privacy-respecting alternatives to hardware MAC addresses.</p>
                    </div>
                </div>
            </div>

            <style>{`
                .shadow-premium {
                    box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.05), 0 4px 10px -5px rgba(0, 0, 0, 0.02);
                }
                .dark .shadow-premium {
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
                }
            `}</style>
        </div>
    );
};

export default SecurityIntelligence;
