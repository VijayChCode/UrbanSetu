import React from 'react';

/**
 * UrbanSetu Custom Gradient Spinner
 * A premium, branded loading indicator used throughout the platform.
 * 
 * @param {string} size - 'sm' | 'md' | 'lg' | 'xl'
 * @param {boolean} isBright - Increase visibility for very dark backgrounds
 * @param {string} className - Additional classes for container
 */
const UrbanSetuSpinner = ({ size = 'md', isBright = false, className = '' }) => {
    // Standard sizes
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
            {/* Background Glow for high visibility on dark backgrounds */}
            {isBright && (
                <div className="absolute inset-0 rounded-full bg-blue-500/10 blur-xl animate-pulse"></div>
            )}
            
            {/* Primary Gradient Ring (Fast) */}
            <div 
                className={`absolute inset-0 rounded-full ${currentThickness} border-transparent 
                ${isBright ? 'border-t-blue-400 border-r-purple-400' : 'border-t-blue-500 border-r-purple-500'} 
                animate-spin shadow-[0_0_20px_rgba(59,130,246,0.3)]`}
            ></div>
            
            {/* Secondary Counter-Rotating Ring (Slow) */}
            <div 
                className={`absolute inset-0 rounded-full ${size === 'sm' ? 'border-1' : 'border-2'} 
                border-transparent ${isBright ? 'border-b-purple-300/60 border-l-blue-300/60' : 'border-b-purple-400/50 border-l-blue-400/50'} 
                animate-[spin_1.5s_linear_infinite_reverse] ${isBright ? 'opacity-70' : 'opacity-40'}`}
            ></div>
        </div>
    );
};

export default UrbanSetuSpinner;
