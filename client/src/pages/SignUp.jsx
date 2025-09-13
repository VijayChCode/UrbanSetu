import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash, FaCheck, FaTimes, FaEdit } from "react-icons/fa";
import Oauth from "../components/Oauth";
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import { useSelector } from "react-redux";
import { calculatePasswordStrength, getPasswordStrengthColor, getPasswordStrengthBgColor, getPasswordStrengthText, meetsMinimumRequirements } from "../utils/passwordStrength.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function SignUp({ bootstrapped, sessionChecked }) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "",   // 🔥 added role field here
    mobileNumber: "",
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
  const { currentUser } = useSelector((state) => state.user);
  const [consent, setConsent] = useState(false);

  // Email verification states
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [emailEditMode, setEmailEditMode] = useState(false);
  
  // Timer states for resend OTP
  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(true);

  const checkPasswordStrength = (password) => {
    const strength = calculatePasswordStrength(password);
    setPasswordStrength(strength);
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
      const res = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: formData.email }),
      });

      const data = await res.json();

      if (data.success) {
        setOtpSent(true);
        setSuccess("OTP sent successfully to your email");
        setTimeout(() => setSuccess(""), 3000);
        
        // Start timer for resend
        setResendTimer(30); // 30 seconds
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

  // Verify OTP
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

    setLoading(true);
    setError("");
    setSuccess("");
    setFieldErrors({ email: "", mobileNumber: "" });

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
      const options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          emailVerified: true
        }),
      };
      const res = await fetch(apiUrl, options);
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
        } else {
          setError(data.message);
        }
        setLoading(false);
      } else {
        setError("");
        setLoading(false);
        if (formData.role === 'admin' || formData.role === 'rootadmin') {
          setSuccess("Admin account created successfully. Please wait for an existing admin to approve your request.");
        } else {
          setSuccess("Account created successfully, please sign in!");
        }
        setTimeout(() => {
          setSuccess("");
          navigate("/sign-in");
        }, 2000);
        return;
      }
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bootstrapped && sessionChecked && currentUser) {
      if (currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/user', { replace: true });
      }
    }
  }, [bootstrapped, sessionChecked, currentUser, navigate]);

  return (
    <div className="min-h-screen flex">
      
      {/* Left Side - Image and Quote */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-600 to-blue-700 relative overflow-hidden">
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
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
                <span>List Your Properties</span>
              </div>
              <div className="flex items-center justify-center space-x-3">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
                <span>Connect with Buyers & Sellers</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Floating Elements */}
        <div className="absolute top-20 left-20 w-16 h-16 bg-white bg-opacity-10 rounded-full animate-float"></div>
        <div className="absolute bottom-32 right-16 w-12 h-12 bg-white bg-opacity-10 rounded-full animate-float" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-1/2 right-24 w-8 h-8 bg-white bg-opacity-10 rounded-full animate-float" style={{animationDelay: '1s'}}></div>
        
        {/* House Silhouette */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black bg-opacity-20">
          <svg className="w-full h-full" viewBox="0 0 100 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 2L2 8V18H18V8L10 2Z" fill="white" fillOpacity="0.1"/>
            <path d="M8 12H12V18H8V12Z" fill="white" fillOpacity="0.2"/>
            <circle cx="10" cy="5" r="1" fill="white" fillOpacity="0.3"/>
            <path d="M15 6L18 8V18H22V8L15 6Z" fill="white" fillOpacity="0.1"/>
            <path d="M17 12H20V18H17V12Z" fill="white" fillOpacity="0.2"/>
          </svg>
        </div>
      </div>

      {/* Right Side - Sign Up Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Create Account</h2>
            <p className="text-gray-600 text-sm sm:text-base">Join thousands of users finding their perfect homes</p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-8 border border-gray-100">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  id="username"
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
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
                    readOnly={emailVerified && !emailEditMode}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      emailVerified && !emailEditMode
                        ? "bg-gray-100 cursor-not-allowed border-green-500"
                        : fieldErrors.email ? "border-red-500" : emailVerified ? "border-green-500" : "border-gray-300"
                    }`}
                    required
                  />
                  {fieldErrors.email && (
                    <p className="text-red-500 text-sm mt-1">{fieldErrors.email}</p>
                  )}
                  {!emailVerified && !otpSent && !emailEditMode && (
                    <button
                      type="button"
                      onClick={handleSendOTP}
                      disabled={otpLoading || !canResend || !formData.email}
                      className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {otpLoading ? "Sending..." : "Send OTP"}
                    </button>
                  )}
                  {emailVerified && !emailEditMode && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEmailEditMode(true)}
                        className="text-blue-600 hover:text-blue-800 transition-colors duration-200 p-1 rounded hover:bg-blue-50"
                        title="Edit email"
                      >
                        <FaEdit className="text-sm" />
                      </button>
                      <div className="text-green-600">
                        <FaCheck className="text-xl" />
                      </div>
                    </div>
                  )}
                  {emailVerified && emailEditMode && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="text-green-600">
                        <FaCheck className="text-xl" />
                      </div>
                    </div>
                  )}
                </div>
                {otpSent && !emailVerified && (
                  <p className="text-sm text-gray-600 mt-2">
                    OTP sent to {formData.email}
                  </p>
                )}
                {/* OTP Error Message - Show below email field when OTP field is not open */}
                {otpError && !otpSent && (
                  <p className="text-red-500 text-sm mt-2">{otpError}</p>
                )}
              </div>

              {/* OTP Verification Field */}
              {otpSent && !emailVerified && (
                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                    Enter OTP
                  </label>
                  <div className="flex flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      id="otp"
                      value={otp}
                      onChange={(e) => {
                        // Only allow numbers
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setOtp(value);
                      }}
                      maxLength="6"
                      className="flex-1 px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOTP}
                      disabled={verifyLoading || !otp}
                      className="px-3 py-2 sm:px-4 sm:py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm sm:text-base whitespace-nowrap"
                    >
                      {verifyLoading ? "Verifying..." : "Verify"}
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
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {otpLoading ? "Sending..." : "Resend OTP"}
                        </button>
                      )}
                    </div>
                  </div>
                  {/* OTP Error Message - Moved here to appear below the instruction text */}
                  {otpError && (
                    <p className="text-red-500 text-sm mt-2">{otpError}</p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 mb-2">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  placeholder="Enter 10-digit mobile number"
                  id="mobileNumber"
                  onChange={handleChange}
                  pattern="[0-9]{10}"
                  maxLength="10"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                    fieldErrors.mobileNumber ? "border-red-500" : "border-gray-300"
                  }`}
                  required
                />
                {fieldErrors.mobileNumber && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.mobileNumber}</p>
                )}
              </div>



              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  I want to
                </label>
                <select
                  id="role"
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  required
                >
                  <option value="">Select your role</option>
                  <option value="user">Buy/Sell Properties</option>
                  <option value="admin">Manage Platform (Admin)</option>
                </select>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    id="password"
                    onChange={handleChange}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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

              {/* Enhanced Password Strength */}
              {formData.password && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Password Strength:</span>
                    <span className={`text-sm font-semibold ${getPasswordStrengthColor(passwordStrength.level)}`}>
                      {getPasswordStrengthText(passwordStrength.level)}
                    </span>
                  </div>
                  
                  {/* Strength Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        passwordStrength.level === 'very-weak' ? 'bg-red-500 w-1/5' :
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
                      <p className="text-sm font-medium text-gray-700 mb-1">To improve your password:</p>
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
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showCPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    id="confirmPassword"
                    onChange={handleChange}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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

              <div className="flex items-start mb-2">
                <input
                  type="checkbox"
                  id="consent"
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                  className="mt-1 mr-2"
                  required
                />
                <label htmlFor="consent" className="text-sm text-gray-700 select-none">
                  I agree to the <Link to="/terms" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" onClick={e => { e.preventDefault(); window.open('/terms', '_blank', 'noopener,noreferrer'); }}>Terms of Use</Link> and <Link to="/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" onClick={e => { e.preventDefault(); window.open('/privacy', '_blank', 'noopener,noreferrer'); }}>Privacy Policy</Link>.
                </label>
              </div>

              <button
                disabled={
                  loading ||
                  !meetsMinimumRequirements(formData.password) ||
                  !emailVerified
                }
                className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Creating Account...
                  </div>
                ) : (
                  "Create Account"
                )}
              </button>

              {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                  <p className="text-green-700 text-sm font-semibold">{success}</p>
                </div>
              )}

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">OR</span>
                </div>
              </div>

              <Oauth pageType="signUp" />

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Already have an account?{" "}
                <Link to="/sign-in" className="text-blue-600 hover:text-blue-800 font-semibold hover:underline transition-colors duration-200">
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
