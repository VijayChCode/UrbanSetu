import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { FaEdit, FaTrash, FaEye, FaPlus } from "react-icons/fa";
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import { maskAddress } from '../utils/addressMasking';

export default function AdminMyListings() {
  const { currentUser } = useSelector((state) => state.user);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        
        const res = await fetch('/api/listing/user', {
          credentials: 'include'
        });
        
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

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this listing?")) return;
    
    try {
      const res = await fetch(`/api/listing/delete/${id}`, {
        method: "DELETE",
        credentials: 'include'
      });
      
      if (res.ok) {
        setListings((prev) => prev.filter((listing) => listing._id !== id));
        alert("Listing deleted successfully!");
      } else {
        const data = await res.json();
        alert(data.message || "Failed to delete listing.");
      }
    } catch (err) {
      alert("An error occurred. Please try again.");
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 py-10 px-2 md:px-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-center mt-8 text-lg font-semibold text-blue-600 animate-pulse">Loading your listings...</p>
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
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <h3 className="text-3xl font-extrabold text-blue-700 drop-shadow">My Listings (Admin)</h3>
              <Link
                to="/admin/create-listing"
                className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 mt-4 md:mt-0"
              >
                <FaPlus /> Create New Listing
              </Link>
            </div>

            {listings.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">🏠</div>
                <h4 className="text-xl font-semibold text-gray-600 mb-2">No listings yet</h4>
                <p className="text-gray-500 mb-6">Start by creating your first property listing</p>
                <Link
                  to="/admin/create-listing"
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold inline-flex items-center gap-2"
                >
                  <FaPlus /> Create Your First Listing
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map((listing) => (
                  <div key={listing._id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                    {/* Image */}
                    <div className="relative h-48 bg-gray-200">
                      {listing.imageUrls && listing.imageUrls.length > 0 ? (
                        <img
                          src={listing.imageUrls[0]}
                          alt={listing.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = "https://via.placeholder.com/400x300?text=No+Image";
                            e.target.className = "w-full h-full object-cover opacity-50";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center text-gray-500">
                            <div className="text-4xl mb-2">🏠</div>
                            <p className="text-sm">No Image</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Type Badge */}
                      <div className="absolute top-2 left-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${
                          listing.type === 'rent' ? 'bg-blue-500' : 'bg-green-500'
                        }`}>
                          {listing.type === 'rent' ? 'For Rent' : 'For Sale'}
                        </span>
                      </div>
                      
                      {/* Offer Badge */}
                      {listing.offer && (
                        <div className="absolute top-2 right-2">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-500 text-white">
                            {getDiscountPercentage(listing)}% OFF
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h4 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-1">{listing.name}</h4>
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">
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
                        <span className="text-xl font-bold text-blue-600">
                          {formatPrice(listing.regularPrice)}
                        </span>
                        {listing.type === 'rent' && <span className="text-gray-500 text-sm">/month</span>}
                        {listing.offer && (
                          <div className="text-sm text-gray-500 line-through">
                            {formatPrice(listing.regularPrice)}
                          </div>
                        )}
                      </div>

                      {/* Property Details */}
                      <div className="flex justify-between text-sm text-gray-600 mb-4">
                        <span>{listing.bedrooms} bed</span>
                        <span>{listing.bathrooms} bath</span>
                        <span>{listing.furnished ? 'Furnished' : 'Unfurnished'}</span>
                        <span>{listing.parking ? 'Parking' : 'No Parking'}</span>
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
    </>
  );
} 