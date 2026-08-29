import React, { useState, useEffect, useRef } from "react";
import ListingSkeletonGrid from "./ListingSkeletonGrid";

/* ─────────────────── Loading status messages for regular users ─────────────────── */
const LOADING_STAGES = [
  { label: 'Connecting to UrbanSetu secure gateway...', icon: '🔗' },
  { label: 'Authenticating active session credentials...', icon: '🔑' },
  { label: 'Initializing Sentinel AI security scanner...', icon: '🛡️' },
  { label: 'Detecting real-time IP location coordinates...', icon: '🌐' },
  { label: 'Resolving user location fallback hierarchy...', icon: '📍' },
  { label: 'Retrieving properties near your location...', icon: '🏠' },
  { label: 'Fetching recently viewed properties...', icon: '👁️' },
  { label: 'Syncing your price drop watchlist...', icon: '📉' },
  { label: 'Analyzing user browsing preference vectors...', icon: '📊' },
  { label: 'Calculating Sentinel AI matching weights...', icon: '🤖' },
  { label: 'Generating personalized live recommendations...', icon: '⚡' },
  { label: 'Loading community insights & guides...', icon: '💡' },
  { label: 'Mapping scheduling calendar...', icon: '📅' },
  { label: 'Finalizing premium dashboard widgets...', icon: '✨' },
];

/* ─────────────────── Custom shimmer keyframes via inline style tag ─────────── */
const SkeletonStyles = () => (
  <style>{`
    @keyframes hsk-shimmer {
      0%   { background-position: -700px 0; }
      100% { background-position: 700px 0; }
    }
    @keyframes hsk-grow {
      0%   { transform: scaleY(0.15); opacity: 0.3; }
      60%  { transform: scaleY(1); opacity: 1; }
      100% { transform: scaleY(1); opacity: 1; }
    }
    @keyframes hsk-float {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-6px); }
    }
    @keyframes hsk-progress-glow {
      0%, 100% { box-shadow: 0 0 6px rgba(244,63,94,0.4); }
      50%      { box-shadow: 0 0 20px rgba(244,63,94,0.8); }
    }
    @keyframes hsk-fade-in-up {
      0%   { opacity: 0; transform: translateY(12px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes hsk-status-swap {
      0%   { opacity: 0; transform: translateY(8px); }
      15%  { opacity: 1; transform: translateY(0); }
      85%  { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-8px); }
    }
    @keyframes hsk-pulse-ring {
      0%   { transform: scale(0.8); opacity: 0.6; }
      50%  { transform: scale(1.15); opacity: 0; }
      100% { transform: scale(0.8); opacity: 0; }
    }
    @keyframes hsk-wave {
      0%, 60%, 100% { transform: scaleY(0.4); }
      30%           { transform: scaleY(1); }
    }
    .hsk-shimmer {
      background: linear-gradient(
        90deg,
        rgba(148,163,184,0.06) 0%,
        rgba(148,163,184,0.15) 40%,
        rgba(148,163,184,0.06) 80%
      );
      background-size: 700px 100%;
      animation: hsk-shimmer 1.8s infinite linear;
    }
    .dark .hsk-shimmer {
      background: linear-gradient(
        90deg,
        rgba(100,116,139,0.08) 0%,
        rgba(100,116,139,0.22) 40%,
        rgba(100,116,139,0.08) 80%
      );
      background-size: 700px 100%;
    }
  `}</style>
);

/* ─────────────────── Shimmer Block (replaces plain pulse) ─────────────────── */
const Shimmer = ({ className = '', style = {}, delay = 0 }) => (
  <div
    className={`hsk-shimmer rounded-lg ${className}`}
    style={{
      animationDelay: `${delay}ms`,
      ...style,
    }}
  />
);

/* ─────────────────── Audio-wave loading indicator ─────────────────── */
const WaveLoader = () => (
  <div className="flex items-center gap-[3px] h-5">
    {[0, 1, 2, 3, 4].map(i => (
      <div
        key={i}
        className="w-[3px] h-full bg-gradient-to-t from-rose-500 to-pink-500 rounded-full"
        style={{
          animation: `hsk-wave 1.2s ${i * 0.12}s infinite ease-in-out`,
        }}
      />
    ))}
  </div>
);

/* ─────────────────── Stat Pill Card Skeleton ─────────────────── */
const StatCardSkeleton = ({ delay = 0, accentColor = '#f43f5e', label, icon }) => (
  <div
    className="relative bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-200/50 dark:border-gray-700/50 overflow-hidden flex items-center justify-between shadow-sm group hover:shadow-md transition-shadow"
    style={{
      animation: `hsk-fade-in-up 0.6s ${delay}ms both ease-out`,
    }}
  >
    <div className="space-y-1.5 flex-1">
      <Shimmer className="h-6 w-12 rounded-lg" delay={delay + 100} />
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">{label}</span>
    </div>
    <div className="relative">
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center text-lg"
        style={{
          background: `${accentColor}18`,
          color: accentColor,
          animation: `hsk-float 2.5s ${delay + 200}ms infinite ease-in-out`,
        }}
      >
        {icon}
      </div>
      <div
        className="absolute inset-0 rounded-xl"
        style={{
          background: `${accentColor}10`,
          animation: `hsk-pulse-ring 2s ${delay + 200}ms infinite ease-out`,
        }}
      />
    </div>
  </div>
);

export default function HomeSkeleton() {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const progressRef = useRef(null);

  // Simulate dashboard loading progress with steady stage pacing
  useEffect(() => {
    const totalDuration = 14000; // 14s total duration for smooth stage pacing
    const intervalMs = 60;
    let elapsed = 0;

    progressRef.current = setInterval(() => {
      elapsed += intervalMs;
      const linear = Math.min(elapsed / totalDuration, 1);
      // Smooth progress curve holding at 97% until data load finishes
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

  const stage = LOADING_STAGES[stageIndex];

  return (
    <div className="bg-gradient-to-br from-rose-50/30 via-indigo-50/20 to-purple-50/30 dark:from-slate-950 dark:via-indigo-950/10 dark:to-purple-950/10 min-h-screen pb-16 font-sans transition-colors duration-500 relative overflow-hidden">
      <SkeletonStyles />

      {/* ─── Top Progress Bar ─── */}
      <div className="sticky top-0 z-50">
        <div className="h-1 bg-gray-200/50 dark:bg-gray-800/50 backdrop-blur-md">
          <div
            className="h-full rounded-r-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #f43f5e, #ec4899, #8b5cf6)',
              animation: 'hsk-progress-glow 2s infinite',
            }}
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* ─── Status banner ─── */}
        <div
          className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl p-5 shadow-xl border border-white/30 dark:border-gray-700/50 mb-8"
          style={{ animation: 'hsk-fade-in-up 0.5s both ease-out' }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="flex-shrink-0">
              <div className="p-3 bg-gradient-to-br from-rose-500/10 to-pink-500/10 rounded-xl">
                <WaveLoader />
              </div>
            </div>

            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-1.5">
                <span className="text-lg font-black bg-gradient-to-r from-rose-600 to-purple-600 bg-clip-text text-transparent">
                  Preparing Your Dashboard
                </span>
                <span className="text-xs font-bold text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-100/50 dark:border-rose-900/10">
                  {progress}% Sync
                </span>
              </div>

              {/* Status message */}
              <div className="h-5 overflow-hidden relative">
                <p
                  key={stageIndex}
                  className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 justify-center sm:justify-start font-medium"
                  style={{ animation: 'hsk-status-swap 2s both ease-in-out' }}
                >
                  <span className="text-base">{stage.icon}</span>
                  <span>{stage.label}</span>
                </p>
              </div>
            </div>

            <div className="flex-shrink-0 hidden sm:block">
              <svg width="48" height="48" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" strokeWidth="3"
                  className="text-gray-200 dark:text-gray-700" stroke="currentColor" />
                <circle cx="24" cy="24" r="20" fill="none" strokeWidth="3"
                  stroke="url(#rose-grad)"
                  strokeDasharray={`${2 * Math.PI * 20}`}
                  strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-300 ease-out"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                />
                <defs>
                  <linearGradient id="rose-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f43f5e" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
                <text x="24" y="24" textAnchor="middle" dominantBaseline="central"
                  className="fill-gray-700 dark:fill-gray-200 text-[10px] font-black"
                >
                  {progress}%
                </text>
              </svg>
            </div>
          </div>

          <div className="mt-4 h-1.5 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out relative"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #f43f5e, #ec4899, #a855f7, #8b5cf6)',
              }}
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'hsk-shimmer 1.2s infinite linear',
                }}
              />
            </div>
          </div>
        </div>

        {/* ─── Hero / Welcome Section Skeleton ─── */}
        <div
          className="relative overflow-hidden bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-3xl shadow-lg border border-white/20 dark:border-gray-700/50 mb-8"
          style={{ animation: 'hsk-fade-in-up 0.6s 150ms both ease-out' }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 via-indigo-500/5 to-purple-500/5" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between p-6 md:p-8 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center text-lg shadow-sm"
                  style={{ animation: 'hsk-float 3s infinite ease-in-out' }}
                >
                  👋
                </div>
                <div className="space-y-1.5">
                  <Shimmer className="h-6 w-48" delay={200} />
                  <Shimmer className="h-4 w-32" delay={280} />
                </div>
              </div>
              <Shimmer className="h-4 w-full max-w-md" delay={350} />
            </div>
            <div className="flex gap-3">
              <Shimmer className="h-10 w-28 rounded-xl" delay={450} />
              <Shimmer className="h-10 w-28 rounded-xl" delay={500} />
            </div>
          </div>
        </div>

        {/* ─── Educational & Major Project Banner Skeleton ─── */}
        <div
          className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl p-[2px] bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 mb-8 shadow-lg"
          style={{ animation: 'hsk-fade-in-up 0.6s 160ms both ease-out' }}
        >
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-[14px] sm:rounded-[22px] p-4 sm:p-6 md:p-8 text-left">
            {/* Badges row */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex flex-wrap items-center gap-2">
                <Shimmer className="h-6 w-36 rounded-full" delay={180} />
                <Shimmer className="h-6 w-32 rounded-full" delay={220} />
                <Shimmer className="h-6 w-28 rounded-full" delay={260} />
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <Shimmer className="h-7 w-7 rounded-xl" delay={260} />
                <Shimmer className="h-7 w-7 rounded-xl" delay={300} />
              </div>
            </div>

            {/* Header with Sparkle Icon + Title */}
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="hidden sm:flex w-10 h-10 md:w-12 md:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 items-center justify-center shrink-0">
                <span className="text-xl">✨</span>
              </div>
              <div className="flex-1 space-y-3">
                <Shimmer className="h-6 sm:h-7 w-64 sm:w-96 rounded-lg" delay={250} />
                <div className="space-y-2">
                  <Shimmer className="h-4 w-full rounded" delay={300} />
                  <Shimmer className="h-4 w-5/6 rounded" delay={350} />
                </div>

                {/* Feature chips skeleton */}
                <div className="pt-1 flex flex-wrap gap-2">
                  <Shimmer className="h-7 w-44 rounded-lg sm:rounded-xl" delay={380} />
                  <Shimmer className="h-7 w-40 rounded-lg sm:rounded-xl" delay={420} />
                  <Shimmer className="h-7 w-36 rounded-lg sm:rounded-xl" delay={460} />
                </div>

                {/* Action button skeletons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <Shimmer className="h-10 w-full sm:w-56 rounded-xl" delay={500} />
                  <Shimmer className="h-10 w-full sm:w-40 rounded-xl" delay={550} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Dashboard Walkthrough Card Skeleton ─── */}
        <div 
          className="bg-white/60 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/50 rounded-2xl p-6 mb-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm relative overflow-hidden"
          style={{ animation: 'hsk-fade-in-up 0.6s 180ms both ease-out' }}
        >
          <div className="flex items-center gap-4 flex-1 w-full">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0 animate-pulse text-blue-500">
              💡
            </div>
            <div className="space-y-2 flex-1">
              <Shimmer className="h-5 w-44 rounded-lg" delay={200} />
              <Shimmer className="h-3.5 w-full max-w-[480px] rounded" delay={250} />
            </div>
          </div>
          <div className="w-full md:w-auto flex-shrink-0">
            <Shimmer className="h-11 w-full md:w-36 rounded-xl" delay={300} />
          </div>
        </div>

        {/* ─── Dashboard Stats Grid Skeleton ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCardSkeleton label="My Listings" icon="🏠" accentColor="#3b82f6" delay={200} />
          <StatCardSkeleton label="Watchlist Items" icon="❤️" accentColor="#f43f5e" delay={300} />
          <StatCardSkeleton label="Saved Enquiries" icon="💬" accentColor="#10b981" delay={400} />
          <StatCardSkeleton label="Upcoming Appts" icon="📅" accentColor="#8b5cf6" delay={500} />
        </div>

        {/* ─── Upcoming Appointments Preview Skeleton ─── */}
        <div 
          className="bg-white/60 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/50 rounded-2xl p-5 mb-10"
          style={{ animation: 'hsk-fade-in-up 0.6s 450ms both ease-out' }}
        >
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-purple-500/10 text-purple-600 rounded-lg text-sm">📅</span>
              <Shimmer className="h-4 w-36" delay={500} />
            </div>
            <Shimmer className="h-3 w-16" delay={550} />
          </div>
          <div className="space-y-3">
            {[1, 2].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50/50 dark:bg-gray-700/10">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <Shimmer className="h-4 w-1/2" delay={600 + i * 100} />
                  <Shimmer className="h-3 w-1/3" delay={650 + i * 100} />
                </div>
                <div className="h-6 w-16 rounded-full bg-purple-100/50 dark:bg-purple-900/20" />
              </div>
            ))}
          </div>
        </div>

        {/* ─── Section 4: Price Drop Alerts Skeleton ─── */}
        <section className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <span className="p-1.5 bg-green-500/10 text-green-600 rounded-xl">📉</span>
              <Shimmer className="h-5.5 w-40 rounded-lg" delay={900} />
            </div>
            <Shimmer className="h-4 w-24 rounded" delay={950} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <ListingSkeletonGrid count={4} />
          </div>
        </section>

        {/* ─── Rent Payment Overdue Alerts Skeleton ─── */}
        <section className="mb-12 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="p-1.5 bg-red-500/10 text-red-600 rounded-xl">🚨</span>
              <Shimmer className="h-5.5 w-48 rounded-lg" delay={920} />
            </div>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-red-100 dark:border-red-950/20 shadow-md p-5 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 flex-1 min-w-0 w-full">
              <div className="w-14 h-14 bg-red-100/50 dark:bg-red-950/20 rounded-2xl animate-pulse shrink-0" />
              <div className="space-y-2.5 flex-1 w-full text-center sm:text-left">
                <div className="h-5 w-32 bg-red-100/60 dark:bg-red-950/30 rounded-full inline-block" />
                <Shimmer className="h-5 w-3/4 mx-auto sm:mx-0" delay={940} />
                <Shimmer className="h-3.5 w-1/3 mx-auto sm:mx-0" delay={960} />
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-1">
                  <div className="h-6 w-24 bg-gray-100/50 dark:bg-gray-700/50 rounded-lg" />
                  <div className="h-6 w-32 bg-gray-100/50 dark:bg-gray-700/50 rounded-lg" />
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center md:items-end gap-3 w-full md:w-auto">
              <div className="text-center md:text-right space-y-1 w-full">
                <Shimmer className="h-3 w-16 md:ml-auto" delay={980} />
                <Shimmer className="h-8 w-28 md:ml-auto" delay={1000} />
              </div>
              <div className="h-11 w-full sm:w-36 bg-red-200/50 dark:bg-red-900/30 rounded-xl animate-pulse" />
            </div>
          </div>
        </section>


        {/* ─── Section 1: Recently Viewed Skeleton ─── */}
        <section className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <span className="p-1.5 bg-blue-500/10 text-blue-600 rounded-xl">👁️</span>
              <Shimmer className="h-5.5 w-44 rounded-lg" delay={600} />
            </div>
            <Shimmer className="h-4 w-20 rounded" delay={650} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <ListingSkeletonGrid count={4} />
          </div>
        </section>

        {/* ─── Section 2: Quick Search Pills Skeleton ─── */}
        <section className="mb-12 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm border border-gray-100/50 dark:border-gray-700/40 rounded-3xl p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <span className="p-1.5 bg-indigo-500/10 text-indigo-600 rounded-xl">🔍</span>
              <Shimmer className="h-5.5 w-32 rounded-lg" delay={700} />
            </div>
            <Shimmer className="h-4 w-24 rounded" delay={750} />
          </div>
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4, 5].map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700 shadow-sm animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
                <span className="text-sm opacity-60">📍</span>
                <Shimmer className="h-3 w-20" delay={750 + i * 80} />
              </div>
            ))}
          </div>
        </section>

        {/* ─── Section 3: Properties Near You Skeleton (Rose Gradient Accent) ─── */}
        <section className="mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="p-1.5 bg-gradient-to-br from-rose-500 to-pink-600 text-white rounded-xl shadow-md shrink-0 animate-pulse">
                📍
              </span>
              <div className="flex items-center gap-2.5 flex-wrap">
                <Shimmer className="h-6 w-48 rounded-lg" delay={800} />
                <div className="h-6 w-20 bg-rose-100/50 dark:bg-rose-950/20 rounded-full border border-rose-100/20" />
              </div>
            </div>
            <Shimmer className="h-4 w-20 rounded self-start sm:self-auto" delay={850} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <ListingSkeletonGrid count={4} />
          </div>
        </section>


        {/* ─── Section 5: Explore & Learn Skeleton ─── */}
        <section className="mb-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-xl"
                  style={{ animation: 'hsk-float 2.5s 1000ms infinite ease-in-out' }}
                >
                  <span className="text-lg">💡</span>
                </div>
                <Shimmer className="h-7 w-44 rounded-lg" delay={1000} />
              </div>
              <Shimmer className="h-3.5 w-72 rounded ml-[52px]" delay={1050} />
            </div>
          </div>

          {/* Tab Switcher Skeleton */}
          <div className="flex gap-2 mb-8">
            {[
              { w: 'w-32', color: 'from-blue-500/20 to-blue-600/20' },
              { w: 'w-36', color: 'from-indigo-500/10 to-indigo-600/10' },
              { w: 'w-28', color: 'from-purple-500/10 to-purple-600/10' },
            ].map((tab, i) => (
              <div
                key={i}
                className={`${tab.w} h-10 bg-gradient-to-r ${tab.color} rounded-xl border border-gray-200/30 dark:border-gray-700/30`}
                style={{ animation: `hsk-fade-in-up 0.5s ${1050 + i * 80}ms both ease-out` }}
              >
                <Shimmer className="h-full w-full rounded-xl" delay={1050 + i * 80} />
              </div>
            ))}
          </div>

          {/* Content Cards Skeleton — 3 post-style cards */}
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-100/50 dark:border-gray-700/50 p-5 shadow-sm"
                style={{ animation: `hsk-fade-in-up 0.5s ${1150 + i * 100}ms both ease-out` }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-600/15 flex-shrink-0 animate-pulse" />
                  <div className="flex-1 space-y-3 min-w-0">
                    <div className="flex items-center gap-2">
                      <Shimmer className="h-3.5 w-24" delay={1200 + i * 100} />
                      <Shimmer className="h-3 w-16" delay={1250 + i * 100} />
                      <div className="h-4 w-14 bg-blue-100/50 dark:bg-blue-900/20 rounded-full" />
                    </div>
                    <Shimmer className="h-5 w-3/4" delay={1300 + i * 100} />
                    <Shimmer className="h-3.5 w-full" delay={1350 + i * 100} />
                    <Shimmer className="h-3.5 w-2/3" delay={1400 + i * 100} />
                    <div className="flex items-center gap-4 pt-1">
                      <Shimmer className="h-3 w-10" delay={1450 + i * 100} />
                      <Shimmer className="h-3 w-14" delay={1500 + i * 100} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* ─── Bottom Floating Support & AI Skeletons ─── */}
      <div 
        className="fixed inset-0 pointer-events-none z-50"
        style={{
          animation: 'hsk-fade-in-up 0.8s 1200ms both cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Gemini AI Shadow */}
        <div className="absolute bottom-20 right-6 w-12 h-12 rounded-full hsk-shimmer shadow-lg border border-gray-200/30 dark:border-gray-700/30 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm pointer-events-auto" />
        {/* Contact Support Shadow */}
        <div className="absolute bottom-6 right-6 w-12 h-12 rounded-full hsk-shimmer shadow-lg border border-gray-200/30 dark:border-gray-700/30 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm pointer-events-auto" />
      </div>
    </div>
  );
}
