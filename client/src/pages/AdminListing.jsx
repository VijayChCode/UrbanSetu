import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { Navigation } from "swiper/modules";
import { FaBath, FaBed, FaChair, FaMapMarkerAlt, FaParking, FaShare, FaEdit, FaTrash, FaArrowLeft, FaHeart, FaExpand } from "react-icons/fa";
import { maskAddress, shouldShowLocationLink, getLocationLinkText } from "../utils/addressMasking";
import { toast } from 'react-toastify';
import { useWishlist } from '../WishlistContext';
import { useSelector } from 'react-redux';
import ImagePreview from "../components/ImagePreview.jsx";

export default function AdminListing() {
  const params = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const formatINR = (amount) => {
    return `₹${Number(amount).toLocaleString("en-IN")}`;
  };

  const handleImageClick = (index) => {
    console.log('Image clicked:', index);
    setSelectedImageIndex(index);
    setShowImagePreview(true);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this property?')) return;
    
    try {
      const res = await fetch(`/api/listing/delete/${listing._id}`, { 
        method: 'DELETE',
        credentials: 'include'
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

  useEffect(() => {
    const fetchListing = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/listing/get/${params.listingId}`);
        const data = await res.json();
        if (data.success === false) {
          console.log(data.message);
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

  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { currentUser } = useSelector((state) => state.user);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen py-10 px-2 md:px-8">
      <div className="max-w-4xl w-full mx-auto bg-white rounded-xl shadow-lg p-3 sm:p-6 relative overflow-x-hidden">
        {/* Header with Back Button and Admin Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-2 sm:gap-3 w-full">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full">
            <Link 
              to="/admin"
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 w-full sm:w-auto text-center"
            >
              Back to Dashboard
            </Link>
            <Link
              to={`/admin/update-listing/${listing._id}`}
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 w-full sm:w-auto text-center justify-center"
            >
              <FaEdit /> Edit Property
            </Link>
            <button
              onClick={handleDelete}
              className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-3 rounded-lg hover:from-red-600 hover:to-pink-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 w-full sm:w-auto text-center justify-center"
            >
              <FaTrash /> Delete Property
            </button>
          </div>
        </div>

        <h3 className="text-3xl font-extrabold text-blue-700 mb-6 text-center drop-shadow">
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

        {/* Share Button */}
        <div className="flex justify-end items-center space-x-4 mb-4 pr-2">
          <FaShare
            className="cursor-pointer text-gray-500 hover:text-gray-700 text-xl"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          />
        </div>
        {copied && <p className="text-green-500 text-sm text-center mb-4">Link copied!</p>}

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
                    toast.success('Property removed from your wishlist.');
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
              true
            )}
          </p>

          {listing.locationLink && shouldShowLocationLink(true) && (
            <div className="mb-4">
              <a
                href={listing.locationLink}
                rel="noopener noreferrer"
                className="inline-block bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
              >
                {getLocationLinkText(true)}
              </a>
            </div>
          )}

          <div className="flex space-x-4 mb-4">
            <span className={`px-3 py-1 text-white rounded-md ${listing.type === "rent" ? "bg-blue-500" : "bg-green-500"}`}>
              {listing.type === "rent" ? "For Rent" : "For Sale"}
            </span>
            {listing.offer && (
              <span className="px-3 py-1 bg-yellow-400 text-white rounded-md">
                {formatINR(listing.discountPrice)} OFF
              </span>
            )}
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

        {/* Admin Information */}
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
                {new Date(listing.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Last Updated</p>
              <p className="font-semibold text-gray-800">
                {new Date(listing.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Created By</p>
              <p className="font-semibold text-gray-800">{listing.userRef || 'Unknown'}</p>
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
        />
      )}
    </div>
  );
} 