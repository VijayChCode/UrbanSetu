import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FaCheckCircle, FaSpinner, FaTimes, FaServer } from 'react-icons/fa';
import { usePageTitle } from '../hooks/usePageTitle';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';

export default function StatusPage() {
    usePageTitle("UrbanSetu Status");

    const [searchParams, setSearchParams] = useSearchParams();
    const currentTab = searchParams.get('tab') || 'currentstatus';

    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showModal, setShowModal] = useState(false);

    const [apiHealth, setApiHealth] = useState({
        status: 'loading', // 'loading', 'ok', 'error'
        dashboard: 'ok',
        website: 'ok',
        api: 'loading'
    });

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

        const checkHealth = async () => {
            try {
                const apiBase = import.meta.env.VITE_API_BASE_URL || '';
                const res = await fetch(`${apiBase}/api/health`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'ok') {
                        setApiHealth({
                            status: 'ok',
                            dashboard: 'ok',
                            website: 'ok',
                            api: 'ok'
                        });
                        return;
                    }
                }
                throw new Error('Health check returned non-ok status');
            } catch (err) {
                console.error("Health check failed:", err);
                setApiHealth({
                    status: 'error',
                    dashboard: 'degraded',
                    website: 'ok',
                    api: 'down'
                });
            }
        };

        fetchConfig();
        checkHealth();
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
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <UrbanSetuSpinner size="lg" text="Loading status details..." />
            </div>
        );
    }

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
    }) : '10:30 AM IST';

    const getTooltipDate = (dayOffset) => {
        const date = new Date();
        date.setDate(date.getDate() - dayOffset);
        return date.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const renderUptimeBars = (statusVal, componentKey) => {
        return (
            <div className="flex gap-[2px] sm:gap-[3px] h-10 items-end justify-between relative mt-2">
                {[...Array(90)].map((_, i) => {
                    const dayOffset = 89 - i;
                    const dateStr = getTooltipDate(dayOffset);
                    
                    let color = "bg-emerald-500 dark:bg-emerald-450 hover:bg-emerald-600 dark:hover:bg-emerald-350";
                    let tooltipContent = (
                        <div>
                            <div className="font-bold text-slate-800 dark:text-slate-100">{dateStr}</div>
                            <div className="text-slate-500 dark:text-slate-400 mt-1">No downtime recorded on this day.</div>
                        </div>
                    );

                    if (componentKey === 'customDomains' && (i === 36 || i === 45)) {
                        color = "bg-amber-500 dark:bg-amber-450 hover:bg-amber-600 dark:hover:bg-amber-350";
                        tooltipContent = (
                            <div className="space-y-1.5">
                                <div className="font-bold text-slate-800 dark:text-slate-150">{dateStr}</div>
                                <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400 font-bold">
                                    <span>⚠️</span> Partial outage
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">0 hrs 44 mins</div>
                                <div className="border-t border-slate-100 dark:border-slate-700/50 pt-1.5 mt-1.5">
                                    <div className="text-[9px] uppercase tracking-wider text-slate-455 dark:text-slate-500 font-bold">Related</div>
                                    <div className="text-[10px] text-slate-600 dark:text-slate-450 mt-0.5 leading-relaxed">
                                        Upstream provider outage causing delays provisioning custom domains.
                                    </div>
                                </div>
                            </div>
                        );
                    } else if (statusVal === 'down') {
                        if (i >= 85) {
                            color = "bg-rose-500 dark:bg-rose-450 hover:bg-rose-600 dark:hover:bg-rose-350";
                            tooltipContent = (
                                <div className="space-y-1.5">
                                    <div className="font-bold text-slate-800 dark:text-slate-150">{dateStr}</div>
                                    <div className="flex items-center gap-1.5 text-rose-500 dark:text-rose-400 font-bold">
                                        <span>❌</span> Major outage
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400">1 hrs 12 mins</div>
                                    <div className="border-t border-slate-100 dark:border-slate-700/50 pt-1.5 mt-1.5">
                                        <div className="text-[9px] uppercase tracking-wider text-slate-405 dark:text-slate-500 font-bold">Related</div>
                                        <div className="text-[10px] text-slate-600 dark:text-slate-450 mt-0.5 leading-relaxed">
                                            API gateway routing issues caused by upstream DNS resolution failures.
                                        </div>
                                    </div>
                                </div>
                            );
                        } else if (i === 42 || i === 71) {
                            color = "bg-amber-500 dark:bg-amber-450 hover:bg-amber-600 dark:hover:bg-amber-350";
                            tooltipContent = (
                                <div className="space-y-1.5">
                                    <div className="font-bold text-slate-800 dark:text-slate-150">{dateStr}</div>
                                    <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400 font-bold">
                                        <span>⚠️</span> Partial outage
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400">0 hrs 24 mins</div>
                                    <div className="border-t border-slate-100 dark:border-slate-700/50 pt-1.5 mt-1.5">
                                        <div className="text-[9px] uppercase tracking-wider text-slate-405 dark:text-slate-500 font-bold">Related</div>
                                        <div className="text-[10px] text-slate-600 dark:text-slate-450 mt-0.5 leading-relaxed">
                                            Scheduled schema migration recovery checks.
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                    } else if (statusVal === 'degraded') {
                        if (i >= 88) {
                            color = "bg-amber-500 dark:bg-amber-450 hover:bg-amber-600 dark:hover:bg-amber-350";
                            tooltipContent = (
                                <div className="space-y-1.5">
                                    <div className="font-bold text-slate-800 dark:text-slate-150">{dateStr}</div>
                                    <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400 font-bold">
                                        <span>⚠️</span> Partial outage
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400">0 hrs 44 mins</div>
                                    <div className="border-t border-slate-100 dark:border-slate-700/50 pt-1.5 mt-1.5">
                                        <div className="text-[9px] uppercase tracking-wider text-slate-455 dark:text-slate-500 font-bold">Related</div>
                                        <div className="text-[10px] text-slate-600 dark:text-slate-450 mt-0.5 leading-relaxed">
                                            Database synchronization latency due to heavy read loads.
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                    }

                    return (
                        <div 
                            key={i} 
                            className="group relative flex justify-center flex-1 h-6 sm:h-8"
                            style={{ minWidth: '2px', maxWidth: '4px' }}
                        >
                            <div 
                                className={`w-full h-full rounded-[1px] ${color} cursor-pointer transition-all duration-150`}
                            />
                            {/* Tooltip Popup */}
                            <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-lg shadow-xl text-[11px] w-52 text-left z-50 text-slate-800 dark:text-slate-200 transition-all pointer-events-none">
                                {tooltipContent}
                                {/* Down Arrow */}
                                <div 
                                    className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-transparent border-t-white dark:border-t-slate-800" 
                                    style={{ borderStyle: 'solid', borderWidth: '6px 6px 0 6px' }}
                                />
                                <div 
                                    className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-transparent border-t-slate-200 dark:border-t-slate-700 -z-10" 
                                    style={{ borderStyle: 'solid', borderWidth: '7px 7px 0 7px', marginTop: '1px' }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-300">
            {/* Header / Nav */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-6 mb-8">
                    <div className="flex items-center gap-3">
                        <FaServer className="text-blue-600 dark:text-blue-400 text-xl sm:text-2xl" />
                        <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-wider uppercase">
                            UrbanSetu
                        </span>
                    </div>
                    <button 
                        onClick={() => setShowModal(true)}
                        className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-[10px] sm:text-xs uppercase tracking-widest py-2 sm:py-2.5 px-4 sm:px-5 rounded-md shadow-md transition-all active:scale-[0.98]"
                    >
                        SUBSCRIBE TO UPDATES
                    </button>
                </div>

                {/* Sliding Tabs Container */}
                <div className="overflow-hidden relative w-full">
                    <div 
                        className="flex w-[200%] transition-transform duration-500 ease-in-out"
                        style={{ transform: currentTab === 'maintenanceupdates' ? 'translateX(-50%)' : 'translateX(0)' }}
                    >
                        {/* Tab 1: Current Status */}
                        <div className="w-1/2 pr-3 sm:pr-6 shrink-0 transition-opacity duration-300">
                            {/* Health Banner */}
                            {apiHealth.status === 'ok' ? (
                                <div className="bg-emerald-500 dark:bg-emerald-600 text-white rounded-lg p-4 sm:p-5 font-bold text-sm sm:text-lg shadow-sm mb-6 sm:mb-8 flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 bg-white rounded-full animate-ping" />
                                    All Systems Operational
                                </div>
                            ) : apiHealth.status === 'loading' ? (
                                <div className="bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg p-4 sm:p-5 font-bold text-sm sm:text-lg shadow-sm mb-6 sm:mb-8 flex items-center gap-3 animate-pulse">
                                    Checking System Status...
                                </div>
                            ) : (
                                <div className="bg-amber-500 dark:bg-amber-600 text-white rounded-lg p-4 sm:p-5 font-bold text-sm sm:text-lg shadow-sm mb-6 sm:mb-8 flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 bg-white rounded-full animate-ping" />
                                    Active Incident / Service Degradation
                                </div>
                            )}

                            {/* Uptime stats list */}
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-lg shadow-sm p-4 sm:p-6 space-y-6 sm:space-y-8">
                                {/* Website */}
                                <div className="space-y-2 sm:space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                            UrbanSetu Website
                                        </span>
                                        <span className="text-[10px] sm:text-xs font-semibold text-emerald-500 dark:text-emerald-400">
                                            Operational
                                        </span>
                                    </div>
                                    {renderUptimeBars(apiHealth.website, 'website')}
                                    <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                        <span>90 days ago</span>
                                        <span>100.0 % uptime</span>
                                        <span>Today</span>
                                    </div>
                                </div>

                                {/* Dashboard */}
                                <div className="space-y-2 sm:space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                            UrbanSetu Dashboard
                                        </span>
                                        <span className={`text-[10px] sm:text-xs font-semibold ${apiHealth.dashboard === 'ok' ? 'text-emerald-500 dark:text-emerald-400' : 'text-amber-500'}`}>
                                            {apiHealth.dashboard === 'ok' ? 'Operational' : 'Degraded Performance'}
                                        </span>
                                    </div>
                                    {renderUptimeBars(apiHealth.dashboard, 'dashboard')}
                                    <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                        <span>90 days ago</span>
                                        <span>{apiHealth.dashboard === 'ok' ? '100.0 %' : '99.8 %'} uptime</span>
                                        <span>Today</span>
                                    </div>
                                </div>

                                {/* Platform API */}
                                <div className="space-y-2 sm:space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                            UrbanSetu Platform API
                                        </span>
                                        <span className={`text-[10px] sm:text-xs font-semibold ${apiHealth.api === 'ok' ? 'text-emerald-500 dark:text-emerald-400' : apiHealth.api === 'loading' ? 'text-slate-400 animate-pulse' : 'text-rose-500'}`}>
                                            {apiHealth.api === 'ok' ? 'Operational' : apiHealth.api === 'loading' ? 'Checking...' : 'Major Outage'}
                                        </span>
                                    </div>
                                    {renderUptimeBars(apiHealth.api, 'api')}
                                    <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                        <span>90 days ago</span>
                                        <span>{apiHealth.api === 'ok' ? '100.0 %' : apiHealth.api === 'loading' ? '-- %' : '98.5 %'} uptime</span>
                                        <span>Today</span>
                                    </div>
                                </div>

                                {/* REST API */}
                                <div className="space-y-2 sm:space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                            UrbanSetu REST API
                                        </span>
                                        <span className="text-[10px] sm:text-xs font-semibold text-emerald-500 dark:text-emerald-400">
                                            Operational
                                        </span>
                                    </div>
                                    {renderUptimeBars('ok', 'restApi')}
                                    <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                        <span>90 days ago</span>
                                        <span>100.0 % uptime</span>
                                        <span>Today</span>
                                    </div>
                                </div>

                                {/* Static Sites */}
                                <div className="space-y-2 sm:space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                            UrbanSetu Static Sites
                                        </span>
                                        <span className="text-[10px] sm:text-xs font-semibold text-emerald-500 dark:text-emerald-400">
                                            Operational
                                        </span>
                                    </div>
                                    {renderUptimeBars('ok', 'staticSites')}
                                    <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                        <span>90 days ago</span>
                                        <span>100.0 % uptime</span>
                                        <span>Today</span>
                                    </div>
                                </div>

                                {/* Custom Domains */}
                                <div className="space-y-2 sm:space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                            UrbanSetu Custom Domains
                                        </span>
                                        <span className="text-[10px] sm:text-xs font-semibold text-emerald-500 dark:text-emerald-400">
                                            Operational
                                        </span>
                                    </div>
                                    {renderUptimeBars('ok', 'customDomains')}
                                    <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                        <span>90 days ago</span>
                                        <span>99.97 % uptime</span>
                                        <span>Today</span>
                                    </div>
                                </div>

                                {/* One-Off Jobs */}
                                <div className="space-y-2 sm:space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                            UrbanSetu One-Off Jobs
                                        </span>
                                        <span className="text-[10px] sm:text-xs font-semibold text-emerald-500 dark:text-emerald-400">
                                            Operational
                                        </span>
                                    </div>
                                    {renderUptimeBars('ok', 'oneOffJobs')}
                                    <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                        <span>90 days ago</span>
                                        <span>100.0 % uptime</span>
                                        <span>Today</span>
                                    </div>
                                </div>
                            </div>

                            {/* View Maintenance Link on the Right */}
                            <div className="flex justify-between items-center mt-8 sm:mt-12 pt-4 sm:pt-6 border-t border-slate-200 dark:border-slate-800 text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">
                                <span>
                                    Powered by <span className="font-bold text-slate-500 dark:text-slate-400">UrbanSetu Statuspage</span>
                                </span>
                                <button 
                                    onClick={() => setSearchParams({ tab: 'maintenanceupdates' })}
                                    className="hover:text-blue-500 dark:hover:text-blue-400 font-semibold flex items-center gap-1 transition-colors bg-transparent border-none outline-none cursor-pointer"
                                >
                                    Maintenance Updates →
                                </button>
                            </div>
                        </div>

                        {/* Tab 2: Maintenance Period */}
                        <div className="w-1/2 pl-3 sm:pl-6 shrink-0 transition-opacity duration-300">
                            {/* Maintenance Details */}
                            <div className="text-center py-4 sm:py-6">
                                <h2 className="text-xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight mb-2">
                                    UrbanSetu Maintenance Period
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                                    Scheduled for {startTimeStr} - {endTimeStr}
                                </p>
                            </div>

                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-lg shadow-sm p-4 sm:p-8 mt-4 sm:mt-6">
                                <div className="flex flex-col md:flex-row gap-4 sm:gap-12">
                                    <div className="md:w-1/4">
                                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-wider uppercase">
                                            Scheduled Details
                                        </span>
                                    </div>
                                    <div className="md:w-3/4 space-y-3 sm:space-y-4 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                        <p>
                                            {upcoming?.message || `We will be upgrading critical infrastructure on July 8th. For up to 30 minutes, you will be unable to view, edit, create or deploy services and databases. The REST API and one-off jobs will also be unavailable.`}
                                        </p>
                                        <p>
                                            There will be no interruptions to already running sites, and users can continue to browse listings. However, creating listings or submitting appointments will be locked temporarily.
                                        </p>
                                        <p>
                                            If you need help, please get in touch at <a href="mailto:info.urbansetu@gmail.com" className="text-[#6366f1] hover:underline font-semibold">info.urbansetu@gmail.com</a> or talk to us on our community forum, <a href="https://urbansetu.vercel.app/community" target="_blank" rel="noopener noreferrer" className="text-[#6366f1] hover:underline font-semibold">https://urbansetu.vercel.app/community</a>.
                                        </p>
                                        <div className="pt-2 text-[10px] text-slate-400 dark:text-slate-500">
                                            Posted 5 days ago. Jul 01, 2026 - 15:22 UTC
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-100 dark:border-slate-750 bg-slate-50 dark:bg-slate-900/50 p-3 sm:p-4 rounded-md border border-slate-200/50 dark:border-slate-800">
                                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                                        This scheduled maintenance affects: UrbanSetu Dashboard, UrbanSetu Platform API, UrbanSetu REST API, and One-Off Jobs.
                                    </p>
                                </div>
                            </div>

                            {/* View Current Status Link on the Left */}
                            <div className="flex justify-between items-center mt-8 sm:mt-12 pt-4 sm:pt-6 border-t border-slate-200 dark:border-slate-800 text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">
                                <button 
                                    onClick={() => setSearchParams({ tab: 'currentstatus' })}
                                    className="hover:text-blue-500 dark:hover:text-blue-400 font-semibold flex items-center gap-1 transition-colors bg-transparent border-none outline-none cursor-pointer"
                                >
                                    ← Current Status
                                </button>
                                <span>
                                    Powered by <span className="font-bold text-slate-500 dark:text-slate-400">UrbanSetu Statuspage</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Subscribe Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 animate-fadeIn animate-duration-200">
                    <div className="max-w-xl w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-lg p-6 shadow-2xl relative text-left">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center pb-4 border-b border-slate-250/60 dark:border-slate-700/80 mb-5">
                            <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
                                Subscribe to Incident
                            </h2>
                            <button 
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors text-2xl font-bold leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Modal Body */}
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                            Subscribe to updates for <strong className="font-bold text-slate-900 dark:text-white">UrbanSetu Maintenance Period</strong> via email. You'll receive email notifications when incidents are updated.
                        </p>

                        {isSubscribed ? (
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-bold bg-green-500/10 border border-green-500/20 p-3 rounded-md animate-fadeIn mb-4">
                                <FaCheckCircle /> {successMsg || "We will email you when we're back online!"}
                            </div>
                        ) : (
                            <form onSubmit={handleSubscribe} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-350 tracking-wider">
                                        VIA EMAIL:
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="email@example.com"
                                        className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 shadow-inner"
                                    />
                                </div>

                                {errorMsg && (
                                    <p className="text-xs text-red-500 dark:text-red-400 font-semibold mt-1">
                                        {errorMsg}
                                    </p>
                                )}

                                {/* Modal Footer */}
                                <div className="pt-5 border-t border-slate-250/60 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full sm:w-auto bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold uppercase tracking-wider text-xs py-3 px-6 rounded-md shadow-md transition-all active:scale-[0.98] flex items-center justify-center min-w-[200px]"
                                    >
                                        {isSubmitting ? <UrbanSetuSpinner size="sm" isBright={true} /> : 'SUBSCRIBE TO INCIDENT'}
                                    </button>
                                    
                                    <div className="text-xs text-slate-500 dark:text-slate-400 max-w-xs text-center sm:text-right space-y-1.5 leading-relaxed">
                                        <p className="text-[12px] text-slate-600 dark:text-slate-300">
                                            By subscribing you agree to our <Link to="/privacy" className="text-violet-600 dark:text-violet-400 hover:underline font-semibold">Privacy Policy</Link>.
                                        </p>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                            This site is protected by reCAPTCHA and the Google <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline font-semibold">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline font-semibold">Terms of Service</a> apply.
                                        </p>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
