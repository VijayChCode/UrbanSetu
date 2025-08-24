import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, EffectFade } from "swiper/modules";
import "swiper/css/bundle";
import "swiper/css/effect-fade";
import "swiper/css/pagination";
import ListingItem from "../components/ListingItem";
import GeminiAIWrapper from "../components/GeminiAIWrapper";
import ContactSupportWrapper from '../components/ContactSupportWrapper';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function PublicHome() {
  const [offerListings, setOfferListings] = useState([]);
  const [saleListings, setSaleListings] = useState([]);
  const [rentListings, setRentListings] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isSliderVisible, setIsSliderVisible] = useState(false);
  const swiperRef = useRef(null);

  useEffect(() => {
    const fetchOfferListings = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/listing/get?offer=true`); // removed &limit=6
        const data = await res.json();
        setOfferListings(data);
      } catch (error) {
        console.error("Error fetching offer listings", error);
      }
    };

    const fetchRentListings = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/listing/get?type=rent`); // removed &limit=6
        const data = await res.json();
        setRentListings(data);
      } catch (error) {
        console.error("Error fetching rent listings", error);
      }
    };

    const fetchSaleListings = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/listing/get?type=sale`); // removed &limit=6
        const data = await res.json();
        setSaleListings(data);
      } catch (error) {
        console.error("Error fetching sale listings", error);
      }
    };

    fetchOfferListings();
    fetchRentListings();
    fetchSaleListings();
  }, []);

  // Trigger slider visibility animation after component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSliderVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSlideChange = (swiper) => {
    setCurrentSlideIndex(swiper.realIndex);
  };

  const goToSlide = (index) => {
    if (swiperRef.current && swiperRef.current.swiper) {
      swiperRef.current.swiper.slideTo(index);
    }
  };

  // Get all images from offer listings for the slider
  const allSliderImages = offerListings.flatMap(listing =>
    (listing.imageUrls || []).map((img, idx) => ({
      url: img,
      listingId: listing._id,
      title: listing.name || 'Featured Property',
      price: listing.regularPrice,
      type: listing.type
    }))
  );

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen">
      {/* Hero Section */}
      <div className="text-center py-10 bg-gradient-to-r from-blue-600 to-purple-600 text-white animate-fade-in-down">
        <h1 className="text-4xl font-extrabold animate-fade-in">Find Your Dream Home</h1>
        <p className="mt-2 text-lg animate-fade-in delay-200">Discover the best homes at unbeatable prices</p>
        <Link to="/search" className="mt-4 inline-block bg-white text-blue-600 font-semibold px-6 py-3 rounded-lg shadow-md hover:bg-gray-200 hover:scale-105 transition-all animate-fade-in-up delay-300">
          Start Exploring
        </Link>
      </div>

      {/* Enhanced Photo Slider Gallery */}
      {allSliderImages.length > 0 && (
        <div className={`my-12 mx-auto max-w-6xl px-4 transition-all duration-1000 ease-out animate-slider-fade-in ${
          isSliderVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          {/* Slider Header */}
          <div className="text-center mb-6 animate-slider-slide-up">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Featured Properties</h2>
            <p className="text-gray-600">Explore our handpicked selection of premium homes</p>
          </div>

          {/* Main Slider Container */}
          <div className="relative group animate-slider-scale-in">
            {/* Enhanced Swiper */}
            <Swiper
              ref={swiperRef}
              modules={[Autoplay, Pagination, EffectFade]}
              pagination={{
                clickable: true,
                dynamicBullets: true,
                renderBullet: function (index, className) {
                  return `<span class="${className} w-3 h-3 bg-white/60 hover:bg-white transition-all duration-300"></span>`;
                },
              }}
              autoplay={{ 
                delay: 4000, 
                disableOnInteraction: false,
                pauseOnMouseEnter: true
              }}
              loop={true}
              effect="fade"
              fadeEffect={{
                crossFade: true
              }}
              speed={800}
              onSlideChange={handleSlideChange}
              className="rounded-2xl shadow-2xl overflow-hidden hover:animate-slider-glow"
            >
              {allSliderImages.map((image, idx) => (
                <SwiperSlide key={`${image.listingId}-${idx}`} className="relative">
                  <div className="relative h-80 md:h-96 lg:h-[500px] overflow-hidden">
                    <img 
                      src={image.url} 
                      className="w-full h-full object-cover transition-transform duration-700 hover:scale-110" 
                      alt={image.title}
                      loading="lazy"
                    />
                    {/* Image Overlay with Property Info */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent animate-overlay-fade-in">
                      <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                        <h3 className="text-xl md:text-2xl font-bold mb-2 animate-text-slide-up">
                          {image.title}
                        </h3>
                        <div className="flex items-center gap-4 text-sm md:text-base">
                          <span className="bg-blue-600 px-3 py-1 rounded-full font-semibold animate-price-pulse">
                            ${image.price?.toLocaleString() || 'Contact for Price'}
                          </span>
                          <span className="bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm animate-type-badge">
                            {image.type?.charAt(0).toUpperCase() + image.type?.slice(1) || 'Property'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>



            {/* Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out animate-progress-fill"
                style={{ 
                  width: `${((currentSlideIndex + 1) / allSliderImages.length) * 100}%`,
                  '--progress-width': `${((currentSlideIndex + 1) / allSliderImages.length) * 100}%`
                }}
              />
            </div>

            {/* Thumbnail Navigation */}
            <div className="mt-4 flex justify-center gap-2 overflow-x-auto pb-2">
              {allSliderImages.slice(0, 8).map((image, idx) => (
                <button
                  key={idx}
                  onClick={() => goToSlide(idx)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-300 hover:scale-110 animate-thumbnail-bounce ${
                    currentSlideIndex === idx 
                      ? 'border-blue-500 ring-2 ring-blue-300' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  style={{ animationDelay: `${idx * 0.1}s` }}
                >
                  <img 
                    src={image.url} 
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Listings Section */}
      <div className="max-w-6xl w-full mx-auto px-2 sm:px-4 md:px-8 py-8 overflow-x-hidden">
        {/* Offer Listings */}
        {offerListings.length > 0 && (
          <div className="mb-8 bg-white rounded-xl shadow-lg p-6 animate-fade-in-up delay-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-blue-700 animate-slide-in-left">🔥 Exclusive Offers</h2>
              <Link to="/search?offer=true" className="text-blue-600 hover:underline">View All Offers</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {offerListings.map((listing) => (
                <div className="transition-transform duration-300 hover:scale-105 hover:shadow-xl" key={listing._id}>
                  <ListingItem listing={listing} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rent Listings */}
        {rentListings.length > 0 && (
          <div className="mb-8 bg-white rounded-xl shadow-lg p-6 animate-fade-in-up delay-900">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-blue-700 animate-slide-in-left delay-200">🏡 Homes for Rent</h2>
              <Link to="/search?type=rent" className="text-blue-600 hover:underline">View All Rentals</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {rentListings.map((listing) => (
                <div className="transition-transform duration-300 hover:scale-105 hover:shadow-xl" key={listing._id}>
                  <ListingItem listing={listing} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sale Listings */}
        {saleListings.length > 0 && (
          <div className="mb-8 bg-white rounded-xl shadow-lg p-6 animate-fade-in-up delay-1000">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-blue-700 animate-slide-in-left delay-400">🏠 Homes for Sale</h2>
              <Link to="/search?type=sale" className="text-blue-600 hover:underline">View All Sales</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {saleListings.map((listing) => (
                <div className="transition-transform duration-300 hover:scale-105 hover:shadow-xl" key={listing._id}>
                  <ListingItem listing={listing} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <GeminiAIWrapper />
      <ContactSupportWrapper />
    </div>
  );
} 
