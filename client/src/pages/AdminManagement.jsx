import React, { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';
import { FaUser, FaUserShield, FaEnvelope, FaCalendarAlt, FaCheckCircle, FaBan, FaTrash, FaUserLock, FaPhone, FaList, FaCalendar, FaArrowDown, FaSearch, FaLock } from "react-icons/fa";
import { socket } from "../utils/socket";
import { signoutUserStart, signoutUserSuccess, signoutUserFailure } from "../redux/user/userSlice";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminManagement() {
  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("users");
  const [suspendError, setSuspendError] = useState({});
  const [showRestriction, setShowRestriction] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountStats, setAccountStats] = useState({ listings: 0, appointments: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(true);
  const [managementPassword, setManagementPassword] = useState("");
  const [managementPasswordError, setManagementPasswordError] = useState("");
  const [managementPasswordLoading, setManagementPasswordLoading] = useState(false);
  const lockoutTimerRef = useRef(null);
  const warningTimerRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;
    fetchData();
  }, [currentUser]);

  // Add useEffect to listen for socket events and update users/admins state
  useEffect(() => {
    function handleUserUpdate({ type, user }) {
      setUsers(prev => {
        if (type === 'delete') return prev.filter(u => u._id !== user._id);
        if (type === 'update') return prev.map(u => u._id === user._id ? user : u);
        if (type === 'add') return [user, ...prev];
        return prev;
      });
    }
    function handleAdminUpdate({ type, admin }) {
      setAdmins(prev => {
        if (type === 'delete') return prev.filter(a => a._id !== admin._id);
        if (type === 'update') return prev.map(a => a._id === admin._id ? admin : a);
        if (type === 'add') return [admin, ...prev];
        return prev;
      });
    }
    socket.on('user_update', handleUserUpdate);
    socket.on('admin_update', handleAdminUpdate);
    return () => {
      socket.off('user_update', handleUserUpdate);
      socket.off('admin_update', handleAdminUpdate);
    };
  }, []);

  // Keyboard shortcut for search (Ctrl+F)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById('admin-management-search');
        if (searchInput) {
          searchInput.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch users
      const userRes = await fetch(`${API_BASE_URL}/api/admin/management/users`, { credentials: "include" });
      const userData = await userRes.json();
      setUsers(userData);
      // Fetch admins if default admin
      if (currentUser.isDefaultAdmin) {
        const adminRes = await fetch(`${API_BASE_URL}/api/admin/management/admins`, { credentials: "include" });
        const adminData = await adminRes.json();
        setAdmins(adminData);
      }
    } catch (err) {
      toast.error("Failed to fetch accounts");
    } finally {
      setLoading(false);
    }
  };

  // Optimistic UI for suspend
  const handleSuspend = async (id, type) => {
    // Optimistically update UI
    if (type === 'user') {
      setUsers(prev => prev.map(u => u._id === id ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' } : u));
    } else {
      setAdmins(prev => prev.map(a => a._id === id ? { ...a, status: a.status === 'active' ? 'suspended' : 'active' } : a));
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/management/suspend/${type}/${id}`, {
        method: "PATCH",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${type === "user" ? "User" : "Admin"} status updated`);
        setSuspendError((prev) => ({ ...prev, [id]: undefined }));
        // Emit socket event
        socket.emit(type === 'user' ? 'user_update' : 'admin_update', { type: 'update', [type]: data });
      } else {
        // Rollback
        fetchData();
        toast.error(data.message || "Failed to update status");
        setSuspendError((prev) => ({ ...prev, [id]: "Can't able to suspend account, may be deleted or moved" }));
        setTimeout(() => setSuspendError((prev) => ({ ...prev, [id]: undefined })), 4000);
      }
    } catch (err) {
      fetchData();
      toast.error("Failed to update status");
      setSuspendError((prev) => ({ ...prev, [id]: "Can't able to suspend account, may be deleted or moved" }));
      setTimeout(() => setSuspendError((prev) => ({ ...prev, [id]: undefined })), 4000);
    }
  };

  // Optimistic UI for delete
  const handleDelete = async (id, type) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;
    // Optimistically update UI
    if (type === 'user') {
      setUsers(prev => prev.filter(u => u._id !== id));
    } else {
      setAdmins(prev => prev.filter(a => a._id !== id));
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/management/delete/${type}/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${type === "user" ? "User" : "Admin"} deleted`);
        // Emit socket event
        socket.emit(type === 'user' ? 'user_update' : 'admin_update', { type: 'delete', [type]: { _id: id } });
      } else {
        fetchData();
        toast.error(data.message || "Failed to delete");
      }
    } catch (err) {
      fetchData();
      toast.error("Failed to delete");
    }
  };

  const handleAccountClick = async (account, type) => {
    setShowAccountModal(true);
    setAccountLoading(true);
    setSelectedAccount(null);
    setAccountStats({ listings: 0, appointments: 0 });
    try {
      // Fetch full user/admin details
      const res = await fetch(`${API_BASE_URL}/api/user/id/${account._id}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedAccount({ ...data, type });
        // Fetch stats
        try {
        const [listingsRes, appointmentsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/listing/user/${account._id}`, { credentials: 'include' }),
          fetch(`${API_BASE_URL}/api/bookings/user/${account._id}`, { credentials: 'include' })
        ]);
          
          let listingsCount = 0;
          let appointmentsCount = 0;
          
          if (listingsRes.ok) {
        const listingsData = await listingsRes.json();
            listingsCount = Array.isArray(listingsData) ? listingsData.length : 0;
          }
          
          if (appointmentsRes.ok) {
        const appointmentsData = await appointmentsRes.json();
            appointmentsCount = appointmentsData.count || 0;
          }
          
        setAccountStats({
            listings: listingsCount,
            appointments: appointmentsCount
        });
        } catch (statsError) {
          console.error('Error fetching account stats:', statsError);
          // Keep the account details but with zero stats
          setAccountStats({ listings: 0, appointments: 0 });
        }
      } else {
        console.error('Failed to fetch account details:', data.message);
        setSelectedAccount(null);
      }
    } catch (e) {
      console.error('Error in handleAccountClick:', e);
      setSelectedAccount(null);
    }
    setAccountLoading(false);
  };

  // Optimistic UI for promote
  const handlePromote = async (id) => {
    if (!window.confirm("Are you sure you want to promote this user to admin?")) return;
    // Optimistically move user to admins
    const user = users.find(u => u._id === id);
    if (user) {
      setUsers(prev => prev.filter(u => u._id !== id));
      setAdmins(prev => [
        { ...user, role: 'admin', adminApprovalStatus: 'approved' },
        ...admins
      ]);
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/management/promote/${id}`, {
        method: "PATCH",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("User promoted to admin successfully");
        // Emit socket event
        socket.emit('admin_update', { type: 'add', admin: { ...user, ...data } });
        socket.emit('user_update', { type: 'delete', user: { _id: id } });
      } else {
        fetchData();
        toast.error(data.message || "Failed to promote user");
      }
    } catch (err) {
      fetchData();
      toast.error("Failed to promote user");
    }
  };

  // Optimistic UI for demote
  const handleDemote = async (id) => {
    if (!window.confirm("Are you sure you want to demote this admin to a user?")) return;
    // Optimistically move admin to users
    const admin = admins.find(a => a._id === id);
    if (admin) {
      setAdmins(prev => prev.filter(a => a._id !== id));
      setUsers(prev => [
        { ...admin, role: 'user', adminApprovalStatus: undefined },
        ...users
      ]);
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/management/demote/${id}`, {
        method: "PATCH",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Admin demoted to user successfully");
        // Emit socket event
        socket.emit('user_update', { type: 'add', user: { ...admin, ...data } });
        socket.emit('admin_update', { type: 'delete', admin: { _id: id } });
      } else {
        fetchData();
        toast.error(data.message || "Failed to demote admin");
      }
    } catch (err) {
      fetchData();
      toast.error("Failed to demote admin");
    }
  };

  // Add this handler at the top-level of the component
  const handleReapprove = async (adminId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/management/reapprove/${adminId}`, {
        method: "PATCH",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setAdmins(prev => prev.map(a => a._id === adminId ? { ...a, adminApprovalStatus: 'approved', status: 'active' } : a));
        toast.success("Admin re-approved successfully!");
        socket.emit('admin_update', { type: 'update', admin: { ...data } });
      } else {
        toast.error(data.message || "Failed to re-approve admin");
      }
    } catch (err) {
      toast.error("Failed to re-approve admin");
    }
  };

  // Filter accounts based on search term
  const filterAccounts = (accounts) => {
    if (!searchTerm.trim()) return accounts;
    
    const term = searchTerm.toLowerCase();
    return accounts.filter(account => 
      account.username?.toLowerCase().includes(term) ||
      account.email?.toLowerCase().includes(term) ||
      account.mobileNumber?.toLowerCase().includes(term)
    );
  };

  const filteredUsers = filterAccounts(users);
  const filteredAdmins = filterAccounts(admins);

  // Helper function to highlight search matches
  const highlightMatch = (text) => {
    if (!searchTerm.trim() || !text) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} className="bg-yellow-200 font-semibold rounded px-1">
          {part}
        </span>
      ) : part
    );
  };

  // Helper to start lockout timer
  const startLockoutTimer = () => {
    // Clear any existing timers
    if (lockoutTimerRef.current) clearTimeout(lockoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    // Show warning at 4 minutes
    warningTimerRef.current = setTimeout(() => {
      toast.info("For your security, you will be asked to re-enter your password in 1 minute.");
    }, 4 * 60 * 1000);
    // Lock at 5 minutes
    lockoutTimerRef.current = setTimeout(() => {
      setShowPasswordModal(true);
      toast.info("Session expired for security. Please re-enter your password.");
    }, 5 * 60 * 1000);
  };

  // Start timer on successful password entry
  useEffect(() => {
    if (!showPasswordModal) {
      startLockoutTimer();
    } else {
      if (lockoutTimerRef.current) clearTimeout(lockoutTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    }
    // Clean up on unmount
    return () => {
      if (lockoutTimerRef.current) clearTimeout(lockoutTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, [showPasswordModal]);

  // Guard: If users/admins are not arrays, show session expired/unauthorized message
  if (!Array.isArray(users) || (tab === 'admins' && !Array.isArray(admins) && currentUser.isDefaultAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-100">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Session expired or unauthorized</h2>
          <p className="text-gray-700 mb-4">Please sign in again to access admin management.</p>
          <a href="/sign-in" className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors">Go to Sign In</a>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  // Password modal handler
  const handleManagementPasswordSubmit = async (e) => {
    e.preventDefault();
    setManagementPasswordLoading(true);
    setManagementPasswordError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/management/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: managementPassword })
      });
      if (res.ok) {
        setShowPasswordModal(false);
        setManagementPassword("");
        setManagementPasswordError("");
        startLockoutTimer(); // Reset timer on every successful entry
      } else {
        const data = await res.json();
        // Sign out and redirect on wrong password
        toast.error("For security reasons, you have been signed out. Please sign in again.");
        dispatch(signoutUserStart());
        try {
          const signoutRes = await fetch(`${API_BASE_URL}/api/auth/signout`);
          const signoutData = await signoutRes.json();
          if (signoutData.success === false) {
            dispatch(signoutUserFailure(signoutData.message));
          } else {
            dispatch(signoutUserSuccess(signoutData));
          }
        } catch (err) {
          dispatch(signoutUserFailure(err.message));
        }
        setTimeout(() => {
          navigate('/sign-in');
        }, 800);
        return;
      }
    } catch (err) {
      setManagementPasswordError('Network error');
    } finally {
      setManagementPasswordLoading(false);
    }
  };

  if (showPasswordModal) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
        <form className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xs flex flex-col gap-4" onSubmit={handleManagementPasswordSubmit}>
          <h3 className="text-lg font-bold text-blue-700 flex items-center gap-2"><FaLock /> Confirm Password</h3>
          <input
            type="password"
            className="border rounded p-2 w-full"
            placeholder="Enter your password"
            value={managementPassword}
            onChange={e => setManagementPassword(e.target.value)}
            autoFocus
          />
          {managementPasswordError && <div className="text-red-600 text-sm">{managementPasswordError}</div>}
          <div className="flex gap-2 justify-end">
            <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="px-4 py-2 rounded bg-blue-700 text-white font-semibold" disabled={managementPasswordLoading}>{managementPasswordLoading ? 'Verifying...' : 'Confirm'}</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 py-10 px-2 md:px-8 animate-fadeIn">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-2xl p-8 animate-slideUp">
        <h1 className="text-4xl font-extrabold text-blue-700 mb-8 drop-shadow animate-fade-in">Accounts Management</h1>
        <div className="flex gap-4 mb-8 animate-fadeIn">
          <button
            className={`px-6 py-3 rounded-xl font-bold text-lg shadow transition-all duration-200 ${tab === "users" ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white scale-105" : "bg-gray-100 text-gray-700 hover:bg-blue-50"}`}
            onClick={() => {
              setTab("users");
              setShowRestriction(false);
              setSearchTerm("");
            }}
          >
            Users
          </button>
          <button
            className={`px-6 py-3 rounded-xl font-bold text-lg shadow transition-all duration-200 ${tab === "admins" ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white scale-105" : "bg-gray-100 text-gray-700 hover:bg-purple-50"}`}
            onClick={() => {
              if (!currentUser.isDefaultAdmin) {
                setShowRestriction(true);
                setTab("admins");
                setSearchTerm("");
              } else {
                setShowRestriction(false);
                setTab("admins");
                setSearchTerm("");
              }
            }}
          >
            Admins
          </button>
        </div>

        {/* Search Box */}
        <div className="mb-6 animate-fadeIn">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="admin-management-search"
              type="text"
              placeholder={`Search ${tab === "users" ? "users" : "admins"} by name, email, or mobile number...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <span className="text-xl">&times;</span>
              </button>
            )}
          </div>
          {searchTerm && (
            <div className="mt-2 text-sm text-gray-600">
              Found {tab === "users" ? filteredUsers.length : filteredAdmins.length} {tab === "users" ? "user" : "admin"}{tab === "users" ? (filteredUsers.length !== 1 ? "s" : "") : (filteredAdmins.length !== 1 ? "s" : "")} matching "{searchTerm}"
            </div>
          )}
          <div className="mt-1 text-xs text-gray-400">
            💡 Tip: Press Ctrl+F to quickly focus the search box
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 animate-fadeIn">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
            <p className="text-lg text-gray-500 font-semibold">Loading accounts...</p>
          </div>
        ) : (
          <>
            {(tab === "users") && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2 animate-fadeIn">
                  <FaUser className="text-blue-500" /> Users
                </h2>
                {filteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 animate-fadeIn">
                    <FaUserLock className="text-6xl text-gray-300 mb-4" />
                    <p className="text-gray-500 text-lg font-medium">
                      {searchTerm ? `No users found matching "${searchTerm}"` : "No users found."}
                    </p>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="mt-4 text-blue-500 hover:text-blue-600 underline"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 animate-fadeIn">
                    {filteredUsers.map((user) => (
                      <div
                        key={user._id}
                        className="bg-gradient-to-br from-blue-50 to-purple-100 rounded-2xl shadow-lg p-6 flex flex-col gap-4 hover:scale-105 transition-transform duration-200 animate-slideUp cursor-pointer"
                        onClick={() => handleAccountClick(user, 'user')}
                        title="Click to view full details"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-blue-200 flex items-center justify-center text-2xl font-bold text-blue-700 shadow-inner">
                            <FaUser />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-semibold text-gray-800">{highlightMatch(user.username)}</span>
                              <span className={`text-xs px-2 py-1 rounded-full font-bold ${user.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{user.status}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                              <FaEnvelope /> {highlightMatch(user.email)}
                            </div>
                            {user.mobileNumber && (
                              <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                                <FaPhone /> {highlightMatch(user.mobileNumber)}
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-gray-400 text-xs mt-1">
                              <FaCalendarAlt /> {new Date(user.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 mt-4 sm:flex-row sm:gap-2">
                          <button
                            className={`flex-1 px-2 py-1 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${user.status === "active" ? "bg-yellow-400 text-white hover:bg-yellow-500" : "bg-green-500 text-white hover:bg-green-600"}`}
                            onClick={e => { e.stopPropagation(); handleSuspend(user._id, "user"); }}
                          >
                            {user.status === "active" ? <FaBan /> : <FaCheckCircle />}
                            {user.status === "active" ? "Suspend" : "Activate"}
                          </button>
                          <button
                            className="flex-1 px-2 py-1 rounded-lg font-semibold text-sm bg-red-500 text-white hover:bg-red-600 transition-all duration-200 flex items-center justify-center gap-2"
                            onClick={e => { e.stopPropagation(); handleDelete(user._id, "user"); }}
                          >
                            <FaTrash /> Delete
                          </button>
                          {currentUser.isDefaultAdmin && (
                            <button
                              className="flex-1 px-2 py-1 rounded-lg font-semibold text-sm bg-purple-500 text-white hover:bg-purple-600 transition-all duration-200 flex items-center justify-center gap-2"
                              onClick={e => { e.stopPropagation(); handlePromote(user._id); }}
                            >
                              <FaUserShield /> Promote to Admin
                            </button>
                          )}
                        </div>
                        {suspendError[user._id] && (
                          <div className="text-red-500 text-xs mt-2 animate-fadeIn">{suspendError[user._id]}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {tab === "admins" && !currentUser.isDefaultAdmin && showRestriction && (
              <div className="flex flex-col items-center justify-center py-16 animate-fadeIn">
                <div className="text-6xl mb-4">🚫</div>
                <p className="text-red-500 text-lg font-medium">Only the current default admin can access admin account management.</p>
              </div>
            )}
            {tab === "admins" && currentUser.isDefaultAdmin && !showRestriction && (
              <div className="mt-10">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2 animate-fadeIn">
                  <FaUserShield className="text-purple-500" /> Admins
                </h2>
                {filteredAdmins.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 animate-fadeIn">
                    <FaUserLock className="text-6xl text-gray-300 mb-4" />
                    <p className="text-gray-500 text-lg font-medium">
                      {searchTerm ? `No admins found matching "${searchTerm}"` : "No admins found."}
                    </p>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="mt-4 text-blue-500 hover:text-blue-600 underline"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 animate-fadeIn">
                    {filteredAdmins.map((admin) => (
                      <div
                        key={admin._id}
                        className="bg-gradient-to-br from-purple-50 to-blue-100 rounded-2xl shadow-lg p-6 flex flex-col gap-4 hover:scale-105 transition-transform duration-200 animate-slideUp cursor-pointer"
                        onClick={() => handleAccountClick(admin, 'admin')}
                        title="Click to view full details"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-purple-200 flex items-center justify-center text-2xl font-bold text-purple-700 shadow-inner">
                            <FaUserShield />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-semibold text-gray-800">{highlightMatch(admin.username)}</span>
                              <span className={`text-xs px-2 py-1 rounded-full font-bold ${admin.adminApprovalStatus === 'rejected' ? 'bg-gray-300 text-gray-700' : admin.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{admin.adminApprovalStatus === 'rejected' ? 'rejected' : admin.status}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                              <FaEnvelope /> {highlightMatch(admin.email)}
                            </div>
                            {admin.mobileNumber && (
                              <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                                <FaPhone /> {highlightMatch(admin.mobileNumber)}
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-gray-400 text-xs mt-1">
                              <FaCalendarAlt /> {new Date(admin.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 mt-4 sm:flex-row sm:gap-2">
                          <button
                            className={`flex-1 px-2 py-1 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${admin.status === "active" ? "bg-yellow-400 text-white hover:bg-yellow-500" : "bg-green-500 text-white hover:bg-green-600"}`}
                            onClick={e => { e.stopPropagation(); handleSuspend(admin._id, "admin"); }}
                          >
                            {admin.status === "active" ? <FaBan /> : <FaCheckCircle />}
                            {admin.status === "active" ? "Suspend" : "Activate"}
                          </button>
                          <button
                            className="flex-1 px-2 py-1 rounded-lg font-semibold text-sm bg-red-500 text-white hover:bg-red-600 transition-all duration-200 flex items-center justify-center gap-2"
                            onClick={e => { e.stopPropagation(); handleDelete(admin._id, "admin"); }}
                          >
                            <FaTrash /> Delete
                          </button>
                          <button
                            className="flex-1 px-2 py-1 rounded-lg font-semibold text-sm bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 flex items-center justify-center gap-2"
                            onClick={e => { e.stopPropagation(); handleDemote(admin._id); }}
                          >
                            <FaArrowDown /> Demote to User
                          </button>
                          {currentUser.isDefaultAdmin && admin.adminApprovalStatus === 'rejected' && (
                            <button
                              className="flex-1 px-2 py-1 rounded-lg font-semibold text-sm bg-green-600 text-white hover:bg-green-700 transition-all duration-200 flex items-center justify-center gap-2"
                              onClick={e => { e.stopPropagation(); handleReapprove(admin._id); }}
                            >
                              <FaCheckCircle /> Re-Approve
                            </button>
                          )}
                        </div>
                        {suspendError[admin._id] && (
                          <div className="text-red-500 text-xs mt-2 animate-fadeIn">{suspendError[admin._id]}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {/* Account Details Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6 relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl"
              onClick={() => setShowAccountModal(false)}
              title="Close"
            >
              &times;
            </button>
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span>{selectedAccount?.type === 'admin' ? <FaUserShield className="text-purple-500" /> : <FaUser className="text-blue-500" />}</span>
              {selectedAccount?.username || 'User Details'}
            </h3>
            {accountLoading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : selectedAccount ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4 mb-2">
                  <img
                    src={selectedAccount.avatar || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'}
                    alt="avatar"
                    className="w-16 h-16 rounded-full border shadow object-cover"
                    onError={e => { e.target.onerror = null; e.target.src = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'; }}
                  />
                  <div>
                    <div className="font-bold text-lg">{selectedAccount.username}</div>
                    <div className="text-gray-500 text-sm">{selectedAccount.email}</div>
                  </div>
                </div>
                <p><strong>Mobile Number:</strong> {selectedAccount.mobileNumber || 'Not provided'}</p>
                <p><strong>Role:</strong> {selectedAccount.role}</p>
                <p><strong>Status:</strong> {selectedAccount.status || 'active'}</p>
                {selectedAccount.type === 'admin' && (
                  <>
                    <p><strong>Admin Status:</strong> {selectedAccount.adminApprovalStatus}</p>
                    <p><strong>Admin Approval Date:</strong> {selectedAccount.adminApprovalDate ? new Date(selectedAccount.adminApprovalDate).toLocaleDateString() : 'N/A'}</p>
                    <p><strong>Approved By:</strong> {selectedAccount.approvedBy ? selectedAccount.approvedBy.username || selectedAccount.approvedBy.email || selectedAccount.approvedBy : 'N/A'}</p>
                    <p><strong>Admin Request Date:</strong> {selectedAccount.adminRequestDate ? new Date(selectedAccount.adminRequestDate).toLocaleDateString() : 'N/A'}</p>
                    <p><strong>Is Default Admin:</strong> {selectedAccount.isDefaultAdmin ? 'Yes' : 'No'}</p>
                  </>
                )}
                <p><strong>Member Since:</strong> {selectedAccount.createdAt ? new Date(selectedAccount.createdAt).toLocaleDateString() : ''}</p>
                <p><strong>Number of Listings:</strong> {accountStats.listings}</p>
                <p><strong>Number of Appointments:</strong> {accountStats.appointments}</p>
                {/* Add more crucial details as needed */}
              </div>
            ) : (
              <p className="text-red-500">Failed to load details.</p>
            )}
            <button
              onClick={() => setShowAccountModal(false)}
              className="mt-6 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {/* Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
        .animate-slideUp { animation: slideUp 0.4s cubic-bezier(0.4,0,0.2,1); }
      `}</style>
    </div>
  );
} 