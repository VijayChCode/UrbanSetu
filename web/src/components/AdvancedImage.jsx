import React, { useState } from 'react';
import UrbanSetuSpinner from './UrbanSetuSpinner';

const AdvancedImage = ({ src, alt, className, ...props }) => {
    // Robust check for missing or empty source
    const isSourceEmpty = !src || (Array.isArray(src) && src.length === 0) || (typeof src === 'string' && src.trim() === '');
    
    const [isLoading, setIsLoading] = useState(!isSourceEmpty);
    const [hasError, setHasError] = useState(isSourceEmpty);

    React.useEffect(() => {
        const sourceEmpty = !src || (Array.isArray(src) && src.length === 0) || (typeof src === 'string' && src.trim() === '');
        setIsLoading(!sourceEmpty);
        setHasError(sourceEmpty);
    }, [src]);

    const handleLoad = () => {
        setIsLoading(false);
    };

    const handleError = () => {
        setIsLoading(false);
        setHasError(true);
    };

    return (
        <div className={`relative overflow-hidden ${className}`}>
            {isLoading && !hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100/10 dark:bg-gray-800/10 backdrop-blur-sm">
                    <UrbanSetuSpinner size="md" isBright={true} />
                </div>
            )}

            {hasError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 p-4 text-center transition-colors duration-300">
                    <div className="text-4xl sm:text-5xl mb-3 opacity-60 grayscale-[0.2]">🏠</div>
                    <span className="text-[10px] sm:text-xs font-bold opacity-60 uppercase tracking-[0.2em] px-2 py-1 border border-current rounded-md">Image not available</span>
                </div>
            ) : (
                <img
                    src={src}
                    alt={alt}
                    onLoad={handleLoad}
                    onError={handleError}
                    className={`w-full h-full object-cover transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                    {...props}
                />
            )}
        </div>
    );
};

export default AdvancedImage;
