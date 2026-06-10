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
                            <div className="text-center py-12">
                                <p className="text-gray-500 dark:text-gray-400 text-lg">No articles found.</p>
                                <button onClick={handleBackToHome} className="mt-4 text-blue-600 dark:text-blue-400 hover:underline">
                                    Browse all categories
                                </button>
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