import React, { useEffect, useState, useCallback, useMemo } from "react";
import { FaTrash, FaSearch, FaPen, FaPaperPlane, FaUser, FaEnvelope, FaCalendar, FaPhone, FaUserShield, FaArchive, FaUndo, FaCommentDots, FaCheck, FaCheckDouble, FaBan, FaTimes, FaLightbulb, FaCopy, FaEllipsisV, FaInfoCircle } from "react-icons/fa";
import UserAvatar from '../components/UserAvatar';
import { useSelector } from "react-redux";
import { useState as useLocalState } from "react";
import { Link } from "react-router-dom";
import { toast, ToastContainer } from 'react-toastify';
import { socket } from "../utils/socket";
// Note: Do not import server-only libs here

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminAppointments() {
  const { currentUser } = useSelector((state) => state.user);
  const [appointments, setAppointments] = useState([]);
  const [archivedAppointments, setArchivedAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
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

  // Function to update comments for a specific appointment
  const updateAppointmentComments = useCallback((appointmentId, comments) => {
    setUpdatedComments(prev => {
      const currentComments = prev[appointmentId];
      // Only update if there are actual changes
      if (JSON.stringify(currentComments) !== JSON.stringify(comments)) {
        console.log('🔄 AdminAppointments: Updating appointment comments:', {
          appointmentId,
          oldCount: currentComments?.length || 0,
          newCount: comments.length
        });
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
      const res = await fetch(`${API_BASE_URL}/api/bookings`, { credentials: 'include' });
      const data = await res.json();
      setAppointments(data);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch appointments", err);
      setLoading(false);
    }
  }, []);

  const fetchArchivedAppointments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/archived`, {
        credentials: 'include'
      });
      const data = await res.json();
      setArchivedAppointments(data);
    } catch (err) {
      console.error("Failed to fetch archived appointments", err);
    }
  }, []);

  useEffect(() => {
    // Check socket connection status
    console.log('🔌 AdminAppointments: Socket connected:', socket.connected);
    console.log('🔌 AdminAppointments: Socket ID:', socket.id);
    
    // Join admin appointments room to receive real-time updates
    if (socket.connected && currentUser) {
      socket.emit('adminAppointmentsActive', { 
        adminId: currentUser._id,
        role: currentUser.role 
      });
      console.log('🔌 AdminAppointments: Joined admin appointments room');
    }
    
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
      console.log('🔔 AdminAppointments: Received commentUpdate event:', data);
      
      // Skip handling if this is a message sent by current admin user to prevent duplicates
      // Admin messages are already added locally in handleCommentSend
      if (data.comment.senderEmail === currentUser?.email) {
        console.log('🔔 AdminAppointments: Skipping own message to prevent duplicate');
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
              const existingComment = appt.comments[existingCommentIndex];
              if (JSON.stringify(existingComment) !== JSON.stringify(data.comment)) {
                const updatedComments = [...(appt.comments || [])];
                updatedComments[existingCommentIndex] = data.comment;
                return { ...appt, comments: updatedComments };
              }
              return appt; // No changes needed
            } else {
              // Add new comment only if it's not from current user (to prevent duplicates)
              const updatedComments = [...(appt.comments || []), data.comment];
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
              const existingComment = appt.comments[existingCommentIndex];
              if (JSON.stringify(existingComment) !== JSON.stringify(data.comment)) {
                const updatedComments = [...(appt.comments || [])];
                updatedComments[existingCommentIndex] = data.comment;
                return { ...appt, comments: updatedComments };
              }
              return appt; // No changes needed
            } else {
              // Add new comment only if it's not from current user (to prevent duplicates)
              const updatedComments = [...(appt.comments || []), data.comment];
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
          // Update existing comment
          newComments[existingCommentIndex] = data.comment;
        } else {
          // Add new comment only if it's not from current user (to prevent duplicates)
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
      console.log('🔌 AdminAppointments: Socket connected');
    };
    const handleDisconnect = () => {
      console.log('🔌 AdminAppointments: Socket disconnected');
    };
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    
    return () => {
      clearInterval(interval);
      socket.off('profileUpdated', handleProfileUpdate);
      socket.off('commentUpdate', handleCommentUpdate);
      socket.off('appointmentUpdate', handleAppointmentUpdate);
      socket.off('appointmentCreated', handleAppointmentCreated);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [fetchAppointments, fetchArchivedAppointments]);

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
      console.log('Attempting to cancel appointment:', appointmentToHandle);
      console.log('Current user:', currentUser);
      console.log('User role:', currentUser.role);
      console.log('Admin approval status:', currentUser.adminApprovalStatus);
      
      // Find the appointment to check its current status
      const appointment = appointments.find(appt => appt._id === appointmentToHandle);
      if (appointment) {
        console.log('Current appointment status:', appointment.status);
        console.log('Appointment date:', appointment.date);
        console.log('Appointment time:', appointment.time);
      }
      
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appointmentToHandle}/cancel`, { 
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ reason: cancelReason }),
      });
      
      console.log('Response status:', res.status);
      const data = await res.json();
      console.log('Response data:', data);
      
      if (res.ok) {
        setAppointments((prev) =>
          prev.map((appt) => (appt._id === appointmentToHandle ? { ...appt, status: "cancelledByAdmin", cancelReason: cancelReason } : appt))
        );
        toast.success("Appointment cancelled successfully. Both buyer and seller have been notified of the cancellation.");
      } else {
        toast.error(data.message || "Failed to cancel appointment.");
      }
      
      // Close modal and reset state
      setShowCancelModal(false);
      setAppointmentToHandle(null);
      setCancelReason('');
    } catch (err) {
      console.error('Error in confirmAdminCancel:', err);
      toast.error("An error occurred. Please try again.");
    }
  };

  const handleReinitiateAppointment = async (id) => {
    setAppointmentToHandle(id);
    setShowReinitiateModal(true);
  };

  const confirmReinitiate = async () => {
    try {
      console.log('Attempting to reinitiate appointment:', appointmentToHandle);
      
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appointmentToHandle}/reinitiate`, { 
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
      });
      
      console.log('Response status:', res.status);
      const data = await res.json();
      console.log('Response data:', data);
      
      if (res.ok) {
        setAppointments((prev) =>
          prev.map((appt) => (appt._id === appointmentToHandle ? { ...appt, status: "pending", cancelReason: "" } : appt))
        );
        toast.success("Appointment reinitiated successfully. Both buyer and seller have been notified.");
      } else {
        toast.error(data.message || "Failed to reinitiate appointment.");
      }
      
      // Close modal and reset state
      setShowReinitiateModal(false);
      setAppointmentToHandle(null);
    } catch (err) {
      console.error('Error in confirmReinitiate:', err);
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
        // Remove from active appointments and add to archived
        const archivedAppt = appointments.find(appt => appt._id === appointmentToHandle);
        if (archivedAppt) {
          setAppointments((prev) => prev.filter((appt) => appt._id !== appointmentToHandle));
          setArchivedAppointments((prev) => [{ ...archivedAppt, archivedByAdmin: true, archivedAt: new Date() }, ...prev]);
        }
        toast.success("Appointment archived successfully.");
      } else {
        toast.error(data.message || "Failed to archive appointment.");
      }
      
      // Close modal and reset state
      setShowArchiveModal(false);
      setAppointmentToHandle(null);
    } catch (err) {
      console.error('Error in confirmArchive:', err);
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
        // Remove from archived appointments and add back to active
        const unarchivedAppt = archivedAppointments.find(appt => appt._id === appointmentToHandle);
        if (unarchivedAppt) {
          setArchivedAppointments((prev) => prev.filter((appt) => appt._id !== appointmentToHandle));
          setAppointments((prev) => [{ ...unarchivedAppt, archivedByAdmin: false, archivedAt: undefined }, ...prev]);
        }
        toast.success("Appointment unarchived successfully.");
      } else {
        toast.error(data.message || "Failed to unarchive appointment.");
      }
      
      // Close modal and reset state
      setShowUnarchiveModal(false);
      setAppointmentToHandle(null);
    } catch (err) {
      console.error('Error in confirmUnarchive:', err);
      toast.error("An error occurred. Please try again.");
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
      const res = await fetch(`${API_BASE_URL}/api/user/id/${userId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedUser(data);
      } else {
        toast.error("Failed to fetch user details.");
        setShowUserModal(false);
      }
    } catch (err) {
      toast.error("An error occurred while fetching user details.");
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
      return matchesStatus && matchesSearch && matchesDate;
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
      return matchesStatus && matchesSearch && matchesDate;
    }).map((appt) => ({
      ...appt,
      comments: updatedComments[appt._id] || appt.comments || []
    }));
  }, [archivedAppointments, statusFilter, search, startDate, endDate, updatedComments]);

  // Add this function to fetch latest data on demand
  const handleManualRefresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAppointments(data);
      }
      const resArchived = await fetch(`${API_BASE_URL}/api/bookings/archived`, { credentials: 'include' });
      if (resArchived.ok) {
        const dataArchived = await resArchived.json();
        setArchivedAppointments(Array.isArray(dataArchived) ? dataArchived : []);
      }
    } catch (err) {
      // Optionally handle error
    } finally {
      setLoading(false);
    }
  };

  // Function to copy message to clipboard
  const copyMessageToClipboard = (messageText) => {
    console.log('Copy button clicked, message:', messageText);
    
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
        console.log('Copy successful via fallback method');
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
            {showArchived ? "Archived Appointments" : "All Appointments (Admin View)"}
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

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <label className="font-semibold">Status:</label>
            <select
              className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200"
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
          <div className="flex items-center gap-2">
            <label className="font-semibold">From:</label>
            <input
              type="date"
              className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              max={endDate || undefined}
            />
            <label className="font-semibold">To:</label>
            <input
              type="date"
              className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              min={startDate || undefined}
            />
          </div>
          <div className="flex items-center gap-2">
            <FaSearch className="text-gray-500 hover:text-blue-500 transition-colors duration-200" />
            <input
              type="text"
              className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200"
              placeholder="Search by email, property, or username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors z-10 shadow"
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
                {/* Header with gradient background */}
                <div className="flex flex-col items-center justify-center bg-gradient-to-r from-blue-100 to-purple-100 rounded-t-2xl px-6 py-6 border-b border-gray-200">
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
  const [localComments, setLocalComments] = useLocalState(appt.comments || []);
  
  // Debug log when component mounts
  React.useEffect(() => {
    console.log('🚀 AdminAppointmentRow mounted:', {
      appointmentId: appt._id,
      initialCommentsCount: appt.comments?.length || 0,
      localCommentsCount: localComments.length,
      hasComments: !!appt.comments
    });
  }, [appt._id, appt.comments?.length, localComments.length]);
  const [newComment, setNewComment] = useLocalState("");
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
  const scrollTimeoutRef = React.useRef(null);
  const [showDeleteChatModal, setShowDeleteChatModal] = useLocalState(false);
  const [deleteChatPassword, setDeleteChatPassword] = useLocalState("");
  const [deleteChatLoading, setDeleteChatLoading] = useLocalState(false);
  
  // Message info modal state
  const [showMessageInfoModal, setShowMessageInfoModal] = useLocalState(false);
  const [selectedMessageForInfo, setSelectedMessageForInfo] = useLocalState(null);
  const [sendIconAnimating, setSendIconAnimating] = useLocalState(false);
  const [sendIconSent, setSendIconSent] = useLocalState(false);

  const selectedMessageForHeaderOptions = headerOptionsMessageId ? localComments.find(msg => msg._id === headerOptionsMessageId) : null;

  // Auto-close shortcut tip after 10 seconds
  React.useEffect(() => {
    if (showShortcutTip) {
      const timer = setTimeout(() => {
        setShowShortcutTip(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showShortcutTip]);

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

  // Removed handleClickOutside functionality - options now only close when clicking three dots again

  // Auto-scroll to bottom only when chat modal opens
  React.useEffect(() => {
    if (showChatModal && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showChatModal]);

  // Sync localComments back to parent component whenever they change - but only when necessary
  React.useEffect(() => {
    if (updateAppointmentComments && localComments.length > 0) {
      try {
        // Update parent with local comments to maintain synchronization
        console.log('🔄 AdminAppointments Chat: Updating parent with localComments:', {
          appointmentId: appt._id,
          localCommentsCount: localComments.length
        });
        updateAppointmentComments(appt._id, localComments);
      } catch (error) {
        console.error('Error updating parent with localComments:', error);
      }
    }
  }, [localComments, appt._id, updateAppointmentComments]);

  // Listen for comment updates from parent component (socket events)
  React.useEffect(() => {
    // This effect will run when appt.comments changes (from parent socket updates)
    const serverComments = appt.comments || [];
    
    // Check if there are actual changes in content, not just count
    const hasChanges = JSON.stringify(localComments) !== JSON.stringify(serverComments);
    
    if (hasChanges) {
      console.log('🔄 AdminAppointments Chat: Received update from parent:', {
        appointmentId: appt._id,
        serverCommentsCount: serverComments.length,
        localCommentsCount: localComments.length,
        hasContentChanges: hasChanges
      });
      
      // Update localComments with the latest from parent
      setLocalComments(serverComments);
        
        // Handle unread message count and auto-scroll for new messages
        if (serverComments.length > localComments.length) {
          // New messages were added
          const newMessages = serverComments.slice(localComments.length);
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
                fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/read`, {
                  method: 'PATCH',
                  credentials: 'include'
                });
              }, 100);
            }
          }
        }
      }
    }
  }, [appt.comments, appt._id, showChatModal, isAtBottom, currentUser.email]);

  // Initialize localComments with appointment comments when component mounts
  React.useEffect(() => {
    if (appt.comments && localComments.length === 0) {
      console.log('🚀 AdminAppointments Chat: Initializing localComments:', {
        appointmentId: appt._id,
        commentsCount: appt.comments.length
      });
      setLocalComments(appt.comments);
    }
  }, [appt._id, appt.comments?.length]);

  // Preserve local comments when appointment data is refreshed - only when necessary
  React.useEffect(() => {
    if (appt.comments && localComments.length > 0) {
      // Only update if we have significantly different comment counts or if comments are missing
      const commentCountDiff = Math.abs(appt.comments.length - localComments.length);
      
      if (commentCountDiff > 1) {
        console.log('🔄 AdminAppointments: Syncing localComments due to significant count difference', {
          appointmentId: appt._id,
          serverCommentsCount: appt.comments.length,
          localCommentsCount: localComments.length,
          difference: commentCountDiff
        });
        setLocalComments(appt.comments);
      }
    }
  }, [appt._id, appt.comments?.length]);

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
        const response = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/read`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        
        if (response.ok) {
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
        }
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

  const handleCommentSend = async () => {
    if (!newComment.trim()) return;
    
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
      ...(replyToData ? { replyTo: replyToData._id } : {}),
    };

    // Immediately update UI - this makes the message appear instantly
    setLocalComments(prev => [...prev, tempMessage]);
    setNewComment("");
    setReplyTo(null);
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
          const newCommentFromServer = data.comments[data.comments.length - 1];
          
          // Replace the temp message with the real one
          setLocalComments(prev => prev.map(msg => 
            msg._id === tempId 
              ? { ...newCommentFromServer } // Use the status from server (could be 'sent' or 'delivered')
              : msg
          ));
          
          // Don't show success toast as it's too verbose for chat
        } else {
          // Remove the temp message and show error
          setLocalComments(prev => prev.filter(msg => msg._id !== tempId));
          setNewComment(messageContent); // Restore message
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
        setLocalComments(prev => prev.filter(msg => msg._id !== tempId));
        setNewComment(messageContent); // Restore message
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
    setLocalComments(optimisticUpdate);
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ message: editText }),
      });
      const data = await res.json();
      if (res.ok) {
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
        setLocalComments(prev => prev.map(c => 
          c._id === commentId 
            ? { ...c, message: c.originalMessage || c.message, edited: c.wasEdited || false }
            : c
        ));
        setEditingComment(commentId);
        setEditText(editText);
        setNewComment(editText); // Restore the text in main input for retry
        toast.error(data.message || "Failed to edit message.");
      }
    } catch (err) {
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
      }
    }, 100);
  };

  const startReply = (comment) => {
    setReplyTo(comment);
    // Focus the main input with comprehensive focus handling
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
    setTimeout(refocusInput, 50); // Initial focus
    setTimeout(refocusInput, 100); // Focus after DOM updates
    setTimeout(refocusInput, 200); // Final fallback
  };

  const showMessageInfo = (message) => {
    setSelectedMessageForInfo(message);
    setShowMessageInfoModal(true);
  };

  // Check if comment is from current admin user
  const isAdminComment = (comment) => {
    return comment.senderEmail === currentUser?.email;
  };

  // Add function to check if appointment is upcoming
  const isUpcoming = new Date(appt.date) > new Date() || (new Date(appt.date).toDateString() === new Date().toDateString() && (!appt.time || appt.time > new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })));

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
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.comments && data.comments.length !== localComments.length) {
          console.log('🔄 AdminAppointments Chat: Fetched latest comments from server:', {
            appointmentId: appt._id,
            serverCommentsCount: data.comments.length,
            localCommentsCount: localComments.length
          });
          setLocalComments(data.comments);
        }
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
      const res = await fetch(`${API_BASE_URL}/api/auth/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: adminPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowPasswordModal(false);
        setShowChatModal(true);
        // Fetch latest comments when chat opens
        setTimeout(() => {
          fetchLatestComments();
        }, 100);
      } else {
        toast.error("Incorrect password. Please try again.");
      }
    } catch (err) {
      toast.error("Failed to verify password. Please try again.");
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
      // Check if the message was unread by current user before deleting
      const wasUnread = !messageToDelete.readBy?.includes(currentUser._id) && 
                       messageToDelete.senderEmail !== currentUser.email;
      
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${messageToDelete._id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setLocalComments(data.comments);
        
        // Reduce unread count if the deleted message was unread
        if (wasUnread) {
          setUnreadNewMessages(prev => Math.max(0, prev - 1));
        }
        
        toast.success("Message deleted successfully!");
      } else {
        toast.error(data.message || 'Failed to delete message.');
      }
    } catch (err) {
      toast.error('An error occurred. Please try again.');
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
          {/* Unread message indicator */}
          {unreadNewMessages > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
              {unreadNewMessages > 9 ? '9+' : unreadNewMessages}
            </div>
          )}
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
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-700 via-purple-700 to-blue-900 rounded-t-3xl relative shadow-2xl ring-2 ring-blue-800">
                {headerOptionsMessageId && selectedMessageForHeaderOptions ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
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
                      {/* Info - show delivery and read times */}
                      {!selectedMessageForHeaderOptions.deleted && (
                        <button
                          className="text-white hover:text-blue-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                          onClick={() => { 
                            showMessageInfo(selectedMessageForHeaderOptions);
                            setHeaderOptionsMessageId(null);
                          }}
                          title="Message info"
                          aria-label="Message info"
                        >
                          <FaInfoCircle size={18} />
                        </button>
                      )}
                      {(selectedMessageForHeaderOptions.senderEmail === currentUser.email) && !selectedMessageForHeaderOptions.deleted && (
                        <>
                          <button
                            onClick={() => { startEditing(selectedMessageForHeaderOptions); setHeaderOptionsMessageId(null); }}
                            className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            title="Edit comment"
                            aria-label="Edit comment"
                            disabled={editingComment !== null}
                          >
                            <FaPen size={18} />
                          </button>
                          <button
                            className="text-white hover:text-red-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            onClick={() => { handleDeleteClick(selectedMessageForHeaderOptions); setHeaderOptionsMessageId(null); }}
                            title="Delete"
                            aria-label="Delete"
                          >
                            <FaTrash size={18} />
                          </button>
                        </>
                      )}
                      {(selectedMessageForHeaderOptions.senderEmail !== currentUser.email) && !selectedMessageForHeaderOptions.deleted && (
                        <button
                          className="text-white hover:text-red-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                          onClick={() => { handleDeleteClick(selectedMessageForHeaderOptions); setHeaderOptionsMessageId(null); }}
                          title="Delete"
                          aria-label="Delete"
                        >
                          <FaTrash size={18} />
                        </button>
                      )}
                    </div>
                    <button
                      className="text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors z-10 shadow"
                      onClick={() => setHeaderOptionsMessageId(null)}
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
                    {unreadNewMessages > 0 && (
                      <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold animate-pulse">
                        {unreadNewMessages} new message{unreadNewMessages > 1 ? 's' : ''}
                      </div>
                    )}
                    <div className="flex items-center gap-3 ml-auto">
                      {localComments.length > 0 && (
                        <button
                          className="text-red-100 hover:text-white bg-red-500/30 hover:bg-red-500/50 rounded-full p-2 transition-colors shadow flex items-center gap-2"
                          onClick={() => setShowDeleteChatModal(true)}
                          title="Delete entire chat"
                          aria-label="Delete chat"
                        >
                          <FaTrash className="text-sm" />
                        </button>
                      )}
                      <div className="relative">
                        <button
                          className="text-yellow-500 hover:text-yellow-600 bg-yellow-50 hover:bg-yellow-100 rounded-full p-2 transition-colors shadow"
                          onClick={() => setShowShortcutTip(!showShortcutTip)}
                          title="Keyboard shortcut tip"
                          aria-label="Show keyboard shortcut tip"
                        >
                          <FaLightbulb className="text-sm" />
                        </button>
                        {showShortcutTip && (
                          <div className="absolute top-full right-0 mt-2 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-20 whitespace-nowrap">
                            Press Ctrl + F to quickly focus and type your message.
                            <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-800 transform rotate-45"></div>
                          </div>
                        )}
                      </div>
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
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-2 mb-4 px-4 pt-4 animate-fadeInChat relative bg-gradient-to-b from-transparent to-blue-50/30" style={{minHeight: '400px', maxHeight: 'calc(100vh - 200px)'}}>
                {/* Privacy Notice for Admins */}
                <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-400 rounded-r-lg mb-4 transform transition-all duration-500 hover:scale-105 hover:shadow-lg hover:from-blue-100 hover:to-purple-100 hover:border-blue-500 hover:border-l-6 backdrop-blur-sm">
                  <p className="text-sm text-blue-700 font-medium text-center flex items-center justify-center gap-2">
                    <span className="animate-gentlePulse">🔒</span>
                    Chats are encrypted and secure. View only for valid purposes like disputes or fraud checks. Unauthorized access or sharing is prohibited and will be logged.
                  </p>
                </div>
                
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
                      <div 
                        ref={el => messageRefs.current[c._id] = el}
                        className={`rounded-2xl px-4 sm:px-5 py-3 text-sm shadow-xl max-w-[90%] sm:max-w-[80%] md:max-w-[70%] break-words overflow-hidden relative transition-all duration-300 min-h-[60px] transform hover:scale-[1.02] ${
                          isMe 
                            ? 'bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-500 hover:to-purple-600 text-white shadow-blue-200 hover:shadow-blue-300 hover:shadow-2xl' 
                            : 'bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 shadow-gray-200 hover:shadow-lg hover:border-gray-300 hover:shadow-xl'
                        }`}
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
                                    <div className="text-gray-800 bg-white p-2 rounded border-l-4 border-red-400">
                                      {(() => {
                                        // Debug logging for deleted messages
                                        if (process.env.NODE_ENV === 'development') {
                                          console.log('🔍 Deleted message render debug:', {
                                            messageId: c._id,
                                            hasOriginalMessage: !!c.originalMessage,
                                            originalMessage: c.originalMessage,
                                            hasMessage: !!c.message,
                                            message: c.message,
                                            deletedBy: c.deletedBy
                                          });
                                        }
                                        
                                        if (c.originalMessage) {
                                          return <span className="whitespace-pre-wrap break-words">{c.originalMessage}</span>;
                                        } else if (c.message) {
                                          return <span className="whitespace-pre-wrap break-words">{c.message}</span>;
                                        } else {
                                          return (
                                            <span className="text-gray-500 italic">
                                              [Message content not preserved - this message was deleted before content preservation was implemented]
                                            </span>
                                          );
                                        }
                                      })()}
                                    </div>
                                    {/* Debug info for development */}
                                    {process.env.NODE_ENV === 'development' && (
                                      <div className="mt-1 text-xs text-gray-500 font-mono">
                                        Debug: originalMessage={c.originalMessage ? 'exists' : 'null'}, 
                                        message={c.message ? 'exists' : 'empty'}, 
                                        deleted={c.deleted ? 'true' : 'false'}
                                      </div>
                                    )}
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
                          <span className={`${isMe ? 'text-blue-200' : 'text-gray-500'} text-[10px]`}>
                            {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </span>
                          {/* Options icon - only visible for non-deleted messages */}
                          {!c.deleted && (
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
                          )}
                          
                          {/* Read status indicator - always visible for sent messages */}
                          {(c.senderEmail === currentUser.email) && !c.deleted && (
                            <span className="ml-1 flex items-center gap-1">
                              {c.readBy?.some(userId => userId !== currentUser._id)
                                ? <FaCheckDouble className="text-green-400 text-xs" title="Read" />
                                : c.status === "delivered"
                                  ? <FaCheckDouble className="text-blue-200 text-xs" title="Delivered" />
                                  : c.status === "sending"
                                    ? <FaCheck className="text-blue-200 text-xs animate-pulse" title="Sending..." />
                                    : <FaCheck className="text-blue-200 text-xs" title="Sent" />}
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
                      }} 
                      title="Cancel edit"
                    >
                      <FaTimes className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
              
              <div className="flex gap-2 mt-1 px-3 pb-2">
                <textarea
                  rows={1}
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 shadow-lg transition-all duration-300 bg-white resize-y whitespace-pre-wrap break-all hover:border-blue-300 hover:shadow-xl focus:shadow-2xl transform hover:scale-[1.01]"
                  placeholder={editingComment ? "Edit your message..." : "Type a message..."}
                  value={newComment}
                  onChange={(e) => {
                    setNewComment(e.target.value);
                    if (editingComment) {
                      setEditText(e.target.value);
                    }
                  }}
                  onClick={() => {
                    if (headerOptionsMessageId) {
                      setHeaderOptionsMessageId(null);
                      toast.info("You can hit reply icon in header to reply");
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
                      <>
                        <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
                      </>
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
                               const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comments`, {
                                 method: 'DELETE',
                                 headers: { 'Content-Type': 'application/json' },
                                 credentials: 'include',
                                 body: JSON.stringify({ password: deleteChatPassword })
                               });
                               const data = await res.json();
                               if (res.ok) {
                                 setLocalComments([]);
                                 toast.success('Chat deleted successfully.');
                                 setShowDeleteChatModal(false);
                                 setDeleteChatPassword('');
                               } else {
                                 toast.error(data.message || 'Failed to delete chat');
                               }
                             } catch (e) {
                               toast.error('An error occurred. Please try again.');
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
                             const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comments`, {
                               method: 'DELETE',
                               headers: { 'Content-Type': 'application/json' },
                               credentials: 'include',
                               body: JSON.stringify({ password: deleteChatPassword })
                             });
                             const data = await res.json();
                             if (res.ok) {
                               setLocalComments([]);
                               toast.success('Chat deleted successfully.');
                               setShowDeleteChatModal(false);
                               setDeleteChatPassword('');
                             } else {
                               toast.error(data.message || 'Failed to delete chat');
                             }
                           } catch (e) {
                             toast.error('An error occurred. Please try again.');
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
      </td>
    </tr>
  );
}
