import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaEdit, FaTrash, FaEye, FaPlus, FaLock } from "react-icons/fa";
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import { maskAddress } from '../utils/addressMasking';
import { useSelector } from "react-redux";
import { toast } from 'react-toastify';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminListings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useSelector((state) => state.user);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
    const [pendingDeleteId, setPendingDeleteId] = useState(null);
 
   // Lock body scroll when deletion modals are open on Admin Listings
   useEffect(() => {
     const shouldLock = showReasonModal || showPasswordModal;
     if (shouldLock) {
       document.body.classList.add('modal-open');
     } else {
       document.body.classList.remove('modal-open');
     }
     return () => {
       document.body.classList.remove('modal-open');
     };
   }, [showReasonModal, showPasswordModal]);
 
   useEffect(() => {
    const fetchAllListings = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/api/listing/get`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setListings(data);
        } else {
          throw new Error("Failed to fetch listings");
        }
      } catch (err) {
        setError("Failed to load listings. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchAllListings();
  }, []);

  const handleDelete = (id) => {
    setPendingDeleteId(id);
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
      const res = await fetch(`${API_BASE_URL}/api/listing/delete/${pendingDeleteId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason }),
      });
      if (res.ok) {
        setListings((prev) => prev.filter((listing) => listing._id !== pendingDeleteId));
        setShowPasswordModal(false);
        const data = await res.json();
        toast.success(data.message || "Listing deleted successfully!");
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading all listings...</p>
        </div>
      </div>
    );
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 py-10 px-2 md:px-8">
        <div className="max-w-6xl w-full mx-auto px-2 sm:px-4 md:px-8 py-8 overflow-x-hidden">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-blue-700 drop-shadow">All Listings (Admin)</h3>
              <Link
                to="/admin/create-listing"
                className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-1 sm:gap-2 text-sm sm:text-base w-full sm:w-auto justify-center mt-4 md:mt-0"
              >
                <FaPlus /> <span>Create New Listing</span>
              </Link>
            </div>

            {listings.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">🏠</div>
                <h4 className="text-xl font-semibold text-gray-600 mb-2">No listings yet</h4>
                <p className="text-gray-500 mb-6">Start by creating your first property listing</p>
                <Link
                  to="/admin/create-listing"
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold inline-flex items-center gap-1 sm:gap-2 text-sm sm:text-base w-full sm:w-auto justify-center"
                >
                  <FaPlus /> <span>Create Your First Listing</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {listings.map((listing) => (
                  <div key={listing._id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                    {/* Image */}
                    <div className="relative h-48 bg-gray-200 rounded-t-lg overflow-hidden">
                      {listing.imageUrls && listing.imageUrls.length > 0 ? (
                        <img
                          src={listing.imageUrls[0]}
                          alt={listing.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = "https://via.placeholder.com/400x300?text=No+Image";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <span>No Image</span>
                        </div>
                      )}
                      
                      {/* Offer Badge */}
                      {listing.offer && getDiscountPercentage(listing) > 0 && (
                        <div className="absolute top-2 left-2 z-20">
                          <span 
                            className="bg-yellow-400 text-gray-900 text-xs font-semibold px-2 py-1 rounded-full shadow-md animate-pulse"
                            title="Limited-time offer!"
                          >
                            {getDiscountPercentage(listing)}% OFF
                          </span>
                        </div>
                      )}
                      
                      <div className="absolute top-2 right-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          listing.type === 'sale' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {listing.type === 'sale' ? 'For Sale' : 'For Rent'}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h4 className="font-semibold text-lg text-gray-800 mb-2 truncate">{listing.name}</h4>
                      <p className="text-gray-600 text-sm mb-2 truncate">
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
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                        <span>{listing.bedrooms} bed</span>
                        <span>{listing.bathrooms} bath</span>
                        {listing.parking && <span>Parking</span>}
                        {listing.furnished && <span>Furnished</span>}
                      </div>

                      <div className="flex items-center justify-between mb-4">
                        <div className="text-lg font-bold text-blue-600">
                          {listing.offer && getDiscountPercentage(listing) > 0 ? (
                            <div className="flex items-center gap-2">
                              <span>{formatPrice(listing.discountPrice)}</span>
                              <span className="text-sm text-gray-500 line-through">
                                {formatPrice(listing.regularPrice)}
                              </span>
                            </div>
                          ) : (
                            <span>
                              {formatPrice(listing.regularPrice)}
                              {listing.type === 'rent' && <span className="text-sm text-gray-500">/month</span>}
                            </span>
                          )}
                        </div>
                        {listing.offer && getDiscountPercentage(listing) > 0 && (
                          <span className="text-sm text-green-600 font-medium">
                            Save {formatPrice(listing.regularPrice - listing.discountPrice)}
                          </span>
                        )}
                      </div>

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
            )}
          </div>
        </div>
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
    </>
  );
} 