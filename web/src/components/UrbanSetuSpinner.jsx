import React from 'react';

/**
 * UrbanSetu Premium High-Contrast Spinner
 * Matches the thick, vibrant, gradient-heavy design from the reference image.
 * 
 * @param {string} size - 'sm' | 'md' | 'lg' | 'xl'
 * @param {boolean} isBright - Standardized bright variant
 * @param {string} className - Additional classes
 */
const UrbanSetuSpinner = ({ size = 'md', isBright = false, className = '' }) => {
    // Proportional dimensions for the high-thickness design
    const sizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-12 h-12',
        lg: 'w-16 h-16',
        xl: 'w-24 h-24'
    };

    const currentSize = sizeClasses[size] || sizeClasses.md;

    // Define colors for the gradient to match the vibrant image precisely
    const startColor = isBright ? '#60a5fa' : '#3949ab'; // Soft/Light Blue vs Deep Blue
    const midColor = isBright ? '#a78bfa' : '#7e57c2';   // Light purple vs Indigo-Purple
    const endColor = isBright ? '#f472b6' : '#ec407a';   // Vibrant Pink
    const highlightColor = isBright ? '#ffffff' : '#f06292'; // White-Pink highlight for the tip

    return (
        <div className={`relative flex items-center justify-center ${currentSize} ${className}`}>
            {/* Soft background glow to match the reference's atmospheric feel */}
            <div className={`absolute inset-0 rounded-full blur-2xl animate-pulse 
                ${isBright ? 'bg-blue-300/30' : 'bg-blue-600/10'}`}>
            </div>

            {/* The Main Thick Gradient Spinner Ring (The "Doughnut" look from the image) */}
            <div 
                className="absolute inset-0 rounded-full animate-spin transition-all duration-300 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                style={{
                    background: `conic-gradient(from 0deg, transparent 0%, ${startColor} 30%, ${midColor} 60%, ${endColor} 85%, ${highlightColor} 100%)`,
                    mask: 'radial-gradient(farthest-side, transparent calc(100% - 8px), black calc(100% - 7px))',
                    WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 8px), black calc(100% - 7px))',
                    // Size-specific thickness (Xpx subtraction = border thickness)
                    ...(size === 'sm' && { 
                        mask: 'radial-gradient(farthest-side, transparent calc(100% - 5px), black calc(100% - 4px))', 
                        WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 5px), black calc(100% - 4px))' 
                    }),
                    ...(size === 'xl' && { 
                        mask: 'radial-gradient(farthest-side, transparent calc(100% - 15px), black calc(100% - 14px))', 
                        WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 15px), black calc(100% - 14px))' 
                    })
                }}
            ></div>

            {/* Inner highlights to add rotating "glimmers" and depth */}
            <div 
                className="absolute inset-2 rounded-full border-t-2 border-white/10 animate-[spin_3s_linear_infinite]"
            ></div>
            <div 
                className={`absolute inset-0 rounded-full border-b-[1px] border-transparent border-b-white/5 animate-pulse`}
            ></div>
        </div>
    );
};

export default UrbanSetuSpinner;
