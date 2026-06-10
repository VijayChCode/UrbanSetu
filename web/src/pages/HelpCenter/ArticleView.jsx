import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaThumbsUp, FaThumbsDown, FaChevronLeft, FaCalendarAlt } from 'react-icons/fa';
import { usePageTitle } from '../../hooks/usePageTitle';
import { authenticatedFetch } from '../../utils/auth';

const ArticleView = () => {
    const { currentUser } = useSelector((state) => state.user);
    const { slug } = useParams();
    const [title, setTitle] = useState('Help Center - UrbanSetu');
    usePageTitle(title);
    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [voteStatus, setVoteStatus] = useState(null); // 'helpful', 'not_helpful' or null

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

    useEffect(() => {
        const fetchArticle = async () => {
            try {
                setLoading(true);
                const res = await authenticatedFetch(`${API_BASE_URL}/api/help/article/${slug}`);
                const data = await res.json();

                if (!res.ok) throw new Error(data.message || 'Article not found');

                setArticle(data);
                setTitle(`${data.title} - UrbanSetu Help`);
                if (data.userVote) {
                    setVoteStatus(data.userVote);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchArticle();
    }, [slug]);

    const handleVote = async (type) => {
        // Optimistic UI update
        const previousStatus = voteStatus;

        // Toggle off if same type clicked, otherwise swap/set
        const newStatus = previousStatus === type ? null : type;
        setVoteStatus(newStatus);

        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/help/${article._id}/vote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ type })
            });

            if (!res.ok) {
                // Revert on error
                setVoteStatus(previousStatus);
                // toast.error("Failed to vote"); 
            }

        } catch (err) {
            console.error("Failed to vote", err);
            setVoteStatus(previousStatus);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
                <div className="max-w-4xl mx-auto animate-pulse">
                    {/* Back Link Skeleton */}
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-6"></div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-8 sm:p-12">
                            {/* Title Skeleton */}
                            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-6"></div>

                            {/* Meta Row Skeleton */}
                            <div className="flex gap-4 mb-8">
                                <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                                <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            </div>

                            {/* Content Skeleton - Multiple lines */}
                            <div className="space-y-4">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !article) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">Article Not Found</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">{error || "The article you are looking for does not exist."}</p>
                <Link to={!currentUser ? '/help-center' : (currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin/help-center' : '/user/help-center')} className="text-blue-600 hover:underline">Return to Help Center</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <Link to={!currentUser ? '/help-center' : (currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin/help-center' : '/user/help-center')} className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline">
                        <FaChevronLeft className="mr-2" />
                        Back to Help Center
                    </Link>
                </div>

                <article className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-8 sm:p-12">
                        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-6">
                            {article.title}
                        </h1>

                        <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 dark:text-gray-400 mb-8 pb-8 border-b border-gray-100 dark:border-gray-700">
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-xs font-semibold">
                                {article.category}
                            </span>
                            <div className="flex items-center">
                                <FaCalendarAlt className="mr-2" />
                                Updated {new Date(article.updatedAt).toLocaleDateString()}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="prose prose-lg dark:prose-invert max-w-none mb-12 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {article.content}
                        </div>

                        {/* Voting Section */}
                        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <span className="font-medium text-gray-900 dark:text-white">Was this article helpful?</span>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => handleVote('helpful')}
                                    className={`flex items-center px-4 py-2 rounded-lg transition-all ${voteStatus === 'helpful'

                                        ? 'bg-green-600 text-white'
                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600'
                                        } border border-gray-200 dark:border-gray-600`}
                                >
                                    <FaThumbsUp className="mr-2" />
                                    Yes
                                </button>
                                <button
                                    onClick={() => handleVote('not_helpful')}
                                    className={`flex items-center px-4 py-2 rounded-lg transition-all ${voteStatus === 'not_helpful'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600'
                                        } border border-gray-200 dark:border-gray-600`}
                                >
                                    <FaThumbsDown className="mr-2" />
                                    No
                                </button>
                            </div>
                        </div>

                        {/* Feedback on vote */}
                        {voteStatus && (
                            <p className="text-center mt-4 text-sm text-green-600 dark:text-green-400 font-medium animate-fadeIn">
                                Thanks for your feedback!
                            </p>
                        )}
                    </div>
                </article>

                {/* Contact CTA */}
                <div className="mt-8 text-center text-gray-600 dark:text-gray-400">
                    Need more help? <Link to={!currentUser ? '/contact' : (currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin/support' : '/user/contact')} className="text-blue-600 dark:text-blue-400 hover:underline">Contact our support team</Link>
                </div>
            </div>
        </div>
    );
};

export default ArticleView;