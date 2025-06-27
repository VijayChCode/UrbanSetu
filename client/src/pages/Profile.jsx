import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { FaEdit, FaUser, FaEnvelope, FaPhone, FaKey, FaTrash, FaSignOutAlt, FaHome, FaCalendarAlt, FaHeart, FaEye, FaCrown, FaTimes, FaCheck } from "react-icons/fa";
import {
  updateUserStart,
  updateUserSuccess,
  updateUserFailure,
  deleteUserStart,
  deleteUserSuccess,
  deleteUserFailure,
  signoutUserStart,
  signoutUserSuccess,
  signoutUserFailure,
} from "../redux/user/userSlice";
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import { useWishlist } from "../WishlistContext";
import { toast } from 'react-toastify';

export default function Profile() {
  const { currentUser, error } = useSelector((state) => state.user);
  const { wishlist } = useWishlist();
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({});
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [userStats, setUserStats] = useState({
    listings: 0,
    appointments: 0,
    wishlist: 0
  });
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState("");
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [showTransferPasswordModal, setShowTransferPasswordModal] = useState(false);
  const [transferDeletePassword, setTransferDeletePassword] = useState("");
  const [transferDeleteError, setTransferDeleteError] = useState("");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAdmins, setTransferAdmins] = useState([]);
  const [selectedTransferAdmin, setSelectedTransferAdmin] = useState("");
  const [transferPassword, setTransferPassword] = useState("");
  const [transferError, setTransferError] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [mobileError, setMobileError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Hide My Appointments button in admin context
  const isAdminProfile = window.location.pathname.startsWith('/admin');

  // Fetch user stats
  useEffect(() => {
    if (currentUser) {
      fetchUserStats();
    }
  }, [currentUser]);

  // Update wishlist count when wishlist changes
  useEffect(() => {
    if (currentUser) {
      setUserStats(prev => ({
        ...prev,
        wishlist: wishlist.length
      }));
    }
  }, [wishlist, currentUser]);

  const fetchUserStats = async () => {
    try {
      if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) {
        // Fetch admin-specific stats
        const [listingsRes, appointmentsRes] = await Promise.all([
          fetch('/api/listing/user', { credentials: 'include' }),
          fetch('/api/bookings/', { credentials: 'include' })
        ]);

        const listingsData = await listingsRes.json();
        const appointmentsData = await appointmentsRes.json();

        setUserStats(prev => ({
          listings: Array.isArray(listingsData)
            ? listingsData.filter(listing => listing.userRef === currentUser._id).length
            : 0,
          appointments: Array.isArray(appointmentsData) ? appointmentsData.length : 0,
          wishlist: prev.wishlist // Keep the wishlist count from context
        }));
      } else {
        // Fetch regular user stats
        const [listingsRes, appointmentsRes] = await Promise.all([
          fetch('/api/listing/user', { credentials: 'include' }),
          fetch(`/api/bookings/user/${currentUser._id}`, { credentials: 'include' })
        ]);

        const listingsData = await listingsRes.json();
        const appointmentsData = await appointmentsRes.json();

        setUserStats(prev => ({
          listings: Array.isArray(listingsData) ? listingsData.length : 0,
          appointments: appointmentsData.count || 0,
          wishlist: prev.wishlist // Keep the wishlist count from context
        }));
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
      // Set default values if API calls fail
      setUserStats(prev => ({
        listings: 0,
        appointments: 0,
        wishlist: prev.wishlist // Keep the wishlist count from context
      }));
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    });
  };

  const onSubmitForm = async (e) => {
    e.preventDefault();
    setUpdateError("");
    setUpdateSuccess(false);
    setEmailError("");
    setMobileError("");
    setLoading(true);
    // Validate mobile number
    if (!formData.mobileNumber || !/^[0-9]{10}$/.test(formData.mobileNumber)) {
      setMobileError("Please provide a valid 10-digit mobile number");
      setLoading(false);
      return;
    }
    try {
      dispatch(updateUserStart());
      const apiUrl = `/api/user/update/${currentUser._id}`;
      const options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
        }),
      };
      const res = await fetch(apiUrl, options);
      const data = await res.json();
      // Handle new backend validation responses
      if (data.status === "email_exists") {
        setEmailError("Email already registered. Please use a different one.");
        dispatch(updateUserFailure("Email already registered. Please use a different one."));
        setLoading(false);
        return;
      }
      if (data.status === "mobile_exists") {
        setMobileError("Mobile number already in use. Please choose another one.");
        dispatch(updateUserFailure("Mobile number already in use. Please choose another one."));
        setLoading(false);
        return;
      }
      if (data.status === "mobile_invalid") {
        setMobileError("Please provide a valid 10-digit mobile number");
        dispatch(updateUserFailure("Please provide a valid 10-digit mobile number"));
        setLoading(false);
        return;
      }
      if (data.status === "success") {
        dispatch(updateUserSuccess(data.updatedUser));
        setUpdateSuccess(true);
        setIsEditing(false);
        setLoading(false);
        setTimeout(() => {
          setUpdateSuccess(false);
        }, 3000);
        return;
      }
      // fallback for other errors
      if (data.success === false || data.status === "error") {
        setUpdateError(data.message || "Profile Update Failed!");
        dispatch(updateUserFailure(data.message));
        setLoading(false);
        return;
      }
      setLoading(false);
    } catch (error) {
      setUpdateError("Profile Update Failed!");
      dispatch(updateUserFailure(error.message));
      setLoading(false);
    }
  };

  const onHandleDelete = async () => {
    // Check if user is default admin
    if (currentUser.isDefaultAdmin) {
      setShowAdminModal(true);
      return;
    }
    setShowPasswordModal(true);
  };

  const handleConfirmDelete = async () => {
    setDeleteError("");
    if (!deletePassword) {
      setDeleteError("Password is required");
      return;
    }
    try {
      dispatch(deleteUserStart());
      const apiUrl = `/api/user/delete/${currentUser._id}`;
      const options = {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
        credentials: 'include',
      };
      const res = await fetch(apiUrl, options);
      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        data = {};
      }
      if (res.status === 401) {
        setShowPasswordModal(false);
        alert("Your session has expired. Please sign in again.");
        // Signout and redirect
        dispatch(signoutUserStart());
        const signoutRes = await fetch("/api/auth/signout");
        const signoutData = await signoutRes.json();
        if (signoutData.success === false) {
          dispatch(signoutUserFailure(signoutData.message));
        } else {
          dispatch(signoutUserSuccess(signoutData));
        }
        navigate('/sign-in');
        return;
      }
      if (data.message && data.message.toLowerCase().includes('password')) {
        setShowPasswordModal(false);
        alert("Your session has expired. Please sign in again.");
        // Signout and redirect
        dispatch(signoutUserStart());
        const signoutRes = await fetch("/api/auth/signout");
        const signoutData = await signoutRes.json();
        if (signoutData.success === false) {
          dispatch(signoutUserFailure(signoutData.message));
        } else {
          dispatch(signoutUserSuccess(signoutData));
        }
        navigate('/sign-in');
        return;
      }
      if (data.success === false || res.status !== 200) {
        setDeleteError(data.message || "Account deletion failed");
        dispatch(deleteUserFailure(data.message));
        return;
      }
      dispatch(deleteUserSuccess(data));
      setShowPasswordModal(false);
      alert("Account deleted successfully. Thank you for being with us — we hope to serve you again in the future!");
      navigate('/');
    } catch (error) {
      setDeleteError("Account deletion failed");
      dispatch(deleteUserFailure(error.message));
    }
  };

  const fetchAdmins = async () => {
    try {
      setLoadingAdmins(true);
      const res = await fetch(`/api/user/approved-admins/${currentUser._id}`, {
        credentials: 'include'
      });
      const data = await res.json();
      
      if (res.ok) {
        setAdmins(data);
      } else {
        alert(data.message || 'Failed to fetch admins');
      }
    } catch (error) {
      alert('Error fetching admins');
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleTransferAndDelete = async () => {
    if (!selectedAdmin) {
      alert('Please select an admin to transfer default admin rights to');
      return;
    }
    setShowTransferPasswordModal(true);
  };

  const handleConfirmTransferAndDelete = async () => {
    setTransferDeleteError("");
    if (!transferDeletePassword) {
      setTransferDeleteError("Password is required");
      return;
    }
    try {
      setTransferLoading(true);
      
      // First, verify the password by checking it directly
      const verifyRes = await fetch(`/api/user/verify-password/${currentUser._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: transferDeletePassword })
      });
      let verifyData = {};
      try {
        verifyData = await verifyRes.json();
      } catch (jsonErr) {
        verifyData = {};
      }
      
      if (verifyRes.status === 401) {
        setShowTransferPasswordModal(false);
        alert("Your session has expired. Please sign in again. No admin rights are Transferred");
        // Signout and redirect
        dispatch(signoutUserStart());
        const signoutRes = await fetch("/api/auth/signout");
        const signoutData = await signoutRes.json();
        if (signoutData.success === false) {
          dispatch(signoutUserFailure(signoutData.message));
        } else {
          dispatch(signoutUserSuccess(signoutData));
        }
        navigate('/sign-in');
        return;
      }
      
      // Check if password verification failed
      if (!verifyRes.ok || verifyData.success === false) {
        setShowTransferPasswordModal(false);
        alert("Your session has expired. Please sign in again. No admin rights are Transferred");
        // Signout and redirect
        dispatch(signoutUserStart());
        const signoutRes = await fetch("/api/auth/signout");
        const signoutData = await signoutRes.json();
        if (signoutData.success === false) {
          dispatch(signoutUserFailure(signoutData.message));
        } else {
          dispatch(signoutUserSuccess(signoutData));
        }
        navigate('/sign-in');
        return;
      }
      
      // Password is correct, now transfer default admin rights
      const transferRes = await fetch('/api/user/transfer-default-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentAdminId: currentUser._id,
          newDefaultAdminId: selectedAdmin
        })
      });
      const transferData = await transferRes.json();
      if (!transferRes.ok) {
        alert(transferData.message || 'Failed to transfer default admin rights');
        return;
      }

      // Now delete the account (user is no longer default admin)
      const deleteRes = await fetch(`/api/user/delete/${currentUser._id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: transferDeletePassword })
      });
      const deleteData = await deleteRes.json();
      if (!deleteRes.ok) {
        alert(deleteData.message || 'Failed to delete account after transfer');
        return;
      }
      
      // Both transfer and deletion successful
      dispatch(deleteUserSuccess(deleteData));
      setShowAdminModal(false);
      setShowTransferPasswordModal(false);
      alert("Admin rights are transferred and account deleted successfully!");
      navigate('/');
    } catch (error) {
      setTransferDeleteError("Account deletion failed");
    } finally {
      setTransferLoading(false);
    }
  };

  const onHandleSignout = async (e) => {
    e.preventDefault();
    try {
      dispatch(signoutUserStart());
      const res = await fetch("/api/auth/signout");
      const data = await res.json();
      if (data.success === false) {
        dispatch(signoutUserFailure(data.message));
      } else {
        dispatch(signoutUserSuccess(data));
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        navigate("/sign-in");
      }
    } catch (error) {
      dispatch(signoutUserFailure(error.message));
    }
  };

  const handleShowListings = () => {
    // Redirect to appropriate listings page based on user role
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) {
      navigate("/admin/my-listings");
    } else {
      navigate("/user/my-listings");
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Load admins when modal opens
  useEffect(() => {
    if (showAdminModal) {
      fetchAdmins();
    }
  }, [showAdminModal]);

  // Fetch admins for transfer (role: admin, not rootadmin)
  const fetchTransferAdmins = async () => {
    try {
      setLoadingAdmins(true);
      const res = await fetch('/api/admin/management/admins', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setTransferAdmins(data.filter(a => a.role === 'admin' || a.role === 'rootadmin'));
      } else {
        setTransferAdmins([]);
      }
    } catch (e) {
      setTransferAdmins([]);
    } finally {
      setLoadingAdmins(false);
    }
  };

  // Show transfer modal
  const onShowTransferModal = () => {
    setShowTransferModal(true);
    setTransferError("");
    setTransferPassword("");
    setSelectedTransferAdmin("");
    fetchTransferAdmins();
  };

  // Handle transfer submit
  const handleTransferSubmit = async () => {
    setTransferError("");
    if (!selectedTransferAdmin) {
      setTransferError("Please select an admin to transfer rights to.");
      return;
    }
    if (!transferPassword) {
      setTransferError("Password is required.");
      return;
    }
    setTransferSubmitting(true);
    try {
      const res = await fetch('/api/admin/transfer-rights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetAdminId: selectedTransferAdmin, password: transferPassword })
      });
      const data = await res.json();
      if (res.status === 401 && data.error === 'invalidPassword') {
        setShowTransferModal(false);
        alert('Your session has expired. Please sign in again.');
        dispatch(signoutUserStart());
        const signoutRes = await fetch('/api/auth/signout');
        const signoutData = await signoutRes.json();
        if (signoutData.success === false) {
          dispatch(signoutUserFailure(signoutData.message));
        } else {
          dispatch(signoutUserSuccess(signoutData));
        }
        navigate('/sign-in');
        return;
      }
      if (!res.ok) {
        setTransferError(data.message || 'Failed to transfer rights.');
        return;
      }
      toast.success(data.message || 'Admin rights transferred successfully!');
      setShowTransferModal(false);
      // Optionally, reload or update user state
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setTransferError('Failed to transfer rights.');
    } finally {
      setTransferSubmitting(false);
    }
  };

  // Add this useEffect to initialize formData when entering edit mode
  useEffect(() => {
    if (isEditing && currentUser) {
      setFormData({
        username: currentUser.username || '',
        email: currentUser.email || '',
        mobileNumber: currentUser.mobileNumber ? String(currentUser.mobileNumber) : '',
        avatar: currentUser.avatar || '',
      });
    }
  }, [isEditing, currentUser]);

  useEffect(() => {
    // Fetch latest user data on mount if logged in
    async function fetchLatestUser() {
      if (currentUser && currentUser._id) {
        try {
          const res = await fetch(`/api/user/id/${currentUser._id}`);
          if (res.ok) {
            const user = await res.json();
            dispatch({ type: 'user/signInSuccess', payload: user });
          }
        } catch (err) {
          // ignore
        }
      }
    }
    fetchLatestUser();
  }, []);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen py-10 px-2 md:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-6 mb-4 md:mb-0">
              <div className="relative">
              <img
                alt="avatar"
                src={currentUser.avatar}
                  className="h-24 w-24 rounded-full border-4 border-blue-200 object-cover shadow-lg"
                />
                {currentUser.role === 'admin' && (
                  <div className="absolute -top-2 -right-2 bg-purple-500 text-white rounded-full p-2">
                    <FaCrown className="w-4 h-4" />
                  </div>
                )}
                {currentUser.isDefaultAdmin && (
                  <div className="absolute -bottom-2 -right-2 bg-red-500 text-white rounded-full p-2">
                    <FaCrown className="w-3 h-3" />
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                  {currentUser.username}
                  {currentUser.role === 'admin' && (
                    <span className="ml-2 bg-purple-100 text-purple-800 text-sm px-3 py-1 rounded-full font-medium">
                      Admin
                    </span>
                  )}
                  {currentUser.isDefaultAdmin && (
                    <span className="ml-2 bg-red-100 text-red-800 text-sm px-3 py-1 rounded-full font-medium">
                      Default Admin
                    </span>
                  )}
                </h1>
                <p className="text-gray-600 flex items-center">
                  <FaEnvelope className="w-4 h-4 mr-2" />
                  {currentUser.email}
                </p>
                <p className="text-gray-600 flex items-center">
                  <FaPhone className="w-4 h-4 mr-2" />
                  {currentUser.mobileNumber && currentUser.mobileNumber !== "0000000000" 
                    ? `+91 ${currentUser.mobileNumber.slice(0, 5)} ${currentUser.mobileNumber.slice(5)}`
                    : "Mobile number not provided"
                  }
                </p>
                <p className="text-sm text-gray-500">
                  Member since {formatDate(currentUser.createdAt)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center"
            >
              <FaEdit className="w-4 h-4 mr-2" />
              {isEditing ? 'Cancel Edit' : 'Edit Profile'}
            </button>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaHome className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800">{userStats.listings}</h3>
            <p className="text-gray-600">My Listings</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaCalendarAlt className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800">{userStats.appointments}</h3>
            <p className="text-gray-600">Appointments</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="bg-red-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaHeart className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800">{userStats.wishlist}</h3>
            <p className="text-gray-600">Wishlist Items</p>
          </div>
        </div>

        {/* Edit Profile Form */}
        {isEditing && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
              <FaEdit className="w-5 h-5 mr-2 text-blue-600" />
              Edit Profile Information
            </h2>
            <form onSubmit={onSubmitForm} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <FaUser className="w-4 h-4 mr-2" />
                    Username
                  </label>
            <input
              type="text"
              id="username"
                    placeholder="Enter username"
              value={formData.username || ''}
              onChange={handleChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <FaEnvelope className="w-4 h-4 mr-2" />
                    Email Address
                  </label>
            <input
                    type="email"
              id="email"
                    placeholder="Enter email address"
              value={formData.email || ''}
              onChange={handleChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  {emailError && (
                    <div className="text-red-600 text-sm mt-1">{emailError}</div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <FaPhone className="w-4 h-4 mr-2" />
                    Mobile Number
                  </label>
            <input
              type="tel"
              id="mobileNumber"
                    placeholder="Enter 10-digit mobile number"
              value={formData.mobileNumber || ''}
              onChange={handleChange}
              pattern="[0-9]{10}"
              maxLength="10"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  {mobileError && (
                    <div className="text-red-600 text-sm mt-1">{mobileError}</div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center"><svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>Saving...</span>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
              {updateError && !emailError && !mobileError && (
                <div className="text-red-600 text-sm mt-3">{updateError}</div>
              )}
            </form>
          </div>
        )}
        {/* Show success message outside the edit form so it's visible after closing */}
        {!isEditing && updateSuccess && (
          <div className="text-green-600 text-sm mb-6">Profile updated successfully!</div>
        )}

        {/* Quick Actions Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={handleShowListings}
              className="bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition-colors flex flex-col items-center"
            >
              <FaHome className="w-5 h-5 mb-1" />
              <span className="font-medium text-sm">My Listings</span>
            </button>
            
            <Link
              to={(currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? "/admin/appointments" : "/user/my-appointments"}
              className="bg-green-500 text-white p-3 rounded-lg hover:bg-green-600 transition-colors flex flex-col items-center"
            >
              <FaCalendarAlt className="w-5 h-5 mb-1" />
              <span className="font-medium text-sm">My Appointments</span>
            </Link>
            
            <Link
              to={(currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? "/admin/wishlist" : "/user/wishlist"}
              className="bg-red-500 text-white p-3 rounded-lg hover:bg-red-600 transition-colors flex flex-col items-center"
            >
              <FaHeart className="w-5 h-5 mb-1" />
              <span className="font-medium text-sm">My Wishlist</span>
            </Link>
            
            <button
              onClick={() => navigate((currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? '/admin/change-password' : '/user/change-password')}
              className="bg-purple-500 text-white p-3 rounded-lg hover:bg-purple-600 transition-colors flex flex-col items-center cursor-pointer"
            >
              <FaKey className="w-5 h-5 mb-1" />
              <span className="font-medium text-sm">Change Password</span>
            </button>
          </div>
        </div>

        {/* Account Management Section */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Account Management</h2>
          
          {(currentUser.role === 'admin' || currentUser.role === 'rootadmin') && (
            <button
              onClick={() => navigate('/admin/management')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg mb-6 hover:bg-blue-700 transition-colors flex items-center justify-center font-semibold"
            >
              Accounts
            </button>
          )}
            
          {currentUser.isDefaultAdmin && (
            <button
              onClick={onShowTransferModal}
              className="bg-yellow-500 text-white px-6 py-3 rounded-lg mb-6 hover:bg-yellow-600 transition-colors flex items-center justify-center font-semibold"
              style={{ marginBottom: 16 }}
            >
              <FaCrown className="w-4 h-4 mr-2" />
              Transfer Rights
            </button>
          )}
            
          {currentUser.isDefaultAdmin && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <FaCrown className="w-5 h-5 text-yellow-600 mr-2" />
                <div>
                  <h3 className="font-semibold text-yellow-800">Default Admin Account</h3>
                  <p className="text-yellow-700 text-sm">
                    As the default admin, you must assign a new default admin before deleting your account.
                  </p>
                </div>
              </div>
            </div>
          )}
            
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            <button
              onClick={onHandleSignout}
              className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center"
            >
              <FaSignOutAlt className="w-4 h-4 mr-2" />
              Sign Out
            </button>
            
          <button
              onClick={onHandleDelete}
              className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center"
            >
              <FaTrash className="w-4 h-4 mr-2" />
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Admin Selection Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">Transfer Default Admin Rights</h3>
                <button
                  onClick={() => setShowAdminModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-gray-600 mb-4">
                  As the default admin, you must select another approved admin to transfer your default admin rights before deleting your account.
                </p>
                
                {loadingAdmins ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : admins.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500">No other approved admins found.</p>
                    <p className="text-sm text-gray-400 mt-2">You cannot delete your account until another admin is approved.</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Admin to Transfer Rights To:
                    </label>
                    <select
                      value={selectedAdmin}
                      onChange={(e) => setSelectedAdmin(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Choose an admin...</option>
                      {admins.map((admin) => (
                        <option key={admin._id} value={admin._id}>
                          {admin.username} ({admin.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowAdminModal(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransferAndDelete}
                  disabled={!selectedAdmin || transferLoading}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                >
                  {transferLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <FaCheck className="w-4 h-4 mr-2" />
                      Transfer & Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Confirm Account Deletion</h3>
              <p className="mb-4 text-gray-600">Please enter your password to confirm account deletion. This action cannot be undone.</p>
              <input
                type="password"
                className="w-full p-3 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Enter your password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
              />
              {deleteError && <div className="text-red-600 text-sm mb-2">{deleteError}</div>}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => { setShowPasswordModal(false); setDeletePassword(""); setDeleteError(""); }}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >Cancel</button>
                <button
                  onClick={handleConfirmDelete}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                >Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTransferPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Confirm Account Deletion</h3>
              <p className="mb-4 text-gray-600">Please enter your password to confirm account deletion after transferring default admin rights. This action cannot be undone.</p>
              <input
                type="password"
                className="w-full p-3 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Enter your password"
                value={transferDeletePassword}
                onChange={e => setTransferDeletePassword(e.target.value)}
              />
              {transferDeleteError && <div className="text-red-600 text-sm mb-2">{transferDeleteError}</div>}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => { setShowTransferPasswordModal(false); setTransferDeletePassword(""); setTransferDeleteError(""); }}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >Cancel</button>
                <button
                  onClick={handleConfirmTransferAndDelete}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                  disabled={transferLoading}
                >{transferLoading ? 'Processing...' : 'Transfer & Delete'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Rights Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">Transfer Root Admin Rights</h3>
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-4">
                <p className="text-gray-600 mb-4">
                  Select an admin to transfer your root admin rights. You will remain an admin after transfer.
                </p>
                {loadingAdmins ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : transferAdmins.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500">No other admins found.</p>
                    <p className="text-sm text-gray-400 mt-2">You cannot transfer rights until another admin exists.</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Admin to Transfer Rights To:
                    </label>
                    <select
                      value={selectedTransferAdmin}
                      onChange={e => setSelectedTransferAdmin(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Choose an admin...</option>
                      {transferAdmins.map(admin => (
                        <option key={admin._id} value={admin._id}>
                          {admin.username} ({admin.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password:</label>
                <input
                  type="password"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Enter your password"
                  value={transferPassword}
                  onChange={e => setTransferPassword(e.target.value)}
                />
                {transferError && <div className="text-red-600 text-sm mt-2">{transferError}</div>}
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >Cancel</button>
                <button
                  onClick={handleTransferSubmit}
                  disabled={!selectedTransferAdmin || !transferPassword || transferSubmitting}
                  className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                >
                  {transferSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <FaCrown className="w-4 h-4 mr-2" />
                      Transfer Rights
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col items-center space-y-2 text-sm text-gray-600">
        {currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? (
          <>
            <a href="/admin/terms" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Admin Terms & Conditions</a>
            <a href="/admin/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Admin Privacy Policy</a>
          </>
        ) : (
          <>
            <a href="/user/terms" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">User Terms & Conditions</a>
            <a href="/user/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">User Privacy Policy</a>
          </>
        )}
      </div>

      <ContactSupportWrapper />
    </div>
  );
}
