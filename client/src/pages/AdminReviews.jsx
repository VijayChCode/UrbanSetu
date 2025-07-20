import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { FaStar, FaCheck, FaTimes, FaTrash, FaEye, FaBan, FaSort, FaSortUp, FaSortDown, FaCheckCircle, FaThumbsUp, FaReply, FaSync, FaHome } from 'react-icons/fa';
import { socket } from '../utils/socket';
import { toast } from 'react-toastify';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminReviews() {
  const { currentUser } = useSelector((state) => state.user);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedReview, setSelectedReview] = useState(null);
  const [showRemovalModal, setShowRemovalModal] = useState(false);
  const [reviewToRemove, setReviewToRemove] = useState(null);
  const [removalReason, setRemovalReason] = useState('');
  const [removalNote, setRemovalNote] = useState('');
  const [responseEdit, setResponseEdit] = useState({});
  const [responseLoading, setResponseLoading] = useState({});
  const [responseError, setResponseError] = useState({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) {
      fetchReviews();
    }
    // Listen for real-time review updates
    const handleSocketReviewUpdate = (updatedReview) => {
      setReviews(prev => {
        // If the review is removed or deleted, remove it from the list
        if (updatedReview.status === 'removed' || updatedReview.deleted) {
          return prev.filter(r => r._id !== updatedReview._id);
        }
        // Otherwise, update the review in place
        const exists = prev.some(r => r._id === updatedReview._id);
        if (exists) {
          return prev.map(r => r._id === updatedReview._id ? { ...r, ...updatedReview } : r);
        } else {
          return [updatedReview, ...prev];
        }
      });
    };
    socket.on('reviewUpdated', handleSocketReviewUpdate);
    
    // Listen for profile updates to update user info in reviews
    const handleProfileUpdate = (profileData) => {
      setReviews(prevReviews => prevReviews.map(review => {
        if (review.userId === profileData.userId) {
          return {
            ...review,
            userName: profileData.username,
            userAvatar: profileData.avatar
          };
        }
        return review;
      }));
    };
    socket.on('profileUpdated', handleProfileUpdate);
    
    return () => {
      socket.off('reviewUpdated', handleSocketReviewUpdate);
      socket.off('profileUpdated', handleProfileUpdate);
    };
  }, [currentUser, currentPage, selectedStatus, sortBy, sortOrder]);

  // Scroll lock for modals: lock body scroll when review details modal is open (mobile and desktop)
  useEffect(() => {
    if (selectedReview || (showRemovalModal && reviewToRemove)) {
      // Prevent background scroll on all devices
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [selectedReview, showRemovalModal, reviewToRemove]);

  const fetchReviews = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        sort: sortBy,
        order: sortOrder
      });
      
      if (selectedStatus) {
        params.append('status', selectedStatus);
      }

      const res = await fetch(`${API_BASE_URL}/api/review/admin/all?${params}`, {
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok) {
        setReviews(data.reviews);
        setTotalPages(data.pages);
      } else {
        setError(data.message || 'Failed to load reviews');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (reviewId, newStatus, adminNote = '') => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/review/admin/status/${reviewId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus, adminNote }),
      });

      const data = await res.json();

      if (res.ok) {
        setReviews(reviews.map(review => 
          review._id === reviewId ? { ...review, status: newStatus, adminNote } : review
        ));
        toast.success(`Review ${newStatus} successfully`);
      } else {
        toast.error(data.message || 'Failed to update review status');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    }
  };

  const handleRemoveReview = async () => {
    if (!removalReason) {
      toast.error('Please select a removal reason');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/review/admin/remove/${reviewToRemove._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          reason: removalReason, 
          note: removalNote 
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReviews(reviews.map(review => 
          review._id === reviewToRemove._id 
            ? { ...review, status: 'removed', removalReason, removalNote } 
            : review
        ));
        setShowRemovalModal(false);
        setReviewToRemove(null);
        setRemovalReason('');
        setRemovalNote('');
        toast.success('Review removed successfully');
      } else {
        toast.error(data.message || 'Failed to remove review');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    }
  };

  const handleRestoreReview = async (reviewId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/review/admin/restore/${reviewId}`, {
        method: 'PUT',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setReviews(reviews.map(r => r._id === reviewId ? { ...r, ...data.review } : r));
        toast.success('Review restored and approved');
      } else {
        toast.error(data.message || 'Failed to restore review');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    }
  };

  const handleOwnerResponseChange = (reviewId, value) => {
    setResponseEdit((prev) => ({ ...prev, [reviewId]: value }));
  };

  const handleOwnerResponseSubmit = async (reviewId, listingOwnerId) => {
    setResponseLoading((prev) => ({ ...prev, [reviewId]: true }));
    setResponseError((prev) => ({ ...prev, [reviewId]: '' }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/review/respond/${reviewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ownerResponse: responseEdit[reviewId] }),
      });
      const data = await res.json();
      if (res.ok) {
        setReviews((prev) => prev.map(r => r._id === reviewId ? { ...r, ownerResponse: responseEdit[reviewId] } : r));
        setResponseEdit((prev) => ({ ...prev, [reviewId]: '' }));
        toast.success('Owner response submitted successfully');
      } else {
        setResponseError((prev) => ({ ...prev, [reviewId]: data.message || 'Failed to submit response' }));
        toast.error(data.message || 'Failed to submit response');
      }
    } catch (error) {
      setResponseError((prev) => ({ ...prev, [reviewId]: 'Network error. Please try again.' }));
    } finally {
      setResponseLoading((prev) => ({ ...prev, [reviewId]: false }));
    }
  };

  const renderStars = (rating) => {
    return [...Array(5)].map((_, index) => (
      <FaStar
        key={index}
        className={`text-sm ${
          index < rating ? 'text-yellow-400' : 'text-gray-300'
        }`}
      />
    ));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: FaCheck },
      approved: { color: 'bg-green-100 text-green-800', icon: FaCheck },
      rejected: { color: 'bg-red-100 text-red-800', icon: FaTimes },
      removed: { color: 'bg-gray-100 text-gray-800', icon: FaBan },
      removed_by_user: { color: 'bg-orange-100 text-orange-800', icon: FaBan },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="mr-1" />
        {status === 'removed_by_user' ? 'Removed by User' : status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getSortIcon = (field) => {
    if (sortBy !== field) return <FaSort className="text-gray-400" />;
    return sortOrder === 'desc' ? <FaSortDown className="text-blue-600" /> : <FaSortUp className="text-blue-600" />;
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
      toast.info(`Sorted by ${field} (${sortOrder === 'desc' ? 'ascending' : 'descending'})`);
    } else {
      setSortBy(field);
      setSortOrder('desc');
      toast.info(`Sorted by ${field} (descending)`);
    }
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      await fetchReviews();
      toast.success('Reviews refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh reviews');
    }
  };

  // Enhanced filtered reviews based on search
  const filteredReviews = reviews.filter((review) => {
    const userName = review.userName?.toLowerCase() || '';
    const userEmail = review.userEmail?.toLowerCase() || '';
    const propertyName = review.listingId?.name?.toLowerCase() || '';
    const propertyCity = review.listingId?.city?.toLowerCase() || '';
    const propertyState = review.listingId?.state?.toLowerCase() || '';
    const stars = String(review.rating);
    const comment = review.comment?.toLowerCase() || '';
    const adminNote = review.adminNote?.toLowerCase() || '';
    const date = formatDate(review.createdAt).toLowerCase();
    const q = search.toLowerCase();
    return (
      userName.includes(q) ||
      userEmail.includes(q) ||
      propertyName.includes(q) ||
      propertyCity.includes(q) ||
      propertyState.includes(q) ||
      stars === q ||
      comment.includes(q) ||
      adminNote.includes(q) ||
      date.includes(q) ||
      q === ''
    );
  });

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 py-4 sm:py-10 px-1 sm:px-2 md:px-8 animate-fadeIn">
      <div className="max-w-full sm:max-w-3xl md:max-w-6xl mx-auto bg-white rounded-2xl shadow-2xl p-2 sm:p-4 md:p-8 animate-slideUp">
        <div className="flex items-center justify-between mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-blue-700 drop-shadow animate-fade-in">Review Management</h1>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            title="Refresh reviews"
          >
            <FaSync className={`${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        {/* Search Box */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
          <input
            type="text"
            placeholder="Search by user email, name, property name, city, state, stars, comment, admin note, or review date..."
            className="border border-gray-300 rounded-lg px-3 py-2 w-full sm:w-1/2"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              // Removed toast.info for search typing
            }}
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-2 sm:gap-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 w-full">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                if (e.target.value) {
                  toast.info(`Filtered by status: ${e.target.value}`);
                } else {
                  toast.info('Showing all reviews');
                }
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="removed">Removed</option>
            </select>
            
            <div className="flex flex-wrap items-center gap-2 w-full">
              <span className="text-sm text-gray-600">Sort:</span>
              <button
                onClick={() => handleSort('date')}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Date {getSortIcon('date')}
              </button>
              <button
                onClick={() => handleSort('rating')}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Rating {getSortIcon('rating')}
              </button>
              <button
                onClick={() => handleSort('helpful')}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Helpful {getSortIcon('helpful')}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          {/* Responsive review cards for mobile, table for desktop */}
          <div className="flex flex-col gap-4 sm:table w-full">
            {filteredReviews.map((review, idx) => (
              <div
                key={review._id}
                className={
                  `flex flex-col sm:table-row bg-white rounded-lg shadow-sm sm:shadow-none p-3 sm:p-0 border sm:border-0` +
                  (idx !== filteredReviews.length - 1 ? ' sm:border-b sm:border-gray-200' : '')
                }
                style={{ marginBottom: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <div className="flex flex-row items-center gap-3 sm:table-cell sm:align-top sm:w-1/4 mb-2 sm:mb-0">
                  <div className="flex items-center">
                    <img
                      src={review.userAvatar}
                      alt={review.userName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="ml-4">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900">
                          {review.userName}
                        </div>
                        {review.isVerified && (
                          <FaCheckCircle className="text-green-600 text-sm" title="Verified user" />
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {review.listingId?.name ? (
                          <a href={`/admin/listing/${typeof review.listingId === 'object' ? review.listingId._id : review.listingId}`} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                            {review.listingId.name}
                          </a>
                        ) : 'Property not found'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {review.listingId?.city}, {review.listingId?.state}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:table-cell sm:align-top sm:w-1/4 mb-2 sm:mb-0">
                  <div className="flex items-center mb-2">
                    {renderStars(review.rating)}
                    <span className="ml-2 text-sm text-gray-600">
                      {review.rating} star{review.rating > 1 ? 's' : ''}
                    </span>
                    {review.helpfulCount > 0 && (
                      <div className="flex items-center ml-4 text-sm text-gray-500">
                        <FaThumbsUp className="mr-1" />
                        {review.helpfulCount}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-900 line-clamp-2">
                    {review.comment}
                  </p>
                  {review.verifiedByBooking && (
                    <span className="inline-block mt-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                      Booked this property
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1 sm:table-cell sm:align-top sm:w-1/4 mb-2 sm:mb-0">
                  <div className="mb-2">
                    {getStatusBadge(review.status)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDate(review.createdAt)}
                  </div>
                  {review.adminNote && (
                    <div className="text-xs text-gray-400 mt-1">
                      Note: {review.adminNote}
                    </div>
                  )}
                  {review.removalReason && (
                    <div className="text-xs text-red-600 mt-1">
                      Removed: {review.removalReason}
                    </div>
                  )}
                  {review.ownerResponse && (
                    <div className="mt-2 p-2 bg-blue-50 rounded-md border border-blue-200">
                      <p className="text-sm text-blue-800 flex items-center gap-2">
                        <FaReply className="inline-block text-blue-500" />
                        <strong>Owner Response:</strong> {review.ownerResponse}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:table-cell sm:align-top sm:w-1/4 mb-2 sm:mb-0">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                    {review.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(review._id, 'approved')}
                          className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow font-semibold flex items-center gap-2"
                          title="Approve review"
                        >
                          <FaCheck /> Approve
                        </button>
                        <button
                          onClick={() => handleStatusChange(review._id, 'rejected')}
                          className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg hover:from-red-600 hover:to-red-700 transition-all transform hover:scale-105 shadow font-semibold flex items-center gap-2"
                          title="Reject review"
                        >
                          <FaTimes /> Reject
                        </button>
                      </>
                    )}
                    {review.status === 'approved' && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setReviewToRemove(review);
                          setShowRemovalModal(true);
                        }}
                        className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white px-4 py-2 rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all transform hover:scale-105 shadow font-semibold flex items-center gap-2"
                        title="Remove review"
                      >
                        <FaBan /> Remove
                      </button>
                    )}
                    {(review.status === 'removed' || review.status === 'removed_by_user') && (
                      <button
                        onClick={() => handleRestoreReview(review._id)}
                        className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 shadow font-semibold flex items-center gap-2"
                        title="Restore review"
                      >
                        <FaCheck /> Restore
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedReview(review)}
                      className="bg-gradient-to-r from-blue-400 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all transform hover:scale-105 shadow font-semibold flex items-center gap-2"
                      title="View details"
                    >
                      <FaEye /> View
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this review from the table?')) {
                          setReviews(reviews.filter(r => r._id !== review._id));
                          toast.success('Review deleted from table successfully');
                        }
                      }}
                      className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-4 py-2 rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all transform hover:scale-105 shadow font-semibold flex items-center gap-2"
                      title="Delete from table"
                    >
                      <FaTrash /> Delete
                    </button>
                  </div>
                  {currentUser && review.listingId && currentUser._id === review.listingId.userRef && (
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-blue-700 mb-1 flex items-center gap-1">
                        <FaReply /> Respond as Owner
                      </label>
                      <textarea
                        className="w-full border border-blue-300 rounded-md p-2 text-sm mb-2"
                        rows="2"
                        placeholder="Write a response to this review..."
                        value={responseEdit[review._id] !== undefined ? responseEdit[review._id] : (review.ownerResponse || '')}
                        onChange={e => handleOwnerResponseChange(review._id, e.target.value)}
                        disabled={responseLoading[review._id]}
                      />
                      <button
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
                        onClick={() => handleOwnerResponseSubmit(review._id, review.listingId.userRef)}
                        disabled={responseLoading[review._id] || !responseEdit[review._id] || responseEdit[review._id].trim() === (review.ownerResponse || '').trim()}
                      >
                        {responseLoading[review._id] ? 'Saving...' : (review.ownerResponse ? 'Update Response' : 'Add Response')}
                      </button>
                      {responseError[review._id] && (
                        <div className="text-red-600 text-xs mt-1">{responseError[review._id]}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-2">
            <div className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  setCurrentPage(Math.max(1, currentPage - 1));
                  toast.info(`Navigated to page ${Math.max(1, currentPage - 1)}`);
                }}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                Previous
              </button>
              <button
                onClick={() => {
                  setCurrentPage(Math.min(totalPages, currentPage + 1));
                  toast.info(`Navigated to page ${Math.min(totalPages, currentPage + 1)}`);
                }}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Detail Modal */}
      {selectedReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-2xl mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto p-0 sm:p-0 relative animate-fadeIn">
            {/* Close button top right */}
            <button
              onClick={() => setSelectedReview(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors z-10 shadow"
              aria-label="Close"
            >
              <FaTimes className="w-5 h-5" />
            </button>
            {/* Header */}
            <div className="flex flex-col items-center justify-center bg-gradient-to-r from-blue-100 to-purple-100 rounded-t-2xl px-6 py-5 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <img
                  src={selectedReview.userAvatar}
                  alt={selectedReview.userName}
                  className="w-14 h-14 rounded-full object-cover border-4 border-white shadow-lg"
                />
                <div>
                  <h2 className="text-xl font-bold text-blue-800 flex items-center gap-2">
                    {selectedReview.userName}
                    {selectedReview.isVerified && (
                      <FaCheckCircle className="text-green-600 text-base" title="Verified user" />
                    )}
                  </h2>
                  <p className="text-xs text-gray-500">{selectedReview.userId?.email}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-col items-center">
                <span className="inline-flex items-center gap-1 text-sm text-purple-700 font-semibold">
                  <FaStar className="text-yellow-400" />
                  {selectedReview.rating} / 5
                </span>
                <div className="flex gap-1 mt-1">{renderStars(selectedReview.rating)}</div>
              </div>
            </div>
            {/* Body */}
            <div className="px-4 sm:px-8 py-4 space-y-4">
              {/* Property Info */}
              <div className="bg-blue-50 rounded-lg p-3 flex flex-col gap-1 border border-blue-100">
                <div className="font-semibold text-blue-700 flex items-center gap-2">
                  <FaHome className="text-blue-400" />
                  {selectedReview.listingId?.name || 'Property not found'}
                </div>
                <div className="text-xs text-gray-500">
                  {selectedReview.listingId?.city}, {selectedReview.listingId?.state}
                </div>
              </div>
              {/* Status & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <h4 className="font-medium mb-1 text-gray-700">Status</h4>
                  {getStatusBadge(selectedReview.status)}
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <h4 className="font-medium mb-1 text-gray-700">Date</h4>
                  <p className="text-gray-700">{formatDate(selectedReview.createdAt)}</p>
                </div>
              </div>
              {/* Comment */}
              <div>
                <h4 className="font-medium mb-1 text-gray-700">Comment</h4>
                <p className="text-gray-800 bg-gray-50 rounded-md p-3 border border-gray-100 shadow-inner">{selectedReview.comment}</p>
              </div>
              {/* Helpful Votes */}
              {selectedReview.helpfulCount > 0 && (
                <div>
                  <h4 className="font-medium mb-1 text-gray-700">Helpful Votes</h4>
                  <div className="flex items-center text-gray-700">
                    <FaThumbsUp className="mr-2 text-blue-500" />
                    {selectedReview.helpfulCount} people found this helpful
                  </div>
                </div>
              )}
              {/* Verified/Booking */}
              {selectedReview.isVerified && (
                <div className="bg-green-50 p-3 rounded-md flex items-center gap-2 border border-green-100">
                  <FaCheckCircle className="text-green-600" />
                  <span className="text-green-800 font-medium">Verified user</span>
                  {selectedReview.verifiedByBooking && (
                    <span className="ml-2 text-xs text-green-700">Booked this property</span>
                  )}
                </div>
              )}
              {/* Admin Note */}
              {selectedReview.adminNote && (
                <div>
                  <h4 className="font-medium mb-1 text-gray-700">Admin Note</h4>
                  <p className="text-gray-700 bg-yellow-50 p-3 rounded-md border border-yellow-100 shadow-inner">{selectedReview.adminNote}</p>
                </div>
              )}
              {/* Removal Details: only show if status is removed or removed_by_user */}
              {(selectedReview.status === 'removed' || selectedReview.status === 'removed_by_user') && selectedReview.removalReason && (
                <div>
                  <h4 className="font-medium mb-1 text-gray-700">Removal Details</h4>
                  <div className="bg-red-50 p-3 rounded-md border border-red-200">
                    <p className="text-red-800"><strong>Reason:</strong> {selectedReview.removalReason}</p>
                    {selectedReview.removalNote && (
                      <p className="text-red-700 mt-1"><strong>Note:</strong> {selectedReview.removalNote}</p>
                    )}
                    {selectedReview.removedAt && (
                      <p className="text-red-600 text-sm mt-1">
                        Removed on {formatDate(selectedReview.removedAt)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Removal Modal */}
      {showRemovalModal && reviewToRemove && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-xs sm:max-w-md w-full mx-2 sm:mx-4">
            <h2 className="text-xl font-semibold mb-4">Remove Review</h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to remove this review? This action cannot be undone.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Removal Reason *
                </label>
                <select
                  value={removalReason}
                  onChange={(e) => {
                    setRemovalReason(e.target.value);
                    if (e.target.value) {
                      toast.info(`Selected removal reason: ${e.target.value}`);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a reason</option>
                  <option value="spam">Spam</option>
                  <option value="inappropriate">Inappropriate content</option>
                  <option value="fake">Fake review</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Note (Optional)
                </label>
                <textarea
                  value={removalNote}
                  onChange={(e) => setRemovalNote(e.target.value)}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Provide additional details..."
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleRemoveReview}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Remove Review
              </button>
              <button
                onClick={() => {
                  setShowRemovalModal(false);
                  setReviewToRemove(null);
                  setRemovalReason('');
                  setRemovalNote('');
                  toast.info('Review removal cancelled');
                }}
                className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
