import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FaPlay, FaVideo } from 'react-icons/fa';
import UrbanSetuSpinner from './UrbanSetuSpinner';

// Helper to construct a static Cloudinary poster image thumbnail URL (first frame, auto-format jpg)
export const getVideoPosterUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    if (url.includes('cloudinary.com')) {
        let poster = url;
        if (poster.includes('/upload/')) {
            poster = poster.replace('/upload/', '/upload/f_jpg,q_auto,so_0/');
        }
        // Replace video extension with .jpg
        poster = poster.replace(/\.(mp4|mov|webm|avi|mkv|flv|wmv|m4v)(\?.*)?$/i, '.jpg$2');
        if (!poster.endsWith('.jpg') && !poster.includes('.jpg?')) {
            const parts = poster.split('?');
            poster = parts[0] + '.jpg' + (parts[1] ? '?' + parts[1] : '');
        }
        return poster;
    }
    return '';
};

const VideoMessageBubble = ({ videoUrl, onClick }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [retryToken, setRetryToken] = useState(0);

    const basePosterUrl = useMemo(() => getVideoPosterUrl(videoUrl), [videoUrl]);

    // Derived active URLs with cache-busting token on retry
    const currentPoster = useMemo(() => {
        if (!basePosterUrl) return '';
        if (retryToken === 0) return basePosterUrl;
        return `${basePosterUrl}${basePosterUrl.includes('?') ? '&' : '?'}retry=${retryToken}`;
    }, [basePosterUrl, retryToken]);

    const currentVideoSrc = useMemo(() => {
        if (!videoUrl) return '';
        if (retryToken === 0) return videoUrl;
        return `${videoUrl}${videoUrl.includes('?') ? '&' : '?'}retry=${retryToken}`;
    }, [videoUrl, retryToken]);

    const triggerRetry = useCallback(() => {
        if (navigator.onLine) {
            setRetryToken(prev => prev + 1);
        }
    }, []);

    // Listen for online status, window focus, and periodic check when stuck in error state
    useEffect(() => {
        const handleOnline = () => {
            if (navigator.onLine && (!isLoaded || hasError)) {
                triggerRetry();
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('focus', handleOnline);

        // Silent interval retry check every 5 seconds if not loaded
        const intervalId = setInterval(() => {
            if (navigator.onLine && (!isLoaded || hasError)) {
                triggerRetry();
            }
        }, 5000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('focus', handleOnline);
            clearInterval(intervalId);
        };
    }, [isLoaded, hasError, triggerRetry]);

    const handleSuccess = () => {
        setIsLoaded(true);
        setIsLoading(false);
        setHasError(false);
    };

    const handleError = () => {
        if (!isLoaded) {
            setHasError(true);
            setIsLoading(false);
        }
    };

    return (
        <div className="mb-2 relative group max-w-full inline-block">
            <div
                className="relative rounded-lg overflow-hidden bg-black cursor-pointer shadow-md hover:shadow-lg transition-all min-w-[200px] min-h-[150px] flex items-center justify-center"
                onClick={onClick}
            >
                {/* Loading State - shown only on initial load before any error */}
                {isLoading && !hasError && !isLoaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800 text-gray-400 z-10">
                        <UrbanSetuSpinner size="md" className="mb-2" />
                        <span className="text-xs font-medium tracking-wide">Loading Preview...</span>
                    </div>
                )}

                {/* Error State */}
                {hasError && !isLoaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 text-gray-400 p-4 text-center z-10">
                        <FaVideo className="text-2xl mb-1 text-gray-500 opacity-60" />
                        <span className="text-[11px] text-gray-400/80 font-medium">Video Preview Unavailable</span>
                    </div>
                )}

                {/* Poster Image (Fast Cloudinary Thumbnail Image) */}
                {currentPoster && (
                    <img
                        src={currentPoster}
                        alt="Video thumbnail preview"
                        className={`max-w-full max-h-64 object-contain transition-opacity duration-500 ${isLoaded ? 'opacity-90 group-hover:opacity-100' : 'opacity-0 absolute'}`}
                        onLoad={handleSuccess}
                        onError={handleError}
                    />
                )}

                {/* Video Element (Used if no poster URL or as video frame fallback) */}
                <video
                    key={currentVideoSrc}
                    src={currentVideoSrc}
                    className={`max-w-full max-h-64 object-contain transition-opacity duration-500 ${isLoaded && !currentPoster ? 'opacity-90 group-hover:opacity-100' : 'opacity-0 absolute'}`}
                    preload="metadata"
                    muted
                    playsInline
                    onLoadedData={handleSuccess}
                    onCanPlay={handleSuccess}
                    onError={handleError}
                />

                {/* Overlays (Play Icon & Video Badge - Shown whenever loaded) */}
                {isLoaded && (
                    <>
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                            <div className="bg-black/60 rounded-full p-3 backdrop-blur-sm transform group-hover:scale-110 transition-transform shadow-xl border border-white/10">
                                <FaPlay className="text-white text-xl ml-1" />
                            </div>
                        </div>
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-md backdrop-blur-sm flex items-center gap-1 font-medium border border-white/10">
                            <FaVideo className="text-[10px]" /> Video
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default VideoMessageBubble;
