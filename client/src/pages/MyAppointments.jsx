import React, { useEffect, useState } from "react";
import { FaTrash, FaSearch, FaPen, FaCheck, FaTimes, FaUserShield, FaUser, FaEnvelope, FaPhone, FaArchive, FaUndo, FaCommentDots, FaCheckDouble, FaBan, FaPaperPlane } from "react-icons/fa";
import { useSelector } from "react-redux";
import { useState as useLocalState } from "react";
import { Link, useLocation, useNavigate, useNavigation } from "react-router-dom";
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

  if (loading) return <p className="text-center mt-8 text-lg font-semibold text-blue-600 animate-pulse">Loading appointments...</p>;

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
          <h3 className="text-3xl font-extrabold text-blue-700 drop-shadow">
            {showArchived ? "Archived Appointments" : "My Appointments"}
          </h3>
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
      {/* Other Party Details Modal */}
      {showOtherPartyModal && selectedOtherParty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl"
              onClick={() => setShowOtherPartyModal(false)}
              title="Close"
            >
              &times;
            </button>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FaUser className="text-blue-500" />
              {selectedOtherParty.username || 'User Details'}
            </h3>
            <div className="space-y-2">
              <p className="flex items-center gap-2"><FaEnvelope className="text-gray-500" /> <span>{selectedOtherParty.email}</span></p>
              <p className="flex items-center gap-2"><FaPhone className="text-gray-500" /> <span>{selectedOtherParty.mobileNumber || 'Not provided'}</span></p>
              <p><strong>Role:</strong> {selectedOtherParty.role}</p>
              <p><strong>Member Since:</strong> {selectedOtherParty.createdAt ? new Date(selectedOtherParty.createdAt).toLocaleDateString() : ''}</p>
            </div>
            <button
              onClick={() => setShowOtherPartyModal(false)}
              className="mt-6 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full"
            >
              Close
            </button>
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

function AppointmentRow({ appt, currentUser, handleStatusUpdate, handleAdminDelete, actionLoading, onShowOtherParty, onOpenReinitiate, handleArchiveAppointment, handleUnarchiveAppointment, isArchived, onCancelRefresh }) {
  const [comment, setComment] = useLocalState("");
  const [comments, setComments] = useLocalState(appt.comments || []);
  const [sending, setSending] = useLocalState(false);
  const [editingComment, setEditingComment] = useLocalState(null);
  const [editText, setEditText] = useLocalState("");
  const location = useLocation();
  const [showChatModal, setShowChatModal] = useLocalState(false);
  const chatEndRef = React.useRef(null);

  const isAdmin = (currentUser.role === 'admin' || currentUser.role === 'rootadmin') && currentUser.adminApprovalStatus === 'approved';
  const isAdminContext = location.pathname.includes('/admin');
  const isSeller = appt.role === 'seller';
  const isBuyer = appt.role === 'buyer';
  const canSeeContactInfo = isAdmin || appt.status === 'accepted';
  const otherParty = isSeller ? appt.buyerId : appt.sellerId;

  // Add function to check if appointment is upcoming
  const isUpcoming = new Date(appt.date) > new Date() || (new Date(appt.date).toDateString() === new Date().toDateString() && (!appt.time || appt.time > new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })));

  const handleCommentSend = async () => {
    if (!comment.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ message: comment }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments(data.comments);
        setComment("");
        toast.success("Comment sent successfully!");
      } else {
        toast.error(data.message || "Failed to send comment.");
      }
    } catch (err) {
      toast.error('An error occurred. Please try again.');
    }
    setSending(false);
  };

  const handleEditComment = async (commentId) => {
    if (!editText.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ message: editText }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments(data.comments);
        setEditingComment(null);
        setEditText("");
        toast.success("Comment edited successfully!");
      } else {
        toast.error(data.message || "Failed to edit comment.");
      }
    } catch (err) {
      toast.error('An error occurred. Please try again.');
    }
  };

  const startEditing = (comment) => {
    setEditingComment(comment._id);
    setEditText(comment.message);
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

  // Auto-scroll to bottom when chat modal opens or comments change
  React.useEffect(() => {
    if (showChatModal && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showChatModal, comments]);

  // Toast notification for new messages when chat is closed
  React.useEffect(() => {
    function handleCommentUpdateNotify(data) {
      if (data.appointmentId === appt._id && !showChatModal) {
        toast.custom((t) => (
          <div className="bg-blue-600 text-white px-4 py-2 rounded shadow-lg flex items-center gap-2 animate-bounce-in">
            <FaCommentDots /> New message from {data.comment.senderEmail || 'User'}
            <button onClick={() => { setShowChatModal(true); toast.dismiss(t.id); }} className="ml-4 bg-white text-blue-700 px-2 py-1 rounded">Open Chat</button>
          </div>
        ));
      }
    }
    socket.on('commentUpdate', handleCommentUpdateNotify);
    return () => {
      socket.off('commentUpdate', handleCommentUpdateNotify);
    };
  }, [appt._id, showChatModal]);

  // Real-time comment updates via socket.io (for chat sync)
  React.useEffect(() => {
    function handleCommentUpdate(data) {
      if (data.appointmentId === appt._id) {
        setComments((prev) => {
          const idx = prev.findIndex(c => c._id === data.comment._id);
          if (idx !== -1) {
            // Update the existing comment in place
            const updated = [...prev];
            updated[idx] = data.comment;
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

  // Mark all comments as read when chat modal opens
  React.useEffect(() => {
    if (showChatModal) {
      fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/read`, {
        method: 'PATCH',
        credentials: 'include'
      });
    }
  }, [showChatModal, appt._id]);

  // Listen for commentDelivered and commentRead events
  React.useEffect(() => {
    function handleCommentDelivered(data) {
      if (data.appointmentId === appt._id) {
        setComments(prev =>
          prev.map(c =>
            c._id === data.commentId ? { ...c, status: "delivered" } : c
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
;
  // Get clear time from localStorage
  const clearTimeKey = `chatClearTime_${appt._id}`;
  const clearTime = Number(localStorage.getItem(clearTimeKey)) || 0;
  const filteredComments = comments.filter(c => new Date(c.timestamp).getTime() > clearTime);

  return (
    <>
      <tr className="hover:bg-blue-50 transition align-top">
        <td className="border p-2">
          <div>
            <div>{new Date(appt.date).toLocaleDateString('en-GB')}</div>
            <div className="text-sm text-gray-600">{appt.time}</div>
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
            {/* Seller approve/deny buttons for pending, upcoming appointments */}
            {isSeller && isUpcoming && appt.status === "pending" && (
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
            {isBuyer && isUpcoming && (appt.status === "pending" || appt.status === "accepted") && (
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
            {/* Outdated appointment delete button (always visible for past appointments) */}
            {!isUpcoming && (
              <button
                className="text-gray-400 hover:text-red-700 text-xl"
                onClick={handlePermanentDelete}
                title="Delete outdated appointment from table"
                style={{ opacity: 0.7 }}
              >
                <FaTrash size={18} />
              </button>
            )}
          </div>
        </td>
        <td className="border p-2 text-center relative">
          <button
            className="flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full p-2 shadow-md mx-auto relative"
            title="Open Chat"
            onClick={() => setShowChatModal(true)}
          >
            <FaCommentDots size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold border-2 border-white">
                {unreadCount}
              </span>
            )}
          </button>
        </td>
      </tr>
      {showChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative flex flex-col">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl"
              onClick={() => setShowChatModal(false)}
              title="Close"
            >
              &times;
            </button>
            <h3 className="text-xl font-bold mb-4 text-blue-700 flex items-center gap-2">
              <FaCommentDots /> Chat
            </h3>
            <button
              className="mb-2 ml-auto text-xs text-red-600 hover:underline"
              onClick={() => {
                localStorage.setItem(clearTimeKey, Date.now());
                setComments([]);
              }}
              title="Clear chat locally"
            >
              Clear Chat
            </button>
            <div className="flex-1 max-h-60 overflow-y-auto space-y-2 mb-4 pr-2">
              {filteredComments.map((c, index) => {
                const isMe = c.senderEmail === currentUser.email;
                const isEditing = editingComment === c._id;
                return (
                  <div key={c._id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`rounded-lg px-3 py-2 text-xs shadow ${isMe ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'} max-w-[80%]`}>
                      <div className="font-semibold mb-1">
                        {isMe ? "You" : c.senderEmail}
                        <span className="text-gray-400 ml-2 text-[10px]">{new Date(c.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {c.deleted ? (
                          <span className="flex items-center gap-1 text-gray-400 italic">
                            <FaBan className="inline-block text-lg" /> This message has been deleted.
                          </span>
                        ) : isEditing ? (
                          <>
                            <input
                              type="text"
                              className="border rounded px-2 py-1 text-xs w-40"
                              value={editText}
                              onChange={e => setEditText(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleEditComment(c._id); }}
                              autoFocus
                            />
                            <button onClick={() => handleEditComment(c._id)} className="text-green-600 hover:text-green-800 font-bold ml-1">Save</button>
                            <button onClick={() => { setEditingComment(null); setEditText(""); }} className="text-gray-500 hover:text-gray-700 font-bold ml-1">Cancel</button>
                          </>
                        ) : (
                          <div>
                            {c.message}
                            {c.edited && (
                              <span className="ml-2 text-[10px] italic text-gray-400">(Edited)</span>
                            )}
                          </div>
                        )}
                        {c.senderEmail === currentUser.email && !c.deleted && !isEditing && (
                          <span className="ml-1">
                            {c.status === "read" ? <FaCheckDouble className="text-blue-500 inline" /> :
                              c.status === "delivered" ? <FaCheckDouble className="text-gray-500 inline" /> :
                              <FaCheck className="text-gray-500 inline" />}
                          </span>
                        )}
                      </div>
                      {(c.senderEmail === currentUser.email) && !isEditing && !c.deleted && (
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => startEditing(c)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit comment"
                          >
                            <FaPen size={12} />
                          </button>
                          <button
                            className="text-red-500 hover:text-red-700"
                            onClick={async () => {
                              if (!window.confirm('Are you sure you want to delete this comment?')) return;
                              try {
                                const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${c._id}`, {
                                  method: 'DELETE',
                                  credentials: 'include'
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  setComments(data.comments);
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
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                className="flex-1 px-2 py-1 border rounded text-xs focus:ring-2 focus:ring-blue-200"
                placeholder="Type a message..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCommentSend(); }}
              />
              <button
                onClick={handleCommentSend}
                disabled={sending || !comment.trim()}
                className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 