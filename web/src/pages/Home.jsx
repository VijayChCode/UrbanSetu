import React, { useEffect, useState, useRef, useMemo } from "react";
import HomeSkeleton from "../components/skeletons/HomeSkeleton";
import { Link, useNavigate } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, EffectFade } from "swiper/modules";
import "swiper/css/bundle";
import "swiper/css/effect-fade";
import "swiper/css/pagination";
import ListingItem from "../components/ListingItem";
import ListingSkeletonGrid from "../components/skeletons/ListingSkeletonGrid";
import { useSelector } from "react-redux";
import EncryptedText from "../components/ui/EncryptedText";
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import AdvancedImage from "../components/AdvancedImage";
import GeminiAIWrapper from "../components/GeminiAIWrapper";
import { usePageTitle } from '../hooks/usePageTitle';
import Typewriter from "../components/ui/Typewriter";
import { FaEye, FaCalendarAlt, FaListAlt, FaBell, FaCommentDots, FaArrowDown, FaSearch, FaHome, FaHeart, FaStar, FaMapMarkerAlt, FaPhone, FaEnvelope, FaShieldAlt, FaAward, FaUsers, FaChartLine, FaLightbulb, FaRocket, FaGem, FaQuoteLeft, FaQuoteRight, FaCheckCircle, FaClock, FaHandshake, FaGlobe, FaMobile, FaDesktop, FaTablet, FaInfoCircle, FaArrowRight, FaRobot, FaThumbsUp, FaComment, FaBookOpen, FaNewspaper, FaGraduationCap, FaFire } from "react-icons/fa";
import SeasonalEffects from "../components/SeasonalEffects";
import DailyQuote from "../components/DailyQuote";
import { useSeasonalTheme, useAllSeasonalThemes } from "../hooks/useSeasonalTheme";
import ThemeDetailModal from "../components/ThemeDetailModal";
import { authenticatedFetch } from "../utils/auth";
import { getLiveRecommendations, getInteractionHistory, restoreFromServer } from "../utils/sentinelLiveEngine";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Animation CSS classes from Profile.jsx
const animationClasses = {
  fadeInUp: "animate-[fadeInUp_0.6s_ease-out_forwards] opacity-0 translate-y-8",
  fadeInLeft: "animate-[fadeInLeft_0.6s_ease-out_forwards] opacity-0 -translate-x-8",
  fadeInRight: "animate-[fadeInRight_0.6s_ease-out_forwards] opacity-0 translate-x-8",
  fadeIn: "animate-[fadeIn_0.6s_ease-out_forwards] opacity-0",
  scaleIn: "animate-[scaleIn_0.5s_ease-out_forwards] opacity-0 scale-95",
  slideInUp: "animate-[slideInUp_0.5s_ease-out_forwards] opacity-0 translate-y-4",
  staggerDelay: (index) => `animation-delay-${index * 150}ms`,
  bounceIn: "animate-[bounceIn_0.7s_ease-out_forwards] opacity-0 scale-50",
  pulse: "animate-pulse",
  spin: "animate-spin",
  bounce: "animate-bounce",
  wiggle: "animate-[wiggle_1s_ease-in-out_infinite]",
  heartbeat: "animate-[heartbeat_1.5s_ease-in-out_infinite]",
  float: "animate-[float_3s_ease-in-out_infinite]",
  shimmer: "animate-[shimmer_2s_linear_infinite]",
};

// Custom keyframe animations from Profile.jsx
const customAnimations = `
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeInLeft {
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes fadeInRight {
  from { opacity: 0; transform: translateX(30px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes slideInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes bounceIn {
  0% { opacity: 0; transform: scale(0.3); }
  50% { opacity: 1; transform: scale(1.05); }
  70% { transform: scale(0.9); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes wiggle {
  0%, 7% { transform: rotateZ(0); }
  15% { transform: rotateZ(-15deg); }
  20% { transform: rotateZ(10deg); }
  25% { transform: rotateZ(-10deg); }
  30% { transform: rotateZ(6deg); }
  35% { transform: rotateZ(-4deg); }
  40%, 100% { transform: rotateZ(0); }
}
@keyframes heartbeat {
  0%, 50%, 100% { transform: scale(1); }
  25% { transform: scale(1.1); }
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}
@keyframes countUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animation-delay-0 { animation-delay: 0ms; }
.animation-delay-150 { animation-delay: 150ms; }
.animation-delay-300 { animation-delay: 300ms; }
.animation-delay-450 { animation-delay: 450ms; }
.animation-delay-600 { animation-delay: 600ms; }
.animation-delay-750 { animation-delay: 750ms; }
.animation-delay-800 { animation-delay: 800ms; }
.animation-delay-850 { animation-delay: 850ms; }
.animation-delay-900 { animation-delay: 900ms; }
`;

// Custom Counter Component with Animation
const AnimatedCounter = ({ end, duration = 1000, delay = 0 }) => {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setStarted(true);
      let start = 0;
      const increment = end / (duration / 50);
      const counter = setInterval(() => {
        start += increment;
        if (start >= end) {
          setCount(end);
          clearInterval(counter);
        } else {
          setCount(Math.floor(start));
        }
      }, 50);
      return () => clearInterval(counter);
    }, delay);

    return () => clearTimeout(timer);
  }, [end, duration, delay]);

  return (
    <span className={`${started ? 'animate-[countUp_0.6s_ease-out_forwards]' : 'opacity-0'}`}>
      {count}
    </span>
  );
};

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
  const [nearbyListings, setNearbyListings] = useState([]);
  const [nearbyListingsLoading, setNearbyListingsLoading] = useState(false);

  // Community, Blogs & Guides section state
  const [homeFeaturedBlogs, setHomeFeaturedBlogs] = useState([]);
  const [homeFeaturedGuides, setHomeFeaturedGuides] = useState([]);
  const [homeTrendingPosts, setHomeTrendingPosts] = useState([]);
  const [insightsTab, setInsightsTab] = useState('community');

  // Animation states for dashboard
  const [isVisible, setIsVisible] = useState(false);
  const [statsAnimated, setStatsAnimated] = useState(false);

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

        // Fetch Community, Blogs & Guides data in parallel (non-blocking)
        Promise.allSettled([
          authenticatedFetch(`${API_BASE_URL}/api/blogs?published=true&type=blog&featured=true&limit=3`).then(r => r.ok ? r.json() : null),
          authenticatedFetch(`${API_BASE_URL}/api/blogs?published=true&type=guide&featured=true&limit=3`).then(r => r.ok ? r.json() : null),
          authenticatedFetch(`${API_BASE_URL}/api/forum?limit=3`).then(r => r.ok ? r.json() : null),
        ]).then(([blogsResult, guidesResult, postsResult]) => {
          if (blogsResult.status === 'fulfilled' && blogsResult.value?.data) setHomeFeaturedBlogs(blogsResult.value.data);
          if (guidesResult.status === 'fulfilled' && guidesResult.value?.data) setHomeFeaturedGuides(guidesResult.value.data);
          if (postsResult.status === 'fulfilled' && postsResult.value?.posts) setHomeTrendingPosts(postsResult.value.posts);
        }).catch(() => { /* silent – insights section is enhancement only */ });

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

  // Fetch nearby listings when detectedCity is available
  useEffect(() => {
    if (!detectedCity || !currentUser?._id || currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
      setNearbyListings([]);
      return;
    }
    const fetchNearbyListings = async () => {
      setNearbyListingsLoading(true);
      try {
        const res = await authenticatedFetch(
          `${API_BASE_URL}/api/listing/get?city=${encodeURIComponent(detectedCity)}&visibility=public&limit=16`
        );
        if (res.ok) {
          const data = await res.json();
          // Filter out user's own listings
          const filtered = (Array.isArray(data) ? data : []).filter(
            (l) => l.userRef !== currentUser._id && l.sellerId !== currentUser._id
          );
          setNearbyListings(filtered.slice(0, 8));
        }
      } catch (e) {
        console.error('Dashboard: nearby listings error', e);
      } finally {
        setNearbyListingsLoading(false);
      }
    };
    fetchNearbyListings();
  }, [detectedCity, currentUser?._id, currentUser?.role]);

  // STN-LIVE: Restore preferences from server (DB) on mount for returning users
  // This ensures localStorage is populated from DB after a logout/login cycle
  useEffect(() => {
    if (!currentUser?._id || currentUser.role === 'admin' || currentUser.role === 'rootadmin') return;
    restoreFromServer(currentUser._id).catch(() => { /* silent */ });
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

  // Add custom animations to head and trigger visibility
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = customAnimations;
    document.head.appendChild(style);

    // Trigger visibility for animations
    const timer = setTimeout(() => setIsVisible(true), 100);

    return () => {
      document.head.removeChild(style);
      clearTimeout(timer);
    };
  }, []);

  // Trigger stats animation when data is loaded
  useEffect(() => {
    if (!loading && (recentlyViewed.length > 0 || wishlistItems.length > 0 || watchlistItems.length > 0 || myListingsCount > 0 || upcomingAppointments.length > 0)) {
      setStatsAnimated(true);
    }
  }, [loading, recentlyViewed.length, wishlistItems.length, watchlistItems.length, myListingsCount, upcomingAppointments.length]);

  const handleSlideChange = (swiper) => {
    setCurrentSlideIndex(swiper.realIndex);
  };

  const goToSlide = (index) => {
    if (swiperRef.current && swiperRef.current.swiper) {
      swiperRef.current.swiper.slideToLoop(index);
    }
  };

  // Get one slide per listing (first image) — ensures each dot = one property
  const allSliderImages = Array.isArray(offerListings) ? offerListings
    .filter(listing => listing.imageUrls && listing.imageUrls.length > 0)
    .map(listing => ({
      url: listing.imageUrls[0],
      listingId: listing._id,
      title: listing.name || 'Featured Property',
      price: listing.offer && listing.discountPrice ? listing.discountPrice : listing.regularPrice,
      type: listing.type
    }))
  : [];

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
                {allSliderImages.map((_, idx) => (
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
                key={allSliderImages.map(img => img.listingId).join(',')}
                ref={swiperRef}
                modules={[Autoplay, Pagination, EffectFade]}
                effect="fade"
                fadeEffect={{ crossFade: true }}
                autoplay={{ delay: 5000, disableOnInteraction: false }}
                speed={1000}
                loop={true}
                onSlideChange={handleSlideChange}
                className="h-[400px] md:h-[500px] lg:h-[600px] w-full"
              >
                {allSliderImages.map((image) => (
                  <SwiperSlide key={image.listingId} className="relative">
                    <div className="absolute inset-0 bg-black/40 z-10" />
                    <img
                      src={image.url}
                      alt={image.title}
                      className="w-full h-full object-cover transform transition-transform duration-[10s] hover:scale-110"
                      style={{ animation: 'panImage 20s linear infinite alternate' }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-1.2.1&auto=format&fit=crop&w=1200&q=80';
                      }}
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

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
                {/* Recently Viewed */}
                <Link
                  to={`${linkPrefix}/search`}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 text-center group hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-2 ${isVisible ? animationClasses.scaleIn + ' animation-delay-450' : 'opacity-0 scale-95'}`}
                >
                  <div className={`bg-blue-100 dark:bg-blue-900 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-all duration-300 ${animationClasses.float} group-hover:scale-110`}>
                    <FaEye className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:text-blue-700 transition-colors duration-300" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
                    {statsAnimated ? <AnimatedCounter end={recentlyViewed.length} delay={500} /> : recentlyViewed.length}
                  </h3>
                  <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 group-hover:text-blue-500 transition-colors duration-300">Recently Viewed</p>
                </Link>

                {/* Wishlist */}
                <Link
                  to={`${linkPrefix}/wishlist`}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 text-center group hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-2 ${isVisible ? animationClasses.scaleIn + ' animation-delay-600' : 'opacity-0 scale-95'}`}
                >
                  <div className={`bg-red-100 dark:bg-red-900 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 group-hover:bg-red-200 dark:group-hover:bg-red-800 transition-all duration-300 ${animationClasses.heartbeat} group-hover:scale-110`}>
                    <FaHeart className="w-5 h-5 text-red-600 dark:text-red-400 group-hover:text-red-700 transition-colors duration-300" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors duration-300">
                    {statsAnimated ? <AnimatedCounter end={wishlistItems.length} delay={650} /> : wishlistItems.length}
                  </h3>
                  <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 group-hover:text-red-500 transition-colors duration-300">Wishlist</p>
                </Link>

                {/* Watchlist */}
                <Link
                  to={`${linkPrefix}/watchlist`}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 text-center group hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-2 ${isVisible ? animationClasses.scaleIn + ' animation-delay-750' : 'opacity-0 scale-95'}`}
                >
                  <div className={`bg-orange-100 dark:bg-orange-900 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 group-hover:bg-orange-200 dark:group-hover:bg-orange-800 transition-all duration-300 ${animationClasses.float} group-hover:scale-110`}>
                    <FaBell className="w-5 h-5 text-orange-600 dark:text-orange-400 group-hover:text-orange-700 transition-colors duration-300" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-300">
                    {statsAnimated ? <AnimatedCounter end={watchlistItems.length} delay={800} /> : watchlistItems.length}
                  </h3>
                  <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 group-hover:text-orange-500 transition-colors duration-300">Watchlist</p>
                </Link>

                {/* My Listings */}
                <Link
                  to={`${linkPrefix}/my-listings`}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 text-center group hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-2 ${isVisible ? animationClasses.scaleIn + ' animation-delay-800' : 'opacity-0 scale-95'}`}
                >
                  <div className={`bg-green-100 dark:bg-green-900 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-all duration-300 ${animationClasses.float} group-hover:scale-110`}>
                    <FaListAlt className="w-5 h-5 text-green-600 dark:text-green-400 group-hover:text-green-700 transition-colors duration-300" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors duration-300">
                    {statsAnimated ? <AnimatedCounter end={myListingsCount} delay={900} /> : myListingsCount}
                  </h3>
                  <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 group-hover:text-green-500 transition-colors duration-300">My Listings</p>
                </Link>

                {/* Upcoming Appointments */}
                <Link
                  to={`${linkPrefix}/my-appointments`}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 text-center group hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-2 col-span-2 lg:col-span-1 ${isVisible ? animationClasses.scaleIn + ' animation-delay-850' : 'opacity-0 scale-95'}`}
                >
                  <div className={`bg-purple-100 dark:bg-purple-900 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-all duration-300 ${animationClasses.float} group-hover:scale-110`}>
                    <FaCalendarAlt className="w-5 h-5 text-purple-600 dark:text-purple-400 group-hover:text-purple-700 transition-colors duration-300" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors duration-300">
                    {statsAnimated ? <AnimatedCounter end={upcomingAppointments.length} delay={1000} /> : upcomingAppointments.length}
                  </h3>
                  <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 group-hover:text-purple-500 transition-colors duration-300">Upcoming Appts</p>
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

              {/* ─── Unread Messages Quick Access ─── */}
              {currentUser && currentUser.role !== 'admin' && currentUser.role !== 'rootadmin' && totalUnreadMessages > 0 && (
                <Link
                  to={`${linkPrefix}/my-appointments`}
                  className="group block bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-5 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 animate-fade-in mt-6"
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

              {/* Recently Viewed Properties */}
              {recentlyViewedListings.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                      <span className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl shadow-lg">
                        <FaEye className="text-base" />
                      </span>
                      Recently Viewed
                    </h3>
                    <Link to={`${linkPrefix}/search`} className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 group">
                      Browse More <FaArrowRight className="text-[10px] group-hover:translate-x-1 transition-transform" />
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
            // Get actually clicked city links from localStorage (not browsing history)
            const clickedCitiesKey = `urbansetu_clicked_cities_${currentUser._id}`;
            let clickedCities = new Set();
            try {
              const stored = JSON.parse(localStorage.getItem(clickedCitiesKey) || '[]');
              clickedCities = new Set(stored.map(c => c.toLowerCase()));
            } catch { /* silent */ }

            // Helper to add city with viewed check based on actual clicks
            const addCity = (cityName, type) => {
              const key = cityName.toLowerCase();
              if (!seen.has(key)) {
                allCities.push({
                  city: cityName,
                  type,
                  isViewed: clickedCities.has(key)
                });
                seen.add(key);
              }
            };

            // 1. Current login city (highlighted)
            if (detectedCity) addCity(detectedCity, 'detected');

            // 2. Cities from other active sessions (login locations from DB)
            nearbyCities.forEach(nc => addCity(nc.city, 'nearby'));

            // 3. Browsing history cities (already marked as viewed)
            quickSearchCities.forEach(city => addCity(city, 'history'));

            // 4. Fallback popular cities (ensure we always have a good selection)
            const fallbackCities = ['Hyderabad', 'Bangalore', 'Mumbai', 'Delhi', 'Pune'];
            fallbackCities.forEach(city => {
              if (allCities.length < 8) addCity(city, 'fallback');
            });

            // Limit to 5 city pills (Present + 4 others) for a richer variety
            const displayCities = allCities.slice(0, 5);

            return (
              <section className="animate-fade-in">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                    <span className="p-1.5 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-xl shadow-lg">
                      <FaSearch className="text-base" />
                    </span>
                    Quick Search
                    {detectedCity && (
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500 ml-1">• Near {detectedCity}</span>
                    )}
                  </h3>
                  <Link to={`${linkPrefix}/search`} className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 group">
                    Advanced Search <FaArrowRight className="text-[10px] group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
                <div className="flex flex-wrap gap-3">
                  {displayCities.map((item, i) => (
                    <Link
                      key={item.city}
                      to={`/search?city=${encodeURIComponent(item.city)}`}
                      onClick={() => {
                        // Track this city click in localStorage for "Viewed" badge
                        try {
                          const stored = JSON.parse(localStorage.getItem(clickedCitiesKey) || '[]');
                          const cityLower = item.city.toLowerCase();
                          if (!stored.includes(cityLower)) {
                            stored.push(cityLower);
                            localStorage.setItem(clickedCitiesKey, JSON.stringify(stored));
                          }
                        } catch { /* silent */ }
                      }}
                      className={`group flex items-center gap-2 px-4 py-2.5 rounded-xl border shadow-sm hover:shadow-md transition-all duration-300 animate-sentinel-fade-in ${item.type === 'detected'
                          ? 'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border-indigo-200 dark:border-indigo-700 ring-1 ring-indigo-100 dark:ring-indigo-800'
                          : item.type === 'nearby'
                            ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-700'
                            : 'bg-gray-50 dark:bg-gray-800/60 border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700'
                        }`}
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <FaMapMarkerAlt className={`group-hover:scale-110 transition-transform text-sm ${item.type === 'detected' ? 'text-indigo-600 dark:text-indigo-400' : 'text-indigo-500'
                        }`} />
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {item.type === 'detected' ? `📍 Properties in ${item.city}` : `Properties in ${item.city}`}
                      </span>
                      {item.count && (
                        <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full font-bold">
                          {item.count}
                        </span>
                      )}
                      {item.isViewed && (
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

          {/* ─── Properties Near You (based on detected login city) ─── */}
          {currentUser && currentUser.role !== 'admin' && currentUser.role !== 'rootadmin' && detectedCity && (
            <section className="animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="p-1.5 bg-gradient-to-br from-rose-500 to-pink-600 text-white rounded-xl shadow-lg shrink-0">
                    <FaMapMarkerAlt className="text-base" />
                  </span>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
                      Properties Near You
                    </h3>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] sm:text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-full border border-rose-100/50 dark:border-rose-900/20">
                        📍 {detectedCity}
                      </span>
                      {nearbyListings.length > 0 && (
                        <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 text-[10px] font-black rounded-full uppercase">
                          {nearbyListings.length} found
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Link
                  to={`${linkPrefix}/search?city=${encodeURIComponent(detectedCity)}`}
                  className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 group self-start sm:self-auto"
                >
                  View All <FaArrowRight className="text-[10px] group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {nearbyListingsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <ListingSkeletonGrid count={4} />
                </div>
              ) : nearbyListings.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {nearbyListings.map((listing) => (
                    <ListingItem key={listing._id} listing={listing} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-100 dark:border-gray-700">
                  <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FaMapMarkerAlt className="text-2xl text-rose-400 dark:text-rose-500" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-semibold">No properties found near {detectedCity} yet</p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Check back soon or explore other locations</p>
                  <Link
                    to={`${linkPrefix}/search`}
                    className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-500/20 hover:shadow-xl hover:scale-105 transition-all duration-300"
                  >
                    <FaSearch className="text-xs" /> Explore All Properties
                  </Link>
                </div>
              )}
            </section>
          )}

          {/* ─── Price Drop Alerts ─── */}
          {currentUser && currentUser.role !== 'admin' && currentUser.role !== 'rootadmin' && priceDropListings.length > 0 && (
            <section className="animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                  <span className="p-1.5 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl shadow-lg">
                    <FaArrowDown className="text-base" />
                  </span>
                  Price Drop Alerts
                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-[10px] font-black rounded-full uppercase ml-1">
                    {priceDropListings.length} drop{priceDropListings.length !== 1 ? 's' : ''}
                  </span>
                </h3>
                <Link to={`${linkPrefix}/watchlist`} className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 group">
                  View Watchlist <FaArrowRight className="text-[10px] group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {priceDropListings.map((listing) => (
                  <ListingItem key={listing._id} listing={listing} />
                ))}
              </div>
            </section>
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
                              {Number.isFinite(listing.sentinelScore) && listing.sentinelScore > 0
                                ? `${Math.round(listing.sentinelScore * 100)}% MATCH`
                                : 'TOP PICK'}
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
                  <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                    <span className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg">
                      <FaStar className="text-lg sm:text-xl" />
                    </span>
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
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                  <span className="p-2 bg-gradient-to-br from-red-500 to-pink-600 text-white rounded-xl shadow-lg">
                    <FaChartLine className="text-lg sm:text-xl" />
                  </span>
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
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                  <span className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 text-white rounded-xl shadow-lg">
                    <FaGem className="text-lg sm:text-xl" />
                  </span>
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
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                  <span className="p-2 bg-gradient-to-br from-green-500 to-teal-600 text-white rounded-xl shadow-lg">
                    <FaHome className="text-lg sm:text-xl" />
                  </span>
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
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                  <span className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl shadow-lg">
                    <FaHome className="text-lg sm:text-xl" />
                  </span>
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

          {/* ─── Explore & Learn: Community, Blogs & Guides ─── */}
          {(homeTrendingPosts.length > 0 || homeFeaturedBlogs.length > 0 || homeFeaturedGuides.length > 0) && (
            <section className="animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                    <span className="p-2 bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white rounded-xl shadow-lg">
                      <FaLightbulb className="text-lg sm:text-xl" />
                    </span>
                    Explore &amp; Learn
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 ml-[52px]">Trending discussions, expert insights, and curated guides</p>
                </div>
              </div>

              {/* Tab Switcher */}
              <div className="flex gap-2 mb-8 overflow-x-auto pb-1 hide-scrollbar">
                {[
                  { id: 'community', label: 'Community', icon: FaUsers, count: homeTrendingPosts.length, bg: '#2563eb', shadow: 'rgba(37,99,235,0.25)' },
                  { id: 'blogs', label: 'Blog Insights', icon: FaNewspaper, count: homeFeaturedBlogs.length, bg: '#4f46e5', shadow: 'rgba(79,70,229,0.25)' },
                  { id: 'guides', label: 'Guides', icon: FaGraduationCap, count: homeFeaturedGuides.length, bg: '#9333ea', shadow: 'rgba(147,51,234,0.25)' },
                ].filter(t => t.count > 0).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setInsightsTab(tab.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all duration-300 border ${
                      insightsTab === tab.id
                        ? 'text-white border-transparent'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    style={insightsTab === tab.id ? {
                      backgroundColor: tab.bg,
                      borderColor: tab.bg,
                      boxShadow: `0 10px 15px -3px ${tab.shadow}`
                    } : {}}
                  >
                    <tab.icon className="text-sm" />
                    {tab.label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                      insightsTab === tab.id
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Community Trending Posts */}
              {insightsTab === 'community' && homeTrendingPosts.length > 0 && (
                <div className="space-y-4 animate-fade-in">
                  {homeTrendingPosts.map((post, idx) => (
                    <Link
                      key={post._id}
                      to={currentUser ? `/user/community/${post._id}` : `/community/${post._id}`}
                      className="group block bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 dark:border-gray-700 p-5 transition-all duration-300 hover:-translate-y-0.5"
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-lg">
                          {post.author?.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-bold text-gray-900 dark:text-white text-sm">{post.author?.username || 'Community Member'}</span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">•</span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                              {new Date(post.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                            </span>
                            {post.category && (
                              <span className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold uppercase">
                                {post.category}
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-gray-900 dark:text-white mb-1 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {post.title}
                          </h3>
                          <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 leading-relaxed">
                            {post.content?.replace(/@\[[^\]]+\]\([^)]+\)/g, '').substring(0, 150)}
                          </p>
                          <div className="flex items-center gap-4 mt-3">
                            <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 font-medium">
                              <FaThumbsUp className="text-[10px]" /> {post.likes?.length || 0}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 font-medium">
                              <FaComment className="text-[10px]" /> {post.comments?.length || 0}
                            </span>
                            <span className="ml-auto text-xs text-blue-600 dark:text-blue-400 font-bold group-hover:underline flex items-center gap-1">
                              Join Discussion <FaArrowRight className="text-[10px] group-hover:translate-x-1 transition-transform" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                  <div className="text-center mt-4">
                    <Link
                      to={currentUser ? '/user/community' : '/community'}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold text-sm rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors border border-blue-100 dark:border-blue-800"
                    >
                      <FaUsers className="text-sm" /> View All Discussions <FaArrowRight className="text-xs" />
                    </Link>
                  </div>
                </div>
              )}

              {/* Featured Blog Insights */}
              {insightsTab === 'blogs' && homeFeaturedBlogs.length > 0 && (
                <div className="animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {homeFeaturedBlogs.map((blog, idx) => (
                      <Link
                        to={`/blog/${blog.slug || blog._id}`}
                        key={blog._id}
                        className="group relative h-80 md:h-96 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer border border-gray-100 dark:border-gray-800"
                        style={{ animationDelay: `${idx * 120}ms` }}
                      >
                        <AdvancedImage
                          src={blog.thumbnail || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1073&q=80'}
                          alt={blog.title}
                          className="absolute inset-0 w-full h-full transition-transform duration-700 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                        <div className="absolute bottom-0 left-0 p-6 w-full">
                          <div className="flex items-center gap-3 text-xs font-bold text-blue-300 uppercase tracking-wider mb-3">
                            <span className="bg-blue-600/90 backdrop-blur-md px-2 py-1 rounded-md">{blog.category}</span>
                            <span>•</span>
                            <span>{Math.ceil((blog.content ? blog.content.split(/\s+/).length : 0) / 200)} min read</span>
                          </div>
                          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-300 transition-colors leading-tight line-clamp-2">
                            {blog.title}
                          </h3>
                          <p className="text-gray-300 text-sm line-clamp-2 mb-3 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                            {blog.excerpt || (blog.content ? blog.content.substring(0, 100) : '')}
                          </p>
                          <div className="flex items-center gap-2 text-white font-bold text-sm">
                            Read Article <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="text-center mt-6">
                    <Link
                      to="/blogs"
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold text-sm rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors border border-indigo-100 dark:border-indigo-800"
                    >
                      <FaNewspaper className="text-sm" /> Browse All Blogs <FaArrowRight className="text-xs" />
                    </Link>
                  </div>
                </div>
              )}

              {/* Featured Guide Collections */}
              {insightsTab === 'guides' && homeFeaturedGuides.length > 0 && (
                <div className="animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {homeFeaturedGuides.map((guide, idx) => (
                      <Link
                        to={`/guide/${guide.slug || guide._id}`}
                        key={guide._id}
                        className="group relative h-80 md:h-96 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer border border-gray-100 dark:border-gray-800"
                        style={{ animationDelay: `${idx * 120}ms` }}
                      >
                        <AdvancedImage
                          src={guide.thumbnail || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1073&q=80'}
                          alt={guide.title}
                          className="absolute inset-0 w-full h-full transition-transform duration-700 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                        <div className="absolute bottom-0 left-0 p-6 w-full">
                          <div className="flex items-center gap-3 text-xs font-bold text-purple-300 uppercase tracking-wider mb-3">
                            <span className="bg-purple-600/90 backdrop-blur-md px-2 py-1 rounded-md">{guide.category}</span>
                            <span>•</span>
                            <span>{Math.ceil((guide.content ? guide.content.split(/\s+/).length : 0) / 200)} min read</span>
                          </div>
                          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors leading-tight line-clamp-2">
                            {guide.title}
                          </h3>
                          <p className="text-gray-300 text-sm line-clamp-2 mb-3 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                            {guide.excerpt || (guide.content ? guide.content.substring(0, 100) : '')}
                          </p>
                          <div className="flex items-center gap-2 text-white font-bold text-sm">
                            Read Guide <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="text-center mt-6">
                    <Link
                      to="/guides"
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-bold text-sm rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors border border-purple-100 dark:border-purple-800"
                    >
                      <FaGraduationCap className="text-sm" /> Explore All Guides <FaArrowRight className="text-xs" />
                    </Link>
                  </div>
                </div>
              )}
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