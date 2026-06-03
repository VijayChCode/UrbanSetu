import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaDollarSign, FaCreditCard, FaChartLine, FaSync, FaDownload, FaCheck, FaUndo, FaCheckCircle, FaTimes, FaExclamationTriangle, FaUsers, FaHome, FaCalendar, FaMoneyBill, FaLock, FaShare, FaEye, FaCopy, FaExternalLinkAlt, FaWallet } from 'react-icons/fa';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import PaymentHistory from '../components/PaymentHistory';
import RefundManagement from '../components/RefundManagement';
import { signoutUserStart, signoutUserSuccess, signoutUserFailure } from '../redux/user/userSlice';
import { toast } from 'react-toastify';
import axios from 'axios';
import { socket } from '../utils/socket';

import PaymentDashboardSkeleton from '../components/skeletons/PaymentDashboardSkeleton';
import SocialSharePanel from '../components/SocialSharePanel';
import { authenticatedFetch } from '../utils/auth';

import { usePageTitle } from '../hooks/usePageTitle';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const PaymentDashboard = () => {
  // Set page title
  usePageTitle("Payment Dashboard - Financial Management");

  const { currentUser } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState('overview');

  // Sync activeTab with URL search parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search.replace(/\?/g, '&').replace(/^&/, '?'));
    const tabParam = params.get('tab');
    const paymentId = params.get('paymentId');
    const contractId = params.get('contractId');

    if (paymentId || contractId) {
      setActiveTab('history');
      if (tabParam !== 'payment_history') {
        params.set('tab', 'payment_history');
        setSearchParams(params, { replace: true });
      }
    } else if (tabParam === 'overview') {
      setActiveTab('overview');
    } else if (tabParam === 'payment_history') {
      setActiveTab('history');
    } else if (tabParam === 'refund') {
      setActiveTab('refunds');
    } else if (!tabParam) {
      setActiveTab('overview');
    }
  }, [searchParams, setSearchParams]);
  const [stats, setStats] = useState({
    totalPayments: 0,
    totalAmount: 0,
    totalAmountUsd: 0,
    totalAmountInr: 0,
    totalRefunds: 0,
    totalRefundsUsd: 0,
    totalRefundsInr: 0,
    completedPayments: 0,
    pendingPayments: 0,
    failedPayments: 0
  });
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usdPayments, setUsdPayments] = useState([]);
  const [inrPayments, setInrPayments] = useState([]);
  const [allUsdPayments, setAllUsdPayments] = useState([]);
  const [allInrPayments, setAllInrPayments] = useState([]);

  // Pagination states for payment history
  const [usdPaymentsPage, setUsdPaymentsPage] = useState(1);
  const [usdPaymentsTotalPages, setUsdPaymentsTotalPages] = useState(1);
  const [inrPaymentsPage, setInrPaymentsPage] = useState(1);

  const [inrPaymentsTotalPages, setInrPaymentsTotalPages] = useState(1);

  // Share Panel State
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [shareConfig, setShareConfig] = useState({
    url: '',
    title: '',
    description: ''
  });

  // Preview modal states
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [missingPaymentError, setMissingPaymentError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Export password modal states
  const [showExportPasswordModal, setShowExportPasswordModal] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [exportPasswordError, setExportPasswordError] = useState('');
  const [exportPasswordLoading, setExportPasswordLoading] = useState(false);

  // Helper to clear paymentId from URL
  const clearPaymentIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('paymentId')) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  };

  const closePreviewModal = () => {
    setShowPreviewModal(false);
    clearPaymentIdFromUrl();
    setSelectedPayment(null);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get('paymentId');
    const contractId = params.get('contractId');

    if (!paymentId && !contractId) return;

    if (contractId && !paymentId) {
      if (activeTab !== 'history') {
        setActiveTab('history');
      }
      return;
    }

    const findAndOpenPayment = async () => {
      // Switch to history tab if not there
      if (activeTab !== 'history') {
        setActiveTab('history');
      }

      // 1. Try finding in existing loaded payments
      const existingPayment = [...allUsdPayments, ...allInrPayments].find(p => p.paymentId === paymentId);
      if (existingPayment) {
        handlePaymentClick(existingPayment);
        return;
      }

      // 2. If not found, fetch specifically
      try {
        // We use a separate loading indicator or just rely on the main one if appropriate
        // Here we'll use the main one but ensure we don't blocking UI if data is already there? 
        // Actually, preventing interaction while we resolve the link is improved UX.
        setLoading(true);

        // Search in both currencies
        const [usdRes, inrRes] = await Promise.all([
          authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/admin/list?q=${paymentId}&limit=1&currency=USD`),
          authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/admin/list?q=${paymentId}&limit=1&currency=INR`)
        ]);

        const usdData = await usdRes.json();
        const inrData = await inrRes.json();

        let foundPayment = null;
        if (usdRes.ok && usdData.payments && usdData.payments.length > 0 && usdData.payments[0].paymentId === paymentId) {
          foundPayment = usdData.payments[0];
        } else if (inrRes.ok && inrData.payments && inrData.payments.length > 0 && inrData.payments[0].paymentId === paymentId) {
          foundPayment = inrData.payments[0];
        }

        if (foundPayment) {
          handlePaymentClick(foundPayment);
          setMissingPaymentError(null);
        } else {
          setMissingPaymentError(paymentId);
          clearPaymentIdFromUrl();
        }

      } catch (err) {
        console.error("Error fetching specific payment:", err);
        setMissingPaymentError(paymentId);
        clearPaymentIdFromUrl();
      } finally {
        setLoading(false);
      }
    };

    // Only verify if we are not already showing it
    if (!selectedPayment || selectedPayment.paymentId !== paymentId) {
      findAndOpenPayment();
    }
  }, [window.location.search, allUsdPayments.length, allInrPayments.length, activeTab]);

  useEffect(() => {
    fetchPaymentStats();
    fetchAdminPayments();
  }, []);

  // Pagination effect for USD payments
  useEffect(() => {
    const itemsPerPage = 10;
    const totalPages = Math.ceil(allUsdPayments.length / itemsPerPage);
    setUsdPaymentsTotalPages(totalPages);

    const startIndex = (usdPaymentsPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentPageUsdPayments = allUsdPayments.slice(startIndex, endIndex);
    setUsdPayments(currentPageUsdPayments);
  }, [allUsdPayments, usdPaymentsPage]);

  // Pagination effect for INR payments
  useEffect(() => {
    const itemsPerPage = 10;
    const totalPages = Math.ceil(allInrPayments.length / itemsPerPage);
    setInrPaymentsTotalPages(totalPages);

    const startIndex = (inrPaymentsPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentPageInrPayments = allInrPayments.slice(startIndex, endIndex);
    setInrPayments(currentPageInrPayments);
  }, [allInrPayments, inrPaymentsPage]);

  // Listen for payment status updates to refresh stats
  useEffect(() => {
    const handlePaymentStatusUpdate = (event) => {
      const { paymentId, paymentConfirmed, contractId } = event.detail || {};
      if (paymentId || paymentConfirmed) {
        // Refresh stats and payments when payment status changes
        fetchPaymentStats();
        fetchAdminPayments();
      }
    };

    const handleRentalPaymentStatusUpdate = (event) => {
      const { contractId, paymentId, paymentConfirmed } = event.detail || {};
      if (contractId || paymentId || paymentConfirmed) {
        // Refresh stats and payments when rental payment status changes
        fetchPaymentStats();
        fetchAdminPayments();
      }
    };

    // Listen for both payment status events (socket and window events)
    if (socket) {
      socket.on('paymentStatusUpdated', handlePaymentStatusUpdate);
      socket.on('rentalPaymentStatusUpdated', handleRentalPaymentStatusUpdate);
    }

    // Also listen for window custom events
    window.addEventListener('paymentStatusUpdated', handlePaymentStatusUpdate);
    window.addEventListener('rentalPaymentStatusUpdated', handleRentalPaymentStatusUpdate);

    return () => {
      if (socket) {
        socket.off('paymentStatusUpdated', handlePaymentStatusUpdate);
        socket.off('rentalPaymentStatusUpdated', handleRentalPaymentStatusUpdate);
      }
      window.removeEventListener('paymentStatusUpdated', handlePaymentStatusUpdate);
      window.removeEventListener('rentalPaymentStatusUpdated', handleRentalPaymentStatusUpdate);
    };
  }, [socket]);

  const fetchPaymentStats = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/stats/overview`);
      const data = await response.json();
      if (response.ok) {
        setStats(data.overview);
        setMonthlyStats(data.monthlyStats);
      }
    } catch (error) {
      console.error('Error fetching payment stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminPayments = async () => {
    try {
      const statusSel = document.getElementById('admin-pay-status');
      const gatewaySel = document.getElementById('admin-pay-gateway');
      const paymentTypeSel = document.getElementById('admin-pay-paymentType');
      const qSel = document.getElementById('admin-pay-q');
      const fromSel = document.getElementById('admin-pay-from');
      const toSel = document.getElementById('admin-pay-to');
      const status = statusSel ? statusSel.value : '';
      const gateway = gatewaySel ? gatewaySel.value : '';
      const paymentType = paymentTypeSel ? paymentTypeSel.value : '';
      const q = qSel ? qSel.value : '';
      const fromDate = fromSel ? fromSel.value : '';
      const toDate = toSel ? toSel.value : '';
      const urlParams = new URLSearchParams(window.location.search);
      const contractId = urlParams.get('contractId') || '';

      const [usdRes, inrRes] = await Promise.all([
        authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/admin/list?currency=USD&limit=1000&status=${encodeURIComponent(status)}&gateway=${encodeURIComponent(gateway)}&paymentType=${encodeURIComponent(paymentType)}&q=${encodeURIComponent(q)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}${contractId ? `&contractId=${contractId}` : ''}`),
        authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/admin/list?currency=INR&limit=1000&status=${encodeURIComponent(status)}&gateway=${encodeURIComponent(gateway)}&paymentType=${encodeURIComponent(paymentType)}&q=${encodeURIComponent(q)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}${contractId ? `&contractId=${contractId}` : ''}`)
      ]);
      const usdData = await usdRes.json();
      const inrData = await inrRes.json();
      if (usdRes.ok) {
        setAllUsdPayments(usdData.payments || []);
        setUsdPaymentsPage(1); // Reset to first page when filters change
      }
      if (inrRes.ok) {
        setAllInrPayments(inrData.payments || []);
        setInrPaymentsPage(1); // Reset to first page when filters change
      }
    } catch (e) {
      // non-fatal
    }
  };

  const statusBadge = (status) => {
    const cls = status === 'completed' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
      status === 'failed' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' :
        status === 'refunded' || status === 'partially_refunded' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
          'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300';
    return <span className={`px-2 py-1 text-[10px] rounded-full font-semibold ${cls}`}>{status}</span>;
  };

  const handlePaymentClick = (payment) => {
    setSelectedPayment(payment);
    setShowPreviewModal(true);
  };

  const downloadReceipt = async (url) => {
    if (!url) return;
    try {
      const formattedUrl = url.replace(/^https?:\/\/[^\/]+/, import.meta.env.VITE_API_BASE_URL);
      const receiptUrl = formattedUrl.includes('?') ? `${formattedUrl}&admin=true` : `${formattedUrl}?admin=true`;
      const res = await authenticatedFetch(receiptUrl);
      if (!res.ok) return;
      const blob = await res.blob();
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = 'receipt.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objUrl);
      toast.success('Receipt downloaded successfully');
    } catch {
      toast.error('Failed to download receipt');
    }
  };

  const sharePayment = (payment) => {
    const propertyName = payment.appointmentId?.propertyName || 'N/A';
    const amount = `${payment.currency === 'INR' ? '₹' : '$'}${Number(payment.amount).toFixed(2)}`;
    const buyer = payment.userId?.username || 'N/A';
    const status = payment.status.charAt(0).toUpperCase() + payment.status.slice(1);

    const description = `Payment Receipt\nProperty: ${propertyName}\nBuyer: ${buyer}\nAmount: ${amount}\nStatus: ${status}\nPayment ID: ${payment.paymentId}`;
    const shareUrl = window.location.origin + `/admin/payments?paymentId=${payment.paymentId}&tab=payment_history`;

    setShareConfig({
      url: shareUrl,
      title: 'Payment Receipt',
      description: description
    });
    setShowSharePanel(true);
  };

  const copyPaymentLink = (link, details) => {
    const textToCopy = `${details}\n\nLink: ${link}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopySuccess(true);
      toast.success('Payment details copied to clipboard!');
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      toast.error('Failed to copy details');
    });
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FaChartLine },
    { id: 'history', label: 'Payment History', icon: FaCreditCard },
    { id: 'refunds', label: 'Refund Management', icon: FaUndo }
  ];

  if (loading) {
    return <PaymentDashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 py-6 sm:py-10 px-2 md:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                <FaMoneyBill className="text-green-600" />
                Payment Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">Manage payments, refunds, and financial analytics</p>
            </div>
            <button
              onClick={fetchPaymentStats}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-200 dark:shadow-none active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              title="Refresh stats"
            >
              {loading ? (
                <UrbanSetuSpinner size="sm" isBright={true} />
              ) : (
                <FaSync className="text-xs" />
              )}
              <span className="font-bold text-sm tracking-wide">Refresh</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg mb-6 sm:mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex overflow-x-auto no-scrollbar px-2 sm:px-6 gap-4 sm:gap-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      const params = new URLSearchParams(window.location.search.replace(/\?/g, '&').replace(/^&/, '?'));
                      if (tab.id === 'overview') {
                        params.set('tab', 'overview');
                        params.delete('category');
                      } else if (tab.id === 'history') {
                        params.set('tab', 'payment_history');
                        params.delete('category');
                      } else if (tab.id === 'refunds') {
                        params.set('tab', 'refund');
                        if (!params.has('category')) {
                          params.set('category', 'direct');
                        }
                      }
                      setSearchParams(params);
                    }}
                    className={`shrink-0 py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-2 ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                  >
                    <Icon />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
          {activeTab === 'overview' && (
            <div>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mb-8">
                <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm font-medium">Net Revenue (USD)</p>
                      <p className="text-3xl font-bold">${Math.max(0, (stats.totalAmountUsd - stats.totalRefundsUsd)).toLocaleString()}</p>
                    </div>
                    <FaDollarSign className="text-4xl text-green-200" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-emerald-100 text-sm font-medium">Net Revenue (INR)</p>
                      <p className="text-3xl font-bold">₹{Math.max(0, (stats.totalAmountInr - stats.totalRefundsInr)).toLocaleString('en-IN')}</p>
                    </div>
                    <FaCreditCard className="text-4xl text-emerald-200" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium">Total Payments</p>
                      <p className="text-3xl font-bold">{stats.totalPayments}</p>
                    </div>
                    <FaCreditCard className="text-4xl text-blue-200" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm font-medium">Completed Payments</p>
                      <p className="text-3xl font-bold">{stats.completedPayments}</p>
                    </div>
                    <FaCheckCircle className="text-4xl text-purple-200" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-yellow-100 text-sm font-medium">Pending Payments</p>
                      <p className="text-3xl font-bold">{stats.pendingPayments}</p>
                    </div>
                    <FaExclamationTriangle className="text-4xl text-yellow-200" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-100 text-sm font-medium">Failed Payments</p>
                      <p className="text-3xl font-bold">{stats.failedPayments}</p>
                    </div>
                    <FaTimes className="text-4xl text-red-200" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-100 text-sm font-medium">Total Refunds</p>
                      <p className="text-lg font-bold">$ {stats.totalRefundsUsd.toLocaleString()} • ₹ {stats.totalRefundsInr.toLocaleString('en-IN')}</p>
                    </div>
                    <FaUndo className="text-4xl text-orange-200" />
                  </div>
                </div>
              </div>

              {/* Monthly Stats Chart */}
              {monthlyStats.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <FaChartLine className="text-blue-600 dark:text-blue-400" />
                    Monthly Payment Trends (USD & INR)
                  </h3>
                  <div className="space-y-4">
                    {monthlyStats.map((month, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-20 text-sm text-gray-600 dark:text-gray-300">
                            {new Date(month._id.year, month._id.month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          </div>
                          <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-4 relative">
                            <div className="absolute inset-y-0 left-0 flex w-full gap-1 px-1">
                              <div
                                className="h-4 rounded-l-full bg-blue-500 transition-all duration-500"
                                style={{ width: `${Math.min(100, (Math.max(0, ((month.amountUsd || 0) - (month.refundsUsd || 0))) / Math.max(1, ...monthlyStats.map(m => Math.max(0, ((m.amountUsd || 0) - (m.refundsUsd || 0)))))) * 100)}%` }}
                                title={`USD Net: $${Math.max(0, ((month.amountUsd || 0) - (month.refundsUsd || 0))).toLocaleString()}`}
                              />
                              <div
                                className="h-4 rounded-r-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${Math.min(100, (Math.max(0, ((month.amountInr || 0) - (month.refundsInr || 0))) / Math.max(1, ...monthlyStats.map(m => Math.max(0, ((m.amountInr || 0) - (m.refundsInr || 0)))))) * 100)}%` }}
                                title={`INR Net: ₹${Math.max(0, ((month.amountInr || 0) - (month.refundsInr || 0))).toLocaleString('en-IN')}`}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-800 dark:text-gray-200">$ {Math.max(0, ((month.amountUsd || 0) - (month.refundsUsd || 0))).toLocaleString()} • ₹ {Math.max(0, ((month.amountInr || 0) - (month.refundsInr || 0))).toLocaleString('en-IN')}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{month.count} payments</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="mt-8">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                  <button
                    onClick={() => {
                      const params = new URLSearchParams(window.location.search.replace(/\?/g, '&').replace(/^&/, '?'));
                      params.set('tab', 'payment_history');
                      setSearchParams(params);
                    }}
                    className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 p-3 sm:p-4 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-2 sm:gap-3"
                  >
                    <FaCreditCard className="text-lg sm:text-xl" />
                    <div className="text-left">
                      <div className="font-semibold text-sm sm:text-base">View Payment History</div>
                      <div className="text-xs sm:text-sm">Browse all payments</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      const params = new URLSearchParams(window.location.search.replace(/\?/g, '&').replace(/^&/, '?'));
                      params.set('tab', 'refund');
                      params.set('category', 'direct');
                      setSearchParams(params);
                    }}
                    className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 p-3 sm:p-4 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center gap-2 sm:gap-3"
                  >
                    <FaUndo className="text-lg sm:text-xl" />
                    <div className="text-left">
                      <div className="font-semibold text-sm sm:text-base">Manage Refunds</div>
                      <div className="text-xs sm:text-sm">Process refunds</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowExportPasswordModal(true);
                      setExportPassword('');
                      setExportPasswordError('');
                    }}
                    className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 p-3 sm:p-4 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors flex items-center gap-2 sm:gap-3"
                    title="Export CSV of payments"
                  >
                    <FaDownload className="text-lg sm:text-xl" />
                    <div className="text-left">
                      <div className="font-semibold text-sm sm:text-base">Export Reports</div>
                      <div className="text-xs sm:text-sm">Download financial reports</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-3">
                {new URLSearchParams(window.location.search).get('contractId') && (
                  <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-2 rounded-xl text-xs font-bold border border-indigo-100 dark:border-indigo-800 animate-in fade-in slide-in-from-left-2 shadow-sm">
                    <FaWallet className="text-sm" />
                    <span>Contract Audit: {new URLSearchParams(window.location.search).get('contractId')}</span>
                    <button
                      onClick={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.delete('contractId');
                        navigate(url.pathname + url.search);
                        fetchAdminPayments();
                      }}
                      className="ml-2 bg-white dark:bg-gray-800 p-1 rounded-full hover:bg-white/80 dark:hover:bg-gray-700 transition-all text-indigo-500 shadow-sm"
                      title="Clear Contract Filter"
                    >
                      <FaTimes />
                    </button>
                  </div>
                )}
                {new URLSearchParams(window.location.search).get('paymentId') && (
                  <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-2 rounded-xl text-xs font-bold border border-purple-100 dark:border-purple-800 animate-in fade-in slide-in-from-left-2 shadow-sm">
                    <FaCreditCard className="text-sm" />
                    <span>Focus Payment: {new URLSearchParams(window.location.search).get('paymentId')}</span>
                    <button
                      onClick={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.delete('paymentId');
                        navigate(url.pathname + url.search);
                        fetchAdminPayments();
                      }}
                      className="ml-2 bg-white dark:bg-gray-800 p-1 rounded-full hover:bg-white/80 dark:hover:bg-gray-700 transition-all text-purple-500 shadow-sm"
                      title="Clear Payment Highlight"
                    >
                      <FaTimes />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-4 items-end">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Search</label>
                  <input id="admin-pay-q" placeholder="Payment ID, receipt..." className="px-3 py-2 border dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm w-full h-[38px]" onChange={async () => { setUsdPaymentsPage(1); setInrPaymentsPage(1); await fetchAdminPayments(); }} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">From</label>
                  <input id="admin-pay-from" type="date" max={new Date().toISOString().split('T')[0]} className="px-3 py-2 border dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm w-full h-[38px]" onChange={async () => { setUsdPaymentsPage(1); setInrPaymentsPage(1); await fetchAdminPayments(); }} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">To</label>
                  <input id="admin-pay-to" type="date" max={new Date().toISOString().split('T')[0]} className="px-3 py-2 border dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm w-full h-[38px]" onChange={async () => { setUsdPaymentsPage(1); setInrPaymentsPage(1); await fetchAdminPayments(); }} />
                </div>

                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Status</label>
                  <select id="admin-pay-status" onChange={async () => { setUsdPaymentsPage(1); setInrPaymentsPage(1); await fetchAdminPayments(); }} className="px-3 py-2 border dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm w-full h-[38px]">
                    <option value="">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                    <option value="partially_refunded">Partially Refunded</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Gateway</label>
                  <select id="admin-pay-gateway" onChange={async () => { setUsdPaymentsPage(1); setInrPaymentsPage(1); await fetchAdminPayments(); }} className="px-3 py-2 border dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm w-full h-[38px]">
                    <option value="">All Gateways</option>
                    <option value="paypal">PayPal</option>
                    <option value="razorpay">Razorpay</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Type</label>
                  <select id="admin-pay-paymentType" onChange={async () => { setUsdPaymentsPage(1); setInrPaymentsPage(1); await fetchAdminPayments(); }} className="px-3 py-2 border dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm w-full h-[38px]">
                    <option value="">All Types</option>
                    <option value="advance">Advance Payment</option>
                    <option value="monthly_rent">Monthly Rent</option>
                    <option value="security_deposit">Security Deposit</option>
                    <option value="booking_fee">Booking Fee</option>
                  </select>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">USD Payments ($)</h3>
                {usdPayments.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    <FaMoneyBill className="text-4xl text-gray-300 mx-auto mb-2" />
                    <div>No USD payments found.</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {usdPayments.map((p) => (
                      <div key={p._id} className={`border dark:border-gray-700 rounded-lg p-4 cursor-pointer ${p.status === 'completed' ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800' :
                        p.status === 'failed' ? 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800' :
                          p.status === 'refunded' || p.status === 'partially_refunded' ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800' :
                            'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800'
                        } hover:shadow-lg transition-all`} onClick={() => handlePaymentClick(p)}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-800 dark:text-white flex items-center gap-2 flex-wrap">
                              {p.appointmentId?.propertyName || 'Property Payment'}
                              {p.paymentType && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.paymentType === 'monthly_rent' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                                  p.paymentType === 'advance' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                                    p.paymentType === 'security_deposit' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' :
                                      'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                  }`}>
                                  {p.paymentType === 'monthly_rent' ? 'Rent' :
                                    p.paymentType === 'advance' ? 'Advance' :
                                      p.paymentType === 'security_deposit' ? 'Security Deposit' :
                                        p.paymentType?.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-2 mt-1">
                              <span>Buyer: {p.userId?.username || 'N/A'}</span>
                              {p.paymentType === 'monthly_rent' && p.rentMonth && p.rentYear && (
                                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                  {new Date(p.rentYear, p.rentMonth - 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                                </span>
                              )}
                              {p.escrowStatus && (
                                <span className={`px-2 py-0.5 rounded-full ${p.escrowStatus === 'released' ? 'bg-green-100 text-green-700' :
                                  p.escrowStatus === 'held' ? 'bg-orange-100 text-orange-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                  Escrow: {p.escrowStatus}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col sm:items-end gap-2">
                            <div className="text-lg font-bold dark:text-white">$ {Number(p.amount).toFixed(2)}</div>
                            {p.refundAmount > 0 && (
                              <div className="text-sm text-red-600 dark:text-red-400 font-semibold">
                                Refunded: $ {Number(p.refundAmount).toFixed(2)}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                              {p.completedAt ? (
                                <div className="text-right">
                                  <div className="font-medium">Paid: {new Date(p.completedAt).toLocaleDateString('en-GB')}</div>
                                  <div className="text-gray-400 dark:text-gray-500">{new Date(p.completedAt).toLocaleTimeString('en-GB')}</div>
                                  <div className="text-gray-300 dark:text-gray-500 mt-1">Created: {new Date(p.createdAt).toLocaleDateString('en-GB')}</div>
                                  <div className="text-gray-300 dark:text-gray-500">{new Date(p.createdAt).toLocaleTimeString('en-GB')}</div>
                                  {p.refundedAt && (
                                    <>
                                      <div className="text-red-400 mt-1">Refunded: {new Date(p.refundedAt).toLocaleDateString('en-GB')}</div>
                                      <div className="text-red-300">{new Date(p.refundedAt).toLocaleTimeString('en-GB')}</div>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="text-right">
                                  <div className="font-medium">Created: {new Date(p.createdAt).toLocaleDateString('en-GB')}</div>
                                  <div className="text-gray-400 dark:text-gray-500">{new Date(p.createdAt).toLocaleTimeString('en-GB')}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2">
                          <span className={`px-2 py-1 text-[10px] rounded-full font-semibold ${p.status === 'completed' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : p.status === 'failed' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' : p.status === 'refunded' || p.status === 'partially_refunded' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300'}`}>
                            {p.status}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">Payment ID: <span className="font-mono">{p.paymentId}</span></div>
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">Gateway: {p.gateway?.toUpperCase()}</div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          {p.receiptUrl && (
                            <button
                              onClick={async () => {
                                downloadReceipt(p.receiptUrl);
                              }}
                              className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 text-xs flex items-center gap-1"
                            >
                              <FaDownload className="text-xs" /> Receipt
                            </button>
                          )}
                          <button
                            onClick={() => sharePayment(p)}
                            className="px-3 py-1 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 text-xs flex items-center gap-1"
                          >
                            <FaShare className="text-xs" /> Share
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* USD Payments Pagination */}
                {allUsdPayments.length > 10 && usdPaymentsTotalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-2">
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      Page {usdPaymentsPage} of {usdPaymentsTotalPages}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => {
                          setUsdPaymentsPage(Math.max(1, usdPaymentsPage - 1));
                          toast.info(`Navigated to page ${Math.max(1, usdPaymentsPage - 1)}`);
                        }}
                        disabled={usdPaymentsPage === 1}
                        className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => {
                          setUsdPaymentsPage(Math.min(usdPaymentsTotalPages, usdPaymentsPage + 1));
                          toast.info(`Navigated to page ${Math.min(usdPaymentsTotalPages, usdPaymentsPage + 1)}`);
                        }}
                        disabled={usdPaymentsPage === usdPaymentsTotalPages}
                        className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">INR Payments (₹)</h3>
                {inrPayments.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    <FaMoneyBill className="text-4xl text-gray-300 mx-auto mb-2" />
                    <div>No INR payments found.</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inrPayments.map((p) => (
                      <div key={p._id} className={`border dark:border-gray-700 rounded-lg p-4 cursor-pointer ${p.status === 'completed' ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800' :
                        p.status === 'failed' ? 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800' :
                          p.status === 'refunded' || p.status === 'partially_refunded' ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800' :
                            'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800'
                        } hover:shadow-lg transition-all`} onClick={() => handlePaymentClick(p)}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-800 dark:text-white flex items-center gap-2 flex-wrap">
                              {p.appointmentId?.propertyName || 'Property Payment'}
                              {p.paymentType && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.paymentType === 'monthly_rent' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                                  p.paymentType === 'advance' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                                    p.paymentType === 'security_deposit' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' :
                                      'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                  }`}>
                                  {p.paymentType === 'monthly_rent' ? 'Rent' :
                                    p.paymentType === 'advance' ? 'Advance' :
                                      p.paymentType === 'security_deposit' ? 'Security Deposit' :
                                        p.paymentType?.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-2 mt-1">
                              <span>Buyer: {p.userId?.username || 'N/A'}</span>
                              {p.paymentType === 'monthly_rent' && p.rentMonth && p.rentYear && (
                                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                  {new Date(p.rentYear, p.rentMonth - 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                                </span>
                              )}
                              {p.escrowStatus && (
                                <span className={`px-2 py-0.5 rounded-full ${p.escrowStatus === 'released' ? 'bg-green-100 text-green-700' :
                                  p.escrowStatus === 'held' ? 'bg-orange-100 text-orange-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                  Escrow: {p.escrowStatus}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col sm:items-end gap-2">
                            <div className="text-lg font-bold dark:text-white">₹ {Number(p.amount).toFixed(2)}</div>
                            {p.refundAmount > 0 && (
                              <div className="text-sm text-red-600 dark:text-red-400 font-semibold">
                                Refunded: ₹ {Number(p.refundAmount).toFixed(2)}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                              {p.completedAt ? (
                                <div className="text-right">
                                  <div className="font-medium">Paid: {new Date(p.completedAt).toLocaleDateString('en-GB')}</div>
                                  <div className="text-gray-400 dark:text-gray-500">{new Date(p.completedAt).toLocaleTimeString('en-GB')}</div>
                                  <div className="text-gray-300 dark:text-gray-500 mt-1">Created: {new Date(p.createdAt).toLocaleDateString('en-GB')}</div>
                                  <div className="text-gray-300 dark:text-gray-500">{new Date(p.createdAt).toLocaleTimeString('en-GB')}</div>
                                  {p.refundedAt && (
                                    <>
                                      <div className="text-red-400 mt-1">Refunded: {new Date(p.refundedAt).toLocaleDateString('en-GB')}</div>
                                      <div className="text-red-300">{new Date(p.refundedAt).toLocaleTimeString('en-GB')}</div>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="text-right">
                                  <div className="font-medium">Created: {new Date(p.createdAt).toLocaleDateString('en-GB')}</div>
                                  <div className="text-gray-400 dark:text-gray-500">{new Date(p.createdAt).toLocaleTimeString('en-GB')}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2">
                          <span className={`px-2 py-1 text-[10px] rounded-full font-semibold ${p.status === 'completed' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : p.status === 'failed' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' : p.status === 'refunded' || p.status === 'partially_refunded' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300'}`}>
                            {p.status}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">Payment ID: <span className="font-mono">{p.paymentId}</span></div>
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">Gateway: {p.gateway?.toUpperCase()}</div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          {p.receiptUrl && (
                            <button
                              onClick={async () => {
                                downloadReceipt(p.receiptUrl);
                              }}
                              className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 text-xs flex items-center gap-1"
                            >
                              <FaDownload className="text-xs" /> Receipt
                            </button>
                          )}
                          <button
                            onClick={() => sharePayment(p)}
                            className="px-3 py-1 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 text-xs flex items-center gap-1"
                          >
                            <FaShare className="text-xs" /> Share
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* INR Payments Pagination */}
                {allInrPayments.length > 10 && inrPaymentsTotalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-2">
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      Page {inrPaymentsPage} of {inrPaymentsTotalPages}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => {
                          setInrPaymentsPage(Math.max(1, inrPaymentsPage - 1));
                          toast.info(`Navigated to page ${Math.max(1, inrPaymentsPage - 1)}`);
                        }}
                        disabled={inrPaymentsPage === 1}
                        className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => {
                          setInrPaymentsPage(Math.min(inrPaymentsTotalPages, inrPaymentsPage + 1));
                          toast.info(`Navigated to page ${Math.min(inrPaymentsTotalPages, inrPaymentsPage + 1)}`);
                        }}
                        disabled={inrPaymentsPage === inrPaymentsTotalPages}
                        className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'refunds' && (
            <RefundManagement onRefundProcessed={fetchPaymentStats} />
          )}
        </div>
      </div>

      {/* Payment Preview Modal */}
      {showPreviewModal && selectedPayment && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50" onClick={closePreviewModal}>
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full relative" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10 p-4 sm:p-6 pb-3 sm:pb-4 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <FaEye className="text-blue-600" />
                    Payment Details
                  </h3>
                  <button
                    onClick={closePreviewModal}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors bg-gray-100 dark:bg-gray-700 rounded-full p-2"
                  >
                    <FaTimes className="text-xl" />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 space-y-6">
                {/* Payment Overview */}
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 sm:p-6 border border-blue-200 dark:border-blue-900">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white break-words">{selectedPayment.appointmentId?.propertyName || 'Property Payment'}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Buyer: {selectedPayment.userId?.username || 'N/A'}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-all">Payment ID: <span className="font-mono text-xs">{selectedPayment.paymentId}</span></p>
                    </div>
                    <div className="text-left sm:text-right flex-shrink-0">
                      <div className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 break-words">
                        {selectedPayment.currency === 'INR' ? '₹' : '$'}{Number(selectedPayment.amount).toFixed(2)}
                      </div>
                      <div className="mt-2">{statusBadge(selectedPayment.status)}</div>
                    </div>
                  </div>
                </div>

                {/* Payment Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Payment Type</div>
                    <div className="font-semibold text-gray-800 dark:text-white">
                      {selectedPayment.paymentType ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${selectedPayment.paymentType === 'monthly_rent' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                          selectedPayment.paymentType === 'advance' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                            selectedPayment.paymentType === 'security_deposit' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' :
                              'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}>
                          {selectedPayment.paymentType === 'monthly_rent' ? 'Monthly Rent' :
                            selectedPayment.paymentType === 'advance' ? 'Advance Payment' :
                              selectedPayment.paymentType === 'security_deposit' ? 'Security Deposit' :
                                selectedPayment.paymentType?.replace('_', ' ')}
                        </span>
                      ) : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Gateway</div>
                    <div className="font-semibold text-gray-800 dark:text-white">{selectedPayment.gateway?.toUpperCase() || 'N/A'}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Currency</div>
                    <div className="font-semibold text-gray-800 dark:text-white">{selectedPayment.currency || 'N/A'}</div>
                  </div>
                  {selectedPayment.paymentType === 'monthly_rent' && selectedPayment.rentMonth && selectedPayment.rentYear && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-4">
                      <div className="text-sm text-indigo-600 dark:text-indigo-300 mb-1">Rent Period</div>
                      <div className="font-semibold text-indigo-800 dark:text-indigo-200">
                        {new Date(selectedPayment.rentYear, selectedPayment.rentMonth - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                  )}
                  {selectedPayment.escrowStatus && (
                    <div className={`rounded-lg p-4 ${selectedPayment.escrowStatus === 'released' ? 'bg-green-50 dark:bg-green-900/30' :
                      selectedPayment.escrowStatus === 'held' ? 'bg-orange-50 dark:bg-orange-900/30' :
                        'bg-gray-50 dark:bg-gray-700/50'
                      }`}>
                      <div className={`text-sm mb-1 ${selectedPayment.escrowStatus === 'released' ? 'text-green-600 dark:text-green-400' :
                        selectedPayment.escrowStatus === 'held' ? 'text-orange-600 dark:text-orange-400' :
                          'text-gray-600 dark:text-gray-400'
                        }`}>Escrow Status</div>
                      <div className={`font-semibold ${selectedPayment.escrowStatus === 'released' ? 'text-green-800 dark:text-green-200' :
                        selectedPayment.escrowStatus === 'held' ? 'text-orange-800 dark:text-orange-200' :
                          'text-gray-800 dark:text-gray-200'
                        }`}>{selectedPayment.escrowStatus.charAt(0).toUpperCase() + selectedPayment.escrowStatus.slice(1)}</div>
                      {selectedPayment.escrowReleasedAt && (
                        <div className="text-xs text-gray-500 mt-1">
                          Released: {new Date(selectedPayment.escrowReleasedAt).toLocaleDateString('en-GB')}
                        </div>
                      )}
                    </div>
                  )}
                  {selectedPayment.completedAt && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Paid Date</div>
                      <div className="font-semibold text-gray-800 dark:text-white">
                        {new Date(selectedPayment.completedAt).toLocaleDateString('en-GB', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {new Date(selectedPayment.completedAt).toLocaleTimeString('en-GB')}
                      </div>
                    </div>
                  )}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Created Date</div>
                    <div className="font-semibold text-gray-800 dark:text-white">
                      {new Date(selectedPayment.createdAt).toLocaleDateString('en-GB', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {new Date(selectedPayment.createdAt).toLocaleTimeString('en-GB')}
                    </div>
                  </div>
                  {selectedPayment.refundedAt && (
                    <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4">
                      <div className="text-sm text-red-600 dark:text-red-400 mb-1">Refunded Date</div>
                      <div className="font-semibold text-red-800 dark:text-red-200">
                        {new Date(selectedPayment.refundedAt).toLocaleDateString('en-GB', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                      <div className="text-xs text-red-500 dark:text-red-400/70 mt-1">
                        {new Date(selectedPayment.refundedAt).toLocaleTimeString('en-GB')}
                      </div>
                    </div>
                  )}
                  {selectedPayment.refundAmount > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4">
                      <div className="text-sm text-red-600 dark:text-red-400 mb-1">Refund Amount</div>
                      <div className="font-semibold text-red-800 dark:text-red-200">
                        {selectedPayment.currency === 'INR' ? '₹' : '$'}{Number(selectedPayment.refundAmount).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {selectedPayment.receiptUrl && (
                    <button
                      onClick={() => {
                        downloadReceipt(selectedPayment.receiptUrl);
                        closePreviewModal();
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <FaDownload /> Download Receipt
                    </button>
                  )}
                  <button
                    onClick={() => {
                      sharePayment(selectedPayment);
                      closePreviewModal();
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                  >
                    <FaShare /> Share Payment
                  </button>
                  <button
                    onClick={() => {
                      copyPaymentLink(
                        window.location.origin + `/admin/payments?paymentId=${selectedPayment.paymentId}&tab=payment_history`,
                        `Payment Details:\nProperty: ${selectedPayment.appointmentId?.propertyName || 'N/A'}\nBuyer: ${selectedPayment.userId?.username || 'N/A'}\nAmount: ${selectedPayment.currency === 'INR' ? '₹' : '$'}{Number(selectedPayment.amount).toFixed(2)}\nStatus: ${selectedPayment.status}\nPayment ID: ${selectedPayment.paymentId}`
                      );
                    }}
                    className={`px-4 py-2 text-white rounded-lg transition-all duration-300 flex items-center gap-2 ${copySuccess ? 'bg-green-600' : 'bg-gray-600 hover:bg-gray-700'}`}
                  >
                    {copySuccess ? <FaCheck /> : <FaCopy />} {copySuccess ? 'Copied' : 'Copy Details'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExportPasswordModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-300">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Confirm Export</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 font-medium">Please enter your administrator password to download the full payment report.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleExportConfirm();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest mb-2">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <FaLock />
                  </div>
                  <input
                    type="password"
                    value={exportPassword}
                    onChange={(e) => setExportPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white font-bold"
                    required
                    autoFocus
                  />
                </div>
                {exportPasswordError && (
                  <p className="mt-2 text-sm text-red-600 font-bold flex items-center gap-2">
                    <FaExclamationTriangle /> {exportPasswordError}
                  </p>
                )}
              </div>
              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  className="flex-1 py-3 text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
                  onClick={() => {
                    setShowExportPasswordModal(false);
                    setExportPassword("");
                    setExportPasswordError("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95"
                  disabled={exportPasswordLoading}
                >
                  {exportPasswordLoading ? <UrbanSetuSpinner size="xs" isBright={true} /> : 'Download CSV'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <SocialSharePanel
        isOpen={showSharePanel}
        onClose={() => setShowSharePanel(false)}
        url={shareConfig.url}
        title={shareConfig.title}
        description={shareConfig.description}
      />

      {/* Missing Payment Error Modal */}
      {missingPaymentError && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 transform transition-all scale-100 border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                <FaExclamationTriangle className="text-red-600 dark:text-red-400 text-3xl" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Payment Not Found</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                We couldn't find any payment history for ID: <span className="font-mono text-purple-600 dark:text-purple-400 break-all">{missingPaymentError}</span>.
                This payment might not exist or may have been deleted.
              </p>
              <button
                onClick={() => setMissingPaymentError(null)}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95"
              >
                Go Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentDashboard;
