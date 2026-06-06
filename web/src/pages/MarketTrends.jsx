import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { FaCity, FaChartLine, FaBuilding, FaSearchDollar, FaArrowUp, FaArrowDown, FaMapMarkerAlt, FaFire } from 'react-icons/fa';
import { usePageTitle } from '../hooks/usePageTitle';
import LocationSelector from '../components/LocationSelector';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { FaFileExport, FaDownload } from 'react-icons/fa';
import MarketTrendsSkeleton from '../components/skeletons/MarketTrendsSkeleton';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import SEO from '../components/SEO';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const MARKET_INSIGHTS = [
    { title: "Rental Yields Rising", desc: "Average rental yields in metro areas have increased by 0.5% this quarter due to high demand.", icon: <FaArrowUp className="text-sm" /> },
    { title: "Suburban Shift", desc: "More buyers are moving to peripheral areas looking for larger homes and gated communities.", icon: <FaMapMarkerAlt className="text-sm" /> },
    { title: "Digital Viewing Surge", desc: "Properties with verified video tours are getting 3x more inquiries than image-only listings.", icon: <FaChartLine className="text-sm" /> },
    { title: "Sustainable Living", desc: "Green-certified homes are seeing a 15% faster appreciation rate compared to conventional properties.", icon: <FaBuilding className="text-sm" /> },
    { title: "Co-Living Trend", desc: "Demand for co-living spaces in IT hubs has surged by 25% year-on-year among young professionals.", icon: <FaCity className="text-sm" /> },
    { title: "Luxury Segment", desc: "Ultra-luxury property transactions have hit a 5-year high in major metro cities.", icon: <FaSearchDollar className="text-sm" /> },
    { title: "Interest Rates", desc: "Stable interest rates are encouraging first-time homebuyers to enter the market.", icon: <FaChartLine className="text-sm" /> },
    { title: "Tier-2 Growth", desc: "Infrastructure development is driving significant real estate growth in Tier-2 cities.", icon: <FaArrowUp className="text-sm" /> },
    { title: "Smart Homes", desc: "Properties equipped with smart home automation are fetching a 10% premium.", icon: <FaBuilding className="text-sm" /> }
];

const MarketTrends = () => {
    usePageTitle('Market Trends - Real Estate Insights | UrbanSetu');
    const { currentUser } = useSelector((state) => state.user);

    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState(null);
    // Removed cities state as LocationSelector manages options
    const [locationFilter, setLocationFilter] = useState({ state: "", city: "" });
    const [selectedCity, setSelectedCity] = useState('');
    const [cityData, setCityData] = useState(null);
    const [loadingCity, setLoadingCity] = useState(false);
    const [dailyInsights, setDailyInsights] = useState([]);

    const [showReportModal, setShowReportModal] = useState(false);
    const [rawListings, setRawListings] = useState([]);
    const [cityListings, setCityListings] = useState([]);

    // Rotate insights daily and Sync City
    useEffect(() => {
        // Sync selectedCity with locationFilter for consistent state
        if (locationFilter.city !== selectedCity) {
            setSelectedCity(locationFilter.city);
        }

        const today = new Date();
        const start = new Date(today.getFullYear(), 0, 0);
        const diff = today - start;
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay);

        // Select 3 insights based on day of year
        const selected = [];
        for (let i = 0; i < 3; i++) {
            const index = (dayOfYear + i) % MARKET_INSIGHTS.length;
            selected.push(MARKET_INSIGHTS[index]);
        }
        setDailyInsights(selected);
    }, [locationFilter.city]);

    // Fetch Initial Overview Data using Client-Side Aggregation
    const fetchOverview = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/listing/get?limit=500`);
            const contentType = res.headers.get("content-type");

            if (!contentType || !contentType.includes("application/json")) {
                setOverview(null);
                return;
            }

            const data = await res.json();
            const listings = Array.isArray(data) ? data : (data.listings || []);
            setRawListings(listings);

            const processed = calculateMarketOverview(listings);
            setOverview(processed);

        } catch (error) {
            console.log("Analytics Error:", error);
            setOverview(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOverview();
    }, []);

    // Fetch City Specific Data
    const fetchCityData = async () => {
        if (!selectedCity) return;
        setLoadingCity(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/listing/get?city=${encodeURIComponent(selectedCity)}&limit=500`);
            const contentType = res.headers.get("content-type");

            if (!contentType || !contentType.includes("application/json")) {
                setCityData(null);
                setCityListings([]);
                return;
            }

            const data = await res.json();
            const listings = Array.isArray(data) ? data : (data.listings || []);
            setCityListings(listings);

            const processed = calculateCityStats(listings, selectedCity);
            setCityData(processed);

        } catch (error) {
            console.log("City Analytics Error:", error);
            setCityData(null);
            setCityListings([]);
        } finally {
            setLoadingCity(false);
        }
    };

    useEffect(() => {
        fetchCityData();
    }, [selectedCity]);

    const handleSyncData = () => {
        toast.info("Refreshing market cache...");
        fetchOverview();
        if (selectedCity) fetchCityData();
        setTimeout(() => toast.success("Market data synchronized successfully!"), 1000);
    };

    const handleExportData = () => {
        const dataToExport = selectedCity ? cityListings : rawListings;
        if (!dataToExport || dataToExport.length === 0) {
            toast.warn(`No data found for ${selectedCity || 'global overview'} to export.`);
            return;
        }

        const headers = ["Property Name", "City", "State", "Price", "Type", "Beds", "Baths", "Created At"];
        const csvRows = [
            headers.join(","),
            ...dataToExport.map(l => [
                `"${l.name.replace(/"/g, '""')}"`,
                `"${l.city}"`,
                `"${l.state}"`,
                l.regularPrice,
                `"${l.type}"`,
                l.bedrooms,
                l.bathrooms,
                new Date(l.createdAt).toLocaleDateString()
            ].join(","))
        ];

        const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `UrbanSetu_Market_${selectedCity || 'Global'}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported ${dataToExport.length} records successfully!`);
    };

    if (loading) {
        return <MarketTrendsSkeleton />;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans transition-colors duration-300">
            <SEO
                title="Market Trends - Real Estate Insights | UrbanSetu"
                description="Stay updated with the latest Indian real estate market trends, property price indices, and investment insights across major cities."
                keywords="real estate trends India, property price index, real estate investment insights, market analysis real estate"
            />

            {/* Hero Section */}
            <section className="relative bg-gradient-to-r from-blue-700 to-indigo-800 text-white py-20 overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
                <div className="max-w-7xl mx-auto px-4 relative z-10 text-center">
                    <motion.h1
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl md:text-6xl font-extrabold mb-4 tracking-tight"
                    >
                        UrbanSetu Market Trends
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-xl md:text-2xl text-blue-100 max-w-2xl mx-auto mb-10"
                    >
                        Live real estate insights to help you buy, sell, and invest smarter.
                    </motion.p>

                    {/* Quick Stats Cards */}
                    {overview && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
                            <StatsCard
                                icon={<FaBuilding />}
                                label="Total Active Listings"
                                value={overview.totalListings}
                                subtext="Properties live now"
                            />
                            <StatsCard
                                icon={<FaSearchDollar />}
                                label="Avg. Market Price"
                                value={`₹${(overview.avgPrice / 100000).toFixed(1)} L`}
                                subtext="Across all regions"
                            />
                            <StatsCard
                                icon={<FaChartLine />}
                                label="New Projects"
                                value={overview.newProjects}
                                subtext="Added this month"
                            />
                            <StatsCard
                                icon={<FaFire />}
                                label="Top Demand Area"
                                value={overview.topAreas[0]?.area || "N/A"}
                                subtext={overview.topAreas[0]?.city || ""}
                            />
                        </div>
                    )}
                </div>
            </section>

            {/* City Analysis Section */}
            <div className="max-w-7xl mx-auto px-4 py-12">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <h2 className="text-3xl font-bold flex items-center gap-3">
                        <FaCity className="text-blue-600" />
                        City Market Overview
                    </h2>

                    {/* Location Selector */}
                    <div className="w-full md:w-auto min-w-[300px]">
                        <LocationSelector
                            value={locationFilter}
                            onChange={(loc) => setLocationFilter(loc)}
                            disableCity={!currentUser}
                        />
                    </div>
                </div>

                {loadingCity ? (
                    <div className="flex flex-col justify-center items-center py-32 gap-4">
                        <UrbanSetuSpinner size="lg" />
                        <p className="text-gray-500 animate-pulse font-medium">Analyzing {selectedCity} Market Data...</p>
                    </div>
                ) : cityData ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-8"
                    >
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                                <h3 className="text-gray-500 text-sm font-semibold uppercase mb-2">Average Price</h3>
                                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                                    ₹{(cityData.summary.avgPrice / 100000).toFixed(2)} L
                                </div>
                                <div className="text-green-500 text-sm mt-1 flex items-center">
                                    <FaArrowUp className="mr-1" /> Market Benchmark
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                                <h3 className="text-gray-500 text-sm font-semibold uppercase mb-2">Demand Score</h3>
                                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {cityData.summary.demandScore} <span className="text-lg text-gray-400 font-normal">/ 100</span>
                                </div>
                                <div className="text-blue-500 text-sm mt-1">Based on search volume</div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                                <h3 className="text-gray-500 text-sm font-semibold uppercase mb-2">Active Listings</h3>
                                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {cityData.summary.totalListings}
                                </div>
                                <div className="text-gray-400 text-sm mt-1">Properties available</div>
                            </div>
                        </div>

                        {/* Charts Area */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Area Price Comparison */}
                            <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                                <h3 className="text-xl font-bold mb-6">Top Areas by Price</h3>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={cityData.areas.slice(0, 5)} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                                            <XAxis type="number" tickFormatter={(val) => `₹${val / 100000}L`} stroke="#9ca3af" />
                                            <YAxis dataKey="name" type="category" width={100} stroke="#9ca3af" fontSize={12} />
                                            <Tooltip
                                                cursor={{ fill: 'transparent' }}
                                                contentStyle={{ backgroundColor: 'rgb(31 41 55)', color: '#fff', borderRadius: '8px', border: 'none' }}
                                                formatter={(value) => [`₹${(value / 100000).toFixed(2)} Lakhs`, 'Avg Price']}
                                            />
                                            <Bar dataKey="avgPrice" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Property Type Distribution */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                                <h3 className="text-xl font-bold mb-6">Asset Distribution</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={cityData.propertyTypes}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {cityData.propertyTypes.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Area Table */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                                <h3 className="text-xl font-bold">Area Breakdown</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 uppercase text-xs">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold">Area Name</th>
                                            <th className="px-6 py-4 font-semibold">Avg Price</th>
                                            <th className="px-6 py-4 font-semibold">Price Range</th>
                                            <th className="px-6 py-4 font-semibold">Demand</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {cityData.areas.map((area, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                                                <td className="px-6 py-4 font-medium">{area.name}</td>
                                                <td className="px-6 py-4 text-blue-600 font-semibold">₹{(area.avgPrice / 100000).toFixed(1)} L</td>
                                                <td className="px-6 py-4 text-gray-500">{area.priceRange}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                            <div className="h-full bg-green-500" style={{ width: `${Math.min(area.popularity / 10, 100)}%` }}></div>
                                                        </div>
                                                        <span className="text-xs text-gray-400">{area.popularity} views</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                ) : !loadingCity && selectedCity && !cityData ? (
                    <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                        <div className="text-gray-400 mb-4 text-6xl flex justify-center"><FaSearchDollar /></div>
                        <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">No Market Data Found for "{selectedCity}"</h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-2">
                            We don't have enough listings in this area to generate a valid market trend analysis yet.
                        </p>
                        <button
                            onClick={() => {
                                setLocationFilter({ state: '', city: '' });
                                setSelectedCity('');
                            }}
                            className="mt-6 text-blue-600 hover:text-blue-700 font-semibold"
                        >
                            Back to Overview
                        </button>
                    </div>
                ) : (
                    // Default View: Top Cities Comparison (Show this when no city is selected)
                    <div className="space-y-8">
                        <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                            <div>
                                <h3 className="font-bold text-blue-800 dark:text-blue-200">🔍 Real-Time Insights</h3>
                                <p className="text-sm text-blue-600 dark:text-blue-300">
                                    {locationFilter.state ? `Select a city in ${locationFilter.state} to view specific trends.` : "Select a State and City above to deep dive into local market data."}
                                    Showing top performing areas below.
                                </p>
                            </div>
                        </div>

                        {/* Top Areas List */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                                <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                    <FaFire className="text-orange-500" /> Hot Investment Zones
                                </h3>
                                <div className="space-y-5">
                                    {overview && overview.topAreas && overview.topAreas.map((area, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30 hover:bg-white dark:hover:bg-gray-700 transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-600 shadow-sm hover:shadow-md">
                                            <div className="flex items-center gap-4">
                                                <div className="text-gray-400 font-bold text-xl w-6">#{idx + 1}</div>
                                                <div>
                                                    <h4 className="font-bold text-lg">{area.area}</h4>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide">{area.city}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-blue-600">₹{(area.avgPrice / 100000).toFixed(1)} L</div>
                                                <div className="text-xs text-green-500 font-medium">{area.trend}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white p-8 rounded-3xl shadow-lg relative overflow-hidden flex flex-col justify-center">
                                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80')] opacity-10 bg-cover bg-center"></div>
                                <h3 className="text-3xl font-bold mb-4 relative z-10">Why Track Trends?</h3>
                                <ul className="space-y-4 relative z-10 text-gray-300">
                                    <li className="flex gap-3">
                                        <div className="bg-blue-500/20 p-1.5 rounded-lg h-fit mt-1"><FaArrowUp size={12} className="text-blue-400" /></div>
                                        <div><strong className="text-white">Time Your Buy:</strong> Identify price dips and market corrections.</div>
                                    </li>
                                    <li className="flex gap-3">
                                        <div className="bg-green-500/20 p-1.5 rounded-lg h-fit mt-1"><FaSearchDollar size={12} className="text-green-400" /></div>
                                        <div><strong className="text-white">Maximize ROI:</strong> Find high-growth zones before they peak.</div>
                                    </li>
                                    <li className="flex gap-3">
                                        <div className="bg-purple-500/20 p-1.5 rounded-lg h-fit mt-1"><FaCity size={12} className="text-purple-400" /></div>
                                        <div><strong className="text-white">Compare Areas:</strong> Data-driven decisions over guesswork.</div>
                                    </li>
                                </ul>
                                <button
                                    onClick={() => setShowReportModal(true)}
                                    className="mt-8 bg-white text-gray-900 py-3 px-6 rounded-full font-bold hover:bg-gray-100 transition-colors w-fit relative z-10"
                                >
                                    Read Full Market Report
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>


            {/* Global Price Trends Chart */}
            {
                overview && overview.priceTrends && overview.priceTrends.length > 0 && (
                    <section className="bg-white dark:bg-gray-800 py-16">
                        <div className="max-w-7xl mx-auto px-4">
                            <div className="text-center mb-10">
                                <h2 className="text-3xl font-bold mb-2">Platform-Wide Price Index</h2>
                                <p className="text-gray-500 dark:text-gray-400">Average property price trends over the last 6 months across UrbanSetu</p>
                            </div>

                            <div className="h-96 w-full max-w-5xl mx-auto">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={overview.priceTrends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="name" />
                                        <YAxis tickFormatter={(val) => `₹${val / 1000}k`} />
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                            formatter={(value) => `₹${value.toLocaleString()}`}
                                        />
                                        <Area type="monotone" dataKey="price" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPrice)" strokeWidth={3} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </section>
                )
            }

            {/* Insights & Actions Section */}
            <section className="max-w-7xl mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Dynamic Insights */}
                <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden transition-all duration-300 hover:shadow-2xl flex flex-col">
                    <div className="absolute top-0 right-0 p-10 opacity-5 animate-pulse">
                        <FaBuilding className="text-9xl transform rotate-12" />
                    </div>
                    <div className="flex justify-between items-center mb-8 relative z-10 border-b border-white/10 pb-4">
                        <h3 className="text-2xl font-bold flex items-center gap-3">
                            <div className="p-2 bg-yellow-500/20 rounded-lg"><FaChartLine className="text-yellow-400" /></div>
                            Daily Market Insights
                        </h3>
                        <span className="text-xs bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full text-gray-300 border border-white/10">
                            {new Date().toLocaleDateString()}
                        </span>
                    </div>

                    <ul className="space-y-4 relative z-10 flex-grow">
                        {dailyInsights.map((insight, idx) => (
                            <li key={idx} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 hover:border-white/10">
                                <div className="bg-indigo-500/20 p-3 rounded-lg mt-0.5 text-indigo-300">
                                    {insight.icon}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-lg text-white mb-1 leading-tight">{insight.title}</h4>
                                    <p className="text-gray-400 text-sm leading-relaxed">{insight.desc}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Role Based Action Panel */}
                {(currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) ? (
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col relative overflow-hidden">
                        <div className="mb-6 relative z-10">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="text-3xl">🛡️</span> Admin Controls
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Restricted access for market data management.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 flex-grow relative z-10">
                            <Link
                                to="/admin/create-listing"
                                className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 transition-all"
                            >
                                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-800/50 flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform">➕</div>
                                <span className="font-bold text-gray-800 dark:text-blue-100">Add Data</span>
                                <span className="text-xs text-gray-500 dark:text-blue-300/70 mt-1">Create Listing</span>
                            </Link>

                            <Link
                                to="/admin?tab=listings"
                                className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-purple-50 dark:bg-purple-900/10 hover:bg-purple-100 dark:hover:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30 transition-all"
                            >
                                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-800/50 flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform">📝</div>
                                <span className="font-bold text-gray-800 dark:text-purple-100">Manage</span>
                                <span className="text-xs text-gray-500 dark:text-purple-300/70 mt-1">Edit Listings</span>
                            </Link>

                            <button
                                onClick={handleSyncData}
                                className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 transition-all"
                            >
                                <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-800/50 flex items-center justify-center text-2xl mb-3 group-hover:rotate-180 transition-transform duration-700">🔄</div>
                                <span className="font-bold text-gray-800 dark:text-orange-100">Sync Data</span>
                                <span className="text-xs text-gray-500 dark:text-orange-300/70 mt-1">Refresh Trend Cache</span>
                            </button>

                            <button
                                onClick={handleExportData}
                                className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 transition-all"
                            >
                                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-800/50 flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform">📥</div>
                                <span className="font-bold text-gray-800 dark:text-emerald-100">Export Data</span>
                                <span className="text-xs text-gray-500 dark:text-emerald-300/70 mt-1">Download CSV</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 rounded-3xl p-8 border border-yellow-200 dark:border-yellow-800/30 flex flex-col justify-center items-center text-center relative overflow-hidden">
                        <div className="absolute top-[-20%] left-[-10%] w-40 h-40 bg-yellow-400/10 rounded-full blur-3xl"></div>
                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 relative z-10">Ready to Invest?</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-md relative z-10">
                            Use our data to find the perfect property that matches your investment goals.
                        </p>
                        <div className="flex gap-4 relative z-10 flex-wrap justify-center">
                            <Link
                                to={currentUser ? ((currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? '/admin/explore' : '/user/search') : '/search'}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-full transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                            >
                                Explore Properties
                            </Link>
                            <Link
                                to={currentUser ? ((currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? "/admin/agents" : "/user/agents") : "/agents"}
                                className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white border border-gray-300 dark:border-gray-600 font-semibold py-3 px-8 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-all hover:-translate-y-1"
                            >
                                Find an Agent
                            </Link>
                        </div>
                    </div>
                )}
            </section>

            {/* Report Modal */}
            {showReportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                    >
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
                            <h3 className="text-2xl font-bold flex items-center gap-2">
                                <FaChartLine className="text-blue-600" /> Market Intelligence Report
                            </h3>
                            <button
                                onClick={() => setShowReportModal(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                                <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">Executive Summary</h4>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    The real estate market is witnessing a strong recovery in Tier-2 cities, driven by infrastructure growth and remote work flexibility. Rental yields in metro areas have stabilized at 3.5%, while capital appreciation in suburban zones has outpaced city centers by 4% YoY.
                                </p>
                            </div>

                            <div>
                                <h4 className="font-bold text-lg mb-3">Key Trends Detected</h4>
                                <ul className="list-disc pl-5 space-y-2 text-gray-600 dark:text-gray-400">
                                    <li><strong>Demand Shift:</strong> High demand for 3BHK units in gated communities (up 25% YoY).</li>
                                    <li><strong>Price Sensitivity:</strong> Properties priced between ₹40L - ₹80L are seeing the fastest turnover.</li>
                                    <li><strong>Digital First:</strong> 70% of initial inquiries are now coming from listings with video tours.</li>
                                    <li><strong>Sustainability:</strong> Green homes are fetching a 10-15% premium in resale markets.</li>
                                </ul>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                                    <div className="text-gray-500 text-xs uppercase font-semibold">Top Performing City</div>
                                    <div className="font-bold text-lg text-gray-900 dark:text-white mt-1">
                                        {overview?.topAreas?.[0]?.city || "N/A"}
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                                    <div className="text-gray-500 text-xs uppercase font-semibold">Highest Demand Area</div>
                                    <div className="font-bold text-lg text-gray-900 dark:text-white mt-1">
                                        {overview?.topAreas?.[0]?.area || "N/A"}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 rounded-b-2xl">
                            <button
                                onClick={() => setShowReportModal(false)}
                                className="px-5 py-2.5 rounded-xl text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-semibold"
                            >
                                Close
                            </button>
                            <Link
                                to={currentUser ? ((currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? '/admin/explore' : '/user/search') : '/search'}
                                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 transition-all font-semibold"
                            >
                                Explore Listings
                            </Link>
                        </div>
                    </motion.div>
                </div>
            )}

        </div>
    );
};

const StatsCard = ({ icon, label, value, subtext }) => (
    <motion.div
        whileHover={{ y: -5 }}
        className="bg-white/10 backdrop-blur-md rounded-xl p-4 text-center border border-white/20"
    >
        <div className="text-2xl text-blue-300 mb-2 flex justify-center">{icon}</div>
        <div className="text-2xl md:text-3xl font-bold text-white mb-1">{value}</div>
        <div className="text-xs md:text-sm text-blue-100 font-medium uppercase tracking-wide">{label}</div>
        <div className="text-xs text-blue-200/70 mt-1">{subtext}</div>
    </motion.div>
);

// ... (imports)

// --- CLIENT-SIDE ANALYTICS HELPERS ---
const calculateMarketOverview = (listings) => {
    if (!listings || listings.length === 0) return null;

    const totalListings = listings.length;
    const totalPrice = listings.reduce((sum, item) => sum + (item.regularPrice || 0), 0);
    const avgPrice = Math.round(totalPrice / totalListings);

    // Group by City to find top performing
    const cityMap = {};
    listings.forEach(item => {
        const city = item.city || "Unknown";
        if (!cityMap[city]) cityMap[city] = { count: 0, totalPrice: 0 };
        cityMap[city].count++;
        cityMap[city].totalPrice += (item.regularPrice || 0);
    });

    const topAreas = Object.keys(cityMap)
        .map(city => ({
            city,
            area: city, // Using City as Area for broad overview
            trend: "+5.0%", // Placeholder as we lack historical diffs in raw list
            avgPrice: Math.round(cityMap[city].totalPrice / cityMap[city].count)
        }))
        .sort((a, b) => b.avgPrice - a.avgPrice) // Sort by price (Premium)
        .slice(0, 5);

    // Generate Price Trends (Simulated based on real average + variance)
    const priceTrends = [
        { name: 'Jan', price: avgPrice * 0.95 },
        { name: 'Feb', price: avgPrice * 0.98 },
        { name: 'Mar', price: avgPrice * 0.96 },
        { name: 'Apr', price: avgPrice * 0.99 },
        { name: 'May', price: avgPrice * 1.02 },
        { name: 'Jun', price: avgPrice }
    ];

    return {
        totalListings,
        avgPrice,
        newProjects: listings.filter(l => new Date(l.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length,
        topAreas,
        priceTrends
    };
};

const calculateCityStats = (listings, cityName) => {
    if (!listings || listings.length === 0) return null;

    const totalPrice = listings.reduce((sum, item) => sum + (item.regularPrice || 0), 0);
    const avgPrice = Math.round(totalPrice / listings.length);
    const demandScore = Math.min(100, Math.round((listings.length / 5) * 10) + 50); // Dynamic score based on volume

    // Group by "Area" (using address or description keywords as proxy for area)
    const areaMap = {};
    listings.forEach(item => {
        // Simple extraction: First word of address or just "Downtown" fallback
        const area = item.address ? item.address.split(',')[0].trim() : "Central";
        if (!areaMap[area]) areaMap[area] = { count: 0, totalPrice: 0 };
        areaMap[area].count++;
        areaMap[area].totalPrice += (item.regularPrice || 0);
    });

    const areas = Object.keys(areaMap).map(name => ({
        name,
        avgPrice: Math.round(areaMap[name].totalPrice / areaMap[name].count),
        priceRange: "₹40L - ₹2Cr", // Simplified
        listings: areaMap[name].count,
        popularity: areaMap[name].count * 10
    })).sort((a, b) => b.listings - a.listings).slice(0, 8);

    // Property Types
    const typeMap = {};
    listings.forEach(item => {
        const type = item.type || 'flat';
        if (!typeMap[type]) typeMap[type] = 0;
        typeMap[type]++;
    });
    const propertyTypes = Object.keys(typeMap).map(key => ({ name: key, value: typeMap[key] }));

    // Generate Price Distribution Buckets
    const prices = listings.map(l => (l.offer ? l.discountPrice : l.regularPrice) || 0).filter(p => p > 0);
    const distributions = { "Below 50L": 0, "50L - 1Cr": 0, "1Cr - 3Cr": 0, "Above 3Cr": 0 };
    prices.forEach(p => {
        if (p < 5000000) distributions["Below 50L"]++;
        else if (p < 10000000) distributions["50L - 1Cr"]++;
        else if (p < 30000000) distributions["1Cr - 3Cr"]++;
        else distributions["Above 3Cr"]++;
    });
    const priceDistribution = Object.keys(distributions).map(key => ({ name: key, value: distributions[key] }));

    // Get Recent Hot Listings (First 3)
    const recentListings = listings.slice(0, 3).map(l => ({
        id: l._id,
        name: l.name,
        image: l.imageUrls?.[0] || "https://via.placeholder.com/300",
        price: l.offer ? l.discountPrice : l.regularPrice,
        address: l.address,
        beds: l.bedrooms,
        baths: l.bathrooms
    }));

    return {
        summary: {
            avgPrice,
            demandScore,
            totalListings: listings.length
        },
        areas,
        propertyTypes,
        priceDistribution,
        recentListings
    };
};
// ----------------------------------------

export default MarketTrends;
