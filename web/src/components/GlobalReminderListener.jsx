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

  useEffect(() => {
    if (!currentUser) return;

    const handleReminderTriggered = (data) => {
      console.log('Reminder triggered globally:', data);
      
      // Stop existing audio if any
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
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
    };

    socket.on('reminder_triggered', handleReminderTriggered);

    return () => {
      socket.off('reminder_triggered', handleReminderTriggered);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
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
            This task was scheduled for <span className="text-indigo-300 font-semibold">{new Date(activeReminder.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>.
          </p>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white rounded-2xl font-bold transition-all shadow-lg hover:shadow-indigo-500/25 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            <FaVolumeMute size={18} />
            <span>Dismiss Alarm</span>
          </button>
        </div>
      </div>
    </div>
  );
}
