import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { signoutUserStart, signoutUserSuccess, signoutUserFailure } from "../redux/user/userSlice";
import { FaHome, FaCalendarAlt, FaPlus, FaSignOutAlt, FaSearch, FaUserCheck, FaList, FaInfoCircle, FaCompass, FaHeart } from "react-icons/fa";

export default function AdminHeader() {
  const { currentUser } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [fadeIn, setFadeIn] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);

  useEffect(() => {
    setFadeIn(true);
    // Only fetch pending count and appointment count for approved admin
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin') && currentUser.adminApprovalStatus === 'approved') {
      fetchPendingCount();
      fetchAppointmentCount();
    }
  }, [currentUser]);

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
      const res = await fetch('http://localhost:3000/api/admin/pending-requests', {
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
      const res = await fetch('http://localhost:3000/api/bookings', {
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
      const res = await fetch("/api/auth/signout");
      const data = await res.json();
      if (data.success === false) {
        dispatch(signoutUserFailure(data.message));
      } else {
        dispatch(signoutUserSuccess(data));
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
    <div className={`flex justify-between items-center px-6 py-3 ${getHeaderGradient()} shadow-lg sticky top-0 z-50 transition-opacity duration-700 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
      <Link to="/admin">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide drop-shadow flex items-center gap-2 transition-transform duration-300 hover:scale-110 group">
          <span className="relative flex items-center justify-center">
            <FaHome className="text-3xl md:text-4xl text-yellow-400 drop-shadow-lg animate-bounce-slow group-hover:animate-bounce" style={{ filter: 'drop-shadow(0 2px 8px #facc15)' }} />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-gradient-to-r from-yellow-300 to-purple-400 rounded-full opacity-60 blur-sm"></span>
          </span>
          <span className="bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 bg-clip-text text-transparent animate-gradient-x">Admin</span>
          <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent animate-gradient-x">Panel</span>
        </h1>
      </Link>
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex items-center border rounded-lg overflow-hidden bg-white mx-4 focus-within:ring-2 focus-within:ring-yellow-300 transition-all">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-2 outline-none w-40 sm:w-64 text-black focus:bg-blue-50 transition-colors"
        />
        <button className={`${getSearchButtonColor()} text-white p-2 hover:bg-yellow-400 hover:text-blue-700 transition-colors`} type="submit">
          <FaSearch />
        </button>
      </form>
      <ul className="flex space-x-6 items-center text-white text-base font-normal">
        <Link to="/admin">
          <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaHome /> Dashboard</li>
        </Link>
        <Link to="/admin/appointments">
          <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all relative">
            <FaCalendarAlt /> Appointments
            {appointmentCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {appointmentCount}
              </span>
            )}
          </li>
        </Link>
        <Link to="/admin/create-listing">
          <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaPlus /> Add Property</li>
        </Link>
        <Link to="/admin/listings">
          <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaList /> All Listings</li>
        </Link>
        {/* Only show Requests link for approved admin */}
        {currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin') && currentUser.adminApprovalStatus === 'approved' && (
          <Link to="/admin/requests">
            <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all relative cursor-pointer">
              <FaUserCheck />
              Requests
              {pendingCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </li>
          </Link>
        )}
        <Link to="/admin/about">
          <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaInfoCircle /> About</li>
        </Link>
        <Link to="/admin/explore">
          <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaCompass /> Explore</li>
        </Link>
        <Link to="/admin/wishlist">
          <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaHeart /> Wish List</li>
        </Link>
        <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 cursor-pointer transition-all" onClick={handleSignout}>
          <FaSignOutAlt /> Sign Out
        </li>
        <li>
          {currentUser && (
            <img
              alt="avatar"
              src={currentUser.avatar}
              className="h-8 w-8 rounded-full border-2 border-white shadow cursor-pointer transition-transform duration-300 hover:scale-110 object-cover"
              onClick={() => navigate("/admin/profile")}
              title="Profile"
            />
          )}
        </li>
      </ul>
    </div>
  );
} 