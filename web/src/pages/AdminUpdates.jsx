import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { usePageTitle } from '../hooks/usePageTitle';
import {
    Plus, Edit, Trash2, Search, Filter,
    Calendar, Tag, Image as ImageIcon, CheckCircle, XCircle, Video, Loader, Upload, Play,
    ArrowLeft, ArrowRight, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ImagePreview from "../components/ImagePreview";
import VideoPreview from "../components/VideoPreview";
import { authenticatedFetch } from '../utils/auth';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminUpdates() {
    usePageTitle('Platform Updates Management');
    const { currentUser } = useSelector((state) => state.user);

    const [updates, setUpdates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterCategory]);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingUpdate, setEditingUpdate] = useState(null);
    // Preview States
    const [showImagePreview, setShowImagePreview] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [showVideoPreview, setShowVideoPreview] = useState(false);
    const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);

    const [formData, setFormData] = useState({
        title: '',
        version: '',
        description: '',
        category: 'new_feature',
        tags: '',
        actionUrl: '',
        imageUrls: [],
        videoUrls: [],
        isActive: true,
        scheduledAt: null
    });
    const [submitting, setSubmitting] = useState(false);
    const [imageErrors, setImageErrors] = useState({});
    const [uploadingImages, setUploadingImages] = useState({});
    const [videoErrors, setVideoErrors] = useState({});
    const [uploadingVideos, setUploadingVideos] = useState({});

    const validateImageUrl = (url) => {
        if (!url) return true;
        try { new URL(url); } catch { return false; }
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
        const hasImageExtension = imageExtensions.some(ext => url.toLowerCase().includes(ext));
        const isCloudinaryUrl = url.includes('cloudinary.com');
        return hasImageExtension || url.includes('images') || url.includes('img') || isCloudinaryUrl;
    };

    const validateVideoUrl = (url) => {
        if (!url) return true;
        try { new URL(url); } catch { return false; }
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.mkv'];
        const hasVideoExtension = videoExtensions.some(ext => url.toLowerCase().includes(ext));
        const isCloudinaryUrl = url.includes('cloudinary.com');
        return hasVideoExtension || url.includes('video') || isCloudinaryUrl;
    };

    // Delete Confirmation State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState(null);

    useEffect(() => {
        fetchUpdates();
    }, []);

    const fetchUpdates = async () => {
        try {
            setLoading(true);
            // Ensure we hit the admin route which returns ALL updates
            const res = await authenticatedFetch(`${API_BASE_URL}/api/updates`);
            const data = await res.json();
            if (data.success) {
                setUpdates(data.data);
            } else {
                toast.error(data.message || 'Failed to fetch updates');
            }
        } catch (error) {
            toast.error('Error loading updates');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            version: '',
            description: '',
            category: 'new_feature',
            tags: '',
            actionUrl: '',
            imageUrls: [],
            videoUrls: [],
            isActive: true,
            scheduledAt: null
        });
        setEditingUpdate(null);
    };

    const handleOpenCreate = () => {
        resetForm();
        setShowModal(true);
    };

    const handleOpenEdit = (update) => {
        setEditingUpdate(update);
        setFormData({
            title: update.title,
            version: update.version,
            description: update.description,
            category: update.category,
            tags: (update.tags || []).join(', '),
            actionUrl: update.actionUrl || '',
            imageUrls: (update.imageUrls && update.imageUrls.length > 0) ? update.imageUrls : (update.imageUrl ? [update.imageUrl] : []),
            videoUrls: (update.videoUrls && update.videoUrls.length > 0) ? update.videoUrls : (update.videoUrl ? [update.videoUrl] : []),
            isActive: update.isActive,
            scheduledAt: update.scheduledAt || null
        });
        setShowModal(true);
    };

    const handleDelete = (id) => {
        setDeleteTargetId(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!deleteTargetId) return;

        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/updates/${deleteTargetId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Update deleted successfully');
                setUpdates(prev => prev.filter(u => u._id !== deleteTargetId));
            } else {
                toast.error(data.message || 'Failed to delete update');
            }
        } catch (error) {
            toast.error('Error deleting update');
        } finally {
            setShowDeleteModal(false);
            setDeleteTargetId(null);
        }
    };


    const handleImageChange = (index, url) => {
        const newImageUrls = [...formData.imageUrls];
        newImageUrls[index] = url;
        setFormData({ ...formData, imageUrls: newImageUrls });

        const newImageErrors = { ...imageErrors };
        if (url && !validateImageUrl(url)) {
            newImageErrors[index] = "Please enter a valid image URL";
        } else {
            delete newImageErrors[index];
        }
        setImageErrors(newImageErrors);
    };

    const handleVideoUrlChange = (index, url) => {
        const newVideoUrls = [...formData.videoUrls];
        newVideoUrls[index] = url;
        setFormData({ ...formData, videoUrls: newVideoUrls });
        const newVideoErrors = { ...videoErrors };
        if (url && !validateVideoUrl(url)) {
            newVideoErrors[index] = 'Please enter a valid video URL';
        } else {
            delete newVideoErrors[index];
        }
        setVideoErrors(newVideoErrors);
    };

    const handleFileUpload = async (index, file, type) => {
        if (!file) return;

        if (type === 'image') {
            if (!file.type.startsWith('image/')) {
                setImageErrors(prev => ({ ...prev, [index]: 'Please select an image file' }));
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                setImageErrors(prev => ({ ...prev, [index]: 'Image size must be less than 10MB' }));
                return;
            }
            setUploadingImages(prev => ({ ...prev, [index]: true }));
            setImageErrors(prev => ({ ...prev, [index]: '' }));
        } else {
            if (!file.type.startsWith('video/')) {
                setVideoErrors(prev => ({ ...prev, [index]: 'Please select a video file' }));
                return;
            }
            if (file.size > 100 * 1024 * 1024) {
                setVideoErrors(prev => ({ ...prev, [index]: 'Video size must be less than 100MB' }));
                return;
            }
            setUploadingVideos(prev => ({ ...prev, [index]: true }));
            setVideoErrors(prev => ({ ...prev, [index]: '' }));
        }

        try {
            const uploadFormData = new FormData();
            uploadFormData.append(type === 'image' ? 'image' : 'video', file);
            const endpoint = type === 'image' ? '/api/upload/image' : '/api/upload/video';

            const res = await authenticatedFetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                body: uploadFormData,
            });

            const data = await res.json();

            if (data.success || res.ok) {
                const url = type === 'image' ? (data.imageUrl || data.url) : (data.videoUrl || data.url);
                if (url) {
                    if (type === 'image') {
                        const newImageUrls = [...formData.imageUrls];
                        newImageUrls[index] = url;
                        setFormData(prev => ({ ...prev, imageUrls: newImageUrls }));
                        setImageErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors[index];
                            return newErrors;
                        });
                    } else {
                        const newVideoUrls = [...formData.videoUrls];
                        newVideoUrls[index] = url;
                        setFormData(prev => ({ ...prev, videoUrls: newVideoUrls }));
                        setVideoErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors[index];
                            return newErrors;
                        });
                    }
                    toast.success(`${type === 'image' ? 'Image' : 'Video'} uploaded successfully`);
                }
            } else {
                toast.error(data.message || 'Upload failed');
                if (type === 'image') setImageErrors(prev => ({ ...prev, [index]: 'Upload failed' }));
                else setVideoErrors(prev => ({ ...prev, [index]: 'Upload failed' }));
            }
        } catch (error) {
            console.error(error);
            toast.error('Error uploading file');
        } finally {
            if (type === 'image') setUploadingImages(prev => ({ ...prev, [index]: false }));
            else setUploadingVideos(prev => ({ ...prev, [index]: false }));
        }
    };

    const handleRemoveMedia = (index, type) => {
        setFormData(prev => ({
            ...prev,
            [type]: prev[type].filter((_, i) => i !== index)
        }));

        if (type === 'imageUrls') {
            const newErrors = { ...imageErrors };
            delete newErrors[index];
            setImageErrors(newErrors);
            const newUploading = { ...uploadingImages };
            delete newUploading[index];
            setUploadingImages(newUploading);
        } else {
            const newErrors = { ...videoErrors };
            delete newErrors[index];
            setVideoErrors(newErrors);
            const newUploading = { ...uploadingVideos };
            delete newUploading[index];
            setUploadingVideos(newUploading);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title || !formData.description) {
            return toast.error('Title and description are required');
        }

        // Check for media errors
        if (Object.keys(imageErrors).length > 0) {
            return toast.error("Please fix the image URL errors before submitting");
        }
        if (Object.keys(videoErrors).length > 0) {
            return toast.error("Please fix the video URL errors before submitting");
        }

        setSubmitting(true);
        try {
            const payload = {
                ...formData,
                tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
                scheduledAt: (!formData.isActive && formData.scheduledAt) ? formData.scheduledAt : null
            };

            let url = `${API_BASE_URL}/api/updates`;
            let method = 'POST';

            if (editingUpdate) {
                url = `${url}/${editingUpdate._id}`;
                method = 'PUT';
            }

            const res = await authenticatedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                toast.success(editingUpdate ? 'Update updated successfully' : 'Update created successfully');
                setShowModal(false);
                fetchUpdates();
            } else {
                toast.error(data.message || 'Operation failed');
            }
        } catch (error) {
            toast.error('Error submitting form');
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const filteredUpdates = updates.filter(update => {
        const matchesSearch = update.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            update.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === 'all' || update.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const totalItems = filteredUpdates.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedUpdates = filteredUpdates.slice(startIndex, endIndex);

    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin')) {
        return <div className="p-10 text-center text-red-500">Access Denied</div>;
    }

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 transition-colors duration-300">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Platform Updates</h1>
                        <div className="flex items-center gap-3 mt-1">
                            <p className="text-gray-500 dark:text-gray-400">Manage change logs, announcements, and features</p>
                            <a href="/updates" target="_blank" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium flex items-center gap-1">
                                View Live Page <Search size={14} />
                            </a>
                        </div>
                    </div>        </div>
                <button
                    onClick={handleOpenCreate}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Plus size={20} /> Create New Update
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center transition-colors">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search updates..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Filter size={18} className="text-gray-500 dark:text-gray-400" />
                    <select
                        className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <option value="all">All Categories</option>
                        <option value="new_feature">New Feature</option>
                        <option value="improvement">Improvement</option>
                        <option value="bug_fix">Bug Fix</option>
                        <option value="announcement">Announcement</option>
                    </select>
                </div>
            </div>

            {/* Table List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
                {loading ? (
                    <div className="p-20 flex flex-col items-center justify-center gap-4">
                        <UrbanSetuSpinner size="lg" isBright={false} />
                        <p className="text-gray-500 dark:text-gray-400 font-medium animate-pulse">Loading updates...</p>
                    </div>
                ) : filteredUpdates.length === 0 ? (
                    <div className="p-10 text-center text-gray-500 dark:text-gray-400">
                        <p>No updates found matching your criteria.</p>
                    </div>
                ) : (
                    <motion.div 
                        key={currentPage}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-x-auto"
                    >
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 font-semibold text-sm">Update Details</th>
                                    <th className="px-6 py-4 font-semibold text-sm">Category</th>
                                    <th className="px-6 py-4 font-semibold text-sm">Version</th>
                                    <th className="px-6 py-4 font-semibold text-sm">Release Date</th>
                                    {currentUser?.role === 'rootadmin' && (
                                        <th className="px-6 py-4 font-semibold text-sm">Publisher</th>
                                    )}
                                    <th className="px-6 py-4 font-semibold text-sm">Status</th>
                                    <th className="px-6 py-4 font-semibold text-sm text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {paginatedUpdates.map(update => (
                                    <tr key={update._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900 dark:text-white">{update.title}</div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{update.description}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize
                                        ${update.category === 'new_feature' ? 'bg-purple-100 text-purple-700' :
                                                    update.category === 'bug_fix' ? 'bg-red-100 text-red-700' :
                                                        update.category === 'improvement' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-yellow-100 text-yellow-700'}`}>
                                                {update.category.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                            {update.version || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                            {new Date(update.releaseDate).toLocaleDateString()}
                                        </td>
                                        {currentUser?.role === 'rootadmin' && (
                                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900 dark:text-white capitalize">{update.author?.username || 'Unknown'}</span>
                                                    <span className="text-xs text-gray-500 capitalize">{update.author?.role}</span>
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-6 py-4">
                                            {update.isActive ? (
                                                <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-medium bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full w-fit">
                                                    <CheckCircle size={12} /> Active
                                                </span>
                                            ) : update.scheduledAt && new Date(update.scheduledAt) > new Date() ? (
                                                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full w-fit" title={`Scheduled for ${new Date(update.scheduledAt).toLocaleString()}`}>
                                                    <Clock size={12} /> Scheduled: {new Date(update.scheduledAt).toLocaleDateString()}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs font-medium bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full w-fit">
                                                    <XCircle size={12} /> Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenEdit(update)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(update._id)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </motion.div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 sm:px-6 border-t border-gray-105 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/10">
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                            Showing page <span className="font-semibold text-gray-900 dark:text-white">{currentPage}</span> of <span className="font-semibold dark:text-gray-305">{totalPages}</span>
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ArrowLeft size={14} /> Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Next <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transition-colors">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 rounded-t-2xl z-10 transition-colors">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                                {editingUpdate ? 'Edit Update' : 'Create New Update'}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                                        placeholder="e.g. Dark Mode Support"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Version</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                                        placeholder="e.g. v1.2.0"
                                        value={formData.version}
                                        onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                                <select
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                >
                                    <option value="new_feature">New Feature</option>
                                    <option value="improvement">Improvement</option>
                                    <option value="bug_fix">Bug Fix</option>
                                    <option value="announcement">Announcement</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                <textarea
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none h-32 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                                    placeholder="Describe the update details..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    required
                                ></textarea>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags (Comma separated)</label>
                                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg px-3 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 bg-white dark:bg-gray-700">
                                    <Tag size={18} className="text-gray-400 mr-2" />
                                    <input
                                        type="text"
                                        className="w-full py-2 outline-none bg-transparent dark:text-white dark:placeholder-gray-400"
                                        placeholder="e.g. ui, performance, security"
                                        value={formData.tags}
                                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Link (Optional)</label>
                                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg px-3 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 bg-white dark:bg-gray-700">
                                    <Search size={18} className="text-gray-400 mr-2" />
                                    <input
                                        type="url"
                                        className="w-full py-2 outline-none bg-transparent dark:text-white dark:placeholder-gray-400"
                                        placeholder="e.g. https://urbansetu.com/new-feature"
                                        value={formData.actionUrl}
                                        onChange={(e) => setFormData({ ...formData, actionUrl: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Media</label>
                                {/* Images Section */}
                                <div className="space-y-4 mb-6">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Property Images</label>
                                        <p className="text-gray-600 dark:text-gray-400 text-xs">Supported: JPG, PNG, GIF, WebP (max 10MB)</p>
                                    </div>

                                    <div className="space-y-3">
                                        {formData.imageUrls.map((url, index) => (
                                            <div key={index} className="space-y-2">
                                                <div className="flex gap-2 items-center">
                                                    <input
                                                        type="text"
                                                        placeholder={`Image URL ${index + 1}`}
                                                        value={url || ""}
                                                        onChange={(e) => handleImageChange(index, e.target.value)}
                                                        className={`flex-1 p-2 text-sm border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors ${imageErrors[index] ? 'border-red-500' : ''}`}
                                                    />
                                                    <label className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition cursor-pointer flex-shrink-0 text-xs font-medium">
                                                        {uploadingImages[index] ? 'Uploading...' : 'Upload'}
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={(e) => handleFileUpload(index, e.target.files[0], 'image')}
                                                            className="hidden"
                                                            disabled={uploadingImages[index]}
                                                        />
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveMedia(index, 'imageUrls')}
                                                        className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition flex-shrink-0"
                                                        title="Remove"
                                                    >
                                                        <XCircle size={16} />
                                                    </button>
                                                </div>
                                                {imageErrors[index] && <p className="text-red-500 text-xs">{imageErrors[index]}</p>}
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, imageUrls: [...prev.imageUrls, ""] }))}
                                            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium flex items-center gap-1"
                                        >
                                            <Plus size={16} /> Add Another Image
                                        </button>
                                    </div>

                                    {/* Image Previews */}
                                    {formData.imageUrls.some(url => url) && (
                                        <div className="grid grid-cols-4 gap-2 mt-4">
                                            {formData.imageUrls.map((url, index) => (
                                                url ? (
                                                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 group">
                                                        <img
                                                            src={url}
                                                            alt={`Preview ${index}`}
                                                            className="w-full h-full object-cover cursor-pointer"
                                                            onClick={() => {
                                                                setSelectedImageIndex(index);
                                                                setShowImagePreview(true);
                                                            }}
                                                            onError={(e) => e.target.src = 'https://via.placeholder.com/150?text=Error'}
                                                        />
                                                    </div>
                                                ) : null
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Videos Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Videos</label>
                                        <p className="text-gray-600 dark:text-gray-400 text-xs">Supported: MP4, WebM (max 100MB)</p>
                                    </div>

                                    <div className="space-y-3">
                                        {formData.videoUrls.map((url, index) => (
                                            <div key={index} className="space-y-2">
                                                <div className="flex gap-2 items-center">
                                                    <input
                                                        type="text"
                                                        placeholder={`Video URL ${index + 1}`}
                                                        value={url || ""}
                                                        onChange={(e) => handleVideoUrlChange(index, e.target.value)}
                                                        className={`flex-1 p-2 text-sm border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors ${videoErrors[index] ? 'border-red-500' : ''}`}
                                                    />
                                                    <label className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition cursor-pointer flex-shrink-0 text-xs font-medium">
                                                        {uploadingVideos[index] ? 'Uploading...' : 'Upload'}
                                                        <input
                                                            type="file"
                                                            accept="video/*"
                                                            onChange={(e) => handleFileUpload(index, e.target.files[0], 'video')}
                                                            className="hidden"
                                                            disabled={uploadingVideos[index]}
                                                        />
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveMedia(index, 'videoUrls')}
                                                        className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition flex-shrink-0"
                                                        title="Remove"
                                                    >
                                                        <XCircle size={16} />
                                                    </button>
                                                </div>
                                                {videoErrors[index] && <p className="text-red-500 text-xs">{videoErrors[index]}</p>}
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, videoUrls: [...prev.videoUrls, ""] }))}
                                            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium flex items-center gap-1"
                                        >
                                            <Plus size={16} /> Add Another Video
                                        </button>
                                    </div>

                                    {/* Video Previews */}
                                    {formData.videoUrls.some(url => url) && (
                                        <div className="grid grid-cols-4 gap-2 mt-4">
                                            {formData.videoUrls.map((url, index) => (
                                                url ? (
                                                    <div key={index} className="relative aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-900 group cursor-pointer"
                                                        onClick={() => {
                                                            setSelectedVideoIndex(index);
                                                            setShowVideoPreview(true);
                                                        }}>
                                                        <video src={url} className="w-full h-full object-cover pointer-events-none" />
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30">
                                                            <Play size={20} className="text-white drop-shadow-md" />
                                                        </div>
                                                    </div>
                                                ) : null
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Status & Scheduling Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-gradient-to-r from-blue-50/60 to-indigo-50/60 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 shadow-sm transition-all duration-300">
                                {/* Manual Publish */}
                                <label className="flex items-center group cursor-pointer select-none">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            id="isActive"
                                            checked={formData.isActive}
                                            onChange={(e) => {
                                                const isChecked = e.target.checked;
                                                setFormData(prev => ({
                                                    ...prev,
                                                    isActive: isChecked,
                                                    scheduledAt: isChecked ? null : prev.scheduledAt
                                                }));
                                            }}
                                            className="sr-only peer"
                                        />
                                        <div className="w-12 h-7 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-blue-600 transition-all duration-300"></div>
                                        <div className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-all duration-300 peer-checked:translate-x-5 shadow-sm"></div>
                                    </div>
                                    <div className="ml-3">
                                        <span className="block text-sm font-bold text-gray-800 dark:text-white">🚀 Publish Now</span>
                                        <span className="block text-xs text-gray-500 dark:text-gray-400 font-medium">Broadcasts to all users immediately</span>
                                    </div>
                                </label>

                                {/* Scheduling */}
                                <div className={`transition-all duration-300 ${formData.isActive ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5 uppercase tracking-wider">📅 Or Schedule Publication</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.scheduledAt ? new Date(new Date(formData.scheduledAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                                        onChange={(e) => {
                                            const localValue = e.target.value;
                                            setFormData(prev => ({
                                                ...prev,
                                                scheduledAt: localValue ? new Date(localValue).toISOString() : null
                                            }));
                                        }}
                                        min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                                        disabled={formData.isActive}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all text-xs font-medium"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-gray-700 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={`flex-1 py-3 ${
                                        formData.isActive
                                            ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 dark:shadow-none'
                                            : formData.scheduledAt
                                                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200 dark:shadow-none'
                                                : 'bg-gray-600 hover:bg-gray-700 shadow-gray-200 dark:shadow-none'
                                    } text-white rounded-xl font-medium transition-colors shadow-lg`}
                                    disabled={submitting}
                                >
                                    {submitting
                                        ? 'Saving...'
                                        : editingUpdate
                                            ? (formData.isActive ? 'Update & Publish' : (formData.scheduledAt ? 'Update Schedule' : 'Save Draft'))
                                            : (formData.isActive ? 'Publish Update' : (formData.scheduledAt ? 'Schedule Update' : 'Draft Update'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {/* Image Preview Modal */}
            <ImagePreview
                isOpen={showImagePreview}
                onClose={() => setShowImagePreview(false)}
                images={formData.imageUrls}
                initialIndex={selectedImageIndex}
            />

            {/* Video Preview Modal */}
            <VideoPreview
                isOpen={showVideoPreview}
                onClose={() => setShowVideoPreview(false)}
                videos={formData.videoUrls}
                initialIndex={selectedVideoIndex}
            />

            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all scale-100 opacity-100">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="text-red-600 dark:text-red-400" size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Update?</h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-6">
                                Are you sure you want to delete this update? This action cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-red-200"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
