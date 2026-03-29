import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { socket } from './utils/socket';
import { toast } from 'react-toastify';
import { signoutUserSuccess } from './redux/user/userSlice';
import { authenticatedFetch } from './utils/auth';

const WishlistContext = createContext();

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const WishlistProvider = ({ children }) => {
  const dispatch = useDispatch();
  const { currentUser } = useSelector((state) => state.user);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(false);
  // Track pending requests for specific listings to prevent race conditions from rapid clicking
  const pendingRequestsRef = useRef(new Set());

  // Fetch user's wishlist from API
  const fetchWishlist = async () => {
    if (!currentUser) {
      setWishlist([]);
      return;
    }

    setLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/wishlist/user/${currentUser._id}`);

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
        dispatch(signoutUserSuccess());
        // toast.error('Session expired. Please sign in again.'); // Optional: avoid spamming toasts on auto-logout
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

    // Prevent multiple concurrent requests for the same listing
    if (pendingRequestsRef.current.has(product._id)) return;
    pendingRequestsRef.current.add(product._id);

    // Optimistically update UI
    setWishlist(prev => {
      if (prev.find(item => item._id === product._id)) return prev;
      toast.success(
        <div>
          Property added to your wishlist! <Link to="/user/wishlist" className="font-bold underline ml-1">View Wishlist</Link>
        </div>
      );
      return [...prev, product];
    });
    // Emit socket event
    socket.emit('wishlist_update', { type: 'add', listing: product });
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/wishlist/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
    } finally {
      pendingRequestsRef.current.delete(product._id);
    }
  };

  // Remove item from wishlist via API (optimistic)
  const removeFromWishlist = async (id) => {
    if (!currentUser) {
      console.error('User must be logged in to remove from wishlist');
      return { success: false, message: 'User must be logged in to remove from wishlist' };
    }

    // Prevent multiple concurrent requests for the same listing
    if (pendingRequestsRef.current.has(id)) return;
    pendingRequestsRef.current.add(id);

    // Optimistically update UI
    setWishlist(prev => prev.filter(item => item._id !== id));
    // Emit socket event
    socket.emit('wishlist_update', { type: 'remove', listing: { _id: id } });
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/wishlist/remove/${id}`, {
        method: 'DELETE',
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
    } finally {
      pendingRequestsRef.current.delete(id);
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
