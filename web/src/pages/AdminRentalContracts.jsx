import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaFileContract, FaDownload, FaEye, FaCalendarAlt, FaMoneyBillWave, FaLock, FaCheckCircle, FaTimesCircle, FaSearch, FaBan, FaCheck, FaUser, FaHome, FaGavel, FaWallet, FaCreditCard, FaExclamationTriangle, FaClock, FaTimes, FaHistory } from 'react-icons/fa';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import { usePageTitle } from '../hooks/usePageTitle';
import ContractPreview from '../components/rental/ContractPreview';
import AdminRentalContractsSkeleton from '../components/skeletons/AdminRentalContractsSkeleton';
import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Modal wrapper component to prevent background scrolling
const ContractModalWrapper = ({ children, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      style={{ overflow: 'hidden' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {children}
    </div>
  );
};

export default function AdminRentalContracts() {
  usePageTitle("Admin Rental Contracts - UrbanSetu");

  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();

  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContract, setSelectedContract] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusAction, setStatusAction] = useState(null); // 'terminate', 'reject', 'activate'
  const [statusReason, setStatusReason] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    if (!currentUser) {
      navigate('/sign-in');
      return;
    }

    if (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin') {
      navigate('/user');
      return;
    }

    // Only fetch on initial load or user change, not on filter changes
    if (contracts.length === 0) {
      fetchAllContracts();
    }
  }, [currentUser, navigate]);

  // Listen for payment status updates
  useEffect(() => {
    const handlePaymentUpdate = (event) => {
      const { contractId, paymentId, paymentConfirmed } = event.detail || {};
      if (contractId || paymentConfirmed) {
        // Refresh contracts when payment status is updated
        fetchAllContracts(false); // Don't show loading spinner on refresh
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

  const fetchAllContracts = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      // Always fetch all contracts, apply filters client-side
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts/all`);

      const data = await res.json();
      if (res.ok && data.success) {
        setContracts(data.contracts || []);
      } else {
        toast.error(data.message || 'Failed to fetch contracts');
      }
    } catch (error) {
      console.error('Error fetching contracts:', error);
      toast.error('Failed to load contracts');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Client-side filtering for search and status
  const filteredContracts = React.useMemo(() => {
    let filtered = contracts;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(contract => contract.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(contract =>
        contract.contractId?.toLowerCase().includes(query) ||
        contract.listingId?.name?.toLowerCase().includes(query) ||
        contract.listingId?.address?.toLowerCase().includes(query) ||
        contract.tenantId?.username?.toLowerCase().includes(query) ||
        contract.tenantId?.email?.toLowerCase().includes(query) ||
        contract.landlordId?.username?.toLowerCase().includes(query) ||
        contract.landlordId?.email?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [contracts, statusFilter, searchQuery]);

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

  const handleUpdateStatus = async (action) => {
    if (!selectedContract) return;

    let newStatus = '';
    if (action === 'terminate') {
      newStatus = 'terminated';
      if (!statusReason.trim()) {
        toast.error('Please provide a termination reason');
        return;
      }
    } else if (action === 'reject') {
      newStatus = 'rejected';
      if (!statusReason.trim()) {
        toast.error('Please provide a rejection reason');
        return;
      }
    } else if (action === 'activate') {
      newStatus = 'active';
    }

    try {
      setActionLoading(action);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts/${selectedContract.contractId || selectedContract._id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          reason: statusReason || undefined
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || `Contract ${newStatus} successfully`);
        setShowStatusModal(false);
        setStatusReason('');
        setSelectedContract(null);
        await fetchAllContracts();
      } else {
        toast.error(data.message || 'Failed to update contract status');
      }
    } catch (error) {
      console.error('Error updating contract status:', error);
      toast.error('Failed to update contract status');
    } finally {
      setActionLoading('');
    }
  };

  const openStatusModal = (contract, action) => {
    setSelectedContract(contract);
    setStatusAction(action);
    setStatusReason('');
    setShowStatusModal(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
      case 'pending_signature':
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

  const getStatusLabel = (status) => {
    return status?.replace('_', ' ').toUpperCase() || 'UNKNOWN';
  };

  // Statistics
  const stats = React.useMemo(() => {
    return {
      total: contracts.length,
      active: contracts.filter(c => c.status === 'active').length,
      pending: contracts.filter(c => c.status === 'pending_signature' || c.status === 'draft').length,
      terminated: contracts.filter(c => c.status === 'terminated' || c.status === 'rejected' || c.status === 'expired').length
    };
  }, [contracts]);

  if (loading && contracts.length === 0) {
    return <AdminRentalContractsSkeleton />;
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 min-h-screen py-10 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                <FaFileContract className="text-blue-600 dark:text-blue-400" />
                Admin Rental Contracts
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">Manage all rental contracts across the platform</p>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Contracts</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.total}</p>
                </div>
                <FaFileContract className="text-3xl text-blue-500 dark:text-blue-400" />
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.active}</p>
                </div>
                <FaCheckCircle className="text-3xl text-green-500 dark:text-green-400" />
              </div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{stats.pending}</p>
                </div>
                <FaClock className="text-3xl text-yellow-500 dark:text-yellow-400" />
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Terminated/Rejected</p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">{stats.terminated}</p>
                </div>
                <FaTimesCircle className="text-3xl text-red-500 dark:text-red-400" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search by contract ID, property, tenant, or landlord..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {['all', 'active', 'pending_signature', 'draft', 'expired', 'terminated', 'rejected'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${statusFilter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                >
                  {status === 'all' ? 'All Contracts' : getStatusLabel(status)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredContracts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
            <FaFileContract className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No Contracts Found</h3>
            <p className="text-gray-500 dark:text-gray-400">No contracts match your search criteria.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredContracts.map((contract) => {
              const listingId = contract.listingId?._id || contract.listingId;
              const listingName = contract.listingId?.name || 'Property Contract';
              return (
                <div
                  key={contract._id}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 ${getStatusColor(contract.status)} border-opacity-50 dark:border-opacity-30`}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <FaFileContract className="text-2xl text-blue-600 dark:text-blue-400" />
                        <div>
                          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                            {listingId ? (
                              <Link to={`/listing/${listingId}`} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline">
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
                          <p className="font-semibold text-gray-800 dark:text-white">
                            ₹{contract.lockedRentAmount?.toLocaleString('en-IN') || '0'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                            <FaLock className="text-purple-600 dark:text-purple-400" /> Duration
                          </p>
                          <p className="font-semibold text-gray-800 dark:text-white">{contract.lockDuration} months</p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                            <FaCalendarAlt className="text-indigo-600 dark:text-indigo-400" /> Start Date
                          </p>
                          <p className="font-semibold text-gray-800 dark:text-white">
                            {contract.startDate ? new Date(contract.startDate).toLocaleDateString('en-GB') : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                            <FaUser className="text-blue-600 dark:text-blue-400" /> Tenant
                          </p>
                          <p className="font-semibold text-gray-800 dark:text-white">{contract.tenantId?.username || contract.tenantId?.email || 'N/A'}</p>
                        </div>
                      </div>

                      {/* Signature Status */}
                      <div className="mt-4 flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Tenant:</span>
                          {contract.tenantSignature?.signed ? (
                            <FaCheckCircle className="text-green-600 dark:text-green-400" title="Signed" />
                          ) : (
                            <FaTimesCircle className="text-yellow-600 dark:text-yellow-400" title="Pending" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Landlord:</span>
                          {contract.landlordSignature?.signed ? (
                            <FaCheckCircle className="text-green-600 dark:text-green-400" title="Signed" />
                          ) : (
                            <FaTimesCircle className="text-yellow-600 dark:text-yellow-400" title="Pending" />
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
                                  {payment.status === 'processing' && <UrbanSetuSpinner size="xs" />}
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
                      <button
                        onClick={() => handleView(contract)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                      >
                        <FaEye /> View Details
                      </button>
                      <button
                        onClick={() => handleDownload(contract)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                      >
                        <FaDownload /> Download PDF
                      </button>

                      {/* Admin Actions */}
                      {contract.status === 'active' && (
                        <button
                          onClick={() => openStatusModal(contract, 'terminate')}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2"
                        >
                          <FaBan /> Terminate
                        </button>
                      )}
                      {(contract.status === 'pending_signature' || contract.status === 'draft') && (
                        <>
                          <button
                            onClick={() => openStatusModal(contract, 'reject')}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                          >
                            <FaTimesCircle /> Reject
                          </button>
                          {contract.tenantSignature?.signed && contract.landlordSignature?.signed && (
                            <button
                              onClick={() => openStatusModal(contract, 'activate')}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                            >
                              <FaCheck /> Activate
                            </button>
                          )}
                        </>
                      )}
                      {contract.status === 'active' && (
                        <button
                          onClick={() => navigate(`/admin/rent-wallet?contractId=${contract._id}`)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
                        >
                          <FaWallet /> Monitor Rent
                        </button>
                      )}
                      {contract.status === 'active' && contract.walletId && (
                        <button
                          onClick={() => navigate(`/admin/payments?contractId=${contract._id}`)}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2"
                        >
                          <FaHistory /> Payment History
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contract Preview Modal */}
      {showPreviewModal && selectedContract && (
        <ContractModalWrapper onClose={() => {
          setShowPreviewModal(false);
          setSelectedContract(null);
        }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Contract Details</h2>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setSelectedContract(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
              >
                ×
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
        </ContractModalWrapper>
      )}

      {/* Status Update Modal */}
      {showStatusModal && selectedContract && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                  {statusAction === 'terminate' ? 'Terminate Contract' :
                    statusAction === 'reject' ? 'Reject Contract' :
                      'Activate Contract'}
                </h2>
                <button
                  onClick={() => {
                    setShowStatusModal(false);
                    setStatusReason('');
                    setSelectedContract(null);
                    setStatusAction(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="mb-4">
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  Contract ID: <span className="font-mono font-semibold dark:text-gray-200">{selectedContract.contractId}</span>
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  Property: <span className="font-semibold dark:text-gray-200">{selectedContract.listingId?.name || 'N/A'}</span>
                </p>
              </div>

              {(statusAction === 'terminate' || statusAction === 'reject') && (
                <div className="mb-4">
                  <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">
                    Reason * <FaExclamationTriangle className="inline text-red-500" />
                  </label>
                  <textarea
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder={`Enter reason for ${statusAction === 'terminate' ? 'termination' : 'rejection'}...`}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    required
                  />
                </div>
              )}

              {statusAction === 'activate' && (
                <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                    <FaExclamationTriangle /> This will activate the contract. Make sure both parties have signed.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowStatusModal(false);
                    setStatusReason('');
                    setSelectedContract(null);
                    setStatusAction(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdateStatus(statusAction)}
                  disabled={actionLoading !== '' || ((statusAction === 'terminate' || statusAction === 'reject') && !statusReason.trim())}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 ${statusAction === 'terminate' || statusAction === 'reject'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {actionLoading === statusAction ? (
                    <>
                      <UrbanSetuSpinner size="xs" isBright={true} /> Processing...
                    </>
                  ) : (
                    <>
                      {statusAction === 'terminate' ? (
                        <> <FaBan /> Terminate Contract </>
                      ) : statusAction === 'reject' ? (
                        <> <FaTimesCircle /> Reject Contract </>
                      ) : (
                        <> <FaCheck /> Activate Contract </>
                      )}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

