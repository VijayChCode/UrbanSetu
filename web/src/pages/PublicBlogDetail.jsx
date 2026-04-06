import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/navigation';
import { Navigation } from 'swiper/modules';
import { toast } from 'react-toastify';
import {
  Calendar, User, Eye, Heart, Tag, ArrowLeft, Share2, MessageSquare,
  Home, Maximize2, X, ThumbsUp, Send, Clock, Play, Image as ImageIcon, Trash, Edit, Check, Star
} from 'lucide-react';
import { useSelector } from 'react-redux';
import ImagePreview from '../components/ImagePreview';
import VideoPreview from '../components/VideoPreview';
import BlogDetailSkeleton from '../components/skeletons/BlogDetailSkeleton';
import ConfirmationModal from '../components/ConfirmationModal';
import SocialSharePanel from '../components/SocialSharePanel';

import SEO from '../components/SEO';
import { authenticatedFetch } from '../utils/auth';
import AdvancedImage from '../components/AdvancedImage';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';

const PublicBlogDetail = () => {

  const { slug } = useParams();
  const navigate = useNavigate();
  const [blog, setBlog] = useState(null);
  const [relatedBlogs, setRelatedBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [commentLoading, setCommentLoading] = useState(false);
  const textareaRef = useRef(null);

  const { currentUser } = useSelector((state) => state.user);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [isEditingLoading, setIsEditingLoading] = useState(false);

  // SEO Dynamic Tags
  const seoTitle = blog ? `${blog.title} | UrbanSetu Insights` : "Blog Detail";
  const seoDescription = blog ? (blog.excerpt || blog.content?.replace(/<[^>]*>/g, '').substring(0, 160)) : "Read real estate insights on UrbanSetu.";
  const seoImage = blog?.thumbnail || (blog?.imageUrls && blog.imageUrls[0]) || `${window.location.origin}/og-image.png`;

  const blogSchema = blog ? {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": blog.title,
    "image": [seoImage],
    "datePublished": blog.publishedAt || blog.createdAt,
    "dateModified": blog.updatedAt || blog.createdAt,
    "author": [{
      "@type": "Person",
      "name": blog.author?.username || "UrbanSetu Team",
      "url": `${window.location.origin}/about`
    }]
  } : null;
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    isDestructive: false,
    confirmText: 'Confirm'
  });
  const [shareModal, setShareModal] = useState({ isOpen: false, url: '', title: '', description: '' });

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://urbansetu-pvt4.onrender.com';

  useEffect(() => {
    fetchBlog();
  }, [slug]);

  useEffect(() => {
    if (blog) {
      checkLikeStatus();
    }
  }, [blog]);

  const fetchBlog = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs/${slug}`, { autoRedirect: false });

      if (response.ok) {
        const data = await response.json();
        setBlog(data.data);
        setComments(data.data.comments || []);
        fetchRelatedBlogs(data.data.category, data.data._id);
      } else {
        console.log(`Blog with slug "${slug}" not found`);
        navigate('/blogs');
      }
    } catch (error) {
      console.error('Error fetching blog:', error);
      navigate('/blogs');
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedBlogs = async (category, currentBlogId) => {
    try {
      // Fetch more items to ensure we have enough to randomize
      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs?category=${category}&published=true&limit=10`, { autoRedirect: false });
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
      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs/${blog._id}/like-status`, { autoRedirect: false });

      if (response.ok) {
        const data = await response.json();
        setLiked(data.data.isLiked);
        setIsLoggedIn(true);
      } else if (response.status === 401) {
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error('Error checking like status:', error);
      setIsLoggedIn(false);
    }
  };

  const handleLike = async () => {
    if (likeLoading) return;

    setLikeLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs/${blog._id}/like`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        setLiked(data.data.isLiked);
        setBlog(prev => ({ ...prev, likes: data.data.likes }));
        setIsLoggedIn(true);
      } else {
        if (response.status === 401) {
          toast.info('Please log in to like this blog');
          setIsLoggedIn(false);
        } else {
          const errorData = await response.json();
          toast.error(errorData.message || 'Error updating like');
        }
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

  const handleDeleteComment = (commentId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Comment',
      message: 'Are you sure you want to delete this comment? This action cannot be undone.',
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await authenticatedFetch(`${API_BASE_URL}/api/blogs/${blog._id}/comment/${commentId}`, {
            method: 'DELETE'
          });
          if (res.ok) {
            setComments(prev => prev.filter(c => c._id !== commentId));
            toast.success("Comment deleted");
          } else {
            toast.error("Failed to delete comment");
          }
        } catch (error) {
          console.error(error);
          toast.error("Error deleting comment");
        }
      }
    });
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
        setComments(prev => prev.map(c => c._id === commentId ? data.data : c)); // Update with returned data
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
    return null; // Redirects handled in fetchBlog
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans text-slate-800 dark:text-gray-100 pb-20 transition-colors duration-300">
      <SEO
        title={seoTitle}
        description={seoDescription}
        image={seoImage}
        type="article"
        keywords={`${blog?.category}, ${blog?.tags?.join(', ')}, real estate insights`}
        schema={blogSchema}
      />
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white relative overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
          <div className="absolute top-[-50%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-400 blur-3xl animate-pulse"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-500 blur-3xl animate-pulse" style={{ animationDelay: "2s" }}></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pt-12 pb-24 relative z-10">
          <button
            onClick={() => navigate(blog.type === 'guide' ? '/guides' : '/blogs')}
            className="flex items-center gap-2 text-blue-200 hover:text-white transition-colors mb-8 group"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            <span className="font-medium">Back to {blog.type === 'guide' ? 'Guides' : 'Blogs'}</span>
          </button>

          <div className="animate-fade-in-up">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-blue-500/30 backdrop-blur-md border border-blue-400/30 rounded-full text-xs font-semibold uppercase tracking-wider text-blue-100">
                {blog.category}
              </span>
              {blog.featured && (
                <span className="px-3 py-1 bg-yellow-500/30 backdrop-blur-md border border-yellow-400/30 rounded-full text-xs font-bold uppercase tracking-wider text-yellow-200 flex items-center gap-1 shadow-lg shadow-yellow-500/10">
                  <Star className="w-3 h-3 fill-yellow-400" /> Featured
                </span>
              )}
              {blog.tags && blog.tags.map((tag, i) => (
                <span key={i} className="flex items-center gap-1 text-xs text-blue-200 bg-white/5 px-2 py-1 rounded-md border border-white/10">
                  <Tag className="w-3 h-3" /> {tag}
                </span>
              ))}
            </div>

            <h1 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-100 drop-shadow-sm">
              {blog.title}
            </h1>

            <div className="flex flex-wrap items-center gap-6 text-sm text-blue-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white shadow-md border border-blue-400">
                  {blog.author?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="font-medium text-white">{blog.author?.username || 'UrbanSetu Team'}</span>
              </div>
              <div className="flex items-center gap-2" title="Published Date">
                <Calendar className="w-4 h-4 text-blue-300" />
                <span>{formatDate(blog.publishedAt || blog.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2" title="Views">
                <Eye className="w-4 h-4 text-blue-300" />
                <span>{blog.views || 0} views</span>
              </div>
              <div className="flex items-center gap-2" title="Likes">
                <Heart className="w-4 h-4 text-red-400 fill-red-400" />
                <span>{blog.likes || 0} likes</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-8 -mt-16 relative z-20">

        {/* Main Content Column */}
        <div className="lg:col-span-8 space-y-8">
          {/* Detailed Content Card */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-fade-in-up transition-colors">

            {/* Media Gallery */}
            <div className="relative group bg-gray-900">
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
                            className="w-full h-full"
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
                        {/* Overlay for Click instruction */}
                        {item.type === 'image' && (
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all cursor-pointer flex items-center justify-center pointer-events-none">
                            <div className="bg-white/20 backdrop-blur-md p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                              <Maximize2 className="text-white w-6 h-6" />
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

            {/* Article Content */}
            <div className="p-8 md:p-12">
              {/* Property Link if Exists */}
              {blog.propertyId && (
                <div className="mb-8 p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 flex items-center justify-between group hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer" onClick={() => navigate(`/listing/${blog.propertyId._id}`)}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 transition-colors">
                      <Home className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-white text-sm md:text-base transition-colors">Related Property</h3>
                      <p className="text-blue-600 dark:text-blue-400 font-medium text-xs md:text-sm group-hover:underline transition-colors">{blog.propertyId.name}</p>
                    </div>
                  </div>
                  <ArrowLeft className="rotate-180 w-5 h-5 text-blue-400 group-hover:translate-x-1 transition-transform" />
                </div>
              )}

              <div className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-black prose-headings:text-gray-900 dark:prose-headings:text-white prose-p:text-gray-600 dark:prose-p:text-gray-300 prose-li:text-gray-600 dark:prose-li:text-gray-300 prose-strong:text-gray-900 dark:prose-strong:text-white prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-img:rounded-2xl transition-colors">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{blog.content}</ReactMarkdown>
              </div>

              {/* Actions Bar */}
              <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-4 justify-between items-center transition-colors">
                <div className="flex gap-4">
                  <button
                    onClick={handleLike}
                    disabled={likeLoading}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${liked
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800 shadow-sm'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent dark:border-gray-700'
                      }`}
                  >
                    <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
                    <span>{blog.likes || 0}</span>
                  </button>

                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-all border border-transparent dark:border-gray-700"
                  >
                    <Share2 className="w-5 h-5" />
                    <span>Share</span>
                  </button>
                </div>

                <button
                  onClick={() => setShowComments(!showComments)}
                  className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>{comments.length} Comments</span>
                </button>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          {showComments && (
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 p-8 animate-fade-in-up transition-colors">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 flex items-center gap-2 transition-colors">
                <MessageSquare className="w-6 h-6 text-blue-500" /> Discussion
              </h3>

              <form onSubmit={handleComment} className="mb-10 relative">
                <textarea
                  ref={textareaRef}
                  value={comment}
                  onChange={handleCommentChange}
                  placeholder="Share your thoughts..."
                  className="w-full pl-5 pr-16 py-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 outline-none text-gray-900 dark:text-white transition-all resize-none min-h-[80px]"
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
                    <p>No comments yet. Start the conversation!</p>
                  </div>
                ) : (
                  comments.map((comment, index) => {
                    const isAdmin = comment.user?.username === 'UrbanSetuBlogManagement';
                    const isOwner = currentUser && (comment.user?._id === currentUser._id || comment.user === currentUser._id); // Check ID match

                    return (
                      <div key={index} className={`flex gap-4 group ${isAdmin ? 'bg-blue-50/50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800' : ''}`}>
                        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white shadow-sm transition-colors ${isAdmin ? 'bg-blue-600' : 'bg-gray-400'}`}>
                          {comment.user?.username?.[0]?.toUpperCase() || 'A'}
                        </div>
                        <div className="flex-grow">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold text-sm transition-colors ${isAdmin ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                                {isAdmin ? 'UrbanSetu Team' : comment.user?.username || 'Anonymous'}
                              </span>
                              {isAdmin && <span className="text-[10px] bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide">Admin</span>}
                              <span className="text-xs text-gray-400 dark:text-gray-500">• {new Date(comment.createdAt).toLocaleDateString()}</span>
                              {comment.isEdited && (
                                <span className="text-[10px] text-gray-400 italic bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5" /> Edited
                                </span>
                              )}
                            </div>

                            {isOwner && editingCommentId !== comment._id && (
                              <div className="flex items-center gap-2 transition-opacity">
                                <button onClick={() => startEditing(comment)} className="text-gray-400 hover:text-blue-500 transition-colors p-1" title="Edit">
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleDeleteComment(comment._id)} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Delete">
                                  <Trash className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          {editingCommentId === comment._id ? (
                            <div className="mt-2">
                              <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                rows={2}
                              />
                              <div className="flex gap-2 mt-2 justify-end">
                                <button onClick={cancelEditing} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" disabled={isEditingLoading}>
                                  <X className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleUpdateComment(comment._id)}
                                  className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded min-w-[28px] flex items-center justify-center"
                                  disabled={isEditingLoading}
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
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm transition-colors whitespace-pre-wrap">{comment.content}</p>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Column */}
        <div className="lg:col-span-4 space-y-8">
          {/* Author/CTA Card */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 text-center lg:sticky lg:top-8 animate-fade-in-up transition-colors" style={{ animationDelay: '0.1s' }}>
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
              {blog.author?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 transition-colors">{blog.author?.username || 'UrbanSetu Team'}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 transition-colors">Real Estate Expert</p>
            <button onClick={() => navigate('/contact')} className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl">
              Contact Author
            </button>
          </div>

          {/* Related Posts */}
          {relatedBlogs.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 animate-fade-in-up transition-colors" style={{ animationDelay: '0.2s' }}>
              <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-6 flex items-center gap-2 transition-colors">
                <Clock className="w-5 h-5 text-blue-500" /> Real Estate Reads
              </h3>
              <div className="space-y-6">
                {relatedBlogs.map((related, i) => (
                  <div key={related._id} className="group cursor-pointer" onClick={() => navigate(`/${related.type === 'guide' ? 'guide' : 'blog'}/${related.slug || related._id}`)}>
                    <div className="aspect-video rounded-xl overflow-hidden mb-3 relative bg-gray-100/50 dark:bg-gray-800/50">
                      {related.thumbnail ? (
                        <AdvancedImage src={related.thumbnail} className="w-full h-full transition-transform duration-500 group-hover:scale-110" alt={related.title} />
                      ) : (related.imageUrls && related.imageUrls.length > 0) ? (
                        <AdvancedImage src={related.imageUrls[0]} className="w-full h-full transition-transform duration-500 group-hover:scale-110" alt={related.title} />
                      ) : (related.videoUrls && related.videoUrls.length > 0) ? (
                        <div className="w-full h-full relative">
                          <video
                            src={related.videoUrls[0]}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            muted
                            loop
                            playsInline
                            onMouseOver={(e) => e.currentTarget.play()}
                            onMouseOut={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300"><Tag className="w-8 h-8 opacity-20" /></div>
                      )}

                      {/* Type Indicator Badge */}
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md p-1.5 rounded-full pointer-events-none z-10 flex items-center justify-center">
                        {(related.videoUrls && related.videoUrls.length > 0) ? (
                          <Play className="w-3 h-3 text-white fill-white" />
                        ) : (related.thumbnail || (related.imageUrls && related.imageUrls.length > 0)) ? (
                          <ImageIcon className="w-3 h-3 text-white" />
                        ) : (
                          <Tag className="w-3 h-3 text-white" />
                        )}
                      </div>

                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="text-white text-xs font-bold border border-white/50 px-3 py-1 rounded-full backdrop-blur-sm">Read Article</span>
                      </div>
                    </div>
                    <h4 className="font-bold text-gray-800 dark:text-gray-200 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 mb-1">
                      {related.title}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
                      {new Date(related.publishedAt || related.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

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


      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        confirmText={confirmModal.confirmText}
        isDestructive={confirmModal.isDestructive}
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

export default PublicBlogDetail;
