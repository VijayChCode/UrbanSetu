import React, { useEffect, useState } from "react";
import { FaTrash, FaSearch, FaPen, FaCheck, FaTimes, FaUserShield, FaUser, FaEnvelope, FaPhone } from "react-icons/fa";
import { useSelector } from "react-redux";
import { useState as useLocalState } from "react";
import { Link, useLocation } from "react-router-dom";
import Appointment from "../components/Appointment";

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
        
        const res = await fetch('/api/bookings/my', {
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

    fetchAppointments();

    // Listen for permanent delete events
    const removeHandler = (e) => {
      setAppointments((prev) => prev.filter((appt) => appt._id !== e.detail));
    };
    window.addEventListener('removeAppointmentRow', removeHandler);
    return () => {
      window.removeEventListener('removeAppointmentRow', removeHandler);
    };
  }, [currentUser]);

  const handleStatusUpdate = async (id, status) => {
    setActionLoading(id + status);
    try {
      const res = await fetch(`/api/bookings/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        setAppointments((prev) =>
          prev.map((appt) => (appt._id === id ? { ...appt, status } : appt))
        );
        // Show success message
        const statusText = status === "accepted" ? "accepted" : "rejected";
        alert(`Appointment ${statusText} successfully! ${status === "accepted" ? "Contact information is now visible to both parties." : ""}`);
      } else {
        alert(data.message || "Failed to update appointment status.");
      }
    } catch (err) {
      alert("An error occurred. Please try again.");
    }
    setActionLoading("");
  };

  const handleAdminDelete = async (id) => {
    const reason = prompt("Please provide a reason for deleting this appointment:");
    if (!reason) return;
    
    if (!window.confirm("Are you sure you want to delete this appointment?")) return;
    
    try {
      const res = await fetch(`/api/bookings/${id}`, { 
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (res.ok) {
        setAppointments((prev) =>
          prev.map((appt) => (appt._id === id ? { ...appt, status: "deletedByAdmin", adminComment: reason } : appt))
        );
        alert("Appointment deleted successfully. Both buyer and seller have been notified.");
      } else {
        alert(data.message || "Failed to delete appointment.");
      }
    } catch (err) {
      alert("An error occurred. Please try again.");
    }
  };

  // Filter appointments by status, role, search, and date range
  const filteredAppointments = appointments.filter((appt) => {
    // Hide if soft-deleted for this user
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

  function handleOpenReinitiate(appt) {
    setReinitiateData({
      ...appt,
      date: appt.date ? new Date(appt.date).toISOString().split('T')[0] : '',
      time: appt.time || '',
      message: appt.message || '',
      reinitiationCount: appt.reinitiationCount || 0,
    });
    setShowReinitiateModal(true);
  }

  async function handleReinitiateSubmit(e) {
    e.preventDefault();
    if (!reinitiateData) return;
    if (reinitiateData.reinitiationCount >= 2) {
      alert('You have reached the maximum number of reinitiations for this appointment.');
      return;
    }
    if (!reinitiateData.buyerId || !reinitiateData.sellerId) {
      alert('Cannot reinitiate: one of the parties no longer exists.');
      return;
    }
    // TODO: Optionally notify the other party, record history, etc.
    // For now, create a new booking with the same details but new date/time/message
    const payload = {
      ...reinitiateData,
      status: 'pending',
      reinitiationCount: (reinitiateData.reinitiationCount || 0) + 1,
    };
    try {
      const res = await fetch('/api/bookings/reinitiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Appointment reinitiated successfully!');
        setShowReinitiateModal(false);
        setReinitiateData(null);
        // Update the appointment in-place
        setAppointments((prev) => prev.map(appt => appt._id === data.appointment._id ? { ...appt, ...data.appointment } : appt));
      } else {
        alert(data.message || 'Failed to reinitiate appointment.');
      }
    } catch (err) {
      alert('An error occurred. Please try again.');
    }
  }

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
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-3xl font-extrabold text-blue-700 mb-6 text-center drop-shadow">My Appointments</h3>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <label className="font-semibold">Status:</label>
            <select
              className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="cancelledByBuyer">Cancelled by Buyer</option>
              <option value="cancelledBySeller">Cancelled by Seller</option>
              <option value="cancelledByAdmin">Cancelled by Admin</option>
              <option value="deletedByAdmin">Deleted by Admin</option>
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
        {filteredAppointments.length === 0 ? (
          <div className="text-center text-gray-500 text-lg">
            {appointments.length === 0 ? "No appointments found." : "No appointments match your filters."}
          </div>
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
                  <th className="border p-2">Comments</th>
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
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
  );
}

function AppointmentRow({ appt, currentUser, handleStatusUpdate, handleAdminDelete, actionLoading, onShowOtherParty, onOpenReinitiate }) {
  const [comment, setComment] = useLocalState("");
  const [comments, setComments] = useLocalState(appt.comments || []);
  const [sending, setSending] = useLocalState(false);
  const [editingComment, setEditingComment] = useLocalState(null);
  const [editText, setEditText] = useLocalState("");
  const location = useLocation();

  // Debug: Log the appointment data to see the structure
  console.log('Appointment data:', appt);
  console.log('listingId:', appt.listingId);

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
      const res = await fetch(`/api/bookings/${appt._id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ message: comment }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments(data.comments);
        setComment("");
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
      const res = await fetch(`/api/bookings/${appt._id}/comment/${commentId}`, {
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
      if (!reason) return alert('Reason is required for seller cancellation.');
    } else {
      reason = prompt('Please provide a reason for cancelling this appointment (optional):') || '';
    }
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      const res = await fetch(`/api/bookings/${appt._id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Appointment cancelled successfully.');
        window.location.href = '/user/my-appointments';
      } else {
        alert(data.message || 'Failed to cancel appointment.');
      }
    } catch (err) {
      alert('An error occurred. Please try again.');
    }
  };

  // Admin-side cancel handler
  const handleAdminCancel = async () => {
    const reason = prompt('Please provide a reason for admin cancellation (required):');
    if (!reason) return alert('Reason is required for admin cancellation.');
    if (!window.confirm('Are you sure you want to cancel this appointment as admin?')) return;
    try {
      const res = await fetch(`/api/bookings/${appt._id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Appointment cancelled by admin.');
        window.location.href = '/user/my-appointments';
      } else {
        alert(data.message || 'Failed to cancel appointment.');
      }
    } catch (err) {
      alert('An error occurred. Please try again.');
    }
  };

  // Add permanent delete for cancelled/deleted appointments (soft delete)
  const handlePermanentDelete = async () => {
    if (!window.confirm('Are you sure you want to permanently remove this appointment from your table? This cannot be undone.')) return;
    try {
      const who = isBuyer ? 'buyer' : isSeller ? 'seller' : null;
      if (!who) return;
      const res = await fetch(`/api/bookings/${appt._id}/soft-delete`, {
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
        }
      } else {
        alert('Failed to remove appointment from table.');
      }
    } catch (err) {
      alert('An error occurred. Please try again.');
    }
  };

  return (
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
                disabled={appt.reinitiationCount >= 2 || !appt.buyerId || !appt.sellerId}
                title="Reinitiate or Reschedule Appointment"
              >
                Reinitiate
              </button>
              <span className="text-xs text-gray-500 mt-1">{2 - (appt.reinitiationCount || 0)} left</span>
            </div>
          )}
        </div>
      </td>
      <td className="border p-2">
        {appt.status === "cancelledByAdmin" ? (
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
            {comments.map((c, index) => (
              <div key={c._id || index} className="text-xs border-b pb-1">
                {editingComment === c._id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-1 py-1 border rounded text-xs"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
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
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-blue-700">
                        {c.senderEmail === currentUser.email ? "You" : 
                         isAdmin ? "Admin" : 
                         c.senderEmail === otherParty?.email ? (isSeller ? "Buyer" : "Seller") : "Unknown"}:
                      </span> {c.message}
                      <span className="text-gray-400 ml-2">{new Date(c.timestamp).toLocaleString()}</span>
                    </div>
                    {(c.senderEmail === currentUser.email || isAdmin) && (
                      <div className="flex items-center gap-2">
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
                              const res = await fetch(`/api/bookings/${appt._id}/comment/${c._id}`, {
                                method: 'DELETE',
                                credentials: 'include'
                              });
                              const data = await res.json();
                              if (res.ok) {
                                setComments(data.comments);
                              } else {
                                alert(data.message || 'Failed to delete comment.');
                              }
                            } catch (err) {
                              alert('An error occurred. Please try again.');
                            }
                          }}
                        >
                          <FaTrash className="group-hover:text-red-900 group-hover:scale-125 group-hover:animate-shake transition-all duration-200" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {appt.status !== "cancelledByAdmin" && (
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              className="flex-1 px-2 py-1 border rounded text-xs"
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button
              onClick={handleCommentSend}
              disabled={sending || !comment.trim()}
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