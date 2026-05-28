import React from 'react';
import { FaServer, FaExclamationTriangle, FaSync, FaArrowRight } from 'react-icons/fa';
import UrbanSetuSpinner from './UrbanSetuSpinner';
import SEO from './SEO';

class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            redirectCountdown: 10,
            reloadCount: parseInt(sessionStorage.getItem('err_reload_count') || '0'),
            isReloading: false
        };
        this.timer = null;
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);

        // Report to backend monitor via VisitorTracker mechanism
        try {
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
            const userInfoStr = localStorage.getItem('persist:root');
            let userInfo = undefined;

            if (userInfoStr) {
                try {
                    const parsed = JSON.parse(userInfoStr);
                    const user = JSON.parse(parsed.user);
                    if (user && user.currentUser) {
                        userInfo = {
                            userId: user.currentUser._id,
                            username: user.currentUser.username,
                            email: user.currentUser.email,
                            role: user.currentUser.role
                        };
                    }
                } catch (e) { }
            }

            const body = {
                type: 'heartbeat', // Use heartbeat to avoid triggering a new pageview in logs
                userInfo,
                page: window.location.pathname,
                source: window.location.hostname,
                metrics: {
                    errors: [{
                        message: `React Error: ${error.message || 'Unknown'}`,
                        stack: error.stack?.slice(0, 1000),
                        source: 'GlobalErrorBoundary',
                        timestamp: new Date()
                    }]
                }
            };

            fetch(`${API_BASE_URL}/api/visitors/track`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }).catch(() => { });
        } catch (e) {
            console.error("Failed to report error:", e);
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.hasError && !prevState.hasError) {
            this.startRedirectCountdown();
        }
    }

    componentWillUnmount() {
        if (this.timer) clearInterval(this.timer);
    }

    startRedirectCountdown = () => {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            this.setState((prev) => {
                if (prev.redirectCountdown <= 1) {
                    clearInterval(this.timer);
                    this.handleAutoAction();
                    return { redirectCountdown: 0 };
                }
                return { redirectCountdown: prev.redirectCountdown - 1 };
            });
        }, 1000);
    };

    getAlternativeUrl = () => {
        const currentHost = window.location.hostname;
        const token = localStorage.getItem('accessToken');
        const sessionId = localStorage.getItem('sessionId');
        const refreshToken = localStorage.getItem('refreshToken');
        const params = new URLSearchParams(window.location.search);

        if (token) params.set('transfer_token', token);
        if (sessionId) params.set('transfer_session', sessionId);
        if (refreshToken) params.set('transfer_refresh', refreshToken);

        const newSearch = params.toString();
        const suffix = newSearch ? `?${newSearch}` : '';

        if (currentHost.includes('vercel.app')) {
            return `https://urbansetuglobal.onrender.com${window.location.pathname}${suffix}`;
        } else if (currentHost.includes('onrender.com')) {
            return `https://urbansetu.vercel.app${window.location.pathname}${suffix}`;
        }
        return null;
    };

    handleAutoAction = () => {
        const { reloadCount } = this.state;
        if (reloadCount < 3) {
            sessionStorage.setItem('err_reload_count', (reloadCount + 1).toString());
            window.location.reload();
        } else {
            this.handleSwitchServer();
        }
    };

    handleReloadNow = () => {
        const { reloadCount } = this.state;
        this.setState({ isReloading: true });
        sessionStorage.setItem('err_reload_count', (reloadCount + 1).toString());
        setTimeout(() => {
            window.location.reload();
        }, 100);
    };

    handleSwitchServer = () => {
        sessionStorage.removeItem('err_reload_count');
        const altUrl = this.getAlternativeUrl();
        if (altUrl) {
            window.location.href = altUrl;
        } else {
            window.location.reload();
        }
    };

    render() {
        if (this.state.hasError) {
            const altUrl = this.getAlternativeUrl();
            const { reloadCount } = this.state;

            return (
                <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
                    <SEO
                        title="Something Went Wrong - UrbanSetu"
                        description="UrbanSetu is experiencing a temporary service disruption. Our system is working to self-heal and restore your session."
                        noindex={true}
                    />
                    
                    {/* Glowing aesthetic backdrop blobs */}
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full filter blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>

                    <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 text-center shadow-2xl relative z-10">
                        {/* Header logo */}
                        <div className="flex flex-col items-center mb-8">
                            <div className="flex items-center gap-3">
                                <img
                                    src="/favicon.png"
                                    alt="UrbanSetu Logo"
                                    className="w-12 h-12 rounded-xl object-contain shadow-lg"
                                />
                                <div className="flex flex-col items-start leading-none text-left">
                                    <span className="text-2xl font-black text-white tracking-tighter">UrbanSetu</span>
                                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-1">Real Estate Excellence</span>
                                </div>
                            </div>
                        </div>

                        {/* Pulse warning icon */}
                        <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                            <FaExclamationTriangle className="text-3xl text-red-500" />
                        </div>

                        <h1 className="text-2xl font-bold text-white mb-3">
                            Something went wrong
                        </h1>

                        <p className="text-slate-400 text-sm leading-relaxed mb-8">
                            {reloadCount < 3
                                ? "We encountered an unexpected error while loading the application. Attempting to reload the page to resolve the issue."
                                : "Multiple reload attempts failed. Attempting to switch to our backup server for better stability."
                            }
                        </p>

                        {/* Interactive Dynamic Action Box */}
                        {reloadCount < 3 ? (
                            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 mb-6 text-center">
                                <div className="flex items-center justify-center gap-2 text-blue-400 font-bold mb-2">
                                    <FaSync className="animate-spin text-sm" />
                                    <span>Reloading Page ({reloadCount + 1}/3)</span>
                                </div>
                                <p className="text-sm text-slate-300">
                                    Auto-reloading in <span className="font-extrabold text-blue-400 text-base">{this.state.redirectCountdown}</span> seconds...
                                </p>
                            </div>
                        ) : (
                            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-5 mb-6 text-center">
                                <div className="flex items-center justify-center gap-2 text-indigo-400 font-bold mb-2">
                                    <FaServer className="animate-pulse text-sm" />
                                    <span>Switching Server (Backup Source)</span>
                                </div>
                                <p className="text-sm text-slate-300">
                                    Redirecting in <span className="font-extrabold text-indigo-400 text-base">{this.state.redirectCountdown}</span> seconds...
                                </p>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-col gap-3">
                            {reloadCount < 3 ? (
                                <>
                                    <button
                                        onClick={this.handleReloadNow}
                                        disabled={this.state.isReloading}
                                        className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed"
                                    >
                                        {this.state.isReloading ? <UrbanSetuSpinner size="sm" /> : <FaSync className="text-xs" />}
                                        <span>Reload Page Now</span>
                                    </button>

                                    {altUrl && (
                                        <button
                                            onClick={this.handleSwitchServer}
                                            className="w-full py-3 px-4 bg-transparent border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 active:scale-[0.98] hover:border-slate-700"
                                        >
                                            <span>Switch Server Now</span>
                                            <FaArrowRight className="text-xs" />
                                        </button>
                                    )}
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={this.handleSwitchServer}
                                        className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        <FaServer className="text-xs animate-pulse" />
                                        <span>Switch Server Now</span>
                                        <FaArrowRight className="text-xs" />
                                    </button>

                                    <button
                                        onClick={this.handleReloadNow}
                                        disabled={this.state.isReloading}
                                        className="w-full py-3 px-4 bg-transparent border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed hover:border-slate-700"
                                    >
                                        {this.state.isReloading ? <UrbanSetuSpinner size="sm" /> : <FaSync className="text-xs" />}
                                        <span>Reload Page</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
