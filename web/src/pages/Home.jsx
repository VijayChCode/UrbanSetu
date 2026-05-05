import React, { useEffect, useState, useRef } from "react";
import HomeSkeleton from "../components/skeletons/HomeSkeleton";
import { Link, useNavigate } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, EffectFade } from "swiper/modules";
import "swiper/css/bundle";
import "swiper/css/effect-fade";
import "swiper/css/pagination";
import ListingItem from "../components/ListingItem";
import { useSelector } from "react-redux";
import EncryptedText from "../components/ui/EncryptedText";
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import GeminiAIWrapper from "../components/GeminiAIWrapper";
import { usePageTitle } from '../hooks/usePageTitle';
import Typewriter from "../components/ui/Typewriter";
import { FaEye, FaCalendarAlt, FaListAlt, FaBell, FaCommentDots, FaArrowDown, FaSearch, FaHome, FaHeart, FaStar, FaMapMarkerAlt, FaPhone, FaEnvelope, FaShieldAlt, FaAward, FaUsers, FaChartLine, FaLightbulb, FaRocket, FaGem, FaQuoteLeft, FaQuoteRight, FaCheckCircle, FaClock, FaHandshake, FaGlobe, FaMobile, FaDesktop, FaTablet, FaInfoCircle, FaArrowRight, FaRobot } from "react-icons/fa";
import SeasonalEffects from "../components/SeasonalEffects";
import DailyQuote from "../components/DailyQuote";
import { useSeasonalTheme, useAllSeasonalThemes } from "../hooks/useSeasonalTheme";
import ThemeDetailModal from "../components/ThemeDetailModal";
import { authenticatedFetch } from "../utils/auth";
import { getLiveRecommendations, getInteractionHistory } from "../utils/sentinelLiveEngine";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function Home() {
  const theme = useSeasonalTheme();
  const allThemes = useAllSeasonalThemes();
  // Set page title
  usePageTitle("Dashboard - Find Your Dream Home");

  const { currentUser } = useSelector((state) => state.user);
  const [offerListings, setOfferListings] = useState([]);
  const [saleListings, setSaleListings] = useState([]);
  const [rentListings, setRentListings] = useState([]);
  const [recommendedListings, setRecommendedListings] = useState([]);
  const [liveRecommendations, setLiveRecommendations] = useState([]);
  const [trendingListings, setTrendingListings] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isSliderVisible, setIsSliderVisible] = useState(false);
  const [stats, setStats] = useState({ properties: 0, users: 0, transactions: 0, satisfaction: 0 });
  const swiperRef = useRef(null);
  const navigate = useNavigate();
  const [showThemeInfo, setShowThemeInfo] = useState(false);

  // New State for Enhanced Recommendations
  const [wishlistItems, setWishlistItems] = useState([]);
  const [watchlistItems, setWatchlistItems] = useState([]);
  const [visibleRecsCount, setVisibleRecsCount] = useState(4);
  const [loadingMoreRecs, setLoadingMoreRecs] = useState(false);
  const [newlyLoadedIds, setNewlyLoadedIds] = useState(new Set());
  const [hasMoreRecs, setHasMoreRecs] = useState(true);
  const [sentinelCandidates, setSentinelCandidates] = useState([]);
  const [sentinelPreferences, setSentinelPreferences] = useState([]);

  // Dashboard sections state
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [myListingsCount, setMyListingsCount] = useState(0);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [quickSearchCities, setQuickSearchCities] = useState([]);
  const [priceDropListings, setPriceDropListings] = useState([]);
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);
  const [recentlyViewedListings, setRecentlyViewedListings] = useState([]);
  const [detectedCity, setDetectedCity] = useState(null);
  const [nearbyCities, setNearbyCities] = useState([]);

  // Helper to determine if we are in user dashboard context for links
  const isUser = true; // Since this is Home.jsx, it usually implies a logged-in user context or main entry. 
  // Original code checked window.location.pathname.startsWith('/user'). 
  // But standard links work fine too. We'll use the check for flexible routing if needed.
  const linkPrefix = currentUser ? "/user" : "";

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);

        // Parallel fetching of all initial data
        const [
          offerRes,
          rentRes,
          saleRes,
          trendingRes,
          statsRes
        ] = await Promise.all([
          authenticatedFetch(`${API_BASE_URL}/api/listing/get?offer=true&visibility=public`),
          authenticatedFetch(`${API_BASE_URL}/api/listing/get?type=rent&visibility=public`),
          authenticatedFetch(`${API_BASE_URL}/api/listing/get?type=sale&visibility=public`),
          authenticatedFetch(`${API_BASE_URL}/api/watchlist/top?limit=6`),
          Promise.all([
            authenticatedFetch(`${API_BASE_URL}/api/listing/count`),
            authenticatedFetch(`${API_BASE_URL}/api/user/count`)
          ])
        ]);

        const offerData = await offerRes.json();
        const rentData = await rentRes.json();
        const saleData = await saleRes.json();

        // Handle Trending Data safely
        let trendingData = [];
        if (trendingRes.ok) {
          const tData = await trendingRes.json();
          trendingData = Array.isArray(tData) ? tData : (tData?.listings || []);
        }

        // Handle Stats Data
        const [propsRes, usersRes] = statsRes;
        const propsData = await propsRes.json();
        const uData = await usersRes.json();
        // const transData = await transRes.json();

        setOfferListings(Array.isArray(offerData) ? offerData : []);
        setRentListings(Array.isArray(rentData) ? rentData : []);
        setSaleListings(Array.isArray(saleData) ? saleData : []);
        setTrendingListings(trendingData);

        setStats({
          properties: Number(propsData.count) || 1250,
          users: Number(uData.count) || 5000,
          transactions: 2500, // Number(transData.count) || 2500,
          satisfaction: 98
        });

      } catch (error) {
        console.error("Error fetching home data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // Fetch recommended listings for logged-in users
  useEffect(() => {
    const fetchRecommended = async () => {
      // ONLY show for regular logged-in users (not guests, not admins)
      if (!currentUser?._id || currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
        setRecommendedListings([]);
        return;
      }
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/ai/recommendations?userId=${currentUser._id}`);
        if (!res.ok) return;
        const data = await res.json();
        setRecommendedListings(Array.isArray(data) ? data : (data?.listings || []));
      } catch (error) {
        console.error("Error fetching recommended listings", error);
        setRecommendedListings([]);
      }
    };
    fetchRecommended();
  }, [currentUser?._id, currentUser?.role]);

  // Fetch Wishlist and Watchlist for enhanced recommendations
  useEffect(() => {
    const fetchUserLists = async () => {
      // ONLY fetch for regular logged-in users
      if (!currentUser?._id || currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
        setWishlistItems([]);
        setWatchlistItems([]);
        return;
      }
      try {
        const [wishRes, watchRes] = await Promise.all([
          authenticatedFetch(`${API_BASE_URL}/api/wishlist/user/${currentUser._id}`),
          authenticatedFetch(`${API_BASE_URL}/api/watchlist/user/${currentUser._id}`)
        ]);

        if (wishRes.ok) {
          const data = await wishRes.json();
          // Extract listing objects safely
          setWishlistItems(Array.isArray(data) ? data.filter(x => x.listingId).map(x => x.listingId) : []);
        }

        if (watchRes.ok) {
          const data = await watchRes.json();
          setWatchlistItems(Array.isArray(data) ? data.filter(x => x.listingId).map(x => x.listingId) : []);
        }
      } catch (error) {
        console.error("Error fetching user lists for recommendations", error);
      }
    };
    fetchUserLists();
  }, [currentUser?._id, currentUser?.role]);

  // Dashboard: Fetch recently viewed, user's listings count, appointments, price drops, unread messages
  useEffect(() => {
    if (!currentUser?._id || currentUser.role === 'admin' || currentUser.role === 'rootadmin') return;

    // Recently viewed from Sentinel localStorage + Quick Search Cities
    const history = getInteractionHistory(currentUser._id);
    const viewedIds = history.slice(0, 8).map(h => h._id);
    const uniqueViewedIds = [...new Set(viewedIds)];
    setRecentlyViewed(uniqueViewedIds);

    // Extract top cities from browsing history for Quick Search
    const cityFreq = {};
    history.forEach(h => {
      if (h.city) {
        const city = h.city.charAt(0).toUpperCase() + h.city.slice(1);
        cityFreq[city] = (cityFreq[city] || 0) + 1;
      }
    });
    const topCities = Object.entries(cityFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([city]) => city);
    setQuickSearchCities(topCities);

    // Fetch user's login location from DB (tracked on every login)
    const fetchLocation = async () => {
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/user/id/${currentUser._id}`);
        if (res.ok) {
          const userData = await res.json();

          // Parse city from lastLoginLocation (format: "Warangal, TG, IN")
          if (userData.lastLoginLocation && userData.lastLoginLocation !== 'Unknown' && userData.lastLoginLocation !== 'Local Development' && userData.lastLoginLocation !== 'Private Network') {
            const parts = userData.lastLoginLocation.split(',').map(s => s.trim());
            if (parts[0]) setDetectedCity(parts[0]);
          }

          // Extract unique cities from all active session locations
          const sessionCities = [];
          const seen = new Set();
          if (userData.activeSessions?.length > 0) {
            userData.activeSessions.forEach(session => {
              if (session.location && session.location !== 'Unknown' && session.location !== 'Local Development' && session.location !== 'Private Network') {
                const city = session.location.split(',')[0]?.trim();
                if (city && !seen.has(city.toLowerCase())) {
                  sessionCities.push({ city, type: 'session' });
                  seen.add(city.toLowerCase());
                }
              }
            });
          }
          if (sessionCities.length > 0) setNearbyCities(sessionCities);
        }
      } catch (e) { /* silent - location is enhancement only */ }
    };
    fetchLocation();

    // Fetch user's own listings count
    const fetchMyListings = async () => {
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/user/listing/${currentUser._id}`);
        if (res.ok) {
          const data = await res.json();
          setMyListingsCount(Array.isArray(data) ? data.length : 0);
        }
      } catch (e) { console.error("Dashboard: listings count error", e); }
    };

    // Fetch upcoming appointments + unread message count
    const fetchAppointments = async () => {
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/my`);
        if (res.ok) {
          const data = await res.json();
          const allAppts = Array.isArray(data) ? data : (data.appointments || []);
          const now = new Date();
          const upcoming = allAppts
            .filter(b => {
              if (!b.date) return false;
              const apptDate = new Date(b.date);
              return apptDate >= now && (b.status === 'pending' || b.status === 'accepted');
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, 3);
          setUpcomingAppointments(upcoming);

          // Calculate total unread messages across all appointments
          let unread = 0;
          allAppts.forEach(appt => {
            const isBuyer = appt.buyerId?._id === currentUser._id || appt.buyerId === currentUser._id;
            const isSeller = appt.sellerId?._id === currentUser._id || appt.sellerId === currentUser._id;
            if (isBuyer && appt.buyerUnreadMessageCount > 0) unread += appt.buyerUnreadMessageCount;
            if (isSeller && appt.sellerUnreadMessageCount > 0) unread += appt.sellerUnreadMessageCount;
          });
          setTotalUnreadMessages(unread);
        }
      } catch (e) { console.error("Dashboard: appointments error", e); }
    };

    // Fetch watchlist items to detect price drops
    const fetchPriceDrops = async () => {
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/watchlist/user/${currentUser._id}`);
        if (res.ok) {
          const data = await res.json();
          const drops = (Array.isArray(data) ? data : [])
            .filter(w => {
              if (!w.listingId || w.effectivePriceAtAdd == null) return false;
              const current = w.listingId.offer && w.listingId.discountPrice
                ? w.listingId.discountPrice : w.listingId.regularPrice;
              return current != null && current < w.effectivePriceAtAdd;
            })
            .map(w => ({
              ...w.listingId,
              baselinePrice: w.effectivePriceAtAdd,
              currentPrice: w.listingId.offer && w.listingId.discountPrice
                ? w.listingId.discountPrice : w.listingId.regularPrice
            }))
            .slice(0, 4);
          setPriceDropListings(drops);
        }
      } catch (e) { console.error("Dashboard: price drops error", e); }
    };

    fetchMyListings();
    fetchAppointments();
    fetchPriceDrops();

    // Fetch recently viewed listings by their IDs
    const fetchRecentlyViewed = async () => {
      if (uniqueViewedIds.length === 0) return;
      try {
        const fetched = await Promise.all(
          uniqueViewedIds.slice(0, 8).map(async (id) => {
            try {
              const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/get/${id}`);
              if (res.ok) return await res.json();
            } catch { /* skip failed */ }
            return null;
          })
        );
        setRecentlyViewedListings(fetched.filter(Boolean));
      } catch (e) { console.error("Dashboard: recently viewed error", e); }
    };
    fetchRecentlyViewed();
  }, [currentUser?._id, currentUser?.role]);

  // STN-LIVE: Process local session recommendations + Wishlist/Watchlist
  useEffect(() => {
    const processLiveRecs = async () => {
      if (loading) return;

      // ONLY process for logged-in regular users (not guests, not admins)
      if (!currentUser || currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
        setLiveRecommendations([]);
        return;
      }

      // Combine all current data as candidates
      const candidates = [...offerListings, ...rentListings, ...saleListings];
      // Dedup candidates and filter valid objects
      let uniqueCandidates = Array.from(new Map(candidates.filter(c => c && c._id).map(item => [item._id, item])).values());

      // Filter out own properties (User should not get recommended their own listings)
      if (currentUser) {
        uniqueCandidates = uniqueCandidates.filter(c =>
          c.userRef !== currentUser._id &&
          c.sellerId !== currentUser._id
        );
      }

      // Tag wishlist and watchlist items with their source for weighted scoring
      const taggedWishlist = wishlistItems.map(item => ({ ...item, _sentinelType: 'wishlist' }));
      const taggedWatchlist = watchlistItems.map(item => ({ ...item, _sentinelType: 'watchlist' }));
      const userPreferences = [...taggedWishlist, ...taggedWatchlist];
      const uniquePreferences = Array.from(new Map(userPreferences.filter(p => p && p._id).map(item => [item._id, item])).values());

      // Store candidates and preferences for batch loading
      setSentinelCandidates(uniqueCandidates);
      setSentinelPreferences(uniquePreferences);

      // Initial fetch: only 8 items for fast first paint
      const recs = await getLiveRecommendations(uniqueCandidates, 8, uniquePreferences, currentUser._id);
      setLiveRecommendations(recs);
      setHasMoreRecs(recs.length >= 8);
      setVisibleRecsCount(4);
    };

    processLiveRecs();
  }, [loading, offerListings, rentListings, saleListings, wishlistItems, watchlistItems, currentUser?._id, currentUser?.role]);

  // Handler for loading more Sentinel recommendations in batches
  const handleLoadMoreRecs = async () => {
    if (loadingMoreRecs || !currentUser) return;
    setLoadingMoreRecs(true);

    try {
      // If we already have more pre-fetched items to reveal, just show them
      if (liveRecommendations.length > visibleRecsCount) {
        const nextBatch = liveRecommendations.slice(visibleRecsCount, visibleRecsCount + 4);
        const newIds = new Set(nextBatch.map(r => r._id));
        setNewlyLoadedIds(newIds);
        setVisibleRecsCount(prev => prev + 4);

        // Clear animation markers after animation completes
        setTimeout(() => setNewlyLoadedIds(new Set()), 800);
        setLoadingMoreRecs(false);
        return;
      }

      // Fetch a new batch from the engine (next 8 items, excluding already shown)
      const excludeIds = new Set(liveRecommendations.map(r => r._id));
      const remainingCandidates = sentinelCandidates.filter(c => !excludeIds.has(c._id));

      if (remainingCandidates.length === 0) {
        setHasMoreRecs(false);
        setLoadingMoreRecs(false);
        return;
      }

      // Simulate a brief loading period for skeleton visibility (min 600ms)
      const [recs] = await Promise.all([
        getLiveRecommendations(remainingCandidates, 8, sentinelPreferences, currentUser._id),
        new Promise(resolve => setTimeout(resolve, 600))
      ]);

      if (recs.length === 0) {
        setHasMoreRecs(false);
        setLoadingMoreRecs(false);
        return;
      }

      // Track newly loaded IDs for animation
      const newIds = new Set(recs.map(r => r._id));
      setNewlyLoadedIds(newIds);

      // Append new recommendations
      setLiveRecommendations(prev => [...prev, ...recs]);
      setVisibleRecsCount(prev => prev + 4);
      setHasMoreRecs(recs.length >= 8);

      // Clear animation markers after animation completes
      setTimeout(() => setNewlyLoadedIds(new Set()), 800);
    } catch (error) {
      console.error('Sentinel: Failed to load more recommendations', error);
    } finally {
      setLoadingMoreRecs(false);
    }
  };

  const handleSlideChange = (swiper) => {
    setCurrentSlideIndex(swiper.realIndex);
  };

  const goToSlide = (index) => {
    if (swiperRef.current && swiperRef.current.swiper) {
      swiperRef.current.swiper.slideTo(index);
    }
  };

  // Get all images from offer listings for the slider
  const allSliderImages = Array.isArray(offerListings) ? offerListings.flatMap(listing =>
    (listing.imageUrls || []).map((img, idx) => ({
      url: img,
      listingId: listing._id,
      title: listing.name || 'Featured Property',
      price: listing.offer && listing.discountPrice ? listing.discountPrice : listing.regularPrice,
      type: listing.type
    }))
  ) : [];

  if (loading) {
    return <HomeSkeleton />;
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen relative overflow-hidden font-sans transition-colors duration-300">
      <SeasonalEffects />
      <DailyQuote />
      {/* Background Animations */}
      <style>
        {`
            @keyframes blob {
                0% { transform: translate(0px, 0px) scale(1); }
                33% { transform: translate(30px, -50px) scale(1.1); }
                66% { transform: translate(-20px, 20px) scale(0.9); }
                100% { transform: translate(0px, 0px) scale(1); }
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes float {
                0% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
                100% { transform: translateY(0px); }
            }
            .animate-blob { animation: blob 10s infinite; }
            .animate-fade-in { animation: fadeIn 0.8s ease-out forwards; }
            .animate-fade-in-delay { animation: fadeIn 0.8s ease-out 0.2s forwards; opacity: 0; }
            .animate-float { animation: float 6s ease-in-out infinite; }
            .glass-card { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.3); }
            .dark .glass-card { background: rgba(31, 41, 55, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); }
        `}
      </style>

      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-300 dark:bg-blue-900 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" style={{ animationDelay: "2s" }}></div>
        <div className="absolute top-[20%] left-[20%] w-72 h-72 bg-pink-300 dark:bg-pink-900 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" style={{ animationDelay: "4s" }}></div>
        <div className="absolute bottom-[-10%] right-[20%] w-96 h-96 bg-yellow-200 dark:bg-yellow-900 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" style={{ animationDelay: "6s" }}></div>
      </div>

      <div className="relative z-10">

        {/* Hero Section */}
        <div className="relative pt-20 pb-16 lg:pt-32 lg:pb-28 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">

            {/* User Greeting */}
            {currentUser && (
              <div className="mb-8 animate-fade-in flex justify-center">
                <div
                  className="w-[90%] sm:w-auto max-w-2xl inline-flex flex-col sm:flex-row items-center justify-center gap-2 px-6 py-4 sm:py-3 rounded-2xl sm:rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg shadow-lg border border-white/50 dark:border-gray-700 transform transition-all duration-300 hover:scale-105 hover:shadow-xl"
                >
                  {(() => {
                    const name = currentUser.firstName || currentUser.username || currentUser.name || currentUser.fullName || 'Friend';
                    const hour = new Date().getHours();
                    const greet = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
                    // Use seasonal icon if available, otherwise time-based emoji
                    const emoji = theme ? theme.icon : (hour < 12 ? '☀️' : hour < 18 ? '🌤️' : '🌙');

                    return (
                      <span className="text-lg sm:text-xl font-bold flex flex-wrap items-center justify-center text-center gap-x-2 gap-y-1">
                        <span className="flex flex-wrap items-center justify-center gap-x-1 transition-all duration-300">
                          <span className="text-gray-700 dark:text-gray-200">
                            {(theme?.greeting || greet).split(' ')[0]}
                          </span>
                          <span className="flex items-center">
                            {allThemes.length > 1
                              ? (
                                allThemes.map((t, idx) => {
                                  const parts = t.greeting.replace(/[.!]$/, '').split(' ');
                                  const festivalName = parts.slice(1).join(' ');
                                  return (
                                    <span key={idx} className="flex items-center">
                                      <span className="ml-1 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                                        {festivalName}
                                      </span>
                                      {idx < allThemes.length - 2 ?
                                        <span className="text-gray-700 dark:text-gray-200">, </span> :
                                        idx === allThemes.length - 2 ?
                                          <span className="text-gray-700 dark:text-gray-200 mx-1">&</span> : ''
                                      }
                                    </span>
                                  );
                                })
                              )
                              : (
                                (theme?.greeting || greet).split(' ').length > 1 && (
                                  <span className="ml-1 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                                    {(theme?.greeting || greet).split(' ').slice(1).join(' ').replace(/[.!]$/, '')}
                                  </span>
                                )
                              )
                            }
                          </span>
                          <span className="text-gray-700 dark:text-gray-200">,</span>
                        </span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 break-words max-w-[200px] sm:max-w-none truncate">
                          <EncryptedText text={`${name}!`} />
                        </span>
                        <span
                          className={`inline-block ml-1 text-2xl filter drop-shadow-md cursor-pointer hover:scale-110 transition-transform flex items-center gap-1`}
                          onClick={() => theme && setShowThemeInfo(true)}
                          title={allThemes.length > 1 ? allThemes.map(t => t.name).join(' & ') : (theme?.name || "Greetings")}
                        >
                          {allThemes.length > 1 ? (
                            allThemes.map((t, i) => (
                              <span key={i}>{t.icon}</span>
                            ))
                          ) : (
                            <span>{emoji}</span>
                          )}
                        </span>
                      </span>
                    );
                  })()}
                </div>
              </div>
            )}

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-semibold mb-6 animate-fade-in border border-blue-100 dark:border-blue-800 shadow-sm">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
              #1 Real Estate Platform
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6 animate-fade-in-delay transition-colors min-h-[3.6em] md:min-h-[1.2em] flex items-center justify-center">
              <Typewriter
                words={[
                  "Find Your Dream Home",
                  "Discover Perfect Spaces",
                  "Search Verified Listings",
                  "Experience Luxury Living",
                  "Unlock Exclusive Deals",
                  "Invest In Your Future",
                  "Explore Smart Properties"
                ]}
                splitFirstWord={true}
                gradientClassName="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400"
              />
            </h1>

            <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-600 dark:text-gray-300 mb-10 animate-fade-in-delay" style={{ animationDelay: "0.4s" }}>
              Discover an exclusive selection of the finest properties.
              <br className="hidden md:block" />
              Smart search, verified listings, and seamless transactions.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-delay" style={{ animationDelay: "0.6s" }}>
              <Link
                to="/search"
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30 hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <FaRocket /> Start Exploring
              </Link>
              <Link
                to="/about"
                className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
              >
                <FaInfoCircle /> Learn More
              </Link>
            </div>

            {/* Stats Cards */}
            <div className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto animate-fade-in-delay" style={{ animationDelay: "0.8s" }}>
              {[
                { icon: FaHome, label: "Properties", value: stats.properties, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/30" },
                { icon: FaUsers, label: "Happy Users", value: stats.users, color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/30" },
                { icon: FaChartLine, label: "Transactions", value: stats.transactions, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/30" },
                { icon: FaStar, label: "Satisfaction", value: `${stats.satisfaction}%`, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-900/30" }
              ].map((stat, index) => (
                <div key={index} className="glass-card p-6 rounded-2xl shadow-lg border border-white/50 dark:border-gray-700 hover:transform hover:-translate-y-1 transition-all duration-300">
                  <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                    <stat.icon className={`text-2xl ${stat.color}`} />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{typeof stat.value === 'number' ? stat.value.toLocaleString() + '+' : stat.value}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Featured Slider */}
        {allSliderImages.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 animate-fade-in">
            <div className="flex flex-col items-center mb-8 gap-4 text-center">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Featured Properties</h2>
                <p className="text-gray-600 dark:text-gray-400">Handpicked premium properties just for you</p>
              </div>
              <div className="flex gap-2">
                {allSliderImages.slice(0, 5).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => goToSlide(idx)}
                    className={`h-2 rounded-full transition-all duration-300 ${currentSlideIndex === idx ? 'w-8 bg-blue-600 dark:bg-blue-500' : 'w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'}`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-3xl overflow-hidden shadow-2xl relative group bg-gray-900">
              <Swiper
                ref={swiperRef}
                modules={[Autoplay, Pagination, EffectFade]}
                effect="fade"
                autoplay={{ delay: 5000, disableOnInteraction: false }}
                speed={1000}
                loop={true}
                onSlideChange={handleSlideChange}
                className="h-[400px] md:h-[500px] lg:h-[600px] w-full"
              >
                {allSliderImages.map((image, idx) => (
                  <SwiperSlide key={idx} className="relative">
                    <div className="absolute inset-0 bg-black/40 z-10" />
                    <img
                      src={image.url}
                      alt={image.title}
                      className="w-full h-full object-cover transform transition-transform duration-[10s] hover:scale-110"
                      style={{ animation: 'panImage 20s linear infinite alternate' }}
                    />
                    <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                      <div className="max-w-3xl animate-fade-in-up text-left">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <span className="px-3 py-1 bg-blue-600/90 backdrop-blur-md text-white text-xs font-bold rounded-full uppercase tracking-wider">
                            {image.type === 'rent' ? 'For Rent' : 'For Sale'}
                          </span>
                          {image.price && (
                            <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white text-xs font-bold rounded-full border border-white/30">
                              ₹ {image.price.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                        <h3 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-2 leading-tight">
                          {image.title}
                        </h3>
                        <Link
                          to={`/listing/${image.listingId}`}
                          className="inline-flex items-center gap-2 text-white hover:text-blue-300 font-medium mt-2 transition-colors group/link"
                        >
                          View Details <FaArrowRight className="group-hover/link:translate-x-1 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          </div>
        )}

        {/* Categories / Listings Sections */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20 py-16">

          {/* ─── Quick Activity Dashboard (logged-in regular users) ─── */}
          {currentUser && currentUser.role !== 'admin' && currentUser.role !== 'rootadmin' && (
            <section className="animate-fade-in">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                  <span className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl shadow-lg">
                    <FaChartLine className="text-lg" />
                  </span>
                  Your Dashboard
                </h2>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Recently Viewed */}
                <Link to={`${linkPrefix}/search`} className="group bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <div className="w-11 h-11 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <FaEye className="text-lg text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{recentlyViewed.length}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">Recently Viewed</div>
                </Link>

                {/* Wishlist */}
                <Link to={`${linkPrefix}/wishlist`} className="group bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <div className="w-11 h-11 bg-red-50 dark:bg-red-900/30 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <FaHeart className="text-lg text-red-500 dark:text-red-400" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{wishlistItems.length}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">Wishlist</div>
                </Link>

                {/* Watchlist */}
                <Link to={`${linkPrefix}/watchlist`} className="group bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <div className="w-11 h-11 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <FaBell className="text-lg text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{watchlistItems.length}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">Watchlist</div>
                </Link>

                {/* My Listings */}
                <Link to={`${linkPrefix}/my-listings`} className="group bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <div className="w-11 h-11 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <FaListAlt className="text-lg text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{myListingsCount}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">My Listings</div>
                </Link>

                {/* Upcoming Appointments */}
                <Link to={`${linkPrefix}/my-appointments`} className="group bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 col-span-2 lg:col-span-1">
                  <div className="w-11 h-11 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <FaCalendarAlt className="text-lg text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{upcomingAppointments.length}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">Upcoming Appts</div>
                </Link>
              </div>

              {/* Upcoming Appointments Preview */}
              {upcomingAppointments.length > 0 && (
                <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                      <FaCalendarAlt className="text-purple-500" /> Upcoming Appointments
                    </h3>
                    <Link to={`${linkPrefix}/my-appointments`} className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">View All</Link>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {upcomingAppointments.map((appt, idx) => (
                      <Link key={appt._id || idx} to={`${linkPrefix}/my-appointments`} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${appt.status === 'accepted' ? 'bg-green-50 dark:bg-green-900/30 text-green-600' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600'}`}>
                          {new Date(appt.date).getDate()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {appt.propertyName || appt.listingId?.name || 'Property Viewing'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(appt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {appt.time || 'TBD'}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${appt.status === 'accepted' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'}`}>
                          {appt.status}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Recently Viewed Properties */}
              {recentlyViewedListings.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <FaEye className="text-blue-500" /> Recently Viewed
                    </h3>
                    <Link to={`${linkPrefix}/search`} className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1">
                      Browse More <FaArrowRight className="text-[10px]" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {recentlyViewedListings.map((listing) => (
                      <ListingItem key={listing._id} listing={listing} />
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ─── Quick Search Shortcuts (login location + browsing history) ─── */}
          {currentUser && currentUser.role !== 'admin' && currentUser.role !== 'rootadmin' && (() => {
            // Build merged, deduplicated city list: detected city first, then session cities, then history cities
            const allCities = [];
            const seen = new Set();

            // 1. Current login city (highlighted)
            if (detectedCity && !seen.has(detectedCity.toLowerCase())) {
              allCities.push({ city: detectedCity, type: 'detected' });
              seen.add(detectedCity.toLowerCase());
            }

            // 2. Cities from other active sessions (login locations from DB)
            nearbyCities.forEach(nc => {
              const key = nc.city.toLowerCase();
              if (!seen.has(key)) {
                allCities.push({ city: nc.city, type: 'nearby' });
                seen.add(key);
              }
            });

            // 3. Browsing history cities
            quickSearchCities.forEach(city => {
              const key = city.toLowerCase();
              if (!seen.has(key)) {
                allCities.push({ city, type: 'history' });
                seen.add(key);
              }
            });

            // 4. Fallback popular cities (ensure we always have a good selection)
            const fallbackCities = ['Hyderabad', 'Bangalore', 'Mumbai', 'Delhi', 'Pune'];
            fallbackCities.forEach(city => {
              const key = city.toLowerCase();
              if (!seen.has(key) && allCities.length < 8) {
                allCities.push({ city, type: 'fallback' });
                seen.add(key);
              }
            });

            // Limit to 4 city pills (Present + 3 others)
            const displayCities = allCities.slice(0, 4);

            return (
              <section className="animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <FaSearch className="text-indigo-500" /> Quick Search
                    {detectedCity && (
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500 ml-1">• Near {detectedCity}</span>
                    )}
                  </h3>
                  <Link to={`${linkPrefix}/search`} className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">Advanced Search</Link>
                </div>
                <div className="flex flex-wrap gap-3">
                  {displayCities.map((item, i) => (
                    <Link
                      key={item.city}
                      to={`/search?city=${encodeURIComponent(item.city)}`}
                      className={`group flex items-center gap-2 px-4 py-2.5 rounded-xl border shadow-sm hover:shadow-md transition-all duration-300 animate-sentinel-fade-in ${
                        item.type === 'detected'
                          ? 'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border-indigo-200 dark:border-indigo-700 ring-1 ring-indigo-100 dark:ring-indigo-800'
                          : item.type === 'nearby'
                            ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-700'
                            : 'bg-gray-50 dark:bg-gray-800/60 border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700'
                      }`}
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <FaMapMarkerAlt className={`group-hover:scale-110 transition-transform text-sm ${
                        item.type === 'detected' ? 'text-indigo-600 dark:text-indigo-400' : 'text-indigo-500'
                      }`} />
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {item.type === 'detected' ? `📍 Properties in ${item.city}` : `Properties in ${item.city}`}
                      </span>
                      {item.count && (
                        <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full font-bold">
                          {item.count}
                        </span>
                      )}
                      {item.type === 'history' && (
                        <span className="text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-bold uppercase">
                          Viewed
                        </span>
                      )}
                    </Link>
                  ))}
                  {/* Quick type filters */}
                  <Link
                    to="/search?type=rent"
                    className="group flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800 shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    <FaHome className="text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform text-sm" />
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">For Rent</span>
                  </Link>
                  <Link
                    to="/search?type=sale"
                    className="group flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/20 rounded-xl border border-blue-100 dark:border-blue-800 shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    <FaHome className="text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform text-sm" />
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">For Sale</span>
                  </Link>
                  <Link
                    to="/search?offer=true"
                    className="group flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-100 dark:border-amber-800 shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    <FaStar className="text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform text-sm" />
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">Special Offers</span>
                  </Link>
                </div>
              </section>
            );
          })()}

          {/* ─── Price Drop Alerts ─── */}
          {currentUser && currentUser.role !== 'admin' && currentUser.role !== 'rootadmin' && priceDropListings.length > 0 && (
            <section className="animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FaArrowDown className="text-green-500" /> Price Drop Alerts
                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-[10px] font-bold rounded-full uppercase">
                    {priceDropListings.length} drop{priceDropListings.length !== 1 ? 's' : ''}
                  </span>
                </h3>
                <Link to={`${linkPrefix}/watchlist`} className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">View Watchlist</Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {priceDropListings.map((listing) => (
                  <ListingItem key={listing._id} listing={listing} />
                ))}
              </div>
            </section>
          )}

          {/* ─── Unread Messages Quick Access ─── */}
          {currentUser && currentUser.role !== 'admin' && currentUser.role !== 'rootadmin' && totalUnreadMessages > 0 && (
            <Link
              to={`${linkPrefix}/my-appointments`}
              className="group block bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-5 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 animate-fade-in"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FaCommentDots className="text-xl text-white" />
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg animate-pulse">
                      {totalUnreadMessages > 9 ? '9+' : totalUnreadMessages}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg">
                      {totalUnreadMessages} Unread Message{totalUnreadMessages !== 1 ? 's' : ''}
                    </p>
                    <p className="text-white/70 text-xs font-medium">Tap to view your appointment chats</p>
                  </div>
                </div>
                <FaArrowRight className="text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          )}

          {/* Sentinel Live Section (Real-time Session Based) - regular users only */}
          {currentUser && currentUser.role !== 'admin' && currentUser.role !== 'rootadmin' && (
            <section className="relative overflow-hidden p-1 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10 rounded-[2.5rem] mt-[-2rem]">
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-8 rounded-[2.4rem] border border-white/50 dark:border-gray-700/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                      <span className="p-2 bg-blue-600 text-white rounded-xl shadow-lg ring-4 ring-blue-50 dark:ring-blue-900/10">
                        <FaRobot className="animate-pulse" />
                      </span>
                      Sentinel Live
                    </h2>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-full w-fit">
                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                          {liveRecommendations.length > 0 ? "PERSONALIZED RECOMMENDATIONS BASED ON YOUR ACTIVITY & LIKES" : "AI PERSONALIZATION ENGINE"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-1 font-medium italic">Tensor-mode active</p>
                    </div>
                  </div>
                  {liveRecommendations.length > 0 && (
                    <Link
                      to={`${linkPrefix}/search`}
                      className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold hover:text-blue-700 dark:hover:text-blue-300 transition-all hover:translate-x-1"
                    >
                      View All <FaArrowRight />
                    </Link>
                  )}
                </div>

                {liveRecommendations.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {liveRecommendations.slice(0, visibleRecsCount).map((listing, index) => (
                        <div
                          key={`live-${listing._id}`}
                          className={`relative group overflow-visible transition-all duration-500 ${newlyLoadedIds.has(listing._id)
                              ? 'animate-sentinel-fade-in'
                              : ''
                            }`}
                          style={{
                            animationDelay: newlyLoadedIds.has(listing._id)
                              ? `${(index % 4) * 120}ms`
                              : '0ms'
                          }}
                        >
                          {listing.isLiveMatch && (
                            <div className="absolute -top-2 -right-2 z-20 bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg transform rotate-12 group-hover:rotate-0 transition-transform">
                              {Math.round(listing.sentinelScore * 100)}% MATCH
                            </div>
                          )}
                          <ListingItem listing={listing} />
                        </div>
                      ))}

                      {/* Skeleton cards while loading more */}
                      {loadingMoreRecs && (
                        [...Array(4)].map((_, i) => (
                          <div key={`skel-${i}`} className="animate-pulse rounded-2xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-lg">
                            <div className="aspect-[16/10] bg-gray-200 dark:bg-gray-700" />
                            <div className="p-4 space-y-3">
                              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-lg w-3/4" />
                              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg w-2/3" />
                              <div className="flex gap-3">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                              </div>
                              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-full mt-2" />
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* View More Button */}
                    {hasMoreRecs && !loadingMoreRecs && (liveRecommendations.length > visibleRecsCount || sentinelCandidates.length > liveRecommendations.length) && (
                      <div className="mt-8 text-center">
                        <button
                          onClick={handleLoadMoreRecs}
                          className="px-6 py-3 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 font-bold rounded-xl shadow-lg border border-blue-100 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto"
                        >
                          <FaRobot className="text-sm" />
                          View More Recommendations
                          <FaArrowRight />
                        </button>
                      </div>
                    )}

                    {/* End of recommendations message */}
                    {!hasMoreRecs && liveRecommendations.length > 4 && (
                      <div className="mt-8 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium italic">
                          ✨ You've seen all personalized recommendations
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-12 px-6 text-center animate-fade-in">
                    <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6 transform -rotate-6">
                      <FaRocket className="text-4xl text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Sentinel is getting ready! 🤖</h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                      Start exploring properties, adding items to your wishlist, or tracking listings to unlock your personalized **Sentinel Live** recommendations tailored to your unique tastes.
                    </p>
                    <Link
                      to="/search"
                      className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all hover:scale-105 active:scale-95"
                    >
                      Start Exploring <FaSearch />
                    </Link>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Recommended Listings (signed-in regular users only) */}
          {currentUser && currentUser.role !== 'admin' && currentUser.role !== 'rootadmin' && recommendedListings.length > 0 && (
            <section>
              <div className="flex flex-row items-center justify-between gap-4 mb-8">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3">
                    <span className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400"><FaStar className="text-lg sm:text-xl" /></span>
                    Recommended for You
                  </h2>
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-full h-fit w-fit">
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                      <FaRobot className="animate-pulse text-xs" /> Powered by Sentinel
                    </span>
                  </div>
                </div>
                <Link to={`${linkPrefix}/search`} className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-sm sm:text-base whitespace-nowrap">
                  See More<span className="hidden sm:inline">Recommendations</span> <FaArrowRight />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {recommendedListings.map((listing) => (
                  <ListingItem key={listing._id} listing={listing} />
                ))}
              </div>
            </section>
          )}

          {/* Trending Listings */}
          {(trendingListings.length > 0 || offerListings.length > 0) && (
            <section>
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3">
                  <span className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400"><FaChartLine className="text-lg sm:text-xl" /></span>
                  {trendingListings.length > 0 ? 'Popular / Trending' : 'Featured Properties'}
                </h2>
                <Link to={`${linkPrefix}/search`} className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-sm sm:text-base whitespace-nowrap">
                  See More <FaArrowRight />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {trendingListings.length > 0 ? (
                  trendingListings.map((listing) => (
                    <ListingItem key={listing._id} listing={listing} />
                  ))
                ) : (
                  offerListings.slice(0, 4).map((listing) => (
                    <ListingItem key={listing._id} listing={listing} />
                  ))
                )}
              </div>
            </section>
          )}

          {/* Offer Listings */}
          {offerListings.length > 0 && (
            <section>
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3">
                  <span className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400"><FaGem className="text-lg sm:text-xl" /></span>
                  Exclusive Offers
                </h2>
                <Link to={`${linkPrefix}/search?offer=true`} className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-sm sm:text-base whitespace-nowrap">
                  View All <span className="hidden sm:inline">Offers</span> <FaArrowRight />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {offerListings.map((listing) => (
                  <ListingItem key={listing._id} listing={listing} />
                ))}
              </div>
            </section>
          )}

          {/* Rent Listings */}
          {rentListings.length > 0 && (
            <section>
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3">
                  <span className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400"><FaHome className="text-lg sm:text-xl" /></span>
                  Homes for Rent
                </h2>
                <Link to={`${linkPrefix}/search?type=rent`} className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-sm sm:text-base whitespace-nowrap">
                  View All <span className="hidden sm:inline">Rentals</span> <FaArrowRight />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {rentListings.map((listing) => (
                  <ListingItem key={listing._id} listing={listing} />
                ))}
              </div>
            </section>
          )}

          {/* Sale Listings */}
          {saleListings.length > 0 && (
            <section>
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3">
                  <span className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400"><FaHome className="text-lg sm:text-xl" /></span>
                  Homes for Sale
                </h2>
                <Link to={`${linkPrefix}/search?type=sale`} className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-sm sm:text-base whitespace-nowrap">
                  View All <span className="hidden sm:inline">Sales</span> <FaArrowRight />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {saleListings.map((listing) => (
                  <ListingItem key={listing._id} listing={listing} />
                ))}
              </div>
            </section>
          )}

          {/* Marketing sections — only shown for public/guest visitors */}
          {!currentUser && (
            <>
              {/* How It Works Section */}
              <section>
                <div className="text-center mb-12">
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">How It Works</h2>
                  <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">Your journey to a new home in 4 simple steps.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  {[
                    { icon: FaSearch, title: "Search", desc: "Filter and find your dream property.", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/30" },
                    { icon: FaHeart, title: "Save", desc: "Shortlist your favorites easily.", color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/30" },
                    { icon: FaPhone, title: "Connect", desc: "Contact agents or owners directly.", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/30" },
                    { icon: FaHandshake, title: "Deal", desc: "Close the deal securely.", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/30" }
                  ].map((step, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 text-center hover:shadow-md transition-all duration-300">
                      <div className={`w-16 h-16 ${step.bg} rounded-full flex items-center justify-center mx-auto mb-4`}>
                        <step.icon className={`text-2xl ${step.color}`} />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{step.title}</h3>
                      <p className="text-gray-600 dark:text-gray-300 text-sm">{step.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Why Choose Us */}
              <section className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 md:p-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-bl-full -mr-20 -mt-20 opacity-50 pointer-events-none"></div>

                <div className="text-center mb-12 relative z-10">
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">Why Choose UrbanSetu?</h2>
                  <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">We provide a premium, secure, and seamless real estate experience tailored to your needs.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
                  {[
                    { icon: FaSearch, title: "Smart Search", desc: "AI-powered search filters to find exactly what you need.", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/30" },
                    { icon: FaShieldAlt, title: "Secure & Verified", desc: "All listings are verified for your peace of mind.", color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/30" },
                    { icon: FaRocket, title: "Fast Processing", desc: "Quick documentation and approval process.", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/30" },
                    { icon: FaHeart, title: "24/7 Support", desc: "Dedicated support team available round the clock.", color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/30" },
                    { icon: FaDesktop, title: "Cross-Platform", desc: "Seamless experience across Mobile, Tablet, and Desktop.", color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/30" },
                    { icon: FaGem, title: "Premium Listings", desc: "Access to exclusive luxury properties.", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/30" }
                  ].map((feature, idx) => (
                    <div key={idx} className="flex gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-300">
                      <div className={`w-12 h-12 ${feature.bg} rounded-xl flex-shrink-0 flex items-center justify-center`}>
                        <feature.icon className={`text-xl ${feature.color}`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{feature.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Multi-Platform Access */}
              <section className="py-8">
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Access From Anywhere</h2>
                  <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">Enjoy a seamless experience across all your favorite devices.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {[
                    { icon: FaDesktop, title: "Desktop", desc: "Full-featured experience." },
                    { icon: FaMobile, title: "Mobile", desc: "Optimized for your pocket." },
                    { icon: FaTablet, title: "Tablet", desc: "Perfect for browsing on the go." }
                  ].map((platform, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center hover:-translate-y-1 transition-transform">
                      <div className="w-14 h-14 bg-gray-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center mb-3 text-gray-700 dark:text-gray-200 text-2xl">
                        <platform.icon />
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-white">{platform.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{platform.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Testimonials */}
              <section>
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Trusted by Thousands</h2>
                  <p className="text-gray-600 dark:text-gray-400">See what our community has to say about their experience.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[
                    { name: "Priya Sharma", role: "Home Buyer", quote: "Found my dream apartment in just 2 days! The interface is so intuitive.", bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400" },
                    { name: "Rajesh Kumar", role: "Property Investor", quote: "The best platform for real estate analytics and verified listings.", bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-600 dark:text-green-400" },
                    { name: "Anjali Patel", role: "Tenant", quote: "Seamless rental process. The support team was incredibly helpful.", bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-400" }
                  ].map((t, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 hover:-translate-y-2 transition-transform duration-300">
                      <FaQuoteLeft className={`text-4xl ${t.text} opacity-20 mb-4`} />
                      <p className="text-gray-600 dark:text-gray-300 italic mb-6">"{t.quote}"</p>
                      <div className="flex items-center mb-6">
                        {[...Array(5)].map((_, starIndex) => (
                          <FaStar key={starIndex} className="text-yellow-400 text-sm animate-pulse" style={{ animationDelay: `${starIndex * 0.1}s` }} />
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${t.bg} flex items-center justify-center font-bold ${t.text}`}>
                          {t.name[0]}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white">{t.name}</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t.role}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* CTA Section */}
              <section className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-blue-700 to-indigo-800 text-white shadow-2xl">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80')] opacity-10 bg-cover bg-center"></div>
                <div className="relative z-10 px-8 py-16 md:py-24 text-center max-w-4xl mx-auto">
                  <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to Start Your Journey?</h2>
                  <p className="text-blue-100 text-lg md:text-xl mb-10">Join thousands of satisfied users who have found their perfect property with UrbanSetu.</p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link to="/search" className="px-8 py-4 bg-white text-blue-700 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg">
                      Find a Home
                    </Link>
                    <Link to="/about" className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-xl font-bold text-lg hover:bg-white hover:text-blue-700 transition-all">
                      Learn More
                    </Link>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* Ads Section */}
          <div className="text-center py-6">
            <p className="text-xs text-gray-400 mb-2 font-mono">SPONSORED CONTENT Coming Soon...</p>
          </div>
        </div>

      </div>

      <ContactSupportWrapper />
      <GeminiAIWrapper />
      <ThemeDetailModal
        theme={theme}
        themes={allThemes}
        isOpen={showThemeInfo}
        onClose={() => setShowThemeInfo(false)}
      />
    </div>
  );
}
