import React, { useEffect, useState, useRef, useCallback } from "react";
import { FaTrash, FaSearch, FaPen, FaCheck, FaTimes, FaUserShield, FaUser, FaEnvelope, FaPhone, FaArchive, FaUndo, FaCommentDots, FaCheckDouble, FaBan, FaPaperPlane, FaCalendar, FaLightbulb, FaCopy, FaEllipsisV, FaFlag, FaCircle, FaInfoCircle, FaSync, FaStar, FaRegStar, FaThumbtack, FaCalendarAlt, FaCheckSquare, FaDownload, FaDollarSign, FaCreditCard, FaSpinner, FaExclamationTriangle, FaMoneyBill } from "react-icons/fa";
import { FormattedTextWithLinks, FormattedTextWithLinksAndSearch, FormattedTextWithReadMore } from '../utils/linkFormatter.jsx';
import UserAvatar from '../components/UserAvatar';
import { focusWithoutKeyboard, focusWithKeyboard } from '../utils/mobileUtils';
import ImagePreview from '../components/ImagePreview';
import ChatMediaPreview from '../components/ChatMediaPreview';
import LinkPreview from '../components/LinkPreview';
import { EmojiButton } from '../components/EmojiPicker';
import CustomEmojiPicker from '../components/EmojiPicker';
import { useSoundEffects, SoundControl } from '../components/SoundEffects';
import { useSelector } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Appointment from "../components/Appointment";
import { toast, ToastContainer } from 'react-toastify';
import { socket } from "../utils/socket";
import { exportEnhancedChatToPDF } from '../utils/pdfExport';
import ExportChatModal from '../components/ExportChatModal';
import axios from 'axios';
import PaymentModal from '../components/PaymentModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function MyAppointments() {
  const { currentUser } = useSelector((state) => state.user);
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

  // Export chat modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportAppointment, setExportAppointment] = useState(null);
  const [exportComments, setExportComments] = useState([]);



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
        const { data } = await axios.get(`${API_BASE_URL}/api/bookings/my`, {
          withCredentials: true
        });
        
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
          const { data } = await axios.get(`${API_BASE_URL}/api/bookings/archived`, {
            withCredentials: true
          });
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
  }, [currentUser]);

  // Separate useEffect for pagination and filtering
  useEffect(() => {
    if (allAppointments.length === 0) return;
    
    // Apply filters
    let filteredAppts = allAppointments.filter((appt) => {
      if (currentUser._id === appt.buyerId?._id?.toString() && appt.visibleToBuyer === false) return false;
      if (currentUser._id === appt.sellerId?._id?.toString() && appt.visibleToSeller === false) return false;
      const isOutdated = new Date(appt.date) < new Date() || (new Date(appt.date).toDateString() === new Date().toDateString() && appt.time && appt.time < new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      if (statusFilter === 'outdated') {
        return isOutdated;
      }
      const matchesStatus = statusFilter === "all" ? true : appt.status === statusFilter;
      const matchesRole = roleFilter === "all" ? true : appt.role === roleFilter;
      const matchesSearch =
        appt.propertyName?.toLowerCase().includes(search.toLowerCase()) ||
        appt.buyerId?.email?.toLowerCase().includes(search.toLowerCase()) ||
        appt.sellerId?.email?.toLowerCase().includes(search.toLowerCase()) ||
        appt.buyerId?.username?.toLowerCase().includes(search.toLowerCase()) ||
        appt.sellerId?.username?.toLowerCase().includes(search.toLowerCase());
      const matchesDateRange = 
        (!startDate || new Date(appt.date) >= new Date(startDate)) &&
        (!endDate || new Date(appt.date) <= new Date(endDate));
      
      return matchesStatus && matchesRole && matchesSearch && matchesDateRange;
    });
    
    // Calculate pagination
    const itemsPerPage = 10;
    const totalPages = Math.ceil(filteredAppts.length / itemsPerPage);
    setTotalPages(totalPages);
    
    // Get current page items
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentPageAppts = filteredAppts.slice(startIndex, endIndex);
    
    console.log(`Page ${currentPage} of ${totalPages}, showing ${currentPageAppts.length} appointments`);
    setAppointments(currentPageAppts);
  }, [allAppointments, currentPage, search, statusFilter, roleFilter, startDate, endDate, currentUser]);

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
      setAppointments((prev) => prev.filter((appt) => appt._id !== e.detail));
    };
    window.addEventListener('removeAppointmentRow', removeHandler);
    return () => {
      window.removeEventListener('removeAppointmentRow', removeHandler);
    };
  }, [currentUser]);

  // Listen for notification clicks when already on MyAppointments page
  useEffect(() => {
    const handleNotificationClick = (e) => {
      const { appointmentId, preferUnread } = e.detail || {};
      if (appointmentId) {
        // Find the appointment and set the state directly
        const appointment = appointments.find(appt => appt._id === appointmentId);
        if (appointment) {
          setNotificationChatData(appointment);
          setShouldOpenChatFromNotification(true);
          setActiveChatAppointmentId(appointmentId);
          if (preferUnread) setPreferUnreadForAppointmentId(appointmentId);
        }
      }
    };
    
    window.addEventListener('openChatFromNotification', handleNotificationClick);
    return () => {
      window.removeEventListener('openChatFromNotification', handleNotificationClick);
    };
  }, [appointments]);

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
    setAppointments(prevAppointments => prevAppointments.map(appt => {
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
      setAppointments((prev) =>
        prev.map(appt =>
          appt._id === data.appointmentId ? { ...appt, ...data.updatedAppointment } : appt
        )
      );
    }
    
    function handlePaymentStatusUpdate(data) {
      setAppointments((prev) =>
        prev.map(appt =>
          appt._id === data.appointmentId ? { ...appt, paymentConfirmed: data.paymentConfirmed } : appt
        )
      );
    }
    
    socket.on('appointmentUpdate', handleAppointmentUpdate);
    socket.on('paymentStatusUpdated', handlePaymentStatusUpdate);
    
    return () => {
      socket.off('appointmentUpdate', handleAppointmentUpdate);
      socket.off('paymentStatusUpdated', handlePaymentStatusUpdate);
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
      setAppointments((prev) => [appt, ...prev]);
    }
    socket.on('appointmentCreated', handleAppointmentCreated);
    
    // Listen for profile updates to update user info in appointments
    const handleProfileUpdate = (profileData) => {
      setAppointments(prevAppointments => prevAppointments.map(appt => {
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
    // Emit userAppointmentsActive every 1 seconds
    const interval = setInterval(() => {
      socket.emit('userAppointmentsActive', { userId: currentUser._id });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Handle notification-triggered chat opening
  useEffect(() => {
    if (shouldOpenChatFromNotification && notificationChatData) {
      // The chat will be opened by the AppointmentRow component
      // which handles both locked and unlocked chats
    }
  }, [shouldOpenChatFromNotification, notificationChatData]);



  // Handle navigation state when coming from notification
  const location = useLocation();
  useEffect(() => {
    if (location.state?.fromNotification && location.state?.openChatForAppointment) {
      const appointmentId = location.state.openChatForAppointment;
      
      // Wait for appointments to be loaded before trying to open chat
      if (appointments.length > 0) {
        const appointment = appointments.find(appt => appt._id === appointmentId);
        if (appointment) {
          setNotificationChatData(appointment);
          setShouldOpenChatFromNotification(true);
          setActiveChatAppointmentId(appointmentId);
          // Clear the navigation state after setting the data
          navigate(location.pathname, { replace: true });
        }
      } else {
        // If appointments are not loaded yet, wait for them
        const checkAppointments = setInterval(() => {
          if (appointments.length > 0) {
            const appointment = appointments.find(appt => appt._id === appointmentId);
            if (appointment) {
              setNotificationChatData(appointment);
              setShouldOpenChatFromNotification(true);
              setActiveChatAppointmentId(appointmentId);
              // Clear the navigation state after setting the data
              navigate(location.pathname, { replace: true });
            }
            clearInterval(checkAppointments);
          }
        }, 100);
        
        // Cleanup interval after 5 seconds to prevent infinite waiting
        setTimeout(() => clearInterval(checkAppointments), 5000);
      }
    }
  }, [location.state, navigate, appointments, currentUser._id]);

  const handleStatusUpdate = async (id, status) => {
    setActionLoading(id + status);
    try {
      const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${id}/status`, 
        { status },
        { 
          withCredentials: true,
          headers: { "Content-Type": "application/json" }
        }
      );
      setAppointments((prev) =>
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
      const { data } = await axios.delete(`${API_BASE_URL}/api/bookings/${appointmentToHandle}`, { 
        withCredentials: true,
        headers: { "Content-Type": "application/json" },
        data: { reason: deleteReason }
      });
      setAppointments((prev) =>
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
      const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appointmentToHandle}/archive`, 
        {},
        { 
          withCredentials: true,
          headers: { "Content-Type": "application/json" }
        }
      );
      const archivedAppt = appointments.find(appt => appt._id === appointmentToHandle);
      if (archivedAppt) {
        setAppointments((prev) => prev.filter((appt) => appt._id !== appointmentToHandle));
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
      const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appointmentToHandle}/unarchive`, 
        {},
        { 
          withCredentials: true,
          headers: { "Content-Type": "application/json" }
        }
      );
      const unarchivedAppt = archivedAppointments.find(appt => appt._id === appointmentToHandle);
      if (unarchivedAppt) {
        setArchivedAppointments((prev) => prev.filter((appt) => appt._id !== appointmentToHandle));
        setAppointments((prev) => [{ ...unarchivedAppt, archivedAt: undefined }, ...prev]);
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

  function handleOpenReinitiate(appt) {
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
      const { data } = await axios.post(`${API_BASE_URL}/api/bookings/reinitiate`, 
        payload,
        { 
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      toast.success('Appointment reinitiated successfully!', {
        autoClose: 5000,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false
      });
      setShowReinitiateModal(false);
      setReinitiateData(null);
      navigate("/user/my-appointments");
      setAppointments((prev) => prev.map(appt => appt._id === data.appointment._id ? { ...appt, ...data.appointment } : appt));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reinitiate appointment.');
    }
  }
//next
  const handleCancelRefresh = (cancelledId, cancelledStatus) => {
    setAppointments((prev) => prev.map(appt => appt._id === cancelledId ? { ...appt, status: cancelledStatus } : appt));
  };

  // Add this function to fetch latest data on demand
  const handleManualRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/bookings/my`, { 
        withCredentials: true 
      });
      setAppointments(data);
      
      // Fetch archived appointments for all users
      if (currentUser) {
        const { data: archivedData } = await axios.get(`${API_BASE_URL}/api/bookings/archived`, { 
          withCredentials: true 
        });
        setArchivedAppointments(Array.isArray(archivedData) ? archivedData : []);
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading your appointments...</p>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 py-10 px-2 md:px-8">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6">
          <div className="text-center text-red-600 text-lg">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 py-10 px-2 md:px-8">
      {currentUser && (
        <div className="max-w-7xl mx-auto mb-4 flex justify-end">
          <Link to="/user/my-payments" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2 7a2 2 0 012-2h16a2 2 0 012 2v3H2V7z" /><path d="M2 12h20v5a2 2 0 01-2 2H4a2 2 0 01-2-2v-5zm4 3a1 1 0 100 2h6a1 1 0 100-2H6z" /></svg>
            Go to Payments
          </Link>
        </div>
      )}

      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
          <div>
            <h3 className="text-2xl md:text-3xl font-extrabold text-blue-700 drop-shadow">
              {showArchived ? `Archived Appointments (${filteredArchivedAppointments.length})` : `My Appointments (${appointments.length})`}
            </h3>
            {!showArchived && (
              <p className="text-sm text-gray-600 mt-1">
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
              className={`bg-gradient-to-r text-white px-2.5 py-1.5 rounded-md transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-1 sm:gap-2 text-xs sm:text-base flex-1 sm:flex-none sm:w-auto sm:px-4 sm:py-2 sm:rounded-md justify-center ${
                showArchived 
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
              <label className="font-semibold text-sm">Status:</label>
              <select
                className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200 text-sm"
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
              <label className="font-semibold text-sm">Role:</label>
              <select
                className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200 text-sm"
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
              <label className="font-semibold text-sm">From:</label>
              <input
                type="date"
                className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200 text-sm"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                max={endDate || undefined}
              />
              <label className="font-semibold text-sm">To:</label>
              <input
                type="date"
                className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200 text-sm"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                min={startDate || undefined}
              />
            </div>
            <div className="flex items-center gap-2">
              <FaSearch className="text-gray-500 hover:text-blue-500 transition-colors duration-200" />
              <input
                type="text"
                className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200 text-sm flex-1"
                placeholder="Search by property, message, or user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
        
        {/* Description text for archived appointments */}
        {showArchived && (
          <p className="text-center text-gray-600 mb-6">
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
                  <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
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
                  {filteredArchivedAppointments.map((appt) => (
                    <AppointmentRow
                      key={appt._id}
                      appt={appt}
                      currentUser={currentUser}
                      handleStatusUpdate={handleStatusUpdate}
                      handleAdminDelete={handleAdminDelete}
                      actionLoading={actionLoading}
                      onShowOtherParty={(party, appointment) => { setSelectedOtherParty(party); setSelectedAppointment(appointment); setShowOtherPartyModal(true); }}
                      onOpenReinitiate={() => handleOpenReinitiate(appt)}
                      handleArchiveAppointment={handleArchiveAppointment}
                      handleUnarchiveAppointment={handleUnarchiveAppointment}
                      isArchived={true}
                      onCancelRefresh={handleCancelRefresh}
                      copyMessageToClipboard={copyMessageToClipboard}
                      onExportChat={(appointment, comments) => {
                        setExportAppointment(appointment);
                        setExportComments(comments);
                        setShowExportModal(true);
                      }}
                    />
                  ))}
                </tbody>
              </table>
          </div>
          )
        ) : (
          appointments.length === 0 ? (
            <div className="text-center text-gray-500 text-lg">No appointments found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gradient-to-r from-blue-100 to-purple-100">
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
                {appointments.map((appt) => (
                  <AppointmentRow 
                    key={appt._id} 
                    appt={appt} 
                    currentUser={currentUser} 
                    handleStatusUpdate={handleStatusUpdate}
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
                      onExportChat={(appointment, comments) => {
                        setExportAppointment(appointment);
                        setExportComments(comments);
                        setShowExportModal(true);
                      }}
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
            <div className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  setCurrentPage(Math.max(1, currentPage - 1));
                  toast.info(`Navigated to page ${Math.max(1, currentPage - 1)}`);
                }}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
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
      {showOtherPartyModal && selectedOtherParty && selectedAppointment && (() => {
        // Determine if contact details should be shown based on appointment status
        const isUpcoming = new Date(selectedAppointment.date) > new Date() || (new Date(selectedAppointment.date).toDateString() === new Date().toDateString() && (!selectedAppointment.time || selectedAppointment.time > new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })));
        const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin');
        const canSeeContactInfo = (isAdmin || selectedAppointment.status === 'accepted') && isUpcoming && 
          selectedAppointment.status !== 'cancelledByBuyer' && selectedAppointment.status !== 'cancelledBySeller' && 
          selectedAppointment.status !== 'cancelledByAdmin' && selectedAppointment.status !== 'rejected' && 
          selectedAppointment.status !== 'deletedByAdmin';
        
        return (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4" style={{ overflow: 'hidden' }}>
                      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto relative animate-fadeIn">
              {/* Close button */}
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors z-10 shadow"
                onClick={() => setShowOtherPartyModal(false)}
                title="Close"
                aria-label="Close"
              >
                <FaTimes className="w-4 h-4" />
              </button>
              
              {/* Header with gradient background */}
            <div className="flex flex-col items-center justify-center bg-gradient-to-r from-blue-100 to-purple-100 rounded-t-2xl px-6 py-6 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <UserAvatar 
                    user={{ username: selectedOtherParty.username, avatar: selectedOtherParty.avatar }} 
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
                  <h2 className="text-xl font-bold text-blue-800 flex items-center gap-2">
                    {selectedOtherParty.username || 'User'}
                    {selectedOtherParty.role === 'admin' && (
                      <FaUserShield className="text-purple-600 text-base" title="Admin user" />
                    )}
                  </h2>
                  <p className="text-sm text-gray-600 capitalize font-medium bg-white px-3 py-1 rounded-full shadow-sm">
                    {(() => {
                      // Determine the opposite role based on current user's role in the appointment
                      const currentUserRole = selectedAppointment.buyerId?._id === currentUser._id || selectedAppointment.buyerId === currentUser._id ? 'buyer' : 'seller';
                      return currentUserRole === 'buyer' ? 'seller' : 'buyer';
                    })()}
                  </p>
                  {/* Status text below role */}
                  {!canSeeContactInfo ? (
                    <div className="mt-2">
                      <span className="text-gray-600 font-medium text-xs bg-gray-100 px-3 py-1 rounded-full">
                        Not available
                      </span>
                    </div>
                  ) : selectedOtherParty.isTyping ? (
                    <div className="mt-2">
                      <span className="text-yellow-600 font-medium text-xs bg-yellow-100 px-3 py-1 rounded-full">
                        Typing...
                      </span>
                    </div>
                  ) : selectedOtherParty.isOnline ? (
                    <div className="mt-2">
                      <span className="text-green-600 font-medium text-xs bg-green-100 px-3 py-1 rounded-full">
                        Online
                      </span>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <span className="text-gray-600 font-medium text-xs bg-gray-100 px-3 py-1 rounded-full">
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
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500">
                      <FaEnvelope className="text-blue-500 w-5 h-5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Email</p>
                        <p className="text-gray-800 font-medium">{selectedOtherParty.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border-l-4 border-green-500">
                      <FaPhone className="text-green-500 w-5 h-5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Phone</p>
                        <p className="text-gray-800 font-medium">{selectedOtherParty.mobileNumber || 'Not provided'}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                    <FaExclamationTriangle className="text-yellow-500 w-5 h-5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-yellow-700 uppercase tracking-wide font-semibold">Contact Information Restricted</p>
                      <p className="text-yellow-800 font-medium">Contact details are only available for accepted appointments</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border-l-4 border-purple-500">
                  <FaCalendar className="text-purple-500 w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Member Since</p>
                    <p className="text-gray-800 font-medium">
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
      })()}
      {/* Reinitiate Modal */}
      {showReinitiateModal && reinitiateData && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4 text-blue-700">Reinitiate Appointment</h3>
              <form onSubmit={handleReinitiateSubmit} className="space-y-4">
                <div>
                  <label className="block font-semibold mb-1">Date</label>
                  <input type="date" className="border rounded px-2 py-1 w-full" value={reinitiateData.date} onChange={e => setReinitiateData(d => ({ ...d, date: e.target.value }))} required />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Time</label>
                  <input type="time" className="border rounded px-2 py-1 w-full" value={reinitiateData.time} onChange={e => setReinitiateData(d => ({ ...d, time: e.target.value }))} required />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Message (optional)</label>
                  <textarea className="border rounded px-2 py-1 w-full" value={reinitiateData.message} onChange={e => setReinitiateData(d => ({ ...d, message: e.target.value }))} />
                </div>
                <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full">Submit</button>
                <button type="button" className="mt-2 w-full bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400" onClick={() => setShowReinitiateModal(false)}>Cancel</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Archive Appointment Confirmation Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaArchive className="text-blue-500" />
              Archive Appointment
            </h3>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to archive this appointment? It will be moved to the archived section.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowArchiveModal(false);
                  setAppointmentToHandle(null);
                }}
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors"
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
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaUndo className="text-green-500" />
              Unarchive Appointment
            </h3>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to unarchive this appointment? It will be moved back to the active appointments.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowUnarchiveModal(false);
                  setAppointmentToHandle(null);
                }}
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors"
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
      </div>

      {/* Export Chat Modal */}
      <ExportChatModal
        isOpen={showExportModal}
        onClose={() => {
          setShowExportModal(false);
          setExportAppointment(null);
          setExportComments([]);
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
        messageCount={exportComments.filter(msg => !msg.deleted && (msg.message?.trim() || msg.imageUrl)).length}
        imageCount={exportComments.filter(msg => msg.imageUrl && !msg.deleted).length}
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
function AppointmentRow({ appt, currentUser, handleStatusUpdate, handleAdminDelete, actionLoading, onShowOtherParty, onOpenReinitiate, handleArchiveAppointment, handleUnarchiveAppointment, isArchived, onCancelRefresh, copyMessageToClipboard, activeChatAppointmentId, shouldOpenChatFromNotification, onChatOpened, onExportChat, preferUnreadForAppointmentId, onConsumePreferUnread }) {
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
  const [allProperties, setAllProperties] = useState([]);
  const [propertiesLoaded, setPropertiesLoaded] = useState(false);

  // Persist draft per appointment when chat is open (placed after refs/state used)
  useEffect(() => {
    if (!showChatModal || !appt?._id || !currentUser?._id) return;
    const draftKey = `appt_draft_${appt._id}_${currentUser._id}`;
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft !== null && savedDraft !== undefined) {
      setComment(savedDraft);
      setTimeout(() => {
        try {
          if (inputRef.current) {
            const length = inputRef.current.value.length;
            inputRef.current.focus();
            inputRef.current.setSelectionRange(length, length);
            // Auto-resize textarea for drafted content
            autoResizeTextarea(inputRef.current);
          }
        } catch (_) {}
      }, 0);
    }
  }, [showChatModal, appt?._id]);

  // Lazy-load global property list when user starts typing a mention
  useEffect(() => {
    if (!showChatModal) return;
    const hasMentionTrigger = /@[^\s]*$/.test(comment || "");
    if (!hasMentionTrigger || propertiesLoaded) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/listing/get?limit=300`, { credentials: 'include' });
        const data = await res.json();
        const mapped = Array.isArray(data) ? data.map(l => ({ id: l._id, name: l.name || 'Property' })) : [];
        setAllProperties(mapped);
        setPropertiesLoaded(true);
      } catch (_) {
        // ignore failures; suggestions will fallback to appointments only
      }
    })();
  }, [comment, showChatModal, propertiesLoaded]);

  useEffect(() => {
    if (!showChatModal || !appt?._id || !currentUser?._id) return;
    const draftKey = `appt_draft_${appt._id}_${currentUser._id}`;
    localStorage.setItem(draftKey, comment);
  }, [comment, showChatModal, appt?._id, currentUser?._id]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [visibleActionsMessageId, setVisibleActionsMessageId] = useState(null);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [deleteForBoth, setDeleteForBoth] = useState(true);
  const [showClearChatModal, setShowClearChatModal] = useState(false);
  
  // Undo functionality for messages deleted for me
  const [recentlyDeletedMessage, setRecentlyDeletedMessage] = useState(null);
  const [undoTimer, setUndoTimer] = useState(null);
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
  const [showRemoveLockPassword, setShowRemoveLockPassword] = useState(false);
  const [lockingChat, setLockingChat] = useState(false);
  const [unlockingChat, setUnlockingChat] = useState(false);
  const [removingLock, setRemovingLock] = useState(false);
  const [forgotPasswordProcessing, setForgotPasswordProcessing] = useState(false);
  
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
      // Check if chat is locked/encrypted
      const isChatLocked = appt.buyerChatLocked || appt.sellerChatLocked;
      const currentUserId = currentUser._id;
      const isBuyer = appt.buyerId?._id === currentUserId || appt.buyerId === currentUserId;
      const isSeller = appt.sellerId?._id === currentUserId || appt.sellerId === currentUserId;
      
      if (isChatLocked) {
        if (isBuyer && appt.buyerChatLocked) {
          setShowChatUnlockModal(true);
        } else if (isSeller && appt.sellerChatLocked) {
          setShowChatUnlockModal(true);
        }
      } else {
        // Open chat directly if not locked
        setShowChatModal(true);
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
      }
    }
  }, [shouldOpenChatFromNotification, activeChatAppointmentId, appt._id, appt.buyerChatLocked, appt.sellerChatLocked, appt.buyerId, appt.sellerId, currentUser._id, onChatOpened, preferUnreadForAppointmentId, onConsumePreferUnread]);
  
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
  
  // Message info modal state
  const [showMessageInfoModal, setShowMessageInfoModal] = useState(false);
  const [selectedMessageForInfo, setSelectedMessageForInfo] = useState(null);
  const [sendIconAnimating, setSendIconAnimating] = useState(false);
  const [sendIconSent, setSendIconSent] = useState(false);
  
  // Starred messages states
  const [showStarredModal, setShowStarredModal] = useState(false);
  const [starredMessages, setStarredMessages] = useState([]);
  const [starringSaving, setStarringSaving] = useState(false);
  const [loadingStarredMessages, setLoadingStarredMessages] = useState(false);
  const [unstarringMessageId, setUnstarringMessageId] = useState(null);
  const [removingAllStarred, setRemovingAllStarred] = useState(false);
  
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
  // Unified chat media preview (images + videos)
  const [showChatMediaPreview, setShowChatMediaPreview] = useState(false);
  const [chatMediaItems, setChatMediaItems] = useState([]); // [{type:'image'|'video', url:string}]
  const [chatMediaStartIndex, setChatMediaStartIndex] = useState(0);
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
  const [isDragOver, setIsDragOver] = useState(false);
  const videoInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const attachmentButtonRef = useRef(null);
  const attachmentPanelRef = useRef(null);
  const videoCaptionRef = useRef(null);
  const documentCaptionRef = useRef(null);
  // Attachment panel and new media states
  const [showAttachmentPanel, setShowAttachmentPanel] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showVideoPreviewModal, setShowVideoPreviewModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showDocumentPreviewModal, setShowDocumentPreviewModal] = useState(false);
  const [videoCaption, setVideoCaption] = useState('');
  const [documentCaption, setDocumentCaption] = useState('');
  const [videoObjectURL, setVideoObjectURL] = useState(null);

  // Sound effects
  const { playMessageSent, playMessageReceived, playNotification, toggleMute, setVolume, isMuted } = useSoundEffects();

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
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        errors.push(`File ${index + 1}: File size must be less than 5MB`);
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
      const { data } = await axios.post(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, 
        { 
          message: caption || '',
          imageUrl: imageUrl,
          type: "image"
        },
        { 
          withCredentials: true,
          headers: { "Content-Type": "application/json" }
        }
      );
        // Find the new comment from the response
        const newComment = data.comments[data.comments.length - 1];
        
        // Replace the temp message with the real one
        setComments(prev => prev.map(msg => 
          msg._id === tempId 
            ? { ...newComment }
            : msg
        ));
    } catch (error) {
      console.error('Send image error:', error);
      setComments(prev => prev.filter(msg => msg._id !== tempId));
      toast.error(error.response?.data?.message || "Failed to send image.");
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
        const response = await fetch(imageUrl, {
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
      const { data } = await axios.post(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, {
        message: caption || '',
        videoUrl,
        type: 'video'
      }, { withCredentials: true });
      setComments(data.comments || data.updated?.comments || data?.appointment?.comments || []);
    } catch (err) {
      toast.error('Failed to send video');
      setComments(prev => prev.filter(m => m._id !== tempId));
    }
  };

  const handleSendSelectedVideo = async () => {
    if (!selectedVideo) return;
    try {
      setUploadingFile(true);
      const form = new FormData();
      form.append('video', selectedVideo);
      const { data } = await axios.post(`${API_BASE_URL}/api/upload/video`, form, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          const pct = Math.round((evt.loaded * 100) / Math.max(1, evt.total || selectedVideo.size));
          setUploadProgress(pct);
        }
      });
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
      const { data } = await axios.post(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, {
        message: caption || '',
        documentUrl,
        documentName: file.name,
        documentMimeType: file.type || null,
        type: 'document'
      }, { withCredentials: true });
      setComments(data.comments || data.updated?.comments || data?.appointment?.comments || []);
    } catch (err) {
      toast.error('Failed to send document');
      setComments(prev => prev.filter(m => m._id !== tempId));
    }
  };

  const handleSendSelectedDocument = async () => {
    if (!selectedDocument) return;
    try {
      setUploadingFile(true);
      const form = new FormData();
      form.append('document', selectedDocument);
      const { data } = await axios.post(`${API_BASE_URL}/api/upload/document`, form, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          const pct = Math.round((evt.loaded * 100) / Math.max(1, evt.total || selectedDocument.size));
          setUploadProgress(pct);
        }
      });
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
          const { data } = await axios.post(`${API_BASE_URL}/api/upload/image`, 
            uploadFormData,
            { 
              withCredentials: true,
              headers: { 'Content-Type': 'multipart/form-data' },
              signal: controller.signal,
              onUploadProgress: (evt) => {
                if (evt.total) {
                  const perFile = Math.round((evt.loaded * 100) / evt.total);
                  setCurrentFileProgress(perFile);
                  const overall = Math.round(((i + perFile / 100) / selectedFiles.length) * 100);
                  setUploadProgress(overall);
                }
              }
            }
          );

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
      try { currentUploadControllerRef.current.abort(); } catch (_) {}
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
      const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/lock`, 
        { password: lockPassword },
        { 
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );
        setChatLocked(true);
        setChatAccessGranted(false);
        setShowChatLockModal(false);
        setLockPassword('');
        setLockConfirmPassword('');
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
      const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/unlock`, 
        { password: unlockPassword },
        { 
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );
        setChatAccessGranted(true);
        setShowChatUnlockModal(false);
        setUnlockPassword('');
        toast.success('Chat access granted.');
        
        // Open chat modal after successful unlock
        setShowChatModal(true);
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
      const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/remove-lock`, 
        { password: unlockPassword },
        { 
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );
        setChatLocked(false);
        setChatAccessGranted(false);
        setShowChatUnlockModal(false);
        setUnlockPassword('');
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
      const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/remove-lock`, 
        { password: removeLockPassword },
        { 
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );
        setChatLocked(false);
        setChatAccessGranted(false);
        setShowRemoveLockModal(false);
        setRemoveLockPassword('');
        setShowRemoveLockPassword(false);
        toast.success('Chat lock removed.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Incorrect password');
    } finally {
      setRemovingLock(false);
    }
  };

  const handleForgotPassword = async () => {
    setForgotPasswordProcessing(true);
    try {
      const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/forgot-password`, 
        {},
        { 
          withCredentials: true
        }
      );
        setChatLocked(false);
        setChatAccessGranted(false);
        setShowForgotPasswordModal(false);
        setComments([]); // Clear chat messages locally
        toast.success('Chat lock removed and cleared successfully.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset chat');
    } finally {
      setForgotPasswordProcessing(false);
    }
  };

  // Reset chat access when chat modal is closed
  const handleChatModalClose = async () => {
    setShowChatModal(false);
    
    // Dispatch event to notify App.jsx that chat is closed
    window.dispatchEvent(new CustomEvent('chatClosed'));
    
    // Reset chat access if it was temporarily granted
    if (chatLocked && chatAccessGranted) {
      try {
        await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/reset-access`, 
          {},
          { 
            withCredentials: true
          }
        );
        setChatAccessGranted(false);
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
        const { data } = await axios.get(`${API_BASE_URL}/api/bookings/${appt._id}/chat/lock-status`, {
          withCredentials: true
        });
        setChatLocked(data.chatLocked);
        setChatAccessGranted(data.accessGranted);
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

  // Fetch pinned messages when comments are loaded
  useEffect(() => {
    if (appt?._id && comments.length > 0) {
      fetchPinnedMessages();
    }
  }, [appt._id, comments.length]);

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
      const { data } = await axios.get(`${API_BASE_URL}/api/bookings/${appt._id}/starred-messages`, {
        withCredentials: true
      });
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
          
          const response = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${message._id}/star`, 
            { starred: false },
            {
              withCredentials: true,
              headers: { 'Content-Type': 'application/json' }
            }
          );
          
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

  // Increase visible messages when scrolled to top
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const onScrollTopLoadMore = () => {
      if (container.scrollTop <= 0 && comments.length > visibleCount) {
        const prevHeight = container.scrollHeight;
        setVisibleCount(prev => Math.min(prev + MESSAGES_PAGE_SIZE, comments.length));
        // Maintain scroll position after increasing items
        setTimeout(() => {
          const newHeight = container.scrollHeight;
          container.scrollTop = newHeight - prevHeight;
        }, 0);
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
          } catch (_) {}
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
  const handleUndoDelete = () => {
    if (recentlyDeletedMessage) {
      // Remove from locally removed IDs
      const ids = getLocallyRemovedIds(appt._id);
      const updatedIds = ids.filter(id => id !== recentlyDeletedMessage._id);
      localStorage.setItem(`removedDeletedMsgs_${appt._id}`, JSON.stringify(updatedIds));
      
      // Find the correct position to insert the message back
      setComments(prev => {
        const newComments = [...prev];
        // Find where this message should be inserted based on timestamp
        const insertIndex = newComments.findIndex(msg => 
          new Date(msg.timestamp) > new Date(recentlyDeletedMessage.timestamp)
        );
        
        if (insertIndex === -1) {
          // If no message is newer, add to the end
          newComments.push(recentlyDeletedMessage);
        } else {
          // Insert at the correct position
          newComments.splice(insertIndex, 0, recentlyDeletedMessage);
        }
        
        return newComments;
      });
      
      // Clear the undo state
      setRecentlyDeletedMessage(null);
      if (undoTimer) {
        clearTimeout(undoTimer);
        setUndoTimer(null);
      }
      
      toast.success('Message restored!');
    }
  };
  
  const startUndoTimer = (message) => {
    // Clear any existing timer
    if (undoTimer) {
      clearTimeout(undoTimer);
    }
    
    // Set the recently deleted message
    setRecentlyDeletedMessage(message);
    
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
      const { data } = await axios.get(`${API_BASE_URL}/api/bookings/${appt._id}`, {
        withCredentials: true
      });
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
      const { data } = await axios.get(`${API_BASE_URL}/api/bookings/${appt._id}/pinned-messages`, {
        withCredentials: true
      });
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
      const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${message._id}/pin`, 
        { 
          pinned, 
          pinDuration: duration, 
          customHours: duration === 'custom' ? customHrs : undefined 
        },
        { 
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );
        
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
  
  // Chat availability: keep chat open for all but block sending for certain statuses
  const isChatSendBlocked = !isUpcoming || appt.status === 'rejected' || appt.status === 'cancelledByAdmin' || appt.status === 'cancelledByBuyer' || appt.status === 'cancelledBySeller' || appt.status === 'deletedByAdmin';
  
  // Status indicators: hide for pending and frozen appointments
  const isStatusHidden = appt.status === 'pending' || appt.status === 'rejected' || appt.status === 'cancelledByAdmin' || appt.status === 'cancelledByBuyer' || appt.status === 'cancelledBySeller' || appt.status === 'deletedByAdmin';
  
  const canSeeContactInfo = (isAdmin || appt.status === 'accepted') && isUpcoming && 
    appt.status !== 'cancelledByBuyer' && appt.status !== 'cancelledBySeller' && 
    appt.status !== 'cancelledByAdmin' && appt.status !== 'rejected' && 
    appt.status !== 'deletedByAdmin';
  const otherParty = isSeller ? appt.buyerId : appt.sellerId;

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
      // Multi-select branch
      if (Array.isArray(messageToDelete)) {
        const ids = messageToDelete.map(m => m._id);
        if (deleteForBoth) {
          try {
            const { data } = await axios.delete(`${API_BASE_URL}/api/bookings/${appt._id}/comments/bulk-delete`, {
              withCredentials: true,
              headers: { 'Content-Type': 'application/json' },
              data: { commentIds: ids }
            });
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
          } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete selected messages.');
            return;
          }
        } else {
          try {
            await axios.post(`${API_BASE_URL}/api/bookings/${appt._id}/comments/removed/sync`, 
              { removedIds: ids },
              {
                withCredentials: true,
                headers: { 'Content-Type': 'application/json' }
              }
            );
            setComments(prev => prev.filter(msg => !ids.includes(msg._id)));
            ids.forEach(cid => addLocallyRemovedId(appt._id, cid));
            
            // Start undo timer for the first message (for bulk deletes, we'll show undo for the first one)
            if (messageToDelete.length > 0) {
              startUndoTimer(messageToDelete[0]);
            }
            
            toast.success(`Deleted ${ids.length} messages for you!`);
          } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete selected messages for you.');
            return;
          }
        }
      } else if (deleteForBoth) {
        // Single delete for everyone
        const wasUnread = !messageToDelete.readBy?.includes(currentUser._id) && 
                         messageToDelete.senderEmail !== currentUser.email;
        const { data } = await axios.delete(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${messageToDelete._id}`, {
          withCredentials: true
        });
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
          await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${messageToDelete._id}/remove-for-me`, 
            {},
            { 
              withCredentials: true
            }
          );
        } catch {}
        setComments(prev => prev.filter(msg => msg._id !== messageToDelete._id));
        addLocallyRemovedId(appt._id, messageToDelete._id);
        
        // Start undo timer for messages deleted for me
        startUndoTimer(messageToDelete);
        
        toast.success('Message deleted for you!');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'An error occurred. Please try again.');
    }
    
    // Close modal and reset state
    setShowDeleteModal(false);
    setMessageToDelete(null);
    setDeleteForBoth(true);
  };

  const handleClearChat = async () => {
    try {
      // Optimistically update local storage and UI
      const now = Date.now();
      localStorage.setItem(clearTimeKey, now);
      setComments([]);

      // Persist to server so it applies across devices for this user
      await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/clear-local`, 
        {},
        { 
          withCredentials: true
        }
      );

      toast.success("Chat Cleared.");
    } catch (err) {
      console.error('Failed to persist chat clear:', err);
      toast.error(err.response?.data?.message || 'Cleared locally, but failed to sync with server.');
    } finally {
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
      ...(replyToData ? { replyTo: replyToData._id } : {}),
    };

    // Immediately update UI - this makes the message appear instantly
    setComments(prev => [...prev, tempMessage]);
    setComment("");
    try {
      const draftKey = `appt_draft_${appt._id}_${currentUser._id}`;
      localStorage.removeItem(draftKey);
    } catch (_) {}
    setDetectedUrl(null);
    setPreviewDismissed(false);
    setReplyTo(null);
    // Reset textarea height to normal after sending
    resetTextareaHeight();
    // Remove the global sending state to allow multiple messages
    // setSending(true);

    // Aggressively refocus the input field to keep keyboard open on mobile
    const refocusInput = () => {
      if (inputRef.current) {
        inputRef.current.focus();
        // For mobile devices, ensure the input remains active and set cursor position
        inputRef.current.setSelectionRange(0, 0);
        // Force the input to be the active element
        if (document.activeElement !== inputRef.current) {
          inputRef.current.click();
          inputRef.current.focus();
        }
      }
    };
    
    // Multiple attempts to maintain focus for mobile devices
    refocusInput(); // Immediate focus
    requestAnimationFrame(refocusInput); // Focus after DOM updates
    setTimeout(refocusInput, 10); // Final fallback

    // Scroll to bottom immediately after adding the message
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }

    // Send message in background without blocking UI
    (async () => {
      try {
        const { data } = await axios.post(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, 
          { 
            message: messageContent, 
            ...(replyToData ? { replyTo: replyToData._id } : {}) 
          },
          {
            withCredentials: true,
            headers: { "Content-Type": "application/json" }
          }
        );
        
        // Find the new comment from the response
        const newComment = data.comments[data.comments.length - 1];
        
        // Update only the status and ID of the temp message, keeping it visible
        setComments(prev => prev.map(msg => 
          msg._id === tempId 
            ? { 
                ...msg, 
                _id: newComment._id,
                status: newComment.status,
                readBy: newComment.readBy || msg.readBy,
                timestamp: newComment.timestamp || msg.timestamp
              }
            : msg
        ));
        
        // Don't show success toast as it's too verbose for chat
        playMessageSent(); // Play send sound
      } catch (err) {
        // Remove the temp message and show error
        setComments(prev => prev.filter(msg => msg._id !== tempId));
        toast.error(err.response?.data?.message || 'An error occurred. Please try again.');
        // Refocus input on error - aggressive mobile focus
        const refocusInput = () => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(0, 0);
            if (document.activeElement !== inputRef.current) {
              inputRef.current.click();
              inputRef.current.focus();
            }
          }
        };
        refocusInput();
        requestAnimationFrame(refocusInput);
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
      const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${commentId}`, 
        { message: editText },
        { 
          withCredentials: true,
          headers: { "Content-Type": "application/json" }
        }
      );
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
        // Auto-resize textarea for restored draft
        setTimeout(() => {
          if (inputRef.current) {
            // Force a re-render by triggering the input event
            const event = new Event('input', { bubbles: true });
            inputRef.current.dispatchEvent(event);
            autoResizeTextarea(inputRef.current);
          }
        }, 50);
        
        // Aggressively refocus the input field to keep keyboard open on mobile
        const refocusInput = () => {
          if (inputRef.current) {
            inputRef.current.focus();
            // Place cursor at end of text instead of selecting all
            const length = inputRef.current.value.length;
            inputRef.current.setSelectionRange(length, length);
            
            // Auto-resize textarea for edited content
            inputRef.current.style.height = '48px';
            const scrollHeight = inputRef.current.scrollHeight;
            const maxHeight = 144;
            inputRef.current.style.height = Math.min(scrollHeight, maxHeight) + 'px';
          }
        };
        
        // Multiple attempts to maintain focus for mobile devices
        refocusInput(); // Immediate focus
        requestAnimationFrame(refocusInput); // Focus after DOM updates
        setTimeout(refocusInput, 10); // Final fallback
        
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
    
    // Multiple attempts to maintain focus for mobile devices
    setTimeout(refocusInput, 50); // Initial focus
    setTimeout(refocusInput, 100); // Focus after DOM updates
    setTimeout(refocusInput, 200); // Final fallback
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

  const scrollToSearchResult = (commentId) => {
    const messageElement = messageRefs.current[commentId];
    if (messageElement) {
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
    }
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
      // Enhanced animation for scrolling to the message
      const messageElement = messageRefs.current[firstMessageOfDate._id];
      if (messageElement) {
        // Add a pre-animation class for better visual feedback
        messageElement.classList.add('date-jump-preparing');
        
        // Smooth scroll with enhanced timing
        messageElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
        
        // Enhanced highlight animation with multiple effects
        setTimeout(() => {
          messageElement.classList.remove('date-jump-preparing');
          setHighlightedDateMessage(firstMessageOfDate._id);
          messageElement.classList.add('date-highlight', 'date-jump-pulse');
          
          // Add a ripple effect
          const ripple = document.createElement('div');
          ripple.className = 'date-jump-ripple';
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
            messageElement.classList.remove('date-highlight', 'date-jump-pulse');
            setHighlightedDateMessage(null);
          }, 4000);
        }, 500);
      }
    } else {
      toast.info('No messages found for the selected date in visible chat', {
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
      const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/cancel`, 
        { reason: cancelReason },
        {
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );
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
      const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/cancel`, 
        { reason: cancelReason },
        { 
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );
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
      const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/soft-delete`, 
        { who },
        { 
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );
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
      const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${messageId}/react`, 
        { emoji },
        { 
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );

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
    } catch (_) {}
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
      } catch (_) {}
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

  // Mark messages as read when user can actually see them at the bottom of chat
  const markingReadRef = useRef(false);
  
  const markVisibleMessagesAsRead = useCallback(async () => {
    if (!chatContainerRef.current || markingReadRef.current || !appt?._id) return;
    
    // Only mark messages as read when user is at the bottom of chat AND has manually scrolled
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10; // 10px threshold
    
    if (!isAtBottom) return; // Don't mark as read if not at bottom
    
    const unreadMessages = comments.filter(c => 
      !c.readBy?.includes(currentUser._id) && 
      c.senderEmail !== currentUser.email
    );
    
    if (unreadMessages.length > 0) {
      markingReadRef.current = true; // Prevent concurrent requests
      try {
        // Mark messages as read in backend
        const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/read`, 
          {},
          { 
            withCredentials: true,
            headers: { 'Content-Type': 'application/json' }
          }
        );
          // Update local state immediately
          setComments(prev => 
            prev.map(c => 
              unreadMessages.some(unread => unread._id === c._id)
                ? { ...c, readBy: [...(c.readBy || []), currentUser._id], status: 'read' }
                : c
            )
          );
          
          // Emit socket event for real-time updates to sender (user1)
          unreadMessages.forEach(msg => {
            socket.emit('messageRead', {
              appointmentId: appt._id,
              messageId: msg._id,
              userId: currentUser._id,
              readBy: currentUser._id
            });
          });
          
          // Update unreadNewMessages to reflect the actual unread count
          setUnreadNewMessages(prev => Math.max(0, prev - unreadMessages.length));
      } catch (error) {
        // Only log error if it's not a 500 server error (which might be temporary)
        if (error.response?.status !== 500) {
          console.error('Error marking messages as read:', error);
        } else {
          console.warn('Server error marking messages as read (will retry later):', error.response?.status);
        }
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
      const atBottom = scrollHeight - scrollTop - clientHeight < 10; // 10px threshold
      setIsAtBottom(atBottom);
      
      // When user reaches bottom, mark unread messages as read ONLY if they manually scrolled
      if (atBottom) {
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
    if (chatEndRef.current) {
      // Manual scroll to bottom
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setUnreadNewMessages(0); // Clear unread count when manually scrolling to bottom
      // Mark visible messages as read after scrolling
      setTimeout(() => {
        markVisibleMessagesAsRead();
      }, 500); // Wait for scroll animation to complete
    }
  }, [markVisibleMessagesAsRead]);



  // Real-time comment updates via socket.io (for chat sync)
  useEffect(() => {
    function handleCommentUpdate(data) {
      if (data.appointmentId === appt._id) {
        setComments((prev) => {
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
                    // Only add if not present and not a temporary message
        const isTemporaryMessage = prev.some(msg => msg._id.toString().startsWith('temp-'));
        if (!isTemporaryMessage || data.comment.senderEmail !== currentUser.email) {
                      // If this is a new message from another user and chat is not open, increment unread count
            if (data.comment.senderEmail !== currentUser.email && !showChatModal && !data.comment.readBy?.includes(currentUser._id)) {
              setUnreadNewMessages(prev => prev + 1);
              // Do not play notification sound here; App.jsx handles global notifications
            } else {
              playMessageReceived(); // Play receive sound
            }
          return [...prev, data.comment];
        }
        return prev;
          }
        });
      }
    }

    // New: clear chat and remove-for-me events
    function handleChatClearedForUser({ appointmentId, clearedAt }) {
      if (appointmentId !== appt._id) return;
      try {
        const clearTimeKey = `chatClearTime_${appt._id}`;
        const localMs = Number(localStorage.getItem(clearTimeKey)) || 0;
        const serverMs = clearedAt ? new Date(clearedAt).getTime() : 0;
        const effective = Math.max(localMs, serverMs);
        localStorage.setItem(clearTimeKey, String(effective));
      } catch {}
      setComments([]);
      setUnreadNewMessages(0);
    }
    function handleCommentRemovedForUser({ appointmentId, commentId }) {
      if (appointmentId !== appt._id) return;
      setComments(prev => prev.filter(c => c._id !== commentId));
      // Also record locally to keep UI consistent
      addLocallyRemovedId(appt._id, commentId);
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
      // Mark comments as read immediately
      axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/read`, {}, {
        withCredentials: true
      }).catch(error => {
        // Only log error if it's not a 500 server error (which might be temporary)
        if (error.response?.status !== 500) {
          console.warn('Error marking comments as read on modal open:', error);
        } else {
          console.warn('Server error marking comments as read on modal open (will retry later):', error.response?.status);
        }
      });
    }
  }, [showChatModal, appt._id]);

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
          prev.map(c =>
            !c.readBy?.includes(data.userId)
              ? { ...c, status: "read", readBy: [...(c.readBy || []), data.userId], readAt: new Date() }
              : c
          )
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
  const filteredComments = comments.filter(c => new Date(c.timestamp).getTime() > clearTime && !locallyRemovedIds.includes(c._id) && !(c.removedFor?.includes?.(currentUser._id)));



  useEffect(() => {
    if (!showChatModal || !otherParty?._id) return;
    // Ask backend if the other party is online
    socket.emit('checkUserOnline', { userId: otherParty._id });
    // Listen for response
    function handleUserOnlineStatus(data) {
      if (data.userId === otherParty._id) {
        setIsOtherPartyOnline(!!data.online);
        setOtherPartyLastSeen(data.lastSeen || null);
      }
    }
    socket.on('userOnlineStatus', handleUserOnlineStatus);
    socket.on('userOnlineUpdate', handleUserOnlineStatus);
    return () => {
      socket.off('userOnlineStatus', handleUserOnlineStatus);
      socket.off('userOnlineUpdate', handleUserOnlineStatus);
    };
  }, [showChatModal, otherParty?._id]);

  // Check online status for table display (independent of chat modal)
  useEffect(() => {
    if (!otherParty?._id) return;
    
    // Ask backend if the other party is online for table display
    socket.emit('checkUserOnline', { userId: otherParty._id });
    
    // Listen for response
    function handleTableUserOnlineStatus(data) {
      if (data.userId === otherParty._id) {
        setIsOtherPartyOnlineInTable(!!data.online);
        setOtherPartyLastSeenInTable(data.lastSeen || null);
      }
    }
    
    socket.on('userOnlineStatus', handleTableUserOnlineStatus);
    socket.on('userOnlineUpdate', handleTableUserOnlineStatus);
    
    return () => {
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
    
    // Focus input when chat modal opens
    const focusInput = () => {
      if (inputRef.current) {
        // Use focusWithoutKeyboard to prevent keyboard from opening on mobile
        focusWithoutKeyboard(inputRef.current, inputRef.current.value.length);
      }
    };
    
    // Focus input after a short delay to ensure modal is fully rendered
    setTimeout(focusInput, 100);
    
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === 'f') {
        event.preventDefault(); // Prevent browser find dialog
        if (inputRef.current) {
          focusWithKeyboard(inputRef.current, inputRef.current.value.length);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setShowChatModal(false);
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
  const selectedMessageForHeaderOptions = headerOptionsMessageId ? comments.find(msg => msg._id === headerOptionsMessageId) : null;
  return (
    <>
      <tr className={`hover:bg-blue-50 transition align-top ${!isUpcoming ? 'bg-gray-100' : ''}`}>
        <td className="border p-2">
          <div>
            <div>{new Date(appt.date).toLocaleDateString('en-GB')}</div>
            <div className="text-sm text-gray-600">{appt.time}</div>
            {!isUpcoming && (
              <div className="text-xs text-red-600 font-medium mt-1">Outdated</div>
            )}
            {isArchived && appt.archivedAt && (
              <div className="text-xs text-gray-500 mt-1">
                Archived: {new Date(appt.archivedAt).toLocaleDateString('en-GB')}
              </div>
            )}
          </div>
        </td>
        <td className="border p-2">
          <div>
            {appt.listingId ? (
              <Link 
                to={isAdminContext ? `/admin/listing/${appt.listingId._id}` : `/user/listing/${appt.listingId._id}`}
                className="font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
              >
                {appt.propertyName}
              </Link>
            ) : (
              <div className="font-semibold">{appt.propertyName}</div>
            )}
          </div>
        </td>
        <td className="border p-2 text-center">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            isSeller ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
          }`}>
            {isSeller ? "Seller" : "Buyer"}
          </span>
        </td>
        <td className="border p-2">
          <div>
            {canSeeContactInfo ? (
              <button
                className="font-semibold text-blue-700 hover:underline text-left"
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
                <div className="text-sm text-gray-600">{otherParty?.email}</div>
                <div className="text-sm text-gray-600">{otherParty?.mobileNumber && otherParty?.mobileNumber !== '' ? otherParty.mobileNumber : 'No phone'}</div>
              </>
            ) : (
              <div className="text-sm text-gray-500 italic">
                {isAdmin ? "Contact info available" : "Contact info hidden until accepted"}
              </div>
            )}
          </div>
        </td>
        <td className="border p-2 capitalize">{appt.purpose}</td>
        <td className="border p-2 max-w-xs truncate">{appt.message || 'No message provided'}</td>
        <td className="border p-2 text-center">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(appt.status)}`}>
            {appt.status === "cancelledByBuyer"
              ? "Cancelled by Buyer"
              : appt.status === "cancelledBySeller"
              ? "Cancelled by Seller"
              : appt.status === "cancelledByAdmin"
              ? "Cancelled by Admin"
              : appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
          </span>
        </td>
        <td className="border p-2 text-center">
          <PaymentStatusCell appointment={appt} isBuyer={isBuyer} />
        </td>
        <td className="border p-2 text-center">
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
                      className="text-gray-400 hover:text-red-700 text-xl"
                      onClick={handlePermanentDelete}
                      title="Delete outdated appointment from table"
                      style={{ opacity: 0.7 }}
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
                        <FaTrash />
                      </button>
                    )}
                    {/* Seller faded delete after cancellation, rejection, admin deletion, or deletedByAdmin */}
                    {isSeller && (appt.status === 'cancelledBySeller' || appt.status === 'cancelledByBuyer' || appt.status === 'cancelledByAdmin' || appt.status === 'rejected' || appt.status === 'deletedByAdmin') && (
                      <button
                        className="text-gray-400 hover:text-red-700 text-xl"
                        onClick={handlePermanentDelete}
                        title="Remove from table"
                        style={{ opacity: 0.5 }}
                      >
                        <FaTrash className="group-hover:text-red-900 group-hover:scale-125 group-hover:animate-shake transition-all duration-200" />
                      </button>
                    )}
                    {/* Buyer cancel button: allow for both pending and accepted (approved) */}
                    {isBuyer && (appt.status === "pending" || appt.status === "accepted") && (
                      <button
                        className="text-red-500 hover:text-red-700 text-xl"
                        onClick={handleUserCancel}
                        title="Cancel Appointment (Buyer)"
                      >
                        <FaTrash />
                      </button>
                    )}
                    {/* Buyer faded delete after cancellation, seller cancellation, admin deletion, rejected, or deletedByAdmin */}
                    {isBuyer && (appt.status === 'cancelledByBuyer' || appt.status === 'cancelledBySeller' || appt.status === 'cancelledByAdmin' || appt.status === 'deletedByAdmin' || appt.status === 'rejected') && (
                      <button
                        className="text-gray-400 hover:text-red-700 text-xl"
                        onClick={handlePermanentDelete}
                        title="Remove from table"
                        style={{ opacity: 0.5 }}
                      >
                        <FaTrash className="group-hover:text-red-900 group-hover:scale-125 group-hover:animate-shake transition-all duration-200" />
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
                    {((appt.status === 'cancelledByBuyer' && isBuyer) || (appt.status === 'cancelledBySeller' && isSeller)) && (
                      <div className="flex flex-col items-center">
                        <button
                          className="text-blue-500 hover:text-blue-700 text-xs border border-blue-500 rounded px-2 py-1 mt-1"
                          onClick={() => onOpenReinitiate(appt)}
                          disabled={
                            (appt.status === 'cancelledByBuyer' && isBuyer && (appt.buyerReinitiationCount || 0) >= 2) ||
                            (appt.status === 'cancelledBySeller' && isSeller && (appt.sellerReinitiationCount || 0) >= 2) ||
                            !appt.buyerId || !appt.sellerId
                          }
                          title="Reinitiate or Reschedule Appointment"
                        >
                          Reinitiate
                        </button>
                        <span className="text-xs text-gray-500 mt-1">
                          {isBuyer && appt.status === 'cancelledByBuyer'
                            ? `${2 - (appt.buyerReinitiationCount || 0)} left`
                            : isSeller && appt.status === 'cancelledBySeller'
                            ? `${2 - (appt.sellerReinitiationCount || 0)} left`
                            : ''}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </td>
        <td className="border p-2 text-center relative">
          <button
            className={`flex items-center justify-center rounded-full p-3 shadow-lg mx-auto relative transform transition-all duration-200 group ${
              'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white hover:shadow-xl hover:scale-105'
            }`}
            title={"Open Chat"}
            onClick={() => {
              if ((chatLocked || chatLockStatusLoading) && !chatAccessGranted) {
                setShowChatUnlockModal(true);
              } else {
                setShowChatModal(true);
                // Dispatch event to notify App.jsx that chat is opened
                window.dispatchEvent(new CustomEvent('chatOpened', {
                  detail: { appointmentId: appt._id }
                }));
              }
            }}
          >
            <FaCommentDots size={22} className={"group-hover:animate-pulse"} />
            {
              <div className="absolute inset-0 bg-white rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
            }
            {/* Show lock icon if chat is locked or loading */}
            {(chatLocked || chatLockStatusLoading) && !chatAccessGranted && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold border-2 border-white">
                {chatLockStatusLoading ? '⏳' : '🔒'}
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
      {showChatModal && (
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
                className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-hidden quick-reactions-modal"
                onMouseDown={(e) => {
                  e.stopPropagation(); // Prevent any event bubbling
                }}
                onClick={(e) => {
                  e.stopPropagation(); // Prevent any event bubbling
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="text-lg font-semibold text-gray-800">Quick Reactions</div>
                  <button
                    onMouseDown={(e) => {
                      e.stopPropagation(); // Prevent event bubbling
                      e.preventDefault(); // Prevent default behavior
                    }}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent event bubbling
                      setShowReactionsEmojiPicker(false);
                    }}
                    className="text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
                    title="Close"
                  >
                    <FaTimes size={16} />
                  </button>
                </div>
                <div 
                  className="overflow-y-auto max-h-[60vh] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
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
                    {[
                      // Smileys & People
                      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
                      '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
                      '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
                      '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥',
                      '😶', '😐', '😑', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢',
                      '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '💀', '👻', '👽', '👾', '🤖', '😈', '👿', '👹', '👺',
                      
                      // Gestures & Body Parts
                      '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅',
                      '👄', '💋', '🩸', '🫂', '👶', '👧', '🧒', '👦', '👩', '🧑', '👨', '👵', '🧓', '👴', '👮‍♀️', '👮',
                      '👮‍♂️', '🕵️‍♀️', '🕵️', '🕵️‍♂️', '👷‍♀️', '👷', '👷‍♂️', '🫅', '🤴', '👸', '👳‍♀️', '👳', '👳‍♂️',
                      '👲', '🧕', '🤵‍♀️', '🤵', '🤵‍♂️', '👰‍♀️', '👰', '👰‍♂️', '🤰', '🤱', '👼', '🎅', '🤶', '🦸‍♀️', '🦸',
                      '🦸‍♂️', '🦹‍♀️', '🦹', '🦹‍♂️', '🧙‍♀️', '🧙', '🧙‍♂️', '🧚‍♀️', '🧚', '🧚‍♂️', '🧛‍♀️', '🧛', '🧛‍♂️',
                      '🧜‍♀️', '🧜', '🧜‍♂️', '🧝‍♀️', '🧝', '🧝‍♂️', '🧞‍♀️', '🧞', '🧞‍♂️', '🧟‍♀️', '🧟', '🧟‍♂️', '🧌',
                      
                      // Animals & Nature
                      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵',
                      '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴',
                      '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖',
                      '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆',
                      '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦙', '🦒', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏',
                      '🐑', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️',
                      
                      // Food & Drink
                      '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝',
                      '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐',
                      '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭',
                      '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲',
                      '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨',
                      '🍦', '🍰', '🧁', '🥧', '🍮', '🍭', '🍬', '🍫', '🍿', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '🫖',
                      
                      // Activities & Objects
                      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
                      '🏏', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷️', '⛸️', '🥌', '🎿', '⛷️',
                      '🏂', '🪂', '🏋️‍♀️', '🏋️', '🏋️‍♂️', '🤼‍♀️', '🤼', '🤼‍♂️', '🤸‍♀️', '🤸', '🤸‍♂️', '⛹️‍♀️', '⛹️', '⛹️‍♂️',
                      '🤺', '🤾‍♀️', '🤾', '🤾‍♂️', '🏊‍♀️', '🏊', '🏊‍♂️', '🚣‍♀️', '🚣', '🚣‍♂️', '🏄‍♀️', '🏄', '🏄‍♂️', '🚴‍♀️', '🚴',
                      '🚴‍♂️', '🚵‍♀️', '🚵', '🚵‍♂️', '🤹‍♀️', '🤹', '🤹‍♂️', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹',
                      '🥁', '🪘', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩', '🎨', '📱',
                      
                      // Travel & Places
                      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🛴', '🛵', '🏍️',
                      '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂',
                      '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤',
                      '🛥️', '🛳️', '⛴️', '🚢', '⚓', '🚧', '⛽', '🚏', '🚦', '🚥', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯',
                      '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏔️', '🗻', '🌋', '🗾', '🏕️', '⛺', '🏠', '🏡',
                      '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '⛪',
                      
                      // Symbols & Objects
                      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
                      '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈',
                      '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️',
                      '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹',
                      '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️',
                      '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️',
                      
                      // Flags & Misc
                      '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏴‍☠️', '🇦🇫', '🇦🇱', '🇩🇿', '🇦🇩', '🇦🇩', '🇦🇩', '🇦🇩', '🇦🇩', '🇦🇩',
                      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👋', '🤚',
                      '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇',
                      '🎉', '🎊', '🎈', '🎂', '🎁', '🎄', '🎃', '🎗️', '🎟️', '🎫', '🎖️', '🏆', '🏅', '🥇', '🥈', '🥉',
                      '🔥', '💯', '✨', '🌟', '💫', '⭐', '💥', '⚡', '💦', '💨', '☁️', '🌤️', '⛅', '🌥️', '☁️', '🌦️',
                      '🌧️', '⛈️', '🌩️', '🌨️', '☃️', '⛄', '🌬️', '💨', '🌪️', '🌫️', '🌊', '💧', '💦', '☔', '☂️', '🌂'
                    ].map((emoji) => (
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
                        className="w-10 h-10 flex items-center justify-center text-xl hover:scale-110 transition-all duration-200 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md"
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
          <div className="bg-gradient-to-br from-white via-blue-50 to-purple-50 rounded-3xl shadow-2xl w-full h-full max-w-6xl max-h-full p-0 relative animate-fadeIn flex flex-col border border-gray-200 transform transition-all duration-500 hover:shadow-3xl overflow-hidden">
            <>
                {/* Chat Header (sticky on mobile to avoid URL bar overlap) */}
                <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b-2 border-blue-700 bg-gradient-to-r from-blue-700 via-purple-700 to-blue-900 rounded-t-3xl relative shadow-2xl flex-shrink-0 md:sticky md:top-0 sticky top-[env(safe-area-inset-top,0px)] z-30">
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
                                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c4.28 0 6.92 1.45 8.84 4.55.23.36.76.09.65-.32C18.31 13.13 15.36 10.36 10 9z"/></svg>
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
                                            const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${selectedMsg._id}/star`, 
                                              { starred: !isStarred },
                                              {
                                                withCredentials: true,
                                                headers: { 'Content-Type': 'application/json' }
                                              }
                                            );
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
                                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : selectedMsg.starredBy?.includes(currentUser._id) ? (
                                          <FaStar size={18} />
                                        ) : (
                                          <FaRegStar size={18} />
                                        )}
                                      </button>
                                      {isSentMessage && null}
                                      <button
                                        className={`rounded-full p-2 transition-colors ${
                                          isChatSendBlocked 
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
                                      className={`rounded-full p-2 transition-colors ${
                                        isChatSendBlocked 
                                          ? 'text-gray-400 bg-white/5 cursor-not-allowed' 
                                          : 'text-white hover:text-red-200 bg-white/10 hover:bg-white/20'
                                      }`}
                                      onClick={async () => { 
                                        if (isChatSendBlocked) {
                                          toast.info('Delete disabled for this appointment status. You can view chat history.');
                                          return;
                                        }
                                        try {
                                          await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${selectedMsg._id}/remove-for-me`, 
                                            {},
                                            {
                                              withCredentials: true
                                            }
                                          );
                                        } catch {}
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
                                className={`rounded-full p-2 transition-colors ${
                                  isChatSendBlocked 
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
                                    await axios.post(`${API_BASE_URL}/api/bookings/${appt._id}/comments/removed/sync`, 
                                      { removedIds: ids },
                                      {
                                        withCredentials: true,
                                        headers: { 'Content-Type': 'application/json' }
                                      }
                                    );
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
                                      
                                      const response = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${msg._id}/star`, 
                                        { starred: !isStarred },
                                        {
                                          withCredentials: true,
                                          headers: { 'Content-Type': 'application/json' }
                                        }
                                      );
                                      
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
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <FaStar size={18} />
                              )}
                            </button>
                            <button
                              className={`rounded-full p-2 transition-colors ${
                                isChatSendBlocked 
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
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
                              className={`rounded-full p-2 transition-colors ${
                                isChatSendBlocked 
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
                            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c4.28 0 6.92 1.45 8.84 4.55.23.36.76.09.65-.32C18.31 13.13 15.36 10.36 10 9z"/></svg>
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
                                const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${selectedMessageForHeaderOptions._id}/star`, 
                                  { starred: !isStarred },
                                  {
                                    withCredentials: true,
                                    headers: { 'Content-Type': 'application/json' }
                                  }
                                );
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
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
                            className={`rounded-full p-2 transition-colors ${
                              isChatSendBlocked 
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
                              <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-20 min-w-[180px] chat-options-menu">
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
                                            const response = await fetch(selectedMessageForHeaderOptions.videoUrl, { mode: 'cors' });
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
                                    <button
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                      onClick={() => { showMessageInfo(selectedMessageForHeaderOptions); setShowHeaderMoreMenu(false); setHeaderOptionsMessageId(null); }}
                                    >
                                      <FaInfoCircle className="text-sm" />
                                      Info
                                    </button>
                                    <button
                                      className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                                        isChatSendBlocked 
                                          ? 'text-gray-400 cursor-not-allowed' 
                                          : 'text-gray-700 hover:bg-gray-100'
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
                                      className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                                        isChatSendBlocked || editingComment !== null
                                          ? 'text-gray-400 cursor-not-allowed'
                                          : 'text-gray-700 hover:bg-gray-100'
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
                                            const response = await fetch(selectedMessageForHeaderOptions.videoUrl, { mode: 'cors' });
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
                                    <button
                                      className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                                        isChatSendBlocked 
                                          ? 'text-gray-400 cursor-not-allowed' 
                                          : 'text-gray-700 hover:bg-gray-100'
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
                              toast.info(muted ? 'Sounds muted' : 'Sounds unmuted');
                            }}
                            isMuted={isMuted()}
                            onVolumeChange={(volume) => {
                              setVolume(volume);
                              toast.info(`Volume: ${Math.round(volume * 100)}%`);
                            }}
                          />
                        </div>
                        {/* Lock indicator */}
                        {(chatLocked || chatLockStatusLoading) && (
                          <div className="flex items-center gap-1 bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-bold flex-shrink-0">
                            {chatLockStatusLoading ? (
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M18 10v-4c0-3.313-2.687-6-6-6s-6 2.687-6 6v4H4v10h16V10h-2zM8 6c0-2.206 1.794-4 4-4s4 1.794 4 4v4H8V6z"/>
                              </svg>
                            )}
                            {chatLockStatusLoading ? 'Loading...' : 'Locked'}
                          </div>
                        )}


                        
                        {/* Search functionality */}
                        <div className="relative search-container">
                          <button
                            className="text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-all duration-300 transform hover:scale-110 shadow"
                            onClick={() => setShowSearchBox(true)}
                            title="Search messages"
                            aria-label="Search messages"
                          >
                            <FaSearch className="text-sm" />
                          </button>
                        </div>
                        
                        {/* Chat options menu */}
                        <div className="relative flex items-center gap-2">
                          {/* Loading icon when refreshing messages */}
                          {loadingComments && (
                            <div className="text-white bg-white/10 rounded-full p-2 shadow">
                              <FaSpinner className="text-sm animate-spin" />
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
                            <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-20 min-w-[180px] chat-options-menu">
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
                              {/* Refresh option */}
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                onClick={() => {
                                  fetchLatestComments();
                                  setShowChatOptionsMenu(false);
                                }}
                              >
                                <FaSync className="text-sm" />
                                Refresh Messages
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
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
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
                                    onExportChat(appt, filteredComments);
                                  }}
                                >
                                  <FaDownload className="text-sm" />
                                  Export Chat Transcript (PDF)
                                </button>
                              )}

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
                                    <path d="M18 10v-4c0-3.313-2.687-6-6-6s-6 2.687-6 6v4H4v10h16V10h-2zM8 6c0-2.206 1.794-4 4-4s4 1.794 4 4v4H8V6z"/>
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
                                    <path d="M18 10v-4c0-3.313-2.687-6-6-6s-6 2.687-6 6v4H4v10h16V10h-2zM8 6c0-2.206 1.794-4 4-4s4 1.794 4 4v4H8V6z"/>
                                  </svg>
                                  Lock Chat
                                </button>
                              )}
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
                        {/* Tips & Guidelines popup */}
                        {showShortcutTip && (
                          <div className="absolute top-full right-0 mt-2 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-20 max-w-xs animate-fadeIn">
                            <div className="font-semibold mb-2">⌨️ Keyboard Shortcuts:</div>
                            <div className="mb-2">• Press Ctrl + F to quickly focus and type your message</div>
                          <div className="border-t border-gray-600 pt-2 mt-2">
                            <div className="font-semibold mb-2">📎 File Upload Guidelines:</div>
                            <div>• Photos: JPG, PNG, GIF, WebP (≤ 5MB)</div>
                            <div>• Videos: MP4, WebM, MOV, MKV, OGG (≤ 5MB)</div>
                            <div>• Documents: PDF, DOCX, XLSX, TXT and more (≤ 5MB)</div>
                              <div>• Add captions to images</div>
                              <div>• Other file types coming soon</div>
                            </div>
                            <div className="border-t border-gray-600 pt-2 mt-2">
                              <div className="font-semibold mb-2">💬 Chat Features:</div>
                              <div>• Real-time messaging with socket.io</div>
                              <div>• Message reactions and emoji support</div>
                              <div>• File sharing and image previews</div>
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
                          <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[250px] animate-fadeIn" 
                               style={{zIndex: 9999}}>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium text-gray-700">Jump to Date</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowCalendar(false);
                                }}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
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
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                              max={formatDateForInput(new Date())}
                            />
                            <div className="text-xs text-gray-500 mt-2">
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
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-200 px-4 py-3 flex-shrink-0">
                      <div className="flex items-center gap-2 mb-2">
                        <FaThumbtack className="text-purple-600 text-sm" />
                        <span className="text-purple-700 font-semibold text-sm">Pinned Messages</span>
                        <span className="text-purple-600 text-xs">({pinnedMessages.length})</span>
                      </div>
                      <div className="space-y-2 max-h-24 overflow-y-auto">
                        {pinnedMessages.map((pinnedMsg) => (
                          <div
                            key={pinnedMsg._id}
                            className={`bg-white rounded-lg p-2 border-l-4 border-purple-500 cursor-pointer transition-all duration-200 hover:shadow-md ${
                              highlightedPinnedMessage === pinnedMsg._id ? 'ring-2 ring-purple-400 shadow-lg' : ''
                            }`}
                            onClick={() => {
                              // Highlight the pinned message and scroll to it
                              setHighlightedPinnedMessage(pinnedMsg._id);
                              const messageElement = document.getElementById(`message-${pinnedMsg._id}`);
                              if (messageElement) {
                                messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                // Remove highlight after 3 seconds
                                setTimeout(() => setHighlightedPinnedMessage(null), 3000);
                              }
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
                                <div className="text-sm text-gray-800 line-clamp-2">
                                  {pinnedMsg.message}
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
                  <div 
                    ref={chatContainerRef} 
                    className={`flex-1 overflow-y-auto space-y-2 px-4 pt-4 animate-fadeInChat relative bg-gradient-to-b from-transparent to-blue-50/30 ${isDragOver ? 'bg-blue-50/50 border-2 border-dashed border-blue-300' : ''}`}
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
                    className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-400 rounded-r-lg mb-4 backdrop-blur-sm"
                  >
                    <p className="text-sm text-blue-700 font-medium text-center flex items-center justify-center gap-2">
                      <span className="animate-gentlePulse">🔒</span>
                      Your privacy is our top priority — all your chats and data are fully encrypted for your safety
                    </p>
                  </div>
                  
                  {/* Floating Date Indicator */}
                  {currentFloatingDate && filteredComments.length > 0 && (
                    <div className={`sticky top-0 left-0 right-0 z-30 pointer-events-none transition-all duration-300 ease-in-out ${
                      isScrolling ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                    }`}>
                      <div className="w-full flex justify-center py-2">
                        <div className="bg-blue-600 text-white text-xs px-4 py-2 rounded-full shadow-lg border-2 border-white">
                          {currentFloatingDate}
                        </div>
                      </div>
                    </div>
                  )}
                  {filteredComments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <FaCommentDots className="text-gray-300 text-4xl mb-3" />
                      <p className="text-gray-500 font-medium text-sm">No messages yet</p>
                      <p className="text-gray-400 text-xs mt-1">Start the conversation and connect with the other party</p>
                    </div>
                  ) : (
                    // Visible window for infinite scroll
                    (filteredComments.slice(Math.max(0, filteredComments.length - Math.min(visibleCount, filteredComments.length)))).map((c, mapIndex, arr) => {
                    const index = filteredComments.length - arr.length + mapIndex;
                    const isMe = c.senderEmail === currentUser.email;
                    const isEditing = editingComment === c._id;
                    const currentDate = new Date(c.timestamp);
                    const previousDate = index > 0 ? new Date(filteredComments[index - 1].timestamp) : null;
                    const isNewDay = previousDate ? currentDate.toDateString() !== previousDate.toDateString() : true;
                    const formattedDate = currentDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });

                    return (
                      <React.Fragment key={c._id || index}>
                        {isNewDay && (
                          <div className="w-full flex justify-center my-2">
                            <span className="bg-blue-600 text-white text-xs px-4 py-2 rounded-full shadow-lg border-2 border-white">{getDateLabel(currentDate)}</span>
                          </div>
                        )}
                        {/* New messages divider: only right after opening when unread exists */}
                        {showUnreadDividerOnOpen && unreadNewMessages > 0 && index === filteredComments.length - unreadNewMessages && (
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
                            className={`relative rounded-2xl px-4 sm:px-5 py-3 text-sm shadow-xl max-w-[90%] sm:max-w-[80%] md:max-w-[70%] lg:max-w-[60%] xl:max-w-[50%] break-words overflow-visible transition-all duration-300 min-h-[60px] ${
                              isMe 
                                ? 'bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-500 hover:to-purple-600 text-white shadow-blue-200 hover:shadow-blue-300 hover:shadow-2xl' 
                                : 'bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 shadow-gray-200 hover:shadow-lg hover:border-gray-300 hover:shadow-xl'
                            } ${
                              highlightedPinnedMessage === c._id ? 'ring-4 ring-purple-400 shadow-2xl scale-105' : ''
                            } ${isSelectionMode && selectedMessages.some(msg => msg._id === c._id) ? 'ring-2 ring-blue-400' : ''}`}
                            style={{ animationDelay: `${0.03 * index}s` }}
                          >
                            {/* Reply preview above message if this is a reply */}
                            {c.replyTo && (
                              <div className="border-l-4 border-purple-400 pl-3 mb-2 text-xs bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 rounded-lg w-full max-w-full break-words cursor-pointer transition-all duration-200 hover:shadow-sm" onClick={() => {
                                  if (messageRefs.current[c.replyTo]) {
                                    messageRefs.current[c.replyTo].scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    messageRefs.current[c.replyTo].classList.add('reply-highlight');
                                    setTimeout(() => {
                                      messageRefs.current[c.replyTo]?.classList.remove('reply-highlight');
                                    }, 1600);
                                  }
                                }} role="button" tabIndex={0} aria-label="Go to replied message">
                                <span className="text-xs text-gray-700 font-medium truncate max-w-[150px] flex items-center gap-1">
                                  <span className="text-purple-500">↩</span>
                                  {comments.find(msg => msg._id === c.replyTo)?.message?.substring(0, 30) || 'Original message'}{comments.find(msg => msg._id === c.replyTo)?.message?.length > 30 ? '...' : ''}
                                </span>
                              </div>
                            )}
                            {/* Sender label for admin messages */}
                            {!isMe && (c.senderEmail !== appt.buyerId?.email) && (c.senderEmail !== appt.sellerId?.email) && (
                              <div className="font-semibold mb-1 text-xs text-purple-600">UrbanSetu</div>
                            )}
                            <div className={`text-left ${isMe ? 'text-base font-medium' : 'text-sm'}`}>
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
                                              const media = (comments || [])
                                                .filter(msg => msg.imageUrl || msg.videoUrl)
                                                .map(msg => msg.imageUrl ? ({ type: 'image', url: msg.imageUrl }) : ({ type: 'video', url: msg.videoUrl }));
                                              const startIndex = Math.max(0, media.findIndex(m => m.url === c.imageUrl));
                                              setChatMediaItems(media);
                                              setChatMediaStartIndex(startIndex);
                                              setShowChatMediaPreview(true);
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
                                        <div className="mb-2">
                                          <div className="relative">
                                            <video
                                              src={c.videoUrl}
                                              className="max-w-full max-h-64 rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                                              controls
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const media = (comments || [])
                                                  .filter(msg => msg.imageUrl || msg.videoUrl)
                                                  .map(msg => msg.imageUrl ? ({ type: 'image', url: msg.imageUrl }) : ({ type: 'video', url: msg.videoUrl }));
                                                const startIndex = Math.max(0, media.findIndex(m => m.url === c.videoUrl));
                                                setChatMediaItems(media);
                                                setChatMediaStartIndex(startIndex);
                                                setShowChatMediaPreview(true);
                                              }}
                                            />
                                          </div>
                                          <div className={`mt-1 text-xs flex gap-3 ${isMe ? 'text-blue-100' : 'text-gray-500'}`}>
                                            <button
                                              className={`${isMe ? 'text-white hover:text-blue-100' : 'text-blue-600 hover:underline'}`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                // download video
                                                const a = document.createElement('a');
                                                a.href = c.videoUrl;
                                                a.download = `video-${c._id || Date.now()}`;
                                                a.target = '_blank';
                                                document.body.appendChild(a);
                                                a.click();
                                                a.remove();
                                              }}
                                            >Download</button>
                                          </div>
                                        </div>
                                      )}
                                      {/* Document Message */}
                                      {c.documentUrl && (
                                        <div className="mb-2">
                                          <button
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              try {
                                                const response = await fetch(c.documentUrl, { mode: 'cors' });
                                                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                                const blob = await response.blob();
                                                const blobUrl = window.URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = blobUrl;
                                                a.download = c.documentName || `document-${c._id || Date.now()}`;
                                                document.body.appendChild(a);
                                                a.click();
                                                a.remove();
                                                setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
                                              } catch (error) {
                                                console.error('Download failed:', error);
                                                // Fallback to direct link
                                                const a = document.createElement('a');
                                                a.href = c.documentUrl;
                                                a.download = c.documentName || `document-${c._id || Date.now()}`;
                                                a.target = '_blank';
                                                document.body.appendChild(a);
                                                a.click();
                                                a.remove();
                                              }
                                            }}
                                          >
                                            <span className="text-2xl">📄</span>
                                            <span className={`text-sm truncate max-w-[200px] ${isMe ? 'text-white' : 'text-blue-700'}`}>{c.documentName || 'Document'}</span>
                                          </button>
                                        </div>
                                      )}
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
                                              />
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()}
                                      
                                      <FormattedTextWithReadMore 
                                        text={(c.message || '').replace(/\n+$/, '')}
                                        isSentMessage={isMe}
                                        className="whitespace-pre-wrap break-words"
                                        searchQuery={searchQuery}
                                      />
                                      {c.edited && (
                                        <span className="ml-2 text-[10px] italic text-gray-300 whitespace-nowrap">(Edited)</span>
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
                                className={`${
                                  c.senderEmail === currentUser.email 
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
                                          className={`text-xs rounded-full px-2 py-1 flex items-center gap-1 transition-all duration-200 hover:scale-105 ${
                                            hasUserReaction 
                                              ? 'bg-blue-100 border border-blue-300 hover:bg-blue-200' 
                                              : 'bg-gray-100 hover:bg-gray-200'
                                          }`}
                                          title={`${userNames} reacted with ${emoji}${hasUserReaction ? ' (Click to remove)' : ' (Click to add)'}`}
                                        >
                                          <span>{emoji}</span>
                                          <span className={`${hasUserReaction ? 'text-blue-600' : 'text-gray-600'}`}>
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
                                  {c.readBy?.includes(otherParty?._id)
                                    ? <FaCheckDouble className="text-green-400 text-xs transition-all duration-300 animate-fadeIn" title="Read" />
                                    : c.status === 'delivered'
                                      ? <FaCheckDouble className="text-blue-200 text-xs transition-all duration-300 animate-fadeIn" title="Delivered" />
                                      : c.status === 'sending'
                                        ? <FaCheck className="text-blue-200 text-xs animate-pulse transition-all duration-300" title="Sending..." />
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
                            <div className={`absolute -top-8 ${isMe ? 'right-0' : 'left-0'} bg-red-500 rounded-full shadow-lg border-2 border-red-600 p-1 flex items-center gap-1 animate-reactions-bar z-[999999] reactions-bar transition-all duration-300`} style={{ minWidth: 'max-content' }}>
                              {/* Quick reaction buttons */}
                              <button
                                onClick={() => handleQuickReaction(c._id, '👍')}
                                className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${
                                  isChatSendBlocked 
                                    ? 'bg-gray-200 cursor-not-allowed opacity-50' 
                                    : c.reactions?.some(r => r.emoji === '👍' && r.userId === currentUser._id)
                                      ? 'bg-blue-100 border-2 border-blue-400'
                                      : 'bg-gray-50 hover:bg-gray-100 hover:scale-110'
                                }`}
                                disabled={isChatSendBlocked}
                                title={isChatSendBlocked ? "Reactions disabled" : "Like"}
                              >
                                👍
                              </button>
                              <button
                                onClick={() => handleQuickReaction(c._id, '❤️')}
                                className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${
                                  isChatSendBlocked 
                                    ? 'bg-gray-200 cursor-not-allowed opacity-50' 
                                    : c.reactions?.some(r => r.emoji === '❤️' && r.userId === currentUser._id)
                                      ? 'bg-blue-100 border-2 border-blue-400'
                                      : 'bg-gray-50 hover:bg-gray-100 hover:scale-110'
                                }`}
                                disabled={isChatSendBlocked}
                                title={isChatSendBlocked ? "Reactions disabled" : "Love"}
                              >
                                ❤️
                              </button>
                              <button
                                onClick={() => handleQuickReaction(c._id, '😂')}
                                className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${
                                  isChatSendBlocked 
                                    ? 'bg-gray-200 cursor-not-allowed opacity-50' 
                                    : c.reactions?.some(r => r.emoji === '😂' && r.userId === currentUser._id)
                                      ? 'bg-blue-100 border-2 border-blue-400'
                                      : 'bg-gray-50 hover:bg-gray-100 hover:scale-110'
                                }`}
                                disabled={isChatSendBlocked}
                                title={isChatSendBlocked ? "Reactions disabled" : "Laugh"}
                              >
                                😂
                              </button>
                              <button
                                onClick={() => handleQuickReaction(c._id, '😮')}
                                className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${
                                  isChatSendBlocked 
                                    ? 'bg-gray-200 cursor-not-allowed opacity-50' 
                                    : c.reactions?.some(r => r.emoji === '😮' && r.userId === currentUser._id)
                                      ? 'bg-blue-100 border-2 border-blue-400'
                                      : 'bg-gray-50 hover:bg-gray-100 hover:scale-110'
                                }`}
                                disabled={isChatSendBlocked}
                                title={isChatSendBlocked ? "Reactions disabled" : "Wow"}
                              >
                                😮
                              </button>
                              <button
                                onClick={() => handleQuickReaction(c._id, '😢')}
                                className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${
                                  isChatSendBlocked 
                                    ? 'bg-gray-200 cursor-not-allowed opacity-50' 
                                    : c.reactions?.some(r => r.emoji === '😢' && r.userId === currentUser._id)
                                      ? 'bg-blue-100 border-2 border-blue-400'
                                      : 'bg-gray-50 hover:bg-gray-100 hover:scale-110'
                                }`}
                                disabled={isChatSendBlocked}
                                title={isChatSendBlocked ? "Reactions disabled" : "Sad"}
                              >
                                😢
                              </button>
                              <button
                                onClick={() => handleQuickReaction(c._id, '😡')}
                                className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${
                                  isChatSendBlocked 
                                    ? 'bg-gray-200 cursor-not-allowed opacity-50' 
                                    : c.reactions?.some(r => r.emoji === '😡' && r.userId === currentUser._id)
                                      ? 'bg-blue-100 border-2 border-blue-400'
                                      : 'bg-gray-50 hover:bg-gray-100 hover:scale-110'
                                }`}
                                disabled={isChatSendBlocked}
                                title={isChatSendBlocked ? "Reactions disabled" : "Angry"}
                              >
                                😡
                              </button>
                              <div className="w-px h-6 bg-gray-300 mx-1"></div>
                              <button
                                onClick={toggleReactionsEmojiPicker}
                                className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${
                                  isChatSendBlocked 
                                    ? 'bg-gray-200 cursor-not-allowed opacity-50' 
                                    : 'bg-gray-50 hover:bg-gray-100 hover:scale-110'
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
                  }))}
                  
                  <div ref={chatEndRef} />
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
                          className="fixed bg-red-500 rounded-full shadow-lg border-2 border-red-600 p-1 flex items-center gap-1 animate-reactions-bar z-[999999] reactions-bar transition-all duration-300"
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
                            className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${
                              isChatSendBlocked 
                                ? 'bg-gray-200 cursor-not-allowed opacity-50' 
                                : comment.reactions?.some(r => r.emoji === '👍' && r.userId === currentUser._id)
                                  ? 'bg-blue-100 border-2 border-blue-400'
                                  : 'bg-gray-50 hover:bg-gray-100 hover:scale-110'
                            }`}
                            disabled={isChatSendBlocked}
                            title={isChatSendBlocked ? "Reactions disabled" : "Like"}
                          >
                            👍
                          </button>
                          <button
                            onClick={() => handleQuickReaction(comment._id, '❤️')}
                            className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${
                              isChatSendBlocked 
                                ? 'bg-gray-200 cursor-not-allowed opacity-50' 
                                : comment.reactions?.some(r => r.emoji === '❤️' && r.userId === currentUser._id)
                                  ? 'bg-blue-100 border-2 border-blue-400'
                                  : 'bg-gray-50 hover:bg-gray-100 hover:scale-110'
                            }`}
                            disabled={isChatSendBlocked}
                            title={isChatSendBlocked ? "Reactions disabled" : "Love"}
                          >
                            ❤️
                          </button>
                          <button
                            onClick={() => handleQuickReaction(comment._id, '😂')}
                            className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${
                              isChatSendBlocked 
                                ? 'bg-gray-200 cursor-not-allowed opacity-50' 
                                : comment.reactions?.some(r => r.emoji === '😂' && r.userId === currentUser._id)
                                  ? 'bg-blue-100 border-2 border-blue-400'
                                  : 'bg-gray-50 hover:bg-gray-100 hover:scale-110'
                            }`}
                            disabled={isChatSendBlocked}
                            title={isChatSendBlocked ? "Reactions disabled" : "Laugh"}
                          >
                            😂
                          </button>
                          <button
                            onClick={() => handleQuickReaction(comment._id, '😮')}
                            className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${
                              isChatSendBlocked 
                                ? 'bg-gray-200 cursor-not-allowed opacity-50' 
                                : comment.reactions?.some(r => r.emoji === '😮' && r.userId === currentUser._id)
                                  ? 'bg-blue-100 border-2 border-blue-400'
                                  : 'bg-gray-50 hover:bg-gray-100 hover:scale-110'
                            }`}
                            disabled={isChatSendBlocked}
                            title={isChatSendBlocked ? "Reactions disabled" : "Wow"}
                          >
                            😮
                          </button>
                          <button
                            onClick={() => handleQuickReaction(comment._id, '😢')}
                            className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${
                              isChatSendBlocked 
                                ? 'bg-gray-200 cursor-not-allowed opacity-50' 
                                : comment.reactions?.some(r => r.emoji === '😢' && r.userId === currentUser._id)
                                  ? 'bg-blue-100 border-2 border-blue-400'
                                  : 'bg-gray-50 hover:bg-gray-100 hover:scale-110'
                            }`}
                            disabled={isChatSendBlocked}
                            title={isChatSendBlocked ? "Reactions disabled" : "Sad"}
                          >
                            😢
                          </button>
                          <button
                            onClick={() => handleQuickReaction(comment._id, '😡')}
                            className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${
                              isChatSendBlocked 
                                ? 'bg-gray-200 cursor-not-allowed opacity-50' 
                                : comment.reactions?.some(r => r.emoji === '😡' && r.userId === currentUser._id)
                                  ? 'bg-blue-100 border-2 border-blue-400'
                                  : 'bg-gray-50 hover:bg-gray-100 hover:scale-110'
                            }`}
                            disabled={isChatSendBlocked}
                            title={isChatSendBlocked ? "Reactions disabled" : "Angry"}
                          >
                            😡
                          </button>
                          <div className="w-px h-6 bg-gray-300 mx-1"></div>
                          <button
                            onClick={toggleReactionsEmojiPicker}
                            className={`w-8 h-8 flex items-center justify-center text-lg transition-transform rounded-full ${
                              isChatSendBlocked 
                                ? 'bg-gray-200 cursor-not-allowed opacity-50' 
                                : 'bg-gray-50 hover:bg-gray-100 hover:scale-110'
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
                    <div className="flex items-center bg-blue-50 border-l-4 border-blue-400 px-2 py-1 rounded">
                      <span className="text-xs text-gray-700 font-semibold mr-2">Replying to:</span>
                      <span className="text-xs text-gray-600 truncate max-w-[200px]">{replyTo.message?.substring(0, 40)}{replyTo.message?.length > 40 ? '...' : ''}</span>
                      <button className="ml-auto text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition-colors" onClick={() => setReplyTo(null)} title="Cancel reply">
                        <FaTimes className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}


                
                {/* Edit indicator */}
                {editingComment && (
                  <div className="px-4 mb-2">
                    <div className="flex items-center bg-yellow-50 border-l-4 border-yellow-400 px-2 py-1 rounded">
                      <span className="text-xs text-yellow-700 font-semibold mr-2">✏️ Editing message:</span>
                      <span className="text-xs text-yellow-600 truncate">{editText}</span>
                      <button 
                        className="ml-auto text-yellow-400 hover:text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded-full p-1 transition-colors" 
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
                <div className="flex gap-2 mt-1 px-3 pb-2 flex-shrink-0 bg-gradient-to-b from-transparent to-white pt-2 items-end">
                  {/* Message Input Container with Attachment and Emoji Icons Inside */}
                  <div className="flex-1 relative">
                    {/* Link Preview Container with Height and Width Constraints */}
                    {detectedUrl && (
                      <div className="max-h-32 max-w-full overflow-y-auto mb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                        <LinkPreview
                          url={detectedUrl}
                          onRemove={() => {
                            setDetectedUrl(null);
                            setPreviewDismissed(true);
                          }}
                          className="w-full"
                          showRemoveButton={true}
                          clickable={false}
                        />
                      </div>
                    )}
                    {/* Formatting toolbar */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <button type="button" className={`px-2 py-1 text-xs rounded border ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100'}`} onClick={() => {
                        if (isChatSendBlocked) {
                          toast.info('Formatting disabled for this appointment status. You can view chat history.');
                          return;
                        }
                        const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const end = el.selectionEnd || 0; const base = comment || ''; const selected = base.slice(start, end); const wrapped = `**${selected || 'bold'}**`; const next = base.slice(0,start)+wrapped+base.slice(end); setComment(next); setTimeout(()=>{ try{ el.focus(); el.setSelectionRange(start+2, start+2+(selected||'bold').length);}catch(_){}} ,0);
                      }} disabled={isChatSendBlocked}>B</button>
                      <button type="button" className={`px-2 py-1 text-xs rounded border italic ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100'}`} onClick={() => {
                        if (isChatSendBlocked) {
                          toast.info('Formatting disabled for this appointment status. You can view chat history.');
                          return;
                        }
                        const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const end = el.selectionEnd || 0; const base = comment || ''; const selected = base.slice(start, end); const wrapped = `*${selected || 'italic'}*`; const next = base.slice(0,start)+wrapped+base.slice(end); setComment(next); setTimeout(()=>{ try{ el.focus(); el.setSelectionRange(start+1, start+1+(selected||'italic').length);}catch(_){}} ,0);
                      }} disabled={isChatSendBlocked}>I</button>
                      <button type="button" className={`px-2 py-1 text-xs rounded border underline ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100'}`} onClick={() => {
                        if (isChatSendBlocked) {
                          toast.info('Formatting disabled for this appointment status. You can view chat history.');
                          return;
                        }
                        const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const end = el.selectionEnd || 0; const base = comment || ''; const selected = base.slice(start, end); const wrapped = `__${selected || 'underline'}__`; const next = base.slice(0,start)+wrapped+base.slice(end); setComment(next); setTimeout(()=>{ try{ el.focus(); el.setSelectionRange(start+2, start+2+(selected||'underline').length);}catch(_){}} ,0);
                      }} disabled={isChatSendBlocked}>U</button>
                      <button type="button" className={`px-2 py-1 text-xs rounded border ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100'}`} onClick={() => {
                        if (isChatSendBlocked) {
                          toast.info('Formatting disabled for this appointment status. You can view chat history.');
                          return;
                        }
                        const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const end = el.selectionEnd || 0; const base = comment || ''; const selected = base.slice(start, end); const wrapped = `~~${selected || 'strike'}~~`; const next = base.slice(0,start)+wrapped+base.slice(end); setComment(next); setTimeout(()=>{ try{ el.focus(); el.setSelectionRange(start+2, start+2+(selected||'strike').length);}catch(_){}} ,0);
                      }} disabled={isChatSendBlocked}>S</button>
                      <button type="button" className={`px-2 py-1 text-xs rounded border ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100'}`} onClick={() => {
                        if (isChatSendBlocked) {
                          toast.info('Formatting disabled for this appointment status. You can view chat history.');
                          return;
                        }
                        const el = inputRef.current; if (!el) return; const base = comment || ''; const start = el.selectionStart || 0; const before = base.slice(0,start); const after = base.slice(start); const next = `${before}- ${after}`; setComment(next); setTimeout(()=>{ try{ el.focus(); el.setSelectionRange(start+2, start+2);}catch(_){}} ,0);
                      }} disabled={isChatSendBlocked}>• List</button>
                      <button type="button" className={`px-2 py-1 text-xs rounded border ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100'}`} onClick={() => {
                        if (isChatSendBlocked) {
                          toast.info('Formatting disabled for this appointment status. You can view chat history.');
                          return;
                        }
                        const el = inputRef.current; if (!el) return; const base = comment || ''; const start = el.selectionStart || 0; const before = base.slice(0,start); const after = base.slice(start); 
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
                        
                        const next = `${before}${nextNum}. ${after}`; setComment(next); setTimeout(()=>{ try{ el.focus(); el.setSelectionRange(start+(nextNum.toString().length)+2, start+(nextNum.toString().length)+2);}catch(_){}} ,0);
                      }} disabled={isChatSendBlocked}>1. List</button>
                      <button type="button" className={`px-2 py-1 text-xs rounded border ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100'}`} onClick={() => {
                        if (isChatSendBlocked) {
                          toast.info('Formatting disabled for this appointment status. You can view chat history.');
                          return;
                        }
                        const el = inputRef.current; if (!el) return; const base = comment || ''; const start = el.selectionStart || 0; const before = base.slice(0,start); const after = base.slice(start); const next = `${before}> ${after}`; setComment(next); setTimeout(()=>{ try{ el.focus(); el.setSelectionRange(start+2, start+2);}catch(_){}} ,0);
                      }} disabled={isChatSendBlocked}>&gt; Quote</button>
                      <button type="button" className={`px-2 py-1 text-xs rounded border ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100'}`} title="Tag Property" onClick={() => {
                        if (isChatSendBlocked) {
                          toast.info('Formatting disabled for this appointment status. You can view chat history.');
                          return;
                        }
                        const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const base = comment || ''; const insert = '@'; const next = base.slice(0,start)+insert+base.slice(start); setComment(next); setTimeout(()=>{ try{ el.focus(); el.setSelectionRange(start+1, start+1);}catch(_){}} ,0);
                      }} disabled={isChatSendBlocked}>@Prop</button>
                      <button type="button" className={`px-2 py-1 text-xs rounded border ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100'}`} title="Insert appointment card" onClick={() => {
                        if (isChatSendBlocked) {
                          toast.info('Formatting disabled for this appointment status. You can view chat history.');
                          return;
                        }
                        const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const base = comment || ''; const card = '[Appointment: date • time • with]'; const next = base.slice(0,start)+card+base.slice(start); setComment(next); setTimeout(()=>{ try{ el.focus(); el.setSelectionRange(start+13, start+13);}catch(_){}} ,0);
                      }} disabled={isChatSendBlocked}>Appt</button>
                      <button type="button" className={`px-2 py-1 text-xs rounded border ${isChatSendBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-100'}`} title="Insert service link" onClick={() => {
                        if (isChatSendBlocked) {
                          toast.info('Formatting disabled for this appointment status. You can view chat history.');
                          return;
                        }
                        const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const base = comment || ''; const link = 'Book Movers: /user/movers'; const next = base.slice(0,start)+link+base.slice(start); setComment(next); setTimeout(()=>{ try{ el.focus(); el.setSelectionRange(start, start);}catch(_){}} ,0);
                      }} disabled={isChatSendBlocked}>Service</button>
                    </div>
                    {/* Property mention suggestions */}
                    {comment && /@[^\s]*$/.test(comment) && (
                      <div className="absolute bottom-16 left-2 right-2 bg-white border rounded shadow-lg max-h-48 overflow-auto z-30">
                        {(() => {
                          const query = (comment.match(/@([^\s]*)$/)?.[1] || '').toLowerCase();
                          const apptSource = (typeof appointments !== 'undefined' && Array.isArray(appointments) && appointments.length > 0) ? appointments : [appt].filter(Boolean);
                          const apptProps = apptSource.map(a => ({ id: a?.listingId?._id || a?.listingId, name: a?.propertyName || a?.listingId?.name || 'Property' }));
                          const combined = [...apptProps, ...allProperties];
                          const uniqueProps = Array.from(new Set(combined.filter(p => p.id && p.name).map(p => JSON.stringify(p))))
                            .map(s => JSON.parse(s))
                            .filter(p => p.name && p.name.toLowerCase().includes(query));
                          if (uniqueProps.length === 0) return <div className="px-3 py-2 text-sm text-gray-500">No matches</div>;
                          return uniqueProps.slice(0,8).map(p => (
                            <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100" onClick={() => {
                              const el = inputRef.current; const base = comment || ''; const m = base.match(/@([^\s]*)$/); if (!m) return; const start = base.lastIndexOf('@');
                              const token = `@[${p.name}](${p.id})`;
                              const next = base.slice(0,start) + token + ' ' + base.slice(start + m[0].length);
                              setComment(next);
                              setTimeout(()=>{ try{ el?.focus(); el?.setSelectionRange(start+token.length+1, start+token.length+1);}catch(_){}} ,0);
                            }}>{p.name}</button>
                          ));
                        })()}
                      </div>
                    )}
                    <textarea
                      rows={1}
                      className="w-full pl-4 pr-20 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 shadow-lg transition-all duration-300 bg-white resize-none whitespace-pre-wrap break-all hover:border-blue-300 hover:shadow-xl focus:shadow-2xl transform hover:scale-[1.01] overflow-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                      style={{
                        minHeight: '48px',
                        maxHeight: '144px', // 6 lines * 24px line height
                        lineHeight: '24px',
                        wordBreak: 'break-all',
                        overflowWrap: 'break-word'
                      }}
                      placeholder={isChatSendBlocked ? "Sending disabled for this appointment status. Chat history is available." : (editingComment ? "Edit your message..." : "Type a message...")}
                      value={comment}
                      onChange={e => {
                        if (isChatSendBlocked) { return; }
                        const value = e.target.value;
                        setComment(value);
                        
                        // Detect URLs in the input
                        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]{2,}(?:\/[^\s]*)?|[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;
                        const urls = value.match(urlRegex);
                        if (urls && urls.length > 0) {
                          setDetectedUrl(urls[0]);
                          setPreviewDismissed(false); // Reset dismissed flag for new URL
                        } else {
                          setDetectedUrl(null);
                          setPreviewDismissed(false);
                        }
                        
                        if (editingComment) {
                          setEditText(value);
                        }
                        if (!editingComment) {
                          socket.emit('typing', { toUserId: otherParty._id, fromUserId: currentUser._id, appointmentId: appt._id });
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
                        const imageItems = items.filter(item => item.type.startsWith('image/'));
                        
                        if (imageItems.length > 0) {
                          e.preventDefault();
                          const imageItem = imageItems[0];
                          const file = imageItem.getAsFile();
                          if (file) {
                            handleImageFiles([file]);
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
                        if (e.ctrlKey && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); const el = inputRef.current; if (!el) return; const start = el.selectionStart||0; const end=el.selectionEnd||0; const base=comment||''; const selected=base.slice(start,end); const wrapped=`*${selected||'italic'}*`; setComment(base.slice(0,start)+wrapped+base.slice(end)); return; }
                        if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) { e.preventDefault(); const el = inputRef.current; if (!el) return; const start = el.selectionStart||0; const end=el.selectionEnd||0; const base=comment||''; const selected=base.slice(start,end); const wrapped=`__${selected||'underline'}__`; setComment(base.slice(0,start)+wrapped+base.slice(end)); return; }
                        if (e.shiftKey && e.altKey && e.key === '7') { e.preventDefault(); const el=inputRef.current; if(!el)return; const base=comment||''; const start=el.selectionStart||0; setComment(base.slice(0,start)+'> '+base.slice(start)); return; }

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
                          } catch (_) {}
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
                            } catch (_) {}
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
                        className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 ${
                          uploadingFile || isChatSendBlocked
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-gray-100 hover:bg-gray-200 hover:shadow-md active:scale-95'
                        }`}
                        aria-haspopup="true"
                        aria-expanded={showAttachmentPanel}
                        aria-label="Attachments"
                      >
                        {uploadingFile ? (
                          <div className="animate-spin w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full"></div>
                        ) : (
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                        )}
                      </button>
                      {showAttachmentPanel && !isChatSendBlocked && (
                        <div ref={attachmentPanelRef} className="absolute bottom-10 right-0 bg-white border border-gray-200 shadow-xl rounded-lg w-48 py-2 z-20"> 
                          <label className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
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
                          <label className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
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
                                  if (file.size > 5 * 1024 * 1024) {
                                    toast.error('Maximum video size is 5MB');
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
                          <label className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
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
                                  if (file.size > 5 * 1024 * 1024) {
                                    toast.error('Maximum document size is 5MB');
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
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <button
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
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white border-2 border-gray-200 rounded-lg p-4 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-lg font-medium text-gray-700">
                          Image Preview ({selectedFiles.length} image{selectedFiles.length !== 1 ? 's' : ''})
                        </span>
                        <button
                          onClick={() => {
                            setSelectedFiles([]);
                            setImageCaptions({});
                            setPreviewIndex(0);
                            setShowImagePreviewModal(false);
                          }}
                          className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors"
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
                        <div className="text-center text-sm text-gray-600 mb-3">
                          {previewIndex + 1} of {selectedFiles.length}
                        </div>
                        
                        {/* Image Thumbnails */}
                        <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pb-2 min-w-0 max-w-full" style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db #f3f4f6' }}>
                          {selectedFiles.map((file, index) => (
                            <div key={index} className="relative">
                              <button
                                onClick={() => setPreviewIndex(index)}
                                className={`flex-shrink-0 w-12 h-12 rounded-lg border-2 transition-all duration-200 ${
                                  index === previewIndex 
                                    ? 'border-blue-500 shadow-lg' 
                                    : 'border-gray-300 hover:border-gray-400'
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
                              <label className="flex-shrink-0 w-12 h-12 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 cursor-pointer flex items-center justify-center group">
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
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        <div className="text-sm text-gray-600">
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
                              <span className="text-sm text-gray-700 w-10 text-right">{uploadProgress}%</span>
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
                                className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                                  isChatSendBlocked 
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
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white border-2 border-gray-200 rounded-lg p-4 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-lg font-medium text-gray-700">Video Preview</span>
                        <button
                          onClick={() => { setSelectedVideo(null); setShowVideoPreviewModal(false); }}
                          className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors"
                        >
                          <FaTimes className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex-1 mb-4 min-h-0">
                        <video controls className="w-full h-full max-h-[60vh] rounded-lg border" src={videoObjectURL} />
                      </div>
                      
                      {/* Caption for Video */}
                      <div className="relative mb-4">
                        <div className="relative">
                          <textarea
                            ref={videoCaptionRef}
                            placeholder={`Add a caption for ${selectedVideo.name}...`}
                            value={videoCaption}
                            onChange={(e) => setVideoCaption(e.target.value)}
                            className="w-full p-3 pr-12 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                        <div className="text-xs text-gray-500 mt-1 text-right">
                          {videoCaption.length}/500
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600 truncate flex-1 mr-4">{selectedVideo.name}</div>
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
                                <span className="text-sm text-gray-700 w-10 text-right">{uploadProgress}%</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setSelectedVideo(null); setShowVideoPreviewModal(false); setVideoCaption(''); }} className="px-4 py-2 rounded-lg border">Cancel</button>
                              <button onClick={handleSendSelectedVideo} className="px-4 py-2 rounded-lg bg-blue-600 text-white">Send</button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Document Preview Modal */}
                {showDocumentPreviewModal && selectedDocument && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white border-2 border-gray-200 rounded-lg p-4 shadow-2xl max-w-md w-full">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-lg font-medium text-gray-700">Document Preview</span>
                        <button
                          onClick={() => { setSelectedDocument(null); setShowDocumentPreviewModal(false); }}
                          className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors"
                        >
                          <FaTimes className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="mb-4 flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-600">📄</div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{selectedDocument.name}</div>
                          <div className="text-xs text-gray-500 truncate">{selectedDocument.type || 'Document'}</div>
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
                            className="w-full p-3 pr-12 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                        <div className="text-xs text-gray-500 mt-1 text-right">
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
                              <span className="text-sm text-gray-700 w-10 text-right">{uploadProgress}%</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setSelectedDocument(null); setShowDocumentPreviewModal(false); setDocumentCaption(''); }} className="px-4 py-2 rounded-lg border">Cancel</button>
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
                { (typeof isChatDisabled !== 'undefined' ? isChatDisabled : isChatSendBlocked) && (
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
                    scrollToBottom();
                  }}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full p-3 shadow-xl transition-all duration-200 hover:scale-110 relative transform hover:shadow-2xl"
                  title={unreadNewMessages > 0 ? `${unreadNewMessages} new message${unreadNewMessages > 1 ? 's' : ''}` : "Jump to latest"}
                  aria-label={unreadNewMessages > 0 ? `${unreadNewMessages} new messages, jump to latest` : "Jump to latest"}
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
                  <span className="text-sm font-medium">Message deleted for you</span>
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
      )}
      {/* Chat Lock Modal */}
      {showChatLockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" className="text-blue-600">
                <path d="M18 10v-4c0-3.313-2.687-6-6-6s-6 2.687-6 6v4H4v10h16V10h-2zM8 6c0-2.206 1.794-4 4-4s4 1.794 4 4v4H8V6z"/>
              </svg>
              Lock Chat
            </h3>
            
            <p className="text-gray-600 mb-4">
              Create a password to lock your chat. You'll need this password to access the chat later.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password (minimum 4 characters)
                </label>
                <div className="relative">
                  <input
                    type={showLockPassword ? "text" : "password"}
                    value={lockPassword}
                    onChange={(e) => setLockPassword(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLockPassword(!showLockPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showLockPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type={showLockPassword ? "text" : "password"}
                  value={lockConfirmPassword}
                  onChange={(e) => setLockConfirmPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Confirm password"
                />
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
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleChatLock}
                disabled={lockingChat}
                className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {lockingChat ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Locking...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18 10v-4c0-3.313-2.687-6-6-6s-6 2.687-6 6v4H4v10h16V10h-2zM8 6c0-2.206 1.794-4 4-4s4 1.794 4 4v4H8V6z"/>
                    </svg>
                    Lock Chat
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Unlock Modal */}
      {showChatUnlockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" className="text-orange-600">
                <path d="M18 10v-4c0-3.313-2.687-6-6-6s-6 2.687-6 6v4H4v10h16V10h-2zM8 6c0-2.206 1.794-4 4-4s4 1.794 4 4v4H8V6z"/>
              </svg>
              Chat is Locked
            </h3>
            
            <p className="text-gray-600 mb-4">
              This chat is protected with a password. Enter your password to access the chat.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showUnlockPassword ? "text" : "password"}
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 pr-10"
                  placeholder="Enter password"
                  onKeyPress={(e) => e.key === 'Enter' && handleChatUnlock()}
                />
                <button
                  type="button"
                  onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showUnlockPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => {
                  setShowChatUnlockModal(false);
                  setShowForgotPasswordModal(true);
                }}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
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
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleChatUnlock}
                disabled={unlockingChat}
                className="px-4 py-2 rounded bg-orange-600 text-white font-semibold hover:bg-orange-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {unlockingChat ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Unlocking...
                  </>
                ) : (
                  'Unlock Chat'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" className="text-red-600">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
              </svg>
              Forgot Password
            </h3>
            
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Warning</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>This action will permanently:</p>
                    <ul className="list-disc list-inside mt-1">
                      <li>Clear all chat messages</li>
                      <li>Remove the chat lock</li>
                      <li>Clear the passcode if set</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <p className="text-gray-600 mb-6">
              This action cannot be undone. Are you sure you want to proceed?
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(false)}
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={forgotPasswordProcessing}
                className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {forgotPasswordProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  'Continue'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Lock Modal */}
      {showRemoveLockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" className="text-red-600">
                <path d="M18 10v-4c0-3.313-2.687-6-6-6s-6 2.687-6 6v4H4v10h16V10h-2zM8 6c0-2.206 1.794-4 4-4s4 1.794 4 4v4H8V6z"/>
              </svg>
              Remove Chat Lock
            </h3>
            
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Permanent Action</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>This will remove the chat lock and disable password protection for this conversation.
You can lock this chat again at any time from the options.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <p className="text-gray-600 mb-4">
              Enter your chat lock password to confirm this action.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showRemoveLockPassword ? "text" : "password"}
                  value={removeLockPassword}
                  onChange={(e) => setRemoveLockPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 pr-10"
                  placeholder="Enter your chat lock password"
                  onKeyPress={(e) => e.key === 'Enter' && handleRemoveLockFromMenu()}
                />
                <button
                  type="button"
                  onClick={() => setShowRemoveLockPassword(!showRemoveLockPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showRemoveLockPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowRemoveLockModal(false);
                  setRemoveLockPassword('');
                  setShowRemoveLockPassword(false);
                }}
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveLockFromMenu}
                disabled={removingLock}
                className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {removingLock ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Removing...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18 10v-4c0-3.313-2.687-6-6-6s-6 2.687-6 6v4H4v10h16V10h-2zM8 6c0-2.206 1.794-4 4-4s4 1.794 4 4v4H8V6z"/>
                    </svg>
                    Remove Lock
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Message Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaTrash className="text-red-500" />
              {Array.isArray(messageToDelete) ? 'Delete Selected Messages' : 'Delete Message'}
            </h3>
            
            {(!Array.isArray(messageToDelete) && messageToDelete?.deleted) ? (
              // Deleted message - show simplified message for local removal
              <p className="text-gray-600 mb-6">
                Delete this message for me?
              </p>
            ) : ((Array.isArray(messageToDelete) && messageToDelete.every(m => m.senderEmail === currentUser.email)) || (!Array.isArray(messageToDelete) && messageToDelete?.senderEmail === currentUser.email)) ? (
              // Own message - show existing functionality
              <>
                <p className="text-gray-600 mb-4">
                  {Array.isArray(messageToDelete) ? `Are you sure you want to delete ${messageToDelete.length} messages?` : 'Are you sure you want to delete this message?'}
                </p>
                
                <div className="mb-6">
                  <label className={`flex items-center gap-3 ${isChatSendBlocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
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
                      disabled={isChatSendBlocked}
                      className={`form-checkbox h-4 w-4 text-red-600 rounded border-gray-300 focus:ring-red-500 ${
                        isChatSendBlocked ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    />
                    <span className={`text-sm ${isChatSendBlocked ? 'text-gray-400' : 'text-gray-700'}`}>
                      Also delete for{' '}
                      <span className={`font-medium ${isChatSendBlocked ? 'text-gray-400' : 'text-gray-900'}`}>
                        {otherParty?.username || 'other user'}
                      </span>
                      {isChatSendBlocked && ' (Disabled for this appointment status)'}
                    </span>
                  </label>
                  <p className={`text-xs mt-1 ml-7 ${isChatSendBlocked ? 'text-gray-400' : 'text-gray-500'}`}>
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
              <p className="text-gray-600 mb-6">
                {Array.isArray(messageToDelete) ? (
                  <>Delete selected messages from <span className="font-medium text-gray-900">{otherParty?.username || 'other user'}</span>?</>
                ) : (
                  <>Delete message from <span className="font-medium text-gray-900">{otherParty?.username || 'other user'}</span>?</>
                )}
              </p>
            )}
            
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setMessageToDelete(null);
                  setDeleteForBoth(true);
                }}
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <FaTrash size={12} />
                {Array.isArray(messageToDelete)
                  ? ((messageToDelete.every(m => m.senderEmail === currentUser.email) && deleteForBoth) ? 'Delete for everyone' : 'Delete for me')
                  : (messageToDelete?.deleted
                      ? 'Delete for me'
                      : messageToDelete?.senderEmail === currentUser.email
                        ? (deleteForBoth ? 'Delete for everyone' : 'Delete for me')
                        : 'Delete for me')
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Chat Confirmation Modal */}
      {showClearChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaTrash className="text-red-500" />
              Clear Chat
            </h3>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to clear chat? This action cannot be undone.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowClearChatModal(false)}
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearChat}
                className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <FaTrash size={12} />
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Appointment Confirmation Modal */}
      {showDeleteAppointmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaTrash className="text-red-500" />
              Delete Appointment
            </h3>
            
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this appointment?
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for deletion (required):
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors"
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
      )}

      {/* Cancel Appointment Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaBan className="text-orange-500" />
              Cancel Appointment
            </h3>
            
            <p className="text-gray-600 mb-4">
              Are you sure you want to cancel this appointment?
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for cancellation (required):
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors"
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
      )}

      {/* Admin Cancel Appointment Modal */}
      {showAdminCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaBan className="text-red-500" />
              Admin Cancel Appointment
            </h3>
            
            <p className="text-gray-600 mb-4">
              Are you sure you want to cancel this appointment as admin?
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for admin cancellation (required):
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors"
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
      )}

      {/* Permanent Delete Modal */}
      {showPermanentDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaTrash className="text-red-500" />
              Remove Appointment
            </h3>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to permanently remove this appointment from your table? This action cannot be undone.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowPermanentDeleteModal(false)}
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors"
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
      )}
      {/* Report Message Modal */}
      {showReportModal && reportingMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaFlag className="text-red-500" /> Report message
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {reportReason === 'Other' ? 'Additional details *' : 'Additional details (optional)'}
                  </label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    rows={4}
                    placeholder={reportReason === 'Other' ? 'Please provide details about the issue...' : 'Add any context to help admins review...'}
                    className="w-full p-2 border border-gray-300 rounded resize-y focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
                  />
                </div>
              )}
              <div className="bg-gray-50 rounded p-3 text-sm text-gray-700">
                <div className="font-semibold mb-1">Message excerpt:</div>
                <div className="line-clamp-4 whitespace-pre-wrap">{(reportingMessage.message || '').slice(0, 300)}</div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setShowReportModal(false); setReportingMessage(null); setReportReason(''); setReportDetails(''); }}
                className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!reportReason) { toast.error('Please select a reason'); return; }
                  setSubmittingReport(true);
                  try {
                    const { data } = await axios.post(`${API_BASE_URL}/api/notifications/report-chat`, 
                      {
                        appointmentId: appt._id,
                        commentId: reportingMessage._id,
                        reason: reportReason,
                        details: reportDetails,
                      },
                      {
                        withCredentials: true,
                        headers: { 'Content-Type': 'application/json' }
                      }
                    );
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
      )}

      {/* Report Chat Modal */}
      {showReportChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaFlag className="text-red-500" /> Report Chat
            </h3>
            
            {/* Last 5 Messages Preview */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <FaInfoCircle className="text-blue-500 text-sm" />
                <span className="text-sm font-medium text-gray-700">The last 5 messages in this chat will be sent to UrbanSetu. This person won't know you reported them:</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-48 overflow-y-auto">
                {filteredComments.slice(-5).map((message, index) => (
                  <div key={message._id || index} className="mb-3 last:mb-0">
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-600 flex-shrink-0">
                        {message.senderName ? message.senderName.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-600">
                            {message.senderName || 'Unknown User'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(message.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 bg-white rounded p-2 border border-gray-200">
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
                  <div className="text-center text-gray-500 text-sm py-4">
                    No messages to report
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <select
                  value={reportChatReason}
                  onChange={(e) => setReportChatReason(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {reportChatReason === 'other' ? 'Additional details *' : 'Additional details (optional)'}
                  </label>
                  <textarea
                    value={reportChatDetails}
                    onChange={(e) => setReportChatDetails(e.target.value)}
                    rows={4}
                    placeholder={reportChatReason === 'other' ? 'Please provide details about the issue...' : 'Provide more context to help admins review this chat...'}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
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
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300"
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
                    const { data } = await axios.post(`${API_BASE_URL}/api/notifications/report-chat-conversation`, 
                      {
                        appointmentId: appt._id,
                        reason: reportChatReason,
                        details: reportChatDetails,
                      },
                      {
                        withCredentials: true,
                        headers: { 'Content-Type': 'application/json' }
                      }
                    );
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
      )}

      {/* Message Info Modal */}
      {showMessageInfoModal && selectedMessageForInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaInfoCircle className="text-blue-500" /> Message Info
            </h3>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded p-3 text-sm text-gray-700">
                <div className="font-semibold mb-2">Message:</div>
                <div className="whitespace-pre-wrap break-words">{(selectedMessageForInfo.message || '').slice(0, 200)}{(selectedMessageForInfo.message || '').length > 200 ? '...' : ''}</div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Sent:</span>
                  <span className="text-sm text-gray-800">
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
                    <span className="text-sm font-medium text-gray-600">Delivered:</span>
                    <span className="text-sm text-gray-800">
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
                    <span className="text-sm font-medium text-gray-600">Read:</span>
                    <span className="text-sm text-gray-800">
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
                    <span className="text-sm font-medium text-gray-600">Status:</span>
                    <span className="text-sm text-gray-500">Not delivered yet</span>
                  </div>
                )}
                
                {selectedMessageForInfo.deliveredAt && !selectedMessageForInfo.readAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Status:</span>
                    <span className="text-sm text-blue-600">Delivered</span>
                  </div>
                )}
                
                {selectedMessageForInfo.readAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Status:</span>
                    <span className="text-sm text-green-600">Read</span>
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
      )}
      {/* Starred Messages Modal */}
      {showStarredModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-yellow-50 to-amber-50">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FaStar className="text-yellow-500" />
                Starred Messages
              </h3>
              <button
                onClick={fetchStarredMessages}
                disabled={loadingStarredMessages}
                className="p-2 text-yellow-600 hover:text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh starred messages"
              >
                {loadingStarredMessages ? (
                  <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <FaSync className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingStarredMessages ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                  <span className="ml-3 text-gray-600">Loading starred messages...</span>
                </div>
              ) : starredMessages.length === 0 ? (
                <div className="text-center py-12">
                  <FaRegStar className="mx-auto text-6xl text-gray-300 mb-4" />
                  <h4 className="text-xl font-semibold text-gray-600 mb-2">No Starred Messages</h4>
                  <p className="text-gray-500">Star important messages to find them easily later.</p>
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
                                  const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${message._id}/star`, 
                                    { starred: false },
                                    {
                                      withCredentials: true,
                                      headers: { 'Content-Type': 'application/json' }
                                    }
                                  );
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
                                <div className="w-3 h-3 border border-red-500 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <FaTimes className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          
                          {/* Message bubble - styled like chatbox */}
                          <div 
                            className={`rounded-2xl px-4 py-3 text-sm shadow-lg break-words relative group cursor-pointer hover:shadow-xl transition-all duration-200 ${
                              isMe 
                                ? 'bg-gradient-to-r from-blue-600 to-purple-700 text-white hover:from-blue-500 hover:to-purple-600' 
                                : 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                            }`}
                            onClick={() => {
                              setShowStarredModal(false);
                              // Scroll to the message in the main chat if it exists
                              const messageElement = document.querySelector(`[data-message-id="${message._id}"]`);
                              if (messageElement) {
                                messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                messageElement.classList.add('starred-highlight');
                                setTimeout(() => {
                                  messageElement.classList.remove('starred-highlight');
                                }, 1600);
                              }
                            }}
                          >
                            <div className="whitespace-pre-wrap break-words">
                              {message.deleted ? (
                                <span className="flex items-center gap-1 text-gray-400 italic">
                                  <FaBan className="inline-block text-lg" /> {message.senderEmail === currentUser.email ? "You deleted this message" : "This message was deleted."}
                                </span>
                              ) : (
                                <>
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
                                className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded-full ${
                                  isMe 
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
                              <div className={`flex justify-end mt-2 text-xs ${
                                isMe ? 'text-blue-200' : 'text-gray-500'
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
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
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
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
      )}
      {/* Pin Message Modal */}
      {showPinModal && messageToPin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FaThumbtack className="text-purple-500" />
                Pin Message
              </h3>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-600 mb-4">
                  {Array.isArray(messageToPin) 
                    ? `Choose how long to pin these ${messageToPin.length} messages:` 
                    : 'Choose how long to pin this message:'}
                </p>
                
                {/* Pin Duration Options */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="pinDuration"
                      value="24hrs"
                      checked={pinDuration === '24hrs'}
                      onChange={(e) => setPinDuration(e.target.value)}
                      className="text-purple-600"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">24 Hours</div>
                      <div className="text-sm text-gray-500">Pin for 24 hours</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="pinDuration"
                      value="7days"
                      checked={pinDuration === '7days'}
                      onChange={(e) => setPinDuration(e.target.value)}
                      className="text-purple-600"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">7 Days</div>
                      <div className="text-sm text-gray-500">Pin for 7 days</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="pinDuration"
                      value="30days"
                      checked={pinDuration === '30days'}
                      onChange={(e) => setPinDuration(e.target.value)}
                      className="text-purple-600"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">30 Days</div>
                      <div className="text-sm text-gray-500">Pin for 30 days</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="pinDuration"
                      value="custom"
                      checked={pinDuration === 'custom'}
                      onChange={(e) => setPinDuration(e.target.value)}
                      className="text-purple-600"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">Custom</div>
                      <div className="text-sm text-gray-500">Pin for custom hours</div>
                    </div>
                  </label>
                </div>
                
                {/* Custom Hours Input */}
                {pinDuration === 'custom' && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Hours
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="8760"
                      value={customHours}
                      onChange={(e) => setCustomHours(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="Enter hours (1-8760)"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Maximum: 8760 hours (1 year)
                    </p>
                  </div>
                )}
                
                {/* Message Preview */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-2">
                    {Array.isArray(messageToPin) ? 'Messages to pin:' : 'Message to pin:'}
                  </div>
                  {Array.isArray(messageToPin) ? (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {messageToPin.map((msg, index) => (
                        <div key={msg._id} className="text-sm text-gray-800 bg-white p-2 rounded border">
                          <span className="font-medium text-xs text-gray-500">#{index + 1}: </span>
                          {msg.message?.substring(0, 80)}
                          {msg.message?.length > 80 ? '...' : ''}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-800 bg-white p-2 rounded border">
                      {messageToPin.message?.substring(0, 100)}
                      {messageToPin.message?.length > 100 ? '...' : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPinModal(false);
                  setMessageToPin(null);
                  setPinDuration('24hrs');
                  setCustomHours(24);
                }}
                className="px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-medium"
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

                          
                          const response = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${msg._id}/pin`, 
                            { 
                              pinned: true, 
                              pinDuration: pinDuration, 
                              customHours: pinDuration === 'custom' ? customHours : undefined 
                            },
                            {
                              withCredentials: true,
                              headers: { 'Content-Type': 'application/json' }
                            }
                          );
                          

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
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Pinning...
                  </div>
                ) : (
                  Array.isArray(messageToPin) ? `Pin ${messageToPin.length} Messages` : 'Pin Message'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Unified Chat Media Preview (images + videos) */}
      {showChatMediaPreview && (
        <ChatMediaPreview
          isOpen={showChatMediaPreview}
          onClose={() => setShowChatMediaPreview(false)}
          media={chatMediaItems}
          initialIndex={chatMediaStartIndex}
        />
      )}

    </>
  );
}

// Payment Status Cell Component
function PaymentStatusCell({ appointment, isBuyer }) {
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
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
  }, [appointment._id, appointment.paymentConfirmed]); // Add paymentConfirmed dependency

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

  const fetchPaymentStatus = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/history?appointmentId=${appointment._id}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok && data.payments.length > 0) {
        setPaymentStatus(data.payments[0]); // Get the latest payment
        // Fetch refund request status
        await fetchRefundRequestStatus(data.payments[0].paymentId);
      }
    } catch (error) {
      console.error('Error fetching payment status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRefundRequestStatus = async (paymentId) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/refund-request-status/${paymentId}`, {
        credentials: 'include'
      });
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

  if (loading) {
    return <FaSpinner className="animate-spin text-blue-600" />;
  }

  // Determine the display status based on latest payment record only
  const getDisplayStatus = () => {
    // First check if there's a payment record
    if (!paymentStatus) {
      return { status: 'pending', text: 'Pending', color: 'bg-yellow-100 text-yellow-800' };
    }
    
    // Check if admin marked this payment
    const isAdminMarked = Boolean(paymentStatus?.metadata?.adminMarked);
    if (isAdminMarked) {
      return { status: 'admin_confirmed', text: 'Paid (Admin)', color: 'bg-green-100 text-green-800' };
    }
    
    // For sellers, hide refund-related statuses (refunded, partially_refunded, failed)
    // Only show these statuses to buyers
    if (!isBuyer && ['refunded', 'partially_refunded', 'failed'].includes(paymentStatus.status)) {
      // For sellers, show as completed/paid instead of refund statuses
      return { status: 'completed', text: 'Paid', color: 'bg-green-100 text-green-800' };
    }
    
    // For user payments, show regular payment status
    return getPaymentStatusInfo(paymentStatus.status);
  };

  const getPaymentStatusInfo = (status) => {
    switch (status) {
      case 'completed':
        return { status: 'completed', text: 'Paid', color: 'bg-green-100 text-green-800' };
      case 'pending':
        return { status: 'pending', text: 'Pending', color: 'bg-yellow-100 text-yellow-800' };
      case 'failed':
        return { status: 'failed', text: 'Failed', color: 'bg-red-100 text-red-800' };
      case 'refunded':
        return { status: 'refunded', text: 'Refunded', color: 'bg-blue-100 text-blue-800' };
      case 'partially_refunded':
        return { status: 'partially_refunded', text: 'Partial Refund', color: 'bg-orange-100 text-orange-800' };
      default:
        return { status: 'unknown', text: status, color: 'bg-gray-100 text-gray-800' };
    }
  };

  const handleRefundRequest = async (e) => {
    e.preventDefault();
    if (!paymentStatus) return;

    try {
      setSubmittingRefundRequest(true);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/refund-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
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
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/payments/refund-appeal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
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
              className="mt-1 inline-flex items-center gap-1 text-white bg-blue-600 hover:bg-blue-700 text-xs font-semibold px-3 py-1 rounded"
              onClick={() => setShowPayModal(true)}
            >
              <FaCreditCard /> Pay Now
            </button>
          ) : paymentStatus && paymentStatus.status === 'failed' && !isFrozenStatus ? (
            <button
              onClick={() => setShowPayModal(true)}
              className="mt-1 inline-flex items-center gap-1 text-white bg-red-600 hover:bg-red-700 text-xs font-semibold px-3 py-1 rounded"
            >
              <FaCreditCard /> Retry Payment
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
                  href={paymentStatus.receiptUrl}
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
          onClose={() => setShowPayModal(false)}
          appointment={{ ...appointment, region: 'india' }}
          onPaymentSuccess={(payment) => {
            setShowPayModal(false);
            fetchPaymentStatus();
          }}
        />
      )}

      {/* Refund Request Modal */}
      {showRefundRequestModal && paymentStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <FaUndo className="text-orange-600" />
                  Request Refund
                </h3>
                <button
                  onClick={() => setShowRefundRequestModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FaTimes className="text-xl" />
                </button>
              </div>
            </div>

            <form onSubmit={handleRefundRequest} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Details
                </label>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Property:</span>
                    <span className="font-medium">{appointment.propertyName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-medium">
                      {paymentStatus.currency === 'INR' ? '₹' : '$'}{paymentStatus.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Payment ID:</span>
                    <span className="font-mono text-sm">{paymentStatus.paymentId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Appointment Status:</span>
                    <span className="font-medium capitalize">{appointment.status.replace(/([A-Z])/g, ' $1').trim()}</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    Full Refund ({paymentStatus.currency === 'INR' ? '₹' : '$'}{paymentStatus.amount.toLocaleString()})
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
                    Partial Refund
                  </label>
                </div>
              </div>

              {refundRequestForm.type === 'partial' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Refund Reason
                </label>
                <textarea
                  value={refundRequestForm.reason}
                  onChange={(e) => setRefundRequestForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Please explain why you need a refund..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRefundRequestModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
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
                      <FaSpinner className="animate-spin" />
                      Submitting...
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
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <FaUndo className="text-purple-600" />
                  Submit Appeal
                </h3>
                <button
                  onClick={() => setShowAppealModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FaTimes className="text-xl" />
                </button>
              </div>
            </div>

            <form onSubmit={handleAppealSubmit} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Refund Request Details
                </label>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Property:</span>
                    <span className="font-medium">{appointment.propertyName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Original Reason:</span>
                    <span className="font-medium text-sm">{refundRequestStatus.reason}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Requested Amount:</span>
                    <span className="font-medium">
                      {paymentStatus.currency === 'INR' ? '₹' : '$'}{refundRequestStatus.requestedAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Status:</span>
                    <span className="font-medium text-red-600 capitalize">{refundRequestStatus.status}</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Appeal Reason
                </label>
                <select
                  value={appealForm.reason}
                  onChange={(e) => setAppealForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Select a reason for your appeal</option>
                  <option value="Additional evidence">Additional evidence provided</option>
                  <option value="Misunderstanding">Misunderstanding of the situation</option>
                  <option value="New information">New information has come to light</option>
                  <option value="Service quality">Service quality issues</option>
                  <option value="Technical problems">Technical problems encountered</option>
                  <option value="Other">Other (please explain in detail)</option>
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Appeal Details
                </label>
                <textarea
                  value={appealForm.text}
                  onChange={(e) => setAppealForm(prev => ({ ...prev, text: e.target.value }))}
                  placeholder="Please provide detailed information about why you believe your refund request should be reconsidered..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows="4"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAppealModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
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
                      <FaSpinner className="animate-spin" />
                      Submitting...
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
    </div>
  );
}
