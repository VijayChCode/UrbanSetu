import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FaCreditCard, FaDollarSign, FaShieldAlt, FaDownload, FaCheckCircle, FaTimes, FaSpinner, FaCoins } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { authenticatedFetch } from '../utils/auth';

// Generate unique tab ID for cross-tab communication
const getTabId = () => {
  let tabId = sessionStorage.getItem('paymentTabId');
  if (!tabId) {
    tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('paymentTabId', tabId);
  }
  return tabId;
};

// Cross-tab and cross-browser payment lock manager
const createPaymentLockManager = (appointmentId) => {
  const tabId = getTabId();
  const lockKey = `payment_lock_${appointmentId}`;
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`payment_${appointmentId}`) : null;
  let heartbeatInterval = null;
  let backendHeartbeatInterval = null;
  let lockAcquired = false;

  // Try to acquire lock (backend + localStorage)
  const acquireLock = async () => {
    try {
      // First, try to acquire backend lock (works across browsers/devices)
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/lock/acquire`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ appointmentId })
      });

      const data = await response.json();

      // Check if backend lock acquisition failed
      if (response.status === 409) {
        // Another browser/device has the lock
        return { success: false, message: data.message || 'Payment session is already open in another browser/device. Please close that browser/device first before opening a new payment session.' };
      }

      if (!response.ok || !data.ok) {
        // Backend error, fall back to localStorage (same-browser only)
        console.warn('Backend lock acquisition failed, falling back to localStorage:', data);
      } else if (data.ok && data.locked === true) {
        // Backend lock acquired, also set localStorage (for same-browser detection)
        localStorage.setItem(lockKey, JSON.stringify({ tabId, timestamp: Date.now() }));
        lockAcquired = true;
        startHeartbeat();
        startBackendHeartbeat();
        return { success: true };
      }
    } catch (error) {
      console.error('Error acquiring backend lock:', error);
      // If backend fails, fall back to localStorage only (same-browser detection)
    }

    // Fallback to localStorage check (same-browser only)
    const lockData = localStorage.getItem(lockKey);
    const now = Date.now();

    if (lockData) {
      try {
        const { tabId: ownerTabId, timestamp } = JSON.parse(lockData);
        // If lock is older than 5 seconds without heartbeat, consider it stale
        if (now - timestamp > 5000 && ownerTabId !== tabId) {
          // Lock is stale, acquire it
          localStorage.setItem(lockKey, JSON.stringify({ tabId, timestamp: now }));
          lockAcquired = true;
          startHeartbeat();
          return { success: true, fallback: true };
        } else if (ownerTabId === tabId) {
          // We already own this lock
          lockAcquired = true;
          startHeartbeat();
          return { success: true, fallback: true };
        } else {
          // Another tab owns the lock
          return { success: false, message: 'Payment session is already open in another tab' };
        }
      } catch (e) {
        // Invalid lock data, acquire it
        localStorage.setItem(lockKey, JSON.stringify({ tabId, timestamp: now }));
        lockAcquired = true;
        startHeartbeat();
        return { success: true, fallback: true };
      }
    } else {
      // No lock exists, acquire it
      localStorage.setItem(lockKey, JSON.stringify({ tabId, timestamp: now }));
      lockAcquired = true;
      startHeartbeat();
      return { success: true, fallback: true };
    }
  };

  // Release lock (backend + localStorage)
  const releaseLock = async () => {
    // Stop heartbeats
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (backendHeartbeatInterval) {
      clearInterval(backendHeartbeatInterval);
      backendHeartbeatInterval = null;
    }

    // Release backend lock
    try {
      await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/lock/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ appointmentId })
      });
    } catch (error) {
      console.error('Error releasing backend lock:', error);
    }

    // Release localStorage lock
    const lockData = localStorage.getItem(lockKey);
    if (lockData) {
      try {
        const { tabId: ownerTabId } = JSON.parse(lockData);
        if (ownerTabId === tabId) {
          localStorage.removeItem(lockKey);
          if (channel) {
            channel.postMessage({ type: 'lock_released', tabId });
          }
        }
      } catch (e) {
        localStorage.removeItem(lockKey);
      }
    }
    lockAcquired = false;
  };

  // Start heartbeat to keep lock alive (localStorage for same-browser)
  const startHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    heartbeatInterval = setInterval(() => {
      const lockData = localStorage.getItem(lockKey);
      if (lockData) {
        try {
          const { tabId: ownerTabId } = JSON.parse(lockData);
          if (ownerTabId === tabId) {
            localStorage.setItem(lockKey, JSON.stringify({ tabId, timestamp: Date.now() }));
          } else {
            // Another tab owns the lock now
            releaseLock();
          }
        } catch (e) {
          releaseLock();
        }
      } else {
        releaseLock();
      }
    }, 2000); // Heartbeat every 2 seconds
  };

  // Start backend heartbeat to keep lock alive (cross-browser)
  const startBackendHeartbeat = () => {
    if (backendHeartbeatInterval) {
      clearInterval(backendHeartbeatInterval);
    }
    backendHeartbeatInterval = setInterval(async () => {
      try {
        const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/lock/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ appointmentId })
        });

        const data = await response.json();
        if (!response.ok || !data.ok || !data.locked) {
          // Lock was lost, release local resources
          releaseLock();
        }
      } catch (error) {
        console.error('Error sending backend heartbeat:', error);
        // On error, continue - lock might still be valid
      }
    }, 2000); // Heartbeat every 2 seconds
  };

  // Check if lock is held by another tab/browser
  const isLockedByAnotherTab = async () => {
    // First check backend lock (cross-browser)
    try {
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/lock/check/${appointmentId}`);

      const data = await response.json();
      if (data.ok && data.locked === true && !data.ownedByUser) {
        // Locked by another browser/device
        return { locked: true, message: data.message || 'Payment session is already open in another browser/device' };
      }
    } catch (error) {
      console.error('Error checking backend lock:', error);
      // Continue with localStorage check as fallback
    }

    // Fallback to localStorage check (same-browser only)
    const lockData = localStorage.getItem(lockKey);
    if (!lockData) return { locked: false };

    try {
      const { tabId: ownerTabId, timestamp } = JSON.parse(lockData);
      const now = Date.now();
      // If lock is stale (older than 5 seconds), consider it free
      if (now - timestamp > 5000) {
        return { locked: false };
      }
      if (ownerTabId !== tabId) {
        return { locked: true, message: 'Payment session is already open in another tab' };
      }
      return { locked: false };
    } catch (e) {
      return { locked: false };
    }
  };

  // Listen for lock release from other tabs
  const onLockReleased = (callback) => {
    if (!channel) return () => { };

    const handler = (event) => {
      if (event.data.type === 'lock_released') {
        callback();
      }
    };
    channel.addEventListener('message', handler);

    return () => {
      channel.removeEventListener('message', handler);
    };
  };

  // Cleanup
  const cleanup = () => {
    releaseLock();
    if (channel) {
      channel.close();
    }
    if (backendHeartbeatInterval) {
      clearInterval(backendHeartbeatInterval);
      backendHeartbeatInterval = null;
    }
  };

  return {
    acquireLock,
    releaseLock,
    isLockedByAnotherTab,
    onLockReleased,
    cleanup,
    lockAcquired: () => lockAcquired
  };
};

const PaymentModal = ({ isOpen, onClose, appointment, onPaymentSuccess, existingPayment, isServicePayment, servicePaymentDetails, isEMIPayment, emiDetails }) => {
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [preferredMethod, setPreferredMethod] = useState(() => (appointment?.region === 'india' ? 'razorpay' : 'paypal')); // 'paypal' or 'razorpay'
  const [expiryTimer, setExpiryTimer] = useState(null); // Timer for payment expiry (10 minutes)
  const [timeRemaining, setTimeRemaining] = useState(10 * 60); // 10 minutes in seconds
  const [paymentInitiatedTime, setPaymentInitiatedTime] = useState(null); // Store when payment was initiated
  const [lockAcquired, setLockAcquired] = useState(false); // Track if lock has been acquired
  const paymentDataRef = useRef(null); // Ref to access latest paymentData in timer callback
  const lockManagerRef = useRef(null); // Ref for payment lock manager
  const lowTimeWarningShownRef = useRef(false); // Ref to track if low time warning has been shown
  const expiresAtRef = useRef(null); // Ref to store the expiry timestamp for accurate time calculation
  const [monthlyRentContext, setMonthlyRentContext] = useState(null); // Store context to recreate monthly rent payments


  // Cancel payment when modal is closed without completing
  const cancelPayment = async () => {
    if (paymentData && paymentData.payment && (paymentData.payment.status === 'pending' || paymentData.payment.status === 'processing')) {
      try {
        await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentId: paymentData.payment.paymentId
          })
        });
      } catch (error) {
        console.error('Error cancelling payment:', error);
      }
    }
  };

  // Handle modal close
  const handleClose = async () => {
    // Clear expiry timer
    setExpiryTimer((prevTimer) => {
      if (prevTimer) {
        clearInterval(prevTimer);
      }
      return null;
    });

    // Release lock when closing
    if (lockManagerRef.current) {
      await lockManagerRef.current.releaseLock();
      lockManagerRef.current.cleanup();
      lockManagerRef.current = null;
    }

    // Show message that payment was not completed
    if (paymentData && paymentData.payment) {
      toast.info('Payment not completed. You can try again later.');
    } else {
      toast.info('Payment session closed. You can try again later.');
    }

    // Don't cancel payment when modal is closed - let it expire naturally after 10 minutes
    // This allows the user to reopen the modal and create a new payment ID if within 10 minutes
    // Payment will only be cancelled when:
    // 1. Timer expires (10 minutes) - handled by handleExpiry
    // 2. User explicitly cancels - handled separately
    // 3. Payment is completed - handled by onPaymentSuccess

    // Reset states (but keep payment data in backend for reuse)
    setTimeRemaining(10 * 60);
    setPaymentData(null);
    paymentDataRef.current = null;
    setPaymentSuccess(false);
    setPaymentInitiatedTime(null); // Reset initiation time
    setLockAcquired(false); // Reset lock acquired state

    onClose();
  };

  useEffect(() => {
    if (isOpen && appointment) {
      // Initialize lock manager for this appointment
      if (!lockManagerRef.current) {
        lockManagerRef.current = createPaymentLockManager(appointment._id);
      }

      // Reset lock acquired state when modal opens
      setLockAcquired(false);
      setLoading(true);

      // Try to acquire lock before opening modal (async)
      const acquireLockAsync = async () => {
        try {
          const result = await lockManagerRef.current.acquireLock();
          if (!result.success) {
            // Another tab/browser has the payment modal open
            toast.warning(result.message || 'A payment session is already open for this appointment in another window/tab/browser. Please close that window/tab/browser first before opening a new payment session.');
            // Close modal immediately
            setLoading(false);
            setLockAcquired(false);
            onClose();
            return;
          }

          // Lock acquired, mark as acquired and continue with modal initialization
          setLockAcquired(true);

          // Initialize method from appointment region before creating intent
          const methodFromAppt = appointment?.region === 'india' ? 'razorpay' : 'paypal';
          setPreferredMethod(methodFromAppt);
          setPaymentData(null);
          paymentDataRef.current = null; // Reset ref
          setPaymentSuccess(false);
          setPaymentInitiatedTime(null); // Reset initiation time

          // If an existing payment is provided (e.g., from PayMonthlyRent), use it instead of creating a new intent
          if (existingPayment) {
            // Check if it's already completed
            if (existingPayment.status === 'completed' || existingPayment.status === 'paid') {
              toast.success('Payment already completed!');
              onPaymentSuccess(existingPayment);
              setLockAcquired(false);
              setLoading(false);
              onClose();
              return;
            }

            if (existingPayment.paymentType === 'monthly_rent' && existingPayment.metadata) {
              setMonthlyRentContext(existingPayment.metadata);
            }

            // Sync preferred method with valid existing payment gateway
            if (existingPayment.gateway === 'razorpay' || existingPayment.gateway === 'paypal') {
              setPreferredMethod(existingPayment.gateway);
            }

            const paymentWrapper = {
              payment: existingPayment,
              // If it's a Razorpay payment, construct the razorpay object needed for frontend
              ...(existingPayment.gateway === 'razorpay' && {
                razorpay: {
                  orderId: existingPayment.gatewayOrderId,
                  amount: existingPayment.amount * 100,
                  currency: existingPayment.currency || 'INR',
                  keyId: existingPayment.razorpay?.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID
                }
              }),
              appointment: appointment
            };

            setPaymentData(paymentWrapper);
            paymentDataRef.current = paymentWrapper;

            const initiatedAt = existingPayment.createdAt ? new Date(existingPayment.createdAt) : new Date();
            setPaymentInitiatedTime(initiatedAt);
            setLoading(false);
          } else {
            // Don't reset timeRemaining here - it will be calculated from payment data when received
            setTimeout(() => createPaymentIntent(methodFromAppt), 0);
          }
        } catch (error) {
          console.error('Error acquiring lock:', error);
          toast.error('Failed to acquire payment lock. Please try again.');
          setLoading(false);
          setLockAcquired(false);
          onClose();
        }
      };

      acquireLockAsync();

      // Listen for lock release from other tabs
      const removeLockListener = lockManagerRef.current.onLockReleased(() => {
        // Lock was released, but we're already open, so ignore
      });

      // Handle page unload to release lock
      const handleBeforeUnload = () => {
        if (lockManagerRef.current) {
          lockManagerRef.current.releaseLock();
        }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        removeLockListener();
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    } else {
      // Release lock when modal closes
      if (lockManagerRef.current) {
        lockManagerRef.current.releaseLock();
        lockManagerRef.current.cleanup();
        lockManagerRef.current = null;
      }
      // Reset lock acquired state when modal closes
      setLockAcquired(false);
    }

    // Lock body scroll when modal is open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      // Cleanup on unmount
      if (expiryTimer) {
        clearInterval(expiryTimer);
      }
      if (lockManagerRef.current) {
        lockManagerRef.current.releaseLock();
        lockManagerRef.current.cleanup();
        lockManagerRef.current = null;
      }
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen, appointment, onClose, existingPayment]);

  // Handle payment expiry
  const handleExpiry = useCallback(async () => {
    toast.info('Payment session expired. Please initiate a new payment.');
    // Cancel payment if exists - use ref to get latest paymentData
    const currentPaymentData = paymentDataRef.current;
    if (currentPaymentData && currentPaymentData.payment && (currentPaymentData.payment.status === 'pending' || currentPaymentData.payment.status === 'processing')) {
      try {
        await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentId: currentPaymentData.payment.paymentId
          })
        });
      } catch (error) {
        console.error('Error cancelling payment:', error);
      }
    }
    setPaymentData(null);
    paymentDataRef.current = null;
    setPaymentSuccess(false);
    setPaymentInitiatedTime(null); // Reset initiation time
    setTimeRemaining(10 * 60);
    setExpiryTimer((prevTimer) => {
      if (prevTimer) {
        clearInterval(prevTimer);
      }
      return null;
    });
    onClose();
  }, [onClose]);

  // Helper function to calculate remaining time from appointment lock expiry
  // Since each payment attempt creates a new payment ID, the appointment lock is reset to 10 minutes
  // for each new payment initialization. The 10 minutes is the payment window time, NOT payment ID expiry.
  const calculateRemainingTime = useCallback((paymentData) => {
    let expiresAtTime = null;

    // Priority 1: Use appointment.lockExpiryTime (appointment payment window - resets to 10 min for each new payment)
    if (paymentData?.appointment?.lockExpiryTime) {
      expiresAtTime = new Date(paymentData.appointment.lockExpiryTime).getTime();
    }
    // Priority 2: Fallback to payment.expiresAt (for backward compatibility)
    else if (paymentData?.payment?.expiresAt) {
      expiresAtTime = new Date(paymentData.payment.expiresAt).getTime();
    }
    // Priority 3: Fallback to payment.createdAt + 10 minutes
    else if (paymentData?.payment?.createdAt) {
      expiresAtTime = new Date(paymentData.payment.createdAt).getTime() + 10 * 60 * 1000;
    }

    if (!expiresAtTime) {
      return 10 * 60; // Default 10 minutes
    }

    const now = Date.now();
    const remaining = Math.max(0, Math.floor((expiresAtTime - now) / 1000));
    return remaining;
  }, []);

  // Timer effect: Start countdown when payment intent is created
  useEffect(() => {
    if (paymentData && paymentData.payment && !paymentSuccess) {
      // Clear any existing timer
      if (expiryTimer) {
        clearInterval(expiryTimer);
      }

      // Calculate expiry timestamp from appointment lock
      // Since each payment attempt creates a new payment ID, the appointment lock is reset to 10 minutes
      // for each new payment initialization. The 10 minutes is the payment window time, NOT payment ID expiry.
      let expiresAtTime = null;

      // Priority 1: Use appointment.lockExpiryTime (appointment payment window - resets to 10 min for each new payment)
      if (paymentData.appointment?.lockExpiryTime) {
        expiresAtTime = new Date(paymentData.appointment.lockExpiryTime).getTime();
      }
      // Priority 2: Fallback to payment.expiresAt (for backward compatibility)
      else if (paymentData.payment?.expiresAt) {
        expiresAtTime = new Date(paymentData.payment.expiresAt).getTime();
      }
      // Priority 3: Fallback to payment.createdAt + 10 minutes
      else if (paymentData.payment?.createdAt) {
        expiresAtTime = new Date(paymentData.payment.createdAt).getTime() + 10 * 60 * 1000;
      }

      if (!expiresAtTime) {
        // Fallback: set default expiry
        expiresAtTime = Date.now() + 10 * 60 * 1000;
      }

      expiresAtRef.current = expiresAtTime;

      // Calculate initial remaining time
      const remainingSeconds = calculateRemainingTime(paymentData);

      // Set the calculated remaining time
      setTimeRemaining(remainingSeconds);

      // If already expired, handle expiry immediately
      if (remainingSeconds <= 0) {
        handleExpiry();
        return;
      }

      // Reset low time warning flag when timer restarts
      lowTimeWarningShownRef.current = false;

      // Show warning immediately if less than 1 minute remaining when timer starts
      if (remainingSeconds <= 60 && remainingSeconds > 0) {
        lowTimeWarningShownRef.current = true;
        toast.warning('Please complete the payment immediately, or wait for this session to expire and initiate a new transaction.');
      }

      // Timer function that recalculates remaining time from expiry timestamp
      // This ensures accuracy even when tab is inactive (browsers throttle setInterval)
      let timer = null;
      const updateTimer = () => {
        if (!expiresAtRef.current) {
          return;
        }

        const now = Date.now();
        const remaining = Math.max(0, Math.floor((expiresAtRef.current - now) / 1000));

        setTimeRemaining(remaining);

        // Show warning toast when less than 1 minute remaining (only once)
        if (remaining <= 60 && remaining > 0 && !lowTimeWarningShownRef.current) {
          lowTimeWarningShownRef.current = true;
          toast.warning('Please complete the payment immediately, or wait for this session to expire and initiate a new transaction.');
        }

        // If expired, handle expiry
        if (remaining <= 0) {
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
          handleExpiry();
        }
      };

      // Start countdown timer - recalculate from expiry timestamp each second
      // This ensures accuracy even when browser throttles timers in inactive tabs
      timer = setInterval(updateTimer, 1000);
      setExpiryTimer(timer);

      // Handle tab visibility changes to re-sync timer when tab becomes visible
      const handleVisibilityChange = () => {
        if (!document.hidden && expiresAtRef.current) {
          // Tab became visible, recalculate remaining time immediately
          const remaining = calculateRemainingTime(paymentData);
          setTimeRemaining(remaining);

          // If expired while tab was hidden, handle expiry
          if (remaining <= 0) {
            if (timer) {
              clearInterval(timer);
              timer = null;
            }
            handleExpiry();
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        clearInterval(timer);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    } else {
      // Clear timer if payment completed or modal closed
      if (expiryTimer) {
        clearInterval(expiryTimer);
        setExpiryTimer(null);
      }
      expiresAtRef.current = null;
    }
  }, [paymentData, paymentSuccess, handleExpiry, calculateRemainingTime]);

  const createPaymentIntent = async (methodOverride) => {
    try {
      setLoading(true);

      // For rental payments, skip appointment status check (contract is the source of truth)
      if (!appointment.isRentalPayment) {
        // Check appointment status before creating payment intent (only for non-rental payments)
        if (appointment.status === 'rejected') {
          toast.error('This appointment has been rejected by the seller. Payment cannot be processed. Please book a new appointment or explore other alternatives.');
          onClose();
          return;
        }

        // Allow payment for pending or accepted appointments (not yet paid)
        if (appointment.status !== 'pending' && appointment.status !== 'accepted') {
          toast.error('This appointment is not in a payable status. Payment cannot be processed at this time.');
          onClose();
          return;
        }
      }

      let response;
      const targetGateway = (methodOverride || preferredMethod) === 'razorpay' ? 'razorpay' : 'paypal';

      // Special handling for Monthly Rent: Use /monthly-rent endpoint to recreate payment
      if (monthlyRentContext) {
        response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/monthly-rent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contractId: monthlyRentContext.contractId,
            walletId: monthlyRentContext.walletId,
            month: monthlyRentContext.month,
            year: monthlyRentContext.year,
            amount: monthlyRentContext.originalAmount, // Always use original INR amount
            gateway: targetGateway,
            isAutoDebit: false,
            coinsToRedeem: monthlyRentContext.coinsToRedeem
          })
        });
      } else if (isEMIPayment && emiDetails) {
        // Special handling for Loan EMI
        response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/loan-emi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            loanId: emiDetails.loanId,
            emiIndex: emiDetails.emiIndex,
            amount: emiDetails.amount,
            gateway: targetGateway
          })
        });
      } else if (isServicePayment && servicePaymentDetails) {
        // Special handling for Service Requests
        response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/service-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: servicePaymentDetails.requestId,
            type: servicePaymentDetails.type,
            gateway: targetGateway
          })
        });
      } else {
        // Standard flow for Advance/Security Deposit
        response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/create-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appointmentId: appointment._id,
            paymentType: appointment.paymentType || (appointment.isRentalPayment ? 'security_deposit' : 'advance'),
            gateway: targetGateway,
            ...(appointment.contractId && { contractId: appointment.contractId }),
            ...(appointment.coinsToRedeem > 0 && { coinsToRedeem: appointment.coinsToRedeem })
          })
        });
      }

      const data = await response.json();
      if (response.ok) {
        setPaymentData(data);
        paymentDataRef.current = data; // Update ref
        // Store the payment initiation time (use payment createdAt or current time)
        const initiatedAt = data.payment?.createdAt ? new Date(data.payment.createdAt) : new Date();
        setPaymentInitiatedTime(initiatedAt);

        // Calculate remaining time based on appointment.lockExpiryTime (appointment slot lock)
        // Timer is tied to appointment slot, NOT payment order ID
        const remaining = calculateRemainingTime(data);
        setTimeRemaining(remaining);

        // Note: Timer will be started by the useEffect that watches paymentData
      } else {
        // Handle specific error cases
        if (response.status === 400 && data.message && data.message.includes('already completed')) {
          toast.success('Payment already completed!');
          // Call onPaymentSuccess with the existing payment
          if (data.payment) {
            onPaymentSuccess(data.payment);
          }
          // Payment already completed, no need to cancel
          setPaymentData(null);
          paymentDataRef.current = null;
          setPaymentSuccess(false);
          setPaymentInitiatedTime(null); // Reset initiation time
          if (expiryTimer) {
            clearInterval(expiryTimer);
            setExpiryTimer(null);
          }
          onClose();
        } else if (response.status === 409 && data.message && data.message.includes('already in progress')) {
          toast.warning('A payment is already in progress for this appointment. Please complete or cancel the existing payment first.');
          // Payment intent not created, no need to cancel
          setPaymentData(null);
          paymentDataRef.current = null;
          setPaymentSuccess(false);
          setPaymentInitiatedTime(null); // Reset initiation time
          if (expiryTimer) {
            clearInterval(expiryTimer);
            setExpiryTimer(null);
          }
          onClose();
        } else {
          toast.error(data.message || 'Failed to create payment intent');
        }
      }
    } catch (error) {
      console.error('Error creating payment intent:', error);
      toast.error('An error occurred while creating payment');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentData) return;

    try {
      setLoading(true);
      if (preferredMethod === 'razorpay') {
        // Load Razorpay Checkout
        const loadRazorpay = () => new Promise((resolve, reject) => {
          if (window && window.Razorpay) return resolve();
          const existing = document.querySelector('script[src*="checkout.razorpay.com/v1/checkout.js"]');
          if (existing) {
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay SDK')));
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
          document.body.appendChild(script);
        });
        await loadRazorpay();
        const rzpInfo = paymentData.razorpay;
        if (!rzpInfo) {
          toast.error('Razorpay not initialized');
          return;
        }
        const options = {
          key: rzpInfo.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount: rzpInfo.amount,
          currency: rzpInfo.currency || 'INR',
          name: 'UrbanSetu',
          description: 'Advance Booking Payment',
          order_id: rzpInfo.orderId,
          prefill: {
            name: appointment?.buyerId?.username || '',
            email: appointment?.buyerId?.email || ''
          },
          handler: async (response) => {
            try {
              setProcessingPayment(true);
              await verifyRazorpay(response);
            } catch (e) {
              toast.error('Verification failed');
            } finally {
              setProcessingPayment(false);
            }
          },
          modal: { ondismiss: () => toast.info('Payment cancelled. You can try again later.') }
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
        return;
      }

      // Dynamically load PayPal SDK if not present
      const loadPayPalSDK = () => new Promise((resolve, reject) => {
        if (window && window.paypal) return resolve();
        const existing = document.querySelector('script[src*="paypal.com/sdk/js"]');
        if (existing) {
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', (e) => reject(new Error('Failed to load PayPal SDK')));
          return;
        }
        const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
        if (!clientId) return reject(new Error('Missing VITE_PAYPAL_CLIENT_ID'));
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load PayPal SDK'));
        document.body.appendChild(script);
      });

      await loadPayPalSDK();

      // Render PayPal Buttons
      if (window && window.paypal) {
        const amount = paymentData?.paypal?.amount || paymentData?.payment?.amount;
        const containerId = `paypal-button-container-${appointment._id}`;
        const existing = document.getElementById(containerId);
        if (existing) {
          existing.innerHTML = '';
        }
        window.paypal.Buttons({
          createOrder: async (_data, actions) => {
            try {
              const orderRes = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/paypal/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: Number(amount).toFixed(2), currency: 'USD' })
              });
              const text = await orderRes.text();
              let order;
              try { order = JSON.parse(text); } catch (e) {
                throw new Error(text || 'Invalid JSON from create-order');
              }
              if (!orderRes.ok) throw new Error(order.message || 'Failed to create PayPal order');
              return order.id;
            } catch (e) {
              toast.error('Failed to initialize PayPal');
              throw e;
            }
          },
          onApprove: async (data, actions) => {
            try {
              setProcessingPayment(true);
              // Capture via actions may fail if permissions; fallback to server capture
              try {
                await actions.order.capture();
              } catch (e) {
                await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/paypal/capture-order`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId: data.orderID })
                });
              }
              await verifyPayment({ paypal_order_id: data.orderID });
            } catch (e) {
              toast.error('Payment capture failed');
            } finally {
              setProcessingPayment(false);
            }
          },
          onCancel: () => {
            toast.info('Payment cancelled. You can try again later.');
          },
          onError: (err) => {
            console.error('PayPal error', err);
            toast.error('Payment failed or cancelled.');
            // Mark payment as failed
            if (paymentData?.payment?.paymentId) {
              handlePaymentFailure('PayPal payment failed');
            }
          }
        }).render(`#${containerId}`);
      } else {
        toast.error('PayPal SDK not loaded.');
      }

    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed. Please try again.');
    }
    finally {
      setLoading(false);
    }
  };

  const handlePaymentFailure = async (reason) => {
    try {
      const verifyResponse = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId: paymentData.payment.paymentId,
          paymentStatus: 'failed',
          clientIp: (window && window.__CLIENT_IP__) || undefined,
          userAgent: navigator.userAgent
        })
      });

      const verifyData = await verifyResponse.json();
      if (verifyResponse.ok || verifyResponse.status === 400) {
        // Payment marked as failed
        toast.error(`Payment failed: ${reason}`);
        setLoading(false);
        setProcessingPayment(false);
      }
    } catch (error) {
      console.error('Error marking payment as failed:', error);
      toast.error('Payment failed');
      setLoading(false);
      setProcessingPayment(false);
    }
  };

  const verifyPayment = async (response) => {
    try {
      const verifyResponse = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId: paymentData.payment.paymentId,
          paypalOrderId: response.paypal_order_id || response.paypalOrderId || response.orderID,
          clientIp: (window && window.__CLIENT_IP__) || undefined,
          userAgent: navigator.userAgent
        })
      });

      const verifyData = await verifyResponse.json();
      if (verifyResponse.ok) {
        setPaymentSuccess(true);
        setReceiptUrl(verifyData.receiptUrl);
        toast.success('Payment successful!');
        onPaymentSuccess(verifyData.payment);
      } else {
        toast.error(verifyData.message || 'Payment verification failed');
        if (verifyData.message && verifyData.message.toLowerCase().includes('signature')) {
          toast.info('Dev mode: signature bypass is enabled. Please try again.');
        }
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Payment verification failed');
    } finally {
      setLoading(false);
    }
  };

  const verifyRazorpay = async (response) => {
    try {
      const verifyResponse = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/razorpay/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: paymentData.payment.paymentId,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
          clientIp: (window && window.__CLIENT_IP__) || undefined,
          userAgent: navigator.userAgent
        })
      });
      const verifyData = await verifyResponse.json();
      if (verifyResponse.ok) {
        setPaymentSuccess(true);
        setReceiptUrl(verifyData.receiptUrl);
        toast.success('Payment successful!');
        onPaymentSuccess(verifyData.payment);
      } else {
        toast.error(verifyData.message || 'Payment verification failed');
        // If verification failed, mark payment as failed
        if (verifyResponse.status === 400) {
          await handlePaymentFailure('Razorpay verification failed');
        }
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Payment verification failed');
      await handlePaymentFailure('Razorpay verification error');
    } finally {
      setLoading(false);
    }
  };

  const downloadReceipt = () => {
    if (receiptUrl) {
      window.open(receiptUrl.replace(/^https?:\/\/[^\/]+/, import.meta.env.VITE_API_BASE_URL), '_blank');
    }
  };

  if (!isOpen) return null;

  // Don't render modal content until lock is acquired (prevents flash of modal before lock check)
  if (!lockAcquired && !paymentSuccess) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-900/40 to-purple-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="rounded-xl shadow-2xl max-w-md w-full bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-gray-900 p-8">
          <div className="flex flex-col items-center justify-center">
            <FaSpinner className="animate-spin text-4xl text-blue-600 dark:text-blue-400 mb-4" />
            <p className="text-gray-700 dark:text-gray-300 font-medium">Checking payment session availability...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-900/40 to-purple-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ overscrollBehavior: 'contain' }}>
      <div className="rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-gray-900">
        {!paymentSuccess ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-blue-100 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-purple-700 dark:from-blue-400 dark:to-purple-400 flex items-center gap-2">
                  <FaCreditCard className="text-blue-600 dark:text-blue-400" />
                  Payment Required
                </h2>
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <FaTimes className="text-xl" />
                </button>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                Complete your advance payment to confirm the booking
              </p>
              {paymentData && paymentData.payment && !paymentSuccess && (
                <div className="mt-4 p-3 rounded-lg border-2 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-300 dark:border-yellow-700 shadow-md">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-gray-700 dark:text-gray-300 font-medium text-base">⏱️ Time remaining:</span>
                    <span className={`text-2xl font-bold px-4 py-2 rounded-lg ${timeRemaining < 60
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-2 border-red-400 dark:border-red-600 animate-pulse'
                      : timeRemaining < 300
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-2 border-orange-400 dark:border-orange-600'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-2 border-green-400 dark:border-green-600'
                      }`}>
                      {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  {timeRemaining < 300 && (
                    <p className="text-center mt-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                      Please complete your payment soon
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Payment Details */}
            <div className="p-6">
              {processingPayment ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FaSpinner className="animate-spin text-4xl text-blue-600 dark:text-blue-400 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Processing Payment...</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-center">
                    Please wait while we verify your payment. Do not close this window.
                  </p>
                </div>
              ) : loading && !paymentData ? (
                <div className="flex items-center justify-center py-8">
                  <FaSpinner className="animate-spin text-2xl text-blue-600 dark:text-blue-400" />
                  <span className="ml-2 text-gray-600 dark:text-gray-300">Preparing payment...</span>
                </div>
              ) : paymentData ? (
                <>
                  {/* Method Selection - Only show if no existing payment (allow changing region for new intents only) */}
                  {/* Method Selection - Show for all new intents, OR if we have monthly rent context to recreate */}
                  {(!existingPayment || monthlyRentContext) && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
                      <h5 className="font-semibold text-gray-800 dark:text-white mb-2">Select Region</h5>
                      <div className="flex items-center gap-4 text-sm">
                        <label className="inline-flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
                          <input type="radio" name="region" value="india" checked={preferredMethod === 'razorpay'} onChange={() => { const m = 'razorpay'; setPreferredMethod(m); setLoading(true); setPaymentData(null); paymentDataRef.current = null; setPaymentInitiatedTime(null); setTimeout(() => createPaymentIntent(m), 0); }} />
                          <span>India (Razorpay - INR)</span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
                          <input type="radio" name="region" value="international" checked={preferredMethod === 'paypal'} onChange={() => { const m = 'paypal'; setPreferredMethod(m); setLoading(true); setPaymentData(null); paymentDataRef.current = null; setPaymentInitiatedTime(null); setTimeout(() => createPaymentIntent(m), 0); }} />
                          <span>International (PayPal - USD)</span>
                        </label>
                      </div>
                    </div>
                  )}
                  {/* Property Info */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 mb-6 border border-blue-100 dark:border-blue-800">
                    <h3 className="font-semibold text-gray-800 dark:text-white mb-2">{appointment.propertyName}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{appointment.propertyDescription}</p>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Payment Type:
                      </span>
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {isEMIPayment ? 'Loan EMI Payment' : (appointment.paymentType === 'monthly_rent' ? 'Monthly Rent' : 'Appointment Booking')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {appointment.paymentType === 'monthly_rent' ? 'Rent Period:' : 'Appointment Date:'}
                      </span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {isEMIPayment && emiDetails
                          ? `${new Date(0, emiDetails.month - 1).toLocaleString('default', { month: 'long' })} ${emiDetails.year}`
                          : (appointment.paymentType === 'monthly_rent' && monthlyRentContext
                            ? `${new Date(0, monthlyRentContext.month - 1).toLocaleString('default', { month: 'long' })} ${monthlyRentContext.year}`
                            : new Date(appointment.date).toLocaleDateString('en-GB'))
                        }
                      </span>
                    </div>
                    {appointment.paymentType !== 'monthly_rent' && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Time:</span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{appointment.time}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Payment Initiated:</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {paymentInitiatedTime
                          ? paymentInitiatedTime.toLocaleString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })
                          : paymentData.payment?.createdAt
                            ? new Date(paymentData.payment.createdAt).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })
                            : new Date().toLocaleString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })
                        }
                      </span>
                    </div>
                  </div>

                  {/* Payment Summary */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 mb-6 border border-blue-100 dark:border-blue-800">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-3">Payment Summary</h4>
                    <div className="space-y-2">
                      {/* Original Amount (if discount applied) */}
                      {paymentData?.payment?.metadata?.coinDiscount > 0 && (
                        <div className="flex justify-between text-gray-500 dark:text-gray-400 text-sm">
                          <span>Subtotal</span>
                          <span>₹ {Number(paymentData.payment.metadata.originalAmount).toFixed(2)}</span>
                        </div>
                      )}

                      {/* Discount Row */}
                      {paymentData?.payment?.metadata?.coinDiscount > 0 && (
                        <div className="flex justify-between text-green-600 dark:text-green-400 text-sm font-medium">
                          <span className="flex items-center gap-1"><FaCoins className="text-xs" /> SetuCoins Discount</span>
                          <span>- ₹ {Number(paymentData.payment.metadata.coinDiscount).toFixed(2)}</span>
                        </div>
                      )}

                      {/* EMI Breakdown */}
                      {isEMIPayment && emiDetails ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-300">Base EMI Amount</span>
                            <span className="font-medium text-gray-800 dark:text-white">
                              {preferredMethod === 'razorpay' ? `₹ ${Number(emiDetails.amount).toFixed(2)}` : `$ ${Number(emiDetails.amount / 83).toFixed(2)}`}
                            </span>
                          </div>
                          {emiDetails.penaltyAmount > 0 && (
                            <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
                              <span>Penalty Amount</span>
                              <span>
                                {preferredMethod === 'razorpay' ? `+ ₹ ${Number(emiDetails.penaltyAmount).toFixed(2)}` : `+ $ ${Number(emiDetails.penaltyAmount / 83).toFixed(2)}`}
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">
                            {appointment.paymentType === 'monthly_rent' ? 'Monthly Rent Payment' : 'Advance Payment (Flat)'}
                          </span>
                          <span className="font-medium text-gray-800 dark:text-white">
                            {preferredMethod === 'razorpay' ? `₹ ${Number((paymentData?.payment?.amount || (paymentData?.payment?.currency === 'INR' ? 100 : 0))).toFixed(2)}` : `$ ${Number((paymentData?.payment?.amount || (paymentData?.payment?.currency === 'USD' ? 5 : 0))).toFixed(2)}`}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                        <span>Note</span>
                        <span>
                          {isEMIPayment
                            ? (preferredMethod === 'razorpay' ? 'Loan EMI payment via Razorpay' : 'Loan EMI payment via PayPal')
                            : appointment.paymentType === 'monthly_rent'
                              ? (preferredMethod === 'razorpay' ? 'Rent payment via Razorpay' : 'Rent payment via PayPal')
                              : (preferredMethod === 'razorpay' ? '₹100 advance to confirm booking' : '$5 advance to confirm booking')}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-blue-200 dark:border-blue-800 mt-3 pt-3">
                      <div className="flex justify-between font-semibold text-blue-800 dark:text-blue-300">
                        <span>Total Amount</span>
                        <span>{preferredMethod === 'razorpay' ? `₹ ${Number((paymentData?.payment?.amount || (paymentData?.payment?.currency === 'INR' ? 100 : 0))).toFixed(2)}` : `$ ${Number((paymentData?.payment?.amount || (paymentData?.payment?.currency === 'USD' ? 5 : 0))).toFixed(2)}`}</span>
                      </div>
                    </div>

                    {/* Completion Reward Preview */}
                    {preferredMethod === 'razorpay' && paymentData?.payment?.amount >= 1000 && (
                      <div className="mt-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-2 flex items-center justify-between border border-yellow-200 dark:border-yellow-700">
                        <span className="text-xs font-semibold text-yellow-800 dark:text-yellow-300 flex items-center gap-1">
                          <FaCoins className="text-yellow-600 dark:text-yellow-400" /> You will earn:
                        </span>
                        <span className="text-sm font-bold text-yellow-700 dark:text-yellow-400">
                          {Math.floor(paymentData?.payment?.amount / 1000)} SetuCoins
                        </span>
                      </div>
                    )}
                    {preferredMethod === 'paypal' && paymentData?.payment?.amount >= 12 && (
                      <div className="mt-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-2 flex items-center justify-between border border-yellow-200 dark:border-yellow-700">
                        <span className="text-xs font-semibold text-yellow-800 dark:text-yellow-300 flex items-center gap-1">
                          <FaCoins className="text-yellow-600 dark:text-yellow-400" /> You will earn:
                        </span>
                        <span className="text-sm font-bold text-yellow-700 dark:text-yellow-400">
                          {Math.floor(paymentData?.payment?.amount / 12)} SetuCoins
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 mb-6 border border-blue-100 dark:border-blue-800">
                    <h5 className="font-semibold text-gray-800 dark:text-white mb-2">Payment Platform</h5>
                    <div className="text-sm text-gray-700 dark:text-gray-300">{preferredMethod === 'razorpay' ? 'Razorpay' : 'PayPal'}</div>
                    <ul className="list-disc pl-5 mt-3 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {appointment.paymentType === 'monthly_rent' ? (
                        <>
                          {preferredMethod === 'razorpay' ? (
                            <>
                              <li>Click "Pay via Razorpay" and complete your rent payment securely.</li>
                              <li>Once approved, your rent receipt will be generated automatically.</li>
                            </>
                          ) : (
                            <>
                              <li>Click "Load PayPal Button" and complete your rent payment securely.</li>
                              <li>Once approved, your rent receipt will be generated automatically.</li>
                            </>
                          )}
                          <li>If you cancel, you can retry from the "Pay Monthly Rent" page or Wallet.</li>
                        </>
                      ) : (
                        <>
                          {preferredMethod === 'razorpay' ? (
                            <>
                              <li>Click "Pay via Razorpay" and complete payment in the Razorpay popup.</li>
                              <li>On approval, we verify and confirm your booking automatically.</li>
                            </>
                          ) : (
                            <>
                              <li>Click "Load PayPal Button" and complete payment in the PayPal popup.</li>
                              <li>On approval, we verify and confirm your booking automatically.</li>
                            </>
                          )}
                          <li>If you cancel or close PayPal, you can retry from My Appointments.</li>
                        </>
                      )}
                    </ul>
                  </div>

                  {/* Technical Details */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 mb-6 border border-blue-100 dark:border-blue-800">
                    <h5 className="font-semibold text-gray-800 dark:text-white mb-2">Payment Technical Details</h5>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      {preferredMethod === 'razorpay' && paymentData?.razorpay && (
                        <>
                          <div>Order ID: <span className="font-mono text-gray-800 dark:text-gray-300">{paymentData.razorpay.orderId}</span></div>
                          <div>Amount (paise): <span className="font-mono text-gray-800 dark:text-gray-300">{paymentData.razorpay.amount}</span></div>
                        </>
                      )}
                      {preferredMethod === 'paypal' && (
                        <div>Amount: <span className="font-mono text-gray-800 dark:text-gray-300">{paymentData?.paypal?.amount || paymentData?.payment?.amount}</span> USD</div>
                      )}
                    </div>
                  </div>

                  {/* Security Notice */}
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <FaShieldAlt className="text-green-600 dark:text-green-400 mt-1" />
                      <div>
                        <h5 className="font-semibold text-green-800 dark:text-green-300 mb-1">Secure Payment via {preferredMethod === 'razorpay' ? 'Razorpay' : 'PayPal'}</h5>
                        <p className="text-sm text-green-700 dark:text-green-400">Your payment is processed securely. You can request a full refund if the appointment is cancelled.</p>
                      </div>
                    </div>
                  </div>

                  {/* Payment Button */}
                  <div className="space-y-2">
                    {preferredMethod === 'paypal' && <div id={`paypal-button-container-${appointment._id}`} />}
                    <button
                      onClick={handlePayment}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 shadow"
                    >
                      {loading ? 'Loading…' : (preferredMethod === 'razorpay' ? 'Pay via Razorpay' : 'Load PayPal Button')}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-300">Failed to initialize payment. Please try again.</p>
                  <button
                    onClick={createPaymentIntent}
                    className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Success Screen */}
            <div className="p-6 text-center">
              <div className="mb-6">
                <FaCheckCircle className="text-6xl text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Payment Successful!</h2>
                <p className="text-gray-600 dark:text-gray-300">
                  Your {appointment.paymentType === 'monthly_rent' ? 'rent payment' : 'advance payment'} has been processed successfully.
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-800 dark:text-white mb-2">Payment Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Amount Paid:</span>
                    <span className="font-medium text-gray-800 dark:text-white">$ {Number(paymentData.payment.amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Payment ID:</span>
                    <span className="font-mono text-xs text-gray-800 dark:text-white">{paymentData.payment.paymentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Receipt No:</span>
                    <span className="font-mono text-xs text-gray-800 dark:text-white">{paymentData.payment.receiptNumber}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={downloadReceipt}
                  className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <FaDownload />
                  Download Receipt
                </button>

                <button
                  onClick={() => {
                    onClose();
                    // Navigate to MyAppointments
                    window.location.href = '/user/my-appointments';
                  }}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  View My Appointments
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
