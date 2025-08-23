import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { FaTrash, FaSearch, FaPen, FaPaperPlane, FaUser, FaEnvelope, FaCalendar, FaPhone, FaUserShield, FaArchive, FaUndo, FaCommentDots, FaCheck, FaCheckDouble, FaBan, FaTimes, FaLightbulb, FaCopy, FaEllipsisV, FaInfoCircle, FaSync, FaStar, FaRegStar, FaFlag, FaCalendarAlt, FaCheckSquare } from "react-icons/fa";
import { formatLinksInText } from '../utils/linkFormatter.jsx';
import UserAvatar from '../components/UserAvatar';
import ImagePreview from '../components/ImagePreview';
import LinkPreview from '../components/LinkPreview';
import { EmojiButton } from '../components/EmojiPicker';
import { useSelector } from "react-redux";
import { useState as useLocalState } from "react";
import { Link } from "react-router-dom";
import { toast, ToastContainer } from 'react-toastify';
import { socket } from "../utils/socket";
import { useSoundEffects } from "../components/SoundEffects";
import axios from 'axios';
// Note: Do not import server-only libs here

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminAppointments() {
  const { currentUser } = useSelector((state) => state.user);
  const [appointments, setAppointments] = useState([]);
  const [archivedAppointments, setArchivedAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  // Removed role filter
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // State for appointment action modals
  const [appointmentToHandle, setAppointmentToHandle] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReinitiateModal, setShowReinitiateModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
    const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
 
   // Lock body scroll when admin action modals are open (cancel, reinitiate, archive, unarchive)
   useEffect(() => {
     const shouldLock = showCancelModal || showReinitiateModal || showArchiveModal || showUnarchiveModal;
     if (shouldLock) {
       document.body.classList.add('modal-open');
     } else {
       document.body.classList.remove('modal-open');
     }
     return () => {
       document.body.classList.remove('modal-open');
     };
   }, [showCancelModal, showReinitiateModal, showArchiveModal, showUnarchiveModal]);
 
   // Add state to track updated comments for each appointment
  const [updatedComments, setUpdatedComments] = useState({});
  
  // Add ref to prevent infinite loops in comment updates
  const isUpdatingCommentsRef = useRef(false);

  // Function to update comments for a specific appointment
  const updateAppointmentComments = useCallback((appointmentId, comments) => {
    // Prevent infinite loops
    if (isUpdatingCommentsRef.current) {
      return;
    }
    
    setUpdatedComments(prev => {
      const currentComments = prev[appointmentId];
      // Only update if there are actual changes and the change is not just a count difference
      if (currentComments && comments) {
        // Check if this is just a count update or actual content change
        const hasContentChanges = comments.some((comment, index) => {
          const currentComment = currentComments[index];
          return !currentComment || JSON.stringify(currentComment) !== JSON.stringify(comment);
        });
        
        if (hasContentChanges) {
          // Set flag to prevent infinite loops
          isUpdatingCommentsRef.current = true;
          

          
          // Reset flag after a short delay
          setTimeout(() => {
            isUpdatingCommentsRef.current = false;
          }, 100);
          
          return {
            ...prev,
            [appointmentId]: comments
          };
        }
      } else if (JSON.stringify(currentComments) !== JSON.stringify(comments)) {
        // Handle case where one of them is null/undefined
        // Set flag to prevent infinite loops
        isUpdatingCommentsRef.current = true;
        

        
        // Reset flag after a short delay
        setTimeout(() => {
          isUpdatingCommentsRef.current = false;
        }, 100);
        
        return {
          ...prev,
          [appointmentId]: comments
        };
      }
      return prev; // No changes needed
    });
  }, []);

  // Define fetch functions outside useEffect so they can be used in socket handlers
  const fetchAppointments = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/bookings`, { 
        withCredentials: true 
      });
      setAppointments(data);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch appointments", err);
      setLoading(false);
    }
  }, []);

  const fetchArchivedAppointments = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/bookings/archived`, {
        withCredentials: true
      });
      setArchivedAppointments(data);
    } catch (err) {
      console.error("Failed to fetch archived appointments", err);
    }
  }, []);

  useEffect(() => {
    // Join admin appointments room to receive real-time updates
    if (socket.connected && currentUser) {
      socket.emit('adminAppointmentsActive', { 
        adminId: currentUser._id,
        role: currentUser.role 
      });
    }

    // Emit adminAppointmentsActive periodically to stay subscribed (like MyAppointments)
    const adminInterval = setInterval(() => {
      if (currentUser) {
        socket.emit('adminAppointmentsActive', { 
          adminId: currentUser._id,
          role: currentUser.role 
        });
      }
    }, 1000);
    
    fetchAppointments();
    fetchArchivedAppointments();
    const interval = setInterval(() => {
      fetchAppointments();
      fetchArchivedAppointments();
    }, 5000);
    
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
      
      setArchivedAppointments(prevArchived => prevArchived.map(appt => {
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

    // Listen for real-time comment updates to refresh appointments
    const handleCommentUpdate = (data) => {
      // Skip handling if this is a message sent by current admin user to prevent duplicates
      // Admin messages are already added locally in handleCommentSend
      if (data.comment.senderEmail === currentUser?.email) {
        return;
      }
      
      // Update the specific appointment's comments in real-time
      setAppointments(prev => 
        prev.map(appt => {
          if (appt._id === data.appointmentId) {
            // Find if comment already exists
            const existingCommentIndex = appt.comments?.findIndex(c => c._id === data.comment._id);
            if (existingCommentIndex !== -1) {
              // Update existing comment - only if there are actual changes
              // and preserve starred status
              const existingComment = appt.comments[existingCommentIndex];
              const updatedComment = { ...data.comment, starredBy: existingComment.starredBy || [] };
              if (JSON.stringify(existingComment) !== JSON.stringify(updatedComment)) {
                const updatedComments = [...(appt.comments || [])];
                updatedComments[existingCommentIndex] = updatedComment;
                try { playMessageReceived(); } catch(_) {}
                return { ...appt, comments: updatedComments };
              }
              return appt; // No changes needed
            } else {
              // Add new comment - this is a new user message
              const updatedComments = [...(appt.comments || []), data.comment];
              try { playMessageReceived(); } catch(_) {}
              return { ...appt, comments: updatedComments };
            }
          }
          return appt;
        })
      );
      
      // Also update archived appointments if needed
      setArchivedAppointments(prev => 
        prev.map(appt => {
          if (appt._id === data.appointmentId) {
            const existingCommentIndex = appt.comments?.findIndex(c => c._id === data.comment._id);
            if (existingCommentIndex !== -1) {
              // Update existing comment - only if there are actual changes
              // and preserve starred status
              const existingComment = appt.comments[existingCommentIndex];
              const updatedComment = { ...data.comment, starredBy: existingComment.starredBy || [] };
              if (JSON.stringify(existingComment) !== JSON.stringify(updatedComment)) {
                const updatedComments = [...(appt.comments || [])];
                updatedComments[existingCommentIndex] = updatedComment;
                try { playMessageReceived(); } catch(_) {}
                return { ...appt, comments: updatedComments };
              }
              return appt; // No changes needed
            } else {
              // Add new comment
              const updatedComments = [...(appt.comments || []), data.comment];
              try { playMessageReceived(); } catch(_) {}
              return { ...appt, comments: updatedComments };
            }
          }
          return appt;
        })
      );

      // Update the updatedComments state to trigger child component updates
      setUpdatedComments(prev => {
        const currentComments = prev[data.appointmentId] || [];
        const newComments = [...currentComments];
        
        const existingCommentIndex = newComments.findIndex(c => c._id === data.comment._id);
        if (existingCommentIndex !== -1) {
          // Update existing comment and preserve starred status
          const existingComment = newComments[existingCommentIndex];
          const updatedComment = { ...data.comment, starredBy: existingComment.starredBy || [] };
          newComments[existingCommentIndex] = updatedComment;
        } else {
          // Add new comment
          newComments.push(data.comment);
        }
        
        return {
          ...prev,
          [data.appointmentId]: newComments
        };
      });
    };
    socket.on('commentUpdate', handleCommentUpdate);

    // Listen for appointment updates
    const handleAppointmentUpdate = (data) => {
      setAppointments(prev => 
        prev.map(appt => 
          appt._id === data.appointmentId ? { ...appt, ...data.updatedAppointment } : appt
        )
      );
      setArchivedAppointments(prev => 
        prev.map(appt => 
          appt._id === data.appointmentId ? { ...appt, ...data.updatedAppointment } : appt
        )
      );
    };
    socket.on('appointmentUpdate', handleAppointmentUpdate);

    // Listen for new appointments
    const handleAppointmentCreated = (data) => {
      const newAppt = data.appointment;
      setAppointments(prev => [newAppt, ...prev]);
    };
    socket.on('appointmentCreated', handleAppointmentCreated);

    // Listen for socket connection events
    const handleConnect = () => {
      // Re-join admin appointments rooms on reconnect to receive real-time updates
      if (currentUser) {
        socket.emit('adminAppointmentsActive', { 
          adminId: currentUser._id,
          role: currentUser.role 
        });
      }
    };
    const handleDisconnect = () => {
      // Socket disconnected - will auto-reconnect
    };
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    
    return () => {
      clearInterval(interval);
      clearInterval(adminInterval);
      socket.off('profileUpdated', handleProfileUpdate);
      socket.off('commentUpdate', handleCommentUpdate);
      socket.off('appointmentUpdate', handleAppointmentUpdate);
      socket.off('appointmentCreated', handleAppointmentCreated);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [fetchAppointments, fetchArchivedAppointments, currentUser]);

  // Lock background scroll when user modal is open
  useEffect(() => {
    if (showUserModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showUserModal]);

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
    
    setArchivedAppointments(prevArchived => prevArchived.map(appt => {
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

  const handleAdminCancel = async (id) => {
    setAppointmentToHandle(id);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const confirmAdminCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Please provide a reason for cancelling this appointment.');
      return;
    }
    
    try {
      const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appointmentToHandle}/cancel`, 
        { reason: cancelReason },
        { 
          withCredentials: true,
          headers: { "Content-Type": "application/json" }
        }
      );
      
      setAppointments((prev) =>
        prev.map((appt) => (appt._id === appointmentToHandle ? { ...appt, status: "cancelledByAdmin", cancelReason: cancelReason } : appt))
      );
      toast.success("Appointment cancelled successfully. Both buyer and seller have been notified of the cancellation.");
      
      // Close modal and reset state
      setShowCancelModal(false);
      setAppointmentToHandle(null);
      setCancelReason('');
    } catch (err) {
      console.error('Error in confirmAdminCancel:', err);
      toast.error(err.response?.data?.message || "Failed to cancel appointment.");
    }
  };

  const handleReinitiateAppointment = async (id) => {
    setAppointmentToHandle(id);
    setShowReinitiateModal(true);
  };

  const confirmReinitiate = async () => {
    try {
      const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appointmentToHandle}/reinitiate`, 
        {},
        { 
          withCredentials: true,
          headers: { "Content-Type": "application/json" }
        }
      );
      
      setAppointments((prev) =>
        prev.map((appt) => (appt._id === appointmentToHandle ? { ...appt, status: "pending", cancelReason: "" } : appt))
      );
      toast.success("Appointment reinitiated successfully. Both buyer and seller have been notified.");
      
      // Close modal and reset state
      setShowReinitiateModal(false);
      setAppointmentToHandle(null);
    } catch (err) {
      console.error('Error in confirmReinitiate:', err);
      toast.error(err.response?.data?.message || "Failed to reinitiate appointment.");
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
      
      // Remove from active appointments and add to archived
      const archivedAppt = appointments.find(appt => appt._id === appointmentToHandle);
      if (archivedAppt) {
        setAppointments((prev) => prev.filter((appt) => appt._id !== appointmentToHandle));
        setArchivedAppointments((prev) => [{ ...archivedAppt, archivedByAdmin: true, archivedAt: new Date() }, ...prev]);
      }
      toast.success("Appointment archived successfully.");
      
      // Close modal and reset state
      setShowArchiveModal(false);
      setAppointmentToHandle(null);
    } catch (err) {
      console.error('Error in confirmArchive:', err);
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
      
      // Remove from archived appointments and add back to active
      const unarchivedAppt = archivedAppointments.find(appt => appt._id === appointmentToHandle);
      if (unarchivedAppt) {
        setArchivedAppointments((prev) => prev.filter((appt) => appt._id !== appointmentToHandle));
        setAppointments((prev) => [{ ...unarchivedAppt, archivedByAdmin: false, archivedAt: undefined }, ...prev]);
      }
      toast.success("Appointment unarchived successfully.");
      
      // Close modal and reset state
      setShowUnarchiveModal(false);
      setAppointmentToHandle(null);
    } catch (err) {
      console.error('Error in confirmUnarchive:', err);
      toast.error(err.response?.data?.message || "Failed to unarchive appointment.");
    }
  };

  const handleUserClick = async (userId) => {
    if (!userId) {
      toast.error("User ID not available");
      return;
    }
    
    setUserLoading(true);
    setShowUserModal(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/user/id/${userId}`);
      setSelectedUser(data);
    } catch (err) {
      toast.error("Failed to fetch user details.");
      setShowUserModal(false);
    }
    setUserLoading(false);
  };

  // Filter and search logic
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      const isOutdated = new Date(appt.date) < new Date() || (new Date(appt.date).toDateString() === new Date().toDateString() && appt.time && appt.time < new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      const matchesStatus =
        statusFilter === "all" ? true :
        statusFilter === "outdated" ? isOutdated :
        appt.status === statusFilter;
      const matchesRole = true; // role filter removed
      const matchesSearch =
        appt.buyerId?.email?.toLowerCase().includes(search.toLowerCase()) ||
        appt.sellerId?.email?.toLowerCase().includes(search.toLowerCase()) ||
        appt.propertyName?.toLowerCase().includes(search.toLowerCase()) ||
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
    }).map((appt) => ({
      ...appt,
      comments: updatedComments[appt._id] || appt.comments || []
    }));
  }, [appointments, statusFilter, search, startDate, endDate, updatedComments]);

  const filteredArchivedAppointments = useMemo(() => {
    return archivedAppointments.filter((appt) => {
      const isOutdated = new Date(appt.date) < new Date() || (new Date(appt.date).toDateString() === new Date().toDateString() && appt.time && appt.time < new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      const matchesStatus =
        statusFilter === "all" ? true :
        statusFilter === "outdated" ? isOutdated :
        appt.status === statusFilter;
      const matchesRole = true; // role filter removed
      const matchesSearch =
        appt.buyerId?.email?.toLowerCase().includes(search.toLowerCase()) ||
        appt.sellerId?.email?.toLowerCase().includes(search.toLowerCase()) ||
        appt.propertyName?.toLowerCase().includes(search.toLowerCase()) ||
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
    }).map((appt) => ({
      ...appt,
      comments: updatedComments[appt._id] || appt.comments || []
    }));
  }, [archivedAppointments, statusFilter, search, startDate, endDate, updatedComments]);

  // Add this function to fetch latest data on demand
  const handleManualRefresh = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/bookings`, { 
        withCredentials: true 
      });
      setAppointments(data);
      
      const { data: archivedData } = await axios.get(`${API_BASE_URL}/api/bookings/archived`, { 
        withCredentials: true 
      });
      setArchivedAppointments(Array.isArray(archivedData) ? archivedData : []);
    } catch (err) {
      // Optionally handle error
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
        <p className="mt-2 text-gray-600">Loading appointments...</p>
      </div>
    </div>
  );

  if (!Array.isArray(appointments)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-100">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Session expired or unauthorized</h2>
          <p className="text-gray-700 mb-4">Please sign in again to access admin appointments.</p>
          <Link to="/sign-in" className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors">Go to Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 py-10 px-2 md:px-8">
      <ToastContainer
        position="top-center"
        autoClose={2000}
        closeOnClick
        containerClassName="!z-[100]"
        toastOptions={{
          style: { fontSize: '0.9rem', borderRadius: '8px', boxShadow: '0 2px 8px #0001' }
        }}
      />
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-6">
        {/* Responsive button group: compact on mobile, original on desktop */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-blue-700 drop-shadow">
            {showArchived 
              ? `Archived Appointments (${filteredArchivedAppointments.length})`
              : `All Appointments (${filteredAppointments.length})`}
          </h3>
          <div className="flex flex-row w-full sm:w-auto gap-2 sm:gap-4 justify-center sm:justify-end mt-2 sm:mt-0">
            <button
              onClick={handleManualRefresh}
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-2.5 py-1.5 rounded-md hover:from-blue-600 hover:to-purple-600 transition-all font-semibold shadow-md text-xs sm:text-base sm:px-4 sm:py-2 sm:rounded-lg w-1/2 sm:w-auto"
              title="Refresh appointments"
            >
              Refresh
            </button>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`bg-gradient-to-r text-white px-2.5 py-1.5 rounded-md transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-1 sm:gap-2 text-xs sm:text-base w-1/2 sm:w-auto sm:px-6 sm:py-3 sm:rounded-lg justify-center ${
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
        
        <p className="text-center text-gray-600 mb-6">
          {showArchived 
            ? "View and manage archived appointments. You can unarchive them to move them back to active appointments."
            : "💡 High data traffic may cause this page to slow down or stop working. Please refresh to continue using it normally.⚠️ Chats are encrypted and secure. View only for valid purposes like disputes or fraud checks. Unauthorized access or sharing is prohibited and will be logged."
          }
        </p>

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
                <option value="pending">Pending Appointments</option>
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
            {/* Role filter removed for streamlined UI */}
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
                placeholder="Search by email, property, or username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
        
        {showArchived ? (
          // Archived Appointments Section
            filteredArchivedAppointments.length === 0 ? (
              <div className="text-center text-gray-500 text-lg">No archived appointments found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
                      <th className="border p-2">Date & Time</th>
                      <th className="border p-2">Property</th>
                      <th className="border p-2">Buyer</th>
                      <th className="border p-2">Seller</th>
                      <th className="border p-2">Purpose</th>
                      <th className="border p-2">Message</th>
                      <th className="border p-2">Status</th>
                      <th className="border p-2">Actions</th>
                      <th className="border p-2">Connect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredArchivedAppointments.map((appt) => (
                      <AdminAppointmentRow
                        key={appt._id}
                        appt={appt}
                        currentUser={currentUser}
                        handleAdminCancel={handleAdminCancel}
                        handleReinitiateAppointment={handleReinitiateAppointment}
                        handleArchiveAppointment={handleArchiveAppointment}
                        handleUnarchiveAppointment={handleUnarchiveAppointment}
                        onUserClick={handleUserClick}
                        isArchived={true}
                        copyMessageToClipboard={copyMessageToClipboard}
                        updateAppointmentComments={updateAppointmentComments}
                        // Modal states
                        showCancelModal={showCancelModal}
                        setShowCancelModal={setShowCancelModal}
                        showReinitiateModal={showReinitiateModal}
                        setShowReinitiateModal={setShowReinitiateModal}
                        showArchiveModal={showArchiveModal}
                        setShowArchiveModal={setShowArchiveModal}
                        showUnarchiveModal={showUnarchiveModal}
                        setShowUnarchiveModal={setShowUnarchiveModal}
                        appointmentToHandle={appointmentToHandle}
                        setAppointmentToHandle={setAppointmentToHandle}
                        cancelReason={cancelReason}
                        setCancelReason={setCancelReason}
                        confirmAdminCancel={confirmAdminCancel}
                        confirmReinitiate={confirmReinitiate}
                        confirmArchive={confirmArchive}
                        confirmUnarchive={confirmUnarchive}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )
        ) : (
          // Active Appointments Section
          filteredAppointments.length === 0 ? (
            <div className="text-center text-gray-500 text-lg">No appointments found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-100 to-purple-100">
                    <th className="border p-2">Date & Time</th>
                    <th className="border p-2">Property</th>
                    <th className="border p-2">Buyer</th>
                    <th className="border p-2">Seller</th>
                    <th className="border p-2">Purpose</th>
                    <th className="border p-2">Message</th>
                    <th className="border p-2">Status</th>
                    <th className="border p-2">Actions</th>
                    <th className="border p-2">Connect</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.map((appt) => (
                    <AdminAppointmentRow
                      key={appt._id}
                      appt={appt}
                      currentUser={currentUser}
                      handleAdminCancel={handleAdminCancel}
                      handleReinitiateAppointment={handleReinitiateAppointment}
                      handleArchiveAppointment={handleArchiveAppointment}
                      handleUnarchiveAppointment={handleUnarchiveAppointment}
                      onUserClick={handleUserClick}
                      isArchived={false}
                      copyMessageToClipboard={copyMessageToClipboard}
                      updateAppointmentComments={updateAppointmentComments}
                      // Modal states
                      showCancelModal={showCancelModal}
                      setShowCancelModal={setShowCancelModal}
                      showReinitiateModal={showReinitiateModal}
                      setShowReinitiateModal={setShowReinitiateModal}
                      showArchiveModal={showArchiveModal}
                      setShowArchiveModal={setShowArchiveModal}
                      showUnarchiveModal={showUnarchiveModal}
                      setShowUnarchiveModal={setShowUnarchiveModal}
                      appointmentToHandle={appointmentToHandle}
                      setAppointmentToHandle={setAppointmentToHandle}
                      cancelReason={cancelReason}
                      setCancelReason={setCancelReason}
                      confirmAdminCancel={confirmAdminCancel}
                      confirmReinitiate={confirmReinitiate}
                      confirmArchive={confirmArchive}
                      confirmUnarchive={confirmUnarchive}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* User Modal - Enhanced Design */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4" style={{ overflow: 'hidden' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto relative animate-fadeIn">
            {/* Close button */}
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors z-40 shadow"
              onClick={() => setShowUserModal(false)}
              title="Close"
              aria-label="Close"
            >
              <FaTimes className="w-4 h-4" />
            </button>

            {userLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="ml-4 text-gray-600">Loading user details...</p>
              </div>
            ) : selectedUser ? (
              <>
                {/* Header with gradient background (sticky on mobile) */}
                <div className="flex flex-col items-center justify-center bg-gradient-to-r from-blue-100 to-purple-100 rounded-t-2xl px-6 py-6 border-b border-gray-200 sticky top-[env(safe-area-inset-top,0px)] z-20">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <UserAvatar 
                        user={{ username: selectedUser.username, avatar: selectedUser.avatar }} 
                        size="w-16 h-16" 
                        textSize="text-lg"
                        showBorder={true}
                        className="border-4 border-white shadow-lg"
                      />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-2 border-white rounded-full flex items-center justify-center">
                        {selectedUser.role === 'admin' || selectedUser.role === 'rootadmin' ? (
                          <FaUserShield className="w-3 h-3 text-white" />
                        ) : (
                          <FaUser className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                    <div className="text-center">
                      <h2 className="text-xl font-bold text-blue-800 flex items-center gap-2">
                        {selectedUser.username}
                        {(selectedUser.role === 'admin' || selectedUser.role === 'rootadmin') && (
                          <FaUserShield className="text-purple-600 text-base" title="Admin user" />
                        )}
                      </h2>
                      <div className="flex gap-2 mt-1">
                        <p className="text-sm text-gray-600 capitalize font-medium bg-white px-3 py-1 rounded-full shadow-sm">
                          {selectedUser.role || 'User'}
                        </p>
                        {selectedUser.adminApprovalStatus && (
                          <p className={`text-xs font-medium px-2 py-1 rounded-full ${
                            selectedUser.adminApprovalStatus === 'approved' 
                              ? 'bg-green-100 text-green-700' 
                              : selectedUser.adminApprovalStatus === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {selectedUser.adminApprovalStatus}
                          </p>
                        )}
                      </div>
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
                        <p className="text-gray-800 font-medium">{selectedUser.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border-l-4 border-green-500">
                      <FaPhone className="text-green-500 w-5 h-5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Phone</p>
                        <p className="text-gray-800 font-medium">{selectedUser.mobileNumber || 'Not provided'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border-l-4 border-purple-500">
                      <FaCalendar className="text-purple-500 w-5 h-5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Member Since</p>
                        <p className="text-gray-800 font-medium">
                          {new Date(selectedUser.createdAt).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>
                    </div>
                  </div>


                </div>
              </>
            ) : (
              <div className="flex items-center justify-center p-8">
                <p className="text-gray-600">User not found</p>
              </div>
            )}
          </div>
        </div>
      )}
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

function AdminAppointmentRow({ 
  appt, 
  currentUser, 
  handleAdminCancel, 
  handleReinitiateAppointment, 
  handleArchiveAppointment, 
  handleUnarchiveAppointment, 
  onUserClick, 
  isArchived,
  copyMessageToClipboard,
  updateAppointmentComments,
  // Modal states from parent
  showCancelModal,
  setShowCancelModal,
  showReinitiateModal,
  setShowReinitiateModal,
  showArchiveModal,
  setShowArchiveModal,
  showUnarchiveModal,
  setShowUnarchiveModal,
  appointmentToHandle,
  setAppointmentToHandle,
  cancelReason,
  setCancelReason,
  confirmAdminCancel,
  confirmReinitiate,
  confirmArchive,
  confirmUnarchive
}) {
  // Use parent comments directly for real-time sync, with local state for UI interactions
  const [localComments, setLocalComments] = React.useState(appt.comments || []);
  
  // Initialize starred messages when comments are loaded
  React.useEffect(() => {
    if (localComments.length > 0) {
      const starredMsgs = localComments.filter(c => c.starredBy && c.starredBy.includes(currentUser._id));
      setStarredMessages(starredMsgs);
    }
  }, [localComments, currentUser._id]);
  const [newComment, setNewComment] = useLocalState("");
  const [detectedUrl, setDetectedUrl] = useState(null);
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sending, setSending] = useLocalState(false);
  const [editingComment, setEditingComment] = useLocalState(null);
  const [editText, setEditText] = useLocalState("");
  const [savingComment, setSavingComment] = useLocalState(null);
  const [replyTo, setReplyTo] = useLocalState(null);
  const [showChatModal, setShowChatModal] = useLocalState(false);
  const [showPasswordModal, setShowPasswordModal] = useLocalState(false);
  const [adminPassword, setAdminPassword] = useLocalState("");
  const [showDeleteModal, setShowDeleteModal] = useLocalState(false);
  const [messageToDelete, setMessageToDelete] = useLocalState(null);
  const [passwordLoading, setPasswordLoading] = useLocalState(false);
  const chatEndRef = React.useRef(null);
  const chatContainerRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const messageRefs = React.useRef({});
  const [isAtBottom, setIsAtBottom] = useLocalState(true);
  const [unreadNewMessages, setUnreadNewMessages] = useLocalState(0);
  const [currentFloatingDate, setCurrentFloatingDate] = useLocalState('');
  const [isScrolling, setIsScrolling] = useLocalState(false);
  const [showShortcutTip, setShowShortcutTip] = useLocalState(false);
  const [hiddenMessageIds, setHiddenMessageIds] = useLocalState(() => getLocallyHiddenIds(appt._id));
  const [headerOptionsMessageId, setHeaderOptionsMessageId] = useLocalState(null);
  const [showHeaderMoreMenu, setShowHeaderMoreMenu] = useLocalState(false);
  const scrollTimeoutRef = React.useRef(null);
  const [showDeleteChatModal, setShowDeleteChatModal] = useLocalState(false);
  const [deleteChatPassword, setDeleteChatPassword] = useLocalState("");
  const [deleteChatLoading, setDeleteChatLoading] = useLocalState(false);
  
  // Message info modal state
  const [showMessageInfoModal, setShowMessageInfoModal] = useLocalState(false);
  const [selectedMessageForInfo, setSelectedMessageForInfo] = useLocalState(null);
  
  // Starred messages states
  const [showStarredModal, setShowStarredModal] = useLocalState(false);
  const [starredMessages, setStarredMessages] = useLocalState([]);
  const [starringSaving, setStarringSaving] = useLocalState(false);
  const [loadingStarredMessages, setLoadingStarredMessages] = useLocalState(false);
  const [unstarringMessageId, setUnstarringMessageId] = useLocalState(null);
  const [removingAllStarred, setRemovingAllStarred] = useLocalState(false);
  const [sendIconAnimating, setSendIconAnimating] = useLocalState(false);
  const [sendIconSent, setSendIconSent] = useLocalState(false);
  
  // Chat options menu state
  const [showChatOptionsMenu, setShowChatOptionsMenu] = useLocalState(false);
  
  // Multi-select message states
  const [isSelectionMode, setIsSelectionMode] = useLocalState(false);
  const [selectedMessages, setSelectedMessages] = useLocalState([]);
  const [multiSelectActions, setMultiSelectActions] = useLocalState({
    starring: false,
    copying: false,
    deleting: false
  });
  
  // Removed pinning feature state
  
  // Search functionality state
  const [showSearchBox, setShowSearchBox] = useLocalState(false);
  const [searchQuery, setSearchQuery] = useLocalState("");
  const [searchResults, setSearchResults] = useLocalState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useLocalState(-1);
  
  // Calendar functionality state
  const [showCalendar, setShowCalendar] = useLocalState(false);
  const [selectedDate, setSelectedDate] = useLocalState("");
  const [highlightedDateMessage, setHighlightedDateMessage] = useLocalState(null);
  
  // File upload states
  const [uploadingFile, setUploadingFile] = useLocalState(false);
  const [fileUploadError, setFileUploadError] = useLocalState('');
  const [selectedFiles, setSelectedFiles] = useLocalState([]);
  const [showImagePreview, setShowImagePreview] = useLocalState(false);
  const [previewImages, setPreviewImages] = useLocalState([]);
  const [previewIndex, setPreviewIndex] = useLocalState(0);
  const [imageCaptions, setImageCaptions] = useLocalState({});
  const [showImagePreviewModal, setShowImagePreviewModal] = useLocalState(false);
  const [uploadProgress, setUploadProgress] = useState(0);



  const selectedMessageForHeaderOptions = headerOptionsMessageId ? localComments.find(msg => msg._id === headerOptionsMessageId) : null;

  // Lock body scroll when chat modal is open
  React.useEffect(() => {
    if (showChatModal) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [showChatModal]);

  // Reset unread count when chat modal opens
  React.useEffect(() => {
    if (showChatModal) {
      setUnreadNewMessages(0);
      // Mark messages as read when chat is opened
      axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/read`, {}, {
        withCredentials: true
      }).catch(err => {
        console.error('Error marking messages as read:', err);
      });
      
      // Sync starred messages when chat opens
      if (starredMessages.length > 0) {
        // Update starred messages list with current comment states
        const updatedStarredMessages = starredMessages.map(starredMsg => {
          const currentComment = localComments.find(c => c._id === starredMsg._id);
          return currentComment ? { ...starredMsg, starredBy: currentComment.starredBy || [] } : starredMsg;
        }).filter(msg => msg.starredBy && msg.starredBy.includes(currentUser._id));
        setStarredMessages(updatedStarredMessages);
      }
    }
  }, [showChatModal, appt._id, starredMessages.length, localComments, currentUser._id]);

  // Auto-close shortcut tip after 10 seconds
  React.useEffect(() => {
    if (showShortcutTip) {
      const timer = setTimeout(() => {
        setShowShortcutTip(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showShortcutTip]);

  // Lock body scroll when admin password modal is open
  React.useEffect(() => {
    if (showPasswordModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showPasswordModal]);

  // Function to fetch starred messages
  const fetchStarredMessages = async () => {
    if (!appt?._id) return;
    
    setLoadingStarredMessages(true);
    try {
      // First, sync comments to ensure we have the latest starred status
      await fetchLatestComments();
      // Then fetch starred messages from backend
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
  React.useEffect(() => {
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
          
          // Update this specific message in local comments
          setLocalComments(prev => prev.map(c => 
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

  // Removed pinning initialization

  // Close chat options menu when clicking outside or scrolling
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (showChatOptionsMenu && !event.target.closest('.chat-options-menu')) {
        setShowChatOptionsMenu(false);
      }
      if (showHeaderMoreMenu && !event.target.closest('.chat-options-menu')) {
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

    const handleScroll = () => {
      if (showChatOptionsMenu) {
        setShowChatOptionsMenu(false);
      }
      if (showHeaderMoreMenu) {
        setShowHeaderMoreMenu(false);
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
  React.useEffect(() => {
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
  React.useEffect(() => {
    if (currentSearchIndex >= 0 && searchResults[currentSearchIndex]) {
      scrollToSearchResult(searchResults[currentSearchIndex]._id);
    }
  }, [currentSearchIndex, searchResults]);

  // Removed handleClickOutside functionality - options now only close when clicking three dots again

  // Sync localComments with parent comments for real-time updates
  React.useEffect(() => {
    const serverComments = appt.comments || [];
    
    // Always update localComments when parent changes (real-time sync)
    if (JSON.stringify(localComments) !== JSON.stringify(serverComments)) {
      const prevLength = localComments.length;
      setLocalComments(serverComments);
        
      // Handle unread message count and auto-scroll for new messages
      if (serverComments.length > prevLength) {
        const newMessages = serverComments.slice(prevLength);
        const receivedMessages = newMessages.filter(msg => msg.senderEmail !== currentUser.email);
        
        if (receivedMessages.length > 0) {
          // Increment unread count for messages from other users
          if (!showChatModal) {
            setUnreadNewMessages(prev => prev + receivedMessages.length);
          }
          
          // Auto-scroll if chat is open and user is at bottom
          if (showChatModal && isAtBottom) {
            setTimeout(() => {
              if (chatEndRef.current) {
                chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            }, 100);
          }
          
          // Mark messages as read if chat is open
          if (showChatModal) {
            setTimeout(() => {
              axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/read`, {}, {
                withCredentials: true
              }).catch(err => {
                console.error('Error marking messages as read:', err);
              });
            }, 100);
          }
        }
      }
    }
  }, [appt.comments, appt._id, showChatModal, isAtBottom, currentUser.email]);

  // Auto-scroll to bottom when chat modal opens
  React.useEffect(() => {
    if (showChatModal && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showChatModal]);
 


  // Track new messages and handle auto-scroll/unread count
  const prevCommentsLengthRef = React.useRef(localComments.length);
  const prevCommentsRef = React.useRef(localComments);
  React.useEffect(() => {
    const newMessages = localComments.slice(prevCommentsLengthRef.current);
    const newMessagesCount = newMessages.length;
    prevCommentsLengthRef.current = localComments.length;
    prevCommentsRef.current = localComments;

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
          }
        }, 100);
      } else if (receivedMessages.length > 0) {
        // Add to unread count only for received messages when user is not at bottom
        setUnreadNewMessages(prev => prev + receivedMessages.length);
      }
    }
  }, [localComments.length, isAtBottom, showChatModal, currentUser.email]);

  // Reset unread count when chat modal is opened or closed
  React.useEffect(() => {
    if (showChatModal) {
      // Reset count when chat opens
      setUnreadNewMessages(0);
    } else {
      // Also reset when chat closes
      setUnreadNewMessages(0);
    }
  }, [showChatModal]);

  // Function to update floating date based on visible messages
  const updateFloatingDate = React.useCallback(() => {
    if (!chatContainerRef.current || localComments.length === 0) return;
    
    const container = chatContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const containerTop = containerRect.top + 60; // Account for header
    
    // Find the first visible message
    let visibleDate = '';
    for (let i = 0; i < localComments.length; i++) {
      const messageElement = messageRefs.current[localComments[i]._id];
      if (messageElement) {
        const messageRect = messageElement.getBoundingClientRect();
        if (messageRect.top >= containerTop && messageRect.bottom <= containerRect.bottom) {
          const messageDate = new Date(localComments[i].timestamp);
          visibleDate = getDateLabel(messageDate);
          break;
        }
      }
    }
    
    // If no message is fully visible, find the one that's partially visible at the top
    if (!visibleDate) {
      for (let i = 0; i < localComments.length; i++) {
        const messageElement = messageRefs.current[localComments[i]._id];
        if (messageElement) {
          const messageRect = messageElement.getBoundingClientRect();
          if (messageRect.bottom > containerTop) {
            const messageDate = new Date(localComments[i].timestamp);
            visibleDate = getDateLabel(messageDate);
            break;
          }
        }
      }
    }
    
    if (visibleDate && visibleDate !== currentFloatingDate) {
      setCurrentFloatingDate(visibleDate);
    }
  }, [localComments, currentFloatingDate]);

  // Mark messages as read when user can see them
  const markingReadRef = React.useRef(false);
  
  const markMessagesAsRead = React.useCallback(async () => {
    if (markingReadRef.current) return; // Prevent concurrent requests
    
    const unreadMessages = localComments.filter(c => 
      !c.readBy?.includes(currentUser._id) && 
      c.senderEmail !== currentUser.email
    );
    
    if (unreadMessages.length > 0) {
      markingReadRef.current = true;
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
          setLocalComments(prev => 
            prev.map(c => 
              unreadMessages.some(unread => unread._id === c._id)
                ? { ...c, readBy: [...(c.readBy || []), currentUser._id], status: 'read' }
                : c
            )
          );
          
          // Emit socket event for real-time updates to other party
          unreadMessages.forEach(msg => {
            socket.emit('messageRead', {
              appointmentId: appt._id,
              messageId: msg._id,
              userId: currentUser._id
            });
          });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      } finally {
        markingReadRef.current = false;
      }
    }
  }, [localComments, currentUser._id, appt._id, socket]);

  // Check if user is at the bottom of chat
  const checkIfAtBottom = React.useCallback(() => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 5; // 5px threshold
      setIsAtBottom(atBottom);
      
      // Clear unread count and mark messages as read when user reaches bottom
      if (atBottom && unreadNewMessages > 0) {
        setUnreadNewMessages(0);
        markMessagesAsRead();
      }
    }
  }, [unreadNewMessages, markMessagesAsRead]);

  // Add scroll event listener for chat container
  React.useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer && showChatModal) {
      const handleScroll = () => {
        checkIfAtBottom();
        updateFloatingDate();
        
        // Show floating date when scrolling starts
        setIsScrolling(true);
        
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
      // Check initial position
      checkIfAtBottom();
      
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

  // Function to scroll to bottom
  const scrollToBottom = React.useCallback(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setUnreadNewMessages(0); // Clear unread count when manually scrolling to bottom
      // Mark messages as read after scrolling
      setTimeout(() => {
        markMessagesAsRead();
      }, 500); // Wait for scroll animation to complete
    }
  }, [markMessagesAsRead]);

  // Lock background scroll when chat modal is open
  React.useEffect(() => {
    if (showChatModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showChatModal]);

  // Toast notification for new messages when chat is closed
  React.useEffect(() => {
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

  // Chat clearing and message removal events (keeping only these, parent handles commentUpdate)
  React.useEffect(() => {
    function handleChatClearedForUser({ appointmentId, clearedAt }) {
      if (appointmentId !== appt._id) return;
      setLocalComments([]);
      setUnreadNewMessages(0);
    }
    
    function handleCommentRemovedForUser({ appointmentId, commentId }) {
      if (appointmentId !== appt._id) return;
      setLocalComments(prev => prev.filter(c => c._id !== commentId));
    }

    socket.on('chatClearedForUser', handleChatClearedForUser);
    socket.on('commentRemovedForUser', handleCommentRemovedForUser);
    return () => {
      socket.off('chatClearedForUser', handleChatClearedForUser);
      socket.off('commentRemovedForUser', handleCommentRemovedForUser);
    };
  }, [appt._id]);

  React.useEffect(() => {
    const handleCommentDelivered = (data) => {
      if (data.appointmentId === appt._id) {
        setLocalComments(prev =>
          prev.map(c =>
            c._id === data.commentId
              ? { ...c, status: c.status === "read" ? "read" : "delivered", deliveredAt: new Date() }
              : c
          )
        );
      }
    };
    
    const handleCommentRead = (data) => {
      if (data.appointmentId === appt._id) {
        setLocalComments(prev =>
          prev.map(c =>
            !c.readBy?.includes(data.userId)
              ? { ...c, status: "read", readBy: [...(c.readBy || []), data.userId], readAt: new Date() }
              : c
          )
        );
      }
    };
    
    const handleChatCleared = (data) => {
      if (data.appointmentId === appt._id) {
        setLocalComments([]);
        toast.success('Chat deleted by admin');
      }
    };
    socket.on('chatCleared', handleChatCleared);
    socket.on('commentDelivered', handleCommentDelivered);
    socket.on('commentRead', handleCommentRead);
    
    return () => {
      socket.off('chatCleared', handleChatCleared);
      socket.off('commentDelivered', handleCommentDelivered);
      socket.off('commentRead', handleCommentRead);
    };
  }, [appt._id, showChatModal, currentUser.email, isAtBottom]);

  // Keyboard shortcut Ctrl+F to focus message input
  React.useEffect(() => {
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
      message: caption || `📷 ${fileName}`,
      imageUrl: imageUrl,
      status: "sending",
      timestamp: new Date().toISOString(),
      readBy: [currentUser._id],
      type: "image"
    };

    // Immediately update UI
    setLocalComments(prev => [...prev, tempMessage]);
    
    // Scroll to bottom
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }

    // Send message in background
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, 
        { 
          message: caption || `📷 ${fileName}`,
          imageUrl: imageUrl,
          type: "image"
        },
        { 
          withCredentials: true,
          headers: { "Content-Type": "application/json" }
        }
      );
        // Find the new comment from the response
        const newCommentFromServer = data.comments[data.comments.length - 1];
        
        // Update only the status and ID of the temp message, keeping it visible
        setLocalComments(prev => prev.map(msg => 
          msg._id === tempId 
            ? { 
                ...msg, 
                _id: newCommentFromServer._id,
                status: newCommentFromServer.status,
                readBy: newCommentFromServer.readBy || msg.readBy,
                timestamp: newCommentFromServer.timestamp || msg.timestamp
              }
            : msg
          ));
    } catch (error) {
      console.error('Send image error:', error);
      setLocalComments(prev => prev.filter(msg => msg._id !== tempId));
      toast.error(error.response?.data?.message || "Failed to send image.");
    }
  };

  const handleImageFiles = (files) => {
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
    
    setUploadingFile(true);
    setUploadProgress(0);
    
    try {
      // Upload images sequentially so we can show progress
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const uploadFormData = new FormData();
        uploadFormData.append('image', file);
        
        const { data } = await axios.post(`${API_BASE_URL}/api/upload/image`, 
          uploadFormData,
          { 
            withCredentials: true,
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (evt) => {
              if (evt.total) {
                const perFile = Math.round((evt.loaded * 100) / evt.total);
                const overall = Math.round(((i + perFile / 100) / selectedFiles.length) * 100);
                setUploadProgress(overall);
              }
            }
          }
        );
        
        await sendImageMessage(data.imageUrl, file.name, imageCaptions[file.name] || '');
        setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
      }
      
      // Clear state
      setSelectedFiles([]);
      setImageCaptions({});
      setPreviewIndex(0);
      setShowImagePreviewModal(false);
    } catch (error) {
      console.error('File upload error:', error);
      setFileUploadError(error.response?.data?.message || 'Upload failed. Please try again.');
      toast.error(error.response?.data?.message || 'Upload failed. Please try again.');
      // Auto-hide error message after 3 seconds
      setTimeout(() => setFileUploadError(''), 3000);
    } finally {
      setUploadingFile(false);
      setUploadProgress(0);
    }
  };

  const handleCommentSend = async () => {
    if (!newComment.trim()) return;
    // Close emoji picker on send
    window.dispatchEvent(new Event('closeEmojiPicker'));
    
    // Trigger send icon animation
    setSendIconAnimating(true);
    
    // Store the message content and reply before clearing the input
    const messageContent = newComment.trim();
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
    setLocalComments(prev => [...prev, tempMessage]);
    try { playMessageSent(); } catch(_) {}
    setNewComment("");
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
        const newCommentFromServer = data.comments[data.comments.length - 1];
        
        // Update only the status and ID of the temp message, keeping it visible
        setLocalComments(prev => prev.map(msg => 
          msg._id === tempId 
            ? { 
                ...msg, 
                _id: newCommentFromServer._id,
                status: newCommentFromServer.status,
                readBy: newCommentFromServer.readBy || msg.readBy,
                timestamp: newCommentFromServer.timestamp || msg.timestamp
              }
            : msg
        ));
        
        // Don't show success toast as it's too verbose for chat
      } catch (err) {
        // Remove the temp message and show error
        setLocalComments(prev => prev.filter(msg => msg._id !== tempId));
        setNewComment(messageContent); // Restore message
        toast.error(err.response?.data?.message || "Failed to send message.");
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
    setLocalComments(optimisticUpdate);
    
    try {
      const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${commentId}`, 
        { message: editText },
        { 
          withCredentials: true,
          headers: { "Content-Type": "application/json" }
        }
      );
      console.log('Edit response:', { data });
        // Update with server response
        setLocalComments(prev => prev.map(c => {
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
        setNewComment(""); // Clear the main input
        setDetectedUrl(null);
        setPreviewDismissed(false);
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
    } catch (err) {
      console.error('Error editing comment:', err);
      // Revert optimistic update on error
      setLocalComments(prev => prev.map(c => 
        c._id === commentId 
          ? { ...c, message: c.originalMessage || c.message, edited: c.wasEdited || false }
          : c
      ));
      setEditingComment(commentId);
      setEditText(editText);
      setNewComment(editText); // Restore the text in main input for retry
      toast.error("An error occurred. Please try again.");
    } finally {
      setSavingComment(null);
    }
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

  const startEditing = (comment) => {
    setEditingComment(comment._id);
    setEditText(comment.message);
    setNewComment(comment.message); // Set the message in the main input
    // Store original data for potential rollback
    setLocalComments(prev => prev.map(c => 
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
        autoResizeTextarea(inputRef.current);
      }
    }, 100);
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

  const showMessageInfo = (message) => {
    setSelectedMessageForInfo(message);
    setShowMessageInfoModal(true);
  };

  // Removed pin/unpin handler

  // Check if comment is from current admin user
  const isAdminComment = (comment) => {
    return comment.senderEmail === currentUser?.email;
  };

  // Add function to check if appointment is upcoming
  const isUpcoming = new Date(appt.date) > new Date() || (new Date(appt.date).toDateString() === new Date().toDateString() && (!appt.time || appt.time > new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })));

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
    
    const results = localComments
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
    
    const firstMessageOfDate = localComments.find(comment => {
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

  const getStatusColor = (status) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-700";
      case "accepted": return "bg-green-100 text-green-700";
      case "rejected": return "bg-red-100 text-red-700";
      case "cancelledByBuyer": return "bg-red-100 text-red-700";
      case "cancelledBySeller": return "bg-red-100 text-red-700";
      case "cancelledByAdmin": return "bg-red-100 text-red-700";
      case "deletedByAdmin": return "bg-gray-100 text-gray-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  // Password check before opening chat
  const handleChatButtonClick = () => {
    setShowPasswordModal(true);
    setAdminPassword("");
  };

  // Fetch latest comments when chat modal opens
  const fetchLatestComments = async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/bookings/${appt._id}`, {
        withCredentials: true
      });
      if (data.comments) {
          // Preserve starred status and temp messages from current state
          // Preserve starred status from current state
          const updatedComments = data.comments.map(newComment => {
            const existingComment = localComments.find(c => c._id === newComment._id);
            if (existingComment && existingComment.starredBy) {
              return { ...newComment, starredBy: existingComment.starredBy };
            }
            return newComment;
          });

          // Add back any local temp messages that haven't been confirmed yet
          const localTempMessages = localComments.filter(c => c._id.startsWith('temp-'));
          const serverCommentIds = new Set(data.comments.map(c => c._id));
          
          localTempMessages.forEach(tempMsg => {
            if (!serverCommentIds.has(tempMsg._id)) {
              updatedComments.push(tempMsg);
            }
          });
          
          setLocalComments(updatedComments);
        }
    } catch (err) {
      console.error('Error fetching latest comments:', err);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    try {
      // Call backend to verify admin password
      const { data } = await axios.post(`${API_BASE_URL}/api/auth/verify-password`, 
        { password: adminPassword },
        { 
          withCredentials: true,
          headers: { "Content-Type": "application/json" }
        }
      );
      if (data.success) {
        setShowPasswordModal(false);
        setShowChatModal(true);
        // Fetch latest comments when chat opens
        setTimeout(() => {
          fetchLatestComments();
        }, 100);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to verify password. Please try again.");
    }
    setPasswordLoading(false);
  };

  // Handle delete confirmation
  const handleDeleteClick = (message) => {
    setMessageToDelete(message);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!messageToDelete) return;
    
    try {
      // Admin deletion is always for everyone
      if (Array.isArray(messageToDelete)) {
        const ids = messageToDelete.map(m => m._id);
        const { data } = await axios.delete(`${API_BASE_URL}/api/bookings/${appt._id}/comments/bulk-delete`, {
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' },
          data: { commentIds: ids }
        });
          if (data?.comments) {
            setLocalComments(data.comments);
          }
          toast.success(`Deleted ${ids.length} messages for everyone!`);
        } else {
          const wasUnread = !messageToDelete.readBy?.includes(currentUser._id) && 
                           messageToDelete.senderEmail !== currentUser.email;
          const { data } = await axios.delete(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${messageToDelete._id}`, {
            withCredentials: true
          });
            setLocalComments(data.comments);
            if (wasUnread) {
              setUnreadNewMessages(prev => Math.max(0, prev - 1));
            }
            toast.success("Message deleted successfully!");
        }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete message.');
    }
    
    setShowDeleteModal(false);
    setMessageToDelete(null);
  };

  // Store locally hidden deleted message IDs per appointment
  function getLocallyHiddenIds(apptId) {
    try {
      return JSON.parse(localStorage.getItem(`hiddenDeletedMsgs_${apptId}`)) || [];
    } catch {
      return [];
    }
  }
  
  // Optimized functions that update both state and localStorage instantly
  const hideMessage = React.useCallback((msgId) => {
    setHiddenMessageIds(prev => {
      if (!prev.includes(msgId)) {
        const updated = [...prev, msgId];
        // Update localStorage asynchronously to avoid blocking UI
        setTimeout(() => {
          localStorage.setItem(`hiddenDeletedMsgs_${appt._id}`, JSON.stringify(updated));
        }, 0);
        return updated;
      }
      return prev;
    });
  }, [appt._id]);
  
  const showMessage = React.useCallback((msgId) => {
    setHiddenMessageIds(prev => {
      const updated = prev.filter(id => id !== msgId);
      // Update localStorage asynchronously to avoid blocking UI
      setTimeout(() => {
        localStorage.setItem(`hiddenDeletedMsgs_${appt._id}`, JSON.stringify(updated));
      }, 0);
      return updated;
    });
  }, [appt._id]);

  return (
          <tr className={`hover:bg-blue-50 transition align-top ${isArchived ? 'bg-gray-50' : ''} ${!isUpcoming ? (isArchived ? 'bg-gray-100' : 'bg-gray-100') : ''}`}>
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
              to={`/admin/listing/${appt.listingId._id}`}
              className="font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
            >
              {appt.propertyName}
            </Link>
          ) : (
            <div className="font-semibold">{appt.propertyName}</div>
          )}
        </div>
      </td>
      <td className="border p-2">
        <button
          onClick={() => onUserClick(appt.buyerId?._id)}
          className="text-blue-600 hover:text-blue-800 hover:underline text-left"
          title="Click to view buyer details"
        >
          <div className="font-semibold">{appt.buyerId?.username || 'Unknown'}</div>
          <div className="text-sm text-gray-600">{appt.buyerId?.email || appt.email}</div>
          <div className="text-sm text-gray-600">{appt.buyerId?.mobileNumber || 'No phone'}</div>
        </button>
      </td>
      <td className="border p-2">
        <button
          onClick={() => onUserClick(appt.sellerId?._id)}
          className="text-blue-600 hover:text-blue-800 hover:underline text-left"
          title="Click to view seller details"
        >
          <div className="font-semibold">{appt.sellerId?.username || 'Unknown'}</div>
          <div className="text-sm text-gray-600">{appt.sellerId?.email}</div>
          <div className="text-sm text-gray-600">{appt.sellerId?.mobileNumber || 'No phone'}</div>
        </button>
      </td>
      <td className="border p-2 capitalize">{appt.purpose}</td>
      <td className="border p-2 max-w-xs truncate">{appt.message}</td>
      <td className="border p-2 text-center">
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(appt.status)}`}>
          {appt.status === "deletedByAdmin" ? "Deleted by Admin" :
           appt.status === "cancelledByBuyer" ? "Cancelled by Buyer" :
           appt.status === "cancelledBySeller" ? "Cancelled by Seller" :
           appt.status === "cancelledByAdmin" ? "Cancelled by Admin" :
           appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
        </span>
        {appt.status === "deletedByAdmin" && appt.adminComment && (
          <div className="text-xs text-gray-600 mt-1">"{appt.adminComment}"</div>
        )}
      </td>
      <td className="border p-2 text-center">
        <div className="flex flex-col gap-2">
          {isArchived ? (
            // Archived appointments - show unarchive button
            <button
              className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
              onClick={() => handleUnarchiveAppointment(appt._id)}
              title="Unarchive Appointment"
            >
              <FaUndo /> Unarchive
            </button>
          ) : (
            // Active appointments - show archive button and other actions
            <>
              {appt.status === "cancelledByAdmin" ? (
                <button
                  className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
                  onClick={() => handleReinitiateAppointment(appt._id)}
                  title="Reinitiate Appointment (Admin)"
                >
                  <FaUserShield /> Reinitiate
                </button>
              ) : appt.status !== "deletedByAdmin" ? (
                <button
                  className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg hover:from-red-600 hover:to-red-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
                  onClick={() => handleAdminCancel(appt._id)}
                  title="Cancel Appointment (Admin)"
                >
                  <FaUserShield /> Cancel
                </button>
              ) : null}
              
              {/* Archive button for all active appointments */}
              <button
                className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
                onClick={() => handleArchiveAppointment(appt._id)}
                title="Archive Appointment"
              >
                <FaArchive /> Archive
              </button>
            </>
          )}
        </div>
      </td>
      <td className="border p-2 text-center relative">
        <button
          className="flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full p-3 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 mx-auto relative group"
          title="Open Chat"
          onClick={handleChatButtonClick}
        >
          <FaCommentDots size={22} className="group-hover:animate-pulse" />
          <div className="absolute inset-0 bg-white rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
        </button>
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xs relative flex flex-col items-center">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
                onClick={() => setShowPasswordModal(false)}
                title="Close"
              >
                <FaTimes className="w-4 h-4" />
              </button>
              <h3 className="text-lg font-bold mb-4 text-blue-700 flex items-center gap-2">
                <FaUserShield /> Admin Password Required
              </h3>
              <form onSubmit={handlePasswordSubmit} className="w-full flex flex-col gap-3">
                <input
                  type="password"
                  className="border rounded px-3 py-2 w-full focus:ring-2 focus:ring-blue-200"
                  placeholder="Enter your password"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  required
                  autoFocus
                />
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full font-semibold"
                  disabled={passwordLoading}
                >
                  {passwordLoading ? "Verifying..." : "Unlock Chat"}
                </button>
              </form>
            </div>
          </div>
        )}
        {showChatModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-white via-blue-50 to-purple-50 rounded-3xl shadow-2xl w-full h-full max-w-6xl max-h-full p-0 relative animate-fadeIn flex flex-col border border-gray-200 transform transition-all duration-500 hover:shadow-3xl">
                                                              <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b-2 border-blue-700 bg-gradient-to-r from-blue-700 via-purple-700 to-blue-900 rounded-t-3xl relative shadow-2xl sticky top-[env(safe-area-inset-top,0px)] z-30">
                {isSelectionMode ? (
                  // Multi-select header
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-white text-sm cursor-pointer hover:text-blue-200 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedMessages.length === localComments.length && localComments.length > 0}
                          onChange={() => {
                            if (selectedMessages.length === localComments.length) {
                              // If all are selected, deselect all
                              setSelectedMessages([]);
                            } else {
                              // Select all non-deleted messages
                              setSelectedMessages([...localComments]);
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
                                            setLocalComments(prev => {
                                              const updated = prev.map(c => 
                                                c._id === selectedMsg._id 
                                                  ? { 
                                                      ...c, 
                                                      starredBy: isStarred 
                                                        ? (c.starredBy || []).filter(id => id !== currentUser._id)
                                                        : [...(c.starredBy || []), currentUser._id]
                                                    }
                                                  : c
                                              );
                                              
                                              // Update appointment comments for parent component with the updated state
                                              updateAppointmentComments(appt._id, updated);
                                              
                                              return updated;
                                            });
                                            toast.success(isStarred ? 'Message unstarred.' : 'Message starred.');
                                        } catch (err) {
                                          toast.error('Failed to update star status');
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
                                    <button
                                      className="text-white hover:text-red-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                                      onClick={() => { 
                                        setMessageToDelete(selectedMsg);
                                        setShowDeleteModal(true);
                                        setIsSelectionMode(false);
                                        setSelectedMessages([]);
                                      }}
                                      title="Delete"
                                      aria-label="Delete"
                                    >
                                      <FaTrash size={18} />
                                    </button>
                                  </>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      ) : selectedMessages.length > 1 ? (
                        // Multiple messages selected - show bulk actions
                        <div className="flex items-center gap-2">
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

                                    
                                    const response = await axios.patch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${msg._id}/star`, 
                                      { starred: !isStarred },
                                      {
                                        withCredentials: true,
                                        headers: { 'Content-Type': 'application/json' }
                                      }
                                    );
                                    

                                    successCount++;
                                    
                                    // Update this specific message in local comments
                                    setLocalComments(prev => {
                                      const updated = prev.map(c => 
                                        c._id === msg._id 
                                          ? { 
                                              ...c, 
                                              starredBy: isStarred 
                                                ? (c.starredBy || []).filter(id => id !== currentUser._id)
                                                : [...(c.starredBy || []), currentUser._id]
                                            }
                                          : c
                                      );
                                      
                                      // Update appointment comments for parent component with the updated state
                                      updateAppointmentComments(appt._id, updated);
                                      
                                      return updated;
                                    });
                                    
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
                          {/* Pinning removed */}
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
                            className="text-white hover:text-red-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            onClick={() => {
                              setMessageToDelete(selectedMessages);
                              setShowDeleteModal(true);
                              setIsSelectionMode(false);
                              setSelectedMessages([]);
                            }}
                            title="Delete all selected messages"
                            aria-label="Delete all selected messages"
                          >
                            <FaTrash size={18} />
                          </button>
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
                  <div className="flex items-center justify-end w-full gap-4">
                    <div className="flex items-center gap-4">
                      {/* For deleted messages, only show star and close options */}
                      {selectedMessageForHeaderOptions.deleted ? (
                        <>
                          {/* Star/Unstar - for deleted messages */}
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
                                  setLocalComments(prev => {
                                    const updated = prev.map(c => 
                                      c._id === selectedMessageForHeaderOptions._id 
                                        ? { 
                                            ...c, 
                                            starredBy: isStarred 
                                              ? (c.starredBy || []).filter(id => id !== currentUser._id)
                                              : [...(c.starredBy || []), currentUser._id]
                                          }
                                        : c
                                    );
                                    
                                    // Update appointment comments for parent component with the updated state
                                    updateAppointmentComments(appt._id, updated);
                                    
                                    return updated;
                                  });
                                  
                                  // Update starred messages list
                                  if (isStarred) {
                                    // Remove from starred messages
                                    setStarredMessages(prev => prev.filter(m => m._id !== selectedMessageForHeaderOptions._id));
                                  } else {
                                    // Add to starred messages
                                    setStarredMessages(prev => [...prev, selectedMessageForHeaderOptions]);
                                  }
                                  
                                  toast.success(isStarred ? 'Message unstarred' : 'Message starred');
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
                          {/* Close button for deleted messages */}
                          <button
                            onClick={() => setHeaderOptionsMessageId(null)}
                            className="text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            title="Close options"
                            aria-label="Close options"
                          >
                            <FaTimes size={18} />
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Regular message options for non-deleted messages */}
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
                          <button
                            className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            onClick={() => { copyMessageToClipboard(selectedMessageForHeaderOptions.message); setHeaderOptionsMessageId(null); }}
                            title="Copy message"
                            aria-label="Copy message"
                          >
                            <FaCopy size={18} />
                          </button>
                          {/* Star/Unstar - for regular messages */}
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
                                  setLocalComments(prev => {
                                    const updated = prev.map(c => 
                                      c._id === selectedMessageForHeaderOptions._id 
                                        ? { 
                                            ...c, 
                                            starredBy: isStarred 
                                              ? (c.starredBy || []).filter(id => id !== currentUser._id)
                                              : [...(c.starredBy || []), currentUser._id]
                                          }
                                        : c
                                    );
                                    
                                    // Update appointment comments for parent component with the updated state
                                    updateAppointmentComments(appt._id, updated);
                                    
                                    return updated;
                                  });
                                  
                                  // Update starred messages list
                                  if (isStarred) {
                                    // Remove from starred messages
                                    setStarredMessages(prev => prev.filter(m => m._id !== selectedMessageForHeaderOptions._id));
                                  } else {
                                    // Add to starred messages
                                    setStarredMessages(prev => [...prev, selectedMessageForHeaderOptions]);
                                  }
                                  
                                  toast.success(isStarred ? 'Message unstarred' : 'Message starred');
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
                        </>
                      )}
                      {/* Three-dots menu: sent -> Info, Edit, Delete; received -> Info, Delete */}
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
                                    onClick={() => { startEditing(selectedMessageForHeaderOptions); setShowHeaderMoreMenu(false); setHeaderOptionsMessageId(null); }}
                                    disabled={editingComment !== null}
                                  >
                                    <FaPen className="text-sm" />
                                    Edit
                                  </button>
                                  <button
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    onClick={() => { handleDeleteClick(selectedMessageForHeaderOptions); setShowHeaderMoreMenu(false); setHeaderOptionsMessageId(null); }}
                                  >
                                    <FaTrash className="text-sm" />
                                    Delete
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                    onClick={() => { showMessageInfo(selectedMessageForHeaderOptions); setShowHeaderMoreMenu(false); setHeaderOptionsMessageId(null); }}
                                  >
                                    <FaInfoCircle className="text-sm" />
                                    Info
                                  </button>
                                  <button
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    onClick={() => { handleDeleteClick(selectedMessageForHeaderOptions); setShowHeaderMoreMenu(false); setHeaderOptionsMessageId(null); }}
                                  >
                                    <FaTrash className="text-sm" />
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
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
                  <>
                    <div className="bg-white rounded-full p-1.5 shadow-lg">
                      <FaCommentDots className="text-blue-600 text-lg" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Live Chat</h3>

                    <div className="flex items-center gap-3 ml-auto">

                      
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
                            
                            {/* Pinned Messages option removed */}
                            
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
                            {/* User details option for buyer */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              onClick={() => {
                                onUserClick(appt.buyerId?._id);
                                setShowChatOptionsMenu(false);
                              }}
                            >
                              <FaUser className="text-sm" />
                              View Buyer Details
                            </button>
                            {/* User details option for seller */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              onClick={() => {
                                onUserClick(appt.sellerId?._id);
                                setShowChatOptionsMenu(false);
                              }}
                            >
                              <FaUser className="text-sm" />
                              View Seller Details
                            </button>
                            {/* Divider line */}
                            <div className="border-t border-gray-200 my-1"></div>
                            {/* Delete chat option */}
                            {localComments.length > 0 && (
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                onClick={() => {
                                  setShowDeleteChatModal(true);
                                  setShowChatOptionsMenu(false);
                                }}
                              >
                                <FaTrash className="text-sm" />
                                Delete Entire Chat
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
                      {/* Scroll to bottom button when there are unread messages */}
                      {unreadNewMessages > 0 && !isAtBottom && (
                        <button
                          className="text-blue-500 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full p-2 transition-colors shadow animate-bounce"
                          onClick={scrollToBottom}
                          title="Scroll to latest messages"
                          aria-label="Scroll to latest messages"
                        >
                          <FaCommentDots className="text-sm" />
                        </button>
                      )}
                      <button
                        className="text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors z-10 shadow"
                        onClick={() => setShowChatModal(false)}
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
              
              <div 
                ref={chatContainerRef} 
                className={`flex-1 overflow-y-auto space-y-2 mb-4 px-4 pt-4 animate-fadeInChat relative bg-gradient-to-b from-transparent to-blue-50/30 ${isDragOver ? 'bg-blue-50/50 border-2 border-dashed border-blue-300' : ''}`}
                style={{minHeight: '400px', maxHeight: 'calc(100vh - 200px)'}}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(true);
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(true);
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
                  
                  const files = Array.from(e.dataTransfer.files);
                  const imageFiles = files.filter(file => file.type.startsWith('image/'));
                  
                  if (imageFiles.length > 0) {
                    handleImageFiles(imageFiles);
                  } else if (files.length > 0) {
                    toast.error('Only image files are supported');
                  }
                }}
              >
                {/* Privacy Notice for Admins */}
                <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-400 rounded-r-lg mb-4 transform transition-all duration-500 hover:scale-105 hover:shadow-lg hover:from-blue-100 hover:to-purple-100 hover:border-blue-500 hover:border-l-6 backdrop-blur-sm">
                  <p className="text-sm text-blue-700 font-medium text-center flex items-center justify-center gap-2">
                    <span className="animate-gentlePulse">🔒</span>
                    Chats are encrypted and secure. View only for valid purposes like disputes or fraud checks. Unauthorized access or sharing is prohibited and will be logged.
                  </p>
                </div>
                
                {/* Pinned Messages Section removed */}
                
                {/* Floating Date Indicator */}
                {currentFloatingDate && localComments.length > 0 && (
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
                {localComments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <FaCommentDots className="text-gray-300 text-4xl mb-3" />
                    <p className="text-gray-500 font-medium text-sm">No messages yet</p>
                    <p className="text-gray-400 text-xs mt-1">Start a conversation to communicate with the parties</p>
                  </div>
                ) : (
                  localComments.map((c, index) => {
                  const isMe = c.senderEmail === currentUser.email;
                  const isEditing = editingComment === c._id;
                  const currentDate = new Date(c.timestamp);
                  const previousDate = index > 0 ? new Date(localComments[index - 1].timestamp) : null;
                  const isNewDay = previousDate ? currentDate.toDateString() !== previousDate.toDateString() : true;

                  return (
                    <React.Fragment key={c._id || index}>
                      {isNewDay && (
                        <div className="w-full flex justify-center my-2">
                                                      <span className="bg-blue-600 text-white text-xs px-4 py-2 rounded-full shadow-lg border-2 border-white">{getDateLabel(currentDate)}</span>
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
                          data-message-id={c._id}
                          className={`rounded-2xl px-4 sm:px-5 py-3 text-sm shadow-xl max-w-[90%] sm:max-w-[80%] md:max-w-[70%] lg:max-w-[60%] xl:max-w-[50%] break-words overflow-hidden relative transition-all duration-300 min-h-[60px] ${
                            isMe 
                              ? 'bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-500 hover:to-purple-600 text-white shadow-blue-200 hover:shadow-blue-300 hover:shadow-2xl' 
                              : 'bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 shadow-gray-200 hover:shadow-lg hover:border-gray-300 hover:shadow-xl'
                          } ${isSelectionMode && selectedMessages.some(msg => msg._id === c._id) ? 'ring-2 ring-blue-400' : ''}`}
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
                                  {localComments.find(msg => msg._id === c.replyTo)?.message?.substring(0, 30) || 'Original message'}{localComments.find(msg => msg._id === c.replyTo)?.message?.length > 30 ? '...' : ''}
                                </span>
                              </div>
                            )}
                        <div className="font-semibold mb-2 flex items-center gap-2 justify-start text-left">
                          <span className={`truncate max-w-[120px] min-w-[60px] inline-block align-middle overflow-hidden text-ellipsis text-left ${
                            isMe ? 'text-blue-100' : 'text-gray-700'
                          }`}>
                            {isMe ? "You" : (() => {
                              // Check if sender is buyer or seller to get their name
                              const isSenderBuyer = c.senderEmail === appt.buyerId?.email;
                              const isSenderSeller = c.senderEmail === appt.sellerId?.email;
                              
                              if (isSenderBuyer) {
                                return appt.buyerId?.username || c.senderName || c.senderEmail;
                              } else if (isSenderSeller) {
                                return appt.sellerId?.username || c.senderName || c.senderEmail;
                              } else {
                                // Sender is neither buyer nor seller (could be another admin)
                                return c.senderName || c.senderEmail;
                              }
                            })()}
                          </span>
                        </div>
                        <div className={`text-left ${isMe ? 'text-base font-medium' : 'text-sm'}`}>
                          {c.deleted ? (
                            (() => {
                              // Check if admin has hidden this deleted message locally using state
                              const locallyHidden = hiddenMessageIds.includes(c._id);
                              if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) {
                                if (locallyHidden) {
                                  // Show collapsed placeholder for hidden deleted message
                                  return (
                                    <div className="border border-gray-300 bg-gray-100 rounded p-2 mb-2">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-gray-600 text-xs">
                                          <FaBan className="inline-block" />
                                          <span>Deleted message hidden from view</span>
                                        </div>
                                        <button
                                          className="text-xs text-blue-500 hover:text-blue-700 underline"
                                          onClick={() => showMessage(c._id)}
                                          title="Show this deleted message content"
                                        >
                                          Show
                                        </button>
                                      </div>
                                    </div>
                                  );
                                }
                                
                                // Show full deleted message content
                                return (
                                  <div className="border border-red-300 bg-red-50 rounded p-2 mb-2">
                                    <div className="flex items-center gap-2 text-red-600 text-xs font-semibold mb-1">
                                      <FaBan className="inline-block" />
                                      Message deleted by {c.deletedBy || 'user'} (Admin view - preserved for records)
                                    </div>
                                    
                                    {/* Show preserved image if exists */}
                                    {(c.originalImageUrl || c.imageUrl) && (
                                      <div className="mb-2">
                                        <img
                                          src={c.originalImageUrl || c.imageUrl}
                                          alt="Preserved image from deleted message"
                                          className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                                                                      onClick={() => {
                                              const chatImages = (comments || []).filter(msg => !!(msg.originalImageUrl || msg.imageUrl)).map(msg => msg.originalImageUrl || msg.imageUrl);
                                              const currentUrl = c.originalImageUrl || c.imageUrl;
                                              const startIndex = Math.max(0, chatImages.indexOf(currentUrl));
                                              setPreviewImages(chatImages);
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
                                    
                                    <div className="text-gray-800 bg-white p-2 rounded border-l-4 border-red-400 relative group">
                                      {(() => {
                                        const messageContent = c.originalMessage || c.message;
                                        if (messageContent) {
                                          return (
                                            <>
                                              <span className="whitespace-pre-wrap break-words">{messageContent}</span>
                                              {/* Copy icon - visible on hover */}
                                              <button
                                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-500 hover:text-gray-700 bg-white rounded p-1 shadow-sm"
                                                onClick={() => copyMessageToClipboard(messageContent)}
                                                title="Copy deleted message content"
                                                aria-label="Copy deleted message content"
                                              >
                                                <FaCopy className="text-xs" />
                                              </button>
                                            </>
                                          );
                                        } else {
                                          return (
                                            <span className="text-gray-500 italic">
                                              [Message content not preserved - this message was deleted before content preservation was implemented]
                                            </span>
                                          );
                                        }
                                      })()}
                                    </div>

                                    <button
                                      className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
                                      onClick={() => hideMessage(c._id)}
                                      title="Hide this deleted message from your admin view"
                                    >
                                      Hide from admin view
                                    </button>
                                  </div>
                                );
                              } else {
                                // Regular users see standard deletion message
                                return (
                                  <span className="flex items-center gap-1 text-gray-400 italic">
                                    <FaBan className="inline-block text-lg" /> This message has been deleted.
                                  </span>
                                );
                              }
                            })()
                                                        ) : (
                                <div>
                                  {isEditing ? (
                                    <div className="bg-yellow-100 border-l-4 border-yellow-400 px-2 py-1 rounded">
                                      <span className="text-yellow-800 text-xs font-medium">✏️ Editing this message below...</span>
                                    </div>
                                  ) : (
                                    <>
                                      {/* Image Message - Show preserved image if message is deleted */}
                                      {(c.originalImageUrl || c.imageUrl) && (
                                        <div className="mb-2">
                                          <img
                                            src={c.originalImageUrl || c.imageUrl}
                                            alt="Shared image"
                                            className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => {
                                              const chatImages = (comments || []).filter(msg => !!(msg.originalImageUrl || msg.imageUrl)).map(msg => msg.originalImageUrl || msg.imageUrl);
                                              const currentUrl = c.originalImageUrl || c.imageUrl;
                                              const startIndex = Math.max(0, chatImages.indexOf(currentUrl));
                                              setPreviewImages(chatImages);
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
                                      {/* Link Preview in Message */}
                                      {(() => {
                                        // Only show preview if it wasn't dismissed before sending
                                        if (c.previewDismissed) return null;
                                        
                                        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
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
                                      
                                      <span className="whitespace-pre-wrap break-words">{formatLinksInText((c.message || '').replace(/\n+$/, ''), isMe)}</span>
                                      {c.edited && (
                                        <span className="ml-2 text-[10px] italic text-gray-300 whitespace-nowrap">(Edited)</span>
                                      )}
                                    </>
                                  )}
                                </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 justify-end mt-2" data-message-actions>
                          {/* Star icon for starred messages */}
                          {c.starredBy && c.starredBy.includes(currentUser._id) && (
                            <FaStar className={`${isMe ? 'text-yellow-300' : 'text-yellow-500'} text-[10px]`} />
                          )}
                          <span className={`${isMe ? 'text-blue-200' : 'text-gray-500'} text-[10px]`}>
                            {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </span>
                          {/* Options icon - visible for all messages (including deleted) */}
                          <button
                            className={`${c.senderEmail === currentUser.email ? 'text-blue-200 hover:text-white' : 'text-gray-500 hover:text-gray-700'} transition-all duration-200 hover:scale-110 p-1 rounded-full hover:bg-white hover:bg-opacity-20 ml-1`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setHeaderOptionsMessageId(c._id);
                            }}
                            title="Message options"
                            aria-label="Message options"
                          >
                            <FaEllipsisV size={c.senderEmail === currentUser.email ? 14 : 12} />
                          </button>
                          
                          {/* Read status indicator - always visible for sent messages */}
                          {(c.senderEmail === currentUser.email) && !c.deleted && (
                            <span className="ml-1 flex items-center gap-1">
                              {c.readBy?.some(userId => userId !== currentUser._id)
                                ? <FaCheckDouble className="text-green-400 text-xs transition-all duration-300 animate-fadeIn" title="Read" />
                                : c.status === "delivered"
                                  ? <FaCheckDouble className="text-blue-200 text-xs transition-all duration-300 animate-fadeIn" title="Delivered" />
                                  : c.status === "sending"
                                    ? <FaCheckDouble className="text-blue-200 text-xs animate-pulse transition-all duration-300" title="Sending..." />
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
                        setNewComment(""); 
                        setDetectedUrl(null);
                        setPreviewDismissed(false);
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
              
              <div className="flex gap-2 mt-1 px-3 pb-2 items-end">
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
                    placeholder={editingComment ? "Edit your message..." : "Type a message..."}
                    value={newComment}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewComment(value);
                      
                                              // Detect URLs in the input
                        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
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
                  <div className="absolute right-12 bottom-2">
                    <EmojiButton 
                      onEmojiClick={(emoji) => {
                        // Use live input value and caret selection for robust insertion
                        const el = inputRef?.current;
                        const baseText = el ? el.value : newComment;
                        let start = baseText.length;
                        let end = baseText.length;
                        try {
                          if (el && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
                            start = el.selectionStart;
                            end = el.selectionEnd;
                          }
                        } catch (_) {}
                        const newText = baseText.slice(0, start) + emoji + baseText.slice(end);
                        setNewComment(newText);
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
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) {
                          handleFileUpload(files);
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
                                      disabled={editingComment ? savingComment === editingComment : !newComment.trim()}
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
                            const currentCaption = imageCaptions[selectedFiles[previewIndex]?.name] || '';
                            setImageCaptions(prev => ({
                              ...prev,
                              [selectedFiles[previewIndex]?.name]: currentCaption + emoji
                            }));
                          }}
                          className="w-6 h-6"
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1 text-right">
                        {(imageCaptions[selectedFiles[previewIndex]?.name] || '').length}/500
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        {selectedFiles.length} image{selectedFiles.length !== 1 ? 's' : ''} ready to send
                      </div>
                      <button
                        onClick={handleSendImagesWithCaptions}
                        disabled={uploadingFile}
                        className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        {uploadingFile ? (
                          <>
                            <div className="w-20 h-2 bg-white/30 rounded-full overflow-hidden">
                              <div className="h-2 bg-white rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                            </div>
                            <span>{uploadProgress}%</span>
                          </>
                        ) : (
                          `Send ${selectedFiles.length} Image${selectedFiles.length !== 1 ? 's' : ''}`
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
              
                             {/* Floating Scroll to bottom button - WhatsApp style */}
               {!isAtBottom && !editingComment && !replyTo && (
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
               {/* Delete Chat Confirmation Modal (overlay above chat) */}
               {showDeleteChatModal && (
                 <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-50">
                   <div className="bg-white rounded-xl p-6 w-full max-w-sm relative shadow-2xl">
                     <button
                       className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
                       onClick={() => { setShowDeleteChatModal(false); setDeleteChatPassword(''); }}
                       title="Close"
                       aria-label="Close"
                     >
                       <FaTimes className="w-4 h-4" />
                     </button>
                     <h3 className="text-lg font-bold mb-4 text-red-600 flex items-center gap-2">
                       <FaTrash /> Delete Entire Chat
                     </h3>
                     <p className="text-sm text-gray-600 mb-3">This will permanently delete all messages for this appointment. Enter admin password to confirm.</p>
                     <input
                       type="password"
                       className="border rounded px-3 py-2 w-full focus:ring-2 focus:ring-red-200 mb-4"
                       placeholder="Admin password"
                       value={deleteChatPassword}
                       onChange={e => setDeleteChatPassword(e.target.value)}
                       onKeyDown={e => {
                         if (e.key === 'Enter' && deleteChatPassword.trim() && !deleteChatLoading) {
                           e.preventDefault();
                           // Execute delete chat functionality
                           (async () => {
                             try {
                               setDeleteChatLoading(true);
                               const { data } = await axios.delete(`${API_BASE_URL}/api/bookings/${appt._id}/comments`, {
                                 withCredentials: true,
                                 headers: { 'Content-Type': 'application/json' },
                                 data: { password: deleteChatPassword }
                               });
                                 setLocalComments([]);
                                 toast.success('Chat deleted successfully.');
                                 setShowDeleteChatModal(false);
                                 setDeleteChatPassword('');
                             } catch (e) {
                               toast.error(e.response?.data?.message || 'Failed to delete chat');
                             } finally {
                               setDeleteChatLoading(false);
                             }
                           })();
                         }
                       }}
                       autoFocus
                     />
                     <div className="flex gap-3 justify-end">
                       <button
                         type="button"
                         onClick={() => { setShowDeleteChatModal(false); setDeleteChatPassword(''); }}
                         className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors"
                       >
                         Cancel
                       </button>
                       <button
                         type="button"
                         disabled={deleteChatLoading || !deleteChatPassword}
                         onClick={async () => {
                           try {
                             setDeleteChatLoading(true);
                             const { data } = await axios.delete(`${API_BASE_URL}/api/bookings/${appt._id}/comments`, {
                               withCredentials: true,
                               headers: { 'Content-Type': 'application/json' },
                               data: { password: deleteChatPassword }
                             });
                                                                setLocalComments([]);
                                 toast.success('Chat deleted successfully.');
                                 setShowDeleteChatModal(false);
                                 setDeleteChatPassword('');
                             } catch (e) {
                               toast.error(e.response?.data?.message || 'Failed to delete chat');
                             } finally {
                             setDeleteChatLoading(false);
                           }
                         }}
                         className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-60"
                       >
                         {deleteChatLoading ? 'Deleting...' : (
                           <>
                             <FaTrash size={12} /> Delete Chat
                           </>
                         )}
                       </button>
                     </div>
                   </div>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* Delete Message Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-4 animate-fadeIn">
              <div className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <FaTrash className="text-red-600 text-xl" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Delete Message</h3>
                    <p className="text-sm text-gray-600 leading-relaxed text-justify">
                      Are you sure you want to delete this message for everyone?
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteModal(false);
                      setMessageToDelete(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
                  >
                    <FaTrash size={14} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Appointment Modal */}
        {showCancelModal && appointmentToHandle === appt._id && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-4 animate-fadeIn">
              <div className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <FaBan className="text-red-600 text-xl" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Cancel Appointment</h3>
                    <p className="text-sm text-gray-600 leading-relaxed text-justify mb-4">
                      Are you sure you want to cancel this appointment?
                    </p>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reason for cancellation (required):
                      </label>
                      <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        rows="3"
                        placeholder="Please provide a reason for cancelling this appointment..."
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCancelModal(false);
                      setAppointmentToHandle(null);
                      setCancelReason('');
                    }}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmAdminCancel}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
                  >
                    <FaBan size={14} />
                    Cancel Appointment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reinitiate Appointment Modal */}
        {showReinitiateModal && appointmentToHandle === appt._id && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-4 animate-fadeIn">
              <div className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <FaUndo className="text-green-600 text-xl" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Reinitiate Appointment</h3>
                    <p className="text-sm text-gray-600 leading-relaxed text-justify">
                      Are you sure you want to reinitiate this appointment? This will notify both buyer and seller.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReinitiateModal(false);
                      setAppointmentToHandle(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmReinitiate}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <FaUndo size={14} />
                    Reinitiate
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Archive Appointment Modal */}
        {showArchiveModal && appointmentToHandle === appt._id && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-4 animate-fadeIn">
              <div className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <FaArchive className="text-blue-600 text-xl" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Archive Appointment</h3>
                    <p className="text-sm text-gray-600 leading-relaxed text-justify">
                      Are you sure you want to archive this appointment? It will be moved to the archived section.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowArchiveModal(false);
                      setAppointmentToHandle(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmArchive}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <FaArchive size={14} />
                    Archive
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Unarchive Appointment Modal */}
        {showUnarchiveModal && appointmentToHandle === appt._id && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-4 animate-fadeIn">
              <div className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <FaUndo className="text-green-600 text-xl" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Unarchive Appointment</h3>
                    <p className="text-sm text-gray-600 leading-relaxed text-justify">
                      Are you sure you want to unarchive this appointment? It will be moved back to the active appointments.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnarchiveModal(false);
                      setAppointmentToHandle(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmUnarchive}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <FaUndo size={14} />
                    Unarchive
                  </button>
                </div>
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
                                {isMe ? 'You' : (() => {
                                  // Find the sender name based on senderEmail
                                  if (message.senderEmail === appt.buyerId?.email) {
                                    return appt.buyerId?.username || 'Buyer';
                                  } else if (message.senderEmail === appt.sellerId?.email) {
                                    return appt.sellerId?.username || 'Seller';
                                  } else {
                                    // For admin messages or other cases
                                    return message.senderName || 'UrbanSetu';
                                  }
                                })()}
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
                                      // Remove from starred messages list
                                      setStarredMessages(prev => prev.filter(m => m._id !== message._id));
                                      // Update the main comments state
                                      setLocalComments(prev => {
                                        const updated = prev.map(c => 
                                          c._id === message._id 
                                            ? { ...c, starredBy: (c.starredBy || []).filter(id => id !== currentUser._id) }
                                            : c
                                        );
                                        
                                        // Update appointment comments for parent component with the updated state
                                        updateAppointmentComments(appt._id, updated);
                                        
                                        return updated;
                                      });
                                      toast.success('Message unstarred');
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
                                {/* Image Message - Always show if exists, even for deleted messages */}
                                {(message.originalImageUrl || message.imageUrl) && (
                                  <div className="mb-2">
                                    <img
                                      src={message.originalImageUrl || message.imageUrl}
                                      alt="Shared image"
                                      className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                                                              onClick={(e) => {
                                          e.stopPropagation();
                                          const chatImages = (comments || []).filter(msg => !!(msg.originalImageUrl || msg.imageUrl)).map(msg => msg.originalImageUrl || msg.imageUrl);
                                          const currentUrl = message.originalImageUrl || message.imageUrl;
                                          const startIndex = Math.max(0, chatImages.indexOf(currentUrl));
                                          setPreviewImages(chatImages);
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
                                
                                {/* Message content - Show preserved content for deleted messages */}
                                {message.deleted ? (
                                  <div className="border border-red-300 bg-red-50 rounded p-2 mb-2">
                                    <div className="flex items-center gap-2 text-red-600 text-xs font-semibold mb-1">
                                      <FaBan className="inline-block" />
                                      Message deleted by {message.deletedBy || 'user'} (Admin view - preserved for records)
                                    </div>
                                    <div className="text-gray-800 bg-white p-2 rounded border-l-4 border-red-400 relative group">
                                      {(() => {
                                        const messageContent = message.originalMessage || message.message;
                                        if (messageContent) {
                                          return (
                                            <>
                                              <span className="whitespace-pre-wrap break-words">{messageContent}</span>
                                              {/* Copy icon - visible on hover */}
                                              <button
                                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-500 hover:text-gray-700 bg-white rounded p-1 shadow-sm"
                                                onClick={(e) => { e.stopPropagation(); copyMessageToClipboard(messageContent); }}
                                                title="Copy deleted message content"
                                                aria-label="Copy deleted message content"
                                              >
                                                <FaCopy className="w-3 h-3" />
                                              </button>
                                            </>
                                          );
                                        } else {
                                          return (
                                            <span className="text-gray-500 italic">
                                              [Message content not preserved - this message was deleted before content preservation was implemented]
                                            </span>
                                          );
                                        }
                                      })()}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="whitespace-pre-wrap break-words">
                                    {formatLinksInText((message.message || '').replace(/\n+$/, ''), isMe)}
                                  </span>
                                )}
                              </div>
                              
                              {/* Copy button - appears on hover for non-deleted messages */}
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
        
              {/* Pin Message Modal */}
      {/* Pin Message Modal removed */}

      {/* Image Preview Modal */}
      <ImagePreview
        isOpen={showImagePreview}
        onClose={() => setShowImagePreview(false)}
        images={previewImages}
        initialIndex={previewIndex}
      />
      </td>
    </tr>
  );
}
