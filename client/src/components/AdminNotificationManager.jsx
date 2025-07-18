import React, { useState, useEffect } from 'react';
import { FaBell, FaTimes, FaPaperPlane, FaUsers, FaEnvelope } from 'react-icons/fa';
import { toast } from 'react-toastify';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminNotificationManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingUsers, setFetchingUsers] = useState(false);

  // Fetch all users for dropdown
  const fetchUsers = async () => {
    setFetchingUsers(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/admin/users`, {
        credentials: 'include',
      });
      const data = await res.json();
      
      if (res.ok) {
        setUsers(data);
      } else {
        toast.error('Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setFetchingUsers(false);
    }
  };

  // Send notification
  const sendNotification = async (e) => {
    e.preventDefault();
    
    if (!selectedUser || !title.trim() || !message.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
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
        setIsOpen(false);
      } else {
        toast.error(data.message || 'Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  // Load users when component opens
  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  return (
    <div className="relative">
      {/* Admin Notification Manager Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105"
        title="Send Notifications to Users"
      >
        <FaEnvelope className="w-5 h-5 drop-shadow-sm" />
      </button>

      {/* Notification Manager Modal */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FaBell className="w-5 h-5 text-purple-500" />
              Send Notification
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <FaTimes className="w-4 h-4" />
            </button>
          </div>

          {/* Form with custom scrollbar */}
          <div className="notification-scroll-area max-h-96 overflow-y-auto">
            <form onSubmit={sendNotification} className="p-4 space-y-4">
              {/* User Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select User
                </label>
                <div className="relative">
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                    disabled={fetchingUsers}
                  >
                    <option value="">Choose a user...</option>
                    {users.map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.email} {user.username && `(${user.username})`}
                      </option>
                    ))}
                  </select>
                  {fetchingUsers && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notification Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter notification title..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                  maxLength={100}
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your message..."
                  rows={4}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  required
                  maxLength={500}
                />
                <div className="text-xs text-gray-500 mt-1 text-right">
                  {message.length}/500
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !selectedUser || !title.trim() || !message.trim()}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium py-3 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <FaPaperPlane className="w-4 h-4" />
                    Send Notification
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
} 