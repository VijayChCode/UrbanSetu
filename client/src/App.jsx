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
import { ImageFavoritesProvider } from "./contexts/ImageFavoritesContext";
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
import { useSoundEffects } from './components/SoundEffects';
import RoutePlannerAdmin from './pages/RoutePlannerAdmin';

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
const WatchlistExplore = lazy(() => import("./pages/WatchlistExplore"));
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
const AdminMovers = lazy(() => import('./pages/AdminMovers'));
const AdminServices = lazy(() => import('./pages/AdminServices'));
const PackersMovers = lazy(() => import('./pages/PackersMovers'));
const OnDemandServices = lazy(() => import('./pages/OnDemandServices'));
const RoutePlanner = lazy(() => import('./pages/RoutePlanner'));
const UserReviews = lazy(() => import("./pages/UserReviews"));
const AdminFraudManagement = lazy(() => import('./pages/AdminFraudManagement'));
const PaymentDashboard = lazy(() => import('./pages/PaymentDashboard'));

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
  const { playNotification } = useSoundEffects();

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

  // Track currently open chat
  const [currentlyOpenChat, setCurrentlyOpenChat] = useState(null);

  // Listen for chat open/close events
  useEffect(() => {
    const handleChatOpen = (e) => {
      setCurrentlyOpenChat(e.detail.appointmentId);
    };
    
    const handleChatClose = () => {
      setCurrentlyOpenChat(null);
    };
    
    window.addEventListener('chatOpened', handleChatOpen);
    window.addEventListener('chatClosed', handleChatClose);
    
    return () => {
      window.removeEventListener('chatOpened', handleChatOpen);
      window.removeEventListener('chatClosed', handleChatClose);
    };
  }, []);

  // Socket event listener for new message notifications
  useEffect(() => {
    if (!currentUser) return; // Only run if user is logged in
    
    const handleNewMessage = async (data) => {
      // Since backend now only sends to intended recipients, we can trust this message is for us
      // Just check if it's not from the current user
      if (data.comment && data.comment.senderEmail !== currentUser.email) {
        

        // Check if we're on the MyAppointments page
        const currentPath = window.location.pathname;
        const isOnMyAppointments = currentPath.includes('/my-appointments') || currentPath.includes('/user/my-appointments');
        
        // Check if the user is currently viewing this specific chat
        const isCurrentlyViewingThisChat = currentlyOpenChat === data.appointmentId;
        
        // Don't show notification if user is already viewing this chat
        if (isCurrentlyViewingThisChat) {
          return;
        }
        
        // IMPORTANT: Check if this is a reaction update, not a new message
        // We need to distinguish between new messages and updates to existing messages
        
        // The key insight: reaction updates are updates to existing messages, not new messages
        // Even though they contain the original message content, they're triggered by reactions
        
        // Check if this is likely a reaction update by looking for key indicators:
        // 1. If there's no message content, it's not a new message
        // 2. If there's a messageId field, it might be an update to an existing message
        // 3. If there are reactions, it's likely a reaction update
        // 4. If the comment has an _id that suggests it's an existing message update
        
        // Don't show notification if:
        // - No message content (reactions, status updates, etc.)
        // - This appears to be an update to an existing message rather than a new message
        // - The comment object structure suggests it's an update, not a new message
        
        // CRITICAL: Only skip if this is clearly a reaction update
        const hasReactions = Array.isArray(data.comment.reactions) && data.comment.reactions.length > 0;
        const isUpdateToExisting = Boolean(data.messageId); // server uses messageId for updates
        if (hasReactions || isUpdateToExisting) {
          return;
        }
        
        // Use same logic as MyAppointments page to check if sender is admin
        let senderName = data.comment.senderEmail || 'User';
        
        // Check if sender is admin by comparing with buyer and seller emails from the appointment data
        // This is the same logic used in MyAppointments.jsx
        const isSenderAdmin = data.comment.senderEmail !== data.buyerEmail && data.comment.senderEmail !== data.sellerEmail;
        
        if (isSenderAdmin) {
          senderName = "UrbanSetu";
        } else {
          // For regular users, try to get a better name if available
          try {
            const res = await fetch(`${API_BASE_URL}/api/user/check-email/${encodeURIComponent(data.comment.senderEmail)}`, {
              credentials: 'include'
            });
            
            if (res.ok) {
              const userData = await res.json();
              senderName = userData.username || data.comment.senderEmail;
            }
          } catch (error) {
            // If API call fails, use email as fallback
            senderName = data.comment.senderEmail;
          }
        }
        
        // Show notification for new message
        try { playNotification(); } catch (_) {}
        
        if (isOnMyAppointments) {
          // If on MyAppointments page, dispatch custom event to open chat
          toast.info(`New message from ${senderName}`, {
            onClick: () => {
              // Dispatch custom event to MyAppointments page to open the specific chat
              window.dispatchEvent(new CustomEvent('openChatFromNotification', {
                detail: {
                  appointmentId: data.appointmentId,
                  fromNotification: true,
                  preferUnread: true
                }
              }));
            },
            autoClose: 5000,
            closeOnClick: true,
            pauseOnHover: false
          });
        } else {
          // If not on MyAppointments page, navigate to it
          toast.info(`New message from ${senderName}`, {
            onClick: () => {
              // Navigate to MyAppointments page when notification is clicked
              // and pass the appointment ID to open the specific chat
              navigate('/user/my-appointments', { 
                state: { 
                  openChatForAppointment: data.appointmentId,
                  fromNotification: true 
                } 
              });
            },
            autoClose: 5000,
            closeOnClick: true,
            pauseOnHover: false
          });
        }
      }
    };

    socket.on('commentUpdate', handleNewMessage);
    
    return () => {
      socket.off('commentUpdate', handleNewMessage);
    };
  }, [dispatch, navigate, currentUser, playNotification, currentlyOpenChat]);

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
            <Route path="/user/watchlist/explore" element={<WatchlistExplore />} />
            <Route path="/user/appointment" element={<Appointment />} />
            <Route path="/user/my-appointments" element={<MyAppointments />} />
            <Route path="/user/my-listings" element={<MyListings />} />
            <Route path="/user/movers" element={<PackersMovers />} />
            <Route path="/user/services" element={<OnDemandServices />} />
            <Route path="/user/route-planner" element={<RoutePlanner />} />
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
            <Route path="/admin/movers" element={<AdminMovers />} />
            <Route path="/admin/services" element={<AdminServices />} />
            <Route path="/admin/route-planner" element={<RoutePlannerAdmin />} />
            <Route path="/admin/fraudmanagement" element={<AdminFraudManagement />} />
            <Route path="/admin/payments" element={<PaymentDashboard />} />
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
      <ImageFavoritesProvider>
        <BrowserRouter>
          <AppRoutes bootstrapped={bootstrapped} />
        </BrowserRouter>
      </ImageFavoritesProvider>
    </WishlistProvider>
  );
}
