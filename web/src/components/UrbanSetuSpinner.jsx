import React from 'react';
import { FaVideo } from 'react-icons/fa';

/**
 * UrbanSetu Custom Gradient Spinner
 * A premium, branded loading indicator used throughout the platform.
 * 
 * @param {string} size - 'sm' | 'md' | 'lg' | 'xl'
 * @param {boolean} showIcon - Whether to show the pulsing video icon in center
 * @param {string} className - Additional classes for container
 */
const UrbanSetuSpinner = ({ size = 'md', showIcon = false, className = '' }) => {
    const sizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-12 h-12',
        lg: 'w-16 h-16',
        xl: 'w-20 h-20'
    };

    const ringThickness = {
        sm: 'border-2',
        md: 'border-3',
        lg: 'border-4',
        xl: 'border-4'
    };

    const iconSize = {
        sm: 12,
        md: 18,
        lg: 24,
        xl: 32
    };

    const currentSize = sizeClasses[size] || sizeClasses.md;
    const currentThickness = ringThickness[size] || ringThickness.md;
    const currentIconSize = iconSize[size] || iconSize.md;

    return (
        <div className={`relative flex items-center justify-center ${currentSize} ${className}`}>
            {/* Pulsing Outer Glow (only for large/xl) */}
            {(size === 'lg' || size === 'xl') && (
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-600/10 to-purple-600/10 blur-xl animate-pulse"></div>
            )}
            
            {/* Primary Gradient Ring (Fast) */}
            <div className={`absolute inset-0 rounded-full ${currentThickness} border-transparent border-t-blue-500 border-r-purple-500 animate-spin shadow-[0_0_15px_rgba(59,130,246,0.2)]`}></div>
            
            {/* Secondary Counter-Rotating Ring (Slow) */}
            <div className={`absolute inset-0 rounded-full ${size === 'sm' ? 'border-1' : 'border-2'} border-transparent border-b-purple-400/50 border-l-blue-400/50 animate-[spin_1.5s_linear_infinite_reverse] opacity-40`}></div>
            
            {/* Inner Icon */}
            {showIcon && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <FaVideo className="text-blue-400/30 animate-pulse" size={currentIconSize} />
                </div>
            )}
        </div>
    );
};

export default UrbanSetuSpinner;
