import React, { useState, useEffect } from 'react';
import { LogOut, AlertCircle, RefreshCw, XCircle, ShieldOff } from 'lucide-react';
import UrbanSetuSpinner from './UrbanSetuSpinner';
import { useSelector, useDispatch } from 'react-redux';
import { useSignout } from '../hooks/useSignout';
import { resetSignoutState } from '../redux/user/userSlice';

import { motion, AnimatePresence } from 'framer-motion';

export default function SignoutModal() {
    const [index, setIndex] = useState(0);
    const { error } = useSelector((state) => state.user);
    const dispatch = useDispatch();
    const { signout } = useSignout();

    const states = [
        { title: "Signing Out...", subtitle: "Thank you for using UrbanSetu" },
        { title: "Securing Data...", subtitle: "Encrypting and closing session" },
        { title: "Clearing Cache...", subtitle: "Removing temporary files" },
        { title: "Almost Done...", subtitle: "Ensuring your account is safe" },
        { title: "Logging Off...", subtitle: "See you again soon!" }
    ];

    useEffect(() => {
        if (error) return; // Stop cycling if there's an error

        let timeoutId;
        const nextState = () => {
            setIndex((prev) => {
                const next = (prev + 1) % states.length;
                const duration = next === states.length - 1 ? 3000 : 1500;
                timeoutId = setTimeout(nextState, duration);
                return next;
            });
        };

        timeoutId = setTimeout(nextState, 1500);
        return () => clearTimeout(timeoutId);
    }, [states.length, error]);

    const handleRetry = () => {
        signout({ showToast: true, navigateTo: "/", delay: 0 });
    };

    const handleForceSignout = () => {
        signout({ forceLocal: true, navigateTo: "/" });
    };

    const handleCancel = () => {
        dispatch(resetSignoutState());
    };

    const current = states[index];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999] animate-fade-in">
            <style>{`
                @keyframes slideUpFade {
                    0% { opacity: 0; transform: translateY(10px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slideUpFade 0.5s ease-out forwards;
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                .animate-shake {
                    animation: shake 0.2s ease-in-out 0s 2;
                }
            `}</style>
            <div className={`bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-6 max-w-sm w-full mx-4 transform transition-all duration-300 ${error ? 'border-2 border-red-500 animate-shake' : 'scale-100 animate-bounce-small'}`}>
                <AnimatePresence mode="wait">
                    {error ? (
                        <motion.div
                            key="error-state"
                            initial={{ scale: 0, rotate: -180, opacity: 0 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            exit={{ scale: 0, rotate: 180, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 260, damping: 20 }}
                            className="flex flex-col items-center gap-6 w-full"
                        >
                            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shadow-lg shadow-red-500/20">
                                <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-500" />
                            </div>
                            <div className="text-center w-full">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Sign Out Failed</h3>
                                <p className="text-red-500 dark:text-red-400 text-sm font-medium mb-1">
                                    {error}
                                </p>
                                <p className="text-gray-500 dark:text-gray-400 text-xs">
                                    A network error occurred while closing your session.
                                </p>
                            </div>
                            <div className="flex flex-col w-full gap-3">
                                <button
                                    onClick={handleRetry}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/30 active:scale-95"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Retry Connection
                                </button>
                                <button
                                    onClick={handleForceSignout}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold transition-all active:scale-95"
                                >
                                    <ShieldOff className="w-4 h-4" />
                                    Sign Out Locally
                                </button>
                                <button
                                    onClick={handleCancel}
                                    className="w-full flex items-center justify-center gap-2 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm font-medium transition-all"
                                >
                                    <XCircle className="w-4 h-4" />
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="loading-state"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="flex flex-col items-center gap-6 w-full"
                        >
                            <div className="relative">
                                <UrbanSetuSpinner size="xl" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <LogOut className="text-blue-600 dark:text-blue-400 text-lg" />
                                </div>
                            </div>
                            <div className="text-center w-full">
                                <h3 key={`title-${index}`} className="text-xl font-bold text-gray-900 dark:text-white animate-slide-up min-h-[28px]">
                                    {current.title}
                                </h3>
                                <p key={`sub-${index}`} className="text-gray-500 dark:text-gray-400 text-sm mt-2 animate-slide-up min-h-[20px]">
                                    {current.subtitle}
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
