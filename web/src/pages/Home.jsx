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
import {
  FaHome, FaSearch, FaHeart, FaStar, FaMapMarkerAlt, FaPhone, FaEnvelope,
  FaShieldAlt, FaAward, FaUsers, FaChartLine, FaLightbulb, FaRocket, FaGem,
  FaQuoteLeft, FaQuoteRight, FaCheckCircle, FaClock, FaHandshake, FaGlobe,
  FaMobile, FaDesktop, FaTablet, FaInfoCircle, FaArrowRight, FaRobot
} from "react-icons/fa";
import AdsterraBanner from "../components/AdsterraBanner";
import SeasonalEffects from "../components/SeasonalEffects";
import DailyQuote from "../components/DailyQuote";
import { useSeasonalTheme } from "../hooks/useSeasonalTheme";
import ThemeDetailModal from "../components/ThemeDetailModal";
import { authenticatedFetch } from "../utils/auth";
import { getLiveRecommendations } from "../utils/sentinelLiveEngine";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function Home() {
  const theme = useSeasonalTheme();
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

      // Combine wishlist and watchlist interactions
      const userPreferences = [...wishlistItems, ...watchlistItems];
      const uniquePreferences = Array.from(new Map(userPreferences.filter(p => p && p._id).map(item => [item._id, item])).values());

      // Request all matches (limit 1000) to allow infinite "View More"
      const recs = await getLiveRecommendations(uniqueCandidates, 1000, uniquePreferences);
      setLiveRecommendations(recs);
    };

    processLiveRecs();
  }, [loading, offerListings, rentListings, saleListings, wishlistItems, watchlistItems, currentUser?._id, currentUser?.role]);

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
                    const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
                    // Use seasonal icon if available, otherwise time-based emoji
                    const emoji = theme ? theme.icon : (hour < 12 ? '☀️' : hour < 18 ? '🌤️' : '🌙');

                    return (
                      <span className="text-lg sm:text-xl font-bold flex flex-wrap items-center justify-center text-center gap-x-2 gap-y-1">
                        <span className="text-gray-700 dark:text-gray-200">{theme?.greeting || greet},</span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 break-words max-w-[200px] sm:max-w-none truncate">
                          <EncryptedText text={`${name}!`} />
                        </span>
                        <span
                          className={`animate-bounce inline-block ml-1 text-2xl filter drop-shadow-md ${theme ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
                          onClick={() => theme && setShowThemeInfo(true)}
                          title={theme ? theme.name : "Greetings"}
                        >
                          {emoji}
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

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6 animate-fade-in-delay min-h-[1.2em]">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
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
                />
              </span>
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

          {/* Sentinel Live Section (Real-time Session Based) - regular users only */}
          {currentUser && currentUser.role !== 'admin' && currentUser.role !== 'rootadmin' && liveRecommendations.length > 0 && (
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
                          Recommending based on your current session
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-1 font-medium italic">Tensor-mode active</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {liveRecommendations.slice(0, visibleRecsCount).map((listing) => (
                    <div key={`live-${listing._id}`} className="relative group">
                      <div className="absolute -top-2 -right-2 z-20 bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg transform rotate-12 group-hover:rotate-0 transition-transform">
                        {Math.round(listing.sentinelScore * 100)}% MATCH
                      </div>
                      <ListingItem listing={listing} />
                    </div>
                  ))}
                </div>

                {liveRecommendations.length > visibleRecsCount && (
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

          {/* Ads Section */}
          <div className="text-center py-6">
            <p className="text-xs text-gray-400 mb-2 font-mono">SPONSORED CONTENT Coming Soon...</p>
            {/* <AdsterraBanner /> */}
          </div>
        </div>

      </div>

      <ContactSupportWrapper />
      <GeminiAIWrapper />
      <ThemeDetailModal
        theme={theme}
        isOpen={showThemeInfo}
        onClose={() => setShowThemeInfo(false)}
      />
    </div>
  );
}
