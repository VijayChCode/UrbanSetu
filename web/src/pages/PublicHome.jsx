import React, { useEffect, useState, useRef } from "react";
import PublicHomeSkeleton from "../components/skeletons/PublicHomeSkeleton";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, EffectFade } from "swiper/modules";
import "swiper/css/bundle";
import "swiper/css/effect-fade";
import "swiper/css/pagination";
import ListingItem from "../components/ListingItem";
import ContactSupportWrapper from '../components/ContactSupportWrapper';
import GeminiAIWrapper from '../components/GeminiAIWrapper';
import SEO from '../components/SEO';
import Typewriter from "../components/ui/Typewriter";
import {
  FaHome, FaSearch, FaHeart, FaStar, FaMapMarkerAlt, FaPhone, FaEnvelope,
  FaShieldAlt, FaAward, FaUsers, FaChartLine, FaLightbulb, FaRocket, FaGem,
  FaQuoteLeft, FaQuoteRight, FaCheckCircle, FaClock, FaHandshake, FaGlobe,
  FaMobile, FaDesktop, FaTablet, FaInfoCircle, FaArrowRight
} from "react-icons/fa";
import SeasonalEffects from "../components/SeasonalEffects";
import DailyQuote from "../components/DailyQuote";
import { useSeasonalTheme, useAllSeasonalThemes } from "../hooks/useSeasonalTheme.jsx";
import ThemeDetailModal from "../components/ThemeDetailModal";

import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function PublicHome() {
  const theme = useSeasonalTheme();
  const allThemes = useAllSeasonalThemes();
  const navigate = useNavigate();
  const { currentUser } = useSelector((state) => state.user);

  // Redirect if logged in
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
        navigate('/admin');
      } else {
        navigate('/user');
      }
    }
  }, [currentUser, navigate]);

  const [offerListings, setOfferListings] = useState([]);
  const [saleListings, setSaleListings] = useState([]);
  const [rentListings, setRentListings] = useState([]);
  const [isSliderVisible, setIsSliderVisible] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [stats, setStats] = useState({ properties: 0, users: 0, transactions: 0, satisfaction: 0 });
  const swiperRef = useRef(null);
  const [showThemeInfo, setShowThemeInfo] = useState(false);

  const [loading, setLoading] = useState(true);

  const homeSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "name": "UrbanSetu",
        "url": window.location.origin + "/",
        "potentialAction": {
          "@type": "SearchAction",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": window.location.origin + "/search?searchTerm={search_term_string}"
          },
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "Organization",
        "name": "UrbanSetu",
        "url": window.location.origin + "/",
        "logo": window.location.origin + "/favicon.ico",
        "sameAs": [
          "https://facebook.com/urbansetu",
          "https://instagram.com/urbansetu",
          "https://youtube.com/@urbansetu"
        ],
        "contactPoint": {
          "@type": "ContactPoint",
          "telephone": "+91-XXXXXXXXXX",
          "contactType": "customer service"
        }
      }
    ]
  };

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);

        const [
          offerRes,
          rentRes,
          saleRes,
          statsRes
        ] = await Promise.all([
          authenticatedFetch(`${API_BASE_URL}/api/listing/get?offer=true&visibility=public`),
          authenticatedFetch(`${API_BASE_URL}/api/listing/get?type=rent&visibility=public`),
          authenticatedFetch(`${API_BASE_URL}/api/listing/get?type=sale&visibility=public`),
          Promise.all([
            authenticatedFetch(`${API_BASE_URL}/api/listing/count`),
            authenticatedFetch(`${API_BASE_URL}/api/user/count`)
          ])
        ]);

        // Helper to safely parse JSON
        const safeJson = async (res) => {
          if (res.ok) {
            try {
              return await res.json();
            } catch {
              return [];
            }
          }
          return [];
        }

        const offerData = await safeJson(offerRes);
        const rentData = await safeJson(rentRes);
        const saleData = await safeJson(saleRes);

        const [propsRes, usersRes] = statsRes;
        const propsData = await safeJson(propsRes);
        const uData = await safeJson(usersRes);

        setOfferListings(Array.isArray(offerData) ? offerData : []);
        setRentListings(Array.isArray(rentData) ? rentData : []);
        setSaleListings(Array.isArray(saleData) ? saleData : []);

        setStats({
          properties: Number(propsData.count) || 1250,
          users: Number(uData.count) || 5000,
          transactions: 2500,
          satisfaction: 98
        });

      } catch (error) {
        console.error("Error fetching public home data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // Trigger slider visibility logic
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSliderVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSlideChange = (swiper) => {
    setCurrentSlideIndex(swiper.realIndex);
  };

  const description = "Discover verified properties for sale and rent across India. UrbanSetu offers AI-powered real estate recommendations, virtual tours, and secure transactions.";
  const keywords = "real estate India, buy property Hyderabad, rent home Bangalore, verified listings, smart real estate, UrbanSetu, virtual property tours";

  if (loading) {
    return (
      <>
        <SEO
          title="Find Your Dream Home · Smart Real Estate India"
          description={description}
          keywords={keywords}
          schema={homeSchema}
        />
        {/* SEO-only content for crawlers even in loading state */}
        <div className="sr-only">
          <h2>UrbanSetu · Smart Real Estate Platform in India</h2>
          <p>Explore verified properties for sale and rent across India with UrbanSetu. Our smart platform offers AI recommendations, virtual tours, and secure transactions in Hyderabad, Bangalore, Mumbai, and more. UrbanSetu is India's most trusted real estate ecosystem designed for modern property seekers. Whether you're looking for a luxury villa in Hyderabad, a budget-friendly apartment in Bangalore, or a commercial space in Mumbai, our platform provides comprehensive data and verified listings to ensure a smooth journey.</p>
          <p>Our mission is to eliminate friction in real estate transactions. With features like Rent Lock, AI-powered price insights, and direct communication with owners, UrbanSetu empowers users to make informed decisions. We understand that finding a home is more than just a transaction; it's a significant life event. That's why we've built a platform that priorities trust, transparency, and technology.</p>
          <p>Join thousands of satisfied users who have found their perfect home through UrbanSetu. Our platform is accessible on all devices, ensuring you can browse properties, connect with agents, and track your applications from anywhere, at any time. Start your real estate journey today with the most advanced property portal in India.</p>
          <nav>
            <a href="/search">Search Properties</a>
            <a href="/about">About UrbanSetu</a>
            <a href="/blogs">Real Estate Insights</a>
            <a href="/agents">Verified Agents</a>
            <a href="/guides">Property Buying Guides</a>
            <a href="/help-center">Support Center</a>
          </nav>
        </div>
        <PublicHomeSkeleton />
      </>
    );
  }

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

  // Slider logic...


  return (
    <div className="bg-gray-50 dark:bg-gray-950 min-h-screen relative overflow-hidden font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <SEO
        title="Find Your Dream Home - Smart Real Estate Platform in India"
        description={description}
        keywords={keywords}
        schema={homeSchema}
      />
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
            @keyframes panImage {
                0% { transform: scale(1.1) translateX(0); }
                100% { transform: scale(1.2) translateX(-20px); }
            }
            .animate-blob { animation: blob 10s infinite; }
            .animate-fade-in { animation: fadeIn 0.8s ease-out forwards; }
            .animate-fade-in-delay { animation: fadeIn 0.8s ease-out 0.2s forwards; opacity: 0; }
            .animate-float { animation: float 6s ease-in-out infinite; }
            .glass-card { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.3); }
            .dark .glass-card { background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); }
        `}
      </style>

      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-300 dark:bg-blue-900/40 rounded-full mix-blend-multiply dark:mix-blend-overlay filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-300 dark:bg-purple-900/40 rounded-full mix-blend-multiply dark:mix-blend-overlay filter blur-3xl opacity-30 animate-blob" style={{ animationDelay: "2s" }}></div>
        <div className="absolute top-[20%] left-[20%] w-72 h-72 bg-pink-300 dark:bg-pink-900/40 rounded-full mix-blend-multiply dark:mix-blend-overlay filter blur-3xl opacity-30 animate-blob" style={{ animationDelay: "4s" }}></div>
        <div className="absolute bottom-[-10%] right-[20%] w-96 h-96 bg-yellow-200 dark:bg-yellow-900/40 rounded-full mix-blend-multiply dark:mix-blend-overlay filter blur-3xl opacity-30 animate-blob" style={{ animationDelay: "6s" }}></div>
      </div>

      <div className="relative z-10">

        {/* SEO-only content for crawlers */}
        <div className="sr-only">
          <h2>UrbanSetu · Smart Real Estate Platform in India</h2>
          <p>Buy, sell, and rent verified properties across India with UrbanSetu. Our smart ecosystem provides AI-powered property recommendations, real-time chat with owners, 3D virtual tours, and verified listings to ensure trust and transparency. We cover all major cities including Delhi, Chennai, Pune, and Kolkata, offering a wide range of options from residential flats to industrial plots.</p>
          <p>UrbanSetu stands out by offering unique features such as AI-driven virtual staging, allowing you to visualize your future home before you even visit. Our secure payment gateway and documented transaction history provide peace of mind for both landlords and tenants. For sellers and agents, UrbanSetu offers advanced lead management and market analytic tools to maximize property visibility and sales efficiency.</p>
          <p>Our commitment to user safety is paramount. Every listing undergoes a rigorous verification process, and our community-driven rating system ensures that only the best agents and properties are highlighted. Discover why UrbanSetu is the preferred choice for real estate in India. Whether you are a first-time homebuyer or a seasoned investor, our platform provides the tools and insights you need to succeed in the dynamic Indian property market.</p>
          <h2>Advanced Real Estate Tools</h2>
          <ul>
            <li>AI-Powered Property Search & Recommendations</li>
            <li>3D Virtual Home Tours & AR Visualizations</li>
            <li>Direct Chat with Property Owners & Instant Notifications</li>
            <li>Verified Listings for Buyers, Tenants, and Investors</li>
            <li>Real Estate Investment Analytics & Market Trends</li>
            <li>Rent Lock & Secure Rental Management Systems</li>
          </ul>
          <nav>
            <a href="/search?type=sale">Buy Property</a>
            <a href="/search?type=rent">Rent a Home</a>
            <a href="/blogs">Real Estate News</a>
            <a href="/agents">Find an Agent</a>
            <a href="/market-trends">Market Trends</a>
          </nav>
        </div>

        {/* Hero Section */}
        <div className="relative pt-20 pb-16 lg:pt-32 lg:pb-28 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-semibold mb-8 animate-fade-in border border-blue-100 dark:border-blue-800 shadow-sm transition-colors">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 dark:bg-blue-600 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
              {theme ? (
                <span
                  className="flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setShowThemeInfo(true)}
                  title={allThemes.length > 1 ? allThemes.map(t => t.name).join(' & ') : theme.name}
                >
                  <span className="flex items-center gap-1">
                    {allThemes.map((t, i) => (
                      <span key={i}>{t.icon}</span>
                    ))}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-1">
                    <span className="text-gray-900 dark:text-white font-medium">
                      {(theme?.greeting || "#1 Real Estate Platform in India").split(' ')[0]}
                    </span>
                    <span className="flex items-center">
                      {allThemes.length > 1 ? (
                        allThemes.map((t, i) => {
                          const parts = t.greeting.replace(/[.!]$/, '').split(' ');
                          const festivalName = parts.slice(1).join(' ');
                          return (
                            <span key={i} className="flex items-center">
                              <span className="ml-1 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 font-extrabold">
                                {festivalName}
                              </span>
                              {i < allThemes.length - 2 ? (
                                <span className="text-gray-500 dark:text-white/60 mx-1">,</span>
                              ) : i === allThemes.length - 2 ? (
                                <span className="text-gray-500 dark:text-white/60 mx-1.5">&</span>
                              ) : null}
                            </span>
                          );
                        })
                      ) : (
                        theme?.greeting && (
                          <span className="ml-1 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 font-extrabold">
                            {theme.greeting.split(' ').slice(1).join(' ').replace(/[.!]$/, '')}
                          </span>
                        )
                      )}
                    </span>
                  </span>
                </span>
              ) : (
                "#1 Real Estate Platform in India"
              )}
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

            <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-600 dark:text-gray-400 mb-10 animate-fade-in-delay transition-colors" style={{ animationDelay: "0.4s" }}>
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
                className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
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
                <div key={index} className="glass-card p-6 rounded-2xl shadow-lg border border-white/50 dark:border-white/10 hover:transform hover:-translate-y-1 transition-all duration-300">
                  <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center mx-auto mb-3 transition-colors`}>
                    <stat.icon className={`text-2xl ${stat.color}`} />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">{typeof stat.value === 'number' ? stat.value.toLocaleString() + '+' : stat.value}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 font-medium transition-colors">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Featured Slider */}
        {allSliderImages.length > 0 && isSliderVisible && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 animate-fade-in">
            <div className="flex flex-col items-center mb-8 gap-4 text-center">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">Featured Properties</h2>
                <p className="text-gray-600 dark:text-gray-400 transition-colors">Handpicked premium properties just for you</p>
              </div>
              <div className="flex gap-2">
                {allSliderImages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => goToSlide(idx)}
                    className={`h-2 rounded-full transition-all duration-300 ${currentSlideIndex === idx ? 'w-8 bg-blue-600 dark:bg-blue-500' : 'w-2 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600'}`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>

            <div 
              className="rounded-3xl overflow-hidden shadow-2xl relative group bg-gray-900"
              onMouseEnter={() => {
                if (swiperRef.current && swiperRef.current.swiper) {
                  swiperRef.current.swiper.autoplay.stop();
                }
              }}
              onMouseLeave={() => {
                if (swiperRef.current && swiperRef.current.swiper) {
                  swiperRef.current.swiper.autoplay.start();
                }
              }}
            >
              <Swiper
                key={allSliderImages.map(img => img.listingId).join(',')}
                ref={swiperRef}
                modules={[Autoplay, Pagination, EffectFade]}
                effect="fade"
                fadeEffect={{ crossFade: true }}
                autoplay={{ delay: 5000, disableOnInteraction: false }}
                speed={1000}
                loop={true}
                lazyPreloadPrevNext={1}
                onSlideChange={handleSlideChange}
                className="h-[400px] md:h-[500px] lg:h-[600px] w-full"
              >
                {allSliderImages.map((image) => (
                  <SwiperSlide key={image.listingId} className="relative">
                    <div className="absolute inset-0 bg-black/40 z-10" />
                    <img
                      src={image.url}
                      alt={image.title}
                      loading="lazy"
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
                          <span className="px-3 py-1 bg-blue-600/90 dark:bg-blue-500/90 backdrop-blur-md text-white text-xs font-bold rounded-full uppercase tracking-wider">
                            {image.type === 'rent' ? 'For Rent' : 'For Sale'}
                          </span>
                          {image.price && (
                            <span className="px-3 py-1 bg-white/20 dark:bg-black/20 backdrop-blur-md text-white text-xs font-bold rounded-full border border-white/30 dark:border-white/10">
                              ₹ {image.price.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                        <h3 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-2 leading-tight">
                          {image.title}
                        </h3>
                        <Link
                          to={`/listing/${image.listingId}`}
                          className="inline-flex items-center gap-2 text-white hover:text-blue-300 dark:hover:text-blue-400 font-medium mt-2 transition-colors group/link"
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

          {/* Offer Listings */}
          {offerListings.length > 0 && (
            <section>
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3 transition-colors">
                  <span className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400 transition-colors"><FaGem className="text-lg sm:text-xl" /></span>
                  Exclusive Offers
                </h2>
                <Link to="/search?offer=true" className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-sm sm:text-base whitespace-nowrap">
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
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3 transition-colors">
                  <span className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400 transition-colors"><FaHome className="text-lg sm:text-xl" /></span>
                  Homes for Rent
                </h2>
                <Link to="/search?type=rent" className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-sm sm:text-base whitespace-nowrap">
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
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3 transition-colors">
                  <span className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400 transition-colors"><FaHome className="text-lg sm:text-xl" /></span>
                  Homes for Sale
                </h2>
                <Link to="/search?type=sale" className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-sm sm:text-base whitespace-nowrap">
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

          {/* How It Works Section - Restored & Modernized */}
          <section>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 transition-colors">How It Works</h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto transition-colors">Your journey to a new home in 4 simple steps.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { icon: FaSearch, title: "Search", desc: "Filter and find your dream property.", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30" },
                { icon: FaHeart, title: "Save", desc: "Shortlist your favorites easily.", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/30" },
                { icon: FaPhone, title: "Connect", desc: "Contact agents or owners directly.", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/30" },
                { icon: FaHandshake, title: "Deal", desc: "Close the deal securely.", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/30" }
              ].map((step, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 text-center hover:shadow-md transition-all duration-300">
                  <div className={`w-16 h-16 ${step.bg} rounded-full flex items-center justify-center mx-auto mb-4 transition-colors`}>
                    <step.icon className={`text-2xl ${step.color}`} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">{step.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm transition-colors">{step.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Why Choose Us */}
          <section className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 p-8 md:p-12 relative overflow-hidden transition-colors duration-300">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 rounded-bl-full -mr-20 -mt-20 opacity-50 pointer-events-none"></div>

            <div className="text-center mb-12 relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 transition-colors">Why Choose UrbanSetu?</h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto transition-colors">We provide a premium, secure, and seamless real estate experience tailored to your needs.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
              {[
                { icon: FaSearch, title: "Smart Search", desc: "AI-powered search filters to find exactly what you need.", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30" },
                { icon: FaShieldAlt, title: "Secure & Verified", desc: "All listings are verified for your peace of mind.", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/30" },
                { icon: FaRocket, title: "Fast Processing", desc: "Quick documentation and approval process.", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/30" },
                { icon: FaHeart, title: "24/7 Support", desc: "Dedicated support team available round the clock.", color: "text-red-500 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/30" },
                { icon: FaDesktop, title: "Cross-Platform", desc: "Seamless experience across Mobile, Tablet, and Desktop.", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30" },
                { icon: FaGem, title: "Premium Listings", desc: "Access to exclusive luxury properties.", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/30" }
              ].map((feature, idx) => (
                <div key={idx} className="flex gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-300">
                  <div className={`w-12 h-12 ${feature.bg} rounded-xl flex-shrink-0 flex items-center justify-center transition-colors`}>
                    <feature.icon className={`text-xl ${feature.color}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 transition-colors">{feature.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed transition-colors">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Multi-Platform Access - Restored */}
          <section className="py-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 transition-colors">Access From Anywhere</h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto transition-colors">Enjoy a seamless experience across all your favorite devices.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { icon: FaDesktop, title: "Desktop", desc: "Full-featured experience." },
                { icon: FaMobile, title: "Mobile", desc: "Optimized for your pocket." },
                { icon: FaTablet, title: "Tablet", desc: "Perfect for browsing on the go." }
              ].map((platform, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center hover:-translate-y-1 transition-all">
                  <div className="w-14 h-14 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-3 text-gray-700 dark:text-gray-300 text-2xl transition-colors">
                    <platform.icon />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white transition-colors">{platform.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors">{platform.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Testimonials */}
          <section>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 transition-colors">Trusted by Thousands</h2>
              <p className="text-gray-600 dark:text-gray-400 transition-colors">See what our community has to say about their experience.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { name: "Priya Sharma", role: "Home Buyer", quote: "Found my dream apartment in just 2 days! The interface is so intuitive.", bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-600 dark:text-blue-400" },
                { name: "Rajesh Kumar", role: "Property Investor", quote: "The best platform for real estate analytics and verified listings.", bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-600 dark:text-green-400" },
                { name: "Anjali Patel", role: "Tenant", quote: "Seamless rental process. The support team was incredibly helpful.", bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-600 dark:text-purple-400" }
              ].map((t, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 hover:-translate-y-2 transition-all duration-300">
                  <FaQuoteLeft className={`text-4xl ${t.text} opacity-20 mb-4`} />
                  <p className="text-gray-600 dark:text-gray-400 italic mb-6 transition-colors">"{t.quote}"</p>
                  <div className="flex items-center mb-6">
                    {[...Array(5)].map((_, starIndex) => (
                      <FaStar key={starIndex} className="text-yellow-400 text-sm animate-pulse" style={{ animationDelay: `${starIndex * 0.1}s` }} />
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${t.bg} flex items-center justify-center font-bold ${t.text} transition-colors`}>
                      {t.name[0]}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white transition-colors">{t.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide transition-colors">{t.role}</p>
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
                <Link to="/sign-up" className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-xl font-bold text-lg hover:bg-white hover:text-blue-700 transition-all">
                  Create Account
                </Link>
              </div>
            </div>
          </section>

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