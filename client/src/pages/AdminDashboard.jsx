import React, { useEffect, useState } from "react";
import ListingItem from "../components/ListingItem";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { 
  FaCalendarAlt, 
  FaUsers, 
  FaHome, 
  FaStar, 
  FaChartLine, 
  FaEye,
  FaHeart,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaTrash,
  FaLock
} from "react-icons/fa";
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import { toast } from 'react-toastify';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminDashboard() {
  const { currentUser } = useSelector((state) => state.user);
  const [offerListings, setOfferListings] = useState([]);
  const [saleListings, setSaleListings] = useState([]);
  const [rentListings, setRentListings] = useState([]);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Enhanced analytics state
  const [analytics, setAnalytics] = useState({
    totalUsers: 0,
    totalAdmins: 0,
    totalListings: 0,
    totalReviews: 0,
    pendingReviews: 0,
    averageRating: 0,
    recentActivity: [],
    topProperties: [],
    userGrowth: [],
    listingStats: {
      sale: 0,
      rent: 0,
      offer: 0
    }
  });

  // Booking statistics state
  const [bookingStats, setBookingStats] = useState({
    total: 0,
    accepted: 0,
    pending: 0,
    rejected: 0
  });

  const [showReasonModal, setShowReasonModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [pendingDelete, setPendingDelete] = useState({ id: null, ownerId: null });
  const [showManagementPasswordModal, setShowManagementPasswordModal] = useState(false);
  const [managementPassword, setManagementPassword] = useState("");
  const [managementPasswordError, setManagementPasswordError] = useState("");
  const [managementPasswordLoading, setManagementPasswordLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        await Promise.all([
          fetchOfferListings(),
          fetchRentListings(),
          fetchSaleListings(),
          fetchAppointmentCount(),
          fetchBookingStats(),
          fetchAnalytics()
        ]);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  const fetchOfferListings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/listing/get?offer=true&limit=6`);
      const data = await res.json();
      setOfferListings(data);
    } catch (error) {
      console.error("Error fetching offer listings", error);
    }
  };

  const fetchRentListings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/listing/get?type=rent&limit=6`);
      const data = await res.json();
      setRentListings(data);
    } catch (error) {
      console.error("Error fetching rent listings", error);
    }
  };

  const fetchSaleListings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/listing/get?type=sale&limit=6`);
      const data = await res.json();
      setSaleListings(data);
    } catch (error) {
      console.error("Error fetching sale listings", error);
    }
  };

  const fetchAppointmentCount = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setAppointmentCount(data.length);
      }
    } catch (error) {
      console.error('Failed to fetch appointment count:', error);
    }
  };

  const fetchBookingStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/stats`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setBookingStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch booking stats:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      // Fetch user statistics
      const usersRes = await fetch(`${API_BASE_URL}/api/admin/management/users`, { credentials: 'include' });
      const adminsRes = await fetch(`${API_BASE_URL}/api/admin/management/admins`, { credentials: 'include' });
      // Fetch review statistics
      const reviewsRes = await fetch(`${API_BASE_URL}/api/review/admin/stats`, { credentials: 'include' });
      // Fetch listing statistics
      const listingsRes = await fetch(`${API_BASE_URL}/api/listing/get?limit=10000`, { credentials: 'include' });

      let usersData = [];
      let adminsData = [];
      let reviewsData = { totalReviews: 0, pendingReviews: 0, averageRating: 0 };
      let listingsData = [];

      if (usersRes.ok) usersData = await usersRes.json();
      if (adminsRes.ok) adminsData = await adminsRes.json();
      if (reviewsRes.ok) reviewsData = await reviewsRes.json();
      if (listingsRes.ok) listingsData = await listingsRes.json();

      const listingStats = {
        sale: listingsData.filter(l => l.type === 'sale').length,
        rent: listingsData.filter(l => l.type === 'rent').length,
        offer: listingsData.filter(l => l.offer).length
      };

      const topProperties = listingsData
        .filter(l => l.averageRating > 0)
        .sort((a, b) => b.averageRating - a.averageRating)
        .slice(0, 5);

      setAnalytics({
        totalUsers: usersData.length,
        totalAdmins: adminsData.length,
        totalListings: listingsData.length,
        totalReviews: reviewsData.totalReviews,
        pendingReviews: reviewsData.pendingReviews,
        averageRating: reviewsData.averageRating,
        listingStats,
        topProperties,
        recentActivity: [],
        userGrowth: []
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const handleDeleteListing = (listingId, listingOwnerId) => {
    setPendingDelete({ id: listingId, ownerId: listingOwnerId });
    setDeleteReason("");
    setDeleteError("");
    setShowReasonModal(true);
  };

  const handleReasonSubmit = (e) => {
    e.preventDefault();
    if (!deleteReason.trim()) {
      setDeleteError("Reason is required");
      return;
    }
    setShowReasonModal(false);
    setDeleteError("");
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!deletePassword) {
      setDeleteError("Password is required");
      return;
    }
    setDeleteLoading(true);
    setDeleteError("");
    try {
      // Verify password
      const verifyRes = await fetch(`${API_BASE_URL}/api/user/verify-password/${currentUser._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: deletePassword }),
      });
      if (!verifyRes.ok) {
        setDeleteError("Incorrect password. Property not deleted.");
        setDeleteLoading(false);
        return;
      }
      // Proceed to delete
      const res = await fetch(`${API_BASE_URL}/api/listing/delete/${pendingDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason }),
      });
      const data = await res.json();
      if (res.ok) {
        setOfferListings((prev) => prev.filter((l) => l._id !== pendingDelete.id));
        setRentListings((prev) => prev.filter((l) => l._id !== pendingDelete.id));
        setSaleListings((prev) => prev.filter((l) => l._id !== pendingDelete.id));
        setShowPasswordModal(false);
        toast.success(data.message || 'Listing deleted successfully.');
        fetchAnalytics();
      } else {
        setDeleteError(data.message || 'Failed to delete listing.');
      }
    } catch (err) {
      setDeleteError('An error occurred. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) return <p className="text-center mt-8 text-lg font-semibold text-blue-600 animate-pulse animate-fade-in">Loading admin dashboard...</p>;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between mb-10 gap-6 animate-fade-in-down bg-white rounded-xl shadow-lg p-8 mt-10">
        <div className="text-left w-full md:w-auto flex flex-col items-start">
          <h2 className="text-4xl font-extrabold text-blue-700 animate-fade-in mb-2 drop-shadow">Welcome, Admin!</h2>
          <p className="mt-2 text-lg text-blue-600 animate-fade-in delay-200">Manage all properties and appointments from your dashboard.</p>
        </div>
        <div className="w-full md:w-auto flex justify-end">
          <Link to="/admin/appointments">
            <div className="relative">
              {appointmentCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold z-10">
                  {appointmentCount > 99 ? '99+' : appointmentCount}
                </span>
              )}
              <button className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 mt-4 md:mt-0">
                <FaCalendarAlt className="text-2xl drop-shadow-lg animate-pulse" />
                <span className="tracking-wide">Appointments</span>
              </button>
            </div>
          </Link>
        </div>
      </div>

      {/* Analytics Dashboard */}
      <div className="max-w-7xl mx-auto px-4 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">📊 Analytics Overview</h2>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Users Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-blue-600">{analytics.totalUsers}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <FaUsers className="text-2xl text-blue-600" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500">Admins: {analytics.totalAdmins}</p>
            </div>
          </div>

          {/* Properties Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Properties</p>
                <p className="text-3xl font-bold text-green-600">{analytics.totalListings}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <FaHome className="text-2xl text-green-600" />
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <p className="text-sm text-gray-500">For Sale: {analytics.listingStats.sale}</p>
              <p className="text-sm text-gray-500">For Rent: {analytics.listingStats.rent}</p>
              <p className="text-sm text-gray-500">Offers: {analytics.listingStats.offer}</p>
            </div>
          </div>

          {/* Reviews Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Reviews</p>
                <p className="text-3xl font-bold text-yellow-600">{analytics.totalReviews}</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <FaStar className="text-2xl text-yellow-600" />
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <p className="text-sm text-gray-500">Avg Rating: {analytics.averageRating.toFixed(1)} ⭐</p>
              <p className="text-sm text-orange-500">Pending: {analytics.pendingReviews}</p>
            </div>
          </div>

          {/* Appointments Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Appointments</p>
                <p className="text-3xl font-bold text-purple-600">{bookingStats.total}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <FaCalendarAlt className="text-2xl text-purple-600" />
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <p className="text-sm text-green-600">Accepted: {bookingStats.accepted}</p>
              <p className="text-sm text-orange-500">Pending: {bookingStats.pending}</p>
              <p className="text-sm text-red-500">Rejected: {bookingStats.rejected}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <button
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all hover:scale-105 w-full text-left"
            onClick={() => setShowManagementPasswordModal(true)}
          >
            <div className="flex items-center space-x-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <FaUsers className="text-2xl text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Manage Users</h3>
                <p className="text-sm text-gray-600">View and manage user accounts</p>
              </div>
            </div>
          </button>
          <Link to="/admin/reviews" className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all hover:scale-105">
            <div className="flex items-center space-x-4">
              <div className="bg-yellow-100 p-3 rounded-full">
                <FaStar className="text-2xl text-yellow-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Review Management</h3>
                <p className="text-sm text-gray-600">Approve and manage reviews</p>
                {analytics.pendingReviews > 0 && (
                  <span className="inline-block bg-orange-500 text-white text-xs px-2 py-1 rounded-full mt-1">
                    {analytics.pendingReviews} pending
                  </span>
                )}
              </div>
            </div>
          </Link>
          <Link to="/admin/explore" className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all hover:scale-105">
            <div className="flex items-center space-x-4">
              <div className="bg-green-100 p-3 rounded-full">
                <FaHome className="text-2xl text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">All Properties</h3>
                <p className="text-sm text-gray-600">Browse and manage listings</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Top Rated Properties */}
        {analytics.topProperties.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <FaStar className="text-yellow-500 mr-2" />
              Top Rated Properties
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {analytics.topProperties.map((property) => (
                <div key={property._id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-800 truncate">{property.name}</h4>
                    <span className="text-sm text-yellow-600 font-semibold">
                      {property.averageRating.toFixed(1)} ⭐
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{property.city}, {property.state}</p>
                  <p className="text-sm text-gray-500">
                    {property.reviewCount} review{property.reviewCount !== 1 ? 's' : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Listings Section */}
      <div className="max-w-6xl w-full mx-auto px-2 sm:px-4 md:px-8 py-8 overflow-x-hidden">
        {/* Offer Listings */}
        {offerListings.length > 0 && (
          <div className="mb-8 bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-blue-700 animate-slide-in-left">🔥 Exclusive Offers</h2>
              <Link to="/admin/explore?offer=true" className="text-blue-600 hover:underline">View All Offers</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {offerListings.map((listing) => (
                <div className="transition-transform duration-300 hover:scale-105 hover:shadow-xl" key={listing._id}>
                  <ListingItem listing={listing} onDelete={() => handleDeleteListing(listing._id, listing.userRef)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rent Listings */}
        {rentListings.length > 0 && (
          <div className="mb-8 bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-blue-700 animate-slide-in-left delay-200">🏡 Homes for Rent</h2>
              <Link to="/admin/explore?type=rent" className="text-blue-600 hover:underline">View All Rentals</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {rentListings.map((listing) => (
                <div className="transition-transform duration-300 hover:scale-105 hover:shadow-xl" key={listing._id}>
                  <ListingItem listing={listing} onDelete={() => handleDeleteListing(listing._id, listing.userRef)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sale Listings */}
        {saleListings.length > 0 && (
          <div className="mb-8 bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-blue-700 animate-slide-in-left delay-400">🏠 Homes for Sale</h2>
              <Link to="/admin/explore?type=sale" className="text-blue-600 hover:underline">View All Sales</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {saleListings.map((listing) => (
                <div className="transition-transform duration-300 hover:scale-105 hover:shadow-xl" key={listing._id}>
                  <ListingItem listing={listing} onDelete={() => handleDeleteListing(listing._id, listing.userRef)} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <ContactSupportWrapper />

      {/* Reason Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <form onSubmit={handleReasonSubmit} className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xs flex flex-col gap-4">
            <h3 className="text-lg font-bold text-blue-700 flex items-center gap-2"><FaTrash /> Reason for Deletion</h3>
            <textarea
              className="border rounded p-2 w-full"
              placeholder="Enter reason for deleting this property"
              value={deleteReason}
              onChange={e => setDeleteReason(e.target.value)}
              rows={3}
              autoFocus
            />
            {deleteError && <div className="text-red-600 text-sm">{deleteError}</div>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowReasonModal(false)} className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded bg-red-600 text-white font-semibold">Next</button>
            </div>
          </form>
        </div>
      )}
      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <form onSubmit={handlePasswordSubmit} className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xs flex flex-col gap-4">
            <h3 className="text-lg font-bold text-blue-700 flex items-center gap-2"><FaLock /> Confirm Password</h3>
            <input
              type="password"
              className="border rounded p-2 w-full"
              placeholder="Enter your password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              autoFocus
            />
            {deleteError && <div className="text-red-600 text-sm">{deleteError}</div>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowPasswordModal(false)} className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded bg-blue-700 text-white font-semibold" disabled={deleteLoading}>{deleteLoading ? 'Deleting...' : 'Confirm & Delete'}</button>
            </div>
          </form>
        </div>
      )}
      {showManagementPasswordModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <form className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xs flex flex-col gap-4" onSubmit={async (e) => {
            e.preventDefault();
            setManagementPasswordLoading(true);
            setManagementPasswordError("");
            try {
              const res = await fetch(`${API_BASE_URL}/api/admin/management/verify-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ password: managementPassword })
              });
              if (res.ok) {
                setShowManagementPasswordModal(false);
                setManagementPassword("");
                setManagementPasswordError("");
                navigate('/admin/management');
              } else {
                const data = await res.json();
                setManagementPasswordError(data.message || 'Invalid password');
              }
            } catch (err) {
              setManagementPasswordError('Network error');
            } finally {
              setManagementPasswordLoading(false);
            }
          }}>
            <h3 className="text-lg font-bold text-blue-700 flex items-center gap-2"><FaLock /> Confirm Password</h3>
            <input
              type="password"
              className="border rounded p-2 w-full"
              placeholder="Enter your password"
              value={managementPassword}
              onChange={e => setManagementPassword(e.target.value)}
              autoFocus
            />
            {managementPasswordError && <div className="text-red-600 text-sm">{managementPasswordError}</div>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowManagementPasswordModal(false)} className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded bg-blue-700 text-white font-semibold" disabled={managementPasswordLoading}>{managementPasswordLoading ? 'Verifying...' : 'Confirm'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
} 