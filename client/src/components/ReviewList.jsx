import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { FaStar, FaTrash, FaEdit, FaCheck, FaTimes, FaThumbsUp, FaCheckCircle, FaSort, FaSortUp, FaSortDown, FaReply, FaPen, FaExclamationTriangle, FaBan } from 'react-icons/fa';
import ReviewForm from './ReviewForm.jsx';
import ReplyForm from './ReplyForm.jsx';
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
  const [replies, setReplies] = useState({});
  const [editingReply, setEditingReply] = useState(null);
  const [editingOwnerResponse, setEditingOwnerResponse] = useState(false);
  const [ownerResponseEdit, setOwnerResponseEdit] = useState('');
  const [reportingReview, setReportingReview] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [replyLikeLoading, setReplyLikeLoading] = useState({});

  useEffect(() => {
    fetchReviews();
    // Listen for real-time review updates
    const handleSocketReviewUpdate = (updatedReview) => {
      if (updatedReview.listingId === listingId || (updatedReview.listingId && updatedReview.listingId._id === listingId)) {
        setReviews(prev => {
          // Replace the review object entirely with the updated one from the server
          const exists = prev.some(r => r._id === updatedReview._id);
          if (exists) {
            return prev.map(r => r._id === updatedReview._id ? updatedReview : r);
          } else {
            return [updatedReview, ...prev];
          }
        });
        // Fetch replies for this review if needed
        fetchReplies(updatedReview._id);
      }
    };
    socket.on('reviewUpdated', handleSocketReviewUpdate);
    // Listen for real-time reply updates
    const handleSocketReplyUpdate = ({ action, replies, reviewId, reply, replyId }) => {
      if (action === 'updatedAll' && reviewId && replies) {
        setReplies(prev => ({ ...prev, [reviewId]: replies }));
      } else if (action === 'deleted' && reviewId) {
        fetchReplies(reviewId);
      } else if (reply && reply.reviewId) {
        fetchReplies(reply.reviewId);
      }
    };
    socket.on('reviewReplyUpdated', handleSocketReplyUpdate);
    return () => {
      socket.off('reviewUpdated', handleSocketReviewUpdate);
      socket.off('reviewReplyUpdated', handleSocketReplyUpdate);
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
      rejected: { color: 'bg-red-100 text-red-800', icon: FaTimes },
      removed: { color: 'bg-gray-100 text-gray-800', icon: FaBan }
    };
    const config = statusConfig[status];
    if (!config) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
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

  const fetchReplies = async (reviewId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/review/reply/${reviewId}`);
      if (res.ok) {
        const data = await res.json();
        setReplies(prev => ({ ...prev, [reviewId]: data }));
      }
    } catch {}
  };

  useEffect(() => {
    reviews.forEach(r => fetchReplies(r._id));
  }, [reviews]);

  const handleLikeDislikeReply = async (replyId, action, parentReviewId) => {
    setReplyLikeLoading(prev => ({ ...prev, [replyId]: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/review/reply/like/${replyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });
      // No need to call fetchReplies here; socket will update UI
    } catch (error) {
      alert('Network error. Please try again.');
    } finally {
      setReplyLikeLoading(prev => ({ ...prev, [replyId]: false }));
    }
  };

  const handleDislikeReview = async (reviewId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/review/dislike/${reviewId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        // Optimistically update the review's dislike count in the local state
        setReviews((prevReviews) =>
          prevReviews.map((review) => {
            if (review._id === reviewId) {
              // If the user already disliked, remove their dislike; otherwise, add it
              const alreadyDisliked = review.dislikes?.some(d => d.userId === currentUser?._id);
              let newDislikes;
              let newDislikeCount = review.dislikeCount || 0;
              if (alreadyDisliked) {
                newDislikes = review.dislikes.filter(d => d.userId !== currentUser._id);
                newDislikeCount = Math.max(0, newDislikeCount - 1);
              } else {
                newDislikes = [...(review.dislikes || []), { userId: currentUser._id }];
                newDislikeCount = newDislikeCount + 1;
              }
              return {
                ...review,
                dislikes: newDislikes,
                dislikeCount: newDislikeCount,
              };
            }
            return review;
          })
        );
        // Optionally, fetchReplies(reviewId); // Only needed if replies are affected
      }
    } catch (error) {
      alert('Network error. Please try again.');
    }
  };

  const handleEditReply = (reply) => {
    setEditingReply(reply);
  };

  const handleUpdateReply = async () => {
    if (!editingReply || !editingReply.comment.trim()) return;
    await fetch(`${API_BASE_URL}/api/review/reply/${editingReply._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ comment: editingReply.comment }),
    });
    setEditingReply(null);
  };

  const handleDeleteReply = async (replyId) => {
    if (!window.confirm('Delete this reply?')) return;
    await fetch(`${API_BASE_URL}/api/review/reply/${replyId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  };

  const handleEditOwnerResponse = (review) => {
    setEditingOwnerResponse(review._id);
    setOwnerResponseEdit(review.ownerResponse || '');
  };

  const handleUpdateOwnerResponse = async (reviewId) => {
    await handleOwnerResponseSubmit(reviewId, ownerResponseEdit);
    setEditingOwnerResponse(false);
  };

  const handleDeleteOwnerResponse = async (reviewId) => {
    if (!window.confirm('Delete owner response?')) return;
    await fetch(`${API_BASE_URL}/api/review/respond/${reviewId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    setEditingOwnerResponse(false);
  };

  const handleLikeDislikeOwnerResponse = async (reviewId, action) => {
    try {
      await fetch(`${API_BASE_URL}/api/review/respond/like/${reviewId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });
    } catch {}
  };

  // Helper to check if a user is admin
  const isAdminUser = (user) => user && (user.role === 'admin' || user.role === 'rootadmin');

  const handleReportReview = (review) => {
    setReportingReview(review);
    setReportReason('');
  };

  const handleSubmitReport = async () => {
    if (!reportReason.trim()) {
      alert('Please provide a reason for reporting.');
      return;
    }
    setReportLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/review/report/${reportingReview._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: reportReason }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Thank you for reporting. Our team will review this issue.');
        setReportingReview(null);
        setReportReason('');
      } else {
        alert(data.message || 'Failed to report issue.');
      }
    } catch (error) {
      alert('Network error. Please try again.');
    } finally {
      setReportLoading(false);
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
              {review.userAvatar && !isAdminUser(review) && (
                <img
                  src={review.userAvatar}
                  alt={review.userName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              )}
              <div>
                <div className="flex items-center gap-2">
                  {isAdminUser(review) ? (
                    <span className="font-semibold text-blue-700 flex items-center gap-1">
                      From organization <FaCheckCircle className="text-green-500" />
                    </span>
                  ) : (
                    <h4 className="font-semibold text-gray-800">{review.userName}</h4>
                  )}
                  {(review.isVerified || review.verifiedByBooking) && !isAdminUser(review) && (
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
            {(currentUser && (currentUser._id === review.userId || isAdminUser(currentUser)) && review.status !== 'approved') && (
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
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => handleDislikeReview(review._id)}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                  review.dislikes?.some(d => d.userId === currentUser?._id)
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span role="img" aria-label="dislike">👎</span>
                <span>Dislike</span>
                {review.dislikeCount > 0 && (
                  <span className="ml-1">({review.dislikeCount})</span>
                )}
              </button>
              <button
                onClick={() => handleHelpfulVote(review._id)}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                  hasUserVoted(review)
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                disabled={review.status !== 'approved'}
              >
                <FaThumbsUp className={hasUserVoted(review) ? 'text-blue-600' : ''} />
                <span>Helpful</span>
                {review.helpfulCount > 0 && (
                  <span className="ml-1">({review.helpfulCount})</span>
                )}
              </button>
            </div>
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
            <div className="mt-3 p-3 bg-blue-50 rounded-md border border-blue-200 flex justify-between items-center">
              <div className="flex-1">
                {editingOwnerResponse === review._id ? (
                  <>
                    <textarea
                      className="w-full border border-blue-300 rounded-md p-2 text-sm mb-2"
                      rows="2"
                      value={ownerResponseEdit}
                      onChange={e => setOwnerResponseEdit(e.target.value)}
                    />
                    <button
                      className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm ml-2"
                      onClick={() => handleUpdateOwnerResponse(review._id)}
                    >
                      Save
                    </button>
                    <button
                      className="bg-gray-400 text-white px-3 py-1 rounded hover:bg-gray-600 text-sm ml-2"
                      onClick={() => setEditingOwnerResponse(false)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-blue-800 flex items-center gap-2">
                      <FaReply className="inline-block text-blue-500" />
                      <strong>Owner Response:</strong> {review.ownerResponse}
                    </p>
                  </>
                )}
              </div>
              {/* Like/dislike for owner response (not owner) */}
              {currentUser && listingOwnerId && currentUser._id !== listingOwnerId && !editingOwnerResponse && (
                <div className="flex gap-2 ml-4 items-center">
                  <button
                    onClick={() => handleLikeDislikeOwnerResponse(review._id, 'like')}
                    className={`flex items-center gap-1 ${review.ownerResponseLikes?.includes(currentUser._id) ? 'text-blue-600' : 'text-gray-500'}`}
                  >
                    👍 Like {review.ownerResponseLikes?.length > 0 && `(${review.ownerResponseLikes.length})`}
                  </button>
                  <button
                    onClick={() => handleLikeDislikeOwnerResponse(review._id, 'dislike')}
                    className={`flex items-center gap-1 ${review.ownerResponseDislikes?.includes(currentUser._id) ? 'text-red-600' : 'text-gray-500'}`}
                  >
                    👎 Dislike {review.ownerResponseDislikes?.length > 0 && `(${review.ownerResponseDislikes.length})`}
                  </button>
                </div>
              )}
              {/* Edit/delete for owner */}
              {currentUser && listingOwnerId && currentUser._id === listingOwnerId && !editingOwnerResponse && (
                <span className="flex gap-2 ml-2">
                  <FaPen className="cursor-pointer text-blue-600" title="Edit" onClick={() => handleEditOwnerResponse(review)} />
                  <FaTrash className="cursor-pointer text-red-600" title="Delete" onClick={() => handleDeleteOwnerResponse(review._id)} />
                </span>
              )}
            </div>
          )}

          {/* Replies section */}
          <div className="mt-4 ml-8">
            <h5 className="text-sm font-semibold text-gray-700 mb-2">Replies</h5>
            {replies[review._id]?.map(reply => (
              <div key={reply._id} className="bg-gray-50 rounded p-2 mb-2 flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  {reply.userAvatar && !isAdminUser(reply) && (
                    <img src={reply.userAvatar} alt={reply.userName} className="w-6 h-6 rounded-full object-cover" />
                  )}
                  {isAdminUser(reply) ? (
                    <span className="font-semibold text-blue-700 flex items-center gap-1 text-xs">
                      From organization <FaCheckCircle className="text-green-500" />
                    </span>
                  ) : (
                    <span className="font-medium text-gray-800 text-xs">{reply.userName}</span>
                  )}
                  <span className="text-xs text-gray-500">{new Date(reply.createdAt).toLocaleString()}</span>
                  {currentUser && (
                    <span className="flex gap-2 ml-2">
                      {(
                        reply.userId === currentUser._id ||
                        (isAdminUser(currentUser) && isAdminUser(reply))
                      ) && (
                        <FaPen className="cursor-pointer text-blue-600" title="Edit" onClick={() => handleEditReply(reply)} />
                      )}
                      {(reply.userId === currentUser._id || isAdminUser(currentUser)) && (
                        <FaTrash className="cursor-pointer text-red-600" title="Delete" onClick={() => handleDeleteReply(reply._id)} />
                      )}
                    </span>
                  )}
                </div>
                {editingReply && editingReply._id === reply._id ? (
                  <>
                    <textarea
                      className="w-full border border-blue-300 rounded p-2 text-sm mb-1"
                      value={editingReply.comment}
                      onChange={e => setEditingReply({ ...editingReply, comment: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <button className="bg-blue-600 text-white px-2 py-1 rounded text-xs" onClick={handleUpdateReply}>Save</button>
                      <button className="bg-gray-400 text-white px-2 py-1 rounded text-xs" onClick={() => setEditingReply(null)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <div className="text-gray-700 text-sm mb-1">{reply.comment}</div>
                )}
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => handleLikeDislikeReply(reply._id, 'like', review._id)}
                    className={`flex items-center gap-1 ${reply.likes?.includes(currentUser?._id) ? 'text-blue-600' : 'text-gray-500'}`}
                    disabled={replyLikeLoading[reply._id]}
                  >
                    👍 Like {reply.likes?.length > 0 && `(${reply.likes.length})`}
                  </button>
                  <button
                    onClick={() => handleLikeDislikeReply(reply._id, 'dislike', review._id)}
                    className={`flex items-center gap-1 ${reply.dislikes?.includes(currentUser?._id) ? 'text-red-600' : 'text-gray-500'}`}
                    disabled={replyLikeLoading[reply._id]}
                  >
                    👎 Dislike {reply.dislikes?.length > 0 && `(${reply.dislikes.length})`}
                  </button>
                </div>
              </div>
            ))}
            {/* Reply form */}
            <ReplyForm reviewId={review._id} onReplyAdded={() => fetchReplies(review._id)} />
          </div>

          {/* Report button */}
          {currentUser && !isAdminUser(currentUser) && (
            <button
              className="flex items-center gap-1 text-yellow-600 hover:text-yellow-800 text-xs mt-2"
              title="Report an issue with this review"
              onClick={() => handleReportReview(review)}
            >
              <FaExclamationTriangle className="inline-block" />
              Report an Issue
            </button>
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

      {/* Report Modal */}
      {reportingReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-yellow-700">
              <FaExclamationTriangle /> Report an Issue
            </h3>
            <p className="mb-2 text-gray-700">Please describe the issue with this review:</p>
            <textarea
              className="w-full border border-yellow-300 rounded-md p-2 text-sm mb-2"
              rows="3"
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              placeholder="Enter reason (required)"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                className="bg-gray-400 text-white px-3 py-1 rounded hover:bg-gray-600 text-sm"
                onClick={() => setReportingReview(null)}
                disabled={reportLoading}
              >
                Cancel
              </button>
              <button
                className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 text-sm"
                onClick={handleSubmitReport}
                disabled={reportLoading}
              >
                {reportLoading ? 'Reporting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 