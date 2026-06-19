import { GoogleAuthProvider, getAuth, signInWithRedirect, getRedirectResult, signInWithPopup } from 'firebase/auth';
import { app } from '../firebase';
import { signInSuccess } from '../redux/user/userSlice.js';
import { useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { Link2 } from 'lucide-react';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import { authenticatedFetch } from '../utils/csrf';
import React, { useEffect, useState } from 'react';

import { API_BASE_URL } from '../config/api.js';
import { reconnectSocket } from "../utils/socket";
import { syncSettingsFromUser } from "../utils/settingsSync";

export default function Oauth({ pageType, disabled = false, onAuthStart = null, onAuthSuccess = null }) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Handle redirect result when component mounts
    useEffect(() => {
        const handleRedirectResult = async () => {
            try {
                const auth = getAuth();
                const result = await getRedirectResult(auth);

                if (result) {
                    await processGoogleAuth(result);
                }
            } catch (error) {
                console.error('Error handling redirect result:', error);
            }
        };

        handleRedirectResult();
    }, []);

    const processGoogleAuth = async (result) => {
        try {
            setIsLoading(true);
            setError(null);

            const refParam = new URLSearchParams(location.search).get('ref') || localStorage.getItem('urbansetu_ref');
            const isObjectId = refParam && /^[0-9a-fA-F]{24}$/.test(refParam);
            const apiUrl = "/api/auth/google";
            const res = await authenticatedFetch(`${API_BASE_URL}${apiUrl}`, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: result.user.displayName,
                    email: result.user.email,
                    photo: result.user.photoURL,
                    referredBy: isObjectId ? refParam : undefined,
                    referralCode: (!isObjectId && refParam) ? refParam : undefined
                })
            });

            const data = await res.json();

            // Deleted account found in the 30-day grace period — redirect to conflict resolution
            if (res.status === 409 && data.deletedAccountFound) {
                sessionStorage.setItem('signupConflictData', JSON.stringify({
                    signupFormData: {
                        name: result.user.displayName,
                        email: result.user.email,
                        photo: result.user.photoURL,
                        referredBy: isObjectId ? refParam : undefined,
                        referralCode: (!isObjectId && refParam) ? refParam : undefined,
                        authMethod: 'google'
                    },
                    deletedAccountData: data.deletedAccountData,
                    conflictToken: data.conflictToken
                }));
                navigate('/account-conflict');
                return;
            }

            if (data.success === false) {
                throw new Error(data.message || 'Authentication failed');
            }

            if (data.token) {
                localStorage.setItem('accessToken', data.token);
                if (data.sessionId) localStorage.setItem('sessionId', data.sessionId);
                if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
                localStorage.setItem('login', Date.now()); // Notify other tabs
                
                // Clear referral code from localStorage on success
                localStorage.removeItem('urbansetu_ref');
            }

            // If component provides a custom success handler (e.g. for showing a loader)
            if (onAuthSuccess) {
                onAuthSuccess(data);
                return;
            }

            dispatch(signInSuccess(data));
            syncSettingsFromUser(data);

            // Reconnect socket with new token
            reconnectSocket();

            // Navigate based on user role
            const searchParams = new URLSearchParams(location.search);
            searchParams.set('syncsettings', '1');
            if (data.role === "admin" || data.role === "rootadmin") {
                navigate(`/admin?${searchParams.toString()}`);
            } else {
                navigate(`/user?${searchParams.toString()}`);
            }
        } catch (error) {
            console.error('Error processing Google authentication:', error);
            setError('Authentication failed. Please try again.');
        } finally {
            setIsLoading(false);
            // Notify parent component that Google auth completed
            if (onAuthStart) {
                onAuthStart(null);
            }
        }
    };

    const handleGoogleClick = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Notify parent component that Google auth is starting
            if (onAuthStart) {
                onAuthStart('google');
            }

            // Try popup first, fallback to redirect if it fails
            try {
                const provider = new GoogleAuthProvider();
                provider.addScope('email');
                provider.addScope('profile');

                const auth = getAuth();
                const result = await signInWithPopup(auth, provider);
                await processGoogleAuth(result);
            } catch (popupError) {
                console.log('Popup failed:', popupError);

                // User intentionally closed the popup — just reset state, no error needed
                if (popupError.code === 'auth/popup-closed-by-user' || popupError.code === 'auth/cancelled-popup-request') {
                    setIsLoading(false);
                    if (onAuthStart) onAuthStart(null);
                    return;
                }

                if (popupError.code === 'auth/unauthorized-domain') {
                    setError(`Domain not authorized. Please add '${window.location.hostname}' to Firebase Console > Auth > Settings > Authorized Domains.`);
                    setIsLoading(false);
                    if (onAuthStart) onAuthStart(null);
                    return;
                }

                console.log('Trying redirect method...');

                // If popup fails due to CORS or other technical issues, use redirect
                const provider = new GoogleAuthProvider();
                provider.addScope('email');
                provider.addScope('profile');

                const auth = getAuth();
                await signInWithRedirect(auth, provider);
            }
        } catch (error) {
            console.error(`Error initiating Google ${pageType}:`, error);

            let errorMessage = 'Failed to initiate Google authentication. Please try again.';

            if (error.code === 'auth/unauthorized-domain') {
                errorMessage = `Domain not authorized. Please add '${window.location.hostname}' to Firebase Console > Auth > Settings > Authorized Domains.`;
            } else if (error.code === 'auth/popup-closed-by-user') {
                errorMessage = 'Sign-in popup was closed.';
            }

            setError(errorMessage);
            setIsLoading(false);

            // Notify parent component that Google auth failed
            if (onAuthStart) {
                onAuthStart(null);
            }
        }
    };

    // Detect if rendered as a standalone page (at /oauth) vs embedded component
    const isStandalonePage = !onAuthSuccess && !onAuthStart && location.pathname === '/oauth';

    const buttonContent = (
        <div className="w-full">
            <button
                type="button"
                onClick={handleGoogleClick}
                disabled={isLoading || disabled}
                className="flex items-center justify-center w-full gap-2 px-4 py-2 mt-4 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`${pageType === "signIn" ? "Sign In" : "Sign Up"} with Google`}
            >
                {isLoading ? (
                    <>
                        <UrbanSetuSpinner size="sm" />
                        {error ? 'Retrying...' : (pageType === "signIn" ? 'Signing In...' : 'Signing Up...')}
                    </>
                ) : (
                    <>
                        <FcGoogle className="text-xl" />
                        {pageType === "signIn" ? "Sign In with Google" : "Sign Up with Google"}
                    </>
                )}
            </button>

            {error && (
                <div className="mt-2 p-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
                    {error}
                </div>
            )}
        </div>
    );

    // When used as an embedded component in SignIn/SignUp, return just the button
    if (!isStandalonePage) {
        return buttonContent;
    }

    // Standalone page layout for /oauth (Firebase redirect callback landing page)
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Animated background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[15%] left-[25%] w-72 h-72 bg-blue-400/15 dark:bg-blue-600/10 rounded-full blur-[100px] animate-pulse"></div>
                <div className="absolute bottom-[20%] right-[20%] w-80 h-80 bg-purple-400/15 dark:bg-purple-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            <div className="relative z-10 w-full max-w-md">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-8 md:p-10">
                    {/* Branding */}
                    <div className="text-center mb-8">
                        <div className="flex items-center justify-center gap-4 mb-8">
                            {/* UrbanSetu Logo */}
                            <div className="flex items-center justify-center w-14 h-14 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 transform transition-transform hover:scale-105 duration-300">
                                <img 
                                    src="/assets/images/favicon.png" 
                                    alt="UrbanSetu Logo" 
                                    className="w-10 h-10 rounded-lg object-contain"
                                />
                            </div>

                            {/* Connection Link */}
                            <div className="relative flex items-center">
                                <div className="absolute w-8 h-px bg-gradient-to-r from-blue-500 to-purple-500 opacity-30"></div>
                                <div className="relative z-10 p-1.5 bg-gray-50 dark:bg-gray-900 rounded-full border border-gray-100 dark:border-gray-800 text-gray-400">
                                    <Link2 className="w-3.5 h-3.5 animate-pulse" />
                                </div>
                            </div>

                            {/* Google Logo */}
                            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-gray-800 shadow-lg border border-gray-100 dark:border-gray-700 flex items-center justify-center transform transition-transform hover:scale-105 duration-300">
                                <FcGoogle className="text-3xl" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            Continue with Google
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                            Sign in or create your UrbanSetu account using your Google account
                        </p>
                    </div>

                    {/* Google Button */}
                    <div className="space-y-4">
                        <button
                            type="button"
                            onClick={handleGoogleClick}
                            disabled={isLoading || disabled}
                            className="flex items-center justify-center w-full gap-3 px-6 py-3.5 text-base font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Continue with Google"
                        >
                            {isLoading ? (
                                <>
                                    <UrbanSetuSpinner size="sm" />
                                    <span>Authenticating...</span>
                                </>
                            ) : (
                                <>
                                    <FcGoogle className="text-2xl" />
                                    <span>Continue with Google</span>
                                </>
                            )}
                        </button>

                        {error && (
                            <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-center">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-3 bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 font-medium">OR</span>
                        </div>
                    </div>

                    {/* Alternative Actions */}
                    <div className="space-y-3">
                        <a
                            href="/sign-in"
                            className="flex items-center justify-center w-full px-4 py-3 text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all duration-200"
                        >
                            Sign In with Email
                        </a>
                        <a
                            href="/sign-up"
                            className="flex items-center justify-center w-full px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                        >
                            Create New Account
                        </a>
                    </div>
                </div>

                {/* Security badge */}
                <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                    <span className="font-medium">Secure & Encrypted Authentication</span>
                </div>
            </div>
        </div>
    );
}
