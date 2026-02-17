import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from 'react-toastify';
import { FaLock, FaCalendarAlt, FaMoneyBillWave, FaCheckCircle, FaCheck, FaChevronRight, FaHome, FaShieldAlt, FaFileContract, FaTimesCircle, FaCreditCard, FaChevronLeft, FaMapMarkerAlt, FaReceipt, FaDownload } from "react-icons/fa";
import { usePageTitle } from '../hooks/usePageTitle';
import PaymentModal from '../components/PaymentModal';
import ContractPreview from '../components/rental/ContractPreview';
import DigitalSignature from '../components/rental/DigitalSignature';
import RentPropertySkeleton from '../components/skeletons/RentPropertySkeleton';
import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function RentProperty() {
  // Set page title
  usePageTitle("Rent Property - Rent-Lock Agreement");

  const { currentUser } = useSelector((state) => state.user);
  const location = useLocation();
  const navigate = useNavigate();

  // Get listing information from URL params
  const searchParams = new URLSearchParams(location.search);
  const listingId = searchParams.get('listingId');
  const contractIdParam = searchParams.get('contractId'); // For resuming contracts

  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState(null);
  const [step, setStep] = useState(1); // 1: Plan Selection, 2: Contract Review, 3: Signing, 4: Payment, 5: Move-in
  const [formData, setFormData] = useState({
    rentLockPlan: '',
    customLockDuration: 12,
    moveInDate: '',
    bookingId: null,
    depositPlan: 'standard', // 'standard', 'low', 'zero'
    appointmentTime: '',
    appointmentMessage: '',
    appointmentPurpose: 'rent'
  });
  const [contract, setContract] = useState(null);
  const [resumingContract, setResumingContract] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [booking, setBooking] = useState(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [lastPayment, setLastPayment] = useState(null);
  const [showInitConfirmation, setShowInitConfirmation] = useState(false);
  const [signingAs, setSigningAs] = useState(null); // 'tenant' or 'landlord'
  const readyForPayment = !!(contract?.tenantSignature?.signed && contract?.landlordSignature?.signed);
  const isTenant = contract?.tenantId?._id === currentUser?._id || contract?.tenantId === currentUser?._id;
  const isLandlord = contract?.landlordId?._id === currentUser?._id || contract?.landlordId === currentUser?._id;

  // AI Legal Assistant State
  const [customClauses, setCustomClauses] = useState([]);
  const [newClauseInput, setNewClauseInput] = useState('');
  const [draftingClause, setDraftingClause] = useState(false);

  // OTP Confirmation State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpResending, setOtpResending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const otpInputRef = useRef(null);

  // OTP Timer logic
  useEffect(() => {
    let interval = null;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer(prev => prev - 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  const handleDraftClause = async () => {
    if (!newClauseInput.trim()) {
      toast.error('Please describe the clause you want to add.');
      return;
    }

    try {
      setDraftingClause(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts/draft-clause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput: newClauseInput })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to draft clause');
      }

      setCustomClauses(prev => [...prev, data.draftedClause]);
      setNewClauseInput('');
      toast.success('Legal clause drafted and added!');
    } catch (error) {
      console.error('AI Drafter Error:', error);
      toast.error('Failed to generate clause. Please try again.');
    } finally {
      setDraftingClause(false);
    }
  };

  const removeClause = (index) => {
    setCustomClauses(prev => prev.filter((_, i) => i !== index));
  };

  // Fetch listing details and resume contract if contractId is provided
  useEffect(() => {
    const fetchListingAndContract = async () => {
      if (!listingId) {
        toast.error("Listing ID is required.");
        navigate("/user");
        return;
      }

      try {
        setLoading(true);

        // Fetch listing
        const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/get/${listingId}`, {
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to fetch listing");
        }

        const data = await res.json();

        // Handle both response formats: {success, listing} or direct listing object
        const listingData = data.listing || (data._id ? data : null);

        if (!listingData || !listingData._id) {
          throw new Error("Listing not found");
        }

        // Only allow rental properties
        if (listingData.type !== 'rent') {
          toast.error("This property is not available for rent.");
          navigate(`/listing/${listingId}`);
          return;
        }

        setListing(listingData);

        // Set default plan if available
        if (listingData.rentLockPlans?.defaultPlan) {
          setFormData(prev => ({
            ...prev,
            rentLockPlan: listingData.rentLockPlans.defaultPlan
          }));
        }

        let existingContract = null;

        // 1. Try to fetch contract if ID is provided
        if (contractIdParam) {
          try {
            const contractRes = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts/${contractIdParam}`, {
            });

            if (contractRes.ok) {
              const contractData = await contractRes.json();
              existingContract = contractData.contract || contractData;
            }
          } catch (contractError) {
            console.error("Error fetching specific contract:", contractError);
          }
        }
        // 2. If no ID provided, try to find an active contract for this listing user
        else {
          try {
            const contractsRes = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts?role=tenant`, {
            });

            if (contractsRes.ok) {
              const contractsData = await contractsRes.json();
              if (contractsData.success && contractsData.contracts) {
                // Find a non-terminated/non-rejected contract for this listing
                existingContract = contractsData.contracts.find(c => {
                  const cListingId = c.listingId?._id || c.listingId;
                  return String(cListingId) === String(listingId) &&
                    c.status !== 'rejected' &&
                    c.status !== 'terminated';
                });
              }
            }
          } catch (autoFetchError) {
            console.error("Error checking existing contracts:", autoFetchError);
          }
        }

        // 3. Check if property is already booked by someone else
        if ((listingData.availabilityStatus === 'booked' || listingData.availabilityStatus === 'rented') && !existingContract) {
          toast.error("This property is already booked by another user.");
          navigate(`/listing/${listingId}`);
          return;
        }

        // 4. If a contract is found (either way), resume it
        if (existingContract && existingContract._id) {
          // Check if contract is rejected or terminated (double check for safety)
          if (existingContract.status === 'rejected' || existingContract.status === 'terminated') {
            // If specific ID was passed, we show the error.
            if (contractIdParam) {
              setContract(existingContract);
              setResumingContract(true);
              setLoading(false);

              const rejectionMessage = existingContract.status === 'rejected'
                ? `This contract was rejected by the seller${existingContract.rejectionReason ? `: ${existingContract.rejectionReason}` : ''}. Please try booking a new one.`
                : `This contract was terminated${existingContract.terminationReason ? `: ${existingContract.terminationReason}` : ''}. Please try booking a new one.`;

              toast.error(rejectionMessage);
              return;
            }
            // If auto-discovered rejected, ignore it
            else {
              existingContract = null;
            }
          }

          // Check associated booking status if exists
          let bookingIsCancelledOrOutdated = false;
          if (existingContract && existingContract.bookingId) {
            try {
              let bookingData = null;
              // If bookingId is already an object (populated), use it
              if (typeof existingContract.bookingId === 'object' && existingContract.bookingId.status) {
                bookingData = existingContract.bookingId;
              } else {
                // Otherwise fetch it
                const bookingId = existingContract.bookingId?._id || existingContract.bookingId;
                const bookingRes = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${bookingId}`, {
                });
                if (bookingRes.ok) {
                  const data = await bookingRes.json();
                  bookingData = data.appointment || data.booking || data;
                }
              }

              if (bookingData) {
                // Check if cancelled
                const cancelledStatuses = ['cancelledByBuyer', 'cancelledBySeller', 'cancelledByAdmin'];
                if (cancelledStatuses.includes(bookingData.status)) {
                  bookingIsCancelledOrOutdated = true;
                }

                // Check if outdated
                const isOutdated = new Date(bookingData.date) < new Date() || (new Date(bookingData.date).toDateString() === new Date().toDateString() && bookingData.time && bookingData.time < new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

                // If it's outdated and not in a terminal successful state (like 'completed'), treat as invalid
                if (isOutdated && bookingData.status !== 'completed') {
                  bookingIsCancelledOrOutdated = true;
                }
              }
            } catch (err) {
              console.error("Error checking booking status:", err);
            }
          }

          if (bookingIsCancelledOrOutdated) {
            existingContract = null;
            if (contractIdParam) {
              toast.info("The appointment associated with this contract is cancelled or outdated. Starting a new application.");
            }
          }

          if (existingContract) {
            setContract(existingContract);
            setResumingContract(true);

            // Determine which step to resume from
            let resumeStep = 1;
            const tenantSigned = existingContract.tenantSignature?.signed || false;
            const landlordSigned = existingContract.landlordSignature?.signed || false;
            const isTenant = currentUser?._id === existingContract.tenantId?._id || currentUser?._id === existingContract.tenantId;

            if (existingContract.status === 'draft') {
              if (existingContract.rentLockPlan) {
                resumeStep = 2; // Contract review
              } else {
                resumeStep = 1; // Plan selection
              }
            } else if (existingContract.status === 'pending_signature') {
              if (isTenant && !tenantSigned) {
                resumeStep = 3;
              } else if (!isTenant && !landlordSigned) {
                resumeStep = 3;
              } else if (!tenantSigned || !landlordSigned) {
                resumeStep = 3;
              } else {
                resumeStep = 4;
              }
            } else if (existingContract.status === 'active') {
              if (existingContract.walletId || existingContract.wallet || existingContract.securityDepositPaid) {
                resumeStep = 5; // Move-in
              } else {
                resumeStep = 4; // Payment
              }
            } else {
              resumeStep = 2;
            }

            const bookingDetails = existingContract.bookingId && typeof existingContract.bookingId === 'object'
              ? existingContract.bookingId
              : null;

            setStep(resumeStep);
            setFormData(prev => ({
              ...prev,
              rentLockPlan: existingContract.rentLockPlan || prev.rentLockPlan,
              customLockDuration: existingContract.lockDuration || prev.customLockDuration,
              moveInDate: existingContract.moveInDate ? new Date(existingContract.moveInDate).toISOString().split('T')[0] : prev.moveInDate,
              bookingId: existingContract.bookingId?._id || existingContract.bookingId || prev.bookingId,
              depositPlan: existingContract.depositPlan || prev.depositPlan || 'standard',
              appointmentTime: bookingDetails?.time || prev.appointmentTime,
              appointmentMessage: bookingDetails?.message || prev.appointmentMessage,
              appointmentPurpose: bookingDetails?.purpose || prev.appointmentPurpose || 'rent'
            }));

            // Fetch booking if exists
            if (existingContract.bookingId) {
              try {
                const bookingId = existingContract.bookingId?._id || existingContract.bookingId;
                const bookingRes = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${bookingId}`, {
                });
                if (bookingRes.ok) {
                  const bookingData = await bookingRes.json();
                  const booking = bookingData.appointment || bookingData.booking || bookingData;
                  if (booking && booking._id) {
                    setBooking(booking);
                  }
                }
              } catch (bookingError) {
                console.error("Error fetching booking:", bookingError);
              }
            }

            if (!contractIdParam) {
              toast.info('Found an existing application. Resuming where you left off.');
            }
          }
        }
      } catch (error) {
        console.error("Error fetching listing:", error);
        toast.error(error.message || "Failed to load property details.");
        navigate("/user");
      } finally {
        setLoading(false);
      }
    };

    fetchListingAndContract();
  }, [listingId, contractIdParam, currentUser, navigate]);

  useEffect(() => {
    if (booking) {
      const normalizedDate = booking.date
        ? new Date(booking.date).toISOString().split('T')[0]
        : null;
      setFormData(prev => ({
        ...prev,
        moveInDate: normalizedDate || prev.moveInDate,
        appointmentTime: booking.time || prev.appointmentTime,
        appointmentMessage: booking.message || prev.appointmentMessage,
        appointmentPurpose: booking.purpose || prev.appointmentPurpose || 'rent'
      }));
    }
  }, [booking]);

  useEffect(() => {
    const contractIdentifier = contract?.contractId || contract?._id;
    if (step !== 3 || !contractIdentifier || contract?.landlordSignature?.signed) {
      return;
    }

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts/${contractIdentifier}`, {
        });
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        const updatedContract = data.contract || data;
        if (updatedContract && !cancelled) {
          const landlordJustSigned = updatedContract.landlordSignature?.signed && !contract.landlordSignature?.signed;
          setContract(updatedContract);
          if (landlordJustSigned) {
            toast.success('Landlord signed the contract. You can proceed to payment.');
          }
        }
      } catch (error) {
        console.error('Error refreshing contract status:', error);
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [step, contract?.contractId, contract?._id, contract?.landlordSignature?.signed, contract?.tenantSignature?.signed]);

  const handlePlanChange = (plan) => {
    setFormData(prev => ({
      ...prev,
      rentLockPlan: plan
    }));
  };

  const handleAppointmentFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleStartContractConfirmation = async () => {
    try {
      setLoading(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/send-contract-confirmation-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to send verification code");
      }
      setShowInitConfirmation(false);
      setShowOtpModal(true);
      setOtpTimer(60);
      setOtpError("");
      setOtpValue("");
      toast.success("Verification code sent to your email");
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpTimer > 0 || otpResending) return;
    try {
      setOtpResending(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/send-contract-confirmation-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to resend code");
      setOtpTimer(60);
      setOtpError("");
      toast.success("Verification code resent");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setOtpResending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) {
      setOtpError("Please enter 6-digit code");
      return;
    }
    try {
      setOtpVerifying(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, otp: otpValue })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid verification code");

      setShowOtpModal(false);
      await proceedToContractGeneration();
    } catch (error) {
      setOtpError(error.message);
    } finally {
      setOtpVerifying(false);
    }
  };

  const proceedToContractGeneration = async () => {
    setShowInitConfirmation(false);
    try {
      setLoading(true);
      const bookingRes = await authenticatedFetch(`${API_BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId,
          date: formData.moveInDate || new Date().toISOString().split('T')[0],
          time: formData.appointmentTime || '12:00',
          message: formData.appointmentMessage?.trim()
            ? `${formData.appointmentMessage} (Rent-Lock Plan: ${formData.rentLockPlan})`
            : `Rent-Lock Plan: ${formData.rentLockPlan}`,
          purpose: formData.appointmentPurpose || 'rent',
          propertyName: listing?.name || '',
          propertyDescription: listing?.description || '',
          rentLockPlanSelected: formData.rentLockPlan,
          customLockDuration: formData.rentLockPlan === 'custom' ? formData.customLockDuration : null,
          visibleToBuyer: false, // Hide booking until payment is complete
          visibleToSeller: false // Hide booking until payment is complete
        })
      });

      const bookingData = await bookingRes.json();
      if (!bookingRes.ok) {
        throw new Error(bookingData.message || "Failed to create booking");
      }

      // Validate booking data structure - booking API returns 'appointment', not 'booking'
      const booking = bookingData.appointment || bookingData.booking || bookingData;
      if (!booking || !booking._id) {
        throw new Error("Invalid booking data received. Please try again.");
      }

      setBooking(booking);
      setFormData(prev => ({
        ...prev,
        bookingId: booking._id,
        appointmentTime: booking.time || prev.appointmentTime,
        appointmentMessage: booking.message || prev.appointmentMessage,
        appointmentPurpose: booking.purpose || prev.appointmentPurpose || 'rent'
      }));

      // Create contract
      const lockDuration = formData.rentLockPlan === '1_year' ? 12 :
        formData.rentLockPlan === '3_year' ? 36 :
          formData.rentLockPlan === '5_year' ? 60 :
            formData.customLockDuration;

      const startDate = formData.moveInDate ? new Date(formData.moveInDate) : new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + lockDuration);

      const contractRes = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking._id,
          rentLockPlan: formData.rentLockPlan,
          lockDuration,
          lockedRentAmount: listing?.monthlyRent || listing?.discountPrice || listing?.regularPrice || 0,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          paymentFrequency: 'monthly',
          dueDate: 1,
          securityDeposit: securityDeposit,
          depositPlan: formData.depositPlan,
          extraMonthlyCharge: depositDetails.extraMonthlyCharge,
          insuranceFee: depositDetails.insuranceFee,
          maintenanceCharges: listing?.maintenanceCharges || 0,
          advanceRent: 0,
          moveInDate: startDate.toISOString(),
          customClauses: customClauses // Pass AI-generated clauses
        })
      });

      const contractData = await contractRes.json();
      if (!contractRes.ok) {
        throw new Error(contractData.message || "Failed to create contract");
      }

      // Validate contract data structure
      const contract = contractData.contract || contractData;
      if (!contract) {
        throw new Error("Invalid contract data received. Please try again.");
      }

      // Get contract ID (check both contractId and _id)
      const contractId = contract.contractId || contract._id;
      if (!contractId) {
        throw new Error("Contract ID not found. Please try again.");
      }

      // Fetch full contract details with populated fields
      try {
        const fullContractRes = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts/${contractId}`, {
        });

        if (fullContractRes.ok) {
          const fullContractData = await fullContractRes.json();
          if (fullContractData.success && fullContractData.contract) {
            setContract(fullContractData.contract);
          } else if (fullContractData.contract) {
            setContract(fullContractData.contract);
          } else {
            // Fallback to contract from create response
            setContract(contract);
          }
        } else {
          // If fetch fails, use contract from create response
          setContract(contract);
        }
      } catch (fetchError) {
        console.error("Error fetching full contract details:", fetchError);
        // Fallback to contract from create response
        setContract(contract);
      }

      setStep(2); // Move to contract review
    } catch (error) {
      console.error("Error creating booking/contract:", error);
      toast.error(error.message || "Failed to proceed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      // Validate plan selection
      if (!formData.rentLockPlan) {
        toast.error("Please select a rent-lock plan.");
        return;
      }

      if (formData.rentLockPlan === 'custom' && (!formData.customLockDuration || formData.customLockDuration < 1 || formData.customLockDuration > 60)) {
        toast.error("Custom lock duration must be between 1 and 60 months.");
        return;
      }

      // Validate move-in date is required
      if (!formData.moveInDate || formData.moveInDate.trim() === '') {
        toast.error("Please select a move-in date. You can modify it later if needed.");
        return;
      }

      if (!formData.appointmentTime) {
        toast.error("Please select a preferred appointment time.");
        return;
      }

      if (!formData.appointmentPurpose) {
        toast.error("Please choose the purpose of this visit.");
        return;
      }

      // Show confirmation modal instead of proceeding directly
      setShowInitConfirmation(true);

    } else if (step === 2) {
      // Contract review - user can proceed to signing
      setStep(3); // Move to signing
    } else if (step === 3) {
      // Signing handled by sign buttons and signature component
      // If both signed, move to payment
      if (contract?.tenantSignature?.signed && contract?.landlordSignature?.signed) {
        setStep(4);
        setShowPaymentModal(true);
      } else {
        toast.info("Please sign the contract before proceeding.");
      }
    }
  };

  const handleSignClick = (isTenant) => {
    // Check if already signed
    if (isTenant && contract.tenantSignature?.signed) {
      toast.info("You have already signed this contract.");
      return;
    }
    if (!isTenant && contract.landlordSignature?.signed) {
      toast.info("Landlord has already signed this contract.");
      return;
    }

    setSigningAs(isTenant ? 'tenant' : 'landlord');
    setShowSignatureModal(true);
  };

  const handleSignatureConfirm = async (signatureData) => {
    if (!contract) {
      toast.error("Contract not found.");
      return;
    }

    // Determine if user is tenant or landlord if signingAs is not set (e.g., inline signature)
    let roleToSign = signingAs;
    if (!roleToSign) {
      const isTenantUser = currentUser?._id === contract.tenantId?._id ||
        currentUser?._id === contract.tenantId ||
        String(currentUser?._id) === String(contract.tenantId?._id) ||
        String(currentUser?._id) === String(contract.tenantId);
      roleToSign = isTenantUser ? 'tenant' : 'landlord';
    }

    if (!roleToSign) {
      toast.error("Unable to determine your role in this contract.");
      return;
    }

    const isTenant = roleToSign === 'tenant';

    try {
      setLoading(true);

      // Get contract ID - prefer contractId string field, then _id
      const contractId = contract?.contractId || contract?._id;
      if (!contractId) {
        throw new Error("Contract ID not found. Please refresh and try again.");
      }

      console.log('Signing contract with ID:', contractId, 'Contract:', contract);

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

      // Refresh contract details after signing
      if (data.contract) {
        setContract(data.contract);
      } else {
        // If contract not in response, fetch it again
        const contractRes = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts/${contractId}`, {
        });
        if (contractRes.ok) {
          const contractData = await contractRes.json();
          if (contractData.success && contractData.contract) {
            setContract(contractData.contract);
          }
        }
      }

      setShowSignatureModal(false);
      setSigningAs(null);

      if (data.isFullySigned) {
        toast.success("Contract fully signed by both parties!");
        setContract(data.contract);
        setStep(4); // Move to payment
        setShowPaymentModal(true);
      } else {
        toast.success(isTenant ? "Your signature added. Waiting for landlord to sign." : "Your signature added. Waiting for tenant to sign.");

        // If landlord signs and tenant already signed, move to payment
        if (!isTenant && contract.tenantSignature?.signed) {
          setStep(4);
          setShowPaymentModal(true);
        }
      }
    } catch (error) {
      console.error("Error signing contract:", error);
      toast.error(error.message || "Failed to sign contract. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (payment) => {
    // Make booking visible after payment succeeds
    if (booking?._id) {
      try {
        await authenticatedFetch(`${API_BASE_URL}/api/bookings/${booking._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visibleToBuyer: true,
            visibleToSeller: true,
            paymentConfirmed: true
          })
        });
      } catch (error) {
        console.error("Error updating booking visibility:", error);
      }
    }

    // Update contract payment status if rental payment
    if (contract?._id && payment?.contractId) {
      try {
        // Refresh contract to get updated payment status
        const contractRes = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts/${contract._id}`, {
        });
        if (contractRes.ok) {
          const contractData = await contractRes.json();
          const updatedContract = contractData.contract || contractData;
          setContract(updatedContract);
        }
      } catch (error) {
        console.error("Error refreshing contract:", error);
      }
    }

    // Dispatch event to update MyPayments page if it's open
    if (payment?.paymentId) {
      window.dispatchEvent(new CustomEvent('paymentStatusUpdated', {
        detail: {
          paymentId: payment.paymentId,
          paymentConfirmed: true,
          appointmentId: booking?._id,
          contractId: contract?._id
        }
      }));
    }

    // Store payment info for receipt viewing
    setLastPayment(payment);

    toast.success("Payment successful! Proceeding to Move-in step...");
    // Move to step 5 (Move-in)
    setStep(5);
    setShowPaymentModal(false);

    // Refresh booking and contract data
    if (booking?._id) {
      try {
        const bookingRes = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${booking._id}`, {
        });
        if (bookingRes.ok) {
          const bookingData = await bookingRes.json();
          const refreshedBooking = bookingData.appointment || bookingData.booking || bookingData;
          setBooking(refreshedBooking);
        }
      } catch (error) {
        console.error("Error refreshing booking:", error);
      }
    }
  };

  if (loading && !listing) {
    return <RentPropertySkeleton />;
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Property not found.</p>
          <button
            onClick={() => navigate("/user")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
          >
            <FaHome /> Go Home
          </button>
        </div>
      </div>
    );
  }

  // Show rejection message if contract is rejected or terminated
  if (contract && (contract.status === 'rejected' || contract.status === 'terminated')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 py-10 px-4 md:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            <div className="mb-6">
              <FaTimesCircle className="text-6xl text-red-500 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
                {contract.status === 'rejected' ? 'Contract Rejected' : 'Contract Terminated'}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {contract.status === 'rejected'
                  ? 'This contract was rejected by the seller before completion.'
                  : 'This contract was terminated before completion.'}
              </p>
              {contract.rejectionReason && contract.status === 'rejected' && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4 text-left">
                  <p className="font-semibold text-red-800 dark:text-red-200 mb-1">Rejection Reason:</p>
                  <p className="text-red-700 dark:text-red-300">{contract.rejectionReason}</p>
                </div>
              )}
              {contract.terminationReason && contract.status === 'terminated' && (
                <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-4 text-left">
                  <p className="font-semibold text-orange-800 dark:text-orange-200 mb-1">Termination Reason:</p>
                  <p className="text-orange-700 dark:text-orange-300">{contract.terminationReason}</p>
                </div>
              )}
              {(contract.rejectedAt || contract.terminatedAt) && (
                <p className="text-sm text-gray-500 mb-4">
                  {contract.status === 'rejected' ? 'Rejected' : 'Terminated'} on{' '}
                  {new Date(contract.rejectedAt || contract.terminatedAt).toLocaleString('en-GB')}
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate(`/user/rent-property?listingId=${listingId}`)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <FaLock /> Book New Contract
              </button>
              <button
                onClick={() => navigate("/user/rental-contracts")}
                className="px-6 py-3 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center gap-2"
              >
                <FaFileContract /> View All Contracts
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const lockDurationMonths = formData.rentLockPlan === '1_year' ? 12 :
    formData.rentLockPlan === '3_year' ? 36 :
      formData.rentLockPlan === '5_year' ? 60 :
        formData.customLockDuration || 12;

  const monthlyRent = listing.monthlyRent || listing.discountPrice || listing.regularPrice || 0;

  // Calculate deposit and charges based on selected plan
  const getDepositDetails = () => {
    const baseDepositMonths = listing.securityDepositMonths || 2;

    switch (formData.depositPlan) {
      case 'low':
        // Low Deposit: 1 month rent + ₹750/month extra charge
        return {
          depositMonths: 1,
          depositAmount: monthlyRent * 1,
          extraMonthlyCharge: 750,
          insuranceFee: 0,
          planName: 'Low Deposit Plan'
        };
      case 'zero':
        // Zero Deposit: ₹0 deposit + ₹300/month insurance
        return {
          depositMonths: 0,
          depositAmount: 0,
          extraMonthlyCharge: 0,
          insuranceFee: 300,
          planName: 'Zero Deposit Plan'
        };
      default: // 'standard'
        // Standard: 2 months rent (default)
        return {
          depositMonths: baseDepositMonths,
          depositAmount: monthlyRent * baseDepositMonths,
          extraMonthlyCharge: 0,
          insuranceFee: 0,
          planName: 'Standard Deposit'
        };
    }
  };

  const depositDetails = getDepositDetails();
  const securityDeposit = depositDetails.depositAmount;
  const totalAmount = securityDeposit + monthlyRent; // Security deposit + first month rent (extra charges are monthly)

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 min-h-screen py-10 px-4 md:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Step 0: Property Summary Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 flex flex-col sm:flex-row gap-6 relative overflow-hidden group hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full pointer-events-none -mr-8 -mt-8"></div>

          <div className="w-full sm:w-32 h-48 sm:h-32 flex-shrink-0 relative rounded-xl overflow-hidden border-2 border-gray-100 dark:border-gray-600 shadow-sm group-hover:scale-[1.02] transition-transform duration-300">
            <img
              src={listing.imageUrls?.[0] || 'https://via.placeholder.com/300?text=No+Image'}
              alt={listing.name}
              className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-700"
              onError={(e) => { e.target.src = 'https://via.placeholder.com/300?text=Image+Error'; }}
            />
            {listing.availabilityStatus === 'available' && (
              <span className="absolute top-2 left-2 px-2 py-0.5 bg-green-500 text-white text-[10px] uppercase font-bold tracking-wide rounded shadow-sm">
                Available
              </span>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center relative z-10">
            <h1
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/listing/${listing._id}`);
              }}
              className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-50 leading-tight mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors cursor-pointer hover:underline">
              {listing.name}
            </h1>

            <p className="text-gray-600 dark:text-gray-400 flex items-start gap-2 mb-3 text-sm sm:text-base">
              <FaMapMarkerAlt className="text-red-500 mt-1 flex-shrink-0 text-lg animate-bounce-slow" />
              <span className="leading-snug">{listing.address || `${listing.city}, ${listing.state}`}</span>
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg text-xs font-bold uppercase tracking-wider border border-blue-100 dark:border-blue-800">
                For Rent
              </span>

              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 hidden sm:block"></div>

              <span className="text-2xl font-bold text-gray-800 dark:text-blue-400 flex items-baseline">
                ₹{(listing.monthlyRent || listing.discountPrice || listing.regularPrice || 0).toLocaleString('en-IN')}
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
                    // Allow navigation if step is completed or current, or if going back
                    if (step >= s || (step > s)) {
                      setStep(s);
                    }
                  }}
                  title={step > s ? 'Click to go back' : ''}
                >
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-sm md:text-base font-bold transition-all duration-500 border-4 shadow-sm ${step > s
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : step === s
                      ? 'bg-white dark:bg-gray-800 border-blue-600 text-blue-600 scale-110 shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 group-hover:border-blue-300 dark:group-hover:border-blue-500 transition-colors'
                    }`}>
                    {step > s ? <FaCheck className="text-sm md:text-base" /> : s}
                  </div>
                  <span className={`absolute top-12 md:top-14 text-[10px] md:text-xs font-bold whitespace-nowrap transition-colors duration-300 uppercase tracking-wide ${step >= s ? 'text-blue-700' : 'text-gray-400'
                    }`}>
                    {s === 1 ? 'Select Plan' : s === 2 ? 'Review' : s === 3 ? 'Sign' : s === 4 ? 'Pay' : 'Move-in'}
                  </span>
                </div>
                {s < 5 && (
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 relative mx-2 rounded-full overflow-hidden">
                    <div
                      className={`absolute top-0 left-0 h-full bg-blue-600 transition-all duration-700 ease-out rounded-full ${step > s ? 'w-full' : 'w-0'
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

        {/* Step 1: Plan Selection */}
        {step === 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400 mb-6">Select Rent-Lock Plan</h2>

            {/* Property Summary */}
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg mb-6">
              <h3 className="font-semibold text-lg mb-2 text-gray-800 dark:text-white">{listing.name}</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">{listing.address || `${listing.city}, ${listing.state}`}</p>
              <p className="text-blue-600 dark:text-blue-400 font-semibold">₹{monthlyRent.toLocaleString('en-IN')}/month</p>
            </div>

            {/* Plan Selection */}
            <div className="space-y-4 mb-6">
              {(listing.rentLockPlans?.availablePlans || ['1_year', '3_year', '5_year']).map((plan) => (
                <label
                  key={plan}
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${formData.rentLockPlan === plan
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                    } ${contract ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  <input
                    type="radio"
                    name="rentLockPlan"
                    value={plan}
                    checked={formData.rentLockPlan === plan}
                    onChange={(e) => handlePlanChange(e.target.value)}
                    disabled={!!contract}
                    className="mr-4"
                  />
                  <div className="flex-1">
                    <div className="flex items-center">
                      <FaLock className="text-blue-600 dark:text-blue-400 mr-2" />
                      <span className="font-semibold text-lg text-gray-800 dark:text-gray-200">
                        {plan === '1_year' ? '1 Year Rent-Lock' :
                          plan === '3_year' ? '3 Year Rent-Lock' :
                            plan === '5_year' ? '5 Year Secure Plan' :
                              'Custom Duration'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {plan === '1_year' ? 'Rent locked for 12 months' :
                        plan === '3_year' ? 'Rent locked for 36 months' :
                          plan === '5_year' ? 'Rent locked for 60 months' :
                            'Custom lock duration'}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            {/* Custom Duration Input */}
            {formData.rentLockPlan === 'custom' && (
              <div className="mb-6">
                <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                  Custom Lock Duration (months)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={formData.customLockDuration}
                  onChange={(e) => setFormData(prev => ({ ...prev, customLockDuration: parseInt(e.target.value) || 12 }))}
                  disabled={!!contract}
                  className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 ${contract ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`}
                />
              </div>
            )}

            {/* Move-in Date */}
            <div className="mb-6">
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                <FaCalendarAlt className="inline mr-2" />
                Preferred Visit / Move-in Date <span className="text-gray-500 dark:text-gray-400 text-sm font-normal">(can be modified later)</span>
              </label>
              <input
                type="date"
                value={formData.moveInDate}
                onChange={(e) => setFormData(prev => ({ ...prev, moveInDate: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
                required
                disabled={!!contract}
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${contract ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`}
              />
            </div>

            {/* Appointment style inputs */}
            <div className={`mb-6 border border-gray-200 dark:border-gray-600 rounded-lg p-4 ${contract ? 'bg-gray-50 dark:bg-gray-700 opacity-80' : ''}`}>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Schedule Your Visit</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preferred Time</label>
                  <select
                    value={formData.appointmentTime}
                    onChange={(e) => handleAppointmentFieldChange('appointmentTime', e.target.value)}
                    className={`w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${contract ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`}
                    required
                    disabled={!!contract}
                  >
                    <option value="">Select Time (9 AM - 7 PM)</option>
                    {Array.from({ length: 21 }, (_, i) => {
                      const totalMinutes = 9 * 60 + i * 30;
                      const hour = Math.floor(totalMinutes / 60);
                      const minutes = totalMinutes % 60;
                      const timeStr = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                      const period = hour >= 12 ? 'PM' : 'AM';
                      const displayStr = `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
                      return (
                        <option key={timeStr} value={timeStr}>
                          {displayStr}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Purpose</label>
                  <select
                    value={formData.appointmentPurpose}
                    onChange={(e) => handleAppointmentFieldChange('appointmentPurpose', e.target.value)}
                    className={`w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${contract ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`}
                    required
                    disabled={!!contract}
                  >
                    <option value="">Select Purpose</option>
                    <option value="rent">Rent Discussion</option>
                    <option value="inspection">Property Inspection</option>
                    <option value="followup">Follow-up Visit</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message (optional)</label>
                <textarea
                  value={formData.appointmentMessage}
                  onChange={(e) => handleAppointmentFieldChange('appointmentMessage', e.target.value)}
                  rows="4"
                  placeholder="Tell the owner about your requirements, preferred slots, or anything else they'd need to know before the visit."
                  disabled={!!contract}
                  className={`w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 ${contract ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`}
                ></textarea>
              </div>
            </div>

            {/* AI Legal Assistant Section */}
            <div className={`mb-6 border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 ${contract ? 'opacity-60 pointer-events-none' : ''}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded-full uppercase font-bold">New</span>
                <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-300 border-none">AI Legal Assistant</h3>
              </div>

              <div className="mb-4">
                <p className="text-sm text-purple-800 dark:text-purple-300 mb-2">
                  Need specific terms? Describe them (e.g., "No loud music after 10 PM", "Landlord pays water bill") and our AI will draft a formal legal clause for you.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newClauseInput}
                    onChange={(e) => setNewClauseInput(e.target.value)}
                    placeholder="Describe your custom condition..."
                    className="flex-1 p-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 w-full dark:bg-gray-800 dark:border-purple-600 dark:text-white dark:placeholder-gray-400"
                    disabled={draftingClause || !!contract}
                    onKeyDown={(e) => e.key === 'Enter' && handleDraftClause()}
                  />
                  <button
                    onClick={handleDraftClause}
                    disabled={draftingClause || !newClauseInput.trim() || !!contract}
                    className="bg-purple-600 text-white px-4 py-3 sm:py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium w-full sm:w-auto"
                  >
                    {draftingClause ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Drafting...
                      </>
                    ) : (
                      <>
                        <span>✨ Draft</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* List of Custom Clauses */}
              {customClauses.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-300">Added Clauses:</h4>
                  {customClauses.map((clause, index) => (
                    <div key={index} className="bg-white dark:bg-gray-800 p-3 rounded border border-purple-200 dark:border-purple-800 flex justify-between items-start gap-3 shadow-sm">
                      <p className="text-sm text-gray-800 dark:text-gray-300 italic">"{clause}"</p>
                      <button
                        onClick={() => removeClause(index)}
                        className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1"
                        title="Remove clause"
                        disabled={!!contract}
                      >
                        <FaTimesCircle />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Deposit Plan Selection */}
            <div className="mb-6">
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-3">
                <FaShieldAlt className="inline mr-2" />
                Select Deposit Plan
              </label>
              <div className="space-y-3">
                {/* Standard Deposit */}
                <label
                  className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition ${formData.depositPlan === 'standard'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                    } ${contract ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  <input
                    type="radio"
                    name="depositPlan"
                    value="standard"
                    checked={formData.depositPlan === 'standard'}
                    onChange={(e) => setFormData(prev => ({ ...prev, depositPlan: e.target.value }))}
                    disabled={!!contract}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-semibold text-lg text-gray-800 dark:text-white">Standard Deposit (Default)</span>
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">₹{depositDetails.depositAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Security Deposit = {depositDetails.depositMonths} month{depositDetails.depositMonths !== 1 ? 's' : ''} rent
                      <br />
                      <span className="text-green-600 dark:text-green-400">✓ Fully refundable</span>
                    </p>
                  </div>
                </label>

                {/* Low Deposit Plan */}
                <label
                  className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition ${formData.depositPlan === 'low'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                    } ${contract ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  <input
                    type="radio"
                    name="depositPlan"
                    value="low"
                    checked={formData.depositPlan === 'low'}
                    onChange={(e) => setFormData(prev => ({ ...prev, depositPlan: e.target.value }))}
                    disabled={!!contract}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-semibold text-lg text-gray-800 dark:text-white">Low Deposit Plan</span>
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">₹{depositDetails.depositAmount.toLocaleString('en-IN')} + ₹{depositDetails.extraMonthlyCharge}/month</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Security Deposit = 1 month rent
                      <br />
                      <span className="text-amber-600 dark:text-amber-500">+ ₹{depositDetails.extraMonthlyCharge} extra monthly charge</span>
                      <br />
                      <span className="text-green-600 dark:text-green-400">✓ Deposit fully refundable</span>
                    </p>
                  </div>
                </label>

                {/* Zero Deposit Plan */}
                <label
                  className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition ${formData.depositPlan === 'zero'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                    } ${contract ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  <input
                    type="radio"
                    name="depositPlan"
                    value="zero"
                    checked={formData.depositPlan === 'zero'}
                    onChange={(e) => setFormData(prev => ({ ...prev, depositPlan: e.target.value }))}
                    disabled={!!contract}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-semibold text-lg text-gray-800 dark:text-white">Zero Deposit Plan</span>
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">₹0 + ₹{depositDetails.insuranceFee}/month</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Security Deposit = ₹0
                      <br />
                      <span className="text-amber-600 dark:text-amber-500">+ ₹{depositDetails.insuranceFee}/month insurance fee</span>
                      <br />
                      <span className="text-blue-600 dark:text-blue-400">ℹ️ Covers owner's risk; fully handled by platform</span>
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-blue-50 dark:bg-gray-700/50 p-4 rounded-lg mb-6 border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold mb-3 text-lg text-gray-800 dark:text-white">Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Monthly Rent:</span>
                  <span className="font-semibold text-gray-800 dark:text-white">₹{monthlyRent.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Lock Duration:</span>
                  <span className="font-semibold text-gray-800 dark:text-white">{lockDurationMonths} months (Rent stays fixed)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Selected Deposit Plan:</span>
                  <span className="font-semibold text-blue-700 dark:text-blue-400">{depositDetails.planName}</span>
                </div>
                {formData.depositPlan === 'standard' && (
                  <div className="flex justify-between pl-4 border-l-2 border-blue-300 dark:border-blue-600">
                    <span className="text-gray-600 dark:text-gray-400">Security Deposit ({depositDetails.depositMonths} month{depositDetails.depositMonths !== 1 ? 's' : ''}):</span>
                    <span className="font-semibold text-gray-800 dark:text-white">₹{depositDetails.depositAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {formData.depositPlan === 'low' && (
                  <div className="pl-4 border-l-2 border-blue-300 dark:border-blue-600 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Security Deposit (1 month):</span>
                      <span className="font-semibold text-gray-800 dark:text-white">₹{depositDetails.depositAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Extra Monthly Charge:</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-500">₹{depositDetails.extraMonthlyCharge}</span>
                    </div>
                  </div>
                )}
                {formData.depositPlan === 'zero' && (
                  <div className="pl-4 border-l-2 border-blue-300 dark:border-blue-600 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Security Deposit:</span>
                      <span className="font-semibold text-gray-800 dark:text-white">₹0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Insurance Fee (monthly):</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-500">₹{depositDetails.insuranceFee}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2 mt-2 font-semibold">
                  <span className="text-gray-800 dark:text-white">Total Payable Now:</span>
                  <span className="text-blue-600 dark:text-blue-400 text-lg">
                    {formData.depositPlan === 'zero'
                      ? `₹${(monthlyRent + depositDetails.insuranceFee).toLocaleString('en-IN')}`
                      : `₹${totalAmount.toLocaleString('en-IN')}`
                    }
                  </span>
                </div>
              </div>

              {/* Transparency Notes */}
              <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  <FaShieldAlt className="inline mr-1" />
                  <strong>Transparency Notes:</strong>
                </p>
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                  <li>Security deposit is fully refundable during move-out</li>
                  <li>No hidden charges</li>
                  <li>Rent stays fixed for the entire lock duration</li>
                  {formData.depositPlan === 'low' && (
                    <li>Extra monthly charge compensates seller for lower deposit</li>
                  )}
                  {formData.depositPlan === 'zero' && (
                    <li>Insurance fee covers owner's risk and is handled by platform</li>
                  )}
                </ul>
              </div>

              {/* Why am I paying this? */}
              <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800 bg-blue-100 dark:bg-blue-900/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-800 dark:text-white mb-2">
                  <FaMoneyBillWave className="inline mr-1" />
                  Why am I paying this?
                </p>
                <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
                  <li>• 1st Month Rent: Standard rental payment</li>
                  <li>• Security Deposit: Refundable protection for property owner</li>
                  {formData.depositPlan === 'zero' && (
                    <li>• Insurance Fee: Covers owner risk (no deposit required)</li>
                  )}
                  {formData.depositPlan === 'low' && (
                    <li>• Extra Monthly Charge: Compensates for lower deposit amount</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleNext}
                disabled={!!contract || loading || !formData.moveInDate || formData.moveInDate.trim() === ''}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? 'Processing...' : 'Continue to Contract Review'}
                <FaChevronRight className="ml-2" />
              </button>

              {contract && (
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 flex items-center justify-center"
                >
                  Proceed to Contract <FaChevronRight className="ml-2" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Contract Review */}
        {step === 2 && contract && listing && (
          <div className="space-y-6">
            <ContractPreview
              contract={contract}
              listing={listing}
              tenant={currentUser}
              landlord={contract.landlordId}
              onDownload={() => toast.success("Contract PDF downloaded!")}
            />

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex flex-col-reverse sm:flex-row gap-4">
                <button
                  onClick={() => {
                    if (step > 1) {
                      setStep(step - 1);
                    }
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center gap-2"
                >
                  <FaChevronLeft /> Back
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center"
                >
                  Continue to Signing
                  <FaChevronRight className="ml-2" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Signing */}
        {step === 3 && contract && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400 mb-6 flex items-center gap-2">
              <FaFileContract /> Sign Contract
            </h2>

            <div className="space-y-6 mb-6">
              {/* Tenant Signature */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Tenant Signature</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {isTenant ? currentUser.username || currentUser.email : contract.tenantId?.username || contract.tenantId?.email || 'Tenant'}
                    </p>
                  </div>
                  {contract.tenantSignature?.signed && (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <FaCheckCircle className="text-2xl" />
                      <span className="font-semibold">Signed</span>
                    </div>
                  )}
                </div>
                {contract.tenantSignature?.signed ? (
                  <div className="p-4 bg-green-50 border-2 border-green-200 dark:bg-green-900/20 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Signed on {new Date(contract.tenantSignature.signedAt).toLocaleString('en-GB')}
                    </p>
                    {contract.tenantSignature.signatureData && (
                      <img
                        src={contract.tenantSignature.signatureData}
                        alt="Tenant signature"
                        className="mt-2 border border-gray-300 rounded bg-white"
                        style={{ maxHeight: '80px' }}
                      />
                    )}
                  </div>
                ) : isTenant ? (
                  <DigitalSignature
                    title="Tenant Signature"
                    userName={currentUser.username || currentUser.email}
                    onSign={(signatureData) => {
                      setSigningAs('tenant');
                      handleSignatureConfirm(signatureData);
                    }}
                    disabled={loading}
                  />
                ) : (
                  <div className="p-4 bg-gray-50 border-2 border-dashed border-gray-300 dark:bg-gray-800 dark:border-gray-600 rounded-lg text-center">
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                      Waiting for tenant to sign the contract
                    </p>
                  </div>
                )}
              </div>

              {/* Landlord Signature */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Landlord Signature</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {isLandlord ? currentUser.username || currentUser.email : contract.landlordId?.username || contract.landlordId?.email || 'Property Owner'}
                    </p>
                  </div>
                  {contract.landlordSignature?.signed ? (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <FaCheckCircle className="text-2xl" />
                      <span className="font-semibold">Signed</span>
                    </div>
                  ) : (
                    <span className="text-yellow-600 dark:text-yellow-400 font-semibold">Pending</span>
                  )}
                </div>
                {contract.landlordSignature?.signed ? (
                  <div className="p-4 bg-green-50 border-2 border-green-200 dark:bg-green-900/20 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Signed on {new Date(contract.landlordSignature.signedAt).toLocaleString('en-GB')}
                    </p>
                    {contract.landlordSignature.signatureData && (
                      <img
                        src={contract.landlordSignature.signatureData}
                        alt="Landlord signature"
                        className="mt-2 border border-gray-300 rounded bg-white"
                        style={{ maxHeight: '80px' }}
                      />
                    )}
                  </div>
                ) : (isLandlord && contract.tenantSignature?.signed) ? (
                  <DigitalSignature
                    title="Landlord Signature"
                    userName={currentUser.username || currentUser.email}
                    onSign={(signatureData) => {
                      setSigningAs('landlord');
                      handleSignatureConfirm(signatureData);
                    }}
                    disabled={loading}
                  />
                ) : (
                  <div className="p-4 bg-gray-50 border-2 border-dashed border-gray-300 dark:bg-gray-800 dark:border-gray-600 rounded-lg text-center">
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                      {!contract.tenantSignature?.signed
                        ? "Waiting for tenant to sign the contract first"
                        : "Waiting for landlord to sign the contract"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {contract.tenantSignature?.signed && contract.landlordSignature?.signed && (
              <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg mb-6 border border-green-200 dark:border-green-800">
                <p className="text-green-700 dark:text-green-300 font-semibold text-center">
                  <FaCheckCircle className="inline mr-2" />
                  Contract Fully Signed! Proceed to Payment.
                </p>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-4">
              <button
                onClick={() => {
                  if (step > 1) {
                    setStep(step - 1);
                  }
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center gap-2"
              >
                <FaChevronLeft /> Back
              </button>
              {contract.tenantSignature?.signed && (
                <button
                  onClick={() => {
                    if (readyForPayment) {
                      setStep(4);
                    }
                  }}
                  disabled={!readyForPayment || loading}
                  className={`flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center ${readyForPayment ? 'hover:bg-blue-700' : 'opacity-50 cursor-not-allowed'}`}
                >
                  {readyForPayment ? 'Proceed to Payment' : 'Waiting for Landlord Signature'}
                  {readyForPayment && <FaChevronRight className="ml-2" />}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Signature Modal (if needed for separate modal flow) */}
        {showSignatureModal && signingAs && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full p-6 relative">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                  {signingAs === 'tenant' ? 'Sign as Tenant' : 'Sign as Landlord'}
                </h3>
                <DigitalSignature
                  title={`${signingAs === 'tenant' ? 'Tenant' : 'Landlord'} Signature`}
                  userName={signingAs === 'tenant' ? (currentUser.username || currentUser.email) : 'Property Owner'}
                  onSign={(signatureData) => handleSignatureConfirm(signatureData)}
                  onCancel={() => {
                    setShowSignatureModal(false);
                    setSigningAs(null);
                  }}
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal for Step 1 */}
        {showInitConfirmation && (
          <div className="fixed inset-0 z-[60] overflow-y-auto bg-black bg-opacity-60 backdrop-blur-sm animate-fade-in">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 transform scale-100 animate-scale-in border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                    <FaFileContract className="text-3xl text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Confirm Application Details</h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                    Please review your details carefully. Once you proceed to contract generation, the <span className="font-semibold text-gray-800 dark:text-gray-200">rent-lock plan</span>, <span className="font-semibold text-gray-800 dark:text-gray-200">deposit plan</span>, and <span className="font-semibold text-gray-800 dark:text-gray-200">move-in date</span> will be locked and cannot be edited.
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6 text-sm border border-gray-100 dark:border-gray-600">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-500 dark:text-gray-400">Plan:</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                      {formData.rentLockPlan === '1_year' ? '1 Year Lock' :
                        formData.rentLockPlan === '3_year' ? '3 Year Lock' :
                          formData.rentLockPlan === '5_year' ? '5 Year Lock' :
                            formData.rentLockPlan === 'custom' ? `Custom (${formData.customLockDuration} months)` : 'Standard Plan'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-500 dark:text-gray-400">Move-in:</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                      {formData.moveInDate ? new Date(formData.moveInDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not selected'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400">Deposit:</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-200 capitalize">{formData.depositPlan} Plan</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowInitConfirmation(false)}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Edit Details
                  </button>
                  <button
                    onClick={handleStartContractConfirmation}
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 dark:shadow-blue-900/40 disabled:opacity-50"
                  >
                    {loading ? 'Sending Code...' : 'Confirm & Proceed'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* OTP Verification Modal */}
        {showOtpModal && (
          <div className="fixed inset-0 z-[70] overflow-y-auto bg-black bg-opacity-60 backdrop-blur-sm animate-fade-in">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 transform scale-100 animate-scale-in border border-gray-100 dark:border-gray-700 relative">
                <button
                  onClick={() => setShowOtpModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-600 dark:hover:text-gray-400"
                >
                  <FaTimesCircle className="text-xl" />
                </button>

                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-16 h-16 bg-purple-50 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4">
                    <FaLock className="text-3xl text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2 dark:text-white">Verify to Confirm Rent-Lock</h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                    We’ve sent a 6-digit verification code to <span className="font-semibold text-gray-800 dark:text-gray-200">{currentUser.email}</span>. Please enter it to finalize your Rent-Lock contract.
                  </p>
                </div>

                <div className="mb-6">
                  <input
                    ref={otpInputRef}
                    type="text"
                    maxLength="6"
                    value={otpValue}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setOtpValue(val);
                      if (val.length === 6) setOtpError("");
                    }}
                    placeholder="Enter 6-digit code"
                    className={`w-full text-center text-2xl sm:text-3xl ${otpValue ? 'tracking-[0.5em]' : 'tracking-normal'} placeholder:tracking-normal placeholder:text-base sm:placeholder:text-lg font-bold p-3 sm:p-4 border-2 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-100 transition-all bg-white dark:bg-gray-800 dark:text-white ${otpError ? 'border-red-500' : 'border-gray-200 dark:border-gray-600 focus:border-purple-500'}`}
                  />
                  {otpError && <p className="text-red-500 dark:text-red-400 text-sm mt-2 text-center">{otpError}</p>}
                </div>

                <div className="flex flex-col items-center gap-4">
                  <button
                    onClick={handleVerifyOtp}
                    disabled={otpValue.length !== 6 || otpVerifying}
                    className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold text-lg hover:bg-purple-700 transition-all transform hover:scale-[1.02] shadow-xl shadow-purple-200 dark:shadow-purple-900/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {otpVerifying ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Verifying...
                      </>
                    ) : (
                      <>
                        <FaCheckCircle /> Verify & Generate Contract
                      </>
                    )}
                  </button>

                  <div className="text-sm font-medium">
                    {otpTimer > 0 ? (
                      <p className="text-gray-500 dark:text-gray-400">Resend code in <span className="text-purple-600 dark:text-purple-400 font-bold">{otpTimer}s</span></p>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        Didn't receive code?
                        <button
                          onClick={handleResendOtp}
                          disabled={otpResending}
                          className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-500 hover:underline font-bold transition-colors disabled:opacity-50"
                        >
                          {otpResending ? 'Sending...' : 'Resend OTP'}
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Payment */}
        {step === 4 && contract && listing && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400 mb-6 flex items-center gap-2">
              <FaMoneyBillWave /> Payment Required
            </h2>

            {/* Payment Summary */}
            <div className="bg-blue-50 dark:bg-gray-700/50 p-6 rounded-lg mb-6 border border-blue-100 dark:border-gray-600">
              <h3 className="font-semibold text-lg mb-4 text-gray-800 dark:text-white">Payment Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Monthly Rent (Locked):</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">₹{(contract.lockedRentAmount || listing?.monthlyRent || listing?.discountPrice || listing?.regularPrice || 0).toLocaleString('en-IN')}</span>
                </div>
                {(contract.depositPlan !== 'zero') && (
                  <div className="flex justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Security Deposit:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">₹{(contract.securityDeposit || 0).toLocaleString('en-IN')}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">(Refundable)</span>
                  </div>
                )}
                {contract.depositPlan === 'low' && contract.extraMonthlyCharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Extra Monthly Charge:</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-500">₹{contract.extraMonthlyCharge.toLocaleString('en-IN')}/month</span>
                  </div>
                )}
                {contract.depositPlan === 'zero' && contract.insuranceFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Insurance Fee (monthly):</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-500">₹{contract.insuranceFee.toLocaleString('en-IN')}/month</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">First Month Rent:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">₹{(contract.lockedRentAmount || listing?.monthlyRent || listing?.discountPrice || listing?.regularPrice || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                  <span className="font-semibold text-lg text-gray-800 dark:text-white">Total Amount:</span>
                  <span className="font-bold text-lg text-blue-600 dark:text-blue-400">
                    ₹{(
                      (contract.securityDeposit || 0) +
                      (contract.lockedRentAmount || listing?.monthlyRent || listing?.discountPrice || listing?.regularPrice || 0) +
                      (contract.depositPlan === 'zero' ? (contract.insuranceFee || 0) : 0)
                    ).toLocaleString('en-IN')}
                  </span>
                </div>
                {contract.depositPlan && contract.depositPlan !== 'standard' && (
                  <div className="mt-2 pt-2 border-t border-blue-200 dark:border-gray-600">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      <span className="font-semibold">Deposit Plan:</span> {
                        contract.depositPlan === 'low' ? 'Low Deposit (Extra ₹' + (contract.extraMonthlyCharge || 0) + '/month)' :
                          contract.depositPlan === 'zero' ? 'Zero Deposit (Insurance ₹' + (contract.insuranceFee || 0) + '/month)' :
                            'Standard'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Please complete the payment for security deposit and first month's rent to proceed with move-in. Choose your preferred payment method below.
            </p>

            {/* Payment Options */}
            <div className="bg-white dark:bg-gray-700/50 border-2 border-blue-200 dark:border-gray-600 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Payment methods available:</p>
              <div className="flex items-center gap-4 text-sm text-gray-700 dark:text-gray-200">
                <span className="flex items-center gap-2">
                  <FaCreditCard className="text-blue-600 dark:text-blue-400" /> Razorpay
                </span>
                <span className="flex items-center gap-2">
                  <FaCreditCard className="text-yellow-600 dark:text-yellow-500" /> PayPal
                </span>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-4">
              <button
                onClick={() => {
                  if (step > 1) {
                    setStep(step - 1);
                  }
                }}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 flex items-center justify-center gap-2"
              >
                <FaChevronRight className="rotate-180" /> Back
              </button>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="flex-1 bg-blue-600 text-white py-3 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <FaMoneyBillWave /> Proceed to Payment
                <FaChevronRight />
              </button>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        <PaymentModal
          isOpen={showPaymentModal && step === 4 && booking && contract}
          onClose={() => {
            setShowPaymentModal(false);
          }}
          appointment={
            booking && contract ? {
              ...booking,
              contractId: contract._id,
              isRentalPayment: true,
              region: 'india', // Default to India for Razorpay
              securityDeposit: contract.securityDeposit || 0,
              firstMonthRent: contract.lockedRentAmount || listing?.monthlyRent || listing?.discountPrice || listing?.regularPrice || 0,
              insuranceFee: contract.insuranceFee || 0,
              extraMonthlyCharge: contract.extraMonthlyCharge || 0,
              depositPlan: contract.depositPlan || 'standard',
              propertyName: listing?.name || 'Property',
              propertyDescription: listing?.address || '',
              buyerId: contract.tenantId,
              sellerId: contract.landlordId
            } : {
              _id: null,
              region: 'india',
              isRentalPayment: true
            }
          }
          onPaymentSuccess={handlePaymentSuccess}
        />

        {/* Step 5: Move-in */}
        {step === 5 && contract && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400 mb-6 flex items-center gap-2">
              <FaHome /> Step 5: Finalize Move-in
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Payment Summary */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 p-5 rounded-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                    <FaCheckCircle className="text-xl" />
                  </div>
                  <div>
                    <h3 className="font-bold text-green-800 dark:text-green-300">Payment Confirmed</h3>
                    <p className="text-xs text-green-700 dark:text-green-400">Security deposit & first month rent received</p>
                  </div>
                </div>

                {(lastPayment || contract.securityDepositPaid) && (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Status:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">SUCCESSFUL</span>
                    </div>
                    {(lastPayment?.paymentId || contract.walletId) && (
                      <button
                        onClick={() => {
                          const pId = lastPayment?.paymentId || (contract.wallet?.paymentSchedule?.[0]?.paymentId?._id || contract.wallet?.paymentSchedule?.[0]?.paymentId);
                          if (pId || lastPayment?.paymentId) {
                            window.open(`${API_BASE_URL}/api/payments/${lastPayment?.paymentId || pId}/receipt`, '_blank');
                          } else {
                            toast.info("Receipt is being generated. Please check your email or My Appointments in a few minutes.");
                          }
                        }}
                        className="w-full mt-2 py-2 bg-white dark:bg-gray-800 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-400 rounded-lg text-sm font-semibold hover:bg-green-50 dark:hover:bg-green-900/30 flex items-center justify-center gap-2 transition-colors"
                      >
                        <FaDownload /> Download Payment Receipt
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Move-in Status */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-5 rounded-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${contract.moveInChecklistCompleted ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'} dark:bg-opacity-20`}>
                    {contract.moveInChecklistCompleted ? <FaCheckCircle className="text-xl" /> : <FaCalendarAlt className="text-xl" />}
                  </div>
                  <div>
                    <h3 className={`font-bold ${contract.moveInChecklistCompleted ? 'text-green-800 dark:text-green-300' : 'text-blue-800 dark:text-blue-300'}`}>
                      Move-in Checklist
                    </h3>
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      {contract.moveInChecklistCompleted ? 'Completed on move-in day' : 'Pending completion'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-3 italic">
                  Complete this checklist to document property condition and protect your security deposit.
                </p>
                {!contract.moveInChecklistCompleted && (
                  <button
                    onClick={() => {
                      const contractId = contract.contractId || contract._id;
                      navigate(`/user/services?contractId=${contractId}&checklist=move_in`);
                    }}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <FaReceipt /> Start Checklist
                  </button>
                )}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 mb-8 border border-gray-100 dark:border-gray-600">
              <h3 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                <FaShieldAlt className="text-blue-500" /> Next Steps
              </h3>
              <ul className="space-y-3">
                <li className="flex gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <div className="mt-1 text-green-500"><FaCheckCircle size={14} /></div>
                  <span>Collect keys from the landlord as per the agreed move-in date.</span>
                </li>
                <li className="flex gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <div className="mt-1 text-blue-500 text-xs font-bold border rounded-full w-4 h-4 flex items-center justify-center">2</div>
                  <span>Document any existing damages using the Move-in checklist.</span>
                </li>
                <li className="flex gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <div className="mt-1 text-blue-500 text-xs font-bold border rounded-full w-4 h-4 flex items-center justify-center">3</div>
                  <span>Your rent cycle will start automatically on the start date.</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => {
                  toast.success("Registration complete! You can access all details from your dashboard.");
                  navigate("/user/my-appointments");
                }}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 shadow-lg flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02]"
              >
                Go to My Appointments <FaChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>
    </div >
  );
}

