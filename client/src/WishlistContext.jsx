import React, { createContext, useState, useContext, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { socket } from './utils/socket';
import { toast } from 'react-toastify';

const WishlistContext = createContext();

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
      const response = await fetch(`${API_BASE_URL}/api/wishlist/user/${currentUser._id}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (!Array.isArray(data)) {
          setWishlist([]);
          toast.error('Session expired or unauthorized. Please sign in again.');
          window.location.href = '/sign-in';
          return;
        }
        // Extract the full listing data from populated wishlist items
        const listings = data.map(item => item.listingId).filter(listing => listing !== null);
        setWishlist(listings);
      } else if (response.status === 401) {
        setWishlist([]);
        toast.error('Session expired or unauthorized. Please sign in again.');
        window.location.href = '/sign-in';
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

  // Listen for wishlist socket events
  useEffect(() => {
    function handleWishlistUpdate({ type, listing }) {
      setWishlist(prev => {
        if (type === 'add') {
          if (prev.find(item => item._id === listing._id)) return prev;
          return [...prev, listing];
        }
        if (type === 'remove') {
          return prev.filter(item => item._id !== listing._id);
        }
        return prev;
      });
    }
    socket.on('wishlist_update', handleWishlistUpdate);
    return () => {
      socket.off('wishlist_update', handleWishlistUpdate);
    };
  }, []);

  // Add item to wishlist via API (optimistic)
  const addToWishlist = async (product) => {
    if (!currentUser) {
      console.error('User must be logged in to add to wishlist');
      return;
    }
    // Optimistically update UI
    setWishlist(prev => {
      if (prev.find(item => item._id === product._id)) return prev;
      toast.success('Property added to your wishlist!');
      return [...prev, product];
    });
    // Emit socket event
    socket.emit('wishlist_update', { type: 'add', listing: product });
    try {
      const response = await fetch(`${API_BASE_URL}/api/wishlist/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ listingId: product._id }),
      });
      if (!response.ok) {
        // Rollback
        setWishlist(prev => prev.filter(item => item._id !== product._id));
        const errorData = await response.json();
        console.error('Failed to add to wishlist:', errorData.message);
      }
    } catch (error) {
      setWishlist(prev => prev.filter(item => item._id !== product._id));
      console.error('Error adding to wishlist:', error);
    }
  };

  // Remove item from wishlist via API (optimistic)
  const removeFromWishlist = async (id) => {
    if (!currentUser) {
      console.error('User must be logged in to remove from wishlist');
      return { success: false, message: 'User must be logged in to remove from wishlist' };
    }
    // Optimistically update UI
    setWishlist(prev => prev.filter(item => item._id !== id));
    // Emit socket event
    socket.emit('wishlist_update', { type: 'remove', listing: { _id: id } });
    try {
      const response = await fetch(`${API_BASE_URL}/api/wishlist/remove/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        // Rollback
        // Refetch wishlist to restore correct state
        fetchWishlist();
        const errorData = await response.json();
        console.error('Failed to remove from wishlist:', errorData.message);
        return { success: false, message: 'Failed to remove property. Please try again.' };
      }
      toast.success('Property removed from your wishlist.');
      return { success: true };
    } catch (error) {
      fetchWishlist();
      console.error('Error removing from wishlist:', error);
      return { success: false, message: 'Failed to remove property. Please try again.' };
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
