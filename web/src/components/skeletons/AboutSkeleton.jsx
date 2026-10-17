import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FaBullseye, 
  FaEye, 
  FaGlobe, 
  FaHeart, 
  FaRocket, 
  FaShieldAlt, 
  FaStar, 
  FaUsers, 
  FaUserFriends, 
  FaCheckCircle, 
  FaQuestionCircle, 
  FaEnvelope, 
  FaChevronDown, 
  FaCog 
} from 'react-icons/fa';

/* ─────────────────── Loading status stages for About Page ─────────────────── */
const LOADING_STAGES = [
  { label: 'Connecting to UrbanSetu knowledge repository...', icon: '🌐' },
  { label: 'Retrieving UrbanSetu company mission & vision...', icon: '🎯' },
  { label: 'Loading foundational values & platform principles...', icon: '💖' },
  { label: 'Compiling real estate ecosystem workflow & AI architecture...', icon: '⚙️' },
  { label: 'Fetching key platform milestones & company journey...', icon: '🚀' },
  { label: 'Loading leadership spotlight & executive team profiles...', icon: '👥' },
  { label: 'Validating security protocols, escrow & trust frameworks...', icon: '🛡️' },
  { label: 'Loading frequently asked questions & departmental contacts...', icon: '💬' },
  { label: 'Finalizing brand presentation & interactive showcase...', icon: '✨' },
];

/* ─────────────────── Custom shimmer & animation keyframes ─────────────────── */
const SkeletonStyles = () => (
  <style>{`
    @keyframes absk-shimmer {
      0%   { background-position: -700px 0; }
      100% { background-position: 700px 0; }
    }
    @keyframes absk-float {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-6px); }
    }
    @keyframes absk-progress-glow {
      0%, 100% { box-shadow: 0 0 6px rgba(59, 130, 246, 0.4); }
      50%      { box-shadow: 0 0 20px rgba(168, 85, 247, 0.7); }
    }
    @keyframes absk-fade-in-up {
      0%   { opacity: 0; transform: translateY(14px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes absk-status-swap {
      0%   { opacity: 0; transform: translateY(8px); }
      15%  { opacity: 1; transform: translateY(0); }
      85%  { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-8px); }
    }
    @keyframes absk-pulse-ring {
      0%   { transform: scale(0.85); opacity: 0.6; }
      50%  { transform: scale(1.18); opacity: 0; }
      100% { transform: scale(0.85); opacity: 0; }
    }
    @keyframes absk-wave {
      0%, 60%, 100% { transform: scaleY(0.4); }
      30%           { transform: scaleY(1); }
    }
    .absk-shimmer {
      background: linear-gradient(
        90deg,
        rgba(148,163,184,0.08) 0%,
        rgba(148,163,184,0.22) 40%,
        rgba(148,163,184,0.08) 80%
      );
      background-size: 700px 100%;
      animation: absk-shimmer 1.8s infinite linear;
    }
    .dark .absk-shimmer {
      background: linear-gradient(
        90deg,
        rgba(100,116,139,0.12) 0%,
        rgba(100,116,139,0.28) 40%,
        rgba(100,116,139,0.12) 80%
      );
      background-size: 700px 100%;
    }
  `}</style>
);

/* ─────────────────── Shimmer Block Helper ─────────────────── */
const Shimmer = ({ className = '', style = {}, delay = 0 }) => (
  <div
    className={`absk-shimmer rounded-lg ${className}`}
    style={{
      animationDelay: `${delay}ms`,
      ...style,
    }}
  />
);

/* ─────────────────── Audio-wave Loading Indicator ─────────────────── */
const WaveLoader = () => (
  <div className="flex items-center gap-[3px] h-5">
    {[0, 1, 2, 3, 4].map(i => (
      <div
        key={i}
        className="w-[3px] h-full bg-gradient-to-t from-blue-500 via-indigo-500 to-purple-600 rounded-full"
        style={{
          animation: `absk-wave 1.2s ${i * 0.12}s infinite ease-in-out`,
        }}
      />
    ))}
  </div>
);

/* ─────────────────── Stat Impact Card Skeleton ─────────────────── */
const StatCardSkeleton = ({ delay = 0, accentColor = '#3b82f6', label, icon }) => (
  <div
    className="relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-4 sm:p-5 border border-purple-100/60 dark:border-gray-700/60 overflow-hidden flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
    style={{
      animation: `absk-fade-in-up 0.5s ${delay}ms both ease-out`,
    }}
  >
    <div className="space-y-1.5 flex-1 min-w-0 pr-2">
      <Shimmer className="h-6 w-16 rounded-lg" delay={delay + 80} />
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block truncate">{label}</span>
    </div>
    <div className="relative shrink-0">
      <div
        className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center text-lg sm:text-xl shadow-sm"
        style={{
          background: `${accentColor}18`,
          color: accentColor,
          animation: `absk-float 2.5s ${delay + 150}ms infinite ease-in-out`,
        }}
      >
        {icon}
      </div>
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background: `${accentColor}12`,
          animation: `absk-pulse-ring 2s ${delay + 150}ms infinite ease-out`,
        }}
      />
    </div>
  </div>
);

export default function AboutSkeleton({ isDarkMode: propIsDarkMode }) {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const progressRef = useRef(null);

  // Auto-detect dark mode if not explicitly passed
  const isDark = useMemo(() => {
    if (typeof propIsDarkMode === 'boolean') return propIsDarkMode;
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    }
    return false;
  }, [propIsDarkMode]);

  // Smooth loading progression simulation
  useEffect(() => {
    const totalDuration = 12000;
    const intervalMs = 60;
    let elapsed = 0;

    progressRef.current = setInterval(() => {
      elapsed += intervalMs;
      const linear = Math.min(elapsed / totalDuration, 1);
      const pct = Math.min(Math.round(linear * 97), 97);
      setProgress(pct);

      const newStage = Math.min(
        Math.floor(linear * LOADING_STAGES.length),
        LOADING_STAGES.length - 1
      );
      setStageIndex(newStage);
    }, intervalMs);

    return () => clearInterval(progressRef.current);
  }, []);

  const stage = LOADING_STAGES[stageIndex] || LOADING_STAGES[0];

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans transition-colors duration-500 ${isDark ? 'dark' : ''}`}>
      <SkeletonStyles />

      {/* ─── Top Sticky Gradient Progress Bar ─── */}
      <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="h-1 bg-gray-200/50 dark:bg-gray-800/50 backdrop-blur-md">
          <div
            className="h-full rounded-r-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #3b82f6, #6366f1, #a855f7, #ec4899)',
              animation: 'absk-progress-glow 2s infinite',
            }}
          />
        </div>
      </div>

      {/* ─── Abstract Background Ambient Blobs ─── */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400 dark:bg-blue-600 rounded-full filter blur-3xl opacity-20 dark:opacity-10" />
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-400 dark:bg-purple-600 rounded-full filter blur-3xl opacity-20 dark:opacity-10" />
        <div className="absolute -bottom-32 left-20 w-96 h-96 bg-pink-400 dark:bg-pink-600 rounded-full filter blur-3xl opacity-20 dark:opacity-10" />
      </div>

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">

        {/* ─── Loading Descriptor Banner ─── */}
        <div
          className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-xl border border-purple-100/80 dark:border-gray-800/80"
          style={{ animation: 'absk-fade-in-up 0.5s both ease-out' }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
            <div className="flex-shrink-0">
              <div className="p-2.5 sm:p-3 bg-gradient-to-br from-blue-500/15 via-indigo-500/10 to-purple-500/15 rounded-xl border border-blue-500/20">
                <WaveLoader />
              </div>
            </div>

            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex items-center gap-2.5 justify-center sm:justify-start mb-1 flex-wrap">
                <span className="text-base sm:text-lg font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Loading UrbanSetu Story & Vision
                </span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/40 shadow-xs">
                  {progress}% Sync
                </span>
              </div>

              {/* Dynamic Rotating Stage Description */}
              <div className="h-5 overflow-hidden relative">
                <p
                  key={stageIndex}
                  className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 justify-center sm:justify-start font-medium"
                  style={{ animation: 'absk-status-swap 2s both ease-in-out' }}
                >
                  <span className="text-base">{stage.icon}</span>
                  <span className="truncate">{stage.label}</span>
                </p>
              </div>
            </div>

            {/* Circular Progress Gauge */}
            <div className="flex-shrink-0 hidden sm:block">
              <svg width="48" height="48" viewBox="0 0 48 48">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  strokeWidth="3.5"
                  className="text-gray-200 dark:text-gray-700"
                  stroke="currentColor"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  strokeWidth="3.5"
                  stroke="url(#about-grad)"
                  strokeDasharray={`${2 * Math.PI * 20}`}
                  strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-300 ease-out"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                />
                <defs>
                  <linearGradient id="about-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                <text
                  x="24"
                  y="24"
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-gray-700 dark:fill-gray-200 text-[10px] font-black"
                >
                  {progress}%
                </text>
              </svg>
            </div>
          </div>

          {/* Shimmering Progress Bar */}
          <div className="mt-3.5 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out relative"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6, #ec4899)',
              }}
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'absk-shimmer 1.2s infinite linear',
                }}
              />
            </div>
          </div>
        </div>

        {/* ─── Platform Impact Stat Cards ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCardSkeleton label="Verified Listings" icon="🏠" accentColor="#3b82f6" delay={100} />
          <StatCardSkeleton label="Active Members" icon="👥" accentColor="#10b981" delay={180} />
          <StatCardSkeleton label="Cities Connected" icon="🏙️" accentColor="#8b5cf6" delay={260} />
          <StatCardSkeleton label="Escrow Trust Rate" icon="🛡️" accentColor="#ec4899" delay={340} />
        </div>

        {/* ─── 1. Hero / Intro Section Skeleton ─── */}
        <div 
          className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-lg p-6 sm:p-10 text-center border border-gray-100 dark:border-gray-800"
          style={{ animation: 'absk-fade-in-up 0.6s 150ms both ease-out' }}
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center text-xl shadow-sm">
              <FaGlobe />
            </div>
            <Shimmer className="h-10 sm:h-12 w-64 sm:w-96 rounded-xl" delay={200} />
          </div>
          <div className="space-y-3 max-w-4xl mx-auto">
            <Shimmer className="h-4 sm:h-5 w-full rounded" delay={250} />
            <Shimmer className="h-4 sm:h-5 w-5/6 mx-auto rounded" delay={300} />
            <Shimmer className="h-4 sm:h-5 w-4/6 mx-auto rounded" delay={350} />
          </div>
        </div>

        {/* ─── 2. Mission & Vision Skeleton (2 Cards) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Mission */}
          <div 
            className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-lg p-6 sm:p-8 border border-purple-100/60 dark:border-purple-900/20"
            style={{ animation: 'absk-fade-in-up 0.6s 200ms both ease-out' }}
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <FaBullseye className="text-purple-500 text-2xl" />
              <Shimmer className="h-8 w-40 rounded-lg" delay={220} />
            </div>
            <div className="space-y-2.5">
              <Shimmer className="h-4 w-full rounded" delay={270} />
              <Shimmer className="h-4 w-11/12 rounded" delay={320} />
              <Shimmer className="h-4 w-4/5 rounded" delay={370} />
            </div>
          </div>

          {/* Vision */}
          <div 
            className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-lg p-6 sm:p-8 border border-blue-100/60 dark:border-blue-900/20"
            style={{ animation: 'absk-fade-in-up 0.6s 250ms both ease-out' }}
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <FaEye className="text-blue-500 text-2xl" />
              <Shimmer className="h-8 w-36 rounded-lg" delay={260} />
            </div>
            <div className="space-y-2.5">
              <Shimmer className="h-4 w-full rounded" delay={310} />
              <Shimmer className="h-4 w-11/12 rounded" delay={360} />
              <Shimmer className="h-4 w-4/5 rounded" delay={410} />
            </div>
          </div>
        </div>

        {/* ─── 3. Core Values Skeleton (3 Cards) ─── */}
        <div 
          className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-lg p-6 sm:p-8 border border-green-100/60 dark:border-green-900/20"
          style={{ animation: 'absk-fade-in-up 0.6s 280ms both ease-out' }}
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <FaHeart className="text-green-500 text-2xl" />
            <Shimmer className="h-8 w-48 rounded-lg" delay={300} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-gradient-to-br from-gray-50 to-blue-50/50 dark:from-gray-800/80 dark:to-blue-900/20 rounded-xl p-5 border border-gray-200/60 dark:border-gray-700/60 space-y-3"
              >
                <Shimmer className="h-6 w-32 rounded-lg" delay={320 + i * 80} />
                <Shimmer className="h-3.5 w-full rounded" delay={360 + i * 80} />
                <Shimmer className="h-3.5 w-5/6 rounded" delay={400 + i * 80} />
              </div>
            ))}
          </div>
        </div>

        {/* ─── 4. How UrbanSetu Works (3 Flow Cards) ─── */}
        <div 
          className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-lg p-6 sm:p-8 border border-blue-100/60 dark:border-blue-900/20"
          style={{ animation: 'absk-fade-in-up 0.6s 320ms both ease-out' }}
        >
          <div className="flex items-center justify-center gap-3 mb-8">
            <FaCog className="text-blue-500 text-2xl animate-spin" />
            <Shimmer className="h-8 w-60 rounded-lg" delay={340} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200/60 dark:border-blue-800/60 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <FaRocket className="text-blue-500 text-lg" />
                  <Shimmer className="h-6 w-36 rounded-lg" delay={360 + i * 90} />
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="flex items-start gap-2.5">
                      <FaCheckCircle className="text-green-500 text-sm mt-0.5 shrink-0" />
                      <Shimmer className="h-3.5 w-full rounded" delay={400 + j * 60 + i * 80} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── 5. Key Features Grid (4 Pills) ─── */}
        <div 
          className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-lg p-6 sm:p-8 border border-yellow-100/60 dark:border-yellow-900/20"
          style={{ animation: 'absk-fade-in-up 0.6s 350ms both ease-out' }}
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <FaStar className="text-yellow-500 text-2xl" />
            <Shimmer className="h-8 w-44 rounded-lg" delay={380} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-4 bg-gradient-to-r from-gray-50 to-blue-50/40 dark:from-gray-800/80 dark:to-blue-900/20 rounded-xl border border-gray-200/60 dark:border-gray-700/60"
              >
                <FaCheckCircle className="text-green-500 shrink-0 text-base" />
                <Shimmer className="h-4 w-4/5 rounded" delay={400 + i * 70} />
              </div>
            ))}
          </div>
        </div>

        {/* ─── 6. Leadership Spotlight Skeleton (CEO Feature) ─── */}
        <div 
          className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-lg p-6 sm:p-10 border border-purple-100/60 dark:border-purple-900/20"
          style={{ animation: 'absk-fade-in-up 0.6s 380ms both ease-out' }}
        >
          <div className="flex items-center justify-center gap-3 mb-8">
            <FaUserFriends className="text-purple-500 text-2xl" />
            <Shimmer className="h-8 w-56 rounded-lg" delay={400} />
          </div>
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 lg:gap-12">
            {/* Left Profile */}
            <div className="flex-1 text-center lg:text-left space-y-4 w-full">
              <div className="w-48 h-48 sm:w-56 sm:h-56 mx-auto lg:mx-0 rounded-full overflow-hidden border-4 border-purple-500/50 shadow-2xl p-1 bg-gradient-to-tr from-purple-500 to-blue-500">
                <div className="w-full h-full rounded-full bg-gray-200 dark:bg-gray-700 absk-shimmer" />
              </div>
              <Shimmer className="h-8 w-56 mx-auto lg:mx-0 rounded-lg" delay={420} />
              <div className="h-7 w-36 mx-auto lg:mx-0 bg-blue-100/80 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                <Shimmer className="h-3.5 w-24 rounded" delay={440} />
              </div>
              <Shimmer className="h-4 w-4/5 mx-auto lg:mx-0 rounded italic" delay={460} />
              <div className="bg-gradient-to-br from-purple-50/60 to-blue-50/60 dark:from-purple-900/20 dark:to-blue-900/20 p-5 rounded-xl border border-purple-100 dark:border-purple-800 space-y-3">
                <Shimmer className="h-5 w-44 rounded-lg" delay={480} />
                <Shimmer className="h-3.5 w-full rounded" delay={500} />
                <Shimmer className="h-3.5 w-5/6 rounded" delay={520} />
              </div>
            </div>

            {/* Right Photo Gallery Grid Skeleton */}
            <div className="flex-1 w-full max-w-md lg:max-w-none">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-1 row-span-2 rounded-2xl h-72 bg-gray-200 dark:bg-gray-700 absk-shimmer shadow-lg" />
                <div className="col-span-1 rounded-2xl h-32 bg-gray-200 dark:bg-gray-700 absk-shimmer shadow-lg mt-4" />
                <div className="col-span-1 bg-gradient-to-br from-blue-600/80 to-purple-600/80 rounded-2xl flex items-center justify-center h-32 shadow-lg p-3">
                  <div className="space-y-2 text-center w-full">
                    <FaStar className="text-yellow-300 text-2xl mx-auto" />
                    <Shimmer className="h-3.5 w-3/4 mx-auto rounded bg-white/40" delay={540} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 7. Team Members Grid (4 Cards) ─── */}
        <div 
          className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-lg p-6 sm:p-8 border border-purple-100/60 dark:border-purple-900/20"
          style={{ animation: 'absk-fade-in-up 0.6s 400ms both ease-out' }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <FaUsers className="text-purple-500 text-2xl" />
            <Shimmer className="h-8 w-44 rounded-lg" delay={420} />
          </div>
          <Shimmer className="h-4 w-2/3 mx-auto rounded mb-8" delay={440} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-gradient-to-br from-gray-50 to-purple-50/40 dark:from-gray-800/80 dark:to-purple-900/20 rounded-xl p-5 border border-gray-200/60 dark:border-gray-700/60 text-center flex flex-col items-center space-y-3"
              >
                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-gradient-to-r from-blue-500/80 to-purple-500/80 absk-shimmer shadow-md" />
                <Shimmer className="h-5 w-28 rounded-lg" delay={460 + i * 60} />
                <Shimmer className="h-3.5 w-20 rounded" delay={480 + i * 60} />
                <Shimmer className="h-3 w-full rounded" delay={500 + i * 60} />
                <Shimmer className="h-3 w-4/5 rounded" delay={520 + i * 60} />
              </div>
            ))}
          </div>
        </div>

        {/* ─── 8. Frequently Asked Questions (FAQ) Accordion Skeleton ─── */}
        <div 
          className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-lg p-6 sm:p-8 border border-green-100/60 dark:border-green-900/20"
          style={{ animation: 'absk-fade-in-up 0.6s 420ms both ease-out' }}
        >
          <div className="flex items-center justify-center gap-3 mb-8">
            <FaQuestionCircle className="text-green-500 text-2xl" />
            <Shimmer className="h-8 w-64 rounded-lg" delay={440} />
          </div>
          <div className="space-y-3.5 max-w-4xl mx-auto">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="border border-gray-200/70 dark:border-gray-800 rounded-xl p-4 bg-gradient-to-r from-gray-50 to-blue-50/30 dark:from-gray-800/70 dark:to-blue-900/10 flex items-center justify-between"
              >
                <Shimmer className="h-4 w-3/4 rounded" delay={460 + i * 50} />
                <FaChevronDown className="text-gray-400 text-xs shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* ─── 9. Department Contacts Grid (3 Cards) ─── */}
        <div 
          className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-lg p-6 sm:p-8 border border-indigo-100/60 dark:border-indigo-900/20"
          style={{ animation: 'absk-fade-in-up 0.6s 440ms both ease-out' }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <FaEnvelope className="text-indigo-500 text-2xl animate-pulse" />
            <Shimmer className="h-8 w-64 rounded-lg" delay={460} />
          </div>
          <Shimmer className="h-4 w-2/3 mx-auto rounded mb-8" delay={480} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-5 rounded-xl border border-gray-200/60 dark:border-gray-800 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/80 dark:to-gray-900 flex flex-col items-center text-center space-y-3"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 absk-shimmer" />
                <Shimmer className="h-5 w-32 rounded-lg" delay={500 + i * 60} />
                <Shimmer className="h-3.5 w-full rounded" delay={520 + i * 60} />
                <Shimmer className="h-4 w-40 rounded" delay={540 + i * 60} />
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ─── Floating Bottom AI & Support Shadows (Matches Page Floating Buttons) ─── */}
      <div 
        className="fixed inset-0 pointer-events-none z-40"
        style={{
          animation: 'absk-fade-in-up 0.8s 800ms both cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Gemini AI Shadow */}
        <div className="absolute bottom-20 right-6 w-12 h-12 rounded-full absk-shimmer shadow-xl border border-white/20 dark:border-gray-700/50 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm pointer-events-auto flex items-center justify-center text-indigo-500 text-lg">
          ✨
        </div>
        {/* Contact Support Shadow */}
        <div className="absolute bottom-6 right-6 w-12 h-12 rounded-full absk-shimmer shadow-xl border border-white/20 dark:border-gray-700/50 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm pointer-events-auto flex items-center justify-center text-blue-500 text-lg">
          💬
        </div>
      </div>

    </div>
  );
}
