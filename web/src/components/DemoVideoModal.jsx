import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';

/**
 * DemoVideoModal - Reusable modal to play the walkthrough/demo video.
 * Props:
 *   - isOpen: boolean to show/hide the modal
 *   - onClose: function to close the modal
 *   - videoId: optional YouTube video ID override
 */
export default function DemoVideoModal({ isOpen, onClose, videoId }) {
  const currentVideoId = videoId || import.meta.env.VITE_WALKTHROUGH_VIDEO_ID || 'h0Qz5_RTTQY';

  // Lock scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-6 md:p-10">
        {/* Backdrop overlay with blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
        />

        {/* Modal container */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative bg-gray-900/90 dark:bg-black/90 rounded-3xl shadow-2xl border border-white/10 w-full max-w-5xl overflow-hidden glass-card"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <h3 className="text-lg font-bold text-white tracking-wide font-sans">
                UrbanSetu Complete Walkthrough Guide
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all duration-200 focus:outline-none hover:rotate-90"
              aria-label="Close walkthrough"
            >
              <FaTimes className="text-sm" />
            </button>
          </div>

          {/* Aspect ratio video player wrapper */}
          <div className="relative w-full aspect-video bg-black flex items-center justify-center">
            <iframe
              src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=1&rel=0&modestbranding=1`}
              title="UrbanSetu Walkthrough Video"
              className="absolute inset-0 w-full h-full border-none"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>

          {/* Footer Info bar */}
          <div className="px-6 py-4 bg-white/5 text-gray-400 text-xs sm:text-sm flex flex-wrap justify-between items-center gap-3">
            <span>Learn how to search and book properties, plan routes, lock rent agreements and more!</span>
            <span className="text-blue-400 font-semibold cursor-pointer hover:underline" onClick={onClose}>
              Get Started Now &rarr;
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
