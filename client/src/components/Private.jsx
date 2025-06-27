import { useSelector } from 'react-redux';
import { Outlet, Navigate } from 'react-router-dom';
import NotFound from '../pages/NotFound';

export default function PrivateRoute({ bootstrapped }) {
  const { currentUser, loading } = useSelector((state) => state.user);
  // Debug log
  // console.log('PrivateRoute debug:', { bootstrapped, loading, currentUser });
  
  // Show loading state while Redux persist is bootstrapping or authentication is being processed
  if (!bootstrapped || loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>;
  }

  // Only allow users with role 'user'
  if (currentUser && currentUser.role === 'user') {
    return <Outlet />;
  }

  // If admin or not logged in, show 404
  return <NotFound />;
}