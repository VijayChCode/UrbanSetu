import React, { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';
import { FaHome, FaUser, FaUserShield, FaEnvelope, FaTimes, FaCalendarAlt, FaCheckCircle, FaBan, FaTrash, FaUserLock, FaPhone, FaList, FaCalendar, FaArrowDown, FaSearch, FaLock, FaExclamationCircle } from "react-icons/fa";
import { socket } from "../utils/socket";
import { signoutUserStart, signoutUserSuccess, signoutUserFailure } from "../redux/user/userSlice";
import { authenticatedFetch } from "../utils/auth";

import { usePageTitle } from '../hooks/usePageTitle';
import { isMobileDevice } from '../utils/mobileUtils';
import AdminManagementSkeleton from '../components/skeletons/AdminManagementSkeleton';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminManagement() {
  // Set page title
  usePageTitle("Account Management - User & Admin Control");

  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("users");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const passwordInputRef = useRef(null);
  const [softbannedAccounts, setSoftbannedAccounts] = useState([]);
  const [softbannedFilters, setSoftbannedFilters] = useState({ q: '', role: 'all', softbannedBy: '', from: '', to: '' });
  const [softbannedLoading, setSoftbannedLoading] = useState(false);
  const [purgedAccounts, setPurgedAccounts] = useState([]);
  const [purgedFilters, setPurgedFilters] = useState({ q: '', role: 'all', purgedBy: '', from: '', to: '' });
  const [purgedLoading, setPurgedLoading] = useState(false);
  const [suspendError, setSuspendError] = useState({});
  const [showRestriction, setShowRestriction] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showDeleteReasonModal, setShowDeleteReasonModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteOtherReason, setDeleteOtherReason] = useState("");
  const [deletePolicy, setDeletePolicy] = useState({ category: '', banType: 'allow', allowResignupAfterDays: 0, notes: '' });
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showSuspensionReasonModal, setShowSuspensionReasonModal] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [suspensionOtherReason, setSuspensionOtherReason] = useState("");
  const [suspensionAccount, setSuspensionAccount] = useState(null);
  const [showDemoteReasonModal, setShowDemoteReasonModal] = useState(false);
  const [demoteReason, setDemoteReason] = useState("");
  const [demoteOtherReason, setDemoteOtherReason] = useState("");
  const [demoteAccount, setDemoteAccount] = useState(null);
  const [actionLoading, setActionLoading] = useState({
    suspend: {},
    promote: {},
    demote: {},
    softban: false,
    restore: false,
    purge: false
  });
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [showUnsubscribeReasonModal, setShowUnsubscribeReasonModal] = useState(false);
  const [unsubscribeReasonText, setUnsubscribeReasonText] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountStats, setAccountStats] = useState({
    listings: 0,
    appointments: 0,
    wishlist: 0,
    watchlist: 0,
    reviews: 0,
    receivedReviews: 0,
    referrals: 0,
    payments: 0,
    contracts: 0,
    loans: 0,
    conversations: 0,
    calls: 0,
    forumPosts: 0,
    routes: 0,
    calculations: 0,
    coinBalance: 0
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [adminApprovalFilter, setAdminApprovalFilter] = useState("all");
  const [passwordLockouts, setPasswordLockouts] = useState([]); // { email, unlockAt }
  const [showPasswordModal, setShowPasswordModal] = useState(true);
  const [managementPassword, setManagementPassword] = useState("");
  const [managementPasswordError, setManagementPasswordError] = useState("");
  const [managementPasswordLoading, setManagementPasswordLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState({
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmButtonClass: 'bg-red-500 hover:bg-red-600'
  });
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
      const userRes = await authenticatedFetch(`${API_BASE_URL}/api/admin/management/users`);
      const userData = await userRes.json();
      setUsers(userData);
      // Fetch admins if default admin
      if (currentUser.isDefaultAdmin) {
        const adminRes = await authenticatedFetch(`${API_BASE_URL}/api/admin/management/admins`);
        const adminData = await adminRes.json();
        setAdmins(adminData);
      }
      // Fetch active password lockouts (failed sign-in lockouts)
      try {
        const lockRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/password-lockouts`);
        const lockData = await lockRes.json();
        if (lockRes.ok && lockData && Array.isArray(lockData.items)) {
          setPasswordLockouts(lockData.items);
        } else {
          setPasswordLockouts([]);
        }
      } catch (_) {
        setPasswordLockouts([]);
      }
      // Fetch softbanned accounts
      try {
        await fetchSoftbannedAccounts();
      } catch (_) { }
      // Fetch purged accounts
      try {
        await fetchPurgedAccounts();
      } catch (_) { }
    } catch (err) {
      toast.error("Failed to fetch accounts");
    } finally {
      setLoading(false);
    }
  };

  const fetchSoftbannedAccounts = async () => {
    setSoftbannedLoading(true);
    try {
      const params = new URLSearchParams();
      if (softbannedFilters.q) params.set('q', softbannedFilters.q);
      if (softbannedFilters.role && softbannedFilters.role !== 'all') params.set('role', softbannedFilters.role);
      if (softbannedFilters.softbannedBy) params.set('softbannedBy', softbannedFilters.softbannedBy);
      if (softbannedFilters.from) params.set('from', softbannedFilters.from);
      if (softbannedFilters.to) params.set('to', softbannedFilters.to);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/deleted-accounts?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data && Array.isArray(data.items)) {
        // Filter out purged accounts (those with purgedAt)
        setSoftbannedAccounts(data.items.filter(acc => !acc.purgedAt));
      } else {
        setSoftbannedAccounts([]);
      }
    } catch (e) {
      setSoftbannedAccounts([]);
    } finally {
      setSoftbannedLoading(false);
    }
  };

  const fetchPurgedAccounts = async () => {
    setPurgedLoading(true);
    try {
      const params = new URLSearchParams();
      if (purgedFilters.q) params.set('q', purgedFilters.q);
      if (purgedFilters.role && purgedFilters.role !== 'all') params.set('role', purgedFilters.role);
      if (purgedFilters.purgedBy) params.set('purgedBy', purgedFilters.purgedBy);
      if (purgedFilters.from) params.set('from', purgedFilters.from);
      if (purgedFilters.to) params.set('to', purgedFilters.to);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/deleted-accounts?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data && Array.isArray(data.items)) {
        // Filter only purged accounts (those with purgedAt)
        setPurgedAccounts(data.items.filter(acc => acc.purgedAt));
      } else {
        setPurgedAccounts([]);
      }
    } catch (e) {
      setPurgedAccounts([]);
    } finally {
      setPurgedLoading(false);
    }
  };

  // Optimistic UI for suspend
  const handleSuspend = async (id, type) => {
    const account = type === 'user' ? users.find(u => u._id === id) : admins.find(a => a._id === id);

    // Protect Root Admin
    if (account?.role === 'rootadmin') {
      toast.error("Root Admin account cannot be suspended or activated.");
      return;
    }

    const isSuspending = account?.status === 'active';
    const actionText = isSuspending ? 'suspend' : 'activate';
    const actionTextCapitalized = isSuspending ? 'Suspend' : 'Activate';

    // If suspending, show reason modal first
    if (isSuspending) {
      setSuspensionAccount({ id, type });
      setSuspensionReason("");
      setShowSuspensionReasonModal(true);
      return;
    }

    // If activating, proceed directly
    const performSuspend = async () => {
      // Set loading state
      setActionLoading(prev => ({
        ...prev,
        suspend: { ...prev.suspend, [id]: true }
      }));

      // Optimistically update UI
      if (type === 'user') {
        setUsers(prev => prev.map(u => u._id === id ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' } : u));
      } else {
        setAdmins(prev => prev.map(a => a._id === id ? { ...a, status: a.status === 'active' ? 'suspended' : 'active' } : a));
      }
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/management/suspend/${type}/${id}`, {
          method: "PATCH",
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: isSuspending ? (suspensionReason || 'Policy violation') : null
          })
        });
        const data = await res.json();
        if (res.ok) {
          toast.success(`${type === "user" ? "User" : "Admin"} status updated`);
          setSuspendError((prev) => ({ ...prev, [id]: undefined }));
          // Emit socket event
          socket.emit(type === 'user' ? 'user_update' : 'admin_update', { type: 'update', [type]: data, userId: id });
          // Emit global signout event for the affected user
          socket.emit('force_signout', {
            userId: id,
            action: 'suspend',
            message: `Your account has been ${data.status === 'suspended' ? 'suspended' : 'activated'}. You have been signed out.`
          });
          // Close modal only after success
          setShowConfirmModal(false);
        } else {
          // Rollback
          fetchData();
          toast.error(data.message || "Failed to update status");
          setSuspendError((prev) => ({ ...prev, [id]: "Can't able to suspend account, may be softbanned or moved" }));
          setTimeout(() => setSuspendError((prev) => ({ ...prev, [id]: undefined })), 4000);
        }
      } catch (err) {
        fetchData();
        toast.error("Failed to update status");
        setSuspendError((prev) => ({ ...prev, [id]: "Can't able to suspend account, may be deleted or moved" }));
        setTimeout(() => setSuspendError((prev) => ({ ...prev, [id]: undefined })), 4000);
      } finally {
        // Clear loading state
        setActionLoading(prev => ({
          ...prev,
          suspend: { ...prev.suspend, [id]: false }
        }));
      }
    };

    showConfirmation(
      `${actionTextCapitalized} ${type === "user" ? "User" : "Admin"}`,
      `Are you sure you want to ${actionText} this ${type}? ${isSuspending ? 'They will be signed out and unable to access their account.' : 'They will regain access to their account.'}`,
      performSuspend,
      {
        confirmText: actionTextCapitalized,
        confirmButtonClass: isSuspending ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600',
        userId: id
      }
    );
  };

  // Handle suspension with reason
  const performSuspensionWithReason = async () => {
    if (!suspensionAccount) return;

    const { id, type } = suspensionAccount;

    // Set loading state for modal
    setActionLoading(prev => ({
      ...prev,
      suspend: { ...prev.suspend, [id]: true }
    }));

    // Optimistically update UI
    if (type === 'user') {
      setUsers(prev => prev.map(u => u._id === id ? { ...u, status: 'suspended' } : u));
    } else {
      setAdmins(prev => prev.map(a => a._id === id ? { ...a, status: 'suspended' } : a));
    }

    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/management/suspend/${type}/${id}`, {
        method: "PATCH",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: suspensionReason === 'other' ? suspensionOtherReason : suspensionReason || 'Policy violation' })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${type === "user" ? "User" : "Admin"} suspended successfully`);
        setSuspendError((prev) => ({ ...prev, [id]: undefined }));
        // Emit socket event
        socket.emit(type === 'user' ? 'user_update' : 'admin_update', { type: 'update', [type]: data, userId: id });
        // Emit global signout event for the affected user
        socket.emit('force_signout', {
          userId: id,
          action: 'suspend',
          message: `Your account has been suspended. You have been signed out.`
        });
        // Close modal only after success
        setShowSuspensionReasonModal(false);
        setSuspensionAccount(null);
        setSuspensionReason("");
        setSuspensionOtherReason("");
      } else {
        // Rollback
        fetchData();
        toast.error(data.message || "Failed to suspend account");
        setSuspendError((prev) => ({ ...prev, [id]: "Can't able to suspend account, may be softbanned or moved" }));
        setTimeout(() => setSuspendError((prev) => ({ ...prev, [id]: undefined })), 4000);
      }
    } catch (err) {
      fetchData();
      toast.error("Failed to suspend account");
      setSuspendError((prev) => ({ ...prev, [id]: "Can't able to suspend account, may be deleted or moved" }));
      setTimeout(() => setSuspendError((prev) => ({ ...prev, [id]: undefined })), 4000);
    } finally {
      // Clear loading state
      setActionLoading(prev => ({
        ...prev,
        suspend: { ...prev.suspend, [id]: false }
      }));
    }
  };

  // Optimistic UI for delete
  const handleDelete = async (id, type) => {
    const account = type === 'user' ? users.find(u => u._id === id) : admins.find(a => a._id === id);

    // Protect Root Admin
    if (account?.role === 'rootadmin') {
      toast.error("Root Admin account cannot be softbanned.");
      return;
    }

    setSelectedAccount({ _id: id, type });
    setDeleteReason("");
    setDeleteOtherReason("");
    setDeletePolicy({ category: '', banType: 'allow', allowResignupAfterDays: 0, notes: '' });
    setShowDeleteReasonModal(true);
  };

  const performDeleteWithReason = async () => {
    const sel = selectedAccount;
    if (!sel) return;
    const id = sel._id; const type = sel.type;
    const finalReason = deleteReason === 'other' ? (deleteOtherReason || '') : deleteReason;

    // Map reason to policy category
    const policyCategory = deleteReason === 'other' ? 'other' : deleteReason;
    const finalPolicy = {
      ...deletePolicy,
      category: policyCategory
    };

    const performDelete = async () => {
      // Set loading state
      setActionLoading(prev => ({ ...prev, softban: true }));

      // Store original state for rollback
      const originalUsers = [...users];
      const originalAdmins = [...admins];

      // Optimistically update UI
      if (type === 'user') {
        setUsers(prev => prev.filter(u => u._id !== id));
      } else {
        setAdmins(prev => prev.filter(a => a._id !== id));
      }
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/management/delete/${type}/${id}`, {
          method: "DELETE",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: finalReason,
            policy: finalPolicy
          })
        });
        const data = await res.json();
        if (res.ok) {
          toast.success(`${type === "user" ? "User" : "Admin"} softbanned successfully`);
          // Emit socket event
          socket.emit(type === 'user' ? 'user_update' : 'admin_update', { type: 'delete', [type]: { _id: id }, userId: id });
          // Emit global signout event for the softbanned user
          socket.emit('force_signout', {
            userId: id,
            action: 'softban',
            message: 'Your account has been softbanned. You have been signed out.'
          });
          // Refresh softbanned accounts list if on tab
          if (tab === 'softbanned') fetchSoftbannedAccounts();
          // Close modals only after success
          setShowConfirmModal(false);
          setShowDeleteReasonModal(false);
          setSelectedAccount(null);
          setDeleteReason("");
          setDeleteOtherReason("");
        } else {
          // Rollback on failure
          if (type === 'user') {
            setUsers(originalUsers);
          } else {
            setAdmins(originalAdmins);
          }
          if (res.status === 404) {
            toast.error("Account not found. It may have been already softbanned or moved.");
          } else if (data.message && data.message.toLowerCase().includes("not found")) {
            toast.error("Account not found. It may have been already softbanned or moved.");
          } else {
            toast.error(data.message || "Failed to softban account");
          }
        }
      } catch (err) {
        // Rollback on error
        if (type === 'user') {
          setUsers(originalUsers);
        } else {
          setAdmins(originalAdmins);
        }
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
          toast.error("Network error. Please check your connection and try again.");
        } else {
          toast.error("Failed to softban account. Please try again.");
        }
      } finally {
        // Clear loading state
        setActionLoading(prev => ({ ...prev, softban: false }));
      }
    };

    showConfirmation(
      'Confirm Softban',
      `Are you sure you want to softban this ${type}? This can be restored later.`,
      performDelete,
      {
        confirmText: 'Softban',
        confirmButtonClass: 'bg-red-500 hover:bg-red-600',
        accountId: id
      }
    );
  };

  const handleAccountClick = async (account, type) => {
    setShowAccountModal(true);
    setAccountLoading(true);
    setSelectedAccount(null);
    setAccountStats({
      listings: 0,
      appointments: 0,
      wishlist: 0,
      watchlist: 0,
      reviews: 0,
      receivedReviews: 0,
      referrals: 0,
      payments: 0,
      contracts: 0,
      loans: 0,
      conversations: 0,
      calls: 0,
      forumPosts: 0,
      routes: 0,
      calculations: 0,
      coinBalance: 0
    });
    try {
      // Fetch full user/admin details
      const res = await authenticatedFetch(`${API_BASE_URL}/api/user/id/${account._id}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedAccount({ ...data, type });
        // Fetch comprehensive summary stats
        try {
          const summaryRes = await authenticatedFetch(`${API_BASE_URL}/api/user/summary/${account._id}`);
          const summaryData = await summaryRes.json();

          if (summaryRes.ok && summaryData.success) {
            setAccountStats(summaryData.counts);
          } else {
            // Fallback for counts if summary fails but we still have basic details
            setAccountStats(prev => ({ ...prev }));
          }
        } catch (statsError) {
          console.error('Error fetching account summary:', statsError);
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

  const handleToggleSubscription = async (id, currentStatus, reason = null) => {
    // Case 1: Unsubscribing - Show reason modal first
    if (currentStatus && !reason && !showUnsubscribeReasonModal) {
      setUnsubscribeReasonText("");
      setShowUnsubscribeReasonModal(true);
      return;
    }

    // Case 2: Subscribing - Show simple confirmation modal
    if (!currentStatus && !reason) {
      showConfirmation(
        'Confirm Subscription',
        `Are you sure you want to resubscribe ${selectedAccount?.username || 'this user'} to promotional emails?`,
        () => handleToggleSubscription(id, false, "Resubscribed by Administrator"),
        {
          confirmText: 'Subscribe',
          confirmButtonClass: 'bg-green-500 hover:bg-green-600',
          userId: id
        }
      );
      return;
    }

    setSubscriptionLoading(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/user/toggle-subscription/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isSubscribed: !currentStatus,
          reason: reason || (currentStatus ? "Unsubscribed by Administrator" : "Resubscribed by Administrator")
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        // Update selected account if open
        if (selectedAccount && selectedAccount._id === id) {
          setSelectedAccount(prev => ({
            ...prev,
            isSubscribed: !currentStatus,
            unsubscribeReason: !currentStatus ? (reason || "Unsubscribed by Administrator") : prev.unsubscribeReason
          }));
        }
        // Update users list
        setUsers(prev => prev.map(u => u._id === id ? { ...u, isSubscribed: !currentStatus } : u));
        // Update admins list
        setAdmins(prev => prev.map(a => a._id === id ? { ...a, isSubscribed: !currentStatus } : a));

        // Close modals if they were open
        setShowUnsubscribeReasonModal(false);
        setShowConfirmModal(false);
      } else {
        toast.error(data.message || "Failed to update subscription status");
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setSubscriptionLoading(false);
    }
  };

  // Optimistic UI for promote
  const handlePromote = async (id) => {
    // Check if account is suspended
    const user = users.find(u => u._id === id);
    if (user && user.status === 'suspended') {
      toast.error("Cannot promote suspended account. Please remove suspension first.");
      return;
    }

    const performPromote = async () => {
      // Set loading state
      setActionLoading(prev => ({
        ...prev,
        promote: { ...prev.promote, [id]: true }
      }));

      // Store original state for rollback
      const originalUsers = [...users];
      const originalAdmins = [...admins];

      // Optimistically move user to admins
      if (user) {
        setUsers(prev => prev.filter(u => u._id !== id));
        setAdmins(prev => [
          { ...user, role: 'admin', adminApprovalStatus: 'approved' },
          ...prev
        ]);
      }
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/management/promote/${id}`, {
          method: "PATCH",
        });
        const data = await res.json();
        if (res.ok) {
          toast.success("User promoted to admin successfully");
          // Emit socket event
          socket.emit('admin_update', { type: 'add', admin: { ...user, ...data }, userId: id });
          socket.emit('user_update', { type: 'delete', user: { _id: id }, userId: id });
          // Emit global signout event for the promoted user
          socket.emit('force_signout', {
            userId: id,
            action: 'promote',
            message: 'Your account has been promoted to admin. You have been signed out. Please sign in again to access admin features.'
          });
          // Close modal only after success
          setShowConfirmModal(false);
        } else {
          // Rollback on failure
          setUsers(originalUsers);
          setAdmins(originalAdmins);
          toast.error(data.message || "Failed to promote user");
        }
      } catch (err) {
        // Rollback on error
        setUsers(originalUsers);
        setAdmins(originalAdmins);
        toast.error("Failed to promote user");
      } finally {
        // Clear loading state
        setActionLoading(prev => ({
          ...prev,
          promote: { ...prev.promote, [id]: false }
        }));
      }
    };

    showConfirmation(
      'Promote User to Admin',
      'Are you sure you want to promote this user to admin? They will gain administrative privileges.',
      performPromote,
      {
        confirmText: 'Promote',
        confirmButtonClass: 'bg-purple-500 hover:bg-purple-600',
        userId: id
      }
    );
  };

  // Optimistic UI for demote
  const handleDemote = async (id) => {
    // Check if account is suspended
    const admin = admins.find(a => a._id === id);
    if (admin && admin.status === 'suspended') {
      toast.error("Cannot demote suspended account. Please remove suspension first.");
      return;
    }

    // Show reason modal for demotion
    setDemoteAccount({ id });
    setDemoteReason("");
    setShowDemoteReasonModal(true);
  };

  // Handle demotion with reason
  const performDemotionWithReason = async () => {
    if (!demoteAccount) return;

    const { id } = demoteAccount;
    const admin = admins.find(a => a._id === id);

    // Set loading state
    setActionLoading(prev => ({
      ...prev,
      demote: { ...prev.demote, [id]: true }
    }));

    // Store original state for rollback
    const originalUsers = [...users];
    const originalAdmins = [...admins];

    // Optimistically move admin to users
    if (admin) {
      setAdmins(prev => prev.filter(a => a._id !== id));
      setUsers(prev => [
        { ...admin, role: 'user', adminApprovalStatus: undefined },
        ...prev
      ]);
    }
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/management/demote/${id}`, {
        method: "PATCH",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: demoteReason === 'other' ? demoteOtherReason : demoteReason || 'Administrative decision' })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Admin demoted to user successfully");
        // Emit socket event
        socket.emit('user_update', { type: 'add', user: { ...admin, ...data }, userId: id });
        socket.emit('admin_update', { type: 'delete', admin: { _id: id }, userId: id });
        // Emit global signout event for the demoted admin
        socket.emit('force_signout', {
          userId: id,
          action: 'demote',
          message: 'Your admin privileges have been revoked. You have been signed out. Please sign in again as a regular user.'
        });
        setShowDemoteReasonModal(false);
        setDemoteAccount(null);
        setDemoteReason("");
        setDemoteOtherReason("");
      } else {
        // Rollback on failure
        setUsers(originalUsers);
        setAdmins(originalAdmins);
        toast.error(data.message || "Failed to demote admin");
      }
    } catch (err) {
      // Rollback on error
      setUsers(originalUsers);
      setAdmins(originalAdmins);
      toast.error("Failed to demote admin");
    } finally {
      // Clear loading state
      setActionLoading(prev => ({
        ...prev,
        demote: { ...prev.demote, [id]: false }
      }));
    }
  };

  // Add this handler at the top-level of the component
  const handleReapprove = async (adminId) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/management/reapprove/${adminId}`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (res.ok) {
        setAdmins(prev => prev.map(a => a._id === adminId ? { ...a, adminApprovalStatus: 'approved', status: 'active' } : a));
        toast.success("Admin re-approved successfully!");
        socket.emit('admin_update', { type: 'update', admin: { ...data }, userId: adminId });
        // Emit global signout event for the reapproved admin
        socket.emit('force_signout', {
          userId: adminId,
          action: 'reapprove',
          message: 'Your admin account has been re-approved. You have been signed out. Please sign in again to access admin features.'
        });
      } else {
        toast.error(data.message || "Failed to re-approve admin");
      }
    } catch (err) {
      toast.error("Failed to re-approve admin");
    }
  };

  // Filter accounts based on search term and status
  const filterAccounts = (accounts) => {
    let filtered = accounts;

    // Search term filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(account =>
        account.username?.toLowerCase().includes(term) ||
        account.email?.toLowerCase().includes(term) ||
        account.mobileNumber?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === 'locked') {
        const lockedEmailSet = new Set(passwordLockouts.filter(l => new Date(l.unlockAt) > new Date()).map(l => (l.email || '').toLowerCase()));
        filtered = filtered.filter(account => lockedEmailSet.has((account.email || '').toLowerCase()));
      } else {
        filtered = filtered.filter(account => account.status === statusFilter);
      }
    }

    // Admin approval status filter (only for admin tab)
    if (tab === "admins" && adminApprovalFilter !== "all") {
      filtered = filtered.filter(account => account.adminApprovalStatus === adminApprovalFilter);
    }

    return filtered;
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

  // Helper function to show confirmation modal
  const showConfirmation = (title, message, onConfirm, options = {}) => {
    setConfirmModalData({
      title,
      message,
      onConfirm,
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      confirmButtonClass: options.confirmButtonClass || 'bg-red-500 hover:bg-red-600',
      userId: options.userId,
      accountId: options.accountId
    });
    setShowConfirmModal(true);
  };

  const handleConfirmModalClose = () => {
    setShowConfirmModal(false);
    setConfirmModalData({
      title: '',
      message: '',
      onConfirm: null,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      confirmButtonClass: 'bg-red-500 hover:bg-red-600'
    });
  };

  const handleConfirmModalConfirm = () => {
    if (confirmModalData.onConfirm) {
      confirmModalData.onConfirm();
    }
    // Don't close modal immediately - let the action function handle it
  };

  // Helper functions for restore and purge
  const handleRestore = async (accountId) => {
    const performRestore = async () => {
      // Set loading state
      setActionLoading(prev => ({ ...prev, restore: true }));

      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/deleted-accounts/restore/${accountId}`, {
          method: 'POST',
        });
        const data = await res.json();
        if (res.ok) {
          toast.success('Account restored');
          fetchSoftbannedAccounts();
          // Close modal only after success
          setShowConfirmModal(false);
        } else {
          toast.error(data.message || 'Restore failed');
        }
      } catch (err) {
        toast.error('Failed to restore account');
      } finally {
        // Clear loading state
        setActionLoading(prev => ({ ...prev, restore: false }));
      }
    };

    showConfirmation(
      'Restore Account',
      'Are you sure you want to restore this account? The user will be able to sign in again.',
      performRestore,
      {
        confirmText: 'Restore',
        confirmButtonClass: 'bg-green-500 hover:bg-green-600',
        accountId: accountId
      }
    );
  };

  const handlePurge = async (accountId) => {
    const performPurge = async () => {
      // Set loading state
      setActionLoading(prev => ({ ...prev, purge: true }));

      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/deleted-accounts/purge/${accountId}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (res.ok) {
          toast.success('Account purged');
          fetchSoftbannedAccounts();
          fetchPurgedAccounts();
          // Close modal only after success
          setShowConfirmModal(false);
        } else {
          toast.error(data.message || 'Purge failed');
        }
      } catch (err) {
        toast.error('Failed to purge account');
      } finally {
        // Clear loading state
        setActionLoading(prev => ({ ...prev, purge: false }));
      }
    };

    showConfirmation(
      'Permanently Purge Account',
      'Are you sure you want to permanently purge this account? This action cannot be undone.',
      performPurge,
      {
        confirmText: 'Purge',
        confirmButtonClass: 'bg-red-500 hover:bg-red-600',
        accountId: accountId
      }
    );
  };

  // Helper to start lockout timer
  const startLockoutTimer = () => {
    // Clear any existing timers
    if (lockoutTimerRef.current) clearTimeout(lockoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    // Show warning at 4 minutes
    warningTimerRef.current = setTimeout(() => {
      toast.info("For security reasons, you will be asked to re-enter your password in 1 minute.");
    }, 4 * 60 * 1000);
    // Lock at 5 minutes
    lockoutTimerRef.current = setTimeout(() => {
      setShowPasswordModal(true);
      toast.info("Session expired for security. Please re-enter your password.");
    }, 5 * 60 * 1000);
  };

  // Handle mobile state updates
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Autofocus management password when modal opens (Desktop only)
  useEffect(() => {
    if (showPasswordModal && !isMobile && passwordInputRef.current) {
      setTimeout(() => passwordInputRef.current?.focus(), 100);
    }
  }, [showPasswordModal, isMobile]);

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

  // Add scroll lock for modals
  useEffect(() => {
    if (showAccountModal || showConfirmModal || showDeleteReasonModal) {
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
  }, [showAccountModal, showConfirmModal, showDeleteReasonModal]);

  // Guard: If users/admins are not arrays, show session expired/unauthorized message
  if (!Array.isArray(users) || (tab === 'admins' && !Array.isArray(admins) && currentUser.isDefaultAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Session expired or unauthorized</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">Please sign in again to access admin management.</p>
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
      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/management/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: managementPassword })
      });
      if (res.ok) {
        setShowPasswordModal(false);
        setManagementPassword("");
        setManagementPasswordError("");
        startLockoutTimer(); // Reset timer on every successful entry
      } else {
        const data = await res.json();
        // Track wrong attempts locally (allow up to 3 attempts before logout)
        const key = 'adminMgmtPwAttempts';
        const prev = parseInt(localStorage.getItem(key) || '0');
        const next = prev + 1;
        localStorage.setItem(key, String(next));

        if (next >= 3) {
          // Sign out and redirect on third wrong attempt
          toast.error("Too many incorrect attempts. You've been signed out for security.");
          dispatch(signoutUserStart());
          try {
            const signoutRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/signout`);
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
        } else {
          // Keep modal open and show remaining attempts
          const remaining = 3 - next;
          setManagementPasswordError(`Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} left before logout.`);
          toast.error(`Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`);
          return;
        }
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
        <form className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-xs flex flex-col gap-4" onSubmit={handleManagementPasswordSubmit}>
          <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2"><FaLock /> Confirm Password</h3>
          <input
            ref={passwordInputRef}
            type="password"
            className="border rounded p-2 w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
            placeholder="Enter your password"
            value={managementPassword}
            onChange={e => setManagementPassword(e.target.value)}
          />
          {managementPasswordError && <div className="text-red-600 dark:text-red-400 text-sm">{managementPasswordError}</div>}
          <div className="flex gap-2 justify-end">
            <button type="button" className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="px-4 py-2 rounded bg-blue-700 text-white font-semibold" disabled={managementPasswordLoading}>{managementPasswordLoading ? 'Verifying...' : 'Confirm'}</button>
          </div>
        </form>
      </div>
    );
  }

  if (loading) {
    return <AdminManagementSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-950 dark:to-gray-900 py-10 px-2 md:px-8 animate-fadeIn transition-colors duration-300">
      <div className="max-w-6xl mx-auto bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 animate-slideUp border border-white/20 dark:border-gray-800">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-extrabold text-blue-700 dark:text-blue-400 drop-shadow animate-fade-in">Accounts Management</h1>
          <button
            onClick={() => fetchData()}
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow inline-flex items-center gap-2"
            title="Refresh data"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M12 6V3L8 7l4 4V8c2.757 0 5 2.243 5 5a5 5 0 11-9.9-1H5.026A7 7 0 1019 13c0-3.86-3.141-7-7-7z" />
            </svg>
            Refresh
          </button>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-4 mb-8 animate-fadeIn">
          <button
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-lg shadow transition-all duration-200 ${tab === "users" ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white scale-105" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700"}`}
            onClick={() => {
              setTab("users");
              setShowRestriction(false);
              setSearchTerm("");
              setStatusFilter("all");
              setAdminApprovalFilter("all");
            }}
          >
            Users ({users.length})
          </button>
          <button
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-lg shadow transition-all duration-200 ${tab === "admins" ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white scale-105" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-gray-700"}`}
            onClick={() => {
              if (!currentUser.isDefaultAdmin) {
                setShowRestriction(true);
                setTab("admins");
                setSearchTerm("");
                setStatusFilter("all");
              } else {
                setShowRestriction(false);
                setTab("admins");
                setSearchTerm("");
                setStatusFilter("all");
                setAdminApprovalFilter("all");
              }
            }}
          >
            Admins ({admins.length})
          </button>
          <button
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-lg shadow transition-all duration-200 ${tab === "softbanned" ? "bg-gradient-to-r from-red-500 to-red-600 text-white scale-105" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-gray-700"}`}
            onClick={() => {
              setTab("softbanned");
              setSearchTerm("");
              setStatusFilter("all");
              setAdminApprovalFilter("all");
              fetchSoftbannedAccounts();
            }}
          >
            <span className="hidden sm:inline">Softbanned Accounts ({softbannedAccounts.length})</span>
            <span className="sm:hidden">Softbanned ({softbannedAccounts.length})</span>
          </button>
          <button
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-lg shadow transition-all duration-200 ${tab === "purged" ? "bg-gradient-to-r from-red-500 to-orange-500 text-white scale-105" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-gray-700"}`}
            onClick={() => {
              setTab("purged");
              setSearchTerm("");
              setStatusFilter("all");
              setAdminApprovalFilter("all");
              fetchPurgedAccounts();
            }}
          >
            <span className="hidden sm:inline">Purged Accounts ({purgedAccounts.length})</span>
            <span className="sm:hidden">Purged ({purgedAccounts.length})</span>
          </button>
        </div>

        {/* Enhanced Search and Filters */}
        <div className="mb-6 animate-fadeIn bg-gray-50/50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
          {tab !== 'softbanned' && tab !== 'purged' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Main Search */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaSearch className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors duration-200" />
                </div>
                <input
                  id="admin-management-search"
                  type="text"
                  placeholder={`Search ${tab === "users" ? "users" : "admins"} by name, email...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-gray-200 transition-all duration-200 shadow-sm"
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

              {/* Status Filter Dropdown */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaCheckCircle className="h-5 w-5 text-gray-400 group-hover:text-green-500 transition-colors duration-200" />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 shadow-sm appearance-none cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="locked">Locked</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Admin Approval Status Filter (only for admin tab) */}
              {tab === "admins" && (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaUserShield className="h-5 w-5 text-gray-400 group-hover:text-purple-500 transition-colors duration-200" />
                  </div>
                  <select
                    value={adminApprovalFilter}
                    onChange={(e) => setAdminApprovalFilter(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 shadow-sm appearance-none cursor-pointer"
                  >
                    <option value="all">All Approval Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Clear All Filters */}
              <div className="flex items-center">
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                    setAdminApprovalFilter("all");
                  }}
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  <FaTimes className="text-sm" />
                  Clear All Filters
                </button>
              </div>
            </div>
          ) : tab === 'softbanned' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <input value={softbannedFilters.q} onChange={e => setSoftbannedFilters(f => ({ ...f, q: e.target.value }))} placeholder="Search name/email" className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={softbannedFilters.role} onChange={e => setSoftbannedFilters(f => ({ ...f, role: e.target.value }))} className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All Roles</option>
                <option value="user">User</option>
                {currentUser.isDefaultAdmin && <option value="admin">Admin</option>}
              </select>
              <input type="date" value={softbannedFilters.from} onChange={e => setSoftbannedFilters(f => ({ ...f, from: e.target.value }))} className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="date" value={softbannedFilters.to} onChange={e => setSoftbannedFilters(f => ({ ...f, to: e.target.value }))} className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input value={softbannedFilters.softbannedBy} onChange={e => setSoftbannedFilters(f => ({ ...f, softbannedBy: e.target.value }))} placeholder="Softbanned by (id or self)" className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex items-center gap-2">
                <button onClick={fetchSoftbannedAccounts} className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors">Apply</button>
                <button onClick={() => { setSoftbannedFilters({ q: '', role: 'all', softbannedBy: '', from: '', to: '' }); setTimeout(fetchSoftbannedAccounts, 0); }} className="px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl transition-colors">Clear</button>
              </div>
              <div className="col-span-full text-sm text-gray-600">
                {currentUser.isDefaultAdmin ? 'You are viewing all softbanned accounts (users + admins).' : 'You are viewing only softbanned user accounts.'}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <input value={purgedFilters.q} onChange={e => setPurgedFilters(f => ({ ...f, q: e.target.value }))} placeholder="Search name/email" className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={purgedFilters.role} onChange={e => setPurgedFilters(f => ({ ...f, role: e.target.value }))} className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All Roles</option>
                <option value="user">User</option>
                {currentUser.isDefaultAdmin && <option value="admin">Admin</option>}
              </select>
              <input type="date" value={purgedFilters.from} onChange={e => setPurgedFilters(f => ({ ...f, from: e.target.value }))} className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="date" value={purgedFilters.to} onChange={e => setPurgedFilters(f => ({ ...f, to: e.target.value }))} className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input value={purgedFilters.purgedBy} onChange={e => setPurgedFilters(f => ({ ...f, purgedBy: e.target.value }))} placeholder="Purged by (id)" className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex items-center gap-2">
                <button onClick={fetchPurgedAccounts} className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors">Apply</button>
                <button onClick={() => { setPurgedFilters({ q: '', role: 'all', purgedBy: '', from: '', to: '' }); setTimeout(fetchPurgedAccounts, 0); }} className="px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl transition-colors">Clear</button>
              </div>
              <div className="col-span-full text-sm text-gray-600">
                {currentUser.isDefaultAdmin ? 'You are viewing all purged accounts (users + admins). These accounts are permanently removed.' : 'You are viewing only purged user accounts. These accounts are permanently removed.'}
              </div>
            </div>
          )}

          {/* Results Summary */}
          {tab !== 'softbanned' && tab !== 'purged' && (searchTerm || statusFilter !== "all" || adminApprovalFilter !== "all") && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <span className="font-semibold">Active Filters:</span>
                {searchTerm && <span className="ml-2 px-2 py-1 bg-blue-200 dark:bg-blue-800 rounded text-xs">Search: "{searchTerm}"</span>}
                {statusFilter !== "all" && <span className="ml-2 px-2 py-1 bg-green-200 dark:bg-green-800/50 rounded text-xs">Status: {statusFilter}</span>}
                {tab === "admins" && adminApprovalFilter !== "all" && <span className="ml-2 px-2 py-1 bg-purple-200 dark:bg-purple-800/50 rounded text-xs">Approval: {adminApprovalFilter}</span>}
              </div>
              <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                Found {tab === "users" ? filteredUsers.length : filteredAdmins.length} {tab === "users" ? "user" : "admin"}{tab === "users" ? (filteredUsers.length !== 1 ? "s" : "") : (filteredAdmins.length !== 1 ? "s" : "")} matching your filters
              </div>
            </div>
          )}

          <div className="mt-2 text-xs text-gray-400">
            💡 Tip: Press Ctrl+F to quickly focus the search box • Use status filter to view active or suspended accounts
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
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2 animate-fadeIn">
                  <FaUser className="text-blue-500" /> Users ({users.length})
                </h2>
                {filteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 animate-fadeIn">
                    <FaUserLock className="text-6xl text-gray-300 dark:text-gray-600 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                      {(searchTerm || statusFilter !== "all") ? `No users found matching your filters` : "No users found."}
                    </p>
                    {(searchTerm || statusFilter !== "all") && (
                      <button
                        onClick={() => {
                          setSearchTerm("");
                          setStatusFilter("all");
                        }}
                        className="mt-4 text-blue-500 hover:text-blue-600 underline"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 animate-fadeIn">
                    {filteredUsers.map((user) => (
                      <div
                        key={user._id}
                        className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-all duration-200 animate-slideUp cursor-pointer hover:border-blue-200 dark:hover:border-blue-800"
                        onClick={() => handleAccountClick(user, 'user')}
                        title="Click to view full details"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-500/20 flex-shrink-0 flex items-center justify-center text-2xl font-bold text-blue-600 dark:text-blue-400">
                            <FaUser />
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <div className="flex items-center gap-2 w-full min-w-0">
                              <span className="text-lg font-bold text-gray-800 dark:text-white truncate flex-1" title={user.username}>{highlightMatch(user.username)}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-md font-bold uppercase flex-shrink-0 ${user.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>{user.status}</span>
                            </div>

                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm w-full min-w-0">
                              <FaEnvelope className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                              <span className="truncate" title={user.email}>{highlightMatch(user.email)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                              <FaPhone className="text-gray-400 dark:text-gray-500" /> {user.mobileNumber ? highlightMatch(user.mobileNumber) : <span className="italic text-gray-300 dark:text-gray-600">No mobile</span>}
                            </div>
                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                              <FaCalendarAlt className="text-gray-400 dark:text-gray-500" /> {new Date(user.createdAt).toLocaleDateString('en-GB')}
                            </div>

                            {(() => {
                              if (!passwordLockouts || !Array.isArray(passwordLockouts)) return null;
                              const entry = passwordLockouts.find(l => (l.email || '').toLowerCase() === (user.email || '').toLowerCase() && new Date(l.unlockAt) > new Date());
                              if (!entry) return null;
                              const remainingMs = new Date(entry.unlockAt).getTime() - Date.now();
                              const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000));
                              return (
                                <div className="mt-1 text-xs text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/50 rounded px-2 py-1 inline-block">
                                  Locked: ~{remainingMin} min left
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 mt-4 sm:flex-row sm:gap-2">
                          <button
                            className={`flex-1 px-2 py-1 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${user.status === "active" ? "bg-yellow-400 dark:bg-yellow-500/80 text-white hover:bg-yellow-500" : "bg-green-500 dark:bg-green-600/80 text-white hover:bg-green-600"}`}
                            onClick={e => { e.stopPropagation(); handleSuspend(user._id, "user"); }}
                          >
                            {actionLoading.suspend[user._id] ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                {user.status === "active" ? "Suspending..." : "Activating..."}
                              </>
                            ) : (
                              <>
                                {user.status === "active" ? <FaBan /> : <FaCheckCircle />}
                                {user.status === "active" ? "Suspend" : "Activate"}
                              </>
                            )}
                          </button>
                          <button
                            className="flex-1 px-2 py-1 rounded-lg font-semibold text-sm bg-red-500 text-white hover:bg-red-600 transition-all duration-200 flex items-center justify-center gap-2"
                            onClick={e => { e.stopPropagation(); handleDelete(user._id, "user"); }}
                          >
                            <FaTrash /> Softban
                          </button>
                          {currentUser.isDefaultAdmin && (
                            <button
                              className="flex-1 px-2 py-1 rounded-lg font-semibold text-sm bg-purple-500 text-white hover:bg-purple-600 transition-all duration-200 flex items-center justify-center gap-2"
                              onClick={e => { e.stopPropagation(); handlePromote(user._id); }}
                            >
                              {actionLoading.promote[user._id] ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  Promoting...
                                </>
                              ) : (
                                <>
                                  <FaUserShield /> Promote to Admin
                                </>
                              )}
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
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2 animate-fadeIn">
                  <FaUserShield className="text-purple-500" /> Admins ({admins.length})
                </h2>
                {filteredAdmins.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 animate-fadeIn">
                    <FaUserLock className="text-6xl text-gray-300 dark:text-gray-600 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                      {(searchTerm || statusFilter !== "all" || adminApprovalFilter !== "all") ? `No admins found matching your filters` : "No admins found."}
                    </p>
                    {(searchTerm || statusFilter !== "all" || adminApprovalFilter !== "all") && (
                      <button
                        onClick={() => {
                          setSearchTerm("");
                          setStatusFilter("all");
                          setAdminApprovalFilter("all");
                        }}
                        className="mt-4 text-blue-500 hover:text-blue-600 underline"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 animate-fadeIn">
                    {filteredAdmins.map((admin) => (
                      <div
                        key={admin._id}
                        className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-all duration-200 animate-slideUp cursor-pointer hover:border-purple-200 dark:hover:border-purple-800"
                        onClick={() => handleAccountClick(admin, 'admin')}
                        title="Click to view full details"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex-shrink-0 flex items-center justify-center text-2xl font-bold text-purple-600 dark:text-purple-400">
                            <FaUserShield />
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <div className="flex items-center gap-2 w-full min-w-0">
                              <span className="text-lg font-bold text-gray-800 dark:text-white truncate flex-1" title={admin.username}>{highlightMatch(admin.username)}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-md font-bold uppercase flex-shrink-0 ${admin.adminApprovalStatus === 'rejected' ? 'bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300' : admin.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>{admin.adminApprovalStatus === 'rejected' ? 'rejected' : admin.status}</span>
                            </div>

                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm w-full min-w-0">
                              <FaEnvelope className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                              <span className="truncate" title={admin.email}>{highlightMatch(admin.email)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                              <FaPhone className="text-gray-400 dark:text-gray-500" /> {admin.mobileNumber ? highlightMatch(admin.mobileNumber) : <span className="italic text-gray-300 dark:text-gray-600">No mobile</span>}
                            </div>
                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                              <FaCalendarAlt className="text-gray-400 dark:text-gray-500" /> {new Date(admin.createdAt).toLocaleDateString('en-GB')}
                            </div>

                            {(() => {
                              if (!passwordLockouts || !Array.isArray(passwordLockouts)) return null;
                              const entry = passwordLockouts.find(l => (l.email || '').toLowerCase() === (admin.email || '').toLowerCase() && new Date(l.unlockAt) > new Date());
                              if (!entry) return null;
                              const remainingMs = new Date(entry.unlockAt).getTime() - Date.now();
                              const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000));
                              return (
                                <div className="mt-1 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1 inline-block">
                                  Locked: ~{remainingMin} min left
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 mt-4 sm:flex-row sm:gap-2">
                          <button
                            className={`flex-1 px-2 py-1 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${admin.status === "active" ? "bg-yellow-400 dark:bg-yellow-500/80 text-white hover:bg-yellow-500" : "bg-green-500 dark:bg-green-600/80 text-white hover:bg-green-600"}`}
                            onClick={e => { e.stopPropagation(); handleSuspend(admin._id, "admin"); }}
                          >
                            {actionLoading.suspend[admin._id] ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                {admin.status === "active" ? "Suspending..." : "Activating..."}
                              </>
                            ) : (
                              <>
                                {admin.status === "active" ? <FaBan /> : <FaCheckCircle />}
                                {admin.status === "active" ? "Suspend" : "Activate"}
                              </>
                            )}
                          </button>
                          <button
                            className="flex-1 px-2 py-1 rounded-lg font-semibold text-sm bg-red-500 text-white hover:bg-red-600 transition-all duration-200 flex items-center justify-center gap-2"
                            onClick={e => { e.stopPropagation(); handleDelete(admin._id, "admin"); }}
                          >
                            <FaTrash /> Softban
                          </button>
                          <button
                            className="flex-1 px-2 py-1 rounded-lg font-semibold text-sm bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 flex items-center justify-center gap-2"
                            onClick={e => { e.stopPropagation(); handleDemote(admin._id); }}
                          >
                            {actionLoading.demote[admin._id] ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Demoting...
                              </>
                            ) : (
                              <>
                                <FaArrowDown /> Demote to User
                              </>
                            )}
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
            {tab === 'softbanned' && (
              <div className="mt-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Softbanned Accounts ({softbannedAccounts.length})</h2>
                {softbannedLoading ? (
                  <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div><span className="ml-3 text-gray-600 dark:text-gray-400">Loading...</span></div>
                ) : softbannedAccounts.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/30">No softbanned accounts found</div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr className="text-left text-gray-700 dark:text-gray-300">
                          <th className="px-4 py-2 whitespace-nowrap">Name</th>
                          <th className="px-4 py-2 whitespace-nowrap">Email</th>
                          <th className="px-4 py-2 whitespace-nowrap">Role</th>
                          <th className="px-4 py-2 whitespace-nowrap">Date Softbanned</th>
                          <th className="px-4 py-2 whitespace-nowrap">Softbanned By</th>
                          <th className="px-4 py-2 whitespace-nowrap">Reason</th>
                          <th className="px-4 py-2 whitespace-nowrap">Policy</th>
                          <th className="px-4 py-2 whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {softbannedAccounts.map(acc => (
                          <tr key={acc._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="px-4 py-2 font-medium text-gray-800 dark:text-white whitespace-nowrap">{acc.name}</td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{acc.email}</td>
                            <td className="px-4 py-2 whitespace-nowrap"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${acc.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>{acc.role}</span></td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{acc.deletedAt ? new Date(acc.deletedAt).toLocaleString('en-GB') : '-'}</td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{typeof acc.deletedBy === 'string' ? acc.deletedBy : (acc.deletedBy?._id || acc.deletedBy)}</td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{acc.reason || '-'}</td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                              {acc.policy ? (
                                <div className="text-xs">
                                  <div><strong>Category:</strong> {acc.policy.category || '-'}</div>
                                  <div><strong>Ban Type:</strong> {acc.policy.banType || '-'}</div>
                                  {acc.policy.allowResignupAfterDays > 0 && (
                                    <div><strong>Resignup After:</strong> {acc.policy.allowResignupAfterDays} days</div>
                                  )}
                                </div>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              {currentUser.isDefaultAdmin ? (
                                <div className="flex gap-2">
                                  <button onClick={() => handleRestore(acc._id)} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700">Restore</button>
                                  <button onClick={() => handlePurge(acc._id)} className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700">Purge</button>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  {acc.role === 'user' ? (
                                    <button onClick={() => handleRestore(acc._id)} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700">Restore</button>
                                  ) : (
                                    <span className="text-xs text-gray-500 dark:text-gray-400">View only</span>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {tab === 'purged' && (
              <div className="mt-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Purged Accounts (Permanently Removed) ({purgedAccounts.length})</h2>
                {purgedLoading ? (
                  <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div><span className="ml-3 text-gray-600 dark:text-gray-400">Loading...</span></div>
                ) : purgedAccounts.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/30">No purged accounts found</div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full text-sm">
                      <thead className="bg-red-50 dark:bg-red-900/20">
                        <tr className="text-left text-gray-700 dark:text-gray-300">
                          <th className="px-4 py-2 whitespace-nowrap">Name</th>
                          <th className="px-4 py-2 whitespace-nowrap">Email</th>
                          <th className="px-4 py-2 whitespace-nowrap">Role</th>
                          <th className="px-4 py-2 whitespace-nowrap">Date Softbanned</th>
                          <th className="px-4 py-2 whitespace-nowrap">Date Purged</th>
                          <th className="px-4 py-2 whitespace-nowrap">Purged By</th>
                          <th className="px-4 py-2 whitespace-nowrap">Reason</th>
                          <th className="px-4 py-2 whitespace-nowrap">Policy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {purgedAccounts.map(acc => (
                          <tr key={acc._id} className="hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                            <td className="px-4 py-2 font-medium text-gray-800 dark:text-white whitespace-nowrap">{acc.name}</td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{acc.email}</td>
                            <td className="px-4 py-2 whitespace-nowrap"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${acc.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>{acc.role}</span></td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{acc.deletedAt ? new Date(acc.deletedAt).toLocaleString('en-GB') : '-'}</td>
                            <td className="px-4 py-2 text-red-600 dark:text-red-400 font-semibold whitespace-nowrap">{acc.purgedAt ? new Date(acc.purgedAt).toLocaleString('en-GB') : '-'}</td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{acc.purgedBy ? (typeof acc.purgedBy === 'string' ? acc.purgedBy : acc.purgedBy._id) : '-'}</td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{acc.reason || '-'}</td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                              {acc.policy ? (
                                <div className="text-xs">
                                  <div><strong>Category:</strong> {acc.policy.category || '-'}</div>
                                  <div><strong>Ban Type:</strong> {acc.policy.banType || '-'}</div>
                                  {acc.policy.allowResignupAfterDays > 0 && (
                                    <div><strong>Resignup After:</strong> {acc.policy.allowResignupAfterDays} days</div>
                                  )}
                                </div>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {/* Account Details Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto p-0 relative animate-scale-in border border-white/20 dark:border-gray-700">
            {/* Close button top right */}
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-2 transition-colors z-10 shadow"
              onClick={() => setShowAccountModal(false)}
              title="Close"
              aria-label="Close"
            >
              <FaTimes className="w-4 h-4" />
            </button>
            {/* Header */}
            <div className="flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-t-3xl px-6 py-8 border-b border-gray-100 dark:border-gray-700">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="relative">
                  <img
                    src={selectedAccount?.avatar || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'}
                    alt="avatar"
                    className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-gray-700 shadow-xl"
                    onError={e => { e.target.onerror = null; e.target.src = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'; }}
                  />
                  <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 ${selectedAccount?.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                    {selectedAccount?.username}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedAccount?.email}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col items-center">
                <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm ${selectedAccount?.type === 'admin' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'}`}>
                  {selectedAccount?.type === 'admin' ? <FaUserShield /> : <FaUser />}
                  {selectedAccount?.type === 'admin' ? 'Admin' : 'User'}
                </span>
              </div>
            </div>
            {/* Body */}
            <div className="px-4 sm:px-8 py-4 space-y-4">
              {accountLoading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : selectedAccount ? (
                <>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm">
                      <FaPhone className="text-blue-400" />
                      <span><strong>Mobile:</strong> {selectedAccount.mobileNumber || 'Not provided'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm">
                      <FaUser className="text-purple-400" />
                      <span><strong>Gender:</strong> {selectedAccount.gender ? selectedAccount.gender.charAt(0).toUpperCase() + selectedAccount.gender.slice(1) : 'Not provided'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm">
                      <FaHome className="text-green-400" />
                      <span><strong>Address:</strong> {selectedAccount.address || 'Not provided'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm">
                      <FaCalendarAlt className="text-purple-400" />
                      <span><strong>Member Since:</strong> {selectedAccount.createdAt ? new Date(selectedAccount.createdAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      }) : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm">
                      <FaCalendarAlt className="text-blue-400" />
                      <span><strong>Last Updated Profile:</strong> {selectedAccount.updatedAt ? new Date(selectedAccount.updatedAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      }) + ' ' + new Date(selectedAccount.updatedAt).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'Never'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4 bg-gray-50/50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm flex flex-col">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Listings:</span>
                        <span className="text-blue-600 dark:text-blue-400 font-bold">{accountStats.listings}</span>
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm flex flex-col">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Appointments:</span>
                        <span className="text-pink-600 dark:text-pink-400 font-bold">{accountStats.appointments}</span>
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm flex flex-col">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Wishlist:</span>
                        <span className="text-gray-700 dark:text-gray-200 font-bold">{accountStats.wishlist}</span>
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm flex flex-col">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Watchlist:</span>
                        <span className="text-gray-700 dark:text-gray-200 font-bold">{accountStats.watchlist}</span>
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm flex flex-col">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Reviews Written:</span>
                        <span className="text-gray-700 dark:text-gray-200 font-bold">{accountStats.reviews}</span>
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm flex flex-col">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Reviews Received:</span>
                        <span className="text-gray-700 dark:text-gray-200 font-bold">{accountStats.receivedReviews}</span>
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm flex flex-col">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">SetuCoins:</span>
                        <span className="text-yellow-600 dark:text-yellow-400 font-bold">{accountStats.coinBalance}</span>
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm flex flex-col">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Referrals:</span>
                        <span className="text-green-600 dark:text-green-400 font-bold">{accountStats.referrals}</span>
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm flex flex-col">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Conversations:</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">{accountStats.conversations}</span>
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm flex flex-col">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Call History:</span>
                        <span className="text-purple-600 dark:text-purple-400 font-bold">{accountStats.calls}</span>
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm flex flex-col">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">forum Posts:</span>
                        <span className="text-gray-700 dark:text-gray-200 font-bold">{accountStats.forumPosts}</span>
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm flex flex-col">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Saved Routes:</span>
                        <span className="text-gray-700 dark:text-gray-200 font-bold">{accountStats.routes}</span>
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm flex flex-col">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Investments:</span>
                        <span className="text-gray-700 dark:text-gray-200 font-bold">{accountStats.calculations}</span>
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm flex flex-col">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Payments:</span>
                        <span className="text-gray-700 dark:text-gray-200 font-bold">{accountStats.payments}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm">
                      <span><strong>Status:</strong> {selectedAccount.status || 'active'}</span>
                    </div>
                    {/* Subscription Status Toggle for Admin */}
                    <div className="flex items-center justify-between gap-2 text-gray-700 dark:text-gray-300 text-sm bg-gray-100/50 dark:bg-gray-800/50 p-2 rounded-lg mt-2 font-medium">
                      <div className="flex items-center gap-2">
                        <FaEnvelope className={selectedAccount.isSubscribed !== false ? "text-green-500" : "text-gray-400"} />
                        <span><strong>Promotional Emails:</strong> {selectedAccount.isSubscribed !== false ? 'Subscribed' : 'Unsubscribed'}</span>
                      </div>
                      <button
                        onClick={() => handleToggleSubscription(selectedAccount._id, selectedAccount.isSubscribed !== false)}
                        disabled={subscriptionLoading}
                        className={`text-xs px-3 py-1 rounded-md font-bold transition-all ${selectedAccount.isSubscribed !== false ? "bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white" : "bg-green-500/10 text-green-600 hover:bg-green-500 hover:text-white"}`}
                      >
                        {subscriptionLoading ? '...' : (selectedAccount.isSubscribed !== false ? 'Unsubscribe' : 'Subscribe')}
                      </button>
                    </div>
                    {selectedAccount.isSubscribed === false && selectedAccount.unsubscribeReason && (
                      <div className="flex flex-col gap-1 text-gray-700 dark:text-gray-300 text-sm bg-red-50/50 dark:bg-red-900/10 p-2 rounded-lg mt-1 border border-red-100/50 dark:border-red-900/20">
                        <span className="font-bold flex items-center gap-2">
                          <FaExclamationCircle className="text-red-500 text-xs" /> Unsubscribe Reason:
                        </span>
                        <p className="italic text-gray-600 dark:text-gray-400 ml-5">"{selectedAccount.unsubscribeReason}"</p>
                      </div>
                    )}
                    {/* Lockout remaining time (password lockout) */}
                    {(() => {
                      if (!passwordLockouts || !Array.isArray(passwordLockouts)) return null;
                      const entry = passwordLockouts.find(l => (l.email || '').toLowerCase() === (selectedAccount.email || '').toLowerCase() && new Date(l.unlockAt) > new Date());
                      if (!entry) return null;
                      const remainingMs = new Date(entry.unlockAt).getTime() - Date.now();
                      const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000));
                      return (
                        <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 text-sm">
                          <span><strong>Time left to unlock:</strong> about {remainingMin} minute{remainingMin > 1 ? 's' : ''}</span>
                        </div>
                      );
                    })()}
                    {/* Suspension details */}
                    {selectedAccount.status === 'suspended' && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm">
                          <span><strong>Suspended on:</strong> {selectedAccount.suspendedAt ? new Date(selectedAccount.suspendedAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}</span>
                        </div>
                        {selectedAccount.suspendedBy && (
                          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm">
                            <span><strong>Suspended by:</strong> {selectedAccount.suspendedBy?.username || selectedAccount.suspendedBy?.email || selectedAccount.suspendedBy}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {selectedAccount.type === 'admin' && (
                      <>
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm">
                          <span><strong>Admin Status:</strong> {selectedAccount.adminApprovalStatus}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm">
                          <span><strong>Admin Approval Date:</strong> {selectedAccount.adminApprovalDate ? new Date(selectedAccount.adminApprovalDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          }) : 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm">
                          <span><strong>Approved By:</strong> {selectedAccount.approvedBy ? selectedAccount.approvedBy.username || selectedAccount.approvedBy.email || selectedAccount.approvedBy : 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm">
                          <span><strong>Admin Request Date:</strong> {selectedAccount.adminRequestDate ? new Date(selectedAccount.adminRequestDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          }) : 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm">
                          <span><strong>Is Default Admin:</strong> {selectedAccount.isDefaultAdmin ? 'Yes' : 'No'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-red-500">Failed to load details.</p>
              )}
            </div>
          </div>
        </div>
      )
      }

      {/* Confirmation Modal */}
      {
        showConfirmModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 animate-scale-in border border-white/20 dark:border-gray-700">
              <div className="p-6">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">{confirmModalData.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-8">{confirmModalData.message}</p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={handleConfirmModalClose}
                    className="px-6 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 font-semibold transition-all"
                  >
                    {confirmModalData.cancelText}
                  </button>
                  <button
                    onClick={handleConfirmModalConfirm}
                    className={`px-6 py-2.5 rounded-xl text-white font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${confirmModalData.confirmButtonClass}`}
                    disabled={actionLoading.promote[confirmModalData.userId] || actionLoading.demote[confirmModalData.userId] || actionLoading.restore || actionLoading.purge || actionLoading.suspend[confirmModalData.userId] || actionLoading.softban}
                  >
                    {(actionLoading.promote[confirmModalData.userId] || actionLoading.demote[confirmModalData.userId] || actionLoading.restore || actionLoading.purge || actionLoading.suspend[confirmModalData.userId] || actionLoading.softban) ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        {actionLoading.promote[confirmModalData.userId] ? 'Promoting...' :
                          actionLoading.demote[confirmModalData.userId] ? 'Demoting...' :
                            actionLoading.suspend[confirmModalData.userId] ? 'Activating...' :
                              actionLoading.softban ? 'Processing...' :
                                actionLoading.restore ? 'Restoring...' : 'Purging...'}
                      </>
                    ) : (
                      confirmModalData.confirmText
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Softban Reason Modal */}
      {
        showDeleteReasonModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-lg w-full p-8 max-h-[90vh] overflow-y-auto border border-white/20 dark:border-gray-700 transform animate-scale-in">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Reason for Softban</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-3">Please select a reason and configure policy to proceed.</p>

              {/* Reason Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reason</label>
                <select
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                  value={deleteReason}
                  onChange={e => setDeleteReason(e.target.value)}
                >
                  <option value="">Select a reason</option>
                  {selectedAccount?.type === 'user' ? (
                    <>
                      <option value="fraud">Fraudulent activity</option>
                      <option value="duplicate">Fake or duplicate account</option>
                      <option value="inappropriate">Inappropriate content or behavior</option>
                      <option value="policy_violation">Violation of terms & policies</option>
                      <option value="requested_by_user">Requested by user (support request)</option>
                      <option value="other">Other (textbox optional)</option>
                    </>
                  ) : (
                    <>
                      <option value="misuse_privileges">Misuse of admin privileges</option>
                      <option value="inactive_admin">Inactive admin account</option>
                      <option value="violation_trust">Violation of policies or trust</option>
                      <option value="role_restructure">Role restructuring / reassigning</option>
                      <option value="other">Other (textbox optional)</option>
                    </>
                  )}
                </select>
              </div>

              {deleteReason === 'other' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Additional Details</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="Optional details"
                    value={deleteOtherReason}
                    onChange={e => setDeleteOtherReason(e.target.value)}
                  />
                </div>
              )}

              {/* Policy Configuration */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ban Type</label>
                <select
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  value={deletePolicy.banType}
                  onChange={e => setDeletePolicy(prev => ({ ...prev, banType: e.target.value }))}
                >
                  <option value="allow">Allow re-signup (default)</option>
                  <option value="ban">Permanent ban</option>
                </select>
              </div>

              {deletePolicy.banType === 'allow' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cooling-off Period (days)</label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="0 for immediate re-signup"
                    value={deletePolicy.allowResignupAfterDays}
                    onChange={e => setDeletePolicy(prev => ({ ...prev, allowResignupAfterDays: parseInt(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Set to 0 for immediate re-signup, or specify days to wait</p>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Policy Notes (Optional)</label>
                <textarea
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                  rows="2"
                  placeholder="Additional policy notes..."
                  value={deletePolicy.notes}
                  onChange={e => setDeletePolicy(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  className="px-4 py-2 rounded-lg bg-gray-500 text-white hover:bg-gray-600 dark:hover:bg-gray-400 transition-colors"
                  onClick={() => {
                    setShowDeleteReasonModal(false);
                    setSelectedAccount(null);
                    setDeletePolicy({ category: '', banType: 'allow', allowResignupAfterDays: 0, notes: '' });
                  }}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  onClick={async () => {
                    // Close the reason modal first
                    setShowDeleteReasonModal(false);
                    await performDeleteWithReason();
                  }}
                  disabled={actionLoading.softban}
                >
                  {actionLoading.softban ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    'Confirm Softban'
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Suspension Reason Modal */}
      {
        showSuspensionReasonModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Reason for Suspension</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-3">Please provide a reason for suspending this account. This will be included in the notification email.</p>

              {/* Reason Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Suspension Reason</label>
                <select
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 mb-3 dark:bg-gray-700 dark:text-white"
                  value={suspensionReason}
                  onChange={e => setSuspensionReason(e.target.value)}
                >
                  <option value="">Select a reason</option>
                  {suspensionAccount?.type === 'user' ? (
                    <>
                      <option value="inappropriate_content">Inappropriate content or behavior</option>
                      <option value="policy_violation">Violation of terms & policies</option>
                      <option value="spam_activity">Spam or suspicious activity</option>
                      <option value="fraudulent_activity">Fraudulent activity</option>
                      <option value="harassment">Harassment or abuse</option>
                      <option value="fake_account">Fake or duplicate account</option>
                      <option value="other">Other (specify below)</option>
                    </>
                  ) : (
                    <>
                      <option value="misuse_privileges">Misuse of admin privileges</option>
                      <option value="policy_violation">Violation of admin policies</option>
                      <option value="inappropriate_behavior">Inappropriate behavior</option>
                      <option value="security_concern">Security concern</option>
                      <option value="inactive_admin">Inactive admin account</option>
                      <option value="other">Other (specify below)</option>
                    </>
                  )}
                </select>

                {suspensionReason === 'other' && (
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="Please specify the reason..."
                    value={suspensionOtherReason}
                    onChange={e => setSuspensionOtherReason(e.target.value)}
                  />
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  className="px-4 py-2 rounded-lg bg-gray-500 text-white hover:bg-gray-600 dark:hover:bg-gray-400 transition-colors"
                  onClick={() => {
                    setShowSuspensionReasonModal(false);
                    setSuspensionAccount(null);
                    setSuspensionReason("");
                    setSuspensionOtherReason("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  onClick={performSuspensionWithReason}
                  disabled={!suspensionReason || (suspensionReason === 'other' && !suspensionOtherReason.trim()) || actionLoading.suspend[suspensionAccount?.id]}
                >
                  {actionLoading.suspend[suspensionAccount?.id] ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Suspending...
                    </>
                  ) : (
                    'Suspend Account'
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Demote Reason Modal */}
      {
        showDemoteReasonModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Reason for Demotion</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-3">Please provide a reason for demoting this admin to user. This will be included in the notification email.</p>

              {/* Reason Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Demotion Reason</label>
                <select
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 dark:bg-gray-700 dark:text-white"
                  value={demoteReason}
                  onChange={e => setDemoteReason(e.target.value)}
                >
                  <option value="">Select a reason</option>
                  <option value="misuse_privileges">Misuse of admin privileges</option>
                  <option value="policy_violation">Violation of admin policies</option>
                  <option value="inappropriate_behavior">Inappropriate behavior</option>
                  <option value="security_concern">Security concern</option>
                  <option value="inactive_admin">Inactive admin account</option>
                  <option value="performance_issues">Performance issues</option>
                  <option value="organizational_changes">Organizational changes</option>
                  <option value="other">Other (specify below)</option>
                </select>

                {demoteReason === 'other' && (
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="Please specify the reason..."
                    value={demoteOtherReason}
                    onChange={e => setDemoteOtherReason(e.target.value)}
                  />
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  className="px-4 py-2 rounded-lg bg-gray-500 text-white hover:bg-gray-600 dark:hover:bg-gray-400 transition-colors"
                  onClick={() => {
                    setShowDemoteReasonModal(false);
                    setDemoteAccount(null);
                    setDemoteReason("");
                    setDemoteOtherReason("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  onClick={performDemotionWithReason}
                  disabled={!demoteReason || (demoteReason === 'other' && !demoteOtherReason.trim()) || actionLoading.demote[demoteAccount?.id]}
                >
                  {actionLoading.demote[demoteAccount?.id] ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Demoting...
                    </>
                  ) : (
                    'Demote Admin'
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Unsubscribe Reason Modal */}
      {showUnsubscribeReasonModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 animate-scale-in border border-white/20 dark:border-gray-700">
            <div className="p-6">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaEnvelope className="text-red-500" /> Confirm Unsubscribe
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                You are about to unsubscribe <strong>{selectedAccount?.username}</strong> from promotional emails. Please provide a reason for this action.
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reason (Optional)</label>
                <textarea
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white min-h-[100px]"
                  placeholder="e.g., Requested via support, Policy violation, etc."
                  value={unsubscribeReasonText}
                  onChange={(e) => setUnsubscribeReasonText(e.target.value)}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowUnsubscribeReasonModal(false)}
                  className="px-6 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleToggleSubscription(selectedAccount._id, true, unsubscribeReasonText || "Unsubscribed by Administrator")}
                  disabled={subscriptionLoading}
                  className="px-6 py-2.5 rounded-xl bg-red-500 text-white font-semibold transition-all shadow-lg hover:shadow-xl hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {subscriptionLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    'Unsubscribe User'
                  )}
                </button>
              </div>
            </div>
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
    </div >
  );
} 
