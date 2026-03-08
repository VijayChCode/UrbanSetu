import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import { useSelector } from 'react-redux';

export default function ThemeDetailModal({ theme, isOpen, onClose }) {
    const { currentUser } = useSelector((state) => state.user);
    if (!isOpen || !theme) return null;

    const userName = currentUser?.firstName || currentUser?.username || currentUser?.name || '';

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
                    <div className={`${theme.textGradient ? theme.textGradient.replace('text-transparent bg-clip-text', '') : 'bg-blue-600'} h-24 flex items-center justify-center relative`}>
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 p-2 bg-black/20 hover:bg-black/30 text-white rounded-full transition-colors"
                        >
                            <FaTimes className="text-sm" />
                        </button>
                        <div className="text-6xl filter drop-shadow-lg">
                            {theme.icon}
                        </div>
                        {theme.secondaryIcon && (
                            <div className="absolute bottom-2 right-4 text-2xl filter drop-shadow opacity-80 decoration-slice">
                                {theme.secondaryIcon}
                            </div>
                        )}
                    </div>

                    <div className="p-6 text-center">
                        <h3 className={`text-2xl font-bold bg-clip-text text-transparent ${theme.textGradient || 'bg-gradient-to-r from-blue-600 to-purple-600'} mb-2`}>
                            {theme.name}
                        </h3>

                        <p className="text-xl text-gray-700 dark:text-gray-200 font-medium mb-4">
                            "{theme.greeting} {userName && <span className="text-blue-600 dark:text-blue-400 break-words">{userName}!</span>}"
                        </p>

                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Current Active Theme
                            </p>
                            <div className="flex justify-center gap-2 mt-2">
                                {['santa-hat', 'party-hat', 'kite', 'flag', 'heart', 'pumpkin', 'colors', 'mango', 'moon', 'bow', 'rakhi', 'modak', 'flower', 'marigold', 'diya', 'snow-cap', 'clover', 'leaf', 'glasses', 'turkey', 'dragon', 'trident', 'mace', 'cross', 'egg', 'lantern', 'chariot', 'flute', 'torch', 'atom', 'lotus', 'book', 'balloon', 'building', 'rocket', 'bonfire', 'peace', 'harvest', 'tie', 'khanda', 'gudi', 'sun', 'venus'].includes(theme.logoDecoration) && (
                                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-md">
                                        Special Effect Active
                                    </span>
                                )}
                            </div>
                        </div>


                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}