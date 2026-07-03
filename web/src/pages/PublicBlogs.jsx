import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import PublicBlogsSkeleton from '../components/skeletons/PublicBlogsSkeleton';
import { toast } from 'react-hot-toast';
import {
  Search as SearchIcon, Filter, Calendar, User, Eye, Heart, Tag,
  ArrowRight, ChevronLeft, ChevronRight, Mail, Info, Clock,
  TrendingUp, Lightbulb, Home, CheckCircle, X, BookOpen, RotateCcw, Star
} from 'lucide-react';

import SEO from '../components/SEO';
import { authenticatedFetch } from '../utils/auth';
import RecaptchaWidget from '../components/RecaptchaWidget';
import { useRef } from 'react';
import AdvancedImage from '../components/AdvancedImage';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';

const PublicBlogs = () => {
  // SEO Dynamic Tags
  const seoTitle = "Real Estate Blogs & Insights";
  const seoDescription = "Stay updated with the latest real estate trends, market analysis, and property buying tips on UrbanSetu's expert blog portal.";

  const [blogs, setBlogs] = useState([]);
  const [upcomingPost, setUpcomingPost] = useState(null);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [featuredBlogs, setFeaturedBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showLikedOnly, setShowLikedOnly] = useState(false);

  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { currentUser } = useSelector((state) => state.user);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null); // 'pending', 'approved', 'rejected', 'revoked', 'opted_out', 'not_subscribed'

  // Subscription OTP State
  const [subscribeStep, setSubscribeStep] = useState('INPUT_EMAIL'); // 'INPUT_EMAIL', 'VERIFY_OTP'
  const [subscribeOtp, setSubscribeOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  // Unsubscribe OTP State
  const [showOptOutModal, setShowOptOutModal] = useState(false);
  const [optOutReason, setOptOutReason] = useState('');
  const [unsubscribeStep, setUnsubscribeStep] = useState('REASON'); // 'REASON', 'VERIFY_OTP'
  const [unsubscribeOtp, setUnsubscribeOtp] = useState('');
  const [otpError, setOtpError] = useState(''); // Error message for OTP verification
  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // reCAPTCHA states
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [showRecaptcha, setShowRecaptcha] = useState(false);
  const [requiresCaptcha, setRequiresCaptcha] = useState(false);
  const [recaptchaKey, setRecaptchaKey] = useState(0);
  const recaptchaRef = useRef(null);

  // Unsubscribe reCAPTCHA states
  const [unsubRecaptchaToken, setUnsubRecaptchaToken] = useState(null);
  const [showUnsubRecaptcha, setShowUnsubRecaptcha] = useState(false);
  const [unsubRequiresCaptcha, setUnsubRequiresCaptcha] = useState(false);
  const [unsubRecaptchaKey, setUnsubRecaptchaKey] = useState(0);
  const unsubRecaptchaRef = useRef(null);

  // Timer effect for resend OTP
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prevTimer) => {
          if (prevTimer <= 1) {
            setCanResend(true);
            return 0;
          }
          return prevTimer - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://urbansetu-pvt4.onrender.com';


  // Separate useEffect for initial load and categories/tags
  useEffect(() => {
    fetchFeaturedBlogs();
    fetchBlogs(1, false);
    fetchCategories();
    fetchTags();
    fetchUpcomingPost();

    if (currentUser) {
      fetchSubscriptionStatus();
      setEmail(currentUser.email); // Default to current user's email but allow editing
    } else {
      const subscribed = localStorage.getItem('newsletter_subscribed');
      if (subscribed) {
        setIsSubscribed(true);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (!upcomingPost || !upcomingPost.scheduledAt) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const target = new Date(upcomingPost.scheduledAt).getTime();
      const diff = target - now;

      if (diff <= 0) {
        clearInterval(timer);
        setUpcomingPost(null);
        fetchBlogs(1, false);
        fetchFeaturedBlogs();
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [upcomingPost]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim().length > 0) {
        setShowLikedOnly(false);
        fetchSuggestions();
      } else {
        setSuggestions([]);
      }
      fetchBlogs(1, false);
    }, 500); // 500ms debounce

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

  // Immediate filter effects for category, tag, and liked feed changes
  useEffect(() => {
    fetchBlogs(1, false);
  }, [selectedCategories, selectedTags, showLikedOnly]);

  // Infinite scroll observer effect
  useEffect(() => {
    if (!hasMore || loadingMore || loading) return;

    const observer = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (first.isIntersecting) {
        fetchBlogs(pagination.current + 1, true);
      }
    }, {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    });

    const target = document.getElementById('infinite-scroll-trigger');
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [hasMore, loadingMore, loading, pagination.current]);

  const toggleCategory = (category) => {
    setShowLikedOnly(false);
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

  const toggleTag = (tag) => {
    setShowLikedOnly(false);
    if (tag === 'all') {
      setSelectedTags([]);
      return;
    }
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/subscription/my-status`, { autoRedirect: false });
      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.status) {
          // If approved but not subscribed to BLOG, treat as not subscribed
          if (data.data.status === 'approved' && (!data.data.preferences || !data.data.preferences.blog)) {
            // Check if they have a pending blog request while already being approved for something else
            if (data.data.pendingPreferences?.blog) {
              setSubscriptionStatus('pending');
            } else {
              setSubscriptionStatus('not_subscribed');
            }
          }
          // If pending, check if it's specifically for blog (modern or legacy)
          else if (data.data.status === 'pending') {
            if (data.data.pendingPreferences?.blog || data.data.preferences?.blog) {
              setSubscriptionStatus('pending');
            } else {
              setSubscriptionStatus('not_subscribed');
            }
          }
          // If verifying (OTP sent), treat as not subscribed in this check.
          // The local UI state 'subscribeStep' handles showing the OTP input on the current page.
          // This also prevents a Guide verification from showing "Verifying" on the Blogs page.
          else if (data.data.status === 'verifying') {
            setSubscriptionStatus('not_subscribed');
          }
          else {
            setSubscriptionStatus(data.data.status);
          }
        } else {
          setSubscriptionStatus('not_subscribed');
        }
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error);
    }
  };

  const handleSendSubscribeOtp = async () => {
    setOtpError('');
    // Always validate the email field, regardless of login status
    if (!email || !email.includes('@')) {
      setOtpError('Please enter a valid email address');
      return;
    }

    if (requiresCaptcha && !recaptchaToken) {
      setOtpError('Please verify you are not a robot');
      setShowRecaptcha(true);
      return;
    }

    // Always use the email field value, not currentUser.email
    // This allows logged-in users to subscribe with a different email
    setSendingOtp(true);

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/subscription/send-subscribe-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          source: 'blogs_page',
          ...(recaptchaToken && { recaptchaToken })
        })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(data.message);
        setSubscribeStep('VERIFY_OTP');
        setResendTimer(30);
        setCanResend(false);
        setRequiresCaptcha(false);
        setRecaptchaToken(null);
      } else {
        if (data.requiresCaptcha) {
          setRequiresCaptcha(true);
          setShowRecaptcha(true);
          setOtpError('reCAPTCHA verification is required');
        } else {
          setOtpError(data.message || 'Failed to send OTP');
          toast.error(data.message || 'Failed to send OTP');
        }
      }
    } catch (error) {
      setOtpError('Failed to send OTP. Please try again.');
      toast.error('Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifySubscribeOtp = async () => {
    setOtpError('');
    if (!subscribeOtp) {
      setOtpError('Please enter OTP');
      return;
    }

    // Use the email field value, not currentUser.email
    setVerifyingOtp(true);

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/subscription/verify-subscribe-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, otp: subscribeOtp, source: 'blogs_page' })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(data.message);
        localStorage.setItem('newsletter_subscribed', 'true');
        setIsSubscribed(true);
        if (currentUser) fetchSubscriptionStatus();
        setSubscribeStep('INPUT_EMAIL');
        setSubscribeOtp('');
      } else {
        if (data.message && data.message.toLowerCase().includes("too many failed attempts")) {
          setOtpError("Too many failed attempts. Please try again in 15 minutes.");
        } else {
          setOtpError(data.message || 'Invalid OTP');
          toast.error(data.message || 'Verification failed');
        }
      }
    } catch (error) {
      setOtpError('Verification failed. Please try again.');
      toast.error('Verification failed');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleUnsubscribeClick = () => {
    setShowOptOutModal(true);
    setOptOutReason('');
    setUnsubscribeStep('REASON');
    setUnsubscribeOtp('');
  };

  const handleSendUnsubscribeOtp = async () => {
    setOtpError('');

    if (unsubRequiresCaptcha && !unsubRecaptchaToken) {
      setOtpError('Please verify you are not a robot');
      setShowUnsubRecaptcha(true);
      return;
    }

    setSendingOtp(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/subscription/send-unsubscribe-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(unsubRecaptchaToken && { recaptchaToken: unsubRecaptchaToken })
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success('OTP sent for verification');
        setUnsubscribeStep('VERIFY_OTP');
        setResendTimer(30);
        setCanResend(false);
        setUnsubRequiresCaptcha(false);
        setUnsubRecaptchaToken(null);
      } else {
        if (data.requiresCaptcha) {
          setUnsubRequiresCaptcha(true);
          setShowUnsubRecaptcha(true);
          setOtpError('reCAPTCHA verification is required');
        } else {
          setOtpError(data.message || 'Failed to send OTP');
          toast.error(data.message || 'Failed to send OTP');
        }
      }
    } catch (error) {
      setOtpError('Failed to send OTP');
      toast.error('Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyUnsubscribeOtp = async () => {
    setOtpError(''); // Clear any previous errors
    setVerifyingOtp(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/subscription/verify-unsubscribe-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: currentUser?.email, reason: optOutReason, otp: unsubscribeOtp })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success('Unsubscribed successfully');
        setSubscriptionStatus('opted_out');
        setIsSubscribed(false);
        localStorage.removeItem('newsletter_subscribed');
        setShowOptOutModal(false);
        setOptOutReason('');
        setUnsubscribeOtp('');
        setUnsubscribeStep('REASON');
        setOtpError('');
      } else {
        if (data.message && data.message.toLowerCase().includes("too many failed attempts")) {
          setOtpError("Too many failed attempts. Please try again in 15 minutes.");
        } else {
          const errorMsg = data.message || 'Invalid OTP. Please try again.';
          setOtpError(errorMsg);
          toast.error(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = 'Failed to verify OTP. Please try again.';
      setOtpError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const fetchUpcomingPost = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs?scheduled=true&type=blog&limit=1`, { autoRedirect: false });
      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.length > 0) {
          setUpcomingPost(data.data[0]);
        } else {
          setUpcomingPost(null);
        }
      }
    } catch (err) {
      console.error('Error fetching upcoming post:', err);
    }
  };

  const fetchBlogs = async (pageNumber = 1, isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      const params = new URLSearchParams({
        page: pageNumber,
        limit: 9
      });

      let endpoint = `${API_BASE_URL}/api/blogs`;

      if (showLikedOnly) {
        endpoint = `${API_BASE_URL}/api/blogs/user/liked`;
        params.append('type', 'blog');
      } else {
        params.append('published', 'true');
        params.append('type', 'blog');
        if (searchTerm) params.append('search', searchTerm);
        if (selectedCategories.length > 0) {
          params.append('category', selectedCategories.join(','));
        }
        if (selectedTags.length > 0) {
          params.append('tag', selectedTags.join(','));
        }
      }

      const response = await authenticatedFetch(`${endpoint}?${params}`, { autoRedirect: false });

      if (response.ok) {
        const data = await response.json();
        if (isLoadMore) {
          setBlogs(prev => {
            const existingIds = new Set(prev.map(b => b._id));
            const newBlogs = data.data.filter(b => !existingIds.has(b._id));
            return [...prev, ...newBlogs];
          });
        } else {
          setBlogs(data.data);
        }
        setPagination(data.pagination);
        setHasMore(data.pagination.current < data.pagination.pages);
      }
    } catch (error) {
      console.error('Error fetching blogs:', error);
    } finally {
      if (isLoadMore) {
        setLoadingMore(false);
      } else {
        setLoading(false);
        setIsInitialLoad(false);
      }
    }
  };

  const fetchFeaturedBlogs = async () => {
    try {
      const params = new URLSearchParams({
        published: 'true',
        type: 'blog',
        featured: 'true',
        limit: 3
      });
      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs?${params}`, { autoRedirect: false });
      if (response.ok) {
        const data = await response.json();
        setFeaturedBlogs(data.data);
      }
    } catch (error) {
      console.error('Error fetching featured blogs:', error);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const params = new URLSearchParams({
        published: 'true',
        type: 'blog',
        search: searchTerm,
        limit: 5
      });

      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs?${params}`, { autoRedirect: false });

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
      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs/categories?type=blog`, { autoRedirect: false });
      if (response.ok) {
        const data = await response.json();
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs/tags?type=blog`, { autoRedirect: false });
      if (response.ok) {
        const data = await response.json();
        setTags(data.data);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchBlogs();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const truncateText = (text, maxLength) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  if (loading && blogs.length === 0) {
    return <PublicBlogsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col font-sans text-slate-800 dark:text-gray-100 transition-colors duration-300">
      <SEO
        title={seoTitle}
        description={seoDescription}
        keywords="real estate blog, Hyderabad property trends, house buying tips, investment insights"
      />
      {/* Search Header / Hero */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 pb-24 pt-12 px-4 shadow-lg mb-8 relative overflow-hidden">
        {/* Abstract shapes for visual interest */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
          <div className="absolute top-[-50%] left-[-10%] w-[500px] h-[500px] rounded-full bg-white mix-blend-overlay filter blur-3xl animate-float"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-300 mix-blend-overlay filter blur-3xl animate-float" style={{ animationDelay: "2s" }}></div>
          <div className="absolute top-[20%] right-[30%] w-[300px] h-[300px] rounded-full bg-indigo-400 mix-blend-overlay filter blur-3xl animate-float" style={{ animationDelay: "4s" }}></div>
        </div>

        <div className="max-w-7xl mx-auto text-center relative z-20 animate-slideInFromTop">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4 tracking-tight drop-shadow-md">
            Real Estate <span className="text-yellow-300">Insights</span>
          </h1>
          <p className="text-blue-100 mb-4 text-lg max-w-2xl mx-auto font-light leading-relaxed">
            Stay updated with expert analysis, market trends, and property tips to make informed decisions.
          </p>

          {/* Navigation Button */}
          <div className="mb-8 flex justify-center">
            <Link
              to="/guides"
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 flex items-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              Explore Guides
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <span className="px-4 py-2 bg-white/10 backdrop-blur-md text-white rounded-full text-sm font-medium border border-white/20 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-300" /> Tips & Tricks
            </span>
            <span className="px-4 py-2 bg-white/10 backdrop-blur-md text-white rounded-full text-sm font-medium border border-white/20 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-300" /> Market Trends
            </span>
            <span className="px-4 py-2 bg-white/10 backdrop-blur-md text-white rounded-full text-sm font-medium border border-white/20 flex items-center gap-2">
              <Home className="w-4 h-4 text-blue-300" /> Investing
            </span>
          </div>

          {/* Search Bar in Hero */}
          <div className="max-w-3xl mx-auto relative group">
            <form onSubmit={handleSearch}>
              <div className="relative search-container">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                  <SearchIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Search articles, topics, or keywords..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="block w-full pl-12 pr-4 py-4 border-none rounded-2xl bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 shadow-2xl transition-all text-lg relative"
                />
                <button type="submit" className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-xl font-medium transition-colors shadow-md z-10">
                  Search
                </button>

                {/* Suggestions Dropdown */}
                {showSuggestions && searchTerm.trim().length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-fade-in-up">
                    {suggestions.length > 0 ? (
                      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                        {suggestions.map((suggestion) => (
                          <li key={suggestion._id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSearchTerm(suggestion.title);
                                setShowSuggestions(false);
                                setPagination(prev => ({ ...prev, current: 1 }));
                              }}
                              className="w-full px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center justify-between group"
                            >
                              <div>
                                <h4 className="font-bold text-gray-800 dark:text-gray-200 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                  {suggestion.title}
                                </h4>
                                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                                  {suggestion.category}
                                </span>
                              </div>
                              <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-all transform -translate-x-2 group-hover:translate-x-0" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                        No articles found matching "{searchTerm}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl mx-auto px-4 w-full -mt-20 relative z-10 pb-20">

        {/* Stay Tuned Countdown for Scheduled Post */}
        {upcomingPost && (new Date(upcomingPost.scheduledAt).getTime() - new Date().getTime() < 24 * 60 * 60 * 1000) && (
          <div className="bg-gradient-to-r from-blue-900/60 via-indigo-900/60 to-purple-900/60 backdrop-blur-md border border-indigo-500/30 rounded-3xl p-6 md:p-8 mb-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl animate-fade-in-up">
            {/* Background glowing decorations */}
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-pink-500/10 rounded-full blur-2xl animate-pulse"></div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            
            <div className="relative z-10 text-center md:text-left flex-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30 animate-pulse uppercase tracking-wider mb-4">
                <Clock className="w-3.5 h-3.5 animate-[spin_8s_linear_infinite]" /> STAY TUNED
              </span>
              <h3 className="text-xl md:text-3xl font-black text-white leading-tight mb-2 tracking-tight">
                Next Story Arriving Soon!
              </h3>
              <p className="text-gray-300 font-medium text-sm md:text-base break-words">
                "{upcomingPost.title}"
              </p>
            </div>

            <div className="relative z-10 flex items-center gap-2 md:gap-3">
              <div className="flex flex-col items-center bg-black/40 border border-white/10 px-3.5 md:px-5 py-3 rounded-2xl min-w-[64px] md:min-w-[76px] shadow-lg">
                <span className="text-2xl md:text-3xl font-black text-white tracking-tight leading-none mb-1">{timeLeft.days}</span>
                <span className="text-[9px] md:text-[10px] uppercase font-bold text-gray-400 tracking-wider">Days</span>
              </div>
              <span className="text-2xl font-bold text-white/40 leading-none -translate-y-1">:</span>
              <div className="flex flex-col items-center bg-black/40 border border-white/10 px-3.5 md:px-5 py-3 rounded-2xl min-w-[64px] md:min-w-[76px] shadow-lg">
                <span className="text-2xl md:text-3xl font-black text-white tracking-tight leading-none mb-1">{timeLeft.hours}</span>
                <span className="text-[9px] md:text-[10px] uppercase font-bold text-gray-400 tracking-wider">Hours</span>
              </div>
              <span className="text-2xl font-bold text-white/40 leading-none -translate-y-1">:</span>
              <div className="flex flex-col items-center bg-black/40 border border-white/10 px-3.5 md:px-5 py-3 rounded-2xl min-w-[64px] md:min-w-[76px] shadow-lg">
                <span className="text-2xl md:text-3xl font-black text-white tracking-tight leading-none mb-1">{timeLeft.minutes}</span>
                <span className="text-[9px] md:text-[10px] uppercase font-bold text-gray-400 tracking-wider">Mins</span>
              </div>
              <span className="text-2xl font-bold text-white/40 leading-none -translate-y-1">:</span>
              <div className="flex flex-col items-center bg-pink-600/20 border border-pink-500/30 px-3.5 md:px-5 py-3 rounded-2xl min-w-[64px] md:min-w-[76px] shadow-lg animate-pulse">
                <span className="text-2xl md:text-3xl font-black text-pink-400 tracking-tight leading-none mb-1">{timeLeft.seconds}</span>
                <span className="text-[9px] md:text-[10px] uppercase font-bold text-pink-300 tracking-wider">Secs</span>
              </div>
            </div>
          </div>
        )}

        {/* Filters Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-6 mb-8 animate-fade-in-up transition-colors">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Categories */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">
                <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Categories</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => toggleCategory('all')}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${selectedCategories.length === 0 && !showLikedOnly
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/40'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                  All
                </button>
                {currentUser && (
                  <button
                    onClick={() => {
                      setSelectedCategories([]);
                      setSelectedTags([]);
                      setShowLikedOnly(!showLikedOnly);
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 ${showLikedOnly
                      ? 'bg-red-600 text-white shadow-md shadow-red-200 dark:shadow-red-900/40'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400'
                      }`}
                  >
                    <Heart className={`w-4 h-4 ${showLikedOnly ? 'fill-current' : ''}`} /> Liked Blogs
                  </button>
                )}
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${selectedCategories.includes(category)
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/40'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                      }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="flex-1 border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-gray-800 pt-6 lg:pt-0 lg:pl-8 transition-colors">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">
                <Tag className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Popular Tags</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => toggleTag('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${selectedTags.length === 0
                    ? 'bg-green-600 text-white shadow-md shadow-green-200 dark:shadow-green-900/40'
                    : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40'
                    }`}
                >
                  All
                </button>
                {tags.slice(0, 10).map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${selectedTags.includes(tag)
                      ? 'bg-green-600 text-white shadow-md shadow-green-200 dark:shadow-green-900/40'
                      : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40'
                      }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Featured Blogs Section */}
        {featuredBlogs.length > 0 && !searchTerm && selectedCategories.length === 0 && selectedTags.length === 0 && pagination.current === 1 && (
          <div className="mb-16 animate-fade-in-up">
            <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-6 flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" /> Featured Insights
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredBlogs.map((blog, idx) => (
                <Link to={`/blog/${blog.slug || blog._id}`} key={blog._id} className="group relative h-96 rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 cursor-pointer border border-gray-100 dark:border-gray-800">
                  <AdvancedImage
                    src={blog.thumbnail || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1073&q=80'}
                    alt={blog.title}
                    className="absolute inset-0 w-full h-full transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 p-8 w-full">
                    <div className="flex items-center gap-3 text-xs font-bold text-blue-300 uppercase tracking-wider mb-3">
                      <span className="bg-blue-600/90 backdrop-blur-md px-2 py-1 rounded-md">{blog.category}</span>
                      <span>•</span>
                      <span>{Math.ceil((blog.content ? blog.content.split(/\s+/).length : 0) / 200)} min read</span>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-blue-300 transition-colors leading-tight line-clamp-2">
                      {blog.title}
                    </h3>
                    <p className="text-gray-300 text-sm line-clamp-2 mb-4 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                      {blog.excerpt || (blog.content ? blog.content.substring(0, 100) : '')}
                    </p>
                    <div className="flex items-center gap-2 text-white font-bold text-sm">
                      Read Article <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Blogs Grid */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black text-gray-800 dark:text-white capitalize">
              {showLikedOnly ? 'My Liked Blogs' : (selectedCategories.length === 0 ? 'Latest Blogs' : `${selectedCategories.join(', ')} Blogs`)}
            </h2>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {pagination.total} articles found
            </span>
          </div>

          {blogs.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-16 text-center animate-fade-in-up transition-colors">
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${showLikedOnly ? 'bg-red-50 dark:bg-red-950/30' : 'bg-blue-50 dark:bg-blue-900/30'}`}>
                {showLikedOnly ? (
                  <Heart className="w-10 h-10 text-red-500" />
                ) : (
                  <SearchIcon className="w-10 h-10 text-blue-400 dark:text-blue-300" />
                )}
              </div>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2 transition-colors">
                {showLikedOnly ? 'No liked blogs yet' : 'No articles found'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto transition-colors">
                {showLikedOnly 
                  ? 'Articles you like will appear here. Start exploring and click the heart icon on any blog detail page!'
                  : "We couldn't find any blog posts matching your criteria. Try different keywords or filters."}
              </p>
              <button
                onClick={() => {
                  if (showLikedOnly) {
                    setShowLikedOnly(false);
                  } else {
                    setSearchTerm('');
                    setSelectedCategories([]);
                    setSelectedTags([]);
                  }
                }}
                className={`inline-flex items-center gap-2 px-6 py-3 text-white rounded-xl font-semibold transition-colors shadow-lg ${
                  showLikedOnly 
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-200 dark:shadow-red-900/40' 
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 dark:shadow-blue-900/40'
                }`}
              >
                {showLikedOnly ? 'Explore Blogs' : 'Clear Filters'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {blogs.map((blog, index) => (
                <article
                  key={blog._id}
                  className="bg-white dark:bg-gray-900 rounded-2xl shadow-md hover:shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden transition-all duration-500 group flex flex-col h-full animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {/* Thumbnail */}
                  <div className="relative overflow-hidden h-56 flex-shrink-0">
                    {blog.thumbnail ? (
                      <AdvancedImage
                        src={blog.thumbnail}
                        alt={blog.title}
                        className="w-full h-full transition-transform duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-50 dark:bg-gray-900/40 flex items-center justify-center transition-colors duration-300">
                        <div className="text-center text-gray-400 dark:text-gray-500 flex flex-col items-center">
                          <div className="text-3xl opacity-80">🏠</div>
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                    <div className="absolute top-4 left-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white/90 backdrop-blur-md text-blue-600 shadow-lg">
                        {blog.category}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 flex-grow flex flex-col">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3 line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      <Link to={`/blog/${blog.slug || blog._id}`}>
                        {blog.title}
                      </Link>
                    </h2>

                    <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-3 text-sm flex-grow leading-relaxed transition-colors">
                      {truncateText(blog.excerpt || blog.content, 120)}
                    </p>

                    <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-auto transition-colors">
                      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs transition-colors">
                            {blog.author?.username?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <span className="font-medium truncate max-w-[100px]">{blog.author?.username || 'Team'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1" title="Views">
                            <Eye className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                            <span>{blog.views || 0}</span>
                          </div>
                          <div className="flex items-center gap-1" title="Likes">
                            <Heart className="w-4 h-4 text-red-400 dark:text-red-500" />
                            <span>{blog.likes || 0}</span>
                          </div>
                          <div className="flex items-center gap-1" title="Date">
                            <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                            <span>{new Date(blog.publishedAt || blog.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                          </div>
                        </div>
                      </div>

                      {/* Tags Preview */}
                      {blog.tags && blog.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {blog.tags.slice(0, 2).map((tag, idx) => (
                            <span key={idx} className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs px-2 py-1 rounded-md flex items-center gap-1 transition-colors">
                              <Tag className="w-3 h-3" /> {tag}
                            </span>
                          ))}
                          {blog.tags.length > 2 && (
                            <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs px-2 py-1 rounded-md transition-colors">+{blog.tags.length - 2}</span>
                          )}
                        </div>
                      )}

                      <Link
                        to={`/blog/${blog.slug || blog._id}`}
                        className="flex items-center justify-center w-full gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white dark:hover:text-white transition-all duration-300 group-hover:shadow-md"
                      >
                        Read Article <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        {/* Infinite Scroll Trigger and Skeleton */}
        {hasMore && (
          <div id="infinite-scroll-trigger" className="pt-4 pb-8 flex justify-center w-full">
            {loadingMore && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full mt-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-full animate-pulse transition-colors duration-300">
                    <div className="h-56 bg-gray-200 dark:bg-gray-700 transition-colors duration-300"></div>
                    <div className="p-6 flex-grow flex flex-col">
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3 transition-colors duration-300"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2 transition-colors duration-300"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-4 transition-colors duration-300"></div>
                      <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-auto">
                        <div className="flex justify-between mb-4">
                          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded transition-colors duration-300"></div>
                          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded transition-colors duration-300"></div>
                        </div>
                        <div className="flex gap-2 mb-4">
                          <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded transition-colors duration-300"></div>
                          <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded transition-colors duration-300"></div>
                        </div>
                        <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded-xl transition-colors duration-300"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Newsletter CTA */}
        <div className="mt-20 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 md:p-12 text-center text-white shadow-2xl relative overflow-hidden animate-fade-in-up">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 translate-y-1/2 -translate-x-1/3"></div>

          <div className="relative z-10 max-w-3xl mx-auto">
            <div className="inline-block p-3 bg-white/10 rounded-2xl mb-6 backdrop-blur-sm">
              <Mail className="w-8 h-8 text-blue-300" />
            </div>
            {(() => {
              const hasActiveSub = isSubscribed || (currentUser && subscriptionStatus && ['approved', 'pending'].includes(subscriptionStatus));

              if (hasActiveSub) {
                return (
                  <>
                    <h3 className="text-3xl md:text-4xl font-bold mb-4">
                      {subscriptionStatus === 'pending' ? "Almost Ready!" : "Welcome to the Community"}
                    </h3>
                    <p className="text-slate-300 mb-8 max-w-2xl mx-auto text-lg">
                      {subscriptionStatus === 'pending'
                        ? "Your request is being processed. You'll start receiving insights as soon as it's approved."
                        : "You're all set! You'll now receive our deep-dive market analysis and real estate trends directly."}
                    </p>
                  </>
                );
              }

              return (
                <>
                  <h3 className="text-3xl md:text-4xl font-bold mb-4">
                    Get insights delivered to your inbox
                  </h3>
                  <p className="text-slate-300 mb-8 max-w-2xl mx-auto text-lg">
                    Join our weekly newsletter to get the latest real estate trends, investment tips, and market analysis.
                  </p>
                </>
              );
            })()}
            {currentUser && subscriptionStatus && subscriptionStatus !== 'not_subscribed' ? (
              <div className="bg-white/10 backdrop-blur-md border border-blue-500/30 rounded-2xl p-6 inline-flex flex-col items-center animate-fade-in-up">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-lg 
                   ${subscriptionStatus === 'approved' ? 'bg-green-500 shadow-green-500/20' :
                    subscriptionStatus === 'pending' ? 'bg-orange-500 shadow-orange-500/20' :
                      subscriptionStatus === 'rejected' ? 'bg-red-500 shadow-red-500/20' :
                        'bg-gray-500 shadow-gray-500/20'}`}>
                  {subscriptionStatus === 'approved' ? <CheckCircle className="w-8 h-8 text-white" /> :
                    subscriptionStatus === 'pending' ? <Clock className="w-8 h-8 text-white" /> :
                      <Info className="w-8 h-8 text-white" />}
                </div>
                <h3 className="text-xl font-bold text-white mb-2 capitalize">
                  {subscriptionStatus === 'approved' ? 'Subscribed' : subscriptionStatus.replace('_', ' ')}
                </h3>
                <p className="text-gray-300 mb-4">
                  {/* Derived Status Message */}
                  {(() => {
                    if (subscriptionStatus === 'pending') return 'Your blog subscription is awaiting approval.';
                    if (subscriptionStatus === 'approved') return 'You will receive updates for new blogs.';
                    if (subscriptionStatus === 'rejected') return 'Your subscription was unfortunately rejected.';
                    if (subscriptionStatus === 'revoked') return 'Your subscription has been revoked.';
                    if (subscriptionStatus === 'opted_out') return 'You have opted out of emails.';
                    return '';
                  })()}
                </p>

                {subscriptionStatus === 'approved' && (
                  <button
                    onClick={handleUnsubscribeClick}
                    className="px-4 py-2 bg-red-500/80 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors border border-red-400/30"
                  >
                    Unsubscribe
                  </button>
                )}
                {subscriptionStatus === 'opted_out' && (
                  <button
                    onClick={() => {
                      // Reset states to show subscription flow properly
                      setSubscriptionStatus(null);
                      setSubscribeStep('INPUT_EMAIL');
                      setEmail(currentUser?.email || '');
                      // Send OTP after resetting states
                      setTimeout(() => handleSendSubscribeOtp(), 100);
                    }}
                    className="px-4 py-2 bg-blue-500/80 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors border border-blue-400/30"
                  >
                    Resubscribe
                  </button>
                )}
              </div>
            ) : isSubscribed ? (
              <div className="bg-white/10 backdrop-blur-md border border-blue-500/30 rounded-2xl p-6 inline-flex flex-col items-center animate-fade-in-up">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">You're Subscribed!</h3>
                <p className="text-gray-300">Keep an eye on your inbox for our next blog post.</p>
              </div>
            ) : (
              /* Subscription Box - Clean and Merged */
              !isSubscribed && subscriptionStatus !== 'pending' && subscriptionStatus !== 'approved' && (
                <div className="max-w-md mx-auto animate-fade-in-up">
                  {subscribeStep === 'INPUT_EMAIL' ? (
                    <>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="email"
                          placeholder="Enter your email address"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setOtpError('');
                          }}
                          className={`flex-1 px-6 py-4 rounded-xl bg-white/10 backdrop-blur border ${otpError ? 'border-red-400' : 'border-white/20'} text-white placeholder-slate-400 focus:outline-none focus:bg-white/20 focus:border-white/40 transition-all font-medium`}
                        />
                        <button
                          onClick={handleSendSubscribeOtp}
                          disabled={sendingOtp || (requiresCaptcha && !recaptchaToken)}
                          className="px-8 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all transform hover:scale-105 shadow-lg shadow-blue-900/40 disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap min-w-[140px] flex items-center justify-center gap-2"
                        >
                          {sendingOtp ? (
                            <>
                              <UrbanSetuSpinner size="sm" isBright={true} />
                              <span>Sending...</span>
                            </>
                          ) : 'Subscribe'}
                        </button>
                      </div>

                      {showRecaptcha && (
                        <div className="mt-4 flex justify-center">
                          <RecaptchaWidget
                            key={recaptchaKey}
                            onVerify={(token) => {
                              setRecaptchaToken(token);
                              setOtpError('');
                            }}
                            onExpire={() => {
                              setRecaptchaToken(null);
                              setRecaptchaKey(k => k + 1);
                            }}
                            onError={() => {
                              setRecaptchaToken(null);
                              setRecaptchaKey(k => k + 1);
                            }}
                          />
                        </div>
                      )}

                      {otpError && <p className="text-red-300 text-sm mt-2 text-center font-medium animate-pulse">{otpError}</p>}
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col sm:flex-row gap-3 animate-fade-in">
                        <input
                          type="text"
                          placeholder="Enter OTP"
                          value={subscribeOtp}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            setSubscribeOtp(value);
                            setOtpError('');
                          }}
                          maxLength={6}
                          className={`flex-1 px-6 py-4 rounded-xl bg-white/10 backdrop-blur border ${otpError ? 'border-red-400' : 'border-white/20'} text-white placeholder-slate-400 focus:outline-none focus:bg-white/20 focus:border-white/40 transition-all font-medium text-center tracking-widest text-xl`}
                        />
                        <button
                          onClick={handleVerifySubscribeOtp}
                          disabled={verifyingOtp || sendingOtp}
                          className="px-8 py-4 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-all transform hover:scale-105 shadow-lg shadow-blue-900/20 disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap min-w-[120px] flex items-center justify-center gap-2"
                        >
                          {verifyingOtp ? (
                            <>
                              <UrbanSetuSpinner size="sm" />
                              <span>Verifying...</span>
                            </>
                          ) : 'Verify'}
                        </button>
                      </div>
                      {otpError && <p className="text-red-300 text-sm mt-2 text-center font-medium animate-pulse">{otpError}</p>}
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                          {resendTimer > 0 ? (
                            <span className="text-sm text-blue-100 italic transition-all animate-pulse">
                              Resend OTP in {resendTimer}s
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={handleSendSubscribeOtp}
                              disabled={sendingOtp || verifyingOtp || !canResend}
                              className="text-sm text-white hover:text-blue-100 font-bold underline transition-colors disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {sendingOtp ? (
                                <UrbanSetuSpinner size="sm" isBright={true} />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                              {sendingOtp ? 'Sending...' : 'Resend OTP'}
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setSubscribeStep('INPUT_EMAIL');
                            setResendTimer(0);
                            setCanResend(true);
                          }}
                          className="text-sm text-white/70 hover:text-white font-medium underline transition-colors"
                        >
                          Change Email
                        </button>
                      </div>
                    </>
                  )}
                  <p className="mt-6 text-sm text-slate-400 text-center">
                    Join 10,000+ subscribers for weekly updates. No spam, ever.
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </main >
      {/* Opt-Out Modal */}
      {
        showOptOutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Unsubscribe</h3>
                  <button onClick={() => setShowOptOutModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {unsubscribeStep === 'REASON'
                    ? "We're sorry to see you go! Please let us know why you are unsubscribing (optional):"
                    : `We've sent a verification code to your email. Please enter it below to confirm unsubscription.`}
                </p>

                {unsubscribeStep === 'REASON' ? (
                  <>
                    <textarea
                      value={optOutReason}
                      onChange={(e) => setOptOutReason(e.target.value)}
                      placeholder="Reason for unsubscribing..."
                      className="w-full h-32 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white text-sm mb-4"
                    />

                    {showUnsubRecaptcha && (
                      <div className="mb-4 flex justify-center">
                        <RecaptchaWidget
                          key={unsubRecaptchaKey}
                          onVerify={(token) => {
                            setUnsubRecaptchaToken(token);
                            setOtpError('');
                          }}
                          onExpire={() => {
                            setUnsubRecaptchaToken(null);
                            setUnsubRecaptchaKey(k => k + 1);
                          }}
                          onError={() => {
                            setUnsubRecaptchaToken(null);
                            setUnsubRecaptchaKey(k => k + 1);
                          }}
                        />
                      </div>
                    )}

                    {otpError && <p className="text-red-600 dark:text-red-400 text-xs mt-1 mb-4 text-center font-medium animate-pulse">{otpError}</p>}

                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setShowOptOutModal(false)}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        disabled={sendingOtp}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSendUnsubscribeOtp}
                        disabled={sendingOtp || (unsubRequiresCaptcha && !unsubRecaptchaToken)}
                        className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-70 flex items-center justify-center gap-2 min-w-[80px]"
                      >
                        {sendingOtp ? (
                          <>
                            <UrbanSetuSpinner size="sm" isBright={true} />
                            <span>Sending...</span>
                          </>
                        ) : 'Next'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-4">
                      <input
                        type="text"
                        value={unsubscribeOtp}
                        onChange={(e) => {
                          // Only allow numeric input
                          const value = e.target.value.replace(/\D/g, '');
                          setUnsubscribeOtp(value);
                          setOtpError(''); // Clear error when user types
                        }}
                        placeholder="Enter 6-digit OTP"
                        maxLength={6}
                        className={`w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border ${otpError ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} focus:outline-none focus:ring-2 ${otpError ? 'focus:ring-red-500' : 'focus:ring-blue-500'} text-gray-900 dark:text-white text-lg tracking-widest text-center`}
                      />
                      {otpError && (
                        <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                          <X className="w-4 h-4" />
                          {otpError}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-4">
                      <button
                        onClick={handleVerifyUnsubscribeOtp}
                        disabled={verifyingOtp || !unsubscribeOtp || unsubscribeOtp.length !== 6}
                        className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {verifyingOtp ? (
                          <>
                            <UrbanSetuSpinner size="sm" isBright={true} />
                            <span>Verifying...</span>
                          </>
                        ) : 'Confirm Unsubscribe'}
                      </button>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {resendTimer > 0 ? (
                            <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                              Resend in {resendTimer}s
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={handleSendUnsubscribeOtp}
                              disabled={sendingOtp || verifyingOtp || !canResend}
                              className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-bold underline transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              {sendingOtp ? (
                                <UrbanSetuSpinner size="sm" />
                              ) : (
                                <RotateCcw className="w-3 h-3" />
                              )}
                              {sendingOtp ? 'Sending...' : 'Resend'}
                            </button>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            setUnsubscribeStep('REASON');
                            setResendTimer(0);
                            setCanResend(true);
                          }}
                          disabled={otpLoading}
                          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium underline transition-colors"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default PublicBlogs;
