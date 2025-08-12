import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { FaEdit, FaUser, FaEnvelope, FaPhone, FaKey, FaTrash, FaSignOutAlt, FaHome, FaCalendarAlt, FaHeart, FaEye, FaCrown, FaTimes, FaCheck, FaStar } from "react-icons/fa";
import UserAvatar from "../components/UserAvatar";
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import { authenticatedFetch, createAuthenticatedFetchOptions } from '../utils/auth';
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

import { useWishlist } from "../WishlistContext";
import { toast } from 'react-toastify';
import { persistor } from '../redux/store';
import { reconnectSocket } from '../utils/socket';
import { socket } from '../utils/socket';
import defaultAvatars from '../assets/avatars'; // Assume this is an array of avatar image URLs
import avataaarsSchema from '../data/dicebear-avataaars-schema.json';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Animation CSS classes
const animationClasses = {
  fadeInUp: "animate-[fadeInUp_0.6s_ease-out_forwards] opacity-0 translate-y-8",
  fadeInLeft: "animate-[fadeInLeft_0.6s_ease-out_forwards] opacity-0 -translate-x-8",
  fadeInRight: "animate-[fadeInRight_0.6s_ease-out_forwards] opacity-0 translate-x-8",
  fadeIn: "animate-[fadeIn_0.6s_ease-out_forwards] opacity-0",
  scaleIn: "animate-[scaleIn_0.5s_ease-out_forwards] opacity-0 scale-95",
  slideInUp: "animate-[slideInUp_0.5s_ease-out_forwards] opacity-0 translate-y-4",
  staggerDelay: (index) => `animation-delay-${index * 150}ms`,
  bounceIn: "animate-[bounceIn_0.7s_ease-out_forwards] opacity-0 scale-50",
  pulse: "animate-pulse",
  spin: "animate-spin",
  bounce: "animate-bounce",
  wiggle: "animate-[wiggle_1s_ease-in-out_infinite]",
  heartbeat: "animate-[heartbeat_1.5s_ease-in-out_infinite]",
  float: "animate-[float_3s_ease-in-out_infinite]",
  shimmer: "animate-[shimmer_2s_linear_infinite]",
};

// Custom keyframe animations to be added to CSS
const customAnimations = `
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeInLeft {
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes fadeInRight {
  from { opacity: 0; transform: translateX(30px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes slideInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes bounceIn {
  0% { opacity: 0; transform: scale(0.3); }
  50% { opacity: 1; transform: scale(1.05); }
  70% { transform: scale(0.9); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes wiggle {
  0%, 7% { transform: rotateZ(0); }
  15% { transform: rotateZ(-15deg); }
  20% { transform: rotateZ(10deg); }
  25% { transform: rotateZ(-10deg); }
  30% { transform: rotateZ(6deg); }
  35% { transform: rotateZ(-4deg); }
  40%, 100% { transform: rotateZ(0); }
}
@keyframes heartbeat {
  0%, 50%, 100% { transform: scale(1); }
  25% { transform: scale(1.1); }
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}
@keyframes countUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animation-delay-0 { animation-delay: 0ms; }
.animation-delay-150 { animation-delay: 150ms; }
.animation-delay-300 { animation-delay: 300ms; }
.animation-delay-450 { animation-delay: 450ms; }
.animation-delay-600 { animation-delay: 600ms; }
.animation-delay-750 { animation-delay: 750ms; }
`;

// At the top, add the full list of DiceBear styles and a master filter list:
const dicebearStyles = [
  { key: 'adventurer', label: 'Adventurer' },
  { key: 'adventurer-neutral', label: 'Adventurer Neutral' },
  { key: 'avataaars', label: 'Avataaars' },
  { key: 'avataaars-neutral', label: 'Avataaars Neutral' },
  { key: 'big-ears', label: 'Big Ears' },
  { key: 'big-ears-neutral', label: 'Big Ears Neutral' },
  { key: 'big-smile', label: 'Big Smile' },
  { key: 'bottts', label: 'Bottts' },
  { key: 'bottts-neutral', label: 'Bottts Neutral' },
  { key: 'croodles', label: 'Croodles' },
  { key: 'croodles-neutral', label: 'Croodles Neutral' },
  { key: 'dylan', label: 'Dylan' },
  { key: 'fun-emoji', label: 'Fun Emoji' },
  { key: 'glass', label: 'Glass' },
  { key: 'icons', label: 'Icons' },
  { key: 'identicon', label: 'Identicon' },
  { key: 'initials', label: 'Initials' },
  { key: 'lorelei', label: 'Lorelei' },
  { key: 'lorelei-neutral', label: 'Lorelei Neutral' },
  { key: 'micah', label: 'Micah' },
  { key: 'miniavs', label: 'Miniavs' },
  { key: 'notionists', label: 'Notionists' },
  { key: 'notionists-neutral', label: 'Notionists Neutral' },
  { key: 'open-peeps', label: 'Open Peeps' },
  { key: 'personas', label: 'Personas' },
  { key: 'pixel-art', label: 'Pixel Art' },
  { key: 'pixel-art-neutral', label: 'Pixel Art Neutral' },
  { key: 'rings', label: 'Rings' },
  { key: 'shapes', label: 'Shapes' },
  { key: 'thumbs', label: 'Thumbs' },
];

// Master filter list (union of all known DiceBear filters, including multi-selects)
const dicebearMasterFilters = [
  { key: 'seed', type: 'string', label: 'Seed' },
  { key: 'flip', type: 'boolean', label: 'Flip' },
  { key: 'rotate', type: 'number', label: 'Rotate', min: 0, max: 360 },
  { key: 'scale', type: 'number', label: 'Scale', min: 0, max: 200 },
  { key: 'radius', type: 'number', label: 'Radius', min: 0, max: 50 },
  { key: 'backgroundColor', type: 'array', itemType: 'color', label: 'Background Color (comma separated hex)' },
  { key: 'backgroundType', type: 'array', options: ['solid', 'gradientLinear'], label: 'Background Type (multi)' },
  { key: 'backgroundRotation', type: 'array', itemType: 'number', label: 'Background Rotation (comma separated numbers)' },
  { key: 'translateX', type: 'number', label: 'Translate X', min: -100, max: 100 },
  { key: 'translateY', type: 'number', label: 'Translate Y', min: -100, max: 100 },
  { key: 'clip', type: 'boolean', label: 'Clip' },
  { key: 'randomizeIds', type: 'boolean', label: 'Randomize IDs' },
  // Example multi-selects (add more as needed)
  { key: 'accessories', type: 'array', label: 'Accessories (multi)' },
  { key: 'hair', type: 'array', label: 'Hair (multi)' },
  { key: 'eyes', type: 'array', label: 'Eyes (multi)' },
  { key: 'mouth', type: 'array', label: 'Mouth (multi)' },
  { key: 'nose', type: 'array', label: 'Nose (multi)' },
  { key: 'beard', type: 'array', label: 'Beard (multi)' },
  { key: 'mustache', type: 'array', label: 'Mustache (multi)' },
  { key: 'top', type: 'array', label: 'Top (multi)' },
  { key: 'skinColor', type: 'array', itemType: 'color', label: 'Skin Color (comma separated hex)' },
  { key: 'facialHair', type: 'array', label: 'Facial Hair (multi)' },
  { key: 'clothing', type: 'array', label: 'Clothing (multi)' },
  { key: 'clothesColor', type: 'array', itemType: 'color', label: 'Clothes Color (comma separated hex)' },
  { key: 'hatColor', type: 'array', itemType: 'color', label: 'Hat Color (comma separated hex)' },
  { key: 'hairColor', type: 'array', itemType: 'color', label: 'Hair Color (comma separated hex)' },
  { key: 'facialHairColor', type: 'array', itemType: 'color', label: 'Facial Hair Color (comma separated hex)' },
  // Example single-value enums (add more as needed)
  { key: 'style', type: 'string', label: 'Style (enum)' },
  // Example probabilities
  { key: 'beardProbability', type: 'number', label: 'Beard Probability', min: 0, max: 100 },
  { key: 'mustacheProbability', type: 'number', label: 'Mustache Probability', min: 0, max: 100 },
  { key: 'facialHairProbability', type: 'number', label: 'Facial Hair Probability', min: 0, max: 100 },
  { key: 'accessoriesProbability', type: 'number', label: 'Accessories Probability', min: 0, max: 100 },
  { key: 'topProbability', type: 'number', label: 'Top Probability', min: 0, max: 100 },
  // Add more as needed from all schemas
];

// Only show these filters in this order:
const allowedFilters = [
  'style',
  'seed',
  'flip',
  'rotate',
];

// Helper for color swatch option (improved for dropdowns)
const renderColorOption = (color) => (
  <option key={color} value={color} style={{ backgroundColor: `#${color}`, color: '#000' }}>
    {color}
  </option>
);

// Custom Counter Component with Animation
const AnimatedCounter = ({ end, duration = 1000, delay = 0 }) => {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setStarted(true);
      let start = 0;
      const increment = end / (duration / 50);
      const counter = setInterval(() => {
        start += increment;
        if (start >= end) {
          setCount(end);
          clearInterval(counter);
        } else {
          setCount(Math.floor(start));
        }
      }, 50);
      return () => clearInterval(counter);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [end, duration, delay]);

  return (
    <span className={`${started ? 'animate-[countUp_0.6s_ease-out_forwards]' : 'opacity-0'}`}>
      {count}
    </span>
  );
};

export default function Profile() {
  const { currentUser, error } = useSelector((state) => state.user);
  const { wishlist } = useWishlist();
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({ avatar: currentUser?.avatar || "" });
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
  const [showUpdatePasswordModal, setShowUpdatePasswordModal] = useState(false);
  const [updatePassword, setUpdatePassword] = useState("");
  const [updatePasswordError, setUpdatePasswordError] = useState("");
  
  // Lock body scroll when profile modals are open (delete/transfer flows)
  useEffect(() => {
    const shouldLock = showPasswordModal || showTransferPasswordModal || showTransferModal || showAdminModal;
    if (shouldLock) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showPasswordModal, showTransferPasswordModal, showTransferModal, showAdminModal]);
  
  // Real-time validation states
  const [emailValidation, setEmailValidation] = useState({ loading: false, message: "", available: null });
  const [mobileValidation, setMobileValidation] = useState({ loading: false, message: "", available: null });
  const [emailDebounceTimer, setEmailDebounceTimer] = useState(null);
  const [mobileDebounceTimer, setMobileDebounceTimer] = useState(null);
  const [originalEmail, setOriginalEmail] = useState("");
  const [originalMobile, setOriginalMobile] = useState("");
  
  // Email verification OTP states
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [emailEditMode, setEmailEditMode] = useState(false);
  
  // Timer states for resend OTP
  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(true);
  
  // Animation states
  const [isVisible, setIsVisible] = useState(false);
  const [statsAnimated, setStatsAnimated] = useState(false);
  
  const navigate = useNavigate();

  // Hide My Appointments button in admin context
  const isAdminProfile = window.location.pathname.startsWith('/admin');

  // Add custom animations to head
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = customAnimations;
    document.head.appendChild(style);
    
    // Trigger visibility for animations
    const timer = setTimeout(() => setIsVisible(true), 100);
    
    return () => {
      document.head.removeChild(style);
      clearTimeout(timer);
    };
  }, []);

  // Trigger stats animation when they change
  useEffect(() => {
    if (userStats.listings > 0 || userStats.appointments > 0 || userStats.wishlist > 0) {
      setStatsAnimated(true);
    }
  }, [userStats]);

  // Set original values when component mounts or user changes
  useEffect(() => {
    if (currentUser) {
      setOriginalEmail(currentUser.email || "");
      setOriginalMobile(currentUser.mobileNumber || "");
    }
  }, [currentUser]);

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

  // Timer effect for resend OTP
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prevTimer) => {
          if (prevTimer <= 1) {
            setCanResend(true);
            return 0;
          }
          return prevTimer - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (emailDebounceTimer) {
        clearTimeout(emailDebounceTimer);
      }
      if (mobileDebounceTimer) {
        clearTimeout(mobileDebounceTimer);
      }
    };
  }, [emailDebounceTimer, mobileDebounceTimer]);

  const fetchUserStats = async () => {
    try {
      console.log("[fetchUserStats] Fetching stats for:", currentUser);
      if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) {
        // Fetch admin-specific stats
        const [listingsRes, appointmentsRes] = await Promise.all([
          authenticatedFetch(`${API_BASE_URL}/api/listing/user`),
          authenticatedFetch(`${API_BASE_URL}/api/bookings/`)
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
          authenticatedFetch(`${API_BASE_URL}/api/listing/user`),
          authenticatedFetch(`${API_BASE_URL}/api/bookings/user/${currentUser._id}`)
        ]);

        const listingsData = await listingsRes.json();
        const appointmentsData = await appointmentsRes.json();

        setUserStats(prev => ({
          listings: Array.isArray(listingsData) ? listingsData.length : 0,
          appointments: Array.isArray(appointmentsData) ? appointmentsData.length : 0,
          wishlist: prev.wishlist // Keep the wishlist count from context
        }));
      }
    } catch (error) {
      console.error('[fetchUserStats] Error fetching user stats:', error);
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

  // Email validation function
  const validateEmail = async (email) => {
    if (!email.trim()) {
      setEmailValidation({ loading: false, message: "", available: null });
      setEmailVerified(false);
      setOtpSent(false);
      setOtp("");
      return;
    }
    // Show format error if no @
    if (!email.includes('@')) {
      setEmailValidation({ loading: false, message: "Enter a valid email", available: false });
      setEmailVerified(false);
      setOtpSent(false);
      setOtp("");
      return;
    }
    // Skip validation if email hasn't changed
    if (email === originalEmail) {
      setEmailValidation({ loading: false, message: "", available: true });
      setEmailVerified(true);
      setOtpSent(false);
      setOtp("");
      return;
    }
    try {
      setEmailValidation({ loading: true, message: "", available: null });
      const res = await authenticatedFetch(`${API_BASE_URL}/api/user/check-email/${encodeURIComponent(email.trim())}`);
      const data = await res.json();
      
      if (data.available === false) {
        // Email already exists
        setEmailValidation({ 
          loading: false, 
          message: "Email already exists. Please use a different one.", 
          available: false 
        });
        setEmailVerified(false);
        setOtpSent(false);
        setOtp("");
      } else {
        // Email is available, show blue tick and send OTP option
        setEmailValidation({ 
          loading: false, 
          message: "Email is available. Click 'Send OTP' to verify.", 
          available: true 
        });
        setEmailVerified(false);
        setOtpSent(false);
        setOtp("");
      }
    } catch (error) {
      setEmailValidation({ 
        loading: false, 
        message: "Error checking email availability", 
        available: false 
      });
      setEmailVerified(false);
      setOtpSent(false);
      setOtp("");
    }
  };

  // Mobile validation function
  const validateMobile = async (mobile) => {
    if (!mobile.trim()) {
      setMobileValidation({ loading: false, message: "", available: null });
      return;
    }
    // Show format error if not 10 digits
    if (!/^[0-9]{10}$/.test(mobile)) {
      setMobileValidation({ loading: false, message: "Enter a valid 10-digit mobile number", available: false });
      return;
    }
    // Skip validation if mobile hasn't changed
    if (mobile === originalMobile) {
      setMobileValidation({ loading: false, message: "", available: true });
      return;
    }
    try {
      setMobileValidation({ loading: true, message: "", available: null });
      const res = await authenticatedFetch(`${API_BASE_URL}/api/user/check-mobile/${encodeURIComponent(mobile.trim())}`);
      const data = await res.json();
      setMobileValidation({ 
        loading: false, 
        message: data.message, 
        available: data.available 
      });
    } catch (error) {
      setMobileValidation({ 
        loading: false, 
        message: "Error checking mobile availability", 
        available: false 
      });
    }
  };

  // Debounced email validation
  const debouncedEmailValidation = (email) => {
    if (emailDebounceTimer) {
      clearTimeout(emailDebounceTimer);
    }
    const timer = setTimeout(() => validateEmail(email), 300);
    setEmailDebounceTimer(timer);
  };

  // Debounced mobile validation
  const debouncedMobileValidation = (mobile) => {
    if (mobileDebounceTimer) {
      clearTimeout(mobileDebounceTimer);
    }
    const timer = setTimeout(() => validateMobile(mobile), 300);
    setMobileDebounceTimer(timer);
  };

  // Send OTP for email verification
  const handleSendOTP = async () => {
    if (!formData.email) {
      setOtpError("Please enter an email address first");
      return;
    }

    if (!canResend) {
      return;
    }

    setOtpLoading(true);
    setOtpError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: formData.email }),
      });

      const data = await res.json();

      if (data.success) {
        setOtpSent(true);
        toast.success("OTP sent successfully to your email");
        
        // Update validation message to show OTP sent status
        setEmailValidation({ 
          loading: false, 
          message: "OTP sent to given email. Please enter the code above to verify.", 
          available: true 
        });
        
        // Start timer for resend
        setResendTimer(30); // 30 seconds
        setCanResend(false);
      } else {
        setOtpError(data.message);
      }
    } catch (error) {
      setOtpError("Failed to send OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify OTP for email verification
  const handleVerifyOTP = async () => {
    if (!otp) {
      setOtpError("Please enter the OTP");
      return;
    }

    setVerifyLoading(true);
    setOtpError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          email: formData.email,
          otp: otp 
        }),
      });

      const data = await res.json();

      if (data.success) {
        setEmailVerified(true);
        toast.success("Email verified successfully!");
        setOtpSent(false);
        setOtp("");
        // Update validation message to show verification success
        setEmailValidation({ 
          loading: false, 
          message: "Email verified successfully!", 
          available: true 
        });
      } else {
        setOtpError(data.message);
      }
    } catch (error) {
      setOtpError("Failed to verify OTP. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  // Enhanced handleChange with validation
  const handleChangeWithValidation = (e) => {
    const { id, value } = e.target;
    
    setFormData({
      ...formData,
      [id]: value,
    });
    
    // Clear existing errors
    if (id === 'email') {
      setEmailError("");
    } else if (id === 'mobileNumber') {
      setMobileError("");
    }
    
    // Trigger validation
    if (id === 'email') {
      // If email is changed while in edit mode, reset verification state
      if (emailEditMode) {
        setEmailVerified(false);
        setOtpSent(false);
        setOtp("");
        setEmailEditMode(false);
      }
      debouncedEmailValidation(value);
    } else if (id === 'mobileNumber') {
      debouncedMobileValidation(value);
    }
  };

  const onSubmitForm = async (e) => {
    e.preventDefault();
    setUpdateError("");
    setUpdateSuccess(false);
    setEmailError("");
    setMobileError("");
    
    // Check if email is provided
    if (!formData.email || !formData.email.trim()) {
      setEmailError("Please provide valid email id");
      return;
    }
    
    // Check validation status
    if (emailValidation.available === false) {
      setEmailError("Email already exists. Please use a different one.");
      return;
    }
    
    if (mobileValidation.available === false) {
      setMobileError("Mobile number already exists. Please use a different one.");
      return;
    }
    
    // Validate mobile number format
    if (!formData.mobileNumber || !/^[0-9]{10}$/.test(formData.mobileNumber)) {
      setMobileError("Please provide a valid 10-digit mobile number");
      return;
    }
    
    // Check if email needs verification (only if email changed)
    if (formData.email !== originalEmail && !emailVerified) {
      setEmailError("Please verify your new email with OTP before saving.");
      return;
    }
    
    // Show password modal for confirmation
    setShowUpdatePasswordModal(true);
  };

  const handleConfirmUpdate = async () => {
    setUpdatePasswordError("");
    if (!updatePassword) {
      setUpdatePasswordError("Password is required");
      return;
    }
    setLoading(true);
    try {
      dispatch(updateUserStart());
      const apiUrl = `${API_BASE_URL}/api/user/update/${currentUser._id}`;
      const options = createAuthenticatedFetchOptions({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          avatar: formData.avatar === undefined ? "" : formData.avatar,
          password: updatePassword,
        }),
      });
      const res = await fetch(apiUrl, options);
      const data = await res.json();
      console.log('Profile update response:', data); // Debug log
      // Handle new backend validation responses
      if (data.status === "email_exists") {
        toast.error("Email already registered. Please use a different one.");
        setEmailError("Email already registered. Please use a different one.");
        dispatch(updateUserFailure("Email already registered. Please use a different one."));
        setLoading(false);
        setShowUpdatePasswordModal(false);
        setUpdatePassword("");
        return;
      }
      if (data.status === "mobile_exists") {
        toast.error("Mobile number already in use. Please choose another one.");
        setMobileError("Mobile number already in use. Please choose another one.");
        dispatch(updateUserFailure("Mobile number already in use. Please choose another one."));
        setLoading(false);
        setShowUpdatePasswordModal(false);
        setUpdatePassword("");
        return;
      }
      if (data.status === "mobile_invalid") {
        setMobileError("Please provide a valid 10-digit mobile number");
        dispatch(updateUserFailure("Please provide a valid 10-digit mobile number"));
        setLoading(false);
        setShowUpdatePasswordModal(false);
        setUpdatePassword("");
        return;
      }
      if (data.status === "invalid_password") {
        setShowUpdatePasswordModal(false);
        setUpdatePassword("");
        setLoading(false);
        // Forced sign out for security
        toast.error("You have been signed out for security reasons. No changes were made to your profile.");
        dispatch(signoutUserStart());
        try {
          const signoutRes = await fetch(`${API_BASE_URL}/api/auth/signout`, { credentials: 'include' });
          const signoutData = await signoutRes.json();
          if (signoutData.success === false) {
            dispatch(signoutUserFailure(signoutData.message));
          } else {
            dispatch(signoutUserSuccess(signoutData));
            if (persistor && persistor.purge) await persistor.purge();
            reconnectSocket();
            localStorage.removeItem('accessToken');
            document.cookie = 'access_token=; Max-Age=0; path=/; domain=' + window.location.hostname + '; secure; samesite=None';
          }
        } catch (err) {
          dispatch(signoutUserFailure(err.message));
        }
        setTimeout(() => {
          navigate("/sign-in", { replace: true });
        }, 800);
        return;
      }
      if (data.status === "success") {
        // Ensure avatar is always a string (empty if deleted)
        // If mobile number changed, set isGeneratedMobile to false
        const updatedUser = {
          ...data.updatedUser,
          avatar: data.updatedUser.avatar || "",
          isGeneratedMobile: (data.updatedUser.mobileNumber && data.updatedUser.mobileNumber !== originalMobile)
            ? false
            : data.updatedUser.isGeneratedMobile
        };
        dispatch(updateUserSuccess(updatedUser));
        if (data.updatedUser.mobileNumber && data.updatedUser.mobileNumber !== originalMobile) {
          setOriginalMobile(data.updatedUser.mobileNumber);
        }
        
        // Emit socket event to notify other users about profile update
        console.log('[Profile] Emitting profileUpdated socket event:', {
          userId: updatedUser._id,
          username: updatedUser.username,
          avatar: updatedUser.avatar,
          mobileNumber: updatedUser.mobileNumber,
          email: updatedUser.email
        });
        console.log('[Profile] Socket connected:', socket.connected);
        console.log('[Profile] Socket ID:', socket.id);
        
        // Add acknowledgment callback to see if event is sent successfully
        socket.emit('profileUpdated', {
          userId: updatedUser._id,
          username: updatedUser.username,
          avatar: updatedUser.avatar,
          mobileNumber: updatedUser.mobileNumber,
          email: updatedUser.email
        }, (acknowledgment) => {
          console.log('[Profile] Socket event acknowledgment:', acknowledgment);
        });
        
        setUpdateSuccess(true);
        setIsEditing(false);
        setLoading(false);
        setShowUpdatePasswordModal(false);
        setUpdatePassword("");
        toast.success("Profile Updated Successfully!!");
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
        setShowUpdatePasswordModal(false);
        setUpdatePassword("");
        return;
      }
      // If we reach here, it means we got an unexpected response
      console.log('Unexpected response:', data);
      setUpdateError("Profile Update Failed!");
      setLoading(false);
      setShowUpdatePasswordModal(false);
      setUpdatePassword("");
    } catch (error) {
      console.log('Profile update error:', error); // Debug log
      setUpdateError("Profile Update Failed!");
      dispatch(updateUserFailure(error.message));
      setLoading(false);
      setShowUpdatePasswordModal(false);
      setUpdatePassword("");
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
      const apiUrl = `${API_BASE_URL}/api/user/delete/${currentUser._id}`;
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
        toast.error("For your security, you've been signed out automatically.");
        // Signout and redirect
        dispatch(signoutUserStart());
        const signoutRes = await fetch(`${API_BASE_URL}/api/auth/signout`, { credentials: 'include' });
        const signoutData = await signoutRes.json();
        if (signoutData.success === false) {
          dispatch(signoutUserFailure(signoutData.message));
        } else {
          dispatch(signoutUserSuccess(signoutData));
        }
        navigate('/sign-in', { replace: true });
        return;
      }
      if (data.message && data.message.toLowerCase().includes('password')) {
        setShowPasswordModal(false);
        toast.error("For your security, you've been signed out automatically.");
        // Signout and redirect
        dispatch(signoutUserStart());
        const signoutRes = await fetch(`${API_BASE_URL}/api/auth/signout`, { credentials: 'include' });
        const signoutData = await signoutRes.json();
        if (signoutData.success === false) {
          dispatch(signoutUserFailure(signoutData.message));
        } else {
          dispatch(signoutUserSuccess(signoutData));
        }
        navigate('/sign-in', { replace: true });
        return;
      }
      if (data.success === false || res.status !== 200) {
        setDeleteError(data.message || "Account deletion failed");
        dispatch(deleteUserFailure(data.message));
        return;
      }
      dispatch(deleteUserSuccess(data));
      setShowPasswordModal(false);
      toast.success("Account deleted successfully. Thank you for being with us — we hope to serve you again in the future!");
      navigate('/');
    } catch (error) {
      setDeleteError("Account deletion failed");
      dispatch(deleteUserFailure(error.message));
    }
  };

  const fetchAdmins = async () => {
    try {
      setLoadingAdmins(true);
      const res = await fetch(`${API_BASE_URL}/api/user/approved-admins/${currentUser._id}`, {
        credentials: 'include'
      });
      const data = await res.json();
      
      if (res.ok) {
        setAdmins(data);
      } else {
        toast.error(data.message || 'Failed to fetch admins');
      }
    } catch (error) {
      toast.error('Error fetching admins');
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleTransferAndDelete = async () => {
    if (!selectedAdmin) {
      toast.error('Please select an admin to transfer default admin rights to');
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
      const verifyRes = await fetch(`${API_BASE_URL}/api/user/verify-password/${currentUser._id}`, {
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
        toast.error("Your session has expired. Please sign in again. No admin rights are Transferred");
        // Signout and redirect
        dispatch(signoutUserStart());
        const signoutRes = await fetch(`${API_BASE_URL}/api/auth/signout`, { credentials: 'include' });
        const signoutData = await signoutRes.json();
        if (signoutData.success === false) {
          dispatch(signoutUserFailure(signoutData.message));
        } else {
          dispatch(signoutUserSuccess(signoutData));
        }
        navigate('/sign-in', { replace: true });
        return;
      }
      
      // Check if password verification failed
      if (!verifyRes.ok || verifyData.success === false) {
        setShowTransferPasswordModal(false);
        toast.error("For your security, you've been signed out automatically.");
        // Signout and redirect
        dispatch(signoutUserStart());
        const signoutRes = await fetch(`${API_BASE_URL}/api/auth/signout`, { credentials: 'include' });
        const signoutData = await signoutRes.json();
        if (signoutData.success === false) {
          dispatch(signoutUserFailure(signoutData.message));
        } else {
          dispatch(signoutUserSuccess(signoutData));
        }
        navigate('/sign-in', { replace: true });
        return;
      }
      
      // Password is correct, now transfer default admin rights
      const transferRes = await fetch(`${API_BASE_URL}/api/user/transfer-default-admin`, {
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
        toast.error(transferData.message || 'Failed to transfer default admin rights');
        return;
      }

      // Now delete the account (user is no longer default admin)
      const deleteRes = await fetch(`${API_BASE_URL}/api/user/delete/${currentUser._id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: transferDeletePassword })
      });
      const deleteData = await deleteRes.json();
      if (!deleteRes.ok) {
        toast.error(deleteData.message || 'Failed to delete account after transfer');
        return;
      }
      
      // Both transfer and deletion successful
      dispatch(deleteUserSuccess(deleteData));
      setShowAdminModal(false);
      setShowTransferPasswordModal(false);
      toast.success("Admin rights are transferred and account deleted successfully!");
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
      const res = await fetch(`${API_BASE_URL}/api/auth/signout`, { credentials: 'include' });
      const data = await res.json();
      if (data.success === false) {
        dispatch(signoutUserFailure(data.message));
      } else {
        dispatch(signoutUserSuccess(data));
        // Clear persisted state
        await persistor.purge();
        // Disconnect and reconnect socket to clear auth
        reconnectSocket();
        // Extra: Clear localStorage token if used
        localStorage.removeItem('accessToken');
        // Extra: Expire the access_token cookie on client side
        document.cookie = 'access_token=; Max-Age=0; path=/; domain=' + window.location.hostname + '; secure; samesite=None';
        toast.info("You have been signed out.");
        await new Promise(resolve => setTimeout(resolve, 50));
        navigate("/sign-in", { replace: true });
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
      const res = await fetch(`${API_BASE_URL}/api/admin/management/admins`, { credentials: 'include' });
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
      const res = await fetch(`${API_BASE_URL}/api/admin/transfer-rights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetAdminId: selectedTransferAdmin, password: transferPassword })
      });
      const data = await res.json();
      if (res.status === 401 && data.error === 'invalidPassword') {
        setShowTransferModal(false);
        toast.error("For your security, you've been signed out automatically.");
        dispatch(signoutUserStart());
        const signoutRes = await fetch(`${API_BASE_URL}/api/auth/signout`, { credentials: 'include' });
        const signoutData = await signoutRes.json();
        if (signoutData.success === false) {
          dispatch(signoutUserFailure(signoutData.message));
        } else {
          dispatch(signoutUserSuccess(signoutData));
        }
        navigate('/sign-in', { replace: true });
        return;
      }
      if (!res.ok) {
        setTransferError(data.message || 'Failed to transfer rights.');
        return;
      }
      toast.success(data.message || 'Admin rights transferred successfully!');
      setShowTransferModal(false);
      navigate('/sign-in', { replace: true });
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
        avatar: currentUser.avatar || "",
      });
      
      // Trigger validation for current values
      if (currentUser.email) {
        validateEmail(currentUser.email);
      }
      if (currentUser.mobileNumber) {
        validateMobile(currentUser.mobileNumber);
      }
    }
  }, [isEditing, currentUser]);

  useEffect(() => {
    // Fetch latest user data on mount if logged in
    async function fetchLatestUser() {
      if (currentUser && currentUser._id) {
        try {
          console.log("[fetchLatestUser] Fetching user data for:", currentUser._id);
          const res = await fetch(`${API_BASE_URL}/api/user/id/${currentUser._id}`);
          if (res.ok) {
            const user = await res.json();
            console.log("[fetchLatestUser] Got user:", user);
            dispatch({ type: 'user/signInSuccess', payload: user });
          } else {
            console.error("[fetchLatestUser] Failed to fetch user");
          }
        } catch (err) {
          console.error("[fetchLatestUser] Error:", err);
        }
      }
    }
    fetchLatestUser();
  }, []);

  // Fallback render if profile data is missing or incomplete
  if (!currentUser || !currentUser.username || !currentUser.email) {
    return <div className="text-center text-red-600 mt-10">Profile data is missing or could not be loaded. Please refresh or sign in again.</div>;
  }
  // Loader: Only show full-page spinner if not editing
  if (loading && !isEditing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-100">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 mx-auto"></div>
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent absolute top-0 left-1/2 transform -translate-x-1/2"></div>
            <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${animationClasses.pulse}`}>
              <FaUser className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className={`mt-4 text-gray-600 font-medium ${animationClasses.pulse}`}>Loading profile...</p>
          <div className="flex justify-center mt-2 space-x-1">
            <div className={`w-2 h-2 bg-blue-600 rounded-full ${animationClasses.bounce} animation-delay-0`}></div>
            <div className={`w-2 h-2 bg-blue-600 rounded-full ${animationClasses.bounce} animation-delay-150`}></div>
            <div className={`w-2 h-2 bg-blue-600 rounded-full ${animationClasses.bounce} animation-delay-300`}></div>
          </div>
        </div>
      </div>
    );
  }

  // Failsafe: if in edit mode and loading, reset loading
  useEffect(() => {
    if (isEditing && loading) {
      setLoading(false);
    }
  }, [isEditing, loading]);

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormData(prev => ({ ...prev, avatar: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const [dicebearAvatar, setDicebearAvatar] = useState({
    style: 'avataaars',
    filters: {},
  });

  const buildDicebearUrl = () => {
    const base = `https://api.dicebear.com/9.x/${dicebearAvatar.style}/svg`;
    const params = Object.entries(dicebearAvatar.filters)
      .filter(([k, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0))
      .map(([k, v]) => {
        if (Array.isArray(v)) return `${k}=${v.join(',')}`;
        if (typeof v === 'boolean') return `${k}=${v}`;
        return `${k}=${encodeURIComponent(v)}`;
      })
      .join('&');
    return params ? `${base}?${params}` : base;
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen py-10 px-2 md:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className={`bg-white rounded-xl shadow-lg p-8 mb-6 ${isVisible ? animationClasses.fadeInUp : 'opacity-0 translate-y-8'}`}>
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex flex-col sm:flex-row items-center sm:space-x-6 w-full text-center sm:text-left mb-4 md:mb-0">
              <div className={`relative flex-shrink-0 mx-auto sm:mx-0 group ${isVisible ? animationClasses.scaleIn + ' animation-delay-150' : 'opacity-0 scale-95'}`}>
                <div className="transform transition-all duration-300 group-hover:scale-110">
                  <UserAvatar 
                    user={currentUser} 
                    size="h-24 w-24" 
                    textSize="text-2xl"
                  />
                </div>
                {currentUser.role === 'admin' && (
                  <div className={`absolute -top-2 -right-2 bg-purple-500 text-white rounded-full p-2 ${animationClasses.bounceIn} animation-delay-300 ${animationClasses.float}`}>
                    <FaCrown className="w-4 h-4" />
                  </div>
                )}
                {currentUser.isDefaultAdmin && (
                  <div className={`absolute -bottom-2 -right-2 bg-red-500 text-white rounded-full p-2 ${animationClasses.bounceIn} animation-delay-450 ${animationClasses.pulse}`}>
                    <FaCrown className="w-3 h-3" />
                  </div>
                )}
              </div>
              <div className={`mt-4 sm:mt-0 w-full ${isVisible ? animationClasses.fadeInLeft + ' animation-delay-300' : 'opacity-0 -translate-x-8'}`}>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex flex-wrap items-center justify-center sm:justify-start">
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {currentUser.username}
                  </span>
                  {currentUser.role === 'admin' && (
                    <span className="ml-2 bg-purple-100 text-purple-800 text-sm px-3 py-1 rounded-full font-medium transform transition-all duration-300 hover:scale-110 hover:bg-purple-200">
                      Admin
                    </span>
                  )}
                  {currentUser.isDefaultAdmin && (
                    <span className="ml-2 bg-red-100 text-red-800 text-sm px-3 py-1 rounded-full font-medium transform transition-all duration-300 hover:scale-110 hover:bg-red-200 animate-pulse">
                      Default Admin
                    </span>
                  )}
                </h1>
                <p className="text-gray-600 flex flex-wrap items-center justify-center sm:justify-start break-all transition-all duration-300 hover:text-blue-600">
                  <FaEnvelope className="w-4 h-4 mr-2 transform transition-all duration-300 hover:scale-125" />
                  {currentUser.email}
                </p>
                <p className="text-gray-600 flex flex-wrap items-center justify-center sm:justify-start break-all transition-all duration-300 hover:text-green-600">
                  <FaPhone className="w-4 h-4 mr-2 transform transition-all duration-300 hover:scale-125" />
                  {currentUser.mobileNumber && currentUser.mobileNumber !== "0000000000" 
                    ? `+91 ${currentUser.mobileNumber.slice(0, 5)} ${currentUser.mobileNumber.slice(5)}`
                    : "Mobile number not provided"
                  }
                  {currentUser.isGeneratedMobile && (
                    <span className="text-xs text-gray-400 ml-2">(Generated for Google signup)</span>
                  )}
                </p>
                <p className="text-sm text-gray-500 text-center sm:text-left mt-1 transition-all duration-300 hover:text-gray-700">
                  Member since {formatDate(currentUser.createdAt)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 hover:rotate-1 shadow-lg font-semibold flex items-center gap-1 sm:gap-2 text-sm sm:text-base w-full sm:w-auto justify-center group ${isVisible ? animationClasses.fadeInRight + ' animation-delay-450' : 'opacity-0 translate-x-8'}`}
            >
              <FaEdit className={`w-4 h-4 transition-transform duration-300 ${isEditing ? 'rotate-180' : ''} group-hover:${animationClasses.wiggle}`} />
              {isEditing ? 'Cancel Edit' : 'Edit Profile'}
            </button>
          </div>
        </div>

        {/* Edit Profile Form - show below profile card, push stats down when editing */}
        {isEditing && (
          <div className={`bg-white rounded-xl shadow-lg p-8 mb-6 ${animationClasses.slideInUp}`}>
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center group">
              <FaEdit className={`w-5 h-5 mr-2 text-blue-600 transition-transform duration-300 group-hover:${animationClasses.wiggle}`} />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Edit Profile Information
              </span>
            </h2>
            <form onSubmit={onSubmitForm} className="space-y-6">
              <div className="flex flex-col items-center mb-6">
                <div className="mb-2">
                  <UserAvatar 
                    user={{ ...currentUser, avatar: formData.avatar }} 
                    size="w-24 h-24" 
                    textSize="text-2xl"
                  />
                </div>
                {isEditing && (
                  <>
                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                      {defaultAvatars.map((url, idx) => (
                        <button 
                          key={url} 
                          type="button" 
                          onClick={() => setFormData({ ...formData, avatar: url })} 
                          className={`w-12 h-12 rounded-full border-2 transition-all duration-300 transform hover:scale-110 hover:shadow-lg ${formData.avatar === url ? 'border-blue-500 shadow-lg scale-105' : 'border-gray-300 hover:border-blue-400'} focus:outline-none focus:ring-2 focus:ring-blue-400 ${animationClasses.bounceIn} animation-delay-${idx * 50}`}
                        >
                          <img 
                            src={url} 
                            alt={`Avatar ${idx+1}`} 
                            className="w-full h-full rounded-full object-cover transition-all duration-300 hover:brightness-110" 
                          />
                        </button>
                      ))}
                      <label className={`w-12 h-12 rounded-full border-2 border-gray-300 flex items-center justify-center cursor-pointer bg-gray-100 hover:bg-gray-200 transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:border-blue-400 group ${animationClasses.bounceIn} animation-delay-${defaultAvatars.length * 50}`}>
                        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                        <FaEdit className={`text-gray-500 group-hover:text-blue-500 transition-colors duration-300 group-hover:${animationClasses.wiggle}`} />
                      </label>
                      <button 
                        type="button" 
                        onClick={() => setFormData({ ...formData, avatar: "" })} 
                        className={`w-12 h-12 rounded-full border-2 border-red-400 flex items-center justify-center bg-red-50 hover:bg-red-100 transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:border-red-500 group ${animationClasses.bounceIn} animation-delay-${(defaultAvatars.length + 1) * 50}`}
                      >
                        <FaTrash className={`text-red-500 group-hover:text-red-600 transition-colors duration-300 group-hover:${animationClasses.wiggle}`} />
                      </button>
                    </div>
                    {/* DiceBear Avatar Customization */}
                    <div className="mt-4 w-full flex flex-col items-center">
                      <div className="font-semibold text-gray-700 mb-2">Or create a custom DiceBear avatar:</div>
                      <div className="flex flex-col sm:flex-row gap-2 items-center w-full">
                        <label className="font-medium text-sm">Style:</label>
                        <select
                          className="border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                          value={dicebearAvatar.style}
                          onChange={e => {
                            setDicebearAvatar({ style: e.target.value, filters: {} });
                          }}
                        >
                          {dicebearStyles.map(style => (
                            <option key={style.key} value={style.key}>{style.label}</option>
                          ))}
                        </select>
                      </div>
                      {/* Render all filters from Avataaars schema as dropdowns/multiselects/inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 w-full max-w-2xl">
                        {/* Style and Seed as before */}
                        {allowedFilters.map(key => {
                          const prop = avataaarsSchema.properties[key];
                          if (!prop) return null;
                          if (key === 'style') return null;
                          if (key === 'seed') {
                            return (
                              <div key={key} className="flex flex-col mb-2">
                                <label className="text-xs font-medium mb-1">{key}</label>
                                <input
                                  type="text"
                                  className="border p-2 rounded-lg"
                                  value={dicebearAvatar.filters[key] || ''}
                                  onChange={e => setDicebearAvatar(prev => ({ ...prev, filters: { ...prev.filters, [key]: e.target.value } }))}
                                  placeholder="Enter a name or keyword (e.g. John, robot, flower...)"
                                />
                              </div>
                            );
                          }
                          return null;
                        })}
                        {/* Flip and Rotate side by side */}
                        <div className="flex items-end gap-6 mb-2">
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium">flip</label>
                            <input
                              type="checkbox"
                              checked={!!dicebearAvatar.filters.flip}
                              onChange={e => setDicebearAvatar(prev => ({ ...prev, filters: { ...prev.filters, flip: e.target.checked } }))}
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="text-xs font-medium mb-1">rotate</label>
                            <input
                              type="number"
                              className="border p-2 rounded-lg w-24"
                              value={dicebearAvatar.filters.rotate ?? avataaarsSchema.properties.rotate.default ?? ''}
                              min={avataaarsSchema.properties.rotate.minimum}
                              max={avataaarsSchema.properties.rotate.maximum}
                              onChange={e => setDicebearAvatar(prev => ({ ...prev, filters: { ...prev.filters, rotate: e.target.value === '' ? undefined : Number(e.target.value) } }))}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col items-center">
                        <img
                          src={buildDicebearUrl()}
                          alt="DiceBear Avatar Preview"
                          className="w-24 h-24 rounded-full border-2 border-blue-300 shadow"
                        />
                        <button
                          type="button"
                          className="mt-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all font-semibold"
                          onClick={async () => {
                            const url = buildDicebearUrl();
                            setFormData({ ...formData, avatar: url });
                            try {
                              const res = await fetch(`${API_BASE_URL}/api/user/${currentUser._id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ avatar: url }),
                              });
                              const data = await res.json();
                              if (data.status === 'success') {
                                toast.success('Avatar updated!');
                              } else if (data.status === 'error') {
                                toast.error(data.message || 'Failed to update avatar.');
                              }
                              // Do not show error for other status values
                            } catch (err) {
                              // Only show error toast if avatar did not update
                              toast.error('Failed to update avatar.');
                            }
                          }}
                        >
                          Use this avatar
                        </button>
                      </div>
                    </div>
                  </>
                )}
                <div className="text-xs text-gray-500 mt-2 text-center">Note: Please upload a profile image below 75KB only for best performance.</div>
              </div>
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
              onChange={handleChangeWithValidation}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <FaEnvelope className="w-4 h-4 mr-2" />
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      id="email"
                      placeholder="Enter email address"
                      value={formData.email || ''}
                      onChange={handleChangeWithValidation}
                      readOnly={emailVerified && formData.email !== originalEmail && !emailEditMode}
                      className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                        emailVerified && formData.email !== originalEmail && !emailEditMode
                          ? 'bg-gray-100 cursor-not-allowed border-green-500'
                          : emailValidation.available === false 
                          ? 'border-red-500 focus:ring-red-500' 
                          : emailValidation.available === true 
                          ? 'border-green-500 focus:ring-green-500' 
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
                    />
                    {emailValidation.loading && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                        </svg>
                      </div>
                    )}
                    {/* Show blue tick when email is available in DB but not yet verified */}
                    {emailValidation.available === true && !emailValidation.loading && !emailVerified && formData.email !== originalEmail && !emailEditMode && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600">
                        <FaCheck className="text-xl" />
                      </div>
                    )}
                    {/* Show Send OTP button only when email is available and not sent yet */}
                    {emailValidation.available === true && !emailValidation.loading && !otpSent && !emailVerified && formData.email !== originalEmail && !emailEditMode && (
                      <button
                        type="button"
                        onClick={handleSendOTP}
                        disabled={otpLoading || !canResend || !formData.email}
                        className="absolute right-12 top-1/2 transform -translate-y-1/2 px-3 py-1 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {otpLoading ? "Sending..." : "Send OTP"}
                      </button>
                    )}
                    {/* Show green tick and edit icon after successful email verification */}
                    {emailVerified && formData.email !== originalEmail && !emailEditMode && !emailValidation.loading && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEmailEditMode(true)}
                          className="text-blue-600 hover:text-blue-800 transition-colors duration-200 p-1 rounded hover:bg-blue-50"
                          title="Edit email"
                        >
                          <FaEdit className="text-sm" />
                        </button>
                        <div className="text-green-600">
                          <FaCheck className="text-xl" />
                        </div>
                      </div>
                    )}
                    {/* Show verification flow when in edit mode */}
                    {emailVerified && formData.email !== originalEmail && emailEditMode && !emailValidation.loading && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="text-green-600">
                          <FaCheck className="text-xl" />
                        </div>
                      </div>
                    )}
                    {/* Show red X when email is not available */}
                    {emailValidation.available === false && !emailValidation.loading && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <FaTimes className="h-5 w-5 text-red-500" />
                      </div>
                    )}
                  </div>
                  
                  {/* OTP sent message */}
                  {otpSent && !emailVerified && (
                    <p className="text-sm text-gray-600 mt-2">
                      OTP sent to {formData.email}
                    </p>
                  )}
                  
                  {/* OTP Verification Field */}
                  {otpSent && !emailVerified && (
                    <div className="mt-3">
                      <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                        Enter OTP
                      </label>
                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                        <input
                          type="text"
                          placeholder="Enter 6-digit OTP"
                          id="otp"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          maxLength="6"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyOTP}
                          disabled={verifyLoading || !otp}
                          className="w-full sm:w-auto px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                          {verifyLoading ? "Verifying..." : "Verify OTP"}
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-gray-500">
                          Enter the 6-digit code sent to your email
                        </p>
                        <div className="flex items-center gap-2">
                          {resendTimer > 0 ? (
                            <span className="text-xs text-gray-500">
                              Resend in {Math.floor(resendTimer / 60)}:{(resendTimer % 60).toString().padStart(2, '0')}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={handleSendOTP}
                              disabled={otpLoading}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {otpLoading ? "Sending..." : "Resend OTP"}
                            </button>
                          )}
                        </div>
                      </div>
                      {/* OTP Error Message */}
                      {otpError && (
                        <p className="text-red-500 text-sm mt-2">{otpError}</p>
                      )}
                    </div>
                  )}
                  
                  {emailError && (
                    <div className="text-red-600 text-sm mt-1">{emailError}</div>
                  )}
                  {emailValidation.message && !emailError && (
                    <div className={`text-sm mt-1 ${
                      emailValidation.available === true ? 'text-green-600' : 
                      emailValidation.available === false ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {emailValidation.message}
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <FaPhone className="w-4 h-4 mr-2" />
                    Mobile Number
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      id="mobileNumber"
                      placeholder="Enter 10-digit mobile number"
                      value={formData.mobileNumber || ''}
                      onChange={handleChangeWithValidation}
                      pattern="[0-9]{10}"
                      maxLength="10"
                      className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                        mobileValidation.available === false 
                          ? 'border-red-500 focus:ring-red-500' 
                          : mobileValidation.available === true 
                          ? 'border-green-500 focus:ring-green-500' 
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
                    />
                    {mobileValidation.loading && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                        </svg>
                      </div>
                    )}
                    {mobileValidation.available === true && !mobileValidation.loading && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <FaCheck className="h-5 w-5 text-green-500" />
                      </div>
                    )}
                    {mobileValidation.available === false && !mobileValidation.loading && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <FaTimes className="h-5 w-5 text-red-500" />
                      </div>
                    )}
                  </div>
                  {mobileError && (
                    <div className="text-red-600 text-sm mt-1">{mobileError}</div>
                  )}
                  {mobileValidation.message && !mobileError && (
                    <div className={`text-sm mt-1 ${
                      mobileValidation.available === true ? 'text-green-600' : 
                      mobileValidation.available === false ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {mobileValidation.message}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    // Reset OTP states when cancelling edit
                    setEmailVerified(false);
                    setOtpSent(false);
                    setOtp("");
                    setOtpError("");
                    setResendTimer(0);
                    setCanResend(true);
                  }}
                  className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-6 py-3 rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 ${
                    loading || 
                    emailValidation.loading || 
                    mobileValidation.loading || 
                    emailValidation.available === false || 
                    mobileValidation.available === false ||
                    (formData.email !== originalEmail && !emailVerified)
                      ? 'opacity-60 cursor-not-allowed transform-none' : ''
                  }`}
                  disabled={
                    loading || 
                    emailValidation.loading || 
                    mobileValidation.loading || 
                    emailValidation.available === false || 
                    mobileValidation.available === false ||
                    (formData.email !== originalEmail && !emailVerified)
                  }
                >
                  {loading ? (
                    <span className="flex items-center gap-2"><svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>Saving...</span>
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

        {/* Stats Section - show below profile card if not editing, below edit form if editing */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className={`bg-white rounded-xl shadow-lg p-6 text-center group hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-2 ${isVisible ? animationClasses.scaleIn + ' animation-delay-450' : 'opacity-0 scale-95'}`}>
            <div className={`bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200 transition-all duration-300 ${animationClasses.float} group-hover:scale-110`}>
              <FaHome className="w-6 h-6 text-blue-600 group-hover:text-blue-700 transition-colors duration-300" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors duration-300">
              {statsAnimated ? <AnimatedCounter end={userStats.listings} delay={500} /> : userStats.listings}
            </h3>
            <p className="text-gray-600 group-hover:text-blue-500 transition-colors duration-300">My Listings</p>
          </div>
          <div className={`bg-white rounded-xl shadow-lg p-6 text-center group hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-2 ${isVisible ? animationClasses.scaleIn + ' animation-delay-600' : 'opacity-0 scale-95'}`}>
            <div className={`bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-green-200 transition-all duration-300 ${animationClasses.float} group-hover:scale-110`}>
              <FaCalendarAlt className="w-6 h-6 text-green-600 group-hover:text-green-700 transition-colors duration-300" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 group-hover:text-green-600 transition-colors duration-300">
              {statsAnimated ? <AnimatedCounter end={userStats.appointments} delay={650} /> : userStats.appointments}
            </h3>
            <p className="text-gray-600 group-hover:text-green-500 transition-colors duration-300">Appointments</p>
          </div>
          <div className={`bg-white rounded-xl shadow-lg p-6 text-center group hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-2 ${isVisible ? animationClasses.scaleIn + ' animation-delay-750' : 'opacity-0 scale-95'}`}>
            <div className={`bg-red-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-red-200 transition-all duration-300 ${animationClasses.heartbeat} group-hover:scale-110`}>
              <FaHeart className="w-6 h-6 text-red-600 group-hover:text-red-700 transition-colors duration-300" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 group-hover:text-red-600 transition-colors duration-300">
              {statsAnimated ? <AnimatedCounter end={userStats.wishlist} delay={800} /> : userStats.wishlist}
            </h3>
            <p className="text-gray-600 group-hover:text-red-500 transition-colors duration-300">Wishlist Items</p>
          </div>
        </div>

        {/* Quick Actions Section */}
        <div className={`bg-white rounded-xl shadow-lg p-8 mb-6 ${isVisible ? animationClasses.fadeInUp + ' animation-delay-300' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Quick Actions
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={handleShowListings}
              className={`bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-450`}
            >
              <FaHome className={`w-5 h-5 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
              <span className="font-medium text-sm">My Listings</span>
            </button>
            
            <Link
              to={(currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? "/admin/appointments" : "/user/my-appointments"}
              className={`bg-green-500 text-white p-3 rounded-lg hover:bg-green-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-600`}
            >
              <FaCalendarAlt className={`w-5 h-5 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
              <span className="font-medium text-sm">{(currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? 'Appointments' : 'My Appointments'}</span>
            </Link>
            
            <Link
              to={(currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? "/admin/wishlist" : "/user/wishlist"}
              className={`bg-red-500 text-white p-3 rounded-lg hover:bg-red-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-750`}
            >
              <FaHeart className={`w-5 h-5 mb-1 transition-transform duration-300 group-hover:${animationClasses.heartbeat}`} />
              <span className="font-medium text-sm">My Wishlist</span>
            </Link>
            
            <Link
              to={(currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? "/admin/reviews" : "/user/reviews"}
              className={`bg-yellow-500 text-white p-3 rounded-lg hover:bg-yellow-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-900`}
            >
              <FaStar className={`w-5 h-5 mb-1 transition-transform duration-300 group-hover:${animationClasses.pulse}`} />
              <span className="font-medium text-sm">{(currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? 'Reviews' : 'My Reviews'}</span>
            </Link>
          </div>
        </div>

        {/* Account Management Section */}
        <div className={`bg-white rounded-xl shadow-lg p-8 ${isVisible ? animationClasses.fadeInUp + ' animation-delay-600' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Account Management
            </span>
          </h2>
          
          <div className="space-y-4">
            <button
              onClick={() => navigate((currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? '/admin/change-password' : '/user/change-password')}
              className={`w-full bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp} animation-delay-750`}
            >
              <FaKey className={`w-4 h-4 mr-2 transition-transform duration-300 group-hover:${animationClasses.wiggle}`} />
              Change Password
            </button>
            
            {(currentUser.role === 'admin' || currentUser.role === 'rootadmin') && (
              <button
                onClick={() => navigate('/admin/management')}
                className={`w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp} animation-delay-900`}
              >
                <span className="group-hover:animate-pulse">Accounts</span>
              </button>
            )}
              
            {currentUser.isDefaultAdmin && (
              <button
                onClick={onShowTransferModal}
                className={`w-full bg-yellow-500 text-white px-6 py-3 rounded-lg hover:bg-yellow-600 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp} animation-delay-1050`}
              >
                <FaCrown className={`w-4 h-4 mr-2 transition-transform duration-300 group-hover:${animationClasses.bounce} text-yellow-200`} />
                Transfer Rights
              </button>
            )}
            
            {/* Note for default admin about account deletion */}
            {currentUser.isDefaultAdmin && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-4 w-4 text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-2">
                    <p className="text-sm text-blue-700">
                      <strong>Note:</strong> You must transfer your default admin rights to another admin before you can delete your account.
                    </p>
                  </div>
                </div>
              </div>
            )}
              
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={onHandleSignout}
                className={`bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp} animation-delay-1200`}
              >
                <FaSignOutAlt className={`w-4 h-4 mr-2 transition-transform duration-300 group-hover:-translate-x-1`} />
                Sign Out
              </button>
              
              <button
                onClick={onHandleDelete}
                className={`bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp} animation-delay-1350`}
              >
                <FaTrash className={`w-4 h-4 mr-2 transition-transform duration-300 group-hover:${animationClasses.wiggle}`} />
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Selection Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.3s_ease-out]">
          <div className={`bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto ${animationClasses.scaleIn}`}>
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
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.3s_ease-out]">
          <div className={`bg-white rounded-xl shadow-xl max-w-md w-full ${animationClasses.scaleIn}`}>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Confirm Account Deletion</h3>
              <p className="mb-4 text-gray-600">Please enter your password to confirm account deletion. This action cannot be undone.</p>
              <form onSubmit={e => { e.preventDefault(); handleConfirmDelete(); }}>
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
                    type="button"
                    onClick={() => { setShowPasswordModal(false); setDeletePassword(""); setDeleteError(""); }}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                  >Cancel</button>
                  <button
                    type="submit"
                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                  >Delete</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showTransferPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.3s_ease-out]">
          <div className={`bg-white rounded-xl shadow-xl max-w-md w-full ${animationClasses.scaleIn}`}>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Confirm Account Deletion</h3>
              <p className="mb-4 text-gray-600">Please enter your password to confirm account deletion after transferring default admin rights. This action cannot be undone.</p>
              <form onSubmit={e => { e.preventDefault(); handleConfirmTransferAndDelete(); }}>
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
                    type="button"
                    onClick={() => { setShowTransferPasswordModal(false); setTransferDeletePassword(""); setTransferDeleteError(""); }}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                  >Cancel</button>
                  <button
                    type="submit"
                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                    disabled={transferLoading}
                  >{transferLoading ? 'Processing...' : 'Transfer & Delete'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Update Profile Password Modal */}
      {showUpdatePasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.3s_ease-out]">
          <div className={`bg-white rounded-xl shadow-xl max-w-md w-full ${animationClasses.scaleIn}`}>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Confirm Profile Update</h3>
              <p className="mb-4 text-gray-600">Please enter your password to confirm the profile changes.</p>
              <input
                type="password"
                className="w-full p-3 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your password"
                value={updatePassword}
                onChange={e => setUpdatePassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleConfirmUpdate(); } }}
              />
              {updatePasswordError && <div className="text-red-600 text-sm mb-2">{updatePasswordError}</div>}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => { setShowUpdatePasswordModal(false); setUpdatePassword(""); setUpdatePasswordError(""); }}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >Cancel</button>
                <button
                  onClick={handleConfirmUpdate}
                  disabled={loading}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    'Update Profile'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Rights Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.3s_ease-out]">
          <div className={`bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto ${animationClasses.scaleIn}`}>
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
                <form onSubmit={e => { e.preventDefault(); handleTransferSubmit(); }}>
                  <input
                    type="password"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="Enter your password"
                    value={transferPassword}
                    onChange={e => setTransferPassword(e.target.value)}
                  />
                  {transferError && <div className="text-red-600 text-sm mt-2">{transferError}</div>}
                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowTransferModal(false)}
                      className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                    >Cancel</button>
                    <button
                      type="submit"
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
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Support Wrapper */}
      <ContactSupportWrapper />

      <div className="mt-8 flex flex-col items-center space-y-2 text-sm text-gray-600">
        {currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? (
          <>
            <Link
              to="/admin/terms"
              className="text-blue-600 hover:underline"
            >
              Admin Terms & Conditions
            </Link>
            <Link
              to="/admin/privacy"
              className="text-blue-600 hover:underline"
            >
              Admin Privacy Policy
            </Link>
          </>
        ) : (
          <>
            <Link
              to="/user/terms"
              className="text-blue-600 hover:underline"
            >
              User Terms & Conditions
            </Link>
            <Link
              to="/user/privacy"
              className="text-blue-600 hover:underline"
            >
              User Privacy Policy
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
