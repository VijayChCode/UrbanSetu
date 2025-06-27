import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import NotFound from '../pages/NotFound';

export default function AdminRoute({ bootstrapped }) {
  const { currentUser, loading } = useSelector((state) => state.user);

  // Show loading state while Redux persist is bootstrapping or authentication is being processed
  if (!bootstrapped || loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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

  // If user or not logged in, show 404
  return <NotFound />;
}
