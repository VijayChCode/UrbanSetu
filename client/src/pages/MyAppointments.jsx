import React, { useEffect, useState, useRef, useCallback } from "react";
import { FaTrash, FaSearch, FaPen, FaCheck, FaTimes, FaUserShield, FaUser, FaEnvelope, FaPhone, FaArchive, FaUndo, FaCommentDots, FaCheckDouble, FaBan, FaPaperPlane, FaCalendar, FaLightbulb, FaCopy, FaEllipsisV, FaFlag, FaCircle, FaInfoCircle, FaSync, FaStar, FaRegStar, FaThumbtack, FaCalendarAlt } from "react-icons/fa";
import UserAvatar from '../components/UserAvatar';
import ImagePreview from '../components/ImagePreview';
import { EmojiButton } from '../components/EmojiPicker';
import { useSelector } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Appointment from "../components/Appointment";
import { toast, ToastContainer } from 'react-toastify';
import { socket } from "../utils/socket";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function MyAppointments() {
  const { currentUser } = useSelector((state) => state.user);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState("");
  const [showOtherPartyModal, setShowOtherPartyModal] = useState(false);
  const [selectedOtherParty, setSelectedOtherParty] = useState(null);
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
        const res = await fetch(`${API_BASE_URL}/api/bookings/my`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setAppointments(data);
        } else {
          throw new Error("Failed to fetch appointments");
        }
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
          const res = await fetch(`${API_BASE_URL}/api/bookings/archived`, {
            credentials: 'include'
          });
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
  }, [currentUser]);

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
    socket.on('appointmentUpdate', handleAppointmentUpdate);
    return () => {
      socket.off('appointmentUpdate', handleAppointmentUpdate);
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

  const handleStatusUpdate = async (id, status) => {
    setActionLoading(id + status);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.status === 401) {
        toast.error("Session expired or unauthorized. Please sign in again.");
        navigate("/sign-in");
        return;
      }
      if (res.ok) {
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
      } else {
        toast.error(data.message || "Failed to update appointment status.");
      }
    } catch (err) {
      toast.error("An error occurred. Please try again.");
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
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appointmentToHandle}`, { 
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ reason: deleteReason }),
      });
      const data = await res.json();
      if (res.status === 401) {
        toast.error("Session expired or unauthorized. Please sign in again.");
        navigate("/sign-in");
        return;
      }
      if (res.ok) {
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
      } else {
        toast.error(data.message || "Failed to delete appointment.");
      }
      setShowDeleteAppointmentModal(false);
      setAppointmentToHandle(null);
      setDeleteReason('');
    } catch (err) {
      toast.error("An error occurred. Please try again.");
    }
  };

  const handleArchiveAppointment = async (id) => {
    setAppointmentToHandle(id);
    setShowArchiveModal(true);
  };

  const confirmArchive = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appointmentToHandle}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
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
      } else {
        toast.error(data.message || "Failed to archive appointment.");
      }
      setShowArchiveModal(false);
      setAppointmentToHandle(null);
    } catch (err) {
      toast.error("An error occurred. Please try again.");
    }
  };

  const handleUnarchiveAppointment = async (id) => {
    setAppointmentToHandle(id);
    setShowUnarchiveModal(true);
  };

  const confirmUnarchive = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appointmentToHandle}/unarchive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
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
      } else {
        toast.error(data.message || "Failed to unarchive appointment.");
      }
      setShowUnarchiveModal(false);
      setAppointmentToHandle(null);
    } catch (err) {
      toast.error("An error occurred. Please try again.");
    }
  };

  // Filter appointments by status, role, search, and date range
  const filteredAppointments = appointments.filter((appt) => {
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
      appt.message?.toLowerCase().includes(search.toLowerCase()) ||
      appt.buyerId?.username?.toLowerCase().includes(search.toLowerCase()) ||
      appt.sellerId?.username?.toLowerCase().includes(search.toLowerCase());
    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && new Date(appt.date) >= new Date(startDate);
    }
    if (endDate) {
      matchesDate = matchesDate && new Date(appt.date) <= new Date(endDate);
    }
    return matchesStatus && matchesRole && matchesSearch && matchesDate;
  });

  // Defensive: ensure archivedAppointments is always an array
  const filteredArchivedAppointments = Array.isArray(archivedAppointments) ? archivedAppointments.filter((appt) => {
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
    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && new Date(appt.date) >= new Date(startDate);
    }
    if (endDate) {
      matchesDate = matchesDate && new Date(appt.date) <= new Date(endDate);
    }
    return matchesStatus && matchesRole && matchesSearch && matchesDate;
  }) : [];

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
      const res = await fetch(`${API_BASE_URL}/api/bookings/reinitiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
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
      } else {
        toast.error(data.message || 'Failed to reinitiate appointment.');
      }
    } catch (err) {
      toast.error('An error occurred. Please try again.');
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
      const res = await fetch(`${API_BASE_URL}/api/bookings/my`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAppointments(data);
      } else {
        throw new Error('Failed to fetch appointments');
      }
      // Fetch archived appointments for all users
      if (currentUser) {
        const resArchived = await fetch(`${API_BASE_URL}/api/bookings/archived`, { credentials: 'include' });
        if (resArchived.ok) {
          const dataArchived = await resArchived.json();
          setArchivedAppointments(Array.isArray(dataArchived) ? dataArchived : []);
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

      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
          <div>
            <h3 className="text-2xl md:text-3xl font-extrabold text-blue-700 drop-shadow">
              {showArchived ? `Archived Appointments (${filteredArchivedAppointments.length})` : `My Appointments (${filteredAppointments.length})`}
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
              onClick={() => setShowArchived(!showArchived)}
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
                      onShowOtherParty={party => { setSelectedOtherParty(party); setShowOtherPartyModal(true); }}
                      onOpenReinitiate={() => handleOpenReinitiate(appt)}
                      handleArchiveAppointment={handleArchiveAppointment}
                      handleUnarchiveAppointment={handleUnarchiveAppointment}
                      isArchived={true}
                      onCancelRefresh={handleCancelRefresh}
                      copyMessageToClipboard={copyMessageToClipboard}
                    />
                  ))}
                </tbody>
              </table>
          </div>
          )
        ) : (
          filteredAppointments.length === 0 ? (
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
                  <th className="border p-2">Actions</th>
                  <th className="border p-2">Connect</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((appt) => (
                  <AppointmentRow 
                    key={appt._id} 
                    appt={appt} 
                    currentUser={currentUser} 
                    handleStatusUpdate={handleStatusUpdate}
                    handleAdminDelete={handleAdminDelete}
                    actionLoading={actionLoading}
                    onShowOtherParty={party => { setSelectedOtherParty(party); setShowOtherPartyModal(true); }}
                    onOpenReinitiate={() => handleOpenReinitiate(appt)}
                      handleArchiveAppointment={handleArchiveAppointment}
                      handleUnarchiveAppointment={handleUnarchiveAppointment}
                      isArchived={false}
                      onCancelRefresh={handleCancelRefresh}
                      copyMessageToClipboard={copyMessageToClipboard}
                  />
                ))}
              </tbody>
            </table>
          </div>
          )
        )}
      {/* Other Party Details Modal - Enhanced Design */}
      {showOtherPartyModal && selectedOtherParty && (
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
                    {selectedOtherParty.isTyping ? (
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
                    {selectedOtherParty.role || 'User'}
                  </p>
                  {/* Status text below role */}
                  {selectedOtherParty.isTyping ? (
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
      )}
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
                  <label className="block font-semibold mb-1">Message</label>
                  <textarea className="border rounded px-2 py-1 w-full" value={reinitiateData.message} onChange={e => setReinitiateData(d => ({ ...d, message: e.target.value }))} required />
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

function AppointmentRow({ appt, currentUser, handleStatusUpdate, handleAdminDelete, actionLoading, onShowOtherParty, onOpenReinitiate, handleArchiveAppointment, handleUnarchiveAppointment, isArchived, onCancelRefresh, copyMessageToClipboard }) {
  const [replyTo, setReplyTo] = useState(null);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState(appt.comments || []);
  const [sending, setSending] = useState(false);
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState("");
  const [savingComment, setSavingComment] = useState(null);
  const location = useLocation();
  const [showChatModal, setShowChatModal] = useState(false);
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadNewMessages, setUnreadNewMessages] = useState(0);
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [visibleActionsMessageId, setVisibleActionsMessageId] = useState(null);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [deleteForBoth, setDeleteForBoth] = useState(true);
  const [showClearChatModal, setShowClearChatModal] = useState(false);
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
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showChatLockModal, showChatUnlockModal, showForgotPasswordModal, showRemoveLockModal]);
  
  // Store appointment and reasons for modals
  const [appointmentToHandle, setAppointmentToHandle] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const messageRefs = useRef({}); // Add messageRefs here
  
  // New: track which message's options are shown in the header
  const [headerOptionsMessageId, setHeaderOptionsMessageId] = useState(null);
  const [privacyNoticeHighlighted, setPrivacyNoticeHighlighted] = useState(false);
  const [showHeaderMoreMenu, setShowHeaderMoreMenu] = useState(false);
  
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
  const [selectedFile, setSelectedFile] = useState(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImages, setPreviewImages] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [imageCaption, setImageCaption] = useState('');
  const [showImagePreviewModal, setShowImagePreviewModal] = useState(false);



  // File upload handler
  const handleFileUpload = async (file) => {
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setFileUploadError('Please select an image file');
      // Auto-hide error message after 3 seconds
      setTimeout(() => setFileUploadError(''), 3000);
      return;
    }
    
    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setFileUploadError('File size must be less than 5MB');
      // Auto-hide error message after 3 seconds
      setTimeout(() => setFileUploadError(''), 3000);
      return;
    }
    
    // Show preview with caption input instead of directly sending
    setSelectedFile(file);
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
      message: caption || `📷 ${fileName}`,
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
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ 
          message: caption || `📷 ${fileName}`,
          imageUrl: imageUrl,
          type: "image"
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Find the new comment from the response
        const newComment = data.comments[data.comments.length - 1];
        
        // Replace the temp message with the real one
        setComments(prev => prev.map(msg => 
          msg._id === tempId 
            ? { ...newComment }
            : msg
        ));
      } else {
        // Remove the temp message and show error
        setComments(prev => prev.filter(msg => msg._id !== tempId));
        toast.error(data.message || "Failed to send image.");
      }
    } catch (error) {
      console.error('Send image error:', error);
      setComments(prev => prev.filter(msg => msg._id !== tempId));
      toast.error("Failed to send image.");
    }
  };

  const handleSendImageWithCaption = async () => {
    if (!selectedFile) return;
    
    setUploadingFile(true);
    
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('image', selectedFile);
      
      const res = await fetch(`${API_BASE_URL}/api/upload/image`, {
        method: 'POST',
        credentials: 'include',
        body: uploadFormData,
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Send the image as a message with caption
        await sendImageMessage(data.imageUrl, selectedFile.name, imageCaption);
        setSelectedFile(null);
        setImageCaption('');
        setShowImagePreviewModal(false);
      } else {
        setFileUploadError(data.message || 'Upload failed');
        toast.error(data.message || 'Upload failed');
        // Auto-hide error message after 3 seconds
        setTimeout(() => setFileUploadError(''), 3000);
      }
    } catch (error) {
      console.error('File upload error:', error);
      setFileUploadError('Upload failed. Please try again.');
      toast.error('Upload failed. Please try again.');
      // Auto-hide error message after 3 seconds
      setTimeout(() => setFileUploadError(''), 3000);
    } finally {
      setUploadingFile(false);
    }
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
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/lock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: lockPassword })
      });
      
      const data = await res.json();
      if (res.ok) {
        setChatLocked(true);
        setChatAccessGranted(false);
        setShowChatLockModal(false);
        setLockPassword('');
        setLockConfirmPassword('');
        toast.success('Chat locked successfully.');
      } else {
        toast.error(data.message || 'Failed to lock chat');
      }
    } catch (err) {
      toast.error('An error occurred while locking chat');
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
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/unlock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: unlockPassword })
      });
      
      const data = await res.json();
      if (res.ok) {
        setChatAccessGranted(true);
        setShowChatUnlockModal(false);
        setUnlockPassword('');
        toast.success('Chat access granted.');
        // Open chat modal after successful unlock
        setShowChatModal(true);
      } else {
        toast.error(data.message || 'Incorrect password');
      }
    } catch (err) {
      toast.error('An error occurred while unlocking chat');
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
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/remove-lock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: unlockPassword })
      });
      
      const data = await res.json();
      if (res.ok) {
        setChatLocked(false);
        setChatAccessGranted(false);
        setShowChatUnlockModal(false);
        setUnlockPassword('');
        toast.success('Chat lock removed successfully.');
      } else {
        toast.error(data.message || 'Incorrect password');
      }
    } catch (err) {
      toast.error('An error occurred while removing chat lock');
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
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/remove-lock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: removeLockPassword })
      });
      
      const data = await res.json();
      if (res.ok) {
        setChatLocked(false);
        setChatAccessGranted(false);
        setShowRemoveLockModal(false);
        setRemoveLockPassword('');
        setShowRemoveLockPassword(false);
        toast.success('Chat lock removed.');
      } else {
        toast.error(data.message || 'Incorrect password');
      }
    } catch (err) {
      toast.error('An error occurred while removing chat lock');
    } finally {
      setRemovingLock(false);
    }
  };

  const handleForgotPassword = async () => {
    setForgotPasswordProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/forgot-password`, {
        method: 'PATCH',
        credentials: 'include'
      });
      
      const data = await res.json();
      if (res.ok) {
        setChatLocked(false);
        setChatAccessGranted(false);
        setShowForgotPasswordModal(false);
        setComments([]); // Clear chat messages locally
        toast.success('Chat lock removed and cleared successfully.');
      } else {
        toast.error(data.message || 'Failed to reset chat');
      }
    } catch (err) {
      toast.error('An error occurred while resetting chat');
    } finally {
      setForgotPasswordProcessing(false);
    }
  };

  // Reset chat access when chat modal is closed
  const handleChatModalClose = async () => {
    setShowChatModal(false);
    
    // Reset chat access if it was temporarily granted
    if (chatLocked && chatAccessGranted) {
      try {
        await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/reset-access`, {
          method: 'PATCH',
          credentials: 'include'
        });
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
        const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/lock-status`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setChatLocked(data.chatLocked);
          setChatAccessGranted(data.accessGranted);
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
      console.log('Initializing pinned messages:', { 
        totalComments: comments.length, 
        pinnedCount: pinnedMsgs.length,
        pinnedMsgs: pinnedMsgs.map(m => ({ id: m._id, message: m.message?.substring(0, 30), pinned: m.pinned, pinExpiresAt: m.pinExpiresAt }))
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

  // Fetch starred messages when modal opens
  useEffect(() => {
    if (showStarredModal) {
      setLoadingStarredMessages(true);
      // Fetch starred messages from backend
      fetch(`${API_BASE_URL}/api/bookings/${appt._id}/starred-messages`, {
        credentials: 'include'
      })
        .then(res => res.json())
        .then(data => {
          if (data.starredMessages) {
            setStarredMessages(data.starredMessages);
          }
        })
        .catch(err => {
          console.error('Error fetching starred messages:', err);
          toast.error('Failed to load starred messages');
        })
        .finally(() => {
          setLoadingStarredMessages(false);
        });
    }
  }, [showStarredModal, appt._id]);

  // Close chat options menu when clicking outside or scrolling
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showChatOptionsMenu && !event.target.closest('.chat-options-menu')) {
        setShowChatOptionsMenu(false);
      }
      if (showHeaderMoreMenu && !event.target.closest('.chat-options-menu')) {
        setShowHeaderMoreMenu(false);
      }
    };

    const handleScroll = () => {
      if (showChatOptionsMenu) {
        setShowChatOptionsMenu(false);
      }
      if (showHeaderMoreMenu) {
        setShowHeaderMoreMenu(false);
      }
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
  }, [showChatOptionsMenu, showHeaderMoreMenu, showSearchBox, showCalendar]);

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

  // Fetch latest comments when refresh button is clicked
  const fetchLatestComments = async () => {
    try {
      setLoadingComments(true);
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.comments && data.comments.length !== comments.length) {
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
        }
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
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/pinned-messages`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Fetched pinned messages from API:', data);
        setPinnedMessages(data.pinnedMessages || []);
      } else {
        toast.error('Failed to fetch pinned messages');
      }
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
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${message._id}/pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          pinned, 
          pinDuration: duration, 
          customHours: duration === 'custom' ? customHrs : undefined 
        }),
      });
      
      if (res.ok) {
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
          console.log('Adding pinned message:', { 
            messageId: pinnedMsg._id, 
            pinExpiresAt: pinnedMsg.pinExpiresAt,
            pinDuration: duration,
            apiResponse: data
          });
          setPinnedMessages(prev => {
            const newPinned = [...prev, pinnedMsg];
            console.log('Updated pinned messages:', newPinned.length);
            return newPinned;
          });
        } else {
          // Remove from pinned messages
          setPinnedMessages(prev => prev.filter(m => m._id !== message._id));
        }
        
        toast.success(data.message);
        setShowPinModal(false);
        setMessageToPin(null);
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || 'Failed to update pin status');
      }
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
  
  // Check if chat should be disabled (for outdated, pending, rejected, or cancelled by admin appointments)
  const isChatDisabled = !isUpcoming || appt.status === 'pending' || appt.status === 'rejected' || appt.status === 'cancelledByAdmin';
  
  const canSeeContactInfo = (isAdmin || appt.status === 'accepted') && isUpcoming && 
    appt.status !== 'cancelledByBuyer' && appt.status !== 'cancelledBySeller' && 
    appt.status !== 'cancelledByAdmin' && appt.status !== 'rejected' && 
    appt.status !== 'deletedByAdmin';
  const otherParty = isSeller ? appt.buyerId : appt.sellerId;

  // Handle delete confirmation modal
  const handleDeleteClick = (message) => {
    setMessageToDelete(message);
    setDeleteForBoth(true); // Default to delete for both
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
      if (deleteForBoth) {
        // Check if the message was unread by current user before deleting
        const wasUnread = !messageToDelete.readBy?.includes(currentUser._id) && 
                         messageToDelete.senderEmail !== currentUser.email;
        
        // Delete for both users (existing logic)
        const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${messageToDelete._id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
          setComments(prev => data.comments.map(newC => {
            const localC = prev.find(lc => lc._id === newC._id);
            if (localC && localC.status === 'read' && newC.status !== 'read') {
              return { ...newC, status: 'read' };
            }
            return newC;
          }));
          
          // Reduce unread count if the deleted message was unread
          if (wasUnread) {
            setUnreadNewMessages(prev => Math.max(0, prev - 1));
          }
          
          toast.success("Message deleted for everyone!");
        } else {
          toast.error(data.message || 'Failed to delete message.');
        }
      } else {
        // Delete locally only (persist server-side for this account)
        try {
          await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${messageToDelete._id}/remove-for-me`, {
            method: 'PATCH',
            credentials: 'include'
          });
        } catch {}
        setComments(prev => prev.filter(msg => msg._id !== messageToDelete._id));
        addLocallyRemovedId(appt._id, messageToDelete._id);
        toast.success("Message deleted for you!");
      }
    } catch (err) {
      toast.error('An error occurred. Please try again.');
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
      await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/chat/clear-local`, {
        method: 'PATCH',
        credentials: 'include'
      });

      toast.success("Chat Cleared.");
    } catch (err) {
      console.error('Failed to persist chat clear:', err);
      toast.error('Cleared locally, but failed to sync with server.');
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
      ...(replyToData ? { replyTo: replyToData._id } : {}),
    };

    // Immediately update UI - this makes the message appear instantly
    setComments(prev => [...prev, tempMessage]);
    setComment("");
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
        const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: 'include',
          body: JSON.stringify({ 
            message: messageContent, 
            ...(replyToData ? { replyTo: replyToData._id } : {}) 
          }),
        });
        
        const data = await res.json();
        
        if (res.ok) {
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
        } else {
          // Remove the temp message and show error
          setComments(prev => prev.filter(msg => msg._id !== tempId));
          toast.error(data.message || "Failed to send message.");
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
      } catch (err) {
        // Remove the temp message and show error
        setComments(prev => prev.filter(msg => msg._id !== tempId));
        toast.error('An error occurred. Please try again.');
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
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ message: editText }),
      });
      const data = await res.json();
      if (res.ok) {
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
        setComment(""); // Clear the main input
        // Reset textarea height to normal after editing
        resetTextareaHeight();
        
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
        
        toast.success("Message edited successfully!");
      } else {
        // Revert optimistic update on error
        setComments(prev => prev.map(c => 
          c._id === commentId 
            ? { ...c, message: c.originalMessage || c.message, edited: c.wasEdited || false }
            : c
        ));
        setEditingComment(commentId);
        setEditText(editText);
        setComment(editText); // Restore the text in main input for retry
        toast.error(data.message || "Failed to edit message.");
      }
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
      toast.error('An error occurred. Please try again.');
    } finally {
      setSavingComment(null);
    }
  };

  const startEditing = (comment) => {
    setEditingComment(comment._id);
    setEditText(comment.message);
    setComment(comment.message); // Set the message in the main input
    // Store original data for potential rollback
    setComments(prev => prev.map(c => 
      c._id === comment._id 
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
        inputRef.current.style.height = '48px';
        const scrollHeight = inputRef.current.scrollHeight;
        const maxHeight = 144;
        inputRef.current.style.height = Math.min(scrollHeight, maxHeight) + 'px';
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

  // Search functionality
  const performSearch = (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      // Clear any existing search highlights
      document.querySelectorAll('.search-highlight').forEach(el => {
        el.classList.remove('search-highlight', 'search-pulse', 'search-glow');
      });
      return;
    }
    
    const results = comments
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
    
    // Find the first message from the selected date
    const targetDate = new Date(date);
    const targetDateString = targetDate.toDateString();
    
    const firstMessageOfDate = comments.find(comment => {
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
      toast.info('No messages found for the selected date', {
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
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: cancelReason }),
      });
      const data = await res.json();
      if (res.status === 401) {
        toast.error('Session expired or unauthorized. Please sign in again.');
        navigate('/sign-in');
        return;
      }
      if (res.ok) {
        toast.success('Appointment cancelled successfully.');
        if (typeof onCancelRefresh === 'function') onCancelRefresh(appt._id, isSeller ? 'cancelledBySeller' : 'cancelledByBuyer');
      } else {
        toast.error(data.message || 'Failed to cancel appointment.');
      }
      setShowCancelModal(false);
      setCancelReason('');
    } catch (err) {
      toast.error('An error occurred. Please try again.');
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
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: cancelReason }),
      });
      const data = await res.json();
      if (res.status === 401) {
        toast.error('Session expired or unauthorized. Please sign in again.');
        navigate('/sign-in');
        return;
      }
      if (res.ok) {
        toast.success('Appointment cancelled by admin.');
        navigate('/user/my-appointments');
      } else {
        toast.error(data.message || 'Failed to cancel appointment.');
      }
      setShowAdminCancelModal(false);
      setCancelReason('');
    } catch (err) {
      toast.error('An error occurred. Please try again.');
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
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/soft-delete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ who }),
      });
      if (res.ok) {
        // Remove from UI immediately
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('removeAppointmentRow', { detail: appt._id });
          window.dispatchEvent(event);
          toast.success("Appointment removed from your table successfully.");
        }
      } else {
        toast.error('Failed to remove appointment from table.');
      }
      setShowPermanentDeleteModal(false);
    } catch (err) {
      toast.error('An error occurred. Please try again.');
    }
  };

  // Auto-scroll to bottom only when chat modal opens or when user is at bottom
  useEffect(() => {
    if (showChatModal && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showChatModal]);

  // Mark messages as read when user can actually see them at the bottom of chat

  const markingReadRef = useRef(false);
  
  const markVisibleMessagesAsRead = useCallback(async () => {
    if (!chatContainerRef.current || markingReadRef.current) return;
    
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
        const response = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/read`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        
        if (response.ok) {
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
          
          console.log(`Marked ${unreadMessages.length} messages as read for user ${currentUser._id}`);
          
          // Update unreadNewMessages to reflect the actual unread count
          setUnreadNewMessages(prev => Math.max(0, prev - unreadMessages.length));
        }
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
          console.log(`User manually scrolled to bottom, marking ${unreadCount} messages as read`);
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
        
        // Check if scrolled to top for privacy notice highlighting (mobile only)
        if (chatContainer && isMobile) {
          const { scrollTop } = chatContainer;
          if (scrollTop < 50) { // Near the top
            setPrivacyNoticeHighlighted(true);
            // Reset highlight after 3 seconds
            setTimeout(() => setPrivacyNoticeHighlighted(false), 3000);
          }
        }
        
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

  // Toast notification for new messages when chat is closed
  useEffect(() => {
    function handleCommentUpdateNotify(data) {
      if (data.appointmentId === appt._id && !showChatModal) {
        // Don't show notification for deleted messages
        if (data.comment.deleted) {
          return;
        }
        
        // Check if sender is admin by checking if senderEmail matches any admin user
        const isSenderBuyer = data.comment.senderEmail === appt.buyerId?.email;
        const isSenderSeller = data.comment.senderEmail === appt.sellerId?.email;
        const isSenderAdmin = !isSenderBuyer && !isSenderSeller;
        
        const senderName = isSenderAdmin ? "UrbanSetu" : (data.comment.senderEmail || 'User');
        toast.info(`New message from ${senderName}`);
      }
    }
    socket.on('commentUpdate', handleCommentUpdateNotify);
    return () => {
      socket.off('commentUpdate', handleCommentUpdateNotify);
    };
  }, [appt._id, showChatModal]);

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
  }, [appt._id, currentUser.email, currentUser._id, showChatModal]);

  // Mark all comments as read when chat modal opens and fetch latest if needed
  useEffect(() => {
    if (showChatModal) {
      // Mark comments as read immediately
      fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/read`, {
        method: 'PATCH',
        credentials: 'include'
      }).catch(error => {
        console.warn('Error marking comments as read on modal open:', error);
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
    
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === 'f') {
        event.preventDefault(); // Prevent browser find dialog
        inputRef.current?.focus();
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
                })}
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
        <td className="border p-2 max-w-xs truncate">{appt.message}</td>
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
                        <button
                          className="text-green-500 hover:text-green-700 text-xl disabled:opacity-50"
                          onClick={() => handleStatusUpdate(appt._id, "accepted")}
                          disabled={actionLoading === appt._id + "accepted"}
                          title="Accept Appointment"
                        >
                          <FaCheck />
                        </button>
                        <button
                          className="text-red-500 hover:text-red-700 text-xl disabled:opacity-50"
                          onClick={() => handleStatusUpdate(appt._id, "rejected")}
                          disabled={actionLoading === appt._id + "rejected"}
                          title="Reject Appointment"
                        >
                          <FaTimes />
                        </button>
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
              isChatDisabled 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50' 
                : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white hover:shadow-xl hover:scale-105'
            }`}
            title={isChatDisabled ? (
              !isUpcoming 
                ? "Chat not available for outdated appointments" 
                : appt.status === 'pending'
                  ? "Chat not available for pending appointments"
                  : appt.status === 'rejected'
                    ? "Chat not available for rejected appointments"
                    : "Chat not available for appointments cancelled by admin"
            ) : "Open Chat"}
            onClick={isChatDisabled ? undefined : () => {
              if ((chatLocked || chatLockStatusLoading) && !chatAccessGranted) {
                setShowChatUnlockModal(true);
              } else {
                setShowChatModal(true);
              }
            }}
            disabled={isChatDisabled}
          >
            <FaCommentDots size={22} className={!isChatDisabled ? "group-hover:animate-pulse" : ""} />
            {!isChatDisabled && (
              <div className="absolute inset-0 bg-white rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
            )}
            {/* Show lock icon if chat is locked or loading */}
            {(chatLocked || chatLockStatusLoading) && !chatAccessGranted && !isChatDisabled && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold border-2 border-white">
                {chatLockStatusLoading ? '⏳' : '🔒'}
              </span>
            )}
            {/* Typing indicator - highest priority (hide if locked or loading) */}
            {isOtherPartyTyping && !isChatDisabled && !((chatLocked || chatLockStatusLoading) && !chatAccessGranted) && (
              <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold border-2 border-white animate-pulse">
                ...
              </span>
            )}
            {/* Unread count when not typing (hide if locked or loading) */}
            {!isOtherPartyTyping && unreadNewMessages > 0 && isChatDisabled && !((chatLocked || chatLockStatusLoading) && !chatAccessGranted) && (
              <span className="absolute -top-1 -right-1 bg-gray-400 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold border-2 border-white">
                {unreadNewMessages}
              </span>
            )}
            {!isOtherPartyTyping && unreadNewMessages > 0 && !isChatDisabled && !((chatLocked || chatLockStatusLoading) && !chatAccessGranted) && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold border-2 border-white">
                {unreadNewMessages}
              </span>
            )}
            {/* Online status green dot - show when no typing and no unread count (hide if locked or loading) */}
            {!isOtherPartyTyping && unreadNewMessages === 0 && isOtherPartyOnlineInTable && !isChatDisabled && !((chatLocked || chatLockStatusLoading) && !chatAccessGranted) && (
              <span className="absolute -top-1 -right-1 bg-green-500 border-2 border-white rounded-full w-3 h-3"></span>
            )}
          </button>
        </td>
      </tr>
      {showChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-white via-blue-50 to-purple-50 rounded-3xl shadow-2xl w-full h-full max-w-6xl max-h-full p-0 relative animate-fadeIn flex flex-col border border-gray-200 transform transition-all duration-500 hover:shadow-3xl overflow-hidden">
            { isChatDisabled ? (
              <div className="flex flex-col items-center justify-center flex-1 p-8 min-h-96">
                <FaCommentDots className="text-6xl text-gray-400 mb-6" />
                <div className="text-xl font-semibold text-gray-500 text-center">
                  {!isUpcoming 
                    ? "Chat not available for outdated appointments"
                    : appt.status === 'pending'
                      ? "Chat not available for pending appointments"
                      : appt.status === 'rejected'
                        ? "Chat not available for rejected appointments"
                        : "Chat not available for appointments cancelled by admin"
                  }
                </div>
                <div className="text-gray-400 text-center mt-2">
                  {!isUpcoming 
                    ? "This appointment has already passed"
                    : appt.status === 'pending'
                      ? "Chat will be enabled once the appointment is accepted"
                      : appt.status === 'rejected'
                        ? "This appointment has been rejected"
                        : "This appointment has been cancelled by admin"
                  }
                </div>
              </div>
            ) : (
              <>
                {/* Chat Header (sticky on mobile to avoid URL bar overlap) */}
                <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b-2 border-blue-700 bg-gradient-to-r from-blue-700 via-purple-700 to-blue-900 rounded-t-3xl relative shadow-2xl flex-shrink-0 md:sticky md:top-0 sticky top-[env(safe-area-inset-top,0px)] z-30">
                  {headerOptionsMessageId && selectedMessageForHeaderOptions ? (
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
                                const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${selectedMessageForHeaderOptions._id}/star`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ starred: !isStarred }),
                                });
                                if (res.ok) {
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
                                } else {
                                  toast.error('Failed to update star status');
                                }
                              } catch (err) {
                                toast.error('Failed to update star status');
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
                            className="text-white hover:text-red-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            onClick={() => { 
                              if (selectedMessageForHeaderOptions.senderEmail === currentUser.email) {
                                handleDeleteClick(selectedMessageForHeaderOptions);
                              } else {
                                handleDeleteReceivedMessage(selectedMessageForHeaderOptions);
                              }
                              setHeaderOptionsMessageId(null);
                            }}
                            title="Delete"
                            aria-label="Delete"
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
                                    <button
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                      onClick={() => { showMessageInfo(selectedMessageForHeaderOptions); setShowHeaderMoreMenu(false); setHeaderOptionsMessageId(null); }}
                                    >
                                      <FaInfoCircle className="text-sm" />
                                      Info
                                    </button>
                                    <button
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                      onClick={() => {
                                        if (selectedMessageForHeaderOptions.pinned) {
                                          handlePinMessage(selectedMessageForHeaderOptions, false);
                                        } else {
                                          setMessageToPin(selectedMessageForHeaderOptions);
                                          setShowPinModal(true);
                                        }
                                        setShowHeaderMoreMenu(false);
                                        setHeaderOptionsMessageId(null);
                                      }}
                                      disabled={pinningSaving}
                                    >
                                      <FaThumbtack className="text-sm" />
                                      {selectedMessageForHeaderOptions.pinned ? 'Unpin' : 'Pin'}
                                    </button>
                                    <button
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                      onClick={() => { startEditing(selectedMessageForHeaderOptions); setShowHeaderMoreMenu(false); setHeaderOptionsMessageId(null); }}
                                      disabled={editingComment !== null}
                                    >
                                      <FaPen className="text-sm" />
                                      Edit
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                      onClick={() => {
                                        if (selectedMessageForHeaderOptions.pinned) {
                                          handlePinMessage(selectedMessageForHeaderOptions, false);
                                        } else {
                                          setMessageToPin(selectedMessageForHeaderOptions);
                                          setShowPinModal(true);
                                        }
                                        setShowHeaderMoreMenu(false);
                                        setHeaderOptionsMessageId(null);
                                      }}
                                      disabled={pinningSaving}
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
                        })}
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
                            })}
                            title="Click to view user details"
                          >
                            {otherParty?.username || 'Unknown User'}
                          </h3>
                          {/* Online status indicator - below name on mobile, inline on desktop */}
                          <div className={`flex items-center gap-1 sm:hidden ${(chatLocked || chatLockStatusLoading) ? 'max-w-[120px]' : ''}`}>
                            {isOtherPartyTyping ? (
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
                            {isOtherPartyTyping ? (
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
                        <div className="relative">
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
                              {/* Contact Information option */}
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                                onClick={() => {
                                  onShowOtherParty({
                                    ...otherParty,
                                    isOnline: isOtherPartyOnlineInTable,
                                    isTyping: isOtherPartyTyping,
                                    lastSeen: otherPartyLastSeenInTable
                                  });
                                  setShowChatOptionsMenu(false);
                                }}
                              >
                                <FaInfoCircle className="text-sm" />
                                Contact Information
                              </button>
                              {/* Refresh option */}
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                onClick={() => {
                                  fetchLatestComments();
                                  setShowChatOptionsMenu(false);
                                }}
                                disabled={loadingComments}
                              >
                                <FaSync className={`text-sm ${loadingComments ? 'animate-spin' : ''}`} />
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
                          <div className="absolute top-full right-0 mt-2 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-20 max-w-xs">
                            <div className="font-semibold mb-2">⌨️ Keyboard Shortcuts:</div>
                            <div className="mb-2">• Press Ctrl + F to quickly focus and type your message</div>
                            <div className="border-t border-gray-600 pt-2 mt-2">
                              <div className="font-semibold mb-2">📎 File Upload Guidelines:</div>
                              <div>• Images only (JPG, PNG, GIF, WebP)</div>
                              <div>• Maximum size: 5MB per file</div>
                              <div>• Add captions to images</div>
                              <div>• Other file types coming soon</div>
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
                  <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-2 px-4 pt-4 animate-fadeInChat relative bg-gradient-to-b from-transparent to-blue-50/30">
                  {/* Privacy Notice - First item in chat */}
                  <div 
                    className={`px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-400 rounded-r-lg mb-4 transform transition-all duration-500 hover:scale-105 hover:shadow-lg hover:from-blue-100 hover:to-purple-100 hover:border-blue-500 hover:border-l-6 backdrop-blur-sm ${
                      isMobile && privacyNoticeHighlighted ? 'animate-attentionGlow shadow-lg border-blue-500 bg-gradient-to-r from-blue-100 to-purple-100 scale-105' : 
                      isMobile && isAtBottom ? 'animate-slideInFromTop shadow-lg border-blue-500 bg-gradient-to-r from-blue-100 to-purple-100 animate-attentionGlow' : 'animate-gentlePulse'
                    }`}
                    style={{
                      animationDelay: isMobile && privacyNoticeHighlighted ? '0s' : (isMobile && isAtBottom ? '0s' : '0s'),
                      transform: isMobile && privacyNoticeHighlighted ? 'scale(1.05)' : (isMobile && isAtBottom ? 'scale(1.02)' : 'scale(1)'),
                      boxShadow: isMobile && privacyNoticeHighlighted ? '0 15px 35px rgba(59, 130, 246, 0.25)' : (isMobile && isAtBottom ? '0 10px 25px rgba(59, 130, 246, 0.15)' : 'none')
                    }}
                  >
                                          <p className="text-sm text-blue-700 font-medium text-center flex items-center justify-center gap-2">
                        <span className={`${isMobile && privacyNoticeHighlighted ? 'animate-bounce text-blue-600' : isMobile && isAtBottom ? 'animate-bounce' : 'animate-gentlePulse'}`}>🔒</span>
                        Your privacy is our top priority — all your chats and data are fully encrypted for your safety
                        {isMobile && privacyNoticeHighlighted && <span className="ml-2 animate-pulse text-blue-600">✨</span>}
                        {isMobile && isAtBottom && !privacyNoticeHighlighted && <span className="ml-2 animate-pulse text-blue-600">✨</span>}
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
                  {loadingComments ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                      <p className="text-gray-500 font-medium text-sm">Loading messages...</p>
                    </div>
                  ) : filteredComments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <FaCommentDots className="text-gray-300 text-4xl mb-3" />
                      <p className="text-gray-500 font-medium text-sm">No messages yet</p>
                      <p className="text-gray-400 text-xs mt-1">Start the conversation and connect with the other party</p>
                    </div>
                  ) : (
                    filteredComments.map((c, index) => {
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
                        <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} animate-fadeInChatBubble`} style={{ animationDelay: `${0.03 * index}s` }}>
                          <div
                            ref={el => messageRefs.current[c._id] = el}
                            id={`message-${c._id}`}
                            data-message-id={c._id}
                            className={`rounded-2xl px-4 sm:px-5 py-3 text-sm shadow-xl max-w-[90%] sm:max-w-[80%] md:max-w-[70%] lg:max-w-[60%] xl:max-w-[50%] break-words overflow-hidden relative transition-all duration-300 min-h-[60px] ${
                              isMe 
                                ? 'bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-500 hover:to-purple-600 text-white shadow-blue-200 hover:shadow-blue-300 hover:shadow-2xl' 
                                : 'bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 shadow-gray-200 hover:shadow-lg hover:border-gray-300 hover:shadow-xl'
                            } ${
                              highlightedPinnedMessage === c._id ? 'ring-4 ring-purple-400 shadow-2xl scale-105' : ''
                            }`}
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
                                              setPreviewImages([c.imageUrl]);
                                              setPreviewIndex(0);
                                              setShowImagePreview(true);
                                            }}
                                            onError={(e) => {
                                              e.target.src = "https://via.placeholder.com/300x200?text=Image+Not+Found";
                                              e.target.className = "max-w-full max-h-64 rounded-lg opacity-50";
                                            }}
                                          />
                                        </div>
                                      )}
                                      <span className="whitespace-pre-wrap break-words">{(c.message || '').replace(/\n+$/, '')}</span>
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
                                className={`${c.senderEmail === currentUser.email ? 'text-blue-200 hover:text-white' : 'text-gray-500 hover:text-gray-700'} transition-all duration-200 hover:scale-110 p-1 rounded-full hover:bg-white hover:bg-opacity-20 ml-1`}
                                onClick={(e) => { e.stopPropagation(); setHeaderOptionsMessageId(c._id); }}
                                title="Message options"
                                aria-label="Message options"
                              >
                                <FaEllipsisV size={12} />
                              </button>
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
                        </div>
                      </React.Fragment>
                    );
                  }))}
                  
                  <div ref={chatEndRef} />
                </div>
                </div>
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
                          setComment(""); 
                          // Reset textarea height to normal when cancelling edit
                          resetTextareaHeight();
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
                    <textarea
                      rows={1}
                      className="w-full pl-4 pr-20 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 shadow-lg transition-all duration-300 bg-white resize-none whitespace-pre-wrap break-all hover:border-blue-300 hover:shadow-xl focus:shadow-2xl transform hover:scale-[1.01] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                      style={{
                        minHeight: '48px',
                        maxHeight: '144px', // 6 lines * 24px line height
                        lineHeight: '24px'
                      }}
                      placeholder={editingComment ? "Edit your message..." : "Type a message..."}
                      value={comment}
                      onChange={e => {
                        setComment(e.target.value);
                        if (editingComment) {
                          setEditText(e.target.value);
                        }
                        if (!editingComment) {
                          socket.emit('typing', { toUserId: otherParty._id, fromUserId: currentUser._id, appointmentId: appt._id });
                        }
                        
                        // If cleared entirely, restore to original height
                        if ((e.target.value || '').trim() === '') {
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
                      onKeyDown={e => { 
                        // Check if this is a desktop viewport only
                        const isDesktop = window.matchMedia('(min-width: 768px)').matches;
                        
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
                      />
                    </div>
                    {/* File Upload Button - Inside textarea on the right (WhatsApp style) */}
                    <label className={`absolute right-3 bottom-3 flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 cursor-pointer ${
                      uploadingFile 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-gray-100 hover:bg-gray-200 hover:shadow-md active:scale-95'
                    }`}>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            handleFileUpload(file);
                          }
                          // Reset the input
                          e.target.value = '';
                        }}
                        disabled={uploadingFile}
                      />
                      {uploadingFile ? (
                        <div className="animate-spin w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full"></div>
                      ) : (
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      )}
                    </label>
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
                
                {/* Image Preview Modal - Positioned as overlay */}
                {showImagePreviewModal && selectedFile && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white border-2 border-gray-200 rounded-lg p-4 shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-lg font-medium text-gray-700">Image Preview</span>
                        <button
                          onClick={() => {
                            setSelectedFile(null);
                            setImageCaption('');
                            setShowImagePreviewModal(false);
                          }}
                          className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors"
                        >
                          <FaTimes className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="mb-4">
                        <img
                          src={URL.createObjectURL(selectedFile)}
                          alt="Preview"
                          className="w-full max-h-64 object-contain rounded-lg border"
                        />
                      </div>
                      <div className="mb-4">
                        <textarea
                          placeholder="Add a caption..."
                          value={imageCaption}
                          onChange={(e) => setImageCaption(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={3}
                          maxLength={500}
                        />
                        <div className="text-xs text-gray-500 mt-1 text-right">
                          {imageCaption.length}/500
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={handleSendImageWithCaption}
                          disabled={uploadingFile}
                          className="bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                        >
                          {uploadingFile ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full mr-1"></div>
                              Sending...
                            </div>
                          ) : (
                            'Send'
                          )}
                        </button>
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
              </>
            )}
            
            {/* Floating Scroll to bottom button - WhatsApp style */}
            {!isAtBottom && !isChatDisabled && !editingComment && !replyTo && (
              <div className="absolute bottom-20 right-6 z-20">
                <button
                  onClick={scrollToBottom}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full p-3 shadow-xl transition-all duration-200 hover:scale-110 relative transform hover:shadow-2xl"
                  title={unreadNewMessages > 0 ? `${unreadNewMessages} new message${unreadNewMessages > 1 ? 's' : ''}` : "Scroll to bottom"}
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
              Delete Message
            </h3>
            
            {messageToDelete?.deleted ? (
              // Deleted message - show simplified message for local removal
              <p className="text-gray-600 mb-6">
                Delete this message for me?
              </p>
            ) : messageToDelete?.senderEmail === currentUser.email ? (
              // Own message - show existing functionality
              <>
                <p className="text-gray-600 mb-4">
                  Are you sure you want to delete this message?
                </p>
                
                <div className="mb-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deleteForBoth}
                      onChange={(e) => setDeleteForBoth(e.target.checked)}
                      className="form-checkbox h-4 w-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                    />
                    <span className="text-sm text-gray-700">
                      Also delete for{' '}
                      <span className="font-medium text-gray-900">
                        {otherParty?.username || 'other user'}
                      </span>
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-7">
                    {deleteForBoth 
                      ? "The message will be permanently deleted for everyone"
                      : "The message will only be deleted for you"
                    }
                  </p>
                </div>
              </>
            ) : (
              // Received message - show simplified message
              <p className="text-gray-600 mb-6">
                Delete message from{' '}
                <span className="font-medium text-gray-900">
                  {otherParty?.username || 'other user'}
                </span>
                ?
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
                {messageToDelete?.deleted
                  ? 'Delete for me'
                  : messageToDelete?.senderEmail === currentUser.email
                    ? (deleteForBoth ? 'Delete for everyone' : 'Delete for me')
                    : 'Delete for me'
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
                    const res = await fetch(`${API_BASE_URL}/api/notifications/report-chat`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({
                        appointmentId: appt._id,
                        commentId: reportingMessage._id,
                        reason: reportReason,
                        details: reportDetails,
                      }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      toast.info('Thank you for reporting.');
                      setShowReportModal(false);
                      setReportingMessage(null);
                      setReportReason('');
                      setReportDetails('');
                    } else {
                      toast.error(data.message || 'Failed to submit report');
                    }
                  } catch (err) {
                    toast.error('Network error while reporting');
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
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaFlag className="text-red-500" /> Report Chat
            </h3>
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
                    const res = await fetch(`${API_BASE_URL}/api/notifications/report-chat-conversation`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({
                        appointmentId: appt._id,
                        reason: reportChatReason,
                        details: reportChatDetails,
                      }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      toast.info('Thank you for reporting.');
                      setShowReportChatModal(false);
                      setReportChatReason('');
                      setReportChatDetails('');
                    } else {
                      toast.error(data.message || 'Failed to submit report');
                    }
                  } catch (err) {
                    toast.error('Network error while reporting');
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
            <div className="flex items-center p-6 border-b border-gray-200 bg-gradient-to-r from-yellow-50 to-amber-50">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FaStar className="text-yellow-500" />
                Starred Messages
              </h3>
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
                                  const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${message._id}/star`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    credentials: 'include',
                                    body: JSON.stringify({ starred: false }),
                                  });
                                  if (res.ok) {
                                    // Update the local comments state
                                    setComments(prev => prev.map(c => 
                                      c._id === message._id 
                                        ? { ...c, starredBy: (c.starredBy || []).filter(id => id !== currentUser._id) }
                                        : c
                                    ));
                                    
                                    // Remove from starred messages list
                                    setStarredMessages(prev => prev.filter(m => m._id !== message._id));
                                    
                                    toast.success('Message unstarred.');
                                  } else {
                                    toast.error('Failed to unstar message');
                                  }
                                } catch (err) {
                                  toast.error('Failed to unstar message');
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
                                          setPreviewImages([message.imageUrl]);
                                          setPreviewIndex(0);
                                          setShowImagePreview(true);
                                        }}
                                        onError={(e) => {
                                          e.target.src = "https://via.placeholder.com/300x200?text=Image+Not+Found";
                                          e.target.className = "max-w-full max-h-64 rounded-lg opacity-50";
                                        }}
                                      />
                                    </div>
                                  )}
                                  {message.message}
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
                <button
                  onClick={() => setShowStarredModal(false)}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium"
                >
                  Close
                </button>
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
                <p className="text-gray-600 mb-4">Choose how long to pin this message:</p>
                
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
                  <div className="text-sm text-gray-600 mb-2">Message to pin:</div>
                  <div className="text-sm text-gray-800 bg-white p-2 rounded border">
                    {messageToPin.message?.substring(0, 100)}
                    {messageToPin.message?.length > 100 ? '...' : ''}
                  </div>
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
                onClick={() => handlePinMessage(messageToPin, true, pinDuration, customHours)}
                disabled={pinningSaving}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pinningSaving ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Pinning...
                  </div>
                ) : (
                  'Pin Message'
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
      />

    </>
  );
} 
