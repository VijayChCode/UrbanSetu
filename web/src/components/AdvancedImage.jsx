import React, { useState, useEffect } from 'react';
import { FaImage } from 'react-icons/fa';

/**
 * AdvancedImage Component
 * Implements premium progressive loading (blur-up effect),
 * fallback handling, and optimized Cloudinary transforms.
 */
export default function AdvancedImage({ src, alt, className, ...props }) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);

    // Reset state when src changes
    useEffect(() => {
        setIsLoaded(false);
        setError(false);
    }, [src]);

    // Generate a low-quality placeholder URL if it's Cloudinary
    const getLqipUrl = (url) => {
        if (!url) return '';
        if (url.includes('cloudinary.com')) {
            return url.replace('/upload/', '/upload/c_scale,w_40,q_auto:eco/e_blur:1000/');
        }
        // Generic fallback placeholder
        return 'https://via.placeholder.com/40x25?text=...';
    };

    const getOptimizedUrl = (url) => {
        if (!url) return '';
        if (url.includes('cloudinary.com')) {
            return url.replace('/upload/', '/upload/q_auto:best,f_auto/');
        }
        return url;
    };

    if (!src || error) {
        return (
            <div className={`flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 gap-2 ${className}`}>
                <FaImage className="text-3xl opacity-50" />
                <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider">Image Not Available</span>
            </div>
        );
    }

    return (
        <div className={`relative overflow-hidden ${className}`}>
            {/* Blurry Placeholder */}
            {!isLoaded && (
                <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <img
                        src={getLqipUrl(src)}
                        alt={alt}
                        className={`${className} filter blur-xl scale-110 absolute inset-0 transition-opacity duration-500`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin opacity-50"></div>
                    </div>
                </div>
            )}

            {/* Main High-Res Image */}
            <img
                src={getOptimizedUrl(src)}
                alt={alt}
                className={`${className} transition-all duration-700 ease-in-out ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
                onLoad={() => setIsLoaded(true)}
                onError={() => setError(true)}
                {...props}
            />
        </div>
    );
}
