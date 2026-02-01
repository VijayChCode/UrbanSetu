import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FaCalendarAlt, FaCheckCircle, FaClock, FaExclamationTriangle, FaMoneyBillWave, FaDownload, FaCoins } from "react-icons/fa";
import { toast } from 'react-toastify';
import PaymentModal from '../PaymentModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function PaymentSchedule({ wallet, contract, isTenant }) {
  const navigate = useNavigate();
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const payments = useMemo(() => {
    if (!wallet?.paymentSchedule) return [];
    return wallet.paymentSchedule.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }, [wallet]);

  const getPaymentStatusIcon = (payment) => {
    switch (payment.status) {
      case 'completed':
      case 'paid':
        return <FaCheckCircle className="text-green-600" />;
      case 'overdue':
        return <FaExclamationTriangle className="text-red-600" />;
      case 'processing':
        return <FaClock className="text-blue-600 animate-pulse" />;
      default:
        return <FaClock className="text-gray-400" />;
    }
  };

  const getPaymentStatusColor = (payment) => {
    switch (payment.status) {
      case 'completed':
      case 'paid':
        return 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800';
      case 'overdue':
        return 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800';
      case 'processing':
        return 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
  };

  const handlePayNow = async (payment) => {
    if (!contract || !payment || !wallet) {
      toast.error("Payment information not available.");
      return;
    }

    try {
      // Find the schedule index
      const scheduleIndex = wallet.paymentSchedule.findIndex(p =>
        p.month === payment.month &&
        p.year === payment.year &&
        p.dueDate === payment.dueDate
      );

      if (scheduleIndex === -1) {
        toast.error("Payment schedule entry not found.");
        return;
      }

      // Navigate to PayMonthlyRent page instead of opening modal directly
      // This provides better UX with 5-step flow
      navigate(`/user/pay-monthly-rent?contractId=${contract._id}&scheduleIndex=${scheduleIndex}`);
    } catch (error) {
      console.error("Error preparing payment:", error);
      toast.error("Failed to prepare payment. Please try again.");
    }
  };

  const handlePaymentSuccess = () => {
    toast.success("Payment successful!");
    setShowPaymentModal(false);
    setSelectedPayment(null);
    // Reload page to refresh wallet data
    window.location.reload();
  };

  // Group payments by year
  const paymentsByYear = useMemo(() => {
    const grouped = {};
    payments.forEach(payment => {
      const year = new Date(payment.dueDate).getFullYear();
      if (!grouped[year]) {
        grouped[year] = [];
      }
      grouped[year].push(payment);
    });
    return grouped;
  }, [payments]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = payments.length;
    const completed = payments.filter(p => p.status === 'completed' || p.status === 'paid').length;
    const pending = payments.filter(p => p.status === 'pending').length;
    const overdue = payments.filter(p => p.status === 'overdue').length;
    const processing = payments.filter(p => p.status === 'processing').length;

    return { total, completed, pending, overdue, processing };
  }, [payments]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">
        <FaCalendarAlt className="inline mr-2" />
        Payment Schedule
      </h2>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.total}</p>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Total</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</p>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Paid</p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 rounded-lg text-center">
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</p>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Pending</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg text-center">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.overdue}</p>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Overdue</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg text-center">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.processing}</p>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Processing</p>
        </div>
      </div>

      {/* Payment List by Year */}
      <div className="space-y-6">
        {Object.keys(paymentsByYear)
          .sort((a, b) => a - b) // Sort years ascending
          .map(year => (
            <div key={year}>
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">{year}</h3>
              <div className="space-y-2">
                {paymentsByYear[year].map((payment, index) => {
                  const dueDate = new Date(payment.dueDate);
                  const isOverdue = payment.status === 'pending' && dueDate < new Date();
                  const isUpcoming = payment.status === 'pending' && dueDate >= new Date();

                  return (
                    <div
                      key={index}
                      className={`border-2 rounded-lg p-4 transition ${getPaymentStatusColor(payment)}`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 w-full">
                          <div className="text-2xl mt-1 md:mt-0">
                            {getPaymentStatusIcon(payment)}
                          </div>
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <p className="font-semibold text-gray-800 dark:text-white">
                                {dueDate.toLocaleDateString('en-GB', {
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </p>
                              {isOverdue && (
                                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">
                                  Overdue
                                </span>
                              )}
                              {isUpcoming && (
                                <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-semibold rounded">
                                  Upcoming
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Status: <span className="font-semibold capitalize">{payment.status}</span>
                            </p>
                            {payment.paidAt && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Paid: {new Date(payment.paidAt).toLocaleDateString('en-GB')}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto mt-2 md:mt-0 gap-4">
                          <div className="text-left md:text-right">
                            <p className="text-xl font-bold text-gray-800 dark:text-white mb-1">
                              ₹{(payment.amount - (contract?.maintenanceCharges || 0)).toLocaleString('en-IN')}
                            </p>
                            {contract?.maintenanceCharges > 0 && (
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                + Maintenance: ₹{contract.maintenanceCharges.toLocaleString('en-IN')}
                              </p>
                            )}
                            {payment.penaltyAmount > 0 && (
                              <p className="text-sm text-red-600 dark:text-red-400">
                                + Penalty: ₹{payment.penaltyAmount.toLocaleString('en-IN')}
                              </p>
                            )}
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1">
                              Total: ₹{(payment.amount + (payment.penaltyAmount || 0)).toLocaleString('en-IN')}
                            </p>
                            {/* SetuCoins Earning Preview */}
                            {payment.status === 'pending' && payment.amount >= 1000 && (
                              <p className="text-xs text-yellow-600 font-semibold flex justify-end items-center gap-1 mt-1">
                                <FaCoins className="text-[10px]" /> Earn {Math.floor(payment.amount / 1000)} Coins
                              </p>
                            )}
                            {payment.status === 'pending' && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Due: {contract.dueDate} of month
                              </p>
                            )}
                          </div>

                          {(payment.status === 'pending' || payment.status === 'overdue') && isTenant && (
                            <button
                              onClick={() => handlePayNow(payment)}
                              className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition"
                            >
                              <FaMoneyBillWave className="inline mr-1" />
                              Pay Now
                            </button>
                          )}

                          {payment.status === 'processing' && isTenant && (
                            <button
                              onClick={() => {
                                const scheduleIndex = wallet.paymentSchedule.findIndex(p =>
                                  p.month === payment.month &&
                                  p.year === payment.year &&
                                  p.dueDate === payment.dueDate
                                );
                                if (scheduleIndex !== -1) {
                                  navigate(`/user/pay-monthly-rent?contractId=${contract._id}&scheduleIndex=${scheduleIndex}`);
                                }
                              }}
                              className="w-full md:w-auto px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold transition"
                            >
                              <FaMoneyBillWave className="inline mr-1" />
                              Retry
                            </button>
                          )}

                          {(payment.status === 'completed' || payment.status === 'paid') && payment.paymentId && (
                            <button
                              onClick={() => {
                                const receiptId = typeof payment.paymentId === 'object' ? payment.paymentId.paymentId : payment.paymentId;
                                if (receiptId) {
                                  window.open(`${API_BASE_URL}/api/payments/${receiptId}/receipt`, '_blank');
                                } else {
                                  toast.error("Receipt ID not found.");
                                }
                              }}
                              className="w-full md:w-auto px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold transition flex items-center justify-center gap-2"
                            >
                              <FaDownload />
                              Receipt
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>

      {payments.length === 0 && (
        <div className="text-center py-12">
          <FaCalendarAlt className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No payment schedule available.</p>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedPayment && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedPayment(null);
          }}
          appointment={selectedPayment.booking}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

