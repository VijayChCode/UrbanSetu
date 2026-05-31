import React, { useState, useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash, FaCheck, FaEdit } from "react-icons/fa";
import { signoutUserStart, signoutUserSuccess, signoutUserFailure } from "../redux/user/userSlice";
import { reconnectSocket } from "../utils/socket";
import { toast } from 'react-toastify';
import { calculatePasswordStrength, getPasswordStrengthColor, getPasswordStrengthBgColor, getPasswordStrengthText, meetsMinimumRequirements } from "../utils/passwordStrength.js";
import { authenticatedFetch } from '../utils/csrf';
import ContactSupportWrapper from '../components/ContactSupportWrapper';
import ConfirmationModal from '../components/ConfirmationModal';
import { useSignout } from '../hooks/useSignout';

import { usePageTitle } from '../hooks/usePageTitle';
import { Lock } from "lucide-react";
import FormField from "../components/ui/FormField";
import PrimaryButton from "../components/ui/PrimaryButton";
import AuthFormLayout from "../components/ui/AuthFormLayout";
export default function AdminChangePassword() {
  // Set page title
  usePageTitle("Change Password - Security Settings");

  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentPasswordRef = useRef(null);
  const { signout } = useSignout();

  const [formData, setFormData] = useState({
    previousPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [showPrev, setShowPrev] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [showSignoutModal, setShowSignoutModal] = useState(false);

  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    level: 'very-weak',
    feedback: []
  });


  const checkPasswordStrength = (password) => {
    const strength = calculatePasswordStrength(password);
    setPasswordStrength(strength);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (name === "newPassword") {
      checkPasswordStrength(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (formData.newPassword !== formData.confirmNewPassword) {
      setError("New passwords do not match");
      return;
    }

    if (!meetsMinimumRequirements(formData.newPassword)) {
      setError("Password does not meet minimum strength requirements");
      return;
    }

    // Check if new password is different from current password
    if (formData.previousPassword === formData.newPassword) {
      setError("New password must be different from current password");
      return;
    }

    setLoading(true);
    try {
      const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/user/change-password/${currentUser._id}`, {
        method: "POST",
        body: JSON.stringify({
          previousPassword: formData.previousPassword,
          newPassword: formData.newPassword,
        }),
      });
      const data = await res.json();
      setLoading(false);
      if (res.status === 401) {
        setError("Session expired or unauthorized. Please sign in again.");
        // Proper logout process
        dispatch(signoutUserStart());
        try {
          const signoutRes = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/signout`);
          const signoutData = await signoutRes.json();
          if (signoutData.success === false) {
            dispatch(signoutUserFailure(signoutData.message));
          } else {
            dispatch(signoutUserSuccess(signoutData));
            // Clear persisted state
            if (window.persistor && window.persistor.purge) {
              await window.persistor.purge();
            }
            // Disconnect and reconnect socket to clear auth
            reconnectSocket();
            // Clear localStorage token if used
            localStorage.removeItem('accessToken');
            // Expire the access_token cookie on client side
            document.cookie = 'access_token=; Max-Age=0; path=/; domain=' + window.location.hostname + '; secure; samesite=None';
          }
        } catch (err) {
          dispatch(signoutUserFailure(err.message));
        }
        toast.error("Session expired or unauthorized. Please sign in again.");
        setTimeout(() => {
          navigate("/sign-in", { replace: true });
        }, 1500);
        return;
      }
      if (!res.ok || data.success === false) {
        setError(data.message || "Failed to change password");
      } else {
        setSuccess("Password changed successfully");
        setTimeout(() => {
          navigate("/admin");
        }, 1200);
      }
    } catch (err) {
      setLoading(false);
      setError("An error occurred. Please try again.");
    }
  };

  const handleForgotPasswordClick = () => {
    setShowSignoutModal(true);
  };

  const handleSignoutConfirm = async () => {
    setShowSignoutModal(false);
    await signout({
      showToast: true,
      navigateTo: "/forgot-password",
      delay: 0
    });
  };

  return (
    <AuthFormLayout
      leftSlot={(
        <>
          {/* Left Side - Image and Quote */}
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
          <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-purple-700 relative overflow-hidden">
            <div className="absolute inset-0 bg-black opacity-20"></div>
            <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
              <div className="text-center max-w-md">
                <h1 className="text-4xl font-bold mb-6 animate-fade-in">
                  Change Password
                </h1>
                <p className="text-xl mb-8 leading-relaxed animate-fade-in-delay">
                  "Security is not a product, but a process. Keep your account safe with a strong password."
                </p>
                <div className="space-y-4 text-lg animate-fade-in-delay-2">
                  <div className="flex items-center justify-center space-x-3">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span>Secure & Strong</span>
                  </div>
                  <div className="flex items-center justify-center space-x-3">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                    <span>Easy to Remember</span>
                  </div>
                  <div className="flex items-center justify-center space-x-3">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                    <span>Keep Your Account Safe</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Elements */}
            <div className="absolute top-20 left-20 w-16 h-16 bg-white bg-opacity-10 rounded-full animate-float"></div>
            <div className="absolute bottom-32 right-16 w-12 h-12 bg-white bg-opacity-10 rounded-full animate-float" style={{ animationDelay: '2s' }}></div>
            <div className="absolute top-1/2 right-24 w-8 h-8 bg-white bg-opacity-10 rounded-full animate-float" style={{ animationDelay: '1s' }}></div>

            {/* Shield Icon */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black bg-opacity-20 flex items-center justify-center">
              <svg className="w-16 h-16 text-white opacity-30" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </>
      )}
    >

      {/* Right Side - Change Password Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors duration-200">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2 flex items-center justify-center gap-2">
              <Lock className="w-7 h-7 text-blue-600 dark:text-blue-500" />
              Change Password
            </h2>
            <p className="text-gray-600 dark:text-gray-300">Keep your account secure by updating your password regularly.</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 relative overflow-hidden transition-colors duration-200">
            {/* Decorative background element for card */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/10 rounded-full -mr-16 -mt-16 opacity-50 pointer-events-none transition-colors duration-200"></div>

            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
              {/* Current Password Field */}
              <div>
                <label htmlFor="previousPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Password
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-300 mb-2">(Enter your existing password)</p>
                <FormField
                  label={undefined}
                  id="previousPassword"
                  name="previousPassword"
                  type={showPrev ? 'text' : 'password'}
                  value={formData.previousPassword}
                  onChange={handleChange}
                  ref={currentPasswordRef}
                  disabled={loading}
                  placeholder="Enter your current password"
                  startIcon={<Lock className="w-5 h-5 dark:text-gray-400" />}
                  endAdornment={
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none z-20"
                      tabIndex={-1}
                      onClick={() => setShowPrev(!showPrev)}
                    >
                      {showPrev ? (
                        <FaEyeSlash className="text-gray-400 dark:text-gray-500" />
                      ) : (
                        <FaEye className="text-gray-400 dark:text-gray-500" />
                      )}
                    </button>
                  }
                  inputClassName={`transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 ${loading ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : 'bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600'} hover:border-blue-500`}
                  required
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleForgotPasswordClick}
                    disabled={loading}
                    className={`text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium hover:underline transition-colors duration-200 ${loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                      }`}
                  >
                    Forgot Current Password?
                  </button>
                </div>
              </div>

              {/* New Password Field */}
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Password
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-300 mb-2">(Create a strong new password)</p>
                <FormField
                  label={undefined}
                  id="newPassword"
                  name="newPassword"
                  type={showNew ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Create a strong password"
                  startIcon={<Lock className="w-5 h-5 dark:text-gray-400" />}
                  endAdornment={
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none z-20"
                      tabIndex={-1}
                      onClick={() => setShowNew(!showNew)}
                    >
                      {showNew ? (
                        <FaEyeSlash className="text-gray-400 dark:text-gray-500" />
                      ) : (
                        <FaEye className="text-gray-400 dark:text-gray-500" />
                      )}
                    </button>
                  }
                  inputClassName={`transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 ${loading ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : 'bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600'} hover:border-blue-500`}
                  required
                />
              </div>

              {/* Enhanced Password Strength */}
              {formData.newPassword && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Password Strength:</span>
                    <span className={`text-sm font-semibold ${getPasswordStrengthColor(passwordStrength.level)}`}>
                      {getPasswordStrengthText(passwordStrength.level)}
                    </span>
                  </div>

                  {/* Strength Bar */}
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
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
                      <p className="text-sm font-medium mb-1">To improve your password:</p>
                      <ul className="text-xs space-y-1 opacity-90">
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
                  <div className="text-xs text-gray-500 dark:text-gray-300 space-y-1">
                    <p>💡 <strong>Tip:</strong> Use a unique password for this account</p>
                    <p>🔒 <strong>Security:</strong> Consider using a password manager</p>
                  </div>
                </div>
              )}

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirm New Password
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-300 mb-2">(Re-enter your new password)</p>
                <FormField
                  label={undefined}
                  id="confirmNewPassword"
                  name="confirmNewPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={formData.confirmNewPassword}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Confirm your new password"
                  startIcon={<Lock className="w-5 h-5 dark:text-gray-400" />}
                  endAdornment={
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none z-20"
                      tabIndex={-1}
                      onClick={() => setShowConfirm(!showConfirm)}
                    >
                      {showConfirm ? (
                        <FaEyeSlash className="text-gray-400 dark:text-gray-500" />
                      ) : (
                        <FaEye className="text-gray-400 dark:text-gray-500" />
                      )}
                    </button>
                  }
                  inputClassName={`transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 ${loading ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : 'bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600'} hover:border-blue-500`}
                  required
                />
              </div>

              <PrimaryButton
                type="submit"
                variant="blue"
                loading={loading}
                loadingText="Updating..."
                disabled={
                  loading ||
                  !meetsMinimumRequirements(formData.newPassword) ||
                  formData.previousPassword === formData.newPassword
                }
              >
                Update Password
              </PrimaryButton>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-600 dark:text-red-300 text-sm">{error}</p>
                </div>
              )}

              {success && (
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-blue-600 dark:text-blue-300 text-sm">{success}</p>
                </div>
              )}
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600 dark:text-gray-300">
                Changed your mind?{" "}
                <button
                  onClick={() => navigate("/admin/profile")}
                  disabled={loading}
                  className={`text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold hover:underline transition-colors duration-200 ${loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                    }`}
                >
                  Back to Profile
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
      <ContactSupportWrapper />

      {/* Signout Confirmation Modal */}
      <ConfirmationModal
        isOpen={showSignoutModal}
        onClose={() => setShowSignoutModal(false)}
        onConfirm={handleSignoutConfirm}
        title="Sign Out Required"
        message="To reset your password, you must be signed out. Do you want to sign out now?"
        confirmText="Sign Out"
        cancelText="Cancel"
        confirmButtonColor="bg-blue-600 hover:bg-blue-700"
        isDestructive={false}
        isLoading={false}
      />
    </AuthFormLayout>
  );
}
