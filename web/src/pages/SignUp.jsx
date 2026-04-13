import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaEye, FaEyeSlash, FaCheck, FaTimes, FaEdit, FaGift, FaCheckCircle } from "react-icons/fa";
import UrbanSetuSpinner from "../components/UrbanSetuSpinner";
import Oauth from "../components/Oauth";
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import RecaptchaWidget from "../components/RecaptchaWidget";
import { toast } from 'react-toastify';
import SEO from '../components/SEO';
import { useSelector } from "react-redux";
import { calculatePasswordStrength, getPasswordStrengthColor, getPasswordStrengthBgColor, getPasswordStrengthText, meetsMinimumRequirements } from "../utils/passwordStrength.js";
import { authenticatedFetch, getCSRFToken } from '../utils/csrf';
import { usePageTitle } from '../hooks/usePageTitle';
import { UserPlus, Mail, Lock, User, Phone } from "lucide-react";
import PrimaryButton from "../components/ui/PrimaryButton";
import AuthFormLayout from "../components/ui/AuthFormLayout";
import SelectField from "../components/ui/SelectField";
import FormField from "../components/ui/FormField";
import PremiumLoader from "../components/ui/PremiumLoader";
import { syncSettingsFromUser } from "../utils/settingsSync";
import SecureBadge from "../components/ui/SecureBadge";
import ThirdPartyCookieBanner from "../components/ThirdPartyCookieBanner";
import { useDispatch } from "react-redux";
import { signInSuccess } from "../redux/user/userSlice.js";
import { reconnectSocket } from "../utils/socket";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function SignUp({ bootstrapped, sessionChecked }) {
  // Set page title
  usePageTitle("Sign Up - Join Our Community");

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "",   // 🔥 added role field here
    mobileNumber: "",
    address: "",
  });

  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    level: 'very-weak',
    feedback: []
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showCPassword, setShowCPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    email: "",
    mobileNumber: ""
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const [referredBy, setReferredBy] = useState(null);
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [referralCodeStatus, setReferralCodeStatus] = useState({ loading: false, valid: null, name: '' }); // { loading, valid: true/false/null, name }
  const { currentUser } = useSelector((state) => state.user);
  const [consent, setConsent] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [recaptchaError, setRecaptchaError] = useState("");
  const [recaptchaKey, setRecaptchaKey] = useState(0);
  const [recaptchaJustVerified, setRecaptchaJustVerified] = useState(false);
  const recaptchaRef = useRef(null);

  // Email verification states
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [emailEditMode, setEmailEditMode] = useState(false);
  const [otpCaptchaRequired, setOtpCaptchaRequired] = useState(false);

  // Timer states for resend OTP
  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(true);

  // State to track which authentication method is in progress
  const [authInProgress, setAuthInProgress] = useState(null); // null, 'form', 'google'
  const [showLoader, setShowLoader] = useState(false);
  const [pendingLoginData, setPendingLoginData] = useState(null);
  const pendingRedirectRef = useRef(null); // useRef to avoid closure staleness in PremiumLoader
  const dispatch = useDispatch();

  const checkPasswordStrength = (password) => {
    const strength = calculatePasswordStrength(password);
    setPasswordStrength(strength);
  };

  // reCAPTCHA handlers
  const handleRecaptchaVerify = (token) => {
    setRecaptchaToken(token);
    setRecaptchaError("");
    // Show tick for ~1s before hiding
    setRecaptchaJustVerified(true);
    setTimeout(() => setRecaptchaJustVerified(false), 1000);
    // If OTP resend captcha was required, auto-hide the widget + any OTP error after 1s
    if (otpCaptchaRequired) {
      setTimeout(() => {
        setOtpCaptchaRequired(false);
        setOtpError("");
      }, 1000);
    }
  };

  const handleRecaptchaExpire = () => {
    setRecaptchaToken(null);
    setRecaptchaError("reCAPTCHA expired. Please verify again.");
    setRecaptchaKey((k) => k + 1);
    // Show captcha again on expire
    // Rendering is gated by !recaptchaToken, so this will make it visible
  };

  const handleRecaptchaError = (error) => {
    setRecaptchaToken(null);
    setRecaptchaError("reCAPTCHA verification failed. Please try again.");
    setRecaptchaKey((k) => k + 1);
    // Will re-render due to null token
  };

  const resetRecaptcha = () => {
    if (recaptchaRef.current) {
      recaptchaRef.current.reset();
    }
    setRecaptchaToken(null);
    setRecaptchaError("");
    setRecaptchaKey((k) => k + 1);
  };

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

  // Handle 'ref' parameter for referrals and 'redirect' for context messages
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    // 1. Referral Logic - support both ?ref=userId and ?ref=REFERRALCODE
    const ref = params.get('ref') || localStorage.getItem('urbansetu_ref');
    if (ref) {
      // Check if it's a referral code (alphanumeric, 8 chars, no lowercase hex pattern) vs a MongoDB ObjectId
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(ref);
      if (isObjectId) {
        setReferredBy(ref);
        // Also fetch the referral code to populate the input field for visual consistency
        (async () => {
          try {
            const res = await fetch(`${API_BASE_URL}/api/coins/referral-info/${ref}`);
            const data = await res.json();
            if (data.success) {
              setReferralCodeInput(data.referralCode);
              setReferralCodeStatus({ loading: false, valid: true, name: data.referrerName });
            }
          } catch (e) { console.error('Failed to fetch referral info for ID:', e); }
        })();
      } else {
        // It's a referral code - resolve it
        const upperCode = ref.toUpperCase();
        setReferralCodeInput(upperCode);
        (async () => {
          try {
            const res = await fetch(`${API_BASE_URL}/api/coins/resolve-referral/${upperCode}`);
            const data = await res.json();
            if (data.success && data.referrerId) {
              setReferredBy(data.referrerId);
              setReferralCodeStatus({ loading: false, valid: true, name: data.referrerName });
            }
          } catch (e) { console.error('Failed to resolve referral code from URL:', e); }
        })();
      }
      console.log("Referral detected:", ref);

      // Show referral bonus toast only if 'ref' is presently in URL
      if (params.get('ref') && !toast.isActive('referral-bonus')) {
        toast.success("Create an account to claim your referral bonus!", {
          toastId: 'referral-bonus'
        });
      }
    }

    // 2. Context Toast Logic (redirect)
    const redirect = params.get('redirect');
    if (redirect) {
      const actionMessages = {
        like: "Please create an account to like this content",
        dislike: "Please create an account to react",
        comment: "Please create an account to comment",
        reply: "Please create an account to reply",
        report: "Please create an account to report content",
        chat: "Please create an account to start a chat",
        book: "Please create an account to book an appointment",
        review: "Please create an account to leave a review",
        rate: "Please create an account to rate",
        access: "Please create an account to access this page",
        save: "Please create an account to save this item",
        vote: "Please create an account to vote"
      };

      let message = actionMessages[redirect] || "Please create an account to access this page";

      if (!toast.isActive(`signup-redirect-${redirect}`)) {
        toast.info(message, { toastId: `signup-redirect-${redirect}` });
      }
    }
  }, [location]);

  // Redirect if already logged in (but NOT during PremiumLoader — finalizeLogin handles that)
  useEffect(() => {
    if (showLoader) return; // Don't interfere while PremiumLoader is active
    if (currentUser && sessionChecked) {
      const searchParams = new URLSearchParams(location.search);
      const redirectUrl = searchParams.get('redirect');
      if (redirectUrl && redirectUrl.startsWith('/')) {
        navigate(redirectUrl, { replace: true });
      } else if (currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/user', { replace: true });
      }
    }
  }, [currentUser, sessionChecked, navigate, location.search, showLoader]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData({
      ...formData,
      [id]: value,
    });

    // Clear field-specific errors when user starts typing
    if (id === "email" || id === "mobileNumber") {
      setFieldErrors(prev => ({
        ...prev,
        [id]: ""
      }));
    }

    // Reset email verification when email changes
    if (id === "email") {
      // If email is changed while in edit mode, reset verification state
      if (emailEditMode) {
        setEmailVerified(false);
        setOtpSent(false);
        setOtp("");
        setOtpError("");
        setResendTimer(0);
        setCanResend(true);
        setEmailEditMode(false);
      } else if (!emailVerified) {
        // Only reset if not verified (to avoid resetting when typing for the first time)
        setOtpSent(false);
        setOtp("");
        setOtpError("");
        setResendTimer(0);
        setCanResend(true);
      }
    }

    if (id === "password") {
      checkPasswordStrength(value);
    }
  };

  // Send OTP
  const handleSendOTP = async () => {
    if (!formData.email) {
      setOtpError("Please enter an email address first");
      return;
    }

    if (!canResend) {
      return;
    }

    setOtpLoading(true);
    setOtpError("");

    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/send-otp`, {
        method: "POST",
        body: JSON.stringify({
          email: formData.email,
          ...(recaptchaToken ? { recaptchaToken } : {})
        }),
      });

      const data = await res.json();

      if (data.success) {
        setOtpSent(true);
        setSuccess("OTP sent successfully to your email");
        setTimeout(() => setSuccess(""), 3000);

        // Start timer for resend
        setResendTimer(30); // 30 seconds
        setCanResend(false);
        setOtpCaptchaRequired(false);
      } else {
        setOtpError(data.message);
        if (data.requiresCaptcha || (data.message && data.message.toLowerCase().includes('recaptcha'))) {
          setOtpCaptchaRequired(true);
        }
      }
    } catch (error) {
      setOtpError("Failed to send OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOTP = async () => {
    if (!otp) {
      setOtpError("Please enter the OTP");
      return;
    }

    setVerifyLoading(true);
    setOtpError("");

    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: "POST",
        body: JSON.stringify({
          email: formData.email,
          otp: otp
        }),
      });

      const data = await res.json();

      if (data.success) {
        setEmailVerified(true);
        setSuccess("Email verified successfully!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setOtpError(data.message);
      }
    } catch (error) {
      setOtpError("Failed to verify OTP. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!consent) {
      setError("You must agree to the Terms of Use and Privacy Policy.");
      return;
    }

    if (!emailVerified) {
      setError("Please verify your email address before creating an account.");
      return;
    }

    if (!recaptchaToken) {
      setError("Please complete the reCAPTCHA verification.");
      return;
    }

    setLoading(true);
    setAuthInProgress('form');
    setError("");
    setSuccess("");
    setFieldErrors({ email: "", mobileNumber: "" });
    setRecaptchaError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords are not matching");
      setLoading(false);
      return;
    }

    if (!formData.role) {
      setError("Please select a role");
      setLoading(false);
      return;
    }

    try {
      const apiUrl = `${API_BASE_URL}/api/auth/signup`;
      const res = await authenticatedFetch(apiUrl, {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          emailVerified: true,
          recaptchaToken,
          referredBy, // Pass referral ID to backend
          referralCode: (!referredBy && referralCodeInput) ? referralCodeInput : undefined // Pass referral code if no ref link
        }),
      });
      const data = await res.json();
      if (data.success === false) {
        // Handle field-specific errors
        if (data.message.includes("email already exists")) {
          setFieldErrors(prev => ({
            ...prev,
            email: data.message
          }));
        } else if (data.message.includes("mobile number already exists")) {
          setFieldErrors(prev => ({
            ...prev,
            mobileNumber: data.message
          }));
        } else if (data.message.includes("reCAPTCHA")) {
          setRecaptchaError(data.message);
          resetRecaptcha();
        } else {
          setError(data.message);
        }
        setLoading(false);
      } else {
        setError("");
        setLoading(false);
        if (formData.role === 'admin' || formData.role === 'rootadmin') {
          setSuccess("Admin account created successfully. Please wait for an existing admin to approve your request.");
          setTimeout(() => {
            setSuccess("");
            navigate("/sign-in");
          }, 3000);
        } else {
          // Attempt auto-login
          try {
            const loginRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/signin`, {
              method: "POST",
              body: JSON.stringify({
                email: formData.email,
                password: formData.password
              }),
            });

            const loginData = await loginRes.json();

            if (loginRes.ok) {
              setSuccess("Account created! Logging you in...");

              // Capture redirect URL BEFORE showing loader (ref avoids closure issues)
              const signupSearchParams = new URLSearchParams(location.search);
              pendingRedirectRef.current = signupSearchParams.get('redirect');

              setPendingLoginData(loginData);
              setShowLoader(true);
            } else {
              setSuccess("Account created successfully! Redirecting to login...");
              setTimeout(() => navigate("/sign-in"), 2000);
            }
          } catch (loginError) {
            console.error("Auto-login failed:", loginError);
            setSuccess("Account created successfully! Redirecting to login...");
            setTimeout(() => navigate("/sign-in"), 2000);
          }
        }
        return;
      }
    } catch (error) {
      setError(error.message);
      setLoading(false);
    } finally {
      setAuthInProgress(null);
    }
  };

  const finalizeLogin = async () => {
    if (pendingLoginData) {
      if (pendingLoginData.token) {
        localStorage.setItem('accessToken', pendingLoginData.token);
        if (pendingLoginData.sessionId) localStorage.setItem('sessionId', pendingLoginData.sessionId);
        if (pendingLoginData.refreshToken) localStorage.setItem('refreshToken', pendingLoginData.refreshToken);
        localStorage.setItem('login', Date.now());
      }
      dispatch(signInSuccess(pendingLoginData));

      // Sync user settings (theme, fontSize, language, etc.) from backend to localStorage
      syncSettingsFromUser(pendingLoginData);

      // Reconnect socket with new token
      reconnectSocket();

      // Use the captured redirect URL (ref is always up-to-date, no closure issues)
      // Fallback chain: ref → window.location.search (belt-and-suspenders)
      let redirectUrl = pendingRedirectRef.current;
      if (!redirectUrl) {
        const fallbackParams = new URLSearchParams(window.location.search);
        redirectUrl = fallbackParams.get('redirect');
      }

      if (redirectUrl && redirectUrl.startsWith('/')) {
        navigate(redirectUrl, { replace: true });
      } else {
        // Navigate based on user role
        if (pendingLoginData.role === "admin" || pendingLoginData.role === "rootadmin") {
          navigate("/admin");
        } else {
          navigate("/user");
        }
      }
    } else {
      // Fallback for regular signup (not logged in yet)
      navigate("/sign-in");
    }
  };



  return (
    <>
      <SEO
        title="Sign Up - Join UrbanSetu Community"
        description="Join UrbanSetu to find your dream home, list your properties, and connect with trusted buyers and sellers in the Indian real estate market."
        keywords="urban setu register, create account real estate, join urbansetu, real estate community India"
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
                `}
            </style>


            {/* Left Side - Image and Quote */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 relative overflow-hidden">
              <div className="absolute inset-0 bg-black opacity-20"></div>
              <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
                <div className="text-center max-w-md">
                  <h1 className="text-4xl font-bold mb-6 animate-fade-in">
                    Join Our Community
                  </h1>
                  <p className="text-xl mb-8 leading-relaxed animate-fade-in-delay">
                    "Every house has a story. Let's write yours together."
                  </p>
                  <div className="space-y-4 text-lg animate-fade-in-delay-2">
                    <div className="flex items-center justify-center space-x-3">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span>Find Your Perfect Home</span>
                    </div>
                    <div className="flex items-center justify-center space-x-3">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                      <span>List Your Properties</span>
                    </div>
                    <div className="flex items-center justify-center space-x-3">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                      <span>Connect with Buyers & Sellers</span>
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
                  <path d="M15 6L18 8V18H22V8L15 6Z" fill="white" fillOpacity="0.1" />
                  <path d="M17 12H20V18H17V12Z" fill="white" fillOpacity="0.2" />
                </svg>
              </div>
            </div>
          </>
        )}
      >

        {/* Right Side - Sign Up Form */}
        <>
          <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 bg-gray-50 dark:bg-gray-900 min-h-screen">
            {showLoader ? (
              <PremiumLoader mode={(pendingLoginData?.isNewUser === false) ? 'signin' : 'signup'} onComplete={finalizeLogin} />
            ) : (
              <div className="w-full max-w-[480px] animate-fade-in">
                <div className="text-center mb-10">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-6 shadow-sm">
                    <UserPlus className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
                    Create Account
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 text-lg">Join thousands of users finding their perfect homes</p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 relative overflow-hidden">
                  {/* Decorative background element for card */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 dark:bg-green-900/20 rounded-full -mr-16 -mt-16 opacity-50 pointer-events-none"></div>

                  <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                    <div>
                      <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <FormField
                        label={undefined}
                        id="username"
                        type="text"
                        placeholder="Enter your full name"
                        onChange={handleChange}
                        disabled={authInProgress === 'google'}
                        startIcon={<User className="w-5 h-5 text-gray-400" />}
                        inputClassName={`transition-all duration-200 focus:ring-2 focus:ring-green-500/20 ${authInProgress === 'google' ? 'bg-gray-100 cursor-not-allowed' : ''} hover:border-green-500`}
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
                        Email Address <span className="text-red-500">*</span>
                        {emailVerified && (
                          <span className="ml-2 text-green-600">
                            <FaCheck className="inline" />
                          </span>
                        )}
                      </label>
                      <FormField
                        label={undefined}
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        value={formData.email}
                        onChange={handleChange}
                        readOnly={((emailVerified || otpSent) && !emailEditMode) || otpLoading}
                        disabled={authInProgress === 'google' || ((emailVerified || otpSent) && !emailEditMode) || otpLoading}
                        startIcon={<Mail className="w-5 h-5 text-gray-400" />}
                        endAdornment={
                          !emailVerified && !otpSent ? (
                            <button
                              type="button"
                              onClick={handleSendOTP}
                              disabled={otpLoading || !canResend || !formData.email}
                              className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {otpLoading ? "Sending..." : "Send OTP"}
                            </button>
                          ) : (
                            (!emailEditMode) && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 z-20 bg-gray-100 pl-1 rounded-l-sm">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEmailEditMode(true);
                                    setOtpSent(false);
                                    setOtp("");
                                    setCanResend(true);
                                    setResendTimer(0);
                                    setEmailVerified(false);
                                  }}
                                  className="text-blue-600 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition-colors"
                                  title="Edit email"
                                  aria-label="Edit email"
                                >
                                  <FaEdit className="text-sm" />
                                </button>
                                <div className="text-green-600">
                                  <FaCheck className="text-xl" />
                                </div>
                              </div>
                            )
                          )
                        }
                        inputClassName={`transition-all duration-200 focus:ring-2 focus:ring-green-500/20 ${((emailVerified || otpSent) && !emailEditMode) || otpLoading ? 'bg-gray-100 cursor-not-allowed border-green-500 pr-24' : (fieldErrors.email ? 'border-red-500' : (emailVerified ? 'border-green-500' : 'border-gray-300'))} ${authInProgress === 'google' ? 'bg-gray-100 cursor-not-allowed' : ''} hover:border-green-500`}
                        required
                      />
                      {fieldErrors.email && (
                        <p className="text-red-500 text-sm mt-1">{fieldErrors.email}</p>
                      )}
                      {otpSent && !emailVerified && (
                        <p className="text-sm text-gray-600 mt-2">
                          OTP sent to {formData.email}
                        </p>
                      )}
                      {/* OTP Error Message - Show below email field when OTP field is not open */}
                      {otpError && !otpSent && (
                        <p className="text-red-500 text-sm mt-2">{otpError}</p>
                      )}
                      {/* If captcha required before OTP field is open, show below email */}
                      {otpCaptchaRequired && !otpSent && (
                        <div className="mt-3">
                          <div className="flex justify-center">
                            <RecaptchaWidget
                              key={`signup-otp-email-${recaptchaKey}`}
                              ref={recaptchaRef}
                              onVerify={handleRecaptchaVerify}
                              onExpire={handleRecaptchaExpire}
                              onError={handleRecaptchaError}
                              disabled={otpLoading}
                              className="transform scale-90"
                            />
                          </div>
                          {otpError && (
                            <p className="text-red-500 text-sm mt-2 text-center">{otpError}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* OTP Verification Field */}
                    {otpSent && !emailVerified && (
                      <div>
                        <label htmlFor="otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
                          Enter OTP
                        </label>
                        <div className="flex flex-row gap-2">
                          <input
                            type="text"
                            placeholder="Enter 6-digit OTP"
                            id="otp"
                            value={otp}
                            disabled={verifyLoading}
                            onChange={(e) => {
                              // Only allow numbers
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              setOtp(value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (otp && otp.length === 6 && !verifyLoading) {
                                  handleVerifyOTP();
                                }
                              }
                            }}
                            className={`flex-1 px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all duration-200 text-sm sm:text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${verifyLoading ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''
                              }`}
                            maxLength="6"
                          />
                          <button
                            type="button"
                            onClick={handleVerifyOTP}
                            disabled={verifyLoading || otp.length !== 6}
                            className="px-3 py-2 sm:px-4 sm:py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm sm:text-base whitespace-nowrap shadow-sm"
                          >
                            {verifyLoading ? "Verifying..." : "Verify"}
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Enter the 6-digit code sent to your email
                          </p>
                          <div className="flex items-center gap-2">
                            {resendTimer > 0 ? (
                              <span className="text-xs text-gray-500">
                                Resend in {Math.floor(resendTimer / 60)}:{(resendTimer % 60).toString().padStart(2, '0')}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={handleSendOTP}
                                disabled={otpLoading || verifyLoading}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {otpLoading ? "Sending..." : "Resend OTP"}
                              </button>
                            )}
                          </div>
                        </div>
                        {/* OTP Error Message and conditional reCAPTCHA below OTP field */}
                        {otpError && (
                          <p className="text-red-500 text-sm mt-2">{otpError}</p>
                        )}
                        {/* If backend requested captcha during resends, render captcha below OTP */}
                        {(otpCaptchaRequired) && (
                          <div className="flex justify-center mt-3">
                            <RecaptchaWidget
                              key={`otp-${recaptchaKey}`}
                              ref={recaptchaRef}
                              onVerify={handleRecaptchaVerify}
                              onExpire={handleRecaptchaExpire}
                              onError={handleRecaptchaError}
                              disabled={otpLoading}
                              className="transform scale-90"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
                        Mobile Number <span className="text-red-500">*</span>
                      </label>
                      <FormField
                        label={undefined}
                        id="mobileNumber"
                        type="tel"
                        placeholder="Enter 10-digit mobile number"
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/[^0-9]/g, '');
                          handleChange({ target: { id: 'mobileNumber', value: digitsOnly } });
                        }}
                        value={formData.mobileNumber || ''}
                        inputMode="numeric"
                        pattern="[0-9]{10}"
                        maxLength="10"
                        startIcon={<Phone className="w-5 h-5 text-gray-400" />}
                        inputClassName={`transition-all duration-200 focus:ring-2 focus:ring-green-500/20 ${fieldErrors.mobileNumber ? 'border-red-500' : 'border-gray-300'} ${authInProgress === 'google' ? 'bg-gray-100 cursor-not-allowed' : ''} hover:border-green-500`}
                        disabled={authInProgress === 'google'}
                        required
                      />
                      {fieldErrors.mobileNumber && (
                        <p className="text-red-500 text-sm mt-1">{fieldErrors.mobileNumber}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
                        Address
                      </label>
                      <div className="relative">
                        <FormField
                          label={undefined}
                          id="address"
                          type="text"
                          placeholder="Enter or fetch your address"
                          onChange={handleChange}
                          value={formData.address || ''}
                          disabled={authInProgress === 'google'}
                          inputClassName={`transition-all duration-200 focus:ring-2 focus:ring-green-500/20 ${authInProgress === 'google' ? 'bg-gray-100 cursor-not-allowed' : ''} hover:border-green-500 pr-12`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!navigator.geolocation) {
                              toast.error("Geolocation is not supported by your browser");
                              return;
                            }
                            const toastId = toast.loading("Fetching location...");
                            navigator.geolocation.getCurrentPosition(
                              async (position) => {
                                try {
                                  const { latitude, longitude } = position.coords;
                                  let addressStr = `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`;
                                  try {
                                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                                    if (res.ok) {
                                      const data = await res.json();
                                      if (data.display_name) {
                                        addressStr = data.display_name;
                                      }
                                    }
                                  } catch (e) {
                                    console.error("Reverse geocoding error:", e);
                                  }
                                  handleChange({ target: { id: 'address', value: addressStr } });
                                  toast.update(toastId, {
                                    render: "Location fetched successfully",
                                    type: "success",
                                    isLoading: false,
                                    autoClose: 3000
                                  });
                                } catch (error) {
                                  toast.update(toastId, {
                                    render: "Failed to process location",
                                    type: "error",
                                    isLoading: false,
                                    autoClose: 5000
                                  });
                                }
                              },
                              (error) => {
                                console.error("Location error:", error);
                                let errorMsg = "Permission denied or location unavailable.";
                                if (error.code === error.TIMEOUT) {
                                  errorMsg = "Location request timed out. Please try again or enter manually.";
                                } else if (error.code === error.PERMISSION_DENIED) {
                                  errorMsg = "Location permission denied. Please enable it in your browser settings.";
                                }
                                toast.update(toastId, {
                                  render: errorMsg,
                                  type: "error",
                                  isLoading: false,
                                  autoClose: 5000
                                });
                              },
                              { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                            );
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-full transition-colors z-20"
                          title="Get current location"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        </button>
                      </div>
                    </div>

                    <SelectField
                      label={<span className="ml-1">I want to <span className="text-red-500">*</span></span>}
                      id="role"
                      value={formData.role}
                      onChange={handleChange}
                      disabled={authInProgress === 'google'}
                      required
                      selectClassName="transition-all duration-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 hover:border-green-500"
                      options={[
                        { value: "", label: "Select your role" },
                        { value: "user", label: "Buy/Sell Properties" },
                        { value: "admin", label: "Manage Platform (Admin)" },
                      ]}
                    />

                    {/* Password Field */}
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <FormField
                        label={undefined}
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create a strong password"
                        onChange={handleChange}
                        disabled={authInProgress === 'google'}
                        startIcon={<Lock className="w-5 h-5 text-gray-400" />}
                        endAdornment={
                          <div className="absolute inset-y-0 right-3 flex items-center cursor-pointer" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? (
                              <FaEyeSlash className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
                            ) : (
                              <FaEye className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
                            )}
                          </div>
                        }
                        inputClassName={`pr-12 border border-gray-300 transition-all duration-200 focus:ring-2 focus:ring-green-500/20 ${authInProgress === 'google' ? 'bg-gray-100 cursor-not-allowed' : ''} hover:border-green-500`}
                        required
                      />
                    </div>

                    {/* Enhanced Password Strength */}
                    {formData.password && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Password Strength:</span>
                          <span className={`text-sm font-semibold ${getPasswordStrengthColor(passwordStrength.level)}`}>
                            {getPasswordStrengthText(passwordStrength.level)}
                          </span>
                        </div>

                        {/* Strength Bar */}
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.level === 'very-weak' ? 'bg-red-500 w-1/5' :
                              passwordStrength.level === 'weak' ? 'bg-red-400 w-2/5' :
                                passwordStrength.level === 'medium' ? 'bg-yellow-400 w-3/5' :
                                  passwordStrength.level === 'strong' ? 'bg-green-400 w-4/5' :
                                    'bg-green-500 w-full'
                              }`}
                          ></div>
                        </div>

                        {/* Feedback */}
                        {passwordStrength.feedback.length > 0 && (
                          <div className={`p-3 rounded-lg ${getPasswordStrengthBgColor(passwordStrength.level)}`}>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To improve your password:</p>
                            <ul className="text-xs space-y-1">
                              {passwordStrength.feedback.map((item, index) => (
                                <li key={index} className="flex items-center">
                                  <span className="mr-2">•</span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Security Tips */}
                        <div className="text-xs text-gray-500 space-y-1">
                          <p>💡 <strong>Tip:</strong> Use a unique password for this account</p>
                          <p>🔒 <strong>Security:</strong> Consider using a password manager</p>
                        </div>
                      </div>
                    )}

                    {/* Confirm Password */}
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
                        Confirm Password <span className="text-red-500">*</span>
                      </label>
                      <FormField
                        label={undefined}
                        id="confirmPassword"
                        type={showCPassword ? 'text' : 'password'}
                        placeholder="Confirm your password"
                        onChange={handleChange}
                        disabled={authInProgress === 'google'}
                        startIcon={<Lock className="w-5 h-5 text-gray-400" />}
                        endAdornment={
                          <div className="absolute inset-y-0 right-3 flex items-center cursor-pointer" onClick={() => setShowCPassword(!showCPassword)}>
                            {showCPassword ? (
                              <FaEyeSlash className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
                            ) : (
                              <FaEye className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
                            )}
                          </div>
                        }
                        inputClassName={`pr-12 border border-gray-300 transition-all duration-200 focus:ring-2 focus:ring-green-500/20 ${authInProgress === 'google' ? 'bg-gray-100 cursor-not-allowed' : ''} hover:border-green-500`}
                        required
                      />
                    </div>

                    {/* Referral Code Field */}
                    <div className="relative">
                      {/* Integrated Message/Label Area */}
                      <label htmlFor="referralCodeInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
                        Referral Code <span className="text-xs text-gray-400 font-normal">(Optional)</span>
                        {referralCodeStatus.loading && (
                          <span className="ml-2 text-indigo-500 text-xs animate-pulse font-medium">Verifying code...</span>
                        )}
                        {!referralCodeStatus.loading && referralCodeStatus.valid === true && (
                          <span className="ml-2 text-green-600 text-xs font-bold flex items-center gap-1 inline-flex">
                            <FaCheckCircle className="inline" />
                            {(() => {
                              const params = new URLSearchParams(location.search);
                              const refParam = params.get('ref');
                              const isObjectId = /^[0-9a-fA-F]{24}$/.test(refParam);
                              return (referredBy && isObjectId) ? "Referral link applied!" : `Referred by ${referralCodeStatus.name}`;
                            })()}
                          </span>
                        )}
                        {!referralCodeStatus.loading && referralCodeStatus.valid === false && (
                          <span className="ml-2 text-red-500 text-xs font-medium animate-shake"><FaTimes className="inline mr-1" />Invalid code</span>
                        )}
                      </label>

                      <div className="relative group">
                        <FormField
                          label={undefined}
                          id="referralCodeInput"
                          type="text"
                          placeholder="Enter referral code (ABCD1234)"
                          value={referralCodeInput}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
                            setReferralCodeInput(val);

                            // Reset state if edited
                            if (val.length !== 8) {
                              setReferralCodeStatus({ loading: false, valid: null, name: '' });
                              if (val.length === 0) setReferredBy(null);
                            }

                            // Auto-validate when 8 chars entered
                            if (val.length === 8) {
                              setReferralCodeStatus({ loading: true, valid: null, name: '' });
                              fetch(`${API_BASE_URL}/api/coins/resolve-referral/${val}`)
                                .then(r => r.json())
                                .then(data => {
                                  if (data.success && data.referrerId) {
                                    setReferredBy(data.referrerId);
                                    setReferralCodeStatus({ loading: false, valid: true, name: data.referrerName });
                                  } else {
                                    setReferralCodeStatus({ loading: false, valid: false, name: '' });
                                  }
                                })
                                .catch(() => setReferralCodeStatus({ loading: false, valid: false, name: '' }));
                            }
                          }}
                          disabled={authInProgress === 'google'}
                          startIcon={<FaGift className={`w-4 h-4 transition-colors duration-300 ${referralCodeStatus.valid === true ? 'text-green-500' : 'text-amber-500'}`} />}
                          endAdornment={
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              {referralCodeStatus.loading ? (
                                <UrbanSetuSpinner size="sm" />
                              ) : referralCodeStatus.valid === true ? (
                                <FaCheckCircle className="text-green-500 w-4 h-4" />
                              ) : referralCodeStatus.valid === false ? (
                                <FaTimes className="text-red-500 w-4 h-4" />
                              ) : null}
                            </div>
                          }
                          inputClassName={`transition-all duration-300 tracking-[0.2em] font-mono uppercase pr-10 hover:border-blue-400 ${referralCodeStatus.valid === true ? 'border-green-500 bg-green-50/10' : referralCodeStatus.valid === false ? 'border-red-500 bg-red-50/10' : 'focus:ring-blue-500/20'} ${authInProgress === 'google' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        />
                      </div>

                      {referralCodeStatus.valid === true && (
                        <p className="mt-2 ml-1 text-[11px] text-green-600 dark:text-green-400 font-medium animate-fadeIn">
                          ✨ Referral Applied: You'll receive <span className="font-bold">50 SetuCoins</span> on signup!
                        </p>
                      )}
                    </div>

                    <div className="flex items-start mb-2">
                      <input
                        type="checkbox"
                        id="consent"
                        checked={consent}
                        onChange={e => setConsent(e.target.checked)}
                        disabled={authInProgress === 'google'}
                        className={`mt-1 mr-2 ${authInProgress === 'google' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        required
                      />
                      <label htmlFor="consent" className="text-sm text-gray-700 dark:text-gray-300 select-none">
                        I agree to the <Link to="/terms" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" onClick={e => { e.preventDefault(); window.open('/terms', '_blank', 'noopener,noreferrer'); }}>Terms of Use</Link> and <Link to="/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" onClick={e => { e.preventDefault(); window.open('/privacy', '_blank', 'noopener,noreferrer'); }}>Privacy Policy</Link>.
                      </label>
                    </div>

                    {/* reCAPTCHA Widget - show if not verified or briefly after verify */}
                    {(!recaptchaToken || recaptchaJustVerified) && (
                      <div className="flex justify-center mb-4">
                        <RecaptchaWidget
                          key={recaptchaKey}
                          ref={recaptchaRef}
                          onVerify={handleRecaptchaVerify}
                          onExpire={handleRecaptchaExpire}
                          onError={handleRecaptchaError}
                          disabled={loading}
                          className="transform scale-90"
                        />
                      </div>
                    )}

                    {/* reCAPTCHA Error */}
                    {recaptchaError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                        <p className="text-red-600 text-sm">{recaptchaError}</p>
                      </div>
                    )}

                    <PrimaryButton
                      variant="green"
                      loading={loading}
                      loadingText="Creating Account..."
                      disabled={
                        loading ||
                        !meetsMinimumRequirements(formData.password) ||
                        !emailVerified ||
                        !recaptchaToken ||
                        authInProgress === 'google'
                      }
                      className="w-full py-3 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
                    >
                      Create Account
                    </PrimaryButton>

                    {success && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3 animate-fade-in mt-4">
                        <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p className="text-green-700 text-sm font-semibold">{success}</p>
                      </div>
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
                      pageType="signUp"
                      disabled={authInProgress !== null}
                      onAuthStart={setAuthInProgress}
                      onAuthSuccess={(data) => {
                        // Capture redirect URL BEFORE showing loader (ref avoids closure issues)
                        const googleSearchParams = new URLSearchParams(location.search);
                        pendingRedirectRef.current = googleSearchParams.get('redirect');
                        setPendingLoginData(data);
                        setShowLoader(true);
                      }}
                    />

                    {error && (
                      <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
                        <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p className="text-red-700 text-sm font-medium">{error}</p>
                      </div>
                    )}
                  </form>

                  <div className="mt-8 text-center">
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                      Already have an account?{" "}
                      <Link
                        to="/sign-in"
                        className={`text-blue-600 hover:text-blue-700 font-bold hover:underline transition-colors duration-200 ${(authInProgress !== null || loading || otpLoading || verifyLoading)
                          ? 'opacity-50 cursor-not-allowed pointer-events-none'
                          : ''
                          }`}
                      >
                        Sign In
                      </Link>
                    </p>
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                      Trouble creating an account?{" "}
                      <Link
                        to="/help-center"
                        className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
                      >
                        Visit our Help Center
                      </Link>
                    </p>
                  </div>

                  <SecureBadge />
                  <ThirdPartyCookieBanner />
                </div>
              </div>
            )}
          </div>
          <ContactSupportWrapper />
        </>
      </AuthFormLayout>
    </>
  );
}