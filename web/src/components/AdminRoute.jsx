import React from 'react';
import UrbanSetuSpinner from './UrbanSetuSpinner';
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import NotFound from '../pages/NotFound';

export default function AdminRoute({ bootstrapped }) {
  const { currentUser, loading } = useSelector((state) => state.user);
  const location = useLocation();

  // Show loading state while Redux persist is bootstrapping or initial authentication is being processed
  if (!bootstrapped || (loading && !currentUser)) {
    return <div className="flex items-center justify-center min-h-screen">
      <UrbanSetuSpinner size="md" isBright={false} />
    </div>;
  }

  // Check if user exists and is admin
  if (currentUser && (currentUser.role === "admin" || currentUser.role === "rootadmin")) {
    // Allow default admin to access regardless of approval status
    if (currentUser.isDefaultAdmin) {
      return <Outlet />;
    }

    // For other admins, check approval status
    if (currentUser.adminApprovalStatus === "approved") {
      return <Outlet />;
    }
  }

  // If not logged in, redirect to login with callback
  if (!currentUser) {
    const redirectUrl = location.pathname + location.search;
    return <Navigate to={`/sign-in?redirect=${encodeURIComponent(redirectUrl)}`} replace />;
  }

  // If logged in but not admin (or not approved), show 404
  return <NotFound />;
}
