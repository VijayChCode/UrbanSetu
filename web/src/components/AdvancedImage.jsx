import React, { useState, useEffect } from 'react';

/**
 * AdvancedImage Component
 * Implements premium progressive loading (blur-up effect),
 * fallback handling, and optimized Cloudinary transforms.
 */
export default function AdvancedImage({ src, alt, className, ...props }) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);

    // Generate a low-quality placeholder URL if it's Cloudinary
    const getLqipUrl = (url) => {
        if (url?.includes('cloudinary.com')) {
            return url.replace('/upload/', '/upload/c_scale,w_40,q_auto:eco/e_blur:1000/');
        }
        // Generic fallback placeholder
        return 'https://via.placeholder.com/40x25?text=...';
    };

    const getOptimizedUrl = (url) => {
        if (url?.includes('cloudinary.com')) {
            return url.replace('/upload/', '/upload/q_auto:best,f_auto/');
        }
        return url;
    };

    return (
        <div className={`relative overflow-hidden ${className}`}>
            {/* Blurry Placeholder */}
            {!isLoaded && !error && (
                <img
                    src={getLqipUrl(src)}
                    alt={alt}
                    className={`${className} filter blur-xl scale-110 absolute inset-0 transition-opacity duration-500`}
                />
            )}

            {/* Main High-Res Image */}
            <img
                src={error ? 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=60' : getOptimizedUrl(src)}
                alt={alt}
                className={`${className} transition-opacity duration-700 ease-in-out ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setIsLoaded(true)}
                onError={() => setError(true)}
                {...props}
            />
        </div>
    );
}
