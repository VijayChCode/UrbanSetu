import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { FaHeadset, FaTimes, FaCheck, FaReply, FaEnvelope, FaClock, FaUser, FaEye, FaTrash, FaPaperPlane } from 'react-icons/fa';
import { toast } from 'react-toastify';
import ConfirmationModal from './ConfirmationModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminContactSupport() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyLoading, setReplyLoading] = useState(false);
  const { currentUser } = useSelector((state) => state.user);
  const location = useLocation();
  const [error, setError] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);

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
      const response = await fetch(`${API_BASE_URL}/api/contact/messages`, { credentials: 'include' });
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
      const response = await fetch(`${API_BASE_URL}/api/contact/unread-count`, { credentials: 'include' });
      const data = await response.json();
      setUnreadCount(data.count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const markAsRead = async (messageId) => {
    try {
      await fetch(`${API_BASE_URL}/api/contact/messages/${messageId}/read`, {
        method: 'PUT',
        credentials: 'include',
      });
      fetchMessages();
      fetchUnreadCount();
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const markAsReplied = async (messageId) => {
    try {
      await fetch(`${API_BASE_URL}/api/contact/messages/${messageId}/replied`, {
        method: 'PUT',
        credentials: 'include',
      });
      fetchMessages();
      fetchUnreadCount();
    } catch (error) {
      console.error('Error marking message as replied:', error);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    setMessageToDelete(messageId);
    setShowDeleteModal(true);
  };

  const confirmDeleteMessage = async () => {
    if (!messageToDelete) return;
    try {
      await fetch(`${API_BASE_URL}/api/contact/messages/${messageToDelete}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      fetchMessages();
      fetchUnreadCount();
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const sendReply = async (messageId) => {
    if (!replyMessage.trim()) {
      toast.error('Please enter a reply message');
      return;
    }

    setReplyLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/contact/messages/${messageId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ replyMessage: replyMessage.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        setReplyMessage("");
        setReplyingTo(null);
        fetchMessages();
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
        color: 'bg-red-100 text-red-800 border-red-200', 
        text: 'Unread',
        icon: <FaEnvelope className="w-3 h-3" />
      },
      read: { 
        color: 'bg-blue-100 text-blue-800 border-blue-200', 
        text: 'Read',
        icon: <FaEye className="w-3 h-3" />
      },
      replied: { 
        color: 'bg-green-100 text-green-800 border-green-200', 
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
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  };

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
          className="relative group w-16 h-16 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 hover:rotate-12 flex items-center justify-center"
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
          <FaHeadset className="w-7 h-7 text-white drop-shadow-lg" />
          
          {/* Unread count badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          
          {/* Enhanced Hover Tooltip */}
          <div className="absolute bottom-full right-0 mb-3 bg-white text-gray-800 text-sm px-4 py-2 rounded-xl shadow-2xl hidden group-hover:block z-10 whitespace-nowrap border border-gray-100 transform -translate-y-1 transition-all duration-200">
            <div className="flex items-center gap-2">
              <span className="text-lg">📬</span>
              <span className="font-medium">
                {unreadCount > 0 ? `${unreadCount} new message${unreadCount !== 1 ? 's' : ''}` : 'Support Messages'}
              </span>
            </div>
            {/* Tooltip arrow */}
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
          </div>
        </button>
      </div>

      {/* Enhanced Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-slideUp">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: getIconColor() }}
                >
                  <FaHeadset className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Support Messages</h3>
                  <p className="text-sm text-gray-600">
                    {unreadCount} unread message{unreadCount !== 1 ? 's' : ''} • {messages.length} total
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div ref={messagesContainerRef} className="overflow-y-auto max-h-[calc(90vh-120px)] relative">
              {error && (
                <div className="p-6 text-center text-red-600 font-semibold bg-red-50 border border-red-200 rounded-xl mb-4">
                  {error}
                </div>
              )}
              {loading ? (
                <div className="p-12 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-500 font-medium">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <FaHeadset className="w-10 h-10 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-medium mb-2">No messages yet</h4>
                  <p className="text-sm">Support messages from users will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {messages.map((message) => (
                    <div 
                      key={message._id} 
                      className={`p-6 hover:bg-gray-50 transition-all duration-200 cursor-pointer ${
                        message.status === 'unread' ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      } ${selectedMessage?._id === message._id ? 'bg-blue-100' : ''}`}
                      onClick={() => setSelectedMessage(selectedMessage?._id === message._id ? null : message)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 truncate">{message.subject}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <FaUser className="w-3 h-3 text-gray-400" />
                                <span className="text-sm text-gray-600">{message.name || 'Anonymous'}</span>
                                <span className="text-gray-400">•</span>
                                <FaEnvelope className="w-3 h-3 text-gray-400" />
                                <span className="text-sm text-gray-600">{message.email}</span>
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
                          <p className="text-gray-700 mt-3 line-clamp-2">
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
                        <div className="mt-4 p-4 bg-gray-100 rounded-xl animate-slideDown">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-medium text-gray-900">Full Message</h5>
                            <span className="text-xs text-gray-500">
                              {new Date(message.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="bg-white p-4 rounded-lg border mb-4">
                            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                              {message.message}
                            </p>
                          </div>

                          {/* Admin Reply Section */}
                          {message.adminReply && (
                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-2">
                                <h6 className="font-medium text-green-700">Admin Reply</h6>
                                <span className="text-xs text-gray-500">
                                  {new Date(message.adminReplyAt).toLocaleString()}
                                </span>
                              </div>
                              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                                  {message.adminReply}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Reply Form */}
                          {!message.adminReply && (
                            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-between">
                                <h6 className="font-medium text-blue-700">Send Reply</h6>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReplyingTo(replyingTo === message._id ? null : message._id);
                                  }}
                                  className="text-sm text-blue-600 hover:text-blue-800"
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
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
                                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
            {!isAtBottom && messages.length > 0 && (
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

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteMessage}
        title="Delete Message"
        message="Are you sure you want to delete this message?"
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

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
    </>
  );
} 