import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaImage, FaVideo, FaPlay } from 'react-icons/fa';
import UrbanSetuSpinner from './UrbanSetuSpinner';
import { getVideoPosterUrl } from './VideoMessageBubble';

export const MediaGalleryImageItem = ({
    imageUrl,
    alt = "Gallery photo",
    senderName = "User",
    timestamp,
    isDeleted = false,
    onClick
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [retryToken, setRetryToken] = useState(0);

    const currentSrc = useMemo(() => {
        if (!imageUrl) return '';
        if (retryToken === 0) return imageUrl;
        return `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}retry=${retryToken}`;
    }, [imageUrl, retryToken]);

    const triggerRetry = useCallback(() => {
        if (navigator.onLine) {
            setRetryToken(prev => prev + 1);
        }
    }, []);

    useEffect(() => {
        const handleOnline = () => {
            if (navigator.onLine && (!isLoaded || hasError)) {
                triggerRetry();
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('focus', handleOnline);

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

    const formattedDate = useMemo(() => {
        if (!timestamp) return '';
        try {
            return new Date(timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch {
            return '';
        }
    }, [timestamp]);

    return (
        <div
            className={`relative group aspect-square rounded-2xl overflow-hidden cursor-pointer bg-gray-100 dark:bg-gray-800 shadow-xs hover:shadow-md transition-all border border-gray-200/60 dark:border-gray-800 ${
                isDeleted ? 'ring-2 ring-red-500/70' : ''
            }`}
            onClick={onClick}
        >
            {/* Loading state */}
            {isLoading && !hasError && !isLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-200/80 dark:bg-gray-800/80 text-gray-400 z-10">
                    <UrbanSetuSpinner size="sm" className="mb-1" />
                    <span className="text-[10px] font-medium">Loading...</span>
                </div>
            )}

            {/* Error state (Offline/Failed) - No external placeholder URL fetch! */}
            {hasError && !isLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 text-gray-300 p-2 text-center z-10">
                    <FaImage className="text-2xl mb-1 text-gray-400 opacity-60" />
                    <span className="text-[10px] text-gray-400 font-medium">Preview Unavailable</span>
                </div>
            )}

            {/* Image Element */}
            {currentSrc && (
                <img
                    key={currentSrc}
                    src={currentSrc}
                    alt={alt}
                    className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-300 ${
                        isLoaded && !hasError ? 'opacity-100' : 'opacity-0 absolute'
                    }`}
                    onLoad={() => {
                        setIsLoaded(true);
                        setIsLoading(false);
                        setHasError(false);
                    }}
                    onError={() => {
                        if (!isLoaded) {
                            setHasError(true);
                            setIsLoading(false);
                        }
                    }}
                />
            )}

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors z-20 pointer-events-none" />

            {/* Deleted badge if applicable */}
            {isDeleted && (
                <div className="absolute top-2 left-2 z-30 pointer-events-none">
                    <span className="text-[9px] px-2 py-0.5 bg-red-600 text-white rounded-full font-bold shadow-xs">
                        Deleted
                    </span>
                </div>
            )}

            {/* Info footer */}
            <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/70 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none">
                <p className="text-white text-[11px] font-medium truncate">{senderName}</p>
                {formattedDate && <p className="text-white/70 text-[9px]">{formattedDate}</p>}
            </div>
        </div>
    );
};

export const MediaGalleryVideoItem = ({
    videoUrl,
    senderName = "User",
    timestamp,
    isDeleted = false,
    onClick
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [retryToken, setRetryToken] = useState(0);

    const basePosterUrl = useMemo(() => getVideoPosterUrl(videoUrl), [videoUrl]);

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

    useEffect(() => {
        const handleOnline = () => {
            if (navigator.onLine && (!isLoaded || hasError)) {
                triggerRetry();
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('focus', handleOnline);

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

    const formattedDate = useMemo(() => {
        if (!timestamp) return '';
        try {
            return new Date(timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch {
            return '';
        }
    }, [timestamp]);

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
        <div
            className={`relative group aspect-square rounded-2xl overflow-hidden cursor-pointer bg-black shadow-xs hover:shadow-md transition-all border border-gray-800 ${
                isDeleted ? 'ring-2 ring-red-500/70' : ''
            }`}
            onClick={onClick}
        >
            {/* Loading state */}
            {isLoading && !hasError && !isLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-gray-400 z-10">
                    <UrbanSetuSpinner size="sm" className="mb-1" />
                    <span className="text-[10px] font-medium">Loading...</span>
                </div>
            )}

            {/* Error state */}
            {hasError && !isLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 text-gray-300 p-2 text-center z-10">
                    <FaVideo className="text-2xl mb-1 text-gray-400 opacity-60" />
                    <span className="text-[10px] text-gray-400 font-medium">Preview Unavailable</span>
                </div>
            )}

            {/* Poster Image or Video Element */}
            {currentPoster ? (
                <img
                    key={currentPoster}
                    src={currentPoster}
                    alt="Video thumbnail"
                    className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-300 ${
                        isLoaded ? 'opacity-80 group-hover:opacity-100' : 'opacity-0 absolute'
                    }`}
                    onLoad={handleSuccess}
                    onError={handleError}
                />
            ) : (
                <video
                    key={currentVideoSrc}
                    src={currentVideoSrc}
                    className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-300 ${
                        isLoaded ? 'opacity-80 group-hover:opacity-100' : 'opacity-0 absolute'
                    }`}
                    preload="metadata"
                    muted
                    playsInline
                    onLoadedData={handleSuccess}
                    onCanPlay={handleSuccess}
                    onError={handleError}
                />
            )}

            {/* Play Icon Overlay */}
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                <div className="bg-black/60 rounded-full p-3 backdrop-blur-md group-hover:scale-110 transition-transform border border-white/20">
                    <FaPlay className="text-white text-sm ml-0.5" />
                </div>
            </div>

            {/* Deleted badge */}
            {isDeleted && (
                <div className="absolute top-2 left-2 z-30 pointer-events-none">
                    <span className="text-[9px] px-2 py-0.5 bg-red-600 text-white rounded-full font-bold shadow-xs">
                        Deleted
                    </span>
                </div>
            )}

            {/* Info footer */}
            <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/70 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none">
                <p className="text-white text-[11px] font-medium truncate">{senderName}</p>
                {formattedDate && <p className="text-white/70 text-[9px]">{formattedDate}</p>}
            </div>
        </div>
    );
};
