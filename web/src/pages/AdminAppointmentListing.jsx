import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from 'react-toastify';
import { FaMapMarkerAlt } from "react-icons/fa";
import { authenticatedFetch } from '../utils/auth';

import { usePageTitle } from '../hooks/usePageTitle';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminAppointmentListing() {
  const { currentUser } = useSelector((state) => state.user);
  const location = useLocation();
  const navigate = useNavigate();

  // Get listing information from URL params or state
  const searchParams = new URLSearchParams(location.search);
  const listingId = searchParams.get('listingId');
  const listingName = searchParams.get('propertyName');
  const listingDescription = searchParams.get('propertyDescription');
  const listingType = searchParams.get('listingType');

  // Set page title
  usePageTitle(`${listingName || "Appointment"} - Admin Panel`);

  const [formData, setFormData] = useState({
    date: "",
    time: "",
    message: "",
    purpose: "",
    propertyName: listingName || "",
    propertyDescription: listingDescription || "",
  });
  const [booked, setBooked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listing, setListing] = useState(null);
  const [ownerCheckLoading, setOwnerCheckLoading] = useState(true);
  const [allUsers, setAllUsers] = useState([]);
  const [emailSuggestions, setEmailSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerId, setBuyerId] = useState("");

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error("Please sign in as admin to book an appointment.");
      navigate("/admin/profile");
      return;
    }
    // Simple manual validation
    if (
      !formData.date ||
      !formData.time ||
      !formData.purpose ||
      !formData.propertyName ||
      !formData.propertyDescription
    ) {
      toast.error("Please fill out all required fields before booking the appointment.");
      return;
    }
    if (!listingId) {
      toast.error("Listing information is missing. Please try again.");
      return;
    }
    setLoading(true);
    try {
      // --- Check for existing active appointments for this user and property ---
      const userIdToCheck = buyerId || currentUser._id;
      const resUser = await authenticatedFetch(`${API_BASE_URL}/api/bookings/user/${userIdToCheck}`);
      let blockBooking = false;
      if (resUser.ok) {
        const data = await resUser.json();
        const activeStatuses = ["pending", "accepted"];
        const found = data.find(appt => {
          if (!appt.listingId || (appt.listingId._id !== listingId && appt.listingId !== listingId)) return false;

          // Check if appointment is outdated (past date/time)
          const isOutdated = new Date(appt.date) < new Date() || (new Date(appt.date).toDateString() === new Date().toDateString() && appt.time && appt.time < new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

          // Don't block if appointment is outdated
          if (isOutdated) return false;

          if (appt.buyerId && (appt.buyerId._id === userIdToCheck || appt.buyerId === userIdToCheck)) {
            if (activeStatuses.includes(appt.status)) return true;
            // Only block if cancelled by buyer and buyer can still reinitiate
            // Don't block if cancelled by seller (not buyer's fault)
            if (appt.status === "cancelledByBuyer" && (appt.buyerReinitiationCount || 0) < 2) return true;
          }
          return false;
        });
        blockBooking = !!found;
      }
      if (blockBooking) {
        toast.error("This user already has an active appointment for this property or can still reinitiate. Booking Failed.");
        setLoading(false);
        return;
      }
      // --- End check ---
      // Always use admin booking endpoint
      let payload = {
        ...formData,
        listingId,
        buyerEmail: buyerEmail || currentUser.email,
        buyerId: buyerId || currentUser._id
      };
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setBooked(true);
        toast.success(`Property booked successfully on behalf of ${buyerEmail || currentUser.email}. Both seller and buyer are notified.`);
        setTimeout(() => {
          navigate("/admin/appointments");
        }, 2000);
      } else {
        toast.error(data.message || "Failed to book appointment.");
      }
    } catch (error) {
      console.error("Error booking appointment:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchListing = async () => {
      if (!listingId) return;
      setOwnerCheckLoading(true);
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/get/${listingId}`);
        const data = await res.json();
        setListing(data);
      } catch (error) {
        setListing(null);
      } finally {
        setOwnerCheckLoading(false);
      }
    };
    fetchListing();
  }, [listingId]);

  // Fetch all users for autocomplete
  useEffect(() => {
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/user/all-users-autocomplete`);
      if (res.ok) {
        const users = await res.json();
        setAllUsers(users);
      }
    } catch { }
  };

  // Filter email suggestions
  useEffect(() => {
    if (buyerEmail.trim()) {
      const filtered = allUsers.filter(user => user.email.toLowerCase().includes(buyerEmail.toLowerCase()));
      setEmailSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setEmailSuggestions([]);
      setShowSuggestions(false);
    }
  }, [buyerEmail, allUsers]);

  const handleEmailSuggestionClick = (user) => {
    setBuyerEmail(user.email);
    setBuyerId(user._id);
    setShowSuggestions(false);
  };

  if (!currentUser) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-slate-900 min-h-screen py-10 px-2 md:px-8">
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 relative">
          <div className="text-center text-red-600 dark:text-red-400 text-xl font-semibold py-10">
            Please sign in as admin to book an appointment.
          </div>
        </div>
      </div>
    );
  }

  if (ownerCheckLoading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-slate-900 min-h-screen py-10 px-2 md:px-8">
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 relative">
          <div className="text-center text-blue-600 dark:text-blue-400 text-xl font-semibold py-10">
            Loading property information...
          </div>
        </div>
      </div>
    );
  }

  if (listing && currentUser && currentUser._id === listing.userRef) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-slate-900 min-h-screen py-10 px-2 md:px-8">
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 relative">
          <div className="text-center text-red-600 dark:text-red-400 text-xl font-semibold py-10">
            You cannot book an appointment for your own property.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-slate-900 min-h-screen py-10 px-2 md:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Property Summary Header */}
        {listing && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 flex flex-col sm:flex-row gap-6 relative overflow-hidden group hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full pointer-events-none -mr-8 -mt-8"></div>

            <div className="w-full sm:w-32 h-48 sm:h-32 flex-shrink-0 relative rounded-xl overflow-hidden border-2 border-gray-100 dark:border-gray-600 shadow-sm group-hover:scale-[1.02] transition-transform duration-300">
              <img
                src={listing.imageUrls?.[0] || 'https://via.placeholder.com/300?text=No+Image'}
                alt={listing.name}
                className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-700"
                onError={(e) => { e.target.src = 'https://via.placeholder.com/300?text=Image+Error'; }}
              />
              {listing.availabilityStatus === 'available' && (
                <span className="absolute top-2 left-2 px-2 py-0.5 bg-green-500 text-white text-[10px] uppercase font-bold tracking-wide rounded shadow-sm">
                  Available
                </span>
              )}
            </div>

            <div className="flex-1 flex flex-col justify-center relative z-10">
              <h1
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/listing/${listing._id}`);
                }}
                className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-50 leading-tight mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors cursor-pointer hover:underline">
                {listing.name}
              </h1>

              <p className="text-gray-600 dark:text-gray-400 flex items-start gap-2 mb-3 text-sm sm:text-base">
                <FaMapMarkerAlt className="text-red-500 mt-1 flex-shrink-0 text-lg animate-bounce-slow" />
                <span className="leading-snug">{listing.address || `${listing.city}, ${listing.state}`}</span>
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg text-xs font-bold uppercase tracking-wider border border-blue-100 dark:border-blue-800">
                  {listing.type === 'rent' ? 'For Rent' : 'For Sale'}
                </span>

                <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 hidden sm:block"></div>

                <span className="text-2xl font-bold text-gray-800 dark:text-blue-400 flex items-baseline">
                  ₹{(listing.type === 'rent' ? (listing.monthlyRent || listing.discountPrice || listing.regularPrice || 0) : (listing.discountPrice || listing.regularPrice || 0)).toLocaleString('en-IN')}
                  {listing.type === 'rent' && <span className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-1 self-center">/month</span>}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 relative">
        <h3 className="text-3xl font-extrabold text-blue-700 dark:text-blue-400 mb-6 text-center drop-shadow">
          Book Appointment (Admin)
        </h3>
        {booked ? (
          <div className="text-center text-green-600 dark:text-green-400 text-xl font-semibold py-10">
            Appointment booked successfully!<br />
            The property owner will review your request.<br />
            Redirecting to admin appointments...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* User Assignment Info */}
            <div className="mb-2">
              <div className="font-bold text-base text-gray-800 dark:text-white">User Assignment</div>
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Assign to (User Email - optional)</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Enter user email to assign booking (leave empty for admin booking)</div>
              <div className="text-xs text-blue-500 dark:text-blue-400 mt-1">💡 Tip: Start typing to see email suggestions. If left empty, the booking will be owned by the admin.</div>
            </div>
            {/* Email input for user selection (optional) */}
            <div className="relative">
              <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">User Email (optional)</label>
              <input
                type="email"
                name="buyerEmail"
                value={buyerEmail}
                onChange={e => { setBuyerEmail(e.target.value); setBuyerId(""); }}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                autoComplete="off"
                placeholder="Type to search users by email..."
              />
              {showSuggestions && (
                <div className="absolute z-10 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded w-full max-h-40 overflow-y-auto shadow">
                  {emailSuggestions.map(user => (
                    <div key={user._id} className="px-3 py-2 hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer text-gray-800 dark:text-gray-200" onClick={() => handleEmailSuggestionClick(user)}>
                      {user.email} ({user.username})
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Date</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  min={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Time</label>
                <select
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="">Select Time (9 AM - 7 PM)</option>
                  {Array.from({ length: 21 }, (_, i) => {
                    const totalMinutes = 9 * 60 + i * 30;
                    const hour = Math.floor(totalMinutes / 60);
                    const minutes = totalMinutes % 60;
                    const timeStr = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                    const period = hour >= 12 ? 'PM' : 'AM';
                    const displayStr = `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
                    return (
                      <option key={timeStr} value={timeStr}>
                        {displayStr}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">Select Purpose</option>
                {listingType === 'rent' && <option value="rent">Rent</option>}
                {(listingType === 'sale' || listingType === 'buy') && <option value="buy">Buy</option>}
              </select>
            </div>

            <input
              type="text"
              name="propertyName"
              value={formData.propertyName}
              onChange={handleChange}
              placeholder="Property Name"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              readOnly
              disabled
              required
            />

            <textarea
              name="propertyDescription"
              value={formData.propertyDescription}
              onChange={handleChange}
              placeholder="Property Description"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:bg-gray-700 dark:text-white"
              rows="2"
              readOnly
              disabled
              required
            ></textarea>

            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="Tell us about your requirements... (Optional)"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:bg-gray-700 dark:text-white"
              rows="4"
            ></textarea>

            <div className="flex justify-center mt-6">
              <button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-blue-500 to-purple-500 dark:from-blue-600 dark:to-purple-600 text-white py-3 px-8 rounded-lg hover:from-blue-600 hover:to-purple-600 dark:hover:from-blue-500 dark:hover:to-purple-500 transition-all transform hover:scale-105 shadow-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Booking..." : "Book Appointment"}
              </button>
            </div>
          </form>
        )}
      </div>
      </div>
    </div>
  );
}