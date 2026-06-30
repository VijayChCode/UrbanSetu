import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  FaClock, FaSync, FaCalendarAlt, FaChevronLeft, FaChevronRight,
  FaBell, FaPlus, FaTrash, FaCheckCircle, FaExclamationTriangle,
  FaTimes, FaTrashAlt, FaHistory, FaCheck, FaBan
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { authenticatedFetch } from '../utils/auth';
import { API_BASE_URL } from '../config/api';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import { usePageTitle } from '../hooks/usePageTitle';
import GeminiAIWrapper from '../components/GeminiAIWrapper';

export default function RemindersPage() {
  usePageTitle("My Reminders - SetuAI");

  const currentUser = useSelector(state => state.user.currentUser);
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
  const [reminders, setReminders] = useState([]);
  const [isLoadingReminders, setIsLoadingReminders] = useState(false);
  const [isSchedulingReminder, setIsSchedulingReminder] = useState(false);
  
  // New reminder form state
  const [newReminderText, setNewReminderText] = useState('');
  const [newReminderDate, setNewReminderDate] = useState('');
  
  // Pagination and edit states
  const [activePage, setActivePage] = useState(1);
  const [pastPage, setPastPage] = useState(1);
  const [isRescheduling, setIsRescheduling] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleText, setRescheduleText] = useState('');
  const [deleteReminderId, setDeleteReminderId] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'history'
  const [ringingReminderId, setRingingReminderId] = useState(window.activeRingingReminderId || null);

  const itemsPerPage = 5;

  // Sync theme
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Listen to ringing reminder events
  useEffect(() => {
    const handleReminderRinging = (event) => {
      setRingingReminderId(event.detail.reminderId);
    };
    window.addEventListener('reminderRinging', handleReminderRinging);
    return () => window.removeEventListener('reminderRinging', handleReminderRinging);
  }, []);

  const getMinDateTime = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localNow = new Date(now.getTime() - (offset * 60 * 1000));
    return localNow.toISOString().slice(0, 16);
  };

  const fetchReminders = async () => {
    if (!currentUser) return;
    setIsLoadingReminders(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/gemini/reminders`);
      if (res.ok) {
        const data = await res.json();
        setReminders(data.reminders || []);
      } else {
        toast.error("Failed to load reminders");
      }
    } catch (err) {
      console.error("Error fetching reminders:", err);
      toast.error("Network error loading reminders");
    } finally {
      setIsLoadingReminders(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, [currentUser]);

  const handleCreateReminder = async (e) => {
    if (e) e.preventDefault();
    if (!newReminderText.trim()) {
      toast.warn("Please enter a reminder description.");
      return;
    }
    if (!newReminderDate) {
      toast.warn("Please select a valid date and time.");
      return;
    }
    if (new Date(newReminderDate) < new Date()) {
      toast.warn("Cannot schedule a reminder in the past.");
      return;
    }
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyCount = reminders.filter(r => r.createdAt && new Date(r.createdAt) >= oneDayAgo).length;
    if (dailyCount >= 10) {
      toast.error("Daily reminder limit reached (10 reminders/day). Please try again later.");
      return;
    }

    setIsSchedulingReminder(true);
    try {
      const utcTime = new Date(newReminderDate).toISOString();
      const res = await authenticatedFetch(`${API_BASE_URL}/api/gemini/reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reminderText: newReminderText.trim(), scheduledTime: utcTime })
      });
      if (res.ok) {
        toast.success("Reminder scheduled successfully");
        fetchReminders();
        setNewReminderText('');
        setNewReminderDate('');
      } else {
        const errData = await res.json();
        toast.error(errData.message || "Failed to schedule reminder");
      }
    } catch (err) {
      console.error("Error creating reminder:", err);
      toast.error("Error scheduling reminder");
    } finally {
      setIsSchedulingReminder(false);
    }
  };

  const handleReschedule = async (id, newTime, newText) => {
    if (!newTime) {
      toast.warn("Please select a valid date and time.");
      return;
    }
    if (new Date(newTime) < new Date()) {
      toast.warn("Cannot reschedule to a past date or time.");
      return;
    }
    try {
      const utcTime = new Date(newTime).toISOString();
      const res = await authenticatedFetch(`${API_BASE_URL}/api/gemini/reminders/${id}/reschedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ scheduledTime: utcTime, taskText: newText })
      });
      if (res.ok) {
        toast.success("Reminder rescheduled successfully");
        fetchReminders();
        setIsRescheduling(null);
        setRescheduleText('');
      } else {
        const errData = await res.json();
        toast.error(errData.message || "Failed to reschedule reminder");
      }
    } catch (err) {
      console.error("Error rescheduling reminder:", err);
      toast.error("Error rescheduling reminder");
    }
  };

  const handleDeleteReminder = async (id) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/gemini/reminders/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success("Reminder cancelled successfully");
        fetchReminders();
        setDeleteReminderId(null);
      } else {
        const errData = await res.json();
        toast.error(errData.message || "Failed to cancel reminder");
      }
    } catch (err) {
      console.error("Error deleting reminder:", err);
      toast.error("Error cancelling reminder");
    }
  };

  const handleSnoozeInline = async (reminderId) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/gemini/reminders/${reminderId}/snooze`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ minutes: 5 })
      });
      if (res.ok) {
        toast.success("Reminder snoozed for 5 minutes");
        window.activeRingingReminderId = null;
        window.dispatchEvent(new CustomEvent('reminderRinging', { detail: { reminderId: null, isRinging: false } }));
        fetchReminders();
      } else {
        toast.error("Failed to snooze reminder");
      }
    } catch (err) {
      console.error('Failed to snooze reminder:', err);
      toast.error("Error snoozing reminder");
    }
  };

  const handleDismissInline = async (reminderId) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/gemini/reminders/${reminderId}/dismiss`, {
        method: 'PATCH'
      });
      if (res.ok) {
        toast.success("Reminder dismissed");
        window.activeRingingReminderId = null;
        window.dispatchEvent(new CustomEvent('reminderRinging', { detail: { reminderId: null, isRinging: false } }));
        fetchReminders();
      } else {
        toast.error("Failed to dismiss reminder");
      }
    } catch (err) {
      console.error('Failed to dismiss reminder:', err);
      toast.error("Error dismissing reminder");
    }
  };

  const activeReminders = reminders.filter(r => r.status === 'scheduled' || r.status === 'snoozed' || r.status === 'triggered' || r._id === ringingReminderId);
  const pastReminders = reminders.filter(r => r.status !== 'scheduled' && r.status !== 'snoozed' && r.status !== 'triggered' && r._id !== ringingReminderId);

  return (
    <div className={`min-h-screen py-12 px-4 sm:px-6 lg:px-8 font-outfit transition-colors duration-300 ${isDarkMode ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-800'}`}>
      <div className="max-w-6xl mx-auto">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10 pb-6 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex items-center gap-3">
              <FaClock className="text-indigo-500 animate-pulse" />
              My Task Reminders
            </h1>
            <p className={`text-sm mt-2 font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Schedule, reschedule, and manage your custom AI-driven task alerts and notifications.
            </p>
          </div>
          <button
            onClick={fetchReminders}
            disabled={isLoadingReminders}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl font-bold transition-all duration-200 hover:scale-105 active:scale-95 shadow-md border ${
              isDarkMode
                ? 'bg-gray-900 border-gray-800 hover:bg-gray-850 text-gray-200'
                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
            }`}
          >
            <FaSync className={isLoadingReminders ? "animate-spin text-indigo-500" : "text-indigo-500"} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Stats Banner Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          <div className={`p-6 rounded-3xl border transition-all duration-300 hover:shadow-lg ${
            isDarkMode 
              ? 'bg-indigo-950/20 border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.05)]' 
              : 'bg-indigo-50/50 border-indigo-100 shadow-sm'
          }`}>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                <FaBell className="text-indigo-500 text-xl" />
              </div>
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Active Reminders</p>
                <h3 className="text-2xl font-black mt-0.5">{activeReminders.length}</h3>
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-3xl border transition-all duration-300 hover:shadow-lg ${
            isDarkMode 
              ? 'bg-emerald-950/20 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]' 
              : 'bg-emerald-50/50 border-emerald-100 shadow-sm'
          }`}>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                <FaCheck className="text-emerald-500 text-xl" />
              </div>
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Completed / Sent</p>
                <h3 className="text-2xl font-black mt-0.5">{pastReminders.filter(r => r.status !== 'cancelled').length}</h3>
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-3xl border transition-all duration-300 hover:shadow-lg ${
            isDarkMode 
              ? 'bg-rose-950/20 border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.05)]' 
              : 'bg-rose-50/50 border-rose-100 shadow-sm'
          }`}>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                <FaBan className="text-rose-500 text-xl" />
              </div>
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>Cancelled Alerts</p>
                <h3 className="text-2xl font-black mt-0.5">{pastReminders.filter(r => r.status === 'cancelled').length}</h3>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Create Reminder Card */}
          <div className={`lg:col-span-1 p-6 rounded-3xl border h-fit shadow-md ${
            isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
          }`}>
            <h4 className="text-lg font-black mb-4 flex items-center gap-2">
              <FaPlus className="text-indigo-500" size={14} />
              Schedule Reminder
            </h4>
            <form onSubmit={handleCreateReminder} className="space-y-4">
              <div className="space-y-1.5">
                <label className={`text-xs font-bold uppercase tracking-wide ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Task Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Call listing agent, check document..."
                  value={newReminderText}
                  onChange={(e) => setNewReminderText(e.target.value)}
                  disabled={isSchedulingReminder}
                  className={`w-full px-4 py-3 border rounded-xl text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                    isDarkMode 
                      ? 'bg-gray-950 text-white border-gray-800 focus:bg-gray-950' 
                      : 'bg-gray-55 border-gray-200 focus:bg-white text-gray-800'
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <label className={`text-xs font-bold uppercase tracking-wide ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={newReminderDate}
                  onChange={(e) => setNewReminderDate(e.target.value)}
                  min={getMinDateTime()}
                  disabled={isSchedulingReminder}
                  style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
                  className={`w-full px-4 py-3 border rounded-xl text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                    isDarkMode 
                      ? 'bg-gray-950 text-white border-gray-800 focus:bg-gray-950' 
                      : 'bg-gray-55 border-gray-200 focus:bg-white text-gray-800'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={isSchedulingReminder}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/20 active:scale-98 disabled:opacity-50"
              >
                {isSchedulingReminder ? 'Scheduling Alert...' : 'Schedule Alert'}
              </button>
            </form>
          </div>

          {/* List and Tabs Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Tabs Header */}
            <div className={`p-1.5 rounded-2xl flex border ${
              isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
            }`}>
              <button
                onClick={() => setActiveTab('active')}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                  activeTab === 'active'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : isDarkMode 
                      ? 'text-gray-400 hover:bg-gray-800 hover:text-white' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <FaBell size={14} />
                <span>Active Alerts ({activeReminders.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                  activeTab === 'history'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : isDarkMode 
                      ? 'text-gray-400 hover:bg-gray-800 hover:text-white' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <FaHistory size={14} />
                <span>Past History ({pastReminders.length})</span>
              </button>
            </div>

            {/* List Body Card */}
            <div className={`p-6 rounded-3xl border shadow-md min-h-[400px] flex flex-col justify-between ${
              isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
            }`}>
              <div className={`flex-grow flex flex-col ${isLoadingReminders ? 'justify-center' : ''}`}>
                {isLoadingReminders ? (
                  <div className="flex flex-col items-center justify-center py-4 gap-4">
                    <UrbanSetuSpinner />
                    <p className={`text-sm font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Loading reminders...
                    </p>
                  </div>
                ) : activeTab === 'active' ? (
                  /* Active Tab Content */
                  (() => {
                    const totalPages = Math.ceil(activeReminders.length / itemsPerPage) || 1;
                    const currentPage = Math.min(activePage, totalPages);
                    const pageItems = activeReminders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                    if (activeReminders.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                          <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
                            <FaBell className="text-indigo-500 text-2xl" />
                          </div>
                          <h4 className="font-bold text-lg mb-1">No Active Reminders</h4>
                          <p className={`text-xs max-w-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            You don't have any pending alerts. Set one up in the left panel or ask the AI to schedule one!
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {pageItems.map((reminder, idx) => (
                          <div
                            key={reminder._id}
                            className={`p-4 border rounded-2xl transition-all duration-300 hover:shadow-md ${
                              ringingReminderId === reminder._id
                                ? 'border-red-500/50 bg-red-500/5 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                                : isDarkMode 
                                  ? 'border-gray-800 bg-gray-950/40 hover:bg-gray-950/80' 
                                  : 'border-gray-200 bg-gray-50 hover:bg-gray-100/50'
                            }`}
                            style={{ animation: `fadeIn 0.2s ease-out ${idx * 0.03}s backwards` }}
                          >
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div className="flex-1">
                                <h5 className={`text-sm font-bold leading-snug ${isDarkMode ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                                  <span>{reminder.taskText}</span>
                                  {ringingReminderId === reminder._id && (
                                    <FaBell className="text-red-500 animate-ring-bell flex-shrink-0" size={14} title="Ringing" />
                                  )}
                                </h5>
                                <div className={`text-xs font-semibold flex items-center gap-1.5 mt-1.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                  <FaCalendarAlt size={12} className="text-indigo-500" />
                                  {new Date(reminder.scheduledTime).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(',', '')}
                                  {reminder.status === 'snoozed' && (
                                    <span className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                      Snoozed
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Reschedule inline block */}
                            {isRescheduling && isRescheduling._id === reminder._id ? (
                              <div className="mt-3 pt-3 border-t border-dashed border-gray-800 dark:border-gray-700 space-y-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Task Name</label>
                                  <input
                                    type="text"
                                    value={rescheduleText}
                                    onChange={(e) => setRescheduleText(e.target.value)}
                                    placeholder="Task description..."
                                    className={`w-full p-2.5 border rounded-xl text-xs ${isDarkMode ? 'bg-gray-900 text-white border-gray-850 focus:ring-indigo-500' : 'bg-white text-gray-900 border-gray-300 focus:ring-indigo-500'}`}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">New Alert Time</label>
                                  <input
                                    type="datetime-local"
                                    value={rescheduleDate}
                                    onChange={(e) => setRescheduleDate(e.target.value)}
                                    min={getMinDateTime()}
                                    style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
                                    className={`w-full p-2.5 border rounded-xl text-xs ${isDarkMode ? 'bg-gray-900 text-white border-gray-850' : 'bg-white text-gray-900 border-gray-300'}`}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleReschedule(reminder._id, rescheduleDate, rescheduleText)}
                                    className="text-xs px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-md hover:shadow-indigo-500/10"
                                  >
                                    Save Changes
                                  </button>
                                  <button
                                    onClick={() => {
                                      setIsRescheduling(null);
                                      setRescheduleText('');
                                    }}
                                    className={`text-xs px-3 py-2 rounded-lg border font-bold transition-colors ${isDarkMode ? 'bg-gray-850 hover:bg-gray-800 text-gray-300 border-gray-750' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'}`}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : ringingReminderId === reminder._id ? (
                              <div className="flex gap-2 border-t pt-3 mt-3 border-gray-100 dark:border-gray-800">
                                <button
                                  onClick={() => handleSnoozeInline(reminder._id)}
                                  className="text-xs px-3 py-1.5 rounded-lg font-bold bg-slate-700 hover:bg-slate-650 text-white transition-colors"
                                >
                                  Snooze (5m)
                                </button>
                                <button
                                  onClick={() => handleDismissInline(reminder._id)}
                                  className="text-xs px-3 py-1.5 rounded-lg font-bold bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white transition-colors"
                                >
                                  Dismiss Reminder
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2 border-t pt-3 mt-3 border-gray-100 dark:border-gray-800">
                                <button
                                  onClick={() => {
                                    setIsRescheduling(reminder);
                                    const date = new Date(reminder.scheduledTime);
                                    const offset = date.getTimezoneOffset();
                                    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
                                    setRescheduleDate(localDate.toISOString().slice(0, 16));
                                    setRescheduleText(reminder.taskText || '');
                                  }}
                                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${
                                    isDarkMode 
                                      ? 'bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-300' 
                                      : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'
                                  }`}
                                >
                                  Reschedule
                                </button>
                                <button
                                  onClick={() => setDeleteReminderId(reminder._id)}
                                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${
                                    isDarkMode 
                                      ? 'bg-red-900/30 hover:bg-red-900/50 text-red-300' 
                                      : 'bg-red-100 hover:bg-red-200 text-red-700'
                                  }`}
                                >
                                  Cancel Alert
                                </button>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Pagination */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                            <span className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              Showing page {currentPage} of {totalPages}
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setActivePage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className={`p-2 rounded-xl border transition-all ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 border-gray-750 text-gray-300' : 'bg-white hover:bg-gray-100 border-gray-200 text-gray-700'} disabled:opacity-40 disabled:cursor-not-allowed`}
                              >
                                <FaChevronLeft size={12} />
                              </button>
                              <button
                                onClick={() => setActivePage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className={`p-2 rounded-xl border transition-all ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 border-gray-750 text-gray-300' : 'bg-white hover:bg-gray-100 border-gray-200 text-gray-700'} disabled:opacity-40 disabled:cursor-not-allowed`}
                              >
                                <FaChevronRight size={12} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  /* History Tab Content */
                  (() => {
                    const totalPages = Math.ceil(pastReminders.length / itemsPerPage) || 1;
                    const currentPage = Math.min(pastPage, totalPages);
                    const pageItems = pastReminders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                    if (pastReminders.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                          <div className="w-16 h-16 rounded-full bg-gray-500/10 flex items-center justify-center mb-4">
                            <FaHistory className="text-gray-500 text-2xl" />
                          </div>
                          <h4 className="font-bold text-lg mb-1">No Past Alerts</h4>
                          <p className={`text-xs max-w-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Your historical triggered and cancelled alerts will appear here once you start using reminders.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {pageItems.map((reminder, idx) => (
                          <div
                            key={reminder._id}
                            className={`p-4 border rounded-2xl opacity-75 hover:opacity-100 transition-all duration-300 ${
                              isDarkMode 
                                ? 'border-gray-850 bg-gray-950/20' 
                                : 'border-gray-150 bg-gray-50/50'
                            }`}
                            style={{ animation: `fadeIn 0.2s ease-out ${idx * 0.03}s backwards` }}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <h5 className={`text-sm font-semibold leading-snug ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} ${reminder.status === 'cancelled' ? 'line-through' : ''}`}>
                                  {reminder.taskText}
                                </h5>
                                <div className={`text-xs font-medium flex items-center gap-1.5 mt-1.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                  <FaCalendarAlt size={12} className="opacity-70" />
                                  {new Date(reminder.scheduledTime).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(',', '')}
                                </div>
                              </div>
                              {reminder.status === 'cancelled' ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-150 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-500/10">
                                  Cancelled
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-150 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-500/10">
                                  Sent
                                </span>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Pagination */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                            <span className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              Showing page {currentPage} of {totalPages}
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setPastPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className={`p-2 rounded-xl border transition-all ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 border-gray-750 text-gray-300' : 'bg-white hover:bg-gray-100 border-gray-200 text-gray-700'} disabled:opacity-40 disabled:cursor-not-allowed`}
                              >
                                <FaChevronLeft size={12} />
                              </button>
                              <button
                                onClick={() => setPastPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className={`p-2 rounded-xl border transition-all ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 border-gray-750 text-gray-300' : 'bg-white hover:bg-gray-100 border-gray-200 text-gray-700'} disabled:opacity-40 disabled:cursor-not-allowed`}
                              >
                                <FaChevronRight size={12} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Delete/Cancel Confirmation Modal */}
      {deleteReminderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className={`w-full max-w-sm rounded-3xl p-6 border shadow-2xl animate-scaleIn ${
            isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <FaExclamationTriangle size={24} />
              <h4 className="text-lg font-black">Cancel Alert</h4>
            </div>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Are you sure you want to cancel this reminder alert? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDeleteReminder(deleteReminderId)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition-all active:scale-98"
              >
                Yes, Cancel Alert
              </button>
              <button
                onClick={() => setDeleteReminderId(null)}
                className={`flex-1 py-2.5 rounded-xl border font-bold text-xs transition-colors ${
                  isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-750' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                }`}
              >
                No, Keep
              </button>
            </div>
          </div>
        </div>
      )}
      <GeminiAIWrapper />
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ring-bell {
          0%, 100% { transform: rotate(0); }
          15% { transform: rotate(15deg); }
          30% { transform: rotate(-15deg); }
          45% { transform: rotate(10deg); }
          60% { transform: rotate(-10deg); }
          75% { transform: rotate(4deg); }
          90% { transform: rotate(-4deg); }
        }
        .animate-ring-bell {
          animation: ring-bell 1.5s infinite;
          transform-origin: top center;
          display: inline-block;
        }
      `}</style>
    </div>
  );
}