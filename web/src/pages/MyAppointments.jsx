import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FaArchive, FaBan, FaCalendar, FaCalendarAlt, FaCheck, FaCheckDouble, FaCheckSquare, FaCircle, FaCheckCircle, FaClock, FaCog, FaCommentDots, FaCopy, FaCreditCard, FaDownload, FaEllipsisV, FaEnvelope, FaExclamationTriangle, FaFileContract, FaFileAlt, FaFlag, FaHandshake, FaHistory, FaInfoCircle, FaLightbulb, FaMicrophone, FaMoneyBillWave, FaPaperPlane, FaPen, FaPhone, FaPhotoVideo, FaRegStar, FaSearch, FaStar, FaSync, FaThumbtack, FaTimes, FaTrash, FaUndo, FaUserShield, FaVideo, FaWallet, FaPlay, FaLink, FaFile, FaImage, FaVolumeUp, FaExternalLinkAlt } from 'react-icons/fa';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import { EmojiButton } from '../components/EmojiPicker';
import CustomEmojiPicker from '../components/EmojiPicker';
import { useSoundEffects, SoundControl } from '../components/SoundEffects';
import { useSelector } from "react-redux";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { createPortal } from 'react-dom';
import Appointment from "../components/Appointment";
import { toast, ToastContainer } from 'react-toastify';
import { socket } from "../utils/socket";
import { exportEnhancedChatToPDF } from '../utils/pdfExport';
import ExportChatModal from '../components/ExportChatModal';
import { authenticatedFetch } from '../utils/csrf';
import PaymentModal from '../components/PaymentModal';
import { useCallContext } from '../contexts/CallContext';
import CallHistoryModal from '../components/CallHistoryModal';
import ChatSettingsModal from '../components/ChatSettingsModal';
import { useChatSettings } from '../hooks/useChatSettings';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import ImagePreview from '../components/ImagePreview';
import VideoMessageBubble from '../components/VideoMessageBubble.jsx';
import LinkPreview from '../components/LinkPreview';
import UserAvatar from '../components/UserAvatar';
import { FormattedTextWithLinks, FormattedTextWithLinksAndSearch, FormattedTextWithReadMore } from '../utils/linkFormatter.jsx';
import { focusWithoutKeyboard, focusWithKeyboard } from '../utils/mobileUtils';
import { getThemeColors, getDarkModeContainerClass, getDarkModeInputClass, getDarkModeTextClass, getDarkModeSecondaryTextClass, getDarkModeBorderClass, getDarkModeHoverClass } from '../utils/chatTheme';
import GeminiAIWrapper from "../components/GeminiAIWrapper";
import ContactSupportWrapper from '../components/ContactSupportWrapper';
import ConnectedSaleModals from '../components/ConnectedSaleModals';
import ConnectedDisputeModal from '../components/ConnectedDisputeModal';
import { saleModalStore } from '../utils/saleModalStore';

import { usePageTitle } from '../hooks/usePageTitle';

import MyAppointmentsSkeleton from '../components/skeletons/MyAppointmentsSkeleton';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const APPOINTMENT_TIME_SLOTS = Array.from({ length: 21 }, (_, i) => {
  const totalMinutes = 9 * 60 + i * 30;
  const hour = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const value = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const period = hour >= 12 ? 'PM' : 'AM';
  const label = `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
  return { value, label };
});

const formatTimeDisplay = (timeValue = '') => {
  if (!timeValue.includes(':')) return timeValue;
  const [hourStr, minuteStr] = timeValue.split(':');
  const hour = parseInt(hourStr, 10);
  if (Number.isNaN(hour)) return timeValue;
  const displayHour = ((hour + 11) % 12) + 1;
  const period = hour >= 12 ? 'PM' : 'AM';
  return `${displayHour}:${minuteStr.padStart(2, '0')} ${period}`;
};



export default function MyAppointments() {
  // Set page title
  usePageTitle("My Appointments - Bookings");

  const { currentUser } = useSelector((state) => state.user);



  // Function to handle phone number clicks
  const handlePhoneClick = (phoneNumber) => {
    // Check if it's a mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      // For mobile devices, open phone dialer
      window.location.href = `tel:${phoneNumber}`;
    } else {
      // For desktop, copy to clipboard
      navigator.clipboard.writeText(phoneNumber).then(() => {
        toast.success(`Phone number ${phoneNumber} copied to clipboard!`);
      }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = phoneNumber;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast.success(`Phone number ${phoneNumber} copied to clipboard!`);
      });
    }
  };
  const [appointments, setAppointments] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [archivedCurrentPage, setArchivedCurrentPage] = useState(1);
  const [archivedTotalPages, setArchivedTotalPages] = useState(1);
  const [filteredArchivedAppointments, setFilteredArchivedAppointments] = useState([]);
  const [actionLoading, setActionLoading] = useState("");
  const [showOtherPartyModal, setShowOtherPartyModal] = useState(false);
  const [selectedOtherParty, setSelectedOtherParty] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showReinitiateModal, setShowReinitiateModal] = useState(false);
  const [reinitiateData, setReinitiateData] = useState(null);
  const [reinitiatePaymentStatus, setReinitiatePaymentStatus] = useState(null);
  const [archivedAppointments, setArchivedAppointments] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const navigate = useNavigate();
  const [swipedMsgId, setSwipedMsgId] = useState(null);

  // Archive modal states
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
  const [appointmentToHandle, setAppointmentToHandle] = useState(null);

  // New state for notification-triggered chat opening
  const [notificationChatData, setNotificationChatData] = useState(null);
  const [shouldOpenChatFromNotification, setShouldOpenChatFromNotification] = useState(false);
  const [activeChatAppointmentId, setActiveChatAppointmentId] = useState(null);
  // Preference to open specific chat at unread divider (set by notification click)
  const [preferUnreadForAppointmentId, setPreferUnreadForAppointmentId] = useState(null);

  // Missing chatbox error state
  const [missingChatbookError, setMissingChatbookError] = useState(null);

  // Export chat modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportAppointment, setExportAppointment] = useState(null);
  const [exportComments, setExportComments] = useState([]);
  const [exportCallHistory, setExportCallHistory] = useState([]);

  // Call History modal state
  const [showCallHistoryModal, setShowCallHistoryModal] = useState(false);
  const [callHistoryAppointmentId, setCallHistoryAppointmentId] = useState(null);

  // Sale Confirmation Modals State
  // Sale Confirmation Modals State - Renamed to fix RefError
  // Sale Confirmation Modals State - Consolidating to fix RefError
  // Sale Confirmation Modals State - Object Refactor to fix ReferenceError
  // Sale Confirmation Modals State - External Store to fix RefError
  // No local state needed for modals anymore!
  // Dispute state managed by store/ConnectedDisputeModal

  // Call functionality - using global context
  const {
    callState,
    incomingCall,
    localStream,
    remoteStream,
    isMuted: isCallMuted,
    isVideoEnabled,
    callDuration,
    activeCall,
    localVideoRef,
    remoteVideoRef,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute: toggleCallMute,
    toggleVideo
  } = useCallContext();

  // Chat settings
  const { settings, updateSetting } = useChatSettings('myappointments_chat_settings');
  const [showChatSettings, setShowChatSettings] = useState(false);

  // Compute theme colors and dark mode from settings
  const themeColors = useMemo(() => getThemeColors(settings.themeColor || 'blue'), [settings.themeColor]);
  const isDarkMode = settings.theme === 'dark';

  // Handle initiate call
  const handleInitiateCall = async (appointment, callType, receiverId) => {
    if (!appointment || !appointment._id) {
      toast.error('Appointment not found');
      return;
    }

    try {
      await initiateCall(appointment._id, receiverId, callType);
    } catch (error) {
      console.error('Error initiating call:', error);
      // Error is already handled in useCall hook
    }
  };

  // Get other party name for active call
  const getOtherPartyName = (appointment) => {
    if (!appointment || !currentUser) return 'Calling...';
    if (appointment.buyerId._id === currentUser._id) {
      return appointment.sellerId?.username || 'Calling...';
    }
    return appointment.buyerId?.username || 'Calling...';
  };

  // Lock body scroll when archive modals are open
  useEffect(() => {
    const shouldLock = showArchiveModal || showUnarchiveModal;
    if (shouldLock) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showArchiveModal, showUnarchiveModal]);

  // Close audio menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('[data-audio-menu]') &&
        !event.target.closest('[data-audio-speed-menu]') &&
        !event.target.closest('[data-audio-controls-menu]') &&
        !event.target.closest('button[title="Audio options"]')) {
        document.querySelectorAll('[data-audio-menu]').forEach(menu => {
          menu.classList.add('hidden');
        });
        document.querySelectorAll('[data-audio-speed-menu]').forEach(menu => {
          menu.classList.add('hidden');
        });
        document.querySelectorAll('[data-audio-controls-menu]').forEach(menu => {
          menu.classList.add('hidden');
        });
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!currentUser) {
        setError("Please sign in to view your appointments");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);

        // First, fetch all appointments without pagination
        const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/my`);
        if (!res.ok) throw new Error('Failed to fetch appointments');
        const data = await res.json();

        console.log('All appointments fetched:', data);
        const allAppts = data.appointments || data;
        setAllAppointments(allAppts);

        // Just store all appointments, filtering and pagination will be handled in separate useEffect
      } catch (err) {
        setError("Failed to load appointments. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    const fetchArchivedAppointments = async () => {
      // Fetch archived appointments for all users
      if (currentUser) {
        try {
          const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/archived`);
          if (!res.ok) throw new Error('Failed to fetch archived appointments');
          const data = await res.json();
          setArchivedAppointments(Array.isArray(data) ? data : []);
        } catch (err) {
          setArchivedAppointments([]);
          console.error("Failed to fetch archived appointments:", err);
        }
      } else {
        setArchivedAppointments([]);
      }
    };
    fetchAppointments();
    fetchArchivedAppointments();
  }, [currentUser?._id]);

  // Separate useEffect for pagination and filtering
  useEffect(() => {
    // Reset page to 1 whenever filters change
    setCurrentPage(1);
  }, [search, statusFilter, roleFilter, startDate, endDate]);

  useEffect(() => {
    // Apply filters
    let filteredAppts = (allAppointments || []).filter((appt) => {
      // Create a safely typed version of appt for checking
      if (!appt) return false;

      if (currentUser._id === appt.buyerId?._id?.toString() && appt.visibleToBuyer === false) return false;
      if (currentUser._id === appt.sellerId?._id?.toString() && appt.visibleToSeller === false) return false;

      const apptDate = appt.date ? new Date(appt.date) : new Date();
      const isOutdated = apptDate < new Date() || (apptDate.toDateString() === new Date().toDateString() && appt.time && appt.time < new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      if (statusFilter === 'outdated') {
        return isOutdated;
      }

      const matchesStatus = statusFilter === "all" ? true : appt.status === statusFilter;
      const matchesRole = roleFilter === "all" ? true : appt.role === roleFilter;
      const matchesSearch =
        (appt.propertyName?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (appt.buyerId?.email?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (appt.sellerId?.email?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (appt.buyerId?.username?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (appt.sellerId?.username?.toLowerCase() || '').includes(search.toLowerCase());

      const matchesDateRange =
        (!startDate || apptDate >= new Date(startDate)) &&
        (!endDate || apptDate <= new Date(endDate));

      return matchesStatus && matchesRole && matchesSearch && matchesDateRange;
    });

    // Calculate pagination
    // Calculate pagination
    const itemsPerPage = 10;

    // Auto-switch page if deep-linking to an appointment
    if (shouldOpenChatFromNotification && notificationChatData) {
      const index = filteredAppts.findIndex(a => a._id === notificationChatData._id);
      if (index !== -1) {
        const targetPage = Math.ceil((index + 1) / itemsPerPage);
        if (targetPage !== currentPage) {
          setCurrentPage(targetPage);
        }
      }
    }

    const totalPages = Math.max(1, Math.ceil(filteredAppts.length / itemsPerPage));
    setTotalPages(totalPages);

    // Get current page items
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentPageAppts = filteredAppts.slice(startIndex, endIndex);

    // IMPORTANT: If we are trying to open a specific chat from notification/link,
    // ensure it is visible in the list even if filters/pagination would hide it.
    if (shouldOpenChatFromNotification && notificationChatData) {
      const isPresent = currentPageAppts.some(a => a._id === notificationChatData._id);
      if (!isPresent) {
        // Prepend to the list so it's visible at the top
        currentPageAppts.unshift(notificationChatData);
      }
    }

    console.log(`Page ${currentPage} of ${totalPages}, showing ${currentPageAppts.length} appointments`);
    setAppointments(currentPageAppts);
  }, [allAppointments, currentPage, search, statusFilter, roleFilter, startDate, endDate, currentUser, shouldOpenChatFromNotification, notificationChatData]);

  // Separate useEffect for archived appointments pagination and filtering
  useEffect(() => {
    if (archivedAppointments.length === 0) return;

    // Apply filters to archived appointments
    let filteredArchivedAppts = archivedAppointments.filter((appt) => {
      const isOutdated = new Date(appt.date) < new Date() || (new Date(appt.date).toDateString() === new Date().toDateString() && appt.time && appt.time < new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      const matchesStatus =
        statusFilter === "all" ? true :
          statusFilter === "outdated" ? isOutdated :
            appt.status === statusFilter;
      const matchesRole = roleFilter === "all" ? true : appt.role === roleFilter;
      const matchesSearch =
        appt.propertyName?.toLowerCase().includes(search.toLowerCase()) ||
        appt.message?.toLowerCase().includes(search.toLowerCase()) ||
        appt.buyerId?.username?.toLowerCase().includes(search.toLowerCase()) ||
        appt.sellerId?.username?.toLowerCase().includes(search.toLowerCase());
      const matchesDateRange =
        (!startDate || new Date(appt.date) >= new Date(startDate)) &&
        (!endDate || new Date(appt.date) <= new Date(endDate));

      return matchesStatus && matchesRole && matchesSearch && matchesDateRange;
    });

    // Calculate pagination for archived appointments
    const itemsPerPage = 10;
    const totalPages = Math.ceil(filteredArchivedAppts.length / itemsPerPage);
    setArchivedTotalPages(totalPages);

    // Get current page items for archived appointments
    const startIndex = (archivedCurrentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentPageArchivedAppts = filteredArchivedAppts.slice(startIndex, endIndex);

    console.log(`Archived Page ${archivedCurrentPage} of ${totalPages}, showing ${currentPageArchivedAppts.length} archived appointments`);
    setFilteredArchivedAppointments(currentPageArchivedAppts);
  }, [archivedAppointments, archivedCurrentPage, search, statusFilter, roleFilter, startDate, endDate]);

  useEffect(() => {
    // Listen for permanent delete events
    const removeHandler = (e) => {
      setAllAppointments((prev) => prev.filter((appt) => appt._id !== e.detail));
    };
    window.addEventListener('removeAppointmentRow', removeHandler);
    return () => {
      window.removeEventListener('removeAppointmentRow', removeHandler);
    };
  }, [currentUser]);

  // Listen for notification clicks when already on MyAppointments page
  useEffect(() => {
    const handleNotificationClick = (e) => {
      const { appointmentId } = e.detail || {};
      if (appointmentId) {
        navigate(`/user/my-appointments/chat/${appointmentId}?chatopen=true`, { replace: false });
      }
    };

    window.addEventListener('openChatFromNotification', handleNotificationClick);
    return () => {
      window.removeEventListener('openChatFromNotification', handleNotificationClick);
    };
  }, [navigate]);

  // Listen for highlightAppointment events (from MyPayments page)
  useEffect(() => {
    const handleHighlightAppointment = (e) => {
      const { appointmentId } = e.detail || {};
      if (appointmentId) {
        // Find and highlight the appointment row
        setTimeout(() => {
          const appointmentRow = document.querySelector(`[data-appointment-id="${appointmentId}"]`);
          if (appointmentRow) {
            appointmentRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            appointmentRow.classList.add('highlight-appointment');
            setTimeout(() => {
              appointmentRow.classList.remove('highlight-appointment');
            }, 3000);
          }
        }, 300);
      }
    };

    window.addEventListener('highlightAppointment', handleHighlightAppointment);
    return () => {
      window.removeEventListener('highlightAppointment', handleHighlightAppointment);
    };
  }, []);


  // Lock background scroll when profile modal is open
  useEffect(() => {
    if (showOtherPartyModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showOtherPartyModal]);

  // Prevent body scrolling when reinitiate modal is open
  useEffect(() => {
    if (showReinitiateModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showReinitiateModal]);

  // Dynamically update user info in appointments when currentUser changes
  useEffect(() => {
    if (!currentUser) return;
    setAllAppointments(prevAppointments => prevAppointments.map(appt => {
      const updated = { ...appt };

      // Update buyer info if current user is the buyer
      if (appt.buyerId && (appt.buyerId._id === currentUser._id || appt.buyerId === currentUser._id)) {
        updated.buyerId = {
          ...updated.buyerId,
          username: currentUser.username,
          email: currentUser.email,
          mobileNumber: currentUser.mobileNumber,
          avatar: currentUser.avatar
        };
      }

      // Update seller info if current user is the seller
      if (appt.sellerId && (appt.sellerId._id === currentUser._id || appt.sellerId === currentUser._id)) {
        updated.sellerId = {
          ...updated.sellerId,
          username: currentUser.username,
          email: currentUser.email,
          mobileNumber: currentUser.mobileNumber,
          avatar: currentUser.avatar
        };
      }

      return updated;
    }));
  }, [currentUser]);

  useEffect(() => {
    function handleAppointmentUpdate(data) {
      setAllAppointments((prev) =>
        prev.map(appt =>
          appt._id === data.appointmentId ? { ...appt, ...data.updatedAppointment } : appt
        )
      );
    }

    function handlePaymentStatusUpdate(data) {
      setAllAppointments((prev) =>
        prev.map(appt =>
          appt._id === data.appointmentId ? { ...appt, paymentConfirmed: data.paymentConfirmed } : appt
        )
      );
    }

    // Handle custom DOM events (fallback from MyPayments page)
    function handleCustomPaymentStatusUpdate(event) {
      const { appointmentId, paymentConfirmed } = event.detail;
      if (appointmentId) {
        setAllAppointments((prev) =>
          prev.map(appt =>
            appt._id === appointmentId ? { ...appt, paymentConfirmed: Boolean(paymentConfirmed) } : appt
          )
        );
      }
    }

    socket.on('appointmentUpdate', handleAppointmentUpdate);
    socket.on('paymentStatusUpdated', handlePaymentStatusUpdate);
    window.addEventListener('paymentStatusUpdated', handleCustomPaymentStatusUpdate);

    return () => {
      socket.off('appointmentUpdate', handleAppointmentUpdate);
      socket.off('paymentStatusUpdated', handlePaymentStatusUpdate);
      window.removeEventListener('paymentStatusUpdated', handleCustomPaymentStatusUpdate);
    };
  }, []);

  useEffect(() => {
    function handleAppointmentCreated(data) {
      const appt = data.appointment;
      // Set role for the current user
      if (appt.buyerId && currentUser && (appt.buyerId._id === currentUser._id || appt.buyerId === currentUser._id)) {
        appt.role = 'buyer';
      } else if (appt.sellerId && currentUser && (appt.sellerId._id === currentUser._id || appt.sellerId === currentUser._id)) {
        appt.role = 'seller';
      }
      setAllAppointments((prev) => [appt, ...prev]);
    }
    socket.on('appointmentCreated', handleAppointmentCreated);

    // Listen for profile updates to update user info in appointments
    const handleProfileUpdate = (profileData) => {
      setAllAppointments(prevAppointments => prevAppointments.map(appt => {
        const updated = { ...appt };

        // Update buyer info if the updated user is the buyer
        if (appt.buyerId && (appt.buyerId._id === profileData.userId || appt.buyerId === profileData.userId)) {
          updated.buyerId = {
            ...updated.buyerId,
            username: profileData.username,
            email: profileData.email,
            mobileNumber: profileData.mobileNumber,
            avatar: profileData.avatar
          };
        }

        // Update seller info if the updated user is the seller
        if (appt.sellerId && (appt.sellerId._id === profileData.userId || appt.sellerId === profileData.userId)) {
          updated.sellerId = {
            ...updated.sellerId,
            username: profileData.username,
            email: profileData.email,
            mobileNumber: profileData.mobileNumber,
            avatar: profileData.avatar
          };
        }

        return updated;
      }));
    };
    socket.on('profileUpdated', handleProfileUpdate);

    return () => {
      socket.off('appointmentCreated', handleAppointmentCreated);
      socket.off('profileUpdated', handleProfileUpdate);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    // Emit immediately when page loads so delivery status registers promptly
    socket.emit('userAppointmentsActive', { userId: currentUser._id });
    // Then emit periodically (every 30 seconds) to catch any missed updates
    const interval = setInterval(() => {
      socket.emit('userAppointmentsActive', { userId: currentUser._id });
    }, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Handle notification-triggered chat opening
  useEffect(() => {
    if (shouldOpenChatFromNotification && notificationChatData) {
      // The chat will be opened by the AppointmentRow component
      // which handles both locked and unlocked chats
    }
  }, [shouldOpenChatFromNotification, notificationChatData]);



  // Handle navigation state when coming from notification or direct chat link
  const location = useLocation();
  const params = useParams();
  const chatRouteResolvedRef = useRef(null);

  useEffect(() => {
    const chatIdFromUrl = params.chatId;

    if (!chatIdFromUrl) {
      chatRouteResolvedRef.current = null;
      // Don't clear missingChatbookError here — the modal needs to stay visible
      // until the user manually dismisses it via the "Close" button
      return;
    }

    setMissingChatbookError(null);

    if (chatRouteResolvedRef.current === chatIdFromUrl) {
      return;
    }

    let cancelled = false;

    const openChatForAppointment = (appointment) => {
      if (!appointment || cancelled) return;
      chatRouteResolvedRef.current = appointment._id;
      setNotificationChatData(appointment);
      setShouldOpenChatFromNotification(true);
      setActiveChatAppointmentId(appointment._id);
      setMissingChatbookError(null);
    };

    const resolveChatRoute = async () => {
      const findLocalAppointment = () =>
        appointments.find((appt) => appt._id === chatIdFromUrl) ||
        allAppointments.find((appt) => appt._id === chatIdFromUrl) ||
        archivedAppointments.find((appt) => appt._id === chatIdFromUrl);

      let appointment = findLocalAppointment();

      // Validate ownership for locally found appointments too
      if (appointment && currentUser?._id) {
        const userId = currentUser._id.toString();
        const buyerId = appointment.buyerId?._id?.toString() || appointment.buyerId?.toString();
        const sellerId = appointment.sellerId?._id?.toString() || appointment.sellerId?.toString();
        if (userId !== buyerId && userId !== sellerId) {
          if (!cancelled) {
            setMissingChatbookError(chatIdFromUrl);
          }
          return;
        }
      }

      if (appointment) {
        openChatForAppointment(appointment);
        return;
      }

      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${chatIdFromUrl}`);

        if (!response.ok) {
          if (response.status === 403) {
            if (!cancelled) {
              setMissingChatbookError(chatIdFromUrl);
            }
            return;
          }
          if (response.status === 404) {
            if (!cancelled) setMissingChatbookError(chatIdFromUrl);
            return;
          }
          throw new Error('Failed to fetch appointment details');
        }

        const data = await response.json();
        appointment = data.booking || data;

        if (!appointment?._id) {
          throw new Error('Invalid appointment payload');
        }

        // Frontend ownership validation (defense-in-depth)
        if (currentUser?._id) {
          const userId = currentUser._id.toString();
          const buyerId = appointment.buyerId?._id?.toString() || appointment.buyerId?.toString();
          const sellerId = appointment.sellerId?._id?.toString() || appointment.sellerId?.toString();

          if (userId !== buyerId && userId !== sellerId) {
            if (!cancelled) {
              setMissingChatbookError(chatIdFromUrl);
            }
            return;
          }

          if (userId === buyerId) {
            appointment.role = 'buyer';
          } else if (userId === sellerId) {
            appointment.role = 'seller';
          }
        }

        setAllAppointments((prev) => {
          const existingIndex = prev.findIndex((appt) => appt._id === appointment._id);
          if (existingIndex !== -1) {
            const next = [...prev];
            next[existingIndex] = { ...next[existingIndex], ...appointment };
            return next;
          }
          return [appointment, ...prev];
        });

        openChatForAppointment(appointment);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to resolve chat via link:', error);
          setMissingChatbookError(chatIdFromUrl);
        }
      }
    };

    resolveChatRoute();

    return () => {
      cancelled = true;
    };
  }, [params.chatId, appointments, allAppointments, archivedAppointments, currentUser?._id]);

  useEffect(() => {
    if (location.state?.fromNotification && location.state?.openChatForAppointment) {
      const appointmentId = location.state.openChatForAppointment;
      navigate(`/user/my-appointments/chat/${appointmentId}?chatopen=true`, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  // Handle highlightAppointmentId from location.state (must be after location declaration)
  useEffect(() => {
    if (appointments.length === 0) return;

    const highlightAppointmentId = location.state?.highlightAppointmentId;

    if (highlightAppointmentId) {
      setTimeout(() => {
        const appointmentRow = document.querySelector(`[data-appointment-id="${highlightAppointmentId}"]`);
        if (appointmentRow) {
          appointmentRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
          appointmentRow.classList.add('highlight-appointment');
          setTimeout(() => {
            appointmentRow.classList.remove('highlight-appointment');
          }, 3000);
        }
      }, 500);
      // Clear the state after highlighting
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.highlightAppointmentId, appointments.length, navigate, location.pathname]);

  const handleStatusUpdate = async (id, status) => {
    setActionLoading(id + status);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      setAllAppointments((prev) =>
        prev.map((appt) => (appt._id === id ? { ...appt, status } : appt))
      );
      const statusText = status === "accepted" ? "accepted" : "rejected";
      toast.success(`Appointment ${statusText} successfully! ${status === "accepted" ? "Contact information is now visible to both parties." : ""}`, {
        autoClose: 3000,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false
      });
      navigate("/user/my-appointments");
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error("Session expired or unauthorized. Please sign in again.");
        navigate("/sign-in");
        return;
      }
      toast.error(err.response?.data?.message || "Failed to update appointment status.");
    }
    setActionLoading("");
  };

  // Wrapper to open modal
  const handleTokenPaid = useCallback((id) => {
    // Note: We don't set local state apptIdForAction here to avoid ReferenceErrors.
    // The Store handles the ID.
    saleModalStore.openTokenModal(id);
  }, []);

  // Note: 'id' is passed from the Connected component via the Store
  const confirmTokenPaid = async (id) => {
    if (!id) return;

    setActionLoading(id + 'token_paid');
    saleModalStore.close();

    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${id}/sale/token-paid`, {
        method: 'PATCH',
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      setAllAppointments((prev) =>
        prev.map((appt) => (appt._id === id ? { ...appt, saleStatus: 'token_paid' } : appt))
      );
      toast.success("Property locked! Token payment marked as received. Emails have been sent.", {
        autoClose: 5000,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false
      });
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error("Session expired or unauthorized. Please sign in again.");
        navigate("/sign-in");
        return;
      }
      toast.error(err.response?.data?.message || "Failed to mark token as paid.");
    }
    setActionLoading("");
    setActionLoading("");
    // setApptIdForAction(null); // Managed by store 
  };

  // Wrapper to open modal
  const handleSaleComplete = useCallback((id) => {
    // Note: Store handles ID
    saleModalStore.openSaleModal(id);
  }, []);

  // Note: 'id' is passed from the Connected component via the Store
  const confirmSaleComplete = async (id) => {
    if (!id) return;

    setActionLoading(id + 'sold');
    saleModalStore.close();

    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${id}/sale/complete`, {
        method: 'PATCH',
        body: JSON.stringify({})
      });

      if (!res.ok) {
        if (res.status === 401) {
          toast.error("Session expired or unauthorized. Please sign in again.");
          navigate("/sign-in");
          return;
        }
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();

      setAllAppointments((prev) =>
        prev.map((appt) => (appt._id === id ? { ...appt, saleStatus: 'sold', status: 'completed' } : appt))
      );
      toast.success("Congratulations! Property marked as sold. Emails have been sent to both parties.", {
        autoClose: 5000,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false
      });
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error("Session expired or unauthorized. Please sign in again.");
        navigate("/sign-in");
        return;
      }
      toast.error(err.response?.data?.message || "Failed to complete sale.");
    }
    setActionLoading("");
    // setApptIdForAction(null);
  };

  // Register callbacks for the external store to bypass scope issues
  useEffect(() => {
    saleModalStore.registerCallbacks({
      onToken: confirmTokenPaid,
      onSale: confirmSaleComplete,
      onDispute: confirmDispute
    });
  }); // Omitted deps to ensure always fresh closures, store handles updates efficiently

  // Dispute Handling via Store
  const handleDispute = (id) => {
    saleModalStore.openDisputeModal(id);
  };

  const confirmDispute = async (id, reason) => {
    if (!id || !reason.trim()) return;

    // Loading handling is done in ConnectedDisputeModal
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${id}/sale/dispute`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      toast.success("Dispute reported securely to the administration. We will contact you shortly.");
      saleModalStore.close();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit dispute.");
      throw err; // Re-throw so child knows it failed
    }
  };

  const handleAdminDelete = async (id) => {
    setAppointmentToHandle(id);
    setDeleteReason('');
    setShowDeleteAppointmentModal(true);
  };

  const confirmAdminDelete = async () => {
    if (!deleteReason.trim()) {
      toast.error('Please provide a reason for deleting this appointment.');
      return;
    }

    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appointmentToHandle}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason: deleteReason })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      setAllAppointments((prev) =>
        prev.map((appt) => (appt._id === appointmentToHandle ? { ...appt, status: "deletedByAdmin", adminComment: deleteReason } : appt))
      );
      toast.success("Appointment deleted successfully. Both buyer and seller have been notified.", {
        autoClose: 5000,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false
      });
      navigate("/user/my-appointments");
      setShowDeleteAppointmentModal(false);
      setAppointmentToHandle(null);
      setDeleteReason('');
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error("Session expired or unauthorized. Please sign in again.");
        navigate("/sign-in");
        return;
      }
      toast.error(err.response?.data?.message || "Failed to delete appointment.");
    }
  };

  const handleArchiveAppointment = async (id) => {
    setAppointmentToHandle(id);
    setShowArchiveModal(true);
  };

  const confirmArchive = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appointmentToHandle}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      const archivedAppt = allAppointments.find(appt => appt._id === appointmentToHandle) || appointments.find(appt => appt._id === appointmentToHandle);
      if (archivedAppt) {
        setAllAppointments((prev) => prev.filter((appt) => appt._id !== appointmentToHandle));
        setArchivedAppointments((prev) => [{ ...archivedAppt, archivedAt: new Date() }, ...prev]);
      }
      toast.success("Appointment archived successfully.", {
        autoClose: 3000,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false
      });
      setShowArchiveModal(false);
      setAppointmentToHandle(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to archive appointment.");
    }
  };

  const handleUnarchiveAppointment = async (id) => {
    setAppointmentToHandle(id);
    setShowUnarchiveModal(true);
  };

  const confirmUnarchive = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appointmentToHandle}/unarchive`, {
        method: 'PATCH',
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();

      const unarchivedAppt = archivedAppointments.find(appt => appt._id === appointmentToHandle);
      if (unarchivedAppt) {
        setArchivedAppointments((prev) => prev.filter((appt) => appt._id !== appointmentToHandle));
        setAllAppointments((prev) => [{ ...unarchivedAppt, archivedAt: undefined }, ...prev]);
      }
      toast.success("Appointment unarchived successfully.", {
        autoClose: 3000,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false
      });
      setShowUnarchiveModal(false);
      setAppointmentToHandle(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to unarchive appointment.");
    }
  };

  // Filtering and pagination is now handled in useEffect
  // Use appointments directly since they are already filtered and paginated

  // Filtering and pagination for archived appointments is now handled in useEffect

  async function handleOpenReinitiate(appt) {
    // Fetch payment status to check if refunded
    let paymentStatus = null;
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/payments/history?appointmentId=${appt._id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.payments && data.payments.length > 0) {
          paymentStatus = data.payments[0];
        }
      }
    } catch (error) {
      console.error('Error fetching payment status:', error);
    }

    setReinitiatePaymentStatus(paymentStatus);
    setReinitiateData({
      ...appt,
      date: appt.date ? new Date(appt.date).toISOString().split('T')[0] : '',
      time: appt.time || '',
      message: appt.message || '',
      buyerReinitiationCount: appt.buyerReinitiationCount || 0,
      sellerReinitiationCount: appt.sellerReinitiationCount || 0,
    });
    setShowReinitiateModal(true);
  }

  async function handleReinitiateSubmit(e) {
    e.preventDefault();
    if (!reinitiateData) return;
    const isBuyer = currentUser && (reinitiateData.buyerId?._id === currentUser._id || reinitiateData.buyerId === currentUser._id);
    const isSeller = currentUser && (reinitiateData.sellerId?._id === currentUser._id || reinitiateData.sellerId === currentUser._id);

    // Check if payment is refunded for cancelled appointment
    if ((reinitiateData.status === 'cancelledByBuyer' || reinitiateData.status === 'cancelledBySeller') && reinitiatePaymentStatus) {
      if (reinitiatePaymentStatus.status === 'refunded' || reinitiatePaymentStatus.status === 'partially_refunded') {
        toast.error('Reinitiation not possible now. Payment has been refunded for this cancelled appointment.');
        return;
      }
    }

    // Check 3-day (72-hour) window for cancelled appointments
    if (reinitiateData.status === 'cancelledByBuyer' || reinitiateData.status === 'cancelledBySeller') {
      const cancellationDate = reinitiateData.updatedAt ? new Date(reinitiateData.updatedAt) : new Date();
      const now = new Date();
      const hoursSinceCancellation = (now - cancellationDate) / (1000 * 60 * 60);

      if (hoursSinceCancellation > 72) {
        toast.error('Reinitiation not possible now. The 72-hour reinitiation window has expired.');
        return;
      }
    }

    const count = isBuyer ? (reinitiateData.buyerReinitiationCount || 0) : (reinitiateData.sellerReinitiationCount || 0);
    if (count >= 2) {
      toast.error('You have reached the maximum number of reinitiations for your role.');
      return;
    }
    if (!reinitiateData.buyerId || !reinitiateData.sellerId) {
      toast.error('Cannot reinitiate: one of the parties no longer exists.');
      return;
    }
    const payload = {
      ...reinitiateData,
      status: 'pending',
    };
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/reinitiate`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      toast.success('Appointment reinitiated successfully!', {
        autoClose: 5000,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false
      });
      setShowReinitiateModal(false);
      setReinitiateData(null);
      setReinitiatePaymentStatus(null);
      navigate("/user/my-appointments");
      setAllAppointments((prev) => prev.map(appt => appt._id === data.appointment._id ? { ...appt, ...data.appointment } : appt));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reinitiate appointment.');
    }
  }
  //next
  const handleCancelRefresh = (cancelledId, cancelledStatus) => {
    setAllAppointments((prev) => prev.map(appt => appt._id === cancelledId ? { ...appt, status: cancelledStatus } : appt));
  };

  // Add this function to fetch latest data on demand
  const handleManualRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/my`);
      if (!res.ok) throw new Error('Failed to fetch appointments');
      const data = await res.json();
      const allAppts = data.appointments || data;
      setAllAppointments(allAppts);

      // Fetch archived appointments for all users
      if (currentUser) {
        const resArchived = await authenticatedFetch(`${API_BASE_URL}/api/bookings/archived`);
        if (resArchived.ok) {
          const archivedData = await resArchived.json();
          setArchivedAppointments(Array.isArray(archivedData) ? archivedData : []);
        }
      } else {
        setArchivedAppointments([]);
      }
    } catch (err) {
      setError('Failed to refresh appointments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Function to copy message to clipboard
  const copyMessageToClipboard = (messageText) => {
    if (!messageText) {
      toast.error('No message to copy');
      return;
    }

    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(messageText)
        .then(() => {
          toast.success('Copied', {
            autoClose: 2000,
            position: 'bottom-center'
          });
        })
        .catch(() => {
          // Fallback to older method
          copyWithFallback(messageText);
        });
    } else {
      // Use fallback method for older browsers
      copyWithFallback(messageText);
    }
  };

  // Fallback copy method
  const copyWithFallback = (text) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (success) {
        toast.success('Copied', {
          autoClose: 2000,
          position: 'bottom-center'
        });
      } else {
        console.error('Fallback copy failed');
        toast.error('Failed to copy message');
      }
    } catch (err) {
      console.error('Fallback copy error:', err);
      toast.error('Copy not supported');
    }
  };

  if (loading) return <MyAppointmentsSkeleton />;

  if (error) {
    const handleRetry = async () => {
      if (!currentUser) return;
      try {
        setError(null);
        setLoading(true);
        const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/my`);
        if (!res.ok) throw new Error('Failed to fetch appointments');
        const data = await res.json();
        const allAppts = data.appointments || data;
        setAllAppointments(allAppts);
        setError(null);
      } catch (err) {
        setError("Failed to load appointments. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className={`min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 dark:from-gray-900 dark:to-slate-900 py-10 px-2 md:px-8 ${isDarkMode ? 'dark' : ''}`}>
        <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-purple-100 dark:border-slate-700 transform transition-all duration-300">
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="relative mb-4 group scale-110">
              <div className={`absolute inset-0 blur-3xl opacity-40 bg-gradient-to-r ${themeColors.primary} animate-pulse`}></div>
              <div className={`relative z-10 w-24 h-24 rounded-3xl bg-gradient-to-br ${themeColors.primary} flex items-center justify-center shadow-2xl overflow-hidden`}>
                {/* Subtle internal patterns for "premium" look */}
                <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(circle_at_top_left,_white,_transparent)]"></div>
                <FaCalendarAlt className="text-5xl text-white relative z-20 drop-shadow-xl" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-white dark:bg-slate-800 p-2 rounded-2xl z-30 shadow-2xl border-2 border-purple-100 dark:border-slate-700 transform -rotate-12 transition-transform duration-300 group-hover:rotate-0">
                <FaExclamationTriangle className="text-2xl text-red-500" />
              </div>
            </div>

            <div className={`p-4 rounded-xl ${isDarkMode ? themeColors.messageBgDark : themeColors.messageBg} border ${isDarkMode ? 'border-red-900/20' : 'border-red-100'} w-full text-center shadow-sm`}>
              <div className="text-red-600 dark:text-red-400 text-lg font-semibold flex items-center justify-center gap-2">
                {error}
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={handleRetry}
                className={`px-10 py-3 bg-gradient-to-r ${themeColors.primary} ${themeColors.primaryHover} text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-3`}
              >
                {loading ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaSync />}
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 dark:from-gray-900 dark:to-slate-900 py-10 px-2 md:px-8 ${isDarkMode ? 'dark' : ''}`}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* Chat Settings Modal */}
      <ChatSettingsModal
        isOpen={showChatSettings}
        onClose={() => setShowChatSettings(false)}
        settings={settings}
        updateSetting={updateSetting}
      />

      {currentUser && (
        <div className="max-w-7xl mx-auto mb-4 flex justify-end">
          <Link to="/user/my-payments" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2 7a2 2 0 012-2h16a2 2 0 012 2v3H2V7z" /><path d="M2 12h20v5a2 2 0 01-2 2H4a2 2 0 01-2-2v-5zm4 3a1 1 0 100 2h6a1 1 0 100-2H6z" /></svg>
            Go to Payments
          </Link>
          <Link to="/user/rental-contracts" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow ml-2">
            <FaFileContract className="h-4 w-4" />
            Go to Contracts
          </Link>
        </div>
      )}

      {/* Camera Modal - Temporarily disabled */}
      <div className="max-w-7xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
          <div>
            <h3 className="text-2xl md:text-3xl font-extrabold text-blue-700 dark:text-blue-400 drop-shadow">
              {showArchived ? `Archived Appointments (${filteredArchivedAppointments.length})` : `My Appointments (${appointments.length})`}
            </h3>
            {!showArchived && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                💡 Monitor all appointments across the platform. Use the status filter to view appointments and interactive chatbox to connect with otherparty.
              </p>
            )}
          </div>
          <div className="flex flex-row gap-2 md:gap-4">
            <button
              onClick={handleManualRefresh}
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-2.5 py-1.5 rounded-md hover:from-blue-600 hover:to-purple-600 transition-all font-semibold shadow-md text-xs sm:text-base sm:px-3 sm:py-1.5 sm:rounded-md flex-1 sm:flex-none sm:w-auto"
              title="Refresh appointments"
            >
              Refresh
            </button>

            {/* Archived appointments toggle for all users */}
            <button
              onClick={() => {
                setShowArchived(!showArchived);
                setCurrentPage(1); // Reset to first page when switching
                setArchivedCurrentPage(1); // Reset archived page to first page when switching
              }}
              className={`bg-gradient-to-r text-white px-2.5 py-1.5 rounded-md transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-1 sm:gap-2 text-xs sm:text-base flex-1 sm:flex-none sm:w-auto sm:px-4 sm:py-2 sm:rounded-md justify-center ${showArchived
                ? 'from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
                : 'from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700'
                }`}
            >
              {showArchived ? (
                <>
                  <FaUndo /> <span>Active Appointments</span>
                </>
              ) : (
                <>
                  <FaArchive /> <span>Archived Appointments ({archivedAppointments.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-sm dark:text-gray-300">Status:</label>
              <select
                className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Appointments</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="cancelledByBuyer">Cancelled by Buyer</option>
                <option value="cancelledBySeller">Cancelled by Seller</option>
                <option value="cancelledByAdmin">Cancelled by Admin</option>
                <option value="deletedByAdmin">Deleted by Admin</option>
                <option value="completed">Completed</option>
                <option value="noShow">No Show</option>
                <option value="outdated">Outdated</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="font-semibold text-sm dark:text-gray-300">Role:</label>
              <select
                className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="buyer">As Buyer</option>
                <option value="seller">As Seller</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-sm dark:text-gray-300">From:</label>
              <input
                type="date"
                className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
              <label className="font-semibold text-sm dark:text-gray-300">To:</label>
              <input
                type="date"
                className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <FaSearch className="text-gray-500 hover:text-blue-500 transition-colors duration-200" />
              <input
                type="text"
                className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200 text-sm flex-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-900"
                placeholder="Search by property, message, or user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Description text for archived appointments */}
        {showArchived && (
          <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
            📋 View and manage archived appointments. You can unarchive them to move them back to active appointments.
          </p>
        )}

        {/* Show archived appointments table for all users */}
        {showArchived ? (
          filteredArchivedAppointments.length === 0 ? (
            <div className="text-center text-gray-500 text-lg">No archived appointments found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-800 dark:text-gray-200">
                    <th className="border p-2">Date & Time</th>
                    <th className="border p-2">Property</th>
                    <th className="border p-2">Role</th>
                    <th className="border p-2">Other Party</th>
                    <th className="border p-2">Purpose</th>
                    <th className="border p-2">Message</th>
                    <th className="border p-2">Status</th>
                    <th className="border p-2">Payment</th>
                    <th className="border p-2 dark:border-gray-600">Actions</th>
                    <th className="border p-2">Connect</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArchivedAppointments.map((appt, index) => (
                    <AppointmentRow
                      style={{ animation: `fadeIn 0.2s ease-out ${index * 0.03}s backwards` }}
                      key={appt._id}
                      appt={appt}
                      currentUser={currentUser}
                      handleStatusUpdate={handleStatusUpdate}
                      handleTokenPaid={handleTokenPaid}
                      handleSaleComplete={handleSaleComplete}
                      handleDispute={handleDispute}
                      handleAdminDelete={handleAdminDelete}
                      actionLoading={actionLoading}
                      onShowOtherParty={(party, appointment) => { setSelectedOtherParty(party); setSelectedAppointment(appointment); setShowOtherPartyModal(true); }}
                      onOpenReinitiate={() => handleOpenReinitiate(appt)}
                      handleArchiveAppointment={handleArchiveAppointment}
                      handleUnarchiveAppointment={handleUnarchiveAppointment}
                      isArchived={true}
                      onCancelRefresh={handleCancelRefresh}
                      copyMessageToClipboard={copyMessageToClipboard}
                      onExportChat={(appointment, comments, callHistory) => {
                        setExportAppointment(appointment);
                        setExportComments(comments);
                        setExportCallHistory(callHistory || []);
                        setShowExportModal(true);
                      }}
                      onInitiateCall={handleInitiateCall}
                      callState={callState}
                      incomingCall={incomingCall}
                      activeCall={activeCall}
                      localVideoRef={localVideoRef}
                      remoteVideoRef={remoteVideoRef}
                      isCallMuted={isCallMuted}
                      isVideoEnabled={isVideoEnabled}
                      callDuration={callDuration}
                      onAcceptCall={acceptCall}
                      onRejectCall={rejectCall}
                      onEndCall={endCall}
                      onToggleCallMute={toggleCallMute}
                      onToggleVideo={toggleVideo}
                      getOtherPartyName={getOtherPartyName}
                      // Call History Modal props
                      setShowCallHistoryModal={setShowCallHistoryModal}
                      setCallHistoryAppointmentId={setCallHistoryAppointmentId}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          appointments.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 text-lg mb-6">No appointments found.</div>
              <Link
                to="/search"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                <FaCalendarAlt className="mr-2" />
                Book Appointment
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40 text-gray-800 dark:text-gray-200">
                    <th className="border p-2">Date & Time</th>
                    <th className="border p-2">Property</th>
                    <th className="border p-2">Role</th>
                    <th className="border p-2">Other Party</th>
                    <th className="border p-2">Purpose</th>
                    <th className="border p-2">Message</th>
                    <th className="border p-2">Status</th>
                    <th className="border p-2">Payment</th>
                    <th className="border p-2">Actions</th>
                    <th className="border p-2">Connect</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appt, index) => (
                    <AppointmentRow
                      style={{ animation: `fadeIn 0.2s ease-out ${index * 0.03}s backwards` }}
                      key={appt._id}
                      appt={appt}
                      currentUser={currentUser}
                      handleStatusUpdate={handleStatusUpdate}
                      handleTokenPaid={handleTokenPaid}
                      handleSaleComplete={handleSaleComplete}
                      handleDispute={handleDispute}
                      handleAdminDelete={handleAdminDelete}
                      actionLoading={actionLoading}
                      onShowOtherParty={(party, appointment) => { setSelectedOtherParty(party); setSelectedAppointment(appointment); setShowOtherPartyModal(true); }}
                      onOpenReinitiate={() => handleOpenReinitiate(appt)}
                      handleArchiveAppointment={handleArchiveAppointment}
                      handleUnarchiveAppointment={handleUnarchiveAppointment}
                      isArchived={false}
                      onCancelRefresh={handleCancelRefresh}
                      copyMessageToClipboard={copyMessageToClipboard}
                      activeChatAppointmentId={activeChatAppointmentId}
                      shouldOpenChatFromNotification={shouldOpenChatFromNotification}
                      onChatOpened={() => {
                        setShouldOpenChatFromNotification(false);
                        setActiveChatAppointmentId(null);
                      }}
                      preferUnreadForAppointmentId={preferUnreadForAppointmentId}
                      onConsumePreferUnread={(id) => {
                        if (preferUnreadForAppointmentId === id) setPreferUnreadForAppointmentId(null);
                      }}
                      onExportChat={(appointment, comments, callHistory) => {
                        setExportAppointment(appointment);
                        setExportComments(comments);
                        setExportCallHistory(callHistory || []);
                        setShowExportModal(true);
                      }}
                      onInitiateCall={handleInitiateCall}
                      callState={callState}
                      incomingCall={incomingCall}
                      activeCall={activeCall}
                      localVideoRef={localVideoRef}
                      remoteVideoRef={remoteVideoRef}
                      isCallMuted={isCallMuted}
                      isVideoEnabled={isVideoEnabled}
                      callDuration={callDuration}
                      onAcceptCall={acceptCall}
                      onRejectCall={rejectCall}
                      onEndCall={endCall}
                      onToggleCallMute={toggleCallMute}
                      onToggleVideo={toggleVideo}
                      getOtherPartyName={getOtherPartyName}
                      // Call History Modal props
                      setShowCallHistoryModal={setShowCallHistoryModal}
                      setCallHistoryAppointmentId={setCallHistoryAppointmentId}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Pagination for regular appointments */}
        {!showArchived && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-2">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  setCurrentPage(Math.max(1, currentPage - 1));
                  toast.info(`Navigated to page ${Math.max(1, currentPage - 1)}`);
                }}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                Previous
              </button>
              <button
                onClick={() => {
                  setCurrentPage(Math.min(totalPages, currentPage + 1));
                  toast.info(`Navigated to page ${Math.min(totalPages, currentPage + 1)}`);
                }}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Pagination for archived appointments */}
        {showArchived && archivedTotalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-2">
            <div className="text-sm text-gray-700">
              Archived Page {archivedCurrentPage} of {archivedTotalPages}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  setArchivedCurrentPage(Math.max(1, archivedCurrentPage - 1));
                  toast.info(`Navigated to archived page ${Math.max(1, archivedCurrentPage - 1)}`);
                }}
                disabled={archivedCurrentPage === 1}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                Previous
              </button>
              <button
                onClick={() => {
                  setArchivedCurrentPage(Math.min(archivedTotalPages, archivedCurrentPage + 1));
                  toast.info(`Navigated to archived page ${Math.min(archivedTotalPages, archivedCurrentPage + 1)}`);
                }}
                disabled={archivedCurrentPage === archivedTotalPages}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Other Party Details Modal - Enhanced Design */}
        {showOtherPartyModal && selectedOtherParty && selectedAppointment && createPortal((() => {
          // Determine if contact details should be shown based on appointment status
          const isUpcoming = new Date(selectedAppointment.date) > new Date() || (new Date(selectedAppointment.date).toDateString() === new Date().toDateString() && (!selectedAppointment.time || selectedAppointment.time > new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })));
          const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin');
          const canSeeContactInfo = (isAdmin || selectedAppointment.status === 'accepted') && isUpcoming &&
            selectedAppointment.status !== 'cancelledByBuyer' && selectedAppointment.status !== 'cancelledBySeller' &&
            selectedAppointment.status !== 'cancelledByAdmin' && selectedAppointment.status !== 'rejected' &&
            selectedAppointment.status !== 'deletedByAdmin' &&
            ['public', 'friends'].includes(selectedOtherParty.profileVisibility);

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-[100] p-2 sm:p-4" style={{ overflow: 'hidden' }}>
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto relative animate-fadeIn">
                {/* Close button */}
                <button
                  className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full p-2 transition-colors z-10 shadow"
                  onClick={() => setShowOtherPartyModal(false)}
                  title="Close"
                  aria-label="Close"
                >
                  <FaTimes className="w-4 h-4" />
                </button>

                {/* Header with gradient background */}
                <div className="flex flex-col items-center justify-center bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40 rounded-t-2xl px-6 py-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <UserAvatar
                        user={{ username: selectedOtherParty.username, avatar: selectedOtherParty.avatar }}
                        profileVisibility={selectedOtherParty.profileVisibility}
                        size="w-16 h-16"
                        textSize="text-lg"
                        showBorder={true}
                        className="border-4 border-white shadow-lg"
                      />
                      {/* Online status indicator */}
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 border-2 border-white rounded-full flex items-center justify-center">
                        {!canSeeContactInfo ? (
                          <div className="w-full h-full bg-gray-400 rounded-full flex items-center justify-center">
                            <span className="text-white text-[8px] font-bold">N/A</span>
                          </div>
                        ) : selectedOtherParty.isTyping ? (
                          <div className="w-full h-full bg-yellow-500 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                          </div>
                        ) : selectedOtherParty.isOnline ? (
                          <div className="w-full h-full bg-green-500 rounded-full flex items-center justify-center">
                            <FaCircle className="w-2 h-2 text-white" />
                          </div>
                        ) : (
                          <div className="w-full h-full bg-gray-400 rounded-full flex items-center justify-center">
                            <FaCircle className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-center">
                      <h2 className="text-xl font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                        {selectedOtherParty.username || 'User'}
                        {selectedOtherParty.role === 'admin' && (
                          <FaUserShield className="text-purple-600 dark:text-purple-400 text-base" title="Admin user" />
                        )}
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-300 capitalize font-medium bg-white dark:bg-gray-700 px-3 py-1 rounded-full shadow-sm">
                        {(() => {
                          // Determine the opposite role based on current user's role in the appointment
                          const currentUserRole = selectedAppointment.buyerId?._id === currentUser._id || selectedAppointment.buyerId === currentUser._id ? 'buyer' : 'seller';
                          return currentUserRole === 'buyer' ? 'seller' : 'buyer';
                        })()}
                      </p>
                      {/* Status text below role */}
                      {!canSeeContactInfo ? (
                        <div className="mt-2">
                          <span className="text-gray-600 dark:text-white font-medium text-xs bg-gray-100 dark:bg-gray-600 px-3 py-1 rounded-full border border-transparent dark:border-gray-500 shadow-sm">
                            Not available
                          </span>
                        </div>
                      ) : selectedOtherParty.isTyping ? (
                        <div className="mt-2">
                          <span className="text-yellow-600 dark:text-yellow-300 font-medium text-xs bg-yellow-100 dark:bg-yellow-900/30 px-3 py-1 rounded-full">
                            Typing...
                          </span>
                        </div>
                      ) : selectedOtherParty.isOnline ? (
                        <div className="mt-2">
                          <span className="text-green-600 dark:text-green-300 font-medium text-xs bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
                            Online
                          </span>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <span className="text-gray-600 dark:text-white font-medium text-xs bg-gray-100 dark:bg-gray-600 px-3 py-1 rounded-full border border-transparent dark:border-gray-500 shadow-sm">
                            {(() => {
                              if (!selectedOtherParty.lastSeen) return 'Offline';

                              const lastSeenDate = new Date(selectedOtherParty.lastSeen);
                              const now = new Date();
                              const diffInMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));
                              const diffInHours = Math.floor(diffInMinutes / 60);
                              const diffInDays = Math.floor(diffInHours / 24);

                              if (diffInMinutes < 1) {
                                return 'Last seen just now';
                              } else if (diffInMinutes < 60) {
                                return `Last seen ${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
                              } else if (diffInHours < 24) {
                                return `Last seen ${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
                              } else if (diffInDays < 7) {
                                return `Last seen ${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
                              } else {
                                return `Last seen ${lastSeenDate.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric'
                                })}`;
                              }
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Body with enhanced styling */}
                <div className="px-6 py-6 space-y-4">
                  <div className="space-y-4">
                    {canSeeContactInfo ? (
                      <>
                        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-4 border-blue-500">
                          <FaEnvelope className="text-blue-500 dark:text-blue-400 w-5 h-5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-gray-500 dark:text-gray-300 uppercase tracking-wide font-semibold">Email</p>
                            <a
                              href={`mailto:${selectedOtherParty.email}`}
                              className="text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 hover:underline font-medium transition-colors duration-200"
                              title="Click to send email"
                            >
                              {selectedOtherParty.email}
                            </a>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-4 border-green-500">
                          <FaPhone className="text-green-500 dark:text-green-400 w-5 h-5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-gray-500 dark:text-gray-300 uppercase tracking-wide font-semibold">Phone</p>
                            {selectedOtherParty.mobileNumber && selectedOtherParty.mobileNumber !== '' ? (
                              <button
                                onClick={() => handlePhoneClick(selectedOtherParty.mobileNumber)}
                                className="text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200 hover:underline font-medium transition-colors duration-200 text-left"
                                title="Click to call or copy phone number"
                              >
                                {selectedOtherParty.mobileNumber}
                              </button>
                            ) : (
                              <p className="text-gray-800 dark:text-gray-300 font-medium">Not provided</p>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-l-4 border-yellow-500">
                        <FaExclamationTriangle className="text-yellow-500 w-5 h-5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-yellow-700 dark:text-yellow-400 uppercase tracking-wide font-semibold">Contact Information Restricted</p>
                          <p className="text-yellow-800 dark:text-yellow-200 font-medium">Contact details are only available for accepted appointments</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-4 border-purple-500">
                      <FaCalendar className="text-purple-500 dark:text-purple-400 w-5 h-5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-300 uppercase tracking-wide font-semibold">Member Since</p>
                        <p className="text-gray-800 dark:text-gray-200 font-medium">
                          {selectedOtherParty.createdAt ? new Date(selectedOtherParty.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }) : 'Not available'}
                        </p>
                      </div>
                    </div>
                  </div>


                </div>
              </div>
            </div>
          );
        })(), document.body)}
        {/* Reinitiate Modal */}
        {showReinitiateModal && reinitiateData && (() => {
          // Calculate hours since cancellation (72-hour window)
          const isCancelled = reinitiateData.status === 'cancelledByBuyer' || reinitiateData.status === 'cancelledBySeller';
          const cancellationDate = reinitiateData.updatedAt ? new Date(reinitiateData.updatedAt) : new Date();
          const now = new Date();
          const hoursSinceCancellation = (now - cancellationDate) / (1000 * 60 * 60);
          const hoursLeft = 72 - hoursSinceCancellation;
          const daysLeft = Math.floor(hoursLeft / 24);
          const remainingHours = Math.floor(hoursLeft % 24);
          const isRefunded = reinitiatePaymentStatus && (reinitiatePaymentStatus.status === 'refunded' || reinitiatePaymentStatus.status === 'partially_refunded');
          const canReinitiate = !(isCancelled && (isRefunded || hoursSinceCancellation > 72));

          // Determine if current user is buyer or seller
          const isBuyer = currentUser && (reinitiateData.buyerId?._id === currentUser._id || reinitiateData.buyerId === currentUser._id);
          const isSeller = currentUser && (reinitiateData.sellerId?._id === currentUser._id || reinitiateData.sellerId === currentUser._id);
          const reinitiationCount = isBuyer ? (reinitiateData.buyerReinitiationCount || 0) : isSeller ? (reinitiateData.sellerReinitiationCount || 0) : 0;
          const maxReinitiations = 2;
          const reinitiationsLeft = maxReinitiations - reinitiationCount;

          return (
            <div className="modal-backdrop">
              <div className="modal-content bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg shadow-xl" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-blue-700 dark:text-blue-400">Reinitiate Appointment</h3>
                    <span className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full font-medium">
                      {reinitiationCount}/{maxReinitiations} used
                    </span>
                  </div>

                  {/* Reinitiation count info */}
                  {reinitiationsLeft > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300 rounded">
                      <p className="text-sm">
                        <span className="font-semibold">Reinitiations remaining:</span> {reinitiationsLeft} out of {maxReinitiations}
                      </p>
                    </div>
                  )}

                  {reinitiationCount >= maxReinitiations && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 rounded">
                      <p className="font-semibold">Maximum reinitiations reached</p>
                      <p className="text-sm">You have used all {maxReinitiations} reinitiation attempts for this appointment.</p>
                    </div>
                  )}

                  {/* Show warning messages */}
                  {isCancelled && isRefunded && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 rounded">
                      <p className="font-semibold">Reinitiation not possible now</p>
                      <p className="text-sm">Payment has been refunded for this cancelled appointment. Reinitiation is not allowed after refund.</p>
                    </div>
                  )}

                  {isCancelled && !isRefunded && hoursSinceCancellation > 72 && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 rounded">
                      <p className="font-semibold">Reinitiation not possible now</p>
                      <p className="text-sm">The 72-hour (3-day) reinitiation window has expired. You can only reinitiate within 72 hours of cancellation.</p>
                    </div>
                  )}

                  {isCancelled && !isRefunded && hoursSinceCancellation <= 72 && (
                    <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300 rounded">
                      <p className="font-semibold">Reinitiation Window (72 hours)</p>
                      <p className="text-sm">
                        You can reinitiate this appointment within 72 hours of cancellation.
                        {hoursLeft > 0 ? (
                          <span className="font-bold">
                            {' '}
                            {daysLeft > 0 ? `${daysLeft}d ` : ''}
                            {remainingHours > 0 ? `${remainingHours}h` : ''}
                            {daysLeft === 0 && remainingHours === 0 ? 'Less than 1h' : ''} left.
                          </span>
                        ) : (
                          <span className="font-bold"> Window expired.</span>
                        )}
                      </p>
                    </div>
                  )}

                  <form onSubmit={handleReinitiateSubmit} className="space-y-4">
                    <div>
                      <label className="block font-semibold mb-1 dark:text-gray-300">Date</label>
                      <input type="date" className="border rounded px-2 py-1 w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={reinitiateData.date} onChange={e => setReinitiateData(d => ({ ...d, date: e.target.value }))} required disabled={!canReinitiate} />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1 dark:text-gray-300">Time (9 AM - 7 PM)</label>
                      <select
                        className="border rounded px-2 py-1 w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        value={reinitiateData.time}
                        onChange={e => setReinitiateData(d => ({ ...d, time: e.target.value }))}
                        required
                        disabled={!canReinitiate}
                      >
                        <option value="">Select Time (9 AM - 7 PM)</option>
                        {reinitiateData.time && !APPOINTMENT_TIME_SLOTS.some(slot => slot.value === reinitiateData.time) && (
                          <option value={reinitiateData.time}>
                            {`Current time (${formatTimeDisplay(reinitiateData.time)})`}
                          </option>
                        )}
                        {APPOINTMENT_TIME_SLOTS.map((slot) => (
                          <option key={slot.value} value={slot.value}>
                            {slot.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold mb-1 dark:text-gray-300">Message (optional)</label>
                      <textarea className="border rounded px-2 py-1 w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={reinitiateData.message} onChange={e => setReinitiateData(d => ({ ...d, message: e.target.value }))} disabled={!canReinitiate} />
                    </div>
                    <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full disabled:bg-gray-400 disabled:cursor-not-allowed" disabled={!canReinitiate}>Submit</button>
                    <button type="button" className="mt-2 w-full bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-600 px-4 py-2 rounded" onClick={() => {
                      setShowReinitiateModal(false);
                      setReinitiateData(null);
                      setReinitiatePaymentStatus(null);
                    }}>Cancel</button>
                  </form>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Archive Appointment Confirmation Modal */}
        {showArchiveModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaArchive className="text-blue-500" />
                Archive Appointment
              </h3>

              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to archive this appointment? It will be moved to the archived section.
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowArchiveModal(false);
                    setAppointmentToHandle(null);
                  }}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmArchive}
                  className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <FaArchive size={12} />
                  Archive
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Unarchive Appointment Confirmation Modal */}
        {showUnarchiveModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaUndo className="text-green-500" />
                Unarchive Appointment
              </h3>

              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to unarchive this appointment? It will be moved back to the active appointments.
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnarchiveModal(false);
                    setAppointmentToHandle(null);
                  }}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmUnarchive}
                  className="px-4 py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <FaUndo size={12} />
                  Unarchive
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Missing Chatbox Error Modal */}
        {missingChatbookError && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md w-full animate-fade-in-up">
              <div className="text-center">
                <div className="text-red-500 text-5xl mb-4">🔒</div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Access Denied</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  The appointment chat you're trying to access doesn't belong to your account, doesn't exist, or may have been deleted or archived.
                </p>
                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      setMissingChatbookError(null);
                      navigate('/user/my-appointments', { replace: true });
                    }}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export Chat Modal */}
      {showExportModal && createPortal((
        <ExportChatModal
          isOpen={showExportModal}
          onClose={() => {
            setShowExportModal(false);
            setExportAppointment(null);
            setExportComments([]);
            setExportCallHistory([]);
          }}
          onExport={async (includeMedia) => {
            try {
              toast.info('Generating PDF...', { autoClose: 2000 });
              // Determine the other party based on the export appointment
              const otherParty = exportAppointment?.buyerId?._id === currentUser._id ?
                exportAppointment?.sellerId : exportAppointment?.buyerId;

              const result = await exportEnhancedChatToPDF(
                exportAppointment,
                exportComments,
                currentUser,
                otherParty,
                includeMedia
              );
              if (result.success) {
                toast.success(`Chat transcript exported as ${result.filename}`);
              } else {
                toast.error(`Export failed: ${result.error}`);
              }
            } catch (error) {
              toast.error('Failed to export chat transcript');
              console.error('Export error:', error);
            }
          }}
          appointment={exportAppointment}
          messageCount={exportComments.filter(msg => !msg.deleted && (msg.message?.trim() || msg.imageUrl || msg.audioUrl || msg.videoUrl || msg.documentUrl)).length}
          imageCount={exportComments.filter(msg => msg.imageUrl && !msg.deleted).length}
        />
      ), document.body)}

      {/* Call modals are now global - rendered in App.jsx via GlobalCallModals */}

      {/* Call History Modal */}
      <CallHistoryModal
        appointmentId={callHistoryAppointmentId}
        isOpen={showCallHistoryModal}
        onClose={() => {
          setShowCallHistoryModal(false);
          setCallHistoryAppointmentId(null);
        }}
        currentUser={currentUser}
        isAdmin={false}
      />

    </div>
  );
}

function getDateLabel(date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function AppointmentRow({ appt, currentUser, handleStatusUpdate, handleTokenPaid, handleSaleComplete, handleDispute, handleAdminDelete, actionLoading, onShowOtherParty, onOpenReinitiate, handleArchiveAppointment, handleUnarchiveAppointment, isArchived, onCancelRefresh, copyMessageToClipboard, activeChatAppointmentId, shouldOpenChatFromNotification, onChatOpened, onExportChat, preferUnreadForAppointmentId, onConsumePreferUnread, onInitiateCall, callState, incomingCall, activeCall, localVideoRef, remoteVideoRef, isCallMuted, isVideoEnabled, callDuration, onAcceptCall, onRejectCall, onEndCall, onToggleCallMute, onToggleVideo, getOtherPartyName, setShowCallHistoryModal, setCallHistoryAppointmentId }) {
  // Camera modal state - moved to main MyAppointments component
  const navigate = useNavigate();
  const params = useParams();
  const { playMessageSent, playMessageReceived, playTyping, playNotification, toggleMute, setVolume, isMuted, getCurrentVolume } = useSoundEffects();

  const [replyTo, setReplyTo] = useState(null);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState(appt.comments || []);
  const [sending, setSending] = useState(false);
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState("");
  const [originalDraft, setOriginalDraft] = useState("");
  const [savingComment, setSavingComment] = useState(null);
  const location = useLocation();
  const [showChatModal, setShowChatModal] = useState(false);

  useEffect(() => {
    if (showChatModal) {
      const isSeller = currentUser?._id === appt.sellerId?._id || currentUser?._id === appt.sellerId;
      const otherPartyUser = isSeller ? appt.buyerId : appt.sellerId;
      const otherPartyName = otherPartyUser?.username || 'User';
      document.title = `Chat with ${otherPartyName} · UrbanSetu`;
    } else {
      if (document.title.includes("Chat with")) {
        document.title = "My Appointments - Bookings · UrbanSetu";
      }
    }
    return () => {
      if (showChatModal) {
        document.title = "My Appointments - Bookings · UrbanSetu";
      }
    };
  }, [showChatModal, appt.buyerId, appt.sellerId, currentUser?._id]);

  const [callHistory, setCallHistory] = useState([]);
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadNewMessages, setUnreadNewMessages] = useState(0);
  // Show unread divider only right after opening chat when there are unread messages
  const [showUnreadDividerOnOpen, setShowUnreadDividerOnOpen] = useState(false);
  // Prefer scrolling to unread on open from notification
  const [preferUnreadOnOpen, setPreferUnreadOnOpen] = useState(false);
  // Infinite scroll/pagination for chat
  const MESSAGES_PAGE_SIZE = 30;
  const [visibleCount, setVisibleCount] = useState(MESSAGES_PAGE_SIZE);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const loadingOlderRef = useRef(false);
  const [currentFloatingDate, setCurrentFloatingDate] = useState('');
  const [isScrolling, setIsScrolling] = useState(false);
  const [isOtherPartyOnline, setIsOtherPartyOnline] = useState(false);
  const [isOtherPartyOnlineInTable, setIsOtherPartyOnlineInTable] = useState(false);
  const [otherPartyLastSeen, setOtherPartyLastSeen] = useState(null);
  const [otherPartyLastSeenInTable, setOtherPartyLastSeenInTable] = useState(null);
  const [isOtherPartyTyping, setIsOtherPartyTyping] = useState(false);
  const [showShortcutTip, setShowShortcutTip] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const typingTimeoutRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const inputRef = useRef(null); // Add inputRef here

  // Network status for offline message queuing (WhatsApp-like behavior)
  const { isOnline } = useNetworkStatus();
  const messageQueueRef = useRef([]);
  const recentlySentIdsRef = useRef(new Set()); // Track IDs sent via retry to prevent socket duplicates
  const processingQueueRef = useRef(false); // Prevent concurrent queue processing
  const processRetryQueueRef = useRef(null); // Ref to always hold the latest processRetryQueue function
  const processingStartRef = useRef(null); // Timestamp when processing started (for stale lock recovery)

  // localStorage persistence helpers for queue
  const getQueueKey = () => `chatQueue_${appt._id}_${currentUser._id}`;
  const persistQueue = (queue) => {
    try { localStorage.setItem(getQueueKey(), JSON.stringify(queue)); } catch (_) { }
  };
  const loadPersistedQueue = () => {
    try { return JSON.parse(localStorage.getItem(getQueueKey()) || '[]'); } catch (_) { return []; }
  };

  // Load persisted queue on mount — restores queued messages after page refresh
  useEffect(() => {
    const saved = loadPersistedQueue();
    if (saved.length > 0) {
      messageQueueRef.current = saved;
      // Inject the saved temp messages back into the chat
      const tempMessages = saved.map(item => item.tempMessage).filter(Boolean);
      if (tempMessages.length > 0) {
        setComments(prev => {
          // Avoid duplicates — only add temp messages not already present
          const existingIds = new Set(prev.map(c => c._id));
          const newTemps = tempMessages.filter(t => !existingIds.has(t._id));
          return newTemps.length > 0 ? [...prev, ...newTemps] : prev;
        });
      }
      // Try to send immediately if online
      setTimeout(() => processRetryQueueRef.current?.(), 2000);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sequential queue processor — handles retry logic
  const processRetryQueue = async () => {
    if (processingQueueRef.current) return; // Already processing
    if (messageQueueRef.current.length === 0) return; // Nothing to process

    processingQueueRef.current = true;
    processingStartRef.current = Date.now();

    try {
      const queue = [...messageQueueRef.current];
      messageQueueRef.current = [];
      persistQueue([]);

      for (const queuedItem of queue) {
        const { tempId, type, payload, originalReplyToId } = queuedItem;

        // Update status to 'sending' (still shows clock icon)
        setComments(prev => prev.map(msg =>
          msg._id === tempId ? { ...msg, status: 'sending' } : msg
        ));

        // Use AbortController with 15s timeout to prevent hanging forever
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 15000);

        try {
          const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, {
            method: 'POST',
            body: JSON.stringify(payload),
            signal: controller.signal
          });
          clearTimeout(fetchTimeout);

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw { response: { status: res.status, data: errorData } };
          }

          const data = await res.json();
          const newComment = data.comments[data.comments.length - 1];

          // Track this ID so socket handler won't add a duplicate
          recentlySentIdsRef.current.add(newComment._id);
          setTimeout(() => recentlySentIdsRef.current.delete(newComment._id), 10000);

          // Replace the temp message with the server response
          setComments(prev => prev.map(msg =>
            msg._id === tempId
              ? {
                ...newComment,
                replyTo: originalReplyToId || newComment.replyTo || msg.replyTo
              }
              : msg
          ));

          // Play send sound
          try { if (settings?.soundEnabled) playMessageSent?.(); } catch (_) { }
        } catch (err) {
          clearTimeout(fetchTimeout);
          // On ANY error during retry, always re-queue the message
          setComments(prev => prev.map(msg =>
            msg._id === tempId ? { ...msg, status: 'queued' } : msg
          ));
          messageQueueRef.current.push(queuedItem);
        }
      }
    } catch (outerErr) {
      // Catch any completely unexpected errors in the processing loop
      console.error('[ChatQueue] Unexpected error in processRetryQueue:', outerErr);
    } finally {
      // ALWAYS reset processing flag, even on unexpected errors
      persistQueue(messageQueueRef.current);
      processingQueueRef.current = false;
      processingStartRef.current = null;
    }
  };

  // Keep the ref updated so all callbacks always call the latest version
  processRetryQueueRef.current = processRetryQueue;

  // Trigger retry when isOnline hook detects reconnection
  useEffect(() => {
    if (isOnline && messageQueueRef.current.length > 0) {
      processRetryQueueRef.current?.();
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Direct window 'online' event listener — more reliable than the hook for some browsers
  useEffect(() => {
    const handleOnline = () => {
      if (messageQueueRef.current.length > 0) {
        setTimeout(() => processRetryQueueRef.current?.(), 1500);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Tab visibility change — retry when user comes back to the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && messageQueueRef.current.length > 0) {
        setTimeout(() => processRetryQueueRef.current?.(), 1000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Periodic fallback retry (every 5s) with stale lock recovery
  useEffect(() => {
    const interval = setInterval(() => {
      // Stale lock recovery: if processing has been stuck for >30s, force reset
      if (processingQueueRef.current && processingStartRef.current) {
        const elapsed = Date.now() - processingStartRef.current;
        if (elapsed > 30000) {
          console.warn('[ChatQueue] Stale lock detected, force resetting after', elapsed, 'ms');
          processingQueueRef.current = false;
          processingStartRef.current = null;
        }
      }
      if (navigator.onLine && messageQueueRef.current.length > 0) {
        processRetryQueueRef.current?.();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Also trigger retry on socket reconnection (reliable internet indicator)
  useEffect(() => {
    const handleSocketReconnect = () => {
      if (messageQueueRef.current.length > 0) {
        setTimeout(() => processRetryQueueRef.current?.(), 1000);
      }
    };
    socket.on('connect', handleSocketReconnect);
    return () => socket.off('connect', handleSocketReconnect);
  }, []);

  // Keyboard shortcut to focus input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && e.ctrlKey && showChatModal && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showChatModal]);
  const [allProperties, setAllProperties] = useState([]);
  const [propertiesLoaded, setPropertiesLoaded] = useState(false);
  const [allBlogs, setAllBlogs] = useState([]);
  const [blogsLoaded, setBlogsLoaded] = useState(false);
  const [isLoadingBlogSuggestions, setIsLoadingBlogSuggestions] = useState(false);

  // Reinitiation countdown timer state
  const [paymentStatusForReinitiate, setPaymentStatusForReinitiate] = useState(null);
  const [reinitiateCountdown, setReinitiateCountdown] = useState(null);

  // Persist draft per appointment when chat is open (placed after refs/state used)
  useEffect(() => {
    if (!showChatModal || !appt?._id || !currentUser?._id) return;
    
    const fetchDraftAndHandleUrl = async () => {
      const searchParams = new URLSearchParams(location.search);
      const messageParam = searchParams.get('message');
      const draftKey = `appt_draft_${appt._id}_${currentUser._id}`;
      
      let finalDraft = "";
      
      // 1. Check URL parameter (highest priority)
      if (messageParam && params.chatId === appt._id) {
        finalDraft = messageParam;
        localStorage.setItem(draftKey, messageParam);
        // Sync URL message to backend immediately
        authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/draft`, {
          method: 'PATCH',
          body: JSON.stringify({ draft: messageParam })
        }).catch(err => console.error('Failed to sync URL message to backend draft:', err));
      } else {
        // 2. Check localStorage
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft !== null && savedDraft !== undefined && savedDraft !== "") {
          finalDraft = savedDraft;
        } else {
          // 3. Check backend database (lowest priority fallback)
          try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/my`); // We need the draft from appt object or a specific get
            // Actually, we can get it from the appt prop since it's populated?
            // Let's check if appt has it.
            const role = appt.buyerId?._id === currentUser._id ? 'buyer' : 'seller';
            const dbDraft = role === 'buyer' ? appt.buyerDraft : appt.sellerDraft;
            if (dbDraft) {
              finalDraft = dbDraft;
              localStorage.setItem(draftKey, dbDraft);
            }
          } catch (err) {
            console.error('Failed to fetch draft from backend:', err);
          }
        }
      }

      if (finalDraft) {
        setComment(finalDraft);
        setTimeout(() => {
          try {
            if (inputRef.current) {
              const length = inputRef.current.value.length;
              inputRef.current.setSelectionRange(length, length);
              autoResizeTextarea(inputRef.current);
            }
          } catch (_) { }
        }, 0);
      }
    };

    fetchDraftAndHandleUrl();
  }, [showChatModal, appt?._id, location.search, params.chatId]);

  // Sync draft to backend as user types (debounced)
  useEffect(() => {
    if (!showChatModal || !appt?._id || !currentUser?._id) return;
    
    const timeoutId = setTimeout(() => {
      const draftKey = `appt_draft_${appt._id}_${currentUser._id}`;
      localStorage.setItem(draftKey, comment);
      
      authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/draft`, {
        method: 'PATCH',
        body: JSON.stringify({ draft: comment })
      }).catch(err => console.error('Failed to sync draft to backend:', err));
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [comment, showChatModal, appt?._id]);

  // Fetch call history for appointment when chat modal opens
  useEffect(() => {
    if (!showChatModal || !appt?._id) return;

    const fetchCallHistory = async () => {
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/calls/history/${appt._id}`);

        if (response.ok) {
          const data = await response.json();
          if (data.calls) {
            setCallHistory(data.calls);
          }
        }
      } catch (error) {
        console.error('Error fetching call history:', error);
      }
    };

    fetchCallHistory();
  }, [showChatModal, appt?._id]);

  // Listen for call-ended event to update call history in real-time
  useEffect(() => {
    if (!appt?._id) return;

    const fetchCallHistory = async () => {
      if (!appt?._id) return;
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/calls/history/${appt._id}`);

        if (response.ok) {
          const data = await response.json();
          if (data.calls) {
            setCallHistory(data.calls);
          }
        }
      } catch (error) {
        console.error('Error fetching call history:', error);
      }
    };

    const handleCallEnded = (data) => {
      // If this call belongs to this appointment, refetch call history immediately
      // This ensures call bubbles appear in real-time like regular messages
      if (data.callId) {
        // Small delay to ensure backend has saved the call
        setTimeout(() => {
          fetchCallHistory();
        }, 100);
      }
    };

    socket.on('call-ended', handleCallEnded);
    return () => {
      socket.off('call-ended', handleCallEnded);
    };
  }, [appt?._id, socket]);

  // Lazy-load global content (properties, blogs, guides) when user starts typing a mention
  useEffect(() => {
    if (!showChatModal) return;
    const hasMentionTrigger = /@[^\s]*$/.test(comment || "");
    if (!hasMentionTrigger) return;

    // Load properties if not already loaded
    if (!propertiesLoaded) {
      (async () => {
        try {
          const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/get?limit=300&forSuggestion=true`);
          const data = await res.json();
          const mapped = Array.isArray(data) ? data.map(l => ({
            id: l._id,
            name: l.name || 'Property',
            city: l.city,
            state: l.state,
            price: l.discountPrice || l.regularPrice || l.price || 0,
            bedrooms: l.bedrooms || 0,
            bathrooms: l.bathrooms || 0,
            area: l.area || 0,
            imageUrls: l.imageUrls || [],
            imageUrl: l.imageUrl,
            image: l.image,
            thumbnail: l.thumbnail,
            type: 'property'
          })) : [];
          setAllProperties(mapped);
          setPropertiesLoaded(true);
        } catch (_) {
          // ignore failures
        }
      })();
    }

    // Load blogs if not already loaded
    if (!blogsLoaded) {
      (async () => {
        try {
          setIsLoadingBlogSuggestions(true);
          const res = await authenticatedFetch(`${API_BASE_URL}/api/blogs?limit=300&type=all&published=true`);
          const data = await res.json();
          const mapped = (data.data || data || []).map(b => ({
            id: b._id,
            name: b.title || 'Blog',
            category: b.category || 'General',
            image: b.thumbnail || b.image || null,
            type: b.type || 'blog'
          }));
          setAllBlogs(mapped);
          setBlogsLoaded(true);
        } catch (_) {
          // ignore failures
        } finally {
          setIsLoadingBlogSuggestions(false);
        }
      })();
    }
  }, [comment, showChatModal, propertiesLoaded, blogsLoaded]);

  // Fetch payment status for reinitiation check if appointment is cancelled
  useEffect(() => {
    const isCancelled = appt.status === 'cancelledByBuyer' || appt.status === 'cancelledBySeller';
    const isBuyer = currentUser && (appt.buyerId?._id === currentUser._id || appt.buyerId === currentUser._id);
    const isSeller = currentUser && (appt.sellerId?._id === currentUser._id || appt.sellerId === currentUser._id);
    const canShowReinitiate = (appt.status === 'cancelledByBuyer' && isBuyer) || (appt.status === 'cancelledBySeller' && isSeller);

    if (isCancelled && canShowReinitiate && appt._id) {
      const fetchPaymentStatus = async () => {
        try {
          const response = await authenticatedFetch(`${API_BASE_URL}/api/payments/history?appointmentId=${appt._id}`);
          if (response.ok) {
            const data = await response.json();
            if (data.payments && data.payments.length > 0) {
              setPaymentStatusForReinitiate(data.payments[0]);
            }
          }
        } catch (error) {
          console.error('Error fetching payment status:', error);
        }
      };
      fetchPaymentStatus();
    }
  }, [appt._id, appt.status, currentUser, appt.buyerId, appt.sellerId]);

  // Update countdown timer every second for reinitiation window
  useEffect(() => {
    const isCancelled = appt.status === 'cancelledByBuyer' || appt.status === 'cancelledBySeller';
    const isBuyer = currentUser && (appt.buyerId?._id === currentUser._id || appt.buyerId === currentUser._id);
    const isSeller = currentUser && (appt.sellerId?._id === currentUser._id || appt.sellerId === currentUser._id);
    const canShowReinitiate = (appt.status === 'cancelledByBuyer' && isBuyer) || (appt.status === 'cancelledBySeller' && isSeller);

    if (!isCancelled || !canShowReinitiate) {
      setReinitiateCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const cancellationDate = appt.updatedAt ? new Date(appt.updatedAt) : new Date();
      const now = new Date();
      const hoursSinceCancellation = (now - cancellationDate) / (1000 * 60 * 60);
      const hoursLeft = 72 - hoursSinceCancellation;

      if (hoursLeft <= 0) {
        setReinitiateCountdown({ expired: true });
        return;
      }

      const daysLeft = Math.floor(hoursLeft / 24);
      const remainingHours = Math.floor(hoursLeft % 24);

      setReinitiateCountdown({
        expired: false,
        days: daysLeft,
        hours: remainingHours,
        hoursLeft: hoursLeft
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [appt.status, appt.updatedAt, currentUser, appt.buyerId, appt.sellerId]);

  useEffect(() => {
    if (!showChatModal || !appt?._id || !currentUser?._id) return;
    const draftKey = `appt_draft_${appt._id}_${currentUser._id}`;
    localStorage.setItem(draftKey, comment);
  }, [comment, showChatModal, appt?._id, currentUser?._id]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [visibleActionsMessageId, setVisibleActionsMessageId] = useState(null);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [deleteForBoth, setDeleteForBoth] = useState(true);
  const [deleteMessageLoading, setDeleteMessageLoading] = useState(false);
  const [showClearChatModal, setShowClearChatModal] = useState(false);
  const [clearChatLoading, setClearChatLoading] = useState(false);

  // Undo functionality for messages deleted for me
  const [recentlyDeletedMessage, setRecentlyDeletedMessage] = useState(null);
  const [undoTimer, setUndoTimer] = useState(null);
  const isRestoringMessagesRef = useRef(false); // Flag to prevent restored messages from being treated as new
  // Report modal states
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportingMessage, setReportingMessage] = useState(null);
  const [submittingReport, setSubmittingReport] = useState(false);

  // Report chat modal states
  const [showReportChatModal, setShowReportChatModal] = useState(false);
  const [reportChatReason, setReportChatReason] = useState('');
  const [reportChatDetails, setReportChatDetails] = useState('');
  const [submittingChatReport, setSubmittingChatReport] = useState(false);

  // New modal states for various confirmations
  const [showDeleteAppointmentModal, setShowDeleteAppointmentModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAdminCancelModal, setShowAdminCancelModal] = useState(false);
  const [showPermanentDeleteModal, setShowPermanentDeleteModal] = useState(false);

  // Chat lock states
  const [chatLocked, setChatLocked] = useState(false);
  const [chatAccessGranted, setChatAccessGranted] = useState(false);
  const [chatLockStatusLoading, setChatLockStatusLoading] = useState(true);
  const [showChatLockModal, setShowChatLockModal] = useState(false);
  const [showChatUnlockModal, setShowChatUnlockModal] = useState(false);
  const [showRemoveLockModal, setShowRemoveLockModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [lockPassword, setLockPassword] = useState('');
  const [lockConfirmPassword, setLockConfirmPassword] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [removeLockPassword, setRemoveLockPassword] = useState('');
  const [showLockPassword, setShowLockPassword] = useState(false);
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);

  // Camera modal state - moved to top of component
  const [showRemoveLockPassword, setShowRemoveLockPassword] = useState(false);
  const [lockingChat, setLockingChat] = useState(false);
  const [unlockingChat, setUnlockingChat] = useState(false);
  const [removingLock, setRemovingLock] = useState(false);
  const [forgotPasswordProcessing, setForgotPasswordProcessing] = useState(false);
  const [loginPasswordForReset, setLoginPasswordForReset] = useState('');
  const [showLoginPasswordForReset, setShowLoginPasswordForReset] = useState(false);

  // Refund and appeal modal states
  const [showRefundRequestModal, setShowRefundRequestModal] = useState(false);
  const [showAppealModal, setShowAppealModal] = useState(false);

  // Lock body scroll when specific modals are open (Cancel or Remove Appointment)
  useEffect(() => {
    const shouldLock = showCancelModal || showPermanentDeleteModal;
    if (shouldLock) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showCancelModal, showPermanentDeleteModal]);

  // Lock body scroll when chat lock modals are open
  useEffect(() => {
    const shouldLock = showChatLockModal || showChatUnlockModal || showForgotPasswordModal || showRemoveLockModal;
    if (shouldLock) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showChatLockModal, showChatUnlockModal, showForgotPasswordModal, showRemoveLockModal]);

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

  // Lock body scroll when appeal modal is open
  useEffect(() => {
    if (showAppealModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showAppealModal]);

  // Cleanup undo timer when chat modal closes or component unmounts
  useEffect(() => {
    return () => {
      if (undoTimer) {
        clearTimeout(undoTimer);
      }
    };
  }, [undoTimer]);

  // Clear undo state when chat modal closes
  useEffect(() => {
    if (!showChatModal) {
      setRecentlyDeletedMessage(null);
      if (undoTimer) {
        clearTimeout(undoTimer);
        setUndoTimer(null);
      }
    }
  }, [showChatModal, undoTimer]);

  // Handle notification-triggered chat opening
  useEffect(() => {
    if (shouldOpenChatFromNotification && activeChatAppointmentId === appt._id) {
      // If lock status is still loading from the API, wait until it finishes
      if (chatLockStatusLoading) {
        return;
      }

      // Check if chat is locked/encrypted
      const isChatLocked = chatLocked || appt.buyerChatLocked || appt.sellerChatLocked;
      const currentUserId = currentUser._id;
      const isBuyer = appt.buyerId?._id === currentUserId || appt.buyerId === currentUserId;
      const isSeller = appt.sellerId?._id === currentUserId || appt.sellerId === currentUserId;

      const openChat = () => {
        setShowChatUnlockModal(false);
        setShowChatModal(true);
        // Update URL when opening chatbox
        navigate(`/user/my-appointments/chat/${appt._id}?chatopen=true`, { replace: false });
        // Dispatch event to notify App.jsx that chat is opened
        window.dispatchEvent(new CustomEvent('chatOpened', {
          detail: { appointmentId: appt._id }
        }));
        // Notify parent that chat has been opened
        if (onChatOpened) {
          onChatOpened();
        }
        // If this open was requested with unread preference, set the local flag
        if (preferUnreadForAppointmentId === appt._id) {
          setPreferUnreadOnOpen(true);
          if (typeof onConsumePreferUnread === 'function') onConsumePreferUnread(appt._id);
        }
      };

      if (isChatLocked) {
        if (chatAccessGranted) {
          openChat();
        } else if ((isBuyer && (chatLocked || appt.buyerChatLocked)) || (isSeller && (chatLocked || appt.sellerChatLocked))) {
          setShowChatUnlockModal(true);
        }
      } else {
        // Open chat directly if not locked
        openChat();
      }
    }
  }, [shouldOpenChatFromNotification, activeChatAppointmentId, appt._id, appt.buyerChatLocked, appt.sellerChatLocked, appt.buyerId, appt.sellerId, currentUser._id, onChatOpened, preferUnreadForAppointmentId, onConsumePreferUnread, chatAccessGranted, navigate, chatLocked, chatLockStatusLoading]);

  // Ensure unlock modal closes when chat opens
  useEffect(() => {
    if (showChatModal && showChatUnlockModal) {
      setShowChatUnlockModal(false);
    }
  }, [showChatModal, showChatUnlockModal]);

  // Store appointment and reasons for modals
  const [appointmentToHandle, setAppointmentToHandle] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const messageRefs = useRef({}); // Add messageRefs here

  // New: track which message's options are shown in the header
  const [headerOptionsMessageId, setHeaderOptionsMessageId] = useState(null);
  const [privacyNoticeHighlighted, setPrivacyNoticeHighlighted] = useState(false);
  const [showHeaderMoreMenu, setShowHeaderMoreMenu] = useState(false);

  // Reactions state
  const [showReactionsBar, setShowReactionsBar] = useState(false);
  const [reactionsMessageId, setReactionsMessageId] = useState(null);
  const [showReactionsEmojiPicker, setShowReactionsEmojiPicker] = useState(false);

  // Check if device is mobile for conditional animation
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Update mobile state on window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const unlockPasswordRef = useRef(null);
  const removeLockPasswordRef = useRef(null);
  const lockPasswordRef = useRef(null);

  // Autofocus lock password when modal opens (Desktop only)
  useEffect(() => {
    if (showChatLockModal && !isMobile && lockPasswordRef.current) {
      setTimeout(() => lockPasswordRef.current?.focus(), 100);
    }
  }, [showChatLockModal, isMobile]);

  // Autofocus unlock password when modal opens (Desktop only)
  useEffect(() => {
    if (showChatUnlockModal && !isMobile && unlockPasswordRef.current) {
      setTimeout(() => unlockPasswordRef.current?.focus(), 100);
    }
  }, [showChatUnlockModal, isMobile]);

  // Autofocus remove lock password when modal opens (Desktop only)
  useEffect(() => {
    if (showRemoveLockModal && !isMobile && removeLockPasswordRef.current) {
      setTimeout(() => removeLockPasswordRef.current?.focus(), 100);
    }
  }, [showRemoveLockModal, isMobile]);

  // Message info modal state
  const [showMessageInfoModal, setShowMessageInfoModal] = useState(false);
  const [selectedMessageForInfo, setSelectedMessageForInfo] = useState(null);
  // Call info modal state
  const [showCallInfoModal, setShowCallInfoModal] = useState(false);
  const [selectedCallForInfo, setSelectedCallForInfo] = useState(null);
  const [sendIconAnimating, setSendIconAnimating] = useState(false);
  const [sendIconSent, setSendIconSent] = useState(false);

  // Starred messages states
  const [showStarredModal, setShowStarredModal] = useState(false);
  const [starredMessages, setStarredMessages] = useState([]);
  const [starringSaving, setStarringSaving] = useState(false);
  const [loadingStarredMessages, setLoadingStarredMessages] = useState(false);
  const [unstarringMessageId, setUnstarringMessageId] = useState(null);
  const [removingAllStarred, setRemovingAllStarred] = useState(false);

  // Media modal states
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaModalTab, setMediaModalTab] = useState('images');
  const [mediaModalLoading, setMediaModalLoading] = useState(true);

  // Pinned messages states
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [loadingPinnedMessages, setLoadingPinnedMessages] = useState(false);
  const [pinningSaving, setPinningSaving] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [messageToPin, setMessageToPin] = useState(null);
  const [pinDuration, setPinDuration] = useState('24hrs');
  const [customHours, setCustomHours] = useState(24);
  const [highlightedPinnedMessage, setHighlightedPinnedMessage] = useState(null);

  // Chat options menu state
  const [showChatOptionsMenu, setShowChatOptionsMenu] = useState(false);
  const { settings, updateSetting } = useChatSettings('my_appointments_chat_settings');

  // Effect to play sound on new received messages
  const prevSoundCommentsLengthRef = useRef(comments.length);
  useEffect(() => {
    // Update ref if comments length resets (e.g. chat cleared)
    if (comments.length < prevSoundCommentsLengthRef.current) {
      prevSoundCommentsLengthRef.current = comments.length;
      return;
    }

    // Skip sound when restoring messages via undo (not a real new message)
    if (isRestoringMessagesRef.current) {
      prevSoundCommentsLengthRef.current = comments.length;
      return;
    }

    // Check for new messages
    if (comments.length > prevSoundCommentsLengthRef.current) {
      const lastMessage = comments[comments.length - 1];
      // Only play if message is from someone else and sound is enabled
      if (lastMessage && lastMessage.senderEmail !== currentUser.email) {
        if (settings.soundEnabled) {
          playMessageReceived();
        }
      }
      prevSoundCommentsLengthRef.current = comments.length;
    }
  }, [comments, currentUser.email, playMessageReceived, settings.soundEnabled]);

  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Multi-select message states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [multiSelectActions, setMultiSelectActions] = useState({
    starring: false,
    pinning: false,
    copying: false,
    deleting: false
  });

  // Search functionality state
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);

  // Calendar functionality state
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [highlightedDateMessage, setHighlightedDateMessage] = useState(null);

  // File upload states
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileUploadError, setFileUploadError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImages, setPreviewImages] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [imageCaptions, setImageCaptions] = useState({});
  const [showImagePreviewModal, setShowImagePreviewModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Enhanced upload tracking
  const [currentFileIndex, setCurrentFileIndex] = useState(-1);
  const [currentFileProgress, setCurrentFileProgress] = useState(0);
  const [failedFiles, setFailedFiles] = useState([]); // store File objects
  const [isCancellingUpload, setIsCancellingUpload] = useState(false);
  const currentUploadControllerRef = useRef(null);
  const [detectedUrl, setDetectedUrl] = useState(null);
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const [lastDismissedUrl, setLastDismissedUrl] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const videoInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const attachmentButtonRef = useRef(null);
  const attachmentPanelRef = useRef(null);
  const videoCaptionRef = useRef(null);
  const documentCaptionRef = useRef(null);
  // Attachment panel and new media states
  const [showAttachmentPanel, setShowAttachmentPanel] = useState(false);

  // Camera modal state - moved to AppointmentRow component
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showVideoPreviewModal, setShowVideoPreviewModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showDocumentPreviewModal, setShowDocumentPreviewModal] = useState(false);
  const [videoCaption, setVideoCaption] = useState('');
  const [documentCaption, setDocumentCaption] = useState('');
  const [videoObjectURL, setVideoObjectURL] = useState(null);
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [showAudioPreviewModal, setShowAudioPreviewModal] = useState(false);
  const [audioCaption, setAudioCaption] = useState('');
  const [audioObjectURL, setAudioObjectURL] = useState(null);
  const audioCaptionRef = useRef(null);
  // Audio Recording states
  const [showRecordAudioModal, setShowRecordAudioModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [recordingStream, setRecordingStream] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingStartTimeRef = useRef(0);
  const recordingCancelledRef = useRef(false);
  const pausedTimeRef = useRef(0); // Total time spent paused

  // Ensure timer ticks reliably while recording (redundant guard)
  useEffect(() => {
    if (isRecording && !isPaused) {
      // Initialize start time if not set
      if (!recordingStartTimeRef.current) {
        recordingStartTimeRef.current = Date.now();
      }
      const id = setInterval(() => {
        const elapsed = Date.now() - recordingStartTimeRef.current - pausedTimeRef.current;
        setRecordingElapsedMs(elapsed);
      }, 500);
      return () => clearInterval(id);
    }
  }, [isRecording, isPaused]);

  // Camera modal handlers - temporarily disabled

  // Camera useEffect - temporarily disabled

  // Camera functions - temporarily disabled

  // Sound effects
  // const { playMessageSent, playMessageReceived, playNotification, toggleMute, setVolume, isMuted, getCurrentVolume } = useSoundEffects();

  // Reactive state for volume control UI
  const [currentVolume, setCurrentVolume] = useState(1.0); // Default volume
  const [isSoundMuted, setIsSoundMuted] = useState(false);

  // Text styling panel state
  const [showTextStylingPanel, setShowTextStylingPanel] = useState(false);

  // Helper function to apply formatting and close panel
  const applyFormattingAndClose = (formatFunction) => {
    formatFunction();
    setTimeout(() => setShowTextStylingPanel(false), 100); // Small delay for better UX
  };

  // Sync reactive state with sound effects hook on initialization
  useEffect(() => {
    setCurrentVolume(getCurrentVolume());
    setIsSoundMuted(isMuted());
  }, [getCurrentVolume, isMuted]);

  // Update all existing audio elements when volume or mute state changes
  useEffect(() => {
    document.querySelectorAll('audio[data-audio-id]').forEach(audioEl => {
      if (audioEl) {
        audioEl.volume = currentVolume;
        audioEl.muted = isSoundMuted;
      }
    });
  }, [currentVolume, isSoundMuted]);

  // Manage video object URL to prevent reloading on each keystroke
  useEffect(() => {
    if (selectedVideo) {
      const url = URL.createObjectURL(selectedVideo);
      setVideoObjectURL(url);
      return () => {
        URL.revokeObjectURL(url);
        setVideoObjectURL(null);
      };
    } else {
      setVideoObjectURL(null);
    }
  }, [selectedVideo]);

  // Manage audio object URL
  useEffect(() => {
    if (selectedAudio) {
      const url = URL.createObjectURL(selectedAudio);
      setAudioObjectURL(url);
      return () => {
        URL.revokeObjectURL(url);
        setAudioObjectURL(null);
      };
    } else {
      setAudioObjectURL(null);
    }
  }, [selectedAudio]);

  // Recording timer cleanup
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (recordingStream) recordingStream.getTracks().forEach(t => t.stop());
    };
  }, [recordingStream]);

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingStream(stream);
      recordingChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordingChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        try {
          if (recordingCancelledRef.current) {
            // Do not create file or open preview when cancelled
            return;
          }
          const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
          const fileName = `recording-${Date.now()}.webm`;
          const file = new File([blob], fileName, { type: 'audio/webm' });
          setSelectedAudio(file);
          setShowRecordAudioModal(false);
          setShowAudioPreviewModal(true);
        } catch (err) {
          toast.error('Failed to prepare audio preview');
        } finally {
          if (recordingStream) recordingStream.getTracks().forEach(t => t.stop());
          setRecordingStream(null);
          setIsRecording(false);
          setIsPaused(false);
          setRecordingElapsedMs(0);
          pausedTimeRef.current = 0;
          if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
          recordingStartTimeRef.current = 0;
          recordingCancelledRef.current = false;
        }
      };
      mediaRecorder.start(100);
      setIsRecording(true);
      recordingStartTimeRef.current = Date.now();
      setRecordingElapsedMs(0);
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartTimeRef.current - pausedTimeRef.current;
        setRecordingElapsedMs(elapsed);
      }, 500);
    } catch (err) {
      console.error('Recording error:', err);
      toast.error('Microphone permission denied or unavailable');
    }
  };

  const stopAudioRecording = () => {
    if (!mediaRecorderRef.current) return;
    try {
      mediaRecorderRef.current.stop();
    } catch { }
  };

  const pauseAudioRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
    try {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      // Clear the timer when pausing
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    } catch (err) {
      console.error('Pause recording error:', err);
    }
  };

  const resumeAudioRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'paused') return;
    try {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      // Update paused time accumulator
      const pauseEndTime = Date.now();
      const pauseStartTime = recordingStartTimeRef.current + recordingElapsedMs + pausedTimeRef.current;
      pausedTimeRef.current += (pauseEndTime - pauseStartTime);

      // Restart the timer
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartTimeRef.current - pausedTimeRef.current;
        setRecordingElapsedMs(elapsed);
      }, 500);
    } catch (err) {
      console.error('Resume recording error:', err);
    }
  };

  const cancelAudioRecording = () => {
    try {
      recordingCancelledRef.current = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch { }
    if (recordingStream) recordingStream.getTracks().forEach(t => t.stop());
    setRecordingStream(null);
    setIsRecording(false);
    setIsPaused(false);
    setRecordingElapsedMs(0);
    pausedTimeRef.current = 0;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setShowRecordAudioModal(false);
    // Ensure preview is not shown and any selection cleared
    setSelectedAudio(null);
  };

  // Close attachment panel on outside click
  useEffect(() => {
    if (!showAttachmentPanel) return;
    const handleClickOutside = (e) => {
      const btn = attachmentButtonRef.current;
      const panel = attachmentPanelRef.current;
      if (panel && panel.contains(e.target)) return;
      if (btn && btn.contains(e.target)) return;
      setShowAttachmentPanel(false);
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [showAttachmentPanel]);

  // File upload handler
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    const validFiles = [];
    const errors = [];

    // Validate each file
    Array.from(files).forEach((file, index) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        errors.push(`File ${index + 1}: Please select an image file`);
        return;
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        errors.push(`File ${index + 1}: File size must be less than 10MB`);
        return;
      }

      validFiles.push(file);
    });

    // Show errors if any
    if (errors.length > 0) {
      setFileUploadError(errors.join(', '));
      setTimeout(() => setFileUploadError(''), 5000);
      return;
    }

    // Limit to 10 images maximum
    if (validFiles.length > 10) {
      setFileUploadError('Maximum 10 images allowed at once');
      setTimeout(() => setFileUploadError(''), 3000);
      return;
    }

    // Show preview with caption input instead of directly sending
    setSelectedFiles(validFiles);
    setPreviewIndex(0); // Reset to first image
    setShowImagePreviewModal(true);
    setFileUploadError('');
  };

  const sendImageMessage = async (imageUrl, fileName, caption = '') => {
    // Create a temporary message object with immediate display
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      _id: tempId,
      sender: currentUser._id,
      senderEmail: currentUser.email,
      senderName: currentUser.username,
      message: caption || '',
      imageUrl: imageUrl,
      status: "sending",
      timestamp: new Date().toISOString(),
      readBy: [currentUser._id],
      type: "image"
    };

    // Immediately update UI
    setComments(prev => [...prev, tempMessage]);

    // Scroll to bottom
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }

    // Send message in background
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, {
        method: 'POST',
        body: JSON.stringify({
          message: caption || '',
          imageUrl: imageUrl,
          type: "image"
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      // Find the new comment from the response
      const newComment = data.comments[data.comments.length - 1];

      // Track this ID so socket handler won't add a duplicate
      recentlySentIdsRef.current.add(newComment._id);
      setTimeout(() => recentlySentIdsRef.current.delete(newComment._id), 10000);

      // Replace the temp message with the real one
      setComments(prev => prev.map(msg =>
        msg._id === tempId
          ? { ...newComment }
          : msg
      ));
    } catch (error) {
      console.error('Send image error:', error);
      const isNetworkError = !navigator.onLine || error.message === 'Failed to fetch' || error.name === 'TypeError';
      if (isNetworkError) {
        // Queue image message for retry when back online
        setComments(prev => prev.map(msg =>
          msg._id === tempId ? { ...msg, status: 'queued' } : msg
        ));
        messageQueueRef.current.push({
          tempId,
          type: 'image',
          payload: { message: caption || '', imageUrl: imageUrl, type: 'image' },
          tempMessage: { ...tempMessage, status: 'queued' }
        });
        persistQueue(messageQueueRef.current);
      } else {
        setComments(prev => prev.filter(msg => msg._id !== tempId));
        toast.error(error.response?.data?.message || "Failed to send image.");
      }
    }
  };

  // Chat image download function (similar to ImagePreview logic)
  const handleDownloadChatImage = async (imageUrl, messageId) => {
    if (!imageUrl || typeof imageUrl !== 'string') {
      toast.error('Error: Invalid image URL. Cannot download image.');
      return;
    }

    try {
      // Extract filename from URL or generate one
      const urlParts = imageUrl.split('/');
      const originalFilename = urlParts[urlParts.length - 1];
      let filename = originalFilename;

      // If filename doesn't have an extension or is just a hash, generate a proper name
      if (!filename.includes('.') || filename.length < 5) {
        // Try to determine file extension from URL or default to jpg
        const extension = imageUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i)?.[1] || 'jpg';
        filename = `chat-image-${messageId || Date.now()}.${extension}`;
      }

      // Try to fetch the image to handle CORS and get proper blob
      try {
        const response = await authenticatedFetch(imageUrl, {
          mode: 'cors',
          cache: 'no-cache'
        });

        if (response.ok) {
          try {
            const blob = await response.blob();

            // Validate blob
            if (!blob || blob.size === 0) {
              throw new Error('Downloaded image is empty or corrupted');
            }

            const blobUrl = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up blob URL
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);

            // Show success feedback
            toast.success(`Image "${filename}" downloaded successfully!`);
            return; // Exit early on success

          } catch (blobError) {
            console.error('Blob processing error:', blobError);
            throw new Error(`Failed to process image data: ${blobError.message}`);
          }
        } else {
          // Handle specific HTTP error codes
          let errorMessage = `Server error (${response.status}): `;
          switch (response.status) {
            case 404:
              errorMessage += 'Image not found on server';
              break;
            case 403:
              errorMessage += 'Access denied to image';
              break;
            case 500:
              errorMessage += 'Server internal error';
              break;
            default:
              errorMessage += 'Unable to fetch image';
          }
          throw new Error(errorMessage);
        }
      } catch (fetchError) {
        console.warn('Fetch failed, trying direct download:', fetchError);

        // Show specific error for fetch failure
        if (fetchError.name === 'TypeError' && fetchError.message.includes('Failed to fetch')) {
          toast.warn('Network error: Trying alternative download method...');
        } else if (fetchError.message.includes('CORS')) {
          toast.warn('CORS error: Trying alternative download method...');
        } else {
          toast.warn(`Fetch error: ${fetchError.message}. Trying alternative download method...`);
        }

        // Fallback to direct link download for CORS issues
        try {
          const link = document.createElement('a');
          link.href = imageUrl;
          link.download = filename;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Show info message for direct download attempt
          toast.info('Alternative download initiated. If it doesn\'t start automatically, please try right-clicking the image and selecting "Save image as..."');
          return; // Exit early on fallback attempt

        } catch (directDownloadError) {
          console.error('Direct download failed:', directDownloadError);
          throw new Error(`Direct download failed: ${directDownloadError.message}`);
        }
      }
    } catch (error) {
      console.error('Download process failed:', error);

      // Show error notification for the main download process failure
      toast.error(`Download failed: ${error.message}. Attempting to open image in new tab...`);

      // Final fallback - open image in new tab
      try {
        const newWindow = window.open(imageUrl, '_blank', 'noopener,noreferrer');

        if (newWindow) {
          toast.info('Image opened in new tab. You can right-click to save it manually.');
        } else {
          // Pop-up blocked
          throw new Error('Pop-up blocked by browser');
        }
      } catch (openError) {
        console.error('Failed to open image in new tab:', openError);

        // Final error - all methods failed
        if (openError.message.includes('Pop-up blocked')) {
          toast.error('Error: Pop-up blocked. Please allow pop-ups for this site or right-click the image and select "Save image as..."');
        } else {
          toast.error(`All download methods failed: ${openError.message}. Please right-click the image and select "Save image as..." or check your internet connection.`);
        }
      }
    }
  };

  // Helper to extract extension and clean document name for chat documents
  const getChatDocDetails = (docUrl, documentName, documentMimeType) => {
    const url = docUrl || '';
    const cleanUrl = url.split('?')[0];
    let docName = documentName || '';
    let ext = '';

    if (docName && docName.includes('.')) {
      const candidate = docName.split('.').pop().toLowerCase();
      if (candidate && candidate.length <= 5 && !candidate.includes('/')) {
        ext = candidate;
      }
    }

    if (!ext && cleanUrl.includes('.')) {
      const lastSlash = cleanUrl.lastIndexOf('/');
      const filenamePart = lastSlash !== -1 ? cleanUrl.substring(lastSlash + 1) : cleanUrl;
      if (filenamePart.includes('.')) {
        const candidate = filenamePart.split('.').pop().toLowerCase();
        if (candidate && candidate.length <= 5) {
          ext = candidate;
        }
      }
    }

    if (!ext && documentMimeType) {
      const mime = documentMimeType.toLowerCase();
      if (mime.includes('pdf')) ext = 'pdf';
      else if (mime.includes('word') || mime.includes('officedocument')) ext = 'docx';
      else if (mime.includes('excel') || mime.includes('spreadsheet')) ext = 'xlsx';
      else if (mime.includes('text') || mime.includes('markdown')) ext = 'txt';
      else if (mime.includes('image')) ext = 'jpg';
    }

    if (!ext) ext = 'pdf';

    if (!docName) {
      docName = `Document.${ext}`;
    } else if (!docName.includes('.')) {
      docName = `${docName}.${ext}`;
    }

    return { ext, docName };
  };

  // Helper to trigger document download in actual format
  const handleDownloadChatDocument = async (docUrl, docNameRaw, mimeType) => {
    try {
      if (!docUrl) return;

      const { docName } = getChatDocDetails(docUrl, docNameRaw, mimeType);

      const isCloudinary = docUrl.includes('cloudinary.com');
      const response = isCloudinary
        ? await fetch(docUrl, { mode: 'cors' })
        : await authenticatedFetch(docUrl, { mode: 'cors' });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = docName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
      toast.success('Document downloaded successfully');
    } catch (error) {
      console.error('Error downloading document:', error);
      try {
        const { docName } = getChatDocDetails(docUrl, docNameRaw, mimeType);
        let fallbackUrl = docUrl;
        if (docUrl.includes('cloudinary.com') && docUrl.includes('/upload/')) {
          fallbackUrl = docUrl.replace('/upload/', '/upload/fl_attachment/');
        }
        const link = document.createElement('a');
        link.href = fallbackUrl;
        link.download = docName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success('Document download started');
      } catch (fallbackErr) {
        console.error('Fallback download failed:', fallbackErr);
        toast.error('Failed to download document');
      }
    }
  };

  // Video upload + send
  const sendVideoMessage = async (videoUrl, fileName, caption = '') => {
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      _id: tempId,
      sender: currentUser._id,
      senderEmail: currentUser.email,
      message: caption || '',
      videoUrl,
      type: 'video',
      status: 'sending',
      timestamp: new Date().toISOString(),
    };
    setComments(prev => [...prev, tempMessage]);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, {
        method: 'POST',
        body: JSON.stringify({
          message: caption || '',
          videoUrl,
          type: 'video'
        })
      });
      if (!res.ok) throw new Error('Failed to send video');
      const data = await res.json();
      setComments(data.comments || data.updated?.comments || data?.appointment?.comments || []);
    } catch (err) {
      const isNetworkError = !navigator.onLine || err.message === 'Failed to fetch' || err.name === 'TypeError';
      if (isNetworkError) {
        // Queue video message for retry when back online
        setComments(prev => prev.map(m =>
          m._id === tempId ? { ...m, status: 'queued' } : m
        ));
        messageQueueRef.current.push({
          tempId,
          type: 'video',
          payload: { message: caption || '', videoUrl, type: 'video' },
          tempMessage: { ...tempMessage, status: 'queued' }
        });
        persistQueue(messageQueueRef.current);
      } else {
        toast.error('Failed to send video');
        setComments(prev => prev.filter(m => m._id !== tempId));
      }
    }
  };

  const handleSendSelectedVideo = async () => {
    if (!selectedVideo) return;
    try {
      setUploadingFile(true);
      const form = new FormData();
      form.append('video', selectedVideo);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/upload/video`, {
        method: 'POST',
        body: form
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      await sendVideoMessage(data.videoUrl, selectedVideo.name, videoCaption);
      setSelectedVideo(null);
      setShowVideoPreviewModal(false);
      setVideoCaption('');
      setUploadProgress(0);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Video upload failed');
    } finally {
      setUploadingFile(false);
    }
  };

  // Audio upload + send
  const sendAudioMessage = async (audioUrl, file, caption = '') => {
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      _id: tempId,
      sender: currentUser._id,
      senderEmail: currentUser.email,
      message: caption || '',
      audioUrl,
      audioName: file.name,
      audioMimeType: file.type || null,
      type: 'audio',
      status: 'sending',
      timestamp: new Date().toISOString(),
    };
    setComments(prev => [...prev, tempMessage]);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, {
        method: 'POST',
        body: JSON.stringify({
          message: caption || '',
          audioUrl,
          audioName: file.name,
          audioMimeType: file.type || null,
          type: 'audio'
        })
      });
      if (!res.ok) throw new Error('Failed to send audio');
      const data = await res.json();
      setComments(data.comments || data.updated?.comments || data?.appointment?.comments || []);
    } catch (err) {
      const isNetworkError = !navigator.onLine || err.message === 'Failed to fetch' || err.name === 'TypeError';
      if (isNetworkError) {
        // Queue audio message for retry when back online
        setComments(prev => prev.map(m =>
          m._id === tempId ? { ...m, status: 'queued' } : m
        ));
        messageQueueRef.current.push({
          tempId,
          type: 'audio',
          payload: { message: caption || '', audioUrl, audioName: file.name, audioMimeType: file.type || null, type: 'audio' },
          tempMessage: { ...tempMessage, status: 'queued' }
        });
        persistQueue(messageQueueRef.current);
      } else {
        toast.error('Failed to send audio');
        setComments(prev => prev.filter(m => m._id !== tempId));
      }
    }
  };

  const handleSendSelectedAudio = async () => {
    if (!selectedAudio) return;
    try {
      setUploadingFile(true);
      const form = new FormData();
      form.append('audio', selectedAudio);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/upload/audio`, {
        method: 'POST',
        body: form
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      await sendAudioMessage(data.audioUrl, selectedAudio, audioCaption);
      setSelectedAudio(null);
      setShowAudioPreviewModal(false);
      setAudioCaption('');
      setUploadProgress(0);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Audio upload failed');
    } finally {
      setUploadingFile(false);
    }
  };

  // Document upload + send
  const sendDocumentMessage = async (documentUrl, file, caption = '') => {
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      _id: tempId,
      sender: currentUser._id,
      senderEmail: currentUser.email,
      message: caption || '',
      documentUrl,
      documentName: file.name,
      documentMimeType: file.type || null,
      type: 'document',
      status: 'sending',
      timestamp: new Date().toISOString(),
    };
    setComments(prev => [...prev, tempMessage]);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, {
        method: 'POST',
        body: JSON.stringify({
          message: caption || '',
          documentUrl,
          documentName: file.name,
          documentMimeType: file.type || null,
          type: 'document'
        })
      });
      if (!res.ok) throw new Error('Failed to send document');
      const data = await res.json();
      setComments(data.comments || data.updated?.comments || data?.appointment?.comments || []);
    } catch (err) {
      const isNetworkError = !navigator.onLine || err.message === 'Failed to fetch' || err.name === 'TypeError';
      if (isNetworkError) {
        // Queue document message for retry when back online
        setComments(prev => prev.map(m =>
          m._id === tempId ? { ...m, status: 'queued' } : m
        ));
        messageQueueRef.current.push({
          tempId,
          type: 'document',
          payload: { message: caption || '', documentUrl, documentName: file.name, documentMimeType: file.type || null, type: 'document' },
          tempMessage: { ...tempMessage, status: 'queued' }
        });
        persistQueue(messageQueueRef.current);
      } else {
        toast.error('Failed to send document');
        setComments(prev => prev.filter(m => m._id !== tempId));
      }
    }
  };

  const handleSendSelectedDocument = async () => {
    if (!selectedDocument) return;
    try {
      setUploadingFile(true);
      const form = new FormData();
      form.append('document', selectedDocument);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/upload/document`, {
        method: 'POST',
        body: form
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      await sendDocumentMessage(data.documentUrl, selectedDocument, documentCaption);
      setSelectedDocument(null);
      setShowDocumentPreviewModal(false);
      setDocumentCaption('');
      setUploadProgress(0);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Document upload failed');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleImageFiles = (files) => {
    // Check if chat sending is blocked for this appointment status
    if (isChatSendBlocked) {
      toast.info('Image sending disabled for this appointment status. You can view chat history.');
      return;
    }

    // Check if adding these files would exceed the 10 image limit
    const totalFiles = (selectedFiles?.length || 0) + files.length;
    if (totalFiles > 10) {
      toast.error('Maximum 10 images allowed. Please remove some images first.');
      return;
    }

    // Filter only image files
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast.error('No valid image files found');
      return;
    }

    // Add new files to existing selection
    setSelectedFiles(prev => [...(prev || []), ...imageFiles]);

    // Initialize captions for new files
    const newCaptions = {};
    imageFiles.forEach(file => {
      newCaptions[file.name] = '';
    });
    setImageCaptions(prev => ({ ...prev, ...newCaptions }));

    // Show image preview modal
    setShowImagePreviewModal(true);

    toast.success(`${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''} added successfully!`);
  };

  const handleSendImagesWithCaptions = async () => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    // Check if chat sending is blocked for this appointment status
    if (isChatSendBlocked) {
      toast.info('Image sending disabled for this appointment status. You can view chat history.');
      return;
    }

    setUploadingFile(true);
    setUploadProgress(0);
    setCurrentFileIndex(-1);
    setCurrentFileProgress(0);
    setFailedFiles([]);
    setIsCancellingUpload(false);

    try {
      // Upload images sequentially so we can show progress
      let cancelledByUser = false;
      const failedLocal = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setCurrentFileIndex(i);
        setCurrentFileProgress(0);

        const uploadFormData = new FormData();
        uploadFormData.append('image', file);

        // Abort controller per file
        const controller = new AbortController();
        currentUploadControllerRef.current = controller;

        try {
          const res = await authenticatedFetch(`${API_BASE_URL}/api/upload/image`, {
            method: 'POST',
            body: uploadFormData,
            signal: controller.signal
          });
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw { response: { status: res.status, data: errorData } };
          }
          const data = await res.json();

          await sendImageMessage(data.imageUrl, file.name, imageCaptions[file.name] || '');
          setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
        } catch (err) {
          if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
            // Upload cancelled
            cancelledByUser = true;
            setIsCancellingUpload(true);
            break;
          } else {
            // Mark this file as failed and continue with next
            failedLocal.push(file);
          }
        } finally {
          if (currentUploadControllerRef.current === controller) {
            currentUploadControllerRef.current = null;
          }
        }
      }

      // Persist failed files to state
      if (failedLocal.length) setFailedFiles(failedLocal);

      // Clear state only if fully successful and not cancelled
      if (!cancelledByUser && failedLocal.length === 0) {
        setSelectedFiles([]);
        setImageCaptions({});
        setPreviewIndex(0);
        setShowImagePreviewModal(false);
      }
    } catch (error) {
      console.error('File upload error:', error);
      setFileUploadError(error.response?.data?.message || 'Upload failed. Please try again.');
      toast.error(error.response?.data?.message || 'Upload failed. Please try again.');
      // Auto-hide error message after 3 seconds
      setTimeout(() => setFileUploadError(''), 3000);
    } finally {
      setUploadingFile(false);
      setUploadProgress(0);
      setCurrentFileIndex(-1);
      setCurrentFileProgress(0);
    }
  };

  // Cancel in-flight upload
  const handleCancelInFlightUpload = () => {
    if (currentUploadControllerRef.current) {
      try { currentUploadControllerRef.current.abort(); } catch (_) { }
    }
    // Do not close preview; ensure send button remains available
    setUploadingFile(false);
    setCurrentFileIndex(-1);
    setCurrentFileProgress(0);
    // Keep already selected files; allow retry of any partially attempted file
  };

  // Retry failed uploads
  const handleRetryFailedUploads = async () => {
    if (!failedFiles.length) return;
    // Move only failed files into selection and try again
    setSelectedFiles(failedFiles);
    setFailedFiles([]);
    await handleSendImagesWithCaptions();
  };

  // Chat lock handler functions
  const handleChatLock = async () => {
    if (!lockPassword || !lockConfirmPassword) {
      toast.error('Please fill in both password fields');
      return;
    }

    if (lockPassword !== lockConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (lockPassword.length < 4) {
      toast.error('Password must be at least 4 characters long');
      return;
    }

    setLockingChat(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/lock`, {
        method: 'PATCH',
        body: JSON.stringify({ password: lockPassword })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      setChatLocked(true);
      setChatAccessGranted(false);
      setShowChatLockModal(false);
      setLockPassword('');
      setLockConfirmPassword('');
      
      // Update appt prop reference to stay synced
      const isBuyer = appt.buyerId?._id === currentUser._id || appt.buyerId === currentUser._id;
      if (isBuyer) {
        appt.buyerChatLocked = true;
        appt.buyerChatAccessGranted = false;
      } else {
        appt.sellerChatLocked = true;
        appt.sellerChatAccessGranted = false;
      }

      toast.success('Chat locked successfully.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to lock chat');
    } finally {
      setLockingChat(false);
    }
  };
  const handleChatUnlock = async () => {
    if (!unlockPassword) {
      toast.error('Please enter your password');
      return;
    }

    setUnlockingChat(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/unlock`, {
        method: 'PATCH',
        body: JSON.stringify({ password: unlockPassword })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      setChatAccessGranted(true);
      setShowChatUnlockModal(false);
      setUnlockPassword('');
      
      // Update appt prop reference to stay synced
      const isBuyer = appt.buyerId?._id === currentUser._id || appt.buyerId === currentUser._id;
      if (isBuyer) {
        appt.buyerChatAccessGranted = true;
      } else {
        appt.sellerChatAccessGranted = true;
      }

      toast.success('Chat access granted.');

      // Open chat modal after successful unlock
      setShowChatModal(true);
      // Update URL when opening chatbox
      navigate(`/user/my-appointments/chat/${appt._id}?chatopen=true`, { replace: false });
      // Dispatch event to notify App.jsx that chat is opened
      window.dispatchEvent(new CustomEvent('chatOpened', {
        detail: { appointmentId: appt._id }
      }));
      // Notify parent that chat has been opened
      if (onChatOpened) {
        onChatOpened();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Incorrect password');
    } finally {
      setUnlockingChat(false);
    }
  };

  const handleRemoveChatLock = async () => {
    if (!unlockPassword) {
      toast.error('Please enter your password');
      return;
    }

    setUnlockingChat(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/remove-lock`, {
        method: 'PATCH',
        body: JSON.stringify({ password: unlockPassword })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      setChatLocked(false);
      setChatAccessGranted(false);
      setShowChatUnlockModal(false);
      setUnlockPassword('');

      // Update appt prop reference to stay synced
      const isBuyer = appt.buyerId?._id === currentUser._id || appt.buyerId === currentUser._id;
      if (isBuyer) {
        appt.buyerChatLocked = false;
        appt.buyerChatPassword = null;
        appt.buyerChatAccessGranted = false;
      } else {
        appt.sellerChatLocked = false;
        appt.sellerChatPassword = null;
        appt.sellerChatAccessGranted = false;
      }

      toast.success('Chat lock removed successfully.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Incorrect password');
    } finally {
      setUnlockingChat(false);
    }
  };
  const handleRemoveLockFromMenu = async () => {
    if (!removeLockPassword) {
      toast.error('Please enter your password');
      return;
    }

    setRemovingLock(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/remove-lock`, {
        method: 'PATCH',
        body: JSON.stringify({ password: removeLockPassword })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      setChatLocked(false);
      setChatAccessGranted(false);
      setShowRemoveLockModal(false);
      setRemoveLockPassword('');
      setShowRemoveLockPassword(false);

      // Update appt prop reference to stay synced
      const isBuyer = appt.buyerId?._id === currentUser._id || appt.buyerId === currentUser._id;
      if (isBuyer) {
        appt.buyerChatLocked = false;
        appt.buyerChatPassword = null;
        appt.buyerChatAccessGranted = false;
      } else {
        appt.sellerChatLocked = false;
        appt.sellerChatPassword = null;
        appt.sellerChatAccessGranted = false;
      }

      toast.success('Chat lock removed.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Incorrect password');
    } finally {
      setRemovingLock(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!loginPasswordForReset.trim()) {
      toast.error('Please enter your login password');
      return;
    }
    setForgotPasswordProcessing(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/forgot-password`, {
        method: 'PATCH',
        body: JSON.stringify({ loginPassword: loginPasswordForReset })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      setChatLocked(false);
      setChatAccessGranted(false);
      setShowForgotPasswordModal(false);
      setLoginPasswordForReset('');
      setShowLoginPasswordForReset(false);

      // Update appt prop reference to stay synced
      const isBuyer = appt.buyerId?._id === currentUser._id || appt.buyerId === currentUser._id;
      if (isBuyer) {
        appt.buyerChatLocked = false;
        appt.buyerChatPassword = null;
        appt.buyerChatAccessGranted = false;
      } else {
        appt.sellerChatLocked = false;
        appt.sellerChatPassword = null;
        appt.sellerChatAccessGranted = false;
      }

      toast.success('Chat lock removed successfully.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove chat lock');
    } finally {
      setForgotPasswordProcessing(false);
    }
  };

  // Reset chat access when chat modal is closed
  const handleChatModalClose = async () => {
    setShowChatModal(false);
    // Revert URL when closing chatbox
    if (params.chatId) {
      navigate(`/user/my-appointments`, { replace: true });
    }

    // Dispatch event to notify App.jsx that chat is closed
    window.dispatchEvent(new CustomEvent('chatClosed'));

    // Reset chat access if it was temporarily granted
    if (chatLocked && chatAccessGranted) {
      try {
        await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/reset-access`, {
          method: 'PATCH',
          body: JSON.stringify({})
        });
        setChatAccessGranted(false);
        
        // Update appt prop reference to stay synced
        const isBuyer = appt.buyerId?._id === currentUser._id || appt.buyerId === currentUser._id;
        if (isBuyer) {
          appt.buyerChatAccessGranted = false;
        } else {
          appt.sellerChatAccessGranted = false;
        }
      } catch (err) {
        console.error('Error resetting chat access:', err);
      }
    }
  };

  // Fetch chat lock status when component mounts
  useEffect(() => {
    const fetchChatLockStatus = async () => {
      setChatLockStatusLoading(true);
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/lock-status`);
        if (res.ok) {
          const data = await res.json();
          setChatLocked(data.chatLocked);
          setChatAccessGranted(data.accessGranted);
          
          // Update appt prop reference to stay synced
          const isBuyer = appt.buyerId?._id === currentUser._id || appt.buyerId === currentUser._id;
          if (isBuyer) {
            appt.buyerChatLocked = data.chatLocked;
            appt.buyerChatAccessGranted = data.accessGranted;
          } else {
            appt.sellerChatLocked = data.chatLocked;
            appt.sellerChatAccessGranted = data.accessGranted;
          }
        }
      } catch (err) {
        console.error('Error fetching chat lock status:', err);
      } finally {
        setChatLockStatusLoading(false);
      }
    };

    fetchChatLockStatus();
  }, [appt._id]);

  // Initialize starred messages when comments are loaded
  useEffect(() => {
    if (comments.length > 0) {
      const starredMsgs = comments.filter(c => c.starredBy && c.starredBy.includes(currentUser._id));
      setStarredMessages(starredMsgs);
    }
  }, [comments, currentUser._id]);

  // Initialize pinned messages when comments are loaded
  useEffect(() => {
    if (comments.length > 0) {
      const now = new Date();
      const pinnedMsgs = comments.filter(c => {
        if (!c.pinned || !c.pinExpiresAt) return false;
        // Ensure pinExpiresAt is a Date object
        const expiryDate = new Date(c.pinExpiresAt);
        return expiryDate > now;
      });

      setPinnedMessages(pinnedMsgs);
    }
  }, [comments]);

  // Fetch pinned messages when chat is opened (not on every message)
  useEffect(() => {
    if (showChatModal && appt?._id && navigator.onLine) {
      fetchPinnedMessages();
    }
  }, [showChatModal, appt._id]);

  // Auto-close shortcut tip after 10 seconds
  useEffect(() => {
    if (showShortcutTip) {
      const timer = setTimeout(() => setShowShortcutTip(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [showShortcutTip]);

  // Function to fetch starred messages
  const fetchStarredMessages = async () => {
    if (!appt?._id) return;

    setLoadingStarredMessages(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/starred-messages`);
      if (!res.ok) throw new Error('Failed to fetch starred messages');
      const data = await res.json();
      if (data.starredMessages) {
        setStarredMessages(data.starredMessages);
      }
    } catch (err) {
      console.error('Error fetching starred messages:', err);
      toast.error('Failed to load starred messages');
    } finally {
      setLoadingStarredMessages(false);
    }
  };

  // Fetch starred messages when modal opens
  useEffect(() => {
    if (showStarredModal) {
      fetchStarredMessages();
    }
  }, [showStarredModal, appt._id]);

  // Function to remove all starred messages
  const handleRemoveAllStarredMessages = async () => {
    if (starredMessages.length === 0) return;

    const messageCount = starredMessages.length; // Store count before clearing
    setRemovingAllStarred(true);

    try {
      console.log('Starting remove all starred messages operation for', starredMessages.length, 'messages');

      // Process messages one by one to handle individual failures gracefully
      let successCount = 0;
      let failureCount = 0;
      const failedMessages = [];

      for (const message of starredMessages) {
        try {
          console.log(`Unstarring message ${message._id}`);

          const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${message._id}/star`, {
            method: 'PATCH',
            body: JSON.stringify({ starred: false })
          });
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw { response: { status: res.status, data: errorData } };
          }
          const response = { status: 200 };

          console.log(`Successfully unstarred message ${message._id}`);
          successCount++;

          // Update this specific message in comments
          setComments(prev => prev.map(c =>
            c._id === message._id
              ? { ...c, starredBy: (c.starredBy || []).filter(id => id !== currentUser._id) }
              : c
          ));

        } catch (err) {
          console.error(`Failed to unstar message ${message._id}:`, err);
          failureCount++;
          failedMessages.push(message);
        }
      }

      console.log(`Remove all operation completed: ${successCount} successful, ${failureCount} failed`);

      // Remove successfully unstarred messages from starred messages list
      setStarredMessages(prev => prev.filter(msg => !failedMessages.some(failed => failed._id === msg._id)));

      // Show appropriate feedback
      if (successCount > 0 && failureCount === 0) {
        toast.success(`Successfully removed ${successCount} starred message${successCount !== 1 ? 's' : ''}`);
        // Close the modal only if all messages were processed successfully
        setShowStarredModal(false);
      } else if (successCount > 0 && failureCount > 0) {
        toast.warning(`Partially successful: ${successCount} messages unstarred, ${failureCount} failed`);
      } else {
        toast.error(`Failed to unstar any messages. Please try again.`);
      }

    } catch (err) {
      console.error('Error removing all starred messages:', err);
      toast.error('Failed to remove all starred messages. Please try again.');
    } finally {
      setRemovingAllStarred(false);
    }
  };

  // Close chat options menu when clicking outside or scrolling
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showChatOptionsMenu && !event.target.closest('.chat-options-menu')) {
        setShowChatOptionsMenu(false);
      }
      if (showHeaderMoreMenu && !event.target.closest('.chat-options-menu')) {
        setShowHeaderMoreMenu(false);
      }
      if (showReactionsBar && !event.target.closest('.reactions-bar')) {
        setShowReactionsBar(false);
        setReactionsMessageId(null);
        // Don't close quick reactions model on click outside - only close reaction bar
      }

    };

    const handleScroll = () => {
      if (showChatOptionsMenu) {
        setShowChatOptionsMenu(false);
      }
      if (showHeaderMoreMenu) {
        setShowHeaderMoreMenu(false);
      }
      if (showReactionsBar && !showReactionsEmojiPicker) {
        setShowReactionsBar(false);
        setReactionsMessageId(null);
      }
      // Don't close quick reactions model on scroll - only close reaction bar
    };

    // Close search box when clicking outside
    const handleSearchClickOutside = (event) => {
      if (showSearchBox && !event.target.closest('.search-container') && !event.target.closest('.enhanced-search-header')) {
        setShowSearchBox(false);
        setSearchQuery("");
        setSearchResults([]);
        setCurrentSearchIndex(-1);
      }
    };

    // Close calendar when clicking outside
    const handleCalendarClickOutside = (event) => {
      if (showCalendar && !event.target.closest('.calendar-container')) {
        setShowCalendar(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('mousedown', handleSearchClickOutside);
    document.addEventListener('mousedown', handleCalendarClickOutside);
    document.addEventListener('scroll', handleScroll, true); // Use capture phase to catch all scroll events

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('mousedown', handleSearchClickOutside);
      document.removeEventListener('mousedown', handleCalendarClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [showChatOptionsMenu, showHeaderMoreMenu, showSearchBox, showCalendar, showReactionsBar, showReactionsEmojiPicker]);

  // Reset send icon animation after completion
  useEffect(() => {
    if (sendIconAnimating) {
      const timer = setTimeout(() => {
        setSendIconAnimating(false);
        setSendIconSent(true);
        // Reset sent state after showing success animation
        const sentTimer = setTimeout(() => setSendIconSent(false), 1000);
        return () => clearTimeout(sentTimer);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [sendIconAnimating]);

  // Handle search result navigation
  useEffect(() => {
    if (currentSearchIndex >= 0 && searchResults[currentSearchIndex]) {
      scrollToSearchResult(searchResults[currentSearchIndex]._id);
    }
  }, [currentSearchIndex, searchResults]);

  // Increase visible messages when scrolled to top (lazy loading)
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const onScrollTopLoadMore = () => {
      if (container.scrollTop <= 30 && comments.length > visibleCount && !loadingOlderRef.current) {
        loadingOlderRef.current = true;
        setIsLoadingOlderMessages(true);
        const prevHeight = container.scrollHeight;
        // Small delay to show spinner before rendering more items
        setTimeout(() => {
          setVisibleCount(prev => Math.min(prev + MESSAGES_PAGE_SIZE, comments.length));
          // Maintain scroll position after increasing items
          requestAnimationFrame(() => {
            const newHeight = container.scrollHeight;
            container.scrollTop = newHeight - prevHeight;
            setIsLoadingOlderMessages(false);
            // Debounce: prevent rapid consecutive loads
            setTimeout(() => {
              loadingOlderRef.current = false;
            }, 300);
          });
        }, 150);
      }
    };
    container.addEventListener('scroll', onScrollTopLoadMore);
    return () => container.removeEventListener('scroll', onScrollTopLoadMore);
  }, [comments.length, visibleCount]);

  // Reset visible count when opening chat or comments change drastically
  useEffect(() => {
    if (!showChatModal) return;
    // Ensure at least unread messages are visible when opening
    const computedUnread = comments.filter(c =>
      c.senderEmail !== currentUser.email &&
      (!c.readBy || !c.readBy.includes(currentUser._id))
    ).length;
    const shouldPreferUnread = preferUnreadOnOpen || (preferUnreadForAppointmentId === appt._id);
    const unreadToUse = shouldPreferUnread ? (unreadNewMessages || computedUnread) : unreadNewMessages;
    if (unreadToUse > 0) {
      setVisibleCount(prev => Math.max(MESSAGES_PAGE_SIZE, unreadNewMessages + 5));
      // After next paint, scroll to first unread message instead of bottom
      setTimeout(() => {
        const targetIndex = Math.max(0, filteredComments.length - unreadToUse);
        const targetMsg = filteredComments[targetIndex];
        if (targetMsg && messageRefs.current[targetMsg._id]) {
          try {
            messageRefs.current[targetMsg._id].scrollIntoView({ behavior: 'auto', block: 'center' });
          } catch (_) { }
        }
        // Show divider only on open case
        setShowUnreadDividerOnOpen(true);
        setPreferUnreadOnOpen(false);
        if (preferUnreadForAppointmentId === appt._id) setPreferUnreadForAppointmentId(null);
      }, 50);
    } else {
      // No unread -> go to bottom as usual
      setVisibleCount(MESSAGES_PAGE_SIZE);
      setTimeout(() => scrollToBottom(), 0);
    }
  }, [appt._id, showChatModal]);

  // Hide the one-time unread divider on first user scroll
  useEffect(() => {
    if (!showChatModal) return;
    const container = chatContainerRef.current;
    if (!container) return;
    const handleAnyScroll = () => {
      if (showUnreadDividerOnOpen) setShowUnreadDividerOnOpen(false);
    };
    container.addEventListener('scroll', handleAnyScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleAnyScroll);
  }, [showChatModal, showUnreadDividerOnOpen]);

  // Removed handleClickOutside functionality - options now only close when clicking three dots again

  // Store locally removed deleted message IDs per appointment (move inside AppointmentRow)
  function getLocallyRemovedIds(apptId) {
    try {
      return JSON.parse(localStorage.getItem(`removedDeletedMsgs_${apptId}`)) || [];
    } catch {
      return [];
    }
  }
  function addLocallyRemovedId(apptId, msgId) {
    const ids = getLocallyRemovedIds(apptId);
    if (!ids.includes(msgId)) {
      const updated = [...ids, msgId];
      localStorage.setItem(`removedDeletedMsgs_${apptId}`, JSON.stringify(updated));
    }
  }

  // Undo functionality for messages deleted for me
  const handleUndoDelete = async () => {
    if (recentlyDeletedMessage) {
      // Support both single message and array of messages
      const messagesToRestore = Array.isArray(recentlyDeletedMessage)
        ? recentlyDeletedMessage
        : [recentlyDeletedMessage];

      // Remove from locally removed IDs
      const localIds = getLocallyRemovedIds(appt._id);
      const restoreIds = messagesToRestore.map(m => m._id);
      const updatedIds = localIds.filter(id => !restoreIds.includes(id));
      localStorage.setItem(`removedDeletedMsgs_${appt._id}`, JSON.stringify(updatedIds));

      // Call backend to actually undo the remove-for-me
      try {
        if (messagesToRestore.length === 1) {
          // Single message undo
          await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${messagesToRestore[0]._id}/undo-remove-for-me`, {
            method: 'PATCH',
            body: JSON.stringify({})
          });
        } else {
          // Bulk undo
          await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/removed/undo-sync`, {
            method: 'POST',
            body: JSON.stringify({ removedIds: restoreIds })
          });
        }
      } catch (err) {
        console.error('Failed to undo remove-for-me on server:', err);
        // Still restore locally even if server call fails
      }

      // Flag to prevent restored messages from being treated as new (unread count / auto-scroll)
      isRestoringMessagesRef.current = true;

      // Find the correct position to insert all messages back
      setComments(prev => {
        const newComments = [...prev];
        for (const msg of messagesToRestore) {
          // Skip if already in comments (prevent duplicates)
          if (newComments.some(c => c._id === msg._id)) continue;
          const insertIndex = newComments.findIndex(existing =>
            new Date(existing.timestamp) > new Date(msg.timestamp)
          );
          if (insertIndex === -1) {
            newComments.push(msg);
          } else {
            newComments.splice(insertIndex, 0, msg);
          }
        }
        return newComments;
      });

      // Reset the flag after React processes the state update
      setTimeout(() => { isRestoringMessagesRef.current = false; }, 0);

      // Clear the undo state
      setRecentlyDeletedMessage(null);
      if (undoTimer) {
        clearTimeout(undoTimer);
        setUndoTimer(null);
      }

      const count = messagesToRestore.length;
      toast.success(count === 1 ? 'Message restored!' : `${count} messages restored!`);
    }
  };

  const startUndoTimer = (messageOrMessages) => {
    // Clear any existing timer
    if (undoTimer) {
      clearTimeout(undoTimer);
    }

    // Set the recently deleted message(s) - supports single or array
    setRecentlyDeletedMessage(messageOrMessages);

    // Start 5 second timer
    const timer = setTimeout(() => {
      setRecentlyDeletedMessage(null);
      setUndoTimer(null);
    }, 5000);

    setUndoTimer(timer);
  };
  // Fetch latest comments when refresh button is clicked
  const fetchLatestComments = async () => {
    try {
      setLoadingComments(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}`);
      if (!res.ok) throw new Error('Failed to fetch comments');
      const data = await res.json();
      if (data.comments) {
        // Merge server comments with local temp messages to prevent re-entry
        setComments(prev => {
          const serverCommentIds = new Set(data.comments.map(c => c._id));
          const localTempMessages = prev.filter(c => c._id.startsWith('temp-'));

          // Combine server comments with local temp messages
          const mergedComments = [...data.comments];

          // Add back any local temp messages that haven't been confirmed yet
          localTempMessages.forEach(tempMsg => {
            if (!serverCommentIds.has(tempMsg._id)) {
              mergedComments.push(tempMsg);
            }
          });

          return mergedComments;
        });
        setUnreadNewMessages(0); // Reset unread count after refresh

        // Don't auto-scroll to bottom - retain current scroll position

        // Show success toast notification
        toast.success('Messages refreshed successfully!', {
          autoClose: 2000,
          position: 'top-center'
        });
      }
    } catch (err) {
      console.error('Error fetching latest comments:', err);
      toast.error('Failed to refresh messages');
    } finally {
      setLoadingComments(false);
    }
  };

  // Fetch pinned messages from backend
  const fetchPinnedMessages = async () => {
    if (!appt?._id) return;

    setLoadingPinnedMessages(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/pinned-messages`);
      if (!res.ok) throw new Error('Failed to fetch pinned messages');
      const data = await res.json();
      setPinnedMessages(data.pinnedMessages || []);
    } catch (err) {
      toast.error('Failed to fetch pinned messages');
    } finally {
      setLoadingPinnedMessages(false);
    }
  };
  // Pin/unpin a message
  const handlePinMessage = async (message, pinned, duration = '24hrs', customHrs = 24) => {
    if (!appt?._id) return;

    setPinningSaving(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${message._id}/pin`, {
        method: 'PATCH',
        body: JSON.stringify({
          pinned,
          pinDuration: duration,
          customHours: duration === 'custom' ? customHrs : undefined
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();

      // Update the local state
      setComments(prev => prev.map(c =>
        c._id === message._id
          ? {
            ...c,
            pinned: data.pinned,
            pinnedBy: data.pinned ? currentUser._id : null,
            pinnedAt: data.pinned ? new Date() : null,
            pinExpiresAt: data.pinned ? new Date(data.pinExpiresAt) : null,
            pinDuration: data.pinned ? duration : null
          }
          : c
      ));

      // Update pinned messages list
      if (pinned) {
        // Add to pinned messages
        const pinnedMsg = {
          ...message,
          pinned: true,
          pinnedBy: currentUser._id,
          pinnedAt: new Date(),
          pinExpiresAt: new Date(data.pinExpiresAt),
          pinDuration: duration
        };
        setPinnedMessages(prev => {
          const newPinned = [...prev, pinnedMsg];
          return newPinned;
        });
      } else {
        // Remove from pinned messages
        setPinnedMessages(prev => prev.filter(m => m._id !== message._id));
      }

      toast.success(data.message);
      setShowPinModal(false);
      setMessageToPin(null);
    } catch (err) {
      toast.error('Failed to update pin status');
    } finally {
      setPinningSaving(false);
    }
  };



  const isAdmin = (currentUser.role === 'admin' || currentUser.role === 'rootadmin') && currentUser.adminApprovalStatus === 'approved';
  const isAdminContext = location.pathname.includes('/admin');
  const isSeller = appt.role === 'seller';
  const isBuyer = appt.role === 'buyer';

  // Add function to check if appointment is upcoming
  const isUpcoming = new Date(appt.date) > new Date() || (new Date(appt.date).toDateString() === new Date().toDateString() && (!appt.time || appt.time > new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })));

  const frozenStatuses = ['rejected', 'cancelledByAdmin', 'cancelledByBuyer', 'cancelledBySeller', 'deletedByAdmin'];
  const hasMoveOutCompleted =
    appt.purpose === 'rent' &&
    ['move_out_pending', 'completed', 'terminated'].includes(appt.rentalStatus);

  // Chat availability: allow outdated sales & rentals until move-out is completed (Modified to allow paid accepted/outdated)
  const isChatSendBlocked =
    ((appt.status === 'accepted' || appt.status === 'outdated') && appt.paymentConfirmed)
      ? false
      : (frozenStatuses.includes(appt.status) ||
        (appt.purpose === 'rent' ? (!isUpcoming && hasMoveOutCompleted) : false));

  // Status indicators: hide for pending and frozen appointments
  const isStatusHidden = appt.status === 'pending' || appt.status === 'rejected' || appt.status === 'cancelledByAdmin' || appt.status === 'cancelledByBuyer' || appt.status === 'cancelledBySeller' || appt.status === 'deletedByAdmin';

  const otherParty = isSeller ? appt.buyerId : appt.sellerId;

  const canSeeContactInfo = (isAdmin || appt.status === 'accepted') && isUpcoming &&
    appt.status !== 'cancelledByBuyer' && appt.status !== 'cancelledBySeller' &&
    appt.status !== 'cancelledByAdmin' && appt.status !== 'rejected' &&
    appt.status !== 'deletedByAdmin' &&
    ['public', 'friends'].includes(otherParty?.profileVisibility);

  // Handle delete confirmation modal
  const handleDeleteClick = (message) => {
    setMessageToDelete(message);
    setDeleteForBoth(isChatSendBlocked ? false : true); // Default to delete for both, but false for frozen chat
    setShowDeleteModal(true);
  };

  // Handle delete click for received messages (from other users)
  const handleDeleteReceivedMessage = (message) => {
    setMessageToDelete(message);
    setDeleteForBoth(false); // For received messages, only delete locally
    setShowDeleteModal(true);
  };
  const handleConfirmDelete = async () => {
    if (!messageToDelete) return;

    try {
      setDeleteMessageLoading(true);
      // Handle call deletion (calls are stored in DB, we just remove from local display)
      if (messageToDelete.isCall || (messageToDelete._id && messageToDelete._id.startsWith('call-'))) {
        const callToDelete = messageToDelete.call || messageToDelete;
        const callId = callToDelete._id || callToDelete.callId;

        // Add to locally removed IDs to persist deletion
        addLocallyRemovedId(appt._id, callId);

        setCallHistory(prev => prev.filter(call =>
          (call._id || call.callId) !== callId
        ));
        toast.success('Call removed from chat');
        return;
      }

      // Multi-select branch
      if (Array.isArray(messageToDelete)) {
        const ids = messageToDelete.map(m => m._id);
        if (deleteForBoth) {
          const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/bulk-delete`, {
            method: 'DELETE',
            body: JSON.stringify({ commentIds: ids })
          });
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw { response: { status: res.status, data: errorData } };
          }
          const data = await res.json();
          if (data?.comments) {
            setComments(prev => data.comments.map(newC => {
              const localC = prev.find(lc => lc._id === newC._id);
              if (localC && localC.status === 'read' && newC.status !== 'read') {
                return { ...newC, status: 'read' };
              }
              return newC;
            }));
          }
          toast.success(`Deleted ${ids.length} messages for everyone!`);
        } else {
          const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/removed/sync`, {
            method: 'POST',
            body: JSON.stringify({ removedIds: ids })
          });
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw { response: { status: res.status, data: errorData } };
          }
          setComments(prev => prev.filter(msg => !ids.includes(msg._id)));
          ids.forEach(cid => addLocallyRemovedId(appt._id, cid));

          // Start undo timer for ALL deleted messages (supports bulk undo)
          if (messageToDelete.length > 0) {
            startUndoTimer(messageToDelete);
          }

          toast.success(`Deleted ${ids.length} messages for you!`);
        }
      } else if (deleteForBoth) {
        // Single delete for everyone
        const wasUnread = !messageToDelete.readBy?.includes(currentUser._id) &&
          messageToDelete.senderEmail !== currentUser.email;
        const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${messageToDelete._id}`, {
          method: 'DELETE'
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw { response: { status: res.status, data: errorData } };
        }
        const data = await res.json();
        setComments(prev => data.comments.map(newC => {
          const localC = prev.find(lc => lc._id === newC._id);
          if (localC && localC.status === 'read' && newC.status !== 'read') {
            return { ...newC, status: 'read' };
          }
          return newC;
        }));
        if (wasUnread) {
          setUnreadNewMessages(prev => Math.max(0, prev - 1));
        }
        toast.success('Message deleted for everyone!');
      } else {
        // Single delete for me
        try {
          await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${messageToDelete._id}/remove-for-me`, {
            method: 'PATCH',
            body: JSON.stringify({})
          });
        } catch { }
        setComments(prev => prev.filter(msg => msg._id !== messageToDelete._id));
        addLocallyRemovedId(appt._id, messageToDelete._id);

        // Start undo timer for messages deleted for me
        startUndoTimer(messageToDelete);

        toast.success('Message deleted for you!');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setDeleteMessageLoading(false);
      setShowDeleteModal(false);
      setMessageToDelete(null);
      setDeleteForBoth(true);
    }
  };

  const handleClearChat = async () => {
    try {
      setClearChatLoading(true);
      // Optimistically update local storage and UI
      const now = Date.now();
      localStorage.setItem(clearTimeKey, now);
      setComments([]);
      setCallHistory([]); // Also clear call history bubbles when clearing chat

      // Persist to server so it applies across devices for this user
      await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/clear-local`, {
        method: 'PATCH',
        body: JSON.stringify({})
      });

      toast.success("Chat Cleared.");
    } catch (err) {
      console.error('Failed to persist chat clear:', err);
      toast.error(err.response?.data?.message || 'Cleared locally, but failed to sync with server.');
    } finally {
      setClearChatLoading(false);
      setShowClearChatModal(false);
    }
  };

  const showMessageInfo = (message) => {
    setSelectedMessageForInfo(message);
    setShowMessageInfoModal(true);
  };
  const handleCommentSend = async () => {
    if (!comment.trim()) return;
    if (isChatSendBlocked) {
      toast.info('Sending disabled for this appointment status. You can view chat history.');
      return;
    }
    // Close emoji picker on send
    window.dispatchEvent(new Event('closeEmojiPicker'));

    // Trigger send icon animation
    setSendIconAnimating(true);

    // Store the message content and reply before clearing the input
    const messageContent = comment.trim();
    const replyToData = replyTo;

    // Store original replyTo for display purposes (even if it's a call)
    const originalReplyToId = replyToData ? replyToData._id : null;

    // Create a temporary message object with immediate display
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      _id: tempId,
      sender: currentUser._id,
      senderEmail: currentUser.email,
      senderName: currentUser.username,
      message: messageContent,
      status: "sending",
      timestamp: new Date().toISOString(),
      readBy: [currentUser._id],
      previewDismissed: previewDismissed,
      // Always store the original replyTo ID for display (even if it's a call)
      ...(originalReplyToId ? { replyTo: originalReplyToId } : {}),
    };

    // Immediately update UI - this makes the message appear instantly
    setComments(prev => [...prev, tempMessage]);
    setComment("");
    try {
      const draftKey = `appt_draft_${appt._id}_${currentUser._id}`;
      localStorage.removeItem(draftKey);
      // Clear backend draft
      authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/draft`, {
        method: 'PATCH',
        body: JSON.stringify({ draft: "" })
      }).catch(err => console.error('Failed to clear backend draft:', err));
    } catch (_) { }
    setDetectedUrl(null);
    setPreviewDismissed(false);
    setLastDismissedUrl(null);
    setReplyTo(null);
    // Reset textarea height to normal after sending
    resetTextareaHeight();
    // Remove the global sending state to allow multiple messages
    // setSending(true);

    // Re-focus input after sending to keep mobile keyboard open
    if (inputRef.current) {
      inputRef.current.focus();
    }

    // Scroll to bottom after React renders the new message
    setTimeout(() => {
      if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);

    // Send message in background without blocking UI
    (async () => {
      // Check if replyTo is a call (starts with "call-") - if so, don't send replyTo as backend can't validate call IDs
      // Declared OUTSIDE try so it's accessible in the catch block for queuing
      const replyToId = replyToData && !replyToData._id?.startsWith('call-') ? replyToData._id : null;

      try {

        const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, {
          method: 'POST',
          body: JSON.stringify({
            message: messageContent,
            ...(replyToId ? { replyTo: replyToId } : {}),
            ...(previewDismissed ? { previewDismissed: true } : {})
          })
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw { response: { status: res.status, data: errorData } };
        }
        const data = await res.json();

        // Find the new comment from the response
        const newComment = data.comments[data.comments.length - 1];

        // Update only the status and ID of the temp message, keeping it visible
        // Preserve replyTo if it was a call (not sent to backend but stored locally)
        // Track this ID so socket handler won't add a duplicate
        recentlySentIdsRef.current.add(newComment._id);
        setTimeout(() => recentlySentIdsRef.current.delete(newComment._id), 10000);

        setComments(prev => prev.map(msg =>
          msg._id === tempId
            ? {
              ...msg,
              _id: newComment._id,
              status: newComment.status,
              readBy: newComment.readBy || msg.readBy,
              timestamp: newComment.timestamp || msg.timestamp,
              // Preserve original replyTo if it was a call (backend won't return it)
              replyTo: originalReplyToId || newComment.replyTo || msg.replyTo
            }
            : msg
        ));

        // Don't show success toast as it's too verbose for chat
        if (settings.soundEnabled) {
          playMessageSent(); // Play send sound
        }
      } catch (err) {
        // Queue message if it's a network error or offline
        const isNetworkError = !navigator.onLine || err.message === 'Failed to fetch' || err.name === 'TypeError';
        if (isNetworkError) {
          // Keep message in UI but show as queued
          setComments(prev => prev.map(msg =>
            msg._id === tempId ? { ...msg, status: 'queued' } : msg
          ));
          const queueItem = {
            tempId,
            type: 'text',
            originalReplyToId,
            payload: {
              message: messageContent,
              ...(replyToId ? { replyTo: replyToId } : {}),
              ...(previewDismissed ? { previewDismissed: true } : {})
            },
            tempMessage: { ...tempMessage, status: 'queued' }
          };
          messageQueueRef.current.push(queueItem);
          persistQueue(messageQueueRef.current);
        } else {
          // For other errors (validation, blocked), remove and show error
          setComments(prev => prev.filter(msg => msg._id !== tempId));
          toast.error(err.response?.data?.message || 'An error occurred. Please try again.');
        }
      }
    })();
  };

  const handleEditComment = async (commentId) => {
    if (!editText.trim()) return;

    setSavingComment(commentId);

    // Optimistic update - update UI immediately
    const optimisticUpdate = prev => prev.map(c =>
      c._id === commentId
        ? { ...c, message: editText, edited: true, editedAt: new Date() }
        : c
    );
    setComments(optimisticUpdate);

    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${commentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ message: editText })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      // Update with server response - simpler and faster approach
      setComments(prev => prev.map(c => {
        const serverComment = data.comments.find(sc => sc._id === c._id);
        if (serverComment) {
          // For the edited message, use server data
          if (serverComment._id === commentId) {
            return serverComment;
          }
          // For other messages, preserve local read status if it exists
          return c.status === 'read' && serverComment.status !== 'read'
            ? { ...serverComment, status: 'read' }
            : serverComment;
        }
        return c;
      }));
      setEditingComment(null);
      setEditText("");
      // Restore original draft and clear it after a small delay to ensure state update
      const draftToRestore = originalDraft;
      setComment(draftToRestore);
      setTimeout(() => {
        setOriginalDraft(""); // Clear stored draft after restoration
      }, 100);
      setDetectedUrl(null);
      setPreviewDismissed(false);
      setLastDismissedUrl(null);
      // Auto-resize textarea for restored draft
      setTimeout(() => {
        if (inputRef.current) {
          // Force a re-render by triggering the input event
          const event = new Event('input', { bubbles: true });
          inputRef.current.dispatchEvent(event);
          autoResizeTextarea(inputRef.current);
        }
      }, 50);

      // Removed auto-focus: Don't automatically focus input after editing
      // User can manually click to focus when needed

      toast.success("Message edited successfully!");
    } catch (err) {
      // Revert optimistic update on error
      setComments(prev => prev.map(c =>
        c._id === commentId
          ? { ...c, message: c.originalMessage || c.message, edited: c.wasEdited || false }
          : c
      ));
      setEditingComment(commentId);
      setEditText(editText);
      setComment(editText); // Restore the text in main input for retry
      toast.error(err.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setSavingComment(null);
    }
  };

  const startEditing = (message) => {
    // Store the current draft before starting edit
    setOriginalDraft(comment);
    setEditingComment(message._id);
    setEditText(message.message);
    setComment(message.message); // Set the message in the main input
    // Store original data for potential rollback
    setComments(prev => prev.map(c =>
      c._id === message._id
        ? { ...c, originalMessage: c.message, wasEdited: c.edited }
        : c
    ));
    // Focus the main input without selecting text
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        // Place cursor at end of text instead of selecting all
        const length = inputRef.current.value.length;
        inputRef.current.setSelectionRange(length, length);

        // Auto-resize textarea for edited content
        autoResizeTextarea(inputRef.current);
      }
    }, 100);
  };

  // Utility function to auto-resize textarea with scrolling support
  const autoResizeTextarea = (textarea) => {
    if (textarea) {
      textarea.style.height = '48px';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 144;

      if (scrollHeight <= maxHeight) {
        // If content fits within max height, expand the textarea
        textarea.style.height = scrollHeight + 'px';
        textarea.style.overflowY = 'hidden';
      } else {
        // If content exceeds max height, set to max height and enable scrolling
        textarea.style.height = maxHeight + 'px';
        textarea.style.overflowY = 'auto';
      }
    }
  };

  // Function to reset textarea to normal height
  const resetTextareaHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = '48px';
      inputRef.current.style.overflowY = 'hidden';
    }
  };

  const startReply = (comment) => {
    setReplyTo(comment);
    // Focus the main input with comprehensive focus handling
    const refocusInput = () => {
      if (inputRef.current) {
        inputRef.current.focus();
        // Place cursor at end of text instead of start
        const length = inputRef.current.value.length;
        inputRef.current.setSelectionRange(length, length);
        // Force the input to be the active element
        if (document.activeElement !== inputRef.current) {
          inputRef.current.click();
          inputRef.current.focus();
        }
        // Auto-resize textarea
        autoResizeTextarea(inputRef.current);
      }
    };

    // Removed auto-focus: Don't automatically focus input
    // User can manually click to focus when needed
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-700";
      case "accepted": return "bg-green-100 text-green-700";
      case "rejected": return "bg-red-100 text-red-700";
      case "cancelledByBuyer": return "bg-orange-100 text-orange-700";
      case "cancelledBySeller": return "bg-pink-100 text-pink-700";
      case "cancelledByAdmin": return "bg-purple-100 text-purple-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  // Function to highlight searched text within message content
  const highlightSearchedText = (text, searchQuery) => {
    if (!searchQuery || !text) return text;

    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (regex.test(part)) {
        return `<span class="search-text-highlight">${part}</span>`;
      }
      return part;
    }).join('');
  };

  // Search functionality
  const performSearch = (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      // Clear any existing search highlights
      document.querySelectorAll('.search-highlight').forEach(el => {
        el.classList.remove('search-highlight', 'search-pulse', 'search-glow');
      });
      // Clear any existing text highlights
      document.querySelectorAll('.search-text-highlight').forEach(el => {
        el.outerHTML = el.innerHTML;
      });
      return;
    }

    // Get filtered comments (only visible messages)
    const filteredComments = comments.filter(c => {
      const clearTime = c.clearTime || 0;
      const effectiveClearMs = Math.max(clearTime, 0);
      return new Date(c.timestamp).getTime() > effectiveClearMs &&
        !locallyRemovedIds.includes(c._id) &&
        !(c.removedFor?.includes?.(currentUser._id));
    });

    const results = filteredComments
      .filter(comment => !comment.deleted)
      .filter(comment =>
        comment.message.toLowerCase().includes(query.toLowerCase()) ||
        comment.senderName?.toLowerCase().includes(query.toLowerCase()) ||
        comment.senderEmail?.toLowerCase().includes(query.toLowerCase())
      )
      .map(comment => ({
        ...comment,
        matchIndex: comment.message.toLowerCase().indexOf(query.toLowerCase())
      }));

    setSearchResults(results);

    // Auto-scroll to first result if results found
    if (results.length > 0) {
      setCurrentSearchIndex(0);
      // Small delay to ensure state is updated before scrolling
      setTimeout(() => {
        scrollToSearchResult(results[0]._id);
      }, 100);
    } else {
      setCurrentSearchIndex(-1);
    }
  };

  const handleSearchInputChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    performSearch(query);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0) {
        // Navigate to next result
        setCurrentSearchIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'Escape') {
      setShowSearchBox(false);
      setSearchQuery("");
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      // Clear any existing text highlights
      document.querySelectorAll('.search-text-highlight').forEach(el => {
        el.outerHTML = el.innerHTML;
      });
    }
  };

  // Helper: scroll to a message by ID, auto-expanding visibleCount if needed
  const scrollToMessageById = (messageId, highlightClass = 'search-highlight') => {
    // Check if message is in filteredComments (the full list)
    const msgIndex = filteredComments.findIndex(c => c._id === messageId);
    if (msgIndex === -1) return; // message not found at all

    // Calculate how many items from the END (since we slice from the end)
    const totalItems = filteredComments.length;
    const fromEnd = totalItems - msgIndex; // how far from the end this message is

    // If the message is outside the currently visible window, expand visibleCount
    if (fromEnd > visibleCount) {
      // Expand to include this message plus some buffer
      setVisibleCount(Math.min(fromEnd + 10, totalItems));
    }

    // Wait for DOM to update with expanded items, then scroll
    setTimeout(() => {
      const el = messageRefs.current[messageId] || document.querySelector(`[data-message-id="${messageId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add(highlightClass);
        setTimeout(() => {
          el.classList.remove(highlightClass);
        }, 2500);
      }
    }, 100);
  };

  const scrollToSearchResult = (commentId) => {
    const messageElement = messageRefs.current[commentId];
    // If element isn't in DOM yet, expand visibleCount
    if (!messageElement) {
      scrollToMessageById(commentId, 'search-highlight');
      return;
    }

    // Enhanced scroll animation with better timing
    messageElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    });

    // Enhanced search highlight animation with multiple effects
    setTimeout(() => {
      // Remove any existing highlights first
      document.querySelectorAll('.search-highlight').forEach(el => {
        el.classList.remove('search-highlight', 'search-pulse', 'search-glow');
      });

      // Add enhanced search highlight with multiple animation classes
      messageElement.classList.add('search-highlight', 'search-pulse', 'search-glow');

      // Add a search ripple effect
      const ripple = document.createElement('div');
      ripple.className = 'search-ripple';
      messageElement.style.position = 'relative';
      messageElement.appendChild(ripple);

      // Remove ripple after animation
      setTimeout(() => {
        if (ripple.parentNode) {
          ripple.parentNode.removeChild(ripple);
        }
      }, 1000);

      // Remove highlight effects after enhanced duration
      setTimeout(() => {
        messageElement.classList.remove('search-highlight', 'search-pulse', 'search-glow');
      }, 3000);
    }, 300);
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setShowCalendar(false);

    // Get filtered comments (only visible messages)
    const filteredComments = comments.filter(c => {
      const clearTime = c.clearTime || 0;
      const effectiveClearMs = Math.max(clearTime, 0);
      return new Date(c.timestamp).getTime() > effectiveClearMs &&
        !locallyRemovedIds.includes(c._id) &&
        !(c.removedFor?.includes?.(currentUser._id));
    });

    // Find the first message from the selected date
    const targetDate = new Date(date);
    const targetDateString = targetDate.toDateString();

    const firstMessageOfDate = filteredComments.find(comment => {
      const commentDate = new Date(comment.timestamp);
      return commentDate.toDateString() === targetDateString;
    });

    if (firstMessageOfDate) {
      const messageId = firstMessageOfDate._id;

      // Auto-expand visibleCount if message is outside visible window
      const totalItems = filteredComments.length;
      const msgIndex = filteredComments.findIndex(c => c._id === messageId);
      const fromEnd = totalItems - msgIndex;
      if (fromEnd > visibleCount) {
        setVisibleCount(Math.min(fromEnd + 10, totalItems));
      }

      // Wait for DOM to update, then scroll and apply highlight
      setTimeout(() => {
        const messageElement = messageRefs.current[messageId] || document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
          messageElement.classList.add('date-jump-preparing');
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

          setTimeout(() => {
            messageElement.classList.remove('date-jump-preparing');
            setHighlightedDateMessage(messageId);
            messageElement.classList.add('date-highlight', 'date-jump-pulse');

            const ripple = document.createElement('div');
            ripple.className = 'date-jump-ripple';
            messageElement.style.position = 'relative';
            messageElement.appendChild(ripple);
            setTimeout(() => { if (ripple.parentNode) ripple.parentNode.removeChild(ripple); }, 1000);

            setTimeout(() => {
              messageElement.classList.remove('date-highlight', 'date-jump-pulse');
              setHighlightedDateMessage(null);
            }, 4000);
          }, 500);
        }
      }, 150);
    } else {
      toast.info('No messages found for the selected date in this chat', {
        position: 'top-center',
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  };

  const formatDateForInput = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  // User-side cancel handler (buyer/seller)
  const handleUserCancel = async () => {
    setCancelReason('');
    setShowCancelModal(true);
  };
  const confirmUserCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Reason is required for cancellation.');
      return;
    }
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: cancelReason })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      toast.success('Appointment cancelled successfully.');
      if (typeof onCancelRefresh === 'function') onCancelRefresh(appt._id, isSeller ? 'cancelledBySeller' : 'cancelledByBuyer');
      setShowCancelModal(false);
      setCancelReason('');
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error('Session expired or unauthorized. Please sign in again.');
        navigate('/sign-in');
        return;
      }
      toast.error(err.response?.data?.message || 'An error occurred. Please try again.');
    }
  };

  // Admin-side cancel handler
  const handleAdminCancel = async () => {
    setCancelReason('');
    setShowAdminCancelModal(true);
  };
  const confirmAdminCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Reason is required for admin cancellation.');
      return;
    }
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: cancelReason })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      toast.success('Appointment cancelled by admin.');
      navigate('/user/my-appointments');
      setShowAdminCancelModal(false);
      setCancelReason('');
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error('Session expired or unauthorized. Please sign in again.');
        navigate('/sign-in');
        return;
      }
      toast.error(err.response?.data?.message || 'Failed to cancel appointment.');
    }
  };

  // Add permanent delete for cancelled/deleted appointments (soft delete)
  const handlePermanentDelete = async () => {
    setShowPermanentDeleteModal(true);
  };
  const confirmPermanentDelete = async () => {
    try {
      const who = isBuyer ? 'buyer' : isSeller ? 'seller' : null;
      if (!who) return;
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/soft-delete`, {
        method: 'PATCH',
        body: JSON.stringify({ who })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      // Remove from UI immediately
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('removeAppointmentRow', { detail: appt._id });
        window.dispatchEvent(event);
        toast.success("Appointment removed from your table successfully.");
      }
      setShowPermanentDeleteModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove appointment from table.');
    }
  };

  // Auto-scroll to bottom only when chat modal opens or when user is at bottom
  useEffect(() => {
    if (showChatModal && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showChatModal]);

  // Reactions functions
  const handleQuickReaction = async (messageId, emoji) => {
    if (isChatSendBlocked) {
      toast.info('Reactions disabled for this appointment status. You can view chat history.');
      return;
    }

    try {
      const message = comments.find(c => c._id === messageId);
      if (!message) {
        toast.error('Message not found');
        return;
      }

      // Add reaction to the message
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${messageId}/react`, {
        method: 'PATCH',
        body: JSON.stringify({ emoji })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();

      // Update local state
      setComments(prev => prev.map(c =>
        c._id === messageId
          ? {
            ...c,
            reactions: data.reactions || c.reactions || []
          }
          : c
      ));

      // Close both the quick reactions model and the reactions bar
      setShowReactionsEmojiPicker(false);
      setShowReactionsBar(false);
      setReactionsMessageId(null);

      toast.success('Reaction added!');

    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add reaction');
    }
  };

  const handleReactionsEmojiClick = (emojiString) => {
    if (reactionsMessageId) {
      handleQuickReaction(reactionsMessageId, emojiString);
    }
  };

  const toggleReactionsBar = (messageId) => {
    if (isChatSendBlocked) {
      toast.info('Reactions disabled for this appointment status. You can view chat history.');
      return;
    }

    if (reactionsMessageId === messageId && showReactionsBar) {
      setShowReactionsBar(false);
      setReactionsMessageId(null);
      setShowReactionsEmojiPicker(false);
    } else {
      setReactionsMessageId(messageId);
      setShowReactionsBar(true);
      setShowReactionsEmojiPicker(false);
    }
  };

  const [emojiPickerMode, setEmojiPickerMode] = useState('react'); // 'react' | 'insert'
  const [emojiSearchTerm, setEmojiSearchTerm] = useState('');
  const [reactionEmojiSearchTerm, setReactionEmojiSearchTerm] = useState('');

  // Comprehensive emoji data with keywords for search
  const emojiData = [
    // Smileys & People
    { emoji: '😀', keywords: ['grinning', 'happy', 'smile', 'joy'] },
    { emoji: '😃', keywords: ['grinning', 'happy', 'smile', 'joy', 'smiley'] },
    { emoji: '😄', keywords: ['grinning', 'happy', 'smile', 'joy', 'laugh'] },
    { emoji: '😁', keywords: ['grinning', 'happy', 'smile', 'joy', 'beaming'] },
    { emoji: '😆', keywords: ['grinning', 'happy', 'smile', 'joy', 'laugh', 'squinting'] },
    { emoji: '😅', keywords: ['grinning', 'happy', 'smile', 'sweat', 'relief'] },
    { emoji: '😂', keywords: ['joy', 'laugh', 'tears', 'funny', 'lol', 'crying'] },
    { emoji: '🤣', keywords: ['rolling', 'laugh', 'funny', 'lol', 'rofl'] },
    { emoji: '😊', keywords: ['smiling', 'happy', 'blush', 'smile'] },
    { emoji: '😇', keywords: ['innocent', 'angel', 'halo', 'good'] },
    { emoji: '🙂', keywords: ['slightly', 'smiling', 'happy'] },
    { emoji: '🙃', keywords: ['upside', 'down', 'silly', 'sarcastic'] },
    { emoji: '😉', keywords: ['winking', 'flirt', 'wink'] },
    { emoji: '😌', keywords: ['relieved', 'peaceful', 'calm'] },
    { emoji: '😍', keywords: ['heart', 'eyes', 'love', 'adore', 'crush'] },
    { emoji: '🥰', keywords: ['smiling', 'hearts', 'love', 'adore'] },
    { emoji: '😘', keywords: ['kiss', 'love', 'heart'] },
    { emoji: '😗', keywords: ['kissing', 'kiss'] },
    { emoji: '😙', keywords: ['kissing', 'smiling', 'eyes'] },
    { emoji: '😚', keywords: ['kissing', 'closed', 'eyes'] },
    { emoji: '😋', keywords: ['yummy', 'delicious', 'tongue'] },
    { emoji: '😛', keywords: ['tongue', 'out', 'playful'] },
    { emoji: '😝', keywords: ['tongue', 'winking', 'playful'] },
    { emoji: '😜', keywords: ['tongue', 'winking', 'crazy'] },
    { emoji: '🤪', keywords: ['zany', 'crazy', 'wild'] },
    { emoji: '🤨', keywords: ['raised', 'eyebrow', 'suspicious'] },
    { emoji: '🧐', keywords: ['monocle', 'thinking', 'pondering'] },
    { emoji: '🤓', keywords: ['nerd', 'geek', 'glasses'] },
    { emoji: '😎', keywords: ['cool', 'sunglasses', 'awesome'] },
    { emoji: '🤩', keywords: ['star', 'struck', 'excited'] },
    { emoji: '🥳', keywords: ['party', 'celebration', 'hat'] },
    { emoji: '😏', keywords: ['smirk', 'sly', 'mischievous'] },
    { emoji: '😒', keywords: ['unamused', 'bored', 'meh'] },
    { emoji: '😞', keywords: ['disappointed', 'sad'] },
    { emoji: '😔', keywords: ['pensive', 'sad', 'thoughtful'] },
    { emoji: '😟', keywords: ['worried', 'concerned'] },
    { emoji: '😕', keywords: ['confused', 'slightly', 'frowning'] },
    { emoji: '🙁', keywords: ['slightly', 'frowning', 'sad'] },
    { emoji: '☹️', keywords: ['frowning', 'sad'] },
    { emoji: '😣', keywords: ['persevering', 'struggling'] },
    { emoji: '😖', keywords: ['confounded', 'frustrated'] },
    { emoji: '😫', keywords: ['tired', 'exhausted'] },
    { emoji: '😩', keywords: ['weary', 'tired'] },
    { emoji: '🥺', keywords: ['pleading', 'puppy', 'eyes'] },
    { emoji: '😢', keywords: ['crying', 'sad', 'tear'] },
    { emoji: '😭', keywords: ['loudly', 'crying', 'sad', 'bawling'] },
    { emoji: '😤', keywords: ['huffing', 'angry', 'steam'] },
    { emoji: '😠', keywords: ['angry', 'mad'] },
    { emoji: '😡', keywords: ['pouting', 'angry', 'rage'] },
    { emoji: '🤬', keywords: ['swearing', 'cursing', 'angry'] },
    { emoji: '🤯', keywords: ['exploding', 'head', 'mind', 'blown'] },
    { emoji: '😳', keywords: ['flushed', 'embarrassed'] },
    { emoji: '🥵', keywords: ['hot', 'sweating'] },
    { emoji: '🥶', keywords: ['cold', 'freezing'] },
    { emoji: '😱', keywords: ['screaming', 'fear', 'shocked'] },
    { emoji: '😨', keywords: ['fearful', 'scared'] },
    { emoji: '😰', keywords: ['anxious', 'sweat', 'worried'] },
    { emoji: '😥', keywords: ['sad', 'relieved', 'disappointed'] },
    { emoji: '😓', keywords: ['downcast', 'sweat', 'sad'] },
    { emoji: '🤗', keywords: ['hugging', 'hug', 'embrace'] },
    { emoji: '🤔', keywords: ['thinking', 'pondering'] },
    { emoji: '🤭', keywords: ['hand', 'over', 'mouth', 'giggle'] },
    { emoji: '🤫', keywords: ['shushing', 'quiet', 'secret'] },
    { emoji: '🤥', keywords: ['lying', 'pinocchio'] },
    { emoji: '😶', keywords: ['no', 'mouth', 'speechless'] },
    { emoji: '😐', keywords: ['neutral', 'expressionless'] },
    { emoji: '😑', keywords: ['expressionless', 'blank'] },
    { emoji: '😯', keywords: ['hushed', 'surprised'] },
    { emoji: '😦', keywords: ['frowning', 'open', 'mouth'] },
    { emoji: '😧', keywords: ['anguished', 'shocked'] },
    { emoji: '😮', keywords: ['open', 'mouth', 'surprised', 'wow'] },
    { emoji: '😲', keywords: ['astonished', 'shocked'] },
    { emoji: '🥱', keywords: ['yawning', 'tired', 'sleepy'] },
    { emoji: '😴', keywords: ['sleeping', 'zzz', 'tired'] },
    { emoji: '🤤', keywords: ['drooling', 'sleepy'] },
    { emoji: '😪', keywords: ['sleepy', 'tired'] },
    { emoji: '😵', keywords: ['dizzy', 'confused'] },
    { emoji: '🤐', keywords: ['zipper', 'mouth', 'quiet'] },
    { emoji: '🥴', keywords: ['woozy', 'drunk', 'dizzy'] },
    { emoji: '🤢', keywords: ['nauseated', 'sick'] },
    { emoji: '🤮', keywords: ['vomiting', 'sick'] },
    { emoji: '🤧', keywords: ['sneezing', 'sick'] },
    { emoji: '😷', keywords: ['mask', 'sick', 'medical'] },
    { emoji: '🤒', keywords: ['thermometer', 'sick', 'fever'] },
    { emoji: '🤕', keywords: ['bandage', 'hurt', 'injured'] },
    { emoji: '🤑', keywords: ['money', 'mouth', 'rich'] },
    { emoji: '🤠', keywords: ['cowboy', 'hat'] },
    { emoji: '💀', keywords: ['skull', 'death', 'dead'] },
    { emoji: '👻', keywords: ['ghost', 'spooky'] },
    { emoji: '👽', keywords: ['alien', 'extraterrestrial'] },
    { emoji: '👾', keywords: ['alien', 'monster', 'game'] },
    { emoji: '🤖', keywords: ['robot', 'bot'] },
    { emoji: '😈', keywords: ['smiling', 'devil', 'evil'] },
    { emoji: '👿', keywords: ['angry', 'devil', 'evil'] },
    { emoji: '👹', keywords: ['ogre', 'monster'] },
    { emoji: '👺', keywords: ['goblin', 'monster'] },

    // Gestures & Body Parts
    { emoji: '💪', keywords: ['flexed', 'biceps', 'strong', 'muscle'] },
    { emoji: '🦾', keywords: ['mechanical', 'arm', 'prosthetic'] },
    { emoji: '🦿', keywords: ['mechanical', 'leg', 'prosthetic'] },
    { emoji: '🦵', keywords: ['leg'] },
    { emoji: '🦶', keywords: ['foot'] },
    { emoji: '👂', keywords: ['ear', 'hearing'] },
    { emoji: '🦻', keywords: ['ear', 'hearing', 'aid'] },
    { emoji: '👃', keywords: ['nose', 'smell'] },
    { emoji: '🧠', keywords: ['brain', 'smart'] },
    { emoji: '🫀', keywords: ['heart', 'organ'] },
    { emoji: '🫁', keywords: ['lungs', 'breathing'] },
    { emoji: '🦷', keywords: ['tooth', 'dental'] },
    { emoji: '🦴', keywords: ['bone'] },
    { emoji: '👀', keywords: ['eyes', 'looking', 'watching'] },
    { emoji: '👁️', keywords: ['eye', 'looking'] },
    { emoji: '👅', keywords: ['tongue'] },
    { emoji: '👄', keywords: ['mouth', 'lips'] },
    { emoji: '💋', keywords: ['kiss', 'lips'] },
    { emoji: '🩸', keywords: ['blood', 'drop'] },
    { emoji: '🫂', keywords: ['people', 'hugging', 'hug'] },
    { emoji: '👶', keywords: ['baby', 'infant'] },
    { emoji: '👧', keywords: ['girl', 'child'] },
    { emoji: '🧒', keywords: ['child'] },
    { emoji: '👦', keywords: ['boy', 'child'] },
    { emoji: '👩', keywords: ['woman', 'female'] },
    { emoji: '🧑', keywords: ['person', 'adult'] },
    { emoji: '👨', keywords: ['man', 'male'] },
    { emoji: '👵', keywords: ['old', 'woman', 'grandmother'] },
    { emoji: '🧓', keywords: ['older', 'person'] },
    { emoji: '👴', keywords: ['old', 'man', 'grandfather'] },
    { emoji: '👍', keywords: ['thumbs', 'up', 'good', 'yes', 'like', 'approve'] },
    { emoji: '👎', keywords: ['thumbs', 'down', 'bad', 'no', 'dislike'] },
    { emoji: '👌', keywords: ['ok', 'okay', 'perfect'] },
    { emoji: '✌️', keywords: ['victory', 'peace', 'two'] },
    { emoji: '🤞', keywords: ['crossed', 'fingers', 'luck'] },
    { emoji: '🤟', keywords: ['love', 'you', 'gesture'] },
    { emoji: '🤘', keywords: ['rock', 'on', 'horns'] },
    { emoji: '🤙', keywords: ['call', 'me', 'hang', 'loose'] },
    { emoji: '👈', keywords: ['pointing', 'left'] },
    { emoji: '👉', keywords: ['pointing', 'right'] },
    { emoji: '👆', keywords: ['pointing', 'up'] },
    { emoji: '🖕', keywords: ['middle', 'finger', 'rude'] },
    { emoji: '👇', keywords: ['pointing', 'down'] },
    { emoji: '☝️', keywords: ['index', 'pointing', 'up'] },
    { emoji: '👋', keywords: ['waving', 'hand', 'hello', 'goodbye'] },
    { emoji: '🤚', keywords: ['raised', 'back', 'hand'] },
    { emoji: '🖐️', keywords: ['hand', 'five', 'fingers'] },
    { emoji: '✋', keywords: ['raised', 'hand', 'stop'] },
    { emoji: '🖖', keywords: ['vulcan', 'salute', 'spock'] },
    { emoji: '🤌', keywords: ['pinched', 'fingers'] },
    { emoji: '🤏', keywords: ['pinching', 'hand'] },

    // Animals & Nature
    { emoji: '🐶', keywords: ['dog', 'puppy', 'pet'] },
    { emoji: '🐱', keywords: ['cat', 'kitten', 'pet'] },
    { emoji: '🐭', keywords: ['mouse', 'rodent'] },
    { emoji: '🐹', keywords: ['hamster', 'pet'] },
    { emoji: '🐰', keywords: ['rabbit', 'bunny'] },
    { emoji: '🦊', keywords: ['fox'] },
    { emoji: '🐻', keywords: ['bear'] },
    { emoji: '🐼', keywords: ['panda', 'bear'] },
    { emoji: '🐻‍❄️', keywords: ['polar', 'bear'] },
    { emoji: '🐨', keywords: ['koala'] },
    { emoji: '🐯', keywords: ['tiger'] },
    { emoji: '🦁', keywords: ['lion'] },
    { emoji: '🐮', keywords: ['cow'] },
    { emoji: '🐷', keywords: ['pig'] },
    { emoji: '🐸', keywords: ['frog'] },
    { emoji: '🐵', keywords: ['monkey'] },
    { emoji: '🙈', keywords: ['see', 'no', 'evil', 'monkey'] },
    { emoji: '🙉', keywords: ['hear', 'no', 'evil', 'monkey'] },
    { emoji: '🙊', keywords: ['speak', 'no', 'evil', 'monkey'] },
    { emoji: '🐒', keywords: ['monkey'] },
    { emoji: '🐔', keywords: ['chicken'] },
    { emoji: '🐧', keywords: ['penguin'] },
    { emoji: '🐦', keywords: ['bird'] },
    { emoji: '🐤', keywords: ['baby', 'chick'] },
    { emoji: '🐣', keywords: ['hatching', 'chick'] },
    { emoji: '🦆', keywords: ['duck'] },
    { emoji: '🦅', keywords: ['eagle'] },
    { emoji: '🦉', keywords: ['owl'] },
    { emoji: '🦇', keywords: ['bat'] },
    { emoji: '🐺', keywords: ['wolf'] },
    { emoji: '🐗', keywords: ['boar'] },
    { emoji: '🐴', keywords: ['horse'] },
    { emoji: '🦄', keywords: ['unicorn', 'magical'] },
    { emoji: '🐝', keywords: ['bee', 'honeybee'] },
    { emoji: '🐛', keywords: ['bug', 'insect'] },
    { emoji: '🦋', keywords: ['butterfly'] },
    { emoji: '🐌', keywords: ['snail'] },
    { emoji: '🐞', keywords: ['ladybug', 'beetle'] },
    { emoji: '🐜', keywords: ['ant'] },
    { emoji: '🦟', keywords: ['mosquito'] },
    { emoji: '🦗', keywords: ['cricket'] },
    { emoji: '🕷️', keywords: ['spider'] },
    { emoji: '🕸️', keywords: ['spider', 'web'] },
    { emoji: '🦂', keywords: ['scorpion'] },
    { emoji: '🐢', keywords: ['turtle'] },
    { emoji: '🐍', keywords: ['snake'] },
    { emoji: '🦎', keywords: ['lizard'] },
    { emoji: '🦖', keywords: ['t-rex', 'dinosaur'] },
    { emoji: '🦕', keywords: ['sauropod', 'dinosaur'] },
    { emoji: '🐙', keywords: ['octopus'] },
    { emoji: '🦑', keywords: ['squid'] },
    { emoji: '🦐', keywords: ['shrimp'] },
    { emoji: '🦞', keywords: ['lobster'] },
    { emoji: '🦀', keywords: ['crab'] },
    { emoji: '🐡', keywords: ['blowfish'] },
    { emoji: '🐠', keywords: ['tropical', 'fish'] },
    { emoji: '🐟', keywords: ['fish'] },
    { emoji: '🐬', keywords: ['dolphin'] },
    { emoji: '🐳', keywords: ['spouting', 'whale'] },
    { emoji: '🐋', keywords: ['whale'] },
    { emoji: '🦈', keywords: ['shark'] },
    { emoji: '🐊', keywords: ['crocodile'] },

    // Food & Drink
    { emoji: '🍎', keywords: ['apple', 'fruit', 'red'] },
    { emoji: '🍐', keywords: ['pear', 'fruit'] },
    { emoji: '🍊', keywords: ['orange', 'fruit'] },
    { emoji: '🍋', keywords: ['lemon', 'fruit', 'sour'] },
    { emoji: '🍌', keywords: ['banana', 'fruit'] },
    { emoji: '🍉', keywords: ['watermelon', 'fruit'] },
    { emoji: '🍇', keywords: ['grapes', 'fruit'] },
    { emoji: '🍓', keywords: ['strawberry', 'fruit'] },
    { emoji: '🫐', keywords: ['blueberries', 'fruit'] },
    { emoji: '🍈', keywords: ['melon', 'fruit'] },
    { emoji: '🍒', keywords: ['cherries', 'fruit'] },
    { emoji: '🍑', keywords: ['peach', 'fruit'] },
    { emoji: '🥭', keywords: ['mango', 'fruit'] },
    { emoji: '🍍', keywords: ['pineapple', 'fruit'] },
    { emoji: '🥥', keywords: ['coconut', 'fruit'] },
    { emoji: '🥝', keywords: ['kiwi', 'fruit'] },
    { emoji: '🍅', keywords: ['tomato', 'vegetable'] },
    { emoji: '🍆', keywords: ['eggplant', 'vegetable'] },
    { emoji: '🥑', keywords: ['avocado', 'fruit'] },
    { emoji: '🥦', keywords: ['broccoli', 'vegetable'] },
    { emoji: '🥬', keywords: ['leafy', 'greens', 'vegetable'] },
    { emoji: '🥒', keywords: ['cucumber', 'vegetable'] },
    { emoji: '🌶️', keywords: ['hot', 'pepper', 'spicy'] },
    { emoji: '🫑', keywords: ['bell', 'pepper', 'vegetable'] },
    { emoji: '🌽', keywords: ['corn', 'vegetable'] },
    { emoji: '🥕', keywords: ['carrot', 'vegetable'] },
    { emoji: '🫒', keywords: ['olive'] },
    { emoji: '🧄', keywords: ['garlic'] },
    { emoji: '🧅', keywords: ['onion'] },
    { emoji: '🥔', keywords: ['potato', 'vegetable'] },
    { emoji: '🍠', keywords: ['roasted', 'sweet', 'potato'] },
    { emoji: '🥐', keywords: ['croissant', 'bread'] },
    { emoji: '🥯', keywords: ['bagel', 'bread'] },
    { emoji: '🍞', keywords: ['bread', 'loaf'] },
    { emoji: '🥖', keywords: ['baguette', 'bread'] },
    { emoji: '🥨', keywords: ['pretzel'] },
    { emoji: '🧀', keywords: ['cheese'] },
    { emoji: '🥚', keywords: ['egg'] },
    { emoji: '🍳', keywords: ['cooking', 'egg', 'fried'] },
    { emoji: '🧈', keywords: ['butter'] },
    { emoji: '🥞', keywords: ['pancakes'] },
    { emoji: '🧇', keywords: ['waffle'] },
    { emoji: '🥓', keywords: ['bacon'] },
    { emoji: '🥩', keywords: ['cut', 'meat'] },
    { emoji: '🍗', keywords: ['poultry', 'leg', 'chicken'] },
    { emoji: '🍖', keywords: ['meat', 'bone'] },
    { emoji: '🦴', keywords: ['bone'] },
    { emoji: '🌭', keywords: ['hot', 'dog'] },
    { emoji: '🍔', keywords: ['hamburger', 'burger'] },
    { emoji: '🍟', keywords: ['french', 'fries'] },
    { emoji: '🍕', keywords: ['pizza'] },
    { emoji: '🥪', keywords: ['sandwich'] },
    { emoji: '🥙', keywords: ['stuffed', 'flatbread'] },
    { emoji: '🧆', keywords: ['falafel'] },
    { emoji: '🌮', keywords: ['taco'] },
    { emoji: '🌯', keywords: ['burrito'] },
    { emoji: '🫔', keywords: ['tamale'] },
    { emoji: '🥗', keywords: ['green', 'salad'] },
    { emoji: '🥘', keywords: ['shallow', 'pan', 'food'] },
    { emoji: '🫕', keywords: ['fondue'] },
    { emoji: '🥫', keywords: ['canned', 'food'] },
    { emoji: '🍝', keywords: ['spaghetti', 'pasta'] },
    { emoji: '🍜', keywords: ['steaming', 'bowl', 'ramen'] },
    { emoji: '🍲', keywords: ['pot', 'food', 'stew'] },
    { emoji: '🍛', keywords: ['curry', 'rice'] },
    { emoji: '🍣', keywords: ['sushi'] },
    { emoji: '🍱', keywords: ['bento', 'box'] },
    { emoji: '🥟', keywords: ['dumpling'] },
    { emoji: '🦪', keywords: ['oyster'] },
    { emoji: '🍤', keywords: ['fried', 'shrimp'] },
    { emoji: '🍙', keywords: ['rice', 'ball'] },
    { emoji: '🍚', keywords: ['cooked', 'rice'] },
    { emoji: '🍘', keywords: ['rice', 'cracker'] },
    { emoji: '🍥', keywords: ['fish', 'cake', 'swirl'] },
    { emoji: '🥠', keywords: ['fortune', 'cookie'] },
    { emoji: '🥮', keywords: ['moon', 'cake'] },
    { emoji: '🍢', keywords: ['oden'] },
    { emoji: '🍡', keywords: ['dango'] },
    { emoji: '🍧', keywords: ['shaved', 'ice'] },
    { emoji: '🍨', keywords: ['ice', 'cream'] },
    { emoji: '🍦', keywords: ['soft', 'ice', 'cream'] },
    { emoji: '🍰', keywords: ['shortcake', 'cake'] },
    { emoji: '🧁', keywords: ['cupcake'] },
    { emoji: '🥧', keywords: ['pie'] },
    { emoji: '🍮', keywords: ['custard'] },
    { emoji: '🍭', keywords: ['lollipop', 'candy'] },
    { emoji: '🍬', keywords: ['candy', 'sweet'] },
    { emoji: '🍫', keywords: ['chocolate', 'bar'] },
    { emoji: '🍿', keywords: ['popcorn'] },
    { emoji: '🍪', keywords: ['cookie'] },
    { emoji: '🌰', keywords: ['chestnut'] },
    { emoji: '🥜', keywords: ['peanuts', 'nuts'] },
    { emoji: '🍯', keywords: ['honey', 'pot'] },
    { emoji: '🥛', keywords: ['glass', 'milk'] },
    { emoji: '🍼', keywords: ['baby', 'bottle'] },
    { emoji: '🫖', keywords: ['teapot'] },

    // Activities & Objects
    { emoji: '⚽', keywords: ['soccer', 'ball', 'football'] },
    { emoji: '🏀', keywords: ['basketball'] },
    { emoji: '🏈', keywords: ['american', 'football'] },
    { emoji: '⚾', keywords: ['baseball'] },
    { emoji: '🥎', keywords: ['softball'] },
    { emoji: '🎾', keywords: ['tennis'] },
    { emoji: '🏐', keywords: ['volleyball'] },
    { emoji: '🏉', keywords: ['rugby', 'football'] },
    { emoji: '🥏', keywords: ['flying', 'disc', 'frisbee'] },
    { emoji: '🎱', keywords: ['pool', '8', 'ball'] },
    { emoji: '🪀', keywords: ['yo-yo'] },
    { emoji: '🏓', keywords: ['ping', 'pong', 'table', 'tennis'] },
    { emoji: '🏸', keywords: ['badminton'] },
    { emoji: '🏒', keywords: ['ice', 'hockey'] },
    { emoji: '🏑', keywords: ['field', 'hockey'] },
    { emoji: '🥍', keywords: ['lacrosse'] },
    { emoji: '🏏', keywords: ['cricket'] },
    { emoji: '🥅', keywords: ['goal', 'net'] },
    { emoji: '⛳', keywords: ['flag', 'hole', 'golf'] },
    { emoji: '🪁', keywords: ['kite'] },
    { emoji: '🏹', keywords: ['bow', 'arrow'] },
    { emoji: '🎣', keywords: ['fishing', 'pole'] },
    { emoji: '🤿', keywords: ['diving', 'mask'] },
    { emoji: '🥊', keywords: ['boxing', 'glove'] },
    { emoji: '🥋', keywords: ['martial', 'arts', 'uniform'] },
    { emoji: '🎽', keywords: ['running', 'shirt'] },
    { emoji: '🛹', keywords: ['skateboard'] },
    { emoji: '🛷', keywords: ['sled'] },
    { emoji: '⛸️', keywords: ['ice', 'skate'] },
    { emoji: '🥌', keywords: ['curling', 'stone'] },
    { emoji: '🎿', keywords: ['skis'] },
    { emoji: '⛷️', keywords: ['skier'] },
    { emoji: '🏂', keywords: ['snowboarder'] },
    { emoji: '🪂', keywords: ['parachute'] },
    { emoji: '🎭', keywords: ['performing', 'arts', 'theater'] },
    { emoji: '🩰', keywords: ['ballet', 'shoes'] },
    { emoji: '🎨', keywords: ['artist', 'palette', 'art'] },
    { emoji: '🎬', keywords: ['clapper', 'board', 'movie'] },
    { emoji: '🎤', keywords: ['microphone', 'singing'] },
    { emoji: '🎧', keywords: ['headphone', 'music'] },
    { emoji: '🎼', keywords: ['musical', 'score'] },
    { emoji: '🎹', keywords: ['musical', 'keyboard', 'piano'] },
    { emoji: '🥁', keywords: ['drum'] },
    { emoji: '🪘', keywords: ['long', 'drum'] },
    { emoji: '🎷', keywords: ['saxophone'] },
    { emoji: '🎺', keywords: ['trumpet'] },
    { emoji: '🎸', keywords: ['guitar'] },
    { emoji: '🪕', keywords: ['banjo'] },
    { emoji: '🎻', keywords: ['violin'] },
    { emoji: '🎲', keywords: ['game', 'die', 'dice'] },
    { emoji: '♟️', keywords: ['chess', 'pawn'] },
    { emoji: '🎯', keywords: ['direct', 'hit', 'target'] },
    { emoji: '🎳', keywords: ['bowling'] },
    { emoji: '🎮', keywords: ['video', 'game', 'controller'] },
    { emoji: '🎰', keywords: ['slot', 'machine'] },
    { emoji: '🧩', keywords: ['puzzle', 'piece'] },
    { emoji: '📱', keywords: ['mobile', 'phone', 'cell'] },

    // Travel & Places
    { emoji: '🚗', keywords: ['automobile', 'car'] },
    { emoji: '🚕', keywords: ['taxi'] },
    { emoji: '🚙', keywords: ['sport', 'utility', 'vehicle', 'suv'] },
    { emoji: '🚌', keywords: ['bus'] },
    { emoji: '🚎', keywords: ['trolleybus'] },
    { emoji: '🏎️', keywords: ['racing', 'car'] },
    { emoji: '🚓', keywords: ['police', 'car'] },
    { emoji: '🚑', keywords: ['ambulance'] },
    { emoji: '🚒', keywords: ['fire', 'engine'] },
    { emoji: '🚐', keywords: ['minibus'] },
    { emoji: '🚚', keywords: ['delivery', 'truck'] },
    { emoji: '🚛', keywords: ['articulated', 'lorry'] },
    { emoji: '🚜', keywords: ['tractor'] },
    { emoji: '🛴', keywords: ['kick', 'scooter'] },
    { emoji: '🛵', keywords: ['motor', 'scooter'] },
    { emoji: '🏍️', keywords: ['motorcycle'] },
    { emoji: '🚨', keywords: ['police', 'car', 'light'] },
    { emoji: '🚔', keywords: ['oncoming', 'police', 'car'] },
    { emoji: '🚍', keywords: ['oncoming', 'bus'] },
    { emoji: '🚘', keywords: ['oncoming', 'automobile'] },
    { emoji: '🚖', keywords: ['oncoming', 'taxi'] },
    { emoji: '🚡', keywords: ['aerial', 'tramway'] },
    { emoji: '🚠', keywords: ['mountain', 'cableway'] },
    { emoji: '🚟', keywords: ['suspension', 'railway'] },
    { emoji: '🚃', keywords: ['railway', 'car'] },
    { emoji: '🚋', keywords: ['tram', 'car'] },
    { emoji: '🚞', keywords: ['mountain', 'railway'] },
    { emoji: '🚝', keywords: ['monorail'] },
    { emoji: '🚄', keywords: ['high-speed', 'train'] },
    { emoji: '🚅', keywords: ['bullet', 'train'] },
    { emoji: '🚈', keywords: ['light', 'rail'] },
    { emoji: '🚂', keywords: ['locomotive'] },
    { emoji: '🚆', keywords: ['train'] },
    { emoji: '🚇', keywords: ['metro', 'subway'] },
    { emoji: '🚊', keywords: ['tram'] },
    { emoji: '🚉', keywords: ['station'] },
    { emoji: '✈️', keywords: ['airplane', 'plane', 'flight'] },
    { emoji: '🛫', keywords: ['airplane', 'departure'] },
    { emoji: '🛬', keywords: ['airplane', 'arrival'] },
    { emoji: '🛩️', keywords: ['small', 'airplane'] },
    { emoji: '💺', keywords: ['seat'] },
    { emoji: '🛰️', keywords: ['satellite'] },
    { emoji: '🚀', keywords: ['rocket', 'space'] },
    { emoji: '🛸', keywords: ['flying', 'saucer', 'ufo'] },
    { emoji: '🚁', keywords: ['helicopter'] },
    { emoji: '🛶', keywords: ['canoe'] },
    { emoji: '⛵', keywords: ['sailboat'] },
    { emoji: '🚤', keywords: ['speedboat'] },
    { emoji: '🛥️', keywords: ['motor', 'boat'] },
    { emoji: '🛳️', keywords: ['passenger', 'ship'] },
    { emoji: '⛴️', keywords: ['ferry'] },
    { emoji: '🚢', keywords: ['ship'] },
    { emoji: '⚓', keywords: ['anchor'] },
    { emoji: '🚧', keywords: ['construction'] },
    { emoji: '⛽', keywords: ['fuel', 'pump', 'gas'] },
    { emoji: '🚏', keywords: ['bus', 'stop'] },
    { emoji: '🚦', keywords: ['vertical', 'traffic', 'light'] },
    { emoji: '🚥', keywords: ['horizontal', 'traffic', 'light'] },
    { emoji: '🗺️', keywords: ['world', 'map'] },
    { emoji: '🗿', keywords: ['moai', 'statue'] },
    { emoji: '🗽', keywords: ['statue', 'liberty'] },
    { emoji: '🗼', keywords: ['tokyo', 'tower'] },
    { emoji: '🏰', keywords: ['castle'] },
    { emoji: '🏯', keywords: ['japanese', 'castle'] },
    { emoji: '🏟️', keywords: ['stadium'] },
    { emoji: '🎡', keywords: ['ferris', 'wheel'] },
    { emoji: '🎢', keywords: ['roller', 'coaster'] },
    { emoji: '🎠', keywords: ['carousel', 'horse'] },
    { emoji: '⛲', keywords: ['fountain'] },
    { emoji: '⛱️', keywords: ['umbrella', 'beach'] },
    { emoji: '🏖️', keywords: ['beach', 'umbrella'] },
    { emoji: '🏝️', keywords: ['desert', 'island'] },
    { emoji: '🏔️', keywords: ['snow-capped', 'mountain'] },
    { emoji: '🗻', keywords: ['mount', 'fuji'] },
    { emoji: '🌋', keywords: ['volcano'] },
    { emoji: '🗾', keywords: ['map', 'japan'] },
    { emoji: '🏕️', keywords: ['camping'] },
    { emoji: '⛺', keywords: ['tent'] },
    { emoji: '🏠', keywords: ['house'] },
    { emoji: '🏡', keywords: ['house', 'garden'] },
    { emoji: '🏘️', keywords: ['houses'] },
    { emoji: '🏚️', keywords: ['derelict', 'house'] },
    { emoji: '🏗️', keywords: ['building', 'construction'] },
    { emoji: '🏭', keywords: ['factory'] },
    { emoji: '🏢', keywords: ['office', 'building'] },
    { emoji: '🏬', keywords: ['department', 'store'] },
    { emoji: '🏣', keywords: ['japanese', 'post', 'office'] },
    { emoji: '🏤', keywords: ['post', 'office'] },
    { emoji: '🏥', keywords: ['hospital'] },
    { emoji: '🏦', keywords: ['bank'] },
    { emoji: '🏨', keywords: ['hotel'] },
    { emoji: '🏪', keywords: ['convenience', 'store'] },
    { emoji: '🏫', keywords: ['school'] },
    { emoji: '🏩', keywords: ['love', 'hotel'] },
    { emoji: '💒', keywords: ['wedding'] },
    { emoji: '⛪', keywords: ['church'] },

    // Symbols & Objects
    { emoji: '❤️', keywords: ['red', 'heart', 'love'] },
    { emoji: '🧡', keywords: ['orange', 'heart', 'love'] },
    { emoji: '💛', keywords: ['yellow', 'heart', 'love'] },
    { emoji: '💚', keywords: ['green', 'heart', 'love'] },
    { emoji: '💙', keywords: ['blue', 'heart', 'love'] },
    { emoji: '💜', keywords: ['purple', 'heart', 'love'] },
    { emoji: '🖤', keywords: ['black', 'heart', 'love'] },
    { emoji: '🤍', keywords: ['white', 'heart', 'love'] },
    { emoji: '🤎', keywords: ['brown', 'heart', 'love'] },
    { emoji: '💔', keywords: ['broken', 'heart', 'sad'] },
    { emoji: '❣️', keywords: ['heavy', 'heart', 'exclamation'] },
    { emoji: '💕', keywords: ['two', 'hearts', 'love'] },
    { emoji: '💞', keywords: ['revolving', 'hearts', 'love'] },
    { emoji: '💓', keywords: ['beating', 'heart', 'love'] },
    { emoji: '💗', keywords: ['growing', 'heart', 'love'] },
    { emoji: '💖', keywords: ['sparkling', 'heart', 'love'] },
    { emoji: '💘', keywords: ['heart', 'arrow', 'cupid'] },
    { emoji: '💝', keywords: ['heart', 'ribbon', 'gift'] },
    { emoji: '💟', keywords: ['heart', 'decoration'] },
    { emoji: '☮️', keywords: ['peace', 'symbol'] },
    { emoji: '✝️', keywords: ['latin', 'cross'] },
    { emoji: '☪️', keywords: ['star', 'crescent'] },
    { emoji: '🕉️', keywords: ['om'] },
    { emoji: '☸️', keywords: ['wheel', 'dharma'] },
    { emoji: '✡️', keywords: ['star', 'david'] },
    { emoji: '🔯', keywords: ['dotted', 'six-pointed', 'star'] },
    { emoji: '🕎', keywords: ['menorah'] },
    { emoji: '☯️', keywords: ['yin', 'yang'] },
    { emoji: '☦️', keywords: ['orthodox', 'cross'] },
    { emoji: '🛐', keywords: ['place', 'worship'] },
    { emoji: '⛎', keywords: ['ophiuchus'] },
    { emoji: '♈', keywords: ['aries'] },
    { emoji: '♉', keywords: ['taurus'] },
    { emoji: '♊', keywords: ['gemini'] },
    { emoji: '♋', keywords: ['cancer'] },
    { emoji: '♌', keywords: ['leo'] },
    { emoji: '♍', keywords: ['virgo'] },
    { emoji: '♎', keywords: ['libra'] },
    { emoji: '♏', keywords: ['scorpio'] },
    { emoji: '♐', keywords: ['sagittarius'] },
    { emoji: '♑', keywords: ['capricorn'] },
    { emoji: '♒', keywords: ['aquarius'] },
    { emoji: '♓', keywords: ['pisces'] },
    { emoji: '🆔', keywords: ['id', 'button'] },
    { emoji: '⚛️', keywords: ['atom', 'symbol'] },
    { emoji: '🉑', keywords: ['japanese', 'acceptable'] },
    { emoji: '☢️', keywords: ['radioactive'] },
    { emoji: '☣️', keywords: ['biohazard'] },
    { emoji: '📴', keywords: ['mobile', 'phone', 'off'] },
    { emoji: '📳', keywords: ['vibration', 'mode'] },
    { emoji: '🈶', keywords: ['japanese', 'not', 'free', 'charge'] },
    { emoji: '🈚', keywords: ['japanese', 'free', 'charge'] },
    { emoji: '🈸', keywords: ['japanese', 'application'] },
    { emoji: '🈺', keywords: ['japanese', 'open', 'business'] },
    { emoji: '🈷️', keywords: ['japanese', 'monthly', 'amount'] },
    { emoji: '✴️', keywords: ['eight-pointed', 'star'] },
    { emoji: '🆚', keywords: ['vs', 'button'] },
    { emoji: '💮', keywords: ['white', 'flower'] },
    { emoji: '🉐', keywords: ['japanese', 'bargain'] },
    { emoji: '㊙️', keywords: ['japanese', 'secret'] },
    { emoji: '㊗️', keywords: ['japanese', 'congratulations'] },
    { emoji: '🈴', keywords: ['japanese', 'passing', 'grade'] },
    { emoji: '🈵', keywords: ['japanese', 'no', 'vacancy'] },
    { emoji: '🈹', keywords: ['japanese', 'discount'] },
    { emoji: '🈲', keywords: ['japanese', 'prohibited'] },
    { emoji: '🅰️', keywords: ['a', 'button', 'blood', 'type'] },
    { emoji: '🅱️', keywords: ['b', 'button', 'blood', 'type'] },
    { emoji: '🆎', keywords: ['ab', 'button', 'blood', 'type'] },
    { emoji: '🆑', keywords: ['cl', 'button'] },
    { emoji: '🅾️', keywords: ['o', 'button', 'blood', 'type'] },
    { emoji: '🆘', keywords: ['sos', 'button'] },
    { emoji: '❌', keywords: ['cross', 'mark', 'no', 'x'] },
    { emoji: '⭕', keywords: ['heavy', 'large', 'circle'] },
    { emoji: '🛑', keywords: ['stop', 'sign'] },
    { emoji: '⛔', keywords: ['no', 'entry'] },
    { emoji: '📛', keywords: ['name', 'badge'] },
    { emoji: '🚫', keywords: ['prohibited'] },
    { emoji: '💯', keywords: ['hundred', 'points', 'perfect'] },
    { emoji: '💢', keywords: ['anger', 'symbol'] },
    { emoji: '♨️', keywords: ['hot', 'springs'] },
    { emoji: '🚷', keywords: ['no', 'pedestrians'] },
    { emoji: '🚯', keywords: ['no', 'littering'] },
    { emoji: '🚳', keywords: ['no', 'bicycles'] },
    { emoji: '🚱', keywords: ['non-potable', 'water'] },
    { emoji: '🔞', keywords: ['no', 'one', 'under', 'eighteen'] },
    { emoji: '📵', keywords: ['no', 'mobile', 'phones'] },
    { emoji: '🚭', keywords: ['no', 'smoking'] },
    { emoji: '❗', keywords: ['exclamation', 'mark'] },
    { emoji: '❕', keywords: ['white', 'exclamation', 'mark'] },
    { emoji: '❓', keywords: ['question', 'mark'] },
    { emoji: '❔', keywords: ['white', 'question', 'mark'] },
    { emoji: '‼️', keywords: ['double', 'exclamation', 'mark'] },
    { emoji: '⁉️', keywords: ['exclamation', 'question', 'mark'] },
    { emoji: '🔅', keywords: ['dim', 'button'] },
    { emoji: '🔆', keywords: ['bright', 'button'] },
    { emoji: '〽️', keywords: ['part', 'alternation', 'mark'] },

    // Flags & Misc
    { emoji: '🏁', keywords: ['chequered', 'flag', 'racing'] },
    { emoji: '🚩', keywords: ['triangular', 'flag'] },
    { emoji: '🎌', keywords: ['crossed', 'flags'] },
    { emoji: '🏴', keywords: ['black', 'flag'] },
    { emoji: '🏳️', keywords: ['white', 'flag'] },
    { emoji: '🏳️‍🌈', keywords: ['rainbow', 'flag', 'pride'] },
    { emoji: '🏴‍☠️', keywords: ['pirate', 'flag'] },
    { emoji: '🎉', keywords: ['party', 'popper', 'celebration'] },
    { emoji: '🎊', keywords: ['confetti', 'ball', 'celebration'] },
    { emoji: '🎈', keywords: ['balloon', 'party'] },
    { emoji: '🎂', keywords: ['birthday', 'cake'] },
    { emoji: '🎁', keywords: ['wrapped', 'gift', 'present'] },
    { emoji: '🎄', keywords: ['christmas', 'tree'] },
    { emoji: '🎃', keywords: ['jack-o-lantern', 'halloween'] },
    { emoji: '🎗️', keywords: ['reminder', 'ribbon'] },
    { emoji: '🎟️', keywords: ['admission', 'tickets'] },
    { emoji: '🎫', keywords: ['ticket'] },
    { emoji: '🎖️', keywords: ['military', 'medal'] },
    { emoji: '🏆', keywords: ['trophy', 'winner'] },
    { emoji: '🏅', keywords: ['sports', 'medal'] },
    { emoji: '🥇', keywords: ['1st', 'place', 'medal', 'gold'] },
    { emoji: '🥈', keywords: ['2nd', 'place', 'medal', 'silver'] },
    { emoji: '🥉', keywords: ['3rd', 'place', 'medal', 'bronze'] },
    { emoji: '🔥', keywords: ['fire', 'hot', 'lit'] },
    { emoji: '💯', keywords: ['hundred', 'points', 'perfect', '100'] },
    { emoji: '✨', keywords: ['sparkles', 'magic', 'shiny'] },
    { emoji: '🌟', keywords: ['glowing', 'star'] },
    { emoji: '💫', keywords: ['dizzy'] },
    { emoji: '⭐', keywords: ['star'] },
    { emoji: '💥', keywords: ['collision', 'explosion'] },
    { emoji: '⚡', keywords: ['high', 'voltage', 'lightning'] },
    { emoji: '💦', keywords: ['sweat', 'droplets'] },
    { emoji: '💨', keywords: ['dashing', 'away', 'wind'] },
    { emoji: '☁️', keywords: ['cloud'] },
    { emoji: '🌤️', keywords: ['sun', 'behind', 'small', 'cloud'] },
    { emoji: '⛅', keywords: ['sun', 'behind', 'cloud'] },
    { emoji: '🌥️', keywords: ['sun', 'behind', 'large', 'cloud'] },
    { emoji: '🌦️', keywords: ['sun', 'behind', 'rain', 'cloud'] },
    { emoji: '🌧️', keywords: ['cloud', 'rain'] },
    { emoji: '⛈️', keywords: ['cloud', 'lightning', 'rain'] },
    { emoji: '🌩️', keywords: ['cloud', 'lightning'] },
    { emoji: '🌨️', keywords: ['cloud', 'snow'] },
    { emoji: '☃️', keywords: ['snowman'] },
    { emoji: '⛄', keywords: ['snowman', 'without', 'snow'] },
    { emoji: '🌬️', keywords: ['wind', 'face'] },
    { emoji: '🌪️', keywords: ['tornado'] },
    { emoji: '🌫️', keywords: ['fog'] },
    { emoji: '🌊', keywords: ['water', 'wave'] },
    { emoji: '💧', keywords: ['droplet', 'water'] },
    { emoji: '☔', keywords: ['umbrella', 'rain', 'drops'] },
    { emoji: '☂️', keywords: ['umbrella'] },
    { emoji: '🌂', keywords: ['closed', 'umbrella'] }
  ];

  // Filter emojis based on search term
  const getFilteredEmojis = (searchTerm) => {
    if (!searchTerm.trim()) {
      return emojiData.map(item => item.emoji);
    }

    const lowercaseSearch = searchTerm.toLowerCase();
    return emojiData
      .filter(item =>
        item.keywords.some(keyword =>
          keyword.toLowerCase().includes(lowercaseSearch)
        )
      )
      .map(item => item.emoji);
  };

  const toggleReactionsEmojiPicker = () => {
    const newState = !showReactionsEmojiPicker;
    setShowReactionsEmojiPicker(newState);
  };

  const openEmojiInsertModal = () => {
    setEmojiPickerMode('insert');
    setShowReactionsEmojiPicker(true);
  };

  const insertEmojiIntoInput = (emoji) => {
    const el = inputRef?.current;
    const baseText = el ? el.value : comment;
    let start = baseText.length;
    let end = baseText.length;
    try {
      if (el && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
        start = el.selectionStart;
        end = el.selectionEnd;
      }
    } catch (_) { }
    const newText = baseText.slice(0, start) + emoji + baseText.slice(end);
    setComment(newText);
    if (editingComment) {
      setEditText(newText);
    }
    setTimeout(() => {
      try {
        if (el) {
          const caretPos = start + emoji.length;
          el.focus();
          el.setSelectionRange(caretPos, caretPos);
        }
      } catch (_) { }
    }, 0);
  };

  // Prevent quick reactions model from closing unexpectedly
  const preventModalClose = useCallback((e) => {
    if (showReactionsEmojiPicker) {
      e.stopPropagation();
      e.preventDefault();
      return false;
    }
  }, [showReactionsEmojiPicker]);

  // Mark messages as read when user can see them
  const markingReadRef = useRef(false);

  const markVisibleMessagesAsRead = useCallback(async (force = false) => {
    if (!appt?._id) return;

    // If not forced (meaning it's a scroll event), check if we are close to bottom
    // We use a generous threshold (150px) to ensure we capture reads even if not at absolute bottom
    if (!force && chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isCloseToBottom = scrollHeight - scrollTop - clientHeight < 150;
      if (!isCloseToBottom) return;
    }

    if (markingReadRef.current) return; // Prevent concurrent requests

    const unreadMessages = comments.filter(c =>
      !c.readBy?.includes(currentUser._id) &&
      c.senderEmail !== currentUser.email
    );

    if (unreadMessages.length > 0) {
      markingReadRef.current = true;
      try {
        // Mark messages as read in backend
        const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/read`, {
          method: 'PATCH',
          body: JSON.stringify({})
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          // Swallowing error but logging it in the catch block
          throw { response: { status: res.status, data: errorData } };
        }
        const data = await res.json();
        // Update local state immediately
        setComments(prev =>
          prev.map(c =>
            unreadMessages.some(unread => unread._id === c._id)
              ? { ...c, readBy: [...(c.readBy || []), currentUser._id], status: 'read' } // Keep optimistic update
              : c
          )
        );


      } catch (error) {
        console.error('Error marking messages as read:', error);
      } finally {
        markingReadRef.current = false; // Reset the flag
      }
    }
  }, [comments, currentUser._id, appt._id, socket]);
  // Track new messages and handle auto-scroll/unread count
  const prevCommentsLengthRef = useRef(comments.length);
  const prevCommentsRef = useRef(comments);
  useEffect(() => {
    const newMessages = comments.slice(prevCommentsLengthRef.current);
    const newMessagesCount = newMessages.length;
    prevCommentsLengthRef.current = comments.length;
    prevCommentsRef.current = comments;

    // Skip when restoring messages via undo — don't treat them as new
    if (isRestoringMessagesRef.current) return;

    if (newMessagesCount > 0 && showChatModal) {
      // Check if any new messages are from current user (sent messages)
      const hasSentMessages = newMessages.some(msg => msg.senderEmail === currentUser.email);
      // Check if any new messages are from other users (received messages)
      const receivedMessages = newMessages.filter(msg => msg.senderEmail !== currentUser.email);

      if (hasSentMessages || isAtBottom) {
        // Auto-scroll if user sent a message OR if user is at bottom
        setTimeout(() => {
          if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });

            // If user was at bottom and received new messages, mark them as read after scroll
            // Only if they had manually scrolled before (showing they were actively using chat)
            if (isAtBottom && receivedMessages.length > 0) {
              setTimeout(() => {
                markVisibleMessagesAsRead();
              }, 300); // Wait for scroll to complete
            }
          }
        }, 100);
      } else if (receivedMessages.length > 0) {
        // Add to unread count only for received messages when user is not at bottom
        setUnreadNewMessages(prev => prev + receivedMessages.length);
      }
    }
  }, [comments.length, isAtBottom, showChatModal, currentUser.email, markVisibleMessagesAsRead]);

  // Check if user is at the bottom of chat
  const checkIfAtBottom = useCallback(() => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 10; // 10px threshold for auto-scroll state
      const isVisibleRange = scrollHeight - scrollTop - clientHeight < 150; // 150px threshold for reading
      setIsAtBottom(atBottom);

      // When user is in visible range (150px), mark unread messages as read
      if (isVisibleRange) {
        const unreadCount = comments.filter(c =>
          !c.readBy?.includes(currentUser._id) &&
          c.senderEmail !== currentUser.email
        ).length;

        if (unreadCount > 0) {
          markVisibleMessagesAsRead();
        }

        // Clear unread notification count
        if (unreadNewMessages > 0) {
          setUnreadNewMessages(0);
        }
      }
    }
  }, [unreadNewMessages, markVisibleMessagesAsRead, comments, currentUser._id]);

  // Function to update floating date based on visible messages
  const updateFloatingDate = useCallback(() => {
    if (!chatContainerRef.current || comments.length === 0) return;

    // Filter comments inside the function to avoid dependency on filteredComments
    const clearTimeKey = `chatClearTime_${appt._id}`;
    const localClearMs = Number(localStorage.getItem(clearTimeKey)) || 0;
    const serverClearMs = (() => {
      const clearedAt = appt.role === 'buyer' ? appt.buyerChatClearedAt : appt.sellerChatClearedAt;
      return clearedAt ? new Date(clearedAt).getTime() : 0;
    })();
    const effectiveClearMs = Math.max(localClearMs, serverClearMs);
    const locallyRemovedIds = getLocallyRemovedIds(appt._id);
    const filteredComments = comments.filter(c => new Date(c.timestamp).getTime() > effectiveClearMs && !locallyRemovedIds.includes(c._id));

    if (filteredComments.length === 0) return;

    const container = chatContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const containerTop = containerRect.top + 60; // Account for header

    // Find the first visible message
    let visibleDate = '';
    for (let i = 0; i < filteredComments.length; i++) {
      const messageElement = messageRefs.current[filteredComments[i]._id];
      if (messageElement) {
        const messageRect = messageElement.getBoundingClientRect();
        if (messageRect.top >= containerTop && messageRect.bottom <= containerRect.bottom) {
          const messageDate = new Date(filteredComments[i].timestamp);
          visibleDate = getDateLabel(messageDate);
          break;
        }
      }
    }

    // If no message is fully visible, find the one that's partially visible at the top
    if (!visibleDate) {
      for (let i = 0; i < filteredComments.length; i++) {
        const messageElement = messageRefs.current[filteredComments[i]._id];
        if (messageElement) {
          const messageRect = messageElement.getBoundingClientRect();
          if (messageRect.bottom > containerTop) {
            const messageDate = new Date(filteredComments[i].timestamp);
            visibleDate = getDateLabel(messageDate);
            break;
          }
        }
      }
    }

    if (visibleDate && visibleDate !== currentFloatingDate) {
      setCurrentFloatingDate(visibleDate);
    }
  }, [comments, currentFloatingDate, appt._id]);

  // Add scroll event listener for chat container
  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer && showChatModal) {
      const handleScroll = () => {
        // User has scrolled - this will trigger checkIfAtBottom and updateFloatingDate
        checkIfAtBottom();
        updateFloatingDate();

        // Show floating date when scrolling starts
        setIsScrolling(true);

        // Removed: no special highlight when scrolled to top for privacy notice

        // Clear existing timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }

        // Hide floating date after scrolling stops (1 second of inactivity)
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false);
        }, 1000);
      };

      chatContainer.addEventListener('scroll', handleScroll);
      // Only check initial position for setting isAtBottom state, don't mark as read automatically
      if (chatContainer) {
        const { scrollTop, scrollHeight, clientHeight } = chatContainer;
        const atBottom = scrollHeight - scrollTop - clientHeight < 10;
        setIsAtBottom(atBottom);
      }

      // Initialize floating date
      setTimeout(updateFloatingDate, 100);

      return () => {
        chatContainer.removeEventListener('scroll', handleScroll);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }
  }, [showChatModal, checkIfAtBottom, updateFloatingDate]);

  // Auto-scroll when modal opens  
  useEffect(() => {
    if (showChatModal && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showChatModal]);

  // Function to scroll to bottom
  const scrollToBottom = useCallback(() => {
    // Clear unread count immediately
    setUnreadNewMessages(0);

    // Use multiple methods to ensure scroll works
    setTimeout(() => {
      if (chatContainerRef.current) {
        // Method 1: Scroll the container to bottom
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }

      // Method 2: Also use scrollIntoView as backup
      if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }

      // Mark visible messages as read after scrolling
      setTimeout(() => {
        markVisibleMessagesAsRead();
      }, 500); // Wait for scroll animation to complete
    }, 100); // Small delay to ensure DOM is updated
  }, [markVisibleMessagesAsRead]);



  // Real-time comment updates via socket.io (for chat sync)
  useEffect(() => {
    function handleCommentUpdate(data) {
      if (data.appointmentId === appt._id) {
        setComments((prev) => {
          // Skip if this message was just sent via retry (prevents duplicate bubbles)
          if (recentlySentIdsRef.current.has(data.comment._id)) {
            // Still update the existing message in place if it exists
            const existingIdx = prev.findIndex(c => c._id === data.comment._id);
            if (existingIdx !== -1) {
              const updated = [...prev];
              const localComment = prev[existingIdx];
              const incomingComment = data.comment;
              let status = incomingComment.status;
              if (localComment.status === 'read' && incomingComment.status !== 'read') {
                status = 'read';
              }
              updated[existingIdx] = { ...incomingComment, status };
              return updated;
            }
            return prev; // Already handled by retry, skip adding
          }

          const idx = prev.findIndex(c => c._id === data.comment._id);
          if (idx !== -1) {
            // Update the existing comment in place, but do not downgrade 'read' to 'delivered'
            const updated = [...prev];
            const localComment = prev[idx];
            const incomingComment = data.comment;
            let status = incomingComment.status;
            if (localComment.status === 'read' && incomingComment.status !== 'read') {
              status = 'read';
            }
            updated[idx] = { ...incomingComment, status };
            return updated;
          } else {
            // Also check if we have a temp message for this sender — skip if so
            const hasTempFromSender = prev.some(msg =>
              msg._id.toString().startsWith('temp-') && msg.senderEmail === data.comment.senderEmail
            );
            if (hasTempFromSender && data.comment.senderEmail === currentUser.email) {
              // This is our own message arriving via socket while we still have the temp — replace the temp
              const tempMsg = prev.find(msg =>
                msg._id.toString().startsWith('temp-') &&
                msg.senderEmail === currentUser.email &&
                msg.message === data.comment.message
              );
              if (tempMsg) {
                return prev.map(msg =>
                  msg._id === tempMsg._id ? { ...data.comment } : msg
                );
              }
              // No exact match, just add it
              return [...prev, data.comment];
            }

            // If this is a new message from another user and chat is not open, increment unread count
            if (data.comment.senderEmail !== currentUser.email && !showChatModal && !data.comment.readBy?.includes(currentUser._id)) {
              setUnreadNewMessages(prev => prev + 1);
              // Do not play notification sound here; App.jsx handles global notifications
            } else {
              playMessageReceived(); // Play receive sound
            }
            return [...prev, data.comment];
          }
        });
      }
    }

    // New: clear chat and remove-for-me events
    function handleChatClearedForUser({ appointmentId, clearedAt, userId }) {
      if (appointmentId !== appt._id) return;
      // Only handle if this event is for the current user
      if (userId === currentUser._id) {
        try {
          const clearTimeKey = `chatClearTime_${appt._id}`;
          const localMs = Number(localStorage.getItem(clearTimeKey)) || 0;
          const serverMs = clearedAt ? new Date(clearedAt).getTime() : 0;
          const effective = Math.max(localMs, serverMs);
          localStorage.setItem(clearTimeKey, String(effective));
        } catch { }
        setComments([]);
        setCallHistory([]); // Also clear call history bubbles when chat is cleared
        setUnreadNewMessages(0);
      }
    }
    function handleCommentRemovedForUser({ appointmentId, commentId, userId }) {
      if (appointmentId !== appt._id) return;
      // Only handle if this event is for the current user
      if (userId === currentUser._id) {
        setComments(prev => prev.filter(c => c._id !== commentId));
        // Also record locally to keep UI consistent
        addLocallyRemovedId(appt._id, commentId);
      }
    }

    socket.on('commentUpdate', handleCommentUpdate);
    socket.on('chatClearedForUser', handleChatClearedForUser);
    socket.on('commentRemovedForUser', handleCommentRemovedForUser);
    return () => {
      socket.off('commentUpdate', handleCommentUpdate);
      socket.off('chatClearedForUser', handleChatClearedForUser);
      socket.off('commentRemovedForUser', handleCommentRemovedForUser);
    };
  }, [appt._id, currentUser.email, currentUser._id, showChatModal, playNotification, playMessageReceived]);

  // Lock body scroll when chat modal is open
  useEffect(() => {
    if (showChatModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showChatModal]);

  // Mark all comments as read when chat modal opens and fetch latest if needed
  useEffect(() => {
    if (showChatModal && appt?._id) {
      // Use the centralized function to mark messages as read and emit socket events
      // We pass true to force the read mark regardless of scroll position
      markVisibleMessagesAsRead(true);
    }
  }, [showChatModal, appt?._id, markVisibleMessagesAsRead]);

  // Listen for commentDelivered and commentRead events
  useEffect(() => {
    function handleCommentDelivered(data) {
      if (data.appointmentId === appt._id) {
        setComments(prev =>
          prev.map(c =>
            c._id === data.commentId
              ? { ...c, status: c.status === "read" ? "read" : "delivered", deliveredAt: new Date() }
              : c
          )
        );
      }
    }
    function handleCommentRead(data) {
      if (data.appointmentId === appt._id) {
        setComments(prev =>
          prev.map(c => {
            // Only update if this user hasn't marked it read yet
            if (!c.readBy?.includes(data.userId)) {
              const newReadBy = [...(c.readBy || []), data.userId];

              // Determine if this read event should flip the status to 'read'
              // It should only happen if the reader is the partner (Buyer/Seller), NOT Admin
              // We check if the data.userId matches either buyer or seller ID from the appointment prop
              // Note: appt.buyerId/sellerId might be objects or strings, handle both safely
              const buyerId = appt.buyerId?._id || appt.buyerId;
              const sellerId = appt.sellerId?._id || appt.sellerId;

              // If reader is a participant, we mark status as read
              const isParticipant = data.userId === buyerId || data.userId === sellerId;

              // Should we update status? Only if it's a participant reading it
              const newStatus = isParticipant ? "read" : c.status;

              return { ...c, readBy: newReadBy, status: newStatus, ...(isParticipant ? { readAt: new Date() } : {}) };
            }
            return c;
          })
        );
      }
    }
    socket.on('commentDelivered', handleCommentDelivered);
    socket.on('commentRead', handleCommentRead);
    return () => {
      socket.off('commentDelivered', handleCommentDelivered);
      socket.off('commentRead', handleCommentRead);
    };
  }, [appt._id, setComments]);

  // Get clear time from localStorage
  const clearTimeKey = `chatClearTime_${appt._id}`;
  const localClearMs = Number(localStorage.getItem(clearTimeKey)) || 0;
  const serverClearMs = (() => {
    const clearedAt = appt.role === 'buyer' ? appt.buyerChatClearedAt : appt.sellerChatClearedAt;
    return clearedAt ? new Date(clearedAt).getTime() : 0;
  })();
  const clearTime = Math.max(localClearMs, serverClearMs);

  // Calculate unread messages for the current user (exclude deleted/cleared/locally removed)
  const locallyRemovedIds = getLocallyRemovedIds(appt._id);
  const unreadCount = comments.filter(c =>
    !c.readBy?.includes(currentUser._id) &&
    c.senderEmail !== currentUser.email &&
    !c.deleted &&
    new Date(c.timestamp).getTime() > clearTime &&
    !(c.removedFor?.includes?.(currentUser._id)) &&
    !locallyRemovedIds.includes(c._id)
  ).length;

  // Sync unreadNewMessages with actual unread count when chat is opened
  useEffect(() => {
    if (showChatModal && unreadNewMessages === 0 && unreadCount > 0) {
      setUnreadNewMessages(unreadCount);
    }
  }, [showChatModal, unreadCount, unreadNewMessages]);

  // Initialize unread count when comments change and user is not in chat
  useEffect(() => {
    if (!showChatModal && unreadCount > 0) {
      setUnreadNewMessages(unreadCount);
    }
  }, [unreadCount, showChatModal]);

  // Initialize unread count when component mounts or when comments are first loaded
  useEffect(() => {
    if (comments.length > 0 && unreadCount > 0 && unreadNewMessages === 0) {
      setUnreadNewMessages(unreadCount);
    }
  }, [comments, unreadCount, unreadNewMessages]);

  // Fetch and restore unread count when component mounts (for page refresh scenarios)
  useEffect(() => {
    const restoreUnreadCount = async () => {
      if (comments.length > 0 && unreadNewMessages === 0) {
        // Calculate actual unread count from backend data
        const actualUnreadCount = comments.filter(c =>
          !c.readBy?.includes(currentUser._id) &&
          c.senderEmail !== currentUser.email &&
          !c.deleted &&
          new Date(c.timestamp).getTime() > clearTime &&
          !(c.removedFor?.includes?.(currentUser._id)) &&
          !getLocallyRemovedIds(appt._id).includes(c._id)
        ).length;

        if (actualUnreadCount > 0) {
          setUnreadNewMessages(actualUnreadCount);
        }
      }
    };

    restoreUnreadCount();
  }, [comments, currentUser._id, appt._id, unreadNewMessages]);



  useEffect(() => {
    if (showChatModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      // When chat is closed, restore unread count if there are still unread messages
      if (unreadCount > 0) {
        setUnreadNewMessages(unreadCount);
      } else {
        setUnreadNewMessages(0);
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showChatModal, unreadCount]);
  // Filter out locally removed deleted messages
  const filteredComments = comments.filter(c => {
    const isTemp = c._id && c._id.toString().startsWith('temp-');
    if (isTemp) return true; // Always show temporary messages
    return new Date(c.timestamp).getTime() > clearTime && !locallyRemovedIds.includes(c._id) && !(c.removedFor?.includes?.(currentUser._id));
  });



  useEffect(() => {
    if (!showChatModal || !otherParty?._id) return;
    let offlineGraceTimer = null;

    // Ask backend if the other party is online
    socket.emit('checkUserOnline', { userId: otherParty._id });

    // Re-check immediately when OUR socket reconnects
    function handleReconnect() {
      socket.emit('checkUserOnline', { userId: otherParty._id });
    }
    socket.on('connect', handleReconnect);

    // Poll every 10 seconds to keep status fresh and stable
    const pollInterval = setInterval(() => {
      socket.emit('checkUserOnline', { userId: otherParty._id });
    }, 10000);

    // Listen for response with grace period for offline transitions
    function handleUserOnlineStatus(data) {
      if (data.userId === otherParty._id) {
        if (data.online) {
          // Coming online: apply immediately, cancel any pending offline timer
          if (offlineGraceTimer) { clearTimeout(offlineGraceTimer); offlineGraceTimer = null; }
          setIsOtherPartyOnline(true);
        } else {
          // Going offline: wait 12 seconds before marking offline (covers poll gaps)
          if (offlineGraceTimer) clearTimeout(offlineGraceTimer);
          offlineGraceTimer = setTimeout(() => {
            setIsOtherPartyOnline(false);
            setOtherPartyLastSeen(data.lastSeen || null);
          }, 12000);
        }
      }
    }
    socket.on('userOnlineStatus', handleUserOnlineStatus);
    socket.on('userOnlineUpdate', handleUserOnlineStatus);
    return () => {
      clearInterval(pollInterval);
      if (offlineGraceTimer) clearTimeout(offlineGraceTimer);
      socket.off('connect', handleReconnect);
      socket.off('userOnlineStatus', handleUserOnlineStatus);
      socket.off('userOnlineUpdate', handleUserOnlineStatus);
    };
  }, [showChatModal, otherParty?._id]);

  // Check online status for table display (independent of chat modal)
  useEffect(() => {
    if (!otherParty?._id) return;
    let tableOfflineGraceTimer = null;

    // Ask backend if the other party is online for table display
    socket.emit('checkUserOnline', { userId: otherParty._id });

    // Re-check immediately when OUR socket reconnects
    function handleTableReconnect() {
      socket.emit('checkUserOnline', { userId: otherParty._id });
    }
    socket.on('connect', handleTableReconnect);

    // Poll every 10 seconds
    const tablePollInterval = setInterval(() => {
      socket.emit('checkUserOnline', { userId: otherParty._id });
    }, 10000);

    // Listen for response with grace period
    function handleTableUserOnlineStatus(data) {
      if (data.userId === otherParty._id) {
        if (data.online) {
          if (tableOfflineGraceTimer) { clearTimeout(tableOfflineGraceTimer); tableOfflineGraceTimer = null; }
          setIsOtherPartyOnlineInTable(true);
        } else {
          if (tableOfflineGraceTimer) clearTimeout(tableOfflineGraceTimer);
          tableOfflineGraceTimer = setTimeout(() => {
            setIsOtherPartyOnlineInTable(false);
            setOtherPartyLastSeenInTable(data.lastSeen || null);
          }, 12000);
        }
      }
    }

    socket.on('userOnlineStatus', handleTableUserOnlineStatus);
    socket.on('userOnlineUpdate', handleTableUserOnlineStatus);

    return () => {
      clearInterval(tablePollInterval);
      if (tableOfflineGraceTimer) clearTimeout(tableOfflineGraceTimer);
      socket.off('connect', handleTableReconnect);
      socket.off('userOnlineStatus', handleTableUserOnlineStatus);
      socket.off('userOnlineUpdate', handleTableUserOnlineStatus);
    };
  }, [otherParty?._id]);

  // Listen for typing events from the other party
  useEffect(() => {
    function handleTyping(data) {
      if (data.fromUserId === otherParty?._id && data.appointmentId === appt._id) {
        setIsOtherPartyTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsOtherPartyTyping(false), 1000);
      }
    }
    socket.on('typing', handleTyping);
    return () => {
      socket.off('typing', handleTyping);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [otherParty?._id, appt._id]);

  // Keyboard shortcut Ctrl+F to focus message input
  useEffect(() => {
    if (!showChatModal) return;

    // Focus input when chat modal opens (desktop only)
    const focusInput = () => {
      if (inputRef.current && !isMobile) {
        // Use focusWithoutKeyboard to prevent keyboard from opening on mobile
        focusWithoutKeyboard(inputRef.current, inputRef.current.value.length);
      }
    };

    // Focus input after a short delay to ensure modal is fully rendered (desktop only)
    if (!isMobile) {
      setTimeout(focusInput, 100);
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleChatModalClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showChatModal]);

  // Add this helper function near the top of AppointmentRow or before swipeHandlers
  function getMsgIdFromEvent(event) {
    let el = event.target;
    while (el && !el.getAttribute('data-msgid')) {
      el = el.parentElement;
    }
    return el ? el.getAttribute('data-msgid') : null;
  }

  // Format last seen time like WhatsApp
  function formatLastSeen(lastSeenTime) {
    if (!lastSeenTime) return null;

    const lastSeen = new Date(lastSeenTime);
    const now = new Date();
    const diffInMinutes = Math.floor((now - lastSeen) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) {
      return 'last seen just now';
    } else if (diffInMinutes < 60) {
      return `last seen ${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    } else if (diffInHours < 24) {
      return `last seen ${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else if (diffInDays < 7) {
      return `last seen ${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    } else {
      return `last seen ${lastSeen.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: lastSeen.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      })}`;
    }
  }
  // Message selected for header options overlay
  const selectedMessageForHeaderOptions = headerOptionsMessageId && headerOptionsMessageId.startsWith('call-')
    ? null // Call items handled separately
    : (headerOptionsMessageId ? comments.find(msg => msg._id === headerOptionsMessageId) : null);

  // Call selected for header options overlay
  const selectedCallForHeaderOptions = headerOptionsMessageId && headerOptionsMessageId.startsWith('call-')
    ? callHistory.find(call => `call-${call._id || call.callId}` === headerOptionsMessageId)
    : null;
  return (
    <>
      <tr className={`hover:bg-blue-50 dark:hover:bg-gray-800 transition align-top ${!isUpcoming ? 'bg-gray-100 dark:bg-gray-900' : 'dark:bg-gray-800'}`} data-appointment-id={appt._id}>
        <td className="border p-2 dark:border-gray-700 dark:text-gray-200">
          <div>
            <div>{new Date(appt.date).toLocaleDateString('en-GB')}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{appt.time}</div>
            {!isUpcoming && (
              <div className={`text-xs font-medium mt-1 ${appt.purpose === 'rent' && appt.paymentConfirmed && appt.rentalStatus === 'active_rental'
                ? 'text-green-600'
                : 'text-red-600'
                }`}>
                {appt.purpose === 'rent' && appt.paymentConfirmed && appt.rentalStatus === 'active_rental'
                  ? 'Tenants Moved In'
                  : 'Outdated'}
              </div>
            )}
            {isArchived && appt.archivedAt && (
              <div className="text-xs text-gray-500 mt-1">
                Archived: {new Date(appt.archivedAt).toLocaleDateString('en-GB')}
              </div>
            )}
          </div>
        </td>
        <td className="border p-2 dark:border-gray-700 dark:text-gray-200">
          <div>
            {appt.listingId ? (
              <Link
                to={isAdminContext ? `/admin/listing/${appt.listingId._id}` : `/user/listing/${appt.listingId._id}`}
                className="font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer"
              >
                {appt.propertyName}
              </Link>
            ) : (
              <div className="font-semibold">{appt.propertyName}</div>
            )}
          </div>
        </td>
        <td className="border p-2 text-center dark:border-gray-700">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${isSeller ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200" : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200"
            }`}>
            {isSeller ? "Seller" : "Buyer"}
          </span>
        </td>
        <td className="border p-2 dark:border-gray-700 dark:text-gray-200">
          <div>
            {canSeeContactInfo ? (
              <button
                className="font-semibold text-blue-700 hover:underline text-left dark:text-blue-400"
                style={{ cursor: 'pointer' }}
                onClick={() => onShowOtherParty({
                  ...otherParty,
                  isOnline: isOtherPartyOnlineInTable,
                  isTyping: isOtherPartyTyping,
                  lastSeen: otherPartyLastSeenInTable
                }, appt)}
                title="Click to view details"
              >
                {otherParty?.username || 'Unknown'}
              </button>
            ) : (
              <span className="font-semibold">{otherParty?.username || 'Unknown'}</span>
            )}
            {canSeeContactInfo ? (
              <>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <a
                    href={`mailto:${otherParty?.email}`}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline transition-colors duration-200"
                    title="Click to send email"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {otherParty?.email}
                  </a>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {otherParty?.mobileNumber && otherParty?.mobileNumber !== '' ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePhoneClick(otherParty.mobileNumber);
                      }}
                      className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 hover:underline transition-colors duration-200"
                      title="Click to call or copy phone number"
                    >
                      {otherParty.mobileNumber}
                    </button>
                  ) : (
                    'No phone'
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500 italic dark:text-gray-400">
                {isAdmin ? "Contact info available" : "Contact info hidden until accepted"}
              </div>
            )}
          </div>
        </td>
        <td className="border p-2 capitalize dark:border-gray-700 dark:text-gray-200">
          <div className="flex flex-col gap-1">
            <span>{appt.purpose}</span>
            {/* Rental Status Badge */}
            {appt.purpose === 'rent' && appt.rentalStatus && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${appt.rentalStatus === 'active_rental' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' :
                appt.rentalStatus === 'contract_signed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                  appt.rentalStatus === 'move_in_pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                    appt.rentalStatus === 'move_out_pending' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' :
                      appt.rentalStatus === 'completed' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
                        appt.rentalStatus === 'terminated' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                          'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                }`}>
                {appt.rentalStatus === 'pending_contract' ? 'Contract Pending' :
                  appt.rentalStatus === 'contract_signed' ? 'Contract Signed' :
                    appt.rentalStatus === 'move_in_pending' ? 'Move-In Pending' :
                      appt.rentalStatus === 'active_rental' ? 'Active Rental' :
                        appt.rentalStatus === 'move_out_pending' ? 'Move-Out Pending' :
                          appt.rentalStatus === 'completed' ? 'Completed' :
                            appt.rentalStatus === 'terminated' ? 'Terminated' :
                              appt.rentalStatus.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            )}
          </div>
        </td>
        <td className="border p-2 max-w-xs truncate dark:border-gray-700 dark:text-gray-200">{appt.message || 'No message provided'}</td>
        <td className="border p-2 text-center dark:border-gray-700">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${!isUpcoming && appt.purpose === 'rent' && appt.paymentConfirmed && appt.rentalStatus === 'active_rental'
            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
            : getStatusColor(appt.status)
            }`}>
            {!isUpcoming && appt.purpose === 'rent' && appt.paymentConfirmed && appt.rentalStatus === 'active_rental'
              ? 'Tenants Moved In'
              : appt.status === "cancelledByBuyer"
                ? "Cancelled by Buyer"
                : appt.status === "cancelledBySeller"
                  ? "Cancelled by Seller"
                  : appt.status === "cancelledByAdmin"
                    ? "Cancelled by Admin"
                    : appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
          </span>
        </td>
        <td className="border p-2 text-center dark:border-gray-700">
          <PaymentStatusCell appointment={appt} isBuyer={isBuyer} />
        </td>
        <td className="border p-2 text-center dark:border-gray-700">
          <div className="flex flex-col gap-2">
            {/* For archived appointments, show unarchive button */}
            {isArchived ? (
              <button
                className="text-green-600 hover:text-green-800 text-xl"
                onClick={() => handleUnarchiveAppointment(appt._id)}
                title="Unarchive Appointment"
              >
                <FaUndo size={16} />
              </button>
            ) : (
              <>
                {/* For outdated appointments, show delete button and archive button */}
                {!isUpcoming ? (
                  <div className="flex flex-col gap-2">
                    <button
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xl"
                      onClick={handlePermanentDelete}
                      title="Delete outdated appointment from table"
                    >
                      <FaTrash size={18} />
                    </button>
                    {!isAdmin && (
                      <button
                        className="text-gray-600 hover:text-gray-800 text-xl"
                        onClick={() => handleArchiveAppointment(appt._id)}
                        title="Archive outdated appointment"
                      >
                        <FaArchive size={16} />
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Seller approve/deny buttons for pending, upcoming appointments */}
                    {isSeller && appt.status === "pending" && (
                      <>
                        {/* Accept only if buyer paid; otherwise show Accept and Reject */}
                        <button
                          className="text-green-500 hover:text-green-700 text-xl disabled:opacity-50"
                          onClick={() => handleStatusUpdate(appt._id, "accepted")}
                          disabled={actionLoading === appt._id + "accepted" || !appt.paymentConfirmed}
                          title={appt.paymentConfirmed ? "Accept Appointment" : "Accept enabled after buyer payment"}
                        >
                          <FaCheck />
                        </button>
                        {!appt.paymentConfirmed && (
                          <button
                            className="text-red-500 hover:text-red-700 text-xl disabled:opacity-50"
                            onClick={() => handleStatusUpdate(appt._id, "rejected")}
                            disabled={actionLoading === appt._id + "rejected"}
                            title="Reject Appointment"
                          >
                            <FaTimes />
                          </button>
                        )}
                      </>
                    )}
                    {/* Seller cancel button after approval */}
                    {isSeller && appt.status === "accepted" && (
                      <button
                        className="text-red-500 hover:text-red-700 text-xl"
                        onClick={handleUserCancel}
                        title="Cancel Appointment (Seller)"
                      >
                        <FaBan />
                      </button>
                    )}
                    {/* Sale Actions for Seller */}
                    {isSeller && appt.purpose === 'buy' && appt.status === 'accepted' && (
                      <>
                        {/* Mark Token Paid */}
                        {appt.saleStatus === 'negotiation' && (
                          <button
                            className="text-blue-500 hover:text-blue-700 text-xl"
                            onClick={() => handleTokenPaid(appt._id)}
                            disabled={actionLoading === appt._id + 'token_paid'}
                            title="Mark Token Received (Lock Property)"
                          >
                            {actionLoading === appt._id + 'token_paid' ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaMoneyBillWave />}
                          </button>
                        )}

                        {/* Mark Sold */}
                        {(appt.saleStatus === 'negotiation' || appt.saleStatus === 'token_paid') && (
                          <button
                            className="text-emerald-500 hover:text-emerald-700 text-xl"
                            onClick={() => handleSaleComplete(appt._id)}
                            disabled={actionLoading === appt._id + 'sold'}
                            title="Mark as Sold"
                          >
                            {actionLoading === appt._id + 'sold' ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaHandshake />}
                          </button>
                        )}
                      </>
                    )}

                    {/* Dispute Action (For both Buyer and Seller on Sold/Completed items) */}
                    {(appt.saleStatus === 'sold' || appt.status === 'completed') && appt.purpose === 'buy' && (
                      <button
                        className="text-amber-500 hover:text-amber-700 text-xl"
                        onClick={() => handleDispute(appt._id)}
                        title="Report a Dispute"
                      >
                        <FaExclamationTriangle />
                      </button>
                    )}
                    {/* Seller red delete after cancellation, rejection, admin deletion, or deletedByAdmin */}
                    {isSeller && (appt.status === 'cancelledBySeller' || appt.status === 'cancelledByBuyer' || appt.status === 'cancelledByAdmin' || appt.status === 'rejected' || appt.status === 'deletedByAdmin') && (
                      <button
                        className="text-red-500 hover:text-red-700 text-xl"
                        onClick={handlePermanentDelete}
                        title="Remove from table"
                      >
                        <FaTrash />
                      </button>
                    )}
                    {/* Buyer cancel button: allow for both pending and accepted (approved) */}
                    {isBuyer && (appt.status === "pending" || appt.status === "accepted") && (
                      <button
                        className="text-red-500 hover:text-red-700 text-xl"
                        onClick={handleUserCancel}
                        title="Cancel Appointment (Buyer)"
                      >
                        <FaBan />
                      </button>
                    )}
                    {/* Buyer red delete after cancellation, seller cancellation, admin deletion, rejected, or deletedByAdmin */}
                    {isBuyer && (appt.status === 'cancelledByBuyer' || appt.status === 'cancelledBySeller' || appt.status === 'cancelledByAdmin' || appt.status === 'deletedByAdmin' || appt.status === 'rejected') && (
                      <button
                        className="text-red-500 hover:text-red-700 text-xl"
                        onClick={handlePermanentDelete}
                        title="Remove from table"
                      >
                        <FaTrash />
                      </button>
                    )}
                    {/* Admin cancel button */}
                    {isAdmin && (
                      <button
                        className="text-red-500 hover:text-red-700 text-xl"
                        onClick={handleAdminCancel}
                        title="Cancel Appointment (Admin)"
                      >
                        <FaUserShield />
                      </button>
                    )}
                    {/* Archive button: show for non-admin users on their own appointments and outdated appointments */}
                    {!isAdmin && (
                      <button
                        className="text-gray-600 hover:text-gray-800 text-xl"
                        onClick={() => handleArchiveAppointment(appt._id)}
                        title="Archive Appointment"
                      >
                        <FaArchive size={16} />
                      </button>
                    )}
                    {/* Reinitiate button: only show to the cancelling party */}
                    {((appt.status === 'cancelledByBuyer' && isBuyer) || (appt.status === 'cancelledBySeller' && isSeller)) && (() => {
                      const isRefunded = paymentStatusForReinitiate && (paymentStatusForReinitiate.status === 'refunded' || paymentStatusForReinitiate.status === 'partially_refunded');
                      const isExpired = reinitiateCountdown?.expired || false;
                      const isDisabled =
                        (appt.status === 'cancelledByBuyer' && isBuyer && (appt.buyerReinitiationCount || 0) >= 2) ||
                        (appt.status === 'cancelledBySeller' && isSeller && (appt.sellerReinitiationCount || 0) >= 2) ||
                        !appt.buyerId || !appt.sellerId ||
                        isRefunded ||
                        isExpired;

                      return (
                        <div className="flex flex-col items-center">
                          <button
                            className={`text-xs border rounded px-2 py-1 mt-1 ${isDisabled
                              ? 'text-gray-400 border-gray-300 cursor-not-allowed'
                              : 'text-blue-500 hover:text-blue-700 border-blue-500'
                              }`}
                            onClick={() => onOpenReinitiate(appt)}
                            disabled={isDisabled}
                            title={
                              isRefunded
                                ? "Reinitiation not possible - Payment refunded"
                                : isExpired
                                  ? "Reinitiation window expired"
                                  : "Reinitiate or Reschedule Appointment"
                            }
                          >
                            Reinitiate
                          </button>
                          <span className="text-xs text-gray-500 mt-1 flex flex-col items-center gap-0.5">
                            {isExpired ? (
                              <span className="text-red-500 font-semibold">Window expired</span>
                            ) : isRefunded ? (
                              <span className="text-red-500 font-semibold">Refunded</span>
                            ) : reinitiateCountdown && !reinitiateCountdown.expired ? (
                              <span className="text-blue-600 font-semibold">
                                Reinitiation possible for: {reinitiateCountdown.days > 0 ? `${reinitiateCountdown.days}d ` : ''}{reinitiateCountdown.hours}h left
                              </span>
                            ) : null}
                          </span>
                        </div>
                      );
                    })()}
                    {/* Rent Wallet button: show for rental appointments with contract */}
                    {['rent', 'rent discussion', 'inspection', 'property inspection', 'followup', 'follow-up visit', 'follow-up'].includes(appt.purpose?.toLowerCase()) && appt.contractId && (
                      <Link
                        to={`/user/rent-wallet?contractId=${appt.contractId._id || appt.contractId}`}
                        className="text-xs border rounded px-2 py-1 mt-1 text-green-600 hover:text-green-700 border-green-500 bg-green-50 hover:bg-green-100 transition"
                        title="View Rent Wallet"
                      >
                        <FaWallet className="inline mr-1" />
                        Rent Wallet
                      </Link>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </td>
        <td className="border p-2 text-center relative dark:border-gray-700">
          <button
            className={`flex items-center justify-center rounded-full p-3 shadow-lg mx-auto relative transform transition-all duration-200 group ${'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white hover:shadow-xl hover:scale-105'
              }`}
            title={"Open Chat"}
            onClick={() => {
              if (chatLockStatusLoading) {
                return; // Wait for security check to complete
              }
              if (chatLocked && !chatAccessGranted) {
                setShowChatUnlockModal(true);
              } else {
                setShowChatModal(true);
                // Update URL when opening chatbox
                navigate(`/user/my-appointments/chat/${appt._id}?chatopen=true`, { replace: false });
                // Dispatch event to notify App.jsx that chat is opened
                window.dispatchEvent(new CustomEvent('chatOpened', {
                  detail: { appointmentId: appt._id }
                }));
              }
            }}
          >
            {/* Animated circular ring when there are unread messages */}
            {unreadNewMessages > 0 && !isOtherPartyTyping && !((chatLocked || chatLockStatusLoading) && !chatAccessGranted) && !isStatusHidden && (
              <div
                className="absolute inset-0 rounded-full animate-ping"
                style={{
                  border: '3px solid #ef4444', // Red color for unread messages
                }}
              ></div>
            )}

            <FaCommentDots size={22} className={"group-hover:animate-pulse"} />
            {
              <div className="absolute inset-0 bg-white rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
            }
            {/* Show lock icon if chat is locked or loading */}
            {(chatLocked || chatLockStatusLoading) && !chatAccessGranted && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold border-2 border-white">
                {chatLockStatusLoading ? <UrbanSetuSpinner size="sm" isBright={true} /> : '🔒'}
              </span>
            )}
            {/* Typing indicator - highest priority (hide if locked, loading, or status hidden) */}
            {isOtherPartyTyping && !((chatLocked || chatLockStatusLoading) && !chatAccessGranted) && !isStatusHidden && (
              <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold border-2 border-white animate-pulse">
                ...
              </span>
            )}
            {/* Unread count when not typing (hide if locked, loading, or status hidden) */}
            {!isOtherPartyTyping && unreadNewMessages > 0 && !((chatLocked || chatLockStatusLoading) && !chatAccessGranted) && !isStatusHidden && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold border-2 border-white">
                {unreadNewMessages}
              </span>
            )}
            {/* Online status green dot - show when no typing and no unread count (hide if locked, loading, or status hidden) */}
            {!isOtherPartyTyping && unreadNewMessages === 0 && isOtherPartyOnlineInTable && !((chatLocked || chatLockStatusLoading) && !chatAccessGranted) && !isStatusHidden && (
              <span className="absolute -top-1 -right-1 bg-green-500 border-2 border-white rounded-full w-3 h-3"></span>
            )}
          </button>
        </td>
      </tr>
      {showChatModal && createPortal((
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-md flex items-center justify-center z-50 p-4">

          {/* Quick Reactions Model - Fixed Overlay */}
          {showReactionsEmojiPicker && reactionsMessageId && (
            <div
              className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-[999999] animate-fadeIn"
              onMouseDown={(e) => {
                // Only close on backdrop mousedown, not modal content
                if (e.target === e.currentTarget) {
                  setShowReactionsEmojiPicker(false);
                }
              }}
              onClick={(e) => {
                // Close modal only when clicking on backdrop, not modal content
                if (e.target === e.currentTarget) {
                  setShowReactionsEmojiPicker(false);
                }
              }}
            >
              <div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-hidden quick-reactions-modal"
                onMouseDown={(e) => {
                  e.stopPropagation(); // Prevent any event bubbling
                }}
                onClick={(e) => {
                  e.stopPropagation(); // Prevent any event bubbling
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">Quick Reactions</div>
                  <button
                    onMouseDown={(e) => {
                      e.stopPropagation(); // Prevent event bubbling
                      e.preventDefault(); // Prevent default behavior
                    }}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent event bubbling
                      setShowReactionsEmojiPicker(false);
                      setReactionEmojiSearchTerm(''); // Clear search when closing
                    }}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full p-2 transition-colors"
                    title="Close"
                  >
                    <FaTimes size={16} />
                  </button>
                </div>

                {/* Search Box */}
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search emojis..."
                      value={reactionEmojiSearchTerm}
                      onChange={(e) => setReactionEmojiSearchTerm(e.target.value)}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                  {reactionEmojiSearchTerm && (
                    <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      {getFilteredEmojis(reactionEmojiSearchTerm).length} emoji{getFilteredEmojis(reactionEmojiSearchTerm).length !== 1 ? 's' : ''} found
                    </div>
                  )}
                </div>
                <div
                  className="overflow-y-auto max-h-[60vh] scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800"
                  onMouseDown={(e) => {
                    e.stopPropagation(); // Prevent any event bubbling
                  }}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent any event bubbling
                  }}
                >
                  <div
                    className="grid grid-cols-10 gap-2"
                    onMouseDown={(e) => {
                      e.stopPropagation(); // Prevent any event bubbling
                    }}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent any event bubbling
                    }}
                  >
                    {getFilteredEmojis(reactionEmojiSearchTerm).map((emoji) => (
                      <button
                        key={emoji}
                        onMouseDown={(e) => {
                          e.stopPropagation(); // Prevent event bubbling
                          e.preventDefault(); // Prevent default behavior
                        }}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent event bubbling
                          e.preventDefault(); // Prevent default behavior

                          // Ensure we have the required IDs
                          if (reactionsMessageId && appt._id) {
                            // Call the function directly
                            handleQuickReaction(reactionsMessageId, emoji);

                            // Close the modal after successful reaction selection
                            setShowReactionsEmojiPicker(false);
                          } else {
                            toast.error('Unable to add reaction - missing message information');
                          }
                        }}
                        className="w-10 h-10 flex items-center justify-center text-xl hover:scale-110 transition-all duration-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-300 hover:shadow-md"
                        title={`React with ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="bg-gradient-to-br from-white via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-slate-900 rounded-3xl shadow-2xl w-full h-full max-w-6xl max-h-full p-0 relative animate-fadeIn flex flex-col border border-gray-200 dark:border-gray-700 transform transition-all duration-500 hover:shadow-3xl overflow-hidden">
            <>
              {/* Chat Header (sticky on mobile to avoid URL bar overlap) */}
              <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 border-b-2 border-blue-700 bg-gradient-to-r from-blue-700 via-purple-700 to-blue-900 rounded-t-3xl relative shadow-2xl flex-shrink-0 md:sticky md:top-0 sticky top-[env(safe-area-inset-top,0px)] z-30">
                {isSelectionMode ? (
                  // Multi-select header
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-white text-sm cursor-pointer hover:text-blue-200 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedMessages.length === filteredComments.length && filteredComments.length > 0}
                          onChange={() => {
                            if (selectedMessages.length === filteredComments.length) {
                              // If all are selected, deselect all
                              setSelectedMessages([]);
                            } else {
                              // Select all non-deleted messages
                              setSelectedMessages([...filteredComments]);
                            }
                          }}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <span className="font-medium">Select All Messages</span>
                      </label>
                      <span className="text-white text-sm font-medium">
                        ({selectedMessages.length} message{selectedMessages.length !== 1 ? 's' : ''} selected)
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      {selectedMessages.length === 1 ? (
                        // Single message selected - show individual message options
                        <div className="flex items-center gap-2">
                          {(() => {
                            const selectedMsg = selectedMessages[0];
                            const isSentMessage = selectedMsg.senderEmail === currentUser.email;
                            return (
                              <>
                                {!selectedMsg.deleted && (
                                  <>
                                    <button
                                      className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                                      onClick={() => {
                                        startReply(selectedMsg);
                                        setIsSelectionMode(false);
                                        setSelectedMessages([]);
                                      }}
                                      title="Reply"
                                      aria-label="Reply"
                                    >
                                      <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c4.28 0 6.92 1.45 8.84 4.55.23.36.76.09.65-.32C18.31 13.13 15.36 10.36 10 9z" /></svg>
                                    </button>
                                    <button
                                      className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                                      onClick={() => {
                                        copyMessageToClipboard(selectedMsg.message);
                                        setIsSelectionMode(false);
                                        setSelectedMessages([]);
                                      }}
                                      title="Copy message"
                                      aria-label="Copy message"
                                    >
                                      <FaCopy size={18} />
                                    </button>
                                    <button
                                      className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                                      onClick={async () => {
                                        const isStarred = selectedMsg.starredBy?.includes(currentUser._id);
                                        setMultiSelectActions(prev => ({ ...prev, starring: true }));
                                        try {
                                          const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${selectedMsg._id}/star`, {
                                            method: 'PATCH',
                                            body: JSON.stringify({ starred: !isStarred })
                                          });
                                          if (!res.ok) {
                                            const errorData = await res.json().catch(() => ({}));
                                            throw { response: { status: res.status, data: errorData } };
                                          }
                                          const data = await res.json();
                                          setComments(prev => prev.map(c =>
                                            c._id === selectedMsg._id
                                              ? {
                                                ...c,
                                                starredBy: isStarred
                                                  ? (c.starredBy || []).filter(id => id !== currentUser._id)
                                                  : [...(c.starredBy || []), currentUser._id]
                                              }
                                              : c
                                          ));
                                          toast.success(isStarred ? 'Message unstarred.' : 'Message starred.');
                                        } catch (err) {
                                          toast.error(err.response?.data?.message || 'Failed to update star status');
                                        } finally {
                                          setMultiSelectActions(prev => ({ ...prev, starring: false }));
                                        }
                                        setIsSelectionMode(false);
                                        setSelectedMessages([]);
                                      }}
                                      title={selectedMsg.starredBy?.includes(currentUser._id) ? "Unstar message" : "Star message"}
                                      aria-label={selectedMsg.starredBy?.includes(currentUser._id) ? "Unstar message" : "Star message"}
                                      disabled={multiSelectActions.starring}
                                    >
                                      {multiSelectActions.starring ? (
                                        <UrbanSetuSpinner size="sm" isBright={true} />
                                      ) : selectedMsg.starredBy?.includes(currentUser._id) ? (
                                        <FaStar size={18} />
                                      ) : (
                                        <FaRegStar size={18} />
                                      )}
                                    </button>
                                    {isSentMessage && null}
                                    <button
                                      className={`rounded-full p-2 transition-colors ${isChatSendBlocked
                                        ? 'text-gray-400 bg-white/5 cursor-not-allowed'
                                        : 'text-white hover:text-red-200 bg-white/10 hover:bg-white/20'
                                        }`}
                                      onClick={() => {
                                        if (isChatSendBlocked) {
                                          toast.info('Delete disabled for this appointment status. You can view chat history.');
                                          return;
                                        }
                                        setMessageToDelete(selectedMsg);
                                        setDeleteForBoth(isChatSendBlocked ? false : isSentMessage);
                                        setShowDeleteModal(true);
                                        setIsSelectionMode(false);
                                        setSelectedMessages([]);
                                      }}
                                      disabled={isChatSendBlocked}
                                      title={isChatSendBlocked ? "Delete disabled for this appointment status" : "Delete"}
                                      aria-label={isChatSendBlocked ? "Delete disabled for this appointment status" : "Delete"}
                                    >
                                      <FaTrash size={18} />
                                    </button>
                                  </>
                                )}
                                {selectedMsg.deleted && (
                                  <button
                                    className={`rounded-full p-2 transition-colors ${isChatSendBlocked
                                      ? 'text-gray-400 bg-white/5 cursor-not-allowed'
                                      : 'text-white hover:text-red-200 bg-white/10 hover:bg-white/20'
                                      }`}
                                    onClick={async () => {
                                      if (isChatSendBlocked) {
                                        toast.info('Delete disabled for this appointment status. You can view chat history.');
                                        return;
                                      }
                                      try {
                                        await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${selectedMsg._id}/remove-for-me`, {
                                          method: 'PATCH',
                                          body: JSON.stringify({})
                                        });
                                      } catch { }
                                      setComments(prev => prev.filter(msg => msg._id !== selectedMsg._id));
                                      addLocallyRemovedId(appt._id, selectedMsg._id);
                                      toast.success('Message deleted for you!');
                                      setIsSelectionMode(false);
                                      setSelectedMessages([]);
                                    }}
                                    disabled={isChatSendBlocked}
                                    title={isChatSendBlocked ? "Delete disabled for this appointment status" : "Delete for me"}
                                    aria-label={isChatSendBlocked ? "Delete disabled for this appointment status" : "Delete for me"}
                                  >
                                    <FaTrash size={18} />
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      ) : selectedMessages.length > 1 ? (
                        // Multiple messages selected - show bulk actions
                        <div className="flex items-center gap-2">
                          {selectedMessages.some(msg => msg.deleted) ? (
                            <button
                              className={`rounded-full p-2 transition-colors ${isChatSendBlocked
                                ? 'text-gray-400 bg-white/5 cursor-not-allowed'
                                : 'text-white hover:text-red-200 bg-white/10 hover:bg-white/20'
                                }`}
                              onClick={async () => {
                                if (isChatSendBlocked) {
                                  toast.info('Delete disabled for this appointment status. You can view chat history.');
                                  return;
                                }
                                const ids = selectedMessages.map(msg => msg._id);
                                try {
                                  const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/removed/sync`, {
                                    method: 'POST',
                                    body: JSON.stringify({ removedIds: ids })
                                  });
                                  if (!res.ok) {
                                    const errorData = await res.json().catch(() => ({}));
                                    throw { response: { status: res.status, data: errorData } };
                                  }
                                  setComments(prev => prev.filter(msg => !ids.includes(msg._id)));
                                  ids.forEach(cid => addLocallyRemovedId(appt._id, cid));
                                  toast.success(`Deleted ${ids.length} messages for you!`);
                                  setIsSelectionMode(false);
                                  setSelectedMessages([]);
                                } catch (e) {
                                  toast.error(e.response?.data?.message || 'Failed to delete selected messages for you.');
                                }
                              }}
                              disabled={isChatSendBlocked}
                              title={isChatSendBlocked ? "Delete disabled for this appointment status" : "Delete selected (for me)"}
                              aria-label={isChatSendBlocked ? "Delete disabled for this appointment status" : "Delete selected (for me)"}
                            >
                              <FaTrash size={18} />
                            </button>
                          ) : (
                            <>
                              <button
                                className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                                onClick={async () => {
                                  setMultiSelectActions(prev => ({ ...prev, starring: true }));
                                  try {


                                    // Process messages one by one to handle individual failures gracefully
                                    let successCount = 0;
                                    let failureCount = 0;
                                    const failedMessages = [];

                                    for (const msg of selectedMessages) {
                                      try {
                                        const isStarred = msg.starredBy?.includes(currentUser._id);
                                        console.log(`Processing message ${msg._id}: currently starred = ${isStarred}, will set starred = ${!isStarred}`);

                                        const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${msg._id}/star`, {
                                          method: 'PATCH',
                                          body: JSON.stringify({ starred: !isStarred })
                                        });
                                        if (!res.ok) {
                                          const errorData = await res.json().catch(() => ({}));
                                          throw { response: { status: res.status, data: errorData } };
                                        }
                                        const response = { status: 200 }; // Mock response object for compatibility if needed

                                        console.log(`Successfully processed message ${msg._id}`);
                                        successCount++;

                                        // Update this specific message in comments
                                        setComments(prev => prev.map(c =>
                                          c._id === msg._id
                                            ? {
                                              ...c,
                                              starredBy: isStarred
                                                ? (c.starredBy || []).filter(id => id !== currentUser._id)
                                                : [...(c.starredBy || []), currentUser._id]
                                            }
                                            : c
                                        ));

                                        // Update starred messages list for this message
                                        setStarredMessages(prev => {
                                          if (isStarred) {
                                            // Remove from starred messages
                                            return prev.filter(m => m._id !== msg._id);
                                          } else {
                                            // Add to starred messages
                                            if (!prev.some(m => m._id === msg._id)) {
                                              return [...prev, { ...msg, starredBy: [...(msg.starredBy || []), currentUser._id] }];
                                            }
                                            return prev;
                                          }
                                        });

                                      } catch (err) {
                                        console.error(`Failed to process message ${msg._id}:`, err);
                                        failureCount++;
                                        failedMessages.push(msg);
                                      }
                                    }

                                    console.log(`Bulk operation completed: ${successCount} successful, ${failureCount} failed`);

                                    // Show appropriate feedback
                                    if (successCount > 0 && failureCount === 0) {
                                      toast.success(`Successfully updated star status for ${successCount} messages`);
                                    } else if (successCount > 0 && failureCount > 0) {
                                      toast.warning(`Partially successful: ${successCount} messages updated, ${failureCount} failed`);
                                    } else {
                                      toast.error(`Failed to update any messages. Please try again.`);
                                    }

                                    // Clear selection mode if all messages were processed successfully
                                    if (failureCount === 0) {
                                      setIsSelectionMode(false);
                                      setSelectedMessages([]);
                                    }
                                  } catch (err) {
                                    console.error('Error in bulk starring operation:', err);
                                    if (err.response) {
                                      console.error('Response data:', err.response.data);
                                      console.error('Response status:', err.response.status);
                                    }
                                    toast.error(err.response?.data?.message || 'Failed to star messages. Please try again.');
                                  } finally {
                                    setMultiSelectActions(prev => ({ ...prev, starring: false }));
                                  }
                                }}
                                title="Star all selected messages"
                                aria-label="Star all selected messages"
                                disabled={multiSelectActions.starring}
                              >
                                {multiSelectActions.starring ? (
                                  <UrbanSetuSpinner size="sm" isBright={true} />
                                ) : (
                                  <FaStar size={18} />
                                )}
                              </button>
                              <button
                                className={`rounded-full p-2 transition-colors ${isChatSendBlocked
                                  ? 'text-gray-400 bg-white/5 cursor-not-allowed'
                                  : 'text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20'
                                  }`}
                                onClick={() => {
                                  if (isChatSendBlocked) {
                                    toast.info('Pinning disabled for this appointment status. You can view chat history.');
                                    return;
                                  }
                                  // For multi-select, open pin modal with selected messages
                                  setMessageToPin(selectedMessages);
                                  setShowPinModal(true);
                                }}
                                title={isChatSendBlocked ? "Pinning disabled for this appointment status" : "Pin all selected messages"}
                                aria-label={isChatSendBlocked ? "Pinning disabled for this appointment status" : "Pin all selected messages"}
                                disabled={multiSelectActions.pinning || isChatSendBlocked}
                              >
                                {multiSelectActions.pinning ? (
                                  <UrbanSetuSpinner size="sm" isBright={true} />
                                ) : (
                                  <FaThumbtack size={18} />
                                )}
                              </button>
                              <button
                                className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                                onClick={() => {
                                  const allMessages = selectedMessages.map(msg => msg.message).join('\n\n');
                                  copyMessageToClipboard(allMessages);
                                  toast.success('Copied all selected messages');
                                  setIsSelectionMode(false);
                                  setSelectedMessages([]);
                                }}
                                title="Copy all selected messages"
                                aria-label="Copy all selected messages"
                              >
                                <FaCopy size={18} />
                              </button>
                              <button
                                className={`rounded-full p-2 transition-colors ${isChatSendBlocked
                                  ? 'text-gray-400 bg-white/5 cursor-not-allowed'
                                  : 'text-white hover:text-red-200 bg-white/10 hover:bg-white/20'
                                  }`}
                                onClick={() => {
                                  if (isChatSendBlocked) {
                                    toast.info('Delete disabled for this appointment status. You can view chat history.');
                                    return;
                                  }
                                  const allSent = selectedMessages.every(msg => msg.senderEmail === currentUser.email);
                                  const hasReceived = selectedMessages.some(msg => msg.senderEmail !== currentUser.email);
                                  setMessageToDelete(selectedMessages);
                                  setDeleteForBoth(isChatSendBlocked ? false : (allSent && !hasReceived));
                                  setShowDeleteModal(true);
                                  setIsSelectionMode(false);
                                  setSelectedMessages([]);
                                }}
                                disabled={isChatSendBlocked}
                                title={isChatSendBlocked ? "Delete disabled for this appointment status" : "Delete all selected messages"}
                                aria-label={isChatSendBlocked ? "Delete disabled for this appointment status" : "Delete all selected messages"}
                              >
                                <FaTrash size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      ) : null}
                      <button
                        className="text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                        onClick={() => {
                          setIsSelectionMode(false);
                          setSelectedMessages([]);
                        }}
                        title="Exit selection mode"
                        aria-label="Exit selection mode"
                      >
                        <FaTimes className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : headerOptionsMessageId && selectedCallForHeaderOptions ? (
                  // Header-level options overlay for call history items (same options as regular messages)
                  <div className="flex items-center justify-end w-full gap-4">
                    <div className="flex items-center gap-4">
                      {/* Reply */}
                      <button
                        className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                        onClick={() => {
                          // Create a fake message-like object for reply functionality
                          const fakeMessage = {
                            _id: `call-${selectedCallForHeaderOptions._id || selectedCallForHeaderOptions.callId}`,
                            senderEmail: (selectedCallForHeaderOptions.callerId?._id === currentUser._id || selectedCallForHeaderOptions.callerId === currentUser._id)
                              ? currentUser.email
                              : (selectedCallForHeaderOptions.receiverId?.email || otherParty?.email),
                            message: `${selectedCallForHeaderOptions.callType === 'video' ? 'Video' : 'Audio'} call`,
                            timestamp: selectedCallForHeaderOptions.startTime || selectedCallForHeaderOptions.createdAt,
                            isCall: true,
                            call: selectedCallForHeaderOptions
                          };
                          startReply(fakeMessage);
                          setHeaderOptionsMessageId(null);
                        }}
                        title="Reply"
                        aria-label="Reply"
                      >
                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c4.28 0 6.92 1.45 8.84 4.55.23.36.76.09.65-.32C18.31 13.13 15.36 10.36 10 9z" /></svg>
                      </button>
                      {/* Call info modal */}
                      <button
                        className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                        onClick={() => {
                          setSelectedCallForInfo(selectedCallForHeaderOptions);
                          setShowCallInfoModal(true);
                          setHeaderOptionsMessageId(null);
                        }}
                        title="Call info"
                        aria-label="Call info"
                      >
                        <FaInfoCircle size={18} />
                      </button>
                      {/* Pin */}
                      {!isChatSendBlocked && (
                        <button
                          className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                          onClick={() => {
                            // Create a fake message-like object for pin functionality
                            const fakeMessage = {
                              _id: `call-${selectedCallForHeaderOptions._id || selectedCallForHeaderOptions.callId}`,
                              senderEmail: (selectedCallForHeaderOptions.callerId?._id === currentUser._id || selectedCallForHeaderOptions.callerId === currentUser._id)
                                ? currentUser.email
                                : (selectedCallForHeaderOptions.receiverId?.email || otherParty?.email),
                              message: `${selectedCallForHeaderOptions.callType === 'video' ? 'Video' : 'Audio'} call`,
                              timestamp: selectedCallForHeaderOptions.startTime || selectedCallForHeaderOptions.createdAt,
                              isCall: true,
                              call: selectedCallForHeaderOptions
                            };
                            setMessageToPin([fakeMessage]);
                            setShowPinModal(true);
                            setHeaderOptionsMessageId(null);
                          }}
                          title="Pin call"
                          aria-label="Pin call"
                        >
                          <FaThumbtack size={18} />
                        </button>
                      )}
                      {/* Delete */}
                      {!isChatSendBlocked && (
                        <button
                          className="text-white hover:text-red-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                          onClick={() => {
                            // Show confirmation modal for call deletion
                            setMessageToDelete({
                              _id: `call-${selectedCallForHeaderOptions._id || selectedCallForHeaderOptions.callId}`,
                              isCall: true,
                              call: selectedCallForHeaderOptions
                            });
                            setShowDeleteModal(true);
                            setHeaderOptionsMessageId(null);
                          }}
                          title="Delete call"
                          aria-label="Delete call"
                        >
                          <FaTrash size={18} />
                        </button>
                      )}
                      {/* Close button */}
                      <button
                        className="text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors z-10 shadow"
                        onClick={() => { setHeaderOptionsMessageId(null); setShowHeaderMoreMenu(false); }}
                        title="Close options"
                        aria-label="Close options"
                      >
                        <FaTimes className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : headerOptionsMessageId && selectedMessageForHeaderOptions ? (
                  // Header-level options overlay (inline icons + three-dots menu + close)
                  <div className="flex items-center justify-end w-full gap-4">
                    <div className="flex items-center gap-4">
                      {/* Reply */}
                      {!selectedMessageForHeaderOptions.deleted && (
                        <button
                          className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                          onClick={() => {
                            startReply(selectedMessageForHeaderOptions);
                            setHeaderOptionsMessageId(null);
                          }}
                          title="Reply"
                          aria-label="Reply"
                        >
                          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c4.28 0 6.92 1.45 8.84 4.55.23.36.76.09.65-.32C18.31 13.13 15.36 10.36 10 9z" /></svg>
                        </button>
                      )}
                      {/* Copy - only for non-deleted messages */}
                      {!selectedMessageForHeaderOptions.deleted && (
                        <button
                          className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                          onClick={() => { copyMessageToClipboard(selectedMessageForHeaderOptions.message); setHeaderOptionsMessageId(null); }}
                          title="Copy message"
                          aria-label="Copy message"
                        >
                          <FaCopy size={18} />
                        </button>
                      )}
                      {/* Star/Unstar */}
                      {/* Star/Unstar - for all messages (sent and received) */}
                      {!selectedMessageForHeaderOptions.deleted && (
                        <button
                          className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                          onClick={async () => {
                            const isStarred = selectedMessageForHeaderOptions.starredBy?.includes(currentUser._id);
                            setStarringSaving(true);
                            try {
                              const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${selectedMessageForHeaderOptions._id}/star`, {
                                method: 'PATCH',
                                body: JSON.stringify({ starred: !isStarred })
                              });
                              if (!res.ok) {
                                const errorData = await res.json().catch(() => ({}));
                                throw { response: { status: res.status, data: errorData } };
                              }
                              const data = await res.json();
                              // Update the local state
                              setComments(prev => prev.map(c =>
                                c._id === selectedMessageForHeaderOptions._id
                                  ? {
                                    ...c,
                                    starredBy: isStarred
                                      ? (c.starredBy || []).filter(id => id !== currentUser._id)
                                      : [...(c.starredBy || []), currentUser._id]
                                  }
                                  : c
                              ));

                              // Update starred messages list
                              if (isStarred) {
                                // Remove from starred messages
                                setStarredMessages(prev => prev.filter(m => m._id !== selectedMessageForHeaderOptions._id));
                              } else {
                                // Add to starred messages
                                setStarredMessages(prev => [...prev, selectedMessageForHeaderOptions]);
                              }

                              toast.success(isStarred ? 'Message unstarred.' : 'Message starred.');
                            } catch (err) {
                              toast.error(err.response?.data?.message || 'Failed to update star status');
                            } finally {
                              setStarringSaving(false);
                            }
                            setHeaderOptionsMessageId(null);
                          }}
                          title={selectedMessageForHeaderOptions.starredBy?.includes(currentUser._id) ? "Unstar message" : "Star message"}
                          aria-label={selectedMessageForHeaderOptions.starredBy?.includes(currentUser._id) ? "Unstar message" : "Star message"}
                          disabled={starringSaving}
                        >
                          {starringSaving ? (
                            <UrbanSetuSpinner size="sm" isBright={true} />
                          ) : selectedMessageForHeaderOptions.starredBy?.includes(currentUser._id) ? (
                            <FaStar size={18} />
                          ) : (
                            <FaRegStar size={18} />
                          )}
                        </button>
                      )}
                      {/* Delete inline (sent: delete for everyone; received: delete locally) */}
                      {!selectedMessageForHeaderOptions.deleted && (
                        <button
                          className={`rounded-full p-2 transition-colors ${isChatSendBlocked
                            ? 'text-gray-400 bg-white/5 cursor-not-allowed'
                            : 'text-white hover:text-red-200 bg-white/10 hover:bg-white/20'
                            }`}
                          onClick={() => {
                            if (isChatSendBlocked) {
                              toast.info('Delete disabled for this appointment status. You can view chat history.');
                              return;
                            }
                            if (selectedMessageForHeaderOptions.senderEmail === currentUser.email) {
                              handleDeleteClick(selectedMessageForHeaderOptions);
                            } else {
                              handleDeleteReceivedMessage(selectedMessageForHeaderOptions);
                            }
                            setHeaderOptionsMessageId(null);
                          }}
                          disabled={isChatSendBlocked}
                          title={isChatSendBlocked ? "Delete disabled for this appointment status" : "Delete"}
                          aria-label={isChatSendBlocked ? "Delete disabled for this appointment status" : "Delete"}
                        >
                          <FaTrash size={18} />
                        </button>
                      )}
                      {/* Three dots menu (Info/Pin/Edit for sent; Pin/Report for received) */}
                      {!selectedMessageForHeaderOptions.deleted && (
                        <div className="relative">
                          <button
                            className="text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            onClick={() => setShowHeaderMoreMenu(prev => !prev)}
                            title="More options"
                            aria-label="More options"
                          >
                            <FaEllipsisV size={14} />
                          </button>
                          {showHeaderMoreMenu && (
                            <div className="absolute top-full right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 min-w-[180px] chat-options-menu">
                              {(selectedMessageForHeaderOptions.senderEmail === currentUser.email) ? (
                                <>
                                  {/* Download option for image messages */}
                                  {selectedMessageForHeaderOptions.imageUrl && (
                                    <button
                                      className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                                      onClick={() => {
                                        handleDownloadChatImage(selectedMessageForHeaderOptions.imageUrl, selectedMessageForHeaderOptions._id);
                                        setShowHeaderMoreMenu(false);
                                        setHeaderOptionsMessageId(null);
                                      }}
                                    >
                                      <FaDownload className="text-sm" />
                                      Download Image
                                    </button>
                                  )}
                                  {/* Download option for video messages */}
                                  {selectedMessageForHeaderOptions.videoUrl && (
                                    <button
                                      className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                                      onClick={async () => {
                                        try {
                                          const response = await authenticatedFetch(selectedMessageForHeaderOptions.videoUrl, { mode: 'cors' });
                                          if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                          const blob = await response.blob();
                                          const blobUrl = window.URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = blobUrl;
                                          a.download = `video-${selectedMessageForHeaderOptions._id || Date.now()}.mp4`;
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
                                          toast.success('Video downloaded successfully');
                                        } catch (error) {
                                          console.error('Video download failed:', error);
                                          // Fallback to direct link
                                          const a = document.createElement('a');
                                          a.href = selectedMessageForHeaderOptions.videoUrl;
                                          a.download = `video-${selectedMessageForHeaderOptions._id || Date.now()}.mp4`;
                                          a.target = '_blank';
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                          toast.success('Video download started');
                                        }
                                        setShowHeaderMoreMenu(false);
                                        setHeaderOptionsMessageId(null);
                                      }}
                                    >
                                      <FaDownload className="text-sm" />
                                      Download Video
                                    </button>
                                  )}
                                  {/* Download option for audio messages */}
                                  {selectedMessageForHeaderOptions.audioUrl && (
                                    <button
                                      className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                                      onClick={async () => {
                                        try {
                                          const response = await authenticatedFetch(selectedMessageForHeaderOptions.audioUrl, { mode: 'cors' });
                                          if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                          const blob = await response.blob();
                                          const blobUrl = window.URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = blobUrl;
                                          a.download = selectedMessageForHeaderOptions.audioName || `audio-${selectedMessageForHeaderOptions._id || Date.now()}`;
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
                                          toast.success('Audio downloaded successfully');
                                        } catch (error) {
                                          const a = document.createElement('a');
                                          a.href = selectedMessageForHeaderOptions.audioUrl;
                                          a.download = selectedMessageForHeaderOptions.audioName || `audio-${selectedMessageForHeaderOptions._id || Date.now()}`;
                                          a.target = '_blank';
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                          toast.success('Audio download started');
                                        }
                                        setShowHeaderMoreMenu(false);
                                        setHeaderOptionsMessageId(null);
                                      }}
                                    >
                                      <FaDownload className="text-sm" />
                                      Download Audio
                                    </button>
                                  )}
                                  <button
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 flex items-center gap-2"
                                    onClick={() => { showMessageInfo(selectedMessageForHeaderOptions); setShowHeaderMoreMenu(false); setHeaderOptionsMessageId(null); }}
                                  >
                                    <FaInfoCircle className="text-sm" />
                                    Info
                                  </button>
                                  <button
                                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${isChatSendBlocked
                                      ? 'text-gray-400 cursor-not-allowed'
                                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                      }`}
                                    onClick={() => {
                                      if (isChatSendBlocked) {
                                        toast.info('Pinning disabled for this appointment status. You can view chat history.');
                                        return;
                                      }
                                      if (selectedMessageForHeaderOptions.pinned) {
                                        handlePinMessage(selectedMessageForHeaderOptions, false);
                                      } else {
                                        setMessageToPin(selectedMessageForHeaderOptions);
                                        setShowPinModal(true);
                                      }
                                      setShowHeaderMoreMenu(false);
                                      setHeaderOptionsMessageId(null);
                                    }}
                                    disabled={pinningSaving || isChatSendBlocked}
                                  >
                                    <FaThumbtack className="text-sm" />
                                    {selectedMessageForHeaderOptions.pinned ? 'Unpin' : 'Pin'}
                                  </button>
                                  <button
                                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${isChatSendBlocked || editingComment !== null
                                      ? 'text-gray-400 cursor-not-allowed'
                                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                      }`}
                                    onClick={() => {
                                      if (isChatSendBlocked) {
                                        toast.info('Edit disabled for this appointment status. You can view chat history.');
                                        return;
                                      }
                                      startEditing(selectedMessageForHeaderOptions);
                                      setShowHeaderMoreMenu(false);
                                      setHeaderOptionsMessageId(null);
                                    }}
                                    disabled={isChatSendBlocked || editingComment !== null}
                                    title={isChatSendBlocked ? "Edit disabled for this appointment status" : "Edit message"}
                                  >
                                    <FaPen className="text-sm" />
                                    Edit
                                  </button>
                                </>
                              ) : (
                                <>
                                  {/* Download option for image messages (for received messages) */}
                                  {selectedMessageForHeaderOptions.imageUrl && (
                                    <button
                                      className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                                      onClick={() => {
                                        handleDownloadChatImage(selectedMessageForHeaderOptions.imageUrl, selectedMessageForHeaderOptions._id);
                                        setShowHeaderMoreMenu(false);
                                        setHeaderOptionsMessageId(null);
                                      }}
                                    >
                                      <FaDownload className="text-sm" />
                                      Download Image
                                    </button>
                                  )}
                                  {/* Download option for video messages (for received messages) */}
                                  {selectedMessageForHeaderOptions.videoUrl && (
                                    <button
                                      className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                                      onClick={async () => {
                                        try {
                                          const response = await authenticatedFetch(selectedMessageForHeaderOptions.videoUrl, { mode: 'cors' });
                                          if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                          const blob = await response.blob();
                                          const blobUrl = window.URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = blobUrl;
                                          a.download = `video-${selectedMessageForHeaderOptions._id || Date.now()}.mp4`;
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
                                        } catch (error) {
                                          console.error('Video download failed:', error);
                                          // Fallback to direct link
                                          const a = document.createElement('a');
                                          a.href = selectedMessageForHeaderOptions.videoUrl;
                                          a.download = `video-${selectedMessageForHeaderOptions._id || Date.now()}.mp4`;
                                          a.target = '_blank';
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                        }
                                        setShowHeaderMoreMenu(false);
                                        setHeaderOptionsMessageId(null);
                                      }}
                                    >
                                      <FaDownload className="text-sm" />
                                      Download Video
                                    </button>
                                  )}
                                  {/* Download option for audio messages (for received messages) */}
                                  {selectedMessageForHeaderOptions.audioUrl && (
                                    <button
                                      className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                                      onClick={async () => {
                                        try {
                                          const response = await authenticatedFetch(selectedMessageForHeaderOptions.audioUrl, { mode: 'cors' });
                                          if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                          const blob = await response.blob();
                                          const blobUrl = window.URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = blobUrl;
                                          a.download = selectedMessageForHeaderOptions.audioName || `audio-${selectedMessageForHeaderOptions._id || Date.now()}`;
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
                                          toast.success('Audio downloaded successfully');
                                        } catch (error) {
                                          const a = document.createElement('a');
                                          a.href = selectedMessageForHeaderOptions.audioUrl;
                                          a.download = selectedMessageForHeaderOptions.audioName || `audio-${selectedMessageForHeaderOptions._id || Date.now()}`;
                                          a.target = '_blank';
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                          toast.success('Audio download started');
                                        }
                                        setShowHeaderMoreMenu(false);
                                        setHeaderOptionsMessageId(null);
                                      }}
                                    >
                                      <FaDownload className="text-sm" />
                                      Download Audio
                                    </button>
                                  )}
                                  <button
                                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${isChatSendBlocked
                                      ? 'text-gray-400 cursor-not-allowed'
                                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                      }`}
                                    onClick={() => {
                                      if (isChatSendBlocked) {
                                        toast.info('Pinning disabled for this appointment status. You can view chat history.');
                                        return;
                                      }
                                      if (selectedMessageForHeaderOptions.pinned) {
                                        handlePinMessage(selectedMessageForHeaderOptions, false);
                                      } else {
                                        setMessageToPin(selectedMessageForHeaderOptions);
                                        setShowPinModal(true);
                                      }
                                      setShowHeaderMoreMenu(false);
                                      setHeaderOptionsMessageId(null);
                                    }}
                                    disabled={pinningSaving || isChatSendBlocked}
                                  >
                                    <FaThumbtack className="text-sm" />
                                    {selectedMessageForHeaderOptions.pinned ? 'Unpin' : 'Pin'}
                                  </button>
                                  <button
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    onClick={() => { setReportingMessage(selectedMessageForHeaderOptions); setShowReportModal(true); setShowHeaderMoreMenu(false); setHeaderOptionsMessageId(null); }}
                                  >
                                    <FaFlag className="text-sm" />
                                    Report
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Delete from chat locally for deleted messages */}
                      {selectedMessageForHeaderOptions.deleted && (
                        <button
                          className="text-white hover:text-red-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                          onClick={() => {
                            setMessageToDelete(selectedMessageForHeaderOptions);
                            setDeleteForBoth(false); // Always delete locally for deleted messages
                            setShowDeleteModal(true);
                            setHeaderOptionsMessageId(null);
                          }}
                          title="Delete from chat locally"
                          aria-label="Delete from chat locally"
                        >
                          <FaTrash size={18} />
                        </button>
                      )}
                    </div>
                    <button
                      className="text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors z-10 shadow"
                      onClick={() => { setHeaderOptionsMessageId(null); setShowHeaderMoreMenu(false); }}
                      title="Close options"
                      aria-label="Close options"
                    >
                      <FaTimes className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  // Original header content
                  <>
                    <div
                      className="bg-white rounded-full p-1 sm:p-1.5 shadow-lg flex-shrink-0 cursor-pointer hover:scale-105 transition-transform duration-200"
                      onClick={() => onShowOtherParty({
                        ...otherParty,
                        isOnline: isOtherPartyOnlineInTable,
                        isTyping: isOtherPartyTyping,
                        lastSeen: otherPartyLastSeenInTable
                      }, appt)}
                      title="Click to view user details"
                    >
                      {otherParty?.avatar ? (
                        <img
                          src={otherParty.avatar}
                          alt={otherParty.username || 'User'}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                          {(otherParty?.username || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className={`flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0 flex-1 ${(chatLocked || chatLockStatusLoading) ? 'pr-2 sm:pr-0' : ''}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <h3
                          className="text-sm sm:text-lg font-bold text-white truncate cursor-pointer hover:underline"
                          onClick={() => onShowOtherParty({
                            ...otherParty,
                            isOnline: isOtherPartyOnlineInTable,
                            isTyping: isOtherPartyTyping,
                            lastSeen: otherPartyLastSeenInTable
                          }, appt)}
                          title="Click to view user details"
                        >
                          {otherParty?.username || 'Unknown User'}
                        </h3>
                        {/* Online status indicator - below name on mobile, inline on desktop */}
                        <div className={`flex items-center gap-1 sm:hidden ${(chatLocked || chatLockStatusLoading) ? 'max-w-[120px]' : ''}`}>
                          {isStatusHidden ? (
                            <span className={`text-gray-100 font-semibold text-[10px] bg-gray-500 bg-opacity-80 px-1.5 py-0.5 rounded-full whitespace-nowrap ${(chatLocked || chatLockStatusLoading) ? 'truncate' : ''}`}>Not available</span>
                          ) : isOtherPartyTyping ? (
                            <span className={`text-yellow-100 font-semibold text-[10px] bg-yellow-500 bg-opacity-80 px-1.5 py-0.5 rounded-full whitespace-nowrap ${(chatLocked || chatLockStatusLoading) ? 'truncate' : ''}`}>Typing...</span>
                          ) : isOtherPartyOnline ? (
                            <span className={`text-green-100 font-semibold text-[10px] bg-green-500 bg-opacity-80 px-1.5 py-0.5 rounded-full whitespace-nowrap ${(chatLocked || chatLockStatusLoading) ? 'truncate' : ''}`}>Online</span>
                          ) : (
                            <span className={`text-gray-100 font-semibold text-[10px] bg-gray-500 bg-opacity-80 px-1.5 py-0.5 rounded-full whitespace-nowrap ${(chatLocked || chatLockStatusLoading) ? 'truncate' : ''}`}>
                              {formatLastSeen(otherPartyLastSeen) || 'Offline'}
                            </span>
                          )}
                        </div>
                        {/* Online status indicator - inline on desktop only */}
                        <div className="hidden sm:flex items-center gap-1">
                          {isStatusHidden ? (
                            <span className="text-gray-100 font-semibold text-xs bg-gray-500 bg-opacity-80 px-2 py-1 rounded-full whitespace-nowrap">Not available</span>
                          ) : isOtherPartyTyping ? (
                            <span className="text-yellow-100 font-semibold text-xs bg-yellow-500 bg-opacity-80 px-2 py-1 rounded-full whitespace-nowrap">Typing...</span>
                          ) : isOtherPartyOnline ? (
                            <span className="text-green-100 font-semibold text-xs bg-green-500 bg-opacity-80 px-2 py-1 rounded-full whitespace-nowrap">Online</span>
                          ) : (
                            <span className="text-gray-100 font-semibold text-xs bg-gray-500 bg-opacity-80 px-2 py-1 rounded-full whitespace-nowrap">
                              {formatLastSeen(otherPartyLastSeen) || 'Offline'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 ml-auto flex-shrink-0">
                      {/* Sound Controls */}
                      <div className="hidden sm:block">
                        <SoundControl
                          onToggleMute={() => {
                            const muted = toggleMute();
                            setIsSoundMuted(muted); // Update reactive state immediately
                            toast.info(`All sounds ${muted ? 'muted' : 'unmuted'}`);
                          }}
                          isMuted={isSoundMuted}
                          currentVolume={currentVolume}
                          onVolumeChange={(volume) => {
                            setVolume(volume);
                            setCurrentVolume(volume); // Update reactive state immediately
                          }}
                        />
                      </div>
                      {/* Lock indicator */}
                      {(chatLocked || chatLockStatusLoading) && (
                        <div
                          title="This chat is Locked"
                          className="flex items-center justify-center bg-orange-500 text-white rounded-full flex-shrink-0 shadow transition-all duration-300 p-2"
                        >
                          {chatLockStatusLoading ? (
                            <UrbanSetuSpinner size="sm" isBright={true} />
                          ) : (
                            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M18 10v-4c0-3.313-2.687-6-6-6s-6 2.687-6 6v4H4v10h16V10h-2zM8 6c0-2.206 1.794-4 4-4s4 1.794 4 4v4H8V6z" />
                            </svg>
                          )}
                        </div>
                      )}



                      {/* Call buttons */}
                      <div className="relative flex items-center gap-2">
                        {/* Audio Call Button */}
                        <button
                          className={`text-white rounded-full p-2 transition-all duration-300 shadow ${
                            isChatSendBlocked
                              ? 'opacity-40 cursor-not-allowed bg-black/10'
                              : 'hover:text-gray-200 bg-white/10 hover:bg-white/20 transform hover:scale-110'
                          }`}
                          onClick={() => {
                            if (isChatSendBlocked) return;
                            const receiverId = appt.buyerId._id === currentUser._id
                              ? appt.sellerId._id
                              : appt.buyerId._id;

                            onInitiateCall(appt, 'audio', receiverId);
                          }}
                          title={isChatSendBlocked ? "Calling disabled for this appointment status" : "Audio Call"}
                          aria-label={isChatSendBlocked ? "Calling disabled for this appointment status" : "Audio Call"}
                          disabled={callState === 'active' || callState === 'ringing' || isChatSendBlocked}
                        >
                          <FaPhone className="text-sm" />
                        </button>

                        {/* Video Call Button */}
                        <button
                          className={`text-white rounded-full p-2 transition-all duration-300 shadow ${
                            isChatSendBlocked
                              ? 'opacity-40 cursor-not-allowed bg-black/10'
                              : 'hover:text-gray-200 bg-white/10 hover:bg-white/20 transform hover:scale-110'
                          }`}
                          onClick={() => {
                            if (isChatSendBlocked) return;
                            const receiverId = appt.buyerId._id === currentUser._id
                              ? appt.sellerId._id
                              : appt.buyerId._id;

                            onInitiateCall(appt, 'video', receiverId);
                          }}
                          title={isChatSendBlocked ? "Calling disabled for this appointment status" : "Video Call"}
                          aria-label={isChatSendBlocked ? "Calling disabled for this appointment status" : "Video Call"}
                          disabled={callState === 'active' || callState === 'ringing' || isChatSendBlocked}
                        >
                          <FaVideo className="text-sm" />
                        </button>
                      </div>

                      {/* Chat options menu */}
                      <div className="relative flex items-center gap-2">
                        {/* Loading icon when refreshing messages */}
                        {loadingComments && (
                          <div className="text-white bg-white/10 rounded-full p-1.5 shadow-sm flex items-center justify-center">
                            <UrbanSetuSpinner size="sm" isBright={true} />
                          </div>
                        )}

                        <button
                          className="text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors shadow"
                          onClick={() => setShowChatOptionsMenu(!showChatOptionsMenu)}
                          title="Chat options"
                          aria-label="Chat options"
                        >
                          <FaEllipsisV className="text-sm" />
                        </button>
                        {showChatOptionsMenu && (
                          <div className="absolute top-full right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 min-w-[180px] chat-options-menu">
                            {/* Contact Information option - only show for accepted status */}
                            {canSeeContactInfo && (
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                                onClick={() => {
                                  onShowOtherParty({
                                    ...otherParty,
                                    isOnline: isOtherPartyOnlineInTable,
                                    isTyping: isOtherPartyTyping,
                                    lastSeen: otherPartyLastSeenInTable
                                  }, appt);
                                  setShowChatOptionsMenu(false);
                                }}
                              >
                                <FaInfoCircle className="text-sm" />
                                Contact Information
                              </button>
                            )}
                            {/* Search Messages option */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 flex items-center gap-2 search-container"
                              onClick={() => {
                                setShowSearchBox(true);
                                setShowChatOptionsMenu(false);
                              }}
                            >
                              <FaSearch className="text-sm" />
                              Search Messages
                            </button>
                            {/* Refresh option */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 flex items-center gap-2"
                              onClick={() => {
                                fetchLatestComments();
                                setShowChatOptionsMenu(false);
                              }}
                            >
                              <FaSync className="text-sm" />
                              Refresh Messages
                            </button>
                            {/* Settings option */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 flex items-center gap-2"
                              onClick={() => {
                                setShowSettingsModal(true);
                                setShowChatOptionsMenu(false);
                              }}
                            >
                              <FaCog className="text-sm" />
                              Settings
                            </button>
                            {/* Starred Messages option */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-yellow-600 hover:bg-yellow-50 flex items-center gap-2"
                              onClick={() => {
                                setShowStarredModal(true);
                                setShowChatOptionsMenu(false);
                              }}
                            >
                              <FaStar className="text-sm" />
                              Starred Messages
                            </button>
                            {/* Media option */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-teal-600 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-900/30 flex items-center gap-2"
                              onClick={() => {
                                setShowMediaModal(true);
                                setMediaModalTab('images');
                                setMediaModalLoading(true);
                                setShowChatOptionsMenu(false);
                                setTimeout(() => setMediaModalLoading(false), 600);
                              }}
                            >
                            <FaPhotoVideo className="text-sm" />
                              Media
                            </button>

                            {/* Select Messages option */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                              onClick={() => {
                                setIsSelectionMode(true);
                                setSelectedMessages([]);
                                setShowChatOptionsMenu(false);
                              }}
                            >
                              <FaCheckSquare className="text-sm" />
                              Select Messages
                            </button>

                            {/* Keyboard shortcuts and file upload guidelines */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 flex items-center gap-2"
                              onClick={() => {
                                setShowShortcutTip(!showShortcutTip);
                                setShowChatOptionsMenu(false);
                              }}
                            >
                              <FaLightbulb className="text-sm" />
                              Tips & Guidelines
                            </button>

                            {/* Export Chat option */}
                            {filteredComments.length > 0 && (
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                                onClick={() => {
                                  setShowChatOptionsMenu(false);
                                  onExportChat(appt, filteredComments, callHistory);
                                }}
                              >
                                <FaDownload className="text-sm" />
                                Export Chat Transcript (PDF)
                              </button>
                            )}

                            {/* Call History option */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-purple-600 hover:bg-purple-50 flex items-center gap-2"
                              onClick={() => {
                                setCallHistoryAppointmentId(appt._id);
                                setShowCallHistoryModal(true);
                                setShowChatOptionsMenu(false);
                              }}
                            >
                              <FaHistory className="text-sm" />
                              Call History
                            </button>

                            {/* Line divider */}
                            <div className="border-t border-gray-200 my-1"></div>

                            {/* Chat Lock/Unlock option */}
                            {(chatLocked || chatLockStatusLoading) ? (
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                onClick={() => {
                                  setShowRemoveLockModal(true);
                                  setShowChatOptionsMenu(false);
                                }}
                              >
                                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M18 10v-4c0-3.313-2.687-6-6-6s-6 2.687-6 6v4H4v10h16V10h-2zM8 6c0-2.206 1.794-4 4-4s4 1.794 4 4v4H8V6z" />
                                </svg>
                                Remove Chat Lock
                              </button>
                            ) : (
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                                onClick={() => {
                                  setShowChatLockModal(true);
                                  setShowChatOptionsMenu(false);
                                }}
                              >
                                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M18 10v-4c0-3.313-2.687-6-6-6s-6 2.687-6 6v4H4v10h16V10h-2zM8 6c0-2.206 1.794-4 4-4s4 1.794 4 4v4H8V6z" />
                                </svg>
                                Lock Chat
                              </button>
                            )}
                            {/* Text Styling option */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-purple-600 hover:bg-purple-50 flex items-center gap-2"
                              onClick={() => {
                                setShowTextStylingPanel(!showTextStylingPanel);
                                setShowChatOptionsMenu(false);
                              }}
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M5 4v3h5.5v12h3V7H19V4H5z" />
                              </svg>
                              Text Styling
                            </button>
                            {/* Report Chat option */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              onClick={() => {
                                setShowReportChatModal(true);
                                setShowChatOptionsMenu(false);
                              }}
                            >
                              <FaFlag className="text-sm" />
                              Report Chat
                            </button>
                            {/* Clear chat option */}
                            {filteredComments.length > 0 && (
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                onClick={() => {
                                  setShowClearChatModal(true);
                                  setShowChatOptionsMenu(false);
                                }}
                              >
                                <FaTrash className="text-sm" />
                                Clear Chat
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <ChatSettingsModal
                        isOpen={showSettingsModal}
                        onClose={() => setShowSettingsModal(false)}
                        settings={settings}
                        updateSetting={updateSetting}
                      />
                      {/* Tips & Guidelines popup */}
                      {showShortcutTip && (
                        <div className="absolute top-full right-0 mt-2 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-20 max-w-xs animate-fadeIn">
                          <button
                            type="button"
                            onClick={() => setShowShortcutTip(false)}
                            className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors p-0.5 rounded-full hover:bg-gray-750"
                            title="Close"
                            aria-label="Close"
                          >
                            <FaTimes size={10} />
                          </button>
                          <div className="font-semibold mb-2">⌨️ Keyboard Shortcuts:</div>
                          <div>• Press Ctrl + / to quickly focus and type your message</div>
                          <div>• @ mention any property/blog/guide</div>
                          <div>• Press Esc to close chatbox.</div>
                          <div className="border-t border-gray-600 pt-2 mt-2">
                            <div className="font-semibold mb-2">📎 File Upload Guidelines:</div>
                            <div>• Photos: JPG, PNG, GIF, WebP (≤ 10MB)</div>
                            <div>• Videos: MP4, WebM, MOV, MKV, OGG (≤ 100MB)</div>
                            <div>• Documents: PDF, DOCX, XLSX, TXT and more (≤ 10MB)</div>
                            <div>• Audio: MP3, WAV, M4A, OGG (≤ 10MB)</div>
                            <div>• Camera: Direct photo capture from device</div>
                            <div>• Add captions to all media types</div>
                          </div>
                          <div className="border-t border-gray-600 pt-2 mt-2">
                            <div className="font-semibold mb-2">💬 Chat Features:</div>
                            <div>• Real-time messaging with socket.io</div>
                            <div>• Message reactions and emoji support</div>
                            <div>• File sharing and media previews</div>
                            <div>• Audio recording with pause/resume</div>
                            <div>• Audio playback with speed controls</div>
                            <div>• Message editing and deletion</div>
                            <div>• Message starring and search</div>
                            <div>• Chat export to PDF</div>
                            <div>• Chat locking for dispute resolution</div>
                          </div>
                          <div className="border-t border-gray-600 pt-2 mt-2">
                            <div className="font-semibold mb-2">🔒 Security & Moderation:</div>
                            <div>• Report inappropriate content</div>
                            <div>• Report chat</div>
                            <div>• Content filtering and moderation</div>
                            <div>• User blocking capabilities</div>
                          </div>
                          <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-800 transform rotate-45"></div>
                        </div>
                      )}
                      <button
                        className="text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors z-10 shadow"
                        onClick={handleChatModalClose}
                        title="Close"
                        aria-label="Close"
                      >
                        <FaTimes className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
              {/* Enhanced Search Header */}
              {showSearchBox && (
                <div className="enhanced-search-header bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 px-3 sm:px-4 py-3 border-b-2 border-blue-700 flex-shrink-0 animate-slideDown">
                  <div className="flex items-center gap-2 sm:gap-3 flex-nowrap">
                    {/* Calendar Search Icon */}
                    <div className="relative calendar-container">
                      <button
                        className="text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-all duration-300 transform hover:scale-110 shadow"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCalendar(!showCalendar);
                        }}
                        title="Jump to date"
                        aria-label="Jump to date"
                      >
                        <FaCalendarAlt className="text-sm" />
                      </button>
                      {showCalendar && (
                        <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[250px] animate-fadeIn"
                          style={{ zIndex: 9999 }}>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Jump to Date</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowCalendar(false);
                              }}
                              className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                            >
                              <FaTimes size={14} />
                            </button>
                          </div>
                          <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleDateSelect(e.target.value);
                            }}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            max={formatDateForInput(new Date())}
                          />
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Select a date to jump to the first message from that day
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Enhanced Search Bar */}
                    <div className="flex-1 flex items-center gap-2 bg-white/20 rounded-full px-3 sm:px-4 py-2 backdrop-blur-sm min-w-0 overflow-hidden">
                      <FaSearch className="text-white/70 text-sm" />
                      <input
                        type="text"
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={handleSearchInputChange}
                        onKeyDown={handleSearchKeyDown}
                        className="bg-transparent text-white placeholder-white/70 text-sm outline-none flex-1 min-w-0 w-full"
                        autoFocus
                      />
                      {searchResults.length > 0 && (
                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                          <span className="text-white/80 text-xs bg-white/10 px-2 py-1 rounded-full">
                            {currentSearchIndex + 1}/{searchResults.length}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setCurrentSearchIndex(prev => prev > 0 ? prev - 1 : searchResults.length - 1)}
                              className="text-white/80 hover:text-white p-1 rounded transition-colors text-xs"
                              title="Previous result"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => setCurrentSearchIndex(prev => prev < searchResults.length - 1 ? prev + 1 : 0)}
                              className="text-white/80 hover:text-white p-1 rounded transition-colors text-xs"
                              title="Next result"
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Close Icon */}
                    <button
                      onClick={() => {
                        setShowSearchBox(false);
                        setSearchQuery("");
                        setSearchResults([]);
                        setCurrentSearchIndex(-1);
                        setShowCalendar(false);
                        // Clear any existing text highlights
                        document.querySelectorAll('.search-text-highlight').forEach(el => {
                          el.outerHTML = el.innerHTML;
                        });
                      }}
                      className="flex-shrink-0 text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-all duration-300 transform hover:scale-110 shadow"
                      title="Close search"
                      aria-label="Close search"
                    >
                      <FaTimes className="text-sm" />
                    </button>
                  </div>
                </div>
              )}
              {/* Chat Content Area */}
              <div className="flex-1 flex flex-col min-h-0">
                {/* Pinned Messages Section */}
                {pinnedMessages.length > 0 && (
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-800 border-b border-purple-200 dark:border-gray-700 px-4 py-3 flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <FaThumbtack className="text-purple-600 text-sm" />
                      <span className="text-purple-700 dark:text-purple-400 font-semibold text-sm">Pinned Messages</span>
                      <span className="text-purple-600 dark:text-purple-400 text-xs">({pinnedMessages.length})</span>
                    </div>
                    <div className="space-y-2 max-h-24 overflow-y-auto">
                      {pinnedMessages.map((pinnedMsg) => (
                        <div
                          key={pinnedMsg._id}
                          className={`bg-white dark:bg-gray-700 rounded-lg p-2 border-l-4 border-purple-500 cursor-pointer transition-all duration-200 hover:shadow-md ${highlightedPinnedMessage === pinnedMsg._id ? 'ring-2 ring-purple-400 shadow-lg' : ''
                            }`}
                          onClick={() => {
                            // Highlight the pinned message and scroll to it (auto-loads if not visible)
                            setHighlightedPinnedMessage(pinnedMsg._id);
                            scrollToMessageById(pinnedMsg._id, 'pinned-highlight');
                            setTimeout(() => setHighlightedPinnedMessage(null), 3000);
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-purple-600 font-medium">
                                  {pinnedMsg.senderEmail === currentUser.email ? 'You' : otherParty?.username || 'Other'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {pinnedMsg.pinDuration === 'custom'
                                    ? `${Math.round((new Date(pinnedMsg.pinExpiresAt) - new Date()) / (1000 * 60 * 60))}h left`
                                    : pinnedMsg.pinDuration === '24hrs'
                                      ? '24h left'
                                      : pinnedMsg.pinDuration === '7days'
                                        ? '7d left'
                                        : '30d left'
                                  }
                                </span>
                              </div>
                              <div className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">
                                {(pinnedMsg.audioUrl || pinnedMsg.type === 'audio') ? (
                                  <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400"><FaMicrophone className="text-xs" /> Voice message</span>
                                ) : (pinnedMsg.videoUrl || pinnedMsg.type === 'video') ? (
                                  <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400"><FaVideo className="text-xs" /> Video</span>
                                ) : (pinnedMsg.imageUrl || pinnedMsg.type === 'image') ? (
                                  <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">📷 Photo</span>
                                ) : (pinnedMsg.documentUrl || pinnedMsg.type === 'document') ? (
                                  <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400"><FaFileAlt className="text-xs" /> Document</span>
                                ) : pinnedMsg.message || ''}
                              </div>
                            </div>
                            <button
                              className="text-purple-600 hover:text-purple-800 p-1 rounded-full hover:bg-purple-100 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePinMessage(pinnedMsg, false);
                              }}
                              title="Unpin message"
                            >
                              <FaThumbtack size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages Container */}
                <div className="flex-1 flex flex-col min-h-0 relative">
                  {isDragOver && (
                    <div className="absolute inset-0 bg-transparent backdrop-blur-sm flex flex-col items-center justify-center z-50 text-white animate-fadeIn pointer-events-none">
                      <div className="relative flex items-center justify-center w-40 h-40 mb-6">
                        {/* Music Note Icon (Far Left) */}
                        <div className="absolute w-16 h-16 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-xl shadow-lg flex items-center justify-center transform -rotate-20 -translate-x-16 translate-y-3 border border-white/20 z-10">
                          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18V5l12-2v13" />
                            <circle cx="6" cy="18" r="3" />
                            <circle cx="18" cy="16" r="3" />
                          </svg>
                        </div>
                        {/* Document Icon (Left/Center) */}
                        <div className="absolute w-16 h-20 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl shadow-xl flex flex-col justify-between p-3 transform -rotate-6 -translate-x-5 -translate-y-4 border border-white/20 z-20">
                          <div className="w-6 h-1.5 bg-white/40 rounded"></div>
                          <div className="space-y-1.5 flex-1 mt-3">
                            <div className="w-full h-1 bg-white/70 rounded"></div>
                            <div className="w-full h-1 bg-white/70 rounded"></div>
                            <div className="w-3/4 h-1 bg-white/70 rounded"></div>
                          </div>
                        </div>
                        {/* Video Play Icon (Right/Center) */}
                        <div className="absolute w-16 h-16 bg-gradient-to-tr from-red-500 to-orange-500 rounded-xl shadow-2xl flex items-center justify-center transform rotate-6 translate-x-5 -translate-y-3 border border-white/20 z-30">
                          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polygon points="10 8 16 12 10 16 10 8" />
                          </svg>
                        </div>
                        {/* Image Icon (Far Right) */}
                        <div className="absolute w-16 h-16 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl shadow-2xl flex items-center justify-center transform rotate-20 translate-x-16 translate-y-3 border border-white/20 z-40">
                          <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">Add anything</h3>
                      <p className="text-gray-300 text-sm max-w-xs text-center px-4">
                        Drop any file here to add it to the conversation
                      </p>
                    </div>
                  )}
                  <div
                    ref={chatContainerRef}
                    className={`flex-1 overflow-y-auto space-y-2 px-4 pt-4 animate-fadeInChat relative bg-gradient-to-b from-transparent to-blue-50/30 dark:to-slate-900/50 ${isDragOver ? 'bg-blue-50/50 dark:bg-blue-900/20 border-2 border-dashed border-blue-300 dark:border-blue-700' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isChatSendBlocked) {
                        setIsDragOver(true);
                      }
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isChatSendBlocked) {
                        setIsDragOver(true);
                      }
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!e.currentTarget.contains(e.relatedTarget)) {
                        setIsDragOver(false);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragOver(false);

                      if (isChatSendBlocked) {
                        toast.info('Image sending disabled for this appointment status. You can view chat history.');
                        return;
                      }

                      const files = Array.from(e.dataTransfer.files);
                      const imageFiles = files.filter(file => file.type.startsWith('image/'));

                      if (imageFiles.length > 0) {
                        handleImageFiles(imageFiles);
                      } else if (files.length > 0) {
                        toast.error('Only image files are supported');
                      }
                    }}
                  >
                    {/* Privacy Notice - First item in chat */}
                  <div
                    className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-l-4 border-blue-400 rounded-r-lg mb-4 backdrop-blur-sm"
                  >
                    <p className="text-sm text-blue-700 dark:text-blue-300 font-medium text-center flex items-center justify-center gap-2">
                      <span className="animate-gentlePulse">🔒</span>
                      Your privacy is our top priority — all your chats and data are fully encrypted for your safety
                    </p>
                  </div>

                  {/* Floating Date Indicator */}
                  {currentFloatingDate && filteredComments.length > 0 && (
                    <div className={`sticky top-0 left-0 right-0 z-30 pointer-events-none transition-all duration-300 ease-in-out ${isScrolling ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                      }`}>
                      <div className="w-full flex justify-center py-2">
                        <div className="bg-blue-600 text-white text-xs px-4 py-2 rounded-full shadow-lg border-2 border-white">
                          {currentFloatingDate}
                        </div>
                      </div>
                    </div>
                  )}
                  {(() => {
                    // Helper function to format call duration (WhatsApp style: M:SS or H:MM:SS)

                    const mergedTimeline = [
                      // Convert chat messages to timeline items
                      ...filteredComments.map(msg => ({
                        type: 'message',
                        id: msg._id,
                        timestamp: new Date(msg.timestamp),
                        message: msg,
                        // For sorting
                        sortTime: new Date(msg.timestamp).getTime()
                      }))
                    ].sort((a, b) => a.sortTime - b.sortTime); // Sort chronologically

                    // If no items at all
                    if (mergedTimeline.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center h-full text-center py-8">
                          <FaCommentDots className="text-gray-300 text-4xl mb-3" />
                          <p className="text-gray-500 font-medium text-sm">No messages yet</p>
                          <p className="text-gray-400 text-xs mt-1">Start the conversation and connect with the other party</p>
                        </div>
                      );
                    }

                    // Render visible items
                    const visibleItems = mergedTimeline.slice(Math.max(0, mergedTimeline.length - Math.min(visibleCount, mergedTimeline.length)));
                    const hasOlderMessages = mergedTimeline.length > visibleItems.length;

                    return (<>
                      {/* Loading older messages indicator */}
                      {isLoadingOlderMessages && (
                        <div className="flex justify-center py-3 animate-fadeIn">
                          <div className="flex items-center gap-2 px-4 py-2 rounded-full border shadow-lg bg-gray-800/90 border-gray-700 text-blue-400 backdrop-blur-md">
                            <UrbanSetuSpinner size="sm" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Loading History</span>
                          </div>
                        </div>
                      )}

                      {/* "Load earlier messages" banner when there are older messages not yet rendered */}
                      {hasOlderMessages && !isLoadingOlderMessages && (
                        <div className="flex justify-center py-2">
                          <button
                            onClick={() => {
                              loadingOlderRef.current = true;
                              setIsLoadingOlderMessages(true);
                              const container = chatContainerRef.current;
                              const prevHeight = container ? container.scrollHeight : 0;
                              setTimeout(() => {
                                setVisibleCount(prev => Math.min(prev + MESSAGES_PAGE_SIZE, filteredComments.length));
                                requestAnimationFrame(() => {
                                  if (container) {
                                    const newHeight = container.scrollHeight;
                                    container.scrollTop = newHeight - prevHeight;
                                  }
                                  setIsLoadingOlderMessages(false);
                                  setTimeout(() => { loadingOlderRef.current = false; }, 300);
                                });
                              }, 150);
                            }}
                            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-blue-400 bg-gray-800/60 border border-gray-700 hover:bg-gray-700/80 hover:text-blue-300 transition-all duration-200 shadow-md hover:shadow-lg"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                            Load earlier messages ({mergedTimeline.length - visibleItems.length} more)
                          </button>
                        </div>
                      )}

                      {visibleItems.map((item, mapIndex) => {
                        const index = mergedTimeline.length - visibleItems.length + mapIndex;
                        const previousItem = index > 0 ? mergedTimeline[index - 1] : null;
                        const currentDate = item.timestamp;
                        const previousDate = previousItem ? previousItem.timestamp : null;
                        const isNewDay = previousDate ? currentDate.toDateString() !== previousDate.toDateString() : true;


                        // If it's a message, render chat message (existing logic)
                        const c = item.message;
                        const isMe = c.senderEmail === currentUser.email;
                        const isEditing = editingComment === c._id;
                        const formattedDate = currentDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });

                        return (
                          <React.Fragment key={c._id || index}>
                            {isNewDay && (
                              <div className="w-full flex justify-center my-2">
                                <span className="bg-blue-600 text-white text-xs px-4 py-2 rounded-full shadow-lg border-2 border-white">{getDateLabel(currentDate)}</span>
                              </div>
                            )}
                            {/* New messages divider: only right after opening when unread exists */}
                            {showUnreadDividerOnOpen && unreadNewMessages > 0 && item.type === 'message' && (() => {
                              // Find the index of this message in filteredComments
                              const messageIndex = filteredComments.findIndex(msg => msg._id === c._id);
                              return messageIndex === filteredComments.length - unreadNewMessages;
                            })() && (
                                <div className="w-full flex items-center my-2">
                                  <div className="flex-1 h-px bg-gray-300"></div>
                                  <span className="mx-2 text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-200">
                                    {unreadNewMessages} unread message{unreadNewMessages > 1 ? 's' : ''}
                                  </span>
                                  <div className="flex-1 h-px bg-gray-300"></div>
                                </div>
                              )}
                            <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} animate-fadeInChatBubble`} style={{ animationDelay: `${0.03 * index}s` }}>
                              {/* Selection checkbox - only show in selection mode */}
                              {isSelectionMode && (
                                <div className={`flex items-start ${isMe ? 'order-2 ml-2' : 'order-1 mr-2'}`}>
                                  <input
                                    type="checkbox"
                                    checked={selectedMessages.some(msg => msg._id === c._id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedMessages(prev => [...prev, c]);
                                      } else {
                                        setSelectedMessages(prev => prev.filter(msg => msg._id !== c._id));
                                      }
                                    }}
                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                  />
                                </div>
                              )}
                              <div
                                ref={el => messageRefs.current[c._id] = el}
                                id={`message-${c._id}`}
                                data-message-id={c._id}
                                className={`relative rounded-2xl px-4 sm:px-5 shadow-xl max-w-[90%] sm:max-w-[80%] md:max-w-[70%] lg:max-w-[60%] xl:max-w-[50%] break-words overflow-visible transition-all duration-300 min-h-[60px] ${c.audioUrl && !c.deleted ? 'min-w-[280px] sm:min-w-[320px]' : ''} ${settings.messageDensity === 'compact' ? 'py-1' : settings.messageDensity === 'spacious' ? 'py-5' : 'py-3'
                                  } ${settings.fontSize === 'small' ? 'text-xs' : settings.fontSize === 'large' ? 'text-base' : 'text-sm'
                                  } ${isMe
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-500 hover:to-purple-600 text-white shadow-blue-200 dark:shadow-blue-900/40 hover:shadow-blue-300 hover:shadow-2xl'
                                    : 'bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 shadow-gray-200 dark:shadow-gray-900/40 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-xl'
                                  } ${highlightedPinnedMessage === c._id ? 'ring-4 ring-purple-400 shadow-2xl scale-105' : ''
                                  } ${isSelectionMode && selectedMessages.some(msg => msg._id === c._id) ? 'ring-2 ring-blue-400' : ''}`}
                                style={{ animationDelay: `${0.03 * index}s` }}
                              >
                                {/* Reply preview above message if this is a reply */}
                                {c.replyTo && (() => {
                                  // Check if replyTo is a call (starts with "call-")
                                  const isCallReply = c.replyTo.startsWith('call-');
                                  let repliedMessage = null;

                                  if (isCallReply) {
                                    // Look for the call in callHistory
                                    const callId = c.replyTo.replace('call-', '');
                                    const repliedCall = callHistory.find(call =>
                                      (call._id || call.callId) === callId
                                    );
                                    if (repliedCall) {
                                      repliedMessage = {
                                        message: `${repliedCall.callType === 'video' ? 'Video' : 'Audio'} call`
                                      };
                                    }
                                  } else {
                                    // Look for the message in comments
                                    repliedMessage = comments.find(msg => msg._id === c.replyTo);
                                  }

                                  return (
                                    <div className="border-l-4 border-purple-400 pl-3 mb-2 text-xs bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 dark:hover:from-purple-900/40 dark:hover:to-blue-900/40 rounded-lg w-full max-w-full break-words cursor-pointer transition-all duration-200 hover:shadow-sm" onClick={() => {
                                      if (messageRefs.current[c.replyTo]) {
                                        messageRefs.current[c.replyTo].scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        messageRefs.current[c.replyTo].classList.add('reply-highlight');
                                        setTimeout(() => {
                                          messageRefs.current[c.replyTo]?.classList.remove('reply-highlight');
                                        }, 1600);
                                      } else {
                                        scrollToMessageById(c.replyTo, 'reply-highlight');
                                      }
                                    }} role="button" tabIndex={0} aria-label="Go to replied message">
                                      <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate max-w-[150px] flex items-center gap-1">
                                        <span className="text-purple-500">↩</span>
                                        {repliedMessage?.message?.substring(0, 30) || 'Original message'}{repliedMessage?.message?.length > 30 ? '...' : ''}
                                      </span>
                                    </div>
                                  );
                                })()}
                                {/* Sender label for admin messages */}
                                {!isMe && (c.senderEmail !== appt.buyerId?.email) && (c.senderEmail !== appt.sellerId?.email) && (
                                  <div className="font-semibold mb-1 text-xs text-purple-600 dark:text-purple-400">UrbanSetu</div>
                                )}
                                <div className={`text-left ${isMe ? 'font-medium' : ''} ${settings.fontSize === 'small' ? 'text-sm' : settings.fontSize === 'large' ? 'text-lg' : 'text-base'
                                  }`}>
                                  {c.deleted ? (
                                    <span className="flex items-center gap-1 text-gray-400 italic">
                                      <FaBan className="inline-block text-lg" /> {c.senderEmail === currentUser.email ? "You deleted this message" : "This message was deleted."}
                                    </span>
                                  ) : (
                                    <div>
                                      {isEditing ? (
                                        <div className="bg-yellow-100 border-l-4 border-yellow-400 px-2 py-1 rounded">
                                          <span className="text-yellow-800 text-xs font-medium">✏️ Editing this message below...</span>
                                        </div>
                                      ) : (
                                        <>
                                          {/* Image Message */}
                                          {c.imageUrl && (
                                            <div className="mb-2">
                                              <img
                                                src={c.imageUrl}
                                                alt="Shared image"
                                                className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                                onClick={() => {
                                                  const imageUrls = (comments || []).filter(msg => !!msg.imageUrl).map(msg => msg.imageUrl);
                                                  const startIndex = Math.max(0, imageUrls.indexOf(c.imageUrl));
                                                  setPreviewImages(imageUrls);
                                                  setPreviewIndex(startIndex);
                                                  setShowImagePreview(true);
                                                }}
                                                onError={(e) => {
                                                  e.target.src = "https://via.placeholder.com/300x200?text=Image+Not+Found";
                                                  e.target.className = "max-w-full max-h-64 rounded-lg opacity-50";
                                                }}
                                              />
                                            </div>
                                          )}
                                          {/* Video Message */}
                                          {c.videoUrl && (
                                            <VideoMessageBubble
                                              videoUrl={c.videoUrl}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                document.querySelectorAll('audio, video').forEach(mediaEl => {
                                                  if (!mediaEl.paused) {
                                                    mediaEl.pause();
                                                  }
                                                });
                                                const videoUrls = (comments || []).filter(msg => !!msg.videoUrl && !msg.deleted).map(msg => msg.videoUrl);
                                                const startIndex = Math.max(0, videoUrls.indexOf(c.videoUrl));
                                                window.dispatchEvent(new CustomEvent('open-media-preview', {
                                                  detail: { videos: videoUrls, index: startIndex }
                                                }));
                                              }}
                                            />
                                          )}
                                          {/* Audio Message */}
                                          {c.audioUrl && (
                                            <div className="mb-2">
                                              <div className="relative">
                                                <div className="w-full min-w-[280px] sm:min-w-[320px]">
                                                  <audio
                                                    src={c.audioUrl}
                                                    className="w-full"
                                                    controls
                                                    preload="metadata"
                                                    onClick={(e) => e.stopPropagation()}
                                             onPlay={(e) => {
                                               document.querySelectorAll('audio').forEach(otherAudio => { if (otherAudio !== e.target && !otherAudio.paused) otherAudio.pause(); });
                                               document.querySelectorAll('video').forEach(videoEl => { if (!videoEl.paused) videoEl.pause(); });
                                             }}
                                                    ref={(audioEl) => {
                                                      if (audioEl && !audioEl.dataset.audioId) {
                                                        audioEl.dataset.audioId = c._id;

                                                        // Sync with header volume control
                                                        audioEl.volume = currentVolume;
                                                        audioEl.muted = isSoundMuted;

                                                        // Add play event listener to pause other audios
                                                        audioEl.addEventListener('play', () => {
                                                          // Pause all other audio elements
                                                          document.querySelectorAll('audio').forEach(otherAudio => {
                                                            if (otherAudio !== audioEl && !otherAudio.paused) {
                                                              otherAudio.pause();
                                                            }
                                                          });
                                                          // Pause all video elements
                                                          document.querySelectorAll('video').forEach(videoEl => {
                                                            if (!videoEl.paused) {
                                                              videoEl.pause();
                                                            }
                                                          });
                                                        });

                                                        // Add playback rate change listener
                                                        audioEl.addEventListener('ratechange', () => {
                                                          const rate = audioEl.playbackRate;
                                                          const rateDisplay = document.querySelector(`[data-audio-id="${c._id}"].playback-rate-display`);
                                                          if (rateDisplay) {
                                                            rateDisplay.textContent = `${rate}x`;
                                                          }
                                                          // Update active speed in dropdown
                                                          const speedMenu = document.querySelector(`[data-audio-speed-menu="${c._id}"]`);
                                                          if (speedMenu) {
                                                            const speedButtons = speedMenu.querySelectorAll('[data-speed-option]');
                                                            speedButtons.forEach(btn => {
                                                              btn.classList.remove('bg-blue-100', 'text-blue-700');
                                                              btn.classList.add('text-gray-700', 'hover:bg-gray-100');
                                                              if (parseFloat(btn.dataset.speedOption) === rate) {
                                                                btn.classList.remove('text-gray-700', 'hover:bg-gray-100');
                                                                btn.classList.add('bg-blue-100', 'text-blue-700');
                                                              }
                                                            });
                                                          }
                                                        });

                                                        // Add volume change listener for bidirectional sync
                                                        audioEl.addEventListener('volumechange', () => {
                                                          // Update header volume bar when audio player volume changes
                                                          if (!audioEl.muted) {
                                                            setCurrentVolume(audioEl.volume);
                                                            setVolume(audioEl.volume, true); // Skip audio elements to prevent circular updates
                                                          }

                                                          // Check if all audio elements are muted to update header mute state
                                                          const allAudioElements = document.querySelectorAll('audio[data-audio-id]');
                                                          const allMuted = Array.from(allAudioElements).every(audio => audio.muted);
                                                          const anyUnmuted = Array.from(allAudioElements).some(audio => !audio.muted);

                                                          // Only update header mute state if all are muted or if this was a global unmute action
                                                          if (allMuted && !isSoundMuted) {
                                                            // All audio elements are now muted, update header to muted
                                                            setIsSoundMuted(true);
                                                          } else if (anyUnmuted && isSoundMuted) {
                                                            // At least one audio is unmuted and header shows muted, update header to unmuted
                                                            setIsSoundMuted(false);
                                                          }
                                                        });

                                                        // Set initial speed display
                                                        const rateDisplay = document.querySelector(`[data-audio-id="${c._id}"].playback-rate-display`);
                                                        if (rateDisplay) {
                                                          rateDisplay.textContent = `${audioEl.playbackRate}x`;
                                                        }
                                                      }
                                                    }}
                                                  />
                                                </div>
                                                <div className="mt-2 flex justify-between items-center">
                                                  <div className="flex items-center gap-2">
                                                    <button
                                                      className={`px-3 py-1.5 text-xs rounded-full shadow-sm border transition-colors ${isMe ? 'bg-white text-blue-600 hover:bg-blue-50 border-blue-200' : 'bg-blue-600 text-white hover:bg-blue-700 border-transparent'}`}
                                                      onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                          const response = await authenticatedFetch(c.audioUrl, { mode: 'cors' });
                                                          if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                                          const blob = await response.blob();
                                                          const blobUrl = window.URL.createObjectURL(blob);
                                                          const a = document.createElement('a');
                                                          a.href = blobUrl;
                                                          a.download = c.audioName || `audio-${c._id || Date.now()}`;
                                                          document.body.appendChild(a);
                                                          a.click();
                                                          a.remove();
                                                          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
                                                          toast.success('Audio downloaded successfully');
                                                        } catch (error) {
                                                          const a = document.createElement('a');
                                                          a.href = c.audioUrl;
                                                          a.download = c.audioName || `audio-${c._id || Date.now()}`;
                                                          a.target = '_blank';
                                                          document.body.appendChild(a);
                                                          a.click();
                                                          a.remove();
                                                          toast.success('Audio download started');
                                                        }
                                                      }}
                                                      title="Download audio"
                                                    >
                                                      <span className="inline-flex items-center gap-1">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" /></svg>
                                                        Download
                                                      </span>
                                                    </button>
                                                    <span className={`text-xs playback-rate-display ${isMe ? 'text-blue-100' : 'text-gray-500'}`} data-audio-id={c._id}>1x</span>
                                                  </div>

                                                  {/* Three dots menu for audio options */}
                                                  <div className="relative">
                                                    <button
                                                      className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${isMe ? 'text-white hover:bg-blue-500' : 'text-gray-600 hover:bg-gray-200'}`}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        const menu = document.querySelector(`[data-audio-menu="${c._id}"]`);
                                                        if (menu) {
                                                          menu.classList.toggle('hidden');
                                                          // Close other audio menus when opening this one
                                                          if (!menu.classList.contains('hidden')) {
                                                            document.querySelectorAll('[data-audio-menu]').forEach(otherMenu => {
                                                              if (otherMenu !== menu) {
                                                                otherMenu.classList.add('hidden');
                                                              }
                                                            });
                                                          }
                                                        }
                                                      }}
                                                      title="Audio options"
                                                    >
                                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                                      </svg>
                                                    </button>

                                                    {/* Audio options dropdown - Main Menu */}
                                                    <div
                                                      data-audio-menu={c._id}
                                                      className="hidden absolute right-0 bottom-full mb-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[9999]"
                                                    >
                                                      <div className="py-1">
                                                        <button
                                                          className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            const mainMenu = document.querySelector(`[data-audio-menu="${c._id}"]`);
                                                            const speedMenu = document.querySelector(`[data-audio-speed-menu="${c._id}"]`);
                                                            if (mainMenu && speedMenu) {
                                                              mainMenu.classList.add('hidden');
                                                              speedMenu.classList.remove('hidden');
                                                            }
                                                          }}
                                                        >
                                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                          </svg>
                                                          Playback Speed
                                                          <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                          </svg>
                                                        </button>

                                                        <button
                                                          className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            const mainMenu = document.querySelector(`[data-audio-menu="${c._id}"]`);
                                                            const controlsMenu = document.querySelector(`[data-audio-controls-menu="${c._id}"]`);
                                                            if (mainMenu && controlsMenu) {
                                                              mainMenu.classList.add('hidden');
                                                              controlsMenu.classList.remove('hidden');
                                                            }
                                                          }}
                                                        >
                                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6-8h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" />
                                                          </svg>
                                                          Audio Controls
                                                          <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                          </svg>
                                                        </button>
                                                      </div>
                                                    </div>

                                                    {/* Audio Speed Menu */}
                                                    <div
                                                      data-audio-speed-menu={c._id}
                                                      className="hidden absolute right-0 bottom-full mb-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[9999]"
                                                    >
                                                      <div className="py-1">
                                                        <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-2">
                                                          <button
                                                            className="p-1 hover:bg-gray-100 rounded"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              const mainMenu = document.querySelector(`[data-audio-menu="${c._id}"]`);
                                                              const speedMenu = document.querySelector(`[data-audio-speed-menu="${c._id}"]`);
                                                              if (mainMenu && speedMenu) {
                                                                speedMenu.classList.add('hidden');
                                                                mainMenu.classList.remove('hidden');
                                                              }
                                                            }}
                                                          >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                                            </svg>
                                                          </button>
                                                          Playback Speed
                                                        </div>
                                                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                                                          <button
                                                            key={speed}
                                                            data-speed-option={speed}
                                                            className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors ${speed === 1 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                              }`}
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              const audioEl = document.querySelector(`[data-audio-id="${c._id}"]`);
                                                              if (audioEl) {
                                                                audioEl.playbackRate = speed;
                                                                // Update speed display immediately
                                                                const rateDisplay = document.querySelector(`[data-audio-id="${c._id}"].playback-rate-display`);
                                                                if (rateDisplay) {
                                                                  rateDisplay.textContent = `${speed}x`;
                                                                }
                                                              }

                                                              // Update highlighting in the speed menu
                                                              const menu = document.querySelector(`[data-audio-speed-menu="${c._id}"]`);
                                                              if (menu) {
                                                                // Remove highlighting from all speed buttons
                                                                const speedButtons = menu.querySelectorAll('[data-speed-option]');
                                                                speedButtons.forEach(btn => {
                                                                  btn.classList.remove('bg-blue-100', 'text-blue-700');
                                                                  btn.classList.add('text-gray-700', 'hover:bg-gray-100');
                                                                });

                                                                // Add highlighting to the selected speed button
                                                                const selectedButton = menu.querySelector(`[data-speed-option="${speed}"]`);
                                                                if (selectedButton) {
                                                                  selectedButton.classList.remove('text-gray-700', 'hover:bg-gray-100');
                                                                  selectedButton.classList.add('bg-blue-100', 'text-blue-700');
                                                                }
                                                              }

                                                              const speedMenu = document.querySelector(`[data-audio-speed-menu="${c._id}"]`);
                                                              if (speedMenu) {
                                                                speedMenu.classList.add('hidden');
                                                              }
                                                            }}
                                                          >
                                                            <span>{speed}x</span>
                                                            {speed === 1 && <span className="text-xs text-gray-400">Normal</span>}
                                                          </button>
                                                        ))}
                                                      </div>
                                                    </div>

                                                    {/* Audio Controls Menu */}
                                                    <div
                                                      data-audio-controls-menu={c._id}
                                                      className="hidden absolute right-0 bottom-full mb-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[9999]"
                                                    >
                                                      <div className="py-1">
                                                        <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-2">
                                                          <button
                                                            className="p-1 hover:bg-gray-100 rounded"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              const mainMenu = document.querySelector(`[data-audio-menu="${c._id}"]`);
                                                              const controlsMenu = document.querySelector(`[data-audio-controls-menu="${c._id}"]`);
                                                              if (mainMenu && controlsMenu) {
                                                                controlsMenu.classList.add('hidden');
                                                                mainMenu.classList.remove('hidden');
                                                              }
                                                            }}
                                                          >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                                            </svg>
                                                          </button>
                                                          Audio Controls
                                                        </div>

                                                        <button
                                                          className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            const audioEl = document.querySelector(`[data-audio-id="${c._id}"]`);
                                                            if (audioEl) {
                                                              if (audioEl.paused) {
                                                                audioEl.play();
                                                              } else {
                                                                audioEl.pause();
                                                              }
                                                            }
                                                            const menu = document.querySelector(`[data-audio-controls-menu="${c._id}"]`);
                                                            if (menu) {
                                                              menu.classList.add('hidden');
                                                            }
                                                          }}
                                                        >
                                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6-8h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" />
                                                          </svg>
                                                          Toggle Play/Pause
                                                        </button>

                                                        <button
                                                          className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            const audioEl = document.querySelector(`[data-audio-id="${c._id}"]`);
                                                            if (audioEl) {
                                                              audioEl.currentTime = 0;
                                                            }
                                                            const menu = document.querySelector(`[data-audio-controls-menu="${c._id}"]`);
                                                            if (menu) {
                                                              menu.classList.add('hidden');
                                                            }
                                                          }}
                                                        >
                                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                          </svg>
                                                          Restart Audio
                                                        </button>

                                                        <button
                                                          className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                                           onClick={(e) => {
                                                            e.stopPropagation();
                                                            const audioEl = document.querySelector(`[data-audio-id="${c._id}"]`);
                                                            if (audioEl) {
                                                              audioEl.muted = !audioEl.muted;
                                                              // Trigger volumechange event to sync with header
                                                              audioEl.dispatchEvent(new Event('volumechange'));
                                                            }
                                                            const menu = document.querySelector(`[data-audio-controls-menu="${c._id}"]`);
                                                            if (menu) {
                                                              menu.classList.add('hidden');
                                                            }
                                                          }}
                                                        >
                                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                                          </svg>
                                                          Toggle Mute/Unmute
                                                        </button>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                              {c.message && (
                                                <div className={`mt-2 text-sm whitespace-pre-wrap break-words ${isMe ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>
                                                  {c.message}
                                                  {c.edited && (
                                                    <span className={`ml-2 text-[10px] italic whitespace-nowrap ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>(Edited)</span>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                          {/* Document Message */}
                                          {c.documentUrl && (() => {
                                            const { ext, docName } = getChatDocDetails(c.documentUrl, c.documentName, c.documentMimeType);
                                            return (
                                              <div className="mb-2 group relative flex items-center bg-gray-50/90 hover:bg-white border hover:border-blue-200 text-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all w-fit max-w-[85%] sm:max-w-[320px]">
                                                {/* Clickable Area for View */}
                                                <div
                                                  className="flex-1 flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-blue-50/30 transition-colors min-w-0"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    let type = 'document';
                                                    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) type = 'image';
                                                    else if (ext === 'pdf') type = 'pdf';

                                                    // Open preview in new tab
                                                    const previewUrl = `/user/view-chat/preview?url=${encodeURIComponent(c.documentUrl)}&name=${encodeURIComponent(docName)}&type=${type}&participants=${encodeURIComponent((appt.buyerId?._id || '') + ',' + (appt.sellerId?._id || ''))}&appointmentId=${appt._id}&source=my_appointments`;
                                                    window.open(previewUrl, '_blank');
                                                  }}
                                                  title="Click to view document"
                                                >
                                                  <div className="bg-blue-100 p-2 rounded-lg text-blue-600 flex-shrink-0">
                                                    <FaFileAlt size={16} />
                                                  </div>
                                                  <div className="flex flex-col min-w-0 overflow-hidden">
                                                    <span className="text-sm font-medium truncate text-gray-900 w-full text-left">{docName}</span>
                                                  </div>
                                                </div>

                                                {/* Separator */}
                                                <div className="w-[1px] h-8 bg-gray-200 flex-shrink-0" />

                                                {/* Download Button */}
                                                <button
                                                  className="p-3 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors flex-shrink-0 z-10"
                                                  title="Download"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDownloadChatDocument(c.documentUrl, c.documentName, c.documentMimeType);
                                                  }}
                                                >
                                                  <FaDownload size={14} />
                                                </button>
                                              </div>
                                            );
                                          })()}
                                          {/* Link Preview in Message */}
                                          {(() => {
                                            // Only show preview if it wasn't dismissed before sending
                                            if (c.previewDismissed) return null;

                                            const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]{2,}(?:\/[^\s]*)?|[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;
                                            const urls = (c.message || '').match(urlRegex);
                                            if (urls && urls.length > 0) {
                                              return (
                                                <div className="mb-2 max-h-40 overflow-hidden">
                                                  <LinkPreview
                                                    url={urls[0]}
                                                    className="max-w-xs"
                                                    showRemoveButton={false}
                                                    clickable={true}
                                                    isSentMessage={isMe}
                                                  />
                                                </div>
                                              );
                                            }
                                            return null;
                                          })()}

                                          {/* Only show message text for non-audio messages (audio messages handle their caption internally) */}
                                          {!c.audioUrl && (
                                            <div className="inline">
                                              <FormattedTextWithReadMore
                                                text={(c.message || '').replace(/\n+$/, '')}
                                                isSentMessage={isMe}
                                                className="whitespace-pre-wrap break-words"
                                                searchQuery={searchQuery}
                                              />
                                              {c.edited && (
                                                <span className="ml-2 text-[10px] italic text-gray-300 whitespace-nowrap">(Edited)</span>
                                              )}
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 justify-end mt-2" data-message-actions>
                                  {/* Pin indicator for pinned messages */}
                                  {c.pinned && (
                                    <FaThumbtack className={`${isMe ? 'text-purple-300' : 'text-purple-500'} text-[10px]`} title="Pinned message" />
                                  )}
                                  {/* Star indicator for starred messages */}
                                  {c.starredBy?.includes(currentUser._id) && (
                                    <FaStar className={`${isMe ? 'text-yellow-300' : 'text-yellow-500'} text-[10px]`} title="Starred message" />
                                  )}
                                  <span className={`${isMe ? 'text-blue-200' : 'text-gray-500'} text-[10px]`}>
                                    {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                  </span>
                                  {/* Options icon - visible for all messages including deleted ones */}
                                  <button
                                    className={`${c.senderEmail === currentUser.email
                                      ? 'text-blue-200 hover:text-white'
                                      : 'text-gray-500 hover:text-gray-700'
                                      } transition-all duration-200 hover:scale-110 p-1 rounded-full hover:bg-white hover:bg-opacity-20 ml-1`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setHeaderOptionsMessageId(c._id);
                                      if (!isChatSendBlocked) {
                                        toggleReactionsBar(c._id);
                                      }
                                    }}
                                    title="Message options"
                                    aria-label="Message options"
                                  >
                                    <FaEllipsisV size={12} />
                                  </button>

                                  {/* Display reactions */}
                                  {!c.deleted && c.reactions && c.reactions.length > 0 && (
                                    <div className="flex items-center gap-1 ml-1">
                                      {(() => {
                                        // Group reactions by emoji
                                        const groupedReactions = {};
                                        c.reactions.forEach(reaction => {
                                          if (!groupedReactions[reaction.emoji]) {
                                            groupedReactions[reaction.emoji] = [];
                                          }
                                          groupedReactions[reaction.emoji].push(reaction);
                                        });

                                        return Object.entries(groupedReactions).map(([emoji, reactions]) => {
                                          const hasUserReaction = reactions.some(r => r.userId === currentUser._id);
                                          const userNames = reactions.map(r => r.userName).join(', ');

                                          return (
                                            <button
                                              key={emoji}
                                              onClick={() => handleQuickReaction(c._id, emoji)}
                                              className={`text-xs rounded-full px-2 py-1 flex items-center gap-1 transition-all duration-200 hover:scale-105 ${hasUserReaction
                                                ? 'bg-blue-500 border-2 border-blue-600 hover:bg-blue-600 shadow-md'
                                                : 'bg-gray-100 border border-gray-300 hover:bg-gray-200'
                                                }`}
                                              title={`${userNames} reacted with ${emoji}${hasUserReaction ? ' (Click to remove)' : ' (Click to add)'}`}
                                            >
                                              <span>{emoji}</span>
                                              <span className={`${hasUserReaction ? 'text-white font-semibold' : 'text-gray-600'}`}>
                                                {reactions.length}
                                              </span>
                                            </button>
                                          );
                                        });
                                      })()}
                                    </div>
                                  )}
                                  {(c.senderEmail === currentUser.email) && !c.deleted && (
                                    <span className="flex items-center gap-1 ml-1">
                                      {(c.status === 'queued' || c.status === 'sending')
                                        ? <FaClock className="text-yellow-300/80 text-xs animate-pulse transition-all duration-300" title={c.status === 'queued' ? "Waiting for internet connection..." : "Sending..."} />
                                        : c.readBy?.includes(otherParty?._id)
                                          ? <FaCheckDouble className="text-green-400 text-xs transition-all duration-300 animate-fadeIn" title="Read" />
                                          : c.status === 'delivered'
                                            ? <FaCheckDouble className="text-blue-200 text-xs transition-all duration-300 animate-fadeIn" title="Delivered" />
                                            : <FaCheck className="text-blue-200 text-xs transition-all duration-300 animate-fadeIn" title="Sent" />}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Reactions Bar - positioned inside message container (above only) */}
                              {(() => {
                                const shouldShow = !c.deleted && showReactionsBar && reactionsMessageId === c._id;
                                if (!shouldShow) return false;

                                // Only show inline reaction bar if message should be positioned above
                                const messageElement = document.querySelector(`[data-message-id="${c._id}"]`);
                                if (messageElement) {
                                  const messageRect = messageElement.getBoundingClientRect();
                                  const chatContainer = chatContainerRef.current;
                                  if (chatContainer) {
                                    const containerRect = chatContainer.getBoundingClientRect();
                                    const distanceFromTop = messageRect.top - containerRect.top;

                                    // If message is near top and has space below, don't show inline bar (floating bar will handle it)
                                    if (distanceFromTop < 120) {
                                      const spaceBelow = containerRect.bottom - messageRect.bottom;
                                      const reactionBarHeight = 60;

                                      if (spaceBelow >= reactionBarHeight + 20) {
                                        return false; // Don't show inline bar, floating bar will handle it
                                      }
                                    }
                                  }
                                }
                                return true; // Show inline bar for above positioning
                              })() && (
                                  <div className={`absolute -top-8 ${isMe ? 'right-0' : 'left-0'} bg-red-500 dark:bg-red-900/40 rounded-full shadow-lg border-2 border-red-600 dark:border-red-800 p-1 flex items-center gap-1 animate-reactions-bar z-[999999] reactions-bar transition-all duration-300`} style={{ minWidth: 'max-content' }}>
                                    {/* Quick reaction buttons */}
                                    <button
                                      onClick={() => handleQuickReaction(c._id, '👍')}
                                      className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${isChatSendBlocked
                                        ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
                                        : c.reactions?.some(r => r.emoji === '👍' && r.userId === currentUser._id)
                                          ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                                          : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110'
                                        }`}
                                      disabled={isChatSendBlocked}
                                      title={isChatSendBlocked ? "Reactions disabled" : "Like"}
                                    >
                                      👍
                                    </button>
                                    <button
                                      onClick={() => handleQuickReaction(c._id, '❤️')}
                                      className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${isChatSendBlocked
                                        ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
                                        : c.reactions?.some(r => r.emoji === '❤️' && r.userId === currentUser._id)
                                          ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                                          : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110'
                                        }`}
                                      disabled={isChatSendBlocked}
                                      title={isChatSendBlocked ? "Reactions disabled" : "Love"}
                                    >
                                      ❤️
                                    </button>
                                    <button
                                      onClick={() => handleQuickReaction(c._id, '😂')}
                                      className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${isChatSendBlocked
                                        ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
                                        : c.reactions?.some(r => r.emoji === '😂' && r.userId === currentUser._id)
                                          ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                                          : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110'
                                        }`}
                                      disabled={isChatSendBlocked}
                                      title={isChatSendBlocked ? "Reactions disabled" : "Laugh"}
                                    >
                                      😂
                                    </button>
                                    <button
                                      onClick={() => handleQuickReaction(c._id, '😮')}
                                      className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${isChatSendBlocked
                                        ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
                                        : c.reactions?.some(r => r.emoji === '😮' && r.userId === currentUser._id)
                                          ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                                          : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110'
                                        }`}
                                      disabled={isChatSendBlocked}
                                      title={isChatSendBlocked ? "Reactions disabled" : "Wow"}
                                    >
                                      😮
                                    </button>
                                    <button
                                      onClick={() => handleQuickReaction(c._id, '😢')}
                                      className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${isChatSendBlocked
                                        ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
                                        : c.reactions?.some(r => r.emoji === '😢' && r.userId === currentUser._id)
                                          ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                                          : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110'
                                        }`}
                                      disabled={isChatSendBlocked}
                                      title={isChatSendBlocked ? "Reactions disabled" : "Sad"}
                                    >
                                      😢
                                    </button>
                                    <button
                                      onClick={() => handleQuickReaction(c._id, '😡')}
                                      className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${isChatSendBlocked
                                        ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
                                        : c.reactions?.some(r => r.emoji === '😡' && r.userId === currentUser._id)
                                          ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                                          : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110'
                                        }`}
                                      disabled={isChatSendBlocked}
                                      title={isChatSendBlocked ? "Reactions disabled" : "Angry"}
                                    >
                                      😡
                                    </button>
                                    <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                                    <button
                                      onClick={toggleReactionsEmojiPicker}
                                      className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${isChatSendBlocked
                                        ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
                                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110'
                                        }`}
                                      disabled={isChatSendBlocked}
                                      title={isChatSendBlocked ? "Reactions disabled" : "More emojis"}
                                    >
                                      ➕
                                    </button>


                                  </div>
                                )}
                            </div>


                          </React.Fragment>
                        );
                      })}
                    </>);
                  })()}

                  <div ref={chatEndRef} />
                </div>
              </div>
              </div>

              {/* Floating Reaction Bar for Bottom Positioning */}
              {(() => {
                const shouldShow = showReactionsBar && reactionsMessageId;
                if (!shouldShow) return null;

                const messageElement = document.querySelector(`[data-message-id="${reactionsMessageId}"]`);
                if (!messageElement) return null;

                const messageRect = messageElement.getBoundingClientRect();
                const chatContainer = chatContainerRef.current;
                if (!chatContainer) return null;

                const containerRect = chatContainer.getBoundingClientRect();
                const distanceFromTop = messageRect.top - containerRect.top;

                // Only show floating bar if message is near top and needs bottom positioning
                if (distanceFromTop < 120) {
                  const spaceBelow = containerRect.bottom - messageRect.bottom;
                  const reactionBarHeight = 60;

                  if (spaceBelow >= reactionBarHeight + 20) {
                    const comment = comments.find(c => c._id === reactionsMessageId);
                    if (!comment || comment.deleted) return null;

                    const isMe = comment.senderEmail === currentUser.email;

                    return (
                      <div
                        className="fixed bg-red-500 dark:bg-red-900/40 rounded-full shadow-lg border-2 border-red-600 dark:border-red-800 p-1 flex items-center gap-1 animate-reactions-bar z-[999999] reactions-bar transition-all duration-300"
                        style={{
                          minWidth: 'max-content',
                          top: `${messageRect.bottom + 2}px`,
                          left: isMe ? 'auto' : `${messageRect.left}px`,
                          right: isMe ? `${window.innerWidth - messageRect.right}px` : 'auto'
                        }}
                      >
                        {/* Quick reaction buttons */}
                        <button
                          onClick={() => handleQuickReaction(comment._id, '👍')}
                          className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${isChatSendBlocked
                            ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
                            : comment.reactions?.some(r => r.emoji === '👍' && r.userId === currentUser._id)
                              ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                              : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110'
                            }`}
                          disabled={isChatSendBlocked}
                          title={isChatSendBlocked ? "Reactions disabled" : "Like"}
                        >
                          👍
                        </button>
                        <button
                          onClick={() => handleQuickReaction(comment._id, '❤️')}
                          className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${isChatSendBlocked
                            ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
                            : comment.reactions?.some(r => r.emoji === '❤️' && r.userId === currentUser._id)
                              ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                              : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110'
                            }`}
                          disabled={isChatSendBlocked}
                          title={isChatSendBlocked ? "Reactions disabled" : "Love"}
                        >
                          ❤️
                        </button>
                        <button
                          onClick={() => handleQuickReaction(comment._id, '😂')}
                          className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${isChatSendBlocked
                            ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
                            : comment.reactions?.some(r => r.emoji === '😂' && r.userId === currentUser._id)
                              ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                              : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110'
                            }`}
                          disabled={isChatSendBlocked}
                          title={isChatSendBlocked ? "Reactions disabled" : "Laugh"}
                        >
                          😂
                        </button>
                        <button
                          onClick={() => handleQuickReaction(comment._id, '😮')}
                          className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${isChatSendBlocked
                            ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
                            : comment.reactions?.some(r => r.emoji === '😮' && r.userId === currentUser._id)
                              ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                              : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110'
                            }`}
                          disabled={isChatSendBlocked}
                          title={isChatSendBlocked ? "Reactions disabled" : "Wow"}
                        >
                          😮
                        </button>
                        <button
                          onClick={() => handleQuickReaction(comment._id, '😢')}
                          className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${isChatSendBlocked
                            ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
                            : comment.reactions?.some(r => r.emoji === '😢' && r.userId === currentUser._id)
                              ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                              : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110'
                            }`}
                          disabled={isChatSendBlocked}
                          title={isChatSendBlocked ? "Reactions disabled" : "Sad"}
                        >
                          😢
                        </button>
                        <button
                          onClick={() => handleQuickReaction(comment._id, '😡')}
                          className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${isChatSendBlocked
                            ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
                            : comment.reactions?.some(r => r.emoji === '😡' && r.userId === currentUser._id)
                              ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                              : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110'
                            }`}
                          disabled={isChatSendBlocked}
                          title={isChatSendBlocked ? "Reactions disabled" : "Angry"}
                        >
                          😡
                        </button>
                        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                        <button
                          onClick={toggleReactionsEmojiPicker}
                          className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${isChatSendBlocked
                            ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
                            : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110'
                            }`}
                          disabled={isChatSendBlocked}
                          title={isChatSendBlocked ? "Reactions disabled" : "More emojis"}
                        >
                          ➕
                        </button>
                      </div>
                    );
                  }
                }
                return null;
              })()}

              {/* Reply indicator */}
              {replyTo && (
                <div className="px-4 mb-2">
                  <div className="flex items-center bg-blue-50 dark:bg-blue-900/40 border-l-4 border-blue-400 px-2 py-1 rounded">
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-semibold mr-2">Replying to:</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[200px] flex items-center gap-1">
                      {(replyTo.audioUrl || replyTo.type === 'audio') ? (
                        <span className="flex items-center gap-1"><FaMicrophone className="text-[10px] inline" /> Voice message</span>
                      ) : (replyTo.videoUrl || replyTo.type === 'video') ? (
                        <span className="flex items-center gap-1"><FaVideo className="text-[10px] inline" /> Video</span>
                      ) : (replyTo.imageUrl || replyTo.type === 'image') ? (
                        <span className="flex items-center gap-1">📷 Photo</span>
                      ) : (replyTo.documentUrl || replyTo.type === 'document') ? (
                        <span className="flex items-center gap-1"><FaFileAlt className="text-[10px] inline" /> Document</span>
                      ) : (
                        <>{replyTo.message?.substring(0, 40)}{replyTo.message?.length > 40 ? '...' : ''}</>
                      )}
                    </span>
                    <button className="ml-auto text-gray-400 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-1 transition-colors" onClick={() => setReplyTo(null)} title="Cancel reply">
                      <FaTimes className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}



              {/* Edit indicator */}
              {editingComment && (
                <div className="px-4 mb-2">
                  <div className="flex items-center bg-yellow-50 dark:bg-yellow-900/40 border-l-4 border-yellow-400 px-2 py-1 rounded">
                    <span className="text-xs text-yellow-700 dark:text-yellow-300 font-semibold mr-2">✏️ Editing message:</span>
                    <span className="text-xs text-yellow-600 dark:text-yellow-400 truncate">{editText}</span>
                    <button
                      className="ml-auto text-yellow-400 dark:text-yellow-300 hover:text-yellow-700 dark:hover:text-yellow-100 bg-yellow-100 dark:bg-yellow-900/60 hover:bg-yellow-200 dark:hover:bg-yellow-800 rounded-full p-1 transition-colors"
                      onClick={() => {
                        setEditingComment(null);
                        setEditText("");
                        // Restore original draft and clear it after a small delay to ensure state update
                        const draftToRestore = originalDraft;
                        setComment(draftToRestore);
                        setTimeout(() => {
                          setOriginalDraft(""); // Clear stored draft after restoration
                        }, 100);
                        setDetectedUrl(null);
                        setPreviewDismissed(false);
                        setLastDismissedUrl(null);
                        // Auto-resize textarea for restored draft with proper timing
                        setTimeout(() => {
                          if (inputRef.current) {
                            // Force a re-render by triggering the input event
                            const event = new Event('input', { bubbles: true });
                            inputRef.current.dispatchEvent(event);
                            // Reset height first, then calculate proper height
                            inputRef.current.style.height = '48px';
                            const scrollHeight = inputRef.current.scrollHeight;
                            const maxHeight = 144;

                            if (scrollHeight <= maxHeight) {
                              inputRef.current.style.height = scrollHeight + 'px';
                              inputRef.current.style.overflowY = 'hidden';
                            } else {
                              inputRef.current.style.height = maxHeight + 'px';
                              inputRef.current.style.overflowY = 'auto';
                            }
                          }
                        }, 100);
                      }}
                      title="Cancel edit"
                    >
                      <FaTimes className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
              {/* Message Input Footer - Sticky */}
              <div className="flex gap-2 mt-1 px-3 pb-2 flex-shrink-0 bg-gradient-to-b from-transparent to-white dark:to-gray-900 pt-2 items-end">
                {/* Message Input Container with Attachment and Emoji Icons Inside */}
                <div className="flex-1 relative">
                  {/* Link Preview Container with Height and Width Constraints */}
                  {detectedUrl && (
                    <div className="max-h-32 max-w-full overflow-y-auto mb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                      <LinkPreview
                        url={detectedUrl}
                        onRemove={() => {
                          setLastDismissedUrl(detectedUrl);
                          setDetectedUrl(null);
                          setPreviewDismissed(true);
                        }}
                        className="w-full"
                        showRemoveButton={true}
                        clickable={false}
                      />
                    </div>
                  )}
                  {/* Formatting toolbar - Collapsible */}
                  {showTextStylingPanel && (
                    <div className="relative mb-2 animate-slideDown bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-800 p-3 rounded-lg border border-purple-200 dark:border-gray-700 shadow-sm">
                      {/* Close button */}
                      <button
                        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-700 hover:bg-opacity-50 rounded-full p-1 transition-colors z-10"
                        onClick={() => setShowTextStylingPanel(false)}
                        title="Close text styling panel"
                        aria-label="Close text styling panel"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <div className="flex flex-wrap items-center gap-2 pr-8">
                        <button type="button" className={`px-2 py-1 text-xs rounded border ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-600'}`} onClick={() => {
                          if (isChatSendBlocked) {
                            toast.info('Formatting disabled for this appointment status. You can view chat history.');
                            return;
                          }
                          applyFormattingAndClose(() => {
                            const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const end = el.selectionEnd || 0; const base = comment || ''; const selected = base.slice(start, end); const wrapped = `**${selected || 'bold'}**`; const next = base.slice(0, start) + wrapped + base.slice(end); setComment(next); setTimeout(() => { try { el.focus(); el.setSelectionRange(start + 2, start + 2 + (selected || 'bold').length); } catch (_) { } }, 0);
                          });
                        }} disabled={isChatSendBlocked}>B</button>
                        <button type="button" className={`px-2 py-1 text-xs rounded border italic ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-600'}`} onClick={() => {
                          if (isChatSendBlocked) {
                            toast.info('Formatting disabled for this appointment status. You can view chat history.');
                            return;
                          }
                          applyFormattingAndClose(() => {
                            const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const end = el.selectionEnd || 0; const base = comment || ''; const selected = base.slice(start, end); const wrapped = `*${selected || 'italic'}*`; const next = base.slice(0, start) + wrapped + base.slice(end); setComment(next); setTimeout(() => { try { el.focus(); el.setSelectionRange(start + 1, start + 1 + (selected || 'italic').length); } catch (_) { } }, 0);
                          });
                        }} disabled={isChatSendBlocked}>I</button>
                        <button type="button" className={`px-2 py-1 text-xs rounded border underline ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-600'}`} onClick={() => {
                          if (isChatSendBlocked) {
                            toast.info('Formatting disabled for this appointment status. You can view chat history.');
                            return;
                          }
                          applyFormattingAndClose(() => {
                            const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const end = el.selectionEnd || 0; const base = comment || ''; const selected = base.slice(start, end); const wrapped = `__${selected || 'underline'}__`; const next = base.slice(0, start) + wrapped + base.slice(end); setComment(next); setTimeout(() => { try { el.focus(); el.setSelectionRange(start + 2, start + 2 + (selected || 'underline').length); } catch (_) { } }, 0);
                          });
                        }} disabled={isChatSendBlocked}>U</button>
                        <button type="button" className={`px-2 py-1 text-xs rounded border ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-600'}`} onClick={() => {
                          if (isChatSendBlocked) {
                            toast.info('Formatting disabled for this appointment status. You can view chat history.');
                            return;
                          }
                          applyFormattingAndClose(() => {
                            const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const end = el.selectionEnd || 0; const base = comment || ''; const selected = base.slice(start, end); const wrapped = `~~${selected || 'strike'}~~`; const next = base.slice(0, start) + wrapped + base.slice(end); setComment(next); setTimeout(() => { try { el.focus(); el.setSelectionRange(start + 2, start + 2 + (selected || 'strike').length); } catch (_) { } }, 0);
                          });
                        }} disabled={isChatSendBlocked}>S</button>
                        <button type="button" className={`px-2 py-1 text-xs rounded border ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-600'}`} onClick={() => {
                          if (isChatSendBlocked) {
                            toast.info('Formatting disabled for this appointment status. You can view chat history.');
                            return;
                          }
                          applyFormattingAndClose(() => {
                            const el = inputRef.current; if (!el) return; const base = comment || ''; const start = el.selectionStart || 0; const before = base.slice(0, start); const after = base.slice(start); const next = `${before}- ${after}`; setComment(next); setTimeout(() => { try { el.focus(); el.setSelectionRange(start + 2, start + 2); } catch (_) { } }, 0);
                          });
                        }} disabled={isChatSendBlocked}>• List</button>
                        <button type="button" className={`px-2 py-1 text-xs rounded border ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-600'}`} onClick={() => {
                          if (isChatSendBlocked) {
                            toast.info('Formatting disabled for this appointment status. You can view chat history.');
                            return;
                          }
                          const el = inputRef.current; if (!el) return; const base = comment || ''; const start = el.selectionStart || 0; const before = base.slice(0, start); const after = base.slice(start);
                          // Find existing numbered list items to determine next number
                          const lines = before.split('\n');
                          const lastLine = lines[lines.length - 1];
                          let nextNum = 1;

                          // Check if we're continuing a list
                          for (let i = lines.length - 1; i >= 0; i--) {
                            const line = lines[i].trim();
                            const match = line.match(/^(\d+)\.\s/);
                            if (match) {
                              nextNum = parseInt(match[1]) + 1;
                              break;
                            } else if (line && !line.match(/^\s*$/)) {
                              // Non-empty, non-numbered line found, reset to 1
                              break;
                            }
                          }

                          applyFormattingAndClose(() => {
                            const next = `${before}${nextNum}. ${after}`; setComment(next); setTimeout(() => { try { el.focus(); el.setSelectionRange(start + (nextNum.toString().length) + 2, start + (nextNum.toString().length) + 2); } catch (_) { } }, 0);
                          });
                        }} disabled={isChatSendBlocked}>1. List</button>
                        <button type="button" className={`px-2 py-1 text-xs rounded border ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-600'}`} onClick={() => {
                          if (isChatSendBlocked) {
                            toast.info('Formatting disabled for this appointment status. You can view chat history.');
                            return;
                          }
                          applyFormattingAndClose(() => {
                            const el = inputRef.current; if (!el) return; const base = comment || ''; const start = el.selectionStart || 0; const before = base.slice(0, start); const after = base.slice(start); const next = `${before}> ${after}`; setComment(next); setTimeout(() => { try { el.focus(); el.setSelectionRange(start + 2, start + 2); } catch (_) { } }, 0);
                          });
                        }} disabled={isChatSendBlocked}>&gt; Quote</button>
                        <button type="button" className={`px-2 py-1 text-xs rounded border ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-600'}`} title="Tag Property" onClick={() => {
                          if (isChatSendBlocked) {
                            toast.info('Formatting disabled for this appointment status. You can view chat history.');
                            return;
                          }
                          applyFormattingAndClose(() => {
                            const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const base = comment || ''; const insert = '@'; const next = base.slice(0, start) + insert + base.slice(start); setComment(next); setTimeout(() => { try { el.focus(); el.setSelectionRange(start + 1, start + 1); } catch (_) { } }, 0);
                          });
                        }} disabled={isChatSendBlocked}>@Prop</button>
                        <button type="button" className={`px-2 py-1 text-xs rounded border ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-600'}`} title="Insert appointment card" onClick={() => {
                          if (isChatSendBlocked) {
                            toast.info('Formatting disabled for this appointment status. You can view chat history.');
                            return;
                          }
                          applyFormattingAndClose(() => {
                            const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const base = comment || ''; const card = '[Appointment: date • time • with]'; const next = base.slice(0, start) + card + base.slice(start); setComment(next); setTimeout(() => { try { el.focus(); el.setSelectionRange(start + 13, start + 13); } catch (_) { } }, 0);
                          });
                        }} disabled={isChatSendBlocked}>Appt</button>
                        <button type="button" className={`px-2 py-1 text-xs rounded border ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-600'}`} title="Insert service link" onClick={() => {
                          if (isChatSendBlocked) {
                            toast.info('Formatting disabled for this appointment status. You can view chat history.');
                            return;
                          }
                          applyFormattingAndClose(() => {
                            const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const base = comment || ''; const link = 'Book Movers: /user/movers'; const next = base.slice(0, start) + link + base.slice(start); setComment(next); setTimeout(() => { try { el.focus(); el.setSelectionRange(start, start); } catch (_) { } }, 0);
                          });
                        }} disabled={isChatSendBlocked}>Service</button>
                      </div>
                    </div>
                  )}
                  {/* Property mention suggestions */}
                  {comment && /@[^\s]*$/.test(comment) && (
                    <div className="absolute bottom-16 left-2 right-2 bg-white dark:bg-gray-800 border-2 border-blue-300 dark:border-blue-700 rounded-lg shadow-2xl max-h-60 overflow-auto z-30 animate-fadeIn">
                      <div className="p-3 text-sm font-medium text-blue-600 dark:text-blue-300 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/40">
                        <div className="flex items-center gap-2">
                          {!propertiesLoaded ? (
                            <UrbanSetuSpinner size="sm" />
                          ) : (
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          )}
                          {!propertiesLoaded ? 'Loading properties...' : 'Select a property to reference:'}
                        </div>
                      </div>
                      {(() => {
                        const query = (comment.match(/@([^\s]*)$/)?.[1] || '').toLowerCase();
                        const apptSource = (typeof appointments !== 'undefined' && Array.isArray(appointments) && appointments.length > 0) ? appointments : [appt].filter(Boolean);
                        const apptProps = apptSource.map(a => {
                          const l = a?.listingId && typeof a.listingId === 'object' ? a.listingId : {};
                          return {
                            id: a?.listingId?._id || a?.listingId,
                            name: a?.propertyName || l?.name || 'Property',
                            city: l?.city || 'City',
                            state: l?.state || 'State',
                            price: (l?.discountPrice ?? l?.regularPrice) || 0,
                            bedrooms: l?.bedrooms || 0,
                            bathrooms: l?.bathrooms || 0,
                            area: l?.area || 0,
                            image: Array.isArray(l?.imageUrls) ? l.imageUrls[0] : (l?.imageUrl || l?.image || null),
                            type: 'property'
                          };
                        });
                        const propList = Array.isArray(allProperties) ? allProperties : [];
                        const allPropsDetailed = propList.map(p => {
                          return {
                            id: p?.id,
                            name: p?.name || 'Property',
                            city: p?.city || 'City',
                            state: p?.state || 'State',
                            price: p?.price || 0,
                            bedrooms: p?.bedrooms || 0,
                            bathrooms: p?.bathrooms || 0,
                            area: p?.area || 0,
                            image: Array.isArray(p?.imageUrls) ? p.imageUrls[0] : (p?.imageUrl || p?.image || p?.thumbnail || null),
                            type: 'property'
                          };
                        });

                        const blogList = Array.isArray(allBlogs) ? allBlogs : [];
                        const filteredBlogs = blogList.map(b => ({
                          id: b.id,
                          name: b.name,
                          category: b.category,
                          image: b.image,
                          type: 'blog'
                        }));

                        // Combine everything
                        const combined = [...apptProps, ...allPropsDetailed, ...filteredBlogs];
                        const uniqueMap = new Map();

                        // Add appointment properties first (they have more complete data)
                        apptProps.forEach(prop => {
                          if (prop.id && prop.name) {
                            uniqueMap.set(`prop-${prop.id}`, prop);
                          }
                        });

                        // Add all properties, but don't override existing ones
                        allPropsDetailed.forEach(prop => {
                          if (prop.id && prop.name && !uniqueMap.has(`prop-${prop.id}`)) {
                            uniqueMap.set(`prop-${prop.id}`, prop);
                          }
                        });

                        // Add blogs
                        filteredBlogs.forEach(blog => {
                          if (blog.id && blog.name) {
                            uniqueMap.set(`blog-${blog.id}`, blog);
                          }
                        });

                        const suggestions = Array.from(uniqueMap.values())
                          .filter(p => p.name && p.name.toLowerCase().includes(query));


                        if (suggestions.length === 0) return <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">No content found. Try typing more characters.</div>;
                        return suggestions.slice(0, 10).map((p, index) => {
                          const isBlog = p.type === 'blog';
                          return (
                            <button key={`${p.id}-${index}`} type="button" className="w-full text-left p-3 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" onClick={() => {
                              const el = inputRef.current; const base = comment || ''; const m = base.match(/@([^\s]*)$/); if (!m) return; const start = base.lastIndexOf('@');
                              // Handle mentions based on type
                              const token = (p.type === 'blog' || p.type === 'guide') ? `@[${p.name}](${p.type}:${p.id})` : `@[${p.name}](listing:${p.id})`;
                              const next = base.slice(0, start) + token + ' ' + base.slice(start + m[0].length);
                              setComment(next);
                              setTimeout(() => { try { el?.focus(); el?.setSelectionRange(start + token.length + 1, start + token.length + 1); } catch (_) { } }, 0);
                            }}>
                              <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                                  {p.image ? (
                                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="text-gray-500 text-xs text-center">
                                      {isBlog ? <FaFileAlt className="text-blue-500" size={20} /> : <div className="font-bold text-xl">🏠</div>}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                                    {isBlog ? <FaFileAlt className="text-blue-500 flex-shrink-0" size={10} /> : <div className="text-green-500 flex-shrink-0">🏠</div>}
                                    {p.name}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {isBlog ? p.category : (p.city && p.state ? `${p.city}, ${p.state}` : (p.city || p.state || 'Location not available'))}
                                  </div>
                                  {!isBlog && (
                                    <>
                                      {p.price && p.price > 0 ? (
                                        <div className="text-sm font-semibold text-green-600">₹{Number(p.price).toLocaleString()}</div>
                                      ) : (
                                        <div className="text-sm text-gray-400">Price not available</div>
                                      )}
                                      <div className="text-xs text-gray-400">
                                        {[p.bedrooms > 0 && `${p.bedrooms}BHK`, p.area > 0 && `${p.area} sq ft`].filter(Boolean).join(' • ') || 'Details not available'}
                                      </div>
                                    </>
                                  )}
                                  {isBlog && (
                                    <div className="text-xs text-gray-400 italic">Blog/Guide Article</div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  )}
                  <textarea
                    rows={1}
                    className="w-full pl-4 pr-20 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 shadow-lg transition-all duration-300 bg-white dark:bg-gray-800 dark:text-white resize-none whitespace-pre-wrap break-all hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-xl focus:shadow-2xl transform hover:scale-[1.01] overflow-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800"
                    style={{
                      minHeight: '48px',
                      maxHeight: '144px', // 6 lines * 24px line height
                      lineHeight: '24px',
                      wordBreak: 'break-all',
                      overflowWrap: 'break-word'
                    }}
                    placeholder={isChatSendBlocked ? "Sending disabled for this appointment status. Chat history is available." : (editingComment ? "Edit your message..." : "Type a message...")}
                    value={comment}
                    onSelect={(e) => {
                      const start = e.target.selectionStart;
                      const end = e.target.selectionEnd;
                      if (start !== end) {
                        setShowTextStylingPanel(true);
                      }
                    }}
                    onChange={e => {
                      if (isChatSendBlocked) { return; }
                      const value = e.target.value;
                      setComment(value);

                      // Detect URLs in the input
                      const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]{2,}(?:\/[^\s]*)?|[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;
                      const urls = value.match(urlRegex);
                      if (urls && urls.length > 0) {
                        const newUrl = urls[0];
                        if (newUrl !== lastDismissedUrl) {
                          setDetectedUrl(newUrl);
                          setPreviewDismissed(false); // Reset dismissed flag for new URL
                        }
                      } else {
                        setDetectedUrl(null);
                        setPreviewDismissed(false);
                        setLastDismissedUrl(null);
                      }

                      if (editingComment) {
                        setEditText(value);
                      }
                      if (!editingComment) {
                        socket.emit('typing', { toUserId: otherParty._id, fromUserId: currentUser._id, appointmentId: appt._id });
                        if (settings.soundEnabled) {
                          playTyping();
                        }
                      }

                      // If cleared entirely, restore to original height
                      if ((value || '').trim() === '') {
                        const textarea = e.target;
                        textarea.style.height = '48px';
                        textarea.style.overflowY = 'hidden';
                        return;
                      }

                      // Auto-expand textarea (WhatsApp style) with scrolling support
                      const textarea = e.target;
                      textarea.style.height = '48px'; // Reset to min height
                      const scrollHeight = textarea.scrollHeight;
                      const maxHeight = 144; // 6 lines max

                      if (scrollHeight <= maxHeight) {
                        // If content fits within max height, expand the textarea
                        textarea.style.height = scrollHeight + 'px';
                        textarea.style.overflowY = 'hidden';
                      } else {
                        // If content exceeds max height, set to max height and enable scrolling
                        textarea.style.height = maxHeight + 'px';
                        textarea.style.overflowY = 'auto';
                      }
                    }}
                    onClick={() => {
                      if (headerOptionsMessageId) {
                        setHeaderOptionsMessageId(null);
                        toast.info("You can hit reply icon in header to reply");
                      }
                    }}
                    onScroll={(e) => {
                      // Prevent scroll event from propagating to parent chat container
                      e.stopPropagation();
                    }}
                    onPaste={(e) => {
                      const items = Array.from(e.clipboardData.items);
                      // Find the first item that is a file
                      const fileItem = items.find(item => item.kind === 'file');

                      if (fileItem) {
                        e.preventDefault();
                        const file = fileItem.getAsFile();

                        if (file) {
                          if (file.type.startsWith('image/')) {
                            handleImageFiles([file]);
                          } else if (file.type.startsWith('video/')) {
                            if (file.size > 100 * 1024 * 1024) {
                              toast.error('Maximum video size is 100MB');
                            } else {
                              setSelectedVideo(file);
                              setShowVideoPreviewModal(true);
                            }
                          } else if (file.type.startsWith('audio/')) {
                            if (file.size > 10 * 1024 * 1024) {
                              toast.error('Maximum audio size is 10MB');
                            } else {
                              setSelectedAudio(file);
                              setShowAudioPreviewModal(true);
                            }
                          } else {
                            // Treat as document
                            if (file.size > 10 * 1024 * 1024) {
                              toast.error('Maximum document size is 10MB');
                            } else {
                              setSelectedDocument(file);
                              setShowDocumentPreviewModal(true);
                            }
                          }
                        }
                      }
                    }}
                    onKeyDown={e => {
                      if (isChatSendBlocked) {
                        // Allow navigation keys but block input/submit
                        if (e.key === 'Enter' || e.key.length === 1) {
                          e.preventDefault();
                          toast.info('Sending disabled for this appointment status.');
                        }
                        return;
                      }
                      // Check if this is a desktop viewport only
                      const isDesktop = window.matchMedia('(min-width: 768px)').matches;

                      if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); document.querySelector('button:contains("B")'); }
                      if (e.ctrlKey && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const end = el.selectionEnd || 0; const base = comment || ''; const selected = base.slice(start, end); const wrapped = `*${selected || 'italic'}*`; setComment(base.slice(0, start) + wrapped + base.slice(end)); return; }
                      if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) { e.preventDefault(); const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const end = el.selectionEnd || 0; const base = comment || ''; const selected = base.slice(start, end); const wrapped = `__${selected || 'underline'}__`; setComment(base.slice(0, start) + wrapped + base.slice(end)); return; }
                      if (e.shiftKey && e.altKey && e.key === '7') { e.preventDefault(); const el = inputRef.current; if (!el) return; const base = comment || ''; const start = el.selectionStart || 0; setComment(base.slice(0, start) + '> ' + base.slice(start)); return; }

                      if (e.key === 'Enter') {
                        // Avoid sending while composing (IME)
                        if (e.isComposing || e.keyCode === 229) return;
                        // For desktop: Enter sends message, Shift+Enter creates new line
                        if (isDesktop && !e.shiftKey) {
                          e.preventDefault();
                          if (editingComment) {
                            handleEditComment(editingComment);
                          } else {
                            handleCommentSend();
                          }
                        }
                        // For mobile or with Shift+Enter: allow new line (default behavior)
                        // Ctrl+Enter or Cmd+Enter still works on all devices
                        else if ((e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          if (editingComment) {
                            handleEditComment(editingComment);
                          } else {
                            handleCommentSend();
                          }
                        }
                      }
                    }}
                    ref={inputRef}
                  />
                  {/* Emoji Button - Inside textarea on the right */}
                  <div className="absolute right-12 bottom-3">
                    <EmojiButton
                      onEmojiClick={(emoji) => {
                        // Check if chat sending is blocked for this appointment status
                        if (isChatSendBlocked) {
                          toast.info('Emoji sending disabled for this appointment status. You can view chat history.');
                          return;
                        }

                        // Use live input value and caret selection for robust insertion
                        const el = inputRef?.current;
                        const baseText = el ? el.value : comment;
                        let start = baseText.length;
                        let end = baseText.length;
                        try {
                          if (el && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
                            start = el.selectionStart;
                            end = el.selectionEnd;
                          }
                        } catch (_) { }
                        const newText = baseText.slice(0, start) + emoji + baseText.slice(end);
                        setComment(newText);
                        if (editingComment) {
                          setEditText(newText);
                        }
                        // Restore caret after inserted emoji just after the emoji
                        setTimeout(() => {
                          try {
                            if (el) {
                              const caretPos = start + emoji.length;
                              el.focus();
                              el.setSelectionRange(caretPos, caretPos);
                            }
                          } catch (_) { }
                        }, 0);
                      }}
                      className="w-8 h-8"
                      inputRef={inputRef}
                      disabled={isChatSendBlocked}
                    />
                  </div>
                  {/* Attachment Button with panel */}
                  <div className="absolute right-3 bottom-3">
                    <button
                      ref={attachmentButtonRef}
                      type="button"
                      onClick={() => setShowAttachmentPanel(prev => !prev)}
                      disabled={uploadingFile || isChatSendBlocked}
                      className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 ${uploadingFile || isChatSendBlocked
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 hover:shadow-md active:scale-95'
                        }`}
                      aria-haspopup="true"
                      aria-expanded={showAttachmentPanel}
                      aria-label="Attachments"
                    >
                      {uploadingFile ? (
                        <UrbanSetuSpinner size="sm" />
                      ) : (
                        <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      )}
                    </button>
                    {showAttachmentPanel && !isChatSendBlocked && (
                      <div ref={attachmentPanelRef} className="absolute bottom-10 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-lg w-48 py-2 z-20">
                        <label className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Photos
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                handleFileUpload(files);
                              }
                              e.target.value = '';
                              setShowAttachmentPanel(false);
                            }}
                          />
                        </label>
                        {/* Camera - Simple file input approach */}
                        <label className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h2l1-2h6l1 2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                          </svg>
                          Camera
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleFileUpload([e.target.files[0]]);
                              }
                              e.target.value = '';
                              setShowAttachmentPanel(false);
                            }}
                          />
                        </label>
                        <label className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Videos
                          <input
                            ref={videoInputRef}
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files && e.target.files[0];
                              if (file) {
                                if (file.size > 100 * 1024 * 1024) {
                                  toast.error('Maximum video size is 100MB');
                                } else {
                                  setSelectedVideo(file);
                                  setShowVideoPreviewModal(true);
                                }
                              }
                              e.target.value = '';
                              setShowAttachmentPanel(false);
                            }}
                          />
                        </label>
                        <label className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Documents
                          <input
                            ref={documentInputRef}
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files && e.target.files[0];
                              if (file) {
                                if (file.size > 10 * 1024 * 1024) {
                                  toast.error('Maximum document size is 10MB');
                                } else {
                                  setSelectedDocument(file);
                                  setShowDocumentPreviewModal(true);
                                }
                              }
                              e.target.value = '';
                              setShowAttachmentPanel(false);
                            }}
                          />
                        </label>
                        {/* Audio */}
                        <label className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1a3 3 0 00-3 3v8a3 3 0 106 0V4a3 3 0 00-3-3z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10v2a7 7 0 11-14 0v-2" />
                          </svg>
                          Audio
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files && e.target.files[0];
                              if (file) {
                                if (file.size > 10 * 1024 * 1024) {
                                  toast.error('Maximum audio size is 10MB');
                                } else {
                                  setSelectedAudio(file);
                                  setShowAudioPreviewModal(true);
                                }
                              }
                              e.target.value = '';
                              setShowAttachmentPanel(false);
                            }}
                          />
                        </label>
                        {/* Record Audio */}
                        <button
                          type="button"
                          className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                          onClick={() => {
                            setShowRecordAudioModal(true);
                            setShowAttachmentPanel(false);
                          }}
                        >
                          <svg className="w-4 h-4 text-rose-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" />
                            <path d="M19 11a7 7 0 11-14 0h2a5 5 0 0010 0h2z" />
                            <path d="M13 19h-2v2h2v-2z" />
                          </svg>
                          Record Audio
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onMouseDown={(e) => {
                    // Prevent the button from stealing focus from the textarea
                    // This keeps the mobile keyboard open after sending
                    e.preventDefault();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    if (editingComment) {
                      handleEditComment(editingComment);
                    } else {
                      handleCommentSend();
                    }
                  }}
                  disabled={editingComment ? savingComment === editingComment : !comment.trim()}
                  className="bg-gradient-to-r from-blue-600 to-purple-700 text-white w-12 h-12 rounded-full shadow-lg hover:from-blue-700 hover:to-purple-800 hover:shadow-xl transform hover:scale-110 transition-all duration-300 disabled:opacity-50 disabled:transform-none flex items-center justify-center hover:shadow-2xl active:scale-95 group"
                >
                  {editingComment ? (
                    savingComment === editingComment ? (
                      <FaPen className="text-lg text-white animate-editSaving" />
                    ) : (
                      <FaPen className="text-lg text-white group-hover:scale-110 transition-transform duration-200" />
                    )
                  ) : (
                    <div className="relative">
                      {sendIconSent ? (
                        <FaCheck className="text-lg text-white group-hover:scale-110 transition-all duration-300 send-icon animate-sent" />
                      ) : (
                        <FaPaperPlane className={`text-lg text-white group-hover:scale-110 transition-all duration-300 send-icon ${sendIconAnimating ? 'animate-fly' : ''}`} />
                      )}
                    </div>
                  )}
                </button>
              </div>

              {/* File Upload Error */}
              {fileUploadError && (
                <div className="px-3 pb-2">
                  <div className="text-red-500 text-sm bg-red-50 p-2 rounded-lg border border-red-200">
                    {fileUploadError}
                  </div>
                </div>
              )}

              {/* Multi-Image Preview Modal - Positioned as overlay */}
              {showImagePreviewModal && selectedFiles.length > 0 && (
                <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
                  <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-medium text-gray-700 dark:text-white">
                        Image Preview ({selectedFiles.length} image{selectedFiles.length !== 1 ? 's' : ''})
                      </span>
                      <button
                        onClick={() => {
                          setSelectedFiles([]);
                          setImageCaptions({});
                          setPreviewIndex(0);
                          setShowImagePreviewModal(false);
                        }}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full p-2 transition-colors"
                      >
                        <FaTimes className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Image Slideshow */}
                    <div className="relative mb-4">
                      {/* Navigation Arrows */}
                      {selectedFiles.length > 1 && (
                        <>
                          <button
                            onClick={() => setPreviewIndex(prev => prev > 0 ? prev - 1 : selectedFiles.length - 1)}
                            className="absolute left-2 top-1/2 transform -translate-y-1/2 z-10 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-all duration-200"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setPreviewIndex(prev => prev < selectedFiles.length - 1 ? prev + 1 : 0)}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 z-10 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-all duration-200"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </>
                      )}

                      {/* Current Image */}
                      <div className="mb-3">
                        <img
                          src={URL.createObjectURL(selectedFiles[previewIndex])}
                          alt={`Preview ${previewIndex + 1}`}
                          className="w-full h-64 object-contain rounded-lg border"
                        />
                      </div>

                      {/* Image Counter */}
                      <div className="text-center text-sm text-gray-600 dark:text-gray-300 mb-3">
                        {previewIndex + 1} of {selectedFiles.length}
                      </div>

                      {/* Image Thumbnails */}
                      <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pb-2 min-w-0 max-w-full" style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db #f3f4f6' }}>
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="relative">
                            <button
                              onClick={() => setPreviewIndex(index)}
                              className={`flex-shrink-0 w-12 h-12 rounded-lg border-2 transition-all duration-200 ${index === previewIndex
                                ? 'border-blue-500 shadow-lg'
                                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                }`}
                            >
                              <img
                                src={URL.createObjectURL(file)}
                                alt={`Thumbnail ${index + 1}`}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            </button>
                            {/* Delete Icon on Thumbnail - Only show when multiple images are selected */}
                            {selectedFiles.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent triggering the thumbnail selection
                                  const newFiles = selectedFiles.filter((_, fileIndex) => fileIndex !== index);
                                  const newCaptions = { ...imageCaptions };
                                  // Remove caption for deleted image
                                  delete newCaptions[file.name];

                                  if (newFiles.length === 0) {
                                    // If no images left, close modal
                                    setSelectedFiles([]);
                                    setImageCaptions({});
                                    setShowImagePreviewModal(false);
                                  } else {
                                    // Update files and adjust preview index
                                    setSelectedFiles(newFiles);
                                    setImageCaptions(newCaptions);
                                    // Adjust preview index if needed
                                    if (previewIndex >= newFiles.length) {
                                      setPreviewIndex(newFiles.length - 1);
                                    } else if (previewIndex > index) {
                                      // If we deleted an image before the current preview, adjust index
                                      setPreviewIndex(previewIndex - 1);
                                    }
                                  }
                                }}
                                className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg transition-all duration-200 hover:scale-110 z-10"
                                title="Remove this image"
                                aria-label="Remove this image"
                              >
                                <FaTimes className="w-2 h-2" />
                              </button>
                            )}
                          </div>
                        ))}

                        {/* Add More Images Button - Only show when less than 10 images */}
                        {selectedFiles.length < 10 && (
                          <div className="relative">
                            <label className="flex-shrink-0 w-12 h-12 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-200 cursor-pointer flex items-center justify-center group">
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                  const files = e.target.files;
                                  if (files && files.length > 0) {
                                    // Calculate how many more images can be added
                                    const remainingSlots = 10 - selectedFiles.length;
                                    const filesToAdd = Array.from(files).slice(0, remainingSlots);

                                    if (filesToAdd.length > 0) {
                                      // Add new files to existing selection
                                      const newFiles = [...selectedFiles, ...filesToAdd];
                                      setSelectedFiles(newFiles);

                                      // Show notification if some files were skipped
                                      if (filesToAdd.length < files.length) {
                                        toast.info(`Added ${filesToAdd.length} images. Maximum limit of 10 images reached.`);
                                      }
                                    }
                                    // Reset the input
                                    e.target.value = '';
                                  }
                                }}
                              />
                              <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Caption for Current Image */}
                    <div className="relative mb-4">
                      <textarea
                        placeholder={`Add a caption for ${selectedFiles[previewIndex]?.name}...`}
                        value={imageCaptions[selectedFiles[previewIndex]?.name] || ''}
                        onChange={(e) => setImageCaptions(prev => ({
                          ...prev,
                          [selectedFiles[previewIndex]?.name]: e.target.value
                        }))}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                        rows={3}
                        maxLength={500}
                      />
                      {/* Emoji Picker for Caption */}
                      <div className="absolute right-2 top-2">
                        <EmojiButton
                          onEmojiClick={(emoji) => {
                            // Check if chat sending is blocked for this appointment status
                            if (isChatSendBlocked) {
                              toast.info('Emoji sending disabled for this appointment status. You can view chat history.');
                              return;
                            }

                            const currentCaption = imageCaptions[selectedFiles[previewIndex]?.name] || '';
                            setImageCaptions(prev => ({
                              ...prev,
                              [selectedFiles[previewIndex]?.name]: currentCaption + emoji
                            }));
                          }}
                          className="w-6 h-6"
                          disabled={isChatSendBlocked}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1 text-right">
                        {(imageCaptions[selectedFiles[previewIndex]?.name] || '').length}/500
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {uploadingFile && currentFileIndex >= 0 ? (
                          <span>
                            Uploading {currentFileIndex + 1} / {selectedFiles.length}
                            {` • ${currentFileProgress}%`}
                          </span>
                        ) : (
                          <>
                            {selectedFiles.length} image{selectedFiles.length !== 1 ? 's' : ''} ready to send
                            {failedFiles.length > 0 && (
                              <span className="ml-2 text-red-600">• {failedFiles.length} failed</span>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {uploadingFile ? (
                          <>
                            <button
                              onClick={handleCancelInFlightUpload}
                              className="bg-red-600 text-white py-2 px-3 rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
                            >
                              Cancel Upload
                            </button>
                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-2 bg-blue-600 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                            </div>
                            <span className="text-sm text-gray-700 dark:text-gray-300 w-10 text-right">{uploadProgress}%</span>
                          </>
                        ) : (
                          <>
                            {failedFiles.length > 0 && (
                              <button
                                onClick={handleRetryFailedUploads}
                                className="bg-yellow-500 text-white py-2 px-3 rounded-lg hover:bg-yellow-600 text-sm font-medium transition-colors"
                              >
                                Retry Failed ({failedFiles.length})
                              </button>
                            )}
                            <button
                              onClick={handleSendImagesWithCaptions}
                              disabled={isChatSendBlocked}
                              className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${isChatSendBlocked
                                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                            >
                              {`Send ${selectedFiles.length} Image${selectedFiles.length !== 1 ? 's' : ''}`}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Video Preview Modal */}
              {showVideoPreviewModal && selectedVideo && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
                  <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-medium text-gray-700 dark:text-white">Video Preview</span>
                      <button
                        onClick={() => { setSelectedVideo(null); setShowVideoPreviewModal(false); }}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full p-2 transition-colors"
                      >
                        <FaTimes className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex-1 mb-4 min-h-0">
                      <video controls className="w-full h-full max-h-[60vh] rounded-lg border dark:border-gray-600" src={videoObjectURL} />
                    </div>

                    {/* Caption for Video */}
                    <div className="relative mb-4">
                      <div className="relative">
                        <textarea
                          ref={videoCaptionRef}
                          placeholder={`Add a caption for ${selectedVideo.name}...`}
                          value={videoCaption}
                          onChange={(e) => setVideoCaption(e.target.value)}
                          className="w-full p-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                          rows={2}
                          maxLength={500}
                        />
                        <div className="absolute right-2 top-2">
                          <EmojiButton
                            onEmojiClick={(emoji) => {
                              const textarea = videoCaptionRef.current;
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const newValue = videoCaption.slice(0, start) + emoji + videoCaption.slice(end);
                                setVideoCaption(newValue);
                                setTimeout(() => {
                                  textarea.focus();
                                  textarea.setSelectionRange(start + emoji.length, start + emoji.length);
                                }, 0);
                              }
                            }}
                            inputRef={videoCaptionRef}
                          />
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                        {videoCaption.length}/500
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1 mr-4">{selectedVideo.name}</div>
                      <div className="flex gap-2 flex-shrink-0">
                        {uploadingFile ? (
                          <>
                            <button
                              onClick={handleCancelInFlightUpload}
                              className="px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50"
                            >
                              Cancel
                            </button>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-2 bg-blue-600 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                              </div>
                              <span className="text-sm text-gray-700 dark:text-gray-300 w-10 text-right">{uploadProgress}%</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setSelectedVideo(null); setShowVideoPreviewModal(false); setVideoCaption(''); }} className="px-4 py-2 rounded-lg border dark:border-gray-600 text-gray-700 dark:text-gray-300">Cancel</button>
                            <button onClick={handleSendSelectedVideo} className="px-4 py-2 rounded-lg bg-blue-600 text-white">Send</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Audio Preview Modal */}
              {showAudioPreviewModal && selectedAudio && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
                  <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-medium text-gray-700 dark:text-white">Audio Preview</span>
                      <button
                        onClick={() => { setSelectedAudio(null); setShowAudioPreviewModal(false); }}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full p-2 transition-colors"
                      >
                        <FaTimes className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="mb-4">
                      <audio controls className="w-full" src={audioObjectURL} />
                    </div>
                    <div className="relative mb-4">
                      <div className="relative">
                        <textarea
                          ref={audioCaptionRef}
                          placeholder={`Add a caption for ${selectedAudio.name}...`}
                          value={audioCaption}
                          onChange={(e) => setAudioCaption(e.target.value)}
                          className="w-full p-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                          rows={2}
                          maxLength={500}
                        />
                        <div className="absolute right-2 top-2">
                          <EmojiButton
                            onEmojiClick={(emoji) => {
                              const textarea = audioCaptionRef.current;
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const newValue = audioCaption.slice(0, start) + emoji + audioCaption.slice(end);
                                setAudioCaption(newValue);
                                setTimeout(() => {
                                  textarea.focus();
                                  textarea.setSelectionRange(start + emoji.length, start + emoji.length);
                                }, 0);
                              }
                            }}
                            inputRef={audioCaptionRef}
                          />
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                        {audioCaption.length}/500
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1 mr-4">{selectedAudio.name}</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelectedAudio(null); setShowAudioPreviewModal(false); }}
                          className="py-2 px-4 rounded-lg text-sm font-medium border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                        >Cancel</button>
                        <button
                          onClick={handleSendSelectedAudio}
                          disabled={isChatSendBlocked}
                          className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${isChatSendBlocked ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                        >Send Audio</button>
                      </div>
                    </div>
                    {uploadingFile && (
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${uploadProgress}%` }} />
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">{uploadProgress}%</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Record Audio Modal */}
              {showRecordAudioModal && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
                  <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-2xl max-w-md w-full">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-medium text-gray-700 dark:text-white">Record Audio</span>
                      <button
                        onClick={cancelAudioRecording}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full p-2 transition-colors"
                      >
                        <FaTimes className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex flex-col items-center gap-4 py-4">
                      <div className={`w-24 h-24 rounded-full flex items-center justify-center ${isRecording ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                        <svg className={`w-10 h-10 ${isRecording ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-gray-600 dark:text-gray-400'}`} viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" />
                          <path d="M19 11a7 7 0 11-14 0h2a5 5 0 0010 0h2z" />
                        </svg>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {isRecording ? (
                          isPaused ?
                            `${Math.floor(recordingElapsedMs / 60000).toString().padStart(2, '0')}:${Math.floor((recordingElapsedMs % 60000) / 1000).toString().padStart(2, '0')} (Paused)` :
                            `${Math.floor(recordingElapsedMs / 60000).toString().padStart(2, '0')}:${Math.floor((recordingElapsedMs % 60000) / 1000).toString().padStart(2, '0')}`
                        ) : 'Ready'}
                      </div>
                      <div className="flex items-center gap-3">
                        {!isRecording ? (
                          <button onClick={startAudioRecording} className="px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700">Start</button>
                        ) : (
                          <>
                            <button onClick={stopAudioRecording} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Stop & Preview</button>
                            {isPaused ? (
                              <button onClick={resumeAudioRecording} className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700">Resume</button>
                            ) : (
                              <button onClick={pauseAudioRecording} className="px-4 py-2 rounded-lg bg-yellow-600 text-white hover:bg-yellow-700">Pause</button>
                            )}
                          </>
                        )}
                        <button onClick={cancelAudioRecording} className="px-4 py-2 rounded-lg border dark:border-gray-600 text-gray-700 dark:text-gray-300">Cancel</button>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Your mic input stays on device until you choose to send.</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Document Preview Modal */}
              {showDocumentPreviewModal && selectedDocument && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
                  <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-2xl max-w-md w-full">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-medium text-gray-700 dark:text-white">Document Preview</span>
                      <button
                        onClick={() => { setSelectedDocument(null); setShowDocumentPreviewModal(false); }}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full p-2 transition-colors"
                      >
                        <FaTimes className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="mb-4 flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center text-gray-600 dark:text-gray-300">📄</div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate text-gray-800 dark:text-white">{selectedDocument.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{selectedDocument.type || 'Document'}</div>
                      </div>
                    </div>

                    {/* Caption for Document */}
                    <div className="relative mb-4">
                      <div className="relative">
                        <textarea
                          ref={documentCaptionRef}
                          placeholder={`Add a caption for ${selectedDocument.name}...`}
                          value={documentCaption}
                          onChange={(e) => setDocumentCaption(e.target.value)}
                          className="w-full p-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                          rows={2}
                          maxLength={500}
                        />
                        <div className="absolute right-2 top-2">
                          <EmojiButton
                            onEmojiClick={(emoji) => {
                              const textarea = documentCaptionRef.current;
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const newValue = documentCaption.slice(0, start) + emoji + documentCaption.slice(end);
                                setDocumentCaption(newValue);
                                setTimeout(() => {
                                  textarea.focus();
                                  textarea.setSelectionRange(start + emoji.length, start + emoji.length);
                                }, 0);
                              }
                            }}
                            inputRef={documentCaptionRef}
                          />
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                        {documentCaption.length}/500
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      {uploadingFile ? (
                        <>
                          <button
                            onClick={handleCancelInFlightUpload}
                            className="px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50"
                          >
                            Cancel
                          </button>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-2 bg-blue-600 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                            </div>
                            <span className="text-sm text-gray-700 dark:text-gray-300 w-10 text-right">{uploadProgress}%</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setSelectedDocument(null); setShowDocumentPreviewModal(false); setDocumentCaption(''); }} className="px-4 py-2 rounded-lg border dark:border-gray-600 text-gray-700 dark:text-gray-300">Cancel</button>
                          <button onClick={handleSendSelectedDocument} className="px-4 py-2 rounded-lg bg-blue-600 text-white">Send</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Animations for chat bubbles */}
              <style jsx>{`
                  @keyframes fadeInChatBubble {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                  }
                  .animate-fadeInChatBubble {
                    animation: fadeInChatBubble 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
                  }
                  @keyframes fadeInChat {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                  .animate-fadeInChat {
                    animation: fadeInChat 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
                  }
                  @keyframes gentlePulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.9; transform: scale(1.01); }
                  }
                  .animate-gentlePulse {
                    animation: gentlePulse 3s ease-in-out infinite;
                  }
                  @keyframes attentionGlow {
                    0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
                    50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.6); }
                  }
                  .animate-attentionGlow {
                    animation: attentionGlow 2s ease-in-out infinite;
                  }
                  @keyframes slideInFromTop {
                    from { opacity: 0; transform: translateY(-20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                  }
                  .animate-slideInFromTop {
                    animation: slideInFromTop 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
                  }
                  @keyframes sendIconFly {
                    0% { 
                      transform: translate(0, 0) scale(1); 
                      opacity: 1;
                    }
                    20% { 
                      transform: translate(0, 0) scale(1.2); 
                      opacity: 1;
                    }
                    40% { 
                      transform: translate(15px, -20px) scale(1.3); 
                      opacity: 0.8;
                    }
                    60% { 
                      transform: translate(25px, -35px) scale(1.4); 
                      opacity: 0.6;
                    }
                    80% { 
                      transform: translate(15px, -20px) scale(1.2); 
                      opacity: 0.8;
                    }
                    100% { 
                      transform: translate(0, 0) scale(1); 
                      opacity: 1;
                    }
                  }
                  .send-icon.animate-fly {
                    animation: sendIconFly 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                  }
                  @keyframes sentSuccess {
                    0% { 
                      transform: scale(0.8); 
                      opacity: 0;
                    }
                    50% { 
                      transform: scale(1.2); 
                      opacity: 1;
                    }
                    100% { 
                      transform: scale(1); 
                      opacity: 1;
                    }
                  }
                  .send-icon.animate-sent {
                    animation: sentSuccess 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                  }
                  @keyframes editSaving {
                    0% { 
                      transform: scale(1) rotate(0deg) translate(0, 0); 
                      opacity: 1;
                    }
                    20% { 
                      transform: scale(1.15) rotate(-8deg) translate(-1px, -1px); 
                      opacity: 0.9;
                    }
                    40% { 
                      transform: scale(1.25) rotate(0deg) translate(0, -2px); 
                      opacity: 1;
                    }
                    60% { 
                      transform: scale(1.15) rotate(8deg) translate(1px, -1px); 
                      opacity: 0.9;
                    }
                    80% { 
                      transform: scale(1.1) rotate(-4deg) translate(-1px, 0); 
                      opacity: 0.95;
                    }
                    100% { 
                      transform: scale(1) rotate(0deg) translate(0, 0); 
                      opacity: 1;
                    }
                  }
                  .animate-editSaving {
                    animation: editSaving 1.2s ease-in-out infinite;
                  }
                  .search-highlight {
                    animation: searchHighlight 2s ease-in-out;
                  }
                  @keyframes searchHighlight {
                    0%, 100% { box-shadow: 0 0 0 rgba(59, 130, 246, 0); }
                    50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8); }
                  }
                  .date-highlight {
                    animation: dateHighlight 3s ease-in-out;
                  }
                  @keyframes dateHighlight {
                    0%, 100% { box-shadow: 0 0 0 rgba(168, 85, 247, 0); }
                    50% { box-shadow: 0 0 25px rgba(168, 85, 247, 0.9); }
                  }
                `}</style>
              {/* If sending is blocked, show an informational banner under header */}
              {(typeof isChatDisabled !== 'undefined' ? isChatDisabled : isChatSendBlocked) && (
                <div className="px-4 sm:px-6 py-2 bg-blue-50 text-blue-800 text-sm border-b border-blue-200 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>Chat is read-only for this appointment status</span>
                </div>
              )}
            </>

            {/* Floating Scroll to bottom button - WhatsApp style */}
            {!isAtBottom && !(typeof isChatDisabled !== 'undefined' ? isChatDisabled : isChatSendBlocked) && !editingComment && !replyTo && (
              <div className="absolute bottom-20 right-6 z-20">
                <button
                  onClick={() => {
                    setVisibleCount(Math.max(MESSAGES_PAGE_SIZE, filteredComments.length));
                    setTimeout(() => scrollToBottom(), 50); // Small delay to ensure DOM updates
                  }}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full p-3 shadow-xl transition-all duration-200 hover:scale-110 relative transform hover:shadow-2xl"
                  title={unreadNewMessages > 0 ? `${unreadNewMessages} new message${unreadNewMessages > 1 ? 's' : ''} - Scroll to bottom` : "Scroll to bottom"}
                  aria-label={unreadNewMessages > 0 ? `${unreadNewMessages} new messages, scroll to bottom` : "Scroll to bottom"}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="transform"
                  >
                    <path d="M12 16l-6-6h12l-6 6z" />
                  </svg>
                  {unreadNewMessages > 0 && (
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 border-2 border-white shadow-lg">
                      {unreadNewMessages > 99 ? '99+' : unreadNewMessages}
                    </div>
                  )}
                </button>
              </div>
            )}

            {/* Undo Delete Message Button - Fixed at bottom */}
            {recentlyDeletedMessage && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30">
                <div className="bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fadeIn">
                  <FaUndo className="text-white" />
                  <span className="text-sm font-medium">
                    {Array.isArray(recentlyDeletedMessage)
                      ? `${recentlyDeletedMessage.length} message${recentlyDeletedMessage.length !== 1 ? 's' : ''} deleted for you`
                      : 'Message deleted for you'}
                  </span>
                  <button
                    onClick={handleUndoDelete}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                  >
                    Undo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ), document.body)}
      {/* Chat Lock Modal */}
      {showChatLockModal && createPortal((
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" className="text-blue-600 dark:text-blue-400">
                <path d="M18 10v-4c0-3.313-2.687-6-6-6s-6 2.687-6 6v4H4v10h16V10h-2zM8 6c0-2.206 1.794-4 4-4s4 1.794 4 4v4H8V6z" />
              </svg>
              Lock Chat
            </h3>

            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Create a password to lock your chat. You'll need this password to access the chat later.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); handleChatLock(); }}>
              {/* Fake username to prevent browser autofill from using the search bar */}
              <input type="text" name="username" style={{ display: 'none' }} autoComplete="username" defaultValue={currentUser?.email || ''} />

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password (minimum 4 characters)
                  </label>
                  <div className="relative">
                    <input
                      ref={lockPasswordRef}
                      type={showLockPassword ? "text" : "password"}
                      value={lockPassword}
                      onChange={(e) => setLockPassword(e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                      placeholder="Enter password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLockPassword(!showLockPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      {showLockPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type={showLockPassword ? "text" : "password"}
                    value={lockConfirmPassword}
                    onChange={(e) => setLockConfirmPassword(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                    placeholder="Confirm password"
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Note: This is a separate password, not your login password.</p>
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowChatLockModal(false);
                    setLockPassword('');
                    setLockConfirmPassword('');
                    setShowLockPassword(false);
                  }}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={lockingChat}
                  className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {lockingChat ? (
                    <div className="flex items-center gap-2">
                      <UrbanSetuSpinner size="sm" isBright={true} />
                      Locking...
                    </div>
                  ) : (
                    <>
                      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18 10v-4c0-3.313-2.687-6-6-6s-6 2.687-6 6v4H4v10h16V10h-2zM8 6c0-2.206 1.794-4 4-4s4 1.794 4 4v4H8V6z" />
                      </svg>
                      Lock Chat
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}

      {/* Chat Unlock Modal */}
      {showChatUnlockModal && createPortal((
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" className="text-orange-600">
                <path d="M18 10v-4c0-3.313-2.687-6-6-6s-6 2.687-6 6v4H4v10h16V10h-2zM8 6c0-2.206 1.794-4 4-4s4 1.794 4 4v4H8V6z" />
              </svg>
              Chat is Locked
            </h3>

            <p className="text-gray-600 dark:text-gray-300 mb-4">
              This chat is protected with a password. Enter your password to access the chat.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); handleChatUnlock(); }}>
              {/* Fake username to prevent browser autofill from using the search bar */}
              <input type="text" name="username" style={{ display: 'none' }} autoComplete="username" defaultValue={currentUser?.email || ''} />

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    ref={unlockPasswordRef}
                    type={showUnlockPassword ? "text" : "password"}
                    value={unlockPassword}
                    onChange={(e) => setUnlockPassword(e.target.value)}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 pr-10 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="Enter password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showUnlockPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Note: This is a separate password, not your login password.</p>
              </div>

              <div className="flex items-center justify-end mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowChatUnlockModal(false);
                    setShowForgotPasswordModal(true);
                  }}
                  disabled={unlockingChat}
                  className={`text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline ${unlockingChat ? 'opacity-50 cursor-not-allowed no-underline' : ''}`}
                >
                  Forgot password?
                </button>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowChatUnlockModal(false);
                    setUnlockPassword('');
                    setShowUnlockPassword(false);
                  }}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={unlockingChat || !unlockPassword}
                  className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-700 text-white font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {unlockingChat ? (
                    <>
                      <UrbanSetuSpinner size="sm" isBright={true} />
                      Unlocking...
                    </>
                  ) : (
                    'Unlock Chat'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}
      {/* Forgot Password Modal */}
      {
        showForgotPasswordModal && createPortal((
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" className="text-blue-600 dark:text-blue-400">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
                </svg>
                Reset Chat Lock
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Enter your account login password to confirm your identity and permanently remove the chat lock. Your chat history will not be cleared.
              </p>

              <form onSubmit={(e) => { e.preventDefault(); handleForgotPassword(); }}>
                {/* Fake username to prevent browser autofill from using the search bar */}
                <input type="text" name="username" style={{ display: 'none' }} autoComplete="username" defaultValue={currentUser?.email || ''} />

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Account Login Password
                  </label>
                  <div className="relative">
                    <input
                      type={showLoginPasswordForReset ? "text" : "password"}
                      value={loginPasswordForReset}
                      onChange={(e) => setLoginPasswordForReset(e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                      placeholder="Enter your account login password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPasswordForReset(!showLoginPasswordForReset)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      {showLoginPasswordForReset ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPasswordModal(false);
                      setLoginPasswordForReset('');
                      setShowLoginPasswordForReset(false);
                    }}
                    className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotPasswordProcessing || !loginPasswordForReset.trim()}
                    className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {forgotPasswordProcessing ? (
                      <div className="flex items-center gap-2">
                        <UrbanSetuSpinner size="sm" isBright={true} />
                        Removing...
                      </div>
                    ) : (
                      'Remove Lock'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ), document.body)
      }

      {/* Remove Lock Modal */}
      {
        showRemoveLockModal && createPortal((
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" className="text-red-600">
                  <path d="M18 10v-4c0-3.313-2.687-6-6-6s-6 2.687-6 6v4H4v10h16V10h-2zM8 6c0-2.206 1.794-4 4-4s4 1.794 4 4v4H8V6z" />
                </svg>
                Remove Chat Lock
              </h3>

              <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-400 dark:border-red-600 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Permanent Action</h3>
                    <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                      <p>This will remove the chat lock and disable password protection for this conversation.
                        You can lock this chat again at any time from the options.</p>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Enter your chat lock password to confirm this action.
              </p>

              <form onSubmit={(e) => { e.preventDefault(); handleRemoveLockFromMenu(); }}>
                {/* Fake username to prevent browser autofill from using the search bar */}
                <input type="text" name="username" style={{ display: 'none' }} autoComplete="username" defaultValue={currentUser?.email || ''} />

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      ref={removeLockPasswordRef}
                      type={showRemoveLockPassword ? "text" : "password"}
                      value={removeLockPassword}
                      onChange={(e) => setRemoveLockPassword(e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 pr-10"
                      placeholder="Enter your chat lock password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRemoveLockPassword(!showRemoveLockPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showRemoveLockPassword ? '👁' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRemoveLockModal(false);
                      setShowForgotPasswordModal(true);
                      setRemoveLockPassword('');
                      setShowRemoveLockPassword(false);
                    }}
                    disabled={removingLock}
                    className={`text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline ${removingLock ? 'opacity-50 cursor-not-allowed no-underline' : ''}`}
                  >
                    Forgot password?
                  </button>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRemoveLockModal(false);
                      setRemoveLockPassword('');
                      setShowRemoveLockPassword(false);
                    }}
                    className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={removingLock}
                    className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {removingLock ? (
                      <>
                        <UrbanSetuSpinner size="sm" isBright={true} />
                        Removing...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18 10v-4c0-3.313-2.687-6-6-6s-6 2.687-6 6v4H4v10h16V10h-2zM8 6c0-2.206 1.794-4 4-4s4 1.794 4 4v4H8V6z" />
                        </svg>
                        Remove Lock
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ), document.body)
      }

      {/* Delete Message Confirmation Modal */}
      {
        showDeleteModal && createPortal((
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaTrash className="text-red-500" />
                {messageToDelete?.isCall || (messageToDelete?._id && messageToDelete._id.startsWith('call-'))
                  ? 'Delete Call'
                  : Array.isArray(messageToDelete) ? 'Delete Selected Messages' : 'Delete Message'}
              </h3>

              {messageToDelete?.isCall || (messageToDelete?._id && messageToDelete._id.startsWith('call-')) ? (
                // Call deletion - show simplified message
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Are you sure you want to delete this call from the chat? The call will be removed from your view, but the call record will remain in the database.
                </p>
              ) : (!Array.isArray(messageToDelete) && messageToDelete?.deleted) ? (
                // Deleted message - show simplified message for local removal
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Delete this message for me?
                </p>
              ) : ((Array.isArray(messageToDelete) && messageToDelete.every(m => m.senderEmail === currentUser.email)) || (!Array.isArray(messageToDelete) && messageToDelete?.senderEmail === currentUser.email)) ? (
                // Own message - show existing functionality
                <>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    {Array.isArray(messageToDelete) ? `Are you sure you want to delete ${messageToDelete.length} messages?` : 'Are you sure you want to delete this message?'}
                  </p>

                  <div className="mb-6">
                    <label className={`flex items-center gap-3 ${(isChatSendBlocked || deleteMessageLoading) ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={deleteForBoth}
                        onChange={(e) => {
                          if (isChatSendBlocked) {
                            toast.info('Delete for everyone is disabled for this appointment status. Only delete for me is allowed.');
                            return;
                          }
                          setDeleteForBoth(e.target.checked);
                        }}
                        disabled={isChatSendBlocked || deleteMessageLoading}
                        className={`form-checkbox h-4 w-4 text-red-600 rounded border-gray-300 dark:border-gray-600 focus:ring-red-500 ${(isChatSendBlocked || deleteMessageLoading) ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                      />
                      <span className={`text-sm ${(isChatSendBlocked || deleteMessageLoading) ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        Also delete for{' '}
                        <span className={`font-medium ${(isChatSendBlocked || deleteMessageLoading) ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                          {otherParty?.username || 'other user'}
                        </span>
                        {isChatSendBlocked && ' (Disabled for this appointment status)'}
                      </span>
                    </label>
                    <p className={`text-xs mt-1 ml-7 ${(isChatSendBlocked || deleteMessageLoading) ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {isChatSendBlocked
                        ? (Array.isArray(messageToDelete) ? 'The selected messages will only be deleted for you' : 'The message will only be deleted for you')
                        : deleteForBoth
                          ? (Array.isArray(messageToDelete) ? 'The selected messages will be permanently deleted for everyone' : 'The message will be permanently deleted for everyone')
                          : (Array.isArray(messageToDelete) ? 'The selected messages will only be deleted for you' : 'The message will only be deleted for you')
                      }
                    </p>
                  </div>
                </>
              ) : (
                // Received message - show simplified message
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  {Array.isArray(messageToDelete) ? (
                    <>Delete selected messages from <span className="font-medium text-gray-900 dark:text-white">{otherParty?.username || 'other user'}</span>?</>
                  ) : (
                    <>Delete message from <span className="font-medium text-gray-900 dark:text-white">{otherParty?.username || 'other user'}</span>?</>
                  )}
                </p>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  disabled={deleteMessageLoading}
                  onClick={() => {
                    setShowDeleteModal(false);
                    setMessageToDelete(null);
                    setDeleteForBoth(true);
                  }}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteMessageLoading}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteMessageLoading ? (
                    <>
                      <UrbanSetuSpinner size="sm" isBright={true} />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <FaTrash size={12} />
                      <span>
                        {messageToDelete?.isCall || (messageToDelete?._id && messageToDelete._id.startsWith('call-'))
                          ? 'Delete'
                          : Array.isArray(messageToDelete)
                            ? ((messageToDelete.every(m => m.senderEmail === currentUser.email) && deleteForBoth) ? 'Delete for everyone' : 'Delete for me')
                            : (messageToDelete?.deleted
                              ? 'Delete for me'
                              : messageToDelete?.senderEmail === currentUser.email
                                ? (deleteForBoth ? 'Delete for everyone' : 'Delete for me')
                                : 'Delete for me')
                        }
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ), document.body)
      }

      {/* Clear Chat Confirmation Modal */}
      {
        showClearChatModal && createPortal((
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaTrash className="text-red-500" />
                Clear Chat
              </h3>

              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to clear chat? This action cannot be undone.
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  disabled={clearChatLoading}
                  onClick={() => setShowClearChatModal(false)}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={clearChatLoading}
                  onClick={handleClearChat}
                  className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {clearChatLoading ? (
                    <>
                      <UrbanSetuSpinner size="sm" isBright={true} />
                      <span>Clearing...</span>
                    </>
                  ) : (
                    <>
                      <FaTrash size={12} />
                      <span>Clear Chat</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ), document.body)
      }

      {/* Delete Appointment Confirmation Modal */}
      {
        showDeleteAppointmentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaTrash className="text-red-500" />
                Delete Appointment
              </h3>

              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Are you sure you want to delete this appointment?
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason for deletion (required):
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  rows="3"
                  placeholder="Please provide a reason for deleting this appointment..."
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteAppointmentModal(false);
                    setAppointmentToHandle(null);
                    setDeleteReason('');
                  }}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmAdminDelete}
                  className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <FaTrash size={12} />
                  Delete Appointment
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Cancel Appointment Modal */}
      {
        showCancelModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaBan className="text-orange-500" />
                Cancel Appointment
              </h3>

              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Are you sure you want to cancel this appointment?
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason for cancellation (required):
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  rows="3"
                  placeholder={isSeller ? "Please provide a reason for cancelling..." : "Optional reason for cancelling..."}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancelReason('');
                  }}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmUserCancel}
                  className="px-4 py-2 rounded bg-orange-600 text-white font-semibold hover:bg-orange-700 transition-colors flex items-center gap-2"
                >
                  <FaBan size={12} />
                  Cancel Appointment
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Admin Cancel Appointment Modal */}
      {
        showAdminCancelModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaBan className="text-red-500" />
                Admin Cancel Appointment
              </h3>

              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Are you sure you want to cancel this appointment as admin?
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason for admin cancellation (required):
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  rows="3"
                  placeholder="Please provide a reason for admin cancellation..."
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminCancelModal(false);
                    setCancelReason('');
                  }}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmAdminCancel}
                  className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <FaBan size={12} />
                  Cancel as Admin
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Permanent Delete Modal */}
      {
        showPermanentDeleteModal && createPortal((
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaTrash className="text-red-500" />
                Remove Appointment
              </h3>

              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to permanently remove this appointment from your table? This action cannot be undone.
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowPermanentDeleteModal(false)}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPermanentDelete}
                  className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <FaTrash size={12} />
                  Remove Permanently
                </button>
              </div>
            </div>
          </div>
        ), document.body)
      }
      {/* Report Message Modal */}
      {
        showReportModal && reportingMessage && createPortal((
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaFlag className="text-red-500" /> Report message
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900 dark:text-white dark:bg-gray-700"
                  >
                    <option value="">-- Select a reason --</option>
                    <option value="Spam or scam">Spam or scam</option>
                    <option value="Harassment or hate speech">Harassment or hate speech</option>
                    <option value="Inappropriate content">Inappropriate content</option>
                    <option value="Sensitive or personal data">Sensitive or personal data</option>
                    <option value="Fraud or illegal activity">Fraud or illegal activity</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {reportReason && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {reportReason === 'Other' ? 'Additional details *' : 'Additional details (optional)'}
                    </label>
                    <textarea
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      rows={4}
                      placeholder={reportReason === 'Other' ? 'Please provide details about the issue...' : 'Add any context to help admins review...'}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded resize-y focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900 dark:text-white dark:bg-gray-700"
                    />
                  </div>
                )}
                <div className="bg-gray-50 dark:bg-gray-700 rounded p-3 text-sm text-gray-700 dark:text-gray-300">
                  <div className="font-semibold mb-1 dark:text-white">Message excerpt:</div>
                  <div className="line-clamp-4 whitespace-pre-wrap">{(reportingMessage.message || '').slice(0, 300)}</div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => { setShowReportModal(false); setReportingMessage(null); setReportReason(''); setReportDetails(''); }}
                  disabled={submittingReport}
                  className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!reportReason) { toast.error('Please select a reason'); return; }
                    setSubmittingReport(true);
                    try {
                      const res = await authenticatedFetch(`${API_BASE_URL}/api/notifications/report-chat`, {
                        method: 'POST',
                        body: JSON.stringify({
                          appointmentId: appt._id,
                          commentId: reportingMessage._id,
                          reason: reportReason,
                          details: reportDetails,
                        })
                      });
                      if (!res.ok) {
                        const errorData = await res.json().catch(() => ({}));
                        throw { response: { status: res.status, data: errorData } };
                      }
                      const data = await res.json();
                      toast.info('Thank you for reporting.');
                      setShowReportModal(false);
                      setReportingMessage(null);
                      setReportReason('');
                      setReportDetails('');
                    } catch (err) {
                      toast.error(err.response?.data?.message || 'Network error while reporting');
                    } finally {
                      setSubmittingReport(false);
                    }
                  }}
                  disabled={submittingReport || !reportReason || (reportReason === 'Other' && !reportDetails.trim())}
                  className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {submittingReport ? 'Reporting…' : 'Report'}
                </button>
              </div>
            </div>
          </div>
        ), document.body)
      }



      {/* Report Chat Modal */}
      {
        showReportChatModal && createPortal((
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
            <div className="bg-white dark:bg-gray-800 dark:border dark:border-gray-700 rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaFlag className="text-red-500" /> Report Chat
              </h3>

              {/* Last 5 Messages Preview */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <FaInfoCircle className="text-blue-500 text-sm" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">The last 5 messages in this chat will be sent to UrbanSetu. This person won't know you reported them:</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
                  {filteredComments.slice(-5).map((message, index) => (
                    <div key={message._id || index} className="mb-3 last:mb-0">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-600 flex-shrink-0">
                          {message.senderName ? message.senderName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                              {message.senderName || 'Unknown User'}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {new Date(message.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-700">
                            {message.type === 'image' ? (
                              <div className="flex items-center gap-2">
                                <span>📷 Image: {message.message}</span>
                                {message.imageUrl && (
                                  <img
                                    src={message.imageUrl}
                                    alt="Reported image"
                                    className="w-8 h-8 object-cover rounded"
                                    onError={(e) => e.target.style.display = 'none'}
                                  />
                                )}
                              </div>
                            ) : (
                              <span className="whitespace-pre-wrap break-words">{message.message}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredComments.length === 0 && (
                    <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-4">
                      No messages to report
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                  <select
                    value={reportChatReason}
                    onChange={(e) => setReportChatReason(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900 dark:text-white dark:bg-gray-700"
                  >
                    <option value="">Select a reason</option>
                    <option value="harassment">Harassment or bullying</option>
                    <option value="spam">Spam or unwanted messages</option>
                    <option value="inappropriate">Inappropriate content</option>
                    <option value="scam">Scam or fraud</option>
                    <option value="threats">Threats or violence</option>
                    <option value="privacy">Privacy violation</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {reportChatReason && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {reportChatReason === 'other' ? 'Additional details *' : 'Additional details (optional)'}
                    </label>
                    <textarea
                      value={reportChatDetails}
                      onChange={(e) => setReportChatDetails(e.target.value)}
                      rows={4}
                      placeholder={reportChatReason === 'other' ? 'Please provide details about the issue...' : 'Provide more context to help admins review this chat...'}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900 dark:text-white dark:bg-gray-700"
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-end mt-6">
                <button
                  onClick={() => {
                    setShowReportChatModal(false);
                    setReportChatReason('');
                    setReportChatDetails('');
                  }}
                  className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!reportChatReason) {
                      toast.error('Please select a reason');
                      return;
                    }
                    setSubmittingChatReport(true);
                    try {
                      const res = await authenticatedFetch(`${API_BASE_URL}/api/notifications/report-chat-conversation`, {
                        method: 'POST',
                        body: JSON.stringify({
                          appointmentId: appt._id,
                          reason: reportChatReason,
                          details: reportChatDetails,
                        })
                      });
                      if (!res.ok) {
                        const errorData = await res.json().catch(() => ({}));
                        throw { response: { status: res.status, data: errorData } };
                      }
                      const data = await res.json();
                      toast.info('Thank you for reporting.');
                      setShowReportChatModal(false);
                      setReportChatReason('');
                      setReportChatDetails('');
                    } catch (err) {
                      toast.error(err.response?.data?.message || 'Network error while reporting');
                    } finally {
                      setSubmittingChatReport(false);
                    }
                  }}
                  disabled={submittingChatReport || !reportChatReason || (reportChatReason === 'other' && !reportChatDetails.trim())}
                  className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {submittingChatReport ? 'Reporting…' : 'Report'}
                </button>
              </div>
            </div>
          </div>
        ), document.body)
      }

      {/* Message Info Modal */}
      {
        showMessageInfoModal && selectedMessageForInfo && createPortal((
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaInfoCircle className="text-blue-500" /> Message Info
              </h3>
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded p-3 text-sm text-gray-700 dark:text-gray-300">
                  <div className="font-semibold mb-2">Message:</div>
                  <div className="whitespace-pre-wrap break-words">
                    {(selectedMessageForInfo.audioUrl || selectedMessageForInfo.type === 'audio') ? (
                      <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400"><FaMicrophone className="text-xs" /> Voice message</span>
                    ) : (selectedMessageForInfo.videoUrl || selectedMessageForInfo.type === 'video') ? (
                      <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400"><FaVideo className="text-xs" /> Video</span>
                    ) : (selectedMessageForInfo.imageUrl || selectedMessageForInfo.type === 'image') ? (
                      <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">📷 Photo</span>
                    ) : (selectedMessageForInfo.documentUrl || selectedMessageForInfo.type === 'document') ? (
                      <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400"><FaFileAlt className="text-xs" /> {selectedMessageForInfo.documentName || 'Document'}</span>
                    ) : (
                      <>{(selectedMessageForInfo.message || '').slice(0, 200)}{(selectedMessageForInfo.message || '').length > 200 ? '...' : ''}</>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Sent:</span>
                    <span className="text-sm text-gray-800 dark:text-gray-200">
                      {new Date(selectedMessageForInfo.timestamp).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </span>
                  </div>

                  {selectedMessageForInfo.deliveredAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Delivered:</span>
                      <span className="text-sm text-gray-800 dark:text-gray-200">
                        {new Date(selectedMessageForInfo.deliveredAt).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                    </div>
                  )}

                  {selectedMessageForInfo.readAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Read:</span>
                      <span className="text-sm text-gray-800 dark:text-gray-200">
                        {new Date(selectedMessageForInfo.readAt).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                    </div>
                  )}

                  {!selectedMessageForInfo.deliveredAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Status:</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">Not delivered yet</span>
                    </div>
                  )}

                  {selectedMessageForInfo.deliveredAt && !selectedMessageForInfo.readAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Status:</span>
                      <span className="text-sm text-blue-600 dark:text-blue-400">Delivered</span>
                    </div>
                  )}

                  {selectedMessageForInfo.readAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Status:</span>
                      <span className="text-sm text-green-600 dark:text-green-400">Read</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => { setShowMessageInfoModal(false); setSelectedMessageForInfo(null); }}
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ), document.body)
      }

      {/* Call Info Modal */}
      {
        showCallInfoModal && selectedCallForInfo && createPortal((
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FaInfoCircle className="text-blue-500" /> Call Info
              </h3>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded p-3 text-sm text-gray-700">
                  <div className="font-semibold mb-2">Call Type:</div>
                  <div>{selectedCallForInfo.callType === 'video' ? 'Video Call' : 'Audio Call'}</div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Status:</span>
                    <span className={`text-sm font-medium ${selectedCallForInfo.status === 'accepted' ? 'text-green-600' :
                      selectedCallForInfo.status === 'missed' || selectedCallForInfo.status === 'rejected' || selectedCallForInfo.status === 'cancelled' ? 'text-red-600' :
                        'text-yellow-600'
                      }`}>
                      {selectedCallForInfo.status.charAt(0).toUpperCase() + selectedCallForInfo.status.slice(1)}
                    </span>
                  </div>

                  {selectedCallForInfo.duration && selectedCallForInfo.duration > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Duration:</span>
                      <span className="text-sm text-gray-800">
                        {(() => {
                          const hours = Math.floor(selectedCallForInfo.duration / 3600);
                          const minutes = Math.floor((selectedCallForInfo.duration % 3600) / 60);
                          const secs = selectedCallForInfo.duration % 60;
                          if (hours > 0) {
                            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                          }
                          return `${minutes}:${secs.toString().padStart(2, '0')}`;
                        })()}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Started:</span>
                    <span className="text-sm text-gray-800">
                      {new Date(selectedCallForInfo.startTime || selectedCallForInfo.createdAt).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </span>
                  </div>

                  {(() => {
                    const isCaller = selectedCallForInfo.callerId?._id === currentUser._id || selectedCallForInfo.callerId === currentUser._id;
                    const callerName = selectedCallForInfo.callerId?.username || 'Unknown';
                    const receiverName = selectedCallForInfo.receiverId?.username || 'Unknown';
                    return (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Participants:</span>
                        <span className="text-sm text-gray-800">
                          {isCaller ? `You → ${receiverName}` : `${callerName} → You`}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => { setShowCallInfoModal(false); setSelectedCallForInfo(null); }}
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ), document.body)
      }
      {/* Starred Messages Modal */}
      {
        showStarredModal && createPortal((
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transition-colors">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <FaStar className="text-yellow-500" />
                  Starred Messages
                </h3>
                <button
                  onClick={fetchStarredMessages}
                  disabled={loadingStarredMessages}
                  className="p-2 text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/40 dark:hover:bg-yellow-900/60 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh starred messages"
                >
                  {loadingStarredMessages ? (
                    <UrbanSetuSpinner size="sm" />
                  ) : (
                    <FaSync className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {loadingStarredMessages ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <UrbanSetuSpinner size="lg" />
                    <span className="text-gray-600 font-medium">Loading starred messages...</span>
                  </div>
                ) : starredMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <FaRegStar className="mx-auto text-6xl text-gray-300 dark:text-gray-600 mb-4" />
                    <h4 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No Starred Messages</h4>
                    <p className="text-gray-500 dark:text-gray-400">Star important messages to find them easily later.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {starredMessages.map((message, index) => {
                      const isMe = message.senderEmail === currentUser.email;
                      const messageDate = new Date(message.timestamp);

                      return (
                        <div key={message._id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} mb-4`}>
                          <div className={`relative max-w-[80%] ${isMe ? 'ml-12' : 'mr-12'}`}>
                            {/* Star indicator and remove button */}
                            <div className={`flex items-center gap-2 mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <FaStar className="text-yellow-500 text-xs" />
                              <span className={`text-xs font-medium ${isMe ? 'text-blue-600' : 'text-green-600'}`}>
                                {isMe ? 'You' : (message.senderName || 'Other Party')}
                              </span>
                              <span className="text-xs text-gray-500">
                                {messageDate.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true
                                })}
                              </span>
                              {/* Remove star button */}
                              <button
                                onClick={async () => {
                                  setUnstarringMessageId(message._id);
                                  try {
                                    const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${message._id}/star`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ starred: false })
                                    });
                                    if (!res.ok) {
                                      const errorData = await res.json().catch(() => ({}));
                                      throw { response: { status: res.status, data: errorData } };
                                    }
                                    const data = await res.json();
                                    // Update the local comments state
                                    setComments(prev => prev.map(c =>
                                      c._id === message._id
                                        ? { ...c, starredBy: (c.starredBy || []).filter(id => id !== currentUser._id) }
                                        : c
                                    ));

                                    // Remove from starred messages list
                                    setStarredMessages(prev => prev.filter(m => m._id !== message._id));

                                    toast.success('Message unstarred.');
                                  } catch (err) {
                                    toast.error(err.response?.data?.message || 'Failed to unstar message');
                                  } finally {
                                    setUnstarringMessageId(null);
                                  }
                                }}
                                className="text-red-500 hover:text-red-700 text-xs p-1 rounded-full hover:bg-red-50 transition-colors"
                                title="Remove from starred messages"
                                disabled={unstarringMessageId === message._id}
                              >
                                {unstarringMessageId === message._id ? (
                                  <UrbanSetuSpinner size="sm" />
                                ) : (
                                  <FaTimes className="w-3 h-3" />
                                )}
                              </button>
                            </div>

                            {/* Message bubble - styled like chatbox */}
                            <div
                              className={`rounded-2xl px-4 py-3 text-sm shadow-lg break-words relative group cursor-pointer hover:shadow-xl transition-all duration-200 ${isMe
                                ? 'bg-gradient-to-r from-blue-600 to-purple-700 text-white hover:from-blue-500 hover:to-purple-600'
                                : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                                }`}
                              onClick={() => {
                                setShowStarredModal(false);
                                // Scroll to the message in the main chat - auto-expand visibleCount if needed
                                scrollToMessageById(message._id, 'starred-highlight');
                              }}
                            >
                              <div className="whitespace-pre-wrap break-words">
                                {message.deleted ? (
                                  <div>
                                    <span className="flex items-center gap-1 text-gray-400 italic mb-2">
                                      <FaBan className="inline-block text-lg" /> {message.senderEmail === currentUser.email ? "You deleted this message" : "This message was deleted."}
                                    </span>
                                    {(message.audioUrl || message.audio) && (
                                      <div className="mb-2 w-full min-w-[260px] sm:min-w-[300px]">
                                        <div className="relative">
                                          <audio
                                            src={message.audioUrl || message.audio}
                                            className="w-full"
                                            controls
                                            preload="metadata"
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                        </div>
                                        <div className="mt-1 text-xs text-gray-400 italic">
                                          Preserved audio from deleted message: {message.audioName || 'Audio file'}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <>
                                    {/* Audio Message */}
                                    {(message.audioUrl || message.audio || message.type === 'audio') ? (
                                      <div className="mb-2 w-full min-w-[260px] sm:min-w-[300px]">
                                        <div className="relative">
                                          <audio
                                            src={message.audioUrl || message.audio || message.mediaUrl || message.fileUrl || message.url}
                                            className="w-full"
                                            controls
                                            preload="metadata"
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                        </div>
                                        <div className="mt-1.5 flex justify-between items-center">
                                          <button
                                            type="button"
                                            className={`px-2.5 py-1 text-xs rounded-full shadow-sm border transition-colors ${isMe
                                              ? 'bg-white/20 hover:bg-white/30 text-white border-white/30'
                                              : 'bg-blue-600 text-white hover:bg-blue-700 border-transparent'
                                              }`}
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              const targetUrl = message.audioUrl || message.audio || message.mediaUrl || message.fileUrl || message.url;
                                              try {
                                                const response = await authenticatedFetch(targetUrl, { mode: 'cors' });
                                                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                                const blob = await response.blob();
                                                const blobUrl = window.URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = blobUrl;
                                                a.download = message.audioName || `audio-${message._id || Date.now()}`;
                                                document.body.appendChild(a);
                                                a.click();
                                                a.remove();
                                                setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
                                                toast.success('Audio downloaded successfully');
                                              } catch (error) {
                                                const a = document.createElement('a');
                                                a.href = targetUrl;
                                                a.download = message.audioName || `audio-${message._id || Date.now()}`;
                                                a.target = '_blank';
                                                document.body.appendChild(a);
                                                a.click();
                                                a.remove();
                                                toast.success('Audio download started');
                                              }
                                            }}
                                            title="Download audio"
                                          >
                                            <span className="inline-flex items-center gap-1 text-[11px] font-medium">
                                              <FaDownload className="w-3 h-3" />
                                              Download
                                            </span>
                                          </button>
                                          {message.audioName && (
                                            <span className={`text-[11px] truncate max-w-[140px] ${isMe ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                                              {message.audioName}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ) : message.type === 'audio' ? (
                                      <div className="mb-2 flex items-center gap-2 py-1">
                                        <FaMicrophone className={`text-sm ${isMe ? 'text-blue-200' : 'text-purple-500'}`} />
                                        <span className={`text-sm ${isMe ? 'text-blue-100' : 'text-gray-600 dark:text-gray-300'}`}>Voice message</span>
                                      </div>
                                    ) : null}
                                    {/* Video Message */}
                                    {message.videoUrl && (
                                      <div className="mb-2 relative group max-w-full inline-block">
                                        <div
                                          className="relative rounded-lg overflow-hidden bg-black cursor-pointer shadow-md hover:shadow-lg transition-all"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const videoUrls = (comments || []).filter(msg => !!msg.videoUrl && !msg.deleted).map(msg => msg.videoUrl);
                                            const startIndex = Math.max(0, videoUrls.indexOf(message.videoUrl));
                                            window.dispatchEvent(new CustomEvent('open-media-preview', {
                                              detail: { videos: videoUrls, index: startIndex }
                                            }));
                                          }}
                                        >
                                          {/* Use video tag as thumbnail, no controls */}
                                          <video
                                            src={message.videoUrl}
                                            className="max-w-full max-h-64 object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                                            preload="metadata"
                                          />
                                          {/* Play Overlay */}
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                                            <div className="bg-black/60 rounded-full p-3 backdrop-blur-sm transform group-hover:scale-110 transition-transform">
                                              <FaPlay className="text-white text-xl ml-1" />
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Image Message - Only show for non-deleted messages */}
                                    {message.imageUrl && (
                                      <div className="mb-2">
                                        <img
                                          src={message.imageUrl}
                                          alt="Shared image"
                                          className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const imageUrls = (comments || []).filter(msg => !!msg.imageUrl).map(msg => msg.imageUrl);
                                            const startIndex = Math.max(0, imageUrls.indexOf(message.imageUrl));
                                            setPreviewImages(imageUrls);
                                            setPreviewIndex(startIndex);
                                            setShowImagePreview(true);
                                          }}
                                          onError={(e) => {
                                            e.target.src = "https://via.placeholder.com/300x200?text=Image+Not+Found";
                                            e.target.className = "max-w-full max-h-64 rounded-lg opacity-50";
                                          }}
                                        />
                                      </div>
                                    )}
                                    {/* Document Message */}
                                    {message.documentUrl && (
                                      <div className="mb-2 flex items-center gap-2 py-1">
                                        <FaFileAlt className={`text-sm ${isMe ? 'text-blue-200' : 'text-orange-500'}`} />
                                        <span className={`text-sm truncate ${isMe ? 'text-blue-100' : 'text-gray-600 dark:text-gray-300'}`}>
                                          {message.documentName || 'Document'}
                                        </span>
                                      </div>
                                    )}
                                    <FormattedTextWithReadMore
                                      text={(message.message || '').replace(/\n+$/, '')}
                                      isSentMessage={isMe}
                                      className="whitespace-pre-wrap break-words"
                                      searchQuery={searchQuery}
                                    />
                                  </>
                                )}
                              </div>

                              {/* Copy button - appears on hover, only for non-deleted messages */}
                              {!message.deleted && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); copyMessageToClipboard(message.message); }}
                                  className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded-full ${isMe
                                    ? 'bg-white/20 hover:bg-white/30 text-white'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                                    }`}
                                  title="Copy message"
                                >
                                  <FaCopy className="w-3 h-3" />
                                </button>
                              )}

                              {/* Edited indicator only (no time display) */}
                              {message.edited && (
                                <div className={`flex justify-end mt-2 text-xs ${isMe ? 'text-blue-200' : 'text-gray-500'
                                  }`}>
                                  <span className="italic">(Edited)</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {starredMessages.length} starred message{starredMessages.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex gap-2">
                    {starredMessages.length > 0 && (
                      <button
                        onClick={handleRemoveAllStarredMessages}
                        disabled={removingAllStarred}
                        className="px-2 sm:px-4 py-1.5 sm:py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                      >
                        {removingAllStarred ? (
                          <>
                            <UrbanSetuSpinner size="sm" isBright={true} />
                            Removing...
                          </>
                        ) : (
                          <>
                            <FaTrash className="w-4 h-4" />
                            Remove All
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => setShowStarredModal(false)}
                      className="px-2 sm:px-4 py-1.5 sm:py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium text-xs sm:text-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ), document.body)
      }
      {/* Media Modal */}
      {
        showMediaModal && createPortal((
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-2 sm:p-4" onClick={() => setShowMediaModal(false)}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col transition-colors border border-gray-200 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl">
                    <FaPhotoVideo className="text-lg text-white" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white leading-tight">Media Gallery</h3>
                    <p className="text-[11px] text-blue-100 opacity-90">Browse photos, videos, documents & links</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMediaModal(false)}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-all"
                  title="Close"
                >
                  <FaTimes className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-100/70 dark:bg-gray-900 overflow-x-auto px-2 sm:px-4">
                {[
                  { key: 'images', label: 'Images', icon: <FaImage className="text-xs" /> },
                  { key: 'videos', label: 'Videos', icon: <FaVideo className="text-xs" /> },
                  { key: 'audio', label: 'Audio', icon: <FaVolumeUp className="text-xs" /> },
                  { key: 'docs', label: 'Docs', icon: <FaFileAlt className="text-xs" /> },
                  { key: 'links', label: 'Links', icon: <FaLink className="text-xs" /> },
                ].map(tab => (
                  <button
                    key={tab.key}
                    className={`px-3.5 sm:px-5 py-3 text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all border-b-2 whitespace-nowrap shrink-0 ${
                      mediaModalTab === tab.key
                        ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800 rounded-t-lg shadow-xs'
                        : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-800/50'
                    }`}
                    onClick={() => {
                      setMediaModalTab(tab.key);
                      setMediaModalLoading(true);
                      setTimeout(() => setMediaModalLoading(false), 350);
                    }}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {/* Count badge */}
                    {(() => {
                      let count = 0;
                      const msgs = comments || [];
                      if (tab.key === 'images') count = msgs.filter(c => c.imageUrl && !c.deleted).length;
                      else if (tab.key === 'videos') count = msgs.filter(c => c.videoUrl && !c.deleted).length;
                      else if (tab.key === 'audio') count = msgs.filter(c => c.audioUrl && !c.deleted).length;
                      else if (tab.key === 'docs') count = msgs.filter(c => c.documentUrl && !c.deleted).length;
                      else if (tab.key === 'links') {
                        const urlRegex = /(https?:\/\/[^\s]+)/gi;
                        count = msgs.filter(c => !c.deleted && !c.imageUrl && !c.videoUrl && !c.audioUrl && !c.documentUrl && c.message && urlRegex.test(c.message)).length;
                      }
                      return count > 0 ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          mediaModalTab === tab.key
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                            : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}>{count}</span>
                      ) : null;
                    })()}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 bg-white dark:bg-gray-900" style={{ minHeight: '300px', maxHeight: 'calc(90vh - 180px)' }}>
                {mediaModalLoading ? (
                  /* Premium Skeleton Loading */
                  <div className="animate-pulse space-y-4">
                    {(mediaModalTab === 'images' || mediaModalTab === 'videos') ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 opacity-40"></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-3 p-3.5 bg-gray-100 dark:bg-gray-800/70 border border-gray-200/50 dark:border-gray-700/50 rounded-xl">
                            <div className="w-10 h-10 bg-gray-300 dark:bg-gray-700 rounded-xl shrink-0"></div>
                            <div className="flex-1 space-y-2 min-w-0">
                              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded-md w-3/4"></div>
                              <div className="h-3 bg-gray-200 dark:bg-gray-700/60 rounded-md w-1/2"></div>
                            </div>
                            <div className="w-8 h-8 bg-gray-300 dark:bg-gray-700 rounded-lg shrink-0"></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Images Tab */}
                    {mediaModalTab === 'images' && (() => {
                      const imageMessages = (comments || []).filter(c => c.imageUrl && !c.deleted);
                      if (imageMessages.length === 0) return (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                          <FaImage className="text-5xl mb-3 opacity-40" />
                          <p className="text-base font-semibold">No images shared yet</p>
                          <p className="text-xs mt-1 text-gray-400">Photos sent in this chat will appear here</p>
                        </div>
                      );
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                          {imageMessages.map((msg, idx) => (
                            <div
                              key={msg._id || idx}
                              className="relative group aspect-square rounded-2xl overflow-hidden cursor-pointer bg-gray-100 dark:bg-gray-800 shadow-xs hover:shadow-md transition-all border border-gray-200/60 dark:border-gray-800"
                              onClick={() => {
                                const imageUrls = imageMessages.map(m => m.imageUrl);
                                setPreviewImages(imageUrls);
                                setPreviewIndex(idx);
                                setShowImagePreview(true);
                              }}
                            >
                              <img
                                src={msg.imageUrl}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                                onError={(e) => { e.target.src = "https://via.placeholder.com/300x300?text=Image"; }}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />
                              <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/70 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-white text-[11px] font-medium truncate">{msg.senderName || msg.senderEmail || 'User'}</p>
                                <p className="text-white/70 text-[9px]">{msg.timestamp ? new Date(msg.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Videos Tab */}
                    {mediaModalTab === 'videos' && (() => {
                      const videoMessages = (comments || []).filter(c => c.videoUrl && !c.deleted);
                      if (videoMessages.length === 0) return (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                          <FaVideo className="text-5xl mb-3 opacity-40" />
                          <p className="text-base font-semibold">No videos shared yet</p>
                          <p className="text-xs mt-1 text-gray-400">Videos sent in this chat will appear here</p>
                        </div>
                      );
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                          {videoMessages.map((msg, idx) => (
                            <div
                              key={msg._id || idx}
                              className="relative group aspect-square rounded-2xl overflow-hidden cursor-pointer bg-black shadow-xs hover:shadow-md transition-all border border-gray-800"
                              onClick={() => {
                                const videoUrls = videoMessages.map(m => m.videoUrl);
                                window.dispatchEvent(new CustomEvent('open-media-preview', {
                                  detail: { videos: videoUrls, index: idx }
                                }));
                              }}
                            >
                              <video
                                src={msg.videoUrl}
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                preload="metadata"
                                muted
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-black/60 rounded-full p-3 backdrop-blur-md group-hover:scale-110 transition-transform border border-white/20">
                                  <FaPlay className="text-white text-sm ml-0.5" />
                                </div>
                              </div>
                              <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/70 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-white text-[11px] font-medium truncate">{msg.senderName || msg.senderEmail || 'User'}</p>
                                <p className="text-white/70 text-[9px]">{msg.timestamp ? new Date(msg.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Audio Tab */}
                    {mediaModalTab === 'audio' && (() => {
                      const audioMessages = (comments || []).filter(c => c.audioUrl && !c.deleted);
                      if (audioMessages.length === 0) return (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                          <FaVolumeUp className="text-5xl mb-3 opacity-40" />
                          <p className="text-base font-semibold">No audio messages</p>
                          <p className="text-xs mt-1 text-gray-400">Audio recordings sent in this chat will appear here</p>
                        </div>
                      );
                      return (
                        <div className="space-y-2.5">
                          {audioMessages.map((msg, idx) => (
                            <div key={msg._id || idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 bg-gray-50 dark:bg-gray-800/60 hover:bg-blue-50/40 dark:hover:bg-gray-800 border border-gray-200/70 dark:border-gray-700/60 rounded-xl transition-all min-w-0">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                                  <FaMicrophone className="text-base" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <audio
                                    src={msg.audioUrl}
                                    className="w-full h-8 max-w-xs sm:max-w-md"
                                    controls
                                    preload="metadata"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-gray-500 dark:text-gray-400">
                                    <span className="truncate max-w-[140px]">{msg.senderName || msg.senderEmail || 'User'}</span>
                                    <span>•</span>
                                    <span>{msg.timestamp ? new Date(msg.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</span>
                                  </div>
                                </div>
                              </div>
                              <button
                                className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40 rounded-lg transition-colors shrink-0 self-end sm:self-center flex items-center gap-1.5 text-xs font-medium"
                                title="Download Audio"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const response = await authenticatedFetch(msg.audioUrl, { mode: 'cors' });
                                    if (!response.ok) throw new Error();
                                    const blob = await response.blob();
                                    const blobUrl = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = blobUrl;
                                    a.download = msg.audioName || `audio-${msg._id || Date.now()}`;
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
                                    toast.success('Audio downloaded');
                                  } catch {
                                    const a = document.createElement('a');
                                    a.href = msg.audioUrl;
                                    a.download = msg.audioName || `audio-${msg._id || Date.now()}`;
                                    a.target = '_blank';
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                  }
                                }}
                              >
                                <FaDownload className="w-3.5 h-3.5" />
                                <span className="sm:hidden">Download</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Docs Tab */}
                    {mediaModalTab === 'docs' && (() => {
                      const docMessages = (comments || []).filter(c => c.documentUrl && !c.deleted);
                      if (docMessages.length === 0) return (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                          <FaFileAlt className="text-5xl mb-3 opacity-40" />
                          <p className="text-base font-semibold">No documents shared yet</p>
                          <p className="text-xs mt-1 text-gray-400">Files and PDFs sent in this chat will appear here</p>
                        </div>
                      );
                      return (
                        <div className="space-y-2.5">
                          {docMessages.map((msg, idx) => {
                            const { ext, docName } = getChatDocDetails(msg.documentUrl, msg.documentName, msg.documentMimeType);
                            return (
                              <div key={msg._id || idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 bg-gray-50 dark:bg-gray-800/60 hover:bg-blue-50/40 dark:hover:bg-gray-800 border border-gray-200/70 dark:border-gray-700/60 rounded-xl transition-all min-w-0">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                    ext === 'pdf' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                                    ['doc', 'docx'].includes(ext) ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                                    ['xls', 'xlsx', 'csv'].includes(ext) ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                                    'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                                  }`}>
                                    <FaFileAlt className="text-base" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 truncate break-all" title={docName}>{docName}</p>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-gray-500 dark:text-gray-400">
                                      <span className="uppercase font-bold text-[10px] px-1.5 py-0.2 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">{ext}</span>
                                      <span>•</span>
                                      <span className="truncate max-w-[120px]">{msg.senderName || msg.senderEmail || 'User'}</span>
                                      <span>•</span>
                                      <span>{msg.timestamp ? new Date(msg.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-200/50 dark:border-gray-700/50 w-full sm:w-auto justify-end">
                                  <button
                                    className="px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 rounded-lg transition-colors flex items-center gap-1.5"
                                    title="View Document"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      let type = 'document';
                                      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) type = 'image';
                                      else if (ext === 'pdf') type = 'pdf';
                                      const previewUrl = `/user/view-chat/preview?url=${encodeURIComponent(msg.documentUrl)}&name=${encodeURIComponent(docName)}&type=${type}&appointmentId=${appt._id}&source=my_appointments`;
                                      window.open(previewUrl, '_blank');
                                    }}
                                  >
                                    <FaExternalLinkAlt className="w-3 h-3" />
                                    <span>View</span>
                                  </button>
                                  <button
                                    className="px-2.5 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40 rounded-lg transition-colors flex items-center gap-1.5"
                                    title="Download Document"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadChatDocument(msg.documentUrl, msg.documentName, msg.documentMimeType);
                                    }}
                                  >
                                    <FaDownload className="w-3 h-3" />
                                    <span>Download</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Links Tab */}
                    {mediaModalTab === 'links' && (() => {
                      const urlRegex = /(https?:\/\/[^\s]+)/gi;
                      const linkMessages = (comments || []).filter(c => {
                        if (c.deleted) return false;
                        if (c.imageUrl || c.videoUrl || c.audioUrl || c.documentUrl) return false;
                        return c.message && urlRegex.test(c.message);
                      });
                      if (linkMessages.length === 0) return (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                          <FaLink className="text-5xl mb-3 opacity-40" />
                          <p className="text-base font-semibold">No links shared yet</p>
                          <p className="text-xs mt-1 text-gray-400">Web links sent in this chat will appear here</p>
                        </div>
                      );
                      return (
                        <div className="space-y-2.5">
                          {linkMessages.map((msg, idx) => {
                            const msgUrlRegex = /(https?:\/\/[^\s]+)/gi;
                            const urls = (msg.message || '').match(msgUrlRegex) || [];
                            const firstUrl = urls[0] || '';
                            let domain = '';
                            try { domain = new URL(firstUrl).hostname; } catch { domain = firstUrl; }
                            return (
                              <div key={msg._id || idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 bg-gray-50 dark:bg-gray-800/60 hover:bg-blue-50/40 dark:hover:bg-gray-800 border border-gray-200/70 dark:border-gray-700/60 rounded-xl transition-all min-w-0">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0">
                                    <FaLink className="text-base" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 truncate break-all hover:underline cursor-pointer" onClick={() => window.open(firstUrl, '_blank')}>{firstUrl}</p>
                                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 flex-wrap">
                                      <span className="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{domain}</span>
                                      <span>•</span>
                                      <span className="truncate max-w-[120px]">{msg.senderName || msg.senderEmail || 'User'}</span>
                                      <span>•</span>
                                      <span>{msg.timestamp ? new Date(msg.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</span>
                                    </div>
                                    {msg.message && msg.message.length > firstUrl.length + 5 && (
                                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{msg.message.replace(firstUrl, '').trim()}</p>
                                    )}
                                  </div>
                                </div>
                                <button
                                  className="px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 rounded-lg transition-colors shrink-0 self-end sm:self-center flex items-center gap-1.5"
                                  title="Open link"
                                  onClick={() => window.open(firstUrl, '_blank')}
                                >
                                  <FaExternalLinkAlt className="w-3 h-3" />
                                  <span>Open</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">UrbanSetu Chat Media</span>
                <button
                  onClick={() => setShowMediaModal(false)}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-md shadow-blue-500/20 font-semibold text-xs sm:text-sm transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ), document.body)
      }
      {/* Pin Message Modal */}
      {
        showPinModal && messageToPin && createPortal((
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Header */}
              <div className="flex items-center p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/40 dark:to-blue-900/40">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <FaThumbtack className="text-purple-500" />
                  Pin Message
                </h3>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="mb-4">
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {Array.isArray(messageToPin)
                      ? `Choose how long to pin these ${messageToPin.length} messages:`
                      : 'Choose how long to pin this message:'}
                  </p>

                  {/* Pin Duration Options */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <input
                        type="radio"
                        name="pinDuration"
                        value="24hrs"
                        checked={pinDuration === '24hrs'}
                        onChange={(e) => setPinDuration(e.target.value)}
                        className="text-purple-600"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800 dark:text-gray-200">24 Hours</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Pin for 24 hours</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <input
                        type="radio"
                        name="pinDuration"
                        value="7days"
                        checked={pinDuration === '7days'}
                        onChange={(e) => setPinDuration(e.target.value)}
                        className="text-purple-600"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800 dark:text-gray-200">7 Days</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Pin for 7 days</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <input
                        type="radio"
                        name="pinDuration"
                        value="30days"
                        checked={pinDuration === '30days'}
                        onChange={(e) => setPinDuration(e.target.value)}
                        className="text-purple-600"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800 dark:text-gray-200">30 Days</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Pin for 30 days</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <input
                        type="radio"
                        name="pinDuration"
                        value="custom"
                        checked={pinDuration === 'custom'}
                        onChange={(e) => setPinDuration(e.target.value)}
                        className="text-purple-600"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800 dark:text-gray-200">Custom</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Pin for custom hours</div>
                      </div>
                    </label>
                  </div>

                  {/* Custom Hours Input */}
                  {pinDuration === 'custom' && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Custom Hours
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="8760"
                        value={customHours}
                        onChange={(e) => setCustomHours(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Enter hours (1-8760)"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Maximum: 8760 hours (1 year)
                      </p>
                    </div>
                  )}

                  {/* Message Preview */}
                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {Array.isArray(messageToPin) ? 'Messages to pin:' : 'Message to pin:'}
                    </div>
                    {Array.isArray(messageToPin) ? (
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {messageToPin.map((msg, index) => (
                          <div key={msg._id} className="text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-700">
                            <span className="font-medium text-xs text-gray-500 dark:text-gray-400">#{index + 1}: </span>
                            {msg.message?.substring(0, 80)}
                            {msg.message?.length > 80 ? '...' : ''}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-700">
                        {messageToPin.message?.substring(0, 100)}
                        {messageToPin.message?.length > 100 ? '...' : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowPinModal(false);
                    setMessageToPin(null);
                    setPinDuration('24hrs');
                    setCustomHours(24);
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (Array.isArray(messageToPin)) {
                      // Handle multiple messages
                      setPinningSaving(true);
                      try {


                        // Process messages one by one to handle individual failures gracefully
                        let successCount = 0;
                        let failureCount = 0;
                        const failedMessages = [];
                        const successfulMessages = [];

                        for (const msg of messageToPin) {
                          try {


                            const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${msg._id}/pin`, {
                              method: 'PATCH',
                              body: JSON.stringify({
                                pinned: true,
                                pinDuration: pinDuration,
                                customHours: pinDuration === 'custom' ? customHours : undefined
                              })
                            });
                            if (!res.ok) {
                              const errorData = await res.json().catch(() => ({}));
                              throw { response: { status: res.status, data: errorData } };
                            }
                            const data = await res.json();
                            const response = { status: 200, data };


                            successCount++;
                            successfulMessages.push(msg);

                          } catch (err) {
                            console.error(`Failed to pin message ${msg._id}:`, err);
                            failureCount++;
                            failedMessages.push(msg);
                          }
                        }



                        if (successCount > 0) {
                          // Calculate expiry date based on duration
                          const now = new Date();
                          let expiryDate;
                          if (pinDuration === '24hrs') {
                            expiryDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                          } else if (pinDuration === '7days') {
                            expiryDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                          } else if (pinDuration === '30days') {
                            expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                          } else if (pinDuration === 'custom') {
                            expiryDate = new Date(now.getTime() + customHours * 60 * 60 * 1000);
                          }

                          // Update UI state for successfully pinned messages
                          setComments(prev => prev.map(c => {
                            const pinnedMsg = successfulMessages.find(msg => msg._id === c._id);
                            if (pinnedMsg) {
                              return {
                                ...c,
                                pinned: true,
                                pinnedBy: currentUser._id,
                                pinnedAt: now,
                                pinExpiresAt: expiryDate,
                                pinDuration: pinDuration
                              };
                            }
                            return c;
                          }));

                          // Update pinned messages list
                          const newPinnedMessages = successfulMessages.map(msg => ({
                            ...msg,
                            pinned: true,
                            pinnedBy: currentUser._id,
                            pinnedAt: now,
                            pinExpiresAt: expiryDate,
                            pinDuration: pinDuration
                          }));

                          setPinnedMessages(prev => {
                            const filtered = prev.filter(m => !successfulMessages.some(msg => msg._id === m._id));
                            return [...filtered, ...newPinnedMessages];
                          });

                          // Show appropriate feedback
                          if (successCount > 0 && failureCount === 0) {
                            toast.success(`Successfully pinned ${successCount} messages`);
                            // Clear selection mode if all messages were processed successfully
                            setIsSelectionMode(false);
                            setSelectedMessages([]);
                          } else if (successCount > 0 && failureCount > 0) {
                            toast.warning(`Partially successful: ${successCount} messages pinned, ${failureCount} failed`);
                          } else {
                            toast.error(`Failed to pin any messages. Please try again.`);
                          }
                        } else {
                          toast.error(`Failed to pin any messages. Please try again.`);
                        }

                      } catch (err) {
                        console.error('Error in bulk pinning operation:', err);
                        if (err.response) {
                          console.error('Response data:', err.response.data);
                          console.error('Response status:', err.response.status);
                        }
                        toast.error('Failed to pin messages. Please try again.');
                      } finally {
                        setPinningSaving(false);
                      }
                    } else {
                      // Handle single message (existing logic)
                      handlePinMessage(messageToPin, true, pinDuration, customHours);
                    }
                    setShowPinModal(false);
                    setMessageToPin(null);
                    setPinDuration('24hrs');
                    setCustomHours(24);
                  }}
                  disabled={pinningSaving}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pinningSaving ? (
                    <div className="flex items-center gap-2">
                      <UrbanSetuSpinner size="sm" isBright={true} />
                      Pinning...
                    </div>
                  ) : (
                    Array.isArray(messageToPin) ? `Pin ${messageToPin.length} Messages` : 'Pin Message'
                  )}
                </button>
              </div>
            </div>
          </div>
        ), document.body)
      }

      {/* Image Preview Modal */}
      <ImagePreview
        isOpen={showImagePreview}
        onClose={() => setShowImagePreview(false)}
        images={previewImages}
        initialIndex={previewIndex}
        listingId={null}
        metadata={{
          addedFrom: 'chat',
          chatType: 'appointment'
        }}
      />



    </>
  );
}

// Payment Status Cell Component
function PaymentStatusCell({ appointment, isBuyer }) {
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false); // Track if Pay Now button is loading
  const [showPayModal, setShowPayModal] = useState(false);
  const [showRefundRequestModal, setShowRefundRequestModal] = useState(false);
  const [refundRequestForm, setRefundRequestForm] = useState({
    reason: '',
    amount: 0,
    type: 'full'
  });
  const [submittingRefundRequest, setSubmittingRefundRequest] = useState(false);
  const [refundRequestStatus, setRefundRequestStatus] = useState(null);
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [appealForm, setAppealForm] = useState({
    reason: '',
    text: ''
  });
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  useEffect(() => {
    fetchPaymentStatus();
  }, [appointment._id]); // Removed paymentConfirmed to prevent premature refetch before backend updates

  // Listen for payment status updates via socket or custom events
  useEffect(() => {
    let refetchTimeout = null;

    function handlePaymentUpdate(event) {
      const appointmentId = event.detail?.appointmentId || event.appointmentId;
      const paymentConfirmed = event.detail?.paymentConfirmed ?? event.paymentConfirmed;

      if (appointmentId === appointment._id && paymentConfirmed) {
        // Clear any pending refetch
        if (refetchTimeout) {
          clearTimeout(refetchTimeout);
        }
        // Wait longer for backend to fully process and ensure completed payment is saved
        // Increased delay to 2 seconds to prevent race conditions
        refetchTimeout = setTimeout(async () => {
          await fetchPaymentStatus(true); // Skip loading state
        }, 2000);
      }
    }

    // Listen for custom DOM events (from MyPayments page)
    window.addEventListener('paymentStatusUpdated', handlePaymentUpdate);

    // Listen for socket events
    if (socket) {
      socket.on('paymentStatusUpdated', handlePaymentUpdate);
    }

    return () => {
      if (refetchTimeout) {
        clearTimeout(refetchTimeout);
      }
      window.removeEventListener('paymentStatusUpdated', handlePaymentUpdate);
      if (socket) {
        socket.off('paymentStatusUpdated', handlePaymentUpdate);
      }
    };
  }, [appointment._id]);

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

  // Lock body scroll when appeal modal is open
  useEffect(() => {
    if (showAppealModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showAppealModal]);

  // Lock body scroll when pay modal is open
  useEffect(() => {
    if (showPayModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showPayModal]);

  const fetchPaymentStatus = async (skipLoading = false) => {
    try {
      if (!skipLoading) {
        setLoading(true);
      }
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/history?appointmentId=${appointment._id}`);
      const data = await response.json();
      if (response.ok && data.payments && data.payments.length > 0) {
        // Prioritize completed or admin-marked payments first
        // Then prioritize non-cancelled payments
        // This ensures completed payments are always shown even if cancelled payments were created later
        const completedPayment = data.payments.find(p =>
          p.status === 'completed' || p.metadata?.adminMarked
        );
        const latestPayment = completedPayment ||
          data.payments.find(p => p.status !== 'cancelled') ||
          data.payments[0];

        // Only update if we got a valid payment with status
        if (latestPayment && latestPayment.status) {
          // Only update if we're setting a completed payment, or if current status is not completed
          // This prevents overwriting completed status with cancelled/failed status
          if (latestPayment.status === 'completed' || latestPayment.metadata?.adminMarked ||
            !paymentStatus || (paymentStatus.status !== 'completed' && !paymentStatus.metadata?.adminMarked)) {
            setPaymentStatus(latestPayment);
            // Fetch refund request status
            await fetchRefundRequestStatus(latestPayment.paymentId);
          }
        }
      } else if (response.ok && (!data.payments || data.payments.length === 0)) {
        // No payments found - clear payment status
        setPaymentStatus(null);
      }
    } catch (error) {
      console.error('Error fetching payment status:', error);
    } finally {
      if (!skipLoading) {
        setLoading(false);
      }
    }
  };

  const fetchRefundRequestStatus = async (paymentId) => {
    try {
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/refund-request-status/${paymentId}`);
      const data = await response.json();
      if (response.ok && data.refundRequest) {
        setRefundRequestStatus(data.refundRequest);
      } else {
        setRefundRequestStatus(null);
      }
    } catch (error) {
      console.error('Error fetching refund request status:', error);
      setRefundRequestStatus(null);
    }
  };

  const handlePayNowClick = async () => {
    // Set loading state for button
    setPaying(true);
    // Check if payment is already completed before opening modal
    try {
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/history?appointmentId=${appointment._id}`);
      const data = await response.json();

      if (response.ok && data.payments && data.payments.length > 0) {
        // Prioritize completed or admin-marked payments first
        const completedPayment = data.payments.find(p =>
          p.status === 'completed' || p.metadata?.adminMarked
        );
        const latestPayment = completedPayment ||
          data.payments.find(p => p.status !== 'cancelled') ||
          data.payments[0];

        // Check if payment is already completed
        if (latestPayment.status === 'completed' || latestPayment.metadata?.adminMarked) {
          toast.success('Payment already completed!');
          // Update payment status immediately - lock this status
          setPaymentStatus(latestPayment);
          setLoading(false);
          // Update appointment paymentConfirmed flag immediately
          if (appointment.paymentConfirmed !== true) {
            window.dispatchEvent(new CustomEvent('paymentStatusUpdated', {
              detail: {
                appointmentId: appointment._id,
                paymentConfirmed: true
              }
            }));
          }
          // Don't refetch immediately - let the socket event handler handle it after a delay
          // This prevents race conditions where cancelled payments might overwrite completed status
          setPaying(false);
          return;
        }

        // Check for active (pending/processing) payments that are NOT cancelled
        const activePayment = data.payments.find(payment =>
          (payment.status === 'pending' || payment.status === 'processing') &&
          payment.status !== 'cancelled'
        );

        if (activePayment) {
          // Check if another tab/window/browser has the payment modal open using backend lock
          try {
            const lockCheckResponse = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/lock/check/${appointment._id}`);

            const lockCheckData = await lockCheckResponse.json();

            if (lockCheckData.ok && lockCheckData.locked === true && !lockCheckData.ownedByUser) {
              // Another browser/device has the payment modal open
              toast.warning(lockCheckData.message || 'A payment session is already open for this appointment in another browser/device. Please close that browser/device first before opening a new payment session.');
              setPaymentStatus(activePayment);
              setLoading(false);
              setPaying(false);
              return;
            }

            // Also check localStorage for same-browser detection (fallback)
            const lockKey = `payment_lock_${appointment._id}`;
            const lockData = localStorage.getItem(lockKey);

            if (lockData) {
              try {
                const { tabId: ownerTabId, timestamp } = JSON.parse(lockData);
                const currentTabId = sessionStorage.getItem('paymentTabId');
                const now = Date.now();

                // If lock is not stale (less than 5 seconds old) and owned by another tab
                if (now - timestamp <= 5000 && ownerTabId !== currentTabId) {
                  toast.warning('A payment session is already open for this appointment in another tab. Please close that tab first before opening a new payment session.');
                  setPaymentStatus(activePayment);
                  setLoading(false);
                  setPaying(false);
                  return;
                }
              } catch (e) {
                // Invalid lock data, ignore
              }
            }
          } catch (lockCheckError) {
            console.error('Error checking payment lock:', lockCheckError);
            // If lock check fails, continue (allow opening modal as fallback)
          }

          // Check if the active payment has expired
          const now = new Date();
          const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
          let isExpired = false;

          if (activePayment.expiresAt) {
            const expiresAt = new Date(activePayment.expiresAt);
            isExpired = expiresAt <= now;
          } else if (activePayment.createdAt) {
            const createdAt = new Date(activePayment.createdAt);
            isExpired = createdAt <= tenMinutesAgo;
          }

          if (isExpired) {
            // Payment expired, allow opening modal (will create new payment)
            toast.info('Previous payment session expired. Opening a new payment session.');
            setPaymentStatus(activePayment);
          } else {
            // Payment not expired, allow opening modal (will create new payment ID)
            // Since each payment attempt creates a new payment ID, no need to show "resuming" message
            setPaymentStatus(activePayment);
          }
          // Continue to open modal - backend will handle creating new payment
        }

        // If latest payment is cancelled, failed, or expired, show appropriate message and allow retry
        if (latestPayment.status === 'cancelled' && !activePayment) {
          toast.info('Previous payment was cancelled. You can initiate a new payment.');
        } else if (latestPayment.status === 'failed' && !activePayment) {
          toast.info('Previous payment failed. You can retry the payment.');
        }
      }

      // Initialize appointment lock before opening modal (timer is tied to appointment slot, not payment ID)
      try {
        const lockInitResponse = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/lock/initialize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ appointmentId: appointment._id })
        });

        if (lockInitResponse.ok) {
          const lockData = await lockInitResponse.json();
          // Update appointment with lock info if provided
          if (lockData.appointment) {
            appointment.lockStartTime = lockData.appointment.lockStartTime;
            appointment.lockExpiryTime = lockData.appointment.lockExpiryTime;
          }
        }
      } catch (lockError) {
        console.error('Error initializing appointment lock:', lockError);
        // Continue anyway - backend will initialize lock when creating payment intent
      }

      // If payment is not completed and no active payment, proceed with opening the modal
      setShowPayModal(true);
      setPaying(false); // Clear loading when modal opens
    } catch (error) {
      console.error('Error checking payment status:', error);
      // If there's an error checking, still allow opening the modal
      setShowPayModal(true);
      setPaying(false); // Clear loading on error
    }
  };

  if (loading) {
    return <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>;
  }

  // Determine the display status based on latest payment record only
  const getDisplayStatus = () => {
    // First check if there's a payment record
    if (!paymentStatus) {
      return { status: 'pending', text: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' };
    }

    // Check if admin marked this payment
    const isAdminMarked = Boolean(paymentStatus?.metadata?.adminMarked);
    if (isAdminMarked) {
      return { status: 'admin_confirmed', text: 'Paid (Admin)', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' };
    }

    // For sellers, hide refund-related statuses (refunded, partially_refunded, failed)
    // Only show these statuses to buyers
    if (!isBuyer && ['refunded', 'partially_refunded', 'failed'].includes(paymentStatus.status)) {
      // For sellers, show as completed/paid instead of refund statuses
      return { status: 'completed', text: 'Paid', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' };
    }

    // For user payments, show regular payment status
    return getPaymentStatusInfo(paymentStatus.status);
  };

  const getPaymentStatusInfo = (status) => {
    switch (status) {
      case 'completed':
        return { status: 'completed', text: 'Paid', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' };
      case 'pending':
        return { status: 'pending', text: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' };
      case 'failed':
        return { status: 'failed', text: 'Failed', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' };
      case 'refunded':
        return { status: 'refunded', text: 'Refunded', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' };
      case 'partially_refunded':
        return { status: 'partially_refunded', text: 'Partial Refund', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' };
      default:
        return { status: 'unknown', text: status, color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' };
    }
  };

  const handleRefundRequest = async (e) => {
    e.preventDefault();
    if (!paymentStatus) return;

    try {
      setSubmittingRefundRequest(true);
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/refund-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId: paymentStatus.paymentId,
          appointmentId: appointment._id,
          reason: refundRequestForm.reason,
          requestedAmount: refundRequestForm.type === 'full' ? paymentStatus.amount : refundRequestForm.amount,
          type: refundRequestForm.type
        })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Refund request submitted successfully');
        setShowRefundRequestModal(false);
        setRefundRequestForm({ reason: '', amount: 0, type: 'full' });
        // Refresh payment status
        fetchPaymentStatus();
      } else {
        toast.error(data.message || 'Failed to submit refund request');
      }
    } catch (error) {
      console.error('Error submitting refund request:', error);
      toast.error('An error occurred while submitting refund request');
    } finally {
      setSubmittingRefundRequest(false);
    }
  };

  const handleAppealSubmit = async (e) => {
    e.preventDefault();
    if (!refundRequestStatus || !appealForm.reason || !appealForm.text) return;

    try {
      setSubmittingAppeal(true);
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/refund-appeal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refundRequestId: refundRequestStatus._id,
          appealReason: appealForm.reason,
          appealText: appealForm.text
        })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Appeal submitted successfully. Please wait for response.');
        setShowAppealModal(false);
        setAppealForm({ reason: '', text: '' });
        // Refresh payment status to get updated refund request status
        fetchPaymentStatus();
      } else {
        toast.error(data.message || 'Failed to submit appeal');
      }
    } catch (error) {
      console.error('Error submitting appeal:', error);
      toast.error('An error occurred while submitting appeal');
    } finally {
      setSubmittingAppeal(false);
    }
  };

  const displayStatus = getDisplayStatus();
  // Check if appointment is in a frozen status (no payment allowed)
  const isFrozenStatus = ['rejected', 'cancelledByBuyer', 'cancelledBySeller', 'cancelledByAdmin', 'outdated'].includes(appointment.status);
  const isAdminMarked = Boolean(paymentStatus?.metadata?.adminMarked);
  const isPending = !isAdminMarked && (!paymentStatus || paymentStatus.status !== 'completed') && !isFrozenStatus;

  // Check if there's a pending, approved, or rejected refund request
  const hasRefundRequest = refundRequestStatus && ['pending', 'rejected', 'approved', 'processed'].includes(refundRequestStatus.status);
  const isRefundRequestRejected = refundRequestStatus && refundRequestStatus.status === 'rejected';
  const isRefundRequestPending = refundRequestStatus && refundRequestStatus.status === 'pending';
  const isRefundRequestApproved = refundRequestStatus && ['approved', 'processed'].includes(refundRequestStatus.status);
  const isCaseReopened = refundRequestStatus && refundRequestStatus.caseReopened;


  return (
    <div className="flex flex-col items-center gap-2">
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${displayStatus.color}`}>
        {displayStatus.text}
      </span>

      {/* Only show payment amount and Pay Now button for buyers */}
      {isBuyer && (
        <>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            {/* Show info icon only when not paid and not admin-marked */}
            {(!paymentStatus || (paymentStatus.status !== 'completed' && !isAdminMarked)) && (appointment.status === 'pending' || appointment.status === 'accepted') && (
              <div className="relative group">
                <FaInfoCircle
                  className="text-blue-500 hover:text-blue-700 cursor-pointer"
                  title="Pay the advance amount to confirm your booking and unlock full chat features."
                />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                  Pay the advance amount to confirm your booking and unlock full chat features.
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                </div>
              </div>
            )}

            {/* Show info icon for paid appointments */}
            {((paymentStatus && paymentStatus.status === 'completed') || isAdminMarked) && !isFrozenStatus ? (
              <div className="relative group">
                <FaInfoCircle
                  className="text-green-500 hover:text-green-700 cursor-pointer"
                  title="You have unlocked full features of chat. Enjoy seamlessly!"
                />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-green-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                  You have unlocked full features of chat. Enjoy seamlessly!
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-green-800"></div>
                </div>
              </div>
            ) : null}
          </div>
          {/* Info icon for processing refund request */}
          {hasRefundRequest && isRefundRequestPending && (
            <div className="relative group mb-1">
              <FaInfoCircle
                className="text-orange-500 hover:text-orange-700 cursor-pointer text-xs"
                title="Processing Refund Request..."
              />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-orange-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                Processing Refund Request...
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-orange-800"></div>
              </div>
            </div>
          )}
          {isPending ? (
            <button
              className="mt-1 inline-flex items-center gap-1 text-white bg-blue-600 hover:bg-blue-700 text-xs font-semibold px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handlePayNowClick}
              disabled={paying}
            >
              {paying ? (
                <>
                  <UrbanSetuSpinner size="sm" isBright={true} /> <span className="ml-1">Loading...</span>
                </>
              ) : (
                <>
                  <FaCreditCard /> Pay Now
                </>
              )}
            </button>
          ) : paymentStatus && paymentStatus.status === 'failed' && !isFrozenStatus ? (
            <button
              onClick={handlePayNowClick}
              className="mt-1 inline-flex items-center gap-1 text-white bg-red-600 hover:bg-red-700 text-xs font-semibold px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={paying}
            >
              {paying ? (
                <>
                  <UrbanSetuSpinner size="sm" isBright={true} /> <span className="ml-1">Loading...</span>
                </>
              ) : (
                <>
                  <FaCreditCard /> Retry Payment
                </>
              )}
            </button>
          ) : paymentStatus && paymentStatus.status === 'completed' &&
            ['rejected', 'cancelledBySeller', 'cancelledByAdmin'].includes(appointment.status) &&
            (!paymentStatus.refundAmount || paymentStatus.refundAmount === 0) ? (
            <>
              {!isRefundRequestApproved && !isRefundRequestPending && (
                <>
                  {isRefundRequestRejected && refundRequestStatus.isAppealed ? (
                    <div className="relative group mb-1">
                      <FaInfoCircle
                        className="text-blue-500 hover:text-blue-700 cursor-pointer text-xs"
                        title="Appeal submitted please wait for response..."
                      />
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-blue-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        Appeal submitted please wait for response...
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-blue-800"></div>
                      </div>
                    </div>
                  ) : isRefundRequestRejected && !isCaseReopened ? (
                    <>
                      {/* Combined info icon for refund request rejected and appeal guidance */}
                      <div className="relative group mb-1">
                        <FaInfoCircle
                          className="text-purple-500 hover:text-purple-700 cursor-pointer text-xs"
                          title="Refund Request Rejected - You can appeal your refund with valid proofs and reason"
                        />
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-purple-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                          <div className="font-semibold text-red-300">Refund Request Rejected</div>
                          <div className="text-purple-200">You can appeal your refund with valid proofs and reason</div>
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-purple-800"></div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowAppealModal(true)}
                        className="mt-1 inline-flex items-center gap-1 text-white bg-purple-600 hover:bg-purple-700 text-xs font-semibold px-3 py-1 rounded"
                      >
                        <FaUndo /> Appeal
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Info icon for refund request */}
                      <div className="relative group mb-1">
                        <FaInfoCircle
                          className="text-orange-500 hover:text-orange-700 cursor-pointer text-xs"
                          title="You can raise a refund request now"
                        />
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-orange-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                          You can raise a refund request now
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-orange-800"></div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowRefundRequestModal(true)}
                        className="mt-1 inline-flex items-center gap-1 text-white bg-orange-600 hover:bg-orange-700 text-xs font-semibold px-3 py-1 rounded"
                      >
                        <FaUndo /> {isCaseReopened ? 'Request Refund' : 'Request Refund'}
                      </button>
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            paymentStatus && paymentStatus.receiptUrl ? (
              <>
                {/* Info icon for refunded status */}
                {(paymentStatus.status === 'refunded' || paymentStatus.status === 'partially_refunded') && (
                  <div className="relative group mb-1">
                    <FaInfoCircle
                      className="text-red-500 hover:text-red-700 cursor-pointer text-xs"
                      title="Refund processed successfully"
                    />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-red-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      <div>Refunded: {paymentStatus.currency === 'INR' ? '₹' : '$'}{paymentStatus.refundAmount.toLocaleString()}</div>
                      {paymentStatus.refundedAt && (
                        <div className="text-red-200">
                          {new Date(paymentStatus.refundedAt).toLocaleDateString('en-GB')} {new Date(paymentStatus.refundedAt).toLocaleTimeString('en-GB')}
                        </div>
                      )}
                      <div className="text-green-300">Refund Request Approved</div>
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-red-800"></div>
                    </div>
                  </div>
                )}
                <a
                  href={paymentStatus.receiptUrl.replace(/^https?:\/\/[^\/]+/, import.meta.env.VITE_API_BASE_URL)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-white bg-green-600 hover:bg-green-700 text-xs font-semibold px-3 py-1 rounded"
                >
                  <FaDownload /> Receipt
                </a>
              </>
            ) : null
          )}
        </>
      )}

      {isAdminMarked && (
        <div className="text-[10px] text-green-700 font-semibold">✓ Admin Confirmed</div>
      )}

      {showPayModal && isBuyer && (
        <PaymentModal
          isOpen={showPayModal}
          onClose={() => {
            setShowPayModal(false);
            setPaying(false); // Clear loading state when modal closes
          }}
          appointment={{
            ...appointment,
            region: appointment.region || 'india' // Use actual region or default to 'india'
          }}
          onPaymentSuccess={async (payment) => {
            setShowPayModal(false);
            setPaying(false); // Clear loading state when payment succeeds
            // Optimistically update payment status immediately
            if (payment && (payment.status === 'completed' || payment.metadata?.adminMarked)) {
              setPaymentStatus(payment);
              setLoading(false);
            }
            // Update appointment paymentConfirmed flag immediately
            if (appointment.paymentConfirmed !== true) {
              window.dispatchEvent(new CustomEvent('paymentStatusUpdated', {
                detail: {
                  appointmentId: appointment._id,
                  paymentConfirmed: true
                }
              }));
            }
            // Don't refetch immediately - let the socket event handler handle it after a delay
            // This prevents race conditions where cancelled payments might overwrite completed status
          }}
        />
      )}

      {/* Refund Request Modal */}
      {showRefundRequestModal && paymentStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <FaUndo className="text-orange-600" />
                  Request Refund
                </h3>
                <button
                  onClick={() => setShowRefundRequestModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <FaTimes className="text-xl" />
                </button>
              </div>
            </div>

            <form onSubmit={handleRefundRequest} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Details
                </label>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Property:</span>
                    <span className="font-medium dark:text-gray-200">{appointment.propertyName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                    <span className="font-medium dark:text-gray-200">
                      {paymentStatus.currency === 'INR' ? '₹' : '$'}{paymentStatus.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Payment ID:</span>
                    <span className="font-mono text-sm dark:text-gray-200">{paymentStatus.paymentId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Appointment Status:</span>
                    <span className="font-medium capitalize dark:text-gray-200">{appointment.status.replace(/([A-Z])/g, ' $1').trim()}</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Refund Type
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="type"
                      value="full"
                      checked={refundRequestForm.type === 'full'}
                      onChange={(e) => {
                        setRefundRequestForm(prev => ({
                          ...prev,
                          type: e.target.value,
                          amount: e.target.value === 'full' ? paymentStatus.amount : prev.amount
                        }));
                      }}
                      className="mr-2"
                    />
                    <span className="dark:text-gray-200">Full Refund ({paymentStatus.currency === 'INR' ? '₹' : '$'}{paymentStatus.amount.toLocaleString()})</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="type"
                      value="partial"
                      checked={refundRequestForm.type === 'partial'}
                      onChange={(e) => setRefundRequestForm(prev => ({ ...prev, type: e.target.value }))}
                      className="mr-2"
                    />
                    <span className="dark:text-gray-200">Partial Refund</span>
                  </label>
                </div>
              </div>

              {refundRequestForm.type === 'partial' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Refund Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-semibold">
                      {paymentStatus.currency === 'INR' ? '₹' : '$'}
                    </span>
                    <input
                      type="number"
                      value={refundRequestForm.amount}
                      onChange={(e) => setRefundRequestForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                      max={paymentStatus.amount}
                      min="1"
                      step="0.01"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
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
                  value={refundRequestForm.reason}
                  onChange={(e) => setRefundRequestForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Please explain why you need a refund..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  rows="3"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRefundRequestModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRefundRequest}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submittingRefundRequest ? (
                    <>
                      <UrbanSetuSpinner size="sm" isBright={true} />
                      <span className="ml-2">Submitting...</span>
                    </>
                  ) : (
                    <>
                      <FaUndo />
                      Submit Request
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appeal Modal */}
      {showAppealModal && refundRequestStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <FaUndo className="text-purple-600" />
                  Submit Appeal
                </h3>
                <button
                  onClick={() => setShowAppealModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <FaTimes className="text-xl" />
                </button>
              </div>
            </div>

            <form onSubmit={handleAppealSubmit} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Refund Request Details
                </label>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Property:</span>
                    <span className="font-medium dark:text-gray-200">{appointment.propertyName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Original Reason:</span>
                    <span className="font-medium text-sm dark:text-gray-200">{refundRequestStatus.reason}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Requested Amount:</span>
                    <span className="font-medium dark:text-gray-200">
                      {paymentStatus.currency === 'INR' ? '₹' : '$'}{refundRequestStatus.requestedAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <span className="font-medium text-red-600 dark:text-red-400 capitalize">{refundRequestStatus.status}</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Appeal Reason
                </label>
                <select
                  value={appealForm.reason}
                  onChange={(e) => setAppealForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="" className="dark:bg-gray-700">Select a reason for your appeal</option>
                  <option value="Additional evidence" className="dark:bg-gray-700">Additional evidence provided</option>
                  <option value="Misunderstanding" className="dark:bg-gray-700">Misunderstanding of the situation</option>
                  <option value="New information" className="dark:bg-gray-700">New information has come to light</option>
                  <option value="Service quality" className="dark:bg-gray-700">Service quality issues</option>
                  <option value="Technical problems" className="dark:bg-gray-700">Technical problems encountered</option>
                  <option value="Other" className="dark:bg-gray-700">Other (please explain in detail)</option>
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Appeal Details
                </label>
                <textarea
                  value={appealForm.text}
                  onChange={(e) => setAppealForm(prev => ({ ...prev, text: e.target.value }))}
                  placeholder="Please provide detailed information about why you believe your refund request should be reconsidered..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows="4"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAppealModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAppeal}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submittingAppeal ? (
                    <>
                      <UrbanSetuSpinner size="sm" isBright={true} />
                      <span className="ml-2">Submitting...</span>
                    </>
                  ) : (
                    <>
                      <FaUndo />
                      Submit Appeal
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chat Settings Modal */}


      {/* <GeminiAIWrapper /> */}
      {/* Sale Confirmation Modals */}
      <ConnectedSaleModals />

      {/* Dispute Reporting Modal */}
      <ConnectedDisputeModal />

      {/* Global Contact Support */}
    </div>
  );
}