import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Search, Home, ArrowLeft } from "lucide-react";
import duckImg from "../assets/duck-go-final.gif";
import duckDarkImg from "../assets/duck-go.gif";
import SEO from "../components/SEO";
import { usePageTitle } from '../hooks/usePageTitle';
import ListingItem from "../components/ListingItem";
import { FaRobot, FaRocket, FaArrowRight, FaChartLine } from "react-icons/fa";
import { getLiveRecommendations } from "../utils/sentinelLiveEngine";
import { authenticatedFetch } from "../utils/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function NotFound() {
  // Set page title
  usePageTitle("Page Not Found");
  const navigate = useNavigate();

  const { currentUser } = useSelector((state) => state.user);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleRecsCount, setVisibleRecsCount] = useState(4);
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fetchListings = async () => {
      // Hide recommendations for admins
      if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) {
        setLoading(false);
        setRecommendations([]);
        return;
      }

      try {
        setLoading(true);
        // Fetch public listings (High limit for better "Infinite" recommendations)
        const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/get?limit=100&visibility=public`);
        if (!res.ok) return;
        const data = await res.json();
        const listings = Array.isArray(data) ? data : (data?.listings || []);

        if (currentUser) {
          // Sentinel Live: Use TensorFlow-based session analysis for regular users
          // Fetch user preferences (Wishlist/Watchlist) for enhanced recommendations
          let userPreferences = [];
          try {
            const [wishRes, watchRes] = await Promise.all([
              authenticatedFetch(`${API_BASE_URL}/api/wishlist/user/${currentUser._id}`),
              authenticatedFetch(`${API_BASE_URL}/api/watchlist/user/${currentUser._id}`)
            ]);
            const wishData = wishRes.ok ? await wishRes.json() : [];
            const watchData = watchRes.ok ? await watchRes.json() : [];
            const wishItems = Array.isArray(wishData) ? wishData.filter(x => x.listingId).map(x => x.listingId) : [];
            const watchItems = Array.isArray(watchData) ? watchData.filter(x => x.listingId).map(x => x.listingId) : [];
            userPreferences = [...wishItems, ...watchItems];
          } catch (e) {
            console.error("Error fetching user preferences:", e);
          }

          // Filter out own properties
          const validListings = listings.filter(l =>
            l.userRef !== currentUser._id &&
            l.sellerId !== currentUser._id
          );

          // Get all matches (limit 1000)
          const recs = await getLiveRecommendations(validListings, 1000, userPreferences);
          if (recs.length > 0) {
            setRecommendations(recs);
          } else {
            // Fallback if no session history
            setRecommendations(listings.sort(() => 0.5 - Math.random()).slice(0, 4));
          }
        } else {
          // Public users: Randomize
          setRecommendations(listings.sort(() => 0.5 - Math.random()).slice(0, 4));
        }
      } catch (error) {
        console.error("404 Page: Failed to fetch listings", error);
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, [currentUser]);

  let homePath = "/";
  if (currentUser) {
    if (currentUser.role === "admin" || currentUser.role === "rootadmin") {
      homePath = "/admin";
    } else {
      homePath = "/user";
    }
  }

  let explorePath = "/search";
  if (currentUser) {
    if (currentUser.role === "admin" || currentUser.role === "rootadmin") {
      explorePath = "/admin/explore";
    } else {
      explorePath = "/user/search";
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 relative overflow-x-hidden p-6 py-12 lg:py-20">
      <SEO title="404 Page Not Found - UrbanSetu" noindex={true} nofollow={true} />
      {/* Dynamic Background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[10%] left-[20%] w-72 h-72 bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-[100px] animate-blob"></div>
        <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-purple-400/20 dark:bg-purple-600/10 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
        <div className="absolute top-[40%] left-[60%] w-64 h-64 bg-pink-400/20 dark:bg-pink-600/10 rounded-full blur-[100px] animate-blob animation-delay-4000"></div>
      </div>

      {/* Content Card */}
      <div className="flex flex-col items-center gap-12 relative z-10 w-full max-w-7xl mx-auto">
        {/* Content Card */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/50 dark:border-gray-700/50 rounded-3xl shadow-2xl p-8 md:p-12 max-w-2xl w-full text-center animate-fade-in-up">
          {/* ... existing content ... */}
          <div className="relative w-48 h-48 mx-auto mb-8">
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full animate-pulse-soft"></div>
            <img
              src={isDark ? duckDarkImg : duckImg}
              alt="Lost Explorer"
              className={`w-full h-full object-contain relative z-10 drop-shadow-xl hover:scale-105 transition-transform duration-300 ${isDark ? 'mix-blend-screen' : ''}`}
            />
          </div>

          <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 mb-4 tracking-tighter">
            404
          </h1>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Oops! You've gone off the map.
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-md mx-auto leading-relaxed">
            The page you're searching for seems to have moved, been deleted, or never existed in the first place. Let's get you back on track.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 transition-all flex items-center justify-center gap-2 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Go Back
            </button>

            <Link
              to={homePath}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 text-white font-semibold shadow-lg shadow-blue-500/30 dark:shadow-blue-900/40 hover:shadow-blue-500/50 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Return Home
            </Link>
          </div>

          <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-700 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Need help finding your way?{" "}
              <Link to="/help-center" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium hover:underline">
                Visit our Help Center
              </Link>
            </p>
          </div>
        </div>

        {/* Dynamic Property Recommendations Section */}
        {!loading && recommendations.length > 0 && (
          <div className="w-full animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <div className="relative overflow-hidden p-1 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10 rounded-[2.5rem]">
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-8 rounded-[2.4rem] border border-white/50 dark:border-gray-700/50 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                      <span className="p-2 bg-blue-600 text-white rounded-xl shadow-lg ring-4 ring-blue-50 dark:ring-blue-900/10">
                        {currentUser ? <FaRobot className="animate-pulse" /> : <FaRocket className="animate-bounce" />}
                      </span>
                      {currentUser ? "Sentinel Live" : "Explore Properties"}
                    </h2>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-full w-fit">
                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                          {currentUser ? "RECOMMENDING BASED ON YOUR CURRENT SESSION" : "HANDPICKED RECOMMENDATIONS"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-1 font-medium italic">
                        {currentUser ? "Tensor-mode active" : "Real-time updates"}
                      </p>
                    </div>
                  </div>
                  <Link
                    to={explorePath}
                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold hover:text-blue-700 dark:hover:text-blue-300 transition-all hover:translate-x-1"
                  >
                    View All <FaArrowRight />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {recommendations.slice(0, visibleRecsCount).map((listing) => (
                    <div key={`rec-${listing._id}`} className="relative group overflow-visible">
                      {listing.isLiveMatch && (
                        <div className="absolute -top-2 -right-2 z-20 bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg transform rotate-12 group-hover:rotate-0 transition-transform">
                          {Math.round(listing.sentinelScore * 100)}% MATCH
                        </div>
                      )}
                      <ListingItem listing={listing} />
                    </div>
                  ))}
                </div>

                {recommendations.length > visibleRecsCount && (
                  <div className="mt-8 text-center">
                    <button
                      onClick={() => setVisibleRecsCount(prev => prev + 4)}
                      className="px-6 py-3 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 font-bold rounded-xl shadow-lg border border-blue-100 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all transform hover:scale-105 flex items-center gap-2 mx-auto"
                    >
                      View More Recommendations <FaArrowRight />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Simple Footer Links */}
        <div className="text-center pb-10">
          <div className="flex flex-wrap justify-center gap-6 text-sm font-semibold text-blue-600 dark:text-blue-400">
            <Link to="/about" className="hover:text-blue-700 dark:hover:text-blue-300 hover:underline">About Us</Link>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <Link to="/contact" className="hover:text-blue-700 dark:hover:text-blue-300 hover:underline">Contact Support</Link>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <Link to={explorePath} className="hover:text-blue-700 dark:hover:text-blue-300 hover:underline flex items-center gap-1">
              <Search className="w-3 h-3" /> Search Properties
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}