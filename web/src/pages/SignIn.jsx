import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { signInFailure, signInStart, signInSuccess } from "../redux/user/userSlice.js";
import Oauth from "../components/Oauth.jsx";
import RecaptchaWidget from "../components/RecaptchaWidget";
import { toast } from 'react-toastify';
import SEO from '../components/SEO';
import { usePageTitle } from '../hooks/usePageTitle';
import { getErrorCode } from '../utils/errorRegistry';

import { reconnectSocket } from "../utils/socket";
import { FaEye, FaEyeSlash, FaEdit } from "react-icons/fa";
import { createAuthenticatedFetchOptions } from '../utils/auth';
import { focusWithoutKeyboard, isMobileDevice } from '../utils/mobileUtils';
import { authenticatedFetch, getCSRFToken } from '../utils/csrf';
import { LogIn, Mail, Lock } from "lucide-react";
import FormField from "../components/ui/FormField";
import PrimaryButton from "../components/ui/PrimaryButton";
import AuthFormLayout from "../components/ui/AuthFormLayout";

import { syncSettingsFromUser } from "../utils/settingsSync";
import SecureBadge from "../components/ui/SecureBadge";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function SignIn({ bootstrapped, sessionChecked }) {
    // Set page title
    usePageTitle("Sign In - Welcome Back");

    const emailInputRef = useRef(null);
    const otpEmailInputRef = useRef(null);
    const passwordInputRef = useRef(null);
    const otpInputRef = useRef(null);
    const [formData, setFormData] = useState({
        email: "",
        password: ""
    });
    const [emailStep, setEmailStep] = useState(false); // Track if email step is completed
    const [urlError, setUrlError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loginMethod, setLoginMethod] = useState("password"); // "password" or "otp"
    const [otpData, setOtpData] = useState({
        email: "",
        otp: ""
    });
    const [otpSent, setOtpSent] = useState(false);
    const [otpLoading, setOtpLoading] = useState(false);
    const [otpSuccessMessage, setOtpSuccessMessage] = useState("");

    // Timer states for resend OTP
    const [resendTimer, setResendTimer] = useState(0);
    const [canResend, setCanResend] = useState(true);

    // reCAPTCHA states
    const [recaptchaToken, setRecaptchaToken] = useState(null);
    const [recaptchaError, setRecaptchaError] = useState("");
    const [showRecaptcha, setShowRecaptcha] = useState(false);
    const [recaptchaKey, setRecaptchaKey] = useState(0); // force remount on expire/used
    const [otpRecaptchaToken, setOtpRecaptchaToken] = useState(null);
    const [otpRecaptchaError, setOtpRecaptchaError] = useState("");
    const [showOtpRecaptcha, setShowOtpRecaptcha] = useState(false);
    const [otpRequiresCaptcha, setOtpRequiresCaptcha] = useState(false);
    const [otpRecaptchaKey, setOtpRecaptchaKey] = useState(0); // force remount for OTP
    const recaptchaRef = useRef(null);
    const otpRecaptchaRef = useRef(null);

    // State to track which authentication method is in progress
    const [authInProgress, setAuthInProgress] = useState(null); // null, 'password', 'otp', 'google'

    // State to track OTP verification loading
    const [otpVerifyingLoading, setOtpVerifyingLoading] = useState(false);
    const [showPolicyModal, setShowPolicyModal] = useState(false);

    // Navigation helper — called after successful auth to redirect to the right page
    const navigateAfterLogin = (data) => {
        // Show success toast notification with user's name
        toast.success(`Signed in as ${data.username || 'User'}`);

        const searchParams = new URLSearchParams(location.search);
        let redirectUrl = searchParams.get('redirect');

        if (redirectUrl && redirectUrl.startsWith('/')) {
            if (redirectUrl.startsWith('/ai/share/')) {
                const prefix = (data.role === "admin" || data.role === "rootadmin") ? "/admin" : "/user";
                searchParams.set('redirect', `${prefix}${redirectUrl}`);
            } else {
                searchParams.set('redirect', redirectUrl);
            }
        }

        searchParams.set('syncsettings', '1');

        if (data.role === "admin" || data.role === "rootadmin") {
            navigate(`/admin?${searchParams.toString()}`, { replace: true });
        } else {
            navigate(`/user?${searchParams.toString()}`, { replace: true });
        }
    };

    const { loading, error, currentUser } = useSelector((state) => state.user);
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const location = useLocation();

    // Check for error parameters in URL on component mount
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const errorParam = searchParams.get('error');

        if (errorParam === 'password_change_unsuccessful') {
            setUrlError("Password change unsuccessful! Please try again.");
            // Clear the error parameter from URL
            navigate('/sign-in', { replace: true });
        }
    }, [location.search, navigate]);

    // Safety guard: clear stale loading state from redux-persist on mount.
    // This handles the edge case where a previous login attempt was interrupted
    // (e.g., page refresh mid-flow) and left Redux persisted with loading: true.
    useEffect(() => {
        if (loading && !currentUser) {
            dispatch(signInFailure(null));
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Check for 'redirect' parameter to show context toast
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const redirectParam = searchParams.get('redirect');

        if (redirectParam) {
            const actionMessages = {
                like: "Please sign in to like this content",
                dislike: "Please sign in to react",
                comment: "Please sign in to comment",
                reply: "Please sign in to reply",
                report: "Please sign in to report content",
                chat: "Please sign in to start a chat",
                book: "Please sign in to book an appointment",
                review: "Please sign in to leave a review",
                rate: "Please sign in to rate",
                access: "Please sign in to access this page",
                save: "Please sign in to save this item",
                vote: "Please sign in to vote"
            };

            let message = actionMessages[redirectParam];
            if (!message) {
                message = "Please sign in to access this page";
            }

            // Check if toast is already active to prevent duplicates
            if (!toast.isActive(`signin-redirect-${redirectParam}`)) {
                toast.info(message, { toastId: `signin-redirect-${redirectParam}` });
            }
        }
    }, [location.search]);

    // Redirect if already logged in
    useEffect(() => {
        if (currentUser && sessionChecked) {
            const searchParams = new URLSearchParams(location.search);
            const redirectUrl = searchParams.get('redirect');
            if (redirectUrl && redirectUrl.startsWith('/')) {
                navigate(redirectUrl, { replace: true });
            } else {
                if (currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
                    navigate('/admin', { replace: true });
                } else {
                    navigate('/user', { replace: true });
                }
            }
        }
    }, [currentUser, sessionChecked, navigate, location.search]);

    // Sync state with URL parameters
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const tabParam = searchParams.get('tab');
        const emailParam = searchParams.get('email');

        // Handle Tab State
        if (tabParam === 'otp') {
            if (loginMethod !== 'otp') {
                setLoginMethod('otp');
                setFormData(prev => ({ ...prev, password: "" }));
                setEmailStep(false);
            }
        } else {
            // Default to password
            if (tabParam === 'password' && loginMethod !== 'password') {
                setLoginMethod('password');
                setOtpSent(false);
                setOtpSuccessMessage("");
                setOtpData(prev => ({ ...prev, otp: "" }));
                setResendTimer(0);
                setCanResend(true);
            }
        }

        // Handle Email State (Pre-fill)
        if (emailParam) {
            setFormData(prev => ({ ...prev, email: emailParam }));
            setOtpData(prev => ({ ...prev, email: emailParam }));
        }
    }, [location.search, loginMethod]);

    const onTabClick = (method) => {
        const params = new URLSearchParams(location.search);
        params.set('tab', method);

        // Capture current input to persist in URL
        const currentInputEmail = loginMethod === 'password' ? formData.email : otpData.email;
        if (currentInputEmail) {
            params.set('email', currentInputEmail);
        } else {
            params.delete('email');
        }

        navigate({ search: params.toString() }, { replace: true });
    };

    // Check for existing failed attempts on component mount
    useEffect(() => {
        const failedAttempts = parseInt(localStorage.getItem('failedLoginAttempts') || '0');
        if (failedAttempts >= 3) {
            setShowRecaptcha(true);
            setRecaptchaError("reCAPTCHA verification is required due to multiple failed attempts.");
        }
    }, []);

    // Autofocus email field on mount (desktop only)
    useEffect(() => {
        if (!isMobileDevice() && emailInputRef.current) {
            focusWithoutKeyboard(emailInputRef.current);
        }
    }, []);

    // Focus OTP email field when OTP method is selected (desktop only)
    useEffect(() => {
        if (!isMobileDevice() && loginMethod === "otp" && otpEmailInputRef.current) {
            focusWithoutKeyboard(otpEmailInputRef.current);
        }
    }, [loginMethod]);

    // Focus password field when email step is completed (desktop only)
    useEffect(() => {
        if (emailStep && passwordInputRef.current) {
            focusWithoutKeyboard(passwordInputRef.current);
        }
    }, [emailStep]);

    // Focus OTP field when OTP is sent (desktop only)
    useEffect(() => {
        if (!isMobileDevice() && otpSent && otpInputRef.current) {
            focusWithoutKeyboard(otpInputRef.current);
        }
    }, [otpSent]);



    // Timer effect for resend OTP
    useEffect(() => {
        let interval = null;
        if (resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer((prevTimer) => {
                    if (prevTimer <= 1) {
                        setCanResend(true);
                        return 0;
                    }
                    return prevTimer - 1;
                });
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [resendTimer]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.id]: e.target.value
        });
        // Clear URL error when user starts typing
        if (urlError) {
            setUrlError("");
        }
        // Clear reCAPTCHA error when user starts typing
        if (recaptchaError) {
            setRecaptchaError("");
        }
    };

    // reCAPTCHA handlers
    const handleRecaptchaVerify = (token) => {
        setRecaptchaToken(token);
        setRecaptchaError("");
        // Hide after a brief delay to show the tick
        setTimeout(() => setShowRecaptcha(false), 1000);
    };

    const handleRecaptchaExpire = () => {
        setRecaptchaToken(null);
        setRecaptchaError("reCAPTCHA expired. Please verify again.");
        // force remount so checkbox resets from tick to empty
        setRecaptchaKey((k) => k + 1);
        setShowRecaptcha(true);
    };

    const handleRecaptchaError = (error) => {
        setRecaptchaToken(null);
        setRecaptchaError("reCAPTCHA verification failed. Please try again.");
        setRecaptchaKey((k) => k + 1);
        setShowRecaptcha(true);
    };

    const resetRecaptcha = () => {
        if (recaptchaRef.current) {
            recaptchaRef.current.reset();
        }
        setRecaptchaToken(null);
        setRecaptchaError("");
        setRecaptchaKey((k) => k + 1);
    };

    // OTP reCAPTCHA handlers
    const handleOtpRecaptchaVerify = (token) => {
        setOtpRecaptchaToken(token);
        setOtpRecaptchaError("");
        // Hide after a brief delay to show the tick
        setTimeout(() => setShowOtpRecaptcha(false), 1000);
    };

    const handleOtpRecaptchaExpire = () => {
        setOtpRecaptchaToken(null);
        setOtpRecaptchaError("reCAPTCHA expired. Please verify again.");
        setOtpRecaptchaKey((k) => k + 1);
        setShowOtpRecaptcha(true);
    };

    const handleOtpRecaptchaError = (error) => {
        setOtpRecaptchaToken(null);
        setOtpRecaptchaError("reCAPTCHA verification failed. Please try again.");
        setOtpRecaptchaKey((k) => k + 1);
        setShowOtpRecaptcha(true);
    };

    const resetOtpRecaptcha = () => {
        if (otpRecaptchaRef.current) {
            otpRecaptchaRef.current.reset();
        }
        setOtpRecaptchaToken(null);
        setOtpRecaptchaError("");
        setOtpRecaptchaKey((k) => k + 1);
    };

    // Check if reCAPTCHA should be shown (only after 3+ failed attempts)
    const checkRecaptchaRequirement = () => {
        // Only show reCAPTCHA if there are 3+ failed attempts
        const failedAttempts = parseInt(localStorage.getItem('failedLoginAttempts') || '0');
        return failedAttempts >= 3;
    };

    const handleEmailContinue = (e) => {
        e.preventDefault();
        if (!formData.email) {
            dispatch(signInFailure("Email is required"));
            return;
        }
        setEmailStep(true);
    };

    const handleEmailEdit = () => {
        setEmailStep(false);
        setFormData(prev => ({ ...prev, password: "" }));
    };

    const handleOtpChange = (e) => {
        // Prevent changes to email when OTP is sent or loading
        if ((otpSent || otpLoading) && e.target.id === 'email') {
            return;
        }

        setOtpData({
            ...otpData,
            [e.target.id]: e.target.value
        });
        // Clear URL error when user starts typing
        if (urlError) {
            setUrlError("");
        }
        // Clear success message when user starts typing
        if (otpSuccessMessage) {
            setOtpSuccessMessage("");
        }
        // Reset timer when email changes
        if (e.target.id === "email") {
            setResendTimer(0);
            setCanResend(true);
        }
    };

    const handleSendOTP = async (e) => {
        e.preventDefault();
        if (!otpData.email) {
            dispatch(signInFailure("Email is required"));
            return;
        }

        if (!canResend) {
            return;
        }

        // Check if reCAPTCHA is required but not provided
        if (otpRequiresCaptcha && !otpRecaptchaToken) {
            dispatch(signInFailure("reCAPTCHA verification is required. Please complete the verification."));
            setShowOtpRecaptcha(true);
            return;
        }

        setOtpLoading(true);
        setOtpRecaptchaError("");
        setAuthInProgress('otp');

        try {
            const requestBody = {
                email: otpData.email,
                ...(otpRecaptchaToken && { recaptchaToken: otpRecaptchaToken })
            };

            const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/send-login-otp`, {
                method: "POST",
                body: JSON.stringify(requestBody)
            });
            // Handle 403 errors with specific messages
            if (res.status === 403) {
                let friendlyMessage = "This account is temporarily suspended. Please reach out to support for help.";
                try {
                    const errData = await res.clone().json();
                    if (errData && errData.message) {
                        const message = errData.message.toLowerCase();
                        if (message.includes('pending approval')) {
                            friendlyMessage = "Your admin account is pending approval. Please wait for an existing admin to approve your request.";
                        } else if (message.includes('rejected')) {
                            friendlyMessage = "Your admin account request has been rejected. Please contact support for more information.";
                        } else if (message.includes('suspended')) {
                            // If it's a cooling-off suspension with a time limit, show the backend message
                            if (message.includes('try again after')) {
                                friendlyMessage = errData.message;
                            } else {
                                friendlyMessage = "This account is temporarily suspended. Please reach out to support for help.";
                            }
                        } else {
                            // Use the original message if it's a specific 403 error
                            friendlyMessage = errData.message;
                        }
                    }
                } catch (_) { }
                dispatch(signInFailure(friendlyMessage));
                setOtpLoading(false);
                return;
            }

            // Handle password-locked account (423) with friendly time-left message
            if (res.status === 423) {
                let friendlyMessage = "Account is temporarily locked due to too many failed attempts. Try again later.";
                try {
                    const errData = await res.clone().json();
                    if (errData && errData.message) {
                        friendlyMessage = errData.message;
                    }
                } catch (_) { }
                dispatch(signInFailure(friendlyMessage));
                setOtpLoading(false);
                return;
            }

            const data = await res.json();

            if (data.success === false) {
                // Handle reCAPTCHA errors
                if (data.message && data.message.toLowerCase().includes("too many failed attempts")) {
                    // Clear captcha UI and show clear lockout message
                    setOtpRecaptchaError("Too many failed attempts. Please try again in 15 minutes.");
                    setShowOtpRecaptcha(false);
                } else if (data.message && data.message.includes("reCAPTCHA")) {
                    setOtpRecaptchaError(data.message);
                    // Force remount to ensure widget appears reliably
                    setOtpRecaptchaKey((k) => k + 1);
                    setShowOtpRecaptcha(true);
                } else if (data.requiresCaptcha) {
                    setOtpRequiresCaptcha(true);
                    setShowOtpRecaptcha(true);
                    setOtpRecaptchaError("reCAPTCHA verification is now required due to multiple attempts.");
                } else {
                    dispatch(signInFailure(data.message));
                }
                return;
            }

            setOtpSent(true);
            setOtpSuccessMessage("OTP sent successfully to your email");
            setOtpRequiresCaptcha(false);
            setShowOtpRecaptcha(false);
            resetOtpRecaptcha();

            // Start timer for resend
            setResendTimer(30); // 30 seconds
            setCanResend(false);
        } catch (error) {
            dispatch(signInFailure(error.message));
        } finally {
            setOtpLoading(false);
            setAuthInProgress(null);
        }
    };

    const handleOtpLogin = async (e) => {
        e.preventDefault();
        if (!otpData.email || !otpData.otp) {
            dispatch(signInFailure("Email and OTP are required"));
            return;
        }

        setOtpVerifyingLoading(true);
        dispatch(signInStart());
        setAuthInProgress('otp');


        try {
            const apiUrl = `${API_BASE_URL}/api/auth/verify-login-otp`;
            const res = await authenticatedFetch(apiUrl, {
                method: "POST",
                body: JSON.stringify(otpData)
            });
            // Handle 403 errors with specific messages
            if (res.status === 403) {
                let friendlyMessage = "This account is temporarily suspended. Please reach out to support for help.";
                try {
                    const errData = await res.clone().json();
                    if (errData && errData.message) {
                        const message = errData.message.toLowerCase();
                        if (message.includes('pending approval')) {
                            friendlyMessage = "Your admin account is pending approval. Please wait for an existing admin to approve your request.";
                        } else if (message.includes('rejected')) {
                            friendlyMessage = "Your admin account request has been rejected. Please contact support for more information.";
                        } else if (message.includes('suspended')) {
                            // If it's a cooling-off suspension with a time limit, show the backend message
                            if (message.includes('try again after')) {
                                friendlyMessage = errData.message;
                            } else {
                                friendlyMessage = "This account is temporarily suspended. Please reach out to support for help.";
                            }
                        } else {
                            // Use the original message if it's a specific 403 error (Softbanned/Purged/Banned)
                            friendlyMessage = errData.message;
                        }
                    }
                } catch (_) { }
                dispatch(signInFailure(friendlyMessage));
                return;
            }
            const data = await res.json();

            if (data.success === false) {
                // Handle reCAPTCHA requirements
                if (data.message && data.message.toLowerCase().includes("too many otp requests")) {
                    setOtpRecaptchaError("Too many OTP requests. Please try again in 15 minutes.");
                    setShowOtpRecaptcha(false);
                    setOtpRequiresCaptcha(false);
                } else if (data.requiresCaptcha) {
                    setOtpRequiresCaptcha(true);
                    setShowOtpRecaptcha(true);
                    setOtpRecaptchaError("reCAPTCHA verification is now required due to multiple failed attempts.");
                }
                dispatch(signInFailure(data.message));
                return;
            }

            // Commit tokens and Redux state, then navigate
            if (data.token) {
                localStorage.setItem('accessToken', data.token);
                if (data.sessionId) localStorage.setItem('sessionId', data.sessionId);
                if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
                localStorage.setItem('login', Date.now()); // Notify other tabs
            }
            dispatch(signInSuccess(data));
            syncSettingsFromUser(data);
            reconnectSocket();
            navigateAfterLogin(data);

        } catch (error) {
            dispatch(signInFailure(error.message));
        } finally {
            setOtpVerifyingLoading(false);
            setAuthInProgress(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Check if reCAPTCHA is required and not provided
        const requiresRecaptcha = checkRecaptchaRequirement();
        if (requiresRecaptcha && !recaptchaToken) {
            // Keep captcha errors local to widget, not as global form error
            setRecaptchaError("reCAPTCHA verification is required due to multiple failed attempts or requests");
            setShowRecaptcha(true);
            return;
        }

        dispatch(signInStart());
        setAuthInProgress('password');


        try {
            const apiUrl = `${API_BASE_URL}/api/auth/signin`;
            const res = await authenticatedFetch(apiUrl, {
                method: "POST",
                body: JSON.stringify({
                    ...formData,
                    ...(recaptchaToken && { recaptchaToken })
                })
            });
            // Handle 403 errors with specific messages
            if (res.status === 403) {
                let friendlyMessage = "This account is temporarily suspended. Please reach out to support for help.";
                try {
                    const errData = await res.clone().json();
                    if (errData && errData.message) {
                        const message = errData.message.toLowerCase();
                        if (message.includes('pending approval')) {
                            friendlyMessage = "Your admin account is pending approval. Please wait for an existing admin to approve your request.";
                        } else if (message.includes('rejected')) {
                            friendlyMessage = "Your admin account request has been rejected. Please contact support for more information.";
                        } else if (message.includes('suspended')) {
                            // If it's a cooling-off suspension with a time limit, show the backend message
                            if (message.includes('try again after')) {
                                friendlyMessage = errData.message;
                            } else {
                                friendlyMessage = "This account is temporarily suspended. Please reach out to support for help.";
                            }
                        } else {
                            // Use the original message if it's a specific 403 error
                            friendlyMessage = errData.message;
                        }
                    }
                } catch (_) { }
                // Increment failed attempts to keep captcha logic consistent with other errors
                const currentAttempts = parseInt(localStorage.getItem('failedLoginAttempts') || '0');
                const newAttempts = currentAttempts + 1;
                localStorage.setItem('failedLoginAttempts', newAttempts.toString());
                dispatch(signInFailure(friendlyMessage));
                return;
            }
            const data = await res.json();

            //

            if (data.success === false) {
                // Handle reCAPTCHA errors
                if (data.message.includes("reCAPTCHA")) {
                    setRecaptchaError("reCAPTCHA verification is required due to multiple failed attempts or requests");
                    // Force full reset + remount so checkbox returns reliably
                    resetRecaptcha();
                    setRecaptchaKey((k) => k + 1);
                    setShowRecaptcha(true);
                } else {
                    // Increment failed attempts counter
                    const currentAttempts = parseInt(localStorage.getItem('failedLoginAttempts') || '0');
                    const newAttempts = currentAttempts + 1;
                    localStorage.setItem('failedLoginAttempts', newAttempts.toString());

                    // Show reCAPTCHA only if this is exactly the 3rd failed attempt
                    if (newAttempts === 3) {
                        setShowRecaptcha(true);
                        setRecaptchaError("reCAPTCHA verification is now required due to multiple failed attempts.");
                    }
                }
                dispatch(signInFailure(data.message));
                return;
            }

            // Clear failed attempts on successful login
            localStorage.removeItem('failedLoginAttempts');
            setShowRecaptcha(false);
            setRecaptchaToken(null);
            setRecaptchaError("");

            // Commit tokens and Redux state, then navigate
            if (data.token) {
                localStorage.setItem('accessToken', data.token);
                if (data.sessionId) localStorage.setItem('sessionId', data.sessionId);
                if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
                localStorage.setItem('login', Date.now()); // Notify other tabs
            }
            dispatch(signInSuccess(data));
            syncSettingsFromUser(data);
            reconnectSocket();
            navigateAfterLogin(data);

        } catch (error) {
            dispatch(signInFailure(error.message));
        } finally {
            setAuthInProgress(null);
        }
    };



    return (
        <>
            <SEO
                title="Sign In - Welcome Back | UrbanSetu"
                description="Sign in to your UrbanSetu account to manage your property listings, track appointments, and access personalized real estate recommendations."
                keywords="urban setu login, sign in real estate, property management login, real estate dashboard"
                noindex={true}
                nofollow={true}
            />
            <AuthFormLayout
                leftSlot={(
                    <>
                        <style>
                            {`
                            @keyframes blob {
                                0% { transform: translate(0px, 0px) scale(1); }
                                33% { transform: translate(30px, -50px) scale(1.1); }
                                66% { transform: translate(-20px, 20px) scale(0.9); }
                                100% { transform: translate(0px, 0px) scale(1); }
                            }
                            @keyframes float {
                                0%, 100% { transform: translateY(0); }
                                50% { transform: translateY(-20px); }
                            }
                            @keyframes fadeIn {
                                from { opacity: 0; transform: translateY(10px); }
                                to { opacity: 1; transform: translateY(0); }
                            }
                            .animate-blob { animation: blob 7s infinite; }
                            .animate-float { animation: float 6s ease-in-out infinite; }
                            .animate-fade-in { animation: fadeIn 0.6s ease-out forwards; }
                            .animate-fade-in-delay { animation: fadeIn 0.6s ease-out 0.3s forwards; opacity: 0; }
                            .animate-fade-in-delay-2 { animation: fadeIn 0.6s ease-out 0.6s forwards; opacity: 0; }
                            .delay-100 { animation-delay: 100ms; }
                            .delay-200 { animation-delay: 200ms; }
                            .delay-300 { animation-delay: 300ms; }
                            .animation-delay-2000 { animation-delay: 2s; }
                            .animation-delay-4000 { animation-delay: 4s; }
                        `}
                        </style>
                        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-purple-700 relative overflow-hidden">
                            <div className="absolute inset-0 bg-black opacity-20"></div>
                            <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
                                <div className="text-center max-w-md">
                                    <h1 className="text-4xl font-bold mb-6 animate-fade-in">
                                        Welcome Back
                                    </h1>
                                    <p className="text-xl mb-8 leading-relaxed animate-fade-in-delay">
                                        "Home is not a place, it's a feeling. Find your perfect sanctuary with us."
                                    </p>
                                    <div className="space-y-4 text-lg animate-fade-in-delay-2">
                                        <div className="flex items-center justify-center space-x-3">
                                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                            <span>Discover Your Dream Home</span>
                                        </div>
                                        <div className="flex items-center justify-center space-x-3">
                                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                                            <span>Connect with Trusted Agents</span>
                                        </div>
                                        <div className="flex items-center justify-center space-x-3">
                                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                                            <span>Secure & Reliable Platform</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Floating Elements */}
                            <div className="absolute top-20 left-20 w-16 h-16 bg-white bg-opacity-10 rounded-full animate-float"></div>
                            <div className="absolute bottom-32 right-16 w-12 h-12 bg-white bg-opacity-10 rounded-full animate-float" style={{ animationDelay: '2s' }}></div>
                            <div className="absolute top-1/2 right-24 w-8 h-8 bg-white bg-opacity-10 rounded-full animate-float" style={{ animationDelay: '1s' }}></div>

                            {/* House Silhouette */}
                            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black bg-opacity-20">
                                <svg className="w-full h-full" viewBox="0 0 100 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M10 2L2 8V18H18V8L10 2Z" fill="white" fillOpacity="0.1" />
                                    <path d="M8 12H12V18H8V12Z" fill="white" fillOpacity="0.2" />
                                    <circle cx="10" cy="5" r="1" fill="white" fillOpacity="0.3" />
                                </svg>
                            </div>
                        </div>
                    </>
                )}
            >
                {/* Right Side - Sign In Form */}
                <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 bg-gray-50 dark:bg-gray-900 min-h-screen">
                    <div className="w-full max-w-[440px] animate-fade-in">
                        <div className="text-center mb-10">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-600 mb-6 shadow-sm">
                                <LogIn className="w-8 h-8" />
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
                                Sign In
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 text-lg">Welcome back! Please enter your details.</p>
                        </div>

                        {/* Sign In Method Toggle Tabs */}
                        <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-8 relative border border-gray-200 dark:border-gray-700">
                            <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-gray-700 rounded-lg shadow-sm transition-all duration-300 ease-out transform ${loginMethod === "otp" ? "translate-x-full left-1" : "left-1"}`}></div>
                            <button
                                type="button"
                                disabled={authInProgress !== null}
                                onClick={() => onTabClick("password")}
                                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold relative z-10 transition-colors duration-200 ${loginMethod === "password" ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"} disabled:opacity-50`}
                            >
                                Password
                            </button>
                            <button
                                type="button"
                                disabled={authInProgress !== null}
                                onClick={() => onTabClick("otp")}
                                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold relative z-10 transition-colors duration-200 ${loginMethod === "otp" ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"} disabled:opacity-50`}
                            >
                                OTP
                            </button>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 md:p-8 relative overflow-hidden">
                            {/* Decorative background element for card */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/20 rounded-full -mr-16 -mt-16 opacity-50 pointer-events-none"></div>

                            {loginMethod === "password" ? (
                                // Password Sign In Form
                                <form onSubmit={emailStep ? handleSubmit : handleEmailContinue} className="space-y-5 relative z-10">
                                    <div className="animate-fade-in delay-100">
                                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
                                            Email Address
                                        </label>
                                        <FormField
                                            label={undefined}
                                            id="email"
                                            type="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            ref={emailInputRef}
                                            readOnly={emailStep || authInProgress === 'google'}
                                            disabled={authInProgress === 'google' || (authInProgress === 'password' && emailStep) || loading}
                                            placeholder="name@example.com"
                                            startIcon={<Mail className="w-5 h-5 text-gray-400" />}
                                            endAdornment={emailStep ? (
                                                <button
                                                    type="button"
                                                    onClick={handleEmailEdit}
                                                    disabled={loading || authInProgress !== null}
                                                    className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600 dark:text-blue-400 bg-gray-100 dark:bg-gray-700 hover:text-blue-700 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors z-20 ${loading || authInProgress !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    aria-label="Edit email"
                                                >
                                                    <FaEdit className="text-sm" />
                                                </button>
                                            ) : null}
                                            inputClassName={`transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 ${emailStep ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 pr-20' : ''}`}
                                            required
                                        />

                                        {/* Forgot Password Link under email (only before password step) */}
                                        {!emailStep && (
                                            <div className="flex items-center justify-between text-sm font-medium mt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPolicyModal(true)}
                                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-1.5 focus:outline-none"
                                                >
                                                    <span>Password Attempt Policy</span>
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </button>
                                                <Link
                                                    to={`/forgot-password?email=${encodeURIComponent(formData.email || '')}`}
                                                    className={`text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors ${(authInProgress !== null || loading) ? 'opacity-50 pointer-events-none' : ''}`}
                                                >
                                                    Forgot Password?
                                                </Link>
                                            </div>
                                        )}
                                    </div>

                                    {emailStep && (
                                        <div className="animate-fade-in">
                                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
                                                Password
                                            </label>
                                            <FormField
                                                label={undefined}
                                                id="password"
                                                type={showPassword ? 'text' : 'password'}
                                                value={formData.password}
                                                onChange={handleChange}
                                                ref={passwordInputRef}
                                                disabled={authInProgress === 'google' || authInProgress === 'password' || loading}
                                                placeholder="Enter your password"
                                                startIcon={<Lock className="w-5 h-5 text-gray-400" />}
                                                endAdornment={
                                                    <button
                                                        type="button"
                                                        disabled={authInProgress === 'google'}
                                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none"
                                                        tabIndex={-1}
                                                        onClick={() => setShowPassword((prev) => !prev)}
                                                    >
                                                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                                                    </button>
                                                }
                                                inputClassName="transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 dark:bg-gray-800 dark:text-white"
                                                required
                                            />

                                            <div className="flex items-center justify-between text-sm font-medium mt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPolicyModal(true)}
                                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-1.5 focus:outline-none"
                                                >
                                                    <span>Password Attempt Policy</span>
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </button>
                                                <Link
                                                    to={`/forgot-password?email=${encodeURIComponent(formData.email)}`}
                                                    className={`text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors ${(authInProgress !== null || loading) ? 'opacity-50 pointer-events-none' : ''}`}
                                                >
                                                    Forgot Password?
                                                </Link>
                                            </div>
                                        </div>
                                    )}

                                    {/* reCAPTCHA Widget */}
                                    {showRecaptcha && checkRecaptchaRequirement() && (
                                        <div className="flex justify-center animate-fade-in">
                                            <RecaptchaWidget
                                                key={recaptchaKey}
                                                ref={recaptchaRef}
                                                onVerify={handleRecaptchaVerify}
                                                onExpire={handleRecaptchaExpire}
                                                onError={handleRecaptchaError}
                                                disabled={loading || authInProgress === 'google'}
                                                className="transform scale-95 origin-center"
                                            />
                                        </div>
                                    )}

                                    {/* reCAPTCHA Error */}
                                    {recaptchaError && (
                                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-red-600 text-sm flex items-center gap-2 animate-fade-in">
                                            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {recaptchaError}
                                        </div>
                                    )}

                                    <div className="pt-2">
                                        <PrimaryButton
                                            variant="blue"
                                            loading={loading}
                                            loadingText={emailStep ? "Signing In..." : "Continuing..."}
                                            disabled={loading || (showRecaptcha && !recaptchaToken) || authInProgress !== null}
                                            className="w-full py-3 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
                                        >
                                            {emailStep ? "Sign In" : "Continue"}
                                        </PrimaryButton>
                                    </div>
                                </form>
                            ) : (
                                // OTP Sign In Form
                                <form onSubmit={otpSent ? handleOtpLogin : handleSendOTP} className="space-y-5 relative z-10">
                                    <div className="animate-fade-in delay-100">
                                        {!otpSent && (
                                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
                                                Email Address
                                            </label>
                                        )}
                                        <FormField
                                            label={undefined}
                                            id="email"
                                            type="email"
                                            value={otpData.email}
                                            onChange={handleOtpChange}
                                            ref={otpEmailInputRef}
                                            readOnly={otpSent || otpLoading || authInProgress === 'google'}
                                            disabled={otpSent || otpLoading || authInProgress === 'google'}
                                            placeholder="name@example.com"
                                            startIcon={<Mail className="w-5 h-5 text-gray-400" />}
                                            endAdornment={otpSent ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setOtpSent(false);
                                                        setOtpData({ email: otpData.email, otp: "" });
                                                        setOtpSuccessMessage("");
                                                    }}
                                                    disabled={loading || authInProgress !== null}
                                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600 dark:text-blue-400 bg-gray-100 dark:bg-gray-700 hover:text-blue-700 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors z-20"
                                                    aria-label="Edit email"
                                                >
                                                    <FaEdit className="text-sm" />
                                                </button>
                                            ) : null}
                                            inputClassName={`transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 ${otpSent ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 pr-20' : ''}`}
                                            required
                                        />
                                    </div>

                                    {/* OTP reCAPTCHA Widget */}
                                    {showOtpRecaptcha && !otpSent && (
                                        <div className="flex justify-center mb-4 animate-fade-in">
                                            <RecaptchaWidget
                                                key={otpRecaptchaKey}
                                                ref={otpRecaptchaRef}
                                                onVerify={handleOtpRecaptchaVerify}
                                                onExpire={handleOtpRecaptchaExpire}
                                                onError={handleOtpRecaptchaError}
                                                disabled={otpLoading}
                                                className="transform scale-95 origin-center"
                                            />
                                        </div>
                                    )}

                                    {otpRecaptchaError && !otpSent && (
                                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-red-600 text-sm flex items-center gap-2 animate-fade-in">
                                            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {otpRecaptchaError}
                                        </div>
                                    )}

                                    {otpSent && (
                                        <div className="animate-fade-in">
                                            {otpSuccessMessage && (
                                                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4 text-green-700 dark:text-green-400 text-sm flex items-center gap-2">
                                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                    {otpSuccessMessage}
                                                </div>
                                            )}
                                            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
                                                OTP Code
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="••••••"
                                                id="otp"
                                                value={otpData.otp}
                                                ref={otpInputRef}
                                                disabled={otpVerifyingLoading}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/[^0-9]/g, '');
                                                    handleOtpChange({ target: { id: 'otp', value } });
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && otpSent && !otpVerifyingLoading && otpData.otp.length === 6) {
                                                        handleOtpLogin(e);
                                                    }
                                                }}
                                                className={`w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 text-center text-2xl tracking-[0.5em] font-medium text-gray-800 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600 bg-white dark:bg-gray-800 ${otpVerifyingLoading ? 'bg-gray-100 dark:bg-gray-700 opacity-70' : ''}`}
                                                maxLength="6"
                                                required
                                            />
                                            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                                                Enter the 6-digit code sent to your email
                                            </p>
                                        </div>
                                    )}

                                    {otpSent && (
                                        <div className="text-center animate-fade-in">
                                            {resendTimer > 0 ? (
                                                <span className="text-sm text-gray-400 font-medium">
                                                    Resend in <span className="text-gray-600 dark:text-gray-300">{Math.floor(resendTimer / 60)}:{(resendTimer % 60).toString().padStart(2, '0')}</span>
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={handleSendOTP}
                                                    disabled={otpLoading || !canResend || otpVerifyingLoading}
                                                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors disabled:opacity-50"
                                                >
                                                    {otpLoading ? "Sending..." : "Resend OTP"}
                                                </button>
                                            )}

                                            {showOtpRecaptcha && (
                                                <div className="flex justify-center mt-3 animate-fade-in">
                                                    <RecaptchaWidget
                                                        key={otpRecaptchaKey}
                                                        ref={otpRecaptchaRef}
                                                        onVerify={handleOtpRecaptchaVerify}
                                                        onExpire={handleOtpRecaptchaExpire}
                                                        onError={handleOtpRecaptchaError}
                                                        disabled={otpLoading}
                                                        className="transform scale-95 origin-center"
                                                    />
                                                </div>
                                            )}
                                            {otpRecaptchaError && (
                                                <div className="bg-red-50 border border-red-100 rounded-lg p-2 mt-2 text-red-600 text-xs">
                                                    {otpRecaptchaError}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="pt-2">
                                        <PrimaryButton
                                            variant="blue"
                                            loading={loading || (!otpSent && otpLoading) || otpVerifyingLoading}
                                            loadingText={otpVerifyingLoading ? "Verifying..." : (otpSent ? "Signing In..." : "Sending OTP...")}
                                            disabled={loading || authInProgress === 'google' || (!otpSent && (otpLoading || !canResend)) || (otpRequiresCaptcha && !otpRecaptchaToken) || (otpSent && otpData.otp.length !== 6) || otpVerifyingLoading}
                                            className="w-full py-3 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
                                        >
                                            {otpSent ? "Sign In" : "Send OTP"}
                                        </PrimaryButton>
                                    </div>
                                </form>
                            )}

                            <div className="relative my-8">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-3 bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 font-medium">OR CONTINUE WITH</span>
                                </div>
                            </div>

                            <Oauth
                                pageType="signIn"
                                disabled={authInProgress !== null}
                                onAuthStart={setAuthInProgress}
                            onAuthSuccess={(data) => {
                                    // Commit tokens and Redux state, then navigate
                                    if (data.token) {
                                        localStorage.setItem('accessToken', data.token);
                                        if (data.sessionId) localStorage.setItem('sessionId', data.sessionId);
                                        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
                                        localStorage.setItem('login', Date.now());
                                    }
                                    dispatch(signInSuccess(data));
                                    syncSettingsFromUser(data);
                                    reconnectSocket();
                                    navigateAfterLogin(data);
                                }}
                            />

                             {(error || urlError) && (
                                <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl p-4 flex items-start gap-3 animate-fade-in transition-colors">
                                    <svg className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <div className="flex-1">
                                        <p className="text-red-700 dark:text-red-300 text-sm font-medium transition-colors">{urlError || error}</p>
                                        <p className="text-red-600 dark:text-red-400 font-mono text-xs mt-1 transition-colors">Error Code: {getErrorCode(urlError || error)}</p>
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 text-center">
                                <p className="text-gray-500 dark:text-gray-300 font-medium">
                                    Don't have an account?{" "}
                                    <Link
                                        to={`/sign-up${location.search}`}
                                        className={`text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold hover:underline transition-colors ${(authInProgress !== null || loading || otpVerifyingLoading) ? 'opacity-50 pointer-events-none' : ''}`}
                                    >
                                        Sign Up
                                    </Link>
                                </p>
                                <p className="mt-4 text-sm text-gray-500 dark:text-gray-300">
                                    Trouble signing in?{" "}
                                    <Link
                                        to="/help-center"
                                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium hover:underline transition-colors"
                                    >
                                        Visit our Help Center
                                    </Link>
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                By signing in, you agree to our <a href="/terms" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors underline">Terms of Service</a> and <a href="/privacy" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors underline">Privacy Policy</a>.
                            </p>
                        </div>

                        <SecureBadge />
                    </div>
                </div>
            </AuthFormLayout>

            {/* Password Attempt Policy Modal */}
            {showPolicyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
                    <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-2xl max-w-xl w-full border border-gray-200 dark:border-gray-700 animate-fade-in text-left">
                        {/* Crimson Header Bar */}
                        <div className="bg-gradient-to-r from-red-700 to-red-600 px-5 py-3.5 flex justify-between items-center text-white">
                            <h3 className="font-bold text-lg tracking-wide">Please Note:</h3>
                            <button 
                                onClick={() => setShowPolicyModal(false)}
                                className="bg-white hover:bg-gray-100 text-red-700 hover:text-red-800 rounded font-bold w-6 h-6 flex items-center justify-center transition-colors focus:outline-none"
                                aria-label="Close modal"
                            >
                                &#x2715;
                            </button>
                        </div>
                        
                        {/* Modal Body */}
                        <div className="p-5 pb-3">
                            <div className="bg-blue-50/50 dark:bg-slate-900/40 border border-blue-200/60 dark:border-slate-800 rounded-lg p-5 pb-3 flex flex-col md:flex-row gap-5 items-center md:items-start">
                                {/* Purple Exclamation Icon */}
                                <div className="flex-shrink-0 bg-white dark:bg-gray-705 p-3 rounded-full border border-purple-200 dark:border-purple-900/40 shadow-sm">
                                    <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                
                                {/* Bulleted List */}
                                <div className="flex-1">
                                    <ul className="list-disc list-outside ml-5 space-y-3 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                                        <li>You are allowed a maximum of <strong className="text-gray-900 dark:text-white font-bold">5 incorrect password attempts</strong>.</li>
                                        <li>After 5 failed attempts, your account will be <strong className="text-gray-900 dark:text-white font-bold">locked for 15 minutes</strong>.</li>
                                        <li>During this lock period, you will not be able to log in or attempt to reset your password.</li>
                                        <li>Once the 15-minute lock period has ended, you can try to log in again with the correct password.</li>
                                        <li>If you have forgotten your password, use the <strong className="text-gray-900 dark:text-white font-bold">"Forgot Password"</strong> option to reset it.</li>
                                        <li>Please ensure you remember your password to avoid getting locked out.</li>
                                    </ul>
                                </div>
                            </div>
                            
                            {/* Divider and Footer Button */}
                            <div className="border-t border-dashed border-gray-200 dark:border-gray-700 mt-2.5 pt-2.5 flex justify-center">
                                <button
                                    onClick={() => setShowPolicyModal(false)}
                                    className="px-8 py-2 bg-purple-600 hover:bg-purple-750 text-white rounded-full font-semibold shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none"
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}