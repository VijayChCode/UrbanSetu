import React, { useEffect, useState, useRef } from "react";
import { FaSearch, FaHome, FaInfoCircle, FaCompass, FaPlus, FaFileContract, FaEye, FaMapSigns, FaList, FaHeart, FaMoneyCheckAlt, FaCalendarAlt, FaSignOutAlt, FaStar, FaBars, FaTimes, FaTrash, FaTools, FaRoute, FaDownload, FaMobile, FaBookOpen, FaQuestionCircle, FaUsers, FaCrown, FaClock } from "react-icons/fa";
import UserAvatar from "./UserAvatar";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { signoutUserSuccess } from "../redux/user/userSlice.js";
import NotificationBell from "./NotificationBell.jsx";
import { persistor } from '../redux/store';
import { reconnectSocket, socket } from "../utils/socket";
import { toast } from 'react-toastify';
import { downloadAndroidApp, isAndroidDevice, isMobileDevice, getDownloadMessage, getDownloadButtonText } from '../utils/androidDownload';
import { useSignout } from '../hooks/useSignout';
import SearchSuggestions from './SearchSuggestions';
import { LogIn } from "lucide-react";
import { UserPlus, LogOut, User, Settings } from "lucide-react";
import ThemeToggle from "./ThemeToggle.jsx";
import SeasonalEffects from './SeasonalEffects';
import { useSeasonalTheme, useAllSeasonalThemes } from "../hooks/useSeasonalTheme.jsx";
import ThemeDetailModal from "./ThemeDetailModal";
import { motion, AnimatePresence } from "framer-motion";

const Realistic3DSearchIcon = ({ className = "" }) => {
  const uniqueId = React.useId().replace(/:/g, "-");
  const metalRingId = `metalRingUser-${uniqueId}`;
  const ringHighlightId = `ringHighlightUser-${uniqueId}`;
  const glassLensId = `glassLensUser-${uniqueId}`;
  const glassReflectionId = `glassReflectionUser-${uniqueId}`;
  const handleGradientId = `handleGradientUser-${uniqueId}`;

  return (
    <svg
      className={`w-5 h-5 transition-all duration-300 filter drop-shadow-[0.8px_1.2px_1.5px_rgba(0,0,0,0.4)] select-none pointer-events-none ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={metalRingId} x1="2" y1="2" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#d1d5db" />
          <stop offset="70%" stopColor="#4b5563" />
          <stop offset="100%" stopColor="#1f2937" />
        </linearGradient>

        <linearGradient id={ringHighlightId} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#9ca3af" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#111827" stopOpacity="0.9" />
        </linearGradient>

        <radialGradient id={glassLensId} cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#bae6fd" stopOpacity="0.45" />
          <stop offset="80%" stopColor="#38bdf8" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0.5" />
        </radialGradient>

        <linearGradient id={glassReflectionId} x1="2" y1="2" x2="12" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <linearGradient id={handleGradientId} x1="12" y1="12" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9ca3af" />
          <stop offset="25%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#4b5563" />
          <stop offset="60%" stopColor="#b45309" />
          <stop offset="85%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
      </defs>

      <g>
        <line
          x1="12.2"
          y1="12.2"
          x2="15.2"
          y2="15.2"
          stroke={`url(#${ringHighlightId})`}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <line
          x1="14.2"
          y1="14.2"
          x2="21.2"
          y2="21.2"
          stroke={`url(#${handleGradientId})`}
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        <circle cx="21.2" cy="21.2" r="1.8" fill="#1f2937" />

        <circle cx="9" cy="9" r="6.8" fill="none" stroke={`url(#${metalRingId})`} strokeWidth="1.8" />
        <circle cx="9" cy="9" r="6.0" fill="none" stroke={`url(#${ringHighlightId})`} strokeWidth="0.8" />

        <circle cx="9" cy="9" r="5.6" fill={`url(#${glassLensId})`} />

        <path
          d="M 5.2 6.2 A 5 5 0 0 1 12.8 6.2 A 5.2 5.2 0 0 0 5.2 6.2 Z"
          fill={`url(#${glassReflectionId})`}
          opacity="0.8"
        />
        <ellipse cx="11.5" cy="11.5" rx="1.2" ry="0.6" transform="rotate(-45 11.5 11.5)" fill="#ffffff" opacity="0.25" />
      </g>
    </svg>
  );
};

const USER_HEADER_OPTIONS = [
  { path: '/user', icon: FaHome, label: 'Home' },
  { path: '/search', icon: FaCompass, label: 'Explore' },
  { path: '/user/community', icon: FaUsers, label: 'Community' },
  { path: '/user/create-listing', icon: FaPlus, label: 'Add Property' },
  { path: '/user/my-listings', icon: FaList, label: 'My Listings' },
  { path: '/user/wishlist', icon: FaHeart, label: 'Wish List' },
  { path: '/user/watchlist', icon: FaEye, label: 'Watchlist' },
  { path: '/user/my-appointments', icon: FaCalendarAlt, label: 'My Appointments' },
  { path: '/user/route-planner', icon: FaRoute, label: 'Route Planner' },
  { path: '/user/reviews', icon: FaStar, label: 'Review' },
  { path: '/user/download', icon: FaDownload, label: 'Download App' },
  { path: '/user/blogs', icon: FaBookOpen, label: 'Blogs' },
  { path: '/user/guides', icon: FaMapSigns, label: 'Guides' },
  { path: '/user/faqs', icon: FaQuestionCircle, label: 'FAQs' },
  { path: '/user/rental-contracts', icon: FaFileContract, label: 'Rental Contracts' }
];

export default function Header() {
  const theme = useSeasonalTheme();
  const allThemes = useAllSeasonalThemes();
  const [showThemeInfo, setShowThemeInfo] = useState(false);
  const [randomNavOption, setRandomNavOption] = useState(null);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * USER_HEADER_OPTIONS.length);
    setRandomNavOption(USER_HEADER_OPTIONS[randomIndex]);
  }, []);
  const { currentUser } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const [searchTerm, setSearchTerm] = useState("");
  const [fadeIn, setFadeIn] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { signout } = useSignout();
  const [searchOpen, setSearchOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    setFadeIn(true);
    const urlParams = new URLSearchParams(location.search);
    const searchTermFromUrl = urlParams.get("searchTerm");
    if (searchTermFromUrl) {
      setSearchTerm(searchTermFromUrl);
    }
  }, [location.search]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 60) {
        setScrolled(true);
      } else if (window.scrollY < 15) {
        setScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      // Save previous body styles
      const prevOverflow = document.body.style.overflow;
      const prevPosition = document.body.style.position;
      const prevWidth = document.body.style.width;
      const prevTop = document.body.style.top;

      // Lock body scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;
      document.body.classList.add('mobile-menu-open');

      // Cleanup function
      return () => {
        const scrollY = document.body.style.top;
        document.body.style.overflow = prevOverflow;
        document.body.style.position = prevPosition;
        document.body.style.width = prevWidth;
        document.body.style.top = prevTop;
        document.body.classList.remove('mobile-menu-open');

        // Restore scroll position
        if (scrollY) {
          window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
      };
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      document.body.classList.remove('mobile-menu-open');
    };
  }, [mobileMenuOpen]);

  // Function to get header gradient based on current route
  const getHeaderGradient = () => {
    const path = location.pathname;
    const searchParams = new URLSearchParams(location.search);

    // List of known routes (prefixes)
    const knownRoutes = [
      "/sign-in", "/sign-up", "/forgot-password", "/about", "/search", "/oauth",
      "/user", "/user/home", "/user/about", "/user/search", "/user/profile", "/user/create-listing", "/user/update-listing", "/user/listing", "/user/wishlist", "/user/appointment", "/user/my-appointments", "/user/my-listings", "/user/change-password",
      "/admin", "/admin/appointments", "/admin/about", "/admin/explore", "/admin/create-listing", "/admin/listings", "/admin/my-listings", "/admin/update-listing", "/admin/profile", "/admin/change-password", "/admin/requests", "/admin/listing", "/admin/appointmentlisting",
      "/listing"
    ];
    // If not a known route, use default blue-purple (404)
    if (!knownRoutes.some(r => path === r || path.startsWith(r + "/") || path === r.replace(/\/$/, ""))) {
      return 'bg-gradient-to-r from-blue-700 to-purple-700';
    }
    // Check if we're on the reset password step (step=2)
    if (path === '/forgot-password' && searchParams.get('step') === '2') {
      return 'bg-gradient-to-r from-green-600 to-green-700'; // Green for reset password step
    }
    switch (path) {
      case '/sign-in':
        return 'bg-gradient-to-r from-blue-700 to-purple-700'; // Blue-Purple for sign-in
      case '/sign-up':
        return 'bg-gradient-to-r from-green-600 to-green-700'; // Green for sign-up
      case '/forgot-password':
        return 'bg-gradient-to-r from-red-600 to-red-700'; // Red for forgot-password verification step
      case '/change-password':
      case '/user/change-password':
        return 'bg-gradient-to-r from-blue-700 to-purple-700'; // Default blue-purple
      default:
        return 'bg-gradient-to-r from-blue-700 to-purple-700'; // Default blue-purple
    }
  };

  // Function to get search button color based on current route
  const getSearchButtonColor = () => {
    const path = location.pathname;
    const searchParams = new URLSearchParams(location.search);

    // List of known routes (prefixes)
    const knownRoutes = [
      "/sign-in", "/sign-up", "/forgot-password", "/about", "/search", "/oauth",
      "/user", "/user/home", "/user/about", "/user/search", "/user/profile", "/user/create-listing", "/user/update-listing", "/user/listing", "/user/wishlist", "/user/appointment", "/user/my-appointments", "/user/my-listings", "/user/change-password",
      "/admin", "/admin/appointments", "/admin/about", "/admin/explore", "/admin/create-listing", "/admin/listings", "/admin/my-listings", "/admin/update-listing", "/admin/profile", "/admin/change-password", "/admin/requests", "/admin/listing", "/admin/appointmentlisting",
      "/listing"
    ];
    // If not a known route, use default blue (404)
    if (!knownRoutes.some(r => path === r || path.startsWith(r + "/") || path === r.replace(/\/$/, ""))) {
      return 'bg-blue-500 hover:bg-blue-600';
    }
    // Check if we're on the reset password step (step=2)
    if (path === '/forgot-password' && searchParams.get('step') === '2') {
      return 'bg-green-500 hover:bg-green-600'; // Green for reset password step
    }
    switch (path) {
      case '/sign-in':
        return 'bg-blue-500 hover:bg-blue-600'; // Blue for sign-in
      case '/sign-up':
        return 'bg-green-500 hover:bg-green-600'; // Green for sign-up
      case '/forgot-password':
        return 'bg-red-500 hover:bg-red-600'; // Red for forgot-password verification step
      case '/change-password':
      case '/user/change-password':
        return 'bg-blue-500 hover:bg-blue-600'; // Blue for change-password
      default:
        return 'bg-blue-500 hover:bg-blue-600'; // Default blue
    }
  };

  // Function to get search focus ring color based on current route
  const getSearchFocusRingColor = () => {
    const path = location.pathname;
    const searchParams = new URLSearchParams(location.search);

    // Check if we're on the reset password step (step=2)
    if (path === '/forgot-password' && searchParams.get('step') === '2') {
      return 'focus-within:ring-green-500'; // Green for reset password step
    }
    switch (path) {
      case '/sign-up':
        return 'focus-within:ring-green-500'; // Green for sign-up
      case '/forgot-password':
        return 'focus-within:ring-red-500'; // Red for forgot-password verification step
      default:
        return 'focus-within:ring-blue-500'; // Default blue
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const urlParams = new URLSearchParams(location.search);
    urlParams.set("searchTerm", searchTerm);
    const searchQuery = urlParams.toString();

    // Redirect to user explore page if user is logged in, otherwise to public search
    if (currentUser) {
      navigate(`/user/search?${searchQuery}`);
    } else {
      navigate(`/search?${searchQuery}`);
    }
    // Close mobile menu if open
    setMobileMenuOpen(false);
    setShowSuggestions(false);
    // Clear the search term after navigation
    setSearchTerm("");
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchTerm(suggestion.displayText);
    setShowSuggestions(false);

    // Navigate to the property listing
    navigate(`/listing/${suggestion.id}`);
  };

  const handleSearchInputChange = (e) => {
    setSearchTerm(e.target.value);
    setShowSuggestions(true);
  };

  const handleSearchInputFocus = () => {
    if (searchTerm.trim().length >= 2) {
      setShowSuggestions(true);
    }
  };

  const handleSearchInputBlur = () => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const handleSignout = async () => {
    await signout({
      showToast: true,
      navigateTo: "/",
      delay: 0
    });
  };

  return (
    <>
      <header className={`relative ${getHeaderGradient()} shadow-xl border-b border-white/20 sticky top-0 z-50 transition-all duration-300 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
        {/* Top Bar */}
        <div className={`bg-black/10 border-b border-white/10 transition-all duration-500 ease-in-out overflow-hidden ${scrolled ? 'max-h-0 opacity-0' : 'max-h-[60px] py-1 opacity-100'}`}>
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-1 text-sm text-white/80">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2">
                  <FaHome className="text-yellow-400" />
                  <span>Premium Real Estate Platform</span>
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-4">
                  <span>📞 +1 (970) 446-3758</span>
                  <span>✉️ info.urbansetu@gmail.com</span>
                  {/* Android App Download Button */}
                  <Link
                    to="/download"
                    className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors duration-200 font-medium"
                    title="Download"
                  >
                    <FaDownload className="text-xs" />
                    <span>Download App</span>
                  </Link>
                </div>
                {/* Mobile auth links when logged out */}
                {!currentUser && (
                  <div className="md:hidden flex items-center gap-3">
                    {location.pathname !== '/sign-up' && (
                      <Link to="/sign-up" className="flex items-center gap-1 text-white/80 hover:text-white text-sm" title="Sign Up">
                        <UserPlus className="text-xs" />
                      </Link>
                    )}
                    {location.pathname !== '/sign-up' && location.pathname !== '/sign-in' && (
                      <span className="text-white/40">|</span>
                    )}
                    {location.pathname !== '/sign-in' && (
                      <Link to="/sign-in" className="flex items-center gap-1 text-white/80 hover:text-white text-sm" title="Sign In">
                        <LogIn className="text-xs rotate-180" />
                      </Link>
                    )}
                  </div>
                )}
                {currentUser && randomNavOption && (
                  <Link
                    to={randomNavOption.path}
                    className="md:hidden flex items-center text-white/80 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
                    title={`Quick Access: ${randomNavOption.label}`}
                  >
                    <randomNavOption.icon className="text-base text-yellow-400" />
                  </Link>
                )}

              </div>
            </div>
          </div>
        </div>

        {/* Main Header */}
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-2">
            {/* Logo/Title - Left Aligned */}
            <Link to={location.pathname.startsWith('/user') ? '/user' : '/'} className="flex-shrink-0 group relative">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="p-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                    <FaHome className={`text-xl sm:text-2xl drop-shadow-lg ${theme?.id === 'christmas' ? 'text-green-500' : 'text-yellow-400'}`} />
                  </div>
                  <div className={`absolute -inset-1 bg-gradient-to-r ${theme?.textGradient ? theme.textGradient.replace('bg-clip-text text-transparent', '') : 'from-yellow-400 to-orange-500'} rounded-xl blur opacity-30 group-hover:opacity-50 transition-opacity duration-300`}></div>

                  {/* Seasonal Logo Interaction - Animated Icons */}
                  <div className="absolute -top-3 -right-2 flex pointer-events-none">
                    {allThemes.map((t, i) => {
                      const decoration = t.logoDecoration;
                      if (!decoration) return null;

                      // Position overrides for multiple icons to prevent overlap
                      const posClasses = i === 0 ? "-top-3 -right-2" : (i === 1 ? "-top-4 -right-5" : "-bottom-2 -right-4");

                      return (
                        <div
                          key={t.id || i}
                          className={`absolute ${posClasses} pointer-events-auto cursor-pointer hover:scale-110 transition-transform z-10`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowThemeInfo(true);
                          }}
                          title={t.name}
                        >
                          <LogoDecoration decoration={decoration} />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white drop-shadow-lg flex items-center">
                    {theme ? (
                      <span className={`${theme.textGradient} bg-clip-text text-transparent`}>
                        UrbanSetu
                      </span>
                    ) : (
                      <>
                        <span className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                          Urban
                        </span>
                        <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent ml-1">
                          Setu
                        </span>
                      </>
                    )}
                  </h1>
                  <p className="text-xs text-white/70 font-medium tracking-wider uppercase flex items-center gap-1">
                    Real Estate Excellence {theme?.secondaryIcon && (
                      <span className="opacity-80">
                        {theme.secondaryIcon === '🇮🇳' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" className="inline-block align-baseline" style={{ width: '1em', height: '0.67em', transform: 'translateY(2px)' }}>
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
                        ) : theme.secondaryIcon}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </Link>

            {/* Desktop Navigation - Right Side */}
            <nav className="hidden lg:flex items-center space-x-2">
              <UserNavLinks signout={signout} />
            </nav>

            {/* Mobile Menu Button */}
            <div className="lg:hidden">
              <button
                className="p-2 text-white hover:text-yellow-300 focus:outline-none transition-all duration-300 hover:bg-white/10 rounded-lg"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-label="Open navigation menu"
              >
                <div className={`transition-transform duration-300 ${mobileMenuOpen ? 'animate-hamburger-to-x' : 'animate-x-to-hamburger'}`}>
                  {mobileMenuOpen ? <FaTimes className="text-lg" /> : <FaBars className="text-lg" />}
                </div>
              </button>
            </div>
          </div>
        </div>
        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden">
            <div className="fixed inset-0 z-[200]">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/70 backdrop-blur-md animate-mobile-backdrop-in"
                onClick={() => setMobileMenuOpen(false)}
              />

              {/* Menu Panel */}
              <div className="relative ml-auto w-80 max-w-sm h-full bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-in-out animate-mobile-menu-in overflow-hidden">
                <SeasonalEffects />
                <div className="flex flex-col h-full relative z-10">
                  {/* Header */}
                  <div className={`${getHeaderGradient()} p-6 text-white`}>
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold">UrbanSetu</h2>
                      <ThemeToggle variant="cycle" />
                    </div>
                  </div>

                  {/* Search */}
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700 relative">
                    <form onSubmit={handleSubmit} className={`flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden focus-within:ring-2 ${getSearchFocusRingColor()} focus-within:bg-white dark:focus-within:bg-gray-700 transition-all`}>
                      <input
                        type="text"
                        placeholder="Search Properties..."
                        value={searchTerm}
                        onChange={handleSearchInputChange}
                        onFocus={handleSearchInputFocus}
                        onBlur={handleSearchInputBlur}
                        className="px-4 py-3 outline-none w-full text-gray-800 dark:text-gray-200 bg-transparent placeholder-gray-500 dark:placeholder-gray-400"
                      />
                      <motion.button 
                        className={`group ${getSearchButtonColor()} text-white p-3 transition-colors flex items-center justify-center`} 
                        type="submit"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Realistic3DSearchIcon />
                      </motion.button>
                    </form>

                    <SearchSuggestions
                      searchTerm={searchTerm}
                      onSuggestionClick={handleSuggestionClick}
                      onClose={() => setShowSuggestions(false)}
                      isVisible={showSuggestions}
                      className="mt-1"
                    />
                  </div>



                  {/* Navigation Links */}
                  <div className="flex-1 overflow-y-auto p-6">
                    <UserNavLinks mobile onNavigate={() => setMobileMenuOpen(false)} signout={signout} />

                    {/* Android App Download - Moved to bottom */}
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                      <Link
                        to="/download"
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 font-medium shadow-lg hover:shadow-xl transform transition-all active:scale-95"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <FaDownload className="text-lg" />
                        <span>Download App</span>
                      </Link>
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3 font-medium">
                        Download our app for the best experience!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>
      <ThemeDetailModal
        theme={theme}
        themes={allThemes}
        isOpen={showThemeInfo}
        onClose={() => setShowThemeInfo(false)}
      />
    </>
  );
}

function LogoDecoration({ decoration }) {
  const decorations = {
    'santa-hat': { icon: '🎅', animate: 'animate-wiggle', size: 'text-2xl' },
    'party-hat': { icon: '🎉', animate: 'animate-wiggle', size: 'text-2xl' },
    'kite': { icon: '🪁', animate: 'animate-sway', size: 'text-2xl' },
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
      size: 'text-2xl'
    },
    'heart': { icon: '❤️', animate: 'animate-grow-shrink', size: 'text-xl' },
    'pumpkin': { icon: '🎃', animate: 'animate-bounce', size: 'text-xl' },
    'colors': { icon: '🎨', animate: 'animate-spin-slow', size: 'text-xl' },
    'mango': { icon: '🥭', animate: 'animate-wiggle-slow', size: 'text-xl' },
    'moon': { icon: '🌙', animate: 'animate-pulse', size: 'text-xl' },
    'bow': { icon: '🏹', animate: 'animate-pulse -rotate-45', size: 'text-xl' },
    'rakhi': { icon: '🧵', animate: 'animate-wiggle', size: 'text-xl' },
    'modak': { icon: '🥟', animate: 'animate-bounce', size: 'text-xl' },
    'flower': { icon: '🌺', animate: 'animate-spin', size: 'text-xl', style: { animationDuration: '8s' } },
    'marigold': { icon: '🌼', animate: 'animate-spin-slow', size: 'text-xl' },
    'diya': { icon: '🪔', animate: 'animate-flicker', size: 'text-2xl' },
    'snow-cap': { icon: '❄️', animate: 'animate-spin-slow', size: 'text-xl' },
    'clover': { icon: '☘️', animate: 'animate-wiggle', size: 'text-xl' },
    'leaf': { icon: '🌱', animate: 'animate-grow-shrink', size: 'text-xl' },
    'glasses': { icon: '👓', animate: 'animate-wiggle-slow', size: 'text-xl' },
    'turkey': { icon: '🦃', animate: 'animate-bounce', size: 'text-xl' },
    'dragon': { icon: '🐉', animate: 'animate-sway', size: 'text-xl' },
    'trident': { icon: '🔱', animate: 'animate-pulse', size: 'text-xl' },
    'mace': { icon: '🙏', animate: '', size: 'text-xl' },
    'cross': { icon: '✝️', animate: 'animate-pulse', size: 'text-xl' },
    'egg': { icon: '🥚', animate: 'animate-bounce', size: 'text-xl' },
    'lantern': { icon: '🕌', animate: 'animate-flicker', size: 'text-xl' },
    'chariot': { icon: '🎡', animate: 'animate-spin-slow', size: 'text-xl' },
    'flute': { icon: '🪈', animate: 'animate-wiggle', size: 'text-xl' },
    'torch': { icon: '🔥', animate: 'animate-flicker', size: 'text-2xl' },
    'atom': { icon: '⚛️', animate: 'animate-spin-slow', size: 'text-xl' },
    'lotus': { icon: '🪷', animate: 'animate-grow-shrink', size: 'text-xl' },
    'book': { icon: '📚', animate: 'animate-wiggle-slow', size: 'text-xl' },
    'balloon': { icon: '🎈', animate: 'animate-fly', size: 'text-2xl' },
    'building': { icon: '🏗️', animate: '', size: 'text-xl' },
    'rocket': { icon: '🚀', animate: 'animate-fly', size: 'text-2xl' },
    'bonfire': { icon: '🔥', animate: 'animate-flicker', size: 'text-2xl' },
    'peace': { icon: '🕉️', animate: 'animate-spin-slow', size: 'text-xl' },
    'harvest': { icon: '🌾', animate: 'animate-sway', size: 'text-xl' },
    'tie': { icon: '👔', animate: '', size: 'text-xl' },
    'khanda': { icon: '☬', animate: 'animate-pulse', size: 'text-xl' },
    'gudi': { icon: '🪁', animate: 'animate-sway', size: 'text-2xl' },
    'sun': { icon: '☀️', animate: 'animate-spin-slow', size: 'text-xl' },
    'venus': { icon: '👩', animate: 'animate-pulse', size: 'text-xl' },
    'caduceus': { icon: '⚕️', animate: 'animate-pulse', size: 'text-xl' },
  };

  const config = decorations[decoration];
  if (!config) return null;

  return (
    <span
      className={`${config.size} filter drop-shadow-md ${config.animate}`}
      style={config.style || {}}
    >
      {config.icon}
    </span>
  );
}

function UserNavLinks({ mobile = false, onNavigate, signout }) {
  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef(null);

  const searchContainerRef = useRef(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [showEmailSetting, setShowEmailSetting] = useState(localStorage.getItem('showEmail') === 'true');

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'showEmail') {
        setShowEmailSetting(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    const handleCustomStorageChange = () => {
      setShowEmailSetting(localStorage.getItem('showEmail') === 'true');
    };
    window.addEventListener('settingsUpdated', handleCustomStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('settingsUpdated', handleCustomStorageChange);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Handle click outside to close search
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };

    if (searchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [searchOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const urlParams = new URLSearchParams(location.search);
    urlParams.set("searchTerm", searchTerm);
    const searchQuery = urlParams.toString();
    if (currentUser) {
      navigate(`/user/search?${searchQuery}`);
    } else {
      navigate(`/search?${searchQuery}`);
    }
    if (onNavigate) onNavigate();
    setSearchTerm("");
    setSearchOpen(false);
  };

  const handleSearchInputChange = (e) => {
    setSearchTerm(e.target.value);
    setShowSuggestions(true);
  };

  const handleSearchInputFocus = () => {
    if (searchTerm.trim().length >= 2) {
      setShowSuggestions(true);
    }
  };

  const handleSearchInputBlur = () => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchTerm(suggestion.displayText);
    setShowSuggestions(false);

    // Navigate to the property listing
    navigate(`/listing/${suggestion.id}`);
  };

  const handleSignout = async () => {
    if (signout) {
      await signout({
        showToast: true,
        navigateTo: "/",
        delay: 0
      });
    }
  };


  return (
    <ul className={`${mobile ? 'flex flex-col gap-1' : 'flex items-center space-x-1'}`}>
      {/* Desktop Search */}
      {!mobile && (
        <li className="flex items-center">
          <div className="relative" ref={searchContainerRef}>
            <form
              onSubmit={handleSubmit}
              className={`flex items-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg overflow-hidden transition-all duration-300 ${
                searchOpen ? 'ring-2 ring-yellow-300 bg-white/20' : ''
              }`}
            >
              <motion.div
                initial={false}
                animate={{ width: searchOpen ? "180px" : "0px" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="overflow-hidden"
              >
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search Properties..."
                  value={searchTerm}
                  onChange={handleSearchInputChange}
                  onFocus={handleSearchInputFocus}
                  onBlur={handleSearchInputBlur}
                  className="px-3 py-2 outline-none text-white placeholder-white/70 bg-transparent text-sm w-44"
                />
              </motion.div>
              <motion.button
                type="button"
                onClick={() => {
                  if (!searchOpen) {
                    setSearchOpen(true);
                  } else if (!searchTerm.trim()) {
                    setSearchOpen(false);
                  } else {
                    const dummyEvent = { preventDefault: () => {} };
                    handleSubmit(dummyEvent);
                  }
                }}
                whileHover={{ scale: 1.1, rotate: 10 }}
                whileTap={{ scale: 0.9, rotate: -10 }}
                className={`p-2 transition-colors duration-300 focus:outline-none flex items-center justify-center ${
                  searchOpen ? 'bg-yellow-400 text-gray-800 rounded-r-lg' : 'text-white hover:text-yellow-300 hover:bg-white/10 rounded-lg'
                }`}
                aria-label="Search"
              >
                <Realistic3DSearchIcon />
              </motion.button>
            </form>

            <SearchSuggestions
              searchTerm={searchTerm}
              onSuggestionClick={handleSuggestionClick}
              onClose={() => setShowSuggestions(false)}
              isVisible={showSuggestions}
              className="mt-1 w-64"
            />
          </div>
        </li>
      )}

      {/* Navigation Links */}
      <Link to={location.pathname.startsWith('/user') ? '/user' : '/'} onClick={onNavigate}>
        <li className={`${mobile ? 'flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 text-gray-700 dark:text-gray-200 font-medium animate-mobile-item-in' : 'text-white hover:text-yellow-300 transition-colors duration-300 font-medium text-base flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10'}`}>
          <FaHome className={`${mobile ? 'text-lg text-blue-500' : 'text-base text-blue-500'}`} />
          <span>Home</span>
        </li>
      </Link>



      {/* Public-only navigation links */}
      {!currentUser && (
        <>
          <Link to="/about" onClick={onNavigate}>
            <li className={`${mobile ? 'flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 text-gray-700 dark:text-gray-200 font-medium animate-mobile-item-in-delay-1' : 'text-white hover:text-yellow-300 transition-colors duration-300 font-medium text-base flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10'}`}>
              <FaInfoCircle className={`${mobile ? 'text-lg text-green-500' : 'text-base text-green-500'}`} />
              <span>About</span>
            </li>
          </Link>
          <Link to="/blogs" onClick={onNavigate}>
            <li className={`${mobile ? 'flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 text-gray-700 dark:text-gray-200 font-medium animate-mobile-item-in-delay-1' : 'text-white hover:text-yellow-300 transition-colors duration-300 font-medium text-base flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10'}`}>
              <FaBookOpen className={`${mobile ? 'text-lg text-blue-500' : 'text-base text-blue-500'}`} />
              <span>Blogs</span>
            </li>
          </Link>

          <Link to="/faqs" onClick={onNavigate}>
            <li className={`${mobile ? 'flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 text-gray-700 dark:text-gray-200 font-medium animate-mobile-item-in-delay-1' : 'text-white hover:text-yellow-300 transition-colors duration-300 font-medium text-base flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10'}`}>
              <FaQuestionCircle className={`${mobile ? 'text-lg text-orange-500' : 'text-base text-orange-500'}`} />
              <span>FAQs</span>
            </li>
          </Link>
          <Link to="/community" onClick={onNavigate}>
            <li className={`${mobile ? 'flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 text-gray-700 dark:text-gray-200 font-medium animate-mobile-item-in-delay-1' : 'text-white hover:text-yellow-300 transition-colors duration-300 font-medium text-base flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10'}`}>
              <FaUsers className={`${mobile ? 'text-lg text-pink-500' : 'text-base text-pink-500'}`} />
              <span>Community</span>
            </li>
          </Link>
        </>
      )}

      <Link to="/search" onClick={onNavigate}>
        <li className={`${mobile ? 'flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 text-gray-700 dark:text-gray-200 font-medium animate-mobile-item-in-delay-2' : 'text-white hover:text-yellow-300 transition-colors duration-300 font-medium text-base flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10'}`}>
          <FaCompass className={`${mobile ? 'text-lg text-purple-500' : 'text-base text-purple-500'}`} />
          <span>Explore</span>
        </li>
      </Link>



      {/* Movers, Services and Route Planner removed */}

      {currentUser && (
        <>
          <Link to="/user/community" onClick={onNavigate}>
            <li className={`${mobile ? 'flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 text-gray-700 dark:text-gray-200 font-medium animate-mobile-item-in-delay-2' : 'text-white hover:text-yellow-300 transition-colors duration-300 font-medium text-base flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10'}`}>
              <FaUsers className={`${mobile ? 'text-lg text-pink-500' : 'text-base text-pink-500'}`} />
              <span>Community</span>
            </li>
          </Link>
          <Link to="/user/create-listing" onClick={onNavigate}>
            <li className={`${mobile ? 'flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 text-gray-700 dark:text-gray-200 font-medium animate-mobile-item-in' : 'text-white hover:text-yellow-300 transition-colors duration-300 font-medium text-base flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10'}`}>
              <FaPlus className={`${mobile ? 'text-lg text-orange-500' : 'text-base text-orange-500'}`} />
              <span>Add Property</span>
            </li>
          </Link>

          <Link to="/user/my-listings" onClick={onNavigate}>
            <li className={`${mobile ? 'flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 text-gray-700 dark:text-gray-200 font-medium animate-mobile-item-in-delay-1' : 'text-white hover:text-yellow-300 transition-colors duration-300 font-medium text-base flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10'}`}>
              <FaList className={`${mobile ? 'text-lg text-indigo-500' : 'text-base text-indigo-500'}`} />
              <span>My Listings</span>
            </li>
          </Link>

          <Link to="/user/wishlist" onClick={onNavigate}>
            <li className={`${mobile ? 'flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 text-gray-700 dark:text-gray-200 font-medium animate-mobile-item-in-delay-2' : 'text-white hover:text-yellow-300 transition-colors duration-300 font-medium text-base flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10'}`}>
              <FaHeart className={`${mobile ? 'text-lg text-red-500' : 'text-base text-red-500'}`} />
              <span>My Wishlist</span>
            </li>
          </Link>

          <Link to="/user/my-appointments" onClick={onNavigate}>
            <li className={`${mobile ? 'flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 text-gray-700 dark:text-gray-200 font-medium animate-mobile-item-in-delay-3' : 'text-white hover:text-yellow-300 transition-colors duration-300 font-medium text-base flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10'}`}>
              <FaCalendarAlt className={`${mobile ? 'text-lg text-teal-500' : 'text-base text-teal-500'}`} />
              <span>My Appointments</span>
            </li>
          </Link>
        </>
      )}

      {!mobile && (
        <li className="flex items-center">
          <ThemeToggle mobile={mobile} />
        </li>
      )}

      {currentUser ? (
        <>
          <li className={`${mobile ? 'flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 text-gray-700 dark:text-gray-200 font-medium' : 'flex items-center relative md:mr-4 md:ml-2'}`}>
            <NotificationBell mobile={mobile} />
          </li>

          {/* Profile for mobile */}
          {mobile && (
            <>
              <li>
                <div
                  className="cursor-pointer transition-transform duration-300 hover:scale-110 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 flex items-center gap-3 text-gray-700 dark:text-gray-200 font-medium"
                  onClick={() => { navigate("/user/profile"); if (onNavigate) onNavigate(); }}
                  title="Profile"
                >
                  <UserAvatar
                    user={currentUser}
                    size="h-7 w-7"
                    textSize="text-xs"
                    showBorder={true}
                  />
                  <span>
                    {currentUser.firstName
                      ? (currentUser.firstName.length > 15 ? currentUser.firstName.substring(0, 15) + '...' : currentUser.firstName)
                      : (currentUser.username
                        ? (currentUser.username.length > 15 ? currentUser.username.substring(0, 15) + '...' : currentUser.username)
                        : 'Profile')}
                  </span>
                </div>
              </li>
              <li>
                <div
                  className="cursor-pointer transition-transform duration-300 hover:scale-110 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 flex items-center gap-3 text-gray-700 dark:text-gray-200 font-medium animate-mobile-item-in"
                  onClick={() => {
                    navigate('/user/reminders');
                    if (onNavigate) onNavigate();
                  }}
                  title="My Reminders"
                >
                  <FaClock className="text-lg text-indigo-500" />
                  <span>My Reminders</span>
                </div>
              </li>
              <li>
                <div
                  className="cursor-pointer transition-transform duration-300 hover:scale-110 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 flex items-center gap-3 text-gray-700 dark:text-gray-200 font-medium animate-mobile-item-in"
                  onClick={() => { navigate("/user/settings"); if (onNavigate) onNavigate(); }}
                  title="Settings"
                >
                  <Settings className="text-lg text-emerald-500 animate-spin-slow" style={{ animationDuration: '10s' }} />
                  <span>Settings</span>
                </div>
              </li>
              <li
                className="flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 text-gray-700 dark:text-gray-200 font-medium cursor-pointer animate-mobile-item-in"
                onClick={() => { handleSignout(); if (onNavigate) onNavigate(); }}
              >
                <LogOut className="text-lg text-red-500" />
                <span>Sign Out</span>
              </li>
            </>
          )}

          {/* Profile avatar for desktop/tablet */}
          {!mobile && (
            <li className="relative md:pl-2" ref={dropdownRef}>
              <div
                className="cursor-pointer transition-transform duration-300 hover:scale-105 flex items-center"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                title="Profile Menu"
              >
                <UserAvatar
                  user={currentUser}
                  size="h-8 w-8"
                  textSize="text-xs"
                  showBorder={true}
                />
              </div>

              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute right-0 mt-3 w-64 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-800/50 overflow-hidden z-50 origin-top-right text-gray-800 dark:text-gray-200"
                  >
                    {/* User Info Header */}
                    <div className="p-4 bg-gradient-to-br from-yellow-400/10 via-orange-400/5 to-transparent dark:from-yellow-400/5 dark:via-orange-400/2 dark:to-transparent border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                      <UserAvatar
                        user={currentUser}
                        size="h-10 w-10"
                        textSize="text-sm"
                        showBorder={true}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold truncate text-sm text-gray-900 dark:text-white">
                          {currentUser.firstName && currentUser.lastName
                            ? `${currentUser.firstName} ${currentUser.lastName}`
                            : currentUser.username || "User"}
                        </span>
                        {showEmailSetting && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {currentUser.email}
                          </span>
                        )}
                        {currentUser.isDefaultAdmin ? (
                          <span className="inline-flex items-center gap-1 text-[10px] w-fit font-semibold px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full mt-1 border border-red-200 dark:border-red-800/50 animate-pulse">
                            <FaCrown className="w-2.5 h-2.5 text-red-500" />
                            Default Admin
                          </span>
                        ) : currentUser.role === 'rootadmin' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] w-fit font-semibold px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full mt-1 border border-purple-200 dark:border-purple-800/50">
                            <FaCrown className="w-2.5 h-2.5 text-blue-500" />
                            Super Admin
                          </span>
                        ) : currentUser.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] w-fit font-semibold px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full mt-1 border border-purple-200 dark:border-purple-800/50">
                            <FaCrown className="w-2.5 h-2.5 text-blue-500" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] w-fit font-semibold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full mt-1 border border-blue-200 dark:border-blue-800/50">
                            User
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Navigation Items */}
                    <div className="p-2 flex flex-col gap-1">
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          if (currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
                            navigate('/admin/profile');
                          } else {
                            navigate('/user/profile');
                          }
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 font-medium group text-gray-700 dark:text-gray-300 border border-transparent hover:border-gray-200/50 dark:hover:border-gray-700/50"
                      >
                        <User className="text-blue-500 w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span>My Profile</span>
                      </button>

                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          navigate('/user/reminders');
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 font-medium group text-gray-700 dark:text-gray-300 border border-transparent hover:border-gray-200/50 dark:hover:border-gray-700/50"
                      >
                        <FaClock className="text-indigo-500 w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span>My Reminders</span>
                      </button>

                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          if (currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
                            navigate('/admin/settings');
                          } else {
                            navigate('/user/settings');
                          }
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 font-medium group text-gray-700 dark:text-gray-300 border border-transparent hover:border-gray-200/50 dark:hover:border-gray-700/50"
                      >
                        <Settings className="text-emerald-500 w-4 h-4 group-hover:rotate-45 transition-transform" />
                        <span>Settings</span>
                      </button>
                    </div>

                    {/* Sign Out Action */}
                    <div className="p-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/20">
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          handleSignout();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/25 transition-colors duration-200 font-semibold group border border-transparent hover:border-red-200/50 dark:hover:border-red-900/30"
                      >
                        <LogOut className="text-red-500 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )}


        </>
      ) : (
        <>
          {location.pathname !== '/sign-up' && (
            <Link to="/sign-up" onClick={onNavigate}>
              <li className={`${mobile ? 'flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 text-gray-700 dark:text-gray-200 font-medium animate-mobile-item-in' : 'text-white hover:text-yellow-300 transition-colors duration-300 font-medium text-base flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10'}`}>
                <UserPlus className={`${mobile ? 'text-lg text-green-500' : 'text-base text-green-500'}`} />
                <span>Get Started</span>
              </li>
            </Link>
          )}

          {location.pathname !== '/sign-in' && (
            <Link to="/sign-in" onClick={onNavigate}>
              <li className={`${mobile ? 'flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 text-gray-700 dark:text-gray-200 font-medium animate-mobile-item-in' : 'text-white hover:text-yellow-300 transition-colors duration-300 font-medium text-base flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10'}`}>
                <LogIn className={`${mobile ? 'text-lg text-blue-500' : 'text-base text-blue-500'}`} />
                <span>Sign In</span>
              </li>
            </Link>
          )}
        </>
      )}
    </ul>
  );
}