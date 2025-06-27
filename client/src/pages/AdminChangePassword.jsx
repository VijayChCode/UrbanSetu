import React, { useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";

export default function AdminChangePassword() {
  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();

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
  const [passwordValidity, setPasswordValidity] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    specialChar: false,
  });

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
    if (Object.values(passwordValidity).includes(false)) {
      setError("Password does not meet strength requirements");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/user/change-password/${currentUser._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previousPassword: formData.previousPassword,
          newPassword: formData.newPassword,
        }),
      });
      const data = await res.json();
      setLoading(false);
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">Change Password</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPrev ? "text" : "password"}
              placeholder="Current Password"
              name="previousPassword"
              value={formData.previousPassword}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
            <div
              className="absolute inset-y-0 right-3 flex items-center cursor-pointer"
              onClick={() => setShowPrev((v) => !v)}
            >
              {showPrev ? (
                <FaEyeSlash className="text-gray-600" />
              ) : (
                <FaEye className="text-gray-600" />
              )}
            </div>
          </div>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              placeholder="New Password"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
            <div
              className="absolute inset-y-0 right-3 flex items-center cursor-pointer"
              onClick={() => setShowNew((v) => !v)}
            >
              {showNew ? (
                <FaEyeSlash className="text-gray-600" />
              ) : (
                <FaEye className="text-gray-600" />
              )}
            </div>
          </div>
          {/* Password Strength Meter */}
          <div className="space-y-1 text-sm mt-2">
            <p className={`flex items-center ${passwordValidity.length ? "text-green-600" : "text-red-500"}`}>
              {passwordValidity.length ? "\u2714\ufe0f" : "\u274c"} Minimum 8 characters
            </p>
            <p className={`flex items-center ${passwordValidity.uppercase ? "text-green-600" : "text-red-500"}`}>
              {passwordValidity.uppercase ? "\u2714\ufe0f" : "\u274c"} At least one uppercase letter
            </p>
            <p className={`flex items-center ${passwordValidity.lowercase ? "text-green-600" : "text-red-500"}`}>
              {passwordValidity.lowercase ? "\u2714\ufe0f" : "\u274c"} At least one lowercase letter
            </p>
            <p className={`flex items-center ${passwordValidity.number ? "text-green-600" : "text-red-500"}`}>
              {passwordValidity.number ? "\u2714\ufe0f" : "\u274c"} At least one number
            </p>
            <p className={`flex items-center ${passwordValidity.specialChar ? "text-green-600" : "text-red-500"}`}>
              {passwordValidity.specialChar ? "\u2714\ufe0f" : "\u274c"} At least one special character
            </p>
          </div>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm New Password"
              name="confirmNewPassword"
              value={formData.confirmNewPassword}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
            <div
              className="absolute inset-y-0 right-3 flex items-center cursor-pointer"
              onClick={() => setShowConfirm((v) => !v)}
            >
              {showConfirm ? (
                <FaEyeSlash className="text-gray-600" />
              ) : (
                <FaEye className="text-gray-600" />
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || Object.values(passwordValidity).includes(false)}
            className="w-full p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Changing..." : "Change Password"}
          </button>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          {success && <p className="text-green-500 text-sm text-center">{success}</p>}
        </form>
      </div>
    </div>
  );
} 