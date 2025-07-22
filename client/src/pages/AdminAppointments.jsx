import React, { useEffect, useState } from "react";
import { FaTrash, FaSearch, FaPen, FaUser, FaEnvelope, FaCalendar, FaPhone, FaUserShield, FaArchive, FaUndo, FaCommentDots, FaCheck, FaCheckDouble, FaBan, FaTimes } from "react-icons/fa";
import { useSelector } from "react-redux";
import { useState as useLocalState } from "react";
import { Link } from "react-router-dom";
import { toast, ToastContainer } from 'react-toastify';
import { socket } from "../utils/socket";

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

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/bookings`, { credentials: 'include' });
        const data = await res.json();
        setAppointments(data);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch appointments", err);
        setLoading(false);
      }
    };
    const fetchArchivedAppointments = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/bookings/archived`, {
          credentials: 'include'
        });
        const data = await res.json();
        setArchivedAppointments(data);
      } catch (err) {
        console.error("Failed to fetch archived appointments", err);
      }
    };
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
    
    return () => {
      clearInterval(interval);
      socket.off('profileUpdated', handleProfileUpdate);
    };
  }, []);

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
    const reason = prompt("Please provide a reason for cancelling this appointment:");
    if (!reason) return;
    
    if (!window.confirm("Are you sure you want to cancel this appointment?")) return;
    
    try {
      console.log('Attempting to cancel appointment:', id);
      console.log('Current user:', currentUser);
      console.log('User role:', currentUser.role);
      console.log('Admin approval status:', currentUser.adminApprovalStatus);
      
      // Find the appointment to check its current status
      const appointment = appointments.find(appt => appt._id === id);
      if (appointment) {
        console.log('Current appointment status:', appointment.status);
        console.log('Appointment date:', appointment.date);
        console.log('Appointment time:', appointment.time);
      }
      
      const res = await fetch(`${API_BASE_URL}/api/bookings/${id}/cancel`, { 
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      
      console.log('Response status:', res.status);
      const data = await res.json();
      console.log('Response data:', data);
      
      if (res.ok) {
        setAppointments((prev) =>
          prev.map((appt) => (appt._id === id ? { ...appt, status: "cancelledByAdmin", cancelReason: reason } : appt))
        );
        toast.success("Appointment cancelled successfully. Both buyer and seller have been notified of the cancellation.");
      } else {
        toast.error(data.message || "Failed to cancel appointment.");
      }
    } catch (err) {
      console.error('Error in handleAdminCancel:', err);
      toast.error("An error occurred. Please try again.");
    }
  };

  const handleReinitiateAppointment = async (id) => {
    if (!window.confirm("Are you sure you want to reinitiate this appointment? This will notify both buyer and seller.")) return;
    
    try {
      console.log('Attempting to reinitiate appointment:', id);
      
      const res = await fetch(`${API_BASE_URL}/api/bookings/${id}/reinitiate`, { 
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
      });
      
      console.log('Response status:', res.status);
      const data = await res.json();
      console.log('Response data:', data);
      
      if (res.ok) {
        setAppointments((prev) =>
          prev.map((appt) => (appt._id === id ? { ...appt, status: "pending", cancelReason: "" } : appt))
        );
        toast.success("Appointment reinitiated successfully. Both buyer and seller have been notified.");
      } else {
        toast.error(data.message || "Failed to reinitiate appointment.");
      }
    } catch (err) {
      console.error('Error in handleReinitiateAppointment:', err);
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
        // Remove from active appointments and add to archived
        const archivedAppt = appointments.find(appt => appt._id === id);
        if (archivedAppt) {
          setAppointments((prev) => prev.filter((appt) => appt._id !== id));
          setArchivedAppointments((prev) => [{ ...archivedAppt, archivedByAdmin: true, archivedAt: new Date() }, ...prev]);
        }
        toast.success("Appointment archived successfully.");
      } else {
        toast.error(data.message || "Failed to archive appointment.");
      }
    } catch (err) {
      console.error('Error in handleArchiveAppointment:', err);
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
        // Remove from archived appointments and add back to active
        const unarchivedAppt = archivedAppointments.find(appt => appt._id === id);
        if (unarchivedAppt) {
          setArchivedAppointments((prev) => prev.filter((appt) => appt._id !== id));
          setAppointments((prev) => [{ ...unarchivedAppt, archivedByAdmin: false, archivedAt: undefined }, ...prev]);
        }
        toast.success("Appointment unarchived successfully.");
      } else {
        toast.error(data.message || "Failed to unarchive appointment.");
      }
    } catch (err) {
      console.error('Error in handleUnarchiveAppointment:', err);
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
  const filteredAppointments = appointments.filter((appt) => {
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
  });

  const filteredArchivedAppointments = archivedAppointments.filter((appt) => {
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
  });

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
            : "Monitor all appointments across the platform. Use the status filter to view pending appointments. 💡 Outdated appointments (past their scheduled date) are automatically ignored when booking new appointments."
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
            <FaSearch className="text-gray-500" />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
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
                      <img
                        src={selectedUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.username || 'User')}&background=6366f1&color=ffffff&size=128`}
                        alt={selectedUser.username}
                        className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-lg"
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

                  <button
                    onClick={() => setShowUserModal(false)}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold"
                  >
                    Close
                  </button>
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

function AdminAppointmentRow({ appt, currentUser, handleAdminCancel, handleReinitiateAppointment, handleArchiveAppointment, handleUnarchiveAppointment, onUserClick, isArchived }) {
  const [localComments, setLocalComments] = useLocalState(appt.comments || []);
  const [newComment, setNewComment] = useLocalState("");
  const [sending, setSending] = useLocalState(false);
  const [editingComment, setEditingComment] = useLocalState(null);
  const [editText, setEditText] = useLocalState("");
  const [savingComment, setSavingComment] = useLocalState(null);
  const [replyTo, setReplyTo] = useLocalState(null);
  const [showChatModal, setShowChatModal] = useLocalState(false);
  const [showPasswordModal, setShowPasswordModal] = useLocalState(false);
  const [adminPassword, setAdminPassword] = useLocalState("");
  const [passwordLoading, setPasswordLoading] = useLocalState(false);
  const chatEndRef = React.useRef(null);
  const chatContainerRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const messageRefs = React.useRef({});
  const [isAtBottom, setIsAtBottom] = useLocalState(true);
  const [unreadNewMessages, setUnreadNewMessages] = useLocalState(0);

  // Auto-scroll to bottom only when chat modal opens
  React.useEffect(() => {
    if (showChatModal && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showChatModal]);

  // Track new messages and handle auto-scroll/unread count
  const prevCommentsLengthRef = React.useRef(localComments.length);
  React.useEffect(() => {
    const newMessagesCount = localComments.length - prevCommentsLengthRef.current;
    prevCommentsLengthRef.current = localComments.length;

    if (newMessagesCount > 0 && showChatModal) {
      if (isAtBottom) {
        // Auto-scroll if user is at bottom
        setTimeout(() => {
          if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      } else {
        // Add to unread count if user is not at bottom
        setUnreadNewMessages(prev => prev + newMessagesCount);
      }
    }
  }, [localComments.length, isAtBottom, showChatModal]);

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

  // Check if user is at the bottom of chat
  const checkIfAtBottom = React.useCallback(() => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 5; // 5px threshold
      setIsAtBottom(atBottom);
      
      // Clear unread count when user reaches bottom
      if (atBottom && unreadNewMessages > 0) {
        setUnreadNewMessages(0);
      }
    }
  }, [unreadNewMessages]);

  // Add scroll event listener for chat container
  React.useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer && showChatModal) {
      chatContainer.addEventListener('scroll', checkIfAtBottom);
      // Check initial position
      checkIfAtBottom();
      
      return () => {
        chatContainer.removeEventListener('scroll', checkIfAtBottom);
      };
    }
  }, [showChatModal, checkIfAtBottom]);

  // Function to scroll to bottom
  const scrollToBottom = React.useCallback(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setUnreadNewMessages(0); // Clear unread count when manually scrolling to bottom
    }
  }, []);

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

  React.useEffect(() => {
    function handleCommentUpdate(data) {
      if (data.appointmentId === appt._id) {
        setLocalComments((prev) => {
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
      }
    }
    socket.on('commentUpdate', handleCommentUpdate);
    return () => {
      socket.off('commentUpdate', handleCommentUpdate);
    };
  }, [appt._id, setLocalComments]);

  const handleCommentSend = async () => {
    if (!newComment.trim()) return;
    setSending(true);

    // Create a temporary message object for optimistic update
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      _id: tempId,
      senderEmail: currentUser.email,
      message: newComment,
      status: "sending",
      timestamp: new Date().toISOString(),
      readBy: [currentUser._id],
      ...(replyTo ? { replyTo: replyTo._id } : {}),
    };
    
    // Optimistic update - add message immediately
    setLocalComments(prev => [...prev, tempMessage]);
    const messageToSend = newComment;
    setNewComment("");
    setReplyTo(null); // Clear replyTo after sending

    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ message: messageToSend, ...(replyTo ? { replyTo: replyTo._id } : {}) }),
      });
      const data = await res.json();
      if (res.ok) {
        // Replace temp message with real message from server
        setLocalComments(prev => [
          ...prev.filter(msg => msg._id !== tempId),
          ...data.comments.filter(newC => !prev.some(msg => msg._id === newC._id))
        ]);
        toast.success("Comment sent successfully!");
      } else {
        // Remove temp message on error
        setLocalComments(prev => prev.filter(msg => msg._id !== tempId));
        setNewComment(messageToSend); // Restore message
        toast.error(data.message || "Failed to send comment.");
      }
    } catch (err) {
      // Remove temp message on error
      setLocalComments(prev => prev.filter(msg => msg._id !== tempId));
      setNewComment(messageToSend); // Restore message
      toast.error("An error occurred. Please try again.");
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
    setLocalComments(optimisticUpdate);
    setEditingComment(null);
    setEditText("");
    
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
        toast.success("Comment edited successfully!");
      } else {
        // Revert optimistic update on error
        setLocalComments(prev => prev.map(c => 
          c._id === commentId 
            ? { ...c, message: c.originalMessage || c.message, edited: c.wasEdited || false }
            : c
        ));
        setEditingComment(commentId);
        setEditText(editText);
        toast.error(data.message || "Failed to edit comment.");
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
      toast.error("An error occurred. Please try again.");
    } finally {
      setSavingComment(null);
    }
  };

  const startEditing = (comment) => {
    setEditingComment(comment._id);
    setEditText(comment.message);
    // Store original data for potential rollback
    setLocalComments(prev => prev.map(c => 
      c._id === comment._id 
        ? { ...c, originalMessage: c.message, wasEdited: c.edited }
        : c
    ));
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
      } else {
        toast.error("Incorrect password. Please try again.");
      }
    } catch (err) {
      toast.error("Failed to verify password. Please try again.");
    }
    setPasswordLoading(false);
  };

  // Store locally removed deleted message IDs per appointment
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
          className="flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full p-2 shadow-md mx-auto relative"
          title="Open Chat"
          onClick={handleChatButtonClick}
        >
          <FaCommentDots size={20} />
        </button>
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xs relative flex flex-col items-center">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl"
                onClick={() => setShowPasswordModal(false)}
                title="Close"
              >
                &times;
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
          <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gradient-to-br from-blue-50 to-purple-100 rounded-2xl shadow-2xl max-w-md w-full p-0 relative animate-fadeIn flex flex-col">
              <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-200 to-purple-200 rounded-t-2xl relative">
                <FaCommentDots className="text-blue-600 text-xl" />
                <h3 className="text-lg font-bold text-blue-800">Chat</h3>
                <div className="flex items-center gap-3 ml-auto">
                  <button
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => {
                      localStorage.setItem(clearTimeKey, Date.now());
                      setLocalComments([]);
                    }}
                    title="Clear chat locally"
                  >
                    Clear Chat
                  </button>
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
              <div ref={chatContainerRef} className="flex-1 max-h-60 overflow-y-auto space-y-2 mb-4 px-4 pt-4 animate-fadeInChat relative">
                {localComments.map((c, index) => {
                  const isMe = c.senderEmail === currentUser.email;
                  const isEditing = editingComment === c._id;
                  const currentDate = new Date(c.timestamp);
                  const previousDate = index > 0 ? new Date(localComments[index - 1].timestamp) : null;
                  const isNewDay = previousDate ? currentDate.toDateString() !== previousDate.toDateString() : true;

                  return (
                    <React.Fragment key={c._id || index}>
                      {isNewDay && (
                        <div className="w-full flex justify-center my-2">
                          <span className="bg-gray-200 text-gray-700 text-xs px-3 py-1 rounded-full shadow">{getDateLabel(currentDate)}</span>
                        </div>
                      )}
                      <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} animate-fadeInChatBubble`} style={{ animationDelay: `${0.03 * index}s` }}>
                      <div 
                        ref={el => messageRefs.current[c._id] = el}
                        className={`rounded-2xl px-4 py-2 text-sm shadow-lg max-w-[80%] break-words relative ${isMe ? 'bg-gradient-to-r from-blue-400 to-blue-600 text-white' : 'bg-white text-gray-800 border border-gray-200'}`}
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
                            <span className="text-xs text-gray-600 truncate">{localComments.find(msg => msg._id === c.replyTo)?.message || 'Original message'}</span>
                          </div>
                        )}
                        <div className="font-semibold mb-1 flex items-center gap-2">
                          {isMe ? "You" : c.senderEmail}
                          <span className="text-gray-300 ml-2 text-[10px]">{new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <input
                                type="text"
                                className="border rounded px-2 py-1 text-xs w-40 text-gray-900 bg-white focus:bg-white"
                                value={editText}
                                onChange={e => setEditText(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleEditComment(c._id);
                                  }
                                }}
                                autoFocus
                              />
                              <div className="flex gap-1 justify-end">
                                <button 
                                  onClick={() => handleEditComment(c._id)} 
                                  disabled={savingComment === c._id}
                                  className="bg-green-700 hover:bg-green-900 disabled:bg-green-500 disabled:cursor-not-allowed text-white font-bold px-2 py-1 rounded text-xs flex items-center gap-1"
                                >
                                  {savingComment === c._id ? (
                                    <>
                                      <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                                      Saving...
                                    </>
                                  ) : (
                                    'Save'
                                  )}
                                </button>
                                <button 
                                  onClick={() => { setEditingComment(null); setEditText(""); }} 
                                  disabled={savingComment === c._id}
                                  className="bg-red-700 hover:bg-red-900 disabled:bg-red-500 disabled:cursor-not-allowed text-white font-bold px-2 py-1 rounded text-xs"
                                >Cancel</button>
                              </div>
                            </>
                          ) : c.deleted ? (
                            <div>
                              {/* Admin sees original content with deletion indicator */}
                              {currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? (
                                <div className="border border-red-300 bg-red-50 rounded p-2 mb-2">
                                  <div className="flex items-center gap-2 text-red-600 text-xs font-semibold mb-1">
                                    <FaBan className="inline-block" />
                                    Message deleted by {c.deletedBy || 'user'} (Admin view - preserved for records)
                                  </div>
                                  <div className="text-gray-800 bg-white p-2 rounded border-l-4 border-red-400">
                                    {c.originalMessage ? (
                                      <span>{c.originalMessage}</span>
                                    ) : c.message ? (
                                      <span>{c.message}</span>
                                    ) : (
                                      <span className="text-gray-500 italic">
                                        [Message content not preserved - this message was deleted before content preservation was implemented]
                                      </span>
                                    )}
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
                                    onClick={() => {
                                      setLocalComments(prev => prev.filter(msg => msg._id !== c._id));
                                      addLocallyRemovedId(appt._id, c._id);
                                    }}
                                    title="Remove this deleted message from your admin view"
                                  >
                                    Hide from admin view
                                  </button>
                                </div>
                              ) : (
                                /* Regular users see standard deletion message */
                                <span className="flex items-center gap-1 text-gray-400 italic">
                                  <FaBan className="inline-block text-lg" /> This message has been deleted.
                                  <button
                                    className="ml-2 text-xs text-red-400 hover:text-red-700 underline"
                                    onClick={() => {
                                      setLocalComments(prev => prev.filter(msg => msg._id !== c._id));
                                      addLocallyRemovedId(appt._id, c._id);
                                    }}
                                    title="Remove this deleted message from your chat view"
                                  >
                                    Remove
                                  </button>
                                </span>
                              )}
                            </div>
                          ) : (
                            <div>
                              {c.message}
                              {c.edited && (
                                <span className="ml-2 text-[10px] italic text-gray-300">(Edited)</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 justify-end mt-1">
                          <button
                            className={`${c.senderEmail === currentUser.email ? 'text-yellow-500 hover:text-yellow-700' : 'text-blue-600 hover:text-blue-800'}`}
                            onClick={() => { setReplyTo(c); inputRef.current?.focus(); }}
                            title="Reply"
                          >
                            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c4.28 0 6.92 1.45 8.84 4.55.23.36.76.09.65-.32C18.31 13.13 15.36 10.36 10 9z"/></svg>
                          </button>
                          {(c.senderEmail === currentUser.email) && !isEditing && !c.deleted && (
                            <>
                              <button
                                onClick={() => startEditing(c)}
                                className="text-green-700 hover:text-green-900"
                                title="Edit comment"
                              >
                                <FaPen size={12} />
                              </button>
                              <button
                                className="text-red-700 hover:text-red-900"
                                onClick={async () => {
                                  if (!window.confirm('Are you sure you want to delete this comment?')) return;
                                  try {
                                    const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${c._id}`, {
                                      method: 'DELETE',
                                      credentials: 'include'
                                    });
                                    const data = await res.json();
                                    if (res.ok) {
                                      setLocalComments(data.comments);
                                      toast.success("Comment deleted successfully!");
                                    } else {
                                      toast.error(data.message || 'Failed to delete comment.');
                                    }
                                  } catch (err) {
                                    toast.error('An error occurred. Please try again.');
                                  }
                                }}
                                title="Delete comment"
                              >
                                <FaTrash size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    </React.Fragment>
                  );
                })}
                
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-2 mt-2 px-4 pb-4">
                {replyTo && (
                  <div className="flex items-center bg-blue-50 border-l-4 border-blue-400 px-2 py-1 mb-2 rounded">
                    <span className="text-xs text-gray-700 font-semibold mr-2">Replying to:</span>
                    <span className="text-xs text-gray-600 truncate">{replyTo.message}</span>
                    <button className="ml-auto text-gray-400 hover:text-gray-700" onClick={() => setReplyTo(null)} title="Cancel reply">&times;</button>
                  </div>
                )}
                <input
                  type="text"
                  className="flex-1 px-3 py-2 border rounded-full text-sm focus:ring-2 focus:ring-blue-200 shadow"
                  placeholder="Type a message..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCommentSend(); }}
                  ref={inputRef}
                />
                <button
                  onClick={handleCommentSend}
                  disabled={sending || !newComment.trim()}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-5 py-2 rounded-full text-sm font-semibold shadow hover:from-blue-600 hover:to-purple-600 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {sending ? (
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
              
                             {/* Floating Scroll to bottom button - WhatsApp style */}
               {!isAtBottom && (
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
      </td>
    </tr>
  );
}
