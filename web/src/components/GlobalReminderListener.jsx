import React, { useEffect, useState, useRef } from 'react';
import { socket } from '../utils/socket';
import { useSelector } from 'react-redux';
import { FaClock, FaVolumeMute } from 'react-icons/fa';
import { authenticatedFetch } from '../utils/auth';
import { API_BASE_URL } from '../config/api';

export default function GlobalReminderListener() {
  const currentUser = useSelector(state => state.user.currentUser);
  const [activeReminder, setActiveReminder] = useState(null);
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

  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-indigo-500/30 transform scale-100 transition-all duration-300 animate-scaleIn relative overflow-hidden">
        {/* Dynamic decorative light orb */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl animate-pulse"></div>

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
