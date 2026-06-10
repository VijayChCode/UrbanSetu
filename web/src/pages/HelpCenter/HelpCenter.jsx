import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaSearch, FaArrowRight, FaChevronLeft, FaEdit } from 'react-icons/fa';
import { helpCategories } from '../../utils/helpCategories';
import { usePageTitle } from '../../hooks/usePageTitle';
import HelpCenterChat from '../../components/HelpCenterChat';
import { authenticatedFetch } from '../../utils/auth';
import SEO from '../../components/SEO';

const HelpCenter = () => {
    usePageTitle('Help Center - UrbanSetu');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(false);

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

    const fetchArticles = async (category = '', search = '') => {
        try {
            setLoading(true);
            let url = `${API_BASE_URL}/api/help?limit=20`;
            if (category) url += `&category=${encodeURIComponent(category)}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;

            // If no search and no category, we are likely on the landing page "Popular Articles" section
            // So we explicitly ask for popular sort
            if (!category && !search) {
                url += `&sort=popular`;
            }

            const res = await authenticatedFetch(url);
            const data = await res.json();
            setArticles(data);
        } catch (error) {
            console.error("Failed to fetch articles", error);
            setArticles([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchArticles(selectedCategory?.id || '', searchTerm);
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, selectedCategory]);

    const handleSearch = (e) => {
        e.preventDefault();
    };

    const handleCategoryClick = (category) => {
        setSelectedCategory(category);
        setSearchTerm('');
    };

    const { currentUser } = useSelector((state) => state.user);

    const handleBackToHome = () => {
        setSelectedCategory(null);
        setSearchTerm('');
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
            <SEO
                title="Help Center - Get Support & Documentation | UrbanSetu"
                description="Find answers to your questions about property listings, transactions, AI features, and more on UrbanSetu's Help Center. We're here to help you."
                keywords="UrbanSetu support, real estate help center, property buying guide, transaction support"
            />
            {/* Hero Section */}
            <div className="bg-blue-600 dark:bg-blue-800 py-16 px-4 sm:px-6 lg:px-8 text-center transition-colors relative">
                <div className="max-w-7xl mx-auto px-4 mb-4 text-left relative z-10">
                    <Link
                        to={!currentUser ? '/' : (currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin' : '/user')}
                        className="inline-flex items-center text-blue-100 hover:text-white transition-colors text-sm font-semibold gap-1.5"
                    >
                        <FaChevronLeft className="w-4 h-4" />
                        {!currentUser ? 'Back to Home' : 'Back to Dashboard'}
                    </Link>
                </div>
                {currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin') && (
                    <Link
                        to="/admin/help-center"
                        className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg backdrop-blur-sm transition-all text-sm font-medium flex items-center gap-2"
                    >
                        <FaEdit /> Manage Help Center
                    </Link>
                )}
                <h1 className="text-3xl font-extrabold text-white sm:text-4xl mb-6">
                    How can we help you?
                </h1>
                <div className="max-w-2xl mx-auto relative">
                    <form onSubmit={handleSearch}>
                        <div className="relative">
                            <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search for answers..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 rounded-full shadow-lg border-none focus:ring-4 focus:ring-blue-400 dark:focus:ring-blue-600 focus:outline-none text-gray-900"
                            />
                            <button
                                type="submit"
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full transition-colors text-sm font-semibold"
                            >
                                Search
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {selectedCategory || searchTerm ? (
                    /* Articles List View */
                    <div>
                        <button
                            onClick={handleBackToHome}
                            className="flex items-center text-blue-600 dark:text-blue-400 hover:underline mb-8 font-medium"
                        >
                            <FaChevronLeft className="mr-2" />
                            Back to Help Center
                        </button>

                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                            {selectedCategory ? selectedCategory.title : `Search Results for "${searchTerm}"`}
                        </h2>

                        {loading ? (
                            <div className="space-y-4 animate-pulse">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
                                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                                        <div className="mt-4 flex gap-4">
                                            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : articles.length > 0 ? (
                            <div className="space-y-4">
                                {articles.map((article) => (
                                    <Link
                                        key={article._id}
                                        to={`/help-center/article/${article.slug}`}
                                        className="block bg-white dark:bg-gray-800 p-6 rounded-lg shadow hover:shadow-md transition-shadow dark:text-gray-100"
                                    >
                                        <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-2">
                                            {article.title}
                                        </h3>
                                        <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-2">
                                            {article.description}
                                        </p>
                                        <div className="mt-2 flex items-center text-xs text-gray-400 dark:text-gray-500 gap-4">
                                            <span>{article.category}</span>
                                            <span>{new Date(article.updatedAt).toLocaleDateString()}</span>
                                            <span>{article.views} views</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="flex justify-center py-12">
                                <div className="max-w-md w-full text-center bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-100 dark:border-gray-700 transition-all duration-300">
                                    <div className="inline-flex items-center justify-center mb-6">
                                        <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="64" height="64" viewBox="0 0 64 64">
                                            <path fill="#008aa9" d="M55,47.491H44V18h8c1.657,0,3,1.343,3,3V47.491z"></path>
                                            <ellipse cx="32" cy="61" opacity=".3" rx="18.75" ry="3"></ellipse>
                                            <path fill="#37d0ee" d="M49.994,53H15c-3.314,0-6-2.686-6-6V14c0-1.657,1.343-3,3-3h29c1.657,0,3,1.343,3,3v33.505L49.994,53z"></path>
                                            <circle cx="49.5" cy="47.5" r="5.5" fill="#008aa9"></circle>
                                            <path d="M50,28l0,19.491c0,0.069,0.001,0.14,0.004,0.21c0.073,1.858,1.173,3.437,2.737,4.236C54.108,50.936,55,49.324,55,47.5c0-0.003,0-0.006,0-0.009h0V23C52.239,23,50,25.239,50,28z" opacity=".15"></path>
                                            <path fill="#fff" d="M30,11C30,11,30,11,30,11l-18,0c-1.657,0-3,1.343-3,3v17c2.761,0,5-2.239,5-5V16h11C27.761,16,30,13.761,30,11z" opacity=".3"></path>
                                            <rect width="25" height="10" x="14" y="16" fill="#a0effe"></rect>
                                            <rect width="10" height="4" x="14" y="30" fill="#a0effe"></rect>
                                            <rect width="11" height="4" x="28" y="30" fill="#a0effe"></rect>
                                            <rect width="10" height="4" x="14" y="38" fill="#a0effe"></rect>
                                            <rect width="11" height="4" x="28" y="38" fill="#a0effe"></rect>
                                            <polyline fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="3" points="12.5,20.5 12.5,14.5 16.5,14.5"></polyline>
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                        No Articles Found
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                                        {selectedCategory 
                                            ? `We couldn't find any articles in the "${selectedCategory.title}" category.`
                                            : `We couldn't find any articles matching "${searchTerm}". Try checking your spelling or using different keywords.`
                                        }
                                    </p>
                                    <button
                                        onClick={handleBackToHome}
                                        className="inline-flex items-center justify-center w-full px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all duration-200"
                                    >
                                        Browse all categories
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Categories Grid View */
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                            {helpCategories.map((category) => (
                                <button
                                    key={category.id}
                                    onClick={() => handleCategoryClick(category)}
                                    className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 text-left border border-gray-100 dark:border-gray-700 h-full flex flex-col"
                                >
                                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                                        <category.icon className="text-blue-600 dark:text-blue-400 text-2xl" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                        {category.title}
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm flex-grow">
                                        {category.description}
                                    </p>
                                </button>
                            ))}
                        </div>

                        {/* Popular Articles Section */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Popular Articles</h2>
                            {loading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700 rounded-lg"></div>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {articles.slice(0, 6).map((article) => (
                                        <Link
                                            key={article._id}
                                            to={`/help-center/article/${article.slug}`}
                                            className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg group transition-colors"
                                        >
                                            <div className="mr-3 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 dark:group-hover:text-blue-400">
                                                <FaArrowRight className="w-4 h-4" />
                                            </div>
                                            <span className="text-gray-700 dark:text-gray-200 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                {article.title}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Contact Support CTA */}
                        <div className="mt-16 text-center">
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                Still can't find what you're looking for?
                            </p>
                            <Link
                                to={!currentUser ? '/contact' : (currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin/support' : '/user/contact')}
                                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                            >
                                Contact Support
                            </Link>
                        </div>
                    </>
                )}
            </div>
            {/* Floating Chat Widget */}
            <HelpCenterChat />
        </div>
    );
};

export default HelpCenter;