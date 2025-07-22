import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { FaHeadset, FaTimes, FaPaperPlane, FaEnvelope, FaUser, FaFileAlt, FaClock, FaTrash } from 'react-icons/fa';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ContactSupport() {
  const { currentUser } = useSelector((state) => state.user);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userMessages, setUserMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [unreadReplies, setUnreadReplies] = useState(0);
  const [activeTab, setActiveTab] = useState('send'); // 'send' or 'messages'
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    email: '',
    name: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const location = useLocation();

  // Autofill name and email when modal opens and user is logged in
  useEffect(() => {
    if (isModalOpen && currentUser) {
      setFormData((prev) => ({
        ...prev,
        name: currentUser.username || '',
        email: currentUser.email || '',
      }));
    }
    // Optionally clear on close
    if (!isModalOpen) {
      setFormData({ subject: '', message: '', email: '', name: '' });
    }
  }, [isModalOpen, currentUser]);

  // Fetch user messages when notifications are opened
  useEffect(() => {
    if (currentUser?.email) {
      fetchUserMessages();
    }
  }, [currentUser]);

  // Fetch user messages when modal opens or when switching to messages tab
  useEffect(() => {
    if (currentUser?.email && activeTab === 'messages') {
      fetchUserMessages();
    }
  }, [currentUser, activeTab]);

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
    if (messagesContainer && activeTab === 'messages') {
      messagesContainer.addEventListener('scroll', checkIfAtBottom);
      // Check initial position
      checkIfAtBottom();
      
      return () => {
        messagesContainer.removeEventListener('scroll', checkIfAtBottom);
      };
    }
  }, [activeTab, checkIfAtBottom]);

  // Function to scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const fetchUserMessages = async () => {
    setLoadingMessages(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/contact/user-messages/${encodeURIComponent(currentUser.email)}`, { credentials: 'include' });
      const data = await response.json();
      if (!Array.isArray(data)) {
        setUserMessages([]);
        setUnreadReplies(0);
        return;
      }
      setUserMessages(data);
      // Count unread replies (messages with admin replies that are still marked as unread)
      const unreadCount = data.filter(msg => msg.adminReply && msg.status === 'unread').length;
      setUnreadReplies(unreadCount);
    } catch (error) {
      console.error('Error fetching user messages:', error);
      setUserMessages([]);
      setUnreadReplies(0);
    } finally {
      setLoadingMessages(false);
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
    } else if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const deleteUserMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/contact/user-messages/${messageId}?email=${encodeURIComponent(currentUser.email)}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        // Remove the message from the local state
        setUserMessages(prev => prev.filter(msg => msg._id !== messageId));
        
        // Recalculate unread replies count
        const updatedMessages = userMessages.filter(msg => msg._id !== messageId);
        const unreadCount = updatedMessages.filter(msg => msg.adminReply && msg.status === 'unread').length;
        setUnreadReplies(unreadCount);
        
        toast.success('Message deleted successfully!');
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to delete message. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message. Please try again.');
    }
  };

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

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/contact/support`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setSubmitStatus('success');
        setFormData({ subject: '', message: '', email: '', name: '' });
        toast.success('Message sent successfully!');
        setTimeout(() => {
          setIsModalOpen(false);
          setSubmitStatus('');
        }, 3000);
      } else {
        setSubmitStatus('error');
        toast.error('Failed to send message. Please try again or contact us directly.');
      }
    } catch (error) {
      setSubmitStatus('error');
      toast.error('Failed to send message. Please try again or contact us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Enhanced Floating Contact Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsModalOpen(true)}
          className="relative group w-16 h-16 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 hover:rotate-12 flex items-center justify-center"
          style={{ 
            background: `linear-gradient(135deg, ${getIconColor()}, ${getIconColor()}dd)`,
            boxShadow: `0 10px 25px ${getIconColor()}40`
          }}
          title="Need help? Contact our support team!"
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
          
          {/* Unread replies badge for logged-in users */}
          {currentUser && unreadReplies > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold animate-pulse">
              {unreadReplies > 99 ? '99+' : unreadReplies}
            </span>
          )}
          
          {/* Enhanced Hover Tooltip */}
          <div className="absolute bottom-full right-0 mb-3 bg-white text-gray-800 text-sm px-4 py-2 rounded-xl shadow-2xl hidden group-hover:block z-10 whitespace-nowrap border border-gray-100 transform -translate-y-1 transition-all duration-200">
            <div className="flex items-center gap-2">
              <span className="text-lg">💬</span>
              <span className="font-medium">
                {currentUser && unreadReplies > 0 
                  ? `${unreadReplies} new repl${unreadReplies !== 1 ? 'ies' : 'y'}` 
                  : 'Need help? Contact us!'}
              </span>
            </div>
            {/* Tooltip arrow */}
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
          </div>
        </button>
      </div>

      {/* Enhanced Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideUp">
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
                  <h3 className="text-xl font-bold text-gray-900">Contact Support</h3>
                  <p className="text-sm text-gray-600">We're here to help you!</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs for logged-in users */}
            {currentUser && (
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('send')}
                  className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'send'
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Send Message
                </button>
                <button
                  onClick={() => setActiveTab('messages')}
                  className={`flex-1 px-6 py-3 text-sm font-medium transition-colors relative ${
                    activeTab === 'messages'
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  My Messages
                  {unreadReplies > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                      {unreadReplies > 99 ? '99+' : unreadReplies}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Form */}
            {(!currentUser || activeTab === 'send') ? (
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Status Messages */}
                {submitStatus === 'success' && (
                  <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-xl flex items-center gap-3 animate-bounce">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium">Message sent successfully!</p>
                      <p className="text-sm">We'll get back to you within 24 hours.</p>
                    </div>
                  </div>
                )}

                {submitStatus === 'error' && (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center gap-3">
                    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                      <FaTimes className="w-3 h-3 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">Failed to send message</p>
                      <p className="text-sm">Please try again or contact us directly.</p>
                    </div>
                  </div>
                )}

                {/* Name Field */}
                <div className="space-y-2">
                  <label htmlFor="name" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <FaUser className="w-4 h-4" />
                    Your Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter your full name"
                  />
                </div>

                {/* Email Field */}
                <div className="space-y-2">
                  <label htmlFor="email" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <FaEnvelope className="w-4 h-4" />
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="your@email.com"
                  />
                </div>

                {/* Subject Field */}
                <div className="space-y-2">
                  <label htmlFor="subject" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <FaFileAlt className="w-4 h-4" />
                    Subject *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Brief description of your issue"
                  />
                </div>

                {/* Message Field */}
                <div className="space-y-2">
                  <label htmlFor="message" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <FaHeadset className="w-4 h-4" />
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                    placeholder="Please describe your issue or question in detail..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium contact-support-action-btn"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-3 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium flex items-center justify-center gap-2 contact-support-action-btn"
                    style={{ 
                      backgroundColor: getIconColor(),
                      boxShadow: `0 4px 14px ${getIconColor()}40`
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <FaPaperPlane className="w-4 h-4" />
                        Send Message
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Messages List */
              <div className="p-6">
                {loadingMessages ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500 font-medium">Loading your messages...</p>
                  </div>
                ) : userMessages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <FaEnvelope className="w-10 h-10 text-gray-400" />
                    </div>
                    <h4 className="text-lg font-medium mb-2">No messages yet</h4>
                    <p className="text-sm mb-4">Send a support message to get started</p>
                    <button
                      onClick={() => setActiveTab('send')}
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Send Message
                    </button>
                  </div>
                ) : (
                  <div ref={messagesContainerRef} className="space-y-4 max-h-96 overflow-y-auto relative">
                    {userMessages.map((message) => (
                      <div key={message._id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{message.subject}</h4>
                            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                              <FaClock className="w-3 h-3" />
                              {formatDate(message.createdAt)}
                              <span className="text-gray-400">•</span>
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                message.status === 'replied' 
                                  ? 'bg-green-100 text-green-800' 
                                  : message.status === 'read'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {message.status === 'replied' ? 'Replied' : 
                                 message.status === 'read' ? 'Read' : 'Unread'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* User Message */}
                        <div className="bg-gray-50 p-3 rounded-lg mb-3">
                          <p className="text-gray-800 whitespace-pre-wrap leading-relaxed text-sm">
                            {message.message}
                          </p>
                        </div>

                        {/* Admin Reply */}
                        {message.adminReply && (
                          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                            <div className="flex items-center justify-between mb-2">
                              <h6 className="font-medium text-green-700 text-sm">Admin Reply</h6>
                              <span className="text-xs text-gray-500">
                                {formatDate(message.adminReplyAt)}
                              </span>
                            </div>
                            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed text-sm">
                              {message.adminReply}
                            </p>
                          </div>
                        )}

                        {/* Delete Button */}
                        <div className="flex items-center justify-end mt-2">
                          <button
                            onClick={() => deleteUserMessage(message._id)}
                            className="text-red-500 hover:text-red-700 transition-colors p-2 rounded-full hover:bg-red-50"
                            title="Delete this message"
                          >
                            <FaTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {/* Scroll to bottom button - WhatsApp style */}
                    {!isAtBottom && userMessages.length > 0 && (
                      <div className="absolute bottom-4 right-4 z-10">
                        <button
                          onClick={scrollToBottom}
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-105 animate-bounce"
                          title="Scroll to bottom"
                          aria-label="Scroll to bottom"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="transform"
                          >
                            <path d="M12 16l-6-6h12l-6 6z" />
                          </svg>
                        </button>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom CSS for animations and mobile button sizing */}
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
        /* Mobile button size reduction for Send Message and Cancel */
        @media (max-width: 640px) {
          .contact-support-action-btn {
            padding: 0.5rem 0.75rem !important;
            font-size: 0.95rem !important;
            border-radius: 0.75rem !important;
          }
        }
      `}</style>
    </>
  );
} 