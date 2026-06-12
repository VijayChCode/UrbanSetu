import React from 'react';

/**
 * UrbanSetu Premium High-Contrast Spinner
 * Matches the thick, vibrant, gradient-heavy design from the reference image.
 * 
 * @param {string} size - 'sm' | 'md' | 'lg' | 'xl'
 * @param {boolean} isBright - Standardized bright variant
 * @param {string} className - Additional classes
 */
const UrbanSetuSpinner = ({ size = 'md', isBright = false, text = '', className = '' }) => {
    // REFINED RADII: Significantly reduced based on visual feedback while maintaining high-thickness logic
    const sizeClasses = {
        xs: 'w-4 h-4',
        sm: 'w-5 h-5',
        md: 'w-8 h-8',
        lg: 'w-11 h-11',
        xl: 'w-14 h-14'
    };

    const currentSize = sizeClasses[size] || sizeClasses.md;

    // Define colors for the gradient to match the vibrant image precisely
    const startColor = isBright ? '#60a5fa' : '#3949ab'; 
    const midColor = isBright ? '#a78bfa' : '#7e57c2';   
    const endColor = isBright ? '#f472b6' : '#ec407a';   
    const highlightColor = isBright ? '#ffffff' : '#f06292'; 

    const spinnerElement = (
        <div className={`relative flex items-center justify-center ${currentSize} ${className}`}>
            {/* Soft background glow to match the reference's atmospheric feel */}
            <div className={`absolute inset-0 rounded-full blur-xl animate-pulse 
                ${isBright ? 'bg-blue-300/30' : 'bg-blue-600/10'}`}>
            </div>

            {/* The Main Thick Gradient Spinner Ring (The "Doughnut" look from the image) */}
            <div 
                className="absolute inset-0 rounded-full animate-spin transition-all duration-300 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                style={{
                    background: `conic-gradient(from 0deg, transparent 0%, ${startColor} 30%, ${midColor} 60%, ${endColor} 85%, ${highlightColor} 100%)`,
                    mask: 'radial-gradient(farthest-side, transparent calc(100% - 6px), black calc(100% - 5px))',
                    WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 6px), black calc(100% - 5px))',
                    // Proportional thickness reduction for smaller sizes
                    ...((size === 'xs' || size === 'sm') && { 
                        mask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), black calc(100% - 2px))', 
                        WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), black calc(100% - 2px))' 
                    }),
                    ...(size === 'xl' && { 
                        mask: 'radial-gradient(farthest-side, transparent calc(100% - 7px), black calc(100% - 6px))', 
                        WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 7px), black calc(100% - 6px))' 
                    })
                }}
            ></div>

            {/* Inner highlights to add rotating "glimmers" and depth */}
            <div 
                className="absolute inset-1 rounded-full border-t border-white/10 animate-[spin_3s_linear_infinite]"
            ></div>
        </div>
    );

    if (text) {
        return (
            <div className="flex flex-col items-center justify-center gap-3">
                {spinnerElement}
                <span className={`text-sm font-bold tracking-wide animate-pulse ${isBright ? 'text-slate-300 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
                    {text}
                </span>
            </div>
        );
    }

    return spinnerElement;
};

export default UrbanSetuSpinner;
