import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Shield, AlertCircle, RefreshCw, Wifi, WifiOff, FileText, Search, Lock, HelpCircle, HardDrive, ChevronLeft } from 'lucide-react';
import ContactSupportWrapper from '../components/ContactSupportWrapper';
import SEO from '../components/SEO';
import { ERROR_CODES } from '../utils/errorRegistry';

const categoryMap = {
  System: ['ERR_SYS_REACT_CRASH', 'ERR_SYS_UNDEFINED'],
  Network: ['ERR_NET_CONNECT', 'ERR_NET_TIMEOUT'],
  API: ['ERR_API_UNAUTHORIZED', 'ERR_API_FORBIDDEN', 'ERR_API_NOT_FOUND', 'ERR_API_BAD_REQUEST', 'ERR_API_SERVER_ERROR', 'ERR_API_LOAD_FAIL'],
  Authentication: ['ERR_AUTH_PASSWORD', 'ERR_AUTH_LOCKED', 'ERR_AUTH_EXPIRED'],
  Validation: ['ERR_VAL_REQUIRED', 'ERR_VAL_UPLOAD'],
  Web3: ['ERR_WEB3_METAMASK'],
  General: ['ERR_GEN_UNKNOWN']
};

const errorCodeDetails = {
  ERR_SYS_REACT_CRASH: {
    title: "Application UI Crash",
    description: "The application encountered an unexpected React runtime crash.",
    solution: "Refresh your browser. If it continues, clear browser storage/cookies or contact support.",
    severity: "High",
    icon: HardDrive
  },
  ERR_SYS_UNDEFINED: {
    title: "Undefined System Failure",
    description: "A system operation was called but returned an empty or invalid state.",
    solution: "Try reloading the page. Ensure your browser is up-to-date.",
    severity: "Medium",
    icon: AlertCircle
  },
  ERR_NET_CONNECT: {
    title: "Network Connection Lost",
    description: "Your browser failed to connect to our servers. Offline status or firewall blocks.",
    solution: "Check your local internet connection, try swapping to a different network, or disable VPN/firewalls.",
    severity: "High",
    icon: WifiOff
  },
  ERR_NET_TIMEOUT: {
    title: "Request Timeout",
    description: "The request took too long to resolve. The server might be slow or overloaded.",
    solution: "Wait a minute and click retry. Your connection could be temporarily degraded.",
    severity: "Medium",
    icon: Wifi
  },
  ERR_API_UNAUTHORIZED: {
    title: "Session Expired",
    description: "Your session token has expired, is malformed, or is unauthorized.",
    solution: "Sign out and sign in again to obtain a fresh security token.",
    severity: "Medium",
    icon: Lock
  },
  ERR_API_FORBIDDEN: {
    title: "Access Forbidden",
    description: "You do not have administrative or user clearance to view this resource.",
    solution: "Verify you are signed into the correct account. If you believe this is an error, request access.",
    severity: "High",
    icon: Shield
  },
  ERR_API_NOT_FOUND: {
    title: "Resource Not Found",
    description: "The requested listing, user profile, blog, or document does not exist.",
    solution: "Double-check the URL path, or navigate back to explore page.",
    severity: "Low",
    icon: FileText
  },
  ERR_API_BAD_REQUEST: {
    title: "Invalid Request Input",
    description: "The parameters provided by the client are malformed or missing key attributes.",
    solution: "Review the input fields in the active form. Correct validation warnings.",
    severity: "Low",
    icon: AlertCircle
  },
  ERR_API_SERVER_ERROR: {
    title: "Internal Server Error",
    description: "Our backend database or core servers encountered a temporary issue.",
    solution: "Please try again later. Our dev team is automatically notified of server anomalies.",
    severity: "High",
    icon: RefreshCw
  },
  ERR_API_LOAD_FAIL: {
    title: "Failed to Fetch Details",
    description: "Failed to pull specific details from our backend systems.",
    solution: "Click the reload or refresh button. Ensure you are signed in.",
    severity: "Medium",
    icon: RefreshCw
  },
  ERR_AUTH_PASSWORD: {
    title: "Incorrect Credentials",
    description: "The password, email or OTP entered is incorrect.",
    solution: "Re-verify your credentials. If you forgot your password, use the Forgot Password link to reset it.",
    severity: "Low",
    icon: Lock
  },
  ERR_AUTH_LOCKED: {
    title: "Account Temporarily Locked",
    description: "The account is locked due to too many failed login attempts.",
    solution: "Wait 15 minutes and try again, or reset your password to unlock immediately.",
    severity: "Medium",
    icon: Shield
  },
  ERR_AUTH_EXPIRED: {
    title: "Token Expired",
    description: "The reset password link or verification token has expired or already been used.",
    solution: "Request a fresh verification or password reset email.",
    severity: "Low",
    icon: AlertCircle
  },
  ERR_VAL_REQUIRED: {
    title: "Missing Required Fields",
    description: "Form validation failed because required fields were left empty.",
    solution: "Please check all mandatory inputs and fill them out.",
    severity: "Low",
    icon: FileText
  },
  ERR_VAL_UPLOAD: {
    title: "File Upload Failed",
    description: "The uploaded file exceeds limit sizes, uses unsupported formats, or failed AI auditing.",
    solution: "Verify that the file is an image/PDF, below 5MB, and not blurry.",
    severity: "Low",
    icon: FileText
  },
  ERR_WEB3_METAMASK: {
    title: "Wallet Interaction Failed",
    description: "Failed to locate or connect with MetaMask or your Web3 wallet provider.",
    solution: "Ensure MetaMask browser extension is installed, active, and unlocked.",
    severity: "Medium",
    icon: HardDrive
  },
  ERR_GEN_UNKNOWN: {
    title: "Unexpected Error",
    description: "An unclassified exception occurred during your session.",
    solution: "Refresh page. If problem persists, report bug with reproduction steps.",
    severity: "Medium",
    icon: HelpCircle
  }
};

const ErrorCodes = () => {
  const { currentUser } = useSelector((state) => state.user);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', ...Object.keys(categoryMap)];

  const allCodes = Object.keys(ERROR_CODES);

  const filteredCodes = allCodes.filter(code => {
    const details = errorCodeDetails[code] || {};
    const matchesSearch = code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (details.title && details.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (details.description && details.description.toLowerCase().includes(searchTerm.toLowerCase()));

    if (selectedCategory === 'All') return matchesSearch;
    return categoryMap[selectedCategory]?.includes(code) && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <SEO
        title="Error Codes Reference Guide | UrbanSetu Support"
        description="Search, view, and troubleshoot error codes on the UrbanSetu platform. Find explanations, triggers, and immediate solutions."
        keywords="urbansetu error codes, platform troubleshooting, real estate portal errors"
      />

      {/* Hero Header */}
      <div className="relative bg-gradient-to-r from-blue-700 to-indigo-800 dark:from-blue-900 dark:to-indigo-950 text-white py-20 overflow-hidden transition-colors duration-300">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-1.2.1&auto=format&fit=crop&w=1567&q=80')] opacity-5 bg-cover bg-center"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30"></div>
        
        <div className="max-w-7xl mx-auto px-4 mb-4 relative z-10 text-left">
          <Link
            to={!currentUser ? '/' : (currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin' : '/user')}
            className="inline-flex items-center text-blue-200 hover:text-white transition-colors text-sm font-semibold gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" />
            {!currentUser ? 'Back to Home' : 'Back to Dashboard'}
          </Link>
        </div>

        <div className="max-w-7xl mx-auto px-4 relative z-10 text-center">
          <div className="inline-flex items-center justify-center p-3.5 bg-white/10 backdrop-blur-md rounded-2xl mb-6 ring-4 ring-white/20">
            <AlertCircle className="w-10 h-10 text-blue-300" />
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-tight">Error Codes Directory</h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto font-light leading-relaxed">
            Quick reference guide for resolving platform notifications and messages. Search any error code to find its meaning and steps to resolve.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Controls Panel */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-md p-6 mb-8 border border-gray-100 dark:border-gray-800/80 transition-colors duration-300">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search Bar */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search code or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none text-gray-900 dark:text-white transition-all duration-200"
              />
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-650 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Codes Grid */}
        {filteredCodes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCodes.map((code) => {
              const details = errorCodeDetails[code] || {};
              const Icon = details.icon || AlertCircle;
              const severityColor = 
                details.severity === 'High' 
                  ? 'bg-red-50 dark:bg-red-950/30 text-red-750 dark:text-red-400 border border-red-200 dark:border-red-800/40' 
                  : details.severity === 'Medium'
                  ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-750 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30'
                  : 'bg-blue-50 dark:bg-blue-950/20 text-blue-750 dark:text-blue-400 border border-blue-200 dark:border-blue-800/30';

              return (
                <div
                  key={code}
                  className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 border border-gray-100 dark:border-gray-800/80 p-6 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
                        <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${severityColor}`}>
                        {details.severity} Priority
                      </span>
                    </div>

                    {/* Title & Code */}
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white transition-colors duration-300">
                      {details.title}
                    </h3>
                    <p className="font-mono text-sm text-red-600 dark:text-red-400 font-bold mt-1.5 mb-3 select-all">
                      {code}
                    </p>

                    {/* Explanation */}
                    <div className="space-y-3 mt-4 text-sm text-gray-650 dark:text-gray-400">
                      <div>
                        <span className="font-bold text-gray-900 dark:text-gray-300 block mb-1">What this means:</span>
                        <p className="leading-relaxed">{details.description}</p>
                      </div>
                      <div>
                        <span className="font-bold text-gray-900 dark:text-gray-300 block mb-1">How to fix it:</span>
                        <p className="leading-relaxed text-gray-700 dark:text-gray-300">{details.solution}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 transition-colors">
            <HelpCircle className="w-16 h-16 text-gray-400 mx-auto mb-4 animate-bounce" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Error Codes Found</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              We couldn't find any error codes matching your search term. Try searching for "auth", "network", or "403".
            </p>
          </div>
        )}

        {/* Footer Support CTA */}
        <div className="mt-16 text-center">
          <p className="text-gray-650 dark:text-gray-400 mb-4 font-medium">
            Encountering a code not listed here, or still need assistance?
          </p>
          <Link
            to={!currentUser ? '/contact' : (currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin/support' : '/user/contact')}
            className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            Contact Support Team
          </Link>
        </div>
      </div>

      <ContactSupportWrapper />
    </div>
  );
};

export default ErrorCodes;
