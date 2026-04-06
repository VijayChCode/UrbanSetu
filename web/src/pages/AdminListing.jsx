import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { Navigation } from "swiper/modules";
import { FaBath, FaBed, FaChair, FaMapMarkerAlt, FaParking, FaShare, FaEdit, FaTrash, FaArrowLeft, FaHeart, FaExpand, FaRocket, FaCheckCircle, FaEye, FaLock } from "react-icons/fa";
import { maskAddress, shouldShowLocationLink, getLocationLinkText } from "../utils/addressMasking";
import { toast } from 'react-toastify';
import { useWishlist } from '../WishlistContext';
import { useSelector } from 'react-redux';
import ImagePreview from "../components/ImagePreview.jsx";
import SmartPriceInsights from "../components/SmartPriceInsights.jsx";
import { usePageTitle } from '../hooks/usePageTitle';
import { authenticatedFetch } from '../utils/auth';
import UrbanSetuSpinner from "../components/UrbanSetuSpinner.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminListing() {
  // Set page title
  usePageTitle("Admin Property Details - Property Management");

  const params = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [showDeassignModal, setShowDeassignModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [deassignReason, setDeassignReason] = useState('');
  const [deassignPassword, setDeassignPassword] = useState('');
  const [deassignLoading, setDeassignLoading] = useState(false);
  const [deassignError, setDeassignError] = useState('');
  const [showSmartPriceInsights, setShowSmartPriceInsights] = useState(false);

  const formatINR = (amount) => {
    return `₹${Number(amount).toLocaleString("en-IN")}`;
  };

  const getDiscountPercentage = () => {
    if (!listing || !listing.offer || !listing.regularPrice || !listing.discountPrice) return 0;
    return Math.round(((listing.regularPrice - listing.discountPrice) / listing.regularPrice) * 100);
  };

  const refreshWatchlistCount = async () => {
    try {
      const watchlistRes = await authenticatedFetch(`${API_BASE_URL}/api/watchlist/count/${params.listingId}`);
      if (watchlistRes.ok) {
        const watchlistData = await watchlistRes.json();
        setWatchlistCount(watchlistData.count || 0);
      }
    } catch (error) {
      console.error('Error refreshing watchlist count:', error);
    }
  };

  const handleImageClick = (index) => {
    setSelectedImageIndex(index);
    setShowImagePreview(true);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this property?')) return;

    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/delete/${listing._id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        toast.success('Property deleted successfully!');
        navigate('/admin/listings');
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to delete property.');
      }
    } catch (error) {
      console.error('Error deleting property:', error);
      toast.error('An error occurred while deleting the property.');
    }
  };

  const handleDeassignOwner = () => {
    setDeassignReason('');
    setDeassignError('');
    setShowDeassignModal(true);
  };

  const handleDeassignReasonSubmit = (e) => {
    e.preventDefault();
    if (!deassignReason.trim()) {
      setDeassignError('Reason is required');
      return;
    }
    setShowDeassignModal(false);
    setDeassignError('');
    setShowPasswordModal(true);
  };

  const handleDeassignPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!deassignPassword) {
      setDeassignError('Password is required');
      return;
    }
    setDeassignLoading(true);
    setDeassignError('');

    try {
      // Verify password first
      const verifyRes = await authenticatedFetch(`${API_BASE_URL}/api/user/verify-password/${currentUser._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deassignPassword }),
      });

      if (!verifyRes.ok) {
        setDeassignError('Incorrect password. Owner not deassigned.');
        setDeassignLoading(false);
        return;
      }

      // Proceed to deassign owner
      const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/deassign-owner/${listing._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deassignReason }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowPasswordModal(false);
        setDeassignPassword('');
        setDeassignReason('');
        toast.success(data.message || 'Owner deassigned successfully.');
        // Refresh the listing data
        window.location.reload();
      } else {
        setDeassignError(data.message || 'Failed to deassign owner.');
      }
    } catch (err) {
      setDeassignError('An error occurred. Please try again.');
    } finally {
      setDeassignLoading(false);
    }
  };

  useEffect(() => {
    const fetchListing = async () => {
      setLoading(true);
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/get/${params.listingId}`);
        const data = await res.json();
        if (data.success === false) {
          return;
        }
        setListing(data);

        // Fetch watchlist count
        await refreshWatchlistCount();
      } catch (error) {
        console.error("Error fetching listing:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchListing();

    // Set up periodic refresh of watchlist count every 30 seconds
    const interval = setInterval(refreshWatchlistCount, 30000);

    return () => clearInterval(interval);
  }, [params.listingId]);

  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { currentUser } = useSelector((state) => state.user);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-slate-900 dark:to-slate-800 min-h-screen py-10 px-2 md:px-8 transition-colors duration-300">
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 relative">
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <UrbanSetuSpinner size="lg" />
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400 animate-pulse uppercase tracking-wider">Loading property details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-slate-900 dark:to-slate-800 min-h-screen py-10 px-2 md:px-8 transition-colors duration-300">
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 relative">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Property Not Found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">The property you're looking for doesn't exist or has been removed.</p>
            <Link
              to="/admin"
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950 min-h-screen py-4 sm:py-10 px-1 sm:px-2 md:px-8 transition-colors duration-300">
      <div className="max-w-4xl w-full mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-2 sm:p-4 lg:p-6 relative overflow-x-hidden border border-gray-100 dark:border-gray-700">
        {/* Header with Back Button and Admin Actions */}
        <div className="mb-6 w-full">
          {/* Mobile Layout - Stack buttons vertically for better mobile experience */}
          <div className="block sm:hidden space-y-2 px-1">
            <Link
              to="/admin"
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 py-2 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 text-center justify-center text-xs"
            >
              <FaArrowLeft className="text-xs" />
              Back to Dashboard
            </Link>
            <div className="grid grid-cols-2 gap-1">
              <Link
                to={`/admin/update-listing/${listing._id}`}
                className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-2 py-2 rounded-lg hover:from-green-600 hover:to-teal-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-1 text-center justify-center text-xs"
              >
                <FaEdit className="text-xs" />
                Edit
              </Link>
              <button
                onClick={handleDelete}
                className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-2 py-2 rounded-lg hover:from-red-600 hover:to-pink-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-1 text-center justify-center text-xs"
              >
                <FaTrash className="text-xs" />
                Delete
              </button>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success('Property link copied to clipboard!');
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-3 py-2 rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 text-center justify-center text-xs"
            >
              <FaShare className="text-xs" />
              Share Property
            </button>
          </div>

          {/* Desktop Layout - Original grid layout */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 w-full">
            <Link
              to="/admin"
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 text-center justify-center text-sm sm:text-base"
            >
              <FaArrowLeft className="text-sm" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Link>
            <Link
              to={`/admin/update-listing/${listing._id}`}
              className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-4 py-3 rounded-lg hover:from-green-600 hover:to-teal-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 text-center justify-center text-sm sm:text-base"
            >
              <FaEdit className="text-sm" />
              <span className="hidden sm:inline">Edit Property</span>
              <span className="sm:hidden">Edit</span>
            </Link>
            <button
              onClick={handleDelete}
              className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-3 rounded-lg hover:from-red-600 hover:to-pink-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 text-center justify-center text-sm sm:text-base"
            >
              <FaTrash className="text-sm" />
              <span className="hidden sm:inline">Delete Property</span>
              <span className="sm:hidden">Delete</span>
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success('Property link copied to clipboard!');
              }}
              className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-4 py-3 rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 text-center justify-center text-sm sm:text-base"
            >
              <FaShare className="text-sm" />
              <span className="hidden sm:inline">Share Property</span>
              <span className="sm:hidden">Share</span>
            </button>
          </div>
        </div>

        <h3 className="text-3xl font-extrabold text-blue-700 dark:text-blue-400 mb-6 text-center drop-shadow">
          Property Details (Admin View)
        </h3>

        {/* Swiper Section */}
        <div className="relative mb-6">
          <Swiper
            navigation
            modules={[Navigation]}
            className="rounded-lg overflow-hidden relative"
            onSlideChange={(swiper) => {
              // Update selected image index when swiper changes
              setSelectedImageIndex(swiper.activeIndex);
            }}
          >
            {listing.imageUrls && listing.imageUrls.length > 0 ? (
              listing.imageUrls.map((url, index) => (
                <SwiperSlide key={index}>
                  <div className="relative group">
                    <img
                      src={url}
                      alt={`${listing.name} - Image ${index + 1}`}
                      className="w-full h-40 sm:h-64 md:h-96 object-cover transition-transform duration-200 group-hover:scale-105"
                      onError={(e) => {
                        e.target.src = "https://via.placeholder.com/800x600?text=Image+Not+Available";
                        e.target.className = "w-full h-40 sm:h-64 md:h-96 object-cover opacity-50";
                      }}
                    />
                    {/* Expand Button Overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                      <div className="bg-white bg-opacity-90 dark:bg-gray-800 dark:bg-opacity-90 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <FaExpand className="text-gray-700 dark:text-gray-200" />
                      </div>
                    </div>
                    {/* Click to expand text */}
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      Click to expand
                    </div>
                    {/* Invisible clickable overlay */}
                    <button
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleImageClick(index);
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleImageClick(index);
                      }}
                      aria-label={`Expand image ${index + 1}`}
                    />
                  </div>
                </SwiperSlide>
              ))
            ) : (
              <SwiperSlide>
                <div className="w-full h-64 md:h-96 bg-gray-50 dark:bg-gray-900/40 flex items-center justify-center transition-colors duration-300">
                  <div className="text-center text-gray-400 dark:text-gray-500">
                    <div className="text-6xl mb-4 opacity-80">🏠</div>
                    <p className="text-xs font-bold uppercase tracking-widest text-center opacity-70">No images available</p>
                  </div>
                </div>
              </SwiperSlide>
            )}
          </Swiper>
        </div>

        {/* Share Button (additional mobile convenience) */}
        <div className="flex justify-end items-center space-x-4 mb-4 pr-2">
          <FaShare
            className="cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          />
        </div>
        {copied && <p className="text-green-500 text-sm text-center mb-4">Link copied!</p>}

        {/* Details Card */}
        <div className="p-3 sm:p-6 bg-gray-50 dark:bg-gray-700/50 shadow-md rounded-lg mb-6 border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
            <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 break-words flex items-center gap-2">
              {listing.name}
              {listing.isVerified && (
                <span className="ml-3 px-3 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-full text-xs font-semibold flex items-center gap-1">
                  <FaCheckCircle /> Verified
                </span>
              )}
              {!listing.isVerified && (
                <span className="ml-3 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-semibold flex items-center gap-1">
                  ⚠️ Not Verified
                </span>
              )}
              {/* Wishlist Heart Icon - match ListingItem style */}
              <button
                onClick={async () => {
                  if (!currentUser) {
                    toast.info('Please sign in to add properties to your wishlist.');
                    navigate('/sign-in');
                    return;
                  }
                  if (isInWishlist(listing._id)) {
                    await removeFromWishlist(listing._id);
                    toast.success('Property removed from your wishlist.');
                  } else {
                    await addToWishlist(listing);
                  }
                  await refreshWatchlistCount();
                }}
                className={`ml-2 p-2 rounded-full transition z-20 ${isInWishlist(listing._id) ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-red-500 hover:text-red-600'} focus:outline-none shadow-sm`}
                title={isInWishlist(listing._id) ? 'Remove from wishlist' : 'Add to wishlist'}
                style={{ lineHeight: 0 }}
              >
                <FaHeart className="text-base sm:text-lg" />
              </button>
            </h2>
            <div className="mb-4">
              {listing.offer && getDiscountPercentage() > 0 ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <p className="text-lg sm:text-2xl md:text-3xl text-blue-600 dark:text-blue-400 font-semibold">
                    {formatINR(listing.discountPrice)}
                    {listing.type === "rent" && " / month"}
                  </p>
                  <p className="text-base sm:text-xl text-gray-500 line-through">
                    {formatINR(listing.regularPrice)}
                  </p>
                  <span className="text-xs sm:text-sm text-green-600 dark:text-green-400 font-semibold">
                    Save {formatINR(listing.regularPrice - listing.discountPrice)}
                  </span>
                </div>
              ) : (
                <p className="text-lg sm:text-2xl md:text-3xl text-blue-600 dark:text-blue-400 font-semibold">
                  {formatINR(listing.regularPrice)}
                  {listing.type === "rent" && " / month"}
                </p>
              )}
            </div>
          </div>

          <p className="flex items-center text-gray-600 dark:text-gray-400 mb-4">
            <FaMapMarkerAlt className="mr-2 text-red-500" />
            {maskAddress(
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

          {listing.locationLink && shouldShowLocationLink(true) && (
            <div className="mb-4">
              <a
                href={listing.locationLink}
                rel="noopener noreferrer"
                target="_blank"
                className="inline-block bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition shadow-md"
              >
                {getLocationLinkText(true)}
              </a>
            </div>
          )}

          <div className="flex space-x-4 mb-4">
            <span className={`px-3 py-1 text-white rounded-md shadow-sm ${listing.type === "rent" ? "bg-blue-500" : "bg-green-500"}`}>
              {listing.type === "rent" ? "For Rent" : "For Sale"}
            </span>
            {listing.offer && (
              <span className="px-3 py-1 bg-yellow-400 text-white rounded-md shadow-sm">
                {formatINR(listing.discountPrice)} OFF
              </span>
            )}
          </div>

          <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
            <span className="font-bold text-gray-900 dark:text-gray-100">Description:</span> {listing.description}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
              <FaBed className="mr-2 text-blue-500" /> <span className="text-gray-700 dark:text-gray-300">{listing.bedrooms} {listing.bedrooms > 1 ? "beds" : "bed"}</span>
            </div>
            <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
              <FaBath className="mr-2 text-blue-500" /> <span className="text-gray-700 dark:text-gray-300">{listing.bathrooms} {listing.bathrooms > 1 ? "baths" : "bath"}</span>
            </div>
            <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
              <FaParking className="mr-2 text-blue-500" /> <span className="text-gray-700 dark:text-gray-300">{listing.parking ? "Parking" : "No Parking"}</span>
            </div>
            <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
              <FaChair className="mr-2 text-blue-500" /> <span className="text-gray-700 dark:text-gray-300">{listing.furnished ? "Furnished" : "Unfurnished"}</span>
            </div>
          </div>
        </div>

        {/* Smart Price Insights Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowSmartPriceInsights(!showSmartPriceInsights)}
            className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-4 rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all flex items-center justify-center gap-3 shadow-lg"
          >
            <FaRocket className="text-xl" />
            <span className="text-lg font-semibold">Smart Price Insights</span>
          </button>
        </div>

        {/* Smart Price Insights Section */}
        {showSmartPriceInsights && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <SmartPriceInsights listing={listing} currentUser={currentUser} />
          </div>
        )}

        {/* Admin Information */}
        <div className="p-6 bg-blue-50 dark:bg-blue-900/20 shadow-md rounded-lg mb-6 border border-blue-100 dark:border-blue-900/30">
          <h4 className="text-xl font-bold text-blue-800 dark:text-blue-300 mb-4">Admin Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Property ID</p>
              <p className="font-mono text-xs break-all text-gray-800 dark:text-gray-200 bg-white/50 dark:bg-gray-800/50 p-1 rounded select-all">{listing._id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Created Date</p>
              <p className="font-semibold text-gray-800 dark:text-gray-200">
                {new Date(listing.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Last Updated</p>
              <p className="font-semibold text-gray-800 dark:text-gray-200">
                {new Date(listing.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-gray-500 dark:text-gray-400">Owner ID / userRef</p>
                {listing.userRef && (
                  <button
                    onClick={handleDeassignOwner}
                    className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline font-medium"
                    title="Deassign owner from this property"
                  >
                    Deassign
                  </button>
                )}
              </div>
              <p className="font-mono text-xs break-all text-gray-800 dark:text-gray-200 bg-white/50 dark:bg-gray-800/50 p-1 rounded select-all">
                {typeof listing.userRef === 'object' ? listing.userRef._id : listing.userRef || 'Unknown'}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-gray-500 dark:text-gray-400">Watchlist Count</p>
                <button
                  onClick={refreshWatchlistCount}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline font-medium"
                  title="Refresh watchlist count"
                >
                  Refresh
                </button>
              </div>
              <p className="font-semibold text-purple-800 dark:text-purple-400 flex items-center gap-1 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded w-fit">
                <FaEye className="text-sm" />
                {watchlistCount} user{watchlistCount !== 1 ? 's' : ''} watching
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Verification Status</p>
              <p className={`font-semibold flex items-center gap-1 ${listing.isVerified ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                {listing.isVerified ? (
                  <>
                    <FaCheckCircle className="text-sm" /> Verified
                  </>
                ) : (
                  <>
                    ⚠️ Not Verified
                  </>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Visibility Status</p>
              <p className={`font-semibold flex items-center gap-2 ${listing.visibility === 'public' ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'}`}>
                {listing.visibility === 'public' ? (
                  <>
                    <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                    🌐 Public
                  </>
                ) : (
                  <>
                    <FaLock className="text-xs" />
                    🔒 Private (Admin Only)
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {listing && listing.imageUrls && listing.imageUrls.length > 0 && (
        <ImagePreview
          isOpen={showImagePreview}
          onClose={() => setShowImagePreview(false)}
          images={listing.imageUrls}
          initialIndex={selectedImageIndex}
          listingId={listing._id}
          metadata={{
            addedFrom: 'listing',
            listingName: listing.name,
            listingType: listing.type
          }}
        />
      )}

      {/* Deassign Owner Reason Modal */}
      {showDeassignModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 animate-fade-in p-4">
          <form onSubmit={handleDeassignReasonSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md flex flex-col gap-4 transform transition-all border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
              <FaTrash /> Deassign Owner
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Please provide a reason for deassigning the owner of this property. This action will be logged.
            </p>
            <textarea
              className="border border-gray-300 dark:border-gray-600 rounded-xl p-3 w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 outline-none transition-all"
              placeholder="Enter reason for deassigning owner..."
              value={deassignReason}
              onChange={e => setDeassignReason(e.target.value)}
              rows={4}
              autoFocus
            />
            {deassignError && <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-900/30">{deassignError}</div>}
            <div className="flex gap-3 justify-end mt-2">
              <button
                type="button"
                onClick={() => setShowDeassignModal(false)}
                className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 text-white font-semibold hover:from-red-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all"
              >
                Next Step
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Deassign Owner Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 animate-fade-in p-4">
          <form onSubmit={handleDeassignPasswordSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md flex flex-col gap-4 transform transition-all border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
              <FaLock /> Confirm Identity
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Please enter your admin password to confirm the deassignment. This action is sensitive.
            </p>
            <input
              type="password"
              className="border border-gray-300 dark:border-gray-600 rounded-xl p-3 w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="Enter your admin password"
              value={deassignPassword}
              onChange={e => setDeassignPassword(e.target.value)}
              autoFocus
            />
            {deassignError && <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-900/30">{deassignError}</div>}
            <div className="flex gap-3 justify-end mt-2">
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Go Back
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 text-white font-semibold hover:from-red-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                disabled={deassignLoading}
              >
                {deassignLoading ? (
                  <div className="flex items-center gap-2">
                    <UrbanSetuSpinner size="sm" isBright={true} />
                    Processing...
                  </div>
                ) : 'Confirm & Deassign'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}