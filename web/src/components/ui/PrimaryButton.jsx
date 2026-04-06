import React from "react";
import UrbanSetuSpinner from '../UrbanSetuSpinner';

const variants = {
  blue: "from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700",
  green: "from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700",
  orange: "from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700",
  teal: "from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700",
};

export default function PrimaryButton({
  children,
  loading = false,
  loadingText = "",
  disabled = false,
  variant = "blue",
  className = "",
  type = "submit",
  onClick = null,
  ...rest
}) {
  const gradient = variants[variant] || variants.blue;
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading ? true : undefined}
      onClick={onClick}
      className={`w-full py-3 px-4 bg-gradient-to-r ${gradient} text-white font-semibold rounded-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black/5 ${className}`}
      {...rest}
    >
      {loading ? (
        <div className="flex items-center justify-center">
          <UrbanSetuSpinner size="sm" isBright={true} className="mr-2" />
          {loadingText || children}
        </div>
      ) : (
        children
      )}
    </button>
  );
}
