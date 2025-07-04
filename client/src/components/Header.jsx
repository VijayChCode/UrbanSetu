import React, { useEffect, useState, useRef } from "react";
import { FaSearch, FaHome, FaInfoCircle, FaCompass, FaPlus, FaList, FaHeart, FaCalendarAlt, FaUser, FaSignOutAlt, FaStar, FaBars, FaTimes } from "react-icons/fa";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { signoutUserSuccess } from "../redux/user/userSlice.js";
import NotificationBell from "./NotificationBell.jsx";
import { persistor } from '../redux/store';
import { reconnectSocket } from "../utils/socket";

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
          className="text-white text-2xl p-2 focus:outline-none"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label="Open navigation menu"
        >
          {mobileMenuOpen ? <FaTimes /> : <FaBars />}
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
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex flex-col items-end sm:hidden">
          <div className="w-3/4 max-w-xs bg-white h-full shadow-lg p-6 flex flex-col gap-4 animate-slide-in-right">
            <button
              className="self-end text-2xl text-gray-700 mb-2"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
            >
              <FaTimes />
            </button>
            <form onSubmit={handleSubmit} className="flex items-center border rounded-lg overflow-hidden bg-white mb-4 focus-within:ring-2 focus-within:ring-yellow-300 transition-all w-full">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-2 py-1 outline-none w-full text-black focus:bg-blue-50 transition-colors text-sm"
              />
              <button className={`${getSearchButtonColor()} text-white p-2 hover:bg-yellow-400 hover:text-blue-700 transition-colors`} type="submit">
                <FaSearch />
              </button>
            </form>
            <UserNavLinks mobile onNavigate={() => setMobileMenuOpen(false)} />
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
      const res = await fetch("/api/auth/signout", { method: "GET" });
      const data = await res.json();
      if (data.success === false) {
        console.log(data.message);
        return;
      }
      dispatch(signoutUserSuccess());
      await persistor.purge();
      alert("You have been signed out.");
      navigate("/sign-in");
      reconnectSocket();
    } catch (error) {
      console.log(error.message);
      dispatch(signoutUserSuccess());
      await persistor.purge();
      alert("You have been signed out.");
      navigate("/sign-in");
      reconnectSocket();
    }
  };

  return (
    <ul className={`${mobile ? 'flex flex-col gap-4 text-gray-800 text-lg' : 'flex space-x-2 sm:space-x-4 items-center text-white text-base font-normal'}`}>
      {/* Search icon/input first, white color */}
      {!mobile ? (
        <li className="flex items-center">
          {!searchOpen ? (
            <button
              className="p-2 text-white hover:text-yellow-300 focus:outline-none transition-all"
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
              <button className={`bg-blue-500 hover:bg-blue-600 text-white p-2 hover:bg-yellow-400 hover:text-blue-700 transition-colors`} type="submit">
                <FaSearch />
              </button>
            </form>
          )}
        </li>
      ) : null}
      <Link to={location.pathname.startsWith('/user') ? '/user' : '/'} onClick={onNavigate}>
        <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaHome /> Home</li>
      </Link>
      <Link to="/about" onClick={onNavigate}>
        <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaInfoCircle /> About</li>
      </Link>
      <Link to="/search" onClick={onNavigate}>
        <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaCompass /> Explore</li>
      </Link>
      {currentUser && (
        <>
          <Link to="/user/create-listing" onClick={onNavigate}>
            <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaPlus /> Add Property</li>
          </Link>
          <Link to="/user/my-listings" onClick={onNavigate}>
            <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaList /> My Listings</li>
          </Link>
          <Link to="/user/wishlist" onClick={onNavigate}>
            <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaHeart /> Wish List</li>
          </Link>
          <Link to="/user/my-appointments" onClick={onNavigate}>
            <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaCalendarAlt /> My Appointments</li>
          </Link>
        </>
      )}
      {currentUser ? (
        <>
          <li className="flex items-center">
            <NotificationBell mobile={mobile} />
          </li>
          <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 cursor-pointer transition-all" onClick={() => { handleSignout(); if (onNavigate) onNavigate(); }}>
            <FaSignOutAlt /> Sign Out
          </li>
          {/* Profile avatar for desktop/tablet */}
          {!mobile && (
            <li>
              <img
                alt="avatar"
                src={currentUser.avatar}
                className="h-8 w-8 rounded-full border-2 border-gray-300 shadow cursor-pointer transition-transform duration-300 hover:scale-110 object-cover"
                onClick={() => {
                  if (currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
                    navigate('/admin/profile');
                  } else {
                    navigate('/user/profile');
                  }
                  if (onNavigate) onNavigate();
                }}
                title="Profile"
              />
            </li>
          )}
          {mobile && (
            <li>
              <img
                alt="avatar"
                src={currentUser.avatar}
                className="h-8 w-8 rounded-full border-2 border-gray-300 shadow cursor-pointer transition-transform duration-300 hover:scale-110 object-cover"
                onClick={() => { navigate("/user/profile"); if (onNavigate) onNavigate(); }}
                title="Profile"
              />
            </li>
          )}
        </>
      ) : (
        <Link to="/sign-in" onClick={onNavigate}>
          <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaUser /> Sign In</li>
        </Link>
      )}
    </ul>
  );
}
