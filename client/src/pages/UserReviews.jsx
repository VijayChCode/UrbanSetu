import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { FaStar, FaEdit, FaTrash, FaCheck, FaTimes, FaSync } from 'react-icons/fa';
import ReviewForm from '../components/ReviewForm.jsx';
import ContactSupportWrapper from '../components/ContactSupportWrapper';
import { socket } from '../utils/socket.js';
import { toast } from 'react-toastify';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function UserReviews() {
  const { currentUser } = useSelector((state) => state.user);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingReview, setEditingReview] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState(null);

  useEffect(() => {
    fetchUserReviews();
  }, []);

  useEffect(() => {
    const handleSocketReviewUpdate = (updatedReview) => {
      // Only update if the review belongs to the current user
      if (!currentUser || updatedReview.userId !== currentUser._id) return;
      setReviews((prevReviews) => {
        // If the review is removed (status 'removed'), update it in the list
        if (updatedReview.status === 'removed') {
          return prevReviews.map((r) =>
            r._id === updatedReview._id ? { ...r, ...updatedReview } : r
          );
        }
        // If the review is deleted (not present), remove it from the list
        if (updatedReview._deleted) {
          return prevReviews.filter((r) => r._id !== updatedReview._id);
        }
        // Otherwise, update the review in the list
        return prevReviews.map((r) =>
          r._id === updatedReview._id ? { ...r, ...updatedReview } : r
        );
      });
    };
    socket.on('reviewUpdated', handleSocketReviewUpdate);
    
    // Listen for profile updates to update user info in reviews
    const handleProfileUpdate = (profileData) => {
      setReviews(prevReviews => {
        const updated = prevReviews.map(review => {
          if (review.userId === profileData.userId) {
            return {
              ...review,
              userName: profileData.username,
              userAvatar: profileData.avatar
            };
          }
          return review;
        });
        return updated;
      });
    };
    socket.on('profileUpdated', handleProfileUpdate);

    
    return () => {
      socket.off('reviewUpdated', handleSocketReviewUpdate);
      socket.off('profileUpdated', handleProfileUpdate);

    };
  }, [currentUser]);

  // Fallback: Poll for profile updates every 30 seconds
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      if (!currentUser) return;
      
      try {
        const res = await fetch(`${API_BASE_URL}/api/user/id/${currentUser._id}`);
        if (res.ok) {
          const updatedUser = await res.json();
          if (updatedUser.username !== currentUser.username || updatedUser.avatar !== currentUser.avatar) {

            setReviews(prevReviews => prevReviews.map(review => {
              if (review.userId === updatedUser._id) {
                return {
                  ...review,
                  userName: updatedUser.username,
                  userAvatar: updatedUser.avatar
                };
              }
              return review;
            }));
          }
        }
      } catch (error) {
        console.error('[UserReviews] Error polling for profile updates:', error);
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(pollInterval);
  }, [currentUser]);

  const fetchUserReviews = async () => {
    try {
      setLoading(true);

      const res = await fetch(`${API_BASE_URL}/api/review/user`, {
        credentials: 'include',
      });

      const data = await res.json();


      if (res.ok) {
        setReviews(data);
      } else {
        setError(data.message || 'Failed to fetch reviews');
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = (review) => {
    setReviewToDelete(review);
    setShowDeleteModal(true);
  };

  const confirmDeleteReview = async () => {
    if (!reviewToDelete) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/review/delete/${reviewToDelete._id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok) {
        setReviews(reviews.filter(review => review._id !== reviewToDelete._id));
        toast.success('Review deleted successfully');
      } else {
        toast.error(data.message || 'Failed to delete review');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setShowDeleteModal(false);
      setReviewToDelete(null);
    }
  };

  const handleEditReview = (review) => {
    setEditingReview(review);
  };

  const handleReviewUpdated = () => {
    setEditingReview(null);
    fetchUserReviews();
    toast.success('Review updated successfully');
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      await fetchUserReviews();
      toast.success('Reviews refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh reviews');
    }
  };

  const renderStars = (rating) => {
    return [...Array(5)].map((_, index) => (
      <FaStar
        key={index}
        className={`text-lg ${
          index < rating ? 'text-yellow-400' : 'text-gray-300'
        }`}
      />
    ));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    // Handle null/undefined status
    if (!status) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Unknown
        </span>
      );
    }

    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: FaCheck },
      approved: { color: 'bg-green-100 text-green-800', icon: FaCheck },
      rejected: { color: 'bg-red-100 text-red-800', icon: FaTimes },
      removed: { color: 'bg-gray-100 text-gray-800', icon: FaTimes }
    };

    const config = statusConfig[status];
    
    // Handle unknown status
    if (!config) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      );
    }

    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Enhanced filtered reviews based on search and status
  const filteredReviews = reviews.filter((review) => {
    // Status filter
    if (statusFilter && review.status !== statusFilter) return false;
    // Enhanced search
    const propertyName = review.listingId?.name?.toLowerCase() || '';
    const propertyCity = review.listingId?.city?.toLowerCase() || '';
    const propertyState = review.listingId?.state?.toLowerCase() || '';
    const stars = String(review.rating);
    const comment = review.comment?.toLowerCase() || '';
    const adminNote = review.adminNote?.toLowerCase() || '';
    const date = formatDate(review.createdAt).toLowerCase();
    const q = search.toLowerCase();
    return (
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading your reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full sm:max-w-2xl md:max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <div className="bg-white rounded-xl shadow-lg p-3 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">My Reviews</h1>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow"
            title="Refresh reviews"
          >
            <FaSync className={`${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        {/* Search and Status Filter */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6">
          <input
            type="text"
            placeholder="Search by property name, city, state, review comment, admin note, or review date..."
            className="border border-gray-300 rounded-lg px-3 py-2 w-full sm:w-1/2"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              // Removed toast.info for search typing
            }}
          />
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 w-full sm:w-1/4"
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              if (e.target.value) {
                toast.info(`Filtered by status: ${e.target.value}`);
              } else {
                toast.info('Showing all reviews');
              }
            }}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="removed">Removed</option>
          </select>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {filteredReviews.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">⭐</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Reviews Found</h3>
            <p className="text-gray-600">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {filteredReviews.map((review) => (
              <div key={review._id} className="border border-gray-200 rounded-lg p-3 sm:p-6 hover:shadow-md transition-shadow overflow-x-auto">
                <div className="flex flex-col gap-2 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
                  {/* Review Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      {getStatusBadge(review.status)}
                      <span className="text-sm text-gray-500">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      {renderStars(review.rating)}
                      <span className="text-sm text-gray-600">
                        {review.rating} star{review.rating > 1 ? 's' : ''}
                      </span>
                    </div>

                    <p className="text-gray-700 mb-3">{review.comment}</p>

                    {/* Property Info */}
                    {review.listingId && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <h4 className="font-semibold text-gray-800">
                          <a href={`/user/listing/${typeof review.listingId === 'object' ? review.listingId._id : review.listingId}`} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                            {review.listingId.name}
                          </a>
                        </h4>
                        <p className="text-sm text-gray-600">
                          {review.listingId.city}, {review.listingId.state}
                        </p>
                      </div>
                    )}

                    {/* Admin Note */}
                    {review.adminNote && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <strong>Admin Note:</strong> {review.adminNote}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 lg:flex-shrink-0 w-full sm:w-auto">
                    <button
                      onClick={() => handleEditReview(review)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition shadow"
                    >
                      <FaEdit />
                      Edit
                    </button>
                    
                    <button
                      onClick={() => handleDeleteReview(review)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 transition shadow"
                    >
                      <FaTrash />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Review Modal */}
      {editingReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg max-w-xs sm:max-w-md w-full">
            <div className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2 sm:mb-4">Edit Review</h2>
              <ReviewForm
                listingId={typeof editingReview.listingId === 'object' ? editingReview.listingId._id : editingReview.listingId}
                existingReview={editingReview}
                onReviewSubmitted={handleReviewUpdated}
              />
              <button
                onClick={() => setEditingReview(null)}
                className="mt-4 w-full bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Review Confirmation Modal */}
      {showDeleteModal && reviewToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg max-w-md w-full mx-4 shadow-xl">
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FaTrash className="text-red-500" />
                Delete Review
              </h3>
              
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete this review? This action cannot be undone.
              </p>

              {/* Show review details for confirmation */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  {renderStars(reviewToDelete.rating)}
                  <span className="text-sm text-gray-600">
                    {reviewToDelete.rating} star{reviewToDelete.rating > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-sm text-gray-700 line-clamp-3">{reviewToDelete.comment}</p>
                {reviewToDelete.listingId && (
                  <p className="text-xs text-gray-500 mt-2">
                    Property: {reviewToDelete.listingId.name}
                  </p>
                )}
              </div>
              
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setReviewToDelete(null);
                  }}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteReview}
                  className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <FaTrash size={12} />
                  Delete Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ContactSupportWrapper />
    </div>
  );
} 