import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useEffect, Suspense, lazy, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { verifyAuthStart, verifyAuthSuccess, verifyAuthFailure, signoutUserSuccess } from "./redux/user/userSlice.js";
import Header from './components/Header';
import AdminHeader from './components/AdminHeader';
import Private from "./components/Private";
import AdminRoute from "./components/AdminRoute";
import WishlistProvider from "./WishlistContext";
import ContactSupportWrapper from "./components/ContactSupportWrapper";
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

function AppRoutes({ bootstrapped }) {
  const location = useLocation();
  const dispatch = useDispatch();
  const { currentUser } = useSelector((state) => state.user);

  // Verify authentication on app startup
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        dispatch(verifyAuthStart());
        const res = await fetch('/api/auth/verify');
        const data = await res.json();
        
        if (data.success === false) {
          dispatch(verifyAuthFailure(data.message));
          dispatch(signoutUserSuccess());
          return;
        }
        
        dispatch(verifyAuthSuccess(data));
      } catch (error) {
        dispatch(verifyAuthFailure(error.message));
        dispatch(signoutUserSuccess());
      }
    };

    if (bootstrapped) {
      verifyAuth();
    }
  }, [bootstrapped, dispatch]);

  // Do not show header on /appointments admin route
  const hideHeaderRoutes = ["/appointments"];

  if (!bootstrapped) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {!hideHeaderRoutes.includes(location.pathname) && (
        currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')
          ? <AdminHeader />
          : <Header />
      )}

      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={currentUser ? <NotFound /> : <PublicHome />} />
          <Route path="/home" element={currentUser ? <NotFound /> : <PublicHome />} />
          <Route path="/about" element={currentUser ? <Navigate to="/user/about" /> : <PublicAbout />} />
          <Route path="/search" element={currentUser ? <Navigate to="/user/search" /> : <PublicSearch />} />
          <Route path="/listing/:listingId" element={currentUser ? <NotFound /> : <Listing />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/sign-up" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/oauth" element={<Oauth />} />
          <Route path="/terms" element={currentUser ? <NotFound /> : <Terms />} />
          <Route path="/privacy" element={currentUser ? <NotFound /> : <Privacy />} />

          {/* User Routes (Protected) */}
          <Route element={<Private bootstrapped={bootstrapped} />}>
            <Route path="/user" element={<Home />} />
            <Route path="/user/home" element={<Home />} />
            <Route path="/user/about" element={<About />} />
            <Route path="/user/search" element={<Search />} />
            <Route path="/user/profile" element={<Profile />} />
            <Route path="/user/create-listing" element={<CreateListing />} />
            <Route path='/user/update-listing/:listingId' element={<EditListing />} />
            <Route path="/user/listing/:listingId" element={<Listing />} />
            <Route path="/user/wishlist" element={<WishList />} />
            <Route path="/user/appointment" element={<Appointment />} />
            <Route path="/user/my-appointments" element={<MyAppointments />} />
            <Route path="/user/my-listings" element={<MyListings />} />
            <Route path="/user/change-password" element={<UserChangePassword />} />
            <Route path="/user/terms" element={<UserTerms />} />
            <Route path="/user/privacy" element={<UserPrivacy />} />
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
            <Route path="/admin/listing/:listingId" element={<Listing />} />
            <Route path="/admin/appointmentlisting" element={<AdminAppointmentListing />} />
            <Route path="/admin/terms" element={<AdminTerms />} />
            <Route path="/admin/privacy" element={<AdminPrivacy />} />
            <Route path="/admin/management" element={<AdminManagement />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <ToastContainer position="top-center" autoClose={3000} hideProgressBar newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover />
    </>
  );
}

export default function App() {
  const dispatch = useDispatch();
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/verify");
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
