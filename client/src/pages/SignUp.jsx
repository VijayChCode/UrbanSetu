import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import Oauth from "../components/Oauth";
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import { useSelector } from "react-redux";

export default function SignUp() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "",   // 🔥 added role field here
    mobileNumber: "",
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
  const [fieldErrors, setFieldErrors] = useState({
    email: "",
    mobileNumber: ""
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();
  const { currentUser } = useSelector((state) => state.user);
  const [consent, setConsent] = useState(false);

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

    // Clear field-specific errors when user starts typing
    if (id === "email" || id === "mobileNumber") {
      setFieldErrors(prev => ({
        ...prev,
        [id]: ""
      }));
    }

    if (id === "password") {
      checkPasswordStrength(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!consent) {
      setError("You must agree to the Terms of Use and Privacy Policy.");
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
      const apiUrl = "/api/auth/signup";
      const options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
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
    if (currentUser) {
      if (currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/user', { replace: true });
      }
    }
  }, [currentUser, navigate]);

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
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Create Account</h2>
            <p className="text-gray-600">Join thousands of users finding their perfect homes</p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <form onSubmit={handleSubmit} className="space-y-6">
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
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  id="email"
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                    fieldErrors.email ? "border-red-500" : "border-gray-300"
                  }`}
                  required
                />
                {fieldErrors.email && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.email}</p>
                )}
              </div>

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
                  I agree to the <Link to="/terms" className="text-blue-600 hover:underline" target="_blank">Terms of Use</Link> and <Link to="/privacy" className="text-blue-600 hover:underline" target="_blank">Privacy Policy</Link>.
                </label>
              </div>

              <button
                disabled={
                  loading ||
                  Object.values(passwordValidity).includes(false)
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
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
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
