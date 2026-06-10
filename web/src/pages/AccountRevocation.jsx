import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, User, Shield, AlertTriangle, ArrowRight, RefreshCw, Home, Mail, Calendar, HelpCircle, AlertCircle } from 'lucide-react';

import { useSelector } from 'react-redux';
import { getErrorCode } from '../utils/errorRegistry';
import { usePageTitle } from '../hooks/usePageTitle';
import ContactSupportWrapper from '../components/ContactSupportWrapper';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AccountRevocation() {
  // Set page title
  usePageTitle("Account Recovery - Restore Account");

  const { token } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useSelector((state) => state.user);

  let homePath = "/";
  if (currentUser) {
    if (currentUser.role === "admin" || currentUser.role === "rootadmin") {
      homePath = "/admin";
    } else {
      homePath = "/user";
    }
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [accountData, setAccountData] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [isPurged, setIsPurged] = useState(false);
  const [purgedDetails, setPurgedDetails] = useState(null);

  useEffect(() => {
    if (token) {
      verifyToken();
    } else {
      setError('Invalid or missing token');
      setLoading(false);
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-revocation-token/${token}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setAccountData(data.accountData);
        setLoading(false);
      } else if (response.status === 410 && data.error === 'PURGED_ACCOUNT') {
        // Account has been permanently deleted (purged)
        setIsPurged(true);
        setPurgedDetails(data.details);
        setLoading(false);
      } else {
        setError(data.message || 'Invalid or expired token');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      setError('Failed to verify token. Please try again.');
      setLoading(false);
    }
  };

  const handleRestoreAccount = async () => {
    try {
      setRestoring(true);
      const response = await fetch(`${API_BASE_URL}/api/auth/restore-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
        // Redirect to sign-in after 3 seconds
        setTimeout(() => {
          navigate('/sign-in');
        }, 3000);
      } else {
        setError(data.message || 'Failed to restore account');
      }
    } catch (error) {
      console.error('Error restoring account:', error);
      setError('Failed to restore account. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  // Helper to calculate days remaining
  const getDaysRemaining = (expiresAt) => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24)));
  };

  // Helper to calculate progress percentage for time remaining (assuming 30 days total)
  const getProgressPercentage = (expiresAt) => {
    if (!expiresAt) return 0;
    const daysRemaining = getDaysRemaining(expiresAt);
    return Math.min(100, Math.max(0, (daysRemaining / 30) * 100));
  };


  return (
    <div className="min-h-screen bg-transparent dark:bg-gray-950 flex flex-col justify-center relative overflow-hidden py-6 sm:py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute -top-[30%] -right-[10%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-blue-100/40 to-indigo-100/40 dark:from-blue-900/20 dark:to-indigo-900/20 blur-3xl animate-blob" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-purple-100/40 to-blue-100/40 dark:from-purple-900/20 dark:to-blue-900/20 blur-3xl animate-blob animation-delay-2000" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand/Logo Area */}
        <div className="text-center mb-6 sm:mb-8 animate-fade-in-up">
          <div className="inline-flex items-center justify-center p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-lg mb-4 ring-1 ring-gray-100 dark:ring-gray-700">
            <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Account Recovery
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-xs mx-auto">
            Securely restore access to your UrbanSetu account
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl py-6 sm:py-8 px-4 shadow-2xl rounded-2xl sm:rounded-3xl sm:px-10 border border-white/50 dark:border-gray-700/50 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>

          {loading && (
            <div className="text-center py-6 sm:py-8">
              <div className="relative w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-6">
                <div className="absolute inset-0 border-4 border-blue-100 dark:border-blue-900/30 rounded-full"></div>
                <div className="absolute inset-0 rounded-full flex items-center justify-center">
                  <UrbanSetuSpinner size="xl" />
                </div>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">Verifying Token</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Please wait while we validate your restoration link...</p>
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-short">
                <XCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 dark:text-red-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2">Link Invalid or Expired</h3>
               <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm leading-relaxed font-medium">{error}</p>
              <p className="text-red-600 dark:text-red-400 font-mono text-xs mb-8 transition-colors">Error Code: {getErrorCode(error)}</p>

              {/* Retry with manual token entry */}
              <div className="mb-8">
                <input
                  type="text"
                  placeholder="Paste renovation token here..."
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    if (val && val.length > 20) {
                      window.history.pushState({}, '', `/restore-account/${val}`);
                      window.location.href = `/restore-account/${val}`;
                    }
                  }}
                />
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">If you have a valid token, paste it above to retry.</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => navigate('/sign-up')}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all hover:scale-[1.02]"
                >
                  Create New Account
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => navigate('/sign-in')}
                    className="flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => navigate(homePath)}
                    className="flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Home
                  </button>
                </div>
              </div>
            </div>
          )}

          {!loading && success && (
            <div className="text-center py-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-scale-in">
                <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-green-500 dark:text-green-400" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">Success!</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed font-medium">
                Your account has been successfully restored. We're redirecting you to safe waters...
              </p>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mb-2 overflow-hidden">
                <div className="bg-green-500 h-1.5 rounded-full animate-progress-loading w-full origin-left duration-[3000ms]"></div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">Redirecting in a few seconds...</p>
            </div>
          )}

          {!loading && !error && !success && !isPurged && accountData && (
            <div>
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center animate-pulse-soft">
                  <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>

              <div className="text-center mb-8">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Welcome Back, {accountData.username}!</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Ready to restore your account?</p>
              </div>

              {/* Status Bar */}
              <div className="mb-8">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Recovery Window</span>
                  <span className={`font-bold ${getDaysRemaining(accountData.expiresAt) < 3 ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
                    {getDaysRemaining(accountData.expiresAt)} Days Left
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-1000 ease-out ${getDaysRemaining(accountData.expiresAt) < 7 ? 'bg-red-500' : 'bg-blue-600 dark:bg-blue-500'
                      }`}
                    style={{ width: `${getProgressPercentage(accountData.expiresAt)}%` }}
                  ></div>
                </div>
                {getDaysRemaining(accountData.expiresAt) < 7 && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-2 flex items-center justify-center">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Warning: Permanent deletion is imminent
                  </p>
                )}
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-5 mb-8 border border-gray-100 dark:border-gray-700">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors">
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <Mail className="w-4 h-4 mr-3 text-gray-400 dark:text-gray-500" />
                      Email
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">{accountData.email}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors">
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <Calendar className="w-4 h-4 mr-3 text-gray-400 dark:text-gray-500" />
                      Deleted On
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {new Date(accountData.deletedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors">
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <Clock className="w-4 h-4 mr-3 text-gray-400 dark:text-gray-500" />
                      Expires On
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {new Date(accountData.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleRestoreAccount}
                disabled={restoring}
                className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed group"
              >
                {restoring ? (
                  <>
                    <UrbanSetuSpinner size="sm" isBright={true} className="mr-2" />
                    Restoring Account...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 group-hover:rotate-180 transition-transform duration-500" />
                    Restore My Account
                  </>
                )}
              </button>

              <p className="mt-6 text-center text-xs text-gray-400">
                By restoring, you agree to our <a href="/terms" className="underline hover:text-blue-500">Terms</a> & <a href="/privacy" className="underline hover:text-blue-500">Privacy Policy</a>
              </p>
            </div>
          )}

          {!loading && isPurged && (
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 dark:text-red-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2">Account Not Available</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 text-sm leading-relaxed font-medium">
                We're sorry, but this account has been permanently deleted and cannot be restored anymore. The 30-day recovery window has passed.
              </p>

              {purgedDetails && (
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-5 mb-8 text-left border border-gray-100 dark:border-gray-700 transition-colors">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Previous Account Info</h4>
                  <div className="space-y-3">
                    <div className="flex items-center text-sm">
                      <User className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-3" />
                      <span className="font-medium text-gray-900 dark:text-white">{purgedDetails.username}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-3" />
                      <span className="text-gray-600 dark:text-gray-400 truncate">{purgedDetails.email}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Clock className="w-4 h-4 text-red-400 mr-3" />
                      <span className="text-red-600 dark:text-red-400 font-medium">Deleted on {new Date(purgedDetails.purgedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={() => navigate('/sign-up')}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all hover:scale-[1.02]"
                >
                  Create New Account
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => navigate('/sign-in')}
                    className="flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => navigate(homePath)}
                    className="flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Home
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Help */}
        {!loading && !success && (
          <div className="mt-8 text-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
              <HelpCircle className="w-4 h-4" />
              Need help? <a href="/contact" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 hover:underline">Contact Support</a>
            </p>
          </div>
        )}

      </div>
      <ContactSupportWrapper />
    </div>
  );
}
