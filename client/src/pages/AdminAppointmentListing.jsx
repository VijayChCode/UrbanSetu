import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

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

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentUser) {
      alert("Please sign in as admin to book an appointment.");
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
      alert("Please fill out all fields before booking the appointment.");
      return;
    }

    if (!listingId) {
      alert("Listing information is missing. Please try again.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          listingId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setBooked(true);
        setTimeout(() => {
          navigate("/admin/appointments");
        }, 2000); // 2 seconds delay
      } else {
        alert(data.message || "Failed to book appointment.");
      }
    } catch (error) {
      console.error("Error booking appointment:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
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