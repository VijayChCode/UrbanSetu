import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation, Link, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from 'react-toastify';
import { FaWallet, FaCalendarAlt, FaHistory, FaCog, FaMoneyBillWave, FaExclamationTriangle, FaCheckCircle, FaClock, FaDownload, FaTrophy, FaArrowRight, FaAward, FaRegGem, FaShieldAlt, FaDove, FaHandshake, FaFire, FaCoins, FaInfoCircle, FaTools, FaHome, FaExternalLinkAlt, FaLock } from "react-icons/fa";
import { usePageTitle } from '../hooks/usePageTitle';
import PaymentSchedule from '../components/rental/PaymentSchedule';
import AutoDebitSettings from '../components/rental/AutoDebitSettings';
import RentPaymentHistory from '../components/rental/RentPaymentHistory';
import RentWalletSkeleton from '../components/skeletons/RentWalletSkeleton';
import SetuCoinInfoModal from "../components/SetuCoins/SetuCoinInfoModal";
import MilestoneProgress from "../components/SetuCoins/MilestoneProgress";
import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const getNormalizedSearchParams = () => {
  return new URLSearchParams(window.location.search.replace(/\?/g, '&').replace(/^&/, '?'));
};

export default function RentWallet() {
  // Set page title
  usePageTitle("Rent Wallet - Manage Your Rent Payments");

  const { currentUser } = useSelector((state) => state.user);
  const currentUserId = currentUser?._id;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get contractId from URL params or state
  const contractId = getNormalizedSearchParams().get('contractId');

  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [contract, setContract] = useState(null);
  const [isTenant, setIsTenant] = useState(false);
  const [isLandlord, setIsLandlord] = useState(false);
  const [gamification, setGamification] = useState({
    setuCoinsBalance: 0,
    totalCoinsEarned: 0,
    currentStreak: 0,
    rank: null,
    badges: []
  });

  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'schedule', 'history', 'settings'

  const nextPayment = useMemo(() => {
    if (!wallet?.paymentSchedule) return null;
    const sorted = [...wallet.paymentSchedule].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    return sorted.find(p => p.status === 'pending' || p.status === 'overdue');
  }, [wallet]);
  
  // Sync activeTab with URL search parameters
  useEffect(() => {
    const params = getNormalizedSearchParams();
    const tabParam = params.get('tab');
    if (tabParam === 'overview') {
      setActiveTab('overview');
    } else if (tabParam === 'schedule') {
      setActiveTab('schedule');
    } else if (tabParam === 'history') {
      setActiveTab('history');
    } else if (tabParam === 'settings' && isTenant) {
      setActiveTab('settings');
    } else if (!tabParam) {
      setActiveTab('overview');
    }
  }, [searchParams, isTenant]);

  const [showSetuCoinInfo, setShowSetuCoinInfo] = useState(false);

  const fetchWalletDetails = useCallback(async (showLoading = true) => {
    if (!contractId) {
      toast.error("Contract ID is required.");
      navigate("/user/my-appointments");
      return;
    }

    if (!currentUserId) {
      toast.error("Please sign in to access your rent wallet.");
      navigate("/sign-in");
      return;
    }

    try {
      if (showLoading) {
        setLoading(true);
      }

      // Fetch wallet
      const walletRes = await authenticatedFetch(`${API_BASE_URL}/api/rental/wallet/${contractId}`);

      if (!walletRes.ok) {
        throw new Error("Failed to fetch wallet");
      }

      const walletData = await walletRes.json();
      if (walletData.success && walletData.wallet) {
        setWallet(walletData.wallet);
      }

      // Fetch contract
      const contractRes = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts/${contractId}`);

      if (contractRes.ok) {
        const contractData = await contractRes.json();
        if (contractData.success && contractData.contract) {
          setContract(contractData.contract);
          // Set role
          const c = contractData.contract;
          if (currentUserId) {
            setIsTenant(c.tenantId?._id === currentUserId || c.tenantId === currentUserId);
            setIsLandlord(c.landlordId?._id === currentUserId || c.landlordId === currentUserId);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching wallet:", error);
      toast.error("Failed to load wallet details.");
      navigate("/user/my-appointments");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [contractId, currentUserId, navigate]);

  const fetchGamification = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/coins/balance`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setGamification({
            setuCoinsBalance: data.setuCoinsBalance,
            totalCoinsEarned: data.totalCoinsEarned,
            currentStreak: data.currentStreak,
            rank: data.rank,
            badges: data.badges || []
          });
        }
      }
    } catch (error) {
      console.error("Error fetching gamification:", error);
    }
  }, []);

  const getBadgeIcon = (badge) => {
    switch (badge) {
      case 'Elite Resident': return <FaRegGem className="text-purple-300" />;
      case 'Perfect Payer': return <FaHandshake className="text-green-300" />;
      case 'Early Bird': return <FaDove className="text-blue-300" />;
      case 'Trusted Tenant': return <FaShieldAlt className="text-indigo-300" />;
      case 'Service Pro': return <FaTools className="text-orange-300" />;
      case 'House Proud': return <FaHome className="text-pink-300" />;
      default: return <FaAward className="text-yellow-300" />;
    }
  };

  // Fetch wallet details
  useEffect(() => {
    fetchWalletDetails(true); // Show loading initially
    fetchGamification();
  }, [fetchWalletDetails, fetchGamification]);

  // Handle navigation state from payment page
  useEffect(() => {
    if (location.state?.refresh) {
      fetchWalletDetails(false); // Silent refresh
      // Clear state to prevent loop
      navigate(location.pathname + location.search, { replace: true, state: {} });
    }
  }, [location, fetchWalletDetails, navigate]);

  useEffect(() => {
    const normalizedId = contractId?.toString();
    const handlePaymentUpdate = (event) => {
      const updatedId = event.detail?.contractId;
      const updatedGamification = event.detail?.gamification;

      if (!updatedId || !normalizedId || updatedId.toString() === normalizedId) {
        // If we have updated gamification data in the event, use it immediately
        if (updatedGamification) {
          setGamification(prev => ({
            ...prev,
            setuCoinsBalance: updatedGamification.setuCoinsBalance ?? prev.setuCoinsBalance,
            currentStreak: updatedGamification.currentStreak ?? prev.currentStreak,
            badges: updatedGamification.badges ?? prev.badges
          }));
        }

        // Add a small delay to allow backend to process for full refresh
        setTimeout(() => {
          fetchWalletDetails(false);
          if (!updatedGamification) {
            fetchGamification();
          }
        }, 1000); // Silent refresh
      }
    };

    window.addEventListener('rentalPaymentStatusUpdated', handlePaymentUpdate);
    return () => {
      window.removeEventListener('rentalPaymentStatusUpdated', handlePaymentUpdate);
    };
  }, [contractId, fetchWalletDetails]);

  // Poll for updates if any payment is processing
  useEffect(() => {
    if (!wallet?.paymentSchedule) return;

    const hasProcessing = wallet.paymentSchedule.some(p => p.status === 'processing');
    if (hasProcessing) {
      const interval = setInterval(() => fetchWalletDetails(false), 3000); // Silent polling
      return () => clearInterval(interval);
    }
  }, [wallet, fetchWalletDetails]);

  if (loading) {
    return <RentWalletSkeleton />;
  }

  if (!wallet || !contract) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Wallet not found.</p>
          <button
            onClick={() => navigate("/user/my-appointments")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to My Appointments
          </button>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const maintenance = contract?.maintenanceCharges || 0;

  const overduePayments = wallet.paymentSchedule?.filter(p => {
    const now = new Date();
    const dueDate = new Date(p.dueDate);
    return (p.status === 'pending' || p.status === 'overdue') && dueDate < now;
  }) || [];

  const upcomingPayments = wallet.paymentSchedule?.filter(p => {
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const dueDate = new Date(p.dueDate);
    return p.status === 'pending' && dueDate >= now && dueDate <= nextMonth;
  }) || [];

  const completedPayments = wallet.paymentSchedule?.filter(p => p.status === 'completed' || p.status === 'paid') || [];
  const pendingPayments = wallet.paymentSchedule?.filter(p => p.status === 'pending' || p.status === 'overdue') || [];

  const totalOverdue = overduePayments.reduce((sum, p) => sum + p.amount + (p.penaltyAmount || 0) + maintenance, 0);
  const totalUpcoming = upcomingPayments.reduce((sum, p) => sum + p.amount + maintenance, 0);

  const displayTotalPaid = completedPayments.reduce((sum, p) => sum + p.amount + (p.penaltyAmount || 0) + maintenance, 0);
  const displayTotalDue = pendingPayments.reduce((sum, p) => sum + p.amount + (p.penaltyAmount || 0) + maintenance, 0);



  const handlePayNow = (payment) => {
    if (!contract || !payment || !wallet) {
      toast.error("Payment information not available.");
      return;
    }
    const scheduleIndex = wallet.paymentSchedule.findIndex(p =>
      p.month === payment.month &&
      p.year === payment.year &&
      p.dueDate === payment.dueDate
    );
    if (scheduleIndex === -1) {
      toast.error("Payment schedule entry not found.");
      return;
    }
    navigate(`/user/pay-monthly-rent?contractId=${contract._id}&scheduleIndex=${scheduleIndex}`);
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 min-h-screen py-10 px-4 md:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400 mb-2">
                <FaWallet className="inline mr-2" />
                Rent Wallet
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Contract ID: <span className="font-semibold break-all text-gray-800 dark:text-gray-200">{contract.contractId}</span>
              </p>
              {contract.listingId && typeof contract.listingId === 'object' && (
                <p className="text-gray-600 dark:text-gray-300">
                  Property: <span className="font-semibold text-gray-800 dark:text-gray-200">{contract.listingId.name}</span>
                </p>
              )}
            </div>
            <button
              onClick={() => navigate("/user/rental-contracts")}
              className="w-full md:w-auto px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Back to Contracts
            </button>
          </div>

          {/* Tabs */}
          {/* Tabs - Scrollable on mobile */}
          {/* Tabs - Scrollable on mobile */}
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            {[
              { id: 'overview', label: 'Overview', icon: FaWallet },
              { id: 'schedule', label: 'Payment Schedule', icon: FaCalendarAlt },
              { id: 'history', label: 'Payment History', icon: FaHistory },
              ...(isTenant ? [{ id: 'settings', label: 'Auto-Debit Settings', icon: FaCog }] : [])
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  const params = getNormalizedSearchParams();
                  params.set('tab', tab.id);
                  setSearchParams(params);
                }}
                className={`flex items-center gap-2 px-4 py-2 font-semibold transition whitespace-nowrap flex-shrink-0 ${activeTab === tab.id
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
              >
                <tab.icon />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">

            {/* Gamification Banner */}
            <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-blue-800 rounded-2xl shadow-lg p-5 text-white relative overflow-hidden group hover:shadow-xl transition-all duration-500">
              {/* Background Decoration */}
              <div className="absolute top-0 right-0 opacity-10 transform translate-x-12 -translate-y-12 rotate-12 group-hover:rotate-45 transition-transform duration-1000">
                <FaTrophy className="text-[10rem]" />
              </div>

              <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-4">
                <div className="flex-1 text-center lg:text-left">
                  <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-2 border border-white/30">
                    <FaAward className="text-yellow-400" /> Member Rewards Program
                    <button 
                      onClick={() => setShowSetuCoinInfo(true)}
                      className="ml-0.5 hover:text-yellow-200 transition-colors cursor-pointer"
                      title="What are SetuCoins?"
                    >
                      <FaInfoCircle size={12} />
                    </button>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-extrabold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-white to-indigo-100 italic">
                    Level Up Your Living Experience
                  </h2>
                  <p className="text-indigo-100/90 max-w-xl text-sm leading-relaxed mb-4">
                    Earn <span className="font-bold text-yellow-300">SetuCoins</span> with every on-time payment.
                  </p>
                  
                  {/* Stats Counter */}
                  <div className="flex flex-wrap justify-center lg:justify-start gap-3 mt-2">
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 min-w-[100px] hover:bg-white/20 transition-colors">
                      <div className="text-white/60 text-[9px] font-bold uppercase mb-0.5">Balance</div>
                      <div className="text-xl font-black flex items-center justify-center lg:justify-start gap-1.5">
                        <FaCoins className="text-yellow-400" /> {gamification.setuCoinsBalance}
                      </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 min-w-[140px] hover:bg-white/20 transition-colors">
                      <div className="text-white/60 text-[9px] font-bold uppercase mb-0.5">Rent Streak</div>
                      <div className="text-xl font-black flex items-center justify-center lg:justify-start gap-1.5">
                        <FaFire className={gamification.currentStreak > 0 ? "text-orange-400" : "text-gray-400"} /> {gamification.currentStreak} Mo
                      </div>
                      
                      {/* Milestone Progress Bar */}
                      {isTenant && gamification.currentStreak < 12 && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                          <MilestoneProgress 
                            streak={gamification.currentStreak} 
                            variant="minimal"
                          />
                        </div>
                      )}
                    </div>
                    {gamification.rank && (
                      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 min-w-[100px] hover:bg-white/20 transition-colors">
                        <div className="text-white/60 text-[9px] font-bold uppercase mb-0.5">Global Rank</div>
                        <div className="text-xl font-black italic">#{gamification.rank}</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center lg:items-end gap-3 w-full lg:w-auto">
                  {/* Badges Display */}
                  {gamification.badges?.length > 0 ? (
                    <div className="w-full lg:w-[350px]">
                      <h4 className="text-right text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-2 px-2">Achievements</h4>
                      <div className="flex flex-wrap justify-center lg:justify-end gap-2">
                        {gamification.badges.map((badge, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 bg-black/30 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-xl hover:scale-105 hover:bg-black/40 transition-all cursor-default group/badge shadow-md"
                          >
                            <span className="text-base group-hover/badge:rotate-12 transition-transform">{getBadgeIcon(badge)}</span>
                            <span className="font-bold text-xs whitespace-nowrap">{badge}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center lg:text-right text-indigo-100/60 italic text-xs mb-1">
                      {gamification.currentStreak < 6 
                        ? `Pay ${6 - gamification.currentStreak} more ${6 - gamification.currentStreak === 1 ? 'time' : 'times'} on time to unlock your first badge!`
                        : `Pay ${12 - gamification.currentStreak} more ${12 - gamification.currentStreak === 1 ? 'time' : 'times'} on time to unlock your next badge!`
                      }
                    </div>
                  )}

                  <Link 
                    to="/user/leaderboard" 
                    className="group flex items-center gap-2 bg-yellow-400 text-indigo-900 px-5 py-2.5 rounded-xl font-black text-sm shadow-[0_0_15px_rgba(250,204,21,0.3)] hover:shadow-[0_0_25px_rgba(250,204,21,0.5)] hover:-translate-y-0.5 transition-all active:scale-95"
                  >
                    View Leaderboard <FaArrowRight className="text-xs group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Wallet Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Paid */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-gray-600 dark:text-gray-300 font-medium">{isTenant ? 'Total Paid' : 'Total Received'}</h3>
                  <FaCheckCircle className="text-green-600 dark:text-green-400 text-xl" />
                </div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  ₹{displayTotalPaid.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">All-time payments</p>
              </div>

              {/* Total Due */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-gray-600 dark:text-gray-300 font-medium">{isTenant ? 'Total Due' : 'Total Pending'}</h3>
                  <FaMoneyBillWave className="text-blue-600 dark:text-blue-400 text-xl" />
                </div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  ₹{displayTotalDue.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Remaining payments</p>
              </div>

              {/* Overdue */}
              {totalOverdue > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-red-200 dark:border-red-800">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-gray-600 dark:text-gray-300 font-medium">Overdue</h3>
                    <FaExclamationTriangle className="text-red-600 dark:text-red-400 text-xl" />
                  </div>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    ₹{totalOverdue.toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                    {overduePayments.length} payment{overduePayments.length > 1 ? 's' : ''}
                  </p>
                </div>
              )}

              {/* Upcoming */}
              {totalUpcoming > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-gray-600 dark:text-gray-300 font-medium">Upcoming (30 days)</h3>
                    <FaClock className="text-yellow-600 dark:text-yellow-400 text-xl" />
                  </div>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    ₹{totalUpcoming.toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {upcomingPayments.length} payment{upcomingPayments.length > 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Next Payment Section */}
            {nextPayment && (
              <div className={`rounded-xl shadow-lg p-6 border-l-4 ${
                nextPayment.status === 'overdue' 
                  ? 'bg-red-50/50 dark:bg-red-900/10 border-red-500' 
                  : 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-500'
              }`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${
                      nextPayment.status === 'overdue' 
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    }`}>
                      <FaCalendarAlt className="text-2xl" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        Next Due Payment
                        {nextPayment.status === 'overdue' ? (
                          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 text-xs font-bold rounded">
                            Overdue
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 text-xs font-bold rounded">
                            Upcoming
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Due Date: <span className="font-semibold text-gray-700 dark:text-gray-200">
                          {new Date(nextPayment.dueDate).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </span>
                      </p>
                      {nextPayment.status === 'pending' && nextPayment.amount >= 1000 && isTenant && (
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold flex items-center gap-1 mt-1">
                          <FaCoins /> Earn {Math.floor(nextPayment.amount / 1000)} SetuCoins upon paying on time!
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center md:items-end justify-between md:flex-col gap-4 w-full md:w-auto">
                    <div className="text-left md:text-right">
                      <p className="text-2xl font-black text-gray-800 dark:text-white">
                        ₹{(nextPayment.amount + (nextPayment.penaltyAmount || 0) + maintenance).toLocaleString('en-IN')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Base: ₹{nextPayment.amount.toLocaleString('en-IN')} 
                        {maintenance > 0 && ` + Maintenance: ₹${maintenance.toLocaleString('en-IN')}`}
                        {nextPayment.penaltyAmount > 0 && ` + Penalty: ₹${nextPayment.penaltyAmount.toLocaleString('en-IN')}`}
                      </p>
                    </div>
                    {isTenant ? (
                      <button
                        onClick={() => handlePayNow(nextPayment)}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 transition active:scale-95 flex items-center gap-2"
                      >
                        <FaMoneyBillWave /> Pay Now
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-lg">
                        Informative: Awaiting Tenant Payment
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Smart Escrow Status */}
            {wallet.escrow?.status !== 'none' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-indigo-500">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                    <FaLock className="text-indigo-500" /> Security Deposit Escrow
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    wallet.escrow.status === 'locked' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                    wallet.escrow.status === 'disputed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  }`}>
                    {wallet.escrow.status}
                  </span>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Locked Amount</p>
                      <p className="text-2xl font-black text-gray-800 dark:text-white">₹{wallet.escrow.depositAmount?.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Locked on Polygon</p>
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        {wallet.escrow.lockedAt ? new Date(wallet.escrow.lockedAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold mb-1 tracking-widest">Escrow Contract Address</p>
                    <p className="font-mono text-[10px] break-all text-indigo-600 dark:text-indigo-400">
                      {wallet.escrow.escrowAddress}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1 italic">
                      <FaShieldAlt className="text-indigo-500" /> Protected by UrbanSetu Smart Contract
                    </span>
                    <button 
                      onClick={() => window.open(`https://polygonscan.com/tx/${wallet.escrow.lockTxHash}`, '_blank')}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1"
                    >
                      View Tx <FaExternalLinkAlt size={8} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Blockchain Proof Verification */}
            {contract.blockchainProof?.agreementHash && (
              <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-xl shadow-lg p-6 text-white border border-indigo-700/50 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full pointer-events-none -mr-8 -mt-8"></div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                    <FaShieldAlt className="text-indigo-400" />
                    Agreement Proof
                  </h2>
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded text-[10px] font-black uppercase tracking-widest border border-green-500/30 flex items-center gap-1">
                    <FaCheckCircle size={10} /> Immutable
                  </span>
                </div>
                <p className="text-sm text-indigo-100/80 mb-4 leading-relaxed">
                  This rental agreement is cryptographically verified on the <strong>Polygon Network</strong>. The terms are permanent and cannot be altered.
                </p>
                <div className="bg-black/30 p-3 rounded-lg border border-white/10 mb-4">
                  <p className="text-[10px] text-indigo-300 mb-1 font-bold uppercase tracking-wider">Fingerprint (SHA-256)</p>
                  <p className="font-mono text-xs break-all text-white/90 selection:bg-indigo-500">
                    {contract.blockchainProof.agreementHash}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <button 
                    onClick={() => window.open(`https://polygonscan.com/tx/${contract.blockchainProof.onChainTxHash}`, '_blank')}
                    className="text-xs font-bold text-indigo-300 hover:text-white transition-colors flex items-center gap-1 underline underline-offset-2"
                  >
                    View Ledger Proof <FaExternalLinkAlt size={10} />
                  </button>
                  <p className="text-[10px] text-indigo-300 italic">
                    Verified {new Date(contract.blockchainProof.timestamp || contract.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}

            {/* Contract Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Contract Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Monthly Rent</p>
                  <p className="font-semibold text-lg text-gray-900 dark:text-gray-200">₹{contract.lockedRentAmount?.toLocaleString('en-IN') || '0'}/month</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Lock Duration</p>
                  <p className="font-semibold text-lg text-gray-900 dark:text-gray-200">{contract.lockDuration} months</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Start Date</p>
                  <p className="font-semibold text-lg text-gray-900 dark:text-gray-200">
                    {new Date(contract.startDate).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">End Date</p>
                  <p className="font-semibold text-lg text-gray-900 dark:text-gray-200">
                    {new Date(contract.endDate).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Payment Due Date</p>
                  <p className="font-semibold text-lg text-gray-900 dark:text-gray-200">Day {contract.dueDate} of each month</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Auto-Debit</p>
                  <p className="font-semibold text-lg">
                    {wallet.autoDebitEnabled ? (
                      <span className="text-green-600 dark:text-green-400">Enabled</span>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">Disabled</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Payments */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Recent Payments</h2>
              {wallet.paymentSchedule && wallet.paymentSchedule.length > 0 ? (
                <div className="space-y-2">
                  {wallet.paymentSchedule
                    .filter(p => p.status === 'completed' || p.status === 'paid')
                    .sort((a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0))
                    .slice(0, 5)
                    .map((payment, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {new Date(payment.dueDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Paid: {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString('en-GB') : 'N/A'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600 dark:text-green-400">
                            ₹{(payment.amount + (contract?.maintenanceCharges || 0)).toLocaleString('en-IN')}
                          </p>
                          {payment.penaltyAmount > 0 && (
                            <p className="text-xs text-red-600 dark:text-red-400">
                              Penalty: ₹{payment.penaltyAmount.toLocaleString('en-IN')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No payments yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Payment Schedule Tab */}
        {activeTab === 'schedule' && (
          <PaymentSchedule wallet={wallet} contract={contract} isTenant={isTenant} />
        )}

        {/* Payment History Tab */}
        {activeTab === 'history' && (
          <RentPaymentHistory wallet={wallet} contract={contract} isTenant={isTenant} />
        )}

        {/* Auto-Debit Settings Tab */}
        {activeTab === 'settings' && (
          <AutoDebitSettings wallet={wallet} contract={contract} onUpdate={setWallet} />
        )}
      </div>
      
      {/* SetuCoin Information Modal */}
      <SetuCoinInfoModal 
        isOpen={showSetuCoinInfo} 
        onClose={() => setShowSetuCoinInfo(false)} 
        headerClass="from-indigo-600 via-purple-600 to-blue-700"
      />
    </div>
  );
}

