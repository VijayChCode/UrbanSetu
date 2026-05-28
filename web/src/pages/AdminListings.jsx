import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEdit, FaTrash, FaEye, FaPlus, FaLock, FaFlag, FaTimes, FaSync, FaChartBar, FaCheckCircle } from "react-icons/fa";
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import { maskAddress } from '../utils/addressMasking';
import { useSelector, useDispatch } from "react-redux";
import { signoutUserStart, signoutUserSuccess, signoutUserFailure } from "../redux/user/userSlice";
import { authenticatedFetch } from "../utils/auth";
import { toast } from 'react-toastify';

import { usePageTitle } from '../hooks/usePageTitle';
import { isMobileDevice } from '../utils/mobileUtils';
import AdminListingsSkeleton from "../components/skeletons/AdminListingsSkeleton";
import UrbanSetuSpinner from "../components/UrbanSetuSpinner";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminListings() {
  // Set page title
  usePageTitle("Property Management - Admin Panel");

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMoreListing, setShowMoreListing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const { currentUser } = useSelector((state) => state.user);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const reasonInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  // Property Reports state
  const [showPropertyReportsModal, setShowPropertyReportsModal] = useState(false);
  const [propertyReports, setPropertyReports] = useState([]);
  const [filteredPropertyReports, setFilteredPropertyReports] = useState([]);
  const [propertyReportsLoading, setPropertyReportsLoading] = useState(false);
  const [propertyReportsError, setPropertyReportsError] = useState('');
  const [propertyReportsFilters, setPropertyReportsFilters] = useState({
    dateFrom: '',
    dateTo: '',
    reporter: '',
    search: '',
    sortBy: 'date',
    sortOrder: 'desc'
  });

  // Stats Modal State
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [listingStats, setListingStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsOwnerFilter, setStatsOwnerFilter] = useState('all'); // 'all', 'sale', 'rent', 'offer'
  const [statsSearch, setStatsSearch] = useState('');

  // Lock body scroll when deletion modals are open on Admin Listings
  useEffect(() => {
    const shouldLock = showReasonModal || showPasswordModal || showPropertyReportsModal || showStatsModal;
    if (shouldLock) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showReasonModal, showPasswordModal, showPropertyReportsModal]);

  // Handle mobile state updates
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Autofocus reason input when modal opens (desktop only)
  useEffect(() => {
    if (showReasonModal && !isMobile && reasonInputRef.current) {
      const timer = setTimeout(() => {
        reasonInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showReasonModal, isMobile]);

  // Autofocus password input when modal opens (desktop only)
  useEffect(() => {
    if (showPasswordModal && !isMobile && passwordInputRef.current) {
      const timer = setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showPasswordModal, isMobile]);

  const [filters, setFilters] = useState({
    searchTerm: '',
    type: 'all',
    offer: 'all',
    furnished: 'all',
    parking: 'all',
    minPrice: '',
    maxPrice: '',
    city: '',
    state: '',
    published: 'all',
    ownerSearch: ''
  });

  const buildParams = (startIndex, limit) => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('startIndex', String(startIndex));
    if (filters.searchTerm) params.set('searchTerm', filters.searchTerm);
    if (filters.type !== 'all') params.set('type', filters.type);
    if (filters.offer !== 'all') params.set('offer', filters.offer);
    if (filters.furnished !== 'all') params.set('furnished', filters.furnished);
    if (filters.parking !== 'all') params.set('parking', filters.parking);
    if (filters.minPrice) params.set('minPrice', filters.minPrice);
    if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
    if (filters.city) params.set('city', filters.city);
    if (filters.state) params.set('state', filters.state);
    if (filters.state) params.set('state', filters.state);
    if (filters.published !== 'all') params.set('published', filters.published);
    if (filters.ownerSearch) params.set('ownerSearch', filters.ownerSearch);
    return params;
  };

  useEffect(() => {
    // Debounce filter fetches to avoid jarring reload on each keystroke
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setFetching(true);
        setError(null);
        const limit = 12;
        const params = buildParams(0, limit);
        const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/get?${params.toString()}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          setListings(data);
          setShowMoreListing(Array.isArray(data) && data.length === limit);
        } else {
          throw new Error("Failed to fetch listings");
        }
      } catch (err) {
        if (err.name !== 'AbortError') setError("Failed to load listings. Please try again.");
      } finally {
        setFetching(false);
        setLoading(false);
      }
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [filters]);

  const handleShowMore = async () => {
    try {
      const limit = 12;
      const params = buildParams(listings.length, limit);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/get?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setListings((prev) => [...prev, ...data]);
      setShowMoreListing(Array.isArray(data) && data.length === limit);
    } catch (_) { }
  };

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
      // Verify password
      const verifyRes = await authenticatedFetch(`${API_BASE_URL}/api/user/verify-password/${currentUser._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (!verifyRes.ok) {
        // Track wrong attempts locally (allow up to 3 attempts before logout)
        const key = 'deleteAdminListingPwAttempts';
        const prev = parseInt(localStorage.getItem(key) || '0');
        const next = prev + 1;
        localStorage.setItem(key, String(next));

        if (next >= 3) {
          // Sign out and redirect on third wrong attempt
          toast.error("Too many incorrect attempts. You've been signed out for security.");
          dispatch(signoutUserStart());
          try {
            const signoutRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/signout`);
            const signoutData = await signoutRes.json();
            if (signoutData.success === false) {
              dispatch(signoutUserFailure(signoutData.message));
            } else {
              dispatch(signoutUserSuccess(signoutData));
            }
          } catch (err) {
            dispatch(signoutUserFailure(err.message));
          }
          localStorage.removeItem(key); // Clear attempts on logout
          setShowPasswordModal(false);
          setTimeout(() => {
            navigate('/sign-in');
          }, 800);
          return;
        }

        const remaining = 3 - next;
        setDeleteError(`Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} left before logout.`);
        setDeleteLoading(false);
        return;
      }

      // Success - Clear attempts
      localStorage.removeItem('deleteAdminListingPwAttempts');

      // Proceed to delete
      const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/delete/${pendingDeleteId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason }),
      });
      if (res.ok) {
        setListings((prev) => prev.filter((listing) => listing._id !== pendingDeleteId));
        setShowPasswordModal(false);
        const data = await res.json();
        toast.success(data.message || "Listing deleted successfully!");
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

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Calculate discount percentage
  const getDiscountPercentage = (listing) => {
    if (listing.offer && listing.regularPrice && listing.discountPrice) {
      return Math.round(((listing.regularPrice - listing.discountPrice) / listing.regularPrice) * 100);
    }
    return 0;
  };

  // Fetch property reports
  const fetchPropertyReports = async () => {
    try {
      setPropertyReportsLoading(true);
      setPropertyReportsError('');

      const params = new URLSearchParams();
      if (propertyReportsFilters.dateFrom) params.append('dateFrom', propertyReportsFilters.dateFrom);
      if (propertyReportsFilters.dateTo) params.append('dateTo', propertyReportsFilters.dateTo);
      if (propertyReportsFilters.reporter) params.append('reporter', propertyReportsFilters.reporter);
      if (propertyReportsFilters.search) params.append('search', propertyReportsFilters.search);
      params.append('sortBy', propertyReportsFilters.sortBy);
      params.append('sortOrder', propertyReportsFilters.sortOrder);

      const res = await authenticatedFetch(`${API_BASE_URL}/api/notifications/reports/properties?${params}`);
      const data = await res.json();

      if (data.success) {
        setPropertyReports(data.reports || []);
      } else {
        setPropertyReportsError(data.message || 'Failed to load property reports');
        console.error('Property Reports API error:', data.message);
      }
    } catch (error) {
      setPropertyReportsError('Network error while loading property reports');
      console.error('Error fetching property reports:', error);
    } finally {
      setPropertyReportsLoading(false);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      // Fetch listings and users in parallel to resolve owner details
      const [listingsRes, usersRes] = await Promise.all([
        authenticatedFetch(`${API_BASE_URL}/api/listing/get?limit=2000`),
        authenticatedFetch(`${API_BASE_URL}/api/admin/management/users`)
      ]);

      if (!listingsRes.ok) throw new Error("Failed to fetch data");
      const data = await listingsRes.json();

      let usersMap = {};
      if (usersRes.ok) {
        try {
          const usersData = await usersRes.json();
          const userList = Array.isArray(usersData) ? usersData : (usersData.users || []);
          userList.forEach(u => {
            if (u._id) usersMap[u._id] = u;
          });
        } catch (e) {
          console.error("Failed to parse users data", e);
        }
      }

      // Aggregate Data
      const total = data.length;
      const sale = data.filter(l => l.type === 'sale').length;
      const rent = data.filter(l => l.type === 'rent').length;
      const offer = data.filter(l => l.offer).length;

      // Top Owners
      const ownerMap = {};
      data.forEach(l => {
        const ownerId = (l.userRef && (l.userRef._id || l.userRef)) || 'Unknown';

        // Try to get details from User Map first (source of truth), then Listing ref
        const userFromMap = usersMap[ownerId];

        const username = userFromMap?.username || (l.userRef && l.userRef.username) || '';
        const name = userFromMap?.name || (l.userRef && l.userRef.name) || ''; // Assuming 'name' field exists or combining firstName/lastName if available
        const email = userFromMap?.email || (l.userRef && l.userRef.email) || '';

        let displayName = 'Unknown Owner';
        if (username) displayName = username;
        else if (name) displayName = name;
        else if (email) displayName = email.split('@')[0];

        if (!ownerMap[ownerId]) {
          ownerMap[ownerId] = {
            id: ownerId,
            name: displayName,
            email: email,
            count: 0,
            sale: 0,
            rent: 0,
            offer: 0
          };
        }

        ownerMap[ownerId].count++;
        if (l.type === 'sale') ownerMap[ownerId].sale++;
        if (l.type === 'rent') ownerMap[ownerId].rent++;
        if (l.offer) ownerMap[ownerId].offer++;

        // Update with better Details if initially unknown but found later
        if (displayName !== 'Unknown Owner' && ownerMap[ownerId].name === 'Unknown Owner') {
          ownerMap[ownerId].name = displayName;
          ownerMap[ownerId].email = email;
        }
      });

      const topOwners = Object.values(ownerMap)
        // Helper to sort dynamically would be done in render, but here we can send full list
        .sort((a, b) => b.count - a.count); // Default sort by total
      // We'll slice in render to allow re-sorting


      setListingStats({ total, sale, rent, offer, topOwners });
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("Failed to load statistics");
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch property reports only when modal opens
  useEffect(() => {
    if (showPropertyReportsModal) {
      fetchPropertyReports();
    }
  }, [showPropertyReportsModal]);

  // Client-side filtering for immediate UI updates
  useEffect(() => {
    if (propertyReports.length === 0) {
      setFilteredPropertyReports([]);
      return;
    }

    let filtered = [...propertyReports];

    // Apply search filter
    if (propertyReportsFilters.search) {
      const searchTerm = propertyReportsFilters.search.toLowerCase();
      filtered = filtered.filter(report =>
        report.propertyName?.toLowerCase().includes(searchTerm) ||
        report.reporter?.toLowerCase().includes(searchTerm) ||
        report.reporterEmail?.toLowerCase().includes(searchTerm) ||
        report.reporterPhone?.toLowerCase().includes(searchTerm) ||
        report.category?.toLowerCase().includes(searchTerm) ||
        report.details?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply reporter filter
    if (propertyReportsFilters.reporter) {
      const reporterTerm = propertyReportsFilters.reporter.toLowerCase();
      filtered = filtered.filter(report =>
        report.reporter?.toLowerCase().includes(reporterTerm)
      );
    }

    // Apply date filters
    if (propertyReportsFilters.dateFrom) {
      const fromDate = new Date(propertyReportsFilters.dateFrom);
      filtered = filtered.filter(report =>
        new Date(report.createdAt) >= fromDate
      );
    }

    if (propertyReportsFilters.dateTo) {
      const toDate = new Date(propertyReportsFilters.dateTo);
      toDate.setHours(23, 59, 59, 999); // Include entire day
      filtered = filtered.filter(report =>
        new Date(report.createdAt) <= toDate
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (propertyReportsFilters.sortBy) {
        case 'reporter':
          aValue = a.reporter || '';
          bValue = b.reporter || '';
          break;
        case 'property':
          aValue = a.propertyName || '';
          bValue = b.propertyName || '';
          break;
        case 'category':
          aValue = a.category || '';
          bValue = b.category || '';
          break;
        case 'date':
        default:
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
      }

      if (propertyReportsFilters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredPropertyReports(filtered);
  }, [propertyReports, propertyReportsFilters]);

  if (loading) {
    return <AdminListingsSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 py-10 px-2 md:px-8">
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg p-6">
          <div className="text-center text-red-600 text-lg">{error}</div>
        </div>
      </div>
    );
  }

  const isFilterActive = 
    !!(filters.searchTerm ||
    filters.type !== 'all' ||
    filters.offer !== 'all' ||
    filters.furnished !== 'all' ||
    filters.parking !== 'all' ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.city ||
    filters.state ||
    filters.published !== 'all' ||
    filters.ownerSearch);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-950 py-10 px-2 md:px-8 transition-colors duration-300">
        <div className="max-w-6xl w-full mx-auto px-2 sm:px-4 md:px-8 py-8 overflow-x-hidden">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 transition-colors duration-300">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-blue-700 dark:text-blue-400 drop-shadow">All Listings (Admin)</h3>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2 mt-4 md:mt-0">
                <Link
                  to="/admin/deleted-listings"
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition shadow text-sm sm:text-base"
                  title="View Deleted Listings"
                >
                  <FaTrash />
                  <span className="hidden sm:inline">Deleted</span>
                </Link>
                <button
                  onClick={() => {
                    setShowPropertyReportsModal(true);
                    fetchPropertyReports();
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 transition shadow text-sm sm:text-base"
                  title="View Property Reports"
                >
                  <FaFlag />
                  <span className="hidden sm:inline">Reports</span>
                </button>
                <button
                  onClick={() => {
                    setShowStatsModal(true);
                    fetchStats();
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 transition shadow text-sm sm:text-base"
                  title="View Statistics"
                >
                  <FaChartBar />
                  <span className="hidden sm:inline">Stats</span>
                </button>
                <Link
                  to="/admin/create-listing"
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-1 sm:gap-2 text-sm sm:text-base w-full sm:w-auto justify-center"
                >
                  <FaPlus /> <span>Create New Listing</span>
                </Link>
              </div>
            </div>

            {/* Filters */}
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input type="text" value={filters.searchTerm} onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })} className="border dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Search by name/address/city/state" />
              <select className="border dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
                <option value="all">All Types</option>
                <option value="sale">Sale</option>
                <option value="rent">Rent</option>
              </select>
              <select className="border dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={filters.offer} onChange={(e) => setFilters({ ...filters, offer: e.target.value })}>
                <option value="all">Offer: Any</option>
                <option value="true">Offer: Yes</option>
                <option value="false">Offer: No</option>
              </select>
              <select className="border dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={filters.published} onChange={(e) => setFilters({ ...filters, published: e.target.value })}>
                <option value="all">Status: Any</option>
                <option value="true">Verified (Published)</option>
                <option value="false">Pending (Unpublished)</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select className="border dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={filters.furnished} onChange={(e) => setFilters({ ...filters, furnished: e.target.value })}>
                  <option value="all">Furnished: Any</option>
                  <option value="true">Furnished</option>
                  <option value="false">Unfurnished</option>
                </select>
                <select className="border dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={filters.parking} onChange={(e) => setFilters({ ...filters, parking: e.target.value })}>
                  <option value="all">Parking: Any</option>
                  <option value="true">With Parking</option>
                  <option value="false">No Parking</option>
                </select>
              </div>
              <input type="number" min="0" value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} className="border dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Min Price" />
              <input type="number" min="0" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} className="border dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Max Price" />
              <input type="text" value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} className="border dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="City" />
              <input type="text" value={filters.state} onChange={(e) => setFilters({ ...filters, state: e.target.value })} className="border dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="State" />
              <input type="text" value={filters.ownerSearch} onChange={(e) => setFilters({ ...filters, ownerSearch: e.target.value })} className="border dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Filter Properties by Owner..." />
            </div>

            {listings.length === 0 ? (
              isFilterActive ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 dark:text-gray-500 text-6xl mb-4">🔍</div>
                  <h4 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No matching properties found</h4>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">Try resetting your filters or adjusting your search term.</p>
                  <button
                    onClick={() => setFilters({
                      searchTerm: '',
                      type: 'all',
                      offer: 'all',
                      furnished: 'all',
                      parking: 'all',
                      minPrice: '',
                      maxPrice: '',
                      city: '',
                      state: '',
                      published: 'all',
                      ownerSearch: ''
                    })}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 font-semibold shadow-md transition-all hover:scale-105 active:scale-95"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">🏠</div>
                  <h4 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No listings yet</h4>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">Start by creating your first property listing</p>
                  <Link
                    to="/admin/create-listing"
                    className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold inline-flex items-center gap-1 sm:gap-2 text-sm sm:text-base w-full sm:w-auto justify-center"
                  >
                    <FaPlus /> <span>Create Your First Listing</span>
                  </Link>
                </div>
              )
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                  {listings.map((listing) => (
                    <div key={listing._id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                      {/* Image */}
                      <div className="relative h-48 bg-gray-200 dark:bg-gray-700 rounded-t-lg overflow-hidden">
                        {listing.imageUrls && listing.imageUrls.length > 0 && listing.imageUrls[0] ? (
                          <img
                            src={listing.imageUrls[0]}
                            alt={listing.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentNode.querySelector('.no-image-placeholder').style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className={`no-image-placeholder absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900/40 ${listing.imageUrls && listing.imageUrls[0] ? 'hidden' : 'flex'}`}>
                          <div className="text-4xl opacity-80">🏠</div>
                          <span className="text-xs font-bold uppercase tracking-widest text-center opacity-70">No Image Available</span>
                        </div>

                        {/* Offer Badge */}
                        {listing.offer && getDiscountPercentage(listing) > 0 && (
                          <div className="absolute top-2 left-2 z-20">
                            <span
                              className="bg-yellow-400 text-gray-900 text-xs font-semibold px-2 py-1 rounded-full shadow-md animate-pulse"
                              title="Limited-time offer!"
                            >
                              {getDiscountPercentage(listing)}% OFF
                            </span>
                          </div>
                        )}

                        <div className="absolute top-2 right-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${listing.type === 'sale'
                            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                            : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                            }`}>
                            {listing.type === 'sale' ? 'For Sale' : 'For Rent'}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4">
                        <h4 className="font-semibold text-lg text-gray-800 dark:text-white mb-2 truncate">{listing.name}</h4>

                        {/* Verification Status Badge */}
                        <div className="mb-2">
                          {listing.isVerified ? (
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded text-xs font-semibold flex items-center gap-1 w-fit">
                              <FaCheckCircle className="text-xs" /> Verified
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 rounded text-xs font-semibold flex items-center gap-1 w-fit">
                              ⚠️ Not Verified
                            </span>
                          )}
                        </div>

                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2 truncate">
                          {maskAddress(
                            // Create address object if structured fields exist, otherwise use legacy address
                            listing.propertyNumber || listing.city ? {
                              propertyNumber: listing.propertyNumber,
                              landmark: listing.landmark,
                              city: listing.city,
                              district: listing.district,
                              state: listing.state,
                              pincode: listing.pincode
                            } : listing.address,
                            true
                          )}
                        </p>

                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                          <span>{listing.bedrooms} bed</span>
                          <span>{listing.bathrooms} bath</span>
                          {listing.parking && <span>Parking</span>}
                          {listing.furnished && <span>Furnished</span>}
                        </div>

                        <div className="flex items-center justify-between mb-4">
                          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {listing.offer && getDiscountPercentage(listing) > 0 ? (
                              <div className="flex items-center gap-2">
                                <span>{formatPrice(listing.discountPrice)}</span>
                                <span className="text-sm text-gray-500 dark:text-gray-500 line-through">
                                  {formatPrice(listing.regularPrice)}
                                </span>
                              </div>
                            ) : (
                              <span>
                                {formatPrice(listing.regularPrice)}
                                {listing.type === 'rent' && <span className="text-sm text-gray-500 dark:text-gray-400">/month</span>}
                              </span>
                            )}
                          </div>
                          {listing.offer && getDiscountPercentage(listing) > 0 && (
                            <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                              Save {formatPrice(listing.regularPrice - listing.discountPrice)}
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Link
                            to={`/admin/listing/${listing._id}`}
                            className="flex-1 bg-blue-500 text-white px-3 py-2 rounded text-sm font-medium hover:bg-blue-600 transition flex items-center justify-center gap-1"
                          >
                            <FaEye /> View
                          </Link>
                          <Link
                            to={`/admin/update-listing/${listing._id}`}
                            className="flex-1 bg-yellow-500 text-white px-3 py-2 rounded text-sm font-medium hover:bg-yellow-600 transition flex items-center justify-center gap-1"
                          >
                            <FaEdit /> Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(listing._id)}
                            className="flex-1 bg-red-500 text-white px-3 py-2 rounded text-sm font-medium hover:bg-red-600 transition flex items-center justify-center gap-1"
                          >
                            <FaTrash /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {fetching && (
                  <div className="flex justify-center mt-4 text-sm text-gray-500">Updating results…</div>
                )}
                {showMoreListing && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={handleShowMore}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      Show more
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <ContactSupportWrapper />
      {/* Reason Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm z-50">
          <form onSubmit={handleReasonSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-xs flex flex-col gap-4">
            <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2"><FaTrash /> Reason for Deletion</h3>
            <textarea
              ref={reasonInputRef}
              className="border dark:border-gray-700 rounded p-2 w-full bg-white dark:bg-gray-700 dark:text-white"
              placeholder="Enter reason for deleting this property"
              value={deleteReason}
              onChange={e => setDeleteReason(e.target.value)}
              rows={3}
            />
            {deleteError && <div className="text-red-600 dark:text-red-400 text-sm">{deleteError}</div>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowReasonModal(false)} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded bg-red-600 text-white font-semibold">Next</button>
            </div>
          </form>
        </div>
      )}
      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm z-50">
          <form onSubmit={handlePasswordSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-xs flex flex-col gap-4">
            <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2"><FaLock /> Confirm Password</h3>
            <input
              ref={passwordInputRef}
              type="password"
              className="border dark:border-gray-700 rounded p-2 w-full bg-white dark:bg-gray-700 dark:text-white"
              placeholder="Enter your password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
            />
            {deleteError && <div className="text-red-600 dark:text-red-400 text-sm">{deleteError}</div>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowPasswordModal(false)} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded bg-blue-700 text-white font-semibold" disabled={deleteLoading}>{deleteLoading ? 'Deleting...' : 'Confirm & Delete'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Property Reports Modal */}
      {showPropertyReportsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transition-colors duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/10 dark:to-pink-900/10">
              <h2 className="text-xl sm:text-2xl font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                <FaFlag />
                Property Reports
              </h2>
              <button
                onClick={() => setShowPropertyReportsModal(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-2 transition-colors"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            {/* Filters */}
            <div className="p-2 sm:p-4 lg:p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From Date</label>
                    <input
                      type="date"
                      max={new Date().toISOString().split('T')[0]}
                      value={propertyReportsFilters.dateFrom}
                      onChange={(e) => setPropertyReportsFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      className="w-full p-1.5 sm:p-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To Date</label>
                    <input
                      type="date"
                      max={new Date().toISOString().split('T')[0]}
                      value={propertyReportsFilters.dateTo}
                      onChange={(e) => setPropertyReportsFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      className="w-full p-1.5 sm:p-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reporter</label>
                    <input
                      type="text"
                      placeholder="Reporter"
                      value={propertyReportsFilters.reporter}
                      onChange={(e) => setPropertyReportsFilters(prev => ({ ...prev, reporter: e.target.value }))}
                      className="w-full p-1.5 sm:p-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
                    <input
                      type="text"
                      placeholder="Search..."
                      value={propertyReportsFilters.search}
                      onChange={(e) => setPropertyReportsFilters(prev => ({ ...prev, search: e.target.value }))}
                      className="w-full p-1.5 sm:p-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-stretch sm:items-center justify-between">
                  <div className="flex gap-2">
                    <select
                      value={propertyReportsFilters.sortBy}
                      onChange={(e) => setPropertyReportsFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                      className="flex-1 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="date">Date</option>
                      <option value="reporter">Reporter</option>
                      <option value="property">Property</option>
                      <option value="category">Category</option>
                    </select>
                    <select
                      value={propertyReportsFilters.sortOrder}
                      onChange={(e) => setPropertyReportsFilters(prev => ({ ...prev, sortOrder: e.target.value }))}
                      className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="desc">↓</option>
                      <option value="asc">↑</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setPropertyReportsFilters({
                          dateFrom: '',
                          dateTo: '',
                          reporter: '',
                          search: '',
                          sortBy: 'date',
                          sortOrder: 'desc'
                        });
                      }}
                      className="px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                    >
                      Clear
                    </button>
                    <button
                      onClick={fetchPropertyReports}
                      disabled={propertyReportsLoading}
                      className="px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 sm:gap-2"
                    >
                      {propertyReportsLoading ? (
                        <div className="flex items-center gap-2">
                          <UrbanSetuSpinner size="sm" isBright={true} />
                          <span className="hidden sm:inline">Loading...</span>
                        </div>
                      ) : (
                        <>
                          <FaSync className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">Refresh</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 sm:p-4 lg:p-6 min-h-0 bg-white dark:bg-gray-800 transition-colors duration-300">
              {propertyReportsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <UrbanSetuSpinner size="md" />
                  <span className="ml-2 text-gray-600 dark:text-gray-400">Loading property reports...</span>
                </div>
              ) : propertyReportsError ? (
                <div className="text-center py-20 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/30">
                  <p className="text-red-600 dark:text-red-400 font-medium mb-4">{propertyReportsError}</p>
                  <button
                    onClick={fetchPropertyReports}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                  >
                    Try Again
                  </button>
                </div>
              ) : filteredPropertyReports.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                  <FaFlag className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium text-lg">No property reports found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Showing {filteredPropertyReports.length} of {propertyReports.length} reports
                  </div>
                  {filteredPropertyReports.map((report, index) => (
                    <div key={report.notificationId || index} className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 shadow-sm hover:shadow-md transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300">
                              <FaFlag className="mr-1" />
                              Property Report
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(report.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300">Property: </span>
                              <span className="text-gray-900 dark:text-white font-semibold">{report.propertyName}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Reporter: </span>
                                <span className="text-gray-900 dark:text-white">{report.reporter || 'Unknown'}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Email: </span>
                                <span className="text-gray-900 dark:text-white">{report.reporterEmail || 'N/A'}</span>
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">Category: </span>
                              <span className="text-gray-900 dark:text-white text-sm">{report.category}</span>
                            </div>
                            {report.details && (
                              <div className="mt-2 bg-gray-50 dark:bg-gray-800 p-2 rounded border-l-4 border-red-500">
                                <span className="font-medium text-gray-700 dark:text-gray-300 text-sm block mb-1">Details:</span>
                                <span className="text-gray-900 dark:text-white text-sm whitespace-pre-wrap">{report.details}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 self-start">
                          {report.listingId && (
                            <Link
                              to={`/admin/listing/${report.listingId}`}
                              className="px-3 py-1.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 transition text-center font-semibold"
                              onClick={() => setShowPropertyReportsModal(false)}
                            >
                              View Property
                            </Link>
                          )}
                          <a
                            href={report.reporterEmail ? `mailto:${report.reporterEmail}` : '#'}
                            className={`px-3 py-1.5 text-xs rounded transition text-center font-semibold ${report.reporterEmail
                              ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                              }`}
                          >
                            Email Reporter
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900/80 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
              <p>UrbanSetu Moderation Tools</p>
              <p>{filteredPropertyReports.length} Reports Found</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {showStatsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col transition-colors duration-300 transform scale-100 animate-scaleIn">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <FaChartBar className="text-purple-600" />
                Listing Statistics
              </h2>
              <button
                onClick={() => setShowStatsModal(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-2 transition-colors"
              >
                <FaTimes />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[75vh]">
              {statsLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <UrbanSetuSpinner size="md" />
                  <p className="mt-4 text-gray-500 dark:text-gray-400">Loading statistics...</p>
                </div>
              ) : listingStats ? (
                <div className="space-y-8">
                  {/* Overview Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-center border border-blue-100 dark:border-blue-800">
                      <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Total Listings</p>
                      <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{listingStats.total}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl text-center border border-green-100 dark:border-green-800">
                      <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">For Sale</p>
                      <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">{listingStats.sale}</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl text-center border border-orange-100 dark:border-orange-800">
                      <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">For Rent</p>
                      <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-1">{listingStats.rent}</p>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl text-center border border-yellow-100 dark:border-yellow-800">
                      <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Active Offers</p>
                      <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{listingStats.offer}</p>
                    </div>
                  </div>

                  {/* Top Owners Section */}
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                        <FaFlag className="text-purple-500" /> Top Listing Owners
                      </h3>

                      <div className="flex flex-col sm:flex-row gap-3">
                        {/* Search Box */}
                        <input
                          type="text"
                          placeholder="Search By Owner Name..."
                          value={statsSearch}
                          onChange={(e) => setStatsSearch(e.target.value)}
                          className="px-3 py-1.5 text-sm border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />

                        {/* Inner Filters */}
                        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg self-start sm:self-auto">
                          {['all', 'sale', 'rent', 'offer'].map((filter) => (
                            <button
                              key={filter}
                              onClick={() => setStatsOwnerFilter(filter)}
                              className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all ${statsOwnerFilter === filter
                                ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-300 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                            >
                              {filter.charAt(0).toUpperCase() + filter.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                              <th className="px-6 py-4 font-semibold">Owner Name & Email</th>
                              <th className="px-6 py-4 font-semibold text-right">
                                {statsOwnerFilter === 'all' ? 'Total Listings' :
                                  statsOwnerFilter === 'sale' ? 'For Sale' :
                                    statsOwnerFilter === 'rent' ? 'For Rent' : 'With Offers'}
                              </th>
                              {statsOwnerFilter === 'all' && <th className="px-6 py-4 font-semibold text-right hidden sm:table-cell">Breakdown</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {listingStats.topOwners
                              .filter(o => {
                                const matchesSearch = o.name.toLowerCase().includes(statsSearch.toLowerCase()) ||
                                  (o.email && o.email.toLowerCase().includes(statsSearch.toLowerCase()));
                                const matchesFilter = statsOwnerFilter === 'all' || o[statsOwnerFilter] > 0;
                                return matchesSearch && matchesFilter;
                              })
                              .sort((a, b) => {
                                const key = statsOwnerFilter === 'all' ? 'count' : statsOwnerFilter;
                                return b[key] - a[key];
                              })
                              .slice(0, 10)
                              .map((owner, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                  <td className="px-6 py-4 text-gray-800 dark:text-gray-200">
                                    <div className="flex items-center gap-3">
                                      <span className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white ${idx < 3 ? 'bg-gradient-to-r from-yellow-400 to-orange-500 shadow-sm' : 'bg-gray-400'}`}>
                                        {idx + 1}
                                      </span>
                                      <div className="flex flex-col min-w-0">
                                        <span className="font-medium text-sm truncate" title={owner.name}>{owner.name}</span>
                                        {owner.email && <span className="text-xs text-gray-500 dark:text-gray-400 truncate" title={owner.email}>{owner.email}</span>}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-right font-bold text-purple-600 dark:text-purple-400">
                                    {statsOwnerFilter === 'all' ? owner.count : owner[statsOwnerFilter]}
                                  </td>
                                  {statsOwnerFilter === 'all' && (
                                    <td className="px-6 py-4 text-right hidden sm:table-cell">
                                      <div className="flex items-center justify-end gap-2 text-xs">
                                        <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded" title="For Sale">{owner.sale} S</span>
                                        <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded" title="For Rent">{owner.rent} R</span>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            {listingStats.topOwners.filter(o => {
                              const matchesSearch = o.name.toLowerCase().includes(statsSearch.toLowerCase()) ||
                                (o.email && o.email.toLowerCase().includes(statsSearch.toLowerCase()));
                              const matchesFilter = statsOwnerFilter === 'all' || o[statsOwnerFilter] > 0;
                              return matchesSearch && matchesFilter;
                            }).length === 0 && (
                                <tr>
                                  <td colSpan="3" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                    No owners found matching this filter
                                  </td>
                                </tr>
                              )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-red-500 py-10">Failed to load statistics.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
