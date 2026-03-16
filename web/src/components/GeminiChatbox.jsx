import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { FaComments, FaTimes, FaPaperPlane, FaRobot, FaCopy, FaSync, FaUser, FaCheck, FaDownload, FaUpload, FaPaperclip, FaCog, FaLightbulb, FaHistory, FaBookmark, FaShare, FaThumbsUp, FaThumbsDown, FaRegBookmark, FaBookmark as FaBookmarkSolid, FaMicrophone, FaStop, FaImage, FaFileAlt, FaMagic, FaStar, FaMoon, FaSun, FaPalette, FaVolumeUp, FaVolumeMute, FaExpand, FaCompress, FaSearch, FaFilter, FaSort, FaEye, FaEyeSlash, FaEdit, FaCheck as FaCheckCircle, FaTimes as FaTimesCircle, FaFlag, FaClipboardList, FaCommentAlt, FaArrowDown, FaTrash, FaEllipsisH, FaEllipsisV, FaShareAlt, FaBan } from 'react-icons/fa';
import EqualizerButton from './EqualizerButton';
import ShareChatModal from './ShareChatModal';
import SocialSharePanel from './SocialSharePanel';
import VideoPreview from './VideoPreview';
import { FaPlay } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { authenticatedFetch } from "../utils/auth";
import { API_BASE_URL } from '../config/api';
// import { FormattedTextWithLinks } from '../utils/linkFormatter.jsx';
import ListingItem from './ListingItem';
import { isMobileDevice } from '../utils/mobileUtils';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markdown';

const THINKING_TAGS = [
    "Thinking...",
    "Analyzing query...",
    "Processing context...",
    "Retrieving information...",
    "Synthesizing response...",
    "Finalizing answer..."
];

const ScrollingThinkingTags = ({ isHeader = false, isDarkMode = false }) => {
    const [index, setIndex] = useState(0);
    
    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % THINKING_TAGS.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className={`overflow-hidden h-[1.2em] relative inline-block ${isHeader ? 'min-w-[120px]' : 'min-w-[150px]'}`}>
            <div 
                className="transition-transform duration-500 ease-in-out absolute w-full"
                style={{ transform: `translateY(-${index * 1.2}em)` }}
            >
                {THINKING_TAGS.map((tag, i) => (
                    <div key={i} className={`h-[1.2em] flex items-center ${isHeader ? 'text-white/80' : isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        {tag}
                    </div>
                ))}
            </div>
        </div>
    );
};

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

const GeminiChatbox = ({ forceModalOpen = false, onModalClose = null }) => {
    const { currentUser } = useSelector((state) => state.user);

    // Helper functions for user-specific localStorage
    const getUserKey = (key) => {
        if (!currentUser) return key; // For public users, use global keys
        return `user_${currentUser._id}_${key}`;
    };

    const getUserSetting = (key, defaultValue) => {
        const userKey = getUserKey(key);
        return localStorage.getItem(userKey) || defaultValue;
    };

    const setUserSetting = (key, value) => {
        const userKey = getUserKey(key);
        localStorage.setItem(userKey, value);
    };

    // Helper function to get theme color as hex value for the ring
    const getThemeRingColor = () => {
        const theme = getThemeColors();
        const accentClass = theme.accent;

        // Map Tailwind color classes to hex values
        const colorMap = {
            'text-blue-400': '#60a5fa',
            'text-blue-500': '#3b82f6',
            'text-blue-600': '#2563eb',
            'text-green-400': '#4ade80',
            'text-green-500': '#22c55e',
            'text-green-600': '#16a34a',
            'text-purple-400': '#a78bfa',
            'text-purple-500': '#8b5cf6',
            'text-purple-600': '#7c3aed',
            'text-pink-400': '#f472b6',
            'text-pink-500': '#ec4899',
            'text-pink-600': '#db2777',
            'text-red-400': '#f87171',
            'text-red-500': '#ef4444',
            'text-red-600': '#dc2626',
            'text-orange-400': '#fb923c',
            'text-orange-500': '#f97316',
            'text-orange-600': '#ea580c',
            'text-yellow-400': '#facc15',
            'text-yellow-500': '#eab308',
            'text-yellow-600': '#ca8a04',
            'text-indigo-400': '#818cf8',
            'text-indigo-500': '#6366f1',
            'text-indigo-600': '#4f46e5',
            'text-cyan-400': '#22d3ee',
            'text-cyan-500': '#06b6d4',
            'text-cyan-600': '#0891b2',
            'text-teal-400': '#2dd4bf',
            'text-teal-500': '#14b8a6',
            'text-teal-600': '#0d9488',
        };

        return colorMap[accentClass] || '#60a5fa'; // Default to blue if not found
    };
    const navigate = useNavigate();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(forceModalOpen);
    const [previewVideo, setPreviewVideo] = useState(null);
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: 'Hello! I\'m SetuAI your AI assistant powered by Groq and co-powered by Sentinel v2.0 Neural Engine (TensorFlow). How can I help you with your real estate needs today?',
            timestamp: new Date().toISOString()
        }
    ]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [currentChatName, setCurrentChatName] = useState('');
    const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
    const [displayedTitle, setDisplayedTitle] = useState('SetuAI');
    const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const [authModal, setAuthModal] = useState({ isOpen: false, type: 'save' });
    const [sendIconAnimating, setSendIconAnimating] = useState(false);
    const [sendIconSent, setSendIconSent] = useState(false);
    const messagesContainerRef = useRef(null);
    const [isScrolledUp, setIsScrolledUp] = useState(false);
    const [showConfirmClear, setShowConfirmClear] = useState(false);
    const abortControllerRef = useRef(null);
    const audioUploadAbortControllerRef = useRef(null);
    const rateLimitBroadcastRef = useRef(null); // For cross-tab rate limit sync
    const [hasChatError, setHasChatError] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);
    const lastUserMessageRef = useRef('');
    const [tone, setTone] = useState(() => localStorage.getItem('gemini_tone') || 'neutral'); // modes dropdown (tone)
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
    const headerMenuButtonRef = useRef(null);
    const suggestionsRef = useRef(null);
    const headerMenuRef = useRef(null);
    const [showFeatures, setShowFeatures] = useState(false);

    // Typewriter effect for header title
    useEffect(() => {
        if (!currentChatName) {
            setDisplayedTitle('SetuAI');
            return;
        }

        // If it's a new title and we want animation
        let timer;
        let i = 0;
        const fullText = currentChatName;

        // Reset displayed title before starting animation
        setDisplayedTitle('');

        const typeWriter = () => {
            if (i < fullText.length) {
                setDisplayedTitle(fullText.substring(0, i + 1));
                i++;
                timer = setTimeout(typeWriter, 30);
            }
        };

        typeWriter();
        return () => clearTimeout(timer);
    }, [currentChatName]);

    // Dynamic browser tab title handling based on chat title
    useEffect(() => {
        if (currentChatName && currentChatName !== 'New Chat' && !/^Chat \d/i.test(currentChatName)) {
            document.title = `${currentChatName} - SetuAI`;
        } else {
            document.title = "AI Assistant - Smart Property Search";
        }
    }, [currentChatName]);

    // Property suggestion states
    const [showPropertySuggestions, setShowPropertySuggestions] = useState(false);
    const [propertySuggestions, setPropertySuggestions] = useState([]);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
    const [suggestionQuery, setSuggestionQuery] = useState('');
    const [suggestionStartPos, setSuggestionStartPos] = useState(-1);
    const [selectedProperties, setSelectedProperties] = useState([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [bookmarkedMessages, setBookmarkedMessages] = useState([]);
    const [messageRatings, setMessageRatings] = useState(() => JSON.parse(localStorage.getItem('gemini_ratings') || '{}'));
    const [showDislikeModal, setShowDislikeModal] = useState(false);
    const [dislikeFeedbackOption, setDislikeFeedbackOption] = useState('');
    const [dislikeFeedbackText, setDislikeFeedbackText] = useState('');
    const [dislikeMessageIndex, setDislikeMessageIndex] = useState(null);
    const [dislikeSubmitting, setDislikeSubmitting] = useState(false);
    const [showRatingsModal, setShowRatingsModal] = useState(false);
    const [ratingMeta, setRatingMeta] = useState({}); // { ratingKey: { feedback, user, time } }
    const [allRatings, setAllRatings] = useState([]);
    const [allRatingsLoading, setAllRatingsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showBookmarks, setShowBookmarks] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [chatSessions, setChatSessions] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [typingText, setTypingText] = useState('');
    const [showQuickActions, setShowQuickActions] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [showMessageMenu, setShowMessageMenu] = useState(false);
    const [highlightedMessage, setHighlightedMessage] = useState(null);
    const [selectedHistoryIds, setSelectedHistoryIds] = useState([]);
    const [openHistoryMenuSessionId, setOpenHistoryMenuSessionId] = useState(null);

    // Contact Support Visibility Listener
    const [isContactSupportOpen, setIsContactSupportOpen] = useState(false);
    useEffect(() => {
        const handleContactSupportToggle = (event) => {
            setIsContactSupportOpen(event.detail.isOpen);
        };
        window.addEventListener('contactSupportToggle', handleContactSupportToggle);
        return () => window.removeEventListener('contactSupportToggle', handleContactSupportToggle);
    }, []);

    // Keyboard shortcut to focus input
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === '/' && e.ctrlKey && isOpen && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Auto-resize textarea
    useLayoutEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            const newHeight = Math.min(inputRef.current.scrollHeight, 250);
            inputRef.current.style.height = `${newHeight}px`;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputMessage]);

    // Rate limiting state
    const [rateLimitInfo, setRateLimitInfo] = useState({
        role: currentUser ? (currentUser.role || 'user') : 'public',
        limit: currentUser ? (currentUser.role === 'admin' ? 500 : currentUser.role === 'rootadmin' ? Infinity : 50) : 5,
        remaining: currentUser ? (currentUser.role === 'admin' ? 500 : currentUser.role === 'rootadmin' ? Infinity : 50) : 5,
        resetTime: null,
        windowMs: currentUser ? (currentUser.role === 'admin' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000) : 15 * 60 * 1000
    });
    const [showSignInModal, setShowSignInModal] = useState(false);
    const [ratingsFilter, setRatingsFilter] = useState('all'); // all, up, down
    const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
    const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState(false);
    const [deleteTargetSessionId, setDeleteTargetSessionId] = useState(null);
    const [showDeleteSingleModal, setShowDeleteSingleModal] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [showRatingDetailModal, setShowRatingDetailModal] = useState(false);
    const [selectedRating, setSelectedRating] = useState(null);
    const [showReportDeleteModal, setShowReportDeleteModal] = useState(false);
    const [selectedReportToDelete, setSelectedReportToDelete] = useState(null);
    const [showReportDetailModal, setShowReportDetailModal] = useState(false);
    const [selectedReportDetail, setSelectedReportDetail] = useState(null);
    const [showRatingDeleteModal, setShowRatingDeleteModal] = useState(false);
    const [selectedRatingToDelete, setSelectedRatingToDelete] = useState(null);
    const [renameTargetSessionId, setRenameTargetSessionId] = useState(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isChatShared, setIsChatShared] = useState(false);
    const [shareTargetSessionId, setShareTargetSessionId] = useState(null);
    const [showSocialShare, setShowSocialShare] = useState(false);
    const [socialShareConfig, setSocialShareConfig] = useState({ url: '', title: '', description: '' });
    const [renameInput, setRenameInput] = useState('');
    const [refreshingBookmarks, setRefreshingBookmarks] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [showConsentModal, setShowConsentModal] = useState(false);
    // Floating date label like WhatsApp
    const [floatingDateLabel, setFloatingDateLabel] = useState('');
    const [isScrolling, setIsScrolling] = useState(false);
    const scrollTimeoutRef = useRef(null);

    // Enhanced UI and Feature States
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [audioChunks, setAudioChunks] = useState([]);
    const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));

    // Sync isDarkMode with global theme
    useEffect(() => {
        const updateTheme = () => {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        };

        // Listen for custom theme-change event and storage events
        window.addEventListener('theme-change', updateTheme);
        window.addEventListener('storage', updateTheme); // In case changed in another tab

        // Also observe 'class' attribute changes on html element for direct DOM updates
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    updateTheme();
                }
            });
        });

        observer.observe(document.documentElement, { attributes: true });

        // Initial check
        updateTheme();

        return () => {
            window.removeEventListener('theme-change', updateTheme);
            window.removeEventListener('storage', updateTheme);
            observer.disconnect();
        };
    }, []);

    // Check if current chat is shared
    useEffect(() => {
        const checkShareStatus = async () => {
            const currentSessionId = sessionId || localStorage.getItem('gemini_session_id');
            if (!currentSessionId || !currentUser) {
                setIsChatShared(false);
                return;
            }

            try {
                const res = await authenticatedFetch(`${API_BASE_URL}/api/shared-chat/manage/${currentSessionId}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (res.ok) {
                    const data = await res.json();
                    setIsChatShared(data.success && !!data.sharedChat);
                } else {
                    setIsChatShared(false);
                }
            } catch (error) {
                console.error('Error checking share status:', error);
                setIsChatShared(false);
            }
        };

        if (isOpen) {
            checkShareStatus();
        }
    }, [sessionId, isOpen, currentUser]);

    // Mobile Menu Detection
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    useEffect(() => {
        const checkMobileMenu = () => {
            setIsMobileMenuOpen(document.body.classList.contains('mobile-menu-open'));
        };

        // Check initially
        checkMobileMenu();

        // Observe body for class changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    checkMobileMenu();
                }
            });
        });

        observer.observe(document.body, { attributes: true });

        return () => observer.disconnect();
    }, []);

    const [showVoiceInput, setShowVoiceInput] = useState(false);
    const [showFileUpload, setShowFileUpload] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [showSmartSuggestions, setShowSmartSuggestions] = useState(false); // Default to false, handled conditionally
    const [smartSuggestions, setSmartSuggestions] = useState([
        "Find properties under ₹50L in Bangalore",
        "What are the best areas for investment?",
        "Help me understand home loan process",
        "Compare 2BHK vs 3BHK apartments"
    ]);
    const [isMinimized, setIsMinimized] = useState(false);
    const [showSearchInChat, setShowSearchInChat] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredMessages, setFilteredMessages] = useState([]);
    const [showMessageFilters, setShowMessageFilters] = useState(false);
    const [messageFilter, setMessageFilter] = useState('all'); // all, user, assistant, bookmarked
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showWelcomeScreen, setShowWelcomeScreen] = useState(true);
    const [selectedTheme, setSelectedTheme] = useState(() => getUserSetting('gemini_theme', 'blue'));
    const [customTheme, setCustomTheme] = useState(() => {
        const saved = getUserSetting('gemini_custom_theme', null);
        return saved ? JSON.parse(saved) : null;
    });
    const [fontSize, setFontSize] = useState(() => getUserSetting('gemini_font_size', 'medium'));
    const [messageDensity, setMessageDensity] = useState(() => getUserSetting('gemini_message_density', 'comfortable'));
    const [autoScroll, setAutoScroll] = useState(() => getUserSetting('gemini_auto_scroll', 'true') !== 'false');
    const [showTimestamps, setShowTimestamps] = useState(() => getUserSetting('gemini_show_timestamps', 'true') !== 'false');
    const [aiResponseLength, setAiResponseLength] = useState(() => {
        // For public users, default to 'small', for logged-in users use saved setting or 'medium'
        if (!currentUser) return 'small';
        return getUserSetting('gemini_response_length', 'medium');
    });
    const [aiCreativity, setAiCreativity] = useState(() => {
        // For public users, default to 'conservative', for logged-in users use saved setting or 'balanced'
        if (!currentUser) return 'conservative';
        return getUserSetting('gemini_creativity', 'balanced');
    });
    const [soundEnabled, setSoundEnabled] = useState(() => getUserSetting('gemini_sound_enabled', 'true') !== 'false');
    const [typingSounds, setTypingSounds] = useState(() => getUserSetting('gemini_typing_sounds', 'true') !== 'false');
    const [dataRetention, setDataRetention] = useState(() => getUserSetting('gemini_data_retention', '30'));
    const [showCustomThemePicker, setShowCustomThemePicker] = useState(false);

    // Advanced Settings
    const [autoSave, setAutoSave] = useState(() => getUserSetting('gemini_auto_save', 'true') !== 'false');
    const [messageLimit, setMessageLimit] = useState(() => getUserSetting('gemini_message_limit', '100'));
    const [sessionTimeout, setSessionTimeout] = useState(() => getUserSetting('gemini_session_timeout', '30'));
    const [enableMarkdown, setEnableMarkdown] = useState(() => getUserSetting('gemini_enable_markdown', 'true') !== 'false');
    const [enableCodeHighlighting, setEnableCodeHighlighting] = useState(() => getUserSetting('gemini_code_highlighting', 'true') !== 'false');
    const [enableEmojiReactions, setEnableEmojiReactions] = useState(() => getUserSetting('gemini_emoji_reactions', 'true') !== 'false');
    const [enableMessageSearch, setEnableMessageSearch] = useState(() => getUserSetting('gemini_message_search', 'true') !== 'false');
    const [enableQuickActions, setEnableQuickActions] = useState(() => getUserSetting('gemini_quick_actions', 'true') !== 'false');
    const [enableSmartSuggestions, setEnableSmartSuggestions] = useState(() => getUserSetting('gemini_smart_suggestions', 'true') !== 'false');
    const [enableTypingIndicator, setEnableTypingIndicator] = useState(() => getUserSetting('gemini_typing_indicator', 'true') !== 'false');

    // Accessibility Settings
    const [highContrast, setHighContrast] = useState(() => {
        // For public users (no currentUser), default to false
        if (!currentUser) return false;
        return getUserSetting('gemini_high_contrast', 'false') === 'true';
    });
    const [reducedMotion, setReducedMotion] = useState(() => getUserSetting('gemini_reduced_motion', 'false') === 'true');
    const [screenReaderSupport, setScreenReaderSupport] = useState(() => getUserSetting('gemini_screen_reader', 'false') === 'true');
    const [largeText, setLargeText] = useState(() => getUserSetting('gemini_large_text', 'false') === 'true');
    const [keyboardNavigation, setKeyboardNavigation] = useState(() => getUserSetting('gemini_keyboard_nav', 'true') !== 'false');

    // Performance Settings
    const [messageCaching, setMessageCaching] = useState(() => getUserSetting('gemini_message_caching', 'true') !== 'false');
    const [lazyLoading, setLazyLoading] = useState(() => getUserSetting('gemini_lazy_loading', 'true') !== 'false');
    const [imageOptimization, setImageOptimization] = useState(() => getUserSetting('gemini_image_optimization', 'true') !== 'false');
    const [preloadMessages, setPreloadMessages] = useState(() => getUserSetting('gemini_preload_messages', 'true') !== 'false');
    const [batchOperations, setBatchOperations] = useState(() => getUserSetting('gemini_batch_operations', 'true') !== 'false');

    // Privacy Settings
    const [enableAnalytics, setEnableAnalytics] = useState(() => getUserSetting('gemini_analytics', 'true') !== 'false');
    const [enableErrorReporting, setEnableErrorReporting] = useState(() => getUserSetting('gemini_error_reporting', 'true') !== 'false');
    const [enableUsageTracking, setEnableUsageTracking] = useState(() => getUserSetting('gemini_usage_tracking', 'true') !== 'false');
    const [enableCrashReports, setEnableCrashReports] = useState(() => getUserSetting('gemini_crash_reports', 'true') !== 'false');
    const [enablePerformanceMonitoring, setEnablePerformanceMonitoring] = useState(() => getUserSetting('gemini_performance_monitoring', 'true') !== 'false');

    // Advanced AI Settings
    const [temperature, setTemperature] = useState(() => getUserSetting('gemini_temperature', '0.7'));
    const [topP, setTopP] = useState(() => getUserSetting('gemini_top_p', '0.8'));
    const [topK, setTopK] = useState(() => getUserSetting('gemini_top_k', '40'));
    const [maxTokens, setMaxTokens] = useState(() => getUserSetting('gemini_max_tokens', '2048'));
    const [enableStreaming, setEnableStreaming] = useState(() => {
        // For public users, default to 'false', for logged-in users use saved setting or 'true'
        if (!currentUser) return false;
        return getUserSetting('gemini_streaming', 'true') !== 'false';
    });
    const [enableContextMemory, setEnableContextMemory] = useState(() => getUserSetting('gemini_context_memory', 'true') !== 'false');
    const [contextWindow, setContextWindow] = useState(() => getUserSetting('gemini_context_window', '10'));
    const [enableSystemPrompts, setEnableSystemPrompts] = useState(() => getUserSetting('gemini_system_prompts', 'true') !== 'false');

    // Notification Settings
    const [enableDesktopNotifications, setEnableDesktopNotifications] = useState(() => getUserSetting('gemini_desktop_notifications', 'true') !== 'false');
    const [enableEmailNotifications, setEnableEmailNotifications] = useState(() => getUserSetting('gemini_email_notifications', 'true') !== 'false');
    const [enablePushNotifications, setEnablePushNotifications] = useState(() => getUserSetting('gemini_push_notifications', 'true') !== 'false');
    const [notificationSound, setNotificationSound] = useState(() => getUserSetting('gemini_notification_sound', 'default'));
    const [notificationFrequency, setNotificationFrequency] = useState(() => getUserSetting('gemini_notification_frequency', 'immediate'));

    // UI/UX Settings
    const [enableAnimations, setEnableAnimations] = useState(() => getUserSetting('gemini_animations', 'true') !== 'false');
    const [enableHoverEffects, setEnableHoverEffects] = useState(() => getUserSetting('gemini_hover_effects', 'true') !== 'false');
    const [enableTransitions, setEnableTransitions] = useState(() => getUserSetting('gemini_transitions', 'true') !== 'false');
    const [enableTooltips, setEnableTooltips] = useState(() => getUserSetting('gemini_tooltips', 'true') !== 'false');
    const [enableKeyboardShortcuts, setEnableKeyboardShortcuts] = useState(() => getUserSetting('gemini_keyboard_shortcuts', 'true') !== 'false');
    const [enableDragAndDrop, setEnableDragAndDrop] = useState(() => getUserSetting('gemini_drag_drop', 'true') !== 'false');
    const [enableRightClickMenu, setEnableRightClickMenu] = useState(() => getUserSetting('gemini_right_click', 'true') !== 'false');
    const [enableContextMenu, setEnableContextMenu] = useState(() => getUserSetting('gemini_context_menu', 'true') !== 'false');
    const [showTypingIndicator, setShowTypingIndicator] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);
    const [messageReactions, setMessageReactions] = useState({});
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [reactionTargetMessage, setReactionTargetMessage] = useState(null);
    const [showAudioPreview, setShowAudioPreview] = useState(false);
    const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
    const [recordedAudioFile, setRecordedAudioFile] = useState(null);
    const [uploadingAudio, setUploadingAudio] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [recordingStartTime, setRecordingStartTime] = useState(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [recordedAudioType, setRecordedAudioType] = useState('audio/webm');
    const recordingChunksRef = useRef([]);
    const messageHistoryRef = useRef([]);
    const historyIndexRef = useRef(-1);
    const [editingMessageIndex, setEditingMessageIndex] = useState(null);
    const [editingMessageContent, setEditingMessageContent] = useState('');
    const [copiedMessageIndex, setCopiedMessageIndex] = useState(null);

    // Reporting State
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportStep, setReportStep] = useState(1);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedSubCategory, setSelectedSubCategory] = useState('');
    const [reportDescription, setReportDescription] = useState('');
    const [reportingMessage, setReportingMessage] = useState(null);
    const [isReporting, setIsReporting] = useState(false);

    // Admin Reports State
    const [showAdminReportsModal, setShowAdminReportsModal] = useState(false);
    const [adminReports, setAdminReports] = useState([]);
    const [adminReportsLoading, setAdminReportsLoading] = useState(false);
    const [adminReportsFilter, setAdminReportsFilter] = useState('pending'); // 'pending', 'resolved', 'dismissed', 'all'
    const [showAdminNoteModal, setShowAdminNoteModal] = useState(false);
    const [selectedAdminReport, setSelectedAdminReport] = useState(null);

    const [adminNoteText, setAdminNoteText] = useState('');

    // State for managing which message's "more options" menu is open
    const [openMessageMenuIndex, setOpenMessageMenuIndex] = useState(null);
    const [showInputOptions, setShowInputOptions] = useState(false);
    const inputOptionsRef = useRef(null);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (openMessageMenuIndex !== null && !event.target.closest('.message-menu-container')) {
                setOpenMessageMenuIndex(null);
            }
            if (showInputOptions && inputOptionsRef.current && !inputOptionsRef.current.contains(event.target)) {
                setShowInputOptions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [openMessageMenuIndex, showInputOptions]);

    // Speech Synthesis State
    const [speakingMessageIndex, setSpeakingMessageIndex] = useState(null);
    const synthRef = useRef(window.speechSynthesis);
    const speechUtteranceRef = useRef(null);

    const handleSpeak = (text, index) => {
        const synth = synthRef.current;
        if (speakingMessageIndex === index) {
            // Already speaking this message -> Stop
            synth.cancel();
            setSpeakingMessageIndex(null);
            return;
        }

        // Cancel previous speech if any
        if (synth.speaking) {
            synth.cancel();
        }

        setSpeakingMessageIndex(index);

        // Get voices if not already available (sometimes they load async)
        let voices = synth.getVoices();

        const cleanTextForSpeech = (rawText) => {
            if (!rawText) return '';
            let cleaned = rawText;

            // 1. Handle Images: ![Alt](url) -> "Image: Alt"
            cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, 'Image: $1');

            // 2. Handle Markdown Links: [Text](url) -> "Text"
            cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

            // 3. Handle Raw URLs: https://... -> "Link" (unless it was part of a markdown link handled above)
            cleaned = cleaned.replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, 'Link');

            // 4. Remove Visual Separators (===, ---, ***) - replace with pause
            cleaned = cleaned.replace(/^[=\-_~*]{3,}\s*$/gm, '. '); // Full line separators
            cleaned = cleaned.replace(/([=\-_~*]){3,}/g, ' '); // Inline separators

            // 5. Headings: ### Title -> Title. (Add period for pause)
            cleaned = cleaned.replace(/^(#+)\s+(.*)$/gm, '$2. ');

            // 6. Tables:
            // Remove separator rows: |---|---|
            cleaned = cleaned.replace(/^\|?[\s-]+\|[\s-]+\|?$/gm, '');
            // Replace pipes with commas for flow in data rows
            cleaned = cleaned.replace(/\|/g, ', ');

            // 7. Code Blocks:
            // Remove fencing completely.
            cleaned = cleaned.replace(/```[\w-]*\n?/g, ' ');
            cleaned = cleaned.replace(/```/g, ' ');

            // 8. Inline Code: `text` -> text
            cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

            // 9. Bold/Italic: **text** -> text
            cleaned = cleaned.replace(/(\*\*|__)(.*?)\1/g, '$2');
            cleaned = cleaned.replace(/(\*|_)(.*?)\1/g, '$2');

            // 10. Blockquotes: > text -> text
            cleaned = cleaned.replace(/^>\s+/gm, '');

            // 11. Lists:
            // Unordered: - Item or * Item -> Item. (Add period for pause)
            cleaned = cleaned.replace(/^[\s-]*[-*+]\s+(.*)$/gm, '$1. ');

            // 12. HTML Tags: <div> -> ""
            cleaned = cleaned.replace(/<[^>]*>/g, '');

            // 13. Collapse multiple spaces/newlines to single space/pause
            cleaned = cleaned.replace(/\n+/g, '. '); // Turn newlines into full stops for pauses
            cleaned = cleaned.replace(/\s+/g, ' ');

            // 14. Fix double punctuation (.. -> .)
            cleaned = cleaned.replace(/\.\s*\./g, '.');
            cleaned = cleaned.replace(/,\s*,/g, ',');

            // 15. Comprehensive Abbreviation Expansion
            const abbreviations = {
                // General & Academic
                "e.g.": "for example,",
                "i.e.": "that is,",
                "etc.": "et cetera",
                "et al.": "and others",
                "vs.": "versus",
                "viz.": "namely",
                "cf.": "compare",
                "n.b.": "note well",
                "p.s.": "postscript",
                "approx.": "approximately",
                "tel.": "telephone",
                "addr.": "address",
                "ppl.": "people",
                "info.": "information",
                "no.": "number",
                "vol.": "volume",

                // Time & Date
                "Jan.": "January",
                "Feb.": "February",
                "Mar.": "March",
                "Apr.": "April",
                "Aug.": "August",
                "Sept.": "September",
                "Oct.": "October",
                "Nov.": "November",
                "Dec.": "December",
                "Mon.": "Monday",
                "Tue.": "Tuesday",
                "Wed.": "Wednesday",
                "Thu.": "Thursday",
                "Fri.": "Friday",
                "Sat.": "Saturday",
                "Sun.": "Sunday",
                "a.m.": "morning",
                "p.m.": "afternoon or evening",

                // Titles & Ranks
                "mr.": "Mister",
                "mrs.": "Missus",
                "ms.": "Miss",
                "dr.": "Doctor",
                "prof.": "Professor",
                "rev.": "Reverend",
                "gen.": "General",
                "col.": "Colonel",
                "lt.": "Lieutenant",
                "capt.": "Captain",
                "sgt.": "Sergeant",
                "cpl.": "Corporal",
                "pfc.": "Private First Class",
                "pvt.": "Private",
                "maj.": "Major",
                "adm.": "Admiral",
                "cmdr.": "Commander",
                "phd": "Doctor of Philosophy",
                "md": "Doctor of Medicine",
                "ceo": "Chief Executive Officer",

                // Business & Government
                "inc.": "incorporated",
                "ltd.": "limited",
                "corp.": "corporation",
                "co.": "company",
                "dept.": "department",
                "govt.": "government",
                "gov.": "government",
                "w.r.t.": "with respect to",

                // Technical & Computing
                "repo": "repository",
                "config": "configuration",
                "specs": "specifications",
                "dev": "developer",
                "env": "environment",
                "dir": "directory",
                "lib": "library",
                "src": "source",
                "dest": "destination",
                "pr": "pull request",
                "msg": "message",
                "err": "error",
                "std": "standard",

                // Tech Acronyms (Expanded)
                "tv": "Television",
                "pc": "Personal Computer",
                "cpu": "Central Processing Unit",
                "ram": "Random Access Memory",
                "rom": "Read-Only Memory",
                "usb": "Universal Serial Bus",
                "dvd": "Digital Versatile Disc",
                "cd": "Compact Disc",
                "mp3": "MPEG Audio Layer 3",
                "pdf": "Portable Document Format",
                "jpg": "Joint Photographic Experts Group",
                "png": "Portable Network Graphics",
                "gif": "Graphics Interchange Format",
                "http": "Hypertext Transfer Protocol",
                "https": "Hypertext Transfer Protocol Secure",
                "ftp": "File Transfer Protocol",
                "ftps": "File Transfer Protocol Secure",
                "sftp": "Secure File Transfer Protocol",
                "ssh": "Secure Shell",
                "html": "HyperText Markup Language",
                "css": "Cascading Style Sheets",
                "js": "JavaScript",
                "sql": "Structured Query Language",
                "php": "Hypertext Preprocessor",
                "java": "Java programming language",
                "python": "Python programming language",
                "c++": "C plus plus programming language",
                "ios": "iPhone Operating System",
                "android": "Android operating system",
                "wifi": "Wireless Fidelity",
                "lan": "Local Area Network",
                "wan": "Wide Area Network",
                "isp": "Internet Service Provider",
                "ip": "Internet Protocol",
                "url": "Uniform Resource Locator",
                "dom": "Document Object Model",
                "api": "Application Programming Interface",
                "gui": "Graphical User Interface",
                "cli": "Command-Line Interface",
                "oop": "Object-Oriented Programming",
                "ajax": "Asynchronous JavaScript and XML",
                "json": "JavaScript Object Notation",
                "xml": "Extensible Markup Language",
                "rss": "Really Simple Syndication",
                "ssl": "Secure Sockets Layer",

                // Common Shortforms
                "w/o": "without",
                "w/": "with",
                "b/w": "between",
                "n/a": "not applicable",
                "aka": "also known as",
                "faq": "frequently asked questions",
                "diy": "do it yourself",
                "asap": "as soon as possible",
                "tldr": "summary",
                "tl;dr": "summary",

                // Casual / Chat
                "btw": "by the way",
                "fyi": "for your information",
                "imo": "in my opinion",
                "imho": "in my humble opinion",
                "tbh": "to be honest",
                "idk": "I don't know",
                "brb": "be right back",
                "gtg": "got to go",
                "afk": "away from keyboard",
                "rn": "right now",
                "dm": "direct message",

                // Common Chat Shortcuts (Extended)
                "lol": "laugh out loud",
                "ttyl": "talk to you later",
                "fya": "for your attention",
                "icymi": "in case you missed it",
                "nw": "no worries",
                "plz": "please",
                "thx": "thanks",
                "wb": "welcome back",
                "gg": "good game",
                "bc": "because",
                "btdt": "been there done that",
                "cu": "see you",
                "cw": "current weather",
                "dik": "do I know",
                "fomo": "fear of missing out",
                "fwiw": "for what it's worth",
                "gr8": "great",
                "iirc": "if I remember correctly",
                "iow": "in other words",
                "jk": "just kidding",
                "l8": "late",
                "lmk": "let me know",
                "moo": "my opinion only",
                "nvm": "never mind",
                "oic": "oh I see",
                "omw": "on my way",
                "ot": "off topic",
                "pls": "please",
                "rofl": "rolling on the floor laughing",
                "smh": "shaking my head",
                "so": "significant other",
                "tb": "throwback",
                "ty": "thank you",
                "yolo": "you only live once",

                // Extended List 2 (Countries, States, Acronyms)
                "abc": "American Broadcasting Company",
                "ac": "Alternating Current",
                "adc": "Analog-to-Digital Converter",
                "ae": "American Express",
                "af": "Air Force",
                "ag": "Attorney General",
                "ai": "Artificial Intelligence",
                "al": "Alabama",
                "ao": "American Ocean",
                "ap": "Associated Press",
                "ar": "Arkansas",
                "at&t": "American Telephone and Telegraph",
                "au": "Australia",
                "av": "Audio-Visual",
                "az": "Arizona",
                "ba": "Bachelor of Arts",
                "bbc": "British Broadcasting Corporation",
                "bbs": "Bulletin Board System",
                "bd": "Blu-ray Disc",
                "bh": "Bahrain",
                "bi": "Burundi",
                "bj": "Benin",
                "bk": "Book",
                "bl": "Saint Barthélemy",
                "bm": "Bermuda",
                "bn": "Brunei",
                "bo": "Bolivia",
                "bp": "Blood Pressure",
                "bq": "Caribbean Netherlands",
                "br": "Brazil",
                "bs": "Bahamas",
                "bt": "Bhutan",
                "bu": "Bulgaria",
                "bv": "Bouvet Island",
                "bw": "Botswana",
                "bz": "Belize",
                "ca": "California",
                "cad": "Computer-Aided Design",
                "cae": "Computer-Aided Engineering",
                "cam": "Computer-Aided Manufacturing",
                "cap": "Capital",
                "car": "Central African Republic",
                "cb": "Citizens Band",
                "cc": "Closed Caption",
                "ce": "European Conformity",
                "cg": "Congo",
                "ch": "Switzerland",
                "ci": "Côte d'Ivoire",
                "cj": "China",
                "ck": "Cook Islands",
                "cl": "Chile",
                "cm": "Cameroon",
                "cn": "China",
                "com": "Commercial",
                "cp": "Copyleft",
                "cq": "Costa Rica",
                "cr": "Costa Rica",
                "cs": "Czechoslovakia",
                "ct": "Connecticut",
                "cv": "Cape Verde",
                "cx": "Christmas Island",
                "cy": "Cyprus",
                "cz": "Czech Republic",
                "da": "Data Access",
                "db": "Database",
                "dc": "Direct Current",
                "dd": "Double Density",
                "de": "Delaware",
                "df": "Distrito Federal",
                "dg": "Diego Garcia",
                "dh": "Dhahran",
                "dj": "Djibouti",
                "dk": "Denmark",
                "dp": "Data Processing",
                "ds": "Data Set",
                "dt": "Data Transmission",
                "du": "Dubai",
                "dv": "Data Validation",
                "dw": "Data Warehouse",
                "dx": "Data Exchange",
                "dy": "Data Yield",
                "dz": "Algeria",
                "ea": "Eastern Africa",
                "eb": "Eastern Bloc",
                "ec": "Ecuador",
                "ed": "Education",
                "ee": "Estonia",
                "ef": "Egypt",
                "eh": "Western Sahara",
                "ei": "Ireland",
                "ej": "East Jerusalem",
                "ek": "East Kilbride",
                "el": "Greece",
                "em": "Electronic Mail",
                "en": "England",
                "eo": "Esperanto",
                "ep": "European Patent",
                "eq": "Equatorial Guinea",
                "er": "Eritrea",
                "es": "Spain",
                "et": "Ethiopia",
                "eu": "European Union",
                "ev": "Electric Vehicle",
                "ew": "Electronic Warfare",
                "ex": "Example",
                "ey": "Estonia",
                "ez": "Easy",
                "fa": "Football Association",
                "fb": "Facebook",
                "fc": "Football Club",
                "fd": "Federal Deposit",
                "fe": "Far Eastern",
                "ff": "Faroe Islands",
                "fg": "Federal Government",
                "fh": "Federal Highway",
                "fi": "Finland",
                "fj": "Fiji",
                "fk": "Falkland Islands",
                "fl": "Florida",
                "fm": "Federal Maritime",
                "fn": "Faroe Islands",
                "fo": "Faroe Islands",
                "fp": "Federal Property",
                "fq": "Federal Quarter",
                "fr": "France",
                "fs": "Federal Service",
                "ft": "Federal Trade",
                "fu": "Faroe Islands",
                "fv": "Federal Vehicle",
                "fw": "Federal Water",
                "fx": "Foreign Exchange",
                "fy": "Federal Year",
                "fz": "Federal Zone",
                "ga": "Georgia",
                "gb": "Great Britain",
                "gc": "Grand Canyon",
                "gd": "Grenada",
                "ge": "Georgia",
                "gf": "French Guiana",
                "gh": "Ghana",
                "gi": "Gibraltar",
                "gj": "Gambia",
                "gl": "Greenland",
                "gp": "Guadeloupe",
                "gq": "Equatorial Guinea",
                "gr": "Greece",
                "gs": "South Georgia",
                "gt": "Guatemala",
                "gu": "Guam",
                "gv": "Government Vehicle",
                "gw": "Government Water",
                "gy": "Guyana",
                "gz": "Gaza Strip",
                "hb": "Hamburg",
                "hc": "High Court",
                "hd": "High Definition",
                "hf": "High Frequency",
                "hg": "High Gain",
                "hh": "High Horsepower",
                "hj": "High Jump",
                "hk": "Hong Kong",
                "hl": "High Level",
                "hm": "High Mobility",
                "hn": "Honduras",
                "ho": "Honduras",
                "hq": "Headquarters"
            };

            // Apply expansions safely
            Object.keys(abbreviations).forEach(key => {
                // Escape special regex chars
                const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                // Special handling for terms with slashes like w/o to ensure correct boundary matching
                let pattern;
                if (key.includes('/') || key.includes(';')) {
                    // Lookbehind/Lookahead for whitespace or start/end of string
                    pattern = new RegExp(`(^|\\s)(${escapedKey})(?=\\s|$)`, 'gi');
                    cleaned = cleaned.replace(pattern, `$1${abbreviations[key]}`);
                } else {
                    // Standard word boundary
                    pattern = new RegExp(`\\b${escapedKey}\\b`, 'gi');
                    pattern = key.endsWith('.')
                        ? new RegExp(`\\b${escapedKey}`, 'gi') // If ends with dot, don't force \b after dot
                        : new RegExp(`\\b${escapedKey}\\b`, 'gi');

                    cleaned = cleaned.replace(pattern, abbreviations[key]);
                }
            });

            return cleaned.trim();
        };

        // Chunking function to split long text into sentences/phrases
        // This avoids the browser's ~15s limit on speech synthesis
        const chunkText = (str) => {
            // Split by punctuation, keeping the punctuation
            const chunks = str.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [str];
            return chunks.map(c => c.trim()).filter(c => c.length > 0);
        };

        const cleanedText = cleanTextForSpeech(text);
        const chunks = chunkText(cleanedText);
        let currentChunkIndex = 0;

        const speakNextChunk = () => {
            if (currentChunkIndex >= chunks.length) {
                setSpeakingMessageIndex(null);
                return;
            }

            const chunk = chunks[currentChunkIndex];
            const utterance = new SpeechSynthesisUtterance(chunk);

            // Refetch voices just in case they loaded late
            if (voices.length === 0) voices = synth.getVoices();

            // Try to select a better voice - prioritizing "Natural", "Google", "Microsoft" in that order
            const preferredVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Microsoft David") || v.name.includes("Natural"));
            if (preferredVoice) utterance.voice = preferredVoice;

            utterance.rate = 1;
            utterance.pitch = 1;
            utterance.volume = 1;

            utterance.onend = () => {
                currentChunkIndex++;
                speakNextChunk();
            };

            utterance.onerror = (e) => {
                console.error("Speech verification warning (often ignorable):", e);
                // On error, try to continue to next chunk anyway, or stop
                // Often 'interrupted' or 'canceled' errors happen if we click stop, 
                // in which case `speakingMessageIndex` check handles UI, but we should ensure we don't loop
                if (speakingMessageIndex === null) return;
                currentChunkIndex++;
                speakNextChunk();
            };

            speechUtteranceRef.current = utterance;
            synth.speak(utterance);
        };

        speakNextChunk();
    };

    const handleStopSpeak = () => {
        const synth = synthRef.current;
        synth.cancel();
        // Clear the onend handler so it doesn't trigger the next chunk loop
        if (speechUtteranceRef.current) {
            speechUtteranceRef.current.onend = null;
        }
        setSpeakingMessageIndex(null);
    };

    // Cleanup speech on unmount
    useEffect(() => {
        return () => {
            if (synthRef.current) {
                synthRef.current.cancel();
            }
        };
    }, []);

    // Set up BroadcastChannel for cross-tab rate limit sync
    useEffect(() => {
        // Initialize BroadcastChannel (supported in modern browsers)
        if (typeof BroadcastChannel !== 'undefined') {
            rateLimitBroadcastRef.current = new BroadcastChannel('gemini_rate_limit_channel');

            // Listen for rate limit updates from other tabs
            rateLimitBroadcastRef.current.onmessage = (event) => {
                if (event.data.type === 'RATE_LIMIT_UPDATE') {
                    console.log('Received rate limit update from another tab:', event.data.data);
                    setRateLimitInfo(event.data.data);
                }
            };
        }

        // Also listen to localStorage changes (fallback for older browsers)
        const handleStorageChange = (e) => {
            if (e.key === 'gemini_rate_limit_sync' && e.newValue) {
                try {
                    const syncData = JSON.parse(e.newValue);
                    // Only update if the data is recent (within last 5 seconds)
                    if (Date.now() - syncData.timestamp < 5000) {
                        console.log('Received rate limit update via localStorage:', syncData);
                        const { timestamp, ...rateLimitData } = syncData;
                        setRateLimitInfo(rateLimitData);
                    }
                } catch (error) {
                    console.error('Error parsing rate limit sync data:', error);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);

        // Cleanup
        return () => {
            if (rateLimitBroadcastRef.current) {
                rateLimitBroadcastRef.current.close();
            }
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    const REPORT_OPTIONS = {
        "Violence & self-harm": [
            "Threats or incitement to violence", "Gender-based violence", "Sexual violence", "Weapons", "Suicide & self-harm", "Eating disorders", "Human trafficking", "Terrorism"
        ],
        "Sexual exploitation & abuse": [
            "Sexual content involving children", "Non-consensual sexual content", "Sexual solicitation", "Sextortion", "Promotion of sexual violence"
        ],
        "Child exploitation": [
            "Child sexual abuse material", "Grooming", "Harmful content for minors", "Cyberbullying of minors"
        ],
        "Bullying & harassment": [
            "Personal attacks", "Encouraging harassment", "Defamation", "Hate speech", "Threats"
        ],
        "Spam, fraud & deception": [
            "Scams", "Phishing", "Fake engagement", "False information", "Impersonation"
        ],
        "Privacy violation": [
            "Sharing private information (Doxxing)", "Non-consensual intimate images", "Identity theft"
        ],
        "Intellectual property": [
            "Copyright infringement", "Trademark violation", "Counterfeit goods"
        ],
        "Age-inappropriate content": [
            "Adult content", "Graphic violence", "Drugs and controlled substances"
        ],
        "Something else": [
            "Other illegal acts", "Policy violations", "Technical issue"
        ]
    };
    // Edit mode property suggestions state
    const [showEditPropertySuggestions, setShowEditPropertySuggestions] = useState(false);
    const [editSuggestionQuery, setEditSuggestionQuery] = useState('');
    const [editSuggestionStartPos, setEditSuggestionStartPos] = useState(-1);
    const [selectedEditSuggestionIndex, setSelectedEditSuggestionIndex] = useState(-1);
    const editSuggestionsRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    const scrollToBottom = () => {
        if (autoScroll) {
            // Use a small timeout to ensure DOM has updated
            setTimeout(() => {
                const messagesContainer = messagesContainerRef.current;
                if (messagesContainer) {
                    const scrollTop = messagesContainer.scrollTop;
                    const scrollHeight = messagesContainer.scrollHeight;
                    const clientHeight = messagesContainer.clientHeight;
                    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 30; // 30px tolerance

                    console.log('Scroll check:', { scrollTop, scrollHeight, clientHeight, isAtBottom });

                    if (!isAtBottom) {
                        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                    }
                } else {
                    // Fallback if container not found
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }
            }, 50); // Small delay to ensure DOM updates
        }
    };
    const scrollToBottomInstant = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    };

    // Helpers for date divider and labels
    const isSameDay = (a, b) => {
        const da = new Date(a);
        const db = new Date(b);
        return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
    };
    const getDateLabel = (iso) => {
        const d = new Date(iso);
        const today = new Date();
        const yest = new Date();
        yest.setDate(today.getDate() - 1);
        if (isSameDay(d, today)) return 'Today';
        if (isSameDay(d, yest)) return 'Yesterday';
        return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    };

    // Generate or retrieve session ID
    const getOrCreateSessionId = () => {
        if (sessionId) return sessionId;

        // Try to get existing session from localStorage
        const existingSessionId = localStorage.getItem('gemini_session_id');
        if (existingSessionId) {
            setSessionId(existingSessionId);
            return existingSessionId;
        }

        // Create new session ID
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('gemini_session_id', newSessionId);
        setSessionId(newSessionId);
        return newSessionId;
    };

    // Fetch rate limit status from backend
    const fetchRateLimitStatus = async () => {
        try {

            const response = await authenticatedFetch(`${API_BASE_URL}/api/gemini/rate-limit-status`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Frontend - Rate limit status response:', data);
                if (data.success && data.rateLimit) {
                    console.log('Frontend - Setting rate limit info:', data.rateLimit);
                    setRateLimitInfo(data.rateLimit);

                    // Broadcast to other tabs using BroadcastChannel
                    if (rateLimitBroadcastRef.current) {
                        rateLimitBroadcastRef.current.postMessage({
                            type: 'RATE_LIMIT_UPDATE',
                            data: data.rateLimit
                        });
                    }

                    // Also use localStorage for cross-tab sync (fallback for older browsers)
                    localStorage.setItem('gemini_rate_limit_sync', JSON.stringify({
                        ...data.rateLimit,
                        timestamp: Date.now()
                    }));

                    // Show appropriate modal if rate limit is exceeded
                    if (data.rateLimit.remaining <= 0 && data.rateLimit.role !== 'rootadmin') {
                        setShowSignInModal(true);
                    } else {
                        // Hide modals if rate limit is not exceeded
                        setShowSignInModal(false);
                    }

                    // For public users: If rate limit is reset (remaining equals limit), clear the persisted history
                    if (!currentUser && data.rateLimit.remaining === data.rateLimit.limit && data.rateLimit.limit > 0) {
                        console.log('Public user rate limit reset detected. Clearing local history.');
                        localStorage.removeItem('gemini_public_history');
                        // Only reset messages if we aren't currently typing or loading (to avoid interrupting active session)
                        if (!isLoading && !isTyping) {
                            setMessages([
                                {
                                    role: 'assistant',
                                    content: 'Hello! I\'m SetuAI your AI assistant powered by Groq and co-powered by Sentinel v2.0 Neural Engine (TensorFlow). How can I help you with your real estate needs today?',
                                    timestamp: new Date().toISOString()
                                }
                            ]);
                        }
                    }
                }
            } else {
                console.error('Frontend - Rate limit status failed:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Failed to fetch rate limit status:', error);
            // Fallback: set default rate limit based on user role
            const fallbackRole = currentUser ? (currentUser.role || 'user') : 'public';
            const fallbackLimit = currentUser ? (currentUser.role === 'admin' ? 500 : currentUser.role === 'rootadmin' ? Infinity : 50) : 5;
            setRateLimitInfo({
                role: fallbackRole,
                limit: fallbackLimit,
                remaining: fallbackLimit,
                resetTime: null,
                windowMs: currentUser ? (currentUser.role === 'admin' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000) : 15 * 60 * 1000
            });

            // Hide modals in fallback case since we're setting full limit
            setShowSignInModal(false);
        }
    };

    // Load chat history for authenticated users
    const loadChatHistory = async (currentSessionId) => {
        if (!currentUser || !currentSessionId) return;

        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${currentSessionId}`, {
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.messages && Array.isArray(data.data.messages) && data.data.messages.length > 0) {
                    setMessages(data.data.messages);
                    console.log('Session history loaded:', data.data.messages.length, 'messages');
                }
            } else if (response.status === 404) {
                // No history found, keep default welcome message
                console.log('No session history found');
            } else {
                console.error('Failed to load session history:', response.status);
            }
        } catch (error) {
            console.error('Error loading session history:', error);
        } finally {
            setIsHistoryLoaded(true);
        }
    };

    // Fetch current session name from backend
    const fetchSessionName = async (sessionId) => {
        if (!currentUser || !sessionId) return null;

        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${sessionId}`, {
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.name) {
                    return data.data.name;
                }
            }
            return null;
        } catch (error) {
            console.error('Error fetching chat name:', error);
            return null;
        }
    };

    // Clear chat history locally
    const clearLocalChatHistory = () => {
        setMessages([
            {
                role: 'assistant',
                content: 'Hello! I\'m SetuAI your AI assistant powered by Groq and co-powered by Sentinel v2.0 Neural Engine (TensorFlow). How can I help you with your real estate needs today?',
                timestamp: new Date().toISOString()
            }
        ]);
        // Generate new session ID
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('gemini_session_id', newSessionId);
        setSessionId(newSessionId);
        // Clear ratings for new session
        setMessageRatings({});
        localStorage.setItem('gemini_ratings', JSON.stringify({}));
    };
    // Refresh messages function - reloads current session without losing state
    const refreshMessages = async () => {
        // Public users: Refresh prompt count instead of messages
        if (!currentUser) {
            try {
                await fetchRateLimitStatus();
                toast.success('Prompt count refreshed');
            } catch (error) {
                console.error('Error refreshing prompt count:', error);
                toast.error('Failed to refresh');
            }
            return;
        }

        // Logged-in users: Refresh chat messages from server
        try {
            const currentSessionId = getOrCreateSessionId();
            if (!currentSessionId) {
                toast.error('No active session to refresh');
                return;
            }

            const response = await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${currentSessionId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.messages) {
                    // Only update if there are new messages or changes
                    const serverMessages = data.data.messages;
                    const currentMessageCount = messages.length;

                    if (serverMessages.length !== currentMessageCount) {
                        setMessages(serverMessages);
                        toast.success(`Messages refreshed! ${serverMessages.length - currentMessageCount} new messages loaded.`);
                    } else {
                        // Check if any messages have been updated
                        let hasUpdates = false;
                        for (let i = 0; i < serverMessages.length; i++) {
                            if (serverMessages[i].content !== messages[i]?.content ||
                                serverMessages[i].timestamp !== messages[i]?.timestamp) {
                                hasUpdates = true;
                                break;
                            }
                        }

                        if (hasUpdates) {
                            setMessages(serverMessages);
                            toast.success('Messages refreshed! Updates loaded.');
                        } else {
                            toast.info('Messages are already up to date.');
                        }
                    }

                    // Scroll to bottom after refresh
                    setTimeout(() => scrollToBottom(), 100);
                } else {
                    toast.info('No messages found to refresh.');
                }
            } else if (response.status === 404) {
                toast.info('No saved messages found for this chat.');
            } else {
                toast.error('Failed to refresh messages');
            }
        } catch (error) {
            console.error('Error refreshing messages:', error);
            toast.error('Failed to refresh messages');
        }
    };

    // Search properties for @ suggestions
    const searchProperties = async (query) => {
        try {
            setIsLoadingSuggestions(true);
            // Show suggestions even for empty query (to show all properties)
            const searchQuery = query ? query.trim() : '';

            const url = `${API_BASE_URL}/api/property-search/search?query=${encodeURIComponent(searchQuery)}&limit=5`;

            const response = await authenticatedFetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                setPropertySuggestions(data.data || []);
            } else {
                const errorText = await response.text();
                setPropertySuggestions([]);
            }
        } catch (error) {
            setPropertySuggestions([]);
        } finally {
            setIsLoadingSuggestions(false);
        }
    };

    // Detect UrbanSetu listing links in input and resolve to property
    const resolvePropertyFromInput = async (text) => {
        try {
            const urlMatch = text.match(/https?:\/\/[^\s]*\/listing\/(\w{24})/i);
            const idMatch = text.match(/(?:^|\s)@?(\w{24})(?:\s|$)/); // fallback if only id typed after @
            const listingId = urlMatch?.[1] || idMatch?.[1];
            if (!listingId) return;

            // Avoid duplicates
            if (selectedProperties.some(p => (p.id || p._id) === listingId)) return;

            const url = `${API_BASE_URL}/api/property-search/${listingId}`;
            const response = await authenticatedFetch(url);
            if (!response.ok) return;
            const data = await response.json();
            if (data?.success && data.data) {
                setSelectedProperties(prev => {
                    const exists = prev.some(p => (p.id || p._id) === (data.data.id || data.data._id));
                    return exists ? prev : [...prev, data.data];
                });
            }
        } catch (_) {
            // silent fail
        }
    };

    // Handle @ input for edit mode
    const handleEditInputChange = (e) => {
        const value = e.target.value;
        setEditingMessageContent(value);

        const cursorPos = e.target.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPos);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex !== -1) {
            const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
            const hasSpaceAfterAt = textAfterAt.includes(' ');

            if (!hasSpaceAfterAt) {
                setShowEditPropertySuggestions(true);
                setEditSuggestionQuery(textAfterAt);
                setEditSuggestionStartPos(lastAtIndex);
                setSelectedEditSuggestionIndex(-1);
                searchProperties(textAfterAt);
            } else {
                setShowEditPropertySuggestions(false);
            }
        } else {
            setShowEditPropertySuggestions(false);
        }
    };

    const handleEditSuggestionSelect = (property) => {
        const beforeAt = editingMessageContent.substring(0, editSuggestionStartPos);
        const afterAt = editingMessageContent.substring(editSuggestionStartPos + editSuggestionQuery.length + 1);

        const newMessage = `${beforeAt}@${property.name}${afterAt}`;
        setEditingMessageContent(newMessage);

        setShowEditPropertySuggestions(false);
        setEditSuggestionQuery('');
        setEditSuggestionStartPos(-1);
        setSelectedEditSuggestionIndex(-1);
    };

    // Handle @ input for property suggestions
    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputMessage(value);
        handleTyping(); // Call the existing typing handler

        // Check for UrbanSetu listing URL or 24-char id to auto-resolve
        resolvePropertyFromInput(value);

        // Check for @ symbol
        const cursorPos = e.target.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPos);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex !== -1) {
            const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
            const hasSpaceAfterAt = textAfterAt.includes(' ');

            if (!hasSpaceAfterAt) {
                // Show suggestions
                setShowPropertySuggestions(true);
                setSuggestionQuery(textAfterAt);
                setSuggestionStartPos(lastAtIndex);
                setSelectedSuggestionIndex(-1);

                // Search properties
                searchProperties(textAfterAt);
            } else {
                setShowPropertySuggestions(false);
            }
        } else {
            setShowPropertySuggestions(false);
        }
    };

    // Handle suggestion selection
    const handleSuggestionSelect = (property) => {
        const beforeAt = inputMessage.substring(0, suggestionStartPos);
        const afterAt = inputMessage.substring(suggestionStartPos + suggestionQuery.length + 1);

        const newMessage = `${beforeAt}@${property.name}${afterAt}`;
        setInputMessage(newMessage);

        // Add property to selected properties
        setSelectedProperties(prev => [...prev, property]);

        // Hide suggestions
        setShowPropertySuggestions(false);
        setSuggestionQuery('');
        setSuggestionStartPos(-1);
        setSelectedSuggestionIndex(-1);

        // Focus back to input
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }, 100);
    };

    // Handle keyboard navigation for suggestions
    const handleKeyDown = (e) => {
        if (!showPropertySuggestions) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedSuggestionIndex(prev =>
                    prev < propertySuggestions.length - 1 ? prev + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedSuggestionIndex(prev =>
                    prev > 0 ? prev - 1 : propertySuggestions.length - 1
                );
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedSuggestionIndex >= 0 && propertySuggestions[selectedSuggestionIndex]) {
                    handleSuggestionSelect(propertySuggestions[selectedSuggestionIndex]);
                }
                break;
            case 'Escape':
                setShowPropertySuggestions(false);
                setSuggestionQuery('');
                setSuggestionStartPos(-1);
                setSelectedSuggestionIndex(-1);
                break;
        }
    };

    // Close edit suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            const clickedInsideSuggestions = editSuggestionsRef.current && editSuggestionsRef.current.contains(event.target);
            const clickedInsideTextarea = event.target.closest('textarea');
            const isEditTextarea = clickedInsideTextarea && clickedInsideTextarea.placeholder.includes('Edit your message');

            if (showEditPropertySuggestions && !clickedInsideSuggestions && !isEditTextarea) {
                setShowEditPropertySuggestions(false);
                setEditSuggestionQuery('');
                setEditSuggestionStartPos(-1);
                setSelectedEditSuggestionIndex(-1);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showEditPropertySuggestions]);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            const clickedInsideInput = inputRef.current && inputRef.current.contains(event.target);
            const clickedInsideSuggestions = suggestionsRef.current && suggestionsRef.current.contains(event.target);
            if (showPropertySuggestions && !clickedInsideInput && !clickedInsideSuggestions) {
                setShowPropertySuggestions(false);
                setSuggestionQuery('');
                setSuggestionStartPos(-1);
                setSelectedSuggestionIndex(-1);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showPropertySuggestions]);

    // Force suggestions to appear above the message input (fixed placement)
    // We intentionally avoid dynamic positioning to keep the dropdown anchored above the footer input

    // Clear chat history (server + local) from within the chatbox header
    const handleClearChatHistory = async () => {
        try {
            // If user is not authenticated, just clear local chat
            if (!currentUser) {
                clearLocalChatHistory();
                toast.success('Chat cleared');
                return;
            }

            const currentSessionId = getOrCreateSessionId();
            const response = await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${currentSessionId}/clear`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                toast.success('Chat cleared');
                clearLocalChatHistory();
            } else {
                const errorData = await response.json();
                toast.error(errorData.message || 'Failed to clear chat');
            }
        } catch (error) {
            console.error('Error clearing chat history:', error);
            toast.error('Failed to clear chat history');
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Load user-specific settings when currentUser changes
    useEffect(() => {
        if (currentUser) {
            // Reload all user-specific settings
            setSelectedTheme(getUserSetting('gemini_theme', 'blue'));

            const savedCustomTheme = getUserSetting('gemini_custom_theme', null);
            setCustomTheme(savedCustomTheme ? JSON.parse(savedCustomTheme) : null);

            setFontSize(getUserSetting('gemini_font_size', 'medium'));
            setMessageDensity(getUserSetting('gemini_message_density', 'comfortable'));
            setAutoScroll(getUserSetting('gemini_auto_scroll', 'true') !== 'false');
            setShowTimestamps(getUserSetting('gemini_show_timestamps', 'true') !== 'false');
            setAiResponseLength(getUserSetting('gemini_response_length', currentUser ? 'medium' : 'small'));
            setAiCreativity(getUserSetting('gemini_creativity', currentUser ? 'balanced' : 'conservative'));
            setSoundEnabled(getUserSetting('gemini_sound_enabled', 'true') !== 'false');
            setTypingSounds(getUserSetting('gemini_typing_sounds', 'true') !== 'false');
            setDataRetention(getUserSetting('gemini_data_retention', '30'));

            // Advanced Settings
            setAutoSave(getUserSetting('gemini_auto_save', 'true') !== 'false');
            setMessageLimit(getUserSetting('gemini_message_limit', '100'));
            setSessionTimeout(getUserSetting('gemini_session_timeout', '30'));
            setEnableMarkdown(getUserSetting('gemini_enable_markdown', 'true') !== 'false');
            setEnableCodeHighlighting(getUserSetting('gemini_code_highlighting', 'true') !== 'false');
            setEnableEmojiReactions(getUserSetting('gemini_emoji_reactions', 'true') !== 'false');
            setEnableMessageSearch(getUserSetting('gemini_message_search', 'true') !== 'false');
            setEnableQuickActions(getUserSetting('gemini_quick_actions', 'true') !== 'false');
            setEnableSmartSuggestions(getUserSetting('gemini_smart_suggestions', 'true') !== 'false');
            setEnableTypingIndicator(getUserSetting('gemini_typing_indicator', 'true') !== 'false');

            // Accessibility Settings
            setHighContrast(getUserSetting('gemini_high_contrast', 'false') === 'true');
            setReducedMotion(getUserSetting('gemini_reduced_motion', 'false') === 'true');
            setScreenReaderSupport(getUserSetting('gemini_screen_reader', 'false') === 'true');
            setLargeText(getUserSetting('gemini_large_text', 'false') === 'true');
            setKeyboardNavigation(getUserSetting('gemini_keyboard_nav', 'true') !== 'false');

            // Performance Settings
            setMessageCaching(getUserSetting('gemini_message_caching', 'true') !== 'false');
            setLazyLoading(getUserSetting('gemini_lazy_loading', 'true') !== 'false');
            setImageOptimization(getUserSetting('gemini_image_optimization', 'true') !== 'false');
            setPreloadMessages(getUserSetting('gemini_preload_messages', 'true') !== 'false');
            setBatchOperations(getUserSetting('gemini_batch_operations', 'true') !== 'false');

            // Privacy Settings
            setEnableAnalytics(getUserSetting('gemini_analytics', 'true') !== 'false');
            setEnableErrorReporting(getUserSetting('gemini_error_reporting', 'true') !== 'false');
            setEnableUsageTracking(getUserSetting('gemini_usage_tracking', 'true') !== 'false');
            setEnableCrashReports(getUserSetting('gemini_crash_reports', 'true') !== 'false');
            setEnablePerformanceMonitoring(getUserSetting('gemini_performance_monitoring', 'true') !== 'false');

            // Advanced AI Settings
            setTemperature(getUserSetting('gemini_temperature', '0.7'));
            setTopP(getUserSetting('gemini_top_p', '0.9'));
            setTopK(getUserSetting('gemini_top_k', '40'));
            setMaxTokens(getUserSetting('gemini_max_tokens', '2048'));
            setEnableStreaming(getUserSetting('gemini_streaming', currentUser ? 'true' : 'false') !== 'false');
            setEnableContextMemory(getUserSetting('gemini_context_memory', 'true') !== 'false');
            setContextWindow(getUserSetting('gemini_context_window', '4'));
            setEnableSystemPrompts(getUserSetting('gemini_system_prompts', 'true') !== 'false');

            // Notification Settings
            setEnableDesktopNotifications(getUserSetting('gemini_desktop_notifications', 'true') !== 'false');
            setEnableEmailNotifications(getUserSetting('gemini_email_notifications', 'false') !== 'false');
            setEnablePushNotifications(getUserSetting('gemini_push_notifications', 'true') !== 'false');
            setNotificationSound(getUserSetting('gemini_notification_sound', 'default'));
            setNotificationFrequency(getUserSetting('gemini_notification_frequency', 'immediate'));

            // UI/UX Settings
            setEnableAnimations(getUserSetting('gemini_animations', 'true') !== 'false');
            setEnableHoverEffects(getUserSetting('gemini_hover_effects', 'true') !== 'false');
            setEnableTransitions(getUserSetting('gemini_transitions', 'true') !== 'false');
            setEnableTooltips(getUserSetting('gemini_tooltips', 'true') !== 'false');
            setEnableKeyboardShortcuts(getUserSetting('gemini_keyboard_shortcuts', 'true') !== 'false');
            setEnableDragAndDrop(getUserSetting('gemini_drag_drop', 'true') !== 'false');
            setEnableRightClickMenu(getUserSetting('gemini_right_click', 'true') !== 'false');
            setEnableContextMenu(getUserSetting('gemini_context_menu', 'true') !== 'false');


        }
    }, [currentUser]);

    // Terms and Conditions Consent Logic - Check IMMEDIATELY when opened
    useEffect(() => {
        if (isOpen) {
            checkTermsConsent();
        }
    }, [isOpen]);

    const checkTermsConsent = () => {
        const TERMS_VERSION = 'v1.0';
        const now = new Date().getTime();
        const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

        let shouldShow = true;

        if (currentUser) {
            const consentData = localStorage.getItem(`gemini_consent_${currentUser._id}`);
            if (consentData) {
                try {
                    const { version, timestamp } = JSON.parse(consentData);
                    if (version === TERMS_VERSION && (now - timestamp < THIRTY_DAYS)) {
                        shouldShow = false;
                    }
                } catch (e) {
                    console.error('Error parsing consent data:', e);
                }
            }
        } else {
            const consentSession = sessionStorage.getItem('gemini_consent_public');
            if (consentSession === 'true') {
                shouldShow = false;
            }
        }

        if (shouldShow) {
            setShowConsentModal(true);
        }
    };

    const acceptTerms = () => {
        const TERMS_VERSION = 'v1.0';
        if (currentUser) {
            localStorage.setItem(`gemini_consent_${currentUser._id}`, JSON.stringify({
                version: TERMS_VERSION,
                timestamp: new Date().getTime(),
                userAction: 'accepted'
            }));
        } else {
            sessionStorage.setItem('gemini_consent_public', 'true');
        }
        setShowConsentModal(false);
        toast.success("Terms accepted. Welcome to SetuAI!");
    };

    // Initialize session and load history when component mounts or user changes
    useEffect(() => {
        // Check for session ID in URL param (e.g. from shared chat import)
        const params = new URLSearchParams(location.search);
        const urlSessionId = params.get('session');

        // If URL has session, use it. Otherwise use existing or create new.
        let currentSessionId;

        if (urlSessionId) {
            console.log('Detected session in URL:', urlSessionId);
            currentSessionId = urlSessionId;
            setSessionId(urlSessionId);
            localStorage.setItem('gemini_session_id', urlSessionId);

            // If we are switching sessions via URL, force reload history even if loaded
            if (sessionId !== urlSessionId) {
                setIsHistoryLoaded(false);
            }
        } else {
            currentSessionId = getOrCreateSessionId();
        }

        if (currentUser && currentSessionId) {
            // Only load if not loaded OR if we just switched via URL
            if (!isHistoryLoaded || (urlSessionId && sessionId !== urlSessionId)) {
                console.log('Loading history for session:', currentSessionId);
                loadChatHistory(currentSessionId);
                loadMessageRatings(currentSessionId);
                loadBookmarkedMessages(currentSessionId);
            }
        } else if (!currentUser) {
            setIsHistoryLoaded(true);
            // Load public history from localStorage
            try {
                const savedPublicHistory = localStorage.getItem('gemini_public_history');
                if (savedPublicHistory) {
                    const parsedHistory = JSON.parse(savedPublicHistory);
                    if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
                        setMessages(parsedHistory);
                        console.log('Loaded public chat history from storage');
                    }
                }
            } catch (error) {
                console.error('Failed to load public history:', error);
            }
        }
        // Restore draft input
        const draftKey = `gemini_draft_${currentSessionId}`;
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) setInputMessage(savedDraft);

        // Initialize smart suggestions from localStorage
        const savedSmartSuggestions = localStorage.getItem('gemini_smart_suggestions');
        if (savedSmartSuggestions !== null) {
            setShowSmartSuggestions(savedSmartSuggestions === 'true');
        }

        // Fetch rate limit status
        fetchRateLimitStatus();
    }, [currentUser, isHistoryLoaded, location.search]);

    // Initialize Prism.js highlighting
    useEffect(() => {
        if (enableCodeHighlighting) {
            Prism.highlightAll();
        }
    }, [messages, enableCodeHighlighting]);

    // Screen reader announcements for new messages
    useEffect(() => {
        if (screenReaderSupport && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            const announcementElement = document.getElementById('screen-reader-announcements');

            if (announcementElement && lastMessage) {
                const messageType = lastMessage.role === 'user' ? 'You said' : 'AI responded';
                const content = lastMessage.content.length > 100
                    ? lastMessage.content.substring(0, 100) + '...'
                    : lastMessage.content;

                const announcementText = `${messageType}: ${content}`;

                // Debug logging
                console.log('Screen Reader Announcement:', announcementText);

                // Clear first, then set new content to ensure announcement
                announcementElement.textContent = '';
                announcementElement.setAttribute('aria-live', 'off');

                setTimeout(() => {
                    announcementElement.setAttribute('aria-live', 'polite');
                    announcementElement.textContent = announcementText;

                    // Force a re-render by briefly changing and restoring the content
                    setTimeout(() => {
                        const currentText = announcementElement.textContent;
                        announcementElement.textContent = '';
                        setTimeout(() => {
                            announcementElement.textContent = currentText;
                        }, 50);
                    }, 100);
                }, 100);

                // Clear the announcement after a longer delay to allow screen readers to process
                setTimeout(() => {
                    announcementElement.textContent = '';
                }, 5000);
            }
        }
    }, [messages, screenReaderSupport]);

    // Screen reader announcements for loading states
    useEffect(() => {
        if (screenReaderSupport) {
            const announcementElement = document.getElementById('screen-reader-announcements');
            const statusElement = document.getElementById('screen-reader-status');

            if (announcementElement && statusElement) {
                if (isLoading) {
                    const loadingText = 'AI is typing a response...';
                    console.log('Screen Reader Loading Announcement:', loadingText);
                    statusElement.textContent = loadingText;
                } else if (isTyping) {
                    const typingText = 'AI is typing...';
                    console.log('Screen Reader Typing Announcement:', typingText);
                    statusElement.textContent = typingText;
                } else {
                    // Clear loading announcements when not loading
                    if (statusElement.textContent.includes('typing')) {
                        console.log('Screen Reader: Clearing loading announcements');
                        statusElement.textContent = '';
                    }
                }
            }
        }
    }, [isLoading, isTyping, screenReaderSupport]);

    // Test screen reader support when enabled
    useEffect(() => {
        if (screenReaderSupport) {
            const statusElement = document.getElementById('screen-reader-status');
            if (statusElement) {
                console.log('Screen Reader Support enabled - testing announcement');
                statusElement.textContent = 'Screen Reader Support is now active';
                setTimeout(() => {
                    statusElement.textContent = '';
                }, 2000);
            }
        }
    }, [screenReaderSupport]);

    // Persist draft input per session
    useEffect(() => {
        const currentSessionId = sessionId || localStorage.getItem('gemini_session_id');
        if (!currentSessionId) return;
        const draftKey = `gemini_draft_${currentSessionId}`;
        localStorage.setItem(draftKey, inputMessage);
    }, [inputMessage, sessionId]);

    // Reset rate limit info when user logs in
    useEffect(() => {
        if (currentUser) {
            fetchRateLimitStatus();
        }
    }, [currentUser]);
    // Data retention cleanup effect
    useEffect(() => {
        // Only run cleanup if dataRetention is a valid value
        if (dataRetention && (dataRetention === '0' || !isNaN(parseInt(dataRetention)))) {
            cleanupOldData();
        }

        // Set up periodic cleanup (every hour) - only if data retention is enabled
        if (dataRetention && dataRetention !== '0') {
            const cleanupInterval = setInterval(() => {
                if (dataRetention && (dataRetention === '0' || !isNaN(parseInt(dataRetention)))) {
                    cleanupOldData();
                }
            }, 60 * 60 * 1000);

            return () => clearInterval(cleanupInterval);
        }
    }, [dataRetention, currentUser]);

    // Persist messages for public users
    useEffect(() => {
        if (!currentUser && messages.length > 0) {
            // Don't save if it's just the default welcome message (optimization)
            if (messages.length === 1 && messages[0].role === 'assistant' && messages[0].content.startsWith("Hello! I'm SetuAI")) {
                return;
            }
            try {
                localStorage.setItem('gemini_public_history', JSON.stringify(messages));
            } catch (error) {
                console.error('Failed to save public history:', error);
            }
        }
    }, [messages, currentUser]);

    // Disable auto-save, high contrast, and smart suggestions for public users
    // Also set default AI settings for public users
    useEffect(() => {
        if (!currentUser) {
            if (autoSave) {
                setAutoSave(false);
            }
            if (highContrast) {
                setHighContrast(false);
            }
            if (showSmartSuggestions) {
                setShowSmartSuggestions(false);
            }
            // Set default AI settings for public users
            if (aiResponseLength !== 'small') {
                setAiResponseLength('small');
            }
            if (aiCreativity !== 'conservative') {
                setAiCreativity('conservative');
            }
            if (enableStreaming !== false) {
                setEnableStreaming(false);
            }
            // Tone is already set to 'neutral' by default, so no need to change it
        }
    }, [currentUser, autoSave, highContrast, showSmartSuggestions, aiResponseLength, aiCreativity, enableStreaming]);

    // Contextual Smart Suggestions trigger
    useEffect(() => {
        // Logic: Show suggestions if there's an error, OR if it's a new session with no messages yet (excluding welcome)
        const isNewSession = messages.length <= 1;
        const shouldShow = hasChatError || (isNewSession && isOpen);

        if (shouldShow && !showSmartSuggestions) {
            // Delay slightly for better visual entrance
            const timer = setTimeout(() => {
                setShowSmartSuggestions(true);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [hasChatError, messages.length, isOpen]);

    // Auto-save effect
    useEffect(() => {
        if (autoSave && messages.length > 0 && currentUser) {
            const currentSessionId = getOrCreateSessionId();
            if (currentSessionId) {
                // Auto-save every 30 seconds
                const autoSaveInterval = setInterval(() => {
                    // Double-check user is still logged in before auto-saving
                    if (currentUser) {
                        saveCurrentSession();
                    }
                }, 30000);

                return () => clearInterval(autoSaveInterval);
            }
        }
    }, [autoSave, messages, currentUser]);

    // Handle force modal opening
    useEffect(() => {
        if (forceModalOpen) {
            setIsOpen(true);
        }
    }, [forceModalOpen]);


    // Get appropriate AI URL based on user role
    const getAIUrl = () => {
        if (!currentUser) {
            return '/ai';
        } else if (currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
            return '/admin/ai';
        } else {
            return '/user/ai';
        }
    };

    // Handle modal open (floating button - no URL change)
    const handleOpen = () => {
        setIsOpen(true);
        // Don't navigate - just open modal on current page
    };

    // Handle modal close with callback
    const handleClose = () => {
        setIsOpen(false);

        if (onModalClose) {
            onModalClose();
        }
    };

    // Listen for clear chat history events from header
    useEffect(() => {
        const handleClearChatHistory = () => {
            clearLocalChatHistory();
        };

        window.addEventListener('clearChatHistory', handleClearChatHistory);
        return () => {
            window.removeEventListener('clearChatHistory', handleClearChatHistory);
        };
    }, []);

    // Close header menu when clicking outside of menu or button
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!isHeaderMenuOpen) return;
            const clickedInsideButton = headerMenuButtonRef.current && headerMenuButtonRef.current.contains(event.target);
            const clickedInsideMenu = headerMenuRef.current && headerMenuRef.current.contains(event.target);
            if (!clickedInsideButton && !clickedInsideMenu) {
                setIsHeaderMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside, { passive: true });
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isHeaderMenuOpen]);

    // Close chat options dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!openHistoryMenuSessionId) return;
            // Check if click is outside any chat options dropdown
            const clickedInsideDropdown = event.target.closest('[data-chat-options-dropdown]');
            if (!clickedInsideDropdown) {
                setOpenHistoryMenuSessionId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside, { passive: true });
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [openHistoryMenuSessionId]);

    // Keyboard shortcuts: Ctrl+F focus, Esc close
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event) => {
            if (event.ctrlKey && event.key === '/') {
                event.preventDefault();
                if (!isMobileDevice()) {
                    inputRef.current?.focus();
                }
            } else if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    // Enhanced scroll lock for modal with mobile support
    useEffect(() => {
        if (isOpen) {
            // Store current scroll position
            const scrollY = window.scrollY;

            // Apply scroll lock styles
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.style.height = '100%';

            // Additional mobile-specific fixes
            document.documentElement.style.overflow = 'hidden';
            document.documentElement.style.height = '100%';

            // Prevent touch events on the body (iOS specific)
            const preventTouch = (e) => {
                if (e.target.closest('.gemini-chatbox-modal')) return;
                e.preventDefault();
            };

            document.addEventListener('touchmove', preventTouch, { passive: false });

            return () => {
                // Restore scroll position and styles
                document.body.style.overflow = '';
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
                document.body.style.height = '';
                document.documentElement.style.overflow = '';
                document.documentElement.style.height = '';

                // Remove touch event listener
                document.removeEventListener('touchmove', preventTouch);

                // Restore scroll position
                window.scrollTo(0, scrollY);
            };
        }
    }, [isOpen]);

    // Dispatch custom event when Gemini chatbot opens/closes
    useEffect(() => {
        const event = new CustomEvent('geminiChatboxToggle', {
            detail: { isOpen }
        });
        window.dispatchEvent(event);
        if (isOpen) {
            setUnreadCount(0);
        }
    }, [isOpen]);

    // Autofocus input when opening (Desktop only)
    useEffect(() => {
        if (isOpen && !isMobileDevice()) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Ensure latest content is visible at bottom when opening and after history loads
    useEffect(() => {
        if (isOpen) {
            // Give layout a tick, then jump to bottom instantly
            setTimeout(() => scrollToBottomInstant(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && isHistoryLoaded) {
            setTimeout(() => scrollToBottomInstant(), 50);
        }
    }, [isHistoryLoaded, isOpen]);

    // Track scroll to bottom detection and compute initial state on open and updates
    useEffect(() => {
        const el = messagesContainerRef.current;
        if (!el) return;
        const compute = () => {
            const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            setIsScrolledUp(distanceFromBottom > 80);

            // Floating date label: find the first fully visible message and use its date
            const children = Array.from(el.querySelectorAll('[data-message-index]'));
            let currentIndex = 0;
            for (let i = 0; i < children.length; i++) {
                const node = children[i];
                const top = node.offsetTop;
                const bottom = top + node.offsetHeight;
                if (bottom >= el.scrollTop + 8) { // 8px tolerance
                    currentIndex = Number(node.getAttribute('data-message-index')) || 0;
                    break;
                }
            }
            const msg = messages[currentIndex];
            if (msg && msg.timestamp) {
                const label = getDateLabel(msg.timestamp);
                setFloatingDateLabel(label);
                // Visibility is controlled by scroll activity; compute only updates label
            }
        };
        compute();
        const onScroll = () => {
            compute();

            // Show floating date when scrolling starts
            setIsScrolling(true);

            // Clear existing timeout
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }

            // Hide floating date after scrolling stops (1 second of inactivity)
            scrollTimeoutRef.current = setTimeout(() => {
                setIsScrolling(false);
            }, 1000);
        };
        el.addEventListener('scroll', onScroll);
        return () => {
            el.removeEventListener('scroll', onScroll);
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        };
    }, [isOpen, messages]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!inputMessage.trim() || isLoading) return;

        // Check message limit
        const messageLimitNum = parseInt(messageLimit);
        if (messages.length >= messageLimitNum) {
            toast.error(`Message limit reached (${messageLimitNum} messages). Please start a new chat session.`);
            return;
        }

        // Check character limit
        if (inputMessage.length > 2000) {
            toast.error('Message is too long. Please shorten it to under 2000 characters.');
            return;
        }

        // Check rate limit
        console.log('Frontend - Rate limit check:', { remaining: rateLimitInfo.remaining, role: rateLimitInfo.role, limit: rateLimitInfo.limit });
        if (rateLimitInfo.remaining <= 0 && rateLimitInfo.role !== 'rootadmin') {
            console.log('Frontend - Rate limit exceeded, showing sign-in modal');
            if (currentUser) {
                setShowSignInModal(true);
            } else {
                setShowSignInOverlay(true);
            }
            return;
        }
        // Removed: prompts left notification toast

        // Trigger send icon fly animation
        setSendIconAnimating(true);
        setTimeout(() => setSendIconAnimating(false), 800);

        let userMessage = inputMessage.trim();
        const currentTone = currentUser ? tone : 'neutral'; // Use default tone for public users
        if (currentTone && currentTone !== 'neutral') {
            userMessage = `[Tone: ${currentTone}] ${userMessage}`;
        }



        setInputMessage('');
        setIsExpanded(false);
        // Reset height
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            // Keep focus after sending
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
        setSelectedProperties([]); // Clear selected properties after sending
        setMessages(prev => {
            const currentMessages = Array.isArray(prev) ? prev : [];
            return [...currentMessages, { role: 'user', content: userMessage, timestamp: new Date().toISOString() }];
        });
        // Add to history stack for Ctrl+Z retrieval
        messageHistoryRef.current.push(userMessage);
        historyIndexRef.current = -1;
        lastUserMessageRef.current = userMessage;

        // Set loading state to show cancel button
        setIsLoading(true);
        setHasChatError(false);

        // Play sound when message is sent
        playSound('message-sent.mp3');

        // Track message sent event
        trackEvent('message_sent', {
            messageLength: userMessage.length,
            sessionId: getOrCreateSessionId(),
            tone: currentUser ? tone : 'neutral'
        });
        try {
            const currentSessionId = getOrCreateSessionId();
            console.log('Sending message to AI:', userMessage, 'Session:', currentSessionId);

            // Note: Session name will be auto-generated by backend after second message
            // This allows the backend to create a more meaningful title based on the conversation

            // Support cancelling with AbortController
            abortControllerRef.current?.abort();
            abortControllerRef.current = new AbortController();
            // Handle streaming vs non-streaming responses
            let data;
            if (enableStreaming === true || enableStreaming === 'true') {
                console.log('Streaming enabled - setting up streaming request');

                const response = await authenticatedFetch(`${API_BASE_URL}/api/gemini/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: userMessage,
                        history: enableContextMemory ? messages.slice(-parseInt(contextWindow)) : messages.slice(-10),
                        sessionId: currentSessionId,
                        tone: currentUser ? tone : 'neutral',
                        responseLength: aiResponseLength,
                        creativity: aiCreativity,
                        temperature: temperature,
                        topP: topP,
                        topK: topK,
                        maxTokens: maxTokens,
                        enableStreaming: enableStreaming,
                        enableContextMemory: enableContextMemory,
                        contextWindow: contextWindow,
                        enableSystemPrompts: enableSystemPrompts,
                        selectedProperties: selectedProperties
                    }),
                    signal: abortControllerRef.current.signal
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }

                // Handle streaming response
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let streamingResponse = '';
                let isStreamingComplete = false;

                // Add streaming message to UI
                setMessages(prev => {
                    const currentMessages = Array.isArray(prev) ? prev : [];
                    return [...currentMessages, {
                        role: 'assistant',
                        content: '',
                        timestamp: new Date().toISOString(),
                        isStreaming: true
                    }];
                });

                try {
                    let buffer = '';
                    while (!isStreamingComplete) {
                        const { done, value } = await reader.read();

                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');

                        // Keep the last line in the buffer as it may be incomplete
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            const trimmedLine = line.trim();
                            if (!trimmedLine) continue;

                            if (trimmedLine.startsWith('data: ')) {
                                try {
                                    const streamData = JSON.parse(trimmedLine.slice(6));

                                    if (streamData.type === 'chunk') {
                                        streamingResponse += streamData.content;

                                        // Update the streaming message in real-time
                                        setMessages(prev => {
                                            const currentMessages = Array.isArray(prev) ? prev : [];
                                            const updatedMessages = [...currentMessages];
                                            const lastMessage = updatedMessages[updatedMessages.length - 1];
                                            if (lastMessage && lastMessage.isStreaming) {
                                                lastMessage.content = streamingResponse;
                                            }
                                            return updatedMessages;
                                        });
                                    } else if (streamData.type === 'done') {
                                        isStreamingComplete = true;
                                        streamingResponse = streamData.content;
                                        const recommendations = streamData.recommendations;

                                        // Finalize the streaming message
                                        setMessages(prev => {
                                            const currentMessages = Array.isArray(prev) ? prev : [];
                                            const updatedMessages = [...currentMessages];
                                            const lastMessage = updatedMessages[updatedMessages.length - 1];
                                            if (lastMessage && lastMessage.isStreaming) {
                                                lastMessage.content = streamingResponse;
                                                lastMessage.recommendations = recommendations;
                                                delete lastMessage.isStreaming;
                                            }
                                            return updatedMessages;
                                        });

                                        // Clear loading state for streaming
                                        setIsLoading(false);
                                    } else if (streamData.type === 'error') {
                                        throw new Error(streamData.content);
                                    }
                                } catch (parseError) {
                                    console.warn('Failed to parse streaming chunk:', parseError);
                                }
                            }
                        }
                    }

                    // Process any remaining content in buffer (though SSE usually ends with newline)
                    if (buffer.trim().startsWith('data: ')) {
                        try {
                            const streamData = JSON.parse(buffer.trim().slice(6));
                            if (streamData.type === 'done') {
                                isStreamingComplete = true;
                                streamingResponse = streamData.content;
                                const recommendations = streamData.recommendations;
                                // Finalize message...
                                setMessages(prev => {
                                    const currentMessages = Array.isArray(prev) ? prev : [];
                                    const updatedMessages = [...currentMessages];
                                    const lastMessage = updatedMessages[updatedMessages.length - 1];
                                    if (lastMessage && lastMessage.isStreaming) {
                                        lastMessage.content = streamingResponse;
                                        lastMessage.recommendations = recommendations;
                                        delete lastMessage.isStreaming;
                                    }
                                    return updatedMessages;
                                });
                                setIsLoading(false);
                            }
                        } catch (e) {
                            console.warn('Error parsing final buffer:', e);
                        }
                    }

                } finally {
                    reader.releaseLock();
                }

                // Use streamingResponse as the final response
                data = { success: true, response: streamingResponse, sessionId: currentSessionId };
            } else {
                // Non-streaming response (original logic)
                const response = await authenticatedFetch(`${API_BASE_URL}/api/gemini/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: userMessage,
                        history: enableContextMemory ? messages.slice(-parseInt(contextWindow)) : messages.slice(-10),
                        sessionId: currentSessionId,
                        tone: currentUser ? tone : 'neutral',
                        responseLength: aiResponseLength,
                        creativity: aiCreativity,
                        temperature: temperature,
                        topP: topP,
                        topK: topK,
                        maxTokens: maxTokens,
                        enableStreaming: enableStreaming,
                        enableContextMemory: enableContextMemory,
                        contextWindow: contextWindow,
                        enableSystemPrompts: enableSystemPrompts,
                        selectedProperties: selectedProperties
                    }),
                    signal: abortControllerRef.current.signal
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }

                data = await response.json();
            }
            console.log('Response data received:', data);
            console.log('Response content length:', data.response ? data.response.length : 0);

            // Only handle non-streaming responses here (streaming is handled above)
            if (!enableStreaming || enableStreaming === 'false') {
                // Validate response structure
                if (data && data.response && typeof data.response === 'string') {
                    const trimmedResponse = data.response.trim();
                    console.log('Setting message with response length:', trimmedResponse.length);
                    setMessages(prev => {
                        const currentMessages = Array.isArray(prev) ? prev : [];
                        return [...currentMessages, { 
                            role: 'assistant', 
                            content: trimmedResponse, 
                            timestamp: new Date().toISOString(),
                            recommendations: data.recommendations
                        }];
                    });
                    if (!isOpen) {
                        setUnreadCount(count => count + 1);
                    }

                    // Play sound when message is received
                    playSound('message-received.mp3');

                    // Update session ID if provided in response
                    if (data.sessionId && data.sessionId !== sessionId) {
                        setSessionId(data.sessionId);
                        localStorage.setItem('gemini_session_id', data.sessionId);
                    }

                    // Refresh rate limit status after successful request
                    fetchRateLimitStatus();

                    // Show sent success check briefly
                    setSendIconSent(true);
                    setTimeout(() => setSendIconSent(false), 600);
                } else {
                    console.error('Invalid response structure:', data);
                    throw new Error('Invalid response structure from server');
                }
            } else {
                // For streaming responses, handle final processing
                if (data && data.response && typeof data.response === 'string') {
                    if (!isOpen) {
                        setUnreadCount(count => count + 1);
                    }

                    // Play sound when streaming is complete
                    playSound('message-received.mp3');

                    // Update session ID if provided in response
                    if (data.sessionId && data.sessionId !== sessionId) {
                        setSessionId(data.sessionId);
                        localStorage.setItem('gemini_session_id', data.sessionId);
                    }

                    // Refresh rate limit status after successful request
                    fetchRateLimitStatus();

                    // Show sent success check briefly
                    setSendIconSent(true);
                    setTimeout(() => setSendIconSent(false), 600);
                }
            }
        } catch (error) {
            console.error('Error in handleSubmit:', error);
            let errorMessage = 'Sorry, I\'m having trouble connecting right now. Please try again later.';

            if (error.name === 'AbortError') {
                // Request was cancelled - backend won't count it
                setIsLoading(false);
                // Refresh rate limit to get accurate count
                fetchRateLimitStatus();
                return;
            }

            if (error.message.includes('restricted content')) {
                // Handle AI Moderated Restriction
                setMessages(prev => {
                    const currentMessages = Array.isArray(prev) ? prev : [];
                    const updatedMessages = [...currentMessages];

                    // 1. Find the last user message to mark it restricted
                    for (let i = updatedMessages.length - 1; i >= 0; i--) {
                        if (updatedMessages[i].role === 'user') {
                            updatedMessages[i] = {
                                ...updatedMessages[i],
                                isRestricted: true,
                                restrictionReason: "AI Moderated"
                            };
                            break;
                        }
                    }

                    // 2. Add the violation message bubble
                    updatedMessages.push({
                        role: 'assistant',
                        content: "⚠️ **Safety Policy Violation Detected**\n\nI cannot fulfill this request because it falls under a restricted category (e.g., Harassment, Hate Speech, Violence, or Illegal Activities).\n\nThis incident has been flagged for review.",
                        timestamp: new Date().toISOString(),
                        isError: true,
                        isViolation: true
                    });

                    return updatedMessages;
                });
                setHasChatError(true);
                autoReportRestrictedContent(lastUserMessageRef.current, "AI Moderated");
                // Note: For policy violations, we keep the prompt count decremented
            } else {
                // For technical errors, backend won't count them either
                // Just set appropriate error messages

                if (error.message.includes('timeout')) {
                    errorMessage = 'Request timed out. The response is taking longer than expected. Please try again.';
                } else if (error.message.includes('HTTP error')) {
                    errorMessage = 'Server error. Please try again later.';
                } else if (error.message.includes('Invalid response structure')) {
                    errorMessage = 'I received an invalid response. Please try again.';
                } else if (error.message.includes('Failed to fetch')) {
                    errorMessage = 'Network error. Please check your connection and try again.';
                }

                // Refresh rate limit to get accurate count after error
                fetchRateLimitStatus();

                setMessages(prev => {
                    const currentMessages = Array.isArray(prev) ? prev : [];
                    return [...currentMessages, {
                        role: 'assistant',
                        content: errorMessage,
                        timestamp: new Date().toISOString(),
                        isError: true,
                        originalUserMessage: lastUserMessageRef.current
                    }];
                });
                if (!isOpen) {
                    setUnreadCount(count => count + 1);
                }
                setHasChatError(true);
            }
        } finally {
            setIsLoading(false);

            // Auto-sync session title if it's a new conversation
            if (currentUser && messages.length <= 4 && (!currentChatName || /^Chat \d/i.test(currentChatName))) {
                setIsGeneratingTitle(true);
                // Give the backend a moment to generate and save the title
                setTimeout(async () => {
                    await loadChatSessions();
                }, 1500);
            }
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success('Message copied to clipboard!');
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            toast.success('Message copied to clipboard!');
        }
    };

    // Handle code block copy button clicks (delegated)
    useEffect(() => {
        const handleCopyClick = (e) => {
            const btn = e.target.closest('.code-copy-btn');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();

                const codeAttr = btn.getAttribute('data-code');
                if (!codeAttr) return;

                try {
                    const code = decodeURIComponent(codeAttr);
                    if (code) {
                        copyToClipboard(code);

                        // Visual feedback: Change icon to checkmark temporarily
                        if (!btn.hasAttribute('data-original-html')) {
                            btn.setAttribute('data-original-html', btn.innerHTML);
                        }

                        const checkIcon = `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="1.2em" width="1.2em" xmlns="http://www.w3.org/2000/svg" class="text-green-400"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

                        btn.innerHTML = checkIcon;

                        setTimeout(() => {
                            if (btn && document.contains(btn)) {
                                btn.innerHTML = btn.getAttribute('data-original-html');
                            }
                        }, 2000);
                    }
                } catch (err) {
                    console.error('Failed to copy code:', err);
                }
            }
        };

        document.addEventListener('click', handleCopyClick);
        return () => document.removeEventListener('click', handleCopyClick);
    }, []);

    const retryMessage = async (originalMessage, messageIndex) => {
        if (!originalMessage || isLoading) return;

        // Check rate limit
        console.log('Frontend - Retry rate limit check:', { remaining: rateLimitInfo.remaining, role: rateLimitInfo.role, limit: rateLimitInfo.limit });
        if (rateLimitInfo.remaining <= 0 && rateLimitInfo.role !== 'rootadmin') {
            console.log('Frontend - Retry rate limit exceeded, showing sign-in modal');
            if (currentUser) {
                setShowSignInModal(true);
            } else {
                setShowSignInOverlay(true);
            }
            return;
        }

        setIsLoading(true);

        // Remove the error message
        setMessages(prev => prev.filter((_, index) => index !== messageIndex));

        try {
            const currentSessionId = getOrCreateSessionId();

            // Support cancelling with AbortController
            abortControllerRef.current?.abort();
            abortControllerRef.current = new AbortController();

            const response = await authenticatedFetch(`${API_BASE_URL}/api/gemini/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: originalMessage,
                    history: enableContextMemory ? messages.slice(-parseInt(contextWindow)) : messages.slice(-10), // Send context window messages
                    sessionId: currentSessionId,
                    tone: currentUser ? tone : 'neutral', // Send current tone setting or default for public users
                    responseLength: aiResponseLength, // Send response length setting
                    creativity: aiCreativity, // Send creativity level setting
                    temperature: temperature, // Send custom temperature
                    topP: topP, // Send custom topP
                    topK: topK, // Send custom topK
                    maxTokens: maxTokens, // Send custom max tokens
                    enableStreaming: false, // Force non-streaming for retries to ensure JSON response
                    enableContextMemory: enableContextMemory, // Send context memory preference
                    contextWindow: contextWindow, // Send context window size
                    enableSystemPrompts: enableSystemPrompts // Send system prompts preference
                }),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data && data.response && typeof data.response === 'string') {
                const trimmedResponse = data.response.trim();
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: trimmedResponse,
                    timestamp: new Date().toISOString()
                }]);

                // Update session ID if provided in response
                if (data.sessionId && data.sessionId !== sessionId) {
                    setSessionId(data.sessionId);
                    localStorage.setItem('gemini_session_id', data.sessionId);
                }

                // Refresh rate limit status after successful request
                fetchRateLimitStatus();
            } else {
                throw new Error('Invalid response structure from server');
            }
        } catch (error) {
            console.error('Error in retryMessage:', error);
            let errorMessage = 'Sorry, I\'m having trouble connecting right now. Please try again later.';

            if (error.name === 'AbortError') {
                // Request was cancelled - backend won't count it
                setIsLoading(false);
                // Refresh rate limit to get accurate count
                fetchRateLimitStatus();
                return;
            }

            // For technical errors, backend won't count them either
            // Just set appropriate error messages

            if (error.message.includes('timeout')) {
                errorMessage = 'Request timed out. The response is taking longer than expected. Please try again.';
            } else if (error.message.includes('HTTP error')) {
                errorMessage = 'Server error. Please try again later.';
            } else if (error.message.includes('Invalid response structure')) {
                errorMessage = 'I received an invalid response. Please try again.';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            }

            // Refresh rate limit to get accurate count after error
            fetchRateLimitStatus();

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: errorMessage,
                timestamp: new Date().toISOString(),
                isError: true,
                originalUserMessage: originalMessage
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Enhanced features helper functions
    const toggleBookmark = async (messageIndex, message) => {
        // Check if user is logged in
        if (!currentUser) {
            toast.error('Please sign in to bookmark messages');
            return;
        }

        const currentSessionId = getOrCreateSessionId();
        const bookmarkKey = `${currentSessionId}_${messageIndex}_${message.timestamp}`;
        const isBookmarked = bookmarkedMessages.some(bm => bm.key === bookmarkKey);

        try {

            if (isBookmarked) {
                // Remove bookmark
                const response = await authenticatedFetch(`${API_BASE_URL}/api/gemini/bookmark`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        sessionId: currentSessionId,
                        messageIndex,
                        messageTimestamp: message.timestamp
                    })
                });

                if (response.ok) {
                    // Reload bookmarks from backend
                    loadBookmarkedMessages(currentSessionId);
                    toast.success('Bookmark removed');
                } else {
                    toast.error('Failed to remove bookmark');
                }
            } else {
                // Add bookmark
                const response = await authenticatedFetch(`${API_BASE_URL}/api/gemini/bookmark`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        sessionId: currentSessionId,
                        messageIndex,
                        messageTimestamp: message.timestamp,
                        messageContent: message.content,
                        messageRole: message.role
                    })
                });

                if (response.ok) {
                    // Reload bookmarks from backend
                    loadBookmarkedMessages(currentSessionId);
                    toast.success('Message bookmarked');
                } else {
                    toast.error('Failed to bookmark message');
                }
            }
        } catch (error) {
            console.error('Error toggling bookmark:', error);
            toast.error('Failed to bookmark message');
        }
    };

    const saveRatingMeta = (ratingKey, meta) => {
        const currentSessionId = getOrCreateSessionId();
        const key = `gemini_rating_meta_${currentSessionId}`;
        const prev = JSON.parse(localStorage.getItem(key) || '{}');
        const next = { ...prev, [ratingKey]: meta };
        localStorage.setItem(key, JSON.stringify(next));
        setRatingMeta(next);
    };

    const loadRatingMeta = () => {
        const currentSessionId = getOrCreateSessionId();
        const key = `gemini_rating_meta_${currentSessionId}`;
        const obj = JSON.parse(localStorage.getItem(key) || '{}');
        setRatingMeta(obj);
    };
    const rateMessage = async (messageIndex, rating, feedback = null) => {
        // Authentication check removed to allow public ratings
        // if (!currentUser) { ... }

        const message = messages[messageIndex];
        if (!message) return;

        // Try to find the prompt associated with this message
        let prompt = message.originalUserMessage;
        if (!prompt && messageIndex > 0) {
            const prevMsg = messages[messageIndex - 1];
            if (prevMsg && prevMsg.role === 'user') {
                prompt = prevMsg.content;
            }
        }
        if (!prompt) prompt = "Unknown prompt"; // Fallback

        try {
            const currentSessionId = getOrCreateSessionId();

            const response = await authenticatedFetch(`${API_BASE_URL}/api/gemini/rate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: currentSessionId,
                    messageIndex,
                    messageTimestamp: message.timestamp,
                    rating,
                    feedback,
                    messageContent: message.content,
                    messageRole: message.role,
                    prompt
                })
            });

            if (response.ok) {
                const ratingKey = `${messageIndex}_${message.timestamp}`;
                const newRatings = { ...messageRatings, [ratingKey]: rating };
                setMessageRatings(newRatings);
                localStorage.setItem('gemini_ratings', JSON.stringify(newRatings));
                // store meta locally for admin view
                saveRatingMeta(ratingKey, {
                    feedback: feedback || '',
                    user: currentUser?.username || currentUser?.email || 'Public Guest',
                    time: new Date().toISOString(),
                    messagePreview: (message.content || '').slice(0, 140)
                });
                toast.success(rating === 'up' ? 'Thanks for the feedback!' : 'Feedback recorded');
            } else {
                toast.error('Failed to save rating');
            }
        } catch (error) {
            console.error('Error rating message:', error);
            toast.error('Failed to save rating');
        }
    };

    const openReportModal = (message, index) => {
        setReportingMessage({ ...message, index });
        setReportStep(1);
        setSelectedCategory('');
        setSelectedSubCategory('');
        setReportDescription('');
        setShowReportModal(true);
    };

    const handleReportSubmit = async () => {
        if (!reportingMessage) return;

        if (!selectedCategory) {
            toast.error("Please select a category");
            return;
        }
        if (!selectedSubCategory) {
            toast.error("Please select a sub-category");
            return;
        }

        // Apply Client-Side Rate Limiting for Reports (60 seconds)
        const lastReportTimeStr = localStorage.getItem('lastReportMessageTime');
        const now = new Date().getTime();
        const REPORT_COOLDOWN_MS = 60000; // 60 seconds

        if (lastReportTimeStr && now - parseInt(lastReportTimeStr, 10) < REPORT_COOLDOWN_MS) {
            const timeLeft = Math.ceil((REPORT_COOLDOWN_MS - (now - parseInt(lastReportTimeStr, 10))) / 1000);
            toast.error(`Please wait ${timeLeft} seconds before submitting another report.`);
            return;
        }

        // Get the prompt content
        const promptContent = reportingMessage.originalUserMessage ||
            (reportingMessage.index > 0 && messages[reportingMessage.index - 1] ? messages[reportingMessage.index - 1].content : 'Unknown prompt');

        setIsReporting(true);
        try {
            const msgId = reportingMessage._id || `session_${getOrCreateSessionId()}_${reportingMessage.index}_${new Date(reportingMessage.timestamp).getTime()}`;

            const response = await authenticatedFetch(`${API_BASE_URL}/api/report-message/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messageId: msgId,
                    messageContent: reportingMessage.content,
                    prompt: promptContent,
                    category: selectedCategory,
                    subCategory: selectedSubCategory,
                    description: reportDescription
                })
            });

            if (response.ok) {
                localStorage.setItem('lastReportMessageTime', now.toString()); // Record successful report time
                setReportStep(4);
                
                // Auto-close after 3 seconds
                setTimeout(() => {
                    setShowReportModal(false);
                    setReportStep(1);
                    setSelectedCategory('');
                    setSelectedSubCategory('');
                    setReportDescription('');
                    setReportingMessage(null);
                }, 3000);
            } else {
                const data = await response.json();
                toast.error(data.message || 'Failed to submit report');
            }
        } catch (error) {
            console.error('Error submitting report:', error);
            toast.error('Failed to submit report');
        } finally {
            setIsReporting(false);
        }
    };

    // Open dislike modal flow
    const openDislikeModal = (index) => {
        // If already disliked, do not open modal again
        const msg = messages[index];
        if (msg && messageRatings[`${index}_${msg.timestamp}`] === 'down') {
            toast.info('You already provided feedback for this response.');
            return;
        }
        setDislikeMessageIndex(index);
        setDislikeFeedbackOption('');
        setDislikeFeedbackText('');
        setShowDislikeModal(true);
    };
    const submitDislike = async () => {
        if (!dislikeFeedbackOption) {
            toast.error('Please select a reason');
            return;
        }
        if (dislikeFeedbackOption === 'Other' && !dislikeFeedbackText.trim()) {
            toast.error('Please provide details for Other');
            return;
        }
        const idx = dislikeMessageIndex;
        setDislikeSubmitting(true);
        const feedback = dislikeFeedbackOption === 'Other' ? `Other: ${dislikeFeedbackText.trim()}` : dislikeFeedbackOption;
        await rateMessage(idx, 'down', feedback);
        setDislikeSubmitting(false);
        setShowDislikeModal(false);
    };

    const shareMessage = async (message) => {
        let sharePath = '/ai';
        if (currentUser) {
            sharePath = (currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? '/admin/ai' : '/user/ai';
        }

        const shareUrl = `${window.location.origin}${sharePath}`;

        setSocialShareConfig({
            url: shareUrl,
            title: 'SetuAI Response 🤖',
            description: message.content.substring(0, 200) + (message.content.length > 200 ? '...' : '')
        });
        setShowSocialShare(true);
    };

    // Edit message functions
    const startEditingMessage = (messageIndex, messageContent) => {
        setEditingMessageIndex(messageIndex);
        setEditingMessageContent(messageContent);
    };

    const cancelEditingMessage = () => {
        setEditingMessageIndex(null);
        setEditingMessageContent('');
    };

    const submitEditedMessage = async (messageIndex) => {
        if (!editingMessageContent.trim()) {
            toast.error('Message cannot be empty');
            return;
        }

        try {
            // Update the user message in the messages array
            const updatedMessages = [...messages];
            updatedMessages[messageIndex] = {
                ...updatedMessages[messageIndex],
                content: editingMessageContent.trim()
            };
            setMessages(updatedMessages);

            // Remove the assistant's response that came after this user message
            const messagesToKeep = updatedMessages.slice(0, messageIndex + 1);
            setMessages(messagesToKeep);

            // Clear editing state first
            setEditingMessageIndex(null);
            setEditingMessageContent('');

            // Send the edited message directly to API without using input field
            await sendEditedMessageToAPI(editingMessageContent.trim());

            toast.success('Message updated and sent');
        } catch (error) {
            console.error('Error submitting edited message:', error);
            toast.error('Failed to send edited message');
        }
    };

    // Send edited message directly to API (using same format as handleSubmit)
    const sendEditedMessageToAPI = async (messageContent) => {
        if (!messageContent.trim() || isLoading) return;

        // Check rate limit
        if (rateLimitInfo.remaining <= 0 && rateLimitInfo.role !== 'rootadmin') {
            toast.error('Rate limit exceeded. Please wait before sending more messages.');
            return;
        }

        setIsLoading(true);

        try {
            const currentSessionId = getOrCreateSessionId();
            console.log('Sending edited message to SetuAI:', messageContent, 'Session:', currentSessionId);

            // Support cancelling with AbortController
            abortControllerRef.current?.abort();
            abortControllerRef.current = new AbortController();

            const response = await authenticatedFetch(`${API_BASE_URL}/api/gemini/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: messageContent,
                    history: messages.slice(-10), // Send last 10 messages for context
                    sessionId: currentSessionId,
                    tone: currentUser ? tone : 'neutral', // Send current tone setting or default for public users
                    responseLength: aiResponseLength, // Send response length setting
                    creativity: aiCreativity, // Send creativity level setting
                    enableStreaming: false // Force non-streaming to ensure JSON response when editing
                }),
                signal: abortControllerRef.current.signal
            });

            console.log('Edited message response status:', response.status);
            console.log('Edited message response ok:', response.ok);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Edited message response data received:', data);
            console.log('Edited message response content length:', data.response ? data.response.length : 0);

            // Validate response structure
            if (data && data.response && typeof data.response === 'string') {
                const trimmedResponse = data.response.trim();
                console.log('Setting edited message with response length:', trimmedResponse.length);
                console.log('Edited message response content:', trimmedResponse);
                setMessages(prev => {
                    const newMessages = [...prev, { role: 'assistant', content: trimmedResponse, timestamp: new Date().toISOString() }];
                    console.log('Updated messages array length:', newMessages.length);
                    console.log('Last message:', newMessages[newMessages.length - 1]);
                    return newMessages;
                });

                // Play sound when edited message response is received
                playSound('message-received.mp3');

                // Update session ID if provided in response
                if (data.sessionId && data.sessionId !== sessionId) {
                    setSessionId(data.sessionId);
                    localStorage.setItem('gemini_session_id', data.sessionId);
                }

                // Refresh rate limit status after successful request
                fetchRateLimitStatus();

                // Scroll to bottom to show the new response
                setTimeout(() => {
                    scrollToBottom();
                }, 100);
            } else {
                console.error('Invalid response structure for edited message:', data);
                throw new Error('Invalid response structure from server');
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                // Request was cancelled - backend won't count it
                console.log('Edited message request was aborted');
                // Refresh rate limit to get accurate count
                fetchRateLimitStatus();
                return;
            }
            console.error('Error in sendEditedMessageToAPI:', error);

            let errorMessage = 'Sorry, I\'m having trouble connecting right now. Please try again later.';

            // For technical errors, backend won't count them either
            // Just set appropriate error messages

            if (error.message.includes('timeout')) {
                errorMessage = 'Request timed out. The response is taking longer than expected. Please try again.';
            } else if (error.message.includes('HTTP error')) {
                errorMessage = 'Server error. Please try again later.';
            } else if (error.message.includes('Invalid response structure')) {
                errorMessage = 'I received an invalid response. Please try again.';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            }

            // Refresh rate limit to get accurate count after error
            fetchRateLimitStatus();

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: errorMessage,
                timestamp: new Date().toISOString(),
                isError: true
            }]);
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };





    // Admin Reports Functions
    const fetchAdminReports = async () => {
        if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin')) return;

        try {
            setAdminReportsLoading(true);
            const query = adminReportsFilter !== 'all' ? `?status=${adminReportsFilter}` : '';
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/report-message/getreports${query}`);
            const data = await res.json();
            if (res.ok) {
                setAdminReports(data.reports);
            } else {
                toast.error(data.message || 'Failed to fetch reports');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error fetching reports');
        } finally {
            setAdminReportsLoading(false);
        }
    };

    // Use effect to re-fetch when filter changes if modal is open
    useEffect(() => {
        if (showAdminReportsModal) {
            fetchAdminReports();
        }
    }, [adminReportsFilter]);

    const handleAdminReportUpdate = async (reportId, status, notes = null) => {
        try {
            const body = { status };
            if (notes !== null) body.adminNotes = notes;

            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/report-message/update/${reportId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Report updated successfully');
                setAdminReports(prev => prev.map(r => r._id === reportId ? data : r));
                if (showAdminNoteModal) {
                    setShowAdminNoteModal(false);
                    setAdminNoteText('');
                    setSelectedAdminReport(null);
                }
                // Refresh list if filtering by status and status changed (and not 'all')
                if (adminReportsFilter !== 'all' && status !== adminReportsFilter) {
                    setAdminReports(prev => prev.filter(r => r._id !== reportId));
                }
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.error(error);
            toast.error('Error updating report');
        }
    };

    const handleAdminReportDelete = (reportId) => {
        setSelectedReportToDelete(reportId);
        setShowReportDeleteModal(true);
    };

    const confirmDeleteReport = async () => {
        if (!selectedReportToDelete) return;
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/report-message/delete/${selectedReportToDelete}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                toast.success('Report deleted successfully');
                setAdminReports(prev => prev.filter(r => r._id !== selectedReportToDelete));
                setShowReportDeleteModal(false);
                setSelectedReportToDelete(null);
            } else {
                const data = await res.json();
                toast.error(data.message);
            }
        } catch (error) {
            console.error(error);
            toast.error('Error deleting report');
        }
    };

    const handleRatingDelete = (ratingId) => {
        setSelectedRatingToDelete(ratingId);
        setShowRatingDeleteModal(true);
    };

    const confirmDeleteRating = async () => {
        if (!selectedRatingToDelete) return;
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/gemini/rating/${selectedRatingToDelete}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Rating deleted successfully');
                setAllRatings(prev => prev.filter(r => r.id !== selectedRatingToDelete));

                // If the deleted rating was being viewed in the detail modal, close it
                if (selectedRating && selectedRating.id === selectedRatingToDelete) {
                    setShowRatingDetailModal(false);
                    setSelectedRating(null);
                }

                setShowRatingDeleteModal(false);
                setSelectedRatingToDelete(null);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.error(error);
            toast.error('Error deleting rating');
        }
    };

    // Handle keyboard shortcuts for editing
    // Handle keyboard shortcuts for editing
    const handleEditKeyDown = (e, messageIndex) => {
        if (showEditPropertySuggestions) {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedEditSuggestionIndex(prev =>
                        prev < propertySuggestions.length - 1 ? prev + 1 : 0
                    );
                    return;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedEditSuggestionIndex(prev =>
                        prev > 0 ? prev - 1 : propertySuggestions.length - 1
                    );
                    return;
                case 'Enter':
                    e.preventDefault();
                    if (selectedEditSuggestionIndex >= 0 && propertySuggestions[selectedEditSuggestionIndex]) {
                        handleEditSuggestionSelect(propertySuggestions[selectedEditSuggestionIndex]);
                    }
                    return;
                case 'Escape':
                    setShowEditPropertySuggestions(false);
                    return;
            }
        }

        // Standard Chat Behavior for Editing:
        // Enter -> Submit
        // Ctrl+Enter -> New Line
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Shift+Enter handles itself natively (new line)
                return;
            } else if (e.ctrlKey) {
                // Ctrl+Enter needs manual handling to act as new line
                e.preventDefault();
                const start = e.target.selectionStart;
                const end = e.target.selectionEnd;
                const value = editingMessageContent; // Use the editing state variable
                const newValue = value.substring(0, start) + '\n' + value.substring(end);

                setEditingMessageContent(newValue);

                // Restore cursor position and resize
                setTimeout(() => {
                    const textarea = document.getElementById(`edit-textarea-${messageIndex}`);
                    if (textarea) {
                        textarea.selectionStart = textarea.selectionEnd = start + 1;
                        textarea.style.height = 'auto';
                        textarea.style.height = textarea.scrollHeight + 'px';
                    }
                }, 0);
            } else {
                // Enter alone submits
                e.preventDefault();
                submitEditedMessage(messageIndex);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEditingMessage();
        }
    };

    // Generate session name based on first user message
    const generateSessionName = (message) => {
        // Remove tone prefix if present
        const cleanMessage = message.replace(/^\[Tone: \w+\]\s*/, '');

        // Truncate to reasonable length (max 50 characters)
        let sessionName = cleanMessage.trim();
        if (sessionName.length > 50) {
            sessionName = sessionName.substring(0, 47) + '...';
        }

        // If message is too short or empty, use a default name
        if (sessionName.length < 3) {
            sessionName = 'New Chat';
        }

        return sessionName;
    };

    // Update session name via API
    const updateSessionName = async (sessionId, name) => {
        if (!currentUser || !sessionId || !name) return;

        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${sessionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });

            if (response.ok) {
                console.log('Session name updated successfully:', name);
                // Refresh chat sessions to show updated name
                await loadChatSessions();
            } else {
                console.error('Failed to update session name:', response.status);
            }
        } catch (error) {
            console.error('Error updating session name:', error);
        }
    };

    const loadChatSessions = async () => {
        if (!currentUser) return [];

        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/api/gemini/sessions`);

            if (response.ok) {
                const data = await response.json();
                const sessions = data.sessions || [];
                setChatSessions(sessions);

                // Sync currentChatName with the active session
                const activeSessionId = getOrCreateSessionId();
                const activeSession = sessions.find(s => s.sessionId === activeSessionId);
                if (activeSession) {
                    const isGeneric = !activeSession.name || /^Chat \d/i.test(activeSession.name) || activeSession.name.toLowerCase() === 'new chat';
                    if (!isGeneric) {
                        if (activeSession.name !== currentChatName) {
                            setCurrentChatName(activeSession.name);
                        }
                        setIsGeneratingTitle(false);
                    } else if (isGeneratingTitle && (!activeSession.name || messages.length > 4)) {
                        // Stop skeleton if messages pass threshold or fetch returned nothing
                        setIsGeneratingTitle(false);
                    }
                }

                return sessions;
            } else {
                console.error('Failed to load chat sessions:', response.status);
                return [];
            }
        } catch (error) {
            console.error('Error loading chat sessions:', error);
            return [];
        }
    };

    const loadSessionHistory = async (sessionId) => {
        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${sessionId}`);

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.messages && Array.isArray(data.data.messages)) {
                    // Ensure the first message is always the default welcome message
                    const defaultMessage = {
                        role: 'assistant',
                        content: 'Hello! I\'m SetuAI your AI assistant powered by Groq and co-powered by Sentinel v2.0 Neural Engine (TensorFlow). How can I help you with your real estate needs today?',
                        timestamp: new Date().toISOString()
                    };

                    let sessionMessages = data.data.messages;
                    if (sessionMessages.length === 0 || sessionMessages[0].content !== defaultMessage.content) {
                        sessionMessages = [defaultMessage, ...sessionMessages];
                    }

                    setMessages(sessionMessages);
                    setSessionId(sessionId);
                    localStorage.setItem('gemini_session_id', sessionId);

                    // Set current chat name from the sessions list if available
                    const session = chatSessions.find(s => s.sessionId === sessionId);
                    if (session && session.name && !/^Chat \d/i.test(session.name)) {
                        setCurrentChatName(session.name);
                    } else {
                        setCurrentChatName('');
                    }

                    // Load ratings for this session
                    await loadMessageRatings(sessionId);

                    // Load bookmarks for this session
                    await loadBookmarkedMessages(sessionId);

                    toast.success('Chat loaded successfully');
                }
            }
        } catch (error) {
            console.error('Error loading chat:', error);
            toast.error('Failed to load chat');
        }
    };

    const loadMessageRatings = async (sessionId) => {
        if (!currentUser || !sessionId) return;

        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/api/gemini/ratings/${sessionId}`);

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.ratings) {
                    setMessageRatings(data.ratings);
                    localStorage.setItem('gemini_ratings', JSON.stringify(data.ratings));
                }
            }
        } catch (error) {
            console.error('Error loading message ratings:', error);
        }
    };

    // Load bookmarked messages for current session
    const loadBookmarkedMessages = async (sessionId) => {
        if (!currentUser || !sessionId) return;

        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/api/gemini/bookmarks/${sessionId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.bookmarks) {
                    // Convert backend bookmarks to frontend format
                    const formattedBookmarks = data.bookmarks.map(bookmark => ({
                        key: `${sessionId}_${bookmark.messageIndex}_${bookmark.messageTimestamp}`,
                        content: bookmark.messageContent,
                        timestamp: bookmark.messageTimestamp,
                        role: bookmark.messageRole,
                        sessionId: sessionId
                    }));
                    setBookmarkedMessages(formattedBookmarks);
                }
            }
        } catch (error) {
            console.error('Error loading bookmarked messages:', error);
        }
    };

    const createNewSession = async () => {
        if (!currentUser) {
            toast.info('Please log in to create new chat');
            return;
        }

        try {

            // Always save the current session to history before creating new one
            const currentSessionId = getOrCreateSessionId();
            if (messages.length > 0) {
                // Save current session to history
                const saveResponse = await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${currentSessionId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        messages: messages,
                        totalMessages: messages.length
                    })
                });

                if (!saveResponse.ok) {
                    console.error('Failed to save current chat');
                }
            }

            // Now create a new session
            const response = await authenticatedFetch(`${API_BASE_URL}/api/gemini/sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.sessionId) {
                    // Set the new session ID
                    setSessionId(data.sessionId);
                    localStorage.setItem('gemini_session_id', data.sessionId);

                    // Reset messages to default welcome message
                    const defaultMessage = {
                        role: 'assistant',
                        content: 'Hello! I\'m SetuAI your AI assistant powered by Groq and co-powered by Sentinel v2.0 Neural Engine (TensorFlow). How can I help you with your real estate needs today?',
                        timestamp: new Date().toISOString()
                    };
                    setMessages([defaultMessage]);
                    setCurrentChatName('');
                    setDisplayedTitle('SetuAI');
                    setIsGeneratingTitle(false);

                    // Clear ratings for new session
                    setMessageRatings({});
                    localStorage.setItem('gemini_ratings', JSON.stringify({}));

                    // Clear bookmarks for new session
                    setBookmarkedMessages([]);

                    // Refresh chat sessions
                    await loadChatSessions();

                    toast.success('New chat created');
                }
            } else {
                toast.error('Failed to create new chat');
            }
        } catch (error) {
            console.error('Error creating new chat:', error);
            toast.error('Failed to create new chat');
        }
    };
    const deleteSession = async (sessionId) => {
        if (!currentUser) {
            toast.error('Please log in to delete chats');
            return;
        }

        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/api/gemini/sessions/${sessionId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Refresh chat sessions
                    await loadChatSessions();
                    toast.success('Chat deleted successfully');
                }
            } else {
                toast.error('Failed to delete chat');
            }
        } catch (error) {
            console.error('Error deleting chat:', error);
            toast.error('Failed to delete chat');
        }
    };

    const simulateTyping = (text) => {
        setIsTyping(true);
        setTypingText('');
        let index = 0;

        const typeInterval = setInterval(() => {
            if (index < text.length) {
                setTypingText(text.substring(0, index + 1));
                index++;
            } else {
                clearInterval(typeInterval);
                setIsTyping(false);
            }
        }, 30);
    };

    const highlightMessage = (bookmarkKey) => {
        // Find the message index by bookmark key (new format includes session ID)
        const messageIndex = messages.findIndex((message, index) => {
            const currentSessionId = getOrCreateSessionId();
            const key = `${currentSessionId}_${index}_${message.timestamp}`;
            return key === bookmarkKey;
        });

        if (messageIndex !== -1) {
            setHighlightedMessage(messageIndex);
            // Scroll to the message
            setTimeout(() => {
                const messageElement = document.querySelector(`[data-message-index="${messageIndex}"]`);
                if (messageElement) {
                    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);

            // Remove highlight after 3 seconds
            setTimeout(() => {
                setHighlightedMessage(null);
            }, 3000);
        }
    };

    // Voice Input Handling using Web Speech API
    const [isListening, setIsListening] = useState(false);
    const [isProcessingVoice, setIsProcessingVoice] = useState(false);
    const recognitionRef = useRef(null);
    const transcriptAccumulator = useRef('');

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    const toggleVoiceInput = () => {
        if (!currentUser) {
            toast.info('Please login to use voice input');
            return;
        }

        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    const startListening = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            toast.error('Voice input is supported only in Chrome, Edge, and Safari.');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        // Continuous listening so it doesn't stop automatically on silence
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = navigator.language || 'en-US'; // Use browser language preferencerecognition.lang = 'en-US';

        transcriptAccumulator.current = ''; // Reset accumulator

        recognition.onstart = () => {
            setIsListening(true);
            setIsProcessingVoice(false);
            toast.info('Listening... Speak now', { autoClose: 2000 });
        };

        recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            // Iterate through results
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            // Append final results to our accumulator
            if (finalTranscript) {
                transcriptAccumulator.current += (transcriptAccumulator.current ? ' ' : '') + finalTranscript;
            }

            // Show real-time feedback in the input box
            // Combine already accumulated final text with current interim text
            const currentDisplayText = (transcriptAccumulator.current + (transcriptAccumulator.current && interimTranscript ? ' ' : '') + interimTranscript).trim();
            setInputMessage(currentDisplayText);
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            // If it's a "no-speech" error and we are supposedly listening continuously, we might want to ignore or restart.
            // But for now, we'll just stop to avoid loops.
            if (event.error !== 'no-speech') {
                setIsListening(false);
                setIsProcessingVoice(false);
                if (event.error === 'not-allowed') {
                    toast.error('Microphone access denied.');
                }
            }
        };

        recognition.onend = () => {
            // Check if we stopped intentionally or if browser stopped it
            // If we are still "isListening" in state but it ended, and it wasn't manual stop (we can trigger manual stop by checking processing state?)
            // Actually, simplified logic: onend triggers final processing if we were listening.

            // Do nothing on onend if it's continuous; we rely on `stopListening` to finalize.
            // But if it stops unexpectedly (silence), we might want to restart if we were truly in "always on" mode.
            // For now, we accept the stop to avoid infinite loops, but we allow user to see what was captured.
            if (isListening && !isProcessingVoice) {
                setIsListening(false);
                setIsProcessingVoice(false);

                // Keep whatever is in the input box (which now includes final + interim that became final effectively)
                // We don't need to call processVoiceResult anymore because onresult updates input directly.
            }

            if (isListening && !isProcessingVoice) {
                // Unexpected stop (e.g. network error / silence timeout)
                // We can treat this as "done" or try to restart.
                // Let's treat it as "done" for safety, or restart if we want truly "continuous" until click.
                // Browsers often kill continuous recognition after ~60s.
                // Let's just stop and process.
                setIsListening(false);
                processVoiceResult();
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            setIsProcessingVoice(true); // Show loading state
            recognitionRef.current.stop(); // This will trigger onend

            // We'll process result in onend, or force it here if onend is too slow?
            // onend is reliable. But we need to distinguish manual stop.
            // We set isProcessingVoice = true.

            // Wait for a brief moment to allow final results to trickle in, then process
            setTimeout(() => {
                processVoiceResult(); // Just final polish
                setIsListening(false);
            }, 300);
        } else {
            setIsListening(false);
        }
    };

    const processVoiceResult = () => {
        // Since we are updating inputMessage in real-time in onresult, 
        // there's less need to "process" strictly here, but we can ensure cleanup.
        // We might want to remove trailing whitespace.
        setInputMessage(prev => prev.trim());
        setIsProcessingVoice(false);
    };

    const handleFileUpload = async (event) => {
        const files = Array.from(event.target.files);

        if (files.length === 0) {
            return;
        }

        const maxSize = 10 * 1024 * 1024; // 10MB
        const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        const validAudioTypes = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac', 'audio/ogg', 'audio/webm'];
        const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/mov', 'video/mkv'];
        const validDocTypes = ['application/pdf', 'text/plain', 'text/csv', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

        const allValidTypes = [...validImageTypes, ...validAudioTypes, ...validVideoTypes, ...validDocTypes];

        const validFiles = [];
        const rejectedFiles = [];

        files.forEach(file => {
            if (file.size > maxSize) {
                rejectedFiles.push(`${file.name} (too large - max 10MB)`);
            } else if (!allValidTypes.includes(file.type)) {
                rejectedFiles.push(`${file.name} (unsupported format)`);
            } else {
                validFiles.push(file);
            }
        });

        // Show error messages for rejected files
        if (rejectedFiles.length > 0) {
            toast.error(`Rejected files: ${rejectedFiles.join(', ')}`);
        }

        // Upload valid files immediately and close modal
        if (validFiles.length > 0) {
            await uploadFilesAndSend(validFiles);
            setShowFileUpload(false);
        }

        // Clear the input so the same file can be selected again
        event.target.value = '';
    };
    // Upload files to Cloudinary and send to chat
    const uploadFilesAndSend = async (files) => {
        try {
            setUploadingFile(true);
            setUploadProgress(0);

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setUploadProgress(Math.round(((i + 1) / files.length) * 100));

                let uploadEndpoint = '';
                let formData = new FormData();

                // Determine upload endpoint based on file type
                if (file.type.startsWith('image/')) {
                    uploadEndpoint = '/api/upload/image';
                    formData.append('image', file);
                } else if (file.type.startsWith('audio/')) {
                    uploadEndpoint = '/api/upload/audio';
                    formData.append('audio', file);
                } else if (file.type.startsWith('video/')) {
                    uploadEndpoint = '/api/upload/video';
                    formData.append('video', file);
                } else {
                    uploadEndpoint = '/api/upload/document';
                    formData.append('document', file);
                }

                // Upload to Cloudinary
                const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}${uploadEndpoint}`, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    throw new Error(`Failed to upload ${file.name}`);
                }

                const uploadData = await response.json();

                // Send to Gemini chat with file context
                const fileType = file.type.startsWith('image/') ? 'image' :
                    file.type.startsWith('audio/') ? 'audio' :
                        file.type.startsWith('video/') ? 'video' : 'document';

                const fileUrl = uploadData.imageUrl || uploadData.audioUrl || uploadData.videoUrl || uploadData.documentUrl;

                // Create a message with file context
                const messageWithFile = `I've uploaded a ${fileType} file: ${file.name}. Please analyze it and help me with it. File URL: ${fileUrl}`;

                // Add to input and auto-send
                setInputMessage(messageWithFile);

                // Auto-submit after a short delay
                setTimeout(() => {
                    handleSubmit(new Event('submit'));
                }, 100);
            }

            toast.success(`${files.length} file(s) uploaded and sent successfully`);
        } catch (error) {
            console.error('File upload error:', error);
            toast.error('Failed to upload files');
        } finally {
            setUploadingFile(false);
            setUploadProgress(0);
        }
    };

    const removeUploadedFile = (index) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    };



    // Helper functions for new settings
    const updateFontSize = (size) => {
        setFontSize(size);
        setUserSetting('gemini_font_size', size);
    };

    const updateMessageDensity = (density) => {
        setMessageDensity(density);
        setUserSetting('gemini_message_density', density);
    };

    const updateAutoScroll = (enabled) => {
        setAutoScroll(enabled);
        setUserSetting('gemini_auto_scroll', enabled.toString());
    };

    const updateShowTimestamps = (enabled) => {
        setShowTimestamps(enabled);
        setUserSetting('gemini_show_timestamps', enabled.toString());
    };

    const updateAiResponseLength = (length) => {
        setAiResponseLength(length);
        setUserSetting('gemini_response_length', length);
    };

    const updateAiCreativity = (creativity) => {
        setAiCreativity(creativity);
        setUserSetting('gemini_creativity', creativity);
    };

    const updateSoundEnabled = (enabled) => {
        setSoundEnabled(enabled);
        setUserSetting('gemini_sound_enabled', enabled.toString());
    };

    const updateTypingSounds = (enabled) => {
        setTypingSounds(enabled);
        setUserSetting('gemini_typing_sounds', enabled.toString());
    };

    const updateDataRetention = (days) => {
        setDataRetention(days);
        setUserSetting('gemini_data_retention', days);
    };

    // Advanced Settings Helper Functions
    const updateAutoSave = (enabled) => {
        setAutoSave(enabled);
        setUserSetting('gemini_auto_save', enabled.toString());
    };

    const updateMessageLimit = (limit) => {
        setMessageLimit(limit);
        setUserSetting('gemini_message_limit', limit);
    };

    const updateSessionTimeout = (timeout) => {
        setSessionTimeout(timeout);
        setUserSetting('gemini_session_timeout', timeout);
    };

    const updateEnableMarkdown = (enabled) => {
        setEnableMarkdown(enabled);
        setUserSetting('gemini_enable_markdown', enabled.toString());
    };

    const updateEnableCodeHighlighting = (enabled) => {
        setEnableCodeHighlighting(enabled);
        setUserSetting('gemini_code_highlighting', enabled.toString());
    };

    const updateEnableEmojiReactions = (enabled) => {
        setEnableEmojiReactions(enabled);
        setUserSetting('gemini_emoji_reactions', enabled.toString());
    };

    const updateEnableMessageSearch = (enabled) => {
        setEnableMessageSearch(enabled);
        setUserSetting('gemini_message_search', enabled.toString());
    };

    const updateEnableQuickActions = (enabled) => {
        setEnableQuickActions(enabled);
        setUserSetting('gemini_quick_actions', enabled.toString());
    };

    const updateEnableSmartSuggestions = (enabled) => {
        setEnableSmartSuggestions(enabled);
        setUserSetting('gemini_smart_suggestions', enabled.toString());
    };

    const updateEnableTypingIndicator = (enabled) => {
        setEnableTypingIndicator(enabled);
        setUserSetting('gemini_typing_indicator', enabled.toString());
    };

    // Accessibility Settings Helper Functions
    const updateHighContrast = (enabled) => {
        setHighContrast(enabled);
        setUserSetting('gemini_high_contrast', enabled.toString());
    };

    const updateReducedMotion = (enabled) => {
        setReducedMotion(enabled);
        setUserSetting('gemini_reduced_motion', enabled.toString());
    };

    const updateScreenReaderSupport = (enabled) => {
        setScreenReaderSupport(enabled);
        setUserSetting('gemini_screen_reader', enabled.toString());
    };

    const updateLargeText = (enabled) => {
        setLargeText(enabled);
        setUserSetting('gemini_large_text', enabled.toString());
    };

    const updateKeyboardNavigation = (enabled) => {
        setKeyboardNavigation(enabled);
        setUserSetting('gemini_keyboard_nav', enabled.toString());
    };

    // Performance Settings Helper Functions
    const updateMessageCaching = (enabled) => {
        setMessageCaching(enabled);
        setUserSetting('gemini_message_caching', enabled.toString());
    };

    const updateLazyLoading = (enabled) => {
        setLazyLoading(enabled);
        setUserSetting('gemini_lazy_loading', enabled.toString());
    };

    const updateImageOptimization = (enabled) => {
        setImageOptimization(enabled);
        setUserSetting('gemini_image_optimization', enabled.toString());
    };

    const updatePreloadMessages = (enabled) => {
        setPreloadMessages(enabled);
        setUserSetting('gemini_preload_messages', enabled.toString());
    };

    const updateBatchOperations = (enabled) => {
        setBatchOperations(enabled);
        setUserSetting('gemini_batch_operations', enabled.toString());
    };

    // Privacy Settings Helper Functions
    const updateEnableAnalytics = (enabled) => {
        setEnableAnalytics(enabled);
        setUserSetting('gemini_analytics', enabled.toString());
    };

    const updateEnableErrorReporting = (enabled) => {
        setEnableErrorReporting(enabled);
        setUserSetting('gemini_error_reporting', enabled.toString());
    };

    const updateEnableUsageTracking = (enabled) => {
        setEnableUsageTracking(enabled);
        setUserSetting('gemini_usage_tracking', enabled.toString());
    };

    const updateEnableCrashReports = (enabled) => {
        setEnableCrashReports(enabled);
        setUserSetting('gemini_crash_reports', enabled.toString());
    };

    const updateEnablePerformanceMonitoring = (enabled) => {
        setEnablePerformanceMonitoring(enabled);
        setUserSetting('gemini_performance_monitoring', enabled.toString());
    };

    // Advanced AI Settings Helper Functions
    const updateTemperature = (value) => {
        setTemperature(value);
        setUserSetting('gemini_temperature', value);
    };

    const updateTopP = (value) => {
        setTopP(value);
        setUserSetting('gemini_top_p', value);
    };

    const updateTopK = (value) => {
        setTopK(value);
        setUserSetting('gemini_top_k', value);
    };

    const updateMaxTokens = (value) => {
        setMaxTokens(value);
        setUserSetting('gemini_max_tokens', value);
    };

    const updateEnableStreaming = (enabled) => {
        setEnableStreaming(enabled);
        setUserSetting('gemini_streaming', enabled.toString());
    };

    const updateEnableContextMemory = (enabled) => {
        setEnableContextMemory(enabled);
        setUserSetting('gemini_context_memory', enabled.toString());
    };

    const updateContextWindow = (value) => {
        setContextWindow(value);
        setUserSetting('gemini_context_window', value);
    };

    const updateEnableSystemPrompts = (enabled) => {
        setEnableSystemPrompts(enabled);
        setUserSetting('gemini_system_prompts', enabled.toString());
    };

    // Notification Settings Helper Functions
    const updateEnableDesktopNotifications = (enabled) => {
        setEnableDesktopNotifications(enabled);
        setUserSetting('gemini_desktop_notifications', enabled.toString());
    };

    const updateEnableEmailNotifications = (enabled) => {
        setEnableEmailNotifications(enabled);
        setUserSetting('gemini_email_notifications', enabled.toString());
    };

    const updateEnablePushNotifications = (enabled) => {
        setEnablePushNotifications(enabled);
        setUserSetting('gemini_push_notifications', enabled.toString());
    };

    const updateNotificationSound = (sound) => {
        setNotificationSound(sound);
        setUserSetting('gemini_notification_sound', sound);
    };

    const updateNotificationFrequency = (frequency) => {
        setNotificationFrequency(frequency);
        setUserSetting('gemini_notification_frequency', frequency);
    };

    // UI/UX Settings Helper Functions
    const updateEnableAnimations = (enabled) => {
        setEnableAnimations(enabled);
        setUserSetting('gemini_animations', enabled.toString());
    };

    const updateEnableHoverEffects = (enabled) => {
        setEnableHoverEffects(enabled);
        setUserSetting('gemini_hover_effects', enabled.toString());
    };

    const updateEnableTransitions = (enabled) => {
        setEnableTransitions(enabled);
        setUserSetting('gemini_transitions', enabled.toString());
    };

    const updateEnableTooltips = (enabled) => {
        setEnableTooltips(enabled);
        setUserSetting('gemini_tooltips', enabled.toString());
    };

    const updateEnableKeyboardShortcuts = (enabled) => {
        setEnableKeyboardShortcuts(enabled);
        setUserSetting('gemini_keyboard_shortcuts', enabled.toString());
    };

    const updateEnableDragAndDrop = (enabled) => {
        setEnableDragAndDrop(enabled);
        setUserSetting('gemini_drag_drop', enabled.toString());
    };

    const updateEnableRightClickMenu = (enabled) => {
        setEnableRightClickMenu(enabled);
        setUserSetting('gemini_right_click', enabled.toString());
    };

    const updateEnableContextMenu = (enabled) => {
        setEnableContextMenu(enabled);
        setUserSetting('gemini_context_menu', enabled.toString());
    };

    const createCustomTheme = (primaryColor, secondaryColor) => {
        const customThemeData = {
            primary: `from-${primaryColor}-600 to-${secondaryColor}-600`,
            secondary: `bg-${primaryColor}-50`,
            accent: `text-${primaryColor}-600`,
            border: `border-${primaryColor}-200`
        };
        setCustomTheme(customThemeData);
        setUserSetting('gemini_custom_theme', JSON.stringify(customThemeData));
        setSelectedTheme('custom');
        setUserSetting('gemini_theme', 'custom');
    };

    // Sound playing functions
    const playSound = (soundFile) => {
        if (!soundEnabled) return;
        try {
            const audio = new Audio(`/sounds/${soundFile}`);
            audio.volume = 0.3; // Lower volume to not be intrusive
            audio.play().catch(error => {
                console.warn('Could not play sound:', error);
            });
        } catch (error) {
            console.warn('Sound file not found or error playing sound:', error);
        }
    };

    const playTypingSound = () => {
        if (!soundEnabled || !typingSounds) return;
        try {
            const audio = new Audio('/sounds/typing.mp3');
            audio.volume = 0.2; // Even lower volume for typing
            audio.play().catch(error => {
                console.warn('Could not play typing sound:', error);
            });
        } catch (error) {
            console.warn('Typing sound file not found or error playing sound:', error);
        }
    };

    // Debounced typing sound function
    const handleTyping = () => {
        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Play typing sound immediately
        playTypingSound();

        // Set timeout to play sound again after 500ms of no typing
        typingTimeoutRef.current = setTimeout(() => {
            // This will be called if user stops typing for 500ms
        }, 500);
    };

    // Data retention cleanup function
    const cleanupOldData = async () => {
        try {
            if (dataRetention === '0') return; // Forever - no cleanup

            const retentionDays = parseInt(dataRetention);
            if (isNaN(retentionDays) || retentionDays <= 0) return; // Invalid retention days

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            console.log(`Data retention cleanup: removing data older than ${retentionDays} days (${cutoffDate.toISOString()})`);

            // Clean up old chat sessions
            if (currentUser) {
                loadChatSessions().then(async sessions => {
                    // Check if sessions is an array before filtering
                    if (Array.isArray(sessions) && sessions.length > 0) {
                        const sessionsToDelete = sessions.filter(session => {
                            try {
                                const sessionDate = new Date(session.createdAt || session.timestamp);
                                return sessionDate < cutoffDate;
                            } catch (error) {
                                console.warn('Invalid chat date:', session, error);
                                return false;
                            }
                        });

                        console.log(`Found ${sessionsToDelete.length} old chats to delete`);

                        // Delete chats with a small delay between each to avoid overwhelming the server
                        for (let i = 0; i < sessionsToDelete.length; i++) {
                            const session = sessionsToDelete[i];
                            try {
                                console.log(`Deleting session ${i + 1}/${sessionsToDelete.length}:`, session.sessionId);
                                await deleteSession(session.sessionId);

                                // Small delay between deletions
                                if (i < sessionsToDelete.length - 1) {
                                    await new Promise(resolve => setTimeout(resolve, 100));
                                }
                            } catch (error) {
                                console.error('Error deleting chat:', session, error);
                            }
                        }
                    }
                }).catch(error => {
                    console.error('Error loading chats for cleanup:', error);
                });
            }

            // Clean up old messages from current chat
            setMessages(prev => {
                if (Array.isArray(prev) && prev.length > 0) {
                    const filteredMessages = prev.filter(message => {
                        try {
                            const messageDate = new Date(message.timestamp);
                            return messageDate >= cutoffDate;
                        } catch (error) {
                            console.warn('Invalid message date:', message, error);
                            return true; // Keep message if date is invalid
                        }
                    });

                    if (filteredMessages.length !== prev.length) {
                        console.log(`Cleaned up ${prev.length - filteredMessages.length} old messages from current chat`);
                    }

                    return filteredMessages;
                }
                return prev;
            });
        } catch (error) {
            console.error('Error in data retention cleanup:', error);
        }
    };

    const handleSmartSuggestion = (suggestion) => {
        setInputMessage(suggestion);
        // Don't permanently disable smart suggestions - they should be controlled by message count
        inputRef.current?.focus();
    };
    const searchInMessages = (query) => {
        if (!query.trim()) {
            setFilteredMessages([]);
            return;
        }

        const filtered = messages.map((message, index) => ({
            ...message,
            originalIndex: index
        })).filter(message =>
            message.content.toLowerCase().includes(query.toLowerCase())
        );
        setFilteredMessages(filtered);
    };

    const handleSearchResultClick = (message) => {
        // Close the search modal
        setShowSearchInChat(false);
        setSearchQuery('');
        setFilteredMessages([]);

        // Find the original message index
        const originalIndex = message.originalIndex;

        // Highlight the message
        setHighlightedMessage(originalIndex);

        // Scroll to the message
        setTimeout(() => {
            const messageElement = document.querySelector(`[data-message-index="${originalIndex}"]`);
            if (messageElement) {
                messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);

        // Remove highlight after 3 seconds
        setTimeout(() => {
            setHighlightedMessage(null);
        }, 3000);
    };

    const filterMessages = (filter) => {
        setMessageFilter(filter);
        let filtered = messages;

        switch (filter) {
            case 'user':
                filtered = messages.filter(m => m.role === 'user');
                break;
            case 'assistant':
                filtered = messages.filter(m => m.role === 'assistant');
                break;
            case 'bookmarked':
                filtered = messages.filter((message, index) => {
                    const currentSessionId = getOrCreateSessionId();
                    const key = `${currentSessionId}_${index}_${message.timestamp}`;
                    return bookmarkedMessages.some(bm => bm.key === bookmarkKey);
                });
                break;
            default:
                filtered = messages;
        }

        setFilteredMessages(filtered);
    };

    const addReaction = (messageIndex, reaction) => {
        setMessageReactions(prev => ({
            ...prev,
            [`${messageIndex}_${messages[messageIndex]?.timestamp}`]: reaction
        }));
        setShowReactionPicker(false);
        setReactionTargetMessage(null);
    };

    const getThemeColors = () => {
        // If custom theme is selected and exists, use it
        if (selectedTheme === 'custom' && customTheme) {
            return {
                primary: customTheme.primary,
                secondary: customTheme.secondary,
                accent: customTheme.accent,
                border: customTheme.border
            };
        }

        const themes = {
            blue: {
                primary: 'from-blue-600 to-purple-600',
                secondary: 'bg-blue-50',
                accent: 'text-blue-600',
                border: 'border-blue-200'
            },
            green: {
                primary: 'from-green-600 to-emerald-600',
                secondary: 'bg-green-50',
                accent: 'text-green-600',
                border: 'border-green-200'
            },
            purple: {
                primary: 'from-purple-600 to-pink-600',
                secondary: 'bg-purple-50',
                accent: 'text-purple-600',
                border: 'border-purple-200'
            },
            orange: {
                primary: 'from-orange-600 to-red-600',
                secondary: 'bg-orange-50',
                accent: 'text-orange-600',
                border: 'border-orange-200'
            },
            red: {
                primary: 'from-red-600 to-pink-600',
                secondary: 'bg-red-50',
                accent: 'text-red-600',
                border: 'border-red-200'
            },
            indigo: {
                primary: 'from-indigo-600 to-blue-600',
                secondary: 'bg-indigo-50',
                accent: 'text-indigo-600',
                border: 'border-indigo-200'
            },
            teal: {
                primary: 'from-teal-600 to-cyan-600',
                secondary: 'bg-teal-50',
                accent: 'text-teal-600',
                border: 'border-teal-200'
            },
            pink: {
                primary: 'from-pink-600 to-rose-600',
                secondary: 'bg-pink-50',
                accent: 'text-pink-600',
                border: 'border-pink-200'
            },
            yellow: {
                primary: 'from-yellow-500 to-orange-500',
                secondary: 'bg-yellow-50',
                accent: 'text-yellow-600',
                border: 'border-yellow-200'
            },
            cyan: {
                primary: 'from-cyan-600 to-blue-600',
                secondary: 'bg-cyan-50',
                accent: 'text-cyan-600',
                border: 'border-cyan-200'
            },
            custom: {
                primary: customTheme?.primary || 'from-blue-600 to-purple-600',
                secondary: customTheme?.secondary || 'bg-blue-50',
                accent: customTheme?.accent || 'text-blue-600',
                border: customTheme?.border || 'border-blue-200'
            }
        };
        return themes[selectedTheme] || themes.blue;
    };

    const themeColors = getThemeColors();

    // Apply accessibility settings
    const getAccessibilityClasses = () => {
        let classes = '';
        if (highContrast) classes += ' high-contrast';
        if (reducedMotion) classes += ' reduced-motion';
        if (largeText) classes += ' large-text';
        if (screenReaderSupport) classes += ' screen-reader-support';
        return classes;
    };

    // Helper function for toggle switch styling that considers high contrast mode
    const getToggleSwitchClasses = (isEnabled) => {
        if (isEnabled) {
            return 'w-12 h-6 rounded-full transition-colors bg-blue-600';
        } else {
            // Use darker gray for disabled state when high contrast is enabled
            return `w-12 h-6 rounded-full transition-colors ${highContrast ? 'bg-gray-600' : 'bg-gray-300'}`;
        }
    };

    // Simple link formatting function
    const formatTextWithLinks = (text, isSentMessage = false) => {
        if (!text || typeof text !== 'string') return text;

        // URL regex with negative lookbehind to exclude trailing punctuation
        const urlRegex = /((?:https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]{2,}(?:\/[^\s]*)?|[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(?:\/[^\s]*)?)(?<![\.,?!:;()\]]))/gi;

        const parts = text.split(urlRegex);

        return parts.map((part, index) => {
            // Check if this part is a URL (odd indices in split result are the captured groups)
            if (index % 2 === 1) {
                // Ensure URL has protocol
                let url = part;
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                }

                // Different styling for sent vs received messages
                const linkClasses = isSentMessage
                    ? "text-white hover:text-blue-200 underline transition-colors duration-200 cursor-pointer"
                    : "text-blue-600 hover:text-blue-800 underline transition-colors duration-200 cursor-pointer";

                return (
                    <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClasses}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {part}
                    </a>
                );
            }

            return part;
        });
    };

    // Enhanced markdown rendering function with code highlighting
    const renderMarkdown = (text) => {
        if (!enableMarkdown) return text;

        let processedText = text;

        // Process code blocks first (before other markdown)
        processedText = processedText.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, language, code) => {
            let lang = language || 'text';
            const cleanCode = code.trim();

            // Map common language aliases to Prism.js language names
            const languageMap = {
                'html': 'markup',
                'xml': 'markup',
                'svg': 'markup',
                'js': 'javascript',
                'py': 'python',
                'sh': 'bash',
                'shell': 'bash',
                'md': 'markdown'
            };

            lang = languageMap[lang] || lang;

            if (enableCodeHighlighting) {
                try {
                    // Highlight the code with Prism.js
                    const highlightedCode = Prism.highlight(cleanCode, Prism.languages[lang] || Prism.languages.text, lang);
                    return `<div class="code-block relative group my-4 rounded-lg overflow-hidden border border-gray-700 dark:border-gray-600 bg-gray-900 dark:bg-gray-800">
                        <div class="flex items-center justify-between px-4 py-2 bg-gray-800 dark:bg-gray-700 border-b border-gray-700 dark:border-gray-600">
                            <span class="text-xs font-medium text-gray-400 uppercase">${lang}</span>
                            <button class="code-copy-btn p-1.5 rounded-lg text-gray-400 hover:text-white transition-all hover:bg-white/10 flex items-center justify-center" aria-label="Copy code" title="Copy code" data-code="${encodeURIComponent(cleanCode)}">
                                <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="1.2em" width="1.2em" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </button>
                        </div>
                        <pre class="bg-gray-900 dark:bg-gray-800 text-gray-100 dark:text-gray-200 p-4 overflow-x-auto border-none m-0"><code class="language-${lang}">${highlightedCode}</code></pre>
                    </div>`;
                } catch (error) {
                    console.warn('Code highlighting failed:', error);
                    return `<div class="code-block relative group my-4 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800">
                        <div class="flex items-center justify-between px-4 py-2 bg-gray-200 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
                            <span class="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">${lang}</span>
                            <button class="code-copy-btn p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center" aria-label="Copy code" title="Copy code" data-code="${encodeURIComponent(cleanCode)}">
                                <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="1.2em" width="1.2em" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </button>
                        </div>
                        <pre class="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200 p-4 overflow-x-auto border-none m-0"><code class="language-${lang}">${cleanCode}</code></pre>
                    </div>`;
                }
            } else {
                return `<div class="code-block relative group my-4 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800">
                    <div class="flex items-center justify-between px-4 py-2 bg-gray-200 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
                        <span class="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">${lang}</span>
                        <button class="code-copy-btn p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center" aria-label="Copy code" title="Copy code" data-code="${encodeURIComponent(cleanCode)}">
                            <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="1.2em" width="1.2em" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                    </div>
                    <pre class="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200 p-4 overflow-x-auto border-none m-0"><code class="language-${lang}">${cleanCode}</code></pre>
                </div>`;
            }
        });

        // Process inline code
        processedText = processedText.replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200 px-2 py-1 rounded text-sm font-mono border border-gray-300 dark:border-gray-600">$1</code>');
        // Process markdown tables (before processing other markdown elements)
        // Pattern: | Header | Header |\n|--------|--------|\n| Cell   | Cell   |
        processedText = processedText.replace(/(\|[^\n]+\|\n\|[-\s|:]+\|\n(?:\|[^\n]+\|\n?)+)/g, (match) => {
            const lines = match.trim().split('\n');
            if (lines.length < 2) return match; // Need at least header and separator

            // Extract header row
            const headerRow = lines[0].split('|').map(cell => cell.trim()).filter(cell => cell);

            // Extract data rows (skip separator line at index 1)
            const dataRows = lines.slice(2).map(line =>
                line.split('|').map(cell => cell.trim()).filter(cell => cell)
            );

            // Build HTML table
            let tableHtml = '<div class="table-wrapper my-4 overflow-x-auto"><table class="markdown-table border-collapse w-full text-sm">';

            // Header row
            tableHtml += '<thead><tr>';
            headerRow.forEach(cell => {
                const cellContent = cell.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                tableHtml += `<th class="markdown-table-th border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">${cellContent}</th>`;
            });
            tableHtml += '</tr></thead>';

            // Body rows
            tableHtml += '<tbody>';
            dataRows.forEach(row => {
                if (row.length > 0) {
                    tableHtml += '<tr>';
                    // Handle rows with fewer cells than headers
                    headerRow.forEach((_, index) => {
                        const cellContent = (row[index] || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        tableHtml += `<td class="markdown-table-td border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-800 dark:text-gray-200">${cellContent}</td>`;
                    });
                    tableHtml += '</tr>';
                }
            });
            tableHtml += '</tbody></table></div>';

            return tableHtml;
        });



        // Process other markdown elements
        processedText = processedText
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => `<a href="${url.trim()}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline transition-colors duration-200 cursor-pointer">${text}</a>`) // Links
            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>') // Bold
            .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>') // Italic
            .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>') // H3
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>') // H2
            .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>') // H1
            .replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc">$1</li>') // Bullet points
            .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal">$1</li>') // Numbered lists
            .replace(/\n/g, '<br>'); // Line breaks

        return processedText;
    };

    // Combined function to render text with both links and markdown
    const renderTextWithMarkdownAndLinks = (text, isSentMessage = false) => {
        if (!text || typeof text !== 'string') return text;

        // If markdown is disabled, just use link formatting
        if (!enableMarkdown) {
            return formatTextWithLinks(text, isSentMessage);
        }

        // First process markdown
        const markdownProcessed = renderMarkdown(text);

        // Protect functionality: Extract generated <a> tags and other HTML from the string
        // We only want to auto-link URLs that appear in clear text, not inside existing tags
        // Mask ALL HTML tags to be safe (including code blocks, tables, bold, italic)
        const protectedParts = [];
        const maskedText = markdownProcessed.replace(/<[^>]+>/g, (match) => {
            protectedParts.push(match);
            return `__HTML_PROTECTED_${protectedParts.length - 1}__`;
        });

        // URL regex with negative lookbehind to exclude trailing punctuation
        // Note: No need for checks against href=" since tags are now masked
        const urlRegex = /((?:https?:\/\/(?:(?!(?:__HTML_PROTECTED))[^\s])+|www\.(?:(?!(?:__HTML_PROTECTED))[^\s])+\.(?:(?!(?:__HTML_PROTECTED))[^\s]){2,}(?:\/(?:(?!(?:__HTML_PROTECTED))[^\s])*)?|[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(?:\/(?:(?!(?:__HTML_PROTECTED))[^\s])*)?)(?<![\.,?!:;()\]]))/gi;

        // Split by URLs and process each part
        const parts = maskedText.split(urlRegex);

        return parts.map((part, index) => {
            // Check if this part is a URL (odd indices in split result are the captured groups)
            if (index % 2 === 1 && urlRegex.test(part)) {
                let url = part;
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                }

                const linkClasses = isSentMessage
                    ? "text-white hover:text-blue-200 underline transition-colors duration-200 cursor-pointer"
                    : "text-blue-600 hover:text-blue-800 underline transition-colors duration-200 cursor-pointer";

                return (
                    <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClasses}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {part}
                    </a>
                );
            }

            // Restore protected HTML tags
            const restoredPart = part.replace(/__HTML_PROTECTED_(\d+)__/g, (match, id) => {
                const restored = protectedParts[parseInt(id)];
                return restored !== undefined ? restored : match; // Return match (placeholder) if undefined
            });

            return <span key={index} className={isSentMessage ? "text-white" : ""} dangerouslySetInnerHTML={{ __html: restoredPart }} />;
        });
    };

    // Analytics tracking
    const trackEvent = (eventName, data = {}) => {
        if (!enableAnalytics) return;

        // Simple analytics tracking
        const event = {
            event: eventName,
            timestamp: new Date().toISOString(),
            userId: currentUser?.id || 'anonymous',
            sessionId: getOrCreateSessionId(),
            data: data
        };

        // Store in localStorage for now (in production, send to analytics service)
        const analyticsData = localStorage.getItem('gemini_analytics');
        let analytics = [];
        try {
            const parsed = JSON.parse(analyticsData || '[]');
            analytics = Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn('Corrupted analytics data, resetting:', error);
            analytics = [];
        }
        analytics.push(event);
        localStorage.setItem('gemini_analytics', JSON.stringify(analytics.slice(-100))); // Keep last 100 events
    };

    // Error reporting
    const reportError = (error, context = {}) => {
        if (!enableErrorReporting) return;

        const errorReport = {
            error: error.message || error,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            userId: currentUser?.id || 'anonymous',
            sessionId: getOrCreateSessionId(),
            context: context,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // Store in localStorage for now (in production, send to error reporting service)
        const errorsData = localStorage.getItem('gemini_errors');
        let errors = [];
        try {
            const parsed = JSON.parse(errorsData || '[]');
            errors = Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn('Corrupted errors data, resetting:', error);
            errors = [];
        }
        errors.push(errorReport);
        localStorage.setItem('gemini_errors', JSON.stringify(errors.slice(-50))); // Keep last 50 errors

        console.error('Error reported:', errorReport);
    };

    // Save current session to backend
    const saveCurrentSession = async () => {
        if (!currentUser || messages.length === 0) {
            console.log('Auto-save skipped: No user or no messages');
            return;
        }

        // Prevent auto-save if only system messages (like welcome message) exist
        // This avoids 404 errors when trying to update a session that hasn't been created in DB yet
        const hasUserMessage = messages.some(m => m.role === 'user');
        if (!hasUserMessage) {
            // console.log('Auto-save skipped: No user messages yet');
            return;
        }

        try {
            const currentSessionId = getOrCreateSessionId();

            if (!currentSessionId) {
                console.log('Auto-save skipped: No session ID');
                return;
            }

            console.log('Auto-saving chat:', currentSessionId, 'Messages:', messages.length);

            const saveResponse = await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${currentSessionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: messages,
                    name: `Chat ${new Date().toLocaleDateString()}`,
                    totalMessages: messages.length,
                    lastActivity: new Date().toISOString()
                })
            });

            if (saveResponse.ok) {
                console.log('Chat auto-saved successfully');
            } else {
                console.error('Failed to auto-save current chat:', saveResponse.status, saveResponse.statusText);
            }
        } catch (error) {
            console.error('Error auto-saving chat:', error);
            // Only report error if it's not a network issue for anonymous users
            if (currentUser) {
                reportError(error, { action: 'auto_save_session' });
            }
        }
    };

    // Get dynamic classes based on settings
    const getFontSizeClass = () => {
        switch (fontSize) {
            case 'small': return 'text-sm';
            case 'large': return 'text-lg';
            default: return 'text-base';
        }
    };

    const getMessageDensityClass = () => {
        switch (messageDensity) {
            case 'compact': return 'py-2 px-3';
            case 'spacious': return 'py-6 px-4';
            default: return 'py-4 px-3';
        }
    };
    return (
        <div style={{ display: isContactSupportOpen ? 'none' : 'block' }}>
            {/* Enhanced Floating AI Chat Button */}
            <div className={`fixed bottom-20 right-6 z-50 ${isMobileMenuOpen ? 'hidden' : ''}`}>
                <div className="relative">
                    {/* Quick Action Buttons */}
                    {!isOpen && (
                        <div className="absolute bottom-16 right-0 flex flex-col gap-2 opacity-0 hover:opacity-100 transition-all duration-300">
                            <button
                                onClick={() => {
                                    if (!currentUser) {
                                        toast.info('Please login to use voice input');
                                        return;
                                    }
                                    setIsOpen(true);
                                    setTimeout(() => setShowVoiceInput(true), 100);
                                }}
                                className="w-10 h-10 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
                                title="Voice Input"
                            >
                                <FaMicrophone size={14} />
                            </button>
                            <button
                                onClick={() => {
                                    if (!currentUser) {
                                        toast.info('Please login to upload files');
                                        return;
                                    }
                                    setIsOpen(true);
                                    setTimeout(() => setShowFileUpload(true), 100);
                                }}
                                className="w-10 h-10 bg-purple-500 hover:bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
                                title="Upload File"
                            >
                                <FaUpload size={14} />
                            </button>
                        </div>
                    )}

                    <button
                        onClick={isOpen ? handleClose : handleOpen}
                        className={`relative group w-12 h-12 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 hover:rotate-12 flex items-center justify-center ${isDarkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900' : `bg-gradient-to-br ${themeColors.primary}`
                            }`}
                        style={{
                            boxShadow: isDarkMode ? '0 10px 25px rgba(0,0,0,0.3)' : `0 10px 25px ${getThemeRingColor()}40`
                        }}
                        aria-label="Open AI Chat"
                        title="Chat with SetuAI Assistant!"
                    >
                        {/* Animated background ring */}
                        <div
                            className={`absolute inset-0 rounded-full animate-ping`}
                            style={{
                                border: `3px solid ${isDarkMode ? '#4b5563' : getThemeRingColor()}`,
                            }}
                        ></div>

                        {/* Icon with sparkle effect */}
                        <div className="relative">
                            {isOpen ? (
                                <FaTimes className="w-5 h-5 text-white drop-shadow-lg" />
                            ) : (
                                <div className="relative">
                                    <FaRobot className="w-5 h-5 text-white drop-shadow-lg" />
                                    <FaStar className="absolute -top-1 -right-1 w-3 h-3 text-yellow-300 animate-pulse" />
                                </div>
                            )}
                        </div>

                        {!isOpen && unreadCount > 0 && (
                            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-[20px] px-1 flex items-center justify-center border-2 border-white shadow-lg animate-bounce">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </div>
                        )}

                        {/* Enhanced Hover Tooltip */}
                        <div className={`absolute bottom-full right-0 mb-3 ${isDarkMode ? 'bg-gray-800 text-white border-gray-600' : 'bg-white text-gray-800 border-gray-100'
                            } text-sm px-4 py-2 rounded-xl shadow-2xl hidden group-hover:block z-10 whitespace-nowrap border transform -translate-y-1 transition-all duration-200`}>
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🤖</span>
                                <span className="font-medium">Chat with SetuAI Assistant!</span>
                            </div>
                            {/* Tooltip arrow */}
                            <div className={`absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent ${isDarkMode ? 'border-t-gray-800' : 'border-t-white'
                                }`}></div>
                        </div>
                    </button>
                </div>
            </div>

            {/* Chat Window */}
            {isOpen && (
                <div
                    className={`fixed inset-0 ${isDarkMode ? 'bg-black bg-opacity-70' : 'bg-black bg-opacity-50'} flex items-center justify-center z-50 p-4 md:p-0 md:items-end md:justify-end gemini-chatbox-modal animate-fadeIn${getAccessibilityClasses()}`}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="chat-title"
                    aria-describedby="chat-description"
                >
                    <div className={`${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl shadow-2xl border flex flex-col relative ${isFullscreen ? 'w-full h-full max-w-none max-h-none rounded-none' :
                        isExpanded ? 'w-full max-w-4xl h-[85vh] md:mb-12 md:mr-12' :
                            'w-full max-w-md h-full max-h-[90vh] md:w-96 md:h-[500px] md:mb-32 md:mr-6 md:max-h-[500px]'
                        } animate-slideUp`}>
                        {/* Screen reader only elements */}
                        {screenReaderSupport && (
                            <>
                                <h1 id="chat-title" className="sr-only">SetuAI Chat Assistant</h1>
                                <div id="chat-description" className="sr-only">
                                    Interactive chat interface with SetuAI assistant. You can send messages, receive responses, and access various features like voice input, file upload, and settings.
                                </div>
                                <div
                                    id="screen-reader-announcements"
                                    className="sr-only"
                                    aria-live="polite"
                                    aria-atomic="true"
                                    role="status"
                                    aria-label="New message announcements"
                                    aria-relevant="additions text"
                                >
                                    {/* This will be updated to announce new messages */}
                                </div>
                                <div
                                    id="screen-reader-status"
                                    className="sr-only"
                                    aria-live="assertive"
                                    aria-atomic="true"
                                    role="status"
                                    aria-label="Status announcements"
                                >
                                    {/* This will be updated to announce status changes */}
                                </div>
                            </>
                        )}
                        {/* Enhanced Header */}
                        <div className={`bg-gradient-to-r ${themeColors.primary} text-white p-3 md:p-4 ${isFullscreen ? 'rounded-none' : 'rounded-t-2xl'} flex items-center justify-between flex-shrink-0 relative`}>
                            {/* Left: assistant identity with status */}
                            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                                <div className="relative">
                                    <div className="p-1.5 md:p-2 bg-white/10 rounded-lg border border-white/20">
                                        <FaRobot size={16} className="opacity-90" />
                                    </div>
                                    {/* Online status indicator with ping effect */}
                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 flex items-center justify-center">
                                        <div className={`absolute inset-0 rounded-full border-2 border-white ${
                                            hasChatError ? 'bg-red-500' :
                                            isLoading || showTypingIndicator ? 'bg-blue-400' : 'bg-green-400'
                                        }`}></div>
                                        <div className={`w-full h-full rounded-full animate-ping opacity-75 ${
                                            hasChatError ? 'bg-red-500' :
                                            isLoading || showTypingIndicator ? 'bg-blue-400' : 'bg-green-400'
                                        }`}></div>
                                    </div>
                                </div>
                                <div class="leading-tight block max-w-full overflow-hidden">
                                    <div className="text-sm md:text-base font-bold truncate flex items-center gap-2">
                                        {isGeneratingTitle && !displayedTitle ? (
                                            <div className="flex items-center gap-2">
                                                <div className="h-4 w-24 bg-white/20 rounded animate-pulse"></div>
                                                <div className="h-4 w-12 bg-white/20 rounded animate-pulse"></div>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="truncate">{displayedTitle || 'SetuAI'}</span>
                                                {currentUser && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full flex-shrink-0">PRO</span>}
                                            </>
                                        )}
                                    </div>
                                    <div className="text-[10px] md:text-xs text-white/80 truncate flex items-center gap-1">
                                        {hasChatError ? (
                                            <span>Chat Error Detected</span>
                                        ) : isLoading ? (
                                            <ScrollingThinkingTags isHeader={true} />
                                        ) : showTypingIndicator ? (
                                            <span>Answering...</span>
                                        ) : (
                                            <span>{displayedTitle !== 'SetuAI' ? 'Active Chat • Powered by SetuAI' : 'Online • Real Estate Expert Powered by Sentinel v2.0'}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Enhanced Right controls */}
                            <div className="flex items-center gap-1 relative flex-shrink-0">

                                <button
                                    ref={headerMenuButtonRef}
                                    onClick={() => setIsHeaderMenuOpen(open => !open)}
                                    className={`group relative inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 ${isHeaderMenuOpen
                                        ? 'bg-white/20 text-white shadow-lg scale-105'
                                        : 'text-white/80 hover:text-white hover:bg-white/10 hover:scale-105'
                                        }`}
                                    title="More options"
                                    aria-label="More options"
                                >
                                    <FaEllipsisV className={`text-lg transition-transform duration-300 ${isHeaderMenuOpen ? 'rotate-90' : ''}`} />

                                    {/* Subtle glow effect when open */}
                                    {isHeaderMenuOpen && (
                                        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-400/20 to-purple-400/20 animate-pulse"></div>
                                    )}
                                </button>
                                <button
                                    onClick={handleClose}
                                    className="text-white hover:text-gray-200 transition-colors"
                                    aria-label="Close"
                                >
                                    <FaTimes size={16} />
                                </button>

                                {/* Dropdown menu */}
                                {isHeaderMenuOpen && (
                                    <div ref={headerMenuRef} className={`absolute right-0 top-full mt-3 ${isDarkMode ? 'bg-gray-800/95 text-gray-200 border-gray-600' : 'bg-white/95 text-gray-800 border-gray-200'} rounded-xl shadow-2xl border backdrop-blur-sm w-64 z-50 animate-fade-in origin-top-right max-h-[60vh] overflow-y-auto`}>
                                        <ul className="py-2 text-sm">
                                            {/* New Chat */}
                                            <li>
                                                <button
                                                    onClick={() => { createNewSession(); setIsHeaderMenuOpen(false); }}
                                                    className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80'} flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] group`}
                                                >
                                                    <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'} group-hover:scale-110 transition-transform duration-200`}>
                                                        <FaComments size={14} className="text-blue-500" />
                                                    </div>
                                                    <span className="font-medium">New Chat</span>
                                                </button>
                                            </li>

                                            <li className={`border-t ${isDarkMode ? 'border-gray-600/50' : 'border-gray-200/50'} my-2`}></li>

                                            {(currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) && (
                                                <li>
                                                    <button
                                                        onClick={async () => {
                                                            loadRatingMeta();
                                                            if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) {
                                                                try {
                                                                    setAllRatingsLoading(true);
                                                                    const resp = await authenticatedFetch(`${API_BASE_URL}/api/gemini/ratings-all?limit=500&days=90`);
                                                                    if (resp.ok) {
                                                                        const data = await resp.json();
                                                                        setAllRatings(Array.isArray(data.ratings) ? data.ratings : []);
                                                                    } else {
                                                                        setAllRatings([]);
                                                                    }
                                                                } catch (_) {
                                                                    setAllRatings([]);
                                                                } finally {
                                                                    setAllRatingsLoading(false);
                                                                }
                                                            }
                                                            setShowRatingsModal(true);
                                                            setIsHeaderMenuOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80'} flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] group`}
                                                    >
                                                        <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-amber-500/20' : 'bg-amber-100'} group-hover:scale-110 transition-transform duration-200`}>
                                                            <FaStar size={14} className="text-amber-500" />
                                                        </div>
                                                        <span className="font-medium">Ratings & Feedback</span>
                                                    </button>
                                                </li>
                                            )}

                                            {(currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) && (
                                                <li>
                                                    <button
                                                        onClick={() => { setShowAdminReportsModal(true); fetchAdminReports(); setIsHeaderMenuOpen(false); }}
                                                        className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80'} flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] group`}
                                                    >
                                                        <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-red-500/20' : 'bg-red-100'} group-hover:scale-110 transition-transform duration-200`}>
                                                            <FaClipboardList size={14} className="text-red-500" />
                                                        </div>
                                                        <span className="font-medium">Manage Reports</span>
                                                    </button>
                                                </li>
                                            )}

                                            {(currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) && (
                                                <li className={`border-t ${isDarkMode ? 'border-gray-600/50' : 'border-gray-200/50'} my-2`}></li>
                                            )}

                                            {/* Theme & Settings */}
                                            <li>
                                                <button
                                                    onClick={() => { setShowSettings(true); setIsHeaderMenuOpen(false); }}
                                                    className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80'} flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] group`}
                                                >
                                                    <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'} group-hover:scale-110 transition-transform duration-200`}>
                                                        <FaPalette size={14} className="text-purple-500" />
                                                    </div>
                                                    <span className="font-medium">Theme & Settings</span>
                                                </button>
                                            </li>

                                            {/* Search in Chat */}
                                            <li>
                                                <button
                                                    onClick={() => { setShowSearchInChat(true); setIsHeaderMenuOpen(false); }}
                                                    className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80'} flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] group`}
                                                >
                                                    <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'} group-hover:scale-110 transition-transform duration-200`}>
                                                        <FaSearch size={14} className="text-blue-500" />
                                                    </div>
                                                    <span className="font-medium">Search in Chat</span>
                                                </button>
                                            </li>

                                            {/* Refresh Messages */}
                                            <li>
                                                <button
                                                    onClick={() => { refreshMessages(); setIsHeaderMenuOpen(false); }}
                                                    className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80'} flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] group`}
                                                >
                                                    <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-green-500/20' : 'bg-green-100'} group-hover:scale-110 transition-transform duration-200`}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-green-500">
                                                            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                                                        </svg>
                                                    </div>
                                                    <span className="font-medium">{currentUser ? 'Refresh Messages' : 'Refresh'}</span>
                                                </button>
                                            </li>

                                            {/* Fullscreen toggle */}
                                            <li>
                                                <button
                                                    onClick={() => { setIsFullscreen(!isFullscreen); setIsHeaderMenuOpen(false); }}
                                                    className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80'} flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] group`}
                                                >
                                                    <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-gray-500/20' : 'bg-gray-100'} group-hover:scale-110 transition-transform duration-200`}>
                                                        {isFullscreen ? <FaCompress size={14} className="text-gray-600" /> : <FaExpand size={14} className="text-gray-600" />}
                                                    </div>
                                                    <span className="font-medium">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                                                </button>
                                            </li>

                                            <li className={`border-t ${isDarkMode ? 'border-gray-600/50' : 'border-gray-200/50'} my-2`}></li>

                                            {/* Quick Actions */}
                                            <li>
                                                <button
                                                    onClick={() => { setShowQuickActions(true); setIsHeaderMenuOpen(false); }}
                                                    className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80'} flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] group`}
                                                >
                                                    <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-yellow-500/20' : 'bg-yellow-100'} group-hover:scale-110 transition-transform duration-200`}>
                                                        <FaLightbulb size={14} className="text-yellow-500" />
                                                    </div>
                                                    <span className="font-medium">Quick Actions</span>
                                                </button>
                                            </li>

                                            {/* Bookmarks - Only for logged-in users */}
                                            {currentUser && (
                                                <li>
                                                    <button
                                                        onClick={() => { setShowBookmarks(true); loadChatSessions(); setIsHeaderMenuOpen(false); }}
                                                        className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80'} flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] group`}
                                                    >
                                                        <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-yellow-500/20' : 'bg-yellow-100'} group-hover:scale-110 transition-transform duration-200`}>
                                                            <FaBookmark size={14} className="text-yellow-500" />
                                                        </div>
                                                        <span className="font-medium">Bookmarks</span>
                                                    </button>
                                                </li>
                                            )}

                                            {/* Chat History */}
                                            <li>
                                                <button
                                                    onClick={() => { setShowHistory(true); loadChatSessions(); setIsHeaderMenuOpen(false); }}
                                                    className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80'} flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] group`}
                                                >
                                                    <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'} group-hover:scale-110 transition-transform duration-200`}>
                                                        <FaHistory size={14} className="text-blue-500" />
                                                    </div>
                                                    <span className="font-medium">Chat History</span>
                                                </button>
                                            </li>

                                            <li className={`border-t ${isDarkMode ? 'border-gray-600/50' : 'border-gray-200/50'} my-2`}></li>

                                            {/* Expand/Collapse only on desktop */}
                                            <li className="hidden md:block">
                                                <button
                                                    onClick={() => { setIsExpanded(expanded => !expanded); setIsHeaderMenuOpen(false); }}
                                                    className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80'} flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] group`}
                                                >
                                                    <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-gray-500/20' : 'bg-gray-100'} group-hover:scale-110 transition-transform duration-200`}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-gray-600">
                                                            <path d="M4 4h7v2H6v5H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4z" />
                                                        </svg>
                                                    </div>
                                                    <span className="font-medium">{isExpanded ? 'Collapse' : 'Expand'}</span>
                                                </button>
                                            </li>

                                            {/* Save current chat */}
                                            {(messages.length > 1 || messages.some(m => m.role === 'user')) && (
                                                <li>
                                                    <button
                                                        onClick={() => {
                                                            setIsHeaderMenuOpen(false);
                                                            if (!currentUser) {
                                                                setAuthModal({ isOpen: true, type: 'save' });
                                                                return;
                                                            }
                                                            try {
                                                                const lines = messages.map(m => {
                                                                    // Mask restricted content in downloaded file
                                                                    if (m.isRestricted) {
                                                                        if (m.role === 'user') return `You: [Restricted Content - Violation Detected]`;
                                                                        return `SetuAI: [Restricted Response]`;
                                                                    }
                                                                    return `${m.role === 'user' ? 'You' : 'SetuAI'}: ${m.content}`;
                                                                });
                                                                const blob = new Blob([lines.join('\n\n')], { type: 'text/plain;charset=utf-8' });
                                                                const url = URL.createObjectURL(blob);
                                                                const a = document.createElement('a');
                                                                a.href = url;
                                                                a.download = `setuai_chat_${new Date().toISOString().split('T')[0]}.txt`;
                                                                document.body.appendChild(a);
                                                                a.click();
                                                                document.body.removeChild(a);
                                                                URL.revokeObjectURL(url);
                                                            } catch (e) {
                                                                toast.error('Failed to save chat');
                                                            }
                                                        }}
                                                        className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80'} flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] group`}
                                                    >
                                                        <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-green-500/20' : 'bg-green-100'} group-hover:scale-110 transition-transform duration-200`}>
                                                            <FaDownload size={14} className="text-green-500" />
                                                        </div>
                                                        <span className="font-medium">Save Chat</span>
                                                    </button>
                                                </li>
                                            )}

                                            {/* Share Chat */}
                                            {(messages.length > 1 || messages.some(m => m.role === 'user')) && (
                                                <li>
                                                    <button
                                                        onClick={() => {
                                                            setIsHeaderMenuOpen(false);
                                                            if (!currentUser) {
                                                                setAuthModal({ isOpen: true, type: 'share' });
                                                                return;
                                                            }
                                                            setShareTargetSessionId(getOrCreateSessionId());
                                                            setIsShareModalOpen(true);
                                                        }}
                                                        className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80'} flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] group`}
                                                    >
                                                        <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-cyan-500/20' : 'bg-cyan-100'} group-hover:scale-110 transition-transform duration-200`}>
                                                            <FaShareAlt size={14} className="text-cyan-500" />
                                                        </div>
                                                        <span className="font-medium">{isChatShared ? 'Update Chat' : 'Share Chat'}</span>
                                                    </button>
                                                </li>
                                            )}

                                            {/* Clear */}
                                            {(messages && (messages.length > 1 || messages.some(m => m.role === 'user'))) && (
                                                <li>
                                                    <button
                                                        onClick={() => { setIsHeaderMenuOpen(false); setShowConfirmClear(true); }}
                                                        className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-red-900/20 text-red-400' : 'hover:bg-red-50 text-red-600'} flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] group`}
                                                    >
                                                        <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-red-500/20' : 'bg-red-100'} group-hover:scale-110 transition-transform duration-200`}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                                            </svg>
                                                        </div>
                                                        <span className="font-medium">Clear Chat</span>
                                                    </button>
                                                </li>
                                            )}

                                            <li className={`border-t ${isDarkMode ? 'border-gray-600/50' : 'border-gray-200/50'} my-2`}></li>

                                            {/* About SetuAI */}
                                            <li>
                                                <button
                                                    onClick={() => { setShowInfoModal(true); setIsHeaderMenuOpen(false); }}
                                                    className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80'} flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] group`}
                                                >
                                                    <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-indigo-500/20' : 'bg-indigo-100'} group-hover:scale-110 transition-transform duration-200`}>
                                                        <FaRobot size={14} className="text-indigo-500" />
                                                    </div>
                                                    <span className="font-medium">About SetuAI</span>
                                                </button>
                                            </li>

                                            {/* Terms & Conditions Option - Visible to Everyone */}
                                            <li>
                                                <button
                                                    onClick={() => { setShowTermsModal(true); setIsHeaderMenuOpen(false); }}
                                                    className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80'} flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] group`}
                                                >
                                                    <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'} group-hover:scale-110 transition-transform duration-200`}>
                                                        <FaFileAlt size={14} className="text-blue-500" />
                                                    </div>
                                                    <span className="font-medium">Terms & Conditions</span>
                                                </button>
                                            </li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Messages with date dividers */}
                        <div
                            ref={messagesContainerRef}
                            className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 relative"
                            role="log"
                            aria-live={screenReaderSupport ? "polite" : "off"}
                            aria-label="Chat messages"
                        >
                            {/* Floating Date Indicator (sticky below header) */}
                            {floatingDateLabel && (
                                <div className={`sticky top-0 left-0 right-0 z-30 pointer-events-none transition-all duration-500 ease-out ${isScrolling ? 'opacity-100 scale-100 translate-y-0 animate-floatingDateFadeIn' : 'opacity-0 scale-95 translate-y-2 animate-floatingDateFadeOut'
                                    }`}>
                                    <div className="w-full flex justify-center py-2">
                                        <div className={`bg-gradient-to-r ${themeColors.primary} text-white text-xs px-4 py-2 rounded-full shadow-lg border-2 border-white transform transition-all duration-300 ${isScrolling ? 'shadow-xl' : 'shadow-lg'
                                            }`}>
                                            {floatingDateLabel}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {messages.map((message, index) => {
                                const showDivider = index === 0 || !isSameDay(messages[index - 1]?.timestamp, message.timestamp);
                                const dividerLabel = showDivider ? getDateLabel(message.timestamp) : '';
                                return (
                                    <React.Fragment key={index}>
                                        {showDivider && (
                                            <div className="flex items-center my-2">
                                                <div className="flex-1 h-px bg-gray-200" />
                                                <span className={`mx-3 text-xs ${themeColors.accent} ${themeColors.secondary} px-3 py-1 rounded-full border ${themeColors.border} shadow-sm`}>
                                                    {dividerLabel}
                                                </span>
                                                <div className="flex-1 h-px bg-gray-200" />
                                            </div>
                                        )}
                                        <div
                                            data-message-index={index}
                                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} ${highlightedMessage === index ? 'animate-pulse' : ''
                                                }`}
                                            role="article"
                                            aria-label={`${message.role === 'user' ? 'Your message' : 'AI response'}`}
                                            aria-describedby={screenReaderSupport ? `message-${index}-content` : undefined}
                                        >
                                            <div
                                                className={`${editingMessageIndex === index ? 'w-full max-w-[95%] sm:w-auto sm:max-w-[85%]' : 'max-w-[85%]'} ${getMessageDensityClass()} rounded-2xl break-words relative group ${message.isRestricted
                                                    ? `${isDarkMode ? 'bg-red-900/20 text-red-300 border border-red-700' : 'bg-red-50 text-red-900 border border-red-300 shadow-sm'}`
                                                    : message.role === 'user'
                                                        ? `bg-gradient-to-r ${themeColors.primary} text-white`
                                                        : message.isError
                                                            ? `${isDarkMode ? 'bg-red-900/20 text-red-300 border border-red-700' : 'bg-red-50 text-red-900 border border-red-300 shadow-sm'}`
                                                            : `${isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-gray-100 text-gray-800'}`
                                                    } ${highlightedMessage === index
                                                        ? 'ring-4 ring-yellow-400 ring-opacity-50 shadow-lg transform scale-105'
                                                        : ''
                                                    } transition-all duration-300`}
                                            >
                                                {/* Media Display */}
                                                {message.imageUrl && (
                                                    <div className="mb-2">
                                                        <div className="relative">
                                                            <img
                                                                src={message.imageUrl}
                                                                alt="Shared image"
                                                                className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    // Open image in new tab
                                                                    window.open(message.imageUrl, '_blank');
                                                                }}
                                                                onError={(e) => {
                                                                    e.target.src = "https://via.placeholder.com/300x200?text=Image+Not+Found";
                                                                    e.target.className = "max-w-full max-h-64 rounded-lg opacity-50";
                                                                }}
                                                            />
                                                            <button
                                                                className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-700 p-1 rounded-full shadow-md transition-colors"
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    try {
                                                                        const response = await authenticatedFetch(message.imageUrl, { mode: 'cors' });
                                                                        if (!response.ok) throw new Error(`HTTP ${response.status}`);

                                                                        const contentType = response.headers.get('content-type') || 'image/jpeg';
                                                                        const blob = await response.blob();
                                                                        const blobUrl = window.URL.createObjectURL(blob);

                                                                        const getFileExtension = (contentType) => {
                                                                            const mimeToExt = {
                                                                                'image/jpeg': 'jpg',
                                                                                'image/jpg': 'jpg',
                                                                                'image/png': 'png',
                                                                                'image/gif': 'gif',
                                                                                'image/webp': 'webp',
                                                                                'image/svg+xml': 'svg',
                                                                                'image/bmp': 'bmp',
                                                                                'image/tiff': 'tiff'
                                                                            };
                                                                            return mimeToExt[contentType] || 'jpg';
                                                                        };

                                                                        const extension = getFileExtension(contentType);
                                                                        const fileName = `image-${Date.now()}.${extension}`;

                                                                        const a = document.createElement('a');
                                                                        a.href = blobUrl;
                                                                        a.download = fileName;
                                                                        document.body.appendChild(a);
                                                                        a.click();
                                                                        document.body.removeChild(a);
                                                                        window.URL.revokeObjectURL(blobUrl);

                                                                        console.log('Downloaded image:', fileName, 'Type:', contentType);
                                                                    } catch (error) {
                                                                        console.error('Image download failed:', error);
                                                                        // Fallback to direct link
                                                                        const a = document.createElement('a');
                                                                        a.href = message.imageUrl;
                                                                        a.download = `image-${Date.now()}.jpg`;
                                                                        a.target = '_blank';
                                                                        document.body.appendChild(a);
                                                                        a.click();
                                                                        document.body.removeChild(a);
                                                                    }
                                                                }}
                                                                title="Download Image"
                                                            >
                                                                <FaDownload className="text-xs" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {message.audioUrl && (
                                                    <div className="mb-2">
                                                        <div className="relative">
                                                            <div className="w-full min-w-[280px]">
                                                                <audio
                                                                    src={message.audioUrl}
                                                                    className="w-full"
                                                                    controls
                                                                    preload="metadata"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </div>
                                                            <button
                                                                className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-700 p-1 rounded-full shadow-md transition-colors"
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    try {
                                                                        const response = await authenticatedFetch(message.audioUrl, { mode: 'cors' });
                                                                        if (!response.ok) throw new Error(`HTTP ${response.status}`);

                                                                        const contentType = response.headers.get('content-type') || 'audio/mpeg';
                                                                        const blob = await response.blob();
                                                                        const blobUrl = window.URL.createObjectURL(blob);

                                                                        const getFileExtension = (contentType) => {
                                                                            const mimeToExt = {
                                                                                'audio/mpeg': 'mp3',
                                                                                'audio/wav': 'wav',
                                                                                'audio/webm': 'webm',
                                                                                'audio/ogg': 'ogg',
                                                                                'audio/mp4': 'm4a',
                                                                                'audio/aac': 'aac'
                                                                            };
                                                                            return mimeToExt[contentType] || 'mp3';
                                                                        };

                                                                        const extension = getFileExtension(contentType);
                                                                        const fileName = `audio-${Date.now()}.${extension}`;

                                                                        const a = document.createElement('a');
                                                                        a.href = blobUrl;
                                                                        a.download = fileName;
                                                                        document.body.appendChild(a);
                                                                        a.click();
                                                                        document.body.removeChild(a);
                                                                        window.URL.revokeObjectURL(blobUrl);

                                                                        console.log('Downloaded audio:', fileName, 'Type:', contentType);
                                                                    } catch (error) {
                                                                        console.error('Audio download failed:', error);
                                                                        // Fallback to direct link
                                                                        const a = document.createElement('a');
                                                                        a.href = message.audioUrl;
                                                                        a.download = `audio-${Date.now()}.mp3`;
                                                                        a.target = '_blank';
                                                                        document.body.appendChild(a);
                                                                        a.click();
                                                                        document.body.removeChild(a);
                                                                    }
                                                                }}
                                                                title="Download Audio"
                                                            >
                                                                <FaDownload className="text-xs" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {message.videoUrl && (
                                                    <div className="mb-2">
                                                        <div className="relative">
                                                            <div className="rounded-lg border cursor-pointer hover:opacity-90 transition-opacity overflow-hidden relative group" onClick={() => setPreviewVideo(message.videoUrl)}>
                                                                <video
                                                                    src={message.videoUrl}
                                                                    className="max-w-full max-h-64 object-cover"
                                                                    muted
                                                                    playsInline
                                                                    preload="metadata"
                                                                />
                                                                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                                                        <FaPlay className="text-white text-xl ml-1" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <button
                                                                className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-700 p-1 rounded-full shadow-md transition-colors"
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    try {
                                                                        const response = await authenticatedFetch(message.videoUrl, { mode: 'cors' });
                                                                        if (!response.ok) throw new Error(`HTTP ${response.status}`);

                                                                        const contentType = response.headers.get('content-type') || 'video/mp4';
                                                                        const blob = await response.blob();
                                                                        const blobUrl = window.URL.createObjectURL(blob);

                                                                        const getFileExtension = (contentType) => {
                                                                            const mimeToExt = {
                                                                                'video/mp4': 'mp4',
                                                                                'video/avi': 'avi',
                                                                                'video/mov': 'mov',
                                                                                'video/wmv': 'wmv',
                                                                                'video/flv': 'flv',
                                                                                'video/webm': 'webm',
                                                                                'video/ogg': 'ogv'
                                                                            };
                                                                            return mimeToExt[contentType] || 'mp4';
                                                                        };

                                                                        const extension = getFileExtension(contentType);
                                                                        const fileName = `video-${Date.now()}.${extension}`;

                                                                        const a = document.createElement('a');
                                                                        a.href = blobUrl;
                                                                        a.download = fileName;
                                                                        document.body.appendChild(a);
                                                                        a.click();
                                                                        document.body.removeChild(a);
                                                                        window.URL.revokeObjectURL(blobUrl);

                                                                        console.log('Downloaded video:', fileName, 'Type:', contentType);
                                                                    } catch (error) {
                                                                        console.error('Video download failed:', error);
                                                                        // Fallback to direct link
                                                                        const a = document.createElement('a');
                                                                        a.href = message.videoUrl;
                                                                        a.download = `video-${Date.now()}.mp4`;
                                                                        a.target = '_blank';
                                                                        document.body.appendChild(a);
                                                                        a.click();
                                                                        document.body.removeChild(a);
                                                                    }
                                                                }}
                                                                title="Download Video"
                                                            >
                                                                <FaDownload className="text-xs" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {message.documentUrl && (
                                                    <div className="mb-2">
                                                        <button
                                                            className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50"
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                try {
                                                                    console.log('Starting download for URL:', message.documentUrl);

                                                                    const response = await authenticatedFetch(message.documentUrl, { mode: 'cors' });
                                                                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                                                                    // Get the actual file type from response headers
                                                                    const contentType = response.headers.get('content-type') || 'application/octet-stream';
                                                                    console.log('Response content-type:', contentType);

                                                                    // Detect file type from URL if content-type is generic
                                                                    const detectFileTypeFromUrl = (url) => {
                                                                        const urlLower = url.toLowerCase();
                                                                        if (urlLower.includes('.pdf')) return { mime: 'application/pdf', ext: 'pdf' };
                                                                        if (urlLower.includes('.doc')) return { mime: 'application/msword', ext: 'doc' };
                                                                        if (urlLower.includes('.docx')) return { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' };
                                                                        if (urlLower.includes('.xls')) return { mime: 'application/vnd.ms-excel', ext: 'xls' };
                                                                        if (urlLower.includes('.xlsx')) return { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' };
                                                                        if (urlLower.includes('.ppt')) return { mime: 'application/vnd.ms-powerpoint', ext: 'ppt' };
                                                                        if (urlLower.includes('.pptx')) return { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pptx' };
                                                                        if (urlLower.includes('.txt')) return { mime: 'text/plain', ext: 'txt' };
                                                                        if (urlLower.includes('.csv')) return { mime: 'text/csv', ext: 'csv' };
                                                                        if (urlLower.includes('.zip')) return { mime: 'application/zip', ext: 'zip' };
                                                                        if (urlLower.includes('.rar')) return { mime: 'application/x-rar-compressed', ext: 'rar' };
                                                                        return null;
                                                                    };

                                                                    // Use URL detection if content-type is generic
                                                                    let finalContentType = contentType;
                                                                    let fileExtension = 'bin';

                                                                    if (contentType === 'application/octet-stream' || contentType === 'binary/octet-stream') {
                                                                        const urlDetection = detectFileTypeFromUrl(message.documentUrl);
                                                                        if (urlDetection) {
                                                                            finalContentType = urlDetection.mime;
                                                                            fileExtension = urlDetection.ext;
                                                                            console.log('Detected from URL:', finalContentType, fileExtension);
                                                                        }
                                                                    } else {
                                                                        // Use content-type mapping
                                                                        const mimeToExt = {
                                                                            'application/pdf': 'pdf',
                                                                            'application/msword': 'doc',
                                                                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
                                                                            'application/vnd.ms-excel': 'xls',
                                                                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
                                                                            'application/vnd.ms-powerpoint': 'ppt',
                                                                            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
                                                                            'text/plain': 'txt',
                                                                            'text/csv': 'csv',
                                                                            'application/zip': 'zip',
                                                                            'application/x-rar-compressed': 'rar'
                                                                        };
                                                                        fileExtension = mimeToExt[contentType] || 'bin';
                                                                    }

                                                                    const blob = await response.blob();
                                                                    console.log('Blob size:', blob.size, 'Blob type:', blob.type);

                                                                    // Create blob with correct MIME type
                                                                    const correctedBlob = new Blob([blob], { type: finalContentType });
                                                                    const blobUrl = window.URL.createObjectURL(correctedBlob);

                                                                    // Extract filename from URL or use document name
                                                                    let fileName = message.documentName;
                                                                    if (!fileName) {
                                                                        // Try to extract filename from URL
                                                                        const urlParts = message.documentUrl.split('/');
                                                                        const lastPart = urlParts[urlParts.length - 1];
                                                                        if (lastPart && lastPart.includes('.')) {
                                                                            fileName = lastPart;
                                                                        } else {
                                                                            // Generate filename with correct extension
                                                                            fileName = `document-${Date.now()}.${fileExtension}`;
                                                                        }
                                                                    } else if (!fileName.includes('.')) {
                                                                        // Add extension if filename doesn't have one
                                                                        fileName = `${fileName}.${fileExtension}`;
                                                                    }

                                                                    console.log('Final filename:', fileName, 'Final MIME type:', finalContentType);

                                                                    const a = document.createElement('a');
                                                                    a.href = blobUrl;
                                                                    a.download = fileName;
                                                                    document.body.appendChild(a);
                                                                    a.click();
                                                                    document.body.removeChild(a);
                                                                    window.URL.revokeObjectURL(blobUrl);

                                                                    console.log('Download completed successfully');
                                                                } catch (error) {
                                                                    console.error('Download failed:', error);
                                                                    // Fallback to direct link
                                                                    const a = document.createElement('a');
                                                                    a.href = message.documentUrl;
                                                                    a.download = message.documentName || `document-${Date.now()}.pdf`;
                                                                    a.target = '_blank';
                                                                    document.body.appendChild(a);
                                                                    a.click();
                                                                    document.body.removeChild(a);
                                                                }
                                                            }}
                                                        >
                                                            <FaFileAlt className="text-blue-500" />
                                                            <span className="text-sm">
                                                                {message.documentName || 'Download Document'}
                                                            </span>
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Message content - editable for user messages */}
                                                {editingMessageIndex === index ? (
                                                    <div className="space-y-2">
                                                        <div className="relative">
                                                            <textarea
                                                                id={`edit-textarea-${index}`} // Added ID for ref access
                                                                value={editingMessageContent}
                                                                onChange={(e) => {
                                                                    handleEditInputChange(e);
                                                                    e.target.style.height = 'auto'; // Auto-resize
                                                                    e.target.style.height = e.target.scrollHeight + 'px';
                                                                }}
                                                                onKeyDown={(e) => handleEditKeyDown(e, index)}
                                                                className={`w-full max-w-full box-border md:min-w-[300px] p-3 text-sm text-gray-900 bg-white border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 ${themeColors.accent.replace('text-', 'focus:ring-').replace('-600', '-500')} placeholder-gray-500 shadow-inner ${editingMessageContent.length > 1800 ? 'pr-20' : ''}`}
                                                                style={{ minHeight: '100px', maxHeight: '300px', overflowY: 'auto' }} // Ensure visibility and scrolling
                                                                placeholder="Edit your message..."
                                                            // Removed autoFocus - don't auto-focus input
                                                            />
                                                            {editingMessageContent.length > 1800 && (
                                                                <div className={`absolute right-3 bottom-2 text-xs font-medium ${editingMessageContent.length > 2000 ? 'text-red-500 font-bold' : 'text-orange-500'}`}>
                                                                    {editingMessageContent.length}/2000
                                                                </div>
                                                            )}

                                                            {/* Edit Mode Property Suggestions */}
                                                            {showEditPropertySuggestions && (
                                                                <div ref={editSuggestionsRef} className={`absolute bottom-full ${message.role === 'user' ? 'right-0' : 'left-0'} mb-1 w-64 ${isDarkMode ? 'bg-gray-800 border-blue-600' : 'bg-white border-blue-300'} border-2 rounded-lg shadow-2xl z-50 max-h-48 overflow-y-auto`}>
                                                                    {propertySuggestions.length > 0 ? propertySuggestions.map((property, idx) => (
                                                                        <button
                                                                            type="button"
                                                                            key={property.id || idx}
                                                                            onMouseDown={(e) => { e.preventDefault(); handleEditSuggestionSelect(property); }}
                                                                            className={`w-full text-left p-2 text-xs border-b ${isDarkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-100 hover:bg-gray-100'} ${idx === selectedEditSuggestionIndex ? (isDarkMode ? 'bg-gray-700' : 'bg-gray-100') : ''}`}
                                                                        >
                                                                            <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'} truncate`}>{property.name}</div>
                                                                            <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} truncate`}>{property.location} • ₹{property.price.toLocaleString()}</div>
                                                                        </button>
                                                                    )) : (
                                                                        <div className="p-2 text-xs text-center text-gray-500">No properties found</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2 justify-end mt-2">
                                                            <button
                                                                onClick={() => cancelEditingMessage()}
                                                                className="px-4 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors border border-gray-300"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={() => submitEditedMessage(index)}
                                                                disabled={!editingMessageContent.trim() || isLoading || editingMessageContent.length > 2000}
                                                                className={`px-4 py-1.5 text-xs font-medium bg-gradient-to-r ${themeColors.primary} text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm`}
                                                            >
                                                                Send
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    message.isRestricted ? (
                                                        <div className={`${getFontSizeClass()} flex items-center gap-2 font-medium`}>
                                                            <FaBan size={16} className="flex-shrink-0" />
                                                            <span>
                                                                This content may violate our{' '}
                                                                <button
                                                                    onClick={() => setShowTermsModal(true)}
                                                                    className="underline hover:opacity-80 focus:outline-none"
                                                                >
                                                                    usage policies
                                                                </button>
                                                                .
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className={`${getFontSizeClass()} whitespace-pre-wrap leading-relaxed ${message.role === 'user' ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}
                                                            id={screenReaderSupport ? `message-${index}-content` : undefined}
                                                        >
                                                            {renderTextWithMarkdownAndLinks(message.content, message.role === 'user')}
                                                            
                                                            {/* Recommended Properties Slider */}
                                                            {message.role === 'assistant' && message.recommendations && message.recommendations.length > 0 && (
                                                                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/50 animate-fade-in">
                                                                    <div className="flex items-center justify-between mb-3 px-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="p-1 px-2 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                                                Handpicked for you
                                                                            </div>
                                                                            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                                                AI Recommendations
                                                                            </h4>
                                                                        </div>
                                                                        <span className="text-[10px] text-gray-500 font-medium italic">
                                                                            {message.recommendations.length} {message.recommendations.length === 1 ? 'property' : 'properties'}
                                                                        </span>
                                                                    </div>
                                                                    
                                                                    <div className="flex overflow-x-auto pb-4 gap-4 no-scrollbar scroll-smooth snap-x">
                                                                        {message.recommendations.map((property, pIdx) => (
                                                                            <div key={property._id || pIdx} className="flex-shrink-0 w-[240px] snap-start transform transition-transform duration-300 hover:scale-[1.02]">
                                                                                <ListingItem listing={property} />
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    
                                                                    <div className="flex items-center justify-center gap-1.5 mt-1 opacity-40">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                                                        <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                                                                        <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                )}
                                                {/* Message footer with timestamp and actions */}
                                                <div className={`flex items-center justify-between mt-2 pt-2 border-t ${isDarkMode ? 'border-gray-200/20' : 'border-gray-300/60'}`}>
                                                    {message.timestamp && showTimestamps && (
                                                        <div className={`${message.role === 'user' ? 'text-white/80' : message.isError ? (isDarkMode ? 'text-red-400' : 'text-red-700') : 'text-gray-500'} text-[10px]`}>
                                                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    )}

                                                    {/* Action buttons - hidden when editing */}
                                                    {editingMessageIndex !== index && (
                                                        <div className="flex gap-1 transition-all duration-200">
                                                            {/* Copy icon for all messages */}
                                                            <button
                                                                onClick={async () => {
                                                                    await copyToClipboard(message.isRestricted ? "This content may violate our usage policies." : message.content);
                                                                    setCopiedMessageIndex(index);
                                                                    setTimeout(() => setCopiedMessageIndex(null), 2000);
                                                                }}
                                                                className={`p-1 rounded transition-all duration-200 ${message.isRestricted
                                                                    ? 'text-red-700 hover:text-red-900 hover:bg-red-200/50'
                                                                    : message.role === 'user'
                                                                        ? 'text-white/80 hover:text-white hover:bg-white/20'
                                                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                                                                    }`}
                                                                title={copiedMessageIndex === index ? "Copied!" : "Copy message"}
                                                                aria-label={copiedMessageIndex === index ? "Copied!" : "Copy message"}
                                                            >
                                                                {copiedMessageIndex === index ? <FaCheck size={10} /> : <FaCopy size={10} />}
                                                            </button>

                                                            {/* Edit button for user messages */}
                                                            {message.role === 'user' && !message.isRestricted && (
                                                                <button
                                                                    onClick={() => startEditingMessage(index, message.content)}
                                                                    className="p-1 text-white/80 hover:text-white hover:bg-white/20 rounded transition-all duration-200"
                                                                    title="Edit message"
                                                                    aria-label="Edit message"
                                                                >
                                                                    <FaEdit size={10} />
                                                                </button>
                                                            )}

                                                            {/* Bookmark button for assistant messages */}
                                                            {message.role === 'assistant' && !message.isError && currentUser && (
                                                                <button
                                                                    onClick={() => toggleBookmark(index, message)}
                                                                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-all duration-200"
                                                                    title="Bookmark message"
                                                                    aria-label="Bookmark message"
                                                                >
                                                                    {(() => {
                                                                        const currentSessionId = getOrCreateSessionId();
                                                                        const bookmarkKey = `${currentSessionId}_${index}_${message.timestamp}`;
                                                                        return bookmarkedMessages.some(bm => bm.key === bookmarkKey) ?
                                                                            <FaBookmarkSolid size={10} className="text-yellow-500" /> :
                                                                            <FaRegBookmark size={10} className="text-gray-500" />
                                                                    })()}
                                                                </button>
                                                            )}

                                                            {/* Share button for assistant messages */}
                                                            {message.role === 'assistant' && !message.isError && (
                                                                <button
                                                                    onClick={() => shareMessage(message)}
                                                                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-all duration-200"
                                                                    title="Share message"
                                                                    aria-label="Share message"
                                                                >
                                                                    <FaShare size={10} />
                                                                </button>
                                                            )}

                                                            {/* Rating buttons for assistant messages */}
                                                            {message.role === 'assistant' && !message.isError && (
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        onClick={() => rateMessage(index, 'up')}
                                                                        className={`p-1 rounded transition-all duration-200 ${messageRatings[`${index}_${message.timestamp}`] === 'up'
                                                                            ? 'text-green-600 hover:text-green-700'
                                                                            : 'text-gray-500 hover:text-green-600'
                                                                            }`}
                                                                        title="Good response"
                                                                        aria-label="Good response"
                                                                    >
                                                                        <FaThumbsUp size={10} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => openDislikeModal(index)}
                                                                        className={`p-1 rounded transition-all duration-200 ${messageRatings[`${index}_${message.timestamp}`] === 'down'
                                                                            ? 'text-red-600 hover:text-red-700'
                                                                            : 'text-gray-500 hover:text-red-600'
                                                                            }`}
                                                                        title="Poor response"
                                                                        aria-label="Poor response"
                                                                    >
                                                                        <FaThumbsDown size={10} />
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {/* Retry buttons */}
                                                            {message.role === 'assistant' && (
                                                                <button
                                                                    onClick={() => {
                                                                        const previousUserMessage = (() => {
                                                                            for (let i = index - 1; i >= 0; i--) {
                                                                                if (messages[i]?.role === 'user') return messages[i].content;
                                                                            }
                                                                            return lastUserMessageRef.current;
                                                                        })();
                                                                        if (previousUserMessage) retryMessage(previousUserMessage, index);
                                                                    }}
                                                                    disabled={isLoading || (rateLimitInfo.remaining <= 0 && rateLimitInfo.role !== 'rootadmin')}
                                                                    className={`p-1 ${themeColors.accent} hover:opacity-80 hover:${themeColors.secondary} rounded transition-all duration-200 disabled:opacity-50`}
                                                                    title="Try Again"
                                                                    aria-label="Try Again"
                                                                >
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                                                        <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26l1.46-1.46C6.26 13.86 6 12.97 6 12c0-3.31 2.69-6 6-6zm5.76 1.74L16.3 9.2C17.74 10.14 18.5 11.49 18.5 13c0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z" />
                                                                    </svg>
                                                                </button>
                                                            )}

                                                            {message.role === 'assistant' && message.isError && (
                                                                <button
                                                                    onClick={() => openReportModal(message, index)}
                                                                    className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-all duration-200"
                                                                    title="Report Error"
                                                                    aria-label="Report Error"
                                                                >
                                                                    <FaFlag size={10} />
                                                                </button>
                                                            )}

                                                            {/* More Options Menu for Assistant Messages */}
                                                            {message.role === 'assistant' && !message.isError && (
                                                                <div className="relative message-menu-container">
                                                                    <button
                                                                        onClick={() => setOpenMessageMenuIndex(openMessageMenuIndex === index ? null : index)}
                                                                        className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-all duration-200"
                                                                        title="More options"
                                                                        aria-label="More options"
                                                                    >
                                                                        <FaEllipsisH size={10} />
                                                                    </button>

                                                                    {/* Dropdown Menu */}
                                                                    {openMessageMenuIndex === index && (
                                                                        <div className={`absolute bottom-full right-0 left-auto md:left-0 md:right-auto mb-2 w-48 rounded-md shadow-lg py-1 z-10 border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                                                            {/* Read Aloud Option */}
                                                                            <button
                                                                                onClick={() => {
                                                                                    handleSpeak(message.content, index);
                                                                                }}
                                                                                className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 ${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
                                                                            >
                                                                                {speakingMessageIndex === index ? (
                                                                                    <EqualizerButton isPlaying={true} onClick={() => { }} />
                                                                                ) : (
                                                                                    <FaVolumeUp size={12} />
                                                                                )}
                                                                                <span>{speakingMessageIndex === index ? 'Stop Reading' : 'Read Aloud'}</span>
                                                                            </button>

                                                                            {/* Report Option */}
                                                                            <button
                                                                                onClick={() => {
                                                                                    openReportModal(message, index);
                                                                                    setOpenMessageMenuIndex(null);
                                                                                }}
                                                                                className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 ${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
                                                                            >
                                                                                <FaFlag size={12} />
                                                                                <span>Report Message</span>
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className={`${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'} p-3 rounded-2xl`}>
                                        <div className="flex items-center space-x-3">
                                            <div className="flex space-x-1">
                                                <div className={`w-2 h-2 ${isDarkMode ? 'bg-gray-300' : 'bg-gray-400'} rounded-full animate-bounce`}></div>
                                                <div className={`w-2 h-2 ${isDarkMode ? 'bg-gray-300' : 'bg-gray-400'} rounded-full animate-bounce`} style={{ animationDelay: '0.1s' }}></div>
                                                <div className={`w-2 h-2 ${isDarkMode ? 'bg-gray-300' : 'bg-gray-400'} rounded-full animate-bounce`} style={{ animationDelay: '0.2s' }}></div>
                                            </div>
                                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} font-medium flex items-center gap-2`}>
                                                SetuAI is <ScrollingThinkingTags isDarkMode={isDarkMode} />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                            {/* scroll button moved to container-level absolute positioning */}
                        </div>

                        {/* Floating Scroll to bottom button - container-level absolute */}
                        {isScrolledUp && (
                            <div className="absolute bottom-20 right-4 z-30">
                                <button
                                    onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                                    className={`bg-gradient-to-r ${themeColors.primary} hover:opacity-90 text-white rounded-full p-3 shadow-xl transition-all duration-200 hover:scale-110 relative transform hover:shadow-2xl`}
                                    title="Jump to latest"
                                    aria-label="Jump to latest"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="transform">
                                        <path d="M12 16l-6-6h12l-6 6z" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        {/* Floating date label */}
                        {/* Removed old absolute-positioned floating date label */}


                        {/* Enhanced Features modal */}
                        {showFeatures && (
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl">
                                <div className="bg-white rounded-xl shadow-xl p-5 w-96 max-w-full max-h-[80vh] overflow-y-auto">
                                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                                        <FaRobot className="text-blue-500" />
                                        SetuAI Features
                                    </h4>
                                    <div className="space-y-4">
                                        <div>
                                            <h5 className="font-medium text-gray-800 mb-2">💬 Chat Features</h5>
                                            <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                                                <li>Real-time conversation with AI</li>
                                                <li>Multiple response tones (Neutral, Friendly, Formal, Concise) - Login Required</li>
                                                <li>Session-based chat history</li>
                                                <li>Export conversations to .txt</li>
                                                <li>Retry failed responses</li>
                                            </ul>
                                        </div>

                                        <div>
                                            <h5 className="font-medium text-gray-800 mb-2">🔖 Message Management</h5>
                                            <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                                                <li>Bookmark important responses</li>
                                                <li>Rate responses (thumbs up/down)</li>
                                                <li>Share messages via native sharing</li>
                                                <li>Copy any message to clipboard</li>
                                            </ul>
                                        </div>

                                        <div>
                                            <h5 className="font-medium text-gray-800 mb-2">⚡ Quick Actions</h5>
                                            <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                                                <li>Property search assistance</li>
                                                <li>Market analysis guidance</li>
                                                <li>Home buying process help</li>
                                                <li>Investment advice</li>
                                                <li>Legal information</li>
                                                <li>Property management tips</li>
                                            </ul>
                                        </div>

                                        <div>
                                            <h5 className="font-medium text-gray-800 mb-2">📱 User Experience</h5>
                                            <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                                                <li>Mobile-friendly responsive design</li>
                                                <li>Keyboard shortcuts (Ctrl+/, Esc)</li>
                                                <li>Auto-scroll to latest messages</li>
                                                <li>Typing indicators</li>
                                                <li>Unread message notifications</li>
                                            </ul>
                                        </div>
                                    </div>
                                    <div className="flex justify-end mt-4">
                                        <button onClick={() => setShowFeatures(false)} className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">Close</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Input */}
                        <div className="p-4 border-t border-gray-200 flex-shrink-0">
                            {/* Rate Limit Counter */}
                            {rateLimitInfo.role === 'public' && (
                                <div className="mb-3 text-center">
                                    <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${themeColors.secondary} ${themeColors.accent} border ${themeColors.border}`}>
                                        <span className="mr-1">💬</span>
                                        <span>
                                            {rateLimitInfo.remaining > 0
                                                ? `${rateLimitInfo.remaining} free prompts remaining`
                                                : 'No free prompts left'
                                            }
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Root Admin Indicator */}
                            {rateLimitInfo.role === 'rootadmin' && (
                                <div className="mb-3 text-center">
                                    <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border border-purple-200">
                                        <span className="mr-1">👑</span>
                                        <span>Unlimited AI Access - Root Admin</span>
                                    </div>
                                </div>
                            )}


                            {/* Uploaded Files Display */}
                            {uploadedFiles.length > 0 && (
                                <div className="mb-3">
                                    <div className="text-xs text-gray-500 mb-2">Attached files:</div>
                                    <div className="flex flex-wrap gap-2">
                                        {uploadedFiles.map((file, index) => (
                                            <div key={index} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-200'
                                                }`}>
                                                <FaFileAlt size={12} className="text-blue-500" />
                                                <span className="text-xs truncate max-w-[120px]">{file.name}</span>
                                                <button
                                                    onClick={() => removeUploadedFile(index)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <FaTimes size={10} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Enhanced Smart Suggestions - Contextual and Dismissible */}
                            {showSmartSuggestions && (
                                <div className={`mb-3 px-2 animate-fadeIn`}>
                                    <div className={`p-3 rounded-2xl border ${isDarkMode 
                                        ? 'bg-gray-800/40 border-gray-700/50 shadow-lg' 
                                        : `${themeColors.secondary}/80 ${themeColors.border}/40 shadow-sm`} relative group backdrop-blur-sm`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1.5 rounded-lg shadow-sm ${
                                                    isDarkMode 
                                                        ? `bg-opacity-20 bg-white border border-white/10` 
                                                        : `bg-gradient-to-r ${themeColors.primary} text-white`
                                                }`}>
                                                    <FaLightbulb size={12} className={isDarkMode ? themeColors.accent : "text-white animate-pulse"} />
                                                </div>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    Smart Suggestions
                                                </span>
                                            </div>
                                            <button 
                                                onClick={() => setShowSmartSuggestions(false)}
                                                className={`p-1 rounded-full transition-all duration-200 ${isDarkMode 
                                                    ? 'hover:bg-gray-700 text-gray-500' 
                                                    : `hover:bg-white text-gray-400 shadow-sm border border-transparent hover:border-red-100`} hover:text-red-500`}
                                                title="Dismiss"
                                            >
                                                <FaTimes size={10} />
                                            </button>
                                        </div>
                                        
                                        <div className="flex flex-nowrap gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
                                            {smartSuggestions.map((suggestion, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => handleSmartSuggestion(suggestion)}
                                                    className={`text-[11px] px-3 py-1.5 rounded-xl border transition-all duration-300 hover:scale-[1.03] active:scale-95 whitespace-nowrap flex-shrink-0 ${isDarkMode
                                                        ? `bg-gray-900/60 border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-white/20 hover:text-white`
                                                        : `bg-white ${themeColors.border} ${themeColors.accent} hover:bg-gray-50 shadow-sm`
                                                        }`}
                                                    style={{ 
                                                        animationDelay: `${index * 50}ms`,
                                                        borderColor: isDarkMode ? undefined : themeColors.border.replace('border-', '')
                                                    }}
                                                >
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className={`flex space-x-2 items-end`}>
                                <div className="flex-1 relative">
                                    {/* Voice Meter / Input Box Toggle */}
                                    {(isListening || isProcessingVoice) ? (
                                        <div className={`w-full h-10 px-4 flex items-center justify-between border rounded-full ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}`}>
                                            <div className="flex items-center gap-1 h-5">
                                                {/* Simulated Audio Visualizer Bars */}
                                                {[...Array(5)].map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`w-1 rounded-full animate-voice-bar ${isDarkMode ? 'bg-blue-400' : 'bg-blue-600'}`}
                                                        style={{
                                                            height: '100%',
                                                            animationDelay: `${i * 0.1}s`,
                                                            animationDuration: '0.5s'
                                                        }}
                                                    />
                                                ))}
                                                <span className={`ml-3 text-sm font-medium animate-pulse ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                    {isProcessingVoice ? 'Processing...' : 'Listening...'}
                                                </span>
                                            </div>
                                            {/* Stop Button inside Visualizer */}
                                            <button
                                                type="button"
                                                onClick={toggleVoiceInput}
                                                className={`p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-red-500 transition-colors`}
                                                title="Stop Recording"
                                            >
                                                <FaStop size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div ref={inputOptionsRef} className="absolute left-2 bottom-0 h-[48px] flex items-center z-10">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowInputOptions(!showInputOptions)}
                                                    className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-600'}`}
                                                    title="More options"
                                                    disabled={isListening || isProcessingVoice}
                                                >
                                                    <FaEllipsisV size={16} />
                                                </button>

                                                {/* Options Menu */}
                                                {showInputOptions && (
                                                    <div className={`absolute bottom-10 left-0 w-48 rounded-lg shadow-xl border overflow-hidden z-50 transform origin-bottom-left transition-all duration-200 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (!currentUser) {
                                                                    toast.info('Please login to upload files');
                                                                    return;
                                                                }
                                                                setShowFileUpload(true);
                                                                setShowInputOptions(false);
                                                            }}
                                                            className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-50 text-gray-700'}`}
                                                        >
                                                            <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                                                                <FaPaperclip size={14} />
                                                            </div>
                                                            <span className="text-sm font-medium">Upload File</span>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                toggleVoiceInput();
                                                                setShowInputOptions(false);
                                                            }}
                                                            className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-50 text-gray-700'}`}
                                                        >
                                                            <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'}`}>
                                                                <FaMicrophone size={14} />
                                                            </div>
                                                            <span className="text-sm font-medium">Voice Input</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <textarea
                                                ref={inputRef}
                                                value={inputMessage}
                                                onChange={(e) => {
                                                    handleInputChange(e);
                                                }}
                                                onKeyDown={(e) => {
                                                    // Handle Enter to send, Ctrl+Enter or Shift+Enter for new line
                                                    if (e.key === 'Enter') {
                                                        if (e.shiftKey) {
                                                            // Shift+Enter handles itself natively (new line)
                                                            return;
                                                        } else if (e.ctrlKey) {
                                                            // Ctrl+Enter needs manual handling to act as new line
                                                            e.preventDefault();
                                                            const start = e.target.selectionStart;
                                                            const end = e.target.selectionEnd;
                                                            const value = inputMessage;
                                                            const newValue = value.substring(0, start) + '\n' + value.substring(end);

                                                            setInputMessage(newValue);

                                                            // Restore cursor position
                                                            setTimeout(() => {
                                                                if (inputRef.current) {
                                                                    inputRef.current.selectionStart = inputRef.current.selectionEnd = start + 1;
                                                                }
                                                            }, 0);
                                                        } else {
                                                            // Enter alone sends message
                                                            e.preventDefault();
                                                            handleSubmit(e);
                                                        }
                                                    }

                                                    // Ctrl+Z to restore previously sent messages (History navigation)
                                                    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                                                        const history = messageHistoryRef.current;
                                                        if (history.length > 0) {
                                                            // If input is empty, start from the latest
                                                            if (!inputMessage) {
                                                                e.preventDefault();
                                                                historyIndexRef.current = history.length - 1;
                                                                setInputMessage(history[historyIndexRef.current]);
                                                            }
                                                            // If currently viewing a history message, go back one more
                                                            else if (historyIndexRef.current !== -1 && inputMessage === history[historyIndexRef.current]) {
                                                                e.preventDefault();
                                                                const nextIndex = historyIndexRef.current - 1;
                                                                if (nextIndex >= 0) {
                                                                    historyIndexRef.current = nextIndex;
                                                                    setInputMessage(history[nextIndex]);
                                                                }
                                                            }

                                                        }
                                                    }

                                                    handleKeyDown(e);
                                                }}
                                                placeholder={(rateLimitInfo.remaining <= 0 && rateLimitInfo.role !== 'rootadmin') ? "Sign in to continue chatting..." : "Ask me anything about real estate or @mention a property..."}
                                                aria-label="Type your message"
                                                aria-describedby="input-help"
                                                role="textbox"
                                                rows={1}
                                                className={`w-full pl-12 ${inputMessage.length > 1800 ? 'pr-24' : 'pr-12'} py-3 border rounded-2xl resize-none focus:outline-none focus:ring-2 ${themeColors.accent.replace('text-', 'focus:ring-').replace('-600', '-500')} focus:border-transparent text-sm transition-all duration-200 ${isDarkMode
                                                    ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-400 backdrop-blur-sm'
                                                    : 'bg-white border-gray-200 text-gray-900 shadow-sm hover:border-gray-300'
                                                    }`}
                                                style={{ minHeight: '48px', maxHeight: '250px' }}
                                                disabled={(rateLimitInfo.remaining <= 0 && rateLimitInfo.role !== 'rootadmin')}
                                            />
                                            {inputMessage.length > 1800 && (
                                                <div className={`absolute right-3 bottom-3 text-xs font-medium ${inputMessage.length > 2000 ? 'text-red-500 font-bold' : 'text-orange-500'}`}>
                                                    {inputMessage.length}/2000
                                                </div>
                                            )}
                                            {screenReaderSupport && (
                                                <div id="input-help" className="sr-only">
                                                    Press Enter to send your message, or Shift+Enter for a new line.
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Property Suggestions Dropdown */}
                                    {showPropertySuggestions && (
                                        <div ref={suggestionsRef} className={`absolute bottom-full left-0 right-0 mb-2 ${isDarkMode ? 'bg-gray-800 border-blue-600' : 'bg-white border-blue-300'} border-2 rounded-lg shadow-2xl z-50 max-h-60 overflow-y-auto animate-fadeIn`}
                                            style={{
                                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                                                minWidth: '300px'
                                            }}>
                                            <div className={`p-3 text-sm font-medium ${isDarkMode ? 'text-blue-400 border-gray-600 bg-blue-900/20' : 'text-blue-600 border-gray-200 bg-blue-50'} border-b`}>
                                                <div className="flex items-center gap-2">
                                                    {isLoadingSuggestions ? (
                                                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                    ) : (
                                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                                    )}
                                                    {isLoadingSuggestions ? 'Loading properties...' :
                                                        propertySuggestions.length > 0 ? 'Select a property to reference:' : 'No properties found'}
                                                </div>
                                            </div>
                                            {propertySuggestions.length > 0 ? propertySuggestions.map((property, index) => (
                                                <button
                                                    type="button"
                                                    key={property.id}
                                                    onMouseDown={(e) => { e.preventDefault(); handleSuggestionSelect(property); }}
                                                    className={`w-full text-left p-3 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors ${index === selectedSuggestionIndex ? (isDarkMode ? 'bg-gray-700' : 'bg-gray-100') : ''
                                                        }`}
                                                >
                                                    <div className="flex items-center space-x-3">
                                                        {property.image && (
                                                            <img
                                                                src={property.image}
                                                                alt={property.name}
                                                                className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                                                            />
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'} truncate`}>
                                                                {property.name}
                                                            </div>
                                                            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                {property.location}
                                                            </div>
                                                            <div className={`text-sm font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                                                                ₹{property.price.toLocaleString()}
                                                            </div>
                                                            <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                {property.bedrooms}BHK • {property.area} sq ft • {property.type}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            )) : (
                                                <div className={`p-3 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-center`}>
                                                    No properties found. Try typing more characters.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>



                                {/* File Upload Button Removed (Moved to input left) */}

                                {isLoading ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            abortControllerRef.current?.abort();
                                            setIsLoading(false);
                                            toast.info('Generating stopped.', {
                                                icon: '🛑',
                                                style: {
                                                    borderRadius: '10px',
                                                    background: isDarkMode ? '#333' : '#fff',
                                                    color: isDarkMode ? '#fff' : '#333',
                                                }
                                            });
                                        }}
                                        className="bg-red-600 hover:bg-red-700 text-white p-2.5 rounded-full hover:opacity-90 transition-all duration-300 transform hover:scale-110 flex-shrink-0 flex items-center justify-center w-12 h-12 group hover:shadow-2xl active:scale-95 shadow-lg border-2 border-white/20"
                                        title="Stop generating"
                                        aria-label="Stop generating"
                                    >
                                        <div className="relative flex items-center justify-center">
                                            <div className="absolute inset-0 bg-white/20 rounded-full animate-ping opacity-25"></div>
                                            <svg className="w-5 h-5 text-white relative z-10" fill="currentColor" viewBox="0 0 24 24">
                                                <rect x="6" y="6" width="12" height="12" rx="2" />
                                            </svg>
                                        </div>
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        onMouseDown={(e) => e.preventDefault()}
                                        disabled={!inputMessage.trim() || inputMessage.length > 2000 || isListening || isProcessingVoice || (rateLimitInfo.remaining <= 0 && rateLimitInfo.role !== 'rootadmin')}
                                        className={`bg-gradient-to-r ${themeColors.primary} text-white p-2 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-110 flex-shrink-0 flex items-center justify-center w-12 h-12 group hover:shadow-2xl active:scale-95 shadow-lg border-b-4 border-black/10`}
                                        aria-label="Send message"
                                        title="Send message"
                                    >
                                        <div className="relative">
                                            {sendIconSent ? (
                                                <FaCheck className="text-white send-icon animate-sent" size={20} />
                                            ) : (
                                                <FaPaperPlane className={`text-white send-icon ${sendIconAnimating ? 'animate-fly' : ''} group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300`} size={20} />
                                            )}
                                        </div>
                                    </button>
                                )}
                            </form>
                        </div>
                        {/* Quick Actions Modal */}
                        {showQuickActions && (
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl animate-fadeIn">
                                <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl p-5 w-96 max-w-full animate-scaleIn`}>
                                    <h4 className={`font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                        <FaLightbulb className="text-yellow-500" />
                                        Quick Actions
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { icon: '🏠', text: 'Property Search', prompt: 'Help me find properties in my area' },
                                            { icon: '💰', text: 'Market Analysis', prompt: 'Analyze the real estate market trends' },
                                            { icon: '📋', text: 'Buying Guide', prompt: 'Guide me through the home buying process' },
                                            { icon: '📊', text: 'Investment Tips', prompt: 'Give me real estate investment advice' },
                                            { icon: '⚖️', text: 'Legal Info', prompt: 'Explain real estate legal requirements' },
                                            { icon: '🔧', text: 'Property Management', prompt: 'Help with property management tips' }
                                        ].map((action, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    setInputMessage(action.prompt);
                                                    setShowQuickActions(false);
                                                    setTimeout(() => handleSubmit(new Event('submit')), 0);
                                                }}
                                                className={`p-3 text-left border ${isDarkMode ? 'border-gray-600' : 'border-gray-200'} rounded-lg ${isDarkMode ? 'hover:bg-gray-700 hover:border-gray-500' : 'hover:bg-gray-50 hover:border-blue-300'} transition-all duration-200`}
                                            >
                                                <div className="text-lg mb-1">{action.icon}</div>
                                                <div className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{action.text}</div>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex justify-end mt-4">
                                        <button onClick={() => setShowQuickActions(false)} className={`px-3 py-1.5 text-sm rounded bg-gradient-to-r ${themeColors.primary} text-white hover:opacity-90`}>Close</button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* Bookmarks Modal */}
                        {showBookmarks && (
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl animate-fadeIn">
                                <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl p-5 w-96 max-w-full max-h-[80vh] overflow-y-auto animate-scaleIn`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className={`font-semibold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                            <FaBookmark className="text-yellow-500" />
                                            Bookmarked Messages
                                        </h4>
                                        <button
                                            onClick={async () => {
                                                if (refreshingBookmarks) return; // Prevent multiple clicks
                                                setRefreshingBookmarks(true);
                                                try {
                                                    const currentSessionId = getOrCreateSessionId();
                                                    await loadBookmarkedMessages(currentSessionId);
                                                    toast.success('Bookmarks refreshed successfully');
                                                } catch (error) {
                                                    toast.error('Failed to refresh bookmarks');
                                                } finally {
                                                    setRefreshingBookmarks(false);
                                                }
                                            }}
                                            disabled={refreshingBookmarks}
                                            className={`p-2 rounded-lg transition-all duration-200 ${refreshingBookmarks
                                                ? 'opacity-50 cursor-not-allowed'
                                                : isDarkMode
                                                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white'
                                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800'
                                                }`}
                                            title={refreshingBookmarks ? "Refreshing..." : "Refresh bookmarks"}
                                            aria-label={refreshingBookmarks ? "Refreshing bookmarks" : "Refresh bookmarks"}
                                        >
                                            {refreshingBookmarks ? (
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                    {bookmarkedMessages.length === 0 ? (
                                        <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-center py-8`}>No bookmarked messages in this chat</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {bookmarkedMessages.map((bookmark, idx) => (
                                                <div key={idx} className={`p-3 border ${isDarkMode ? 'border-gray-600' : 'border-gray-200'} rounded-lg`}>
                                                    <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                                                        {new Date(bookmark.timestamp).toLocaleString()}
                                                    </div>
                                                    <div className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} mb-2 line-clamp-3`}>
                                                        {bookmark.content}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                highlightMessage(bookmark.key);
                                                                setShowBookmarks(false);
                                                            }}
                                                            className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'bg-blue-900/30 hover:bg-blue-800 text-blue-300' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'}`}
                                                        >
                                                            Go to Message
                                                        </button>
                                                        <button
                                                            onClick={() => copyToClipboard(bookmark.content)}
                                                            className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                                                        >
                                                            Copy
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const currentSessionId = getOrCreateSessionId();
                                                                toggleBookmark(bookmark.messageIndex || 0, { content: bookmark.content, timestamp: bookmark.timestamp });
                                                            }}
                                                            className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'bg-red-900/30 hover:bg-red-800 text-red-300' : 'bg-red-100 hover:bg-red-200 text-red-700'}`}
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex justify-end mt-4">
                                        <button onClick={() => setShowBookmarks(false)} className={`px-3 py-1.5 text-sm rounded bg-gradient-to-r ${themeColors.primary} text-white hover:opacity-90`}>Close</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Chat History Modal */}
                        {showHistory && (
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl animate-fadeIn">
                                <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl w-96 max-w-full max-h-[80vh] flex flex-col animate-scaleIn`}>
                                    {/* Fixed Header */}
                                    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                                        <h4 className={`font-semibold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                            <FaHistory className="text-blue-500" />
                                            Chat History
                                        </h4>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setShowDeleteAllModal(true)}
                                                className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                                            >
                                                Delete All
                                            </button>
                                            <button
                                                onClick={() => { createNewSession(); setShowHistory(false); }}
                                                className="px-3 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-700 flex items-center gap-1"
                                            >
                                                <FaComments size={10} />
                                                New Chat
                                            </button>
                                        </div>
                                    </div>

                                    {/* Scrollable Content */}
                                    <div className="flex-1 overflow-y-auto p-4">
                                        {chatSessions.length === 0 ? (
                                            <div className="text-center py-8 space-y-3">
                                                <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No chats yet</p>
                                                <button
                                                    onClick={async () => { await createNewSession(); await loadChatSessions(); setShowHistory(false); }}
                                                    className="px-3 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-700"
                                                >
                                                    Create First Chat
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {chatSessions.map((session, idx) => {
                                                    const isActiveSession = session.sessionId === getOrCreateSessionId();
                                                    return (
                                                        <div
                                                            key={session.sessionId || idx}
                                                            className={`p-3 border rounded-lg transition-all duration-300 ${isActiveSession
                                                                ? `${isDarkMode ? `${themeColors.accent.replace('text-', 'bg-')}/20 ${themeColors.accent.replace('text-', 'border-')}` : `${themeColors.secondary} ${themeColors.accent.replace('text-', 'border-')}`}`
                                                                : `${isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}`
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <input
                                                                    type="checkbox"
                                                                    className={`mt-1 w-3.5 h-3.5 ${themeColors.accent.replace('text-', 'accent-')} border-gray-300 rounded focus:ring-1 dark:border-gray-600 dark:ring-offset-gray-800`}
                                                                    style={{
                                                                        backgroundColor: 'transparent' // Remove background highlighting
                                                                    }}
                                                                    checked={selectedHistoryIds.includes(session.sessionId)}
                                                                    onChange={(e) => {
                                                                        const id = session.sessionId;
                                                                        setSelectedHistoryIds(prev => e.target.checked ? [...prev, id] : prev.filter(x => x !== id));
                                                                    }}
                                                                    aria-label="Select chat"
                                                                />
                                                                <button
                                                                    onClick={() => {
                                                                        const sName = session.name && !/^Chat \d/i.test(session.name) ? session.name : '';
                                                                        setCurrentChatName(sName);
                                                                        loadSessionHistory(session.sessionId);
                                                                        setShowHistory(false);
                                                                    }}
                                                                    className="flex-1 text-left"
                                                                >
                                                                    <div className={`text-sm font-medium flex items-center gap-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                                        {isActiveSession && isGeneratingTitle ? (
                                                                            <div className="flex items-center gap-2 animate-pulse">
                                                                                <div className="h-3.5 w-24 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
                                                                                <span className="text-[10px] text-blue-500 font-bold uppercase tracking-tighter">Naming...</span>
                                                                            </div>
                                                                        ) : (
                                                                            isActiveSession ? (
                                                                                <TypewriterText text={session.name?.trim() ? session.name : `New chat ${idx + 1}`} />
                                                                            ) : (
                                                                                session.name?.trim() ? session.name : `New chat ${idx + 1}`
                                                                            )
                                                                        )}
                                                                        {isActiveSession && (
                                                                            <span className={`px-2 py-0.5 text-xs rounded-full ${isDarkMode ? `${themeColors.accent.replace('text-', 'bg-')} text-white` : `bg-gradient-to-r ${themeColors.primary} text-white`} font-medium`}>
                                                                                Active
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                        {new Date(session.lastMessageAt).toLocaleString()}
                                                                    </div>
                                                                    <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                                                        {session.messageCount} messages
                                                                    </div>
                                                                </button>
                                                                <div className="relative">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setOpenHistoryMenuSessionId(prev => prev === session.sessionId ? null : session.sessionId);
                                                                        }}
                                                                        className="ml-2 p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-all duration-200"
                                                                        title="Chat options"
                                                                        data-chat-options-dropdown
                                                                    >
                                                                        ⋯
                                                                    </button>
                                                                    {openHistoryMenuSessionId === session.sessionId && (
                                                                        <div className={`absolute right-0 top-6 ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'} border rounded shadow-lg z-10 w-36`} data-chat-options-dropdown>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    if (session.messageCount <= 1) {
                                                                                        toast.info("Cannot share empty conversation");
                                                                                        return;
                                                                                    }
                                                                                    setShareTargetSessionId(session.sessionId);
                                                                                    setIsShareModalOpen(true);
                                                                                    setOpenHistoryMenuSessionId(null);
                                                                                }}
                                                                                className={`block w-full text-left px-3 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-800 hover:bg-gray-100'} ${session.messageCount <= 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                            >
                                                                                Share chat
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setDeleteTargetSessionId(session.sessionId);
                                                                                    setShowDeleteSingleModal(true);
                                                                                }}
                                                                                className={`block w-full text-left px-3 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-800 hover:bg-gray-100'}`}
                                                                            >
                                                                                Delete chat
                                                                            </button>
                                                                            <button
                                                                                onClick={async (e) => {
                                                                                    e.stopPropagation();
                                                                                    if (session.messageCount <= 1) {
                                                                                        toast.info("Cannot save empty conversation");
                                                                                        return;
                                                                                    }
                                                                                    try {
                                                                                        const resp = await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${session.sessionId}`);
                                                                                        const data = await resp.json();
                                                                                        if (!resp.ok || !data?.data?.messages) throw new Error('load');
                                                                                        const lines = data.data.messages.map(m => `${m.role === 'user' ? 'You' : 'SetuAI'}: ${m.content}`);
                                                                                        const blob = new Blob([lines.join('\n\n')], { type: 'text/plain;charset=utf-8' });
                                                                                        const url = URL.createObjectURL(blob);
                                                                                        const a = document.createElement('a');
                                                                                        a.href = url;
                                                                                        a.download = `setuai_chat_${new Date().toISOString().split('T')[0]}.txt`;
                                                                                        document.body.appendChild(a);
                                                                                        a.click();
                                                                                        document.body.removeChild(a);
                                                                                        URL.revokeObjectURL(url);
                                                                                        setOpenHistoryMenuSessionId(null);
                                                                                    } catch {
                                                                                        toast.error('Failed to save chat');
                                                                                    }
                                                                                }}
                                                                                className={`block w-full text-left px-3 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-800 hover:bg-gray-100'} ${session.messageCount <= 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                            >
                                                                                Save chat
                                                                            </button>
                                                                            <button
                                                                                onClick={async (e) => {
                                                                                    e.stopPropagation();
                                                                                    setRenameTargetSessionId(session.sessionId);
                                                                                    // Fetch current name from backend to ensure it's up-to-date
                                                                                    const currentName = await fetchSessionName(session.sessionId);
                                                                                    setRenameInput(currentName || '');
                                                                                    setShowRenameModal(true);
                                                                                }}
                                                                                className={`block w-full text-left px-3 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-800 hover:bg-gray-100'}`}
                                                                            >
                                                                                Rename
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Fixed Footer */}
                                    <div className="flex justify-between items-center p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                                        <div>
                                            {selectedHistoryIds.length > 0 && (
                                                <button
                                                    onClick={() => setShowDeleteSelectedModal(true)}
                                                    className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700 transition-all duration-200"
                                                >
                                                    Delete Selected ({selectedHistoryIds.length})
                                                </button>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => { setShowHistory(false); setOpenHistoryMenuSessionId(null); }}
                                            className={`px-4 py-2 text-sm rounded bg-gradient-to-r ${themeColors.primary} text-white hover:opacity-90 transition-all duration-200`}
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Clear confirmation modal */}
                        {showConfirmClear && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 rounded-2xl animate-fadeIn">
                                <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl p-5 w-80 animate-scaleIn`}>
                                    <h4 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Clear chat?</h4>
                                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-4`}>This will remove your conversation here. This action cannot be undone.</p>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setShowConfirmClear(false)} className={`px-3 py-1.5 text-sm rounded border ${isDarkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'}`}>Cancel</button>
                                        <button onClick={() => { setShowConfirmClear(false); handleClearChatHistory(); }} className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700">Clear</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Delete All Chats Modal */}
                        {showDeleteAllModal && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 rounded-2xl animate-fadeIn">
                                <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl p-5 w-80 animate-scaleIn`}>
                                    <h4 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Delete all chats?</h4>
                                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-4`}>This cannot be undone.</p>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setShowDeleteAllModal(false)} className={`px-3 py-1.5 text-sm rounded border ${isDarkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'}`}>Cancel</button>
                                        <button onClick={async () => {
                                            try {
                                                await authenticatedFetch(`${API_BASE_URL}/api/gemini/sessions`, { method: 'DELETE' });
                                                await createNewSession();
                                                await loadChatSessions();
                                                toast.success('All chats deleted');
                                                setShowHistory(false);
                                            } catch (e) {
                                                toast.error('Failed to delete all chats');
                                            } finally {
                                                setShowDeleteAllModal(false);
                                            }
                                        }} className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700">Delete</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Delete Selected Chats Modal */}
                        {showDeleteSelectedModal && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 rounded-2xl animate-fadeIn">
                                <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl p-5 w-80 animate-scaleIn`}>
                                    <h4 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Delete selected chats?</h4>
                                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-4`}>This cannot be undone.</p>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setShowDeleteSelectedModal(false)} className={`px-3 py-1.5 text-sm rounded border ${isDarkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'}`}>Cancel</button>
                                        <button onClick={async () => {
                                            try {
                                                for (const id of selectedHistoryIds) { await deleteSession(id); }
                                                setSelectedHistoryIds([]);
                                                await loadChatSessions();
                                                toast.success('Selected chats deleted');
                                            } catch (e) {
                                                toast.error('Failed to delete selected chats');
                                            } finally {
                                                setShowDeleteSelectedModal(false);
                                            }
                                        }} className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700">Delete</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Delete Single Chat Modal */}
                        {showDeleteSingleModal && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 rounded-2xl animate-fadeIn">
                                <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl p-5 w-80 animate-scaleIn`}>
                                    <h4 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Delete this chat?</h4>
                                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-4`}>This cannot be undone.</p>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setShowDeleteSingleModal(false)} className={`px-3 py-1.5 text-sm rounded border ${isDarkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'}`}>Cancel</button>
                                        <button onClick={async () => {
                                            try {
                                                if (deleteTargetSessionId) { await deleteSession(deleteTargetSessionId); }
                                                await loadChatSessions();
                                                toast.success('Chat deleted');
                                            } catch (e) {
                                                toast.error('Failed to delete chat');
                                            } finally {
                                                setDeleteTargetSessionId(null);
                                                setShowDeleteSingleModal(false);
                                                setOpenHistoryMenuSessionId(null);
                                            }
                                        }} className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700">Delete</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Rename Chat Modal */}
                        {showRenameModal && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 rounded-2xl animate-fadeIn">
                                <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl p-5 w-96 max-w-full animate-scaleIn`}>
                                    <h4 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Rename chat</h4>
                                    <input
                                        type="text"
                                        value={renameInput}
                                        onChange={(e) => setRenameInput(e.target.value)}
                                        className={`w-full px-3 py-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'} rounded mb-4`}
                                        placeholder="Enter chat name"
                                        maxLength={80}
                                    // Removed autoFocus - don't auto-focus input
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => { setShowRenameModal(false); setRenameTargetSessionId(null); }} className={`px-3 py-1.5 text-sm rounded border ${isDarkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'}`}>Cancel</button>
                                        <button onClick={async () => {
                                            try {
                                                const name = renameInput.trim();
                                                await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${renameTargetSessionId}`, {
                                                    method: 'PUT',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ name })
                                                });
                                                await loadChatSessions();
                                                toast.success('Chat renamed');
                                            } catch {
                                                toast.error('Failed to rename chat');
                                            } finally {
                                                setShowRenameModal(false);
                                                setRenameTargetSessionId(null);
                                                setOpenHistoryMenuSessionId(null);
                                            }
                                        }} className={`px-3 py-1.5 text-sm rounded bg-gradient-to-r ${themeColors.primary} text-white hover:opacity-90`}>Save</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Sign In Modal for Prompt Limit */}
                        {showSignInModal && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 rounded-2xl">
                                <div className={`max-w-md mx-4 p-6 rounded-2xl shadow-2xl border-2 border-dashed ${isDarkMode ? 'bg-gray-800/95 border-gray-600' : 'bg-white/95 border-blue-200'} transition-all duration-300`}>
                                    <div className="text-center">
                                        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                                            {!currentUser ? (
                                                <svg className={`w-8 h-8 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                            ) : (
                                                <FaRobot className={`w-8 h-8 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                                            )}
                                        </div>

                                        {!currentUser ? (
                                            <>
                                                <h3 className={`text-xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                                                    Sign in to unlock full chatbot features
                                                </h3>
                                                <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                    Get access to advanced AI settings, voice input, file uploads, chat history, and much more!
                                                </p>
                                                <p className={`text-xs mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} italic border-t border-dashed pt-2 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                                                    To ensure fair usage and prevent system abuse on our servers, we have restricted guest access. Sign in to enjoy unlimited seamless conversations.
                                                </p>
                                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                                    <button
                                                        onClick={() => {
                                                            setIsOpen(false);
                                                            navigate('/sign-in?redirect=/ai');
                                                        }}
                                                        className="px-6 py-3 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 hover:shadow-lg hover:scale-105"
                                                    >
                                                        Sign In
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setIsOpen(false);
                                                            navigate('/sign-up');
                                                        }}
                                                        className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 hover:shadow-lg hover:scale-105 ${isDarkMode
                                                            ? 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'
                                                            : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
                                                            }`}
                                                    >
                                                        Create Account
                                                    </button>
                                                </div>
                                                <div className="mt-4">
                                                    <button
                                                        onClick={() => setShowSignInModal(false)}
                                                        className={`text-xs ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
                                                    >
                                                        Maybe Later
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                                    Rate Limit Reached
                                                </h3>
                                                <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                    You have reached the maximum number of messages allowed for your account tier. Please try again later.
                                                </p>
                                                <button
                                                    onClick={() => setShowSignInModal(false)}
                                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors duration-200"
                                                >
                                                    Understood
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {showSettings && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 rounded-2xl animate-fadeIn">
                                <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl shadow-xl w-[500px] max-w-full max-h-[80vh] flex flex-col animate-scaleIn`}>
                                    {/* Fixed Header */}
                                    <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                                        <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                            Settings & Themes
                                        </h3>
                                        <button
                                            onClick={() => setShowSettings(false)}
                                            className={`text-gray-500 hover:text-gray-700 ${isDarkMode ? 'hover:text-gray-300' : ''}`}
                                        >
                                            <FaTimes size={20} />
                                        </button>
                                    </div>

                                    {/* Scrollable Content */}
                                    <div className="flex-1 overflow-y-auto p-6">

                                        <div className="space-y-6">
                                            {/* Theme Selection */}
                                            <div>
                                                <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    Theme Color
                                                </label>
                                                <div className="grid grid-cols-5 gap-3">
                                                    {['blue', 'green', 'purple', 'orange', 'red', 'indigo', 'teal', 'pink', 'yellow', 'cyan'].map((theme) => (
                                                        <button
                                                            key={theme}
                                                            onClick={() => {
                                                                setSelectedTheme(theme);
                                                                setUserSetting('gemini_theme', theme);
                                                            }}
                                                            className={`w-10 h-10 rounded-full border-2 transition-all duration-200 ${selectedTheme === theme ? 'border-gray-400 scale-110' : 'border-gray-200 hover:scale-105'
                                                                } ${theme === 'blue' ? 'bg-gradient-to-br from-blue-500 to-purple-500' :
                                                                    theme === 'green' ? 'bg-gradient-to-br from-green-500 to-emerald-500' :
                                                                        theme === 'purple' ? 'bg-gradient-to-br from-purple-500 to-pink-500' :
                                                                            theme === 'orange' ? 'bg-gradient-to-br from-orange-500 to-red-500' :
                                                                                theme === 'red' ? 'bg-gradient-to-br from-red-500 to-pink-500' :
                                                                                    theme === 'indigo' ? 'bg-gradient-to-br from-indigo-500 to-blue-500' :
                                                                                        theme === 'teal' ? 'bg-gradient-to-br from-teal-500 to-cyan-500' :
                                                                                            theme === 'pink' ? 'bg-gradient-to-br from-pink-500 to-rose-500' :
                                                                                                theme === 'yellow' ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                                                                                                    'bg-gradient-to-br from-cyan-500 to-blue-500'
                                                                }`}
                                                            title={theme.charAt(0).toUpperCase() + theme.slice(1)}
                                                        />
                                                    ))}
                                                    {/* Custom Theme Button */}
                                                    <button
                                                        onClick={() => setShowCustomThemePicker(!showCustomThemePicker)}
                                                        className={`w-10 h-10 rounded-full border-2 transition-all duration-200 ${selectedTheme === 'custom' ? 'border-gray-400 scale-110' : 'border-gray-200 hover:scale-105'
                                                            } ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} flex items-center justify-center`}
                                                        title="Custom Theme"
                                                    >
                                                        <FaPalette size={16} className={isDarkMode ? 'text-gray-300' : 'text-gray-600'} />
                                                    </button>
                                                </div>

                                                {/* Custom Theme Picker */}
                                                {showCustomThemePicker && (
                                                    <div className={`mt-4 p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                                                        <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            Create Custom Theme
                                                        </h4>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <label className={`block text-xs mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                    Primary Color
                                                                </label>
                                                                <select
                                                                    className={`w-full p-2 rounded border text-sm ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                                                    onChange={(e) => {
                                                                        const primary = e.target.value;
                                                                        const secondary = customTheme?.secondaryColor || 'purple';
                                                                        createCustomTheme(primary, secondary);
                                                                    }}
                                                                >
                                                                    {['blue', 'green', 'purple', 'orange', 'red', 'indigo', 'teal', 'pink', 'yellow', 'cyan'].map(color => (
                                                                        <option key={color} value={color}>{color.charAt(0).toUpperCase() + color.slice(1)}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className={`block text-xs mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                    Secondary Color
                                                                </label>
                                                                <select
                                                                    className={`w-full p-2 rounded border text-sm ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                                                    onChange={(e) => {
                                                                        const secondary = e.target.value;
                                                                        const primary = customTheme?.primaryColor || 'blue';
                                                                        createCustomTheme(primary, secondary);
                                                                    }}
                                                                >
                                                                    {['blue', 'green', 'purple', 'orange', 'red', 'indigo', 'teal', 'pink', 'yellow', 'cyan'].map(color => (
                                                                        <option key={color} value={color}>{color.charAt(0).toUpperCase() + color.slice(1)}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Display Settings */}
                                            <div>
                                                <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    Display Settings
                                                </h4>
                                                <div className="space-y-4">


                                                    {/* Font Size */}
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            Font Size
                                                        </span>
                                                        <select
                                                            value={fontSize}
                                                            onChange={(e) => updateFontSize(e.target.value)}
                                                            className={`px-3 py-1 rounded border text-sm ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                                        >
                                                            <option value="small">Small</option>
                                                            <option value="medium">Medium</option>
                                                            <option value="large">Large</option>
                                                        </select>
                                                    </div>

                                                    {/* Message Density */}
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            Message Density
                                                        </span>
                                                        <select
                                                            value={messageDensity}
                                                            onChange={(e) => updateMessageDensity(e.target.value)}
                                                            className={`px-3 py-1 rounded border text-sm ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                                        >
                                                            <option value="compact">Compact</option>
                                                            <option value="comfortable">Comfortable</option>
                                                            <option value="spacious">Spacious</option>
                                                        </select>
                                                    </div>

                                                    {/* Auto Scroll */}
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            Auto Scroll to New Messages
                                                        </span>
                                                        <button
                                                            onClick={() => updateAutoScroll(!autoScroll)}
                                                            className={getToggleSwitchClasses(autoScroll)}
                                                        >
                                                            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${autoScroll ? 'translate-x-6' : 'translate-x-0.5'
                                                                }`} />
                                                        </button>
                                                    </div>

                                                    {/* Show Timestamps */}
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            Show Message Timestamps
                                                        </span>
                                                        <button
                                                            onClick={() => updateShowTimestamps(!showTimestamps)}
                                                            className={getToggleSwitchClasses(showTimestamps)}
                                                        >
                                                            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${showTimestamps ? 'translate-x-6' : 'translate-x-0.5'
                                                                }`} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* AI Settings - Only for logged-in users */}
                                            {currentUser && (
                                                <div>
                                                    <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        AI Response Settings
                                                    </h4>
                                                    <div className="space-y-4">
                                                        {/* Response Length */}
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                Response Length
                                                            </span>
                                                            <select
                                                                value={aiResponseLength}
                                                                onChange={(e) => updateAiResponseLength(e.target.value)}
                                                                className={`px-3 py-1 rounded border text-sm ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                                            >
                                                                <option value="short">Short</option>
                                                                <option value="medium">Medium</option>
                                                                <option value="long">Long</option>
                                                            </select>
                                                        </div>

                                                        {/* Creativity Level */}
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                Creativity Level
                                                            </span>
                                                            <select
                                                                value={aiCreativity}
                                                                onChange={(e) => updateAiCreativity(e.target.value)}
                                                                className={`px-3 py-1 rounded border text-sm ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                                            >
                                                                <option value="conservative">Conservative</option>
                                                                <option value="balanced">Balanced</option>
                                                                <option value="creative">Creative</option>
                                                            </select>
                                                        </div>

                                                        {/* Response Tone */}
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                Response Tone
                                                            </span>
                                                            <select
                                                                value={tone}
                                                                onChange={(e) => { setTone(e.target.value); localStorage.setItem('gemini_tone', e.target.value); }}
                                                                className={`px-3 py-1 rounded border text-sm ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                                            >
                                                                <option value="neutral">Neutral</option>
                                                                <option value="friendly">Friendly</option>
                                                                <option value="formal">Formal</option>
                                                                <option value="concise">Concise</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Notification Settings - Only for logged-in users */}
                                            {currentUser && (
                                                <div>
                                                    <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        Notifications & Sounds
                                                    </h4>
                                                    <div className="space-y-4">
                                                        {/* Sound Enabled */}
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                Enable Sounds
                                                            </span>
                                                            <button
                                                                onClick={() => updateSoundEnabled(!soundEnabled)}
                                                                className={`w-12 h-6 rounded-full transition-colors ${soundEnabled ? 'bg-blue-600' : 'bg-gray-300'
                                                                    }`}
                                                            >
                                                                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${soundEnabled ? 'translate-x-6' : 'translate-x-0.5'
                                                                    }`} />
                                                            </button>
                                                        </div>

                                                        {/* Typing Sounds */}
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                Typing Sounds
                                                            </span>
                                                            <button
                                                                onClick={() => updateTypingSounds(!typingSounds)}
                                                                className={`w-12 h-6 rounded-full transition-colors ${typingSounds ? 'bg-blue-600' : 'bg-gray-300'
                                                                    }`}
                                                            >
                                                                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${typingSounds ? 'translate-x-6' : 'translate-x-0.5'
                                                                    }`} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Privacy Settings - Only for logged-in users */}
                                            {currentUser && (
                                                <div>
                                                    <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        Privacy & Data
                                                    </h4>
                                                    <div className="space-y-4">
                                                        {/* Data Retention */}
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                Data Retention (days)
                                                            </span>
                                                            <select
                                                                value={dataRetention}
                                                                onChange={(e) => updateDataRetention(e.target.value)}
                                                                className={`px-3 py-1 rounded border text-sm ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                                            >
                                                                <option value="7">7 days</option>
                                                                <option value="30">30 days</option>
                                                                <option value="90">90 days</option>
                                                                <option value="365">1 year</option>
                                                                <option value="0">Forever</option>
                                                            </select>
                                                        </div>

                                                        {/* Analytics */}
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                Analytics
                                                            </span>
                                                            <button
                                                                onClick={() => updateEnableAnalytics(!enableAnalytics)}
                                                                className={`w-12 h-6 rounded-full transition-colors ${enableAnalytics ? 'bg-blue-600' : 'bg-gray-300'
                                                                    }`}
                                                            >
                                                                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${enableAnalytics ? 'translate-x-6' : 'translate-x-0.5'
                                                                    }`} />
                                                            </button>
                                                        </div>

                                                        {/* Error Reporting */}
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                Error Reporting
                                                            </span>
                                                            <button
                                                                onClick={() => updateEnableErrorReporting(!enableErrorReporting)}
                                                                className={`w-12 h-6 rounded-full transition-colors ${enableErrorReporting ? 'bg-blue-600' : 'bg-gray-300'
                                                                    }`}
                                                            >
                                                                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${enableErrorReporting ? 'translate-x-6' : 'translate-x-0.5'
                                                                    }`} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Advanced Settings - Only for logged-in users */}
                                            {currentUser && (
                                                <div>
                                                    <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        Advanced Settings
                                                    </h4>
                                                    <div className="space-y-4">
                                                        {/* Auto Save */}
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                Auto Save
                                                            </span>
                                                            <button
                                                                onClick={() => updateAutoSave(!autoSave)}
                                                                className={`w-12 h-6 rounded-full transition-colors ${autoSave ? 'bg-blue-600' : 'bg-gray-300'
                                                                    }`}
                                                            >
                                                                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${autoSave ? 'translate-x-6' : 'translate-x-0.5'
                                                                    }`} />
                                                            </button>
                                                        </div>

                                                        {/* Message Limit */}
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                Message Limit
                                                            </span>
                                                            <select
                                                                value={messageLimit}
                                                                onChange={(e) => updateMessageLimit(e.target.value)}
                                                                className={`px-3 py-1 rounded border text-sm ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                                            >
                                                                <option value="50">50 messages</option>
                                                                <option value="100">100 messages</option>
                                                                <option value="200">200 messages</option>
                                                                <option value="500">500 messages</option>
                                                                <option value="unlimited">Unlimited</option>
                                                            </select>
                                                        </div>

                                                        {/* Enable Markdown */}
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                Enable Markdown
                                                            </span>
                                                            <button
                                                                onClick={() => updateEnableMarkdown(!enableMarkdown)}
                                                                className={`w-12 h-6 rounded-full transition-colors ${enableMarkdown ? 'bg-blue-600' : 'bg-gray-300'
                                                                    }`}
                                                            >
                                                                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${enableMarkdown ? 'translate-x-6' : 'translate-x-0.5'
                                                                    }`} />
                                                            </button>
                                                        </div>

                                                        {/* Code Highlighting */}
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                Code Highlighting
                                                            </span>
                                                            <button
                                                                onClick={() => updateEnableCodeHighlighting(!enableCodeHighlighting)}
                                                                className={`w-12 h-6 rounded-full transition-colors ${enableCodeHighlighting ? 'bg-blue-600' : 'bg-gray-300'
                                                                    }`}
                                                            >
                                                                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${enableCodeHighlighting ? 'translate-x-6' : 'translate-x-0.5'
                                                                    }`} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {/* Accessibility Settings - Only for logged-in users */}
                                            {currentUser && (
                                                <div>
                                                    <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        Accessibility
                                                    </h4>
                                                    <div className="space-y-4">
                                                        {/* High Contrast */}
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                High Contrast
                                                            </span>
                                                            <button
                                                                onClick={() => updateHighContrast(!highContrast)}
                                                                className={getToggleSwitchClasses(highContrast)}
                                                            >
                                                                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${highContrast ? 'translate-x-6' : 'translate-x-0.5'
                                                                    }`} />
                                                            </button>
                                                        </div>

                                                        {/* Reduced Motion */}
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                Reduced Motion
                                                            </span>
                                                            <button
                                                                onClick={() => updateReducedMotion(!reducedMotion)}
                                                                className={getToggleSwitchClasses(reducedMotion)}
                                                            >
                                                                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${reducedMotion ? 'translate-x-6' : 'translate-x-0.5'
                                                                    }`} />
                                                            </button>
                                                        </div>

                                                        {/* Screen Reader Support */}
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                Screen Reader Support
                                                            </span>
                                                            <button
                                                                onClick={() => updateScreenReaderSupport(!screenReaderSupport)}
                                                                className={getToggleSwitchClasses(screenReaderSupport)}
                                                            >
                                                                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${screenReaderSupport ? 'translate-x-6' : 'translate-x-0.5'
                                                                    }`} />
                                                            </button>
                                                        </div>

                                                        {/* Large Text */}
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                Large Text
                                                            </span>
                                                            <button
                                                                onClick={() => updateLargeText(!largeText)}
                                                                className={getToggleSwitchClasses(largeText)}
                                                            >
                                                                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${largeText ? 'translate-x-6' : 'translate-x-0.5'
                                                                    }`} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Advanced AI Settings - Only for logged-in users */}
                                            {currentUser && (
                                                <div>
                                                    <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        Advanced AI Settings
                                                    </h4>
                                                    <div className="space-y-4">
                                                        {/* Temperature */}
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                    Temperature: {temperature}
                                                                </span>
                                                            </div>
                                                            <input
                                                                type="range"
                                                                min="0.1"
                                                                max="1.0"
                                                                step="0.1"
                                                                value={temperature}
                                                                onChange={(e) => updateTemperature(e.target.value)}
                                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                                                style={{
                                                                    accentColor: '#2563eb' // Blue color for the range slider
                                                                }}
                                                            />
                                                        </div>

                                                        {/* Top P */}
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                    Top P: {topP}
                                                                </span>
                                                            </div>
                                                            <input
                                                                type="range"
                                                                min="0.1"
                                                                max="1.0"
                                                                step="0.1"
                                                                value={topP}
                                                                onChange={(e) => updateTopP(e.target.value)}
                                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                                                style={{
                                                                    accentColor: '#2563eb' // Blue color for the range slider
                                                                }}
                                                            />
                                                        </div>

                                                        {/* Context Window */}
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                    Context Window: {contextWindow} messages
                                                                </span>
                                                            </div>
                                                            <input
                                                                type="range"
                                                                min="5"
                                                                max="50"
                                                                step="5"
                                                                value={contextWindow}
                                                                onChange={(e) => updateContextWindow(e.target.value)}
                                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                                                style={{
                                                                    accentColor: '#2563eb' // Blue color for the range slider
                                                                }}
                                                            />
                                                        </div>

                                                        {/* Enable Streaming */}
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                Enable Streaming
                                                            </span>
                                                            <button
                                                                onClick={() => updateEnableStreaming(!enableStreaming)}
                                                                className={`w-12 h-6 rounded-full transition-colors ${enableStreaming ? 'bg-blue-600' : 'bg-gray-300'
                                                                    }`}
                                                            >
                                                                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${enableStreaming ? 'translate-x-6' : 'translate-x-0.5'
                                                                    }`} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                                                 {/* Advanced Settings Placeholder */}
                                            {currentUser && (
                                                <div className="text-xs p-3 rounded-lg bg-blue-50/30 dark:bg-blue-900/10 border border-blue-100/30 dark:border-blue-800/20 text-blue-600/70 dark:text-blue-400/70 text-center italic">
                                                    AI behavioral optimizations are managed automatically.
                                                </div>
                                            )}               </div>
                                            )}

                                            {/* Login Required Message for Public Users */}
                                            {!currentUser && (
                                                <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-blue-50 border-blue-200'}`}>
                                                    <div className="flex items-center space-x-3">
                                                        <div className={`p-2 rounded-full ${isDarkMode ? 'bg-blue-900' : 'bg-blue-100'}`}>
                                                            <svg className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <h4 className={`text-sm font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                                                                Advanced Settings Available
                                                            </h4>
                                                            <p className={`text-xs mt-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                                                                Sign in to access AI settings, notifications, privacy controls, and more advanced features.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}



                        {/* File Upload Modal */}
                        {showFileUpload && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 rounded-2xl animate-fadeIn">
                                <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl shadow-xl p-6 w-80 max-w-full animate-scaleIn`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                            Upload Files
                                        </h3>
                                        <button
                                            onClick={() => setShowFileUpload(false)}
                                            className="text-gray-500 hover:text-gray-700"
                                        >
                                            <FaTimes size={16} />
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {uploadingFile && (
                                            <div className="mb-4">
                                                <div className="flex items-center justify-center gap-2 text-sm text-blue-600 mb-2">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                                    Uploading files...
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                        style={{ width: `${uploadProgress}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                                            <FaUpload size={32} className="mx-auto text-gray-400 mb-2" />
                                            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                Drag & drop files here or click to browse
                                            </p>
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*,audio/*,video/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx"
                                                onChange={handleFileUpload}
                                                className="hidden"
                                                id="file-upload"
                                                disabled={uploadingFile}
                                            />
                                            <label
                                                htmlFor="file-upload"
                                                className={`mt-2 inline-block px-4 py-2 rounded-lg cursor-pointer transition-colors ${uploadingFile
                                                    ? 'bg-gray-400 cursor-not-allowed'
                                                    : `bg-gradient-to-r ${themeColors.primary} hover:opacity-90`
                                                    } text-white`}
                                            >
                                                {uploadingFile ? 'Uploading...' : 'Choose Files'}
                                            </label>
                                        </div>

                                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                            <p>Supported: Images, Audio, Video, Documents (PDF, Word, Excel, Text). Max 10MB per file.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Search in Chat Modal */}
                        {showSearchInChat && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 rounded-2xl animate-fadeIn">
                                <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl shadow-xl p-6 w-96 max-w-full animate-scaleIn`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                            Search in Chat
                                        </h3>
                                        <button
                                            onClick={() => setShowSearchInChat(false)}
                                            className="text-gray-500 hover:text-gray-700"
                                        >
                                            <FaTimes size={16} />
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value);
                                                searchInMessages(e.target.value);
                                            }}
                                            placeholder="Search messages..."
                                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${themeColors.accent.replace('text-', 'focus:ring-').replace('-600', '-500')} ${isDarkMode
                                                ? 'bg-gray-800 border-gray-600 text-white'
                                                : 'bg-white border-gray-300 text-gray-900'
                                                }`}
                                        />

                                        {searchQuery && (
                                            <div className="max-h-40 overflow-y-auto">
                                                {filteredMessages.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {filteredMessages.map((message, index) => (
                                                            <div
                                                                key={index}
                                                                onClick={() => handleSearchResultClick(message)}
                                                                className={`p-2 rounded border cursor-pointer transition-all duration-200 ${isDarkMode
                                                                    ? 'bg-gray-800 border-gray-600 hover:bg-gray-700 hover:border-gray-500'
                                                                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                                                                    }`}
                                                            >
                                                                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                                                                    {message.role === 'user' ? 'You' : 'SetuAI'} • {new Date(message.timestamp).toLocaleString()}
                                                                </div>
                                                                <div className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{message.content.substring(0, 100)}...</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        No messages found
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div >
            )}

            {/* Dislike feedback modal */}
            {
                showDislikeModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fadeIn">
                        <div className="absolute inset-0 bg-black/50" onClick={() => { if (!dislikeSubmitting) setShowDislikeModal(false); }} />
                        <div className={`relative w-full max-w-md rounded-xl shadow-2xl ${isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'} border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} animate-scaleIn`}>
                            <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                                <h3 className="text-lg font-semibold">Tell us what went wrong</h3>
                            </div>
                            <div className="p-4 space-y-3">
                                <p className="text-sm">Select a reason (required):</p>
                                <select value={dislikeFeedbackOption} onChange={(e) => setDislikeFeedbackOption(e.target.value)} className={`w-full p-2 rounded border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}>
                                    <option value="">Select a reason</option>
                                    <option value="Inaccurate information">Inaccurate information</option>
                                    <option value="Not relevant">Not relevant</option>
                                    <option value="Incomplete answer">Incomplete answer</option>
                                    <option value="Harmful/unsafe">Harmful/unsafe</option>
                                    <option value="Other">Other</option>
                                </select>
                                {dislikeFeedbackOption === 'Other' && (
                                    <textarea
                                        value={dislikeFeedbackText}
                                        onChange={(e) => setDislikeFeedbackText(e.target.value)}
                                        placeholder="Please describe the issue"
                                        rows={3}
                                        className={`w-full p-2 rounded border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                                    />
                                )}
                            </div>
                            <div className={`p-4 flex justify-end gap-2 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                                <button disabled={dislikeSubmitting} onClick={() => setShowDislikeModal(false)} className={`px-3 py-2 rounded ${isDarkMode ? 'bg-gray-600 text-white hover:bg-gray-500' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'} disabled:opacity-50`}>
                                    Cancel
                                </button>
                                <button disabled={dislikeSubmitting} onClick={submitDislike} className={`px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50`}>
                                    {dislikeSubmitting ? 'Submitting...' : 'Submit'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Ratings & Feedback modal (admin & user) */}
            {
                showRatingsModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fadeIn">
                        <div className="absolute inset-0 bg-black/50" onClick={() => setShowRatingsModal(false)} />
                        <div className={`relative w-full max-w-2xl rounded-xl shadow-2xl ${isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'} border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} animate-scaleIn flex flex-col max-h-[85vh]`}>
                            <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between flex-shrink-0`}>
                                <div>
                                    <h3 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">Ratings & Feedback</h3>
                                    <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {(currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) ? 'All System Ratings' : 'Your Session Ratings'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={async () => {
                                            loadRatingMeta();
                                            // For admins, refresh the global ratings list from API
                                            if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) {
                                                try {
                                                    setAllRatingsLoading(true);
                                                    const resp = await authenticatedFetch(`${API_BASE_URL}/api/gemini/ratings-all?limit=500&days=90`);
                                                    if (resp.ok) {
                                                        const data = await resp.json();
                                                        setAllRatings(Array.isArray(data.ratings) ? data.ratings : []);
                                                    } else {
                                                        setAllRatings([]);
                                                    }
                                                } catch (_) {
                                                    setAllRatings([]);
                                                } finally {
                                                    setAllRatingsLoading(false);
                                                }
                                            } else {
                                                // For normal users, just refresh local storage state
                                                try {
                                                    const rs = JSON.parse(localStorage.getItem('gemini_ratings') || '{}');
                                                    setMessageRatings(rs);
                                                } catch (_) { }
                                            }
                                        }}
                                        className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'} ${allRatingsLoading ? 'animate-spin' : ''}`}
                                        title="Refresh"
                                    >
                                        <FaSync size={16} />
                                    </button>
                                    <button
                                        onClick={() => setShowRatingsModal(false)}
                                        className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'}`}
                                    >
                                        <FaTimes size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Filters */}
                            <div className={`px-6 py-3 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} flex gap-2`}>
                                {['all', 'up', 'down'].map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => setRatingsFilter(filter)}
                                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0 ${ratingsFilter === filter
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                            : `${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`
                                            }`}
                                    >
                                        {filter === 'all' ? 'All Reviews' : filter === 'up' ? 'Liked' : 'Disliked'}
                                    </button>
                                ))}
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                                {(currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) ? (
                                    allRatingsLoading ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                                            <p>Loading ratings...</p>
                                        </div>
                                    ) : (
                                        (() => {
                                            const filteredRatings = allRatings.filter(r => ratingsFilter === 'all' || r.rating === ratingsFilter);
                                            return filteredRatings.length === 0 ? (
                                                <div className="text-center py-12 text-gray-500">
                                                    <FaSearch size={32} className="mx-auto mb-3 opacity-20" />
                                                    <p>No ratings found matching your filter.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {filteredRatings.map((r) => (
                                                        <div key={r.id} className={`p-4 rounded-xl border transition-all hover:shadow-md ${isDarkMode ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-blue-200'}`}>
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`p-2 rounded-lg ${r.rating === 'up' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                                        {r.rating === 'up' ? <FaThumbsUp size={16} /> : <FaThumbsDown size={16} />}
                                                                    </div>
                                                                    <div>
                                                                        <div className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{r.user?.username || r.user?.email || 'Unknown User'}</div>
                                                                        <div className="text-xs text-gray-400">{r.user?.role || 'user'} • {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className={`mt-3 p-3 rounded-lg text-sm mb-3 ${isDarkMode ? 'bg-gray-900/50 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
                                                                <div className="line-clamp-2 italic opacity-80">
                                                                    "{r.messageContent || ''}"
                                                                </div>
                                                            </div>

                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleRatingDelete(r.id)}
                                                                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${isDarkMode
                                                                        ? 'border-red-900/30 text-red-400 hover:bg-red-900/20'
                                                                        : 'border-red-100 text-red-600 hover:bg-red-50'
                                                                        }`}
                                                                    title="Delete Rating"
                                                                >
                                                                    <FaTrash size={10} />
                                                                </button>
                                                                <button
                                                                    onClick={() => { setSelectedRating(r); setShowRatingDetailModal(true); }}
                                                                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${isDarkMode
                                                                        ? 'border-gray-700 text-blue-400 hover:bg-gray-700'
                                                                        : 'border-gray-200 text-blue-600 hover:bg-blue-50'
                                                                        }`}
                                                                >
                                                                    <FaExpand size={10} /> Read Details
                                                                </button>
                                                            </div>
                                                            {r.rating === 'down' && r.feedback && (
                                                                <div className="mt-3 text-sm flex gap-2">
                                                                    <span className="font-semibold text-red-400 whitespace-nowrap">Feedback:</span>
                                                                    <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{r.feedback}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()
                                    )
                                ) : (
                                    Object.keys(messageRatings || {}).length === 0 ? (
                                        <div className="text-center py-12 text-gray-500">
                                            <FaRegSmile size={32} className="mx-auto mb-3 opacity-20" />
                                            <p>No ratings yet in this session.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {messages.map((msg, idx) => {
                                                const key = `${idx}_${msg.timestamp}`;
                                                const r = messageRatings[key];
                                                if (!r) return null;
                                                if (ratingsFilter !== 'all' && r !== ratingsFilter) return null;

                                                const meta = ratingMeta[key] || {};
                                                return (
                                                    <div key={key} className={`p-4 rounded-xl border transition-all hover:shadow-md ${isDarkMode ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-blue-200'}`}>
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-2 rounded-lg ${r === 'up' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                                    {r === 'up' ? <FaThumbsUp size={16} /> : <FaThumbsDown size={16} />}
                                                                </div>
                                                                <div>
                                                                    <div className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{meta.user || 'You'}</div>
                                                                    <div className="text-xs text-gray-400">{meta.time ? new Date(meta.time).toLocaleString() : ''}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className={`mt-3 p-3 rounded-lg text-sm transition-all duration-300 group hover:max-h-[500px] hover:overflow-y-auto ${isDarkMode ? 'bg-gray-900/50 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
                                                            <div className="line-clamp-3 group-hover:line-clamp-none">
                                                                "{meta.messagePreview || msg.content || ''}"
                                                            </div>
                                                        </div>
                                                        {r === 'down' && meta.feedback && (
                                                            <div className="mt-3 text-sm flex gap-2">
                                                                <span className="font-semibold text-red-400 whitespace-nowrap">Feedback:</span>
                                                                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{meta.feedback}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )
                                )}
                            </div>
                            {/* Footer Action */}
                            <div className={`p-4 border-t flex justify-end ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                                <button
                                    onClick={() => setShowRatingsModal(false)}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Animation styles */}
            <style>
                {`
                @keyframes fadeIn {
                  from { opacity: 0; }
                  to { opacity: 1; }
                }
                @keyframes slideUp {
                  from {
                    opacity: 0;
                    transform: translateY(20px) scale(0.98);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                  }
                }
                .animate-fadeIn { animation: fadeIn 0.25s ease-out; }
                .animate-slideUp { animation: slideUp 0.28s ease-out; }
                .no-scrollbar::-webkit-scrollbar {
                  display: none;
                }
                .no-scrollbar {
                  -ms-overflow-style: none;
                  scrollbar-width: none;
                }
                @keyframes scaleIn {
                  from { opacity: 0; transform: scale(0.9); }
                  to { opacity: 1; transform: scale(1); }
                }
                .animate-scaleIn { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
                @keyframes sendIconFly {
                  0% {
                    transform: translate(0, 0) scale(1);
                    opacity: 1;
                  }
                  20% {
                    transform: translate(-3px, -6px) scale(1.05);
                    opacity: 0.9;
                  }
                  40% {
                    transform: translate(-8px, -12px) scale(1.1);
                    opacity: 0.8;
                  }
                  60% {
                    transform: translate(8px, -18px) scale(1.15);
                    opacity: 0.9;
                  }
                  80% {
                    transform: translate(15px, -20px) scale(1.2);
                    opacity: 0.95;
                  }
                  100% {
                    transform: translate(0, 0) scale(1);
                    opacity: 1;
                  }
                }
                .send-icon.animate-fly {
                  animation: sendIconFly 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                }
                @keyframes sentSuccess {
                  0% {
                    transform: scale(0.8);
                    opacity: 0;
                  }
                  50% {
                    transform: scale(1.2);
                    opacity: 1;
                  }
                  100% {
                    transform: scale(1);
                    opacity: 1;
                  }
                }
                .send-icon.animate-sent {
                  animation: sentSuccess 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                }
                
                @keyframes floatingDateFadeIn {
                  from { 
                    opacity: 0; 
                    transform: translateY(-8px) scale(0.92); 
                  }
                  to { 
                    opacity: 1; 
                    transform: translateY(0) scale(1); 
                  }
                }
                @keyframes floatingDateFadeOut {
                  from { 
                    opacity: 1; 
                    transform: translateY(0) scale(1); 
                  }
                  to { 
                    opacity: 0; 
                    transform: translateY(4px) scale(0.96); 
                  }
                }
                .animate-floatingDateFadeIn {
                  animation: floatingDateFadeIn 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
                }
                .animate-floatingDateFadeOut {
                  animation: floatingDateFadeOut 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
                }
                
                @keyframes slideDown {
                  0% {
                    opacity: 0;
                    transform: translateY(-10px) scale(0.95);
                  }
                  100% {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                  }
                }
                .animate-slideDown {
                  animation: slideDown 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
                }
                
                /* Accessibility Styles */
                .high-contrast {
                    filter: contrast(150%) brightness(1.2);
                }
                .high-contrast .w-12.h-6.rounded-full {
                    background-color: #6b7280 !important; /* Use darker gray for disabled toggles in high contrast */
                }
                .high-contrast .w-12.h-6.rounded-full.bg-blue-600 {
                    background-color: #1d4ed8 !important; /* Ensure enabled toggles remain blue */
                }
                .reduced-motion * {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                    transform: none !important;
                }
                .reduced-motion .w-12.h-6.rounded-full {
                    transition-duration: 0.2s !important; /* Allow toggle color transitions */
                }
                .reduced-motion .w-12.h-6.rounded-full.bg-gray-300 {
                    background-color: #d1d5db !important; /* Ensure disabled toggles stay gray in reduced motion */
                }
                .reduced-motion .w-12.h-6.rounded-full.bg-gray-600 {
                    background-color: #4b5563 !important; /* Ensure disabled toggles stay dark gray in reduced motion + high contrast */
                }
                .reduced-motion .animate-pulse,
                .reduced-motion .animate-spin,
                .reduced-motion .animate-fadeIn,
                .reduced-motion .animate-slideDown,
                .reduced-motion .animate-slideUp {
                    animation: none !important;
                }
                .reduced-motion .hover\\:scale-110:hover {
                    transform: none !important;
                }
                .large-text {
                    font-size: 1.2em !important;
                }
                .large-text .text-sm {
                    font-size: 1em !important;
                }
                .large-text .text-base {
                    font-size: 1.3em !important;
                }
        .screen-reader-support [role="button"],
        .screen-reader-support button,
        .screen-reader-support input,
        .screen-reader-support select,
        .screen-reader-support textarea {
                    outline: 2px solid #0066cc !important;
                    outline-offset: 2px !important;
                }
        .screen-reader-support [role="button"]:focus,
        .screen-reader-support button:focus,
        .screen-reader-support input:focus,
        .screen-reader-support select:focus,
        .screen-reader-support textarea:focus {
                    outline: 3px solid #0066cc !important;
                    outline-offset: 3px !important;
            box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.3) !important;
        }
                .screen-reader-support .sr-only {
                    position: absolute !important;
                    width: 1px !important;
                    height: 1px !important;
                    padding: 0 !important;
                    margin: -1px !important;
                    overflow: hidden !important;
                    clip: rect(0, 0, 0, 0) !important;
                    white-space: nowrap !important;
                    border: 0 !important;
                }
                
                /* Ensure proper text color inheritance in message bubbles */
                .bg-gray-100.text-gray-800 * {
                    color: inherit !important;
                }
                .bg-gray-100.text-gray-800 span {
                    color: #1f2937 !important; /* text-gray-800 */
                }
                .bg-gray-100.text-gray-800 p {
                    color: #1f2937 !important; /* text-gray-800 */
                }
                .bg-gray-100.text-gray-800 div {
                    color: #1f2937 !important; /* text-gray-800 */
                }
                
                /* Ensure links maintain their blue color in light mode */
                .bg-gray-100.text-gray-800 a {
                    color: #2563eb !important; /* text-blue-600 */
                }
                .bg-gray-100.text-gray-800 a:hover {
                    color: #1d4ed8 !important; /* text-blue-800 */
                }
                
                /* Dark mode text color inheritance */
                .bg-gray-800.text-gray-100 * {
                    color: inherit !important;
                }
                .bg-gray-800.text-gray-100 span {
                    color: #f3f4f6 !important; /* text-gray-100 */
                }
                .bg-gray-800.text-gray-100 p {
                    color: #f3f4f6 !important; /* text-gray-100 */
                }
                .bg-gray-800.text-gray-100 div {
                    color: #f3f4f6 !important; /* text-gray-100 */
                }
                
                /* Ensure links maintain their blue color in dark mode */
                .bg-gray-800.text-gray-100 a {
                    color: #2563eb !important; /* text-blue-600 */
                }
                .bg-gray-800.text-gray-100 a:hover {
                    color: #1d4ed8 !important; /* text-blue-800 */
                }
                
                /* Ensure rating buttons maintain their colors in light mode */
                .bg-gray-100.text-gray-800 button.text-green-600,
                .bg-gray-100.text-gray-800 button.text-red-600,
                .bg-gray-100.text-gray-800 button.text-gray-500 {
                    color: inherit !important;
                }
                .bg-gray-100.text-gray-800 button.text-green-600 {
                    color: #16a34a !important; /* text-green-600 */
                }
                .bg-gray-100.text-gray-800 button.text-red-600 {
                    color: #dc2626 !important; /* text-red-600 */
                }
                .bg-gray-100.text-gray-800 button.text-gray-500 {
                    color: #6b7280 !important; /* text-gray-500 */
                }
                
                /* Ensure error messages maintain their red color in light mode */
                .bg-red-50.text-red-900,
                .bg-red-50.text-red-900 p,
                .bg-red-50.text-red-900 div,
                .bg-red-50.text-red-900 span {
                    color: #7f1d1d !important; /* text-red-900 */
                }
                
                /* Ensure rating buttons maintain their colors in dark mode */
                .bg-gray-800.text-gray-100 button.text-green-600,
                .bg-gray-800.text-gray-100 button.text-red-600,
                .bg-gray-800.text-gray-100 button.text-gray-500 {
                    color: inherit !important;
                }
                .bg-gray-800.text-gray-100 button.text-green-600 {
                    color: #16a34a !important; /* text-green-600 */
                }
                .bg-gray-800.text-gray-100 button.text-red-600 {
                    color: #dc2626 !important; /* text-red-600 */
                }
                .bg-gray-800.text-gray-100 button.text-gray-500 {
                    color: #6b7280 !important; /* text-gray-500 */
                }
                
                /* Ensure error messages maintain their red color in dark mode */
                .bg-red-900\/20.text-red-300,
                .bg-red-900\/20.text-red-300 p,
                .bg-red-900\/20.text-red-300 div,
                .bg-red-900\/20.text-red-300 span {
                    color: #fca5a5 !important; /* text-red-300 */
                }
                
                /* Ensure bookmark icons maintain their colors in light mode */
                .bg-gray-100.text-gray-800 button .text-yellow-500 {
                    color: #eab308 !important; /* text-yellow-500 */
                }
                .bg-gray-100.text-gray-800 button .text-gray-500 {
                    color: #6b7280 !important; /* text-gray-500 */
                }
                
                /* Ensure bookmark icons maintain their colors in dark mode */
                .bg-gray-800.text-gray-100 button .text-yellow-500 {
                    color: #eab308 !important; /* text-yellow-500 */
                }
                .bg-gray-800.text-gray-100 button .text-gray-500 {
                    color: #6b7280 !important; /* text-gray-500 */
                }
        
        /* Code highlighting styles */
        .code-block {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.875rem;
            line-height: 1.5;
        }
        
        .code-block pre {
            margin: 0;
            padding: 0;
            background: transparent;
            border: none;
        }
        
        .code-block code {
            font-family: inherit;
            font-size: inherit;
            background: transparent;
            padding: 0;
            border: none;
        }
        
        /* Disable line highlighting effects from Prism.js */
        .code-block pre,
        .code-block code,
        .code-block .token {
            background: transparent !important;
            background-color: transparent !important;
            box-shadow: none !important;
            text-shadow: none !important;
            border: none !important;
            outline: none !important;
        }
        
        /* Remove any line highlighting or selection effects */
        .code-block pre::selection,
        .code-block code::selection,
        .code-block .token::selection {
            background: transparent !important;
        }
        
        .code-block pre::-moz-selection,
        .code-block code::-moz-selection,
        .code-block .token::-moz-selection {
            background: transparent !important;
        }
        
        /* Disable any Prism.js line highlighting */
        .code-block .line-highlight,
        .code-block .line-numbers .line-highlight,
        .code-block pre[data-line] .line-highlight {
            display: none !important;
        }
        
        /* Remove any additional visual artifacts and hover effects */
        .code-block pre:hover,
        .code-block code:hover,
        .code-block .token:hover,
        .code-block:hover,
        .code-block pre:hover *,
        .code-block code:hover *,
        .code-block .token:hover * {
            background: transparent !important;
            background-color: transparent !important;
            box-shadow: none !important;
            text-shadow: none !important;
            border: none !important;
            outline: none !important;
            transform: none !important;
            transition: none !important;
            animation: none !important;
        }
        
        /* Disable any Prism.js hover effects */
        .code-block pre:hover .token,
        .code-block code:hover .token,
        .code-block .token:hover {
            background: transparent !important;
            background-color: transparent !important;
            color: inherit !important;
        }
        
        /* Disable any pseudo-element hover effects */
        .code-block pre:hover::before,
        .code-block pre:hover::after,
        .code-block code:hover::before,
        .code-block code:hover::after,
        .code-block .token:hover::before,
        .code-block .token:hover::after {
            display: none !important;
            content: none !important;
        }
        
        /* Ensure no line numbers or line highlighting */
        .code-block .line-numbers,
        .code-block .line-numbers-rows,
        .code-block .line-numbers-rows > span {
            display: none !important;
        }
        
        /* Remove any focus or active states that might cause highlighting */
        .code-block pre:focus,
        .code-block code:focus,
        .code-block .token:focus,
        .code-block pre:active,
        .code-block code:active,
        .code-block .token:active,
        .code-block pre:focus:hover,
        .code-block code:focus:hover,
        .code-block .token:focus:hover,
        .code-block pre:active:hover,
        .code-block code:active:hover,
        .code-block .token:active:hover {
            background: transparent !important;
            background-color: transparent !important;
            outline: none !important;
            box-shadow: none !important;
            text-shadow: none !important;
            border: none !important;
            transform: none !important;
            transition: none !important;
            animation: none !important;
        }
        
        /* Disable any mouse event related effects */
        .code-block pre:focus-within,
        .code-block code:focus-within,
        .code-block .token:focus-within {
            background: transparent !important;
            background-color: transparent !important;
            outline: none !important;
        }
        
        /* Disable any potential overlay effects */
        .code-block pre::selection,
        .code-block code::selection,
        .code-block .token::selection,
        .code-block pre::-moz-selection,
        .code-block code::-moz-selection,
        .code-block .token::-moz-selection {
            background: transparent !important;
            color: inherit !important;
        }
        
        /* Disable any potential highlighting from parent elements */
        .code-block:hover pre,
        .code-block:hover code,
        .code-block:hover .token {
            background: transparent !important;
            background-color: transparent !important;
        }
        
        /* Completely disable any white strip or overlay effects */
        .code-block * {
            background: transparent !important;
            background-color: transparent !important;
        }
        
        .code-block pre.bg-gray-900 * {
            background: transparent !important;
            background-color: transparent !important;
        }
        
        .code-block pre.bg-gray-800 * {
            background: transparent !important;
            background-color: transparent !important;
        }
        
        .code-block pre.bg-gray-100 * {
            background: transparent !important;
            background-color: transparent !important;
        }
        
        /* Disable any potential white overlay from Prism.js */
        .code-block .token::before,
        .code-block .token::after,
        .code-block pre::before,
        .code-block pre::after,
        .code-block code::before,
        .code-block code::after {
            display: none !important;
            content: none !important;
            background: transparent !important;
            background-color: transparent !important;
        }
        
        /* Enhanced code block styling for better visibility - only when code highlighting is enabled */
        .code-block pre.bg-gray-900 {
            background: #1a1a1a !important;
            color: #e5e5e5 !important;
        }
        
        .dark .code-block pre.bg-gray-800 {
            background: #1a1a1a !important;
            color: #e5e5e5 !important;
        }
        
        /* Light mode code blocks without highlighting should use light background */
        .code-block pre.bg-gray-100 {
            background: #f3f4f6 !important; /* bg-gray-100 */
            color: #1f2937 !important; /* text-gray-800 */
        }
        
        /* Dark mode code blocks without highlighting should use dark background */
        .code-block pre.bg-gray-800 {
            background: #1f2937 !important; /* bg-gray-800 */
            color: #f3f4f6 !important; /* text-gray-100 */
        }
        /* Ensure inline code elements have proper contrast in all scenarios */
        code.bg-gray-100 {
            background: #f3f4f6 !important; /* bg-gray-100 */
            color: #1f2937 !important; /* text-gray-800 */
        }
        
        code.bg-gray-800 {
            background: #1f2937 !important; /* bg-gray-800 */
            color: #f3f4f6 !important; /* text-gray-100 */
        }
        
        /* Override any Prism.js or other CSS that might affect inline code */
        .bg-gray-100 code {
            background: #f3f4f6 !important; /* bg-gray-100 */
            color: #1f2937 !important; /* text-gray-800 */
        }
        
        .bg-gray-800 code {
            background: #1f2937 !important; /* bg-gray-800 */
            color: #f3f4f6 !important; /* text-gray-100 */
        }
        
        /* Ensure all inline code elements have proper contrast regardless of context */
        code {
            background: #f3f4f6 !important; /* bg-gray-100 for light mode */
            color: #1f2937 !important; /* text-gray-800 for light mode */
        }
        
        /* Dark mode inline code */
        .dark code {
            background: #1f2937 !important; /* bg-gray-800 for dark mode */
            color: #f3f4f6 !important; /* text-gray-100 for dark mode */
        }
        
        /* Override any Prism.js token styling that might affect inline code */
        code.token {
            background: #f3f4f6 !important; /* bg-gray-100 for light mode */
            color: #1f2937 !important; /* text-gray-800 for light mode */
        }
        
        .dark code.token {
            background: #1f2937 !important; /* bg-gray-800 for dark mode */
            color: #f3f4f6 !important; /* text-gray-100 for dark mode */
        }
        
        /* Prism.js syntax highlighting overrides for better contrast - only when highlighting is enabled */
        .code-block pre.bg-gray-900 .token.comment,
        .code-block pre.bg-gray-900 .token.prolog,
        .code-block pre.bg-gray-900 .token.doctype,
        .code-block pre.bg-gray-900 .token.cdata {
            color: #6a9955 !important;
        }
        
        .code-block pre.bg-gray-900 .token.punctuation {
            color: #d4d4d4 !important;
        }
        
        .code-block pre.bg-gray-900 .token.property,
        .code-block pre.bg-gray-900 .token.tag,
        .code-block pre.bg-gray-900 .token.boolean,
        .code-block pre.bg-gray-900 .token.number,
        .code-block pre.bg-gray-900 .token.constant,
        .code-block pre.bg-gray-900 .token.symbol,
        .code-block pre.bg-gray-900 .token.deleted {
            color: #b5cea8 !important;
        }
        
        .code-block pre.bg-gray-900 .token.selector,
        .code-block pre.bg-gray-900 .token.attr-name,
        .code-block pre.bg-gray-900 .token.string,
        .code-block pre.bg-gray-900 .token.char,
        .code-block pre.bg-gray-900 .token.builtin,
        .code-block pre.bg-gray-900 .token.inserted {
            color: #ce9178 !important;
        }
        
        .code-block pre.bg-gray-900 .token.operator,
        .code-block pre.bg-gray-900 .token.entity,
        .code-block pre.bg-gray-900 .token.url,
        .code-block pre.bg-gray-900 .language-css .token.string,
        .code-block pre.bg-gray-900 .style .token.string {
            color: #d4d4d4 !important;
        }
        
        .code-block pre.bg-gray-900 .token.atrule,
        .code-block pre.bg-gray-900 .token.attr-value,
        .code-block pre.bg-gray-900 .token.keyword {
            color: #569cd6 !important;
        }
        
        .code-block pre.bg-gray-900 .token.function,
        .code-block pre.bg-gray-900 .token.class-name {
            color: #dcdcaa !important;
        }
        
        .code-block pre.bg-gray-900 .token.regex,
        .code-block pre.bg-gray-900 .token.important,
        .code-block pre.bg-gray-900 .token.variable {
            color: #d16969 !important;
        }
        
        /* Markdown Table Styles */
        .table-wrapper {
            margin: 1rem 0;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            border-radius: 0.5rem;
        }
        
        .markdown-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.875rem;
            margin: 0.5rem 0;
            background-color: transparent;
        }
        
        .markdown-table-th {
            border: 1px solid rgba(209, 213, 219, 1); /* border-gray-300 */
            padding: 0.5rem 0.75rem;
            text-align: left;
            font-weight: 600;
            background-color: rgba(243, 244, 246, 1); /* bg-gray-100 */
            color: rgba(17, 24, 39, 1); /* text-gray-900 */
        }
        
        .dark .markdown-table-th {
            border-color: rgba(75, 85, 99, 1); /* border-gray-600 */
            background-color: rgba(55, 65, 81, 1); /* bg-gray-700 */
            color: rgba(243, 244, 246, 1); /* text-gray-100 */
        }
        
        .markdown-table-td {
            border: 1px solid rgba(209, 213, 219, 1); /* border-gray-300 */
            padding: 0.5rem 0.75rem;
            color: rgba(31, 41, 55, 1); /* text-gray-800 */
        }
        
        .dark .markdown-table-td {
            border-color: rgba(75, 85, 99, 1); /* border-gray-600 */
            color: rgba(229, 231, 235, 1); /* text-gray-200 */
        }
        
        .markdown-table tr:nth-child(even) {
            background-color: rgba(249, 250, 251, 0.5); /* Very light gray for zebra striping */
        }
        
        .dark .markdown-table tr:nth-child(even) {
            background-color: rgba(55, 65, 81, 0.3); /* Dark gray for zebra striping */
        }
        
        .markdown-table tr:hover {
            background-color: rgba(243, 244, 246, 0.8);
        }
        
        .dark .markdown-table tr:hover {
            background-color: rgba(55, 65, 81, 0.5);
        }
        
        /* Ensure tables don't break message bubble layout */
        .table-wrapper {
            max-width: 100%;
            word-wrap: break-word;
        }
        
        /* Responsive table scrolling on mobile */
        @media (max-width: 640px) {
            .table-wrapper {
                -webkit-overflow-scrolling: touch;
                scrollbar-width: thin;
            }
        }
                /* Ensure markdown tables are readable, especially in dark mode */
                .gemini-chatbox-modal table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; margin-bottom: 0.5rem; }
                .gemini-chatbox-modal th, .gemini-chatbox-modal td { border: 1px solid rgba(107,114,128,0.3); padding: 6px 8px; text-align: left; }
                .gemini-chatbox-modal th { font-weight: 600; }
                .dark .gemini-chatbox-modal th { color: #e5e7eb; background-color: rgba(31,41,55,0.5); }
                .dark .gemini-chatbox-modal td { color: #e5e7eb; }
                .gemini-chatbox-modal thead tr { background-color: rgba(0,0,0,0.03); }
                .dark .gemini-chatbox-modal thead tr { background-color: rgba(31,41,55,0.5); }
                `}
            </style>

            {
                showInfoModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div
                            className={`w-11/12 max-w-2xl max-h-[85vh] flex flex-col rounded-xl shadow-xl relative ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}
                        >
                            <div className={`flex flex-shrink-0 items-center justify-between p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
                                        <FaRobot size={24} className="text-indigo-500" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">SetuAI</h2>
                                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Advanced Real Estate Assistant</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowInfoModal(false)}
                                    className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'}`}
                                >
                                    <FaTimes size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
                                {/* Core Technology */}
                                <section>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <FaCog className="text-indigo-500" />
                                        Powered By
                                    </h3>
                                    <div className={`p-6 rounded-2xl ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                                        <div className="grid md:grid-cols-3 gap-6">
                                            <div className="space-y-2">
                                                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Inference</div>
                                                <div className="text-xl font-bold font-mono text-orange-500">Groq LPU™</div>
                                                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                    Ultra-low latency for instant chat responses.
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Intelligence</div>
                                                <div className="text-xl font-bold font-mono text-blue-500">Sentinel v2.0</div>
                                                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                    Neural engine & ESG scoring models.
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Real-time</div>
                                                <div className="text-xl font-bold font-mono text-green-500">TensorFlow.js</div>
                                                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                    On-device recommendations & image auditing.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Features */}
                                <section>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <FaMagic className="text-purple-500" />
                                        Capabilities
                                    </h3>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {[
                                            { title: 'Real Estate Expertise', desc: 'Deep knowledge of property trends, pricing, and legal processes.', icon: '🏢' },
                                            { title: 'Live Property Search', desc: 'Can search and recommend local listings from UrbanSetu database.', icon: '🔍' },
                                            { title: 'Smart Context', desc: 'Remembers conversation history and user preferences.', icon: '🧠' },
                                            { title: 'Multi-Modal', desc: 'Supports text, voice input, and image analysis.', icon: '🎤' },
                                            { title: 'Code & Math', desc: 'Capable of calculating mortgage EMIs and formatting code.', icon: '🔢' },
                                            { title: 'Instant Translation', desc: 'Communicates fluently in multiple languages.', icon: '🌐' }
                                        ].map((feat, i) => (
                                            <div key={i} className={`p-4 rounded-xl border ${isDarkMode ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-100 hover:bg-gray-50'} transition-colors`}>
                                                <div className="text-2xl mb-2">{feat.icon}</div>
                                                <h4 className="font-semibold mb-1">{feat.title}</h4>
                                                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{feat.desc}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* Security */}
                                <section>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <FaCheckCircle className="text-green-500" />
                                        Security & Privacy
                                    </h3>
                                    <ul className={`space-y-3 p-5 rounded-2xl ${isDarkMode ? 'bg-gray-800/30' : 'bg-gray-50'}`}>
                                        {[
                                            'End-to-End Encryption for all data in transit',
                                            'No personal data training - your chats are private',
                                            'Auto-deletion options for chat history',
                                            'Enterprise-grade rate limiting and abuse protection'
                                        ].map((item, i) => (
                                            <li key={i} className="flex items-start gap-3 text-sm">
                                                <FaCheck className="text-green-500 mt-1 flex-shrink-0" size={12} />
                                                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                {/* Footer Info */}
                                <div className={`text-center pt-6 pb-2 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                                    <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                        SetuAI v2.5.0 • Build 2024.12 • Powered by Sentinel UrbanSetu Tech Labs
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                showTermsModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div
                            className={`w-11/12 max-w-2xl max-h-[85vh] flex flex-col rounded-xl shadow-xl relative ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}
                        >
                            {/* Header */}
                            <div className={`flex flex-shrink-0 items-center justify-between p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                                <div className="flex items-center gap-3">
                                    <FaFileAlt className="text-blue-500 text-xl" />
                                    <h2 className="text-xl font-bold">Terms of Service</h2>
                                </div>
                                <button
                                    onClick={() => setShowTermsModal(false)}
                                    className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                                >
                                    <FaTimes size={20} />
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
                                <div className="text-sm leading-relaxed space-y-6">
                                    <section>
                                        <h3 className="font-bold text-lg mb-2 text-blue-500">1. Introduction</h3>
                                        <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                                            Welcome to SetuAI. By accessing or using this AI chatbot service, you agree to be bound by these Terms and Conditions.
                                            This service utilizes advanced artificial intelligence technology powered by Groq and Meta Llama 3 models.
                                        </p>
                                    </section>

                                    <section>
                                        <h3 className="font-bold text-lg mb-2 text-blue-500">2. Usage Guidelines</h3>
                                        <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                                            You agree to use SetuAI only for lawful purposes. You must not:
                                        </p>
                                        <ul className={`list-disc pl-5 mt-2 space-y-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                            <li>Generate harmful, abusive, or illegal content.</li>
                                            <li>Attempt to bypass security filters or jailbreak the AI.</li>
                                            <li>Upload malicious files or code.</li>
                                            <li>Use the service to harass others or violate privacy rights.</li>
                                        </ul>
                                    </section>

                                    <section>
                                        <h3 className="font-bold text-lg mb-2 text-blue-500">3. AI Limitations & Disclaimers</h3>
                                        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-amber-900/20 border-amber-700/50' : 'bg-amber-50 border-amber-200'}`}>
                                            <p className={`font-semibold mb-1 ${isDarkMode ? 'text-amber-400' : 'text-amber-800'}`}>Important Notice:</p>
                                            <p className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                                                SetuAI is an artificial intelligence. While we strive for accuracy, the AI may occasionally generate incorrect or misleading information ("hallucinations").
                                                Always verify critical real estate, financial, or legal information with qualified human professionals.
                                            </p>
                                        </div>
                                    </section>

                                    <section>
                                        <h3 className="font-bold text-lg mb-2 text-blue-500">4. Data Privacy</h3>
                                        <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                                            We value your privacy. Your conversation history is stored securely and encrypted in transit.
                                            We do not use your personal chat data to train our public models. However, for quality assurance, anonymized interactions may be reviewed.
                                        </p>
                                    </section>

                                    <section>
                                        <h3 className="font-bold text-lg mb-2 text-blue-500">5. Changes to Terms</h3>
                                        <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                                            We reserve the right to modify these terms at any time. Continued use of the service constitutes acceptance of updated terms.
                                        </p>
                                    </section>
                                </div>

                                {/* Footer Action (If viewing from consent modal, this effectively returns to it) */}
                                <div className={`p-4 border-t flex justify-between items-center ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                                    <p className={`text-xs sm:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                        For comprehensive platform policies, please read our full <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 hover:underline font-medium transition-colors">Terms & Conditions</a>.
                                    </p>
                                    <button
                                        onClick={() => setShowTermsModal(false)}
                                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex-shrink-0 ml-4"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Mandatory Consent Modal */}
            {
                showConsentModal && (
                    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn cursor-default">
                        <div className={`w-full max-w-md rounded-3xl shadow-2xl p-8 text-center transform transition-all animate-bounceIn ${isDarkMode ? 'bg-gray-900 text-gray-100 border border-gray-700' : 'bg-white text-gray-900'}`}>
                            <button
                                onClick={() => {
                                    setShowConsentModal(false);
                                    if (onModalClose) onModalClose();
                                    else setIsOpen(false);
                                }}
                                className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'}`}
                            >
                                <FaTimes size={16} />
                            </button>

                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <FaFileAlt className="text-blue-600 text-2xl" />
                            </div>

                            <h2 className="text-2xl font-bold mb-2">Terms & Conditions</h2>
                            <p className={`mb-6 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Welcome to SetuAI! Before you start chatting, please review and accept our usage guidelines. We want to ensure a safe and helpful experience for everyone.
                            </p>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={acceptTerms}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-95"
                                >
                                    Accept & Continue
                                </button>
                                <button
                                    onClick={() => setShowTermsModal(true)}
                                    className={`w-full py-3 rounded-xl font-medium transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
                                >
                                    Read Full Terms
                                </button>
                            </div>

                            <p className={`mt-6 text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                By clicking accept, you agree to our policies regarding AI usage and data handling.
                            </p>
                        </div>
                    </div>
                )
            }

            {
                showReportModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowReportModal(false)}>
                        <div
                            className={`w-full max-w-lg flex flex-col rounded-2xl shadow-2xl overflow-hidden ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className={`flex flex-shrink-0 items-center justify-between p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <FaFlag className="text-red-500" />
                                    Report Message
                                </h2>
                                <button
                                    onClick={() => setShowReportModal(false)}
                                    className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'}`}
                                >
                                    <FaTimes size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 max-h-[60vh] custom-scrollbar">
                                {reportStep === 1 && (
                                    <div className="space-y-4">
                                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Please select a problem to continue.</p>
                                        <div className="space-y-2">
                                            {Object.keys(REPORT_OPTIONS).map((category) => (
                                                <button
                                                    key={category}
                                                    onClick={() => { setSelectedCategory(category); setReportStep(2); }}
                                                    className={`w-full text-left p-3 rounded-xl border transition-all duration-200 flex items-center justify-between group ${isDarkMode
                                                        ? 'border-gray-700 hover:bg-gray-800 hover:border-gray-600'
                                                        : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}
                                                >
                                                    <span className="font-medium">{category}</span>
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 group-hover:translate-x-1 transition-transform`}>
                                                        <path d="M9 18l6-6-6-6" />
                                                    </svg>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {reportStep === 2 && (
                                    <div className="space-y-4 animate-fadeIn">
                                        <button
                                            onClick={() => setReportStep(1)}
                                            className="text-sm text-blue-500 hover:underline flex items-center gap-1 mb-2"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                                            Back to categories
                                        </button>
                                        <h3 className="font-semibold text-lg">{selectedCategory}</h3>
                                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Select a specific issue.</p>
                                        <div className="space-y-2">
                                            {REPORT_OPTIONS[selectedCategory].map((subCat) => (
                                                <button
                                                    key={subCat}
                                                    onClick={() => { setSelectedSubCategory(subCat); setReportStep(3); }}
                                                    className={`w-full text-left p-3 rounded-xl border transition-all duration-200 flex items-center justify-between group ${isDarkMode
                                                        ? 'border-gray-700 hover:bg-gray-800 hover:border-gray-600'
                                                        : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}
                                                >
                                                    <span className="font-medium">{subCat}</span>
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 group-hover:translate-x-1 transition-transform`}>
                                                        <path d="M9 18l6-6-6-6" />
                                                    </svg>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {reportStep === 3 && (
                                    <div className="space-y-4 animate-fadeIn">
                                        <button
                                            onClick={() => setReportStep(2)}
                                            className="text-sm text-blue-500 hover:underline flex items-center gap-1 mb-2"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                                            Back to options
                                        </button>
                                        <div>
                                            <h3 className="font-semibold text-lg mb-1">{selectedSubCategory}</h3>
                                            <span className="text-xs text-gray-500 uppercase tracking-wider">{selectedCategory}</span>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium">Please tell us more (Optional)</label>
                                            <textarea
                                                value={reportDescription}
                                                onChange={(e) => setReportDescription(e.target.value)}
                                                className={`w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all ${isDarkMode
                                                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                                                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                                                rows={4}
                                                placeholder="Provide additional details about this issue..."
                                            />
                                        </div>

                                        <div className="flex justify-end pt-2">
                                            <button
                                                onClick={handleReportSubmit}
                                                disabled={isReporting}
                                                className={`px-6 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-all shadow-lg hover:shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
                                            >
                                                {isReporting ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        Submitting...
                                                    </>
                                                ) : (
                                                    'Submit Report'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {reportStep === 4 && (
                                    <div className="flex flex-col items-center justify-center space-y-4 py-8 animate-fadeIn">
                                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
                                            <FaCheckCircle className="text-green-600 text-3xl" />
                                        </div>
                                        <h3 className="font-bold text-2xl text-center">Thank You!</h3>
                                        <p className={`text-center text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                            Your report has been successfully submitted. Our team will review this shortly to ensure a safe environment.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Admin Reports Management Modal */}
            {
                showAdminReportsModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowAdminReportsModal(false)}>
                        <div
                            className={`w-full max-w-5xl h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className={`flex flex-shrink-0 items-center justify-between p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-red-500/20' : 'bg-red-100'}`}>
                                        <FaClipboardList className="text-red-500 text-xl" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">Message Reports</h2>
                                        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Manage and resolve reported content</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={fetchAdminReports}
                                        title="Refresh Reports"
                                        disabled={adminReportsLoading}
                                        className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'} ${adminReportsLoading ? 'animate-spin' : ''}`}
                                    >
                                        <FaSync size={16} />
                                    </button>
                                    <button
                                        onClick={() => setShowAdminReportsModal(false)}
                                        className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'}`}
                                    >
                                        <FaTimes size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Filters */}
                            <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'} flex gap-2 overflow-x-auto`}>
                                {['pending', 'resolved', 'dismissed', 'all'].map(status => (
                                    <button
                                        key={status}
                                        onClick={() => setAdminReportsFilter(status)}
                                        className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-all ${adminReportsFilter === status
                                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                                            : `${isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`
                                            }`}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                {adminReportsLoading ? (
                                    <div className="flex justify-center items-center h-full">
                                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-red-500"></div>
                                    </div>
                                ) : adminReports.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                                        <div className={`p-6 rounded-full mb-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                                            <FaCheckCircle className="text-green-500 text-4xl" />
                                        </div>
                                        <h3 className="text-xl font-semibold mb-2">No Reports Found</h3>
                                        <p className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                                            There are no {adminReportsFilter !== 'all' ? adminReportsFilter : ''} reports to review at this time.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                                        {adminReports.map(report => (
                                            <div key={report._id} className={`rounded-xl p-5 border transition-all hover:shadow-lg ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${report.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                                            report.status === 'resolved' ? 'bg-green-100 text-green-700 border border-green-200' :
                                                                'bg-gray-100 text-gray-700 border border-gray-200'
                                                            }`}>
                                                            {report.status}
                                                        </span>
                                                        <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                            {new Date(report.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => handleAdminReportDelete(report._id)}
                                                            className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-50 text-red-500'}`}
                                                            title="Delete Report"
                                                        >
                                                            <FaTrash size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="mb-3">
                                                    <h3 className="font-semibold text-base mb-1">{report.category}</h3>
                                                    <span className={`text-xs px-2 py-0.5 rounded border inline-block ${isDarkMode ? 'bg-indigo-900/30 text-indigo-300 border-indigo-800' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                                                        {report.subCategory}
                                                    </span>
                                                </div>

                                                {/* Summary Info */}
                                                <div className="mb-4">
                                                    <div className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                        {report.category} <span className="opacity-50 mx-1">•</span> <span className="text-xs font-normal opacity-80">{report.subCategory}</span>
                                                    </div>
                                                    <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                        Reported by: <span className="font-medium">{report.reportedBy?.username || report.reportedBy?.email || 'Public Guest'}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 mb-4">
                                                    <button
                                                        onClick={() => { setSelectedReportDetail(report); setShowReportDetailModal(true); }}
                                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors border ${isDarkMode ? 'border-gray-600 hover:bg-gray-700 text-gray-300' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                                                    >
                                                        <FaExpand size={12} /> View Full Details
                                                    </button>
                                                </div>

                                                <div className="mb-4">
                                                    <p className={`text-xs font-semibold uppercase mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Reporter's Description:</p>
                                                    <p className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{report.description}</p>
                                                </div>

                                                {report.adminNotes && (
                                                    <div className={`mb-4 p-3 rounded-lg border ${isDarkMode ? 'bg-blue-900/20 border-blue-800 text-blue-200' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
                                                        <p className="text-xs font-bold uppercase mb-1 opacity-70">Admin Notes:</p>
                                                        <p className="text-sm">{report.adminNotes}</p>
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between pt-3 border-t border-dashed border-gray-600/30">
                                                    <div className="flex gap-2">
                                                        {report.status === 'pending' && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleAdminReportUpdate(report._id, 'resolved')}
                                                                    className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg flex items-center gap-1 transition-colors shadow-sm"
                                                                >
                                                                    <FaCheck size={12} /> Resolve
                                                                </button>
                                                                <button
                                                                    onClick={() => handleAdminReportUpdate(report._id, 'dismissed')}
                                                                    className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 transition-colors border ${isDarkMode ? 'bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                                                                >
                                                                    <FaTimes size={12} /> Dismiss
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => { setSelectedAdminReport(report); setAdminNoteText(report.adminNotes || ''); setShowAdminNoteModal(true); }}
                                                        className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 transition-colors ${isDarkMode ? 'text-blue-400 hover:bg-blue-900/20' : 'text-blue-600 hover:bg-blue-50'}`}
                                                    >
                                                        <FaCommentAlt size={12} /> {report.adminNotes ? 'Edit Note' : 'Add Note'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Admin Note Modal (Nested) */}
            {
                showAdminNoteModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowAdminNoteModal(false)}>
                        <div
                            className={`w-full max-w-md rounded-xl p-6 shadow-2xl ${isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'}`}
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold mb-4">Admin Note</h3>
                            <textarea
                                value={adminNoteText}
                                onChange={e => setAdminNoteText(e.target.value)}
                                className={`w-full border rounded-lg p-3 h-32 focus:ring-2 focus:ring-blue-500 outline-none resize-none mb-4 ${isDarkMode ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                                placeholder="Enter internal notes about this report..."
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowAdminNoteModal(false)}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleAdminReportUpdate(selectedAdminReport._id, selectedAdminReport.status, adminNoteText)}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg shadow-blue-500/20"
                                >
                                    Save Note
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* Rating Detail Modal */}
            {
                showRatingDetailModal && selectedRating && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowRatingDetailModal(false)}>
                        <div
                            className={`w-full max-w-2xl flex flex-col rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className={`flex flex-shrink-0 items-center justify-between p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${selectedRating.rating === 'up' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                        {selectedRating.rating === 'up' ? <FaThumbsUp size={20} /> : <FaThumbsDown size={20} />}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">Feedback Details</h2>
                                        <div className="flex items-center gap-2 text-xs opacity-70">
                                            <span>{selectedRating.user?.username || 'Public Guest'}</span>
                                            <span>•</span>
                                            <span>{new Date(selectedRating.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowRatingDetailModal(false)}
                                    className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'}`}
                                >
                                    <FaTimes size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                {/* Feedback (if exists) */}
                                {selectedRating.feedback && (
                                    <div className={`mb-6 p-4 rounded-xl border ${isDarkMode ? 'bg-red-900/10 border-red-900/30' : 'bg-red-50 border-red-100'}`}>
                                        <div className="text-xs font-bold uppercase tracking-wider text-red-500 mb-2">User Feedback</div>
                                        <p className="whitespace-pre-wrap">{selectedRating.feedback}</p>
                                    </div>
                                )}

                                {/* User Prompt */}
                                {selectedRating.prompt && (
                                    <div className="mb-6">
                                        <div className="text-xs font-bold uppercase tracking-wider opacity-60 mb-2 border-b border-dashed border-gray-500/30 pb-1 inline-block">User Prompt</div>
                                        <div className={`p-4 rounded-xl text-sm leading-relaxed ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                                            <p className="whitespace-pre-wrap font-mono text-opacity-90">{selectedRating.prompt}</p>
                                        </div>
                                    </div>
                                )}

                                {/* AI Response */}
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-wider opacity-60 mb-2 border-b border-dashed border-gray-500/30 pb-1 inline-block">AI Response</div>
                                    <div className={`p-4 rounded-xl text-sm leading-relaxed ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                                        <p className="whitespace-pre-wrap text-opacity-90">{selectedRating.messageContent}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Report Delete Confirmation Modal */}
            {
                showReportDeleteModal && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !selectedReportToDelete && setShowReportDeleteModal(false)}>
                        <div className={`w-full max-w-sm p-6 rounded-2xl shadow-xl transform transition-all scale-100 ${isDarkMode ? 'bg-gray-900 text-gray-100 border border-gray-800' : 'bg-white text-gray-900'}`} onClick={e => e.stopPropagation()}>
                            <div className="text-center mb-6">
                                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-red-900/20' : 'bg-red-100'}`}>
                                    <FaTrash className="text-red-500 text-2xl" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">Delete Report?</h3>
                                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    Are you sure you want to delete this report? This action cannot be undone.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowReportDeleteModal(false)}
                                    className={`flex-1 py-2.5 rounded-xl font-medium transition-colors ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDeleteReport}
                                    className="flex-1 py-2.5 rounded-xl font-medium bg-red-500 hover:bg-red-600 text-white transition-colors shadow-lg shadow-red-500/25"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Rating Delete Confirmation Modal */}
            {
                showRatingDeleteModal && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowRatingDeleteModal(false)}>
                        <div className={`w-full max-w-sm p-6 rounded-2xl shadow-xl transform transition-all scale-100 ${isDarkMode ? 'bg-gray-900 text-gray-100 border border-gray-800' : 'bg-white text-gray-900'}`} onClick={e => e.stopPropagation()}>
                            <div className="text-center mb-6">
                                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-red-900/20' : 'bg-red-100'}`}>
                                    <FaTrash className="text-red-500 text-2xl" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">Delete Rating?</h3>
                                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    Are you sure you want to delete this rating?
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowRatingDeleteModal(false)}
                                    className={`flex-1 py-2.5 rounded-xl font-medium transition-colors ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDeleteRating}
                                    className="flex-1 py-2.5 rounded-xl font-medium bg-red-500 hover:bg-red-600 text-white transition-colors shadow-lg shadow-red-500/25"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Report Detail Modal */}
            {
                showReportDetailModal && selectedReportDetail && (
                    <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowReportDetailModal(false)}>
                        <div
                            className={`w-full max-w-2xl flex flex-col rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className={`flex flex-shrink-0 items-center justify-between p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${selectedReportDetail.status === 'resolved' ? 'bg-green-500/20 text-green-500' : selectedReportDetail.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-gray-500/20 text-gray-500'}`}>
                                        <FaFlag size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">Report Details</h2>
                                        <div className="flex items-center gap-2 text-xs opacity-70">
                                            <span>{selectedReportDetail.reportedBy?.username || 'Public Guest'}</span>
                                            <span>•</span>
                                            <span>{new Date(selectedReportDetail.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowReportDetailModal(false)}
                                    className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'}`}
                                >
                                    <FaTimes size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                {/* Meta Info */}
                                <div className="flex gap-4 mb-6">
                                    <div className={`flex-1 p-3 rounded-xl border ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
                                        <div className="text-xs font-bold uppercase tracking-wider opacity-60 mb-1">Category</div>
                                        <div className="font-semibold">{selectedReportDetail.category}</div>
                                    </div>
                                    <div className={`flex-1 p-3 rounded-xl border ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
                                        <div className="text-xs font-bold uppercase tracking-wider opacity-60 mb-1">Context</div>
                                        <div className="font-semibold">{selectedReportDetail.subCategory}</div>
                                    </div>
                                </div>

                                {/* User Description */}
                                <div className={`mb-6 p-4 rounded-xl border ${isDarkMode ? 'bg-red-900/10 border-red-900/30' : 'bg-red-50 border-red-100'}`}>
                                    <div className="text-xs font-bold uppercase tracking-wider text-red-500 mb-2">Report Description</div>
                                    <p className="whitespace-pre-wrap font-medium">{selectedReportDetail.description}</p>
                                </div>

                                {/* User Prompt */}
                                {selectedReportDetail.prompt && (
                                    <div className="mb-6">
                                        <div className="text-xs font-bold uppercase tracking-wider opacity-60 mb-2 border-b border-dashed border-gray-500/30 pb-1 inline-block">Reported User Prompt</div>
                                        <div className={`p-4 rounded-xl text-sm leading-relaxed ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                                            <p className="whitespace-pre-wrap font-mono text-opacity-90">{selectedReportDetail.prompt}</p>
                                        </div>
                                    </div>
                                )}

                                {/* AI Response */}
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-wider opacity-60 mb-2 border-b border-dashed border-gray-500/30 pb-1 inline-block">Reported AI Response</div>
                                    <div className={`p-4 rounded-xl text-sm leading-relaxed ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                                        <p className="whitespace-pre-wrap text-opacity-90">{selectedReportDetail.messageContent}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            <ShareChatModal
                isOpen={isShareModalOpen}
                onClose={() => { setIsShareModalOpen(false); setShareTargetSessionId(null); }}
                sessionId={shareTargetSessionId || getOrCreateSessionId()}
                currentChatName={
                    (shareTargetSessionId && shareTargetSessionId !== getOrCreateSessionId())
                        ? (chatSessions.find(s => s.sessionId === shareTargetSessionId)?.name || "")
                        : currentChatName
                }
                themeColors={themeColors}
                onShareStatusChange={(status) => {
                    if ((shareTargetSessionId || getOrCreateSessionId()) === getOrCreateSessionId()) {
                        setIsChatShared(status);
                    }
                }}
            />

            {/* Auth Required Modal */}
            {
                authModal.isOpen && (
                    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setAuthModal({ ...authModal, isOpen: false })}>
                        <div className={`w-full max-w-sm p-6 rounded-2xl shadow-xl transform transition-all scale-100 ${isDarkMode ? 'bg-gray-900 text-gray-100 border border-gray-800' : 'bg-white text-gray-900'}`} onClick={e => e.stopPropagation()}>
                            <div className="text-center mb-6">
                                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-blue-900/20' : 'bg-blue-100'}`}>
                                    <FaUser className="text-blue-500 text-2xl" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">
                                    {authModal.type === 'save' ? 'Login to Save Chat' : 'Login to Share Chat'}
                                </h3>
                                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {authModal.type === 'save'
                                        ? 'Login to save chat with login and signup links'
                                        : 'Login to share chat publicy anywhere with signup and signin links'}
                                </p>
                            </div>
                            <div className="flex gap-3 flex-col sm:flex-row">
                                <a href="/sign-in" className="flex-1 py-2.5 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white text-center transition-colors shadow-lg shadow-blue-500/25">
                                    Login
                                </a>
                                <a href="/sign-up" className={`flex-1 py-2.5 rounded-xl font-medium text-center transition-colors border ${isDarkMode ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-50'}`}>
                                    Sign Up
                                </a>
                            </div>
                        </div>
                    </div>
                )
            }
            <VideoPreview
                isOpen={!!previewVideo}
                onClose={() => setPreviewVideo(null)}
                videos={previewVideo ? [previewVideo] : []}
            />
            {showSocialShare && (
                <SocialSharePanel
                    isOpen={showSocialShare}
                    onClose={() => setShowSocialShare(false)}
                    url={socialShareConfig.url}
                    title={socialShareConfig.title}
                    description={socialShareConfig.description}
                />
            )}
        </div>
    );
};

export default GeminiChatbox;
