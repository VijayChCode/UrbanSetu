import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaCreditCard, FaSpinner, FaSearch, FaTimes, FaCheckCircle, FaClock, FaTimesCircle, FaHome, FaUser, FaMoneyBillWave, FaCheck, FaBan, FaDownload, FaFile, FaSync } from 'react-icons/fa';
import { usePageTitle } from '../hooks/usePageTitle';
import LoanStatusDisplay from '../components/loans/LoanStatusDisplay';
import AdminRentalLoansSkeleton from '../components/skeletons/AdminRentalLoansSkeleton';
import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  approved: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  disbursed: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  rejected: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  repaid: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  defaulted: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800'
};

const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  disbursed: 'Disbursed',
  rejected: 'Rejected',
  repaid: 'Repaid',
  defaulted: 'Defaulted'
};

const LOAN_TYPE_LABELS = {
  security_deposit: 'Security Deposit',
  first_month_rent: 'First Month Rent',
  maintenance_charges: 'Maintenance Charges'
};

export default function AdminRentalLoans() {
  usePageTitle("Admin Rental Loans - UrbanSetu");

  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();

  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loanTypeFilter, setLoanTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [showLoanDisplay, setShowLoanDisplay] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  // Approve modal fields
  const [eligibilityCheck, setEligibilityCheck] = useState({
    passed: false,
    creditScore: null,
    incomeVerified: false,
    employmentVerified: false,
    eligibilityScore: null
  });
  const [adminNotes, setAdminNotes] = useState('');
  const [disbursementDate, setDisbursementDate] = useState('');

  // Reject modal fields
  const [rejectionReason, setRejectionReason] = useState('');

  // Disburse modal fields
  const [disbursedAmount, setDisbursedAmount] = useState('');
  const [disbursementReference, setDisbursementReference] = useState('');

  // Defaulted Loan Actions
  const [showLegalNoticeModal, setShowLegalNoticeModal] = useState(false);
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [showBlockUserModal, setShowBlockUserModal] = useState(false);
  const [writeOffAction, setWriteOffAction] = useState('settle');
  const [writeOffNotes, setWriteOffNotes] = useState('');
  const [writeOffAmount, setWriteOffAmount] = useState('');

  useEffect(() => {
    if (!currentUser) {
      navigate('/sign-in');
      return;
    }

    if (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin') {
      navigate('/user');
      return;
    }

    // Only fetch on initial load, not on filter changes
    if (loans.length === 0) {
      fetchAllLoans();
    }
  }, [currentUser, navigate]);

  const fetchAllLoans = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      // Fetch all loans, apply filters client-side
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/loans`);

      const data = await res.json();
      if (res.ok && data.success) {
        setLoans(data.loans || []);
      } else {
        toast.error(data.message || 'Failed to fetch loans');
      }
    } catch (error) {
      console.error('Error fetching loans:', error);
      toast.error('Failed to load loans');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Client-side filtering for search, status, and loanType
  const filteredLoans = React.useMemo(() => {
    let filtered = loans;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(loan => loan.status === statusFilter);
    }

    // Filter by loanType
    if (loanTypeFilter !== 'all') {
      filtered = filtered.filter(loan => loan.loanType === loanTypeFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(loan =>
        loan.loanId?.toLowerCase().includes(query) ||
        loan.userId?.username?.toLowerCase().includes(query) ||
        loan.userId?.email?.toLowerCase().includes(query) ||
        loan.contractId?.contractId?.toLowerCase().includes(query) ||
        loan.contractId?.listingId?.name?.toLowerCase().includes(query) ||
        loan.contractId?.listingId?.address?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [loans, searchQuery, statusFilter, loanTypeFilter]);

  const handleViewLoan = async (loan) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/loans/${loan._id}`);

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setSelectedLoan(data.loan);
        setShowLoanDisplay(true);
      } else {
        setSelectedLoan(loan);
        setShowLoanDisplay(true);
        toast.error(data.message || 'Unable to fetch latest loan details. Showing cached data.');
      }
    } catch (error) {
      console.error('Error fetching loan:', error);
      setSelectedLoan(loan);
      setShowLoanDisplay(true);
      toast.error('Failed to reach server. Showing cached data.');
    }
  };

  const handleApprove = async () => {
    if (!selectedLoan) return;

    try {
      setActionLoading('approve');
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/loans/${selectedLoan._id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eligibilityCheck,
          adminNotes: adminNotes || undefined,
          disbursementDate: disbursementDate || undefined
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Loan approved successfully');
        setShowApproveModal(false);
        resetApproveFields();
        await fetchAllLoans();
        if (showLoanDisplay) {
          handleViewLoan({ _id: selectedLoan._id });
        }
      } else {
        toast.error(data.message || 'Failed to approve loan');
      }
    } catch (error) {
      console.error('Error approving loan:', error);
      toast.error('Failed to approve loan');
    } finally {
      setActionLoading('');
    }
  };

  const handleReject = async () => {
    if (!selectedLoan || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setActionLoading('reject');
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/loans/${selectedLoan._id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rejectionReason,
          adminNotes: adminNotes || undefined
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Loan rejected');
        setShowRejectModal(false);
        resetRejectFields();
        await fetchAllLoans();
        if (showLoanDisplay) {
          handleViewLoan({ _id: selectedLoan._id });
        }
      } else {
        toast.error(data.message || 'Failed to reject loan');
      }
    } catch (error) {
      console.error('Error rejecting loan:', error);
      toast.error('Failed to reject loan');
    } finally {
      setActionLoading('');
    }
  };

  const handleDisburse = async () => {
    if (!selectedLoan) return;

    try {
      setActionLoading('disburse');
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/loans/${selectedLoan._id}/disburse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disbursedAmount: disbursedAmount || undefined,
          disbursementReference: disbursementReference || undefined
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Loan disbursed successfully');
        setShowDisburseModal(false);
        resetDisburseFields();
        await fetchAllLoans();
        if (showLoanDisplay) {
          handleViewLoan({ _id: selectedLoan._id });
        }
      } else {
        toast.error(data.message || 'Failed to disburse loan');
      }
    } catch (error) {
      console.error('Error disbursing loan:', error);
      toast.error('Failed to disburse loan');
    } finally {
      setActionLoading('');
    }
  };

  const handleSendLegalNotice = async () => {
    if (!selectedLoan) return;
    try {
      setActionLoading('legal_notice');
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/loans/${selectedLoan._id}/send-legal-notice`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        setShowLegalNoticeModal(false);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to send notice');
    } finally {
      setActionLoading('');
    }
  };

  const handleWriteOff = async () => {
    if (!selectedLoan) return;
    try {
      setActionLoading('write_off');
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/loans/${selectedLoan._id}/write-off`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: writeOffAction,
          notes: writeOffNotes,
          amount: writeOffAmount ? parseFloat(writeOffAmount) : undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        setShowWriteOffModal(false);
        setWriteOffNotes('');
        setWriteOffAmount('');
        fetchAllLoans();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to update loan');
    } finally {
      setActionLoading('');
    }
  };

  const handleBlockUser = async () => {
    if (!selectedLoan) return;
    try {
      setActionLoading('block_user');
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/loans/${selectedLoan._id}/block-user`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        setShowBlockUserModal(false);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to block user');
    } finally {
      setActionLoading('');
    }
  };

  const resetApproveFields = () => {
    setEligibilityCheck({
      passed: false,
      creditScore: null,
      incomeVerified: false,
      employmentVerified: false,
      eligibilityScore: null
    });
    setAdminNotes('');
    setDisbursementDate('');
  };

  const resetRejectFields = () => {
    setRejectionReason('');
    setAdminNotes('');
  };

  const resetDisburseFields = () => {
    setDisbursedAmount('');
    setDisbursementReference('');
  };

  const formatCurrency = (amount) => {
    return `₹${amount?.toLocaleString('en-IN') || 0}`;
  };

  // Statistics
  const stats = React.useMemo(() => {
    return {
      total: loans.length,
      pending: loans.filter(l => l.status === 'pending').length,
      approved: loans.filter(l => l.status === 'approved').length,
      disbursed: loans.filter(l => l.status === 'disbursed').length,
      rejected: loans.filter(l => l.status === 'rejected').length
    };
  }, [loans]);

  if (loading && loans.length === 0) {
    return <AdminRentalLoansSkeleton />;
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 min-h-screen py-10 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                <FaCreditCard className="text-blue-600 dark:text-blue-400" />
                Admin Rental Loans
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">Manage all rental loan applications across the platform</p>
            </div>
            <button
              onClick={() => fetchAllLoans()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors self-end md:self-auto shadow-lg"
            >
              <FaSync className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Total Loans</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.total}</p>
                </div>
                <FaCreditCard className="text-3xl text-blue-500 dark:text-blue-400" />
              </div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Pending</p>
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{stats.pending}</p>
                </div>
                <FaClock className="text-3xl text-yellow-500 dark:text-yellow-400" />
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Approved</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.approved}</p>
                </div>
                <FaCheckCircle className="text-3xl text-blue-500 dark:text-blue-400" />
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Disbursed</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.disbursed}</p>
                </div>
                <FaCheckCircle className="text-3xl text-green-500 dark:text-green-400" />
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Rejected</p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">{stats.rejected}</p>
                </div>
                <FaTimesCircle className="text-3xl text-red-500 dark:text-red-400" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by loan ID, user, contract, or property..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="disbursed">Disbursed</option>
              <option value="rejected">Rejected</option>
              <option value="repaid">Repaid</option>
              <option value="defaulted">Defaulted</option>
            </select>
            <select
              value={loanTypeFilter}
              onChange={(e) => setLoanTypeFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">All Types</option>
              <option value="security_deposit">Security Deposit</option>
              <option value="first_month_rent">First Month Rent</option>
              <option value="maintenance_charges">Maintenance Charges</option>
            </select>
          </div>
        </div>

        {filteredLoans.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
            <FaCreditCard className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No Loans Found</h3>
            <p className="text-gray-500 dark:text-gray-400">No loans match your search criteria.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLoans.map((loan) => {
              const status = loan.status;
              const contract = loan.contractId;
              const listingId = contract?.listingId?._id || contract?.listingId;
              const listingName = contract?.listingId?.name || 'Unknown';

              return (
                <div
                  key={loan._id}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 ${STATUS_COLORS[status] || STATUS_COLORS.pending}`}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                          {LOAN_TYPE_LABELS[loan.loanType] || loan.loanType}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${STATUS_COLORS[status] || STATUS_COLORS.pending}`}>
                          {STATUS_LABELS[status] || status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-mono mb-2">Loan ID: {loan.loanId}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Applicant</p>
                          <p className="font-semibold text-gray-800 dark:text-gray-200">{loan.userId?.username || 'N/A'}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{loan.userId?.email || ''}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Loan Amount</p>
                          <p className="font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(loan.loanAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">EMI Amount</p>
                          <p className="font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(loan.emiAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Interest Rate</p>
                          <p className="font-semibold text-gray-800 dark:text-gray-200">{loan.interestRate}% p.a.</p>
                        </div>
                      </div>
                      {contract && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                            <FaHome className="inline mr-1" /> Property:{' '}
                            {listingId ? (
                              <Link to={`/listing/${listingId}`} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline">
                                {listingName}
                              </Link>
                            ) : (
                              listingName
                            )}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            <FaFile className="inline mr-1" /> Contract: {contract.contractId || 'Unknown'}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleViewLoan(loan)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                      >
                        <FaUser /> View Details
                      </button>

                      {/* Admin Actions */}
                      {loan.status === 'pending' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedLoan(loan);
                              setEligibilityCheck(loan.eligibilityCheck || {
                                passed: false,
                                creditScore: null,
                                incomeVerified: false,
                                employmentVerified: false,
                                eligibilityScore: null
                              });
                              setShowApproveModal(true);
                            }}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                          >
                            <FaCheck /> Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedLoan(loan);
                              setShowRejectModal(true);
                            }}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                          >
                            <FaBan /> Reject
                          </button>
                        </>
                      )}
                      {loan.status === 'approved' && (
                        <button
                          onClick={() => {
                            setSelectedLoan(loan);
                            setDisbursedAmount(loan.loanAmount?.toString() || '');
                            setShowDisburseModal(true);
                          }}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2"
                        >
                          <FaDownload /> Disburse
                        </button>
                      )}
                      {loan.status === 'defaulted' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedLoan(loan);
                              setShowLegalNoticeModal(true);
                            }}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2"
                          >
                            <FaFile /> Legal Notice
                          </button>
                          <button
                            onClick={() => {
                              setSelectedLoan(loan);
                              setWriteOffAmount(loan.totalRemaining?.toString() || '');
                              setWriteOffNotes('');
                              setWriteOffAction('settle');
                              setShowWriteOffModal(true);
                            }}
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2"
                          >
                            <FaMoneyBillWave /> Settle/Write-off
                          </button>
                          <button
                            onClick={() => {
                              setSelectedLoan(loan);
                              setShowBlockUserModal(true);
                            }}
                            className="px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 flex items-center justify-center gap-2"
                          >
                            <FaBan /> Block User
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Loan Details Modal */}
      {showLoanDisplay && selectedLoan && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full p-6 relative">
              <div className="flex items-center justify-between mb-4 border-b dark:border-gray-700 pb-2">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Loan Details</h2>
                <button
                  onClick={() => {
                    setShowLoanDisplay(false);
                    setSelectedLoan(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
                >
                  <FaTimes />
                </button>
              </div>
              <LoanStatusDisplay
                loan={selectedLoan}
                currentUser={currentUser}
                onUpdate={() => {
                  fetchAllLoans();
                  if (selectedLoan) {
                    handleViewLoan({ _id: selectedLoan._id });
                  }
                }}
                STATUS_COLORS={STATUS_COLORS}
                STATUS_LABELS={STATUS_LABELS}
                LOAN_TYPE_LABELS={LOAN_TYPE_LABELS}
              />
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedLoan && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative">
              <div className="flex items-center justify-between mb-4 border-b dark:border-gray-700 pb-2">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Approve Loan</h2>
                <button
                  onClick={() => {
                    setShowApproveModal(false);
                    resetApproveFields();
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">Loan ID</label>
                  <p className="text-gray-600 dark:text-gray-400 font-mono">{selectedLoan.loanId}</p>
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">Eligibility Check</label>
                  <div className="space-y-2 text-gray-700 dark:text-gray-300">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={eligibilityCheck.passed}
                        onChange={(e) => setEligibilityCheck({ ...eligibilityCheck, passed: e.target.checked })}
                        className="rounded dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500"
                      />
                      <span>Eligibility Passed</span>
                    </label>
                    <input
                      type="number"
                      placeholder="Credit Score (300-900)"
                      value={eligibilityCheck.creditScore || ''}
                      onChange={(e) => setEligibilityCheck({ ...eligibilityCheck, creditScore: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      min="300"
                      max="900"
                    />
                    <input
                      type="number"
                      placeholder="Eligibility Score (0-100)"
                      value={eligibilityCheck.eligibilityScore || ''}
                      onChange={(e) => setEligibilityCheck({ ...eligibilityCheck, eligibilityScore: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      min="0"
                      max="100"
                    />
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={eligibilityCheck.incomeVerified}
                        onChange={(e) => setEligibilityCheck({ ...eligibilityCheck, incomeVerified: e.target.checked })}
                        className="rounded dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span>Income Verified</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={eligibilityCheck.employmentVerified}
                        onChange={(e) => setEligibilityCheck({ ...eligibilityCheck, employmentVerified: e.target.checked })}
                        className="rounded dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500"
                      />
                      <span>Employment Verified</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">Disbursement Date (Optional)</label>
                  <input
                    type="date"
                    value={disbursementDate}
                    onChange={(e) => setDisbursementDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">If provided, loan will be marked as disbursed immediately</p>
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">Admin Notes (Optional)</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Add any notes for this approval..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowApproveModal(false);
                      resetApproveFields();
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading === 'approve'}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {actionLoading === 'approve' ? (
                      <>
                        <FaSpinner className="animate-spin" /> Approving...
                      </>
                    ) : (
                      <>
                        <FaCheck /> Approve Loan
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedLoan && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative">
              <div className="flex items-center justify-between mb-4 border-b dark:border-gray-700 pb-2">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Reject Loan</h2>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    resetRejectFields();
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">Loan ID</label>
                  <p className="text-gray-600 dark:text-gray-400 font-mono">{selectedLoan.loanId}</p>
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">Rejection Reason *</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Provide a reason for rejection..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">Admin Notes (Optional)</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Add any internal notes..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowRejectModal(false);
                      resetRejectFields();
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={actionLoading === 'reject' || !rejectionReason.trim()}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {actionLoading === 'reject' ? (
                      <>
                        <FaSpinner className="animate-spin" /> Rejecting...
                      </>
                    ) : (
                      <>
                        <FaBan /> Reject Loan
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disburse Modal */}
      {showDisburseModal && selectedLoan && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative">
              <div className="flex items-center justify-between mb-4 border-b dark:border-gray-700 pb-2">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Disburse Loan</h2>
                <button
                  onClick={() => {
                    setShowDisburseModal(false);
                    resetDisburseFields();
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">Loan ID</label>
                  <p className="text-gray-600 dark:text-gray-400 font-mono">{selectedLoan.loanId}</p>
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">Approved Amount</label>
                  <p className="text-gray-600 dark:text-gray-300 font-semibold">{formatCurrency(selectedLoan.loanAmount)}</p>
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">Disbursed Amount</label>
                  <input
                    type="number"
                    value={disbursedAmount}
                    onChange={(e) => setDisbursedAmount(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder={`Default: ${formatCurrency(selectedLoan.loanAmount)}`}
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">Disbursement Reference (Optional)</label>
                  <input
                    type="text"
                    value={disbursementReference}
                    onChange={(e) => setDisbursementReference(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Transaction reference number..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDisburseModal(false);
                      resetDisburseFields();
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDisburse}
                    disabled={actionLoading === 'disburse'}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {actionLoading === 'disburse' ? (
                      <>
                        <FaSpinner className="animate-spin" /> Disbursing...
                      </>
                    ) : (
                      <>
                        <FaDownload /> Disburse Loan
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legal Notice Modal */}
      {showLegalNoticeModal && selectedLoan && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-6 relative text-center">
              <FaFile className="text-5xl text-orange-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Send Legal Notice?</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                This will send a formal legal warning to <strong>{selectedLoan.userId?.username}</strong> regarding their default status.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowLegalNoticeModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendLegalNotice}
                  disabled={actionLoading === 'legal_notice'}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2 disabled:opacity-50"
                >
                  {actionLoading === 'legal_notice' ? <FaSpinner className="animate-spin" /> : 'Send Notice'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Write Off Modal */}
      {showWriteOffModal && selectedLoan && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Settle or Write Off Loan</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">Action Type</label>
                  <select
                    value={writeOffAction}
                    onChange={(e) => setWriteOffAction(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="settle">Settle (Payment Received)</option>
                    <option value="write_off">Write Off (Bad Debt)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">
                    {writeOffAction === 'settle' ? 'Settlement Amount' : 'Amount Written Off'}
                  </label>
                  <input
                    type="number"
                    value={writeOffAmount}
                    onChange={(e) => setWriteOffAmount(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">Notes/Reason</label>
                  <textarea
                    value={writeOffNotes}
                    onChange={(e) => setWriteOffNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Enter details about the settlement or write-off..."
                  />
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowWriteOffModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWriteOff}
                    disabled={actionLoading === 'write_off'}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === 'write_off' ? <FaSpinner className="animate-spin" /> : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Block User Modal */}
      {showBlockUserModal && selectedLoan && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-6 relative text-center">
              <FaBan className="text-5xl text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Block User?</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to suspend <strong>{selectedLoan.userId?.username}</strong>? This will define them as 'Suspended' and prevent further access.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowBlockUserModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBlockUser}
                  disabled={actionLoading === 'block_user'}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
                >
                  {actionLoading === 'block_user' ? <FaSpinner className="animate-spin" /> : 'Block User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

