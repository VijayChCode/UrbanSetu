import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaComments, FaTimes, FaPaperPlane, FaUser, FaCircle, FaCheck, FaTrash, FaEdit, FaCheckSquare, FaSquare, FaInfoCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import { authenticatedFetch } from '../utils/auth';
import { socket } from '../utils/socket';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function PreBookingChatWrapper({ listingId, ownerId, listingTitle, isOpen: externalIsOpen, onClose, showFloatingButton = true, isDeleted = false }) {
    const { currentUser } = useSelector((state) => state.user);
    const isOwner = !!(currentUser && ownerId && currentUser._id === ownerId);
    const navigate = useNavigate();
    const [internalIsOpen, setInternalIsOpen] = useState(false);

    const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

    const setIsOpen = (value) => {
        setInternalIsOpen(value);
        // If closing and controlled, trigger callback
        if (!value && onClose) {
            onClose();
        }
    };

    const location = useLocation();

    // Check query params to auto-open chat
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('openChat') === 'true') {
            if (isDeleted && !isOwner) {
                toast.info('Inquiries are disabled for this deleted property.');
                return;
            }
            setIsOpen(true);
        }
    }, [location.search, isDeleted, isOwner]);

    // State for Owner View
    const [inboxChats, setInboxChats] = useState([]);
    const [hasViewedInquiries, setHasViewedInquiries] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedChatIds, setSelectedChatIds] = useState(new Set());
    const [inboxTab, setInboxTab] = useState('this-listing'); // 'this-listing' or 'all'

    // State for Chat View
    const [activeChat, setActiveChat] = useState(null); // The full chat object
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    // State for animations and UI
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [sendIconAnimating, setSendIconAnimating] = useState(false);
    const [sendIconSent, setSendIconSent] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const longPressTimeoutRef = useRef(null);
    const isLongPressActiveRef = useRef(false);

    const handlePressStart = (chatId) => {
        if (isSelectionMode) return;
        isLongPressActiveRef.current = false;
        longPressTimeoutRef.current = setTimeout(() => {
            isLongPressActiveRef.current = true;
            setIsSelectionMode(true);
            setSelectedChatIds(new Set([chatId]));
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }, 600);
    };

    const handlePressEnd = () => {
        if (longPressTimeoutRef.current) {
            clearTimeout(longPressTimeoutRef.current);
            longPressTimeoutRef.current = null;
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Focus input with Ctrl+/
            if (e.key === '/' && e.ctrlKey && activeChat) {
                e.preventDefault();
                inputRef.current?.focus();
            }
            // Close chat with Esc
            if (e.key === 'Escape' && isOpen) {
                e.preventDefault();
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeChat, isOpen]);

    // Toggle Chat Window
    const toggleChat = () => {
        if (!currentUser) {
            toast.info('Please sign in to chat with the owner.');
            return;
        }
        if (isDeleted && !isOwner) {
            toast.info('Inquiries are disabled for this deleted property.');
            return;
        }
        if (!isOpen && isOwner) {
            setHasViewedInquiries(true);
        }
        setIsOpen(!isOpen);
    };

    // 1. Fetch Data on Open
    useEffect(() => {
        if (isOpen && currentUser) {
            if (isOwner) {
                fetchOwnerChats();
            } else {
                initiateOrGetChat();
            }
        }

        // Prevent background scrolling when chat window is open
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen, currentUser?._id, isOwner, listingId]);

    // 2. Fetch Owner's Inbox (All chats for this user)
    // Note: The controller `getUserChats` returns ALL chats for the user.
    // We might want to filter by listingId if we only want to show inquiries for THIS listing.
    // But usually an Inbox shows all. For this specific wrapper on a Listing page, 
    // maybe we should only show relevant chats? 
    // The user requirement says: "at owner side as single owner it should first show all the messsaged users"
    // So I will show all chats.
    const fetchOwnerChats = async (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        try {
            const data = await (await authenticatedFetch(`${API_BASE_URL}/api/pre-booking-chat/user-chats`)).json();

            if (data.success) {
                setInboxChats(data.chats);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load chats');
        } finally {
            if (showLoading) setIsLoading(false);
        }
    };

    // 3. Initiate/Get Chat for Buyer
    const initiateOrGetChat = async () => {
        setIsLoading(true);
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/pre-booking-chat/initiate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ listingId, ownerId })
            });
            const data = await res.json();
            if (data.success) {
                setActiveChat(data.chat);
                setMessages(data.chat.messages || []);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    // 4. Socket Listener
    useEffect(() => {
        if (!socket) return;

        const handleMessage = (data) => {
            // data = { chatId, message, listingId, senderId }
            if (activeChat && data.chatId === activeChat._id) {
                setMessages((prev) => [...prev, data.message]);
                scrollToBottom();
            } else if (isOwner) {
                // If owner is in inbox view, update the last message preview
                fetchOwnerChats(false); // Simple re-fetch to update order/preview
            }
        };

        socket.on('pre_booking_message', handleMessage);

        // Also listen for clear chat
        socket.on('chat_cleared', ({ chatId }) => {
            if (activeChat && activeChat._id === chatId) {
                setMessages([]);
            }
        });

        return () => {
            socket.off('pre_booking_message', handleMessage);
            socket.off('chat_cleared');
        };
    }, [activeChat, isOwner]);

    // Scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen, activeChat]);

    // Send Message
    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeChat) return;

        setIsSending(true);
        // Start animation
        setSendIconAnimating(true);

        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/pre-booking-chat/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: activeChat._id, content: newMessage })
            });
            const data = await res.json();
            if (data.success) {
                setNewMessage('');
                // Socket will handle the append

                // Animate success
                setSendIconAnimating(false);
                setSendIconSent(true);
                setTimeout(() => setSendIconSent(false), 2000);
            } else {
                toast.error('Failed to send message');
                setSendIconAnimating(false);
            }
        } catch (error) {
            console.error(error);
            setSendIconAnimating(false);
        } finally {
            setIsSending(false);
        }
    };

    // Clear Chat
    const handleClearChat = () => {
        if (!activeChat) return;
        setShowClearConfirm(true);
    }

    const confirmClearChat = async () => {
        setShowClearConfirm(false);
        if (!activeChat) return;

        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/pre-booking-chat/${activeChat._id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
                setMessages([]);
                toast.success("Chat cleared");
            }
        } catch (err) {
            console.error(err);
        }
    }

    // Selection Logic
    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedChatIds(new Set());
    };

    const handleSelectChat = (chatId) => {
        const newSelected = new Set(selectedChatIds);
        if (newSelected.has(chatId)) {
            newSelected.delete(chatId);
        } else {
            newSelected.add(chatId);
        }
        setSelectedChatIds(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedChatIds.size === inboxChats.length) {
            setSelectedChatIds(new Set());
        } else {
            setSelectedChatIds(new Set(inboxChats.map(c => c._id)));
        }
    };

    const handleDeleteSelected = () => {
        if (selectedChatIds.size === 0) return;
        setShowDeleteConfirm(true);
    };

    const confirmBulkDelete = async () => {
        setShowDeleteConfirm(false);
        setIsLoading(true);
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/pre-booking-chat/delete-batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatIds: Array.from(selectedChatIds) })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                setInboxChats(prev => prev.filter(c => !selectedChatIds.has(c._id)));
                setIsSelectionMode(false);
                setSelectedChatIds(new Set());
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete inquiries');
        } finally {
            setIsLoading(false);
        }
    };

    // Helper for Anonymized Names
    const getAnonymizedName = (userId) => {
        if (!userId) return "Anonymous User";
        const FANTASY_NAMES = [
            "Urban Explorer", "Dream Home Seeker", "City Dweller", "Property Enthusiast",
            "Skyline Admirer", "Metro Nomad", "Estate Visionary", "Loft Lover",
            "Home Hunter", "Space Scout", "Modern Resident", "Vibrant Villager",
            "Cosmo Dweller", "Suburban Soul", "Downtown Dreamer", "Penthouse Pro",
            "Cottage Core", "Villa Visionary", "Duplex Diver", "Studio Star",
            "Bungalow Buff", "Mansion Master", "Terrace Traveler", "Garden Guru",
            "Balcony Boss", "High-Rise Hero", "Community Connector", "Neighborhood Nomad",
            "Street Smart", "Avenue Ace", "Lane Leader", "Boulevard Baron",
            "Plaza Pioneer", "Square Scout", "District Diver", "Zone Zealot",
            "Quarter Quest", "Sector Seeker", "Block Buster", "Estate Expert",
            "Harbor Hero", "River Resident", "Lake Lover", "Mountain Mover",
            "Valley Voyager", "Cloud Chaser", "Star Gazer", "Horizon Hunter",
            "Dawn Dreamer", "Dusk Dweller"
        ];
        // Use the last 8 characters of the userId (hex) to determine the index.
        // MongoDB ObjectIDs end with a counter which is most likely to be distinct.
        const hexSuffix = userId.substring(userId.length - 8);
        const index = parseInt(hexSuffix, 16) % FANTASY_NAMES.length;

        // Append last 4 chars of userId to ensure uniqueness even if names collide
        const suffix = userId.substring(userId.length - 4);
        return `${FANTASY_NAMES[index]} (${suffix})`;
    };

    // Render Functions
    const renderInbox = () => (
        <div className="flex flex-col h-full relative">
            {/* Delete Confirmation Overlay */}
            {showDeleteConfirm && (
                <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4 rounded-lg">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl max-w-sm w-full animate-slideUp">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Inquiries?</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">
                            Are you sure you want to delete {selectedChatIds.size} selected inquir{selectedChatIds.size > 1 ? 'ies' : 'y'}? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmBulkDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium shadow-md transition-colors"
                            >
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-t-lg flex justify-between items-center h-16">
                {isSelectionMode ? (
                    <>
                        <div className="flex items-center gap-2">
                            <button onClick={toggleSelectionMode} className="text-gray-600 hover:text-gray-800 dark:text-gray-300">Cancel</button>
                            <span className="font-semibold text-gray-800 dark:text-white px-2">
                                {selectedChatIds.size} Selected
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={handleSelectAll} className="text-sm text-blue-600 font-medium hover:underline">
                                {selectedChatIds.size === inboxChats.length ? 'Deselect All' : 'Select All'}
                            </button>
                            {selectedChatIds.size > 0 && (
                                <button onClick={handleDeleteSelected} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition" title="Delete Selected">
                                    <FaTrash />
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <h3 className="font-semibold text-gray-800 dark:text-white">Inquiries</h3>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowInfoModal(true)}
                                className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 p-2 rounded-full hover:bg-blue-50 dark:hover:bg-gray-700 transition"
                                title="Pre-Booking Chat Information"
                            >
                                <FaInfoCircle />
                            </button>
                            {inboxChats.length > 0 && (
                                <button onClick={toggleSelectionMode} className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 p-2 rounded-full hover:bg-blue-50 dark:hover:bg-gray-700 transition" title="Select / Delete">
                                    <FaEdit />
                                </button>
                            )}
                            <button onClick={toggleChat} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition" title="Close">
                                <FaTimes />
                            </button>
                        </div>
                    </>
                )}
            </div>
            {!isSelectionMode && inboxChats.length > 0 && (
                <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                    <button
                        type="button"
                        onClick={() => setInboxTab('this-listing')}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                            inboxTab === 'this-listing'
                                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-white dark:bg-gray-850'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-700/50'
                        }`}
                    >
                        This Listing
                    </button>
                    <button
                        type="button"
                        onClick={() => setInboxTab('all')}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                            inboxTab === 'all'
                                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-white dark:bg-gray-850'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-700/50'
                        }`}
                    >
                        All Listings ({inboxChats.length})
                    </button>
                </div>
            )}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {isLoading ? (
                    <div className="flex flex-col justify-center items-center h-full gap-2">
                        <UrbanSetuSpinner size="lg" />
                        <p className="text-gray-500 dark:text-gray-400 text-sm animate-pulse">Loading inquiries...</p>
                    </div>
                ) : inboxChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-60">
                        <FaComments className="text-4xl mb-2" />
                        <p>No inquiries yet.</p>
                    </div>
                ) : (() => {
                    const filteredChats = inboxChats.filter(chat => {
                        if (inboxTab === 'this-listing') {
                            return chat.listingId?._id === listingId;
                        }
                        return true;
                    });

                    if (filteredChats.length === 0) {
                        return (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500 py-10 px-4 text-center">
                                <FaComments className="text-4xl mb-3 opacity-40 text-blue-500 animate-bounce" />
                                <h4 className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-1">No inquiries for this specific listing yet</h4>
                                <p className="text-xs text-gray-500 max-w-[240px]">
                                    Click the <strong className="text-blue-600 dark:text-blue-400 font-bold">"All Listings"</strong> tab above to view inquiries for your other properties!
                                </p>
                            </div>
                        );
                    }

                    return filteredChats.map(chat => {
                        const otherParticipant = chat.participants.find(p => p._id !== currentUser._id);
                        const isSelected = selectedChatIds.has(chat._id);
                        const displayName = getAnonymizedName(otherParticipant?._id);

                        return (
                            <div
                                key={chat._id}
                                onMouseDown={() => handlePressStart(chat._id)}
                                onMouseUp={handlePressEnd}
                                onMouseLeave={handlePressEnd}
                                onTouchStart={() => handlePressStart(chat._id)}
                                onTouchEnd={handlePressEnd}
                                onTouchMove={handlePressEnd}
                                onClick={() => {
                                    if (isLongPressActiveRef.current) {
                                        isLongPressActiveRef.current = false;
                                        return;
                                    }
                                    if (isSelectionMode) {
                                        handleSelectChat(chat._id);
                                    } else {
                                        setActiveChat(chat);
                                        setMessages(chat.messages);
                                    }
                                }}
                                className={`p-3 rounded-lg shadow-sm cursor-pointer transition flex items-center gap-3 select-none ${isSelected
                                    ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                                    : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                                    }`}
                            >
                                {isSelectionMode && (
                                    <div className="text-blue-600 dark:text-blue-400">
                                        {isSelected ? <FaCheckSquare className="text-xl" /> : <FaSquare className="text-xl text-gray-300 dark:text-gray-500" />}
                                    </div>
                                )}

                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold flex-shrink-0">
                                        {displayName[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline">
                                            <h4 className="font-medium text-gray-900 dark:text-white truncate">{displayName}</h4>
                                            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                                                {chat.lastMessage?.timestamp && new Date(chat.lastMessage.timestamp).toLocaleDateString('en-GB')}
                                            </span>
                                        </div>
                                        <div className="mt-1 mb-1">
                                            {chat.listingId?._id ? (
                                                <span
                                                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded inline-flex items-center gap-1 max-w-full truncate border border-blue-100 dark:border-blue-800/40"
                                                    title={chat.listingId.name}
                                                >
                                                    <span>🏡</span> {chat.listingId.name}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded inline-flex items-center gap-1 max-w-full truncate border border-gray-100 dark:border-gray-700">
                                                    🏡 General Inquiry
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                                            {chat.lastMessage?.content || 'No messages'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    });
                })()}
            </div>
        </div>
    );

    const renderChat = () => {
        const otherParticipant = activeChat?.participants?.find(p => p._id !== currentUser._id);

        const formatDateDivider = (dateString) => {
            const date = new Date(dateString);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            if (date.toDateString() === today.toDateString()) return 'Today';
            if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
            return date.toLocaleDateString('en-GB');
        };

        return (
            <div className="flex flex-col h-full relative">
                {/* Clear Chat Confirmation Overlay */}
                {showClearConfirm && (
                    <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4 rounded-lg">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl max-w-sm w-full animate-slideUp">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Clear Chat History?</h3>
                            <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">
                                This will permanently delete all messages in this chat. This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowClearConfirm(false)}
                                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmClearChat}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium shadow-md transition-colors"
                                >
                                    Yes, Clear it
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-700 to-purple-700 text-white rounded-t-lg flex justify-between items-center shadow-md">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        {isOwner && (
                            <button onClick={() => setActiveChat(null)} className="mr-1 hover:bg-blue-800 p-1.5 rounded text-white transition-colors flex-shrink-0" title="Back to Inquiries">
                                &larr;
                            </button>
                        )}

                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {/* Generic Avatar */}
                            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white overflow-hidden border border-white/30 flex-shrink-0">
                                <FaUser className="text-sm" />
                            </div>

                            <div className="leading-tight min-w-0 flex-1">
                                <div className="font-semibold text-sm truncate" title={isOwner ? getAnonymizedName(otherParticipant?._id) : (listingId ? 'Property Owner' : 'Agent')}>
                                    {isOwner ? getAnonymizedName(otherParticipant?._id) : (listingId ? 'Property Owner' : 'Agent')}
                                </div>
                                {activeChat?.listingId?._id ? (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/user/listing/${activeChat.listingId._id}`);
                                        }}
                                        className="text-[10px] opacity-90 mt-0.5 flex items-center gap-1 truncate font-medium hover:text-blue-200 transition-colors cursor-pointer text-left w-full"
                                        title={`Go to ${activeChat.listingId.name}`}
                                    >
                                        <span className="flex-shrink-0">🏡</span>
                                        <span className="truncate">{activeChat.listingId.name}</span>
                                    </button>
                                ) : (
                                    <div className="text-[10px] opacity-90 mt-0.5 flex items-center gap-1 truncate font-medium" title={listingTitle || "Property Inquiry"}>
                                        <span className="flex-shrink-0">🏡</span>
                                        <span className="truncate">{listingTitle || "Property Inquiry"}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <button
                            type="button"
                            onClick={() => setShowInfoModal(true)}
                            className="hover:bg-blue-800 p-1.5 rounded-full transition-colors text-white/90 hover:text-white"
                            title="Pre-Booking Chat Information"
                        >
                            <FaInfoCircle />
                        </button>
                        {messages.length > 0 && (
                            <button onClick={handleClearChat} className="text-xs bg-red-500/20 hover:bg-red-500/40 px-2 py-1.5 rounded text-white transition-colors font-medium border border-red-500/30" title="Clear Chat">
                                Clear
                            </button>
                        )}
                        <button onClick={toggleChat} className="hover:bg-blue-800 p-1.5 rounded-full transition-colors text-white/90 hover:text-white" title="Close"><FaTimes /></button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-100 dark:bg-gray-900">
                    {isLoading ? (
                        <div className="flex flex-col justify-center items-center h-full gap-2">
                            <UrbanSetuSpinner size="lg" />
                            <p className="text-gray-500 dark:text-gray-400 text-sm animate-pulse">Loading conversation...</p>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <div className="bg-gray-200 dark:bg-gray-800 p-4 rounded-full mb-3">
                                <FaComments className="text-3xl" />
                            </div>
                            <p className="text-sm font-medium">No messages yet</p>
                            <p className="text-xs">Start the conversation!</p>
                        </div>
                    ) : (
                        messages.map((msg, idx) => {
                            const isMe = msg.sender === currentUser._id;
                            const msgDate = new Date(msg.timestamp);
                            const prevMsgDate = idx > 0 ? new Date(messages[idx - 1].timestamp) : null;
                            const showDateDivider = !prevMsgDate || msgDate.toDateString() !== prevMsgDate.toDateString();

                            return (
                                <React.Fragment key={idx}>
                                    {showDateDivider && (
                                        <div className="flex justify-center my-4 sticky top-0 z-10">
                                            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-full shadow-sm uppercase tracking-wide opacity-90 backdrop-blur-sm">
                                                {formatDateDivider(msg.timestamp)}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div
                                            className={`max-w-[75%] p-3 rounded-2xl shadow-sm text-sm ${isMe
                                                ? 'bg-blue-600 text-white rounded-tr-none'
                                                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none'
                                                }`}
                                        >
                                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                            <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                {isDeleted && !isOwner ? (
                    <div className="p-4 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-center text-red-500 dark:text-red-400 text-sm font-semibold select-none">
                        Inquiries are closed for this deleted listing.
                    </div>
                ) : (
                    <form onSubmit={handleSend} className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex gap-2 items-center">
                        <input
                            ref={inputRef}
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 px-4 py-3 border rounded-full dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                        <button
                            type="submit"
                            disabled={isSending || !newMessage.trim()}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white w-12 h-12 rounded-full shadow-lg hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:transform-none flex items-center justify-center active:scale-95 group"
                        >
                            <div className="relative flex items-center justify-center">
                                {sendIconSent ? (
                                    <FaCheck className="text-lg text-white animate-bounce" />
                                ) : (
                                    <FaPaperPlane className={`text-lg text-white ml-0.5 ${sendIconAnimating ? 'animate-ping' : 'group-hover:scale-110 transition-transform'}`} />
                                )}
                            </div>
                        </button>
                    </form>
                )}
            </div>
        );
    };

    return (
        <>
            {/* Floating Entry Button */}
            {showFloatingButton && !isOpen && (!isDeleted || isOwner) && (
                <div className="fixed bottom-24 right-6 z-40">
                    <button
                        onClick={toggleChat}
                        className="relative group w-12 h-12 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 hover:rotate-12 flex items-center justify-center"
                        style={{
                            background: `linear-gradient(135deg, #3b82f6, #6366f1)`, // Blue to Indigo gradient
                            boxShadow: `0 10px 25px rgba(59, 130, 246, 0.4)`
                        }}
                    >
                        {/* Animated background ring */}
                        <div
                            className="absolute inset-0 rounded-full animate-ping"
                            style={{
                                border: `3px solid rgba(59, 130, 246, 0.3)`,
                            }}
                        ></div>

                        <FaComments className="w-5 h-5 text-white drop-shadow-lg" />

                        {/* Badge for Owner */}
                        {isOwner && inboxChats.length > 0 && !hasViewedInquiries && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 flex items-center justify-center rounded-full animate-pulse font-bold">
                                {inboxChats.length > 99 ? '99+' : inboxChats.length}
                            </span>
                        )}

                        {/* Enhanced Hover Tooltip */}
                        <div className="absolute bottom-full right-0 mb-3 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm px-4 py-2 rounded-xl shadow-2xl hidden group-hover:block z-10 whitespace-nowrap border border-gray-100 dark:border-gray-700 transform -translate-y-1 transition-all duration-200">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">💬</span>
                                <span className="font-medium">
                                    {isOwner
                                        ? (inboxChats.length > 0 ? `${inboxChats.length} Inquir${inboxChats.length !== 1 ? 'ies' : 'y'}` : 'View Inquiries')
                                        : 'Chat with Owner'}
                                </span>
                            </div>
                            {/* Tooltip arrow */}
                            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white dark:border-t-gray-800"></div>
                        </div>
                    </button>
                </div>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:right-6 sm:w-96 z-40 h-[500px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slideUp border border-gray-200 dark:border-gray-700">
                    {(isOwner && !activeChat) ? renderInbox() : renderChat()}

                    {/* Information Modal Overlay */}
                    {showInfoModal && (
                        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 animate-fadeIn">
                            <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-2xl max-w-sm w-full border border-gray-100 dark:border-gray-700 flex flex-col h-[420px] animate-scaleUp text-gray-900 dark:text-white">
                                {/* Header */}
                                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2 mb-3">
                                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                        <FaInfoCircle className="text-lg animate-pulse" />
                                        <h3 className="text-sm font-bold">Pre-Booking Inquiries</h3>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 text-xs text-gray-600 dark:text-gray-300 leading-relaxed scrollbar-thin">
                                    <div>
                                        <h4 className="font-bold text-gray-800 dark:text-white mb-0.5">What is this chat used for?</h4>
                                        <p>
                                            This is a secure pre-booking inquiry channel. Prospective buyers/tenants can chat directly with the owner to clarify features, pricing, or locations before scheduling visits or signing rent-locks.
                                        </p>
                                    </div>
                                    
                                    <div>
                                        <h4 className="font-bold text-gray-800 dark:text-white mb-0.5">🔒 Absolute Confidentiality</h4>
                                        <p>
                                            To guarantee full privacy and avoid spam, your actual usernames and contact details are kept strictly hidden. Users are assigned fancy pseudonyms (e.g. <em>Estate Visionary</em>) and generic counter IDs.
                                        </p>
                                    </div>

                                    <div>
                                        <h4 className="font-bold text-gray-800 dark:text-white mb-0.5">📋 Security Guidelines</h4>
                                        <ul className="list-disc list-inside space-y-1 mt-1 text-[11px]">
                                            <li>Never share personal logins or credit card pins.</li>
                                            <li>Keep chats focused on property clarifications.</li>
                                            <li>Pre-booking chat does not bind deposits or agreements.</li>
                                        </ul>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setShowInfoModal(false)}
                                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition transform hover:-translate-y-0.5 active:translate-y-0"
                                    >
                                        Got it, thanks!
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-scaleUp {
          animation: scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
        </>
    );
}

