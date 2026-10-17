import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FaShieldAlt, 
  FaLock, 
  FaCalendarAlt, 
  FaFileContract, 
  FaCreditCard, 
  FaMapMarkerAlt, 
  FaCheckCircle, 
  FaCoins 
} from 'react-icons/fa';

/* ─────────────────── Loading status stages for Rental Agreement ─────────────────── */
const LOADING_STAGES = [
  { label: 'Connecting to UrbanSetu rental escrow gateway...', icon: '🔐' },
  { label: 'Loading property rental terms & monthly valuation...', icon: '🏠' },
  { label: 'Verifying landlord active rental status & lease rules...', icon: '📄' },
  { label: 'Calculating Rent-Lock™ price freeze options...', icon: '🛡️' },
  { label: 'Computing deposit flexibility plans (Standard, Low, Zero)...', icon: '💳' },
  { label: 'Fetching digital agreement template & legal clauses...', icon: '✍️' },
  { label: 'Auditing tenant trust score & deposit waiver eligibility...', icon: '⭐' },
  { label: 'Finalizing rental contract application workspace...', icon: '✨' },
];

/* ─────────────────── Custom shimmer & animation keyframes ─────────────────── */
const SkeletonStyles = () => (
  <style>{`
    @keyframes rpsk-shimmer {
      0%   { background-position: -700px 0; }
      100% { background-position: 700px 0; }
    }
    @keyframes rpsk-float {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-5px); }
    }
    @keyframes rpsk-progress-glow {
      0%, 100% { box-shadow: 0 0 6px rgba(59, 130, 246, 0.4); }
      50%      { box-shadow: 0 0 20px rgba(168, 85, 247, 0.7); }
    }
    @keyframes rpsk-fade-in-up {
      0%   { opacity: 0; transform: translateY(14px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes rpsk-status-swap {
      0%   { opacity: 0; transform: translateY(8px); }
      15%  { opacity: 1; transform: translateY(0); }
      85%  { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-8px); }
    }
    @keyframes rpsk-pulse-ring {
      0%   { transform: scale(0.85); opacity: 0.6; }
      50%  { transform: scale(1.18); opacity: 0; }
      100% { transform: scale(0.85); opacity: 0; }
    }
    @keyframes rpsk-wave {
      0%, 60%, 100% { transform: scaleY(0.4); }
      30%           { transform: scaleY(1); }
    }
    .rpsk-shimmer {
      background: linear-gradient(
        90deg,
        rgba(148,163,184,0.08) 0%,
        rgba(148,163,184,0.22) 40%,
        rgba(148,163,184,0.08) 80%
      );
      background-size: 700px 100%;
      animation: rpsk-shimmer 1.8s infinite linear;
    }
    .dark .rpsk-shimmer {
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
    className={`rpsk-shimmer rounded-lg ${className}`}
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
        className="w-[3px] h-full bg-gradient-to-t from-blue-600 via-indigo-600 to-purple-600 rounded-full"
        style={{
          animation: `rpsk-wave 1.2s ${i * 0.12}s infinite ease-in-out`,
        }}
      />
    ))}
  </div>
);

export default function RentPropertySkeleton({ isDarkMode: propIsDarkMode }) {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const progressRef = useRef(null);

  // Auto-detect dark mode
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
    <div className={`bg-gradient-to-br from-blue-50/50 via-purple-50/20 to-indigo-50/40 dark:from-gray-900 dark:to-gray-800 min-h-screen py-10 px-4 md:px-8 font-sans transition-colors duration-500 relative overflow-hidden ${isDark ? 'dark' : ''}`}>
      <SkeletonStyles />

      {/* ─── Top Sticky Gradient Progress Bar ─── */}
      <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="h-1 bg-gray-200/50 dark:bg-gray-800/50 backdrop-blur-md">
          <div
            className="h-full rounded-r-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6, #ec4899)',
              animation: 'rpsk-progress-glow 2s infinite',
            }}
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">

        {/* ─── Modern Loading Descriptor Banner ─── */}
        <div
          className="bg-white/80 dark:bg-gray-850/80 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-xl border border-blue-100/80 dark:border-gray-700/60"
          style={{ animation: 'rpsk-fade-in-up 0.5s both ease-out' }}
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
                  Configuring Rent-Lock™ Agreement
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
                  style={{ animation: 'rpsk-status-swap 2s both ease-in-out' }}
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
                  stroke="url(#rent-grad)"
                  strokeDasharray={`${2 * Math.PI * 20}`}
                  strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-300 ease-out"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                />
                <defs>
                  <linearGradient id="rent-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" />
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
          <div className="mt-3.5 h-1.5 bg-gray-100 dark:bg-gray-750 rounded-full overflow-hidden">
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
                  animation: 'rpsk-shimmer 1.2s infinite linear',
                }}
              />
            </div>
          </div>
        </div>

        {/* ─── Property Summary Header Skeleton ─── */}
        <div 
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-xl p-5 sm:p-6 flex flex-col sm:flex-row gap-5 items-center border border-gray-100 dark:border-gray-700/60"
          style={{ animation: 'rpsk-fade-in-up 0.6s 150ms both ease-out' }}
        >
          {/* Property Image Skeleton */}
          <div className="w-full sm:w-36 h-40 sm:h-32 rounded-xl bg-gray-200 dark:bg-gray-700 rpsk-shimmer relative overflow-hidden shrink-0 shadow-sm">
            <span className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold uppercase rounded shadow-sm">
              Available
            </span>
          </div>

          {/* Property Details */}
          <div className="flex-1 space-y-2 text-center sm:text-left w-full">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                Verified Rental
              </span>
            </div>
            <Shimmer className="h-7 w-4/5 rounded-lg mx-auto sm:mx-0" delay={200} />
            <div className="flex items-center gap-2 justify-center sm:justify-start text-xs text-gray-500 dark:text-gray-400">
              <FaMapMarkerAlt className="text-red-500 shrink-0" />
              <Shimmer className="h-3.5 w-48 rounded" delay={240} />
            </div>
            <div className="pt-1 flex items-baseline gap-2 justify-center sm:justify-start">
              <Shimmer className="h-6 w-28 rounded-md" delay={280} />
              <span className="text-xs text-gray-400">/ month</span>
            </div>
          </div>
        </div>

        {/* ─── Step 1: Rent-Lock™ Plan Selection Skeleton (3 Cards) ─── */}
        <div 
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-xl p-6 sm:p-8 border border-blue-50 dark:border-gray-700/60 space-y-6"
          style={{ animation: 'rpsk-fade-in-up 0.6s 200ms both ease-out' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FaLock className="text-blue-500 text-sm" /> Select Rent-Lock™ Protection Plan
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Lock your monthly rental price and protect against sudden hikes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: '1-Year Lock', tag: 'Standard Protection', color: 'blue' },
              { title: '3-Year Lock', tag: 'Most Popular', color: 'purple' },
              { title: '5-Year Lock', tag: 'Maximum Security', color: 'indigo' },
            ].map((plan, i) => (
              <div
                key={i}
                className={`p-5 rounded-xl border-2 border-gray-200/70 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-750/50 space-y-3 relative overflow-hidden`}
              >
                <div className="flex justify-between items-start">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                    {plan.tag}
                  </span>
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                </div>
                <Shimmer className="h-6 w-28 rounded-lg" delay={300 + i * 80} />
                <Shimmer className="h-3.5 w-full rounded" delay={340 + i * 80} />
                <Shimmer className="h-3.5 w-3/4 rounded" delay={380 + i * 80} />
              </div>
            ))}
          </div>

          {/* ─── Deposit Flexibility Options (3 Cards) ─── */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700/60 space-y-4">
            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <FaCreditCard className="text-emerald-500 text-sm" /> Deposit Flexibility Plan
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border border-gray-200/70 dark:border-gray-700 bg-white dark:bg-gray-800/80 space-y-2.5"
                >
                  <Shimmer className="h-5 w-32 rounded-lg" delay={400 + i * 60} />
                  <Shimmer className="h-4 w-20 rounded" delay={430 + i * 60} />
                  <Shimmer className="h-3 w-full rounded" delay={460 + i * 60} />
                </div>
              ))}
            </div>
          </div>

          {/* ─── Move-In Date and Lease Details ─── */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700/60 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <FaCalendarAlt className="text-blue-500" /> Preferred Move-In Date
              </span>
              <div className="h-11 w-full bg-gray-50 dark:bg-gray-700/60 rounded-xl border border-gray-200 dark:border-gray-600 px-3 flex items-center">
                <Shimmer className="h-4 w-32 rounded" delay={480} />
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <FaFileContract className="text-purple-500" /> Tenant Notice & Message
              </span>
              <div className="h-11 w-full bg-gray-50 dark:bg-gray-700/60 rounded-xl border border-gray-200 dark:border-gray-600 px-3 flex items-center">
                <Shimmer className="h-4 w-44 rounded" delay={520} />
              </div>
            </div>
          </div>

          {/* ─── Financial Escrow Summary Card ─── */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50/70 to-purple-50/70 dark:from-gray-750 dark:to-gray-800 border border-blue-100 dark:border-gray-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Payment Breakdown & Escrow Total
              </span>
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <FaShieldAlt /> 100% Escrow Protected
              </span>
            </div>

            <div className="space-y-2 pt-1 border-t border-gray-200/60 dark:border-gray-700">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-600 dark:text-gray-400">First Month Rent</span>
                <Shimmer className="h-3.5 w-20 rounded" delay={540} />
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-600 dark:text-gray-400">Security Deposit</span>
                <Shimmer className="h-3.5 w-24 rounded" delay={570} />
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-600 dark:text-gray-400">Escrow & Documentation Fee</span>
                <Shimmer className="h-3.5 w-16 rounded" delay={600} />
              </div>
              <div className="flex justify-between items-center text-sm font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-900 dark:text-white">Total Amount Due</span>
                <Shimmer className="h-5 w-28 rounded-lg" delay={630} />
              </div>
            </div>
          </div>

          {/* ─── Submit Action CTA ─── */}
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <FaCheckCircle className="text-emerald-500" />
              <span>Instant agreement generation with digital signatures</span>
            </div>
            <div className="w-full sm:w-64 h-12 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25">
              <FaFileContract />
              <Shimmer className="h-4 w-32 rounded bg-white/40" delay={650} />
            </div>
          </div>

        </div>

      </div>

      {/* ─── Floating Bottom AI & Support Shadows ─── */}
      <div 
        className="fixed inset-0 pointer-events-none z-40"
        style={{
          animation: 'rpsk-fade-in-up 0.8s 800ms both cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <div className="absolute bottom-20 right-6 w-12 h-12 rounded-full rpsk-shimmer shadow-xl border border-white/20 dark:border-gray-700/50 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm pointer-events-auto flex items-center justify-center text-indigo-500 text-lg">
          ✨
        </div>
        <div className="absolute bottom-6 right-6 w-12 h-12 rounded-full rpsk-shimmer shadow-xl border border-white/20 dark:border-gray-700/50 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm pointer-events-auto flex items-center justify-center text-blue-500 text-lg">
          💬
        </div>
      </div>

    </div>
  );
}
