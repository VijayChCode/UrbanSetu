import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { FaEdit, FaTrash, FaEye, FaPlus, FaLock, FaShieldAlt } from "react-icons/fa";
import { useDispatch } from "react-redux";
import { signoutUserStart, signoutUserSuccess, signoutUserFailure } from "../redux/user/userSlice";
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import { maskAddress } from '../utils/addressMasking';
import { toast } from 'react-toastify';

import { usePageTitle } from '../hooks/usePageTitle';
import AdminMyListingsSkeleton from "../components/skeletons/AdminMyListingsSkeleton";
import { authenticatedFetch } from '../utils/auth';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminMyListings() {
  // Set page title
  usePageTitle("My Properties - Admin Panel");

  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [listings, setListings] = useState([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const [filters, setFilters] = useState({
    searchTerm: '',
    type: 'all',
    offer: 'all',
    furnished: 'all',
    parking: 'all',
    published: 'all',
    city: '',
    state: ''
  });

  useEffect(() => {
    const fetchMyListings = async () => {
      if (!currentUser) {
        setError("Please sign in to view your listings");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/user`);

        if (res.ok) {
          const data = await res.json();
          if (currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin) {
            setListings(data.filter(listing => listing.userRef === currentUser._id));
          } else {
            setListings(data);
          }
        } else {
          throw new Error("Failed to fetch listings");
        }
      } catch (err) {
        console.error("Error fetching listings:", err);
        setError("Failed to load listings. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchMyListings();
  }, [currentUser]);

  const handleDelete = (id) => {
    setPendingDeleteId(id);
    setShowPasswordModal(true);
    setDeletePassword("");
    setDeleteError("");
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setDeleteLoading(true);
    setDeleteError("");
    try {
      // Verify password
      const verifyRes = await authenticatedFetch(`${API_BASE_URL}/api/user/verify-password/${currentUser._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      });

      if (!verifyRes.ok) {
        // Track wrong attempts locally (allow up to 3 attempts before logout)
        const key = 'adminMyListingPwAttempts';
        const prev = parseInt(localStorage.getItem(key) || '0');
        const next = prev + 1;
        localStorage.setItem(key, String(next));

        if (next >= 3) {
          // Sign out and redirect on third wrong attempt
          toast.error("Too many incorrect attempts. You've been signed out for security.");
          dispatch(signoutUserStart());
          try {
            const signoutRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/signout`);
            const signoutData = await signoutRes.json();
            if (signoutData.success === false) {
              dispatch(signoutUserFailure(signoutData.message));
            } else {
              dispatch(signoutUserSuccess(signoutData));
            }
          } catch (err) {
            dispatch(signoutUserFailure(err.message));
          }
          localStorage.removeItem(key); // Clear attempts on logout
          setShowPasswordModal(false);
          setTimeout(() => {
            navigate('/sign-in');
          }, 800);
          return;
        }

        const remaining = 3 - next;
        setDeleteError(`Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} left before logout.`);
        setDeleteLoading(false);
        return;
      }

      // Success - Clear attempts
      localStorage.removeItem('adminMyListingPwAttempts');

      const res = await authenticatedFetch(`/api/listing/delete/${pendingDeleteId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        setListings((prev) => prev.filter((listing) => listing._id !== pendingDeleteId));
        toast.success("Listing deleted successfully!");
        setShowPasswordModal(false);
        setPendingDeleteId(null);
      } else {
        const data = await res.json();
        setDeleteError(data.message || "Failed to delete listing.");
      }
    } catch (err) {
      setDeleteError("An error occurred. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Calculate discount percentage
  const getDiscountPercentage = (listing) => {
    if (listing.offer && listing.regularPrice && listing.discountPrice) {
      return Math.round(((listing.regularPrice - listing.discountPrice) / listing.regularPrice) * 100);
    }
    return 0;
  };

  const filteredListings = listings.filter((l) => {
    const matchesSearch = filters.searchTerm
      ? (l.name?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        (l.address && String(l.address).toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
        (l.city && l.city.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
        (l.state && l.state.toLowerCase().includes(filters.searchTerm.toLowerCase())))
      : true;
    const matchesType = filters.type === 'all' ? true : l.type === filters.type;
    const matchesOffer = filters.offer === 'all' ? true : (filters.offer === 'true' ? !!l.offer : !l.offer);
    const matchesFurnished = filters.furnished === 'all' ? true : (filters.furnished === 'true' ? !!l.furnished : !l.furnished);
    const matchesParking = filters.parking === 'all' ? true : (filters.parking === 'true' ? !!l.parking : !l.parking);
    const matchesCity = filters.city ? (l.city && l.city.toLowerCase().includes(filters.city.toLowerCase())) : true;
    const matchesState = filters.state ? (l.state && l.state.toLowerCase().includes(filters.state.toLowerCase())) : true;
    const matchesPublished = filters.published === 'all' ? true : (filters.published === 'true' ? !!l.isVerified : !l.isVerified);
    return matchesSearch && matchesType && matchesOffer && matchesFurnished && matchesParking && matchesCity && matchesState && matchesPublished;
  });

  if (loading) {
    return <AdminMyListingsSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 py-10 px-2 md:px-8">
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg p-6">
          <div className="text-center text-red-600 text-lg">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-950 py-10 px-2 md:px-8 transition-colors duration-300">
        <div className="max-w-6xl w-full mx-auto px-2 sm:px-4 md:px-8 py-8 overflow-x-hidden">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 transition-colors duration-300">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-blue-700 dark:text-blue-400 drop-shadow">My Listings (Admin)</h3>
              {listings.length > 0 && (
                <Link
                  to="/admin/create-listing"
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-1 sm:gap-2 text-sm sm:text-base w-full sm:w-auto justify-center mt-4 md:mt-0"
                >
                  <FaPlus /> <span>Create New Listing</span>
                </Link>
              )}
            </div>

            {/* Filters */}
            {listings.length > 0 && (
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-gray-900 dark:text-white">
                <input
                  type="text"
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  className="border dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700"
                  placeholder="Search by name/address/city/state"
                />
                <select className="border dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
                  <option value="all">All Types</option>
                  <option value="sale">Sale</option>
                  <option value="rent">Rent</option>
                </select>
                <select className="border dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700" value={filters.offer} onChange={(e) => setFilters({ ...filters, offer: e.target.value })}>
                  <option value="all">Offer: Any</option>
                  <option value="true">Offer: Yes</option>
                  <option value="false">Offer: No</option>
                </select>
                <select className="border dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700" value={filters.published} onChange={(e) => setFilters({ ...filters, published: e.target.value })}>
                  <option value="all">Status: Any</option>
                  <option value="true">Verified (Published)</option>
                  <option value="false">Pending (Unpublished)</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select className="border dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700" value={filters.furnished} onChange={(e) => setFilters({ ...filters, furnished: e.target.value })}>
                    <option value="all">Furnished: Any</option>
                    <option value="true">Furnished</option>
                    <option value="false">Unfurnished</option>
                  </select>
                  <select className="border dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700" value={filters.parking} onChange={(e) => setFilters({ ...filters, parking: e.target.value })}>
                    <option value="all">Parking: Any</option>
                    <option value="true">With Parking</option>
                    <option value="false">No Parking</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={filters.city}
                  onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                  className="border dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700"
                  placeholder="City"
                />
                <input
                  type="text"
                  value={filters.state}
                  onChange={(e) => setFilters({ ...filters, state: e.target.value })}
                  className="border dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700"
                  placeholder="State"
                />
              </div>
            )}

            {listings.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">🏠</div>
                <h4 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No listings yet</h4>
                <p className="text-gray-500 dark:text-gray-400 mb-6">Start by creating your first property listing</p>
                <Link
                  to="/admin/create-listing"
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold inline-flex items-center gap-1 sm:gap-2 text-sm sm:text-base w-full sm:w-auto justify-center"
                >
                  <FaPlus /> <span>Create Your First Listing</span>
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                  {filteredListings.slice(0, visibleCount).map((listing) => (
                    <div key={listing._id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                      {/* Image */}
                      <div className="relative h-48 bg-gray-200 dark:bg-gray-700">
                        {listing.imageUrls && listing.imageUrls.length > 0 && listing.imageUrls[0] ? (
                          <img
                            src={listing.imageUrls[0]}
                            alt={listing.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentNode.querySelector('.no-image-placeholder').style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className={`no-image-placeholder absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900/40 ${listing.imageUrls && listing.imageUrls[0] ? 'hidden' : 'flex'}`}>
                          <div className="text-4xl opacity-80">🏠</div>
                          <p className="text-xs font-bold uppercase tracking-widest text-center opacity-70">No Image Available</p>
                        </div>

                        {/* Type Badge */}
                        <div className="absolute top-2 left-2">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${listing.type === 'rent'
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                            : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                            }`}>
                            {listing.type === 'rent' ? 'For Rent' : 'For Sale'}
                          </span>
                        </div>

                        {/* Offer Badge */}
                        {listing.offer && (
                          <div className="absolute top-2 right-2">
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-400 text-gray-900 shadow-sm animate-pulse">
                              {getDiscountPercentage(listing)}% OFF
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-4">
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-2 line-clamp-1">{listing.name}</h4>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                          {maskAddress(
                            // Create address object if structured fields exist, otherwise use legacy address
                            listing.propertyNumber || listing.city ? {
                              propertyNumber: listing.propertyNumber,
                              landmark: listing.landmark,
                              city: listing.city,
                              district: listing.district,
                              state: listing.state,
                              pincode: listing.pincode
                            } : listing.address,
                            true
                          )}
                        </p>

                        {/* Price */}
                        <div className="mb-3">
                          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                            {formatPrice(listing.regularPrice)}
                          </span>
                          {listing.type === 'rent' && <span className="text-gray-500 dark:text-gray-400 text-sm">/month</span>}
                          {listing.offer && (
                            <div className="text-sm text-gray-500 dark:text-gray-500 line-through">
                              {formatPrice(listing.regularPrice)}
                            </div>
                          )}
                        </div>

                        {/* Property Details */}
                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
                          <span>{listing.bedrooms} bed</span>
                          <span>{listing.bathrooms} bath</span>
                          <span>{listing.furnished ? 'Furnished' : 'Unfurnished'}</span>
                          <span>{listing.parking ? 'Parking' : 'No Parking'}</span>
                        </div>

                        {/* Verification Status - For All Properties */}
                        {!listing.isVerified ? (
                          <div className="mb-3 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 dark:border-yellow-600 p-3 rounded transition-colors">
                            <div className="flex items-start gap-2">
                              <div className="flex-shrink-0 mt-0.5">
                                <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-200 mb-1 transition-colors">Not Published</p>
                                <p className="text-xs text-yellow-700 dark:text-yellow-300 transition-colors">Complete verification to make this property visible to buyers</p>

                                <button
                                  onClick={() => navigate(`/admin/property-verification?listingId=${listing._id}`)}
                                  className="mt-2 px-3 py-1.5 bg-yellow-600 text-white rounded text-xs font-semibold hover:bg-yellow-700 transition flex items-center gap-1"
                                >
                                  <FaShieldAlt /> Verify Property
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mb-3">
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-semibold flex items-center gap-1 w-fit transition-colors">
                              <FaShieldAlt /> Verified
                            </span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Link
                            to={`/admin/listing/${listing._id}`}
                            className="flex-1 bg-blue-500 text-white px-3 py-2 rounded text-sm font-medium hover:bg-blue-600 transition flex items-center justify-center gap-1"
                          >
                            <FaEye /> View
                          </Link>
                          <Link
                            to={`/admin/update-listing/${listing._id}`}
                            className="flex-1 bg-yellow-500 text-white px-3 py-2 rounded text-sm font-medium hover:bg-yellow-600 transition flex items-center justify-center gap-1"
                          >
                            <FaEdit /> Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(listing._id)}
                            className="flex-1 bg-red-500 text-white px-3 py-2 rounded text-sm font-medium hover:bg-red-600 transition flex items-center justify-center gap-1"
                          >
                            <FaTrash /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {filteredListings.length > visibleCount && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={() => setVisibleCount((c) => c + 12)}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      Show more
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {showPasswordModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm z-50">
          <form onSubmit={handlePasswordSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-xs flex flex-col gap-4">
            <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2"><FaLock /> Confirm Password</h3>
            <input
              type="password"
              className="border dark:border-gray-700 rounded p-2 w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter your password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              autoFocus
            />
            {deleteError && <div className="text-red-600 dark:text-red-400 text-sm">{deleteError}</div>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowPasswordModal(false)} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded bg-red-600 text-white font-semibold" disabled={deleteLoading}>{deleteLoading ? 'Deleting...' : 'Confirm & Delete'}</button>
            </div>
          </form>
        </div>
      )}
      <ContactSupportWrapper />
    </>
  );
} 