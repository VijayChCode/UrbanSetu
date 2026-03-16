import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaRobot, FaUser, FaClock, FaCalendar, FaExclamationTriangle, FaArrowRight, FaDownload } from 'react-icons/fa';

import { usePageTitle } from '../hooks/usePageTitle';
import GeminiAIWrapper from "../components/GeminiAIWrapper";
import SharedChatViewSkeleton from '../components/skeletons/SharedChatViewSkeleton';
import ContactSupportWrapper from '../components/ContactSupportWrapper';
import { authenticatedFetch } from '../utils/auth';
import ListingItem from '../components/ListingItem';

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
    usePageTitle(chatData ? chatData.title : "Shared Chat", "SetuAI");
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [importedSessionId, setImportedSessionId] = useState(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [error, setError] = useState(null);
    const [inputToken, setInputToken] = useState('');
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
    }, [shareToken]);

    const handleImportChat = async () => {
        if (!currentUser) {
            setShowAuthModal(true);
            return;
        }

        setImporting(true);
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/shared-chat/import/${shareToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const data = await res.json();

            if (data.success) {
                setImportedSessionId(data.sessionId);
            } else {
                alert(data.message || "Failed to import chat");
            }
        } catch (err) {
            console.error(err);
            alert("An error occurred while importing");
        } finally {
            setImporting(false);
        }
    };

    // Simple text formatter to handle basic markdown-like syntax
    const formatText = (text) => {
        if (!text) return null;

        // Split by code blocks first
        const parts = text.split(/(```[\s\S]*?```)/g);

        return parts.map((part, index) => {
            if (part.startsWith('```') && part.endsWith('```')) {
                // Render code block
                const content = part.slice(3, -3).replace(/^\w+\n/, ''); // Remove language identifier if present
                return (
                    <div key={index} className="bg-gray-800 text-gray-200 p-3 rounded-lg my-2 font-mono text-sm overflow-x-auto">
                        <pre>{content}</pre>
                    </div>
                );
            }

            // Render text with bolding
            return (
                <div key={index} className="whitespace-pre-wrap">
                    {part.split(/(\*\*.*?\*\*)/g).map((subPart, subIndex) => {
                        if (subPart.startsWith('**') && subPart.endsWith('**')) {
                            return <strong key={subIndex}>{subPart.slice(2, -2)}</strong>;
                        }
                        return subPart;
                    })}
                </div>
            );
        });
    };

    const handleManualSubmit = () => {
        if (!inputToken.trim()) return;

        // Construct new path by replacing the last segment (token)
        const currentPath = window.location.pathname;
        const parts = currentPath.split('/');
        // Handle potential trailing slash
        if (parts[parts.length - 1] === '') parts.pop();

        // Update the last part with new token
        parts[parts.length - 1] = inputToken.trim();
        const newPath = parts.join('/');

        navigate(newPath);
        // Reset error state to trigger loading state if needed, though navigation usually handles remount/update
        setError(null);
        setLoading(true);
    };

    if (loading) {
        return <SharedChatViewSkeleton />;
    }

    if (error) {
        return (
            <div className="min-h-screen bg-transparent dark:bg-gray-950 flex items-center justify-center p-4 transition-colors duration-300">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border dark:border-gray-700">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaExclamationTriangle className="text-red-500 dark:text-red-400 text-3xl" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Unavailable</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6 font-medium">{error}</p>

                    {/* Manual Token Input */}
                    <div className="mb-6 text-left">
                        <div className="relative">
                            <input
                                type="text"
                                value={inputToken}
                                onChange={(e) => setInputToken(e.target.value)}
                                placeholder="Paste token here..."
                                className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleManualSubmit();
                                    }
                                }}
                            />
                            <button
                                onClick={handleManualSubmit}
                                className="absolute right-2 top-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg transition-colors p-1.5"
                            >
                                <FaArrowRight size={20} />
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">If you have a valid token, paste it above to view.</p>
                    </div>

                    <div className="flex gap-4 justify-center">
                        <a href="/" className="inline-block bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                            Go Home
                        </a>
                        <a href="/ai" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                            Go to SetuAI
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-transparent dark:bg-gray-950 flex flex-col transition-colors duration-300">
            {/* Header */}
            <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                            <FaRobot size={20} />
                        </div>
                        <div>
                            <h1 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">
                                <TypewriterText text={chatData.title || "Shared Chat"} />
                            </h1>
                            <div className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-y-1.5 gap-x-2 mt-1 sm:mt-0">
                                <span className="flex items-center gap-1 shrink-0">Created on <FaCalendar size={10} /> {chatData.date ? new Date(chatData.date).toLocaleDateString() : new Date().toLocaleDateString()}</span>
                                {chatData.expiresAt && (
                                    <>
                                        <span className="hidden sm:block w-1 h-1 bg-gray-300 dark:bg-gray-700 rounded-full"></span>
                                        <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-medium shrink-0">
                                            <FaClock size={10} /> Expires on {new Date(chatData.expiresAt).toLocaleDateString()}
                                        </span>
                                    </>
                                )}
                                <span className="hidden sm:block w-1 h-1 bg-gray-300 dark:bg-gray-700 rounded-full"></span>
                                <span className="text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap shrink-0">Shared via SetuAI</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto justify-start md:justify-end">
                        {importedSessionId ? (
                            <button
                                onClick={() => {
                                    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) {
                                        navigate(`/admin/ai?session=${importedSessionId}`);
                                    } else {
                                        navigate(`/user/ai?session=${importedSessionId}`);
                                    }
                                }}
                                className="flex items-center gap-2 text-xs sm:text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 px-3 sm:px-4 py-2 rounded-lg transition-colors shadow-sm"
                            >
                                <FaArrowRight size={14} />
                                Open Chat
                            </button>
                        ) : (
                            <button
                                onClick={handleImportChat}
                                disabled={importing}
                                className="flex items-center gap-2 text-xs sm:text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 px-3 sm:px-4 py-2 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                            >
                                <FaDownload size={14} />
                                {importing ? "Importing..." : (
                                    <>
                                        <span className="sm:hidden">Import</span>
                                        <span className="hidden sm:inline">Import Chat to SetuAI</span>
                                    </>
                                )}
                            </button>
                        )}
                        <a href="/ai" className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-3 sm:px-4 py-2 rounded-lg transition-colors shadow-sm text-center">
                            Try SetuAI
                        </a>
                    </div>
                </div>
            </header>

            {/* Chat Content */}
            <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
                {chatData.messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                            }`}>
                            {msg.role === 'user' ? <FaUser size={14} /> : <FaRobot size={16} />}
                        </div>

                        <div className={`flex-1 max-w-[85%] rounded-2xl p-4 shadow-sm ${msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-tr-none'
                            : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none'
                            }`}>
                            {/* Check for restricted content */}
                            {msg.isRestricted ? (
                                <div className={`flex items-center gap-2 p-3 rounded-lg border ${msg.role === 'user' ? 'bg-red-900/30 border-red-500/50 text-red-200' : 'bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400'}`}>
                                    <FaExclamationTriangle className="flex-shrink-0" />
                                    <span className="italic text-sm">Content hidden due to safety policy violation.</span>
                                </div>
                            ) : (
                                <div className={`prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed ${msg.role === 'user' ? 'text-white/90' : 'text-gray-800 dark:text-gray-300'}`}>
                                    {formatText(msg.content)}

                                    {/* Recommended Properties Slider */}
                                    {msg.role === 'assistant' && msg.recommendations && msg.recommendations.length > 0 && (
                                        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700/50">
                                            <div className="flex items-center justify-between mb-4 px-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1 px-2 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                        Handpicked for you
                                                    </div>
                                                    <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                        AI Recommendations
                                                    </h4>
                                                </div>
                                                <span className="text-[10px] text-gray-500 font-medium italic">
                                                    {msg.recommendations.length} {msg.recommendations.length === 1 ? 'property' : 'properties'}
                                                </span>
                                            </div>

                                            <div className="flex overflow-x-auto pb-4 gap-4 no-scrollbar scroll-smooth snap-x">
                                                {msg.recommendations.map((property, pIdx) => (
                                                    <div key={property._id || pIdx} className="flex-shrink-0 w-[240px] sm:w-[260px] snap-start transform transition-transform duration-300 hover:scale-[1.02]">
                                                        <ListingItem listing={property} />
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="flex items-center justify-center gap-1.5 mt-2 opacity-30">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                                <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                                                <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className={`mt-2 text-xs flex justify-end items-center ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                                <FaClock className="mr-1" size={10} />
                                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                        </div>
                    </div>
                ))}
            </main>

            {/* Footer CTA */}
            <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-8 mt-8 transition-colors duration-300">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Start your own conversation with SetuAI</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6 font-medium">Get instant answers about real estate, market trends, and more.</p>
                    <a href="/ai" className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all">
                        Launch SetuAI
                    </a>
                </div>
            </footer>

            {/* Authentication Modal */}
            {showAuthModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAuthModal(false)} />
                    <div className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 transform transition-all animate-scaleIn border dark:border-gray-700">
                        <div className="text-center">
                            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FaUser size={24} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                Sign In Required
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                                Please sign in to import this chat to your history.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowAuthModal(false)}
                                    className="flex-1 px-4 py-2 rounded-xl text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        const returnUrl = encodeURIComponent(window.location.pathname);
                                        navigate(`/sign-in?redirect=${returnUrl}`);
                                    }}
                                    className="flex-1 px-4 py-2 rounded-xl text-white bg-blue-600 hover:bg-blue-700 font-medium transition-colors shadow-lg shadow-blue-500/30"
                                >
                                    Sign In
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>
                {`
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes scaleIn {
                        from { opacity: 0; transform: scale(0.95); }
                        to { opacity: 1; transform: scale(1); }
                    }
                    .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
                    .animate-scaleIn { animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
                `}
            </style>

            <GeminiAIWrapper />
            <ContactSupportWrapper />
        </div>
    );
}
