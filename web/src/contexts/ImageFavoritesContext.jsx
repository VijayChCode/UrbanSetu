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

    // Toggle favorite status
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

        const isFav = favorites.has(imageId);

        try {
            if (isFav) {
                // Remove from favorites
                const response = await authenticatedFetch(`${API_BASE_URL}/api/image-favorites/remove/${imageId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    // Update local state
                    setFavorites(prev => {
                        const newFavorites = new Set(prev);
                        newFavorites.delete(imageId);
                        return newFavorites;
                    });

                    setFavoritesData(prev => prev.filter(fav => fav.imageId !== imageId));
                    toast.success('Removed from favorites');
                    return false;
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    toast.error(errorData.message || 'Failed to remove favorite');
                    return true;
                }
            } else {
                // Add to favorites
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
                    if (data.success) {
                        // Update local state
                        setFavorites(prev => new Set([...prev, imageId]));
                        setFavoritesData(prev => [...prev, data.favorite]);
                        toast.success('Added to favorites');
                        return true;
                    }
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    const errorMessage = errorData.message || 'Failed to update favorites';
                    if (response.status === 400 && errorMessage.includes('already')) {
                         if (!isFav) {
                             setFavorites(prev => new Set([...prev, imageId]));
                         }
                         toast.success('Added to favorites');
                         return true;
                    } else {
                         toast.error(errorMessage);
                         return isFav;
                    }
                }
            }
        } catch (error) {
            console.error('Failed to toggle favorite:', error);
            toast.error('Failed to update favorites');
            return isFav; // Return original state on error
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