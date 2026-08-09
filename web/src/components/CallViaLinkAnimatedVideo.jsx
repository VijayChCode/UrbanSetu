import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Video, Phone, ShieldCheck, Clock, CheckCircle2, Sparkles } from 'lucide-react';

const SCENES = [
  {
    id: 1,
    title: "Introducing Call via Link",
    subtitle: "Instant, Secure Video & Audio Consultation Rooms",
    image: "file:///C:/Users/chale/.gemini/antigravity-ide/brain/794bcce8-ed9e-4595-94f5-5e7532a4887f/video_scene_1_intro_logo_fixed_1786242615527.png",
    duration: 4000
  },
  {
    id: 2,
    title: "One-Click Shareable Call Links",
    subtitle: "24-Hour Expiry • Multi-Device Protection • Seamless WebRTC",
    image: "file:///C:/Users/chale/.gemini/antigravity-ide/brain/794bcce8-ed9e-4595-94f5-5e7532a4887f/video_scene_2_highlight_logo_fixed_1786242633136.png",
    duration: 5000
  },
  {
    id: 3,
    title: "Elevate Property Consultations Today",
    subtitle: "Pre-Call Camera Preview • Real-Time Presence • HD Voice & Video",
    image: "file:///C:/Users/chale/.gemini/antigravity-ide/brain/794bcce8-ed9e-4595-94f5-5e7532a4887f/video_scene_3_callroom_logo_fixed_1786242650187.png",
    duration: 5000
  }
];

export default function CallViaLinkAnimatedVideo({ autoPlay = true }) {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let timer;
    let interval;

    if (isPlaying) {
      const currentDuration = SCENES[currentSceneIndex].duration;
      const startTime = Date.now();

      interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const currentProgress = Math.min(100, (elapsed / currentDuration) * 100);
        setProgress(currentProgress);
      }, 50);

      timer = setTimeout(() => {
        if (currentSceneIndex < SCENES.length - 1) {
          setCurrentSceneIndex(prev => prev + 1);
          setProgress(0);
        } else {
          setCurrentSceneIndex(0); // Auto-loop
          setProgress(0);
        }
      }, currentDuration);
    }

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [isPlaying, currentSceneIndex]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReplay = () => {
    setCurrentSceneIndex(0);
    setProgress(0);
    setIsPlaying(true);
  };

  const currentScene = SCENES[currentSceneIndex];

  return (
    <div className="w-full max-w-4xl mx-auto rounded-3xl overflow-hidden border border-blue-500/30 bg-slate-950 shadow-2xl shadow-blue-500/20 relative group">
      {/* 16:9 Video Canvas Container */}
      <div className="relative w-full aspect-video bg-blue-950 overflow-hidden flex items-center justify-center">
        
        {/* Animated Background Rays */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-magenta-600/20 animate-pulse pointer-events-none" />

        {/* Scene Image Transition */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScene.id}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full"
          >
            <img
              src={currentScene.image}
              alt={currentScene.title}
              className="w-full h-full object-cover"
            />

            {/* Subtle Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
          </motion.div>
        </AnimatePresence>

        {/* Animated Text & Badge Overlay */}
        <div className="absolute bottom-6 left-6 right-6 z-20 pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScene.id + "-text"}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="space-y-2"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/80 backdrop-blur-md rounded-full text-xs font-bold text-white border border-blue-400/40 shadow-lg">
                <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-spin" />
                <span>PROMOTIONAL TRAILER • SCENE {currentSceneIndex + 1}/{SCENES.length}</span>
              </div>

              <h3 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-md">
                {currentScene.title}
              </h3>

              <p className="text-xs sm:text-base text-blue-200 font-medium drop-shadow">
                {currentScene.subtitle}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Floating Play/Pause Controls Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30 bg-black/40 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={handlePlayPause}
              className="w-16 h-16 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95"
            >
              {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
            </button>
            <button
              onClick={handleReplay}
              className="w-12 h-12 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full flex items-center justify-center backdrop-blur-md shadow-xl transition-all hover:scale-110 active:scale-95"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800/80 z-40">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-yellow-400 to-pink-500 transition-all duration-75 ease-linear shadow-lg"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Control Footer Bar */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-semibold text-blue-400">
            <Video className="w-4 h-4" /> Official Promotional Video
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">Call via Link Feature Launch</span>
        </div>

        <div className="flex items-center gap-2">
          {SCENES.map((scene, idx) => (
            <button
              key={scene.id}
              onClick={() => {
                setCurrentSceneIndex(idx);
                setProgress(0);
                setIsPlaying(true);
              }}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                currentSceneIndex === idx ? 'bg-blue-500 scale-125 ring-2 ring-blue-400/50' : 'bg-slate-700 hover:bg-slate-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
