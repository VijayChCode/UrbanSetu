import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaRobot, FaUser, FaClock, FaCalendar, FaExclamationTriangle, FaArrowRight, FaDownload, FaExternalLinkAlt, FaChevronLeft, FaChevronRight, FaPaperPlane, FaUserCircle, FaCopy, FaCheck } from 'react-icons/fa';
import { toast } from 'react-toastify';

import { usePageTitle } from '../hooks/usePageTitle';
import GeminiAIWrapper from "../components/GeminiAIWrapper";
import SharedChatViewSkeleton from '../components/skeletons/SharedChatViewSkeleton';
import ContactSupportWrapper from '../components/ContactSupportWrapper';
import { authenticatedFetch } from '../utils/auth';
import ListingItem from '../components/ListingItem';
import BlogGuideItem from '../components/BlogGuideItem';
import ImagePreview from '../components/ImagePreview';

const TypewriterText = ({ text, delay = 35, className = "" }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        setDisplayedText('');
        setCurrentIndex(0);
    }, [text]);

    useEffect(() => {
        if (!text || currentIndex >= text.length) return;

        const timeout = setTimeout(() => {
            setDisplayedText(prev => prev + text[currentIndex]);
            setCurrentIndex(prev => prev + 1);
        }, delay);

        return () => clearTimeout(timeout);
    }, [currentIndex, text, delay]);

    return <span className={className}>{displayedText}</span>;
};

export default function SharedChatView() {
    const { shareToken } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useSelector((state) => state.user);
    const [chatData, setChatData] = useState(null);
    usePageTitle(chatData ? chatData.title : "Shared Chat", "SetuAI Shared Chat");
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [importedSessionId, setImportedSessionId] = useState(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [error, setError] = useState(null);
    const [inputToken, setInputToken] = useState('');
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [copiedMessageIndex, setCopiedMessageIndex] = useState(null);
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
    const [previewImages, setPreviewImages] = useState([]);
    const [previewImageIndex, setPreviewImageIndex] = useState(0);
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://urbansetu-pvt4.onrender.com';

    useEffect(() => {
        const fetchChat = async () => {
            try {
                const viewedKey = `viewed_${shareToken}`;
                const alreadyViewed = sessionStorage.getItem(viewedKey);

                const res = await authenticatedFetch(`${API_BASE_URL}/api/shared-chat/view/${shareToken}${alreadyViewed ? '?inc=0' : ''}`);
                const data = await res.json();

                if (data.success) {
                    setChatData(data.sharedChat);
                    if (data.sharedChat.messages) {
                        setMessages(data.sharedChat.messages);
                    }
                    if (!alreadyViewed) {
                        sessionStorage.setItem(viewedKey, 'true');
                    }
                } else {
                    setError(data.message || "Chat not found");
                }
            } catch (err) {
                setError("Failed to load chat");
            } finally {
                setLoading(false);
            }
        };
        fetchChat();
    }, [shareToken, API_BASE_URL]);

    const handleImportChat = async () => {
        if (!currentUser) {
            setShowAuthModal(true);
            return;
        }

        setImporting(true);
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/shared-chat/import/${shareToken}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();

            if (data.success) {
                setImportedSessionId(data.sessionId);
                toast.success('Chat imported successfully!');
            } else {
                toast.error(data.message || "Failed to import chat");
            }
        } catch (err) {
            console.error(err);
            toast.error("An error occurred while importing");
        } finally {
            setImporting(false);
        }
    };

    const handleCopy = (text, index) => {
        navigator.clipboard.writeText(text);
        setCopiedMessageIndex(index);
        setTimeout(() => setCopiedMessageIndex(null), 2000);
    };

    const switchMessageVersion = (index, newVersionIndex) => {
        if (newVersionIndex < 0) return;
        
        setMessages(prev => {
            const next = [...prev];
            const message = { ...next[index] };

            if (!message.variants || newVersionIndex >= message.variants.length) return prev;

            // 1. Save current state of this version before switching
            const currentActiveIndex = message.activeVersionIndex || 0;
            const updatedVariants = [...message.variants];
            
            updatedVariants[currentActiveIndex] = {
                ...updatedVariants[currentActiveIndex],
                content: message.content,
                tail: next.slice(index + 1),
                recommendations: message.recommendations,
                timestamp: message.timestamp
            };

            // 2. Switch to target version
            const targetVersion = updatedVariants[newVersionIndex];
            
            const updatedMessage = {
                ...message,
                content: targetVersion.content,
                activeVersionIndex: newVersionIndex,
                variants: updatedVariants,
                recommendations: targetVersion.recommendations,
                timestamp: targetVersion.timestamp || message.timestamp
            };

            // 3. Reconstruct full list with the new message and its stored tail
            return [
                ...next.slice(0, index),
                updatedMessage,
                ...(targetVersion.tail || [])
            ];
        });
    };
    
    const RecommendationSlider = ({ recommendations }) => {
        const scrollRef = React.useRef(null);
        const [showLeftArrow, setShowLeftArrow] = React.useState(false);
        const [showRightArrow, setShowRightArrow] = React.useState(true);
    
        const checkScroll = () => {
            if (!scrollRef.current) return;
            const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
            setShowLeftArrow(scrollLeft > 10);
            setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
        };
    
        React.useEffect(() => {
            checkScroll();
            window.addEventListener('resize', checkScroll);
            return () => window.removeEventListener('resize', checkScroll);
        }, []);
    
        const scroll = (direction) => {
            if (!scrollRef.current) return;
            const scrollAmount = 300;
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        };
    
        return (
            <div className="relative group/slider">
                {showLeftArrow && (
                    <button 
                        onClick={() => scroll('left')}
                        className="absolute left-[-15px] sm:left-[-20px] top-1/2 -translate-y-1/2 z-10 w-9 h-9 flex items-center justify-center bg-white dark:bg-gray-800 rounded-full shadow-2xl border border-gray-100 dark:border-gray-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all transform hover:scale-110 active:scale-90"
                        aria-label="Previous properties"
                    >
                        <FaChevronLeft size={14} />
                    </button>
                )}
                
                <div 
                    ref={scrollRef}
                    onScroll={checkScroll}
                    className="flex overflow-x-auto pb-4 gap-6 no-scrollbar scroll-smooth snap-x"
                >
                    {recommendations.map((item, pIdx) => {
                        // Determine if it's a property (ListingItem) or a blog/guide (BlogGuideItem)
                        const isProperty = item.bedrooms !== undefined || item.bathrooms !== undefined || item.type === 'rent' || item.type === 'sale';
                        const isBlogGuide = item.category || item.excerpt || item.type === 'blog' || item.type === 'guide';
                        
                        return (
                            <div key={item._id || pIdx} className="flex-shrink-0 w-[240px] sm:w-[280px] snap-start transform transition-all duration-500 hover:scale-[1.05] hover:-translate-y-2">
                                {isProperty ? (
                                    <ListingItem listing={item} />
                                ) : isBlogGuide ? (
                                    <BlogGuideItem item={item} type={item.type || 'blog'} />
                                ) : (
                                    <ListingItem listing={item} /> // Fallback for stability
                                )}
                            </div>
                        );
                    })}
                </div>
    
                {showRightArrow && (
                    <button 
                        onClick={() => scroll('right')}
                        className="absolute right-[-15px] sm:right-[-20px] top-1/2 -translate-y-1/2 z-10 w-9 h-9 flex items-center justify-center bg-white dark:bg-gray-800 rounded-full shadow-2xl border border-gray-100 dark:border-gray-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all transform hover:scale-110 active:scale-90"
                        aria-label="Next properties"
                    >
                        <FaChevronRight size={14} />
                    </button>
                )}
            </div>
        );
    };



    const formatText = (text, isUser = false) => {
        if (!text) return null;

        let processedText = text;
        processedText = processedText
            .replace(/^### (.*$)/gim, '<h3 class="text-base sm:text-lg font-bold mt-4 mb-2 text-gray-900 dark:text-white">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="text-lg sm:text-xl font-bold mt-5 mb-3 text-gray-900 dark:text-white">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="text-xl sm:text-2xl font-extrabold mt-6 mb-4 text-gray-900 dark:text-white">$1</h1>')
            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
            .replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
            .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal">$1</li>');

        const parts = processedText.split(/(```[\s\S]*?```)/g);

        return parts.map((part, index) => {
            if (part.startsWith('```') && part.endsWith('```')) {
                const content = part.slice(3, -3).replace(/^\w+\n/, '');
                return (
                    <div key={index} className="bg-gray-900 text-gray-100 p-4 rounded-xl my-4 font-mono text-xs sm:text-sm border border-gray-700 shadow-xl">
                        <pre className="overflow-x-auto no-scrollbar">{content}</pre>
                    </div>
                );
            }

            const subParts = part.split(/(\[.*?\]\(.*?\)|https?:\/\/[^\s]+|\b\w+\.(?:png|jpg|jpeg|gif|webp)\b)/gi);
            return (
                <div key={index} className={`${isUser ? 'text-white' : 'text-gray-800 dark:text-gray-200'} leading-relaxed`}>
                    {subParts.map((subPart, subIndex) => {
                        const mdLinkMatch = subPart.match(/^\[(.*?)\]\((.*?)\)$/);
                        if (mdLinkMatch) {
                            return (
                                <a key={subIndex} href={mdLinkMatch[2]} target="_blank" rel="noopener noreferrer" className={`${isUser ? 'text-white underline font-bold' : 'text-blue-600 dark:text-blue-400 underline font-semibold'} hover:opacity-80 transition-opacity`}>
                                    {mdLinkMatch[1]}
                                </a>
                            );
                        }

                        const urlMatch = subPart.match(/^https?:\/\/[^\s]+$/);
                        if (urlMatch) {
                            return (
                                <a key={subIndex} href={subPart} target="_blank" rel="noopener noreferrer" className={`${isUser ? 'text-white underline font-bold' : 'text-blue-600 dark:text-blue-400 underline font-semibold'} hover:opacity-80 transition-opacity`}>
                                    {subPart}
                                </a>
                            );
                        }

                        const imageFileMatch = subPart.match(/^\b\w+\.(?:png|jpg|jpeg|gif|webp)\b$/i);
                        if (imageFileMatch) {
                            // Find the actual image URL in the current message or history if possible
                            // For simplicity in shared view, we just render it as a highlighted span that can open preview if common image
                            return (
                                <span 
                                    key={subIndex} 
                                    className="cursor-pointer text-indigo-500 dark:text-indigo-400 font-bold hover:underline"
                                    onClick={() => {
                                        // Try to find if this filename matches any known image URL
                                        // This is a bit limited for shared view but better than just text
                                        const knownImages = messages.flatMap(m => m.images || (m.imageUrl ? [m.imageUrl] : []));
                                        const match = knownImages.find(img => img.includes(subPart));
                                        if (match) {
                                            setPreviewImages([match]);
                                            setPreviewImageIndex(0);
                                            setIsImagePreviewOpen(true);
                                        } else {
                                            toast.info("Image reference found: " + subPart);
                                        }
                                    }}
                                >
                                    {subPart}
                                </span>
                            );
                        }

                        return <span key={subIndex} dangerouslySetInnerHTML={{ __html: subPart }} />;
                    })}
                </div>
            );
        });
    };

    const handleManualSubmit = () => {
        if (!inputToken.trim()) return;
        const currentPath = window.location.pathname;
        const parts = currentPath.split('/');
        if (parts[parts.length - 1] === '') parts.pop();
        parts[parts.length - 1] = inputToken.trim();
        navigate(parts.join('/'));
        setError(null);
        setLoading(true);
    };

    if (loading) return <SharedChatViewSkeleton />;

    if (error) {
        return (
            <div className="min-h-screen bg-transparent dark:bg-gray-950 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 p-10 rounded-3xl shadow-2xl max-w-md w-full text-center border dark:border-gray-700 animate-fadeIn">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FaExclamationTriangle className="text-red-500 dark:text-red-400 text-4xl" />
                    </div>
                    <h2 className="text-2xl font-black mb-3 dark:text-white font-outfit uppercase tracking-tight">Access Denied</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-8 font-medium">{error}</p>
                    <div className="relative mb-8">
                        <input
                            type="text"
                            value={inputToken}
                            onChange={(e) => setInputToken(e.target.value)}
                            placeholder="Enter chat token..."
                            className="w-full px-5 py-4 pr-14 rounded-2xl border-2 border-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:border-blue-500 transition-all outline-none text-lg font-bold"
                        />
                        <button onClick={handleManualSubmit} className="absolute right-3 top-3 p-2 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition-colors"><FaArrowRight size={18} /></button>
                    </div>
                    <div className="flex flex-col gap-3">
                        <a href="/ai" className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-500/30 hover:scale-[1.02] active:scale-95 transition-all">Start Your Own AI Journey</a>
                        <a href="/" className="w-full py-3 rounded-2xl bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 font-bold text-sm">Return Home</a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col transition-colors duration-300 font-inter">
            <header className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50 py-3 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 flex flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-xl rotate-3">
                            <FaRobot size={22} />
                        </div>
                        <div className="min-w-0">
                            <h1 className="font-black text-gray-900 dark:text-white text-lg sm:text-xl truncate tracking-tight leading-none">
                                <TypewriterText text={chatData.title || "SetuAI Intelligence Shared"} />
                            </h1>
                            <div className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 font-bold flex flex-wrap items-center gap-2 mt-1 uppercase tracking-widest whitespace-nowrap">
                                <span className="flex items-center gap-1.5"><FaCalendar size={10} className="text-blue-500" /> {(chatData.date || chatData.createdAt) ? new Date(chatData.date || chatData.createdAt).toLocaleDateString() : 'Recent'}</span>
                                <span className="w-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full hidden sm:block"></span>
                                {chatData.expiresAt ? (
                                    <span className="flex items-center gap-1.5 text-orange-500">
                                        <FaClock size={10} /> Expires: {new Date(chatData.expiresAt).toLocaleDateString()}
                                    </span>
                                ) : (
                                    <span className="text-indigo-500">Shared via SetuAI</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {importedSessionId ? (
                            <button onClick={() => navigate(currentUser?.role?.includes('admin') ? `/admin/ai?session=${importedSessionId}` : `/user/ai?session=${importedSessionId}`)} className="h-10 flex items-center gap-2 px-4 rounded-xl bg-green-500 text-white font-black text-[10px] uppercase shadow-lg shadow-green-500/30 active:scale-95 transition-all">
                                <FaExternalLinkAlt size={10} /> Open
                            </button>
                        ) : (
                            <button onClick={handleImportChat} disabled={importing} className="h-10 flex items-center gap-2 px-4 rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase shadow-lg shadow-indigo-600/30 active:scale-95 transition-all disabled:opacity-70 group overflow-hidden">
                                {importing ? (
                                    <div className="flex items-center gap-2">
                                        <span>Importing<span className="animate-dots"></span></span>
                                    </div>
                                ) : (
                                    <>
                                        <FaDownload size={10} className="group-hover:-translate-y-0.5 transition-transform" />
                                        <span>Import</span>
                                    </>
                                )}
                            </button>
                        )}
                        <a href="/ai" className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-blue-600 hover:text-white transition-all shadow-sm active:rotate-12" title="New Chat">
                            <FaPaperPlane size={14} />
                        </a>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 space-y-12">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex gap-5 sm:gap-8 ${msg.role === 'user' ? 'flex-row-reverse' : ''} group relative`}>
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-2xl transform transition-transform group-hover:scale-110 ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 border-2 border-gray-50 dark:border-gray-700 text-indigo-500'}`}>
                            {msg.role === 'user' ? (currentUser?.avatar ? <img src={currentUser.avatar} className="w-full h-full rounded-2xl object-cover" alt="" /> : <FaUserCircle size={24} />) : <FaRobot size={22} />}
                        </div>

                        <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'text-right' : ''}`}>
                            <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${msg.role === 'user' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                {msg.role === 'user' ? 'Contributor' : 'SetuAI'}
                            </h4>

                            <div className={`relative inline-block text-left w-full sm:w-auto max-w-full rounded-[2rem] p-6 sm:p-8 shadow-2xl transition-all ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 border-2 border-gray-50 dark:border-gray-800 text-gray-800 dark:text-blue-50 rounded-tl-none'}`}>

                                {msg.variants && msg.variants.length > 1 && (
                                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black tracking-tighter ${msg.role === 'user' ? 'bg-white/10 text-white/90' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'} mb-4 w-fit border ${msg.role === 'user' ? 'border-white/20' : 'border-gray-200 dark:border-gray-600'} select-none`}>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); switchMessageVersion(index, (msg.activeVersionIndex || 0) - 1); }} 
                                            disabled={(msg.activeVersionIndex || 0) === 0} 
                                            className="hover:scale-125 disabled:opacity-30 transition-all p-0.5"
                                            title="Previous version"
                                        >
                                            <FaChevronLeft size={7} />
                                        </button>
                                        <div className="flex items-center gap-0.5 min-w-[24px] justify-center">
                                            <span className="opacity-90">{(msg.activeVersionIndex || 0) + 1}</span>
                                            <span className="opacity-50">/</span>
                                            <span className="opacity-90">{msg.variants.length}</span>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); switchMessageVersion(index, (msg.activeVersionIndex || 0) + 1); }} 
                                            disabled={(msg.activeVersionIndex || 0) === msg.variants.length - 1} 
                                            className="hover:scale-125 disabled:opacity-30 transition-all p-0.5"
                                            title="Next version"
                                        >
                                            <FaChevronRight size={7} />
                                        </button>
                                    </div>
                                )}

                                {/* Media Display */}
                                {(msg.imageUrl || (msg.images && msg.images.length > 0)) && (
                                    <div className="mb-4 flex flex-wrap gap-3">
                                        {(msg.images && msg.images.length > 0 ? msg.images : [msg.imageUrl]).filter(Boolean).map((img, imgIdx) => (
                                            <div key={imgIdx} className="relative group w-32 h-32 sm:w-40 sm:h-40 rounded-2xl overflow-hidden border-2 border-gray-100 dark:border-gray-700 shadow-xl transition-all hover:scale-[1.05] hover:rotate-1">
                                                <img
                                                    src={img}
                                                    alt={`Shared image ${imgIdx + 1}`}
                                                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPreviewImages(msg.images && msg.images.length > 0 ? msg.images : [msg.imageUrl]);
                                                        setPreviewImageIndex(imgIdx);
                                                        setIsImagePreviewOpen(true);
                                                    }}
                                                />
                                                <button
                                                    className="absolute top-2 right-2 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 p-2 rounded-xl shadow-lg transition-all opacity-0 group-hover:opacity-100 hover:scale-110 hidden sm:block"
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                            const response = await fetch(img, { mode: 'cors' });
                                                            if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                                            const blob = await response.blob();
                                                            const blobUrl = window.URL.createObjectURL(blob);
                                                            const a = document.createElement('a');
                                                            a.href = blobUrl;
                                                            a.download = `shared-image-${Date.now()}.${blob.type.split('/')[1] || 'jpg'}`;
                                                            document.body.appendChild(a);
                                                            a.click();
                                                            document.body.removeChild(a);
                                                            window.URL.revokeObjectURL(blobUrl);
                                                        } catch (err) {
                                                            console.error('Download error:', err);
                                                            toast.error('Failed to download image');
                                                        }
                                                    }}
                                                    title="Download image"
                                                >
                                                    <FaDownload size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className={`text-base sm:text-lg whitespace-pre-wrap ${msg.role === 'user' ? 'font-medium' : ''}`}>
                                    {formatText(msg.content, msg.role === 'user')}
                                </div>

                                {msg.recommendations && msg.recommendations.length > 0 && (
                                    <div className="mt-10 pt-10 border-t-2 border-gray-50 dark:border-gray-700/50">
                                        <div className="flex items-center justify-between mb-8 overflow-hidden">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-[2px] bg-indigo-500 rounded-full"></div>
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500 whitespace-nowrap">Elite Recommendations</h4>
                                            </div>
                                            <div className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest bg-gray-50 dark:bg-gray-800 px-3 py-1 rounded-full whitespace-nowrap">
                                                {msg.recommendations.length} {(() => {
                                                    const hasBlogs = msg.recommendations.some(r => r.type === 'blog' || r.type === 'guide');
                                                    return hasBlogs ? 'Articles' : 'Properties';
                                                })()}
                                            </div>
                                        </div>
                                        <RecommendationSlider recommendations={msg.recommendations} />
                                    </div>
                                )}
                            </div>

                            <div className={`mt-3 text-[10px] flex items-center gap-4 font-black uppercase tracking-widest ${msg.role === 'user' ? 'justify-end text-indigo-300' : 'text-gray-400'}`}>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => handleCopy(msg.content, index)}
                                        className={`${copiedMessageIndex === index ? 'text-green-500' : 'hover:text-blue-500'} transition-colors flex items-center gap-1 min-w-[60px]`}
                                        title="Copy Message"
                                    >
                                        {copiedMessageIndex === index ? (
                                            <>
                                                <FaCheck size={10} /> Copied
                                            </>
                                        ) : (
                                            <>
                                                <FaCopy size={10} /> Copy
                                            </>
                                        )}
                                    </button>
                                </div>
                                <div className="flex items-center gap-1.5 opacity-60">
                                    <FaClock size={10} className="animate-pulse" /> {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Live'}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-8 animate-pulse">
                        <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800/50"></div>
                        <div className="flex-1 space-y-4">
                            <div className="h-4 bg-gray-100 dark:bg-gray-800/50 rounded-full w-1/4"></div>
                            <div className="h-32 bg-gray-100 dark:bg-gray-900/30 rounded-3xl"></div>
                        </div>
                    </div>
                )}
            </main>

            <footer className="bg-gray-50/50 dark:bg-gray-900/50 py-24 border-t border-gray-100 dark:border-gray-800 mt-24 text-center backdrop-blur-2xl">
                <div className="max-w-2xl mx-auto px-4">
                    <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex items-center justify-center mx-auto mb-8 transform -rotate-12 border dark:border-gray-700">
                        <FaRobot size={18} className="text-blue-600" />
                    </div>
                    <h3 className="text-3xl font-black dark:text-white mb-4 tracking-tight leading-none uppercase">Fuel Your Curiosity</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-10 text-lg font-medium leading-relaxed">This conversation belongs to the future. Start your own personalized AI session now and get instant market clarity.</p>
                    <a href="/ai" className="inline-flex items-center gap-3 bg-indigo-600 text-white px-10 py-5 rounded-[2.5rem] font-black uppercase tracking-widest text-xs shadow-2xl shadow-indigo-600/40 hover:scale-[1.05] active:scale-95 transition-all">Launch Full Assistant <FaArrowRight size={12} /></a>
                </div>
            </footer>

            {showAuthModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-lg" onClick={() => setShowAuthModal(false)} />
                    <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] p-10 transform transition-all animate-scaleIn border border-gray-100 dark:border-gray-800">
                        <div className="text-center">
                            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
                                <FaUserCircle size={40} className="text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-3 uppercase tracking-tight">Identity Required</h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-10 font-medium leading-relaxed">Please sign in to securely import this conversation into your personal intelligence library.</p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        const returnUrl = encodeURIComponent(window.location.pathname);
                                        navigate(`/sign-in?redirect=${returnUrl}`);
                                    }}
                                    className="w-full py-5 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-600/30 hover:scale-[1.02] active:scale-95 transition-all"
                                >
                                    Sign In Context
                                </button>
                                <button
                                    onClick={() => setShowAuthModal(false)}
                                    className="w-full py-4 rounded-xxl text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest text-[10px]"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <GeminiAIWrapper />
            <ContactSupportWrapper />

            <ImagePreview 
                isOpen={isImagePreviewOpen}
                onClose={() => setIsImagePreviewOpen(false)}
                images={previewImages}
                initialIndex={previewImageIndex}
            />

            <style>{`
                @font-face { font-family: 'Outfit'; src: url('https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap'); }
                .font-outfit { font-family: 'Outfit', sans-serif; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                @keyframes dots {
                    0%, 20% { content: ''; }
                    40% { content: '.'; }
                    60% { content: '..'; }
                    80%, 100% { content: '...'; }
                }
                .animate-dots::after {
                    content: '';
                    animation: dots 1.5s steps(1) infinite;
                }
                .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
                .animate-scaleIn { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
            `}</style>
        </div>
    );
}
