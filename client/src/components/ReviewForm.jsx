import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { FaStar, FaEdit, FaTimes } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ReviewForm({ listingId, existingReview, onReviewSubmitted }) {
  const { currentUser } = useSelector((state) => state.user);
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [comment, setComment] = useState(existingReview?.comment || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(!!existingReview);
  const [userCanReview, setUserCanReview] = useState(true);
  const [restrictionReason, setRestrictionReason] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    checkUserReviewPermissions();
  }, [currentUser, listingId]);

  const checkUserReviewPermissions = async () => {
    if (!currentUser) {
      setUserCanReview(false);
      setRestrictionReason('Please sign in to leave a review');
      return;
    }

    try {
      // Check if user is admin
      if (currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
        setUserCanReview(false);
        setRestrictionReason('Admins cannot post reviews. You can only manage reviews.');
        return;
      }

      // Check if user is property owner by fetching listing details
      const res = await fetch(`${API_BASE_URL}/api/listing/get/${listingId}`);
      const listingData = await res.json();
      
      if (res.ok && listingData.userRef === currentUser._id) {
        setUserCanReview(false);
        setRestrictionReason('Property owners cannot review their own properties.');
        return;
      }

      // Check if user has already reviewed this property
      const reviewRes = await fetch(`${API_BASE_URL}/api/review/user`, {
        credentials: 'include',
      });
      
      if (reviewRes.ok) {
        const userReviews = await reviewRes.json();
        const existingUserReview = userReviews.find(review => review.listingId === listingId);
        
        if (existingUserReview && !existingReview) {
          setUserCanReview(false);
          setRestrictionReason('You have already reviewed this property.');
          return;
        }
      }

      setUserCanReview(true);
      setRestrictionReason('');
    } catch (error) {
      console.error('Error checking review permissions:', error);
      setUserCanReview(true); // Default to allowing review if check fails
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!rating || !comment.trim()) {
      setError('Please provide both rating and comment');
      return;
    }

    if (comment.trim().length < 10) {
      setError('Comment must be at least 10 characters long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const url = isEditing 
        ? `${API_BASE_URL}/api/review/update/${existingReview._id}`
        : `${API_BASE_URL}/api/review/create`;
      
      const method = isEditing ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          listingId,
          rating,
          comment: comment.trim()
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (onReviewSubmitted) {
          onReviewSubmitted();
        }
        if (!isEditing) {
          setRating(0);
          setComment('');
        }
        setIsEditing(false);
        toast.success(data.message || 'Review submitted successfully!');
        // Removed navigate(0) - let the parent component handle data refresh
      } else {
        // Show alert for duplicate review error
        if (data.message && data.message.includes('already reviewed')) {
          toast.error(data.message);
        }
        setError(data.message || 'Failed to submit review');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setRating(existingReview?.rating || 0);
    setComment(existingReview?.comment || '');
    setError('');
  };

  const renderStars = () => {
    return [...Array(5)].map((_, index) => (
      <FaStar
        key={index}
        className={`text-2xl cursor-pointer transition-colors ${
          index < rating ? 'text-yellow-400' : 'text-gray-300'
        } hover:text-yellow-400`}
        onClick={() => setRating(index + 1)}
      />
    ));
  };

  // If user cannot review, show restriction message
  if (!userCanReview) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-center text-gray-600">
          <FaTimes className="mr-2 text-red-500" />
          <span className="font-medium">{restrictionReason}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          {isEditing ? 'Edit Your Review' : 'Write a Review'}
        </h3>
        {isEditing && (
          <button
            onClick={handleCancelEdit}
            className="text-gray-500 hover:text-gray-700"
          >
            <FaTimes />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rating *
          </label>
          <div className="flex items-center space-x-1">
            {renderStars()}
            <span className="ml-2 text-sm text-gray-600">
              {rating > 0 ? `${rating} star${rating > 1 ? 's' : ''}` : 'Select rating'}
            </span>
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Comment *
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows="4"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Share your experience with this property..."
            maxLength="500"
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-500">
              Minimum 10 characters required
            </span>
            <span className="text-xs text-gray-500">
              {comment.length}/500
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !rating || !comment.trim()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {isEditing ? 'Updating...' : 'Submitting...'}
            </>
          ) : (
            <>
              {isEditing ? <FaEdit className="mr-2" /> : null}
              {isEditing ? 'Update Review' : 'Submit Review'}
            </>
          )}
        </button>
      </form>
    </div>
  );
} 