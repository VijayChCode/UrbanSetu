import React from 'react';
import { motion } from 'framer-motion';
import { FaCheck, FaShieldAlt } from 'react-icons/fa';

const VerifiedBadge = ({ size = "md", showTooltip = true, className = "" }) => {
    const sizes = {
        xs: { container: "w-4 h-4", shield: "text-[10px]", check: "text-[5px]", offset: "mt-[1px]" },
        sm: { container: "w-6 h-6", shield: "text-[14px]", check: "text-[7px]", offset: "mt-[1px]" },
        md: { container: "w-8 h-8", shield: "text-[18px]", check: "text-[9px]", offset: "mt-[1.5px]" },
        lg: { container: "w-10 h-10", shield: "text-[24px]", check: "text-[12px]", offset: "mt-[2px]" }
    };

    const currentSize = sizes[size] || sizes.md;

    return (
        <div className={`relative group inline-flex items-center justify-center cursor-pointer ${className}`}>
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.1, rotate: 5 }}
                className={`${currentSize.container} relative flex items-center justify-center`}
            >
                {/* Multi-layered Glow */}
                <div className="absolute inset-0 bg-green-500/20 blur-[6px] rounded-full animate-pulse"></div>
                <div className="absolute inset-0 bg-green-400/10 blur-[2px] rounded-full"></div>
                
                {/* Shield Background with Gradient effect using CSS filter */}
                <FaShieldAlt 
                    className={`${currentSize.shield} text-green-600 dark:text-green-400 relative z-10 filter drop-shadow(0 2px 3px rgba(0,0,0,0.3))`} 
                />
                
                {/* Checkmark */}
                <FaCheck className={`absolute ${currentSize.check} ${currentSize.offset} text-white z-20 font-black`} />
                
                {/* Rotating accent ring */}
                <svg className="absolute inset-0 w-full h-full rotate-[-90deg] opacity-40">
                    <circle
                        cx="50%"
                        cy="50%"
                        r="45%"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                        className="text-green-500"
                    >
                        <animateTransform
                            attributeName="transform"
                            type="rotate"
                            from="0 0 0"
                            to="360 0 0"
                            dur="10s"
                            repeatCount="indefinite"
                        />
                    </circle>
                </svg>
            </motion.div>

            {showTooltip && (
                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-2 py-1.5 bg-gray-900/95 backdrop-blur-md text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap pointer-events-none z-[100] shadow-xl border border-white/10 translate-y-2 group-hover:translate-y-0">
                    <div className="flex items-center gap-1.5">
                        <FaShieldAlt className="text-green-400" />
                        Verified Property
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-gray-900/95"></div>
                </div>
            )}
        </div>
    );
};

export default VerifiedBadge;
