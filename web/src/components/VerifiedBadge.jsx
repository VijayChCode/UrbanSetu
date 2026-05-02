import React from 'react';
import { motion } from 'framer-motion';
import { FaCheckCircle, FaCheck } from 'react-icons/fa';

const VerifiedBadge = ({ size = "md", showTooltip = true, className = "" }) => {
    const sizes = {
        xs: { container: "w-4 h-4", icon: "text-[14px]" },
        sm: { container: "w-6 h-6", icon: "text-[18px]" },
        md: { container: "w-8 h-8", icon: "text-[24px]" },
        lg: { container: "w-10 h-10", icon: "text-[32px]" }
    };

    const currentSize = sizes[size] || sizes.md;

    return (
        <div className={`relative group inline-flex items-center justify-center cursor-pointer ${className}`}>
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.15, rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.3 }}
                className={`${currentSize.container} relative flex items-center justify-center`}
            >
                {/* Premium Glow layers */}
                <div className="absolute inset-0 bg-green-500/20 blur-[8px] rounded-full group-hover:bg-green-500/40 transition-colors"></div>
                
                {/* Main Icon - Using a custom layered approach for "Premium" feel */}
                <div className="relative z-10 flex items-center justify-center">
                    {/* Shadow layer */}
                    <FaCheckCircle className={`${currentSize.icon} text-black/10 absolute translate-y-[1px]`} />
                    
                    {/* Background Circle */}
                    <div className="absolute inset-[20%] bg-white rounded-full z-0"></div>
                    
                    {/* The Green Check Circle */}
                    <FaCheckCircle className={`${currentSize.icon} text-green-500 dark:text-green-400 relative z-10 drop-shadow-sm`} />
                </div>

                {/* Outer pulsing ring */}
                <motion.div 
                    className="absolute inset-[-2px] border border-green-500/30 rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
            </motion.div>

            {showTooltip && (
                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-3 py-2 bg-slate-900/95 backdrop-blur-md text-white text-[11px] font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap pointer-events-none z-[100] shadow-2xl border border-white/10 translate-y-2 group-hover:translate-y-0">
                    <div className="flex items-center gap-2">
                        <FaCheckCircle className="text-green-400 text-sm" />
                        Verified Property
                    </div>
                    {/* Tooltip arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-900/95"></div>
                </div>
            )}
        </div>
    );
};

export default VerifiedBadge;
