import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector, useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { signoutUserSuccess } from '../redux/user/userSlice';
import { authenticatedFetch } from '../utils/csrf';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const ImageFavoritesContext = createContext();

export const useImageFavorites = () => {
    const context = useContext(ImageFavoritesContext);
    if (!context) {
        throw new Error('useImageFavorites must be used within an ImageFavoritesProvider');
    }
    return context;
};

export const ImageFavoritesProvider = ({ children }) => {
    const dispatch = useDispatch();
    const { currentUser } = useSelector(state => state.user);
    const [favorites, setFavorites] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [favoritesData, setFavoritesData] = useState([]);

    // Load user's favorites when component mounts or user changes
    useEffect(() => {
        if (currentUser) {
            loadFavorites();
        } else {
            // Clear favorites when user logs out
            setFavorites(new Set());
            setFavoritesData([]);
        }
    }, [currentUser]);

    // Load all favorites from backend
    const loadFavorites = async () => {
        if (!currentUser) return;

        try {
            setLoading(true);
            const response = await authenticatedFetch(`${API_BASE_URL}/api/image-favorites/user/${currentUser._id}`);

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const favoriteIds = new Set(data.favorites.map(fav => fav.imageId));
                    setFavorites(favoriteIds);
                    setFavoritesData(data.favorites);
                }
            } else if (response.status === 401) {
                dispatch(signoutUserSuccess());
            } else {
                toast.error('Failed to load favorites');
            }
        } catch (error) {
            console.error('Failed to load favorites:', error);
            toast.error('Failed to load favorites');
        } finally {
            setLoading(false);
        }
    };

    // Generate unique image ID from URL
    const generateImageId = (imageUrl) => {
        if (!imageUrl) return null;
        // Extract filename or create hash from URL
        const urlParts = imageUrl.split('/');
        const filename = urlParts[urlParts.length - 1];
        // Remove query parameters
        const cleanFilename = filename.split('?')[0];
        return cleanFilename || btoa(imageUrl).slice(0, 20);
    };

    // Check if image is favorited
    const isFavorite = (imageUrl) => {
        const imageId = generateImageId(imageUrl);
        return imageId ? favorites.has(imageId) : false;
    };

    // Toggle favorite status (optimistic UI — updates instantly, syncs backend in background)
    const toggleFavorite = async (imageUrl, metadata = {}) => {
        if (!currentUser) {
            toast.error('Please login to save favorites');
            return false;
        }

        if (!imageUrl) {
            toast.error('Invalid image URL');
            return false;
        }

        const imageId = generateImageId(imageUrl);
        if (!imageId) {
            toast.error('Unable to process image');
            return false;
        }

        const wasFav = favorites.has(imageId);

        // ── Optimistic Update: flip UI state immediately ──
        if (wasFav) {
            // Optimistically remove
            setFavorites(prev => {
                const next = new Set(prev);
                next.delete(imageId);
                return next;
            });
            setFavoritesData(prev => prev.filter(fav => fav.imageId !== imageId));
        } else {
            // Optimistically add (create a temporary local entry)
            setFavorites(prev => new Set([...prev, imageId]));
            const optimisticEntry = {
                imageId,
                imageUrl,
                listingId: metadata.listingId || null,
                metadata: {
                    imageName: metadata.imageName || `image-${Date.now()}`,
                    imageType: metadata.imageType || 'image',
                    imageSize: metadata.imageSize || 0,
                    addedFrom: metadata.addedFrom || 'preview'
                },
                addedAt: new Date().toISOString(),
                _optimistic: true // marker so we can replace with real data later
            };
            setFavoritesData(prev => [...prev, optimisticEntry]);
        }

        // ── Background Sync: fire API call without blocking UI ──
        try {
            if (wasFav) {
                // Remove from backend
                const response = await authenticatedFetch(`${API_BASE_URL}/api/image-favorites/remove/${imageId}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    // Revert optimistic removal
                    setFavorites(prev => new Set([...prev, imageId]));
                    // Re-fetch to get accurate data
                    loadFavorites();
                    toast.error(errorData.message || 'Failed to remove favorite');
                    return true;
                }
                return false;
            } else {
                // Add to backend
                const favoriteData = {
                    imageUrl,
                    imageId,
                    listingId: metadata.listingId || null,
                    metadata: {
                        imageName: metadata.imageName || `image-${Date.now()}`,
                        imageType: metadata.imageType || 'image',
                        imageSize: metadata.imageSize || 0,
                        addedFrom: metadata.addedFrom || 'preview'
                    }
                };

                const response = await authenticatedFetch(`${API_BASE_URL}/api/image-favorites/add`, {
                    method: 'POST',
                    body: JSON.stringify(favoriteData)
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.favorite) {
                        // Replace optimistic entry with real server data
                        setFavoritesData(prev =>
                            prev.map(fav =>
                                fav.imageId === imageId && fav._optimistic
                                    ? data.favorite
                                    : fav
                            )
                        );
                    }
                    return true;
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    const errorMessage = errorData.message || 'Failed to update favorites';

                    if (response.status === 400 && errorMessage.includes('already')) {
                        // Already exists on server — keep optimistic state, refresh data
                        loadFavorites();
                        return true;
                    }

                    // Revert optimistic addition
                    setFavorites(prev => {
                        const next = new Set(prev);
                        next.delete(imageId);
                        return next;
                    });
                    setFavoritesData(prev => prev.filter(fav => fav.imageId !== imageId));
                    toast.error(errorMessage);
                    return false;
                }
            }
        } catch (error) {
            console.error('Failed to toggle favorite:', error);

            // Revert optimistic update on network error
            if (wasFav) {
                // Was removing → put it back
                setFavorites(prev => new Set([...prev, imageId]));
                loadFavorites();
            } else {
                // Was adding → remove it
                setFavorites(prev => {
                    const next = new Set(prev);
                    next.delete(imageId);
                    return next;
                });
                setFavoritesData(prev => prev.filter(fav => fav.imageId !== imageId));
            }
            toast.error('Failed to update favorites');
            return wasFav;
        }
    };

    // Get favorites count
    const getFavoritesCount = () => favorites.size;

    // Get all favorites data
    const getAllFavorites = () => favoritesData;

    // Check multiple images at once
    const checkMultipleFavorites = (imageUrls) => {
        const results = {};
        imageUrls.forEach(url => {
            const imageId = generateImageId(url);
            if (imageId) {
                results[url] = favorites.has(imageId);
            }
        });
        return results;
    };

    // Bulk add to favorites
    const bulkAddToFavorites = async (images) => {
        if (!currentUser) {
            toast.error('Please login to save favorites');
            return;
        }

        try {
            const imageData = images.map(img => ({
                imageUrl: img.url,
                imageId: generateImageId(img.url),
                listingId: img.listingId || null,
                metadata: {
                    imageName: img.name || `image-${Date.now()}`,
                    imageType: img.type || 'image',
                    imageSize: img.size || 0,
                    addedFrom: img.addedFrom || 'bulk'
                }
            })).filter(img => img.imageId);

            const response = await authenticatedFetch(`${API_BASE_URL}/api/image-favorites/bulk/add`, {
                method: 'POST',
                body: JSON.stringify({ images: imageData })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Refresh favorites
                    await loadFavorites();
                    toast.success(`${data.addedCount} images added to favorites`);
                }
            } else {
                toast.error('Failed to add images to favorites');
            }
        } catch (error) {
            console.error('Failed to bulk add favorites:', error);
            toast.error('Failed to add images to favorites');
        }
    };

    // Bulk remove from favorites
    const bulkRemoveFromFavorites = async (imageUrls) => {
        if (!currentUser) return;

        try {
            const imageIds = imageUrls.map(url => generateImageId(url)).filter(Boolean);

            const response = await authenticatedFetch(`${API_BASE_URL}/api/image-favorites/bulk/remove`, {
                method: 'POST',
                body: JSON.stringify({ imageIds })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Update local state
                    const removedIds = new Set(imageIds);
                    setFavorites(prev => {
                        const newFavorites = new Set();
                        prev.forEach(id => {
                            if (!removedIds.has(id)) {
                                newFavorites.add(id);
                            }
                        });
                        return newFavorites;
                    });

                    setFavoritesData(prev => prev.filter(fav => !removedIds.has(fav.imageId)));
                    toast.success(`${data.removedCount} images removed from favorites`);
                }
            } else {
                 toast.error('Failed to remove images from favorites');
            }
        } catch (error) {
            console.error('Failed to bulk remove favorites:', error);
            toast.error('Failed to remove images from favorites');
        }
    };

    const value = {
        favorites,
        favoritesData,
        loading,
        isFavorite,
        toggleFavorite,
        loadFavorites,
        getFavoritesCount,
        getAllFavorites,
        checkMultipleFavorites,
        bulkAddToFavorites,
        bulkRemoveFromFavorites,
        generateImageId
    };

    return (
        <ImageFavoritesContext.Provider value={value}>
            {children}
        </ImageFavoritesContext.Provider>
    );
};