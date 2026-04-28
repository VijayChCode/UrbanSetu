import React, { useState, useEffect } from 'react';
import { ReactPhotoSphereViewer } from 'react-photo-sphere-viewer';
import { FaTimes, FaExpand, FaCompress, FaInfoCircle, FaMapMarkerAlt, FaArrowsAlt, FaVrCardboard, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import UrbanSetuSpinner from '../UrbanSetuSpinner';

/**
 * ImmersiveTour Component
 * Provides a 360-degree virtual tour experience using Three.js (via react-photo-sphere-viewer).
 */
export default function ImmersiveTour({ isOpen, onClose, tourImages, propertyName }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rotationSpeed, setRotationSpeed] = useState('2rpm');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      // Reset index when opening
      setCurrentImageIndex(0);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  if (!isOpen || !tourImages || tourImages.length === 0) return null;

  const handleNext = () => {
    setLoading(true);
    setCurrentImageIndex((prev) => (prev + 1) % tourImages.length);
  };

  const handlePrev = () => {
    setLoading(true);
    setCurrentImageIndex((prev) => (prev - 1 + tourImages.length) % tourImages.length);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black flex flex-col"
      >
        {/* Header Overlay */}
        <div className="p-4 md:p-6 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/40 to-transparent absolute top-0 left-0 right-0 z-50 pointer-events-none">
          <div className="flex items-center gap-4 pointer-events-auto">
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="p-3 bg-blue-600 rounded-2xl text-white shadow-2xl shadow-blue-500/40 border border-white/10"
            >
              <FaVrCardboard className="text-xl md:text-2xl" />
            </motion.div>
            <div>
              <motion.h2 
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-white font-black text-lg md:text-2xl leading-tight drop-shadow-lg"
              >
                {propertyName}
              </motion.h2>
              <motion.p 
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-blue-300 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2"
              >
                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
                Live 360° Immersive Tour
              </motion.p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 pointer-events-auto">
             <button
              onClick={onClose}
              className="p-3 md:p-4 bg-white/10 hover:bg-red-500/80 backdrop-blur-xl text-white rounded-full transition-all duration-500 border border-white/20 group hover:scale-110 active:scale-90"
              title="Close Tour"
            >
              <FaTimes className="group-hover:rotate-90 transition-transform text-lg" />
            </button>
          </div>
        </div>

        {/* Main 360 Viewer */}
        <div className="flex-1 relative overflow-hidden bg-gray-950">
          <ReactPhotoSphereViewer
            key={currentImageIndex} // Force re-mount on image change for smooth little planet
            src={tourImages[currentImageIndex]}
            height={'100%'}
            width={'100%'}
            onReady={() => {
                setTimeout(() => setLoading(false), 500);
            }}
            littlePlanet={true}
            autoRotate={rotationSpeed}
            mousewheel={true}
            mousemove={true}
            containerClass="immersive-tour-container"
            navbar={[
              'autorotate',
              'zoom',
              'move',
              'download',
              'description',
              'caption',
              'fullscreen',
            ]}
            caption={`Perspective: ${currentImageIndex + 1} of ${tourImages.length} | ${propertyName}`}
          />
          
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 z-40 transition-opacity duration-500">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse"></div>
                <UrbanSetuSpinner size="lg" isBright={true} />
              </div>
              <p className="text-white mt-8 font-black tracking-[0.5em] text-xs animate-pulse uppercase">
                Synchronizing 3D Reality...
              </p>
              <div className="mt-4 w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="h-full bg-blue-500"
                />
              </div>
            </div>
          )}

          {/* Room Navigation Arrows */}
          {!loading && tourImages.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-6 top-1/2 -translate-y-1/2 z-40 p-4 bg-black/30 hover:bg-white/20 backdrop-blur-md text-white rounded-full transition-all border border-white/10 hover:scale-110 active:scale-95 group hidden md:flex"
              >
                <FaChevronLeft className="group-hover:-translate-x-1 transition-transform" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-6 top-1/2 -translate-y-1/2 z-40 p-4 bg-black/30 hover:bg-white/20 backdrop-blur-md text-white rounded-full transition-all border border-white/10 hover:scale-110 active:scale-95 group hidden md:flex"
              >
                <FaChevronRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            </>
          )}

          {/* Interaction Help */}
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none opacity-0 md:group-hover:opacity-100 transition-opacity duration-1000">
            <div className="bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <FaArrowsAlt className="text-blue-400 animate-pulse" />
                <span className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Drag to Look</span>
              </div>
              <div className="w-px h-4 bg-white/20"></div>
              <div className="flex items-center gap-2">
                <FaExpand className="text-blue-400" />
                <span className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Scroll to Zoom</span>
              </div>
            </div>
          </div>
        </div>

        {/* Thumbnail Selector / Progress (Bottom) */}
        <div className="p-6 bg-gradient-to-t from-black via-black/80 to-transparent absolute bottom-0 left-0 right-0 z-50">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4 px-2">
                <span className="text-white/60 text-[10px] font-bold uppercase tracking-[0.2em]">Viewpoint {currentImageIndex + 1} of {tourImages.length}</span>
                <div className="flex gap-1">
                    {tourImages.map((_, i) => (
                        <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === currentImageIndex ? 'w-8 bg-blue-500' : 'w-2 bg-white/20'}`}></div>
                    ))}
                </div>
            </div>
            
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
              {tourImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (currentImageIndex !== idx) {
                        setLoading(true);
                        setCurrentImageIndex(idx);
                    }
                  }}
                  className={`relative flex-shrink-0 w-24 h-16 md:w-32 md:h-20 rounded-xl overflow-hidden border-2 transition-all duration-500 snap-center group ${
                    currentImageIndex === idx 
                        ? 'border-blue-500 scale-105 shadow-lg shadow-blue-500/30' 
                        : 'border-white/10 opacity-50 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`Viewpoint ${idx + 1}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className={`absolute inset-0 bg-blue-600/20 transition-opacity ${currentImageIndex === idx ? 'opacity-100' : 'opacity-0'}`}></div>
                  <div className="absolute inset-x-0 bottom-0 p-1 bg-black/60 backdrop-blur-sm text-[8px] text-white font-bold text-center uppercase">
                    Stop {idx + 1}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Global Styles for the Viewer */}
        <style>{`
          .immersive-tour-container {
            background-color: #030712 !important;
          }
          .psv-navbar {
            background: rgba(0, 0, 0, 0.5) !important;
            backdrop-filter: blur(10px) !important;
            border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
            height: 50px !important;
          }
          .psv-button {
            color: rgba(255, 255, 255, 0.8) !important;
            transition: all 0.3s !important;
          }
          .psv-button:hover {
            color: #3b82f6 !important;
            transform: scale(1.1) !important;
          }
          .psv-caption {
            font-family: inherit !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.1em !important;
            font-size: 10px !important;
            color: #93c5fd !important;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
}
