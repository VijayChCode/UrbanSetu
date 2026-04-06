import React, { useState } from 'react';
import { FaCoins, FaFire, FaHistory, FaGift, FaQuestionCircle, FaInfoCircle, FaMedal, FaTrophy, FaChartLine } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import SetuCoinInfoModal from './SetuCoinInfoModal';
import { getCoinValue, COIN_CONFIG } from '../../utils/coinUtils';

const SetuCoinCard = ({ balance = 0, streak = 0, expiryDate = null, rank = null, loading = false, onViewHistory }) => {
    const [showInfo, setShowInfo] = useState(false);

    const inrValue = getCoinValue(balance, 'INR').toFixed(2);
    const usdValue = getCoinValue(balance, 'USD').toFixed(2);

    // Gradient background based on balance tier (gamification visual)
    const getGradient = () => {
        if (balance > 1000) return 'from-yellow-400 via-amber-500 to-yellow-600'; // Gold
        if (balance > 500) return 'from-gray-300 via-gray-400 to-gray-500'; // Silver
        return 'from-orange-300 via-orange-400 to-orange-500'; // Bronze
    };

    if (loading) {
        return (
            <div className="w-full min-h-[180px] rounded-2xl bg-white/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 shadow-lg overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-gray-600/40 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                <div className="p-6 space-y-6">
                    <div className="flex justify-between items-start">
                        <div className="space-y-2">
                            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                            <div className="h-3 w-24 bg-gray-100 dark:bg-gray-600 rounded-lg"></div>
                        </div>
                        <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                    </div>
                    <div className="space-y-3">
                        <div className="h-10 w-40 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                        <div className="h-6 w-28 bg-gray-100 dark:bg-gray-600 rounded-lg"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`relative w-full overflow-hidden rounded-2xl shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] bg-gradient-to-br ${getGradient()}`}>
            {/* Background patterns */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl"></div>

            {/* Coin Icon Background Overlay */}
            <FaCoins className="absolute -bottom-8 -right-8 text-9xl text-white/10 rotate-12" />

            <div className="relative p-6 text-white">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold tracking-wide text-white/90 uppercase flex items-center gap-2">
                                <FaCoins className="text-yellow-200" />
                                SetuCoins Balance
                            </h3>
                            <button
                                onClick={() => setShowInfo(true)}
                                className="text-white/60 hover:text-white transition-colors cursor-pointer"
                                title="What are SetuCoins?"
                            >
                                <FaInfoCircle size={16} />
                            </button>
                        </div>
                        <p className="text-xs text-white/70 mt-1">Loyalty Rewards Program</p>
                    </div>

                    {/* Rank & Streak Badges */}
                    <div className="flex flex-col items-end gap-2">
                        {/* Rank Badge */}
                        <Link 
                            to="/user/leaderboard"
                            className="group flex items-center gap-1 bg-white/10 hover:bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10 shadow-sm transition-all"
                            title={rank ? `Your Global Rank: #${rank}` : 'View Leaderboard'}
                        >
                            {rank && rank <= 10 ? (
                                <div className="relative flex items-center justify-center">
                                    <FaMedal className={`text-xl ${rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-600' : 'text-blue-200'}`} />
                                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-gray-900 mt-0.5">{rank}</span>
                                </div>
                            ) : (
                                <FaTrophy className={`text-sm ${rank ? 'text-yellow-200' : 'text-white/60'}`} />
                            )}
                            <span className="font-bold text-xs text-white shrink-0">
                                {rank ? `#${rank}` : 'Top Up'}
                            </span>
                        </Link>

                        <div className="flex items-center gap-1 bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10 shadow-sm" title="Current Rent Streak">
                            <FaFire className={`text-orange-400 ${streak > 0 ? 'animate-pulse' : ''}`} />
                            <span className="font-bold text-sm text-white shrink-0">{streak} Month Streak</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-end justify-between mt-2">
                    <div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-5xl font-extrabold tracking-tight drop-shadow-sm">
                                {balance.toLocaleString()}
                            </span>
                            <span className="text-lg font-medium text-white/80">Coins</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-semibold border border-white/10">
                                <span>≈ ₹{inrValue}</span>
                            </div>
                            <div className="inline-flex items-center gap-1.5 bg-black/10 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-semibold border border-white/5">
                                <span>≈ ${usdValue}</span>
                            </div>
                        </div>
                        {expiryDate && balance > 0 && (
                            <div className="mt-2 text-xs text-white/70 font-medium bg-black/10 inline-block px-2 py-1 rounded-md">
                                Expires on: <span className="font-bold text-white">{new Date(expiryDate).toLocaleDateString()}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={onViewHistory}
                        className="flex-1 flex items-center justify-center gap-2 bg-white/90 dark:bg-gray-800/90 text-gray-800 dark:text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg hover:bg-white dark:hover:bg-gray-800 active:scale-95 transition-all group"
                    >
                        <FaHistory className="text-blue-500 group-hover:rotate-12 transition-transform" />
                        <span>History</span>
                    </button>

                    <Link
                        to="/user/rewards?tab=rewards"
                        className="flex-1 flex items-center justify-center gap-2 bg-black/20 text-white px-4 py-2.5 rounded-xl font-semibold border border-white/20 hover:bg-black/30 active:scale-95 transition-all backdrop-blur-sm group"
                    >
                        <FaGift className="text-pink-300 group-hover:-translate-y-1 transition-transform" />
                        <span>Redeem</span>
                    </Link>
                </div>
            </div>

            {/* Info Modal Overlay */}
            <SetuCoinInfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} headerClass={getGradient()} />
        </div >
    );
};

export default SetuCoinCard;
