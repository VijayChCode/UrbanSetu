import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ListingItem from "../components/ListingItem";
import LocationSelector from "../components/LocationSelector";
import data from "../data/countries+states+cities.json";
import duckImg from "../assets/duck-go-final.gif";
import ContactSupportWrapper from '../components/ContactSupportWrapper';
import SearchSuggestions from '../components/SearchSuggestions';
import FilterChips from "../components/search/FilterChips";
import SEO from '../components/SEO';
import { usePageTitle } from '../hooks/usePageTitle';
import { Search, Filter, MapPin, Home, DollarSign, GripVertical, ChevronDown, RefreshCw } from "lucide-react";
import ListingSkeletonGrid from "../components/skeletons/ListingSkeletonGrid";
import { motion, AnimatePresence } from "framer-motion";


import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function PublicSearch() {

    const location = useLocation();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        searchTerm: "",
        type: "all",
        parking: false,
        furnished: false,
        offer: false,
        sort: "createdAt",
        order: "desc",
        minPrice: "",
        maxPrice: "",
        city: "",
        state: "",
        bedrooms: "",
        bathrooms: "",
    });

    // SEO Meta Tags
    const seoTitle = formData.searchTerm
        ? `Properties in ${formData.searchTerm} - Search Results`
        : "Search Verified Properties - Hyderabad Real Estate";

    const seoDescription = `Browse the latest ${formData.type !== 'all' ? formData.type + ' ' : ''}properties ${formData.searchTerm ? 'in ' + formData.searchTerm : ''} on UrbanSetu. Filter by price, bedrooms, and more.`;
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showMoreListing, setShowMoreListing] = useState(false);
    const [error, setError] = useState(null);
    const [locationFilter, setLocationFilter] = useState({ state: "", district: "", city: "" });
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false); // Mobile filter toggle

    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        setFormData({
            searchTerm: urlParams.get("searchTerm") || "",
            type: urlParams.get("type") || "all",
            parking: urlParams.get("parking") === "true",
            furnished: urlParams.get("furnished") === "true",
            offer: urlParams.get("offer") === "true",
            sort: urlParams.get("sort") || "createdAt",
            order: urlParams.get("order") || "desc",
            minPrice: urlParams.get("minPrice") || "",
            maxPrice: urlParams.get("maxPrice") || "",
            city: "", // City filter disabled for public search
            state: urlParams.get("state") || "",
            bedrooms: urlParams.get("bedrooms") || "",
            bathrooms: urlParams.get("bathrooms") || "",
        });
        setLocationFilter({
            state: urlParams.get("state") || "",
            district: urlParams.get("district") || "",
            city: "", // Always clear city for public search
        });

        const fetchListings = async () => {
            setLoading(true);
            setError(null);
            try {
                const fetchParams = new URLSearchParams(urlParams);
                fetchParams.set('visibility', 'public');
                const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/get?${fetchParams.toString()}`);
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                const data = await res.json();
                setListings(Array.isArray(data) ? data : []);
                setShowMoreListing(Array.isArray(data) && data.length > 8);
            } catch (error) {
                console.error("Error fetching listings:", error);
                setError("Failed to load listings. Please try again.");
                setListings([]);
                setShowMoreListing(false);
            }
            setLoading(false);
        };
        fetchListings();
    }, [location.search]);

    const handleChanges = (e) => {
        const { name, value, checked, type } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));

        // Show suggestions when typing in search term
        if (name === 'searchTerm') {
            setShowSuggestions(value.trim().length >= 2);
        }
    };

    const handleSuggestionClick = (suggestion) => {
        setFormData(prev => ({
            ...prev,
            searchTerm: suggestion.displayText
        }));
        setShowSuggestions(false);

        // Navigate to the property listing
        navigate(`/listing/${suggestion.id}`);
    };

    const handleSearchInputFocus = () => {
        if (formData.searchTerm.trim().length >= 2) {
            setShowSuggestions(true);
        }
    };

    const handleSearchInputBlur = () => {
        // Delay hiding suggestions to allow clicking on them
        setTimeout(() => setShowSuggestions(false), 200);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const urlParams = new URLSearchParams(formData);
        navigate(`?${urlParams.toString()}`);
    };

    const showMoreListingClick = async () => {
        try {
            const urlParams = new URLSearchParams(location.search);
            urlParams.set("startIndex", listings.length);
            urlParams.set("visibility", "public");
            const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/get?${urlParams.toString()}`);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            if (Array.isArray(data)) {
                setListings((prev) => [...prev, ...data]);
                setShowMoreListing(data.length >= 8);
            }
        } catch (error) {
            console.error("Error fetching more listings:", error);
        }
    };

    const handleLocationChange = (loc) => {
        // For public search, always clear city filter
        const updatedLoc = { ...loc, city: "" };
        setLocationFilter(updatedLoc);
        setFormData((prev) => ({ ...prev, state: loc.state, district: loc.district, city: "" }));
    };

    const clearAllFilters = () => {
        const reset = {
            searchTerm: "", type: "all", parking: false, furnished: false, offer: false,
            sort: "createdAt", order: "desc", minPrice: "", maxPrice: "",
            city: "", state: "", bedrooms: "", bathrooms: ""
        };
        setFormData(reset);
        setLocationFilter({ state: "", district: "", city: "" });
        navigate(`?${new URLSearchParams(reset).toString()}`);
    };

    const removeFilter = (key) => {
        const updated = { ...formData };
        if (typeof updated[key] === 'boolean') updated[key] = false; else updated[key] = "";
        setFormData(updated);
        navigate(`?${new URLSearchParams(updated).toString()}`);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col font-sans text-slate-800 dark:text-gray-100 transition-colors duration-300">
            <SEO
                title={seoTitle}
                description={seoDescription}
                keywords={`search properties, ${formData.searchTerm}, real estate search, find flats, ${formData.type} listings`}
            />

            {/* Search Header / Hero */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 dark:from-blue-900 dark:via-indigo-950 dark:to-purple-950 pb-16 pt-10 px-4 shadow-lg mb-8 relative transition-colors duration-300">
                {/* Abstract shapes for visual interest */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
                    <div className="absolute top-[-50%] left-[-10%] w-[500px] h-[500px] rounded-full bg-white mix-blend-overlay filter blur-3xl animate-float"></div>
                    <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-300 mix-blend-overlay filter blur-3xl animate-float" style={{ animationDelay: "2s" }}></div>
                </div>

                <div className="max-w-7xl mx-auto text-center relative z-20 animate-slideInFromTop">
                    <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4 tracking-tight drop-shadow-md">
                        Find Your <span className="text-yellow-300">Perfect Place</span>
                    </h1>
                    <p className="text-blue-100 mb-8 text-lg max-w-2xl mx-auto font-light">
                        Search through thousands of properties to find the one that feels like home.
                    </p>

                    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative group">
                        <div className="flex flex-col md:flex-row gap-2 bg-white/10 dark:bg-black/20 backdrop-blur-md p-2 rounded-2xl border border-white/20 dark:border-white/10 shadow-2xl hover:bg-white/20 dark:hover:bg-black/30 transition-all duration-300 relative z-30">

                            {/* Search Input */}
                            <div className="relative flex-grow group-focus-within:ring-2 ring-blue-400 rounded-xl transition-all z-50">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-5 w-5 text-blue-200" />
                                </div>
                                <input
                                    type="text"
                                    name="searchTerm"
                                    placeholder="Search by location, property type..."
                                    value={formData.searchTerm}
                                    onChange={handleChanges}
                                    onFocus={handleSearchInputFocus}
                                    onBlur={handleSearchInputBlur}
                                    className="block w-full pl-10 pr-3 py-4 border-none rounded-xl bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-0 focus:bg-white dark:focus:bg-gray-700 transition-colors text-lg"
                                />
                                <SearchSuggestions
                                    searchTerm={formData.searchTerm}
                                    onSuggestionClick={handleSuggestionClick}
                                    onClose={() => setShowSuggestions(false)}
                                    isVisible={showSuggestions}
                                    className="mt-2 w-full text-left"
                                />
                            </div>

                            {/* Mobile Filter Toggle */}
                            <button
                                type="button"
                                onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                                className="md:hidden bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                            >
                                <Filter className="h-5 w-5" /> Filters
                            </button>

                            {/* Desktop Search Button */}
                            <button
                                type="submit"
                                className="hidden md:flex bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg transform hover:-translate-y-1 transition-all duration-300 items-center justify-center gap-2 min-w-[140px]"
                            >
                                Search
                            </button>
                        </div>

                        {/* Expanded Filters for Desktop */}
                        <div className="hidden md:grid grid-cols-5 gap-4 mt-4 animate-fade-in-down" style={{ animationDelay: "0.1s" }}>
                            {/* State Select */}
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                </div>
                                <select
                                    className="w-full pl-10 pr-4 py-3 bg-white/90 dark:bg-gray-800/90 border-none rounded-xl text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-sm cursor-pointer hover:bg-white dark:hover:bg-gray-700 transition-colors"
                                    value={locationFilter.state || ""}
                                    onChange={(e) => handleLocationChange({ ...locationFilter, state: e.target.value, city: "" })}
                                >
                                    <option value="">Select State</option>
                                    {(() => {
                                        const india = data.find((country) => country.name === "India");
                                        return india ? india.states.map((s) => (
                                            <option key={s.state_code} value={s.name}>{s.name}</option>
                                        )) : [];
                                    })()}
                                </select>
                            </div>

                            {/* Type Toggle */}
                            <div className="bg-white/90 dark:bg-gray-800/90 rounded-xl p-1 flex shadow-sm transition-colors duration-300">
                                {['all', 'rent', 'sale'].map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, type: t }))}
                                        className={`flex-1 capitalize py-2 rounded-lg text-sm font-medium transition-all ${formData.type === t
                                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>

                            {/* Price Range */}
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    name="minPrice"
                                    placeholder="Min Price"
                                    value={formData.minPrice}
                                    onChange={handleChanges}
                                    className="w-full px-4 py-3 bg-white/90 dark:bg-gray-800/90 border-none rounded-xl text-gray-700 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-sm transition-colors"
                                    min={0}
                                />
                                <input
                                    type="number"
                                    name="maxPrice"
                                    placeholder="Max Price"
                                    value={formData.maxPrice}
                                    onChange={handleChanges}
                                    className="w-full px-4 py-3 bg-white/90 dark:bg-gray-800/90 border-none rounded-xl text-gray-700 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-sm transition-colors"
                                    min={0}
                                />
                            </div>

                            {/* Beds / Baths */}
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    name="bedrooms"
                                    placeholder="Beds"
                                    value={formData.bedrooms}
                                    onChange={handleChanges}
                                    className="w-full px-4 py-3 bg-white/90 dark:bg-gray-800/90 border-none rounded-xl text-gray-700 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-sm transition-colors"
                                    min={0}
                                />
                                <input
                                    type="number"
                                    name="bathrooms"
                                    placeholder="Baths"
                                    value={formData.bathrooms}
                                    onChange={handleChanges}
                                    className="w-full px-4 py-3 bg-white/90 dark:bg-gray-800/90 border-none rounded-xl text-gray-700 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-sm transition-colors"
                                    min={0}
                                />
                            </div>

                            {/* Sort */}
                            <div className="relative">
                                <select
                                    onChange={(e) => {
                                        const [sort, order] = e.target.value.split("_");
                                        setFormData((prev) => ({ ...prev, sort, order }));
                                    }}
                                    value={`${formData.sort}_${formData.order}`}
                                    className="w-full px-4 py-3 bg-white/90 dark:bg-gray-800/90 border-none rounded-xl text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-sm cursor-pointer hover:bg-white dark:hover:bg-gray-700 appearance-none transition-colors"
                                >
                                    <option value="regularPrice_desc">Price: High to Low</option>
                                    <option value="regularPrice_asc">Price: Low to High</option>
                                    <option value="createdAt_desc">Newest First</option>
                                    <option value="createdAt_asc">Oldest First</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                            </div>
                        </div>

                        {/* Visual Amenities Checkboxes */}
                        <div className="hidden md:flex justify-center gap-6 mt-4 text-white/90 animate-fade-in-down" style={{ animationDelay: "0.2s" }}>
                            {[
                                { name: 'parking', label: 'Parking' },
                                { name: 'furnished', label: 'Furnished' },
                                { name: 'offer', label: 'Special Offer' }
                            ].map((amenity) => (
                                <label key={amenity.name} className="flex items-center gap-2 cursor-pointer group">
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${formData[amenity.name] ? 'bg-yellow-400 border-yellow-400' : 'border-white/50 group-hover:border-white'
                                        }`}>
                                        {formData[amenity.name] && <svg className="w-3 h-3 text-blue-900 font-bold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                    </div>
                                    <span className="text-sm font-medium group-hover:text-white transition-colors">{amenity.label}</span>
                                    <input
                                        type="checkbox"
                                        name={amenity.name}
                                        onChange={handleChanges}
                                        checked={formData[amenity.name]}
                                        className="hidden"
                                    />
                                </label>
                            ))}
                        </div>

                    </form>
                </div>
            </div>

            {/* Mobile Filters Modal/Drawer */}
            <AnimatePresence>
                {isFiltersOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
                        onClick={() => setIsFiltersOpen(false)}
                    >
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="absolute right-0 top-0 h-full w-4/5 max-w-sm bg-white dark:bg-gray-900 shadow-2xl p-6 flex flex-col gap-4 overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Filters</h2>
                                <button onClick={() => setIsFiltersOpen(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">Close</button>
                            </div>

                            {/* Mobile Filters Content */}

                            {/* State Filter */}
                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Location</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400 dark:text-gray-500" />
                                    <select
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        value={locationFilter.state || ""}
                                        onChange={(e) => handleLocationChange({ ...locationFilter, state: e.target.value, city: "" })}
                                    >
                                        <option value="">Select State</option>
                                        {(() => {
                                            const india = data.find((country) => country.name === "India");
                                            return india ? india.states.map((s) => (
                                                <option key={s.state_code} value={s.name}>{s.name}</option>
                                            )) : [];
                                        })()}
                                    </select>
                                </div>
                            </div>

                            {/* Type Filter */}
                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Property Type</label>
                                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl transition-colors">
                                    {['all', 'rent', 'sale'].map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, type: t }))}
                                            className={`flex-1 capitalize py-2 rounded-lg text-sm font-medium transition-all ${formData.type === t
                                                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                                }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Sort Filter */}
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Sort By</label>
                            <select
                                className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all mb-4"
                                onChange={(e) => {
                                    const [sort, order] = e.target.value.split("_");
                                    setFormData((prev) => ({ ...prev, sort, order }));
                                }}
                                value={`${formData.sort}_${formData.order}`}
                            >
                                <option value="regularPrice_desc">Price: High to Low</option>
                                <option value="regularPrice_asc">Price: Low to High</option>
                                <option value="createdAt_desc">Newest First</option>
                                <option value="createdAt_asc">Oldest First</option>
                            </select>

                            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors">
                                <label className="block text-sm font-semibold dark:text-gray-200 mb-2">Detailed Filters</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="number" name="minPrice" placeholder="Min ₹" value={formData.minPrice} onChange={handleChanges} className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                                    <input type="number" name="maxPrice" placeholder="Max ₹" value={formData.maxPrice} onChange={handleChanges} className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                                    <input type="number" name="bedrooms" placeholder="Beds" value={formData.bedrooms} onChange={handleChanges} className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                                    <input type="number" name="bathrooms" placeholder="Baths" value={formData.bathrooms} onChange={handleChanges} className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                {['parking', 'furnished', 'offer'].map(item => (
                                    <label key={item} className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" name={item} checked={formData[item]} onChange={handleChanges} className="w-5 h-5 accent-blue-600 dark:accent-blue-400" />
                                        <span className="capitalize text-gray-700 dark:text-gray-300">{item}</span>
                                    </label>
                                ))}
                            </div>

                            <button
                                onClick={() => {
                                    handleSubmit({ preventDefault: () => { } });
                                    setIsFiltersOpen(false);
                                }}
                                className="w-full bg-blue-600 dark:bg-blue-700 text-white py-3 rounded-xl font-bold mt-4 shadow-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-all"
                            >
                                Apply Filters
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content Area */}
            <main className="flex-grow max-w-7xl mx-auto px-4 w-full -mt-10 relative z-10 pb-20">

                {/* Active Filters Display */}
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 mb-8 transition-colors duration-300">
                    <FilterChips formData={formData} onClear={clearAllFilters} onRemove={removeFilter} />
                </div>

                {/* Listings Grid */}
                <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2 transition-colors">
                            Property Results
                            <span className="text-sm font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full transition-colors">
                                {listings.length} found
                            </span>
                        </h2>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            <ListingSkeletonGrid count={8} />
                        </div>
                    ) : error ? (
                        <div className="text-center py-10 bg-red-50 rounded-xl border border-red-100">
                            <p className="text-red-600 text-lg font-medium">{error}</p>
                            <button onClick={() => window.location.reload()} className="mt-4 text-blue-600 hover:underline">Try refreshing the page</button>
                        </div>
                    ) : listings.length === 0 ? (
                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-10 text-center animate-fade-in-up transition-colors duration-300">
                            <img src={duckImg} alt="No listings found" className="w-[280px] h-[280px] object-contain mx-auto opacity-90 dark:opacity-80 hover:scale-105 transition-transform duration-500" />
                            <h3 className="text-2xl font-bold text-gray-700 dark:text-gray-200 mb-2 transition-colors">No properties matched your search</h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto transition-colors">
                                We couldn't find exactly what you're looking for. Try adjusting your price range or removing some filters.
                            </p>
                            <button
                                onClick={clearAllFilters}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" /> Clear all filters
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {listings.map((listing, index) => (
                                    <div
                                        key={listing._id}
                                        className="animate-fade-in-up"
                                        style={{ animationDelay: `${index * 0.05}s` }} // Staggered animation
                                    >
                                        <ListingItem listing={listing} />
                                    </div>
                                ))}
                            </div>

                            {showMoreListing && (
                                <div className="flex justify-center mt-12">
                                    <button
                                        type="button"
                                        onClick={showMoreListingClick}
                                        className="group relative px-8 py-3 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold rounded-full shadow-md hover:shadow-lg hover:text-blue-600 dark:hover:text-blue-400 transition-all border border-gray-200 dark:border-gray-700"
                                    >
                                        <span className="relative z-10 flex items-center gap-2">Show More Properties <ChevronDown className="w-4 h-4 group-hover:translate-y-1 transition-transform" /></span>
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            <ContactSupportWrapper />
        </div>
    );
}