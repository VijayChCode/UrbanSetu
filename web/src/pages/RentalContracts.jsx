import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaFileContract, FaDownload, FaEye, FaCalendarAlt, FaMoneyBillWave, FaLock, FaCheckCircle, FaTimesCircle, FaSpinner, FaHome, FaUser, FaChevronRight, FaSignInAlt, FaSignOutAlt, FaGavel, FaStar, FaCreditCard, FaPlayCircle, FaCheck, FaTimes, FaPen, FaEraser, FaUndo, FaClock, FaWallet, FaExternalLinkAlt, FaTools } from 'react-icons/fa';
import { usePageTitle } from '../hooks/usePageTitle';
import ContractPreview from '../components/rental/ContractPreview';
import DigitalSignature from '../components/rental/DigitalSignature';
import UserRentalContractsSkeleton from '../components/skeletons/UserRentalContractsSkeleton';
import axios from 'axios';
import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://urbansetu.vercel.app');

const buildPayMonthlyRentUrl = (contractId) => {
  const runtimeOrigin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : PUBLIC_APP_URL;
  return `${runtimeOrigin}/user/pay-monthly-rent?contractId=${contractId}&scheduleIndex=0`;
};

// Helper for status colors with dark mode support
const getStatusClasses = (status) => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    case 'pending_signature':
    case 'pending_payment':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
    case 'draft':
      return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
    case 'expired':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
    case 'terminated':
      return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
    case 'rejected':
      return 'bg-red-200 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-200 dark:border-red-800';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
  }
};

export default function RentalContracts() {
  usePageTitle("My Rental Contracts - UrbanSetu");

  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();

  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'pending_signature', 'expired', 'terminated', 'rejected'
  const [selectedContract, setSelectedContract] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signingContract, setSigningContract] = useState(null);
  const [actionLoading, setActionLoading] = useState('');
  const [loans, setLoans] = useState([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [contractToReject, setContractToReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    // Only fetch on initial load, not on filter changes
    if (contracts.length === 0) {
      fetchContracts();
      fetchLoans();
    }
  }, [currentUser]);

  // Listen for payment status updates
  useEffect(() => {
    const handlePaymentUpdate = (event) => {
      const { contractId, paymentId, paymentConfirmed } = event.detail || {};
      if (contractId || paymentConfirmed) {
        // Refresh contracts when payment status is updated
        fetchContracts();
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

  const fetchContracts = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      // Fetch all contracts, apply filters client-side
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts`);

      const data = await res.json();
      if (res.ok && data.contracts) {
        setContracts(data.contracts);
      } else {
        toast.error(data.message || "Failed to fetch contracts");
      }
    } catch (error) {
      console.error("Error fetching contracts:", error);
      toast.error("Failed to load contracts");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const fetchLoans = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/loans`);
      const data = await res.json();
      if (res.ok && data.success) {
        setLoans(data.loans || []);
      }
    } catch (error) {
      console.error("Error fetching loans:", error);
    }
  };

  // Client-side filtering
  const filteredContracts = React.useMemo(() => {
    if (filter === 'all') return contracts;
    return contracts.filter(contract => contract.status === filter);
  }, [contracts, filter]);

  const handleDownload = async (contract) => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts/${contract.contractId || contract._id}/download`);

      if (!response.ok) {
        throw new Error('Failed to download contract');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rent_contract_${contract.contractId || contract._id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Contract PDF downloaded!");
    } catch (error) {
      console.error('Error downloading contract:', error);
      toast.error('Failed to download contract');
    }
  };

  const handleView = (contract) => {
    setSelectedContract(contract);
    setShowPreviewModal(true);
  };

  const getStatusColor = (status) => {
    return getStatusClasses(status);
  };

  const getStatusLabel = (status) => {
    if (status === 'pending_payment') return 'PAYMENT PENDING';
    return status?.replace('_', ' ').toUpperCase() || 'UNKNOWN';
  };

  // Determine if current user is tenant (buyer) or landlord (seller) for a contract
  const getUserRole = (contract) => {
    if (!contract || !currentUser) return null;
    const isTenant = contract.tenantId?._id === currentUser._id || contract.tenantId === currentUser._id;
    const isLandlord = contract.landlordId?._id === currentUser._id || contract.landlordId === currentUser._id;

    if (isTenant) return 'tenant';
    if (isLandlord) return 'landlord';
    return null;
  };

  // Handle contract review (for seller/landlord)
  const handleReview = (contract) => {
    setSigningContract(contract);
    setShowReviewModal(true);
  };

  // Handle signature click (for seller/landlord review)
  const handleSignatureClick = (contract) => {
    // Check if already signed
    if (contract.landlordSignature?.signed) {
      toast.info("You have already signed this contract.");
      return;
    }
    setSigningContract(contract);
    setShowSignatureModal(true);
  };

  // Handle signature confirm (for seller/landlord)
  const handleSignatureConfirm = async (signatureData) => {
    if (!signingContract) {
      toast.error("Contract not found.");
      return;
    }

    try {
      setActionLoading('signing');

      const contractId = signingContract.contractId || signingContract._id;
      if (!contractId) {
        throw new Error("Contract ID not found. Please refresh and try again.");
      }

      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts/${contractId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureData: signatureData
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to sign contract");
      }

      // Refresh contracts list
      await fetchContracts();

      setShowSignatureModal(false);
      setShowReviewModal(false);
      setSigningContract(null);

      if (data.isFullySigned) {
        toast.success("Contract fully signed by both parties! Tenant can now proceed with payment.");
      } else {
        toast.success("Your signature added. Waiting for tenant to sign.");
      }
    } catch (error) {
      console.error("Error signing contract:", error);
      toast.error(error.message || "Failed to sign contract. Please try again.");
    } finally {
      setActionLoading('');
    }
  };

  // Handle accept appointment (for seller/landlord)
  const handleAcceptAppointment = async (contract) => {
    if (!contract.bookingId?._id && !contract.bookingId) {
      toast.error("Booking not found for this contract.");
      return;
    }

    const bookingId = contract.bookingId?._id || contract.bookingId;
    setActionLoading(`accept-${contract._id}`);

    try {
      const { data } = await axios.patch(
        `${API_BASE_URL}/api/bookings/${bookingId}/status`,
        { status: 'accepted' },
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" }
        }
      );

      // Refresh contracts
      await fetchContracts();

      toast.success("Appointment accepted successfully! Contact information is now visible to both parties.");
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error("Session expired or unauthorized. Please sign in again.");
        navigate("/sign-in");
        return;
      }
      toast.error(err.response?.data?.message || "Failed to accept appointment.");
    } finally {
      setActionLoading('');
    }
  };

  // Handle reject appointment (for seller/landlord) - Open Modal
  const handleRejectAppointment = (contract) => {
    if (!contract.bookingId?._id && !contract.bookingId) {
      toast.error("Booking not found for this contract.");
      return;
    }
    setContractToReject(contract);
    setShowRejectModal(true);
    setRejectionReason(''); // Reset reason
  };

  // Confirm Reject Appointment (API Call)
  const confirmRejectAppointment = async () => {
    if (!contractToReject) return;

    const bookingId = contractToReject.bookingId?._id || contractToReject.bookingId;
    if (!bookingId) return;

    setActionLoading(`reject-${contractToReject._id}`);

    try {
      // Logic from previous handleReject, status: 'rejected'
      // Note: Endpoint likely expects { status, rejectionReason }
      await axios.patch(
        `${API_BASE_URL}/api/bookings/${bookingId}/status`,
        {
          status: 'rejected',
          rejectionReason: rejectionReason || 'Booking rejected by seller'
        },
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" }
        }
      );

      // Refresh contracts
      await fetchContracts();

      toast.success("Appointment rejected. The rental contract has been cancelled.");
      setShowRejectModal(false);
      setContractToReject(null);
      setRejectionReason('');
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error("Session expired or unauthorized. Please sign in again.");
        navigate("/sign-in");
        return;
      }
      toast.error(err.response?.data?.message || "Failed to reject appointment.");
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return <UserRentalContractsSkeleton />;
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 min-h-screen py-10 px-4 md:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                <FaFileContract className="text-blue-600 dark:text-blue-400" />
                My Rental Contracts
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">View and manage your rent-lock contracts</p>
            </div>
            <button
              onClick={() => navigate('/user/services')}
              className="px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-semibold flex items-center gap-2"
            >
              <FaTools />
              Services
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'active', 'pending_signature', 'expired', 'terminated', 'rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium transition ${filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
              >
                {status === 'all' ? 'All Contracts' : getStatusLabel(status)}
              </button>
            ))}
          </div>
        </div>

        {contracts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
            <FaFileContract className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No Contracts Found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">You don't have any rental contracts yet.</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Browse Properties
            </button>
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
            <FaFileContract className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No {filter !== 'all' ? getStatusLabel(filter).toLowerCase() : ''} Contracts Found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">You don't have any contracts matching this filter.</p>
            <button
              onClick={() => setFilter('all')}
              className="px-6 py-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition"
            >
              Clear Filter
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredContracts.map((contract) => {
              // Determine functional status based on wallet existence
              const displayStatus = (contract.status === 'active' && !contract.securityDepositPaid && (!contract.wallet || !contract.wallet.paymentSchedule || contract.wallet.paymentSchedule.length === 0))
                ? 'pending_payment'
                : contract.status;

              const userRole = getUserRole(contract);
              const isTenant = userRole === 'tenant';
              const isLandlord = userRole === 'landlord';
              const now = new Date();
              const contractStartDate = contract.startDate ? new Date(contract.startDate) : null;
              const hasContractStarted = contractStartDate ? now >= contractStartDate : false;
              const contractIdentifier = contract.contractId || contract._id;
              const payMonthlyRentUrl = buildPayMonthlyRentUrl(contractIdentifier);
              const showMoveInChecklist = contract.status === 'active' && !hasContractStarted;
              const listingId = contract.listingId?._id || contract.listingId;
              const listingName = contract.listingId?.name || 'Property Contract';

              return (
                <div
                  key={contract._id}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 ${getStatusColor(displayStatus)}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <FaFileContract className="text-2xl text-blue-600 dark:text-blue-400" />
                        <div>
                          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                            {listingId ? (
                              <Link
                                to={`/listing/${listingId}`}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                              >
                                {listingName}
                              </Link>
                            ) : (
                              listingName
                            )}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                            {contract.contractId}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                            <FaMoneyBillWave className="text-green-600 dark:text-green-400" /> Monthly Rent
                          </p>
                          <p className="font-semibold text-gray-800 dark:text-gray-200">
                            ₹{contract.lockedRentAmount?.toLocaleString('en-IN') || contract.rentAmount?.toLocaleString('en-IN') || '0'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                            <FaLock className="text-purple-600 dark:text-purple-400" /> Duration
                          </p>
                          <p className="font-semibold text-gray-800 dark:text-gray-200">{contract.lockDuration} months</p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                            <FaCalendarAlt className="text-indigo-600 dark:text-indigo-400" /> Start Date
                          </p>
                          <p className="font-semibold text-gray-800 dark:text-gray-200">
                            {contract.startDate ? new Date(contract.startDate).toLocaleDateString('en-GB') : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                            <FaCalendarAlt className="text-red-600 dark:text-red-400" /> End Date
                          </p>
                          <p className="font-semibold text-gray-800 dark:text-gray-200">
                            {contract.endDate ? new Date(contract.endDate).toLocaleDateString('en-GB') : 'N/A'}
                          </p>
                        </div>
                      </div>

                      {/* Signature Status */}
                      <div className="mt-4 flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Tenant:</span>
                          {contract.tenantSignature?.signed ? (
                            <FaCheckCircle className="text-green-600 dark:text-green-400" />
                          ) : (
                            <FaTimesCircle className="text-yellow-600 dark:text-yellow-400" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Landlord:</span>
                          {contract.landlordSignature?.signed ? (
                            <FaCheckCircle className="text-green-600 dark:text-green-400" />
                          ) : (
                            <FaTimesCircle className="text-yellow-600 dark:text-yellow-400" />
                          )}
                        </div>
                      </div>

                      {/* Payment Status - Show monthly payment status for active contracts */}
                      {contract.status === 'active' && contract.wallet?.paymentSchedule && contract.wallet.paymentSchedule.length > 0 && (
                        <div className="mt-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                          <h4 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                            <FaMoneyBillWave className="text-green-600 dark:text-green-400" /> Payment Status
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {contract.wallet.paymentSchedule
                              .sort((a, b) => {
                                if (a.year !== b.year) return a.year - b.year;
                                return a.month - b.month;
                              })
                              .slice(0, 6) // Show first 6 months
                              .map((payment, idx) => (
                                <div
                                  key={idx}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${payment.status === 'completed'
                                    ? 'bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
                                    : payment.status === 'overdue'
                                      ? 'bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                                      : payment.status === 'processing'
                                        ? 'bg-yellow-100 text-yellow-700 border border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800'
                                        : 'bg-gray-100 text-gray-600 border border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600'
                                    }`}
                                  title={`${payment.status === 'completed' ? 'Paid' : payment.status === 'overdue' ? 'Overdue' : payment.status === 'processing' ? 'Processing' : 'Pending'} - Month ${payment.month}/${payment.year}`}
                                >
                                  {payment.status === 'completed' && <FaCheckCircle className="text-xs" />}
                                  {payment.status === 'overdue' && <FaTimesCircle className="text-xs" />}
                                  {payment.status === 'processing' && <FaSpinner className="text-xs animate-spin" />}
                                  {!payment.status || payment.status === 'pending' ? (
                                    <>
                                      <FaClock className="text-xs" />
                                      Month {idx + 1}
                                    </>
                                  ) : (
                                    <>
                                      {payment.status === 'completed' ? 'Paid' : payment.status === 'overdue' ? 'Overdue' : 'Processing'} - Month {idx + 1}
                                    </>
                                  )}
                                </div>
                              ))}
                            {contract.wallet.paymentSchedule.length > 6 && (
                              <div className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                                +{contract.wallet.paymentSchedule.length - 6} more
                              </div>
                            )}
                          </div>
                          {contract.wallet.totalPaid > 0 && (
                            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                              Total Paid: <span className="font-semibold text-green-600 dark:text-green-400">₹{contract.wallet.totalPaid.toLocaleString('en-IN')}</span>
                              {contract.wallet.totalDue > 0 && (
                                <> | Pending: <span className="font-semibold text-yellow-600 dark:text-yellow-400">₹{contract.wallet.totalDue.toLocaleString('en-IN')}</span></>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      {(() => {
                        // Buyer/Tenant actions
                        if (isTenant && (contract.status === 'pending_signature' || contract.status === 'draft')) {
                          return (
                            <button
                              onClick={() => {
                                const listingId = contract.listingId?._id || contract.listingId;
                                if (listingId) {
                                  navigate(`/user/rent-property?listingId=${listingId}&contractId=${contract.contractId || contract._id}`);
                                } else {
                                  toast.error('Unable to continue contract. Listing not found.');
                                }
                              }}
                              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2"
                            >
                              <FaPlayCircle /> Continue Contract
                            </button>
                          );
                        }

                        // Pending Payment Actions
                        if (displayStatus === 'pending_payment') {
                          return (
                            <>
                              {isTenant ? (
                                <button
                                  onClick={() => {
                                    const listingId = contract.listingId?._id || contract.listingId;
                                    if (listingId) {
                                      navigate(`/user/rent-property?listingId=${listingId}&contractId=${contract.contractId || contract._id}`);
                                    }
                                  }}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                                >
                                  <FaMoneyBillWave /> Pay Security Deposit
                                </button>
                              ) : (
                                <span className="px-4 py-2 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 rounded-lg flex items-center justify-center gap-2 border border-yellow-200 dark:border-yellow-800 font-medium">
                                  <FaClock /> Awaiting Tenant Payment
                                </span>
                              )}
                            </>
                          );
                        }

                        // Seller/Landlord actions
                        if (isLandlord && contract.status === 'pending_signature') {
                          const booking = contract.bookingId;
                          const appointmentStatus = booking?.status || 'pending';
                          const paymentConfirmed = !!booking?.paymentConfirmed;

                          return (
                            <>
                              <button
                                onClick={() => handleReview(contract)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                                disabled={actionLoading !== ''}
                              >
                                <FaEye /> Review Contract
                              </button>
                              {appointmentStatus === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleAcceptAppointment(contract)}
                                    disabled={!paymentConfirmed || actionLoading === `accept-${contract._id}` || actionLoading !== ''}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={!paymentConfirmed ? 'Waiting for tenant to complete payment' : undefined}
                                  >
                                    {actionLoading === `accept-${contract._id}` ? (
                                      <>
                                        <FaSpinner className="animate-spin" /> Accepting...
                                      </>
                                    ) : (
                                      <>
                                        <FaCheck /> Accept
                                      </>
                                    )}
                                  </button>
                                  {!paymentConfirmed && (
                                    <p className="text-xs text-gray-600 flex items-center gap-1">
                                      <FaClock className="text-yellow-600" /> Awaiting tenant payment confirmation
                                    </p>
                                  )}
                                  <button
                                    onClick={() => handleRejectAppointment(contract)}
                                    disabled={actionLoading === `reject-${contract._id}` || actionLoading !== ''}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {actionLoading === `reject-${contract._id}` ? (
                                      <>
                                        <FaSpinner className="animate-spin" /> Rejecting...
                                      </>
                                    ) : (
                                      <>
                                        <FaTimes /> Reject
                                      </>
                                    )}
                                  </button>
                                </>
                              )}
                            </>
                          );
                        }

                        return null;
                      })()}
                      <button
                        onClick={() => handleView(contract)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                      >
                        <FaEye /> View Details
                      </button>

                      {displayStatus === 'active' && (
                        <button
                          onClick={() => navigate(`/user/rent-wallet?contractId=${contractIdentifier}`)}
                          className={`px-4 py-2 text-white rounded-lg flex items-center justify-center gap-2 ${isTenant ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                          <FaMoneyBillWave /> {isTenant ? 'Rent Wallet' : 'Monitor Rent'}
                        </button>
                      )}
                      {displayStatus === 'active' && isTenant && contract.wallet && contract.wallet.paymentSchedule && contract.wallet.paymentSchedule.filter(p => p.status === 'pending' || p.status === 'overdue').length > 0 && (
                        <button
                          onClick={() => {
                            const nextPending = contract.wallet.paymentSchedule.find((p, idx) => p.status === 'pending' || p.status === 'overdue');
                            const nextIndex = contract.wallet.paymentSchedule.indexOf(nextPending);
                            navigate(`/user/pay-monthly-rent?contractId=${contractIdentifier}&scheduleIndex=${nextIndex}`);
                          }}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                        >
                          <FaMoneyBillWave /> Pay Next Rent
                        </button>
                      )}
                      {displayStatus === 'active' && isTenant && (
                        <a
                          href={payMonthlyRentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2"
                        >
                          <FaExternalLinkAlt /> Pay Monthly Rent Page
                        </a>
                      )}
                      {displayStatus === 'active' && (
                        <>
                          {isTenant && showMoveInChecklist && (
                            <button
                              onClick={() => navigate(`/user/services?contractId=${contractIdentifier}&checklist=move_in`)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                            >
                              <FaSignInAlt /> Move-In Checklist
                            </button>
                          )}
                          {isTenant && (
                            <button
                              onClick={() => navigate(`/user/services?contractId=${contractIdentifier}&checklist=move_out`)}
                              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2"
                            >
                              <FaSignOutAlt /> Move-Out Checklist
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/user/disputes?contractId=${contractIdentifier}`)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                          >
                            <FaGavel /> Raise Dispute
                          </button>
                          <button
                            onClick={() => {
                              const isTenant = contract.tenantId?._id === currentUser._id || contract.tenantId === currentUser._id;
                              const isLandlord = contract.landlordId?._id === currentUser._id || contract.landlordId === currentUser._id;
                              if (isTenant) {
                                navigate(`/user/rental-ratings?contractId=${contractIdentifier}&role=tenant`);
                              } else if (isLandlord) {
                                navigate(`/user/rental-ratings?contractId=${contractIdentifier}&role=landlord`);
                              }
                            }}
                            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center justify-center gap-2"
                          >
                            <FaStar /> Rate
                          </button>
                          {isTenant && (
                            (() => {
                              const contractLoan = loans.find(l =>
                                (l.contractId?._id === contract._id || l.contractId === contract._id) &&
                                l.status !== 'rejected'
                              );

                              if (contractLoan) {
                                const isRepaid = contractLoan.status === 'repaid';
                                const isDisbursed = contractLoan.status === 'disbursed';
                                const hasOverdue = contractLoan.emiSchedule?.some(e => e.status === 'overdue');

                                return (
                                  <div className="flex flex-col gap-2 w-full">
                                    <div className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 border-2 ${isRepaid ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800' :
                                      hasOverdue ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800' :
                                        isDisbursed ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800' :
                                          'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
                                      }`}>
                                      {isRepaid ? (
                                        <><FaCheckCircle /> Loan Fully Repaid</>
                                      ) : hasOverdue ? (
                                        <><FaClock /> Loan EMI Overdue!</>
                                      ) : isDisbursed ? (
                                        <><FaCheckCircle /> Active Loan: Disbursed</>
                                      ) : (
                                        <><FaClock /> Loan Status: {contractLoan.status.toUpperCase()}</>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => navigate(`/user/rental-loans?loanId=${contractLoan.loanId}`)}
                                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 font-semibold"
                                    >
                                      <FaEye /> {hasOverdue ? 'Pay Overdue EMI' : 'View Loan Details'}
                                    </button>
                                  </div>
                                );
                              }

                              return (
                                <button
                                  onClick={() => navigate(`/user/rental-loans?contractId=${contractIdentifier}`)}
                                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 font-semibold"
                                >
                                  <FaCreditCard /> Apply for Loan
                                </button>
                              );
                            })()
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Contract Preview Modal */}
      {showPreviewModal && selectedContract && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full p-6 relative">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Contract Details</h2>
                <button
                  onClick={() => {
                    setShowPreviewModal(false);
                    setSelectedContract(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
                >
                  <FaTimes />
                </button>
              </div>
              <ContractPreview
                contract={selectedContract}
                listing={selectedContract.listingId}
                tenant={selectedContract.tenantId}
                landlord={selectedContract.landlordId}
                onDownload={() => {
                  handleDownload(selectedContract);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Contract Review Modal (for seller/landlord) */}
      {showReviewModal && signingContract && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full p-6 relative">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Review Contract</h2>
                <button
                  onClick={() => {
                    setShowReviewModal(false);
                    setSigningContract(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
                >
                  <FaTimes />
                </button>
              </div>

              <ContractPreview
                contract={signingContract}
                listing={signingContract.listingId}
                tenant={signingContract.tenantId}
                landlord={signingContract.landlordId}
                onDownload={() => {
                  handleDownload(signingContract);
                }}
              />

              {/* Signature Section for Landlord */}
              {(() => {
                const userRole = getUserRole(signingContract);
                const isLandlord = userRole === 'landlord';
                const landlordSigned = signingContract.landlordSignature?.signed;

                if (isLandlord && signingContract.status === 'pending_signature') {
                  return (
                    <div className="mt-6 p-6 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-gray-200 dark:border-gray-600">
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <FaPen className="text-blue-600 dark:text-blue-400" /> Your Signature Required
                      </h3>

                      {landlordSigned ? (
                        <div className="bg-green-50 border border-green-200 dark:bg-green-900/10 dark:border-green-800 rounded-lg p-4 mb-4">
                          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                            <FaCheckCircle /> You have already signed this contract.
                          </div>
                          {signingContract.landlordSignature?.signedAt && (
                            <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                              Signed on: {new Date(signingContract.landlordSignature.signedAt).toLocaleString('en-GB')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div>
                          {!signingContract.tenantSignature?.signed ? (
                            <div className="bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-800 rounded-lg p-4 mb-4">
                              <p className="text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                                <FaClock /> Waiting for tenant to sign the contract first.
                              </p>
                              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                As per procedure, the tenant must review and sign the contract before the landlord can finalize it.
                              </p>
                            </div>
                          ) : (
                            <p className="text-gray-600 dark:text-gray-300 mb-4">
                              Please review the contract above. If you agree to the terms, please sign below to proceed.
                            </p>
                          )}
                          <button
                            onClick={() => handleSignatureClick(signingContract)}
                            disabled={!signingContract.tenantSignature?.signed}
                            className={`px-6 py-3 rounded-lg flex items-center gap-2 font-semibold transition-all ${signingContract.tenantSignature?.signed
                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                                : 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                              }`}
                          >
                            <FaPen /> Sign Contract
                          </button>
                        </div>
                      )}

                      {/* Signature Status */}
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Tenant Signature:</span>
                            <span className={`ml-2 flex items-center gap-1 ${signingContract.tenantSignature?.signed ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                              {signingContract.tenantSignature?.signed ? (
                                <><FaCheckCircle /> Signed</>
                              ) : (
                                <><FaTimesCircle /> Pending</>
                              )}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Your Signature:</span>
                            <span className={`ml-2 flex items-center gap-1 ${landlordSigned ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                              {landlordSigned ? (
                                <><FaCheckCircle /> Signed</>
                              ) : (
                                <><FaTimesCircle /> Pending</>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Digital Signature Modal */}
      {showSignatureModal && signingContract && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full p-6 relative">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Sign Contract</h2>
              </div>
              <DigitalSignature
                onSign={handleSignatureConfirm}
                onCancel={() => {
                  setShowSignatureModal(false);
                  setSigningContract(null);
                }}
                title="Sign as Landlord"
                userName={currentUser?.username || 'Landlord'}
                disabled={actionLoading === 'signing'}
              />
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && contractToReject && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Reject Appointment</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
              Are you sure you want to reject this appointment? This action cannot be undone and the contract will be cancelled.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reason for rejection (optional)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Property no longer available, Scheduling conflict..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                rows="3"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setContractToReject(null);
                  setRejectionReason('');
                }}
                disabled={actionLoading !== ''}
                className="px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRejectAppointment}
                disabled={actionLoading !== ''}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {actionLoading === `reject-${contractToReject._id}` ? (
                  <><FaSpinner className="animate-spin" /> Rejecting...</>
                ) : (
                  'Reject Appointment'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

