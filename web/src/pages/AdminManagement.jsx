import React, { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';
import { FaHome, FaUser, FaUserShield, FaEnvelope, FaTimes, FaCalendarAlt, FaCheckCircle, FaBan, FaTrash, FaUserLock, FaPhone, FaList, FaCalendar, FaArrowDown, FaSearch, FaLock, FaExclamationCircle, FaCoins, FaComments, FaMapMarkedAlt, FaChartLine, FaCreditCard, FaHeart, FaEye, FaClock, FaUnlockAlt } from "react-icons/fa";
import { getErrorCode } from "../utils/errorRegistry";
import { socket } from "../utils/socket";
import { signoutUserStart, signoutUserSuccess, signoutUserFailure } from "../redux/user/userSlice";
import { authenticatedFetch } from "../utils/auth";

import { usePageTitle } from '../hooks/usePageTitle';
import { isMobileDevice } from '../utils/mobileUtils';
import AdminManagementSkeleton from '../components/skeletons/AdminManagementSkeleton';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminManagement() {
  // Set page title
  usePageTitle("Account Management - User & Admin Control");

  const { currentUser } = useSelector((state) => state.user);
  const isRootOrDefault = currentUser?.isDefaultAdmin || currentUser?.role === 'rootadmin';
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [tab, setTab] = useState("users");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const passwordInputRef = useRef(null);
  const isProgrammaticReloadRef = useRef(false);
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
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [promoSubscriptionFilter, setPromoSubscriptionFilter] = useState("all");
  const [adminApprovalFilter, setAdminApprovalFilter] = useState("all");
  
  // Tab Counts global state
  const [tabCounts, setTabCounts] = useState({ users: 0, admins: 0, softbanned: 0, purged: 0 });

  // Tab Pagination states
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [adminsPage, setAdminsPage] = useState(1);
  const [adminsTotal, setAdminsTotal] = useState(0);
  const [softbannedPage, setSoftbannedPage] = useState(1);
  const [softbannedTotal, setSoftbannedTotal] = useState(0);
  const [purgedPage, setPurgedPage] = useState(1);
  const [purgedTotal, setPurgedTotal] = useState(0);

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
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const countdownIntervalRef = useRef(null);


  // Fetch tab counts
  const fetchTabCounts = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/management/tab-counts`);
      const data = await res.json();
      if (res.ok && data.success) {
        setTabCounts({
          users: data.users || 0,
          admins: data.admins || 0,
          softbanned: data.softbanned || 0,
          purged: data.purged || 0
        });
      }
    } catch (e) {
      console.error("Failed to fetch tab counts", e);
    }
  };

  const fetchUsers = async (pageNumber = usersPage) => {
    setTabLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pageNumber));
      params.set('limit', '12');
      if (debouncedSearchTerm) params.set('q', debouncedSearchTerm);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (promoSubscriptionFilter !== 'all') params.set('promoSubscription', promoSubscriptionFilter);

      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/management/users?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(data.items || []);
        setUsersTotal(data.total || 0);
        setUsersPage(data.page || pageNumber);
      } else {
        setUsers([]);
        setUsersTotal(0);
      }
    } catch (e) {
      setUsers([]);
      setUsersTotal(0);
      toast.error("Failed to fetch users");
    } finally {
      setTabLoading(false);
    }
  };

  const fetchAdmins = async (pageNumber = adminsPage) => {
    if (!isRootOrDefault) return;
    setTabLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pageNumber));
      params.set('limit', '12');
      if (debouncedSearchTerm) params.set('q', debouncedSearchTerm);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (promoSubscriptionFilter !== 'all') params.set('promoSubscription', promoSubscriptionFilter);
      if (adminApprovalFilter !== 'all') params.set('adminApproval', adminApprovalFilter);

      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/management/admins?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setAdmins(data.items || []);
        setAdminsTotal(data.total || 0);
        setAdminsPage(data.page || pageNumber);
      } else {
        setAdmins([]);
        setAdminsTotal(0);
      }
    } catch (e) {
      setAdmins([]);
      setAdminsTotal(0);
      toast.error("Failed to fetch admins");
    } finally {
      setTabLoading(false);
    }
  };

  const fetchSoftbannedAccounts = async (pageNumber = softbannedPage) => {
    setSoftbannedLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pageNumber));
      params.set('limit', '12');
      params.set('isPurged', 'false');
      if (softbannedFilters.q) params.set('q', softbannedFilters.q);
      if (softbannedFilters.role && softbannedFilters.role !== 'all') params.set('role', softbannedFilters.role);
      if (softbannedFilters.softbannedBy) params.set('softbannedBy', softbannedFilters.softbannedBy);
      if (softbannedFilters.from) params.set('from', softbannedFilters.from);
      if (softbannedFilters.to) params.set('to', softbannedFilters.to);

      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/deleted-accounts?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSoftbannedAccounts(data.items || []);
        setSoftbannedTotal(data.total || 0);
        setSoftbannedPage(data.page || pageNumber);
      } else {
        setSoftbannedAccounts([]);
        setSoftbannedTotal(0);
      }
    } catch (e) {
      setSoftbannedAccounts([]);
      setSoftbannedTotal(0);
    } finally {
      setSoftbannedLoading(false);
    }
  };

  const fetchPurgedAccounts = async (pageNumber = purgedPage) => {
    setPurgedLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pageNumber));
      params.set('limit', '12');
      params.set('isPurged', 'true');
      if (purgedFilters.q) params.set('q', purgedFilters.q);
      if (purgedFilters.role && purgedFilters.role !== 'all') params.set('role', purgedFilters.role);
      if (purgedFilters.purgedBy) params.set('purgedBy', purgedFilters.purgedBy);
      if (purgedFilters.from) params.set('from', purgedFilters.from);
      if (purgedFilters.to) params.set('to', purgedFilters.to);

      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/deleted-accounts?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setPurgedAccounts(data.items || []);
        setPurgedTotal(data.total || 0);
        setPurgedPage(data.page || pageNumber);
      } else {
        setPurgedAccounts([]);
        setPurgedTotal(0);
      }
    } catch (e) {
      setPurgedAccounts([]);
      setPurgedTotal(0);
    } finally {
      setPurgedLoading(false);
    }
  };

  const fetchData = async () => {
    setInitialLoading(true);
    try {
      await fetchTabCounts();
      
      // Fetch password lockouts
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

      // Fetch active tab
      if (tab === "users") {
        await fetchUsers(1);
      } else if (tab === "admins") {
        await fetchAdmins(1);
      } else if (tab === "softbanned") {
        await fetchSoftbannedAccounts(1);
      } else if (tab === "purged") {
        await fetchPurgedAccounts(1);
      }
    } catch (err) {
      toast.error("Failed to fetch accounts");
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser?._id) return;
    fetchData();
  }, [currentUser?._id]);

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset pages when filters change
  useEffect(() => {
    setUsersPage(1);
  }, [debouncedSearchTerm, statusFilter, promoSubscriptionFilter]);

  useEffect(() => {
    setAdminsPage(1);
  }, [debouncedSearchTerm, statusFilter, promoSubscriptionFilter, adminApprovalFilter]);

  // Fetch active tab data when pagination or filters change
  useEffect(() => {
    if (!currentUser?._id || showPasswordModal) return;
    if (tab === "users") {
      fetchUsers(usersPage);
    } else if (tab === "admins") {
      fetchAdmins(adminsPage);
    }
  }, [tab, usersPage, adminsPage, debouncedSearchTerm, statusFilter, promoSubscriptionFilter, adminApprovalFilter, currentUser?._id, showPasswordModal]);

  useEffect(() => {
    if (!currentUser?._id || showPasswordModal) return;
    if (tab === "softbanned") {
      fetchSoftbannedAccounts(softbannedPage);
    } else if (tab === "purged") {
      fetchPurgedAccounts(purgedPage);
    }
  }, [tab, softbannedPage, purgedPage, currentUser?._id, showPasswordModal]);

  // Add useEffect to listen for socket events and update users/admins state
  useEffect(() => {
    localStorage.removeItem('adminMgmtPwAttempts');
    function handleUserUpdate({ type, user }) {
      setUsers(prev => {
        if (type === 'delete') return prev.filter(u => u._id !== user._id);
        if (type === 'update') return prev.map(u => u._id === user._id ? user : u);
        if (type === 'add') return [user, ...prev];
        return prev;
      });
      fetchTabCounts();
    }
    function handleAdminUpdate({ type, admin }) {
      setAdmins(prev => {
        if (type === 'delete') return prev.filter(a => a._id !== admin._id);
        if (type === 'update') return prev.map(a => a._id === admin._id ? admin : a);
        if (type === 'add') return [admin, ...prev];
        return prev;
      });
      fetchTabCounts();
    }
    socket.on('user_update', handleUserUpdate);
    socket.on('admin_update', handleAdminUpdate);
    return () => {
      socket.off('user_update', handleUserUpdate);
      socket.off('admin_update', handleAdminUpdate);
    };
  }, []);

  // Keyboard shortcut for search (Ctrl+F) and secure refresh interceptor
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. Search shortcut (Ctrl+F)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById('admin-management-search');
        if (searchInput) {
          searchInput.focus();
        }
      }

      // 2. Intercept keyboard refresh shortcuts (F5, Ctrl+R, Cmd+R) if unlocked
      const isF5 = e.key === 'F5' || e.keyCode === 116;
      const isCtrlR = (e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R' || e.keyCode === 82);
      if ((isF5 || isCtrlR) && !showPasswordModal) {
        e.preventDefault();
        showConfirmation(
          "Confirm Reload Session?",
          "You are currently logged into the secure Admin Management panel. If you reload this page, your session will be locked immediately and you will need to re-enter your password to regain access. Are you sure you want to continue?",
          () => {
            isProgrammaticReloadRef.current = true;
            setShowConfirmModal(false);
            window.location.reload();
          },
          {
            confirmText: "Yes, Reload",
            cancelText: "No, Stay",
            confirmButtonClass: "bg-yellow-500 hover:bg-yellow-600"
          }
        );
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showPasswordModal]);

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
    setSelectedAccount({ type });
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

  // Filter accounts based on search term and status (now handled on backend)
  const filterAccounts = (accounts) => {
    return accounts;
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
          fetchTabCounts();
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
          fetchTabCounts();
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

  // Helper to format remaining seconds into MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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

  // Manage countdown timer and automatic security lockout (10 minutes)
  useEffect(() => {
    if (!showPasswordModal) {
      setTimeLeft(600); // 10 minutes in seconds
      
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      
      countdownIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setShowPasswordModal(true);
            toast.info("Session expired for security. Please re-enter your password.");
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
            return 0;
          }
          const nextVal = prev - 1;
          // Warning toast at exactly 1 minute remaining (60 seconds left / 9 minutes passed)
          if (nextVal === 60) {
            toast.info("For security reasons, you will be asked to re-enter your password in 1 minute.");
          }
          return nextVal;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setTimeLeft(600);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [showPasswordModal]);

  // Alert/Prompt user before reload/refresh if the page is open and unlocked
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // If we are doing a programmatic reload (confirmed by the user via our custom React modal),
      // we bypass the browser's native beforeunload prompt to avoid confusing double-confirmation dialogs.
      if (!showPasswordModal && !isProgrammaticReloadRef.current) {
        e.preventDefault();
        // Modern browsers strictly hardcode the alert message displayed in beforeunload prompts
        // (e.g. "Reload site? Changes you made may not be saved.") for security reasons (preventing phishing).
        // However, we still set and return the custom string as a standard/fallback requirement.
        const confirmationMessage = "Warning: You are currently logged into the secure Admin Management panel. Refreshing or navigating away will lock your session, requiring you to re-enter your password to regain access. Are you sure you want to continue?";
        e.returnValue = confirmationMessage;
        return confirmationMessage;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
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
  if (!Array.isArray(users) || (tab === 'admins' && !Array.isArray(admins) && isRootOrDefault)) {
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
        localStorage.removeItem('adminMgmtPwAttempts');
        setShowPasswordModal(false);
        setManagementPassword("");
        setManagementPasswordError("");
      } else {
        const data = await res.json();
        // Track wrong attempts locally (allow up to 3 attempts before logout)
        const key = 'adminMgmtPwAttempts';
        const prev = parseInt(localStorage.getItem(key) || '0');
        const next = prev + 1;
        localStorage.setItem(key, String(next));

        if (next >= 3) {
          localStorage.removeItem('adminMgmtPwAttempts');
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
          setManagementPasswordError(`Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} left before auto-logout.`);
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

  if (initialLoading) {
    return <AdminManagementSkeleton />;
  }

  const renderPagination = (currentPage, totalItems, onPageChange, limit = 12) => {
    const totalPages = Math.ceil(totalItems / limit);
    if (totalPages <= 1) return null;

    // Generate page numbers
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 animate-fadeIn">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Showing <span className="font-semibold text-gray-700 dark:text-gray-300">{Math.min(totalItems, (currentPage - 1) * limit + 1)}</span> to{" "}
          <span className="font-semibold text-gray-700 dark:text-gray-300">{Math.min(totalItems, currentPage * limit)}</span> of{" "}
          <span className="font-semibold text-gray-700 dark:text-gray-300">{totalItems}</span> accounts
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            Previous
          </button>
          {startPage > 1 && (
            <>
              <button
                onClick={() => onPageChange(1)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === 1 ? "bg-blue-600 text-white" : "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
              >
                1
              </button>
              {startPage > 2 && <span className="px-2 text-gray-400">...</span>}
            </>
          )}
          {pages.map((p) => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === p ? "bg-blue-600 text-white" : "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
            >
              {p}
            </button>
          ))}
          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="px-2 text-gray-400">...</span>}
              <button
                onClick={() => onPageChange(totalPages)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === totalPages ? "bg-blue-600 text-white" : "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
              >
                {totalPages}
              </button>
            </>
          )}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-950 dark:to-gray-900 py-10 px-2 md:px-8 animate-fadeIn transition-colors duration-300">
      <div className="max-w-6xl mx-auto bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 animate-slideUp border border-white/20 dark:border-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h1 className="text-4xl font-extrabold text-blue-700 dark:text-blue-400 drop-shadow animate-fade-in">Accounts Management</h1>
          <div className="flex items-center gap-3">
            {!showPasswordModal && (
              <div
                className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 shadow border backdrop-blur-md transition-all duration-300 ${
                  timeLeft <= 60
                    ? "bg-red-50/90 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 animate-pulse"
                    : "bg-gray-50/90 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-700"
                }`}
                title="Time remaining before session locks for security"
              >
                {timeLeft <= 60 ? (
                  <FaLock className="w-3.5 h-3.5 text-red-500" />
                ) : (
                  <FaClock className="w-3.5 h-3.5 text-blue-500" />
                )}
                <span>
                  Locks in: <span className="font-mono font-black">{formatTime(timeLeft)}</span>
                </span>
              </div>
            )}
            <button
              onClick={() => fetchData()}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow inline-flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              title="Refresh data"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M12 6V3L8 7l4 4V8c2.757 0 5 2.243 5 5a5 5 0 11-9.9-1H5.026A7 7 0 1019 13c0-3.86-3.141-7-7-7z" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-4 mb-8 animate-fadeIn">
          <button
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-lg shadow transition-all duration-200 ${tab === "users" ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white scale-105" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700"}`}
            onClick={() => {
              setTab("users");
              setShowRestriction(false);
              setSearchTerm("");
              setStatusFilter("all");
              setPromoSubscriptionFilter("all");
              setAdminApprovalFilter("all");
              setUsersPage(1);
            }}
          >
            Users ({tabCounts.users})
          </button>
          {isRootOrDefault && (
            <button
              className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-lg shadow transition-all duration-200 ${tab === "admins" ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white scale-105" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-gray-700"}`}
              onClick={() => {
                setShowRestriction(false);
                setTab("admins");
                setSearchTerm("");
                setStatusFilter("all");
                setPromoSubscriptionFilter("all");
                setAdminApprovalFilter("all");
                setAdminsPage(1);
              }}
            >
              Admins ({tabCounts.admins})
            </button>
          )}
          <button
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-lg shadow transition-all duration-200 ${tab === "softbanned" ? "bg-gradient-to-r from-red-500 to-red-600 text-white scale-105" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-gray-700"}`}
            onClick={() => {
              setTab("softbanned");
              setSearchTerm("");
              setStatusFilter("all");
              setPromoSubscriptionFilter("all");
              setAdminApprovalFilter("all");
              setSoftbannedPage(1);
            }}
          >
            <span className="hidden sm:inline">Softbanned Accounts ({tabCounts.softbanned})</span>
            <span className="sm:hidden">Softbanned ({tabCounts.softbanned})</span>
          </button>
          <button
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-lg shadow transition-all duration-200 ${tab === "purged" ? "bg-gradient-to-r from-red-500 to-orange-500 text-white scale-105" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-gray-700"}`}
            onClick={() => {
              setTab("purged");
              setSearchTerm("");
              setStatusFilter("all");
              setPromoSubscriptionFilter("all");
              setAdminApprovalFilter("all");
              setPurgedPage(1);
            }}
          >
            <span className="hidden sm:inline">Purged Accounts ({tabCounts.purged})</span>
            <span className="sm:hidden">Purged ({tabCounts.purged})</span>
          </button>
        </div>

        {/* Enhanced Search and Filters */}
        <div className="mb-6 animate-fadeIn bg-gray-50/50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
          {tab !== 'softbanned' && tab !== 'purged' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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

              {/* Promo Email Subscription Filter Dropdown */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaEnvelope className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors duration-200" />
                </div>
                <select
                  value={promoSubscriptionFilter}
                  onChange={(e) => setPromoSubscriptionFilter(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm appearance-none cursor-pointer"
                >
                  <option value="all">All Subscriptions</option>
                  <option value="subscribed">Promo Subscribed</option>
                  <option value="unsubscribed">Promo Unsubscribed</option>
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

            </div>
          ) : tab === 'softbanned' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <input value={softbannedFilters.q} onChange={e => setSoftbannedFilters(f => ({ ...f, q: e.target.value }))} placeholder="Search name/email" className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={softbannedFilters.role} onChange={e => setSoftbannedFilters(f => ({ ...f, role: e.target.value }))} className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All Roles</option>
                <option value="user">User</option>
                {isRootOrDefault && <option value="admin">Admin</option>}
              </select>
              <input type="date" value={softbannedFilters.from} onChange={e => setSoftbannedFilters(f => ({ ...f, from: e.target.value }))} className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="date" value={softbannedFilters.to} onChange={e => setSoftbannedFilters(f => ({ ...f, to: e.target.value }))} className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input value={softbannedFilters.softbannedBy} onChange={e => setSoftbannedFilters(f => ({ ...f, softbannedBy: e.target.value }))} placeholder="Softbanned by (id or self)" className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex items-center gap-2">
                <button onClick={() => fetchSoftbannedAccounts(1)} className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors">Apply</button>
                <button onClick={() => { setSoftbannedFilters({ q: '', role: 'all', softbannedBy: '', from: '', to: '' }); setTimeout(() => fetchSoftbannedAccounts(1), 0); }} className="px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl transition-colors">Clear</button>
              </div>
              <div className="col-span-full text-sm text-gray-500 dark:text-gray-400">
                {isRootOrDefault ? 'You are viewing all softbanned accounts (users + admins).' : 'You are viewing only softbanned user accounts.'}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <input value={purgedFilters.q} onChange={e => setPurgedFilters(f => ({ ...f, q: e.target.value }))} placeholder="Search name/email" className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={purgedFilters.role} onChange={e => setPurgedFilters(f => ({ ...f, role: e.target.value }))} className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All Roles</option>
                <option value="user">User</option>
                {isRootOrDefault && <option value="admin">Admin</option>}
              </select>
              <input type="date" value={purgedFilters.from} onChange={e => setPurgedFilters(f => ({ ...f, from: e.target.value }))} className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="date" value={purgedFilters.to} onChange={e => setPurgedFilters(f => ({ ...f, to: e.target.value }))} className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input value={purgedFilters.purgedBy} onChange={e => setPurgedFilters(f => ({ ...f, purgedBy: e.target.value }))} placeholder="Purged by (id)" className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex items-center gap-2">
                <button onClick={() => fetchPurgedAccounts(1)} className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors">Apply</button>
                <button onClick={() => { setPurgedFilters({ q: '', role: 'all', purgedBy: '', from: '', to: '' }); setTimeout(() => fetchPurgedAccounts(1), 0); }} className="px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl transition-colors">Clear</button>
              </div>
              <div className="col-span-full text-sm text-gray-500 dark:text-gray-400">
                {isRootOrDefault ? 'You are viewing all purged accounts (users + admins). These accounts are permanently removed.' : 'You are viewing only purged user accounts. These accounts are permanently removed.'}
              </div>
            </div>
          )}

          {/* Results Summary */}
          {tab !== 'softbanned' && tab !== 'purged' && (searchTerm || statusFilter !== "all" || promoSubscriptionFilter !== "all" || adminApprovalFilter !== "all") && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <span className="font-semibold">Active Filters:</span>
                {searchTerm && <span className="ml-2 px-2 py-1 bg-blue-200 dark:bg-blue-800 rounded text-xs">Search: "{searchTerm}"</span>}
                {statusFilter !== "all" && <span className="ml-2 px-2 py-1 bg-green-200 dark:bg-green-800/50 rounded text-xs">Status: {statusFilter}</span>}
                {promoSubscriptionFilter !== "all" && <span className="ml-2 px-2 py-1 bg-blue-200 dark:bg-blue-800/50 rounded text-xs">Promo: {promoSubscriptionFilter}</span>}
                {tab === "admins" && adminApprovalFilter !== "all" && <span className="ml-2 px-2 py-1 bg-purple-200 dark:bg-purple-800/50 rounded text-xs">Approval: {adminApprovalFilter}</span>}
              </div>
              <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                Found {tab === "users" ? usersTotal : adminsTotal} {tab === "users" ? "user" : "admin"}{tab === "users" ? (usersTotal !== 1 ? "s" : "") : (adminsTotal !== 1 ? "s" : "")} matching your filters
              </div>
            </div>
          )}

          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            💡 Tip: Press Ctrl+F to quickly focus the search box • Use status filter to view active or suspended accounts
          </div>
        </div>

          <>
            {(tab === "users") && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2 animate-fadeIn">
                  <FaUser className="text-blue-500" /> Users ({usersTotal})
                </h2>
                {filteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 animate-fadeIn">
                    <div className="text-6xl mb-4">🕵️</div>
                    <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                      {(searchTerm || statusFilter !== "all" || promoSubscriptionFilter !== "all") ? `No users found matching your filters` : "No users found."}
                    </p>
                    {(searchTerm || statusFilter !== "all" || promoSubscriptionFilter !== "all") && (
                      <button
                        onClick={() => {
                          setSearchTerm("");
                          setStatusFilter("all");
                          setPromoSubscriptionFilter("all");
                        }}
                        className="mt-4 text-blue-500 hover:text-blue-600 underline"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-center gap-8 animate-fadeIn">
                    {filteredUsers.map((user, index) => (
                      <div
                        key={user._id}
                        className="w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.334rem)] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-all duration-200 cursor-pointer hover:border-blue-200 dark:hover:border-blue-800"
                        onClick={() => handleAccountClick(user, 'user')}
                        title="Click to view full details"
                        style={{ animation: `staggerFadeIn 0.25s ease-out ${index * 0.03}s backwards` }}
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
                              <FaPhone className="text-gray-400 dark:text-gray-500" /> {user.mobileNumber ? highlightMatch(user.mobileNumber) : <span className="italic text-gray-400 dark:text-gray-500">No mobile</span>}
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
                                <UrbanSetuSpinner size="sm" isBright={true} />
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
                          {isRootOrDefault && (
                            <button
                              className="flex-1 px-2 py-1 rounded-lg font-semibold text-sm bg-purple-500 text-white hover:bg-purple-600 transition-all duration-200 flex items-center justify-center gap-2"
                              onClick={e => { e.stopPropagation(); handlePromote(user._id); }}
                            >
                              {actionLoading.promote[user._id] ? (
                                <>
                                  <UrbanSetuSpinner size="sm" isBright={true} />
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
                {renderPagination(usersPage, usersTotal, setUsersPage)}
              </div>
            )}
            {tab === "admins" && !isRootOrDefault && showRestriction && (
              <div className="flex flex-col items-center justify-center py-16 animate-fadeIn">
                <div className="text-6xl mb-4">🚫</div>
                <p className="text-red-500 text-lg font-medium">Only default admins or root admins can access admin account management.</p>
              </div>
            )}
            {tab === "admins" && isRootOrDefault && !showRestriction && (
              <div className="mt-10">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2 animate-fadeIn">
                  <FaUserShield className="text-purple-500" /> Admins ({adminsTotal})
                </h2>
                {filteredAdmins.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 animate-fadeIn">
                    <div className="text-6xl mb-4">🕵️</div>
                    <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                      {(searchTerm || statusFilter !== "all" || promoSubscriptionFilter !== "all" || adminApprovalFilter !== "all") ? `No admins found matching your filters` : "No admins found."}
                    </p>
                    {(searchTerm || statusFilter !== "all" || promoSubscriptionFilter !== "all" || adminApprovalFilter !== "all") && (
                      <button
                        onClick={() => {
                          setSearchTerm("");
                          setStatusFilter("all");
                          setPromoSubscriptionFilter("all");
                          setAdminApprovalFilter("all");
                        }}
                        className="mt-4 text-blue-500 hover:text-blue-600 underline"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-center gap-8 animate-fadeIn">
                    {filteredAdmins.map((admin, index) => (
                      <div
                        key={admin._id}
                        className="w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.334rem)] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-all duration-200 cursor-pointer hover:border-purple-200 dark:hover:border-purple-800"
                        onClick={() => handleAccountClick(admin, 'admin')}
                        title="Click to view full details"
                        style={{ animation: `staggerFadeIn 0.25s ease-out ${index * 0.03}s backwards` }}
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
                              <FaPhone className="text-gray-400 dark:text-gray-500" /> {admin.mobileNumber ? highlightMatch(admin.mobileNumber) : <span className="italic text-gray-400 dark:text-gray-500">No mobile</span>}
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
                                <UrbanSetuSpinner size="sm" isBright={true} />
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
                                <UrbanSetuSpinner size="sm" isBright={true} />
                                Demoting...
                              </>
                            ) : (
                              <>
                                <FaArrowDown /> Demote to User
                              </>
                            )}
                          </button>
                          {isRootOrDefault && admin.adminApprovalStatus === 'rejected' && (
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
                {renderPagination(adminsPage, adminsTotal, setAdminsPage)}
              </div>
            )}
            {tab === 'softbanned' && (
              <div className="mt-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Softbanned Accounts ({softbannedTotal})</h2>
                {softbannedLoading ? (
                  <div className="flex items-center justify-center p-8"><UrbanSetuSpinner size="md" /><span className="ml-3 text-gray-600 dark:text-gray-400">Loading...</span></div>
                ) : softbannedAccounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm animate-fadeIn">
                    <div className="text-6xl mb-4">🕵️</div>
                    <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                      {(softbannedFilters.q || softbannedFilters.role !== "all" || softbannedFilters.softbannedBy || softbannedFilters.from || softbannedFilters.to) ? "No softbanned accounts found matching your filters" : "No softbanned accounts found."}
                    </p>
                    {(softbannedFilters.q || softbannedFilters.role !== "all" || softbannedFilters.softbannedBy || softbannedFilters.from || softbannedFilters.to) && (
                      <button
                        onClick={() => {
                          setSoftbannedFilters({ q: '', role: 'all', softbannedBy: '', from: '', to: '' });
                          setTimeout(() => fetchSoftbannedAccounts(1), 0);
                        }}
                        className="mt-4 text-blue-500 hover:text-blue-600 underline"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
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
                        {softbannedAccounts.map((acc, index) => (
                          <tr key={acc._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors" style={{ animation: `staggerFadeIn 0.2s ease-out ${index * 0.02}s backwards` }}>
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
                              {isRootOrDefault ? (
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
                {renderPagination(softbannedPage, softbannedTotal, setSoftbannedPage)}
              </div>
            )}
            {tab === 'purged' && (
              <div className="mt-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Purged Accounts (Permanently Removed) ({purgedTotal})</h2>
                {purgedLoading ? (
                  <div className="flex items-center justify-center p-8"><UrbanSetuSpinner size="md" /><span className="ml-3 text-gray-600 dark:text-gray-400">Loading...</span></div>
                ) : purgedAccounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm animate-fadeIn">
                    <div className="text-6xl mb-4">🕵️</div>
                    <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                      {(purgedFilters.q || purgedFilters.role !== "all" || purgedFilters.purgedBy || purgedFilters.from || purgedFilters.to) ? "No purged accounts found matching your filters" : "No purged accounts found."}
                    </p>
                    {(purgedFilters.q || purgedFilters.role !== "all" || purgedFilters.purgedBy || purgedFilters.from || purgedFilters.to) && (
                      <button
                        onClick={() => {
                          setPurgedFilters({ q: '', role: 'all', purgedBy: '', from: '', to: '' });
                          setTimeout(() => fetchPurgedAccounts(1), 0);
                        }}
                        className="mt-4 text-blue-500 hover:text-blue-600 underline"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
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
                        {purgedAccounts.map((acc, index) => (
                          <tr key={acc._id} className="hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors" style={{ animation: `staggerFadeIn 0.2s ease-out ${index * 0.02}s backwards` }}>
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
                {renderPagination(purgedPage, purgedTotal, setPurgedPage)}
              </div>
            )}
          </>
      </div>
      {/* Account Details Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-1.5 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col md:flex-row overflow-hidden relative animate-scale-in border border-white/20 dark:border-gray-700">
            {/* Close button */}
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-2 transition-colors z-10 shadow"
              onClick={() => setShowAccountModal(false)}
              title="Close"
              aria-label="Close"
            >
              <FaTimes className="w-4 h-4" />
            </button>

            {accountLoading ? (
              /* Centered loading container covering the whole modal */
              <div className="w-full min-h-[380px] flex flex-col justify-center items-center gap-4 p-8 animate-fadeIn">
                <UrbanSetuSpinner size="lg" />
                <p className="text-gray-500 dark:text-gray-400 font-bold text-base tracking-wide animate-pulse">
                  {selectedAccount?.type === 'admin' ? 'Fetching Admin details...' : 'Fetching User details...'}
                </p>
              </div>
            ) : selectedAccount ? (
              <>
                {/* Left Panel: Profile Summary */}
                <div className="w-full md:w-80 md:flex-shrink-0 bg-gradient-to-b from-blue-50/50 via-indigo-50/10 to-transparent dark:from-gray-900/60 dark:via-gray-800/10 dark:to-transparent border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-700 flex flex-col items-center md:justify-center p-3.5 md:p-8 text-center">
                  <div className="flex flex-col items-center gap-3 md:gap-4 text-center mt-4 md:mt-0">
                    <div className="relative">
                      <img
                        src={selectedAccount?.avatar || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'}
                        alt="avatar"
                        className="w-20 h-20 md:w-28 md:h-28 rounded-full object-cover border-4 border-white dark:border-gray-700 shadow-xl"
                        onError={e => { e.target.onerror = null; e.target.src = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'; }}
                      />
                      <div className={`absolute bottom-1 right-1 w-5 h-5 md:w-6 md:h-6 rounded-full border-2 border-white dark:border-gray-800 shadow-md ${selectedAccount?.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-lg md:text-xl font-extrabold text-gray-800 dark:text-white line-clamp-1">
                        {selectedAccount?.username}
                      </h2>
                      <p className="text-[11px] md:text-xs text-gray-500 dark:text-gray-400 break-all">{selectedAccount?.email}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold shadow-sm ${selectedAccount?.type === 'admin' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'}`}>
                      {selectedAccount?.type === 'admin' ? <FaUserShield className="text-[10px] md:text-xs" /> : <FaUser className="text-[10px] md:text-xs" />}
                      {selectedAccount?.type === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </div>

                  {/* Status and Subscription summary on left panel */}
                  <div className="w-full mt-5 md:mt-8 pt-4 md:pt-6 border-t border-gray-100 dark:border-gray-700/60 space-y-3 md:space-y-4">
                    <div className="flex items-center justify-between text-xs md:text-sm">
                      <span className="text-gray-500 dark:text-gray-400 font-medium">Account Status:</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${selectedAccount?.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                        {(selectedAccount?.status || 'active').toUpperCase()}
                      </span>
                    </div>

                    {/* Subscription Toggle */}
                    <div className="flex flex-col gap-1.5 p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700/40">
                      <div className="flex items-center gap-1.5 text-[10px] md:text-xs font-semibold text-gray-700 dark:text-gray-300 justify-center">
                        <FaEnvelope className={selectedAccount?.isSubscribed !== false ? "text-green-500" : "text-gray-400"} />
                        <span>Promo Emails: {selectedAccount?.isSubscribed !== false ? 'Subscribed' : 'Unsubscribed'}</span>
                      </div>
                      <button
                        onClick={() => handleToggleSubscription(selectedAccount?._id, selectedAccount?.isSubscribed !== false)}
                        disabled={subscriptionLoading}
                        className={`text-[10px] md:text-xs w-full py-1.5 rounded-lg font-bold transition-all shadow-sm ${selectedAccount?.isSubscribed !== false ? "bg-red-500 text-white hover:bg-red-600" : "bg-green-500 text-white hover:bg-green-600"}`}
                      >
                        {subscriptionLoading ? '...' : (selectedAccount?.isSubscribed !== false ? 'Unsubscribe' : 'Subscribe')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Panel: Detailed Metrics & Stats */}
                <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 md:p-8 space-y-5 md:space-y-6">
                  {/* Section 1: Profile Details */}
                  <div>
                    <h3 className="text-xs md:text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 md:mb-3">Profile Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 bg-gray-50/50 dark:bg-gray-900/30 p-3 md:p-5 rounded-2xl border border-gray-100 dark:border-gray-700/60">
                      <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300 text-xs md:text-sm">
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg"><FaPhone className="text-blue-500" /></div>
                        <div>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">Mobile Number</p>
                          <p className="font-semibold">{selectedAccount.mobileNumber || 'Not provided'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300 text-xs md:text-sm">
                        <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg"><FaUser className="text-purple-500" /></div>
                        <div>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">Gender</p>
                          <p className="font-semibold">{selectedAccount.gender ? selectedAccount.gender.charAt(0).toUpperCase() + selectedAccount.gender.slice(1) : 'Not provided'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300 text-xs md:text-sm sm:col-span-2">
                        <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg"><FaHome className="text-green-500" /></div>
                        <div>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">Address</p>
                          <p className="font-semibold text-wrap">{selectedAccount.address || 'Not provided'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300 text-xs md:text-sm">
                        <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg"><FaCalendarAlt className="text-indigo-500" /></div>
                        <div>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">Member Since</p>
                          <p className="font-semibold">{selectedAccount.createdAt ? new Date(selectedAccount.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300 text-xs md:text-sm">
                        <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg"><FaCalendarAlt className="text-amber-500" /></div>
                        <div>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">Last Profile Update</p>
                          <p className="font-semibold text-wrap">{selectedAccount.updatedAt ? new Date(selectedAccount.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + new Date(selectedAccount.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'Never'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Statistics Activity Grid */}
                  <div>
                    <h3 className="text-xs md:text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 md:mb-3">Activity & Statistics</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 md:gap-4">
                      {/* Listings */}
                      <div className="flex items-center gap-3 bg-gray-50/50 dark:bg-gray-900/30 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md border border-gray-100 dark:border-gray-700/60 hover:border-blue-200 dark:hover:border-blue-900/40 p-2.5 md:p-3.5 rounded-2xl transition-all duration-200">
                        <div className="bg-blue-50 dark:bg-blue-950/40 p-2 md:p-2.5 rounded-xl"><FaList className="text-blue-500 text-sm md:text-lg" /></div>
                        <div>
                          <p className="text-[9px] md:text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Listings</p>
                          <p className="text-base md:text-lg font-black text-gray-800 dark:text-gray-100">{accountStats.listings}</p>
                        </div>
                      </div>
                      {/* Appointments */}
                      <div className="flex items-center gap-3 bg-gray-50/50 dark:bg-gray-900/30 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md border border-gray-100 dark:border-gray-700/60 hover:border-rose-200 dark:hover:border-rose-900/40 p-2.5 md:p-3.5 rounded-2xl transition-all duration-200">
                        <div className="bg-rose-50 dark:bg-rose-950/40 p-2 md:p-2.5 rounded-xl"><FaCalendar className="text-rose-500 text-sm md:text-lg" /></div>
                        <div>
                          <p className="text-[9px] md:text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Appts</p>
                          <p className="text-base md:text-lg font-black text-gray-800 dark:text-gray-100">{accountStats.appointments}</p>
                        </div>
                      </div>
                      {/* Wishlist */}
                      <div className="flex items-center gap-3 bg-gray-50/50 dark:bg-gray-900/30 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md border border-gray-100 dark:border-gray-700/60 hover:border-red-200 dark:hover:border-red-900/40 p-2.5 md:p-3.5 rounded-2xl transition-all duration-200">
                        <div className="bg-red-50 dark:bg-red-950/40 p-2 md:p-2.5 rounded-xl"><FaHeart className="text-red-500 text-sm md:text-lg" /></div>
                        <div>
                          <p className="text-[9px] md:text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Wishlist</p>
                          <p className="text-base md:text-lg font-black text-gray-800 dark:text-gray-100">{accountStats.wishlist}</p>
                        </div>
                      </div>
                      {/* Watchlist */}
                      <div className="flex items-center gap-3 bg-gray-50/50 dark:bg-gray-900/30 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md border border-gray-100 dark:border-gray-700/60 hover:border-orange-200 dark:hover:border-orange-900/40 p-2.5 md:p-3.5 rounded-2xl transition-all duration-200">
                        <div className="bg-orange-50 dark:bg-orange-950/40 p-2 md:p-2.5 rounded-xl"><FaEye className="text-orange-500 text-sm md:text-lg" /></div>
                        <div>
                          <p className="text-[9px] md:text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Watchlist</p>
                          <p className="text-base md:text-lg font-black text-gray-800 dark:text-gray-100">{accountStats.watchlist}</p>
                        </div>
                      </div>
                      {/* SetuCoins */}
                      <div className="flex items-center gap-3 bg-gray-50/50 dark:bg-gray-900/30 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md border border-gray-100 dark:border-gray-700/60 hover:border-yellow-200 dark:hover:border-yellow-900/40 p-2.5 md:p-3.5 rounded-2xl transition-all duration-200">
                        <div className="bg-yellow-50 dark:bg-yellow-950/40 p-2 md:p-2.5 rounded-xl"><FaCoins className="text-yellow-500 text-sm md:text-lg" /></div>
                        <div>
                          <p className="text-[9px] md:text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">SetuCoins</p>
                          <p className="text-base md:text-lg font-black text-gray-800 dark:text-gray-100">{accountStats.coinBalance}</p>
                        </div>
                      </div>
                      {/* Referrals */}
                      <div className="flex items-center gap-3 bg-gray-50/50 dark:bg-gray-900/30 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md border border-gray-100 dark:border-gray-700/60 hover:border-green-200 dark:hover:border-green-900/40 p-2.5 md:p-3.5 rounded-2xl transition-all duration-200">
                        <div className="bg-green-50 dark:bg-green-950/40 p-2 md:p-2.5 rounded-xl"><FaUser className="text-green-500 text-sm md:text-lg" /></div>
                        <div>
                          <p className="text-[9px] md:text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Referrals</p>
                          <p className="text-base md:text-lg font-black text-gray-800 dark:text-gray-100">{accountStats.referrals}</p>
                        </div>
                      </div>
                      {/* Conversations */}
                      <div className="flex items-center gap-3 bg-gray-50/50 dark:bg-gray-900/30 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md border border-gray-100 dark:border-gray-700/60 hover:border-indigo-200 dark:hover:border-indigo-900/40 p-2.5 md:p-3.5 rounded-2xl transition-all duration-200">
                        <div className="bg-indigo-50 dark:bg-indigo-950/40 p-2 md:p-2.5 rounded-xl"><FaComments className="text-indigo-500 text-sm md:text-lg" /></div>
                        <div>
                          <p className="text-[9px] md:text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Chats</p>
                          <p className="text-base md:text-lg font-black text-gray-800 dark:text-gray-100">{accountStats.conversations}</p>
                        </div>
                      </div>
                      {/* Calls */}
                      <div className="flex items-center gap-3 bg-gray-50/50 dark:bg-gray-900/30 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md border border-gray-100 dark:border-gray-700/60 hover:border-purple-200 dark:hover:border-purple-900/40 p-2.5 md:p-3.5 rounded-2xl transition-all duration-200">
                        <div className="bg-purple-50 dark:bg-purple-950/40 p-2 md:p-2.5 rounded-xl"><FaPhone className="text-purple-500 text-sm md:text-lg" /></div>
                        <div>
                          <p className="text-[9px] md:text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Calls</p>
                          <p className="text-base md:text-lg font-black text-gray-800 dark:text-gray-100">{accountStats.calls}</p>
                        </div>
                      </div>
                      {/* Saved Routes */}
                      <div className="flex items-center gap-3 bg-gray-50/50 dark:bg-gray-900/30 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md border border-gray-100 dark:border-gray-700/60 hover:border-cyan-200 dark:hover:border-cyan-900/40 p-2.5 md:p-3.5 rounded-2xl transition-all duration-200">
                        <div className="bg-cyan-50 dark:bg-cyan-950/40 p-2 md:p-2.5 rounded-xl"><FaMapMarkedAlt className="text-cyan-500 text-sm md:text-lg" /></div>
                        <div>
                          <p className="text-[9px] md:text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Routes</p>
                          <p className="text-base md:text-lg font-black text-gray-800 dark:text-gray-100">{accountStats.routes}</p>
                        </div>
                      </div>
                      {/* Investments */}
                      <div className="flex items-center gap-3 bg-gray-50/50 dark:bg-gray-900/30 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md border border-gray-100 dark:border-gray-700/60 hover:border-emerald-200 dark:hover:border-emerald-900/40 p-2.5 md:p-3.5 rounded-2xl transition-all duration-200">
                        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 md:p-2.5 rounded-xl"><FaChartLine className="text-emerald-500 text-sm md:text-lg" /></div>
                        <div>
                          <p className="text-[9px] md:text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Investments</p>
                          <p className="text-base md:text-lg font-black text-gray-800 dark:text-gray-100">{accountStats.calculations}</p>
                        </div>
                      </div>
                      {/* Payments */}
                      <div className="flex items-center gap-3 bg-gray-50/50 dark:bg-gray-900/30 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md border border-gray-100 dark:border-gray-700/60 hover:border-amber-200 dark:hover:border-amber-900/40 p-2.5 md:p-3.5 rounded-2xl transition-all duration-200">
                        <div className="bg-amber-50 dark:bg-amber-950/40 p-2 md:p-2.5 rounded-xl"><FaCreditCard className="text-amber-500 text-sm md:text-lg" /></div>
                        <div>
                          <p className="text-[9px] md:text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Payments</p>
                          <p className="text-base md:text-lg font-black text-gray-800 dark:text-gray-100">{accountStats.payments}</p>
                        </div>
                      </div>
                      {/* Reviews Written */}
                      <div className="flex items-center gap-3 bg-gray-50/50 dark:bg-gray-900/30 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md border border-gray-100 dark:border-gray-700/60 hover:border-teal-200 dark:hover:border-teal-900/40 p-2.5 md:p-3.5 rounded-2xl transition-all duration-200 col-span-1">
                        <div className="bg-teal-50 dark:bg-teal-950/40 p-2 md:p-2.5 rounded-xl"><FaComments className="text-teal-500 text-sm md:text-lg" /></div>
                        <div>
                          <p className="text-[9px] md:text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Reviews Out</p>
                          <p className="text-base md:text-lg font-black text-gray-800 dark:text-gray-100">{accountStats.reviews}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Administrative / Access Details (if applicable) */}
                  {(selectedAccount.isSubscribed === false && selectedAccount.unsubscribeReason) || selectedAccount.status === 'suspended' || selectedAccount.type === 'admin' || (passwordLockouts && passwordLockouts.some(l => (l.email || '').toLowerCase() === (selectedAccount.email || '').toLowerCase() && new Date(l.unlockAt) > new Date())) ? (
                    <div>
                      <h3 className="text-xs md:text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 md:mb-3">Security & Administrative Actions</h3>
                      <div className="space-y-3 bg-red-50/30 dark:bg-gray-900/40 p-4 md:p-5 rounded-2xl border border-red-100/40 dark:border-gray-700/60 text-xs md:text-sm">
                        {/* Unsubscribe Details */}
                        {selectedAccount.isSubscribed === false && selectedAccount.unsubscribeReason && (
                          <div className="flex flex-col gap-1 border-b border-gray-100 dark:border-gray-700/60 pb-3 last:border-b-0 last:pb-0">
                            <span className="font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                              <FaExclamationCircle className="text-[10px] md:text-xs" /> Unsubscribed Reason:
                            </span>
                            <p className="italic text-gray-600 dark:text-gray-400">"{selectedAccount.unsubscribeReason}"</p>
                          </div>
                        )}
                        {/* Lockout remaining time */}
                        {(() => {
                          if (!passwordLockouts || !Array.isArray(passwordLockouts)) return null;
                          const entry = passwordLockouts.find(l => (l.email || '').toLowerCase() === (selectedAccount.email || '').toLowerCase() && new Date(l.unlockAt) > new Date());
                          if (!entry) return null;
                          const remainingMs = new Date(entry.unlockAt).getTime() - Date.now();
                          const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000));
                          return (
                            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-semibold border-b border-gray-100 dark:border-gray-700/60 pb-3 last:border-b-0 last:pb-0">
                              <FaLock className="text-[10px] md:text-xs" />
                              <span>Temporary Password Lockout: about {remainingMin} minute{remainingMin > 1 ? 's' : ''} left</span>
                            </div>
                          );
                        })()}
                        {/* Suspension details */}
                        {selectedAccount.status === 'suspended' && (
                          <div className="space-y-1.5 border-b border-gray-100 dark:border-gray-700/60 pb-3 last:border-b-0 last:pb-0 text-red-600 dark:text-red-400">
                            <div className="flex items-center gap-2 font-semibold">
                              <FaBan className="text-[10px] md:text-xs" />
                              <span>Suspended Account details</span>
                            </div>
                            <div className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 space-y-1 pl-5">
                              <p><strong>Date:</strong> {selectedAccount.suspendedAt ? new Date(selectedAccount.suspendedAt).toLocaleString('en-GB') : 'N/A'}</p>
                              {selectedAccount.suspendedBy && (
                                <p><strong>Action by:</strong> {selectedAccount.suspendedBy?.username || selectedAccount.suspendedBy?.email || selectedAccount.suspendedBy}</p>
                              )}
                            </div>
                          </div>
                        )}
                        {/* Admin Specifics */}
                        {selectedAccount.type === 'admin' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] md:text-xs text-gray-600 dark:text-gray-400 pt-1">
                            <div><strong>Admin Status:</strong> <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedAccount.adminApprovalStatus}</span></div>
                            <div><strong>Approved By:</strong> <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedAccount.approvedBy ? selectedAccount.approvedBy.username || selectedAccount.approvedBy.email || selectedAccount.approvedBy : 'N/A'}</span></div>
                            <div><strong>Approval Date:</strong> <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedAccount.adminApprovalDate ? new Date(selectedAccount.adminApprovalDate).toLocaleDateString('en-GB') : 'N/A'}</span></div>
                            <div><strong>Request Date:</strong> <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedAccount.adminRequestDate ? new Date(selectedAccount.adminRequestDate).toLocaleDateString('en-GB') : 'N/A'}</span></div>
                            <div className="sm:col-span-2"><strong>Is Default Admin:</strong> <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedAccount.isDefaultAdmin ? 'Yes' : 'No'}</span></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="w-full min-h-[380px] flex flex-col justify-center items-center gap-4 p-8 animate-fadeIn text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-950/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400">
                  <FaExclamationCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Failed to Load Details</h3>
                 <div className="text-red-600 dark:text-red-400 font-mono text-xs font-semibold tracking-wide transition-colors">
                  Error Code: {getErrorCode("Failed to load details")}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                  We encountered an error trying to fetch the account details. Please try again.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

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
                        <UrbanSetuSpinner size="sm" isBright={true} />
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
                      <UrbanSetuSpinner size="sm" isBright={true} />
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
                      <UrbanSetuSpinner size="sm" isBright={true} />
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
                      <UrbanSetuSpinner size="sm" isBright={true} />
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
                      <UrbanSetuSpinner size="sm" isBright={true} />
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
        @keyframes staggerFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
        .animate-slideUp { animation: slideUp 0.4s cubic-bezier(0.4,0,0.2,1); }
      `}</style>
    </div >
  );
} 
