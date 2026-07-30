import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaYoutube, FaPlay, FaVideo, FaTv, FaArrowRight } from 'react-icons/fa';
import VideoPreview from './VideoPreview';

const DEMO_NATIVE_VIDEO_URL = "https://res.cloudinary.com/dytsirhbs/video/upload/v1785425264/urbansetu-chat/videos/khqk89ggefo1evrroron.mp4";

/**
 * DemoVideoModal - Improvised Walkthrough & Demo Video Modal
 * Offers options to play video via YouTube embedded player or UrbanSetu Native Player (VideoPreview).
 */
export default function DemoVideoModal({ isOpen, onClose, videoId }) {
  const currentVideoId = videoId || import.meta.env.VITE_WALKTHROUGH_VIDEO_ID || 'h0Qz5_RTTQY';
  const [playerMode, setPlayerMode] = useState('select'); // 'select' | 'youtube' | 'native'

  // Reset playerMode when modal is opened
  useEffect(() => {
    if (isOpen) {
      setPlayerMode('select');
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

  // If Native Player mode is selected, render VideoPreview directly
  if (playerMode === 'native') {
    return (
      <VideoPreview
        isOpen={true}
        onClose={() => {
          setPlayerMode('select');
          onClose();
        }}
        videos={[DEMO_NATIVE_VIDEO_URL]}
        initialIndex={0}
      />
    );
  }

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
          className={`relative bg-gray-900/95 dark:bg-black/95 rounded-3xl shadow-2xl border border-white/10 w-full ${playerMode === 'select' ? 'max-w-3xl' : 'max-w-5xl'} overflow-hidden glass-card transition-all duration-300`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <h3 className="text-base sm:text-lg font-bold text-white tracking-wide font-sans">
                UrbanSetu Complete Walkthrough Guide
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {playerMode === 'youtube' && (
                <button
                  onClick={() => setPlayerMode('native')}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-500/30 border border-blue-500/30 rounded-xl transition-all flex items-center gap-1.5"
                  title="Switch to UrbanSetu Native Player"
                >
                  <FaVideo className="text-xs" />
                  <span>Switch to Native Player</span>
                </button>
              )}
              {playerMode === 'youtube' && (
                <button
                  onClick={() => setPlayerMode('select')}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all flex items-center gap-1.5"
                  title="Change Player Option"
                >
                  <FaTv className="text-xs" />
                  <span>Options</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all duration-200 focus:outline-none hover:rotate-90"
                aria-label="Close walkthrough"
              >
                <FaTimes className="text-sm" />
              </button>
            </div>
          </div>

          {/* Mode Selection View */}
          {playerMode === 'select' && (
            <div className="p-6 sm:p-8 space-y-6">
              <div className="text-center space-y-2">
                <h4 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Choose Player Experience
                </h4>
                <p className="text-xs sm:text-sm text-gray-400 max-w-md mx-auto">
                  Select your preferred video player to watch the platform walkthrough and feature demonstration.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-2">
                {/* YouTube Player Option Card */}
                <motion.div
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setPlayerMode('youtube')}
                  className="group relative cursor-pointer bg-gradient-to-b from-gray-800/60 to-gray-900/80 hover:from-red-950/30 hover:to-gray-900/90 border border-white/10 hover:border-red-500/50 rounded-2xl p-6 transition-all duration-300 shadow-xl flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-xl bg-red-600/20 border border-red-500/30 text-red-500 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                        <FaYoutube />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                        YouTube
                      </span>
                    </div>

                    <div>
                      <h5 className="text-lg font-bold text-white group-hover:text-red-400 transition-colors">
                        YouTube Player
                      </h5>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        Watch walkthrough video via standard YouTube embedded player with standard web controls.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-red-400 group-hover:text-red-300">
                    <span>Play on YouTube</span>
                    <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>

                {/* UrbanSetu Native Player Option Card */}
                <motion.div
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setPlayerMode('native')}
                  className="group relative cursor-pointer bg-gradient-to-b from-gray-800/60 to-gray-900/80 hover:from-blue-950/40 hover:to-gray-900/90 border border-white/10 hover:border-blue-500/50 rounded-2xl p-6 transition-all duration-300 shadow-xl flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xl shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                        <FaPlay className="ml-0.5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Recommended
                      </span>
                    </div>

                    <div>
                      <h5 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-2">
                        UrbanSetu Native Player
                      </h5>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        Enjoy custom playback speeds, frame rotation, PIP, keyboard shortcuts & advanced controls.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-blue-400 group-hover:text-blue-300">
                    <span>Play in Native Player</span>
                    <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>
              </div>
            </div>
          )}

          {/* YouTube Video Player View */}
          {playerMode === 'youtube' && (
            <div className="relative w-full aspect-video bg-black flex items-center justify-center">
              <iframe
                src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=1&rel=0&modestbranding=1`}
                title="UrbanSetu Walkthrough Video"
                className="absolute inset-0 w-full h-full border-none"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          )}

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
