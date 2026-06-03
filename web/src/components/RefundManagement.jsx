import React, { useState, useEffect, useCallback } from 'react';
import { FaUndo, FaDollarSign, FaRupeeSign, FaExclamationTriangle, FaCheckCircle, FaTimes, FaSearch, FaFilter, FaRedo, FaInfo } from 'react-icons/fa';
import { useSearchParams } from 'react-router-dom';
import UrbanSetuSpinner from './UrbanSetuSpinner';
import { toast } from 'react-toastify';
import { authenticatedFetch } from '../utils/auth';

const RefundManagement = ({ onRefundProcessed }) => {
  const [payments, setPayments] = useState([]);
  const [refundRequests, setRefundRequests] = useState([]);
  const [allRefundRequests, setAllRefundRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination states for refund requests
  const [refundRequestsPage, setRefundRequestsPage] = useState(1);
  const [refundRequestsTotalPages, setRefundRequestsTotalPages] = useState(1);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundForm, setRefundForm] = useState({
    refundAmount: '',
    reason: '',
    type: 'full' // full or partial
  });
  const [processingRefund, setProcessingRefund] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    search: ''
  });
  const [refundRequestFilters, setRefundRequestFilters] = useState({
    search: '',
    status: '',
    type: '',
    currency: '',
    dateFrom: '',
    dateTo: ''
  });
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('payments'); // 'payments' or 'requests'
  
  // Sync activeTab with category parameter in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search.replace(/\?/g, '&').replace(/^&/, '?'));
    const category = params.get('category');
    if (category === 'requests') {
      setActiveTab('requests');
    } else {
      setActiveTab('payments');
    }
  }, [searchParams]);

  const [selectedRefundRequest, setSelectedRefundRequest] = useState(null);
  const [showRefundRequestModal, setShowRefundRequestModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [adminRefundAmount, setAdminRefundAmount] = useState('');
  const [processingRequest, setProcessingRequest] = useState(false);
  const [processingApprove, setProcessingApprove] = useState(false);
  const [processingReject, setProcessingReject] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedInfoRequest, setSelectedInfoRequest] = useState(null);
  const [showReopenConfirmModal, setShowReopenConfirmModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  // Lock body scroll when refund request modal is open
  useEffect(() => {
    if (showRefundRequestModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showRefundRequestModal]);

  // Debounced search effect - no loading indicator for search
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      fetchPayments(false); // No loading indicator for search
    }, 300); // 300ms debounce

    setSearchTimeout(timeout);

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [filters.search]);

  // Status filter effect (immediate, no debounce) - show loading for status changes
  useEffect(() => {
    fetchPayments(true); // Show loading for status filter changes
  }, [filters.status]);

  // Refund request search effect - debounced
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      fetchRefundRequests(false); // No loading indicator for search
    }, 300); // 300ms debounce

    setSearchTimeout(timeout);

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [refundRequestFilters.search]);

  // Refund request filter effects (immediate, no debounce) - show loading for filter changes
  useEffect(() => {
    fetchRefundRequests(true); // Show loading for filter changes
  }, [refundRequestFilters.status, refundRequestFilters.type, refundRequestFilters.currency, refundRequestFilters.dateFrom, refundRequestFilters.dateTo]);

  // Pagination effect for refund requests
  useEffect(() => {
    const itemsPerPage = 10;
    const totalPages = Math.ceil(allRefundRequests.length / itemsPerPage);
    setRefundRequestsTotalPages(totalPages);

    const startIndex = (refundRequestsPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentPageRefundRequests = allRefundRequests.slice(startIndex, endIndex);
    setRefundRequests(currentPageRefundRequests);
  }, [allRefundRequests, refundRequestsPage]);

  // Initial load effect
  useEffect(() => {
    fetchPayments(true); // Show loading for initial load
    fetchRefundRequests(true); // Show loading for initial load
  }, []);

  const fetchPayments = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const queryParams = new URLSearchParams();

      // Only add status filter if it's selected
      if (filters.status) {
        queryParams.set('status', filters.status);
      }

      // Add other filters
      if (filters.search) {
        queryParams.set('q', filters.search);
      }

      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/history?${queryParams}`);

      const data = await response.json();
      if (response.ok) {
        setPayments(data.payments || []);
      } else {
        toast.error(data.message || 'Failed to fetch payments');
        setPayments([]);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('An error occurred while fetching payments');
      setPayments([]);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const fetchRefundRequests = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const queryParams = new URLSearchParams();
      Object.entries(refundRequestFilters).forEach(([key, value]) => {
        if (value) {
          queryParams.append(key, value);
        }
      });

      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/refund-requests?${queryParams}`);

      const data = await response.json();
      if (response.ok) {
        setAllRefundRequests(data.refundRequests || []);
        setRefundRequestsPage(1); // Reset to first page when filters change
      } else {
        toast.error(data.message || 'Failed to fetch refund requests');
      }
    } catch (error) {
      console.error('Error fetching refund requests:', error);
      toast.error('An error occurred while fetching refund requests');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const handleRefundClick = (payment) => {
    setSelectedPayment(payment);
    setRefundForm({
      refundAmount: payment.amount,
      reason: '',
      type: 'full'
    });
    setShowRefundModal(true);
  };

  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPayment) return;

    try {
      setProcessingRefund(true);
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId: selectedPayment.paymentId,
          refundAmount: parseFloat(refundForm.refundAmount),
          reason: refundForm.reason
        })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Refund processed successfully');
        setShowRefundModal(false);
        fetchPayments(false); // Refresh the list without loading indicator
        // Refresh payment statistics if callback provided
        if (onRefundProcessed) {
          onRefundProcessed();
        }
      } else {
        toast.error(data.message || 'Failed to process refund');
      }
    } catch (error) {
      console.error('Error processing refund:', error);
      toast.error('An error occurred while processing refund');
    } finally {
      setProcessingRefund(false);
    }
  };

  const handleRefundRequestClick = (request) => {
    setSelectedRefundRequest(request);
    setAdminNotes('');
    setAdminRefundAmount(request.requestedAmount.toString());
    setShowRefundRequestModal(true);
  };

  const handleRefundRequestAction = async (action) => {
    if (!selectedRefundRequest) return;

    // Validate admin refund amount if approving
    if (action === 'approved' && adminRefundAmount) {
      const maxAmount = selectedRefundRequest.paymentId?.amount || selectedRefundRequest.requestedAmount;
      if (parseFloat(adminRefundAmount) < 0 || parseFloat(adminRefundAmount) > maxAmount) {
        toast.error('Invalid refund amount. Must be between 0 and the maximum payment amount.');
        return;
      }
    }

    try {
      if (action === 'approved') {
        setProcessingApprove(true);
      } else if (action === 'rejected') {
        setProcessingReject(true);
      }

      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/refund-request/${selectedRefundRequest._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: action,
          adminNotes: adminNotes,
          adminRefundAmount: action === 'approved' ? parseFloat(adminRefundAmount) : undefined
        })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(`Refund request ${action} successfully`);
        setShowRefundRequestModal(false);
        setAdminNotes('');
        setAdminRefundAmount('');
        fetchRefundRequests(false);
        fetchPayments(false);
        // Refresh payment statistics if callback provided and refund was approved
        if (onRefundProcessed && action === 'approved') {
          onRefundProcessed();
        }
      } else {
        toast.error(data.message || `Failed to ${action} refund request`);
      }
    } catch (error) {
      console.error(`Error ${action}ing refund request:`, error);
      toast.error(`An error occurred while ${action}ing refund request`);
    } finally {
      setProcessingApprove(false);
      setProcessingReject(false);
    }
  };

  const handleReopenCase = async (request) => {
    setSelectedInfoRequest(request);
    setReopenReason('');
    setShowReopenConfirmModal(true);
  };

  const handleReopenConfirm = async () => {
    if (!selectedInfoRequest || !reopenReason.trim()) {
      toast.error('Please provide a reason for reopening the case');
      return;
    }

    try {
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/refund-request/${selectedInfoRequest._id}/reopen`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: reopenReason
        })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Case reopened successfully');
        setShowReopenConfirmModal(false);
        setReopenReason('');
        fetchRefundRequests(false);
      } else {
        toast.error(data.message || 'Failed to reopen case');
      }
    } catch (error) {
      console.error('Error reopening case:', error);
      toast.error('An error occurred while reopening case');
    }
  };

  const handleInfoClick = (request) => {
    setSelectedInfoRequest(request);
    setShowInfoModal(true);
  };

  const canRefund = (payment) => {
    return payment.status === 'completed' && payment.refundAmount === 0;
  };

  const getRefundStatus = (payment) => {
    if (payment.refundAmount === 0) return 'No Refund';
    if (payment.refundAmount === payment.amount) return 'Fully Refunded';
    return 'Partially Refunded';
  };

  const getRefundStatusColor = (payment) => {
    if (payment.refundAmount === 0) return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50';
    if (payment.refundAmount === payment.amount) return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
    return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
  };

  const getRefundRequestStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      case 'approved': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'rejected': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'processed': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50';
    }
  };

  const getRefundRequestStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'processed': return 'Processed';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <UrbanSetuSpinner size="md" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading payments...</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <FaUndo className="text-red-600" />
          Refund Management
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
        <button
          onClick={() => {
            const params = new URLSearchParams(window.location.search.replace(/\?/g, '&').replace(/^&/, '?'));
            params.set('tab', 'refund');
            params.set('category', 'direct');
            setSearchParams(params);
          }}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'payments'
            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
        >
          Direct Refunds
        </button>
        <button
          onClick={() => {
            const params = new URLSearchParams(window.location.search.replace(/\?/g, '&').replace(/^&/, '?'));
            params.set('tab', 'refund');
            params.set('category', 'requests');
            setSearchParams(params);
          }}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'requests'
            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
        >
          Refund Requests
        </button>
      </div>

      {activeTab === 'payments' && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by property name or payment ID..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="completed">Completed Payments</option>
              <option value="refunded">Refunded Payments</option>
              <option value="partially_refunded">Partially Refunded</option>
            </select>
          </div>

          {/* Payments Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Property</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Payment ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Refund Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment._id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium text-gray-800 dark:text-white">
                          {payment.appointmentId?.propertyName || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {payment.listingId?.name || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                        {payment.paymentId}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-800 dark:text-white">
                        ${payment.amount.toLocaleString()}
                      </div>
                      {payment.refundAmount > 0 && (
                        <div className="text-sm text-red-600 dark:text-red-400">
                          Refunded: ${payment.refundAmount.toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(payment.createdAt).toLocaleDateString('en-GB')}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRefundStatusColor(payment)}`}>
                        {getRefundStatus(payment)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {canRefund(payment) ? (
                        <button
                          onClick={() => handleRefundClick(payment)}
                          className="px-3 py-1 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors flex items-center gap-1"
                        >
                          <FaUndo className="text-xs" />
                          Refund
                        </button>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600 text-sm">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {payments.length === 0 && (
            <div className="text-center py-8">
              <FaExclamationTriangle className="text-6xl text-gray-300 dark:text-gray-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No Payments Found</h3>
              <p className="text-gray-500 dark:text-gray-500">No completed payments available for refund.</p>
            </div>
          )}

          {/* Refund Modal */}
          {showRefundModal && selectedPayment && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                      <FaUndo className="text-red-600" />
                      Process Refund
                    </h3>
                    <button
                      onClick={() => setShowRefundModal(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors bg-gray-100 dark:bg-gray-700 rounded-full p-2"
                    >
                      <FaTimes className="text-xl" />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleRefundSubmit} className="p-6">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Payment Details
                    </label>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">Property:</span>
                        <span className="font-medium dark:text-white">{selectedPayment.appointmentId?.propertyName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                        <span className="font-medium dark:text-white">${selectedPayment.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">Payment ID:</span>
                        <span className="font-mono text-sm dark:text-gray-300">{selectedPayment.paymentId}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Refund Type
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center cursor-pointer dark:text-gray-300">
                        <input
                          type="radio"
                          name="type"
                          value="full"
                          checked={refundForm.type === 'full'}
                          onChange={(e) => {
                            setRefundForm(prev => ({
                              ...prev,
                              type: e.target.value,
                              refundAmount: e.target.value === 'full' ? selectedPayment.amount : prev.refundAmount
                            }));
                          }}
                          className="mr-2"
                        />
                        Full Refund (${selectedPayment.amount.toLocaleString()})
                      </label>
                      <label className="flex items-center cursor-pointer dark:text-gray-300">
                        <input
                          type="radio"
                          name="type"
                          value="partial"
                          checked={refundForm.type === 'partial'}
                          onChange={(e) => setRefundForm(prev => ({ ...prev, type: e.target.value }))}
                          className="mr-2"
                        />
                        Partial Refund
                      </label>
                    </div>
                  </div>

                  {refundForm.type === 'partial' && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Refund Amount
                      </label>
                      <div className="relative">
                        <FaDollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="number"
                          value={refundForm.refundAmount}
                          onChange={(e) => setRefundForm(prev => ({ ...prev, refundAmount: e.target.value }))}
                          max={selectedPayment.amount}
                          min="1"
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Refund Reason
                    </label>
                    <textarea
                      value={refundForm.reason}
                      onChange={(e) => setRefundForm(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Enter reason for refund..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows="3"
                      required
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowRefundModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={processingRefund}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {processingRefund ? (
                        <>
                          <UrbanSetuSpinner size="sm" isBright={true} />
                          Processing...
                        </>
                      ) : (
                        <>
                          <FaUndo />
                          Process Refund
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'requests' && (
        <>
          {/* Refund Requests Filters */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <FaFilter className="text-gray-600 dark:text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Filter Refund Requests</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  placeholder="Search by property, user, reason, or email..."
                  value={refundRequestFilters.search}
                  onChange={(e) => setRefundRequestFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={refundRequestFilters.status}
                onChange={(e) => setRefundRequestFilters(prev => ({ ...prev, status: e.target.value }))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="processed">Processed</option>
              </select>

              {/* Type Filter */}
              <select
                value={refundRequestFilters.type}
                onChange={(e) => setRefundRequestFilters(prev => ({ ...prev, type: e.target.value }))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="full">Full Refund</option>
                <option value="partial">Partial Refund</option>
              </select>

              {/* Currency Filter */}
              <select
                value={refundRequestFilters.currency}
                onChange={(e) => setRefundRequestFilters(prev => ({ ...prev, currency: e.target.value }))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Currencies</option>
                <option value="USD">USD ($)</option>
                <option value="INR">INR (₹)</option>
              </select>

              {/* Date From */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From Date</label>
                <input
                  type="date"
                  value={refundRequestFilters.dateFrom}
                  onChange={(e) => setRefundRequestFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To Date</label>
                <input
                  type="date"
                  value={refundRequestFilters.dateTo}
                  onChange={(e) => setRefundRequestFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Clear Filters Button */}
              <div className="flex items-end">
                <button
                  onClick={() => setRefundRequestFilters({
                    search: '',
                    status: '',
                    type: '',
                    currency: '',
                    dateFrom: '',
                    dateTo: ''
                  })}
                  className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                >
                  <FaTimes className="text-sm" />
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {/* Refund Requests Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Property</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">User</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Reason</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Date & Time</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {refundRequests && refundRequests.map((request) => (
                  <tr key={request._id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium text-gray-800 dark:text-white">
                          {request.appointmentId?.propertyName || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Payment ID: {request.paymentId?.paymentId || request.paymentId}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium text-gray-800 dark:text-white">
                          {request.userId?.name || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {request.userId?.email || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-800 dark:text-white">
                        {request.paymentId?.currency === 'INR' ? '₹' : '$'}{request.requestedAmount.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {request.type === 'full' ? 'Full Refund' : 'Partial Refund'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                        {request.reason}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRefundRequestStatusColor(request.status)}`}>
                        {getRefundRequestStatusText(request.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(request.createdAt).toLocaleDateString('en-GB')}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        {new Date(request.createdAt).toLocaleTimeString('en-GB')}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {request.status === 'pending' ? (
                          <button
                            onClick={() => handleRefundRequestClick(request)}
                            className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors flex items-center gap-1"
                          >
                            <FaCheckCircle className="text-xs" />
                            Review
                          </button>
                        ) : request.status === 'rejected' ? (
                          <>
                            <button
                              onClick={() => handleInfoClick(request)}
                              className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                            >
                              <FaInfo className="text-xs" />
                              Info
                            </button>
                            <button
                              onClick={() => handleReopenCase(request)}
                              className="px-3 py-1 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors flex items-center gap-1"
                            >
                              <FaUndo className="text-xs" />
                              Reopen Case
                            </button>
                          </>
                        ) : request.status === 'approved' ? (
                          <button
                            onClick={() => handleInfoClick(request)}
                            className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                          >
                            <FaInfo className="text-xs" />
                            Info
                          </button>
                        ) : request.status === 'processed' ? (
                          <button
                            onClick={() => handleInfoClick(request)}
                            className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                          >
                            <FaInfo className="text-xs" />
                            Info
                          </button>
                        ) : (
                          <span className="text-gray-400 text-sm">
                            {request.processedBy?.name || 'N/A'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {allRefundRequests.length === 0 && (
            <div className="text-center py-8">
              <FaExclamationTriangle className="text-6xl text-gray-300 dark:text-gray-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No Refund Requests</h3>
              <p className="text-gray-500 dark:text-gray-500">No refund requests found.</p>
            </div>
          )}

          {/* Refund Requests Pagination */}
          {allRefundRequests.length > 10 && refundRequestsTotalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-2">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Page {refundRequestsPage} of {refundRequestsTotalPages}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setRefundRequestsPage(Math.max(1, refundRequestsPage - 1));
                    toast.info(`Navigated to page ${Math.max(1, refundRequestsPage - 1)}`);
                  }}
                  disabled={refundRequestsPage === 1}
                  className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    setRefundRequestsPage(Math.min(refundRequestsTotalPages, refundRequestsPage + 1));
                    toast.info(`Navigated to page ${Math.min(refundRequestsTotalPages, refundRequestsPage + 1)}`);
                  }}
                  disabled={refundRequestsPage === refundRequestsTotalPages}
                  className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Refund Request Modal */}
      {showRefundRequestModal && selectedRefundRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <FaCheckCircle className="text-blue-600" />
                  Review Refund Request
                </h3>
                <button
                  onClick={() => setShowRefundRequestModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FaTimes className="text-xl" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">Request Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Property:</span>
                      <span className="font-medium dark:text-white">{selectedRefundRequest.appointmentId?.propertyName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">User:</span>
                      <span className="font-medium dark:text-white">{selectedRefundRequest.userId?.name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Requested Amount:</span>
                      <span className="font-medium dark:text-white">
                        {selectedRefundRequest.paymentId?.currency === 'INR' ? '₹' : '$'}{selectedRefundRequest.requestedAmount.toLocaleString()}
                      </span>
                    </div>
                    {selectedRefundRequest.adminRefundAmount && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Admin Override Amount:</span>
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {selectedRefundRequest.paymentId?.currency === 'INR' ? '₹' : '$'}{selectedRefundRequest.adminRefundAmount.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {selectedRefundRequest.paymentId?.refundAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Actual Refunded Amount:</span>
                        <span className="font-medium text-green-600 dark:text-green-400">
                          {selectedRefundRequest.paymentId?.currency === 'INR' ? '₹' : '$'}{selectedRefundRequest.paymentId.refundAmount.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Type:</span>
                      <span className="font-medium capitalize dark:text-white">{selectedRefundRequest.type} Refund</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Requested Date:</span>
                      <span className="font-medium dark:text-white">{new Date(selectedRefundRequest.createdAt).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Requested Time:</span>
                      <span className="font-medium dark:text-white">{new Date(selectedRefundRequest.createdAt).toLocaleTimeString('en-GB')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Status:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRefundRequestStatusColor(selectedRefundRequest.status)}`}>
                        {getRefundRequestStatusText(selectedRefundRequest.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Payment Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Payment ID:</span>
                      <span className="font-mono text-sm dark:text-gray-300">{selectedRefundRequest.paymentId?.paymentId || selectedRefundRequest.paymentId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Original Amount:</span>
                      <span className="font-medium dark:text-white">
                        {selectedRefundRequest.paymentId?.currency === 'INR' ? '₹' : '$'}{selectedRefundRequest.paymentId?.amount?.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Gateway:</span>
                      <span className="font-medium capitalize dark:text-white">{selectedRefundRequest.paymentId?.gateway}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Appointment Status:</span>
                      <span className="font-medium capitalize dark:text-white">{selectedRefundRequest.appointmentId?.status?.replace(/([A-Z])/g, ' $1').trim()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 dark:text-white mb-2">Refund Reason</h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-gray-700 dark:text-gray-300">{selectedRefundRequest.reason}</p>
                </div>
              </div>

              {selectedRefundRequest.isAppealed && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                    <FaUndo className="text-purple-600 dark:text-purple-400" />
                    Appeal Information
                  </h4>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                    <div className="mb-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Appeal Reason:</span>
                      <p className="text-gray-700 dark:text-gray-300">{selectedRefundRequest.appealReason}</p>
                    </div>
                    <div className="mb-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Appeal Details:</span>
                      <p className="text-gray-700 dark:text-gray-300">{selectedRefundRequest.appealText}</p>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      Submitted: {new Date(selectedRefundRequest.appealSubmittedAt).toLocaleString('en-GB')}
                    </div>
                  </div>
                </div>
              )}

              {selectedRefundRequest.caseReopened && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                    <FaRedo className="text-green-600 dark:text-green-400" />
                    Case Reopened
                  </h4>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                    <p className="text-gray-700 dark:text-gray-300">This case has been reopened for review.</p>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Reopened: {new Date(selectedRefundRequest.caseReopenedAt).toLocaleString('en-GB')}
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Admin Notes
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this refund request..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Refund Amount (Admin Override)
                </label>
                <div className="relative">
                  {selectedRefundRequest.paymentId?.currency === 'INR' ? (
                    <FaRupeeSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  ) : (
                    <FaDollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  )}
                  <input
                    type="number"
                    value={adminRefundAmount}
                    onChange={(e) => setAdminRefundAmount(e.target.value)}
                    min="0"
                    max={selectedRefundRequest.paymentId?.amount || selectedRefundRequest.requestedAmount}
                    step="0.01"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter refund amount"
                  />
                </div>
                <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  <div>Requested: {selectedRefundRequest.paymentId?.currency === 'INR' ? '₹' : '$'}{selectedRefundRequest.requestedAmount.toLocaleString()}</div>
                  <div>Maximum: {selectedRefundRequest.paymentId?.currency === 'INR' ? '₹' : '$'}{(selectedRefundRequest.paymentId?.amount || selectedRefundRequest.requestedAmount).toLocaleString()}</div>
                </div>
              </div>

            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRefundRequestModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRefundRequestAction('rejected')}
                  disabled={processingApprove || processingReject}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processingReject ? (
                    <UrbanSetuSpinner size="sm" isBright={true} />
                  ) : (
                    <FaTimes />
                  )}
                  Reject
                </button>
                <button
                  onClick={() => handleRefundRequestAction('approved')}
                  disabled={processingApprove || processingReject}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processingApprove ? (
                    <UrbanSetuSpinner size="sm" isBright={true} />
                  ) : (
                    <FaCheckCircle />
                  )}
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && selectedInfoRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <FaInfo className="text-blue-600" />
                  Refund Request Details
                </h3>
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors bg-gray-100 dark:bg-gray-700 rounded-full p-2"
                >
                  <FaTimes className="text-xl" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Request Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Property:</span>
                      <span className="font-medium dark:text-white">{selectedInfoRequest.appointmentId?.propertyName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">User:</span>
                      <span className="font-medium dark:text-white">{selectedInfoRequest.userId?.name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Requested Amount:</span>
                      <span className="font-medium dark:text-white">
                        {selectedInfoRequest.paymentId?.currency === 'INR' ? '₹' : '$'}{selectedInfoRequest.requestedAmount.toLocaleString()}
                      </span>
                    </div>
                    {selectedInfoRequest.adminRefundAmount && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Admin Override Amount:</span>
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {selectedInfoRequest.paymentId?.currency === 'INR' ? '₹' : '$'}{selectedInfoRequest.adminRefundAmount.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {selectedInfoRequest.paymentId?.refundAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Actual Refunded Amount:</span>
                        <span className="font-medium text-green-600 dark:text-green-400">
                          {selectedInfoRequest.paymentId?.currency === 'INR' ? '₹' : '$'}{selectedInfoRequest.paymentId.refundAmount.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Type:</span>
                      <span className="font-medium capitalize dark:text-white">{selectedInfoRequest.type} Refund</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Status:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRefundRequestStatusColor(selectedInfoRequest.status)}`}>
                        {getRefundRequestStatusText(selectedInfoRequest.status)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Requested Date:</span>
                      <span className="font-medium dark:text-white">{new Date(selectedInfoRequest.createdAt).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Requested Time:</span>
                      <span className="font-medium dark:text-white">{new Date(selectedInfoRequest.createdAt).toLocaleTimeString('en-GB')}</span>
                    </div>
                    {selectedInfoRequest.processedAt && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Processed Date:</span>
                          <span className="font-medium dark:text-white">{new Date(selectedInfoRequest.processedAt).toLocaleDateString('en-GB')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Processed Time:</span>
                          <span className="font-medium dark:text-white">{new Date(selectedInfoRequest.processedAt).toLocaleTimeString('en-GB')}</span>
                        </div>
                      </>
                    )}
                    {selectedInfoRequest.processedBy && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Processed By:</span>
                        <span className="font-medium dark:text-white">{selectedInfoRequest.processedBy.name || 'N/A'}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Payment Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Payment ID:</span>
                      <span className="font-mono text-sm dark:text-gray-300">{selectedInfoRequest.paymentId?.paymentId || selectedInfoRequest.paymentId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Original Amount:</span>
                      <span className="font-medium dark:text-white">
                        {selectedInfoRequest.paymentId?.currency === 'INR' ? '₹' : '$'}{selectedInfoRequest.paymentId?.amount?.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Gateway:</span>
                      <span className="font-medium capitalize dark:text-white">{selectedInfoRequest.paymentId?.gateway}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Appointment Status:</span>
                      <span className="font-medium capitalize dark:text-white">{selectedInfoRequest.appointmentId?.status?.replace(/([A-Z])/g, ' $1').trim()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Payment Created:</span>
                      <span className="font-medium dark:text-white">{selectedInfoRequest.paymentId?.createdAt ? new Date(selectedInfoRequest.paymentId.createdAt).toLocaleDateString('en-GB') : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Payment Completed:</span>
                      <span className="font-medium dark:text-white">{selectedInfoRequest.paymentId?.completedAt ? new Date(selectedInfoRequest.paymentId.completedAt).toLocaleDateString('en-GB') : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 dark:text-white mb-2">Refund Reason</h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-gray-700 dark:text-gray-300">{selectedInfoRequest.reason}</p>
                </div>
              </div>

              {selectedInfoRequest.adminNotes && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-2">Admin Notes</h4>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                    <p className="text-gray-700 dark:text-gray-300">{selectedInfoRequest.adminNotes}</p>
                  </div>
                </div>
              )}

              {selectedInfoRequest.isAppealed && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                    <FaUndo className="text-purple-600 dark:text-purple-400" />
                    Appeal Information
                  </h4>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                    <div className="mb-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Appeal Reason:</span>
                      <p className="text-gray-700 dark:text-gray-300">{selectedInfoRequest.appealReason}</p>
                    </div>
                    <div className="mb-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Appeal Details:</span>
                      <p className="text-gray-700 dark:text-gray-300">{selectedInfoRequest.appealText}</p>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      Submitted: {new Date(selectedInfoRequest.appealSubmittedAt).toLocaleString('en-GB')}
                    </div>
                  </div>
                </div>
              )}

              {selectedInfoRequest.caseReopened && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                    <FaRedo className="text-green-600 dark:text-green-400" />
                    Case Reopened
                  </h4>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                    <p className="text-gray-700 dark:text-gray-300">This case has been reopened for review.</p>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Reopened: {new Date(selectedInfoRequest.caseReopenedAt).toLocaleString('en-GB')}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Case Confirmation Modal */}
      {showReopenConfirmModal && selectedInfoRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <FaUndo className="text-green-600" />
                  Reopen Case
                </h3>
                <button
                  onClick={() => setShowReopenConfirmModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors bg-gray-100 dark:bg-gray-700 rounded-full p-2"
                >
                  <FaTimes className="text-xl" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Are you sure you want to reopen this case? Please provide a reason for reopening.
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Reason for Reopening
                  </label>
                  <textarea
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    placeholder="Enter reason for reopening this case..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    rows="3"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowReopenConfirmModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReopenConfirm}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <FaUndo />
                  Reopen Case
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RefundManagement;
