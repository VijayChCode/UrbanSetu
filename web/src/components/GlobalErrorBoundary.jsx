import React from 'react';
import { FaServer, FaExclamationTriangle, FaSync, FaArrowRight, FaRobot, FaRocket } from 'react-icons/fa';
import ListingItem from './ListingItem';
import { getLiveRecommendations } from '../utils/sentinelLiveEngine';
import { authenticatedFetch } from '../utils/auth';
import SEO from './SEO';
import { BrowserRouter, Link } from 'react-router-dom';
import WishlistProvider from '../WishlistContext';

class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { 
            hasError: false, 
            error: null, 
            redirectCountdown: 10,
            switchCount: parseInt(sessionStorage.getItem('err_switch_count') || '0'),
            isPersistentError: false,
            recommendations: [],
            loadingRecs: true,
            visibleRecsCount: 4
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
            if (this.state.switchCount >= 3) {
                this.setState({ isPersistentError: true }, this.fetchRecommendations);
            } else {
                this.startRedirectCountdown();
            }
        }
    }

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
                    const wishItems = Array.isArray(wishData) ? wishData.filter(x => x.listingId).map(x => x.listingId) : [];
                    const watchItems = Array.isArray(watchData) ? watchData.filter(x => x.listingId).map(x => x.listingId) : [];
                    userPreferences = [...wishItems, ...watchItems];
                } catch (e) { }

                const validListings = listings.filter(l => l.userRef !== currentUser._id && l.sellerId !== currentUser._id);
                const recs = await getLiveRecommendations(validListings, 100, userPreferences);
                
                if (recs.length > 0) {
                    this.setState({ recommendations: recs });
                } else {
                    this.setState({ recommendations: listings.sort(() => 0.5 - Math.random()) });
                }
            } else {
                this.setState({ recommendations: listings.sort(() => 0.5 - Math.random()) });
            }
        } catch (error) {
            console.error("ErrorBoundary: Failed to fetch recommendations", error);
        } finally {
            this.setState({ loadingRecs: false });
        }
    };

    componentWillUnmount() {
        if (this.timer) clearInterval(this.timer);
    }

    startRedirectCountdown = () => {
        this.timer = setInterval(() => {
            this.setState((prev) => {
                if (prev.redirectCountdown <= 1) {
                    clearInterval(this.timer);
                    this.handleRedirect();
                    return { redirectCountdown: 0 };
                }
                return { redirectCountdown: prev.redirectCountdown - 1 };
            });
        }, 1000);
    };

    getAlternativeUrl = () => {
        const currentHost = window.location.hostname;
        // Read auth state
        const token = localStorage.getItem('accessToken');
        const sessionId = localStorage.getItem('sessionId');
        const refreshToken = localStorage.getItem('refreshToken');
        const params = new URLSearchParams(window.location.search);

        if (token) params.set('transfer_token', token);
        if (sessionId) params.set('transfer_session', sessionId);
        if (refreshToken) params.set('transfer_refresh', refreshToken);

        const newSearch = params.toString();
        const suffix = newSearch ? `?${newSearch}` : '';

        // Logic to switch domains
        if (currentHost.includes('vercel.app')) {
            return `https://urbansetuglobal.onrender.com${window.location.pathname}${suffix}`;
        } else if (currentHost.includes('onrender.com')) {
            return `https://urbansetu.vercel.app${window.location.pathname}${suffix}`;
        }

        // Fallback/Localhost
        return null;
    };

    handleRedirect = () => {
        const { switchCount } = this.state;
        if (switchCount >= 3) {
            this.setState({ isPersistentError: true });
            return;
        }

        const altUrl = this.getAlternativeUrl();
        if (altUrl) {
            sessionStorage.setItem('err_switch_count', (switchCount + 1).toString());
            window.location.href = altUrl;
        } else {
            window.location.reload();
        }
    };

    render() {
        if (this.state.hasError) {
            const altUrl = this.getAlternativeUrl();
            const isLocal = !altUrl;

            return (
                <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4 gap-12 py-12`}>
                    <SEO 
                        title={this.state.isPersistentError ? "System Disruption - UrbanSetu" : "Something Went Wrong - UrbanSetu"} 
                        description="UrbanSetu is experiencing a temporary service disruption. We are working to restore normal operations as soon as possible."
                        noindex={true}
                    />
                    <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden text-center p-8 relative animate-fade-in-up">
                        {/* Status bar for switch count */}
                        {this.state.switchCount > 0 && !this.state.isPersistentError && (
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100 dark:bg-gray-700">
                                <div 
                                    className="h-full bg-blue-500 transition-all duration-500" 
                                    style={{ width: `${(this.state.switchCount / 3) * 100}%` }}
                                />
                            </div>
                        )}

                        <div className="flex flex-col items-center mb-10">
                            <div className="flex items-center gap-3">
                                <img 
                                    src="/favicon.png" 
                                    alt="UrbanSetu Logo" 
                                    className="w-12 h-12 rounded-xl shadow-lg transform transition-transform hover:scale-105 active:scale-95 duration-300 object-contain"
                                />
                                <div className="flex flex-col items-start leading-none">
                                    <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">UrbanSetu</span>
                                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1">Real Estate Excellence</span>
                                </div>
                            </div>
                        </div>

                        <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
                            <FaExclamationTriangle className="text-3xl text-red-600 dark:text-red-400" />
                        </div>

                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                            {this.state.isPersistentError ? 'Server Issue Persists' : 'Something went wrong'}
                        </h1>

                        <p className="text-gray-500 dark:text-gray-400 mb-8">
                            {this.state.isPersistentError 
                                ? "We apologize for the continued disruption. Our automated systems have flagged this persistent issue, and our engineering team is actively investigating to restore normal service."
                                : "We encountered an unexpected error while loading the application. Attempting to switch to our backup server for better stability."
                            }
                        </p>

                        {this.state.isPersistentError ? (
                            <div className="space-y-4">
                                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800">
                                    <p className="text-sm text-amber-700 dark:text-amber-400 font-medium animate-pulse">
                                        ⚡ Persistent error detected. Stabilizing environment...
                                    </p>
                                </div>
                                <button
                                    onClick={() => window.location.href = 'mailto:support@urbansetu.com'}
                                    className="w-full py-3 px-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02]"
                                >
                                    <FaServer /> Contact Support
                                </button>
                                <button
                                    onClick={() => {
                                        sessionStorage.removeItem('err_switch_count');
                                        window.location.reload();
                                    }}
                                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    Reset and try again
                                </button>
                            </div>
                        ) : (
                            <>
                                {altUrl ? (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6 border border-blue-100 dark:border-blue-800">
                                        <div className="flex items-center justify-center gap-2 text-blue-700 dark:text-blue-300 font-semibold mb-2">
                                            <FaServer />
                                            <span>Switching Server ({this.state.switchCount + 1}/3)</span>
                                        </div>
                                        <p className="text-sm text-blue-600 dark:text-blue-400">
                                            Redirecting in <span className="font-bold">{this.state.redirectCountdown}</span> seconds...
                                        </p>
                                    </div>
                                ) : (
                                    <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4 mb-6">
                                        <p className="text-sm text-gray-600 dark:text-gray-300">
                                            Please check your internet connection or try reloading.
                                        </p>
                                    </div>
                                )}

                                <div className="flex flex-col gap-3">
                                    {altUrl && (
                                        <button
                                            onClick={this.handleRedirect}
                                            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                                        >
                                            Switch Server Now <FaArrowRight />
                                        </button>
                                    )}

                                    <button
                                        onClick={() => window.location.reload()}
                                        className="w-full py-3 px-4 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                                    >
                                        <FaSync className="group-hover:animate-spin" /> Reload Page
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Persistent Error Recommendations Section */}
                    {this.state.isPersistentError && !this.state.loadingRecs && this.state.recommendations.length > 0 && (
                        <div className="w-full max-w-6xl animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                            <div className="relative overflow-hidden p-1 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10 rounded-[2.5rem]">
                                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-8 rounded-[2.4rem] border border-white/50 dark:border-gray-700/50 shadow-xl">
                                        <BrowserRouter>
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                                                <div className="flex flex-col md:flex-row md:items-center gap-4">
                                                    <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                                                        <span className="p-2 bg-blue-600 text-white rounded-xl shadow-lg ring-4 ring-blue-50 dark:ring-blue-900/10">
                                                            {this.getCurrentUser() ? <FaRobot className="animate-pulse" /> : <FaRocket className="animate-bounce" />}
                                                        </span>
                                                        {this.getCurrentUser() ? "Sentinel Live" : "Explore Properties"}
                                                    </h2>
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-full w-fit">
                                                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                                                                {this.getCurrentUser() ? "RECOMMENDING BASED ON YOUR CURRENT SESSION" : "HANDPICKED RECOMMENDATIONS"}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-1 font-medium italic">
                                                            {this.getCurrentUser() ? "Tensor-mode active · Browse while we fix the connection" : "Real-time updates · Discover your next home"}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Link
                                                    to={this.getExplorePath()}
                                                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold hover:text-blue-700 dark:hover:text-blue-300 transition-all hover:translate-x-1"
                                                >
                                                    View All <FaArrowRight />
                                                </Link>
                                            </div>
                                            <WishlistProvider>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                                    {this.state.recommendations.slice(0, this.state.visibleRecsCount).map((listing) => (
                                                        <div key={`err-rec-${listing._id}`} className="relative group">
                                                            {listing.isLiveMatch && (
                                                                <div className="absolute -top-2 -right-2 z-20 bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg transform rotate-12 group-hover:rotate-0 transition-transform">
                                                                    {Math.round(listing.sentinelScore * 100)}% MATCH
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
                                                        className="px-6 py-3 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 font-bold rounded-xl shadow-lg border border-blue-100 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all transform hover:scale-105 flex items-center gap-2 mx-auto"
                                                    >
                                                        View More Recommendations <FaArrowRight />
                                                    </button>
                                                </div>
                                            )}
                                        </BrowserRouter>
                                    
                                    <div className="mt-8 text-center border-t border-gray-100 dark:border-gray-700 pt-6">
                                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium italic">
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
