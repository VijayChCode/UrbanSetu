import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  FaArchive, 
  FaCommentDots, 
  FaCreditCard, 
  FaFlag, 
  FaSearch, 
  FaSync, 
  FaShieldAlt, 
  FaUserShield,
  FaUndo
} from 'react-icons/fa';

/* ─────────────────── Loading status stages for Admin Command Center ─────────────────── */
const LOADING_STAGES = [
  { label: 'Connecting to UrbanSetu Admin Command Center...', icon: '🛡️' },
  { label: 'Authenticating administrator authorization level...', icon: '🔑' },
  { label: 'Retrieving all system-wide scheduled appointments...', icon: '📅' },
  { label: 'Synchronizing buyer & seller transaction profiles...', icon: '👥' },
  { label: 'Checking platform-wide booking & verification statuses...', icon: '⏳' },
  { label: 'Scanning payment escrows & token settlements...', icon: '💳' },
  { label: 'Loading linked property listings & ownership trails...', icon: '🏠' },
  { label: 'Inspecting dispute flags & active report queues...', icon: '🚩' },
  { label: 'Auditing secure end-to-end communication channels...', icon: '💬' },
  { label: 'Indexing archived consultations & cancellation logs...', icon: '📦' },
  { label: 'Initializing Admin controls & real-time monitoring...', icon: '⚡' },
  { label: 'Finalizing Admin appointments control dashboard...', icon: '✨' },
];

/* ─────────────────── Custom shimmer & animation keyframes ─────────────────── */
const SkeletonStyles = () => (
  <style>{`
    @keyframes aask-shimmer {
      0%   { background-position: -700px 0; }
      100% { background-position: 700px 0; }
    }
    @keyframes aask-float {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-5px); }
    }
    @keyframes aask-progress-glow {
      0%, 100% { box-shadow: 0 0 6px rgba(59, 130, 246, 0.4); }
      50%      { box-shadow: 0 0 20px rgba(147, 51, 234, 0.7); }
    }
    @keyframes aask-fade-in-up {
      0%   { opacity: 0; transform: translateY(12px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes aask-status-swap {
      0%   { opacity: 0; transform: translateY(8px); }
      15%  { opacity: 1; transform: translateY(0); }
      85%  { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-8px); }
    }
    @keyframes aask-pulse-ring {
      0%   { transform: scale(0.85); opacity: 0.6; }
      50%  { transform: scale(1.18); opacity: 0; }
      100% { transform: scale(0.85); opacity: 0; }
    }
    @keyframes aask-wave {
      0%, 60%, 100% { transform: scaleY(0.4); }
      30%           { transform: scaleY(1); }
    }
    .aask-shimmer {
      background: linear-gradient(
        90deg,
        rgba(148,163,184,0.08) 0%,
        rgba(148,163,184,0.22) 40%,
        rgba(148,163,184,0.08) 80%
      );
      background-size: 700px 100%;
      animation: aask-shimmer 1.8s infinite linear;
    }
    .dark .aask-shimmer {
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
    className={`aask-shimmer rounded-lg ${className}`}
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
          animation: `aask-wave 1.2s ${i * 0.12}s infinite ease-in-out`,
        }}
      />
    ))}
  </div>
);

/* ─────────────────── Stat Pill Card Skeleton ─────────────────── */
const StatCardSkeleton = ({ delay = 0, accentColor = '#3b82f6', label, icon }) => (
  <div
    className="relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-4 sm:p-5 border border-purple-100/60 dark:border-gray-700/60 overflow-hidden flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
    style={{
      animation: `aask-fade-in-up 0.5s ${delay}ms both ease-out`,
    }}
  >
    <div className="space-y-1.5 flex-1 min-w-0 pr-2">
      <Shimmer className="h-6 w-14 rounded-lg" delay={delay + 80} />
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block truncate">{label}</span>
    </div>
    <div className="relative shrink-0">
      <div
        className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center text-lg sm:text-xl shadow-sm"
        style={{
          background: `${accentColor}18`,
          color: accentColor,
          animation: `aask-float 2.5s ${delay + 150}ms infinite ease-in-out`,
        }}
      >
        {icon}
      </div>
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background: `${accentColor}12`,
          animation: `aask-pulse-ring 2s ${delay + 150}ms infinite ease-out`,
        }}
      />
    </div>
  </div>
);

export default function AdminAppointmentsSkeleton({ isDarkMode: propIsDarkMode }) {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const progressRef = useRef(null);

  // Auto-detect dark mode if not explicitly provided as prop
  const isDark = useMemo(() => {
    if (typeof propIsDarkMode === 'boolean') return propIsDarkMode;
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    }
    return false;
  }, [propIsDarkMode]);

  // Simulate admin appointments synchronization progress with steady stage pacing
  useEffect(() => {
    const totalDuration = 12000; // 12s total duration for smooth stage pacing
    const intervalMs = 60;
    let elapsed = 0;

    progressRef.current = setInterval(() => {
      elapsed += intervalMs;
      const linear = Math.min(elapsed / totalDuration, 1);
      // Smooth progress curve holding at 97% until real network finishes
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
    <div className={`min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 py-6 sm:py-10 px-2 md:px-8 font-sans transition-colors duration-500 relative overflow-hidden ${isDark ? 'dark' : ''}`}>
      <SkeletonStyles />

      {/* ─── Top Sticky Gradient Progress Bar ─── */}
      <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="h-1 bg-gray-200/50 dark:bg-gray-800/50 backdrop-blur-md">
          <div
            className="h-full rounded-r-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6, #ec4899)',
              animation: 'aask-progress-glow 2s infinite',
            }}
          />
        </div>
      </div>

      {/* ─── Top Quick Action Link (Zero Layout Shift) ─── */}
      <div className="max-w-7xl mx-auto mb-4 flex justify-end">
        <Link
          to="/admin/payments?tab=overview"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600/90 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow transition-all transform hover:scale-[1.02]"
        >
          <FaCreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>Go to Payments</span>
        </Link>
      </div>

      {/* ─── Modern Loading Descriptor Banner ─── */}
      <div className="max-w-7xl mx-auto mb-6">
        <div
          className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-xl border border-purple-100/80 dark:border-gray-700/60"
          style={{ animation: 'aask-fade-in-up 0.5s both ease-out' }}
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
                  Loading Admin Appointments Command Center
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
                  style={{ animation: 'aask-status-swap 2s both ease-in-out' }}
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
                  stroke="url(#admin-appt-grad)"
                  strokeDasharray={`${2 * Math.PI * 20}`}
                  strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-300 ease-out"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                />
                <defs>
                  <linearGradient id="admin-appt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
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
          <div className="mt-3.5 h-1.5 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
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
                  animation: 'aask-shimmer 1.2s infinite linear',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Admin Appointments KPI Stat Cards ─── */}
      <div className="max-w-7xl mx-auto mb-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCardSkeleton label="All System Bookings" icon="📅" accentColor="#3b82f6" delay={100} />
        <StatCardSkeleton label="Confirmed Visits" icon="🤝" accentColor="#10b981" delay={180} />
        <StatCardSkeleton label="Active Audited Chats" icon="💬" accentColor="#8b5cf6" delay={260} />
        <StatCardSkeleton label="Disputed & Archived" icon="🛡️" accentColor="#f59e0b" delay={340} />
      </div>

      {/* ─── Main Admin Appointments Workspace Card ─── */}
      <div 
        className="max-w-7xl mx-auto bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-xl shadow-xl p-4 sm:p-6 border border-purple-100/60 dark:border-gray-700/70"
        style={{ animation: 'aask-fade-in-up 0.6s 200ms both ease-out' }}
      >
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
          <div className="space-y-1">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-blue-700 dark:text-blue-400 drop-shadow flex items-center gap-2.5">
              <span>All Appointments</span>
              <span className="text-base font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                <Shimmer className="h-4 w-8 inline-block rounded-full" delay={250} />
              </span>
            </h3>
          </div>

          {/* Action buttons on the right matching AdminAppointments.jsx */}
          <div className="flex flex-row w-full sm:w-auto gap-2 sm:gap-3 justify-center sm:justify-end mt-2 sm:mt-0 flex-wrap">
            {/* Reports button */}
            <div className="bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 px-3 py-2 rounded-md font-semibold shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm border border-gray-200 dark:border-gray-600">
              <FaFlag className="text-red-500" size={13} />
              <Shimmer className="h-4 w-14 rounded" delay={280} />
            </div>

            {/* Refresh button */}
            <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-transparent px-3 py-2 rounded-md font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5">
              <FaSync className="text-blue-500 animate-spin" size={13} />
              <Shimmer className="h-4 w-14 rounded" delay={320} />
            </div>

            {/* Archive button */}
            <div className="bg-gradient-to-r from-gray-500/20 to-gray-600/20 border border-gray-400/30 text-transparent px-3 py-2 rounded-md font-semibold text-xs sm:text-sm flex items-center justify-center gap-2">
              <FaArchive className="text-gray-400" size={13} />
              <Shimmer className="h-4 w-32 rounded" delay={360} />
            </div>
          </div>
        </div>

        {/* Informative Subtext */}
        <p className="text-center text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-6 font-medium max-w-4xl mx-auto">
          💡 High data traffic may cause this page to slow down or stop working. Please refresh to continue using it normally.⚠️ Chats are encrypted and secure. View only for valid purposes like disputes or fraud checks. Unauthorized access or sharing is prohibited and will be logged.
        </p>

        {/* Filters and Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 bg-gray-50/70 dark:bg-gray-900/40 p-3.5 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Status dropdown */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs sm:text-sm text-gray-700 dark:text-gray-300 shrink-0">Status:</span>
              <div className="h-8 w-44 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 px-2 flex items-center">
                <Shimmer className="h-3.5 w-32 rounded" delay={380} />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Date Range */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-xs sm:text-sm text-gray-700 dark:text-gray-300 shrink-0">From:</span>
              <div className="h-8 w-28 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 px-2 flex items-center">
                <Shimmer className="h-3.5 w-20 rounded" delay={420} />
              </div>
              <span className="font-semibold text-xs sm:text-sm text-gray-700 dark:text-gray-300 shrink-0">To:</span>
              <div className="h-8 w-28 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 px-2 flex items-center">
                <Shimmer className="h-3.5 w-20 rounded" delay={450} />
              </div>
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-2">
              <div className="h-8 w-full sm:w-64 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 px-2.5 flex items-center gap-2">
                <FaSearch className="text-gray-400 shrink-0 text-xs" />
                <Shimmer className="h-3.5 w-40 rounded" delay={490} />
              </div>
            </div>
          </div>
        </div>

        {/* ─── High-Fidelity Desktop Admin Appointments Table Skeleton ─── */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200/70 dark:border-gray-700 shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-950 dark:to-purple-950 text-gray-800 dark:text-gray-200 text-xs uppercase tracking-wider font-bold">
                <th className="border-b border-gray-200 dark:border-gray-700 p-3 text-left">Date & Time</th>
                <th className="border-b border-gray-200 dark:border-gray-700 p-3 text-left">Property</th>
                <th className="border-b border-gray-200 dark:border-gray-700 p-3 text-center">Payment</th>
                <th className="border-b border-gray-200 dark:border-gray-700 p-3 text-left">Buyer</th>
                <th className="border-b border-gray-200 dark:border-gray-700 p-3 text-left">Seller</th>
                <th className="border-b border-gray-200 dark:border-gray-700 p-3 text-left">Purpose</th>
                <th className="border-b border-gray-200 dark:border-gray-700 p-3 text-left">Message</th>
                <th className="border-b border-gray-200 dark:border-gray-700 p-3 text-center">Status</th>
                <th className="border-b border-gray-200 dark:border-gray-700 p-3 text-center">Actions</th>
                <th className="border-b border-gray-200 dark:border-gray-700 p-3 text-center">Connect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 bg-white/50 dark:bg-gray-800/50">
              {/* Row 1 */}
              <tr className="hover:bg-blue-50/40 dark:hover:bg-gray-750 transition-colors">
                <td className="p-3 align-top">
                  <div className="space-y-1">
                    <Shimmer className="h-4 w-24" delay={200} />
                    <Shimmer className="h-3 w-14" delay={240} />
                    <div className="h-4 w-16 bg-red-100/60 dark:bg-red-950/40 rounded text-[10px] flex items-center justify-center font-semibold text-red-600/70">
                      Outdated
                    </div>
                  </div>
                </td>
                <td className="p-3 align-top">
                  <div className="space-y-1.5">
                    <Shimmer className="h-4 w-44 rounded" delay={260} />
                    <Shimmer className="h-3 w-28 rounded" delay={300} />
                  </div>
                </td>
                <td className="p-3 align-top text-center">
                  <div className="h-7 w-20 bg-emerald-50 dark:bg-emerald-950/40 rounded-md border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    Paid
                  </div>
                </td>
                <td className="p-3 align-top">
                  <div className="space-y-1">
                    <Shimmer className="h-4 w-28 rounded" delay={320} />
                    <Shimmer className="h-3 w-36 rounded" delay={350} />
                    <Shimmer className="h-3 w-24 rounded" delay={380} />
                  </div>
                </td>
                <td className="p-3 align-top">
                  <div className="space-y-1">
                    <Shimmer className="h-4 w-28 rounded" delay={340} />
                    <Shimmer className="h-3 w-36 rounded" delay={370} />
                    <Shimmer className="h-3 w-24 rounded" delay={400} />
                  </div>
                </td>
                <td className="p-3 align-top">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Buy</span>
                </td>
                <td className="p-3 align-top max-w-[140px]">
                  <Shimmer className="h-3.5 w-full rounded" delay={420} />
                </td>
                <td className="p-3 align-top text-center">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                    Accepted
                  </span>
                </td>
                <td className="p-3 align-top text-center">
                  <div className="flex flex-col gap-1.5 items-center justify-center">
                    <div className="h-7 w-20 bg-red-100 text-red-600 dark:bg-red-950/40 rounded-lg flex items-center justify-center text-xs font-semibold">
                      Cancel
                    </div>
                    <div className="h-7 w-20 bg-orange-100 text-orange-600 dark:bg-orange-950/40 rounded-lg flex items-center justify-center text-xs font-semibold">
                      Archive
                    </div>
                  </div>
                </td>
                <td className="p-3 align-top text-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-md mx-auto">
                    <FaCommentDots size={18} />
                  </div>
                </td>
              </tr>

              {/* Row 2 */}
              <tr className="hover:bg-blue-50/40 dark:hover:bg-gray-750 transition-colors">
                <td className="p-3 align-top">
                  <div className="space-y-1">
                    <Shimmer className="h-4 w-22" delay={280} />
                    <Shimmer className="h-3 w-14" delay={320} />
                    <div className="h-4 w-16 bg-red-100/60 dark:bg-red-950/40 rounded text-[10px] flex items-center justify-center font-semibold text-red-600/70">
                      Outdated
                    </div>
                  </div>
                </td>
                <td className="p-3 align-top">
                  <div className="space-y-1.5">
                    <Shimmer className="h-4 w-36 rounded" delay={340} />
                    <Shimmer className="h-3 w-24 rounded" delay={370} />
                  </div>
                </td>
                <td className="p-3 align-top text-center">
                  <div className="h-7 w-20 bg-gray-100 dark:bg-gray-700/60 rounded-md mx-auto" />
                </td>
                <td className="p-3 align-top">
                  <div className="space-y-1">
                    <Shimmer className="h-4 w-32 rounded" delay={390} />
                    <Shimmer className="h-3 w-36 rounded" delay={420} />
                  </div>
                </td>
                <td className="p-3 align-top">
                  <div className="space-y-1">
                    <Shimmer className="h-4 w-30 rounded" delay={410} />
                    <Shimmer className="h-3 w-36 rounded" delay={440} />
                  </div>
                </td>
                <td className="p-3 align-top">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Rent</span>
                </td>
                <td className="p-3 align-top max-w-[140px]">
                  <Shimmer className="h-3.5 w-3/4 rounded" delay={470} />
                </td>
                <td className="p-3 align-top text-center">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                    Outdated
                  </span>
                </td>
                <td className="p-3 align-top text-center">
                  <div className="flex flex-col gap-1.5 items-center justify-center">
                    <div className="h-7 w-20 bg-orange-100 text-orange-600 dark:bg-orange-950/40 rounded-lg flex items-center justify-center text-xs font-semibold">
                      Archive
                    </div>
                  </div>
                </td>
                <td className="p-3 align-top text-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-md mx-auto">
                    <FaCommentDots size={18} />
                  </div>
                </td>
              </tr>

              {/* Row 3 */}
              <tr className="hover:bg-blue-50/40 dark:hover:bg-gray-750 transition-colors">
                <td className="p-3 align-top">
                  <div className="space-y-1">
                    <Shimmer className="h-4 w-24" delay={360} />
                    <Shimmer className="h-3 w-14" delay={400} />
                    <div className="h-4 w-16 bg-emerald-100/60 dark:bg-emerald-950/40 rounded text-[10px] flex items-center justify-center font-semibold text-emerald-600/80">
                      Upcoming
                    </div>
                  </div>
                </td>
                <td className="p-3 align-top">
                  <div className="space-y-1.5">
                    <Shimmer className="h-4 w-48 rounded" delay={420} />
                    <Shimmer className="h-3 w-32 rounded" delay={450} />
                  </div>
                </td>
                <td className="p-3 align-top text-center">
                  <div className="h-7 w-20 bg-blue-100/70 dark:bg-blue-900/40 rounded-md mx-auto" />
                </td>
                <td className="p-3 align-top">
                  <div className="space-y-1">
                    <Shimmer className="h-4 w-28 rounded" delay={470} />
                    <Shimmer className="h-3 w-36 rounded" delay={500} />
                  </div>
                </td>
                <td className="p-3 align-top">
                  <div className="space-y-1">
                    <Shimmer className="h-4 w-32 rounded" delay={490} />
                    <Shimmer className="h-3 w-36 rounded" delay={520} />
                  </div>
                </td>
                <td className="p-3 align-top">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Buy</span>
                </td>
                <td className="p-3 align-top max-w-[140px]">
                  <Shimmer className="h-3.5 w-5/6 rounded" delay={550} />
                </td>
                <td className="p-3 align-top text-center">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                    Pending
                  </span>
                </td>
                <td className="p-3 align-top text-center">
                  <div className="flex flex-col gap-1.5 items-center justify-center">
                    <div className="h-7 w-20 bg-red-100 text-red-600 dark:bg-red-950/40 rounded-lg flex items-center justify-center text-xs font-semibold">
                      Cancel
                    </div>
                    <div className="h-7 w-20 bg-orange-100 text-orange-600 dark:bg-orange-950/40 rounded-lg flex items-center justify-center text-xs font-semibold">
                      Archive
                    </div>
                  </div>
                </td>
                <td className="p-3 align-top text-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-md mx-auto">
                    <FaCommentDots size={18} />
                  </div>
                </td>
              </tr>

              {/* Row 4 */}
              <tr className="hover:bg-blue-50/40 dark:hover:bg-gray-750 transition-colors">
                <td className="p-3 align-top">
                  <div className="space-y-1">
                    <Shimmer className="h-4 w-24" delay={440} />
                    <Shimmer className="h-3 w-14" delay={480} />
                  </div>
                </td>
                <td className="p-3 align-top">
                  <div className="space-y-1.5">
                    <Shimmer className="h-4 w-52 rounded" delay={500} />
                    <Shimmer className="h-3 w-28 rounded" delay={530} />
                  </div>
                </td>
                <td className="p-3 align-top text-center">
                  <div className="h-7 w-20 bg-gray-100 dark:bg-gray-700/60 rounded-md mx-auto" />
                </td>
                <td className="p-3 align-top">
                  <div className="space-y-1">
                    <Shimmer className="h-4 w-36 rounded" delay={550} />
                    <Shimmer className="h-3 w-40 rounded" delay={580} />
                  </div>
                </td>
                <td className="p-3 align-top">
                  <div className="space-y-1">
                    <Shimmer className="h-4 w-30 rounded" delay={570} />
                    <Shimmer className="h-3 w-36 rounded" delay={600} />
                  </div>
                </td>
                <td className="p-3 align-top">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Rent</span>
                </td>
                <td className="p-3 align-top max-w-[140px]">
                  <span className="text-xs text-gray-400 italic">No message provided</span>
                </td>
                <td className="p-3 align-top text-center">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300">
                    Cancelled by Seller
                  </span>
                </td>
                <td className="p-3 align-top text-center">
                  <div className="flex flex-col gap-1.5 items-center justify-center">
                    <div className="h-7 w-20 bg-green-100 text-green-700 dark:bg-green-950/40 rounded-lg flex items-center justify-center text-xs font-semibold">
                      Reinitiate
                    </div>
                    <div className="h-7 w-20 bg-orange-100 text-orange-600 dark:bg-orange-950/40 rounded-lg flex items-center justify-center text-xs font-semibold">
                      Archive
                    </div>
                  </div>
                </td>
                <td className="p-3 align-top text-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-md mx-auto">
                    <FaCommentDots size={18} />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ─── Responsive Mobile Cards Skeleton (Visible only on small screens) ─── */}
        <div className="md:hidden space-y-3.5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-900/60 border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-4 shadow-sm space-y-3"
              style={{ animation: `aask-fade-in-up 0.5s ${300 + i * 100}ms both ease-out` }}
            >
              {/* Card Header: Role & Status */}
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                  Appointment #{i}
                </span>
                <Shimmer className="h-5 w-20 rounded-full" delay={320 + i * 80} />
              </div>

              {/* Property & Date */}
              <div className="space-y-1">
                <Shimmer className="h-5 w-3/4 rounded" delay={340 + i * 80} />
                <div className="flex items-center gap-2">
                  <Shimmer className="h-3.5 w-24 rounded" delay={360 + i * 80} />
                  <Shimmer className="h-3.5 w-16 rounded" delay={380 + i * 80} />
                </div>
              </div>

              {/* Buyer & Seller details */}
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-gray-50/80 dark:bg-gray-800/80 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Buyer</span>
                  <Shimmer className="h-3.5 w-24 rounded" delay={400 + i * 80} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Seller</span>
                  <Shimmer className="h-3.5 w-24 rounded" delay={420 + i * 80} />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex gap-2">
                  <div className="h-7 w-16 bg-red-100 dark:bg-red-950/40 rounded text-red-600 text-[11px] font-semibold flex items-center justify-center">
                    Cancel
                  </div>
                  <div className="h-7 w-16 bg-orange-100 dark:bg-orange-950/40 rounded text-orange-600 text-[11px] font-semibold flex items-center justify-center">
                    Archive
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
                  <FaCommentDots size={14} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ─── Pagination Skeleton ─── */}
        <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t border-gray-100 dark:border-gray-700/60 gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Page</span>
            <Shimmer className="h-4 w-12 rounded" delay={500} />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="h-9 w-20 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center">
              <Shimmer className="h-3.5 w-12 rounded" delay={520} />
            </div>
            <div className="h-9 w-16 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center">
              <Shimmer className="h-3.5 w-10 rounded" delay={550} />
            </div>
          </div>
        </div>

      </div>

      {/* ─── Floating Bottom AI & Support Shadows (Matches Page Floating Buttons) ─── */}
      <div 
        className="fixed inset-0 pointer-events-none z-40"
        style={{
          animation: 'aask-fade-in-up 0.8s 800ms both cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Gemini AI Shadow */}
        <div className="absolute bottom-20 right-6 w-12 h-12 rounded-full aask-shimmer shadow-xl border border-white/20 dark:border-gray-700/50 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm pointer-events-auto flex items-center justify-center text-indigo-500 text-lg">
          ✨
        </div>
        {/* Contact Support Shadow */}
        <div className="absolute bottom-6 right-6 w-12 h-12 rounded-full aask-shimmer shadow-xl border border-white/20 dark:border-gray-700/50 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm pointer-events-auto flex items-center justify-center text-blue-500 text-lg">
          💬
        </div>
      </div>

    </div>
  );
}
