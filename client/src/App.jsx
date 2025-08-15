import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";
import { useEffect, Suspense, lazy, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { verifyAuthStart, verifyAuthSuccess, verifyAuthFailure, signoutUserSuccess } from "./redux/user/userSlice.js";
import { socket } from "./utils/socket";
import Header from './components/Header';
import AdminHeader from './components/AdminHeader';
import Private from "./components/Private";
import AdminRoute from "./components/AdminRoute";
import WishlistProvider from "./WishlistContext";
import ContactSupportWrapper from "./components/ContactSupportWrapper";
import NetworkStatus from "./components/NetworkStatus";
import UserChangePassword from './pages/UserChangePassword';
import AdminChangePassword from './pages/AdminChangePassword';
import NotFound from './pages/NotFound';
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import UserTerms from "./pages/UserTerms";
import AdminTerms from "./pages/AdminTerms";
import UserPrivacy from "./pages/UserPrivacy";
import AdminPrivacy from "./pages/AdminPrivacy";
import { FaHome } from "react-icons/fa";
import AdminManagement from './pages/AdminManagement';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { toast } from 'react-toastify';

// Lazy load all pages
const PublicHome = lazy(() => import('./pages/PublicHome'));
const Home = lazy(() => import('./pages/Home'));
const PublicAbout = lazy(() => import('./pages/PublicAbout'));
const About = lazy(() => import('./pages/About'));
const PublicSearch = lazy(() => import('./pages/PublicSearch'));
const Search = lazy(() => import('./pages/Search'));
const Profile = lazy(() => import('./pages/Profile'));
const SignIn = lazy(() => import("./pages/SignIn"));
const SignUp = lazy(() => import("./pages/SignUp"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const CreateListing = lazy(() => import("./pages/CreateListing"));
const EditListing = lazy(() => import('./pages/EditListing'));
const Listing = lazy(() => import("./pages/Listing"));
const WishList = lazy(() => import("./pages/WishList"));
const Appointment = lazy(() => import("./components/Appointment"));
const AdminAppointments = lazy(() => import("./pages/AdminAppointments"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const MyAppointments = lazy(() => import("./pages/MyAppointments"));
const MyListings = lazy(() => import("./pages/MyListings"));
const AdminAbout = lazy(() => import("./pages/AdminAbout"));
const AdminExplore = lazy(() => import("./pages/AdminExplore"));
const AdminCreateListing = lazy(() => import("./pages/AdminCreateListing"));
const AdminWishlist = lazy(() => import("./pages/AdminWishlist"));
const AdminProfile = lazy(() => import("./pages/AdminProfile"));
const AdminRequests = lazy(() => import("./pages/AdminRequests"));
const AdminListings = lazy(() => import("./pages/AdminListings"));
const AdminMyListings = lazy(() => import("./pages/AdminMyListings"));
const AdminEditListing = lazy(() => import("./pages/AdminEditListing"));
const Oauth = lazy(() => import("./components/Oauth"));
const AdminAppointmentListing = lazy(() => import("./pages/AdminAppointmentListing"));
const AdminReviews = lazy(() => import("./pages/AdminReviews"));
const UserReviews = lazy(() => import("./pages/UserReviews"));

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 animate-fade-in">
    <div className="relative flex flex-col items-center">
      <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 animate-spin-slow shadow-2xl border-8 border-white/40 flex items-center justify-center">
        <FaHome className="text-5xl text-yellow-400 drop-shadow-lg animate-bounce-slow" style={{ filter: 'drop-shadow(0 2px 8px #facc15)' }} />
      </div>
      <span className="mt-8 text-3xl font-extrabold bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 bg-clip-text text-transparent animate-gradient-x drop-shadow">Real <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">Estate</span></span>
      <span className="mt-2 text-xl font-bold text-purple-700 drop-shadow animate-fade-in-up">Loading...</span>
    </div>
    <style>{`
      @keyframes spin-slow { 100% { transform: rotate(360deg); } }
      .animate-spin-slow { animation: spin-slow 2s linear infinite; }
      @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
      .animate-fade-in { animation: fade-in 0.7s ease; }
      @keyframes fade-in-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
      .animate-fade-in-up { animation: fade-in-up 0.8s ease; }
      @keyframes gradient-x { 0%,100%{background-position:0 50%}50%{background-position:100% 50%} }
      .animate-gradient-x { background-size: 200% 200%; animation: gradient-x 3s ease-in-out infinite; }
      @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
      .animate-bounce-slow { animation: bounce-slow 2s infinite; }
    `}</style>
  </div>
);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Utility function to normalize route based on role
function normalizeRoute(path, role) {
  // Remove trailing slash for consistency
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

  // List of shared base routes (add more as needed)
  const sharedBases = ["about", "search", "terms", "privacy", "listing", "home", "reviews", "wishlist", "profile", "appointment", "explore"];

  // Helper to extract base and subpath
  function extractBaseAndRest(p) {
    const match = p.match(/^\/(user|admin)?\/?([^\/]+)?(\/.*)?$/);
    return {
      prefix: match && match[1] ? match[1] : null,
      base: match && match[2] ? match[2] : null,
      rest: match && match[3] ? match[3] : ""
    };
  }
  const { prefix, base, rest } = extractBaseAndRest(path);

  if (role === "public") {
    // If public tries to access /user/* or /admin/* shared, redirect to public
    if ((prefix === "user" || prefix === "admin") && sharedBases.includes(base)) {
      return `/${base}${rest}`;
    }
    // If public tries to access deep user/admin-only, show 404 (no redirect)
    if ((prefix === "user" && !sharedBases.includes(base)) || (prefix === "admin" && !sharedBases.includes(base))) {
      return null;
    }
    // Otherwise, stay on public
    return path;
  }
  if (role === "user") {
    // If user tries to access /about, /search, etc., redirect to /user/*
    if (!path.startsWith("/user") && sharedBases.includes(base)) {
      return `/user/${base}${rest}`;
    }
    // If user tries to access /admin/*, redirect to /user/* if shared, else 404
    if (prefix === "admin") {
      if (sharedBases.includes(base)) return `/user/${base}${rest}`;
      return null;
    }
    // If user tries to access /user/*, allow
    if (prefix === "user") return path;
    // Otherwise, stay
    return path;
  }
  if (role === "admin") {
    // If admin tries to access /about, /search, etc., redirect to /admin/*
    if (!path.startsWith("/admin") && sharedBases.includes(base)) {
      return `/admin/${base}${rest}`;
    }
    // If admin tries to access /user/*, redirect to /admin/* if shared, else 404
    if (prefix === "user") {
      if (sharedBases.includes(base)) return `/admin/${base}${rest}`;
      return null;
    }
    // If admin tries to access /admin/*, allow
    if (prefix === "admin") return path;
    // Otherwise, stay
    return path;
  }
  return path;
}

function NormalizeRoute({ children }) {
  const location = useLocation();
  const { currentUser } = useSelector((state) => state.user);
  const role = currentUser ? ((currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? 'admin' : 'user') : 'public';
  const normalized = useMemo(() => normalizeRoute(location.pathname, role), [location.pathname, role]);

  if (normalized === null) {
    // Show 404
    return <NotFound />;
  }
  if (normalized !== location.pathname) {
    // Redirect to normalized route
    return <Navigate to={normalized} replace />;
  }
  return children;
}

// Global fetch wrapper to handle suspension
function useSuspensionFetch() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  useEffect(() => {
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await origFetch(...args);
      if (response.status === 403) {
        try {
          const data = await response.clone().json();
          if (data.message && data.message.toLowerCase().includes("suspended")) {
            dispatch(signoutUserSuccess());
            toast.info(data.message || "Your account has been suspended. You have been signed out.");
            setTimeout(() => {
              navigate("/sign-in");
            }, 1800); // Delay navigation so toast is visible
            return response;
          }
        } catch (e) {}
      }
      return response;
    };
    return () => {
      window.fetch = origFetch;
    };
  }, [dispatch, navigate]);
}

function AppRoutes({ bootstrapped }) {
  const location = useLocation();
  const dispatch = useDispatch();
  const { currentUser, loading } = useSelector((state) => state.user);
  const [sessionChecked, setSessionChecked] = useState(false);
  const navigate = useNavigate(); // Fix: ensure navigate is defined

  // Persistent session check on app load
  useEffect(() => {
    const checkSession = async () => {
        dispatch(verifyAuthStart());
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/verify`, {
          method: 'GET',
          credentials: 'include',
        });
        const data = await res.json();
        if (res.ok) {
          dispatch(verifyAuthSuccess(data));
        } else {
          dispatch(verifyAuthFailure(data.message || 'Session invalid'));
          dispatch(signoutUserSuccess());
        }
      } catch (err) {
        dispatch(verifyAuthFailure('Network error'));
        dispatch(signoutUserSuccess());
      } finally {
        setSessionChecked(true);
      }
    };
    if (bootstrapped) {
      checkSession();
    }
  }, [bootstrapped, dispatch]);

  // Socket event listener for account suspension
  useEffect(() => {
    if (!currentUser) return; // Only run if user is logged in
    
    const handleAccountSuspended = (data) => {
      // Check if the suspended account is the current user
      if (data.userId === currentUser._id) {
        dispatch(signoutUserSuccess());
        toast.error("Your account has been suspended. You have been signed out.");
        setTimeout(() => {
          navigate("/sign-in");
        }, 1800); // Delay navigation so toast is visible
      }
    };

    socket.on('account_suspended', handleAccountSuspended);
    
    // Global socket event listener for force signout
    const handleForceSignout = (data) => {
      if (data.userId === currentUser._id) {
        dispatch(signoutUserSuccess());
        toast.error(data.message || "You have been signed out.");
        setTimeout(() => {
          navigate("/sign-in");
        }, 1800); // Delay navigation so toast is visible
      }
    };
    
    socket.on('force_signout', handleForceSignout);
    
    // Global socket event listeners for user and admin updates
    const handleUserUpdate = (data) => {
      if (data.userId === currentUser._id || data.user?._id === currentUser._id) {
        // Update current user data based on the update type
        if (data.type === 'update') {
          // Update user information
          dispatch(updateUserSuccess(data.user));
        } else if (data.type === 'delete') {
          // User was deleted, sign them out
          dispatch(signoutUserSuccess());
          toast.error("Your account has been deleted. You have been signed out.");
          setTimeout(() => {
            navigate("/sign-in");
          }, 1800);
        } else if (data.type === 'add') {
          // User was added (e.g., demoted from admin)
          dispatch(updateUserSuccess(data.user));
        }
      }
    };
    
    const handleAdminUpdate = (data) => {
      if (data.adminId === currentUser._id || data.admin?._id === currentUser._id) {
        // Update current user data based on the update type
        if (data.type === 'update') {
          // Update admin information
          dispatch(updateUserSuccess(data.admin));
        } else if (data.type === 'delete') {
          // Admin was deleted, sign them out
          dispatch(signoutUserSuccess());
          toast.error("Your admin account has been deleted. You have been signed out.");
          setTimeout(() => {
            navigate("/sign-in");
          }, 1800);
        } else if (data.type === 'add') {
          // Admin was added (e.g., promoted from user)
          dispatch(updateUserSuccess(data.admin));
        }
      }
    };
    
    socket.on('user_update', handleUserUpdate);
    socket.on('admin_update', handleAdminUpdate);
    
    return () => {
      socket.off('account_suspended', handleAccountSuspended);
      socket.off('force_signout', handleForceSignout);
      socket.off('user_update', handleUserUpdate);
      socket.off('admin_update', handleAdminUpdate);
    };
  }, [dispatch, navigate, currentUser]);

  // Socket event listener for new message notifications
  useEffect(() => {
    if (!currentUser) return; // Only run if user is logged in
    
    const handleNewMessage = async (data) => {
      // Since backend now only sends to intended recipients, we can trust this message is for us
      // Just check if it's not from the current user
      if (data.comment && data.comment.senderEmail !== currentUser.email) {
        // Check if we're not already on the MyAppointments page
        const currentPath = window.location.pathname;
        const isOnMyAppointments = currentPath.includes('/my-appointments') || currentPath.includes('/user/my-appointments');
        
        if (!isOnMyAppointments) {
          // Check if sender is admin by making API call to get user info
          let senderName = data.comment.senderEmail || 'User';
          
          try {
            const res = await fetch(`${API_BASE_URL}/api/auth/user/${encodeURIComponent(data.comment.senderEmail)}`, {
              credentials: 'include'
            });
            
            if (res.ok) {
              const userData = await res.json();
              // Check if sender is admin by checking their role
              if (userData.role === 'admin' || userData.role === 'rootadmin') {
                senderName = 'UrbanSetu';
              }
            }
          } catch (error) {
            // If API call fails, fallback to email
            console.error('Failed to fetch sender info:', error);
          }
          
          // Show notification for new message
          toast.info(`New message from ${senderName}`, {
            onClick: () => {
              // Navigate to MyAppointments page when notification is clicked
              navigate('/user/my-appointments');
            },
            autoClose: 5000,
            closeOnClick: true,
            pauseOnHover: true
          });
        }
      }
    };

    socket.on('commentUpdate', handleNewMessage);
    
    return () => {
      socket.off('commentUpdate', handleNewMessage);
    };
  }, [dispatch, navigate, currentUser]);

  // Periodic session check (every 30 seconds)
  useEffect(() => {
    if (!currentUser) return; // Only run if user is logged in
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/verify`, { credentials: 'include' });
        if (res.status === 401) {
          // Session expired - silently sign out user
          dispatch(signoutUserSuccess());
          navigate("/sign-in");
        } else if (res.status === 403) {
          try {
            const data = await res.clone().json();
            if (data.message && data.message.toLowerCase().includes("suspended")) {
              dispatch(signoutUserSuccess());
              toast.error(data.message || "Your account has been suspended. You have been signed out.");
              navigate("/sign-in");
            }
          } catch (e) {}
        }
      } catch (e) {
        // Network errors or other issues - ignore silently
      }
    }, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [dispatch, navigate, currentUser]);

  // Show loader while checking session
  if (!bootstrapped || !sessionChecked) {
    return <LoadingSpinner />;
  }

  // Do not show header on /appointments admin route
  const hideHeaderRoutes = ["/appointments"];

  return (
    <>
      <NetworkStatus />
      {!hideHeaderRoutes.includes(location.pathname) && (
        currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')
          ? <AdminHeader />
          : <Header />
      )}

      <Suspense fallback={<LoadingSpinner />}>
        <NormalizeRoute>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={currentUser ? <NotFound /> : <PublicHome bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
          <Route path="/home" element={currentUser ? <NotFound /> : <PublicHome bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
          <Route path="/about" element={currentUser ? <Navigate to="/user/about" /> : <PublicAbout bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
          <Route path="/search" element={currentUser ? <Navigate to="/user/search" /> : <PublicSearch bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
          <Route path="/listing/:listingId" element={currentUser ? <NotFound /> : <Listing />} />
          <Route path="/sign-in" element={<SignIn bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
          <Route path="/sign-up" element={<SignUp bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
          <Route path="/forgot-password" element={<ForgotPassword bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
          <Route path="/oauth" element={<Oauth bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
          <Route path="/terms" element={currentUser ? <NotFound /> : <Terms bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
          <Route path="/privacy" element={currentUser ? <NotFound /> : <Privacy bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />

          {/* User Routes (Protected) */}
          <Route element={<Private bootstrapped={bootstrapped} />}>
            <Route path="/user" element={<Home />} />
            <Route path="/user/home" element={<Home />} />
            <Route path="/user/about" element={<About />} />
            <Route path="/user/search" element={<Search />} />
            <Route path="/user/profile" element={<Profile />} />
            <Route path="/user/create-listing" element={<CreateListing />} />
            <Route path='/user/update-listing/:listingId' element={<EditListing />} />
            <Route path="/user/listing/:listingId" element={<Listing key={location.pathname} />} />
            <Route path="/user/wishlist" element={<WishList />} />
            <Route path="/user/appointment" element={<Appointment />} />
            <Route path="/user/my-appointments" element={<MyAppointments />} />
            <Route path="/user/my-listings" element={<MyListings />} />
            <Route path="/user/change-password" element={<UserChangePassword />} />
            <Route path="/user/terms" element={<UserTerms />} />
            <Route path="/user/privacy" element={<UserPrivacy />} />
            <Route path="/user/reviews" element={<UserReviews />} />
          </Route>

          {/* Admin Routes */}
          <Route element={<AdminRoute bootstrapped={bootstrapped} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/appointments" element={<AdminAppointments />} />
            <Route path="/admin/about" element={<AdminAbout />} />
            <Route path="/admin/explore" element={<AdminExplore />} />
            <Route path="/admin/create-listing" element={<AdminCreateListing />} />
            <Route path="/admin/listings" element={<AdminListings />} />
            <Route path="/admin/my-listings" element={<AdminMyListings />} />
            <Route path="/admin/update-listing/:listingId" element={<AdminEditListing />} />
            <Route path="/admin/wishlist" element={<AdminWishlist />} />
            <Route path="/admin/profile" element={<AdminProfile />} />
            <Route path="/admin/change-password" element={<AdminChangePassword />} />
            <Route path="/admin/requests" element={<AdminRequests />} />
            <Route path="/admin/listing/:listingId" element={<Listing key={location.pathname} />} />
            <Route path="/admin/appointmentlisting" element={<AdminAppointmentListing />} />
            <Route path="/admin/terms" element={<AdminTerms />} />
            <Route path="/admin/privacy" element={<AdminPrivacy />} />
            <Route path="/admin/management" element={<AdminManagement />} />
            <Route path="/admin/reviews" element={<AdminReviews />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
        </NormalizeRoute>
      </Suspense>
      <ToastContainer 
        position="top-center" 
        autoClose={2000} 
        hideProgressBar={false}
        newestOnTop 
        closeOnClick={true}
        pauseOnFocusLoss={false}
        draggable={false}
        pauseOnHover={false}
        rtl={false}
        theme="light"
        limit={3}
      />
    </>
  );
}

export default function App() {
  const dispatch = useDispatch();
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/verify`);
        const data = await res.json();
        if (data.success === false) {
          dispatch(signoutUserSuccess());
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        dispatch(signoutUserSuccess());
      } finally {
        setBootstrapped(true);
      }
    };

    checkAuth();
  }, [dispatch]);

  return (
    <WishlistProvider>
      <BrowserRouter>
        <AppRoutes bootstrapped={bootstrapped} />
      </BrowserRouter>
    </WishlistProvider>
  );
}
