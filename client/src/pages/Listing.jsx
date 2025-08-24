import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { Navigation } from "swiper/modules";
import { FaBath, FaBed, FaChair, FaMapMarkerAlt, FaParking, FaShare, FaEdit, FaTrash, FaArrowLeft, FaStar, FaLock, FaHeart, FaExpand, FaCheckCircle, FaFlag } from "react-icons/fa";
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import ReviewForm from "../components/ReviewForm.jsx";
import ReviewList from "../components/ReviewList.jsx";
import ImagePreview from "../components/ImagePreview.jsx";
import { maskAddress, shouldShowLocationLink, getLocationLinkText } from "../utils/addressMasking";
import { toast } from 'react-toastify';
import { useWishlist } from '../WishlistContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function Listing() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useSelector((state) => state.user);
  const [listing, setListing] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const [ownerDetails, setOwnerDetails] = useState(null);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState("");
  const [showReviews, setShowReviews] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showAssignOwnerModal, setShowAssignOwnerModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [assignOwnerLoading, setAssignOwnerLoading] = useState(false);
  const [selectedNewOwner, setSelectedNewOwner] = useState("");
  const [ownerStatus, setOwnerStatus] = useState({ isActive: false, owner: null });
  
  // Report property states
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportCategory, setReportCategory] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
 
   // Lock body scroll when deletion/assign/report modals are open
   useEffect(() => {
     const shouldLock = showReasonModal || showPasswordModal || showAssignOwnerModal || showReportModal;
     if (shouldLock) {
       document.body.classList.add('modal-open');
     } else {
       document.body.classList.remove('modal-open');
     }
     return () => {
       document.body.classList.remove('modal-open');
     };
   }, [showReasonModal, showPasswordModal, showAssignOwnerModal, showReportModal]);
 
   // Check if user is admin
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'rootadmin';
  
  // Check if we're in admin context
  const isAdminContext = location.pathname.includes('/admin');

  // Determine back button destination and text
  const getBackButtonInfo = () => {
    if (!currentUser) {
      // Public user - go to home
      return { path: '/', text: 'Back to Home' };
    } else if (isAdminContext) {
      // Admin context - go to admin dashboard
      return { path: '/admin', text: 'Back to Dashboard' };
    } else {
      // User context - go to user dashboard
      return { path: '/user', text: 'Back to Home' };
    }
  };

  const backButtonInfo = getBackButtonInfo();

  const formatINR = (amount) => {
    return `₹${Number(amount).toLocaleString("en-IN")}`;
  };

  // Calculate discount percentage
  const getDiscountPercentage = () => {
    if (listing.offer && listing.regularPrice && listing.discountPrice) {
      return Math.round(((listing.regularPrice - listing.discountPrice) / listing.regularPrice) * 100);
    }
    return 0;
  };

  const handleDelete = () => {
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

  const handleImageClick = (index) => {
    setSelectedImageIndex(index);
    setShowImagePreview(true);
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
      const verifyRes = await fetch(`/api/user/verify-password/${currentUser._id}`, {
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
      const res = await fetch(`/api/listing/delete/${listing._id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason }),
      });
      if (res.ok) {
        toast.success('Property deleted successfully!');
        setShowPasswordModal(false);
        navigate('/admin/listings');
      } else {
        const data = await res.json();
        setDeleteError(data.message || 'Failed to delete property.');
      }
    } catch (error) {
      setDeleteError('An error occurred while deleting the property.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Function to check if current owner is active
  const checkOwnerStatus = async () => {
    if (listing && listing.userRef) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/user/id/${listing.userRef}`);
        if (res.ok) {
          const ownerData = await res.json();
          if (ownerData && ownerData.status !== 'suspended') {
            return { isActive: true, owner: ownerData };
          }
        }
      } catch (error) {
        // Owner account is deleted/inactive
        return { isActive: false, owner: null };
      }
    }
    return { isActive: false, owner: null };
  };

  // Function to fetch available users for owner assignment
  const fetchAvailableUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/all-users-autocomplete`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableUsers(data);
      } else {
        console.error('Failed to fetch available users');
      }
    } catch (error) {
        console.error('Error fetching available users:', error);
      }
    };

  // Function to handle property report
  const handleReportProperty = async () => {
    if (!reportCategory) {
      toast.error('Please select a report category');
      return;
    }
    
    setReportLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/listing/report/${listing._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          category: reportCategory,
          details: reportDetails.trim()
        }),
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.info("Thank you for reporting. Our team will review this property.");
        setShowReportModal(false);
        setReportCategory('');
        setReportDetails('');
      } else {
        toast.error(data.message || 'Failed to report property');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setReportLoading(false);
    }
  };

  // Function to assign new owner
  const handleAssignNewOwner = async () => {
    if (!selectedNewOwner) {
      toast.error('Please select a new owner');
      return;
    }

    setAssignOwnerLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/listing/reassign-owner/${listing._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newOwnerId: selectedNewOwner }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Property owner assigned successfully!');
        setShowAssignOwnerModal(false);
        setSelectedNewOwner("");
        // Refresh the page to show updated owner details
        window.location.reload();
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || 'Failed to assign new owner');
      }
    } catch (error) {
      console.error('Error assigning new owner:', error);
      toast.error('An error occurred while assigning new owner');
    } finally {
      setAssignOwnerLoading(false);
    }
  };

  useEffect(() => {
    const fetchListing = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/listing/get/${params.listingId}`);
        const data = await res.json();
        if (data.success === false) {
          return;
        }
        setListing(data);
      } catch (error) {
        console.error("Error fetching listing:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
  }, [params.listingId]);

  // Fetch owner details after listing is loaded
  useEffect(() => {
    const fetchOwnerDetails = async () => {
      if (listing && listing.userRef) {
        setOwnerLoading(true);
        setOwnerError("");
        try {
          const res = await fetch(`${API_BASE_URL}/api/user/id/${listing.userRef}`);
          if (!res.ok) throw new Error("Failed to fetch owner details");
          const data = await res.json();
          setOwnerDetails(data);
          setOwnerStatus({ isActive: true, owner: data });
        } catch (err) {
          setOwnerError("Could not load owner details");
          setOwnerDetails(null);
          setOwnerStatus({ isActive: false, owner: null });
        } finally {
          setOwnerLoading(false);
        }
      } else {
        setOwnerDetails(null);
        setOwnerStatus({ isActive: false, owner: null });
      }
    };
    fetchOwnerDetails();
  }, [listing]);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen py-10 px-2 md:px-8">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 relative">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="ml-3 text-lg font-semibold text-blue-600">Loading property details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen py-10 px-2 md:px-8">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 relative">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-red-600 mb-4">Property Not Found</h3>
            <p className="text-gray-600 mb-6">The property you're looking for doesn't exist or has been removed.</p>
            <Link 
              to={backButtonInfo.path}
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold"
            >
              {backButtonInfo.text}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen py-10 px-2 md:px-8">
        <div className="max-w-4xl w-full mx-auto bg-white rounded-xl shadow-lg p-3 sm:p-6 relative overflow-x-hidden">
          {/* Header with Back Button and Admin Actions */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(backButtonInfo.path)}
                className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-3 py-2 text-sm sm:px-6 sm:py-3 sm:text-base rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
              >
                <FaArrowLeft /> {backButtonInfo.text}
              </button>
            </div>
            {isAdmin && isAdminContext && (
              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  to={`/admin/update-listing/${listing._id}`}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 py-2 text-sm sm:px-6 sm:py-3 sm:text-base rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
                >
                  <FaEdit /> Edit Property
                </Link>
                <button
                  onClick={handleDelete}
                  className="bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-2 text-sm sm:px-6 sm:py-3 sm:text-base rounded-lg hover:from-red-600 hover:to-red-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
                >
                  <FaTrash /> Delete Property
                </button>
              </div>
            )}
          </div>

          <h3 className="text-3xl font-extrabold text-blue-700 mb-6 text-center drop-shadow">
            Property Details {isAdmin && isAdminContext && "(Admin View)"}
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
                        <div className="bg-white bg-opacity-90 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <FaExpand className="text-gray-700" />
                        </div>
                      </div>
                      {/* Click to expand text */}
                      <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        Click to expand
                      </div>
                      {/* Invisible clickable overlay */}
                      <button
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
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
                  <div className="w-full h-64 md:h-96 bg-gray-200 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <div className="text-6xl mb-4">🏠</div>
                      <p className="text-lg">No images available</p>
                    </div>
                  </div>
                </SwiperSlide>
              )}
            </Swiper>
          </div>

          {/* Share and Report Buttons */}
          <div className="flex justify-end items-center space-x-4 mb-4 pr-2">
            {/* Report Button - Only for logged-in users who are not the owner */}
            {currentUser && !isAdmin && currentUser._id !== listing.userRef && (
              <button
                onClick={() => setShowReportModal(true)}
                className="flex items-center gap-2 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors"
                title="Report this property"
              >
                <FaFlag className="text-sm" />
                <span className="text-sm font-medium">Report</span>
              </button>
            )}
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors"
              title="Share this property"
            >
              <FaShare className="text-sm" />
              <span className="text-sm font-medium">Share</span>
            </button>
          </div>
          {copied && (
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded-lg flex items-center gap-2">
                <FaCheckCircle className="text-sm" />
                <span className="text-sm font-medium">Link copied to clipboard!</span>
              </div>
            </div>
          )}

          {/* Details Card */}
          <div className="p-3 sm:p-6 bg-gray-50 shadow-md rounded-lg mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
              <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-gray-800 break-words flex items-center gap-2">
                {listing.name}
                {/* Wishlist Heart Icon - match ListingItem style */}
                <button
                  onClick={() => {
                    if (!currentUser) {
                      toast.info('Please sign in to add properties to your wishlist.');
                      navigate('/sign-in');
                      return;
                    }
                    if (isInWishlist(listing._id)) {
                      removeFromWishlist(listing._id);
                    } else {
                      addToWishlist(listing);
                      //toast.success('Property added to your wishlist.');
                    }
                  }}
                  className={`ml-2 p-2 rounded-full transition z-20 ${isInWishlist(listing._id) ? 'bg-red-500 text-white' : 'bg-gray-200 text-red-500 hover:text-red-600'} focus:outline-none`}
                  title={isInWishlist(listing._id) ? 'Remove from wishlist' : 'Add to wishlist'}
                  style={{ lineHeight: 0 }}
                >
                  <FaHeart className="text-base sm:text-lg" />
                </button>
              </h2>
              {/* Offer Badge */}
              {listing.offer && getDiscountPercentage() > 0 && (
                <span
                  className="bg-yellow-400 text-gray-900 text-sm font-semibold px-4 py-1 rounded-full shadow-md animate-pulse w-max sm:w-auto ml-0 sm:ml-2 mt-2 sm:mt-0"
                  style={{ alignSelf: 'flex-start' }}
                  title="Limited-time offer!"
                >
                  {getDiscountPercentage()}% OFF
                </span>
              )}
            </div>
            
            {/* Price Display */}
            <div className="mb-4">
              {listing.offer && getDiscountPercentage() > 0 ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <p className="text-lg sm:text-2xl md:text-3xl text-blue-600 font-semibold">
                    {formatINR(listing.discountPrice)}
                    {listing.type === "rent" && " / month"}
                  </p>
                  <p className="text-base sm:text-xl text-gray-500 line-through">
                    {formatINR(listing.regularPrice)}
                  </p>
                  <span className="text-xs sm:text-sm text-green-600 font-semibold">
                    Save {formatINR(listing.regularPrice - listing.discountPrice)}
                  </span>
                </div>
              ) : (
                <p className="text-lg sm:text-2xl md:text-3xl text-blue-600 font-semibold">
                  {formatINR(listing.regularPrice)}
                  {listing.type === "rent" && " / month"}
                </p>
              )}
            </div>

            <p className="flex items-center text-gray-600 mb-4">
              <FaMapMarkerAlt className="mr-2 text-red-500" /> 
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
                !!currentUser
              )}
            </p>

            {listing.locationLink && shouldShowLocationLink(!!currentUser) && (
              <div className="mb-4">
                <a
                  href={listing.locationLink}
                  rel="noopener noreferrer"
                  className="inline-block bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-lg hover:from-red-600 hover:to-red-700 transition-all transform hover:scale-105 shadow-lg font-semibold"
                >
                  {getLocationLinkText(!!currentUser)}
                </a>
              </div>
            )}

            {listing.locationLink && !shouldShowLocationLink(!!currentUser) && (
              <div className="mb-4">
                <button
                  onClick={() => navigate('/sign-in')}
                  className="inline-block bg-gradient-to-r from-gray-500 to-gray-600 text-white px-6 py-3 rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all transform hover:scale-105 shadow-lg font-semibold"
                >
                  {getLocationLinkText(!!currentUser)}
                </button>
              </div>
            )}

            <div className="flex space-x-4 mb-4">
              <span className={`px-3 py-1 text-white rounded-md ${listing.type === "rent" ? "bg-blue-500" : "bg-green-500"}`}>
                {listing.type === "rent" ? "For Rent" : "For Sale"}
              </span>
            </div>

            <p className="text-gray-700 mb-4 leading-relaxed">
              <span className="font-semibold">Description:</span> {listing.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="flex items-center p-3 bg-white rounded-lg shadow-sm">
                <FaBed className="mr-2 text-blue-500" /> {listing.bedrooms} {listing.bedrooms > 1 ? "beds" : "bed"}
              </div>
              <div className="flex items-center p-3 bg-white rounded-lg shadow-sm">
                <FaBath className="mr-2 text-blue-500" /> {listing.bathrooms} {listing.bathrooms > 1 ? "baths" : "bath"}
              </div>
              <div className="flex items-center p-3 bg-white rounded-lg shadow-sm">
                <FaParking className="mr-2 text-blue-500" /> {listing.parking ? "Parking" : "No Parking"}
              </div>
              <div className="flex items-center p-3 bg-white rounded-lg shadow-sm">
                <FaChair className="mr-2 text-blue-500" /> {listing.furnished ? "Furnished" : "Unfurnished"}
              </div>
            </div>
          </div>

          {/* Admin Information - Only show for admins */}
          {isAdmin && isAdminContext && (
            <>
              <div className="p-6 bg-blue-50 shadow-md rounded-lg mb-6">
                <h4 className="text-xl font-bold text-blue-800 mb-4">Admin Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Property ID</p>
                    <p className="font-semibold text-gray-800">{listing._id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Created Date</p>
                    <p className="font-semibold text-gray-800">
                      {new Date(listing.createdAt).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Last Updated</p>
                    <p className="font-semibold text-gray-800">
                      {new Date(listing.updatedAt).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Created By</p>
                    <p className="font-semibold text-gray-800">{listing.userRef || 'Unknown'}</p>
                  </div>
                </div>
              </div>
              {/* Property Owner Details Section */}
              <div className="p-6 bg-green-50 shadow-md rounded-lg mb-6">
                <h4 className="text-xl font-bold text-green-800 mb-4">Property Owner Details</h4>
                {ownerLoading ? (
                  <p className="text-gray-500">Loading owner details...</p>
                ) : ownerDetails && ownerStatus.isActive ? (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Owner Name</p>
                        <p className="font-semibold text-gray-800">{ownerDetails.username}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Owner Email</p>
                        <p className="font-semibold text-gray-800">{ownerDetails.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Mobile Number</p>
                        <p className="font-semibold text-gray-800">{ownerDetails.mobileNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Owner ID</p>
                        <p className="font-semibold text-gray-800">{ownerDetails._id}</p>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-blue-700 text-sm font-medium">
                          ℹ️ Owner account is active and accessible. No reassignment needed.
                        </p>
                      </div>
                    )}
                  </div>
                ) : ownerError ? (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                    <p className="text-red-500">{ownerError}</p>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          fetchAvailableUsers();
                          setShowAssignOwnerModal(true);
                        }}
                        className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
                      >
                        <FaEdit /> Assign New Owner
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">No owner details found.</p>
                )}
              </div>
            </>
          )}

          {/* Additional Details - Only show for owner of this property (non-admin context) */}
          {currentUser && (listing.sellerId === currentUser._id || listing.userRef === currentUser._id) && !(isAdmin && isAdminContext) && (
            <div className="p-6 bg-gray-50 shadow-md rounded-lg mb-6">
              <h4 className="text-xl font-bold text-gray-800 mb-4">Additional Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Created Date</p>
                  <p className="font-semibold text-gray-800">
                    {new Date(listing.createdAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Last Updated</p>
                  <p className="font-semibold text-gray-800">
                    {new Date(listing.updatedAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Book Appointment Button */}
          <div className="flex justify-center">
            {currentUser && (listing.sellerId === currentUser._id || listing.userRef === currentUser._id) ? (
              <div className="text-red-500 font-semibold text-lg py-3">You cannot book an appointment for your own property.</div>
            ) : (
              <button
                onClick={() => {
                  if (!currentUser) {
                    toast.info('Please sign in to book appointments.');
                    navigate('/sign-in');
                    return;
                  }
                  const appointmentUrl = isAdminContext 
                    ? `/admin/appointmentlisting?listingId=${listing._id}&propertyName=${encodeURIComponent(listing.name)}&propertyDescription=${encodeURIComponent(listing.description)}&listingType=${listing.type}`
                    : `/user/appointment?listingId=${listing._id}&propertyName=${encodeURIComponent(listing.name)}&propertyDescription=${encodeURIComponent(listing.description)}&listingType=${listing.type}`;
                  navigate(appointmentUrl);
                }}
                className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-8 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
              >
                📅 Book Appointment
              </button>
            )}
          </div>

          {/* Reviews Section Toggle Button */}
          <div className="flex justify-center mt-8">
            <button
              onClick={() => setShowReviews((prev) => !prev)}
              className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-6 py-2 rounded-lg shadow font-semibold flex items-center gap-2 hover:from-yellow-500 hover:to-yellow-700 transition-all"
            >
              {showReviews ? 'Hide Reviews' : 'Show Reviews'}
              {listing.reviewCount > 0 && (
                <span className="ml-2 bg-white text-yellow-700 rounded-full px-2 py-0.5 text-xs font-bold">
                  {listing.reviewCount}
                </span>
              )}
            </button>
          </div>
          {/* Reviews Section (collapsible) */}
          {showReviews && (
            <div className="mt-8">
              <div className="border-t border-gray-200 pt-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-800 flex items-center">
                    <FaStar className="text-yellow-500 mr-2" />
                    Reviews
                    {listing.averageRating > 0 && (
                      <span className="ml-2 text-lg text-gray-600">
                        ({listing.averageRating.toFixed(1)} ⭐ • {listing.reviewCount} review{listing.reviewCount !== 1 ? 's' : ''})
                      </span>
                    )}
                  </h3>
                </div>
                {/* Review Form */}
                <ReviewForm 
                  listingId={listing._id} 
                  onReviewSubmitted={() => {
                    // Refresh the listing data to update rating
                    window.location.reload();
                  }}
                />
                {/* Review List */}
                <ReviewList 
                  listingId={listing._id}
                  onReviewDeleted={() => {
                    // Refresh the listing data to update rating
                    window.location.reload();
                  }}
                  listingOwnerId={listing.userRef}
                />
              </div>
            </div>
          )}
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
      
      {/* Image Preview Modal */}
      {listing && listing.imageUrls && listing.imageUrls.length > 0 && (
        <ImagePreview
          isOpen={showImagePreview}
          onClose={() => setShowImagePreview(false)}
          images={listing.imageUrls}
          initialIndex={selectedImageIndex}
        />
      )}

      {/* Report Property Modal */}
      {showReportModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md flex flex-col gap-4">
            <h3 className="text-lg font-bold text-red-700 flex items-center gap-2">
              <FaFlag /> Report Property
            </h3>
            <p className="text-sm text-gray-600">Help us maintain quality by reporting any issues with this property.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Report Category *</label>
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
                >
                  <option value="">Select a category</option>
                  <option value="fake">Fake / misleading listing</option>
                  <option value="wrong_info">Wrong information</option>
                  <option value="inappropriate">Inappropriate images/content</option>
                  <option value="scam">Scam / suspicious activity</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              {(reportCategory === 'other' || reportCategory) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {reportCategory === 'other' ? 'Additional Details *' : 'Additional Details (Optional)'}
                  </label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
                    rows={4}
                    placeholder={reportCategory === 'other' ? 'Please provide details about the issue...' : 'Provide additional context (optional)...'}
                  />
                </div>
              )}
            </div>
            
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportCategory('');
                  setReportDetails('');
                }}
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleReportProperty}
                disabled={reportLoading || !reportCategory || (reportCategory === 'other' && !reportDetails.trim())}
                className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {reportLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Reporting...
                  </>
                ) : (
                  <>
                    <FaFlag className="text-sm" />
                    Submit Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign New Owner Modal */}
      {showAssignOwnerModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md flex flex-col gap-4">
            <h3 className="text-lg font-bold text-blue-700 flex items-center gap-2"><FaEdit /> Assign New Owner</h3>
            <p className="text-sm text-gray-600">Select a user to assign as the new owner of this property.</p>
            <select
              className="border rounded p-2 w-full"
              value={selectedNewOwner}
              onChange={(e) => setSelectedNewOwner(e.target.value)}
              disabled={assignOwnerLoading}
            >
              <option value="">Select a user</option>
              {availableUsers.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.username} ({user.email})
                </option>
              ))}
            </select>
            {assignOwnerLoading && <p className="text-gray-500">Assigning new owner...</p>}
            {selectedNewOwner && !assignOwnerLoading && (
              <button
                onClick={handleAssignNewOwner}
                className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
              >
                <FaCheckCircle /> Confirm Assignment
              </button>
            )}
            <button
              onClick={() => setShowAssignOwnerModal(false)}
              className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
