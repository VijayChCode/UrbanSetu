import React, { createContext, useState, useContext, useEffect } from 'react';
import { useSelector } from 'react-redux';

const WishlistContext = createContext();

const WishlistProvider = ({ children }) => {
  const { currentUser } = useSelector((state) => state.user);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch user's wishlist from API
  const fetchWishlist = async () => {
    if (!currentUser) {
      setWishlist([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/wishlist/user/${currentUser._id}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        // Extract the full listing data from populated wishlist items
        const listings = data.map(item => item.listingId).filter(listing => listing !== null);
        setWishlist(listings);
      } else {
        console.error('Failed to fetch wishlist');
        setWishlist([]);
      }
    } catch (error) {
      console.error('Error fetching wishlist:', error);
      setWishlist([]);
    } finally {
      setLoading(false);
    }
  };

  // Add item to wishlist via API
  const addToWishlist = async (product) => {
    if (!currentUser) {
      console.error('User must be logged in to add to wishlist');
      return;
    }

    try {
      const response = await fetch('/api/wishlist/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ listingId: product._id }),
      });

      if (response.ok) {
        const data = await response.json();
        setWishlist(prev => {
          if (prev.find(item => item._id === product._id)) {
            return prev; // Avoid duplicates
          }
          return [...prev, product];
        });
      } else {
        const errorData = await response.json();
        console.error('Failed to add to wishlist:', errorData.message);
      }
    } catch (error) {
      console.error('Error adding to wishlist:', error);
    }
  };

  // Remove item from wishlist via API
  const removeFromWishlist = async (id) => {
    if (!currentUser) {
      console.error('User must be logged in to remove from wishlist');
      return;
    }

    try {
      const response = await fetch(`/api/wishlist/remove/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setWishlist(prev => prev.filter(item => item._id !== id));
      } else {
        console.error('Failed to remove from wishlist');
      }
    } catch (error) {
      console.error('Error removing from wishlist:', error);
    }
  };

  // Check if item is in wishlist
  const isInWishlist = (id) => {
    return wishlist.some(item => item._id === id);
  };

  // Fetch wishlist when user changes
  useEffect(() => {
    fetchWishlist();
  }, [currentUser]);

  return (
    <WishlistContext.Provider value={{ 
      wishlist, 
      addToWishlist, 
      removeFromWishlist, 
      isInWishlist,
      loading 
    }}>
      {children}
    </WishlistContext.Provider>
  );
};

export default WishlistProvider;

export const useWishlist = () => useContext(WishlistContext);
