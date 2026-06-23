import React, { useEffect, useState, useRef } from 'react';
import { socket } from '../utils/socket';
import { useSelector } from 'react-redux';
import { FaClock, FaVolumeMute, FaTimes, FaMinus } from 'react-icons/fa';
import { authenticatedFetch } from '../utils/auth';
import { API_BASE_URL } from '../config/api';

export default function GlobalReminderListener() {
  const currentUser = useSelector(state => state.user.currentUser);
  const [activeReminder, setActiveReminder] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const audioRef = useRef(null);
  const timeoutRef = useRef(null);
  const activeReminderRef = useRef(null);

  useEffect(() => {
    activeReminderRef.current = activeReminder;
  }, [activeReminder]);

  useEffect(() => {
    if (!currentUser) return;

    const handleReminderTriggered = (data) => {
      console.log('Reminder triggered globally:', data);
      
      // Stop existing audio and clear timeout if any
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Play ringtone looping
      const audio = new Audio('/assets/sounds/ringtone.mp3');
      audio.loop = true;
      audio.volume = 0.8;
      audio.play().catch(err => {
        console.warn('Playback of ringtone was blocked or failed:', err);
      });
      audioRef.current = audio;

      setActiveReminder(data);
      setIsMinimized(false);
      window.activeRingingReminderId = data.reminderId;
      window.dispatchEvent(new CustomEvent('reminderRinging', { detail: { reminderId: data.reminderId, isRinging: true } }));

      // Auto-mute the sound after 1 minute (60 seconds) but keep modal open
      timeoutRef.current = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        window.activeRingingReminderId = null;
        window.dispatchEvent(new CustomEvent('reminderRinging', { detail: { reminderId: null, isRinging: false } }));
        console.log('Reminder alarm sound auto-muted after 1 minute.');
      }, 60000);
    };

    const handleReminderDismissed = (data) => {
      console.log('Reminder dismissed from another tab:', data);
      if (activeReminderRef.current && activeReminderRef.current.reminderId === data.reminderId) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setActiveReminder(null);
        setIsMinimized(false);
        window.activeRingingReminderId = null;
        window.dispatchEvent(new CustomEvent('reminderRinging', { detail: { reminderId: null, isRinging: false } }));
      }
    };

    const handleReminderSnoozed = (data) => {
      console.log('Reminder snoozed from another tab:', data);
      if (activeReminderRef.current && activeReminderRef.current.reminderId === data.reminderId) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setActiveReminder(null);
        setIsMinimized(false);
        window.activeRingingReminderId = null;
        window.dispatchEvent(new CustomEvent('reminderRinging', { detail: { reminderId: null, isRinging: false } }));
      }
    };

    socket.on('reminder_triggered', handleReminderTriggered);
    socket.on('reminder_dismissed', handleReminderDismissed);
    socket.on('reminder_snoozed', handleReminderSnoozed);

    return () => {
      socket.off('reminder_triggered', handleReminderTriggered);
      socket.off('reminder_dismissed', handleReminderDismissed);
      socket.off('reminder_snoozed', handleReminderSnoozed);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      window.activeRingingReminderId = null;
      window.dispatchEvent(new CustomEvent('reminderRinging', { detail: { reminderId: null, isRinging: false } }));
    };
  }, [currentUser]);

  const handleDismiss = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const reminderId = activeReminder?.reminderId;
    setActiveReminder(null);
    setIsMinimized(false);
    window.activeRingingReminderId = null;
    window.dispatchEvent(new CustomEvent('reminderRinging', { detail: { reminderId: null, isRinging: false } }));

    if (reminderId) {
      try {
        await authenticatedFetch(`${API_BASE_URL}/api/gemini/reminders/${reminderId}/dismiss`, {
          method: 'PATCH'
        });
      } catch (err) {
        console.error('Failed to dismiss reminder in DB:', err);
      }
    }
  };

  const handleSnooze = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const reminderId = activeReminder?.reminderId;
    setActiveReminder(null);
    setIsMinimized(false);
    window.activeRingingReminderId = null;
    window.dispatchEvent(new CustomEvent('reminderRinging', { detail: { reminderId: null, isRinging: false } }));

    if (reminderId) {
      try {
        await authenticatedFetch(`${API_BASE_URL}/api/gemini/reminders/${reminderId}/snooze`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ minutes: 5 }) // nominal snooze time of 5 minutes
        });
      } catch (err) {
        console.error('Failed to snooze reminder in DB:', err);
      }
    }
  };

  if (!activeReminder) return null;

  if (isMinimized) {
    return (
      <MinimizedAlarmBubble
        taskText={activeReminder.taskText}
        onOpen={() => setIsMinimized(false)}
        onDismiss={handleDismiss}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-indigo-500/30 transform scale-100 transition-all duration-300 animate-scaleIn relative overflow-hidden">
        {/* Dynamic decorative light orb */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl animate-pulse"></div>

        {/* Hide/Minimize Button at the top-right */}
        <button
          onClick={() => setIsMinimized(true)}
          className="absolute top-4 right-4 p-2 bg-slate-800/40 hover:bg-slate-800/80 rounded-full text-slate-300 hover:text-white transition-all z-10"
          title="Hide Alarm"
        >
          <FaMinus size={12} />
        </button>

        <div className="flex flex-col items-center text-center">
          {/* Animated Clock Icon */}
          <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center mb-6 border border-indigo-500/30 shadow-inner relative">
            <span className="absolute inset-0 rounded-full bg-indigo-500/10 animate-ping opacity-75"></span>
            <FaClock size={36} className="text-indigo-400 animate-pulse" />
          </div>

          <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 mb-3">
            AI Task Reminder
          </span>

          <h3 className="text-2xl font-extrabold text-white mb-4 leading-tight">
            {activeReminder.taskText}
          </h3>

          <p className="text-sm text-slate-300/90 mb-8 max-w-xs leading-relaxed">
            This task was scheduled for <span className="text-indigo-300 font-semibold">{new Date(activeReminder.scheduledTime).toLocaleString()}</span>.
          </p>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={handleSnooze}
              className="flex-1 py-3 px-4 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-white rounded-2xl font-bold transition-all shadow-md flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              <FaClock size={16} />
              <span>Snooze (5m)</span>
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white rounded-2xl font-bold transition-all shadow-lg hover:shadow-indigo-500/25 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              <FaVolumeMute size={16} />
              <span>Dismiss Alarm</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const MinimizedAlarmBubble = ({ taskText, onOpen, onDismiss }) => {
  const bubbleRef = useRef(null);
  const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 180 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);

  const handlePointerDown = (e) => {
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    setHasDragged(false);
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };

  const handlePointerMove = useCallback((e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const newX = Math.max(0, Math.min(window.innerWidth - 64, clientX - dragStart.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 64, clientY - dragStart.y));
    setPosition({ x: newX, y: newY });
    setHasDragged(true);
  }, [isDragging, dragStart]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('touchmove', handlePointerMove, { passive: false });
      window.addEventListener('touchend', handlePointerUp);
    }
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  const handleClick = () => {
    if (!hasDragged) {
      onOpen();
    }
  };

  const handleDismissClick = (e) => {
    e.stopPropagation();
    onDismiss();
  };

  return (
    <>
      <style>{`
        @keyframes alarm-bubble-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
          50% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
        }
        @keyframes alarm-bubble-slide-in {
          from { transform: scale(0.3); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div
        ref={bubbleRef}
        className="fixed z-[9999] select-none"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transition: isDragging ? 'none' : 'left 0.1s ease, top 0.1s ease',
          touchAction: 'none',
        }}
      >
        {/* Task name tooltip */}
        <div
          className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-md pointer-events-none opacity-90 shadow-md font-bold"
        >
          ⏰ Ringing: {taskText || 'Reminder'}
        </div>

        {/* Main bubble */}
        <div
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
          onClick={handleClick}
          className="w-14 h-14 rounded-full flex items-center justify-center cursor-pointer shadow-2xl bg-gradient-to-br from-red-500 via-pink-600 to-purple-600 border border-white/20"
          style={{
            animation: 'alarm-bubble-slide-in 0.3s ease-out, alarm-bubble-pulse 2s ease-in-out infinite',
          }}
          title={`Ringing: ${taskText} (click to open)`}
        >
          <FaClock className="text-white text-xl animate-bounce" />
        </div>

        {/* Small dismiss button */}
        <button
          onClick={handleDismissClick}
          className="absolute -top-1 -right-1 w-6 h-6 bg-slate-800 hover:bg-slate-900 border border-slate-700 text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"
          title="Dismiss alarm"
        >
          <FaTimes className="text-[10px]" />
        </button>
      </div>
    </>
  );
};
