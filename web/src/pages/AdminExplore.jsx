import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaTrash, FaLock, FaSearch, FaFilter, FaMapMarkerAlt, FaHome, FaBed, FaBath, FaTag, FaCheckCircle, FaChevronDown, FaTimes, FaUser } from "react-icons/fa";
import { useSelector } from "react-redux";
import { toast } from 'react-toastify';
import ListingItem from "../components/ListingItem";
import SearchSuggestions from '../components/SearchSuggestions';
import { usePageTitle } from '../hooks/usePageTitle';
import ListingSkeletonGrid from "../components/skeletons/ListingSkeletonGrid";
import FilterChips from "../components/search/FilterChips";
import LocationSelector from "../components/LocationSelector";
import { Search as SearchIcon, IndianRupee, MapPin, Grid, List, RefreshCw, XCircle } from "lucide-react";

import { authenticatedFetch } from "../utils/auth";
import UrbanSetuSpinner from "../components/UrbanSetuSpinner";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminExplore() {
  // Set page title
  usePageTitle("Property Explorer - Admin Panel");

  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useSelector((state) => state.user);

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
    published: "all",
    ownerSearch: "",
  });

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMoreListing, setShowMoreListing] = useState(false);
  const [smartQuery, setSmartQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [locationFilter, setLocationFilter] = useState({ state: "", district: "", city: "" });
  const [isAiMode, setIsAiMode] = useState(false); // Track if we are showing AI results

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const searchObj = {
      searchTerm: urlParams.get("searchTerm") || "",
      type: urlParams.get("type") || "all",
      parking: urlParams.get("parking") === "true",
      furnished: urlParams.get("furnished") === "true",
      offer: urlParams.get("offer") === "true",
      sort: urlParams.get("sort") || "createdAt",
      order: urlParams.get("order") || "desc",
      minPrice: urlParams.get("minPrice") || "",
      maxPrice: urlParams.get("maxPrice") || "",
      city: urlParams.get("city") || "",
      state: urlParams.get("state") || "",
      bedrooms: urlParams.get("bedrooms") || "",
      bathrooms: urlParams.get("bathrooms") || "",
      published: urlParams.get("published") || "all",
      ownerSearch: urlParams.get("ownerSearch") || "",
    };
    setFormData(searchObj);
    setLocationFilter({
      state: urlParams.get("state") || "",
      district: urlParams.get("district") || "",
      city: urlParams.get("city") || "",
    });

    const fetchListings = async () => {
      setLoading(true);
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/get?${urlParams.toString()}`);
        const data = await res.json();
        setListings(data);
        setShowMoreListing(data.length > 8);
      } catch (error) {
        console.error("Error fetching listings:", error);
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

    if (name === 'searchTerm') {
      setShowSuggestions(value.trim().length >= 2);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setFormData(prev => ({ ...prev, searchTerm: suggestion.displayText }));
    setShowSuggestions(false);
    navigate(`/admin/listing/${suggestion.id}`);
  };

  const handleSearchInputFocus = () => {
    if (formData.searchTerm.trim().length >= 2) setShowSuggestions(true);
  };

  const handleSearchInputBlur = () => {
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const urlParams = new URLSearchParams(formData);
    navigate(`?${urlParams.toString()}`);
    setIsFiltersOpen(false);
  };

  const clearAllFilters = () => {
    const reset = {
      searchTerm: "", type: "all", parking: false, furnished: false, offer: false,
      sort: "createdAt", order: "desc", minPrice: "", maxPrice: "",
      city: "", state: "", bedrooms: "", bathrooms: "",
      published: "all",
      ownerSearch: ""
    };
    setFormData(reset);
    setLocationFilter({ state: "", district: "", city: "" });
    navigate(`?`);
    setIsFiltersOpen(false);
    setIsAiMode(false);
    setSmartQuery("");
  };

  const handleLocationChange = (loc) => {
    setLocationFilter(loc);
    setFormData((prev) => ({ ...prev, state: loc.state, district: loc.district, city: loc.city }));
  };

  // Admin delete flow
  const handleDelete = (id) => {
    setPendingDeleteId(id);
    setDeleteReason("");
    setDeleteError("");
    setShowReasonModal(true);
  };

  const handleReasonSubmit = (e) => {
    e.preventDefault();
    if (!deleteReason.trim()) {
      setDeleteError("Reason is required");
      return;
    }
    setShowReasonModal(false);
    setDeleteError("");
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!deletePassword) {
      setDeleteError("Password is required");
      return;
    }
    setDeleteLoading(true);
    setDeleteError("");
    try {
      const verifyRes = await authenticatedFetch(`${API_BASE_URL}/api/user/verify-password/${currentUser._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (!verifyRes.ok) {
        setDeleteError("Incorrect password. Property not deleted.");
        setDeleteLoading(false);
        return;
      }
      const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/delete/${pendingDeleteId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason }),
      });
      if (res.ok) {
        setListings((prev) => prev.filter((l) => l._id !== pendingDeleteId));
        setShowPasswordModal(false);
        toast.success("Listing deleted successfully!");
      } else {
        const data = await res.json();
        setDeleteError(data.message || "Failed to delete listing.");
      }
    } catch (err) {
      setDeleteError("An error occurred. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const applySmartQuery = async (e, directQuery = null) => {
    if (e) e.preventDefault();
    const natural = (directQuery || smartQuery || '').trim();
    if (!natural) return;

    setLoading(true);
    setIsAiMode(true);
    if (directQuery) setSmartQuery(directQuery);

    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/ai-search?query=${encodeURIComponent(natural)}&limit=20`);
      const responseData = await res.json();

      if (responseData.success) {
        setListings(responseData.data);
        setShowMoreListing(false); // Vector search results are usually fixed size
        toast.success(`Setu AI found ${responseData.data.length} semantic matches`);
      } else {
        toast.error("AI Search failed to process query.");
        setListings([]);
      }
    } catch (err) {
      console.error("AI Search Error:", err);
      toast.error("Setu AI is currently unreachable.");
    } finally {
      setLoading(false);
    }
  };

  const showMoreListingClick = async () => {
    const urlParams = new URLSearchParams(location.search);
    urlParams.set("startIndex", listings.length);
    const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/get?${urlParams.toString()}`);
    const data = await res.json();
    setListings((prev) => [...prev, ...data]);
    setShowMoreListing(data.length >= 8);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col font-sans transition-colors duration-300">

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 dark:from-slate-800 dark:via-indigo-950 dark:to-purple-950 pb-20 pt-12 px-4 shadow-2xl relative overflow-hidden transition-all duration-500">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
          <div className="absolute top-[-50%] left-[-10%] w-[600px] h-[600px] rounded-full bg-white mix-blend-overlay filter blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-purple-400 mix-blend-overlay filter blur-[120px] animate-pulse" style={{ animationDelay: "2s" }}></div>
        </div>

        <div className="max-w-7xl mx-auto text-center relative z-20 animate-fade-in-down">
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tighter uppercase">
            Property <span className="text-yellow-400 dark:text-yellow-500 italic drop-shadow-lg">Universe</span>
          </h1>
          <p className="text-blue-100 dark:text-blue-200 mb-10 text-xl max-w-2xl mx-auto font-medium opacity-90">
            Advanced Administrative Portal for Real-Time Asset Management & Exploration.
          </p>

          {/* AI Banner */}
          {isAiMode && (
            <div className="mb-6 flex justify-center animate-fade-in-down">
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 px-6 py-2 rounded-full font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-xl">
                <UrbanSetuSpinner size="sm" /> VECTOR SEARCH ACTIVE
                <button onClick={clearAllFilters} className="ml-4 hover:text-white transition-colors"><FaTimes /></button>
              </div>
            </div>
          )}

          {/* AI Search Bar */}
          <div className="max-w-4xl mx-auto relative z-30 group">
            <form onSubmit={applySmartQuery} className="relative">
              <div className="bg-white/10 dark:bg-black/20 backdrop-blur-2xl p-3 rounded-[32px] border border-white/20 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:border-white/40 transition-all duration-500 flex flex-col md:flex-row gap-3">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                    <svg className="w-6 h-6 text-yellow-400 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <input
                    value={smartQuery}
                    onChange={(e) => setSmartQuery(e.target.value)}
                    placeholder="Try '3BHK Villa in Pune under 2Cr'..."
                    className="block w-full pl-14 pr-6 py-5 border-none rounded-2xl bg-white/95 dark:bg-gray-800/95 text-gray-900 dark:text-white font-bold placeholder-gray-400 focus:outline-none focus:ring-0 transition-all text-lg shadow-inner"
                  />
                </div>
                <button type="submit" className="bg-gradient-to-br from-yellow-400 to-orange-500 text-slate-900 px-10 py-5 rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl hover:shadow-yellow-400/20 active:scale-95 transition-all">
                  Launch AI Scan
                </button>
              </div>
            </form>

            <div className="mt-6 flex flex-wrap justify-center gap-3 animate-fade-in">
              <span className="text-[10px] font-black text-blue-200 uppercase tracking-[0.2em] py-2">Quick Scans:</span>
              {[
                { label: "High ROI Assets", query: "properties with high ROI and market growth potential" },
                { label: "Luxury Inventory", query: "premium penthouses and villas with luxury amenities" },
                { label: "Eco-Rating AAA", query: "AAA ESG rated properties with solar energy" },
                { label: "Distressed Properties", query: "fixer upper properties with budget pricing" }
              ].map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => applySmartQuery(null, s.query)}
                  className="text-[10px] bg-white/10 hover:bg-white/20 border border-white/10 text-white px-4 py-2 rounded-xl font-black uppercase tracking-widest transition-all backdrop-blur-md active:scale-95"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 w-full -mt-16 relative z-40 pb-20">

        <div className="flex flex-col lg:flex-row gap-8">

          {/* Filters Sidebar */}
          <aside className={`lg:w-80 space-y-8 lg:block ${isFiltersOpen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900 p-8 overflow-y-auto block' : 'hidden'}`}>

            {isFiltersOpen && (
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black dark:text-white uppercase">Filters</h3>
                <button onClick={() => setIsFiltersOpen(false)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                  <FaTimes />
                </button>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 p-8 rounded-[32px] shadow-2xl border border-gray-100 dark:border-gray-700 sticky top-24 transition-colors">
              <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-100 dark:border-gray-700">
                <FaFilter className="text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Parameters</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">

                {/* Search Term */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] ml-1">Asset Keyword</label>
                  <div className="relative group">
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      name="searchTerm"
                      value={formData.searchTerm}
                      onChange={handleChanges}
                      onFocus={handleSearchInputFocus}
                      onBlur={handleSearchInputBlur}
                      placeholder="Search..."
                      className="w-full pl-12 pr-4 py-4 bg-gray-50/50 dark:bg-gray-900/50 border-2 border-transparent dark:border-gray-700 rounded-2xl focus:bg-white dark:focus:bg-gray-800 focus:border-indigo-500 transition-all font-bold text-gray-800 dark:text-white"
                    />
                    <SearchSuggestions
                      searchTerm={formData.searchTerm}
                      onSuggestionClick={handleSuggestionClick}
                      onClose={() => setShowSuggestions(false)}
                      isVisible={showSuggestions}
                    />
                  </div>
                </div>

                {/* Owner Search */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] ml-1">Owner Name</label>
                  <div className="relative group">
                    <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      name="ownerSearch"
                      value={formData.ownerSearch}
                      onChange={handleChanges}
                      placeholder="Filter Properties by Owner..."
                      className="w-full pl-12 pr-4 py-4 bg-gray-50/50 dark:bg-gray-900/50 border-2 border-transparent dark:border-gray-700 rounded-2xl focus:bg-white dark:focus:bg-gray-800 focus:border-indigo-500 transition-all font-bold text-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Location Filter */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] ml-1">Location</label>
                  <LocationSelector value={locationFilter} onChange={handleLocationChange} mode="search" className="w-full" />
                </div>


                {/* Verification Status */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] ml-1">Verification Status</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'all', label: 'All' },
                      { value: 'true', label: 'Verified' },
                      { value: 'false', label: 'Pending' }
                    ].map((status) => (
                      <button
                        key={status.value}
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, published: status.value }))}
                        className={`py-3 rounded-xl font-black uppercase text-[10px] tracking-widest border-2 transition-all ${formData.published === status.value
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                          : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-300'}`}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type Selection */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] ml-1">Transaction</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['all', 'rent', 'sale'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, type: t }))}
                        className={`py-3 rounded-xl font-black uppercase text-[10px] tracking-widest border-2 transition-all ${formData.type === t
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                          : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-300'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price & Size Filter */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] ml-1">Price Range</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                      <input
                        type="number"
                        name="minPrice"
                        value={formData.minPrice}
                        onChange={handleChanges}
                        placeholder="Min"
                        className="w-full pl-8 pr-3 py-3 bg-gray-50/50 dark:bg-gray-900/50 border-2 border-transparent dark:border-gray-700 rounded-xl focus:bg-white dark:focus:bg-gray-800 focus:border-indigo-500 transition-all font-bold text-xs text-gray-800 dark:text-white"
                      />
                    </div>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                      <input
                        type="number"
                        name="maxPrice"
                        value={formData.maxPrice}
                        onChange={handleChanges}
                        placeholder="Max"
                        className="w-full pl-8 pr-3 py-3 bg-gray-50/50 dark:bg-gray-900/50 border-2 border-transparent dark:border-gray-700 rounded-xl focus:bg-white dark:focus:bg-gray-800 focus:border-indigo-500 transition-all font-bold text-xs text-gray-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] ml-1">Configuration</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      name="bedrooms"
                      value={formData.bedrooms}
                      onChange={handleChanges}
                      placeholder="Beds"
                      className="w-full px-4 py-3 bg-gray-50/50 dark:bg-gray-900/50 border-2 border-transparent dark:border-gray-700 rounded-xl focus:bg-white dark:focus:bg-gray-800 focus:border-indigo-500 transition-all font-bold text-xs text-gray-800 dark:text-white"
                    />
                    <input
                      type="number"
                      name="bathrooms"
                      value={formData.bathrooms}
                      onChange={handleChanges}
                      placeholder="Baths"
                      className="w-full px-4 py-3 bg-gray-50/50 dark:bg-gray-900/50 border-2 border-transparent dark:border-gray-700 rounded-xl focus:bg-white dark:focus:bg-gray-800 focus:border-indigo-500 transition-all font-bold text-xs text-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Amenities Toggles */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] ml-1">Requirements</label>
                  <div className="grid grid-cols-1 gap-3">
                    {['parking', 'furnished', 'offer'].map((item) => (
                      <label key={item} className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-900/50 rounded-2xl cursor-pointer hover:bg-white dark:hover:bg-gray-800 border-2 border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/30 transition-all group">
                        <span className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest">{item}</span>
                        <div className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            name={item}
                            checked={formData[item]}
                            onChange={handleChanges}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Sorting */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] ml-1">Chronology</label>
                  <select
                    name="sort_order"
                    onChange={(e) => {
                      const [sort, order] = e.target.value.split('_');
                      setFormData(p => ({ ...p, sort, order }));
                    }}
                    value={`${formData.sort}_${formData.order}`}
                    className="w-full px-5 py-4 bg-gray-50/50 dark:bg-gray-900/50 border-2 border-transparent dark:border-gray-700 rounded-2xl focus:bg-white dark:focus:bg-gray-800 focus:border-indigo-500 transition-all font-black text-xs uppercase tracking-widest text-gray-800 dark:text-white appearance-none cursor-pointer"
                  >
                    <option value="createdAt_desc">Newest First</option>
                    <option value="createdAt_asc">Oldest First</option>
                    <option value="regularPrice_desc">Price: High to Low</option>
                    <option value="regularPrice_asc">Price: Low to High</option>
                  </select>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3 pt-6 border-t border-gray-100 dark:border-gray-700">
                  <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 active:scale-95 transition-all">
                    Apply Matrix
                  </button>
                  <button type="button" onClick={clearAllFilters} className="w-full py-4 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all">
                    Reset
                  </button>
                </div>
              </form>
            </div>
          </aside>

          {/* Listings Result Area */}
          <div className="flex-1">

            {/* Control Bar */}
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-md p-4 rounded-3xl mb-8 border border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl">
                  <Grid className="text-indigo-600 dark:text-indigo-400 w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">Active Inventory</h3>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{listings.length} Results Tracked</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsFiltersOpen(true)}
                  className="lg:hidden p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400"
                >
                  <FaFilter />
                </button>
                <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-gray-800 shadow-md text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}
                  >
                    <Grid size={18} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-800 shadow-md text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}
                  >
                    <List size={18} />
                  </button>
                </div>
                <button onClick={() => window.location.reload()} className="p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 hover:text-indigo-500 transition-colors">
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>

            {/* Listings Grid */}
            <div className={`grid gap-8 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-2' : 'grid-cols-1'}`}>
              {loading ? (
                Array(6).fill(0).map((_, i) => <ListingSkeletonGrid key={i} />)
              ) : listings.length === 0 ? (
                <div className="col-span-full py-32 text-center bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                  <div className="opacity-20 flex flex-col items-center">
                    <XCircle size={80} className="mb-4" />
                    <h4 className="text-2xl font-black uppercase">Anomaly Detected: No Results</h4>
                    <p className="font-bold tracking-widest text-xs mt-2 uppercase">Adjust parameters to re-scan</p>
                    <button onClick={clearAllFilters} className="mt-8 px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg">Wipe Filters</button>
                  </div>
                </div>
              ) : (
                listings.map((listing) => (
                  <ListingItem
                    key={listing._id}
                    listing={listing}
                    onDelete={() => handleDelete(listing._id)}
                  />
                ))
              )}
            </div>

            {/* Show More */}
            {showMoreListing && (
              <div className="mt-16 flex justify-center">
                <button
                  onClick={showMoreListingClick}
                  className="px-12 py-5 bg-white dark:bg-gray-800 border-2 border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 rounded-3xl font-black uppercase text-xs tracking-[0.3em] hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 dark:hover:text-white transition-all shadow-xl shadow-indigo-600/10 active:scale-95"
                >
                  Retrieve More Assets
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Delete Reason Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4 sm:p-8 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-[40px] shadow-2xl w-full max-w-md border border-white/20 overflow-hidden transform animate-scale-in">
            <div className="p-8 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-red-600 rounded-2xl shadow-lg shadow-red-600/30">
                  <FaTrash className="text-white text-xl" />
                </div>
                <div>
                  <h3 className="text-2xl font-black dark:text-white uppercase tracking-tighter">Authorization Required</h3>
                  <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mt-1">Deletion Protocol Engaged</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleReasonSubmit} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Reason for Eradicating Asset</label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-red-500 focus:bg-white dark:focus:bg-gray-800 transition-all font-bold text-gray-800 dark:text-white min-h-[120px] resize-none"
                  placeholder="Categorize the violation or reason..."
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowReasonModal(false)} className="flex-1 py-4 font-black uppercase text-[10px] tracking-widest text-gray-400 hover:text-gray-600">Abort</button>
                <button type="submit" className="flex-2 px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black uppercase text-[10px] tracking-widest">Next Step</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-[40px] shadow-2xl w-full max-w-md border border-white/20 overflow-hidden transform animate-scale-in">
            <div className="p-8 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-amber-500 rounded-2xl shadow-lg shadow-amber-500/30">
                  <FaLock className="text-white text-xl" />
                </div>
                <div>
                  <h3 className="text-2xl font-black dark:text-white uppercase tracking-tighter">Final Verification</h3>
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mt-1">Confirm Identity to Proceed</p>
                </div>
              </div>
            </div>
            <form onSubmit={handlePasswordSubmit} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Admin Passkey</label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-red-500 focus:bg-white dark:focus:bg-gray-800 transition-all font-bold text-gray-800 dark:text-white"
                  placeholder="••••••••"
                />
              </div>
              {deleteError && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-600 dark:text-red-400 font-bold text-xs uppercase tracking-widest animate-shake">
                  {deleteError}
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 py-4 font-black uppercase text-[10px] tracking-widest text-gray-400 hover:text-gray-600">Abort</button>
                <button
                  type="submit"
                  disabled={deleteLoading}
                  className="flex-2 px-8 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-600/30 flex items-center justify-center gap-2"
                >
                  {deleteLoading ? <UrbanSetuSpinner size="sm" isBright={true} /> : 'Eradicate Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
