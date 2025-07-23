import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { FaStar, FaTrash, FaEdit, FaCheck, FaTimes, FaThumbsUp, FaCheckCircle, FaSort, FaSortUp, FaSortDown, FaReply, FaPen, FaExclamationTriangle, FaBan, FaUser } from 'react-icons/fa';
import ReviewForm from './ReviewForm.jsx';
import ReplyForm from './ReplyForm.jsx';
import { socket } from '../utils/socket';
import { toast } from 'react-toastify';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ReviewList({ listingId, onReviewDeleted, listingOwnerId }) {
  const { currentUser } = useSelector((state) => state.user);

  // Helper function to check if avatar is valid
  const isValidAvatar = (avatar) => {
    return avatar && avatar.trim() && avatar !== 'null' && avatar !== 'undefined' && avatar !== '';
  };
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
  const [expandedReplies, setExpandedReplies] = useState({});

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
    
    // Listen for profile updates to update user info in reviews and replies
    const handleProfileUpdate = (profileData) => {
      console.log('[ReviewList] Received profileUpdated socket event:', profileData);
      console.log('[ReviewList] Current reviews:', reviews.length);
      
      setReviews(prevReviews => {
        const updated = prevReviews.map(review => {
          if (review.userId === profileData.userId) {
            console.log('[ReviewList] Updating review:', review._id, 'for user:', profileData.userId);
            return {
              ...review,
              userName: profileData.username,
              userAvatar: profileData.avatar
            };
          }
          return review;
        });
        console.log('[ReviewList] Updated reviews:', updated.length);
        return updated;
      });
      
      setReplies(prevReplies => {
        const updated = { ...prevReplies };
        Object.keys(updated).forEach(reviewId => {
          updated[reviewId] = updated[reviewId]?.map(reply => {
            if (reply.userId === profileData.userId) {
              console.log('[ReviewList] Updating reply:', reply._id, 'for user:', profileData.userId);
              return {
                ...reply,
                userName: profileData.username,
                userAvatar: profileData.avatar
              };
            }
            return reply;
          });
        });
        return updated;
      });
    };
    socket.on('profileUpdated', handleProfileUpdate);
    console.log('[ReviewList] Socket listeners set up for profileUpdated');
    
    // Test socket connection with a simple event
    socket.emit('testConnection', { message: 'ReviewList component connected' }, (response) => {
      console.log('[ReviewList] Test socket response:', response);
    });
    
    return () => {
      socket.off('reviewUpdated', handleSocketReviewUpdate);
      socket.off('reviewReplyUpdated', handleSocketReplyUpdate);
      socket.off('profileUpdated', handleProfileUpdate);
      console.log('[ReviewList] Socket listeners cleaned up');
    };
  }, [listingId, sortBy, sortOrder]);

  // Dynamically update user name and avatar in reviews and replies if currentUser changes
  useEffect(() => {
    if (!currentUser) return;
    setReviews(prevReviews => prevReviews.map(r =>
      r.userId === currentUser._id
        ? { ...r, userName: currentUser.username, userAvatar: currentUser.avatar }
        : r
    ));
    setReplies(prevReplies => {
      const updated = { ...prevReplies };
      Object.keys(updated).forEach(reviewId => {
        updated[reviewId] = updated[reviewId]?.map(reply =>
          reply.userId === currentUser._id
            ? { ...reply, userName: currentUser.username, userAvatar: currentUser.avatar }
            : reply
        );
      });
      return updated;
    });
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
            console.log('[ReviewList] Profile updated via polling:', updatedUser);
            // Update reviews and replies with new profile data
            setReviews(prevReviews => prevReviews.map(r =>
              r.userId === updatedUser._id
                ? { ...r, userName: updatedUser.username, userAvatar: updatedUser.avatar }
                : r
            ));
            setReplies(prevReplies => {
              const updated = { ...prevReplies };
              Object.keys(updated).forEach(reviewId => {
                updated[reviewId] = updated[reviewId]?.map(reply =>
                  reply.userId === updatedUser._id
                    ? { ...reply, userName: updatedUser.username, userAvatar: updatedUser.avatar }
                    : reply
                );
              });
              return updated;
            });
          }
        }
      } catch (error) {
        console.error('[ReviewList] Error polling for profile updates:', error);
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(pollInterval);
  }, [currentUser]);

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
        toast.success('Review deleted successfully');
      } else {
        toast.error(data.message || 'Failed to delete review');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
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
      toast.info('Please sign in to vote on reviews');
      return;
    }
    // Optimistically update the review's helpful count in the local state
    setReviews((prevReviews) =>
      prevReviews.map((review) => {
        if (review._id === reviewId) {
          const hasVoted = review.helpfulVotes?.some(vote => vote.userId === currentUser._id);
          let newHelpfulVotes;
          let newHelpfulCount = review.helpfulCount || 0;
          if (hasVoted) {
            newHelpfulVotes = review.helpfulVotes.filter(vote => vote.userId !== currentUser._id);
            newHelpfulCount = Math.max(0, newHelpfulCount - 1);
          } else {
            newHelpfulVotes = [...(review.helpfulVotes || []), { userId: currentUser._id }];
            newHelpfulCount = newHelpfulCount + 1;
          }
          return {
            ...review,
            helpfulVotes: newHelpfulVotes,
            helpfulCount: newHelpfulCount,
          };
        }
        return review;
      })
    );
    try {
      const res = await fetch(`${API_BASE_URL}/api/review/helpful/${reviewId}`, {
        method: 'POST',
        credentials: 'include',
      });
      // No need to update state here; socket event will sync final state
    } catch (error) {
      toast.error('Network error. Please try again.');
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
      toast.info(`Sorted by ${field} (${sortOrder === 'desc' ? 'ascending' : 'descending'})`);
    } else {
      setSortBy(field);
      setSortOrder('desc');
      toast.info(`Sorted by ${field} (descending)`);
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
    if (!currentUser) {
      toast.info('Please sign in to vote on reviews');
      return;
    }
    setReplyLikeLoading(prev => ({ ...prev, [replyId]: true }));
    try {
      // Determine if we need to remove like/dislike
      const reply = replies[parentReviewId]?.find(r => r._id === replyId);
      let actualAction = action;
      // Optimistically update the reply's like/dislike state
      if (reply) {
        if (action === 'like') {
          if (reply.likes?.includes(currentUser?._id)) {
            actualAction = 'remove_like';
            // Remove like
            setReplies(prev => ({
              ...prev,
              [parentReviewId]: prev[parentReviewId].map(r =>
                r._id === replyId
                  ? { ...r, likes: r.likes.filter(id => id !== currentUser._id) }
                  : r
              ),
            }));
          } else {
            // Add like, remove dislike if present
            setReplies(prev => ({
              ...prev,
              [parentReviewId]: prev[parentReviewId].map(r =>
                r._id === replyId
                  ? {
                      ...r,
                      likes: [...(r.likes || []), currentUser._id],
                      dislikes: r.dislikes?.filter(id => id !== currentUser._id),
                    }
                  : r
              ),
            }));
          }
        } else if (action === 'dislike') {
          if (reply.dislikes?.includes(currentUser?._id)) {
            actualAction = 'remove_dislike';
            // Remove dislike
            setReplies(prev => ({
              ...prev,
              [parentReviewId]: prev[parentReviewId].map(r =>
                r._id === replyId
                  ? { ...r, dislikes: r.dislikes.filter(id => id !== currentUser._id) }
                  : r
              ),
            }));
          } else {
            // Add dislike, remove like if present
            setReplies(prev => ({
              ...prev,
              [parentReviewId]: prev[parentReviewId].map(r =>
                r._id === replyId
                  ? {
                      ...r,
                      dislikes: [...(r.dislikes || []), currentUser._id],
                      likes: r.likes?.filter(id => id !== currentUser._id),
                    }
                  : r
              ),
            }));
          }
        }
      }
      const res = await fetch(`${API_BASE_URL}/api/review/reply/like/${replyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: actualAction }),
      });
      // No need to call fetchReplies here; socket will update UI
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setReplyLikeLoading(prev => ({ ...prev, [replyId]: false }));
    }
  };

  const handleDislikeReview = async (reviewId) => {
    if (!currentUser) {
      toast.info('Please sign in to vote on reviews');
      return;
    }
    try {
      // Optimistically update the review's dislike count in the local state
      setReviews((prevReviews) =>
        prevReviews.map((review) => {
          if (review._id === reviewId) {
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
      const res = await fetch(`${API_BASE_URL}/api/review/dislike/${reviewId}`, {
        method: 'POST',
        credentials: 'include',
      });
      // No need to update state here; socket event will sync final state
    } catch (error) {
      toast.error('Network error. Please try again.');
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
    if (!currentUser) {
      toast.info('Please sign in to vote on reviews');
      return;
    }
    // Optimistically update the owner response like/dislike in the local state
    setReviews((prevReviews) =>
      prevReviews.map((review) => {
        if (review._id === reviewId) {
          let newLikes = review.ownerResponseLikes || [];
          let newDislikes = review.ownerResponseDislikes || [];
          if (action === 'like') {
            if (newLikes.includes(currentUser._id)) {
              newLikes = newLikes.filter(id => id !== currentUser._id);
            } else {
              newLikes = [...newLikes, currentUser._id];
              newDislikes = newDislikes.filter(id => id !== currentUser._id);
            }
          } else if (action === 'dislike') {
            if (newDislikes.includes(currentUser._id)) {
              newDislikes = newDislikes.filter(id => id !== currentUser._id);
            } else {
              newDislikes = [...newDislikes, currentUser._id];
              newLikes = newLikes.filter(id => id !== currentUser._id);
            }
          }
          return {
            ...review,
            ownerResponseLikes: newLikes,
            ownerResponseDislikes: newDislikes,
          };
        }
        return review;
      })
    );
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
      toast.info('Please provide a reason for reporting.');
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
        toast.success('Thank you for reporting. Our team will review this issue.');
        setReportingReview(null);
        setReportReason('');
      } else {
        toast.error(data.message || 'Failed to report issue.');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
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
          Reviews ({reviews.filter(r => r.status === 'approved').length})
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
      
      {reviews.filter(r => r.status === 'approved').map((review) => (
        <div key={review._id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3 mb-3">
              {!isAdminUser(review) && (
                <>
                  {isValidAvatar(review.userAvatar) ? (
                    <img
                      src={review.userAvatar}
                      alt={review.userName}
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ${isValidAvatar(review.userAvatar) ? 'hidden' : 'flex'}`}
                  >
                    <FaUser className="text-white text-lg" />
                  </div>
                </>
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
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <FaReply className="text-blue-500" />
                Replies ({replies[review._id]?.length || 0})
              </h5>
              {replies[review._id]?.length > 0 && (
                <button
                  onClick={() => setExpandedReplies(prev => ({ ...prev, [review._id]: !prev[review._id] }))}
                  className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  {expandedReplies[review._id] ? 'Hide' : 'Show'} Replies
                  <span className={`transform transition-transform duration-200 ${expandedReplies[review._id] ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
              )}
            </div>
            
            {/* Collapsible Replies Content */}
            {expandedReplies[review._id] && (
              <div className="space-y-3 animate-slideDown">
                {replies[review._id]?.map(reply => (
                  <div key={reply._id} className="bg-gradient-to-r from-gray-50 to-white rounded-lg p-3 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="flex items-center gap-2 mb-2">
                      {!isAdminUser(reply) && (
                        <>
                          {isValidAvatar(reply.userAvatar) ? (
                            <img 
                              src={reply.userAvatar} 
                              alt={reply.userName} 
                              className="w-6 h-6 rounded-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className={`w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ${isValidAvatar(reply.userAvatar) ? 'hidden' : 'flex'}`}
                          >
                            <FaUser className="text-white text-xs" />
                          </div>
                        </>
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
                        <div className="flex gap-2 ml-auto">
                          {(
                            reply.userId === currentUser._id ||
                            (isAdminUser(currentUser) && isAdminUser(reply))
                          ) && (
                            <button
                              onClick={() => handleEditReply(reply)}
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              title="Edit reply"
                            >
                              <FaPen size={10} />
                            </button>
                          )}
                          {(reply.userId === currentUser._id || isAdminUser(currentUser)) && (
                            <button
                              onClick={() => handleDeleteReply(reply._id)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Delete reply"
                            >
                              <FaTrash size={10} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {editingReply && editingReply._id === reply._id ? (
                      <div className="space-y-2">
                        <textarea
                          className="w-full border border-blue-300 rounded p-2 text-sm"
                          value={editingReply.comment}
                          onChange={e => setEditingReply({ ...editingReply, comment: e.target.value })}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button 
                            className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 transition-colors" 
                            onClick={handleUpdateReply}
                          >
                            Save
                          </button>
                          <button 
                            className="bg-gray-400 text-white px-2 py-1 rounded text-xs hover:bg-gray-600 transition-colors" 
                            onClick={() => setEditingReply(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-700 text-sm leading-relaxed">{reply.comment}</div>
                    )}
                    
                    <div className="flex gap-3 mt-2 text-xs">
                      <button
                        onClick={() => handleLikeDislikeReply(reply._id, 'like', review._id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                          reply.likes?.includes(currentUser?._id) 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'text-gray-500 hover:bg-gray-100'
                        }`}
                        disabled={replyLikeLoading[reply._id]}
                      >
                        👍 Like {reply.likes?.length > 0 && `(${reply.likes.length})`}
                      </button>
                      <button
                        onClick={() => handleLikeDislikeReply(reply._id, 'dislike', review._id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                          reply.dislikes?.includes(currentUser?._id) 
                            ? 'bg-red-100 text-red-700' 
                            : 'text-gray-500 hover:bg-gray-100'
                        }`}
                        disabled={replyLikeLoading[reply._id]}
                      >
                        👎 Dislike {reply.dislikes?.length > 0 && `(${reply.dislikes.length})`}
                      </button>
                    </div>
                  </div>
                ))}
                
                {/* Reply form */}
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <ReplyForm reviewId={review._id} onReplyAdded={() => fetchReplies(review._id)} />
                </div>
              </div>
            )}
            
            {/* Show reply form if no replies exist */}
            {(!replies[review._id] || replies[review._id].length === 0) && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <ReplyForm reviewId={review._id} onReplyAdded={() => fetchReplies(review._id)} />
              </div>
            )}
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

// Add CSS animations
const styles = `
  @keyframes slideDown {
    from { 
      opacity: 0; 
      transform: translateY(-10px);
    }
    to { 
      opacity: 1; 
      transform: translateY(0);
    }
  }
  .animate-slideDown {
    animation: slideDown 0.3s ease-out;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
} 