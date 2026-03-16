import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaCookieBite, FaTimes, FaExternalLinkAlt } from 'react-icons/fa';

const ThirdPartyCookieBanner = () => {
    const [isVisible, setIsVisible] = useState(false);
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

    useEffect(() => {
        const checkThirdPartyCookies = async () => {
            // Check if previously dismissed (using v2 key to ensure it shows again for debugging/new logic)
            // We no longer check localStorage, ensuring prompt appears if issue persists.

            try {
                // Step 1: Set test cookie (SameSite=None; Secure)
                await fetch(`${API_BASE_URL}/api/auth/cookie-test/set`, {
                    credentials: 'include',
                    method: 'GET'
                });

                // Step 2: Check if cookie persisted
                const res = await fetch(`${API_BASE_URL}/api/auth/cookie-test/check`, {
                    credentials: 'include',
                    method: 'GET'
                });

                if (res.ok) {
                    const data = await res.json();

                    if (data.enabled === false) {
                        // Only show if cookies are NOT enabled (blocked)
                        setIsVisible(true);
                    }
                }
            } catch (error) {
                // If checking fails (e.g. network error, or request blocked by browser privacy tools), 
                // it is likely that third-party access is restricted.
                console.warn('[CookieCheck] Check failed, assuming blocked:', error);
                setIsVisible(true);
            }
        };

        // Delay check slightly to avoid impact on initial load
        const timer = setTimeout(checkThirdPartyCookies, 2000);
        return () => clearTimeout(timer);
    }, []);

    const handleDismiss = () => {
        // Only dismiss for the current session info
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return createPortal(
        <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:right-6 sm:left-auto z-[8000] px-4 pb-4 sm:pb-0 sm:px-0 sm:max-w-md w-full animate-slide-up">
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/10 relative">
                {/* Header with Color Strip */}
                <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

                <button
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors z-10 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700/50"
                    aria-label="Dismiss message"
                >
                    <FaTimes size={16} />
                </button>

                <div className="p-5 sm:p-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4">
                        <div className="flex-shrink-0 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl sm:p-3 sm:rounded-full">
                            <FaCookieBite className="text-blue-600 dark:text-blue-400 text-2xl sm:text-xl" />
                        </div>

                        <div className="flex-1 w-full">
                            <h3 className="font-bold text-gray-900 dark:text-white text-lg sm:text-base mb-1.5">
                                Login Requirement
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                                To sign in, please <strong>enable Third-Party Cookies</strong> (or Cross-Site Tracking) in your browser.
                                <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 block opacity-80">
                                    Required because our secure backend is on a separate domain.
                                </span>
                            </p>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2">
                                <button
                                    onClick={() => window.open('https://support.google.com/accounts/answer/61416?hl=en', '_blank')}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 border border-blue-500/20"
                                >
                                    How to Enable <FaExternalLinkAlt size={11} className="opacity-80" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes slide-up {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up {
                    animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
        </div>
        , document.body);
};

export default ThirdPartyCookieBanner;
