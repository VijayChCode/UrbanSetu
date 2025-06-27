import React from "react";
import { Link } from "react-router-dom";
import { FaExclamationTriangle } from "react-icons/fa";
import { useSelector } from "react-redux";
import duckImg from "../assets/duck-404.png";

export default function NotFound() {
  const { currentUser } = useSelector((state) => state.user);
  let homePath = "/";
  if (currentUser) {
    if (currentUser.role === "admin" || currentUser.role === "rootadmin") {
      homePath = "/admin";
    } else {
      homePath = "/user";
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-purple-100 p-8">
      <div className="bg-white rounded-xl shadow-lg p-10 flex flex-col items-center">
        <img src={duckImg} alt="Lost duck" className="w-40 h-40 object-contain mb-4 animate-float" />
        {/* <FaExclamationTriangle className="text-6xl text-yellow-500 mb-4 animate-bounce" /> */}
        <h1 className="text-4xl font-extrabold text-blue-700 mb-2">404</h1>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Page Not Found</h2>
        <p className="text-gray-600 mb-6 text-center max-w-md">
          Sorry, the page you are looking for does not exist or has been moved.
        </p>
        <Link
          to={homePath}
          className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all font-semibold"
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
} 