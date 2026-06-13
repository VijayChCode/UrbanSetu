import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import AdminBlogsSkeleton from '../components/skeletons/AdminBlogsSkeleton';
import {
  Plus, Edit, Trash, Search, Filter, Globe, Home, Eye, EyeOff,
  ExternalLink, ChevronLeft, ChevronRight, FileText, LayoutTemplate,
  CheckCircle, RefreshCw, XCircle, Ban, UserX, Clock
} from 'lucide-react';
import BlogEditModal from '../components/BlogEditModal';
import BlogAnalytics from '../components/BlogAnalytics';
import ConfirmationModal from '../components/ConfirmationModal';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import { usePageTitle } from '../hooks/usePageTitle';
import { authenticatedFetch } from '../utils/auth';
import AdvancedImage from '../components/AdvancedImage';

const AdminBlogs = ({ type }) => {
  // Set page title
  usePageTitle(`${type === 'guide' ? 'Guides' : 'Blogs'} - Admin Panel`);
  const { currentUser } = useSelector((state) => state.user);

  const navigate = useNavigate();
  const [blogs, setBlogs] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('blogs'); // blogs, subscribers
  const [subscribers, setSubscribers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingBlog, setEditingBlog] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPropertyScope, setFilterPropertyScope] = useState('all'); // Renamed from filterType
  const [filterPostType, setFilterPostType] = useState(type || 'all'); // New filter for Blog vs Guide

  const isGuide = filterPostType === 'guide';
  const contentLabel = isGuide ? 'Guide' : 'Blog';
  const contentLabelPlural = isGuide ? 'Guides' : 'Blogs';
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // all, published, draft
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Delete Confirmation State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [blogToDelete, setBlogToDelete] = useState(null);

  // Status Confirmation State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [blogToToggle, setBlogToToggle] = useState(null);
  const [statusActionLoading, setStatusActionLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    excerpt: '',
    thumbnail: '',
    imageUrls: [],
    videoUrls: [],
    propertyId: '',
    tags: [],
    category: 'Real Estate Tips',
    published: false,
    scheduledAt: null
  });

  const [propertySearch, setPropertySearch] = useState('');

  const [subToProcess, setSubToProcess] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [statusReason, setStatusReason] = useState('');

  // Subscriber Filters
  const [subscriberSearchTerm, setSubscriberSearchTerm] = useState('');
  const [subscriberFilterStatus, setSubscriberFilterStatus] = useState('all'); // all, pending, approved, rejected, revoked, opted_out
  const [subscriberFilterType, setSubscriberFilterType] = useState('blog'); // Default to 'blog' or match page type initially

  // Subscriber Pagination
  const [currentSubscriberPage, setCurrentSubscriberPage] = useState(1);
  const subscribersPerPage = 10;

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://urbansetu-pvt4.onrender.com';

  // Separate useEffect for initial load and static data
  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [filterPostType]);

  useEffect(() => {
    if (type) {
      setFilterPostType(type);
    }
  }, [type]);

  useEffect(() => {
    if (activeTab === 'subscribers') {
      fetchSubscribers();
    }
  }, [activeTab]);

  useEffect(() => {
    if (type) setFilterPostType(type);
  }, [type]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim().length > 0) {
        fetchSuggestions();
      } else {
        setSuggestions([]);
      }

      if (pagination.current === 1) {
        fetchBlogs(false);
      } else {
        setPagination(prev => ({ ...prev, current: 1 }));
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.search-container')) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Immediate filter effects
  useEffect(() => {
    if (pagination.current === 1) {
      fetchBlogs(false);
    } else {
      setPagination(prev => ({ ...prev, current: 1 }));
    }
  }, [filterPropertyScope, filterPostType, filterCategory, filterStatus]);

  // Pagination effect
  useEffect(() => {
    fetchBlogs();
  }, [pagination.current]);

  // Immediate filter effects
  useEffect(() => {
    // When page type changes (e.g. from blog to guide), Force the subscriber filter to match
    // This ensures Admin Blogs shows only Blog subscribers by default, and Admin Guides shows Guide subscribers.
    setSubscriberFilterType(filterPostType === 'guide' ? 'guide' : 'blog');

    if (pagination.current === 1) {
      fetchBlogs(false);
    } else {
      setPagination(prev => ({ ...prev, current: 1 }));
    }
  }, [filterPropertyScope, filterPostType, filterCategory, filterStatus]);

  const fetchBlogs = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const params = new URLSearchParams({
        page: pagination.current,
        limit: 10
      });

      if (searchTerm) params.append('search', searchTerm);
      if (filterPropertyScope === 'global') params.append('propertyId', 'null');
      if (filterPropertyScope === 'property') params.append('propertyId', 'exists');
      if (filterPostType !== 'all') params.append('type', filterPostType);
      if (filterCategory !== 'all') params.append('category', filterCategory);
      if (filterStatus === 'published') params.append('published', 'true');
      if (filterStatus === 'draft') params.append('published', 'false');
      if (filterStatus === 'all') params.append('published', 'all');

      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs?${params}`);

      if (response.ok) {
        const data = await response.json();
        setBlogs(data.data);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error fetching blogs:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchSubscribers = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`${API_BASE_URL}/api/subscription/all`);
      if (response.ok) {
        const data = await response.json();
        // Filter out subscriptions that are still in OTP verification (status: 'verifying')
        const validSubscribers = (data.data || []).filter(sub => sub.status !== 'verifying');
        setSubscribers(validSubscribers);
      }
    } catch (error) {
      console.error('Error fetching subscribers:', error);
      toast.error('Failed to fetch subscribers');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const params = new URLSearchParams({
        published: 'all', // Admin should see all
        search: searchTerm,
        limit: 5
      });

      if (filterPostType !== 'all') params.append('type', filterPostType);

      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs?${params}`);

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.data);
      }
    } catch (error) {
      console.error('Error fetching blog suggestions:', error);
    }
  };

  const handleUpdateSubscription = async (id, status, reason = null) => {
    try {
      const BASE_URL = import.meta.env.VITE_API_BASE_URL || API_BASE_URL;
      // Use the CURRENT PAGE CONTEXT (filterPostType) to decide what to revoke/approve.
      // This solves the issue of "which one am I revoking?"
      // If I am on Admin Blogs page (filterPostType='blog'), I act on BLOG preference.
      // If I am on Admin Guides page (filterPostType='guide'), I act on GUIDE preference.
      const type = filterPostType === 'guide' ? 'guide' : 'blog';

      const response = await authenticatedFetch(`${BASE_URL}/api/subscription/status/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason, type })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        fetchSubscribers();
        setShowRejectModal(false);
        setShowRevokeModal(false);
        setSubToProcess(null);
        setStatusReason('');
      } else {
        toast.error(data.message || 'Failed to update status');
      }
    } catch (error) {
      toast.error('Error updating status');
    }
  };

  const openApproveModal = (sub) => {
    setSubToProcess(sub);
    setShowApproveModal(true);
  };

  const openRejectModal = (sub) => {
    setSubToProcess(sub);
    setStatusReason('');
    setShowRejectModal(true);
  };

  const openRevokeModal = (sub) => {
    setSubToProcess(sub);
    setStatusReason('');
    setShowRevokeModal(true);
  };

  const fetchProperties = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/listing/get?limit=1000&type=all&offer=false&furnished=false&parking=false`);
      if (response.ok) {
        const data = await response.json();
        setProperties(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const typeParam = filterPostType !== 'all' ? `?type=${filterPostType}` : '';
      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs/categories${typeParam}`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleCreate = () => {
    setEditingBlog(null);
    setFormData({
      title: '',
      content: '',
      excerpt: '',
      thumbnail: '',
      imageUrls: [],
      videoUrls: [],
      propertyId: '',
      tags: [],
      category: (filterPostType === 'guide' ? 'Home Buying' : 'Real Estate Tips'),
      type: filterPostType !== 'all' ? filterPostType : 'blog',
      featured: false,
      published: false,
      scheduledAt: null
    });
    setShowModal(true);
  };

  const handleEdit = (blog) => {
    setEditingBlog(blog);
    setFormData({
      title: blog.title,
      content: blog.content,
      excerpt: blog.excerpt,
      thumbnail: blog.thumbnail,
      imageUrls: blog.imageUrls || [],
      videoUrls: blog.videoUrls || [],
      propertyId: blog.propertyId?._id || '',
      tags: blog.tags || [],
      category: blog.category,
      type: blog.type || 'blog',
      featured: blog.featured || false,
      published: blog.published,
      scheduledAt: blog.scheduledAt
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingBlog
        ? `${API_BASE_URL}/api/blogs/${editingBlog._id}`
        : `${API_BASE_URL}/api/blogs`;

      const method = editingBlog ? 'PUT' : 'POST';

      const response = await authenticatedFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          propertyId: formData.propertyId || null
        })
      });

      if (response.ok) {
        toast.success(editingBlog ? `${contentLabel} updated successfully!` : `${contentLabel} created successfully!`);
        setShowModal(false);
        fetchBlogs();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || `Failed to save ${contentLabel.toLowerCase()}`);
      }
    } catch (error) {
      console.error(`Error saving ${contentLabel.toLowerCase()}:`, error);
      toast.error(`Failed to save ${contentLabel.toLowerCase()}. Please try again.`);
    }
  };

  const handleDelete = (id) => {
    setBlogToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!blogToDelete) return;
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs/${blogToDelete}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success(`${contentLabel} deleted successfully`);
        fetchBlogs();
        setShowDeleteModal(false);
        setBlogToDelete(null);
      } else {
        toast.error(`Failed to delete ${contentLabel.toLowerCase()}`);
      }
    } catch (error) {
      console.error(`Error deleting ${contentLabel.toLowerCase()}:`, error);
      toast.error(`Failed to delete ${contentLabel.toLowerCase()}`);
    }
  };

  const handleViewDetails = (blog) => {
    const slug = blog.slug || blog._id;
    const typePath = blog.type === 'guide' ? 'guide' : 'blog';
    window.open(`/admin/${typePath}/${slug}`, '_blank');
  };

  const togglePublish = (blog) => {
    setBlogToToggle(blog);
    setShowStatusModal(true);
  };

  const updateBlogStatus = async (blogId, updates) => {
    try {
      setStatusActionLoading(true);
      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs/${blogId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        toast.success(`${contentLabel} status updated successfully`);
        fetchBlogs();
        setShowStatusModal(false);
        setBlogToToggle(null);
      } else {
        toast.error(`Failed to update ${contentLabel.toLowerCase()} status`);
      }
    } catch (error) {
      console.error(`Error updating ${contentLabel.toLowerCase()} status:`, error);
      toast.error(`Failed to update ${contentLabel.toLowerCase()} status`);
    } finally {
      setStatusActionLoading(false);
    }
  };

  const getFilteredSubscribers = () => {
    return subscribers.filter(sub => {
      if (subscriberSearchTerm && !sub.email.toLowerCase().includes(subscriberSearchTerm.toLowerCase())) {
        return false;
      }
      if (subscriberFilterStatus !== 'all') {
        const isBlog = subscriberFilterType === 'blog';
        const isGuide = subscriberFilterType === 'guide';

        const activePref = isBlog ? sub.preferences?.blog : (isGuide ? sub.preferences?.guide : null);
        const pendingPref = isBlog ? sub.pendingPreferences?.blog : (isGuide ? sub.pendingPreferences?.guide : null);

        let effectiveStatus = sub.status;
        if (activePref && sub.status === 'approved') effectiveStatus = 'approved';
        else if (pendingPref || (activePref && sub.status === 'pending')) effectiveStatus = 'pending';

        if (effectiveStatus !== subscriberFilterStatus) return false;
      }
      // Filter by context/type (Blog vs Guide)
      // Show user if:
      // 1. They have the Active Preference for this type
      // 2. They have a Pending Preference for this type (waiting approval)
      // 3. Their original Source matches this type (helpful for Revoked/Opted-out users where prefs are cleared)
      if (subscriberFilterType !== 'all') {
        const isBlog = subscriberFilterType === 'blog';
        const isGuide = subscriberFilterType === 'guide';

        const hasActive = isBlog ? sub.preferences?.blog : sub.preferences?.guide;
        const hasPending = isBlog ? sub.pendingPreferences?.blog : sub.pendingPreferences?.guide;

        // Check source as fallback for users with no active flags (e.g. wiped by revocation)
        const matchesSource = isBlog ? sub.source === 'blogs_page' : sub.source === 'guides_page';

        // Strict: Must have SOME link to this type to show up
        if (!hasActive && !hasPending && !matchesSource) return false;
      }
      return true;
    });
  };

  const filteredSubscribers = getFilteredSubscribers();
  const totalSubscriberPages = Math.ceil(filteredSubscribers.length / subscribersPerPage) || 1;
  const paginatedSubscribers = filteredSubscribers.slice(
    (currentSubscriberPage - 1) * subscribersPerPage,
    currentSubscriberPage * subscribersPerPage
  );

  useEffect(() => {
    setCurrentSubscriberPage(1);
  }, [subscriberSearchTerm, subscriberFilterStatus, subscriberFilterType]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col font-sans text-slate-800 dark:text-gray-100 transition-colors duration-300">

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 dark:from-slate-800 dark:via-indigo-950 dark:to-purple-950 pb-20 pt-10 px-4 shadow-xl relative overflow-hidden transition-all">
        {/* Abstract shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
          <div className="absolute top-[-50%] left-[-10%] w-[500px] h-[500px] rounded-full bg-white mix-blend-overlay filter blur-3xl animate-float"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-300 mix-blend-overlay filter blur-3xl animate-float" style={{ animationDelay: "2s" }}></div>
        </div>

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center relative z-10 animate-slideInFromTop">
          <div className="mb-6 md:mb-0 text-center md:text-left">
            <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-2 tracking-tight">
              {contentLabel} <span className="text-yellow-300 dark:text-yellow-400">Management</span>
            </h1>
            <p className="text-blue-100 dark:text-blue-200 text-lg font-light max-w-xl">
              Create, edit, and manage {contentLabelPlural.toLowerCase()} and property updates for your audience.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Navigation Button */}
            <button
              onClick={() => navigate(isGuide ? '/admin/blogs' : '/admin/guides')}
              className="bg-purple-600 dark:bg-purple-700 text-white px-5 py-3 rounded-xl font-bold text-base shadow-lg hover:shadow-xl hover:bg-purple-700 dark:hover:bg-purple-600 transform hover:-translate-y-1 transition-all duration-300 flex items-center gap-2"
            >
              <LayoutTemplate className="w-5 h-5" />
              Go to {isGuide ? 'Blogs' : 'Guides'}
            </button>

            {/* Create Button */}
            <button
              onClick={handleCreate}
              className="group bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 px-6 py-3 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:bg-blue-50 dark:hover:bg-gray-700 transform hover:-translate-y-1 transition-all duration-300 flex items-center gap-2 border border-transparent dark:border-gray-700"
            >
              <div className="bg-blue-100 dark:bg-blue-900/40 p-1 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/60 transition-colors">
                <Plus className="w-5 h-5 text-blue-700 dark:text-blue-400" />
              </div>
              Create New {contentLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 -mt-8 relative z-20 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-1 shadow-lg inline-flex">
          <button
            onClick={() => setActiveTab('blogs')}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'blogs'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
          >
            {contentLabel} Posts
          </button>
          <button
            onClick={() => setActiveTab('subscribers')}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'subscribers'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
          >
            Subscribers
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'analytics'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow max-w-7xl mx-auto px-4 w-full relative z-10 pb-20">

        {activeTab === 'analytics' && <BlogAnalytics type={filterPostType} />}

        {activeTab === 'blogs' && (
          <>
            {/* Filters Card */}
            <div className="bg-white dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 mb-8 animate-fade-in-up transition-all relative z-40">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* Search */}
                <div className="relative group lg:col-span-1 search-container z-50">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400 dark:text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    placeholder={`Search ${contentLabelPlural.toLowerCase()}...`}
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-600 rounded-xl leading-5 bg-gray-50 dark:bg-gray-700 dark:text-white placeholder-gray-400 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50 focus:border-blue-400 dark:focus:border-blue-500 transition-all font-medium"
                  />

                  {/* Suggestions Panel */}
                  {showSuggestions && searchTerm.trim().length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-fade-in">
                      {suggestions.length > 0 ? (
                        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                          {suggestions.map((suggestion) => (
                            <li key={suggestion._id}>
                              <button
                                onClick={() => {
                                  setSearchTerm(suggestion.title);
                                  setShowSuggestions(false);
                                  setPagination(prev => ({ ...prev, current: 1 }));
                                }}
                                className="w-full px-5 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex flex-col group"
                              >
                                <span className="text-sm font-bold text-gray-800 dark:text-gray-200 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                  {suggestion.title}
                                </span>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${suggestion.published ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    }`}>
                                    {suggestion.published ? 'Published' : 'Draft'}
                                  </span>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="p-4 text-center text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wider">
                          No matches found
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Post Type Filter */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileText className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                  <select
                    value={filterPostType}
                    onChange={(e) => setFilterPostType(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-600 rounded-xl leading-5 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50 focus:border-blue-400 dark:focus:border-blue-500 transition-all appearance-none cursor-pointer font-medium"
                  >
                    <option value="all">All Content</option>
                    <option value="blog">Blogs</option>
                    <option value="guide">Guides</option>
                  </select>
                </div>

                {/* Property Scope Filter (Renamed from Type) */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LayoutTemplate className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                  <select
                    value={filterPropertyScope}
                    onChange={(e) => setFilterPropertyScope(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-600 rounded-xl leading-5 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50 focus:border-blue-400 dark:focus:border-blue-500 transition-all appearance-none cursor-pointer font-medium"
                  >
                    <option value="all">All Scopes</option>
                    <option value="global">Global Only</option>
                    <option value="property">Property Specific</option>
                  </select>
                </div>

                {/* Category Filter */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Filter className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-600 rounded-xl leading-5 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50 focus:border-blue-400 dark:focus:border-blue-500 transition-all appearance-none cursor-pointer font-medium"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <CheckCircle className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-600 rounded-xl leading-5 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50 focus:border-blue-400 dark:focus:border-blue-500 transition-all appearance-none cursor-pointer font-medium"
                  >
                    <option value="all">All Status</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Blogs List */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in-up transition-all" style={{ animationDelay: '0.1s' }}>

              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-700/50">
                <h2 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500 dark:text-blue-400" /> All {contentLabelPlural}
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700">{pagination.total}</span>
                </h2>
                <button onClick={() => fetchBlogs(true)} className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all" title="Refresh list">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {loading ? (
                <AdminBlogsSkeleton />
              ) : blogs.length === 0 ? (
                <div className="p-16 text-center text-gray-500 dark:text-gray-400">
                  <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200 dark:border-gray-600">
                    <FileText className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-1">No {contentLabelPlural.toLowerCase()} found</h3>
                  <p className="text-sm">Get started by creating a new {contentLabel.toLowerCase()} post for your audience.</p>
                  <button onClick={handleCreate} className="mt-4 text-blue-600 dark:text-blue-400 font-semibold hover:underline bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg transition-colors">Create {contentLabel}</button>
                </div>
              ) : (
                <>
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50/80 dark:bg-gray-700/80 text-gray-500 dark:text-gray-400 text-xs uppercase font-bold tracking-wider">
                        <tr>
                          <th className="px-6 py-4 text-left">Article</th>
                          {currentUser?.role === 'rootadmin' && <th className="px-6 py-4 text-left">Author</th>}
                          <th className="px-6 py-4 text-left">Scope</th>
                          <th className="px-6 py-4 text-left">Content Type</th>
                          <th className="px-6 py-4 text-left">Category</th>
                          <th className="px-6 py-4 text-left">Property</th>
                          <th className="px-6 py-4 text-center">Status</th>
                          <th className="px-6 py-4 text-center">Views</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {blogs.map((blog) => (
                          <tr key={blog._id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-600 shadow-sm">
                                  {blog.thumbnail ? (
                                    <AdvancedImage src={blog.thumbnail} alt="" className="w-full h-full" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900/40 transition-colors">
                                      <span className="text-gray-400 dark:text-gray-500 text-lg opacity-80">🏠</span>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="font-bold text-gray-800 dark:text-white line-clamp-1 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">{blog.title}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{new Date(blog.createdAt).toLocaleDateString('en-GB')}</div>
                                </div>
                              </div>
                            </td>
                            {currentUser?.role === 'rootadmin' && (
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                    {blog.author?.username || 'Unknown'}
                                  </span>
                                  {blog.author?.email && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {blog.author.email}
                                    </span>
                                  )}
                                  <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                                    {blog.author?.role || 'User'}
                                  </span>
                                </div>
                              </td>
                            )}
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${!blog.propertyId
                                ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-800'
                                : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800'
                                }`}>
                                {!blog.propertyId ? <Globe className="w-3 h-3" /> : <Home className="w-3 h-3" />}
                                {!blog.propertyId ? 'Global' : 'Property'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${blog.type === 'guide'
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                                }`}>
                                {blog.type === 'guide' ? 'Guide' : 'Blog'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md font-bold border border-gray-200 dark:border-gray-600">
                                {blog.category}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {blog.propertyId ? (
                                <div className="text-sm">
                                  <div className="font-bold text-gray-800 dark:text-gray-200 line-clamp-1">{blog.propertyId.name}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">{blog.propertyId.city}, {blog.propertyId.state}</div>
                                </div>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500 text-sm italic">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => togglePublish(blog)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-all hover:scale-105 border ${blog.published
                                  ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                                  : blog.scheduledAt
                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                    : 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
                                  }`}
                              >
                                {blog.published ? <Eye className="w-3 h-3" /> : (blog.scheduledAt ? <Clock className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />)}
                                {blog.published ? 'Published' : (blog.scheduledAt ? 'Scheduled' : 'Draft')}
                              </button>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-sm font-black text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-lg border border-gray-100 dark:border-gray-600">{blog.views || 0}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => handleViewDetails(blog)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-transparent hover:border-blue-100 dark:hover:border-blue-800" title={`View ${contentLabel}`}>
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleEdit(blog)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors border border-transparent hover:border-green-100 dark:hover:border-green-800" title={`Edit ${contentLabel}`}>
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(blog._id)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-800" title={`Delete ${contentLabel}`}>
                                  <Trash className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="lg:hidden p-4 space-y-4">
                    {blogs.map((blog) => (
                      <div key={blog._id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-700 overflow-hidden border border-gray-100 dark:border-gray-600 shadow-inner">
                              {blog.thumbnail ? (
                                <img src={blog.thumbnail} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                                  <FileText className="w-7 h-7" />
                                </div>
                              )}
                            </div>
                            <div>
                              <h3 className="font-black text-gray-800 dark:text-white line-clamp-1">{blog.title}</h3>
                              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-1 font-bold">
                                <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{new Date(blog.createdAt).toLocaleDateString()}</span>
                                <span>•</span>
                                <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">{blog.views || 0} views</span>
                              </div>
                            </div>
                          </div>
                          <div className="relative">
                            <button
                              onClick={() => togglePublish(blog)}
                              className={`p-2 rounded-full shadow-sm border transition-all active:scale-95 ${blog.published
                                ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-100 dark:border-green-800'
                                : blog.scheduledAt
                                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800'
                                  : 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-100 dark:border-yellow-800'
                                }`}
                            >
                              {blog.published ? <Eye className="w-4 h-4" /> : (blog.scheduledAt ? <Clock className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />)}
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${!blog.propertyId
                            ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-800'
                            : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800'
                            }`}>
                            {!blog.propertyId ? <Globe className="w-3 h-3" /> : <Home className="w-3 h-3" />}
                            {!blog.propertyId ? 'Global' : 'Property'}
                          </span>
                          <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                            {blog.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                          <button onClick={() => handleViewDetails(blog)} className="flex-1 py-2.5 flex items-center justify-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600">
                            <ExternalLink className="w-4 h-4" /> View
                          </button>
                          <button onClick={() => handleEdit(blog)} className="flex-1 py-2.5 flex items-center justify-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors border border-transparent hover:border-blue-100 dark:hover:border-blue-800">
                            <Edit className="w-4 h-4" /> Edit
                          </button>
                          <button onClick={() => handleDelete(blog._id)} className="flex-1 py-2.5 flex items-center justify-center gap-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-800">
                            <Trash className="w-4 h-4" /> Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {pagination.pages > 1 && (
                    <div className="px-6 py-6 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/30 dark:bg-gray-700/30 backdrop-blur-sm">
                      <span className="text-sm font-bold text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                        Showing page {pagination.current} of {pagination.pages}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setPagination(prev => ({ ...prev, current: Math.max(1, prev.current - 1) }))}
                          disabled={pagination.current === 1}
                          className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow active:scale-95"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="px-5 py-2.5 bg-blue-600 text-white border border-blue-700 rounded-xl text-sm font-black shadow-lg shadow-blue-500/20 transform -translate-y-0.5">
                          {pagination.current}
                        </div>
                        <button
                          onClick={() => setPagination(prev => ({ ...prev, current: Math.min(pagination.pages, prev.current + 1) }))}
                          disabled={pagination.current === pagination.pages}
                          className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow active:scale-95"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {activeTab === 'subscribers' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in-up">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50 flex justify-between items-center">
              <h2 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                Subscribers
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700">{subscribers.length}</span>
              </h2>
              <button
                onClick={fetchSubscribers}
                className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                title="Refresh List"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Subscriber Filters */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-700/30">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Search */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by email..."
                    value={subscriberSearchTerm}
                    onChange={(e) => setSubscriberSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/50 focus:border-purple-400 dark:focus:border-purple-500 transition-all text-sm font-medium"
                  />
                </div>

                {/* Status Filter */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Filter className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                  <select
                    value={subscriberFilterStatus}
                    onChange={(e) => setSubscriberFilterStatus(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/50 focus:border-purple-400 dark:focus:border-purple-500 transition-all appearance-none cursor-pointer text-sm font-medium"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="revoked">Revoked</option>
                    <option value="opted_out">Opted Out</option>
                  </select>
                </div>

                {/* Subscription Type Filter (Replaces Source) */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Globe className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                  <select
                    value={subscriberFilterType}
                    onChange={(e) => setSubscriberFilterType(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/50 focus:border-purple-400 dark:focus:border-purple-500 transition-all appearance-none cursor-pointer text-sm font-medium"
                  >
                    <option value="blog">Blog</option>
                    <option value="guide">Guide</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/80 dark:bg-gray-700/80 text-gray-500 dark:text-gray-400 text-xs uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4 text-left">Email</th>
                    <th className="px-6 py-4 text-left">Subscribed Date</th>
                    <th className="px-6 py-4 text-left">Subscriptions</th>
                    <th className="px-6 py-4 text-left">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {paginatedSubscribers.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        {subscriberSearchTerm || subscriberFilterStatus !== 'all' || subscriberFilterType !== 'all'
                          ? 'No subscribers match your filters.'
                          : 'No subscribers found yet.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedSubscribers.map((sub, index) => (
                      <tr
                        key={sub._id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        style={{ animation: `fadeIn 0.2s ease-out ${index * 0.03}s backwards` }}
                      >
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                          {sub.email}
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                          {new Date(sub.subscribedAt || sub.createdAt).toLocaleDateString()} {new Date(sub.subscribedAt || sub.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                          <div className="flex gap-2">
                            {/* Show derived badges based on context */}
                            {(subscriberFilterType === 'all' || subscriberFilterType === 'blog') && (
                              <>
                                {sub.preferences?.blog && (
                                  <span className="px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800">
                                    Blog
                                  </span>
                                )}
                                {sub.pendingPreferences?.blog && !sub.preferences?.blog && (
                                  <span className="px-2 py-1 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-bold border border-orange-200 dark:border-orange-800">
                                    Pending Blog
                                  </span>
                                )}
                              </>
                            )}

                            {(subscriberFilterType === 'all' || subscriberFilterType === 'guide') && (
                              <>
                                {sub.preferences?.guide && (
                                  <span className="px-2 py-1 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold border border-purple-200 dark:border-purple-800">
                                    Guide
                                  </span>
                                )}
                                {sub.pendingPreferences?.guide && !sub.preferences?.guide && (
                                  <span className="px-2 py-1 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-bold border border-orange-200 dark:border-orange-800">
                                    Pending Guide
                                  </span>
                                )}
                              </>
                            )}

                            {/* Fallback None if truly nothing for this context */}
                            {subscriberFilterType === 'blog' && !sub.preferences?.blog && !sub.pendingPreferences?.blog && (
                              <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-500">None</span>
                            )}
                            {subscriberFilterType === 'guide' && !sub.preferences?.guide && !sub.pendingPreferences?.guide && (
                              <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-500">None</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            const isBlog = subscriberFilterType === 'blog';
                            const isGuide = subscriberFilterType === 'guide';

                            // Determine status based on specific preference
                            let displayStatus = sub.status;
                            let statusColor = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';

                            const activePref = isBlog ? sub.preferences?.blog : (isGuide ? sub.preferences?.guide : null);
                            const pendingPref = isBlog ? sub.pendingPreferences?.blog : (isGuide ? sub.pendingPreferences?.guide : null);

                            if (activePref && sub.status === 'approved') {
                              displayStatus = 'approved';
                              statusColor = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                            } else if (pendingPref || (activePref && sub.status === 'pending')) {
                              displayStatus = 'pending';
                              statusColor = 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
                            } else if (sub.status === 'rejected') {
                              displayStatus = 'rejected';
                              statusColor = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
                            } else if (sub.status === 'revoked' || sub.status === 'opted_out') {
                              displayStatus = sub.status;
                              statusColor = 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400';
                            }

                            return (
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColor}`}>
                                {displayStatus.toUpperCase().replace('_', ' ')}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {(() => {
                              const isBlog = subscriberFilterType === 'blog';
                              const isGuide = subscriberFilterType === 'guide';

                              const activePref = isBlog ? sub.preferences?.blog : (isGuide ? sub.preferences?.guide : null);
                              const pendingPref = isBlog ? sub.pendingPreferences?.blog : (isGuide ? sub.pendingPreferences?.guide : null);

                              if (pendingPref || (activePref && sub.status === 'pending')) {
                                return (
                                  <>
                                    <button
                                      onClick={() => openApproveModal(sub)}
                                      className="p-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"
                                      title="Approve"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => openRejectModal(sub)}
                                      className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                      title="Reject"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  </>
                                );
                              }

                              if (activePref) {
                                return (
                                  <button
                                    onClick={() => openRevokeModal(sub)}
                                    className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                                    title="Revoke"
                                  >
                                    <Ban className="w-4 h-4" />
                                  </button>
                                );
                              }

                              if (sub.status === 'rejected' || sub.status === 'revoked' || sub.status === 'opted_out') {
                                return (
                                  <button
                                    onClick={() => openApproveModal(sub)}
                                    className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                                    title="Re-approve"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                );
                              }

                              return null;
                            })()}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Subscriber Pagination */}
            {totalSubscriberPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/30 dark:bg-gray-700/30">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Showing page <span className="font-semibold text-gray-900 dark:text-white">{currentSubscriberPage}</span> of <span className="font-semibold dark:text-gray-300">{totalSubscriberPages}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentSubscriberPage(prev => Math.max(1, prev - 1))}
                    disabled={currentSubscriberPage === 1}
                    className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>
                  <button
                    onClick={() => setCurrentSubscriberPage(prev => Math.min(totalSubscriberPages, prev + 1))}
                    disabled={currentSubscriberPage === totalSubscriberPages}
                    className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <BlogEditModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        properties={properties}
        categories={categories}
        propertySearch={propertySearch}
        setPropertySearch={setPropertySearch}
        isEdit={!!editingBlog}
      />

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setBlogToDelete(null);
        }}
        onConfirm={confirmDelete}
        title={`Delete ${contentLabel}`}
        message={`Are you sure you want to delete this ${contentLabel.toLowerCase()}? This action cannot be undone.`}
        confirmText="Delete"
        isDestructive={true}
      />

      {showStatusModal && blogToToggle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform animate-scale-in border border-gray-100 dark:border-gray-700 transition-all">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-700/30">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Manage Status
              </h3>
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setBlogToToggle(null);
                }}
                disabled={statusActionLoading}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Title</span>
                <h4 className="font-extrabold text-base text-gray-800 dark:text-white line-clamp-2">{blogToToggle.title}</h4>
              </div>

              {/* Status Section */}
              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Current Status</span>
                {blogToToggle.published ? (
                  <div className="space-y-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                      <Eye className="w-3.5 h-3.5" /> Published
                    </span>
                    <div className="bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 rounded-xl p-4 text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Published Time:</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">
                          {new Date(blogToToggle.publishedAt || blogToToggle.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : blogToToggle.scheduledAt ? (
                  <div className="space-y-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                      <Clock className="w-3.5 h-3.5" /> Scheduled
                    </span>
                    <div className="bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 rounded-xl p-4 text-sm space-y-2">
                      <div className="flex justify-between flex-wrap gap-1">
                        <span className="text-gray-500 dark:text-gray-400">Scheduled Time:</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {new Date(blogToToggle.scheduledAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between flex-wrap gap-1 border-t border-gray-100 dark:border-gray-700/50 pt-2">
                        <span className="text-gray-500 dark:text-gray-400">Drafted Time:</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">
                          {new Date(blogToToggle.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">
                      <EyeOff className="w-3.5 h-3.5" /> Draft
                    </span>
                    <div className="bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 rounded-xl p-4 text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Drafted Time:</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">
                          {new Date(blogToToggle.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {blogToToggle.publishedAt && (
                        <div className="flex justify-between border-t border-gray-100 dark:border-gray-700/50 pt-2">
                          <span className="text-gray-500 dark:text-gray-400">Previously Published:</span>
                          <span className="font-bold text-gray-800 dark:text-gray-200">
                            {new Date(blogToToggle.publishedAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700/20 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-3">
              {statusActionLoading ? (
                <div className="flex items-center justify-center py-2 text-blue-600 font-bold text-sm gap-2">
                  <UrbanSetuSpinner size="sm" /> Updating status...
                </div>
              ) : (
                <>
                  {blogToToggle.published ? (
                    <button
                      onClick={() => updateBlogStatus(blogToToggle._id, { published: false })}
                      className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-2xl font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                    >
                      <EyeOff className="w-4 h-4" /> Unpublish to Draft
                    </button>
                  ) : blogToToggle.scheduledAt ? (
                    <>
                      <button
                        onClick={() => updateBlogStatus(blogToToggle._id, { published: true, scheduledAt: null })}
                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                      >
                        <Eye className="w-4 h-4" /> Publish Now
                      </button>
                      <button
                        onClick={() => updateBlogStatus(blogToToggle._id, { published: false, scheduledAt: null })}
                        className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-2xl font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-4 h-4" /> Cancel Scheduling (Draft)
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => updateBlogStatus(blogToToggle._id, { published: true, scheduledAt: null })}
                      className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" /> Publish Now
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowStatusModal(false);
                      setBlogToToggle(null);
                    }}
                    className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-2xl font-bold transition-colors text-sm"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Reject Subscription</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Please provide a reason for rejecting this subscription. This will be sent to the user.
              </p>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Reason for rejection..."
                className="w-full h-32 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white text-sm mb-4"
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdateSubscription(subToProcess._id, 'rejected', statusReason)}
                  disabled={!statusReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Reject Subscription
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Approve Subscription</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to approve this subscription for <span className="font-bold text-gray-900 dark:text-white">{subToProcess?.email}</span>?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowApproveModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleUpdateSubscription(subToProcess._id, 'approved');
                    setShowApproveModal(false);
                  }}
                  className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
                >
                  Approve Subscription
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Modal */}
      {showRevokeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Revoke Subscription</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Please provide a reason for revoking this subscription. This will be sent to the user.
              </p>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Reason for revocation..."
                className="w-full h-32 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white text-sm mb-4"
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowRevokeModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdateSubscription(subToProcess._id, 'revoked', statusReason)}
                  disabled={!statusReason.trim()}
                  className="px-4 py-2 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Revoke Subscription
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default AdminBlogs;
