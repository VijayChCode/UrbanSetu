import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { FaStar, FaEdit, FaTrash, FaCheck, FaTimes } from 'react-icons/fa';
import ReviewForm from '../components/ReviewForm.jsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function UserReviews() {
  const { currentUser } = useSelector((state) => state.user);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingReview, setEditingReview] = useState(null);

  useEffect(() => {
    fetchUserReviews();
  }, []);

  const fetchUserReviews = async () => {
    try {
      setLoading(true);
      console.log('Fetching user reviews...');
      const res = await fetch(`${API_BASE_URL}/api/review/user`, {
        credentials: 'include',
      });

      const data = await res.json();
      console.log('Reviews data:', data);

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
    fetchUserReviews();
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

  if (loading) {
    return (
      <div className="text-center mt-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading your reviews...</p>
      </div>
    );
  }

  return (
    <div className="max-w-full sm:max-w-2xl md:max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <div className="bg-white rounded-xl shadow-lg p-3 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-6">My Reviews</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {reviews.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">⭐</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Reviews Yet</h3>
            <p className="text-gray-600">You haven't written any reviews yet. Start reviewing properties you've visited!</p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {reviews.map((review) => (
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
                        <h4 className="font-semibold text-gray-800">{review.listingId.name}</h4>
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
                    {review.status !== 'approved' && (
                      <button
                        onClick={() => handleEditReview(review)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <FaEdit />
                        Edit
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleDeleteReview(review._id)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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
    </div>
  );
} 