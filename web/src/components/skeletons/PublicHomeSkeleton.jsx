import React, { useState, useEffect, useRef } from "react";
import ListingSkeletonGrid from "./ListingSkeletonGrid";

/* ─────────────────── Loading status messages for public visitors ─────────────────── */
const LOADING_STAGES = [
  { label: 'Connecting to UrbanSetu servers...', icon: '🔗' },
  { label: 'Fetching featured properties...', icon: '🏠' },
  { label: 'Loading exclusive offers...', icon: '💎' },
  { label: 'Preparing rental listings...', icon: '🔑' },
  { label: 'Curating sale properties...', icon: '🏡' },
  { label: 'Loading platform statistics...', icon: '📊' },
  { label: 'Building property showcase...', icon: '🖼️' },
  { label: 'Polishing your experience...', icon: '✨' },
];

/* ─────────────────── Custom shimmer keyframes via inline style tag ─────────── */
const SkeletonStyles = () => (
  <style>{`
    @keyframes phsk-shimmer {
      0%   { background-position: -700px 0; }
      100% { background-position: 700px 0; }
    }
    @keyframes phsk-float {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-6px); }
    }
    @keyframes phsk-progress-glow {
      0%, 100% { box-shadow: 0 0 6px rgba(59,130,246,0.4); }
      50%      { box-shadow: 0 0 20px rgba(59,130,246,0.8); }
    }
    @keyframes phsk-fade-in-up {
      0%   { opacity: 0; transform: translateY(12px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes phsk-status-swap {
      0%   { opacity: 0; transform: translateY(8px); }
      15%  { opacity: 1; transform: translateY(0); }
      85%  { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-8px); }
    }
    @keyframes phsk-pulse-ring {
      0%   { transform: scale(0.8); opacity: 0.6; }
      50%  { transform: scale(1.15); opacity: 0; }
      100% { transform: scale(0.8); opacity: 0; }
    }
    @keyframes phsk-wave {
      0%, 60%, 100% { transform: scaleY(0.4); }
      30%           { transform: scaleY(1); }
    }
    @keyframes phsk-blob {
      0%   { transform: translate(0px, 0px) scale(1); }
      33%  { transform: translate(30px, -50px) scale(1.1); }
      66%  { transform: translate(-20px, 20px) scale(0.9); }
      100% { transform: translate(0px, 0px) scale(1); }
    }
    @keyframes phsk-typewriter-blink {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0; }
    }
    .phsk-shimmer {
      background: linear-gradient(
        90deg,
        rgba(148,163,184,0.06) 0%,
        rgba(148,163,184,0.15) 40%,
        rgba(148,163,184,0.06) 80%
      );
      background-size: 700px 100%;
      animation: phsk-shimmer 1.8s infinite linear;
    }
    .dark .phsk-shimmer {
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

/* ─────────────────── Shimmer Block ─────────────────── */
const Shimmer = ({ className = '', style = {}, delay = 0 }) => (
  <div
    className={`phsk-shimmer rounded-lg ${className}`}
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
        className="w-[3px] h-full bg-gradient-to-t from-blue-500 to-indigo-500 rounded-full"
        style={{
          animation: `phsk-wave 1.2s ${i * 0.12}s infinite ease-in-out`,
        }}
      />
    ))}
  </div>
);

/* ─────────────────── Stat Card Skeleton for public hero ─────────────────── */
const StatCardSkeleton = ({ delay = 0, accentColor = '#3b82f6', label, icon }) => (
  <div
    className="relative bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 dark:border-gray-700/50 overflow-hidden shadow-lg group hover:shadow-xl transition-shadow text-center"
    style={{
      animation: `phsk-fade-in-up 0.6s ${delay}ms both ease-out`,
    }}
  >
    <div className="relative mx-auto mb-3">
      <div
        className="h-12 w-12 rounded-xl flex items-center justify-center text-xl mx-auto"
        style={{
          background: `${accentColor}18`,
          color: accentColor,
          animation: `phsk-float 2.5s ${delay + 200}ms infinite ease-in-out`,
        }}
      >
        {icon}
      </div>
      <div
        className="absolute inset-0 rounded-xl mx-auto w-12"
        style={{
          background: `${accentColor}10`,
          animation: `phsk-pulse-ring 2s ${delay + 200}ms infinite ease-out`,
        }}
      />
    </div>
    <Shimmer className="h-7 w-20 rounded-lg mx-auto mb-2" delay={delay + 100} />
    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">{label}</span>
  </div>
);

/* ─────────────────── Feature Card Skeleton ─────────────────── */
const FeatureCardSkeleton = ({ delay = 0, icon, accentColor = '#3b82f6' }) => (
  <div
    className="flex gap-4 p-4 rounded-xl"
    style={{ animation: `phsk-fade-in-up 0.5s ${delay}ms both ease-out` }}
  >
    <div
      className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-lg"
      style={{
        background: `${accentColor}15`,
        animation: `phsk-float 3s ${delay + 100}ms infinite ease-in-out`,
      }}
    >
      {icon}
    </div>
    <div className="flex-1 space-y-2 pt-1">
      <Shimmer className="h-4 w-28 rounded-lg" delay={delay + 50} />
      <Shimmer className="h-3 w-full max-w-[200px] rounded" delay={delay + 120} />
    </div>
  </div>
);

/* ─────────────────── Step Card Skeleton ─────────────────── */
const StepCardSkeleton = ({ delay = 0, icon, accentColor = '#3b82f6' }) => (
  <div
    className="bg-white/60 dark:bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-gray-100/50 dark:border-gray-700/40 text-center"
    style={{ animation: `phsk-fade-in-up 0.5s ${delay}ms both ease-out` }}
  >
    <div
      className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl"
      style={{
        background: `${accentColor}15`,
        animation: `phsk-float 3s ${delay + 200}ms infinite ease-in-out`,
      }}
    >
      {icon}
    </div>
    <Shimmer className="h-5 w-20 rounded-lg mx-auto mb-2" delay={delay + 100} />
    <Shimmer className="h-3 w-32 rounded mx-auto" delay={delay + 150} />
  </div>
);

export default function PublicHomeSkeleton() {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const progressRef = useRef(null);

  // Simulate loading progress
  useEffect(() => {
    const totalDuration = 10000;
    const intervalMs = 70;
    let elapsed = 0;

    progressRef.current = setInterval(() => {
      elapsed += intervalMs;
      const linear = Math.min(elapsed / totalDuration, 1);
      const eased = 1 - Math.pow(1 - linear, 3);
      const pct = Math.min(Math.round(eased * 97), 97);
      setProgress(pct);

      const newStage = Math.min(
        Math.floor((pct / 100) * LOADING_STAGES.length),
        LOADING_STAGES.length - 1
      );
      setStageIndex(newStage);
    }, intervalMs);

    return () => clearInterval(progressRef.current);
  }, []);

  const stage = LOADING_STAGES[stageIndex];

  return (
    <div className="bg-gray-50 dark:bg-gray-950 min-h-screen relative overflow-hidden font-sans transition-colors duration-500">
      <SkeletonStyles />

      {/* ─── Animated Background Blobs ─── */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div
          className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-300/20 dark:bg-blue-900/15 rounded-full filter blur-3xl"
          style={{ animation: 'phsk-blob 10s infinite' }}
        />
        <div
          className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-300/20 dark:bg-purple-900/15 rounded-full filter blur-3xl"
          style={{ animation: 'phsk-blob 10s 2s infinite' }}
        />
        <div
          className="absolute top-[20%] left-[20%] w-72 h-72 bg-pink-300/20 dark:bg-pink-900/15 rounded-full filter blur-3xl"
          style={{ animation: 'phsk-blob 10s 4s infinite' }}
        />
      </div>

      {/* ─── Top Progress Bar ─── */}
      <div className="sticky top-0 z-50">
        <div className="h-1 bg-gray-200/50 dark:bg-gray-800/50 backdrop-blur-md">
          <div
            className="h-full rounded-r-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)',
              animation: 'phsk-progress-glow 2s infinite',
            }}
          />
        </div>
      </div>

      <div className="relative z-10">

        {/* ─── Hero Section Skeleton ─── */}
        <div className="relative pt-20 pb-16 lg:pt-32 lg:pb-28 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center flex flex-col items-center">

            {/* ─── Loading Status Banner (replaces theme badge) ─── */}
            <div
              className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl px-6 py-4 shadow-xl border border-white/30 dark:border-gray-700/50 mb-8 w-full max-w-2xl"
              style={{ animation: 'phsk-fade-in-up 0.5s both ease-out' }}
            >
              <div className="flex items-center gap-4 justify-center">
                <div className="flex-shrink-0">
                  <div className="p-2.5 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-xl">
                    <WaveLoader />
                  </div>
                </div>

                <div className="text-left min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                      Loading UrbanSetu
                    </span>
                    <span className="text-[10px] font-bold text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-100/50 dark:border-blue-900/10">
                      {progress}%
                    </span>
                  </div>
                  <div className="h-4 overflow-hidden relative">
                    <p
                      key={stageIndex}
                      className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 font-medium truncate"
                      style={{ animation: 'phsk-status-swap 2s both ease-in-out' }}
                    >
                      <span className="text-sm">{stage.icon}</span>
                      <span>{stage.label}</span>
                    </p>
                  </div>
                </div>

                <div className="flex-shrink-0 hidden sm:block">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="16" fill="none" strokeWidth="2.5"
                      className="text-gray-200 dark:text-gray-700" stroke="currentColor" />
                    <circle cx="20" cy="20" r="16" fill="none" strokeWidth="2.5"
                      stroke="url(#blue-grad)"
                      strokeDasharray={`${2 * Math.PI * 16}`}
                      strokeDashoffset={`${2 * Math.PI * 16 * (1 - progress / 100)}`}
                      strokeLinecap="round"
                      className="transition-all duration-300 ease-out"
                      style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                    />
                    <defs>
                      <linearGradient id="blue-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                    <text x="20" y="20" textAnchor="middle" dominantBaseline="central"
                      className="fill-gray-700 dark:fill-gray-200 text-[9px] font-black"
                    >
                      {progress}%
                    </text>
                  </svg>
                </div>
              </div>

              <div className="mt-3 h-1.5 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300 ease-out relative"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)',
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                      backgroundSize: '200% 100%',
                      animation: 'phsk-shimmer 1.2s infinite linear',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Platform Badge Pill */}
            <div
              className="mb-8"
              style={{ animation: 'phsk-fade-in-up 0.5s 100ms both ease-out' }}
            >
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-50/80 dark:bg-blue-900/20 border border-blue-100/50 dark:border-blue-800/30 shadow-sm">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400/75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
                </div>
                <Shimmer className="h-4 w-48" delay={150} />
              </div>
            </div>

            {/* Title Skeleton with typewriter cursor */}
            <div
              className="mb-6 flex flex-col items-center gap-3"
              style={{ animation: 'phsk-fade-in-up 0.6s 200ms both ease-out' }}
            >
              <div className="flex items-center gap-3">
                <Shimmer className="h-12 md:h-16 w-40 md:w-56 rounded-xl" delay={250} />
                <Shimmer className="h-12 md:h-16 w-48 md:w-72 rounded-xl" delay={300} />
                <div
                  className="w-1 h-10 md:h-14 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full"
                  style={{ animation: 'phsk-typewriter-blink 1s infinite' }}
                />
              </div>
            </div>

            {/* Subtitle Lines */}
            <div
              className="space-y-2 mb-10 w-full max-w-2xl"
              style={{ animation: 'phsk-fade-in-up 0.6s 350ms both ease-out' }}
            >
              <Shimmer className="h-5 w-full max-w-lg mx-auto rounded" delay={400} />
              <Shimmer className="h-5 w-3/4 max-w-md mx-auto rounded" delay={450} />
            </div>

            {/* CTA Buttons */}
            <div
              className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full mb-16"
              style={{ animation: 'phsk-fade-in-up 0.6s 500ms both ease-out' }}
            >
              <div className="w-full sm:w-48 h-14 rounded-xl bg-gradient-to-r from-blue-500/20 to-indigo-500/20 dark:from-blue-500/10 dark:to-indigo-500/10 border border-blue-200/30 dark:border-blue-800/20 relative overflow-hidden">
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.1), transparent)',
                    backgroundSize: '200% 100%',
                    animation: 'phsk-shimmer 2s infinite linear',
                  }}
                />
              </div>
              <div className="w-full sm:w-48 h-14 rounded-xl bg-gradient-to-r from-violet-500/20 to-purple-500/20 dark:from-violet-500/10 dark:to-purple-500/10 border border-violet-200/30 dark:border-purple-800/20 relative overflow-hidden">
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.1), transparent)',
                    backgroundSize: '200% 100%',
                    animation: 'phsk-shimmer 2s infinite linear',
                  }}
                />
              </div>
              <div className="w-full sm:w-48 h-14 rounded-xl bg-white/60 dark:bg-gray-800/40 border border-gray-200/50 dark:border-gray-700/30 relative overflow-hidden">
                <div
                  className="absolute inset-0 phsk-shimmer"
                />
              </div>
            </div>

            {/* ─── Educational & Major Project Banner Skeleton ─── */}
            <div
              className="relative w-full max-w-5xl mx-auto overflow-hidden rounded-2xl sm:rounded-3xl p-[2px] bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 mb-12 shadow-lg"
              style={{ animation: 'phsk-fade-in-up 0.6s 550ms both ease-out' }}
            >
              <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-[14px] sm:rounded-[22px] p-4 sm:p-6 md:p-8 text-left">
                {/* Badges row */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Shimmer className="h-6 w-36 rounded-full" delay={550} />
                    <Shimmer className="h-6 w-32 rounded-full" delay={600} />
                    <Shimmer className="h-6 w-28 rounded-full" delay={650} />
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Shimmer className="h-7 w-7 rounded-xl" delay={650} />
                    <Shimmer className="h-7 w-7 rounded-xl" delay={680} />
                  </div>
                </div>

                {/* Header with Sparkle Icon + Title */}
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="hidden sm:flex w-10 h-10 md:w-12 md:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 items-center justify-center shrink-0">
                    <span className="text-xl">✨</span>
                  </div>
                  <div className="flex-1 space-y-3">
                    <Shimmer className="h-6 sm:h-7 w-64 sm:w-96 rounded-lg" delay={600} />
                    <div className="space-y-2">
                      <Shimmer className="h-4 w-full rounded" delay={650} />
                      <Shimmer className="h-4 w-5/6 rounded" delay={700} />
                    </div>

                    {/* Feature chips skeleton */}
                    <div className="pt-1 flex flex-wrap gap-2">
                      <Shimmer className="h-7 w-44 rounded-lg sm:rounded-xl" delay={720} />
                      <Shimmer className="h-7 w-40 rounded-lg sm:rounded-xl" delay={750} />
                      <Shimmer className="h-7 w-36 rounded-lg sm:rounded-xl" delay={780} />
                    </div>

                    {/* Action button skeletons */}
                    <div className="pt-2 flex flex-col sm:flex-row gap-3">
                      <Shimmer className="h-10 w-full sm:w-56 rounded-xl" delay={800} />
                      <Shimmer className="h-10 w-full sm:w-40 rounded-xl" delay={850} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto w-full">
              <StatCardSkeleton label="Properties" icon="🏠" accentColor="#3b82f6" delay={600} />
              <StatCardSkeleton label="Happy Users" icon="👥" accentColor="#10b981" delay={700} />
              <StatCardSkeleton label="Transactions" icon="📈" accentColor="#8b5cf6" delay={800} />
              <StatCardSkeleton label="Satisfaction" icon="⭐" accentColor="#eab308" delay={900} />
            </div>
          </div>
        </div>

        {/* ─── Featured Slider Skeleton ─── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div
            className="flex flex-col items-center mb-8 gap-4 text-center"
            style={{ animation: 'phsk-fade-in-up 0.6s 950ms both ease-out' }}
          >
            <div className="space-y-2">
              <Shimmer className="h-8 w-64 rounded-lg mx-auto" delay={1000} />
              <Shimmer className="h-4 w-52 rounded mx-auto" delay={1050} />
            </div>
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className={`rounded-full transition-all ${i === 0 ? 'w-8 h-2 bg-blue-400/50' : 'w-2 h-2 bg-gray-300 dark:bg-gray-600'}`}
                  style={{ animation: `phsk-fade-in-up 0.3s ${1100 + i * 60}ms both ease-out` }}
                />
              ))}
            </div>
          </div>

          <div
            className="rounded-3xl overflow-hidden shadow-2xl bg-gray-200 dark:bg-gray-800 h-[400px] md:h-[500px] lg:h-[600px] w-full relative"
            style={{ animation: 'phsk-fade-in-up 0.7s 1100ms both ease-out' }}
          >
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent z-10" />

            {/* Content overlays at bottom */}
            <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 z-20">
              <div className="max-w-3xl space-y-4">
                <div className="flex gap-3">
                  <div className="w-24 h-7 bg-blue-500/20 backdrop-blur-sm rounded-full border border-white/10" />
                  <div className="w-32 h-7 bg-white/10 backdrop-blur-sm rounded-full border border-white/10" />
                </div>
                <Shimmer className="h-10 md:h-12 w-3/4 rounded-lg" delay={1200} style={{ opacity: 0.4 }} />
                <Shimmer className="h-5 w-36 rounded" delay={1250} style={{ opacity: 0.3 }} />
              </div>
            </div>

            {/* Shimmer across entire slider */}
            <div className="absolute inset-0 phsk-shimmer" />
          </div>
        </div>

        {/* ─── Listing Sections Skeleton ─── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20 py-16">

          {/* Section 1: Exclusive Offers */}
          <section style={{ animation: 'phsk-fade-in-up 0.6s 1300ms both ease-out' }}>
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <span
                  className="p-2 bg-orange-500/10 text-orange-500 rounded-lg text-lg"
                  style={{ animation: 'phsk-float 3s infinite ease-in-out' }}
                >
                  💎
                </span>
                <Shimmer className="h-7 w-44 rounded-lg" delay={1350} />
              </div>
              <Shimmer className="h-5 w-24 rounded" delay={1400} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <ListingSkeletonGrid count={4} />
            </div>
          </section>

          {/* Section 2: Homes for Rent */}
          <section style={{ animation: 'phsk-fade-in-up 0.6s 1450ms both ease-out' }}>
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <span
                  className="p-2 bg-green-500/10 text-green-500 rounded-lg text-lg"
                  style={{ animation: 'phsk-float 3s 200ms infinite ease-in-out' }}
                >
                  🏠
                </span>
                <Shimmer className="h-7 w-40 rounded-lg" delay={1500} />
              </div>
              <Shimmer className="h-5 w-24 rounded" delay={1550} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <ListingSkeletonGrid count={4} />
            </div>
          </section>

          {/* Section 3: Homes for Sale */}
          <section style={{ animation: 'phsk-fade-in-up 0.6s 1600ms both ease-out' }}>
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <span
                  className="p-2 bg-purple-500/10 text-purple-500 rounded-lg text-lg"
                  style={{ animation: 'phsk-float 3s 400ms infinite ease-in-out' }}
                >
                  🏡
                </span>
                <Shimmer className="h-7 w-40 rounded-lg" delay={1650} />
              </div>
              <Shimmer className="h-5 w-24 rounded" delay={1700} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <ListingSkeletonGrid count={4} />
            </div>
          </section>

          {/* ─── How It Works Skeleton ─── */}
          <section style={{ animation: 'phsk-fade-in-up 0.6s 1750ms both ease-out' }}>
            <div className="text-center mb-12">
              <Shimmer className="h-9 w-48 rounded-lg mx-auto mb-3" delay={1800} />
              <Shimmer className="h-4 w-72 rounded mx-auto" delay={1850} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <StepCardSkeleton icon="🔍" accentColor="#3b82f6" delay={1900} />
              <StepCardSkeleton icon="❤️" accentColor="#10b981" delay={1980} />
              <StepCardSkeleton icon="📞" accentColor="#8b5cf6" delay={2060} />
              <StepCardSkeleton icon="🤝" accentColor="#f97316" delay={2140} />
            </div>
          </section>

          {/* ─── Why Choose Us Skeleton ─── */}
          <section
            className="bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-3xl shadow-xl border border-gray-100/50 dark:border-gray-700/40 p-8 md:p-12 relative overflow-hidden"
            style={{ animation: 'phsk-fade-in-up 0.6s 2000ms both ease-out' }}
          >
            {/* Decorative gradient blob */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-900/5 dark:to-purple-900/5 rounded-bl-full -mr-20 -mt-20 opacity-50 pointer-events-none" />

            <div className="text-center mb-12 relative z-10">
              <Shimmer className="h-9 w-56 rounded-lg mx-auto mb-3" delay={2050} />
              <Shimmer className="h-4 w-80 rounded mx-auto" delay={2100} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
              {[
                { icon: '🔍', color: '#3b82f6' },
                { icon: '🛡️', color: '#10b981' },
                { icon: '🚀', color: '#8b5cf6' },
                { icon: '❤️', color: '#ef4444' },
                { icon: '🖥️', color: '#6366f1' },
                { icon: '💎', color: '#f59e0b' },
              ].map((item, i) => (
                <FeatureCardSkeleton
                  key={i}
                  icon={item.icon}
                  accentColor={item.color}
                  delay={2150 + i * 80}
                />
              ))}
            </div>
          </section>

          {/* ─── Multi-Platform Access Skeleton ─── */}
          <section style={{ animation: 'phsk-fade-in-up 0.6s 2500ms both ease-out' }}>
            <div className="text-center mb-12">
              <Shimmer className="h-8 w-52 rounded-lg mx-auto mb-3" delay={2550} />
              <Shimmer className="h-4 w-72 rounded mx-auto" delay={2600} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { icon: '🖥️', label: 'Desktop' },
                { icon: '📱', label: 'Mobile' },
                { icon: '📟', label: 'Tablet' },
              ].map((device, i) => (
                <div
                  key={i}
                  className="bg-white/60 dark:bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-gray-100/50 dark:border-gray-700/40 flex flex-col items-center"
                  style={{ animation: `phsk-fade-in-up 0.5s ${2650 + i * 100}ms both ease-out` }}
                >
                  <div
                    className="w-14 h-14 bg-gray-100/80 dark:bg-gray-700/50 rounded-2xl flex items-center justify-center mb-3 text-2xl"
                    style={{ animation: `phsk-float 3s ${i * 300}ms infinite ease-in-out` }}
                  >
                    {device.icon}
                  </div>
                  <Shimmer className="h-4 w-20 rounded-lg mb-1" delay={2700 + i * 100} />
                  <Shimmer className="h-3 w-36 rounded" delay={2750 + i * 100} />
                </div>
              ))}
            </div>
          </section>

          {/* ─── Testimonials Skeleton ─── */}
          <section style={{ animation: 'phsk-fade-in-up 0.6s 2900ms both ease-out' }}>
            <div className="text-center mb-12">
              <Shimmer className="h-8 w-56 rounded-lg mx-auto mb-3" delay={2950} />
              <Shimmer className="h-4 w-64 rounded mx-auto" delay={3000} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { accent: '#3b82f6' },
                { accent: '#10b981' },
                { accent: '#8b5cf6' },
              ].map((t, i) => (
                <div
                  key={i}
                  className="bg-white/60 dark:bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-gray-100/50 dark:border-gray-700/40"
                  style={{ animation: `phsk-fade-in-up 0.5s ${3050 + i * 120}ms both ease-out` }}
                >
                  {/* Quote icon placeholder */}
                  <div
                    className="text-3xl mb-4 opacity-20"
                    style={{ color: t.accent }}
                  >
                    ❝
                  </div>
                  {/* Quote text */}
                  <div className="space-y-2 mb-6">
                    <Shimmer className="h-3.5 w-full rounded" delay={3100 + i * 120} />
                    <Shimmer className="h-3.5 w-5/6 rounded" delay={3150 + i * 120} />
                  </div>
                  {/* Star rating */}
                  <div className="flex gap-1 mb-6">
                    {[0, 1, 2, 3, 4].map(s => (
                      <div
                        key={s}
                        className="w-3.5 h-3.5 rounded-sm bg-yellow-300/40 dark:bg-yellow-600/20"
                        style={{ animation: `phsk-fade-in-up 0.3s ${3200 + i * 120 + s * 50}ms both ease-out` }}
                      />
                    ))}
                  </div>
                  {/* Author */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full"
                      style={{
                        background: `${t.accent}20`,
                        animation: `phsk-float 3s ${i * 500}ms infinite ease-in-out`,
                      }}
                    />
                    <div className="space-y-1.5">
                      <Shimmer className="h-3.5 w-24 rounded" delay={3250 + i * 120} />
                      <Shimmer className="h-2.5 w-16 rounded" delay={3300 + i * 120} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ─── CTA Section Skeleton ─── */}
          <section
            className="relative rounded-3xl overflow-hidden shadow-2xl"
            style={{ animation: 'phsk-fade-in-up 0.6s 3400ms both ease-out' }}
          >
            <div className="bg-gradient-to-r from-blue-700/80 to-indigo-800/80 dark:from-blue-900/80 dark:to-indigo-950/80 px-8 py-16 md:py-24 relative">
              {/* Background texture */}
              <div className="absolute inset-0 phsk-shimmer opacity-10" />

              <div className="relative z-10 text-center max-w-4xl mx-auto space-y-6">
                <Shimmer className="h-10 md:h-12 w-3/4 max-w-md rounded-xl mx-auto" delay={3450} style={{ opacity: 0.25 }} />
                <Shimmer className="h-5 w-full max-w-lg rounded mx-auto" delay={3500} style={{ opacity: 0.2 }} />
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                  <div className="w-full sm:w-40 h-14 bg-white/15 rounded-xl border border-white/10" />
                  <div className="w-full sm:w-44 h-14 bg-transparent rounded-xl border-2 border-white/20" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ─── Bottom Floating Support & AI Skeletons ─── */}
      <div
        className="fixed inset-0 pointer-events-none z-50"
        style={{
          animation: 'phsk-fade-in-up 0.8s 1200ms both cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Gemini AI Shadow */}
        <div className="absolute bottom-20 right-6 w-12 h-12 rounded-full phsk-shimmer shadow-lg border border-gray-200/30 dark:border-gray-700/30 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm pointer-events-auto" />
        {/* Contact Support Shadow */}
        <div className="absolute bottom-6 right-6 w-12 h-12 rounded-full phsk-shimmer shadow-lg border border-gray-200/30 dark:border-gray-700/30 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm pointer-events-auto" />
      </div>
    </div>
  );
}
