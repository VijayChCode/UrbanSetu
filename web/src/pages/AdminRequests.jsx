import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import { toast } from 'react-toastify';
import AdminRequestsSkeleton from '../components/skeletons/AdminRequestsSkeleton';
import { authenticatedFetch } from '../utils/auth';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';

import { usePageTitle } from '../hooks/usePageTitle';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const AdminRequests = () => {
  // Set page title
  usePageTitle("Admin Requests - Approval Management");

  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'approved', 'rejected'
  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState({
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmButtonClass: 'bg-green-500 hover:bg-green-600',
    userId: null
  });
  const [actionLoading, setActionLoading] = useState({
    approve: {},
    reject: {},
    reapprove: {}
  });

  useEffect(() => {
    // Wait for currentUser to be loaded
    if (!currentUser) {
      return;
    }

    if (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin' && !currentUser.isDefaultAdmin) {
      navigate('/sign-in');
      return;
    }

    fetchAllRequests();
  }, [currentUser?._id, navigate]);

  const fetchAllRequests = async () => {
    try {
      setLoading(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/all-requests`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch requests');
      }

      setAllRequests(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (userId) => {
    const performApprove = async () => {
      setActionLoading(prev => ({ ...prev, approve: { ...prev.approve, [userId]: true } }));
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/approve/${userId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentUserId: currentUser._id
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || 'Failed to approve request');
        }

        // Update the request in the list
        setAllRequests(prev => prev.map(request =>
          request._id === userId
            ? { ...request, adminApprovalStatus: 'approved', role: 'admin' }
            : request
        ));

        // Show success message
        toast.success('Admin request approved successfully!');
        setShowConfirmModal(false);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setActionLoading(prev => ({ ...prev, approve: { ...prev.approve, [userId]: false } }));
      }
    };

    setConfirmModalData({
      title: 'Approve Admin Request',
      message: 'Are you sure you want to approve this admin request? They will be granted administrative access to the platform.',
      onConfirm: performApprove,
      confirmText: 'Approve',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-green-500 hover:bg-green-600',
      userId
    });
    setShowConfirmModal(true);
  };

  const handleReject = (userId) => {
    const performReject = async () => {
      setActionLoading(prev => ({ ...prev, reject: { ...prev.reject, [userId]: true } }));
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/reject/${userId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentUserId: currentUser._id
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || 'Failed to reject request');
        }

        // Update the request in the list
        setAllRequests(prev => prev.map(request =>
          request._id === userId
            ? { ...request, adminApprovalStatus: 'rejected', role: 'user' }
            : request
        ));

        // Show success message
        toast.success('Admin request rejected successfully!');
        setShowConfirmModal(false);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setActionLoading(prev => ({ ...prev, reject: { ...prev.reject, [userId]: false } }));
      }
    };

    setConfirmModalData({
      title: 'Reject Admin Request',
      message: 'Are you sure you want to reject this admin request? They will not be granted admin access.',
      onConfirm: performReject,
      confirmText: 'Reject',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-red-500 hover:bg-red-600',
      userId
    });
    setShowConfirmModal(true);
  };

  const handleReapprove = (userId) => {
    const performReapprove = async () => {
      setActionLoading(prev => ({ ...prev, reapprove: { ...prev.reapprove, [userId]: true } }));
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/reapprove/${userId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentUserId: currentUser._id
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || 'Failed to reapprove request');
        }

        // Update the request in the list
        setAllRequests(prev => prev.map(request =>
          request._id === userId
            ? { ...request, adminApprovalStatus: 'approved', role: 'admin' }
            : request
        ));

        // Show success message
        toast.success('Admin request reapproved successfully!');
        setShowConfirmModal(false);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setActionLoading(prev => ({ ...prev, reapprove: { ...prev.reapprove, [userId]: false } }));
      }
    };

    setConfirmModalData({
      title: 'Re-approve Admin Request',
      message: 'Are you sure you want to re-approve this admin request? They will be granted administrative access again.',
      onConfirm: performReapprove,
      confirmText: 'Re-approve',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-blue-500 hover:bg-blue-600',
      userId
    });
    setShowConfirmModal(true);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter requests based on selected filter
  const filteredRequests = allRequests.filter(request => {
    if (filter === 'all') return true;
    if (filter === 'pending') return request.adminApprovalStatus === 'pending';
    if (filter === 'approved') return request.adminApprovalStatus === 'approved';
    if (filter === 'rejected') return request.adminApprovalStatus === 'rejected';
    return true;
  });

  // Get status badge styling
  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
    }
  };

  // Get action buttons based on status
  const getActionButtons = (request) => {
    if (request.adminApprovalStatus === 'pending') {
      return (
        <div className="flex gap-2">
          <button
            onClick={() => handleApprove(request._id)}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
          >
            <span>✓</span>
            <span>Approve</span>
          </button>
          <button
            onClick={() => handleReject(request._id)}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
          >
            <span>✕</span>
            <span>Reject</span>
          </button>
        </div>
      );
    } else if (request.adminApprovalStatus === 'rejected') {
      return (
        <div className="flex gap-2">
          <button
            onClick={() => handleReapprove(request._id)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
          >
            <span>↻</span>
            <span>Re-approve</span>
          </button>
        </div>
      );
    } else if (request.adminApprovalStatus === 'approved') {
      return (
        <div className="flex items-center text-green-600 dark:text-green-400 font-medium">
          <span className="mr-2">✓</span>
          <span>Approved</span>
        </div>
      );
    }
    return null;
  };

  // Show loading while currentUser is not loaded
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
        <div className="flex flex-col justify-center items-center h-64 gap-4">
          <UrbanSetuSpinner size="xl" />
          <p className="text-gray-500 dark:text-gray-400 animate-pulse">Loading security context...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <AdminRequestsSkeleton />;
  }



  // Show access denied for non-default admins
  if (!(currentUser.isDefaultAdmin || currentUser.role === 'rootadmin')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 transition-colors duration-300">
            <div className="text-center py-12">
              <div className="text-red-500 text-6xl mb-4">🚫</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Access Denied</h3>
              <p className="text-gray-600 dark:text-gray-300">Only the default admin or root admin can approve new admin requests.</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Current user: {currentUser.email}</p>
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => navigate('/admin')}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 text-base mx-auto"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 transition-colors duration-300">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Requests</h1>
                <p className="text-gray-600 dark:text-gray-300 mt-2">Manage pending admin approval requests (Root Admin Only)</p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">Welcome, {currentUser.email} (Root Admin)</p>
              </div>
              <div className="flex gap-2">
                <div className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-3 py-2 rounded-full text-sm font-medium">
                  {allRequests.filter(r => r.adminApprovalStatus === 'pending').length} Pending
                </div>
                <div className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-3 py-2 rounded-full text-sm font-medium">
                  {allRequests.filter(r => r.adminApprovalStatus === 'approved').length} Approved
                </div>
                <div className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2 rounded-full text-sm font-medium">
                  {allRequests.filter(r => r.adminApprovalStatus === 'rejected').length} Rejected
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {[
                { key: 'all', label: 'All Requests', count: allRequests.length },
                { key: 'pending', label: 'Pending', count: allRequests.filter(r => r.adminApprovalStatus === 'pending').length },
                { key: 'approved', label: 'Approved', count: allRequests.filter(r => r.adminApprovalStatus === 'approved').length },
                { key: 'rejected', label: 'Rejected', count: allRequests.filter(r => r.adminApprovalStatus === 'rejected').length }
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${filter === key
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            {filteredRequests.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 dark:text-gray-500 text-6xl mb-4">📋</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {filter === 'all' ? 'No Admin Requests' : `No ${filter.charAt(0).toUpperCase() + filter.slice(1)} Requests`}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {filter === 'all'
                    ? 'No admin requests have been submitted yet.'
                    : `No admin requests with ${filter} status found.`
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredRequests.map((request) => (
                  <div key={request._id} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-xl p-6 border border-gray-200 dark:border-gray-500 hover:shadow-lg transition-all duration-200">
                    <div className="flex flex-col h-full">
                      {/* User Info */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{request.username}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(request.adminApprovalStatus)}`}>
                            {request.adminApprovalStatus}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                          <p className="truncate"><strong>Email:</strong> {request.email}</p>
                          <p><strong>Mobile:</strong> {request.mobileNumber || 'Not provided'}</p>
                          <p><strong>Role:</strong> {request.role}</p>
                          <p><strong>Requested:</strong> {formatDate(request.adminRequestDate || request.createdAt)}</p>
                          {request.adminApprovalDate && (
                            <p><strong>Processed:</strong> {formatDate(request.adminApprovalDate)}</p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-500">
                        {getActionButtons(request)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 animate-scale-in border border-white/20 dark:border-gray-700">
            <div className="p-6">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">{confirmModalData.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8">{confirmModalData.message}</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-6 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 font-semibold transition-all"
                >
                  {confirmModalData.cancelText}
                </button>
                <button
                  onClick={() => confirmModalData.onConfirm && confirmModalData.onConfirm()}
                  className={`px-6 py-2.5 rounded-xl text-white font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${confirmModalData.confirmButtonClass}`}
                  disabled={actionLoading.approve[confirmModalData.userId] || actionLoading.reject[confirmModalData.userId] || actionLoading.reapprove[confirmModalData.userId]}
                >
                  {(actionLoading.approve[confirmModalData.userId] || actionLoading.reject[confirmModalData.userId] || actionLoading.reapprove[confirmModalData.userId]) ? (
                    <>
                      <UrbanSetuSpinner size="sm" isBright={true} />
                      {actionLoading.approve[confirmModalData.userId] ? 'Approving...' :
                        actionLoading.reject[confirmModalData.userId] ? 'Rejecting...' : 'Re-approving...'}
                    </>
                  ) : (
                    confirmModalData.confirmText
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ContactSupportWrapper />
    </>
  );
};

export default AdminRequests; 