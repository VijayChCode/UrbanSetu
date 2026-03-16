import React, { useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';

const AdvancedImage = ({ src, alt, className, ...props }) => {
    const [isLoading, setIsLoading] = useState(!!src);
    const [hasError, setHasError] = useState(!src);

    React.useEffect(() => {
        setIsLoading(!!src);
        setHasError(!src);
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
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 animate-pulse">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin opacity-40" />
                </div>
            )}

            {hasError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 p-4 text-center">
                    <ImageOff className="w-10 h-10 mb-2 opacity-30" />
                    <span className="text-sm font-bold opacity-60 uppercase tracking-wider">Image not available</span>
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
