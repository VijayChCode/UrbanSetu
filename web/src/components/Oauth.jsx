import { GoogleAuthProvider, getAuth, signInWithRedirect, getRedirectResult, signInWithPopup } from 'firebase/auth';
import { app } from '../firebase';
import { signInSuccess } from '../redux/user/userSlice.js';
import { useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { authenticatedFetch } from '../utils/csrf';
import React, { useEffect, useState } from 'react';

import { API_BASE_URL } from '../config/api.js';
import { reconnectSocket } from "../utils/socket";

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
                    referredBy: new URLSearchParams(location.search).get('ref') || localStorage.getItem('urbansetu_ref')
                })
            });

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            const data = await res.json();

            if (data.success === false) {
                throw new Error(data.message || 'Authentication failed');
            }

            if (data.token) {
                localStorage.setItem('accessToken', data.token);
                if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
                localStorage.setItem('login', Date.now()); // Notify other tabs
            }

            // If component provides a custom success handler (e.g. for showing a loader)
            if (onAuthSuccess) {
                onAuthSuccess(data);
                return;
            }

            dispatch(signInSuccess(data));

            // Reconnect socket with new token
            reconnectSocket();

            // Navigate based on user role
            if (data.role === "admin" || data.role === "rootadmin") {
                navigate("/admin");
            } else {
                navigate("/user");
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

    return (
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
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600 dark:border-gray-300"></div>
                        {error ? 'Retrying...' : 'Signing In...'}
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
}
