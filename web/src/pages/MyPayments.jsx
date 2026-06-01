import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { FaDollarSign, FaCreditCard, FaDownload, FaCheck, FaClock, FaCheckCircle, FaTimes, FaExclamationTriangle, FaMoneyBill, FaLock, FaShare, FaCopy, FaEye, FaExternalLinkAlt, FaCalendar, FaSync, FaWallet, FaHome, FaKey } from 'react-icons/fa';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import { signoutUserStart, signoutUserSuccess, signoutUserFailure } from '../redux/user/userSlice';
import { toast } from 'react-toastify';
// import axios from 'axios'; // Removed as authenticatedFetch is used
import PaymentModal from '../components/PaymentModal';
import MyPaymentsSkeleton from '../components/skeletons/MyPaymentsSkeleton';
import SocialSharePanel from '../components/SocialSharePanel';
import { authenticatedFetch } from '../utils/auth';

import { usePageTitle } from '../hooks/usePageTitle';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const MyPayments = () => {
  // Set page title
  usePageTitle("My Payments - Payment History");

  const { currentUser } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', gateway: '', currency: '', paymentType: '', q: '', fromDate: '', toDate: '' });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Preview modal states
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Payment modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAppointment, setPaymentAppointment] = useState(null);
  const [loadingPaymentId, setLoadingPaymentId] = useState(null); // Track which payment is loading
  const [missingPaymentError, setMissingPaymentError] = useState(null);

  // Export password modal states
  const [showExportPasswordModal, setShowExportPasswordModal] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [exportPasswordError, setExportPasswordError] = useState('');
  const [exportPasswordLoading, setExportPasswordLoading] = useState(false);

  // Share Panel State
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [shareConfig, setShareConfig] = useState({
    url: '',
    title: '',
    description: ''
  });

  // Helper to clear paymentId from URL
  const clearPaymentIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('paymentId')) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
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

  const closePreviewModal = () => {
    setShowPreviewModal(false);
    clearPaymentIdFromUrl();
    setSelectedPayment(null);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get('paymentId');

    if (!paymentId) return;

    const findAndOpenPayment = async () => {
      // 1. Try finding in existing loaded payments
      const existingPayment = allPayments.find(p => p.paymentId === paymentId);
      if (existingPayment) {
        handlePaymentClick(existingPayment);
        return;
      }

      // 2. If not found, ignore if loading (will retry when loading finishes)
      // But if we have finished loading and it's not there, or if we haven't loaded yet,
      // we might want to fetch specifically to be robust (e.g. duplicate logic from MyAppointments resolveChatRoute).
      // However, for payments, typically fetchPayments fetches *all* or specific pages.
      // Let's rely on a specific fetch to be safe, similar to MyAppointments.
      try {
        setLoading(true);
        const res = await authenticatedFetch(`${API_BASE_URL}/api/payments/history?paymentId=${paymentId}`);
        const data = await res.json();

        if (res.ok && data.payments && data.payments.length > 0) {
          // Strictly find the matching payment since the API might return a list
          const fetchedPayment = data.payments.find(p => p.paymentId === paymentId);

          if (fetchedPayment) {
            // Add to allPayments if not present to avoid potential issues
            setAllPayments(prev => {
              const exists = prev.some(p => p._id === fetchedPayment._id);
              return exists ? prev : [fetchedPayment, ...prev];
            });
            handlePaymentClick(fetchedPayment);
            setMissingPaymentError(null);
          } else {
            setMissingPaymentError(paymentId);
            clearPaymentIdFromUrl();
          }
        } else {
          // Not found
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

  }, [window.location.search, allPayments.length]); // depend on search params and list length

  // We need to fetch initial payments regardless
  useEffect(() => { fetchPayments(); }, [filters]);

  // Listen for payment status updates
  useEffect(() => {
    const handlePaymentUpdate = (event) => {
      const { paymentId, paymentConfirmed, contractId } = event.detail || {};
      if (paymentId || paymentConfirmed) {
        // Refresh payments when payment status is updated
        fetchPayments();
      }
    };

    // Listen for both payment status events
    window.addEventListener('paymentStatusUpdated', handlePaymentUpdate);
    window.addEventListener('rentalPaymentStatusUpdated', handlePaymentUpdate);

    return () => {
      window.removeEventListener('paymentStatusUpdated', handlePaymentUpdate);
      window.removeEventListener('rentalPaymentStatusUpdated', handlePaymentUpdate);
    };
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.gateway) params.set('gateway', filters.gateway);
      if (filters.currency) params.set('currency', filters.currency);
      if (filters.paymentType) params.set('paymentType', filters.paymentType);
      if (filters.q) params.set('q', filters.q);
      if (filters.fromDate) params.set('fromDate', filters.fromDate);
      if (filters.toDate) params.set('toDate', filters.toDate);
      // Show all payments (high cap)
      params.set('limit', '1000');
      const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/history?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setAllPayments(data.payments || []);
        setCurrentPage(1); // Reset to first page when filters change
      }
    } catch { }
    finally { setLoading(false); }
  };

  // Pagination effect with duplicate payment filtering
  useEffect(() => {
    // First pass: Group payments by appointment ID
    const paymentsByAppointment = {};
    allPayments.forEach(payment => {
      const appointmentId = payment.appointmentId?._id || payment.appointmentId;
      if (!appointmentId) {
        // If no appointment ID, add to a special group
        if (!paymentsByAppointment['no-appointment']) {
          paymentsByAppointment['no-appointment'] = [];
        }
        paymentsByAppointment['no-appointment'].push(payment);
        return;
      }

      if (!paymentsByAppointment[appointmentId]) {
        paymentsByAppointment[appointmentId] = [];
      }
      paymentsByAppointment[appointmentId].push(payment);
    });

    // Second pass: Filter payments per appointment
    const filteredPayments = [];

    Object.keys(paymentsByAppointment).forEach(key => {
      const appointmentPayments = paymentsByAppointment[key];

      // For payments without appointment ID, include all
      if (key === 'no-appointment') {
        filteredPayments.push(...appointmentPayments);
        return;
      }

      // Check if there's a completed payment for this appointment
      const hasCompleted = appointmentPayments.some(p => p.status === 'completed');

      if (hasCompleted) {
        // If there's a completed payment, only include completed, failed, refunded payments
        // Remove all pending/processing/cancelled payments
        appointmentPayments.forEach(payment => {
          if (payment.status === 'completed' || payment.status === 'failed' ||
            payment.status === 'refunded' || payment.status === 'partially_refunded') {
            filteredPayments.push(payment);
          }
          // Skip pending/processing/cancelled payments when there's a completed payment
        });
      } else {
        // No completed payment - include failed, refunded, and only the most recent pending/processing
        // Exclude cancelled payments from display
        const completedOrFailed = appointmentPayments.filter(p =>
          p.status === 'failed' || p.status === 'refunded' || p.status === 'partially_refunded'
        );
        filteredPayments.push(...completedOrFailed);

        // For pending/processing, keep only the most recent one (exclude cancelled)
        const pendingPayments = appointmentPayments.filter(p =>
          (p.status === 'pending' || p.status === 'processing') && p.status !== 'cancelled'
        );
        if (pendingPayments.length > 0) {
          // Sort by createdAt descending and take the first (most recent)
          const mostRecentPending = pendingPayments.sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
          )[0];
          filteredPayments.push(mostRecentPending);
        }
      }
    });

    // Sort all payments by createdAt descending (most recent first)
    filteredPayments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const itemsPerPage = 10;
    const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
    setTotalPages(totalPages);

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentPagePayments = filteredPayments.slice(startIndex, endIndex);
    setPayments(currentPagePayments);
  }, [allPayments, currentPage]);

  const payNow = async (payment) => {
    if (!payment || !payment.appointmentId) return;

    try {
      // Track which payment is loading
      setLoadingPaymentId(payment._id);

      // Extract appointment ID (could be object or string)
      const appointmentId = payment.appointmentId?._id || payment.appointmentId;
      if (!appointmentId) {
        toast.error('Appointment ID not found');
        setLoadingPaymentId(null);
        return;
      }

      // Check if payment is already completed before proceeding
      try {
        const paymentCheckRes = await authenticatedFetch(`${API_BASE_URL}/api/payments/history?appointmentId=${appointmentId}`);
        const paymentCheckData = await paymentCheckRes.json();

        if (paymentCheckRes.ok && paymentCheckData.payments && paymentCheckData.payments.length > 0) {
          const latestPayment = paymentCheckData.payments[0];

          // Check if payment is already completed
          if (latestPayment.status === 'completed' || latestPayment.metadata?.adminMarked) {
            toast.success('Payment already completed!');
            // Refresh payments to show updated status
            await fetchPayments();
            // Dispatch event to update MyAppointments page if it's open
            window.dispatchEvent(new CustomEvent('paymentStatusUpdated', {
              detail: {
                appointmentId: appointmentId,
                paymentConfirmed: true
              }
            }));
            setLoadingPaymentId(null);
            return;
          }

          // Check for active (pending/processing) payments that are NOT cancelled
          const activePayment = paymentCheckData.payments.find(p =>
            (p.status === 'pending' || p.status === 'processing') &&
            p.status !== 'cancelled'
          );

          if (activePayment) {
            // Check if another tab/window/browser has the payment modal open using backend lock
            try {
              const lockCheckResponse = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/lock/check/${appointmentId}`);

              const lockCheckData = await lockCheckResponse.json();

              if (lockCheckData.ok && lockCheckData.locked === true && !lockCheckData.ownedByUser) {
                // Another browser/device has the payment modal open
                toast.warning(lockCheckData.message || 'A payment session is already open for this appointment in another browser/device. Please close that browser/device first before opening a new payment session.');
                setLoadingPaymentId(null);
                return;
              }

              // Also check localStorage for same-browser detection (fallback)
              const lockKey = `payment_lock_${appointmentId}`;
              const lockData = localStorage.getItem(lockKey);

              if (lockData) {
                try {
                  const { tabId: ownerTabId, timestamp } = JSON.parse(lockData);
                  const currentTabId = sessionStorage.getItem('paymentTabId');
                  const now = Date.now();

                  // If lock is not stale (less than 5 seconds old) and owned by another tab
                  if (now - timestamp <= 5000 && ownerTabId !== currentTabId) {
                    toast.warning('A payment session is already open for this appointment in another tab. Please close that tab first before opening a new payment session.');
                    setLoadingPaymentId(null);
                    return;
                  }
                } catch (e) {
                  // Invalid lock data, ignore
                }
              }
            } catch (lockCheckError) {
              console.error('Error checking payment lock:', lockCheckError);
              // If lock check fails, continue (allow opening modal as fallback)
            }

            // Check if the active payment has expired
            const now = new Date();
            const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
            let isExpired = false;

            if (activePayment.expiresAt) {
              const expiresAt = new Date(activePayment.expiresAt);
              isExpired = expiresAt <= now;
            } else if (activePayment.createdAt) {
              const createdAt = new Date(activePayment.createdAt);
              isExpired = createdAt <= tenMinutesAgo;
            }

            if (isExpired) {
              // Payment expired, allow opening modal (will create new payment)
              toast.info('Previous payment session expired. Opening a new payment session.');
            } else {
              // Payment not expired, allow opening modal (will create new payment ID)
              // Since each payment attempt creates a new payment ID, no need to show "resuming" message
            }
            // Continue to open modal - backend will handle creating new payment
          }

          // If latest payment is cancelled, failed, or expired, show appropriate message and allow retry
          if (latestPayment.status === 'cancelled' && !activePayment) {
            toast.info('Previous payment was cancelled. You can initiate a new payment.');
          } else if (latestPayment.status === 'failed' && !activePayment) {
            toast.info('Previous payment failed. You can retry the payment.');
          }
        }
      } catch (paymentCheckError) {
        console.error('Error checking payment status:', paymentCheckError);
        // Continue with payment flow if check fails
      }

      // Fetch appointment details - API returns the booking object directly (not wrapped)
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appointmentId}`);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to load appointment' }));
        toast.error(errorData.message || 'Failed to load appointment details');
        setLoadingPaymentId(null);
        return;
      }

      // API returns booking object directly, not wrapped in { success, appointment }
      const appointment = await res.json();

      if (!appointment || !appointment._id) {
        toast.error('Appointment not found');
        setLoadingPaymentId(null);
        return;
      }

      // Initialize appointment lock before opening modal (timer is tied to appointment slot, not payment ID)
      try {
        const lockInitResponse = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/lock/initialize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ appointmentId: appointment._id })
        });

        if (lockInitResponse.ok) {
          const lockData = await lockInitResponse.json();
          // Update appointment with lock info if provided
          if (lockData.appointment) {
            appointment.lockStartTime = lockData.appointment.lockStartTime;
            appointment.lockExpiryTime = lockData.appointment.lockExpiryTime;
          }
        }
      } catch (lockError) {
        console.error('Error initializing appointment lock:', lockError);
        // Continue anyway - backend will initialize lock when creating payment intent
      }

      // Prepare appointment object for PaymentModal (same format as MyAppointments)
      // PaymentModal expects appointment with region field
      const appointmentForModal = {
        ...appointment,
        region: appointment.region || 'india' // Default to 'india' if not specified
      };

      setPaymentAppointment(appointmentForModal);
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Error fetching appointment:', error);
      toast.error('Failed to load appointment details');
      // Note: We can't open modal on error here because we need to fetch appointment first
      // This is different from MyAppointments where appointment is already available as prop
    } finally {
      setLoadingPaymentId(null);
    }
  };

  const goToAppointment = (payment) => {
    if (!payment || !payment.appointmentId) return;

    // Extract appointment ID (could be object or string)
    const appointmentId = payment.appointmentId?._id || payment.appointmentId;
    if (!appointmentId) return;

    // Navigate to MyAppointments and dispatch custom event to highlight the appointment
    navigate('/user/my-appointments', {
      state: { highlightAppointmentId: appointmentId }
    });

    // Also dispatch a custom event for immediate highlighting if already on the page
    window.dispatchEvent(new CustomEvent('highlightAppointment', {
      detail: { appointmentId: appointmentId }
    }));
  };

  const downloadReceipt = async (url) => {
    if (!url) return;
    try {
      const formattedUrl = url.replace(/^https?:\/\/[^\/]+/, import.meta.env.VITE_API_BASE_URL);
      const res = await authenticatedFetch(formattedUrl);
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

  const handlePaymentClick = (payment) => {
    setSelectedPayment(payment);
    setShowPreviewModal(true);
  };

  const sharePayment = (payment) => {
    const propertyName = payment.appointmentId?.propertyName || 'N/A';
    const amount = `${payment.currency === 'INR' ? '₹' : '$'}${Number(payment.amount).toFixed(2)}`;
    const status = payment.status.charAt(0).toUpperCase() + payment.status.slice(1);

    const description = `Payment Receipt\nProperty: ${propertyName}\nAmount: ${amount}\nStatus: ${status}\nPayment ID: ${payment.paymentId}`;
    const shareUrl = window.location.origin + `/user/my-payments?paymentId=${payment.paymentId}`;

    setShareConfig({
      url: shareUrl,
      title: 'Payment Receipt',
      description: description
    });
    setShowSharePanel(true);
  };


  const statusBadge = (status) => {
    const cls = status === 'completed' ? 'bg-green-100 text-green-700' : status === 'failed' ? 'bg-red-100 text-red-700' : status === 'refunded' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700';
    return <span className={`px-2 py-1 text-[10px] rounded-full font-semibold ${cls}`}>{status}</span>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 py-6 sm:py-10 px-2 md:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                <FaMoneyBill className="text-green-600" />
                My Payments
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">View and manage your payments and receipts</p>
            </div>
            <button
              onClick={fetchPayments}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-200 dark:shadow-none active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              title="Refresh payments"
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

        <div className="bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg p-4 sm:p-6 border border-blue-100 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <input value={filters.q} onChange={(e) => { setFilters(prev => ({ ...prev, q: e.target.value })); setCurrentPage(1); }} placeholder="Search payment ID or receipt" className="px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            <label className="text-sm text-gray-600 dark:text-gray-400">From:</label>
            <input type="date" value={filters.fromDate} max={new Date().toISOString().split('T')[0]} onChange={(e) => { setFilters(prev => ({ ...prev, fromDate: e.target.value })); setCurrentPage(1); }} className="px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            <label className="text-sm text-gray-600 dark:text-gray-400">To:</label>
            <input type="date" value={filters.toDate} max={new Date().toISOString().split('T')[0]} onChange={(e) => { setFilters(prev => ({ ...prev, toDate: e.target.value })); setCurrentPage(1); }} className="px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            <select value={filters.status} onChange={(e) => { setFilters(prev => ({ ...prev, status: e.target.value })); setCurrentPage(1); }} className="px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
              <option value="partially_refunded">Partially Refunded</option>
            </select>
            <select value={filters.gateway} onChange={(e) => { setFilters(prev => ({ ...prev, gateway: e.target.value })); setCurrentPage(1); }} className="px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">All Gateways</option>
              <option value="paypal">PayPal</option>
              <option value="razorpay">Razorpay</option>
            </select>
            <select value={filters.currency} onChange={(e) => { setFilters(prev => ({ ...prev, currency: e.target.value })); setCurrentPage(1); }} className="px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">All Currencies</option>
              <option value="USD">USD ($)</option>
              <option value="INR">INR (₹)</option>
            </select>
            <select value={filters.paymentType} onChange={(e) => { setFilters(prev => ({ ...prev, paymentType: e.target.value })); setCurrentPage(1); }} className="px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">All Types</option>
              <option value="advance">Advance Payment</option>
              <option value="monthly_rent">Monthly Rent</option>
              <option value="security_deposit">Security Deposit</option>
              <option value="booking_fee">Booking Fee</option>
            </select>
            <button
              onClick={() => {
                setShowExportPasswordModal(true);
                setExportPassword('');
                setExportPasswordError('');
              }}
              className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm flex items-center gap-2"
            >
              <FaDownload /> Export CSV
            </button>
          </div>

          {loading ? (
            <MyPaymentsSkeleton />
          ) : (payments?.length || 0) === 0 ? (
            <div className="text-center py-8">
              <FaMoneyBill className="text-6xl text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Payments Found</h3>
              <p className="text-gray-500">You don't have any payments yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Array.isArray(payments) && payments.map((p) => (
                <div key={p._id} className={`rounded-lg p-4 border dark:border-gray-700 cursor-pointer ${p.status === 'completed' ? 'border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20' :
                  p.status === 'failed' ? 'border-red-200 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20' :
                    p.status === 'refunded' || p.status === 'partially_refunded' ? 'border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20' :
                      'border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20'
                  } hover:shadow-lg transition-all`} onClick={() => handlePaymentClick(p)}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                        {p.appointmentId?.propertyName || 'Property Payment'}
                        {p.paymentType && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.paymentType === 'monthly_rent' ? 'bg-green-100 text-green-700' :
                            p.paymentType === 'advance' ? 'bg-blue-100 text-blue-700' :
                              p.paymentType === 'security_deposit' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                            }`}>
                            {p.paymentType === 'monthly_rent' ? 'Rent' :
                              p.paymentType === 'advance' ? 'Advance' :
                                p.paymentType === 'security_deposit' ? 'Security Deposit' :
                                  p.paymentType?.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">{p.gateway?.toUpperCase()}</span>
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">{p.currency || 'USD'}</span>
                        <span className="dark:text-white">{p.currency === 'INR' ? '₹' : '$'}{Number(p.amount).toFixed(2)}</span>
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
                        {p.refundAmount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            Refunded: {p.currency === 'INR' ? '₹' : '$'}{Number(p.refundAmount).toFixed(2)}
                          </span>
                        )}
                      </div>
                      {(p.appointmentId?._id || p.appointmentId) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            goToAppointment(p);
                          }}
                          className="mt-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 text-xs flex items-center gap-1 w-fit"
                          title="Go to appointment"
                        >
                          <FaCalendar className="text-xs" /> Go to Appointment
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col sm:items-end gap-2">
                      <div className="text-xs text-gray-500 space-y-1">
                        {p.completedAt ? (
                          <div className="text-right">
                            <div className="font-medium">Paid: {new Date(p.completedAt).toLocaleDateString('en-GB')}</div>
                            <div className="text-gray-400">{new Date(p.completedAt).toLocaleTimeString('en-GB')}</div>
                            <div className="text-gray-300 mt-1">Created: {new Date(p.createdAt).toLocaleDateString('en-GB')}</div>
                            <div className="text-gray-300">{new Date(p.createdAt).toLocaleTimeString('en-GB')}</div>
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
                            <div className="text-gray-400">{new Date(p.createdAt).toLocaleTimeString('en-GB')}</div>
                          </div>
                        )}
                      </div>
                      <div>{statusBadge(p.status)}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">Payment ID: <span className="font-mono">{p.paymentId}</span></div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    {p.receiptUrl && (
                      <button onClick={() => downloadReceipt(p.receiptUrl)} className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 text-xs flex items-center gap-1">
                        <FaDownload className="text-xs" /> Receipt
                      </button>
                    )}
                    {p.paymentType === 'monthly_rent' && p.contractId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/user/rent-wallet?contractId=${p.contractId._id || p.contractId}`);
                        }}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-xs flex items-center gap-1"
                        title="View Rent Wallet"
                      >
                        <FaWallet className="text-xs" /> Rent Wallet
                      </button>
                    )}
                    <button onClick={() => sharePayment(p)} className="px-3 py-1 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 text-xs flex items-center gap-1">
                      <FaShare className="text-xs" /> Share
                    </button>
                    {p.status !== 'completed' && p.status !== 'refunded' && p.status !== 'partially_refunded' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          payNow(p);
                        }}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs flex items-center gap-1"
                        disabled={loadingPaymentId === p._id}
                      >
                        {loadingPaymentId === p._id ? (
                          <>
                            <UrbanSetuSpinner size="sm" isBright={true} /> Loading...
                          </>
                        ) : (
                          <>
                            <FaCreditCard className="text-xs" /> Pay Now
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {allPayments.length > 10 && totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-2">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setCurrentPage(Math.max(1, currentPage - 1));
                    toast.info(`Navigated to page ${Math.max(1, currentPage - 1)}`);
                  }}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    setCurrentPage(Math.min(totalPages, currentPage + 1));
                    toast.info(`Navigated to page ${Math.min(totalPages, currentPage + 1)}`);
                  }}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Preview Modal */}
      {showPreviewModal && selectedPayment && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4" onClick={closePreviewModal}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10 p-6 pb-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <FaEye className="text-blue-600" />
                  Payment Details
                </h3>
                <button
                  onClick={closePreviewModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FaTimes className="text-xl" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Payment Overview */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 sm:p-6 border border-blue-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white break-words">{selectedPayment.appointmentId?.propertyName || 'Property Payment'}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-all">Payment ID: <span className="font-mono text-xs">{selectedPayment.paymentId}</span></p>
                  </div>
                  <div className="text-left sm:text-right flex-shrink-0">
                    <div className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white break-words">
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
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${selectedPayment.paymentType === 'monthly_rent' ? 'bg-green-100 text-green-700' :
                        selectedPayment.paymentType === 'advance' ? 'bg-blue-100 text-blue-700' :
                          selectedPayment.paymentType === 'security_deposit' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
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
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
                    <div className="text-xs text-gray-500 mt-1">
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
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(selectedPayment.createdAt).toLocaleTimeString('en-GB')}
                  </div>
                </div>
                {selectedPayment.refundedAt && (
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="text-sm text-red-600 mb-1">Refunded Date</div>
                    <div className="font-semibold text-red-800">
                      {new Date(selectedPayment.refundedAt).toLocaleDateString('en-GB', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                    <div className="text-xs text-red-500 mt-1">
                      {new Date(selectedPayment.refundedAt).toLocaleTimeString('en-GB')}
                    </div>
                  </div>
                )}
                {selectedPayment.refundAmount > 0 && (
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="text-sm text-red-600 mb-1">Refund Amount</div>
                    <div className="font-semibold text-red-800">
                      {selectedPayment.currency === 'INR' ? '₹' : '$'}{Number(selectedPayment.refundAmount).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                {selectedPayment.receiptUrl && (
                  <button
                    onClick={() => {
                      downloadReceipt(selectedPayment.receiptUrl);
                      setShowPreviewModal(false);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <FaDownload /> Download Receipt
                  </button>
                )}
                {selectedPayment.paymentType === 'monthly_rent' && selectedPayment.contractId && (
                  <button
                    onClick={() => {
                      navigate(`/user/rent-wallet?contractId=${selectedPayment.contractId._id || selectedPayment.contractId}`);
                      setShowPreviewModal(false);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <FaWallet /> View Rent Wallet
                  </button>
                )}
                <button
                  onClick={() => {
                    sharePayment(selectedPayment);
                    setShowPreviewModal(false);
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                >
                  <FaShare /> Share Payment
                </button>
                <button
                  onClick={() => {
                    copyPaymentLink(
                      window.location.origin + `/user/my-payments?paymentId=${selectedPayment.paymentId}`,
                      `Payment Details:\nProperty: ${selectedPayment.appointmentId?.propertyName || 'N/A'}\nAmount: ${selectedPayment.currency === 'INR' ? '₹' : '$'}${Number(selectedPayment.amount).toFixed(2)}\nStatus: ${selectedPayment.status}\nPayment ID: ${selectedPayment.paymentId}`
                    );
                  }}
                  className={`px-4 py-2 text-white rounded-lg transition-all duration-300 flex items-center gap-2 ${copySuccess ? 'bg-green-600' : 'bg-gray-600 hover:bg-gray-700'}`}
                >
                  {copySuccess ? <FaCheck /> : <FaCopy />} {copySuccess ? 'Copied' : 'Copy Details'}
                </button>
                {selectedPayment.status !== 'completed' && selectedPayment.status !== 'refunded' && selectedPayment.status !== 'partially_refunded' && (
                  <button
                    onClick={() => {
                      payNow(selectedPayment);
                      setShowPreviewModal(false);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    disabled={loadingPaymentId === selectedPayment._id}
                  >
                    {loadingPaymentId === selectedPayment._id ? (
                      <>
                        <UrbanSetuSpinner size="xs" isBright={true} /> Loading...
                      </>
                    ) : (
                      <>
                        <FaCreditCard /> Pay Now
                      </>
                    )}
                  </button>
                )}
                {(selectedPayment.appointmentId?._id || selectedPayment.appointmentId) && (
                  <button
                    onClick={() => {
                      goToAppointment(selectedPayment);
                      setShowPreviewModal(false);
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                  >
                    <FaCalendar /> Go to Appointment
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Social Share Panel */}
      <SocialSharePanel
        isOpen={showSharePanel}
        onClose={() => setShowSharePanel(false)}
        url={shareConfig.url}
        title={shareConfig.title}
        description={shareConfig.description}
      />

      {/* Payment Modal */}
      {showPaymentModal && paymentAppointment && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setPaymentAppointment(null);
          }}
          appointment={paymentAppointment}
          onPaymentSuccess={(payment) => {
            setShowPaymentModal(false);
            setPaymentAppointment(null);
            setLoadingPaymentId(null);
            // Refresh payments to show updated status
            fetchPayments();
            toast.success('Payment completed successfully!');
            // Dispatch event to update MyAppointments page if it's open
            const appointmentId = paymentAppointment?._id || payment?.appointmentId?._id || payment?.appointmentId;
            if (appointmentId) {
              window.dispatchEvent(new CustomEvent('paymentStatusUpdated', {
                detail: {
                  appointmentId: appointmentId,
                  paymentConfirmed: true
                }
              }));
            }
          }}
        />
      )}

      {/* Export Password Modal */}
      {showExportPasswordModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <form
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-xs flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setExportPasswordLoading(true);
              setExportPasswordError("");
              try {
                const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/verify-password`, {
                  method: 'POST',
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ password: exportPassword })
                });
                const data = await res.json();
                if (data.success) {
                  // Reset attempts on successful password
                  localStorage.removeItem('userPaymentExportPwAttempts');
                  setShowExportPasswordModal(false);
                  setExportPassword("");
                  setExportPasswordError("");

                  // Download export file
                  try {
                    const params = new URLSearchParams();
                    if (filters.status) params.set('status', filters.status);
                    if (filters.gateway) params.set('gateway', filters.gateway);
                    if (filters.q) params.set('q', filters.q);
                    if (filters.fromDate) params.set('fromDate', filters.fromDate);
                    if (filters.toDate) params.set('toDate', filters.toDate);
                    const qs = params.toString();
                    const url = `${API_BASE_URL}/api/payments/export-csv${qs ? `?${qs}` : ''}`;
                    const res = await authenticatedFetch(url);
                    if (!res.ok) {
                      toast.error('Failed to export payments');
                      return;
                    }
                    const blob = await res.blob();
                    const objUrl = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = objUrl;
                    a.download = 'my_payments.csv';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(objUrl);
                    toast.success('Payments exported successfully');
                  } catch (exportError) {
                    toast.error('Failed to export payments');
                  }
                }
              } catch (err) {
                // Track wrong attempts locally (allow up to 3 attempts before logout)
                const key = 'userPaymentExportPwAttempts';
                const prev = parseInt(localStorage.getItem(key) || '0');
                const next = prev + 1;
                localStorage.setItem(key, String(next));

                if (next >= 3) {
                  // Sign out and redirect on third wrong attempt
                  localStorage.removeItem(key);
                  setShowExportPasswordModal(false);
                  setExportPassword("");
                  setExportPasswordError("");
                  toast.error("Too many incorrect attempts. You've been signed out for security.");
                  dispatch(signoutUserStart());
                  try {
                    const signoutRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/signout`);
                    const signoutData = await signoutRes.json();
                    if (signoutData.success === false) {
                      dispatch(signoutUserFailure(signoutData.message));
                    } else {
                      dispatch(signoutUserSuccess(signoutData));
                    }
                  } catch (signoutErr) {
                    dispatch(signoutUserFailure(signoutErr.message));
                  }
                  setTimeout(() => {
                    navigate('/sign-in');
                  }, 800);
                  setExportPasswordLoading(false);
                  return;
                } else {
                  // Keep modal open and show remaining attempts
                  const remaining = 3 - next;
                  setExportPasswordError(`Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} left before logout.`);
                }
              } finally {
                setExportPasswordLoading(false);
              }
            }}
          >
            <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2"><FaLock /> Confirm Password</h3>
            <input
              type="password"
              className="border dark:border-gray-700 rounded p-2 w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter your password"
              value={exportPassword}
              onChange={e => setExportPassword(e.target.value)}
              autoFocus
              required
            />
            {exportPasswordError && <div className="text-red-600 dark:text-red-400 text-sm">{exportPasswordError}</div>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold"
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
                className="px-4 py-2 rounded bg-blue-700 text-white font-semibold"
                disabled={exportPasswordLoading}
              >
                {exportPasswordLoading ? <UrbanSetuSpinner size="xs" isBright={true} /> : 'Confirm'}
              </button>
            </div>
          </form>
        </div>
      )}

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
                We couldn't find any payment history for ID: <span className="font-mono text-blue-600 dark:text-blue-400 break-all">{missingPaymentError}</span>.
                Please verify the link or contact support if you believe this is an error.
              </p>
              <button
                onClick={() => setMissingPaymentError(null)}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95"
              >
                Go Back to My Payments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPayments;

