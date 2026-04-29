import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, User, Shield, AlertTriangle, ArrowRight, RefreshCw, Mail, Calendar, HelpCircle, Sparkles, UserPlus } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { signInSuccess } from '../redux/user/userSlice.js';
import { usePageTitle } from '../hooks/usePageTitle';
import { authenticatedFetch } from '../utils/csrf';
import { syncSettingsFromUser } from '../utils/settingsSync';
import { reconnectSocket } from '../utils/socket';
import ContactSupportWrapper from '../components/ContactSupportWrapper';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import PremiumLoader from '../components/ui/PremiumLoader';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AccountConflictResolution() {
  usePageTitle("Account Recovery - Previous Account Found");

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [conflictData, setConflictData] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [creatingFresh, setCreatingFresh] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showLoader, setShowLoader] = useState(false);
  const [pendingLoginData, setPendingLoginData] = useState(null);
  const [loaderMode, setLoaderMode] = useState('signup');

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('signupConflictData');
      if (!raw) {
        navigate('/sign-up', { replace: true });
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed.signupFormData || !parsed.deletedAccountData) {
        navigate('/sign-up', { replace: true });
        return;
      }
      setConflictData(parsed);
    } catch {
      navigate('/sign-up', { replace: true });
    }
  }, [navigate]);

  const getDaysRemaining = (expiresAt) => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24)));
  };

  const getProgressPercentage = (expiresAt) => {
    if (!expiresAt) return 0;
    const daysRemaining = getDaysRemaining(expiresAt);
    return Math.min(100, Math.max(0, (daysRemaining / 30) * 100));
  };

  const autoLogin = async (email, password) => {
    try {
      const loginRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/signin`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const loginData = await loginRes.json();
      if (loginRes.ok) {
        setPendingLoginData(loginData);
        setShowLoader(true);
      } else {
        // Fallback: redirect to sign-in
        navigate('/sign-in', { replace: true });
      }
    } catch {
      navigate('/sign-in', { replace: true });
    }
  };

  const finalizeLogin = () => {
    if (pendingLoginData) {
      if (pendingLoginData.token) {
        localStorage.setItem('accessToken', pendingLoginData.token);
        if (pendingLoginData.sessionId) localStorage.setItem('sessionId', pendingLoginData.sessionId);
        if (pendingLoginData.refreshToken) localStorage.setItem('refreshToken', pendingLoginData.refreshToken);
        localStorage.setItem('login', Date.now());
      }
      dispatch(signInSuccess(pendingLoginData));
      syncSettingsFromUser(pendingLoginData);
      reconnectSocket();
      sessionStorage.removeItem('signupConflictData');

      if (pendingLoginData.role === 'admin' || pendingLoginData.role === 'rootadmin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/user', { replace: true });
      }
    }
  };

  // Option 1: Restore previous account
  const handleRestore = async () => {
    if (!conflictData) return;
    setRestoring(true);
    setError('');

    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/restore-for-signup`, {
        method: 'POST',
        body: JSON.stringify({
          email: conflictData.signupFormData.email,
          newPassword: conflictData.signupFormData.password,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMessage('Your previous account has been restored! Signing you in...');
        setSuccess(true);
        setLoaderMode('signin');
        setTimeout(() => {
          autoLogin(conflictData.signupFormData.email, conflictData.signupFormData.password);
        }, 1500);
      } else {
        setError(data.message || 'Failed to restore account. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  // Option 2: Create fresh account (with confirmation)
  const handleCreateFresh = () => {
    setShowConfirmModal(true);
  };

  const confirmCreateFresh = async () => {
    if (!conflictData) return;
    setShowConfirmModal(false);
    setCreatingFresh(true);
    setError('');

    try {
      // Call signup with forceCreate flag to purge old account + create new
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        body: JSON.stringify({
          ...conflictData.signupFormData,
          forceCreate: true,
        }),
      });

      const data = await res.json();

      if (data.success === false && res.status !== 201) {
        setError(data.message || 'Failed to create account. Please try again.');
        setCreatingFresh(false);
        return;
      }

      setSuccessMessage('New account created! Signing you in...');
      setSuccess(true);
      setLoaderMode('signup');

      // For admin accounts that need approval
      if (conflictData.signupFormData.role === 'admin' || conflictData.signupFormData.role === 'rootadmin') {
        sessionStorage.removeItem('signupConflictData');
        setSuccessMessage('Admin account created! Please wait for approval.');
        setTimeout(() => navigate('/sign-in', { replace: true }), 3000);
        return;
      }

      setTimeout(() => {
        autoLogin(conflictData.signupFormData.email, conflictData.signupFormData.password);
      }, 1500);
    } catch {
      setError('Something went wrong. Please try again.');
      setCreatingFresh(false);
    }
  };

  if (!conflictData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <UrbanSetuSpinner size="xl" />
      </div>
    );
  }

  const { deletedAccountData } = conflictData;
  const daysRemaining = getDaysRemaining(deletedAccountData.expiresAt);
  const progressPercent = getProgressPercentage(deletedAccountData.expiresAt);

  if (showLoader) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <PremiumLoader mode={loaderMode} onComplete={finalizeLogin} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent dark:bg-gray-950 flex flex-col justify-center relative overflow-hidden py-6 sm:py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute -top-[30%] -right-[10%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-amber-100/40 to-orange-100/40 dark:from-amber-900/20 dark:to-orange-900/20 blur-3xl animate-float" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-blue-100/40 to-indigo-100/40 dark:from-blue-900/20 dark:to-indigo-900/20 blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-lg relative z-10">
        {/* Brand Area */}
        <div className="text-center mb-6 sm:mb-8 animate-fade-in-up">
          <div className="inline-flex items-center justify-center p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-lg mb-4 ring-1 ring-gray-100 dark:ring-gray-700">
            <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Previous Account Found
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
            We found an existing account linked to this email that was recently deleted
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl py-6 sm:py-8 px-4 shadow-2xl rounded-2xl sm:rounded-3xl sm:px-8 border border-white/50 dark:border-gray-700/50 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>

          {success && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-500">
                <CheckCircle2 className="w-8 h-8 text-green-500 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Success!</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{successMessage}</p>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-4 overflow-hidden">
                <div className="bg-green-500 h-1.5 rounded-full w-full" style={{ animation: 'progressFill 2s ease-out forwards' }}></div>
              </div>
            </div>
          )}

          {error && !success && (
            <div className="mb-6 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!success && (
            <>
              {/* Account Info Card */}
              <div className="flex items-center justify-center mb-5">
                <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                  <User className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 mb-5 border border-gray-100 dark:border-gray-700">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Previous Account Details</h4>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-sm p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors">
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <User className="w-4 h-4 mr-2.5 text-gray-400 dark:text-gray-500" />
                      Username
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">{deletedAccountData.username}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors">
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <Mail className="w-4 h-4 mr-2.5 text-gray-400 dark:text-gray-500" />
                      Email
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white truncate ml-4 max-w-[180px]">{deletedAccountData.email}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors">
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <Calendar className="w-4 h-4 mr-2.5 text-gray-400 dark:text-gray-500" />
                      Deleted On
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {new Date(deletedAccountData.deletedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recovery Window Progress */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Recovery Window</span>
                  <span className={`font-bold ${daysRemaining < 7 ? 'text-red-500' : 'text-amber-600 dark:text-amber-400'}`}>
                    {daysRemaining} Days Left
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-1000 ease-out ${daysRemaining < 7 ? 'bg-red-500' : 'bg-amber-500'}`}
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                {daysRemaining < 7 && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 flex items-center">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Recovery window closing soon
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Restore Button */}
                <button
                  onClick={handleRestore}
                  disabled={restoring || creatingFresh}
                  className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-all hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed group"
                >
                  {restoring ? (
                    <>
                      <UrbanSetuSpinner size="sm" isBright={true} className="mr-2" />
                      Restoring Account...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 group-hover:rotate-180 transition-transform duration-500" />
                      Restore Previous Account
                    </>
                  )}
                </button>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                  Your previous data, listings, and history will be fully recovered
                </p>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 font-medium">OR</span>
                  </div>
                </div>

                {/* Start Fresh Button */}
                <button
                  onClick={handleCreateFresh}
                  disabled={restoring || creatingFresh}
                  className="w-full flex justify-center items-center py-3.5 px-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all hover:scale-[1.01] disabled:opacity-70 disabled:cursor-not-allowed group"
                >
                  {creatingFresh ? (
                    <>
                      <UrbanSetuSpinner size="sm" className="mr-2" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 text-blue-500 group-hover:text-blue-600 transition-colors" />
                      Start Fresh with New Account
                    </>
                  )}
                </button>
                <p className="text-xs text-center text-gray-400 dark:text-gray-500">
                  Previous account data will be permanently removed
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer Help */}
        {!success && (
          <div className="mt-8 text-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
              <HelpCircle className="w-4 h-4" />
              Need help? <a href="/contact" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 hover:underline">Contact Support</a>
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 border border-gray-200 dark:border-gray-700 animate-fade-in-up">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-red-500 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Confirm New Account
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                By continuing, your previous account associated with{' '}
                <span className="font-semibold text-gray-900 dark:text-white">{deletedAccountData.email}</span>{' '}
                will be <span className="font-semibold text-red-600 dark:text-red-400">permanently deleted</span> and cannot be recovered.
              </p>
            </div>

            <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 mb-6 border border-red-100 dark:border-red-800/30">
              <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                <strong>This action is irreversible.</strong> All data from your previous account — including listings, reviews, appointments, messages, and transaction history — will be permanently erased.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={confirmCreateFresh}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-all hover:scale-[1.02] shadow-lg"
              >
                Delete & Create New
              </button>
            </div>
          </div>
        </div>
      )}

      <ContactSupportWrapper />
    </div>
  );
}
