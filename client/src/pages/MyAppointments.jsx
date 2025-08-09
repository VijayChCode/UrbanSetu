import React, { useEffect, useState, useRef, useCallback } from "react";
import { FaTrash, FaSearch, FaPen, FaCheck, FaTimes, FaUserShield, FaUser, FaEnvelope, FaPhone, FaArchive, FaUndo, FaCommentDots, FaCheckDouble, FaBan, FaPaperPlane, FaCalendar, FaLightbulb, FaCopy, FaEllipsisV, FaFlag } from "react-icons/fa";
import UserAvatar from '../components/UserAvatar';
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
      try {
        const res = await fetch(`${API_BASE_URL}/api/bookings/archived`, {
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Not allowed');
        const data = await res.json();
        setArchivedAppointments(Array.isArray(data) ? data : []);
      } catch (err) {
        setArchivedAppointments([]);
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) {
          toast.error("Failed to fetch archived appointments");
        }
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
          autoClose: 5000,
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
          autoClose: 5000,
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
    if (statusFilter === 'outdated') {
      return isOutdated;
    }
    const matchesStatus = statusFilter === "all" ? true : appt.status === statusFilter;
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
    return matchesSearch && matchesDate;
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
      const resArchived = await fetch(`${API_BASE_URL}/api/bookings/archived`, { credentials: 'include' });
      if (resArchived.ok) {
        const dataArchived = await resArchived.json();
        setArchivedAppointments(Array.isArray(dataArchived) ? dataArchived : []);
      }
    } catch (err) {
      setError('Failed to refresh appointments. Please try again.');
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
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-3xl font-extrabold text-blue-700 drop-shadow">
              {showArchived ? "Archived Appointments" : "My Appointments"}
            </h3>
            {!showArchived && (
              <p className="text-sm text-gray-600 mt-1">
                💡 Outdated appointments (past their scheduled date) are automatically ignored when booking new appointments.
              </p>
            )}
          </div>
          <button
            onClick={handleManualRefresh}
            className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all font-semibold shadow-md ml-4"
            title="Refresh appointments"
          >
            Refresh
          </button>
          {/* Only show archived toggle for admin/rootadmin */}
          {currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin') && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`bg-gradient-to-r text-white px-6 py-3 rounded-lg transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 ${
                showArchived 
                  ? 'from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600' 
                  : 'from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700'
              }`}
            >
              {showArchived ? (
                <>
                  <FaUndo /> Active Appointments
                </>
              ) : (
                <>
                  <FaArchive /> Archived Appointments ({archivedAppointments.length})
                </>
              )}
            </button>
          )}
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <label className="font-semibold">Status:</label>
            <select
              className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200"
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
            <label className="font-semibold">Role:</label>
            <select
              className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="buyer">As Buyer</option>
              <option value="seller">As Seller</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <FaSearch className="text-gray-500" />
            <input
              type="text"
              className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200"
              placeholder="Search by property, message, or user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {/* Only show archived appointments table for admin/rootadmin */}
        {showArchived && currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? (
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
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
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
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-2 border-white rounded-full flex items-center justify-center">
                    <FaUser className="w-3 h-3 text-white" />
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
        <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
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
  
  // New modal states for various confirmations
  const [showDeleteAppointmentModal, setShowDeleteAppointmentModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAdminCancelModal, setShowAdminCancelModal] = useState(false);
  const [showPermanentDeleteModal, setShowPermanentDeleteModal] = useState(false);
  
  // Store appointment and reasons for modals
  const [appointmentToHandle, setAppointmentToHandle] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const messageRefs = useRef({}); // Add messageRefs here
  
  // New: track which message's options are shown in the header
  const [headerOptionsMessageId, setHeaderOptionsMessageId] = useState(null);

  // Auto-close shortcut tip after 10 seconds
  useEffect(() => {
    if (showShortcutTip) {
      const timer = setTimeout(() => {
        setShowShortcutTip(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showShortcutTip]);

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



  const isAdmin = (currentUser.role === 'admin' || currentUser.role === 'rootadmin') && currentUser.adminApprovalStatus === 'approved';
  const isAdminContext = location.pathname.includes('/admin');
  const isSeller = appt.role === 'seller';
  const isBuyer = appt.role === 'buyer';
  
  // Add function to check if appointment is upcoming
  const isUpcoming = new Date(appt.date) > new Date() || (new Date(appt.date).toDateString() === new Date().toDateString() && (!appt.time || appt.time > new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })));
  
  // Check if chat should be disabled (for outdated, pending, rejected, or cancelled by admin appointments)
  const isChatDisabled = !isUpcoming || appt.status === 'pending' || appt.status === 'rejected' || appt.status === 'cancelledByAdmin';
  
  const canSeeContactInfo = (isAdmin || appt.status === 'accepted') && isUpcoming;
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
        // Delete locally only
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

  const handleClearChat = () => {
    localStorage.setItem(clearTimeKey, Date.now());
    setComments([]);
    toast.success("Chat Cleared");
    setShowClearChatModal(false);
  };

  const handleCommentSend = async () => {
    if (!comment.trim()) return;
    
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
    setSending(true);

    // Scroll to bottom immediately after adding the message
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }

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
        
        // Replace the temp message with the real one
        setComments(prev => prev.map(msg => 
          msg._id === tempId 
            ? { ...newComment } // Use the status from server (could be 'sent' or 'delivered')
            : msg
        ));
        
        // Don't show success toast as it's too verbose for chat
      } else {
        // Remove the temp message and show error
        setComments(prev => prev.filter(msg => msg._id !== tempId));
        toast.error(data.message || "Failed to send message.");
      }
    } catch (err) {
      // Remove the temp message and show error
      setComments(prev => prev.filter(msg => msg._id !== tempId));
      toast.error('An error occurred. Please try again.');
    } finally {
      setSending(false);
    }
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
    setEditingComment(null);
    setEditText("");
    setComment(""); // Clear the main input
    
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
    // Focus the main input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select(); // Select all text for easy editing
      }
    }, 100);
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

  // User-side cancel handler (buyer/seller)
  const handleUserCancel = async () => {
    setCancelReason('');
    setShowCancelModal(true);
  };

  const confirmUserCancel = async () => {
    if (isSeller && !cancelReason.trim()) {
      toast.error('Reason is required for seller cancellation.');
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
          toast.success("Appointment removed from your table successfully");
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

  const markVisibleMessagesAsRead = useCallback(async () => {
    if (!chatContainerRef.current) return;
    
    // Only mark messages as read when user is at the bottom of chat AND has manually scrolled
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10; // 10px threshold
    
    if (!isAtBottom) return; // Don't mark as read if not at bottom
    
    const unreadMessages = comments.filter(c => 
      !c.readBy?.includes(currentUser._id) && 
      c.senderEmail !== currentUser.email
    );
    
    if (unreadMessages.length > 0) {
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
        }
      } catch (error) {
        console.error('Error marking messages as read:', error);
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
    const clearTime = Number(localStorage.getItem(clearTimeKey)) || 0;
    const locallyRemovedIds = getLocallyRemovedIds(appt._id);
    const filteredComments = comments.filter(c => new Date(c.timestamp).getTime() > clearTime && !locallyRemovedIds.includes(c._id));
    
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
              return [...prev, data.comment];
            }
            return prev;
          }
        });
        
        // If the message was deleted and was from another user, reduce unread count
        if (data.comment.deleted && data.comment.senderEmail !== currentUser.email) {
          // Simple approach: if there's an unread count, reduce it by one
          if (unreadCount > 0) {
            setUnreadNewMessages(prev => Math.max(0, prev - 1));
          }
        }
        
        // Auto-scroll for incoming messages if user is at bottom
        if (showChatModal && data.comment.senderEmail !== currentUser.email) {
          // Mark as read if chat is open
          setTimeout(() => {
            fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/read`, {
              method: 'PATCH',
              credentials: 'include'
            });
          }, 100);
          
          // Auto-scroll to show new message if user is near bottom
          setTimeout(() => {
            if (chatEndRef.current && isAtBottom) {
              chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
            }
          }, 50);
        }
      }
    }
    socket.on('commentUpdate', handleCommentUpdate);
    return () => {
      socket.off('commentUpdate', handleCommentUpdate);
    };
  }, [appt._id, setComments, showChatModal, currentUser.email, isAtBottom]);

  // Mark all comments as read when chat modal opens and fetch latest if needed
  useEffect(() => {
    if (showChatModal) {
      // Mark comments as read immediately
      fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/read`, {
        method: 'PATCH',
        credentials: 'include'
      });
      
      // Only fetch latest comments if we don't have any comments loaded
      if (comments.length === 0) {
        setLoadingComments(true);
        fetch(`${API_BASE_URL}/api/bookings/${appt._id}`)
          .then(res => res.json())
          .then(data => {
            if (data && Array.isArray(data.comments)) {
              setComments(data.comments);
            }
          })
          .catch(err => console.error('Failed to fetch comments:', err))
          .finally(() => setLoadingComments(false));
      }
    }
  }, [showChatModal, appt._id, comments.length]);

  // Listen for commentDelivered and commentRead events
  useEffect(() => {
    function handleCommentDelivered(data) {
      if (data.appointmentId === appt._id) {
        setComments(prev =>
          prev.map(c =>
            c._id === data.commentId
              ? { ...c, status: c.status === "read" ? "read" : "delivered" }
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
              ? { ...c, status: "read", readBy: [...(c.readBy || []), data.userId] }
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

  // Calculate unread messages for the current user (excluding locally removed messages)
  const locallyRemovedIds = getLocallyRemovedIds(appt._id);
  const unreadCount = comments.filter(c => 
    !c.readBy?.includes(currentUser._id) && 
    c.senderEmail !== currentUser.email &&
    !locallyRemovedIds.includes(c._id)
  ).length;



  useEffect(() => {
    if (showChatModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setUnreadNewMessages(0); // Reset unread count when chat is closed
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showChatModal]);

  // Get clear time from localStorage
  const clearTimeKey = `chatClearTime_${appt._id}`;
  const clearTime = Number(localStorage.getItem(clearTimeKey)) || 0;
  // Filter out locally removed deleted messages
  const filteredComments = comments.filter(c => new Date(c.timestamp).getTime() > clearTime && !locallyRemovedIds.includes(c._id));



  useEffect(() => {
    if (!showChatModal || !otherParty?._id) return;
    // Ask backend if the other party is online
    socket.emit('checkUserOnline', { userId: otherParty._id });
    // Listen for response
    function handleUserOnlineStatus(data) {
      if (data.userId === otherParty._id) {
        setIsOtherPartyOnline(!!data.online);
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
                onClick={() => onShowOtherParty(otherParty)}
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
            {/* For outdated appointments, only show delete button */}
            {!isUpcoming ? (
              <button
                className="text-gray-400 hover:text-red-700 text-xl"
                onClick={handlePermanentDelete}
                title="Delete outdated appointment from table"
                style={{ opacity: 0.7 }}
              >
                <FaTrash size={18} />
              </button>
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
            onClick={isChatDisabled ? undefined : () => setShowChatModal(true)}
            disabled={isChatDisabled}
          >
            <FaCommentDots size={22} className={!isChatDisabled ? "group-hover:animate-pulse" : ""} />
            {!isChatDisabled && (
              <div className="absolute inset-0 bg-white rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
            )}
            {/* Typing indicator - highest priority */}
            {isOtherPartyTyping && !isChatDisabled && (
              <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold border-2 border-white animate-pulse">
                ...
              </span>
            )}
            {/* Unread count when not typing */}
            {!isOtherPartyTyping && unreadCount > 0 && isChatDisabled && (
              <span className="absolute -top-1 -right-1 bg-gray-400 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold border-2 border-white">
                {unreadCount}
              </span>
            )}
            {!isOtherPartyTyping && unreadCount > 0 && !isChatDisabled && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold border-2 border-white">
                {unreadCount}
              </span>
            )}
            {/* Online status green dot - show when no typing and no unread count */}
            {!isOtherPartyTyping && unreadCount === 0 && isOtherPartyOnlineInTable && !isChatDisabled && (
              <span className="absolute -top-1 -right-1 bg-green-500 border-2 border-white rounded-full w-3 h-3"></span>
            )}
          </button>
        </td>
      </tr>
      {showChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-white via-blue-50 to-purple-50 rounded-3xl shadow-2xl w-full h-full max-w-6xl max-h-full p-0 relative animate-fadeIn flex flex-col border border-gray-200">
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
                <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 rounded-t-3xl relative">
                  {headerOptionsMessageId && selectedMessageForHeaderOptions ? (
                    // Header-level options overlay (options + close icon only)
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        {/* Reply */}
                        {!selectedMessageForHeaderOptions.deleted && (
                          <button
                            className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            onClick={() => { setReplyTo(selectedMessageForHeaderOptions); inputRef.current?.focus(); setHeaderOptionsMessageId(null); }}
                            title="Reply"
                            aria-label="Reply"
                          >
                            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c4.28 0 6.92 1.45 8.84 4.55.23.36.76.09.65-.32C18.31 13.13 15.36 10.36 10 9z"/></svg>
                          </button>
                        )}
                        {/* Copy */}
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
                        {/* Report (only for received messages, not deleted) */}
                        {(selectedMessageForHeaderOptions.senderEmail !== currentUser.email) && !selectedMessageForHeaderOptions.deleted && (
                          <button
                            className="text-white hover:text-red-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            onClick={() => {
                              setReportingMessage(selectedMessageForHeaderOptions);
                              setShowReportModal(true);
                              setHeaderOptionsMessageId(null);
                            }}
                            title="Report message"
                            aria-label="Report message"
                          >
                            <FaFlag size={18} />
                          </button>
                        )}
                        {/* Edit/Delete for own message */}
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
                        {/* Delete locally for received messages */}
                        {(selectedMessageForHeaderOptions.senderEmail !== currentUser.email) && !selectedMessageForHeaderOptions.deleted && (
                          <button
                            className="text-white hover:text-red-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            onClick={() => { handleDeleteReceivedMessage(selectedMessageForHeaderOptions); setHeaderOptionsMessageId(null); }}
                            title="Delete locally"
                            aria-label="Delete locally"
                          >
                            <FaTrash size={18} />
                          </button>
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
                        onClick={() => setHeaderOptionsMessageId(null)}
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
                        onClick={() => onShowOtherParty(otherParty)}
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
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <h3 
                            className="text-base sm:text-lg font-bold text-white truncate cursor-pointer hover:underline"
                            onClick={() => onShowOtherParty(otherParty)}
                            title="Click to view user details"
                          >
                            {otherParty?.username || 'Unknown User'}
                          </h3>
                          {/* Online status indicator - below name on mobile, inline on desktop */}
                          <div className="flex items-center gap-1 sm:hidden">
                            {isOtherPartyTyping ? (
                              <span className="text-yellow-100 font-semibold text-xs bg-yellow-500 bg-opacity-80 px-2 py-1 rounded-full whitespace-nowrap">Typing...</span>
                            ) : isOtherPartyOnline ? (
                              <span className="text-green-100 font-semibold text-xs bg-green-500 bg-opacity-80 px-2 py-1 rounded-full whitespace-nowrap">Online</span>
                            ) : (
                              <span className="text-gray-100 font-semibold text-xs bg-gray-500 bg-opacity-80 px-2 py-1 rounded-full whitespace-nowrap">Offline</span>
                            )}
                          </div>
                          {/* Online status indicator - inline on desktop only */}
                          <div className="hidden sm:flex items-center gap-1">
                            {isOtherPartyTyping ? (
                              <span className="text-yellow-100 font-semibold text-xs bg-yellow-500 bg-opacity-80 px-2 py-1 rounded-full whitespace-nowrap">Typing...</span>
                            ) : isOtherPartyOnline ? (
                              <span className="text-green-100 font-semibold text-xs bg-green-500 bg-opacity-80 px-2 py-1 rounded-full whitespace-nowrap">Online</span>
                            ) : (
                              <span className="text-gray-100 font-semibold text-xs bg-gray-500 bg-opacity-80 px-2 py-1 rounded-full whitespace-nowrap">Offline</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 ml-auto flex-shrink-0">
                        {filteredComments.length > 0 && (
                          <button
                            className="text-xs text-red-600 hover:underline"
                            onClick={() => setShowClearChatModal(true)}
                            title="Clear chat locally"
                          >
                            Clear Chat
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
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-2 mb-4 px-4 pt-4 animate-fadeInChat relative" style={{minHeight: '400px', maxHeight: 'calc(100vh - 200px)'}}>
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
                            data-message-id={c._id}
                            className={`rounded-2xl px-4 sm:px-5 py-3 text-sm shadow-xl max-w-[85%] sm:max-w-[70%] md:max-w-[60%] break-words overflow-hidden relative transform hover:scale-[1.02] transition-transform duration-200 min-h-[60px] min-w-[140px] ${isMe ? 'pr-24' : 'pr-20'} ${
                              isMe 
                                ? 'bg-gradient-to-r from-blue-600 to-purple-700 text-white shadow-blue-200' 
                                : 'bg-white text-gray-800 border border-gray-200 shadow-gray-200 hover:shadow-gray-300'
                            }`}
                            style={{ animationDelay: `${0.03 * index}s` }}
                          >
                            {/* Reply preview above message if this is a reply */}
                            {c.replyTo && (
                              <div className="border-l-4 border-purple-400 pl-3 mb-2 text-xs bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg w-full max-w-full break-words cursor-pointer transform hover:scale-[1.02] transition-transform duration-200" onClick={() => {
                                  if (messageRefs.current[c.replyTo]) {
                                    messageRefs.current[c.replyTo].scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    messageRefs.current[c.replyTo].classList.add('ring-2', 'ring-yellow-400');
                                    setTimeout(() => {
                                      messageRefs.current[c.replyTo].classList.remove('ring-2', 'ring-yellow-400');
                                    }, 1000);
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
                            <div className="flex items-center gap-1 mb-6">
                              {c.deleted ? (
                                <span className="flex items-center gap-1 text-gray-400 italic">
                                  <FaBan className="inline-block text-lg" /> {c.senderEmail === currentUser.email ? "You deleted this message" : "This message was deleted."}
                                </span>
                              ) : (
                                <div className={isMe ? 'text-base font-medium' : 'text-sm'}>
                                  {isEditing ? (
                                    <div className="bg-yellow-100 border-l-4 border-yellow-400 px-2 py-1 rounded">
                                      <span className="text-yellow-800 text-xs font-medium">✏️ Editing this message below...</span>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="whitespace-pre-wrap">{(c.message || '').replace(/\n+$/, '')}</span>
                                      {c.edited && (
                                        <span className="ml-2 text-[10px] italic text-gray-300 whitespace-nowrap">(Edited)</span>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className={`absolute bottom-2 right-2 flex items-center gap-1 text-[10px] ${isMe ? 'text-blue-200' : 'text-gray-500'}`}>
                              <span>
                                {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                              </span>
                              <button
                                className={`${isMe ? 'hover:bg-white hover:bg-opacity-20' : 'hover:bg-gray-100'} ml-1 p-1 rounded-full transition-colors`}
                                onClick={(e) => { e.stopPropagation(); setHeaderOptionsMessageId(c._id); }}
                                title="Message options"
                                aria-label="Message options"
                              >
                                <FaEllipsisV size={isMe ? 14 : 12} />
                              </button>
                              {(c.senderEmail === currentUser.email) && !c.deleted && (
                                <span className="flex items-center gap-1 ml-1">
                                  {c.readBy?.includes(otherParty?._id)
                                    ? <FaCheckDouble className="text-green-400 text-xs" title="Read" />
                                    : c.status === 'delivered'
                                      ? <FaCheckDouble className="text-blue-200 text-xs" title="Delivered" />
                                      : c.status === 'sending'
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
                          setComment(""); 
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
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 shadow-lg transition-all duration-200 bg-white resize-y whitespace-pre-wrap"
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
                    }}
                    onKeyDown={e => { 
                      if ((e.key === 'Enter') && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        if (editingComment) {
                          handleEditComment(editingComment);
                        } else {
                          handleCommentSend();
                        }
                      }
                    }}
                    ref={inputRef}
                  />
                  <button
                    onClick={editingComment ? () => handleEditComment(editingComment) : handleCommentSend}
                    disabled={(editingComment ? savingComment === editingComment : sending) || !comment.trim()}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-full text-sm font-semibold shadow-lg hover:from-blue-600 hover:to-purple-700 hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:transform-none flex items-center gap-2 min-w-24"
                  >
                    {editingComment ? (
                      savingComment === editingComment ? (
                        <>
                          <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
                          Saving...
                        </>
                      ) : (
                        'Save'
                      )
                    ) : sending ? (
                      <>
                        <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
                        Sending...
                      </>
                    ) : (
                      'Send'
                    )}
                  </button>
                </div>
                {/* Animations for chat bubbles */}
                <style jsx>{`
                  @keyframes fadeInChatBubble {
                    from { opacity: 0; transform: translateY(10px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                  }
                  .animate-fadeInChatBubble {
                    animation: fadeInChatBubble 0.4s cubic-bezier(0.4,0,0.2,1) both;
                  }
                  @keyframes fadeInChat {
                    from { opacity: 0; }
                    to { opacity: 1; }
                  }
                  .animate-fadeInChat {
                    animation: fadeInChat 0.3s cubic-bezier(0.4,0,0.2,1) both;
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
                Reason for cancellation {isSeller ? '(required)' : '(optional)'}:
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional details (optional)</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  rows={4}
                  placeholder="Add any context to help admins review..."
                  className="w-full p-2 border border-gray-300 rounded resize-y focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
                />
              </div>
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
                      toast.success('Reported to admins');
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
                disabled={submittingReport || !reportReason}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {submittingReport ? 'Reporting…' : 'Report'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
} 
