import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FaUsers, FaUser, FaMapMarkerAlt, FaBullhorn, FaShieldAlt, FaEnvelope, FaStore, FaComment, FaThumbsUp, FaThumbsDown, FaShare, FaPlus, FaSearch, FaCalendarAlt, FaEllipsisH, FaTimes, FaImage, FaArrowRight, FaArrowLeft, FaLock, FaFlag, FaLeaf, FaCamera, FaTrash, FaCheckCircle, FaExclamationTriangle, FaCalendar, FaTimesCircle, FaEdit, FaSmile, FaFire } from 'react-icons/fa';
import EmojiPicker from 'emoji-picker-react';
import { toast } from 'react-toastify';
import CommunitySkeleton from '../components/skeletons/CommunitySkeleton';
import SEO from '../components/SEO';
import { usePageTitle } from '../hooks/usePageTitle';
import ConfirmationModal from '../components/ConfirmationModal';
import { socket } from '../utils/socket';
import ReportModal from '../components/ReportModal';
import UserAvatar from '../components/UserAvatar';
import SocialSharePanel from '../components/SocialSharePanel';
import { authenticatedFetch } from '../utils/auth';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';

export default function Community() {
    usePageTitle("Community Hub - Neighborhood Forum");
    const { currentUser } = useSelector((state) => state.user);
    const navigate = useNavigate();
    const { postId } = useParams();

    // Keyframes for inline styles
    const styles = `
@keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
}
.animate-fade-in-up {
    animation: fadeInUp 0.5s ease-out forwards;
}
.animate-fade-in {
    animation: fadeIn 0.3s ease-out forwards;
}
.hide-scrollbar::-webkit-scrollbar {
    display: none !important;
}
.hide-scrollbar {
    -ms-overflow-style: none !important;
    scrollbar-width: none !important;
}
`;

    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [showMyPosts, setShowMyPosts] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // Modal State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        isDestructive: false
    });
    const [reportModal, setReportModal] = useState({ isOpen: false, type: 'post', id: null, commentId: null, replyId: null });
    const [shareModal, setShareModal] = useState({ isOpen: false, url: '', title: '', description: '' });
    const [activeReplyInput, setActiveReplyInput] = useState(null); // ID of comment or reply being replied to
    const [editingContent, setEditingContent] = useState({ type: null, id: null, content: '' });
    const [editingPost, setEditingPost] = useState(null); // State for editing main post content

    // Reply State
    const [replyingTo, setReplyingTo] = useState(null); // { postId, commentId }
    const [replyText, setReplyText] = useState('');
    const [expandedReplies, setExpandedReplies] = useState({}); // { commentId: boolean }
    const [activeTab, setActiveTab] = useState('All');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [stats, setStats] = useState({
        activeMembers: 0,
        dailyPosts: 0,
        eventsThisWeek: 0,
        trendingTopics: []
    });
    const [expandedComments, setExpandedComments] = useState({});
    const [commentText, setCommentText] = useState({});
    const [commentsLoading, setCommentsLoading] = useState({});
    const [repliesLoading, setRepliesLoading] = useState({});

    const sortedPosts = useMemo(() => {
        if (!posts) return [];
        return [...posts].sort((a, b) => {
            // 1. Pinned
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;

            // 2. Trending Rank
            const trendIndexA = stats.trendingTopics ? stats.trendingTopics.findIndex(t => t._id === a._id) : -1;
            const trendIndexB = stats.trendingTopics ? stats.trendingTopics.findIndex(t => t._id === b._id) : -1;

            if (trendIndexA !== -1 && trendIndexB !== -1) return trendIndexA - trendIndexB;
            if (trendIndexA !== -1) return -1;
            if (trendIndexB !== -1) return 1;

            // 3. Created Date (Newest first)
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    }, [posts, stats.trendingTopics]);

    // Property Mention State
    const [propertySuggestions, setPropertySuggestions] = useState([]);
    const [showMentionSuggestions, setShowMentionSuggestions] = useState({ show: false, query: '', type: null, id: null }); // type: 'post' | 'comment' | 'reply'
    const [mentionSearchLoading, setMentionSearchLoading] = useState(false);
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

    // Emoji Picker State
    const [showEmojiPicker, setShowEmojiPicker] = useState({ show: false, type: null, id: null });

    const handleEmojiClick = (emojiData, type, id) => {
        if (type === 'reply') {
            setReplyText(prev => prev + emojiData.emoji);
        } else if (type === 'comment') {
            setCommentText(prev => ({ ...prev, [id]: (prev[id] || '') + emojiData.emoji }));
        } else if (type === 'post') {
            setNewPost(prev => ({ ...prev, content: prev.content + emojiData.emoji }));
        } else if (type === 'edit-post') {
            setEditingPost(prev => ({ ...prev, content: prev.content + emojiData.emoji }));
        } else if (type === 'edit-comment' || type === 'edit-reply') {
            setEditingContent(prev => ({ ...prev, content: prev.content + emojiData.emoji }));
        }
    };
    // Create Post State
    const [newPost, setNewPost] = useState({
        title: '',
        content: '',
        category: 'General',
        location: {
            city: '',
            neighborhood: ''
        }
    });
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const categories = [
        { id: 'All', icon: FaUsers, label: 'All Posts' },
        { id: 'General', icon: FaComment, label: 'General' },
        { id: 'Neighborhood', icon: FaMapMarkerAlt, label: 'Neighborhood' },
        { id: 'Events', icon: FaCalendarAlt, label: 'Events' },
        { id: 'Safety', icon: FaShieldAlt, label: 'Safety' },
        { id: 'Marketplace', icon: FaStore, label: 'Marketplace' },
    ];

     const fetchPosts = async (currentSkip = 0, isLoadMore = false) => {
        try {
            if (isLoadMore) {
                setLoadingMore(true);
            } else if (isInitialLoad) {
                setLoading(true);
            }

            const limit = 5;
            const params = new URLSearchParams();
            if (activeTab !== 'All') params.append('category', activeTab);
            if (searchTerm) params.append('searchTerm', searchTerm);
            if (showMyPosts && currentUser) params.append('userId', currentUser._id);
            if (postId) params.append('postId', postId);
            params.append('limit', limit);
            params.append('skip', currentSkip);

            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/forum?${params.toString()}`);
            const data = await res.json();

            if (res.ok) {
                if (isLoadMore) {
                    setPosts(prev => {
                        const existingIds = new Set(prev.map(p => p._id));
                        const newPosts = data.posts.filter(p => !existingIds.has(p._id));
                        return [...prev, ...newPosts];
                    });
                } else {
                    setPosts(data.posts);
                }
                setHasMore(data.hasMore);
            }
        } catch (error) {
            console.error('Failed to fetch posts:', error);
            toast.error('Failed to load community posts');
        } finally {
            if (isLoadMore) {
                setLoadingMore(false);
            } else {
                setLoading(false);
                setIsInitialLoad(false);
            }
        }
    };

    useEffect(() => {
        const loadData = async () => {
            try {
                await Promise.all([fetchPosts(0, false), fetchStats()]);
            } catch (error) {
                console.error("Error loading data", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [activeTab, searchTerm, showMyPosts, postId]);

    useEffect(() => {
        if (!hasMore || loadingMore || loading) return;

        const observer = new IntersectionObserver((entries) => {
            const first = entries[0];
            if (first.isIntersecting) {
                fetchPosts(posts.length, true);
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
    }, [hasMore, loadingMore, loading, posts.length]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length > 2) {
                try {
                    const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/forum/search/suggestions?q=${searchTerm}`);
                    if (res.ok) {
                        const data = await res.json();
                        setSuggestions(data);
                        setShowSuggestions(true);
                    }
                } catch (error) {
                    console.error(error);
                }
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const handleSearchSelect = (post) => {
        setSearchTerm('');
        setShowSuggestions(false);
        navigate(currentUser ? `/user/community/post/${post._id}` : `/community/post/${post._id}`);
    };

    const fetchStats = async () => {
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/forum/stats`);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    useEffect(() => {
        // Socket listeners
        const handlePostCreated = (newPost) => {
            if (activeTab === 'All' || activeTab === newPost.category) {
                setPosts(prev => [newPost, ...prev]);
                setStats(prev => ({ ...prev, dailyPosts: prev.dailyPosts + 1 }));
            }
        };

        const handlePostDeleted = (postId) => {
            setPosts(prev => prev.filter(p => p._id !== postId));
        };

        const handlePostUpdated = (updatedPost) => {
            setPosts(prev => {
                const updated = prev.map(p => {
                    if (p._id === updatedPost._id) {
                        return {
                            ...updatedPost,
                            author: updatedPost.author || p.author,
                            comments: updatedPost.comments || p.comments
                        };
                    }
                    return p;
                });
                return updated.sort((a, b) => (b.isPinned === a.isPinned ? 0 : b.isPinned ? 1 : -1) || new Date(b.createdAt) - new Date(a.createdAt));
            });
        };

        const handleCommentAdded = ({ postId, comment }) => {
            setPosts(prev => prev.map(post => {
                if (post._id === postId) {
                    // Check if comment already exists (optimistic update prevention)
                    if (post.comments.some(c => c._id === comment._id)) return post;
                    return { ...post, comments: [...post.comments, comment] };
                }
                return post;
            }));
        };

        const handleCommentDeleted = ({ postId, commentId }) => {
            setPosts(prev => prev.map(post => {
                if (post._id === postId) {
                    return {
                        ...post,
                        comments: post.comments.map(c => {
                            if (c._id === commentId) {
                                return { ...c, isDeleted: true }; // Mark as deleted to preserve thread
                            }
                            return c;
                        })
                    };
                }
                return post;
            }));
        };

        const handleReplyAdded = ({ postId, commentId, reply }) => {
            setPosts(prev => prev.map(post => {
                if (post._id === postId) {
                    return {
                        ...post,
                        comments: post.comments.map(comment => {
                            if (comment._id === commentId) {
                                // Check if reply exists
                                if (comment.replies && comment.replies.some(r => r._id === reply._id)) return comment;
                                return {
                                    ...comment,
                                    replies: [...(comment.replies || []), reply]
                                };
                            }
                            return comment;
                        })
                    };
                }
                return post;
            }));
        };

        const handleReplyDeleted = ({ postId, commentId, replyId }) => {
            setPosts(prev => prev.map(post => {
                if (post._id === postId) {
                    return {
                        ...post,
                        comments: post.comments.map(comment => {
                            if (comment._id === commentId) {
                                return {
                                    ...comment,
                                    replies: comment.replies ? comment.replies.map(r => {
                                        if (r._id === replyId) {
                                            return { ...r, isDeleted: true }; // Mark as deleted to preserve thread
                                        }
                                        return r;
                                    }) : []
                                };
                            }
                            return comment;
                        })
                    };
                }
                return post;
            }));
        };

        const handleCommentUpdated = ({ postId, comment }) => {
            setPosts(prev => prev.map(post => {
                if (post._id === postId) {
                    return {
                        ...post,
                        comments: post.comments.map(c => c._id === comment._id ? { ...c, ...comment } : c)
                    };
                }
                return post;
            }));
        };

        const handleReplyUpdated = ({ postId, commentId, reply }) => {
            setPosts(prev => prev.map(post => {
                if (post._id === postId) {
                    return {
                        ...post,
                        comments: post.comments.map(c => {
                            if (c._id === commentId) {
                                return {
                                    ...c,
                                    replies: c.replies ? c.replies.map(r => r._id === reply._id ? { ...r, ...reply } : r) : []
                                };
                            }
                            return c;
                        })
                    };
                }
                return post;
            }));
        };

        socket.on('forum:postCreated', handlePostCreated);
        socket.on('forum:postDeleted', handlePostDeleted);
        socket.on('forum:postUpdated', handlePostUpdated);
        socket.on('forum:commentAdded', handleCommentAdded);
        socket.on('forum:commentDeleted', handleCommentDeleted);
        socket.on('forum:commentUpdated', handleCommentUpdated);
        socket.on('forum:replyAdded', handleReplyAdded);
        socket.on('forum:replyDeleted', handleReplyDeleted);
        socket.on('forum:replyUpdated', handleReplyUpdated);

        return () => {
            socket.off('forum:postCreated', handlePostCreated);
            socket.off('forum:postDeleted', handlePostDeleted);
            socket.off('forum:postUpdated', handlePostUpdated);
            socket.off('forum:commentAdded', handleCommentAdded);
            socket.off('forum:commentDeleted', handleCommentDeleted);
            socket.off('forum:commentUpdated', handleCommentUpdated);
            socket.off('forum:replyAdded', handleReplyAdded);
            socket.off('forum:replyDeleted', handleReplyDeleted);
            socket.off('forum:replyUpdated', handleReplyUpdated);
        };
    }, [activeTab]);

    const handleLike = async (postId) => {
        if (!currentUser) return toast.info('Please sign in to like this post');
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/forum/like/${postId}`, {
                method: 'PUT'
            });
            if (res.ok) {
                const updatedPost = await res.json();
                setPosts(posts.map(post => post._id === postId ? { ...updatedPost, author: post.author, comments: post.comments } : post));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDislike = async (postId) => {
        if (!currentUser) return toast.info('Please sign in to dislike this post');
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/forum/dislike/${postId}`, {
                method: 'PUT'
            });
            if (res.ok) {
                const updatedPost = await res.json();
                setPosts(posts.map(post => post._id === postId ? { ...updatedPost, author: post.author, comments: post.comments } : post));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleCommentReaction = async (postId, commentId, reactionType) => {
        if (!currentUser) return toast.info('Please sign in to react');
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/forum/comment/${postId}/${commentId}/${reactionType}`, {
                method: 'PUT'
            });
            if (res.ok) {
                // Optimistic/Manual update to preserve author info
                setPosts(prevPosts => prevPosts.map(post => {
                    if (post._id === postId) {
                        return {
                            ...post,
                            comments: post.comments.map(comment => {
                                if (comment._id === commentId) {
                                    const userId = currentUser._id;
                                    let newLikes = [...(comment.likes || [])];
                                    let newDislikes = [...(comment.dislikes || [])];

                                    if (reactionType === 'like') {
                                        if (newLikes.includes(userId)) {
                                            newLikes = newLikes.filter(id => id !== userId);
                                        } else {
                                            newLikes.push(userId);
                                            newDislikes = newDislikes.filter(id => id !== userId);
                                        }
                                    } else {
                                        if (newDislikes.includes(userId)) {
                                            newDislikes = newDislikes.filter(id => id !== userId);
                                        } else {
                                            newDislikes.push(userId);
                                            newLikes = newLikes.filter(id => id !== userId);
                                        }
                                    }
                                    return { ...comment, likes: newLikes, dislikes: newDislikes };
                                }
                                return comment;
                            })
                        };
                    }
                    return post;
                }));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleReplyReaction = async (postId, commentId, replyId, reactionType) => {
        if (!currentUser) return toast.info('Please sign in to react');
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/forum/comment/${postId}/${commentId}/reply/${replyId}/${reactionType}`, {
                method: 'PUT'
            });
            if (res.ok) {
                // Optimistic/Manual update to preserve author info
                setPosts(prevPosts => prevPosts.map(post => {
                    if (post._id === postId) {
                        return {
                            ...post,
                            comments: post.comments.map(comment => {
                                if (comment._id === commentId) {
                                    return {
                                        ...comment,
                                        replies: comment.replies.map(reply => {
                                            if (reply._id === replyId) {
                                                const userId = currentUser._id;
                                                let newLikes = [...(reply.likes || [])];
                                                let newDislikes = [...(reply.dislikes || [])];

                                                if (reactionType === 'like') {
                                                    if (newLikes.includes(userId)) {
                                                        newLikes = newLikes.filter(id => id !== userId);
                                                    } else {
                                                        newLikes.push(userId);
                                                        newDislikes = newDislikes.filter(id => id !== userId);
                                                    }
                                                } else {
                                                    if (newDislikes.includes(userId)) {
                                                        newDislikes = newDislikes.filter(id => id !== userId);
                                                    } else {
                                                        newDislikes.push(userId);
                                                        newLikes = newLikes.filter(id => id !== userId);
                                                    }
                                                }
                                                return { ...reply, likes: newLikes, dislikes: newDislikes };
                                            }
                                            return reply;
                                        })
                                    };
                                }
                                return comment;
                            })
                        };
                    }
                    return post;
                }));
            }
        } catch (error) {
            console.error(error);
        }
    };

    // Mentions Logic
    const searchProperties = async (query) => {
        try {
            setMentionSearchLoading(true);
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/property-search/search?query=${encodeURIComponent(query)}&limit=5`);
            if (res.ok) {
                const data = await res.json();
                setPropertySuggestions(data.data || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setMentionSearchLoading(false);
        }
    };

    const handleInputChange = (e, type, id = null) => {
        const value = e.target.value;
        const cursorPos = e.target.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPos);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (type === 'post') {
            setNewPost(prev => ({ ...prev, content: value }));
        } else if (type === 'comment') {
            setCommentText(prev => ({ ...prev, [id]: value }));
        } else if (type === 'reply') {
            setReplyText(value);
        } else if (type === 'edit-post') {
            setEditingPost(prev => ({ ...prev, content: value }));
        } else if (type === 'edit-comment' || type === 'edit-reply') {
            setEditingContent(prev => ({ ...prev, content: value }));
        }

        if (lastAtIndex !== -1) {
            const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
            if (!textAfterAt.includes(' ')) {
                setShowMentionSuggestions({ show: true, query: textAfterAt, type, id });
                setSelectedMentionIndex(0);
                searchProperties(textAfterAt);
                return;
            }
        }
        setShowMentionSuggestions({ show: false, query: '', type: null, id: null });
    };

    const handleMentionSelect = (property) => {
        const { type, id, query } = showMentionSuggestions;
        let content = '';
        if (type === 'post') content = newPost.content;
        else if (type === 'comment') content = commentText[id] || '';
        else if (type === 'reply') content = replyText;
        else if (type === 'edit-post') content = editingPost.content;
        else if (type === 'edit-comment' || type === 'edit-reply') content = editingContent.content;

        const lastAtIndex = content.lastIndexOf('@' + query);
        const beforeAt = content.substring(0, lastAtIndex);
        const afterAt = content.substring(lastAtIndex + query.length + 1);

        const newContent = `${beforeAt}@[${property.name}](${property.id}) ${afterAt}`;

        if (type === 'post') {
            setNewPost(prev => ({ ...prev, content: newContent }));
        } else if (type === 'comment') {
            setCommentText(prev => ({ ...prev, [id]: newContent }));
        } else if (type === 'reply') {
            setReplyText(newContent);
        } else if (type === 'edit-post') {
            setEditingPost(prev => ({ ...prev, content: newContent }));
        } else if (type === 'edit-comment' || type === 'edit-reply') {
            setEditingContent(prev => ({ ...prev, content: newContent }));
        }

        setShowMentionSuggestions({ show: false, query: '', type: null, id: null });
    };

    const renderMentionsPanel = () => {
        if (!showMentionSuggestions.show || propertySuggestions.length === 0) return null;
        return (
            <div className="absolute bottom-full left-0 w-64 bg-white dark:bg-gray-900 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 mb-2 z-[100] overflow-hidden animate-fade-in-up" style={{ opacity: 1 }}>
                <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mention Property</span>
                    {mentionSearchLoading && <UrbanSetuSpinner size="sm" />}
                </div>
                <div className="max-h-48 overflow-y-auto">
                    {propertySuggestions.map((prop, idx) => (
                        <div
                            key={prop._id}
                            onClick={() => handleMentionSelect(prop)}
                            className={`px-3 py-2 cursor-pointer transition-colors flex items-center gap-3 ${idx === selectedMentionIndex ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                        >
                            <img src={prop.coverImage || prop.images?.[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3'} className="w-8 h-8 rounded object-cover" alt="" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{prop.name}</p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{prop.location?.city || 'India'}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const formatContent = (content) => {
        if (!content) return null;
        // Regex to capture @[Name](ID) format
        const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = mentionRegex.exec(content)) !== null) {
            // Push text before the match
            if (match.index > lastIndex) {
                parts.push(content.substring(lastIndex, match.index));
            }
            // Push the link component
            parts.push(
                <Link
                    key={match.index}
                    to={`/user/listing/${match[2]}`}
                    className="text-blue-600 font-bold hover:underline bg-blue-50 px-1 rounded transition-colors"
                >
                    @{match[1]}
                </Link>
            );
            lastIndex = mentionRegex.lastIndex;
        }
        // Push remaining text
        if (lastIndex < content.length) {
            parts.push(content.substring(lastIndex));
        }

        // If no mentions found, try legacy format (just in case) or return content
        if (parts.length === 0) {
            const legacyParts = content.split(/(@\w+(?:\s\w+)*)/g);
            return legacyParts.map((part, i) => {
                if (part.startsWith('@')) {
                    // Legacy handling mostly not needed if we enforce new format, but kept for old posts if any
                    return (
                        <span key={i} className="text-blue-600 font-bold">
                            {part}
                        </span>
                    );
                }
                return part;
            });
        }

        return parts;
    };

    const handleDeleteComment = (postId, commentId) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Comment',
            message: 'Are you sure you want to delete this comment?',
            confirmText: 'Delete',
            isDestructive: true,
            onConfirm: async () => {
                try {
                    const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/forum/comment/${postId}/${commentId}`, {
                        method: 'DELETE'
                    });
                    if (res.ok) {
                        setPosts(posts.map(post => {
                            if (post._id === postId) {
                                return {
                                    ...post,
                                    comments: post.comments.map(c => {
                                        if (c._id === commentId) {
                                            return { ...c, isDeleted: true, deletedBy: currentUser._id };
                                        }
                                        return c;
                                    })
                                };
                            }
                            return post;
                        }));
                        toast.success('Comment deleted');
                    }
                } catch (error) {
                    console.error(error);
                    toast.error('Failed to delete comment');
                }
            }
        });
    };

    const handleCreatePost = async (e) => {
        e.preventDefault();
        if (!currentUser) return toast.info('Please sign in to create a post');

        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/forum/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newPost),
            });

            const data = await res.json();
            if (!res.ok) {
                toast.error(data.message || 'Failed to create post');
                return;
            }

            toast.success('Post created successfully!');
            setShowCreateModal(false);
            setNewPost({ title: '', content: '', category: 'General', location: { city: '', neighborhood: '' } });
            fetchPosts(); // Refresh feed
            fetchStats(); // Update stats
        } catch (error) {
            console.error(error);
            toast.error('Something went wrong');
        }
    };

    const handleEditClick = (post) => {
        setEditingPost(post);
        setNewPost({
            title: post.title,
            content: post.content,
            category: post.category,
            location: {
                city: post.location?.city || '',
                neighborhood: post.location?.neighborhood || ''
            }
        });
        setShowCreateModal(true);
    };

    const handleCloseModal = () => {
        setShowCreateModal(false);
        setEditingPost(null);
        setNewPost({
            title: '',
            content: '',
            category: 'General',
            location: {
                city: '',
                neighborhood: ''
            }
        });
        setShowEmojiPicker({ show: false, type: null, id: null });
    };

    const handleUpdatePost = async (e, postId) => {
        e.preventDefault();
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/forum/${postId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPost)
            });

            if (res.ok) {
                const updatedPost = await res.json();
                setPosts(posts.map(p => p._id === postId ? { ...p, ...updatedPost } : p));
                handleCloseModal();
                toast.success('Post updated');
            } else {
                toast.error('Failed to update post');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to update post');
        }
    };

    const handleDeletePost = (postId) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Discussion',
            message: 'Are you sure you want to delete this discussion? This action cannot be undone.',
            confirmText: 'Delete',
            isDestructive: true,
            onConfirm: async () => {
                try {
                    const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/forum/${postId}`, {
                        method: 'DELETE'
                    });
                    if (res.ok) {
                        setPosts(posts.filter(p => p._id !== postId));
                        toast.success('Post deleted successfully');
                        fetchStats();
                    } else {
                        toast.error('Failed to delete post');
                    }
                } catch (error) {
                    console.error(error);
                    toast.error('Error deleting post');
                }
            }
        });
    };

    const handleAddReply = async (e, postId, commentId, parentReplyId = null) => {
        e.preventDefault();
        if (!replyText.trim()) return;

        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/forum/comment/${postId}/${commentId}/reply`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: replyText,
                    replyToUser: replyingTo?.userId,
                    parentReplyId // Send parentReplyId to backend
                }),
            });
            const data = await res.json();
            if (res.ok) {
                // UI update via socket usually handles this, but for optmistic UI:
                setReplyText('');
                setReplyingTo(null);
                setActiveReplyInput(null);
            } else {
                toast.error(data.message || 'Failed to add reply');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to add reply');
        }
    };

    const handleDeleteReply = (postId, commentId, replyId) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Reply',
            message: 'Are you sure you want to delete this reply?',
            confirmText: 'Delete',
            isDestructive: true,
            onConfirm: async () => {
                try {
                    const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/forum/comment/${postId}/${commentId}/reply/${replyId}`, {
                        method: 'DELETE'
                    });
                    if (res.ok) {
                        setPosts(posts.map(post => {
                            if (post._id === postId) {
                                return {
                                    ...post,
                                    comments: post.comments.map(c => {
                                        if (c._id === commentId) {
                                            return {
                                                ...c,
                                                replies: c.replies ? c.replies.map(r => {
                                                    if (r._id === replyId) {
                                                        return { ...r, isDeleted: true, deletedBy: currentUser._id };
                                                    }
                                                    return r;
                                                }) : []
                                            };
                                        }
                                        return c;
                                    })
                                };
                            }
                            return post;
                        }));
                        toast.success('Reply deleted');
                    }
                } catch (error) {
                    console.error(error);
                    toast.error('Failed to delete reply');
                }
            }
        });
    };

    const handleShare = (post) => {
        const baseUrl = window.location.origin;
        let path = `/community/post/${post._id}`;
        if (currentUser) {
            path = `/user/community/post/${post._id}`;
        }
        setShareModal({
            isOpen: true,
            url: `${baseUrl}${path}`,
            title: post.title,
            description: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : '')
        });
    };


    const toggleComments = async (postId) => {
        const isExpanding = !expandedComments[postId];
        setExpandedComments(prev => ({
            ...prev,
            [postId]: isExpanding
        }));

        if (isExpanding) {
            setCommentsLoading(prev => ({ ...prev, [postId]: true }));
            try {
                const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/forum/${postId}`);
                if (res.ok) {
                    const latestPost = await res.json();
                    setPosts(prevPosts => prevPosts.map(p => p._id === postId ? {
                        ...p,
                        comments: latestPost.comments || []
                    } : p));
                }
            } catch (error) {
                console.error("Failed to load comments:", error);
            } finally {
                setTimeout(() => {
                    setCommentsLoading(prev => ({ ...prev, [postId]: false }));
                }, 400);
            }
        }
    };

    const toggleReplies = (id) => {
        const isExpanding = !expandedReplies[id];
        setExpandedReplies(prev => ({
            ...prev,
            [id]: isExpanding
        }));

        if (isExpanding) {
            setRepliesLoading(prev => ({ ...prev, [id]: true }));
            setTimeout(() => {
                setRepliesLoading(prev => ({ ...prev, [id]: false }));
            }, 300);
        }
    };

    const handleReport = (reason) => {
        const { type, id, commentId, replyId } = reportModal;
        let url = '';
        if (type === 'post') url = `${import.meta.env.VITE_API_BASE_URL}/api/forum/report/${id}`;
        else if (type === 'comment') url = `${import.meta.env.VITE_API_BASE_URL}/api/forum/report/comment/${id}/${commentId}`; // id is postId here
        else if (type === 'reply') url = `${import.meta.env.VITE_API_BASE_URL}/api/forum/report/reply/${id}/${commentId}/${replyId}`;

        authenticatedFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} reported successfully`);
                    setReportModal({ isOpen: false, type: 'post', id: null, commentId: null, replyId: null });
                } else {
                    toast.error(data.message || data.error || 'Failed to report');
                }
            })
            .catch(err => {
                console.error(err);
                toast.error('Failed to report');
            });
    };

    const handleUpdateComment = async (e, postId, commentId) => {
        e.preventDefault();
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/forum/comment/${postId}/${commentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: editingContent.content })
            });

            if (res.ok) {
                const updatedComment = await res.json();
                setPosts(posts.map(post => {
                    if (post._id === postId) {
                        return {
                            ...post,
                            comments: post.comments.map(c => c._id === commentId ? { ...c, ...updatedComment } : c)
                        };
                    }
                    return post;
                }));
                setEditingContent({ type: null, id: null, content: '' });
                toast.success('Comment updated');
            } else {
                const data = await res.json();
                toast.error(data.message || 'Failed to update comment');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to update comment');
        }
    };

    const handleUpdateReply = async (e, postId, commentId, replyId) => {
        e.preventDefault();
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/forum/comment/${postId}/${commentId}/reply/${replyId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: editingContent.content })
            });

            if (res.ok) {
                const updatedReply = await res.json();
                setPosts(posts.map(post => {
                    if (post._id === postId) {
                        return {
                            ...post,
                            comments: post.comments.map(c => {
                                if (c._id === commentId) {
                                    // Normally flat structure for first level, but let's be safe if I changed schema later. 
                                    // Wait, the state structure is flat array in 'replies' field of comment, BUT my recursive UI logic implies they are just filters on a flat list.
                                    // Wait, let me check backend addReply again... 
                                    // 'comment.replies.push(newReply)' -> It is a flat array in database.
                                    // So I just need to map over comment.replies.
                                    return {
                                        ...c,
                                        replies: c.replies.map(r => r._id === replyId ? { ...r, ...updatedReply } : r)
                                    };
                                }
                                return c;
                            })
                        };
                    }
                    return post;
                }));
                setEditingContent({ type: null, id: null, content: '' });
                toast.success('Reply updated');
            } else {
                const data = await res.json();
                toast.error(data.message || 'Failed to update reply');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to update reply');
        }
    };

    const handleAddComment = async (e, postId) => {
        e.preventDefault();
        const content = commentText[postId];
        if (!content || !content.trim()) return;

        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/forum/comment/${postId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });

            if (res.ok) {
                const newComment = await res.json();
                setPosts(posts.map(post => {
                    if (post._id === postId) {
                        return {
                            ...post,
                            comments: [...post.comments, newComment]
                        };
                    }
                    return post;
                }));
                setCommentText(prev => ({ ...prev, [postId]: '' }));
                toast.success('Comment added');
            } else {
                const data = await res.json();
                toast.error(data.message || 'Failed to add comment');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to add comment');
        }
    };

    const prevPostIdRef = React.useRef(postId);

    useEffect(() => {
        if (postId && posts.length > 0) {
            const matchingPost = posts.find(p => p._id === postId);
            if (matchingPost && !expandedComments[postId]) {
                toggleComments(postId);
            }
        }

        if (prevPostIdRef.current && !postId) {
            setExpandedComments({});
        }

        prevPostIdRef.current = postId;
    }, [postId, posts]);

    if (loading) {
        return <CommunitySkeleton />;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-20 pb-12 font-sans text-slate-800 dark:text-gray-200 transition-colors duration-300">
            <SEO
                title="Community Hub - Neighborhood Discussion | UrbanSetu"
                description="Join your local real estate community hub. Discuss property prices, shared issues, town planning, and luxury lifestyle with neighbors across India."
                keywords="real estate community hub, neighborhood forum, property discussion group, UrbanSetu community"
            />
            <style>{styles}</style>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Neighborhood Community Hub</h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        Connect with your neighbors, discuss local events, share safety alerts, and build a better community together.
                    </p>
                    <div className="w-24 h-1 bg-blue-600 mx-auto mt-6 rounded-full opacity-20"></div>
                </div>

                {/* Controls & Tabs Header Panel */}
                <div className="relative z-30 bg-white/80 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-gray-150 dark:border-gray-800 p-4 mb-8 shadow-sm transition-all duration-300">
                    <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
                        
                        {/* Categories Horizontal Scroll */}
                        <div className="flex overflow-x-auto gap-1.5 pb-1 lg:pb-0 hide-scrollbar -mx-2 px-2 flex-1">
                            {categories.map((cat) => {
                                const isActive = activeTab === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => {
                                            setActiveTab(cat.id);
                                            if (postId) navigate(currentUser ? '/user/community' : '/community');
                                        }}
                                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
                                            isActive
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                                        }`}
                                    >
                                        <cat.icon className={`text-xs ${isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`} />
                                        {cat.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Search and Secondary Actions Block */}
                        <div className="flex flex-col sm:flex-row items-center gap-2.5 flex-shrink-0 w-full lg:w-auto">
                            {/* Search bar */}
                            <div className="relative w-full lg:w-60 xl:w-64">
                                <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-450 text-sm" />
                                <input
                                    type="text"
                                    placeholder="Search discussions..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onFocus={() => searchTerm.length > 2 && setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700/80 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500/40 text-xs sm:text-sm transition-all"
                                />
                                {/* Search Suggestions popup */}
                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="absolute top-full left-0 w-full bg-white dark:bg-gray-900 shadow-xl rounded-xl mt-2 z-50 border border-gray-150 dark:border-gray-800 overflow-hidden animate-fade-in max-h-60 overflow-y-auto">
                                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-950/80 text-[10px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-150 dark:border-gray-800">
                                            Suggested Discussions
                                        </div>
                                        {suggestions.map((s, i) => (
                                            <div
                                                key={i}
                                                className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer text-xs sm:text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors flex items-center gap-3 group"
                                                onClick={() => handleSearchSelect(s)}
                                            >
                                                <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                                                    <FaSearch className="text-gray-400 group-hover:text-blue-500 dark:text-gray-500 text-[10px]" />
                                                </div>
                                                <span className="truncate font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{s.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Secondary Action buttons */}
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                {currentUser && (
                                    <button
                                        onClick={() => setShowMyPosts(!showMyPosts)}
                                        className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 border flex-1 sm:flex-none ${
                                            showMyPosts
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
                                                : 'bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700/80 hover:bg-gray-50 dark:hover:bg-gray-800/80'
                                        }`}
                                    >
                                        <FaUser className="text-xs" />
                                        <span>Your Posts</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        if (!currentUser) return toast.info("Please sign in to post");
                                        setShowCreateModal(true);
                                    }}
                                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all flex-1 sm:flex-none"
                                >
                                    <FaPlus className="text-xs" />
                                    <span>New Post</span>
                                </button>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Feed */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {postId && (
                            <button
                                onClick={() => navigate(currentUser ? '/user/community' : '/community')}
                                className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-bold hover:underline mb-2 transition-all hover:-translate-x-1"
                            >
                                <FaArrowLeft /> Back to All Discussions
                            </button>
                        )}
                        {posts.length === 0 ? (
                            <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors duration-300">
                                <FaUsers className="text-6xl text-gray-200 dark:text-gray-800 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">No posts found</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-6">Be the first to start a conversation in this category!</p>
                                <button
                                    onClick={() => currentUser ? setShowCreateModal(true) : toast.info("Please sign in to post")}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Start Discussion
                                </button>
                            </div>
                        ) : (
                            sortedPosts.map((post, index) => (
                                <div
                                    key={post._id}
                                    className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 hover:shadow-xl dark:shadow-blue-900/10 transition-all duration-300 animate-fade-in-up"
                                    style={{ animationDelay: `${index * 0.1}s` }}
                                >
                                    {/* Post Header */}
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 pb-3 border-b border-gray-50 dark:border-gray-800/50">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <UserAvatar
                                                    user={post.author}
                                                    size="w-12 h-12"
                                                    className="border-2 border-white shadow-md text-2xl"
                                                />
                                                {post.author?.type === 'agent' && (
                                                    <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-[10px] p-1 rounded-full border-2 border-white" title="Agent">
                                                        <FaShieldAlt />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 dark:text-white text-lg hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors">
                                                    {post.author?.username}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                                                    <span className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-700">
                                                        <FaCalendarAlt className="text-gray-400" />
                                                        {new Date(post.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                    {post.location?.city && (
                                                        <span className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-700">
                                                            <FaMapMarkerAlt className="text-red-400" /> {post.location.city}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
                                            {stats.trendingTopics?.findIndex(t => t._id === post._id) !== -1 && (
                                                <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 animate-pulse">
                                                    <FaFire className="text-[8px]" /> Trending #{stats.trendingTopics?.findIndex(t => t._id === post._id) + 1}
                                                </span>
                                            )}
                                            {post.isLocked && (
                                                <span className="bg-gray-100 text-gray-500 p-1.5 rounded-full" title="Locked Discussion">
                                                    <FaLock size={12} />
                                                </span>
                                            )}
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${post.category === 'Safety' ? 'bg-red-50 text-red-600 border border-red-100' :
                                                post.category === 'Events' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                                                    post.category === 'Marketplace' ? 'bg-green-50 text-green-600 border border-green-100' :
                                                        'bg-blue-50 text-blue-600 border border-blue-100'
                                                }`}>
                                                {post.category}
                                            </span>
                                            {currentUser && currentUser._id !== post.author?._id && (
                                                <button
                                                    onClick={() => setReportModal({ isOpen: true, type: 'post', id: post._id, commentId: null, replyId: null })}
                                                    className={`p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all ${post.reports?.some(r => r.user === currentUser._id) ? 'text-red-500' : 'text-gray-300 dark:text-gray-600 hover:text-red-500'}`}
                                                    title="Report Post"
                                                >
                                                    <FaFlag />
                                                </button>
                                            )}
                                            {currentUser && currentUser._id === post.author?._id && (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleEditClick(post)}
                                                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-all"
                                                        title="Edit Post"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeletePost(post._id)}
                                                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all"
                                                        title="Delete Post"
                                                    >
                                                        <FaTimes />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Post Content */}
                                    <div className="mb-6 pl-2 border-l-4 border-gray-100 dark:border-gray-800 hover:border-blue-100 dark:hover:border-blue-900 transition-colors">
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 leading-tight">{post.title}</h2>
                                        <p className="text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                                            {formatContent(post.content)}
                                            {post.isEdited && <span className="text-[10px] text-gray-400 italic font-normal ml-2">(edited)</span>}
                                        </p>
                                    </div>

                                    {/* Post Actions */}
                                    <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-800">
                                        <div className="flex items-center gap-6 w-full">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 rounded-full px-1 border border-gray-100 dark:border-gray-700">
                                                    <button
                                                        onClick={() => currentUser ? handleLike(post._id) : toast.info('Please sign in to like')}
                                                        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-full transition-all ${currentUser && post.likes?.includes(currentUser._id)
                                                            ? 'text-blue-600 dark:text-blue-400'
                                                            : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
                                                            }`}
                                                        title="Like"
                                                    >
                                                        <FaThumbsUp className={`text-base transform group-hover:scale-110 transition-transform ${currentUser && post.likes?.includes(currentUser._id) ? 'fill-current' : ''}`} />
                                                        <span className="font-semibold text-xs">{post.likes?.length || 0}</span>
                                                    </button>
                                                    <div className="w-[1px] h-4 bg-gray-200 dark:bg-gray-700"></div>
                                                    <button
                                                        onClick={() => currentUser ? handleDislike(post._id) : toast.info('Please sign in to dislike')}
                                                        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-full transition-all ${currentUser && post.dislikes?.includes(currentUser._id)
                                                            ? 'text-red-500 dark:text-red-400'
                                                            : 'text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400'
                                                            }`}
                                                        title="Dislike"
                                                    >
                                                        <FaThumbsDown className={`text-base transform group-hover:scale-110 transition-transform ${currentUser && post.dislikes?.includes(currentUser._id) ? 'fill-current' : ''}`} />

                                                    </button>
                                                </div>

                                                <button
                                                    onClick={() => toggleComments(post._id)}
                                                    className="group flex items-center gap-2 px-3 py-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-all font-semibold text-xs"
                                                >
                                                    <FaComment className="text-base transform group-hover:scale-110 transition-transform" />
                                                    <span>{post.comments?.length || 0} Comments</span>
                                                </button>
                                            </div>

                                            <button
                                                onClick={() => handleShare(post)}
                                                className="group flex items-center gap-2 px-3 py-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 dark:hover:text-green-400 transition-all ml-auto sm:ml-0"
                                            >
                                                <FaShare className="text-lg transform group-hover:scale-110 transition-transform" />
                                                <span className="hidden sm:inline font-medium">Share</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Comments Section */}
                                    {expandedComments[post._id] && (
                                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 animate-fade-in">
                                            <div className="space-y-4 mb-4">
                                                {commentsLoading[post._id] ? (
                                                    <div className="space-y-4 mb-4 animate-pulse">
                                                        {[1, 2].map((i) => (
                                                            <div key={i} className="flex gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 animate-pulse"></div>
                                                                <div className="flex-1 space-y-2">
                                                                    <div className="h-3 w-1/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                                                                    <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-none animate-pulse"></div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : post.comments && post.comments.length > 0 ? (
                                                    post.comments.map((comment, idx) => (
                                                        <div key={idx} className="flex gap-3 relative group/comment">
                                                            <div className="flex-shrink-0">
                                                                <UserAvatar
                                                                    user={comment.user}
                                                                    size="w-8 h-8"
                                                                    className="mt-1 text-sm"
                                                                />
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl rounded-tl-none p-3 pr-8 relative">
                                                                    <div className="flex justify-between items-center mb-1">
                                                                        <span className="font-semibold text-sm dark:text-gray-200">{comment.user?.username}</span>
                                                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 mr-4">
                                                                            {new Date(comment.createdAt || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                                                                        </span>
                                                                    </div>
                                                                    {editingContent.id === comment._id && editingContent.type === 'comment' ? (
                                                                        <form onSubmit={(e) => handleUpdateComment(e, post._id, comment._id)} className="w-full mb-2">
                                                                            <div className="relative">
                                                                                {showMentionSuggestions.show && showMentionSuggestions.id === comment._id && showMentionSuggestions.type === 'edit-comment' && renderMentionsPanel()}
                                                                                <textarea
                                                                                    value={editingContent.content}
                                                                                    onChange={(e) => handleInputChange(e, 'edit-comment', comment._id)}
                                                                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white min-h-[60px]"
                                                                                    autoFocus
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setShowEmojiPicker(prev => ({
                                                                                        show: prev.type === 'edit-comment' && prev.id === comment._id ? !prev.show : true,
                                                                                        type: 'edit-comment',
                                                                                        id: comment._id
                                                                                    }))}
                                                                                    className="absolute top-1 right-1 p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-all"
                                                                                    title="Add Emoji"
                                                                                >
                                                                                    <FaSmile className="text-sm" />
                                                                                </button>
                                                                                {showEmojiPicker.show && showEmojiPicker.type === 'edit-comment' && showEmojiPicker.id === comment._id && (
                                                                                    <div className="absolute bottom-full right-0 z-[100] mb-2 shadow-xl animate-fade-in bg-white rounded-lg">
                                                                                        <div className="flex justify-between items-center bg-gray-50 px-3 py-2 border-b border-gray-100 rounded-t-lg">
                                                                                            <span className="text-xs font-semibold text-gray-500">Pick an emoji</span>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => setShowEmojiPicker({ show: false, type: null, id: null })}
                                                                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                                                                            >
                                                                                                <FaTimes size={12} />
                                                                                            </button>
                                                                                        </div>
                                                                                        <EmojiPicker
                                                                                            onEmojiClick={(emojiData) => handleEmojiClick(emojiData, 'edit-comment', comment._id)}
                                                                                            width={300}
                                                                                            height={350}
                                                                                            theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                                                                                            searchDisabled={false}
                                                                                            skinTonesDisabled
                                                                                            previewConfig={{ showPreview: false }}
                                                                                        />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex justify-end gap-2 mt-1">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => { setEditingContent({ type: null, id: null, content: '' }); setShowEmojiPicker({ show: false, type: null, id: null }); }}
                                                                                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                                                                                >
                                                                                    Cancel
                                                                                </button>
                                                                                <button
                                                                                    type="submit"
                                                                                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                                                                                >
                                                                                    Save
                                                                                </button>
                                                                            </div>
                                                                        </form>
                                                                    ) : (
                                                                        <p className={`text-sm ${comment.isDeleted ? 'text-gray-500 dark:text-gray-400 italic' : 'text-gray-700 dark:text-gray-300'} leading-relaxed break-words overflow-hidden`}>
                                                                            {comment.isDeleted
                                                                                ? (comment.deletedBy === comment.user?._id ? "This comment was deleted." : "This comment is deleted by admin.")
                                                                                : formatContent(comment.content)}
                                                                            {!comment.isDeleted && comment.isEdited && <span className="text-[10px] text-gray-400 italic font-normal ml-2">(edited)</span>}
                                                                        </p>
                                                                    )}

                                                                    {/* Actions */}
                                                                    {!comment.isDeleted && (
                                                                        <div className="flex items-center gap-4 mt-2">
                                                                            <button
                                                                                onClick={() => {
                                                                                    if (!currentUser) return toast.info('Please sign in to reply');
                                                                                    setActiveReplyInput(comment._id);
                                                                                    setReplyingTo({ postId: post._id, commentId: comment._id });
                                                                                }}
                                                                                className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded transition-colors"
                                                                            >
                                                                                Reply
                                                                            </button>
                                                                            <div className="flex items-center gap-3">
                                                                                <button
                                                                                    onClick={() => currentUser ? handleCommentReaction(post._id, comment._id, 'like') : toast.info('Please sign in to like')}
                                                                                    className={`flex items-center gap-1 text-[10px] font-bold ${currentUser && comment.likes?.includes(currentUser._id) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400'}`}
                                                                                >
                                                                                    <FaThumbsUp size={10} /> {comment.likes?.length || 0}
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => currentUser ? handleCommentReaction(post._id, comment._id, 'dislike') : toast.info('Please sign in to dislike')}
                                                                                    className={`flex items-center gap-1 text-[10px] font-bold ${currentUser && comment.dislikes?.includes(currentUser._id) ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400'}`}
                                                                                >
                                                                                    <FaThumbsDown size={10} />
                                                                                </button>
                                                                            </div>
                                                                            {comment.replies && comment.replies.length > 0 && (
                                                                                <button
                                                                                    onClick={() => toggleReplies(comment._id)}
                                                                                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                                                                                >
                                                                                    {expandedReplies[comment._id] ? <FaTimes size={10} /> : <FaComment size={10} />}
                                                                                    {comment.replies.length} Replies
                                                                                </button>
                                                                            )}

                                                                            {/* Report Comment Button */}
                                                                            {currentUser && currentUser._id !== comment.user?._id && (
                                                                                <button
                                                                                    onClick={() => setReportModal({
                                                                                        isOpen: true,
                                                                                        type: 'comment',
                                                                                        id: post._id,
                                                                                        commentId: comment._id
                                                                                    })}
                                                                                    className="text-gray-400 hover:text-red-500 ml-2"
                                                                                    title="Report Comment"
                                                                                >
                                                                                    <FaFlag size={10} />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* If deleted, still show reply toggle if there are replies */}
                                                                    {comment.isDeleted && comment.replies && comment.replies.length > 0 && (
                                                                        <div className="mt-2">
                                                                            <button
                                                                                onClick={() => toggleReplies(comment._id)}
                                                                                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                                                                            >
                                                                                {expandedReplies[comment._id] ? <FaTimes size={10} /> : <FaComment size={10} />}
                                                                                {comment.replies.length} Replies
                                                                            </button>
                                                                        </div>
                                                                    )}


                                                                    {!comment.isDeleted && currentUser && currentUser._id === comment.user?._id && (
                                                                        <button
                                                                            onClick={() => setEditingContent({ type: 'comment', id: comment._id, content: comment.content })}
                                                                            className="absolute right-8 top-2 p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-all opacity-0 group-hover/comment:opacity-100"
                                                                            title="Edit Comment"
                                                                        >
                                                                            <FaEdit className="text-xs" />
                                                                        </button>
                                                                    )}
                                                                    {!comment.isDeleted && currentUser && (currentUser._id === comment.user?._id || currentUser.role === 'admin' || currentUser.role === 'rootadmin') && (
                                                                        <button
                                                                            onClick={() => handleDeleteComment(post._id, comment._id)}
                                                                            className="absolute right-2 top-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover/comment:opacity-100"
                                                                            title="Delete Comment"
                                                                        >
                                                                            <FaTimes className="text-xs" />
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                {/* Top level Reply Input (Directly to comment) */}
                                                                {activeReplyInput === comment._id && (
                                                                    <div className="mt-2 flex gap-2 animate-fade-in pl-2">
                                                                        <UserAvatar
                                                                            user={currentUser}
                                                                            size="w-6 h-6"
                                                                        />
                                                                        <form onSubmit={(e) => handleAddReply(e, post._id, comment._id, null)} className="flex-1 flex gap-2">
                                                                            <div className="relative flex-1">
                                                                                {showMentionSuggestions.show && showMentionSuggestions.id === comment._id && showMentionSuggestions.type === 'reply' && renderMentionsPanel()}
                                                                                <input
                                                                                    type="text"
                                                                                    autoFocus
                                                                                    value={replyText}
                                                                                    onChange={(e) => handleInputChange(e, 'reply', comment._id)}
                                                                                    placeholder={`Replying to ${comment.user?.username}...`}
                                                                                    className="w-full bg-white dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 text-gray-900 dark:text-white outline-none text-sm py-1 px-2 transition-all"
                                                                                />
                                                                            </div>
                                                                            <div className="flex gap-1 items-center">
                                                                                <div className="relative">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => setShowEmojiPicker(prev => ({
                                                                                            show: prev.type === 'reply' && prev.id === comment._id ? !prev.show : true,
                                                                                            type: 'reply',
                                                                                            id: comment._id
                                                                                        }))}
                                                                                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all"
                                                                                        title="Add Emoji"
                                                                                    >
                                                                                        <FaSmile className="text-sm" />
                                                                                    </button>
                                                                                    {showEmojiPicker.show && showEmojiPicker.type === 'reply' && showEmojiPicker.id === comment._id && (
                                                                                        <div className="absolute bottom-full right-0 z-[100] mb-2 shadow-xl animate-fade-in bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                                                                                            <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 px-3 py-2 border-b border-gray-100 dark:border-gray-700 rounded-t-lg">
                                                                                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Pick an emoji</span>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => setShowEmojiPicker({ show: false, type: null, id: null })}
                                                                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                                                                >
                                                                                                    <FaTimes size={12} />
                                                                                                </button>
                                                                                            </div>
                                                                                            <EmojiPicker
                                                                                                onEmojiClick={(emojiData) => handleEmojiClick(emojiData, 'reply', comment._id)}
                                                                                                width={300}
                                                                                                height={350}
                                                                                                theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                                                                                                searchDisabled={false}
                                                                                                skinTonesDisabled
                                                                                                previewConfig={{ showPreview: false }}
                                                                                            />
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => { setActiveReplyInput(null); setReplyText(''); setReplyingTo(null); setShowEmojiPicker({ show: false, type: null, id: null }); }}
                                                                                    className="text-xs text-gray-500 dark:text-gray-400 px-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all"
                                                                                >
                                                                                    Cancel
                                                                                </button>
                                                                                <button
                                                                                    type="submit"
                                                                                    disabled={!replyText.trim()}
                                                                                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full disabled:opacity-50 hover:bg-blue-700 transition-all shadow-md"
                                                                                >
                                                                                    Reply
                                                                                </button>
                                                                            </div>
                                                                        </form>
                                                                    </div>
                                                                )}

                                                                {/* Infinite Recursive Replies */}
                                                                {expandedReplies[comment._id] && comment.replies && (
                                                                    <div className="mt-2 space-y-3 pl-2 sm:pl-4 border-l-2 border-gray-100 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors ml-1 sm:ml-2">
                                                                        {repliesLoading[comment._id] ? (
                                                                            <div className="space-y-2 animate-pulse py-1">
                                                                                <div className="flex gap-2">
                                                                                    <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 animate-pulse"></div>
                                                                                    <div className="flex-1 space-y-1.5">
                                                                                        <div className="h-2 w-1/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                                                                                        <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ) : (() => {
                                                                            const renderReplies = (parentId, depth = 0) => {
                                                                                const currentReplies = comment.replies.filter(r => (r.parentReplyId || null) === (parentId || null));
                                                                                if (!currentReplies.length) return null;

                                                                                return currentReplies.map(reply => {
                                                                                    const subReplies = comment.replies.filter(r => r.parentReplyId === reply._id);
                                                                                    return (
                                                                                        <div key={reply._id} className="flex gap-2 relative group/reply flex-col mb-2 animate-fade-in">
                                                                                            <div className="flex gap-2">
                                                                                                <UserAvatar
                                                                                                    user={reply.user}
                                                                                                    size="w-6 h-6"
                                                                                                    className="mt-1 text-xs"
                                                                                                />
                                                                                                <div className="flex-1">
                                                                                                    <div className="bg-gray-50/50 dark:bg-gray-800/50 p-2 rounded-lg relative">
                                                                                                        <div className="flex items-center gap-2 mb-1">
                                                                                                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{reply.user?.username}</span>
                                                                                                            <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                                                                                                {new Date(reply.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                        {editingContent.id === reply._id && editingContent.type === 'reply' ? (
                                                                                                            <form onSubmit={(e) => handleUpdateReply(e, post._id, comment._id, reply._id)} className="w-full mb-2">
                                                                                                                <div className="relative">
                                                                                                                    {showMentionSuggestions.show && showMentionSuggestions.id === reply._id && showMentionSuggestions.type === 'edit-reply' && renderMentionsPanel()}
                                                                                                                    <textarea
                                                                                                                        value={editingContent.content}
                                                                                                                        onChange={(e) => handleInputChange(e, 'edit-reply', reply._id)}
                                                                                                                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-2 text-xs focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white min-h-[50px]"
                                                                                                                        autoFocus
                                                                                                                    />
                                                                                                                    <button
                                                                                                                        type="button"
                                                                                                                        onClick={() => setShowEmojiPicker(prev => ({
                                                                                                                            show: prev.type === 'edit-reply' && prev.id === reply._id ? !prev.show : true,
                                                                                                                            type: 'edit-reply',
                                                                                                                            id: reply._id
                                                                                                                        }))}
                                                                                                                        className="absolute top-1 right-1 p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-all"
                                                                                                                        title="Add Emoji"
                                                                                                                    >
                                                                                                                        <FaSmile className="text-sm" />
                                                                                                                    </button>
                                                                                                                    {showEmojiPicker.show && showEmojiPicker.type === 'edit-reply' && showEmojiPicker.id === reply._id && (
                                                                                                                        <div className="absolute bottom-full right-0 z-[100] mb-2 shadow-xl animate-fade-in bg-white rounded-lg">
                                                                                                                            <div className="flex justify-between items-center bg-gray-50 px-3 py-2 border-b border-gray-100 rounded-t-lg">
                                                                                                                                <span className="text-xs font-semibold text-gray-500">Pick an emoji</span>
                                                                                                                                <button
                                                                                                                                    type="button"
                                                                                                                                    onClick={() => setShowEmojiPicker({ show: false, type: null, id: null })}
                                                                                                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                                                                                                >
                                                                                                                                    <FaTimes size={12} />
                                                                                                                                </button>
                                                                                                                            </div>
                                                                                                                            <EmojiPicker
                                                                                                                                onEmojiClick={(emojiData) => handleEmojiClick(emojiData, 'edit-reply', reply._id)}
                                                                                                                                width={300}
                                                                                                                                height={350}
                                                                                                                                theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                                                                                                                                searchDisabled={false}
                                                                                                                                skinTonesDisabled
                                                                                                                                previewConfig={{ showPreview: false }}
                                                                                                                            />
                                                                                                                        </div>
                                                                                                                    )}
                                                                                                                </div>
                                                                                                                <div className="flex justify-end gap-2 mt-1">
                                                                                                                    <button
                                                                                                                        type="button"
                                                                                                                        onClick={() => { setEditingContent({ type: null, id: null, content: '' }); setShowEmojiPicker({ show: false, type: null, id: null }); }}
                                                                                                                        className="text-[10px] text-gray-500 hover:text-gray-700 px-2 py-1"
                                                                                                                    >
                                                                                                                        Cancel
                                                                                                                    </button>
                                                                                                                    <button
                                                                                                                        type="submit"
                                                                                                                        className="text-[10px] bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                                                                                                                    >
                                                                                                                        Save
                                                                                                                    </button>
                                                                                                                </div>
                                                                                                            </form>
                                                                                                        ) : (
                                                                                                            <p className={`text-sm ${reply.isDeleted ? 'text-gray-500 italic' : 'text-gray-700 dark:text-gray-300'} leading-relaxed break-words overflow-hidden`}>
                                                                                                                {reply.isDeleted
                                                                                                                    ? (reply.deletedBy === reply.user?._id ? "This reply was deleted." : "This reply is deleted by admin.")
                                                                                                                    : formatContent(reply.content)}
                                                                                                                {!reply.isDeleted && reply.isEdited && <span className="text-xs text-gray-400 italic font-normal ml-2">(edited)</span>}
                                                                                                            </p>
                                                                                                        )}
                                                                                                        {!reply.isDeleted && (
                                                                                                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                                                                                <button
                                                                                                                    onClick={() => handleReplyReaction(post._id, comment._id, reply._id, 'like')}
                                                                                                                    className={`flex items-center gap-1 text-xs font-bold ${currentUser && reply.likes?.includes(currentUser._id) ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
                                                                                                                >
                                                                                                                    <FaThumbsUp size={10} /> {reply.likes?.length || 0}
                                                                                                                </button>
                                                                                                                <button
                                                                                                                    onClick={() => handleReplyReaction(post._id, comment._id, reply._id, 'dislike')}
                                                                                                                    className={`flex items-center gap-1 text-xs font-bold ${currentUser && reply.dislikes?.includes(currentUser._id) ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                                                                                                                >
                                                                                                                    <FaThumbsDown size={10} />
                                                                                                                </button>
                                                                                                                <button
                                                                                                                    onClick={() => {
                                                                                                                        if (!currentUser) return toast.info('Please sign in to reply');
                                                                                                                        setActiveReplyInput(reply._id);
                                                                                                                        if (reply.user) {
                                                                                                                            setReplyingTo({ userId: reply.user._id, username: reply.user.username });
                                                                                                                        }
                                                                                                                    }}
                                                                                                                    className="text-xs font-bold text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 outline-none transition-colors"
                                                                                                                >
                                                                                                                    Reply
                                                                                                                </button>
                                                                                                                {subReplies.length > 0 && (
                                                                                                                    <button
                                                                                                                        onClick={() => toggleReplies(reply._id)}
                                                                                                                        className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 outline-none"
                                                                                                                    >
                                                                                                                        {expandedReplies[reply._id] ? 'Hide' : `View ${subReplies.length} Replies`}
                                                                                                                    </button>
                                                                                                                )}
                                                                                                                {/* Report Reply Button */}
                                                                                                                {currentUser && currentUser._id !== reply.user?._id && (
                                                                                                                    <button
                                                                                                                        onClick={() => setReportModal({
                                                                                                                            isOpen: true,
                                                                                                                            type: 'reply',
                                                                                                                            id: post._id,
                                                                                                                            commentId: comment._id,
                                                                                                                            replyId: reply._id
                                                                                                                        })}
                                                                                                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                                                                                                        title="Report Reply"
                                                                                                                    >
                                                                                                                        <FaFlag size={10} />
                                                                                                                    </button>
                                                                                                                )}
                                                                                                            </div>
                                                                                                        )}
                                                                                                        {!reply.isDeleted && currentUser && currentUser._id === reply.user?._id && (
                                                                                                            <button
                                                                                                                onClick={() => setEditingContent({ type: 'reply', id: reply._id, content: reply.content })}
                                                                                                                className="absolute right-6 top-1 p-1 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-all opacity-0 group-hover/reply:opacity-100"
                                                                                                                title="Edit Reply"
                                                                                                            >
                                                                                                                <FaEdit size={10} />
                                                                                                            </button>
                                                                                                        )}
                                                                                                        {!reply.isDeleted && currentUser && (currentUser._id === reply.user?._id || currentUser.role === 'admin' || currentUser.role === 'rootadmin') && (
                                                                                                            <button
                                                                                                                onClick={() => handleDeleteReply(post._id, comment._id, reply._id)}
                                                                                                                className="absolute right-1 top-1 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover/reply:opacity-100"
                                                                                                            >
                                                                                                                <FaTimes size={10} />
                                                                                                            </button>
                                                                                                        )}
                                                                                                    </div>
                                                                                                    {/* Reply Input for this specific reply */}
                                                                                                    {activeReplyInput === reply._id && (
                                                                                                        <div className="mt-2 flex gap-2 animate-fade-in pl-2">
                                                                                                            <img
                                                                                                                src={currentUser?.avatar || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"}
                                                                                                                className="w-6 h-6 rounded-full object-cover"
                                                                                                            />
                                                                                                            <form onSubmit={(e) => handleAddReply(e, post._id, comment._id, reply._id)} className="flex-1 flex gap-2">
                                                                                                                <div className="relative flex-1">
                                                                                                                    {showMentionSuggestions.show && showMentionSuggestions.id === comment._id && showMentionSuggestions.type === 'reply' && renderMentionsPanel()}
                                                                                                                    <input
                                                                                                                        type="text"
                                                                                                                        autoFocus
                                                                                                                        value={replyText}
                                                                                                                        onChange={(e) => handleInputChange(e, 'reply', comment._id)}
                                                                                                                        placeholder={`Replying to ${reply.user?.username}...`}
                                                                                                                        className="w-full bg-white dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 text-gray-900 dark:text-white outline-none text-sm py-1 px-2 transition-all"
                                                                                                                    />
                                                                                                                </div>
                                                                                                                <div className="flex gap-1 items-center">
                                                                                                                    <div className="relative">
                                                                                                                        <button
                                                                                                                            type="button"
                                                                                                                            onClick={() => setShowEmojiPicker(prev => ({
                                                                                                                                show: prev.type === 'reply' && prev.id === reply._id ? !prev.show : true,
                                                                                                                                type: 'reply',
                                                                                                                                id: reply._id
                                                                                                                            }))}
                                                                                                                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-all"
                                                                                                                            title="Add Emoji"
                                                                                                                        >
                                                                                                                            <FaSmile className="text-sm" />
                                                                                                                        </button>
                                                                                                                        {showEmojiPicker.show && showEmojiPicker.type === 'reply' && showEmojiPicker.id === reply._id && (
                                                                                                                            <div className="absolute bottom-full right-0 z-[100] mb-2 shadow-xl animate-fade-in bg-white rounded-lg">
                                                                                                                                <div className="flex justify-between items-center bg-gray-50 px-3 py-2 border-b border-gray-100 rounded-t-lg">
                                                                                                                                    <span className="text-xs font-semibold text-gray-500">Pick an emoji</span>
                                                                                                                                    <button
                                                                                                                                        type="button"
                                                                                                                                        onClick={() => setShowEmojiPicker({ show: false, type: null, id: null })}
                                                                                                                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                                                                                                                    >
                                                                                                                                        <FaTimes size={12} />
                                                                                                                                    </button>
                                                                                                                                </div>
                                                                                                                                <EmojiPicker
                                                                                                                                    onEmojiClick={(emojiData) => handleEmojiClick(emojiData, 'reply', reply._id)}
                                                                                                                                    width={300}
                                                                                                                                    height={350}
                                                                                                                                    theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                                                                                                                                    searchDisabled={false}
                                                                                                                                    skinTonesDisabled
                                                                                                                                    previewConfig={{ showPreview: false }}
                                                                                                                                />
                                                                                                                            </div>
                                                                                                                        )}
                                                                                                                    </div>
                                                                                                                    <button
                                                                                                                        type="button"
                                                                                                                        onClick={() => { setActiveReplyInput(null); setReplyText(''); setReplyingTo(null); setShowEmojiPicker({ show: false, type: null, id: null }); }}
                                                                                                                        className="text-xs text-gray-500 px-2 hover:bg-gray-100 rounded"
                                                                                                                    >
                                                                                                                        Cancel
                                                                                                                    </button>
                                                                                                                    <button
                                                                                                                        type="submit"
                                                                                                                        disabled={!replyText.trim()}
                                                                                                                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full disabled:opacity-50"
                                                                                                                    >
                                                                                                                        Reply
                                                                                                                    </button>
                                                                                                                </div>
                                                                                                            </form>
                                                                                                        </div>
                                                                                                    )}
                                                                                                    {/* Recursion: Render replies to this reply */}
                                                                                                    {expandedReplies[reply._id] && (
                                                                                                        <div className={`border-l-2 border-gray-100 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors mt-2 animate-fade-in ${depth < 2 ? 'ml-2 sm:ml-4 pl-2 sm:pl-4' : 'ml-1 pl-1'}`}>
                                                                                                            {repliesLoading[reply._id] ? (
                                                                                                                <div className="space-y-2 animate-pulse py-1">
                                                                                                                    <div className="flex gap-2">
                                                                                                                        <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 animate-pulse"></div>
                                                                                                                        <div className="flex-1 space-y-1">
                                                                                                                            <div className="h-1.5 w-1/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                                                                                                                            <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                            ) : renderReplies(reply._id, depth + 1)}
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                });
                                                                            };
                                                                            // Start rendering with null for root replies (reply directly to comment)
                                                                            return renderReplies(null);
                                                                        })()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-center text-gray-500 dark:text-gray-400 text-sm py-2">No comments yet. Be the first to share your thoughts!</p>
                                                )}
                                            </div>

                                            {currentUser && (
                                                <form onSubmit={(e) => handleAddComment(e, post._id)} className="flex gap-2">
                                                    <img
                                                        src={currentUser.avatar || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"}
                                                        className="w-8 h-8 rounded-full object-cover"
                                                        alt="Current User"
                                                    />
                                                    <div className="flex-1 relative">
                                                        {showMentionSuggestions.show && showMentionSuggestions.id === post._id && showMentionSuggestions.type === 'comment' && renderMentionsPanel()}
                                                        <input
                                                            type="text"
                                                            placeholder="Write a comment... (use @ to mention property)"
                                                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full pl-4 pr-16 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-900/30 text-gray-900 dark:text-white text-sm transition-all"
                                                            value={commentText[post._id] || ''}
                                                            onChange={(e) => handleInputChange(e, 'comment', post._id)}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowEmojiPicker(prev => ({
                                                                show: prev.type === 'comment' && prev.id === post._id ? !prev.show : true,
                                                                type: 'comment',
                                                                id: post._id
                                                            }))}
                                                            className="absolute right-9 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                                            title="Add Emoji"
                                                        >
                                                            <FaSmile className="text-base" />
                                                        </button>
                                                        {showEmojiPicker.show && showEmojiPicker.type === 'comment' && showEmojiPicker.id === post._id && (
                                                            <div className="absolute bottom-full right-0 z-[100] mb-2 shadow-xl animate-fade-in bg-white rounded-lg">
                                                                <div className="flex justify-between items-center bg-gray-50 px-3 py-2 border-b border-gray-100 rounded-t-lg">
                                                                    <span className="text-xs font-semibold text-gray-500">Pick an emoji</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setShowEmojiPicker({ show: false, type: null, id: null })}
                                                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                                                    >
                                                                        <FaTimes size={12} />
                                                                    </button>
                                                                </div>
                                                                <EmojiPicker
                                                                    onEmojiClick={(emojiData) => handleEmojiClick(emojiData, 'comment', post._id)}
                                                                    width={300}
                                                                    height={350}
                                                                    theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                                                                    searchDisabled={false}
                                                                    skinTonesDisabled
                                                                    previewConfig={{ showPreview: false }}
                                                                />
                                                            </div>
                                                        )}
                                                        <button
                                                            type="submit"
                                                            disabled={!commentText[post._id]?.trim()}
                                                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            <FaArrowRight className="text-xs" />
                                                        </button>
                                                    </div>
                                                </form>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                        {hasMore && (
                            <div id="infinite-scroll-trigger" className="pt-4 pb-8 flex justify-center">
                                {loadingMore ? (
                                    <div className="w-full space-y-6">
                                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 space-y-4 animate-pulse">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                                    <div className="h-3 w-1/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                                <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
                                                <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                            </div>
                                            <div className="flex gap-2">
                                                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                                                <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-sm text-gray-500">Scroll down to explore more</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="hidden lg:block space-y-6">
                        {/* Community Stats */}
                        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 transition-colors duration-300">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Community Stats</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-full text-blue-600 dark:text-blue-300"><FaUsers /></div>
                                        <span className="text-gray-700 dark:text-gray-300 font-medium">Active Members</span>
                                    </div>
                                    <span className="font-bold text-gray-900 dark:text-white text-lg">{stats.activeMembers}</span>
                                </div>
                                <div className="flex justify-between items-center bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-800">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-green-100 dark:bg-green-800 rounded-full text-green-600 dark:text-green-300"><FaComment /></div>
                                        <span className="text-gray-700 dark:text-gray-300 font-medium">Daily Posts</span>
                                    </div>
                                    <span className="font-bold text-gray-900 dark:text-white text-lg">{stats.dailyPosts}</span>
                                </div>
                                <div className="flex justify-between items-center bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-100 dark:border-purple-800">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-full text-purple-600 dark:text-purple-300"><FaCalendarAlt /></div>
                                        <span className="text-gray-700 dark:text-gray-300 font-medium">Events This Week</span>
                                    </div>
                                    <span className="font-bold text-gray-900 dark:text-white text-lg">{stats.eventsThisWeek}</span>
                                </div>
                            </div>
                        </div>

                        {/* Trending Topics */}
                        {/* Trending Topics - Animated list */}
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 dark:from-gray-900 dark:to-blue-900 rounded-xl shadow-lg border border-transparent p-6 text-white overflow-hidden relative transition-colors duration-300">
                            {/* Decorative circles */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl -ml-10 -mb-10"></div>

                            <h3 className="text-lg font-bold mb-4 relative z-10 flex items-center gap-2">
                                <FaBullhorn className="text-yellow-300" /> Trending Topics
                            </h3>
                            <ul className="space-y-3 relative z-10">
                                {stats.trendingTopics && stats.trendingTopics.length > 0 ? (
                                    stats.trendingTopics.map((topic, index) => (
                                        <li
                                            key={topic._id}
                                            onClick={() => navigate(currentUser ? `/user/community/post/${topic._id}` : `/community/post/${topic._id}`)}
                                            className="flex items-center cursor-pointer hover:bg-white/10 p-2 rounded-lg transition-colors group"
                                        >
                                            <span className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center text-xs mr-3 group-hover:scale-110 transition-transform">#{index + 1}</span>
                                            <span className="font-medium truncate">{topic.title}</span>
                                        </li>
                                    ))
                                ) : (
                                    <li className="text-sm opacity-80 pl-2">No trending topics yet.</li>
                                )}
                            </ul>
                        </div>

                        {/* Community Guidelines Link Card */}
                        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 transition-colors duration-300">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-full text-amber-600 dark:text-amber-400">
                                    <FaShieldAlt />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Guidelines</h3>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                Our community is built on respect. Please review our guidelines to keep UrbanSetu a safe place for everyone.
                            </p>
                            <Link
                                to={currentUser?.role === 'admin' || currentUser?.role === 'rootadmin' ? '/admin/community-guidelines' : currentUser ? '/user/community-guidelines' : '/community-guidelines'}
                                className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold hover:underline group"
                            >
                                View Guidelines <FaArrowRight className="text-xs group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>

                        {/* Community Support & Feedback card in Sidebar */}
                        <div className="bg-gradient-to-br from-blue-50/40 to-indigo-50/40 dark:from-gray-900/60 dark:to-blue-950/20 rounded-xl shadow-sm border border-blue-100/30 dark:border-gray-800 p-6 transition-all duration-300 hover:scale-[1.01]">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-full text-blue-600 dark:text-blue-400">
                                    <FaEnvelope />
                                </div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">Community Support</h3>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                                Have questions about our community guidelines, need moderation assistance, or want to share feedback? Our team is here to support you.
                            </p>
                            <a 
                                href="mailto:urbansetu.noreply@gmail.com"
                                className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline group"
                            >
                                urbansetu.noreply@gmail.com <FaArrowRight className="text-[10px] group-hover:translate-x-1 transition-transform" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Mobile-only Guidelines & Support Block */}
                <div className="block lg:hidden mt-8 space-y-6">
                    {/* Guidelines Card */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 transition-colors duration-300">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-full text-amber-600 dark:text-amber-400">
                                <FaShieldAlt />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Guidelines</h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            Our community is built on respect. Please review our guidelines to keep UrbanSetu a safe place for everyone.
                        </p>
                        <Link
                            to={currentUser?.role === 'admin' || currentUser?.role === 'rootadmin' ? '/admin/community-guidelines' : currentUser ? '/user/community-guidelines' : '/community-guidelines'}
                            className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold hover:underline group"
                        >
                            View Guidelines <FaArrowRight className="text-xs group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>

                    {/* Support Block */}
                    <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-gray-900/50 dark:to-blue-950/20 rounded-2xl p-6 border border-blue-100/50 dark:border-gray-800 shadow-sm">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
                                <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-400">
                                    <FaEnvelope className="text-lg" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900 dark:text-white">Community Support & Feedback</h3>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                        Have guidelines questions or need moderation support? Reach us out.
                                    </p>
                                </div>
                            </div>
                            <a 
                                href="mailto:urbansetu.noreply@gmail.com"
                                className="w-full sm:w-auto text-center px-4 py-2 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 text-sm font-bold border border-blue-100 dark:border-gray-700/60 rounded-xl shadow-sm hover:bg-blue-50"
                            >
                                urbansetu.noreply@gmail.com
                            </a>
                        </div>
                    </div>
                </div>

                {/* Create Post Modal */}
                {
                    showCreateModal && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200 shadow-2xl transition-colors duration-300">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {editingPost ? 'Edit Discussion' : 'Start a Discussion'}
                                    </h2>
                                </div>

                                <form onSubmit={(e) => editingPost ? handleUpdatePost(e, editingPost._id) : handleCreatePost(e)} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                                        <input
                                            type="text"
                                            value={newPost.title}
                                            onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                            placeholder="What's on your mind?"
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                                            <select
                                                value={newPost.category}
                                                onChange={(e) => setNewPost({ ...newPost, category: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                            >
                                                {categories.filter(c => c.id !== 'All').map(cat => (
                                                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
                                            <input
                                                type="text"
                                                value={newPost.location.city}
                                                onChange={(e) => setNewPost({ ...newPost, location: { ...newPost.location, city: e.target.value } })}
                                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                                placeholder="e.g. Mumbai"
                                            />
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
                                        {showMentionSuggestions.show && showMentionSuggestions.type === 'post' && renderMentionsPanel()}
                                        <textarea
                                            value={newPost.content}
                                            onChange={(e) => handleInputChange(e, 'post')}
                                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none h-32 resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                            placeholder="Share details... Use @ to mention property"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowEmojiPicker(prev => ({
                                                show: prev.type === 'post' ? !prev.show : true,
                                                type: 'post',
                                                id: 'new-post'
                                            }))}
                                            className="absolute right-2 bottom-2 p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-all"
                                            title="Add Emoji"
                                        >
                                            <FaSmile className="text-lg" />
                                        </button>
                                        {showEmojiPicker.show && showEmojiPicker.type === 'post' && (
                                            <div className="absolute bottom-full right-0 z-[100] mb-2 shadow-xl animate-fade-in bg-white rounded-lg">
                                                <div className="flex justify-between items-center bg-gray-50 px-3 py-2 border-b border-gray-100 rounded-t-lg">
                                                    <span className="text-xs font-semibold text-gray-500">Pick an emoji</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowEmojiPicker({ show: false, type: null, id: null })}
                                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                                    >
                                                        <FaTimes size={12} />
                                                    </button>
                                                </div>
                                                <EmojiPicker
                                                    onEmojiClick={(emojiData) => handleEmojiClick(emojiData, 'post', 'new-post')}
                                                    width={300}
                                                    height={350}
                                                    theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                                                    searchDisabled={false}
                                                    skinTonesDisabled
                                                    previewConfig={{ showPreview: false }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-end pt-4">
                                        <button
                                            type="button"
                                            onClick={handleCloseModal}
                                            className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg mr-2 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md transition-colors"
                                        >
                                            {editingPost ? 'Save Changes' : 'Post Discussion'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )
                }
                {/* Confirmation Modal */}
                <ConfirmationModal
                    isOpen={confirmModal.isOpen}
                    onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                    onConfirm={confirmModal.onConfirm}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    confirmText={confirmModal.confirmText}
                    isDestructive={confirmModal.isDestructive}
                />
                <ReportModal
                    isOpen={reportModal.isOpen}
                    onClose={() => setReportModal({ isOpen: false, type: 'post', id: null, commentId: null, replyId: null })}
                    onReport={(reason) => handleReport(reason)}
                />
                <SocialSharePanel
                    isOpen={shareModal.isOpen}
                    onClose={() => setShareModal({ ...shareModal, isOpen: false })}
                    url={shareModal.url}
                    title={shareModal.title}
                    description={shareModal.description}
                />
            </div>
        </div >
    );
}
