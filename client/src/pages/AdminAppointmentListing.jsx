import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from 'react-toastify';

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
      !formData.message ||
      !formData.purpose ||
      !formData.propertyName ||
      !formData.propertyDescription
    ) {
      toast.error("Please fill out all fields before booking the appointment.");
      return;
    }
    if (!listingId) {
      toast.error("Listing information is missing. Please try again.");
      return;
    }
    setLoading(true);
    try {
      // Always use admin booking endpoint
      let payload = {
        ...formData,
        listingId,
        buyerEmail: buyerEmail || currentUser.email,
        buyerId: buyerId || currentUser._id
      };
      const res = await fetch(`${API_BASE_URL}/api/bookings/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setBooked(true);
        toast.success("Appointment booked successfully!");
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
        const res = await fetch(`${API_BASE_URL}/api/listing/get/${listingId}`);
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
      const res = await fetch(`${API_BASE_URL}/api/user/all-users-autocomplete`, { credentials: 'include' });
      if (res.ok) {
        const users = await res.json();
        setAllUsers(users);
      }
    } catch {}
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
      <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen py-10 px-2 md:px-8">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6 relative">
          <div className="text-center text-red-600 text-xl font-semibold py-10">
            Please sign in as admin to book an appointment.
          </div>
        </div>
      </div>
    );
  }

  if (ownerCheckLoading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen py-10 px-2 md:px-8">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6 relative">
          <div className="text-center text-blue-600 text-xl font-semibold py-10">
            Loading property information...
          </div>
        </div>
      </div>
    );
  }

  if (listing && currentUser && currentUser._id === listing.userRef) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen py-10 px-2 md:px-8">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6 relative">
          <div className="text-center text-red-600 text-xl font-semibold py-10">
            You cannot book an appointment for your own property.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen py-10 px-2 md:px-8">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6 relative">
        <h3 className="text-3xl font-extrabold text-blue-700 mb-6 text-center drop-shadow">
          Book Appointment (Admin)
        </h3>
        {booked ? (
          <div className="text-center text-green-600 text-xl font-semibold py-10">
            Appointment booked successfully!<br />
            The property owner will review your request.<br />
            Redirecting to admin appointments...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* User Assignment Info */}
            <div className="mb-2">
              <div className="font-bold text-base">User Assignment</div>
              <div className="text-sm font-semibold">Assign to (User Email - optional)</div>
              <div className="text-xs text-gray-600">Enter user email to assign booking (leave empty for admin booking)</div>
              <div className="text-xs text-blue-500 mt-1">💡 Tip: Start typing to see email suggestions. If left empty, the booking will be owned by the admin.</div>
            </div>
            {/* Email input for user selection (optional) */}
            <div className="relative">
              <label className="block font-semibold mb-1">User Email (optional)</label>
              <input
                type="email"
                name="buyerEmail"
                value={buyerEmail}
                onChange={e => { setBuyerEmail(e.target.value); setBuyerId(""); }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="off"
                placeholder="Type to search users by email..."
              />
              {showSuggestions && (
                <div className="absolute z-10 bg-white border rounded w-full max-h-40 overflow-y-auto shadow">
                  {emailSuggestions.map(user => (
                    <div key={user._id} className="px-3 py-2 hover:bg-blue-100 cursor-pointer" onClick={() => handleEmailSuggestionClick(user)}>
                      {user.email} ({user.username})
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={new Date().toISOString().split("T")[0]}
                required
              />
              <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            
            <textarea
              name="propertyDescription"
              value={formData.propertyDescription}
              onChange={handleChange}
              placeholder="Property Description"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows="2"
              required
            ></textarea>
            
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="Tell us about your requirements..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows="4"
              required
            ></textarea>
            
            <div className="flex justify-center mt-6">
              <button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-8 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Booking..." : "Book Appointment"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
} 