import React, { useEffect, useState, useRef } from "react";
import { FaSearch, FaHome, FaInfoCircle, FaCompass, FaPlus, FaList, FaHeart, FaCalendarAlt, FaUser, FaSignOutAlt, FaStar, FaBars, FaTimes } from "react-icons/fa";
import UserAvatar from "./UserAvatar";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { signoutUserSuccess } from "../redux/user/userSlice.js";
import NotificationBell from "./NotificationBell.jsx";
import { persistor } from '../redux/store';
import { reconnectSocket } from "../utils/socket";
import { toast } from 'react-toastify';

export default function Header() {
  const { currentUser } = useSelector((state) => state.user);
  const [searchTerm, setSearchTerm] = useState("");
  const [fadeIn, setFadeIn] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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
      "/admin", "/admin/appointments", "/admin/about", "/admin/explore", "/admin/create-listing", "/admin/listings", "/admin/my-listings", "/admin/update-listing", "/admin/wishlist", "/admin/profile", "/admin/change-password", "/admin/requests", "/admin/listing", "/admin/appointmentlisting",
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
        return 'bg-gradient-to-r from-blue-600 to-blue-700'; // Blue for sign-in
      case '/sign-up':
        return 'bg-gradient-to-r from-green-600 to-green-700'; // Green for sign-up
      case '/forgot-password':
        return 'bg-gradient-to-r from-red-600 to-red-700'; // Red for forgot-password verification step
      case '/change-password':
      case '/user/change-password':
        return 'bg-gradient-to-r from-green-600 to-green-700'; // Green for change-password
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
      "/admin", "/admin/appointments", "/admin/about", "/admin/explore", "/admin/create-listing", "/admin/listings", "/admin/my-listings", "/admin/update-listing", "/admin/wishlist", "/admin/profile", "/admin/change-password", "/admin/requests", "/admin/listing", "/admin/appointmentlisting",
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
        return 'bg-green-500 hover:bg-green-600'; // Green for change-password
      default:
        return 'bg-blue-500 hover:bg-blue-600'; // Default blue
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
    // Clear the search term after navigation
    setSearchTerm("");
  };

  return (
    <div className={`flex min-w-0 items-center justify-between px-2 sm:px-4 md:px-6 py-2 sm:py-3 ${getHeaderGradient()} shadow-lg sticky top-0 z-50 transition-all duration-300 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
      {/* Logo/Title */}
      <Link to={location.pathname.startsWith('/user') ? '/user' : '/'} className="flex-shrink-0">
        <h1 className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-extrabold tracking-wide drop-shadow flex items-center gap-2 transition-transform duration-300 hover:scale-110 group">
          <span className="relative flex items-center justify-center">
            <FaHome className="text-2xl xs:text-3xl md:text-4xl text-yellow-400 drop-shadow-lg animate-bounce-slow group-hover:animate-bounce" style={{ filter: 'drop-shadow(0 2px 8px #facc15)' }} />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-gradient-to-r from-yellow-300 to-purple-400 rounded-full opacity-60 blur-sm"></span>
          </span>
          <span className="bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 bg-clip-text text-transparent animate-gradient-x">Urban</span>
          <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent animate-gradient-x">Setu</span>
        </h1>
      </Link>
      {/* Hamburger menu for mobile (right side) */}
      <div className="flex items-center sm:hidden">
        <button
          className="text-white text-2xl p-2 focus:outline-none transition-all duration-300 hover:scale-110 hover:text-yellow-300 rounded-lg hover:bg-white/10"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label="Open navigation menu"
        >
          <div className={`transition-transform duration-300 ${mobileMenuOpen ? 'animate-hamburger-to-x' : 'animate-x-to-hamburger'}`}>
            {mobileMenuOpen ? <FaTimes /> : <FaBars />}
          </div>
        </button>
      </div>
      {/* Desktop nav links */}
      <div className="hidden sm:block">
        <div className="flex items-center gap-2">
          {/* Nav links start with Home */}
          <UserNavLinks />
        </div>
      </div>
      {/* Mobile nav menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-end sm:hidden">
          {/* Backdrop with blur effect */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-backdrop-blur-in"
            onClick={() => setMobileMenuOpen(false)}
            style={{ pointerEvents: 'auto' }}
          />
          {/* Menu content */}
          <div className="relative w-4/5 max-w-sm h-full mobile-menu-content animate-slide-in-right overflow-hidden">
            <div className="flex flex-col h-full p-6">
              {/* Close button */}
              <button
                className="self-end text-2xl text-gray-700 mb-6 p-2 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
              >
                <FaTimes />
              </button>
              
              {/* Search form */}
              <form onSubmit={handleSubmit} className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden bg-white mb-6 focus-within:ring-2 focus-within:ring-blue-300 focus-within:border-blue-300 transition-all duration-300 shadow-sm hover:shadow-md">
                <input
                  type="text"
                  placeholder="Search properties..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-4 py-3 outline-none w-full text-gray-800 focus:bg-blue-50 transition-colors text-sm"
                />
                <button className={`${getSearchButtonColor()} text-white p-3 hover:bg-yellow-400 hover:text-blue-700 transition-all duration-300 transform hover:scale-110 hover:shadow-lg`} type="submit">
                  <FaSearch className="text-lg" />
                </button>
              </form>
              
              {/* Navigation links */}
              <div className="flex-1 overflow-y-auto">
                <UserNavLinks mobile onNavigate={() => setMobileMenuOpen(false)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserNavLinks({ mobile = false, onNavigate }) {
  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
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

  const handleSignout = async () => {
    try {
      const res = await fetch("/api/auth/signout", { method: "GET", credentials: "include" });
      const data = await res.json();
      if (data.success === false) {
        console.log(data.message);
        return;
      }
      dispatch(signoutUserSuccess());
      await persistor.purge();
      reconnectSocket();
      localStorage.removeItem('accessToken');
      document.cookie = 'access_token=; Max-Age=0; path=/; domain=' + window.location.hostname + '; secure; samesite=None';
      toast.info("You have been signed out.");
      navigate("/sign-in");
    } catch (error) {
      console.log(error.message);
      dispatch(signoutUserSuccess());
      await persistor.purge();
      reconnectSocket();
      localStorage.removeItem('accessToken');
      document.cookie = 'access_token=; Max-Age=0; path=/; domain=' + window.location.hostname + '; secure; samesite=None';
      toast.info("You have been signed out.");
      navigate("/sign-in");
    }
  };

  return (
    <ul className={`${mobile ? 'flex flex-col gap-2 text-gray-800' : 'flex space-x-2 sm:space-x-4 items-center text-white text-base font-normal'}`}>
      {/* Search icon/input first, white color */}
      {!mobile ? (
        <li className="flex items-center">
          {!searchOpen ? (
            <button
              className="p-2 text-white hover:text-yellow-300 focus:outline-none transition-all transform hover:scale-110 hover:bg-white/10 rounded-full"
              onClick={() => setSearchOpen(true)}
              aria-label="Open search"
            >
              <FaSearch className="text-lg" />
            </button>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex items-center border rounded-lg overflow-hidden bg-white mx-2 sm:mx-4 focus-within:ring-2 focus-within:ring-yellow-300 transition-all w-28 xs:w-40 sm:w-64 animate-fade-in"
            >
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onBlur={() => setSearchOpen(false)}
                className="px-2 py-1 sm:px-3 sm:py-2 outline-none w-full text-black focus:bg-blue-50 transition-colors text-sm sm:text-base"
              />
              <button className={`bg-blue-500 hover:bg-blue-600 text-white p-2 hover:bg-yellow-400 hover:text-blue-700 transition-all transform hover:scale-110 hover:shadow-lg`} type="submit">
                <FaSearch className="text-sm" />
              </button>
            </form>
          )}
        </li>
      ) : null}
      
      {/* Mobile menu items with staggered animations */}
      <Link to={location.pathname.startsWith('/user') ? '/user' : '/'} onClick={onNavigate}>
        <li className={`mobile-menu-item ${mobile ? 'animate-menu-item-in p-4 rounded-xl hover:bg-blue-50 transition-all duration-300 flex items-center gap-3 text-lg font-medium' : 'hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all'}`}>
          <FaHome className="text-xl text-blue-500" /> 
          <span>Home</span>
        </li>
      </Link>
      
      <Link to="/about" onClick={onNavigate}>
        <li className={`mobile-menu-item ${mobile ? 'animate-menu-item-in-delay-1 p-4 rounded-xl hover:bg-blue-50 transition-all duration-300 flex items-center gap-3 text-lg font-medium' : 'hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all'}`}>
          <FaInfoCircle className="text-xl text-green-500" /> 
          <span>About</span>
        </li>
      </Link>
      
      <Link to="/search" onClick={onNavigate}>
        <li className={`mobile-menu-item ${mobile ? 'animate-menu-item-in-delay-2 p-4 rounded-xl hover:bg-blue-50 transition-all duration-300 flex items-center gap-3 text-lg font-medium' : 'hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all'}`}>
          <FaCompass className="text-xl text-purple-500" /> 
          <span>Explore</span>
        </li>
      </Link>
      
      {currentUser && (
        <>
          <Link to="/user/create-listing" onClick={onNavigate}>
            <li className={`mobile-menu-item ${mobile ? 'animate-menu-item-in-delay-3 p-4 rounded-xl hover:bg-blue-50 transition-all duration-300 flex items-center gap-3 text-lg font-medium' : 'hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all'}`}>
              <FaPlus className="text-xl text-orange-500" /> 
              <span>Add Property</span>
            </li>
          </Link>
          
          <Link to="/user/my-listings" onClick={onNavigate}>
            <li className={`mobile-menu-item ${mobile ? 'animate-menu-item-in-delay-4 p-4 rounded-xl hover:bg-blue-50 transition-all duration-300 flex items-center gap-3 text-lg font-medium' : 'hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all'}`}>
              <FaList className="text-xl text-indigo-500" /> 
              <span>My Listings</span>
            </li>
          </Link>
          
          <Link to="/user/wishlist" onClick={onNavigate}>
            <li className={`mobile-menu-item ${mobile ? 'animate-menu-item-in-delay-5 p-4 rounded-xl hover:bg-blue-50 transition-all duration-300 flex items-center gap-3 text-lg font-medium' : 'hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all'}`}>
              <FaHeart className="text-xl text-red-500" /> 
              <span>Wish List</span>
            </li>
          </Link>
          
          <Link to="/user/my-appointments" onClick={onNavigate}>
            <li className={`mobile-menu-item ${mobile ? 'animate-menu-item-in-delay-6 p-4 rounded-xl hover:bg-blue-50 transition-all duration-300 flex items-center gap-3 text-lg font-medium' : 'hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all'}`}>
              <FaCalendarAlt className="text-xl text-teal-500" /> 
              <span>My Appointments</span>
            </li>
          </Link>
        </>
      )}
      
      {currentUser ? (
        <>
          <li className={`mobile-menu-item ${mobile ? 'animate-menu-item-in-delay-1 p-4 rounded-xl hover:bg-blue-50 transition-all duration-300 flex items-center gap-3 text-lg font-medium' : 'flex items-center relative'}`}>
            <NotificationBell mobile={mobile} />
          </li>
          
          <li 
            className={`mobile-menu-item ${mobile ? 'animate-menu-item-in-delay-2 p-4 rounded-xl hover:bg-red-50 transition-all duration-300 flex items-center gap-3 text-lg font-medium cursor-pointer' : 'hover:text-yellow-300 hover:scale-110 flex items-center gap-1 cursor-pointer transition-all'}`} 
            onClick={() => { handleSignout(); if (onNavigate) onNavigate(); }}
          >
            <FaSignOutAlt className={`text-xl ${mobile ? 'text-red-500' : ''}`} /> 
            <span>Sign Out</span>
          </li>
          
          {/* Profile avatar for desktop/tablet */}
          {!mobile && (
            <li>
              <div
                className="cursor-pointer transition-transform duration-300 hover:scale-110"
                onClick={() => {
                  if (currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
                    navigate('/admin/profile');
                  } else {
                    navigate('/user/profile');
                  }
                  if (onNavigate) onNavigate();
                }}
                title="Profile"
              >
                <UserAvatar 
                  user={currentUser} 
                  size="h-8 w-8" 
                  textSize="text-xs"
                  showBorder={true}
                />
              </div>
            </li>
          )}
          
          {/* Profile for mobile */}
          {mobile && (
            <li className="mobile-menu-item animate-menu-item-in-delay-3">
              <div
                className="cursor-pointer transition-transform duration-300 hover:scale-110 p-4 rounded-xl hover:bg-blue-50 transition-all duration-300 flex items-center gap-3 text-lg font-medium"
                onClick={() => { navigate("/user/profile"); if (onNavigate) onNavigate(); }}
                title="Profile"
              >
                <UserAvatar 
                  user={currentUser} 
                  size="h-8 w-8" 
                  textSize="text-xs"
                  showBorder={true}
                />
                <span>Profile</span>
              </div>
            </li>
          )}
        </>
      ) : (
        <Link to="/sign-in" onClick={onNavigate}>
          <li className={`mobile-menu-item ${mobile ? 'animate-menu-item-in-delay-1 p-4 rounded-xl hover:bg-blue-50 transition-all duration-300 flex items-center gap-3 text-lg font-medium' : 'hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all'}`}>
            <FaUser className="text-xl text-blue-500" /> 
            <span>Sign In</span>
          </li>
        </Link>
      )}
    </ul>
  );
}
