import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaCreditCard, FaFileUpload, FaSpinner, FaSearch, FaTimes, FaCheckCircle, FaClock, FaTimesCircle, FaHome, FaUser, FaMoneyBillWave } from 'react-icons/fa';
import { usePageTitle } from '../hooks/usePageTitle';
import LoanApplicationForm from '../components/loans/LoanApplicationForm';
import LoanStatusDisplay from '../components/loans/LoanStatusDisplay';
import UserRentalLoansSkeleton from '../components/skeletons/UserRentalLoansSkeleton';
import { authenticatedFetch } from '../utils/auth';
import PaymentModal from '../components/PaymentModal';

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

export default function RentalLoans() {
  usePageTitle("Rental Loans - UrbanSetu");

  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const location = useLocation();

  const [loans, setLoans] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContract, setSelectedContract] = useState(null);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [showLoanDisplay, setShowLoanDisplay] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    loanType: 'all',
    search: ''
  });

  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentEMI, setPaymentEMI] = useState(null);
  const [paymentLoan, setPaymentLoan] = useState(null);
  const [paymentIndex, setPaymentIndex] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/sign-in');
      return;
    }
    // Only fetch on initial load, not on filter changes
    if (loans.length === 0) {
      fetchLoans();
    }
    fetchContracts();
  }, [currentUser, navigate]);

  // Handle URL parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const contractIdParam = searchParams.get('contractId');
    const loanIdParam = searchParams.get('loanId');

    if (contractIdParam && contracts.length > 0) {
      const contract = contracts.find(c =>
        c._id === contractIdParam || c.contractId === contractIdParam
      );

      if (contract) {
        handleApplyForLoan(contract);
        navigate('/user/rental-loans', { replace: true });
      }
    }

    if (loanIdParam && loans.length > 0) {
      const loan = loans.find(l =>
        l._id === loanIdParam || l.loanId === loanIdParam
      );

      if (loan) {
        handleViewLoan(loan);
        navigate('/user/rental-loans', { replace: true });
      }
    }
  }, [location.search, contracts, loans]);

  const fetchLoans = async (showLoading = true) => {
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

  // Client-side filtering
  const memoizedFilteredLoans = React.useMemo(() => {
    let filtered = loans;

    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter(loan => loan.status === filters.status);
    }

    // Filter by loanType
    if (filters.loanType !== 'all') {
      filtered = filtered.filter(loan => loan.loanType === filters.loanType);
    }

    // Filter by search query
    if (filters.search) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter(loan =>
        loan.loanId?.toLowerCase().includes(query) ||
        loan.contractId?.contractId?.toLowerCase().includes(query) ||
        loan.contractId?.listingId?.name?.toLowerCase().includes(query) ||
        loan.contractId?.listingId?.address?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [loans, filters]);
  const filteredLoans = memoizedFilteredLoans;

  const fetchContracts = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts?status=active`);

      const data = await res.json();
      if (res.ok && data.success) {
        // Filter only contracts where user is tenant
        const tenantContracts = (data.contracts || []).filter(contract =>
          contract.tenantId?._id === currentUser._id || contract.tenantId === currentUser._id
        );
        setContracts(tenantContracts);
      }
    } catch (error) {
      console.error('Error fetching contracts:', error);
    }
  };

  const handleApplyForLoan = (contract) => {
    setSelectedContract(contract);
    setShowLoanForm(true);
  };

  const handleViewLoan = async (loan) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/loans/${loan._id}`);

      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedLoan(data.loan);
        setShowLoanDisplay(true);
      }
    } catch (error) {
      console.error('Error fetching loan:', error);
      toast.error('Failed to fetch loan details');
    }
  };

  const handleLoanSubmitted = () => {
    setShowLoanForm(false);
    setSelectedContract(null);
    fetchLoans();
    toast.success('Loan application submitted successfully');
  };

  const handleLoanUpdated = () => {
    fetchLoans();
    if (selectedLoan) {
      handleViewLoan(selectedLoan);
    }
  };

  const handlePayEMI = (emi, index) => {
    if (!selectedLoan) return;

    setPaymentEMI(emi);
    setPaymentLoan(selectedLoan);
    setPaymentIndex(index);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async (payment) => {
    toast.success('EMI Payment Successful!');
    setShowPaymentModal(false);

    // Refresh loans to show updated status
    await fetchLoans(false);

    // If the modal was open, update the selected loan to reflect changes
    if (selectedLoan) {
      // Find the updated loan from the newly fetched loans list
      // We use a small timeout to ensure fetchLoans has finished updating state if needed, 
      // or just fetch it directly again to be sure
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/loans/${selectedLoan._id}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setSelectedLoan(data.loan);
        }
      } catch (e) {
        console.error("Failed to refresh selected loan after payment", e);
      }
    }
  };

  const formatCurrency = (amount) => {
    return `₹${amount?.toLocaleString('en-IN') || 0}`;
  };

  if (loading) {
    return <UserRentalLoansSkeleton />;
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 min-h-screen py-10 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                <FaCreditCard className="text-blue-600 dark:text-blue-400" />
                Rental Loans
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">Apply for rental loans and manage your loan applications</p>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search loans..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
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
              value={filters.loanType}
              onChange={(e) => setFilters({ ...filters, loanType: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">All Types</option>
              <option value="security_deposit">Security Deposit</option>
              <option value="first_month_rent">First Month Rent</option>
              <option value="maintenance_charges">Maintenance Charges</option>
            </select>
          </div>
        </div>

        {/* Contracts Available for Loan */}
        {contracts.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <FaHome /> Available for Loan Application
            </h2>
            <div className="space-y-3">
              {contracts
                .filter(contract => {
                  // Check if any active loans exist for this contract
                  const hasActiveLoan = loans.some(loan =>
                    (loan.contractId?._id?.toString() === contract._id || loan.contractId?.toString() === contract._id) &&
                    ['pending', 'approved', 'disbursed'].includes(loan.status)
                  );
                  return !hasActiveLoan;
                })
                .slice(0, 5)
                .map(contract => {
                  const listingId = contract.listingId?._id || contract.listingId;
                  const listingName = contract.listingId?.name || 'Property';
                  return (
                    <div key={contract._id} className="border dark:border-gray-700 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 dark:bg-gray-700/50">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 dark:text-white">
                          {listingId ? (
                            <Link to={`/listing/${listingId}`} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline">
                              {listingName}
                            </Link>
                          ) : (
                            listingName
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">Contract ID: {contract.contractId}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">Rent: {formatCurrency(contract.lockedRentAmount)}/month</p>
                      </div>
                      <button
                        onClick={() => handleApplyForLoan(contract)}
                        className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                      >
                        <FaCreditCard /> Apply for Loan
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Loans List */}
        {filteredLoans.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
            <FaCreditCard className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No Loans Found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {filters.status !== 'all' || filters.loanType !== 'all' || filters.search !== ''
                ? 'Try adjusting your filters'
                : 'You don\'t have any loan applications yet'}
            </p>
            {contracts.length > 0 && (
              <button
                onClick={() => setFilters({ status: 'all', loanType: 'all', search: '' })}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                View Available Contracts
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLoans.map((loan) => {
              const status = loan.status;
              const contract = loan.contractId;
              const listingId = contract?.listingId?._id || contract?.listingId;
              const listingName = contract?.listingId?.name || 'Property';

              return (
                <div
                  key={loan._id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all"
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
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Property:{' '}
                        {listingId ? (
                          <Link to={`/listing/${listingId}`} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline">
                            {listingName || 'Unknown'}
                          </Link>
                        ) : (
                          listingName || 'Unknown'
                        )}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Contract: {contract?.contractId || 'Unknown'}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
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
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Tenure</p>
                          <p className="font-semibold text-gray-800 dark:text-gray-200">{loan.tenure} months</p>
                        </div>
                      </div>
                      {loan.status === 'disbursed' && (
                        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                          <div className="flex items-center gap-2 mb-1">
                            <FaCheckCircle className="text-green-600 dark:text-green-400" />
                            <span className="text-sm font-semibold text-green-800 dark:text-green-300">Disbursed</span>
                          </div>
                          {loan.disbursedAt && (
                            <p className="text-xs text-green-700 dark:text-green-400">
                              Disbursed on: {new Date(loan.disbursedAt).toLocaleDateString()}
                            </p>
                          )}
                          {loan.totalRemaining > 0 && (
                            <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                              Outstanding: {formatCurrency(loan.totalRemaining)}
                            </p>
                          )}
                        </div>
                      )}
                      {loan.status === 'rejected' && loan.rejectionReason && (
                        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                          <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">Rejection Reason:</p>
                          <p className="text-xs text-red-700 dark:text-red-400">{loan.rejectionReason}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleViewLoan(loan)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                      >
                        <FaCreditCard /> View Details
                      </button>
                      {contract && (
                        <Link
                          to={`/user/rental-contracts?contractId=${contract._id || contract}`}
                          className="px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-center text-sm"
                        >
                          View Contract
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showLoanForm && selectedContract && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full p-6 relative">
                <div className="flex items-center justify-between mb-4 border-b dark:border-gray-700 pb-2">
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Apply for Rental Loan</h2>
                  <button
                    onClick={() => {
                      setShowLoanForm(false);
                      setSelectedContract(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
                  >
                    <FaTimes />
                  </button>
                </div>
                <LoanApplicationForm
                  contract={selectedContract}
                  currentUser={currentUser}
                  onSuccess={handleLoanSubmitted}
                  onCancel={() => {
                    setShowLoanForm(false);
                    setSelectedContract(null);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Loan Status Display Modal */}
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
                  onUpdate={handleLoanUpdated}
                  STATUS_COLORS={STATUS_COLORS}
                  STATUS_LABELS={STATUS_LABELS}
                  LOAN_TYPE_LABELS={LOAN_TYPE_LABELS}
                  onPayEMI={handlePayEMI}
                />
              </div>
            </div>
          </div>
        )}
        {/* Payment Modal */}
        {showPaymentModal && paymentLoan && paymentEMI && (
          <PaymentModal
            isOpen={showPaymentModal}
            onClose={() => setShowPaymentModal(false)}
            appointment={{
              _id: paymentLoan.contractId?.bookingId,
              propertyName: paymentLoan.contractId?.listingId?.name || 'Rental Loan EMI',
              propertyDescription: `${LOAN_TYPE_LABELS[paymentLoan.loanType] || 'Rental'} Loan - EMI for ${paymentEMI.month}/${paymentEMI.year}`,
              paymentType: 'emi',
              isRentalPayment: true,
              contractId: paymentLoan.contractId?._id
            }}
            isEMIPayment={true}
            emiDetails={{
              loanId: paymentLoan._id,
              emiIndex: paymentIndex,
              amount: paymentLoan.emiAmount,
              month: paymentEMI.month,
              year: paymentEMI.year
            }}
            onPaymentSuccess={handlePaymentSuccess}
          />
        )}
      </div>
    </div>
  );
}

