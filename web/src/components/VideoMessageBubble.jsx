import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaPlay, FaVideo } from 'react-icons/fa';
import UrbanSetuSpinner from './UrbanSetuSpinner';

const VideoMessageBubble = ({ videoUrl, onClick }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const videoRef = useRef(null);

    // Silent reload function when network is restored
    const reloadPreviewSilently = useCallback(() => {
        if (videoRef.current && (hasError || !isLoaded)) {
            // Keep isLoading false so it doesn't show spinner again, but attempt silent load
            try {
                videoRef.current.load();
            } catch (err) {
                console.error("Error reloading video preview:", err);
            }
        }
    }, [hasError, isLoaded]);

    // Handle online status recovery & window focus
    useEffect(() => {
        const handleOnline = () => {
            if (navigator.onLine) {
                reloadPreviewSilently();
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('focus', handleOnline);

        // Silent interval check if stuck in error state while online
        let intervalId = null;
        if (hasError && !isLoaded) {
            intervalId = setInterval(() => {
                if (navigator.onLine) {
                    reloadPreviewSilently();
                }
            }, 8000);
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('focus', handleOnline);
            if (intervalId) clearInterval(intervalId);
        };
    }, [hasError, isLoaded, reloadPreviewSilently]);

    const handleLoadedData = () => {
        setIsLoading(false);
        setHasError(false);
        setIsLoaded(true);
    };

    const handleError = () => {
        setIsLoading(false);
        setHasError(true);
        setIsLoaded(false);
    };

    return (
        <div className="mb-2 relative group max-w-full inline-block">
            <div
                className="relative rounded-lg overflow-hidden bg-black cursor-pointer shadow-md hover:shadow-lg transition-all min-w-[200px] min-h-[150px] flex items-center justify-center"
                onClick={onClick}
            >
                {/* Loading State - only shown on initial load before any error */}
                {isLoading && !hasError && !isLoaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800 text-gray-400 z-10">
                        <UrbanSetuSpinner size="md" className="mb-2" />
                        <span className="text-xs font-medium tracking-wide">Loading Preview...</span>
                    </div>
                )}

                {/* Video Element */}
                <video
                    ref={videoRef}
                    src={videoUrl}
                    className={`max-w-full max-h-64 object-contain transition-opacity duration-500 ${(isLoading && !isLoaded) || hasError ? 'opacity-0 absolute' : 'opacity-90 group-hover:opacity-100'}`}
                    preload="metadata"
                    onLoadedData={handleLoadedData}
                    onCanPlay={handleLoadedData}
                    onError={handleError}
                />

                {/* Overlays (Only show when video loaded successfully) */}
                {isLoaded && !hasError && (
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
