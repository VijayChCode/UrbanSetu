import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { MdLocationOn } from 'react-icons/md';
import { useWishlist } from '../WishlistContext';
import { FaHeart, FaTrash, FaCheckCircle, FaLock } from 'react-icons/fa';
import { useSelector } from 'react-redux';
import { maskAddress } from '../utils/addressMasking';
import PrimaryButton from "./ui/PrimaryButton";
import { MapPin, Bath, BedDouble, Tag } from "lucide-react";

export default function ListingItem({ listing, onDelete, onWishToggle }) {
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const [isInWishlistState, setIsInWishlistState] = useState(false);
  const [showAppointmentTooltip, setShowAppointmentTooltip] = useState(false);
  const [showRentTooltip, setShowRentTooltip] = useState(false);
  const [showWishlistTooltip, setShowWishlistTooltip] = useState(false);
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
      setShowWishlistTooltip(true);
      setTimeout(() => setShowWishlistTooltip(false), 3000);
      return;
    }

    if (isInWishlistState) {
      await removeFromWishlist(listing._id);
      setIsInWishlistState(false);
      if (typeof onWishToggle === 'function') onWishToggle(listing._id, false);
    } else {
      await addToWishlist(listing);
      setIsInWishlistState(true);
      if (typeof onWishToggle === 'function') onWishToggle(listing._id, true);
    }
  };

  const onHandleAppointment = () => {
    if (!currentUser) {
      setShowAppointmentTooltip(true);
      setTimeout(() => setShowAppointmentTooltip(false), 3000);
      return;
    }

    const appointmentUrl = isAdminContext
      ? `/admin/appointmentlisting?listingId=${listing._id}&listingType=${listing.type}&propertyName=${encodeURIComponent(listing.name)}&propertyDescription=${encodeURIComponent(listing.description)}`
      : `/user/appointment?listingId=${listing._id}&listingType=${listing.type}&propertyName=${encodeURIComponent(listing.name)}&propertyDescription=${encodeURIComponent(listing.description)}`;
    navigate(appointmentUrl);
  };

  const onHandleRent = () => {
    if (!currentUser) {
      setShowRentTooltip(true);
      setTimeout(() => setShowRentTooltip(false), 3000);
      return;
    }
    navigate(`/user/rent-property?listingId=${listing._id}`);
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
    <div className="group relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-2xl transition-transform duration-200 hover:-translate-y-0.5">
      {/* Offer Badge */}
      {listing.offer && getDiscountPercentage() > 0 && (
        <div className="absolute top-2 sm:top-3 left-2 sm:left-3 z-20">
          <span className="inline-flex items-center gap-1 bg-yellow-400 text-gray-900 text-[10px] sm:text-xs font-semibold px-2 py-1 rounded-full shadow-md">
            <Tag className="w-3 h-3" /> {getDiscountPercentage()}% OFF
          </span>
        </div>
      )}

      {/* Top-right action: admin shows Delete (if available), users show Wishlist */}
      {isAdminContext ? (
        onDelete ? (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(listing._id); }}
            className="absolute top-2 sm:top-4 right-2 sm:right-4 p-2 rounded-full transition z-20 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-500 hover:text-white dark:hover:text-white"
            title="Delete property"
          >
            <FaTrash className="text-base sm:text-lg" />
          </button>
        ) : null
      ) : (
        <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-20">
          <div className="relative">
            <button
              onClick={handleWishList}
              className={`p-2 rounded-full transition ${isInWishlistState ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-red-500 dark:text-red-400'
                }`}
              title={isInWishlistState ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <FaHeart className="text-base sm:text-lg" />
            </button>
            {showWishlistTooltip && (
              <div className="absolute top-full right-0 mt-2 bg-red-600 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg">
                Please login to save properties
                <div className="absolute -top-1 right-4 w-2 h-2 bg-red-600 transform rotate-45"></div>
              </div>
            )}
          </div>
        </div>
      )}


      <Link to={listingLink}>
        <div className="relative">
          {listing.imageUrls && listing.imageUrls.length > 0 ? (
            <div className="aspect-[16/10] w-full overflow-hidden relative">
              <img
                src={listing.imageUrls[0]}
                alt={listing.name || "Real Estate Property"}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60";
                }}
              />
              {/* AI Match Overlay */}
              {listing.similarityScore && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-grow bg-white/30 rounded-full overflow-hidden backdrop-blur-sm">
                      <div
                        className="h-full bg-gradient-to-r from-purple-400 to-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]"
                        style={{ width: `${listing.similarityScore * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-white font-mono text-shadow-sm">
                      {(listing.similarityScore * 100).toFixed(0)}% Match
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-[16/10] w-full overflow-hidden relative">
              <img
                src="https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60"
                alt="Property Placeholder"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
        <div className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <p className="text-gray-700 dark:text-gray-200 font-semibold text-base sm:text-lg truncate">
                {listing.name}
              </p>
              {listing.isVerified && (
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded-full text-[10px] font-semibold flex items-center gap-1 whitespace-nowrap">
                  <FaCheckCircle className="text-[10px]" /> Verified
                </span>
              )}
            </div>
            {/* Remove Button - only show in watchlist context (hide for admins to avoid duplicate) */}
            {onDelete && !isAdminContext && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(listing._id);
                }}
                className="ml-2 p-1 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center gap-1 text-xs"
                title="Remove from watchlist"
              >
                <FaTrash className="text-xs" />
                <span className="hidden sm:inline">Remove</span>
              </button>
            )}
          </div>
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-1">
            <MapPin className="w-4 h-4 text-red-500" />
            <p className="truncate">
              {maskAddress(
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
          <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mt-2 truncate">{listing.description}</p>
          <div className="mt-2">
            {listing.offer && getDiscountPercentage() > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-base sm:text-lg font-bold text-blue-500 dark:text-blue-400">
                    {formatINR(listing.discountPrice)}
                    {listing.type === 'rent' && ' / month'}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500 line-through">
                    {formatINR(listing.regularPrice)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs sm:text-sm text-green-600 dark:text-green-400 font-semibold bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full">
                    Save ₹{(listing.regularPrice - listing.discountPrice).toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs sm:text-sm text-green-600 dark:text-green-400 font-semibold">
                    ({getDiscountPercentage()}% off)
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-base sm:text-lg font-bold text-blue-500 dark:text-blue-400">
                {formatINR(listing.regularPrice)}
                {listing.type === 'rent' && ' / month'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300 text-xs sm:text-sm mt-2">
            <span className="inline-flex items-center gap-1"><BedDouble className="w-4 h-4" /> {listing.bedrooms} {listing.bedrooms > 1 ? 'beds' : 'bed'}</span>
            <span className="inline-flex items-center gap-1"><Bath className="w-4 h-4" /> {listing.bathrooms} {listing.bathrooms > 1 ? 'baths' : 'bath'}</span>
          </div>

          {/* Property Features - Special Offer + Type badge */}
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {listing.offer && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-medium">
                Special Offer
              </span>
            )}
            {listing.type && (
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${listing.type === 'rent' ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300' : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                  }`}
              >
                {listing.type === 'rent' ? 'Rent' : 'Sale'}
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="mt-2 sm:mt-4">
        {currentUser && currentUser._id === listing.userRef ? (
          <div className="w-full text-red-500 dark:text-red-400 font-semibold text-center py-2 sm:py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            You cannot book/rent your own property.
          </div>
        ) : (
          <div className="relative flex justify-center">
            {listing.type === 'rent' ? (
              <>
                <PrimaryButton variant="green" type="button" onClick={onHandleRent} className="!py-2 sm:!py-3 flex items-center justify-center gap-2">
                  <FaLock className="w-4 h-4" /> Rent This Property
                </PrimaryButton>
                {showRentTooltip && (
                  <div className="absolute bottom-full mb-2 bg-red-600 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg">
                    Please login to rent this property
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-red-600 transform rotate-45"></div>
                  </div>
                )}
              </>
            ) : (
              <>
                <PrimaryButton variant="blue" type="button" onClick={onHandleAppointment} className="!py-2 sm:!py-3 flex items-center justify-center gap-2">
                  📅 Book Appointment
                </PrimaryButton>
                {showAppointmentTooltip && (
                  <div className="absolute bottom-full mb-2 bg-red-600 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg">
                    Please login to book appointment
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-red-600 transform rotate-45"></div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
