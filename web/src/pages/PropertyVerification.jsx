import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaShieldAlt, FaCheckCircle, FaTimesCircle, FaClock, FaFileUpload, FaSearch, FaHome } from 'react-icons/fa';
import { usePageTitle } from '../hooks/usePageTitle';
import VerificationForm from '../components/verification/VerificationForm';
import VerificationStatus from '../components/verification/VerificationStatus';
import UserPropertyVerificationSkeleton from '../components/skeletons/UserPropertyVerificationSkeleton';
import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const STATUS_COLORS = {
  pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700',
  in_progress: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
  verified: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700',
  rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700'
};

const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  verified: 'Verified',
  rejected: 'Rejected'
};

export default function PropertyVerification() {
  usePageTitle("Property Verification - UrbanSetu");

  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const location = useLocation();

  const [myListings, setMyListings] = useState([]);
  const [verifications, setVerifications] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState(null);
  const [showVerificationForm, setShowVerificationForm] = useState(false);
  const [showVerificationStatus, setShowVerificationStatus] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('rent');


  useEffect(() => {
    if (!currentUser) {
      navigate('/sign-in');
      return;
    }
    fetchMyListings();
  }, [currentUser]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showVerificationForm || showVerificationStatus) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showVerificationForm, showVerificationStatus]);

  // Handle URL parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const listingIdParam = searchParams.get('listingId');

    if (listingIdParam && myListings.length > 0) {
      const listing = myListings.find(l => l._id === listingIdParam || l._id?.toString() === listingIdParam);
      if (listing) {
        const verification = verifications[listing._id];
        if (verification) {
          // If verification exists, show status modal
          setSelectedVerification(verification);
          setSelectedListing(listing);
          setShowVerificationStatus(true);
          // Update URL to keep modal state
          const newUrl = `/user/property-verification?listingId=${listingIdParam}`;
          window.history.replaceState({}, '', newUrl);
        } else {
          // If no verification, show form modal
          setSelectedListing(listing);
          setShowVerificationForm(true);
          // Update URL to keep modal state
          const newUrl = `/user/property-verification?listingId=${listingIdParam}`;
          window.history.replaceState({}, '', newUrl);
        }
      }
    }
  }, [location.search, myListings, verifications]);

  const fetchMyListings = async () => {
    try {
      setLoading(true);
      // Fetch user's own listings (like MyListings page)
      const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/user`);

      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        // Show all properties (both sale and rent)
        setMyListings(data);

        // Fetch verification status for each listing
        for (const listing of data) {
          await fetchVerificationStatus(listing._id);
        }
      } else {
        toast.error('Failed to fetch listings');
      }
    } catch (error) {
      console.error('Error fetching listings:', error);
      toast.error('Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  const fetchVerificationStatus = async (listingId) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/verification/${listingId}`);

      const data = await res.json();
      if (res.ok && data.success) {
        setVerifications(prev => ({
          ...prev,
          [listingId]: data.verification
        }));
      }
    } catch (error) {
      console.error('Error fetching verification status:', error);
    }
  };

  const handleRequestVerification = (listing) => {
    setSelectedListing(listing);
    setShowVerificationForm(true);
    // Update URL to reflect modal state
    const newUrl = `/user/property-verification?listingId=${listing._id}`;
    window.history.pushState({}, '', newUrl);
  };

  const handleViewVerification = async (listing) => {
    const verification = verifications[listing._id];
    if (verification) {
      setSelectedVerification(verification);
      setSelectedListing(listing);
      setShowVerificationStatus(true);
    } else {
      // Fetch fresh verification status
      await fetchVerificationStatus(listing._id);
      const updatedVerification = verifications[listing._id];
      if (updatedVerification) {
        setSelectedVerification(updatedVerification);
        setSelectedListing(listing);
        setShowVerificationStatus(true);
      } else {
        toast.info('No verification request found. Please create one first.');
      }
    }
  };

  const handleVerificationCreated = () => {
    setShowVerificationForm(false);
    setSelectedListing(null);
    fetchMyListings();
    toast.success('Verification request submitted successfully');
  };

  const handleVerificationUpdated = () => {
    if (selectedListing) {
      fetchVerificationStatus(selectedListing._id);
    }
    fetchMyListings();
  };

  const filteredListings = myListings.filter(listing => {
    // 1. Tab Filter
    if (activeTab === 'rent' && listing.type !== 'rent') return false;
    if (activeTab === 'sale' && listing.type !== 'sale') return false;

    const verification = verifications[listing._id];
    const status = verification ? verification.status : (listing.isVerified ? 'verified' : 'unverified');

    // 2. Status Filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'unverified') {
        if (status !== 'unverified') return false;
      } else {
        if (status !== statusFilter) return false;
      }
    }

    // 3. Search Filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        listing.name.toLowerCase().includes(query) ||
        listing.address?.toLowerCase().includes(query) ||
        listing.city?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (loading) {
    return <UserPropertyVerificationSkeleton />;
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 min-h-screen py-10 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                <FaShieldAlt className="text-blue-600 dark:text-blue-400" />
                Property Verification
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">Get your property verified and earn a trusted badge</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
            <button
              onClick={() => setActiveTab('rent')}
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors duration-200 flex items-center justify-center gap-2 ${activeTab === 'rent'
                ? 'border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
            >
              <FaHome className={activeTab === 'rent' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'} />
              Rent Properties
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === 'rent' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                {myListings.filter(l => l.type === 'rent').length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('sale')}
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors duration-200 flex items-center justify-center gap-2 ${activeTab === 'sale'
                ? 'border-b-2 border-green-600 dark:border-green-400 text-green-600 dark:text-green-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
            >
              <FaCheckCircle className={activeTab === 'sale' ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'} />
              Sale Properties
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === 'sale' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                {myListings.filter(l => l.type === 'sale').length}
              </span>
            </button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by property name, address, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="unverified">Unverified/Not Requested</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Listings */}
        {filteredListings.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
            <FaHome className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No Properties Found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchQuery ? 'No properties match your search' : 'You don\'t have any properties listed yet'}
            </p>
            <button
              onClick={() => navigate('/user/create-listing')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Listing
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredListings.map((listing) => {
              const verification = verifications[listing._id];
              const status = verification?.status || 'none';
              const isVerified = status === 'verified';

              return (
                <div
                  key={listing._id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 hover:shadow-xl transition-all dark:border-gray-700"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">{listing.name}</h3>
                        {isVerified && (
                          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-semibold flex items-center gap-1">
                            <FaCheckCircle /> Verified
                          </span>
                        )}
                        {verification && !isVerified && (
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${STATUS_COLORS[status] || STATUS_COLORS.pending}`}>
                            {STATUS_LABELS[status] || status}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{listing.address}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span>Bedrooms: {listing.bedrooms}</span>
                        <span>Bathrooms: {listing.bathrooms}</span>
                        {listing.monthlyRent && (
                          <span className="font-semibold text-blue-600 dark:text-blue-400">₹{listing.monthlyRent.toLocaleString()}/month</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      {verification ? (
                        <button
                          onClick={() => handleViewVerification(listing)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                        >
                          <FaShieldAlt /> View Status
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRequestVerification(listing)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                        >
                          <FaFileUpload /> Request Verification
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/user/listing/${listing._id}`)}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        View Listing
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Verification Form Modal */}
        {showVerificationForm && selectedListing && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowVerificationForm(false);
                setSelectedListing(null);
                // Update URL to remove listingId param
                window.history.pushState({}, '', '/user/property-verification');
              }
            }}
          >
            <div className="flex min-h-full items-center justify-center p-4">
              <div
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <VerificationForm
                    listing={selectedListing}
                    onSuccess={handleVerificationCreated}
                    onCancel={() => {
                      setShowVerificationForm(false);
                      setSelectedListing(null);
                      // Update URL to remove listingId param
                      window.history.pushState({}, '', '/user/property-verification');
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Verification Status Modal */}
        {showVerificationStatus && selectedListing && selectedVerification && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowVerificationStatus(false);
                setSelectedVerification(null);
                setSelectedListing(null);
                // Update URL to remove listingId param
                window.history.pushState({}, '', '/user/property-verification');
              }
            }}
          >
            <div className="flex min-h-full items-center justify-center p-4">
              <div
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <VerificationStatus
                    verification={selectedVerification}
                    listing={selectedListing}
                    currentUser={currentUser}
                    onUpdate={handleVerificationUpdated}
                    STATUS_COLORS={STATUS_COLORS}
                    STATUS_LABELS={STATUS_LABELS}
                    onClose={() => {
                      setShowVerificationStatus(false);
                      setSelectedVerification(null);
                      setSelectedListing(null);
                      // Update URL to remove listingId param
                      window.history.pushState({}, '', '/user/property-verification');
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

