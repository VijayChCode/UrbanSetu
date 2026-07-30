import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaImage } from 'react-icons/fa';
import UrbanSetuSpinner from './UrbanSetuSpinner';

const ImageMessageBubble = ({ imageUrl, alt = "Shared image", onClick }) => {
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

    return (
        <div className="mb-2 relative group max-w-full inline-block">
            <div
                className="relative rounded-lg overflow-hidden bg-gray-800/40 dark:bg-gray-900/60 cursor-pointer shadow-md hover:shadow-lg transition-all min-w-[200px] min-h-[140px] flex items-center justify-center border border-white/10"
                onClick={onClick}
            >
                {/* Loading State */}
                {isLoading && !hasError && !isLoaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/80 text-gray-400 z-10 backdrop-blur-xs">
                        <UrbanSetuSpinner size="md" className="mb-2" />
                        <span className="text-xs font-medium tracking-wide">Loading Image...</span>
                    </div>
                )}

                {/* Error State - Silent dark container with image icon, NO flickering external URLs! */}
                {hasError && !isLoaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 text-gray-400 p-4 text-center">
                        <FaImage className="text-2xl mb-1 text-gray-500 opacity-60" />
                        <span className="text-[11px] text-gray-400/80 font-medium">Image Preview Unavailable</span>
                        <span className="text-[9px] text-gray-500 mt-0.5">Will load when online</span>
                    </div>
                )}

                {/* Image Element */}
                {currentSrc && (
                    <img
                        key={currentSrc}
                        src={currentSrc}
                        alt={alt}
                        className={`max-w-full max-h-64 object-contain transition-opacity duration-300 ${isLoaded && !hasError ? 'opacity-100 group-hover:opacity-90' : 'opacity-0 absolute'}`}
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
            </div>
        </div>
    );
};

export default ImageMessageBubble;
