import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import ContactSupportWrapper from "../components/ContactSupportWrapper";

const AdminRequests = () => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();

  useEffect(() => {
    // Debug: Log current user data
    console.log('=== AdminRequests Page Debug ===');
    console.log('Current User:', currentUser);
    console.log('User Email:', currentUser?.email);
    console.log('User Role:', currentUser?.role);
    console.log('Is Default Admin:', currentUser?.isDefaultAdmin);
    console.log('================================');
    
    // Wait for currentUser to be loaded
    if (!currentUser) {
      console.log('No current user yet, waiting...');
      return;
    }

    if (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin' && !currentUser.isDefaultAdmin) {
      console.log('User is not admin or rootadmin, redirecting...');
      navigate('/sign-in');
      return;
    }

    console.log('User is default admin, fetching requests...');
    fetchPendingRequests();
  }, [currentUser, navigate]);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:3000/api/admin/pending-requests', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch requests');
      }
      
      setPendingRequests(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    try {
      const res = await fetch(`http://localhost:3000/api/admin/approve/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          currentUserId: currentUser._id,
          rootAdminPassword: 'Salendra@2004' // Root admin password
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to approve request');
      }
      
      // Remove the approved request from the list
      setPendingRequests(prev => prev.filter(request => request._id !== userId));
      
      // Show success message
      alert('Admin request approved successfully!');
      
      // Refresh the page to update header count
      window.location.reload();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleReject = async (userId) => {
    try {
      const res = await fetch(`http://localhost:3000/api/admin/reject/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          currentUserId: currentUser._id,
          rootAdminPassword: 'Salendra@2004' // Root admin password
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to reject request');
      }
      
      // Remove the rejected request from the list
      setPendingRequests(prev => prev.filter(request => request._id !== userId));
      
      // Show success message
      alert('Admin request rejected successfully!');
      
      // Refresh the page to update header count
      window.location.reload();
    } catch (error) {
      alert(error.message);
    }
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

  // Show loading while currentUser is not loaded
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // Debug: Log the final check
  console.log('Final check - User email:', currentUser.email);
  console.log('Final check - Is default admin:', currentUser.isDefaultAdmin);

  // Show access denied for non-default admins
  if (!(currentUser.isDefaultAdmin || currentUser.role === 'rootadmin')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center py-12">
              <div className="text-red-500 text-6xl mb-4">🚫</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h3>
              <p className="text-gray-600">Only the default admin or root admin can approve new admin requests.</p>
              <p className="text-sm text-gray-500 mt-2">Current user: {currentUser.email}</p>
              <button 
                onClick={() => navigate('/admin')}
                className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Admin Requests</h1>
                <p className="text-gray-600 mt-2">Manage pending admin approval requests (Root Admin Only)</p>
                <p className="text-sm text-green-600 mt-1">Welcome, {currentUser.email} (Root Admin)</p>
              </div>
              <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium">
                {pendingRequests.length} Pending
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            {pendingRequests.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📋</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Pending Requests</h3>
                <p className="text-gray-600">All admin requests have been processed.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {pendingRequests.map((request) => (
                  <div key={request._id} className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-lg">
                            {request.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{request.username}</h3>
                          <p className="text-gray-600">{request.email}</p>
                          <p className="text-sm text-gray-500">
                            Requested: {formatDate(request.adminRequestDate)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleApprove(request._id)}
                          className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
                        >
                          <span>✓</span>
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleReject(request._id)}
                          className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
                        >
                          <span>✕</span>
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <ContactSupportWrapper />
    </>
  );
};

export default AdminRequests; 