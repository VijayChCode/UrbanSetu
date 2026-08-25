import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaHome, FaEnvelope, FaPhone, FaMapMarkerAlt, FaCookie, FaShieldAlt, FaFileContract, FaEye, FaHandshake, FaRobot, FaExclamationTriangle, FaServer, FaDownload, FaBullhorn, FaSearch, FaInfoCircle, FaHeadset, FaPlusCircle, FaCalendarAlt, FaRoute, FaCheckCircle, FaBookOpen, FaQuestionCircle, FaChartLine, FaBook, FaUserTie, FaCalculator } from 'react-icons/fa';
import { authenticatedFetch } from '../utils/auth';

import { API_BASE_URL } from '../config/api';

const Footer = () => {
  const { currentUser } = useSelector((state) => state.user);
  const [visitorStats, setVisitorStats] = useState({ todayCount: 0, totalVisitors: 0 });

  // Fetch visitor stats
  useEffect(() => {
    const fetchVisitorStats = async () => {
      try {
        let today = 0;
        let total = 0;

        // 1. Fetch Daily Count (Confirmed Public Endpoint)
        try {
          const dailyRes = await authenticatedFetch(`${API_BASE_URL}/api/visitors/count/daily`);
          if (dailyRes.ok) {
            const dailyData = await dailyRes.json();
            if (dailyData.success) {
              today = dailyData.count;
              // Check if total is coincidentally returned here
              if (dailyData.total !== undefined) total = dailyData.total;
            }
          }
        } catch (e) {
          console.error('Failed to fetch daily stats', e);
        }

        // 2. Fetch Total Count (If not found yet) - REMOVED
        // The /daily endpoint now returns 'total' as well, so no need for fallbacks.
        // This ensures public users see All Time count without 403 errors.

        setVisitorStats({ todayCount: today, totalVisitors: total });
      } catch (error) {
        console.error('Failed to fetch visitor stats:', error);
      }
    };

    fetchVisitorStats();

    // Listen for visitor tracked events to update count immediately (for same browser)
    const handleVisitorTracked = () => {
      fetchVisitorStats();
    };

    window.addEventListener('visitorTracked', handleVisitorTracked);

    // Refresh count every 30 seconds for real-time updates across all users
    // This ensures when a new visitor accepts cookies on another device,
    // all users see the updated count within 30 seconds without page refresh
    const interval = setInterval(fetchVisitorStats, 30 * 1000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visitorTracked', handleVisitorTracked);
    };
  }, []);

  return (
    <footer className="bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-8 md:gap-8">
          {/* Company Info */}
          <div className="col-span-2 md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-yellow-400 rounded-lg">
                <FaHome className="text-xl text-gray-900" />
              </div>
              <h3 className="text-xl font-bold dark:text-white">UrbanSetu</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm leading-relaxed max-w-sm transition-colors">
              Your trusted partner in finding the perfect property.
              We make real estate simple, smart, and secure.
            </p>
            <div className="space-y-2 text-xs md:text-sm text-gray-700 dark:text-gray-300 transition-colors">
              <div className="flex items-center gap-2">
                <FaPhone className="text-yellow-400" />
                <span>+1 (970) 446-3758</span>
              </div>
              <div className="flex items-center gap-2">
                <FaEnvelope className="text-yellow-400" />
                <span>info.urbansetu@gmail.com</span>
              </div>
              <div className="flex items-center gap-2">
                <FaMapMarkerAlt className="text-yellow-400" />
                <span>917 Real Estate Ave, Bengaluru, Karnataka 560002</span>
              </div>
            </div>
            {/* Social Media Links */}
            <div className="flex gap-4 pt-2">
              <a href="mailto:info.urbansetu@gmail.com" target="_blank" rel="noopener noreferrer" title="Email" className="text-gray-500 hover:text-blue-500 transition-colors"><FaEnvelope className="text-lg" /></a>
              <a href="https://instagram.com/vijaychalendra09" target="_blank" rel="noopener noreferrer" title="Instagram" className="text-gray-500 hover:text-pink-500 transition-colors"><svg className="inline w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5A4.25 4.25 0 0 0 20.5 16.25v-8.5A4.25 4.25 0 0 0 16.25 3.5zm4.25 2.25a5.25 5.25 0 1 1 0 10.5a5.25 5.25 0 0 1 0-10.5zm0 1.5a3.75 3.75 0 1 0 0 7.5a3.75 3.75 0 0 0 0-7.5zm5.25 1.25a1 1 0 1 1 0 2a1 1 0 0 1 0-2z" /></svg></a>
              <a href="https://x.com/Vijay09862" target="_blank" rel="noopener noreferrer" title="X" className="text-gray-500 hover:text-blue-400 transition-colors"><svg className="inline w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.53 2H21l-7.19 8.21L22 22h-6.56l-5.18-6.98L2.47 22H-1l7.61-8.7L2 2h6.56l4.93 6.64L17.53 2zm-2.1 16.5h2.13l-5.98-8.06l-2.13-2.87H7.47l5.98 8.06l2.13 2.87z" /></svg></a>
              <a href="https://facebook.com/vijaychalendra09" target="_blank" rel="noopener noreferrer" title="Facebook" className="text-gray-500 hover:text-blue-600 transition-colors"><svg className="inline w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22.675 0h-21.35C.595 0 0 .592 0 1.326v21.348C0 23.408.595 24 1.326 24H12.82v-9.294H9.692v-3.622h3.127V8.413c0-3.1 1.893-4.788 4.659-4.788c1.325 0 2.463.099 2.797.143v3.24l-1.918.001c-1.504 0-1.797.715-1.797 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116C23.406 24 24 23.408 24 22.674V1.326C24 .592 23.406 0 22.675 0" /></svg></a>
              <a href="https://www.youtube.com/@UrbanSetu-realestate" target="_blank" rel="noopener noreferrer" title="YouTube" className="text-gray-500 hover:text-red-600 transition-colors"><svg className="inline w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a2.994 2.994 0 0 0-2.112-2.112C19.454 3.5 12 3.5 12 3.5s-7.454 0-9.386.574A2.994 2.994 0 0 0 .502 6.186C0 8.118 0 12 0 12s0 3.882.502 5.814a2.994 2.994 0 0 0 2.112 2.112C4.546 20.5 12 20.5 12 20.5s7.454 0 9.386-.574a2.994 2.994 0 0 0 2.112-2.112C24 15.882 24 12 24 12s0-3.882-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg></a>
            </div>
            {/* App Store & Play Store Download Badges */}
            <div className="flex gap-3 pt-3">
              <a href="https://drive.google.com/drive/folders/1Hl8P93mnWPSCmoetuQn48jvWkwZGYFla?usp=sharing" target="_blank" rel="noopener noreferrer" className="hover:opacity-85 transition-opacity" title="Download on Apple App Store">
                <img src="/assets/images/app-store.10009972.webp" alt="Download on App Store" className="h-[34px] w-auto rounded-lg shadow-sm" />
              </a>
              <a href="https://drive.google.com/drive/folders/1Hl8P93mnWPSCmoetuQn48jvWkwZGYFla?usp=sharing" target="_blank" rel="noopener noreferrer" className="hover:opacity-85 transition-opacity" title="Get it on Google Play Store">
                <img src="/assets/images/google-play.2c209e8c.webp" alt="Get it on Google Play" className="h-[34px] w-auto rounded-lg shadow-sm" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold dark:text-white">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to={
                    currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')
                      ? "/admin"
                      : currentUser
                        ? "/user"
                        : "/"
                  }
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <FaHome className="text-xs" />
                  Home
                </Link>
              </li>
              <li>
                <Link to="/download" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2">
                  <FaDownload className="text-xs" />
                  Downloads
                </Link>
              </li>
              <li>
                <Link
                  to={
                    currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')
                      ? "/admin/updates"
                      : currentUser
                        ? "/user/updates"
                        : "/updates"
                  }
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <FaBullhorn className="text-xs" />
                  Updates
                </Link>
              </li>
              <li>
                <Link
                  to={
                    currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')
                      ? "/admin/explore"
                      : currentUser
                        ? "/user/search"
                        : "/search"
                  }
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <FaSearch className="text-xs" />
                  Search Properties
                </Link>
              </li>
              <li>
                <Link
                  to={
                    currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')
                      ? "/admin/about"
                      : currentUser
                        ? "/user/about"
                        : "/about"
                  }
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <FaInfoCircle className="text-xs" />
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  to={currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? "/admin/support" : "/contact"}
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <FaHeadset className="text-xs" />
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold dark:text-white">Services</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to={(currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin'))
                  ? "/admin/create-listing"
                  : "/user/create-listing"} className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2">
                  <FaPlusCircle className="text-xs" />
                  List Property
                </Link>
              </li>
              <li>
                <Link to={(currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin'))
                  ? "/admin/appointments"
                  : "/user/my-appointments"} className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2">
                  <FaCalendarAlt className="text-xs" />
                  Book Appointment
                </Link>
              </li>
              <li>
                <Link
                  to={
                    currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')
                      ? "/admin/setuai"
                      : currentUser
                        ? "/user/setuai"
                        : "/setuai"
                  }
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <FaRobot className="text-xs" />
                  AI Assistant
                </Link>
              </li>
              <li>
                <Link
                  to={(currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin'))
                    ? "/admin/route-planner"
                    : "/user/route-planner"}
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <FaRoute className="text-xs" />
                  Route Planner
                </Link>
              </li>
              <li>
                <Link
                  to={(currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin'))
                    ? "/admin/rental-contracts"
                    : "/user/rental-contracts"}
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <FaFileContract className="text-xs" />
                  Rental Contracts
                </Link>
              </li>
              <li>
                <Link
                  to={(currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin'))
                    ? "/admin/property-verification"
                    : "/user/property-verification"}
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2">
                  <FaCheckCircle className="text-xs" />
                  Property Verification
                </Link>
              </li>

            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold dark:text-white">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to={
                    currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')
                      ? "/admin/blogs"
                      : "/user/blogs"
                  }
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <FaBookOpen className="text-xs" />
                  Real Estate Blogs
                </Link>
              </li>
              <li>
                <Link
                  to={
                    currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')
                      ? "/admin/help-center"
                      : currentUser
                        ? "/user/help-center"
                        : "/help-center"
                  }
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <FaQuestionCircle className="text-xs" />
                  Help Center
                </Link>
              </li>
              <li>
                <Link
                  to={
                    currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')
                      ? "/admin/market-trends"
                      : currentUser
                        ? "/user/market-trends"
                        : "/market-trends"
                  }
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2">
                  <FaChartLine className="text-xs" />
                  Market Trends
                </Link>
              </li>
              <li>
                <Link
                  to={
                    currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')
                      ? "/admin/guides"
                      : currentUser
                        ? "/user/guides"
                        : "/guides"
                  }
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2">
                  <FaBook className="text-xs" />
                  Property Guides
                </Link>
              </li>
              <li>
                <Link to={
                  currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')
                    ? "/admin/agents"
                    : currentUser
                      ? "/user/agents"
                      : "/agents"
                } className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2">
                  <FaUserTie className="text-xs" />
                  Find an Agent
                </Link>
              </li>
              <li>
                <Link to={(currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin'))
                  ? "/admin/investment-tools"
                  : "/user/investment-tools"} className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2">
                  <FaCalculator className="text-xs" />
                  Investment Tools
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Privacy */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold dark:text-white">Legal & Support</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to={
                  currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')
                    ? "/admin/terms"
                    : currentUser
                      ? "/user/terms"
                      : "/terms"
                } className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2">
                  <FaFileContract className="text-xs" />
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to={
                  currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')
                    ? "/admin/privacy"
                    : currentUser
                      ? "/user/privacy"
                      : "/privacy"
                } className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2">
                  <FaShieldAlt className="text-xs" />
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to={
                    currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')
                      ? "/admin/cookie-policy"
                      : currentUser
                        ? "/user/cookie-policy"
                        : "/cookie-policy"
                  }
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <FaCookie className="text-xs" />
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link
                  to={
                    currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')
                      ? "/admin/error-codes"
                      : currentUser
                        ? "/user/error-codes"
                        : "/error-codes"
                  }
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <FaExclamationTriangle className="text-xs text-red-500" />
                  Error Directory
                </Link>
              </li>
              <li>
                <Link
                  to={
                    currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')
                      ? "/admin/community-guidelines"
                      : currentUser
                        ? "/user/community-guidelines"
                        : "/community-guidelines"
                  }
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <FaHandshake className="text-xs" />
                  Community Guidelines
                </Link>
              </li>
              <li>
                <Link
                  to="/status?tab=currentstatus"
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <FaServer className="text-xs text-green-500" />
                  System Status
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-300 dark:border-gray-800 mt-6 pt-6 md:mt-8 md:pt-8 transition-colors">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              © {new Date().getFullYear()} UrbanSetu. All rights reserved.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 transition-colors">
                <FaEye className="text-blue-500 dark:text-blue-400" />
                <span className="text-gray-600 dark:text-gray-300 flex items-center gap-2">
                  <span>Today: <span className="font-semibold text-blue-600 dark:text-blue-400"><CountUp end={visitorStats.todayCount} /></span></span>
                  {visitorStats.totalVisitors > 0 && (
                    <>
                      <span className="text-gray-300 dark:text-gray-700">|</span>
                      <span>All Time: <span className="font-semibold text-purple-600 dark:text-purple-400"><CountUp end={visitorStats.totalVisitors} /></span></span>
                    </>
                  )}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
                <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/20 rounded-full">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                    <FaRobot className="text-blue-500 animate-pulse text-xs" /> Powered by Sentinel v2.0 Neural Engine
                  </span>
                </div>
                <span>Made with ❤️ for real estate</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Helper Component for Number Animation
const CountUp = ({ end, duration = 2000 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime;
    let animationFrame;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);

      // Ease out expo function for smooth deceleration
      const easeOutExpo = percentage === 1 ? 1 : 1 - Math.pow(2, -10 * percentage);

      setCount(Math.floor(easeOutExpo * end));

      if (progress < duration) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return <>{count}</>;
};

export default Footer;