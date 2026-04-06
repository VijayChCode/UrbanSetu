import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaHeadset, FaTimes, FaCheck, FaReply, FaEnvelope, FaClock, FaUser, FaEye, FaTrash, FaPaperPlane, FaSearch, FaFilter, FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';
import UrbanSetuSpinner from './UrbanSetuSpinner';
import { toast } from 'react-toastify';
import ConfirmationModal from './ConfirmationModal';
import ImagePreview from './ImagePreview';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;


import { authenticatedFetch } from '../utils/auth';

export default function AdminContactSupport({ forceModalOpen = false, onModalClose = null }) {
  const [isModalOpen, setIsModalOpen] = useState(forceModalOpen);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyLoading, setReplyLoading] = useState(false);
  const { currentUser } = useSelector((state) => state.user);
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [previewImages, setPreviewImages] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  // Filter and Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all, unread, read, replied
  const [dateSort, setDateSort] = useState("desc"); // desc, asc
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const today = new Date().toISOString().split("T")[0];

  // Handle force modal opening
  useEffect(() => {
    if (forceModalOpen) {
      setIsModalOpen(true);
    }
  }, [forceModalOpen]);

  // Check if user is admin
  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin');

  // Function to get icon color based on current route
  const getIconColor = () => {
    const path = location.pathname;
    const searchParams = new URLSearchParams(location.search);

    // Check if we're on the reset password step (step=2)
    if (path === '/forgot-password' && searchParams.get('step') === '2') {
      return '#059669'; // Emerald for reset password step
    }

    switch (path) {
      case '/sign-in':
        return '#6366f1'; // Indigo for sign-in
      case '/sign-up':
        return '#0891b2'; // Cyan for sign-up
      case '/forgot-password':
        return '#dc2626'; // Red for verification step
      default:
        return '#3b82f6'; // Blue for all other pages
    }
  };

  useEffect(() => {
    let interval;
    if (isAdmin) {
      fetchUnreadCount(); // Fetch on mount
      interval = setInterval(fetchUnreadCount, 30000); // Poll every 30s
    }
    return () => interval && clearInterval(interval);
  }, [isAdmin]);

  useEffect(() => {
    if (isModalOpen && isAdmin) {
      fetchMessages();
      fetchUnreadCount();
    }
  }, [isModalOpen, isAdmin]);

  // Scroll lock for modal
  useEffect(() => {
    if (isModalOpen) {
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
  }, [isModalOpen]);

  // Check if user is at the bottom of messages
  const checkIfAtBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 5; // 5px threshold
      setIsAtBottom(atBottom);
    }
  }, []);

  // Add scroll event listener for messages container
  useEffect(() => {
    const messagesContainer = messagesContainerRef.current;
    if (messagesContainer && isModalOpen) {
      messagesContainer.addEventListener('scroll', checkIfAtBottom);
      // Check initial position
      checkIfAtBottom();

      return () => {
        messagesContainer.removeEventListener('scroll', checkIfAtBottom);
      };
    }
  }, [isModalOpen, checkIfAtBottom]);

  // Function to scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const fetchMessages = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/contact/messages`);
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.message || "Failed to fetch messages.");
        setMessages([]);
        return;
      }
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      setError("Network error or server unavailable.");
      setMessages([]);
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/contact/unread-count`);
      const data = await response.json();
      setUnreadCount(data.count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const markAsRead = async (messageId) => {
    try {
      await authenticatedFetch(`${API_BASE_URL}/api/contact/messages/${messageId}/read`, {
        method: 'PUT',
      });

      // Update local state instead of refetching all messages
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg._id === messageId
            ? { ...msg, status: 'read' }
            : msg
        )
      );
      fetchUnreadCount();
      toast.success('Message marked as read');
    } catch (error) {
      console.error('Error marking message as read:', error);
      toast.error('Failed to mark message as read');
    }
  };

  const markAsReplied = async (messageId) => {
    try {
      await authenticatedFetch(`${API_BASE_URL}/api/contact/messages/${messageId}/replied`, {
        method: 'PUT',
      });

      // Update local state instead of refetching all messages
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg._id === messageId
            ? { ...msg, status: 'replied' }
            : msg
        )
      );
      fetchUnreadCount();
      toast.success('Message marked as replied');
    } catch (error) {
      console.error('Error marking message as replied:', error);
      toast.error('Failed to mark message as replied');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    setMessageToDelete(messageId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!messageToDelete) return;

    setIsDeleting(true);
    try {
      await authenticatedFetch(`${API_BASE_URL}/api/contact/messages/${messageToDelete}`, {
        method: 'DELETE',
      });

      // Update local state instead of refetching all messages
      setMessages(prevMessages =>
        prevMessages.filter(msg => msg._id !== messageToDelete)
      );
      fetchUnreadCount();
      toast.success('Message deleted successfully!');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setMessageToDelete(null);
    }
  };

  const handleConfirmDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
      const msgs = [...messages];
      for (const msg of msgs) {
        try {
          await authenticatedFetch(`${API_BASE_URL}/api/contact/messages/${msg._id}`, {
            method: 'DELETE',
          });
        } catch (_) { /* ignore individual failures */ }
      }
      setMessages([]);
      fetchUnreadCount();
      toast.success('All messages deleted successfully!');
    } catch (error) {
      console.error('Error deleting all messages:', error);
      toast.error('Failed to delete all messages. Please try again.');
    } finally {
      setIsDeletingAll(false);
      setShowDeleteAllConfirm(false);
    }
  };

  const sendReply = async (messageId) => {
    if (!replyMessage.trim()) {
      toast.error('Please enter a reply message');
      return;
    }

    setReplyLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/contact/messages/${messageId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ replyMessage: replyMessage.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        setReplyMessage("");
        setReplyingTo(null);

        // Update local state instead of refetching all messages
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg._id === messageId
              ? { ...msg, adminReply: replyMessage.trim(), status: 'replied' }
              : msg
          )
        );
        fetchUnreadCount();
        toast.success('Reply sent successfully!');
      } else {
        toast.error('Failed to send reply. Please try again.');
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply. Please try again.');
    } finally {
      setReplyLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      unread: {
        color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
        text: 'Unread',
        icon: <FaEnvelope className="w-3 h-3" />
      },
      read: {
        color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        text: 'Read',
        icon: <FaEye className="w-3 h-3" />
      },
      replied: {
        color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800',
        text: 'Replied',
        icon: <FaReply className="w-3 h-3" />
      }
    };
    const config = statusConfig[status] || statusConfig.unread;
    return (
      <span className={`px-3 py-1 text-xs font-medium rounded-full border flex items-center gap-1 ${config.color}`}>
        {config.icon}
        {config.text}
      </span>
    );
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    if (onModalClose) {
      onModalClose();
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now - date;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  };

  // Filter messages logic
  const filteredMessages = messages.filter(msg => {
    // Status filter
    if (statusFilter !== 'all' && msg.status !== statusFilter) return false;

    // Date range filter
    const msgDate = new Date(msg.createdAt);
    if (startDate && msgDate < new Date(startDate)) return false;
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (msgDate > end) return false;
    }

    // Search filter
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      const searchableFields = [
        msg.name || '',
        msg.email || '',
        msg.subject || '',
        msg.message || '',
        msg.ticketId || ''
      ];
      return searchableFields.some(field => field.toLowerCase().includes(lowerSearch));
    }

    return true;
  }).sort((a, b) => {
    const dateA = new Date(a.createdAt);
    const dateB = new Date(b.createdAt);
    return dateSort === 'desc' ? dateB - dateA : dateA - dateB;
  });

  // Don't render if not admin
  if (!isAdmin) {
    return null;
  }

  return (
    <>
      {/* Enhanced Floating Contact Button */}
      <div className="fixed bottom-6 right-6 z-[9999]">
        <button
          onClick={() => setIsModalOpen(true)}
          className="relative group w-12 h-12 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 hover:rotate-12 flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${getIconColor()}, ${getIconColor()}dd)`,
            boxShadow: `0 10px 25px ${getIconColor()}40`
          }}
          title="View support messages"
        >
          {/* Animated background ring */}
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{
              border: `3px solid ${getIconColor()}55`, // semi-transparent color
            }}
          ></div>

          {/* Icon */}
          <FaHeadset className="w-5 h-5 text-white drop-shadow-lg" />

          {/* Unread count badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}

          {/* Enhanced Hover Tooltip */}
          <div className="absolute bottom-full right-0 mb-3 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm px-4 py-2 rounded-xl shadow-2xl hidden group-hover:block z-10 whitespace-nowrap border border-gray-100 dark:border-gray-700 transform -translate-y-1 transition-all duration-200">
            <div className="flex items-center gap-2">
              <span className="text-lg">📬</span>
              <span className="font-medium">
                {unreadCount > 0 ? `${unreadCount} new message${unreadCount !== 1 ? 's' : ''}` : 'Support Messages'}
              </span>
            </div>
            {/* Tooltip arrow */}
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white dark:border-t-gray-800"></div>
          </div>
        </button>
      </div>

      {/* Enhanced Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-slideUp transition-colors">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-t-2xl transition-colors">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: getIconColor() }}
                >
                  <FaHeadset className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Support Messages</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {unreadCount} unread message{unreadCount !== 1 ? 's' : ''} • {filteredMessages.length} total
                    {filteredMessages.length !== messages.length && (
                      <span className="text-blue-500 font-medium ml-1">
                        ({filteredMessages.length} found)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <button
                    onClick={() => setShowDeleteAllConfirm(true)}
                    className="text-red-500 hover:text-red-700 transition-colors p-2 hover:bg-red-50 rounded-full"
                    title="Delete all messages"
                  >
                    <FaTrash className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleModalClose}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filters Section */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 items-center">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px]">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Search by name, email, subject, ticket ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm text-gray-900 dark:text-gray-100"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <FaTimes className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <FaFilter className="text-gray-400 text-sm" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">All Status</option>
                  <option value="unread">Unread</option>
                  <option value="read">Read</option>
                  <option value="replied">Replied</option>
                </select>
              </div>

              {/* Sort Order */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDateSort(dateSort === 'desc' ? 'asc' : 'desc')}
                  className="flex items-center gap-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-gray-900 dark:text-gray-100"
                >
                  {dateSort === 'desc' ? (
                    <>
                      <FaSortAmountDown className="text-blue-500" />
                      <span>Newest First</span>
                    </>
                  ) : (
                    <>
                      <FaSortAmountUp className="text-blue-500" />
                      <span>Oldest First</span>
                    </>
                  )}
                </button>
              </div>

              {/* Date Filters */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">From:</span>
                <input
                  type="date"
                  value={startDate}
                  max={today}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">To:</span>
                <input
                  type="date"
                  value={endDate}
                  max={today}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Reset Filters */}
              {(searchTerm || statusFilter !== 'all' || dateSort !== 'desc' || startDate || endDate) && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                    setDateSort("desc");
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  Reset Filters
                </button>
              )}
            </div>

            {/* Content */}
            <div ref={messagesContainerRef} className="overflow-y-auto max-h-[calc(90vh-120px)] relative">
              {error && (
                <div className="p-6 text-center text-red-600 dark:text-red-400 font-semibold bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl mb-4">
                  {error}
                </div>
              )}
              {loading ? (
                <div className="p-12 text-center">
                  <UrbanSetuSpinner size="lg" className="mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <FaHeadset className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h4 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-200">No messages yet</h4>
                  <p className="text-sm">Support messages from users will appear here</p>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <FaSearch className="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-medium mb-2">No messages match your filters</h4>
                  <p className="text-sm">Try adjusting your search or filter criteria</p>
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("all");
                      setStartDate("");
                      setEndDate("");
                    }}
                    className="mt-4 text-blue-500 font-semibold hover:underline"
                  >
                    Clear all filters
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredMessages.map((message) => (
                    <div
                      key={message._id}
                      className={`p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 cursor-pointer ${message.status === 'unread' ? 'bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-500' : 'dark:border-l-4 dark:border-transparent'
                        } ${selectedMessage?._id === message._id ? 'bg-blue-100 dark:bg-blue-900/20' : ''}`}
                      onClick={() => setSelectedMessage(selectedMessage?._id === message._id ? null : message)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{message.subject}</h4>
                                {message.ticketId && (
                                  <span className="text-xs font-mono bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 px-2 py-1 rounded flex-shrink-0">
                                    {message.ticketId}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <FaUser className="w-3 h-3 text-gray-400" />
                                <span className="text-sm text-gray-600 dark:text-gray-400">{message.name || 'Anonymous'}</span>
                                <span className="text-gray-400">•</span>
                                <FaEnvelope className="w-3 h-3 text-gray-400" />
                                <span className="text-sm text-gray-600 dark:text-gray-400">{message.email}</span>
                              </div>
                            </div>
                            {getStatusBadge(message.status)}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <FaClock className="w-3 h-3" />
                              {formatDate(message.createdAt)}
                            </div>
                          </div>

                          {/* Message preview */}
                          <p className="text-gray-700 dark:text-gray-300 mt-3 line-clamp-2">
                            {message.message}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 mt-4">
                        {message.status === 'unread' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(message._id);
                            }}
                            className="px-3 py-1 text-xs text-white rounded-lg transition-all duration-200 flex items-center gap-1 hover:scale-105"
                            style={{ backgroundColor: getIconColor() }}
                          >
                            <FaEye className="w-3 h-3" />
                            Mark Read
                          </button>
                        )}
                        {message.status !== 'replied' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsReplied(message._id);
                            }}
                            className="px-3 py-1 text-xs text-white rounded-lg transition-all duration-200 flex items-center gap-1 hover:scale-105"
                            style={{ backgroundColor: getIconColor() }}
                          >
                            <FaReply className="w-3 h-3" />
                            Mark Replied
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMessage(message._id);
                          }}
                          className="px-3 py-1 text-xs text-white bg-red-500 rounded-lg transition-all duration-200 flex items-center gap-1 hover:scale-105 hover:bg-red-700"
                        >
                          <FaTrash className="w-3 h-3" />
                          Delete
                        </button>
                      </div>

                      {/* Expanded message view */}
                      {selectedMessage?._id === message._id && (
                        <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-xl animate-slideDown">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <h5 className="font-medium text-gray-900 dark:text-gray-100">Full Message</h5>
                              {message.ticketId && (
                                <span className="text-xs font-mono bg-purple-200 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200 px-2 py-1 rounded">
                                  Ticket: {message.ticketId}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(message.createdAt).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </span>
                          </div>
                          <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border dark:border-gray-600 mb-4">
                            <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                              {message.message}
                            </p>
                            {/* Attachments Display */}
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                                <h6 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Attachments</h6>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                  {message.attachments.map((url, i) => (
                                    <div
                                      key={i}
                                      className="block relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-500 hover:opacity-90 transition-opacity bg-gray-50 dark:bg-gray-800 cursor-pointer"
                                      onClick={() => {
                                        setPreviewImages(message.attachments);
                                        setPreviewIndex(i);
                                      }}
                                    >
                                      <img src={url} alt={`Attachment ${i + 1}`} className="w-full h-full object-cover" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Admin Reply Section */}
                          {message.adminReply && (
                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-2">
                                <h6 className="font-medium text-green-700 dark:text-green-400">Admin Reply</h6>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(message.adminReplyAt).toLocaleString('en-GB', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                  })}
                                </span>
                              </div>
                              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                                  {message.adminReply}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Reply Form */}
                          {!message.adminReply && (
                            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-between">
                                <h6 className="font-medium text-blue-700 dark:text-blue-400">Send Reply</h6>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReplyingTo(replyingTo === message._id ? null : message._id);
                                  }}
                                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                >
                                  {replyingTo === message._id ? 'Cancel' : 'Reply'}
                                </button>
                              </div>

                              {replyingTo === message._id && (
                                <div className="space-y-3">
                                  <textarea
                                    value={replyMessage}
                                    onChange={(e) => setReplyMessage(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    onFocus={(e) => e.stopPropagation()}
                                    placeholder="Type your reply here..."
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    rows="4"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        sendReply(message._id);
                                      }}
                                      disabled={replyLoading}
                                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 admin-contact-support-action-btn"
                                    >
                                      {replyLoading ? (
                                        <>
                                          <UrbanSetuSpinner size="sm" isBright={true} />
                                          Sending...
                                        </>
                                      ) : (
                                        <>
                                          <FaPaperPlane className="w-4 h-4" />
                                          Send Reply
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setReplyingTo(null);
                                        setReplyMessage("");
                                      }}
                                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 admin-contact-support-action-btn"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Floating Scroll to bottom button - WhatsApp style */}
            {!isAtBottom && filteredMessages.length > 0 && (
              <div className="absolute bottom-6 right-6 z-20">
                <button
                  onClick={scrollToBottom}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-110 animate-pulse"
                  title="Scroll to bottom"
                  aria-label="Scroll to bottom"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="transform"
                  >
                    <path d="M12 16l-6-6h12l-6 6z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { 
            opacity: 0; 
            transform: translateY(20px) scale(0.95);
          }
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1);
          }
        }

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
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }

        .animate-slideDown {
          animation: slideDown 0.2s ease-out;
        }
        
        .shadow-3xl {
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        /* Mobile button size reduction for Send/Cancel in admin contact support */
        @media (max-width: 640px) {
          .admin-contact-support-action-btn {
            padding: 0.5rem 0.75rem !important;
            font-size: 0.95rem !important;
            border-radius: 0.75rem !important;
          }
        }
      `}</style>

      {/* Confirmation Modal for Message Deletion */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setMessageToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Message"
        message="Are you sure you want to delete this message? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
      />

      {/* Confirmation Modal for Delete All Messages */}
      <ConfirmationModal
        isOpen={showDeleteAllConfirm}
        onClose={() => setShowDeleteAllConfirm(false)}
        onConfirm={handleConfirmDeleteAll}
        title="Delete All Messages"
        message="Are you sure you want to delete all support messages? This action cannot be undone."
        confirmText="Delete All"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={isDeletingAll}
      />

      {/* Image Preview Modal */}
      {previewImages && (
        <ImagePreview
          isOpen={!!previewImages}
          onClose={() => {
            setPreviewImages(null);
            setPreviewIndex(0);
          }}
          images={previewImages}
          initialIndex={previewIndex}
        />
      )}
    </>
  );
}
