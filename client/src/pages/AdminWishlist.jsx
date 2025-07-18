import React from "react";
import { useWishlist } from "../WishlistContext";
import WishListItem from "../components/WishListItems";

export default function AdminWishlist() {
  const { wishlist, loading } = useWishlist();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 py-10 px-2 md:px-8">
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg p-6 relative">
          <h3 className="text-3xl font-extrabold text-blue-700 mb-6 text-center drop-shadow">
            Admin Wishlist
          </h3>
          <div className="text-center text-gray-500 text-lg">Loading wishlist...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 py-10 px-2 md:px-8">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg p-6 relative">
        <h3 className="text-3xl font-extrabold text-blue-700 mb-6 text-center drop-shadow">
          Admin Wishlist
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
            <a
              href="/admin/explore"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors text-base font-semibold"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Properties
            </a>
          </div>
        )}
      </div>
    </div>
  );
} 