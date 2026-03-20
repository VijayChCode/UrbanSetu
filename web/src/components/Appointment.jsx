import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import ContactSupportWrapper from './ContactSupportWrapper';
import PaymentModal from './PaymentModal';
import { FaMapMarkerAlt } from "react-icons/fa";
import { toast } from 'react-toastify';
import { authenticatedFetch } from '../utils/auth';
import { usePageTitle } from '../hooks/usePageTitle';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function Appointment() {
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
  usePageTitle(`${listingName || "Property"} - Book Appointment`);

  useEffect(() => {
    if (listingType === 'rent' && listingId) {
      toast.info("For rental properties, please continue to the Rent Property page.");
      navigate(`/user/rent-property?listingId=${listingId}`, { replace: true });
    }
  }, [listingType, listingId, navigate]);

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
  const [agreed, setAgreed] = useState(false);
  const [hasActiveAppointment, setHasActiveAppointment] = useState(false);
  const [checkingActive, setCheckingActive] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [region, setRegion] = useState('international'); // 'india' or 'international'
  const [appointmentData, setAppointmentData] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null); // 'success' or 'failed'
  const [showPaymentMessage, setShowPaymentMessage] = useState(false);
  const [listing, setListing] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  useEffect(() => {
    async function checkActiveAppointment() {
      if (!listingId) {
        setCheckingActive(false);
        return;
      }

      setCheckingActive(true);
      try {
        // 1. Fetch listing details to check ownership
        const listingRes = await authenticatedFetch(`${API_BASE_URL}/api/listing/get/${listingId}`);
        if (listingRes.ok) {
          const data = await listingRes.json();
          const listingData = data.listing || (data._id ? data : null);
          setListing(listingData);

          const ownerId = listingData?.userRef?._id || listingData?.userRef;
          if (listingData && currentUser && String(ownerId) === String(currentUser._id)) {
            setIsOwner(true);
            setCheckingActive(false);
            return;
          }

          // Check if property is unavailable or removed
          const isListingRemoved = listingData && (listingData.isDeleted || listingData.availabilityStatus === 'suspended');

          if (listingData && (['booked', 'sold', 'rented', 'under_contract', 'reserved'].includes(listingData.availabilityStatus) || isListingRemoved)) {
            setIsUnavailable(true);
            setCheckingActive(false);
            return;
          }
        }

        // 2. Check for active appointments
        if (currentUser) {
          const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/my`);
          if (res.ok) {
            const data = await res.json();
            // Find active appointment for this property
            const activeStatuses = ["pending", "accepted"];
            const found = data.find(appt => {
              // Only check appointments where the current user is the buyer (not seller)
              if (!appt.buyerId || (appt.buyerId._id !== currentUser._id && appt.buyerId !== currentUser._id)) return false;

              if (!appt.listingId || (appt.listingId._id !== listingId && appt.listingId !== listingId)) return false;

              // Check if appointment is outdated (past date/time)
              const isOutdated = new Date(appt.date) < new Date() || (new Date(appt.date).toDateString() === new Date().toDateString() && appt.time && appt.time < new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

              // Don't block if appointment is outdated
              if (isOutdated) return false;

              if (activeStatuses.includes(appt.status)) return true;
              // Only block if reinitiation is still possible for the current user (as buyer)
              if (appt.status === "cancelledByBuyer" && (appt.buyerReinitiationCount || 0) < 2) return true;
              return false;
            });
            setHasActiveAppointment(!!found);
          }
        }
      } catch (err) {
        console.error("Validation error:", err);
      } finally {
        setCheckingActive(false);
      }
    }
    checkActiveAppointment();
  }, [currentUser, listingId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (hasActiveAppointment) {
      toast.info("You already have an active appointment for this property. Please complete, cancel, or wait for the other party to respond before booking again.");
      return;
    }

    if (!agreed) {
      toast.warning("You must agree to share your contact information with the seller to book an appointment.");
      return;
    }

    if (!currentUser) {
      toast.info("Please sign in to book an appointment.");
      navigate("/sign-in");
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
      toast.warning("Please fill out all required fields before booking the appointment.");
      return;
    }

    if (!listingId) {
      toast.warning("Listing information is missing. Please try again.");
      return;
    }

    setLoading(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          listingId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        // Store appointment data and show payment modal
        setAppointmentData({ ...data.appointment, region });
        setShowPaymentModal(true);
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

  const handlePaymentSuccess = (payment) => {
    setBooked(true);
    setShowPaymentModal(false);
    setPaymentStatus('success');
    setShowPaymentMessage(true);
    toast.success('Appointment booked and payment confirmed!');
    setTimeout(() => {
      if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) {
        navigate('/admin/appointments');
      } else {
        navigate('/user/my-appointments');
      }
    }, 2000);
  };

  const handlePaymentClose = () => {
    // Close payment modal without marking as booked or redirecting
    setShowPaymentModal(false);
    setPaymentStatus('failed');
    setShowPaymentMessage(true);
    toast.info('Payment not completed. Appointment remains pending until payment is confirmed.');
    // Navigate to appointments page after closing payment modal
    setTimeout(() => {
      if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) {
        navigate('/admin/appointments');
      } else {
        navigate('/user/my-appointments');
      }
    }, 2000);
  };

  if (isOwner) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-950 dark:to-gray-900 min-h-screen py-10 px-2 md:px-8 flex items-center justify-center">
        <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-red-100 dark:border-red-900/20 text-center">
          <div className="text-red-600 dark:text-red-400 text-5xl mb-6">🚫</div>
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Ownership Restriction</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            You are the owner of <span className="font-bold text-blue-600 dark:text-blue-400">{listing?.name || "this property"}</span>.
            Booking appointments is reserved for potential buyers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/user/my-listings')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition shadow-lg transform hover:scale-105"
            >
              Manage My Listings
            </button>
            <button
              onClick={() => navigate('/user')}
              className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-3 px-8 rounded-lg transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isUnavailable) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-950 dark:to-gray-900 min-h-screen py-10 px-2 md:px-8 flex items-center justify-center">
        <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-orange-100 dark:border-orange-900/20 text-center">
          <div className="text-orange-600 dark:text-orange-400 text-5xl mb-6">🔒</div>
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Property Unavailable</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            The property <span className="font-bold text-blue-600 dark:text-blue-400">{listing?.name || "this property"}</span> is no longer available for booking. It may have been sold, removed, or is currently under an active contract. If the status changes, it will become available again.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate(`/listing/${listingId}`)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition shadow-lg transform hover:scale-105"
            >
              View Property Details
            </button>
            <button
              onClick={() => navigate('/user')}
              className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-3 px-8 rounded-lg transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen py-10 px-2 md:px-8">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6 relative">
          <div className="text-center text-red-600 text-xl font-semibold py-10">
            Please sign in to book an appointment.
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
            Book Appointment
          </h3>
          {showPaymentMessage ? (
            <div className="text-center py-10">
              {paymentStatus === 'success' ? (
                <>
                  <div className="text-green-600 dark:text-green-400 text-xl font-semibold mb-2">Payment Successful!</div>
                  <div className="text-gray-700 dark:text-gray-300 mb-2">Appointment booked successfully!</div>
                  <div className="text-gray-600 dark:text-gray-400 text-sm mb-2">The property owner will review your request.</div>
                  <div className="text-sm text-gray-500 dark:text-gray-500">Redirecting to Myappointments...</div>
                </>
              ) : (
                <>
                  <div className="text-red-600 dark:text-red-400 text-xl font-semibold mb-2">Payment Unsuccessful</div>
                  <div className="text-gray-700 dark:text-gray-300 mb-2">Please complete your payment from Myppointments to confirm booking</div>
                  <div className="text-sm text-gray-500 dark:text-gray-500">Redirecting to Myappointments...</div>
                </>
              )}
            </div>
          ) : booked ? (
            <div className="text-center py-10">
              <div className="text-green-600 dark:text-green-400 text-xl font-semibold">Appointment booked successfully!</div>
              <div className="text-gray-700 dark:text-gray-300 mt-1">The property owner will review your request.</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Redirecting to your appointments...</div>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button onClick={() => navigate('/user/movers')} className="px-4 py-2 rounded bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 text-sm">Book Packers & Movers</button>
                <button onClick={() => navigate('/user/services')} className="px-4 py-2 rounded bg-purple-600 dark:bg-purple-500 text-white hover:bg-purple-700 dark:hover:bg-purple-600 text-sm">On-Demand Services</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
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
                  {/* Rent option removed - redirects to Rent Property page */}
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

              {/* Agreement Checkbox */}
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="agreement"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  required
                />
                <label htmlFor="agreement" className="text-sm text-gray-700 dark:text-gray-300 select-none">
                  I understand that <span className="font-semibold text-blue-700 dark:text-blue-400">my contact information and details will be shared with the seller</span> for this appointment.
                </label>
              </div>

              {/* Region Selection */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Select Region</div>
                <div className="flex items-center gap-4 text-sm text-gray-700 dark:text-gray-300">
                  <label className="inline-flex items-center gap-2 hover:cursor-pointer">
                    <input type="radio" name="region" value="india" checked={region === 'india'} onChange={() => setRegion('india')} className="cursor-pointer" />
                    <span>India (₹100 via Razorpay)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 hover:cursor-pointer">
                    <input type="radio" name="region" value="international" checked={region === 'international'} onChange={() => setRegion('international')} className="cursor-pointer" />
                    <span>International ($5 via PayPal)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-center mt-6">
                <button
                  type="submit"
                  className="w-full bg-blue-600 dark:bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || !agreed || hasActiveAppointment || checkingActive}
                >
                  {checkingActive ? "Checking..." : loading ? "Booking..." : hasActiveAppointment ? "Already Booked" : "Book Appointment"}
                </button>
              </div>
              {hasActiveAppointment && (
                <div className="text-red-600 dark:text-red-400 text-sm mt-2 text-center font-semibold">
                  You already have an active appointment for this property. Please complete, cancel, or wait for the other party to respond before booking again.
                </div>
              )}
            </form>
          )}
        </div>

        {/* Payment Modal */}
        {showPaymentModal && appointmentData && (
          <PaymentModal
            isOpen={showPaymentModal}
            onClose={handlePaymentClose}
            appointment={appointmentData}
            onPaymentSuccess={handlePaymentSuccess}
          />
        )}

        <ContactSupportWrapper />
      </div>
    </div>
  );
}
