import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/navigation';
import { Navigation } from 'swiper/modules';
import {
  Calendar, User, Eye, Heart, Tag, ArrowLeft, Share2, MessageSquare,
  Home, Maximize2, X, AlertTriangle, Edit, Trash, Play, Image as ImageIcon,
  CheckCircle, Clock, Send, Star, Check
} from 'lucide-react';
import { toast } from 'react-toastify';
import BlogEditModal from '../components/BlogEditModal';
import ImagePreview from '../components/ImagePreview';
import VideoPreview from '../components/VideoPreview';
import BlogDetailSkeleton from '../components/skeletons/BlogDetailSkeleton';
import ConfirmationModal from '../components/ConfirmationModal';
import SocialSharePanel from '../components/SocialSharePanel';
import UrbanSetuSpinner from "../components/UrbanSetuSpinner";
import { authenticatedFetch } from '../utils/auth';
import AdvancedImage from '../components/AdvancedImage';

import { usePageTitle } from '../hooks/usePageTitle';

const AdminBlogDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [blog, setBlog] = useState(null);

  // Set page title
  usePageTitle(blog ? `${blog.title} - Admin Panel` : "Loading - Admin Panel");

  const [relatedBlogs, setRelatedBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    isDestructive: false,
    confirmText: 'Confirm'
  });
  const [shareModal, setShareModal] = useState({ isOpen: false, url: '', title: '', description: '' });
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
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
    type: 'blog',
    featured: false,
    published: false,
    scheduledAt: null
  });
  const [properties, setProperties] = useState([]);
  const [categories, setCategories] = useState([]);
  const [propertySearch, setPropertySearch] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const textareaRef = useRef(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [isEditingLoading, setIsEditingLoading] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://urbansetu-pvt4.onrender.com';

  useEffect(() => {
    fetchBlog();
  }, [slug]);

  useEffect(() => {
    if (blog) {
      checkLikeStatus();
    }
  }, [blog]);

  useEffect(() => {
    if (showEditModal) {
      fetchProperties();
      fetchCategories();
    }
  }, [showEditModal]);

  const fetchBlog = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs/${slug}`);

      if (response.ok) {
        const data = await response.json();
        setBlog(data.data);
        setComments(data.data.comments || []);
        fetchRelatedBlogs(data.data.category, data.data._id);
      } else {
        console.log(`Blog with slug "${slug}" not found`);
        navigate('/admin/blogs');
      }
    } catch (error) {
      console.error('Error fetching blog:', error);
      navigate('/admin/blogs');
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedBlogs = async (category, currentBlogId) => {
    try {
      // Fetch more items to ensure we have enough to randomize
      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs?category=${category}&published=true&limit=10`);
      if (response.ok) {
        const data = await response.json();
        // Filter out current blog
        let related = data.data.filter(blog => blog._id !== currentBlogId);

        // Shuffle the array to show random related blogs
        for (let i = related.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [related[i], related[j]] = [related[j], related[i]];
        }

        setRelatedBlogs(related.slice(0, 3));
      }
    } catch (error) {
      console.error('Error fetching related blogs:', error);
    }
  };

  const checkLikeStatus = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs/${blog._id}/like-status`);

      if (response.ok) {
        const data = await response.json();
        setLiked(data.data.isLiked);
      }
    } catch (error) {
      console.error('Error checking like status:', error);
    }
  };

  const handleLike = async () => {
    if (likeLoading) return;

    setLikeLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs/${blog._id}/like`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setLiked(data.data.isLiked);
        setBlog(prev => ({ ...prev, likes: data.data.likes }));
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Error updating like');
      }
    } catch (error) {
      console.error('Error liking blog:', error);
      toast.error('Error updating like');
    } finally {
      setLikeLoading(false);
    }
  };

  const autoResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  const handleCommentChange = (e) => {
    setComment(e.target.value);
    autoResizeTextarea();
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setCommentLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs/${blog._id}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: comment })
      });

      if (response.ok) {
        const responseData = await response.json();
        setComments(prevComments => [...prevComments, responseData.data]);
        setComment('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      } else {
        const errorData = await response.json();
        if (response.status === 401) {
          toast.info('Please log in to comment');
        } else {
          toast.error(errorData.message || 'Error adding comment');
        }
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setCommentLoading(false);
    }
  };

  const startEditing = (comment) => {
    setEditingCommentId(comment._id);
    setEditContent(comment.content);
  };

  const cancelEditing = () => {
    setEditingCommentId(null);
    setEditContent('');
  };

  const handleUpdateComment = async (commentId) => {
    if (!editContent.trim()) return;

    // Find the original comment to compare
    const originalComment = comments.find(c => c._id === commentId);
    if (originalComment && originalComment.content === editContent.trim()) {
      setEditingCommentId(null);
      return;
    }

    setIsEditingLoading(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/blogs/${blog._id}/comment/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent })
      });
      if (res.ok) {
        const data = await res.json();
        setComments(prev => prev.map(c => c._id === commentId ? data.data : c));
        setEditingCommentId(null);
        toast.success("Comment updated");
      } else {
        toast.error("Failed to update comment");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error updating comment");
    } finally {
      setIsEditingLoading(false);
    }
  };

  const handleDeleteComment = (commentId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Comment',
      message: 'Are you sure you want to delete this comment?',
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs/${blog._id}/comment/${commentId}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            setComments(prev => prev.filter(c => c._id !== commentId));
            toast.success("Comment deleted");
          } else {
            toast.error("Failed to delete comment");
          }
        } catch (error) {
          console.error("Error deleting comment:", error);
          toast.error("Error deleting comment");
        }
      }
    });
  };

  const handleDelete = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Blog Post?',
      message: `Are you sure you want to delete "${blog.title}"? This action is permanent and cannot be undone.`,
      confirmText: 'Yes, Delete',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs/${blog._id}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            toast.success('Blog deleted successfully');
            navigate('/admin/blogs');
          } else {
            toast.error('Error deleting blog');
          }
        } catch (error) {
          console.error('Error deleting blog:', error);
          toast.error('Error deleting blog');
        }
      }
    });
  };

  const handleTogglePublish = async () => {
    if (blog.published) {
      setConfirmModal({
        isOpen: true,
        title: 'Unpublish Blog?',
        message: `This will hide "${blog.title}" from the public. You can publish it again later.`,
        confirmText: 'Unpublish',
        isDestructive: false,
        onConfirm: () => updatePublishStatus(false)
      });
    } else {
      await updatePublishStatus(!blog.published);
    }
  };

  const updatePublishStatus = async (newStatus) => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs/${blog._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ published: newStatus })
      });

      if (response.ok) {
        setBlog(prev => ({ ...prev, published: newStatus }));
        toast.info(`Blog ${newStatus ? 'published' : 'unpublished'}`);
      } else {
        toast.error('Error updating blog status');
      }
    } catch (error) {
      console.error('Error updating blog:', error);
      toast.error('Error updating blog status');
    }
  };

  const handleEdit = () => {
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
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs/${blog._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          propertyId: formData.propertyId || null
        })
      });

      if (response.ok) {
        const data = await response.json();
        setBlog(data.data);
        setShowEditModal(false);
        toast.success('Blog updated successfully!');
      } else {
        toast.error('Error updating blog');
      }
    } catch (error) {
      console.error('Error updating blog:', error);
      toast.error('Error updating blog');
    }
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
      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };


  const handleShare = () => {
    setShareModal({
      isOpen: true,
      url: window.location.href,
      title: blog.title,
      description: blog.excerpt || blog.title
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleImageClick = (index) => {
    setSelectedImageIndex(index);
    setShowImagePreview(true);
  };

  if (loading) {
    return <BlogDetailSkeleton />;
  }

  if (!blog) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans text-slate-800 dark:text-gray-100 pb-20">

      {/* Hero Header - Matching PublicBlogDetail but with Admin twist */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 text-white relative overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
          <div className="absolute top-[-50%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-400 blur-3xl animate-pulse"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-500 blur-3xl animate-pulse" style={{ animationDelay: "2s" }}></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pt-10 pb-24 relative z-10">
          <button
            onClick={() => navigate(blog.type === 'guide' ? '/admin/guides' : '/admin/blogs')}
            className="flex items-center gap-2 text-blue-200 hover:text-white transition-colors mb-6 group bg-white/10 px-4 py-2 rounded-full w-fit backdrop-blur-sm"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span className="font-medium text-sm">Back to {blog.type === 'guide' ? 'Guides' : 'Blogs'} Management</span>
          </button>

          <div className="animate-fade-in-up">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${blog.published
                ? 'bg-green-500/20 text-green-200 border border-green-500/30'
                : 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/30'
                }`}>
                {blog.published ? <span className='flex items-center gap-1'><CheckCircle className='w-3 h-3' /> Published</span> : <span className='flex items-center gap-1'><Clock className='w-3 h-3' /> Draft Mode</span>}
              </span>

              {blog.featured && (
                <span className="px-3 py-1 bg-yellow-500/30 backdrop-blur-md border border-yellow-400/30 rounded-full text-xs font-bold uppercase tracking-wider text-yellow-200 flex items-center gap-1 shadow-lg shadow-yellow-500/10">
                  <Star className="w-3 h-3 fill-yellow-400" /> Featured
                </span>
              )}

              <span className="px-3 py-1 bg-blue-500/30 backdrop-blur-md border border-blue-400/30 rounded-full text-xs font-semibold uppercase tracking-wider text-blue-100">
                {blog.category}
              </span>
            </div>

            <h1 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-100 drop-shadow-sm max-w-4xl">
              {blog.title}
            </h1>

            <div className="flex flex-wrap items-center gap-6 text-sm text-blue-200 border-t border-white/10 pt-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-white shadow-md border border-indigo-400">
                  {blog.author?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <span className="block text-xs text-blue-300">Author</span>
                  <span className="font-medium text-white">{blog.author?.username || 'UrbanSetu Team'}</span>
                </div>
              </div>

              <div className="h-8 w-px bg-white/10 hidden sm:block"></div>

              <div className="flex items-center gap-3">
                <div title="Published Date">
                  <span className="block text-xs text-blue-300">Date</span>
                  <div className="flex items-center gap-1 text-white font-medium">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(blog.publishedAt || blog.createdAt)}
                  </div>
                </div>

                <div className="h-8 w-px bg-white/10 hidden sm:block mx-2"></div>

                <div title="Views">
                  <span className="block text-xs text-blue-300">Engagement</span>
                  <div className="flex items-center gap-3 text-white font-medium">
                    <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {blog.views || 0}</span>
                    <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-red-400" /> {blog.likes || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-8 -mt-16 relative z-20">

        {/* Main Content Column */}
        <div className="lg:col-span-8 space-y-8">

          {/* Main Card */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in-up">

            {/* Media Gallery */}
            <div className="relative group bg-gray-900 border-b border-gray-100">
              <Swiper
                modules={[Navigation]}
                navigation={true}
                className="h-[400px] md:h-[500px]"
                onSlideChange={(swiper) => setSelectedImageIndex(swiper.activeIndex)}
              >
                {(() => {
                  const images = blog.imageUrls || [];
                  const videos = blog.videoUrls || [];
                  const mediaItems = [
                    ...(blog.thumbnail ? [{ type: 'image', url: blog.thumbnail }] : []),
                    ...images.map((u) => ({ type: 'image', url: u })),
                    ...videos.map((u, vi) => ({ type: 'video', url: u, vIndex: vi })),
                  ];
                  return mediaItems.length > 0 ? mediaItems.map((item, index) => (
                    <SwiperSlide key={index}>
                      <div className="relative w-full h-full flex items-center justify-center bg-gray-900">
                        {item.type === 'image' ? (
                          <AdvancedImage
                            src={item.url}
                            alt=""
                            className="w-full h-full bg-black/50 backdrop-blur-xl"
                            style={{ backgroundImage: `url(${item.url})`, backgroundSize: 'cover', backgroundBlendMode: 'overlay' }}
                            onClick={() => handleImageClick(index)}
                          />
                        ) : (
                          <div className="relative w-full h-full flex items-center justify-center cursor-pointer group" onClick={() => { setSelectedVideoIndex(item.vIndex); setShowVideoPreview(true); }}>
                            <video src={item.url} className="w-full h-full object-contain bg-black" muted playsInline />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                              <Play className="w-16 h-16 text-white opacity-80 group-hover:opacity-100 transition-all drop-shadow-lg fill-white/20" />
                            </div>
                          </div>
                        )}

                        {/* Media Type Badge */}
                        <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 shadow-lg pointer-events-none">
                          {item.type === 'video' ? (
                            <>
                              <Play className="w-3.5 h-3.5 text-white fill-white" />
                              <span className="text-xs font-bold text-white tracking-wide uppercase">Video</span>
                            </>
                          ) : (
                            <>
                              <ImageIcon className="w-3.5 h-3.5 text-white" />
                              <span className="text-xs font-bold text-white tracking-wide uppercase">Image</span>
                            </>
                          )}
                        </div>

                        {item.type === 'image' && (
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all cursor-pointer flex items-center justify-center pointer-events-none">
                            <div className="bg-white/20 backdrop-blur-md p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity transform scale-90 group-hover:scale-100 duration-300">
                              <Maximize2 className="text-white w-8 h-8" />
                            </div>
                          </div>
                        )}
                      </div>
                    </SwiperSlide>
                  )) : (
                    <SwiperSlide>
                      <div className="w-full h-full bg-gray-50 dark:bg-gray-900/40 flex items-center justify-center transition-colors duration-300">
                        <div className="text-center text-gray-400 dark:text-gray-500 flex flex-col items-center">
                          <div className="text-6xl mb-4 opacity-80">🏠</div>
                          <p className="text-xs font-bold uppercase tracking-widest opacity-70">No media available</p>
                        </div>
                      </div>
                    </SwiperSlide>
                  )
                })()}
              </Swiper>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-10 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm"
                >
                  <Edit className="w-4 h-4" /> Edit Content
                </button>
                <button
                  onClick={handleTogglePublish}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors shadow-sm font-medium text-sm border ${blog.published
                    ? 'bg-white dark:bg-gray-700 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30'
                    : 'bg-green-600 text-white border-transparent hover:bg-green-700'
                    }`}
                >
                  {blog.published ? 'Unpublish' : 'Publish Now'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Delete Blog"
                >
                  <Trash className="w-5 h-5" />
                </button>
                <button
                  onClick={handleShare}
                  className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Share"
                >
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-8 md:p-10">

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-8">
                {blog.tags && blog.tags.map((tag, i) => (
                  <span key={i} className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md text-sm font-medium">
                    <Tag className="w-3.5 h-3.5" /> {tag}
                  </span>
                ))}
              </div>

              {/* Markdown Content */}
              <div className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-black prose-headings:text-gray-900 dark:prose-headings:text-white prose-p:text-gray-600 dark:prose-p:text-gray-300 prose-li:text-gray-600 dark:prose-li:text-gray-300 prose-strong:text-gray-900 dark:prose-strong:text-white prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-img:rounded-2xl prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-blue-900/20 prose-blockquote:py-2 prose-blockquote:px-5 prose-blockquote:not-italic cursor-default">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{blog.content}</ReactMarkdown>
              </div>

            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 p-8 animate-fade-in-up" id="comments">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-blue-500" />
                Discussion
                <span className="text-gray-400 dark:text-gray-500 text-lg font-normal">({comments.length})</span>
              </h3>
              <button
                onClick={() => setShowComments(!showComments)}
                className="text-blue-600 dark:text-blue-400 font-medium hover:underline text-sm"
              >
                {showComments ? 'Hide Comments' : 'Show Comments'}
              </button>
            </div>

            {showComments && (
              <>
                <form onSubmit={handleComment} className="mb-10 relative">
                  <textarea
                    ref={textareaRef}
                    value={comment}
                    onChange={handleCommentChange}
                    placeholder="Post an official response or comment..."
                    className="w-full pl-5 pr-16 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl focus:bg-white dark:focus:bg-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 focus:border-blue-400 dark:focus:border-blue-500 outline-none transition-all resize-none min-h-[80px]"
                  />
                  <button
                    type="submit"
                    disabled={!comment.trim() || commentLoading}
                    className="absolute right-3 bottom-3 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors flex items-center justify-center min-w-[36px] min-h-[36px]"
                  >
                    {commentLoading ? (
                      <UrbanSetuSpinner size="sm" isBright={true} />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </form>

                <div className="space-y-6">
                  {comments.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>No comments yet.</p>
                    </div>
                  ) : (
                    comments.map((comment, index) => {
                      const isAdmin = comment.user?.username === 'UrbanSetuBlogManagement' || comment.user?.role === 'admin';
                      return (
                        <div key={index} className={`flex gap-4 group ${isAdmin ? 'bg-blue-50/50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800' : 'p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent'}`}>
                          <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white shadow-sm ${isAdmin ? 'bg-blue-600' : 'bg-gray-400'}`}>
                            {comment.user?.username?.[0]?.toUpperCase() || 'A'}
                          </div>
                          <div className="flex-grow">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className={`font-bold text-sm ${isAdmin ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
                                  {isAdmin ? 'UrbanSetu Team' : comment.user?.username || 'Anonymous'}
                                </span>
                                {isAdmin && <span className="text-[10px] bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide">Admin</span>}
                                <span className="text-xs text-gray-400">• {new Date(comment.createdAt).toLocaleDateString()}</span>
                                {comment.isEdited && (
                                  <span className="text-[10px] text-gray-400 italic bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                    <Check className="w-2.5 h-2.5" /> Edited
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {editingCommentId !== comment._id && (
                                  <button
                                    onClick={() => startEditing(comment)}
                                    className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                                    title="Edit Comment"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteComment(comment._id)}
                                  className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 transition-opacity p-1"
                                  title="Delete Comment"
                                >
                                  <Trash className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            {editingCommentId === comment._id ? (
                              <div className="mt-2">
                                <textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none text-gray-900 dark:text-white"
                                  rows={2}
                                />
                                <div className="flex gap-2 mt-2 justify-end">
                                  <button
                                    onClick={cancelEditing}
                                    className="p-1 px-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-800"
                                    disabled={isEditingLoading}
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleUpdateComment(comment._id)}
                                    className="p-1 px-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors border border-transparent hover:border-green-100 dark:hover:border-green-800 min-w-[32px] flex items-center justify-center"
                                    disabled={isEditingLoading || !editContent.trim()}
                                  >
                                    {isEditingLoading ? (
                                      <UrbanSetuSpinner size="sm" />
                                    ) : (
                                      <Check className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm whitespace-pre-wrap">{comment.content}</p>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </div>

        </div>

        {/* Sidebar Column */}
        <div className="lg:col-span-4 space-y-6">

          {/* Property Card */}
          {blog.propertyId && (
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 animate-fade-in-up overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Home className="w-24 h-24 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-4 flex items-center gap-2 relative z-10">
                <Home className="w-5 h-5 text-blue-500" /> Linked Property
              </h3>

              <div className="relative z-10 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-100 dark:border-gray-600 text-center mb-4">
                <h4 className="font-bold text-gray-800 dark:text-white text-lg mb-1">{blog.propertyId.name}</h4>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{blog.propertyId.city}, {blog.propertyId.state}</p>
              </div>

              <Link
                to={`/admin/listing/${blog.propertyId._id}`}
                className="flex items-center justify-center gap-2 w-full py-3 bg-white dark:bg-gray-700 border-2 border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              >
                View Details <ArrowLeft className="w-4 h-4 rotate-180" />
              </Link>
            </div>
          )}

          {/* Admin Stats Card */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-6">Performance</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">{blog.views || 0}</div>
                <div className="text-xs text-blue-400 dark:text-blue-300 uppercase font-semibold">Total Views</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">{blog.likes || 0}</div>
                <div className="text-xs text-purple-400 dark:text-purple-300 uppercase font-semibold">Likes</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-1">{comments.length}</div>
                <div className="text-xs text-orange-400 dark:text-orange-300 uppercase font-semibold">Comments</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">{relatedBlogs.length}</div>
                <div className="text-xs text-green-400 dark:text-green-300 uppercase font-semibold">Related</div>
              </div>
            </div>
          </div>

          {/* Related Blogs */}
          {relatedBlogs.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-400" /> Recent Related
              </h3>
              <div className="space-y-6">
                {relatedBlogs.map((related, i) => (
                  <div key={related._id} className="group cursor-pointer flex gap-4 items-start" onClick={() => navigate(`/admin/${related.type === 'guide' ? 'guide' : 'blog'}/${related.slug || related._id}`)}>
                    <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-700 relative">
                      {related.thumbnail ? (
                        <img src={related.thumbnail} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-500"><Tag className="w-6 h-6" /></div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800 dark:text-white text-sm leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 mb-1">
                        {related.title}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        {new Date(related.publishedAt || related.createdAt).toLocaleDateString()}
                      </p>
                      <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">{related.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        confirmText={confirmModal.confirmText}
        isDestructive={confirmModal.isDestructive}
      />

      {/* Image Preview Modal */}
      {blog && ((blog.thumbnail) || (blog.imageUrls && blog.imageUrls.length > 0)) && (
        <ImagePreview
          isOpen={showImagePreview}
          onClose={() => setShowImagePreview(false)}
          images={[
            ...(blog.thumbnail ? [blog.thumbnail] : []),
            ...(blog.imageUrls || [])
          ]}
          initialIndex={selectedImageIndex}
          listingId={blog._id}
          metadata={{
            addedFrom: 'blog',
            blogTitle: blog.title,
            blogCategory: blog.category
          }}
        />
      )}

      {/* Video Preview Modal */}
      {blog && blog.videoUrls && blog.videoUrls.length > 0 && (
        <VideoPreview
          isOpen={showVideoPreview}
          onClose={() => setShowVideoPreview(false)}
          videos={blog.videoUrls}
          initialIndex={selectedVideoIndex}
        />
      )}

      {/* Edit Modal */}
      <BlogEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEditSubmit}
        formData={formData}
        setFormData={setFormData}
        properties={properties}
        categories={categories}
        propertySearch={propertySearch}
        setPropertySearch={setPropertySearch}
        isEdit={true}
      />
      <SocialSharePanel
        isOpen={shareModal.isOpen}
        onClose={() => setShareModal({ ...shareModal, isOpen: false })}
        url={shareModal.url}
        title={shareModal.title}
        description={shareModal.description}
      />
    </div>
  );
};

export default AdminBlogDetail;
