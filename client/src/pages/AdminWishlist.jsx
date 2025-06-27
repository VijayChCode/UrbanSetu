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
          <div className="text-center text-gray-500 text-lg">Your wishlist is empty.</div>
        )}
      </div>
    </div>
  );
} 