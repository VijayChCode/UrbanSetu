import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaStar, FaUser, FaHome, FaSearch, FaTimes, FaCheckCircle, FaClock } from 'react-icons/fa';
import { usePageTitle } from '../hooks/usePageTitle';
import RatingForm from '../components/ratings/RatingForm';
import RatingDisplay from '../components/ratings/RatingDisplay';
import UserRentalRatingsSkeleton from '../components/skeletons/UserRentalRatingsSkeleton';
import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function RentalRatings() {
  usePageTitle("Rental Ratings - UrbanSetu");

  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const location = useLocation();

  const [ratings, setRatings] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContract, setSelectedContract] = useState(null);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [ratingRole, setRatingRole] = useState(null); // 'tenant' or 'landlord'
  const [showRatingDisplay, setShowRatingDisplay] = useState(false);
  const [selectedRating, setSelectedRating] = useState(null);
  const [filters, setFilters] = useState({
    role: 'all', // 'all', 'tenant', 'landlord'
    search: ''
  });

  useEffect(() => {
    if (!currentUser) {
      navigate('/sign-in');
      return;
    }
    // Only fetch on initial load or user change, not on filter changes
    if (ratings.length === 0) {
      fetchRatings();
    }
    fetchContracts();
  }, [currentUser]);

  // Handle URL parameters - auto-open rating modal
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const contractIdParam = searchParams.get('contractId');
    const roleParam = searchParams.get('role');

    if (contractIdParam && roleParam) {
      // First try to find contract in loaded contracts
      const contract = contracts.find(c =>
        (c._id === contractIdParam) || (c.contractId === contractIdParam) ||
        (c._id?.toString() === contractIdParam) || (c.contractId?.toString() === contractIdParam)
      );

      if (contract) {
        setSelectedContract(contract);
        setRatingRole(roleParam);
        setShowRatingForm(true);
        // Update URL without navigation to keep modal state
        const newUrl = `/user/rental-ratings?contractId=${contractIdParam}&role=${roleParam}`;
        window.history.replaceState({}, '', newUrl);
      } else if (contracts.length > 0) {
        // If contracts loaded but contract not found, try to fetch it directly
        fetchContractById(contractIdParam, roleParam);
      } else {
        // If contracts haven't loaded yet, wait for them or fetch directly
        const timer = setTimeout(() => {
          if (contracts.length === 0) {
            fetchContractById(contractIdParam, roleParam);
          }
        }, 1000);

        return () => clearTimeout(timer);
      }
    }
  }, [location.search, contracts]);

  // Fetch contract by ID if not in the list
  const fetchContractById = async (contractId, role) => {
    try {
      // Try fetching by _id first (MongoDB ObjectId format)
      let res = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts/${contractId}`);

      let data = await res.json();

      // If not found, try with contractId field instead
      if (!res.ok || !data.success || !data.contract) {
        // The endpoint should handle both _id and contractId, but let's also try the contractId field format
        const contracts = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts?status=active,expired`);
        const contractsData = await contracts.json();

        if (contractsData.success && contractsData.contracts) {
          const foundContract = contractsData.contracts.find(c =>
            (c._id === contractId) || (c.contractId === contractId) ||
            (c._id?.toString() === contractId) || (c.contractId?.toString() === contractId)
          );

          if (foundContract) {
            setSelectedContract(foundContract);
            setRatingRole(role);
            setShowRatingForm(true);
            return;
          }
        }
      } else if (data.contract) {
        setSelectedContract(data.contract);
        setRatingRole(role);
        setShowRatingForm(true);
        return;
      }

      toast.error('Contract not found');
      // Clean URL if contract not found
      navigate('/user/rental-ratings', { replace: true });
    } catch (error) {
      console.error('Error fetching contract:', error);
      toast.error('Failed to load contract');
      // Clean URL on error
      navigate('/user/rental-ratings', { replace: true });
    }
  };

  const fetchRatings = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      // Fetch all ratings, apply filters client-side
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/ratings`);

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

  const fetchContracts = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts?status=active,expired`);

      const data = await res.json();
      if (res.ok && data.success) {
        setContracts(data.contracts || []);
      }
    } catch (error) {
      console.error('Error fetching contracts:', error);
    }
  };

  const handleSubmitRating = (contract, role) => {
    setSelectedContract(contract);
    setRatingRole(role);
    setShowRatingForm(true);
  };

  const handleViewRating = async (contract) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/ratings/${contract._id}`);

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.rating) {
          setSelectedRating(data.rating);
          setSelectedContract(contract);
          setShowRatingDisplay(true);
        } else {
          toast.info('No rating found for this contract');
        }
      }
    } catch (error) {
      console.error('Error fetching rating:', error);
      toast.error('Failed to fetch rating');
    }
  };

  const handleRatingSubmitted = () => {
    setShowRatingForm(false);
    setSelectedContract(null);
    setRatingRole(null);
    // Clean URL after submission
    navigate('/user/rental-ratings', { replace: true });
    // Refresh ratings list
    fetchRatings();
    // Refetch contracts to update rating status
    fetchContracts();
  };

  const handleRatingUpdated = () => {
    fetchRatings();
    if (selectedContract) {
      handleViewRating(selectedContract);
    }
  };

  const filteredRatings = ratings.filter(rating => {
    // Filter by role
    if (filters.role !== 'all') {
      if (filters.role === 'tenant' && !rating.tenantToLandlordRating?.overallRating) {
        return false;
      }
      if (filters.role === 'landlord' && !rating.landlordToTenantRating?.overallRating) {
        return false;
      }
    }

    // Filter by search
    const matchesSearch = filters.search === '' ||
      rating.contractId?.contractId?.toLowerCase().includes(filters.search.toLowerCase()) ||
      rating.contractId?.listingId?.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
      rating.contractId?.listingId?.address?.toLowerCase().includes(filters.search.toLowerCase()) ||
      rating.tenantId?.username?.toLowerCase().includes(filters.search.toLowerCase()) ||
      rating.tenantId?.email?.toLowerCase().includes(filters.search.toLowerCase()) ||
      rating.landlordId?.username?.toLowerCase().includes(filters.search.toLowerCase()) ||
      rating.landlordId?.email?.toLowerCase().includes(filters.search.toLowerCase()) ||
      rating.ratingId?.toLowerCase().includes(filters.search.toLowerCase());
    return matchesSearch;
  });

  const getStarRating = (rating) => {
    if (!rating || rating === 0) return 0;
    return rating;
  };

  const renderStarRating = (rating) => {
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
    return <UserRentalRatingsSkeleton />;
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 min-h-screen py-10 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                <FaStar className="text-yellow-600" />
                Rental Ratings
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">Rate your rental experience and view ratings</p>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search ratings..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
            <select
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
              className="px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Roles</option>
              <option value="tenant">As Tenant</option>
              <option value="landlord">As Landlord</option>
            </select>
          </div>
        </div>

        {/* Contracts Available for Rating */}
        {contracts.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <FaHome /> Available for Rating
            </h2>
            <div className="space-y-3">
              {contracts
                .filter(contract => {
                  // Find if rating exists
                  const existingRating = ratings.find(r =>
                    r.contractId?._id?.toString() === contract._id ||
                    r.contractId?.toString() === contract._id
                  );

                  if (!existingRating) return true;

                  // Check if user can still rate
                  const isTenant = contract.tenantId?._id === currentUser._id || contract.tenantId === currentUser._id;
                  const isLandlord = contract.landlordId?._id === currentUser._id || contract.landlordId === currentUser._id;

                  if (isTenant && !existingRating.tenantToLandlordRating?.overallRating) return true;
                  if (isLandlord && !existingRating.landlordToTenantRating?.overallRating) return true;

                  return false;
                })
                .slice(0, 5)
                .map(contract => {
                  const existingRating = ratings.find(r =>
                    r.contractId?._id?.toString() === contract._id ||
                    r.contractId?.toString() === contract._id
                  );

                  const isTenant = contract.tenantId?._id === currentUser._id || contract.tenantId === currentUser._id;
                  const isLandlord = contract.landlordId?._id === currentUser._id || contract.landlordId === currentUser._id;

                  const canRateAsTenant = isTenant && !existingRating?.tenantToLandlordRating?.overallRating;
                  const canRateAsLandlord = isLandlord && !existingRating?.landlordToTenantRating?.overallRating;

                  const listingId = contract.listingId?._id || contract.listingId;
                  const listingName = contract.listingId?.name || 'Property';

                  return (
                    <div key={contract._id} className="border dark:border-gray-700 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 dark:text-white">
                          {listingId ? (
                            <Link to={`/listing/${listingId}`} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline">
                              {listingName}
                            </Link>
                          ) : (
                            listingName
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Contract ID: {contract.contractId}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Rent: ₹{contract.lockedRentAmount?.toLocaleString()}/month</p>
                      </div>
                      <div className="flex gap-2">
                        {canRateAsTenant && (
                          <button
                            onClick={() => handleSubmitRating(contract, 'tenant')}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                          >
                            Rate Landlord
                          </button>
                        )}
                        {canRateAsLandlord && (
                          <button
                            onClick={() => handleSubmitRating(contract, 'landlord')}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                          >
                            Rate Tenant
                          </button>
                        )}
                        {existingRating && (
                          <button
                            onClick={() => handleViewRating(contract)}
                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
                          >
                            View Rating
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Ratings List */}
        {filteredRatings.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
            <FaStar className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No Ratings Found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {filters.role !== 'all' || filters.search !== ''
                ? 'Try adjusting your filters'
                : 'You don\'t have any ratings yet'}
            </p>
            {contracts.length > 0 && (
              <button
                onClick={() => setFilters({ role: 'all', search: '' })}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                View Available Ratings
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRatings.map((rating) => {
              const tenantRating = rating.tenantToLandlordRating;
              const landlordRating = rating.landlordToTenantRating;
              const contract = rating.contractId;
              const listingId = contract?.listingId?._id || contract?.listingId;
              const listingName = contract?.listingId?.name || 'Property';

              return (
                <div
                  key={rating._id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                          {listingId ? (
                            <Link to={`/listing/${listingId}`} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline">
                              {listingName}
                            </Link>
                          ) : (
                            listingName
                          )}
                        </h3>
                        {rating.bothRated && (
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-semibold flex items-center gap-1">
                            <FaCheckCircle /> Complete
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-mono mb-3">
                        {contract?.contractId || rating.ratingId}
                      </p>

                      {/* Tenant to Landlord Rating */}
                      {tenantRating?.overallRating && (
                        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center gap-2 mb-2">
                            <FaUser className="text-blue-600 dark:text-blue-400" />
                            <span className="font-semibold text-blue-800 dark:text-blue-200">Tenant rated Landlord</span>
                            {tenantRating.ratedAt && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                ({new Date(tenantRating.ratedAt).toLocaleDateString()})
                              </span>
                            )}
                          </div>
                          {renderStarRating(tenantRating.overallRating)}
                          {tenantRating.comment && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{tenantRating.comment}</p>
                          )}
                        </div>
                      )}

                      {/* Landlord to Tenant Rating */}
                      {landlordRating?.overallRating && (
                        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2 mb-2">
                            <FaUser className="text-green-600 dark:text-green-400" />
                            <span className="font-semibold text-green-800 dark:text-green-200">Landlord rated Tenant</span>
                            {landlordRating.ratedAt && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                ({new Date(landlordRating.ratedAt).toLocaleDateString()})
                              </span>
                            )}
                          </div>
                          {renderStarRating(landlordRating.overallRating)}
                          {landlordRating.comment && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{landlordRating.comment}</p>
                          )}
                        </div>
                      )}

                      {/* Pending Rating */}
                      {!tenantRating?.overallRating && (
                        <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                          <span className="text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-1">
                            <FaClock /> Tenant rating pending
                          </span>
                        </div>
                      )}
                      {!landlordRating?.overallRating && (
                        <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                          <span className="text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-1">
                            <FaClock /> Landlord rating pending
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleViewRating(rating.contractId || { _id: rating.contractId?._id || rating.contractId })}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                      >
                        <FaStar /> View Details
                      </button>
                      <Link
                        to={`/user/rental-contracts?contractId=${rating.contractId?._id || rating.contractId}`}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-center text-sm"
                      >
                        View Contract
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Rating Form Modal */}
        {showRatingForm && selectedContract && ratingRole && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full p-6 relative max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between mb-4 border-b dark:border-gray-700 pb-2 flex-shrink-0">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  {ratingRole === 'tenant' ? 'Rate Landlord' : 'Rate Tenant'}
                </h2>
                <button
                  onClick={() => {
                    setShowRatingForm(false);
                    setSelectedContract(null);
                    setRatingRole(null);
                    // Clean URL when modal is closed
                    navigate('/user/rental-ratings', { replace: true });
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
                >
                  <FaTimes />
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                <RatingForm
                  contract={selectedContract}
                  role={ratingRole}
                  currentUser={currentUser}
                  onSuccess={handleRatingSubmitted}
                  onCancel={() => {
                    setShowRatingForm(false);
                    setSelectedContract(null);
                    setRatingRole(null);
                    // Clean URL when modal is cancelled
                    navigate('/user/rental-ratings', { replace: true });
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Rating Display Modal */}
        {showRatingDisplay && selectedRating && selectedContract && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full p-6 relative max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between mb-4 border-b dark:border-gray-700 pb-2 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Rating Details</h2>
                <button
                  onClick={() => {
                    setShowRatingDisplay(false);
                    setSelectedRating(null);
                    setSelectedContract(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
                >
                  <FaTimes />
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                <RatingDisplay
                  rating={selectedRating}
                  contract={selectedContract}
                  currentUser={currentUser}
                  onUpdate={handleRatingUpdated}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


