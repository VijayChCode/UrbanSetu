import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MdLocationOn } from 'react-icons/md'
import { useWishlist } from '../WishlistContext'
import { FaTrash } from 'react-icons/fa'
import { useSelector } from 'react-redux'
import { maskAddress } from '../utils/addressMasking'

export default function WishListItem ({ listing }) {
  const { removeFromWishlist } = useWishlist();
  const location = useLocation();
  const { currentUser } = useSelector((state) => state.user);

  // Check if we're in admin context
  const isAdminContext = location.pathname.includes('/admin');

  // Determine the correct link based on context
  let listingLink = `/listing/${listing._id}`;
  if (isAdminContext) {
    listingLink = `/admin/listing/${listing._id}`;
  } else if (location.pathname.startsWith('/user')) {
    listingLink = `/user/listing/${listing._id}`;
  }

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden p-4"> 
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
          <p className="text-gray-700 font-semibold text-lg truncate">{listing.name}</p>
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
          <p className="text-lg font-bold text-blue-500 mt-2">
            Rs:{listing.offer ? listing.discountPrice.toLocaleString('en-US') : listing.regularPrice.toLocaleString('en-US')}
            {listing.type === 'rent' && '/month'}
          </p>
          <div className="flex space-x-4 text-gray-600 text-sm mt-2">
            <p>{listing.bedrooms > 1 ? `${listing.bedrooms} beds` : `${listing.bedrooms} bed`}</p>
            <p>{listing.bathrooms > 1 ? `${listing.bathrooms} bathrooms` : `${listing.bathrooms} bathroom`}</p>
          </div>
        </div>
       
      </Link>
      <button 
        onClick={() => removeFromWishlist(listing._id)}
        className="p-2 rounded-full bg-red-500 hover:bg-red-600 transition"
      >
        <FaTrash className="text-white text-md" />
      </button>
    </div>
  )
}