import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { signInSuccess } from '../redux/user/userSlice';
import { authenticatedFetch } from '../utils/csrf';
import { API_BASE_URL } from '../config/api';
import { reconnectSocket } from "../utils/socket";
import { syncSettingsFromUser } from "../utils/settingsSync";


import { app } from '../firebase'; // Import initialized Firebase app

const GoogleOneTap = () => {
    const { currentUser } = useSelector((state) => state.user);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Don't show One Tap on auth pages (avoid conflict with Oauth.jsx and redundant UI)
    const isAuthPage = ['/sign-in', '/sign-up'].includes(location.pathname);

    // Load Google Identity Services script
    useEffect(() => {
        if (currentUser || isAuthPage) return;

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => setScriptLoaded(true);
        document.body.appendChild(script);

        return () => {
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
    }, [currentUser, isAuthPage]);

    // Initialize One Tap
    useEffect(() => {
        if (!scriptLoaded || currentUser || isProcessing || isAuthPage) return;

        const handleCredentialResponse = async (response) => {
            try {
                // 1. Get ID Token from the One Tap response
                const idToken = response.credential;
                if (!idToken) return;

                setIsProcessing(true);

                // 2. Create a Firebase credential from the token
                const credential = GoogleAuthProvider.credential(idToken);
                const auth = getAuth(app); // Pass initialized app

                // 3. Sign in to Firebase with the credential
                const result = await signInWithCredential(auth, credential);
                const user = result.user;

                // 4. Send the user details to your backend
                const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/google`, {
                    method: "POST",
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: user.displayName,
                        email: user.email,
                        photo: user.photoURL,
                        referredBy: new URLSearchParams(location.search).get('ref') || localStorage.getItem('urbansetu_ref')
                    })
                });

                const data = await res.json();

                // Deleted account found in the 30-day grace period — redirect to conflict resolution
                if (res.status === 409 && data.deletedAccountFound) {
                    sessionStorage.setItem('signupConflictData', JSON.stringify({
                        signupFormData: {
                            name: user.displayName,
                            email: user.email,
                            photo: user.photoURL,
                            referredBy: new URLSearchParams(location.search).get('ref') || localStorage.getItem('urbansetu_ref'),
                            authMethod: 'google_one_tap'
                        },
                        deletedAccountData: data.deletedAccountData,
                        conflictToken: data.conflictToken
                    }));
                    setIsProcessing(false);
                    navigate('/account-conflict');
                    return;
                }

                if (data.success === false) {
                    console.error('Backend auth failed:', data.message);
                    setIsProcessing(false);
                    return;
                }

                if (data.token) {
                    localStorage.setItem('accessToken', data.token);
                    if (data.sessionId) localStorage.setItem('sessionId', data.sessionId);
                    if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
                    localStorage.setItem('login', Date.now()); // Notify other tabs
                }

                // 5. Update Redux state and navigate directly
                dispatch(signInSuccess(data));
                syncSettingsFromUser(data);
                reconnectSocket();

                if (data.role === "admin" || data.role === "rootadmin") {
                    navigate("/admin");
                } else {
                    navigate("/user");
                }

            } catch (error) {
                console.error('Google One Tap Error:', error);
                setIsProcessing(false);
            }
        };

        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

        if (window.google && clientId) {
            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: handleCredentialResponse,
                auto_select: false,
                cancel_on_tap_outside: false,
                use_fedcm_for_prompt: true,
                context: 'use'
            });

            // Display the One Tap prompt
            window.google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed()) {
                    console.log('One Tap not displayed:', notification.getNotDisplayedReason());
                } else if (notification.isSkippedMoment()) {
                    console.log('One Tap skipped:', notification.getSkippedReason());
                }
            });
        }
    }, [scriptLoaded, currentUser, dispatch, navigate, location.search, isProcessing, isAuthPage]);

    return null;
};

export default GoogleOneTap;
