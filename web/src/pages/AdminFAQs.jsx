import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaFilter, FaGlobe, FaHome, FaEye, FaEyeSlash, FaTimes, FaExternalLinkAlt, FaThumbsUp, FaThumbsDown, FaQuestionCircle } from 'react-icons/fa';
import { authenticatedFetch } from '../utils/auth';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';

import { usePageTitle } from '../hooks/usePageTitle';

const AdminFAQs = () => {
  // Set page title
  usePageTitle("FAQs - Admin Panel");
  const { currentUser } = useSelector((state) => state.user);

  const navigate = useNavigate();
  const [faqs, setFaqs] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, global, property
  const [filterCategory, setFilterCategory] = useState('all');
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null });
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    category: 'General',
    propertyId: '',
    isGlobal: false,
    tags: [],
    priority: 0,
    isActive: true
  });

  const [propertySearch, setPropertySearch] = useState('');
  const [authWarning, setAuthWarning] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://urbansetu-pvt4.onrender.com';

  // Check authentication status
  const checkAuthStatus = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/auth/verify`);

      if (response.ok) {
        setAuthWarning(false);
        return true;
      } else {
        setAuthWarning(true);
        return false;
      }
    } catch (error) {
      console.error('❌ Auth check error:', error);
      return false;
    }
  };

  // Separate useEffect for initial load and static data
  useEffect(() => {
    const initializeData = async () => {
      const isAuthenticated = await checkAuthStatus();
      if (!isAuthenticated) {
        console.warn('⚠️ User not authenticated - FAQ filtering may be affected');
      }
      fetchFAQs();
      fetchProperties();
      fetchCategories();
    };

    initializeData();
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim().length > 0) {
        fetchSuggestions();
      } else {
        setSuggestions([]);
      }

      if (pagination.current === 1) {
        fetchFAQs(false);
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
      fetchFAQs(false);
    } else {
      setPagination(prev => ({ ...prev, current: 1 }));
    }
  }, [filterType, filterCategory]);

  // Pagination effect
  useEffect(() => {
    fetchFAQs();
  }, [pagination.current]);

  // Scroll lock effect for modal
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal]);

  const fetchFAQs = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const params = new URLSearchParams({
        page: pagination.current,
        limit: 10,
        isAdmin: 'true', // added to ensure hidden/inactive FAQs are returned
        includeInactive: 'true'
      });

      if (searchTerm) params.append('search', searchTerm);
      if (filterType === 'global') params.append('isGlobal', 'true');
      if (filterType === 'property') params.append('propertyId', 'exists');
      if (filterCategory !== 'all') params.append('category', filterCategory);

      const response = await authenticatedFetch(`${API_BASE_URL}/api/faqs?${params}`);

      if (response.ok) {
        const data = await response.json();
        setFaqs(data.data);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error fetching FAQs:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };
  const fetchProperties = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/listing/get?limit=1000`);
      if (response.ok) {
        const data = await response.json();
        setProperties(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching properties for FAQ:', error);
    }
  };
  const fetchSuggestions = async () => {
    try {
      const params = new URLSearchParams({
        isAdmin: 'true',
        includeInactive: 'true',
        search: searchTerm,
        limit: 5
      });

      const response = await authenticatedFetch(`${API_BASE_URL}/api/faqs?${params}`);

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.data);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/faqs/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Error fetching FAQ categories:', error);
    }
  };

  const handleCreate = () => {
    setEditingFAQ(null);
    setFormData({
      question: '',
      answer: '',
      category: 'General',
      propertyId: '',
      isGlobal: true, // Default to Global
      tags: [],
      priority: 0,
      isActive: true
    });
    setShowModal(true);
  };

  const handleEdit = (faq) => {
    setEditingFAQ(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      propertyId: faq.propertyId?._id || '',
      isGlobal: faq.isGlobal,
      tags: faq.tags || [],
      priority: faq.priority,
      isActive: faq.isActive
    });
    setShowModal(true);
  };

  const handleViewProperty = (faq) => {
    if (faq.propertyId && faq.propertyId._id) {
      navigate(`/admin/listing/${faq.propertyId._id}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingFAQ
        ? `${API_BASE_URL}/api/faqs/${editingFAQ._id}`
        : `${API_BASE_URL}/api/faqs`;

      const method = editingFAQ ? 'PUT' : 'POST';

      const requestBody = {
        ...formData,
        propertyId: formData.propertyId || null,
        isGlobal: !formData.propertyId // Ensure isGlobal is correct based on propertyId
      };

      const response = await authenticatedFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        toast.success(editingFAQ ? 'FAQ updated successfully!' : 'FAQ created successfully!');
        setShowModal(false);
        fetchFAQs();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to save FAQ');
      }
    } catch (error) {
      console.error('Error saving FAQ:', error);
      toast.error('Failed to save FAQ. Please try again.');
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteModal({ show: true, id });
  };

  const confirmDelete = async () => {
    if (!deleteModal.id) return;

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/faqs/${deleteModal.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('FAQ deleted successfully');
        fetchFAQs();
        setDeleteModal({ show: false, id: null });
      } else {
        toast.error('Failed to delete FAQ');
      }
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      toast.error('Failed to delete FAQ');
    }
  };

  const closeDeleteModal = () => {
    setDeleteModal({ show: false, id: null });
  };

  const toggleActive = async (faq) => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/faqs/${faq._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isActive: !faq.isActive
        })
      });

      if (response.ok) {
        // Update local state to reflect change immediately without refetching
        setFaqs(prevFaqs =>
          prevFaqs.map(f =>
            f._id === faq._id ? { ...f, isActive: !f.isActive } : f
          )
        );
        toast.success(`FAQ ${!faq.isActive ? 'activated' : 'deactivated'} successfully`);
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to toggle FAQ status');
      }
    } catch (error) {
      console.error('❌ Error toggling FAQ status:', error);
      toast.error('Failed to toggle FAQ status. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-orange-50 dark:from-slate-900 dark:via-slate-800 dark:to-orange-950/20 p-4 sm:p-6 lg:p-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 sm:p-8 mb-8 animate-fade-in transition-all">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-orange-100 dark:bg-orange-900/40 rounded-2xl shadow-inner">
                <FaQuestionCircle className="text-3xl text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                  FAQ <span className="text-orange-600 dark:text-orange-400">Moderation</span>
                </h1>
                <p className="text-gray-500 dark:text-gray-400 font-medium mt-1 uppercase text-xs tracking-widest">
                  Control the knowledge base of UrbanSetu
                </p>
              </div>
            </div>
            <button
              onClick={handleCreate}
              className="w-full md:w-auto bg-gray-900 dark:bg-orange-600 text-white px-8 py-4 rounded-2xl hover:bg-orange-600 dark:hover:bg-orange-700 flex items-center justify-center gap-3 shadow-xl hover:shadow-orange-600/20 transform hover:-translate-y-1 transition-all duration-300 font-black uppercase text-sm tracking-widest active:scale-95"
            >
              <FaPlus /> Create FAQ
            </button>
          </div>

          {authWarning && (
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl animate-pulse">
              <p className="text-yellow-800 dark:text-yellow-400 text-sm font-bold flex items-center gap-2">
                ⚠️ Auth session expired. Please re-login to manage inactive FAQs.
              </p>
            </div>
          )}
        </div>

        {/* Filters Grid */}
        <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 mb-8 animate-slide-up">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="relative group">
              <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-widest ml-1">Search Keywords</label>
              <div className="relative search-container z-50">
                <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Find questions..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full pl-12 pr-4 py-4 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 focus:border-orange-500 dark:focus:border-orange-400 transition-all font-bold placeholder-gray-400 shadow-sm"
                />

                {/* Search Suggestions Panel */}
                {showSuggestions && searchTerm.trim().length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-fade-in">
                    {suggestions.length > 0 ? (
                      <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {suggestions.map((suggestion) => (
                          <li key={suggestion._id}>
                            <button
                              onClick={() => {
                                setSearchTerm(suggestion.question);
                                setShowSuggestions(false);
                                setPagination(prev => ({ ...prev, current: 1 }));
                              }}
                              className="w-full px-5 py-3 text-left hover:bg-orange-50 dark:hover:bg-gray-700/50 transition-colors flex flex-col group"
                            >
                              <span className="text-sm font-bold text-gray-800 dark:text-gray-200 line-clamp-1 group-hover:text-orange-600 dark:group-hover:text-orange-400">
                                {suggestion.question}
                              </span>
                              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                                {suggestion.category}
                              </span>
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
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-widest ml-1">Scope</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-5 py-4 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 font-bold appearance-none cursor-pointer transition-all shadow-sm"
              >
                <option value="all">Everywhere</option>
                <option value="global">Global Only</option>
                <option value="property">Linked to Properties</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-widest ml-1">Specialty</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-5 py-4 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 font-bold appearance-none cursor-pointer transition-all shadow-sm"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => fetchFAQs()}
                className="w-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-6 py-4 rounded-2xl hover:bg-orange-600 hover:text-white dark:hover:bg-orange-600 dark:hover:text-white border border-orange-200 dark:border-orange-800/50 flex items-center justify-center gap-2 shadow-sm font-black uppercase text-xs tracking-widest transition-all active:scale-95"
              >
                <FaFilter /> Refresh Results
              </button>
            </div>
          </div>
        </div>

        {/* FAQs Table/Grid */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-slide-up-slow">
          {loading ? (
            <div className="p-32 text-center flex flex-col items-center justify-center">
              <div className="relative inline-block mb-6">
                <UrbanSetuSpinner size="xl" />
                <div className="absolute inset-0 flex items-center justify-center pt-1 animate-pulse">
                  <FaQuestionCircle className="text-orange-600/30 text-3xl" />
                </div>
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-black tracking-widest animate-pulse uppercase">SYNCHRONIZING KNOWLEDGE...</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                      <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Question & Metadata</th>
                      {currentUser?.role === 'rootadmin' && <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Author</th>}
                      <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Scope</th>
                      <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Property Link</th>
                      <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Engagement</th>
                      <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Status</th>
                      <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {faqs.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-20 text-center">
                          <div className="opacity-20 flex flex-col items-center">
                            <FaQuestionCircle className="text-8xl mb-4" />
                            <p className="text-xl font-black">NO QUESTIONS FOUND</p>
                          </div>
                        </td>
                      </tr>
                    ) : faqs.map((faq) => (
                      <tr key={faq._id} className={`group hover:bg-orange-50/30 dark:hover:bg-orange-950/10 transition-colors duration-300 ${!faq.isActive ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}>
                        <td className="px-8 py-6">
                          <div className="flex flex-col gap-1">
                            <div className="text-sm font-black text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                              {faq.question}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded uppercase tracking-tighter">{faq.category}</span>
                              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">ID: {faq._id.slice(-6)}</span>
                            </div>
                          </div>
                        </td>
                        {currentUser?.role === 'rootadmin' && (
                          <td className="px-8 py-6">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                {faq.createdBy?.username || 'Unknown'}
                              </span>
                              {faq.createdBy?.email && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {faq.createdBy.email}
                                </span>
                              )}
                              <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                                Admin
                              </span>
                            </div>
                          </td>
                        )}
                        <td className="px-8 py-6">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border ${faq.isGlobal
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800'
                            : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800'
                            }`}>
                            {faq.isGlobal ? <FaGlobe className="mr-1.5" /> : <FaHome className="mr-1.5" />}
                            {faq.isGlobal ? 'Global' : 'Property'}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          {faq.propertyId ? (
                            <div className="flex flex-col">
                              <div className="text-xs font-black text-gray-800 dark:text-gray-200 line-clamp-1">{faq.propertyId.name}</div>
                              <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{faq.propertyId.city}, {faq.propertyId.state}</div>
                            </div>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600 text-sm font-black italic">UNIVERSAL</span>
                          )}
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center">
                              <FaThumbsUp className="text-emerald-500 mb-1" />
                              <span className="text-xs font-black text-gray-700 dark:text-gray-300">{faq.helpful || 0}</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <FaThumbsDown className="text-rose-500 mb-1" />
                              <span className="text-xs font-black text-gray-700 dark:text-gray-300">{faq.notHelpful || 0}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <button
                            onClick={() => toggleActive(faq)}
                            className={`inline-flex items-center px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-90 border ${faq.isActive
                              ? 'bg-emerald-500 text-white border-emerald-600'
                              : 'bg-rose-500 text-white border-rose-600'
                              }`}
                          >
                            {faq.isActive ? <FaEye className="mr-2" /> : <FaEyeSlash className="mr-2" />}
                            {faq.isActive ? 'Active' : 'Offline'}
                          </button>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-2">
                            {faq.propertyId && (
                              <button
                                onClick={() => handleViewProperty(faq)}
                                className="p-2.5 bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 rounded-xl hover:bg-sky-600 hover:text-white transition-all shadow-sm border border-sky-100 dark:border-sky-800"
                                title="Visit Property"
                              >
                                <FaExternalLinkAlt className="text-xs" />
                              </button>
                            )}
                            <button
                              onClick={() => handleEdit(faq)}
                              className="p-2.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100 dark:border-indigo-800"
                              title="Refine FAQ"
                            >
                              <FaEdit className="text-xs" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(faq._id)}
                              className="p-2.5 bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm border border-rose-100 dark:border-rose-800"
                              title="Erase Record"
                            >
                              <FaTrash className="text-xs" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile List View */}
              <div className="lg:hidden p-4 space-y-4">
                {faqs.length === 0 ? (
                  <div className="p-20 text-center">
                    <div className="opacity-20 flex flex-col items-center">
                      <FaQuestionCircle className="text-8xl mb-4 text-gray-400 dark:text-gray-600" />
                      <p className="text-xl font-black text-gray-500 dark:text-gray-400">NO QUESTIONS FOUND</p>
                    </div>
                  </div>
                ) : faqs.map((faq) => (
                  <div key={faq._id} className={`rounded-3xl shadow-xl p-6 border-l-8 transition-all duration-300 transform active:scale-95 ${!faq.isActive
                    ? 'bg-white dark:bg-gray-800 border-rose-500 dark:border-rose-600'
                    : 'bg-white dark:bg-gray-800 border-orange-500 dark:border-orange-600'}`}>

                    <div className="flex justify-between items-start mb-4">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${faq.isGlobal
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800'
                        : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800'}`}>
                        {faq.isGlobal ? 'Global Knowledge' : 'Property Specific'}
                      </span>
                      <button onClick={() => toggleActive(faq)} className={`p-2 rounded-full ${faq.isActive ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {faq.isActive ? <FaEye /> : <FaEyeSlash />}
                      </button>
                    </div>

                    <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2 leading-snug">{faq.question}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 font-bold">{faq.answer}</p>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1.5">
                          <FaThumbsUp className="text-emerald-500 text-sm" />
                          <span className="text-xs font-black dark:text-gray-300">{faq.helpful || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FaThumbsDown className="text-rose-500 text-sm" />
                          <span className="text-xs font-black dark:text-gray-300">{faq.notHelpful || 0}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(faq)} className="p-3 bg-gray-100 dark:bg-gray-700 rounded-2xl text-gray-600 dark:text-gray-300">
                          <FaEdit />
                        </button>
                        <button onClick={() => handleDeleteClick(faq._id)} className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-2xl text-rose-500">
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Enhanced Pagination */}
              {pagination.pages > 1 && (
                <div className="px-8 py-8 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center sm:text-left">
                      Page <span className="text-gray-900 dark:text-white">{pagination.current}</span> of <span className="text-gray-900 dark:text-white">{pagination.pages}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}
                        disabled={pagination.current === 1}
                        className="px-6 py-3 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-black uppercase tracking-tighter text-gray-700 dark:text-gray-300 hover:border-orange-500 dark:hover:border-orange-500 disabled:opacity-20 transition-all active:scale-95 shadow-sm"
                      >
                        PREV
                      </button>
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, current: prev.current + 1 }))}
                        disabled={pagination.current === pagination.pages}
                        className="px-6 py-3 bg-gray-900 dark:bg-orange-600 text-white rounded-2xl text-xs font-black uppercase tracking-tighter hover:bg-orange-600 disabled:opacity-20 transition-all active:scale-95 shadow-lg"
                      >
                        NEXT
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* FAQ Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[100] p-4 sm:p-8 animate-fade-in transition-all">
            <div className="bg-white dark:bg-gray-800 rounded-[35px] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto transform animate-scale-in border border-white/20">
              <div className="sticky top-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-700 p-8 z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-orange-600 rounded-2xl shadow-lg shadow-orange-600/30">
                      {editingFAQ ? <FaEdit className="text-white text-xl" /> : <FaPlus className="text-white text-xl" />}
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
                        {editingFAQ ? 'Update FAQ' : 'Assemble FAQ'}
                      </h2>
                      <p className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-[.25em] mt-1">Knowledge Base Architect</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-4 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition-all active:scale-90"
                  >
                    <FaTimes className="text-2xl" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-10 pb-16">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-4 uppercase tracking-[.3em] ml-1">The Question <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={formData.question}
                    onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                    className="w-full px-6 py-5 border-2 border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-[25px] focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 focus:border-orange-500 dark:focus:border-orange-500 transition-all font-black text-lg placeholder-gray-300 dark:placeholder-gray-500"
                    placeholder="Wording your inquiry..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-4 uppercase tracking-[.3em] ml-1">The Solution <span className="text-rose-500">*</span></label>
                  <textarea
                    value={formData.answer}
                    onChange={(e) => setFormData(prev => ({ ...prev, answer: e.target.value }))}
                    rows={6}
                    className="w-full px-6 py-5 border-2 border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-[25px] focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 focus:border-orange-500 dark:focus:border-orange-500 transition-all font-bold text-base placeholder-gray-300 dark:placeholder-gray-500 resize-none"
                    placeholder="Crafting the definitive answer..."
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-4 uppercase tracking-[.3em] ml-1">Categorization</label>
                    <div className="relative">
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-6 py-5 border-2 border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-[25px] focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-500 font-black appearance-none"
                      >
                        {categories.map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-4 uppercase tracking-[.3em] ml-1">Rank & Priority</label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                      className="w-full px-6 py-5 border-2 border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-[25px] focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-500 font-black"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-4 uppercase tracking-[.3em] ml-1">Asset Targeting (Optional)</label>
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={propertySearch}
                      onChange={(e) => setPropertySearch(e.target.value)}
                      placeholder="Filter properties..."
                      className="w-full px-6 py-4 border-2 border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20 text-gray-900 dark:text-white rounded-2xl focus:ring-2 focus:ring-orange-400 font-bold"
                    />
                    <select
                      value={formData.propertyId}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        propertyId: e.target.value,
                        isGlobal: !e.target.value // If propertyId is empty/null, isGlobal should be true
                      }))}
                      className="w-full px-6 py-5 border-2 border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-[25px] font-black focus:ring-4 focus:ring-orange-500"
                    >
                      <option value="">MARK AS GLOBAL (ALL ASSETS)</option>
                      {properties
                        .filter((p) => {
                          const s = propertySearch.trim().toLowerCase();
                          if (!s) return true;
                          return (
                            (p.name || "").toLowerCase().includes(s) ||
                            (p._id || "").toLowerCase().includes(s) ||
                            (p.description || "").toLowerCase().includes(s) ||
                            (p.address || "").toLowerCase().includes(s) ||
                            (p.landmark || "").toLowerCase().includes(s) ||
                            (p.city || "").toLowerCase().includes(s) ||
                            (p.state || "").toLowerCase().includes(s)
                          );
                        })
                        .map(property => (
                          <option key={property._id} value={property._id}>
                            {property.name.toUpperCase()} - {property.city.toUpperCase()}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-6 pt-10">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-10 py-5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-[25px] font-black uppercase text-xs tracking-widest hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95"
                  >
                    Destroy Changes
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-10 py-5 bg-gray-900 dark:bg-orange-600 text-white rounded-[25px] font-black uppercase text-xs tracking-[.25em] hover:bg-orange-600 dark:hover:bg-orange-700 shadow-2xl shadow-orange-600/30 transition-all active:scale-95 translate-y-[-4px]"
                  >
                    {editingFAQ ? 'Finalize Assembly' : 'Authorize Release'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteModal.show && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-sm w-full border border-gray-100 dark:border-gray-700 animate-scale-in">
              <div className="flex flex-col items-center text-center">
                <div className="bg-rose-100 dark:bg-rose-900/30 p-4 rounded-full mb-4">
                  <FaTrash className="text-2xl text-rose-600 dark:text-rose-400" />
                </div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Delete Confirmation</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
                  Are you sure you want to erase this FAQ record permanently? This action cannot be undone.
                </p>
                <div className="flex gap-4 w-full">
                  <button
                    onClick={closeDeleteModal}
                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 shadow-lg shadow-rose-600/30 transition-all"
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFAQs;
