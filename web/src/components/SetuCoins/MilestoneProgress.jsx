import React from 'react';
import { FaAward, FaTrophy } from 'react-icons/fa';

/**
 * A milestone progress tracker for SetuCoins rent streaks.
 * Shows progress towards the next badge (Elite Resident or Perfect Payer).
 * 
 * @param {Object} props
 * @param {number} props.streak - Current monthly rent streak
 * @param {string} props.variant - 'default' or 'minimal'
 * @param {string} props.className - Optional extra classes
 */
const MilestoneProgress = ({ streak = 0, variant = "default", className = "" }) => {
  if (streak >= 12) {
    if (variant === "minimal") {
      return (
        <div className={`flex items-center gap-1.5 ${className}`}>
          <FaTrophy className="text-yellow-500 text-[10px]" />
          <span className="text-[10px] font-bold text-green-600 dark:text-green-400">Perfect Payer!</span>
        </div>
      );
    }
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg ${className}`}>
        <FaTrophy className="text-yellow-500 text-sm" />
        <span className="text-xs font-bold text-green-700 dark:text-green-400">Perfect Payer (12mo)</span>
      </div>
    );
  }

  const nextMilestone = streak < 6 ? 6 : 12;
  const milestoneName = streak < 6 ? 'Elite Resident' : 'Perfect Payer';
  const progressPercent = (streak / nextMilestone) * 100;
  const remaining = nextMilestone - streak;

  if (variant === "minimal") {
    return (
      <div className={`w-full ${className}`}>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] font-black text-indigo-200 uppercase tracking-tighter opacity-80">{milestoneName}</span>
          <span className="text-[9px] font-bold text-indigo-100">{remaining} to go</span>
        </div>
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-400 rounded-full transition-all duration-1000"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`p-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-lg ${className}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <FaAward className="text-indigo-600 dark:text-indigo-400 text-xs" />
          <span className="text-[10px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
            {milestoneName} Milestone
          </span>
        </div>
        <span className="text-[10px] font-black bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
          {streak} MO STREAK
        </span>
      </div>
      
      <div className="w-full h-1.5 bg-indigo-100 dark:bg-indigo-800/50 rounded-full overflow-hidden">
        <div 
          className="h-full bg-indigo-600 rounded-full transition-all duration-1000 shadow-[0_0_5px_rgba(79,70,229,0.3)]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      
      <div className="flex justify-between mt-1 text-[9px] font-medium text-indigo-700/70 dark:text-indigo-400/70">
        <span>{Math.round(progressPercent)}% Complete</span>
        <span>{remaining} more {remaining === 1 ? 'payment' : 'payments'}</span>
      </div>

      <p className="text-[9px] text-indigo-600/60 dark:text-indigo-400/60 mt-2 italic border-t border-indigo-100/50 dark:border-indigo-800/50 pt-1.5 translate-y-0.5">
        * {streak < 6 
            ? <>Reach a 6-month streak for the <strong className="text-indigo-700 dark:text-indigo-300">Elite Resident</strong> badge & 200 SC bonus!</>
            : <>Reach a 12-month streak for the <strong className="text-indigo-700 dark:text-indigo-300">Perfect Payer</strong> badge & 500 SC bonus!</>
          }
      </p>
    </div>
  );
};

export default MilestoneProgress;
