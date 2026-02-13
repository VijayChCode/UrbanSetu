import React, { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import { FaKey, FaTrash, FaSignOutAlt, FaUser, FaTools, FaCloudUploadAlt, FaClipboardList, FaMobileAlt, FaCrown, FaTimes, FaCheck, FaBell, FaEnvelope, FaLock, FaGlobe, FaPalette, FaDownload, FaHistory, FaCode, FaShieldAlt, FaEye, FaEyeSlash, FaMoon, FaSun, FaLanguage, FaClock, FaFileDownload, FaDatabase, FaExclamationTriangle, FaPhone, FaVideo, FaInfoCircle, FaUsers, FaSpinner, FaBullhorn, FaDesktop, FaLocationArrow, FaChartLine, FaComments, FaMapMarkedAlt, FaRocket } from "react-icons/fa";
import { authenticatedFetch } from '../utils/auth';
import {
  deleteUserStart,
  deleteUserSuccess,
  deleteUserFailure,
  signoutUserStart,
  signoutUserSuccess,
  signoutUserFailure,
  updateUserStart,
  updateUserSuccess,
  updateUserFailure,
} from "../redux/user/userSlice";

import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import { useSignout } from '../hooks/useSignout';
import { isMobileDevice } from '../utils/mobileUtils';
import { AnimatePresence, motion } from "framer-motion";
import { LogOut } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Animation CSS classes
const animationClasses = {
  fadeInUp: "opacity-100 translate-y-0",
  slideInUp: "opacity-100 translate-y-0",
  scaleIn: "opacity-100 scale-100",
};

const EXPORT_MODULES = [
  { key: 'wishlist', label: 'Wishlist items', icon: FaDownload, color: 'text-teal-500' },
  { key: 'watchlist', label: 'Watchlist properties', icon: FaEye, color: 'text-teal-500' },
  { key: 'appointments', label: 'Appointments & bookings', icon: FaVideo, color: 'text-pink-500' },
  { key: 'listings', label: 'Property Listings', icon: FaTools, color: 'text-green-500' },
  { key: 'reviews', label: 'Reviews & Ratings', icon: FaUsers, color: 'text-orange-500' },
  { key: 'payments', label: 'Payment History', icon: FaDatabase, color: 'text-gray-500' },
  { key: 'gamification', label: 'SetuCoins & Gamification', icon: FaCrown, color: 'text-yellow-500' },
  { key: 'rentalContracts', label: 'Rental Contracts', icon: FaClipboardList, color: 'text-indigo-500' },
  { key: 'rentalLoans', label: 'Rental Loans', icon: FaShieldAlt, color: 'text-red-500' },
  { key: 'rentalRatings', label: 'Rental Ratings', icon: FaUsers, color: 'text-orange-500' },
  { key: 'gemini', label: 'Gemini Chat History', icon: FaHistory, color: 'text-purple-500' },
  { key: 'calls', label: 'Call History Logs', icon: FaPhone, color: 'text-pink-500' },
  { key: 'community', label: 'Community Forum Posts', icon: FaComments, color: 'text-cyan-500' },
  { key: 'blogComments', label: 'Blog Comments', icon: FaComments, color: 'text-cyan-500' },
  { key: 'routes', label: 'Saved Routes', icon: FaMapMarkedAlt, color: 'text-blue-600' },
  { key: 'investments', label: 'Investment Calculations', icon: FaChartLine, color: 'text-emerald-500' },
  { key: 'referrals', label: 'Referrals', icon: FaUsers, color: 'text-yellow-600' },
  { key: 'clientErrors', label: 'Client Errors', icon: FaExclamationTriangle, color: 'text-red-600', adminOnly: true },
];


const SettingSection = ({ title, icon: Icon, children, onInfoClick }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 transition-colors duration-200">
    <div className="flex items-center mb-4">
      <div className="flex items-center flex-1">
        {Icon && <Icon className="w-5 h-5 mr-3 text-blue-600 dark:text-blue-400" />}
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h2>
        {onInfoClick && (
          <button
            type="button"
            onClick={onInfoClick}
            className="ml-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors focus:outline-none"
            title="More information"
          >
            <FaInfoCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
    {children}
  </div>
);

const ToggleSwitch = ({ label, checked, onChange, description }) => {
  const handleChange = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(e.target.checked);
  };
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <div className="flex-1">
        <p className="font-medium text-gray-800 dark:text-gray-200">{label}</p>
        {description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    </div>
  );
};

const SelectOption = ({ label, value, options, onChange, description, onInfoClick, isLoading, extraContent }) => {
  const handleChange = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(e.target.value);
  };
  return (
    <div className="py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-800 dark:text-gray-200">{label}</p>
          {onInfoClick && (
            <button
              type="button"
              onClick={onInfoClick}
              className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              title="More information"
            >
              <FaInfoCircle />
            </button>
          )}
          {isLoading && (
            <FaSpinner className="animate-spin text-blue-500 dark:text-blue-400" />
          )}
        </div>
        {description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>}
        {extraContent && <div className="mt-2">{extraContent}</div>}
      </div>
      <select
        value={value}
        onChange={handleChange}
        className="w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
};

export default function Settings() {
  const { t, i18n } = useTranslation();
  usePageTitle(`${t('settings.title')} - ${t('settings.subtitle')}`);

  const { currentUser } = useSelector((state) => state.user);
  const { signout } = useSignout();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Notification Preferences
  const [emailNotifications, setEmailNotifications] = useState(currentUser?.settings?.emailNotifications ?? true);
  const [inAppNotifications, setInAppNotifications] = useState(currentUser?.settings?.inAppNotifications ?? true);
  const [pushNotifications, setPushNotifications] = useState(() => {
    const saved = localStorage.getItem('pushNotifications');
    return saved !== null ? saved === 'true' : (currentUser?.settings?.pushNotifications ?? false);
  });
  const [notificationSound, setNotificationSound] = useState(currentUser?.settings?.notificationSound ?? 'default');

  // Privacy Settings
  const [profileVisibility, setProfileVisibility] = useState(currentUser?.profileVisibility || 'friends');
  const [showEmail, setShowEmail] = useState(currentUser?.settings?.showEmail ?? false);
  const [showPhone, setShowPhone] = useState(currentUser?.settings?.showPhone ?? false);
  const [dataSharing, setDataSharing] = useState(currentUser?.settings?.dataSharing ?? true);
  const [allowLocationAccess, setAllowLocationAccess] = useState(() => {
    const saved = localStorage.getItem('allowLocationAccess');
    return saved !== null ? saved === 'true' : (currentUser?.settings?.allowLocationAccess ?? false);
  });
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [isRequestingPush, setIsRequestingPush] = useState(false);

  // Language & Region
  const [language, setLanguage] = useState(currentUser?.settings?.language ?? i18n.language ?? 'en');
  const [timezone, setTimezone] = useState(currentUser?.settings?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [dateFormat, setDateFormat] = useState(currentUser?.settings?.dateFormat ?? 'MM/DD/YYYY');

  // Appearance
  const [theme, setTheme] = useState(currentUser?.settings?.theme ?? 'light');
  const [fontSize, setFontSize] = useState(currentUser?.settings?.fontSize ?? 'medium');

  // Utility to update user settings in DB
  const updateUserSetting = async (settingsToUpdate) => {
    try {
      dispatch(updateUserStart());
      const res = await authenticatedFetch(`${API_BASE_URL}/api/user/update/${currentUser._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsToUpdate }),
      });
      const data = await res.json();
      if (data.status === "error" || data.success === false) {
        dispatch(updateUserFailure(data.message || 'Update failed'));
        return false;
      }
      dispatch(updateUserSuccess(data.updatedUser));
      return true;
    } catch (error) {
      dispatch(updateUserFailure(error.message));
      return false;
    }
  };

  // Data Export
  const [exportingData, setExportingData] = useState(false);
  const [showExportPasswordModal, setShowExportPasswordModal] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [exportPasswordError, setExportPasswordError] = useState("");
  const [exportPasswordVerifying, setExportPasswordVerifying] = useState(false);
  const [exportPasswordAttempts, setExportPasswordAttempts] = useState(0);
  const [showExportSignoutModal, setShowExportSignoutModal] = useState(false);
  const [showExportInfoModal, setShowExportInfoModal] = useState(false);
  const [showExportSelectionModal, setShowExportSelectionModal] = useState(false);
  const [selectedExportModules, setSelectedExportModules] = useState([]);

  // Account deletion states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteOtp, setDeleteOtp] = useState("");
  const [deleteOtpSent, setDeleteOtpSent] = useState(false);
  const [deleteOtpError, setDeleteOtpError] = useState("");
  const [deleteOtpAttempts, setDeleteOtpAttempts] = useState(0);
  const [deleteResendTimer, setDeleteResendTimer] = useState(0);
  const [deleteCanResend, setDeleteCanResend] = useState(true);
  const [deleteReasonOpen, setDeleteReasonOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteOtherReason, setDeleteOtherReason] = useState("");
  const [deleteVerifying, setDeleteVerifying] = useState(false);
  const [deleteProcessing, setDeleteProcessing] = useState(false);
  const [deleteDeleting, setDeleteDeleting] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const deletePasswordRef = useRef(null);
  const transferDeletePasswordRef = useRef(null);
  const exportPasswordRef = useRef(null);
  const [deleteResending, setDeleteResending] = useState(false);
  const [deletePasswordVerified, setDeletePasswordVerified] = useState(false);
  const [deletePasswordAttempts, setDeletePasswordAttempts] = useState(0);
  const deleteOtpRef = useRef(null);

  // Transfer and delete states (for default admin)
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState("");
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [showTransferPasswordModal, setShowTransferPasswordModal] = useState(false);
  const [transferDeletePassword, setTransferDeletePassword] = useState("");
  const [transferDeleteError, setTransferDeleteError] = useState("");
  const [transferDeletePasswordVerified, setTransferDeletePasswordVerified] = useState(false);
  const [transferDeleteResending, setTransferDeleteResending] = useState(false);
  const [transferDeleteDeleting, setTransferDeleteDeleting] = useState(false);
  const [transferDeletePasswordAttempts, setTransferDeletePasswordAttempts] = useState(0);
  const [transferOtp, setTransferOtp] = useState("");
  const [transferOtpSent, setTransferOtpSent] = useState(false);

  // Visibility Info Modal State
  const [showVisibilityInfoModal, setShowVisibilityInfoModal] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [transferOtpError, setTransferOtpError] = useState("");
  const [transferResendTimer, setTransferResendTimer] = useState(0);
  const [transferCanResend, setTransferCanResend] = useState(true);
  const transferDeleteOtpRef = useRef(null);

  // Transfer rights states (for default admin)
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAdmins, setTransferAdmins] = useState([]);
  const [selectedTransferAdmin, setSelectedTransferAdmin] = useState("");
  const [transferPassword, setTransferPassword] = useState("");
  const [transferError, setTransferError] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferOtpVisible, setTransferOtpVisible] = useState(false);
  const [transferResending, setTransferResending] = useState(false);
  const [transferTransferring, setTransferTransferring] = useState(false);
  const [transferPasswordVerified, setTransferPasswordVerified] = useState(false);
  const [transferOtpAttempts, setTransferOtpAttempts] = useState(0);
  const [transferPasswordAttempts, setTransferPasswordAttempts] = useState(0);
  const transferRightsOtpRef = useRef(null);
  const scrollPositionRef = useRef(0);

  // Timezone Preview State
  const [currentTimePreview, setCurrentTimePreview] = useState('');

  useEffect(() => {
    const updateTime = () => {
      try {
        if (!timezone) return;
        const time = new Date().toLocaleTimeString('en-US', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          // timeZoneName: 'short'
        });
        setCurrentTimePreview(time);
      } catch (error) {
        setCurrentTimePreview('');
      }
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [timezone]);

  // Lock body scroll when modals are open
  useEffect(() => {
    const shouldLock = showPasswordModal || showTransferPasswordModal || showTransferModal || showAdminModal || showSignOutModal;
    if (shouldLock) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showPasswordModal, showTransferPasswordModal, showTransferModal, showAdminModal]);

  // Handle mobile state updates
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Autofocus deletion password when modal opens (Desktop only)
  useEffect(() => {
    if (showPasswordModal && !isMobile && deletePasswordRef.current) {
      setTimeout(() => deletePasswordRef.current?.focus(), 100);
    }
  }, [showPasswordModal, isMobile]);

  // Autofocus transfer deletion password when modal opens (Desktop only)
  useEffect(() => {
    if (showTransferPasswordModal && !isMobile && transferDeletePasswordRef.current) {
      setTimeout(() => transferDeletePasswordRef.current?.focus(), 100);
    }
  }, [showTransferPasswordModal, isMobile]);

  // Autofocus export password when modal opens (Desktop only)
  useEffect(() => {
    if (showExportPasswordModal && !isMobile && exportPasswordRef.current) {
      setTimeout(() => exportPasswordRef.current?.focus(), 100);
    }
  }, [showExportPasswordModal, isMobile]);

  // OTP resend timers
  useEffect(() => {
    let t1; if (deleteResendTimer > 0) t1 = setTimeout(() => setDeleteResendTimer(x => x - 1), 1000);
    return () => { if (t1) clearTimeout(t1); };
  }, [deleteResendTimer]);
  useEffect(() => {
    let t2; if (transferResendTimer > 0) t2 = setTimeout(() => setTransferResendTimer(x => x - 1), 1000);
    return () => { if (t2) clearTimeout(t2); };
  }, [transferResendTimer]);
  useEffect(() => {
    if (deleteResendTimer <= 0) setDeleteCanResend(true);
  }, [deleteResendTimer]);
  useEffect(() => {
    if (transferResendTimer <= 0) setTransferCanResend(true);
  }, [transferResendTimer]);

  // Auto-focus OTP input fields
  useEffect(() => {
    if (deleteOtpSent && deleteOtpRef.current && !isMobile) {
      deleteOtpRef.current.focus();
    }
  }, [deleteOtpSent, isMobile]);
  useEffect(() => {
    if (transferOtpSent && transferDeleteOtpRef.current && !isMobile) {
      transferDeleteOtpRef.current.focus();
    }
  }, [transferOtpSent, isMobile]);
  useEffect(() => {
    if (transferOtpSent && transferRightsOtpRef.current && !isMobile) {
      transferRightsOtpRef.current.focus();
    }
  }, [transferOtpSent, isMobile]);

  // Load admins when modal opens
  useEffect(() => {
    if (showAdminModal) {
      fetchAdmins();
    }
  }, [showAdminModal]);

  // Fetch admins for transfer
  const fetchAdmins = async () => {
    try {
      setLoadingAdmins(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/user/approved-admins/${currentUser._id}`);
      const data = await res.json();

      if (res.ok) {
        setAdmins(data);
      } else {
        toast.error(data.message || t('messages.admin_fetch_error'));
      }
    } catch (error) {
      toast.error(t('messages.admin_fetch_error'));
    } finally {
      setLoadingAdmins(false);
    }
  };

  const fetchTransferAdmins = async () => {
    try {
      setLoadingAdmins(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/management/admins`);
      const data = await res.json();
      if (res.ok) {
        // Only allow eligible targets: approved, active admins (not rootadmin/default)
        setTransferAdmins(
          data.filter(a =>
            a.role === 'admin' &&
            a.adminApprovalStatus === 'approved' &&
            a.status !== 'suspended' &&
            !a.isDefaultAdmin
          )
        );
      } else {
        setTransferAdmins([]);
      }
    } catch (e) {
      setTransferAdmins([]);
    } finally {
      setLoadingAdmins(false);
    }
  };

  const onHandleDelete = async () => {
    setDeletePasswordAttempts(0);
    if (currentUser.isDefaultAdmin) {
      setSelectedAdmin("");
      setShowAdminModal(true);
      return;
    }
    setShowPasswordModal(true);
  };

  const handleConfirmDelete = async () => {
    setDeleteError("");
    if (!deletePassword) { setDeleteError('Password is required'); return; }
    setDeleteVerifying(true);
    const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/verify-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: deletePassword })
    });
    if (!res.ok) {
      if (res.status === 400 || res.status >= 500) {
        let msg = 'Invalid password';
        try { const d = await res.json(); if (d.message) msg = d.message; } catch (e) { }
        setDeleteError(msg);
        setDeleteVerifying(false);
        return;
      }

      const attempts = deletePasswordAttempts + 1;
      setDeletePasswordAttempts(attempts);
      if (attempts >= 3) {
        setShowPasswordModal(false);
        toast.error(t('messages.auto_signout'));
        dispatch(signoutUserStart());
        const signoutRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/signout`);
        const signoutData = await signoutRes.json();
        if (signoutData.success === false) dispatch(signoutUserFailure(signoutData.message)); else dispatch(signoutUserSuccess(signoutData));
        navigate('/sign-in', { replace: true });
      } else {
        const remaining = 3 - attempts;
        setDeleteError(`Invalid password. ${remaining} attempt(s) remaining.`);
        setDeletePassword("");
      }
      setDeleteVerifying(false);
      return;
    }
    setDeletePasswordAttempts(0);
    setDeletePasswordVerified(true);
    setDeleteReasonOpen(true);
    setDeleteVerifying(false);
  };

  const handleContinueAfterReason = async () => {
    setDeleteOtpError("");
    setDeleteOtp("");
    setDeleteOtpSent(false);
    try {
      setDeleteProcessing(true);
      const sendRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/send-account-deletion-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email })
      });
      const sendData = await sendRes.json();
      if (!sendRes.ok || sendData.success === false) {
        setDeleteError(sendData.message || 'Failed to send OTP');
        return;
      }
      setDeleteOtpSent(true);
      setDeleteCanResend(false);
      setDeleteResendTimer(30);
    } finally {
      setDeleteProcessing(false);
    }
  };

  const resendDeleteOtp = async () => {
    try {
      setDeleteResending(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/send-account-deletion-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email })
      });
      const data = await res.json();
      return res.ok && data.success !== false;
    } catch (_) { return false; }
    finally {
      setDeleteResending(false);
    }
  };

  const handleFinalDeleteWithOtp = async () => {
    setDeleteOtpError("");
    if (!deleteOtp || deleteOtp.length !== 6) { setDeleteOtpError('Enter 6-digit OTP'); return; }
    try {
      setDeleteDeleting(true);
      const vRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, otp: deleteOtp })
      });
      const vData = await vRes.json();
      if (!vRes.ok || vData.success === false || vData.type !== 'account_deletion') {
        const att = deleteOtpAttempts + 1; setDeleteOtpAttempts(att);
        setDeleteOtpError(vData.message || 'Invalid OTP');
        if (att >= 5) {
          setShowPasswordModal(false);
          toast.error("For security reasons, you've been signed out automatically.");
          dispatch(signoutUserStart());
          const signoutRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/signout`);
          const signoutData = await signoutRes.json();
          if (signoutData.success === false) dispatch(signoutUserFailure(signoutData.message)); else dispatch(signoutUserSuccess(signoutData));
          navigate('/sign-in', { replace: true });
          return;
        }
        setDeleteDeleting(false);
        return;
      }
      const apiUrl = `${API_BASE_URL}/api/user/delete/${currentUser._id}`;
      const payload = { password: deletePassword, reason: deleteReason === 'other' ? 'other' : deleteReason, otherReason: deleteReason === 'other' ? deleteOtherReason : undefined };
      const options = { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' };
      const res = await authenticatedFetch(apiUrl, options);
      const data = await res.json();
      if (!res.ok) { setDeleteError(data.message || 'Account deletion failed'); setDeleteDeleting(false); return; }
      dispatch(deleteUserSuccess(data));
      setShowPasswordModal(false);
      toast.success(t('messages.account_deleted'));
      navigate('/');
    } catch (_) {
      setDeleteOtpError('Verification failed');
    } finally {
      setDeleteDeleting(false);
    }
  };

  const handleTransferAndDelete = async () => {
    if (!selectedAdmin) {
      toast.error(t('messages.select_admin_transfer'));
      return;
    }
    setShowTransferPasswordModal(true);
    setTransferDeletePassword("");
    setTransferDeleteError("");
    setTransferOtpSent(false);
    setTransferOtp("");
    setTransferOtpError("");
    setTransferDeletePasswordVerified(false);
    setTransferLoading(false);
    setTransferDeleteResending(false);
    setTransferDeleteDeleting(false);
    setTransferCanResend(true);
    setTransferResendTimer(0);
    setTransferDeletePasswordAttempts(0);
  };

  const handleConfirmTransferAndDelete = async () => {
    setTransferDeleteError("");
    if (!transferDeletePassword) {
      setTransferDeleteError("Password is required");
      return;
    }
    try {
      setTransferLoading(true);
      const verifyRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: transferDeletePassword })
      });
      if (!verifyRes.ok) {
        if (verifyRes.status === 400 || verifyRes.status >= 500) {
          let msg = 'Invalid password';
          try { const d = await verifyRes.json(); if (d.message) msg = d.message; } catch (e) { }
          setTransferDeleteError(msg);
          setTransferLoading(false);
          return;
        }
        const attempts = transferDeletePasswordAttempts + 1;
        setTransferDeletePasswordAttempts(attempts);
        if (attempts >= 3) {
          setShowTransferPasswordModal(false);
          toast.error("For security reasons, you've been signed out automatically.");
          await authenticatedFetch(`${API_BASE_URL}/api/auth/signout`);
          navigate('/sign-in', { replace: true });
        } else {
          const remaining = 3 - attempts;
          setTransferDeleteError(`Invalid password. ${remaining} attempt(s) remaining.`);
          setTransferDeletePassword("");
        }
        return;
      }
      setTransferDeletePasswordAttempts(0);
      const sendRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/send-transfer-rights-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email })
      });
      const sendData = await sendRes.json();
      if (!sendRes.ok || sendData.success === false) {
        setTransferDeleteError(sendData.message || 'Failed to send OTP');
        return;
      }
      setTransferDeletePasswordVerified(true);
      setTransferOtp("");
      setTransferOtpSent(true);
      setTransferCanResend(false);
      setTransferResendTimer(30);
    } catch (error) {
      setTransferDeleteError('Failed to verify password');
    } finally {
      setTransferLoading(false);
    }
  };

  const resendTransferOtp = async () => {
    try {
      setTransferResending(true);
      setTransferDeleteResending(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/send-transfer-rights-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email })
      });
      const data = await res.json();
      return res.ok && data.success !== false;
    } catch (_) { return false; }
    finally {
      setTransferResending(false);
      setTransferDeleteResending(false);
    }
  };

  const handleFinalTransferDeleteWithOtp = async () => {
    setTransferOtpError("");
    if (!transferOtp || transferOtp.length !== 6) { setTransferOtpError('Enter 6-digit OTP'); return; }
    try {
      setTransferDeleteDeleting(true);
      const vRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, otp: transferOtp })
      });
      const vData = await vRes.json();
      // Backend marks this OTP as 'transfer_rights'
      if (!vRes.ok || vData.success === false || vData.type !== 'transfer_rights') {
        const att = transferOtpAttempts + 1; setTransferOtpAttempts(att);
        setTransferOtpError(vData.message || 'Invalid OTP');
        if (att >= 5) {
          setShowTransferPasswordModal(false);
          toast.error("For security reasons, you've been signed out automatically.");
          await authenticatedFetch(`${API_BASE_URL}/api/auth/signout`);
          navigate('/sign-in', { replace: true });
        }
        setTransferDeleteDeleting(false);
        return;
      }
      const transferRes = await authenticatedFetch(`${API_BASE_URL}/api/user/transfer-default-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentAdminId: currentUser._id, newDefaultAdminId: selectedAdmin })
      });
      const transferData = await transferRes.json();
      if (!transferRes.ok) { setTransferOtpError(transferData.message || 'Failed to transfer default admin rights'); return; }
      const deleteRes = await authenticatedFetch(`${API_BASE_URL}/api/user/delete/${currentUser._id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: transferDeletePassword })
      });
      const deleteData = await deleteRes.json();
      if (!deleteRes.ok) { setTransferOtpError(deleteData.message || 'Failed to delete account after transfer'); return; }
      dispatch(deleteUserSuccess(deleteData));
      setShowAdminModal(false);
      setShowTransferPasswordModal(false);
      toast.success(t('messages.admin_transfer_delete_success'));
      navigate('/');
    } catch (_) {
      setTransferOtpError('Verification failed');
    } finally {
      setTransferDeleteDeleting(false);
    }
  };

  const handleSettingsSignout = async (e) => {
    e.preventDefault();
    if (currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
      setShowSignOutModal(true);
    } else {
      await signout({
        showToast: true,
        navigateTo: "/",
        delay: 0
      });
    }
  };

  const confirmSignout = async () => {
    setShowSignOutModal(false);
    await signout({
      showToast: true,
      navigateTo: "/",
      delay: 0
    });
  };

  const onShowTransferModal = () => {
    setShowTransferModal(true);
    setTransferError("");
    setTransferPassword("");
    setSelectedTransferAdmin("");
    setTransferOtpSent(false);
    setTransferOtp("");
    setTransferOtpError("");
    setTransferPasswordVerified(false);
    setTransferSubmitting(false);
    setTransferResending(false);
    setTransferTransferring(false);
    setTransferCanResend(true);
    setTransferResendTimer(0);
    setTransferPasswordAttempts(0);
    fetchTransferAdmins();
  };

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
      const verifyRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: transferPassword })
      });
      if (!verifyRes.ok) {
        if (verifyRes.status === 400 || verifyRes.status >= 500) {
          let msg = 'Invalid password';
          try { const d = await verifyRes.json(); if (d.message) msg = d.message; } catch (e) { }
          setTransferError(msg);
          setTransferSubmitting(false);
          return;
        }
        const attempts = transferPasswordAttempts + 1;
        setTransferPasswordAttempts(attempts);
        if (attempts >= 3) {
          setShowTransferModal(false);
          toast.error("For security reasons, you've been signed out automatically.");
          await authenticatedFetch(`${API_BASE_URL}/api/auth/signout`);
          navigate('/sign-in', { replace: true });
        } else {
          const remaining = 3 - attempts;
          setTransferError(`Invalid password. ${remaining} attempt(s) remaining.`);
          setTransferPassword("");
        }
        return;
      }
      setTransferPasswordAttempts(0);
      const sendRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/send-transfer-rights-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email })
      });
      const sendData = await sendRes.json();
      if (!sendRes.ok || sendData.success === false) {
        setTransferError(sendData.message || 'Failed to send OTP');
        return;
      }
      setTransferPasswordVerified(true);
      setTransferOtp("");
      setTransferOtpSent(true);
      setTransferOtpVisible(true);
      setTransferCanResend(false);
      setTransferResendTimer(30);
    } catch (e) {
      setTransferError('Failed to verify password');
    } finally {
      setTransferSubmitting(false);
    }
  };

  const handleFinalTransferWithOtp = async () => {
    setTransferError("");
    if (!transferOtp || transferOtp.length !== 6) {
      setTransferError('Enter 6-digit OTP');
      return;
    }
    if (!selectedTransferAdmin) {
      setTransferError('No admin selected for transfer.');
      return;
    }

    try {
      setTransferTransferring(true);
      const vRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, otp: transferOtp })
      });
      const vData = await vRes.json();
      // Backend marks this OTP as 'transfer_rights'
      if (!vRes.ok || vData.success === false || vData.type !== 'transfer_rights') {
        const att = transferOtpAttempts + 1; setTransferOtpAttempts(att);
        setTransferError(vData.message || 'Invalid OTP');
        if (att >= 5) {
          setShowTransferModal(false);
          toast.error("For security reasons, you've been signed out automatically.");
          await authenticatedFetch(`${API_BASE_URL}/api/auth/signout`);
          navigate('/sign-in', { replace: true });
        }
        setTransferTransferring(false);
        return;
      }
      const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/transfer-rights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAdminId: selectedTransferAdmin, password: transferPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        setTransferError(data.message || 'Failed to transfer rights.');
        return;
      }
      toast.success(data.message || t('messages.admin_transfer_success'));
      // Clear modal state and sign out to refresh role flags
      setShowTransferModal(false);
      setSelectedTransferAdmin("");
      setTransferPassword("");
      setTransferError("");
      setTransferOtpSent(false);
      setTransferOtp("");
      setTransferOtpError("");
      setTransferPasswordVerified(false);
      setTransferSubmitting(false);
      setTransferResending(false);
      setTransferTransferring(false);
      setTransferCanResend(true);
      setTransferResendTimer(0);
      setTransferPasswordAttempts(0);
      // Force fresh session with updated roles
      // Refresh the page to update permissions and reflect the role change
      // Since 'isDefaultAdmin' status has changed, a refresh is safer than just state update.
      window.location.reload();
    } catch (e) {
      setTransferError('Failed to transfer rights.');
    } finally {
      setTransferTransferring(false);
    }
  };



  // Enhanced toast function
  const showToast = (message, type = 'success') => {
    if (type === 'success') {
      toast.success(message, {
        position: 'top-center',
        autoClose: 2000
      });
    } else {
      toast.error(message, {
        position: 'top-center',
        autoClose: 2000
      });
    }
  };


  const handleEmailNotificationsChange = async (value) => {
    scrollPositionRef.current = window.scrollY;
    setEmailNotifications(value);
    localStorage.setItem('emailNotifications', value.toString());
    await updateUserSetting({ emailNotifications: value });
    showToast(t('messages.email_pref_saved'));
  };

  const handleInAppNotificationsChange = async (value) => {
    scrollPositionRef.current = window.scrollY;
    setInAppNotifications(value);
    localStorage.setItem('inAppNotifications', value.toString());
    await updateUserSetting({ inAppNotifications: value });
    showToast(t('messages.in_app_pref_saved'));
  };

  const handlePushNotificationsChange = async (value) => {
    scrollPositionRef.current = window.scrollY;
    if (value && 'Notification' in window) {
      if (Notification.permission !== 'granted') {
        setIsRequestingPush(true);
        try {
          const permission = await Notification.requestPermission();
          setIsRequestingPush(false);
          if (permission !== 'granted') {
            showToast(t('messages.push_denied'), 'error');
            return;
          }
        } catch (error) {
          setIsRequestingPush(false);
          console.error(error);
          return;
        }
      }
    }
    setPushNotifications(value);
    localStorage.setItem('pushNotifications', value.toString());
    await updateUserSetting({ pushNotifications: value });
    showToast(t('messages.push_pref_saved'));
  };

  const handleNotificationSoundChange = async (value) => {
    scrollPositionRef.current = window.scrollY;
    setNotificationSound(value);
    localStorage.setItem('notificationSound', value);
    await updateUserSetting({ notificationSound: value });
    showToast(t('messages.sound_pref_saved'));
  };

  const handleProfileVisibilityChange = async (value) => {
    scrollPositionRef.current = window.scrollY;
    try {
      setIsUpdatingVisibility(true);
      dispatch(updateUserStart());
      const res = await authenticatedFetch(`${API_BASE_URL}/api/user/update/${currentUser._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profileVisibility: value }),
      });
      const data = await res.json();
      if (data.success === false) {
        dispatch(updateUserFailure(data.message));
        setIsUpdatingVisibility(false);
        return;
      }
      dispatch(updateUserSuccess(data.updatedUser));
      setProfileVisibility(value);
      localStorage.setItem('profileVisibility', value);
      showToast(t('messages.profile_vis_updated'));
    } catch (error) {
      dispatch(updateUserFailure(error.message));
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const handleShowEmailChange = async (value) => {
    scrollPositionRef.current = window.scrollY;
    setShowEmail(value);
    localStorage.setItem('showEmail', value.toString());
    await updateUserSetting({ showEmail: value });
    // Dispatch custom event to notify Profile page
    window.dispatchEvent(new Event('settingsUpdated'));
    showToast(t('messages.email_vis_updated'));
  };

  const handleShowPhoneChange = async (value) => {
    scrollPositionRef.current = window.scrollY;
    setShowPhone(value);
    localStorage.setItem('showPhone', value.toString());
    await updateUserSetting({ showPhone: value });
    // Dispatch custom event to notify Profile page
    window.dispatchEvent(new Event('settingsUpdated'));
    showToast(t('messages.phone_vis_updated'));
  };

  const handleDataSharingChange = async (value) => {
    scrollPositionRef.current = window.scrollY;
    setDataSharing(value);
    localStorage.setItem('dataSharing', value.toString());
    await updateUserSetting({ dataSharing: value });
    showToast(t('messages.data_sharing_saved'));
  };

  const handleLocationAccessChange = async (value) => {
    scrollPositionRef.current = window.scrollY;

    if (value) {
      if (!navigator.geolocation) {
        showToast('Geolocation is not supported by this browser', 'error');
        return;
      }

      setIsRequestingLocation(true);
      navigator.geolocation.getCurrentPosition(
        async () => {
          setAllowLocationAccess(true);
          localStorage.setItem('allowLocationAccess', 'true');
          await updateUserSetting({ allowLocationAccess: true });
          showToast('Location access granted preference saved');
          setIsRequestingLocation(false);
        },
        (error) => {
          console.error("Geolocation error:", error);
          if (error.code === error.PERMISSION_DENIED) {
            showToast('Location permission denied. Please allow it in browser settings.', 'error');
          } else {
            showToast('Failed to access location.', 'error');
          }
          setAllowLocationAccess(false);
          setIsRequestingLocation(false);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setAllowLocationAccess(false);
      localStorage.setItem('allowLocationAccess', 'false');
      await updateUserSetting({ allowLocationAccess: false });
      showToast('Location access disabled');
    }
  };

  const handleLanguageChange = async (value) => {
    scrollPositionRef.current = window.scrollY;
    setLanguage(value);
    i18n.changeLanguage(value);
    localStorage.setItem('language', value);
    await updateUserSetting({ language: value });
    showToast(t('messages.language_saved'));
  };

  const handleTimezoneChange = async (value) => {
    scrollPositionRef.current = window.scrollY;
    setTimezone(value);
    localStorage.setItem('timezone', value);
    await updateUserSetting({ timezone: value });
    showToast(t('messages.timezone_updated'));
  };

  const handleDateFormatChange = async (value) => {
    scrollPositionRef.current = window.scrollY;
    setDateFormat(value);
    localStorage.setItem('dateFormat', value);
    await updateUserSetting({ dateFormat: value });
    showToast(t('messages.date_format_updated'));
  };

  const handleThemeChange = async (value) => {
    scrollPositionRef.current = window.scrollY;
    setTheme(value);
    localStorage.setItem('theme', value);
    await updateUserSetting({ theme: value });
    window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: value } }));

    if (value === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.classList.toggle('dark', systemTheme === 'dark');
    } else {
      document.documentElement.classList.toggle('dark', value === 'dark');
    }

    showToast(t('messages.theme_updated'));
  };

  const handleFontSizeChange = async (value) => {
    scrollPositionRef.current = window.scrollY;
    setFontSize(value);
    localStorage.setItem('fontSize', value);
    await updateUserSetting({ fontSize: value });
    document.documentElement.style.fontSize = value === 'small' ? '14px' : value === 'large' ? '18px' : '16px';
    showToast(t('messages.font_size_updated'));
  };

  const handleExportDataClick = () => {
    // Select all modules by default
    setSelectedExportModules(EXPORT_MODULES.map(m => m.key));
    setShowExportSelectionModal(true);
    setExportPassword("");
    setExportPasswordError("");
    setExportPasswordVerifying(false);
    setExportPasswordAttempts(0);
  };

  const handleVerifyExportPassword = async () => {
    setExportPasswordError("");
    if (!exportPassword) {
      setExportPasswordError('Password is required');
      return;
    }
    setExportPasswordVerifying(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: exportPassword })
      });
      if (!res.ok) {
        if (res.status === 400 || res.status >= 500) {
          let msg = 'Invalid password';
          try { const d = await res.json(); if (d.message) msg = d.message; } catch (e) { }
          setExportPasswordError(msg);
          setExportPasswordVerifying(false);
          return;
        }

        const attempts = exportPasswordAttempts + 1;
        setExportPasswordAttempts(attempts);
        if (attempts >= 3) {
          setShowExportPasswordModal(false);
          toast.error("For security reasons, you've been signed out automatically.");
          dispatch(signoutUserStart());
          const signoutRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/signout`);
          const signoutData = await signoutRes.json();
          if (signoutData.success === false) dispatch(signoutUserFailure(signoutData.message)); else dispatch(signoutUserSuccess(signoutData));
          navigate('/sign-in', { replace: true });
          setExportPasswordVerifying(false);
          return;
        }
        setExportPasswordError(`Invalid password. ${3 - attempts} attempt(s) remaining.`);
        setExportPassword("");
        setExportPasswordVerifying(false);
        return;
      }
      // Password verified, proceed with export
      setShowExportPasswordModal(false);
      await performDataExport();
    } catch (error) {
      setExportPasswordError('Failed to verify password');
    } finally {
      setExportPasswordVerifying(false);
    }
  };

  const performDataExport = async () => {
    setExportingData(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/user/export-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: exportPassword,
          selectedModules: selectedExportModules
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || t('messages.export_failed'));
        return;
      }
      toast.success(t('messages.export_success'));
    } catch (error) {
      toast.error(t('messages.export_failed'));
    } finally {
      setExportingData(false);
    }
  };

  // Scroll monitoring removed to fix disorientation issues

  // Apply theme on mount and change
  useEffect(() => {
    const applyTheme = () => {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (theme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        // System
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };
    applyTheme();
  }, [theme]);

  // Listen for theme changes from other components (e.g., ThemeToggle)
  useEffect(() => {
    const handleThemeSync = (e) => {
      setTheme(e.detail.theme);
    };
    window.addEventListener('theme-change', handleThemeSync);
    return () => window.removeEventListener('theme-change', handleThemeSync);
  }, []);

  // Apply font size on mount
  useEffect(() => {
    document.documentElement.style.fontSize = fontSize === 'small' ? '14px' : fontSize === 'large' ? '18px' : '16px';
  }, [fontSize]);

  if (!currentUser) {
    return <div className="text-center text-red-600 mt-10">Please sign in to access settings.</div>;
  }







  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-950 py-10 px-2 md:px-8 transition-colors duration-300">
      {/* Signout Loading Modal */}

      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {t('settings.title')}
            </span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{t('settings.subtitle')}</p>
        </div>

        {/* Security Settings */}
        <SettingSection title={t('settings.section_security')} icon={FaShieldAlt}>
          <div className="space-y-4">
            <button
              onClick={() => navigate((currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? '/admin/change-password' : '/user/change-password')}
              className={`w-full bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp}`}
            >
              <FaKey className={`w-4 h-4 mr-2 transition-transform duration-300 group-hover:animate-wiggle`} />
              {t('settings.change_password')}
            </button>

            <button
              onClick={() => navigate((currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? '/admin/device-management' : '/user/device-management')}
              className={`w-full bg-indigo-500 text-white px-6 py-3 rounded-lg hover:bg-indigo-600 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp}`}
            >
              <FaMobileAlt className={`w-4 h-4 mr-2 transition-transform duration-300 group-hover:animate-pulse`} />
              {t('settings.device_management')}
            </button>

            {(currentUser.role === 'admin' || currentUser.role === 'rootadmin') && (
              <button
                onClick={() => navigate('/admin/session-management')}
                className={`w-full bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp}`}
              >
                <FaHistory className={`w-4 h-4 mr-2 transition-transform duration-300 group-hover:animate-pulse`} />
                {t('settings.session_management')}
              </button>
            )}
          </div>
        </SettingSection>

        {/* Notification Preferences */}
        <SettingSection title={t('settings.section_notifications')} icon={FaBell}>
          <div className="space-y-0">
            <ToggleSwitch
              label={t('settings.email_notifications')}
              checked={emailNotifications}
              onChange={handleEmailNotificationsChange}
              description="Receive notifications via email"
            />
            <ToggleSwitch
              label={t('settings.in_app_notifications')}
              checked={inAppNotifications}
              onChange={handleInAppNotificationsChange}
              description="Show notifications within the app"
            />
            <ToggleSwitch
              label={t('settings.push_notifications')}
              checked={pushNotifications}
              onChange={handlePushNotificationsChange}
              description="Receive browser push notifications"
              isLoading={isRequestingPush}
            />
            <SelectOption
              label={t('settings.notification_sound')}
              value={notificationSound}
              options={[
                { value: 'default', label: 'Default' },
                { value: 'none', label: 'None' },
                { value: 'gentle', label: 'Gentle' },
                { value: 'alert', label: 'Alert' }
              ]}
              onChange={handleNotificationSoundChange}
              description="Choose notification sound preference"
            />
          </div>
        </SettingSection>

        {/* Privacy Settings */}
        <SettingSection title={t('settings.section_privacy')} icon={FaLock}>
          <div className="space-y-0">
            <SelectOption
              label={t('settings.profile_visibility')}
              value={profileVisibility}
              options={[
                { value: 'public', label: 'Public' },
                { value: 'friends', label: 'Friends Only' },
                { value: 'private', label: 'Private' }
              ]}
              onChange={handleProfileVisibilityChange}
              description="Control who can see your profile"
              onInfoClick={() => setShowVisibilityInfoModal(true)}
              isLoading={isUpdatingVisibility}
            />
            <ToggleSwitch
              label={t('settings.show_email')}
              checked={showEmail}
              onChange={handleShowEmailChange}
              description="Display your email on your profile"
            />
            <ToggleSwitch
              label={t('settings.show_phone')}
              checked={showPhone}
              onChange={handleShowPhoneChange}
              description="Display your phone number on your profile"
            />
            <ToggleSwitch
              label={t('settings.data_sharing')}
              checked={dataSharing}
              onChange={handleDataSharingChange}
              description="Allow anonymous data sharing to improve our services"
            />
            <ToggleSwitch
              label="Location Access for Route Planner"
              checked={allowLocationAccess}
              onChange={handleLocationAccessChange}
              description="Allow Route Planner to automatically access your location"
              isLoading={isRequestingLocation}
            />
            <div className="flex justify-end pt-2 pb-1">
              <Link
                to={currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin/route-planner' : '/user/route-planner'}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline flex items-center gap-2 transition-colors"
              >
                Go to Route Planner <FaLocationArrow className="text-xs" />
              </Link>
            </div>
          </div>
        </SettingSection>

        {/* Language & Region */}
        <SettingSection title={t('settings.section_language')} icon={FaGlobe}>
          <div className="space-y-0">
            <SelectOption
              label={t('settings.language')}
              value={language}
              options={[
                { value: 'en', label: 'English' },
                { value: 'hi', label: 'Hindi (हिंदी)' },
                { value: 'bn', label: 'Bengali (বাংলা)' },
                { value: 'te', label: 'Telugu (తెలుగు)' },
                { value: 'mr', label: 'Marathi (मराठी)' },
                { value: 'ta', label: 'Tamil (தமிழ்)' },
                { value: 'gu', label: 'Gujarati (ગુજરાતી)' },
                { value: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
                { value: 'ml', label: 'Malayalam (മലയാളം)' },
                { value: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)' },
                { value: 'es', label: 'Spanish (Español)' },
                { value: 'fr', label: 'French (Français)' }
              ]}
              onChange={handleLanguageChange}
              description="Choose your preferred language"
            />
            <SelectOption
              label={t('settings.timezone')}
              value={timezone}
              options={[
                { value: Intl.DateTimeFormat().resolvedOptions().timeZone, label: Intl.DateTimeFormat().resolvedOptions().timeZone },
                { value: 'America/New_York', label: 'Eastern Time (ET)' },
                { value: 'America/Chicago', label: 'Central Time (CT)' },
                { value: 'America/Denver', label: 'Mountain Time (MT)' },
                { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
                { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
                { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' }
              ]}
              onChange={handleTimezoneChange}
              description="Set your timezone"
              extraContent={
                currentTimePreview && (
                  <div className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-800/50">
                    <FaClock className="w-4 h-4 mr-2" />
                    <span>Current Time: {currentTimePreview}</span>
                  </div>
                )
              }
            />
            <SelectOption
              label={t('settings.date_format')}
              value={dateFormat}
              options={[
                { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                { value: 'DD MMM YYYY', label: 'DD MMM YYYY' }
              ]}
              onChange={handleDateFormatChange}
              description="Choose your preferred date format"
            />
          </div>
        </SettingSection>

        {/* Appearance */}
        <SettingSection title={t('settings.section_appearance')} icon={FaPalette}>
          <div className="space-y-0">
            <div className="py-3 border-b border-gray-200 dark:border-gray-700">
              <p className="font-medium text-gray-800 dark:text-gray-200 mb-2">{t('settings.theme')}</p>
              <div className="flex gap-4">
                <button
                  onClick={() => handleThemeChange('light')}
                  className={`flex-1 p-3 rounded-lg border-2 transition-all ${theme === 'light' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 dark:text-gray-300'}`}
                >
                  <FaSun className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
                  <span className="text-sm font-medium">{t('settings.theme_light')}</span>
                </button>
                <button
                  onClick={() => handleThemeChange('dark')}
                  className={`flex-1 p-3 rounded-lg border-2 transition-all ${theme === 'dark' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 dark:text-gray-300'}`}
                >
                  <FaMoon className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                  <span className="text-sm font-medium">{t('settings.theme_dark')}</span>
                </button>
                <button
                  onClick={() => handleThemeChange('system')}
                  className={`flex-1 p-3 rounded-lg border-2 transition-all ${theme === 'system' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 dark:text-gray-300'}`}
                >
                  <FaDesktop className="w-5 h-5 mx-auto mb-1 text-gray-500" />
                  <span className="text-sm font-medium">{t('settings.theme_system') === 'settings.theme_system' ? 'System' : t('settings.theme_system')}</span>
                </button>
              </div>
            </div>
            <SelectOption
              label={t('settings.font_size')}
              value={fontSize}
              options={[
                { value: 'small', label: t('settings.font_small') },
                { value: 'medium', label: t('settings.font_medium') },
                { value: 'large', label: t('settings.font_large') }
              ]}
              onChange={handleFontSizeChange}
              description="Adjust text size for better readability"
            />
          </div>
        </SettingSection>

        {/* Data Management */}
        <SettingSection title={t('settings.section_data')} icon={FaDatabase} onInfoClick={() => setShowExportInfoModal(true)}>
          <div className="space-y-4">
            <button
              onClick={handleExportDataClick}
              disabled={exportingData}
              className={`w-full bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-all duration-300 transform hover:scale-[1.01] hover:shadow-lg flex items-center justify-center font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${animationClasses.slideInUp}`}
            >
              {exportingData ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <FaFileDownload className={`w-4 h-4 mr-2`} />
                  {t('settings.export_data')}
                </>
              )}
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400">Get a copy of your account data in JSON/text format</p>
          </div>
        </SettingSection>

        {/* Call Management */}
        <SettingSection title={t('settings.section_call')} icon={FaPhone}>
          <div className="space-y-4">
            {/* Only show Call History for regular users, not admins */}
            {(currentUser.role !== 'admin' && currentUser.role !== 'rootadmin') && (
              <>
                <button
                  onClick={() => navigate('/user/call-history')}
                  className={`w-full bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp}`}
                >
                  <FaPhone className={`w-4 h-4 mr-2 transition-transform duration-300 group-hover:animate-pulse`} />
                  {t('settings.call_history')}
                </button>
                <p className="text-sm text-gray-500 dark:text-gray-400">View your audio and video call history with buyers and sellers</p>
              </>
            )}

            {/* Show Admin Call History for admins only */}
            {(currentUser.role === 'admin' || currentUser.role === 'rootadmin') && (
              <>
                <button
                  onClick={() => navigate('/admin/call-history')}
                  className={`w-full bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp}`}
                >
                  <FaVideo className={`w-4 h-4 mr-2 transition-transform duration-300 group-hover:animate-pulse`} />
                  {t('settings.admin_call_history')}
                </button>
                <p className="text-sm text-gray-500 dark:text-gray-400">View and manage all call history across the platform</p>
              </>
            )}
          </div>
        </SettingSection>

        {/* Admin Settings */}
        {(currentUser.role === 'admin' || currentUser.role === 'rootadmin') && (
          <SettingSection title={t('settings.section_admin')} icon={FaUser}>
            <div className="space-y-4">
              <button
                onClick={() => navigate('/admin/management')}
                className={`w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp}`}
              >
                <FaUser className={`w-4 h-4 mr-2 transition-transform duration-300 group-hover:animate-pulse`} />
                {t('settings.account_management')}
              </button>

              <button
                onClick={() => navigate('/admin/updates')}
                className={`w-full bg-indigo-500 text-white px-6 py-3 rounded-lg hover:bg-indigo-600 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp}`}
              >
                <FaBullhorn className={`w-4 h-4 mr-2 transition-transform duration-300 group-hover:animate-shake`} />
                {t('settings.platform_updates')}
              </button>

              {currentUser.role === 'rootadmin' && (
                <button
                  onClick={() => navigate('/admin/deployment-management')}
                  className={`w-full bg-teal-500 text-white px-6 py-3 rounded-lg hover:bg-teal-600 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp}`}
                >
                  <FaCloudUploadAlt className={`w-4 h-4 mr-2 transition-transform duration-300 group-hover:animate-pulse`} />
                  {t('settings.deployment_management')}
                </button>
              )}

              <button
                onClick={() => navigate('/admin/session-audit-logs')}
                className={`w-full bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp}`}
              >
                <FaClipboardList className={`w-4 h-4 mr-2 transition-transform duration-300 group-hover:animate-pulse`} />
                {t('settings.audit_logs')}
              </button>

              <button
                onClick={() => navigate('/admin/client-errors')}
                className={`w-full bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp}`}
              >
                <FaExclamationTriangle className={`w-4 h-4 mr-2 transition-transform duration-300 group-hover:animate-pulse`} />
                Client Error Monitoring
              </button>

              <button
                onClick={() => navigate('/admin/marketing-intelligence')}
                className={`w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp}`}
              >
                <FaRocket className={`w-4 h-4 mr-2 transition-transform duration-300 group-hover:animate-fly`} />
                Sponsor Intelligence
              </button>
            </div>
          </SettingSection>
        )}

        {/* Default Admin Settings */}
        {currentUser.isDefaultAdmin && (
          <SettingSection title={t('settings.section_admin_rights')} icon={FaCrown}>
            <div className="space-y-4">
              <button
                onClick={onShowTransferModal}
                className={`w-full bg-yellow-500 text-white px-6 py-3 rounded-lg hover:bg-yellow-600 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp}`}
              >
                <FaCrown className={`w-4 h-4 mr-2 transition-transform duration-300 group-hover:animate-bounce text-yellow-200`} />
                {t('settings.transfer_rights')}
              </button>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-4 w-4 text-blue-400 dark:text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-2">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {t('settings.transfer_admin_note')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SettingSection>
        )}

        {/* Legal & Support */}
        <SettingSection title={t('settings.section_legal')} icon={FaShieldAlt}>
          <div className="space-y-3">
            <Link
              to={currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin/terms' : '/user/terms'}
              className="block text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
            >
              {t('settings.terms_conditions')}
            </Link>
            <Link
              to={currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin/privacy' : '/user/privacy'}
              className="block text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
            >
              {t('settings.privacy_policy')}
            </Link>
            <Link
              to={currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin/cookie-policy' : '/user/cookie-policy'}
              className="block text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
            >
              {t('settings.cookie_policy')}
            </Link>
            <Link
              to={currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin/community-guidelines' : '/user/community-guidelines'}
              className="block text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
            >
              {t('settings.community_guidelines') || 'Community Guidelines'}
            </Link>
          </div>
        </SettingSection>

        {/* Account Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <FaExclamationTriangle className="w-5 h-5 mr-2 text-red-600 dark:text-red-500" />
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">{t('settings.section_account')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={handleSettingsSignout}
              className={`bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp}`}
            >
              <FaSignOutAlt className={`w-4 h-4 mr-2 transition-transform duration-300 group-hover:-translate-x-1`} />
              {t('settings.sign_out')}
            </button>

            <button
              onClick={onHandleDelete}
              className={`bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp}`}
            >
              <FaTrash className={`w-4 h-4 mr-2 transition-transform duration-300 group-hover:animate-wiggle`} />
              {t('settings.delete_account')}
            </button>
          </div>
          <p className="text-sm text-red-500 dark:text-red-400 mt-2">
            {t('settings.delete_account_warning')}
          </p>
        </div>
      </div>

      {/* Admin Selection Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.3s_ease-out]">
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto ${animationClasses.scaleIn}`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Transfer Default Admin Rights</h3>
                <button
                  onClick={() => {
                    setSelectedAdmin("");
                    setShowAdminModal(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  As the default admin, you must select another approved admin to transfer your default admin rights before deleting your account.
                </p>

                {loadingAdmins ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
                  </div>
                ) : admins.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500 dark:text-gray-400">No other approved admins found.</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">You cannot delete your account until another admin is approved.</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Admin to Transfer Rights To:
                    </label>
                    <select
                      value={selectedAdmin}
                      onChange={(e) => setSelectedAdmin(e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                      <option value="" className="dark:bg-gray-800">Choose an admin...</option>
                      {admins.map((admin) => (
                        <option key={admin._id} value={admin._id} className="dark:bg-gray-800">
                          {admin.username} ({admin.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setSelectedAdmin("");
                    setShowAdminModal(false);
                  }}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors dark:bg-gray-600 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransferAndDelete}
                  disabled={!selectedAdmin || transferLoading}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center"
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

      {/* Delete Account Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.3s_ease-out]">
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full ${animationClasses.scaleIn}`}>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Confirm Account Deletion</h3>
              <p className="mb-4 text-gray-600 dark:text-gray-400">Enter your password. After verification, we will email you an OTP to complete deletion.</p>
              <form onSubmit={async e => { e.preventDefault(); if (!deleteOtpSent && !deleteReasonOpen) { await handleConfirmDelete(); } else if (!deleteOtpSent && deleteReasonOpen) { await handleContinueAfterReason(); } else { await handleFinalDeleteWithOtp(); } }}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password:</label>
                <input
                  ref={deletePasswordRef}
                  type="password"
                  className={`w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-600 dark:bg-gray-700 dark:text-white ${deletePasswordVerified || deleteVerifying ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`}
                  placeholder="Enter your password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  disabled={deletePasswordVerified || deleteVerifying}
                />
                {deleteError && <div className="text-red-600 dark:text-red-400 text-sm mb-2">{deleteError}</div>}

                {deleteReasonOpen && !deleteOtpSent && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reason for leaving</label>
                    <select
                      className={`w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-600 dark:bg-gray-700 dark:text-white ${deleteProcessing ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`}
                      value={deleteReason}
                      onChange={e => setDeleteReason(e.target.value)}
                      disabled={deleteProcessing}
                    >
                      <option value="" className="dark:bg-gray-800">Select a reason</option>
                      <option value="Better platform" className="dark:bg-gray-800">Found a better platform</option>
                      <option value="Privacy or security concerns" className="dark:bg-gray-800">Privacy or security concerns</option>
                      <option value="Too many notifications/emails" className="dark:bg-gray-800">Too many notifications/emails</option>
                      <option value="Couldn't find suitable property" className="dark:bg-gray-800">Couldn't find suitable property</option>
                      <option value="Just testing / trial account" className="dark:bg-gray-800">Just testing / trial account</option>
                      <option value="other" className="dark:bg-gray-800">Other (please specify)</option>
                    </select>
                    {deleteReason === 'other' && (
                      <input
                        type="text"
                        className={`w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-600 dark:bg-gray-700 dark:text-white ${deleteProcessing ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`}
                        placeholder="Please describe your reason (optional)"
                        value={deleteOtherReason}
                        onChange={e => setDeleteOtherReason(e.target.value)}
                        disabled={deleteProcessing}
                      />
                    )}
                  </div>
                )}

                {deleteOtpSent && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Enter OTP</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        ref={deleteOtpRef}
                        type="text"
                        maxLength="6"
                        value={deleteOtp}
                        onChange={e => setDeleteOtp(e.target.value.replace(/[^0-9]/g, ''))}
                        className={`flex-1 p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-600 dark:bg-gray-700 dark:text-white ${deleteResending || deleteDeleting ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`}
                        placeholder="6-digit OTP"
                        disabled={deleteResending || deleteDeleting}
                      />
                      <button type="button" disabled={!deleteCanResend || deleteResendTimer > 0 || deleteResending || deleteDeleting} onClick={async () => { if (deleteResendTimer > 0) return; setDeleteOtpError(""); const ok = await resendDeleteOtp(); if (ok) { setDeleteCanResend(false); setDeleteResendTimer(30); } }} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-lg text-sm disabled:opacity-50 sm:self-auto self-start hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">{deleteResending ? 'Sending...' : (deleteResendTimer > 0 ? `Resend in ${deleteResendTimer}s` : 'Resend OTP')}</button>
                    </div>
                    {deleteOtpError && <div className="text-red-600 dark:text-red-400 text-sm mt-1">{deleteOtpError}</div>}
                    <div className="text-green-600 dark:text-green-500 text-sm mt-2 flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      OTP has been sent to your email address
                    </div>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setDeletePassword("");
                      setDeleteError("");
                      setDeleteReasonOpen(false);
                      setDeleteReason("");
                      setDeleteOtherReason("");
                      setDeleteOtpSent(false);
                      setDeleteOtp("");
                      setDeleteOtpError("");
                      setDeletePasswordVerified(false);
                      setDeleteVerifying(false);
                      setDeleteProcessing(false);
                      setDeleteDeleting(false);
                      setDeleteResending(false);
                      setDeletePasswordAttempts(0);
                    }}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors dark:bg-gray-600 dark:hover:bg-gray-700"
                  >Cancel</button>
                  <button
                    type="submit"
                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={deleteVerifying || deleteProcessing || deleteDeleting || deleteResending}
                  >{deleteOtpSent ? (deleteDeleting ? 'Deleting...' : 'Delete') : (deleteReasonOpen ? (deleteProcessing ? 'Processing...' : 'Continue') : (deleteVerifying ? 'Verifying...' : 'Verify'))}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Transfer and Delete Modal */}
      {showTransferPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.3s_ease-out]">
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full ${animationClasses.scaleIn}`}>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Confirm Account Deletion</h3>
              <p className="mb-4 text-gray-600 dark:text-gray-400">Please enter your password to confirm account deletion after transferring default admin rights. This action cannot be undone.</p>
              <form onSubmit={async e => { e.preventDefault(); if (!transferOtpSent) { await handleConfirmTransferAndDelete(); } else { await handleFinalTransferDeleteWithOtp(); } }}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password:</label>
                <input
                  ref={transferDeletePasswordRef}
                  type="password"
                  className={`w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-600 dark:bg-gray-700 dark:text-white ${transferDeletePasswordVerified || transferLoading ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`}
                  placeholder="Enter your password"
                  value={transferDeletePassword}
                  onChange={e => setTransferDeletePassword(e.target.value)}
                  disabled={transferDeletePasswordVerified || transferLoading}
                />
                {transferDeleteError && <div className="text-red-600 dark:text-red-400 text-sm mb-2">{transferDeleteError}</div>}
                {transferOtpSent && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Enter OTP</label>
                    <div className="flex gap-2">
                      <input ref={transferDeleteOtpRef} type="text" maxLength="6" value={transferOtp} onChange={e => setTransferOtp(e.target.value.replace(/[^0-9]/g, ''))} className={`flex-1 p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-600 dark:bg-gray-700 dark:text-white ${transferDeleteResending || transferDeleteDeleting ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`} placeholder="6-digit OTP" disabled={transferDeleteResending || transferDeleteDeleting} />
                      <button type="button" disabled={!transferCanResend || transferResendTimer > 0 || transferDeleteResending || transferDeleteDeleting} onClick={async () => { if (transferResendTimer > 0) return; const ok = await resendTransferOtp(); if (ok) { setTransferCanResend(false); setTransferResendTimer(30); } }} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-lg text-sm disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">{transferDeleteResending ? 'Sending...' : (transferResendTimer > 0 ? `Resend in ${transferResendTimer}s` : 'Resend OTP')}</button>
                    </div>
                    {transferOtpError && <div className="text-red-600 dark:text-red-400 text-sm mt-1">{transferOtpError}</div>}
                    <div className="text-green-600 dark:text-green-500 text-sm mt-2 flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      OTP has been sent to your email address
                    </div>
                  </div>
                )}
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTransferPasswordModal(false);
                      setTransferDeletePassword("");
                      setTransferDeleteError("");
                      setTransferOtpSent(false);
                      setTransferOtp("");
                      setTransferOtpError("");
                      setTransferDeletePasswordVerified(false);
                      setTransferLoading(false);
                      setTransferDeleteResending(false);
                      setTransferDeleteDeleting(false);
                      setTransferCanResend(true);
                      setTransferResendTimer(0);
                      setTransferDeletePasswordAttempts(0);
                    }}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors dark:bg-gray-600 dark:hover:bg-gray-700"
                  >Cancel</button>
                  <button
                    type="submit"
                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={transferLoading || transferDeleteResending || transferDeleteDeleting}
                  >
                    {transferDeleteDeleting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                        Deleting...
                      </>
                    ) : transferOtpSent ? 'Transfer & Delete' : (transferLoading ? 'Processing...' : 'Verify & Send OTP')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Rights Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.3s_ease-out]">
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto ${animationClasses.scaleIn}`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Transfer Root Admin Rights</h3>
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-4">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Select an admin to transfer your root admin rights. You will remain an admin after transfer.
                </p>
                {loadingAdmins ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
                  </div>
                ) : transferAdmins.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500 dark:text-gray-400">No other admins found.</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">You cannot transfer rights until another admin exists.</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Admin to Transfer Rights To:
                    </label>
                    <select
                      value={selectedTransferAdmin}
                      onChange={e => setSelectedTransferAdmin(e.target.value)}
                      className={`w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent dark:bg-gray-700 dark:text-white ${transferPasswordVerified || transferSubmitting ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`}
                      disabled={transferPasswordVerified || transferSubmitting}
                    >
                      <option value="" className="dark:bg-gray-800">Choose an admin...</option>
                      {transferAdmins.map(admin => (
                        <option key={admin._id} value={admin._id} className="dark:bg-gray-800">
                          {admin.username} ({admin.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirm Password:</label>
                <form onSubmit={e => { e.preventDefault(); transferOtpSent ? handleFinalTransferWithOtp() : handleTransferSubmit(); }}>
                  <input
                    type="password"
                    className={`w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:focus:ring-yellow-600 dark:bg-gray-700 dark:text-white ${transferPasswordVerified || transferSubmitting ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`}
                    placeholder="Enter your password"
                    value={transferPassword}
                    onChange={e => setTransferPassword(e.target.value)}
                    disabled={transferPasswordVerified || transferSubmitting}
                  />
                  {!transferOtpSent && transferError && <div className="text-red-600 dark:text-red-400 text-sm mt-2">{transferError}</div>}
                  {transferOtpSent && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Enter OTP</label>
                      <div className="flex gap-2">
                        <input ref={transferRightsOtpRef} type="text" maxLength="6" value={transferOtp} onChange={e => setTransferOtp(e.target.value.replace(/[^0-9]/g, ''))} className={`flex-1 p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:focus:ring-yellow-600 dark:bg-gray-700 dark:text-white ${transferResending || transferTransferring ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`} placeholder="6-digit OTP" disabled={transferResending || transferTransferring} />
                        <button type="button" disabled={!transferCanResend || transferResendTimer > 0 || transferResending || transferTransferring} onClick={async () => { if (transferResendTimer > 0) return; const ok = await resendTransferOtp(); if (ok) { setTransferCanResend(false); setTransferResendTimer(30); } }} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-lg text-sm disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">{transferResending ? 'Sending...' : (transferResendTimer > 0 ? `Resend in ${transferResendTimer}s` : 'Resend OTP')}</button>
                      </div>
                      {transferError && <div className="text-red-600 dark:text-red-400 text-sm mt-2">{transferError}</div>}
                      <div className="text-green-600 dark:text-green-500 text-sm mt-2 flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        OTP has been sent to your email address
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setShowTransferModal(false);
                        setSelectedTransferAdmin("");
                        setTransferPassword("");
                        setTransferError("");
                        setTransferOtpSent(false);
                        setTransferOtp("");
                        setTransferOtpError("");
                        setTransferPasswordVerified(false);
                        setTransferSubmitting(false);
                        setTransferResending(false);
                        setTransferTransferring(false);
                        setTransferCanResend(true);
                        setTransferResendTimer(0);
                        setTransferPasswordAttempts(0);
                      }}
                      className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors dark:bg-gray-600 dark:hover:bg-gray-700"
                    >Cancel</button>
                    <button
                      type="submit"
                      disabled={!selectedTransferAdmin || !transferPassword || transferSubmitting || transferResending || transferTransferring || (transferOtpSent && transferOtp.length !== 6)}
                      className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center"
                    >
                      {transferTransferring ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Transferring...
                        </>
                      ) : transferSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <FaCrown className="w-4 h-4 mr-2" />
                          {transferOtpSent ? 'Transfer Rights' : 'Verify'}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Selection Modal */}
      {showExportSelectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.3s_ease-out]">
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full ${animationClasses.scaleIn} max-h-[85vh] flex flex-col`}>
            <div className="p-6 pb-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Select Data to Export</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Choose the data you want to include in your export file.</p>

              {/* 24-hour restriction notice */}
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg flex items-start gap-3">
                <FaClock className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  <span className="font-bold">Important:</span> You can request a data export only once every 24 hours. Ensure you have selected all required data points before proceeding.
                </p>
              </div>

              <div className="mt-4 flex items-center">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-green-500 rounded border-gray-300 focus:ring-green-500"
                    checked={selectedExportModules.length === EXPORT_MODULES.filter(m => !m.adminOnly || (currentUser.role === 'admin' || currentUser.role === 'rootadmin')).length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedExportModules(EXPORT_MODULES.filter(m => !m.adminOnly || (currentUser.role === 'admin' || currentUser.role === 'rootadmin')).map(m => m.key));
                      else setSelectedExportModules([]);
                    }}
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Select All</span>
                </label>
                <span className="ml-auto text-sm text-gray-500">{selectedExportModules.length} selected</span>
              </div>
            </div>

            <div className="p-6 py-2 overflow-y-auto custom-scrollbar flex-1">
              <div className="space-y-3">
                {EXPORT_MODULES.filter(item => !item.adminOnly || (currentUser.role === 'admin' || currentUser.role === 'rootadmin')).map((item) => (
                  <label key={item.key} className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      className="form-checkbox h-5 w-5 text-blue-500 rounded border-gray-300 focus:ring-blue-500"
                      checked={selectedExportModules.includes(item.key)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedExportModules([...selectedExportModules, item.key]);
                        else setSelectedExportModules(selectedExportModules.filter(k => k !== item.key));
                      }}
                    />
                    <div className={`ml-3 p-2 rounded-full bg-gray-100 dark:bg-gray-800 ${item.color}`}>
                      <item.icon className="w-4 h-4" />
                    </div>
                    <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-200">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowExportSelectionModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedExportModules.length === 0) {
                    toast.error("Please select at least one item to export");
                    return;
                  }
                  setShowExportSelectionModal(false);
                  setShowExportPasswordModal(true);
                }}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Data Password Modal */}
      {showExportPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.3s_ease-out]">
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full ${animationClasses.scaleIn}`}>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Confirm Password</h3>
              <p className="mb-4 text-gray-600 dark:text-gray-400">For security, please confirm your password to download your data.</p>
              <form onSubmit={(e) => { e.preventDefault(); handleVerifyExportPassword(); }}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password:</label>
                <input
                  ref={exportPasswordRef}
                  type="password"
                  className={`w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-600 dark:bg-gray-700 dark:text-white ${exportPasswordVerifying ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`}
                  placeholder="Enter your password"
                  value={exportPassword}
                  onChange={e => setExportPassword(e.target.value)}
                  disabled={exportPasswordVerifying}
                />
                <div className="flex justify-end mb-3">
                  <button
                    type="button"
                    onClick={() => setShowExportSignoutModal(true)}
                    disabled={exportPasswordVerifying}
                    className={`text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium hover:underline transition-colors duration-200 ${exportPasswordVerifying ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                      }`}
                  >
                    Forgot Password?
                  </button>
                </div>
                {exportPasswordError && <div className="text-red-600 dark:text-red-400 text-sm mb-2">{exportPasswordError}</div>}
                <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportPasswordModal(false);
                      setExportPassword("");
                      setExportPasswordError("");
                      setExportPasswordVerifying(false);
                    }}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors dark:bg-gray-600 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center w-full sm:w-auto"
                    disabled={exportPasswordVerifying}
                  >
                    {exportPasswordVerifying ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Verifying...
                      </>
                    ) : (
                      <>
                        <FaCheck className="w-4 h-4 mr-2" />
                        Verify & Export
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Export Password Forgot Password Signout Confirmation Modal */}
      {showExportSignoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-[fadeIn_0.3s_ease-out]">
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full ${animationClasses.scaleIn}`}>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Sign Out Required</h3>
              <p className="mb-4 text-gray-600 dark:text-gray-400">To reset your password, you need to sign out first. You will be redirected to the forgot password page.</p>
              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowExportSignoutModal(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors dark:bg-gray-600 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowExportSignoutModal(false);
                    setShowExportPasswordModal(false);
                    setExportPassword("");
                    setExportPasswordError("");
                    await signout({
                      showToast: true,
                      navigateTo: "/forgot-password",
                      delay: 0
                    });
                  }}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center"
                >
                  <FaSignOutAlt className="w-4 h-4 mr-2" />
                  Sign Out & Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visibility Info Modal */}
      {
        showVisibilityInfoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-[fadeIn_0.3s_ease-out]">
            <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full ${animationClasses.scaleIn} overflow-hidden`}>
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 flex justify-between items-center text-white">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FaEye className="text-xl" />
                  Visibility Options
                </h3>
                <button
                  onClick={() => setShowVisibilityInfoModal(false)}
                  className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-1 transition-colors"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Public */}
                <div className="flex gap-3">
                  <div className="mt-1 flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                    <FaGlobe />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-white">Public</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Visible to everyone. Your name, avatar, and contact details (in accepted appointments) are shown.</p>
                  </div>
                </div>

                {/* Friends Only */}
                <div className="flex gap-3">
                  <div className="mt-1 flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <FaUsers />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-white">Friends Only</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Visible to friends and appointment partners. Anonymized in public forums/reviews. Full details shown in accepted appointments.</p>
                  </div>
                </div>

                {/* Private */}
                <div className="flex gap-3">
                  <div className="mt-1 flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400">
                    <FaLock />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-white">Private</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Your specific details are hidden everywhere. Displayed as "UrbanSetu Member" with a generic avatar.</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 flex justify-end transition-colors">
                <button
                  onClick={() => setShowVisibilityInfoModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* Export Info Modal */}
      {showExportInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.3s_ease-out]">
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full ${animationClasses.scaleIn}`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center">
                  <FaFileDownload className="mr-2 text-green-500" />
                  What's included?
                </h3>
              </div>

              <div className="max-h-[60vh] overflow-y-auto mb-6 pr-2 custom-scrollbar">
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  The data export file contains a comprehensive copy of your UrbanSetu data, including:
                </p>

                <ul className="space-y-3">
                  {[
                    { icon: FaUser, text: "Profile Information & Settings", color: "text-blue-500" },
                    { icon: FaCrown, text: "SetuCoins & Gamification History", color: "text-yellow-500" },
                    { icon: FaClipboardList, text: "Rental Contracts & Agreements", color: "text-indigo-500" },
                    { icon: FaHistory, text: "Gemini Chat History & Prompts", color: "text-purple-500" },
                    { icon: FaShieldAlt, text: "Rental Loans & Applications", color: "text-red-500" },
                    { icon: FaUsers, text: "Reviews & Ratings (Tenant/Landlord)", color: "text-orange-500" },
                    { icon: FaTools, text: "Listings & Property Details", color: "text-green-500" },
                    { icon: FaDownload, text: "Wishlist & Watchlist Items", color: "text-teal-500" },
                    { icon: FaVideo, text: "Appointment & Call History Logs", color: "text-pink-500" },
                    { icon: FaComments, text: "Community Discussions & Blog Comments", color: "text-cyan-500" },
                    { icon: FaMapMarkedAlt, text: "Saved Routes & Planner Data", color: "text-blue-600" },
                    { icon: FaChartLine, text: "Investment Tools Calculations", color: "text-emerald-500" },
                    { icon: FaDatabase, text: "Payment Records", color: "text-gray-500" }
                  ].map((item, index) => (
                    <li key={index} className="flex items-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <div className={`p-2 rounded-full bg-white dark:bg-gray-800 shadow-sm mr-3 ${item.color}`}>
                        <item.icon className="w-4 h-4" />
                      </div>
                      <span className="text-gray-700 dark:text-gray-200 text-sm font-medium">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => setShowExportInfoModal(false)}
                className="w-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* SignOut Confirmation Modal */}
      <AnimatePresence>
        {showSignOutModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSignOutModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <LogOut className="text-2xl text-red-600 dark:text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Sign Out</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Are you sure you want to sign out? You will need to sign in again to access admin features.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSignOutModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmSignout}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-red-500/30"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

