import React, { useEffect, useState } from "react";
import ListingItem from "../components/ListingItem";
import { Link } from "react-router-dom";
import { FaCalendarAlt } from "react-icons/fa";
import ContactSupportWrapper from "../components/ContactSupportWrapper";

export default function AdminDashboard() {
  const [offerListings, setOfferListings] = useState([]);
  const [saleListings, setSaleListings] = useState([]);
  const [rentListings, setRentListings] = useState([]);
  const [loading, setLoading] = useState(true);

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

    Promise.all([fetchOfferListings(), fetchRentListings(), fetchSaleListings()]).then(() => setLoading(false));
  }, []);

  const handleDeleteListing = async (listingId) => {
    if (!window.confirm('Are you sure you want to delete this property?')) return;
    try {
      const res = await fetch(`/api/listing/delete/${listingId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setOfferListings((prev) => prev.filter((l) => l._id !== listingId));
        setRentListings((prev) => prev.filter((l) => l._id !== listingId));
        setSaleListings((prev) => prev.filter((l) => l._id !== listingId));
        alert('Listing deleted successfully.');
      } else {
        alert(data.message || 'Failed to delete listing.');
      }
    } catch (err) {
      alert('An error occurred. Please try again.');
    }
  };

  if (loading) return <p className="text-center mt-8 text-lg font-semibold text-blue-600 animate-pulse animate-fade-in">Loading admin dashboard...</p>;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between mb-10 gap-6 animate-fade-in-down bg-white rounded-xl shadow-lg p-8 mt-10">
        <div className="text-left w-full md:w-auto flex flex-col items-start">
          <h2 className="text-4xl font-extrabold text-blue-700 animate-fade-in mb-2 drop-shadow">Welcome, Admin!</h2>
          <p className="mt-2 text-lg text-blue-600 animate-fade-in delay-200">Manage all properties and appointments from your dashboard.</p>
        </div>
        <div className="w-full md:w-auto flex justify-end">
          <Link to="/admin/appointments">
            <button className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 mt-4 md:mt-0">
              <FaCalendarAlt className="text-2xl drop-shadow-lg animate-pulse" />
              <span className="tracking-wide">Pending Appointments</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Listings Section */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Offer Listings */}
        {offerListings.length > 0 && (
          <div className="mb-8 bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-blue-700 animate-slide-in-left">🔥 Exclusive Offers</h2>
              <Link to="/admin/explore?offer=true" className="text-blue-600 hover:underline">View All Offers</Link>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {offerListings.map((listing) => (
                <div className="transition-transform duration-300 hover:scale-105 hover:shadow-xl" key={listing._id}>
                  <ListingItem listing={listing} onDelete={handleDeleteListing} />
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
              <Link to="/admin/explore?type=rent" className="text-blue-600 hover:underline">View All Rentals</Link>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rentListings.map((listing) => (
                <div className="transition-transform duration-300 hover:scale-105 hover:shadow-xl" key={listing._id}>
                  <ListingItem listing={listing} onDelete={handleDeleteListing} />
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
              <Link to="/admin/explore?type=sale" className="text-blue-600 hover:underline">View All Sales</Link>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {saleListings.map((listing) => (
                <div className="transition-transform duration-300 hover:scale-105 hover:shadow-xl" key={listing._id}>
                  <ListingItem listing={listing} onDelete={handleDeleteListing} />
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