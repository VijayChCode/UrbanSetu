import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import ListingItem from '../components/ListingItem';
import SavedPropertiesSkeleton from '../components/skeletons/SavedPropertiesSkeleton';
import SocialSharePanel from '../components/SocialSharePanel';
import { toast } from 'react-toastify';
import { socket } from '../utils/socket.js';
import { FaEye, FaTrash, FaSearch, FaFilter, FaSort, FaPlus, FaTimes, FaFire, FaArrowDown, FaArrowUp, FaExclamationTriangle, FaCheckCircle, FaDownload, FaShare, FaBookmark, FaCalendarAlt, FaChartLine, FaBars, FaCheck, FaTimes as FaX } from 'react-icons/fa';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';

import { usePageTitle } from '../hooks/usePageTitle';
import { authenticatedFetch } from '../utils/auth';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function Watchlist() {
  // Set page title
  usePageTitle("My Watchlist - Property Alerts");

  const { currentUser } = useSelector((state) => state.user);
  const [items, setItems] = useState([]); // available listings
  const [watchlistItems, setWatchlistItems] = useState([]); // raw docs
  const [baselineMap, setBaselineMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('dateAdded');
  const [filterType, setFilterType] = useState('all');
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [propertySearchTerm, setPropertySearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [showStats, setShowStats] = useState(false);
  const [watchlistStats, setWatchlistStats] = useState({
    totalValue: 0,
    averagePrice: 0,
    priceRange: { min: 0, max: 0 },
    typeDistribution: {},
    cityDistribution: {}
  });
  const [shareModal, setShareModal] = useState({ isOpen: false, url: '', title: '', description: '' });

  const fetchWatchlist = async () => {
    if (!currentUser?._id) return;
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/watchlist/user/${currentUser._id}`);
      if (res.ok) {
        const data = await res.json();
        setWatchlistItems(data);
        const listings = data.filter((x) => x.listingId).map((x) => x.listingId);
        setItems(listings);
        const map = new Map();
        data.forEach((x) => {
          if (x.listingId && x.effectivePriceAtAdd != null) {
            map.set(x.listingId._id, x.effectivePriceAtAdd);
          }
        });
        setBaselineMap(map);

        // Note: Price drop detection and email alerts are now handled automatically
        // when sellers update prices via the backend notification system
      }
    } catch (e) {
      // noop
    }
  };

  // Price drop email alerts are now handled automatically by the backend
  // when sellers update property prices

  // Helper used by multiple computations - must be defined before usage
  const getEffectivePrice = (l) => {
    if (!l) return null;
    const effective = (l.offer && l.discountPrice) ? l.discountPrice : l.regularPrice;
    return effective ?? null;
  };

  // Price change detection is now handled automatically by the backend
  // when sellers update property prices via the listing update endpoint

  // Calculate watchlist statistics
  const calculateWatchlistStats = () => {
    if (items.length === 0) {
      setWatchlistStats({
        totalValue: 0,
        averagePrice: 0,
        priceRange: { min: 0, max: 0 },
        typeDistribution: {},
        cityDistribution: {}
      });
      return;
    }

    const prices = items.map(item => item.regularPrice || 0).filter(price => price > 0);
    const totalValue = prices.reduce((sum, price) => sum + price, 0);
    const averagePrice = prices.length > 0 ? totalValue / prices.length : 0;
    const priceRange = {
      min: prices.length > 0 ? Math.min(...prices) : 0,
      max: prices.length > 0 ? Math.max(...prices) : 0
    };

    const typeDistribution = items.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});

    const cityDistribution = items.reduce((acc, item) => {
      const city = item.city || 'Unknown';
      acc[city] = (acc[city] || 0) + 1;
      return acc;
    }, {});

    setWatchlistStats({
      totalValue,
      averagePrice,
      priceRange,
      typeDistribution,
      cityDistribution
    });
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchWatchlist();
      setLoading(false);
    };
    loadData();
  }, [currentUser?._id]);

  // Periodic check for price changes (every 5 minutes)
  useEffect(() => {
    if (!currentUser?._id || items.length === 0) return;

    const interval = setInterval(() => {
      // Re-fetch watchlist to get latest prices and check for changes (background refresh)
      fetchWatchlist();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [currentUser?._id, items.length]);

  // Check for price changes when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && currentUser?._id && items.length > 0) {
        // Page became visible, check for price changes (background refresh)
        fetchWatchlist();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser?._id, items.length]);

  useEffect(() => {
    calculateWatchlistStats();
  }, [items]);

  const handleRemove = async (listingId) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/watchlist/remove/${listingId}`, { method: 'DELETE' });
      if (res.ok) {
        setItems(prev => prev.filter(l => l._id !== listingId));
        setWatchlistItems(prev => prev.filter(w => (w.listingId?.['_id'] || w.listingIdRaw) !== listingId));
        toast.success('Removed from watchlist');
      }
    } catch (_) { }
  };

  const searchProperties = async (searchQuery = propertySearchTerm) => {
    const q = typeof searchQuery === 'string' ? searchQuery.trim() : '';
    if (!q) return;
    setSearching(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/search/suggestions?q=${encodeURIComponent(q)}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.suggestions);
          // Also update suggestions to be the same as search results
          setSearchSuggestions(data.suggestions.slice(0, 5));
        }
      }
    } catch (error) {
      console.error('Error searching properties:', error);
      toast.error('Failed to search properties');
    } finally {
      setSearching(false);
    }
  };

  const fetchSearchSuggestions = async (query) => {
    const q = typeof query === 'string' ? query.trim() : '';
    if (!q || q.length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSuggestionLoading(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/search/suggestions?q=${encodeURIComponent(q)}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSearchSuggestions(data.suggestions);
          setShowSuggestions(true);
        }
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setSuggestionLoading(false);
    }
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setPropertySearchTerm(value);
    fetchSearchSuggestions(value);
  };

  const selectSuggestion = (listing) => {
    setPropertySearchTerm(listing.name);
    setShowSuggestions(false);
    setSearchSuggestions([]);
    // Automatically search when suggestion is selected
    searchProperties(listing.name);
  };

  const addToWatchlist = async (listing) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/watchlist/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing._id })
      });
      if (res.ok) {
        const data = await res.json();
        setItems(prev => [listing, ...prev]);
        setSearchResults(prev => prev.filter(l => l._id !== listing._id));
        const effectiveAtAdd = data?.item?.effectivePriceAtAdd ?? data?.wishlistItem?.effectivePriceAtAdd ?? null;
        if (effectiveAtAdd != null) {
          setBaselineMap(prev => new Map(prev).set(listing._id, effectiveAtAdd));
        }
        toast.success('Added to watchlist');
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to add to watchlist');
      }
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      toast.error('Failed to add to watchlist');
    }
  };

  const isInWatchlist = (listingId) => {
    return items.some(item => item._id === listingId);
  };

  // Bulk actions
  const handleSelectItem = (listingId) => {
    setSelectedItems(prev =>
      prev.includes(listingId)
        ? prev.filter(id => id !== listingId)
        : [...prev, listingId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredAndSortedItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredAndSortedItems.map(item => item._id));
    }
  };

  const handleBulkRemove = async () => {
    if (selectedItems.length === 0) return;

    try {
      const promises = selectedItems.map(listingId =>
        authenticatedFetch(`${API_BASE_URL}/api/watchlist/remove/${listingId}`, {
          method: 'DELETE',
        })
      );

      await Promise.all(promises);
      setItems(prev => prev.filter(item => !selectedItems.includes(item._id)));
      setSelectedItems([]);
      setBulkActionMode(false);
      toast.success(`${selectedItems.length} properties removed from watchlist`);
    } catch (error) {
      toast.error('Failed to remove some properties');
    }
  };

  const handleExportWatchlist = () => {
    const data = filteredAndSortedItems.map(item => ({
      name: item.name,
      type: item.type,
      price: item.regularPrice,
      discountPrice: item.discountPrice,
      city: item.city,
      state: item.state,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      addedDate: new Date(item.createdAt).toLocaleDateString()
    }));

    const csvContent = [
      ['Property Name', 'Type', 'Price', 'Discount Price', 'City', 'State', 'Bedrooms', 'Bathrooms', 'Added Date'],
      ...data.map(item => [
        item.name,
        item.type,
        item.price,
        item.discountPrice || '',
        item.city,
        item.state,
        item.bedrooms,
        item.bathrooms,
        item.addedDate
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watchlist-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Watchlist exported successfully');
  };

  const handleShareWatchlist = () => {
    setShareModal({
      isOpen: true,
      url: window.location.href,
      title: 'My Property Watchlist',
      description: `Check out my watchlist with ${items.length} properties!`
    });
  };

  // Filter and sort items
  const filteredAndSortedItems = items
    .filter(item => {
      const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.state?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || item.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return (a.regularPrice || 0) - (b.regularPrice || 0);
        case 'price-high':
          return (b.regularPrice || 0) - (a.regularPrice || 0);
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'dateAdded':
        default:
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
    });

  if (loading) {
    return <SavedPropertiesSkeleton />;
  }



  const isPriceDropped = (l) => {
    const effective = getEffectivePrice(l);
    if (effective == null) return false;
    const baseline = baselineMap.get(l._id);
    if (baseline == null) return false;
    return effective < baseline;
  };

  const isPriceIncreased = (l) => {
    const effective = getEffectivePrice(l);
    if (effective == null) return false;
    const baseline = baselineMap.get(l._id);
    if (baseline == null) return false;
    return effective > baseline;
  };

  const getPerItemStats = (listing) => {
    const doc = watchlistItems.find(w => (w.listingId?._id || w.listingIdRaw)?.toString() === listing._id);
    const addedAt = doc?.addedAt || doc?.createdAt || null;
    const baseline = baselineMap.get(listing._id) ?? doc?.effectivePriceAtAdd ?? null;
    const current = getEffectivePrice(listing);
    let change = null;
    let status = 'neutral';
    if (baseline != null && current != null) {
      change = current - baseline;
      status = change < 0 ? 'dropped' : (change > 0 ? 'increased' : 'neutral');
    }
    return { addedAt, baseline, current, change, status };
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-100 dark:from-gray-950 dark:to-gray-900 min-h-screen py-2 sm:py-10 px-1 sm:px-2 md:px-8 overflow-x-hidden transition-colors duration-300">
      <div className="max-w-6xl mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg dark:shadow-purple-900/10 p-2 sm:p-4 lg:p-6 border border-transparent dark:border-gray-800 transition-colors duration-300">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <FaEye className="text-3xl text-purple-700 dark:text-purple-400" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-purple-700 dark:text-purple-400">My Watchlist</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {filteredAndSortedItems.length} of {items.length} properties
                {watchlistStats.totalValue > 0 && (
                  <span className="ml-2 text-purple-600 dark:text-purple-400 font-semibold">
                    • Total Value: ₹{watchlistStats.totalValue.toLocaleString('en-IN')}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
            {/* Mobile: Stack buttons vertically, Desktop: Horizontal */}
            <div className="flex flex-wrap items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow dark:text-white' : 'text-gray-500'}`}
                  title="Grid View"
                >
                  <FaBars className="text-sm" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow dark:text-white' : 'text-gray-500'}`}
                  title="List View"
                >
                  <FaBars className="rotate-90 text-sm" />
                </button>
              </div>

              {/* Stats Toggle */}
              <button
                onClick={() => setShowStats(!showStats)}
                className={`px-2 sm:px-3 py-2 rounded-lg transition-colors flex items-center gap-1 sm:gap-2 text-xs sm:text-sm ${showStats ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
              >
                <FaChartLine className="text-xs sm:text-sm" />
                <span className="hidden sm:inline">Stats</span>
              </button>

              {/* Bulk Actions */}
              {items.length > 0 && (
                <button
                  onClick={() => setBulkActionMode(!bulkActionMode)}
                  className={`px-2 sm:px-3 py-2 rounded-lg transition-colors flex items-center gap-1 sm:gap-2 text-xs sm:text-sm ${bulkActionMode ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                >
                  <FaCheck className="text-xs sm:text-sm" />
                  <span className="hidden sm:inline">Select</span>
                </button>
              )}
            </div>

            {/* Second row for mobile */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Export */}
              <button
                onClick={handleExportWatchlist}
                className="px-2 sm:px-3 py-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                disabled={items.length === 0}
              >
                <FaDownload className="text-xs sm:text-sm" />
                <span className="hidden sm:inline">Export</span>
              </button>

              {/* Share */}
              <button
                onClick={handleShareWatchlist}
                className="px-2 sm:px-3 py-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                disabled={items.length === 0}
              >
                <FaShare className="text-xs sm:text-sm" />
                <span className="hidden sm:inline">Share</span>
              </button>

              {/* Add Properties */}
              <button
                onClick={() => setShowAddProperty(!showAddProperty)}
                className="bg-purple-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
              >
                <FaPlus className="text-xs sm:text-sm" />
                <span className="hidden sm:inline">Add Properties</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Add Property Search Section */}
        {showAddProperty && (
          <div className="mb-6 bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-300">Search and Add Properties</h3>
              <button
                onClick={() => setShowAddProperty(false)}
                className="text-purple-600 hover:text-purple-800"
              >
                <FaTimes className="text-lg" />
              </button>
            </div>
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search properties by name, city, or state..."
                  value={propertySearchTerm}
                  onChange={handleSearchInputChange}
                  onKeyPress={(e) => e.key === 'Enter' && searchProperties()}
                  onFocus={() => propertySearchTerm.length >= 2 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                />

                {/* Search Suggestions Dropdown */}
                {showSuggestions && (searchSuggestions.length > 0 || suggestionLoading) && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                    {suggestionLoading ? (
                      <div className="p-3 text-center text-gray-500">
                        <UrbanSetuSpinner size="sm" className="mx-auto" />
                        <p className="mt-1 text-sm">Searching...</p>
                      </div>
                    ) : (
                      searchSuggestions.map((listing) => (
                        <div
                          key={listing._id}
                          onClick={() => selectSuggestion(listing)}
                          className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                        >
                          <div className="flex items-center gap-3">
                            {listing.imageUrls && listing.imageUrls.length > 0 ? (
                              <img
                                src={listing.imageUrls[0]}
                                alt={listing.name}
                                className="w-12 h-12 object-cover rounded-md"
                                onError={(e) => {
                                  e.target.src = "https://via.placeholder.com/48x48?text=No+Image";
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center">
                                <span className="text-gray-400 text-lg">🏠</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-800 dark:text-gray-200 truncate">{listing.name}</h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{listing.city}, {listing.state}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-500">
                                {listing.type} • {listing.bedrooms} bed{listing.bedrooms !== 1 ? 's' : ''} • ₹{listing.regularPrice?.toLocaleString('en-IN')}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    {searchSuggestions.length === 0 && !suggestionLoading && (
                      <div className="p-3 text-center text-gray-500">
                        <p className="text-sm">No properties found</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={searchProperties}
                disabled={searching || !propertySearchTerm.trim()}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {searching ? (
                  <>
                    <UrbanSetuSpinner size="sm" isBright={true} />
                    Searching...
                  </>
                ) : (
                  <>
                    <FaSearch />
                    Search
                  </>
                )}
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map((listing) => (
                  <div key={listing._id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200">{listing.name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{listing.city}, {listing.state}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        {listing.type} • {listing.bedrooms} bed{listing.bedrooms !== 1 ? 's' : ''} • ₹{listing.regularPrice?.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <button
                      onClick={() => addToWatchlist(listing)}
                      disabled={isInWatchlist(listing._id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isInWatchlist(listing._id)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                    >
                      {isInWatchlist(listing._id) ? 'Added' : 'Add to Watchlist'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats Section */}
        {showStats && items.length > 0 && (
          <div className="mb-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 p-6 rounded-lg border border-purple-200 dark:border-purple-800">
            <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-300 mb-4 flex items-center gap-2">
              <FaChartLine className="text-purple-600" />
              Watchlist Statistics
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-sm border border-transparent dark:border-gray-700">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Properties</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{items.length}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-sm border border-transparent dark:border-gray-700">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Average Price</p>
                <p className="text-sm sm:text-2xl font-bold text-green-600 dark:text-green-400">₹{watchlistStats.averagePrice.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-sm col-span-2 lg:col-span-1 border border-transparent dark:border-gray-700">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Price Range</p>
                <p className="text-xs sm:text-lg font-bold text-blue-600 dark:text-blue-400">
                  ₹{watchlistStats.priceRange.min.toLocaleString('en-IN')} - ₹{watchlistStats.priceRange.max.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-sm col-span-2 lg:col-span-1 border border-transparent dark:border-gray-700">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Value</p>
                <p className="text-sm sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">₹{watchlistStats.totalValue.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* Distribution Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-transparent dark:border-gray-700">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">By Type</h4>
                <div className="space-y-2">
                  {Object.entries(watchlistStats.typeDistribution).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{type}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-purple-500 h-2 rounded-full"
                            style={{ width: `${(count / items.length) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-transparent dark:border-gray-700">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">By City</h4>
                <div className="space-y-2">
                  {Object.entries(watchlistStats.cityDistribution)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([city, count]) => (
                      <div key={city} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{city}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-pink-500 h-2 rounded-full"
                              style={{ width: `${(count / items.length) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{count}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {bulkActionMode && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 p-3 sm:p-4 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors"
                >
                  <FaCheck className="text-sm" />
                  {selectedItems.length === filteredAndSortedItems.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-200 text-center sm:text-left">
                  {selectedItems.length} of {filteredAndSortedItems.length} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkRemove}
                  disabled={selectedItems.length === 0}
                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                >
                  <FaTrash className="text-sm" />
                  <span className="hidden sm:inline">Remove Selected</span>
                  <span className="sm:hidden">Remove</span>
                </button>
                <button
                  onClick={() => {
                    setBulkActionMode(false);
                    setSelectedItems([]);
                  }}
                  className="px-3 sm:px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center justify-center gap-2 text-sm"
                >
                  <FaX className="text-sm" />
                  <span className="hidden sm:inline">Cancel</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filter Controls */}
        {items.length > 0 && (
          <div className="mb-6 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search properties by name, city, or state..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
              />
            </div>

            {/* Filter and Sort Controls */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Type Filter */}
              <div className="flex items-center gap-2">
                <FaFilter className="text-gray-500" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                >
                  <option value="all">All Types</option>
                  <option value="sale">For Sale</option>
                  <option value="rent">For Rent</option>
                </select>
              </div>

              {/* Sort Options */}
              <div className="flex items-center gap-2">
                <FaSort className="text-gray-500" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                >
                  <option value="dateAdded">Date Added</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="name">Name: A to Z</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Removed/Unavailable Properties */}
        {watchlistItems.some(w => !w.listingId) && (
          <div className="mb-6 p-4 rounded-lg border border-yellow-200 dark:border-yellow-900/30 bg-yellow-50 dark:bg-yellow-900/20">
            <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Removed or Unavailable</h3>
            <div className="space-y-2">
              {watchlistItems.filter(w => !w.listingId).map((w) => (
                <div key={w._id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                  <div>
                    <p className="text-gray-800 dark:text-gray-200 font-medium">This property has been removed or is no longer available.</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">You can remove it from your watchlist.</p>
                  </div>
                  {w.listingIdRaw && (
                    <button onClick={() => handleRemove(w.listingIdRaw)} className="px-3 py-1 rounded bg-red-600 text-white text-sm flex items-center gap-2 hover:bg-red-700 transition-colors">
                      <FaTrash className="text-xs" /> Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        {items.length === 0 ? (
          <div className="text-center py-10 sm:py-16">
            <div className="text-6xl sm:text-8xl mb-4">👁️</div>
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-white mb-2">Your watchlist is empty</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Track properties to get price-drop and availability alerts.</p>
            <Link
              to="/search"
              className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
            >
              <FaSearch />
              Browse Properties
            </Link>
          </div>
        ) : filteredAndSortedItems.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">No properties found</h3>
            <p className="text-gray-600 dark:text-gray-400">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <div className={viewMode === 'grid'
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6"
            : "space-y-4 overflow-x-hidden"
          }>
            {filteredAndSortedItems.map((listing) => {
              const stats = getPerItemStats(listing);
              const hasChangeInfo = stats && stats.baseline != null && stats.current != null;
              const statusColor = stats.status === 'dropped' ? 'text-green-600 dark:text-green-400' : (stats.status === 'increased' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400');
              return (
                <div key={listing._id} className={`relative group ${viewMode === 'list' ? 'flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 w-full overflow-hidden' : ''}`}>
                  {isPriceDropped(listing) && (
                    <div className="absolute top-2 left-2 z-10">
                      <span className="bg-green-500 text-white text-[10px] sm:text-xs font-semibold px-2 py-1 rounded-full shadow-md flex items-center gap-1">
                        <FaArrowDown className="text-[10px] sm:text-xs" /> Price dropped
                      </span>
                    </div>
                  )}
                  {isPriceIncreased(listing) && (
                    <div className="absolute top-2 left-2 z-10">
                      <span className="bg-red-500 text-white text-[10px] sm:text-xs font-semibold px-2 py-1 rounded-full shadow-md flex items-center gap-1">
                        <FaArrowUp className="text-[10px] sm:text-xs" /> Price increased
                      </span>
                    </div>
                  )}
                  {/* Selection Checkbox */}
                  {bulkActionMode && (
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(listing._id)}
                        onChange={() => handleSelectItem(listing._id)}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                  )}

                  {/* Property Content */}
                  <div className={viewMode === 'list' ? 'flex-1' : ''}>
                    <ListingItem listing={listing} onDelete={handleRemove} />
                    {hasChangeInfo && (
                      <div className="mt-2 px-2 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-md text-xs sm:text-sm flex flex-wrap items-center gap-3 transition-colors">
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                          <FaCalendarAlt className="text-gray-500" />
                          <span>Added: {stats.addedAt ? new Date(stats.addedAt).toLocaleDateString() : '-'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                          <FaBookmark className="text-gray-500" />
                          <span>At add: ₹{Number(stats.baseline).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                          <FaEye className="text-gray-500" />
                          <span>Today: ₹{Number(stats.current).toLocaleString('en-IN')}</span>
                        </div>
                        <div className={`flex items-center gap-1 font-semibold ${statusColor}`}>
                          {stats.status === 'dropped' && <FaArrowDown />}
                          {stats.status === 'increased' && <FaArrowUp />}
                          {stats.status === 'neutral' && <FaCheckCircle className="text-gray-500" />}
                          <span>
                            {stats.status === 'dropped' && `Dropped ₹${Math.abs(stats.change).toLocaleString('en-IN')}`}
                            {stats.status === 'increased' && `Increased ₹${Math.abs(stats.change).toLocaleString('en-IN')}`}
                            {stats.status === 'neutral' && 'No change'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Wishlist Icon */}
      <div className="fixed bottom-8 right-8 z-50">
        <button
          onClick={() => window.location.href = '/user/wishlist'}
          className="relative group w-16 h-16 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 flex items-center justify-center bg-gradient-to-r from-pink-500 to-red-500"
          style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
          title="Open Wishlist"
        >
          <span className="w-7 h-7 text-white text-2xl">❤️</span>
          <div className="absolute bottom-full right-0 mb-3 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm px-4 py-2 rounded-xl shadow-2xl hidden group-hover:block z-10 whitespace-nowrap border border-gray-100 dark:border-gray-700 transform -translate-y-1 transition-all duration-200">
            <div className="flex items-center gap-2">
              <span className="text-lg">❤️</span>
              <span className="font-medium">Wishlist</span>
            </div>
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white dark:border-t-gray-800"></div>
          </div>
        </button>
      </div>
      <SocialSharePanel
        isOpen={shareModal.isOpen}
        onClose={() => setShareModal({ ...shareModal, isOpen: false })}
        url={shareModal.url}
        title={shareModal.title}
        description={shareModal.description}
      />
    </div>
  );
}


