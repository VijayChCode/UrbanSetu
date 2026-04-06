import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { FaStar, FaCheck, FaTimes, FaTrash, FaEye, FaUndo, FaBan, FaSort, FaSortUp, FaSortDown, FaCalendarAlt, FaCheckCircle, FaThumbsUp, FaReply, FaSync, FaHome, FaUser, FaChartLine, FaChartBar, FaChartPie, FaArrowUp, FaArrowDown, FaUsers, FaComments, FaExclamationTriangle, FaFlag } from 'react-icons/fa';
import { socket } from '../utils/socket';
import { toast } from 'react-toastify';
import UserAvatar from '../components/UserAvatar';
import AdminReviewsSkeleton from '../components/skeletons/AdminReviewsSkeleton';
import ContactSupportWrapper from '../components/ContactSupportWrapper';
import { authenticatedFetch } from '../utils/auth';
import axios from 'axios';

import { usePageTitle } from '../hooks/usePageTitle';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminReviews() {
  // Set page title
  usePageTitle("Review Management - Content Moderation");

  const { currentUser } = useSelector((state) => state.user);

  // Helper function to check if avatar is valid
  const isValidAvatar = (avatar) => {
    return avatar && avatar.trim() && avatar !== 'null' && avatar !== 'undefined' && avatar !== '';
  };
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState(null);
  const [responseEdit, setResponseEdit] = useState({});
  const [responseLoading, setResponseLoading] = useState({});
  const [responseError, setResponseError] = useState({});
  const [search, setSearch] = useState('');

  // Status Confirmation Modal State
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false);
  const [reviewToUpdateStatus, setReviewToUpdateStatus] = useState(null);
  const [statusAction, setStatusAction] = useState({ type: '', label: '' });
  const [statusActionNote, setStatusActionNote] = useState('');

  // Analytics state
  const [analytics, setAnalytics] = useState({
    totalReviews: 0,
    pendingReviews: 0,
    approvedReviews: 0,
    rejectedReviews: 0,
    removedReviews: 0,
    averageRating: 0,
    sentiment: {
      positive: 0,
      negative: 0,
      neutral: 0,
      topWords: []
    },
    recentActivity: [],
    topProperties: [],
    topUsers: [],
    ratingDistribution: {},
    monthlyTrends: [],
    responseRate: 0
  });
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Review Reports state
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState('');
  const [reportsFilters, setReportsFilters] = useState({
    dateFrom: '',
    dateTo: '',
    reporter: '',
    search: '',
    sortBy: 'date',
    sortOrder: 'desc'
  });

  useEffect(() => {
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) {
      fetchReviews();
      fetchAnalytics();
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

  // Ensure page opens at top
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch { }
  }, []);

  // Scroll lock for modals: lock body scroll when any modal is open (mobile and desktop)
  useEffect(() => {
    if (selectedReview || (showRemovalModal && reviewToRemove) || (showDeleteModal && reviewToDelete) || showReportsModal) {
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
  }, [selectedReview, showRemovalModal, reviewToRemove, showDeleteModal, reviewToDelete, showReportsModal]);

  // Fetch reports only when modal opens
  useEffect(() => {
    if (showReportsModal) {
      fetchReports();
    }
  }, [showReportsModal]);

  // Client-side filtering for immediate UI updates
  useEffect(() => {
    if (reports.length === 0) {
      setFilteredReports([]);
      return;
    }

    let filtered = [...reports];

    // Apply search filter
    if (reportsFilters.search) {
      const searchTerm = reportsFilters.search.toLowerCase();
      filtered = filtered.filter(report =>
        report.propertyName?.toLowerCase().includes(searchTerm) ||
        report.reporter?.toLowerCase().includes(searchTerm) ||
        report.reporterEmail?.toLowerCase().includes(searchTerm) ||
        report.reporterPhone?.toLowerCase().includes(searchTerm) ||
        report.category?.toLowerCase().includes(searchTerm) ||
        report.details?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply reporter filter
    if (reportsFilters.reporter) {
      const reporterTerm = reportsFilters.reporter.toLowerCase();
      filtered = filtered.filter(report =>
        report.reporter?.toLowerCase().includes(reporterTerm)
      );
    }

    // Apply date filters
    if (reportsFilters.dateFrom) {
      const fromDate = new Date(reportsFilters.dateFrom);
      filtered = filtered.filter(report =>
        new Date(report.createdAt) >= fromDate
      );
    }

    if (reportsFilters.dateTo) {
      const toDate = new Date(reportsFilters.dateTo);
      toDate.setHours(23, 59, 59, 999); // Include entire day
      filtered = filtered.filter(report =>
        new Date(report.createdAt) <= toDate
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (reportsFilters.sortBy) {
        case 'reporter':
          aValue = a.reporter || '';
          bValue = b.reporter || '';
          break;
        case 'property':
          aValue = a.propertyName || '';
          bValue = b.propertyName || '';
          break;
        case 'category':
          aValue = a.category || '';
          bValue = b.category || '';
          break;
        case 'date':
        default:
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
      }

      if (reportsFilters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredReports(filtered);
  }, [reports, reportsFilters]);

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

      const res = await authenticatedFetch(`${API_BASE_URL}/api/review/admin/all?${params}`);

      const data = await res.json();

      if (res.ok) {
        // Ensure latest reviews appear at top even if API doesn't sort correctly
        const sorted = Array.isArray(data.reviews) ? [...data.reviews].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];
        setReviews(sorted);
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

  const fetchAnalytics = async () => {
    try {
      // Fetch review statistics
      const statsRes = await authenticatedFetch(`${API_BASE_URL}/api/review/admin/stats`);
      const stats = await statsRes.json();

      // Fetch all reviews for analytics
      const allReviewsRes = await authenticatedFetch(`${API_BASE_URL}/api/review/admin/all?limit=1000&sort=date&order=desc`);
      const allReviewsData = await allReviewsRes.json();
      const allReviews = allReviewsData.reviews || allReviewsData || [];

      // Calculate rating distribution
      const ratingDistribution = {};
      allReviews.forEach(review => {
        const rating = review.rating || 0;
        ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
      });

      // Calculate monthly trends
      const monthlyTrends = {};
      allReviews.forEach(review => {
        const month = new Date(review.createdAt).toISOString().substring(0, 7);
        monthlyTrends[month] = (monthlyTrends[month] || 0) + 1;
      });



      // Top properties by review count
      const propertyCounts = {};
      allReviews.forEach(review => {
        if (review.listingId) {
          const propId = typeof review.listingId === 'object' ? review.listingId._id : review.listingId;
          const propName = typeof review.listingId === 'object' ? review.listingId.name : 'Unknown Property';
          if (!propertyCounts[propId]) {
            propertyCounts[propId] = { name: propName, count: 0, avgRating: 0, totalRating: 0 };
          }
          propertyCounts[propId].count++;
          propertyCounts[propId].totalRating += review.rating || 0;
        }
      });

      // Calculate average ratings for properties
      Object.values(propertyCounts).forEach(prop => {
        prop.avgRating = prop.totalRating / prop.count;
      });

      const topProperties = Object.values(propertyCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Top users by review count
      const userCounts = {};
      allReviews.forEach(review => {
        const userId = review.userId;
        const userName = review.userName || 'Unknown User';
        if (!userCounts[userId]) {
          userCounts[userId] = { name: userName, count: 0, avgRating: 0, totalRating: 0 };
        }
        userCounts[userId].count++;
        userCounts[userId].totalRating += review.rating || 0;
      });

      Object.values(userCounts).forEach(user => {
        user.avgRating = user.totalRating / user.count;
      });

      const topUsers = Object.values(userCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Calculate response rate
      const reviewsWithResponses = allReviews.filter(review => review.ownerResponse && review.ownerResponse.trim());
      const responseRate = allReviews.length > 0 ? (reviewsWithResponses.length / allReviews.length) * 100 : 0;

      // Sentiment Analysis: same logic as AdminDashboard
      const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'nice', 'helpful', 'fast', 'clean', 'spacious', 'recommended', 'recommend'];
      const negativeWords = ['bad', 'poor', 'terrible', 'awful', 'hate', 'dirty', 'small', 'slow', 'rude', 'noisy', 'not recommended', 'worst'];
      let pos = 0, neg = 0, neu = 0;
      const wordFreq = {};

      // Use only approved reviews for sentiment analysis (same as AdminDashboard)
      const approvedReviews = allReviews.filter(r => r.status === 'approved');
      approvedReviews.forEach(r => {
        const text = (r.comment || '').toLowerCase();
        if (!text.trim()) { neu++; return; }
        let score = 0;
        positiveWords.forEach(w => { if (text.includes(w)) score++; });
        negativeWords.forEach(w => { if (text.includes(w)) score--; });
        if (score > 0) pos++; else if (score < 0) neg++; else neu++;
        text.split(/[^a-zA-Z]+/).forEach(t => { if (t.length > 3) wordFreq[t] = (wordFreq[t] || 0) + 1; });
      });

      const topWords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, count]) => ({ word, count }));

      setAnalytics({
        totalReviews: stats.totalReviews || allReviews.length,
        pendingReviews: stats.pendingReviews || 0,
        approvedReviews: allReviews.filter(r => r.status === 'approved').length,
        rejectedReviews: allReviews.filter(r => r.status === 'rejected').length,
        removedReviews: allReviews.filter(r => r.status === 'removed' || r.status === 'removed_by_user').length,
        averageRating: stats.averageRating || 0,
        sentiment: {
          positive: pos,
          negative: neg,
          neutral: neu,
          topWords: topWords
        },
        recentActivity: allReviews.slice(0, 10),
        topProperties,
        topUsers,
        ratingDistribution,
        monthlyTrends: Object.entries(monthlyTrends)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, count]) => ({ month, count })),
        responseRate
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const handleStatusChange = async (reviewId, newStatus, adminNote = '') => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/review/admin/status/${reviewId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const res = await authenticatedFetch(`${API_BASE_URL}/api/review/admin/remove/${reviewToRemove._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const res = await authenticatedFetch(`${API_BASE_URL}/api/review/admin/restore/${reviewId}`, {
        method: 'PUT',
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

  const handleDeleteReview = () => {
    if (reviewToDelete) {
      setReviews(reviews.filter(r => r._id !== reviewToDelete._id));
      setShowDeleteModal(false);
      setReviewToDelete(null);
      toast.success('Review deleted from table successfully');
    }
  };

  const handleOwnerResponseChange = (reviewId, value) => {
    setResponseEdit((prev) => ({ ...prev, [reviewId]: value }));
  };

  const handleOwnerResponseSubmit = async (reviewId, listingOwnerId) => {
    setResponseLoading((prev) => ({ ...prev, [reviewId]: true }));
    setResponseError((prev) => ({ ...prev, [reviewId]: '' }));
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/review/respond/${reviewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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

  const handleViewReview = (review) => {
    setSelectedReview(review);
  };

  const handleOpenRemoveModal = (review) => {
    setReviewToRemove(review);
    setRemovalReason('');
    setRemovalNote('');
    setShowRemovalModal(true);
  };

  const handleOpenStatusConfirmModal = (review, type) => {
    setReviewToUpdateStatus(review);
    setStatusAction({
      type: type,
      label: type === 'approved' ? 'Approve' : 'Reject'
    });
    setStatusActionNote('');
    setShowStatusConfirmModal(true);
  };

  const confirmStatusChange = () => {
    if (reviewToUpdateStatus && statusAction.type) {
      handleStatusChange(reviewToUpdateStatus._id, statusAction.type, statusActionNote);
      setShowStatusConfirmModal(false);
      setReviewToUpdateStatus(null);
      setStatusAction({ type: '', label: '' });
      setStatusActionNote('');
    }
  };

  const renderStars = (rating) => {
    return [...Array(5)].map((_, index) => (
      <FaStar
        key={index}
        className={`text-sm ${index < rating ? 'text-yellow-400' : 'text-gray-300'
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

  // Fetch review reports
  const fetchReports = async () => {
    try {
      setReportsLoading(true);
      setReportsError('');

      const params = new URLSearchParams();
      if (reportsFilters.dateFrom) params.append('dateFrom', reportsFilters.dateFrom);
      if (reportsFilters.dateTo) params.append('dateTo', reportsFilters.dateTo);
      if (reportsFilters.reporter) params.append('reporter', reportsFilters.reporter);
      if (reportsFilters.search) params.append('search', reportsFilters.search);
      params.append('sortBy', reportsFilters.sortBy);
      params.append('sortOrder', reportsFilters.sortOrder);



      const res = await authenticatedFetch(`${API_BASE_URL}/api/notifications/reports/reviews?${params}`);
      const data = await res.json();



      if (data.success) {
        setReports(data.reports || []);
      } else {
        setReportsError(data.message || 'Failed to load reports');
        console.error('Reports API error:', data.message);
      }
    } catch (error) {
      setReportsError('Network error while loading reports');
      console.error('Reports fetch error:', error);
    } finally {
      setReportsLoading(false);
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
    return <AdminReviewsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 py-4 sm:py-10 px-1 sm:px-2 md:px-8 animate-fadeIn transition-colors duration-300">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="max-w-full sm:max-w-3xl md:max-w-6xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-2 sm:p-4 md:p-8 animate-slideUp transition-colors duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-8 gap-4">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-blue-700 dark:text-white drop-shadow animate-fade-in">Review Management</h1>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition text-sm sm:text-base ${showAnalytics
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              title="Toggle Analytics"
            >
              <FaChartLine />
              <span className="hidden sm:inline">Analytics</span>
            </button>
            <button
              onClick={() => {
                setShowReportsModal(true);
                fetchReports();
              }}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 transition shadow text-sm sm:text-base"
              title="View Review Reports"
            >
              <FaFlag />
              <span className="hidden sm:inline">Reports</span>
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow text-sm sm:text-base min-w-[100px]"
              title="Refresh reviews"
            >
              {loading ? (
                <UrbanSetuSpinner size="sm" isBright={true} />
              ) : (
                <FaSync />
              )}
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Analytics Dashboard */}
        {showAnalytics && (
          <div className="mb-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-700 rounded-xl p-6 border border-blue-200 dark:border-gray-600 transition-colors">
            <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-300 mb-6 flex items-center gap-2">
              <FaChartBar className="text-blue-600" />
              Review Analytics & Insights
            </h2>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Reviews</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{analytics.totalReviews}</p>
                  </div>
                  <FaComments className="text-2xl text-blue-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{analytics.pendingReviews}</p>
                  </div>
                  <FaExclamationTriangle className="text-2xl text-yellow-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Approved</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{analytics.approvedReviews}</p>
                  </div>
                  <FaCheck className="text-2xl text-green-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Avg Rating</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{analytics.averageRating.toFixed(1)}</p>
                  </div>
                  <FaStar className="text-2xl text-purple-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Response Rate</p>
                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{analytics.responseRate.toFixed(1)}%</p>
                  </div>
                  <FaReply className="text-2xl text-indigo-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Removed</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{analytics.removedReviews}</p>
                  </div>
                  <FaBan className="text-2xl text-red-500" />
                </div>
              </div>
            </div>

            {/* Sentiment Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm transition-colors">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                  <FaChartPie className="text-green-600" />
                  Sentiment Analysis
                </h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Positive</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{analytics.sentiment.positive}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Neutral</p>
                    <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{analytics.sentiment.neutral}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Negative</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{analytics.sentiment.negative}</p>
                  </div>
                </div>
                {analytics.sentiment.topWords.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Top Words</h4>
                    <div className="flex flex-wrap gap-2">
                      {analytics.sentiment.topWords.slice(0, 8).map((word, idx) => (
                        <span key={idx} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full">
                          {word.word} ({word.count})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm transition-colors">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                  <FaChartBar className="text-blue-600" />
                  Rating Distribution
                </h3>
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map(rating => {
                    const count = analytics.ratingDistribution[rating] || 0;
                    const percentage = analytics.totalReviews > 0 ? (count / analytics.totalReviews) * 100 : 0;
                    return (
                      <div key={rating} className="flex items-center gap-3">
                        <div className="flex items-center gap-1 w-8">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{rating}</span>
                          <FaStar className="text-yellow-400 text-xs" />
                        </div>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Top Properties and Users */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm transition-colors">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                  <FaHome className="text-purple-600" />
                  Top Reviewed Properties
                </h3>
                {analytics.topProperties.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.topProperties.map((property, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{property.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              <FaStar className="text-yellow-400 text-sm" />
                              <span className="text-sm text-gray-600 dark:text-gray-400">{property.avgRating.toFixed(1)}</span>
                            </div>
                            <span className="text-sm text-gray-500 dark:text-gray-500">•</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">{property.count} reviews</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">No data available</p>
                )}
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm transition-colors">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                  <FaUsers className="text-indigo-600" />
                  Most Active Reviewers
                </h3>
                {analytics.topUsers.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.topUsers.map((user, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{user.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              <FaStar className="text-yellow-400 text-sm" />
                              <span className="text-sm text-gray-600 dark:text-gray-400">{user.avgRating.toFixed(1)} avg</span>
                            </div>
                            <span className="text-sm text-gray-500 dark:text-gray-400">•</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">{user.count} reviews</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">No data available</p>
                )}
              </div>
            </div>

            {/* Monthly Trends */}
            {analytics.monthlyTrends.length > 0 && (
              <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm transition-colors">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <FaArrowUp className="text-green-600 dark:text-green-400" />
                  Monthly Review Trends
                </h3>
                <div className="flex items-end gap-2 h-32">
                  {analytics.monthlyTrends.map((trend, idx) => {
                    const maxCount = Math.max(...analytics.monthlyTrends.map(t => t.count)) || 1;
                    const height = (trend.count / maxCount) * 100;
                    return (
                      <div key={idx} className="flex flex-col items-center flex-1">
                        <div
                          className="w-full bg-gradient-to-t from-blue-500 to-purple-500 rounded-t transition-all duration-300"
                          style={{ height: `${height}%` }}
                          title={`${trend.month}: ${trend.count} reviews`}
                        ></div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 transform -rotate-45 origin-left">
                          {trend.month.split('-')[1]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Search Box */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
          <input
            type="text"
            placeholder="Search by user email, name, property name, city, state, stars, comment, admin note, or review date..."
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 w-full sm:w-1/2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors"
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
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="removed">Removed</option>
            </select>

            <div className="flex flex-wrap items-center gap-2 w-full">
              <span className="text-sm text-gray-600 dark:text-gray-400">Sort:</span>
              <button
                onClick={() => handleSort('date')}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Date {getSortIcon('date')}
              </button>
              <button
                onClick={() => handleSort('rating')}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Rating {getSortIcon('rating')}
              </button>
              <button
                onClick={() => handleSort('helpful')}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
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
          <div className="space-y-4">
            {filteredReviews.map((review, index) => (
              <div
                key={review._id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
                style={{ animation: `fadeIn 0.2s ease-out ${index * 0.03}s backwards` }}
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 md:p-6">
                  {/* Column 1: User & Property Info (4 cols) */}
                  <div className="md:col-span-4 flex flex-row md:flex-col gap-4">
                    <div className="flex items-start gap-4">
                      <UserAvatar
                        user={{ username: review.userName, avatar: review.userAvatar }}
                        size="w-12 h-12"
                        textSize="text-base"
                        showBorder={false}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {review.userName}
                          </h4>
                          {review.isVerified && (
                            <FaCheckCircle className="text-blue-500 text-sm flex-shrink-0" title="Verified user" />
                          )}
                        </div>

                        {review.listingId ? (
                          <div className="text-sm">
                            <a
                              href={`/admin/listing/${typeof review.listingId === 'object' ? review.listingId._id : review.listingId}`}
                              className="font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors block truncate"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {review.listingId.name}
                            </a>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                              {review.listingId.city}, {review.listingId.state}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Property not found</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Rating & Content (4 cols) */}
                  <div className="md:col-span-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex text-yellow-400 text-sm">
                        {renderStars(review.rating)}
                      </div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        ({review.rating})
                      </span>
                      {review.verifiedByBooking && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          Booked
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 leading-relaxed">
                      "{review.comment}"
                    </p>

                    {review.helpfulCount > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-auto">
                        <FaThumbsUp size={12} />
                        <span>{review.helpfulCount} found this helpful</span>
                      </div>
                    )}
                  </div>

                  {/* Column 3: Status & Metadata (2 cols) */}
                  <div className="md:col-span-2 flex flex-row md:flex-col items-center md:items-start justify-between md:justify-start gap-3">
                    <div className="transform scale-90 origin-left">
                      {getStatusBadge(review.status)}
                    </div>

                    <div className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <FaCalendarAlt size={12} />
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Compact Admin Note Badge */}
                    {review.adminNote && (
                      <div
                        className="group relative cursor-help inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium"
                      >
                        Note
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          {review.adminNote}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Column 4: Actions (2 cols) */}
                  <div className="md:col-span-2 flex flex-col justify-start gap-2 border-t md:border-t-0 border-gray-100 dark:border-gray-700 pt-3 md:pt-0">
                    {review.status === 'pending' ? (
                      <div className="flex flex-col gap-2 w-full">
                        <button
                          onClick={() => handleOpenStatusConfirmModal(review, 'approved')}
                          className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors shadow-sm font-medium"
                          title="Approve"
                        >
                          <FaCheck size={14} /> Approve
                        </button>
                        <button
                          onClick={() => handleOpenStatusConfirmModal(review, 'rejected')}
                          className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-red-100 hover:bg-red-200 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 text-sm rounded-lg transition-colors font-medium"
                          title="Reject"
                        >
                          <FaTimes size={14} /> Reject
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 w-full">
                        {/* Review Status Actions */}
                        {review.status !== 'removed' && (
                          <button
                            onClick={() => handleOpenRemoveModal(review)}
                            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 rounded-lg transition-colors"
                          >
                            <FaFlag size={14} /> Remove
                          </button>
                        )}
                        {review.status === 'removed' && (
                          <button
                            onClick={() => handleOpenStatusConfirmModal(review, 'approved')}
                            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-900/20 dark:hover:bg-green-900/40 rounded-lg transition-colors"
                          >
                            <FaUndo size={14} /> Restore
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 w-full mt-1">
                      <button
                        onClick={() => handleViewReview(review)}
                        className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <FaEye size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setReviewToDelete(review);
                          setShowDeleteModal(true);
                        }}
                        className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                        title="Delete Permanently"
                      >
                        <FaTrash size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-2">
            <div className="text-sm text-gray-700 dark:text-gray-200">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  setCurrentPage(Math.max(1, currentPage - 1));
                  toast.info(`Navigated to page ${Math.max(1, currentPage - 1)}`);
                }}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => {
                  setCurrentPage(Math.min(totalPages, currentPage + 1));
                  toast.info(`Navigated to page ${Math.min(totalPages, currentPage + 1)}`);
                }}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto transition-colors"
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-2xl mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto p-0 sm:p-0 relative animate-fadeIn transition-colors">
            {/* Close button top right */}
            <button
              onClick={() => setSelectedReview(null)}
              className="absolute top-3 right-3 text-gray-400 dark:text-gray-200 hover:text-gray-700 dark:hover:text-white bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-2 transition-colors z-10 shadow"
              aria-label="Close"
            >
              <FaTimes className="w-5 h-5" />
            </button>
            {/* Header */}
            <div className="flex flex-col items-center justify-center bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40 rounded-t-2xl px-6 py-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <UserAvatar
                  user={{ username: selectedReview.userName, avatar: selectedReview.userAvatar }}
                  size="w-14 h-14"
                  textSize="text-lg"
                  showBorder={true}
                  className="border-4 border-white shadow-lg"
                />
                <div>
                  <h2 className="text-xl font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                    {selectedReview.userName}
                    {selectedReview.isVerified && (
                      <FaCheckCircle className="text-green-600 text-base" title="Verified user" />
                    )}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{selectedReview.userId?.email}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-col items-center">
                <span className="inline-flex items-center gap-1 text-sm text-purple-700 dark:text-purple-300 font-semibold">
                  <FaStar className="text-yellow-400" />
                  {selectedReview.rating} / 5
                </span>
                <div className="flex gap-1 mt-1">{renderStars(selectedReview.rating)}</div>
              </div>
            </div>
            {/* Body */}
            <div className="px-4 sm:px-8 py-4 space-y-4">
              {/* Property Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 flex flex-col gap-1 border border-blue-100 dark:border-blue-800 transition-colors">
                <div className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <FaHome className="text-blue-400 dark:text-blue-500" />
                  {selectedReview.listingId ? (
                    <a
                      href={`/admin/listing/${selectedReview.listingId._id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                    >
                      {selectedReview.listingId.name}
                    </a>
                  ) : (
                    'Property not found'
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 pl-6">
                  {selectedReview.listingId?.city}, {selectedReview.listingId?.state}
                </div>
              </div>
              {/* Status & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <h4 className="font-medium mb-1 text-gray-700 dark:text-gray-300">Status</h4>
                  {getStatusBadge(selectedReview.status)}
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <h4 className="font-medium mb-1 text-gray-700 dark:text-gray-300">Date</h4>
                  <p className="text-gray-700 dark:text-gray-300">{formatDate(selectedReview.createdAt)}</p>
                </div>
              </div>
              {/* Comment */}
              <div>
                <h4 className="font-medium mb-1 text-gray-700 dark:text-gray-300">Comment</h4>
                <p className="text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-700/50 rounded-md p-3 border border-gray-100 dark:border-gray-700 shadow-inner">{selectedReview.comment}</p>
              </div>
              {/* Helpful Votes */}
              {selectedReview.helpfulCount > 0 && (
                <div>
                  <h4 className="font-medium mb-1 text-gray-700 dark:text-gray-300">Helpful Votes</h4>
                  <div className="flex items-center text-gray-700 dark:text-gray-300">
                    <FaThumbsUp className="mr-2 text-blue-500" />
                    {selectedReview.helpfulCount} people found this helpful
                  </div>
                </div>
              )}
              {/* Verified/Booking */}
              {selectedReview.isVerified && (
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md flex items-center gap-2 border border-green-100 dark:border-green-800">
                  <FaCheckCircle className="text-green-600" />
                  <span className="text-green-800 dark:text-green-300 font-medium">Verified user</span>
                  {selectedReview.verifiedByBooking && (
                    <span className="ml-2 text-xs text-green-700 dark:text-green-400">Booked this property</span>
                  )}
                </div>
              )}
              {/* Admin Note */}
              {selectedReview.adminNote && (
                <div>
                  <h4 className="font-medium mb-1 text-gray-700 dark:text-gray-300">Admin Note</h4>
                  <p className="text-gray-700 dark:text-gray-200 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md border border-yellow-100 dark:border-yellow-800 shadow-inner">{selectedReview.adminNote}</p>
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
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 max-w-xs sm:max-w-md w-full mx-2 sm:mx-4 transition-colors">
            <h2 className="text-xl font-semibold mb-4">Remove Review</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Are you sure you want to remove this review? This action cannot be undone.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Removal Reason *
                </label>
                <select
                  value={removalReason}
                  onChange={(e) => {
                    setRemovalReason(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
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
                }}
                className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && reviewToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 max-w-xs sm:max-w-md w-full mx-2 sm:mx-4 transition-colors">
            <h2 className="text-xl font-semibold mb-4 text-red-600">Delete Review</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Are you sure you want to delete this review from the table? This will only remove it from your current view and won't affect the actual review data.
            </p>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mb-4">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                <strong>Note:</strong> This action only removes the review from your current table view. The review data remains in the database.
              </p>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleDeleteReview}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
              >
                Delete from Table
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setReviewToDelete(null);
                }}
                className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Reports Modal */}
      {showReportsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transition-colors">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 transition-colors">
              <h2 className="text-xl sm:text-2xl font-bold text-red-700 flex items-center gap-2">
                <FaFlag />
                Review Reports
              </h2>
              <button
                onClick={() => setShowReportsModal(false)}
                className="text-gray-400 dark:text-gray-200 hover:text-gray-700 dark:hover:text-white bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-2 transition-colors"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            {/* Filters */}
            <div className="p-2 sm:p-4 lg:p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 transition-colors">
              {/* Mobile: Collapsible filters, Desktop: Always visible */}
              <div className="space-y-3">
                {/* Primary filters - always visible but compact on mobile */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From Date</label>
                    <input
                      type="date"
                      max={new Date().toISOString().split('T')[0]}
                      value={reportsFilters.dateFrom}
                      onChange={(e) => setReportsFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      className="w-full p-1.5 sm:p-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To Date</label>
                    <input
                      type="date"
                      max={new Date().toISOString().split('T')[0]}
                      value={reportsFilters.dateTo}
                      onChange={(e) => setReportsFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      className="w-full p-1.5 sm:p-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reporter</label>
                    <input
                      type="text"
                      placeholder="Reporter"
                      value={reportsFilters.reporter}
                      onChange={(e) => setReportsFilters(prev => ({ ...prev, reporter: e.target.value }))}
                      className="w-full p-1.5 sm:p-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
                    <input
                      type="text"
                      placeholder="Search..."
                      value={reportsFilters.search}
                      onChange={(e) => setReportsFilters(prev => ({ ...prev, search: e.target.value }))}
                      className="w-full p-1.5 sm:p-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                    />
                  </div>
                </div>

                {/* Secondary controls - compact on mobile */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-stretch sm:items-center justify-between">
                  <div className="flex gap-2">
                    <select
                      value={reportsFilters.sortBy}
                      onChange={(e) => setReportsFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                      className="flex-1 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                    >
                      <option value="date">Date</option>
                      <option value="reporter">Reporter</option>
                      <option value="property">Property</option>
                      <option value="category">Category</option>
                    </select>
                    <select
                      value={reportsFilters.sortOrder}
                      onChange={(e) => setReportsFilters(prev => ({ ...prev, sortOrder: e.target.value }))}
                      className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                    >
                      <option value="desc">↓</option>
                      <option value="asc">↑</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setReportsFilters({
                          dateFrom: '',
                          dateTo: '',
                          reporter: '',
                          search: '',
                          sortBy: 'date',
                          sortOrder: 'desc'
                        });
                      }}
                      className="px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
                    >
                      Clear
                    </button>
                    <button
                      onClick={fetchReports}
                      disabled={reportsLoading}
                      className="px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 sm:gap-2"
                    >
                      {reportsLoading ? (
                        <>
                          <UrbanSetuSpinner size="sm" />
                          <span className="hidden sm:inline">Loading...</span>
                        </>
                      ) : (
                        <>
                          <FaSync className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">Refresh</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Reports List */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 lg:p-6 min-h-0">

              {reportsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <UrbanSetuSpinner size="md" />
                  <span className="ml-2 text-gray-600">Loading reports...</span>
                </div>
              ) : reportsError ? (
                <div className="text-center py-8">
                  <div className="text-red-600 mb-2">{reportsError}</div>
                  <button
                    onClick={fetchReports}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                  >
                    Try Again
                  </button>
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="text-center py-8">
                  <FaFlag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">
                    {reports.length === 0 ? 'No review reports found' : 'No reports match your filters'}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {reports.length === 0 ? 'Reports will appear here when users report reviews' : 'Try adjusting your search criteria'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Showing {filteredReports.length} of {reports.length} report{reports.length !== 1 ? 's' : ''}
                  </div>
                  {filteredReports.map((report, index) => (
                    <div key={report.notificationId || index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200">
                              <FaFlag className="mr-1" />
                              Review Report
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(report.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300">Property: </span>
                              <span className="text-gray-900 dark:text-gray-100">{report.propertyName}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Reporter: </span>
                                <span className="text-gray-900 dark:text-gray-100">{report.reporter || report.reporterUsername || 'Unknown'}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Email: </span>
                                <span className="text-gray-900 dark:text-gray-100">{report.reporterEmail || 'Not available'}</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Phone: </span>
                                <span className="text-gray-900 dark:text-gray-100">{report.reporterPhone || 'Not available'}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Role: </span>
                                <span className="text-gray-900 dark:text-gray-100 capitalize">{report.reporterRole || 'Not available'}</span>
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300">Category: </span>
                              <span className="text-gray-900 dark:text-gray-100">{report.category}</span>
                            </div>
                            {report.details && (
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Details: </span>
                                <span className="text-gray-900 dark:text-gray-100">{report.details}</span>
                              </div>
                            )}
                            {report.reviewContent && (
                              <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                                <span className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Reported Review:</span>
                                <p className="text-sm text-gray-600 dark:text-gray-300 italic">"{report.reviewContent}"</p>
                                {report.reviewRating && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Rating: {report.reviewRating}/5</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          {report.listingId && (
                            <a
                              href={`/admin/listing/${report.listingId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition text-center"
                            >
                              View Property
                            </a>
                          )}
                          {report.reviewId && (
                            <button
                              onClick={async () => {
                                try {
                                  // Close report modal momentarily or keep it open? 
                                  const existingReview = reviews.find(r => r._id === report.reviewId);
                                  if (existingReview) {
                                    setSelectedReview(existingReview);
                                    setShowReportsModal(false); // Close reports modal to show review modal
                                  } else {
                                    // Fallback: try to fetch from API listings endpoint
                                    toast.info("Fetching review details...");
                                    const fetchRes = await authenticatedFetch(`${API_BASE_URL}/api/review/listing/${report.listingId}`);
                                    if (fetchRes.ok) {
                                      const listingReviews = await fetchRes.json();
                                      const found = listingReviews.find(r => r._id === report.reviewId);
                                      if (found) {
                                        setSelectedReview(found);
                                        setShowReportsModal(false);
                                      } else {
                                        toast.error("Review details not found in current context.");
                                      }
                                    } else {
                                      toast.error("Failed to fetch review details.");
                                    }
                                  }
                                } catch (error) {
                                  console.error(error);
                                  toast.error("Failed to load review details.");
                                }
                              }}
                              className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition"
                            >
                              View Review
                            </button>
                          )}
                          <a
                            href={report.reporterEmail ? `mailto:${report.reporterEmail}` : '#'}
                            className={`px-3 py-1 text-sm rounded-md transition text-center ${report.reporterEmail
                              ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              }`}
                            onClick={!report.reporterEmail ? (e) => e.preventDefault() : undefined}
                          >
                            Email Reporter
                          </a>
                          <a
                            href={report.reporterPhone ? `tel:${report.reporterPhone}` : '#'}
                            className={`px-3 py-1 text-sm rounded-md transition text-center ${report.reporterPhone
                              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              }`}
                            onClick={!report.reporterPhone ? (e) => e.preventDefault() : undefined}
                          >
                            Call Reporter
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Confirmation Modal */}
      {showStatusConfirmModal && reviewToUpdateStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 max-w-xs sm:max-w-md w-full mx-2 sm:mx-4 transition-colors">
            <h2 className={`text-xl font-semibold mb-4 ${statusAction.type === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
              {statusAction.label} Review
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Are you sure you want to <strong>{statusAction.label.toLowerCase()}</strong> this review?
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Admin Note (Optional)
              </label>
              <textarea
                value={statusActionNote}
                onChange={(e) => setStatusActionNote(e.target.value)}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                placeholder={statusAction.type === 'rejected' ? "Reason for rejection..." : "Add a note..."}
              />
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={confirmStatusChange}
                className={`flex-1 text-white px-4 py-2 rounded-md transition-colors ${statusAction.type === 'approved'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
                  }`}
              >
                Confirm {statusAction.label}
              </button>
              <button
                onClick={() => {
                  setShowStatusConfirmModal(false);
                  setReviewToUpdateStatus(null);
                  setStatusAction({ type: '', label: '' });
                  setStatusActionNote('');
                }}
                className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ContactSupportWrapper />
    </div>
  );
} 