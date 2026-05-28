import React from 'react';
import { FaServer, FaExclamationTriangle, FaSync, FaArrowRight, FaEnvelope, FaRobot, FaRocket } from 'react-icons/fa';
import UrbanSetuSpinner from './UrbanSetuSpinner';
import ListingItem from './ListingItem';
import { getLiveRecommendations, restoreFromServer } from '../utils/sentinelLiveEngine';
import { authenticatedFetch } from '../utils/auth';
import SEO from './SEO';
import { BrowserRouter, Link } from 'react-router-dom';
import WishlistProvider from '../WishlistContext';

class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        const params = new URLSearchParams(window.location.search);
        const urlSwitchCount = parseInt(params.get('err_switch_count') || '0');
        this.state = {
            hasError: false,
            error: null,
            redirectCountdown: 10,
            reloadCount: parseInt(sessionStorage.getItem('err_reload_count') || '0'),
            switchCount: urlSwitchCount,
            isPersistentError: urlSwitchCount >= 2,
            recommendations: [],
            loadingRecs: true,
            visibleRecsCount: 4,
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
            if (this.state.isPersistentError) {
                this.fetchRecommendations();
            } else {
                this.startRedirectCountdown();
            }
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

    getCurrentUser = () => {
        try {
            const userInfoStr = localStorage.getItem('persist:root');
            if (userInfoStr) {
                const parsed = JSON.parse(userInfoStr);
                const userData = JSON.parse(parsed.user);
                return userData?.currentUser;
            }
        } catch (e) { }
        return null;
    };

    getExplorePath = () => {
        const currentUser = this.getCurrentUser();
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) {
            return "/admin/explore";
        } else if (currentUser) {
            return "/user/search";
        }
        return "/search";
    };

    fetchRecommendations = async () => {
        const currentUser = this.getCurrentUser();
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

        // Hide recommendations for admins
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) {
            this.setState({ loadingRecs: false, recommendations: [] });
            return;
        }

        try {
            // Restore Sentinel preferences from DB for returning users
            if (currentUser?._id) {
                await restoreFromServer(currentUser._id).catch(() => { /* silent */ });
            }

            // Fetch public listings
            const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/get?limit=100&visibility=public`);
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            const listings = Array.isArray(data) ? data : (data?.listings || []);

            if (currentUser) {
                // Fetch user preferences for enhanced recommendations
                let userPreferences = [];
                try {
                    const [wishRes, watchRes] = await Promise.all([
                        authenticatedFetch(`${API_BASE_URL}/api/wishlist/user/${currentUser._id}`),
                        authenticatedFetch(`${API_BASE_URL}/api/watchlist/user/${currentUser._id}`)
                    ]);
                    const wishData = wishRes.ok ? await wishRes.json() : [];
                    const watchData = watchRes.ok ? await watchRes.json() : [];
                    const wishItems = Array.isArray(wishData) ? wishData.filter(x => x.listingId).map(x => ({ ...x.listingId, _sentinelType: 'wishlist' })) : [];
                    const watchItems = Array.isArray(watchData) ? watchData.filter(x => x.listingId).map(x => ({ ...x.listingId, _sentinelType: 'watchlist' })) : [];
                    userPreferences = [...wishItems, ...watchItems];
                } catch (e) { }

                const validListings = listings.filter(l => l.userRef !== currentUser._id && l.sellerId !== currentUser._id);
                const recs = await getLiveRecommendations(validListings, 100, userPreferences, currentUser._id);
                this.setState({ recommendations: recs });
            } else {
                this.setState({ recommendations: listings.sort(() => 0.5 - Math.random()) });
            }
        } catch (error) {
            console.error("ErrorBoundary: Failed to fetch recommendations", error);
        } finally {
            this.setState({ loadingRecs: false });
        }
    };

    getAlternativeUrl = (nextSwitchCount) => {
        const currentHost = window.location.hostname;
        const token = localStorage.getItem('accessToken');
        const sessionId = localStorage.getItem('sessionId');
        const refreshToken = localStorage.getItem('refreshToken');
        const params = new URLSearchParams(window.location.search);

        if (token) params.set('transfer_token', token);
        if (sessionId) params.set('transfer_session', sessionId);
        if (refreshToken) params.set('transfer_refresh', refreshToken);
        
        // Pass the switch count query parameter
        params.set('err_switch_count', nextSwitchCount.toString());

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
        const { reloadCount, switchCount } = this.state;
        if (reloadCount < 3) {
            sessionStorage.setItem('err_reload_count', (reloadCount + 1).toString());
            window.location.reload();
        } else {
            if (switchCount < 2) {
                this.handleSwitchServer();
            } else {
                sessionStorage.removeItem('err_reload_count');
                this.setState({ isPersistentError: true }, this.fetchRecommendations);
            }
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
        const { switchCount } = this.state;
        const altUrl = this.getAlternativeUrl(switchCount + 1);
        if (altUrl) {
            window.location.href = altUrl;
        } else {
            this.setState({ isPersistentError: true }, this.fetchRecommendations);
        }
    };

    handleReset = () => {
        sessionStorage.removeItem('err_reload_count');
        const params = new URLSearchParams(window.location.search);
        params.delete('err_switch_count');
        const newSearch = params.toString();
        window.location.href = window.location.pathname + (newSearch ? `?${newSearch}` : '');
    };

    render() {
        if (this.state.hasError) {
            const altUrl = this.getAlternativeUrl(this.state.switchCount + 1);
            const { reloadCount, isPersistentError } = this.state;

            return (
                <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 gap-12 py-12 relative overflow-hidden font-sans">
                    <SEO
                        title={isPersistentError ? "System Disruption - UrbanSetu" : "Something Went Wrong - UrbanSetu"}
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
                            {isPersistentError ? 'Persistent Server Issue' : 'Something went wrong'}
                        </h1>

                        <p className="text-slate-400 text-sm leading-relaxed mb-8">
                            {isPersistentError
                                ? "We apologize for the continued disruption. Both our primary and backup servers are currently experiencing temporary connectivity issues. Our engineering team is investigating."
                                : (reloadCount < 3
                                    ? "We encountered an unexpected error while loading the application. Attempting to reload the page to resolve the issue."
                                    : "Multiple reload attempts failed. Attempting to switch to our backup server for better stability."
                                )
                            }
                        </p>

                        {/* Interactive Dynamic Action Box */}
                        {isPersistentError ? (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 mb-6 text-center">
                                <div className="flex items-center justify-center gap-2 text-amber-400 font-bold mb-2">
                                    <FaServer className="animate-pulse text-sm" />
                                    <span>Stabilizing Environment</span>
                                </div>
                                <p className="text-sm text-slate-300">
                                    Auto-switching has been halted to prevent routing loops.
                                </p>
                            </div>
                        ) : (
                            reloadCount < 3 ? (
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
                            )
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-col gap-3">
                            {isPersistentError ? (
                                <>
                                    <button
                                        onClick={() => window.location.href = 'mailto:urbansetu.noreply@gmail.com'}
                                        className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        <FaEnvelope className="text-xs" />
                                        <span>Contact Support</span>
                                    </button>

                                    <button
                                        onClick={this.handleReset}
                                        className="w-full py-3 px-4 bg-transparent border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 active:scale-[0.98] hover:border-slate-700"
                                    >
                                        <FaSync className="text-xs" />
                                        <span>Reset and Try Again</span>
                                    </button>
                                </>
                            ) : (
                                reloadCount < 3 ? (
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
                                )
                            )}
                        </div>
                    </div>

                    {/* Persistent Error Recommendations Section */}
                    {isPersistentError && (
                        <div className="w-full max-w-6xl animate-fade-in-up z-10" style={{ animationDelay: '0.4s' }}>
                            <div className="relative overflow-hidden p-1 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10 rounded-[2.5rem]">
                                <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-[2.4rem] border border-slate-800/50 shadow-xl text-left">
                                    <BrowserRouter>
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                                                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                                                    <span className="p-2 bg-blue-600 text-white rounded-xl shadow-lg ring-4 ring-blue-900/10 animate-pulse">
                                                        {this.getCurrentUser() ? <FaRobot /> : <FaRocket />}
                                                    </span>
                                                    {this.getCurrentUser() ? "Sentinel Live" : "Explore Properties"}
                                                </h2>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-900/30 border border-blue-800 rounded-full w-fit">
                                                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                                                            {this.state.loadingRecs ? "GENERATING RECOMMENDATIONS..." : (this.getCurrentUser() ? (this.state.recommendations.length > 0 ? "PERSONALIZED RECOMMENDATIONS BASED ON YOUR ACTIVITY & LIKES" : "AI PERSONALIZATION ENGINE") : "HANDPICKED RECOMMENDATIONS")}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-400 mt-1 ml-1 font-medium italic">
                                                        {this.state.loadingRecs ? "Analyzing your preferences" : (this.getCurrentUser() ? "Tensor-mode active · Browse while we fix the connection" : "Real-time updates · Discover your next home")}
                                                    </p>
                                                </div>
                                            </div>
                                            {!this.state.loadingRecs && (this.state.recommendations.length > 0 || !this.getCurrentUser()) && (
                                                <Link
                                                    to={this.getExplorePath()}
                                                    className="flex items-center gap-2 text-blue-400 font-bold hover:text-blue-300 transition-all hover:translate-x-1"
                                                >
                                                    View All <FaArrowRight />
                                                </Link>
                                            )}
                                        </div>

                                        {this.state.loadingRecs ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                                {[...Array(4)].map((_, i) => (
                                                    <div key={`skel-${i}`} className="animate-pulse rounded-2xl overflow-hidden bg-slate-800/50 border border-slate-700/50 shadow-lg">
                                                        <div className="aspect-[16/10] bg-slate-700" />
                                                        <div className="p-4 space-y-3">
                                                            <div className="h-5 bg-slate-700 rounded-lg w-3/4" />
                                                            <div className="h-3 bg-slate-700 rounded w-1/2" />
                                                            <div className="h-6 bg-slate-700 rounded-lg w-2/3" />
                                                            <div className="flex gap-3">
                                                                <div className="h-4 bg-slate-700 rounded w-16" />
                                                                <div className="h-4 bg-slate-700 rounded w-16" />
                                                            </div>
                                                            <div className="h-10 bg-slate-700 rounded-xl w-full mt-2" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : this.state.recommendations.length > 0 ? (
                                            <>
                                                <WishlistProvider>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                                        {this.state.recommendations.slice(0, this.state.visibleRecsCount).map((listing, index) => (
                                                            <div
                                                                key={`err-rec-${listing._id}`}
                                                                className="relative group"
                                                            >
                                                                {listing.isLiveMatch && (
                                                                    <div className="absolute -top-2 -right-2 z-20 bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg transform rotate-12 group-hover:rotate-0 transition-transform">
                                                                        {Number.isFinite(listing.sentinelScore) && listing.sentinelScore > 0
                                                                          ? `${Math.round(listing.sentinelScore * 100)}% MATCH`
                                                                          : 'TOP PICK'}
                                                                    </div>
                                                                )}
                                                                <ListingItem listing={listing} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </WishlistProvider>
                                                {this.state.recommendations.length > this.state.visibleRecsCount && (
                                                    <div className="mt-8 text-center">
                                                        <button
                                                            onClick={() => this.setState(prev => ({ visibleRecsCount: prev.visibleRecsCount + 4 }))}
                                                            className="px-6 py-3 bg-slate-800 text-blue-400 font-bold rounded-xl shadow-lg border border-slate-700 hover:bg-slate-800/80 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto"
                                                        >
                                                            <FaRobot className="text-sm" />
                                                            View More Recommendations <FaArrowRight />
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            this.getCurrentUser() && (
                                                <div className="py-12 px-6 text-center animate-fade-in">
                                                    <div className="w-20 h-20 bg-blue-900/30 border border-blue-800 rounded-3xl flex items-center justify-center mx-auto mb-6 transform -rotate-6">
                                                        <FaRocket className="text-4xl text-blue-400" />
                                                    </div>
                                                    <h3 className="text-xl font-bold text-white mb-2">Sentinel is getting ready! 🤖</h3>
                                                    <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                                                        Our AI engine is still learning your preferences. Browse properties while we restore service to see your personalized recommendations.
                                                    </p>
                                                    <Link
                                                        to="/search"
                                                        className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all hover:scale-105 active:scale-95"
                                                    >
                                                        Start Browsing <FaArrowRight />
                                                    </Link>
                                                </div>
                                            )
                                        )}
                                    </BrowserRouter>

                                    <div className="mt-8 text-center border-t border-slate-800 pt-6">
                                        <p className="text-sm text-slate-400 font-medium italic">
                                            Don't worry, we've got you covered. You can explore these properties while we work on restoring full service.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
