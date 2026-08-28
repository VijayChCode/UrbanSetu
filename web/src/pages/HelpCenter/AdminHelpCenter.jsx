import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaTimes, FaSearch, FaCheck, FaEye, FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { authenticatedFetch } from '../../utils/csrf';
import { helpCategories } from '../../utils/helpCategories';
import ConfirmationModal from '../../components/ConfirmationModal';
import { usePageTitle } from '../../hooks/usePageTitle';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const AdminHelpCenter = () => {
    usePageTitle('Admin Help Center - UrbanSetu');
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingArticle, setEditingArticle] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        category: '',
        description: '',
        content: '',
        tags: '',
        isPublished: true
    });

    // Delete State
    const [deleteId, setDeleteId] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        fetchArticles();
    }, []);

    const fetchArticles = async () => {
        try {
            setLoading(true);
            // Using admin endpoint to see even unpublished ones if needed
            // authenticatedFetch handles token refresh automatically
            const res = await authenticatedFetch(`${API_BASE_URL}/api/help/admin/all`);

            if (res.ok) {
                const data = await res.json();
                setArticles(data);
            } else if (res.status === 401) {
                toast.error("Session expired. Please login again.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load articles");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (article = null) => {
        if (article) {
            setEditingArticle(article);
            setFormData({
                title: article.title,
                category: article.category,
                description: article.description,
                content: article.content,
                tags: article.tags ? article.tags.join(', ') : '',
                isPublished: article.isPublished
            });
        } else {
            setEditingArticle(null);
            setFormData({
                title: '',
                category: helpCategories[0]?.title || '', // Default to first category
                description: '',
                content: '',
                tags: '',
                isPublished: true
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                ...formData,
                tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
            };

            const url = editingArticle
                ? `${API_BASE_URL}/api/help/admin/update/${editingArticle._id}`
                : `${API_BASE_URL}/api/help/admin/create`;

            const method = editingArticle ? 'PUT' : 'POST';

            const res = await authenticatedFetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(editingArticle 
                    ? 'Article updated successfully' 
                    : (formData.isPublished ? 'Article created & published successfully' : 'Article drafted successfully')
                );
                setIsModalOpen(false);
                fetchArticles();
            } else {
                toast.error(data.message || 'Operation failed');
            }
        } catch (error) {
            toast.error('Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/help/admin/delete/${deleteId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                toast.success('Article deleted');
                setArticles(articles.filter(a => a._id !== deleteId));
            } else {
                toast.error('Failed to delete');
            }
        } catch (error) {
            toast.error('Delete failed');
        } finally {
            setShowDeleteConfirm(false);
            setDeleteId(null);
        }
    };

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const filteredArticles = articles.filter(a =>
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredArticles.length / itemsPerPage) || 1;
    const paginatedArticles = filteredArticles.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset page when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    return (
        <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                            <FaEdit />
                        </span>
                        Help Center Management
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 ml-11">Manage help articles, guides, and user feedback</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-500/30 hover:scale-105 font-medium"
                >
                    <FaPlus /> Create Article
                </button>
            </div>

            {/* Top Performing Articles (Popularity Metrics) */}
            {articles.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
                        Top Performing Articles
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...articles]
                            .map(a => ({
                                ...a,
                                score: (a.views || 0) + ((a.helpfulCount || 0) * 10) - ((a.notHelpfulCount || 0) * 5)
                            }))
                            .sort((a, b) => b.score - a.score)
                            .slice(0, 4)
                            .map((article) => (
                                <div key={article._id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                                    <h3 className="font-semibold text-gray-800 dark:text-white truncate mb-3 relative z-10 pr-2" title={article.title}>{article.title}</h3>

                                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 relative z-10 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                                        <div className="flex items-center gap-1.5" title="Views">
                                            <FaEye className="text-blue-500" /> <span className="font-medium">{article.views}</span>
                                        </div>
                                        <div className="h-3 w-px bg-gray-300 dark:bg-gray-600"></div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-green-600 dark:text-green-400 font-bold flex items-center gap-0.5" title="Helpful votes">
                                                <FaCheck className="text-[10px]" /> {article.helpfulCount}
                                            </span>
                                            <span className="text-red-500 font-bold flex items-center gap-0.5" title="Not helpful votes">
                                                <FaTimes className="text-[10px]" /> {article.notHelpfulCount}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 flex justify-between items-center">
                                        <span>Impact Score</span>
                                        <span className="bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded text-blue-700 dark:text-blue-300">{article.score}</span>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="mb-6 relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FaSearch className="text-gray-400" />
                </div>
                <input
                    type="text"
                    placeholder="Search articles by title or category..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none shadow-sm transition-all"
                />
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-6 py-4">Title</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Stats</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody key={currentPage} className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
                                <tr><td colSpan="5" className="text-center py-8">Loading...</td></tr>
                            ) : filteredArticles.length > 0 ? (
                                paginatedArticles.map((article, index) => (
                                    <tr 
                                        key={article._id} 
                                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                                        style={{ animation: `fadeIn 0.25s ease-out ${index * 0.04}s backwards` }}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{article.title}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{article.description}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                {article.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {article.isPublished ? (
                                                <span className="text-green-600 dark:text-green-400 flex items-center gap-1 text-sm"><FaCheck className="text-xs" /> Published</span>
                                            ) : (
                                                <span className="text-yellow-600 dark:text-yellow-400 text-sm">Draft</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            <div className="flex items-center gap-3">
                                                <span className="flex items-center gap-1"><FaEye className="text-blue-400" /> {article.views}</span>
                                                <span className="text-green-500">👍 {article.helpfulCount}</span>
                                                <span className="text-red-500">👎 {article.notHelpfulCount}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenModal(article)}
                                                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                                    title="Edit"
                                                >
                                                    <FaEdit />
                                                </button>
                                                <button
                                                    onClick={() => { setDeleteId(article._id); setShowDeleteConfirm(true); }}
                                                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                                    title="Delete"
                                                >
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="5" className="text-center py-8 text-gray-500">No articles found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Showing page <span className="font-semibold text-gray-900 dark:text-white">{currentPage}</span> of <span className="font-semibold dark:text-gray-300">{totalPages}</span>
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <FaArrowLeft size={12} /> Previous
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next <FaArrowRight size={12} />
                        </button>
                    </div>
                </div>
            )}

            {/* Editor Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center z-10">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingArticle ? 'Edit Article' : 'Create New Article'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                <FaTimes size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="How to reset password"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                                    <select
                                        required
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">Select Category</option>
                                        {helpCategories.map(cat => (
                                            <option key={cat.id} value={cat.title}>{cat.title}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description (Short Summary)</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={300}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Ideally 1-2 sentences for search results"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Content</label>
                                <div className="text-xs text-gray-500 mb-1">Markdown is supported (optional)</div>
                                <textarea
                                    required
                                    rows={12}
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    className="w-full p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                                    placeholder="# Header&#10;Steps to follow:&#10;1. Step one..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tags (Comma Separated)</label>
                                    <input
                                        type="text"
                                        value={formData.tags}
                                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                        className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="security, password, login"
                                    />
                                </div>

                                <div className="flex items-center gap-3 pt-6">
                                    <input
                                        type="checkbox"
                                        id="isPublished"
                                        checked={formData.isPublished}
                                        onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <label htmlFor="isPublished" className="text-gray-700 dark:text-gray-300 font-medium">Publish Immediately</label>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                                <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2.5 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors font-medium shadow-lg shadow-blue-500/30 disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {submitting && (
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    )}
                                    {editingArticle
                                        ? (formData.isPublished
                                            ? (submitting ? 'Saving...' : 'Save Changes')
                                            : (submitting ? 'Saving Draft...' : 'Save Draft'))
                                        : (formData.isPublished
                                            ? (submitting ? 'Creating...' : 'Create Article')
                                            : (submitting ? 'Drafting...' : 'Draft Article'))
                                    }
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
                title="Delete Article"
                message="Are you sure you want to delete this article? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                isDestructive={true}
            />

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default AdminHelpCenter;
