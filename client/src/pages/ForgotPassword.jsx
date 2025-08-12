import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaEye, FaEyeSlash, FaCheck } from "react-icons/fa";
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import { useSelector } from "react-redux";
import NotFound from "./NotFound";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ForgotPassword({ bootstrapped, sessionChecked }) {
  const [step, setStep] = useState(1); // 1: verification, 2: reset password
  const [formData, setFormData] = useState({
    email: "",
    mobileNumber: "",
    newPassword: "",
    confirmPassword: "",
    userId: ""
  });

  const [passwordValidity, setPasswordValidity] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    specialChar: false,
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
  
  // Timer states for resend OTP
  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(true);

  // Check URL parameters on component mount
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const urlStep = searchParams.get('step');
    if (urlStep === '2') {
      setStep(2);
    }
  }, [location.search]);

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
    const validity = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      specialChar: /[^A-Za-z0-9]/.test(password),
    };
    setPasswordValidity(validity);
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData({
      ...formData,
      [id]: value,
    });

    // Reset OTP states when email or mobile changes
    if (id === "email" || id === "mobileNumber") {
      setOtpSent(false);
      setOtp("");
      setOtpError("");
      setEmailVerified(false);
      setResendTimer(0);
      setCanResend(true);
    }

    if (id === "newPassword") {
      checkPasswordStrength(value);
    }
  };

  // Send OTP for forgot password
  const handleSendOTP = async () => {
    if (!formData.email || !formData.mobileNumber) {
      setOtpError("Please enter both email and mobile number first");
      return;
    }

    if (!canResend) {
      return;
    }

    setOtpLoading(true);
    setOtpError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/send-forgot-password-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          email: formData.email,
          mobileNumber: formData.mobileNumber 
        }),
      });

      const data = await res.json();

      if (data.success) {
        setOtpSent(true);
        setSuccess("OTP sent successfully to your email");
        setTimeout(() => setSuccess(""), 3000);
        
        // Start timer for resend
        setResendTimer(120); // 2 minutes = 120 seconds
        setCanResend(false);
      } else {
        setOtpError(data.message);
      }
    } catch (error) {
      setOtpError("Failed to send OTP. Please try again.");
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
      const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          mobileNumber: formData.mobileNumber,
        }),
      });

      const data = await res.json();

      if (data.success === false) {
        setError(data.message);
        setLoading(false);
      } else {
        setStep(2);
        navigate('/forgot-password?step=2', { replace: true });
        setLoading(false);
      }
    } catch (error) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: formData.userId,
          newPassword: formData.newPassword,
          confirmPassword: formData.confirmPassword,
        }),
      });

      const data = await res.json();

      if (data.success === false) {
        setError(data.message);
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
      <div className="min-h-screen flex">
        
        {/* Left Side - Image and Quote */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-orange-600 to-red-700 relative overflow-hidden">
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
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
                  <span>Quick & Easy Process</span>
                </div>
                <div className="flex items-center justify-center space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
                  <span>Back to Your Account</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Floating Elements */}
          <div className="absolute top-20 left-20 w-16 h-16 bg-white bg-opacity-10 rounded-full animate-float"></div>
          <div className="absolute bottom-32 right-16 w-12 h-12 bg-white bg-opacity-10 rounded-full animate-float" style={{animationDelay: '2s'}}></div>
          <div className="absolute top-1/2 right-24 w-8 h-8 bg-white bg-opacity-10 rounded-full animate-float" style={{animationDelay: '1s'}}></div>
          
          {/* Lock Icon */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black bg-opacity-20 flex items-center justify-center">
            <svg className="w-16 h-16 text-white opacity-30" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* Right Side - Verification Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Forgot Password</h2>
              <p className="text-gray-600">Enter your registered email and mobile number to reset your password.</p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <form onSubmit={handleVerification} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Registered Email
                    {emailVerified && (
                      <span className="ml-2 text-green-600">
                        <FaCheck className="inline" />
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="Enter your email"
                      id="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 pr-24 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 ${
                        emailVerified ? "border-green-500" : "border-gray-300"
                      }`}
                      required
                    />
                    {!emailVerified && (
                      <button
                        type="button"
                        onClick={handleSendOTP}
                        disabled={otpLoading || !formData.email || !formData.mobileNumber || !canResend}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {otpLoading ? "Sending..." : "Send OTP"}
                      </button>
                    )}
                    {emailVerified && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600">
                        <FaCheck className="text-xl" />
                      </div>
                    )}
                  </div>
                  {otpSent && !emailVerified && (
                    <p className="text-sm text-gray-600 mt-2">
                      OTP sent to {formData.email}
                    </p>
                  )}
                  {otpError && (
                    <p className="text-red-500 text-sm mt-2">{otpError}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 mb-2">
                    Registered Mobile Number
                  </label>
                  <input
                    type="tel"
                    placeholder="Enter 10-digit mobile number"
                    id="mobileNumber"
                    value={formData.mobileNumber}
                    onChange={handleChange}
                    pattern="[0-9]{10}"
                    maxLength="10"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                </div>

                {/* OTP Verification Field */}
                {otpSent && !emailVerified && (
                  <div>
                    <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                      Enter OTP
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter 6-digit OTP"
                        id="otp"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        maxLength="6"
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOTP}
                        disabled={verifyLoading || !otp}
                        className="px-4 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      >
                        {verifyLoading ? "Verifying..." : "Verify OTP"}
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500">
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
                            disabled={otpLoading}
                            className="text-xs text-orange-600 hover:text-orange-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {otpLoading ? "Sending..." : "Resend OTP"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  disabled={loading || !emailVerified}
                  className="w-full py-3 px-4 bg-gradient-to-r from-orange-600 to-red-600 text-white font-semibold rounded-lg hover:from-orange-700 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Verifying...
                    </div>
                  ) : (
                    "Verify Account"
                  )}
                </button>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}
              </form>

              <div className="mt-6 text-center">
                <p className="text-gray-600">
                  Remember your password?{" "}
                  <Link to="/sign-in" className="text-orange-600 hover:text-orange-800 font-semibold hover:underline transition-colors duration-200">
                    Sign In
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
        <ContactSupportWrapper />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      
      {/* Left Side - Image and Quote */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-600 to-teal-700 relative overflow-hidden">
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
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
                <span>Easy to Remember</span>
              </div>
              <div className="flex items-center justify-center space-x-3">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
                <span>Ready to Use</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Floating Elements */}
        <div className="absolute top-20 left-20 w-16 h-16 bg-white bg-opacity-10 rounded-full animate-float"></div>
        <div className="absolute bottom-32 right-16 w-12 h-12 bg-white bg-opacity-10 rounded-full animate-float" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-1/2 right-24 w-8 h-8 bg-white bg-opacity-10 rounded-full animate-float" style={{animationDelay: '1s'}}></div>
        
        {/* Shield Icon */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black bg-opacity-20 flex items-center justify-center">
          <svg className="w-16 h-16 text-white opacity-30" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* Right Side - Reset Password Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Reset Password</h2>
            <p className="text-gray-600">Create a new strong password for your account.</p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <form onSubmit={handleResetPassword} className="space-y-6">
              {/* New Password Field */}
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    id="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                  <div
                    className="absolute inset-y-0 right-3 flex items-center cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <FaEyeSlash className="text-gray-600" />
                    ) : (
                      <FaEye className="text-gray-600" />
                    )}
                  </div>
                </div>
              </div>

              {/* Password Strength */}
              <div className="space-y-2 text-sm">
                <p className="font-medium text-gray-700 mb-2">Password Requirements:</p>
                <div className="grid grid-cols-1 gap-1">
                  <p className={`flex items-center ${
                    passwordValidity.length ? "text-green-600" : "text-red-500"
                  }`}>
                    {passwordValidity.length ? "✔️" : "❌"} Minimum 8 characters
                  </p>
                  <p className={`flex items-center ${
                    passwordValidity.uppercase ? "text-green-600" : "text-red-500"
                  }`}>
                    {passwordValidity.uppercase ? "✔️" : "❌"} At least one uppercase letter
                  </p>
                  <p className={`flex items-center ${
                    passwordValidity.lowercase ? "text-green-600" : "text-red-500"
                  }`}>
                    {passwordValidity.lowercase ? "✔️" : "❌"} At least one lowercase letter
                  </p>
                  <p className={`flex items-center ${
                    passwordValidity.number ? "text-green-600" : "text-red-500"
                  }`}>
                    {passwordValidity.number ? "✔️" : "❌"} At least one number
                  </p>
                  <p className={`flex items-center ${
                    passwordValidity.specialChar ? "text-green-600" : "text-red-500"
                  }`}>
                    {passwordValidity.specialChar ? "✔️" : "❌"} At least one special character
                  </p>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showCPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    id="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                  <div
                    className="absolute inset-y-0 right-3 flex items-center cursor-pointer"
                    onClick={() => setShowCPassword(!showCPassword)}
                  >
                    {showCPassword ? (
                      <FaEyeSlash className="text-gray-600" />
                    ) : (
                      <FaEye className="text-gray-600" />
                    )}
                  </div>
                </div>
              </div>

              <button
                disabled={
                  loading ||
                  Object.values(passwordValidity).includes(false)
                }
                className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-teal-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Resetting...
                  </div>
                ) : (
                  "Reset Password"
                )}
              </button>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-600 text-sm">{success}</p>
                </div>
              )}
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Remember your password?{" "}
                <Link to="/sign-in" className="text-green-600 hover:text-green-800 font-semibold hover:underline transition-colors duration-200">
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
