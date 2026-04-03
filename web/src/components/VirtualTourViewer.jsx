import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FaCompass, FaExpand, FaCompress, FaSearchPlus, FaSearchMinus, FaPlay, FaPause, FaTimes, FaRedo, FaMagic } from 'react-icons/fa';
import UrbanSetuSpinner from './UrbanSetuSpinner';

const VirtualTourViewer = ({ imageUrl, autoLoad = true, className = "" }) => {
    const viewerRef = useRef(null);
    const pannellumViewer = useRef(null); // Keep track of the viewer instance
    const [isLoaded, setIsLoaded] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
    const [isAutoRotating, setIsAutoRotating] = useState(false);

    const [showControls, setShowControls] = useState(true);
    const [isEnhanced, setIsEnhanced] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const controlsTimeoutRef = useRef(null);

    // Auto-hide controls function
    const resetControlsTimeout = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
            if (!isAutoRotating) { // Optional: Keep controls hidden during auto-rotate? Or maybe hide after timeout regardless?
                setShowControls(false);
            }
        }, 3000); // Hide after 3 seconds of inactivity
    }, [isAutoRotating]);

    useEffect(() => {
        // Dynamically load Pannellum script and CSS if not already loaded
        const loadPannellum = () => {
            return new Promise((resolve, reject) => {
                if (window.pannellum) {
                    resolve();
                    return;
                }

                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js';
                script.async = true;

                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css';

                script.onload = () => resolve();
                script.onerror = () => reject(new Error('Failed to load Pannellum'));

                document.head.appendChild(link);
                document.head.appendChild(script);
            });
        };

        loadPannellum().then(() => {
            setIsLoaded(true);
        }).catch(err => console.error(err));

        return () => {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (isLoaded && viewerRef.current && window.pannellum) {
            // Initialize viewer
            pannellumViewer.current = window.pannellum.viewer(viewerRef.current, {
                type: 'equirectangular',
                panorama: imageUrl,
                autoLoad: autoLoad,
                compass: false, // We use custom UI
                showControls: false, // We build custom overlay controls
                mouseZoom: true,
                pitch: 10,
                yaw: 180,
                hfov: 110,
                autoRotate: isAutoRotating ? -2 : 0,
            });

            // Add event listeners for interaction to show controls
            const container = viewerRef.current;
            const handleInteraction = () => resetControlsTimeout();

            container.addEventListener('mousedown', handleInteraction);
            container.addEventListener('mousemove', handleInteraction);
            container.addEventListener('touchstart', handleInteraction);
            container.addEventListener('click', handleInteraction);

            // Initial timeout start
            resetControlsTimeout();

            return () => {
                // Cleanup listeners
                container.removeEventListener('mousedown', handleInteraction);
                container.removeEventListener('mousemove', handleInteraction);
                container.removeEventListener('touchstart', handleInteraction);
                container.removeEventListener('click', handleInteraction);

                // Note: Pannellum destroy might be tricky, usually just clearing innerHTML or letting React unmount handles it roughly
                // But properly:
                // if (pannellumViewer.current && pannellumViewer.current.destroy) {
                //    pannellumViewer.current.destroy();
                // }
            };
        }
    }, [isLoaded, imageUrl, autoLoad]); // Re-init if imageUrl changes

    // Update auto-rotate when state changes
    useEffect(() => {
        if (pannellumViewer.current) {
            if (isAutoRotating) {
                pannellumViewer.current.startAutoRotate(-5); // Rotate speed
            } else {
                pannellumViewer.current.stopAutoRotate();
            }
        }
    }, [isAutoRotating]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
        };
    }, []);

    const toggleFullscreen = () => {
        if (!viewerRef.current) return;

        if (!document.fullscreenElement) {
            viewerRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    const handleZoomIn = () => {
        if (pannellumViewer.current) {
            pannellumViewer.current.setHfov(pannellumViewer.current.getHfov() - 10);
            resetControlsTimeout();
        }
    };

    const handleZoomOut = () => {
        if (pannellumViewer.current) {
            pannellumViewer.current.setHfov(pannellumViewer.current.getHfov() + 10);
            resetControlsTimeout();
        }
    };

    const handleReset = () => {
        if (pannellumViewer.current) {
            pannellumViewer.current.setPitch(10);
            pannellumViewer.current.setYaw(180);
            pannellumViewer.current.setHfov(110);
            setIsAutoRotating(false);
            resetControlsTimeout();
        }
    };

    const handleClose = (e) => {
        e.stopPropagation();
        if (isFullscreen) {
            toggleFullscreen();
        } else {
            // If not fullscreen, typically "Closing" might simply mean stopping auto-load or similar, 
            // but here we can treat it as 'Reset View' or just hiding controls instantly.
            // Or if the user meant 'Close' as in 'Remove from view', that's controlled by parent.
            // We'll treat it as 'Reset' for inline mode to be safe and useful.
            handleReset();
        }
    };

    return (
        <div
            className={`relative w-full h-full bg-gray-900 rounded-xl overflow-hidden shadow-2xl group ${className}`}
            onMouseEnter={resetControlsTimeout}
            onMouseMove={resetControlsTimeout}
            onTouchStart={resetControlsTimeout}
        >
            {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center text-white z-0">
                    <UrbanSetuSpinner size="lg" isBright={true} />
                </div>
            )}

            {/* Viewer Container */}
            <div
                ref={viewerRef}
                className="w-full h-full transition-all duration-700"
                style={{
                    width: '100%',
                    height: '100%',
                    filter: isEnhanced ? 'url(#ai-sharpen) contrast(1.15) saturate(1.15) brightness(1.05)' : 'none'
                }}
            ></div>

            {/* Interaction Hint (Only shows initially or when hovering very still) */}
            <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-1000 ${showControls && !isAutoRotating ? 'opacity-100' : 'opacity-0'}`}>
                <div className="bg-black/30 text-white px-4 py-2 rounded-full backdrop-blur-[2px] border border-white/10 text-center animate-pulse">
                    <p className="text-xs font-medium tracking-wider uppercase">Drag to Explore</p>
                </div>
            </div>

            {/* Top Right Controls (Close/Exit) */}
            <div className={`absolute top-4 right-4 flex flex-col gap-2 transition-all duration-500 transform ${showControls ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}>
                <button
                    onClick={handleClose}
                    className="bg-black/40 hover:bg-indigo-600/80 backdrop-blur-md p-2.5 rounded-full text-white transition-all shadow-lg hover:rotate-180 active:scale-95"
                    aria-label="Reset View"
                    title={isFullscreen ? "Exit Fullscreen" : "Reset View"}
                >
                    <FaRedo size={14} />
                </button>
            </div>

            {/* Hidden SVG Filter for AI Sharpening */}
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <defs>
                    <filter id="ai-sharpen">
                        {/* Matrix for mild sharpening */}
                        <feConvolveMatrix order="3" kernelMatrix="0 -0.5 0 -0.5 3 -0.5 0 -0.5 0" preserveAlpha="true" />
                    </filter>
                </defs>
            </svg>

            {/* Bottom Controls Bar */}
            <div className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 transition-all duration-500 ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className="bg-black/60 backdrop-blur-md rounded-2xl p-2 flex items-center gap-1 shadow-2xl border border-white/10">

                    {/* AI Enhance Button */}
                    {/* AI Enhance Button */}
                    <button
                        onClick={() => {
                            resetControlsTimeout();
                            if (isEnhanced) {
                                setIsEnhanced(false);
                            } else {
                                setIsEnhancing(true);
                                setTimeout(() => {
                                    setIsEnhancing(false);
                                    setIsEnhanced(true);
                                }, 2000);
                            }
                        }}
                        className={`p-2.5 rounded-xl transition-all ${isEnhanced ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/50' : 'text-white/80 hover:bg-white/10'}`}
                        title={isEnhanced ? "Disable AI Enhancer" : "Enable AI Enhancer"}
                        disabled={isEnhancing}
                    >
                        <FaMagic size={14} className={isEnhanced ? "animate-pulse" : isEnhancing ? "animate-spin" : ""} />
                    </button>

                    <div className="w-px h-6 bg-white/20 mx-1"></div>

                    {/* Auto Rotate */}
                    <button
                        onClick={() => { setIsAutoRotating(!isAutoRotating); resetControlsTimeout(); }}
                        className={`p-2.5 rounded-xl transition-all ${isAutoRotating ? 'bg-indigo-600 text-white' : 'text-white/80 hover:bg-white/10'}`}
                        title={isAutoRotating ? "Pause Rotation" : "Auto Rotate"}
                    >
                        {isAutoRotating ? <FaPause size={14} /> : <FaPlay size={14} className="ml-0.5" />}
                    </button>

                    <div className="w-px h-6 bg-white/20 mx-1"></div>

                    {/* Zoom In */}
                    <button
                        onClick={handleZoomIn}
                        className="p-2.5 rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition-all active:scale-95"
                        title="Zoom In"
                    >
                        <FaSearchPlus size={16} />
                    </button>

                    {/* Zoom Out */}
                    <button
                        onClick={handleZoomOut}
                        className="p-2.5 rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition-all active:scale-95"
                        title="Zoom Out"
                    >
                        <FaSearchMinus size={16} />
                    </button>

                    <div className="w-px h-6 bg-white/20 mx-1"></div>

                    {/* Reset */}
                    <button
                        onClick={handleReset}
                        className="p-2.5 rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition-all active:scale-95"
                        title="Reset View"
                    >
                        <FaRedo size={14} />
                    </button>

                    {/* Fullscreen */}
                    <button
                        onClick={() => { toggleFullscreen(); resetControlsTimeout(); }}
                        className="p-2.5 rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition-all active:scale-95"
                        title="Toggle Fullscreen"
                    >
                        {isFullscreen ? <FaCompress size={16} /> : <FaExpand size={16} />}
                    </button>
                </div>
            </div>

            {/* Title / Indicator (Top Left) */}
            <div className={`absolute top-4 left-4 transition-all duration-500 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
                <div className="bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                    <FaCompass className="text-indigo-400 animate-spin-slow" size={14} />
                    <span className="text-white/90 text-xs font-semibold tracking-wide">360° VIEW</span>
                </div>
            </div>

            {/* AI Magic Apply Animation Overlay */}
            {isEnhancing && (
                <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm transition-all duration-500">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-violet-500 blur-xl opacity-40 animate-pulse"></div>
                            <FaMagic className="text-5xl text-violet-400 relative z-10 animate-waving-hand" />
                            <div className="absolute -top-2 -right-2 w-4 h-4 bg-white rounded-full animate-ping"></div>
                            <div className="absolute bottom-0 -left-2 w-3 h-3 bg-indigo-400 rounded-full animate-ping delay-150"></div>
                            <div className="absolute top-1/2 -right-4 w-2 h-2 bg-pink-400 rounded-full animate-ping delay-300"></div>
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-bold bg-gradient-to-r from-violet-300 via-white to-indigo-300 bg-clip-text text-transparent animate-gradient-x mb-1">
                                Applying AI Magic
                            </h3>
                            <div className="flex items-center justify-center gap-1">
                                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></span>
                            </div>
                        </div>
                    </div>
                    {/* Add custom keyframes if needed in global CSS or use tailwind arbitrary values */}
                    <style>{`
                        @keyframes waving-hand {
                            0%, 100% { transform: rotate(0deg); }
                            25% { transform: rotate(-15deg); }
                            75% { transform: rotate(15deg); }
                        }
                        .animate-waving-hand {
                            animation: waving-hand 2s ease-in-out infinite;
                        }
                        @keyframes gradient-x {
                            0%, 100% { background-position: 0% 50%; }
                            50% { background-position: 100% 50%; }
                        }
                        .animate-gradient-x {
                            background-size: 200% 200%;
                            animation: gradient-x 3s ease infinite;
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
};

export default VirtualTourViewer;