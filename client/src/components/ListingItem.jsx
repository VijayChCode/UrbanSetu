import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { MdLocationOn } from 'react-icons/md';
import { useWishlist } from '../WishlistContext';
import { FaHeart, FaTrash } from 'react-icons/fa';
import { useSelector } from 'react-redux';
import { maskAddress } from '../utils/addressMasking';

export default function ListingItem({ listing, onDelete }) {
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const [isInWishlistState, setIsInWishlistState] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useSelector((state) => state.user);

  // Check if we're in admin context
  const isAdminContext = location.pathname.includes('/admin');

  // Check if item is in wishlist when component mounts or wishlist changes
  useEffect(() => {
    setIsInWishlistState(isInWishlist(listing._id));
  }, [isInWishlist, listing._id]);

  const handleWishList = async () => {
    if (!currentUser) {
      navigate('/sign-in');
      return;
    }
    
    if (isInWishlistState) {
      await removeFromWishlist(listing._id);
      setIsInWishlistState(false);
    } else {
      await addToWishlist(listing);
      setIsInWishlistState(true);
    }
  };

  const onHandleAppointment = () => {
    if (!currentUser) {
      navigate('/sign-in');
      return;
    }
    
    const appointmentUrl = isAdminContext 
      ? `/admin/appointmentlisting?listingId=${listing._id}&propertyName=${encodeURIComponent(listing.name)}&propertyDescription=${encodeURIComponent(listing.description)}`
      : `/user/appointment?listingId=${listing._id}&propertyName=${encodeURIComponent(listing.name)}&propertyDescription=${encodeURIComponent(listing.description)}`;
    navigate(appointmentUrl);
  };

  const formatINR = (amount) => {
    return `₹${Number(amount).toLocaleString('en-IN')}`;
  };

  // Calculate discount percentage
  const getDiscountPercentage = () => {
    if (listing.offer && listing.regularPrice && listing.discountPrice) {
      return Math.round(((listing.regularPrice - listing.discountPrice) / listing.regularPrice) * 100);
    }
    return 0;
  };

  // Determine the correct link based on context
  let listingLink = `/listing/${listing._id}`;
  if (isAdminContext) {
    listingLink = `/admin/listing/${listing._id}`;
  } else if (location.pathname.startsWith('/user')) {
    listingLink = `/user/listing/${listing._id}`;
  }

  return (
    <div className="relative bg-white shadow-md rounded-lg overflow-hidden p-4">
      {/* Offer Badge */}
      {listing.offer && getDiscountPercentage() > 0 && (
        <div className="absolute top-4 left-4 z-20">
          <span 
            className="bg-yellow-400 text-gray-900 text-xs font-semibold px-2 py-1 rounded-full shadow-md animate-pulse"
            title="Limited-time offer!"
          >
            {getDiscountPercentage()}% OFF
          </span>
        </div>
      )}

      {/* Wishlist Icon */}
      <button
        onClick={handleWishList}
        className={`absolute top-4 right-4 p-2 rounded-full transition z-20 ${
          isInWishlistState ? 'bg-red-500 text-white' : 'bg-gray-200 text-red-500'
        }`}
        title={isInWishlistState ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <FaHeart className="text-lg" />
      </button>

      {/* Admin Delete Button */}
      {onDelete && (
        <button
          onClick={() => onDelete(listing._id)}
          className="absolute top-4 left-4 p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-500 hover:text-white transition shadow-md z-10"
          title="Delete Listing"
          style={{ left: listing.offer && getDiscountPercentage() > 0 ? '4.5rem' : '1rem' }}
        >
          <FaTrash className="text-lg" />
        </button>
      )}

      <Link to={listingLink}>
        {listing.imageUrls && listing.imageUrls.length > 0 ? (
          <img
            src={listing.imageUrls[0]}
            alt="home"
            className="w-full h-48 object-cover rounded-md"
            onError={(e) => {
              e.target.src = "https://via.placeholder.com/400x300?text=No+Image";
              e.target.className = "w-full h-48 object-cover rounded-md opacity-50";
            }}
          />
        ) : (
          <div className="w-full h-48 bg-gray-200 rounded-md flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-2">🏠</div>
              <p className="text-sm">No Image</p>
            </div>
          </div>
        )}
        <div className="p-3">
          <p className="text-gray-700 font-semibold text-lg truncate">
            {listing.name}
          </p>
          <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
            <MdLocationOn className="text-red-500" />
            <p className="truncate">
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
          </div>
          <p className="text-gray-600 text-sm mt-2 truncate">{listing.description}</p>
          <div className="mt-2">
            {listing.offer && getDiscountPercentage() > 0 ? (
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-blue-500">
                  {formatINR(listing.discountPrice)}
                  {listing.type === 'rent' && ' / month'}
                </p>
                <p className="text-sm text-gray-500 line-through">
                  {formatINR(listing.regularPrice)}
                </p>
              </div>
            ) : (
              <p className="text-lg font-bold text-blue-500">
                {formatINR(listing.regularPrice)}
                {listing.type === 'rent' && ' / month'}
              </p>
            )}
          </div>
          <div className="flex space-x-4 text-gray-600 text-sm mt-2">
            <p>{listing.bedrooms > 1 ? `${listing.bedrooms} beds` : `${listing.bedrooms} bed`}</p>
            <p>{listing.bathrooms > 1 ? `${listing.bathrooms} bathrooms` : `${listing.bathrooms} bathroom`}</p>
          </div>
        </div>
      </Link>

      <div className="mt-4">
        <button
          onClick={onHandleAppointment}
          className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Book Appointment
        </button>
      </div>
    </div>
  );
}
