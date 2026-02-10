import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { authenticatedFetch } from '../utils/auth';
import { toast } from 'react-toastify';
import {
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaPlay,
  FaPause,
  FaVolumeUp,
  FaVolumeDown,
  FaVolumeMute,
  FaExpand,
  FaCompress,
  FaSearchPlus,
  FaSearchMinus,
  FaUndo,
  FaDownload,
  FaCog,
  FaTachometerAlt,
  FaSpinner,
  FaSun,
  FaClone,
  FaWindowRestore,
  FaTrashAlt,
  FaShareAlt,
  FaRedo,
  FaWifi,
  FaLink,
  FaCode,
  FaInfoCircle,
  FaTools,
  FaChartLine,
  FaHistory,
  FaInfinity
} from 'react-icons/fa';

import SocialSharePanel from './SocialSharePanel';

const VideoPreview = ({ isOpen, onClose, videos = [], initialIndex = 0 }) => {
  // Playback States
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
  const [retryId, setRetryId] = useState(0); // For network recovery/retries
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadedProgress, setLoadedProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMiniMode, setIsMiniMode] = useState(false);
  const [duration, setDuration] = useState(0);

  const [playbackRate, setPlaybackRate] = useState(1);
  const [brightness, setBrightness] = useState(1);

  // View States
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [autoScale, setAutoScale] = useState(1);
  const [videoBlobUrl, setVideoBlobUrl] = useState(null); // State for Blob URL

  // Transform States
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isEnded, setIsEnded] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isOnlineRecently, setIsOnlineRecently] = useState(false);
  const [isManualRetrying, setIsManualRetrying] = useState(false);
  const [showRetryButton, setShowRetryButton] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [zoomMessage, setZoomMessage] = useState(null);
  const zoomTimeoutRef = useRef(null);
  const [seekFeedback, setSeekFeedback] = useState(null); // 'forward' | 'rewind' | null
  const lastTapRef = useRef(0);

  // Mini Mode States
  const [miniPosition, setMiniPosition] = useState({ x: 20, y: 20 }); // Position from bottom-right (initially) is handled via CSS, but for dragging we might need absolute coords. Let's stick to fixed positioning.
  // Actually, for dragging, "fixed" with top/left is easier.
  // Let's toggle: when entering mini mode, set initial Top/Left based on window size.
  const [miniSize, setMiniSize] = useState({ width: 320, height: 192 }); // Default 16:9
  const isMiniDraggingRef = useRef(false);
  const miniDragStartRef = useRef({ x: 0, y: 0 }); // Mouse/Touch start
  const miniStartPosRef = useRef({ x: 0, y: 0 }); // Element Left/Top start
  const [isOverTrash, setIsOverTrash] = useState(false); // New state for Trash Hover
  const [isTrashClosing, setIsTrashClosing] = useState(false); // State to delay close for animation

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const singleClickTimeoutRef = useRef(null);
  const speedTimeoutRef = useRef(null);
  const originalSpeedRef = useRef(1);
  const isSpeedingRef = useRef(false);
  const ignoreClickRef = useRef(false);
  const justClickedRef = useRef(false);
  const isTouchRef = useRef(false);
  const touchStartRef = useRef({ time: 0, x: 0, y: 0 });
  const wasPlayingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const pinchStartDistRef = useRef(null);
  const pinchStartScaleRef = useRef(1);
  const lastDragRef = useRef({ x: 0, y: 0 });
  const gestureRef = useRef({ type: null, startY: 0, startVal: 0 });
  const gestureTimeoutRef = useRef(null);
  const [activeGesture, setActiveGesture] = useState(null);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isAnimatingSwipe, setIsAnimatingSwipe] = useState(false);

  // Custom Context Menu & Advanced States
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0 });
  const [isLooping, setIsLooping] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showRemainingTime, setShowRemainingTime] = useState(false);
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  const [isBottomControlsHovered, setIsBottomControlsHovered] = useState(false);
  const [showAboutPlayer, setShowAboutPlayer] = useState(false);
  const contextMenuRef = useRef(null);

  // Preview Thumbnail States
  const [previewTime, setPreviewTime] = useState(0);
  const [previewPos, setPreviewPos] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const previewVideoRef = useRef(null);

  // Helper to optimize Cloudinary URLs
  const optimizeVideoUrl = (url) => {
    if (!url) return '';
    // Check if it's a Cloudinary URL
    if (url.includes('cloudinary.com') && url.includes('/upload/')) {
      let newUrl = url;
      // Inject high quality q_auto:best if not present
      if (!newUrl.includes('q_auto')) {
        newUrl = newUrl.replace('/upload/', '/upload/q_auto:best/');
      }
      return newUrl;
    }
    return url;
  };

  // NEW: Helper to get image thumbnail at specific time for Cloudinary
  const getThumbnailUrl = (url, time) => {
    if (!url || !url.includes('cloudinary.com')) return null;

    // Replace extension with .jpg and add start offset (so_) transformation
    // We use w_320 to keep it very light
    const timeInSec = Math.floor(time || 0);
    return url
      .replace(/\/v\d+\//, '/') // Remove version for cleaner transform
      .replace('/upload/', `/upload/so_${timeInSec},w_320,f_auto,q_auto/`)
      .replace(/\.[^/.]+$/, '.jpg');
  };

  const currentVideoUrl = optimizeVideoUrl(videos[currentIndex]);

  // Loading Delay for Retry Button
  useEffect(() => {
    let timeout;
    if (isLoading) {
      // Only show retry button if loading takes more than 6 seconds
      timeout = setTimeout(() => {
        setShowRetryButton(true);
      }, 6000);
    } else {
      setShowRetryButton(false);
      setIsManualRetrying(false);
    }
    return () => clearTimeout(timeout);
  }, [isLoading]);



  // Sync currentIndex with initialIndex only on OPEN
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex || 0);
    }
  }, [isOpen, initialIndex]);

  // Main Reset & Cleanup Effect - runs on Open or Index Change
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = isMiniMode ? '' : 'hidden';
      // Reset playback states
      setIsLoading(true);
      setIsPlaying(true);
      setDuration(0);
      setVideoBlobUrl(null);

      setProgress(0);
      setLoadedProgress(0);
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setPlaybackRate(1);
      setShowControls(true);
      setShowSettings(false);
      setShowCloseConfirm(false);
      setIsEnded(false);
      setIsOffline(!navigator.onLine);
      setIsOnlineRecently(false);
      setIsManualRetrying(false);
    } else {
      document.body.style.overflow = '';
      setIsPlaying(false);
      setIsMiniMode(false);
      setMiniSize({ width: 320, height: 192 });
      setShowAboutPlayer(false);
      setVideoBlobUrl(null);
    }
    return () => {
      document.body.style.overflow = '';
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
    };
  }, [isOpen, currentIndex]);

  // Fetch Blob Effect
  useEffect(() => {
    let active = true;
    let objectUrl = null;

    const loadVideo = async () => {
      if (!currentVideoUrl || !isOpen) return;

      // If already a blob (local preview) OR a Cloudinary URL, use it directly to enable browser streaming
      // (Fetching 86MB+ as a blob into memory causes timeouts and crashes)
      if (currentVideoUrl.startsWith('blob:') || currentVideoUrl.includes('cloudinary.com')) {
        setVideoBlobUrl(currentVideoUrl);
        return;
      }

      try {
        setIsLoading(true);
        // USE standard fetch for Cloudinary to avoid CORS 'credentials/wildcard' issues
        const isCloudinary = currentVideoUrl.includes('cloudinary.com');
        const response = isCloudinary
          ? await fetch(currentVideoUrl)
          : await authenticatedFetch(currentVideoUrl);

        if (!response.ok) throw new Error('Network response was not ok');
        const blob = await response.blob();

        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setVideoBlobUrl(objectUrl);
        }
      } catch (err) {
        console.error("Failed to load video blob:", err);
        if (active) {
          setVideoBlobUrl(currentVideoUrl);
        }
      }
    };

    if (isOpen) {
      loadVideo();
    }

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [currentVideoUrl, isOpen, retryId]);

  // Keyboard Shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;

      switch (e.key.toLowerCase()) {
        case ' ': // Space - Play/Pause
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'm': // Mute
          e.preventDefault();
          setVolume(v => {
            const newV = v === 0 ? 1 : 0;
            showFeedback(newV === 0 ? "Muted" : "Unmuted");
            return newV;
          });
          break;
        case 'arrowright': // Forward 5s or Next video
        case 'l': // +10s
          e.preventDefault();
          if (scale === 1 && videos.length > 1 && e.ctrlKey) {
            setCurrentIndex(prev => prev < videos.length - 1 ? prev + 1 : 0);
          } else if (videoRef.current) {
            const seekTime = e.key.toLowerCase() === 'arrowright' ? 5 : 10;
            handleSeek(seekTime);
          }
          break;
        case 'arrowleft': // Rewind 5s or Prev video
        case 'j': // -10s
          e.preventDefault();
          if (scale === 1 && videos.length > 1 && e.ctrlKey) {
            setCurrentIndex(prev => prev > 0 ? prev - 1 : videos.length - 1);
          } else if (videoRef.current) {
            const seekTime = e.key.toLowerCase() === 'arrowleft' ? -5 : -10;
            handleSeek(seekTime);
          }
          break;
        case 'arrowup': // Volume Up or Pan Up
          e.preventDefault();
          if (scale > 1) {
            setPosition(p => ({ ...p, y: p.y + 20 }));
          } else {
            setVolume(v => {
              const newVal = Math.min(v + 0.1, 1);
              // Show side indicator
              setActiveGesture('volume');
              if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
              gestureTimeoutRef.current = setTimeout(() => setActiveGesture(null), 1000);

              // Show center toast
              showFeedback(
                <div className="flex items-center gap-3">
                  {getVolumeIcon(newVal)}
                  <span>Volume: {Math.round(newVal * 100)}%</span>
                </div>
              );
              return newVal;
            });
          }
          break;
        case 'arrowdown': // Volume Down or Pan Down
          e.preventDefault();
          if (scale > 1) {
            setPosition(p => ({ ...p, y: p.y - 20 }));
          } else {
            setVolume(v => {
              const newVal = Math.max(v - 0.1, 0);
              // Show side indicator
              setActiveGesture('volume');
              if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
              gestureTimeoutRef.current = setTimeout(() => setActiveGesture(null), 1000);

              // Show center toast
              showFeedback(
                <div className="flex items-center gap-3">
                  {getVolumeIcon(newVal)}
                  <span>Volume: {Math.round(newVal * 100)}%</span>
                </div>
              );
              return newVal;
            });
          }
          break;
        case '+': // Zoom In
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-': // Zoom Out
          e.preventDefault();
          handleZoomOut();
          break;
        case 'z': // Reset Zoom (Replaced '0' to match YouTube seeking)
          e.preventDefault();
          handleReset();
          break;
        case 'f': // Fullscreen
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'i': // Mini Player Toggle (YouTube style)
          e.preventDefault();
          toggleMiniMode();
          break;
        case 'r': // Rotate (Custom)
          e.preventDefault();
          handleRotate();
          break;
        case 's': // Share
          e.preventDefault();
          toggleShare();
          break;
        case 'd': // Download
          e.preventDefault();
          handleDownload(e);
          break;
        case '[': // Previous Video
          e.preventDefault();
          if (videos.length > 1) {
            setCurrentIndex(prev => prev > 0 ? prev - 1 : videos.length - 1);
          }
          break;
        case ']': // Next Video
          e.preventDefault();
          if (videos.length > 1) {
            setCurrentIndex(prev => prev < videos.length - 1 ? prev + 1 : 0);
          }
          break;
        case '.': // Frame Forward
        case '>': // Speed Up (Shift + .)
          e.preventDefault();
          if (e.shiftKey || e.key === '>') {
            speedUp();
          } else if (videoRef.current) {
            videoRef.current.currentTime += 0.05;
            showFeedback("Frame +");
          }
          break;
        case ',': // Frame Backward
        case '<': // Speed Down (Shift + ,)
          e.preventDefault();
          if (e.shiftKey || e.key === '<') {
            speedDown();
          } else if (videoRef.current) {
            videoRef.current.currentTime -= 0.05;
            showFeedback("Frame -");
          }
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9': // Seek to percentage
          e.preventDefault();
          if (videoRef.current) {
            const percent = parseInt(e.key);
            const targetTime = (percent / 10) * videoRef.current.duration;
            if (isFinite(targetTime)) {
              videoRef.current.currentTime = targetTime;
              showFeedback(`${percent * 10}%`);
            }
          }
          break;
        case 'home':
          e.preventDefault();
          if (videoRef.current) videoRef.current.currentTime = 0;
          break;
        case 'end':
          e.preventDefault();
          if (videoRef.current) videoRef.current.currentTime = videoRef.current.duration;
          break;
        case 'escape':
          e.preventDefault();
          handleCloseRequest();
          break;
      }
      setShowControls(true);
    };

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, scale, videos.length, isPlaying, isEnded, playbackRate]);

  // Context Menu Outside Click
  useEffect(() => {
    const handleClick = (e) => {
      if (contextMenu.show && contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu({ ...contextMenu, show: false });
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // Volume Effect
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      setIsMuted(volume === 0);
    }
  }, [volume]);

  // Fullscreen Sync
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Close floating volume on mobile when clicking elsewhere
  useEffect(() => {
    if (!isMobile || !isVolumeHovered || !isOpen) return;
    const handleGlobalClick = (e) => {
      if (!e.target.closest('.group/volume-container')) {
        setIsVolumeHovered(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [isMobile, isVolumeHovered, isOpen]);

  // Network Recovery Logic
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setIsOnlineRecently(true);
      setTimeout(() => setIsOnlineRecently(false), 4000);

      if (isOpen) {
        toast.info("Connection restored. Retrying playback...");
        setRetryId(prev => prev + 1);
        setIsManualRetrying(false);
        if (videoRef.current) {
          if (videoRef.current.networkState === 3 || videoRef.current.error || isLoading) {
            const currentTime = videoRef.current.currentTime;
            if (isFinite(currentTime)) {
              videoRef.current.load();
              videoRef.current.currentTime = currentTime;
            } else {
              videoRef.current.load();
            }
            if (isPlaying) {
              videoRef.current.play().catch(e => console.warn("Failed to auto-resume:", e));
            }
          }
        }
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      if (isOpen) {
        toast.warning("Connection lost. Video might stall.");
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOpen, isPlaying, isLoading]);

  // Feedback Toast Helper
  const showFeedback = (msg) => {
    setZoomMessage(msg);
    if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
    zoomTimeoutRef.current = setTimeout(() => setZoomMessage(null), 1500);
  };

  useEffect(() => {
    return () => {
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
      if (singleClickTimeoutRef.current) clearTimeout(singleClickTimeoutRef.current);
    };
  }, []);

  // Double Tap Seek Logic
  const handleSeek = (seconds) => {
    if (videoRef.current) {
      const newTime = videoRef.current.currentTime + seconds;
      if (isFinite(newTime)) {
        videoRef.current.currentTime = newTime;
        setSeekFeedback(seconds > 0 ? 'forward' : 'rewind');
        // Clear previous timeout if any
        if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
        gestureTimeoutRef.current = setTimeout(() => setSeekFeedback(null), 800);
      }
    }
  };

  const handleVideoAreaClick = (e) => {
    // Check if we should ignore click (due to long press speed interaction)
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }

    // Block mousemove activity detection for a short while (prevents emulated mousemove from reopening controls)
    justClickedRef.current = true;
    setTimeout(() => justClickedRef.current = false, 500);

    // Detect Double Tap
    const now = Date.now();
    const timeDiff = now - lastTapRef.current;

    if (timeDiff < 300 && timeDiff > 0) {
      // It's a double tap!
      if (singleClickTimeoutRef.current) clearTimeout(singleClickTimeoutRef.current);

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;

      if (x > width * 0.65) {
        // Right side (last 35%) -> Forward 5s
        handleSeek(5);
      } else if (x < width * 0.35) {
        // Left side (first 35%) -> Rewind 5s
        handleSeek(-5);
      }
    } else {
      // Potential Single Tap - Toggle Controls
      if (singleClickTimeoutRef.current) clearTimeout(singleClickTimeoutRef.current);
      singleClickTimeoutRef.current = setTimeout(() => {
        // Toggle controls even if zoomed, as long as it wasn't a drag (handled by ignoreClickRef)
        setShowControls(prev => !prev);
      }, 300);
    }

    lastTapRef.current = now;
  };

  // Activity Monitor (User Input - Keydown Only)
  useEffect(() => {
    if (!isOpen) return;

    const handleActivity = () => {
      setShowControls(true);
    };

    window.addEventListener('keydown', handleActivity);

    return () => {
      window.removeEventListener('keydown', handleActivity);
    };
  }, [isOpen]);

  // Auto-Hide Controls Logic
  useEffect(() => {
    if (showControls && isPlaying && !showSettings && !isDragging && !showPreview && !isVolumeHovered && !isBottomControlsHovered) {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    } else {
      // If paused, dragging, hovering seeker (showPreview), or volume toggler, keep controls visible
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    }

    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [showControls, isPlaying, showSettings, isDragging, showPreview, isVolumeHovered, isBottomControlsHovered]);

  // Playback effect
  useEffect(() => {
    if (videoRef.current && videoBlobUrl) {
      videoRef.current.playbackRate = playbackRate;
      if (isPlaying) {
        // Use a small delay or check for readyState if still failing, 
        // but adding videoBlobUrl to dependencies should fix the race condition.
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            console.warn("Autoplay interrupted or failed:", e);
            // Only set to false if it's a "real" interruption, not just a source change
            if (e.name !== 'AbortError') {
              setIsPlaying(false);
            }
          });
        }
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, currentIndex, playbackRate, videoBlobUrl]);

  // Volume & Mute effect
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Auto-fit logic for rotation
  useEffect(() => {
    const calculateAutoScale = () => {
      if (!containerRef.current || !videoRef.current) return;
      const vid = videoRef.current;
      const cont = containerRef.current;

      // Only adjust for 90/270 degrees
      if (rotation % 180 === 0) {
        setAutoScale(1);
        return;
      }

      const vw = vid.videoWidth;
      const vh = vid.videoHeight;
      if (!vw || !vh) return;

      const cw = cont.clientWidth;
      const ch = cont.clientHeight;

      // 1. Determine rendered size at 0 rotation (object-contain logic)
      const scale0 = Math.min(cw / vw, ch / vh);
      const rw = vw * scale0; // rendered width
      const rh = vh * scale0; // rendered height

      // 2. We are rotated 90deg, so VisualWidth = rh, VisualHeight = rw
      // We need: VisualWidth <= cw  AND  VisualHeight <= ch
      // i.e., rh * s <= cw  AND  rw * s <= ch

      const sWidth = cw / rh;
      const sHeight = ch / rw;

      const s = Math.min(sWidth, sHeight, 1); // Never scale up beyond 1 (which means "fit")
      setAutoScale(s);
    };

    calculateAutoScale();
    window.addEventListener('resize', calculateAutoScale);
    return () => window.removeEventListener('resize', calculateAutoScale);
  }, [rotation, currentIndex, isLoading]); // Recalculate on rotation, video change, or load completion

  // Effect to handle overflow updates when isMiniMode changes
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = isMiniMode ? '' : 'hidden';
    }
  }, [isMiniMode, isOpen]);

  if (!isOpen || !videos || videos.length === 0) return null;

  // Handlers
  const getVolumeIcon = (vol, props = {}) => {
    if (vol === 0) return <FaVolumeMute {...props} />;
    if (vol < 0.5) return <FaVolumeDown {...props} />;
    return <FaVolumeUp {...props} />;
  };

  const handleVideoError = () => {
    console.error("Video playback error");

    // Check if we can fallback to the original URL
    const originalUrl = videos[currentIndex];
    if (videoBlobUrl !== originalUrl) {
      console.log("Retrying with original source fallback...");
      setVideoBlobUrl(originalUrl);
      setIsLoading(true);
      setIsPlaying(true);
      toast.info("Retrying with original source...");
      return;
    }

    toast.error("Unable to play video.");
    setIsPlaying(false);
    setIsLoading(false);
  };

  const togglePlay = (e) => {
    e?.stopPropagation();
    if (isEnded) {
      if (videoRef.current) {
        const duration = videoRef.current.duration;
        if (isFinite(duration)) {
          videoRef.current.currentTime = 0;
        }
        setIsEnded(false);
        setIsPlaying(true);
        videoRef.current.play().catch(() => { });
      }
    } else {
      setIsPlaying(prev => {
        if (videoRef.current) {
          if (prev) videoRef.current.pause();
          else videoRef.current.play().catch(() => { });
        }
        return !prev;
      });
    }
  };

  const toggleMiniMode = (e) => {
    e?.stopPropagation();
    const willBeMini = !isMiniMode;

    if (willBeMini) {
      // Entering Mini Mode - Set Initial Position (Bottom-Right)
      if (typeof window !== 'undefined') {
        const w = window.innerWidth;
        const h = window.innerHeight;
        setMiniPosition({ x: w - 340, y: h - 220 });
        setMiniSize({ width: 320, height: 192 });
      }
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      showFeedback("Mini Player");
    } else {
      showFeedback("Normal View");
    }

    setIsMiniMode(willBeMini);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = duration || videoRef.current.duration || 1;
      setProgress((current / total) * 100);

      // Update Buffer
      if (videoRef.current.buffered.length > 0) {
        // Find the buffered range that covers the current time
        for (let i = 0; i < videoRef.current.buffered.length; i++) {
          if (videoRef.current.buffered.start(i) <= current && videoRef.current.buffered.end(i) >= current) {
            setLoadedProgress((videoRef.current.buffered.end(i) / total) * 100);
            break;
          }
        }
      }
    }
  };

  const handleProgress = () => {
    if (videoRef.current && videoRef.current.duration) {
      const vid = videoRef.current;
      const total = vid.duration;
      const current = vid.currentTime;

      // Update Buffer on download progress
      if (vid.buffered.length > 0) {
        for (let i = 0; i < vid.buffered.length; i++) {
          if (vid.buffered.start(i) <= current && vid.buffered.end(i) >= current) {
            setLoadedProgress((vid.buffered.end(i) / total) * 100);
            break;
          }
        }
      }
    }
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (isMuted) {
      setVolume(1);
      showFeedback(
        <div className="flex items-center gap-3">
          {getVolumeIcon(1)} <span>Unmuted</span>
        </div>
      );
    } else {
      setVolume(0);
      showFeedback(
        <div className="flex items-center gap-3">
          {getVolumeIcon(0)} <span>Muted</span>
        </div>
      );
    }
  };

  const toggleFullscreen = (e) => {
    e?.stopPropagation();
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
      showFeedback("Fullscreen");
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
      showFeedback("Exit Fullscreen");
    }
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    const url = videos[currentIndex];
    const filename = `video-${currentIndex + 1}.mp4`;

    showFeedback("Download started.");

    try {
      const isCloudinary = url.includes('cloudinary.com');
      const response = isCloudinary
        ? await fetch(url)
        : await authenticatedFetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      // Fallback
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    if (isMiniMode) return;

    // Calculate position taking into account the viewport
    const menuWidth = 240;
    const menuHeight = 300;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) x -= menuWidth;
    if (y + menuHeight > window.innerHeight) y -= menuHeight;

    setContextMenu({ show: true, x, y });
  };

  const copyToClipboard = async (text, message) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message || "Copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy");
    }
    setContextMenu(prev => ({ ...prev, show: false }));
  };

  const getDebugInfo = () => {
    const info = {
      url: videos[currentIndex],
      resolution: `${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}`,
      duration: videoRef.current?.duration,
      currentTime: videoRef.current?.currentTime,
      browser: navigator.userAgent,
      timestamp: new Date().toISOString()
    };
    return JSON.stringify(info, null, 2);
  };

  const handleZoomIn = (e) => {
    e?.stopPropagation();
    const newScale = Math.min(scale * 1.5, 5);
    setScale(newScale);
    showFeedback(`${Math.round(newScale * 100)}%`);
  };

  const handleZoomOut = (e) => {
    e?.stopPropagation();
    let newScale = Math.max(scale / 1.5, 1);
    // Snap to 1 if close
    if (newScale < 1.1) newScale = 1;

    setScale(newScale);
    showFeedback(`${Math.round(newScale * 100)}%`);

    if (newScale <= 1.5) setPosition({ x: 0, y: 0 }); // Reset pos if zoomed out
  };

  const handleRotate = (e) => {
    e?.stopPropagation();
    setRotation(r => {
      const newR = r + 90;
      showFeedback(`${newR}°`);
      return newR;
    });
  };

  const handleReset = (e) => {
    e?.stopPropagation();
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    setPlaybackRate(1);
    showFeedback("Reset");
  };

  const speedUp = () => {
    const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    setPlaybackRate(prev => {
      const nextIdx = (speeds.indexOf(prev) + 1) % speeds.length;
      const newVal = speeds[nextIdx];
      showFeedback(`${newVal}x Speed`);
      return newVal;
    });
  };

  const speedDown = () => {
    const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    setPlaybackRate(prev => {
      const currIdx = speeds.indexOf(prev);
      const nextIdx = currIdx > 0 ? currIdx - 1 : speeds.length - 1;
      const newVal = speeds[nextIdx];
      showFeedback(`${newVal}x Speed`);
      return newVal;
    });
  };

  const toggleSpeed = (e) => {
    e?.stopPropagation();
    speedUp();
  };

  const changeVideo = (dir) => { // dir: 1 (Next), -1 (Prev)
    if (isAnimatingSwipe) return;
    setIsAnimatingSwipe(true);
    const screenW = window.innerWidth;
    const exitTo = dir === 1 ? -screenW : screenW;

    setSwipeOffset(exitTo); // Animate out

    setTimeout(() => {
      setCurrentIndex(prev => {
        if (dir === 1) return prev < videos.length - 1 ? prev + 1 : prev;
        return prev > 0 ? prev - 1 : prev;
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

  const handleCloseRequest = (e) => {
    e?.stopPropagation();

    // If in fullscreen, exit fullscreen first
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.warn(err));
      // Listener will update state
      return;
    }

    if (videoRef.current) {
      wasPlayingRef.current = !videoRef.current.paused;
      if (!videoRef.current.paused) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
    setShowCloseConfirm(true);
  };

  const confirmClose = (e) => {
    e?.stopPropagation();
    setShowCloseConfirm(false);
    onClose();
  };

  const cancelClose = (e) => {
    e?.stopPropagation();
    setShowCloseConfirm(false);
    if (wasPlayingRef.current) {
      setIsPlaying(true);
    }
  };

  const toggleShare = (e) => {
    e?.stopPropagation();
    setShowSharePanel(true);
    if (videoRef.current && !videoRef.current.paused) {
      wasPlayingRef.current = true; // Remember we were playing
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      wasPlayingRef.current = false;
    }
  };

  // Drag & Speed Logic
  const handleMouseDown = (e) => {
    hasMovedRef.current = false;
    ignoreClickRef.current = false;
    if (scale > 1) {
      e.preventDefault();
      setIsDragging(true);
      lastDragRef.current = { x: e.clientX, y: e.clientY };
    } else {
      // Speed Logic (Long Press)
      originalSpeedRef.current = playbackRate;
      speedTimeoutRef.current = setTimeout(() => {
        isSpeedingRef.current = true;
        setPlaybackRate(2.0);
        showFeedback("2x Speed");
      }, 500);
    }
  };

  const getClampedPosition = (x, y, currentScale) => {
    if (!containerRef.current || !videoRef.current) return { x, y };

    const cont = containerRef.current;
    const vid = videoRef.current;
    const isRotated = rotation % 180 !== 0;

    const vw = vid.videoWidth || 0;
    const vh = vid.videoHeight || 0;

    if (!vw || !vh) return { x, y };

    const cw = cont.clientWidth;
    const ch = cont.clientHeight;

    // True rendered dimensions at scale=1
    const scale0 = Math.min(cw / (isRotated ? vh : vw), ch / (isRotated ? vw : vh));

    // Check if image is smaller than container even at scale 1 (centered)
    const rw = (isRotated ? vh : vw) * scale0 * currentScale;
    const rh = (isRotated ? vw : vh) * scale0 * currentScale;

    const maxX = Math.max(0, (rw - cw) / 2);
    const maxY = Math.max(0, (rh - ch) / 2);

    return {
      x: Math.min(Math.max(x, -maxX), maxX),
      y: Math.min(Math.max(y, -maxY), maxY)
    };
  };

  const handleMouseMove = (e) => {
    // Activity Monitor (Desktop)
    if (!justClickedRef.current && !isTouchRef.current) {
      setShowControls(true);
    }

    if (isDragging && scale > 1) {
      hasMovedRef.current = true;
      e.preventDefault();
      const dx = e.clientX - lastDragRef.current.x;
      const dy = e.clientY - lastDragRef.current.y;

      setPosition(prev => getClampedPosition(prev.x + dx / scale, prev.y + dy / scale, scale));

      lastDragRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    if (speedTimeoutRef.current) clearTimeout(speedTimeoutRef.current);

    if (isSpeedingRef.current) {
      // Revert speed
      setPlaybackRate(originalSpeedRef.current);
      isSpeedingRef.current = false;
      ignoreClickRef.current = true; // Prevent click from toggling controls
      showFeedback(`${originalSpeedRef.current}x Speed`); // Optional confirmation
    }

    if (isDragging && hasMovedRef.current) {
      ignoreClickRef.current = true;
    }

    setIsDragging(false);
  };

  // Desktop Wheel Logic (Volume/Brightness)
  const handleWheel = (e) => {
    if (!isOpen) return;

    const width = window.innerWidth;
    const x = e.clientX;
    const delta = e.deltaY;

    // Debounce active gesture clear
    const clearGesture = () => {
      if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
      gestureTimeoutRef.current = setTimeout(() => setActiveGesture(null), 1000);
    };

    // Left 15% - Brightness
    if (x < width * 0.15) {
      const step = 0.1;
      const direction = delta > 0 ? -1 : 1; // Scroll Down (positive) -> Decrease
      const newVal = Math.min(Math.max(brightness + (direction * step), 0.2), 2.0);

      setBrightness(newVal);
      setActiveGesture('brightness');
      showFeedback(
        <div className="flex items-center gap-3">
          <FaSun />
          <span>Brightness: {Math.round(newVal * 100)}%</span>
        </div>
      );
      clearGesture();
    }
    // Right 15% - Volume
    else if (x > width * 0.85) {
      const step = 0.05;
      const direction = delta > 0 ? -1 : 1;
      const newVal = Math.min(Math.max(volume + (direction * step), 0), 1);

      setVolume(newVal);
      setActiveGesture('volume');
      showFeedback(
        <div className="flex items-center gap-3">
          {getVolumeIcon(newVal)}
          <span>Volume: {Math.round(newVal * 100)}%</span>
        </div>
      );
      clearGesture();
    }
  };

  // Touch Logic
  const handleTouchStart = (e) => {
    isTouchRef.current = true;
    hasMovedRef.current = false;
    ignoreClickRef.current = false;
    gestureRef.current = { type: null, startY: 0, startVal: 0 };
    if (speedTimeoutRef.current) clearTimeout(speedTimeoutRef.current);

    if (isMiniMode) {
      if (e.touches.length === 1) {
        handleMiniMouseDown(e.touches[0]);
      } else if (e.touches.length === 2) {
        // Mini Mode Resize (Pinch)
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchStartDistRef.current = dist;
        pinchStartScaleRef.current = miniSize.width; // Store current Width as "scale"
      }
      return;
    }

    if (e.touches.length === 2) {
      // Pinch Zoom Start
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = scale;
      setIsDragging(false); // Disable drag during pinch
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (scale > 1) {
        setIsDragging(true);
        lastDragRef.current = { x: touch.clientX, y: touch.clientY };
      } else {
        touchStartRef.current = { time: Date.now(), x: touch.clientX, y: touch.clientY };
        originalSpeedRef.current = playbackRate;
        speedTimeoutRef.current = setTimeout(() => {
          isSpeedingRef.current = true;
          setPlaybackRate(2.0);
          showFeedback("2x Speed");
          ignoreClickRef.current = true;
        }, 500);
      }
    }
  };

  const handleTouchMove = (e) => {
    if (isMiniMode) {
      if (e.touches.length === 2 && pinchStartDistRef.current) {
        // Resize Mini Player
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const ratio = dist / pinchStartDistRef.current;
        const newWidth = Math.max(150, Math.min(window.innerWidth - 20, pinchStartScaleRef.current * ratio));
        // Maintain Aspect Ratio 16:9
        const newHeight = newWidth * (9 / 16);
        setMiniSize({ width: newWidth, height: newHeight });
        e.preventDefault(); // Prevent scrolling while resizing
      } else if (e.touches.length === 1 && isMiniDraggingRef.current) {
        handleMiniMouseMove(e.touches[0]);
      }
      return;
    }

    if (e.touches.length === 2 && pinchStartDistRef.current) {
      // Pinch Zoom Move
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / pinchStartDistRef.current;
      const newScale = Math.min(Math.max(pinchStartScaleRef.current * ratio, 1), 5); // Limit scale 1x-5x

      setScale(newScale);
      showFeedback(`${Math.round(newScale * 100)}%`);

      // Auto-reset position if zoomed out to near 1x
      if (newScale <= 1.1) {
        setPosition({ x: 0, y: 0 });
      }

      if (Math.abs(newScale - pinchStartScaleRef.current) > 0.1) {
        hasMovedRef.current = true; // Consider pinch as movement
        ignoreClickRef.current = true;
      }
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (isDragging && scale > 1) {
        hasMovedRef.current = true;
        e.preventDefault();
        const dx = touch.clientX - lastDragRef.current.x;
        const dy = touch.clientY - lastDragRef.current.y;

        setPosition(prev => getClampedPosition(prev.x + dx / scale, prev.y + dy / scale, scale));

        lastDragRef.current = { x: touch.clientX, y: touch.clientY };
      } else if (gestureRef.current.type === 'volume' || gestureRef.current.type === 'brightness') {
        // Active Volume/Brightness Gesture Control
        e.preventDefault();
        hasMovedRef.current = true;
        ignoreClickRef.current = true;

        const deltaY = touch.clientY - gestureRef.current.startY;
        const sensitivity = 0.01;
        const change = deltaY * sensitivity;

        if (gestureRef.current.type === 'volume') {
          const newVal = Math.min(Math.max(gestureRef.current.startVal - change, 0), 1);
          setVolume(newVal);
          showFeedback(
            <div className="flex items-center gap-3">
              {getVolumeIcon(newVal)}
              <span>Volume: {Math.round(newVal * 100)}%</span>
            </div>
          );
        } else if (gestureRef.current.type === 'brightness') {
          const newVal = Math.min(Math.max(gestureRef.current.startVal - change, 0.2), 2.0);
          setBrightness(newVal);
          showFeedback(
            <div className="flex items-center gap-3">
              <FaSun />
              <span>Brightness: {Math.round(newVal * 100)}%</span>
            </div>
          );
        }
      } else if (scale === 1 && !isSpeedingRef.current) {
        // Not long-pressing for speed, so we are either detecting OR swiping
        const dx = touch.clientX - touchStartRef.current.x;
        const dy = touch.clientY - touchStartRef.current.y;
        const dist = Math.abs(dx) + Math.abs(dy);

        if (dist > 10) {
          // Motion detected - Cancel Speed Timeout
          if (speedTimeoutRef.current) {
            clearTimeout(speedTimeoutRef.current);
            speedTimeoutRef.current = null;
          }

          if (!gestureRef.current.type) {
            // Check if Vertical Swipe (Gesture Start)
            if (Math.abs(dy) > Math.abs(dx) * 1.5) { // Vertical dominant
              const width = window.innerWidth;
              const x = touch.clientX;
              let type = null;
              if (x > width * 0.85) type = 'volume';    // Right 15%
              else if (x < width * 0.15) type = 'brightness'; // Left 15%

              if (type) {
                gestureRef.current.type = type;
                gestureRef.current.startY = touch.clientY;
                gestureRef.current.startVal = type === 'volume' ? volume : brightness;
                setActiveGesture(type);
                hasMovedRef.current = true;
                ignoreClickRef.current = true;
              }
            } else if (Math.abs(dx) > 10) {
              // Horizontal major -> Start Swipe
              gestureRef.current.type = 'swipe';
            }
          }

          if (gestureRef.current.type === 'swipe' && !isAnimatingSwipe) {
            setSwipeOffset(dx);
            hasMovedRef.current = true;
          }
        }
      }
    }
  };

  const handleTouchEnd = () => {
    // Reset Pinch
    pinchStartDistRef.current = null;
    if (isMiniMode) {
      handleMiniMouseUp();
      return;
    }

    if (speedTimeoutRef.current) clearTimeout(speedTimeoutRef.current);
    if (isSpeedingRef.current) {
      setPlaybackRate(originalSpeedRef.current);
      isSpeedingRef.current = false;
      showFeedback(`${originalSpeedRef.current}x Speed`);
    }
    if ((isDragging || pinchStartDistRef.current) && hasMovedRef.current) {
      ignoreClickRef.current = true;
    }

    // Swipe Navigation (only if scale 1, not moved as drag)
    if (scale === 1 && touchStartRef.current && (gestureRef.current.type === 'swipe' || !gestureRef.current.type)) {
      if (Math.abs(swipeOffset) > 50) {
        // >0 (Right) -> Prev (-1)
        // <0 (Left) -> Next (1)
        const dir = swipeOffset > 0 ? -1 : 1;

        // Check boundaries
        if ((dir === 1 && currentIndex >= videos.length - 1) || (dir === -1 && currentIndex <= 0)) {
          // Snap back
          setIsAnimatingSwipe(true);
          setSwipeOffset(0);
          setTimeout(() => setIsAnimatingSwipe(false), 300);
        } else {
          changeVideo(dir);
        }
      } else {
        // Snap back
        if (swipeOffset !== 0) {
          setIsAnimatingSwipe(true);
          setSwipeOffset(0);
          setTimeout(() => setIsAnimatingSwipe(false), 300);
        }
      }
    }

    setIsDragging(false);
    setActiveGesture(null);
    touchStartRef.current = null;
    setTimeout(() => { isTouchRef.current = false; }, 500);
  };

  const formatTime = (seconds, isRemaining = false) => {
    if (!seconds && !isRemaining) return "0:00";
    if (isRemaining) {
      const total = duration || videoRef.current?.duration || 0;
      const diff = Math.max(0, total - seconds);
      const mins = Math.floor(diff / 60);
      const secs = Math.floor(diff % 60);
      return `-${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Mini Player Drag Handlers
  const handleMiniMouseDown = (e) => {
    setShowControls(true);
    isMiniDraggingRef.current = true;
    miniDragStartRef.current = { x: e.clientX, y: e.clientY };
    miniStartPosRef.current = { ...miniPosition };
  };

  const handleMiniMouseMove = (e) => {
    setShowControls(true); // Wake up controls on mouse move
    if (!isMiniDraggingRef.current) return;
    const dx = e.clientX - miniDragStartRef.current.x;
    const dy = e.clientY - miniDragStartRef.current.y;

    const newX = miniStartPosRef.current.x + dx;
    const newY = miniStartPosRef.current.y + dy;

    setMiniPosition({ x: newX, y: newY });

    // Check collision with Trash Zone (Bottom Center)
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    // Trash Zone: Approx Bottom 100px, Center 100px width
    // Simple logic: If mouse is in bottom 15% and middle 20% width?
    // Or better: define trash zone rect.

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    // Expand Trash Zone Detection
    // Detect earlier (higher up) to make it feel responsive
    const trashYThreshold = windowHeight - 150; // Activate when within 150px of bottom
    const trashXMin = (windowWidth / 2) - 80; // Widen target area
    const trashXMax = (windowWidth / 2) + 80;

    if (mouseY > trashYThreshold && mouseX > trashXMin && mouseX < trashXMax) {
      if (!isOverTrash) {
        setIsOverTrash(true);
        // Haptic feedback if available (navigator.vibrate)
        if (navigator.vibrate) navigator.vibrate(50);
      }
    } else {
      if (isOverTrash) setIsOverTrash(false);
    }
  };

  const handleMiniMouseUp = () => {
    isMiniDraggingRef.current = false;
    if (isOverTrash) {
      // Trigger Direct Close with Animation Delay
      setIsOverTrash(false); // Start lid closing
      setIsTrashClosing(true); // Keep bin visible

      setTimeout(() => {
        onClose(); // Close player after animation
        setIsTrashClosing(false);
      }, 600); // 600ms delay for transition
    }
  };

  const content = (
    <div
      ref={containerRef}
      style={isMiniMode
        ? {
          position: 'fixed',
          left: `${miniPosition.x}px`,
          top: `${miniPosition.y}px`,
          width: `${miniSize.width}px`,
          height: `${miniSize.height}px`,
          zIndex: 99999,
          cursor: isMiniDraggingRef.current ? 'grabbing' : 'grab'
        }
        : {}
      }
      className={`${isMiniMode
        ? 'rounded-xl shadow-2xl border border-gray-700 overflow-hidden bg-black'
        : 'fixed inset-0 bg-black z-[9999] flex items-center justify-center select-none touch-none'
        } transition-shadow duration-300`}
      onContextMenu={handleContextMenu}
      onMouseMove={isMiniMode ? handleMiniMouseMove : handleMouseMove}
      onMouseUp={isMiniMode ? handleMiniMouseUp : handleMouseUp}
      onMouseDown={isMiniMode ? handleMiniMouseDown : undefined}
      onMouseLeave={isMiniMode ? handleMiniMouseUp : handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* Mini Mode Overlays */}
      {isMiniMode && (
        <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 transition-opacity duration-300 p-2 ${showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <button
            onClick={toggleMiniMode}
            className="mb-2 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full p-2 text-white transition-all transform hover:scale-110 shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <FaWindowRestore size={20} />
          </button>
          <div className="flex gap-2">
            <button
              onClick={togglePlay}
              className="bg-white/10 hover:bg-white/20 p-2 rounded-full text-white"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {isPlaying && !isLoading ? <FaPause size={10} /> : <FaPlay size={10} />}
            </button>
            <button
              onClick={handleCloseRequest}
              className="bg-red-500/80 hover:bg-red-600 p-2 rounded-full text-white"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <FaTimes size={10} />
            </button>
          </div>
        </div>
      )}

      {/* Close Button */}
      {!isMiniMode && !isFullscreen && (
        <button
          onClick={handleCloseRequest}
          className={`absolute top-4 right-4 text-white hover:text-red-400 z-50 bg-black/50 backdrop-blur rounded-full p-3 transition-all duration-300 hover:bg-black/80 hover:scale-110 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
        >
          <FaTimes size={20} />
        </button>
      )}

      {/* Navigation */}
      {!isMiniMode && !isMobile && videos.length > 1 && (
        <>
          {currentIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev - 1); }}
              className={`absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-blue-300 z-40 bg-black/50 backdrop-blur rounded-full p-4 hover:bg-black/80 hover:scale-110 transition-all duration-300 ${showControls ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
            >
              <FaChevronLeft size={24} />
            </button>
          )}
          {currentIndex < videos.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev + 1); }}
              className={`absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-blue-300 z-40 bg-black/50 backdrop-blur rounded-full p-4 hover:bg-black/80 hover:scale-110 transition-all duration-300 ${showControls ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}
            >
              <FaChevronRight size={24} />
            </button>
          )}
        </>
      )}

      {/* Main Viewport */}
      <div
        className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black group"
        onMouseDown={handleMouseDown}
        onClick={handleVideoAreaClick}
      >
        {/* Network Status Bar */}
        <div className="absolute top-4 inset-x-0 z-[70] flex justify-center pointer-events-none px-4">
          {isOffline ? (
            <div className="bg-red-600/90 backdrop-blur-md py-2 px-6 rounded-full flex items-center gap-3 animate-slide-down shadow-2xl border border-white/10 whitespace-nowrap">
              <FaWifi className="text-white text-sm animate-pulse" />
              <span className="text-white text-[10px] sm:text-xs font-bold tracking-widest uppercase">Offline: Check your network</span>
            </div>
          ) : isOnlineRecently ? (
            <div className="bg-green-600/90 backdrop-blur-md py-2 px-6 rounded-full flex items-center gap-3 animate-slide-down shadow-2xl border border-white/10 whitespace-nowrap">
              <FaWifi className="text-white text-sm" />
              <span className="text-white text-[10px] sm:text-xs font-bold tracking-widest uppercase">Back Online</span>
            </div>
          ) : null}
        </div>

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-[60] pointer-events-none">
            <div className="flex flex-col items-center gap-4">
              <div className="bg-black/60 backdrop-blur-md p-6 rounded-full shadow-2xl ring-1 ring-white/10">
                <FaSpinner className="text-white animate-spin text-5xl" />
              </div>
              {showRetryButton && !isManualRetrying && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsManualRetrying(true);
                    setRetryId(id => id + 1);
                  }}
                  className="pointer-events-auto bg-white/10 hover:bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-white/90 text-sm font-semibold transition-all border border-white/5 shadow-xl active:scale-95 animate-fadeIn"
                >
                  Connection slow? Tap to Retry
                </button>
              )}
            </div>
          </div>
        )}

        {/* Big Center Overlay */}
        {!isPlaying && !isLoading && !isMiniMode && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="bg-black/40 backdrop-blur-sm p-6 rounded-full shadow-lg">
              {isEnded ? <FaRedo className="text-white text-4xl opacity-80" /> : <FaPlay className="text-white text-4xl ml-1 opacity-80" />}
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          key={currentIndex}
          src={videoBlobUrl || ""}
          className={`w-full h-full object-contain transition-transform duration-100 ${isDragging ? 'cursor-grabbing' : scale > 1 ? 'cursor-grab' : 'cursor-pointer'}`}
          playsInline
          crossOrigin="anonymous"
          preload="auto"
          autoPlay
          onLoadStart={() => setIsLoading(true)}
          onWaiting={() => setIsLoading(true)}
          onStalled={() => setIsLoading(true)}
          onLoadedData={() => { setIsLoading(false); setIsManualRetrying(false); }}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onCanPlay={() => setIsLoading(false)}
          onPlay={() => setIsPlaying(true)}
          onPlaying={() => { setIsLoading(false); setIsEnded(false); setIsPlaying(true); }}
          onPause={() => setIsPlaying(false)}
          onError={handleVideoError}
          onTimeUpdate={handleTimeUpdate}
          onProgress={handleProgress}
          onEnded={() => {
            if (isLooping && videoRef.current) {
              videoRef.current.currentTime = 0;
              videoRef.current.play().catch(() => { });
            } else {
              setIsPlaying(false);
              setIsEnded(true);
              setShowControls(true);
            }
          }}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            transform: `scale(${scale * autoScale}) rotate(${rotation}deg) translate(${position.x + swipeOffset}px, ${position.y}px)`,
            filter: `brightness(${brightness})`,
            transition: (isDragging || (swipeOffset !== 0 && !isAnimatingSwipe)) ? 'none' : 'transform 0.3s ease-out'
          }}
          draggable={false}
        />

        {/* Feedback Overlays */}
        {seekFeedback && (
          <div className={`absolute ${seekFeedback === 'rewind' ? 'left-10' : 'right-10'} top-1/2 -translate-y-1/2 z-40 flex flex-col items-center justify-center text-white bg-black/50 p-6 rounded-full animate-ping-once backdrop-blur-sm`}>
            <FaUndo className={`text-3xl mb-1 ${seekFeedback === 'forward' ? 'transform scale-x-[-1]' : ''}`} />
            <span className="font-bold text-sm">{seekFeedback === 'rewind' ? '-5s' : '+5s'}</span>
          </div>
        )}

        {/* Center Control Button */}
        {!isMiniMode && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <button
              onClick={(e) => { e.stopPropagation(); togglePlay(e); }}
              className={`pointer-events-auto transform transition-all duration-300 bg-black/60 backdrop-blur-sm p-6 rounded-full text-white hover:scale-110 shadow-2xl ${isLoading ? 'opacity-0 scale-90 pointer-events-none' : (!isPlaying || showControls) ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}
            >
              {isEnded ? <FaRedo className="text-4xl" /> : isPlaying && !isLoading ? <FaPause className="text-4xl" /> : <FaPlay className="text-4xl pl-2" />}
            </button>
          </div>
        )}

        {/* Zoom Indicator */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none transition-opacity duration-300 ${zoomMessage ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-black/70 backdrop-blur-md text-white text-3xl font-bold px-6 py-4 rounded-xl shadow-2xl">
            {zoomMessage}
          </div>
        </div>

        {/* Stats for Nerds Overlay */}
        {showStats && !isMiniMode && (
          <div className="absolute top-4 left-4 z-[60] bg-[#121212]/90 backdrop-blur-md p-3 rounded-md border border-white/5 text-[11px] font-mono text-white/80 pointer-events-auto min-w-[320px] shadow-2xl animate-fadeIn select-text">
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-white/30 tracking-wider">STATS FOR NERDS</span>
              <button
                onClick={() => setShowStats(false)}
                className="hover:bg-white/10 p-1 rounded transition-colors text-white/40 hover:text-white"
              >
                <FaTimes size={10} />
              </button>
            </div>

            <div className="grid grid-cols-[110px_1fr] gap-y-1">
              <span className="text-white/40">Video ID / sCPN</span>
              <span className="text-blue-400 truncate">V-{currentIndex + 1}_URB / {Math.random().toString(36).substr(2, 6).toUpperCase()}..{Math.round(Date.now() / 10000).toString(16)}</span>

              <span className="text-white/40">Viewport / Frames</span>
              <span className="text-green-400">
                {videoRef.current?.offsetWidth}x{videoRef.current?.offsetHeight}*{scale.toFixed(2)} /
                <span className="text-red-400">{videoRef.current?.getVideoPlaybackQuality?.()?.droppedVideoFrames || 0} dropped</span> of {videoRef.current?.getVideoPlaybackQuality?.()?.totalVideoFrames || Math.round(videoRef.current?.currentTime * 30 || 0)}
              </span>

              <span className="text-white/40">Current / Optimal Res</span>
              <span className="text-yellow-400">
                {videoRef.current?.videoWidth}x{videoRef.current?.videoHeight} / {videoRef.current?.videoWidth}x{videoRef.current?.videoHeight}
              </span>

              <span className="text-white/40">Volume / Normalized</span>
              <span className="text-purple-400">{Math.round(volume * 100)}% / {Math.round(volume * 100)}%</span>

              <span className="text-white/40">Codecs</span>
              <span className="text-cyan-400 truncate">
                {videoRef.current?.currentSrc?.includes('vp9') ? 'vp09.00.51' : 'av01.0.05M'} / mp4a.40.2
              </span>

              <div className="h-1" /> <div className="h-1" />

              <span className="text-white/40">Connection Speed</span>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500/50 transition-all duration-1000"
                    style={{ width: `${Math.min((navigator.connection?.downlink || 10) * 10, 100)}%` }}
                  />
                </div>
                <span className="text-blue-400 w-16">{(navigator.connection?.downlink * 1000 || 54200).toFixed(0)} Kbps</span>
              </div>

              <span className="text-white/40">Network Activity</span>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-green-500/50 transition-all duration-300 ${isLoading ? 'w-full animate-pulse' : 'w-0'}`}
                  />
                </div>
                <span className="text-green-400 w-16">{isLoading ? '542 KB' : '0 KB'}</span>
              </div>

              <span className="text-white/40">Buffer Health</span>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500/50 transition-all" style={{ width: `${loadedProgress}%` }} />
                </div>
                <span className="text-orange-400 w-16">{(loadedProgress * (duration || 0) / 100).toFixed(2)} s</span>
              </div>

              <span className="text-white/40">Live Latency</span>
              <span className="text-red-400">0.00s (VOD)</span>

              <span className="text-white/40">Live Mode</span>
              <span className="text-white/90 truncate">VOD-Optimized</span>

              <span className="text-white/40">Mystery Text</span>
              <span className="text-white/90 truncate">SSI IFA, SABR, s:4 t:{Math.round(Date.now() / 10000)} b:{Math.round(loadedProgress)}</span>

              <div className="h-2" /> <div className="h-2" />

              <span className="text-white/40">Date</span>
              <span className="text-white/60 text-[10px] leading-tight">
                {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>
        )}

        {/* About Player Modal */}
        {showAboutPlayer && (
          <div className="absolute inset-0 flex items-center justify-center z-[70] p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
              onClick={() => setShowAboutPlayer(false)}
            />
            <div className="relative w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto animate-scaleIn">
              <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 p-6 flex flex-col items-center">
                <div className="relative group mb-4">
                  <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur opacity-40 group-hover:opacity-60 transition duration-500"></div>
                  <div className="relative w-20 h-20 bg-black rounded-full flex items-center justify-center border border-white/20">
                    <FaPlay className="text-white text-3xl ml-1" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-1">UrbanSetu Native Player</h3>
                <p className="text-blue-400 text-sm font-medium tracking-wide">Version 2.5.0 "Dhurandhar"</p>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <div>
                      <p className="text-white/90 text-sm font-medium">Native Performance</p>
                      <p className="text-white/40 text-xs">Optimized for high-bitrate property tours and cinematic views.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-purple-500" />
                    <div>
                      <p className="text-white/90 text-sm font-medium">Smart Buffering</p>
                      <p className="text-white/40 text-xs">Adaptive quality and offline recovery for seamless playback.</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex flex-col gap-2">
                  <p className="text-white/30 text-[10px] uppercase tracking-widest text-center">Built by VijayCh</p>
                </div>

                <button
                  onClick={() => setShowAboutPlayer(false)}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/90 rounded-xl font-semibold text-sm transition-all active:scale-95 border border-white/5 mt-2"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Context Menu */}
        {contextMenu.show && (
          <div
            ref={contextMenuRef}
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 100000
            }}
            className="w-64 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-2 animate-scaleIn overflow-hidden"
          >
            {!isFullscreen && (
              <div
                className="px-4 py-2.5 hover:bg-white/10 flex items-center gap-3 cursor-pointer transition-colors group"
                onClick={() => { toggleMiniMode(); setContextMenu({ ...contextMenu, show: false }); }}
              >
                <FaClone className="text-sm text-white/60 group-hover:text-white" />
                <span className="text-[13px] text-white/90">Miniplayer</span>
              </div>
            )}

            <div
              className="px-4 py-2.5 hover:bg-white/10 flex items-center gap-3 cursor-pointer transition-colors group"
              onClick={() => { setIsLooping(!isLooping); setContextMenu({ ...contextMenu, show: false }); }}
            >
              <FaInfinity className={`text-sm ${isLooping ? 'text-blue-400' : 'text-white/60 group-hover:text-white'}`} />
              <div className="flex-1 flex justify-between items-center">
                <span className="text-[13px] text-white/90">Loop</span>
                {isLooping && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />}
              </div>
            </div>

            <div className="h-[1px] bg-white/5 my-1" />

            <div
              className="px-4 py-2.5 hover:bg-white/10 flex items-center gap-3 cursor-pointer transition-colors group"
              onClick={() => copyToClipboard(videos[currentIndex], "Video URL copied!")}
            >
              <FaLink className="text-sm text-white/60 group-hover:text-white" />
              <span className="text-[13px] text-white/90">Copy video URL</span>
            </div>

            <div
              className="px-4 py-2.5 hover:bg-white/10 flex items-center gap-3 cursor-pointer transition-colors group"
              onClick={() => {
                const time = Math.floor(videoRef.current?.currentTime || 0);
                copyToClipboard(`${videos[currentIndex]}?t=${time}`, `URL copied at ${time}s!`);
              }}
            >
              <FaHistory className="text-sm text-white/60 group-hover:text-white" />
              <span className="text-[13px] text-white/90">Copy URL at current time</span>
            </div>

            <div
              className="px-4 py-2.5 hover:bg-white/10 flex items-center gap-3 cursor-pointer transition-colors group"
              onClick={() => copyToClipboard(`<iframe src="${videos[currentIndex]}" allowfullscreen></iframe>`, "Embed code copied!")}
            >
              <FaCode className="text-sm text-white/60 group-hover:text-white" />
              <span className="text-[13px] text-white/90">Copy embed code</span>
            </div>

            <div className="h-[1px] bg-white/5 my-1" />

            <div
              className="px-4 py-2.5 hover:bg-white/10 flex items-center gap-3 cursor-pointer transition-colors group"
              onClick={() => copyToClipboard(getDebugInfo(), "Debug info copied!")}
            >
              <FaInfoCircle className="text-sm text-white/60 group-hover:text-white" />
              <span className="text-[13px] text-white/90">Copy debug info</span>
            </div>

            <div
              className="px-4 py-2.5 hover:bg-white/10 flex items-center gap-3 cursor-pointer transition-colors group"
              onClick={() => { window.location.reload(); }}
            >
              <FaTools className="text-sm text-white/60 group-hover:text-white" />
              <span className="text-[13px] text-white/90">Troubleshoot playback</span>
            </div>

            <div
              className="px-4 py-2.5 hover:bg-white/10 flex items-center gap-3 cursor-pointer transition-colors group"
              onClick={() => { setShowStats(!showStats); setContextMenu({ ...contextMenu, show: false }); }}
            >
              <FaChartLine className={`text-sm ${showStats ? 'text-blue-400' : 'text-white/60 group-hover:text-white'}`} />
              <span className="text-[13px] text-white/90">Stats for nerds</span>
            </div>

            <div
              className="px-4 py-2.5 hover:bg-white/10 flex items-center gap-3 cursor-pointer transition-colors group border-t border-white/5 mt-1 pt-3"
              onClick={() => { setShowAboutPlayer(true); setContextMenu({ ...contextMenu, show: false }); }}
            >
              <FaInfoCircle className="text-sm text-white/60 group-hover:text-white" />
              <span className="text-[13px] text-white/90">About Player</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      {!isMiniMode && (
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 to-transparent px-4 pb-4 pt-10 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'}`}
          onMouseEnter={() => setIsBottomControlsHovered(true)}
          onMouseLeave={() => setIsBottomControlsHovered(false)}
        >
          <div className="w-full space-y-3">
            <div
              className="w-full h-1.5 bg-white/30 rounded-full cursor-pointer relative group/slider"
              onMouseMove={(e) => {
                setShowControls(true);
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                const time = pos * (duration || videoRef.current?.duration || 0);
                setPreviewTime(time);
                setPreviewPos(pos * 100); // Store percentage
                setShowPreview(true);
                if (previewVideoRef.current) {
                  previewVideoRef.current.currentTime = time;
                }
              }}
              onMouseLeave={() => setShowPreview(false)}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (rect.width > 0) ? (e.clientX - rect.left) / rect.width : 0;
                if (videoRef.current && isFinite(videoRef.current.duration)) {
                  videoRef.current.currentTime = pos * videoRef.current.duration;
                  setProgress(pos * 100);
                }
              }}
            >
              {/* Preview Thumbnail Overlay */}
              {showPreview && (
                <div
                  className="absolute bottom-8 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-[100] animate-fadeIn"
                  style={{ left: `${previewPos}%` }}
                >
                  <div className="w-40 h-24 sm:w-48 sm:h-28 bg-gray-900 border-[3px] border-white/40 rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.8)] relative">
                    {getThumbnailUrl(videos[currentIndex], previewTime) ? (
                      <img
                        src={getThumbnailUrl(videos[currentIndex], previewTime)}
                        alt="preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        ref={previewVideoRef}
                        src={videoBlobUrl || ""}
                        className="w-full h-full object-cover"
                        muted
                        preload="auto"
                        playsInline
                        crossOrigin="anonymous"
                        onLoadedData={(e) => e.target.currentTime = previewTime}
                      />
                    )}
                    {/* Tiny loading overlay if neither is ready */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  </div>
                  <span className="text-white text-sm font-bold font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,1)] tracking-wider">
                    {formatTime(previewTime)}
                  </span>
                </div>
              )}

              <div className="absolute inset-y-0 left-0 bg-white/40 transition-all" style={{ width: `${loadedProgress}%` }} />
              <div className="absolute inset-y-0 left-0 bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg scale-0 group-hover/slider:scale-100 transition-transform" style={{ left: `${progress}%` }} />
            </div>

            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-4">
                <button onClick={togglePlay} className="hover:text-blue-400 transition-transform active:scale-95">
                  {isPlaying && !isLoading ? <FaPause size={20} /> : <FaPlay size={20} />}
                </button>
                <div
                  className={`flex items-center group/volume-container ${isMobile ? 'relative' : ''}`}
                  onMouseEnter={() => !isMobile && setIsVolumeHovered(true)}
                  onMouseLeave={() => !isMobile && setIsVolumeHovered(false)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isMobile) {
                        setIsVolumeHovered(!isVolumeHovered);
                        // Auto-hide slider after 4 seconds of inactivity
                        if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
                        gestureTimeoutRef.current = setTimeout(() => setIsVolumeHovered(false), 4000);
                      }
                      toggleMute(e);
                    }}
                    className="hover:text-blue-400 p-2"
                  >
                    {isMuted || volume === 0 ? <FaVolumeMute size={20} /> : <FaVolumeUp size={20} />}
                  </button>
                  <div className={`transition-all duration-300 flex items-center gap-2 ${isMobile
                    ? 'absolute bottom-full left-0 mb-4 bg-black/90 backdrop-blur-xl p-3 pr-2 rounded-2xl border border-white/20 shadow-2xl z-50 w-48 justify-between'
                    : `overflow-hidden ml-2 ${isVolumeHovered ? 'w-32 opacity-100' : 'w-0 opacity-0'}`
                    } ${isMobile && isVolumeHovered ? 'opacity-100 scale-100 translate-y-0' : isMobile ? 'opacity-0 scale-95 translate-y-2 pointer-events-none' : ''}`}>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const newVal = parseFloat(e.target.value);
                        setVolume(newVal);
                        setActiveGesture('volume');
                        if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
                        gestureTimeoutRef.current = setTimeout(() => setActiveGesture(null), 1000);

                        // Show center toast feedback with percentage
                        showFeedback(
                          <div className="flex items-center gap-3">
                            {getVolumeIcon(newVal, { size: 24 })}
                            <span>Volume: {Math.round(newVal * 100)}%</span>
                          </div>
                        );
                      }}
                      className="w-28 h-6 appearance-none bg-transparent cursor-pointer transition-all volume-slider-custom"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%)`,
                      }}
                    />
                    {isMobile && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsVolumeHovered(false);
                        }}
                        className="p-1.5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
                        title="Close volume control"
                      >
                        <FaTimes size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <span
                  className="text-[10px] sm:text-xs font-mono opacity-80 select-none cursor-pointer hover:opacity-100 transition-opacity flex items-center gap-1"
                  onClick={() => setShowRemainingTime(!showRemainingTime)}
                  title={showRemainingTime ? "Show elapsed time" : "Show remaining time"}
                >
                  {formatTime(videoRef.current?.currentTime, showRemainingTime)}
                  <span className="opacity-40">/</span>
                  {formatTime(duration || videoRef.current?.duration)}
                </span>
              </div>

              <div className="flex items-center gap-2 sm:gap-4">
                <button onClick={toggleMiniMode} title="Picture in Picture" className="hover:text-blue-400"><FaClone size={18} /></button>
                <button onClick={handleRotate} title="Rotate" className="hover:text-blue-400"><FaUndo size={18} /></button>
                <button onClick={toggleSpeed} title="Playback Speed" className="hover:text-blue-400 flex items-center gap-1 text-sm font-medium min-w-[3em]"><FaTachometerAlt size={14} /> {playbackRate}x</button>
                <button onClick={toggleShare} title="Share" className="hover:text-blue-400"><FaShareAlt size={18} /></button>
                <button onClick={handleDownload} title="Download" className="hover:text-blue-400"><FaDownload size={18} /></button>
                <button onClick={toggleFullscreen} title="Fullscreen" className="hover:text-blue-400">{isFullscreen ? <FaCompress size={20} /> : <FaExpand size={20} />}</button>
              </div>
            </div>
          </div>
        </div>
      )
      }

      {/* Modals & Helpers */}
      {
        isMiniMode && (isMiniDraggingRef.current || isTrashClosing) && (
          <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100000] flex flex-col items-center justify-center transition-all duration-300 ${isOverTrash ? 'scale-125 opacity-100' : 'scale-100 opacity-70'}`}>
            <div className={`p-4 rounded-full transition-colors duration-300 ${isOverTrash ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.7)]' : 'bg-black/60 text-white/70 border-2 border-dashed border-white/30'}`}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="overflow-visible">
                <g className={`transition-transform duration-300 ease-out origin-[21px_6px] ${isOverTrash ? 'rotate-[25deg]' : 'rotate-0'}`}><path d="M3 6h18" /><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></g>
                <path d="M19 6v14c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V6" /><path d="M10 11v6" /><path d="M14 11v6" />
              </svg>
            </div>
            <span className={`mt-2 font-bold text-sm bg-black/50 px-2 py-1 rounded backdrop-blur ${isOverTrash ? 'text-red-500' : 'text-white/70'}`}>
              {isOverTrash ? 'Drop to close' : 'Drag here to close'}
            </span>
          </div>
        )
      }

      {
        !isMiniMode && (
          <>
            <div className={`absolute left-6 top-1/2 -translate-y-1/2 h-48 w-12 bg-black/60 backdrop-blur-md rounded-2xl overflow-hidden flex flex-col justify-end border border-white/10 transition-opacity duration-300 pointer-events-none z-50 ${activeGesture === 'brightness' ? 'opacity-100' : 'opacity-0'}`}>
              <div className="absolute inset-x-0 bottom-0 bg-white transition-all duration-75" style={{ height: `${Math.min(Math.max((brightness - 0.2) / 1.8, 0), 1) * 100}%` }} />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10"><FaSun className="text-blue-500 drop-shadow-md text-xl" /></div>
            </div>
            <div className={`absolute right-6 top-1/2 -translate-y-1/2 h-48 w-12 bg-black/60 backdrop-blur-md rounded-2xl overflow-hidden flex flex-col justify-end border border-white/10 transition-opacity duration-300 pointer-events-none z-50 ${activeGesture === 'volume' ? 'opacity-100' : 'opacity-0'}`}>
              <div className="absolute inset-x-0 bottom-0 bg-white transition-all duration-75" style={{ height: `${volume * 100}%` }} />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10">{getVolumeIcon(volume, { className: "text-blue-500 drop-shadow-md text-xl" })}</div>
            </div>
          </>
        )
      }

      {
        showCloseConfirm && (
          <div className="absolute inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={cancelClose}>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 transform scale-100 transition-all border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Close Video?</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">Are you sure you want to close the video player?</p>
              <div className="flex justify-end gap-3"><button onClick={cancelClose} className="px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium border border-gray-300 dark:border-gray-600">Cancel</button><button onClick={confirmClose} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium shadow-lg shadow-red-500/30">Close</button></div>
            </div>
          </div>
        )
      }

      <SocialSharePanel isOpen={showSharePanel} onClose={() => { setShowSharePanel(false); if (wasPlayingRef.current) setIsPlaying(true); }} url={videos[currentIndex] || ""} title="Check out this video on UrbanSetu!" />
    </div >
  );

  return createPortal(content, document.body);
};

export default VideoPreview;
