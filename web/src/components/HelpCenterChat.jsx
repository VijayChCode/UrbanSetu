import React, { useState, useRef, useEffect } from 'react';
import { FaPaperPlane, FaRobot, FaUser, FaExclamationTriangle, FaArrowRight, FaInfoCircle } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { authenticatedFetch } from '../utils/auth';

const HelpCenterChat = () => {
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: "Hello! I'm the UrbanSetu AI Assistant. ask me any question about our platform, services, or real estate policies, and I'll do my best to help!",
            id: 'init-1'
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [showEscalation, setShowEscalation] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const { currentUser } = useSelector((state) => state.user);
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

    // Determine AI Link
    const getAiLink = () => {
        if (!currentUser) return '/setuai';
        if (currentUser.role === 'admin' || currentUser.role === 'rootadmin' || currentUser.isDefaultAdmin) {
            return '/admin/setuai';
        }
        return '/user/setuai';
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        // Generate a random session ID for this visitor if not present
        if (!sessionId) {
            setSessionId(`help_guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
        }
    }, [sessionId]);

    const [helpArticles, setHelpArticles] = useState([]);

    useEffect(() => {
        // Fetch help articles for context
        const fetchArticles = async () => {
            try {
                const res = await authenticatedFetch(`${API_BASE_URL}/api/help`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    setHelpArticles(data.map(a => ({ title: a.title, slug: a.slug, description: a.description, category: a.category })));
                }
            } catch (error) {
                console.error("Failed to fetch help context", error);
            }
        };
        fetchArticles();
    }, []);

    // Ctrl + / Shortcut
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.key === '/') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = input.trim();
        setInput('');
        setShowEscalation(false); // Reset escalation on new query

        // Add user message
        const newUserMsg = { role: 'user', content: userMessage, id: Date.now() };
        setMessages(prev => [...prev, newUserMsg]);
        setIsLoading(true);

        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/gemini/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: userMessage,
                    sessionId: sessionId,
                    history: messages.map(m => ({ role: m.role, content: m.content })),
                    tone: 'friendly', // Force friendly tone for help center
                    responseLength: 'medium',
                    enableStreaming: false,
                    helpArticles: helpArticles,
                    clientTime: new Date().toString()
                })
            });

            const data = await res.json();

            if (data.success) {
                const aiMsg = { role: 'assistant', content: data.response, id: Date.now() + 1 };
                setMessages(prev => [...prev, aiMsg]);

                // Simple heuristic for escalation:
                // If response contains uncertainty phrases, show escalation button
                const lowerResponse = data.response.toLowerCase();
                if (
                    lowerResponse.includes("i'm not sure") ||
                    lowerResponse.includes("i don't know") ||
                    lowerResponse.includes("contact support") ||
                    lowerResponse.includes("customer service") ||
                    lowerResponse.includes("cannot answer")
                ) {
                    setShowEscalation(true);
                }
            } else {
                throw new Error(data.message || 'Failed to get response');
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "I'm having trouble connecting right now. Please try again later.",
                isError: true,
                id: Date.now() + 1
            }]);
            setShowEscalation(true);
        } finally {
            setIsLoading(false);
        }
    };

    const [isOpen, setIsOpen] = useState(false);

    const toggleChat = () => setIsOpen(!isOpen);

    return (
        <>
            {/* Floating Chat Button */}
            {!isOpen && (
                <div className="fixed bottom-6 right-6 z-50 animate-bounce-in">
                    <button
                        onClick={toggleChat}
                        className="group w-14 h-14 rounded-full shadow-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 flex items-center justify-center transform transition-all duration-300 hover:scale-110"
                        title="Chat with AI Help"
                    >
                        <FaRobot className="text-white text-2xl drop-shadow-sm group-hover:rotate-12 transition-transform" />

                        {/* Tooltip */}
                        <div className="absolute right-full mr-4 bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-3 py-1.5 rounded-lg shadow-xl text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-gray-100 dark:border-gray-700">
                            Need help? Ask AI
                            <div className="absolute top-1/2 -right-1.5 w-3 h-3 bg-white dark:bg-gray-800 transform -translate-y-1/2 rotate-45 border-r border-t border-gray-100 dark:border-gray-700"></div>
                        </div>
                    </button>
                </div>
            )}

            {/* Floating Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-4 sm:right-6 w-[90vw] sm:w-[400px] h-[600px] max-h-[80vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 flex flex-col overflow-hidden animate-slide-up font-sans">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 flex items-center justify-between shadow-md flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30">
                                <FaRobot className="text-white text-xl" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-base leading-tight">Setu HelpCenter</h3>
                                <p className="text-blue-100 text-xs opacity-90 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                                    Online • AI Assistant Powered by Sentinel v2.0
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={toggleChat}
                            className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900/95 scroll-smooth">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                            >
                                <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-2`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-indigo-500 text-white'
                                        }`}>
                                        {msg.role === 'user' ? <FaUser size={12} /> : <FaRobot size={14} />}
                                    </div>

                                    <div className={`px-4 py-3 rounded-2xl text-sm shadow-sm ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-tr-none'
                                        : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-none'
                                        }`}>
                                        {msg.isError ? (
                                            <div className="flex items-center gap-2 text-red-500">
                                                <FaExclamationTriangle />
                                                <span>{msg.content}</span>
                                            </div>
                                        ) : (
                                            <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed break-words">
                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start animate-pulse">
                                <div className="flex flex-row gap-2">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center flex-shrink-0">
                                        <FaRobot size={14} />
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-tl-none border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <div className="flex space-x-1.5 items-center h-5">
                                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Escalation Prompt */}
                        {showEscalation && (
                            <div className="flex justify-center my-2 animate-fade-in-up">
                                <Link
                                    to="/contact"
                                    className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-xl p-3 flex items-center gap-3 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors group w-full"
                                >
                                    <div className="p-2 bg-orange-100 dark:bg-orange-800 rounded-full text-orange-600 dark:text-orange-200 group-hover:scale-110 transition-transform">
                                        <FaExclamationTriangle size={14} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <h4 className="font-semibold text-gray-900 dark:text-white text-xs uppercase tracking-wide">Still need help?</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-300">Contact Human Support</p>
                                    </div>
                                    <FaArrowRight className="text-gray-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" size={12} />
                                </Link>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
                        <form onSubmit={handleSend} className="relative flex items-center gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask about UrbanSetu... Use Ctrl + / to focus"
                                className="flex-1 pl-4 pr-10 py-3 bg-gray-100 dark:bg-gray-900/50 border-0 rounded-full focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white text-sm"
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className="bg-blue-600 hover:bg-blue-700 text-white w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:scale-100 hover:scale-105 shadow-md flex-shrink-0"
                            >
                                <FaPaperPlane className={`text-xs ml-0.5 ${isLoading ? 'animate-pulse' : ''}`} />
                            </button>
                        </form>
                        <div className="text-center mt-2 relative">
                            <p className="text-[9px] text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1">
                                AI responses may vary.
                                <button
                                    type="button"
                                    onClick={() => setShowInfo(!showInfo)}
                                    className="hover:text-blue-500 transition-colors flex items-center gap-0.5"
                                    title="Click for more info"
                                >
                                    Check important info <FaInfoCircle size={8} />
                                </button>
                            </p>

                            {showInfo && (
                                <div className="absolute bottom-full left-0 right-0 mb-2 p-3 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl shadow-2xl animate-fade-in-up z-[60] mx-2 transition-all">
                                    <p className="text-[10px] text-gray-600 dark:text-gray-300 leading-relaxed">
                                        {currentUser ? (
                                            <>
                                                These chat details are saved in Setu AI for improved assistance.
                                                You can view your full history at {' '}
                                                <Link
                                                    to={getAiLink()}
                                                    className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                                                    onClick={() => setShowInfo(false)}
                                                >
                                                    Setu AI Chatbot
                                                </Link>.
                                            </>
                                        ) : (
                                            <>
                                                These chat details are not saved in Setu AI for guest sessions.
                                                <Link to="/sign-in" className="text-blue-600 dark:text-blue-400 font-bold hover:underline ml-1">Sign in</Link> to keep track of your full history.
                                            </>
                                        )}
                                    </p>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-white dark:bg-gray-700 rotate-45 border-r border-b border-gray-100 dark:border-gray-600 mt-[-4px]"></div>
                                </div>
                            )}
                        </div>
                    </div>

                    <style jsx>{`
                        @keyframes slide-up {
                            from { opacity: 0; transform: translateY(20px) scale(0.95); }
                            to { opacity: 1; transform: translateY(0) scale(1); }
                        }
                        .animate-slide-up {
                            animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                        }
                        @keyframes bounce-in {
                            0% { opacity: 0; transform: scale(0.5); }
                            60% { transform: scale(1.1); }
                            100% { opacity: 1; transform: scale(1); }
                        }
                        .animate-bounce-in {
                            animation: bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55) forwards;
                        }
                    `}</style>
                </div>
            )}
        </>
    );
};

export default HelpCenterChat;
