import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import PublicFAQsSkeleton from '../components/skeletons/PublicFAQsSkeleton';
import {
  Search, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown,
  Filter, HelpCircle, MessageCircle, Phone, Mail,
  Info, ArrowRight, MessageSquare
} from 'lucide-react';
import SEO from '../components/SEO';
import { authenticatedFetch } from '../utils/auth';

const PublicFAQs = () => {
  // SEO Dynamic Tags
  const seoTitle = "Frequently Asked Questions - Help Center";
  const seoDescription = "Find answers to commonly asked questions about buying, renting, and selling properties on UrbanSetu. Learn about verification, payments, and smart search features.";

  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [expandedFAQ, setExpandedFAQ] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const { currentUser } = useSelector((state) => state.user);
  const [userReactions, setUserReactions] = useState({});
  const [reactionLoading, setReactionLoading] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://urbansetu-pvt4.onrender.com';

  // Separate useEffect for initial load and categories
  useEffect(() => {
    fetchFAQs();
    fetchCategories();
  }, []);

  // Check user reactions when logged in and FAQs are loaded
  useEffect(() => {
    if (currentUser && faqs.length > 0) {
      checkUserReactions();
    }
  }, [currentUser, faqs]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim().length > 0) {
        fetchSuggestions();
      } else {
        setSuggestions([]);
      }

      if (pagination.current === 1) {
        fetchFAQs(false); // Don't show loading for search
      } else {
        setPagination(prev => ({ ...prev, current: 1 }));
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.relative.z-50')) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Immediate filter effect for category changes
  useEffect(() => {
    if (pagination.current === 1) {
      fetchFAQs(false); // Don't show loading for immediate filter changes
    } else {
      setPagination(prev => ({ ...prev, current: 1 }));
    }
  }, [selectedCategories]);

  // Pagination effect
  useEffect(() => {
    fetchFAQs();
  }, [pagination.current]);

  const toggleCategory = (category) => {
    if (category === 'all') {
      setSelectedCategories([]);
      return;
    }
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  const fetchFAQs = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const params = new URLSearchParams({
        isGlobal: 'true',
        isActive: 'true',
        page: pagination.current,
        limit: 10
      });

      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategories.length > 0) {
        params.append('category', selectedCategories.join(','));
      }

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

  const fetchSuggestions = async () => {
    try {
      const params = new URLSearchParams({
        isGlobal: 'true',
        isActive: 'true',
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
      console.error('Error fetching categories:', error);
    }
  };

  const handleFAQClick = (faqId) => {
    setExpandedFAQ(expandedFAQ === faqId ? null : faqId);
  };



  const checkUserReactions = async () => {
    try {
      const reactions = {};
      for (const faq of faqs) {
        try {
          const response = await authenticatedFetch(`${API_BASE_URL}/api/faqs/${faq._id}/reaction-status`, { autoRedirect: false });
          if (response.ok) {
            const data = await response.json();
            reactions[faq._id] = data.data.reaction;
          }
        } catch (error) {
          console.error(`Error checking reaction for FAQ ${faq._id}:`, error);
        }
      }
      setUserReactions(reactions);
    } catch (error) {
      console.error('Error checking user reactions:', error);
    }
  };

  const handleRating = async (faqId, type, e) => {
    e.stopPropagation(); // Prevent toggling accordion
    if (reactionLoading[faqId]) return;

    setReactionLoading(prev => ({ ...prev, [faqId]: true }));

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/faqs/${faqId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type })
      });

      if (response.ok) {
        const data = await response.json();

        // Update FAQ in the list
        setFaqs(prevFaqs =>
          prevFaqs.map(faq =>
            faq._id === faqId
              ? { ...faq, helpful: data.data.helpful, notHelpful: data.data.notHelpful }
              : faq
          )
        );

        // Update user reactions
        setUserReactions(prev => ({
          ...prev,
          [faqId]: data.data.reaction
        }));
      } else {
        if (response.status === 401) {
          toast.info('Please log in to rate this FAQ');
        } else {
          const errorData = await response.json();
          toast.error(errorData.message || 'Error rating FAQ');
        }
      }
    } catch (error) {
      console.error('Error rating FAQ:', error);
      toast.error('Error rating FAQ');
    } finally {
      setReactionLoading(prev => ({ ...prev, [faqId]: false }));
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchFAQs();
  };

  if (loading && faqs.length === 0) {
    return (
      <>
        <SEO
          title={seoTitle}
          description={seoDescription}
          keywords="real estate faqs, property help, UrbanSetu guide, verification help, rent lock info"
        />
        <PublicFAQsSkeleton />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans text-slate-800 dark:text-gray-100 pb-20 transition-colors duration-300">
      <SEO
        title={seoTitle}
        description={seoDescription}
        keywords="real estate faqs, property help, UrbanSetu guide, verification help, rent lock info"
      />
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white relative overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
          <div className="absolute top-[-50%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-400 blur-3xl animate-pulse"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-500 blur-3xl animate-pulse" style={{ animationDelay: "2s" }}></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pt-20 pb-24 relative z-30 text-center pointer-events-none">
          <span className="pointer-events-auto inline-block py-1 px-3 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-sm font-semibold mb-6 backdrop-blur-md">
            Help Center
          </span>
          <h1 className="pointer-events-auto text-4xl md:text-6xl font-extrabold mb-6 leading-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-100 drop-shadow-sm">
            Frequently Asked Questions
          </h1>
          <p className="pointer-events-auto text-lg md:text-xl text-blue-100 max-w-2xl mx-auto mb-10 leading-relaxed">
            Everything you need to know about UrbanSetu, properties, and managing your real estate journey.
          </p>

          {/* Search Bar in Hero */}
          <div className="pointer-events-auto max-w-2xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-purple-400 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-200"></div>
            <form onSubmit={handleSearch} className="relative z-50">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search for answers..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full pl-14 pr-6 py-5 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border border-white/20 dark:border-gray-700 rounded-2xl text-lg text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 shadow-2xl focus:outline-none focus:ring-2 focus:ring-blue-400/50 transition-all"
                />
                <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-6 h-6" />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 transition-colors shadow-lg"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              {/* Search Suggestions Panel */}
              {showSuggestions && searchTerm.trim().length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-slide-up-sm">
                  {suggestions.length > 0 ? (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {suggestions.map((suggestion) => (
                        <li key={suggestion._id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSearchTerm(suggestion.question);
                              setShowSuggestions(false);
                              setPagination(prev => ({ ...prev, current: 1 }));
                              // Trigger search immediately via effect
                            }}
                            className="w-full px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center justify-between group"
                          >
                            <span className="text-gray-700 dark:text-gray-200 font-medium line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {suggestion.question}
                            </span>
                            <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-all transform -translate-x-2 group-hover:translate-x-0" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                      No suggestions found
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-16 relative z-20">

        {/* Categories & Filter */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 mb-8 border border-gray-100 dark:border-gray-800 animate-fade-in-up transition-colors">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-semibold min-w-max transition-colors">
              <Filter className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              <span>Filter by Category:</span>
            </div>
            <div className="flex flex-wrap gap-2 w-full">
              <button
                onClick={() => toggleCategory('all')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${selectedCategories.length === 0
                  ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-md transform scale-105'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
              >
                All Categories
              </button>
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${selectedCategories.includes(category)
                    ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-md transform scale-105'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* FAQs List */}
        <div className="space-y-4">
          {faqs.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-16 text-center shadow-lg border border-gray-100 dark:border-gray-800 animate-fade-in-up transition-colors">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 transition-colors">
                <Search className="w-10 h-10 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">No results found</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto transition-colors">
                {searchTerm || selectedCategories.length > 0
                  ? 'We couldn\'t find any FAQs matching your search criteria. Try adjusting your filters.'
                  : 'No FAQs are universally available at the moment.'
                }
              </p>
              <button
                onClick={() => { setSearchTerm(''); setSelectedCategories([]); }}
                className="mt-6 px-6 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {faqs.map((faq, index) => (
                <div
                  key={faq._id}
                  className={`bg-white dark:bg-gray-900 rounded-2xl border transition-all duration-300 overflow-hidden ${expandedFAQ === faq._id
                    ? 'shadow-lg border-blue-200 dark:border-blue-900 ring-1 ring-blue-100 dark:ring-blue-900/40'
                    : 'shadow-sm border-gray-100 dark:border-gray-800 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700'
                    }`}
                  style={{ animation: `fadeIn 0.3s ease-out ${index * 0.05}s backwards` }}
                >
                  <button
                    onClick={() => handleFAQClick(faq._id)}
                    className="w-full px-6 py-5 text-left flex items-start justify-between gap-4 group"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider rounded-md border border-blue-100 dark:border-blue-800 transition-colors">
                          {faq.category}
                        </span>
                      </div>
                      <h3 className={`text-lg font-bold transition-colors ${expandedFAQ === faq._id ? 'text-blue-700 dark:text-blue-400' : 'text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>
                        {faq.question}
                      </h3>
                    </div>
                    <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${expandedFAQ === faq._id ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rotate-180' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-500 dark:group-hover:text-blue-300'
                      }`}>
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </button>

                  <div
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedFAQ === faq._id ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                      }`}
                  >
                    <div className="px-6 pb-6 pt-2">
                      <div className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300 leading-relaxed mb-4 transition-colors">
                        {faq.answer}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                        <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 transition-colors">
                          <Info className="w-3 h-3" />
                          Last updated: {new Date(faq.updatedAt).toLocaleDateString()}
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Was this helpful?</span>

                          <button
                            onClick={(e) => handleRating(faq._id, 'like', e)}
                            disabled={reactionLoading[faq._id]}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${userReactions[faq._id] === 'like'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                              : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-600 hover:text-green-600 dark:hover:text-green-400'
                              }`}
                          >
                            <ThumbsUp className={`w-4 h-4 ${userReactions[faq._id] === 'like' ? 'fill-current' : ''}`} />
                            <span>{faq.helpful || 0}</span>
                          </button>

                          <button
                            onClick={(e) => handleRating(faq._id, 'dislike', e)}
                            disabled={reactionLoading[faq._id]}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${userReactions[faq._id] === 'dislike'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                              : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-600 hover:text-red-600 dark:hover:text-red-400'
                              }`}
                          >
                            <ThumbsDown className={`w-4 h-4 ${userReactions[faq._id] === 'dislike' ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="mt-12 flex justify-center">
            <div className="flex items-center gap-2 bg-white dark:bg-gray-900 p-2 rounded-2xl shadow-md border border-gray-100 dark:border-gray-800 transition-colors">
              <button
                onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}
                disabled={pagination.current === 1}
                className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronDown className="w-5 h-5 rotate-90" />
              </button>

              <div className="flex items-center gap-1 font-medium px-2">
                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => setPagination(prev => ({ ...prev, current: page }))}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${pagination.current === page
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                    >
                      {page}
                    </button>
                  );
                })}
                {pagination.pages > 5 && <span className="text-gray-400 dark:text-gray-500">...</span>}
              </div>

              <button
                onClick={() => setPagination(prev => ({ ...prev, current: prev.current + 1 }))}
                disabled={pagination.current === pagination.pages}
                className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronDown className="w-5 h-5 -rotate-90" />
              </button>
            </div>
          </div>
        )}

        {/* CTA Section */}
        <div className="mt-16 mb-12 bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden relative group transition-colors">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 dark:bg-blue-400/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 dark:bg-purple-400/10 rounded-full blur-3xl -ml-16 -mb-16"></div>

          <div className="p-8 md:p-12 text-center relative z-10 transition-colors">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 shadow-sm transition-colors">
              <HelpCircle className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 transition-colors">Still have questions?</h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg max-w-2xl mx-auto mb-8 transition-colors">
              Can't find the answer you're looking for? Please chat to our friendly team.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/contact" className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/30">
                <MessageSquare className="w-5 h-5" />
                Contact Support
              </a>
              <a href="mailto:urbansetu.noreply@gmail.com" className="flex items-center justify-center gap-2 px-8 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                <Mail className="w-5 h-5" />
                Email Us
              </a>
            </div>
          </div>
        </div>

      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default PublicFAQs;
