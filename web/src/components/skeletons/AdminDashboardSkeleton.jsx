import React, { useState, useEffect, useRef } from 'react';

/* ─────────────────── Loading status messages ─────────────────── */
const LOADING_STAGES = [
  { label: 'Connecting to server...', icon: '🔗' },
  { label: 'Loading user analytics...', icon: '👥' },
  { label: 'Fetching property listings...', icon: '🏠' },
  { label: 'Processing review data...', icon: '⭐' },
  { label: 'Analyzing market trends...', icon: '📈' },
  { label: 'Compiling security stats...', icon: '🛡️' },
  { label: 'Loading visitor insights...', icon: '👁️' },
  { label: 'Generating dashboard...', icon: '✨' },
];

/* ─────────────────── Custom shimmer keyframes via inline style tag ─────────── */
const SkeletonStyles = () => (
  <style>{`
    @keyframes adsk-shimmer {
      0%   { background-position: -700px 0; }
      100% { background-position: 700px 0; }
    }
    @keyframes adsk-grow {
      0%   { transform: scaleY(0.15); opacity: 0.3; }
      60%  { transform: scaleY(1); opacity: 1; }
      100% { transform: scaleY(1); opacity: 1; }
    }
    @keyframes adsk-donut-fill {
      0%   { stroke-dashoffset: 251; }
      100% { stroke-dashoffset: var(--target-offset, 80); }
    }
    @keyframes adsk-float {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-6px); }
    }
    @keyframes adsk-progress-glow {
      0%, 100% { box-shadow: 0 0 6px rgba(99,102,241,0.4); }
      50%      { box-shadow: 0 0 20px rgba(99,102,241,0.8); }
    }
    @keyframes adsk-fade-in-up {
      0%   { opacity: 0; transform: translateY(12px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes adsk-status-swap {
      0%   { opacity: 0; transform: translateY(8px); }
      15%  { opacity: 1; transform: translateY(0); }
      85%  { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-8px); }
    }
    @keyframes adsk-pulse-ring {
      0%   { transform: scale(0.8); opacity: 0.6; }
      50%  { transform: scale(1.15); opacity: 0; }
      100% { transform: scale(0.8); opacity: 0; }
    }
    @keyframes adsk-wave {
      0%, 60%, 100% { transform: scaleY(0.4); }
      30%           { transform: scaleY(1); }
    }
    .adsk-shimmer {
      background: linear-gradient(
        90deg,
        rgba(148,163,184,0.06) 0%,
        rgba(148,163,184,0.15) 40%,
        rgba(148,163,184,0.06) 80%
      );
      background-size: 700px 100%;
      animation: adsk-shimmer 1.8s infinite linear;
    }
    .dark .adsk-shimmer {
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
    className={`adsk-shimmer rounded-lg ${className}`}
    style={{
      animationDelay: `${delay}ms`,
      ...style,
    }}
  />
);

/* ─────────────────── Stat Card Skeleton (with staggered fade-in) ────────── */
const StatCardSkeleton = ({ delay = 0, accentColor = '#6366f1' }) => (
  <div
    className="relative bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-200/50 dark:border-gray-700/50 overflow-hidden"
    style={{
      animation: `adsk-fade-in-up 0.6s ${delay}ms both ease-out`,
    }}
  >
    {/* Accent top bar */}
    <div
      className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
      style={{ background: `linear-gradient(90deg, ${accentColor}44, ${accentColor}aa, ${accentColor}44)` }}
    />

    <div className="flex justify-between items-start mb-3">
      <div className="space-y-2 flex-1">
        <Shimmer className="h-3 w-20" delay={delay + 100} style={{ borderRadius: '6px' }} />
        <Shimmer className="h-7 w-28" delay={delay + 200} style={{ borderRadius: '8px' }} />
      </div>
      {/* Pulsing icon placeholder */}
      <div className="relative">
        <div
          className="h-10 w-10 rounded-xl"
          style={{
            background: `${accentColor}22`,
            animation: `adsk-float 2.5s ${delay + 300}ms infinite ease-in-out`,
          }}
        />
        <div
          className="absolute inset-0 rounded-xl"
          style={{
            background: `${accentColor}15`,
            animation: `adsk-pulse-ring 2s ${delay + 300}ms infinite ease-out`,
          }}
        />
      </div>
    </div>
    <Shimmer className="h-2.5 w-2/3" delay={delay + 350} style={{ borderRadius: '4px' }} />
  </div>
);

/* ─────────────────── Animated Bar Chart Skeleton ─────────────────── */
const BarChartSkeleton = ({ delay = 0 }) => {
  const barHeights = [65, 85, 45, 95, 55, 75, 40, 90, 60, 50];
  return (
    <div
      className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50"
      style={{ animation: `adsk-fade-in-up 0.6s ${delay}ms both ease-out` }}
    >
      <Shimmer className="h-5 w-36 mb-2" delay={delay + 100} />
      <Shimmer className="h-3 w-56 mb-6" delay={delay + 150} />

      {/* Bar chart */}
      <div className="flex items-end gap-2 h-36 px-2">
        {barHeights.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md bg-gradient-to-t from-indigo-500/30 to-purple-400/10 dark:from-indigo-400/25 dark:to-purple-500/5"
            style={{
              height: `${h}%`,
              transformOrigin: 'bottom',
              animation: `adsk-grow 1.2s ${delay + 300 + i * 100}ms both ease-out`,
            }}
          />
        ))}
      </div>
      {/* X-axis labels */}
      <div className="flex gap-2 mt-2 px-2">
        {barHeights.map((_, i) => (
          <Shimmer key={i} className="flex-1 h-2" delay={delay + 400 + i * 60} />
        ))}
      </div>
    </div>
  );
};

/* ─────────────────── Animated Donut Chart Skeleton ─────────────────── */
const DonutChartSkeleton = ({ delay = 0 }) => (
  <div
    className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50"
    style={{ animation: `adsk-fade-in-up 0.6s ${delay}ms both ease-out` }}
  >
    <Shimmer className="h-5 w-32 mb-6" delay={delay + 100} />
    <div className="flex items-center justify-center">
      <svg width="120" height="120" viewBox="0 0 100 100" className="transform -rotate-90">
        {/* Background ring */}
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8"
          className="text-gray-200 dark:text-gray-700" />
        {/* Animated segment 1 */}
        <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8"
          className="text-indigo-400/50"
          stroke="currentColor"
          strokeDasharray="251"
          style={{ '--target-offset': '100', strokeDashoffset: '251', animation: `adsk-donut-fill 1.5s ${delay + 400}ms forwards ease-out` }}
          strokeLinecap="round" />
        {/* Animated segment 2 */}
        <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8"
          className="text-purple-400/50"
          stroke="currentColor"
          strokeDasharray="251"
          style={{ '--target-offset': '170', strokeDashoffset: '251', animation: `adsk-donut-fill 1.8s ${delay + 600}ms forwards ease-out` }}
          strokeLinecap="round" />
        {/* Animated segment 3 */}
        <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8"
          className="text-pink-400/40"
          stroke="currentColor"
          strokeDasharray="251"
          style={{ '--target-offset': '210', strokeDashoffset: '251', animation: `adsk-donut-fill 2s ${delay + 800}ms forwards ease-out` }}
          strokeLinecap="round" />
      </svg>
    </div>
    {/* Legend */}
    <div className="mt-5 space-y-2">
      {[{ w: '60%', c: 'bg-indigo-400/30' }, { w: '45%', c: 'bg-purple-400/30' }, { w: '35%', c: 'bg-pink-400/30' }].map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${item.c}`} />
          <Shimmer className="h-3" delay={delay + 900 + i * 80} style={{ width: item.w }} />
        </div>
      ))}
    </div>
  </div>
);

/* ─────────────────── Audio-wave loading indicator ─────────────────── */
const WaveLoader = () => (
  <div className="flex items-center gap-[3px] h-5">
    {[0, 1, 2, 3, 4].map(i => (
      <div
        key={i}
        className="w-[3px] h-full bg-gradient-to-t from-indigo-500 to-purple-400 rounded-full"
        style={{
          animation: `adsk-wave 1.2s ${i * 0.12}s infinite ease-in-out`,
        }}
      />
    ))}
  </div>
);

/* ─────────────────── List/Table Skeleton ─────────────────── */
const ListSkeleton = ({ rows = 4, delay = 0 }) => (
  <div
    className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50"
    style={{ animation: `adsk-fade-in-up 0.6s ${delay}ms both ease-out` }}
  >
    <Shimmer className="h-5 w-40 mb-5" delay={delay + 100} />
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-gray-700/20"
          style={{ animation: `adsk-fade-in-up 0.4s ${delay + 200 + i * 100}ms both ease-out` }}
        >
          <div className="h-9 w-9 rounded-lg adsk-shimmer flex-shrink-0" style={{ animationDelay: `${delay + 250 + i * 100}ms` }} />
          <div className="flex-1 space-y-1.5">
            <Shimmer className="h-3 w-3/4" delay={delay + 300 + i * 100} />
            <Shimmer className="h-2.5 w-1/2" delay={delay + 350 + i * 100} />
          </div>
          <Shimmer className="h-6 w-14 rounded-full" delay={delay + 400 + i * 100} />
        </div>
      ))}
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════
   MAIN SKELETON COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */
export default function AdminDashboardSkeleton() {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const progressRef = useRef(null);

  // Simulate loading progress
  useEffect(() => {
    const totalDuration = 12000; // 12 s total simulated time
    const intervalMs = 80;
    let elapsed = 0;

    progressRef.current = setInterval(() => {
      elapsed += intervalMs;
      // Ease-out curve: fast start, slow finish
      const linear = Math.min(elapsed / totalDuration, 1);
      const eased = 1 - Math.pow(1 - linear, 3);
      const pct = Math.min(Math.round(eased * 97), 97); // Cap at 97 — real data will close it
      setProgress(pct);

      // Advance stage based on progress thresholds
      const newStage = Math.min(
        Math.floor((pct / 100) * LOADING_STAGES.length),
        LOADING_STAGES.length - 1
      );
      setStageIndex(newStage);
    }, intervalMs);

    return () => clearInterval(progressRef.current);
  }, []);

  const stage = LOADING_STAGES[stageIndex];

  const accentColors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-indigo-950/20 dark:to-purple-950/20 min-h-screen pb-12 transition-colors duration-500 relative overflow-hidden">
      <SkeletonStyles />

      {/* ─── Top Progress & Status Bar ─── */}
      <div className="sticky top-0 z-50">
        {/* Thin progress bar */}
        <div className="h-1 bg-gray-200/50 dark:bg-gray-800/50 backdrop-blur-md">
          <div
            className="h-full rounded-r-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899)',
              animation: 'adsk-progress-glow 2s infinite',
            }}
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* ─── Loading Status Banner ─── */}
        <div
          className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl p-5 sm:p-6 shadow-xl border border-white/30 dark:border-gray-700/50 mb-8"
          style={{ animation: 'adsk-fade-in-up 0.5s both ease-out' }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            {/* Wave loader */}
            <div className="flex-shrink-0">
              <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl">
                <WaveLoader />
              </div>
            </div>

            {/* Status text & progress */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-1.5">
                <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Loading Dashboard
                </span>
                <span className="text-sm font-semibold text-indigo-500 dark:text-indigo-400 tabular-nums">
                  {progress}%
                </span>
              </div>

              {/* Rotating status message */}
              <div className="h-5 overflow-hidden relative">
                <p
                  key={stageIndex}
                  className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5 justify-center sm:justify-start"
                  style={{ animation: 'adsk-status-swap 2s both ease-in-out' }}
                >
                  <span>{stage.icon}</span>
                  <span>{stage.label}</span>
                </p>
              </div>
            </div>

            {/* Circular progress */}
            <div className="flex-shrink-0 hidden sm:block">
              <svg width="56" height="56" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" strokeWidth="4"
                  className="text-gray-200 dark:text-gray-700" stroke="currentColor" />
                <circle cx="28" cy="28" r="24" fill="none" strokeWidth="4"
                  stroke="url(#progress-grad)"
                  strokeDasharray={`${2 * Math.PI * 24}`}
                  strokeDashoffset={`${2 * Math.PI * 24 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-300 ease-out"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                />
                <defs>
                  <linearGradient id="progress-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                <text x="28" y="28" textAnchor="middle" dominantBaseline="central"
                  className="fill-gray-700 dark:fill-gray-200 text-[11px] font-bold"
                >
                  {progress}%
                </text>
              </svg>
            </div>
          </div>

          {/* Full-width progress bar */}
          <div className="mt-4 h-2 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out relative"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7, #ec4899)',
              }}
            >
              {/* Moving shine */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'adsk-shimmer 1.2s infinite linear',
                }}
              />
            </div>
          </div>

          {/* Mini stage dots */}
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {LOADING_STAGES.map((s, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i <= stageIndex
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 w-4'
                    : 'bg-gray-300 dark:bg-gray-600 w-1.5'
                }`}
                title={s.label}
              />
            ))}
          </div>
        </div>

        {/* ─── Header Skeleton ─── */}
        <div
          className="relative overflow-hidden bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-3xl shadow-lg border border-white/20 dark:border-gray-700/50 mb-10"
          style={{ animation: 'adsk-fade-in-up 0.6s 200ms both ease-out' }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5" />
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between p-6 lg:p-10 gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="h-12 w-12 rounded-xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20"
                  style={{ animation: 'adsk-float 3s infinite ease-in-out' }}
                />
                <div className="space-y-2">
                  <Shimmer className="h-8 w-56" delay={300} />
                  <Shimmer className="h-4 w-40" delay={400} />
                </div>
              </div>
              <Shimmer className="h-4 w-full max-w-lg" delay={500} />
            </div>
            <div className="flex gap-3">
              <Shimmer className="h-11 w-32 rounded-xl" delay={600} />
              <Shimmer className="h-11 w-28 rounded-xl" delay={700} />
            </div>
          </div>
        </div>

        {/* ─── Analytics Title ─── */}
        <div className="flex justify-center mb-10" style={{ animation: 'adsk-fade-in-up 0.6s 400ms both ease-out' }}>
          <div className="text-center space-y-3">
            <Shimmer className="h-9 w-52 mx-auto rounded-lg" delay={500} />
            <Shimmer className="h-3.5 w-80 mx-auto rounded" delay={600} />
          </div>
        </div>

        {/* ─── Critical Operations (Stat Cards Grid) ─── */}
        <div className="mb-10">
          <Shimmer className="h-6 w-44 mb-5 rounded-lg" delay={600} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {accentColors.slice(0, 4).map((color, i) => (
              <StatCardSkeleton key={i} delay={700 + i * 120} accentColor={color} />
            ))}
          </div>
        </div>

        {/* ─── Secondary Stat Cards ─── */}
        <div className="mb-10">
          <Shimmer className="h-6 w-36 mb-5 rounded-lg" delay={1200} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {accentColors.slice(4, 8).map((color, i) => (
              <StatCardSkeleton key={i} delay={1300 + i * 120} accentColor={color} />
            ))}
          </div>
        </div>

        {/* ─── Charts Row ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-2">
            <BarChartSkeleton delay={1700} />
          </div>
          <div className="lg:col-span-1">
            <DonutChartSkeleton delay={1900} />
          </div>
        </div>

        {/* ─── Lists / Tables Row ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          <ListSkeleton rows={5} delay={2100} />
          <ListSkeleton rows={4} delay={2300} />
        </div>

        {/* ─── Bottom Charts Row ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BarChartSkeleton delay={2500} />
          <DonutChartSkeleton delay={2700} />
        </div>
      </div>
    </div>
  );
}
