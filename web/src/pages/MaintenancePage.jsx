import React, { useState, useEffect } from 'react';
import { 
  FaTools, 
  FaHome, 
  FaSpinner, 
  FaPaperPlane, 
  FaEnvelope, 
  FaPhoneAlt, 
  FaTwitter, 
  FaFacebook, 
  FaInstagram, 
  FaYoutube, 
  FaServer, 
  FaCheckCircle, 
  FaExclamationCircle 
} from 'react-icons/fa';
import { usePageTitle } from '../hooks/usePageTitle';

const MaintenancePage = ({ config = {}, onRetry }) => {
    usePageTitle("Server Under Maintenance");

    // Extract configurations with fallbacks
    const message = config.message || "We're currently renovating our digital infrastructure to serve you better. Just like a prime property, quality takes time. We'll be back online shortly to help you find your dream space.";
    const endTime = config.endTime || null;

    // States
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    const [activeStep, setActiveStep] = useState(0);
    const [progress, setProgress] = useState(0);
    const [email, setEmail] = useState('');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [pingStatus, setPingStatus] = useState('idle'); // idle, pinging, online, offline
    const [pingLogs, setPingLogs] = useState([]);

    const steps = [
        "Migrating listings database",
        "Auditing security keys",
        "Rebuilding search indexes",
        "Warming edge cache nodes",
        "Running validation suite"
    ];

    // 1. Progress steps animation
    useEffect(() => {
        const stepInterval = setInterval(() => {
            setActiveStep((prev) => {
                const next = prev + 1;
                if (next >= steps.length) {
                    return steps.length - 1; // Hold at the last step
                }
                return next;
            });
        }, 8000);

        const progressInterval = setInterval(() => {
            setProgress((prev) => {
                const next = prev + 0.5;
                if (next >= 98) {
                    return 98; // Don't reach 100% until backend is verified online
                }
                return next;
            });
        }, 200);

        return () => {
            clearInterval(stepInterval);
            clearInterval(progressInterval);
        };
    }, [steps.length]);

    // 2. Countdown Timer
    useEffect(() => {
        if (!endTime) {
            // If no end time, set a mock countdown of 45 minutes for visual feedback
            const mockEndTime = new Date(Date.now() + 45 * 60 * 1000).toISOString();
            updateTimer(mockEndTime);
            const timer = setInterval(() => updateTimer(mockEndTime), 1000);
            return () => clearInterval(timer);
        }

        updateTimer(endTime);
        const timer = setInterval(() => updateTimer(endTime), 1000);
        return () => clearInterval(timer);
    }, [endTime]);

    const updateTimer = (targetTime) => {
        const difference = +new Date(targetTime) - +new Date();
        if (difference <= 0) {
            setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
            return;
        }

        setTimeLeft({
            days: Math.floor(difference / (1000 * 60 * 60 * 24)),
            hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
            minutes: Math.floor((difference / 1000 / 60) % 60),
            seconds: Math.floor((difference / 1000) % 60)
        });
    };

    // 3. Email Subscription handler
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
            } else {
                setErrorMsg(data.message || "Failed to register notification.");
            }
        } catch (err) {
            console.error('Error registering notification:', err);
            setErrorMsg("Network error. Please check your internet connection.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // 4. Interactive Server Ping
    const handlePingServer = async () => {
        setPingStatus('pinging');
        setPingLogs([`[${new Date().toLocaleTimeString()}] Pinging UrbanSetu API gateway...`]);

        await new Promise(resolve => setTimeout(resolve, 1200));

        try {
            const apiBase = import.meta.env.VITE_API_BASE_URL || '';
            // Ping health endpoint
            const res = await fetch(`${apiBase}/api/health`);
            if (res.ok) {
                const data = await res.json();
                
                // Also check if maintenance mode is enabled on the server config
                const configRes = await fetch(`${apiBase}/api/config`);
                let maintenanceEnabled = false;
                if (configRes.ok) {
                    const configData = await configRes.json();
                    if (configData && configData.success && configData.data && configData.data.maintenance) {
                        maintenanceEnabled = configData.data.maintenance.enabled;
                    }
                }

                if (!maintenanceEnabled) {
                    setPingStatus('online');
                    setPingLogs(prev => [
                        ...prev,
                        `[${new Date().toLocaleTimeString()}] Connection established: 200 OK`,
                        `[${new Date().toLocaleTimeString()}] Version: ${data.version || '2.0.0'}`,
                        `[${new Date().toLocaleTimeString()}] Maintenance mode: DISABLED`,
                        `[${new Date().toLocaleTimeString()}] Server is online! Redirecting...`
                    ]);
                    // Auto reload after 2 seconds
                    setTimeout(() => {
                        if (onRetry) {
                            onRetry();
                        } else {
                            window.location.reload();
                        }
                    }, 2000);
                } else {
                    setPingStatus('offline');
                    setPingLogs(prev => [
                        ...prev,
                        `[${new Date().toLocaleTimeString()}] Connection established: 200 OK`,
                        `[${new Date().toLocaleTimeString()}] Maintenance mode: ACTIVE`,
                        `[${new Date().toLocaleTimeString()}] Reason: Renovating servers. Please wait.`
                    ]);
                }
            } else {
                setPingStatus('offline');
                setPingLogs(prev => [
                    ...prev,
                    `[${new Date().toLocaleTimeString()}] Gateway error: ${res.status} ${res.statusText}`,
                    `[${new Date().toLocaleTimeString()}] Remote server refused handshake.`
                ]);
            }
        } catch (err) {
            setPingStatus('offline');
            setPingLogs(prev => [
                ...prev,
                `[${new Date().toLocaleTimeString()}] Network error: Request timed out`,
                `[${new Date().toLocaleTimeString()}] Please check your internet connection.`
            ]);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 flex flex-col items-center justify-center p-4 md:p-8 text-center relative overflow-hidden transition-colors duration-300">
            {/* Grid blueprint pattern overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(rgba(99,102,241,0.1)_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(99,102,241,0.15)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>

            {/* Glowing ambient lights */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/10 dark:bg-blue-600/10 rounded-full filter blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400/10 dark:bg-purple-600/10 rounded-full filter blur-3xl pointer-events-none"></div>

            <div className="max-w-3xl w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-12 border border-slate-100 dark:border-slate-800/80 relative z-10">
                {/* Brand Header */}
                <div className="flex items-center justify-center gap-3 mb-6">
                    <span className="text-3xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                        UrbanSetu
                    </span>
                    <span className="px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full">
                        v2.0
                    </span>
                </div>

                {/* Animated Logo Container */}
                <div className="relative mb-8 flex justify-center">
                    <div className="absolute inset-0 bg-indigo-500/15 rounded-full animate-ping opacity-30 max-w-[120px] max-h-[120px] mx-auto"></div>
                    <div className="relative bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-7 rounded-full shadow-xl">
                        <FaTools className="text-5xl text-white animate-pulse" />
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl md:text-5xl font-black text-slate-800 dark:text-white mb-4 tracking-tight leading-tight">
                    Under Construction
                </h1>

                {/* Real Estate Themed Message */}
                <p className="text-slate-600 dark:text-slate-300 text-base md:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
                    {message}
                </p>

                {/* Countdown Timer */}
                <div className="grid grid-cols-4 gap-3 md:gap-4 max-w-md mx-auto mb-8">
                    {[
                        { label: 'Days', value: timeLeft.days },
                        { label: 'Hours', value: timeLeft.hours },
                        { label: 'Mins', value: timeLeft.minutes },
                        { label: 'Secs', value: timeLeft.seconds }
                    ].map((item, idx) => (
                        <div key={idx} className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl p-3 flex flex-col items-center justify-center transition-all duration-200">
                            <span className="text-2xl md:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                                {String(item.value).padStart(2, '0')}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">
                                {item.label}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Live Progress Section */}
                <div className="max-w-md mx-auto bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 mb-8">
                    <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                        <span className="flex items-center gap-1.5">
                            <FaSpinner className="animate-spin text-indigo-500" />
                            {steps[activeStep]}...
                        </span>
                        <span className="font-mono">{Math.floor(progress)}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-300 ease-out shadow-inner"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>

                {/* Interactive Status & Subscription Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-10 text-left">
                    {/* Subscription Form */}
                    <div className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50 rounded-2xl p-5 md:p-6 flex flex-col justify-between">
                        <div>
                            <h3 className="font-bold text-slate-850 dark:text-white mb-2 flex items-center gap-2">
                                <FaPaperPlane className="text-indigo-500 text-sm" /> Get Notified
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                                Enter your email to receive an alert as soon as we're back online.
                            </p>
                        </div>
                        {isSubscribed ? (
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-bold bg-green-500/10 border border-green-500/20 p-3 rounded-xl">
                                <FaCheckCircle /> {successMsg || "We will email you when we're back online!"}
                            </div>
                        ) : (
                            <div className="w-full">
                                <form onSubmit={handleSubscribe} className="flex gap-2">
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter your email"
                                        className="flex-1 px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all active:scale-[0.98] flex items-center justify-center min-w-[70px]"
                                    >
                                        {isSubmitting ? <FaSpinner className="animate-spin" /> : 'Notify'}
                                    </button>
                                </form>
                                {errorMsg && (
                                    <p className="text-xs text-red-500 dark:text-red-400 font-semibold mt-2 text-left">
                                        {errorMsg}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Interactive Ping Console */}
                    <div className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50 rounded-2xl p-5 md:p-6 flex flex-col justify-between">
                        <div>
                            <h3 className="font-bold text-slate-850 dark:text-white mb-2 flex items-center gap-2">
                                <FaServer className="text-indigo-500 text-sm" /> Live Server Status
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                                Ping the server to check if systems are operational.
                            </p>
                        </div>

                        {pingStatus !== 'idle' ? (
                            <div className="flex-1 flex flex-col justify-between">
                                <div className="bg-slate-900 text-slate-200 rounded-xl p-3 font-mono text-[10px] space-y-1 mb-3 overflow-y-auto max-h-[75px] border border-slate-800">
                                    {pingLogs.map((log, index) => (
                                        <div key={index} className="truncate">{log}</div>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                                        {pingStatus === 'pinging' && (
                                            <>
                                                <FaSpinner className="animate-spin text-amber-500" />
                                                <span className="text-amber-500">Checking...</span>
                                            </>
                                        )}
                                        {pingStatus === 'online' && (
                                            <>
                                                <FaCheckCircle className="text-green-500" />
                                                <span className="text-green-500">Back Online!</span>
                                            </>
                                        )}
                                        {pingStatus === 'offline' && (
                                            <>
                                                <FaExclamationCircle className="text-red-500 animate-pulse" />
                                                <span className="text-red-500">Still Offline</span>
                                            </>
                                        )}
                                    </span>
                                    <button
                                        onClick={handlePingServer}
                                        disabled={pingStatus === 'pinging'}
                                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                    >
                                        Ping Again
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={handlePingServer}
                                className="w-full py-3 bg-slate-200/50 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                <FaServer /> Check Connection Status
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer Info / Support */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-6 mt-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-500 dark:text-slate-400 mb-6">
                        <div className="flex items-center gap-2 justify-center sm:justify-start">
                            <FaEnvelope className="text-indigo-500" />
                            <span>info.urbansetu@gmail.com</span>
                        </div>
                        <div className="flex items-center gap-2 justify-center sm:justify-end">
                            <FaPhoneAlt className="text-indigo-500" />
                            <span>+1 (970) 446-3758</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between flex-col sm:flex-row gap-4">
                        <div className="flex gap-4">
                            <a href="https://x.com/Vijay09862" target="_blank" rel="noreferrer" title="X" className="text-slate-450 hover:text-indigo-500 transition-colors">
                                <FaTwitter className="text-lg" />
                            </a>
                            <a href="https://facebook.com/vijaychalendra09" target="_blank" rel="noreferrer" title="Facebook" className="text-slate-450 hover:text-indigo-500 transition-colors">
                                <FaFacebook className="text-lg" />
                            </a>
                            <a href="https://instagram.com/vijaychalendra09" target="_blank" rel="noreferrer" title="Instagram" className="text-slate-450 hover:text-indigo-500 transition-colors">
                                <FaInstagram className="text-lg" />
                            </a>
                            <a href="https://www.youtube.com/@UrbanSetu-realestate" target="_blank" rel="noreferrer" title="YouTube" className="text-slate-450 hover:text-indigo-500 transition-colors">
                                <FaYoutube className="text-lg" />
                            </a>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                            UrbanSetu &copy; {new Date().getFullYear()} • Prime Digital Real Estate
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MaintenancePage;
