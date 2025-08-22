import React, { useState, useRef, useEffect } from 'react';
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
  FaEyeSlash
} from 'react-icons/fa';

const ImagePreview = ({ isOpen, onClose, images, initialIndex = 0 }) => {
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
  const [isFavorited, setIsFavorited] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoHideControls, setAutoHideControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState(null);
  
  const imageRef = useRef(null);
  const slideshowRef = useRef(null);
  const settingsRef = useRef(null);

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
    if (isSlideshow && images.length > 1) {
      slideshowRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % images.length);
      }, slideshowSpeed);
    }

    return () => {
      if (slideshowRef.current) {
        clearInterval(slideshowRef.current);
      }
    };
  }, [isSlideshow, slideshowSpeed, images.length]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      
      // Show controls on any interaction
      if (!showControls) setShowControls(true);
      
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          setCurrentIndex(prev => prev > 0 ? prev - 1 : images.length - 1);
          break;
        case 'ArrowRight':
          setCurrentIndex(prev => prev < images.length - 1 ? prev + 1 : 0);
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
      if (!isOpen) return;
      e.preventDefault();
      
      if (!showControls) setShowControls(true);
      
      if (e.deltaY < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    };

    const handleMouseMove = () => {
      if (!showControls) setShowControls(true);
    };

    const handleClickOutside = (e) => {
      // Check if click is on settings button or inside settings panel
      const isSettingsButton = e.target.closest('button[title="Settings"], button[title="More"]');
      if (showSettings && settingsRef.current && !settingsRef.current.contains(e.target) && !isSettingsButton) {
        setShowSettings(false);
      }
      
      // Check if click is on info button or inside info panel
      const isInfoButton = e.target.closest('button[title="Image Info (I)"]');
      if (showInfo && !e.target.closest('[data-info-panel]') && !isInfoButton) {
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
      }, [isOpen, images.length, onClose, showControls, showSettings, showInfo]);

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

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.2, 8));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev / 1.2, 0.1));
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleRotate = () => {
    setRotation(prev => prev + 90);
  };

  const handleMouseDown = (e) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (scale > 1 && e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      });
    }
  };

  const handleTouchMove = (e) => {
    if (isDragging && scale > 1 && e.touches.length === 1) {
      e.preventDefault();
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = images[currentIndex];
    link.download = `property-image-${currentIndex + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleFullscreen = () => {
    if (isFullscreen) {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    } else {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    }
  };

  const toggleSlideshow = () => {
    setIsSlideshow(prev => !prev);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Property Image',
        text: 'Check out this property image!',
        url: images[currentIndex]
      });
    } else {
      navigator.clipboard.writeText(images[currentIndex]);
      // You could add a toast notification here
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

  const handleImageClick = (e) => {
    e.stopPropagation();
  };

  if (!isOpen || !images || images.length === 0) return null;

  return (
    <div 
      className={`fixed inset-0 bg-black bg-opacity-95 z-[9999] flex items-center justify-center transition-all duration-300 ${
        isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className={`absolute top-4 right-4 text-white hover:text-red-400 z-10 bg-black bg-opacity-70 rounded-full p-3 transition-all duration-300 hover:bg-opacity-90 hover:scale-110 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}
      >
        <FaTimes size={20} />
      </button>

      {/* Navigation Arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIndex(prev => prev > 0 ? prev - 1 : images.length - 1)}
            className={`absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-blue-300 z-10 bg-black bg-opacity-70 rounded-full p-4 transition-all duration-300 hover:bg-opacity-90 hover:scale-110 ${
              showControls ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setCurrentIndex(prev => prev < images.length - 1 ? prev + 1 : 0)}
            className={`absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-blue-300 z-10 bg-black bg-opacity-70 rounded-full p-4 transition-all duration-300 hover:bg-opacity-90 hover:scale-110 ${
              showControls ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Image Container */}
      <div className="relative max-w-full max-h-full overflow-hidden">
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}
        
        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <div className="text-center">
              <FaEyeSlash size={48} className="mx-auto mb-4 opacity-50" />
              <p>Failed to load image</p>
            </div>
          </div>
        )}

        <img
          ref={imageRef}
          src={images[currentIndex]}
          alt={`Property image ${currentIndex + 1}`}
          className={`max-w-full max-h-full object-contain cursor-move transition-opacity duration-300 ${
            imageLoading ? 'opacity-0' : 'opacity-100'
          }`}
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg) translate(${position.x}px, ${position.y}px)`,
            transition: isDragging ? 'none' : 'transform 0.2s ease-out'
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onLoad={handleImageLoad}
          onError={handleImageError}
          draggable={false}
        />
      </div>

      {/* Enhanced Controls - Desktop */}
      <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 hidden md:flex items-center gap-2 bg-black bg-opacity-80 backdrop-blur-sm rounded-xl p-3 transition-all duration-300 ${
        showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
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
          className={`p-2 rounded-lg transition-all duration-200 ${
            isSlideshow 
              ? 'text-red-400 hover:text-red-300 bg-red-400 bg-opacity-20' 
              : 'text-white hover:text-blue-300 hover:bg-white hover:bg-opacity-20'
          }`}
          title="Toggle Slideshow (S)"
        >
          {isSlideshow ? <FaPause size={16} /> : <FaPlay size={16} />}
        </button>
        <button
          onClick={() => setIsFavorited(prev => !prev)}
          className={`p-2 rounded-lg transition-all duration-200 ${
            isFavorited 
              ? 'text-red-400 hover:text-red-300' 
              : 'text-white hover:text-red-300 hover:bg-white hover:bg-opacity-20'
          }`}
          title="Toggle Favorite"
        >
          {isFavorited ? <FaHeart size={16} /> : <FaRegHeart size={16} />}
        </button>
        <button
          onClick={handleDownload}
          className="text-white hover:text-blue-300 p-2 rounded-lg hover:bg-white hover:bg-opacity-20 transition-all duration-200"
          title="Download"
        >
          <FaDownload size={16} />
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
          className={`p-2 rounded-lg transition-all duration-200 ${
            showInfo 
              ? 'text-blue-400 bg-blue-400 bg-opacity-20' 
              : 'text-white hover:text-blue-300 hover:bg-white hover:bg-opacity-20'
          }`}
          title="Image Info (I)"
        >
          <FaInfo size={16} />
        </button>
        <button
          onClick={() => setShowSettings(prev => !prev)}
          className={`p-2 rounded-lg transition-all duration-200 ${
            showSettings 
              ? 'text-yellow-400 bg-yellow-400 bg-opacity-20' 
              : 'text-white hover:text-yellow-300 hover:bg-white hover:bg-opacity-20'
          }`}
          title="Settings"
        >
          <FaCog size={16} />
        </button>
      </div>

      {/* Mobile Controls - Compact */}
      <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 md:hidden flex items-center gap-1 bg-black bg-opacity-80 backdrop-blur-sm rounded-xl p-2 transition-all duration-300 ${
        showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
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
          className={`p-1.5 rounded-lg transition-all duration-200 ${
            isSlideshow 
              ? 'text-red-400 hover:text-red-300 bg-red-400 bg-opacity-20' 
              : 'text-white hover:text-blue-300 hover:bg-white hover:bg-opacity-20'
          }`}
          title="Slideshow"
        >
          {isSlideshow ? <FaPause size={14} /> : <FaPlay size={14} />}
        </button>
        <button
          onClick={() => setIsFavorited(prev => !prev)}
          className={`p-1.5 rounded-lg transition-all duration-200 ${
            isFavorited 
              ? 'text-red-400 hover:text-red-300' 
              : 'text-white hover:text-red-300 hover:bg-white hover:bg-opacity-20'
          }`}
          title="Favorite"
        >
          {isFavorited ? <FaHeart size={14} /> : <FaRegHeart size={14} />}
        </button>
        <button
          onClick={handleDownload}
          className="text-white hover:text-blue-300 p-1.5 rounded-lg hover:bg-white hover:bg-opacity-20 transition-all duration-200"
          title="Download"
        >
          <FaDownload size={14} />
        </button>
        <button
          onClick={() => setShowSettings(prev => !prev)}
          className={`p-1.5 rounded-lg transition-all duration-200 ${
            showSettings 
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
            {/* Desktop-only options */}
            <div className="hidden md:block space-y-2 pt-2 border-t border-gray-600">
              <button
                onClick={() => setShowInfo(prev => !prev)}
                className={`w-full text-left p-2 rounded-lg transition-all duration-200 ${
                  showInfo 
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
            </div>
            {/* Mobile-only options */}
            <div className="md:hidden space-y-2 pt-2 border-t border-gray-600">
              <button
                onClick={() => setShowInfo(prev => !prev)}
                className={`w-full text-left p-2 rounded-lg transition-all duration-200 ${
                  showInfo 
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
              <span>{currentIndex + 1} of {images.length}</span>
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
              <span className={isFavorited ? 'text-red-400' : 'text-gray-400'}>
                {isFavorited ? 'Favorited' : 'Not favorited'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Image Counter */}
      {images.length > 1 && (
        <div className={`absolute top-4 left-4 text-white bg-black bg-opacity-70 backdrop-blur-sm rounded-lg px-3 py-2 transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}>
          <span className="font-medium">{currentIndex + 1}</span>
          <span className="text-gray-300"> / {images.length}</span>
        </div>
      )}

      {/* Zoom Level Indicator */}
      <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-70 backdrop-blur-sm rounded-lg px-3 py-2 transition-all duration-300 ${
        showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}>
        <span className="font-medium">{Math.round(scale * 100)}%</span>
      </div>

      {/* Enhanced Instructions */}
      <div className={`absolute bottom-20 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-70 backdrop-blur-sm rounded-xl px-6 py-4 text-sm max-w-md transition-all duration-300 ${
        showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}>
        <div className="text-center space-y-1">
          <div className="hidden sm:block font-medium">Keyboard Shortcuts</div>
          <div className="hidden sm:block text-gray-300">Mouse wheel or +/- to zoom • Drag to pan</div>
          <div className="hidden sm:block text-gray-300">Arrow keys to navigate • F for fullscreen</div>
          <div className="hidden sm:block text-gray-300">S for slideshow • I for info • H to hide controls</div>
          <div className="sm:hidden font-medium">Touch Controls</div>
          <div className="sm:hidden text-gray-300">Tap to zoom • Swipe to navigate • Pinch to zoom</div>
          <div className="sm:hidden text-gray-300">Use close icon to exit</div>
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
    </div>
  );
};

export default ImagePreview;