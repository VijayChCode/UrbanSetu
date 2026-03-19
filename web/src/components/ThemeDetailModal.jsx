import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import { useSelector } from 'react-redux';

/**
 * ThemeDetailModal - Supports both single theme and multiple themes.
 * Props:
 *   - theme: single theme object (backward compatible) 
 *   - themes: array of theme objects (multi-festival support)
 *   - isOpen / onClose
 */
export default function ThemeDetailModal({ theme, themes: themesProp, isOpen, onClose }) {
    const { currentUser } = useSelector((state) => state.user);
    
    // Normalize: support both `theme` (single) and `themes` (array) props
    const allThemes = themesProp && themesProp.length > 0
        ? themesProp
        : (theme ? [theme] : []);

    if (!isOpen || allThemes.length === 0) return null;

    const userName = currentUser?.firstName || currentUser?.username || currentUser?.name || '';
    const isMultiple = allThemes.length > 1;
    // Use the first theme's gradient for the header background
    const primaryTheme = allThemes[0];

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal Content */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-white/20 dark:border-gray-700`}
                >
                    {/* Header with Gradient */}
                    <div className={`${primaryTheme.textGradient ? primaryTheme.textGradient.replace('text-transparent bg-clip-text', '') : 'bg-blue-600'} h-24 flex items-center justify-center relative`}>
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 p-2 bg-black/20 hover:bg-black/30 text-white rounded-full transition-colors"
                        >
                            <FaTimes className="text-sm" />
                        </button>
                        <div className="text-6xl filter drop-shadow-lg flex items-center gap-2">
                            {allThemes.map((t, i) => (
                                <span key={t.id || i}>{t.icon}</span>
                            ))}
                        </div>
                        {/* Show secondary icons from all themes */}
                        <div className="absolute bottom-2 right-4 flex items-center gap-1">
                            {allThemes.map((t, i) => t.secondaryIcon && (
                                <span key={`sec-${t.id || i}`} className="text-2xl filter drop-shadow opacity-80">
                                    {t.secondaryIcon}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="p-6 text-center">
                        {/* Final Greeting Calculation */}
                        <h3 className={`text-2xl font-bold bg-clip-text text-transparent ${primaryTheme.textGradient || 'bg-gradient-to-r from-blue-600 to-purple-600'} ${isMultiple ? 'mb-3' : 'mb-2'}`}>
                            {isMultiple 
                                ? (allThemes.length > 2 
                                    ? `${allThemes.slice(0, -1).map(t => t.name).join(', ')} & ${allThemes[allThemes.length - 1].name}`
                                    : allThemes.map(t => t.name).join(' & ')
                                  )
                                : primaryTheme.name}
                        </h3>

                        <p className={`${isMultiple ? 'text-lg' : 'text-xl'} text-gray-700 dark:text-gray-200 font-medium mb-4 flex flex-wrap justify-center items-center`}>
                            "
                            <span className="ml-1">{(primaryTheme?.greeting || "").split(' ')[0]}</span>
                            <span className="flex items-center">
                                {allThemes.length > 1 ? (
                                    allThemes.map((t, idx) => {
                                        const parts = t.greeting.replace(/[.!]$/, '').split(' ');
                                        const festivalName = parts.slice(1).join(' ');
                                        const isLast = idx === allThemes.length - 1;
                                        return (
                                            <span key={idx} className="flex items-center">
                                                <span className="ml-1 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 font-extrabold">
                                                    {festivalName}
                                                </span>
                                                {idx < allThemes.length - 2 ? <span className="mr-1">,</span> : idx === allThemes.length - 2 ? <span className="mx-1">&</span> : isLast ? <span>!</span> : ''}
                                            </span>
                                        );
                                    })
                                ) : (
                                    <span className="flex items-center">
                                        <span className="ml-1 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 font-extrabold">
                                            {primaryTheme.greeting.split(' ').slice(1).join(' ').replace(/[.!]$/, '')}
                                        </span>
                                        <span>!</span>
                                    </span>
                                )}
                            </span>
                            {userName && (
                                <span className="ml-1.5 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 font-extrabold break-words">
                                    {userName}!
                                </span>
                            )}
                            "
                        </p>

                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed italic border-t border-gray-100 dark:border-gray-700 pt-4">
                            On this {allThemes.length > 2 ? 'wonderful day of multiple celebrations' : (isMultiple ? 'wonderful day of double celebration' : 'auspicious occasion')} of <strong>{isMultiple 
                                ? (allThemes.length > 2 
                                    ? `${allThemes.slice(0, -1).map(t => t.name).join(', ')} & ${allThemes[allThemes.length - 1].name}`
                                    : allThemes.map(t => t.name).join(' & ')
                                  )
                                : primaryTheme.name}</strong>, everyone at UrbanSetu wishes you happiness, prosperity, and the warmth of home.
                        </p>

                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-2 shadow-inner">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-2">
                                {isMultiple ? 'Active Festivals Today' : 'Current Active Theme'}
                            </p>
                            <div className="flex flex-wrap justify-center gap-2">
                                {allThemes.map((t, i) => (
                                    ['santa-hat', 'party-hat', 'kite', 'flag', 'heart', 'pumpkin', 'colors', 'mango', 'moon', 'bow', 'rakhi', 'modak', 'flower', 'marigold', 'diya', 'snow-cap', 'clover', 'leaf', 'glasses', 'turkey', 'dragon', 'trident', 'mace', 'cross', 'egg', 'lantern', 'chariot', 'flute', 'torch', 'atom', 'lotus', 'book', 'balloon', 'building', 'rocket', 'bonfire', 'peace', 'harvest', 'tie', 'khanda', 'gudi', 'sun', 'venus'].includes(t.logoDecoration) && (
                                        <span key={t.id || i} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 px-3 py-1.5 rounded-full font-bold">
                                            {isMultiple ? `${t.icon} ${t.name} Effect` : 'Special Effect Active'}
                                        </span>
                                    )
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}