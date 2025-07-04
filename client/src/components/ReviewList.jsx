import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { FaStar, FaTrash, FaEdit, FaCheck, FaTimes, FaThumbsUp, FaCheckCircle, FaSort, FaSortUp, FaSortDown, FaReply } from 'react-icons/fa';
import ReviewForm from './ReviewForm.jsx';
import { socket } from '../utils/socket';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ReviewList({ listingId, onReviewDeleted, listingOwnerId }) {
  const { currentUser } = useSelector((state) => state.user);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingReview, setEditingReview] = useState(null);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [responseEdit, setResponseEdit] = useState({});
  const [responseLoading, setResponseLoading] = useState({});
  const [responseError, setResponseError] = useState({});

  useEffect(() => {
    fetchReviews();
    // Listen for real-time review updates
    const handleSocketReviewUpdate = (updatedReview) => {
      if (updatedReview.listingId === listingId || (updatedReview.listingId && updatedReview.listingId._id === listingId)) {
        setReviews(prev => {
          const exists = prev.some(r => r._id === updatedReview._id);
          if (exists) {
            return prev.map(r => r._id === updatedReview._id ? { ...r, ...updatedReview } : r);
          } else {
            return [updatedReview, ...prev];
          }
        });
      }
    };
    socket.on('reviewUpdated', handleSocketReviewUpdate);
    return () => {
      socket.off('reviewUpdated', handleSocketReviewUpdate);
    };
  }, [listingId]);

  const fetchReviews = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/review/listing/${listingId}?sort=${sortBy}&order=${sortOrder}`, {
        credentials: 'include',
      });
      const data = await res.json();
      
      if (res.ok) {
        setReviews(data);
      } else {
        setError(data.message || 'Failed to load reviews');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete this review?')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/review/delete/${reviewId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok) {
        setReviews(reviews.filter(review => review._id !== reviewId));
        if (onReviewDeleted) {
          onReviewDeleted();
        }
        alert('Review deleted successfully');
      } else {
        alert(data.message || 'Failed to delete review');
      }
    } catch (error) {
      alert('Network error. Please try again.');
    }
  };

  const handleEditReview = (review) => {
    setEditingReview(review);
  };

  const handleReviewUpdated = () => {
    setEditingReview(null);
    fetchReviews();
  };

  const handleHelpfulVote = async (reviewId) => {
    if (!currentUser) {
      alert('Please sign in to vote on reviews');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/review/helpful/${reviewId}`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok) {
        // Update the review in the list
        setReviews(reviews.map(review => {
          if (review._id === reviewId) {
            return {
              ...review,
              helpfulCount: data.helpfulCount,
              helpfulVotes: data.hasVoted 
                ? [...review.helpfulVotes, { userId: currentUser._id }]
                : review.helpfulVotes.filter(vote => vote.userId !== currentUser._id)
            };
          }
          return review;
        }));
      } else {
        alert(data.message || 'Failed to vote');
      }
    } catch (error) {
      alert('Network error. Please try again.');
    }
  };

  const handleOwnerResponseChange = (reviewId, value) => {
    setResponseEdit((prev) => ({ ...prev, [reviewId]: value }));
  };

  const handleOwnerResponseSubmit = async (reviewId) => {
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
      } else {
        setResponseError((prev) => ({ ...prev, [reviewId]: data.message || 'Failed to submit response' }));
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
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: FaCheck },
      approved: { color: 'bg-green-100 text-green-800', icon: FaCheck },
      rejected: { color: 'bg-red-100 text-red-800', icon: FaTimes }
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const hasUserVoted = (review) => {
    if (!currentUser) return false;
    return review.helpfulVotes?.some(vote => vote.userId === currentUser._id);
  };

  const getSortIcon = (field) => {
    if (sortBy !== field) return <FaSort className="text-gray-400" />;
    return sortOrder === 'desc' ? <FaSortDown className="text-blue-600" /> : <FaSortUp className="text-blue-600" />;
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading reviews...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No reviews yet. Be the first to review this property!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-gray-800">
          Reviews ({reviews.length})
        </h3>
        
        {/* Sort Options */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Sort by:</span>
          <button
            onClick={() => handleSort('date')}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Date {getSortIcon('date')}
          </button>
          <button
            onClick={() => handleSort('rating')}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Rating {getSortIcon('rating')}
          </button>
          <button
            onClick={() => handleSort('helpful')}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Helpful {getSortIcon('helpful')}
          </button>
        </div>
      </div>
      
      {reviews.map((review) => (
        <div key={review._id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3 mb-3">
              <img
                src={review.userAvatar}
                alt={review.userName}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-800">{review.userName}</h4>
                  {(review.isVerified || review.verifiedByBooking) && (
                    <span className="flex items-center text-green-600 text-sm">
                      <FaCheckCircle className="mr-1" />
                      Verified
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  {renderStars(review.rating)}
                  <span className="text-sm text-gray-600 ml-2">
                    {review.rating} star{review.rating > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Action buttons for user's own reviews */}
            {currentUser && currentUser._id === review.userId && review.status !== 'approved' && (
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEditReview(review)}
                  className="text-blue-600 hover:text-blue-800 p-1"
                  title="Edit review"
                >
                  <FaEdit />
                </button>
                <button
                  onClick={() => handleDeleteReview(review._id)}
                  className="text-red-600 hover:text-red-800 p-1"
                  title="Delete review"
                >
                  <FaTrash />
                </button>
              </div>
            )}
          </div>
          
          <p className="text-gray-700 mb-3">{review.comment}</p>
          
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{formatDate(review.createdAt)}</span>
            
            {/* Helpful Vote Button */}
            {review.status === 'approved' && (
              <button
                onClick={() => handleHelpfulVote(review._id)}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                  hasUserVoted(review)
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <FaThumbsUp className={hasUserVoted(review) ? 'text-blue-600' : ''} />
                <span>Helpful</span>
                {review.helpfulCount > 0 && (
                  <span className="ml-1">({review.helpfulCount})</span>
                )}
              </button>
            )}
          </div>
          
          {/* Status indicator */}
          <div className="mt-3 flex items-center gap-2">
            {getStatusBadge(review.status)}
            {review.verifiedByBooking && (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                Booked this property
              </span>
            )}
          </div>
          
          {/* Admin note (if any) */}
          {review.adminNote && (
            <div className="mt-3 p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">
                <strong>Admin Note:</strong> {review.adminNote}
              </p>
            </div>
          )}

          {/* Owner response (if any) */}
          {review.ownerResponse && (
            <div className="mt-3 p-3 bg-blue-50 rounded-md border border-blue-200">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <FaReply className="inline-block text-blue-500" />
                <strong>Owner Response:</strong> {review.ownerResponse}
              </p>
            </div>
          )}

          {/* Owner response form (only for owner) */}
          {currentUser && listingOwnerId && currentUser._id === listingOwnerId && (
            <div className="mt-3">
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
                onClick={() => handleOwnerResponseSubmit(review._id)}
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
      ))}
      
      {/* Edit form modal */}
      {editingReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Edit Review</h3>
            <ReviewForm
              listingId={listingId}
              existingReview={editingReview}
              onReviewSubmitted={handleReviewUpdated}
            />
            <button
              onClick={() => setEditingReview(null)}
              className="mt-4 w-full bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 