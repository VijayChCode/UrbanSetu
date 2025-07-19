import React from "react";
import { useWishlist } from "../WishlistContext";
import WishListItem from "../components/WishListItems";
import { useNavigate } from "react-router-dom";
import { FaPlus } from 'react-icons/fa';
import { useState } from 'react';

const WishList = () => {
  const { wishlist, loading } = useWishlist();
  const [showTooltip, setShowTooltip] = useState(false);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen py-10 px-2 md:px-8">
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg p-6 relative">
          <h3 className="text-3xl font-extrabold text-blue-700 mb-6 text-center drop-shadow">
            My Wishlist
          </h3>
          <div className="text-center text-gray-500 text-lg">Loading wishlist...</div>
        </div>
      </div>
    );
  }

  const navigate = useNavigate();
  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen py-10 px-2 md:px-8">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg p-6 relative">
        <h3 className="text-3xl font-extrabold text-blue-700 mb-6 text-center drop-shadow">
          My Wishlist
        </h3>
        {wishlist.length > 0 ? (
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {wishlist.map((listing) => (
                <WishListItem key={listing._id} listing={listing} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-gray-500 text-lg mb-4">Your wishlist is empty. Add some properties.</div>
            <button
              onClick={() => navigate('/user/search')}
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 text-base"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Properties
            </button>
          </div>
        )}
      </div>
      {/* Floating Plus Icon with Tooltip */}
      <div className="fixed bottom-8 right-8 z-50">
        <button
          onClick={() => navigate('/user/search')}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="bg-gradient-to-r from-green-400 to-blue-500 text-white rounded-full shadow-lg p-4 hover:from-green-500 hover:to-blue-600 transition-all flex items-center justify-center text-2xl"
          title="Explore Properties"
          style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
        >
          <FaPlus />
        </button>
        {showTooltip && (
          <div className="absolute right-16 bottom-1/2 transform translate-y-1/2 bg-gray-900 text-white text-xs rounded px-3 py-1 shadow-lg whitespace-nowrap" style={{ pointerEvents: 'none' }}>
            Explore properties
          </div>
        )}
      </div>
    </div>
  );
};

export default WishList;
