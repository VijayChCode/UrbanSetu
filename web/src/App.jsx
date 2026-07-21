import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate, useParams, Link } from "react-router-dom";
import React, { useEffect, Suspense, lazy, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { verifyAuthStart, verifyAuthSuccess, verifyAuthFailure, signoutUserSuccess, updateUserSuccess, signInSuccess, signoutUserStart } from "./redux/user/userSlice.js";
import { persistor } from './redux/store';
import { socket, reconnectSocket } from "./utils/socket";
import { authenticatedFetch, isAuthenticated } from './utils/auth';
import Header from './components/Header';
import AdminHeader from './components/AdminHeader';
import Private from "./components/Private";
import AdminRoute from "./components/AdminRoute";
import WishlistProvider from "./WishlistContext";
import { ImageFavoritesProvider } from "./contexts/ImageFavoritesContext";
import { HeaderProvider, useHeader } from "./contexts/HeaderContext";
import { CallProvider, useCallContext } from "./contexts/CallContext";
import ContactSupportWrapper from "./components/ContactSupportWrapper";
import UserAvatar from "./components/UserAvatar";
import { resetSettingsToDefaults, syncSettingsFromUser } from "./utils/settingsSync";
import { clearSentinelData } from "./utils/sentinelLiveEngine";
import NetworkStatus from "./components/NetworkStatus";
import CookieConsent from "./components/CookieConsent";
import VisitorTracker from "./components/VisitorTracker";
import Footer from "./components/Footer";
import GlobalCallModals from "./components/GlobalCallModals";
import SignoutModal from "./components/SignoutModal";
import SitemapNav from "./components/SitemapNav";
import UserChangePassword from './pages/UserChangePassword';
import AdminChangePassword from './pages/AdminChangePassword';
import AccountRevocation from './pages/AccountRevocation';
import AccountConflictResolution from './pages/AccountConflictResolution';
import RestoreProperty from './pages/RestoreProperty';
import NotFound from './pages/NotFound';
import Terms from "./pages/Terms";


// Blog redirect component for logged-in users
const BlogRedirect = () => {
  const { slug } = useParams();
  const location = useLocation();
  const isGuide = location.pathname.includes('/guide/');
  return <Navigate to={`/user/${isGuide ? 'guide' : 'blog'}/${slug}`} replace />;
};
import Privacy from "./pages/Privacy";
import UserTerms from "./pages/UserTerms";
import AdminTerms from "./pages/AdminTerms";
import UserPrivacy from "./pages/UserPrivacy";
import AdminPrivacy from "./pages/AdminPrivacy";
import UserCookiePolicy from "./pages/UserCookiePolicy";
import AdminCookiePolicy from "./pages/AdminCookiePolicy";
import { FaHome, FaServer, FaArrowRight } from "react-icons/fa";
import { LogOut } from "lucide-react";
import AdminManagement from './pages/AdminManagement';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { toast } from 'react-toastify';
import { useSoundEffects } from './components/SoundEffects';
import RoutePlannerAdmin from './pages/RoutePlannerAdmin';
import MediaPreviewGlobal from './components/MediaPreviewGlobal';
import GlobalReminderListener from './components/GlobalReminderListener';

// Lazy load all pages
const PublicHome = lazy(() => import('./pages/PublicHome'));
const Home = lazy(() => import('./pages/Home'));
const PublicAbout = lazy(() => import('./pages/PublicAbout'));
const About = lazy(() => import('./pages/About'));
const PublicBlogs = lazy(() => import('./pages/PublicBlogs'));
const PublicBlogDetail = lazy(() => import('./pages/PublicBlogDetail'));
const PublicGuides = lazy(() => import('./pages/PublicGuides'));
const PublicFAQs = lazy(() => import('./pages/PublicFAQs'));
const AdminBlogs = lazy(() => import('./pages/AdminBlogs'));
const AdminBlogDetail = lazy(() => import('./pages/AdminBlogDetail'));
const AdminFAQs = lazy(() => import('./pages/AdminFAQs'));
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
const Watchlist = lazy(() => import("./pages/Watchlist"));
const Appointment = lazy(() => import("./components/Appointment"));
const AdminAppointments = lazy(() => import("./pages/AdminAppointments"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const MyAppointments = lazy(() => import("./pages/MyAppointments"));
const CallHistory = lazy(() => import("./pages/CallHistory"));
const AdminCallHistory = lazy(() => import("./pages/AdminCallHistory"));
const MyListings = lazy(() => import("./pages/MyListings"));
const AdminAbout = lazy(() => import("./pages/AdminAbout"));
const AdminExplore = lazy(() => import("./pages/AdminExplore"));
const AdminCreateListing = lazy(() => import("./pages/AdminCreateListing"));
// AdminWishlist removed (no admin wishlist page)
const AdminProfile = lazy(() => import("./pages/AdminProfile"));
const AdminDeploymentManagement = lazy(() => import("./pages/AdminDeploymentManagement"));
const AdminRequests = lazy(() => import("./pages/AdminRequests"));
const AdminListings = lazy(() => import("./pages/AdminListings"));
const AdminMyListings = lazy(() => import("./pages/AdminMyListings"));
const AdminEditListing = lazy(() => import("./pages/AdminEditListing"));
const RemindersPage = lazy(() => import("./pages/RemindersPage"));
const Oauth = lazy(() => import("./components/Oauth"));
const AdminAppointmentListing = lazy(() => import("./pages/AdminAppointmentListing"));
const AdminReviews = lazy(() => import("./pages/AdminReviews"));
const AdminServices = lazy(() => import('./pages/AdminServices'));
const OnDemandServices = lazy(() => import('./pages/OnDemandServices'));
const RoutePlanner = lazy(() => import('./pages/RoutePlanner'));
const UserReviews = lazy(() => import("./pages/UserReviews"));
const AdminFraudManagement = lazy(() => import('./pages/AdminFraudManagement'));
const PaymentDashboard = lazy(() => import('./pages/PaymentDashboard'));
const AdminSecurityModeration = lazy(() => import('./pages/AdminSecurityModeration'));
const MyPayments = lazy(() => import('./pages/MyPayments'));
const DeviceManagement = lazy(() => import('./pages/DeviceManagement'));
const AdminDeletedListings = lazy(() => import("./pages/AdminDeletedListings"));
const MyDeletedListings = lazy(() => import("./pages/MyDeletedListings"));
const SessionManagement = lazy(() => import('./pages/SessionManagement'));
const SessionAuditLogs = lazy(() => import('./pages/SessionAuditLogs'));
const UserContact = lazy(() => import('./pages/UserContact'));
const AdminSupport = lazy(() => import('./pages/AdminSupport'));
const PublicAI = lazy(() => import('./pages/PublicAI'));
const UserAI = lazy(() => import('./pages/UserAI'));
const AdminAI = lazy(() => import('./pages/AdminAI'));
const SharedChatView = lazy(() => import('./pages/SharedChatView'));
const ViewDocument = lazy(() => import('./pages/ViewDocument'));
const ViewChatDocument = lazy(() => import('./pages/ViewChatDocument'));
const VideoEmbed = lazy(() => import('./pages/VideoEmbed'));
const ImageEmbed = lazy(() => import('./pages/ImageEmbed'));
const InvestmentTools = lazy(() => import('./pages/InvestmentTools'));
const Settings = lazy(() => import('./pages/Settings'));
const PropertyVerification = lazy(() => import('./pages/PropertyVerification'));
const AdminPropertyVerification = lazy(() => import('./pages/AdminPropertyVerification'));
const RentalRatings = lazy(() => import('./pages/RentalRatings'));
const AdminRentalRatings = lazy(() => import('./pages/AdminRentalRatings'));
const RentalContracts = lazy(() => import('./pages/RentalContracts'));
const AdminRentalContracts = lazy(() => import('./pages/AdminRentalContracts'));
const RentProperty = lazy(() => import('./pages/RentProperty'));
const RentalLoans = lazy(() => import('./pages/RentalLoans'));
const AdminRentalLoans = lazy(() => import('./pages/AdminRentalLoans'));
const DisputeResolution = lazy(() => import('./pages/DisputeResolution'));
const AdminDisputeResolution = lazy(() => import('./pages/AdminDisputeResolution'));
const RentWallet = lazy(() => import('./pages/RentWallet'));
const Community = lazy(() => import('./pages/Community'));
const AdminCommunity = lazy(() => import('./pages/AdminCommunity'));
const Contact = lazy(() => import('./pages/Contact'));
const CookiePolicy = lazy(() => import('./pages/CookiePolicy'));
const PayMonthlyRent = lazy(() => import('./pages/PayMonthlyRent'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const AdminCoinStats = lazy(() => import('./pages/AdminCoinStats'));
const Rewards = lazy(() => import('./pages/Rewards'));
const YearInReview = lazy(() => import('./pages/YearInReview'));
const AdminUpdates = lazy(() => import('./pages/AdminUpdates'));
const Updates = lazy(() => import('./pages/Updates'));
const StatusPage = lazy(() => import('./pages/StatusPage'));
const LockAccount = lazy(() => import('./pages/security/LockAccount'));
const UnlockAccount = lazy(() => import('./pages/security/UnlockAccount'));
const Unsubscribe = lazy(() => import('./pages/Unsubscribe'));
const CommunityGuidelines = lazy(() => import('./pages/CommunityGuidelines'));
const Downloads = lazy(() => import('./pages/Downloads'));
const GoogleOneTap = lazy(() => import('./components/GoogleOneTap'));
const ClientErrorMonitoring = lazy(() => import('./pages/ClientErrorMonitoring'));
const HelpCenter = lazy(() => import('./pages/HelpCenter/HelpCenter'));
const ArticleView = lazy(() => import('./pages/HelpCenter/ArticleView'));
const AdminHelpCenter = lazy(() => import('./pages/HelpCenter/AdminHelpCenter'));
const ErrorCodes = lazy(() => import('./pages/ErrorCodes'));
const FindAgent = lazy(() => import('./pages/Agents/FindAgent'));
const BecomeAgent = lazy(() => import('./pages/Agents/BecomeAgent'));
const AgentProfile = lazy(() => import('./pages/Agents/AgentProfile'));
const AdminAgents = lazy(() => import('./pages/AdminAgents'));
const AgentDashboard = lazy(() => import('./pages/Agents/AgentDashboard'));
const MarketTrends = lazy(() => import('./pages/MarketTrends'));
const AdminSponsorIntelligence = lazy(() => import('./pages/AdminSponsorIntelligence'));
const AdminRentWallet = lazy(() => import('./pages/AdminRentWallet'));
const SecurityIntelligence = lazy(() => import('./pages/SecurityIntelligence'));
const AdminAuditTrail = lazy(() => import('./pages/AdminAuditTrail'));
const AdminSentinelDashboard = lazy(() => import('./pages/AdminSentinelDashboard'));



// Helper for Help Center Redirects
function ArticleViewRedirect() {
  const { slug } = useParams();
  const { currentUser } = useSelector((state) => state.user);

  if (currentUser) {
    if (currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
      // Admins might want to edit or view. For now, send to Admin Dashboard or implement Admin View
      // Since we don't have a specific admin view page for slug yet (only edit modal), 
      // let's send them to the public view but under /admin if needed, or just /admin/help-center
      // The user instruction implies specific routes.
      // But wait, admin route is /admin/help-center (dashboard). 
      // Let's redirect admins to dashboard for now as they "manage" it.
      return <Navigate to="/admin/help-center" />;
    } else {
      return <Navigate to={`/user/help-center/article/${slug}`} />;
    }
  }
  return <ArticleView />;
}

import UrbanSetuSpinner from "./components/UrbanSetuSpinner";

// ----------------------------------------------------------------------
// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300 relative overflow-hidden">
    {/* Decorative Background Blobs */}
    <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 dark:bg-blue-900/20 rounded-full mix-blend-multiply dark:mix-blend-overlay filter blur-3xl opacity-30 animate-blob"></div>
    <div className="absolute top-0 right-0 w-96 h-96 bg-purple-200 dark:bg-purple-900/20 rounded-full mix-blend-multiply dark:mix-blend-overlay filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
    <div className="absolute -bottom-32 left-20 w-96 h-96 bg-pink-200 dark:bg-pink-900/20 rounded-full mix-blend-multiply dark:mix-blend-overlay filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

    <div className="relative flex flex-col items-center z-10 scale-95 sm:scale-100">
      {/* Central Logo with standardized UrbanSetuSpinner */}
      <div className="relative w-28 h-28 flex items-center justify-center mb-8">
        <UrbanSetuSpinner size="xl" className="!w-full !h-full" isBright={true} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="p-3.5 bg-white/10 backdrop-blur-md rounded-full shadow-inner border border-white/20">
            <FaHome className="text-4xl text-blue-600 dark:text-blue-400 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Text Info */}
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent drop-shadow-sm">
          UrbanSetu
        </h1>
        <div className="flex flex-col items-center justify-center gap-1.5">
          <span className="text-gray-500 dark:text-gray-400 font-bold tracking-[0.25em] text-xs uppercase opacity-80">LOADING</span>
          <div className="flex gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-1.5 h-1.5 bg-purple-500 dark:bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-1.5 h-1.5 bg-pink-500 dark:bg-pink-400 rounded-full animate-bounce"></span>
          </div>
        </div>
      </div>

      {/* Hidden SEO Links to avoid "Dead End" errors during hydration */}
      <nav className="sr-only">
        <a href="/sign-in">Sign In</a>
        <a href="/sign-up">Sign Up</a>
        <a href="/forgot-password">Forgot Password</a>
        <a href="/">Home</a>
        <a href="/search">Search Properties</a>
        <a href="/about">About Us</a>
        <a href="/blogs">Blogs</a>
        <a href="/guides">Real Estate Guides</a>
        <a href="/market-trends">Market Trends</a>
        <a href="/contact">Contact Support</a>
        <a href="/help-center">Help Center</a>
        <a href="/community">Community</a>
        <a href="/faqs">FAQs</a>
        <a href="/updates">Updates</a>
        <a href="/download">Downloads</a>
        <a href="/terms">Terms and Conditions</a>
        <a href="/privacy">Privacy Policy</a>
        <a href="/cookie-policy">Cookie Policy</a>
        <a href="/community-guidelines">Community Guidelines</a>
        <a href="/agents">Find Agents</a>
        <a href="/error-codes">Error Codes Reference</a>
      </nav>
    </div>

    <style>{`
      @keyframes blob {
        0% { transform: translate(0px, 0px) scale(1); }
        33% { transform: translate(30px, -50px) scale(1.1); }
        66% { transform: translate(-20px, 20px) scale(0.9); }
        100% { transform: translate(0px, 0px) scale(1); }
      }
      @keyframes slideDown {
        0% { transform: translateY(-100%); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }
      .animate-slideDown { animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      .animate-blob { animation: blob 7s infinite; }
      .animation-delay-2000 { animation-delay: 2s; }
      .animation-delay-4000 { animation-delay: 4s; }
    `}</style>
  </div>
);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';



// Utility function to normalize route based on role
function normalizeRoute(path, role) {
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

  // Redirect authenticated users away from public root/home
  if ((path === "/" || path === "/home") && role !== "public") {
    return role === "admin" ? "/admin" : "/user";
  }

  // Redirect authenticated users away from auth pages
  // We check isAuthenticated() to avoid redirect loops if Redux state is stale (user executing signout or token expired)
  if (role !== "public" && isAuthenticated() && ["/sign-in", "/sign-up", "/forgot-password", "/oauth"].includes(path)) {
    return role === "admin" ? "/admin" : "/user";
  }

  // List of base routes that have public-facing versions
  const publicBases = ["about", "blogs", "blog", "guides", "guide", "faqs", "search", "terms", "privacy", "cookie-policy", "listing", "home", "contact", "ai", "community-guidelines", "community", "help-center", "agents", "market-trends", "error-codes"];

  // List of base routes that exist for both user and admin but are NOT public
  const parallelBases = [
    "year", "profile", "settings", "investment-tools", "create-listing", "update-listing",
    "community", "change-password", "view", "view-chat", "reviews", "disputes",
    "property-verification", "rental-ratings", "rental-contracts", "rental-loans",
    "services", "route-planner", "device-management"
  ];

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
    // If public tries to access /user/* or /admin/* that has a public version, redirect to public
    if ((prefix === "user" || prefix === "admin") && publicBases.includes(base)) {
      return `/${base}${rest}`;
    }
    // If public tries to access deep user/admin-only, show 404 (triggers redirect to login in NormalizeRoute)
    if ((prefix === "user" || prefix === "admin") && !publicBases.includes(base)) {
      return null;
    }
    // Otherwise, stay on public
    return path;
  }

  if (role === "user") {
    // If user tries to access a public path that should be prefixed, redirect to /user/*
    if (!prefix && publicBases.includes(base)) {
      return `/user/${base}${rest}`;
    }
    // If user tries to access /admin/*, redirect to /user/* if it's a parallel or public route, else 404
    if (prefix === "admin") {
      if (publicBases.includes(base) || parallelBases.includes(base)) {
        return `/user/${base}${rest}`;
      }
      return null;
    }
    // If user tries to access /user/*, allow
    if (prefix === "user") return path;
    // Otherwise, stay
    return path;
  }

  if (role === "admin") {
    // If admin tries to access a public path that should be prefixed, redirect to /admin/*
    if (!prefix && publicBases.includes(base)) {
      return `/admin/${base}${rest}`;
    }
    // If admin tries to access /user/*, redirect to /admin/* if it's a parallel or public route, else 404
    if (prefix === "user") {
      if (publicBases.includes(base) || parallelBases.includes(base)) {
        return `/admin/${base}${rest}`;
      }
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
    // If public user tries to access restricted pages, redirect to login with callback
    if (role === 'public') {
      const redirectUrl = location.pathname + location.search;
      return <Navigate to={`/sign-in?redirect=${encodeURIComponent(redirectUrl)}`} replace />;
    }
    // Otherwise show 404 (e.g. user trying to access admin pages)
    return <NotFound />;
  }
  if (normalized !== location.pathname) {
    // When redirecting away from auth pages (sign-in, sign-up), respect the redirect param
    const isAuthPage = ['/sign-in', '/sign-up', '/forgot-password', '/oauth'].includes(location.pathname);
    if (isAuthPage && location.search) {
      const searchParams = new URLSearchParams(location.search);
      const redirectUrl = searchParams.get('redirect');
      if (redirectUrl && redirectUrl.startsWith('/')) {
        return <Navigate to={redirectUrl} replace />;
      }
    }
    // Redirect to normalized route, preserving query parameters and hash fragments (e.g. Scroll to Text Fragments)
    return <Navigate to={`${normalized}${location.search || ''}${location.hash || ''}`} replace />;
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
        } catch (e) { }
      }
      return response;
    };
    return () => {
      window.fetch = origFetch;
    };
  }, [dispatch, navigate]);
}

function AppRoutes({ bootstrapped, upcomingConfig }) {
  const location = useLocation();
  const dispatch = useDispatch();
  const { currentUser, loading, isSigningOut } = useSelector((state) => state.user);
  const { isHeaderVisible } = useHeader();
  const [sessionChecked, setSessionChecked] = useState(false);
  const navigate = useNavigate(); // Fix: ensure navigate is defined
  const { playNotification } = useSoundEffects();

  const [isBannerDismissed, setIsBannerDismissed] = useState(() => {
    return sessionStorage.getItem('upcoming_maintenance_dismissed') === 'true';
  });

  const handleDismissBanner = () => {
    sessionStorage.setItem('upcoming_maintenance_dismissed', 'true');
    setIsBannerDismissed(true);
  };

  const renderMessage = (text) => {
    if (!text) return "";
    if (text.includes("status page")) {
      const parts = text.split("status page");
      return (
        <>
          {parts[0]}
          <Link to="/status?tab=maintenanceupdates" className="underline font-bold text-white hover:text-amber-200 transition-colors">status page</Link>
          {parts[1]}
        </>
      );
    }
    return text;
  };

  // Apply persisted theme (light/dark/system) globally and listen for changes
  useEffect(() => {
    const applyTheme = () => {
      try {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (savedTheme === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          // System default or no preference
          if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      } catch (_) {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      // Only re-apply if theme is set to system (or not set)
      const savedTheme = localStorage.getItem('theme');
      if (!savedTheme || savedTheme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    // Also listen for storage changes (e.g. from Settings tab)
    const handleStorage = (e) => {
      if (e.key === 'theme') {
        applyTheme();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Sync tabs on login/logout (Global Session Management)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'logout' || e.key === 'login') {
        // Reload page to sync state with new cookies/session
        window.location.reload();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Global Referral Tracking
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('urbansetu_ref', ref);
    }
  }, [location.search]);

  // Do not show header on /appointments admin route or Year in Review pages
  const isYearPath = location.pathname.includes('/year/');
  const hideHeaderRoutes = ["/appointments"];

  const shouldHideFooter = 
    location.pathname === '/community' ||
    location.pathname.startsWith('/community/post/') ||
    location.pathname === '/user/community' ||
    location.pathname.startsWith('/user/community/post/') ||
    location.pathname === '/admin/community' ||
    location.pathname.startsWith('/admin/community/post/') ||
    location.pathname.startsWith('/view/') ||
    location.pathname.startsWith('/user/view/') ||
    location.pathname.startsWith('/admin/view/') ||
    location.pathname.startsWith('/user/view-chat/') ||
    location.pathname.startsWith('/admin/view-chat/') ||
    location.pathname.startsWith('/user/route-planner') ||
    location.pathname.startsWith('/admin/route-planner');

  const [pendingTransfer, setPendingTransfer] = useState(null);
  const [checkingTransferUser, setCheckingTransferUser] = useState(false);

  const runSessionCheck = async () => {
    const isTransfer = sessionStorage.getItem('transfer_pending') === 'true';
    const isTransferFailed = sessionStorage.getItem('transfer_failed') === 'true';
    const hasSessionConflict = sessionStorage.getItem('transfer_session_conflict') === 'true';

    // Clean up transfer flags immediately so they don't persist across refreshes
    sessionStorage.removeItem('transfer_pending');
    sessionStorage.removeItem('transfer_failed');
    sessionStorage.removeItem('transfer_session_conflict');

    // If the transfer token was malformed/expired, show error immediately
    if (isTransferFailed) {
      toast.error('Session transfer failed — the token was invalid or expired. Please sign in again.', { autoClose: 6000 });
    }

    // If no token exists at all, user is not logged in — skip server verification
    if (!localStorage.getItem('accessToken')) {
      setSessionChecked(true);
      return;
    }

    dispatch(verifyAuthStart());
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/verify`, {
        method: 'GET'
      });
      const data = await res.json();
      if (res.ok && data.authenticated !== false && data._id) {
        // Server confirmed session is valid — update Redux with fresh user data
        dispatch(verifyAuthSuccess(data));

        // Show transfer-specific feedback
        if (isTransfer) {
          try {
            syncSettingsFromUser(data);
          } catch (e) {}
          reconnectSocket();

          if (hasSessionConflict) {
            toast.info('Session transferred from another server. Your previous session on this domain was replaced.', { autoClose: 5000 });
          } else {
            toast.success('Session transferred successfully from backup server.', { autoClose: 4000 });
          }
        }
      } else {
        // Server explicitly confirmed session is invalid — clean up completely
        localStorage.removeItem('accessToken');
        localStorage.removeItem('sessionId');
        localStorage.removeItem('refreshToken');
        await persistor.purge();
        dispatch(verifyAuthFailure(data.message || 'Session invalid'));
        dispatch(signoutUserSuccess());

        // Show transfer-specific error
        if (isTransfer) {
          toast.error('Session transfer failed — the session is no longer valid. Please sign in again.', { autoClose: 6000 });
        }
      }
    } catch (err) {
      console.warn('Session verification network error, keeping existing state:', err);
      // Do NOT sign out on network error — trust local persisted state for resilience
      if (isTransfer) {
        toast.warning('Session transferred but could not verify with server. You may need to sign in again if issues persist.', { autoClose: 5000 });
      }
    } finally {
      setSessionChecked(true);
    }
  };

  useEffect(() => {
    if (!bootstrapped) return;

    const params = new URLSearchParams(window.location.search);
    const transferToken = params.get('transfer_token');
    const transferSession = params.get('transfer_session');
    const transferRefresh = params.get('transfer_refresh');

    if (transferToken) {
      // Validate JWT structure before storing (must be 3 dot-separated base64 parts with valid payload)
      let isValid = false;
      try {
        const parts = transferToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          // Check that the token has an expiry and is not already expired
          if (payload && payload.exp && payload.exp > Date.now() / 1000) {
            isValid = true;
          }
        }
      } catch (e) {
        console.warn('Transfer token validation failed:', e.message);
      }

      // Always clean URL regardless of validation outcome
      params.delete('transfer_token');
      params.delete('transfer_session');
      params.delete('transfer_refresh');
      const newSearch = params.toString();
      const newPath = window.location.pathname + (newSearch ? `?${newSearch}` : '');
      window.history.replaceState({}, '', newPath);

      if (isValid) {
        const existingToken = localStorage.getItem('accessToken');
        if (existingToken) {
          // There is an existing session - let's fetch details of the transfer token first
          setCheckingTransferUser(true);

          fetch(`${API_BASE_URL}/api/auth/verify`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${transferToken}`,
              ...(transferSession ? { 'X-Session-Id': transferSession } : {})
            }
          })
            .then(res => res.json())
            .then(data => {
              setCheckingTransferUser(false);
              if (data && data._id && data.email) {
                // Determine current user email from Redux or local storage
                let existingEmail = '';
                let existingId = '';
                try {
                  const existingPayload = JSON.parse(atob(existingToken.split('.')[1]));
                  existingId = existingPayload.id || '';
                  existingEmail = currentUser?.email || '';
                  if (!existingEmail) {
                    const userInfoStr = localStorage.getItem('persist:root');
                    if (userInfoStr) {
                      const parsed = JSON.parse(userInfoStr);
                      const user = JSON.parse(parsed.user);
                      existingEmail = user?.currentUser?.email || '';
                    }
                  }
                } catch (e) {}

                // If user IDs/emails differ, ask for confirmation
                const transferPayload = JSON.parse(atob(transferToken.split('.')[1]));
                const isDifferentUser = (existingId && transferPayload.id && existingId !== transferPayload.id) ||
                                        (existingEmail && data.email && existingEmail.toLowerCase() !== data.email.toLowerCase());

                if (isDifferentUser) {
                  // Conflict! Set pending transfer and flag to render page + modal
                  const currentUsername = currentUser?.username || existingEmail.split('@')[0] || 'Active User';
                  setPendingTransfer({
                    token: transferToken,
                    session: transferSession,
                    refresh: transferRefresh,
                    targetPath: newPath,
                    currentUser: currentUser ? { ...currentUser, email: existingEmail, username: currentUsername } : { email: existingEmail, username: currentUsername },
                    newUser: data
                  });
                  setSessionChecked(true); // render pages with the modal overlay
                } else {
                  // Same user - just overwrite and check
                  localStorage.setItem('accessToken', transferToken);
                  if (transferSession) localStorage.setItem('sessionId', transferSession);
                  if (transferRefresh) localStorage.setItem('refreshToken', transferRefresh);
                  sessionStorage.setItem('transfer_pending', 'true');
                  runSessionCheck();
                }
              } else {
                sessionStorage.setItem('transfer_failed', 'true');
                runSessionCheck();
              }
            })
            .catch(err => {
              setCheckingTransferUser(false);
              console.error('Error verifying transfer token user:', err);
              sessionStorage.setItem('transfer_failed', 'true');
              runSessionCheck();
            });
        } else {
          // No existing session - proceed directly with switch
          localStorage.setItem('accessToken', transferToken);
          if (transferSession) localStorage.setItem('sessionId', transferSession);
          if (transferRefresh) localStorage.setItem('refreshToken', transferRefresh);
          sessionStorage.setItem('transfer_pending', 'true');
          runSessionCheck();
        }
      } else {
        // Invalid transfer token
        sessionStorage.setItem('transfer_failed', 'true');
        runSessionCheck();
      }
    } else {
      // Normal application load
      runSessionCheck();
    }
  }, [bootstrapped, dispatch]);

  const handleConfirmTransfer = async () => {
    if (!pendingTransfer) return;

    // Save configuration locally and immediately close modal to prevent blocking the SignoutModal overlay
    const transfer = pendingTransfer;
    setPendingTransfer(null);

    // 1. Show Signout loading modal
    dispatch(signoutUserStart());

    // Allow the modal animation to play for at least 1.5 seconds to feel smooth and premium
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      // 2. Perform the local cleanups of current session (safely clearing cookies, persist store, sockets, etc.)
      await persistor.purge();

      localStorage.removeItem('accessToken');
      localStorage.removeItem('sessionId');
      localStorage.removeItem('refreshToken');
      localStorage.setItem('logout', Date.now().toString());
      
      document.cookie = 'access_token=; Max-Age=0; path=/; SameSite=None; Secure';
      document.cookie = 'refresh_token=; Max-Age=0; path=/; SameSite=None; Secure';
      document.cookie = 'session_id=; Max-Age=0; path=/; SameSite=None; Secure';

      try {
        resetSettingsToDefaults();
      } catch (e) {
        console.warn("resetSettingsToDefaults failed:", e);
      }

      if (currentUser?._id) {
        try {
          clearSentinelData(currentUser._id);
        } catch (e) {
          console.warn("clearSentinelData failed:", e);
        }
      }

      if (socket && socket.connected) {
        socket.disconnect();
      }

      // 3. Clear Redux signing out state
      dispatch(signoutUserSuccess());

      // 4. Safely sign in to new user B's session
      localStorage.setItem('accessToken', transfer.token);
      if (transfer.session) localStorage.setItem('sessionId', transfer.session);
      if (transfer.refresh) localStorage.setItem('refreshToken', transfer.refresh);
      localStorage.setItem('login', Date.now().toString());

      dispatch(signInSuccess(transfer.newUser));
      try {
        syncSettingsFromUser(transfer.newUser);
      } catch (e) {
        console.warn("syncSettingsFromUser failed:", e);
      }
      reconnectSocket();

      sessionStorage.setItem('transfer_session_conflict', 'true');
      sessionStorage.setItem('transfer_pending', 'true');

      const target = transfer.targetPath;

      // 5. Navigate to target URL
      window.location.href = target;
    } catch (err) {
      console.error("Session switch failed:", err);
      dispatch(signoutUserSuccess());
    }
  };

  const handleCancelTransfer = () => {
    setPendingTransfer(null);
  };

  // Socket event listener for account suspension
  useEffect(() => {
    if (!currentUser) return; // Only run if user is logged in
    // Ensure this client is joined to user and session rooms for targeted realtime actions
    const registerRealtimeRooms = () => {
      try {
        if (socket && socket.connected) {
          socket.emit('registerUser', { userId: currentUser._id });
          const match = document.cookie.split('; ').find(row => row.startsWith('session_id='));
          const sid = match ? decodeURIComponent(match.split('=')[1]) : null;
          if (sid) {
            socket.emit('registerSession', { sessionId: sid });
          }
        }
      } catch (_) { }
    };
    registerRealtimeRooms();
    const regInterval = setInterval(registerRealtimeRooms, 15000);

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

    // Global socket event listener for session-specific forced logout
    const handleForceLogoutSession = (data) => {
      const currentSessionId = localStorage.getItem('sessionId');
      // If the event targets this specific session
      if (data.sessionId === currentSessionId) {
        dispatch(signoutUserSuccess());
        toast.error(data.reason || "Your session has expired or was revoked.");
        setTimeout(() => {
          navigate("/sign-in");
        }, 1800);
      }
    };

    socket.on('force_logout_session', handleForceLogoutSession);

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
      clearInterval(regInterval);
      socket.off('account_suspended', handleAccountSuspended);
      socket.off('force_signout', handleForceSignout);
      socket.off('force_logout_session', handleForceLogoutSession);
      socket.off('user_update', handleUserUpdate);
      socket.off('admin_update', handleAdminUpdate);
    };
  }, [dispatch, navigate, currentUser]);

  // Settings sync listener for ?syncsettings=1 URL param
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isSyncingSettings = searchParams.get('syncsettings') === '1';

  useEffect(() => {
    if (isSyncingSettings && currentUser) {
      const timer = setTimeout(() => {
        try {
          syncSettingsFromUser(currentUser);
        } catch (e) {
          console.warn("syncSettingsFromUser failed:", e);
        }

        // Remove syncsettings=1 from URL query parameters and redirect if needed
        const newParams = new URLSearchParams(location.search);
        newParams.delete('syncsettings');
        const redirectUrl = newParams.get('redirect');

        if (redirectUrl && redirectUrl.startsWith('/')) {
          newParams.delete('redirect');
          const searchStr = newParams.toString();
          const target = redirectUrl + (searchStr ? `?${searchStr}` : '');
          navigate(target, { replace: true });
        } else {
          const searchStr = newParams.toString();
          const target = location.pathname + (searchStr ? `?${searchStr}` : '');
          navigate(target, { replace: true });
        }
      }, 1200); // 1.2s delay for a premium transition look

      return () => clearTimeout(timer);
    }
  }, [isSyncingSettings, currentUser, location.pathname, location.search, navigate]);

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

    // Don't show toast notifications for admin users
    if (currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
      return;
    }

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
            const res = await authenticatedFetch(`${API_BASE_URL}/api/user/check-email/${encodeURIComponent(data.comment.senderEmail)}`);

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
        try { playNotification(); } catch (_) { }

        toast.info(`New message from ${senderName}`, {
          onClick: () => {
            navigate(`/user/my-appointments/chat/${data.appointmentId}?chatopen=true`, { replace: false });
          },
          autoClose: 5000,
          closeOnClick: true,
          pauseOnHover: false
        });
      }
    };

    const handlePreBookingMessage = (data) => {
      // Ignore own messages
      if (data.senderId === currentUser._id) return;

      const getAnonymizedName = (userId) => {
        if (!userId) return "Anonymous User";
        const FANTASY_NAMES = [
          "Urban Explorer", "Dream Home Seeker", "City Dweller", "Property Enthusiast",
          "Skyline Admirer", "Metro Nomad", "Estate Visionary", "Loft Lover",
          "Home Hunter", "Space Scout", "Modern Resident", "Vibrant Villager",
          "Cosmo Dweller", "Suburban Soul", "Downtown Dreamer", "Penthouse Pro",
          "Cottage Core", "Villa Visionary", "Duplex Diver", "Studio Star",
          "Bungalow Buff", "Mansion Master", "Terrace Traveler", "Garden Guru",
          "Balcony Boss", "High-Rise Hero", "Community Connector", "Neighborhood Nomad",
          "Street Smart", "Avenue Ace", "Lane Leader", "Boulevard Baron",
          "Plaza Pioneer", "Square Scout", "District Diver", "Zone Zealot",
          "Quarter Quest", "Sector Seeker", "Block Buster", "Estate Expert",
          "Harbor Hero", "River Resident", "Lake Lover", "Mountain Mover",
          "Valley Voyager", "Cloud Chaser", "Star Gazer", "Horizon Hunter",
          "Dawn Dreamer", "Dusk Dweller"
        ];
        const hexSuffix = userId.substring(userId.length - 8);
        const index = parseInt(hexSuffix, 16) % FANTASY_NAMES.length;
        const suffix = userId.substring(userId.length - 4);
        return `${FANTASY_NAMES[index]} (${suffix})`;
      };

      // Determine sender name based on role and anonymity guidelines
      const isRecipientOwner = data.ownerId && currentUser._id === data.ownerId;
      const displaySenderName = isRecipientOwner
        ? getAnonymizedName(data.senderId)
        : "Property Owner";

      try { playNotification(); } catch (_) { }

      toast.info(`New message from ${displaySenderName}`, {
        onClick: () => {
          navigate(`/listing/${data.listingId}?openChat=true`);
        },
        autoClose: 5000,
        closeOnClick: true,
        pauseOnHover: false
      });
    };

    socket.on('pre_booking_message', handlePreBookingMessage);
    socket.on('commentUpdate', handleNewMessage);

    // Handle new notifications with sound and toast
    const handleNewNotification = (notification) => {
      if (!currentUser || notification.userId !== currentUser._id) return;

      // Play notification sound
      try {
        const audio = new Audio('/assets/sounds/notification.mp3');
        audio.volume = 0.7; // Set volume to 70%
        audio.play().catch(err => {
          console.log('Could not play notification sound:', err);
        });
      } catch (err) {
        console.log('Could not play notification sound:', err);
      }

      // Show toast notification
      toast.info(notification.message || notification.title || 'New notification', {
        autoClose: 5000,
        closeOnClick: true,
        pauseOnHover: false,
      });
    };

    socket.on('notificationCreated', handleNewNotification);
    socket.on('watchlistNotification', handleNewNotification);

    return () => {
      socket.off('pre_booking_message', handlePreBookingMessage);
      socket.off('commentUpdate', handleNewMessage);
      socket.off('notificationCreated', handleNewNotification);
      socket.off('watchlistNotification', handleNewNotification);
    };
  }, [dispatch, navigate, currentUser, playNotification, currentlyOpenChat]);

  // Periodic session check (every 30 seconds)
  useEffect(() => {
    if (!currentUser) return; // Only run if user is logged in
    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const sessionId = localStorage.getItem('sessionId');
        const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/verify`);

        // Handle Account Suspension (403) eagerly for security
        if (res.status === 403) {
          try {
            const data = await res.clone().json();
            if (data.message && data.message.toLowerCase().includes("suspended")) {
              dispatch(signoutUserSuccess());
              toast.error(data.message || "Your account has been suspended. You have been signed out.");
              navigate("/sign-in");
            }
          } catch (e) { }
        }

        // NOTE: We intentionally DO NOT handle 401 (Session Expired) here to prevent 
        // interrupting the user's workflow (e.g. while typing). 
        // If the session is truly dead, their next interaction will naturally fail 
        // and redirect them, or they can refresh manually.

      } catch (e) {
        // Network errors or other issues - ignore silently
      }
    }, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [dispatch, navigate, currentUser]);

  // Show loader while checking session
  if (!bootstrapped || !sessionChecked || checkingTransferUser) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <NetworkStatus />

      {/* Upcoming Maintenance Banner */}
      {upcomingConfig && upcomingConfig.enabled && !isBannerDismissed && (
        <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 dark:from-amber-900/95 dark:via-amber-950/95 dark:to-orange-950/95 text-white text-center py-2.5 px-4 text-xs font-semibold flex items-center justify-between gap-3 shadow-md relative z-[9999] border-b border-amber-600/30 transition-all duration-300 animate-slideDown">
          <div className="flex-1 flex items-center justify-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="font-bold tracking-wide uppercase bg-amber-650/45 dark:bg-amber-900/50 px-2 py-0.5 rounded text-[10px] mr-1.5 border border-amber-500/30">
              Upcoming Maintenance
            </span>
            <span className="text-amber-100 font-medium">
              {renderMessage(upcomingConfig.message)}
            </span>
          </div>
          <button 
            onClick={handleDismissBanner}
            className="text-amber-300 hover:text-white transition-colors duration-200 p-1 hover:bg-white/10 rounded-full"
            title="Dismiss notice"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Settings Syncing Loader Overlay */}
      {isSyncingSettings && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-fadeIn animate-duration-200">
          <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full filter blur-2xl"></div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full filter blur-2xl"></div>

            {/* Spinner */}
            <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <UrbanSetuSpinner size="lg" className="!w-full !h-full" isBright={true} />
              <div className="absolute inset-0 flex items-center justify-center">
                <FaHome className="text-2xl text-blue-500 animate-pulse" />
              </div>
            </div>

            <h2 className="text-xl font-black text-white mb-2">Syncing Settings</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Applying your personalized settings and preferences...
            </p>
          </div>
        </div>
      )}

      {/* Session Transfer Confirmation Modal */}
      {pendingTransfer && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn animate-duration-200">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full filter blur-2xl"></div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full filter blur-2xl"></div>

            {/* Icon */}
            <div className="mx-auto w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mb-6 animate-pulse">
              <FaServer className="text-3xl text-blue-500" />
            </div>

            <h2 className="text-2xl font-black text-white mb-3">Switch Session?</h2>
            
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              A session transfer was requested from a backup server. You are already logged in on this device.
            </p>

            {/* Side-by-Side User Comparison with Avatars */}
            <div className="flex items-center justify-between gap-4 bg-slate-950/40 border border-slate-800/80 rounded-2xl p-6 mb-8">
              {/* Current user */}
              <div className="flex flex-col items-center flex-1 min-w-0 text-center">
                <UserAvatar user={pendingTransfer.currentUser} size="w-16 h-16" textSize="text-lg" showBorder={true} className="border-2 border-slate-700 shadow-md" />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-3">Current User</span>
                <span className="text-sm font-bold text-white truncate max-w-full mt-1">
                  {pendingTransfer.currentUser.username || 'Active User'}
                </span>
                <span className="text-[11px] text-slate-400 truncate max-w-full mt-0.5">
                  {pendingTransfer.currentUser.email}
                </span>
              </div>

              {/* Transition arrow */}
              <div className="flex flex-col items-center justify-center text-blue-500 animate-pulse">
                <FaArrowRight className="text-xl" />
              </div>

              {/* Incoming user */}
              <div className="flex flex-col items-center flex-1 min-w-0 text-center">
                <UserAvatar user={pendingTransfer.newUser} size="w-16 h-16" textSize="text-lg" showBorder={true} className="border-2 border-blue-500 shadow-md animate-pulse" />
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mt-3">New Session</span>
                <span className="text-sm font-black text-white truncate max-w-full mt-1">
                  {pendingTransfer.newUser.username || 'New User'}
                </span>
                <span className="text-[11px] text-blue-300 truncate max-w-full mt-0.5">
                  {pendingTransfer.newUser.email}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleConfirmTransfer}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Switch to New Session</span>
                <FaArrowRight className="text-xs" />
              </button>

              <button
                onClick={handleCancelTransfer}
                className="w-full py-3 px-4 bg-transparent border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 active:scale-[0.98] hover:border-slate-700"
              >
                <span>Keep Current Session</span>
              </button>
            </div>
          </div>
        </div>
      )}
      <CookieConsent />
      <VisitorTracker />
      <GoogleOneTap />
      <SitemapNav />
      {!hideHeaderRoutes.includes(location.pathname) && !location.pathname.includes('/year/') && isHeaderVisible && (
        currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')
          ? <AdminHeader />
          : <Header />
      )}

      <Suspense fallback={<LoadingSpinner />}>
        <NormalizeRoute>
          <Routes>
            {/* Public Routes */}
            {/* Universal Help Center Routes - Accessible by everyone */}
            <Route path="/help-center" element={currentUser ? <Navigate to={currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? "/admin/help-center" : "/user/help-center"} /> : <HelpCenter />} />
            {/* Note: extraction of param is tricky in Navigate, simpler to just let user route handle it if path matches pattern */}
            {/* But since we need to redirect PUBLIC /help-center/article/X to /user/help-center/article/X, we can't easily access :slug in render prop unless we wrap it */}
            {/* Simpler approach: Make HelpCenter component handle the redirect if mounted on public route with auth? No, typically App.jsx handles it. */}
            {/* Let's use a wrapper component for the redirect to extract params correctly */}
            <Route path="/help-center/article/:slug" element={<ArticleViewRedirect />} />
            <Route path="/error-codes" element={currentUser ? <Navigate to={(currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? "/admin/error-codes" : "/user/error-codes"} /> : <ErrorCodes />} />
            <Route path="/" element={<PublicHome bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
            <Route path="/home" element={<PublicHome bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
            <Route path="/about" element={currentUser ? <Navigate to="/user/about" /> : <PublicAbout bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
            <Route path="/blogs" element={currentUser ? <Navigate to="/user/blogs" /> : <PublicBlogs bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
            <Route path="/blog/:slug" element={currentUser ? <BlogRedirect /> : <PublicBlogDetail bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
            <Route path="/guides" element={currentUser ? <Navigate to="/user/guides" /> : <PublicGuides bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
            <Route path="/guide/:slug" element={currentUser ? <BlogRedirect /> : <PublicBlogDetail bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
            <Route path="/faqs" element={currentUser ? <Navigate to="/user/faqs" /> : <PublicFAQs bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
            <Route path="/search" element={currentUser ? <Navigate to="/user/search" /> : <PublicSearch bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
            <Route path="/listing/:listingId" element={currentUser ? <NotFound /> : <Listing />} />
            <Route path="/sign-in" element={<SignIn bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
            <Route path="/sign-up" element={<SignUp bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
            <Route path="/forgot-password" element={<ForgotPassword bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
            <Route path="/oauth" element={<Oauth bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
            <Route path="/terms" element={currentUser ? <NotFound /> : <Terms bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
            <Route path="/privacy" element={currentUser ? <NotFound /> : <Privacy bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
            <Route path="/cookie-policy" element={currentUser ? <NotFound /> : <CookiePolicy />} />
            <Route path="/contact" element={currentUser ? <Navigate to="/user/contact" /> : <Contact />} />
            <Route path="/ai" element={currentUser ? <Navigate to="/user/ai" /> : <PublicAI />} />
            <Route path="/community" element={currentUser ? <Navigate to="/user/community" /> : <Community />} />
            <Route path="/community/post/:postId" element={currentUser ? <Navigate to="/user/community" /> : <Community />} />
            <Route path="/community-guidelines" element={currentUser ? <NotFound /> : <CommunityGuidelines />} />
            <Route path="/restore-account/:token" element={<AccountRevocation />} />
            <Route path="/account-conflict" element={<AccountConflictResolution />} />
            <Route path="/restore-property" element={<RestoreProperty />} />

            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/updates" element={<Updates />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="/ai/share/:shareToken" element={<SharedChatView />} />
            <Route path="/v/:token" element={<VideoEmbed />} />
            <Route path="/i/:token" element={<ImageEmbed />} />
            <Route path="/view/:documentId" element={<ViewDocument />} />
            <Route path="/security/lock-account/:token" element={<LockAccount />} />
            <Route path="/security/unlock-account/:token" element={<UnlockAccount />} />
            <Route path="/download" element={currentUser ? <Navigate to={currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? "/admin/download" : "/user/download"} /> : <Downloads />} />

            {/* Agent Routes (Public) */}
            <Route path="/agents" element={<FindAgent />} />
            <Route path="/agents/:id" element={<AgentProfile />} />

            <Route path="/market-trends" element={currentUser ? <Navigate to={currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? "/admin/market-trends" : "/user/market-trends"} /> : <MarketTrends />} />

            {/* User Routes (Protected) */}
            <Route element={<Private bootstrapped={bootstrapped} />}>
              <Route path="/user" element={<Home />} />
              <Route path="/user/home" element={<Home />} />
              <Route path="/user/about" element={<About />} />
              <Route path="/user/blogs" element={<PublicBlogs bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
              <Route path="/user/blog/:slug" element={<PublicBlogDetail bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
              <Route path="/user/guides" element={<PublicGuides bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
              <Route path="/user/guide/:slug" element={<PublicBlogDetail bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
              <Route path="/user/faqs" element={<PublicFAQs bootstrapped={bootstrapped} sessionChecked={sessionChecked} />} />
              <Route path="/user/search" element={<Search />} />
              <Route path="/user/profile" element={<Profile />} />
              <Route path="/user/create-listing" element={<CreateListing />} />
              <Route path='/user/update-listing/:listingId' element={<EditListing />} />
              <Route path="/user/listing/:listingId" element={<Listing key={location.pathname} />} />
              <Route path="/user/rent-property" element={<RentProperty />} />
              <Route path="/user/rent-wallet" element={<RentWallet />} />
              <Route path="/user/rental-contracts" element={<RentalContracts />} />
              <Route path="/user/pay-monthly-rent" element={<PayMonthlyRent />} />
              <Route path="/user/disputes" element={<DisputeResolution />} />
              <Route path="/user/property-verification" element={<PropertyVerification />} />
              <Route path="/user/rental-ratings" element={<RentalRatings />} />
              <Route path="/user/rental-loans" element={<RentalLoans />} />
              <Route path="/user/wishlist" element={<WishList />} />
              <Route path="/user/watchlist" element={<Watchlist />} />
              <Route path="/user/appointment" element={<Appointment />} />
              <Route path="/user/my-appointments" element={<MyAppointments />} />
              <Route path="/user/my-appointments/chat/:chatId" element={<MyAppointments />} />
              <Route path="/user/call-history" element={<CallHistory />} />
              <Route path="/user/my-payments" element={<MyPayments />} />
              <Route path="/user/my-listings" element={<MyListings />} />
              <Route path="/user/deleted-listings" element={<MyDeletedListings />} />
              <Route path="/user/services" element={<OnDemandServices />} />
              <Route path="/user/route-planner" element={<RoutePlanner />} />
              <Route path="/user/change-password" element={<UserChangePassword />} />
              <Route path="/user/terms" element={<UserTerms />} />
              <Route path="/user/privacy" element={<UserPrivacy />} />
              <Route path="/user/cookie-policy" element={<UserCookiePolicy />} />
              <Route path="/user/community-guidelines" element={<CommunityGuidelines />} />
              <Route path="/user/reviews" element={<UserReviews />} />
              <Route path="/user/device-management" element={<DeviceManagement />} />
              <Route path="/user/contact" element={<UserContact />} />
              <Route path="/user/ai" element={<UserAI />} />
              <Route path="/user/ai/share/:shareToken" element={<SharedChatView />} />
              <Route path="/user/investment-tools" element={<InvestmentTools />} />
              <Route path="/user/settings" element={<Settings />} />
              <Route path="/user/view/:documentId" element={<ViewDocument />} />
              <Route path="/user/view-chat/preview" element={<ViewChatDocument />} />
              <Route path="/user/community" element={<Community />} />
              <Route path="/user/community/post/:postId" element={<Community />} />
              <Route path="/user/rewards" element={<Rewards />} />
              <Route path="/user/leaderboard" element={<Leaderboard />} />
              <Route path="/user/year/:year" element={<YearInReview />} />
              <Route path="/user/updates" element={<Updates />} />
              <Route path="/user/download" element={<Downloads />} />
              <Route path="/user/help-center" element={<HelpCenter />} />
              <Route path="/user/help-center/article/:slug" element={<ArticleView />} />
              <Route path="/user/error-codes" element={<ErrorCodes />} />
              <Route path="/user/reminders" element={<RemindersPage />} />
              <Route path="/user/agents" element={<FindAgent />} />
              <Route path="/user/agents/:id" element={<AgentProfile />} />
              <Route path="/user/market-trends" element={<MarketTrends />} />
              <Route path="/agent/dashboard" element={<AgentDashboard />} />
              <Route path="/user/become-an-agent" element={<BecomeAgent />} />

              <Route path="/contact" element={<Navigate to="/user/contact" />} />
              <Route path="/admin/contact" element={<Navigate to="/user/contact" />} />
              <Route path="/ai" element={<Navigate to="/user/ai" />} />
            </Route>

            {/* Admin Routes */}
            <Route element={<AdminRoute bootstrapped={bootstrapped} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/client-errors" element={<ClientErrorMonitoring />} />
              <Route path="/admin/appointments" element={<AdminAppointments />} />
              <Route path="/admin/appointments/chat/:chatId" element={<AdminAppointments />} />
              <Route path="/admin/call-history" element={<AdminCallHistory />} />
              <Route path="/admin/about" element={<AdminAbout />} />
              <Route path="/admin/blogs" element={<AdminBlogs type="blog" />} />
              <Route path="/admin/guides" element={<AdminBlogs type="guide" />} />
              <Route path="/admin/blog/:slug" element={<AdminBlogDetail />} />
              <Route path="/admin/guide/:slug" element={<AdminBlogDetail />} />
              <Route path="/admin/faqs" element={<AdminFAQs />} />
              <Route path="/admin/explore" element={<AdminExplore />} />
              <Route path="/admin/create-listing" element={<AdminCreateListing />} />
              <Route path="/admin/listings" element={<AdminListings />} />
              <Route path="/admin/deleted-listings" element={<AdminDeletedListings />} />
              <Route path="/admin/my-listings" element={<AdminMyListings />} />
              <Route path="/admin/update-listing/:listingId" element={<AdminEditListing />} />
              {/* Admin wishlist removed */}
              <Route path="/admin/profile" element={<AdminProfile />} />
              <Route path="/admin/deployment-management" element={<AdminDeploymentManagement />} />
              <Route path="/admin/change-password" element={<AdminChangePassword />} />
              <Route path="/admin/requests" element={<AdminRequests />} />
              <Route path="/admin/listing/:listingId" element={<Listing key={location.pathname} />} />
              <Route path="/admin/appointmentlisting" element={<AdminAppointmentListing />} />
              <Route path="/admin/terms" element={<AdminTerms />} />
              <Route path="/admin/privacy" element={<AdminPrivacy />} />
              <Route path="/admin/cookie-policy" element={<AdminCookiePolicy />} />
              <Route path="/admin/community-guidelines" element={<CommunityGuidelines />} />
              <Route path="/admin/updates" element={<AdminUpdates />} />
              <Route path="/admin/agents" element={<AdminAgents />} />
              <Route path="/admin/agents/:id" element={<AgentProfile />} />
              <Route path="/admin/help-center" element={<AdminHelpCenter />} />
              <Route path="/admin/management" element={<AdminManagement />} />
              <Route path="/admin/download" element={<Downloads />} />
              <Route path="/admin/reviews" element={<AdminReviews />} />
              <Route path="/admin/services" element={<AdminServices />} />
              <Route path="/admin/route-planner" element={<RoutePlannerAdmin />} />
              <Route path="/admin/fraudmanagement" element={<AdminFraudManagement />} />
              <Route path="/admin/payments" element={<PaymentDashboard />} />
              <Route path="/admin/security-moderation" element={<AdminSecurityModeration />} />
              <Route path="/admin/device-management" element={<DeviceManagement />} />
              <Route path="/admin/session-management" element={<SessionManagement />} />
              <Route path="/admin/session-audit-logs" element={<SessionAuditLogs />} />
              <Route path="/admin/marketing-intelligence" element={<AdminSponsorIntelligence />} />
              <Route path="/admin/security-intelligence" element={<SecurityIntelligence />} />
              <Route path="/admin/support" element={<AdminSupport />} />
              <Route path="/admin/ai" element={<AdminAI />} />
              <Route path="/admin/ai/share/:shareToken" element={<SharedChatView />} />
              <Route path="/admin/investment-tools" element={<InvestmentTools />} />
              <Route path="/admin/property-verification" element={<AdminPropertyVerification />} />
              <Route path="/admin/rental-ratings" element={<AdminRentalRatings />} />
              <Route path="/admin/rental-contracts" element={<AdminRentalContracts />} />
              <Route path="/admin/rent-wallet" element={<AdminRentWallet />} />
              <Route path="/admin/rental-loans" element={<AdminRentalLoans />} />
              <Route path="/admin/disputes" element={<AdminDisputeResolution />} />
              <Route path="/admin/coin-stats" element={<AdminCoinStats />} />
              <Route path="/admin/audit-trail" element={<AdminAuditTrail />} />
              <Route path="/admin/sentinel" element={<AdminSentinelDashboard />} />
              <Route path="/admin/year/:year" element={<YearInReview isAdmin={true} />} />
              <Route path="/admin/settings" element={<Settings />} />
              <Route path="/admin/reminders" element={<RemindersPage />} />
              <Route path="/admin/view/:documentId" element={<ViewDocument />} />
              <Route path="/admin/view/preview" element={<ViewDocument />} />
              <Route path="/admin/view-chat/preview" element={<ViewChatDocument />} />
              <Route path="/admin/community" element={<AdminCommunity />} />
              <Route path="/admin/community/post/:postId" element={<AdminCommunity />} />
              <Route path="/admin/setu-coins" element={<AdminCoinStats />} />
              <Route path="/admin/leaderboard" element={<Leaderboard isAdmin={true} />} />
              <Route path="/contact" element={<Navigate to="/admin/support" />} />
              <Route path="/support" element={<Navigate to="/admin/support" />} />
              <Route path="/user/contact" element={<Navigate to="/admin/support" />} />
              <Route path="/user/support" element={<Navigate to="/admin/support" />} />
              <Route path="/ai" element={<Navigate to="/admin/ai" />} />
              <Route path="/user/ai" element={<Navigate to="/admin/ai" />} />
              <Route path="/admin/help-center" element={<AdminHelpCenter />} />
              <Route path="/admin/error-codes" element={<ErrorCodes />} />
              <Route path="/admin/market-trends" element={<MarketTrends />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </NormalizeRoute>
      </Suspense>
      {!shouldHideFooter && <Footer />}
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
      {/* Global Call Modals - Shows on any page */}
      <GlobalCallModals />
      <MediaPreviewGlobal />
      <GlobalReminderListener />

      {/* Global Signout Loading Modal */}
      {isSigningOut && (
        <SignoutModal />
      )}
    </>
  );
}

import MaintenancePage from "./pages/MaintenancePage";

export default function App({ bootstrapped }) {
  const [maintenanceConfig, setMaintenanceConfig] = useState(null);
  const [upcomingConfig, setUpcomingConfig] = useState(null);
  const [isCheckingMaintenance, setIsCheckingMaintenance] = useState(true);

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL || '';
        const res = await fetch(`${apiBase}/api/config`);
        if (res.ok) {
          const responseJson = await res.json();
          if (responseJson && responseJson.success && responseJson.data) {
            const config = responseJson.data;
            if (config.maintenance) {
              setMaintenanceConfig(config.maintenance);
            } else {
              setMaintenanceConfig({ enabled: false });
            }
            if (config.upcomingMaintenance) {
              setUpcomingConfig(config.upcomingMaintenance);
            }
          }
        } else {
          setMaintenanceConfig({ enabled: false });
        }
      } catch (err) {
        console.warn('Failed to check server maintenance status:', err);
        setMaintenanceConfig({ enabled: false });
      } finally {
        setIsCheckingMaintenance(false);
      }
    };
    checkMaintenance();
  }, []);

  if (isCheckingMaintenance) {
    return <LoadingSpinner />;
  }

  if (maintenanceConfig && maintenanceConfig.enabled) {
    return <MaintenancePage config={maintenanceConfig} onRetry={() => window.location.reload()} />;
  }

  return (
    <WishlistProvider>
      <ImageFavoritesProvider>
        <HeaderProvider>
          <CallProvider>
            <BrowserRouter>
              <AppRoutes bootstrapped={bootstrapped} upcomingConfig={upcomingConfig} />
            </BrowserRouter>
          </CallProvider>
        </HeaderProvider>
      </ImageFavoritesProvider>
    </WishlistProvider>
  );
}