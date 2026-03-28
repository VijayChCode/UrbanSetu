import React from 'react';

/**
 * UrbanSetu Custom Gradient Spinner
 * A premium, branded loading indicator used throughout the platform.
 * 
 * @param {string} size - 'sm' | 'md' | 'lg' | 'xl'
 * @param {string} className - Additional classes for container
 */
const UrbanSetuSpinner = ({ size = 'md', className = '' }) => {
    // Reduced Radii: Approximately 20-30% smaller than previous version
    const sizeClasses = {
        sm: 'w-6 h-6',
        md: 'w-10 h-10',
        lg: 'w-12 h-12',
        xl: 'w-16 h-16'
    };

    const ringThickness = {
        sm: 'border-2',
        md: 'border-3',
        lg: 'border-3',
        xl: 'border-4'
    };

    const currentSize = sizeClasses[size] || sizeClasses.md;
    const currentThickness = ringThickness[size] || ringThickness.md;

    return (
        <div className={`relative flex items-center justify-center ${currentSize} ${className}`}>
            {/* Primary Gradient Ring (Fast) */}
            <div className={`absolute inset-1 rounded-full ${currentThickness} border-transparent border-t-blue-500 border-r-purple-500 animate-spin shadow-[0_0_15px_rgba(59,130,246,0.2)]`}></div>
            
            {/* Secondary Counter-Rotating Ring (Slow) */}
            <div className={`absolute inset-1 rounded-full ${size === 'sm' ? 'border-1' : 'border-2'} border-transparent border-b-purple-400/50 border-l-blue-400/50 animate-[spin_1.5s_linear_infinite_reverse] opacity-40`}></div>
        </div>
    );
};

export default UrbanSetuSpinner;
