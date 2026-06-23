import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from 'react-toastify';
import { FaMoneyBillWave, FaCheckCircle, FaCheck, FaChevronRight, FaChevronLeft, FaCalendarAlt, FaFileContract, FaCreditCard, FaHome, FaLock, FaTimesCircle, FaDownload, FaCoins, FaMapMarkerAlt, FaAward, FaTrophy, FaStar, FaRegGem, FaHandshake, FaDove } from "react-icons/fa";
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import { usePageTitle } from '../hooks/usePageTitle';
import PaymentModal from '../components/PaymentModal';
import ContractPreview from '../components/rental/ContractPreview';
import SetuCoinParticles from '../components/SetuCoins/SetuCoinParticles';
import MilestoneProgress from "../components/SetuCoins/MilestoneProgress";
import PayMonthlyRentSkeleton from '../components/skeletons/PayMonthlyRentSkeleton';
import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function PayMonthlyRent() {
  usePageTitle("Pay Monthly Rent - UrbanSetu");

  const { currentUser } = useSelector((state) => state.user);
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  const contractId = searchParams.get('contractId');
  const scheduleIndex = searchParams.get('scheduleIndex');

  const [pageLoading, setPageLoading] = useState(true);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [step, setStep] = useState(1); // 1: Select Month, 2: Review Details, 3: Contract Review, 4: Payment, 5: Confirmation
  const [contract, setContract] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showContractPreview, setShowContractPreview] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [booking, setBooking] = useState(null);
  const [createdPayment, setCreatedPayment] = useState(null);
  const [selectedGateway, setSelectedGateway] = useState('razorpay');
  const [coinsToRedeem, setCoinsToRedeem] = useState(0);
  const [showCoinBurst, setShowCoinBurst] = useState(false);
  const [gamification, setGamification] = useState({
    setuCoinsBalance: 0,
    currentStreak: 0,
    badges: []
  });
  const [newBadges, setNewBadges] = useState([]);
  const [isTenant, setIsTenant] = useState(false);

  // AI Legal Assistant State
  const [customClauses, setCustomClauses] = useState([]);
  const [newClauseInput, setNewClauseInput] = useState('');
  const [draftingClause, setDraftingClause] = useState(false);
  const [draftedClauseText, setDraftedClauseText] = useState('');
  const [savingClause, setSavingClause] = useState(false);
  const [ellipsis, setEllipsis] = useState('');
  const clauseInputRef = useRef(null);

  // Ellipsis animation for loading text
  useEffect(() => {
    if (draftingClause || savingClause) {
      const interval = setInterval(() => {
        setEllipsis(prev => (prev.length >= 3 ? '' : prev + '.'));
      }, 500);
      return () => clearInterval(interval);
    } else {
      setEllipsis('');
    }
  }, [draftingClause, savingClause]);

  useEffect(() => {
    if (currentUser) {
      // Fetch coin balance
      authenticatedFetch(`${API_BASE_URL}/api/coins/balance`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setGamification({
              setuCoinsBalance: data.setuCoinsBalance || 0,
              currentStreak: data.currentStreak || 0,
              badges: data.badges || []
            });
          }
        })
        .catch(err => console.error("Error fetching coins:", err));
    }
  }, [currentUser?._id]);

  useEffect(() => {
    if (!contractId) {
      toast.error("Contract ID is required.");
      navigate("/user/rental-contracts");
      return;
    }

    if (!currentUser) {
      toast.error("Please sign in to pay rent.");
      navigate("/sign-in");
      return;
    }

    fetchContractAndWallet();
  }, [contractId, currentUser?._id]);

  const fetchContractAndWallet = async () => {
    try {
      setPageLoading(true);

      // Fetch contract
      const contractRes = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts/${contractId}`);

      if (!contractRes.ok) {
        throw new Error("Failed to fetch contract");
      }

      const contractData = await contractRes.json();
      const contractObj = contractData.contract || contractData;

      // Verify user is tenant
      const isUserTenant = contractObj.tenantId?._id === currentUser._id || contractObj.tenantId === currentUser._id;
      setIsTenant(isUserTenant);
      
      if (!isUserTenant) {
        toast.error("Only tenants can pay rent.");
        navigate("/user/rental-contracts");
        return;
      }

      if (contractObj.status !== 'active') {
        toast.error("Contract must be active to pay rent.");
        navigate("/user/rental-contracts");
        return;
      }

      setContract(contractObj);
      // Filter out any invalid/garbage clauses that were previously saved
      const validClauses = (contractObj.customClauses || []).filter(c => {
        const lower = (c || '').toLowerCase();
        return c && c.trim() && !lower.includes('no input to convert') && !lower.includes('could not generate') && !lower.includes('there is no input');
      });
      setCustomClauses(validClauses);

      // Fetch wallet - try to fetch regardless of walletId field
      // The API endpoint uses contractId to find the wallet
      const walletRes = await authenticatedFetch(`${API_BASE_URL}/api/rental/wallet/${contractId}`);

      if (!walletRes.ok) {
        toast.error("Wallet not found for this contract.");
        navigate("/user/rental-contracts");
        return;
      }

      const walletData = await walletRes.json();
      if (!walletData.success || !walletData.wallet) {
        toast.error("Wallet not found for this contract.");
        navigate("/user/rental-contracts");
        return;
      }

      const walletObj = walletData.wallet;
      setWallet(walletObj);

      // Find pending payments
      const pendingPayments = walletObj.paymentSchedule?.filter(p => p.status === 'pending' || p.status === 'overdue' || p.status === 'processing') || [];

      if (pendingPayments.length === 0) {
        toast.info("All rent payments are up to date.");
        navigate("/user/rental-contracts");
        return;
      }

      // If scheduleIndex provided, use that payment
      if (scheduleIndex !== null) {
        const idx = parseInt(scheduleIndex);
        const payment = walletObj.paymentSchedule?.[idx];
        if (payment && (payment.status === 'pending' || payment.status === 'overdue' || payment.status === 'processing')) {
          setSelectedPayment({ ...payment, scheduleIndex: idx });
        } else {
          setSelectedPayment({ ...pendingPayments[0], scheduleIndex: walletObj.paymentSchedule.indexOf(pendingPayments[0]) });
        }
      } else {
        // Use first pending payment (usually next due)
        setSelectedPayment({ ...pendingPayments[0], scheduleIndex: walletObj.paymentSchedule.indexOf(pendingPayments[0]) });
      }

      // Fetch booking for payment modal
      if (contractObj.bookingId) {
        const bookingRes = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${contractObj.bookingId._id || contractObj.bookingId}`);
        if (bookingRes.ok) {
          const bookingData = await bookingRes.json();
          setBooking(bookingData.booking || bookingData);
        }
      }
    } catch (error) {
      console.error("Error fetching contract and wallet:", error);
      toast.error("Failed to load contract details.");
      navigate("/user/rental-contracts");
    } finally {
      setPageLoading(false);
    }
  };

  const handlePaymentSuccess = (payment, updatedGamification) => {
    if (updatedGamification) {
      setGamification({
        setuCoinsBalance: updatedGamification.setuCoinsBalance || 0,
        currentStreak: updatedGamification.currentStreak || 0,
        badges: updatedGamification.badges || []
      });
    }
    setPaymentCompleted(true);
    setStep(5);
    setShowPaymentModal(false);
    setShowCoinBurst(true); // Celebration!

    // Refresh contract and wallet, and check for new badges
    setTimeout(async () => {
      fetchContractAndWallet();

      // If we didn't receive updated gamification from payment modal, fetch fresh data now
      if (!updatedGamification) {
        try {
          const res = await authenticatedFetch(`${API_BASE_URL}/api/coins/balance`);
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              const freshBadges = data.badges || [];
              // Compare with old badges
              const earned = freshBadges.filter(b => !gamification.badges.includes(b));
              if (earned.length > 0) {
                setNewBadges(earned);
              }
              // Update state anyway just in case
              setGamification({
                setuCoinsBalance: data.setuCoinsBalance || 0,
                currentStreak: data.currentStreak || 0,
                badges: data.badges || []
              });
            }
          }
        } catch (err) {
          console.error("Error checking for earned badges:", err);
        }
      } else {
        // We already have fresh data, check for new badges
        const earned = (updatedGamification.badges || []).filter(b => !gamification.badges.includes(b));
        if (earned.length > 0) {
          setNewBadges(earned);
        }
      }
    }, 2000);

    // Dispatch event for other pages (like RentalContracts and RentWallet) to refresh
    window.dispatchEvent(new CustomEvent('rentalPaymentStatusUpdated', {
      detail: { 
        contractId: contract._id, 
        paymentConfirmed: true,
        gamification: updatedGamification
      }
    }));
  };

  const getTotalAmount = () => {
    if (!selectedPayment || !contract) return 0;
    const amount = selectedPayment.amount || contract.lockedRentAmount || 0;
    const penalty = selectedPayment.penaltyAmount || 0;
    const discount = Math.floor(coinsToRedeem / 10);
    // Note: Security deposit is paid upfront during contract creation, not in monthly rent payments
    return Math.max(0, amount + penalty - discount);
  };

  const getSubtotal = () => {
    if (!selectedPayment || !contract) return 0;
    const amount = selectedPayment.amount || contract.lockedRentAmount || 0;
    const penalty = selectedPayment.penaltyAmount || 0;
    return amount + penalty;
  };

  // AI Legal Assistant: Draft a clause from user description
  const handleDraftClause = async () => {
    if (!newClauseInput.trim()) {
      toast.error('Please describe the clause you want to add.');
      return;
    }

    try {
      setDraftingClause(true);
      setDraftedClauseText('');
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts/draft-clause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput: newClauseInput })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to draft clause');
      }

      // Reject invalid/garbage AI responses
      const invalidPatterns = [
        'no input to convert',
        'could not generate',
        'there is no input',
        'please provide',
        'i cannot',
        'i\'m unable'
      ];
      const draftLower = (data.draftedClause || '').toLowerCase();
      const isInvalid = invalidPatterns.some(p => draftLower.includes(p));

      if (isInvalid || !data.draftedClause?.trim()) {
        toast.error('AI could not generate a valid clause. Please provide a clearer description.');
        return;
      }

      setDraftedClauseText(data.draftedClause);
      toast.success('Clause drafted! Review it below, then save to contract.');
    } catch (error) {
      console.error('AI Drafter Error:', error);
      toast.error('Failed to generate clause. Please try again.');
    } finally {
      setDraftingClause(false);
    }
  };

  // Save drafted clause to the contract in DB (append)
  const handleAddClauseToContract = async () => {
    if (!draftedClauseText.trim() || !contract) return;

    try {
      setSavingClause(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts/${contract._id}/add-clause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clause: draftedClauseText })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save clause');
      }

      setCustomClauses(data.customClauses || [...customClauses, draftedClauseText]);
      setDraftedClauseText('');
      setNewClauseInput('');
      toast.success('Clause saved to contract!');
    } catch (error) {
      console.error('Save Clause Error:', error);
      toast.error(error.message || 'Failed to save clause.');
    } finally {
      setSavingClause(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!selectedPayment || !contract || !wallet) {
      toast.error("Payment information not available.");
      return;
    }

    // Check if payment is already completed locally first
    if (selectedPayment.status === 'completed' || selectedPayment.status === 'paid') {
      toast.info("Rent for this month is already paid.");
      setCreatedPayment({
        amount: selectedPayment.amount,
        rentMonth: selectedPayment.month,
        rentYear: selectedPayment.year,
        status: 'completed',
        paymentId: selectedPayment.paymentId
      });
      setPaymentCompleted(true);
      setStep(5);
      return;
    }

    // Refetch wallet silently to get the latest status before initiating payment
    try {
      // Don't set global loading yet to avoid UI flicker if already paid
      const walletRes = await authenticatedFetch(`${API_BASE_URL}/api/rental/wallet/${contract._id}`);

      if (walletRes.ok) {
        const walletData = await walletRes.json();
        if (walletData.success && walletData.wallet) {
          const freshWallet = walletData.wallet;
          setWallet(freshWallet); // Update state

          // Find the current payment in the fresh wallet data
          const currentPaymentIndex = selectedPayment.scheduleIndex;
          const freshPayment = freshWallet.paymentSchedule[currentPaymentIndex];

          if (freshPayment) {
            // Update selectedPayment with fresh data
            setSelectedPayment({ ...freshPayment, scheduleIndex: currentPaymentIndex });

            // Check status from fresh data
            if (freshPayment.status === 'completed' || freshPayment.status === 'paid') {
              toast.info("Rent for this month is already paid.");
              setCreatedPayment({
                amount: freshPayment.amount,
                rentMonth: freshPayment.month,
                rentYear: freshPayment.year,
                status: 'completed',
                paymentId: freshPayment.paymentId
              });
              setPaymentCompleted(true);
              setStep(5);
              return; // Stop execution here
            }
          }
        }
      }
    } catch (err) {
      console.error("Error refreshing wallet status:", err);
    }

    // Now proceed to create payment intent if not paid
    try {
      setCreatingPayment(true);

      // Create monthly rent payment via API
      const res = await authenticatedFetch(`${API_BASE_URL}/api/payments/monthly-rent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: contract._id,
          walletId: wallet._id,
          scheduleIndex: selectedPayment.scheduleIndex,
          amount: selectedPayment.amount ? (selectedPayment.amount - (contract.maintenanceCharges || 0)) : (contract.lockedRentAmount || 0),
          month: selectedPayment.month,
          year: selectedPayment.year,
          isAutoDebit: false,
          gateway: selectedGateway,
          coinsToRedeem: coinsToRedeem
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to create payment");
      }

      // Payment created, now open PaymentModal
      if (booking) {
        const bookingForPayment = {
          ...booking,
          contractId: contract._id,
          isRentalPayment: true,
          paymentId: data.payment.paymentId,
          paymentType: 'monthly_rent'
        };

        // If payment is already completed (idempotency), show success immediately
        if (data.payment.status === 'completed' || data.payment.status === 'paid') {
          setCreatedPayment(data.payment);
          setShowCoinBurst(true); // Celebration!
          setStep(5);
          return;
        }

        // Merge payment and razorpay details (containing keyId)
        setCreatedPayment({ ...data.payment, razorpay: data.razorpay });
        setShowPaymentModal(true);
      } else {
        toast.error("Booking information not available for payment.");
      }
    } catch (error) {
      console.error("Error creating payment:", error);
      toast.error(error.message || "Failed to create payment");
    } finally {
      setCreatingPayment(false);
    }
  };

  if (pageLoading) {
    return <PayMonthlyRentSkeleton />;
  }

  if (!contract || !wallet || !selectedPayment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Contract or payment information not found.</p>
          <button
            onClick={() => navigate("/user/rental-contracts")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Contracts
          </button>
        </div>
      </div>
    );
  }

  const dueDate = new Date(selectedPayment.dueDate);
  const isOverdue = selectedPayment.status === 'overdue' || (selectedPayment.status === 'pending' && dueDate < new Date());

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 min-h-screen py-10 px-4 md:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Step 0: Property Summary Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 flex flex-col sm:flex-row gap-6 relative overflow-hidden group hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full pointer-events-none -mr-8 -mt-8"></div>

          <div className="w-full sm:w-32 h-48 sm:h-32 flex-shrink-0 relative rounded-xl overflow-hidden border-2 border-gray-100 dark:border-gray-600 shadow-sm group-hover:scale-[1.02] transition-transform duration-300">
            <img
              src={contract.listingId?.imageUrls?.[0] || 'https://via.placeholder.com/300?text=No+Image'}
              alt={contract.listingId?.name || 'Property Image'}
              className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-700"
              onError={(e) => { e.target.src = 'https://via.placeholder.com/300?text=Image+Error'; }}
            />
          </div>

          <div className="flex-1 flex flex-col justify-center relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <FaMoneyBillWave className="text-blue-600 dark:text-blue-400 text-xl" />
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-50 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Pay Monthly Rent
              </h1>
            </div>

            <h2
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/listing/${contract.listingId?._id}`);
              }}
              className="text-lg text-gray-700 dark:text-gray-300 font-semibold mb-1 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer hover:underline transition-colors w-fit">
              {contract.listingId?.name}
            </h2>

            <p className="text-gray-600 dark:text-gray-400 flex items-start gap-2 mb-3 text-sm sm:text-base">
              <FaMapMarkerAlt className="text-red-500 mt-1 flex-shrink-0 animate-bounce-slow" />
              <span className="leading-snug">{contract.listingId?.address || `${contract.listingId?.city}, ${contract.listingId?.state}`}</span>
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-auto">
              <span className="px-3 py-1 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-lg text-xs font-mono border border-gray-200 dark:border-gray-600">
                Contract ID: {contract.contractId}
              </span>

              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 hidden sm:block"></div>

              <span className="text-xl font-bold text-gray-800 dark:text-blue-400 flex items-baseline">
                ₹{(contract.lockedRentAmount || 0).toLocaleString('en-IN')}
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-1 self-center">/month</span>
              </span>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8 mb-6">
          <div className="flex items-center justify-between w-full">
            {[1, 2, 3, 4, 5].map((s) => (
              <React.Fragment key={s}>
                <div
                  className="relative flex flex-col items-center cursor-pointer z-10 group"
                  onClick={() => {
                    if (step > s || paymentCompleted) {
                      setStep(s);
                    }
                  }}
                >
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-sm md:text-base font-bold transition-all duration-500 border-4 shadow-sm ${step > s || paymentCompleted
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : step === s
                      ? 'bg-white dark:bg-gray-800 border-blue-600 text-blue-600 scale-110 shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 group-hover:border-blue-300 dark:group-hover:border-blue-500 transition-colors'
                    }`}>
                    {step > s || paymentCompleted ? <FaCheck className="text-sm md:text-base" /> : s}
                  </div>
                  <span className={`absolute top-12 md:top-14 text-[10px] md:text-xs font-bold whitespace-nowrap transition-colors duration-300 uppercase tracking-wide ${step >= s ? 'text-blue-700' : 'text-gray-400'
                    }`}>
                    {s === 1 ? 'Select' : s === 2 ? 'Review' : s === 3 ? 'Contract' : s === 4 ? 'Pay' : 'Confirm'}
                  </span>
                </div>
                {s < 5 && (
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 relative mx-2 rounded-full overflow-hidden">
                    <div
                      className={`absolute top-0 left-0 h-full bg-blue-600 transition-all duration-700 ease-out rounded-full ${step > s || paymentCompleted ? 'w-full' : 'w-0'
                        }`}
                    />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
          {/* Spacer for text labels */}
          <div className="h-6 md:h-8"></div>
        </div>

        {/* Step 1: Select Payment Month */}
        {step === 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400 mb-6 flex items-center gap-2">
              <FaCalendarAlt /> Select Payment Month
            </h2>

            <div className="space-y-4">
              {wallet.paymentSchedule
                .filter(p => p.status === 'pending' || p.status === 'overdue' || p.status === 'processing')
                .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
                .map((payment, idx) => {
                  const originalIdx = wallet.paymentSchedule.indexOf(payment);
                  const payDueDate = new Date(payment.dueDate);
                  const isPayOverdue = payment.status === 'overdue' || (payment.status === 'pending' && payDueDate < new Date());

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedPayment({ ...payment, scheduleIndex: originalIdx });
                        setCoinsToRedeem(0);
                        setStep(2);
                      }}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition ${selectedPayment?.scheduleIndex === originalIdx
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500'
                        } ${isPayOverdue ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800' : 'dark:bg-gray-800'}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-lg text-gray-800 dark:text-white">
                            {payDueDate.toLocaleDateString('en-GB', {
                              month: 'long',
                              year: 'numeric'
                            })} Rent
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Due: {payDueDate.toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </p>
                          {isPayOverdue && (
                            <span className="inline-block mt-2 px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs font-semibold rounded">
                              Overdue
                            </span>
                          )}
                          {payment.status === 'processing' && (
                            <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-semibold rounded ml-2">
                              Payment in Progress
                            </span>
                          )}
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-xl font-bold text-gray-800 dark:text-white">
                            ₹{(payment.amount || contract.lockedRentAmount || 0).toLocaleString('en-IN')}
                          </p>
                          {payment.penaltyAmount > 0 && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                              + Penalty: ₹{payment.penaltyAmount.toLocaleString('en-IN')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {selectedPayment && (
              <div className="mt-6 flex flex-col-reverse sm:flex-row gap-4">
                <button
                  onClick={() => navigate("/user/rental-contracts")}
                  className="px-6 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Continue <FaChevronRight className="inline ml-2" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Review Payment Details */}
        {step === 2 && selectedPayment && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400 mb-6 flex items-center gap-2">
              <FaFileContract /> Review Payment Details
            </h2>

            <div className="bg-blue-50 dark:bg-gray-700/50 p-6 rounded-lg mb-6 border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-lg mb-4">Payment Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Month:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {dueDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Due Date:</span>
                  <span className={`font-semibold ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                    {dueDate.toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                    {isOverdue && ' (Overdue)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly Rent:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">₹{((selectedPayment.amount || contract.lockedRentAmount || 0) - (contract.maintenanceCharges || 0)).toLocaleString('en-IN')}</span>
                </div>
                {selectedPayment.penaltyAmount > 0 && (
                  <div className="flex justify-between text-red-600 dark:text-red-400">
                    <span>Late Fee:</span>
                    <span className="font-semibold">₹{selectedPayment.penaltyAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {contract.maintenanceCharges > 0 && (
                  <div className="flex justify-between">
                    <span>Maintenance:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">₹{contract.maintenanceCharges.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2 mt-2 font-bold text-lg">
                  <span className="text-gray-900 dark:text-white">Total Amount:</span>
                  <span className="text-blue-600 dark:text-blue-400">₹{getTotalAmount().toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
              >
                <FaChevronLeft /> Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Review Contract <FaChevronRight className="inline ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Contract Review */}
        {step === 3 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400 mb-6 flex items-center gap-2">
              <FaFileContract /> Contract Review
            </h2>

            <div className="mb-6">
              <ContractPreview
                contract={contract}
                listing={contract.listingId}
                tenant={contract.tenantId}
                landlord={contract.landlordId}
                onDownload={() => { }}
              />
            </div>

            {/* AI Legal Assistant Section */}
            <div className="mb-6 border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded-full uppercase font-bold">AI</span>
                <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-300 border-none">AI Legal Assistant</h3>
              </div>

              <div className="mb-4">
                <p className="text-sm text-purple-800 dark:text-purple-300 mb-2">
                  Want to add specific terms before paying? Describe them (e.g., &quot;Request receipt within 3 days&quot;, &quot;No penalty if paid within grace period&quot;) and our AI will draft a formal legal clause. New clauses are appended to your contract.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    ref={clauseInputRef}
                    type="text"
                    value={newClauseInput}
                    onChange={(e) => setNewClauseInput(e.target.value)}
                    placeholder="Describe your custom condition..."
                    className="flex-1 p-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 w-full dark:bg-gray-800 dark:border-purple-600 dark:text-white dark:placeholder-gray-400"
                    disabled={draftingClause || savingClause}
                    onKeyDown={(e) => e.key === 'Enter' && handleDraftClause()}
                  />
                  <button
                    onClick={handleDraftClause}
                    disabled={draftingClause || !newClauseInput.trim() || savingClause}
                    className="bg-purple-600 text-white px-4 py-3 sm:py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium w-full sm:w-auto"
                  >
                    {draftingClause ? (
                      <>
                        <UrbanSetuSpinner size="sm" isBright={true} />
                        Drafting{ellipsis}
                      </>
                    ) : (
                      <>
                        <span>✨ Draft</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Drafted Clause Preview (before saving) */}
              {draftedClauseText && (
                <div className="mb-4 bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-purple-400 dark:border-purple-600 shadow-md">
                  <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-300 mb-2 flex items-center gap-1">
                    📝 Drafted Clause Preview
                  </h4>
                  <p className="text-sm text-gray-800 dark:text-gray-300 italic mb-3">"{draftedClauseText}"</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddClauseToContract}
                      disabled={savingClause}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
                    >
                      {savingClause ? (
                        <>
                          <UrbanSetuSpinner size="sm" isBright={true} />
                          Saving{ellipsis}
                        </>
                      ) : (
                        <>
                          <FaCheck /> Save to Contract
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setDraftedClauseText('')}
                      disabled={savingClause}
                      className="bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}

              {/* Saved Custom Clauses */}
              {customClauses.filter(c => {
                const lower = (c || '').toLowerCase();
                return c && c.trim() && !lower.includes('no input to convert') && !lower.includes('could not generate') && !lower.includes('there is no input');
              }).length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-300">Custom Clauses on Contract:</h4>
                  {customClauses.filter(c => {
                    const lower = (c || '').toLowerCase();
                    return c && c.trim() && !lower.includes('no input to convert') && !lower.includes('could not generate') && !lower.includes('there is no input');
                  }).map((clause, index) => (
                    <div key={index} className="bg-white dark:bg-gray-800 p-3 rounded border border-purple-200 dark:border-purple-800 flex items-start gap-3 shadow-sm">
                      <span className="text-purple-500 mt-0.5 text-xs font-bold min-w-[20px]">{index + 1}.</span>
                      <p className="text-sm text-gray-800 dark:text-gray-300 italic flex-1">"{clause}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
              >
                <FaChevronLeft /> Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Proceed to Payment <FaChevronRight className="inline ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Payment */}
        {step === 4 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400 mb-6 flex items-center gap-2">
              <FaCreditCard /> Complete Payment
            </h2>

            <div className="bg-blue-50 dark:bg-gray-700/50 p-6 rounded-lg mb-6 border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-lg mb-4 text-gray-800 dark:text-white">Payment Summary</h3>
              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <div className="flex justify-between">
                  <span>Monthly Rent:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">₹{((selectedPayment?.amount || contract?.lockedRentAmount || 0) - (contract?.maintenanceCharges || 0)).toLocaleString('en-IN')}</span>
                </div>
                {selectedPayment?.penaltyAmount > 0 && (
                  <div className="flex justify-between text-red-600 dark:text-red-400">
                    <span>Late Fee:</span>
                    <span className="font-semibold">₹{selectedPayment.penaltyAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {contract?.maintenanceCharges > 0 && (
                  <div className="flex justify-between">
                    <span>Maintenance:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">₹{contract.maintenanceCharges.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {contract?.securityDeposit > 0 && contract?.depositPlan !== 'zero' && (
                  <div className="flex justify-between pt-2 border-t border-blue-200 dark:border-blue-800">
                    <span className="text-gray-600 dark:text-gray-400 italic">Note: Security deposit (₹{contract.securityDeposit.toLocaleString('en-IN')}) was paid upfront</span>
                  </div>
                )}
                <div className="border-t border-blue-200 dark:border-blue-800 pt-2 mt-2">
                  {coinsToRedeem > 0 && (
                    <div className="flex justify-between text-green-600 dark:text-green-400 mb-1">
                      <span className="flex items-center gap-1"><FaCoins className="text-xs" /> SetuCoins Discount:</span>
                      <span className="font-semibold">- ₹{Math.floor(coinsToRedeem / 10).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg">
                    <span className="text-gray-900 dark:text-white">Total Payable:</span>
                    <span className="text-blue-600 dark:text-blue-400">₹{getTotalAmount().toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SetuCoins Earning Banner */}
            {getTotalAmount() >= 1000 && (
              <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-800 rounded-full text-yellow-600 dark:text-yellow-400 shadow-inner">
                    <FaCoins className="text-xl" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-white flex items-center gap-1">SetuCoins Rewards <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded border border-yellow-200 dark:border-yellow-700">LOYALTY</span></h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">You will earn <span className="font-bold text-yellow-600 dark:text-yellow-400 text-lg">{Math.floor(getTotalAmount() / 1000)} SetuCoins</span> with this payment!</p>
                  </div>
                </div>
                <div className="hidden sm:block text-yellow-500 font-bold text-xl animate-pulse">+{Math.floor(getTotalAmount() / 1000)}</div>
              </div>
            )}

            {/* Badge Progress Tracker */}
            {isTenant && gamification.currentStreak < 12 && (
              <div className="mb-6">
                <MilestoneProgress 
                  streak={gamification.currentStreak} 
                />
              </div>
            )}

            {/* SetuCoins Redemption */}
            {gamification.setuCoinsBalance > 0 && (
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700 mb-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                    <FaCoins className={`text-yellow-500 ${coinsToRedeem > 0 ? 'animate-bounce' : ''}`} />
                    Pay with SetuCoins
                  </h4>
                  <span className="text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-2 py-1 rounded-full">
                    Available: {gamification.setuCoinsBalance}
                  </span>
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Redeem Coins for Discount</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max={Math.min(gamification.setuCoinsBalance, getSubtotal() * 10)}
                      step="10"
                      value={coinsToRedeem}
                      onChange={(e) => setCoinsToRedeem(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                    />
                    <div className="min-w-[80px] text-right font-bold text-gray-700 dark:text-gray-200">
                      {coinsToRedeem} Coins
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>0</span>
                    <span>Max Redeemable: {Math.min(gamification.setuCoinsBalance, getSubtotal() * 10)}</span>
                  </div>
                </div>

                {coinsToRedeem > 0 && (
                  <div className="flex justify-between items-center bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-lg border border-yellow-100 dark:border-yellow-800">
                    <span className="text-sm text-yellow-800 dark:text-yellow-300">Discount Applied:</span>
                    <span className="font-bold text-yellow-700 dark:text-yellow-400">- ₹{(Math.floor(coinsToRedeem / 10)).toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 mt-4 mb-6">
              <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Select Payment Method</h4>
              <div className="flex flex-col gap-3">
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedGateway === 'razorpay' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                  <input
                    type="radio"
                    name="gateway"
                    value="razorpay"
                    checked={selectedGateway === 'razorpay'}
                    onChange={() => setSelectedGateway('razorpay')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                      <span className="font-medium text-gray-800 dark:text-gray-200">Razorpay (India)</span>
                      <span className="font-bold text-gray-800 dark:text-gray-200">₹{getTotalAmount().toLocaleString('en-IN')}</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Pay via UPI, Cards, Netbanking (INR)</div>
                  </div>
                </label>

                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedGateway === 'paypal' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                  <input
                    type="radio"
                    name="gateway"
                    value="paypal"
                    checked={selectedGateway === 'paypal'}
                    onChange={() => setSelectedGateway('paypal')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                      <span className="font-medium text-gray-800 dark:text-gray-200">PayPal (International)</span>
                      <span className="font-bold text-gray-800 dark:text-gray-200">$ {((getTotalAmount() / 84).toFixed(2))}</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Pay via PayPal Wallet or Cards (USD)</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-4">
              <button
                onClick={() => setStep(3)}
                className="px-6 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center gap-2"
              >
                <FaChevronLeft /> Back
              </button>
              <button
                onClick={handleCreatePayment}
                disabled={creatingPayment}
                className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creatingPayment ? (
                  <>
                    <UrbanSetuSpinner size="xs" isBright={true} /> Processing...
                  </>
                ) : (
                  <>
                    <FaMoneyBillWave /> Proceed to Payment
                    <FaChevronRight />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === 5 && paymentCompleted && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="text-center">
              <FaCheckCircle className="text-green-500 text-6xl mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Payment Successful!</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Your rent payment has been processed successfully and is being held in escrow.
              </p>

              {/* SetuCoins Earned Success */}
              {createdPayment && createdPayment.amount >= 1000 && (
                <div className="flex flex-col items-center justify-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800 mb-6 max-w-md mx-auto animate-[fadeIn_0.5s_ease-out]">
                  <div className="flex items-center gap-2 mb-1">
                    <FaCoins className="text-yellow-500 text-2xl animate-bounce" />
                    <span className="font-bold text-gray-800 dark:text-white text-lg">SetuCoins Earned!</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 text-center">
                    Congratulations! You've earned <span className="font-bold text-yellow-600 dark:text-yellow-400 text-xl mx-1">+{Math.floor(createdPayment.amount / 1000)}</span> coins.
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Maintain your streak to earn bonus coins!</p>
                </div>
              )}

              {/* New Badge Celebration! */}
              {newBadges.length > 0 && (
                <div className="mt-8 mb-10">
                  <div className="relative">
                    {/* Background Shine */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-12 h-64 bg-gradient-radial from-yellow-400/30 to-transparent animate-pulse rounded-full blur-3xl"></div>

                    <div className="flex flex-col items-center gap-6 relative z-10">
                      {newBadges.map((badge, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col items-center animate-[badgePop_0.8s_cubic-bezier(0.175,0.885,0.32,1.275)_backwards]"
                          style={{ animationDelay: `${idx * 0.4}s` }}
                        >
                          <div className="relative mb-4">
                            <div className="absolute inset-0 bg-yellow-400/20 blur-xl rounded-full scale-150 animate-ping"></div>
                            <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 rounded-3xl flex items-center justify-center p-0.5 shadow-[0_0_40px_rgba(251,191,36,0.5)] transform -rotate-3 hover:rotate-0 transition-transform">
                              <div className="w-full h-full bg-white dark:bg-gray-800 rounded-[1.4rem] flex items-center justify-center text-4xl md:text-6xl text-amber-500">
                                {badge === 'Elite Resident' ? <FaRegGem className="animate-[wiggle_2s_infinite]" /> :
                                  badge === 'Perfect Payer' ? <FaHandshake className="animate-[wiggle_2s_infinite]" /> :
                                    badge === 'Early Bird' ? <FaDove className="animate-[wiggle_2s_infinite]" /> : <FaAward className="animate-[wiggle_2s_infinite]" />}
                              </div>
                            </div>
                            <FaStar className="absolute -top-2 -right-2 text-yellow-300 text-2xl animate-[spin_4s_linear_infinite]" />
                            <FaStar className="absolute -bottom-2 -left-2 text-yellow-300 text-xl animate-[spin_3s_linear_infinite_reverse]" />
                          </div>

                          <div className="text-center">
                            <h3 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-1">Badge Earned!</h3>
                            <div className="px-4 py-1.5 bg-amber-500 text-white rounded-full font-bold text-lg shadow-lg">
                              {badge}
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 mt-3 max-w-xs font-medium">
                              Congratulations! You've reached a significant milestone in your rental journey.
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-center mb-6">
                <button
                  onClick={() => window.open(`${API_BASE_URL}/api/payments/${createdPayment?.paymentId}/receipt`, '_blank')}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                >
                  <FaDownload /> Download Receipt
                </button>
              </div>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => navigate("/user/rental-contracts")}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Go to Contracts
                </button>
                <button
                  onClick={() => navigate(`/user/rental-ratings?contractId=${contract._id}&role=tenant`)}
                  className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center justify-center gap-2 font-semibold shadow-sm transition-colors"
                >
                  Rate Property <FaStar />
                </button>
                <button
                  onClick={() => navigate(`/user/rent-wallet?contractId=${contract._id}`, { state: { refresh: true } })}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  View Wallet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && booking && contract && (
          <PaymentModal
            isOpen={showPaymentModal}
            onClose={() => setShowPaymentModal(false)}
            appointment={{
              ...booking,
              lockExpiryTime: null,
              contractId: contract._id,
              isRentalPayment: true,
              paymentType: 'monthly_rent'
            }}
            existingPayment={createdPayment}
            onPaymentSuccess={(payment) => {
              setCreatedPayment(payment);
              setPaymentCompleted(true);
              setStep(5);
              setShowCoinBurst(true); // Celebration!
              setShowPaymentModal(false);
              // Refresh wallet data to update UI immediately
              fetchContractAndWallet();
            }}
          />
        )}
      </div>

      <SetuCoinParticles
        active={showCoinBurst}
        onComplete={() => setShowCoinBurst(false)}
        count={25}
      />
      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
        @keyframes badgePop {
          0% { transform: scale(0.5) translateY(40px) rotate(-20deg); opacity: 0; }
          60% { transform: scale(1.1) translateY(-10px) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) translateY(0) rotate(-3deg); opacity: 1; }
        }
        .bg-gradient-radial {
          background: radial-gradient(var(--tw-gradient-from), var(--tw-gradient-to));
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

