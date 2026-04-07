import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
    FaCoins, FaFire, FaHistory, FaGift, FaTrophy, FaArrowUp,
    FaArrowDown, FaRocket, FaStar, FaChevronRight, FaInfoCircle,
    FaCalendarAlt, FaCheckCircle, FaUserFriends, FaHome, FaBolt, FaShoppingBag, FaReceipt, FaCheck, FaLock
} from 'react-icons/fa';
import { usePageTitle } from '../hooks/usePageTitle';
import SetuCoinParticles from '../components/SetuCoins/SetuCoinParticles';
import SetuCoinInfoModal from '../components/SetuCoins/SetuCoinInfoModal';
import CommunityLeaderboard from '../components/SetuCoins/CommunityLeaderboard';
import SocialSharePanel from '../components/SocialSharePanel';
import { getCoinValue, COIN_CONFIG } from '../utils/coinUtils';
import RewardsSkeleton from '../components/skeletons/RewardsSkeleton';
import { authenticatedFetch } from '../utils/auth';
import { toast } from 'react-hot-toast';
import TransactionThemedIcon, { GET_TRANSACTION_THEME } from '../components/SetuCoins/TransactionThemedIcon';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const DID_YOU_KNOW_FACTS = [
    "Paying your rent on the exact due date for 3 consecutive months gives you a 'Speed Demon' bonus of 50 SetuCoins!",
    "You can redeem SetuCoins for real discounts on monthly rent or on-demand home services!",
    "Reaching a 6-month rent streak unlocks the 'Elite Resident' badge and a 200 coin bonus!",
    "Inviting a friend to UrbanSetu earns you 100 SetuCoins and your friend 50 SetuCoins once they join!",
    "SetuCoins never expire as long as you have one active property listing or rental contract!",
    "Top 3 leaderboard champions every month get exclusive UrbanSetu merchandise and premium support!",
    "Checking your property's maintenance checklist once a month earns you a 'Diligent Owner' bonus of 10 coins!"
];

export default function Rewards() {
    usePageTitle("SetuCoins Rewards - Loyalty Program");
    const { currentUser } = useSelector((state) => state.user);
    const location = useLocation();
    const navigate = useNavigate();

    const tabs = [
        { id: 'overview', label: 'Overview', icon: <FaRocket /> },
        { id: 'rewards', label: 'Redeem', icon: <FaGift /> },
        { id: 'activities', label: 'Earn More', icon: <FaStar /> },
        { id: 'referrals', label: 'Referrals', icon: <FaUserFriends /> },
        { id: 'history', label: 'History', icon: <FaHistory /> },
        { id: 'leaderboard', label: 'Leaderboard', icon: <FaTrophy /> },
    ];

    // TAB management
    const queryParams = new URLSearchParams(location.search);
    const tabParam = queryParams.get('tab');
    const [activeTab, setActiveTab] = useState(() => {
        return tabs.some(t => t.id === tabParam) ? tabParam : 'overview';
    });

    // Sync state with URL when it changes
    useEffect(() => {
        const currentTab = new URLSearchParams(location.search).get('tab');
        if (currentTab && tabs.some(t => t.id === currentTab)) {
            setActiveTab(currentTab);
        } else {
            setActiveTab('overview');
        }
    }, [location.search]);

    const isProfileComplete = currentUser && currentUser.gender && currentUser.address && currentUser.mobileNumber;

    const [coinData, setCoinData] = useState({ balance: 0, totalEarned: 0, streak: 0, expiryDate: null, frozenCoins: 0, badges: [], loading: true });
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [showCoinBurst, setShowCoinBurst] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [showReferral, setShowReferral] = useState(false);
    const [currentFact, setCurrentFact] = useState(DID_YOU_KNOW_FACTS[0]);
    const [activeContractId, setActiveContractId] = useState(null);
    const [referralStats, setReferralStats] = useState({ referralsCount: 0, totalEarned: 0, referredUsers: [], loading: true });
    const prevBadgesRef = useRef([]);

    useEffect(() => {
        // Pick a random fact on every mountain/visit
        const randomIdx = Math.floor(Math.random() * DID_YOU_KNOW_FACTS.length);
        setCurrentFact(DID_YOU_KNOW_FACTS[randomIdx]);
        fetchActiveContract();
    }, []);

    useEffect(() => {
        fetchUserInfo();
        fetchReferralStats();
        if (activeTab === 'history') fetchHistory();
    }, [activeTab]);

    useEffect(() => {
        // Celebrate new badges logic
        if (coinData.badges.length > prevBadgesRef.current.length) {
            const newBadges = coinData.badges.filter(b => !prevBadgesRef.current.includes(b));
            if (newBadges.length > 0) {
                setShowCoinBurst(true);
                newBadges.forEach(badge => {
                    toast.success(`🏆 Milestone Unlocked: ${badge}!`, {
                        duration: 6000,
                        icon: '🔥',
                        style: {
                            borderRadius: '1rem',
                            background: '#333',
                            color: '#fff',
                            fontWeight: 'bold'
                        }
                    });
                });
            }
        }
        prevBadgesRef.current = coinData.badges;
    }, [coinData.badges]);

    const fetchUserInfo = async () => {
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/coins/balance`);
            const data = await res.json();
            if (data.success) {
                setCoinData({
                    balance: data.setuCoinsBalance || 0,
                    totalEarned: data.totalCoinsEarned || 0,
                    streak: data.currentStreak || 0,
                    expiryDate: data.coinsExpiryDate || null,
                    frozenCoins: data.frozenCoins || 0,
                    badges: data.badges || [],
                    loading: false
                });
            }
        } catch (error) {
            console.error(error);
            setCoinData(prev => ({ ...prev, loading: false }));
        }
    };

    const fetchActiveContract = async () => {
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts`);
            const data = await res.json();
            if (data.success && data.contracts) {
                // Find first active contract where user is tenant
                const active = data.contracts.find(c =>
                    c.status === 'active' &&
                    (c.tenantId?._id === currentUser._id || c.tenantId === currentUser._id)
                );
                if (active) {
                    setActiveContractId(active.contractId || active._id);
                }
            }
        } catch (error) {
            console.error("Error fetching active contract:", error);
        }
    };

    const fetchHistory = async () => {
        try {
            setHistoryLoading(true);
            const res = await authenticatedFetch(`${API_BASE_URL}/api/coins/history?limit=50`);
            const data = await res.json();
            if (data.success) {
                setHistory(data.transactions);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setHistoryLoading(false);
        }
    };


    const fetchReferralStats = async () => {
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/coins/referral-stats`);
            const data = await res.json();
            if (data.success) {
                setReferralStats({
                    referralsCount: data.referralsCount || 0,
                    totalEarned: data.totalEarned || 0,
                    referredUsers: data.referredUsers || [],
                    loading: false
                });
            }
        } catch (error) {
            console.error(error);
            setReferralStats(prev => ({ ...prev, loading: false }));
        }
    };


    // Earn Activities (Static for now, but linked to features)
    const earnActivities = [
        { title: 'Pay Monthly Rent', coins: '100+', icon: <FaHome className="text-blue-500" />, desc: 'Earn 1% back in coins on every rent payment.', link: '/user/rental-contracts' },
        { title: 'Maintain Streak', coins: 'Up to 100', icon: <FaFire className="text-orange-500" />, desc: 'Pay rent on time for consecutive months for bonus coins.', link: activeContractId ? `/user/rent-wallet?contractId=${activeContractId}` : '/user/rental-contracts' },
        { title: 'Request Service', coins: '10-50', icon: <FaBolt className="text-yellow-500" />, desc: 'Book cleaning, plumbing or electrical tasks.', link: '/user/services' },
        { title: 'Refer a Friend', coins: '100', icon: <FaUserFriends className="text-purple-500" />, desc: 'Earn 100 SetuCoins & your friend gets 50 coins for joining.', link: '#', isReferral: true },
    ];

    // Redeem Options
    const redeemOptions = [
        { title: 'Rent Discount', rate: `${COIN_CONFIG.RATES.INR} Coins = ₹1`, icon: <FaHome className="text-indigo-600" />, desc: 'Apply coins during checkout to lower your monthly rent.', link: activeContractId ? `/user/pay-monthly-rent?contractId=${activeContractId}` : '/user/rental-contracts' },
        { title: 'Handyman Services', rate: `Up to ₹200 OFF`, icon: <FaBolt className="text-yellow-600" />, desc: 'Use coins to get discounts on home maintenance.', link: '/user/services' },
        { title: 'Packers & Movers', rate: `Up to ₹500 OFF`, icon: <FaRocket className="text-red-500" />, desc: 'Heavy discounts on moving services.', link: '/user/services' },
        { title: 'Merchant Vouchers', rate: `500 Coins = ₹100`, icon: <FaShoppingBag className="text-pink-500" />, desc: 'Redeem for Amazon, Flipkart, or Swiggy vouchers.', link: '#' },
        { title: 'Utility Bill Payments', rate: `1000 Coins = ₹200`, icon: <FaReceipt className="text-green-500" />, desc: 'Pay electricity or water bills using SetuCoins.', link: '#' },
    ];

    if (coinData.loading) {
        return <RewardsSkeleton />;
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-gray-900 py-8 px-4 md:px-8">
            <div className="max-w-6xl mx-auto">

                {/* Hero section */}
                <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-8 mb-8 text-white shadow-2xl transition-all duration-500 hover:shadow-indigo-500/20">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>
                    <FaCoins className="absolute bottom-[-20px] right-[-20px] text-[200px] text-white/5 rotate-12" />

                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="text-center md:text-left">
                            <h1 className="text-3xl md:text-4xl font-black mb-2 flex items-center justify-center md:justify-start gap-3">
                                <FaCoins className="text-yellow-400 drop-shadow-md animate-bounce" /> SetuCoins Rewards
                                <button
                                    onClick={() => setShowInfo(true)}
                                    className="text-white/40 hover:text-white transition-colors cursor-pointer"
                                    title="What are SetuCoins?"
                                >
                                    <FaInfoCircle size={20} />
                                </button>
                            </h1>
                            <p className="text-white/80 font-medium">Your loyalty, rewarded every step of the way.</p>

                            <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-4">
                                <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 flex items-center gap-2">
                                    <FaFire className={`text-orange-400 ${coinData.streak > 0 ? 'animate-pulse' : ''}`} />
                                    <span className="font-bold">{coinData.streak} Month Streak</span>
                                </div>
                                <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 flex items-center gap-2">
                                    <FaStar className="text-yellow-300" />
                                    <span className="font-bold underline cursor-help" title="Total Earned since joining">Lifetime: {coinData.totalEarned}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[2rem] border border-white/20 shadow-inner flex flex-col items-center min-w-[280px]">
                            <p className="text-sm font-bold uppercase tracking-widest text-white/70 mb-2">Available Balance</p>
                            <div className="text-6xl font-black tracking-tighter mb-2 flex items-baseline gap-2">
                                {coinData.balance.toLocaleString()}
                                <span className="text-lg font-medium text-white/60 cursor-help" title="SetuCoins">SC</span>
                            </div>
                            <div className="bg-yellow-400 text-indigo-900 px-3 py-1 rounded-full text-xs font-black shadow-lg">
                                ≈ ₹{(coinData.balance / 10).toFixed(2)} VALUATION
                            </div>
                            {coinData.expiryDate && coinData.balance > 0 && (
                                <p className="text-[10px] text-white/60 mt-2 font-bold uppercase tracking-widest bg-black/20 px-2 py-0.5 rounded-md">
                                    Expires: {new Date(coinData.expiryDate).toLocaleDateString()}
                                </p>
                            )}
                            {coinData.frozenCoins > 0 && (
                                <p className="text-[10px] text-red-200 mt-1 font-bold uppercase tracking-widest bg-red-500/20 px-2 py-0.5 rounded-md">
                                    Frozen: {coinData.frozenCoins.toLocaleString()}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs Navigation */}
                <div className="flex overflow-x-auto no-scrollbar gap-2 mb-8 bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                navigate(`/user/rewards?tab=${tab.id}`, { replace: true });
                            }}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none scale-105'
                                : 'text-slate-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="transition-all duration-500 animate-[fadeIn_0.5s_ease-out]">
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <FaRocket className="text-indigo-600" /> Quick Actions
                                </h2>
                                <div className="grid grid-cols-2 gap-4">
                                    <button onClick={() => setActiveTab('activities')} className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-slate-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all text-center group">
                                        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                            <FaStar />
                                        </div>
                                        <span className="font-bold text-slate-700 dark:text-gray-200">Earn Coins</span>
                                    </button>
                                    <button onClick={() => setActiveTab('rewards')} className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-slate-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all text-center group">
                                        <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                            <FaGift />
                                        </div>
                                        <span className="font-bold text-slate-700 dark:text-gray-200">Redeem Now</span>
                                    </button>
                                </div>

                                <div className="bg-indigo-900 rounded-3xl p-6 text-white overflow-hidden relative">
                                    <div className="relative z-10">
                                        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                                            <FaInfoCircle className="text-indigo-400" size={16} /> Did you know?
                                        </h3>
                                        <p className="text-indigo-100 text-sm leading-relaxed italic">"{currentFact}"</p>
                                    </div>
                                    <FaInfoCircle className="absolute -bottom-4 -right-4 text-8xl text-indigo-800 rotate-12" />
                                </div>

                                {/* Badges Section */}
                                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-gray-700">
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                                        <FaTrophy className="text-yellow-500" /> My Badges
                                    </h2>
                                    {coinData.badges && coinData.badges.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            {coinData.badges.map((badge, idx) => (
                                                <div key={idx} className="flex flex-col items-center bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800 text-center group hover:shadow-md transition-all">
                                                    <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center mb-2 shadow-lg group-hover:scale-110 transition-transform">
                                                        <FaTrophy />
                                                    </div>
                                                    <span className="text-sm font-black text-indigo-900 dark:text-indigo-100">{badge}</span>
                                                    <span className="text-[10px] font-bold text-indigo-400 uppercase mt-1">Unlocked</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 bg-slate-50 dark:bg-gray-700/30 rounded-2xl border border-dashed border-slate-200 dark:border-gray-700">
                                            <FaLock className="mx-auto text-slate-300 mb-2" size={24} />
                                            <p className="text-xs font-bold text-slate-400">No badges earned yet. <br/>Keep engaging to unlock titles!</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-gray-700">
                                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center justify-between">
                                    Recent Activity
                                    <button onClick={() => setActiveTab('history')} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">View All</button>
                                </h2>
                                <div className="space-y-4">
                                    {historyLoading ? (
                                        <p className="text-center py-8 text-slate-400">Loading...</p>
                                    ) : history.length === 0 ? (
                                        <p className="text-center py-8 text-slate-400">No activity yet.</p>
                                    ) : (
                                        history.slice(0, 4).map(tx => (
                                            <div key={tx._id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <TransactionThemedIcon source={tx.source} type={tx.type} containerClassName="p-2 rounded-lg" />
                                                    <div>
                                                        <p className="font-bold text-slate-700 dark:text-gray-200 text-sm truncate max-w-[150px] md:max-w-xs">{tx.description}</p>
                                                        <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase tracking-widest">{new Date(tx.createdAt).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <span className={`font-black ${tx.type === 'credit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                    {tx.type === 'credit' ? '+' : '-'}{tx.amount}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'activities' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {earnActivities.map((act, i) => (
                                    <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-gray-700 flex items-start gap-4 hover:shadow-md transition-all group">
                                        <div className="p-4 bg-slate-50 dark:bg-gray-700 rounded-2xl group-hover:bg-slate-100 dark:group-hover:bg-gray-600 transition-colors shadow-inner">
                                            {act.icon}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <h3 className="font-bold text-slate-800 dark:text-white">{act.title}</h3>
                                                <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-lg text-xs font-black">+{act.coins}</span>
                                            </div>
                                            <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">{act.desc}</p>
                                            <button
                                                onClick={() => act.isReferral ? setShowReferral(true) : navigate(act.link)}
                                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:gap-2 transition-all"
                                            >
                                                {act.isReferral ? 'Invite Friends' : 'Go to activity'} <FaChevronRight className="text-[10px]" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Referral Stats Summary */}
                            <div className="bg-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30">
                                            <FaUserFriends size={30} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black">Your Referral Impact</h3>
                                            <p className="text-indigo-100 text-sm">See how many friends you've brought to UrbanSetu</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-8">
                                        <div className="text-center">
                                            <p className="text-3xl font-black">{referralStats.referralsCount}</p>
                                            <p className="text-[10px] uppercase font-bold tracking-widest text-indigo-200">Friends Joined</p>
                                        </div>
                                        <div className="text-center bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-sm">
                                            <div className="flex flex-col">
                                                <p className="text-2xl font-black">₹{getCoinValue(referralStats.totalEarned, 'INR').toFixed(0)}</p>
                                                <p className="text-xl font-black opacity-80">${getCoinValue(referralStats.totalEarned, 'USD').toFixed(2)}</p>
                                            </div>
                                            <p className="text-[10px] uppercase font-bold tracking-widest text-indigo-200 mt-1">Value Earned</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-3xl font-black">{referralStats.totalEarned}</p>
                                            <p className="text-[10px] uppercase font-bold tracking-widest text-indigo-200">Total Coins</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'rewards' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {redeemOptions.map((opt, i) => (
                                <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-gray-700 flex flex-col items-center text-center hover:shadow-md transition-all group">
                                    <div className="w-16 h-16 bg-slate-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center mb-4 group-hover:rotate-6 transition-transform shadow-inner">
                                        {opt.icon}
                                    </div>
                                    <h3 className="font-bold text-slate-800 dark:text-white mb-1">{opt.title}</h3>
                                    <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full mb-3 uppercase tracking-tighter">{opt.rate}</p>
                                    <p className="text-sm text-slate-500 dark:text-gray-400 mb-6">{opt.desc}</p>
                                    <div className="relative group/btn w-full">
                                        {!isProfileComplete && (
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-xl">
                                                Complete profile to unlock rewards
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                            </div>
                                        )}
                                        <button
                                            onClick={() => isProfileComplete && navigate(opt.link)}
                                            disabled={!isProfileComplete}
                                            className={`w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all ${isProfileComplete
                                                ? 'bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800 dark:hover:bg-slate-600 shadow-slate-200 dark:shadow-none'
                                                : 'bg-slate-200 dark:bg-gray-700 text-slate-400 dark:text-gray-500 cursor-not-allowed shadow-none'
                                                }`}
                                        >
                                            {isProfileComplete ? <FaGift className="text-pink-400" /> : <FaLock />} Use Coins
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
                            <div className="p-6 border-b border-slate-50 dark:border-gray-700">
                                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Transaction Log</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 dark:bg-gray-700 text-slate-400 dark:text-gray-300 text-[10px] font-black uppercase tracking-[0.2em]">
                                        <tr>
                                            <th className="px-6 py-4">Transaction Details</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Date & Time</th>
                                            <th className="px-6 py-4">Expiry</th>
                                            <th className="px-6 py-4 text-right">Coins</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-gray-700">
                                        {historyLoading ? (
                                            <tr><td colSpan="5" className="text-center py-20 text-slate-400 dark:text-gray-500">Loading History...</td></tr>
                                        ) : history.length === 0 ? (
                                            <tr><td colSpan="5" className="text-center py-20 text-slate-400 dark:text-gray-500">No records found.</td></tr>
                                        ) : (
                                            history.map(tx => {
                                                const theme = GET_TRANSACTION_THEME(tx.source, tx.type);
                                                return (
                                                    <tr key={tx._id} className="hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <TransactionThemedIcon source={tx.source} type={tx.type} containerClassName="w-10 h-10 rounded-xl flex items-center justify-center" />
                                                                <div>
                                                                    <p className="font-bold text-slate-800 dark:text-gray-200 text-sm">{tx.description}</p>
                                                                    <p className={`text-[10px] font-bold tracking-wide uppercase ${theme.labelColor}`}>{tx.source.replace(/_/g, ' ')}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="flex items-center gap-1.5 text-xs font-bold text-green-600">
                                                                <FaCheckCircle className="text-[10px]" /> Completed
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-medium text-slate-500 dark:text-gray-400">
                                                            {new Date(tx.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            <br />
                                                            <span className="text-[10px] opacity-60 font-normal">{new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-medium text-slate-400 dark:text-gray-500">
                                                            {tx.expiryDate ? new Date(tx.expiryDate).toLocaleDateString() : '-'}
                                                        </td>
                                                        <td className={`px-6 py-4 text-right font-black text-lg ${tx.type === 'credit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                            {tx.type === 'credit' ? '+' : '-'}{tx.amount}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'leaderboard' && (
                        <CommunityLeaderboard />
                    )}

                    {activeTab === 'referrals' && (
                        <div className="space-y-6">
                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl">
                                    <FaUserFriends className="absolute bottom-4 right-4 text-6xl text-white/10" />
                                    <p className="text-indigo-100 font-bold uppercase tracking-wider text-sm mb-1">Friends Invited</p>
                                    <h3 className="text-4xl font-black">{referralStats.referralsCount}</h3>
                                </div>
                                <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl">
                                    <FaCoins className="absolute bottom-4 right-4 text-6xl text-white/10" />
                                    <p className="text-orange-100 font-bold uppercase tracking-wider text-sm mb-1">Coins Earned from Referrals</p>
                                    <h3 className="text-4xl font-black">{referralStats.totalEarned}</h3>
                                </div>
                            </div>

                            {/* Merged Invite & Network Section */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
                                {/* Header with Invite CTA */}
                                <div className="p-8 border-b border-slate-50 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div>
                                            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Your Network</h3>
                                            <p className="text-slate-500 dark:text-gray-400 text-sm max-w-md">
                                                Earn <span className="font-bold text-indigo-600 dark:text-indigo-400">100 coins</span> for every friend who joins. They get <span className="font-bold text-indigo-600 dark:text-indigo-400">50 coins</span> too!
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowReferral(true)}
                                            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 flex items-center gap-2 whitespace-nowrap md:w-auto w-full justify-center"
                                        >
                                            <FaUserFriends /> Invite Friend
                                        </button>
                                    </div>
                                </div>

                                {/* Network List */}
                                <div className="bg-white dark:bg-gray-800">
                                    {referralStats.loading ? (
                                        <div className="p-12 text-center text-slate-400">Loading your network...</div>
                                    ) : referralStats.referredUsers.length === 0 ? (
                                        <div className="p-12 text-center flex flex-col items-center justify-center">
                                            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 rounded-full flex items-center justify-center mb-4 text-2xl">
                                                <FaUserFriends />
                                            </div>
                                            <h4 className="text-lg font-bold text-slate-700 dark:text-gray-300 mb-1">No referrals yet</h4>
                                            <p className="text-slate-400 dark:text-gray-500 text-sm">Start inviting friends to build your network and earn coins!</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-50 dark:divide-gray-700">
                                            {referralStats.referredUsers.map((user) => (
                                                <div key={user.id} className="p-4 md:px-8 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors group">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden border-2 ${user.isDeleted ? 'bg-gray-100 border-gray-200 dark:bg-gray-700 dark:border-gray-600' : 'bg-slate-100 border-white shadow-sm dark:bg-gray-700 dark:border-gray-600'}`}>
                                                            {user.avatar ? (
                                                                <img src={user.avatar} alt={user.username} className={`w-full h-full object-cover ${user.isDeleted ? 'grayscale opacity-50' : ''}`} />
                                                            ) : (
                                                                <span className="text-lg font-bold text-slate-400 dark:text-gray-500">{user.username.charAt(0).toUpperCase()}</span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h4 className={`font-bold ${user.isDeleted ? 'text-gray-400 dark:text-gray-500 italic' : 'text-slate-800 dark:text-white'}`}>
                                                                {user.username} {user.isDeleted && <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded ml-2 not-italic font-normal">Deleted</span>}
                                                            </h4>
                                                            <p className="text-xs text-slate-400 dark:text-gray-500 flex items-center gap-1">
                                                                Joined <FaCalendarAlt className="text-[10px]" /> {new Date(user.joinedAt).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="md:px-4 md:py-1.5 px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full text-xs font-bold border border-green-100 dark:border-green-900/50">
                                                        +100 Coins
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Links */}
                <div className="mt-12 mb-8 text-center border-t border-slate-200 dark:border-gray-700 pt-8">
                    <p className="text-slate-400 dark:text-gray-500 text-sm mb-2">UrbanSetu Loyalty Program</p>
                    <div className="flex justify-center gap-6">
                        <Link to="/user/terms" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-bold transition-colors">
                            Terms & Conditions
                        </Link>
                        <Link to="/user/privacy" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-bold transition-colors">
                            Privacy Policy
                        </Link>
                    </div>
                </div>
            </div>

            <SetuCoinParticles active={showCoinBurst} onComplete={() => setShowCoinBurst(false)} count={30} />
            <SetuCoinInfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} />

            <SocialSharePanel
                isOpen={showReferral}
                onClose={() => setShowReferral(false)}
                url={`${window.location.origin}/sign-up?ref=${currentUser._id}`}
                title="Join me on UrbanSetu! 🏠"
                description="Sign up using my link to get started with the best real estate platform and earn exclusive rewards!"
            />

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div >
    );
}
