import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSun, FaMoon, FaDesktop, FaChevronDown } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { updateUserStart, updateUserSuccess, updateUserFailure } from '../redux/user/userSlice';
import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const ThemeToggle = ({ mobile = false, variant = 'dropdown', className = '' }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');
    const dropdownRef = useRef(null);
    const { currentUser } = useSelector((state) => state.user);
    const dispatch = useDispatch();

    useEffect(() => {
        const handleStorage = (e) => {
            if (e.key === 'theme') {
                setTheme(e.newValue || 'system');
            }
        };

        const handleThemeSync = (e) => {
            setTheme(e.detail.theme);
        };

        window.addEventListener('storage', handleStorage);
        window.addEventListener('theme-change', handleThemeSync);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('theme-change', handleThemeSync);
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleThemeChange = async (newTheme) => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        setIsOpen(false);

        // Dispatch custom event for same-tab updates (Settings page listens for this)
        window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: newTheme, source: 'themeToggle' } }));

        // Dispatch storage event manually for other listeners
        window.dispatchEvent(new Event('storage'));

        // Immediate application logic
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else if (newTheme === 'light') {
            document.documentElement.classList.remove('dark');
        } else {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }

        // Persist to DB if user is logged in
        if (currentUser?._id) {
            try {
                dispatch(updateUserStart());
                const res = await authenticatedFetch(`${API_BASE_URL}/api/user/update/${currentUser._id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ settings: { theme: newTheme } }),
                });
                const data = await res.json();
                if (data.status !== 'error' && data.success !== false) {
                    dispatch(updateUserSuccess(data.updatedUser));
                } else {
                    dispatch(updateUserFailure(data.message || 'Failed to save theme'));
                }
            } catch (error) {
                dispatch(updateUserFailure(error.message));
            }
        }
    };

    const themes = [
        { id: 'light', icon: FaSun, label: t('settings.theme_light'), color: 'text-yellow-500' },
        { id: 'dark', icon: FaMoon, label: t('settings.theme_dark'), color: 'text-blue-400' },
        { id: 'system', icon: FaDesktop, label: t('settings.theme_system') === 'settings.theme_system' ? 'System' : t('settings.theme_system'), color: 'text-gray-400' }
    ];

    const currentTheme = themes.find(t => t.id === theme) || themes[2];

    if (variant === 'cycle') {
        const cycleTheme = () => {
            const order = ['light', 'dark', 'system'];
            const currentIndex = order.indexOf(theme !== 'light' && theme !== 'dark' && theme !== 'system' ? 'system' : theme);
            const nextTheme = order[(currentIndex + 1) % order.length];
            handleThemeChange(nextTheme);
        };

        return (
            <button
                onClick={cycleTheme}
                className={`p-2 hover:bg-white/20 rounded-lg transition-colors flex items-center justify-center ${className}`}
                title={`Current theme: ${currentTheme.label}. Click to cycle.`}
                aria-label="Toggle theme"
            >
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={theme}
                        initial={{ opacity: 0, rotate: -90, scale: 0.8 }}
                        animate={{ opacity: 1, rotate: 0, scale: 1 }}
                        exit={{ opacity: 0, rotate: 90, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                    >
                        <currentTheme.icon className={`text-xl ${currentTheme.color}`} />
                    </motion.div>
                </AnimatePresence>
            </button>
        );
    }

    if (mobile) {
        return (
            <div className="flex flex-col gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 transition-all duration-300">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Appearance</p>
                <div className="flex gap-2">
                    {themes.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => handleThemeChange(t.id)}
                            className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${theme === t.id
                                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700'
                                }`}
                        >
                            <t.icon className={`text-lg ${theme === t.id ? t.color : ''}`} />
                            <span className="text-[10px] font-medium">{t.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 text-white hover:text-yellow-300 focus:outline-none transition-all duration-300 hover:bg-white/10 rounded-lg flex items-center gap-1"
                title="Change Theme"
            >
                <currentTheme.icon className={`${currentTheme.color} text-lg`} />
                <FaChevronDown className={`text-[10px] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 py-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                    {themes.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => handleThemeChange(t.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${theme === t.id
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                        >
                            <t.icon className={`${t.color} text-base`} />
                            <span>{t.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ThemeToggle;
