import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { authenticatedFetch } from '../utils/auth';
import {
  FaTimes,
  FaSearchPlus,
  FaSearchMinus,
  FaUndo,
  FaDownload,
  FaExpand,
  FaCompress,
  FaPlay,
  FaPause,
  FaInfo,
  FaShare,
  FaHeart,
  FaRegHeart,
  FaCog,
  FaEye,
  FaInfoCircle,
  FaTh,
  FaArrowLeft
} from 'react-icons/fa';
import { useImageFavorites } from '../contexts/ImageFavoritesContext';
import SocialSharePanel from './SocialSharePanel';
import UrbanSetuSpinner from './UrbanSetuSpinner';

// Helper function to show toast messages
const showToast = (message, type = 'info') => {
  try {
    // Try to use react-toastify if available
    if (window.toast) {
      // Map warning to warn for react-toastify compatibility
      const toastType = type === 'warning' ? 'warn' : type;
      if (typeof window.toast[toastType] === 'function') {
        window.toast[toastType](message);
      } else {
        // Fallback to info if type doesn't exist
        window.toast.info(message);
      }
    } else if (typeof window !== 'undefined') {
      // Fallback to console and basic alert for development
      const logLevel = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'info';
      console[logLevel](`ImagePreview: ${message}`);

      // Show alert for errors and warnings in development
      if (type === 'error') {
        alert(`Error: ${message}`);
      } else if (type === 'warning') {
        console.warn(`Warning: ${message}`);
      }
    }
  } catch (error) {
    console.error('Toast error:', error);
    // Ultimate fallback
    console.info(`ImagePreview Toast: ${message}`);
  }
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const ImagePreview = ({ isOpen, onClose, images, initialIndex = 0, listingId = null, metadata = {} }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSlideshow, setIsSlideshow] = useState(false);
  const [slideshowSpeed, setSlideshowSpeed] = useState(3000);
  const [showControls, setShowControls] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoHideControls, setAutoHideControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSocialShare, setShowSocialShare] = useState(false);
  const [showAboutViewer, setShowAboutViewer] = useState(false);
  const [autoScale, setAutoScale] = useState(1);

  // Favorites Panel State
  const [showFavoritesGallery, setShowFavoritesGallery] = useState(false);
  const [isFavoritesMode, setIsFavoritesMode] = useState(false);

  // Sharing State
  const [shareUrl, setShareUrl] = useState(null);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [cachedShares, setCachedShares] = useState({});

  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const slideshowRef = useRef(null);
  const settingsRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);
  const hasMovedRef = useRef(false);
  const ignoreClickRef = useRef(false);
  const isTouchRef = useRef(false);
  const lastDragRef = useRef({ x: 0, y: 0 });

  const touchStartRef = useRef(null);
  const lastTapRef = useRef(0);
  const pinchStartDistRef = useRef(null);
  const pinchStartScaleRef = useRef(1);

  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Swipe Transition State
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isAnimatingSwipe, setIsAnimatingSwipe] = useState(false);

  const showFeedback = (msg) => {
    setFeedbackMessage(msg);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => setFeedbackMessage(null), 1500);
  };

  // Use image favorites context
  const { isFavorite, toggleFavorite, favoritesData, loadFavorites } = useImageFavorites();

  const favoritesUrls = (favoritesData || []).map(fav => fav.imageUrl);

  // Ensure images is an array and handle undefined/null
  const imagesArray = isFavoritesMode 
    ? favoritesUrls 
    : (Array.isArray(images) ? images : (images ? [images] : []));

  // Ensure currentIndex is within bounds
  const safeIndex = Math.max(0, Math.min(currentIndex || 0, imagesArray.length - 1));
  const currentImageUrl = imagesArray[safeIndex] || imagesArray[0] || null;
  const isCurrentImageFavorited = currentImageUrl ? isFavorite(currentImageUrl) : false;

  // If in favorites mode and favorites list becomes empty, exit favorites mode
  useEffect(() => {
    if (isFavoritesMode && favoritesUrls.length === 0) {
      setIsFavoritesMode(false);
      setCurrentIndex(0);
    }
  }, [isFavoritesMode, favoritesUrls.length]);

  // Update currentIndex if it's out of bounds
  useEffect(() => {
    if (safeIndex !== currentIndex && imagesArray.length > 0) {
      setCurrentIndex(safeIndex);
    }
  }, [imagesArray.length, safeIndex, currentIndex]);

  // Handle favorite toggle
  const handleToggleFavorite = async () => {
    if (!currentImageUrl) return;

    const imageMetadata = {
      listingId,
      imageName: `image-${currentIndex + 1}`,
      imageType: 'property-image',
      addedFrom: metadata.addedFrom || 'preview',
      ...metadata
    };

    try {
      await toggleFavorite(currentImageUrl, imageMetadata);
      showFeedback(isCurrentImageFavorited ? "Removed from Favorites" : "Added to Favorites");
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleRemoveFavoriteFromGrid = async (e, fav) => {
    e.stopPropagation();
    try {
      await toggleFavorite(fav.imageUrl, fav.metadata);
      showFeedback("Removed from Favorites");
    } catch (error) {
      console.error('Failed to remove favorite from grid:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setImageLoading(true);
      setImageError(false);
      setShowControls(true);
      setShowInfo(false);
      setShowSettings(false);
      setShowAboutViewer(false);
      setShowFavoritesGallery(false);
      setIsFavoritesMode(false);
      if (typeof loadFavorites === 'function') {
        loadFavorites();
      }
    } else {
      setShowFavoritesGallery(false);
      setIsFavoritesMode(false);
    }
  }, [isOpen, initialIndex]);

  // Auto-hide controls
  useEffect(() => {
    if (!autoHideControls || !showControls) return;

    const hideControls = () => {
      if (isDragging || showSettings || showInfo) return;
      setShowControls(false);
    };

    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }

    const timeout = setTimeout(hideControls, 3000);
    setControlsTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [showControls, isDragging, showSettings, showInfo, autoHideControls]);

  // Slideshow functionality
  useEffect(() => {
    if (isSlideshow && imagesArray.length > 1) {
      slideshowRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % imagesArray.length);
      }, slideshowSpeed);
    }

    return () => {
      if (slideshowRef.current) {
        clearInterval(slideshowRef.current);
      }
    };
  }, [isSlideshow, slideshowSpeed, imagesArray.length]);

  // Keep isFullscreen React state synchronized with actual browser fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      // Show controls on any interaction
      if (!showControls) setShowControls(true);

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          if (showFavoritesGallery) {
            setShowFavoritesGallery(false);
          } else if (document.fullscreenElement || isFullscreen) {
            toggleFullscreen();
          } else {
            onClose();
          }
          break;
        case 'ArrowLeft':
          setCurrentIndex(prev => {
            if (prev > 0) return prev - 1;
            showFeedback("First Image");
            return prev;
          });
          break;
        case 'ArrowRight':
          setCurrentIndex(prev => {
            if (prev < imagesArray.length - 1) return prev + 1;
            showFeedback("Last Image");
            return prev;
          });
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
          e.preventDefault();
          handleZoomOut();
          break;
        case '0':
          handleReset();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 's':
          toggleSlideshow();
          break;
        case 'i':
          setShowInfo(prev => !prev);
          break;
        case 'h':
          setShowControls(prev => !prev);
          break;
        case ' ':
          e.preventDefault();
          toggleSlideshow();
          break;
      }
    };

    const handleWheel = (e) => {
      if (!isOpen || showFavoritesGallery) return;
      e.preventDefault();

      if (!showControls) setShowControls(true);

      if (e.deltaY < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    };

    const handleMouseMove = () => {
      // Activity Monitor (Desktop)
      if (!showControls && !isTouchRef.current) setShowControls(true);
    };

    const handleClickOutside = (e) => {
      // Check if click is on settings button or inside settings panel
      const isSettingsButton = e.target.closest('button[title="Settings"], button[title="More"]');
      if (showSettings && settingsRef.current && !settingsRef.current.contains(e.target) && !isSettingsButton) {
        setShowSettings(false);
      }

      // Check if click is on info button or inside info panel
      const isInfoButton = e.target.closest('button[title="Image Info (I)"]');
      const isInfoButtonInSettings = e.target.closest('button') && e.target.closest('button').textContent?.includes('Image Info');
      if (showInfo && !e.target.closest('[data-info-panel]') && !isInfoButton && !isInfoButtonInSettings) {
        setShowInfo(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, imagesArray.length, onClose, showControls, showSettings, showInfo, isFullscreen, showFavoritesGallery]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (isFullscreen) {
        document.documentElement.requestFullscreen?.();
      }
    } else {
      document.body.style.overflow = '';
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    }
    return () => {
      document.body.style.overflow = '';
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    };
  }, [isOpen, isFullscreen]);

  // Auto-fit logic for rotation (Same as VideoPreview)
  useEffect(() => {
    const calculateAutoScale = () => {
      if (!containerRef.current || !imageRef.current) return;
      const img = imageRef.current;
      const cont = containerRef.current;

      // Only adjust for 90/270 degrees
      if (rotation % 180 === 0) {
        setAutoScale(1);
        return;
      }

      const vw = img.naturalWidth;
      const vh = img.naturalHeight;
      if (!vw || !vh) return;

      // Account for padding
      const style = window.getComputedStyle(cont);
      const cw = cont.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const ch = cont.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);

      const scale0 = Math.min(cw / vw, ch / vh);
      const rw = vw * scale0;
      const rh = vh * scale0;

      // We need: VisualWidth(rh) * s <= cw  AND  VisualHeight(rw) * s <= ch
      const sWidth = cw / rh;
      const sHeight = ch / rw;

      const s = Math.min(sWidth, sHeight, 1);
      setAutoScale(s);
    };

    calculateAutoScale();
    window.addEventListener('resize', calculateAutoScale);
    return () => window.removeEventListener('resize', calculateAutoScale);
  }, [rotation, currentIndex, imageLoading]); // Recalculate on rotation, image change, or load completion

  const handleZoomIn = () => {
    setScale(prev => {
      const newScale = Math.min(prev * 1.2, 8);
      showFeedback(`${Math.round(newScale * 100)}%`);
      return newScale;
    });
  };

  const handleZoomOut = () => {
    setScale(prev => {
      let newScale = Math.max(prev / 1.2, 1);
      if (newScale < 1.1) newScale = 1; // Snap to 1
      showFeedback(`${Math.round(newScale * 100)}%`);
      if (newScale <= 1) setPosition({ x: 0, y: 0 });
      return newScale;
    });
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    showFeedback("Reset");
  };

  const handleRotate = () => {
    setRotation(prev => {
      const newRot = prev + 90;
      showFeedback(`${newRot}°`);
      return newRot;
    });
  };

  const handleMouseDown = (e) => {
    hasMovedRef.current = false;
    ignoreClickRef.current = false;
    if (scale > 1) {
      setIsDragging(true);
      lastDragRef.current = { x: e.clientX, y: e.clientY };
    }
  };



  const handleMouseUp = () => {
    if (isDragging && hasMovedRef.current) {
      ignoreClickRef.current = true;
    }
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    hasMovedRef.current = false;
    ignoreClickRef.current = false;
    // Single touch pan
    if (scale > 1 && e.touches.length === 1) {
      setIsDragging(true);
      lastDragRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    // Record start for Swipe (if scale 1)
    else if (scale === 1 && e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }

    // Pinch to zoom
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = scale;
      setIsDragging(false);
    }
  };

  const handleTouchMove = (e) => {
    // Single touch pan
    if (isDragging && scale > 1 && e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - lastDragRef.current.x;
      const dy = touch.clientY - lastDragRef.current.y;

      setPosition(prev => getClampedPosition(prev.x + dx / scale, prev.y + dy / scale, scale));

      lastDragRef.current = { x: touch.clientX, y: touch.clientY };
    }
    // Pinch to zoom
    else if (e.touches.length === 2 && pinchStartDistRef.current) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / pinchStartDistRef.current;
      const newScale = Math.min(Math.max(pinchStartScaleRef.current * ratio, 1), 8); // Min 1

      setScale(newScale);
      showFeedback(`${Math.round(newScale * 100)}%`);

      // Auto-reset position if zoomed out to near 1x
      if (newScale <= 1.1) {
        setPosition({ x: 0, y: 0 });
      }

      if (Math.abs(newScale - pinchStartScaleRef.current) > 0.1) {
        hasMovedRef.current = true; // Pinch is also movement
      }
    }
    // Mobile Swipe Tracking (Scale 1)
    else if (scale === 1 && touchStartRef.current && e.touches.length === 1) {
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      if (Math.abs(dx) > 10) hasMovedRef.current = true;
      setSwipeOffset(dx);
    }
  };

  const handleTouchEnd = (e) => {
    const moved = hasMovedRef.current;
    const wasPinching = !!pinchStartDistRef.current;

    if ((isDragging || wasPinching || scale === 1) && moved) {
      ignoreClickRef.current = true;
    }
    setIsDragging(false);
    pinchStartDistRef.current = null;

    // Swipe Navigation (only if scale 1, not pinched, not moved as drag)
    if (scale === 1 && !wasPinching && touchStartRef.current) {
      if (Math.abs(swipeOffset) > 30) {
        // >0 (Right) -> Prev (-1)
        // <0 (Left) -> Next (1)
        const dir = swipeOffset > 0 ? -1 : 1;

        // Prevent Loop (Stop at edges)
        // Prevent Loop (Stop at edges) with Feedback
        if (dir === 1 && currentIndex >= imagesArray.length - 1) {
          showFeedback("Last Image");
          setIsAnimatingSwipe(true);
          setSwipeOffset(0);
          setTimeout(() => setIsAnimatingSwipe(false), 300);
          touchStartRef.current = null;
          return;
        }
        if (dir === -1 && currentIndex <= 0) {
          showFeedback("First Image");
          setIsAnimatingSwipe(true);
          setSwipeOffset(0);
          setTimeout(() => setIsAnimatingSwipe(false), 300);
          touchStartRef.current = null;
          return;
        }

        changeImage(dir);
        touchStartRef.current = null;
        return;
      } else {
        // Snap back
        if (swipeOffset !== 0) {
          setIsAnimatingSwipe(true);
          setSwipeOffset(0);
          setTimeout(() => setIsAnimatingSwipe(false), 300);
        }
      }
    } else {
      // Reset if not a valid swipe start
      setSwipeOffset(0);
    }

    touchStartRef.current = null;

    // Double tap logic (only if not moved/dragged AND not pinching)
    if (!moved && !wasPinching) {
      const now = Date.now();
      const timeDiff = now - lastTapRef.current;

      if (timeDiff < 300 && timeDiff > 0) {
        // Double Tap Detected
        ignoreClickRef.current = true; // Prevent the click handler (control toggle)

        if (scale > 1) {
          // Double tap to Zoom Out
          setScale(1);
          setPosition({ x: 0, y: 0 });
          showFeedback("100%");
        } else {
          // Double tap to Zoom In
          const targetScale = 2.5;

          if (containerRef.current && e.changedTouches && e.changedTouches.length > 0) {
            const touch = e.changedTouches[0];
            const rect = containerRef.current.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const dx = touch.clientX - centerX;
            const dy = touch.clientY - centerY;

            // Rotate the touch offset vector back by the rotation angle
            // to get coordinates in the image's local space
            const rad = -rotation * Math.PI / 180;
            const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
            const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

            // Calculate and clamp new position so the clicked point aligns with the container center (0,0)
            const clampedPos = getClampedPosition(-localX, -localY, targetScale);

            setScale(targetScale);
            setPosition(clampedPos);
          } else {
            setScale(targetScale);
          }

          showFeedback("250%");
          setShowControls(false); // Hide controls for better view
        }
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }
  };

  const handleDownload = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    const imageUrl = imagesArray[safeIndex] || imagesArray[0];

    // Validate image URL first
    if (!imageUrl || typeof imageUrl !== 'string') {
      showToast('Error: Invalid image URL. Cannot download image.', 'error');
      setIsDownloading(false);
      return;
    }

    try {
      // Extract filename from URL or generate one
      const urlParts = imageUrl.split('/');
      const originalFilename = urlParts[urlParts.length - 1];
      let filename = originalFilename;

      // If filename doesn't have an extension or is just a hash, generate a proper name
      if (!filename.includes('.') || filename.length < 5) {
        // Try to determine file extension from URL or default to jpg
        const extension = imageUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i)?.[1] || 'jpg';
        filename = `property-image-${currentIndex + 1}.${extension}`;
      }

      // Try to fetch the image to handle CORS and get proper blob
      try {
        const response = await fetch(imageUrl, {
          mode: 'cors',
          cache: 'no-cache'
        });

        if (response.ok) {
          try {
            const blob = await response.blob();

            // Validate blob
            if (!blob || blob.size === 0) {
              throw new Error('Downloaded image is empty or corrupted');
            }

            const blobUrl = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up blob URL
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);

            // Show success feedback
            showToast(`Image "${filename}" downloaded successfully!`, 'success');
            return; // Exit early on success

          } catch (blobError) {
            console.error('Blob processing error:', blobError);
            throw new Error(`Failed to process image data: ${blobError.message}`);
          }
        } else {
          // Handle specific HTTP error codes
          let errorMessage = `Server error (${response.status}): `;
          switch (response.status) {
            case 404:
              errorMessage += 'Image not found on server';
              break;
            case 403:
              errorMessage += 'Access denied to image';
              break;
            case 500:
              errorMessage += 'Server internal error';
              break;
            default:
              errorMessage += 'Unable to fetch image';
          }
          throw new Error(errorMessage);
        }
      } catch (fetchError) {
        console.warn('Fetch failed, trying direct download:', fetchError);

        // Show specific error for fetch failure
        if (fetchError.name === 'TypeError' && fetchError.message.includes('Failed to fetch')) {
          showToast('Network error: Unable to fetch image. Trying alternative download method...', 'warning');
        } else if (fetchError.message.includes('CORS')) {
          showToast('CORS error: Trying alternative download method...', 'warning');
        } else {
          showToast(`Fetch error: ${fetchError.message}. Trying alternative download method...`, 'warning');
        }

        // Fallback to direct link download for CORS issues
        try {
          const link = document.createElement('a');
          link.href = imageUrl;
          link.download = filename;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Show info message for direct download attempt
          showToast('Alternative download initiated. If it doesn\'t start automatically, please try right-clicking the image and selecting "Save image as..."', 'info');
          return; // Exit early on fallback attempt

        } catch (directDownloadError) {
          console.error('Direct download failed:', directDownloadError);
          throw new Error(`Direct download failed: ${directDownloadError.message}`);
        }
      }
    } catch (error) {
      console.error('Download process failed:', error);

      // Show error notification for the main download process failure
      showToast(`Download failed: ${error.message}. Attempting to open image in new tab...`, 'error');

      // Final fallback - open image in new tab
      try {
        const newWindow = window.open(imageUrl, '_blank', 'noopener,noreferrer');

        if (newWindow) {
          showToast('Image opened in new tab. You can right-click to save it manually.', 'info');
        } else {
          // Pop-up blocked
          throw new Error('Pop-up blocked by browser');
        }
      } catch (openError) {
        console.error('Failed to open image in new tab:', openError);

        // Final error - all methods failed
        if (openError.message.includes('Pop-up blocked')) {
          showToast('Error: Pop-up blocked. Please allow pop-ups for this site or right-click the image and select "Save image as..."', 'error');
        } else {
          showToast(`All download methods failed: ${openError.message}. Please right-click the image and select "Save image as..." or check your internet connection.`, 'error');
        }
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement || isFullscreen) {
      document.exitFullscreen?.();
      setIsFullscreen(false);
      showFeedback("Exit Fullscreen");
    } else {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
      showFeedback("Fullscreen");
    }
  };

  const toggleSlideshow = () => {
    setIsSlideshow(prev => {
      const newState = !prev;
      showFeedback(newState ? "Slideshow Started" : "Slideshow Stopped");
      return newState;
    });
  };

  const handleShare = async () => {
    const currentUrl = imagesArray[safeIndex] || imagesArray[0];
    if (!currentUrl) return;

    // Use cached share link if already generated
    if (cachedShares[currentUrl]) {
      setShareUrl(cachedShares[currentUrl]);
      setShowSocialShare(true);
      return;
    }

    // Generate a shareable UrbanSetu link (hides the raw image URL)
    setIsGeneratingShare(true);
    setShowSocialShare(true);

    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/image/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: currentUrl,
          listingId: listingId,
          title: 'Property Image'
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Build the full shareable URL
        const baseUrl = window.location.origin;
        const generatedUrl = `${baseUrl}/i/${data.token}`;
        setShareUrl(generatedUrl);
        setCachedShares(prev => ({ ...prev, [currentUrl]: generatedUrl }));
      } else {
        // Fallback to raw URL if share creation fails
        setShareUrl(currentUrl);
        setCachedShares(prev => ({ ...prev, [currentUrl]: currentUrl }));
      }
    } catch (err) {
      console.warn('Failed to generate share link, using raw URL:', err);
      setShareUrl(currentUrl);
      setCachedShares(prev => ({ ...prev, [currentUrl]: currentUrl }));
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  const handleContainerClick = (e) => {
    // Check if we should ignore click (due to drag/pinch)
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }

    // Don't toggle if clicking buttons/controls
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('[data-panel]')) {
      return;
    }

    setShowControls(prev => !prev);
  };



  const changeImage = (dir) => { // dir: 1 (Next), -1 (Prev)
    setIsAnimatingSwipe(true);
    const screenW = window.innerWidth;
    const exitTo = dir === 1 ? -screenW : screenW;

    setSwipeOffset(exitTo); // Animate out

    setTimeout(() => {
      setCurrentIndex(prev => {
        if (dir === 1) return prev < imagesArray.length - 1 ? prev + 1 : 0;
        return prev > 0 ? prev - 1 : imagesArray.length - 1;
      });

      // Prep Entry
      setIsAnimatingSwipe(false);
      setSwipeOffset(dir === 1 ? screenW : -screenW);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimatingSwipe(true);
          setSwipeOffset(0);
          setTimeout(() => setIsAnimatingSwipe(false), 300);
        });
      });
    }, 300);
  };

  const getClampedPosition = (x, y, currentScale) => {
    if (!containerRef.current || !imageRef.current) return { x, y };

    const cont = containerRef.current;
    const img = imageRef.current;

    // Get dimensions considering rotation
    const isRotated = rotation % 180 !== 0;

    // Natural dimensions
    const nw = img.naturalWidth || 0;
    const nh = img.naturalHeight || 0;

    // Container dimensions (with padding)
    const style = window.getComputedStyle(cont);
    const cw = cont.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const ch = cont.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);

    if (!nw || !nh) return { x, y };

    // Effective content dimensions (if rotated, swap w/h for calculation)
    // Note: The logic in calculateAutoScale uses the original img dims to determine scale factor
    // But for visual bounding box, we care about the rotated visual size.

    // 1. Calculate the 'fit' scale (scale0) - this is what makes it fit initially
    // Since we use object-contain logic:
    // If Rotated: We fit nh into cw, nw into ch ? 
    // In calculateAutoScale (lines 296+), we did exactly that logic to find AutoScale.

    // Let's rely on the fact that `rw` (Rendered Width at Scale 1) is simply:
    // VisualWidth = nw * scale * autoScale (if 0deg)
    // VisualWidth = nh * scale * autoScale (if 90deg)

    // Calculate visual dimensions
    const totalScale = currentScale * autoScale;
    const visualW = (isRotated ? nh : nw) * (Math.min(cw / (isRotated ? nh : nw), ch / (isRotated ? nw : nh))) * currentScale;
    const visualH = (isRotated ? nw : nh) * (Math.min(cw / (isRotated ? nh : nw), ch / (isRotated ? nw : nh))) * currentScale;

    // Wait, the above logic for visualW/H is slightly duplicating calculating scale0. 
    // Let's simplify: 
    // The image *rendered* dimension is derived from 'object-contain'. 
    // At scale=1, it fits perfectly in one dimension.

    // Let's calculate proper bounds

    // True rendered dimensions at scale=1 (before zoom)
    const scale0 = Math.min(cw / (isRotated ? nh : nw), ch / (isRotated ? nw : nh));
    const rw = (isRotated ? nh : nw) * scale0 * currentScale;
    const rh = (isRotated ? nw : nh) * scale0 * currentScale;

    const maxX = Math.max(0, (rw - cw) / 2);
    const maxY = Math.max(0, (rh - ch) / 2);

    return {
      x: Math.min(Math.max(x, -maxX), maxX),
      y: Math.min(Math.max(y, -maxY), maxY)
    };
  };

  const handleImageClick = (e) => {
    // Check if we should ignore click (due to drag/pinch)
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }

    // On touch devices, single tap toggles controls rather than zooming
    if (isTouchRef.current) {
      return;
    }

    e.stopPropagation(); // Prevent container click (which would toggle controls back and forth)

    if (scale > 1) {
      // Zoom out to normal
      setScale(1);
      setPosition({ x: 0, y: 0 });
      showFeedback("100%");
    } else {
      // Zoom in to 2.5x at the clicked position
      const targetScale = 2.5;

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;

        // Rotate the click offset vector back by the rotation angle
        // to get coordinates in the image's local space
        const rad = -rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

        // Calculate and clamp new position so the clicked point aligns with the container center (0,0)
        const clampedPos = getClampedPosition(-localX, -localY, targetScale);

        setScale(targetScale);
        setPosition(clampedPos);
        showFeedback("250%");
        
        // Hide controls for an immersive zoomed-in view
        setShowControls(false);
      }
    }
  };

  const handleWrapperMouseMove = (e) => {
    // Mouse Dragging Logic
    if (isDragging && scale > 1) {
      e.preventDefault();
      hasMovedRef.current = true;

      const dx = e.clientX - lastDragRef.current.x;
      const dy = e.clientY - lastDragRef.current.y;

      setPosition(prev => getClampedPosition(prev.x + dx / scale, prev.y + dy / scale, scale));

      lastDragRef.current = { x: e.clientX, y: e.clientY };
    }

    // Toggle controls on mouse move (if not touch)
    if (!isTouchRef.current && !showControls) setShowControls(true);
  };

  const handleWrapperTouchStart = () => {
    isTouchRef.current = true;
  };

  const handleCloseClick = () => {
    if (showFavoritesGallery) {
      setShowFavoritesGallery(false);
    } else if (document.fullscreenElement || isFullscreen) {
      toggleFullscreen();
    } else {
      onClose();
    }
  };

  if (!isOpen || !imagesArray || imagesArray.length === 0) return null;

  const content = (
    <div
      className={`fixed inset-0 bg-black bg-opacity-95 z-[9999] flex items-center justify-center transition-all duration-300 select-none touch-none ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      onMouseMove={handleWrapperMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStartCapture={handleWrapperTouchStart}
      onClick={handleContainerClick}
    >
      {/* Close Button */}
      <button
        onClick={handleCloseClick}
        className={`absolute top-4 right-4 text-white hover:text-red-400 z-10 bg-black bg-opacity-70 rounded-full p-3 transition-all duration-300 hover:bg-opacity-90 hover:scale-110 ${showControls && !showFavoritesGallery ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
          }`}
      >
        <FaTimes size={20} />
      </button>

      {/* Navigation Arrows */}
      {imagesArray.length > 1 && (
        <>
          {currentIndex > 0 && (
            <button
              onClick={() => setCurrentIndex(prev => prev > 0 ? prev - 1 : prev)}
              className={`absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-blue-300 z-10 bg-black bg-opacity-70 rounded-full p-4 transition-all duration-300 hover:bg-opacity-90 hover:scale-110 hidden md:block ${showControls ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {currentIndex < imagesArray.length - 1 && (
            <button
              onClick={() => setCurrentIndex(prev => prev < imagesArray.length - 1 ? prev + 1 : prev)}
              className={`absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-blue-300 z-10 bg-black bg-opacity-70 rounded-full p-4 transition-all duration-300 hover:bg-opacity-90 hover:scale-110 hidden md:block ${showControls ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
                }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </>
      )}

      {/* Image Container */}
      <div ref={containerRef} className="relative w-full h-full flex items-center justify-center overflow-hidden p-4">
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[2px]">
            <UrbanSetuSpinner size="lg" isBright={true} />
          </div>
        )}

        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="text-center p-10 bg-black/60 backdrop-blur-xl rounded-[2.5rem] border border-white/10 shadow-2xl transition-all duration-500 scale-100 hover:scale-105">
              <div className="text-6xl sm:text-7xl mb-6 opacity-60 grayscale-[0.2] animate-pulse">🖼️</div>
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-gray-300 opacity-90 px-4 py-2 border border-white/20 rounded-xl bg-white/5 whitespace-nowrap">Failed to load Image</p>
            </div>
          </div>
        )}

        <img
          ref={imageRef}
          src={currentImageUrl}
          alt={`Property image ${currentIndex + 1}`}
          className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'
            }`}
          style={{
            transform: `scale(${scale * autoScale}) rotate(${rotation}deg) translate(${position.x + swipeOffset}px, ${position.y}px)`,
            transition: (isDragging || (Math.abs(swipeOffset) > 0 && !isAnimatingSwipe)) ? 'none' : 'transform 0.3s ease-out',
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onLoad={handleImageLoad}
          onError={handleImageError}
          onClick={handleImageClick}
          draggable={false}
        />
      </div>

      {/* Enhanced Controls - Desktop */}
      <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 hidden md:flex items-center gap-2 bg-black bg-opacity-80 backdrop-blur-sm rounded-xl p-3 transition-all duration-300 ${showControls && !showFavoritesGallery ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}>
        <button
          onClick={handleZoomIn}
          className="text-white hover:text-blue-300 p-2 rounded-lg hover:bg-white hover:bg-opacity-20 transition-all duration-200"
          title="Zoom In (Ctrl + +)"
        >
          <FaSearchPlus size={16} />
        </button>
        <button
          onClick={handleZoomOut}
          className="text-white hover:text-blue-300 p-2 rounded-lg hover:bg-white hover:bg-opacity-20 transition-all duration-200"
          title="Zoom Out (Ctrl + -)"
        >
          <FaSearchMinus size={16} />
        </button>
        <button
          onClick={handleRotate}
          className="text-white hover:text-blue-300 p-2 rounded-lg hover:bg-white hover:bg-opacity-20 transition-all duration-200"
          title="Rotate"
        >
          <FaUndo size={16} />
        </button>
        <button
          onClick={handleReset}
          className="text-white hover:text-blue-300 p-2 rounded-lg hover:bg-white hover:bg-opacity-20 transition-all duration-200"
          title="Reset (0)"
        >
          <span className="text-sm font-bold">0</span>
        </button>
        <div className="w-px h-6 bg-white bg-opacity-30"></div>
        <button
          onClick={toggleFullscreen}
          className="text-white hover:text-blue-300 p-2 rounded-lg hover:bg-white hover:bg-opacity-20 transition-all duration-200"
          title="Toggle Fullscreen (F)"
        >
          {isFullscreen ? <FaCompress size={16} /> : <FaExpand size={16} />}
        </button>
        <button
          onClick={toggleSlideshow}
          className={`p-2 rounded-lg transition-all duration-200 ${isSlideshow
            ? 'text-red-400 hover:text-red-300 bg-red-400 bg-opacity-20'
            : 'text-white hover:text-blue-300 hover:bg-white hover:bg-opacity-20'
            }`}
          title="Toggle Slideshow (S)"
        >
          {isSlideshow ? <FaPause size={16} /> : <FaPlay size={16} />}
        </button>
        <button
          onClick={handleToggleFavorite}
          className={`p-2 rounded-lg transition-all duration-200 ${isCurrentImageFavorited
            ? 'text-red-400 hover:text-red-300'
            : 'text-white hover:text-red-300 hover:bg-white hover:bg-opacity-20'
            }`}
          title="Toggle Favorite"
        >
          {isCurrentImageFavorited ? <FaHeart size={16} /> : <FaRegHeart size={16} />}
        </button>
        <button
          onClick={() => setShowFavoritesGallery(prev => !prev)}
          className={`p-2 rounded-lg transition-all duration-200 ${showFavoritesGallery
            ? 'text-red-400 bg-red-400 bg-opacity-20'
            : 'text-white hover:text-red-300 hover:bg-white hover:bg-opacity-20'
            }`}
          title={`View Favorites (${favoritesData?.length || 0})`}
        >
          <FaTh size={16} />
        </button>
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className={`text-white p-2 rounded-lg transition-all duration-200 ${isDownloading
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:text-blue-300 hover:bg-white hover:bg-opacity-20'
            }`}
          title={isDownloading ? "Downloading..." : "Download Image"}
          aria-label={isDownloading ? "Downloading image" : "Download image"}
        >
          {isDownloading ? (
            <UrbanSetuSpinner size="sm" isBright={true} />
          ) : (
            <FaDownload size={16} />
          )}
        </button>
        <button
          onClick={handleShare}
          className="text-white hover:text-blue-300 p-2 rounded-lg hover:bg-white hover:bg-opacity-20 transition-all duration-200"
          title="Share"
        >
          <FaShare size={16} />
        </button>
        <button
          onClick={() => setShowInfo(prev => !prev)}
          className={`p-2 rounded-lg transition-all duration-200 ${showInfo
            ? 'text-blue-400 bg-blue-400 bg-opacity-20'
            : 'text-white hover:text-blue-300 hover:bg-white hover:bg-opacity-20'
            }`}
          title="Image Info (I)"
        >
          <FaInfo size={16} />
        </button>
        <button
          onClick={() => setShowSettings(prev => !prev)}
          className={`p-2 rounded-lg transition-all duration-200 ${showSettings
            ? 'text-yellow-400 bg-yellow-400 bg-opacity-20'
            : 'text-white hover:text-yellow-300 hover:bg-white hover:bg-opacity-20'
            }`}
          title="Settings"
        >
          <FaCog size={16} />
        </button>
      </div>

      {/* Mobile Controls - Compact */}
      <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 md:hidden flex items-center gap-1 bg-black bg-opacity-80 backdrop-blur-sm rounded-xl p-2 transition-all duration-300 ${showControls && !showFavoritesGallery ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}>
        <button
          onClick={handleZoomIn}
          className="text-white hover:text-blue-300 p-1.5 rounded-lg hover:bg-white hover:bg-opacity-20 transition-all duration-200"
          title="Zoom In"
        >
          <FaSearchPlus size={14} />
        </button>
        <button
          onClick={handleZoomOut}
          className="text-white hover:text-blue-300 p-1.5 rounded-lg hover:bg-white hover:bg-opacity-20 transition-all duration-200"
          title="Zoom Out"
        >
          <FaSearchMinus size={14} />
        </button>
        <button
          onClick={handleReset}
          className="text-white hover:text-blue-300 p-1.5 rounded-lg hover:bg-white hover:bg-opacity-20 transition-all duration-200"
          title="Reset"
        >
          <span className="text-xs font-bold">0</span>
        </button>
        <div className="w-px h-4 bg-white bg-opacity-30"></div>
        <button
          onClick={toggleSlideshow}
          className={`p-1.5 rounded-lg transition-all duration-200 ${isSlideshow
            ? 'text-red-400 hover:text-red-300 bg-red-400 bg-opacity-20'
            : 'text-white hover:text-blue-300 hover:bg-white hover:bg-opacity-20'
            }`}
          title="Slideshow"
        >
          {isSlideshow ? <FaPause size={14} /> : <FaPlay size={14} />}
        </button>
        <button
          onClick={handleToggleFavorite}
          className={`p-1.5 rounded-lg transition-all duration-200 ${isCurrentImageFavorited
            ? 'text-red-400 hover:text-red-300'
            : 'text-white hover:text-red-300 hover:bg-white hover:bg-opacity-20'
            }`}
          title="Favorite"
        >
          {isCurrentImageFavorited ? <FaHeart size={14} /> : <FaRegHeart size={14} />}
        </button>
        <button
          onClick={() => setShowFavoritesGallery(prev => !prev)}
          className={`p-1.5 rounded-lg transition-all duration-200 ${showFavoritesGallery
            ? 'text-red-400 bg-red-400 bg-opacity-20'
            : 'text-white hover:text-red-300 hover:bg-white hover:bg-opacity-20'
            }`}
          title="Favorites Grid"
        >
          <FaTh size={14} />
        </button>
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className={`text-white p-1.5 rounded-lg transition-all duration-200 ${isDownloading
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:text-blue-300 hover:bg-white hover:bg-opacity-20'
            }`}
          title={isDownloading ? "Downloading..." : "Download Image"}
          aria-label={isDownloading ? "Downloading image" : "Download image"}
        >
          {isDownloading ? (
            <UrbanSetuSpinner size="sm" isBright={true} />
          ) : (
            <FaDownload size={14} />
          )}
        </button>
        <button
          onClick={() => setShowSettings(prev => !prev)}
          className={`p-1.5 rounded-lg transition-all duration-200 ${showSettings
            ? 'text-yellow-400 bg-yellow-400 bg-opacity-20'
            : 'text-white hover:text-yellow-300 hover:bg-white hover:bg-opacity-20'
            }`}
          title="More"
        >
          <FaCog size={14} />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div
          ref={settingsRef}
          className="absolute top-20 right-4 md:right-4 left-4 md:left-auto bg-black bg-opacity-90 backdrop-blur-sm rounded-xl p-4 text-white min-w-64 max-w-xs md:max-w-none transition-all duration-300"
        >
          <h3 className="text-lg font-semibold mb-3">Settings</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span>Auto-hide controls</span>
              <input
                type="checkbox"
                checked={autoHideControls}
                onChange={(e) => setAutoHideControls(e.target.checked)}
                className="w-4 h-4"
              />
            </label>
            {isSlideshow && (
              <div>
                <label className="block text-sm mb-2">Slideshow Speed (ms)</label>
                <input
                  type="range"
                  min="1000"
                  max="10000"
                  step="500"
                  value={slideshowSpeed}
                  onChange={(e) => setSlideshowSpeed(Number(e.target.value))}
                  className="w-full"
                />
                <span className="text-sm text-gray-300">{slideshowSpeed}ms</span>
              </div>
            )}

            {/* Keyboard Shortcuts List */}
            <div className="hidden md:block pt-3 border-t border-gray-600">
              <div className="text-sm font-semibold text-gray-300 mb-2">Shortcuts</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-400">
                <span>←/→ : Next/Prev</span>
                <span>+/- : Zoom</span>
                <span>F : Fullscreen</span>
                <span>S : Slideshow</span>
                <span>I : Info</span>
                <span>H : Hide UI</span>
                <span>Esc : Close</span>
              </div>
            </div>
            {/* Desktop-only options */}
            <div className="hidden md:block space-y-2 pt-2 border-t border-gray-600">
              <button
                onClick={() => {
                  setShowFavoritesGallery(true);
                  setShowSettings(false);
                }}
                className="w-full text-left p-2 rounded-lg text-white hover:text-red-300 hover:bg-white hover:bg-opacity-20 transition-all duration-200"
              >
                <div className="flex items-center gap-2">
                  <FaHeart size={14} className="text-red-400" />
                  <span>My Favorites ({favoritesData?.length || 0})</span>
                </div>
              </button>
              <button
                onClick={() => setShowInfo(prev => !prev)}
                className={`w-full text-left p-2 rounded-lg transition-all duration-200 ${showInfo
                  ? 'text-blue-400 bg-blue-400 bg-opacity-20'
                  : 'text-white hover:text-blue-300 hover:bg-white hover:bg-opacity-20'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <FaInfo size={14} />
                  <span>Image Info</span>
                </div>
              </button>
              <button
                onClick={handleShare}
                className="w-full text-left p-2 rounded-lg text-white hover:text-blue-300 hover:bg-white hover:bg-opacity-20 transition-all duration-200"
              >
                <div className="flex items-center gap-2">
                  <FaShare size={14} />
                  <span>Share Image</span>
                </div>
              </button>
              <button
                onClick={toggleFullscreen}
                className="w-full text-left p-2 rounded-lg text-white hover:text-blue-300 hover:bg-white hover:bg-opacity-20 transition-all duration-200"
              >
                <div className="flex items-center gap-2">
                  {isFullscreen ? <FaCompress size={14} /> : <FaExpand size={14} />}
                  <span>{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
                </div>
              </button>
              <button
                onClick={handleRotate}
                className="w-full text-left p-2 rounded-lg text-white hover:text-blue-300 hover:bg-white hover:bg-opacity-20 transition-all duration-200"
              >
                <div className="flex items-center gap-2">
                  <FaUndo size={14} />
                  <span>Rotate Image</span>
                </div>
              </button>
              <button
                onClick={() => { setShowAboutViewer(true); setShowSettings(false); }}
                className="w-full text-left p-2 rounded-lg text-white hover:text-blue-300 hover:bg-white hover:bg-opacity-20 transition-all duration-200 border-t border-gray-600 mt-2 pt-3"
              >
                <div className="flex items-center gap-2">
                  <FaInfoCircle size={14} />
                  <span>About Viewer</span>
                </div>
              </button>
            </div>

            {/* Mobile-only options */}
            <div className="md:hidden space-y-2 pt-2 border-t border-gray-600">
              <button
                onClick={() => {
                  setShowFavoritesGallery(true);
                  setShowSettings(false);
                }}
                className="w-full text-left p-2 rounded-lg text-white hover:text-red-300 hover:bg-white hover:bg-opacity-20 transition-all duration-200"
              >
                <div className="flex items-center gap-2">
                  <FaHeart size={14} className="text-red-400" />
                  <span>My Favorites ({favoritesData?.length || 0})</span>
                </div>
              </button>
              <button
                onClick={() => { setShowInfo(prev => !prev); setShowSettings(false); }}
                className={`w-full text-left p-2 rounded-lg transition-all duration-200 ${showInfo
                  ? 'text-blue-400 bg-blue-400 bg-opacity-20'
                  : 'text-white hover:text-blue-300 hover:bg-white hover:bg-opacity-20'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <FaInfo size={14} />
                  <span>Image Info</span>
                </div>
              </button>
              <button
                onClick={() => { handleShare(); setShowSettings(false); }}
                className="w-full text-left p-2 rounded-lg text-white hover:text-blue-300 hover:bg-white hover:bg-opacity-20 transition-all duration-200"
              >
                <div className="flex items-center gap-2">
                  <FaShare size={14} />
                  <span>Share Image</span>
                </div>
              </button>
              <button
                onClick={() => { toggleFullscreen(); setShowSettings(false); }}
                className="w-full text-left p-2 rounded-lg text-white hover:text-blue-300 hover:bg-white hover:bg-opacity-20 transition-all duration-200"
              >
                <div className="flex items-center gap-2">
                  {isFullscreen ? <FaCompress size={14} /> : <FaExpand size={14} />}
                  <span>{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
                </div>
              </button>
              <button
                onClick={() => { handleRotate(); setShowSettings(false); }}
                className="w-full text-left p-2 rounded-lg text-white hover:text-blue-300 hover:bg-white hover:bg-opacity-20 transition-all duration-200"
              >
                <div className="flex items-center gap-2">
                  <FaUndo size={14} />
                  <span>Rotate Image</span>
                </div>
              </button>
              <button
                onClick={() => { setShowAboutViewer(true); setShowSettings(false); }}
                className="w-full text-left p-2 rounded-lg text-white hover:text-blue-300 hover:bg-white hover:bg-opacity-20 transition-all duration-200 border-t border-gray-600 mt-2 pt-3"
              >
                <div className="flex items-center gap-2">
                  <FaInfoCircle size={14} />
                  <span>About Viewer</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Info Panel */}
      {showInfo && (
        <div
          data-info-panel
          className="absolute top-20 left-4 md:left-4 right-4 md:right-auto bg-black bg-opacity-90 backdrop-blur-sm rounded-xl p-4 text-white min-w-64 max-w-xs md:max-w-none transition-all duration-300"
        >
          <h3 className="text-lg font-semibold mb-3">Image Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Image:</span>
              <span>{currentIndex + 1} of {imagesArray.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Zoom:</span>
              <span>{Math.round(scale * 100)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Rotation:</span>
              <span>{rotation}°</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={isCurrentImageFavorited ? 'text-red-400' : 'text-gray-400'}>
                {isCurrentImageFavorited ? 'Favorited' : 'Not favorited'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Image Counter & Favorites Back Button */}
      <div className={`absolute top-4 left-4 flex items-center gap-2 z-10 transition-all duration-300 ${showControls && !showFavoritesGallery ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
        {isFavoritesMode && (
          <button
            onClick={() => {
              setShowFavoritesGallery(true);
              setScale(1);
              setPosition({ x: 0, y: 0 });
            }}
            className="text-white hover:text-blue-300 bg-black bg-opacity-70 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2 transition-all duration-300 hover:bg-opacity-90 hover:scale-105 pointer-events-auto"
            title="Back to Favorites Grid"
          >
            <FaArrowLeft size={14} />
            <span className="text-sm font-semibold">Favorites Grid</span>
          </button>
        )}
        {imagesArray.length > 1 && (
          <div className="text-white bg-black bg-opacity-70 backdrop-blur-sm rounded-lg px-3 py-2">
            <span className="font-medium">{currentIndex + 1}</span>
            <span className="text-gray-300"> / {imagesArray.length}</span>
          </div>
        )}
      </div>

      {/* Central Feedback Toast */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none transition-opacity duration-300 ${feedbackMessage ? 'opacity-100' : 'opacity-0'}`}>
        <div className="bg-black/70 backdrop-blur-md text-white text-3xl font-bold px-6 py-4 rounded-xl shadow-2xl whitespace-nowrap">
          {feedbackMessage}
        </div>
      </div>

      {/* Slideshow Indicator */}
      {isSlideshow && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 text-red-400 bg-black bg-opacity-70 backdrop-blur-sm rounded-lg px-3 py-2 animate-pulse">
          <div className="flex items-center gap-2">
            <FaPlay size={12} />
            <span className="text-sm font-medium">Slideshow Active</span>
          </div>
        </div>
      )}

      {/* Social Share Panel */}
      <SocialSharePanel
        isOpen={showSocialShare}
        onClose={() => { setShowSocialShare(false); setShareUrl(null); }}
        url={shareUrl || ""}
        title="Check out this property image!"
        description="Amazing property image from our listing"
        isLoading={isGeneratingShare}
      />

      {/* Favorites Gallery Overlay */}
      {showFavoritesGallery && (
        <div 
          className="absolute inset-0 bg-[#0c0c0c]/98 backdrop-blur-md z-50 flex flex-col p-4 sm:p-6 transition-all duration-300 animate-fadeIn overflow-hidden pointer-events-auto"
          onClick={(e) => e.stopPropagation()} // Prevent closing/toggling controls
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white tracking-wide">My Favorites</h2>
              <span className="bg-red-500/20 text-red-400 text-xs px-2.5 py-1 rounded-full border border-red-500/30 font-semibold">
                {favoritesData?.length || 0}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isFavoritesMode && (
                <button
                  onClick={() => {
                    setIsFavoritesMode(false);
                    setCurrentIndex(0);
                    showFeedback("Back to Listing");
                  }}
                  className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 text-blue-400 rounded-lg text-xs font-semibold transition-all duration-200"
                >
                  Switch to Listing Images
                </button>
              )}
              <button
                onClick={() => setShowFavoritesGallery(false)}
                className="text-white/70 hover:text-white bg-white/5 hover:bg-white/10 p-2.5 rounded-full transition-all duration-200"
                title="Close Gallery"
              >
                <FaTimes size={18} />
              </button>
            </div>
          </div>

          {/* Grid Content */}
          {(!favoritesData || favoritesData.length === 0) ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="relative mb-4">
                <div className="absolute -inset-2 bg-red-500/20 rounded-full blur animate-pulse"></div>
                <div className="relative w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center">
                  <FaHeart className="text-red-500 animate-bounce" size={24} />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">No favorites saved yet</h3>
              <p className="text-white/40 text-sm max-w-xs">
                Heart images while browsing listings to view them here in your favorites gallery.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pb-12 pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 sm:gap-8">
                {favoritesData.map((fav, idx) => (
                  <div
                    key={fav.imageId || fav._id || idx}
                    onClick={() => {
                      setIsFavoritesMode(true);
                      setCurrentIndex(idx);
                      setShowFavoritesGallery(false);
                      setScale(1);
                      setRotation(0);
                      setPosition({ x: 0, y: 0 });
                    }}
                    className="relative aspect-[4/3] rounded-xl overflow-hidden border border-white/10 bg-white/5 cursor-pointer group transition-all duration-300 hover:scale-[1.02] hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10"
                  >
                    <img
                      src={fav.imageUrl}
                      alt={fav.metadata?.imageName || `Favorite ${idx + 1}`}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    {/* Hover Information overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 pointer-events-none">
                      <p className="text-white font-medium text-xs truncate">
                        {fav.metadata?.imageName || `Favorite #${idx + 1}`}
                      </p>
                      {fav.metadata?.imageType && (
                        <p className="text-white/50 text-[10px] uppercase tracking-wider font-semibold">
                          {fav.metadata.imageType}
                        </p>
                      )}
                      {(fav.addedAt || fav.createdAt) && (
                        <p className="text-white/40 text-[9px] mt-0.5 font-medium">
                          {new Date(fav.addedAt || fav.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                    </div>
                    {/* Unfavorite overlay button */}
                    <button
                      onClick={(e) => handleRemoveFavoriteFromGrid(e, fav)}
                      className="absolute top-2 right-2 p-2 rounded-lg bg-black/70 border border-white/10 text-red-500 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all duration-200 z-10"
                      title="Remove from Favorites"
                    >
                      <FaHeart size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* About Viewer Modal */}
      {showAboutViewer && (
        <div className="absolute inset-0 flex items-center justify-center z-[100] p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md pointer-events-auto"
            onClick={() => setShowAboutViewer(false)}
          />
          <div className="relative w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto animate-scaleIn">
            <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 p-6 flex flex-col items-center">
              <div className="relative group mb-4">
                <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur opacity-40 group-hover:opacity-60 transition duration-500"></div>
                <div className="relative w-20 h-20 bg-black rounded-full flex items-center justify-center border border-white/20">
                  <FaEye className="text-white text-3xl" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">UrbanSetu Image Viewer</h3>
              <p className="text-blue-400 text-sm font-medium tracking-wide">Version 1.8.0 "Darpan"</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <div>
                    <p className="text-white/90 text-sm font-medium">Smart Rendering</p>
                    <p className="text-white/40 text-xs">High-fidelity image processing with adaptive scaling for any display.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-purple-500" />
                  <div>
                    <p className="text-white/90 text-sm font-medium">Smooth Navigation</p>
                    <p className="text-white/40 text-xs">Intuitive zoom, rotate, and swipe gestures for natural browsing.</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 flex flex-col gap-2">
                <p className="text-white/30 text-[10px] uppercase tracking-widest text-center">Built by VijayCh</p>
              </div>

              <button
                onClick={() => setShowAboutViewer(false)}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/90 rounded-xl font-semibold text-sm transition-all active:scale-95 border border-white/5 mt-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
};

export default ImagePreview;
