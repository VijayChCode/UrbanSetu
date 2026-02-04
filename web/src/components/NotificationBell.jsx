import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { FaBell, FaTimes, FaCheck, FaTrash, FaEye, FaCalendarAlt, FaEdit, FaEnvelope, FaPaperPlane, FaUsers, FaUser, FaRedo, FaUndo, FaSearch, FaFilter, FaCopy, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { socket } from '../utils/socket.js';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function NotificationBell({ mobile = false }) {
  const navigate = useNavigate();
  const dragControls = useDragControls();
  const { currentUser } = useSelector((state) => state.user);
  const [notifications, setNotifications] = useState([]);
  const [allNotifications, setAllNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [previousUnreadCount, setPreviousUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState('notifications'); // 'notifications' or 'send'
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sendingUserNotification, setSendingUserNotification] = useState(false);
  const [sendingAllNotification, setSendingAllNotification] = useState(false);
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Notification filters
  const [notificationSearch, setNotificationSearch] = useState('');
  const [notificationFilter, setNotificationFilter] = useState('all'); // 'all', 'unread', 'read'
  const [showFilters, setShowFilters] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [showMarkAllConfirmation, setShowMarkAllConfirmation] = useState(false);

  // Separate state for "Send to All Users" form
  const [allUsersTitle, setAllUsersTitle] = useState('');
  const [allUsersMessage, setAllUsersMessage] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const bellRef = useRef(null);

  // Scroll lock effect: prevent background scroll when notification dropdown/modal is open
  useEffect(() => {
    if (isOpen) {
      // Save previous overflow style
      const prevOverflow = document.body.style.overflow;
      const prevPosition = document.body.style.position;
      const prevWidth = document.body.style.width;

      document.body.style.overflow = 'hidden';
      if (mobile) {
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
      }

      // Clean up: restore previous overflow
      return () => {
        document.body.style.overflow = prevOverflow;
        document.body.style.position = prevPosition;
        document.body.style.width = prevWidth;
      };
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    // Clean up on unmount
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen, mobile]);

  // Fetch notifications; when showTodayOnly is true, filter to today's notifications and show toast
  const fetchNotifications = async (showTodayOnly = false) => {
    if (!currentUser) return;

    try {

      const res = await authenticatedFetch(`${API_BASE_URL}/api/notifications/user/${currentUser._id}`);
      const data = await res.json();

      if (res.ok) {
        if (showTodayOnly) {
          const now = new Date();
          const todayYear = now.getFullYear();
          const todayMonth = now.getMonth();
          const todayDate = now.getDate();
          const todays = (Array.isArray(data) ? data : []).filter((n) => {
            const d = new Date(n.createdAt);
            return d.getFullYear() === todayYear && d.getMonth() === todayMonth && d.getDate() === todayDate;
          });
          setAllNotifications(todays.length > 0 ? todays : data);
          toast.info('Notifications list updated');
        } else {
          setAllNotifications(data);
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Fetch unread count
  const fetchUnreadCount = async () => {
    if (!currentUser) return;

    try {

      const res = await authenticatedFetch(`${API_BASE_URL}/api/notifications/user/${currentUser._id}/unread-count`);
      const data = await res.json();

      if (res.ok) {
        const newCount = data.count;
        // Check if this is a new notification (count increased)
        if (newCount > previousUnreadCount && previousUnreadCount > 0) {
          triggerBellRing();
        }
        setUnreadCount(newCount);
        setPreviousUnreadCount(newCount);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // Bell ring animation function
  const triggerBellRing = () => {
    setIsRinging(true);
    setTimeout(() => {
      setIsRinging(false);
    }, 1500); // Animation lasts 1.5 seconds
  };

  // Fetch all users for admin notification dropdown
  const fetchUsers = async () => {
    if (!currentUser || !isAdmin()) return;

    setFetchingUsers(true);
    try {



      const res = await authenticatedFetch(`${API_BASE_URL}/api/notifications/admin/users`);
      const data = await res.json();



      if (res.ok) {
        setUsers(data);

      } else {
        console.error('Failed to fetch users:', data);
        toast.error('Failed to fetch users: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users: ' + error.message);
    } finally {
      setFetchingUsers(false);
    }
  };

  // Send notification to specific user
  const sendNotificationToUser = async (e) => {
    e.preventDefault();

    if (!selectedUser || !title.trim() || !message.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setSendingUserNotification(true);
    try {

      const res = await authenticatedFetch(`${API_BASE_URL}/api/notifications/admin/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser,
          title: title.trim(),
          message: message.trim(),
          type: 'admin_message'
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message);
        // Reset form
        setSelectedUser('');
        setTitle('');
        setMessage('');
        setUserSearch('');
        setActiveTab('notifications');
      } else {
        toast.error(data.message || 'Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Failed to send notification');
    } finally {
      setSendingUserNotification(false);
    }
  };

  // Send notification to all users
  const sendNotificationToAll = async (e) => {
    e.preventDefault();

    if (!allUsersTitle.trim() || !allUsersMessage.trim()) {
      toast.error('Please fill in title and message');
      return;
    }

    setSendingAllNotification(true);
    try {

      const res = await authenticatedFetch(`${API_BASE_URL}/api/notifications/admin/send-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: allUsersTitle.trim(),
          message: allUsersMessage.trim(),
          type: 'admin_message'
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message);
        // Reset form
        setAllUsersTitle('');
        setAllUsersMessage('');
        setUserSearch('');
        setActiveTab('notifications');
      } else {
        toast.error(data.message || 'Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Failed to send notification');
    } finally {
      setSendingAllNotification(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {

      const res = await authenticatedFetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: currentUser._id }),
      });

      if (res.ok) {
        // Update local state
        setAllNotifications(prev =>
          prev.map(notif =>
            notif._id === notificationId
              ? { ...notif, isRead: true, readAt: new Date() }
              : notif
          )
        );
        fetchUnreadCount(); // Refresh count
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      let endpoint;
      let successMessage;

      if (isAdmin()) {
        // For admins, use the sync endpoint to mark all admins' notifications as read
        endpoint = `${API_BASE_URL}/api/notifications/admin/read-all`;
        successMessage = 'All notifications marked as read for all admins';
      } else {
        // For regular users, use the individual endpoint
        endpoint = `${API_BASE_URL}/api/notifications/user/${currentUser._id}/read-all`;
        successMessage = 'All notifications marked as read';
      }

      const res = await authenticatedFetch(endpoint, {
        method: 'PUT',
      });

      if (res.ok) {
        const data = await res.json();
        setAllNotifications(prev =>
          prev.map(notif => ({ ...notif, isRead: true, readAt: new Date() }))
        );
        setUnreadCount(0);
        toast.success(successMessage);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {

      const res = await authenticatedFetch(`${API_BASE_URL}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: currentUser._id }),
      });

      if (res.ok) {
        setAllNotifications(prev => prev.filter(notif => notif._id !== notificationId));
        fetchUnreadCount(); // Refresh count
        toast.success('Notification deleted');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Format date
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

  // Get notification icon based on type
  const getNotificationIcon = (type) => {
    const iconBase = "w-4 h-4";
    const containerBase = "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0";

    switch (type) {
      case 'property_edited':
        return (
          <div className={`${containerBase} bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400`}>
            <FaEdit className={iconBase} />
          </div>
        );
      case 'property_deleted':
      case 'rent_contract_rejected':
      case 'rent_contract_terminated':
      case 'move_in_rejected':
      case 'move_out_rejected':
        return (
          <div className={`${containerBase} bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400`}>
            <FaTrash className={iconBase} />
          </div>
        );
      case 'appointment_cancelled_by_seller':
      case 'appointment_cancelled_by_buyer':
      case 'appointment_cancelled_by_admin':
        return (
          <div className={`${containerBase} bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400`}>
            <FaTimes className={iconBase} />
          </div>
        );
      case 'appointment_updated':
        return (
          <div className={`${containerBase} bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400`}>
            <FaCalendarAlt className={iconBase} />
          </div>
        );
      case 'admin_message':
      case 'rent_payment_reminder':
      case 'rent_dispute_resolved':
        return (
          <div className={`${containerBase} bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400`}>
            <FaEnvelope className={iconBase} />
          </div>
        );
      case 'appointment_booked':
        return (
          <div className={`${containerBase} bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400`}>
            <FaCalendarAlt className={iconBase} />
          </div>
        );
      case 'appointment_accepted_by_seller':
      case 'rent_contract_signed':
      case 'rent_contract_accepted':
      case 'move_in_approved':
      case 'move_out_approved':
        return (
          <div className={`${containerBase} bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400`}>
            <FaCheck className={iconBase} />
          </div>
        );
      case 'watchlist_price_drop':
        return (
          <div className={`${containerBase} bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400`}>
            <FaEye className={iconBase} />
          </div>
        );
      case 'watchlist_property_sold':
        return (
          <div className={`${containerBase} bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400`}>
            <FaTimes className={iconBase} />
          </div>
        );
      case 'client_error_report':
      case 'rent_payment_overdue':
      case 'rent_dispute_raised':
      case 'community_report':
        return (
          <div className={`${containerBase} bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400`}>
            <FaExclamationTriangle className={iconBase} />
          </div>
        );
      default:
        return (
          <div className={`${containerBase} bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400`}>
            <FaBell className={iconBase} />
          </div>
        );
    }
  };

  // Load data on component mount and user change
  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
      fetchUnreadCount();

      // Fetch users if admin (for notification sending)
      if (isAdmin()) {
        fetchUsers();
      }

      // Set up polling for new notifications every 10 seconds
      const interval = setInterval(() => {
        fetchUnreadCount();
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // Fetch users when send tab is active (admin only)
  useEffect(() => {


    if (isOpen && activeTab === 'send' && currentUser && isAdmin()) {

      fetchUsers();
    }
  }, [isOpen, activeTab, currentUser]);

  // Don't render if no user
  if (!currentUser) return null;



  // Helper function to check if user is admin
  const isAdmin = () => {
    return currentUser.role === 'admin' ||
      currentUser.role === 'rootadmin' ||
      currentUser.isDefaultAdmin ||
      currentUser.isAdmin;
  };

  // Filter notifications based on search and filter criteria
  const filteredNotifications = useMemo(() => {
    let filtered = [...allNotifications];

    // Filter by read/unread status
    if (notificationFilter === 'unread') {
      filtered = filtered.filter(n => !n.isRead);
    } else if (notificationFilter === 'read') {
      filtered = filtered.filter(n => n.isRead);
    }

    // Filter by search query
    if (notificationSearch.trim()) {
      const searchLower = notificationSearch.trim().toLowerCase();
      filtered = filtered.filter(n =>
        n.title?.toLowerCase().includes(searchLower) ||
        n.message?.toLowerCase().includes(searchLower) ||
        n.type?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [allNotifications, notificationFilter, notificationSearch]);

  useEffect(() => {
    setNotifications(filteredNotifications);
  }, [filteredNotifications]);

  useEffect(() => {
    const handleNewNotification = (notification) => {
      if (!currentUser || notification.userId !== currentUser._id) return;
      setAllNotifications((prev) => [notification, ...prev]);
      setUnreadCount((count) => count + 1);
      triggerBellRing(); // Ring bell when new notification arrives
    };

    const handleAllNotificationsMarkedAsRead = (data) => {
      if (!currentUser || data.adminId !== currentUser._id) return;

      // Update local state to mark all notifications as read
      setAllNotifications(prev =>
        prev.map(notif => ({ ...notif, isRead: true, readAt: new Date() }))
      );
      setUnreadCount(0);

      // Show toast notification about who marked them as read
      const markedBy = data.markedBy === currentUser._id ? 'You' : 'Another admin';
      toast.info(`${markedBy} marked all notifications as read for all admins`);
    };

    const handleNotificationMarkedAsRead = (data) => {
      if (!currentUser || data.notificationId) {
        // Update the specific notification as read
        setAllNotifications(prev =>
          prev.map(notif =>
            notif._id === data.notificationId
              ? { ...notif, isRead: true, readAt: new Date() }
              : notif
          )
        );

        // Update unread count
        setUnreadCount(prev => Math.max(0, prev - 1));

        // Show toast notification about who marked it as read
        const markedBy = data.markedBy === currentUser._id ? 'You' : (data.markedByUsername || data.markedByEmail || 'Another admin');
        toast.info(`${markedBy} marked a notification as read`);
      }
    };

    const handleWatchlistNotification = (data) => {
      if (!currentUser || data.userId !== currentUser._id) return;
      setAllNotifications((prev) => [data.notification, ...prev]);
      setUnreadCount((count) => count + 1);
      triggerBellRing(); // Ring bell for watchlist notifications
    };

    socket.on('notificationCreated', handleNewNotification);
    socket.on('allNotificationsMarkedAsRead', handleAllNotificationsMarkedAsRead);
    socket.on('notificationMarkedAsRead', handleNotificationMarkedAsRead);
    socket.on('watchlistNotification', handleWatchlistNotification);

    return () => {
      socket.off('notificationCreated', handleNewNotification);
      socket.off('allNotificationsMarkedAsRead', handleAllNotificationsMarkedAsRead);
      socket.off('notificationMarkedAsRead', handleNotificationMarkedAsRead);
      socket.off('watchlistNotification', handleWatchlistNotification);
    };
  }, [currentUser]);

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        ref={bellRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 text-gray-600 hover:text-blue-600 transition-all duration-300 hover:scale-110 h-10 w-10 flex items-center justify-center rounded-xl bg-gray-100/80 hover:bg-white custom-shadow ${isRinging ? 'animate-bell-ring' : ''
          } ${isOpen ? 'bg-white text-blue-600 ring-2 ring-blue-100' : ''}`}
        title="Notifications"
      >
        <FaBell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center font-bold shadow-lg pulse-badge border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown or Modal */}
      {/* Mobile View Modal */}
      {mobile && createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[1000] flex items-end justify-center sm:hidden backdrop-blur-sm bg-black/60"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setIsOpen(false);
                }
              }}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                drag="y"
                dragControls={dragControls}
                dragListener={false}
                dragConstraints={{ top: 0 }}
                dragElastic={{ top: 0, bottom: 0.2 }}
                onDragEnd={(e, { offset, velocity }) => {
                  if (offset.y > 100 || velocity.y > 500) {
                    setIsOpen(false);
                  }
                }}
                className="w-full sm:max-w-md bg-white dark:bg-gray-900 sm:rounded-3xl rounded-t-3xl shadow-2xl border border-white/20 dark:border-gray-800 max-h-[92vh] flex flex-col overflow-hidden glass-morphism transition-colors duration-300"
              >
                {/* Header Strip - Drag Handle */}
                <div
                  className="flex items-center justify-center py-4 sm:hidden cursor-grab active:cursor-grabbing touch-none"
                  onPointerDown={(e) => dragControls.start(e)}
                >
                  <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
                </div>

                {/* Header */}
                <div className="px-6 pt-4 pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Activity</h3>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl p-2.5 transition-all"
                    >
                      <FaTimes className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">
                    {unreadCount > 0 ? `You have ${unreadCount} unread messages` : 'No new notifications'}
                  </p>
                </div>

                {/* Admin Tabs */}
                {isAdmin() && (
                  <div className="px-6 mb-4">
                    <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl">
                      <button
                        onClick={() => setActiveTab('notifications')}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'notifications'
                          ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                          }`}
                      >
                        <FaBell className="w-4 h-4" />
                        Inbox
                      </button>
                      <button
                        onClick={() => setActiveTab('send')}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'send'
                          ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                          }`}
                      >
                        <FaEnvelope className="w-4 h-4" />
                        Broadcast
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-hidden flex flex-col pt-2">
                  {/* Tab Content */}
                  {activeTab === 'notifications' ? (
                    <>
                      {/* Notifications Header Actions */}
                      <div className="px-6 pb-4 space-y-4">
                        {/* Search and Filter Row */}
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1 group">
                            <FaSearch className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5 group-focus-within:text-blue-500 transition-colors" />
                            <input
                              type="text"
                              value={notificationSearch}
                              onChange={(e) => setNotificationSearch(e.target.value)}
                              placeholder="Search alerts..."
                              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-gray-900 dark:text-white transition-all"
                            />
                          </div>
                          <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2.5 rounded-2xl transition-all ${showFilters || notificationFilter !== 'all'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                              }`}
                          >
                            <FaFilter className="w-4 h-4" />
                          </button>
                        </div>
                        {/* Filter Pill Row */}
                        {showFilters && (
                          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                            {['all', 'unread', 'read'].map((filter) => (
                              <button
                                key={filter}
                                onClick={() => setNotificationFilter(filter)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${notificationFilter === filter
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                  }`}
                              >
                                {filter.charAt(0).toUpperCase() + filter.slice(1)}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Quick Actions Row */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-4">
                            {unreadCount > 0 && (
                              showMarkAllConfirmation ? (
                                <div className="flex items-center gap-2 animate-fadeIn bg-gray-50 dark:bg-gray-800 p-1.5 rounded-lg">
                                  <span className="text-[10px] font-bold text-gray-500">Confirm?</span>
                                  <button
                                    onClick={() => {
                                      markAllAsRead();
                                      setShowMarkAllConfirmation(false);
                                    }}
                                    className="text-[10px] font-bold text-emerald-500 hover:text-emerald-600 transition-colors bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-lg"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() => setShowMarkAllConfirmation(false)}
                                    className="text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors bg-white dark:bg-gray-700 px-2 py-1 rounded-lg shadow-sm"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setShowMarkAllConfirmation(true);
                                    setShowClearConfirmation(false);
                                  }}
                                  className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1.5"
                                >
                                  <FaCheck className="w-3 h-3" />
                                  Mark Read
                                </button>
                              )
                            )}
                            <button
                              onClick={() => fetchNotifications(true)}
                              className="text-xs font-bold text-gray-400 hover:text-blue-600 transition-colors flex items-center gap-1.5"
                            >
                              <FaRedo className="w-3 h-3" />
                              Sync
                            </button>
                          </div>
                          {allNotifications.length > 0 && (
                            showClearConfirmation ? (
                              <div className="flex items-center gap-2 animate-fadeIn">
                                <span className="text-[10px] font-bold text-gray-500">Confirm?</span>
                                <button
                                  onClick={() => {
                                    authenticatedFetch(`${API_BASE_URL}/api/notifications/user/${currentUser._id}/all`, {
                                      method: 'DELETE'
                                    }).then(() => {
                                      setAllNotifications([]);
                                      setUnreadCount(0);
                                      toast.success('Inbox cleared');
                                      setShowClearConfirmation(false);
                                    });
                                  }}
                                  className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-lg"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setShowClearConfirmation(false)}
                                  className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setShowClearConfirmation(true);
                                  setShowMarkAllConfirmation(false);
                                }}
                                className="text-xs font-bold text-red-500/80 hover:text-red-600 transition-colors flex items-center gap-1.5"
                              >
                                <FaTrash className="w-3 h-3" />
                                Clean
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      {/* Notifications List Container */}
                      {/* Notifications List Container */}
                      {/* Notifications List Container */}
                      <div className="notification-scroll-area-mobile bg-gray-50/50 dark:bg-black/20 flex-1 px-4 py-2">
                        {notifications.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-64 text-center">
                            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                              <FaBell className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                            </div>
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white">All caught up!</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[200px]">No new notifications for you right now.</p>
                          </div>
                        ) : (
                          <div className="space-y-3 pb-6">
                            <AnimatePresence mode="popLayout">
                              {notifications.map((notification, index) => (
                                <motion.div
                                  layout
                                  initial={{ opacity: 0, scale: 0.9, marginBottom: -40 }}
                                  animate={{ opacity: 1, scale: 1, marginBottom: 0 }}
                                  exit={{ opacity: 0, x: 300, transition: { duration: 0.2 } }}
                                  transition={{ duration: 0.2 }}
                                  key={notification._id}
                                  className={`notification-card p-4 rounded-2xl border ${!notification.isRead
                                    ? 'bg-white dark:bg-gray-800 border-blue-100 dark:border-blue-900/30 shadow-sm ring-1 ring-blue-50 dark:ring-blue-900/20 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    : 'bg-white/80 dark:bg-gray-800/60 border-gray-100 dark:border-gray-700/50 hover:bg-gray-100/60 dark:hover:bg-gray-800/60'
                                    }`}
                                >
                                  <div className="flex gap-4">
                                    {getNotificationIcon(notification.type)}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2">
                                        <h4 className={`text-sm font-bold truncate ${!notification.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                                          {notification.title}
                                        </h4>
                                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                                          {formatDate(notification.createdAt)}
                                        </span>
                                      </div>
                                      <p className={`text-xs mt-1 leading-relaxed whitespace-pre-wrap ${!notification.isRead ? 'text-gray-600 dark:text-gray-300 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                                        {notification.link ? (
                                          <button
                                            onClick={() => {
                                              markAsRead(notification._id);
                                              if (notification.link.startsWith('http')) {
                                                window.open(notification.link, '_blank');
                                              } else {
                                                setIsOpen(false);
                                                setTimeout(() => navigate(notification.link), 0);
                                              }
                                            }}
                                            className="text-left hover:text-blue-600 transition-colors underline decoration-blue-200 underline-offset-2"
                                          >
                                            {notification.message}
                                          </button>
                                        ) : (
                                          <span>{notification.message}</span>
                                        )}
                                      </p>

                                      <div className="flex items-center justify-between mt-3">
                                        <div className="flex items-center gap-2">
                                          {notification.adminId && (
                                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">
                                              Admin
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => {
                                              navigator.clipboard.writeText(`${notification.title}\n${notification.message}`);
                                              setCopiedId(notification._id);
                                              setTimeout(() => setCopiedId(null), 2000);
                                              toast.success('Copied');
                                            }}
                                            className={`p-1.5 rounded-lg transition-all ${copiedId === notification._id ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30'}`}
                                            title="Copy"
                                          >
                                            {copiedId === notification._id ? <FaCheck className="w-3 h-3" /> : <FaCopy className="w-3 h-3" />}
                                          </button>
                                          {!notification.isRead && (
                                            <button
                                              onClick={() => markAsRead(notification._id)}
                                              className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all"
                                              title="Mark Read"
                                            >
                                              <FaCheck className="w-3 h-3" />
                                            </button>
                                          )}
                                          <button
                                            onClick={() => deleteNotification(notification._id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                                            title="Delete"
                                          >
                                            <FaTrash className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Send Notification Tab */
                    <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
                      {/* Send to All Users */}
                      <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg border border-green-200 dark:border-green-800">
                        <h4 className="font-semibold text-green-800 dark:text-green-300 mb-3 flex items-center gap-2">
                          <FaUsers className="w-4 h-4" />
                          Send to All Users
                        </h4>
                        <form onSubmit={sendNotificationToAll} className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Title
                            </label>
                            <input
                              type="text"
                              value={allUsersTitle}
                              onChange={(e) => setAllUsersTitle(e.target.value)}
                              placeholder="Enter title..."
                              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                              required
                              maxLength={100}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Message
                            </label>
                            <textarea
                              value={allUsersMessage}
                              onChange={(e) => setAllUsersMessage(e.target.value)}
                              placeholder="Enter message..."
                              rows={3}
                              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                              required
                              maxLength={500}
                            />
                            <div className="text-xs text-gray-500 mt-1 text-right">
                              {allUsersMessage.length}/500
                            </div>
                          </div>
                          <button
                            type="submit"
                            disabled={sendingAllNotification || !allUsersTitle.trim() || !allUsersMessage.trim()}
                            className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {sendingAllNotification ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                Sending...
                              </>
                            ) : (
                              <>
                                <FaUsers className="w-3 h-3" />
                                Send to All Users
                              </>
                            )}
                          </button>
                        </form>
                      </div>

                      {/* Send to Specific User */}
                      <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                          <FaUser className="w-4 h-4" />
                          Send to Specific User
                        </h4>
                        <form onSubmit={sendNotificationToUser} className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Select User
                            </label>
                            <input
                              type="text"
                              value={userSearch}
                              onChange={(e) => {
                                const value = e.target.value;
                                setUserSearch(value);
                                // Clear selected user if search changes
                                if (selectedUser && value.trim()) {
                                  setSelectedUser('');
                                }
                              }}
                              placeholder="Search users by name, email, or mobile number"
                              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 mb-2"
                              disabled={fetchingUsers}
                            />
                            <div className="relative">
                              <select
                                value={selectedUser}
                                onChange={(e) => setSelectedUser(e.target.value)}
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                required
                                disabled={fetchingUsers}
                              >
                                <option value="" disabled>
                                  -- Select a user --
                                </option>
                                {users.length === 0 && !fetchingUsers && (
                                  <option value="" disabled>No users found. Click "Refresh Users" to load.</option>
                                )}
                                {users
                                  .filter((user) => {
                                    const q = userSearch.trim().toLowerCase();
                                    if (!q) return true;

                                    const name = (user.username || user.name || "").toLowerCase();
                                    const email = (user.email || "").toLowerCase();
                                    const mobileRaw = (user.mobileNumber || user.mobile || "").toString();
                                    const mobile = mobileRaw.replace(/\D/g, '');

                                    // If query is exactly a 10-digit number, require exact mobile match
                                    if (/^\d{10}$/.test(q)) {
                                      return mobile === q;
                                    }

                                    // Otherwise broad matching across fields
                                    return (
                                      name.includes(q) ||
                                      email.includes(q) ||
                                      mobileRaw.toLowerCase().includes(q)
                                    );
                                  })
                                  .map((user) => {
                                    const formatMobileNumber = (mobile) => {
                                      if (!mobile) return '';
                                      const cleanMobile = mobile.toString().replace(/[\s\-\(\)]/g, '');
                                      if (cleanMobile.length === 10) {
                                        return `+91-${cleanMobile}`;
                                      } else if (cleanMobile.length === 12 && cleanMobile.startsWith('91')) {
                                        return `+${cleanMobile}`;
                                      } else if (cleanMobile.length === 13 && cleanMobile.startsWith('+91')) {
                                        return cleanMobile;
                                      }
                                      return mobile;
                                    };

                                    const displayName = user.username || user.name || user.email;
                                    const displayEmail = user.email;
                                    const displayMobile = formatMobileNumber(user.mobileNumber || user.mobile);

                                    return (
                                      <option key={user._id} value={user._id}>
                                        {displayName} ({displayEmail}{displayMobile ? `, ${displayMobile}` : ''})
                                      </option>
                                    );
                                  })}
                              </select>
                              {fetchingUsers && (
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-gray-500">
                                {users.filter((user) => {
                                  const q = userSearch.trim().toLowerCase();
                                  if (!q) return true;

                                  const name = (user.username || user.name || "").toLowerCase();
                                  const email = (user.email || "").toLowerCase();
                                  const mobileRaw = (user.mobileNumber || user.mobile || "").toString();
                                  const mobile = mobileRaw.replace(/\D/g, '');

                                  if (/^\d{10}$/.test(q)) {
                                    return mobile === q;
                                  }

                                  return (
                                    name.includes(q) ||
                                    email.includes(q) ||
                                    mobileRaw.toLowerCase().includes(q)
                                  );
                                }).length} users available
                              </span>
                              <button
                                type="button"
                                onClick={fetchUsers}
                                disabled={fetchingUsers}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                              >
                                {fetchingUsers ? 'Loading...' : 'Refresh Users'}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Title
                            </label>
                            <input
                              type="text"
                              value={title}
                              onChange={(e) => setTitle(e.target.value)}
                              placeholder="Enter title..."
                              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                              required
                              maxLength={100}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Message
                            </label>
                            <textarea
                              value={message}
                              onChange={(e) => setMessage(e.target.value)}
                              placeholder="Enter message..."
                              rows={3}
                              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                              required
                              maxLength={500}
                            />
                            <div className="text-xs text-gray-500 mt-1 text-right">
                              {message.length}/500
                            </div>
                          </div>
                          <button
                            type="submit"
                            disabled={sendingUserNotification || !selectedUser || !title.trim() || !message.trim()}
                            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {sendingUserNotification ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                Sending...
                              </>
                            ) : (
                              <>
                                <FaPaperPlane className="w-3 h-3" />
                                Send to User
                              </>
                            )}
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )
      }

      {/* Desktop: Dropdown */}
      {
        !mobile && isOpen && (
          // Desktop: Dropdown
          createPortal(
            <div
              className="fixed inset-0 z-[9998] bg-black/5"
              onClick={() => setIsOpen(false)}
            >
              <div
                className="fixed w-[420px] bg-white dark:bg-gray-900 rounded-3xl z-[9999] overflow-hidden glass-morphism animate-modal-up custom-shadow border border-transparent dark:border-gray-800"
                onClick={(e) => e.stopPropagation()}
                style={{
                  top: '80px',
                  right: '24px',
                  maxHeight: 'min(700px, calc(100vh - 120px))',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100/50 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Notifications</h3>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-xl p-2 transition-all hover:rotate-90"
                    >
                      <FaTimes className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      {unreadCount} New Alerts
                    </span>
                  </div>
                </div>

                {/* Admin Tabs */}
                {isAdmin() && (
                  <div className="px-6 pt-4">
                    <div className="flex p-1 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <button
                        onClick={() => setActiveTab('notifications')}
                        className={`flex-1 py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'notifications'
                          ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                          }`}
                      >
                        <FaBell className="w-3.5 h-3.5" />
                        INBOX
                      </button>
                      <button
                        onClick={() => setActiveTab('send')}
                        className={`flex-1 py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'send'
                          ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                          }`}
                      >
                        <FaEnvelope className="w-3.5 h-3.5" />
                        BROADCAST
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-hidden flex flex-col pt-2">
                  {activeTab === 'notifications' ? (
                    <>
                      {/* Actions Area */}
                      <div className="px-6 py-4 flex items-center justify-between gap-3">
                        <div className="relative flex-1 group">
                          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 w-3 h-3 group-focus-within:text-blue-500 transition-colors" />
                          <input
                            type="text"
                            value={notificationSearch}
                            onChange={(e) => setNotificationSearch(e.target.value)}
                            placeholder="Search..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2.5 rounded-xl transition-all ${showFilters || notificationFilter !== 'all'
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none'
                              : 'bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                              }`}
                          >
                            <FaFilter className="w-3.5 h-3.5" />
                          </button>
                          {unreadCount > 0 && (
                            showMarkAllConfirmation ? (
                              <div className="flex items-center gap-2 animate-fadeIn bg-gray-50 dark:bg-gray-800 p-1.5 rounded-xl">
                                <span className="text-[10px] font-bold text-gray-500 hidden sm:inline">Confirm?</span>
                                <button
                                  onClick={() => {
                                    markAllAsRead();
                                    setShowMarkAllConfirmation(false);
                                  }}
                                  className="text-[10px] font-bold text-emerald-500 hover:text-emerald-600 transition-colors bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-lg"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setShowMarkAllConfirmation(false)}
                                  className="text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors bg-white dark:bg-gray-700 px-2 py-1 rounded-lg shadow-sm"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setShowMarkAllConfirmation(true);
                                  setShowClearConfirmation(false);
                                }}
                                className="p-2.5 bg-gray-50 dark:bg-gray-800 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl transition-all"
                                title="Mark all as read"
                              >
                                <FaCheck className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                          {allNotifications.length > 0 && (
                            showClearConfirmation ? (
                              <div className="flex items-center gap-2 animate-fadeIn bg-gray-50 dark:bg-gray-800 p-1.5 rounded-xl">
                                <span className="text-[10px] font-bold text-gray-500 hidden sm:inline">Confirm?</span>
                                <button
                                  onClick={() => {
                                    authenticatedFetch(`${API_BASE_URL}/api/notifications/user/${currentUser._id}/all`, {
                                      method: 'DELETE'
                                    }).then(() => {
                                      setAllNotifications([]);
                                      setUnreadCount(0);
                                      toast.success('Inbox cleared');
                                      setShowClearConfirmation(false);
                                    });
                                  }}
                                  className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-lg"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setShowClearConfirmation(false)}
                                  className="text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors bg-white dark:bg-gray-700 px-2 py-1 rounded-lg shadow-sm"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setShowClearConfirmation(true);
                                  setShowMarkAllConfirmation(false);
                                }}
                                className="p-2.5 bg-gray-50 dark:bg-gray-800 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all flex items-center gap-1.5"
                                title="Clear all notifications"
                              >
                                <FaTrash className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      {showFilters && (
                        <div className="px-6 pb-4 flex gap-2">
                          {['all', 'unread', 'read'].map((f) => (
                            <button
                              key={f}
                              onClick={() => setNotificationFilter(f)}
                              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${notificationFilter === f
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Scrollable Area */}
                      <div className="notification-scroll-area-desktop px-4 flex-1 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-20 opacity-30">
                            <FaBell className="w-12 h-12 mb-4" />
                            <p className="text-sm font-bold">Inbox Empty</p>
                          </div>
                        ) : (
                          <div className="space-y-3 pb-6">
                            <AnimatePresence mode="popLayout">
                              {notifications.map((n, i) => (
                                <motion.div
                                  layout
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, x: 300, transition: { duration: 0.2 } }}
                                  transition={{ duration: 0.2 }}
                                  key={n._id}
                                  className={`notification-card group p-3.5 rounded-2xl border cursor-default ${!n.isRead
                                    ? 'bg-white dark:bg-gray-800 border-blue-50 dark:border-blue-900/30 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700'
                                    : 'bg-white/60 dark:bg-gray-800/50 border-transparent hover:bg-gray-50/50 dark:hover:bg-gray-800/60'
                                    }`}
                                >
                                  <div className="flex gap-4">
                                    {getNotificationIcon(n.type)}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2">
                                        <h4 className={`text-xs font-black truncate leading-tight ${!n.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                                          {n.title}
                                        </h4>
                                        <span className="text-[9px] font-black text-gray-300 dark:text-gray-600 uppercase whitespace-nowrap">
                                          {formatDate(n.createdAt)}
                                        </span>
                                      </div>
                                      <p className={`text-[11px] mt-1.5 leading-relaxed whitespace-pre-wrap ${!n.isRead ? 'text-gray-600 dark:text-gray-300 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                                        {n.link ? (
                                          <button
                                            onClick={() => {
                                              markAsRead(n._id);
                                              if (n.link.startsWith('http')) {
                                                window.open(n.link, '_blank');
                                              } else {
                                                setIsOpen(false);
                                                setTimeout(() => navigate(n.link), 0);
                                              }
                                            }}
                                            className="text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors underline decoration-blue-100 dark:decoration-blue-900 underline-offset-4"
                                          >
                                            {n.message}
                                          </button>
                                        ) : (
                                          <span>{n.message}</span>
                                        )}
                                      </p>

                                      <div className="flex items-center justify-between mt-3">
                                        <div className="flex gap-2">
                                          {n.adminId && (
                                            <span className="text-[9px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-tighter bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800">
                                              Official • STAFF
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button
                                            onClick={() => {
                                              navigator.clipboard.writeText(`${n.title}\n${n.message}`);
                                              setCopiedId(n._id);
                                              setTimeout(() => setCopiedId(null), 2000);
                                              toast.success('Copied');
                                            }}
                                            className={`p-1 transition-all ${copiedId === n._id ? 'text-emerald-500' : 'text-gray-300 hover:text-blue-500'}`}
                                          >
                                            {copiedId === n._id ? <FaCheck className="w-3 h-3" /> : <FaCopy className="w-3 h-3" />}
                                          </button>
                                          {!n.isRead && (
                                            <button
                                              onClick={() => markAsRead(n._id)}
                                              className="p-1 text-gray-300 hover:text-emerald-500 transition-all"
                                            >
                                              <FaCheck className="w-3 h-3" />
                                            </button>
                                          )}
                                          <button
                                            onClick={() => deleteNotification(n._id)}
                                            className="p-1 text-gray-300 hover:text-red-500 transition-all"
                                          >
                                            <FaTrash className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Send Notification Tab Content */
                    <div className="px-6 py-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                      {/* Send to All Users */}
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-5 rounded-3xl border border-green-100 dark:border-green-900/40 shadow-sm">
                        <h4 className="text-xs font-black text-green-900 dark:text-green-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <FaUsers className="w-3.5 h-3.5" />
                          Broadcast to All Users
                        </h4>
                        <form onSubmit={sendNotificationToAll} className="space-y-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Title</label>
                            <input
                              type="text"
                              value={allUsersTitle}
                              onChange={(e) => setAllUsersTitle(e.target.value)}
                              placeholder="Enter broadcast title..."
                              className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-green-100 dark:border-green-800 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-green-200 dark:focus:ring-green-900 focus:border-green-300 dark:focus:border-green-700 transition-all text-gray-900 dark:text-white"
                              required
                              maxLength={100}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Message</label>
                            <textarea
                              value={allUsersMessage}
                              onChange={(e) => setAllUsersMessage(e.target.value)}
                              placeholder="Enter broadcast message..."
                              rows={3}
                              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-green-100 dark:border-green-800 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-green-200 dark:focus:ring-green-900 focus:border-green-300 dark:focus:border-green-700 transition-all resize-none text-gray-900 dark:text-white"
                              required
                              maxLength={500}
                            />
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 text-right font-bold">
                              {allUsersMessage.length}/500
                            </div>
                          </div>
                          <button
                            type="submit"
                            disabled={sendingAllNotification || !allUsersTitle.trim() || !allUsersMessage.trim()}
                            className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {sendingAllNotification ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                Sending...
                              </>
                            ) : (
                              <>
                                <FaUsers className="w-3 h-3" />
                                Send to All Users
                              </>
                            )}
                          </button>
                        </form>
                      </div>

                      {/* Send to Specific User */}
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-5 rounded-3xl border border-blue-100 dark:border-blue-900/40 shadow-sm">
                        <h4 className="text-xs font-black text-blue-900 dark:text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <FaPaperPlane className="w-3.5 h-3.5" />
                          Send to Specific User
                        </h4>
                        <form onSubmit={sendNotificationToUser} className="space-y-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Search User</label>
                            <input
                              type="text"
                              value={userSearch}
                              onChange={(e) => {
                                setUserSearch(e.target.value);
                                if (selectedUser && e.target.value.trim()) setSelectedUser('');
                              }}
                              placeholder="Search by name, email, or mobile..."
                              className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-800 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 focus:border-blue-300 dark:focus:border-blue-700 transition-all text-gray-900 dark:text-white"
                              disabled={fetchingUsers}
                            />
                          </div>
                          <div className="relative">
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Select Recipient</label>
                            <select
                              value={selectedUser}
                              onChange={(e) => setSelectedUser(e.target.value)}
                              className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-800 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 focus:border-blue-300 dark:focus:border-blue-700 transition-all appearance-none text-gray-900 dark:text-white"
                              required
                              disabled={fetchingUsers}
                            >
                              <option value="" disabled>-- Select a user --</option>
                              {users.length === 0 && !fetchingUsers && (
                                <option value="" disabled>No users found. Click "Refresh Users" to load.</option>
                              )}
                              {users.filter(u => {
                                const q = userSearch.toLowerCase();
                                return !q || (u.username || u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                              }).slice(0, 50).map(u => (
                                <option key={u._id} value={u._id}>{u.username || u.email}</option>
                              ))}
                            </select>
                            {fetchingUsers && (
                              <div className="absolute right-3 top-10 transform">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                              </div>
                            )}
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="text-[10px] text-gray-500 font-bold">
                                {users.filter(u => {
                                  const q = userSearch.toLowerCase();
                                  return !q || (u.username || u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                                }).length} users available
                              </span>
                              <button
                                type="button"
                                onClick={fetchUsers}
                                disabled={fetchingUsers}
                                className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase tracking-wider"
                              >
                                {fetchingUsers ? 'Loading...' : 'Refresh Users'}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Subject</label>
                            <input
                              type="text"
                              value={title}
                              onChange={(e) => setTitle(e.target.value)}
                              placeholder="Enter subject..."
                              className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-800 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 focus:border-blue-300 dark:focus:border-blue-700 transition-all text-gray-900 dark:text-white"
                              required
                              maxLength={100}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Message</label>
                            <textarea
                              value={message}
                              onChange={(e) => setMessage(e.target.value)}
                              placeholder="Enter message..."
                              rows={3}
                              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-800 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 focus:border-blue-300 dark:focus:border-blue-700 transition-all resize-none text-gray-900 dark:text-white"
                              required
                              maxLength={500}
                            />
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 text-right font-bold">
                              {message.length}/500
                            </div>
                          </div>
                          <button
                            type="submit"
                            disabled={sendingUserNotification || !selectedUser || !title.trim() || !message.trim()}
                            className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {sendingUserNotification ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                Sending...
                              </>
                            ) : (
                              <>
                                <FaPaperPlane className="w-3 h-3" />
                                Send to User
                              </>
                            )}
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        )
      }

      {/* Enhanced Animations & Styles */}
      <style>{`
        @keyframes fadeInNotification {
          from { 
            opacity: 0; 
            transform: translateY(15px) scale(0.98); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
          }
        }
        
        @keyframes slideUpModal {
          from { 
            opacity: 0; 
            transform: translateY(30px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }

        @keyframes pulseBadge {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        
        @keyframes bellRing {
          0%, 100% { transform: rotate(0deg); }
          10%, 30%, 50%, 70%, 90% { transform: rotate(12deg); }
          20%, 40%, 60%, 80% { transform: rotate(-12deg); }
        }
        
        .animate-fadeInNotification {
          animation: fadeInNotification 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        
        .animate-modal-up {
          animation: slideUpModal 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        
        .animate-bell-ring {
          animation: bellRing 0.6s ease-in-out;
          transform-origin: top center;
        }

        .pulse-badge {
          animation: pulseBadge 2s infinite;
        }
        
        .glass-morphism {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px) saturate(180%);
          -webkit-backdrop-filter: blur(12px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        :global(.dark) .glass-morphism {
          background: rgba(17, 24, 39, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .notification-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .notification-card:hover {
          transform: translateX(4px);
        }

        .notification-scroll-area-mobile {
          max-height: calc(85vh - 240px);
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.1) transparent;
          padding: 1rem;
          -webkit-overflow-scrolling: touch;
        }
        
        .notification-scroll-area-mobile::-webkit-scrollbar {
          width: 4px;
        }
        
        .notification-scroll-area-mobile::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.1);
          border-radius: 10px;
        }
        :global(.dark) .notification-scroll-area-mobile::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
        }
        
        .notification-scroll-area-desktop {
          max-height: 480px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.1) transparent;
        }
        :global(.dark) .notification-scroll-area-desktop {
          scrollbar-color: rgba(255,255,255,0.2) transparent;
        }
        
        .notification-scroll-area-desktop::-webkit-scrollbar {
          width: 5px;
        }
        
        .notification-scroll-area-desktop::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.1);
          border-radius: 10px;
        }
        :global(.dark) .notification-scroll-area-desktop::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
        }

        .tab-button {
          position: relative;
          overflow: hidden;
        }

        .tab-button::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          width: 0;
          height: 2px;
          background: #3b82f6;
          transition: all 0.3s ease;
          transform: translateX(-50%);
        }

        .tab-button.active::after {
          width: 100%;
        }

        .custom-shadow {
          box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.1), 0 4px 12px -2px rgba(0, 0, 0, 0.05);
        }
      `}</style>
    </div >
  );
}