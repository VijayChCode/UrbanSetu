import React, { useEffect, useState } from 'react';
import { FaSearch, FaMapMarkerAlt, FaUserPlus, FaUserTie, FaInfoCircle, FaSortAmountDown, FaFilter, FaCheckCircle, FaStar, FaTimes, FaChevronDown } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import AgentCard from '../../components/AgentCard';
import { AgentCardSkeleton } from '../../components/skeletons/FindAgentSkeleton';
import AgentInfoModal from '../../components/AgentInfoModal';
import { usePageTitle } from '../../hooks/usePageTitle';
import { authenticatedFetch } from '../../utils/auth';
import SEO from '../../components/SEO';
import { API_BASE_URL } from '../../config/api';

const FindAgent = () => {
    usePageTitle('Find Agents - UrbanSetu');
    const navigate = useNavigate();
    const { currentUser } = useSelector(state => state.user);
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [cityFilter, setCityFilter] = useState('');
    const [showInfoModal, setShowInfoModal] = useState(false);

    // New filter state
    const [sortBy, setSortBy] = useState('newest'); // newest, rating, experience
    const [expFilter, setExpFilter] = useState('all'); // all, 0-2, 3-5, 5+
    const [reraOnly, setReraOnly] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Own agent profile
    const [myAgentProfile, setMyAgentProfile] = useState(null);

    // Debounce search
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        fetchAgents();
    }, [debouncedSearch, cityFilter]);

    // Fetch own agent status
    useEffect(() => {
        if (currentUser) {
            checkOwnAgentStatus();
        }
    }, [currentUser]);

    const checkOwnAgentStatus = async () => {
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/agent/status/me`);
            const data = await res.json();
            if (res.ok && data.isAgent && data.status === 'approved') {
                // Fetch full profile
                const profileRes = await authenticatedFetch(`${API_BASE_URL}/api/agent/profile/${data.agentId}`);
                const profileData = await profileRes.json();
                if (profileRes.ok) {
                    setMyAgentProfile(profileData);
                }
            }
        } catch (error) {
            console.error("Error checking agent status:", error);
        }
    };

    const fetchAgents = async () => {
        try {
            setLoading(true);
            let query = `?status=approved`;
            if (debouncedSearch) query += `&search=${encodeURIComponent(debouncedSearch)}`;
            if (cityFilter) query += `&city=${encodeURIComponent(cityFilter)}`;

            const res = await authenticatedFetch(`${API_BASE_URL}/api/agent${query}`);
            const data = await res.json();
            if (res.ok) {
                setAgents(data.agents || []);
            }
        } catch (error) {
            console.error("Error fetching agents:", error);
        } finally {
            setLoading(false);
        }
    };

    // Apply client-side filters and sorting
    const getFilteredAndSortedAgents = () => {
        let filtered = [...agents];

        // Exclude own profile from the main list (shown separately)
        if (myAgentProfile) {
            filtered = filtered.filter(a => a._id !== myAgentProfile._id);
        }

        // Experience filter
        if (expFilter !== 'all') {
            if (expFilter === '0-2') filtered = filtered.filter(a => a.experience >= 0 && a.experience <= 2);
            else if (expFilter === '3-5') filtered = filtered.filter(a => a.experience >= 3 && a.experience <= 5);
            else if (expFilter === '5+') filtered = filtered.filter(a => a.experience > 5);
        }

        // RERA filter
        if (reraOnly) {
            filtered = filtered.filter(a => a.reraId && a.reraId.trim().length > 0);
        }

        // Sorting
        if (sortBy === 'rating') {
            filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        } else if (sortBy === 'experience') {
            filtered.sort((a, b) => (b.experience || 0) - (a.experience || 0));
        } else {
            // newest — by createdAt descending
            filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        return filtered;
    };

    const displayAgents = getFilteredAndSortedAgents();
    const hasActiveFilters = expFilter !== 'all' || reraOnly || sortBy !== 'newest';

    const clearFilters = () => {
        setExpFilter('all');
        setReraOnly(false);
        setSortBy('newest');
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-16 pb-12 transition-colors duration-300">
            <SEO
                title="Find Agents - Verified Real Estate Professionals | UrbanSetu"
                description="Connect with verified real estate agents on UrbanSetu. Our professional agents help you buy, sell, or rent properties with expert guidance and local market knowledge."
                keywords="real estate agents India, find property agent, verified real estate brokers, UrbanSetu agents"
            />
            <AgentInfoModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} />

            {/* Compact Hero with integrated search */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white py-10 md:py-14 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/city-fields.png')]"></div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <h1 className="text-3xl md:text-4xl font-extrabold mb-3 flex items-center justify-center gap-3">
                        Find Your Agent
                        <button
                            onClick={() => setShowInfoModal(true)}
                            className="text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                            title="About Agents"
                        >
                            <FaInfoCircle className="text-xl" />
                        </button>
                    </h1>
                    <p className="text-lg text-blue-100 max-w-xl mx-auto mb-6">
                        Connect with verified professionals who can help you buy, sell, or rent with confidence.
                    </p>

                    {/* Search Bar */}
                    <div className="max-w-3xl mx-auto bg-white p-2 rounded-2xl shadow-2xl flex flex-col sm:flex-row gap-2">
                        <div className="flex-1 relative">
                            <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, area, or agency..."
                                className="w-full pl-10 pr-4 py-3 rounded-xl border-none outline-none text-gray-800 placeholder-gray-500 focus:ring-0"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="sm:w-1/3 relative border-t sm:border-t-0 sm:border-l border-gray-200">
                            <FaMapMarkerAlt className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="City (e.g. Mumbai)"
                                className="w-full pl-10 pr-4 py-3 rounded-xl border-none outline-none text-gray-800 placeholder-gray-500 focus:ring-0"
                                value={cityFilter}
                                onChange={(e) => setCityFilter(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={fetchAgents}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all duration-300 transform hover:scale-105"
                        >
                            Search
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">

                {/* Your Agent Profile Card */}
                {myAgentProfile && (
                    <div className="mb-8 animate-fade-in-up">
                        <Link
                            to={`/user/agents/${myAgentProfile._id}`}
                            className="block bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border-2 border-blue-200 dark:border-blue-800 p-5 hover:shadow-lg transition-all group"
                        >
                            <div className="flex items-center gap-4">
                                <img
                                    src={myAgentProfile.photo || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"}
                                    alt={myAgentProfile.name}
                                    className="w-16 h-16 rounded-xl object-cover border-2 border-white dark:border-gray-700 shadow-md"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">Your Profile</span>
                                        {myAgentProfile.isVerified && (
                                            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><FaCheckCircle /> Verified</span>
                                        )}
                                    </div>
                                    <h3 className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">{myAgentProfile.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                        <FaMapMarkerAlt className="text-red-500 text-xs" /> {myAgentProfile.city}
                                        {myAgentProfile.experience > 0 && <span> • {myAgentProfile.experience} yrs exp</span>}
                                        {myAgentProfile.rating > 0 && <span className="flex items-center gap-1 ml-2"><FaStar className="text-yellow-500 text-xs" />{myAgentProfile.rating.toFixed(1)}</span>}
                                    </p>
                                </div>
                                <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm hidden sm:inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                    View & Edit →
                                </span>
                            </div>
                        </Link>
                    </div>
                )}

                {/* Toolbar: Header + Filters + Become Agent */}
                <div className="flex flex-col gap-4 mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex flex-wrap items-center gap-2">
                            <span className="flex items-center gap-2"><FaUserTie className="text-blue-600" /> Expert Agents</span>
                            <span className="text-sm font-normal text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                                {displayAgents.length} Found
                            </span>
                        </h2>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${showFilters || hasActiveFilters ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                            >
                                <FaFilter className="text-xs" /> Filters {hasActiveFilters && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                                <FaChevronDown className={`text-xs transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                            </button>
                            <button
                                onClick={() => {
                                    if (!currentUser) {
                                        toast.info("Please sign in to become an agent");
                                    } else {
                                        navigate('/user/become-an-agent');
                                    }
                                }}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-all transform hover:scale-105 shadow-sm text-sm"
                            >
                                <FaUserPlus /> Become an Agent
                            </button>
                        </div>
                    </div>

                    {/* Expanded Filter Panel */}
                    {showFilters && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm flex flex-wrap gap-4 items-center animate-fade-in-up">
                            {/* Sort */}
                            <div className="flex items-center gap-2">
                                <FaSortAmountDown className="text-gray-400 text-sm" />
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="newest">Newest First</option>
                                    <option value="rating">Highest Rated</option>
                                    <option value="experience">Most Experienced</option>
                                </select>
                            </div>

                            {/* Experience Range */}
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500 dark:text-gray-400">Experience:</span>
                                {['all', '0-2', '3-5', '5+'].map(exp => (
                                    <button
                                        key={exp}
                                        onClick={() => setExpFilter(exp)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${expFilter === exp ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                                    >
                                        {exp === 'all' ? 'All' : exp === '5+' ? '5+ Yrs' : `${exp} Yrs`}
                                    </button>
                                ))}
                            </div>

                            {/* RERA Toggle */}
                            <button
                                onClick={() => setReraOnly(!reraOnly)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${reraOnly ? 'bg-green-600 text-white border-green-600 shadow-sm' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                            >
                                <FaCheckCircle className="text-xs" /> RERA Registered
                            </button>

                            {/* Clear Filters */}
                            {hasActiveFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium transition-colors ml-auto"
                                >
                                    <FaTimes /> Clear Filters
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Agent Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <AgentCardSkeleton key={i} />
                        ))}
                    </div>
                ) : displayAgents.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {displayAgents.map(agent => (
                            <AgentCard key={agent._id} agent={agent} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="text-6xl mb-4">🕵️</div>
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">No agents found</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">Try adjusting your search filters or check back later.</p>
                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline text-sm">
                                Clear all filters
                            </button>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                    animation: fadeInUp 0.5s ease-out;
                }
            `}</style>
        </div>
    );
};

export default FindAgent;
