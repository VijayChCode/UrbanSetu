import React, { useEffect, useState } from "react";
import { FaSearch, FaHome, FaInfoCircle, FaCompass, FaPlus, FaList, FaHeart, FaCalendarAlt, FaUser, FaSignOutAlt } from "react-icons/fa";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { signoutUserSuccess } from "../redux/user/userSlice.js";

export default function Header() {
  const { currentUser } = useSelector((state) => state.user);
  const [searchTerm, setSearchTerm] = useState("");
  const [fadeIn, setFadeIn] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setFadeIn(true);
    const urlParams = new URLSearchParams(location.search);
    const searchTermFromUrl = urlParams.get("searchTerm");
    if (searchTermFromUrl) {
      setSearchTerm(searchTermFromUrl);
    }
  }, [location.search]);

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
    navigate(`/search?${searchQuery}`);
  };

  return (
    <div className={`flex justify-between items-center px-6 py-3 ${getHeaderGradient()} shadow-lg sticky top-0 z-50 transition-all duration-300 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
      <Link to={location.pathname.startsWith('/user') ? '/user' : '/'}>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide drop-shadow flex items-center gap-2 transition-transform duration-300 hover:scale-110 group">
          <span className="relative flex items-center justify-center">
            <FaHome className="text-3xl md:text-4xl text-yellow-400 drop-shadow-lg animate-bounce-slow group-hover:animate-bounce" style={{ filter: 'drop-shadow(0 2px 8px #facc15)' }} />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-gradient-to-r from-yellow-300 to-purple-400 rounded-full opacity-60 blur-sm"></span>
          </span>
          <span className="bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 bg-clip-text text-transparent animate-gradient-x">Urban</span>
          <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent animate-gradient-x">Setu</span>
        </h1>
      </Link>
      <form onSubmit={handleSubmit} className="flex items-center border rounded-lg overflow-hidden bg-white mx-4 focus-within:ring-2 focus-within:ring-yellow-300 transition-all">
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
      <UserNavLinks />
    </div>
  );
}

function UserNavLinks() {
  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();

  const handleSignout = async () => {
    try {
      const res = await fetch("/api/auth/signout", {
        method: "GET",
      });
      const data = await res.json();
      if (data.success === false) {
        console.log(data.message);
        return;
      }
      dispatch(signoutUserSuccess());
      navigate("/sign-in");
    } catch (error) {
      console.log(error.message);
      // Even if API call fails, clear local state and redirect
      dispatch(signoutUserSuccess());
      navigate("/sign-in");
    }
  };

  return (
    <ul className="flex space-x-4 items-center text-white text-base font-normal">
      <Link to={location.pathname.startsWith('/user') ? '/user' : '/'}>
        <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaHome /> Home</li>
      </Link>
      <Link to="/about">
        <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaInfoCircle /> About</li>
      </Link>
      <Link to="/search">
        <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaCompass /> Explore</li>
      </Link>
      {currentUser && (
        <>
          <Link to="/user/create-listing">
            <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaPlus /> Add Property</li>
          </Link>
          <Link to="/user/my-listings">
            <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaList /> My Listings</li>
          </Link>
          <Link to="/user/wishlist">
            <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaHeart /> Wish List</li>
          </Link>
          <Link to="/user/my-appointments">
            <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaCalendarAlt /> My Appointments</li>
          </Link>
        </>
      )}
      {currentUser ? (
        <>
          <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 cursor-pointer transition-all" onClick={handleSignout}>
            <FaSignOutAlt /> Sign Out
          </li>
          <li>
            <img
              alt="avatar"
              src={currentUser.avatar}
              className="h-8 w-8 rounded-full border-2 border-white shadow cursor-pointer transition-transform duration-300 hover:scale-110 object-cover"
              onClick={() => navigate("/user/profile")}
              title="Profile"
            />
          </li>
        </>
      ) : (
        <Link to="/sign-in">
          <li className="hover:text-yellow-300 hover:scale-110 flex items-center gap-1 transition-all"><FaUser /> Sign In</li>
        </Link>
      )}
    </ul>
  );
}
