import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaStar, FaUser, FaHome, FaSearch, FaCheckCircle, FaClock, FaFileAlt, FaTimes } from 'react-icons/fa';
import { usePageTitle } from '../hooks/usePageTitle';
import RatingDisplay from '../components/ratings/RatingDisplay';
import AdminRentalRatingsSkeleton from '../components/skeletons/AdminRentalRatingsSkeleton';
import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminRentalRatings() {
  usePageTitle("Admin Rental Ratings - UrbanSetu");

  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();

  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRating, setSelectedRating] = useState(null);
  const [showRatingDisplay, setShowRatingDisplay] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate('/sign-in');
      return;
    }

    if (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin') {
      navigate('/user');
      return;
    }

    // Only fetch on initial load or user change, not on filter changes
    if (ratings.length === 0) {
      fetchAllRatings();
    }
  }, [currentUser, navigate]);

  const fetchAllRatings = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      // Always fetch all ratings, apply filters client-side
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/ratings/all`);

      const data = await res.json();
      if (res.ok && data.success) {
        setRatings(data.ratings || []);
      } else {
        toast.error(data.message || 'Failed to fetch ratings');
      }
    } catch (error) {
      console.error('Error fetching ratings:', error);
      toast.error('Failed to load ratings');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const handleViewRating = (rating) => {
    setSelectedRating(rating);
    setShowRatingDisplay(true);
  };

  const handleRatingUpdated = () => {
    fetchAllRatings();
    if (selectedRating) {
      const updated = ratings.find(r => r._id === selectedRating._id);
      if (updated) {
        setSelectedRating(updated);
      }
    }
  };

  const filteredRatings = ratings.filter(rating => {
    if (roleFilter !== 'all') {
      if (roleFilter === 'tenant' && !rating.tenantToLandlordRating?.overallRating) {
        return false;
      }
      if (roleFilter === 'landlord' && !rating.landlordToTenantRating?.overallRating) {
        return false;
      }
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        rating.contractId?.contractId?.toLowerCase().includes(query) ||
        rating.contractId?.listingId?.name?.toLowerCase().includes(query) ||
        rating.contractId?.listingId?.address?.toLowerCase().includes(query) ||
        rating.tenantId?.username?.toLowerCase().includes(query) ||
        rating.tenantId?.email?.toLowerCase().includes(query) ||
        rating.landlordId?.username?.toLowerCase().includes(query) ||
        rating.landlordId?.email?.toLowerCase().includes(query) ||
        rating.ratingId?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const renderStarRating = (rating) => {
    if (!rating || rating === 0) return <span className="text-gray-400">No rating</span>;
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <FaStar
            key={i}
            className={i < fullStars ? 'text-yellow-400 fill-current' : i === fullStars && hasHalfStar ? 'text-yellow-400 fill-current opacity-50' : 'text-gray-300'}
          />
        ))}
        <span className="ml-2 text-sm text-gray-600">{rating.toFixed(1)}</span>
      </div>
    );
  };

  if (loading) {
    return <AdminRentalRatingsSkeleton />;
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 min-h-screen py-10 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                <FaStar className="text-yellow-600" />
                Admin Rental Ratings
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">View and manage all rental ratings across the platform</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search ratings, contracts, users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    fetchAllRatings();
                  }
                }}
                className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Ratings</option>
              <option value="tenant">Tenant Ratings</option>
              <option value="landlord">Landlord Ratings</option>
            </select>
            <button
              onClick={fetchAllRatings}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Ratings</div>
            <div className="text-2xl font-bold text-gray-800 dark:text-white">{ratings.length}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Complete Ratings</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {ratings.filter(r => r.bothRated).length}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Partial Ratings</div>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {ratings.filter(r => !r.bothRated).length}
            </div>
          </div>
        </div>

        {/* Ratings List */}
        {filteredRatings.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
            <FaStar className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No Ratings Found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery || roleFilter !== 'all'
                ? 'No ratings match your filters'
                : 'No rental ratings have been submitted yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRatings.map((rating) => {
              const tenantRating = rating.tenantToLandlordRating;
              const landlordRating = rating.landlordToTenantRating;
              const contract = rating.contractId;

              return (
                <div
                  key={rating._id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 dark:border-gray-700 hover:shadow-xl transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                          {contract?.listingId?.name || 'Property'}
                        </h3>
                        {rating.bothRated && (
                          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-semibold flex items-center gap-1">
                            <FaCheckCircle /> Complete
                          </span>
                        )}
                        {!rating.bothRated && (
                          <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full text-xs font-semibold flex items-center gap-1">
                            <FaClock /> Partial
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{contract?.listingId?.address || 'Address not available'}</p>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                        <div className="flex items-center gap-2">
                          <FaUser className="text-gray-400" />
                          <span>Tenant: {rating.tenantId?.username || rating.tenantId?.email || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FaUser className="text-gray-400" />
                          <span>Landlord: {rating.landlordId?.username || rating.landlordId?.email || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FaFileAlt className="text-gray-400" />
                          <span>Contract: {contract?.contractId || rating.ratingId || 'N/A'}</span>
                        </div>
                      </div>

                      {/* Tenant to Landlord Rating */}
                      {tenantRating?.overallRating ? (
                        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-blue-800 dark:text-blue-200">Tenant → Landlord</span>
                            {tenantRating.ratedAt && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(tenantRating.ratedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {renderStarRating(tenantRating.overallRating)}
                          {tenantRating.comment && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 line-clamp-2">{tenantRating.comment}</p>
                          )}
                        </div>
                      ) : (
                        <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                          <span className="text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-1">
                            <FaClock /> Tenant rating pending
                          </span>
                        </div>
                      )}

                      {/* Landlord to Tenant Rating */}
                      {landlordRating?.overallRating ? (
                        <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-green-800 dark:text-green-200">Landlord → Tenant</span>
                            {landlordRating.ratedAt && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(landlordRating.ratedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {renderStarRating(landlordRating.overallRating)}
                          {landlordRating.comment && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 line-clamp-2">{landlordRating.comment}</p>
                          )}
                        </div>
                      ) : (
                        <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                          <span className="text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-1">
                            <FaClock /> Landlord rating pending
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => handleViewRating(rating)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                      >
                        <FaStar /> View Details
                      </button>
                      {contract?.listingId?._id && (
                        <button
                          onClick={() => navigate(`/admin/listing/${contract.listingId._id}`)}
                          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center gap-2"
                        >
                          <FaHome /> View Listing
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Rating Display Modal */}
        {showRatingDisplay && selectedRating && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowRatingDisplay(false);
                setSelectedRating(null);
              }
            }}
          >
            <div className="flex min-h-full items-center justify-center p-4">
              <div
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <FaStar className="text-yellow-500" /> Rating Details
                  </h3>
                  <button
                    onClick={() => {
                      setShowRatingDisplay(false);
                      setSelectedRating(null);
                    }}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                  >
                    <FaTimes />
                  </button>
                </div>
                <div className="p-6">
                  <RatingDisplay
                    rating={selectedRating}
                    contract={selectedRating.contractId}
                    currentUser={currentUser}
                    onUpdate={handleRatingUpdated}
                    onClose={() => {
                      setShowRatingDisplay(false);
                      setSelectedRating(null);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

