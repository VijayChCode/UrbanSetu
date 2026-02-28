import React, { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { isMobileDevice } from '../utils/mobileUtils';
import { FaEdit, FaUser, FaEnvelope, FaPhone, FaKey, FaTrash, FaSignOutAlt, FaHome, FaCalendarAlt, FaHeart, FaEye, FaCrown, FaTimes, FaCheck, FaStar, FaRoute, FaUserFriends, FaCreditCard, FaShieldAlt, FaTools, FaTruck, FaExclamationTriangle, FaCloudUploadAlt, FaClipboardList, FaMobileAlt, FaBookOpen, FaQuestionCircle, FaChartLine, FaInfoCircle, FaCog, FaFileContract, FaGavel, FaMoneyCheckAlt, FaUserTie, FaHeadset, FaMapSigns } from "react-icons/fa";
import UserAvatar from "../components/UserAvatar";
import EncryptedText from "../components/ui/EncryptedText";
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import SetuCoinCard from "../components/SetuCoins/SetuCoinCard";
import AdminCoinCard from "../components/SetuCoins/AdminCoinCard";
import CoinHistory from "../components/SetuCoins/CoinHistory";
import RecaptchaWidget from "../components/RecaptchaWidget";
import SocialSharePanel from "../components/SocialSharePanel";
import { authenticatedFetch, createAuthenticatedFetchOptions } from '../utils/csrf';
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

import { usePageTitle } from '../hooks/usePageTitle';
import { useSignout } from '../hooks/useSignout';
import { useSeasonalTheme } from "../hooks/useSeasonalTheme.jsx";
import ThemeDetailModal from "../components/ThemeDetailModal";

const THEME_DECORATIONS = {
  'santa-hat': { icon: '🎅', animate: 'animate-wiggle', size: 'text-2xl', pos: '-top-3 -right-2' },
  'party-hat': { icon: '🎉', animate: 'animate-wiggle', size: 'text-2xl', pos: '-top-4 -right-2' },
  'kite': { icon: '🪁', animate: 'animate-sway', size: 'text-2xl', pos: '-top-4 -right-3' },
  'flag': {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" className="w-full h-full rounded-sm shadow-sm overflow-hidden inline-block align-middle" style={{ width: '1.2em', height: '0.8em', verticalAlign: 'middle' }}>
        <path fill="#FF9933" d="M0 0h900v200H0z" />
        <path fill="#FFF" d="M0 200h900v200H0z" />
        <path fill="#138808" d="M0 400h900v200H0z" />
        <g transform="translate(450 300)">
          <circle r="92.5" fill="none" stroke="#000080" strokeWidth="15" />
          <circle r="16" fill="#000080" />
          <g id="d">
            <g id="c">
              <g id="b">
                <g id="a" fill="#000080">
                  <path d="M0-92.5L5.5-8.5l-11 0z" />
                </g>
                <use href="#a" transform="rotate(15)" />
              </g>
              <use href="#b" transform="rotate(30)" />
            </g>
            <use href="#c" transform="rotate(60)" />
          </g>
          <use href="#d" transform="rotate(120)" />
          <use href="#d" transform="rotate(240)" />
        </g>
      </svg>
    ),
    animate: 'animate-flag-wave',
    size: 'text-2xl',
    pos: '-top-3 -right-2'
  },
  'heart': { icon: '❤️', animate: 'animate-grow-shrink', size: 'text-xl', pos: '-top-3 -right-2' },
  'pumpkin': { icon: '🎃', animate: 'animate-bounce', size: 'text-xl', pos: '-top-3 -right-2' },
  'colors': { icon: '🎨', animate: 'animate-spin-slow', size: 'text-xl', pos: '-top-3 -right-2' },
  'mango': { icon: '🥭', animate: 'animate-wiggle-slow', size: 'text-xl', pos: '-top-3 -right-2' },
  'moon': { icon: '🌙', animate: 'animate-pulse', size: 'text-xl', pos: '-top-3 -right-2' },
  'bow': { icon: '🏹', animate: 'animate-pulse -rotate-45', size: 'text-xl', pos: '-top-3 -right-2' },
  'rakhi': { icon: '🧵', animate: 'animate-wiggle', size: 'text-xl', pos: '-top-3 -right-2' },
  'modak': { icon: '🥟', animate: 'animate-bounce', size: 'text-xl', pos: '-top-3 -right-2' },
  'flower': { icon: '🌺', animate: 'animate-spin', size: 'text-xl', pos: '-top-3 -right-2', style: { animationDuration: '8s' } },
  'marigold': { icon: '🌼', animate: 'animate-spin-slow', size: 'text-xl', pos: '-top-3 -right-2' },
  'diya': { icon: '🪔', animate: 'animate-flicker', size: 'text-2xl', pos: '-top-3 -right-2' },
  'snow-cap': { icon: '❄️', animate: 'animate-spin-slow', size: 'text-xl', pos: '-top-3 -right-2' },
  'clover': { icon: '☘️', animate: 'animate-wiggle', size: 'text-xl', pos: '-top-3 -right-2' },
  'leaf': { icon: '🌱', animate: 'animate-grow-shrink', size: 'text-xl', pos: '-top-3 -right-2' },
  'glasses': { icon: '👓', animate: 'animate-wiggle-slow', size: 'text-xl', pos: '-top-3 -right-2' },
  'turkey': { icon: '🦃', animate: 'animate-bounce', size: 'text-xl', pos: '-top-3 -right-2' },
  'dragon': { icon: '🐉', animate: 'animate-sway', size: 'text-xl', pos: '-top-3 -right-2' },
  'trident': { icon: '🔱', animate: 'animate-pulse', size: 'text-xl', pos: '-top-3 -right-2' },
  'mace': { icon: '🙏', animate: 'animate-wiggle', size: 'text-xl', pos: '-top-3 -right-2' },
  'cross': { icon: '✝️', animate: 'animate-pulse', size: 'text-xl', pos: '-top-3 -right-2' },
  'egg': { icon: '🥚', animate: 'animate-bounce', size: 'text-xl', pos: '-top-3 -right-2' },
  'lantern': { icon: '🕌', animate: 'animate-flicker', size: 'text-xl', pos: '-top-3 -right-2' },
  'chariot': { icon: '🎡', animate: 'animate-spin-slow', size: 'text-xl', pos: '-top-3 -right-2' },
  'flute': { icon: '🪈', animate: 'animate-wiggle', size: 'text-xl', pos: '-top-3 -right-2' },
  'torch': { icon: '🔥', animate: 'animate-flicker', size: 'text-2xl', pos: '-top-3 -right-2' },
  'atom': { icon: '⚛️', animate: 'animate-spin-slow', size: 'text-xl', pos: '-top-3 -right-2' },
  'lotus': { icon: '🪷', animate: 'animate-grow-shrink', size: 'text-xl', pos: '-top-3 -right-2' },
  'book': { icon: '📚', animate: 'animate-wiggle-slow', size: 'text-xl', pos: '-top-3 -right-2' },
  'balloon': { icon: '🎈', animate: 'animate-fly', size: 'text-2xl', pos: '-top-3 -right-2' },
  'building': { icon: '🏗️', animate: '', size: 'text-xl', pos: '-top-3 -right-2' },
  'rocket': { icon: '🚀', animate: 'animate-fly', size: 'text-2xl', pos: '-top-3 -right-2' },
  'bonfire': { icon: '🔥', animate: 'animate-flicker', size: 'text-2xl', pos: '-top-3 -right-2' },
  'peace': { icon: '☮️', animate: 'animate-spin-slow', size: 'text-xl', pos: '-top-3 -right-2' },
  'harvest': { icon: '🌾', animate: 'animate-sway', size: 'text-xl', pos: '-top-3 -right-2' },
  'tie': { icon: '👔', animate: '', size: 'text-xl', pos: '-top-3 -right-2' },
  'khanda': { icon: '☬', animate: 'animate-pulse', size: 'text-xl', pos: '-top-3 -right-2' },
  'gudi': { icon: '🪁', animate: 'animate-sway', size: 'text-2xl', pos: '-top-4 -right-3' },
  'sun': { icon: '☀️', animate: 'animate-spin-slow', size: 'text-xl', pos: '-top-3 -right-2' },
  'venus': { icon: '♀️', animate: 'animate-pulse', size: 'text-xl', pos: '-top-3 -right-2' },
};
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
  const theme = useSeasonalTheme();
  // Set page title
  usePageTitle("My Profile - Account Settings");

  const { currentUser, error } = useSelector((state) => state.user);

  const { wishlist } = useWishlist();
  const { signout, isSigningOut } = useSignout();
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({ avatar: currentUser?.avatar || "" });
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [userStats, setUserStats] = useState({
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
  const [emailError, setEmailError] = useState("");
  const [mobileError, setMobileError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showUpdatePasswordModal, setShowUpdatePasswordModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const updatePasswordRef = useRef(null);
  const [updatePassword, setUpdatePassword] = useState("");
  const [updatePasswordError, setUpdatePasswordError] = useState("");

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

  // OTP field ref for focus
  const otpInputRef = useRef(null);

  // Timer states for resend OTP
  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(true);

  // Profile email OTP reCAPTCHA states
  const [profileRecaptchaToken, setProfileRecaptchaToken] = useState(null);
  const [profileRecaptchaError, setProfileRecaptchaError] = useState("");
  const [showProfileRecaptcha, setShowProfileRecaptcha] = useState(false);
  const [profileRequiresCaptcha, setProfileRequiresCaptcha] = useState(false);
  const [profileRecaptchaKey, setProfileRecaptchaKey] = useState(0);
  const profileRecaptchaRef = useRef(null);

  // Animation states
  const [isVisible, setIsVisible] = useState(false);
  const [statsAnimated, setStatsAnimated] = useState(false);

  const navigate = useNavigate();
  const [showThemeInfo, setShowThemeInfo] = useState(false);

  // SetuCoins State
  const [coinData, setCoinData] = useState({ balance: 0, streak: 0, expiryDate: null, frozenCoins: 0, loading: true });
  const [showCoinHistory, setShowCoinHistory] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);

  // Handle mobile state updates
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Autofocus update password when modal opens (Desktop only)
  useEffect(() => {
    if (showUpdatePasswordModal && !isMobile && updatePasswordRef.current) {
      setTimeout(() => updatePasswordRef.current?.focus(), 100);
    }
  }, [showUpdatePasswordModal, isMobile]);

  // Fetch SetuCoins Balance
  useEffect(() => {
    const fetchCoins = async () => {
      if (!currentUser) return;
      try {
        // We use the authenticatedFetch helper if possible, or standard fetch
        const res = await authenticatedFetch(`${API_BASE_URL}/api/coins/balance`);
        const data = await res.json();
        if (data.success) {
          setCoinData({
            balance: data.setuCoinsBalance || 0,
            streak: data.currentStreak || 0,
            expiryDate: data.coinsExpiryDate || null,
            frozenCoins: data.frozenCoins || 0,
            loading: false
          });
        }
      } catch (e) {
        console.error("Error fetching SetuCoins:", e);
        setCoinData(prev => ({ ...prev, loading: false }));
      }
    };
    fetchCoins();
  }, [currentUser]);

  // Hide My Appointments button in admin context
  const isAdminProfile = window.location.pathname.startsWith('/admin');
  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin');
  const isProfileIncomplete = currentUser && currentUser.role === 'user' && (!currentUser.gender || !currentUser.address || !currentUser.mobileNumber);

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
      // Pre-fill form data with current user details
      setFormData(prev => ({
        ...prev,
        username: currentUser.username || "",
        email: currentUser.email || "",
        mobileNumber: currentUser.mobileNumber || "",
        avatar: currentUser.avatar || prev.avatar || ""
      }));

      // Set initial email validation state to show green tick for current email
      if (currentUser.email) {
        setEmailValidation({ loading: false, message: "", available: true });
      }

      // Set initial mobile validation state to show green tick for current mobile
      if (currentUser.mobileNumber) {
        setMobileValidation({ loading: false, message: "", available: true });
      }
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

  // Function to fetch watchlist count
  const fetchWatchlistCount = async () => {
    if (!currentUser?._id) return 0;
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/watchlist/user/${currentUser._id}`);
      if (res.ok) {
        const data = await res.json();
        return data.length || 0;
      }
    } catch (error) {
      console.error('Error fetching watchlist count:', error);
    }
    return 0;
  };

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

  // Listen for storage changes to update email/phone visibility
  const [storageUpdateTrigger, setStorageUpdateTrigger] = useState(0);
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'showEmail' || e.key === 'showPhone' || e.key === 'timezone') {
        setStorageUpdateTrigger(prev => prev + 1);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom events (for same-tab updates)
    const handleCustomStorageChange = () => {
      setStorageUpdateTrigger(prev => prev + 1);
    };
    window.addEventListener('settingsUpdated', handleCustomStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('settingsUpdated', handleCustomStorageChange);
    };
  }, []);

  const PROFILE_PASSWORD_ATTEMPT_KEY = 'profileUpdatePwAttempts';

  const fetchUserStats = async () => {
    try {
      if (!currentUser) return;

      const summaryRes = await authenticatedFetch(`${API_BASE_URL}/api/user/summary/${currentUser._id}`);
      const summaryData = await summaryRes.json();

      if (summaryRes.ok && summaryData.success) {
        setUserStats(summaryData.counts);
      } else {
        console.error('Failed to fetch user summary:', summaryData.message);
      }
    } catch (error) {
      console.error('[fetchUserStats] Error fetching user stats:', error);
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

  // Profile email OTP reCAPTCHA handlers
  const handleProfileRecaptchaVerify = (token) => {
    setProfileRecaptchaToken(token);
    setProfileRecaptchaError("");
    // Hide after a brief delay to show the tick
    setTimeout(() => setShowProfileRecaptcha(false), 1000);
  };

  const handleProfileRecaptchaExpire = () => {
    setProfileRecaptchaToken(null);
    setProfileRecaptchaError("reCAPTCHA expired. Please verify again.");
    setProfileRecaptchaKey((k) => k + 1);
    setShowProfileRecaptcha(true);
  };

  const handleProfileRecaptchaError = (error) => {
    setProfileRecaptchaToken(null);
    setProfileRecaptchaError("reCAPTCHA verification failed. Please try again.");
    setProfileRecaptchaKey((k) => k + 1);
    setShowProfileRecaptcha(true);
  };

  const resetProfileRecaptcha = () => {
    if (profileRecaptchaRef.current) {
      profileRecaptchaRef.current.reset();
    }
    setProfileRecaptchaToken(null);
    setProfileRecaptchaError("");
    setProfileRecaptchaKey((k) => k + 1);
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

    // Check if reCAPTCHA is required but not completed
    if (profileRequiresCaptcha && !profileRecaptchaToken) {
      setOtpError("Please complete the reCAPTCHA verification first");
      return;
    }

    setOtpLoading(true);
    setOtpError("");

    try {
      const requestBody = { email: formData.email.trim() };

      // Include reCAPTCHA token if required
      if (profileRequiresCaptcha && profileRecaptchaToken) {
        requestBody.recaptchaToken = profileRecaptchaToken;
      }

      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/send-profile-email-otp`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (data.success) {
        setOtpSent(true);
        toast.success("OTP sent successfully to your email");

        // Update validation message to show OTP sent status
        setEmailValidation({
          loading: false,

          available: true
        });

        // Reset reCAPTCHA after successful OTP send
        if (profileRequiresCaptcha) {
          resetProfileRecaptcha();
          setShowProfileRecaptcha(false);
          setProfileRequiresCaptcha(false);
        }

        // Start timer for resend
        setResendTimer(30); // 30 seconds
        setCanResend(false);

        // Focus on OTP field after a short delay
        setTimeout(() => {
          if (otpInputRef.current) {
            otpInputRef.current.focus();
          }
        }, 100);
      } else {
        // Handle reCAPTCHA requirements
        if (data.requiresCaptcha) {
          setProfileRequiresCaptcha(true);
          setShowProfileRecaptcha(true);
          setProfileRecaptchaError("reCAPTCHA verification is required due to multiple failed attempts or requests");
          // Avoid duplicate messaging in OTP error area
          setOtpError("");
        } else {
          setOtpError(data.message);
        }
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
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim(),
          otp: otp.trim()
        }),
      });

      const data = await res.json();

      if (data.success) {
        setEmailVerified(true);
        toast.success("Email verified successfully!");
        setOtpSent(false);
        setOtp("");
        setEmailEditMode(false); // Make field uneditable after verification
        // Update validation message to show verification success
        setEmailValidation({
          loading: false,
          message: "Email verified successfully!",
          available: true
        });
      } else {
        // Handle reCAPTCHA requirements
        if (data.requiresCaptcha) {
          setProfileRequiresCaptcha(true);
          setShowProfileRecaptcha(true);
          setProfileRecaptchaError("reCAPTCHA verification is required due to multiple failed attempts or requests");
          // Avoid duplicate messaging in OTP error area
          setOtpError("");
        } else {
          setOtpError(data.message);
        }
      }
    } catch (error) {
      setOtpError("Failed to verify OTP. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  // Enhanced handleChange with validation
  const handleChangeWithValidation = (e) => {
    const { id } = e.target;
    let { value } = e.target;

    // Ensure only digits for mobile number field
    if (id === 'mobileNumber') {
      value = value.replace(/[^0-9]/g, '');
    }

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
        // Don't set emailEditMode to false here - keep it editable
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
    localStorage.removeItem(PROFILE_PASSWORD_ATTEMPT_KEY);
    setUpdatePassword("");
    setUpdatePasswordError("");
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
      // Step 1: Verify password first
      const verifyRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/verify-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: updatePassword })
      });

      if (!verifyRes.ok) {
        let errorMsg = "Incorrect password";
        try {
          const errData = await verifyRes.json();
          if (errData.message) errorMsg = errData.message;
        } catch (e) { }

        // If status is NOT 401 (Unauthorized), it might be 400 (No password set) or 500 (Server Error)
        // In these cases, show the error but DO NOT increment the attempt counter or sign out the user.
        if (verifyRes.status !== 401) {
          setUpdatePasswordError(errorMsg);
          setLoading(false);
          return;
        }

        // Password verification failed (401 Unauthorized) only then we count attempts
        const previousAttempts = parseInt(localStorage.getItem(PROFILE_PASSWORD_ATTEMPT_KEY) || '0');
        const nextAttempts = previousAttempts + 1;
        localStorage.setItem(PROFILE_PASSWORD_ATTEMPT_KEY, String(nextAttempts));

        // Keep loading state during error handling, then set to false
        if (nextAttempts >= 3) {
          // Too many attempts - sign out (keep loading during signout process)
          localStorage.removeItem(PROFILE_PASSWORD_ATTEMPT_KEY);
          setShowUpdatePasswordModal(false);
          toast.error("Too many incorrect password attempts. You've been signed out for security.");
          dispatch(signoutUserStart());
          try {
            const signoutRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/signout`);
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
          setLoading(false);
          setTimeout(() => {
            navigate("/sign-in", { replace: true });
          }, 800);
          return;
        } else {
          // Show remaining attempts - keep modal open
          const remaining = 3 - nextAttempts;
          const attemptText = remaining === 1 ? 'attempt' : 'attempts';
          setUpdatePasswordError(`Incorrect password. ${remaining} ${attemptText} remaining.`);
          toast.error(`Incorrect password. ${remaining} ${attemptText} left.`);
          setLoading(false);
        }
        setUpdatePassword("");
        return;
      }

      // Step 2: Password verified - proceed with profile update
      dispatch(updateUserStart());
      const apiUrl = `${API_BASE_URL}/api/user/update/${currentUser._id}`;
      const res = await authenticatedFetch(apiUrl, {
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
      const data = await res.json();

      // Handle backend validation responses
      if (data.status === "email_exists") {
        toast.error("Email already registered. Please use a different one.");
        setEmailError("Email already registered. Please use a different one.");
        dispatch(updateUserFailure("Email already registered. Please use a different one."));
        setLoading(false);
        setUpdatePassword("");
        setUpdatePasswordError("Email already exists. Please change your email and try again.");
        // Keep modal open for retry
        return;
      }
      if (data.status === "mobile_exists") {
        toast.error("Mobile number already in use. Please choose another one.");
        setMobileError("Mobile number already in use. Please choose another one.");
        dispatch(updateUserFailure("Mobile number already in use. Please choose another one."));
        setLoading(false);
        setUpdatePassword("");
        setUpdatePasswordError("Mobile already exists. Please change your mobile number and try again.");
        // Keep modal open for retry
        return;
      }
      if (data.status === "mobile_invalid") {
        setMobileError("Please provide a valid 10-digit mobile number");
        dispatch(updateUserFailure("Please provide a valid 10-digit mobile number"));
        setLoading(false);
        setUpdatePassword("");
        setUpdatePasswordError("Invalid mobile number. Please fix and try again.");
        // Keep modal open for retry
        return;
      }
      if (data.status === "success") {
        // Ensure avatar is always a string (empty if deleted)
        // If mobile number changed, set isGeneratedMobile to false
        localStorage.removeItem(PROFILE_PASSWORD_ATTEMPT_KEY);

        // Check for profile completion bonus (20 SetuCoins)
        if (data.updatedUser?.gamification?.hasReceivedProfileCompletionBonus && !currentUser?.gamification?.hasReceivedProfileCompletionBonus) {
          toast.success("🎉 Congratulations! You earned 20 SetuCoins for completing your profile!");
        }

        // Trigger transaction history refresh
        setHistoryRefreshTrigger(prev => prev + 1);

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

        // Add acknowledgment callback to see if event is sent successfully
        socket.emit('profileUpdated', {
          userId: updatedUser._id,
          username: updatedUser.username,
          avatar: updatedUser.avatar,
          mobileNumber: updatedUser.mobileNumber,
          email: updatedUser.email
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
        const message = data.message || "Profile Update Failed!";
        setUpdateError(message);
        dispatch(updateUserFailure(message));
        setLoading(false);
        setUpdatePasswordError(message);
        setUpdatePassword("");
        // Keep modal open to allow retry
        return;
      }
      // If we reach here, it means we got an unexpected response
      setUpdateError("Profile Update Failed!");
      setUpdatePasswordError("Profile Update Failed!");
      setLoading(false);
      setUpdatePassword("");
      // Keep modal open for retry
      return;
    } catch (error) {

      setUpdateError("Profile Update Failed!");
      dispatch(updateUserFailure(error.message));
      setLoading(false);
      setUpdatePasswordError(error.message || "Network error");
      setUpdatePassword("");
      // Keep modal open for retry
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
    // Ensure we depend on storageUpdateTrigger (implied by component re-render)
    const _ = storageUpdateTrigger;
    const timezone = localStorage.getItem('timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: timezone
      });
    } catch (e) {
      // Fallback in case of invalid timezone
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  // Add this useEffect to initialize formData when entering edit mode
  useEffect(() => {
    if (isEditing && currentUser) {
      setFormData({
        username: currentUser.username || '',
        email: currentUser.email || '',
        mobileNumber: currentUser.mobileNumber ? String(currentUser.mobileNumber) : '',
        address: currentUser.address || '',
        gender: currentUser.gender || '',
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

          const res = await authenticatedFetch(`${API_BASE_URL}/api/user/id/${currentUser._id}`);
          if (res.ok) {
            const user = await res.json();

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

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select an image file');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('File size must be less than 5MB');
      return;
    }

    setUploadingAvatar(true);
    setAvatarError('');

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('image', file);

      const res = await authenticatedFetch(`${API_BASE_URL}/api/upload/image`, {
        method: 'POST',
        body: uploadFormData,
      });

      const data = await res.json();

      if (res.ok) {
        // Update the avatar with the uploaded image URL
        setFormData(prev => ({ ...prev, avatar: data.imageUrl }));
        toast.success('Avatar uploaded successfully!');
      } else {
        setAvatarError(data.message || 'Upload failed');
        toast.error(data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      setAvatarError('Upload failed. Please try again.');
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
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
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-950 min-h-screen py-10 px-2 md:px-8 transition-colors duration-300">
      {/* Signout Loading Modal */}
      {isSigningOut && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-sm">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
            <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">Signing out...</p>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-6 ${isVisible ? animationClasses.fadeInUp : 'opacity-0 translate-y-8'}`}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:space-x-6 w-full md:flex-1 text-center sm:text-left mb-4 md:mb-0">
              <div className={`relative flex-shrink-0 mx-auto sm:mx-0 group ${isVisible ? animationClasses.scaleIn + ' animation-delay-150' : 'opacity-0 scale-95'}`}>
                <div className="transform transition-all duration-300 group-hover:scale-110">
                  <UserAvatar
                    user={currentUser}
                    size="h-24 w-24"
                    textSize="text-2xl"
                  />
                </div>
                {currentUser.role === 'admin' && (
                  <div className={`absolute -top-2 -right-2 bg-blue-500 text-white rounded-full p-3 shadow-xl z-20 ${animationClasses.bounceIn} animation-delay-300 ${animationClasses.float}`}>
                    <FaCrown className="w-5 h-5" />
                  </div>
                )}
                {currentUser.isDefaultAdmin && (
                  <div className={`absolute -bottom-2 -right-2 bg-red-500 text-white rounded-full p-3 ${animationClasses.bounceIn} animation-delay-450 ${animationClasses.pulse}`}>
                    <FaCrown className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className={`mt-4 sm:mt-0 w-full ${isVisible ? animationClasses.fadeInLeft + ' animation-delay-300' : 'opacity-0 -translate-x-8'}`}>
                {/* Name and Role Section */}
                <div className="text-center sm:text-left mb-4">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-1 transition-colors duration-300 flex flex-col sm:flex-row sm:items-center justify-center sm:justify-start gap-2">
                    <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent break-all line-clamp-2">
                      <EncryptedText text={currentUser.username} />
                    </span>
                    {/* Seasonal Animated Icon */}
                    {theme?.logoDecoration && THEME_DECORATIONS[theme.logoDecoration] && (
                      <span
                        className={`text-3xl ml-2 filter drop-shadow-md ${THEME_DECORATIONS[theme.logoDecoration].animate} cursor-pointer hover:scale-110 transition-transform`}
                        style={THEME_DECORATIONS[theme.logoDecoration].style || {}}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowThemeInfo(true);
                        }}
                        title={theme.name}
                      >
                        {THEME_DECORATIONS[theme.logoDecoration].icon}
                      </span>
                    )}
                    {/* Fallback */}
                    {theme?.icon && !theme?.logoDecoration && (
                      <span
                        className="text-3xl ml-2 filter drop-shadow-md animate-bounce cursor-pointer hover:scale-110 transition-transform"
                        title={theme.name}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowThemeInfo(true);
                        }}
                      >
                        {theme.icon}
                      </span>
                    )}
                    {currentUser.role === 'admin' && (
                      <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-sm px-3 py-1 rounded-full font-medium transform transition-all duration-300 hover:scale-110 hover:bg-purple-200 dark:hover:bg-purple-800 flex items-center gap-1">
                        <FaCrown className="w-3 h-3 text-blue-500" />
                        Admin
                      </span>
                    )}
                    {currentUser.isDefaultAdmin && (
                      <span className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-sm px-3 py-1 rounded-full font-medium transform transition-all duration-300 hover:scale-110 hover:bg-red-200 dark:hover:bg-red-800 animate-pulse flex items-center gap-1">
                        <FaCrown className="w-3 h-3 text-red-500" />
                        Default Admin
                      </span>
                    )}
                    {currentUser.role === 'user' && (
                      <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full font-medium transform transition-all duration-300 hover:scale-110 hover:bg-blue-200">
                        User
                      </span>
                    )}
                  </h1>
                </div>

                {/* Contact Information Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {/* Email - Show only if showEmail setting is true */}
                  {(() => {
                    // Use storageUpdateTrigger to force re-render when settings change
                    const _ = storageUpdateTrigger;
                    const showEmail = localStorage.getItem('showEmail') === 'true';
                    return showEmail ? (
                      <div className="bg-gray-50 dark:bg-gray-700 dark:border-gray-600 rounded-lg p-3 border border-gray-200 hover:border-blue-300 transition-all duration-300 hover:shadow-md">
                        <div className="flex items-center">
                          <FaEnvelope className="w-4 h-4 mr-3 text-blue-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Email</p>
                            <p className="text-gray-700 dark:text-gray-200 text-sm break-all">{currentUser.email}</p>
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Mobile - Show only if showPhone setting is true */}
                  {(() => {
                    // Use storageUpdateTrigger to force re-render when settings change
                    const _ = storageUpdateTrigger;
                    const showPhone = localStorage.getItem('showPhone') === 'true';
                    return showPhone ? (
                      <div className="bg-gray-50 dark:bg-gray-700 dark:border-gray-600 rounded-lg p-3 border border-gray-200 hover:border-green-300 transition-all duration-300 hover:shadow-md">
                        <div className="flex items-center">
                          <FaPhone className="w-4 h-4 mr-3 text-green-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Mobile</p>
                            <p className="text-gray-700 dark:text-gray-200 text-sm">
                              {currentUser.mobileNumber && currentUser.mobileNumber !== "0000000000"
                                ? `+91 ${currentUser.mobileNumber.slice(0, 5)} ${currentUser.mobileNumber.slice(5)}`
                                : "Not provided"
                              }
                              {currentUser.isGeneratedMobile && (
                                <span className="text-xs text-gray-400 block">(Generated for Google signup)</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Gender */}
                  <div className="bg-gray-50 dark:bg-gray-700 dark:border-gray-600 rounded-lg p-3 border border-gray-200 hover:border-purple-300 transition-all duration-300 hover:shadow-md">
                    <div className="flex items-center">
                      <FaUser className="w-4 h-4 mr-3 text-purple-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Gender</p>
                        <p className="text-gray-700 dark:text-gray-200 text-sm capitalize">{currentUser.gender || "Not provided"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="bg-gray-50 dark:bg-gray-700 dark:border-gray-600 rounded-lg p-3 border border-gray-200 hover:border-blue-300 transition-all duration-300 hover:shadow-md">
                    <div className="flex items-start">
                      <FaHome className="w-4 h-4 mr-3 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Address</p>
                        <p className="text-gray-700 dark:text-gray-200 text-sm break-words">{currentUser.address || "Not provided"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Referral Info */}
                  {/* Referral Info - Hide for Admins */}
                  {!isAdmin && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-300 hover:shadow-md sm:col-span-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center">
                          <FaStar className="w-4 h-4 mr-3 text-indigo-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-indigo-500 font-bold mb-1 uppercase tracking-wider">Referral Program</p>
                            <p className="text-gray-700 dark:text-gray-300 text-sm">Invite friends to <span className="font-bold">UrbanSetu</span> and earn <span className="font-bold">100 SetuCoins</span> when they join! Plus, they get <span className="font-bold">50 coins</span> as a welcome gift.</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowReferralModal(true)}
                          className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Refer Now
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile Completion Status */}
                {isProfileIncomplete && (
                  <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3">
                    <p className="text-sm text-amber-700 dark:text-amber-400 font-medium text-center sm:text-left">
                      ⚠️ Complete your profile & earn 20 SetuCoins to unlock rewards!
                    </p>
                  </div>
                )}

                {/* Member Since */}
                <div className="text-center sm:text-left">
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mb-4 transition-colors duration-300">
                    <FaCalendarAlt className="w-3 h-3 inline mr-1" />
                    Member since {formatDate(currentUser.createdAt)}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 md:mt-0 flex justify-end">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`bg-gradient-to-r ${!isEditing && isProfileIncomplete ? 'from-amber-400 to-yellow-600 shadow-yellow-500/50' : 'from-blue-500 to-purple-500'} text-white px-5 sm:px-4 py-4 sm:py-2 rounded-lg ${!isEditing && isProfileIncomplete ? 'hover:from-amber-500 hover:to-yellow-700' : 'hover:from-blue-600 hover:to-purple-600'} transition-all transform hover:scale-105 hover:rotate-1 shadow-lg font-semibold flex items-center gap-2 sm:gap-2 text-base sm:text-sm w-full sm:w-auto justify-center group ${isVisible ? animationClasses.fadeInRight + ' animation-delay-450' : 'opacity-0 translate-x-8'}`}
              >
                <FaEdit className={`w-5 h-5 transition-transform duration-300 ${isEditing ? 'rotate-180' : ''} group-hover:${animationClasses.wiggle}`} />
                {isEditing ? 'Cancel Edit' : (isProfileIncomplete ? 'Complete Profile' : 'Edit Profile')}
              </button>
            </div>
          </div>
        </div>

        {/* Edit Profile Form - show below profile card, push stats down when editing */}
        {isEditing && (
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-6 ${animationClasses.slideInUp}`}>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center group">
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
                            alt={`Avatar ${idx + 1}`}
                            className="w-full h-full rounded-full object-cover transition-all duration-300 hover:brightness-110"
                          />
                        </button>
                      ))}
                      <label className={`w-12 h-12 rounded-full border-2 border-gray-300 flex items-center justify-center cursor-pointer bg-gray-100 hover:bg-gray-200 transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:border-blue-400 group ${animationClasses.bounceIn} animation-delay-${defaultAvatars.length * 50} ${uploadingAvatar ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarUpload}
                          disabled={uploadingAvatar}
                        />
                        {uploadingAvatar ? (
                          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                        ) : (
                          <FaEdit className={`text-gray-500 group-hover:text-blue-500 transition-colors duration-300 group-hover:${animationClasses.wiggle}`} title="Upload custom avatar" />
                        )}
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
                      <div className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Or create a custom DiceBear avatar:</div>
                      <div className="flex flex-col sm:flex-row gap-2 items-center w-full">
                        <label className="font-medium text-sm dark:text-gray-300">Style:</label>
                        <select
                          className="border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                                  className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
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
                              className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white p-2 rounded-lg w-24 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
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
                              const res = await authenticatedFetch(`${API_BASE_URL}/api/user/${currentUser._id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
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
                <div className="text-xs text-gray-500 mt-2 text-center">Note: Please upload a profile image below 5MB for best performance.</div>
                {avatarError && (
                  <div className="text-red-500 text-sm mt-2 text-center bg-red-50 p-2 rounded-lg border border-red-200">
                    {avatarError}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                    <FaUser className="w-4 h-4 mr-2" />
                    Username
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="username"
                      placeholder="Enter username"
                      value={formData.username || ''}
                      onChange={handleChangeWithValidation}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all pr-12"
                    />
                    {/* Show green tick for username (always accepted) */}
                    {formData.username && formData.username.trim() && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600 z-20">
                        <FaCheck className="text-xl" />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
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
                      readOnly={!emailEditMode || (emailEditMode && otpSent) || otpLoading}
                      disabled={otpLoading}
                      className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all dark:bg-gray-700 dark:text-white ${!emailEditMode || (emailEditMode && otpSent) || otpLoading
                        ? 'bg-gray-100 dark:bg-gray-800 dark:border-gray-600 cursor-not-allowed border-green-500 pr-20'
                        : emailValidation.available === false
                          ? 'border-red-500 focus:ring-red-500 pr-12'
                          : emailValidation.available === true
                            ? 'border-green-500 focus:ring-green-500 pr-12'
                            : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 pr-12'
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
                    {emailValidation.available === true && !emailValidation.loading && !emailVerified && formData.email !== originalEmail && (emailEditMode || otpSent) && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600 z-20">
                        <FaCheck className="text-xl" />
                      </div>
                    )}
                    {/* Show green tick for current user's email (unchanged) */}
                    {emailValidation.available === true && !emailValidation.loading && formData.email === originalEmail && !emailEditMode && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2 z-20">
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
                    {/* Show green tick when initially clicked edit icon for current user's email */}
                    {emailValidation.available === true && !emailValidation.loading && formData.email === originalEmail && emailEditMode && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600 z-20">
                        <FaCheck className="text-xl" />
                      </div>
                    )}
                    {/* Show edit icon and blue tick when OTP is sent but not verified */}
                    {emailValidation.available === true && !emailValidation.loading && !emailVerified && formData.email !== originalEmail && otpSent && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2 z-20">
                        <button
                          type="button"
                          onClick={() => {
                            setEmailEditMode(true);
                            setOtpSent(false);
                            setEmailVerified(false);
                          }}
                          className="text-blue-600 hover:text-blue-800 transition-colors duration-200 p-1 rounded hover:bg-blue-50"
                          title="Edit email"
                        >
                          <FaEdit className="text-sm" />
                        </button>
                        <div className="text-blue-600">
                          <FaCheck className="text-xl" />
                        </div>
                      </div>
                    )}
                    {/* Show Send OTP button only when email is available and not sent yet */}
                    {emailValidation.available === true && !emailValidation.loading && !otpSent && !emailVerified && formData.email !== originalEmail && emailEditMode && (
                      <button
                        type="button"
                        onClick={handleSendOTP}
                        disabled={otpLoading || !canResend || !formData.email || (profileRequiresCaptcha && !profileRecaptchaToken)}
                        className="absolute right-16 top-1/2 transform -translate-y-1/2 px-3 py-1 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap z-10"
                      >
                        {otpLoading ? "Sending..." : "Send OTP"}
                      </button>
                    )}
                    {/* Show green tick and edit icon after successful email verification */}
                    {emailVerified && formData.email !== originalEmail && !emailEditMode && !emailValidation.loading && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2 z-20">
                        <button
                          type="button"
                          onClick={() => setEmailEditMode(true)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
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
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 z-20">
                        <div className="text-green-600">
                          <FaCheck className="text-xl" />
                        </div>
                      </div>
                    )}
                    {/* Show red X when email is not available */}
                    {emailValidation.available === false && !emailValidation.loading && emailEditMode && !otpSent && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 z-20">
                        <FaTimes className="h-5 w-5 text-red-500" />
                      </div>
                    )}
                  </div>

                  {/* Show reCAPTCHA below email when OTP field is closed and captcha required */}
                  {showProfileRecaptcha && emailValidation.available === true && !emailValidation.loading && !otpSent && !emailVerified && formData.email !== originalEmail && emailEditMode && (
                    <div className="mt-3">
                      <RecaptchaWidget
                        key={profileRecaptchaKey}
                        ref={profileRecaptchaRef}
                        onVerify={handleProfileRecaptchaVerify}
                        onExpire={handleProfileRecaptchaExpire}
                        onError={handleProfileRecaptchaError}
                        className="flex justify-center"
                      />
                      {profileRecaptchaError && (
                        <p className="text-red-500 text-sm mt-2 text-center">{profileRecaptchaError}</p>
                      )}
                    </div>
                  )}
                  {/* Show OTP errors below email when OTP field is not open (e.g., softbanned/cooldown) */}
                  {otpError && !otpSent && (
                    <p className="text-red-500 text-sm mt-2">{otpError}</p>
                  )}

                  {/* OTP sent message */}
                  {otpSent && !emailVerified && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      OTP sent to {formData.email}
                    </p>
                  )}

                  {/* OTP Verification Field */}
                  {otpSent && !emailVerified && (
                    <div className="mt-3">
                      <label htmlFor="otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Enter OTP
                      </label>
                      <div className="flex flex-row gap-2">
                        <input
                          ref={otpInputRef}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="Enter 6-digit OTP"
                          id="otp"
                          value={otp}
                          disabled={verifyLoading}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            setOtp(value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (otp && otp.length === 6 && !verifyLoading) {
                                handleVerifyOTP();
                              }
                            }
                          }}
                          className={`flex-1 px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base dark:bg-gray-700 dark:text-white ${verifyLoading ? 'bg-gray-100 dark:bg-gray-900 cursor-not-allowed' : ''
                            }`}
                          maxLength="6"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyOTP}
                          disabled={verifyLoading || otp.length !== 6}
                          className="px-3 py-2 sm:px-4 sm:py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm sm:text-base whitespace-nowrap"
                        >
                          {verifyLoading ? "Verifying..." : "Verify"}
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
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
                              disabled={otpLoading || verifyLoading || (profileRequiresCaptcha && !profileRecaptchaToken)}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                              {otpLoading ? "Sending..." : "Resend OTP"}
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Profile Email OTP reCAPTCHA Widget - Show when required directly under OTP section */}
                      {showProfileRecaptcha && emailValidation.available === true && !emailValidation.loading && formData.email !== originalEmail && emailEditMode && (
                        <div className="mt-3">
                          <RecaptchaWidget
                            key={profileRecaptchaKey}
                            ref={profileRecaptchaRef}
                            onVerify={handleProfileRecaptchaVerify}
                            onExpire={handleProfileRecaptchaExpire}
                            onError={handleProfileRecaptchaError}
                            className="flex justify-center"
                          />
                          {profileRecaptchaError && (
                            <p className="text-red-500 text-sm mt-2 text-center">{profileRecaptchaError}</p>
                          )}
                        </div>
                      )}
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
                    <div className={`text-sm mt-1 ${emailValidation.available === true ? 'text-green-600 dark:text-green-400' :
                      emailValidation.available === false ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
                      }`}>
                      {emailValidation.message}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
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
                      className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all dark:bg-gray-700 dark:text-white ${mobileValidation.available === false
                        ? 'border-red-500 focus:ring-red-500'
                        : mobileValidation.available === true
                          ? 'border-green-500 focus:ring-green-500'
                          : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
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
                    <div className={`text-sm mt-1 ${mobileValidation.available === true ? 'text-green-600 dark:text-green-400' :
                      mobileValidation.available === false ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
                      }`}>
                      {mobileValidation.message}
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                    <FaUser className="w-4 h-4 mr-2" />
                    Gender
                  </label>
                  <div className="relative">
                    <select
                      id="gender"
                      value={formData.gender || ''}
                      onChange={handleChangeWithValidation}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all pr-12"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </select>
                    {/* Show green tick for gender (always accepted) */}
                    {formData.gender && formData.gender.trim() && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600 z-20">
                        <FaCheck className="text-xl" />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                    <FaHome className="w-4 h-4 mr-2" />
                    Address
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="address"
                      placeholder="Enter your address"
                      value={formData.address || ''}
                      onChange={handleChangeWithValidation}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all pr-12"
                    />
                    {/* Show green tick for address (always accepted) */}
                    {formData.address && formData.address.trim() && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600 z-20">
                        <FaCheck className="text-xl" />
                      </div>
                    )}
                  </div>
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
                  className={`bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 ${loading ||
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
          <div className="text-green-600 dark:text-green-400 text-sm mb-6">Profile updated successfully!</div>
        )}

        {/* SetuCoins Section */}
        <div className={`mb-8 ${isVisible ? animationClasses.fadeInUp + ' animation-delay-450' : 'opacity-0 translate-y-8'}`}>
          {isAdmin ? (
            <AdminCoinCard loading={coinData.loading} />
          ) : (
            <>
              <SetuCoinCard
                balance={coinData.balance}
                streak={coinData.streak}
                expiryDate={coinData.expiryDate}
                frozenCoins={coinData.frozenCoins}
                loading={coinData.loading}
                onViewHistory={() => {
                  setShowCoinHistory(!showCoinHistory);
                  // Ensure it's scrolled into view if opening
                  if (!showCoinHistory) {
                    setTimeout(() => {
                      document.getElementById('recent-transactions')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                  }
                }}
              />

              {/* Expandable History */}
              <div id="recent-transactions" className={`transition-all duration-500 ease-in-out overflow-hidden ${showCoinHistory ? 'max-h-[1000px] opacity-100 mt-6' : 'max-h-0 opacity-0'}`}>
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-2">
                  <CoinHistory initialOpen={true} refreshTrigger={historyRefreshTrigger} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Stats Section - show below profile card if not editing, below edit form if editing */}
        <div className={`grid grid-cols-2 md:grid-cols-3 ${isAdmin ? 'lg:grid-cols-3' : 'lg:grid-cols-6'} gap-3 sm:gap-4 mb-6`}>
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 text-center group hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-2 ${isVisible ? animationClasses.scaleIn + ' animation-delay-450' : 'opacity-0 scale-95'}`}>
            <div className={`bg-blue-100 dark:bg-blue-900 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-all duration-300 ${animationClasses.float} group-hover:scale-110`}>
              {isAdmin ? (
                <FaStar className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:text-blue-700 max-w-none transition-colors duration-300" />
              ) : (
                <FaHome className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:text-blue-700 transition-colors duration-300" />
              )}
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
              {isAdmin
                ? (statsAnimated ? <AnimatedCounter end={userStats.receivedReviews} delay={500} /> : userStats.receivedReviews)
                : (statsAnimated ? <AnimatedCounter end={userStats.listings} delay={500} /> : userStats.listings)
              }
            </h3>
            <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 group-hover:text-blue-500 transition-colors duration-300">
              {isAdmin ? 'Reviews' : 'My Listings'}
            </p>
          </div>
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 text-center group hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-2 ${isVisible ? animationClasses.scaleIn + ' animation-delay-600' : 'opacity-0 scale-95'}`}>
            <div className={`bg-green-100 dark:bg-green-900 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-all duration-300 ${animationClasses.float} group-hover:scale-110`}>
              <FaCalendarAlt className="w-5 h-5 text-green-600 dark:text-green-400 group-hover:text-green-700 transition-colors duration-300" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors duration-300">
              {statsAnimated ? <AnimatedCounter end={userStats.appointments} delay={650} /> : userStats.appointments}
            </h3>
            <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 group-hover:text-green-500 transition-colors duration-300">Appointments</p>
          </div>
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 text-center group hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-2 ${isVisible ? animationClasses.scaleIn + ' animation-delay-750' : 'opacity-0 scale-95'}`}>
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 transition-all duration-300 ${isAdmin ? 'bg-indigo-100 group-hover:bg-indigo-200 dark:bg-indigo-900 dark:group-hover:bg-indigo-800' : 'bg-red-100 group-hover:bg-red-200 dark:bg-red-900 dark:group-hover:bg-red-800'} ${animationClasses.heartbeat} group-hover:scale-110`}>
              {isAdmin ? (
                <FaHome className="w-5 h-5 text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 transition-colors duration-300" />
              ) : (
                <FaHeart className="w-5 h-5 text-red-600 dark:text-red-400 group-hover:text-red-700 transition-colors duration-300" />
              )}
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white transition-colors duration-300">
              {isAdmin
                ? (statsAnimated ? <AnimatedCounter end={userStats.listings} delay={800} /> : userStats.listings)
                : (statsAnimated ? <AnimatedCounter end={userStats.wishlist} delay={800} /> : userStats.wishlist)
              }
            </h3>
            <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">
              {isAdmin ? 'All Properties' : 'Wishlist'}
            </p>
          </div>
          {!isAdmin && (
            <>
              <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 text-center group hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-2 ${isVisible ? animationClasses.scaleIn + ' animation-delay-800' : 'opacity-0 scale-95'}`}>
                <div className={`bg-orange-100 dark:bg-orange-900 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 group-hover:bg-orange-200 dark:group-hover:bg-orange-800 transition-all duration-300 ${animationClasses.float} group-hover:scale-110`}>
                  <FaEye className="w-5 h-5 text-orange-600 dark:text-orange-400 group-hover:text-orange-700 transition-colors duration-300" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-300">
                  {statsAnimated ? <AnimatedCounter end={userStats.watchlist} delay={900} /> : userStats.watchlist}
                </h3>
                <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 group-hover:text-orange-500 transition-colors duration-300">Watchlist</p>
              </div>
              <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 text-center group hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-2 ${isVisible ? animationClasses.scaleIn + ' animation-delay-850' : 'opacity-0 scale-95'}`}>
                <div className={`bg-yellow-100 dark:bg-yellow-900 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 group-hover:bg-yellow-200 dark:group-hover:bg-yellow-800 transition-all duration-300 ${animationClasses.float} group-hover:scale-110`}>
                  <FaStar className="w-5 h-5 text-yellow-600 dark:text-yellow-400 group-hover:text-yellow-700 transition-colors duration-300" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors duration-300">
                  {statsAnimated ? <AnimatedCounter end={userStats.reviews} delay={1000} /> : userStats.reviews}
                </h3>
                <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 group-hover:text-yellow-500 transition-colors duration-300">Reviews</p>
              </div>
              <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 text-center group hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-2 ${isVisible ? animationClasses.scaleIn + ' animation-delay-900' : 'opacity-0 scale-95'}`}>
                <div className={`bg-indigo-100 dark:bg-indigo-900 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800 transition-all duration-300 ${animationClasses.float} group-hover:scale-110`}>
                  <FaUserFriends className="w-5 h-5 text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 transition-colors duration-300" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-300">
                  {statsAnimated ? <AnimatedCounter end={userStats.referrals || 0} delay={1100} /> : (userStats.referrals || 0)}
                </h3>
                <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 group-hover:text-indigo-500 transition-colors duration-300">Referrals</p>
              </div>
            </>
          )}
        </div>

        {/* Quick Actions Section */}
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-6 ${isVisible ? animationClasses.fadeInUp + ' animation-delay-300' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Quick Actions
            </span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <Link
              to={(currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? "/admin/help-center" : "/user/help-center"}
              className={`bg-purple-500 text-white p-3 rounded-lg hover:bg-purple-600 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-300`}
            >
              <FaHeadset className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:-translate-y-0.5`} />
              <span className="font-medium text-xs sm:text-sm">Help Center</span>
            </Link>

            <Link
              to={(currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? "/admin/agents" : "/user/agents"}
              className={`bg-teal-500 text-white p-3 rounded-lg hover:bg-teal-600 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-500 flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-400`}
            >
              <FaUserTie className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:-translate-y-0.5`} />
              <span className="font-medium text-xs sm:text-sm">Agents</span>
            </Link>


            {(currentUser.role === 'admin' || currentUser.role === 'rootadmin') && (
              <button
                onClick={handleShowListings}
                className={`bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-450`}
              >
                <FaHome className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:-translate-y-0.5`} />
                <span className="font-medium text-xs sm:text-sm">My Listings</span>
              </button>
            )}

            <Link
              to={(currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? "/admin/appointments" : "/user/my-appointments"}
              className={`bg-green-500 text-white p-3 rounded-lg hover:bg-green-600 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500 flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-600`}
            >
              <FaCalendarAlt className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:-translate-y-0.5`} />
              <span className="font-medium text-xs sm:text-sm">{(currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? 'Appointments' : 'My Appointments'}</span>
            </Link>

            {!(currentUser.role === 'admin' || currentUser.role === 'rootadmin') && (
              <Link
                to="/user/wishlist"
                className={`bg-red-500 text-white p-3 rounded-lg hover:bg-red-600 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500 flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-750`}
              >
                <FaHeart className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:scale-110`} />
                <span className="font-medium text-xs sm:text-sm">My Wishlist</span>
              </Link>
            )}

            {!(currentUser.role === 'admin' || currentUser.role === 'rootadmin') && (
              <Link
                to="/user/watchlist"
                className={`bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-800`}
              >
                <FaEye className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:-translate-y-0.5`} />
                <span className="font-medium text-xs sm:text-sm">My Watchlist</span>
              </Link>
            )}

            {/* About link for quick actions */}
            {!(currentUser.role === 'admin' || currentUser.role === 'rootadmin') && (
              <Link
                to="/about"
                className={`bg-indigo-500 text-white p-3 rounded-lg hover:bg-indigo-600 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-850`}
              >
                <FaInfoCircle className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:-translate-y-0.5`} />
                <span className="font-medium text-xs sm:text-sm">About</span>
              </Link>
            )}

            <Link
              to={(currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? "/admin/reviews" : "/user/reviews"}
              className={`bg-yellow-500 text-white p-3 rounded-lg hover:bg-yellow-600 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-yellow-500 flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-900`}
            >
              <FaStar className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:scale-110`} />
              <span className="font-medium text-xs sm:text-sm">{(currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? 'Reviews' : 'My Reviews'}</span>
            </Link>

            <Link
              to={(currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? "/admin/market-trends" : "/user/market-trends"}
              className={`bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-600 flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-950`}
            >
              <FaChartLine className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:scale-110`} />
              <span className="font-medium text-xs sm:text-sm">Market Trends</span>
            </Link>

            {(currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? (
              <>
                <Link
                  to="/admin/payments"
                  className={`bg-emerald-500 text-white p-3 rounded-lg hover:bg-emerald-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-900`}
                >
                  <FaCreditCard className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Payments</span>
                </Link>
                <Link
                  to="/admin/fraudmanagement"
                  className={`bg-rose-500 text-white p-3 rounded-lg hover:bg-rose-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1050`}
                >
                  <FaExclamationTriangle className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Fraud Mgmt</span>
                </Link>
                <Link
                  to="/admin/investment-tools"
                  className={`bg-green-500 text-white p-3 rounded-lg hover:bg-green-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1150`}
                >
                  <FaChartLine className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Investment Tools</span>
                </Link>
                <Link
                  to="/admin/route-planner"
                  className={`bg-purple-500 text-white p-3 rounded-lg hover:bg-purple-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1200`}
                >
                  <FaRoute className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Route Planner</span>
                </Link>
                <Link
                  to="/admin/security-moderation"
                  className={`bg-indigo-500 text-white p-3 rounded-lg hover:bg-indigo-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1250`}
                >
                  <FaShieldAlt className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Security Moderation</span>
                </Link>
                <Link
                  to="/admin/blogs"
                  className={`bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1300`}
                >
                  <FaBookOpen className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Manage Blogs</span>
                </Link>
                <Link
                  to="/admin/guides"
                  className={`bg-cyan-600 text-white p-3 rounded-lg hover:bg-cyan-700 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-cyan-600 flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-450`}
                >
                  <FaMapSigns className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:-translate-y-0.5`} />
                  <span className="font-medium text-xs sm:text-sm">Manage Guides</span>
                </Link>
                <Link
                  to="/admin/faqs"
                  className={`bg-orange-500 text-white p-3 rounded-lg hover:bg-orange-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1350`}
                >
                  <FaQuestionCircle className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Manage FAQs</span>
                </Link>
                <Link
                  to="/admin/property-verification"
                  className={`bg-teal-500 text-white p-3 rounded-lg hover:bg-teal-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1400`}
                >
                  <FaShieldAlt className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Property Verification</span>
                </Link>
                <Link
                  to="/admin/rental-ratings"
                  className={`bg-yellow-500 text-white p-3 rounded-lg hover:bg-yellow-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1450`}
                >
                  <FaStar className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Rental Ratings</span>
                </Link>
                <Link
                  to="/admin/disputes"
                  className={`bg-red-500 text-white p-3 rounded-lg hover:bg-red-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1500`}
                >
                  <FaGavel className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Disputes</span>
                </Link>
                <Link
                  to="/admin/rental-contracts"
                  className={`bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1550`}
                >
                  <FaFileContract className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Rental Contracts</span>
                </Link>
                <Link
                  to="/admin/rental-loans"
                  className={`bg-purple-600 text-white p-3 rounded-lg hover:bg-purple-700 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1600`}
                >
                  <FaMoneyCheckAlt className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Rental Loans</span>
                </Link>
              </>
            ) : null}

            {/* Services - visible to all users (user and admin) */}
            <Link
              to={(currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? "/admin/services" : "/user/services"}
              className={`bg-indigo-500 text-white p-3 rounded-lg hover:bg-indigo-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-950`}
            >
              <FaTools className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
              <span className="font-medium text-xs sm:text-sm">Services</span>
            </Link>

            {/* User-specific quick actions */}
            {!(currentUser.role === 'admin' || currentUser.role === 'rootadmin') && (
              <>
                <Link
                  to="/user/investment-tools"
                  className={`bg-green-500 text-white p-3 rounded-lg hover:bg-green-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1000`}
                >
                  <FaChartLine className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Investment Tools</span>
                </Link>
                <Link
                  to="/user/route-planner"
                  className={`bg-purple-500 text-white p-3 rounded-lg hover:bg-purple-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1050`}
                >
                  <FaRoute className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Route Planner</span>
                </Link>
                <Link
                  to="/user/my-payments"
                  className={`bg-emerald-500 text-white p-3 rounded-lg hover:bg-emerald-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-900`}
                >
                  <FaCreditCard className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">My Payments</span>
                </Link>
                <Link
                  to="/user/blogs"
                  className={`bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1200`}
                >
                  <FaBookOpen className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Blogs</span>
                </Link>
                <Link
                  to="/user/guides"
                  className={`bg-cyan-600 text-white p-3 rounded-lg hover:bg-cyan-700 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-cyan-600 flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1250`}
                >
                  <FaMapSigns className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:-translate-y-0.5`} />
                  <span className="font-medium text-xs sm:text-sm">Guides</span>
                </Link>
                <Link
                  to="/user/faqs"
                  className={`bg-orange-500 text-white p-3 rounded-lg hover:bg-orange-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1350`}
                >
                  <FaQuestionCircle className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">FAQs</span>
                </Link>
                <Link
                  to="/user/property-verification"
                  className={`bg-teal-500 text-white p-3 rounded-lg hover:bg-teal-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1400`}
                >
                  <FaShieldAlt className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Property Verification</span>
                </Link>
                <Link
                  to="/user/rental-ratings"
                  className={`bg-yellow-500 text-white p-3 rounded-lg hover:bg-yellow-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1450`}
                >
                  <FaStar className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Rental Ratings</span>
                </Link>
                <Link
                  to="/user/rental-contracts"
                  className={`bg-indigo-500 text-white p-3 rounded-lg hover:bg-indigo-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1500`}
                >
                  <FaFileContract className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Rental Contracts</span>
                </Link>
                <Link
                  to="/user/disputes"
                  className={`bg-red-500 text-white p-3 rounded-lg hover:bg-red-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1550`}
                >
                  <FaGavel className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Disputes</span>
                </Link>
                <Link
                  to="/user/rental-loans"
                  className={`bg-purple-500 text-white p-3 rounded-lg hover:bg-purple-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg flex flex-col items-center group ${animationClasses.bounceIn} animation-delay-1600`}
                >
                  <FaCreditCard className={`w-4 h-4 mb-1 transition-transform duration-300 group-hover:${animationClasses.bounce}`} />
                  <span className="font-medium text-xs sm:text-sm">Rental Loans</span>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Settings Section */}
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8 mb-6 relative overflow-hidden group ${isVisible ? animationClasses.fadeInUp + ' animation-delay-150' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Account Settings
            </span>
          </h2>

          <div className="space-y-4">
            <button
              onClick={() => navigate((currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? '/admin/settings' : '/user/settings')}
              className={`w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center font-semibold group ${animationClasses.slideInUp} animation-delay-750`}
            >
              <FaCog className={`w-5 h-5 mr-2 transition-transform duration-300 group-hover:rotate-90`} />
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Update Profile Password Modal */}
      {showUpdatePasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.3s_ease-out]">
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full ${animationClasses.scaleIn}`}>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Confirm Profile Update</h3>
              <p className="mb-4 text-gray-600 dark:text-gray-300">Please enter your password to confirm the profile changes.</p>
              <input
                ref={updatePasswordRef}
                type="password"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your password"
                value={updatePassword}
                onChange={e => setUpdatePassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleConfirmUpdate(); } }}
              />
              {updatePasswordError && <div className="text-red-600 dark:text-red-400 text-sm mb-2">{updatePasswordError}</div>}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => { localStorage.removeItem(PROFILE_PASSWORD_ATTEMPT_KEY); setShowUpdatePasswordModal(false); setUpdatePassword(""); setUpdatePasswordError(""); }}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 transition-colors"
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

      {/* Referral Share Modal */}
      <SocialSharePanel
        isOpen={showReferralModal}
        onClose={() => setShowReferralModal(false)}
        url={`${window.location.origin}/sign-up?ref=${currentUser._id}`}
        title="Join me on UrbanSetu! 🏠"
        description="Sign up using my link to get started with the best real estate platform and earn exclusive rewards!"
      />

      {/* Contact Support Wrapper */}
      <ContactSupportWrapper />
      <ThemeDetailModal
        theme={theme}
        isOpen={showThemeInfo}
        onClose={() => setShowThemeInfo(false)}
      />
    </div>
  );
}