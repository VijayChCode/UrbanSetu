import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FaTrophy, FaCoins, FaShareAlt, FaHandshake, FaAward, FaArrowRight, FaInfoCircle, FaCrown, FaUserShield } from "react-icons/fa";
import { usePageTitle } from "../hooks/usePageTitle";
import CommunityLeaderboard from "../components/SetuCoins/CommunityLeaderboard";
import SetuCoinInfoModal from "../components/SetuCoins/SetuCoinInfoModal";
import { useSelector } from "react-redux";

export default function Leaderboard({ isAdmin = false }) {
    usePageTitle(isAdmin ? "Admin - Community Leaderboard" : "Community Leaderboard - Top Earners");
    const { currentUser } = useSelector((state) => state.user);

    // Dynamic routing path prefix
    const linkPrefix = currentUser ? "/user" : "";
    const [showCoinInfo, setShowCoinInfo] = useState(false);

    return (
        <div className="bg-gradient-to-br from-slate-50 via-indigo-50/40 to-purple-50 dark:from-gray-950 dark:via-slate-900 dark:to-gray-950 min-h-screen py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300 relative overflow-hidden">
            
            {/* Background Blob Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-300/20 dark:bg-indigo-900/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse"></div>
                <div className="absolute top-[30%] right-[-10%] w-[500px] h-[500px] bg-purple-300/20 dark:bg-purple-900/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70" style={{ animationDuration: '8s' }}></div>
            </div>

            <div className="max-w-4xl mx-auto relative z-10 space-y-12">
                
                {/* Hero Showcase Card */}
                <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-900 via-indigo-950 to-purple-950 text-white p-8 md:p-12 shadow-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12">
                    {/* Decorative overlay */}
                    <div className="absolute inset-0 bg-white/[0.02] pointer-events-none"></div>
                    
                    {/* Left: Content */}
                    <div className="space-y-6 max-w-md text-left">
                        <div className="flex items-center gap-3">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold uppercase tracking-wider animate-pulse">
                                🏆 SetuCoins Arena
                            </div>
                            <button
                                onClick={() => setShowCoinInfo(true)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-indigo-200 hover:text-white transition-all duration-200 hover:scale-110"
                                title="What are SetuCoins?"
                            >
                                <FaInfoCircle className="text-sm" />
                            </button>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none">
                            Community <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 drop-shadow-sm">
                                Leaderboard
                            </span>
                        </h1>
                        <p className="text-indigo-200/90 text-sm leading-relaxed font-medium">
                            {isAdmin 
                                ? "Monitor and manage the active SetuCoins standings. Track user engagement, verify transaction logs, and reward community builders across India."
                                : "See who's leading the SetuCoins race! Earn coins by referring properties, completing profile verification, and maintaining your rental streak to climb the ranks."
                            }
                        </p>
                        
                        {/* Motivational Stats / Info badge */}
                        <div className="flex flex-wrap gap-4 pt-2">
                            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/15">
                                <FaCoins className="text-yellow-400 text-lg" />
                                <div className="text-xs">
                                    <p className="font-bold text-white">Monthly Reset</p>
                                    <p className="text-indigo-300 font-medium text-[10px]">Rankings refresh every 30 days</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/15">
                                <FaTrophy className="text-amber-400 text-lg" />
                                <div className="text-xs">
                                    <p className="font-bold text-white">Exclusive Badges</p>
                                    <p className="text-indigo-300 font-medium text-[10px]">Unlock premium profile badges</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: GIF Animation Frame */}
                    <div className="relative w-full max-w-[200px] md:max-w-[240px] aspect-square flex-shrink-0">
                        {/* Glowing backdrop halo */}
                        <div className="absolute inset-0 bg-yellow-500/20 rounded-full filter blur-3xl opacity-70 animate-pulse"></div>
                        
                        <div className="relative w-full h-full rounded-[2rem] overflow-hidden border border-white/20 shadow-2xl bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4 hover:scale-[1.03] transition-transform duration-500 group">
                            {/* Shiny border effect */}
                            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            
                            <img 
                                src="/assets/images/Leaderboard.gif" 
                                alt="Leaderboard Animation" 
                                className="w-full h-full object-contain rounded-2xl"
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = "https://cdn.pixabay.com/photo/2016/11/30/18/16/gold-1873539_1280.png";
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* SetuCoin Info Modal */}
                <SetuCoinInfoModal
                    isOpen={showCoinInfo}
                    onClose={() => setShowCoinInfo(false)}
                />

                {/* How to Earn SetuCoins Grid (Regular User Context Only) */}
                {!isAdmin && (
                    <div className="space-y-6">
                        <div className="text-left">
                            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2.5">
                                <span className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl shadow-lg">
                                    <FaCoins className="text-sm" />
                                </span>
                                How to Earn SetuCoins
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Perform activities on the platform to accumulate coins and climb the rankings.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Card 1 */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-slate-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1">
                                <div className="space-y-4">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                        <FaShareAlt />
                                    </div>
                                    <h3 className="font-extrabold text-lg text-gray-800 dark:text-white">Invite Friends</h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">
                                        Share your unique referral code. Get <strong className="text-indigo-600 dark:text-indigo-400">100 SetuCoins</strong> immediately when they verify their email.
                                    </p>
                                </div>
                                <Link 
                                    to={`${linkPrefix}/rewards?tab=referrals`} 
                                    className="mt-6 inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-wider hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors group/link"
                                >
                                    Get Referral Code <FaArrowRight className="group-hover/link:translate-x-1 transition-transform" />
                                </Link>
                            </div>

                            {/* Card 2 */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-slate-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1">
                                <div className="space-y-4">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                                        <FaHandshake />
                                    </div>
                                    <h3 className="font-extrabold text-lg text-gray-800 dark:text-white">List Properties</h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">
                                        Create high-quality verified rental listings. Earn up to <strong className="text-emerald-600 dark:text-emerald-400">1000 SetuCoins</strong> for verified listings.
                                    </p>
                                </div>
                                <Link 
                                    to={`${linkPrefix}/create-listing`} 
                                    className="mt-6 inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-wider hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors group/link"
                                >
                                    List Property <FaArrowRight className="group-hover/link:translate-x-1 transition-transform" />
                                </Link>
                            </div>

                            {/* Card 3 */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-slate-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1">
                                <div className="space-y-4">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl group-hover:bg-amber-600 group-hover:text-white transition-all duration-300">
                                        <FaAward />
                                    </div>
                                    <h3 className="font-extrabold text-lg text-gray-800 dark:text-white">Complete Streak</h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">
                                        Pay rent consecutively on the platform to maintain a month-on-month streak and score bonus multipliers.
                                    </p>
                                </div>
                                <Link 
                                    to={`${linkPrefix}/profile`} 
                                    className="mt-6 inline-flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-black uppercase tracking-wider hover:text-amber-700 dark:hover:text-amber-300 transition-colors group/link"
                                >
                                    Verify Profile <FaArrowRight className="group-hover/link:translate-x-1 transition-transform" />
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Leaderboard Table Container */}
                <div className="space-y-6">
                    {isAdmin && (
                        <div className="flex items-center gap-2.5 px-4 py-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 rounded-2xl text-xs font-bold text-indigo-700 dark:text-indigo-400">
                            <FaUserShield className="text-lg flex-shrink-0" />
                            <span><strong>Admin View Active:</strong> You are viewing the expanded global ranking list. Manage coin balances and audit transaction entries directly from users' profile summaries.</span>
                        </div>
                    )}
                    
                    <CommunityLeaderboard
                        limit={10}
                        showHeader={true}
                        showYourStatus={!isAdmin}
                        isAdmin={isAdmin}
                    />
                </div>

                {/* Footer Tip */}
                {!isAdmin && (
                    <div className="text-center pt-4">
                        <p className="text-slate-400 dark:text-gray-500 text-sm font-medium">
                            Want to see your name in the Hall of Fame? 
                            <Link to={`${linkPrefix}/rewards`} className="text-indigo-600 dark:text-indigo-400 hover:underline ml-1.5 font-bold inline-flex items-center gap-1">
                                Earn more SetuCoins <FaArrowRight className="inline text-[10px] ml-0.5" />
                            </Link>
                        </p>
                    </div>
                )}

            </div>
        </div>
    );
}
