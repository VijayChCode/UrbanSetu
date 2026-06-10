import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, User, Shield, AlertTriangle, ArrowRight, RefreshCw, Mail, Calendar, HelpCircle, Sparkles, UserPlus, CheckCircle } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { signInSuccess } from '../redux/user/userSlice.js';
import { usePageTitle } from '../hooks/usePageTitle';
import { authenticatedFetch } from '../utils/csrf';
import { getErrorCode } from '../utils/errorRegistry';
import { syncSettingsFromUser } from '../utils/settingsSync';
import { reconnectSocket } from '../utils/socket';
import ContactSupportWrapper from '../components/ContactSupportWrapper';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import RecaptchaWidget from "../components/RecaptchaWidget";
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
  const [showBackupPrompt, setShowBackupPrompt] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [recaptchaError, setRecaptchaError] = useState("");
  const recaptchaRef = useRef(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

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
        // Commit tokens and Redux state, then navigate
        if (loginData.token) {
          localStorage.setItem('accessToken', loginData.token);
          if (loginData.sessionId) localStorage.setItem('sessionId', loginData.sessionId);
          if (loginData.refreshToken) localStorage.setItem('refreshToken', loginData.refreshToken);
          localStorage.setItem('login', Date.now());
        }
        dispatch(signInSuccess(loginData));
        syncSettingsFromUser(loginData);
        reconnectSocket();
        sessionStorage.removeItem('signupConflictData');

        if (loginData.role === 'admin' || loginData.role === 'rootadmin') {
          navigate('/admin', { replace: true });
        } else {
          navigate('/user', { replace: true });
        }
      } else {
        // Fallback: redirect to sign-in
        navigate('/sign-in', { replace: true });
      }
    } catch {
      navigate('/sign-in', { replace: true });
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
    setShowBackupPrompt(true);
  };

  const handleBackupAccept = async () => {
    if (!conflictData || !conflictData.conflictToken) return;
    setExportingData(true);
    setError('');

    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/account-revocation/export-deleted-data`, {
        method: 'POST',
        body: JSON.stringify({
          email: conflictData.signupFormData.email,
          conflictToken: conflictData.conflictToken,
          selectedModules: ['listings', 'appointments', 'reviews', 'payments', 'wishlist', 'watchlist', 'gamification']
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setExportSuccess(true);
        // We now wait for user to click "Proceed" button added in the UI
      } else {
        setError(data.message || 'Failed to trigger data backup.');
        if (res.status === 429) {
          // Rate limit hit - show success-like state so they can proceed, but with a warning
          setExportSuccess(true);
          toast.warning(data.message || 'A backup was recently sent. You can request again in 24 hours.');
        }
      }
    } catch (err) {
      setError('Connection error during backup. You can still proceed.');
    } finally {
      setExportingData(false);
    }
  };

  const handleProceedAfterBackup = () => {
    setShowBackupPrompt(false);
    setShowConfirmModal(true);
  };

  const handleBackupDecline = () => {
    setShowBackupPrompt(false);
    setShowConfirmModal(true);
  };

  const confirmCreateFresh = async () => {
    if (!conflictData) return;
    setShowConfirmModal(false);
    setCreatingFresh(true);
    setError('');

    try {
      if (!recaptchaToken) {
        setError("Please complete the reCAPTCHA verification");
        setCreatingFresh(false);
        return;
      }

      const isGoogleAuth = ['google', 'google_one_tap'].includes(conflictData.signupFormData.authMethod);
      const apiUrl = isGoogleAuth
        ? `${API_BASE_URL}/api/auth/google`
        : `${API_BASE_URL}/api/auth/signup`;

      const requestBody = isGoogleAuth
        ? {
          ...conflictData.signupFormData,
          forceCreate: true,
          recaptchaToken,
        }
        : {
          ...conflictData.signupFormData,
          forceCreate: true,
          recaptchaToken,
        };

      // Call appropriate auth route with forceCreate flag
      const res = await authenticatedFetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (res.status !== 201 && res.status !== 200) {
        setError(data.message || 'Failed to create account. Please try again.');
        setCreatingFresh(false);
        // Reset recaptcha on error so user can try again
        recaptchaRef.current?.reset();
        setRecaptchaToken(null);
        return;
      }

      setSuccessMessage('New account created! Signing you in...');
      setSuccess(true);

      // For admin accounts that need approval
      if (conflictData.signupFormData.role === 'admin' || conflictData.signupFormData.role === 'rootadmin' || data.requiresApproval) {
        sessionStorage.removeItem('signupConflictData');
        setSuccessMessage('Admin account created! Please wait for approval.');
        setTimeout(() => navigate('/sign-in', { replace: true }), 3000);
        return;
      }

      // Handle successful login
      setTimeout(() => {
        // Clear referral code from localStorage on success
        localStorage.removeItem('urbansetu_ref');
        
        if (isGoogleAuth && data.token) {
          // For Google, we already have the token in the response — commit and navigate
          if (data.token) {
            localStorage.setItem('accessToken', data.token);
            if (data.sessionId) localStorage.setItem('sessionId', data.sessionId);
            if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
            localStorage.setItem('login', Date.now());
          }
          dispatch(signInSuccess(data));
          syncSettingsFromUser(data);
          reconnectSocket();
          sessionStorage.removeItem('signupConflictData');
          localStorage.removeItem('urbansetu_ref');

          if (data.role === 'admin' || data.role === 'rootadmin') {
            navigate('/admin', { replace: true });
          } else {
            navigate('/user', { replace: true });
          }
        } else {
          autoLogin(conflictData.signupFormData.email, conflictData.signupFormData.password);
        }
      }, 1500);
    } catch {
      setError('Something went wrong. Please try again.');
      setCreatingFresh(false);
    }
  };

  if (!conflictData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-gray-100 dark:border-gray-700">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Session Expired</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
                We couldn't find your signup information. Please go back to the signup page and try again.
            </p>
            <button 
                onClick={() => navigate('/sign-up')}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all active:scale-95"
            >
                Back to Sign Up
            </button>
        </div>
      </div>
    );
  }

  const { deletedAccountData } = conflictData;
  const daysRemaining = getDaysRemaining(deletedAccountData.expiresAt);
  const progressPercent = getProgressPercentage(deletedAccountData.expiresAt);

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
            <div className="mb-6 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300 text-sm flex items-start gap-2 animate-fade-in">
              <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                 <p className="font-medium">{error}</p>
                <p className="text-red-600 dark:text-red-400 font-mono text-xs mt-1 transition-colors">Error Code: {getErrorCode(error)}</p>
              </div>
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

      {/* Backup Prompt Modal */}
      {showBackupPrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[70] p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3 hover:rotate-0 transition-transform duration-300">
                <Mail className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              </div>

              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Backup Previous Data?</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                Before you permanently delete your previous account, would you like us to email you a complete backup of your listings and data?
              </p>

              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm flex items-start gap-3">
                  <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {exportSuccess ? (
                <div className="text-center py-4 animate-fade-in">
                  <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Backup Email Sent!</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                    We've sent your backup data to {deletedAccountData.email}.
                  </p>
                  <button
                    onClick={handleProceedAfterBackup}
                    className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-green-500/25 flex items-center justify-center gap-3 active:scale-95"
                  >
                    Proceed to Confirm Account
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleBackupAccept}
                    disabled={exportingData}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-3 group active:scale-95"
                  >
                    {exportingData ? (
                      <UrbanSetuSpinner size="sm" isBright={true} />
                    ) : (
                      <Mail className="w-5 h-5 group-hover:animate-bounce" />
                    )}
                    {exportingData ? 'Preparing Backup...' : 'Yes, Email My Data'}
                  </button>

                  <button
                    onClick={handleBackupDecline}
                    disabled={exportingData}
                    className="w-full py-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-200 rounded-2xl font-semibold transition-all active:scale-95"
                  >
                    No, Proceed to Fresh Start
                  </button>

                  <button
                    onClick={() => setShowBackupPrompt(false)}
                    disabled={exportingData}
                    className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-400 transition-colors mt-2"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                By continuing, your previous account associated with{' '}
                <span className="font-semibold text-gray-900 dark:text-white">{deletedAccountData.email}</span>{' '}
                will be <span className="font-semibold text-red-600 dark:text-red-400">permanently deleted</span> and cannot be recovered.
              </p>

              <div className="flex justify-center mb-6">
                <RecaptchaWidget
                  ref={recaptchaRef}
                  onVerify={(token) => {
                    setRecaptchaToken(token);
                    setRecaptchaError("");
                  }}
                  onExpire={() => setRecaptchaToken(null)}
                  disabled={creatingFresh}
                />
              </div>

              {recaptchaError && (
                <p className="text-xs text-red-500 mb-4">{recaptchaError}</p>
              )}
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
