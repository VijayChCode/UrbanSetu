import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay } from "swiper/modules";
import "swiper/css/bundle";
import ListingItem from "../components/ListingItem";
import ContactSupportWrapper from "../components/ContactSupportWrapper";

export default function Home() {
  const [offerListings, setOfferListings] = useState([]);
  const [saleListings, setSaleListings] = useState([]);
  const [rentListings, setRentListings] = useState([]);

  useEffect(() => {
    const fetchOfferListings = async () => {
      try {
        const res = await fetch("/api/listing/get?offer=true&limit=6");
        const data = await res.json();
        setOfferListings(data);
      } catch (error) {
        console.error("Error fetching offer listings", error);
      }
    };

    const fetchRentListings = async () => {
      try {
        const res = await fetch("/api/listing/get?type=rent&limit=6");
        const data = await res.json();
        setRentListings(data);
      } catch (error) {
        console.error("Error fetching rent listings", error);
      }
    };

    const fetchSaleListings = async () => {
      try {
        const res = await fetch("/api/listing/get?type=sale&limit=6");
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

      {/* Swiper Slider for Featured Listings */}
      {offerListings.length > 0 && (
        <div className="my-8 mx-auto max-w-4xl animate-fade-in-up delay-500">
          <Swiper
            modules={[Navigation, Autoplay]}
            navigation
            autoplay={{ delay: 2500, disableOnInteraction: false }}
            loop={true}
            className="rounded-lg shadow-lg"
          >
            {offerListings.map((listing) => (
              <SwiperSlide key={listing._id} className="flex justify-center">
                <img src={listing.imageUrls[0]} className="h-56 w-full object-cover rounded-lg transition-transform duration-500 hover:scale-105 hover:shadow-2xl" alt="Listing" />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      )}

      {/* Listings Section */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Offer Listings */}
        {offerListings.length > 0 && (
          <div className="mb-8 bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-blue-700 animate-slide-in-left">🔥 Exclusive Offers</h2>
              <Link to="/search?offer=true" className="text-blue-600 hover:underline">View All Offers</Link>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          <div className="mb-8 bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-blue-700 animate-slide-in-left delay-200">🏡 Homes for Rent</h2>
              <Link to="/search?type=rent" className="text-blue-600 hover:underline">View All Rentals</Link>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          <div className="mb-8 bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-blue-700 animate-slide-in-left delay-400">🏠 Homes for Sale</h2>
              <Link to="/search?type=sale" className="text-blue-600 hover:underline">View All Sales</Link>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {saleListings.map((listing) => (
                <div className="transition-transform duration-300 hover:scale-105 hover:shadow-xl" key={listing._id}>
                  <ListingItem listing={listing} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <ContactSupportWrapper />
    </div>
  );
}
