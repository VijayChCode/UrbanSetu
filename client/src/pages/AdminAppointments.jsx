import React, { useEffect, useState } from "react";
import { FaTrash, FaSearch, FaPen, FaUser, FaEnvelope, FaCalendar, FaPhone, FaUserShield, FaArchive, FaUndo } from "react-icons/fa";
import { useSelector } from "react-redux";
import { useState as useLocalState } from "react";
import { Link } from "react-router-dom";

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
    return () => clearInterval(interval);
  }, []);

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
        alert("Appointment cancelled successfully. Both buyer and seller have been notified of the cancellation.");
      } else {
        alert(data.message || "Failed to cancel appointment.");
      }
    } catch (err) {
      console.error('Error in handleAdminCancel:', err);
      alert("An error occurred. Please try again.");
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
        alert("Appointment reinitiated successfully. Both buyer and seller have been notified.");
      } else {
        alert(data.message || "Failed to reinitiate appointment.");
      }
    } catch (err) {
      console.error('Error in handleReinitiateAppointment:', err);
      alert("An error occurred. Please try again.");
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
        alert("Appointment archived successfully.");
      } else {
        alert(data.message || "Failed to archive appointment.");
      }
    } catch (err) {
      console.error('Error in handleArchiveAppointment:', err);
      alert("An error occurred. Please try again.");
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
        alert("Appointment unarchived successfully.");
      } else {
        alert(data.message || "Failed to unarchive appointment.");
      }
    } catch (err) {
      console.error('Error in handleUnarchiveAppointment:', err);
      alert("An error occurred. Please try again.");
    }
  };

  const handleUserClick = async (userId) => {
    if (!userId) {
      alert("User ID not available");
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
        alert("Failed to fetch user details.");
        setShowUserModal(false);
      }
    } catch (err) {
      alert("An error occurred while fetching user details.");
      setShowUserModal(false);
    }
    setUserLoading(false);
  };

  // Filter and search logic
  const filteredAppointments = appointments.filter((appt) => {
    const matchesStatus =
      statusFilter === "all" ? true : appt.status === statusFilter;
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
    return matchesSearch && matchesDate;
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

  if (loading) return <p className="text-center mt-8 text-lg font-semibold text-blue-600 animate-pulse">Loading appointments...</p>;

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
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-blue-700 drop-shadow">
            {showArchived ? "Archived Appointments" : "All Appointments (Admin View)"}
          </h3>
          <button
            onClick={handleManualRefresh}
            className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all font-semibold shadow-md ml-4"
            title="Refresh appointments"
          >
            Refresh
          </button>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`bg-gradient-to-r text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-1 sm:gap-2 text-sm sm:text-base w-full sm:w-auto justify-center ${
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
        
        <p className="text-center text-gray-600 mb-6">
          {showArchived 
            ? "View and manage archived appointments. You can unarchive them to move them back to active appointments."
            : "Monitor all appointments across the platform. Use the status filter to view pending appointments."
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
            filteredArchivedAppointments.filter(appt => statusFilter === 'all' ? true : appt.status === statusFilter).length === 0 ? (
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
                    {filteredArchivedAppointments
                      .filter(appt => statusFilter === 'all' ? true : appt.status === statusFilter)
                      .map((appt) => (
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

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">User Details</h3>
            {userLoading ? (
              <p>Loading...</p>
            ) : selectedUser ? (
              <div className="space-y-2">
                <p><strong>Username:</strong> {selectedUser.username}</p>
                <p><strong>Email:</strong> {selectedUser.email}</p>
                <p><strong>Phone:</strong> {selectedUser.mobileNumber || 'Not provided'}</p>
                <p><strong>Role:</strong> {selectedUser.role}</p>
                <p><strong>Admin Status:</strong> {selectedUser.adminApprovalStatus}</p>
                <p><strong>Created:</strong> {new Date(selectedUser.createdAt).toLocaleDateString()}</p>
              </div>
            ) : (
              <p>User not found</p>
            )}
            <button
              onClick={() => setShowUserModal(false)}
              className="mt-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminAppointmentRow({ appt, currentUser, handleAdminCancel, handleReinitiateAppointment, handleArchiveAppointment, handleUnarchiveAppointment, onUserClick, isArchived }) {
  const [localComments, setLocalComments] = useLocalState(appt.comments || []);
  const [newComment, setNewComment] = useLocalState("");
  const [sending, setSending] = useLocalState(false);
  const [editingComment, setEditingComment] = useLocalState(null);
  const [editText, setEditText] = useLocalState("");

  const handleCommentSend = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ message: newComment }),
      });
      const data = await res.json();
      if (res.ok) {
        setLocalComments(data.comments);
        setNewComment("");
      } else {
        alert(data.message || "Failed to send comment.");
      }
    } catch (err) {
      alert("An error occurred. Please try again.");
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
        setLocalComments(data.comments);
        setEditingComment(null);
        setEditText("");
      } else {
        alert(data.message || "Failed to edit comment.");
      }
    } catch (err) {
      alert("An error occurred. Please try again.");
    }
  };

  const startEditing = (comment) => {
    setEditingComment(comment._id);
    setEditText(comment.message);
  };

  // Check if comment is from current admin user
  const isAdminComment = (comment) => {
    return comment.senderEmail === currentUser?.email;
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

  return (
    <tr className={`hover:bg-blue-50 transition align-top ${isArchived ? 'bg-gray-50' : ''}`}>
      <td className="border p-2">
        <div>
          <div>{new Date(appt.date).toLocaleDateString('en-GB')}</div>
          <div className="text-sm text-gray-600">{appt.time}</div>
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
      <td className="border p-2 min-w-[300px] max-w-[400px]">
        {appt.status === "deletedByAdmin" ? (
          <div className="text-center text-gray-500 text-sm">
            <div className="mb-2">This appointment has been deleted and commented by admin.</div>
            {appt.adminComment && (
              <div className="text-xs bg-gray-100 p-2 rounded">
                <strong>Admin Comment:</strong> "{appt.adminComment}"
              </div>
            )}
          </div>
        ) : appt.status === "cancelledByAdmin" ? (
          <div className="text-center text-red-500 text-sm">
            <div className="mb-2">This appointment has been cancelled by admin.</div>
            {appt.cancelReason && (
              <div className="text-xs bg-red-100 p-2 rounded border border-red-200">
                <strong>Cancellation Reason:</strong> "{appt.cancelReason}"
              </div>
            )}
          </div>
        ) : (
          <div className="max-h-32 overflow-y-auto space-y-2">
            {localComments.map((c, index) => (
              <div key={c._id || index} className="text-xs border-b pb-1">
                {editingComment === c._id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      className="w-full px-2 py-1 border rounded text-xs"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditComment(c._id)}
                        className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingComment(null)}
                        className="bg-gray-500 text-white px-2 py-1 rounded text-xs hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-blue-700">{c.senderEmail}:</span> 
                      <span className="break-words">{c.message}</span>
                      <div className="text-gray-400 text-xs mt-1">{new Date(c.timestamp).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      {/* Show edit button only for admin's own comments */}
                      {isAdminComment(c) && (
                        <button
                          onClick={() => startEditing(c)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit comment"
                        >
                          <FaPen size={12} />
                        </button>
                      )}
                      {/* Show delete button for all comments */}
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
                              setLocalComments(data.comments);
                            } else {
                              alert(data.message || 'Failed to delete comment.');
                            }
                          } catch (err) {
                            alert('An error occurred. Please try again.');
                          }
                        }}
                        title="Delete comment"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {appt.status !== "deletedByAdmin" && appt.status !== "cancelledByAdmin" && (
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              className="flex-1 px-2 py-1 border rounded text-xs"
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button
              onClick={handleCommentSend}
              disabled={sending || !newComment.trim()}
              className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition disabled:opacity-50"
            >
              Send
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
