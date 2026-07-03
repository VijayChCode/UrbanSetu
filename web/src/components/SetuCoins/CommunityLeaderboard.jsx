import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaCoins, FaTrophy, FaFire, FaCrown, FaMedal, FaStar, FaInfoCircle, FaEllipsisH, FaChevronLeft, FaChevronRight, FaAngleDoubleLeft, FaAngleDoubleRight } from 'react-icons/fa';
import { useSelector } from 'react-redux';
import { authenticatedFetch } from '../../utils/auth';
import LeaderboardSkeleton from '../skeletons/LeaderboardSkeleton';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const CommunityLeaderboard = ({ limit = 10, showHeader = true, showYourStatus = false, isAdmin = false }) => {
    const { currentUser } = useSelector((state) => state.user);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [userRank, setUserRank] = useState(null);
    const [currentUserEntry, setCurrentUserEntry] = useState(null);
    const [freshBalance, setFreshBalance] = useState(null);

    // Pagination state for admin pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);

    useEffect(() => {
        setPage(1);
    }, [limit]);

    useEffect(() => {
        const isInitial = leaderboard.length === 0;
        fetchLeaderboard(page, isInitial);
        if (showYourStatus && currentUser) {
            fetchFreshBalance();
        }
    }, [page, limit]);

    const fetchLeaderboard = async (currentPage = 1, isInitial = false) => {
        try {
            if (isInitial) {
                setInitialLoading(true);
            } else {
                setLoading(true);
            }
            const res = await authenticatedFetch(`${API_BASE_URL}/api/coins/leaderboard?limit=${limit}&page=${currentPage}`);
            const data = await res.json();
            if (data.success) {
                setLeaderboard(data.leaderboard);
                if (data.pagination) {
                    setTotalPages(data.pagination.totalPages || 1);
                    setTotalUsers(data.pagination.totalUsers || 0);
                }

                if (currentUser) {
                    const myRank = data.leaderboard.find(u => u.userId === currentUser._id);
                    if (myRank) setUserRank(myRank);
                }

                // If the API returned a currentUserEntry (user is NOT in the top N)
                if (data.currentUserEntry) {
                    setCurrentUserEntry(data.currentUserEntry);
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setInitialLoading(false);
            setLoading(false);
        }
    };

    // Fetch fresh coin balance for the "Your Status" card instead of relying on stale Redux data
    const fetchFreshBalance = async () => {
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/coins/balance`);
            const data = await res.json();
            if (data.success) {
                setFreshBalance({
                    totalCoinsEarned: data.totalCoinsEarned || 0,
                    rank: data.rank || null
                });
            }
        } catch (error) {
            console.error("Error fetching fresh balance for leaderboard:", error);
        }
    };

    // Determine the total earned to show in "Your Status"
    const displayTotalEarned = freshBalance?.totalCoinsEarned ?? currentUser?.gamification?.totalCoinsEarned ?? 0;
    const displayRank = userRank?.rank || freshBalance?.rank || null;

    const getRankStyle = (rank) => {
        switch (rank) {
            case 1: return "bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-100 dark:from-yellow-900/20 dark:via-amber-900/20 dark:to-yellow-900/10 border-yellow-300 dark:border-yellow-700/50 shadow-yellow-200/40 dark:shadow-none transform scale-[1.02]";
            case 2: return "bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-800 dark:to-gray-900 border-slate-200 dark:border-slate-700";
            case 3: return "bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-700/50";
            default: return "bg-white dark:bg-gray-800 border-slate-100 dark:border-gray-700 hover:border-indigo-100 dark:hover:border-gray-600 hover:bg-slate-50/50 dark:hover:bg-gray-700/50";
        }
    };

    const getRankIcon = (rank) => {
        switch (rank) {
            case 1: return <FaCrown className="text-yellow-500 text-xl" />;
            case 2: return <FaMedal className="text-slate-400 text-lg" />;
            case 3: return <FaMedal className="text-orange-500 text-lg" />;
            default: return <span className="text-slate-400 font-bold text-sm">#{rank}</span>;
        }
    };

    // Render a single leaderboard row (reusable for both main list and appended user)
    const renderLeaderboardRow = (user, idx, isAppended = false) => (
        <div
            key={`${user.rank}-${isAppended ? 'appended' : 'main'}`}
            className={`flex items-center justify-between p-5 rounded-2xl transition-all duration-300 border ${getRankStyle(user.rank)} ${user.userId === currentUser?._id ? 'ring-2 ring-indigo-500 ring-offset-4 dark:ring-offset-gray-900' : ''}`}
        >
            <div className="flex items-center gap-4 sm:gap-6">
                <div className="w-8 flex justify-center">
                    {getRankIcon(user.rank)}
                </div>
                <div className="relative">
                    <img
                        src={user.avatar || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"}
                        className={`w-14 h-14 rounded-2xl object-cover shadow-md bg-slate-100 border-2 ${user.rank === 1 ? 'border-yellow-400' : 'border-white'}`}
                        alt={user.name}
                    />
                    {user.rank === 1 && (
                        <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-white rounded-lg p-1 shadow-lg">
                            <FaCrown size={10} />
                        </div>
                    )}
                </div>
                <div>
                    <p className={`font-black tracking-tight ${user.userId === currentUser?._id ? 'text-indigo-800 dark:text-indigo-400' : 'text-slate-800 dark:text-white'}`}>
                        {user.userId === currentUser?._id ? (currentUser.username?.length > 3 ? `${currentUser.username.substring(0, 3)}***` : `${currentUser.username}***`) : user.name} {user.userId === currentUser?._id && <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] px-2 py-0.5 rounded-full ml-1">YOU</span>}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-300 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/50 px-2 py-0.5 rounded-md uppercase tracking-tighter">
                            <FaFire className="text-orange-500" /> {user.streak} Month Streak
                        </span>
                        {isAdmin && (
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest border border-slate-200 dark:border-gray-700 px-2 py-0.5 rounded-md">
                                ID: {user.userId.toString().slice(-6)}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-6">
                <div className="text-right">
                    <p className="font-black text-slate-800 dark:text-white text-xl flex items-center justify-end gap-1.5 tabular-nums">
                        {user.totalCoins.toLocaleString()}
                        <FaCoins className="text-yellow-500 text-sm" />
                    </p>
                    <span className="text-[10px] uppercase font-black text-slate-300 tracking-[0.1em]">Total Earned</span>
                </div>
                {isAdmin && (
                    <div className="hidden sm:block">
                        <Link 
                            to={`/admin/setu-coins?search=${encodeURIComponent(user.fullName || user.name)}`}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95 block"
                            title="Manage user coins"
                        >
                            <FaCoins />
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );

    if (initialLoading) {
        return <LeaderboardSkeleton showYourStatus={showYourStatus} />;
    }

    return (
        <div className="space-y-6">
            {/* Your Status Card (Optional) */}
            {showYourStatus && currentUser && (
                <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-xl p-6 border-l-8 border-indigo-600 flex flex-col md:flex-row items-center justify-between gap-6 transform transition hover:scale-[1.01]">
                    <div className="flex items-center gap-5">
                        <div className="relative">
                            <img
                                src={currentUser.avatar}
                                alt="Profile"
                                className="w-20 h-20 rounded-2xl border-4 border-indigo-50 object-cover shadow-lg"
                            />
                            {displayRank === 1 && <FaCrown className="absolute -top-3 -right-2 text-yellow-500 text-xl animate-bounce" />}
                        </div>
                        <div>
                            <h3 className="font-black text-slate-800 dark:text-white text-xl flex items-center gap-2">
                                <span>{currentUser.username?.length > 3 ? `${currentUser.username.substring(0, 3)}***` : `${currentUser.username}***`}</span>
                                <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">YOU</span>
                            </h3>
                            {displayRank ? (
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-black shadow-lg shadow-indigo-200">
                                        Rank #{displayRank}
                                    </span>
                                    <span className="text-slate-500 text-sm font-medium">
                                        {displayRank <= 10 ? 'Top Tier Finisher!' : 'Keep climbing!'}
                                    </span>
                                </div>
                            ) : (
                                <p className="text-slate-500 text-sm mt-1 flex items-center gap-1">
                                    <FaStar className="text-yellow-500" /> Keep earning to reach the top 10!
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="text-center md:text-right bg-slate-50 dark:bg-gray-700/50 px-6 py-4 rounded-3xl border border-slate-100 dark:border-gray-600 min-w-[180px]">
                        <p className="text-slate-400 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Total Earned</p>
                        <p className="text-3xl font-black text-indigo-900 dark:text-indigo-200 flex items-center justify-center md:justify-end gap-2">
                            {displayTotalEarned.toLocaleString()}
                            <FaCoins className="text-yellow-500 text-lg" />
                        </p>
                    </div>
                </div>
            )}

            {/* Leaderboard Main Container */}
            <div className={`bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden ${isAdmin ? 'border-indigo-200 dark:border-indigo-900/50 shadow-indigo-100/50' : ''}`}>
                {showHeader && (
                    <div className={`p-8 ${isAdmin ? 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900' : 'bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-950'} text-white flex justify-between items-center relative overflow-hidden`}>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                        <div className="relative z-10">
                            <h2 className="text-3xl font-black mb-1 flex items-center gap-3">
                                {isAdmin ? <FaCrown className="text-indigo-400" /> : <FaTrophy className="text-yellow-400" />}
                                {isAdmin ? 'Admin - Global Rankings' : 'Top Earners'}
                            </h2>
                            <p className="text-indigo-200 text-sm font-medium">
                                {isAdmin ? `Managing top ${leaderboard.length} earners across the platform.` : "See who's leading the UrbanSetu community."}
                            </p>
                        </div>
                        <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10 hidden sm:block">
                            <FaTrophy className={`text-5xl drop-shadow-lg ${isAdmin ? 'text-indigo-400' : 'text-yellow-400'}`} />
                        </div>
                    </div>
                )}

                <div className="p-4 sm:p-8 space-y-4 relative">
                    {/* Background Loading Blur Overlay */}
                    {loading && (
                        <div className="absolute inset-0 bg-white/60 dark:bg-gray-800/60 backdrop-blur-[2px] z-20 flex items-center justify-center rounded-[2rem] transition-all duration-300">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Loading standings...</span>
                            </div>
                        </div>
                    )}
                    {leaderboard.length === 0 ? (
                        <div className="text-center py-20">
                            <FaTrophy className="text-6xl text-slate-100 dark:text-gray-700 mx-auto mb-4" />
                            <p className="text-slate-400 dark:text-gray-400 font-bold text-lg">No champions yet.</p>
                            <p className="text-slate-300 dark:text-gray-500 text-sm">Be the first to climb the leaderboard!</p>
                        </div>
                    ) : (
                        <>
                            {leaderboard.map((user, idx) => renderLeaderboardRow(user, idx))}

                            {/* Appended current user entry if NOT in top N */}
                            {currentUserEntry && !isAdmin && (
                                <>
                                    {/* Separator */}
                                    <div className="flex items-center gap-3 py-2">
                                        <div className="flex-1 border-t-2 border-dashed border-slate-200 dark:border-gray-700"></div>
                                        <div className="flex items-center gap-2 text-slate-400 dark:text-gray-500">
                                            <FaEllipsisH className="text-xs" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Your Position</span>
                                            <FaEllipsisH className="text-xs" />
                                        </div>
                                        <div className="flex-1 border-t-2 border-dashed border-slate-200 dark:border-gray-700"></div>
                                    </div>

                                    {/* Current user's row with special highlight */}
                                    {renderLeaderboardRow({
                                        ...currentUserEntry,
                                        avatar: currentUser?.avatar || currentUserEntry.avatar
                                    }, leaderboard.length, true)}
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Pagination Controls (Only for Admin) */}
                {isAdmin && totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-8 py-5 border-t border-slate-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/30">
                        <p className="text-xs font-bold text-slate-500 dark:text-gray-400">
                            Showing <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{(page - 1) * limit + 1}</span> to{' '}
                            <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{Math.min(page * limit, totalUsers)}</span> of{' '}
                            <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{totalUsers}</span> users
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(1)}
                                disabled={page === 1}
                                className="p-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700/50 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-600 dark:disabled:hover:bg-gray-800 transition-all duration-200 shadow-sm"
                                title="First Page"
                            >
                                <FaAngleDoubleLeft />
                            </button>
                            <button
                                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                                disabled={page === 1}
                                className="p-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700/50 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-600 dark:disabled:hover:bg-gray-800 transition-all duration-200 shadow-sm"
                                title="Previous Page"
                            >
                                <FaChevronLeft />
                            </button>
                            <span className="px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs shadow-inner">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={page === totalPages}
                                className="p-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700/50 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-600 dark:disabled:hover:bg-gray-800 transition-all duration-200 shadow-sm"
                                title="Next Page"
                            >
                                <FaChevronRight />
                            </button>
                            <button
                                onClick={() => setPage(totalPages)}
                                disabled={page === totalPages}
                                className="p-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700/50 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-600 dark:disabled:hover:bg-gray-800 transition-all duration-200 shadow-sm"
                                title="Last Page"
                            >
                                <FaAngleDoubleRight />
                            </button>
                        </div>
                    </div>
                )}

                {leaderboard.length > 0 && (
                    <div className="bg-slate-50 dark:bg-gray-800/50 p-4 text-center border-t border-slate-100 dark:border-gray-700">
                        <p className="text-[11px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                            <FaInfoCircle className="text-indigo-300 dark:text-gray-600" /> 
                            <span>
                                <Link 
                                    to={isAdmin ? "/admin/leaderboard" : "/user/leaderboard"} 
                                    className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors underline decoration-dotted underline-offset-4 decoration-indigo-200 dark:decoration-indigo-900"
                                >
                                    Leaderboard
                                </Link> resets every month. Keep earning!
                            </span>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommunityLeaderboard;
