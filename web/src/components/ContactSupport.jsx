import React, { useState, useEffect, useRef, useCallback } from 'react';
import { authenticatedFetch } from '../utils/auth';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaHeadset, FaTimes, FaPaperPlane, FaEnvelope, FaUser, FaFileAlt, FaClock, FaTrash, FaImage, FaPaperclip, FaSpinner, FaSearch, FaFilter, FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import ConfirmationModal from './ConfirmationModal';
import ImagePreview from './ImagePreview';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ContactSupport({ forceModalOpen = false, onModalClose = null }) {
  const { currentUser } = useSelector((state) => state.user);
  const [isModalOpen, setIsModalOpen] = useState(forceModalOpen);
  const navigate = useNavigate();
  const location = useLocation();
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
  const [attachments, setAttachments] = useState([]);
  const [imageLinkInput, setImageLinkInput] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Mobile Menu Detection
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  useEffect(() => {
    const checkMobileMenu = () => {
      setIsMobileMenuOpen(document.body.classList.contains('mobile-menu-open'));
    };

    // Check initially
    checkMobileMenu();

    // Observe body for class changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          checkMobileMenu();
        }
      });
    });

    observer.observe(document.body, { attributes: true });

    return () => observer.disconnect();
  }, []);

  // Dispatch custom event when modal state changes
  useEffect(() => {
    const event = new CustomEvent('contactSupportToggle', {
      detail: { isOpen: isModalOpen }
    });
    window.dispatchEvent(event);
  }, [isModalOpen]);

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
      setAttachments([]);
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

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (attachments.length >= 3) {
      toast.error('Maximum 3 attachments allowed');
      return;
    }

    // Validate size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setUploadingImage(true);
    try {
      const bodyFormData = new FormData();
      bodyFormData.append('image', file);

      const response = await authenticatedFetch(`${API_BASE_URL}/api/upload/image`, {
        method: 'POST',
        body: bodyFormData
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      setAttachments(prev => [...prev, data.imageUrl]);
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
      // Reset input
      e.target.value = null;
    }
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddLink = () => {
    if (!imageLinkInput.trim()) return;

    if (attachments.length >= 3) {
      toast.error('Maximum 3 attachments allowed');
      return;
    }

    setAttachments(prev => [...prev, imageLinkInput.trim()]);
    setImageLinkInput('');
  };

  const fetchUserMessages = async () => {
    setLoadingMessages(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/contact/user-messages/${encodeURIComponent(currentUser.email)}`);
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
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  };

  const deleteUserMessage = async (messageId) => {
    setMessageToDelete(messageId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!messageToDelete) return;

    setIsDeleting(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/contact/user-messages/${messageToDelete}?email=${encodeURIComponent(currentUser.email)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove the message from the local state
        setUserMessages(prev => prev.filter(msg => msg._id !== messageToDelete));

        // Recalculate unread replies count
        const updatedMessages = userMessages.filter(msg => msg._id !== messageToDelete);
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
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setMessageToDelete(null);
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

  const handleModalClose = () => {
    setIsModalOpen(false);
    if (onModalClose) {
      onModalClose();
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
        body: JSON.stringify({ ...formData, attachments })
      });

      const data = await response.json();

      if (data.success) {
        setSubmitStatus('success');
        setFormData({ subject: '', message: '', email: currentUser?.email || '', name: currentUser?.username || '' });
        setAttachments([]);
        setImageLinkInput('');
        toast.success("We've received your message — our team will contact you soon.");

        // Clear status after 5 seconds so they see it, but don't close modal
        setTimeout(() => {
          setSubmitStatus('');
        }, 5000);
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

  // Filter messages logic
  const filteredMessages = userMessages.filter(msg => {
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
        msg.subject || '',
        msg.message || '',
        msg.ticketId || '',
        msg.adminReply || ''
      ];
      return searchableFields.some(field => field.toLowerCase().includes(lowerSearch));
    }

    return true;
  }).sort((a, b) => {
    const dateA = new Date(a.createdAt);
    const dateB = new Date(b.createdAt);
    return dateSort === 'desc' ? dateB - dateA : dateA - dateB;
  });

  return (
    <>
      {/* Enhanced Floating Contact Button */}
      <div className={`fixed bottom-6 right-6 z-50 ${isMobileMenuOpen ? 'hidden' : ''}`}>
        <button
          onClick={() => setIsModalOpen(true)}
          className="relative group w-12 h-12 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 hover:rotate-12 flex items-center justify-center"
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
          <FaHeadset className="w-5 h-5 text-white drop-shadow-lg" />

          {/* Unread replies badge for logged-in users */}
          {currentUser && unreadReplies > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold animate-pulse">
              {unreadReplies > 99 ? '99+' : unreadReplies}
            </span>
          )}

          {/* Enhanced Hover Tooltip - Only show if there are unread replies */}
          {/* Enhanced Hover Tooltip */}
          {/* Enhanced Animatic Hover Tooltip */}
          <div className="absolute right-full top-1/2 -translate-y-1/2 mr-4 opacity-0 scale-90 translate-x-4 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:translate-x-0 group-hover:pointer-events-auto transition-all duration-500 ease-out z-10 whitespace-nowrap">
            <div className="relative bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm px-6 py-2.5 rounded-full shadow-[0_10px_40px_-10px_rgba(37,99,235,0.2)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] flex items-center gap-3 border border-gray-100 dark:border-gray-700 backdrop-blur-md">
              <span className="text-lg">💬</span>
              <span className="font-bold tracking-tight">
                {currentUser && unreadReplies > 0
                  ? `${unreadReplies} new repl${unreadReplies !== 1 ? 'ies' : 'y'}`
                  : 'Contact Support'}
              </span>

              {/* Tooltip arrow - pointing right towards the icon */}
              <div className="absolute left-[calc(100%-1px)] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-b-[8px] border-l-[10px] border-transparent border-l-white dark:border-l-gray-800"></div>
            </div>
          </div>
        </button>
      </div>

      {/* Enhanced Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideUp transition-colors">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-gray-50 dark:from-gray-800/50 to-white dark:to-gray-900 rounded-t-2xl transition-colors">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: getIconColor() }}
                >
                  <FaHeadset className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white transition-colors">Contact Support</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">We're here to help you!</p>
                </div>
              </div>
              <div className="flex items-center gap-2">

                <button
                  onClick={handleModalClose}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tabs for logged-in users */}
            {currentUser && (
              <div className="flex border-b border-gray-200 dark:border-gray-800 transition-colors">
                <button
                  onClick={() => setActiveTab('send')}
                  className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'send'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                >
                  Send Message
                </button>
                <button
                  onClick={() => setActiveTab('messages')}
                  className={`flex-1 px-6 py-3 text-sm font-medium transition-colors relative ${activeTab === 'messages'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
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
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 rounded-xl flex items-center gap-3 animate-bounce transition-colors">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-sm md:text-base">Message sent successfully!</p>
                      <p className="text-xs md:text-sm opacity-90 transition-colors">We'll get back to you within 24 hours.</p>
                    </div>
                  </div>
                )}

                {submitStatus === 'error' && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-xl flex items-center gap-3 transition-colors">
                    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                      <FaTimes className="w-3 h-3 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-sm md:text-base">Failed to send message</p>
                      <p className="text-xs md:text-sm opacity-90 transition-colors">Please try again or contact us directly.</p>
                    </div>
                  </div>
                )}

                {/* Name Field */}
                <div className="space-y-2">
                  <label htmlFor="name" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors">
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
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter your full name"
                  />
                </div>

                {/* Email Field */}
                <div className="space-y-2">
                  <label htmlFor="email" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors">
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
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="your@email.com"
                  />
                </div>

                {/* Subject Field */}
                <div className="space-y-2">
                  <label htmlFor="subject" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors">
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
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Brief description of your issue"
                  />
                </div>

                {/* Message Field */}
                <div className="space-y-2">
                  <label htmlFor="message" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors">
                    <FaHeadset className="w-4 h-4" />
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    disabled={isSubmitting}
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all duration-200 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Please describe your issue or question in detail..."
                  />
                </div>

                {/* Attachments Section */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors">
                    <FaPaperclip className="w-4 h-4" />
                    Attach screenshot (optional)
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={imageLinkInput}
                      onChange={(e) => setImageLinkInput(e.target.value)}
                      disabled={attachments.length >= 3 || isSubmitting}
                      placeholder={attachments.length >= 3 ? "Limit reached (Max 3)" : (isSubmitting ? "Sending message..." : "Paste image URL...")}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), !isSubmitting && handleAddLink())}
                    />
                    <button
                      type="button"
                      onClick={handleAddLink}
                      disabled={attachments.length >= 3 || isSubmitting}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {attachments.map((url, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group">
                        <img
                          src={url}
                          alt="Attachment"
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setPreviewImage(url)}
                        />
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          disabled={isSubmitting}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                          title="Remove image"
                        >
                          <FaTimes className="w-2 h-2" />
                        </button>
                      </div>
                    ))}

                    {attachments.length < 3 && (
                      <label className={`w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg transition-colors ${uploadingImage || isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                        {uploadingImage ? (
                          <FaSpinner className="w-5 h-5 text-blue-500 animate-spin" />
                        ) : (
                          <>
                            <FaImage className="w-5 h-5 text-gray-400 mb-1" />
                            <span className="text-[10px] text-gray-500">{isSubmitting ? 'Wait' : 'Upload'}</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploadingImage || isSubmitting}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Max 3 attachments • screenshots (JPG, PNG/WebP up to 5MB)
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleModalClose}
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 font-medium contact-support-action-btn disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium transition-colors">Loading your messages...</p>
                  </div>
                ) : userMessages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 transition-colors">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center transition-colors">
                      <FaEnvelope className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                    </div>
                    <h4 className="text-lg font-medium mb-2 text-gray-900 dark:text-white transition-colors">No messages yet</h4>
                    <p className="text-sm mb-4 transition-colors">Send a support message to get started</p>
                    <button
                      onClick={() => setActiveTab('send')}
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Send Message
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col h-full bg-white dark:bg-transparent">
                    {/* Filters Section */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 flex flex-wrap gap-3 items-center">
                      <div className="relative flex-1 min-w-[180px]">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                        <input
                          type="text"
                          placeholder="Search tickets, subject..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-8 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs text-gray-900 dark:text-white"
                        />
                        {searchTerm && (
                          <button
                            onClick={() => setSearchTerm("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <FaTimes className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
                      >
                        <option value="all">All Status</option>
                        <option value="unread">Unread</option>
                        <option value="read">Read</option>
                        <option value="replied">Replied</option>
                      </select>

                      <button
                        onClick={() => setDateSort(dateSort === 'desc' ? 'asc' : 'desc')}
                        className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        title={dateSort === 'desc' ? "Newest First" : "Oldest First"}
                      >
                        {dateSort === 'desc' ? (
                          <FaSortAmountDown className="w-3 h-3 text-blue-500" />
                        ) : (
                          <FaSortAmountUp className="w-3 h-3 text-blue-500" />
                        )}
                      </button>

                      {/* Date Filters */}
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={startDate}
                          max={today}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
                          title="Start Date"
                        />
                        <span className="text-gray-400 dark:text-gray-600 text-[10px] font-bold">TO</span>
                        <input
                          type="date"
                          value={endDate}
                          max={today}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
                          title="End Date"
                        />
                      </div>

                      {(searchTerm || statusFilter !== 'all' || dateSort !== 'desc' || startDate || endDate) && (
                        <button
                          onClick={() => {
                            setSearchTerm("");
                            setStatusFilter("all");
                            setDateSort("desc");
                            setStartDate("");
                            setEndDate("");
                          }}
                          className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div ref={messagesContainerRef} className="space-y-4 max-h-96 overflow-y-auto relative p-4 bg-white dark:bg-transparent">
                      {filteredMessages.length === 0 ? (
                        <div className="text-center py-10">
                          <FaSearch className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">No matches found for your criteria</p>
                        </div>
                      ) : (
                        filteredMessages.map((message) => (
                          <div key={message._id} className="border border-gray-100 dark:border-gray-800 rounded-xl p-4 hover:shadow-md transition-all duration-200 bg-white dark:bg-gray-900/40">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                  <h4 className="font-bold text-gray-900 dark:text-white transition-colors">{message.subject}</h4>
                                  {message.ticketId && (
                                    <span className="text-[10px] font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded transition-colors border border-blue-100 dark:border-blue-800">
                                      {message.ticketId}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500 dark:text-gray-400 transition-colors">
                                  <span className="flex items-center gap-1">
                                    <FaClock className="w-2.5 h-2.5" />
                                    {formatDate(message.createdAt)}
                                  </span>
                                  <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold uppercase tracking-wider transition-colors ${message.status === 'replied'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                                    : message.status === 'read'
                                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800'
                                    }`}>
                                    {message.status}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* User Message */}
                            <div className="bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl mb-3 transition-colors border border-gray-100 dark:border-gray-800">
                              <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed text-sm transition-colors">
                                {message.message}
                              </p>
                              {/* Attachments Display */}
                              {message.attachments && message.attachments.length > 0 && (
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                  {message.attachments.map((url, i) => (
                                    <div key={i} className="block relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity cursor-pointer shadow-sm" onClick={() => setPreviewImage(url)}>
                                      <img src={url} alt="Attachment" className="w-full h-full object-cover" />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Admin Reply */}
                            {message.adminReply && (
                              <div className="bg-green-50/50 dark:bg-green-900/10 p-3 rounded-xl border border-green-200/50 dark:border-green-800/50 transition-colors shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                  <h6 className="font-bold text-green-700 dark:text-green-400 text-xs uppercase tracking-widest transition-colors">Support Team Reply</h6>
                                  <span className="text-[10px] text-gray-500 dark:text-gray-500 transition-colors">
                                    {formatDate(message.adminReplyAt)}
                                  </span>
                                </div>
                                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed text-sm transition-colors ring-1 ring-green-500/10 p-2 rounded-lg bg-white/50 dark:bg-gray-800/20">
                                  {message.adminReply}
                                </p>
                              </div>
                            )}

                            {/* Delete Button */}
                            <div className="flex items-center justify-end mt-2">
                              <button
                                onClick={() => deleteUserMessage(message._id)}
                                className="text-red-500 hover:text-white dark:text-red-400 hover:bg-red-500 transition-all duration-200 p-2 rounded-lg border border-transparent hover:shadow-lg"
                                title="Delete this message"
                              >
                                <FaTrash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Floating Scroll to bottom button - WhatsApp style */}
            {!isAtBottom && userMessages.length > 0 && activeTab === 'messages' && (
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

      {/* Image Preview Modal */}
      {
        previewImage && (
          <ImagePreview
            isOpen={!!previewImage}
            onClose={() => setPreviewImage(null)}
            images={[previewImage]}
          />
        )
      }


    </>
  );
}
