import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { Navigation } from "swiper/modules";
import { FaBath, FaBed, FaChair, FaMapMarkerAlt, FaParking, FaShare, FaEdit, FaTrash, FaArrowLeft } from "react-icons/fa";
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import { maskAddress, shouldShowLocationLink, getLocationLinkText } from "../utils/addressMasking";

export default function Listing() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useSelector((state) => state.user);
  const [listing, setListing] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if user is admin
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'rootadmin';
  
  // Check if we're in admin context
  const isAdminContext = location.pathname.includes('/admin');

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

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this property?')) return;
    
    try {
      const res = await fetch(`/api/listing/delete/${listing._id}`, { 
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (res.ok) {
        alert('Property deleted successfully!');
        navigate('/admin/my-listings');
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to delete property.');
      }
    } catch (error) {
      console.error('Error deleting property:', error);
      alert('An error occurred while deleting the property.');
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
              to={isAdminContext ? "/admin/my-listings" : "/user/my-listings"}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              {isAdminContext ? "Back to My Listings" : "Back to My Listings"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen py-10 px-2 md:px-8">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 relative">
          {/* Header with Back Button and Admin Actions */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(isAdminContext ? '/admin/my-listings' : '/user/my-listings')}
                className="flex items-center gap-2 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                <FaArrowLeft /> {isAdminContext ? "Back to My Listings" : "Back to My Listings"}
              </button>
            </div>
            {isAdmin && isAdminContext && (
              <div className="flex items-center gap-3">
                <Link
                  to={`/admin/update-listing/${listing._id}`}
                  className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <FaEdit /> Edit Property
                </Link>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
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
          <Swiper navigation modules={[Navigation]} className="rounded-lg overflow-hidden relative mb-6">
            {listing.imageUrls && listing.imageUrls.length > 0 ? (
              listing.imageUrls.map((url, index) => (
                <SwiperSlide key={index}>
                  <img
                    src={url}
                    alt={`${listing.name} - Image ${index + 1}`}
                    className="w-full h-64 md:h-96 object-cover"
                    onError={(e) => {
                      e.target.src = "https://via.placeholder.com/800x600?text=Image+Not+Available";
                      e.target.className = "w-full h-64 md:h-96 object-cover opacity-50";
                    }}
                  />
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
          <div className="p-6 bg-gray-50 shadow-md rounded-lg mb-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-3xl font-bold text-gray-800">{listing.name}</h2>
              {/* Offer Badge */}
              {listing.offer && getDiscountPercentage() > 0 && (
                <span 
                  className="bg-yellow-400 text-gray-900 text-sm font-semibold px-3 py-1 rounded-full shadow-md animate-pulse"
                  title="Limited-time offer!"
                >
                  {getDiscountPercentage()}% OFF
                </span>
              )}
            </div>
            
            {/* Price Display */}
            <div className="mb-4">
              {listing.offer && getDiscountPercentage() > 0 ? (
                <div className="flex items-center gap-3">
                  <p className="text-3xl text-blue-600 font-semibold">
                    {formatINR(listing.discountPrice)}
                    {listing.type === "rent" && " / month"}
                  </p>
                  <p className="text-xl text-gray-500 line-through">
                    {formatINR(listing.regularPrice)}
                  </p>
                  <span className="text-sm text-green-600 font-semibold">
                    Save {formatINR(listing.regularPrice - listing.discountPrice)}
                  </span>
                </div>
              ) : (
                <p className="text-3xl text-blue-600 font-semibold">
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
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
                >
                  {getLocationLinkText(!!currentUser)}
                </a>
              </div>
            )}

            {listing.locationLink && !shouldShowLocationLink(!!currentUser) && (
              <div className="mb-4">
                <button
                  onClick={() => navigate('/sign-in')}
                  className="inline-block bg-gray-400 text-white px-4 py-2 rounded cursor-pointer"
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          )}

          {/* Book Appointment Button */}
          <div className="flex justify-center">
            {currentUser && (listing.sellerId === currentUser._id || listing.userRef === currentUser._id) ? (
              <div className="text-red-500 font-semibold text-lg py-3">You cannot book an appointment for your own property.</div>
            ) : (
              <button
                onClick={() => {
                  if (!currentUser) {
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
        </div>
      </div>
      <ContactSupportWrapper />
    </>
  );
}
