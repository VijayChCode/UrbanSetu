import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { signoutUserStart, signoutUserSuccess, signoutUserFailure } from "../redux/user/userSlice";
import { FaHome, FaCalendarAlt, FaPlus, FaSignOutAlt, FaSearch, FaUserCheck, FaList, FaInfoCircle, FaCompass, FaBars, FaTimes, FaUser } from "react-icons/fa";
import UserAvatar from "./UserAvatar";
import NotificationBell from "./NotificationBell.jsx";
import { persistor } from '../redux/store';
import { reconnectSocket } from "../utils/socket";
import { toast } from 'react-toastify';

export default function AdminHeader() {
  const { currentUser } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [fadeIn, setFadeIn] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    setFadeIn(true);
    // Only fetch pending count and appointment count for approved admin
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin') && currentUser.adminApprovalStatus === 'approved') {
      fetchPendingCount();
      fetchAppointmentCount();
    }
  }, [currentUser]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Function to get header gradient based on current route
  const getHeaderGradient = () => {
    const path = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    
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
      case '/admin/change-password':
        return 'bg-gradient-to-r from-green-600 to-green-700'; // Green for change-password
      default:
        return 'bg-gradient-to-r from-blue-700 to-purple-700'; // Default blue-purple
    }
  };

  // Function to get search button color based on current route
  const getSearchButtonColor = () => {
    const path = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    
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
      case '/admin/change-password':
        return 'bg-green-500 hover:bg-green-600'; // Green for change-password
      default:
        return 'bg-blue-500 hover:bg-blue-600'; // Default blue
    }
  };

  const fetchPendingCount = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/pending-requests`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setPendingCount(data.length);
      }
    } catch (error) {
      console.error('Failed to fetch pending count:', error);
    }
  };

  const fetchAppointmentCount = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setAppointmentCount(data.length);
      }
    } catch (error) {
      console.error('Failed to fetch appointment count:', error);
    }
  };

  const handleSignout = async () => {
    try {
      dispatch(signoutUserStart());
      const res = await fetch(`${API_BASE_URL}/api/auth/signout`, { credentials: 'include' });
      const data = await res.json();
      if (data.success === false) {
        dispatch(signoutUserFailure(data.message));
      } else {
        dispatch(signoutUserSuccess());
        await persistor.purge();
        reconnectSocket();
        localStorage.removeItem('accessToken');
        document.cookie = 'access_token=; Max-Age=0; path=/; domain=' + window.location.hostname + '; secure; samesite=None';
        toast.info("You have been signed out.");
        navigate("/sign-in");
      }
    } catch (error) {
      dispatch(signoutUserFailure(error.message));
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/admin/explore?searchTerm=${encodeURIComponent(searchTerm)}`);
      setSearchTerm("");
    }
  };

  return (
    <div className={`flex items-center justify-between px-2 sm:px-6 py-2 sm:py-3 ${getHeaderGradient()} shadow-lg sticky top-0 z-50 transition-all duration-300 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
      <Link to="/admin" className="flex-shrink-0">
        <h1 className="text-xl xs:text-2xl md:text-3xl font-extrabold tracking-wide drop-shadow flex items-center gap-2 transition-transform duration-300 hover:scale-110 group">
          <span className="relative flex items-center justify-center">
            <FaHome className="text-2xl xs:text-3xl md:text-4xl text-yellow-400 drop-shadow-lg animate-bounce-slow group-hover:animate-bounce" style={{ filter: 'drop-shadow(0 2px 8px #facc15)' }} />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-gradient-to-r from-yellow-300 to-purple-400 rounded-full opacity-60 blur-sm"></span>
          </span>
          <span className="bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 bg-clip-text text-transparent animate-gradient-x">Admin</span>
          <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent animate-gradient-x">Panel</span>
        </h1>
      </Link>
      {/* Desktop nav links */}
      <div className="hidden sm:block">
        <div className="flex items-center gap-2">
          {/* Search icon/input first, white color */}
          <div className="hidden sm:flex items-center relative">
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
                onSubmit={handleSearch}
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
                <button className={`${getSearchButtonColor()} text-white p-2 hover:bg-yellow-400 hover:text-blue-700 transition-colors`} type="submit">
                  <FaSearch />
                </button>
              </form>
            )}
          </div>
          {/* Nav links start with Dashboard */}
          <AdminNavLinks pendingCount={pendingCount} handleSignout={handleSignout} currentUser={currentUser} />
        </div>
      </div>
      {/* Hamburger menu for mobile */}
      <div className="flex items-center sm:hidden">
        <button
          className="text-white text-2xl p-2 focus:outline-none"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label="Open navigation menu"
        >
          {mobileMenuOpen ? <FaTimes /> : <FaBars />}
        </button>
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
            <form onSubmit={handleSearch} className="flex items-center border rounded-lg overflow-hidden bg-white mb-4 focus-within:ring-2 focus-within:ring-yellow-300 transition-all w-full">
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
            <AdminNavLinks mobile onNavigate={() => setMobileMenuOpen(false)} pendingCount={pendingCount} handleSignout={handleSignout} currentUser={currentUser} />
          </div>
        </div>
      )}
    </div>
  );
}

function AdminNavLinks({ mobile = false, onNavigate, pendingCount, handleSignout, currentUser }) {
  const navigate = useNavigate();
  return (
    <ul className={`${mobile ? 'flex flex-col gap-4 text-gray-800 text-lg' : 'flex space-x-2 sm:space-x-4 items-center text-white text-base font-normal'}`}>
      <Link to="/admin" onClick={onNavigate}><li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaHome /> Dashboard</li></Link>
      <Link to="/admin/create-listing" onClick={onNavigate}><li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaPlus /> Add Property</li></Link>
      <Link to="/admin/listings" onClick={onNavigate}><li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaList /> All Listings</li></Link>
      {currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin') && currentUser.adminApprovalStatus === 'approved' && (
        <Link to="/admin/requests" onClick={onNavigate}><li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all relative cursor-pointer"><FaUserCheck /> Requests{pendingCount > 0 && (<span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{pendingCount}</span>)}</li></Link>
      )}
      <Link to="/admin/about" onClick={onNavigate}><li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaInfoCircle /> About</li></Link>
      <Link to="/admin/explore" onClick={onNavigate}><li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaCompass /> Explore</li></Link>
      <li className="flex items-center"><NotificationBell mobile={mobile} /></li>
      <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 cursor-pointer transition-all" onClick={() => { handleSignout(); if (onNavigate) onNavigate(); }}><FaSignOutAlt /> Sign Out</li>
      {/* Profile avatar for desktop/tablet */}
      {currentUser && !mobile && (
        <li>
          <div
            className="cursor-pointer transition-transform duration-300 hover:scale-110"
            onClick={() => { navigate("/admin/profile"); if (onNavigate) onNavigate(); }}
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
      {currentUser && mobile && (
        <li>
          <div
            className="cursor-pointer transition-transform duration-300 hover:scale-110"
            onClick={() => { navigate("/admin/profile"); if (onNavigate) onNavigate(); }}
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
    </ul>
  );
} 