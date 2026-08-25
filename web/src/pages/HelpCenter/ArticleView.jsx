import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaThumbsUp, FaThumbsDown, FaChevronLeft, FaCalendarAlt, FaFileAlt } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { usePageTitle } from '../../hooks/usePageTitle';
import { authenticatedFetch } from '../../utils/auth';
import { getErrorCode } from '../../utils/errorRegistry';
import SEO from '../../components/SEO';

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
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 transition-colors duration-300">
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
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        Article Not Found
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-2 leading-relaxed">
                        {error || "The article you are looking for does not exist or may have been moved."}
                    </p>
                    <p className="text-red-600 dark:text-red-400 font-mono text-xs mb-8 transition-colors">
                        Error Code: {getErrorCode(error || "Article not found")}
                    </p>
                    <Link
                        to={!currentUser ? '/help-center' : (currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin/help-center' : '/user/help-center')}
                        className="inline-flex items-center justify-center w-full px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all duration-200"
                    >
                        Return to Help Center
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
            <SEO
                title={article?.title ? `${article.title} - UrbanSetu Help Center` : "Help Center Article - UrbanSetu"}
                description={article?.content ? article.content.substring(0, 160).replace(/[#*`_]/g, '') : "Read detailed guides and help articles on UrbanSetu."}
                keywords={`UrbanSetu help, ${article?.title || 'support article'}, property guide, help center`}
            />
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
                        <div className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-black prose-headings:text-gray-900 dark:prose-headings:text-white prose-p:text-gray-650 dark:prose-p:text-gray-300 prose-li:text-gray-650 dark:prose-li:text-gray-300 prose-strong:text-gray-900 dark:prose-strong:text-white prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-img:rounded-2xl transition-colors mb-12">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.content}</ReactMarkdown>
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