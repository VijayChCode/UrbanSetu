import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from 'react-toastify';
import { FaWallet, FaCalendarAlt, FaHistory, FaCog, FaMoneyBillWave, FaExclamationTriangle, FaCheckCircle, FaClock, FaDownload, FaTrophy, FaArrowRight, FaUserAlt, FaCreditCard, FaShieldAlt, FaPaypal } from "react-icons/fa";
import { usePageTitle } from '../hooks/usePageTitle';
import PaymentSchedule from '../components/rental/PaymentSchedule';
import AutoDebitSettings from '../components/rental/AutoDebitSettings';
import RentPaymentHistory from '../components/rental/RentPaymentHistory';
import RentWalletSkeleton from '../components/skeletons/RentWalletSkeleton';
import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminRentWallet() {
    // Set page title
    usePageTitle("Admin Rent Wallet - Monitoring Console");

    const { currentUser } = useSelector((state) => state.user);
    const navigate = useNavigate();
    const location = useLocation();

    // Get contractId from URL params
    const searchParams = new URLSearchParams(location.search);
    const contractId = searchParams.get('contractId');

    const [loading, setLoading] = useState(true);
    const [wallet, setWallet] = useState(null);
    const [contract, setContract] = useState(null);

    // For Admin view, we act as an observer for both
    const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'schedule', 'history', 'settings'

    const fetchWalletDetails = useCallback(async (showLoading = true) => {
        if (!contractId) {
            toast.error("Contract ID is required.");
            navigate("/admin/rental-contracts");
            return;
        }

        if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin')) {
            toast.error("Unauthorized access.");
            navigate("/user/home");
            return;
        }

        try {
            if (showLoading) {
                setLoading(true);
            }

            // Fetch wallet (Admins have access to all wallets via this endpoint on backend if authorized)
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
                }
            } else {
                throw new Error("Failed to fetch contract details");
            }
        } catch (error) {
            console.error("Error fetching wallet:", error);
            toast.error("Failed to load wallet details.");
            navigate("/admin/rental-contracts");
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    }, [contractId, currentUser, navigate]);

    // Fetch wallet details
    useEffect(() => {
        fetchWalletDetails(true);
    }, [fetchWalletDetails]);

    if (loading) {
        return <RentWalletSkeleton />;
    }

    if (!wallet || !contract) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 border-t border-gray-800">
                <div className="text-center bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-700">
                    <FaExclamationTriangle className="text-amber-500 text-5xl mx-auto mb-4" />
                    <p className="text-white text-xl mb-4 font-bold">Wallet/Contract Not Found</p>
                    <button
                        onClick={() => navigate("/admin/rental-contracts")}
                        className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 mx-auto"
                    >
                        Return to Contracts <FaArrowRight />
                    </button>
                </div>
            </div>
        );
    }

    // Statistics
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

    return (
        <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-indigo-950 min-h-screen py-10 px-4 md:px-8">
            <div className="max-w-7xl mx-auto">
                {/* Admin Warning Banner */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6 flex items-center gap-3">
                    <div className="bg-amber-500 p-2 rounded-lg text-white shadow-lg shadow-amber-500/20">
                        <FaShieldAlt />
                    </div>
                    <p className="text-amber-200 text-sm font-medium">
                        <strong>Admin Monitoring Mode:</strong> You are viewing this wallet as a rootadministrator. All actions are logged.
                    </p>
                </div>

                {/* Header */}
                <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-3xl p-8 mb-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <FaWallet className="text-9xl text-white" />
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-500/20">
                                    <FaWallet className="text-2xl text-white" />
                                </div>
                                <h1 className="text-3xl font-black text-white tracking-tight">
                                    Rent Wallet Monitoring
                                </h1>
                            </div>
                            <div className="flex flex-col gap-1">
                                <p className="text-gray-400 font-mono text-sm flex items-center gap-2">
                                    <span className="bg-gray-700 px-2 py-0.5 rounded text-gray-300">Contract ID</span> {contract.contractId}
                                </p>
                                {contract.listingId && (
                                    <p className="text-blue-400 font-bold flex items-center gap-2">
                                        <span className="text-gray-400 font-normal">Property:</span> {contract.listingId.name}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => navigate("/admin/rental-contracts")}
                                className="px-6 py-4 bg-gray-700 text-white font-bold rounded-2xl hover:bg-gray-600 transition-all flex items-center gap-3 shadow-lg"
                            >
                                Back to Contracts
                            </button>
                        </div>
                    </div>

                    {/* User Roles Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 pt-8 border-t border-gray-700">
                        <div className="bg-gray-900/40 p-4 rounded-2xl border border-gray-700 flex items-center gap-4">
                            <div className="bg-green-500/20 p-3 rounded-xl border border-green-500/30">
                                <FaUserAlt className="text-green-500" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 uppercase font-black tracking-widest">Tenant</p>
                                <p className="text-white font-bold">{contract.tenantId?.username || contract.tenantId?.email || 'N/A'}</p>
                                <p className="text-[10px] text-gray-500 font-mono">{contract.tenantId?._id || contract.tenantId}</p>
                            </div>
                        </div>
                        <div className="bg-gray-900/40 p-4 rounded-2xl border border-gray-700 flex items-center gap-4">
                            <div className="bg-blue-500/20 p-3 rounded-xl border border-blue-500/30">
                                <FaUserAlt className="text-blue-500" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 uppercase font-black tracking-widest">Landlord</p>
                                <p className="text-white font-bold">{contract.landlordId?.username || contract.landlordId?.email || 'N/A'}</p>
                                <p className="text-[10px] text-gray-500 font-mono">{contract.landlordId?._id || contract.landlordId}</p>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 mt-8 overflow-x-auto pb-1 scrollbar-hide">
                        {[
                            { id: 'overview', label: 'Overview', icon: FaWallet },
                            { id: 'schedule', label: 'Payment Schedule', icon: FaCalendarAlt },
                            { id: 'history', label: 'Payment History', icon: FaHistory },
                            { id: 'settings', label: 'Auto-Debit Monitor', icon: FaCog }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-3 font-bold rounded-2xl transition-all whitespace-nowrap ${activeTab === tab.id
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-105'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
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
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Wallet Statistics */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-3xl p-6 shadow-xl">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Total Received</p>
                                    <div className="bg-green-500/20 p-2 rounded-lg text-green-500">
                                        <FaCheckCircle />
                                    </div>
                                </div>
                                <p className="text-3xl font-black text-white">₹{displayTotalPaid.toLocaleString('en-IN')}</p>
                                <p className="text-xs text-gray-400 mt-2">All-time payments confirmed</p>
                            </div>

                            <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-3xl p-6 shadow-xl">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Remaining Balance</p>
                                    <div className="bg-blue-500/20 p-2 rounded-lg text-blue-500">
                                        <FaMoneyBillWave />
                                    </div>
                                </div>
                                <p className="text-3xl font-black text-white">₹{displayTotalDue.toLocaleString('en-IN')}</p>
                                <p className="text-xs text-gray-400 mt-2">Scheduled future payments</p>
                            </div>

                            <div className={`bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-3xl p-6 shadow-xl ${totalOverdue > 0 ? 'ring-2 ring-red-500/50 bg-red-500/5' : ''}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Overdue</p>
                                    <div className={`p-2 rounded-lg ${totalOverdue > 0 ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                                        <FaExclamationTriangle />
                                    </div>
                                </div>
                                <p className={`text-3xl font-black ${totalOverdue > 0 ? 'text-red-500' : 'text-white'}`}>₹{totalOverdue.toLocaleString('en-IN')}</p>
                                <p className="text-xs text-gray-400 mt-2">{overduePayments.length} missed schedules</p>
                            </div>

                            <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-3xl p-6 shadow-xl">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Next 30 Days</p>
                                    <div className="bg-amber-500/20 p-2 rounded-lg text-amber-500">
                                        <FaClock />
                                    </div>
                                </div>
                                <p className="text-3xl font-black text-white">₹{totalUpcoming.toLocaleString('en-IN')}</p>
                                <p className="text-xs text-gray-400 mt-2">{upcomingPayments.length} upcoming schedules</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-6">
                                {/* Contract Snapshot */}
                                <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-3xl p-8 shadow-xl">
                                    <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
                                        Snapshot
                                    </h2>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                        <div className="space-y-1">
                                            <p className="text-gray-400 text-[10px] uppercase font-black tracking-widest">Monthly Rent</p>
                                            <p className="text-white font-bold text-lg">₹{contract.lockedRentAmount?.toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-gray-400 text-[10px] uppercase font-black tracking-widest">Lock Period</p>
                                            <p className="text-white font-bold text-lg">{contract.lockDuration} Months</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-gray-400 text-[10px] uppercase font-black tracking-widest">Start Date</p>
                                            <p className="text-white font-bold text-lg">{new Date(contract.startDate).toLocaleDateString('en-GB')}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-gray-400 text-[10px] uppercase font-black tracking-widest">Due Day</p>
                                            <p className="text-white font-bold text-lg">Day {contract.dueDate}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Health Timeline */}
                                <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-3xl p-8 shadow-xl">
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-xl font-black text-white">Payment Health</h2>
                                        <Link to={`/admin/payments?contractId=${contract._id}`} className="text-blue-400 text-sm font-bold hover:underline">Full Audit Log</Link>
                                    </div>
                                    <div className="space-y-4">
                                        {wallet.paymentSchedule && wallet.paymentSchedule.length > 0 ? (
                                            wallet.paymentSchedule
                                                .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))
                                                .slice(0, 5)
                                                .map((payment, idx) => {
                                                    const pId = payment.paymentId?.paymentId || payment.paymentId;
                                                    return (
                                                        <div
                                                            key={idx}
                                                            onClick={() => pId && navigate(`/admin/payments?paymentId=${pId}`)}
                                                            className={`bg-gray-900/60 p-4 rounded-2xl border border-gray-700 flex items-center justify-between transition-all ${pId ? 'cursor-pointer hover:bg-gray-900 hover:border-blue-500/50 hover:shadow-lg active:scale-95' : ''}`}
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-2 h-10 rounded-full ${payment.status === 'completed' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : payment.status === 'overdue' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-gray-600'}`}></div>
                                                                <div>
                                                                    <p className="text-white font-bold">{new Date(payment.dueDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{payment.status}</p>
                                                                        {pId && <p className="text-[10px] text-blue-400 font-mono">{pId}</p>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-white font-bold">₹{(payment.amount + maintenance).toLocaleString('en-IN')}</p>
                                                                {payment.paidAt ? (
                                                                    <p className="text-[10px] text-green-500 font-bold uppercase italic">Paid {new Date(payment.paidAt).toLocaleDateString('en-GB')}</p>
                                                                ) : (
                                                                    payment.status === 'overdue' && <p className="text-[10px] text-red-500 font-bold uppercase">Overdue</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                        ) : (
                                            <p className="text-gray-500 text-center py-8">No payment timeline available yet.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Sidebar - AD Monitoring */}
                            <div className="space-y-6">
                                <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-3xl p-6 shadow-xl">
                                    <h3 className="text-white font-black text-sm uppercase tracking-widest mb-6">Auto-Debit Monitor</h3>
                                    <div className="flex flex-col items-center p-6 bg-gray-900/60 rounded-3xl border border-gray-700 shadow-inner">
                                        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-3xl mb-4 ${wallet.autoDebitEnabled
                                            ? (wallet.autoDebitMethod === 'paypal' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-green-500 text-white shadow-lg shadow-green-500/20')
                                            : 'bg-gray-700 text-gray-400'
                                            }`}>
                                            {wallet.autoDebitMethod === 'paypal' ? <FaPaypal /> : <FaShieldAlt />}
                                        </div>
                                        <p className={`text-lg font-black ${wallet.autoDebitEnabled ? 'text-white' : 'text-gray-400'}`}>
                                            {wallet.autoDebitEnabled ? (wallet.autoDebitMethod === 'paypal' ? 'PayPal Active' : 'Razorpay Active') : 'Service Inactive'}
                                        </p>
                                        <p className="text-[10px] text-gray-500 mt-2 text-center uppercase tracking-widest font-black italic">Monitoring Enabled</p>
                                    </div>

                                    {wallet.autoDebitEnabled && (
                                        <div className="mt-6 space-y-4">
                                            <div className="p-4 bg-gray-900/40 rounded-2xl border border-gray-700">
                                                <p className="text-[10px] text-gray-500 uppercase font-black">Linked Account Details</p>
                                                <div className="flex items-center gap-3 mt-2">
                                                    {wallet.autoDebitMethod === 'paypal' ? <FaPaypal className="text-indigo-400 text-xl" /> : <FaCreditCard className="text-blue-400 text-xl" />}
                                                    <div className="flex-1">
                                                        <p className="text-white font-bold text-sm">•••• •••• •••• {wallet.paymentMethodToken ? wallet.paymentMethodToken.slice(-4) : 'XXXX'}</p>
                                                        <p className="text-[10px] text-gray-500">Secure Tokenization ID: {wallet.paymentMethodToken || 'Not Available'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`p-4 rounded-2xl border ${wallet.autoDebitMethod === 'paypal' ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
                                                <p className={`${wallet.autoDebitMethod === 'paypal' ? 'text-indigo-300' : 'text-blue-300'} text-[10px] font-bold uppercase`}>NEXT RUN: Day {wallet.autoDebitDay} of month</p>
                                            </div>
                                        </div>
                                    )}                   </div>

                                <div className="bg-indigo-600 rounded-3xl p-6 shadow-xl shadow-indigo-500/20">
                                    <h3 className="text-white font-black text-sm uppercase tracking-widest mb-4">Admin Audit</h3>
                                    <p className="text-indigo-100 text-xs mb-4">View detailed transaction logs and system interventions for this contract.</p>
                                    <button
                                        onClick={() => navigate(`/admin/payments?contractId=${contract._id}`)}
                                        className="w-full py-4 bg-white text-indigo-600 font-black rounded-2xl hover:bg-gray-100 transition-all shadow-lg active:scale-95"
                                    >
                                        Open Full Audit
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Payment Schedule Tab */}
                {activeTab === 'schedule' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <PaymentSchedule wallet={wallet} contract={contract} isTenant={false} isAdmin={true} />
                    </div>
                )}

                {/* Payment History Tab */}
                {activeTab === 'history' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <RentPaymentHistory wallet={wallet} contract={contract} isTenant={false} isAdmin={true} />
                    </div>
                )}

                {/* Auto-Debit Settings Tab */}
                {activeTab === 'settings' && (
                    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Read-only view for Admin settings monitoring */}
                        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-3xl overflow-hidden shadow-2xl">
                            <div className="p-8 border-b border-gray-700 flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-black text-white">Auto-Debit Monitor</h2>
                                    <p className="text-gray-400 text-sm mt-1">Tenant's automated payment configuration</p>
                                </div>
                                <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${wallet.autoDebitEnabled ? 'bg-green-500/10 text-green-500 border border-green-500/30' : 'bg-gray-700 text-gray-400'}`}>
                                    {wallet.autoDebitEnabled ? 'Active' : 'Missing Configuration'}
                                </div>
                            </div>
                            <div className="p-8 space-y-8">
                                <div className="bg-gray-900/60 p-6 rounded-3xl border border-gray-700 flex items-center gap-6">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl ${wallet.autoDebitEnabled
                                        ? (wallet.autoDebitMethod === 'paypal' ? 'bg-indigo-600 text-white' : 'bg-blue-600 text-white')
                                        : 'bg-gray-700 text-gray-400'
                                        }`}>
                                        {wallet.autoDebitMethod === 'paypal' ? <FaPaypal /> : <FaCog />}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Active Provider</p>
                                        <p className="text-xl font-black text-white">{wallet.autoDebitMethod?.toUpperCase() || 'NONE SELECTED'}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-gray-900/40 p-6 rounded-3xl border border-gray-700">
                                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <FaCalendarAlt /> Preferred Run Date
                                        </p>
                                        <p className="text-3xl font-black text-white">Day {wallet.autoDebitDay || contract.dueDate}</p>
                                        <p className="text-[10px] text-gray-500 mt-2">Transactions trigger at 09:00 AM IST</p>
                                    </div>
                                    <div className="bg-gray-900/40 p-6 rounded-3xl border border-gray-700">
                                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <FaCheckCircle /> Verification Status
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${wallet.paymentMethodToken ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                                            <p className="text-white font-bold">{wallet.paymentMethodToken ? 'Token Linked' : 'No Token Found'}</p>
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-2 line-clamp-1 truncate uppercase tracking-widest font-black italic">ID: {wallet.paymentMethodToken || 'N/A'}</p>
                                    </div>
                                </div>

                                <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                                    <p className="text-blue-400 text-xs leading-relaxed italic">
                                        <strong>Security Note:</strong> As an admin, you can see the tokenized ID and payment schedule. Full financial details are encrypted and never stored on UrbanSetu servers.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
