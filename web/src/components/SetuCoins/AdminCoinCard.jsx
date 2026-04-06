import React, { useState, useEffect } from 'react';
import { FaCoins, FaUsers, FaChartLine, FaArrowTrendUp, FaGear, FaTrophy } from 'react-icons/fa6';
import { Link } from 'react-router-dom';
import { authenticatedFetch } from '../../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const AdminCoinCard = ({ loading: parentLoading }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await authenticatedFetch(`${API_BASE_URL}/api/coins/admin/stats`);
                const data = await res.json();
                if (data.success) {
                    setStats(data.stats);
                }
            } catch (error) {
                console.error("Error fetching admin coin stats:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading || parentLoading) {
        return (
            <div className="w-full min-h-[220px] rounded-2xl bg-white/50 dark:bg-gray-800/50 border border-indigo-100 dark:border-gray-700 shadow-lg overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-50/50 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                <div className="p-6 space-y-8">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                            <div className="space-y-2">
                                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                <div className="h-2 w-24 bg-gray-100 dark:bg-gray-600 rounded-lg"></div>
                            </div>
                        </div>
                        <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <div className="h-2 w-24 bg-gray-100 dark:bg-gray-600 rounded-lg"></div>
                            <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                        </div>
                        <div className="space-y-3 flex flex-col items-end">
                            <div className="h-2 w-24 bg-gray-100 dark:bg-gray-600 rounded-lg"></div>
                            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const circulatingSupply = stats?.circulatingSupply || 0;
    const holdersCount = stats?.holdersCount || 0;
    const burnRate = stats?.totalMintedLifetime > 0
        ? ((stats.totalBurned / stats.totalMintedLifetime) * 100).toFixed(1)
        : 0;

    return (
        <div className="relative w-full overflow-hidden rounded-2xl shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.01] bg-gradient-to-br from-indigo-600 via-purple-700 to-indigo-900 border border-white/10">
            {/* Background patterns */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>

            {/* Icon Overlay */}
            <FaChartLine className="absolute -bottom-6 -right-6 text-9xl text-white/5 rotate-12" />

            <div className="relative p-6 text-white">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md border border-white/20">
                                <FaCoins className="text-yellow-400 text-xl" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black tracking-tight text-white uppercase flex items-center gap-2">
                                    SetuCoins Economy
                                </h3>
                                <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-[0.2em] mt-0.5">Platform Loyalty Portfolio</p>
                            </div>
                        </div>
                    </div>

                    {/* Leaderboard Management & Holders Badge */}
                    <div className="flex items-center gap-2 shrink-0">
                        <Link
                            to="/admin/leaderboard"
                            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm px-4 py-2 rounded-2xl border border-white/10 shadow-lg transition-all"
                            title="Global Leaderboard Management"
                        >
                            <FaTrophy className="text-yellow-400 text-sm" />
                            <span className="text-xs font-black text-white uppercase tracking-wider">Leaderboard</span>
                        </Link>

                        <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-2xl border border-white/10 shadow-lg" title="Total Active Holders">
                            <FaUsers className="text-indigo-300" />
                            <span className="font-black text-sm tabular-nums">{holdersCount.toLocaleString()} <span className="text-[10px] text-indigo-300 uppercase ml-0.5">Holders</span></span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
                    <div>
                        <p className="text-[10px] uppercase font-black text-indigo-300 tracking-widest mb-1">Circulating Supply</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black tracking-tighter drop-shadow-md">
                                {circulatingSupply.toLocaleString()}
                            </span>
                            <span className="text-sm font-bold text-indigo-200">Coins</span>
                        </div>
                        <div className="mt-3 inline-flex items-center gap-2 bg-green-500/20 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-black text-green-300 border border-green-500/30">
                            <FaArrowTrendUp className="text-[10px]" />
                            <span>System Healthy</span>
                        </div>
                    </div>

                    <div className="flex flex-col justify-end md:items-end">
                        <p className="text-[10px] uppercase font-black text-indigo-300 tracking-widest mb-1">Redemption Burn Rate</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black tracking-tighter drop-shadow-md">
                                {burnRate}%
                            </span>
                        </div>
                        <div className="mt-3 w-full md:w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-400 to-purple-400"
                                style={{ width: `${burnRate}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                    <Link
                        to="/admin/setu-coins"
                        className="flex-1 flex items-center justify-center gap-2 bg-white text-indigo-900 px-6 py-3 rounded-2xl font-black shadow-xl hover:bg-gray-50 active:scale-95 transition-all text-sm group"
                    >
                        <FaChartLine className="text-indigo-600 group-hover:scale-110 transition-transform" />
                        <span>View Analytics</span>
                    </Link>

                    <Link
                        to="/admin/services"
                        className="flex-1 flex items-center justify-center gap-2 bg-white/10 text-white px-6 py-3 rounded-2xl font-black border border-white/20 hover:bg-white/20 active:scale-95 transition-all backdrop-blur-sm text-sm group"
                    >
                        <FaGear className="text-indigo-300 group-hover:rotate-90 transition-transform" />
                        <span>Manage Services</span>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default AdminCoinCard;
