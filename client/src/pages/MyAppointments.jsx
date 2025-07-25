import React, { useEffect, useState, useRef, useCallback } from "react";
import { FaTrash, FaSearch, FaPen, FaCheck, FaTimes, FaUserShield, FaUser, FaEnvelope, FaPhone, FaArchive, FaUndo, FaCommentDots, FaCheckDouble, FaBan, FaPaperPlane, FaCalendar, FaLightbulb } from "react-icons/fa";
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
    // Emit userAppointmentsActive every 5 seconds
    const interval = setInterval(() => {
      socket.emit('userAppointmentsActive', { userId: currentUser._id });
    }, 5000);
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
        toast.success(`Appointment ${statusText} successfully! ${status === "accepted" ? "Contact information is now visible to both parties." : ""}`);
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
    const reason = prompt("Please provide a reason for deleting this appointment:");
    if (!reason) return;
    
    if (!window.confirm("Are you sure you want to delete this appointment?")) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${id}`, { 
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (res.status === 401) {
        toast.error("Session expired or unauthorized. Please sign in again.");
        navigate("/sign-in");
        return;
      }
      if (res.ok) {
        setAppointments((prev) =>
          prev.map((appt) => (appt._id === id ? { ...appt, status: "deletedByAdmin", adminComment: reason } : appt))
        );
        toast.success("Appointment deleted successfully. Both buyer and seller have been notified.");
        navigate("/user/my-appointments");
      } else {
        toast.error(data.message || "Failed to delete appointment.");
      }
    } catch (err) {
      toast.error("An error occurred. Please try again.");
    }
  };

  const handleArchiveAppointment = async (id) => {
    if (!window.confirm("Are you sure you want to archive this appointment? It will be moved to the archived section.")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        const archivedAppt = appointments.find(appt => appt._id === id);
        if (archivedAppt) {
          setAppointments((prev) => prev.filter((appt) => appt._id !== id));
          setArchivedAppointments((prev) => [{ ...archivedAppt, archivedAt: new Date() }, ...prev]);
        }
        toast.success("Appointment archived successfully.");
      } else {
        toast.error(data.message || "Failed to archive appointment.");
      }
    } catch (err) {
      toast.error("An error occurred. Please try again.");
    }
  };

  const handleUnarchiveAppointment = async (id) => {
    if (!window.confirm("Are you sure you want to unarchive this appointment? It will be moved back to the active appointments.")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${id}/unarchive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        const unarchivedAppt = archivedAppointments.find(appt => appt._id === id);
        if (unarchivedAppt) {
          setArchivedAppointments((prev) => prev.filter((appt) => appt._id !== id));
          setAppointments((prev) => [{ ...unarchivedAppt, archivedAt: undefined }, ...prev]);
        }
        toast.success("Appointment unarchived successfully.");
      } else {
        toast.error(data.message || "Failed to unarchive appointment.");
      }
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
        toast.success('Appointment reinitiated successfully!');
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
                  {selectedOtherParty.avatar && selectedOtherParty.avatar.trim() && selectedOtherParty.avatar !== 'null' && selectedOtherParty.avatar !== 'undefined' ? (
                    <>
                      <img
                        src={selectedOtherParty.avatar}
                        alt={selectedOtherParty.username}
                        className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-lg"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextElementSibling.style.display = 'flex';
                        }}
                      />
                      <div className="w-16 h-16 rounded-full border-4 border-white shadow-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center" style={{display: 'none'}}>
                        <span className="text-white font-bold text-lg">
                          {selectedOtherParty.username 
                            ? selectedOtherParty.username.split(' ').map(name => name.charAt(0).toUpperCase()).join('').slice(0, 2)
                            : 'U'
                          }
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="w-16 h-16 rounded-full border-4 border-white shadow-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">
                        {selectedOtherParty.username 
                          ? selectedOtherParty.username.split(' ').map(name => name.charAt(0).toUpperCase()).join('').slice(0, 2)
                          : 'U'
                        }
                      </span>
                    </div>
                  )}
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

              <button
                onClick={() => setShowOtherPartyModal(false)}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold"
              >
                Close
              </button>
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

function AppointmentRow({ appt, currentUser, handleStatusUpdate, handleAdminDelete, actionLoading, onShowOtherParty, onOpenReinitiate, handleArchiveAppointment, handleUnarchiveAppointment, isArchived, onCancelRefresh }) {
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
  const [isOtherPartyOnline, setIsOtherPartyOnline] = useState(false);
  const [isOtherPartyOnlineInTable, setIsOtherPartyOnlineInTable] = useState(false);
  const [isOtherPartyTyping, setIsOtherPartyTyping] = useState(false);
  const [showShortcutTip, setShowShortcutTip] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null); // Add inputRef here
  const messageRefs = useRef({}); // Add messageRefs here

  // Auto-close shortcut tip after 10 seconds
  useEffect(() => {
    if (showShortcutTip) {
      const timer = setTimeout(() => {
        setShowShortcutTip(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showShortcutTip]);

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
  
  const canSeeContactInfo = (isAdmin || appt.status === 'accepted') && isUpcoming;
  const otherParty = isSeller ? appt.buyerId : appt.sellerId;

  const handleCommentSend = async () => {
    if (!comment.trim()) return;
    setSending(true);

    // Create a temporary message object
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      _id: tempId,
      senderEmail: currentUser.email,
      message: comment,
      status: "sending",
      timestamp: new Date().toISOString(),
      readBy: [currentUser._id],
      ...(replyTo ? { replyTo: replyTo._id } : {}),
    };
    setComments(prev => [...prev, tempMessage]);
    setComment("");
    setReplyTo(null); // Clear replyTo after sending

    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ message: comment, ...(replyTo ? { replyTo: replyTo._id } : {}) }),
      });
      const data = await res.json();
      if (res.ok) {
        // Replace the temp message with the real one from the backend
        setComments(prev => [
          ...prev.filter(msg => msg._id !== tempId),
          ...data.comments.filter(newC => !prev.some(msg => msg._id === newC._id))
        ]);
        toast.success("Comment sent successfully!");
      } else {
        // Remove the temp message on error
        setComments(prev => prev.filter(msg => msg._id !== tempId));
        toast.error(data.message || "Failed to send comment.");
      }
    } catch (err) {
      setComments(prev => prev.filter(msg => msg._id !== tempId));
      toast.error('An error occurred. Please try again.');
    }
    setSending(false);
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
        toast.success("Comment edited successfully!");
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
        toast.error(data.message || "Failed to edit comment.");
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
    let reason = '';
    if (isSeller) {
      reason = prompt('Please provide a reason for cancelling this appointment (required):');
      if (!reason) return toast.error('Reason is required for seller cancellation.');
    } else {
      reason = prompt('Please provide a reason for cancelling this appointment (optional):') || '';
    }
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
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
    } catch (err) {
      toast.error('An error occurred. Please try again.');
    }
  };

  // Admin-side cancel handler
  const handleAdminCancel = async () => {
    const reason = prompt('Please provide a reason for admin cancellation (required):');
    if (!reason) return toast.error('Reason is required for admin cancellation.');
    if (!window.confirm('Are you sure you want to cancel this appointment as admin?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
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
    } catch (err) {
      toast.error('An error occurred. Please try again.');
    }
  };

  // Add permanent delete for cancelled/deleted appointments (soft delete)
  const handlePermanentDelete = async () => {
    if (!window.confirm('Are you sure you want to permanently remove this appointment from your table? This cannot be undone.')) return;
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
          toast.success("Appointment removed from your table sucessfully");
        }
      } else {
        toast.error('Failed to remove appointment from table.');
      }
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
        // Check if sender is admin by checking if senderEmail matches any admin user
        const isSenderBuyer = data.comment.senderEmail === appt.buyerId?.email;
        const isSenderSeller = data.comment.senderEmail === appt.sellerId?.email;
        const isSenderAdmin = !isSenderBuyer && !isSenderSeller;
        
        const senderName = isSenderAdmin ? "Organization" : (data.comment.senderEmail || 'User');
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
            // Only add if not present (for new messages)
            return [...prev, data.comment];
          }
        });
        // If chat is open and the new comment is not from the current user, mark as read
        if (showChatModal && data.comment.senderEmail !== currentUser.email) {
          fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/read`, {
            method: 'PATCH',
            credentials: 'include'
          });
        }
      }
    }
    socket.on('commentUpdate', handleCommentUpdate);
    return () => {
      socket.off('commentUpdate', handleCommentUpdate);
    };
  }, [appt._id, setComments, showChatModal, currentUser.email]);

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

  // Calculate unread messages for the current user
  const unreadCount = comments.filter(c => !c.readBy?.includes(currentUser._id) && c.senderEmail !== currentUser.email).length;

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
  const locallyRemovedIds = getLocallyRemovedIds(appt._id);
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
        typingTimeoutRef.current = setTimeout(() => setIsOtherPartyTyping(false), 2000);
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
            className={`flex items-center justify-center rounded-full p-2 shadow-md mx-auto relative ${
              !isUpcoming 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50' 
                : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
            }`}
            title={!isUpcoming ? "Chat not available for outdated appointments" : "Open Chat"}
            onClick={!isUpcoming ? undefined : () => setShowChatModal(true)}
            disabled={!isUpcoming}
          >
            <FaCommentDots size={20} />
            {/* Typing indicator - highest priority */}
            {isOtherPartyTyping && isUpcoming && (
              <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold border-2 border-white animate-pulse">
                ...
              </span>
            )}
            {/* Unread count when not typing */}
            {!isOtherPartyTyping && unreadCount > 0 && !isUpcoming && (
              <span className="absolute -top-1 -right-1 bg-gray-400 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold border-2 border-white">
                {unreadCount}
              </span>
            )}
            {!isOtherPartyTyping && unreadCount > 0 && isUpcoming && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold border-2 border-white">
                {unreadCount}
              </span>
            )}
            {/* Online status green dot - show when no typing and no unread count */}
            {!isOtherPartyTyping && unreadCount === 0 && isOtherPartyOnlineInTable && isUpcoming && (
              <span className="absolute -top-1 -right-1 bg-green-500 border-2 border-white rounded-full w-3 h-3"></span>
            )}
          </button>
        </td>
      </tr>
      {showChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-blue-50 to-purple-100 rounded-2xl shadow-2xl w-full h-full max-w-6xl max-h-full p-0 relative animate-fadeIn flex flex-col">
            { !isUpcoming ? (
              <div className="flex flex-col items-center justify-center flex-1 p-8 min-h-96">
                <FaCommentDots className="text-6xl text-gray-400 mb-6" />
                <div className="text-xl font-semibold text-gray-500 text-center">Chat not available for outdated appointments</div>
                <div className="text-gray-400 text-center mt-2">This appointment has already passed</div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-200 to-purple-200 rounded-t-2xl relative">
                  <FaCommentDots className="text-blue-600 text-xl" />
                  <h3 className="text-lg font-bold text-blue-800">Chat</h3>
                  {isOtherPartyTyping ? (
                    <span className="ml-3 text-blue-600 font-semibold text-sm">Typing...</span>
                  ) : isOtherPartyOnline ? (
                    <span className="ml-3 text-green-600 font-semibold text-sm">Online</span>
                  ) : (
                    <span className="ml-3 text-gray-600 font-semibold text-sm">Offline</span>
                  )}
                  <div className="flex items-center gap-3 ml-auto">
                    {filteredComments.length > 0 && (
                      <button
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete chat? This action cannot be undone.')) {
                            localStorage.setItem(clearTimeKey, Date.now());
                            setComments([]);
                          }
                        }}
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
                      &times;
                    </button>
                  </div>
                </div>
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-2 mb-4 px-4 pt-4 animate-fadeInChat relative" style={{minHeight: '400px', maxHeight: 'calc(100vh - 200px)'}}>
                  {/* Floating Date Indicator */}
                  {currentFloatingDate && filteredComments.length > 0 && (
                    <div className="sticky top-0 left-0 right-0 z-30 pointer-events-none">
                      <div className="w-full flex justify-center py-2">
                        <div className="bg-blue-600 text-white text-xs px-4 py-2 rounded-full shadow-lg border-2 border-white animate-fadeIn">
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
                    const previousDate = index > 0 ? new Date(comments[index - 1].timestamp) : null;
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
                            className={`rounded-2xl px-4 py-2 text-sm shadow-lg max-w-[60%] break-words relative ${isMe ? 'bg-gradient-to-r from-blue-400 to-blue-600 text-white' : 'bg-white text-gray-800 border border-gray-200'}`}
                            style={{ animationDelay: `${0.03 * index}s` }}
                          >
                            {/* Reply preview above message if this is a reply */}
                            {c.replyTo && (
                              <div className="border-l-4 border-blue-300 pl-2 mb-1 text-xs text-gray-500 bg-blue-50 rounded w-full max-w-full break-words cursor-pointer" onClick={() => {
                                  if (messageRefs.current[c.replyTo]) {
                                    messageRefs.current[c.replyTo].scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    messageRefs.current[c.replyTo].classList.add('ring-2', 'ring-yellow-400');
                                    setTimeout(() => {
                                      messageRefs.current[c.replyTo].classList.remove('ring-2', 'ring-yellow-400');
                                    }, 1000);
                                  }
                                }} role="button" tabIndex={0} aria-label="Go to replied message">
                                <span className="text-xs text-gray-600 truncate">{comments.find(msg => msg._id === c.replyTo)?.message || 'Original message'}</span>
                              </div>
                            )}
                            <div className="font-semibold mb-1 flex items-center gap-2 flex-wrap break-all">
                              <span className="truncate max-w-[60%] min-w-[80px] inline-block align-middle overflow-hidden text-ellipsis">
                                {isMe ? "You" : (() => {
                                  // Check if sender is admin by checking if senderEmail matches any admin user
                                  // For now, we'll identify admin by checking if the message sender is neither buyer nor seller
                                  const isSenderBuyer = c.senderEmail === appt.buyerId?.email;
                                  const isSenderSeller = c.senderEmail === appt.sellerId?.email;
                                  const isSenderAdmin = !isSenderBuyer && !isSenderSeller;
                                  
                                  if (isSenderAdmin) {
                                    return "Organization";
                                  }
                                  return otherParty?.username || c.senderName || c.senderEmail;
                                })()}
                              </span>
                              <span className="text-gray-300 ml-2 text-[10px]">
                                {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {c.deleted ? (
                                <span className="flex items-center gap-1 text-gray-400 italic">
                                  <FaBan className="inline-block text-lg" /> {c.senderEmail === currentUser.email ? "You deleted this message" : "This message was deleted."}
                                  <button
                                    className="ml-2 text-red-700 hover:text-red-900"
                                    onClick={() => {
                                      setComments(prev => prev.filter(msg => msg._id !== c._id));
                                      addLocallyRemovedId(appt._id, c._id);
                                    }}
                                    title="Remove this deleted message from your chat view"
                                  >
                                    <FaTrash className="group-hover:text-red-900 group-hover:scale-125 group-hover:animate-shake transition-all duration-200" />
                                  </button>
                                </span>
                              ) : (
                                <div>
                                  {isEditing ? (
                                    <div className="bg-yellow-100 border-l-4 border-yellow-400 px-2 py-1 rounded">
                                      <span className="text-yellow-800 text-xs font-medium">✏️ Editing this message below...</span>
                                    </div>
                                  ) : (
                                    <>
                                      {c.message}
                                      {c.edited && (
                                        <span className="ml-2 text-[10px] italic text-gray-300">(Edited)</span>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 justify-end mt-1">
                              {!c.deleted && (
                                <button
                                  className={`${isMe ? 'text-yellow-500 hover:text-yellow-700' : 'text-blue-600 hover:text-blue-800'}`}
                                  onClick={() => { setReplyTo(c); inputRef.current?.focus(); }}
                                  title="Reply"
                                >
                                  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c4.28 0 6.92 1.45 8.84 4.55.23.36.76.09.65-.32C18.31 13.13 15.36 10.36 10 9z"/></svg>
                                </button>
                              )}
                              {(c.senderEmail === currentUser.email) && !c.deleted && (
                                <>
                                  <button
                                    onClick={() => startEditing(c)}
                                    className="text-green-800 hover:text-green-950"
                                    title="Edit comment"
                                    disabled={editingComment !== null} // Disable if already editing another message
                                  >
                                    <FaPen size={12} />
                                  </button>
                                  <button
                                    className="text-red-700 hover:text-red-900"
                                    onClick={async () => {
                                                                              if (!window.confirm('Are you sure you want to delete this chat?')) return;
                                      try {
                                        const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${c._id}`, {
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
                                          toast.success("Comment deleted successfully!");
                                        } else {
                                          toast.error(data.message || 'Failed to delete comment.');
                                        }
                                      } catch (err) {
                                        toast.error('An error occurred. Please try again.');
                                      }
                                    }}
                                  >
                                    <FaTrash className="group-hover:text-red-900 group-hover:scale-125 group-hover:animate-shake transition-all duration-200" />
                                  </button>
                                  <span className="ml-1">
                                    {c.readBy?.includes(otherParty?._id)
                                      ? <FaCheckDouble className="text-white inline" />
                                      : c.status === "delivered"
                                        ? <FaCheckDouble className="text-white/70 inline" />
                                        : <FaCheck className="text-white/70 inline" />}
                                  </span>
                                </>
                              )}
                              {!isMe && !isEditing && !c.deleted && (
                                <button
                                  className="text-red-500 hover:text-red-700 text-xs"
                                  onClick={() => {
                                    setComments(prev => prev.filter(msg => msg._id !== c._id));
                                    addLocallyRemovedId(appt._id, c._id);
                                  }}
                                  title="Delete message locally"
                                >
                                  <FaTrash size={14} />
                                </button>
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
                      <span className="text-xs text-gray-600 truncate">{replyTo.message}</span>
                      <button className="ml-auto text-gray-400 hover:text-gray-700" onClick={() => setReplyTo(null)} title="Cancel reply">&times;</button>
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
                        className="ml-auto text-yellow-400 hover:text-yellow-700" 
                        onClick={() => { 
                          setEditingComment(null); 
                          setEditText(""); 
                          setComment(""); 
                        }} 
                        title="Cancel edit"
                      >&times;</button>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2 mt-2 px-4 pb-4">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border rounded-full text-sm focus:ring-2 focus:ring-blue-200 shadow"
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
                      if (e.key === 'Enter') {
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
                    className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-5 py-2 rounded-full text-sm font-semibold shadow hover:from-blue-600 hover:to-purple-600 transition disabled:opacity-50 flex items-center gap-2 min-w-20"
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
            {!isAtBottom && isUpcoming && (
              <div className="absolute bottom-20 right-6 z-20">
                <button
                  onClick={scrollToBottom}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-110 relative"
                  title={unreadNewMessages > 0 ? `${unreadNewMessages} new message${unreadNewMessages > 1 ? 's' : ''}` : "Scroll to bottom"}
                  aria-label={unreadNewMessages > 0 ? `${unreadNewMessages} new messages, scroll to bottom` : "Scroll to bottom"}
                >
                  <svg
                    width="20"
                    height="20"
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
    </>
  );
} 
