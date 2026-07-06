import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaCheckCircle, FaSpinner, FaTimes } from 'react-icons/fa';
import { usePageTitle } from '../hooks/usePageTitle';

export default function StatusPage() {
    usePageTitle("UrbanSetu Status - Maintenance Period");
    
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const apiBase = import.meta.env.VITE_API_BASE_URL || '';
                const res = await fetch(`${apiBase}/api/config`);
                if (res.ok) {
                    const resJson = await res.json();
                    if (resJson && resJson.success && resJson.data) {
                        setConfig(resJson.data);
                    }
                }
            } catch (err) {
                console.error("Failed to load status config:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, []);

    const handleSubscribe = async (e) => {
        e.preventDefault();
        if (!email) return;

        setIsSubmitting(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const apiBase = import.meta.env.VITE_API_BASE_URL || '';
            const res = await fetch(`${apiBase}/api/config/maintenance-notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setIsSubscribed(true);
                setSuccessMsg(data.message || "We will email you when we're back online!");
                setEmail('');
                setTimeout(() => {
                    setShowModal(false);
                    setIsSubscribed(false);
                }, 3000);
            } else {
                setErrorMsg(data.message || "Failed to register notification.");
            }
        } catch (err) {
            console.error('Error registering notification:', err);
            setErrorMsg("Network error. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
                <FaSpinner className="animate-spin text-indigo-600 text-3xl" />
            </div>
        );
    }

    // Determine values
    const upcoming = config?.upcomingMaintenance;
    
    // Format times
    const startTimeStr = upcoming?.startTime ? new Date(upcoming.startTime).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    }) : 'Jul 8, 08:30 AM IST';

    const endTimeStr = config?.maintenance?.endTime ? new Date(config.maintenance.endTime).toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    }) : '09:30 AM IST';

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
            {/* Header / Nav */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="text-center py-8">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-blue-650 dark:text-blue-400 tracking-tight mb-2">
                        UrbanSetu Maintenance Period
                    </h1>
                    <p className="text-base text-slate-500 dark:text-slate-400 font-medium">
                        Scheduled for {startTimeStr} - {endTimeStr}
                    </p>

                    <button 
                        onClick={() => setShowModal(true)}
                        className="mt-6 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-xs uppercase tracking-widest py-3 px-6 rounded-md shadow-md transition-all active:scale-[0.98]"
                    >
                        SUBSCRIBE TO UPDATES
                    </button>
                </div>

                {/* Main incident details */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/85 rounded-lg shadow-sm p-6 md:p-8 mt-6">
                    <div className="flex flex-col md:flex-row gap-6 md:gap-12">
                        <div className="md:w-1/4">
                            <span className="text-base font-bold text-slate-900 dark:text-white tracking-wider">
                                Scheduled
                            </span>
                        </div>
                        <div className="md:w-3/4 space-y-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            <p>
                                {upcoming?.message || `We will be upgrading critical infrastructure on July 8th. For up to 30 minutes, you will be unable to view, edit, create or deploy services and databases. The REST API and one-off jobs will also be unavailable.`}
                            </p>
                            <p>
                                There will be no interruptions to already running sites, and users can continue to browse listings. However, creating listings or submitting appointments will be locked temporarily.
                            </p>
                            <p>
                                If you need help, please get in touch at <a href="mailto:support@urbansetu.com" className="text-[#6366f1] hover:underline font-semibold">support@urbansetu.com</a> or talk to us on our community forum, <a href="https://community.urbansetu.com" target="_blank" rel="noopener noreferrer" className="text-[#6366f1] hover:underline font-semibold">https://community.urbansetu.com</a>.
                            </p>
                            <div className="pt-2 text-xs text-slate-400 dark:text-slate-500">
                                Posted 5 days ago. Jul 01, 2026 - 15:22 UTC
                            </div>
                        </div>
                    </div>

                    {/* Affected Services block */}
                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-md border border-slate-200/50 dark:border-slate-800">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                            This scheduled maintenance affects: UrbanSetu Dashboard, UrbanSetu Platform API, UrbanSetu REST API, and One-Off Jobs.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center mt-12 pt-6 border-t border-slate-200 dark:border-slate-700/60 text-xs text-slate-400 dark:text-slate-500">
                    <Link to="/" className="hover:text-blue-500 font-semibold flex items-center gap-1 transition-colors">
                        ← Current Status
                    </Link>
                    <span>
                        Powered by <span className="font-bold text-slate-550 dark:text-slate-450">UrbanSetu Statuspage</span>
                    </span>
                </div>
            </div>

            {/* Subscribe Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn animate-duration-200">
                    <div className="max-w-md w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 shadow-2xl relative text-left">
                        <button 
                            onClick={() => setShowModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 dark:hover:text-white transition-colors"
                        >
                            <FaTimes className="text-lg" />
                        </button>

                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                            Subscribe to Updates
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                            Enter your email to receive automated email notifications when this maintenance period starts and ends.
                        </p>

                        {isSubscribed ? (
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-bold bg-green-500/10 border border-green-500/20 p-3 rounded-xl animate-fadeIn">
                                <FaCheckCircle /> {successMsg || "Notification registered! We will email you once we are back online."}
                            </div>
                        ) : (
                            <form onSubmit={handleSubscribe} className="space-y-3">
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center"
                                >
                                    {isSubmitting ? <FaSpinner className="animate-spin" /> : 'Subscribe'}
                                </button>
                                {errorMsg && (
                                    <p className="text-xs text-red-500 dark:text-red-400 font-semibold mt-1">
                                        {errorMsg}
                                    </p>
                                )}
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
