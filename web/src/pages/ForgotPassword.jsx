import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaEye, FaEyeSlash, FaCheck, FaEdit } from "react-icons/fa";
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import RecaptchaWidget from "../components/RecaptchaWidget";
import { useSelector } from "react-redux";
import NotFound from "./NotFound";
import { focusWithoutKeyboard, isMobileDevice } from '../utils/mobileUtils';
import { calculatePasswordStrength, getPasswordStrengthColor, getPasswordStrengthBgColor, getPasswordStrengthText, meetsMinimumRequirements } from "../utils/passwordStrength.js";
import { authenticatedFetch, getCSRFToken } from '../utils/csrf';
import { HelpCircle, RotateCcw, Lock, Mail } from "lucide-react";
import { usePageTitle } from '../hooks/usePageTitle';
import PrimaryButton from "../components/ui/PrimaryButton";
import AuthFormLayout from "../components/ui/AuthFormLayout";
import FormField from "../components/ui/FormField";
import StepIndicator from "../components/ui/StepIndicator";
import SecureBadge from "../components/ui/SecureBadge";
import SEO from "../components/SEO";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ForgotPassword({ bootstrapped, sessionChecked }) {
  // Set page title
  usePageTitle("Reset Password - Forgot Password");

  const emailInputRef = useRef(null);
  const otpInputRef = useRef(null);
  const [step, setStep] = useState(1); // 1: verification, 2: reset password
  const [formData, setFormData] = useState({
    email: "",
    newPassword: "",
    confirmPassword: "",
    userId: ""
  });

  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    level: 'very-weak',
    feedback: []
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showCPassword, setShowCPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useSelector((state) => state.user);

  // OTP states
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailEditMode, setEmailEditMode] = useState(false);
  const [emailLocked, setEmailLocked] = useState(false);

  // Timer states for resend OTP
  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(true);

  // reCAPTCHA states
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [recaptchaError, setRecaptchaError] = useState("");
  const [showRecaptcha, setShowRecaptcha] = useState(false);
  const [recaptchaKey, setRecaptchaKey] = useState(0);
  const [recaptchaJustVerified, setRecaptchaJustVerified] = useState(false);
  const recaptchaRef = useRef(null);

  // Failed attempts tracking
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [otpCaptchaRequired, setOtpCaptchaRequired] = useState(false);
  const [otpCaptchaMessage, setOtpCaptchaMessage] = useState("");

  // Check URL parameters on component mount
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const urlStep = searchParams.get('step');
    if (urlStep === '2') {
      setStep(2);
      // Reset reCAPTCHA state when entering reset password step
      setRecaptchaToken(null);
      setRecaptchaError("");
      setShowRecaptcha(false);
      setFailedAttempts(0);
      setIsLocked(false);
    }
    const emailFromQuery = searchParams.get('email');
    if (emailFromQuery && !formData.email) {
      setFormData(prev => ({ ...prev, email: emailFromQuery }));
    }
  }, [location.search]);

  // Autofocus email field on initial page (step 1) (desktop only)
  useEffect(() => {
    if (!isMobileDevice() && step === 1 && emailInputRef.current) {
      focusWithoutKeyboard(emailInputRef.current);
    }
  }, [step]);

  // Autofocus OTP field when it appears (desktop only)
  useEffect(() => {
    if (!isMobileDevice() && otpSent && !emailVerified && otpInputRef.current) {
      focusWithoutKeyboard(otpInputRef.current);
    }
  }, [otpSent, emailVerified]);

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

  // Handle browser back button and page refresh
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const searchParams = new URLSearchParams(location.search);
      const urlStep = searchParams.get('step');

      if (urlStep === '2') {
        // Set a flag in sessionStorage to indicate user left the reset process
        sessionStorage.setItem('resetPasswordInterrupted', 'true');
      }
    };

    const handlePopState = (e) => {
      const searchParams = new URLSearchParams(location.search);
      const urlStep = searchParams.get('step');
      // If user navigated back and is still on step 2 without proper verification
      // Do nothing, NotFound will be rendered by main logic
    };

    // Check if user was interrupted from a previous session
    const wasInterrupted = sessionStorage.getItem('resetPasswordInterrupted');
    if (wasInterrupted === 'true') {
      sessionStorage.removeItem('resetPasswordInterrupted');
      const searchParams = new URLSearchParams(location.search);
      const urlStep = searchParams.get('step');
      // Do nothing, NotFound will be rendered by main logic
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [location.search, formData.userId, navigate]);

  // Handle component unmounting when on step 2
  useEffect(() => {
    return () => {
      const searchParams = new URLSearchParams(location.search);
      const urlStep = searchParams.get('step');

      // If component is unmounting while on step 2, set the interrupted flag
      if (urlStep === '2') {
        sessionStorage.setItem('resetPasswordInterrupted', 'true');
      }
    };
  }, [location.search]);

  // Block access if already signed in
  useEffect(() => {
    if (bootstrapped && sessionChecked && currentUser) {
      if (currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/user', { replace: true });
      }
    }
  }, [bootstrapped, sessionChecked, currentUser, navigate]);

  const checkPasswordStrength = (password) => {
    const strength = calculatePasswordStrength(password);
    setPasswordStrength(strength);
  };


  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData({
      ...formData,
      [id]: value,
    });

    // Reset OTP states only when email changes
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

    if (id === "newPassword") {
      checkPasswordStrength(value);
    }
  };

  // Send OTP for forgot password
  const handleSendOTP = async () => {
    if (!formData.email) {
      setOtpError("Please enter an email address first");
      return;
    }

    if (!canResend) {
      return;
    }

    setOtpLoading(true);
    // Only lock email if request ultimately succeeds
    // setEmailLocked(true);
    setOtpError("");

    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/send-forgot-password-otp`, {
        method: "POST",
        body: JSON.stringify({
          email: formData.email,
          ...(recaptchaToken ? { recaptchaToken } : {})
        }),
      });

      // Handle suspended account (403) early and stop flow
      if (res.status === 403) {
        let friendlyMessage = "This account is temporarily suspended. Please reach out to support for help.";
        try {
          const errData = await res.clone().json();
          if (errData && errData.message && errData.message.toLowerCase().includes('suspended')) {
            friendlyMessage = "This account is temporarily suspended. Please reach out to support for help.";
          }
        } catch (_) { }
        setOtpError(friendlyMessage);
        setOtpLoading(false);
        return;
      }

      const data = await res.json();

      if (data.success) {
        setOtpSent(true);
        setEmailLocked(true);
        setSuccess("OTP sent successfully to your email");
        setTimeout(() => setSuccess(""), 3000);

        // Start timer for resend
        setResendTimer(30); // 30 seconds
        setCanResend(false);
        setOtpCaptchaRequired(false);
        setOtpCaptchaMessage("");
      } else {
        // When captcha required and OTP field not open, prefer showing dedicated captcha message below email, not otpError
        const lowerMsg = (data.message || '').toLowerCase();
        const requiresCaptcha = data.requiresCaptcha || lowerMsg.includes('recaptcha');
        const isLocked = lowerMsg.includes('too many requests') || lowerMsg.includes('try again in 15 minutes');
        if (isLocked) {
          setOtpCaptchaRequired(false);
          setOtpCaptchaMessage("");
          setOtpError("Too many requests. Please try again in 15 minutes.");
        } else if (requiresCaptcha) {
          setOtpCaptchaRequired(true);
          if (!otpSent) {
            setOtpCaptchaMessage("reCAPTCHA verification is required due to multiple failed attempts or requests");
            setOtpError("");
          } else {
            setOtpError(data.message || "reCAPTCHA verification is required due to multiple failed attempts or requests");
          }
        } else {
          setOtpError(data.message);
        }
        // Ensure email remains editable on failure
        setEmailLocked(false);
      }
    } catch (error) {
      setOtpError("Failed to send OTP. Please try again.");
      setEmailLocked(false);
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify OTP for forgot password
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

      if (data.success && data.type === 'forgotPassword') {
        setEmailVerified(true);
        setFormData(prev => ({
          ...prev,
          userId: data.userId
        }));
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

  const handleVerification = async (e) => {
    e.preventDefault();

    if (!emailVerified) {
      setError("Please verify your email with OTP before proceeding.");
      return;
    }

    if (!recaptchaToken) {
      setError("Please complete the reCAPTCHA verification.");
      return;
    }

    // If email is verified, proceed directly to step 2
    setStep(2);
    navigate('/forgot-password?step=2', { replace: true });
  };

  // reCAPTCHA handlers
  const handleRecaptchaVerify = (token) => {
    console.log('reCAPTCHA verified:', token);
    setRecaptchaToken(token);
    setRecaptchaError("");
    setRecaptchaJustVerified(true);
    setTimeout(() => setRecaptchaJustVerified(false), 1000);
    setTimeout(() => setShowRecaptcha(false), 1000);
    // If OTP-specific captcha was required (either under email or OTP), hide that widget + message after 1s
    if (otpCaptchaRequired) {
      setTimeout(() => {
        // Hide UI and clear flag so widget disappears
        setOtpCaptchaRequired(false);
        setOtpCaptchaMessage("");
        setOtpError("");
      }, 1000);
    }
  };

  const handleRecaptchaExpire = () => {
    setRecaptchaToken(null);
    setRecaptchaError("reCAPTCHA expired. Please verify again.");
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

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setRecaptchaError("");

    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const requestBody = {
        userId: formData.userId,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword,
        ...(showRecaptcha && recaptchaToken && { recaptchaToken })
      };

      console.log('Reset password request:', {
        hasRecaptchaToken: !!recaptchaToken,
        showRecaptcha,
        failedAttempts
      });

      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (data.success === false) {
        console.log('Reset password failed:', data.message);
        // Handle reCAPTCHA requirements
        if (data.message.includes("reCAPTCHA verification is required")) {
          console.log('Showing reCAPTCHA widget');
          setRecaptchaError(data.message);
          setShowRecaptcha(true);
          setRecaptchaKey((k) => k + 1);
          setFailedAttempts(3); // Set to 3 to show reCAPTCHA
        } else if (data.message.includes("Multiple failed reset attempts")) {
          console.log('Account locked');
          setIsLocked(true);
          setError(data.message);
          setShowRecaptcha(false);
        } else if (data.message.includes("reCAPTCHA verification failed")) {
          console.log('reCAPTCHA verification failed');
          setRecaptchaError(data.message);
          setShowRecaptcha(true);
          setRecaptchaKey((k) => k + 1);
        } else {
          // Regular error - track failed attempt
          console.log('Regular error, tracking attempt');
          setFailedAttempts(prev => prev + 1);
          setError(data.message);
        }
        setLoading(false);
      } else {
        setSuccess("Password reset successful. You can now log in.");
        setTimeout(() => {
          navigate("/sign-in");
        }, 2000);
        setLoading(false);
      }
    } catch (error) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  // If user is on step 2 but doesn't have a reset token, show 404
  const searchParams = new URLSearchParams(location.search);
  const urlStep = searchParams.get('step');
  if (urlStep === '2' && !formData.userId) { // Changed condition to check userId
    return <NotFound />;
  }

  if (step === 1) {
    return (
      <AuthFormLayout
        leftSlot={(
          <>
            <SEO title="Reset Password - UrbanSetu" noindex={true} nofollow={true} />
            <style>
              {`
                @keyframes blob {
                  0% { transform: translate(0px, 0px) scale(1); }
                  33% { transform: translate(30px, -50px) scale(1.1); }
                  66% { transform: translate(-20px, 20px) scale(0.9); }
                  100% { transform: translate(0px, 0px) scale(1); }
                }
                @keyframes float {
                  0% { transform: translateY(0px); }
                  50% { transform: translateY(-20px); }
                  100% { transform: translateY(0px); }
                }
                @keyframes fadeIn {
                  from { opacity: 0; transform: translateY(20px); }
                  to { opacity: 1; transform: translateY(0); }
                }
                .animate-blob { animation: blob 7s infinite; }
                .animate-float { animation: float 6s ease-in-out infinite; }
                .animate-fade-in { animation: fadeIn 0.6s ease-out forwards; }
                .delay-100 { animation-delay: 100ms; }
                .delay-200 { animation-delay: 200ms; }
              `}
            </style>
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-orange-600 to-red-700 dark:from-orange-950 dark:to-red-950 relative overflow-hidden transition-colors duration-300">
              <div className="absolute inset-0 bg-black opacity-20"></div>
              <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
                <div className="text-center max-w-md">
                  <h1 className="text-4xl font-bold mb-6 animate-fade-in">
                    Reset Your Password
                  </h1>
                  <p className="text-xl mb-8 leading-relaxed animate-fade-in-delay">
                    "Don't worry, we've got you covered. Let's get you back to finding your dream home."
                  </p>
                  <div className="space-y-4 text-lg animate-fade-in-delay-2">
                    <div className="flex items-center justify-center space-x-3">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span>Secure Password Reset</span>
                    </div>
                    <div className="flex items-center justify-center space-x-3">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                      <span>Quick & Easy Process</span>
                    </div>
                    <div className="flex items-center justify-center space-x-3">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                      <span>Back to Your Account</span>
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

        {/* Right Side - Verification Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors duration-300">
          <div className="w-full max-w-[440px] animate-fade-in">
            <div className="text-center mb-10">
              <StepIndicator steps={["Verify Email", "Reset Password"]} current={0} className="mb-8" />
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 mb-6 shadow-sm transition-colors">
                <HelpCircle className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight transition-colors">
                Forgot Password
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-lg transition-colors">Enter your registered email to reset your password.</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 relative overflow-hidden transition-colors">
              {/* Decorative background element for card */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 dark:bg-red-900/10 rounded-full -mr-16 -mt-16 opacity-50 pointer-events-none"></div>

              <form onSubmit={handleVerification} className="space-y-5 relative z-10">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1 transition-colors">
                    Registered Email
                    {emailVerified && (
                      <span className="ml-2 text-green-600 dark:text-green-400">
                        <FaCheck className="inline" />
                      </span>
                    )}
                  </label>
                  <FormField
                    label={undefined}
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    ref={emailInputRef}
                    value={formData.email}
                    onChange={handleChange}
                    readOnly={((emailLocked || emailVerified || otpSent) && !emailEditMode) || otpLoading}
                    disabled={otpLoading}
                    startIcon={<Mail className="w-5 h-5 text-gray-400" />}
                    endAdornment={
                      !emailVerified && !otpSent ? (
                        <button
                          type="button"
                          onClick={handleSendOTP}
                          disabled={otpLoading || !formData.email || !canResend}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-red-600 dark:bg-red-700 text-white rounded-md text-sm font-medium hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed z-10 transition-colors"
                        >
                          {otpLoading ? "Sending..." : "Send OTP"}
                        </button>
                      ) : (
                        (!emailEditMode && !otpLoading) && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 z-20 bg-gray-100 dark:bg-gray-800 pl-1 rounded-l-sm transition-colors">
                            <button
                              type="button"
                              onClick={() => {
                                setEmailEditMode(true);
                                setOtpSent(false);
                                setEmailLocked(false);
                                setOtp("");
                                setCanResend(true);
                                setResendTimer(0);
                                setEmailVerified(false);
                              }}
                              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                              title="Edit email"
                              aria-label="Edit email"
                            >
                              <FaEdit className="text-sm" />
                            </button>
                            <div className="text-green-600 dark:text-green-400 transition-colors">
                              <FaCheck className="text-xl" />
                            </div>
                          </div>
                        )
                      )
                    }
                    inputClassName={`transition-all duration-200 focus:ring-2 focus:ring-red-500/20 ${(emailVerified && !emailEditMode) || otpLoading || (otpSent && !emailEditMode) ? 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200 cursor-not-allowed border-green-500 pr-24' : (emailVerified ? 'border-green-500 dark:bg-gray-700 dark:text-white' : 'border-gray-300 dark:border-gray-700 dark:bg-gray-700 dark:text-white')} hover:border-red-500`}
                    required
                  />
                  {/* If captcha required before OTP field is open, show below email (outside input wrapper to avoid layout shift on button) */}
                  {otpCaptchaRequired && !otpSent && (
                    <div className="mt-3">
                      <div className="flex justify-center">
                        <RecaptchaWidget
                          key={`otp-email-${recaptchaKey}`}
                          ref={recaptchaRef}
                          onVerify={handleRecaptchaVerify}
                          onExpire={handleRecaptchaExpire}
                          onError={handleRecaptchaError}
                          disabled={otpLoading}
                          className="transform scale-90"
                        />
                      </div>
                      {otpCaptchaMessage && (
                        <p className="text-red-500 dark:text-red-400 text-sm mt-2 text-center transition-colors">{otpCaptchaMessage}</p>
                      )}
                    </div>
                  )}
                  {otpSent && !emailVerified && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 transition-colors">
                      OTP sent to {formData.email}
                    </p>
                  )}
                  {/* OTP Error Message - Show below email field when OTP field is not open */}
                  {otpError && !otpSent && (
                    <p className="text-red-500 dark:text-red-400 text-sm mt-2 transition-colors">{otpError}</p>
                  )}
                </div>

                {/* OTP Verification Field - Moved here to appear right after email */}
                {otpSent && !emailVerified && (
                  <div>
                    <label htmlFor="otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1 transition-colors">
                      Enter OTP
                    </label>
                    <div className="flex flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Enter 6-digit OTP"
                        id="otp"
                        ref={otpInputRef}
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
                        className={`flex-1 px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all duration-200 text-sm sm:text-base ${verifyLoading ? 'bg-gray-100 dark:bg-gray-900 cursor-not-allowed' : ''
                          }`}
                        maxLength="6"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOTP}
                        disabled={verifyLoading || otp.length !== 6}
                        className="px-3 py-2 sm:px-4 sm:py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm sm:text-base whitespace-nowrap shadow-sm"
                      >
                        {verifyLoading ? "Verifying..." : "Verify"}
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-300 transition-colors">
                        Enter the 6-digit code sent to your email
                      </p>
                      <div className="flex items-center gap-2">
                        {resendTimer > 0 ? (
                          <span className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
                            Resend in <span className="text-gray-600 dark:text-gray-300">{Math.floor(resendTimer / 60)}:{(resendTimer % 60).toString().padStart(2, '0')}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSendOTP}
                            disabled={otpLoading || verifyLoading}
                            className="text-xs text-red-600 dark:text-red-400 hover:text-red-850 dark:hover:text-red-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {otpLoading ? "Sending..." : "Resend OTP"}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* OTP Error Message and conditional reCAPTCHA below OTP field */}
                    {otpError && (
                      <p className="text-red-500 dark:text-red-400 text-sm mt-2 transition-colors">{otpError}</p>
                    )}
                    {otpCaptchaRequired && (
                      <div className="flex justify-center mt-3">
                        <RecaptchaWidget
                          key={`otp-forgot-${recaptchaKey}`}
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
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4 transition-colors">
                    <p className="text-red-600 dark:text-red-400 text-sm transition-colors">{recaptchaError}</p>
                  </div>
                )}

                <PrimaryButton
                  variant="orange"
                  loading={loading}
                  loadingText="Verifying..."
                  disabled={loading || !emailVerified || !recaptchaToken}
                  className="w-full py-3 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  Continue to Reset Password
                </PrimaryButton>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 transition-colors">
                    <p className="text-red-600 dark:text-red-400 text-sm transition-colors">{error}</p>
                  </div>
                )}
              </form>

              <div className="mt-6 text-center transition-colors">
                <p className="text-gray-600 dark:text-gray-300">
                  Remember your password?{" "}
                  <Link
                    to="/sign-in"
                    className={`text-orange-600 dark:text-orange-400 hover:text-orange-850 dark:hover:text-orange-300 font-semibold hover:underline transition-colors duration-200 ${verifyLoading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                      }`}
                  >
                    Sign In
                  </Link>
                </p>
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-300">
                  Trouble verifying email?{" "}
                  <Link
                    to="/help-center"
                    className="text-orange-600 dark:text-orange-400 hover:text-orange-850 dark:hover:text-orange-300 font-medium hover:underline transition-colors"
                  >
                    Visit our Help Center
                  </Link>
                </p>
              </div>

              <SecureBadge />
            </div>
          </div>
        </div>
        <ContactSupportWrapper />
      </AuthFormLayout>
    );
  }

  return (
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
                  0% { transform: translateY(0px); }
                  50% { transform: translateY(-20px); }
                  100% { transform: translateY(0px); }
                }
                @keyframes fadeIn {
                  from { opacity: 0; transform: translateY(20px); }
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
          <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-600 to-teal-700 dark:from-green-950 dark:to-teal-950 relative overflow-hidden transition-colors duration-300">
            <div className="absolute inset-0 bg-black opacity-20"></div>
            <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
              <div className="text-center max-w-md">
                <h1 className="text-4xl font-bold mb-6 animate-fade-in">
                  Create New Password
                </h1>
                <p className="text-xl mb-8 leading-relaxed animate-fade-in-delay">
                  "A strong password is your first line of defense. Make it count!"
                </p>
                <div className="space-y-4 text-lg animate-fade-in-delay-2">
                  <div className="flex items-center justify-center space-x-3">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span>Strong & Secure</span>
                  </div>
                  <div className="flex items-center justify-center space-x-3">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                    <span>Easy to Remember</span>
                  </div>
                  <div className="flex items-center justify-center space-x-3">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                    <span>Ready to Use</span>
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

      {/* Right Side - Reset Password Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors duration-300">
        <div className="w-full max-w-[440px] animate-fade-in">
          <div className="text-center mb-10">
            <StepIndicator steps={["Verify Email", "Reset Password"]} current={1} className="mb-8" />
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 mb-6 shadow-sm transition-colors">
              <RotateCcw className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight transition-colors">
              Reset Password
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg transition-colors">Create a new strong password to secure your account.</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 relative overflow-hidden transition-colors">
            {/* Decorative background element for card */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 dark:bg-green-900/10 rounded-full -mr-16 -mt-16 opacity-50 pointer-events-none"></div>

            <form onSubmit={handleResetPassword} className="space-y-5 relative z-10">
              {/* Email Field - Disabled with Edit Option */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                  Email Address
                </label>
                <FormField
                  label={undefined}
                  id="email"
                  type="email"
                  value={formData.email}
                  readOnly
                  disabled
                  startIcon={<Mail className="w-5 h-5" />}
                  inputClassName="bg-gray-100 dark:bg-gray-900 cursor-not-allowed text-gray-600 dark:text-gray-400 pr-20"
                  endAdornment={
                    <button
                      type="button"
                      onClick={() => {
                        setStep(1);
                        navigate('/forgot-password?step=1', { replace: true });
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600 dark:text-green-400 bg-gray-100 dark:bg-gray-850 hover:text-green-700 dark:hover:text-green-300 p-1 rounded hover:bg-green-50 dark:hover:bg-green-950/30 transition-all z-20"
                      title="Edit email address"
                      aria-label="Edit email address"
                    >
                      <FaEdit className="text-sm" />
                    </button>
                  }
                />
                <p className="text-xs text-gray-500 dark:text-gray-300 mt-1 transition-colors">
                  Click the edit icon to change your email address
                </p>
              </div>

              {/* New Password Field */}
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                  New Password
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 transition-colors">(Enter your new strong password)</p>
                <FormField
                  label={undefined}
                  id="newPassword"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Create a strong password"
                  startIcon={<Lock className="w-5 h-5" />}
                  endAdornment={
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none z-20"
                      tabIndex={-1}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <FaEyeSlash className="text-gray-400 dark:text-gray-500" />
                      ) : (
                        <FaEye className="text-gray-400 dark:text-gray-500" />
                      )}
                    </button>
                  }
                  inputClassName={`${loading ? 'bg-gray-100 dark:bg-gray-900 cursor-not-allowed' : 'bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600'} pr-12 focus:ring-green-500 focus:border-green-500 hover:border-green-500 transition-colors`}
                  required
                />
              </div>

              {/* Enhanced Password Strength */}
              {formData.newPassword && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors">Password Strength:</span>
                    <span className={`text-sm font-semibold transition-colors ${getPasswordStrengthColor(passwordStrength.level)}`}>
                      {getPasswordStrengthText(passwordStrength.level)}
                    </span>
                  </div>

                  {/* Strength Bar */}
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 transition-colors">
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
                    <div className={`p-3 rounded-lg transition-colors ${getPasswordStrengthBgColor(passwordStrength.level)} dark:bg-gray-800/50 dark:border dark:border-gray-700`}>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To improve your password:</p>
                      <ul className="text-xs space-y-1">
                        {passwordStrength.feedback.map((item, index) => (
                          <li key={index} className="flex items-center text-gray-600 dark:text-gray-400">
                            <span className="mr-2">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Security Tips */}
                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 transition-colors">
                    <p>💡 <strong>Tip:</strong> Use a unique password for this account</p>
                    <p>🔒 <strong>Security:</strong> Consider using a password manager</p>
                  </div>
                </div>
              )}

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1 transition-colors">
                  Confirm New Password
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-300 mb-2 ml-1 transition-colors">(Re-enter your new password)</p>
                <FormField
                  label={undefined}
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showCPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Confirm your password"
                  startIcon={<Lock className="w-5 h-5 text-gray-400" />}
                  endAdornment={
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none z-20"
                      tabIndex={-1}
                      onClick={() => setShowCPassword(!showCPassword)}
                    >
                      {showCPassword ? (
                        <FaEyeSlash className="text-gray-400 dark:text-gray-500" />
                      ) : (
                        <FaEye className="text-gray-400 dark:text-gray-500" />
                      )}
                    </button>
                  }
                  inputClassName={`${loading ? 'bg-gray-100 dark:bg-gray-900 cursor-not-allowed' : 'bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600'} pr-12 transition-all duration-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 hover:border-green-500`}
                  required
                />
              </div>

              {/* reCAPTCHA Widget - Show only when required */}
              {showRecaptcha && (
                <div className="flex justify-center">
                  <RecaptchaWidget
                    key={recaptchaKey}
                    ref={recaptchaRef}
                    onVerify={handleRecaptchaVerify}
                    onExpire={handleRecaptchaExpire}
                    onError={handleRecaptchaError}
                    className="mb-4"
                  />
                </div>
              )}

              {/* reCAPTCHA Error */}
              {recaptchaError && (
                <div className="mb-4">
                  <p className="text-red-600 dark:text-red-400 text-sm text-center transition-colors">{recaptchaError}</p>
                </div>
              )}

              {/* Locked message for too many attempts */}
              {isLocked && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg transition-colors">
                  <p className="text-red-600 dark:text-red-400 text-sm text-center font-medium transition-colors">
                    Multiple failed reset attempts. Please try again later.
                  </p>
                </div>
              )}

              <PrimaryButton
                variant="teal"
                loading={loading}
                loadingText="Resetting..."
                disabled={
                  loading ||
                  !meetsMinimumRequirements(formData.newPassword) ||
                  (showRecaptcha && !recaptchaToken) ||
                  isLocked
                }
                className="w-full py-3 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
              >
                Reset Password
              </PrimaryButton>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3 animate-fade-in transition-colors">
                  <div className="text-red-600 dark:text-red-400 mt-0.5">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <p className="text-red-800 dark:text-red-400 text-sm font-medium transition-colors">{error}</p>
                </div>
              )}

              {success && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3 animate-fade-in transition-colors">
                  <div className="text-green-600 dark:text-green-400 mt-0.5">
                    <FaCheck className="text-lg" />
                  </div>
                  <p className="text-green-800 dark:text-green-400 text-sm font-medium transition-colors">{success}</p>
                </div>
              )}
            </form>

            <div className="mt-8 text-center transition-colors">
              <p className="text-gray-500 dark:text-gray-300 font-medium">
                Remembered your password?{" "}
                <Link
                  to="/sign-in"
                  className={`font-bold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:underline transition-colors ${(verifyLoading || loading) ? 'opacity-50 pointer-events-none' : ''
                    }`}
                >
                  Back to Sign In
                </Link>
              </p>
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-300">
                Trouble resetting password?{" "}
                <Link
                  to="/help-center"
                  className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium hover:underline transition-colors"
                >
                  Visit our Help Center
                </Link>
              </p>
            </div>

            <SecureBadge />
          </div>
        </div>
      </div>
    </AuthFormLayout>
  );
} 