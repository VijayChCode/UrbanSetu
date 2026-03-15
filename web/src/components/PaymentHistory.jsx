import React, { useState, useEffect } from 'react';
import { FaDollarSign, FaDownload, FaEye, FaClock, FaCheckCircle, FaTimes, FaExclamationTriangle, FaSpinner } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { authenticatedFetch } from '../utils/auth';

const PaymentHistory = ({ userId }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    status: '',
    paymentType: ''
  });

  useEffect(() => {
    fetchPayments();
  }, [currentPage, filters]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: currentPage,
        limit: 10,
        ...filters
      });

      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/history?${queryParams}`);

      const data = await response.json();
      if (response.ok) {
        setPayments(data.payments);
        setTotalPages(data.totalPages);
      } else {
        toast.error(data.message || 'Failed to fetch payment history');
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('An error occurred while fetching payments');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <FaCheckCircle className="text-green-500" />;
      case 'pending':
        return <FaClock className="text-yellow-500" />;
      case 'failed':
        return <FaTimes className="text-red-500" />;
      case 'refunded':
        return <FaExclamationTriangle className="text-blue-500" />;
      case 'partially_refunded':
        return <FaExclamationTriangle className="text-orange-500" />;
      default:
        return <FaClock className="text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'pending':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      case 'failed':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'refunded':
        return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      case 'partially_refunded':
        return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50';
    }
  };

  const formatPaymentType = (type) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const downloadReceipt = (receiptUrl) => {
    if (!receiptUrl) {
      toast.info('Receipt not available');
      return;
    }
    (async () => {
      try {
        const urlToFetch = receiptUrl.replace(/^https?:\/\/[^\/]+/, import.meta.env.VITE_API_BASE_URL);
        const res = await authenticatedFetch(urlToFetch);
        if (!res.ok) {
          toast.error('Failed to download receipt');
          return;
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'receipt.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (e) {
        toast.error('Error downloading receipt');
      }
    })();
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  if (loading && payments.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <FaSpinner className="animate-spin text-2xl text-blue-600" />
        <span className="ml-2 text-gray-600">Loading payment history...</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transition-colors duration-300">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">Payment History</h2>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">All Status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
          <option value="partially_refunded">Partially Refunded</option>
        </select>

        <select
          value={filters.paymentType}
          onChange={(e) => handleFilterChange('paymentType', e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">All Types</option>
          <option value="advance">Advance Payment</option>
          <option value="monthly_rent">Monthly Rent</option>
          <option value="security_deposit">Security Deposit</option>
          <option value="booking_fee">Booking Fee</option>
          <option value="split_payment">Split Payment</option>
        </select>
      </div>

      {/* Payment List */}
      {payments.length === 0 ? (
        <div className="text-center py-8">
          <FaDollarSign className="text-6xl text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Payments Found</h3>
          <p className="text-gray-500">You haven't made any payments yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <div key={payment._id} className={`border dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow ${payment.status === 'completed' ? 'border-green-200 dark:border-green-800 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20' :
              payment.status === 'failed' ? 'border-red-200 dark:border-red-800 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20' :
                payment.status === 'refunded' || payment.status === 'partially_refunded' ? 'border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20' :
                  'border-yellow-200 dark:border-yellow-800 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20'
              }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {getStatusIcon(payment.status)}
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-white">
                      {payment.appointmentId?.propertyName || 'Property Payment'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatPaymentType(payment.paymentType)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-800 dark:text-white">
                    {(payment.currency || 'USD') === 'INR' ? `₹ ${Number(payment.amount).toFixed(2)}` : `$ ${Number(payment.amount).toFixed(2)}`}
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                    {payment.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                <div>
                  <span className="font-medium">Payment ID:</span>
                  <p className="font-mono text-xs">{payment.paymentId}</p>
                </div>
                <div>
                  <span className="font-medium">Date:</span>
                  <div className="text-gray-700 dark:text-gray-300">
                    {payment.completedAt ? (
                      <div>
                        <div>Paid: {new Date(payment.completedAt).toLocaleDateString('en-GB')}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-500">{new Date(payment.completedAt).toLocaleTimeString('en-GB')}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Created: {new Date(payment.createdAt).toLocaleDateString('en-GB')}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">{new Date(payment.createdAt).toLocaleTimeString('en-GB')}</div>
                        {payment.refundedAt && (
                          <>
                            <div className="text-xs text-red-500 dark:text-red-400 mt-1">Refunded: {new Date(payment.refundedAt).toLocaleDateString('en-GB')}</div>
                            <div className="text-xs text-red-400 dark:text-red-500">{new Date(payment.refundedAt).toLocaleTimeString('en-GB')}</div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div>Created: {new Date(payment.createdAt).toLocaleDateString('en-GB')}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-500">{new Date(payment.createdAt).toLocaleTimeString('en-GB')}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Property:</span>
                  <p className="truncate text-gray-700 dark:text-gray-300">{payment.listingId?.name || 'N/A'}</p>
                </div>
                <div>
                  <span className="font-medium">Receipt:</span>
                  <p className="font-mono text-xs">{payment.receiptNumber}</p>
                </div>
              </div>

              {payment.refundAmount > 0 && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-red-800 dark:text-red-300 font-medium">Refunded Amount:</span>
                      <p className="text-red-600 dark:text-red-400">
                        {(payment.currency || 'USD') === 'INR' ? '₹' : '$'} {Number(payment.refundAmount).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {payment.refundedAt ? new Date(payment.refundedAt).toLocaleDateString('en-GB') : 'N/A'}
                      </p>
                      <p className="text-xs text-red-500 dark:text-red-400/70">
                        {payment.refundedAt ? new Date(payment.refundedAt).toLocaleTimeString('en-GB') : ''}
                      </p>
                      {payment.refundReason && (
                        <p className="text-xs text-red-500 dark:text-red-400">{payment.refundReason}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {payment.completedAt ? (
                    <span>Completed on {new Date(payment.completedAt).toLocaleDateString('en-GB')}</span>
                  ) : (
                    <span>Created on {new Date(payment.createdAt).toLocaleDateString('en-GB')}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {payment.gateway && (
                    <span className="px-2 py-1 text-[10px] rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                      {payment.gateway.toUpperCase()} {payment.currency === 'INR' ? '₹' : '$'}
                    </span>
                  )}
                  <button onClick={() => downloadReceipt(payment.receiptUrl)} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors flex items-center gap-1">
                    <FaDownload className="text-xs" /> Receipt
                  </button>
                  <button
                    onClick={() => {
                      // Navigate to payment details
                      window.location.href = `/user/payment-details/${payment.paymentId}`;
                    }}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                  >
                    <FaEye className="text-xs" />
                    Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center mt-6 gap-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <span className="px-4 py-2 text-gray-600 dark:text-gray-400">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default PaymentHistory;