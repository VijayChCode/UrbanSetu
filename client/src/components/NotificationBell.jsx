import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { FaBell, FaTimes, FaCheck, FaTrash, FaEye, FaCalendarAlt, FaEdit, FaEnvelope, FaPaperPlane, FaUsers, FaUser } from 'react-icons/fa';
import { toast } from 'react-toastify';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function NotificationBell({ mobile = false }) {
  const { currentUser } = useSelector((state) => state.user);
  const [notifications, setNotifications] = useState([]);
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
  const [sendingNotification, setSendingNotification] = useState(false);
  const [fetchingUsers, setFetchingUsers] = useState(false);
  
  // Separate state for "Send to All Users" form
  const [allUsersTitle, setAllUsersTitle] = useState('');
  const [allUsersMessage, setAllUsersMessage] = useState('');
  const bellRef = useRef(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!currentUser) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/user/${currentUser._id}`, {
        credentials: 'include',
      });
      const data = await res.json();
      
      if (res.ok) {
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Fetch unread count
  const fetchUnreadCount = async () => {
    if (!currentUser) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/user/${currentUser._id}/unread-count`, {
        credentials: 'include',
      });
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
      console.log('Fetching users for admin notification...');
      const res = await fetch(`${API_BASE_URL}/api/notifications/admin/users`, {
        credentials: 'include',
      });
      const data = await res.json();
      
      console.log('Users fetch response:', res.status, data);
      
      if (res.ok) {
        setUsers(data);
        console.log('Users loaded:', data.length, 'users');
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

    setSendingNotification(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/admin/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
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
        setActiveTab('notifications');
      } else {
        toast.error(data.message || 'Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Failed to send notification');
    } finally {
      setSendingNotification(false);
    }
  };

  // Send notification to all users
  const sendNotificationToAll = async (e) => {
    e.preventDefault();
    
    if (!allUsersTitle.trim() || !allUsersMessage.trim()) {
      toast.error('Please fill in title and message');
      return;
    }

    setSendingNotification(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/admin/send-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
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
        setActiveTab('notifications');
      } else {
        toast.error(data.message || 'Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Failed to send notification');
    } finally {
      setSendingNotification(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ userId: currentUser._id }),
      });

      if (res.ok) {
        // Update local state
        setNotifications(prev => 
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
      const res = await fetch(`${API_BASE_URL}/api/notifications/user/${currentUser._id}/read-all`, {
        method: 'PUT',
        credentials: 'include',
      });

      if (res.ok) {
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, isRead: true, readAt: new Date() }))
        );
        setUnreadCount(0);
        toast.success('All notifications marked as read');
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ userId: currentUser._id }),
      });

      if (res.ok) {
        setNotifications(prev => prev.filter(notif => notif._id !== notificationId));
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
    switch (type) {
      case 'property_edited':
        return <FaEdit className="w-4 h-4 text-blue-500" />;
      case 'property_deleted':
        return <FaTrash className="w-4 h-4 text-red-500" />;
      case 'appointment_updated':
        return <FaCalendarAlt className="w-4 h-4 text-green-500" />;
      case 'admin_message':
        return <FaEnvelope className="w-4 h-4 text-purple-500" />;
      default:
        return <FaBell className="w-4 h-4 text-gray-500" />;
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
    console.log('useEffect triggered:', { isOpen, activeTab, currentUser: !!currentUser, isAdmin: isAdmin() });
    
    if (isOpen && activeTab === 'send' && currentUser && isAdmin()) {
      console.log('Fetching users for send tab...');
      fetchUsers();
    }
  }, [isOpen, activeTab, currentUser]);

  // Don't render if no user
  if (!currentUser) return null;

  // Debug: Check admin role
  console.log('Current user:', currentUser);
  console.log('Current user role:', currentUser.role);
  console.log('Is admin:', currentUser.role === 'admin' || currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin);

  // Helper function to check if user is admin
  const isAdmin = () => {
    return currentUser.role === 'admin' || 
           currentUser.role === 'rootadmin' || 
           currentUser.isDefaultAdmin ||
           currentUser.isAdmin;
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        ref={bellRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 text-yellow-400 hover:text-yellow-300 transition-all duration-300 hover:scale-110 ${
          isRinging ? 'animate-bell-ring' : ''
        }`}
        title="Notifications"
      >
        <FaBell className="w-5 h-5 drop-shadow-lg" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown or Modal */}
      {isOpen && (
        mobile ? (
          // Mobile: Fullscreen Modal
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-60">
            <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto relative animate-fade-in">
              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 z-10"
                aria-label="Close notifications"
              >
                <FaTimes className="w-5 h-5" />
              </button>
              {/* Content */}
              <div className="pt-8 pb-4 px-4">
                {/* Header with Tabs */}
                <div className="border-b border-gray-100 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 text-center">Notifications</h3>
                  {isAdmin() && (
                    <div className="flex border-b border-gray-200 mt-2">
                      <button
                        onClick={() => setActiveTab('notifications')}
                        className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                          activeTab === 'notifications'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <FaBell className="w-4 h-4 inline mr-2" />
                        Notifications
                      </button>
                      <button
                        onClick={() => setActiveTab('send')}
                        className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                          activeTab === 'send'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <FaEnvelope className="w-4 h-4 inline mr-2" />
                        Send Message
                      </button>
                    </div>
                  )}
                </div>
                {/* Tab Content (reuse existing JSX for notifications/send) */}
                {activeTab === 'notifications' ? (
                  <>
                    {/* Notifications Header Actions */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">
                          <FaBell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p>No notifications yet</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {notifications.map((notification) => (
                            <div
                              key={notification._id}
                              className={`p-4 hover:bg-gray-50 transition-colors ${
                                !notification.isRead ? 'bg-blue-50' : ''
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 mt-1">
                                  {getNotificationIcon(notification.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-gray-900">
                                        {notification.title}
                                      </h4>
                                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-line break-words max-w-xs md:max-w-md lg:max-w-lg">
                                        {notification.message}
                                      </p>
                                      <div className="flex items-center gap-2 mt-2">
                                        <span className="text-xs text-gray-500">
                                          {formatDate(notification.createdAt)}
                                        </span>
                                        {/* Show 'by Organization' for admin notifications on user side */}
                                        {notification.adminId && !isAdmin() && (
                                          <span className="text-xs text-blue-600">
                                            by Organization
                                          </span>
                                        )}
                                        {/* Optionally, for admins, still show admin name/email */}
                                        {notification.adminId && isAdmin() && (
                                          <span className="text-xs text-blue-600">
                                            by {notification.adminId.username || notification.adminId.email}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 ml-2">
                                      {!notification.isRead && (
                                        <button
                                          onClick={() => markAsRead(notification._id)}
                                          className="p-1 text-green-600 hover:text-green-800 transition-colors"
                                          title="Mark as read"
                                        >
                                          <FaCheck className="w-3 h-3" />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => deleteNotification(notification._id)}
                                        className="p-1 text-red-600 hover:text-red-800 transition-colors"
                                        title="Delete notification"
                                      >
                                        <FaTrash className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                      <div className="p-3 border-t border-gray-100 bg-gray-50">
                        <button
                          onClick={() => {
                            // Clear all notifications
                            fetch(`${API_BASE_URL}/api/notifications/user/${currentUser._id}/all`, {
                              method: 'DELETE',
                              credentials: 'include',
                            }).then(() => {
                              setNotifications([]);
                              setUnreadCount(0);
                              toast.success('All notifications cleared');
                            });
                          }}
                          className="text-sm text-red-600 hover:text-red-800 font-medium"
                        >
                          Clear all notifications
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  /* Send Notification Tab */
                  <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
                    {/* Send to All Users */}
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                        <FaUsers className="w-4 h-4" />
                        Send to All Users
                      </h4>
                      <form onSubmit={sendNotificationToAll} className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Title
                          </label>
                          <input
                            type="text"
                            value={allUsersTitle}
                            onChange={(e) => setAllUsersTitle(e.target.value)}
                            placeholder="Enter title..."
                            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                            required
                            maxLength={100}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Message
                          </label>
                          <textarea
                            value={allUsersMessage}
                            onChange={(e) => setAllUsersMessage(e.target.value)}
                            placeholder="Enter message..."
                            rows={3}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-gray-900"
                            required
                            maxLength={500}
                          />
                          <div className="text-xs text-gray-500 mt-1 text-right">
                            {allUsersMessage.length}/500
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={sendingNotification || !allUsersTitle.trim() || !allUsersMessage.trim()}
                          className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {sendingNotification ? (
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
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                        <FaUser className="w-4 h-4" />
                        Send to Specific User
                      </h4>
                      <form onSubmit={sendNotificationToUser} className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Select User
                          </label>
                          <div className="relative">
                            <select
                              value={selectedUser}
                              onChange={(e) => setSelectedUser(e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                              required
                              disabled={fetchingUsers}
                            >
                              <option value="" disabled>
                                -- Select a user --
                              </option>
                              {users.length === 0 && !fetchingUsers && (
                                <option value="" disabled>No users found. Click "Refresh Users" to load.</option>
                              )}
                              {users.map((user) => (
                                <option key={user._id} value={user._id}>
                                  {user.email} {user.username && `(${user.username})`}
                                </option>
                              ))}
                            </select>
                            {fetchingUsers && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-gray-500">
                              {users.length} users available
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
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Title
                          </label>
                          <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Enter title..."
                            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                            required
                            maxLength={100}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Message
                          </label>
                          <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Enter message..."
                            rows={3}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
                            required
                            maxLength={500}
                          />
                          <div className="text-xs text-gray-500 mt-1 text-right">
                            {message.length}/500
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={sendingNotification || !selectedUser || !title.trim() || !message.trim()}
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {sendingNotification ? (
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
          </div>
        ) : (
          // Desktop: Dropdown
          <div className="absolute left-1/2 -translate-x-1/2 right-auto mt-2 w-full max-w-xs sm:w-96 sm:left-auto sm:right-0 sm:-translate-x-0 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden">
          {/* Header with Tabs */}
          <div className="border-b border-gray-100">
            <div className="flex items-center justify-between p-4">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            </div>
            
            {/* Tabs - Show send tab only for admins */}
            {isAdmin() && (
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                    activeTab === 'notifications'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FaBell className="w-4 h-4 inline mr-2" />
                  Notifications
                </button>
                <button
                  onClick={() => setActiveTab('send')}
                  className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                    activeTab === 'send'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FaEnvelope className="w-4 h-4 inline mr-2" />
                  Send Message
                </button>
              </div>
            )}
          </div>

          {/* Tab Content */}
          {activeTab === 'notifications' ? (
            <>
              {/* Notifications Header Actions */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
              </div>

              {/* Notifications List */}
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <FaBell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {notifications.map((notification) => (
                      <div
                        key={notification._id}
                        className={`p-4 hover:bg-gray-50 transition-colors ${
                          !notification.isRead ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="text-sm font-medium text-gray-900">
                                  {notification.title}
                                </h4>
                                <p className="text-sm text-gray-600 mt-1 whitespace-pre-line break-words max-w-xs md:max-w-md lg:max-w-lg">
                                  {notification.message}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs text-gray-500">
                                    {formatDate(notification.createdAt)}
                                  </span>
                                  {/* Show 'by Organization' for admin notifications on user side */}
                                  {notification.adminId && !isAdmin() && (
                                    <span className="text-xs text-blue-600">
                                      by Organization
                                    </span>
                                  )}
                                  {/* Optionally, for admins, still show admin name/email */}
                                  {notification.adminId && isAdmin() && (
                                    <span className="text-xs text-blue-600">
                                      by {notification.adminId.username || notification.adminId.email}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 ml-2">
                                {!notification.isRead && (
                                  <button
                                    onClick={() => markAsRead(notification._id)}
                                    className="p-1 text-green-600 hover:text-green-800 transition-colors"
                                    title="Mark as read"
                                  >
                                    <FaCheck className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  onClick={() => deleteNotification(notification._id)}
                                  className="p-1 text-red-600 hover:text-red-800 transition-colors"
                                  title="Delete notification"
                                >
                                  <FaTrash className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="p-3 border-t border-gray-100 bg-gray-50">
                  <button
                    onClick={() => {
                      // Clear all notifications
                      fetch(`${API_BASE_URL}/api/notifications/user/${currentUser._id}/all`, {
                        method: 'DELETE',
                        credentials: 'include',
                      }).then(() => {
                        setNotifications([]);
                        setUnreadCount(0);
                        toast.success('All notifications cleared');
                      });
                    }}
                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Clear all notifications
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Send Notification Tab */
            <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
              {/* Send to All Users */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <FaUsers className="w-4 h-4" />
                  Send to All Users
                </h4>
                <form onSubmit={sendNotificationToAll} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={allUsersTitle}
                      onChange={(e) => setAllUsersTitle(e.target.value)}
                      placeholder="Enter title..."
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                      required
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Message
                    </label>
                    <textarea
                      value={allUsersMessage}
                      onChange={(e) => setAllUsersMessage(e.target.value)}
                      placeholder="Enter message..."
                      rows={3}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-gray-900"
                      required
                      maxLength={500}
                    />
                    <div className="text-xs text-gray-500 mt-1 text-right">
                      {allUsersMessage.length}/500
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={sendingNotification || !allUsersTitle.trim() || !allUsersMessage.trim()}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {sendingNotification ? (
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
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <FaUser className="w-4 h-4" />
                  Send to Specific User
                </h4>
                <form onSubmit={sendNotificationToUser} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select User
                    </label>
                    <div className="relative">
                      <select
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                        required
                        disabled={fetchingUsers}
                      >
                        <option value="" disabled>
                          -- Select a user --
                        </option>
                        {users.length === 0 && !fetchingUsers && (
                          <option value="" disabled>No users found. Click "Refresh Users" to load.</option>
                        )}
                        {users.map((user) => (
                          <option key={user._id} value={user._id}>
                            {user.email} {user.username && `(${user.username})`}
                          </option>
                        ))}
                      </select>
                      {fetchingUsers && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">
                        {users.length} users available
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter title..."
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      required
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Message
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Enter message..."
                      rows={3}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
                      required
                      maxLength={500}
                    />
                    <div className="text-xs text-gray-500 mt-1 text-right">
                      {message.length}/500
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={sendingNotification || !selectedUser || !title.trim() || !message.trim()}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {sendingNotification ? (
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
        )
      )}
    </div>
  );
} 